import test from "node:test";
import assert from "node:assert/strict";
import { createGraph, format, KernelError } from "./kernel.mjs";
import { derived, filter, latestAsync, map, reduce } from "./sugar.mjs";

// Returns the trace entries appended while `body` runs, formatted as strings.
function during(g, body) {
  const start = g.trace.length;
  body();
  return g.trace.slice(start).map(format);
}

// Wraps a node function to count its invocations; the kernel itself keeps no counter.
function counted(fn) {
  const wrapped = (ctx) => { wrapped.calls += 1; fn(ctx); };
  wrapped.calls = 0;
  return wrapped;
}

test("K3: subscription starts with a START snapshot of the retained value", () => {
  const g = createGraph();
  g.state("a", 1);
  g.state("e");
  assert.deepEqual(during(g, () => g.subscribe("s", "a")), ["s <- a: [START, DATA(1)]"]);
  assert.deepEqual(during(g, () => g.subscribe("s", "e")), ["s <- e: [START]"]);
  assert.deepEqual(during(g, () => g.subscribe("s", "a")), [], "repeat subscribe is idempotent");
});

test("K2/P2: each set is its own wave and equal values stay DATA", () => {
  const g = createGraph();
  g.state("a", 1);
  g.subscribe("s", "a");
  assert.deepEqual(during(g, () => { g.set("a", 2); g.set("a", 2); }), [
    "s <- a: [PENDING, DATA(2)]",
    "s <- a: [PENDING, DATA(2)]",
  ]);
});

test("P3: a node outside the changed cone receives nothing", () => {
  const g = createGraph();
  g.state("a", 1);
  g.state("b", 1);
  g.node("y", ["b"], map((v) => v));
  g.subscribe("s", "y");
  assert.deepEqual(during(g, () => g.set("a", 2)), []);
});

test("P3/K2: a diamond runs its fan-in once per wave with consistent inputs", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("b", ["a"], map((v) => v + 1));
  g.node("c", ["a"], map((v) => v * 2));
  const d = counted(derived((b, c) => b + c));
  g.node("d", ["b", "c"], d);
  assert.deepEqual(during(g, () => g.subscribe("s", "d")), ["s <- d: [START, DATA(4)]"]);
  assert.deepEqual(during(g, () => g.set("a", 2)), ["s <- d: [PENDING, DATA(7)]"]);
  assert.equal(d.calls, 2, "activation plus one wave");
});

test("P4: a filter that drops settles with RESOLVED; the fan-in still runs once", () => {
  const g = createGraph();
  g.state("a", 2);
  g.node("f", ["a"], filter((v) => v % 2 === 0));
  const d = counted(derived((a, f) => `${a}/${f}`));
  g.node("d", ["a", "f"], d);
  g.subscribe("sf", "f");
  g.subscribe("sd", "d");
  assert.deepEqual(during(g, () => g.set("a", 3)), [
    "sf <- f: [PENDING, RESOLVED]",
    "sd <- d: [PENDING, DATA(\"3/2\")]",
  ]);
  assert.equal(d.calls, 2);
});

test("P8: all-RESOLVED settlement still invokes the raw function; silence becomes RESOLVED", () => {
  const g = createGraph();
  g.state("a", 2);
  g.node("f1", ["a"], filter((v) => v % 2 === 0));
  g.node("f2", ["a"], filter((v) => v % 2 === 0));
  const seen = [];
  g.node("d", ["f1", "f2"], (ctx) => {
    seen.push(ctx.deps.map((x) => JSON.stringify(x.waves)));
  });
  g.subscribe("s", "d");
  assert.deepEqual(during(g, () => g.set("a", 3)), ["s <- d: [PENDING, RESOLVED]"]);
  assert.deepEqual(seen, [["[[2]]", "[[2]]"], ["[[]]", "[[]]"]], "activation sees the snapshots, then one RESOLVED array per dependency");
});

test("K2: a host batch is one wave; every occurrence is kept", () => {
  const g = createGraph();
  g.state("a", 1);
  g.state("b", 1);
  const sum = counted(derived((a, b) => a + b));
  g.node("sum", ["a", "b"], sum);
  g.node("tens", ["a"], map((v) => v * 10));
  g.subscribe("s", "sum");
  g.subscribe("t", "tens");
  // Order across sinks follows settlement: tens settles from a alone, sum waits for b.
  assert.deepEqual(during(g, () => g.batch(() => { g.set("a", 2); g.set("a", 3); g.set("b", 5); })), [
    "t <- tens: [PENDING, DATA(20), DATA(30)]",
    "s <- sum: [PENDING, DATA(8)]",
  ]);
  assert.equal(sum.calls, 2);
});

test("K2: a throwing batch body publishes nothing, so there is nothing to roll back", () => {
  const g = createGraph();
  g.state("a", 1);
  g.subscribe("s", "a");
  const out = during(g, () => {
    assert.throws(() => g.batch(() => { g.set("a", 9); throw new Error("stop"); }), /stop/);
  });
  assert.deepEqual(out, []);
  assert.equal(g.get("a").value, 1);
});

test("K8: batch returns the body's result, outer or nested, also from a callback during a wave", () => {
  const g = createGraph();
  g.state("a", 0);
  g.node("b", ["a"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  const seen = [];
  g.subscribe("s", "b", (msgs) => {
    if (msgs[0][0] === "START" || seen.length) return;
    seen.push(g.batch(() => { g.set("a", 9); return g.batch(() => "inner"); }), g.get("b").value);
  });
  assert.equal(g.batch(() => { g.set("a", 1); return "outer"; }), "outer");
  assert.deepEqual(seen, ["inner", 1], "the body ran during the wave; its write waited");
  assert.equal(g.get("b").value, 9);
});

test("K5 auto: COMPLETE once every dependency has completed; an earlier terminal settles the node with RESOLVED", () => {
  const g = createGraph();
  g.state("a", 1);
  g.state("b", 2);
  g.node("d", ["a", "b"], derived((a, b) => a + b));
  g.subscribe("s", "d");
  // A terminal marks the cone pending like a value (K2, 2026-11-09), so d, still open, settles
  // with the kernel's RESOLVED.
  assert.deepEqual(during(g, () => g.complete("a")), ["s <- d: [PENDING, RESOLVED]"]);
  assert.deepEqual(during(g, () => g.complete("b")), ["s <- d: [PENDING, COMPLETE]"]);
});

test("K5 manual: the function receives COMPLETE as input and ends the node itself", () => {
  const g = createGraph();
  g.state("a", 0);
  g.node("r", ["a"], reduce((acc, v) => acc + v, 0), { terminal: { complete: "manual" } });
  g.subscribe("s", "r");
  g.set("a", 1);
  g.set("a", 5);
  assert.deepEqual(during(g, () => g.complete("a")), ["s <- r: [PENDING, DATA(6), COMPLETE]"]);
});

test("K5/P10: a dependency ERROR propagates; a throw becomes this node's ERROR", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("d", ["a"], map((v) => v));
  g.node("t", ["a"], (ctx) => {
    if (ctx.deps[0].waves.flat().includes(13)) throw new Error("bad");
  });
  g.subscribe("sd", "d");
  g.subscribe("st", "t");
  assert.deepEqual(during(g, () => g.set("a", 13)), [
    "sd <- d: [PENDING, DATA(13)]",
    "st <- t: [PENDING, ERROR(\"bad\")]",
  ]);
  assert.deepEqual(during(g, () => g.error("a", "boom")), ["sd <- d: [PENDING, ERROR(\"boom\")]"]);
});

test("K2: RESOLVED in node output is rejected: only the kernel sends it", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("x", ["a"], (ctx) => { if (ctx.deps[0].value === 2) ctx.down([["DATA", 1], ["RESOLVED"]]); });
  g.subscribe("s", "x");
  assert.deepEqual(during(g, () => g.set("a", 2)), ["s <- x: [PENDING, ERROR(\"x: RESOLVED is sent by the kernel, not by node output\")]"]);
});

test("START in node output is rejected: only subscribe and a replace send it", () => {
  const g = createGraph();
  g.state("a", 1);
  let kept;
  g.node("x", ["a"], (ctx) => {
    kept = ctx;
    if (ctx.deps[0].value === 2) ctx.down([["START"], ["DATA", 1]]);
  });
  g.node("y", ["x"], (ctx) => { for (const w of ctx.deps[0].waves) if (w.length) ctx.down([["DATA", w.at(-1)]]); });
  g.subscribe("s", "x");
  g.subscribe("t", "y");
  assert.throws(() => kept.down([["START"]]), /START is sent by the kernel/, "after the run, the caller gets it");
  assert.deepEqual(during(g, () => g.set("a", 2)), [
    "s <- x: [PENDING, ERROR(\"x: START is sent by the kernel, not by node output\")]",
    "t <- y: [PENDING, ERROR(\"x: START is sent by the kernel, not by node output\")]",
  ]);
});

test("O11: PENDING in node output is rejected: during the run it becomes ERROR, after the run the caller gets it", () => {
  const g = createGraph();
  g.state("a", 1);
  let kept;
  g.node("x", ["a"], (ctx) => {
    kept = ctx;
    if (ctx.deps[0].value === 2) ctx.down([["PENDING"]]);
  });
  g.subscribe("s", "x");
  assert.throws(() => kept.down([["PENDING"], ["DATA", 5]]), /PENDING is sent by the kernel/);
  assert.deepEqual(during(g, () => g.set("a", 2)), ["s <- x: [PENDING, ERROR(\"x: PENDING is sent by the kernel, not by node output\")]"]);
});

test("K7: a computed node clears on last release; plain state keeps its value", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("d", ["a"], map((v) => v * 2));
  g.subscribe("s", "d");
  g.unsubscribe("s", "d");
  assert.deepEqual(g.get("d"), { active: false, has: false, value: undefined, values: [], ended: null });
  g.set("a", 4);
  assert.equal(g.get("a").value, 4);
  assert.deepEqual(during(g, () => g.subscribe("s", "d")), ["s <- d: [START, DATA(8)]"]);
});

test("P5: an ended node can be subscribed; its snapshot carries the terminal, and nothing follows it", () => {
  const g = createGraph();
  g.state("a", 1);
  g.subscribe("s", "a");
  g.complete("a");
  assert.deepEqual(during(g, () => g.subscribe("s2", "a")), ["s2 <- a: [START, DATA(1), COMPLETE]"]);
  assert.throws(() => g.set("a", 2), /a has ended/);
});

