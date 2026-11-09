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
    "s <- a: [DIRTY, DATA(2)]",
    "s <- a: [DIRTY, DATA(2)]",
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
  assert.deepEqual(during(g, () => g.set("a", 2)), ["s <- d: [DIRTY, DATA(7)]"]);
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
    "sf <- f: [DIRTY, RESOLVED]",
    "sd <- d: [DIRTY, DATA(\"3/2\")]",
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
  assert.deepEqual(during(g, () => g.set("a", 3)), ["s <- d: [DIRTY, RESOLVED]"]);
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
    "t <- tens: [DIRTY, DATA(20), DATA(30)]",
    "s <- sum: [DIRTY, DATA(8)]",
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

test("K5 auto: COMPLETE once every dependency has completed, without a balancing RESOLVED", () => {
  const g = createGraph();
  g.state("a", 1);
  g.state("b", 2);
  g.node("d", ["a", "b"], derived((a, b) => a + b));
  g.subscribe("s", "d");
  assert.deepEqual(during(g, () => g.complete("a")), []);
  assert.deepEqual(during(g, () => g.complete("b")), ["s <- d: [COMPLETE]"]);
});

test("K5 manual: the function receives COMPLETE as input and ends the node itself", () => {
  const g = createGraph();
  g.state("a", 0);
  g.node("r", ["a"], reduce((acc, v) => acc + v, 0), { terminal: { complete: "manual" } });
  g.subscribe("s", "r");
  g.set("a", 1);
  g.set("a", 5);
  assert.deepEqual(during(g, () => g.complete("a")), ["s <- r: [DIRTY, DATA(6), COMPLETE]"]);
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
    "sd <- d: [DIRTY, DATA(13)]",
    "st <- t: [ERROR(\"bad\")]",
  ]);
  assert.deepEqual(during(g, () => g.error("a", "boom")), ["sd <- d: [ERROR(\"boom\")]"]);
});

test("K2: DATA and RESOLVED in one output array is rejected as a computation failure", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("x", ["a"], (ctx) => { if (ctx.deps[0].value === 2) ctx.down([["DATA", 1], ["RESOLVED"]]); });
  g.subscribe("s", "x");
  assert.deepEqual(during(g, () => g.set("a", 2)), ["s <- x: [ERROR(\"DATA and RESOLVED in one array\")]"]);
});

test("O11: DIRTY in node output is rejected: during the run it becomes ERROR, after the run the caller gets it", () => {
  const g = createGraph();
  g.state("a", 1);
  let kept;
  g.node("x", ["a"], (ctx) => {
    kept = ctx;
    if (ctx.deps[0].value === 2) ctx.down([["DIRTY"]]);
  });
  g.subscribe("s", "x");
  assert.throws(() => kept.down([["DIRTY"], ["DATA", 5]]), /DIRTY is sent by the kernel/);
  assert.deepEqual(during(g, () => g.set("a", 2)), ["s <- x: [ERROR(\"x: DIRTY is sent by the kernel, not by node output\")]"]);
});

test("K7: a computed node clears on last release; plain state keeps its value", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("d", ["a"], map((v) => v * 2));
  g.subscribe("s", "d");
  g.unsubscribe("s", "d");
  assert.deepEqual(g.get("d"), { active: false, has: false, value: undefined, ended: null });
  g.set("a", 4);
  assert.equal(g.get("a").value, 4);
  assert.deepEqual(during(g, () => g.subscribe("s", "d")), ["s <- d: [START, DATA(8)]"]);
});

test("P5: an ended output cannot be acquired again (restart belongs to a module, O7)", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("d", ["a"], map((v) => v));
  g.subscribe("s", "a");
  g.complete("a");
  assert.throws(() => g.subscribe("s2", "a"), KernelError);
  assert.throws(() => g.subscribe("s3", "d"), KernelError);
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
    "sf <- f: [DIRTY, DATA(\"2/0\")]",
    "sd <- d: [DIRTY, RESOLVED]",   // wave 1 finishes before the write runs
    "sf <- f: [DIRTY, DATA(\"2/2\")]",
  ]);
  const h = sideWriteGraph(true); // d now runs before b; f still sees the same two waves
  const fOnly = during(h, () => h.set("a", 2)).filter((line) => line.startsWith("sf"));
  assert.deepEqual(fOnly, ["sf <- f: [DIRTY, DATA(\"2/0\")]", "sf <- f: [DIRTY, DATA(\"2/2\")]"]);
});

