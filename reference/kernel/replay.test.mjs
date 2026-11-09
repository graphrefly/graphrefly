// Replays the kernel-applicable clauses of the D796 candidate scenarios C-28 to C-39
// (spec/conformance.jsonl) against the reference kernel. Each test names the scenario
// and quotes the clause it checks. REPLAY.md lists every clause, including the ones
// that belong to modules, are not modeled, or changed under a DS-17 decision.

import test from "node:test";
import assert from "node:assert/strict";
import { createGraph, format, KernelError } from "./kernel.mjs";
import { derived, map } from "./sugar.mjs";

function during(g, body) {
  const start = g.trace.length;
  body();
  return g.trace.slice(start).map(format);
}

// Wraps a node function to count its invocations.
function counted(fn) {
  const wrapped = (ctx) => { wrapped.calls += 1; fn(ctx); };
  wrapped.calls = 0;
  return wrapped;
}

// A depless node is a producer: its function runs once at activation and hands out its
// ctx, whose down later publishes from it.
function producer(g, id) {
  const handle = {};
  g.node(id, [], (ctx) => { handle.ctx = ctx; });
  return handle;
}

test("C-28: one array of three occurrences stays intact, and the diamond fan-in runs once with all of them", () => {
  const g = createGraph();
  const A = producer(g, "A");
  g.node("B", ["A"], map((v) => v));
  g.node("C", ["A"], map((v) => v));
  const seen = [];
  g.node("D", ["B", "C"], (ctx) => { seen.push(ctx.deps.map((d) => d.waves)); });
  g.subscribe("o1", "A");
  g.subscribe("o2", "A");
  g.subscribe("sd", "D");
  seen.length = 0;
  assert.deepEqual(during(g, () => A.ctx.down([["DATA", 23], ["DATA", 23], ["DATA", 30]])), [
    "o1 <- A: [DIRTY, DATA(23), DATA(23), DATA(30)]",
    "o2 <- A: [DIRTY, DATA(23), DATA(23), DATA(30)]",
    "sd <- D: [DIRTY, RESOLVED]",
  ]);
  assert.deepEqual(seen, [[[[23, 23, 30]], [[23, 23, 30]]]], "one invocation, every occurrence, one array per dependency");
});

test("C-28: separate explicit calls stay separate waves; a batch is its declared accumulation", () => {
  const g = createGraph();
  const A = producer(g, "A");
  g.subscribe("o", "A");
  assert.deepEqual(during(g, () => { A.ctx.down([["DATA", 23]]); A.ctx.down([["DATA", 30]]); }), [
    "o <- A: [DIRTY, DATA(23)]",
    "o <- A: [DIRTY, DATA(30)]",
  ]);
  assert.deepEqual(during(g, () => g.batch(() => { A.ctx.down([["DATA", 23]]); A.ctx.down([["DATA", 30]]); })), [
    "o <- A: [DIRTY, DATA(23), DATA(30)]",
  ]);
});

test("C-28: observer requests apply only after the complete fanout; no peer is cut off mid-array", () => {
  const g = createGraph();
  const A = producer(g, "A");
  let first = true;
  g.subscribe("o1", "A", (msgs) => {
    if (!first || msgs[0][0] !== "DIRTY") return;
    first = false;
    g.unsubscribe("o2", "A");      // would cut o2 off if applied now
    g.subscribe("o3", "A");
    A.ctx.down([["DATA", 99]]);     // another output
  });
  g.subscribe("o2", "A");
  assert.deepEqual(during(g, () => A.ctx.down([["DATA", 1]])), [
    "o1 <- A: [DIRTY, DATA(1)]",
    "o2 <- A: [DIRTY, DATA(1)]",   // still receives the whole array
    "o3 <- A: [START, DATA(1)]",   // requests then apply in issue order
    "o1 <- A: [DIRTY, DATA(99)]",
    "o3 <- A: [DIRTY, DATA(99)]",
  ]);
});

