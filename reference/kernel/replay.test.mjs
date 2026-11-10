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
    "o1 <- A: [PENDING, DATA(23), DATA(23), DATA(30)]",
    "o2 <- A: [PENDING, DATA(23), DATA(23), DATA(30)]",
    "sd <- D: [PENDING, RESOLVED]",
  ]);
  assert.deepEqual(seen, [[[[23, 23, 30]], [[23, 23, 30]]]], "one invocation, every occurrence, one array per dependency");
});

test("C-28: separate explicit calls stay separate waves; a batch is its declared accumulation", () => {
  const g = createGraph();
  const A = producer(g, "A");
  g.subscribe("o", "A");
  assert.deepEqual(during(g, () => { A.ctx.down([["DATA", 23]]); A.ctx.down([["DATA", 30]]); }), [
    "o <- A: [PENDING, DATA(23)]",
    "o <- A: [PENDING, DATA(30)]",
  ]);
  assert.deepEqual(during(g, () => g.batch(() => { A.ctx.down([["DATA", 23]]); A.ctx.down([["DATA", 30]]); })), [
    "o <- A: [PENDING, DATA(23), DATA(30)]",
  ]);
});

test("C-28: observer requests apply only after the complete fanout; no peer is cut off mid-array", () => {
  const g = createGraph();
  const A = producer(g, "A");
  let first = true;
  g.subscribe("o1", "A", (msgs) => {
    if (!first || msgs[0][0] !== "PENDING") return;
    first = false;
    g.unsubscribe("o2", "A");      // would cut o2 off if applied now
    g.subscribe("o3", "A");
    A.ctx.down([["DATA", 99]]);     // another output
  });
  g.subscribe("o2", "A");
  assert.deepEqual(during(g, () => A.ctx.down([["DATA", 1]])), [
    "o1 <- A: [PENDING, DATA(1)]",
    "o2 <- A: [PENDING, DATA(1)]",   // still receives the whole array
    "o3 <- A: [START, DATA(1)]",   // requests then apply in issue order
    "o1 <- A: [PENDING, DATA(99)]",
    "o3 <- A: [PENDING, DATA(99)]",
  ]);
});

test("C-28: a rejected conflicting submission leaves earlier batch staging unchanged, in either order", () => {
  const g = createGraph();
  const A = producer(g, "A");
  g.subscribe("o", "A");
  assert.deepEqual(during(g, () => g.batch(() => {
    A.ctx.down([["DATA", 1]]);
    assert.throws(() => A.ctx.down([["RESOLVED"]]), KernelError);
  })), ["o <- A: [PENDING, DATA(1)]"]);
  assert.deepEqual(during(g, () => g.batch(() => {
    A.ctx.down([["RESOLVED"]]);
    assert.throws(() => A.ctx.down([["DATA", 2]]), KernelError);
  })), ["o <- A: [PENDING, RESOLVED]"]);
});

test("C-28: an observer failure after commit does not roll back the committed output", () => {
  const reports = [];
  const g = createGraph({ report: (r) => reports.push(r) });
  g.state("a", 1);
  g.node("d", ["a"], map((v) => v * 2));
  g.subscribe("o", "d", (msgs) => { if (msgs[0][0] === "PENDING") throw new Error("observer"); });
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
    if (msgs[0][0] !== "PENDING") return;
    g.unsubscribe("o", "s"); // close first ...
    g.set("s", 30);          // ... then the queued write
  });
  g.set("t", 1);
  assert.deepEqual(g.get("s"), { active: false, has: true, value: 30, values: [30], ended: null });
  assert.deepEqual(during(g, () => g.subscribe("o", "s")), ["o <- s: [START, DATA(30)]"]);
});

test("C-31: a terminal seals the state; a write queued behind the terminal is dropped before mutation", () => {
  const reports = [];
  const g = createGraph({ report: (r) => reports.push(r) });
  g.state("s", 20);
  g.state("t", 0);
  g.subscribe("o", "s");
  g.subscribe("ot", "t", (msgs) => {
    if (msgs[0][0] !== "PENDING") return;
    g.complete("s");
    g.set("s", 40);
  });
  g.set("t", 1);
  assert.deepEqual(g.get("s"), { active: true, has: true, value: 20, values: [20], ended: ["COMPLETE"] });
  assert.deepEqual(reports, [{ source: "queued request", error: "s has ended" }]);
  assert.deepEqual(during(g, () => g.subscribe("o2", "s")), ["o2 <- s: [START, DATA(20), COMPLETE]"],
    "no reset revives a sealed output: a new subscriber gets its terminal snapshot (P5)");
});