test("K8: a function writing its own upstream is rejected, and the throw becomes its ERROR", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("x", ["a"], (ctx) => {
    if (ctx.deps[0].value === 2) g.set("a", 0);
  });
  g.subscribe("s", "x");
  assert.deepEqual(during(g, () => g.set("a", 2)), ["s <- x: [ERROR(\"x wrote its upstream a\")]"]);
  assert.equal(g.get("a").value, 2);
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
  assert.deepEqual(during(g, () => g.set("a", 2)), ["sw <- w: [DIRTY, RESOLVED]", "s <- pq: [DIRTY, DATA(4)]"]);
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
    "s1 <- a: [DIRTY, DATA(2)]",
    "s2 <- a: [DIRTY, DATA(2)]",
    "sb <- b: [DIRTY, DATA(20)]",
  ]);
});

test("K8/K3: unsubscribing during a wave takes effect after it", () => {
  const g = createGraph();
  g.state("a", 1);
  g.subscribe("s1", "a", (msgs) => { if (msgs[0][0] === "DIRTY") g.unsubscribe("s2", "a"); });
  g.subscribe("s2", "a");
  assert.deepEqual(during(g, () => { g.set("a", 2); g.set("a", 3); }), [
    "s1 <- a: [DIRTY, DATA(2)]",
    "s2 <- a: [DIRTY, DATA(2)]",
    "s1 <- a: [DIRTY, DATA(3)]",
  ]);
});

test("P10: a failing sink goes to the host reporter; the other sinks still receive the wave", () => {
  const reports = [];
  const g = createGraph({ report: (r) => reports.push(r) });
  g.state("a", 1);
  g.subscribe("s1", "a", (msgs) => { if (msgs[0][0] === "DIRTY") throw new Error("ui broke"); });
  g.subscribe("s2", "a");
  assert.deepEqual(during(g, () => g.set("a", 2)), ["s1 <- a: [DIRTY, DATA(2)]", "s2 <- a: [DIRTY, DATA(2)]"]);
  assert.deepEqual(reports, [{ source: "sink s1", error: "ui broke" }]);
});

test("P10: without a host reporter nothing is kept, and a throwing reporter cannot break the wave", () => {
  for (const options of [{}, { report: () => { throw new Error("reporter down"); } }]) {
    const g = createGraph(options);
    g.state("a", 1);
    g.subscribe("s1", "a", (msgs) => { if (msgs[0][0] === "DIRTY") throw new Error("ui broke"); });
    g.subscribe("s2", "a");
    assert.deepEqual(during(g, () => g.set("a", 2)), ["s1 <- a: [DIRTY, DATA(2)]", "s2 <- a: [DIRTY, DATA(2)]"]);
    assert.equal("reports" in g, false, "the graph exposes no failure history");
  }
});

test("K8: a read during a wave returns the retained value; reading never computes", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("b", ["a"], map((v) => v + 1));
  g.node("c", ["a"], map((v) => v + 2));
  let seen;
  g.subscribe("sb", "b", (msgs) => { if (msgs[0][0] === "DIRTY") seen = g.get("c"); });
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
  assert.deepEqual(out, ["s <- d: [DIRTY, DATA(10)]"]);
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
  assert.deepEqual(g.trace.slice(start).map(format), ["s <- ab: [DIRTY, DATA(\"1/0\")]", "s <- ab: [DIRTY, DATA(\"1/2\")]"]);
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
    // No DIRTY stays open while the work runs: each wave settles with RESOLVED.
    "sq <- q: [DIRTY, RESOLVED]", "sd <- d: [DIRTY, RESOLVED]",
    "sq <- q: [DIRTY, RESOLVED]", "sd <- d: [DIRTY, RESOLVED]",
    "sq <- q: [DIRTY, DATA(\"r3\")]", "sd <- d: [DIRTY, DATA(\"r3@3\")]",
    // Arrival order, combined with a's current value: the kernel pairs nothing.
    "sq <- q: [DIRTY, DATA(\"r2\")]", "sd <- d: [DIRTY, DATA(\"r2@3\")]",
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
  assert.deepEqual(during(g, () => g.set("a", 2)), ["s <- q: [DIRTY, RESOLVED]"]);
  await tick();
  assert.deepEqual(calls.map((c) => [c.v, c.signal.aborted]), [[1, true], [2, false]]);
  const start = g.trace.length;
  calls[1].resolve("r2");
  calls[0].resolve("r1");
  await tick();
  assert.deepEqual(g.trace.slice(start).map(format), ["s <- q: [DIRTY, DATA(\"r2\")]"]);
  g.set("a", 3);
  await tick();
  g.unsubscribe("s", "q");
  assert.equal(calls[2].signal.aborted, true, "closing the lifetime aborts the request in flight");
});