test("C-28: a rejected conflicting submission leaves earlier batch staging unchanged, in either order", () => {
  const g = createGraph();
  const A = producer(g, "A");
  g.subscribe("o", "A");
  assert.deepEqual(during(g, () => g.batch(() => {
    A.ctx.down([["DATA", 1]]);
    assert.throws(() => A.ctx.down([["RESOLVED"]]), KernelError);
  })), ["o <- A: [DIRTY, DATA(1)]"]);
  assert.deepEqual(during(g, () => g.batch(() => {
    A.ctx.down([["RESOLVED"]]);
    assert.throws(() => A.ctx.down([["DATA", 2]]), KernelError);
  })), ["o <- A: [DIRTY, RESOLVED]"]);
});

test("C-28: an observer failure after commit does not roll back the committed output", () => {
  const reports = [];
  const g = createGraph({ report: (r) => reports.push(r) });
  g.state("a", 1);
  g.node("d", ["a"], map((v) => v * 2));
  g.subscribe("o", "d", (msgs) => { if (msgs[0][0] === "DIRTY") throw new Error("observer"); });
  g.batch(() => g.set("a", 5));
  assert.deepEqual([g.get("a").value, g.get("d").value], [5, 10]);
  assert.deepEqual(reports, [{ source: "sink o", error: "observer" }]);
});

test("C-31: ordinary last-off keeps the state's intrinsic value, and a write queued behind the close still applies", () => {
  const g = createGraph();
  g.state("s", 20);
  g.state("t", 0);
  g.subscribe("o", "s");
  g.subscribe("ot", "t", (msgs) => {
    if (msgs[0][0] !== "DIRTY") return;
    g.unsubscribe("o", "s"); // close first ...
    g.set("s", 30);          // ... then the queued write
  });
  g.set("t", 1);
  assert.deepEqual(g.get("s"), { active: false, has: true, value: 30, ended: null });
  assert.deepEqual(during(g, () => g.subscribe("o", "s")), ["o <- s: [START, DATA(30)]"]);
});

test("C-31: a terminal seals the state; a write queued behind the terminal is dropped before mutation", () => {
  const reports = [];
  const g = createGraph({ report: (r) => reports.push(r) });
  g.state("s", 20);
  g.state("t", 0);
  g.subscribe("o", "s");
  g.subscribe("ot", "t", (msgs) => {
    if (msgs[0][0] !== "DIRTY") return;
    g.complete("s");
    g.set("s", 40);
  });
  g.set("t", 1);
  assert.deepEqual(g.get("s"), { active: true, has: true, value: 20, ended: ["COMPLETE"] });
  assert.deepEqual(reports, [{ source: "queued request", error: "s has ended" }]);
  assert.throws(() => g.subscribe("o2", "s"), KernelError, "no reset revives a sealed output");
});

test("C-33: a close requested during an invocation waits until it returns; cleanup runs after delivery", () => {
  const g = createGraph();
  const log = [];
  g.state("a", 1);
  g.node("q", ["a"], (ctx) => {
    const v = ctx.deps[0].value;
    ctx.onDeactivation(() => log.push(`cleanup q${v}`));
    if (v === 2) g.unsubscribe("s", "q"); // the node's only subscriber, mid-invocation
    log.push(`run q${v}`);
    ctx.down([["DATA", v]]);
  });
  g.subscribe("s", "q", (msgs) => log.push(`deliver ${format({ to: "s", from: "q", msgs })}`));
  log.length = 0;
  g.set("a", 2);
  assert.deepEqual(log, ["run q2", "deliver s <- q: [DIRTY, DATA(2)]", "cleanup q2"]);
});

test("C-33: old-lifetime output is dropped, and a fresh lifetime gets a distinct ctx and signal", () => {
  const g = createGraph();
  const ctxs = [];
  g.state("a", 1);
  g.node("q", ["a"], (ctx) => { ctxs.push(ctx); });
  g.subscribe("s", "q");
  const oldSignal = ctxs[0].signal;
  g.unsubscribe("s", "q");
  g.subscribe("s", "q");
  assert.notEqual(ctxs[1], ctxs[0]);
  assert.notEqual(ctxs[1].signal, oldSignal);
  assert.equal(oldSignal.aborted, true);
  assert.deepEqual(during(g, () => ctxs[0].down([["DATA", "old"]])), []);
});