test("P5: a node over an ended node activates on its snapshot; the ended node does not run", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  const done = counted((ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  g.node("e", ["a"], done);
  g.subscribe("s", "e");
  g.complete("a");
  g.unsubscribe("s", "e");
  assert.deepEqual(g.get("e"), { active: false, has: true, value: 1, values: [1], ended: ["COMPLETE"] });
  const runs = done.calls;
  g.node("d", ["e"], map((v) => v * 10)); // auto: ends at once, all its inputs have
  g.node("x", ["e", "b"], sumById); // auto: stays open while b is
  assert.deepEqual(during(g, () => g.subscribe("t", "d")), ["t <- d: [START, DATA(10), COMPLETE]"]);
  assert.deepEqual(during(g, () => g.subscribe("u", "x")), ["u <- x: [START, DATA(\"e=1,b=2\")]"]);
  assert.equal(done.calls, runs, "the ended node was connected, not run");
  assert.equal(g.get("e").active, true);
  assert.deepEqual(during(g, () => g.set("b", 3)), ["u <- x: [PENDING, DATA(\"e=1,b=3\")]"]);
  g.unsubscribe("u", "x");
  assert.equal(g.get("e").active, false);
});

test("K5 at activation: over an ended ERROR an auto node ends without running; manual runs and stays open", () => {
  const g = createGraph();
  g.state("a", 1);
  g.error("a", "boom");
  const fn = counted((ctx) => ctx.down([["DATA", ctx.deps[0].terminal?.[0] ?? "-"]]));
  g.node("auto", ["a"], fn);
  g.node("manual", ["a"], fn, { terminal: { complete: "manual", error: "manual" } });
  assert.deepEqual(during(g, () => g.subscribe("s", "auto")), ["s <- auto: [START, ERROR(\"boom\")]"]);
  assert.equal(fn.calls, 0);
  assert.deepEqual(during(g, () => g.subscribe("t", "manual")), ["t <- manual: [START, DATA(\"ERROR\")]"]);
});

// ---- K8: requests that arrive while the kernel is busy ---------------------
// These model users who reach the graph from inside a wave anyway, through a captured
// graph reference. The kernel neither forbids nor obeys them immediately: they wait.

// a -> b -> f <- e, and a -> d, where d's function writes e behind the graph's back.
function sideWriteGraph(dFirst) {
  const g = createGraph();
  g.state("a", 1);
  g.state("e", 0);
  g.node("b", ["a"], map((v) => v));
  g.node("d", ["a"], (ctx) => {
    const x = ctx.deps[0];
    if (x.value > 1) g.set("e", x.value); // skips the activation run, where a is 1
  });
  g.node("f", ["b", "e"], derived((b, e) => `${b}/${e}`));
  const order = dFirst ? ["d", "f"] : ["f", "d"];
  for (const id of order) g.subscribe(`s${id}`, id);
  return g;
}

test("K8/P7: a function's write to another node waits for the next wave, in either execution order", () => {
  const g = sideWriteGraph(false);
  assert.deepEqual(during(g, () => g.set("a", 2)), [
    "sf <- f: [PENDING, DATA(\"2/0\")]",
    "sd <- d: [PENDING, RESOLVED]",   // wave 1 finishes before the write runs
    "sf <- f: [PENDING, DATA(\"2/2\")]",
  ]);
  const h = sideWriteGraph(true); // d now runs before b; f still sees the same two waves
  const fOnly = during(h, () => h.set("a", 2)).filter((line) => line.startsWith("sf"));
  assert.deepEqual(fOnly, ["sf <- f: [PENDING, DATA(\"2/0\")]", "sf <- f: [PENDING, DATA(\"2/2\")]"]);
});

test("K8: a function writing its own upstream makes a request that reaches it in a later wave, not a reentry", () => {
  const g = createGraph();
  g.state("a", 1);
  const seen = [];
  g.node("x", ["a"], (ctx) => {
    const v = ctx.deps[0].value;
    seen.push(v);
    if (v > 1 && v < 4) g.set("a", v + 1); // a feedback loop the composition ends at 4
    ctx.down([["DATA", v]]);
  });
  g.subscribe("s", "x");
  assert.deepEqual(during(g, () => g.set("a", 2)),
    ["s <- x: [PENDING, DATA(2)]", "s <- x: [PENDING, DATA(3)]", "s <- x: [PENDING, DATA(4)]"],
    "each write runs after the wave that made it, as its own wave");
  assert.deepEqual(seen, [1, 2, 3, 4], "one run per wave, never nested");
  assert.equal(g.get("a").value, 4);
});

test("K8: a batch opened by a function during a wave commits later as one wave", () => {
  const g = createGraph();
  g.state("a", 1);
  g.state("p", 0);
  g.state("q", 0);
  g.node("w", ["a"], (ctx) => {
    const x = ctx.deps[0];
    if (x.value > 1) g.batch(() => { g.set("p", x.value); g.set("q", x.value); });
  });
  const pq = counted(derived((p, q) => p + q));
  g.node("pq", ["p", "q"], pq);
  g.subscribe("s", "pq");
  g.subscribe("sw", "w");
  assert.deepEqual(during(g, () => g.set("a", 2)), ["sw <- w: [PENDING, RESOLVED]", "s <- pq: [PENDING, DATA(4)]"]);
  assert.equal(pq.calls, 2, "activation plus one wave, not one per write");
});

test("K8/K3: a sink callback's write waits until every sink has the current wave", () => {
  const g = createGraph();
  g.state("a", 1);
  g.state("b", 0);
  g.subscribe("s1", "a", (msgs) => {
    if (msgs.some((m) => m[0] === "DATA" && m[1] === 2)) g.set("b", 20);
  });
  g.subscribe("s2", "a");
  g.subscribe("sb", "b");
  assert.deepEqual(during(g, () => g.set("a", 2)), [
    "s1 <- a: [PENDING, DATA(2)]",
    "s2 <- a: [PENDING, DATA(2)]",
    "sb <- b: [PENDING, DATA(20)]",
  ]);
});

test("K8/K3: unsubscribing during a wave takes effect after it", () => {
  const g = createGraph();
  g.state("a", 1);
  g.subscribe("s1", "a", (msgs) => { if (msgs[0][0] === "PENDING") g.unsubscribe("s2", "a"); });
  g.subscribe("s2", "a");
  assert.deepEqual(during(g, () => { g.set("a", 2); g.set("a", 3); }), [
    "s1 <- a: [PENDING, DATA(2)]",
    "s2 <- a: [PENDING, DATA(2)]",
    "s1 <- a: [PENDING, DATA(3)]",
  ]);
});

test("P10: a failing sink goes to the host reporter; the other sinks still receive the wave", () => {
  const reports = [];
  const g = createGraph({ report: (r) => reports.push(r) });
  g.state("a", 1);
  g.subscribe("s1", "a", (msgs) => { if (msgs[0][0] === "PENDING") throw new Error("ui broke"); });
  g.subscribe("s2", "a");
  assert.deepEqual(during(g, () => g.set("a", 2)), ["s1 <- a: [PENDING, DATA(2)]", "s2 <- a: [PENDING, DATA(2)]"]);
  assert.deepEqual(reports, [{ source: "sink s1", error: "ui broke" }]);
});

test("P10: without a host reporter nothing is kept, and a throwing reporter cannot break the wave", () => {
  for (const options of [{}, { report: () => { throw new Error("reporter down"); } }]) {
    const g = createGraph(options);
    g.state("a", 1);
    g.subscribe("s1", "a", (msgs) => { if (msgs[0][0] === "PENDING") throw new Error("ui broke"); });
    g.subscribe("s2", "a");
    assert.deepEqual(during(g, () => g.set("a", 2)), ["s1 <- a: [PENDING, DATA(2)]", "s2 <- a: [PENDING, DATA(2)]"]);
    assert.equal("reports" in g, false, "the graph exposes no failure history");
  }
});

test("K8: a read during a wave returns the retained value; reading never computes", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("b", ["a"], map((v) => v + 1));
  g.node("c", ["a"], map((v) => v + 2));
  let seen;
  g.subscribe("sb", "b", (msgs) => { if (msgs[0][0] === "PENDING") seen = g.get("c"); });
  g.subscribe("sc", "c");
  g.set("a", 2);
  assert.equal(seen.value, 3, "c has not settled yet when b's sink reads it");
  assert.equal(g.get("c").value, 4);
});

test("O3: a read inside a batch body returns the retained value; nothing applies before commit", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("d", ["a"], map((v) => v * 2));
  g.subscribe("s", "d");
  let seenA, seenD;
  const out = during(g, () => g.batch(() => {
    g.set("a", 5);
    seenA = g.get("a").value;
    seenD = g.get("d").value;
  }));
  assert.deepEqual([seenA, seenD], [1, 2], "batch delivers nothing before commit");
  assert.deepEqual(out, ["s <- d: [PENDING, DATA(10)]"]);
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("O3: an async batch body is refused before any of it runs, including after its await", async () => {
  const g = createGraph();
  g.state("from", 100);
  g.state("to", 0);
  g.subscribe("sf", "from");
  g.subscribe("st", "to");
  const start = g.trace.length;
  assert.throws(() => g.batch(async () => {
    g.set("from", 0);
    await null;
    g.set("to", 100);
  }), /async function/);
  await tick();
  assert.deepEqual(g.trace.slice(start), []);
  assert.deepEqual([g.get("from").value, g.get("to").value], [100, 0]);
});

test("O3: a plain body that returns a promise commits its synchronous part and is reported", async () => {
  const reports = [];
  const g = createGraph({ report: (r) => reports.push(r) });
  g.state("a", 0);
  g.state("b", 0);
  g.node("ab", ["a", "b"], derived((a, b) => `${a}/${b}`));
  g.subscribe("s", "ab");
  const start = g.trace.length;
  g.batch(() => {
    g.set("a", 1);
    return (async () => { await null; g.set("b", 2); })();
  });
  await tick();
  // The write after the await is a separate wave, so observers see the half state 1/0.
  assert.deepEqual(g.trace.slice(start).map(format), ["s <- ab: [PENDING, DATA(\"1/0\")]", "s <- ab: [PENDING, DATA(\"1/2\")]"]);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].source, "batch");
});

// ---- P9 async, K7 lifetimes and cleanup, K6 invalidation, H6 quiet ---------

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test("P9: ctx.down after the function returned is a new wave; the starting wave closes now; nothing is paired", () => {
  const g = createGraph();
  g.state("a", 1);
  const sends = [];
  g.node("q", ["a"], (ctx) => {
    if (ctx.deps[0].value > 1) sends.push(ctx); // keep ctx to call down later
  });
  g.node("d", ["q", "a"], derived((q, a) => `${q}@${a}`));
  g.subscribe("sq", "q");
  g.subscribe("sd", "d");
  const out = during(g, () => {
    g.set("a", 2);
    g.set("a", 3);
    sends[1].down([["DATA", "r3"]]);
    sends[0].down([["DATA", "r2"]]); // the older request finishes last
  });
  assert.deepEqual(out, [
    // No PENDING stays open while the work runs: each wave settles with RESOLVED.
    "sq <- q: [PENDING, RESOLVED]", "sd <- d: [PENDING, RESOLVED]",
    "sq <- q: [PENDING, RESOLVED]", "sd <- d: [PENDING, RESOLVED]",
    "sq <- q: [PENDING, DATA(\"r3\")]", "sd <- d: [PENDING, DATA(\"r3@3\")]",
    // Arrival order, combined with a's current value: the kernel pairs nothing.
    "sq <- q: [PENDING, DATA(\"r2\")]", "sd <- d: [PENDING, DATA(\"r2@3\")]",
  ]);
});

test("P9 sugar: latestAsync publishes only the newest request and aborts the rest", async () => {
  const g = createGraph();
  g.state("a", 1);
  const calls = [];
  g.node("q", ["a"], latestAsync((v, signal) => {
    const d = deferred();
    calls.push({ v, signal, ...d });
    return d.promise;
  }));
  g.subscribe("s", "q");
  await tick();
  assert.deepEqual(during(g, () => g.set("a", 2)), ["s <- q: [PENDING, RESOLVED]"]);
  await tick();
  assert.deepEqual(calls.map((c) => [c.v, c.signal.aborted]), [[1, true], [2, false]]);
  const start = g.trace.length;
  calls[1].resolve("r2");
  calls[0].resolve("r1");
  await tick();
  assert.deepEqual(g.trace.slice(start).map(format), ["s <- q: [PENDING, DATA(\"r2\")]"]);
  g.set("a", 3);
  await tick();
  g.unsubscribe("s", "q");
  assert.equal(calls[2].signal.aborted, true, "closing the lifetime aborts the request in flight");
});

test("P9 sugar: a run without a new value does not lose latestAsync's abort at close", async () => {
  const g = createGraph();
  g.state("q", 1);
  g.state("other", 0);
  const calls = [];
  // The function reads q only; a write to other runs it with no new value from q.
  g.node("f", ["q", "other"], latestAsync((v, signal) => { calls.push({ v, signal }); return deferred().promise; }));
  g.subscribe("s", "f");
  await tick();
  g.set("other", 1);
  await tick();
  g.unsubscribe("s", "f");
  assert.deepEqual(calls.map((c) => [c.v, c.signal.aborted]), [[1, true]],
    "the lifetime's signal aborts it (a cleanup registered per run was dropped by the next run)");
});

test("K7: output through a closed lifetime's ctx is dropped; the signal follows the old lifetime", () => {
  const g = createGraph();
  g.state("a", 1);
  const ctxs = [];
  g.node("q", ["a"], (ctx) => { ctxs.push(ctx); });
  g.subscribe("s", "q");
  g.unsubscribe("s", "q");
  assert.equal(ctxs[0].signal.aborted, true, "first access after close is already aborted");

  g.subscribe("s2", "q"); // a new lifetime
  const out = during(g, () => {
    ctxs[0].down([["DATA", "old"]]);
    ctxs[1].down([["DATA", "new"]]);
  });
  assert.deepEqual(out, ["s2 <- q: [PENDING, DATA(\"new\")]"]);
  assert.equal(ctxs[1].signal.aborted, false);
});

test("K7: setup runs once per lifetime, before the first run; its cleanup runs at close, after the dependencies are released", () => {
  const reports = [];
  const g = createGraph({ report: (r) => reports.push(r) });
  const log = [];
  g.state("a", 1);
  g.node("p", ["a"], (ctx) => ctx.down(ctx.deps[0].waves.flat().map((v) => ["DATA", v])),
    { setup: () => () => log.push("close p") });
  g.node("q", ["p"], (ctx) => {
    log.push(`run q${ctx.deps[0].value}`);
    ctx.state.set(ctx.deps[0].value);
    ctx.down([["DATA", ctx.deps[0].value]]);
  }, {
    setup: (ctx) => {
      log.push(`setup q over ${ctx.deps[0].value}`);
      return () => { log.push(`close q, last ${ctx.state.get()}`); throw new Error("leak"); };
    },
  });
  g.subscribe("s", "q");
  g.set("a", 2);
  assert.deepEqual(log, ["setup q over 1", "run q1", "run q2"], "a later run does not run setup or drop the cleanup");
  log.length = 0;
  g.unsubscribe("s", "q");
  assert.deepEqual(log, ["close p", "close q, last 2"], "the cleanup reads the retiring private state");
  assert.deepEqual(reports, [{ source: "cleanup q", error: "leak" }]);
  log.length = 0;
  g.subscribe("s", "q");
  assert.deepEqual(log, ["setup q over 2", "run q2"], "a new lifetime runs setup again");
});