test("K7: output through a closed lifetime's ctx is dropped; the signal and late cleanup follow the old lifetime", () => {
  const g = createGraph();
  g.state("a", 1);
  const ctxs = [];
  g.node("q", ["a"], (ctx) => { ctxs.push(ctx); });
  g.subscribe("s", "q");
  let joined = 0;
  ctxs[0].onDeactivation(() => { joined += 1; }); // live lifetime, invocation returned: accepted, as in TS
  g.unsubscribe("s", "q");
  assert.equal(joined, 1, "it joined the current run's cleanups and ran at close");
  assert.equal(ctxs[0].signal.aborted, true, "first access after close is already aborted");
  let late = 0;
  ctxs[0].onDeactivation(() => { late += 1; });
  assert.equal(late, 1, "a registration after close runs once, now");

  g.subscribe("s2", "q"); // a new lifetime
  const out = during(g, () => {
    ctxs[0].down([["DATA", "old"]]);
    ctxs[1].down([["DATA", "new"]]);
  });
  assert.deepEqual(out, ["s2 <- q: [DIRTY, DATA(\"new\")]"]);
  assert.equal(ctxs[1].signal.aborted, false);
});

test("K7: each run replaces the previous run's cleanup; close releases dependencies first, then runs hooks in order", () => {
  const reports = [];
  const g = createGraph({ report: (r) => reports.push(r) });
  const log = [];
  g.state("a", 1);
  g.node("p", ["a"], (ctx) => {
    ctx.onDeactivation(() => log.push("close p"));
    ctx.down(ctx.deps[0].waves.flat().map((v) => ["DATA", v]));
  });
  g.node("q", ["p"], (ctx) => {
    const v = ctx.deps[0].value;
    ctx.onDeactivation(() => log.push(`close q${v} first`));
    ctx.onDeactivation(() => { log.push(`close q${v} second`); throw new Error("leak"); });
    ctx.onDeactivation(() => log.push(`close q${v} third`));
    ctx.down([["DATA", v]]);
  });
  g.subscribe("s", "q");
  g.set("a", 2);
  assert.deepEqual(log, [], "replaced registrations are dropped without running");
  g.unsubscribe("s", "q");
  assert.deepEqual(log, ["close p", "close q2 first", "close q2 second", "close q2 third"]);
  assert.deepEqual(reports, [{ source: "cleanup q", error: "leak" }]);
});

test("K5/K7: a node that ends closes its lifetime at once, while still subscribed", () => {
  const g = createGraph();
  g.state("a", 1);
  let ctx = null;
  let closed = 0;
  g.node("q", ["a"], (c) => { ctx = c; c.onDeactivation(() => { closed += 1; }); });
  g.subscribe("s", "q");
  assert.deepEqual(during(g, () => g.complete("a")), ["s <- q: [COMPLETE]"]);
  assert.equal(closed, 1, "its cleanups ran");
  assert.equal(ctx.signal.aborted, true, "its signal is aborted");
  assert.equal(g.get("a").active, false, "its dependency was released");
});