test("C-34: during DATA+COMPLETE fanout every observer gets the whole array; a subscribe request waits and finds the source ended", () => {
  const reports = [];
  const g = createGraph({ report: (r) => reports.push(r) });
  const S = producer(g, "S");
  g.subscribe("X", "S", (msgs) => {
    if (msgs[0][0] !== "DIRTY") return;
    g.subscribe("Z", "S");
    throw new Error("X failed");
  });
  g.subscribe("Y", "S");
  assert.deepEqual(during(g, () => S.ctx.down([["DATA", 1], ["COMPLETE"]])), [
    "X <- S: [DIRTY, DATA(1), COMPLETE]",
    "Y <- S: [DIRTY, DATA(1), COMPLETE]",
  ]);
  assert.deepEqual(reports, [
    { source: "sink X", error: "X failed" },          // not S's ERROR
    { source: "queued request", error: "S has ended" }, // no resubscribable in the kernel (O7)
  ]);
});

test("C-36: one invocation sees the admitted DATA and the terminal of the same array (complete=manual)", () => {
  const g = createGraph();
  const A = producer(g, "A");
  const views = [];
  g.node("r", ["A"], (ctx) => {
    const [d] = ctx.deps;
    views.push([d.waves, d.terminal]);
    if (d.terminal) ctx.down([["DATA", d.waves.flat().length], ["COMPLETE"]]);
  }, { terminal: { complete: "manual" } });
  g.subscribe("s", "r");
  views.length = 0;
  assert.deepEqual(during(g, () => A.ctx.down([["DATA", 5], ["DATA", 6], ["COMPLETE"]])), [
    "s <- r: [DIRTY, DATA(2), COMPLETE]",
  ]);
  assert.deepEqual(views, [[[[5, 6]], ["COMPLETE"]]]);
});

test("C-36: under complete=auto the terminal ends the node after its run, with no balancing RESOLVED", () => {
  const g = createGraph();
  const A = producer(g, "A");
  g.node("d", ["A"], derived((v) => v * 10));
  g.subscribe("s", "d");
  assert.deepEqual(during(g, () => A.ctx.down([["DATA", 5], ["COMPLETE"]])), [
    "s <- d: [DIRTY, DATA(50)]",
    "s <- d: [COMPLETE]",
  ]);
});

test("C-36: a trailing INVALIDATE in the same array leaves the value absent for the fan-in", () => {
  const g = createGraph();
  const A = producer(g, "A");
  const runs = [];
  g.node("d", ["A"], (ctx) => { runs.push(ctx.deps[0].waves); ctx.down([["DATA", "d"]]); });
  g.subscribe("sa", "A");
  g.subscribe("sd", "d");
  A.ctx.down([["DATA", 5]]);
  runs.length = 0;
  // O13: DATA(7) comes before the INVALIDATE in its array, so it is removed (DS-17 O13).
  assert.deepEqual(during(g, () => A.ctx.down([["DATA", 7], ["INVALIDATE"]])), [
    "sa <- A: [INVALIDATE]",
    "sd <- d: [INVALIDATE]",
  ]);
  assert.deepEqual(runs, [], "the function does not run on an invalidated input");
  assert.equal(g.get("A").has, false);
});

test("C-33/O3: output staged in a batch by a lifetime that closes before commit is dropped, not cached", () => {
  const g = createGraph();
  const P = producer(g, "P");
  g.subscribe("s", "P");
  const old = P.ctx;
  g.batch(() => {
    old.down([["DATA", "old"]]);
    g.unsubscribe("s", "P"); // closes P's lifetime inside the body
  });
  assert.deepEqual(during(g, () => g.subscribe("s2", "P")), ["s2 <- P: [START]"]);
});