test("K7: what setup sends is part of the first run's output; a throw in setup ends the node as a throw of the function does", () => {
  const g = createGraph();
  g.node("src", [], () => {}, { setup: (ctx) => { ctx.down([["DATA", 1]]); } });
  assert.deepEqual(during(g, () => g.subscribe("s", "src")), ["s <- src: [START, DATA(1)]"]);
  let ran = false;
  g.node("bad", [], () => { ran = true; }, { setup: () => { throw new Error("no socket"); } });
  g.subscribe("s", "bad");
  assert.deepEqual(g.get("bad").ended, ["ERROR", "no socket"]);
  assert.equal(ran, false, "the function does not run after its setup threw");
});

test("K5/K7: a node that ends closes its lifetime at once, while still subscribed", () => {
  const g = createGraph();
  g.state("a", 1);
  let ctx = null;
  let closed = 0;
  g.node("q", ["a"], (c) => { ctx = c; }, { setup: () => () => { closed += 1; } });
  g.subscribe("s", "q");
  assert.deepEqual(during(g, () => g.complete("a")), ["s <- q: [PENDING, COMPLETE]"]);
  assert.equal(closed, 1, "its cleanup ran");
  assert.equal(ctx.signal.aborted, true, "its signal is aborted");
  assert.equal(g.get("a").active, false, "its dependency was released");
});

test("K6: INVALIDATE clears values down the cone once, marking it pending, without running auto functions", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("b", ["a"], (ctx) => ctx.down(ctx.deps[0].waves.flat().map((v) => ["DATA", v * 10])));
  g.node("c", ["a"], map((v) => v + 1));
  const d = counted(derived((b, c) => b + c));
  g.node("d", ["b", "c"], d);
  g.subscribe("sd", "d");
  g.subscribe("sb", "b");
  // INVALIDATE marks the cone like a value (K2, 2026-11-09), so d waits for both b and c and
  // is invalidated once, after both have settled.
  assert.deepEqual(during(g, () => g.invalidate("a")), ["sb <- b: [PENDING, INVALIDATE]", "sd <- d: [PENDING, INVALIDATE]"]);
  assert.deepEqual(during(g, () => g.invalidate("a")), [], "repeat is ineffective");
  assert.deepEqual(during(g, () => g.set("a", 2)), ["sb <- b: [PENDING, DATA(20)]", "sd <- d: [PENDING, DATA(23)]"]);
  assert.equal(d.calls, 2, "activation plus the recompute; invalidation ran nothing");
});

test("K6/P4: a pending node whose invalidation is a no-op still settles with RESOLVED", () => {
  const g = createGraph();
  g.state("a", 1);
  g.state("x");
  g.node("d", ["a", "x"], derived((a, x) => a + x)); // no value yet: x is empty
  g.subscribe("s", "d");
  assert.deepEqual(during(g, () => g.batch(() => { g.invalidate("a"); g.set("x", 5); })), ["s <- d: [PENDING, RESOLVED]"]);
});

test("H6: a quiet node does not make its dependents wait; its output is a later wave and silence costs nothing", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("q", ["a"], map((v) => v * 10), { quiet: true });
  g.node("f", ["q", "a"], derived((q, a) => `${q}/${a}`));
  g.node("z", ["a"], filter((v) => v > 100), { quiet: true });
  g.subscribe("sf", "f");
  g.subscribe("sq", "q");
  g.subscribe("sz", "z");
  assert.deepEqual(during(g, () => g.set("a", 2)), [
    "sf <- f: [PENDING, DATA(\"10/2\")]",  // f settles from a alone
    "sf <- f: [PENDING, DATA(\"20/2\")]",  // q's result arrives as its own wave
    "sq <- q: [PENDING, DATA(20)]",
  ]);
});

test("H6: a quiet node passes an INVALIDATE on at once (it carries no PENDING); an inherited ERROR is a later wave", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("q", ["a"], map((v) => v * 10), { quiet: true });
  g.node("f", ["q", "a"], derived((q, a) => `${q}/${a}`));
  g.subscribe("sq", "q"); // q's own sink comes first in q's delivery order
  g.subscribe("sf", "f");
  assert.deepEqual(during(g, () => g.invalidate("a")), ["sq <- q: [PENDING, INVALIDATE]", "sf <- f: [PENDING, INVALIDATE]"]);
  g.set("a", 2);
  assert.deepEqual(during(g, () => g.error("a", "down")), ["sf <- f: [PENDING, ERROR(\"down\")]", "sq <- q: [PENDING, ERROR(\"down\")]"]);
});

test("R-wave-boundary: each ctx.down call is its own array; a dependent sees them as waves and runs once", () => {
  const g = createGraph();
  g.state("a", 0);
  g.node("x", ["a"], (ctx) => {
    for (const v of ctx.deps[0].waves.flat()) { ctx.down([["DATA", v]]); ctx.down([["DATA", v + 1], ["DATA", v + 2]]); }
  });
  const seen = [];
  g.node("y", ["x"], (ctx) => { seen.push(ctx.deps[0].waves); });
  g.subscribe("sx", "x");
  g.subscribe("sy", "y");
  seen.length = 0;
  assert.deepEqual(during(g, () => g.set("a", 10)), [
    "sx <- x: [PENDING, DATA(10)]",
    "sx <- x: [PENDING, DATA(11), DATA(12)]",
    "sy <- y: [PENDING, RESOLVED]",
  ]);
  assert.deepEqual(seen, [[[10], [11, 12]]], "one invocation, both arrays, boundaries kept");
});

test("O13: messages keep their written order; an array is split at its INVALIDATE and what came before is dropped", () => {
  const g = createGraph();
  const src = {};
  g.node("src", [], (ctx) => { src.ctx = ctx; ctx.down([["DATA", 0]]); });
  const seen = [];
  g.node("y", ["src"], (ctx) => { seen.push(ctx.deps[0].waves); ctx.down([["DATA", ctx.deps[0].value]]); });
  g.subscribe("s", "src");
  g.subscribe("sy", "y");
  seen.length = 0;
  assert.deepEqual(during(g, () => src.ctx.down([["DATA", 1], ["INVALIDATE"], ["DATA", 2], ["DATA", 3]])), [
    "s <- src: [PENDING, INVALIDATE]",
    "s <- src: [PENDING, DATA(2), DATA(3)]",
    "sy <- y: [PENDING, INVALIDATE]",
    "sy <- y: [PENDING, DATA(3)]",
  ]);
  assert.deepEqual(seen, [[[2, 3]]], "the function sees only what came after the INVALIDATE");
  assert.equal(g.get("src").value, 3);
});

// The second reviews (decided by the user 2026-11-10): a function that has nothing to send sends
// nothing, so RESOLVED is the kernel's alone, like PENDING, and DATA and RESOLVED cannot meet.
test("K2: a silent run settles with the kernel's one RESOLVED; a function cannot send RESOLVED itself", () => {
  const g = createGraph();
  g.state("a", 1);
  let ctx;
  g.node("x", ["a"], (c) => { ctx = c; if (c.deps[0].value === 1) c.down([["DATA", 1]]); });
  g.subscribe("s", "x");
  assert.deepEqual(during(g, () => g.set("a", 2)), ["s <- x: [PENDING, RESOLVED]"]);
  assert.throws(() => ctx.down([["RESOLVED"]]), /RESOLVED is sent by the kernel/, "after the run too");
});

test("O13: a terminal must be last in its array; an array is split at its last INVALIDATE", () => {
  const g = createGraph();
  const src = {};
  g.node("src", [], (ctx) => { src.ctx = ctx; });
  g.subscribe("s", "src");
  assert.throws(() => src.ctx.down([["COMPLETE"], ["DATA", 1]]), KernelError);
  assert.deepEqual(during(g, () => src.ctx.down([["DATA", 1], ["INVALIDATE"], ["DATA", 2]])), ["s <- src: [PENDING, DATA(2)]"],
    "the INVALIDATE finds no value and is dropped; what came before it is gone");
});

test("O13: in one wave an input that is invalidated and then gets a value: auto invalidates, then runs on the value", () => {
  const g = createGraph();
  const src = {};
  g.node("src", [], (ctx) => { src.ctx = ctx; ctx.down([["DATA", 1]]); });
  const log = [];
  g.node("y", ["src"], (ctx) => { log.push(`run ${ctx.deps[0].value} ${ctx.deps[0].invalidated}`); ctx.down([["DATA", ctx.deps[0].value]]); });
  g.subscribe("sy", "y");
  log.length = 0;
  assert.deepEqual(during(g, () => src.ctx.down([["INVALIDATE"], ["DATA", 2]])),
    ["sy <- y: [PENDING, INVALIDATE]", "sy <- y: [PENDING, DATA(2)]"]);
  assert.deepEqual(log, ["run 2 false"], "auto: the function sees only what came after, and no flag");
});

test("O13: a batch is one accumulated array per node, split at its INVALIDATE at commit", () => {
  const g = createGraph();
  g.state("a", 0);
  g.subscribe("s", "a");
  assert.deepEqual(during(g, () => g.batch(() => { g.set("a", 1); g.invalidate("a"); g.set("a", 2); })), [
    "s <- a: [PENDING, INVALIDATE]",
    "s <- a: [PENDING, DATA(2)]",
  ]);
});

test("O13: across separate arrays in one wave, a dependent drops what came before an INVALIDATE", () => {
  const g = createGraph();
  g.state("a", 0);
  g.node("x", ["a"], (ctx) => {
    const v = ctx.deps[0].value;
    ctx.down([["DATA", v]]);
    if (v === 1) ctx.down([["INVALIDATE"]]);
  });
  const seen = [];
  g.node("y", ["x"], (ctx) => { seen.push(ctx.deps[0].waves); ctx.down([["DATA", "y"]]); });
  g.subscribe("sx", "x");
  g.subscribe("sy", "y");
  seen.length = 0;
  assert.deepEqual(during(g, () => g.set("a", 1)), [
    "sx <- x: [PENDING, DATA(1)]",
    "sx <- x: [PENDING, INVALIDATE]",
    "sy <- y: [PENDING, INVALIDATE]",
  ]);
  assert.deepEqual(seen, [], "DATA(1) was before the INVALIDATE, so the function does not run for it");
});

test("K6/O13: one input invalidated and another with DATA in one wave: the node invalidates, then its function runs", () => {
  const g = createGraph();
  g.state("a", 1);
  g.state("b", 1);
  const seen = [];
  g.node("d", ["a", "b"], (ctx) => {
    seen.push(ctx.deps.map((x) => [x.has, x.waves]));
    ctx.down([["DATA", "d"]]);
  });
  g.subscribe("s", "d");
  seen.length = 0;
  assert.deepEqual(during(g, () => g.batch(() => { g.invalidate("a"); g.set("b", 2); })), [
    "s <- d: [PENDING, INVALIDATE]",
    's <- d: [PENDING, DATA("d")]',
  ]);
  assert.deepEqual(seen, [[[false, []], [true, [[2]]]]], "a is absent; b delivered one array");
});

test("K6 manual: an input's INVALIDATE is the function's input; private state is kept under auto", () => {
  const g = createGraph();
  g.state("a", 1);
  const seen = [];
  // auto: the kernel invalidates the node and runs nothing; private state stays
  g.node("x", ["a"], (ctx) => { ctx.state.set((ctx.state.get() ?? 0) + 1); ctx.down([["DATA", ctx.deps[0].value]]); });
  // manual: the function sees the INVALIDATE, clears its own count, and sends INVALIDATE itself
  g.node("y", ["a"], (ctx) => {
    const d = ctx.deps[0];
    seen.push(`${d.invalidated ? "inv" : "-"} ${JSON.stringify(d.waves)}`);
    if (d.invalidated) { ctx.state.set(0); ctx.down([["INVALIDATE"]]); }
    if (d.waves.length) { ctx.state.set((ctx.state.get() ?? 0) + 1); ctx.down([["DATA", d.value]]); }
  }, { invalidate: "manual" });
  g.subscribe("sx", "x"); g.subscribe("sy", "y");
  seen.length = 0;
  assert.deepEqual(during(g, () => g.invalidate("a")), ["sx <- x: [PENDING, INVALIDATE]", "sy <- y: [PENDING, INVALIDATE]"]);
  assert.deepEqual(seen, ["inv []"]);
  assert.deepEqual([g.privateState("x"), g.privateState("y")], [1, 0], "auto keeps private state; manual decides");
  g.set("a", 4);
  seen.length = 0;
  g.batch(() => { g.set("a", 5); g.invalidate("a"); g.set("a", 6); });
  assert.deepEqual(seen, ["inv [[6]]"], "what came before the INVALIDATE is gone; what came after is input");
  assert.deepEqual(during(g, () => g.invalidate("a")), ["sx <- x: [PENDING, INVALIDATE]", "sy <- y: [PENDING, INVALIDATE]"]);
  assert.deepEqual(during(g, () => g.invalidate("a")), [], "a has no value: the INVALIDATE is dropped and starts no wave");
});