test("K6: INVALIDATE clears values down the cone once, without DIRTY and without running functions", () => {
  const g = createGraph();
  const log = [];
  g.state("a", 1);
  g.node("b", ["a"], (ctx) => {
    ctx.onInvalidate(() => log.push(`b invalidated, has=${g.get("b").has}`));
    ctx.down(ctx.deps[0].waves.flat().map((v) => ["DATA", v * 10]));
  });
  g.node("c", ["a"], map((v) => v + 1));
  const d = counted(derived((b, c) => b + c));
  g.node("d", ["b", "c"], d);
  g.subscribe("sd", "d");
  g.subscribe("sb", "b");
  // d hears it from b and from c; the second arrives after d's value is gone, so it is
  // a no-op. That is what keeps the diamond glitch-free here.
  assert.deepEqual(during(g, () => g.invalidate("a")), ["sd <- d: [INVALIDATE]", "sb <- b: [INVALIDATE]"]);
  assert.deepEqual(log, ["b invalidated, has=false"]);
  assert.deepEqual(during(g, () => g.invalidate("a")), [], "repeat is ineffective");
  assert.deepEqual(during(g, () => g.set("a", 2)), ["sb <- b: [DIRTY, DATA(20)]", "sd <- d: [DIRTY, DATA(23)]"]);
  assert.equal(d.calls, 2, "activation plus the recompute; invalidation ran nothing");
});

test("K6/P4: a pending node whose invalidation is a no-op still settles with RESOLVED", () => {
  const g = createGraph();
  g.state("a", 1);
  g.state("x");
  g.node("d", ["a", "x"], derived((a, x) => a + x)); // no value yet: x is empty
  g.subscribe("s", "d");
  assert.deepEqual(during(g, () => g.batch(() => { g.invalidate("a"); g.set("x", 5); })), ["s <- d: [DIRTY, RESOLVED]"]);
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
    "sf <- f: [DIRTY, DATA(\"10/2\")]",  // f settles from a alone
    "sf <- f: [DIRTY, DATA(\"20/2\")]",  // q's result arrives as its own wave
    "sq <- q: [DIRTY, DATA(20)]",
  ]);
});

test("H6: a quiet node passes an INVALIDATE on at once (it carries no DIRTY); an inherited ERROR is a later wave", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("q", ["a"], map((v) => v * 10), { quiet: true });
  g.node("f", ["q", "a"], derived((q, a) => `${q}/${a}`));
  g.subscribe("sq", "q"); // q's own sink comes first in q's delivery order
  g.subscribe("sf", "f");
  assert.deepEqual(during(g, () => g.invalidate("a")), ["sq <- q: [INVALIDATE]", "sf <- f: [INVALIDATE]"]);
  g.set("a", 2);
  assert.deepEqual(during(g, () => g.error("a", "down")), ["sf <- f: [ERROR(\"down\")]", "sq <- q: [ERROR(\"down\")]"]);
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
    "sx <- x: [DIRTY, DATA(10)]",
    "sx <- x: [DIRTY, DATA(11), DATA(12)]",
    "sy <- y: [DIRTY, RESOLVED]",
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
    "s <- src: [INVALIDATE]",
    "s <- src: [DIRTY, DATA(2), DATA(3)]",
    "sy <- y: [INVALIDATE]",
    "sy <- y: [DIRTY, DATA(3)]",
  ]);
  assert.deepEqual(seen, [[[2, 3]]], "the function sees only what came after the INVALIDATE");
  assert.equal(g.get("src").value, 3);
});

test("O13: a terminal must be last in its array; DATA and RESOLVED still cannot share one", () => {
  const g = createGraph();
  const src = {};
  g.node("src", [], (ctx) => { src.ctx = ctx; });
  g.subscribe("s", "src");
  assert.throws(() => src.ctx.down([["COMPLETE"], ["DATA", 1]]), KernelError);
  assert.throws(() => src.ctx.down([["DATA", 1], ["RESOLVED"]]), KernelError);
  assert.deepEqual(during(g, () => src.ctx.down([["DATA", 1], ["INVALIDATE"], ["RESOLVED"]])), ["s <- src: [DIRTY, RESOLVED]"],
    "the INVALIDATE finds no value and is dropped; the RESOLVED after it is its own array");
});

