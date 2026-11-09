// The combining sugar against the examples agreed with the user on 2026-11-08: which arrays
// each combinator sends, now that the array is the unit (K3, R-wave-boundary).

import test from "node:test";
import assert from "node:assert/strict";
import { createGraph, format } from "./kernel.mjs";
import { combineLatest, derived, merge, withLatestFrom, zip } from "./sugar.mjs";

function during(g, body) {
  const start = g.trace.length;
  body();
  return g.trace.slice(start).map(format);
}
const manual = { terminal: { complete: "manual" } };
const both = (g, a, ...vs) => g.batch(() => vs.forEach((v) => g.set(a, v))); // one array of several values

test("combineLatest: one tuple per run from the latest values; a value in the middle of an array is not combined", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b", 10);
  g.node("c", ["a", "b"], combineLatest());
  assert.deepEqual(during(g, () => g.subscribe("s", "c")), ["s <- c: [START, DATA([1,10])]"]);
  assert.deepEqual(during(g, () => both(g, "a", 2, 3)), ["s <- c: [DIRTY, DATA([3,10])]"]);
  assert.deepEqual(during(g, () => g.batch(() => { g.set("a", 4); g.set("b", 20); })), ["s <- c: [DIRTY, DATA([4,20])]"]);
  g.set("b", 30);
  assert.deepEqual(during(g, () => g.subscribe("late", "c")), ["late <- c: [START, DATA([4,30])]"]);
});

test("merge: every input array becomes one output array, in declaration order", () => {
  const g = createGraph();
  g.state("a"); g.state("b");
  g.node("m", ["a", "b"], merge());
  g.subscribe("s", "m");
  assert.deepEqual(during(g, () => both(g, "a", 1, 2)), ["s <- m: [DIRTY, DATA(1), DATA(2)]"]);
  assert.deepEqual(during(g, () => g.batch(() => { g.set("a", 3); g.set("b", 10); g.set("b", 11); })),
    ["s <- m: [DIRTY, DATA(3)]", "s <- m: [DIRTY, DATA(10), DATA(11)]"]);
  assert.deepEqual(during(g, () => g.subscribe("late", "m")), ["late <- m: [START, DATA(10), DATA(11)]"],
    "the last array, whole");
  g.state("t", 0);
  g.node("two", ["t"], (ctx) => { const v = ctx.deps[0].value; ctx.down([["DATA", v]]); ctx.down([["DATA", v + 1], ["DATA", v + 2]]); });
  g.node("m2", ["two"], merge());
  g.subscribe("k", "m2");
  assert.deepEqual(during(g, () => g.set("t", 4)), ["k <- m2: [DIRTY, DATA(4)]", "k <- m2: [DIRTY, DATA(5), DATA(6)]"],
    "two arrays of one dependency in one run stay two");
});

test("withLatestFrom: each primary array becomes one array of pairs; a secondary change alone sends nothing", () => {
  const g = createGraph();
  g.state("p"); g.state("s", 100);
  g.node("w", ["p", "s"], withLatestFrom(), manual);
  g.subscribe("k", "w");
  assert.deepEqual(during(g, () => both(g, "p", 1, 2)), ["k <- w: [DIRTY, DATA([1,100]), DATA([2,100])]"]);
  assert.deepEqual(during(g, () => g.set("s", 200)), ["k <- w: [DIRTY, RESOLVED]"]);
  assert.deepEqual(during(g, () => g.batch(() => { g.set("p", 3); g.set("s", 300); })), ["k <- w: [DIRTY, DATA([3,300])]"],
    "a secondary value in the same run is the latest one");
  g.node("two", [], (ctx) => { ctx.down([["DATA", 4]]); ctx.down([["DATA", 5]]); }); // two arrays in one run
  g.node("w2", ["two", "s"], withLatestFrom(), manual);
  assert.deepEqual(during(g, () => g.subscribe("k2", "w2")), ["k2 <- w2: [START, DATA([5,300])]"],
    "two primary arrays give two output arrays; the snapshot is the last");
});