test("H6: a quiet node's arrays from one settlement go out together, as one later wave", () => {
  const g = createGraph();
  g.state("a", 0);
  g.node("q", ["a"], (ctx) => { for (const v of ctx.deps[0].waves.flat()) { ctx.down([["DATA", v]]); ctx.down([["DATA", v + 1]]); } }, { quiet: true });
  const seen = [];
  g.node("y", ["q"], (ctx) => { seen.push(ctx.deps[0].waves); });
  g.subscribe("sq", "q");
  g.subscribe("sy", "y");
  seen.length = 0;
  assert.deepEqual(during(g, () => g.set("a", 5)), [
    "sq <- q: [PENDING, DATA(5)]",
    "sq <- q: [PENDING, DATA(6)]",
    "sy <- y: [PENDING, RESOLVED]",
  ]);
  assert.deepEqual(seen, [[[5], [6]]], "y runs once on both arrays");
});

test("P1: describe is the declared topology as data, in creation order", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("q", ["a"], () => {}, { quiet: true });
  g.node("c", ["a", "q"], () => {});
  assert.deepEqual(g.describe(), [
    { id: "a", kind: "state", deps: [], quiet: false },
    { id: "q", kind: "node", deps: ["a"], quiet: true },
    { id: "c", kind: "node", deps: ["a", "q"], quiet: false },
  ]);
  g.describe()[2].deps.push("x");
  assert.deepEqual(g.describe()[2].deps, ["a", "q"], "a copy: changing it changes no node");
});

test("K10: status is derived: empty/stale/ready, open/completed/errored, inactive/active/closing", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("d", ["a"], map((v) => v * 2));
  const status = (id) => Object.values(g.status(id)).join(" ");
  assert.equal(status("d"), "empty open inactive", "reading does not activate");
  assert.equal(g.get("d").active, false);
  g.subscribe("s", "d");
  assert.equal(status("d"), "ready open active");
  g.invalidate("a");
  assert.equal(status("d"), "empty open active");
  g.set("a", 3);
  g.complete("a");
  assert.equal(status("d"), "ready completed active", "the value stays; output has ended");
  g.state("e", 0);
  g.subscribe("se", "e");
  g.error("e", "x");
  assert.equal(status("e"), "ready errored active");
});

test("K10: stale is visible only inside a wave, for a node whose notification is not settled yet", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("b", ["a"], map((v) => v + 1));
  g.node("c", ["b"], map((v) => v + 1));
  const seen = [];
  // s sees a's array first; b and c are pending, not settled at that moment.
  g.subscribe("s", "a", (msgs) => { if (msgs[0][0] === "PENDING") seen.push(["a", "b", "c"].map((id) => g.status(id).cache)); });
  g.subscribe("sc", "c", (msgs) => { if (msgs[0][0] === "PENDING") seen.push(["a", "b", "c"].map((id) => g.status(id).cache)); });
  g.set("a", 5);
  assert.deepEqual(seen, [["ready", "stale", "stale"], ["ready", "ready", "ready"]]);
  assert.deepEqual(["a", "b", "c"].map((id) => g.status(id).cache), ["ready", "ready", "ready"], "after the wave, never stale");
});

test("K10: lifecycle is closing while a lifetime's cleanup runs, then inactive", () => {
  const g = createGraph();
  g.state("a", 1);
  let during = null;
  g.node("q", ["a"], () => {}, { setup: () => () => { during = g.status("q").lifecycle; } });
  g.subscribe("s", "q");
  g.unsubscribe("s", "q");
  assert.equal(during, "closing");
  assert.equal(g.status("q").lifecycle, "inactive");
});

test("K10: a quiet node is not stale while its later wave is pending", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("q", ["a"], map((v) => v * 10), { quiet: true });
  g.state("t", 0);
  const seen = [];
  g.subscribe("sq", "q");
  g.subscribe("sa", "a", (msgs) => { if (msgs[0][0] === "PENDING") seen.push(g.status("q").cache); });
  g.set("a", 2);
  assert.deepEqual(seen, ["ready"], "q keeps its value through this wave; its change is a later wave");
  assert.equal(g.get("q").value, 20);
});

test("K10: a quiet node inheriting an ERROR is not stale once it has settled in that wave", () => {
  const g = createGraph();
  g.state("a", 1);
  g.state("b", 1);
  g.node("q", ["a", "b"], (ctx) => { ctx.down([["DATA", "q"]]); }, { quiet: true });
  const seen = [];
  g.subscribe("sq", "q");
  // b's subscriber runs after q settled: q was marked pending by b and got a's ERROR.
  g.subscribe("sb", "b", (msgs) => { if (msgs[0][0] === "PENDING") seen.push(g.status("q").cache); });
  g.batch(() => { g.error("a", "boom"); g.set("b", 2); });
  assert.deepEqual(seen, ["ready"], "settled; its ERROR is a later wave");
  assert.equal(g.status("q").output, "errored");
});

test("K5: automatic COMPLETE waits until the node has received every dependency's terminal, not just until they ended", () => {
  const g = createGraph();
  g.state("b", 1);
  g.node("x", ["b"], map((v) => v));
  g.node("m", ["x", "b"], derived((x, b) => x + b));
  g.subscribe("sx", "x");
  g.subscribe("sb", "b");
  g.subscribe("sm", "m"); // b delivers to x, then sb, then m
  assert.deepEqual(during(g, () => g.complete("b")), ["sx <- x: [PENDING, COMPLETE]", "sb <- b: [PENDING, COMPLETE]", "sm <- m: [PENDING, COMPLETE]"],
    "m has x's COMPLETE first, but completes only when b's own COMPLETE reaches it");
});

// ---- Replace: a node keeps its id and subscribers and gets a new instance ---------

test("replace: an ended node gets a fresh instance; sinks get a START snapshot, dependents its input in one wave", () => {
  const g = createGraph();
  g.state("a", 1);
  // x ends once a reaches 2; d treats that terminal as input and stays open.
  g.node("x", ["a"], (ctx) => ctx.down(ctx.deps[0].value < 2 ? [["DATA", ctx.deps[0].value]] : [["COMPLETE"]]));
  g.node("d", ["x"], (ctx) => ctx.down([["DATA", ctx.deps[0].waves.flat()]]), { terminal: { complete: "manual" } });
  g.subscribe("s", "d");
  g.subscribe("t", "x");
  g.set("a", 2);
  assert.deepEqual(g.get("x").ended, ["COMPLETE"]);
  assert.deepEqual(during(g, () => g.replace("x", ["a"], (ctx) => ctx.down([["DATA", ctx.deps[0].value * 10]]))), [
    "t <- x: [START, DATA(20)]",
    "s <- d: [PENDING, DATA([20])]",
  ]);
  assert.deepEqual(g.get("x"), { active: true, has: true, value: 20, values: [20], ended: null });
  assert.deepEqual(during(g, () => g.set("a", 5)), ["s <- d: [PENDING, DATA([50])]", "t <- x: [PENDING, DATA(50)]"],
    "the subscriber order is kept: d subscribed to x before t did");
});

test("replace: the old lifetime closes (signal, cleanup) and its late output is dropped; the new instance has its own setup", () => {
  const g = createGraph();
  g.state("a", 1);
  const log = [];
  let late;
  g.node("x", ["a"], (ctx) => {
    late = ctx;
    ctx.signal.addEventListener("abort", () => log.push("abort"));
  }, { setup: () => () => log.push("cleanup") });
  g.subscribe("s", "x");
  g.replace("x", ["a"], () => {}, { setup: () => () => log.push("cleanup 2") });
  assert.deepEqual(log, ["abort", "cleanup"]);
  g.unsubscribe("s", "x");
  assert.deepEqual(log, ["abort", "cleanup", "cleanup 2"], "the new instance ran the setup it was given");
  g.replace("x", ["a"], () => {});
  g.subscribe("s", "x");
  g.unsubscribe("s", "x");
  assert.deepEqual(log, ["abort", "cleanup", "cleanup 2"], "a replace without one leaves the instance without setup");
  assert.deepEqual(during(g, () => late.down([["DATA", "old"]])), []);
});

test("replace: new dependencies are acquired before the old ones are released, so a shared one stays active", () => {
  const g = createGraph();
  g.state("a", 1);
  g.state("b", 2);
  const log = [];
  g.node("up", ["a"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]), { setup: () => () => log.push("up closed") });
  g.node("x", ["up"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  g.subscribe("s", "x");
  g.replace("x", ["up", "b"], (ctx) => ctx.down([["DATA", ctx.deps[0].value + ctx.deps[1].value]]));
  assert.deepEqual(log, [], "up was never released while x still needed it");
  assert.deepEqual(g.describe().find((d) => d.id === "x").deps, ["up", "b"]);
  g.replace("x", ["b"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  assert.deepEqual(log, ["up closed"], "a dependency only the old instance had is released");
});

test("replace: an inactive node only changes its definition; the next subscription activates it", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("x", ["a"], (ctx) => ctx.down([["DATA", 1]]));
  g.replace("x", ["a"], (ctx) => ctx.down([["DATA", 2]]));
  assert.deepEqual(during(g, () => g.subscribe("s", "x")), ["s <- x: [START, DATA(2)]"]);
});

test("replace: during a wave it waits until the wave is over (K8)", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("x", ["a"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  g.subscribe("s", "x", (msgs) => { if (msgs.some((m) => m[1] === 2)) g.replace("x", ["a"], (ctx) => ctx.down([["DATA", -ctx.deps[0].value]])); });
  g.subscribe("t", "x");
  assert.deepEqual(during(g, () => g.set("a", 2)), [
    "s <- x: [PENDING, DATA(2)]",
    "t <- x: [PENDING, DATA(2)]",
    "s <- x: [START, DATA(-2)]",
    "t <- x: [START, DATA(-2)]",
  ]);
});

test("replace: refused for a state node and for a dependency on itself", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("x", ["a"], () => {});
  g.node("y", ["x"], () => {});
  assert.throws(() => g.replace("a", [], () => {}), /not a computed node/);
  assert.throws(() => g.replace("x", ["y"], () => {}), /depend on itself/);
});

test("replace: the snapshot is one wave, so a diamond below the replaced node settles once (P3)", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("x", ["a"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  g.node("l", ["x"], (ctx) => ctx.down([["DATA", ctx.deps[0].value + 1]]));
  g.node("r", ["x"], (ctx) => ctx.down([["DATA", ctx.deps[0].value + 2]]));
  const j = counted((ctx) => ctx.down([["DATA", [ctx.deps[0].value, ctx.deps[1].value]]]));
  g.node("j", ["l", "r"], j);
  g.subscribe("s", "j");
  j.calls = 0;
  assert.deepEqual(during(g, () => g.replace("x", ["a"], (ctx) => ctx.down([["DATA", 10]]))), ["s <- j: [PENDING, DATA([11,12])]"]);
  assert.equal(j.calls, 1);
});

test("replace: a dependent no longer holds the old instance's value when the new one has none yet", () => {
  const g = createGraph();
  g.state("a", 1);
  g.state("b", 0);
  g.node("x", ["a"], (ctx) => ctx.down([["DATA", "old"]]));
  const seen = [];
  g.node("d", ["x", "b"], (ctx) => seen.push(ctx.deps[0].has ? ctx.deps[0].value : "none"));
  g.subscribe("s", "d");
  g.replace("x", ["a"], () => {});
  g.set("b", 1);
  assert.deepEqual(seen, ["old", "none"]);
});

test("replace: a new instance that ends at once closes its lifetime and releases its dependencies", () => {
  const g = createGraph();
  g.state("a", 1);
  const log = [];
  g.node("up", ["a"], (ctx) => ctx.down([["DATA", 1]]), { setup: () => () => log.push("up closed") });
  g.node("x", ["up"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  g.subscribe("s", "x");
  assert.deepEqual(during(g, () => g.replace("x", ["up"], (ctx) => ctx.down([["COMPLETE"]]))), ["s <- x: [START, COMPLETE]"]);
  assert.deepEqual(log, ["up closed"]);
});

test("replace: an ended node gives its terminal snapshot; after a replace a new instance runs", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("x", ["a"], (ctx) => ctx.down([["COMPLETE"]]));
  g.subscribe("s", "x");
  g.unsubscribe("s", "x");
  assert.deepEqual(during(g, () => g.subscribe("t", "x")), ["t <- x: [START, COMPLETE]"]);
  g.unsubscribe("t", "x");
  g.replace("x", ["a"], (ctx) => ctx.down([["DATA", 2]]));
  assert.deepEqual(during(g, () => g.subscribe("t", "x")), ["t <- x: [START, DATA(2)]"]);
});

test("replace: a new instance over an ended dependency starts on its snapshot (P5)", () => {
  const g = createGraph();
  g.state("a", 1);
  g.state("done", 0);
  g.complete("done");
  g.node("x", ["a"], () => {});
  g.subscribe("s", "x");
  assert.deepEqual(during(g, () => g.replace("x", ["done"], sumById)), ["s <- x: [START, DATA(\"done=0\"), COMPLETE]"],
    "auto: every dependency has ended, so the new instance completes after its run");
});

// ---- rewire (surgical, C-8; on ctx since 2026-11-10, F7) ---------------------

// Sums the current value of every dependency, by id, so a reorder cannot fool it.
const sumById = (ctx) => ctx.down([["DATA", ctx.deps.map((d) => `${d.id}=${d.value}`).join(",")]]);

// Wraps a node function to keep the ctx of its latest run, so a test can call ctx.rewire from
// outside an invocation, at a wave boundary (F7: a node rewires itself; the graph has no rewire).
function withCtx(fn) {
  const wrapped = (ctx) => { wrapped.ctx = ctx; fn(ctx); };
  return wrapped;
}

test("rewire: the instance stays: value, private state, lifetime and sinks; no START", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b");
  const log = [];
  const fn = withCtx((ctx) => {
    ctx.state.set((ctx.state.get() ?? 0) + 1);
    ctx.signal.addEventListener("abort", () => log.push("abort"));
    ctx.down([["DATA", ctx.state.get()]]);
  });
  g.node("x", ["a"], fn);
  g.subscribe("s", "x");
  assert.deepEqual(during(g, () => fn.ctx.rewire(["a", "b"])), [], "b has no value: nothing runs, nothing is sent");
  assert.deepEqual(g.get("x"), { active: true, has: true, value: 1, values: [1], ended: null });
  assert.deepEqual(during(g, () => g.set("b", 0)), ["s <- x: [PENDING, DATA(2)]"], "private state kept: the count goes on");
  assert.deepEqual(log, [], "the lifetime did not close");
});

test("rewire: an added dependency's value is one ordinary input wave; the fn runs once", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  const fn = counted(sumById);
  const x = withCtx(fn);
  g.node("x", ["a"], x);
  g.subscribe("s", "x");
  const calls = fn.calls;
  assert.deepEqual(during(g, () => x.ctx.rewire(["a", "b"])), ["s <- x: [PENDING, DATA(\"a=1,b=2\")]"]);
  assert.equal(fn.calls, calls + 1);
  assert.deepEqual(during(g, () => g.set("b", 3)), ["s <- x: [PENDING, DATA(\"a=1,b=3\")]"]);
});

test("rewire: several added dependencies arrive in one wave, each value its own input", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2); g.state("c", 3);
  const seen = [];
  const fn = withCtx((ctx) => { seen.push(ctx.deps.map((d) => d.waves.flat())); });
  g.node("x", ["a"], fn);
  g.subscribe("s", "x");
  fn.ctx.rewire(["a", "b", "c"]);
  assert.deepEqual(seen.at(-1), [[], [2], [3]], "a was kept, so it brings no input");
  assert.equal(seen.length, 2);
});