test("O13: in one wave an input that is invalidated and then gets a value runs the previous run's invalidate hooks, then the function", () => {
  const g = createGraph();
  const src = {};
  g.node("src", [], (ctx) => { src.ctx = ctx; ctx.down([["DATA", 1]]); });
  const log = [];
  g.node("y", ["src"], (ctx) => {
    const v = ctx.deps[0].value;
    log.push(`run ${v}`);
    ctx.onInvalidate(() => log.push(`invalidated, registered by run ${v}`));
    ctx.down([["DATA", v]]);
  });
  g.subscribe("sy", "y");
  log.length = 0;
  src.ctx.down([["INVALIDATE"], ["DATA", 2]]);
  assert.deepEqual(log, ["invalidated, registered by run 1", "run 2"]);
});

test("O13: a batch is one accumulated array per node, split at its INVALIDATE at commit", () => {
  const g = createGraph();
  g.state("a", 0);
  g.subscribe("s", "a");
  assert.deepEqual(during(g, () => g.batch(() => { g.set("a", 1); g.invalidate("a"); g.set("a", 2); })), [
    "s <- a: [INVALIDATE]",
    "s <- a: [DIRTY, DATA(2)]",
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
    "sx <- x: [DIRTY, DATA(1)]",
    "sx <- x: [INVALIDATE]",
    "sy <- y: [INVALIDATE]",
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
    "s <- d: [INVALIDATE]",
    's <- d: [DIRTY, DATA("d")]',
  ]);
  assert.deepEqual(seen, [[[false, []], [true, [[2]]]]], "a is absent; b delivered one array");
});

test("K6: onInvalidate hooks stay registered; a later effective INVALIDATE without a rerun runs them again (as TS)", () => {
  const g = createGraph();
  let x;
  let runs = 0;
  let hooks = 0;
  g.node("x", [], (ctx) => { x = ctx; runs++; ctx.onInvalidate(() => { hooks++; }); });
  g.subscribe("s", "x");
  x.down([["DATA", 1]]);
  x.down([["INVALIDATE"]]);
  x.down([["DATA", 2]]);
  x.down([["INVALIDATE"]]);
  x.down([["INVALIDATE"]]); // ineffective: no value
  assert.deepEqual([runs, hooks], [1, 2]);
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
    "sq <- q: [DIRTY, DATA(5)]",
    "sq <- q: [DIRTY, DATA(6)]",
    "sy <- y: [DIRTY, RESOLVED]",
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
  g.subscribe("s", "a", (msgs) => { if (msgs[0][0] === "DIRTY") seen.push(["a", "b", "c"].map((id) => g.status(id).cache)); });
  g.subscribe("sc", "c", (msgs) => { if (msgs[0][0] === "DIRTY") seen.push(["a", "b", "c"].map((id) => g.status(id).cache)); });
  g.set("a", 5);
  assert.deepEqual(seen, [["ready", "stale", "stale"], ["ready", "ready", "ready"]]);
  assert.deepEqual(["a", "b", "c"].map((id) => g.status(id).cache), ["ready", "ready", "ready"], "after the wave, never stale");
});

test("K10: lifecycle is closing while a lifetime's cleanups run, then inactive", () => {
  const g = createGraph();
  g.state("a", 1);
  let during = null;
  g.node("q", ["a"], (ctx) => { ctx.onDeactivation(() => { during = g.status("q").lifecycle; }); });
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
  g.subscribe("sa", "a", (msgs) => { if (msgs[0][0] === "DIRTY") seen.push(g.status("q").cache); });
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
  g.subscribe("sb", "b", (msgs) => { if (msgs[0][0] === "DIRTY") seen.push(g.status("q").cache); });
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
  assert.deepEqual(during(g, () => g.complete("b")), ["sx <- x: [COMPLETE]", "sb <- b: [COMPLETE]", "sm <- m: [COMPLETE]"],
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
    "s <- d: [DIRTY, DATA([20])]",
  ]);
  assert.deepEqual(g.get("x"), { active: true, has: true, value: 20, ended: null });
  assert.deepEqual(during(g, () => g.set("a", 5)), ["s <- d: [DIRTY, DATA([50])]", "t <- x: [DIRTY, DATA(50)]"],
    "the subscriber order is kept: d subscribed to x before t did");
});

test("replace: the old lifetime closes (signal, cleanups) and its late output is dropped", () => {
  const g = createGraph();
  g.state("a", 1);
  const log = [];
  let late;
  g.node("x", ["a"], (ctx) => {
    late = ctx;
    ctx.signal.addEventListener("abort", () => log.push("abort"));
    ctx.onDeactivation(() => log.push("cleanup"));
  });
  g.subscribe("s", "x");
  g.replace("x", ["a"], () => {});
  assert.deepEqual(log, ["abort", "cleanup"]);
  assert.deepEqual(during(g, () => late.down([["DATA", "old"]])), []);
});

