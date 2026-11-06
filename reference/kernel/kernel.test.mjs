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
  g.node("d", ["b", "c"], derived((b, c) => b + c));
  assert.deepEqual(during(g, () => g.subscribe("s", "d")), ["s <- d: [START, DATA(4)]"]);
  assert.deepEqual(during(g, () => g.set("a", 2)), ["s <- d: [DIRTY, DATA(7)]"]);
  assert.equal(g.inspect("d").invocations, 2, "activation plus one wave");
});

test("P4: a filter that drops settles with RESOLVED; the fan-in still runs once", () => {
  const g = createGraph();
  g.state("a", 2);
  g.node("f", ["a"], filter((v) => v % 2 === 0));
  g.node("d", ["a", "f"], derived((a, f) => `${a}/${f}`));
  g.subscribe("sf", "f");
  g.subscribe("sd", "d");
  assert.deepEqual(during(g, () => g.set("a", 3)), [
    "sf <- f: [DIRTY, RESOLVED]",
    "sd <- d: [DIRTY, DATA(\"3/2\")]",
  ]);
  assert.equal(g.inspect("d").invocations, 2);
});

test("P8: all-RESOLVED settlement still invokes the raw function; silence becomes RESOLVED", () => {
  const g = createGraph();
  g.state("a", 2);
  g.node("f1", ["a"], filter((v) => v % 2 === 0));
  g.node("f2", ["a"], filter((v) => v % 2 === 0));
  const seen = [];
  g.node("d", ["f1", "f2"], ({ deps, activation }) => {
    if (!activation) seen.push(deps.map((x) => (x.resolved ? "R" : x.data.join())));
    return {};
  });
  g.subscribe("s", "d");
  assert.deepEqual(during(g, () => g.set("a", 3)), ["s <- d: [DIRTY, RESOLVED]"]);
  assert.deepEqual(seen, [["R", "R"]]);
});

test("K2: a host batch is one wave; every occurrence is kept", () => {
  const g = createGraph();
  g.state("a", 1);
  g.state("b", 1);
  g.node("sum", ["a", "b"], derived((a, b) => a + b));
  g.node("tens", ["a"], map((v) => v * 10));
  g.subscribe("s", "sum");
  g.subscribe("t", "tens");
  // Order across sinks follows settlement: tens settles from a alone, sum waits for b.
  assert.deepEqual(during(g, () => g.batch(() => { g.set("a", 2); g.set("a", 3); g.set("b", 5); })), [
    "t <- tens: [DIRTY, DATA(20), DATA(30)]",
    "s <- sum: [DIRTY, DATA(8)]",
  ]);
  assert.equal(g.inspect("sum").invocations, 2);
});