test("rewire: a diamond below settles once (P3)", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  const x = withCtx(sumById);
  g.node("x", ["a"], x);
  g.node("l", ["x"], (ctx) => ctx.down([["DATA", `l:${ctx.deps[0].value}`]]));
  g.node("r", ["x"], (ctx) => ctx.down([["DATA", `r:${ctx.deps[0].value}`]]));
  const join = counted((ctx) => ctx.down([["DATA", ctx.deps.map((d) => d.value).join("|")]]));
  g.node("j", ["l", "r"], join);
  g.subscribe("s", "j");
  const before = join.calls;
  x.ctx.rewire(["a", "b"]);
  assert.equal(join.calls, before + 1);
  assert.equal(g.get("j").value, "l:a=1,b=2|r:a=1,b=2");
});

test("rewire: a removed dependency is released without a wave and no longer drives the node", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  const fn = counted(sumById);
  const x = withCtx(fn);
  g.node("x", ["a", "b"], x);
  g.subscribe("s", "x");
  const calls = fn.calls;
  assert.deepEqual(during(g, () => x.ctx.rewire(["b"])), []);
  assert.equal(fn.calls, calls, "removing runs nothing");
  assert.equal(g.get("a").active, false);
  assert.equal(g.get("x").value, "a=1,b=2", "the value is kept");
  assert.deepEqual(during(g, () => g.set("a", 5)), []);
  assert.deepEqual(during(g, () => g.set("b", 6)), ["s <- x: [PENDING, DATA(\"b=6\")]"]);
});

test("rewire: kept dependencies keep their records across a reorder", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  const fn = counted(sumById);
  const x = withCtx(fn);
  g.node("x", ["a", "b"], x);
  g.subscribe("s", "x");
  const calls = fn.calls;
  x.ctx.rewire(["b", "a"]);
  assert.equal(fn.calls, calls);
  assert.deepEqual(during(g, () => g.set("a", 7)), ["s <- x: [PENDING, DATA(\"b=2,a=7\")]"], "a's edge follows it to index 1");
  assert.deepEqual(g.describe().find((d) => d.id === "x").deps, ["b", "a"]);
});

test("rewire: to the current list is a no-op; to zero dependencies keeps the value and stays active", () => {
  const g = createGraph();
  g.state("a", 1);
  const fn = counted(sumById);
  const x = withCtx(fn);
  g.node("x", ["a"], x);
  g.subscribe("s", "x");
  const calls = fn.calls;
  assert.deepEqual(during(g, () => x.ctx.rewire(["a"])), []);
  assert.equal(fn.calls, calls);
  x.ctx.rewire([]);
  assert.deepEqual(g.get("x"), { active: true, has: true, value: "a=1", values: ["a=1"], ended: null });
  assert.equal(g.get("a").active, false);
});

test("rewire: an added dependency is acquired before a removed one is released, so a shared upstream stays active", () => {
  const g = createGraph();
  g.state("a", 1);
  const log = [];
  g.node("up", ["a"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]), { setup: () => () => log.push("up closed") });
  g.node("p", ["up"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  g.node("q", ["up"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  const x = withCtx(sumById);
  g.node("x", ["p"], x);
  g.subscribe("s", "x");
  x.ctx.rewire(["q"]);
  assert.deepEqual(log, []);
  assert.equal(g.get("p").active, false);
  assert.equal(g.get("x").value, "q=1");
});

// F7: rewire changes the dependencies only; replace is the way to change the function.
test("rewire: the function stays: the same function runs after it, over the new list", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  const fn = counted(sumById);
  const x = withCtx(fn);
  g.node("x", ["a"], x);
  g.subscribe("s", "x");
  assert.deepEqual(during(g, () => x.ctx.rewire(["b"])), ["s <- x: [PENDING, DATA(\"b=2\")]"]);
  assert.deepEqual(during(g, () => g.set("b", 3)), ["s <- x: [PENDING, DATA(\"b=3\")]"]);
  assert.equal(fn.calls, 3, "activation, b's snapshot, then b's write: one function throughout");
  assert.equal(g.definition("x").fn, x);
});

test("rewire: an added dependency that has ended arrives as its snapshot (P5); a kept one that ended stays", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2); g.state("done", 3);
  g.complete("done");
  const x = withCtx(sumById);
  g.node("x", ["a", "b"], x, { terminal: { complete: "manual" } });
  g.subscribe("s", "x");
  assert.deepEqual(during(g, () => x.ctx.rewire(["a", "b", "done"])), ["s <- x: [PENDING, DATA(\"a=1,b=2,done=3\")]"]);
  g.complete("b");
  x.ctx.rewire(["b"]);
  assert.deepEqual(g.describe().find((d) => d.id === "x").deps, ["b"]);
});

// F7: a state node has no ctx, so it cannot be asked to rewire. An ended node's lifetime is
// closed, so its rewire is dropped as ctx.down after close is, instead of refused.
test("rewire: refused for itself, a cycle and duplicates; a rewire of an ended node is dropped", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  const x = withCtx(sumById);
  g.node("x", ["a"], x);
  g.node("y", ["x"], sumById);
  g.subscribe("s", "x");
  assert.throws(() => x.ctx.rewire(["x"]), /depend on itself/);
  assert.throws(() => x.ctx.rewire(["y"]), /depend on itself through y/);
  assert.throws(() => x.ctx.rewire(["a", "a"]), /distinct/);
  const e = withCtx((ctx) => ctx.down([["COMPLETE"]]));
  g.node("e", ["a"], e);
  g.subscribe("t", "e");
  assert.deepEqual(during(g, () => e.ctx.rewire(["b"])), []);
  assert.deepEqual(g.describe().find((d) => d.id === "e").deps, ["a"]);
  assert.equal(g.get("b").active, false, "nothing was acquired");
});

// F7: an inactive node has no lifetime, so nothing can rewire it.
test("rewire: through an old ctx after deactivation it is dropped; the next activation starts from the declared dependencies", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  const fn = counted(sumById);
  const x = withCtx(fn);
  g.node("x", ["a"], x);
  g.subscribe("s", "x");
  const old = x.ctx;
  g.unsubscribe("s", "x");
  const calls = fn.calls;
  assert.deepEqual(during(g, () => old.rewire(["b"])), []);
  assert.equal(fn.calls, calls);
  assert.equal(g.get("b").active, false);
  assert.deepEqual(g.describe().find((d) => d.id === "x").deps, ["a"]);
  assert.deepEqual(during(g, () => g.subscribe("s", "x")), ["s <- x: [START, DATA(\"a=1\")]"]);
});

test("rewire: requested from inside a node function, it waits until the wave is over (K8)", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  const order = [];
  const fn = (ctx) => {
    order.push(ctx.deps.map((d) => d.id).join());
    if (ctx.deps.length === 1 && ctx.deps[0].value === 5) ctx.rewire(["a", "b"]);
  };
  g.node("x", ["a"], fn);
  g.subscribe("s", "x");
  g.set("a", 5);
  assert.deepEqual(order, ["a", "a", "a,b"], "the run that asked finished with the old list");
});

test("rewire: an added dependency that ends as it activates passes its terminal on (K5)", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("once", [], (ctx) => ctx.down([["DATA", 9], ["ERROR", "boom"]]));
  const x = withCtx(sumById);
  g.node("x", ["a"], x);
  g.subscribe("s", "x");
  x.ctx.rewire(["a", "once"]);
  assert.deepEqual(g.get("x").ended, ["ERROR", "boom"]);
  assert.equal(g.get("a").active, false, "x's lifetime closed and released a");
});

test("rewire: an added dependency that only completes as it activates sends nothing below", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("empty", [], (ctx) => ctx.down([["COMPLETE"]]));
  const fn = counted(() => {}); // runs for the terminal, sends nothing
  const x = withCtx(fn);
  g.node("x", ["a"], x, { terminal: { complete: "manual" } });
  g.subscribe("s", "x");
  assert.deepEqual(during(g, () => x.ctx.rewire(["a", "empty"])), [], "no value, so no PENDING and no RESOLVED");
  assert.equal(fn.calls, 2, "a manual terminal is input: x ran for it");
});

test("rewire: a node that stays silent for its added dependency's value sends nothing below", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  const fn = counted((ctx) => { if (!ctx.deps.some((d) => d.id === "b")) ctx.down([["DATA", "a only"]]); });
  const x = withCtx(fn);
  g.node("x", ["a"], x);
  g.subscribe("s", "x");
  assert.deepEqual(during(g, () => x.ctx.rewire(["a", "b"])), []);
  assert.equal(fn.calls, 2);
});

test("rewire: removing the last open dependency does not complete an auto node, as in TS", () => {
  // Checked against TS at dafc5ae: unsubscribeDep(b) after a completed leaves d settled; only a
  // dependency's terminal arriving triggers the auto COMPLETE (K5).
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  const d = withCtx(sumById);
  g.node("d", ["a", "b"], d);
  g.subscribe("s", "d");
  g.complete("a");
  assert.deepEqual(during(g, () => d.ctx.rewire(["a"])), []);
  assert.equal(g.get("d").ended, null);
});

// F7: the rewire belongs to the lifetime; the declared dependencies are the definition's.
test("rewire: lasts for its lifetime only; the next lifetime starts from the declared dependencies", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  const x = withCtx(sumById);
  g.node("x", ["a"], x);
  const depsOf = () => [g.describe().find((d) => d.id === "x").deps, g.definition("x").deps];
  g.subscribe("s", "x");
  x.ctx.rewire(["a", "b"]);
  assert.deepEqual(depsOf(), [["a", "b"], ["a"]], "describe shows the lifetime's, definition the declared");
  g.unsubscribe("s", "x");
  assert.deepEqual(depsOf(), [["a"], ["a"]]);
  assert.equal(g.get("b").active, false);
  assert.deepEqual(during(g, () => g.subscribe("s", "x")), ["s <- x: [START, DATA(\"a=1\")]"]);
  assert.deepEqual(depsOf(), [["a"], ["a"]]);
  assert.deepEqual(during(g, () => g.set("b", 3)), [], "b no longer drives x");
});