test("C-33: a close requested during an invocation waits until it returns; cleanup runs after delivery", () => {
  const g = createGraph();
  const log = [];
  g.state("a", 1);
  g.node("q", ["a"], (ctx) => {
    const v = ctx.deps[0].value;
    ctx.state.set(v);
    if (v === 2) g.unsubscribe("s", "q"); // the node's only subscriber, mid-invocation
    log.push(`run q${v}`);
    ctx.down([["DATA", v]]);
  }, { setup: (ctx) => () => log.push(`cleanup q${ctx.state.get()}`) });
  g.subscribe("s", "q", (msgs) => log.push(`deliver ${format({ to: "s", from: "q", msgs })}`));
  log.length = 0;
  g.set("a", 2);
  assert.deepEqual(log, ["run q2", "deliver s <- q: [PENDING, DATA(2)]", "cleanup q2"]);
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

test("C-34: during DATA+COMPLETE fanout every observer gets the whole array; a subscribe request waits and gets the ended snapshot", () => {
  const reports = [];
  const g = createGraph({ report: (r) => reports.push(r) });
  const S = producer(g, "S");
  g.subscribe("X", "S", (msgs) => {
    if (msgs[0][0] !== "PENDING") return;
    g.subscribe("Z", "S");
    throw new Error("X failed");
  });
  g.subscribe("Y", "S");
  assert.deepEqual(during(g, () => S.ctx.down([["DATA", 1], ["COMPLETE"]])), [
    "X <- S: [PENDING, DATA(1), COMPLETE]",
    "Y <- S: [PENDING, DATA(1), COMPLETE]",
    "Z <- S: [START, DATA(1), COMPLETE]", // after the wave; no resubscribable in the kernel (O7)
  ]);
  assert.deepEqual(reports, [{ source: "sink X", error: "X failed" }]); // not S's ERROR
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
    "s <- r: [PENDING, DATA(2), COMPLETE]",
  ]);
  assert.deepEqual(views, [[[[5, 6]], ["COMPLETE"]]]);
});