test("withLatestFrom: nothing while the secondary has no value; it ends with the primary, not the secondary", () => {
  const g = createGraph();
  g.state("p"); g.state("s");
  g.node("w", ["p", "s"], withLatestFrom(), manual);
  g.subscribe("k", "w");
  assert.deepEqual(during(g, () => g.set("p", 1)), ["k <- w: [DIRTY, RESOLVED]"]);
  g.set("s", 9);
  g.complete("s");
  assert.equal(g.get("w").ended, null);
  assert.deepEqual(during(g, () => g.set("p", 2)), ["k <- w: [DIRTY, DATA([2,9])]"]);
  g.complete("p");
  assert.deepEqual(g.get("w").ended, ["COMPLETE"]);
});

test("zip: one array per run with every tuple formed in it; a value waits for its partner", () => {
  const g = createGraph();
  g.state("a"); g.state("b");
  g.node("z", ["a", "b"], zip(), manual);
  g.subscribe("s", "z");
  assert.deepEqual(during(g, () => both(g, "a", 1, 2)), ["s <- z: [DIRTY, RESOLVED]"]);
  assert.deepEqual(during(g, () => g.set("b", "x")), ["s <- z: [DIRTY, DATA([1,\"x\"])]"]);
  assert.deepEqual(during(g, () => g.batch(() => { g.set("a", 3); g.set("b", "y"); g.set("b", "z"); })),
    ["s <- z: [DIRTY, DATA([2,\"y\"]), DATA([3,\"z\"])]"]);
  assert.deepEqual(during(g, () => g.subscribe("late", "z")), ["late <- z: [START, DATA([2,\"y\"]), DATA([3,\"z\"])]"]);
});

test("zip: completes once a completed dependency's queue is empty, not before", () => {
  const g = createGraph();
  g.state("a"); g.state("b");
  g.node("z", ["a", "b"], zip(), manual);
  g.subscribe("s", "z");
  both(g, "a", 1, 2);
  g.complete("a");
  assert.equal(g.get("z").ended, null, "a's 1 and 2 still wait for partners");
  g.set("b", "x");
  assert.equal(g.get("z").ended, null);
  assert.deepEqual(during(g, () => g.set("b", "y")), ["s <- z: [DIRTY, DATA([2,\"y\"]), COMPLETE]"]);
});

test("zip: RESOLVED is not an occurrence, so a diamond with a filter pairs values from different source waves", () => {
  // x feeds a (every value) and b (even values only); b settles with RESOLVED on odd ones.
  const g = createGraph();
  g.state("x", 0);
  g.node("a", ["x"], (ctx) => ctx.down([["DATA", `a${ctx.deps[0].value}`]]));
  g.node("b", ["x"], (ctx) => { if (ctx.deps[0].value % 2 === 0) ctx.down([["DATA", `b${ctx.deps[0].value}`]]); });
  g.node("z", ["a", "b"], zip(), manual);
  g.subscribe("s", "z");
  g.set("x", 1); // b: RESOLVED
  g.set("x", 2);
  assert.deepEqual(g.get("z").values, [["a1", "b2"]], "a1 waited for b's next value, as in TS and RxJS");
});

test("derived: every run needs every input, before the first run and after an INVALIDATE (the user's choice over TS)", () => {
  const g = createGraph();
  g.state("a", 1); g.state("b");
  const f = (a, b) => a + b;
  g.node("d", ["a", "b"], derived(f));
  g.subscribe("s", "d");
  g.invalidate("a"); // before the first run: a no longer counts as having a value (R-first-run-gate@2)
  assert.deepEqual(during(g, () => g.set("b", 2)), ["s <- d: [DIRTY, RESOLVED]"]);
  g.set("a", 1);
  assert.equal(g.get("d").value, 3);
  g.invalidate("a");
  // TS runs the function here with a missing (SENTINEL); derived waits instead.
  assert.deepEqual(during(g, () => g.set("b", 5)), ["s <- d: [DIRTY, RESOLVED]"]);
  assert.deepEqual(during(g, () => g.set("a", 10)), ["s <- d: [DIRTY, DATA(15)]"]);
});