test("rewire: one queued in a wave whose lifetime closes before the wave ends is dropped", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  const fn = counted((ctx) => {
    if (ctx.deps[0].value === 2) ctx.rewire(["a", "b"]);
    sumById(ctx);
  });
  g.node("x", ["a"], fn);
  // w comes before x among a's subscribers, so its unsubscribe is queued before x's rewire.
  g.subscribe("w", "a", () => { if (g.get("a").value === 2) g.unsubscribe("s", "x"); });
  g.subscribe("s", "x");
  const calls = fn.calls;
  assert.deepEqual(during(g, () => g.set("a", 2)), ["w <- a: [PENDING, DATA(2)]", "s <- x: [PENDING, DATA(\"a=2\")]"]);
  assert.equal(fn.calls, calls + 1, "the rewire never ran x for b");
  assert.equal(g.get("x").active, false);
  assert.equal(g.get("b").active, false);
  assert.deepEqual(g.describe().find((d) => d.id === "x").deps, ["a"], "not applied to the inactive node either");
});

test("rewire: a node that ends goes back to its declared dependencies", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  const x = withCtx(sumById);
  g.node("x", ["a"], x);
  g.subscribe("s", "x");
  x.ctx.rewire(["a", "b"]);
  g.error("b", "boom");
  assert.deepEqual(g.get("x").ended, ["ERROR", "boom"]);
  assert.deepEqual(g.describe().find((d) => d.id === "x").deps, ["a"]);
  assert.deepEqual([g.get("a").active, g.get("b").active], [false, false], "the ended lifetime released both");
});

test("replace: a dependency in both lists keeps its connection and its place among its dependency's subscribers", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("x", ["a"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  g.node("y", ["a"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  g.subscribe("sx", "x");
  g.subscribe("sy", "y");
  g.replace("x", ["a"], (ctx) => ctx.down([["DATA", ctx.deps[0].value * 10]]));
  assert.deepEqual(during(g, () => g.set("a", 2)), ["sx <- x: [PENDING, DATA(20)]", "sy <- y: [PENDING, DATA(2)]"],
    "x still comes before y in a's subscriber order");
  assert.throws(() => g.replace("x", ["a", "a"], () => {}), /distinct/);
});

test("replace: the new instance gets a START snapshot from a dependency it keeps, as at a first subscription (K3)", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("x", ["a"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  g.subscribe("s", "x");
  const seen = [];
  g.replace("x", ["a"], (ctx) => { seen.push(ctx.deps[0].waves); });
  assert.deepEqual(seen, [[[1]]], "a's value arrives as this run's wave, as it would for a relay");
});

// ---- topology requests inside a batch body (O3, K8, C-22) -------------------

test("O3/K8: a subscribe in a batch body runs after commit; the new sink starts from the committed value", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("d", ["a"], map((v) => v * 10));
  g.subscribe("s", "a");
  let activeInBody;
  const out = during(g, () => g.batch(() => {
    g.set("a", 2);
    g.subscribe("t", "d");
    g.batch(() => g.subscribe("u", "a")); // a nested batch's requests join the outer one
    activeInBody = g.get("d").active;
  }));
  assert.equal(activeInBody, false, "nothing activates before commit");
  assert.deepEqual(out, ["s <- a: [PENDING, DATA(2)]", "t <- d: [START, DATA(20)]", "u <- a: [START, DATA(2)]"]);
});

test("C-22: a rewire in a batch body waits for commit; the batch's wave settles under the old shape", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 5);
  const x = withCtx(sumById); // reads its dependencies by id, so one function serves both shapes (F7)
  g.node("x", ["a"], x);
  g.subscribe("s", "x");
  let depsInBody;
  const out = during(g, () => g.batch(() => {
    g.set("a", 2);
    x.ctx.rewire(["b"]);
    depsInBody = g.describe().find((d) => d.id === "x").deps;
  }));
  assert.deepEqual(depsInBody, ["a"], "the topology does not change on the uncommitted view");
  assert.deepEqual(out, ["s <- x: [PENDING, DATA(\"a=2\")]", "s <- x: [PENDING, DATA(\"b=5\")]"]);
});

test("O3/K8: a replace in a batch body waits for commit", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 5);
  g.node("x", ["a"], sumById);
  g.subscribe("s", "x");
  const out = during(g, () => g.batch(() => { g.set("a", 2); g.replace("x", ["b"], sumById); }));
  assert.deepEqual(out, ["s <- x: [PENDING, DATA(\"a=2\")]", "s <- x: [START, DATA(\"b=5\")]"]);
});

test("O3/K8: an unsubscribe in a batch body waits for commit; the sink still sees the batch", () => {
  const g = createGraph();
  g.state("a", 1);
  const log = [];
  g.node("d", ["a"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]), { setup: () => () => log.push("cleanup") });
  g.subscribe("s", "d");
  let logInBody;
  const out = during(g, () => g.batch(() => { g.set("a", 2); g.unsubscribe("s", "d"); logInBody = [...log]; }));
  assert.deepEqual(logInBody, [], "no cleanup runs before commit");
  assert.deepEqual(out, ["s <- d: [PENDING, DATA(2)]"]);
  assert.deepEqual(log, ["cleanup"]);
  assert.equal(g.get("d").active, false);
});

test("O3: a throwing batch body drops its requests with its inputs", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 5);
  const x = withCtx(sumById);
  g.node("x", ["a"], x);
  g.subscribe("s", "x");
  const out = during(g, () => assert.throws(() => g.batch(() => {
    g.set("a", 2);
    g.subscribe("t", "a");
    x.ctx.rewire(["b"]);
    g.unsubscribe("s", "x");
    throw new Error("stop");
  }), /stop/));
  assert.deepEqual(out, []);
  assert.deepEqual(g.describe().find((d) => d.id === "x").deps, ["a"]);
  assert.deepEqual(during(g, () => g.set("a", 3)), ["s <- x: [PENDING, DATA(\"a=3\")]"], "s stays, t never came");
});

test("K8: a batch body's requests run in order, before later requests and those of its commit wave", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 1);
  g.subscribe("s", "a", () => {
    if (g.get("a").value !== 2) return;
    g.batch(() => { g.set("b", 2); g.subscribe("t", "b"); }); // a batch from a callback (O12)
    g.subscribe("u", "b");
  });
  g.subscribe("w", "b", () => { if (g.get("b").value === 2) g.subscribe("v", "b"); });
  assert.deepEqual(during(g, () => g.set("a", 2)), [
    "s <- a: [PENDING, DATA(2)]",
    "w <- b: [PENDING, DATA(2)]",
    "t <- b: [START, DATA(2)]",
    "u <- b: [START, DATA(2)]",
    "v <- b: [START, DATA(2)]",
  ]);
});

// F7 (changed): until 2026-11-10 the rewire was refused at its turn and reported as a queued
// request; it now belongs to x's lifetime, which the commit closed, so it is dropped silently.
test("O3/K8: a body's rewire whose node its own commit ends is dropped, not reported", () => {
  const reports = [];
  const g = createGraph({ report: (r) => reports.push(r) });
  g.state("a", 1); g.state("b", 2);
  const x = withCtx(sumById);
  g.node("x", ["a"], x); // auto: ends with a
  g.subscribe("s", "x");
  g.batch(() => { g.complete("a"); x.ctx.rewire(["a", "b"]); });
  assert.deepEqual(reports, []);
  assert.deepEqual(g.get("x").ended, ["COMPLETE"]);
  assert.deepEqual(g.describe().find((d) => d.id === "x").deps, ["a"]);
  assert.equal(g.get("b").active, false);
});

// ---- reads for a checkpoint (O5, R-snapshot) ---------------------------------

test("O5: idle is false inside a wave and a batch body; privateState reads the current lifetime's", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("t", ["a"], (ctx) => { ctx.state.set((ctx.state.get() ?? 0) + ctx.deps[0].value); ctx.down([["DATA", ctx.state.get()]]); });
  const seen = [];
  g.subscribe("s", "t", () => seen.push(g.idle()));
  g.set("a", 2);
  g.batch(() => seen.push(g.idle()));
  assert.deepEqual(seen, [false, false, false], "the START snapshot, the wave, the batch body");
  assert.equal(g.idle(), true);
  assert.equal(g.privateState("t"), 3);
  g.unsubscribe("s", "t");
  assert.equal(g.privateState("t"), undefined, "a closed lifetime's private state is gone (K7)");
});

// ---- H4 seed, optional, and P5's exception for it (2026-11-08, for restore) -----------

test("H4: a seed gives a node its last array's values and private state without running its fn; activation runs it as usual", () => {
  const g = createGraph();
  g.state("a", 1);
  const fn = counted((ctx) => { if (ctx.deps[0].value > 1) ctx.down([["DATA", ctx.state.get() + ctx.deps[0].value]]); });
  g.node("x", ["a"], fn, { seed: { values: [9, 10], state: 100 } });
  assert.deepEqual(g.get("x"), { active: false, has: true, value: 10, values: [9, 10], ended: null });
  assert.equal(g.privateState("x"), 100);
  assert.equal(fn.calls, 0);
  assert.deepEqual(during(g, () => g.subscribe("s", "x")), ["s <- x: [START, DATA(9), DATA(10)]"], "a silent activation keeps the seed");
  assert.equal(fn.calls, 1);
  assert.deepEqual(during(g, () => g.set("a", 2)), ["s <- x: [PENDING, DATA(102)]"]);
  g.node("n", ["a"], fn, { seed: { values: [null] } });
  assert.deepEqual(g.get("n"), { active: false, has: true, value: null, values: [null], ended: null }, "null is a value");
  g.node("v", ["a"], fn, { seed: {} });
  assert.equal(g.get("v").has, false, "a seed without a value holds none");
});

test("H4: a seeded ended node is ended with its dependencies and never runs (P5)", () => {
  const g = createGraph();
  g.state("a", 1);
  const fn = counted(() => {});
  g.node("e", ["a"], fn, { seed: { values: [3], ended: ["COMPLETE"] } });
  assert.deepEqual(g.get("e"), { active: false, has: true, value: 3, values: [3], ended: ["COMPLETE"] });
  assert.deepEqual(g.describe().find((d) => d.id === "e").deps, ["a"]);
  assert.deepEqual(during(g, () => g.subscribe("k", "e")), ["k <- e: [START, DATA(3), COMPLETE]"]);
  assert.equal(g.get("a").active, false, "an ended node holds none of its dependencies");
  g.node("d", ["e", "a"], sumById, { terminal: { complete: "manual" } });
  assert.deepEqual(during(g, () => g.subscribe("s", "d")), ["s <- d: [START, DATA(\"e=3,a=1\")]"]);
  assert.equal(fn.calls, 0);
});

// ---- K3: a node retains the values of its last wave (2026-11-08) ----------------------

test("K3: a new subscriber gets the values of the node's last array that had any; INVALIDATE clears them", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("b", ["a"], (ctx) => {
    const v = ctx.deps[0].value;
    if (v === 0) return; // silent: the retained values stay
    ctx.down([["DATA", v * 10]]);
    ctx.down([["DATA", v * 10 + 1], ["DATA", v * 10 + 2]]); // a second array of the same run
  });
  g.subscribe("s", "b");
  g.batch(() => { g.set("a", 2); g.set("a", 3); });
  assert.deepEqual(g.get("a").values, [2, 3], "a batch is one array: both occurrences");
  assert.deepEqual(g.get("b").values, [31, 32], "the last array only, not merged with the one before");
  g.set("a", 0);
  assert.deepEqual(during(g, () => g.subscribe("t", "b")), ["t <- b: [START, DATA(31), DATA(32)]"],
    "a silent run keeps the last values");
  const seen = [];
  g.node("d", ["b"], (ctx) => { seen.push(ctx.deps[0].waves); });
  g.subscribe("u", "d");
  assert.deepEqual(seen, [[[31, 32]]], "a new dependent gets them as one array of its first run");
  g.set("a", 4);
  assert.deepEqual(g.get("b").values, [41, 42]);
  g.invalidate("a");
  assert.deepEqual(g.get("b").values, []);
  assert.deepEqual(during(g, () => g.subscribe("v", "b")), ["v <- b: [START]"]);
});

test("K3: values after an INVALIDATE in the same wave are the retained ones", () => {
  const g = createGraph();
  g.state("a", 1);
  g.subscribe("s", "a");
  g.batch(() => { g.set("a", 2); g.invalidate("a"); g.set("a", 3); g.set("a", 4); });
  assert.deepEqual(g.get("a").values, [3, 4]);
});