test("replace: new dependencies are acquired before the old ones are released, so a shared one stays active", () => {
  const g = createGraph();
  g.state("a", 1);
  g.state("b", 2);
  const log = [];
  g.node("up", ["a"], (ctx) => {
    ctx.onDeactivation(() => log.push("up closed"));
    ctx.down([["DATA", ctx.deps[0].value]]);
  });
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
    "s <- x: [DIRTY, DATA(2)]",
    "t <- x: [DIRTY, DATA(2)]",
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
  assert.deepEqual(during(g, () => g.replace("x", ["a"], (ctx) => ctx.down([["DATA", 10]]))), ["s <- j: [DIRTY, DATA([11,12])]"]);
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
  g.node("up", ["a"], (ctx) => { ctx.onDeactivation(() => log.push("up closed")); ctx.down([["DATA", 1]]); });
  g.node("x", ["up"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  g.subscribe("s", "x");
  assert.deepEqual(during(g, () => g.replace("x", ["up"], (ctx) => ctx.down([["COMPLETE"]]))), ["s <- x: [START, COMPLETE]"]);
  assert.deepEqual(log, ["up closed"]);
});

test("replace: an ended node that lost its subscribers can be subscribed again after a replace", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("x", ["a"], (ctx) => ctx.down([["COMPLETE"]]));
  g.subscribe("s", "x");
  g.unsubscribe("s", "x");
  assert.throws(() => g.subscribe("t", "x"), /has ended/);
  g.replace("x", ["a"], (ctx) => ctx.down([["DATA", 2]]));
  assert.deepEqual(during(g, () => g.subscribe("t", "x")), ["t <- x: [START, DATA(2)]"]);
});

test("replace: an active node cannot acquire an ended dependency (P5), as a subscription cannot", () => {
  const g = createGraph();
  g.state("a", 1);
  g.state("done", 0);
  g.complete("done");
  g.node("x", ["a"], () => {});
  g.subscribe("s", "x");
  assert.throws(() => g.replace("x", ["done"], () => {}), /done has ended/);
  assert.deepEqual(g.describe().find((d) => d.id === "x").deps, ["a"], "nothing changed");
});

// ---- rewire (surgical, C-8) -------------------------------------------------

// Sums the current value of every dependency, by id, so a reorder cannot fool it.
const sumById = (ctx) => ctx.down([["DATA", ctx.deps.map((d) => `${d.id}=${d.value}`).join(",")]]);

test("rewire: the instance stays: value, private state, lifetime and sinks; no START", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b");
  const log = [];
  const fn = (ctx) => {
    ctx.state.set((ctx.state.get() ?? 0) + 1);
    ctx.signal.addEventListener("abort", () => log.push("abort"));
    ctx.down([["DATA", ctx.state.get()]]);
  };
  g.node("x", ["a"], fn);
  g.subscribe("s", "x");
  assert.deepEqual(during(g, () => g.rewire("x", ["a", "b"], fn)), [], "b has no value: nothing runs, nothing is sent");
  assert.deepEqual(g.get("x"), { active: true, has: true, value: 1, ended: null });
  assert.deepEqual(during(g, () => g.set("b", 0)), ["s <- x: [DIRTY, DATA(2)]"], "private state kept: the count goes on");
  assert.deepEqual(log, [], "the lifetime did not close");
});

test("rewire: an added dependency's value is one ordinary input wave; the new fn runs once", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  g.node("x", ["a"], sumById);
  g.subscribe("s", "x");
  const fn = counted(sumById);
  assert.deepEqual(during(g, () => g.rewire("x", ["a", "b"], fn)), ["s <- x: [DIRTY, DATA(\"a=1,b=2\")]"]);
  assert.equal(fn.calls, 1);
  assert.deepEqual(during(g, () => g.set("b", 3)), ["s <- x: [DIRTY, DATA(\"a=1,b=3\")]"]);
});