test("C-36: under complete=auto the terminal ends the node after its run, with no balancing RESOLVED", () => {
  const g = createGraph();
  const A = producer(g, "A");
  g.node("d", ["A"], derived((v) => v * 10));
  g.subscribe("s", "d");
  assert.deepEqual(during(g, () => A.ctx.down([["DATA", 5], ["COMPLETE"]])), [
    "s <- d: [PENDING, DATA(50)]",
    "s <- d: [PENDING, COMPLETE]",
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
    "sa <- A: [PENDING, INVALIDATE]",
    "sd <- d: [PENDING, INVALIDATE]",
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
  assert.deepEqual(during(g, () => g.set("B", "b1")), ["s <- D: [PENDING, DATA(\"f2(a1,b1)\")]"]);
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
  assert.deepEqual(during(g, () => g.set("A", 2)), ["s <- D: [PENDING, DATA(2)]", "s <- D: [START, DATA(-2)]"]);
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

// ---- C-8 again, against rewire (surgical, 2026-11-08; on ctx since 2026-11-10, F7) ------
// rewire keeps D's instance, so C-8's surgical clauses hold; REPLAY.md lists what remains.
// Since F7 a node rewires itself through ctx.rewire(deps), which cannot change the function, so
// D's one function reads its dependencies as a list, and the test keeps the ctx of its last run.

const f2 = (ctx) => ctx.down([["DATA", `f2(${ctx.deps.map((d) => d.value).join(",")})`]]);

// Keeps the ctx of fn's latest run, so the test can call ctx.rewire at a wave boundary.
function withCtx(fn) {
  const wrapped = (ctx) => { wrapped.ctx = ctx; fn(ctx); };
  return wrapped;
}

test("C-8 rewire (2)(3): an added cached dependency reaches D without a START, D recomputes, then it drives D", () => {
  const g = createGraph();
  g.state("A", "a1");
  g.state("B", "b0");
  const D = withCtx(f2);
  g.node("D", ["A"], D);
  g.subscribe("s", "D");
  assert.deepEqual(during(g, () => D.ctx.rewire(["A", "B"])), ["s <- D: [PENDING, DATA(\"f2(a1,b0)\")]"]);
  assert.deepEqual(during(g, () => g.set("B", "b1")), ["s <- D: [PENDING, DATA(\"f2(a1,b1)\")]"]);
});

test("C-8 rewire (2): an added dependency with no value sends nothing; D recomputes when it first emits", () => {
  const g = createGraph();
  g.state("A", "a1");
  g.state("E");
  const fn = counted(f2);
  const D = withCtx(fn);
  g.node("D", ["A"], D);
  g.subscribe("s", "D");
  assert.deepEqual(during(g, () => D.ctx.rewire(["A", "E"])), []);
  assert.equal(fn.calls, 1, "only the activation run");
  assert.deepEqual(during(g, () => g.set("E", "e1")), ["s <- D: [PENDING, DATA(\"f2(a1,e1)\")]"]);
});

test("C-8 rewire (4)(5): a removed dependency no longer drives D, and D's value is preserved", () => {
  const g = createGraph();
  g.state("A", "a1");
  g.state("B", "b1");
  const D = withCtx(f2);
  g.node("D", ["A", "B"], D);
  g.subscribe("s", "D");
  assert.deepEqual(during(g, () => D.ctx.rewire(["B"])), []);
  assert.equal(g.get("D").value, "f2(a1,b1)");
  assert.deepEqual(during(g, () => g.set("A", "a2")), [], "A is drained");
  assert.deepEqual(during(g, () => g.set("B", "b2")), ["s <- D: [PENDING, DATA(\"f2(b2)\")]"]);
});

test("C-8 rewire (6): rewiring to the current set is idempotent: no run, nothing sent", () => {
  const g = createGraph();
  g.state("B", "b1");
  const fn = counted(f2);
  const D = withCtx(fn);
  g.node("D", ["B"], D);
  g.subscribe("s", "D");
  assert.deepEqual(during(g, () => D.ctx.rewire(["B"])), []);
  assert.equal(fn.calls, 1);
});

// F7 (changed): C-8 expects the rewire of a terminal D to be refused. D's lifetime closed when it
// ended, and a rewire belongs to the lifetime, so it is now dropped, as ctx.down after close is.
test("C-8 rewire: a rewire on a terminal D is dropped, since its lifetime has closed (replace stays the way to restart it)", () => {
  const g = createGraph();
  g.state("A", 1); g.state("B", 2);
  const D = withCtx((ctx) => ctx.down([["COMPLETE"]]));
  g.node("D", ["A"], D);
  g.subscribe("s", "D");
  assert.deepEqual(during(g, () => D.ctx.rewire(["B"])), []);
  assert.deepEqual(g.describe().find((d) => d.id === "D").deps, ["A"]);
  assert.equal(g.get("B").active, false);
});

test("C-8 rewire: to zero dependencies, D keeps its value and stays active", () => {
  const g = createGraph();
  g.state("A", "a1");
  const D = withCtx(f2);
  g.node("D", ["A"], D);
  g.subscribe("s", "D");
  assert.deepEqual(during(g, () => D.ctx.rewire([])), []);
  assert.deepEqual(g.get("D"), { active: true, has: true, value: "f2(a1)", values: ["f2(a1)"], ended: null });
});

// ---- C-22, a rewire requested while a batch is open (R-rewire-batch-boundary) ----------
// A batch body's requests run after its commit (O3, K8); REPLAY.md lists the clauses. C-22's
// f and g are one function here, which names each dependency (F7: rewire keeps the function).

const byId = (ctx) => ctx.down([["DATA", ctx.deps.map((d) => `${d.id}=${d.value}`).join(",")]]);

test("C-22: a rewire requested in a nested batch waits for the outermost commit, which settles under the old shape", () => {
  const g = createGraph();
  g.state("A", "a1"); g.state("B", "b0");
  const N = withCtx(byId);
  g.node("N", ["A"], N);
  g.subscribe("s", "N");
  let depsAfterInner;
  const out = during(g, () => g.batch(() => {
    g.set("A", "a2");
    g.batch(() => N.ctx.rewire(["B"]));
    depsAfterInner = g.describe().find((d) => d.id === "N").deps;
  }));
  assert.deepEqual(depsAfterInner, ["A"], "the inner batch's exit does not apply it");
  assert.deepEqual(out, ["s <- N: [PENDING, DATA(\"A=a2\")]", "s <- N: [PENDING, DATA(\"B=b0\")]"]);
});

test("C-22: rewires queued in one batch drain in request order, each as its own wave", () => {
  const g = createGraph();
  g.state("A", "a1"); g.state("B", "b0");
  const N = withCtx(byId);
  g.node("N", ["A"], N);
  g.subscribe("s", "N");
  const out = during(g, () => g.batch(() => {
    g.set("A", "a2");
    N.ctx.rewire(["A", "B"]);
    N.ctx.rewire(["B"]);
  }));
  // The second removes A and adds nothing, so it sends nothing (a removal is silent).
  assert.deepEqual(out, ["s <- N: [PENDING, DATA(\"A=a2\")]", "s <- N: [PENDING, DATA(\"A=a2,B=b0\")]"]);
  assert.deepEqual(during(g, () => g.set("B", "b1")), ["s <- N: [PENDING, DATA(\"B=b1\")]"]);
});

test("C-22 (changed, K8): a rewire of a node the batch does not touch waits for the commit too", () => {
  const g = createGraph();
  g.state("A", "a1"); g.state("B", "b0"); g.state("C", "c0");
  g.node("N", ["A"], byId);
  const M = withCtx(byId);
  g.node("M", ["C"], M);
  g.subscribe("s", "N");
  g.subscribe("t", "M");
  const out = during(g, () => g.batch(() => { g.set("A", "a2"); M.ctx.rewire(["C", "B"]); }));
  assert.deepEqual(out, ["s <- N: [PENDING, DATA(\"A=a2\")]", "t <- M: [PENDING, DATA(\"C=c0,B=b0\")]"]);
});