test("K3: a node's own INVALIDATE between two of its arrays drops the values before it", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("b", ["a"], (ctx) => { ctx.down([["DATA", 1]]); ctx.down([["INVALIDATE"]]); ctx.down([["DATA", 2]]); });
  g.subscribe("s", "b");
  assert.deepEqual(g.get("b").values, [2]);
});

test("K3: get returns a copy of the values; changing it changes nothing", () => {
  const g = createGraph();
  g.state("a", 1);
  g.get("a").values.push(99);
  assert.deepEqual(during(g, () => g.subscribe("s", "a")), ["s <- a: [START, DATA(1)]"]);
});

test("K1: PAUSE, RESUME, PULL and TEARDOWN are not message types (P11, K9, decided 2026-11-09)", () => {
  const g = createGraph();
  g.state("a", 1);
  const refused = [];
  g.node("n", ["a"], (ctx) => {
    for (const type of ["PAUSE", "RESUME", "PULL", "TEARDOWN"]) {
      try { ctx.down([[type]]); } catch (e) { if (e instanceof KernelError) refused.push(type); }
    }
    ctx.down([["DATA", ctx.deps[0].value]]);
  });
  g.subscribe("s", "n");
  assert.deepEqual(refused, ["PAUSE", "RESUME", "PULL", "TEARDOWN"]);
  assert.deepEqual(g.get("n").values, [1]);
});

// Clauses added to C-29, C-33, C-35 and C-44 for the activation plan (2026-11-09).
test("C-35: a rewire adding a dependency with no snapshot runs nothing; one onto a node depending on D is refused; to no dependencies releases them", () => {
  const g = createGraph();
  g.state("B", 1); g.state("G");
  let runs = 0;
  const fD = (ctx) => { runs += 1; ctx.down([["DATA", ctx.deps.map((d) => d.value ?? null)]]); };
  let ctxD;
  g.node("D", ["B"], (ctx) => { ctxD = ctx; fD(ctx); });
  g.subscribe("s", "D");
  runs = 0;
  assert.deepEqual(during(g, () => ctxD.rewire(["B", "G"])), []);
  assert.equal(runs, 0);
  assert.deepEqual(during(g, () => g.set("G", 5)), ["s <- D: [PENDING, DATA([1,5])]"]);
  g.node("H", ["D"], (ctx) => ctx.down([["DATA", 1]]));
  g.subscribe("sh", "H");
  assert.throws(() => ctxD.rewire(["B", "H"]), /would depend on itself through H/);
  assert.deepEqual(during(g, () => ctxD.rewire([])), []);
  assert.deepEqual([g.get("D").value, g.get("B").active], [[1, 5], false]);
  assert.deepEqual(during(g, () => g.set("B", 9)), []);
});

test("C-29: a nested batch joins the outer one and returns its body's value", () => {
  const g = createGraph();
  g.state("A", 1); g.state("B", 1);
  const sum = counted(derived((a, b) => a + b));
  g.node("S", ["A", "B"], sum);
  g.subscribe("s", "S");
  let inner;
  assert.deepEqual(during(g, () => g.batch(() => { g.set("A", 2); inner = g.batch(() => { g.set("B", 3); return "in"; }); })),
    ["s <- S: [PENDING, DATA(5)]"]);
  assert.equal(inner, "in");
  assert.equal(sum.calls, 2, "activation and one commit wave");
});

test("C-33: status is derived from what the node holds", () => {
  const g = createGraph();
  g.state("A");
  const log = [];
  g.node("N", ["A"], (ctx) => {
    if (ctx.deps[0].has) ctx.down([["DATA", ctx.deps[0].value]]);
  }, { setup: () => () => log.push(`closing: ${g.status("N").lifecycle}`) });
  const st = () => g.status("N");
  assert.deepEqual(st(), { cache: "empty", output: "open", lifecycle: "inactive" });
  g.subscribe("s", "N");
  g.set("A", 1); g.set("A", 2);
  assert.deepEqual(st(), { cache: "ready", output: "open", lifecycle: "active" });
  g.invalidate("A");
  assert.deepEqual(st().cache, "empty");
  g.set("A", 3);
  g.unsubscribe("s", "N");
  assert.deepEqual([st().lifecycle, log.at(-1)], ["inactive", "closing: closing"]);
  g.subscribe("s", "N");
  g.complete("A");
  assert.deepEqual(st(), { cache: "ready", output: "completed", lifecycle: "active" });
});

test("C-44: the kernel adds only the settling RESOLVED, and a quiet node never holds a wave", () => {
  const g = createGraph();
  g.state("A", 1);
  g.node("F", ["A"], (ctx) => { if (ctx.deps[0].value % 2 === 0) ctx.down([["DATA", ctx.deps[0].value]]); });
  let kept;
  g.node("Q", ["A"], (ctx) => { kept = ctx; if (ctx.deps[0].value === 2) ctx.down([["DATA", "in-run"]]); }, { quiet: true });
  g.node("D", ["A", "Q"], (ctx) => ctx.down([["DATA", ctx.deps.map((d) => d.value ?? null)]]));
  g.subscribe("sf", "F"); g.subscribe("sq", "Q"); g.subscribe("sd", "D");
  assert.deepEqual(during(g, () => g.set("A", 3)), ["sf <- F: [PENDING, RESOLVED]", "sd <- D: [PENDING, DATA([3,null])]"]);
  assert.deepEqual(during(g, () => g.set("A", 2)), [
    "sf <- F: [PENDING, DATA(2)]", "sd <- D: [PENDING, DATA([2,null])]",
    "sq <- Q: [PENDING, DATA(\"in-run\")]", "sd <- D: [PENDING, DATA([2,\"in-run\"])]",
  ]);
  assert.deepEqual(during(g, () => kept.down([["DATA", "late"]])), ["sq <- Q: [PENDING, DATA(\"late\")]", "sd <- D: [PENDING, DATA([2,\"late\"])]"]);
  assert.deepEqual(during(g, () => g.set("A", 5)), ["sf <- F: [PENDING, RESOLVED]", "sd <- D: [PENDING, DATA([5,\"late\"])]"]);
  assert.deepEqual(during(g, () => g.invalidate("A")), ["sf <- F: [PENDING, INVALIDATE]", "sq <- Q: [PENDING, INVALIDATE]", "sd <- D: [PENDING, INVALIDATE]"]);
});