test("rewire: several added dependencies arrive in one wave, each value its own input", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2); g.state("c", 3);
  const seen = [];
  const fn = (ctx) => { seen.push(ctx.deps.map((d) => d.waves.flat())); };
  g.node("x", ["a"], fn);
  g.subscribe("s", "x");
  g.rewire("x", ["a", "b", "c"], fn);
  assert.deepEqual(seen.at(-1), [[], [2], [3]], "a was kept, so it brings no input");
  assert.equal(seen.length, 2);
});

test("rewire: a diamond below settles once (P3)", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  g.node("x", ["a"], sumById);
  g.node("l", ["x"], (ctx) => ctx.down([["DATA", `l:${ctx.deps[0].value}`]]));
  g.node("r", ["x"], (ctx) => ctx.down([["DATA", `r:${ctx.deps[0].value}`]]));
  const join = counted((ctx) => ctx.down([["DATA", ctx.deps.map((d) => d.value).join("|")]]));
  g.node("j", ["l", "r"], join);
  g.subscribe("s", "j");
  const before = join.calls;
  g.rewire("x", ["a", "b"], sumById);
  assert.equal(join.calls, before + 1);
  assert.equal(g.get("j").value, "l:a=1,b=2|r:a=1,b=2");
});

test("rewire: a removed dependency is released without a wave and no longer drives the node", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  const fn = counted(sumById);
  g.node("x", ["a", "b"], fn);
  g.subscribe("s", "x");
  const calls = fn.calls;
  assert.deepEqual(during(g, () => g.rewire("x", ["b"], fn)), []);
  assert.equal(fn.calls, calls, "removing runs nothing");
  assert.equal(g.get("a").active, false);
  assert.equal(g.get("x").value, "a=1,b=2", "the value is kept");
  assert.deepEqual(during(g, () => g.set("a", 5)), []);
  assert.deepEqual(during(g, () => g.set("b", 6)), ["s <- x: [DIRTY, DATA(\"b=6\")]"]);
});

test("rewire: kept dependencies keep their records across a reorder", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  const fn = counted(sumById);
  g.node("x", ["a", "b"], fn);
  g.subscribe("s", "x");
  const calls = fn.calls;
  g.rewire("x", ["b", "a"], fn);
  assert.equal(fn.calls, calls);
  assert.deepEqual(during(g, () => g.set("a", 7)), ["s <- x: [DIRTY, DATA(\"b=2,a=7\")]"], "a's edge follows it to index 1");
  assert.deepEqual(g.describe().find((d) => d.id === "x").deps, ["b", "a"]);
});

test("rewire: to the current list is a no-op; to zero dependencies keeps the value and stays active", () => {
  const g = createGraph();
  g.state("a", 1);
  const fn = counted(sumById);
  g.node("x", ["a"], fn);
  g.subscribe("s", "x");
  const calls = fn.calls;
  assert.deepEqual(during(g, () => g.rewire("x", ["a"], fn)), []);
  assert.equal(fn.calls, calls);
  g.rewire("x", [], fn);
  assert.deepEqual(g.get("x"), { active: true, has: true, value: "a=1", ended: null });
  assert.equal(g.get("a").active, false);
});