test("K2: a throwing batch body publishes nothing, so there is nothing to roll back", () => {
  const g = createGraph();
  g.state("a", 1);
  g.subscribe("s", "a");
  const out = during(g, () => {
    assert.throws(() => g.batch(() => { g.set("a", 9); throw new Error("stop"); }), /stop/);
  });
  assert.deepEqual(out, []);
  assert.equal(g.inspect("a").cache, 1);
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
  g.node("t", ["a"], ({ deps: [x] }) => {
    if (x.data.includes(13)) throw new Error("bad");
    return {};
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
  g.node("x", ["a"], ({ activation }) => (activation ? {} : { down: [["DATA", 1], ["RESOLVED"]] }));
  g.subscribe("s", "x");
  assert.deepEqual(during(g, () => g.set("a", 2)), ["s <- x: [ERROR(\"DATA and RESOLVED in one array\")]"]);
});

test("K7: a computed node clears on last release; plain state keeps its value", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("d", ["a"], map((v) => v * 2));
  g.subscribe("s", "d");
  g.unsubscribe("s", "d");
  assert.deepEqual(g.inspect("d"), { active: false, has: false, cache: undefined, ended: null, invocations: 1, dropped: 0 });
  g.set("a", 4);
  assert.equal(g.inspect("a").cache, 4);
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
  g.node("d", ["a"], ({ deps: [x], activation }) => {
    if (!activation) g.set("e", x.value);
    return {};
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
  g.node("x", ["a"], ({ activation }) => {
    if (!activation) g.set("a", 0);
    return {};
  });
  g.subscribe("s", "x");
  assert.deepEqual(during(g, () => g.set("a", 2)), ["s <- x: [ERROR(\"x wrote its upstream a\")]"]);
  assert.equal(g.inspect("a").cache, 2);
});

test("K8: a batch opened by a function during a wave commits later as one wave", () => {
  const g = createGraph();
  g.state("a", 1);
  g.state("p", 0);
  g.state("q", 0);
  g.node("w", ["a"], ({ deps: [x], activation }) => {
    if (!activation) g.batch(() => { g.set("p", x.value); g.set("q", x.value); });
    return {};
  });
  g.node("pq", ["p", "q"], derived((p, q) => p + q));
  g.subscribe("s", "pq");
  g.subscribe("sw", "w");
  assert.deepEqual(during(g, () => g.set("a", 2)), ["sw <- w: [DIRTY, RESOLVED]", "s <- pq: [DIRTY, DATA(4)]"]);
  assert.equal(g.inspect("pq").invocations, 2, "activation plus one wave, not one per write");
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
  const g = createGraph();
  g.state("a", 1);
  g.subscribe("s1", "a", (msgs) => { if (msgs[0][0] === "DIRTY") throw new Error("ui broke"); });
  g.subscribe("s2", "a");
  assert.deepEqual(during(g, () => g.set("a", 2)), ["s1 <- a: [DIRTY, DATA(2)]", "s2 <- a: [DIRTY, DATA(2)]"]);
  assert.deepEqual(g.reports, [{ source: "sink s1", error: "ui broke" }]);
});

test("K8: a read during a wave returns the retained value and says it has not settled", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("b", ["a"], map((v) => v + 1));
  g.node("c", ["a"], map((v) => v + 2));
  let seen;
  g.subscribe("sb", "b", (msgs) => { if (msgs[0][0] === "DIRTY") seen = g.get("c"); });
  g.subscribe("sc", "c");
  g.set("a", 2);
  assert.deepEqual(seen, { has: true, value: 3, pending: true });
  assert.deepEqual(g.get("c"), { has: true, value: 4, pending: false });
});

test("O3: a read inside a batch body returns the retained value and says it is pending", () => {
  const g = createGraph();
  g.state("a", 1);
  g.state("z", 0);
  g.node("d", ["a"], map((v) => v * 2));
  g.subscribe("s", "d");
  let seen, other;
  const out = during(g, () => g.batch(() => {
    g.set("a", 5);
    seen = g.get("d");
    other = g.get("z");
  }));
  assert.deepEqual(seen, { has: true, value: 2, pending: true }, "batch delivers nothing before commit");
  assert.equal(other.pending, false, "z is outside the staged cone");
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
  const g = createGraph();
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
  assert.equal(g.reports.length, 1);
  assert.equal(g.reports[0].source, "batch");
});

// ---- P9 async, K7 lifetimes and cleanup, K6 invalidation, H6 quiet ---------

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test("P9: later output is a new wave; the starting wave closes now, and results are not paired", () => {
  const g = createGraph();
  g.state("a", 1);
  const sends = [];
  g.node("q", ["a"], ({ deps: [x], activation, ctx }) => {
    if (!activation) sends.push(ctx.later());
    return {};
  });
  g.node("d", ["q", "a"], derived((q, a) => `${q}@${a}`));
  g.subscribe("sq", "q");
  g.subscribe("sd", "d");
  const out = during(g, () => {
    g.set("a", 2);
    g.set("a", 3);
    sends[1]([["DATA", "r3"]]);
    sends[0]([["DATA", "r2"]]); // the older request finishes last
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

test("K7: later output after the lifetime closed is dropped; the signal and late cleanup follow the old life", () => {
  const g = createGraph();
  g.state("a", 1);
  const ctxs = [];
  const sends = [];
  g.node("q", ["a"], ({ ctx }) => {
    ctxs.push(ctx);
    sends.push(ctx.later());
    return {};
  });
  g.subscribe("s", "q");
  assert.throws(() => ctxs[0].onDeactivation(() => {}), KernelError, "live lifetime, invocation returned");
  g.unsubscribe("s", "q");
  assert.equal(ctxs[0].signal.aborted, true, "first access after close is already aborted");
  assert.throws(() => ctxs[0].later(), KernelError);
  let late = 0;
  ctxs[0].onDeactivation(() => { late += 1; });
  assert.equal(late, 1, "a registration after close runs once, now");

  g.subscribe("s2", "q"); // a new lifetime
  const out = during(g, () => {
    sends[0]([["DATA", "old"]]);
    sends[1]([["DATA", "new"]]);
  });
  assert.deepEqual(out, ["s2 <- q: [DIRTY, DATA(\"new\")]"]);
  assert.equal(g.inspect("q").dropped, 1);
  assert.equal(ctxs[1].signal.aborted, false);
});

test("K7: each run replaces the previous run's cleanup; close releases dependencies first, then runs hooks in order", () => {
  const g = createGraph();
  const log = [];
  g.state("a", 1);
  g.node("p", ["a"], ({ deps: [x], ctx }) => {
    ctx.onDeactivation(() => log.push("close p"));
    return { down: x.data.map((v) => ["DATA", v]) };
  });
  g.node("q", ["p"], ({ deps: [x], ctx }) => {
    const v = x.value;
    ctx.onDeactivation(() => log.push(`close q${v} first`));
    ctx.onDeactivation(() => { log.push(`close q${v} second`); throw new Error("leak"); });
    ctx.onDeactivation(() => log.push(`close q${v} third`));
    return { down: [["DATA", v]] };
  });
  g.subscribe("s", "q");
  g.set("a", 2);
  assert.deepEqual(log, [], "replaced registrations are dropped without running");
  g.unsubscribe("s", "q");
  assert.deepEqual(log, ["close p", "close q2 first", "close q2 second", "close q2 third"]);
  assert.deepEqual(g.reports, [{ source: "cleanup q", error: "leak" }]);
});

test("K6: INVALIDATE clears values down the cone once, without DIRTY and without running functions", () => {
  const g = createGraph();
  const log = [];
  g.state("a", 1);
  g.node("b", ["a"], ({ deps: [x], ctx }) => {
    ctx.onInvalidate(() => log.push(`b invalidated, has=${g.get("b").has}`));
    return { down: x.data.map((v) => ["DATA", v * 10]) };
  });
  g.node("c", ["a"], map((v) => v + 1));
  g.node("d", ["b", "c"], derived((b, c) => b + c));
  g.subscribe("sd", "d");
  g.subscribe("sb", "b");
  // d hears it from b and from c; the second arrives after d's value is gone, so it is
  // a no-op. That is what keeps the diamond glitch-free here.
  assert.deepEqual(during(g, () => g.invalidate("a")), ["sd <- d: [INVALIDATE]", "sb <- b: [INVALIDATE]"]);
  assert.deepEqual(log, ["b invalidated, has=false"]);
  assert.deepEqual(during(g, () => g.invalidate("a")), [], "repeat is ineffective");
  assert.deepEqual(during(g, () => g.set("a", 2)), ["sb <- b: [DIRTY, DATA(20)]", "sd <- d: [DIRTY, DATA(23)]"]);
  assert.equal(g.inspect("d").invocations, 2, "activation plus the recompute; invalidation ran nothing");
});

test("K6/P4: an announced node whose invalidation is a no-op still settles with RESOLVED", () => {
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

test("H6: a quiet node's invalidation and inherited ERROR are later waves too", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("q", ["a"], map((v) => v * 10), { quiet: true });
  g.node("f", ["q", "a"], derived((q, a) => `${q}/${a}`));
  g.subscribe("sq", "q"); // q's own sink comes first in q's delivery order
  g.subscribe("sf", "f");
  assert.deepEqual(during(g, () => g.invalidate("a")), ["sf <- f: [INVALIDATE]", "sq <- q: [INVALIDATE]"]);
  g.set("a", 2);
  assert.deepEqual(during(g, () => g.error("a", "down")), ["sf <- f: [ERROR(\"down\")]", "sq <- q: [ERROR(\"down\")]"]);
});