test("K2: a wave of terminals marks the cone pending, so a manual fan-in runs once on both terminals", () => {
  for (const [end, policy] of [["complete", { complete: "manual" }], ["error", { error: "manual" }]]) {
    const g = createGraph();
    g.state("S", 1);
    g.node("B", ["S"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
    g.node("C", ["S"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
    const runs = [];
    g.node("D", ["B", "C"], (ctx) => { runs.push(ctx.deps.map((d) => d.terminal?.[0] ?? "-").join(",")); }, { terminal: policy });
    g.subscribe("s", "D");
    runs.length = 0;
    if (end === "complete") g.complete("S"); else g.error("S", "e");
    assert.deepEqual(runs, end === "complete" ? ["COMPLETE,COMPLETE"] : ["ERROR,ERROR"], `${end}: one run that sees both legs`);
  }
});

test("K2/K5: an auto COMPLETE goes out with the run's output, so a manual dependent runs once on both", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("d", ["a"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  const runs = [];
  g.node("e", ["d"], (ctx) => runs.push(`${JSON.stringify(ctx.deps[0].waves)} ${ctx.deps[0].terminal?.[0] ?? "-"}`), { terminal: { complete: "manual" } });
  g.subscribe("s", "e");
  g.subscribe("sd", "d");
  runs.length = 0;
  assert.deepEqual(during(g, () => g.batch(() => { g.set("a", 2); g.complete("a"); })),
    ["s <- e: [PENDING, RESOLVED]", "sd <- d: [PENDING, DATA(2)]", "sd <- d: [PENDING, COMPLETE]"]);
  assert.deepEqual(runs, ["[[2]] COMPLETE"]);
});

test("C-44: under the manual INVALIDATE policy a fan-in runs once on a wave of INVALIDATEs, seeing both", () => {
  const g = createGraph();
  g.state("S", 1);
  g.node("B", ["S"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  g.node("C", ["S"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  const runs = [];
  g.node("D", ["B", "C"], (ctx) => { runs.push(ctx.deps.map((d) => (d.invalidated ? "inv" : "-")).join(",")); }, { invalidate: "manual" });
  g.subscribe("s", "D");
  runs.length = 0;
  assert.deepEqual(during(g, () => g.invalidate("S")), ["s <- D: [PENDING, RESOLVED]"], "D kept its value and sent nothing");
  assert.deepEqual(runs, ["inv,inv"]);
});

test("K5/K6: an INVALIDATE before an auto ERROR in one wave still takes effect, under either INVALIDATE policy", () => {
  for (const invalidate of ["auto", "manual"]) {
    const g = createGraph();
    g.state("a", 1);
    g.node("m", ["a"], (ctx) => { if (ctx.deps[0].has) ctx.down([["DATA", ctx.deps[0].value]]); }, { invalidate });
    g.subscribe("s", "m");
    assert.deepEqual(during(g, () => g.batch(() => { g.invalidate("a"); g.error("a", "boom"); })),
      ["s <- m: [PENDING, INVALIDATE]", "s <- m: [PENDING, ERROR(\"boom\")]"], invalidate);
    assert.deepEqual(during(g, () => g.subscribe("s2", "m")), ["s2 <- m: [START, ERROR(\"boom\")]"], `${invalidate}: no stale value in the snapshot`);
  }
});

// set(id, fn) (decided by the user 2026-11-10): given a function, the value is computed when the write
// takes its place in request order, so a controller needs no copy of the state outside the graph.
test("set with a function: two made during one wave both apply, each on the value before it", () => {
  const g = createGraph();
  g.state("locks", []);
  g.state("a", 1);
  g.subscribe("s", "a", (msgs) => {
    if (msgs[0][0] === "START") return;
    // During the wave: g.get("locks") is still [] here, so two plain sets would lose one lock.
    g.set("locks", (ls) => [...ls, "x"]);
    g.set("locks", (ls) => [...ls, "y"]);
  });
  g.set("a", 2);
  assert.deepEqual(g.get("locks").value, ["x", "y"]);
});

test("set with a function in a batch body sees the writes staged before it; an INVALIDATE leaves it nothing", () => {
  const g = createGraph();
  g.state("n", 1);
  g.subscribe("s", "n");
  const seen = [];
  const out = during(g, () => g.batch(() => {
    g.set("n", (v) => { seen.push(v); return v + 1; });
    g.set("n", 10);
    g.set("n", (v) => { seen.push(v); return v + 1; });
    g.invalidate("n");
    g.set("n", (v) => { seen.push(v); return 0; });
  }));
  assert.deepEqual(seen, [1, 10, undefined], "resolved at the commit, in staging order");
  assert.deepEqual(out, ["s <- n: [PENDING, INVALIDATE]", "s <- n: [PENDING, DATA(0)]"]);
});

test("set with a function: a throwing fn fails the write; in a batch it drops the whole commit", () => {
  const reports = [];
  const g = createGraph({ report: (r) => reports.push(r) });
  g.state("a", 1);
  g.state("b", 1);
  g.node("c", ["a"], () => {});
  assert.throws(() => g.set("a", () => { throw new Error("no"); }), /no/);
  assert.throws(() => g.set("c", (v) => v), /not a state node/);
  assert.throws(() => g.batch(() => { g.set("b", 2); g.set("a", () => { throw new Error("no"); }); }), /no/);
  assert.deepEqual([g.get("a").value, g.get("b").value], [1, 1], "nothing committed");
  g.complete("a");
  assert.throws(() => g.set("a", (v) => v + 1), /has ended/);
});

test("set with a function that returns the value it was given writes nothing, also in a batch; a plain equal value is written", () => {
  const g = createGraph();
  g.state("a", 1);
  g.state("b", 1);
  g.subscribe("s", "a");
  g.subscribe("t", "b");
  assert.deepEqual(during(g, () => g.set("a", (v) => v)), [], "no wave");
  assert.deepEqual(during(g, () => g.batch(() => { g.set("a", (v) => v); g.set("b", 2); })), ["t <- b: [PENDING, DATA(2)]"]);
  assert.deepEqual(during(g, () => g.batch(() => { g.set("a", 5); g.set("a", (v) => v); })), ["s <- a: [PENDING, DATA(5)]"]);
  assert.deepEqual(during(g, () => g.set("a", 5)), ["s <- a: [PENDING, DATA(5)]"], "a plain value is always written");
  const f = () => 1;
  g.set("a", () => f);
  assert.equal(g.get("a").value, f, "a function is written as a value by wrapping it");
});

test("definition(id) reads a node's dependencies and its current instance's function, setup and recipe", () => {
  const g = createGraph();
  g.state("a", 1);
  const f = (ctx) => ctx.down([["DATA", 1]]);
  const h = (ctx) => ctx.down([["DATA", 2]]);
  g.node("p", ["a"], f);
  assert.deepEqual(g.definition("a"), { deps: [], fn: null, setup: null, recipe: null,
    opts: { terminal: { complete: "auto", error: "auto" }, invalidate: "auto", quiet: false } });
  assert.equal(g.definition("p").fn, f);
  const setup = () => {};
  g.replace("p", ["a"], h, { setup, recipe: { ref: "h" } });
  const { opts, ...def } = g.definition("p");
  assert.deepEqual(def, { deps: ["a"], fn: h, setup, recipe: { ref: "h" } });
  const d = g.definition("p");
  d.deps.push("x");
  assert.deepEqual(g.definition("p").deps, ["a"], "a copy: reading changes nothing");
});

// Found while moving the rewire tests onto ctx (2026-11-10): a node's dependencies go back to its
// declared ones when its lifetime closes, so the cycle check looks at declared ones as well.
test("rewire: refused onto a node that declares this one, even while that node is rewired away from it", () => {
  const g = createGraph();
  g.state("a", 1);
  let cx, cy;
  g.node("x", ["a"], (ctx) => { cx = ctx; ctx.down([["DATA", 1]]); });
  g.node("y", ["x"], (ctx) => { cy = ctx; ctx.down([["DATA", 1]]); });
  g.subscribe("s", "y");
  g.subscribe("t", "x");
  cy.rewire(["a"]); // y is off x for this lifetime only
  assert.throws(() => cx.rewire(["a", "y"]), /x would depend on itself through y/,
    "once y's lifetime closed, y would be back on x and x on y");
});

// H4 (2026-11-10): the seed's note follows the seeded instance, not the node.
test("a seed's note reaches the seeded instance's first run only; a replace's new instance never sees it", () => {
  const g = createGraph();
  g.state("a", 1);
  const seen = [];
  const fn = (ctx) => { seen.push(ctx.seed); ctx.down([["DATA", ctx.deps[0].value]]); };
  g.node("x", ["a"], fn, { seed: { values: [1], note: { restored: true } } });
  g.subscribe("s", "x");
  g.set("a", 2);
  g.replace("x", ["a"], fn);
  assert.deepEqual(seen, [{ restored: true }, undefined, undefined]);
});

test("K7: a node that ends drops its private state with its lifetime", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("x", ["a"], (ctx) => { ctx.state.set({ seen: ctx.deps[0].value }); ctx.down([["DATA", 1]]); });
  g.subscribe("s", "x");
  assert.deepEqual(g.privateState("x"), { seen: 1 });
  g.complete("a");
  assert.equal(g.get("x").ended[0], "COMPLETE");
  assert.equal(g.privateState("x"), undefined, "it will never run again, so nothing reads it");
});

// C-47 (R-graph-domain@3, the user's choice 2026-11-11): two graphs on one thread share no wave,
// request queue or batch.
test("C-47: graphs on one thread: one graph's wave or batch never holds another's requests", () => {
  const g1 = createGraph();
  const g2 = createGraph();
  g1.state("a", 0);
  g1.state("c", 0);
  g2.state("b", 0);
  const log = [];
  g1.subscribe("s1", "a", (msgs) => {
    if (!msgs.some((m) => m[0] === "DATA" && m[1] === 1)) return;
    log.push("s1 writes b");
    g2.set("b", 1);
    log.push(`after b's write: g1 idle ${g1.idle()}, g2 idle ${g2.idle()}`);
  });
  g2.subscribe("s2", "b", (msgs) => {
    if (!msgs.some((m) => m[0] === "DATA" && m[1] === 1)) return;
    log.push(`s2 sees b=1, a's wave ended: ${g1.idle()}`);
    g1.set("c", 1);
    log.push(`c after its write: ${g1.get("c").value}`);
  });
  g1.subscribe("sc", "c", (msgs) => { if (msgs.some((m) => m[0] === "DATA" && m[1] === 1)) log.push("c's wave"); });
  g1.set("a", 1);
  assert.deepEqual(log, [
    "s1 writes b",
    "s2 sees b=1, a's wave ended: false",
    "c after its write: 0",
    "after b's write: g1 idle false, g2 idle true",
    "c's wave",
  ]);

  let read;
  g1.batch(() => {
    g1.set("a", 2);
    g2.set("b", 2);
    read = g2.get("b").value;
    assert.equal(g1.get("a").value, 1, "a commits only when the body returns");
  });
  assert.equal(read, 2, "the write to g2 is g2's own request and ran at once");
  assert.equal(g1.get("a").value, 2);
});

// F 2.9 of the D797 migration review (2026-11-11): the cycle check runs again when a queued
// replace or rewire runs, so two requests that are each acyclic alone cannot form a cycle.
test("two replaces in one batch that would form a cycle: the second is refused when it runs", () => {
  const reports = [];
  const g = createGraph({ report: (e) => reports.push(e) });
  g.state("S", 1);
  g.node("A", ["S"], () => {});
  g.node("B", ["S"], () => {});
  g.batch(() => { g.replace("A", ["B"], () => {}); g.replace("B", ["A"], () => {}); });
  assert.deepEqual(g.definition("A").deps, ["B"]);
  assert.deepEqual(g.definition("B").deps, ["S"], "B keeps its dependencies");
  assert.deepEqual(reports.map((r) => r.source), ["queued request"]);
  assert.match(reports[0].error, /would depend on itself/);
});

test("two rewires asked for in one wave that would form a cycle: the second is refused when it runs", () => {
  const reports = [];
  const g = createGraph({ report: (e) => reports.push(e) });
  g.state("S", 1);
  const ctxs = {};
  g.node("A", ["S"], (ctx) => { ctxs.A = ctx; });
  g.node("B", ["S"], (ctx) => { ctxs.B = ctx; });
  g.subscribe("sa", "A");
  g.subscribe("sb", "B");
  g.subscribe("ss", "S", () => {
    if (!ctxs.asked) { ctxs.asked = true; ctxs.A.rewire(["S", "B"]); ctxs.B.rewire(["S", "A"]); }
  });
  g.set("S", 2);
  assert.deepEqual(g.describe().find((n) => n.id === "A").deps, ["S", "B"]);
  assert.deepEqual(g.describe().find((n) => n.id === "B").deps, ["S"]);
  assert.deepEqual(reports.map((r) => r.source), ["queued request"]);
});

// F 2.10 of the D797 migration review (2026-11-11): a quiet node forwarding an auto INVALIDATE
// marks its cone pending, so a diamond below it settles once.
test("a quiet node's forwarded INVALIDATE settles a diamond below it once", () => {
  for (const invalidate of ["auto", "manual"]) {
    const g = createGraph();
    g.state("A", 1);
    g.node("Q", ["A"], (ctx) => { if (ctx.deps[0].waves.length) ctx.down([["DATA", ctx.deps[0].value]]); }, { quiet: true });
    g.node("B", ["Q"], derived((q) => q));
    g.node("C", ["Q"], derived((q) => q));
    const runs = [];
    g.node("D", ["B", "C"], (ctx) => { runs.push(ctx.deps.map((d) => d.invalidated)); }, { invalidate });
    g.subscribe("s", "D");
    runs.length = 0;
    const out = during(g, () => g.invalidate("A")).filter((e) => e.startsWith("s <-"));
    assert.equal(out.length, 1, `${invalidate}: D settles once`);
    if (invalidate === "manual") assert.deepEqual(runs, [[true, true]], "one run, both legs invalidated");
  }
});

// C F9 of the D797 migration review (2026-11-11), Q12: under auto COMPLETE the node completes
// after the run that sees the last terminal (R-terminals, C-17), also when that terminal is the
// run's only input.
test("auto COMPLETE: the last terminal alone runs the function once, then the node completes", () => {
  const g = createGraph();
  g.state("s", 1);
  const seen = [];
  g.node("n", ["s"], (ctx) => { seen.push(ctx.deps[0].terminal?.[0] ?? null); });
  g.subscribe("k", "n");
  g.complete("s");
  assert.deepEqual(seen, [null, "COMPLETE"], "the activation run, then one run on the COMPLETE");
  assert.deepEqual(g.get("n").ended, ["COMPLETE"]);
  g.state("t", 1);
  g.state("u", 1);
  const twoSeen = [];
  g.node("m", ["t", "u"], (ctx) => { twoSeen.push(ctx.deps.map((d) => d.terminal?.[0] ?? null)); });
  g.subscribe("k2", "m");
  g.complete("t");
  assert.equal(twoSeen.length, 1, "an earlier terminal alone, under auto COMPLETE, does not run it");
  g.complete("u");
  assert.deepEqual(twoSeen.at(-1), [null, "COMPLETE"], "the run that sees the last terminal (t's was an earlier invocation's)");
  assert.deepEqual(g.get("m").ended, ["COMPLETE"]);
});

test("D808: saved ctx and DepViews expire per invocation, including during a later run", () => {
  const g = createGraph();
  g.state("s", 1);
  let first, view, values;
  const message = "ctx.deps is only available during setup or function invocation";
  g.node("n", ["s"], (ctx) => {
    if (!first) { first = ctx; view = ctx.deps[0]; values = view.waves; }
    else {
      assert.throws(() => first.deps, { message });
      assert.throws(() => view.value, { message });
    }
    assert.equal(ctx.deps[0].id, "s");
    ctx.down([["DATA", ctx.deps[0].value]]);
  }, { setup: (ctx) => { assert.equal(ctx.deps[0].value, 1); } });
  g.subscribe("sink", "n");
  assert.throws(() => first.deps, { message });
  for (const key of ["id", "waves", "terminal", "invalidated", "has", "value"]) {
    assert.throws(() => view[key], { message });
  }
  assert.deepEqual(values, [[1]], "copied ordinary data stays readable");
  g.set("s", 2);
  assert.equal(g.get("n").value, 2, "the new invocation has its own live read capability");
});

test("D808: quiet final output and auto COMPLETE are separate arrays in one later wave", () => {
  const g = createGraph();
  g.state("s", 0);
  g.node("q", ["s"], (ctx) => { if (ctx.deps[0].terminal) ctx.down([["DATA", 99]]); }, { quiet: true });
  const seen = [];
  const arrays = [];
  g.node("d", ["q"], (ctx) => seen.push({ waves: ctx.deps[0].waves, terminal: ctx.deps[0].terminal }), { terminal: { complete: "manual" } });
  g.subscribe("sink", "d");
  g.subscribe("arrays", "q", (msgs) => arrays.push(msgs));
  seen.length = 0; arrays.length = 0;
  g.complete("s");
  assert.deepEqual(seen, [{ waves: [[99]], terminal: ["COMPLETE"] }]);
  assert.deepEqual(arrays, [[["PENDING"], ["DATA", 99]], [["PENDING"], ["COMPLETE"]]]);
});

test("D808: late output survives updater failure, but not a throwing batch body", () => {
  const g = createGraph();
  g.state("s", 0);
  let ctx;
  g.node("n", [], (c) => { ctx = c; });
  const values = [];
  g.subscribe("sink", "n", (msgs) => values.push(...msgs.filter((m) => m[0] === "DATA").map((m) => m[1])));
  assert.throws(() => g.batch(() => {
    g.set("s", () => { throw new Error("updater failed"); });
    ctx.down([["DATA", 42]]);
  }), /updater failed/);
  assert.deepEqual(values, [42]);
  assert.throws(() => g.batch(() => { ctx.down([["DATA", 43]]); throw new Error("body failed"); }), /body failed/);
  assert.deepEqual(values, [42]);
});

test("D808: queued batch validates all ended targets before any updater or write", () => {
  const reports = [];
  const g = createGraph({ report: (r) => reports.push(r) });
  g.state("trigger", 0); g.state("a", 0); g.state("b", 0);
  let calls = 0;
  g.subscribe("requester", "trigger", (msgs) => {
    if (!msgs.some((m) => m[0] === "DATA" && m[1] === 1)) return;
    g.complete("a");
    g.batch(() => {
      g.set("b", () => { calls++; return 1; });
      g.set("a", () => { calls++; return 1; });
    });
  });
  g.set("trigger", 1);
  assert.equal(calls, 0);
  assert.equal(g.get("b").value, 0);
  assert.equal(reports.length, 1);
  assert.match(reports[0].error, /a has ended/);
});

test("R-lifetime: an old private-state handle cannot read or overwrite a new lifetime", () => {
  const g = createGraph();
  const contexts = [], cleaned = [];
  g.node("n", [], (ctx) => { contexts.push(ctx); ctx.state.set({ value: contexts.length }); }, {
    setup: (ctx) => () => cleaned.push(ctx.state.get().value),
  });
  g.subscribe("hold", "n");
  g.unsubscribe("hold", "n");
  assert.deepEqual(cleaned, [1], "cleanup can read the retiring state");
  g.subscribe("hold", "n");
  assert.equal(contexts[0].state.get(), undefined);
  contexts[0].state.set({ value: 99 });
  assert.deepEqual(contexts[1].state.get(), { value: 2 });
});