test("rewire: an added dependency is acquired before a removed one is released, so a shared upstream stays active", () => {
  const g = createGraph();
  g.state("a", 1);
  const log = [];
  g.node("up", ["a"], (ctx) => { ctx.onDeactivation(() => log.push("up closed")); ctx.down([["DATA", ctx.deps[0].value]]); });
  g.node("p", ["up"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  g.node("q", ["up"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  g.node("x", ["p"], sumById);
  g.subscribe("s", "x");
  g.rewire("x", ["q"], sumById);
  assert.deepEqual(log, []);
  assert.equal(g.get("p").active, false);
  assert.equal(g.get("x").value, "q=1");
});

test("rewire: the new fn takes over the next run", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("x", ["a"], (ctx) => ctx.down([["DATA", "old"]]));
  g.subscribe("s", "x");
  g.rewire("x", ["a"], (ctx) => ctx.down([["DATA", "new"]]));
  assert.equal(g.get("x").value, "old", "a fn change alone runs nothing");
  g.set("a", 2);
  assert.equal(g.get("x").value, "new");
});

test("rewire: an added dependency that has ended is refused (P5); a kept one that ended is fine", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2); g.state("done", 3);
  g.complete("done");
  g.node("x", ["a", "b"], sumById, { terminal: { complete: "manual" } });
  g.subscribe("s", "x");
  assert.throws(() => g.rewire("x", ["a", "done"], sumById), /done has ended/);
  g.complete("b");
  g.rewire("x", ["b"], sumById);
  assert.deepEqual(g.describe().find((d) => d.id === "x").deps, ["b"]);
});

test("rewire: refused for a state node, itself, a cycle, duplicates and an ended node", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("x", ["a"], sumById);
  g.node("y", ["x"], sumById);
  assert.throws(() => g.rewire("a", [], sumById), /not a computed node/);
  assert.throws(() => g.rewire("x", ["x"], sumById), /depend on itself/);
  assert.throws(() => g.rewire("x", ["y"], sumById), /depend on itself through y/);
  assert.throws(() => g.rewire("x", ["a", "a"], sumById), /distinct/);
  g.node("e", ["a"], (ctx) => ctx.down([["COMPLETE"]]));
  g.subscribe("s", "e");
  assert.throws(() => g.rewire("e", ["a"], sumById), /e has ended/);
});

test("rewire: an inactive node only changes its definition", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  const fn = counted(sumById);
  g.node("x", ["a"], fn);
  g.rewire("x", ["b"], fn);
  assert.equal(fn.calls, 0);
  assert.equal(g.get("b").active, false);
  g.subscribe("s", "x");
  assert.equal(g.get("x").value, "b=2");
});

test("rewire: requested from inside a node function, it waits until the wave is over (K8)", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  const order = [];
  const fn = (ctx) => {
    order.push(ctx.deps.map((d) => d.id).join());
    if (ctx.deps.length === 1 && ctx.deps[0].value === 5) g.rewire("x", ["a", "b"], fn);
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
  g.node("x", ["a"], sumById);
  g.subscribe("s", "x");
  g.rewire("x", ["a", "once"], sumById);
  assert.deepEqual(g.get("x").ended, ["ERROR", "boom"]);
  assert.equal(g.get("a").active, false, "x's lifetime closed and released a");
});

test("rewire: an added dependency that only completes as it activates sends nothing below", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("empty", [], (ctx) => ctx.down([["COMPLETE"]]));
  const fn = counted(() => {}); // runs for the terminal, sends nothing
  g.node("x", ["a"], fn, { terminal: { complete: "manual" } });
  g.subscribe("s", "x");
  assert.deepEqual(during(g, () => g.rewire("x", ["a", "empty"], fn)), [], "no value, so no DIRTY and no RESOLVED");
  assert.equal(fn.calls, 2, "a manual terminal is input: x ran for it");
});

test("rewire: a node that stays silent for its added dependency's value sends nothing below", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  const fn = counted((ctx) => { if (!ctx.deps.some((d) => d.id === "b")) ctx.down([["DATA", "a only"]]); });
  g.node("x", ["a"], fn);
  g.subscribe("s", "x");
  assert.deepEqual(during(g, () => g.rewire("x", ["a", "b"], fn)), []);
  assert.equal(fn.calls, 2);
});

test("rewire: removing the last open dependency does not complete an auto node, as in TS", () => {
  // Checked against TS at dafc5ae: unsubscribeDep(b) after a completed leaves d settled; only a
  // dependency's terminal arriving triggers the auto COMPLETE (K5).
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  g.node("d", ["a", "b"], sumById);
  g.subscribe("s", "d");
  g.complete("a");
  assert.deepEqual(during(g, () => g.rewire("d", ["a"], sumById)), []);
  assert.equal(g.get("d").ended, null);
});

test("replace: a dependency in both lists keeps its connection and its place among its dependency's subscribers", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("x", ["a"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  g.node("y", ["a"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  g.subscribe("sx", "x");
  g.subscribe("sy", "y");
  g.replace("x", ["a"], (ctx) => ctx.down([["DATA", ctx.deps[0].value * 10]]));
  assert.deepEqual(during(g, () => g.set("a", 2)), ["sx <- x: [DIRTY, DATA(20)]", "sy <- y: [DIRTY, DATA(2)]"],
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