// ---- C-8, intra-graph runtime rewire, against replace (DS-17 O4) ----------------------
// C-8 is the activated R-rewire scenario. replace is graph-level and not surgical (O4),
// so several clauses differ by design; REPLAY.md lists each. These tests pin what replace
// does for each step.

test("C-8 (2)(3): a new dependency's value reaches D, D recomputes, and the new dependency then drives D", () => {
  const g = createGraph();
  g.state("A", "a1");
  g.state("B", "b0");
  g.node("D", ["A"], (ctx) => ctx.down([["DATA", `f(${ctx.deps[0].value})`]]));
  g.subscribe("s", "D");
  assert.deepEqual(during(g, () => g.replace("D", ["A", "B"], (ctx) => ctx.down([["DATA", `f2(${ctx.deps[0].value},${ctx.deps[1].value})`]]))), [
    "s <- D: [START, DATA(\"f2(a1,b0)\")]",
  ]);
  assert.deepEqual(during(g, () => g.set("B", "b1")), ["s <- D: [DIRTY, DATA(\"f2(a1,b1)\")]"]);
});

test("C-8 (4)(5): a removed dependency no longer drives D; D's value is recomputed, not preserved (O4)", () => {
  const g = createGraph();
  g.state("A", "a1");
  g.state("B", "b1");
  g.node("D", ["A", "B"], (ctx) => ctx.down([["DATA", `f2(${ctx.deps[0].value},${ctx.deps[1].value})`]]));
  g.subscribe("s", "D");
  assert.deepEqual(during(g, () => g.replace("D", ["B"], (ctx) => ctx.down([["DATA", `f3(${ctx.deps[0].value})`]]))), [
    "s <- D: [START, DATA(\"f3(b1)\")]", // C-8 keeps f2(a1,b1) until B or A next drives D
  ]);
  assert.deepEqual(during(g, () => g.set("A", "a2")), [], "A is drained");
});

test("C-8 (6): replace to the current dependencies is not idempotent: a fresh instance runs (O4)", () => {
  const g = createGraph();
  g.state("B", "b1");
  const fn = counted((ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  g.node("D", ["B"], fn);
  g.subscribe("s", "D");
  assert.deepEqual(during(g, () => g.replace("D", ["B"], fn)), ["s <- D: [START, DATA(\"b1\")]"]);
  assert.equal(fn.calls, 2);
});

test("C-8: an added dependency with no value still lets the new instance run once", () => {
  const g = createGraph();
  g.state("A", "a1");
  g.state("E"); // SENTINEL: no value
  const fn = counted((ctx) => ctx.down([["DATA", ctx.deps[1].has ? "both" : "a only"]]));
  g.node("D", ["A"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  g.subscribe("s", "D");
  assert.deepEqual(during(g, () => g.replace("D", ["A", "E"], fn)), ["s <- D: [START, DATA(\"a only\")]"]);
  assert.equal(fn.calls, 1, "the new instance runs once; C-8 would wait until E emits");
});

test("C-8: a replace D asks for from its own function waits for the wave (K8) instead of being an ERROR", () => {
  const g = createGraph();
  g.state("A", 1);
  let asked = false;
  g.node("D", ["A"], (ctx) => {
    if (ctx.deps[0].value === 2 && !asked) { asked = true; g.replace("D", ["A"], (c) => c.down([["DATA", -c.deps[0].value]])); }
    ctx.down([["DATA", ctx.deps[0].value]]);
  });
  g.subscribe("s", "D");
  assert.deepEqual(during(g, () => g.set("A", 2)), ["s <- D: [DIRTY, DATA(2)]", "s <- D: [START, DATA(-2)]"]);
});

test("C-8: replacing to no dependencies leaves D active with a function of no inputs", () => {
  const g = createGraph();
  g.state("A", 1);
  g.node("D", ["A"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  g.subscribe("s", "D");
  assert.deepEqual(during(g, () => g.replace("D", [], (ctx) => ctx.down([["DATA", "none"]]))), ["s <- D: [START, DATA(\"none\")]"]);
  assert.equal(g.get("D").active, true);
  assert.deepEqual(during(g, () => g.set("A", 2)), []);
});
