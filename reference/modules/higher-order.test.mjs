import test from "node:test";
import assert from "node:assert/strict";
import { createGraph, format } from "../kernel/kernel.mjs";
import { mergeMap, relay, switchMap } from "./higher-order.mjs";

const values = (g, sinkId) => g.trace.filter((e) => e.to === sinkId).flatMap((e) => e.msgs)
  .filter((m) => m[0] === "DATA").map((m) => m[1]);
const follow = (x) => ({ deps: [x], fn: relay });
const starts = (g, sinkId) => g.trace.filter((e) => e.to === sinkId && e.msgs[0][0] === "START").length;

// A controllable inner per projection, like TS's subject(): its ctx is kept so the test can
// send from it later.
function subjects() {
  const made = [];
  const def = () => {
    const s = { ctx: null, runs: 0 };
    made.push(s);
    return { deps: [], fn: (ctx) => { s.ctx = ctx; s.runs += 1; } };
  };
  return { made, def };
}

test("switchMap: cancels the in-flight inner on a new source value and forwards only the current one (TS)", () => {
  const g = createGraph();
  g.state("s"); g.state("a"); g.state("b");
  switchMap(g, "op", "s", (v) => follow(v === 1 ? "a" : "b"));
  g.subscribe("out", "op");
  g.set("s", 1);
  g.set("a", 10);
  assert.deepEqual(values(g, "out"), [10]);
  g.set("s", 2);
  assert.equal(g.get("a").active, false, "a is released");
  assert.equal(g.get("b").active, true);
  g.set("a", 99); // the superseded inner is drained
  g.set("b", 20);
  assert.deepEqual(values(g, "out"), [10, 20]);
});

test("switchMap: re-projecting the same live inner does not cancel or duplicate it (TS)", () => {
  const g = createGraph();
  g.state("s"); g.state("inner");
  const log = [];
  switchMap(g, "op", "s", () => follow("inner"));
  g.subscribe("out", "op");
  g.set("s", 1);
  g.subscribe("watch", "op/inner/0", (msgs) => log.push(msgs.map((m) => m[0]).join()));
  g.set("s", 2);
  assert.deepEqual(log, ["START"], "the inner was not restarted for s = 2");
  g.set("inner", 10);
  assert.deepEqual(values(g, "out"), [10]);
});

test("switchMap: the owner keeps its value across a switch with no seed: only the inner is replaced", () => {
  const g = createGraph();
  g.state("s"); g.state("a", 10); g.state("b");
  switchMap(g, "op", "s", (v) => follow(v === 1 ? "a" : "b"));
  g.subscribe("out", "op");
  g.set("s", 1);
  assert.equal(g.get("op").value, 10);
  g.set("s", 2); // b has no value yet
  assert.deepEqual(g.get("op"), { active: true, has: true, value: 10, values: [10], ended: null });
  assert.equal(g.describe().find((d) => d.id === "op/inner/0").deps[0], "b", "describe shows the live inner");
});

test("switchMap: a fresh computation per value: the old one's late output is dropped", async () => {
  const g = createGraph();
  g.state("s");
  const later = [];
  switchMap(g, "op", "s", (v) => ({ deps: [], fn: (ctx) => { later.push(() => ctx.down([["DATA", `r${v}`]])); } }));
  g.subscribe("out", "op");
  g.set("s", 1);
  g.set("s", 2);
  later[0](); // the answer for 1 arrives after the switch
  later[1]();
  assert.deepEqual(values(g, "out"), ["r2"]);
});

test("switchMap: COMPLETE once the source has completed and the inner has completed", () => {
  const g = createGraph();
  g.state("s"); g.state("a");
  switchMap(g, "op", "s", () => follow("a"));
  g.subscribe("out", "op");
  g.set("s", 1);
  g.complete("s");
  assert.equal(g.get("op").ended, null, "the inner is still live");
  g.complete("a");
  assert.deepEqual(g.get("op").ended, ["COMPLETE"]);
});

test("switchMap: a source completing with no inner completes at once", () => {
  const g = createGraph();
  g.state("s");
  switchMap(g, "op", "s", () => follow("x"));
  g.subscribe("out", "op");
  g.complete("s");
  assert.deepEqual(g.get("op").ended, ["COMPLETE"]);
});

test("switchMap: source ERROR, inner ERROR and a throwing projector each end the owner with ERROR, releasing the inner", () => {
  for (const [name, act, expected] of [
    ["source", (g) => g.error("s", "src boom"), "src boom"],
    ["inner", (g) => g.error("a", "inner boom"), "inner boom"],
    ["projector", (g) => g.set("s", 0), "project boom"],
  ]) {
    const g = createGraph();
    g.state("s"); g.state("a");
    switchMap(g, "op", "s", (v) => { if (v === 0) throw new Error("project boom"); return follow("a"); });
    g.subscribe("out", "op");
    g.set("s", 1);
    act(g);
    assert.deepEqual(g.get("op").ended, ["ERROR", expected], name);
    assert.equal(g.get("a").active, false, `${name}: the inner's dependency is released`);
  }
});

test("switchMap: a projection onto an ended node forwards its last value; the operator stays open (P5)", () => {
  const g = createGraph();
  g.state("s"); g.state("done", 1);
  g.complete("done");
  switchMap(g, "op", "s", () => follow("done"));
  g.subscribe("out", "op");
  g.set("s", 1);
  assert.deepEqual(values(g, "out"), [1]);
  assert.equal(g.get("op").ended, null, "the inner ended at once; the source is still open");
  g.complete("s");
  assert.deepEqual(g.get("op").ended, ["COMPLETE"]);
});

test("switchMap: a fresh activation starts with no inner, even after the inner ended", () => {
  const g = createGraph();
  g.state("s", 1); g.state("a", 5);
  switchMap(g, "op", "s", () => ({ deps: ["a"], fn: (ctx) => ctx.down([["DATA", ctx.deps[0].value], ["COMPLETE"]]) }));
  g.subscribe("out", "op");
  assert.deepEqual(g.get("op/inner/0").ended, ["COMPLETE"]);
  g.unsubscribe("out", "op");
  g.subscribe("again", "op");
  assert.deepEqual(values(g, "again"), [5]);
});

test("switchMap: re-projecting the same definition after its inner completed starts a fresh inner", () => {
  const g = createGraph();
  g.state("s");
  let runs = 0;
  const once = { deps: [], fn: (ctx) => { runs += 1; ctx.down([["DATA", runs], ["COMPLETE"]]); } };
  switchMap(g, "op", "s", () => once);
  g.subscribe("out", "op");
  g.set("s", 1);
  g.set("s", 2);
  assert.deepEqual(values(g, "out"), [1, 2]);
});

test("switchMap: several source values in one wave switch to the last one only", () => {
  const g = createGraph();
  g.state("s"); g.state("a", "A"); g.state("b", "B");
  const seen = [];
  switchMap(g, "op", "s", (v) => { seen.push(v); return follow(v); });
  g.subscribe("out", "op");
  g.batch(() => { g.set("s", "a"); g.set("s", "b"); });
  assert.deepEqual(seen, ["b"]);
  assert.deepEqual(values(g, "out"), ["B"]);
});

test("switchMap: a throwing projector keeps the inner values it forwarded in the same wave, then ERROR (TS D81)", () => {
  const g = createGraph();
  g.state("s", 1);
  // The inner follows s itself, so a write to s reaches the inner and the source in one wave.
  switchMap(g, "op", "s", (v) => { if (v === 2) throw new Error("project boom"); return follow("s"); });
  g.subscribe("out", "op");
  g.set("s", 2);
  const tail = g.trace.filter((e) => e.to === "out").map(format).at(-1);
  assert.equal(tail, 'out <- op: [DIRTY, ERROR("project boom")]');
  assert.deepEqual(values(g, "out"), [1, 2], "the inner's 2 was forwarded before the ERROR");
});

// ---- mergeMap ----------------------------------------------------------------

test("mergeMap: keeps all inners live and interleaves their emissions; a completed inner is released (TS)", () => {
  const g = createGraph();
  g.state("s"); g.state("a"); g.state("b");
  mergeMap(g, "op", "s", (v) => follow(v === 1 ? "a" : "b"));
  g.subscribe("out", "op");
  g.set("s", 1);
  g.set("s", 2);
  assert.equal(g.get("a").active, true);
  assert.equal(g.get("b").active, true);
  g.set("a", 10); g.set("b", 20); g.set("a", 11);
  assert.deepEqual(values(g, "out"), [10, 20, 11]);
  g.complete("a");
  assert.equal(g.get("a").active, false, "a is released when its inner ends");
  assert.equal(g.get("b").active, true);
  assert.deepEqual(g.describe().find((d) => d.id === "op").deps, ["s", "op/inner/1"], "the completed inner is removed");
  g.set("b", 21);
  assert.deepEqual(values(g, "out"), [10, 20, 11, 21]);
});

test("mergeMap: limits concurrency by queueing source values until an inner completes (TS)", () => {
  const g = createGraph();
  g.state("s");
  const { made, def } = subjects();
  mergeMap(g, "op", "s", def, { concurrent: 2 });
  g.subscribe("out", "op");
  g.batch(() => { g.set("s", 1); g.set("s", 2); g.set("s", 3); g.complete("s"); });
  assert.equal(made.length, 2, "the third value is not projected yet");
  assert.ok(made.every((s) => s.runs === 1));
  made[0].ctx.down([["DATA", 10]]);
  made[1].ctx.down([["DATA", 20]]);
  assert.deepEqual(values(g, "out"), [10, 20]);
  made[0].ctx.down([["COMPLETE"]]);
  assert.equal(made.length, 3);
  assert.equal(made[2].runs, 1);
  made[2].ctx.down([["DATA", 30]]);
  assert.deepEqual(values(g, "out"), [10, 20, 30]);
  assert.equal(g.get("op").ended, null);
  made[1].ctx.down([["COMPLETE"]]);
  made[2].ctx.down([["COMPLETE"]]);
  assert.deepEqual(g.get("op").ended, ["COMPLETE"]);
});

test("mergeMap: rejects a concurrency that is not a positive integer (TS)", () => {
  for (const concurrent of [0, 1.5, -1, NaN]) {
    assert.throws(() => mergeMap(createGraph(), "op", "s", follow, { concurrent }), RangeError, String(concurrent));
  }
});

test("mergeMap: an already live inner is merged once, and later removals stay aligned (TS)", () => {
  const g = createGraph();
  g.state("s"); g.state("x"); g.state("y");
  mergeMap(g, "op", "s", (v) => follow(v === 3 ? "y" : "x"));
  g.subscribe("out", "op");
  g.set("s", 1); g.set("s", 2); g.set("s", 3);
  g.set("x", 1);
  assert.deepEqual(values(g, "out"), [1], "x is followed once");
  g.complete("x");
  g.complete("y");
  assert.equal(g.get("x").active, false);
  assert.equal(g.get("y").active, false);
});

test("mergeMap: COMPLETE once the source is done and every inner has completed (TS)", () => {
  const g = createGraph();
  g.state("s"); g.state("a");
  mergeMap(g, "op", "s", () => follow("a"));
  g.subscribe("out", "op");
  g.set("s", 1);
  g.complete("s");
  assert.equal(g.get("op").ended, null, "inner a is still live");
  g.set("a", 9);
  g.complete("a");
  assert.deepEqual(values(g, "out"), [9]);
  assert.deepEqual(g.get("op").ended, ["COMPLETE"]);
});

test("mergeMap: source ERROR, inner ERROR and a throwing projector each end it with ERROR and release every inner (TS)", () => {
  for (const [name, act, expected] of [
    ["source", (g) => g.error("s", "src boom"), "src boom"],
    ["inner", (g) => g.error("a", "inner boom"), "inner boom"],
    ["projector", (g) => g.set("s", 0), "project boom"],
  ]) {
    const g = createGraph();
    g.state("s"); g.state("a"); g.state("b");
    mergeMap(g, "op", "s", (v) => { if (v === 0) throw new Error("project boom"); return follow(v === 1 ? "a" : "b"); });
    g.subscribe("out", "op");
    g.set("s", 1); g.set("s", 2);
    g.set("b", 20);
    act(g);
    assert.deepEqual(g.get("op").ended, ["ERROR", expected], name);
    assert.equal(g.get("a").active, false, `${name}: a is released`);
    assert.equal(g.get("b").active, false, `${name}: b is released`);
    const seen = g.trace.filter((e) => e.to === "out").length;
    if (name !== "source") g.set("s", 3);
    if (name !== "inner") g.set("a", 11);
    g.set("b", 21);
    assert.equal(g.trace.filter((e) => e.to === "out").length, seen, `${name}: nothing after the ERROR`);
  }
});

test("mergeMap: inner DATA in the same array as its ERROR is forwarded before the ERROR (TS)", () => {
  const g = createGraph();
  g.state("s");
  const { made, def } = subjects();
  mergeMap(g, "op", "s", def);
  g.subscribe("out", "op");
  g.set("s", 1);
  made[0].ctx.down([["DATA", 10], ["ERROR", "inner boom"]]);
  assert.deepEqual(values(g, "out"), [10]);
  assert.deepEqual(g.get("op").ended, ["ERROR", "inner boom"]);
});

test("mergeMap: re-projecting a node that has ended gives an inner that ends at once (TS skips it)", () => {
  const g = createGraph();
  g.state("s"); g.state("inner");
  mergeMap(g, "op", "s", () => follow("inner"), { concurrent: 1 });
  g.subscribe("out", "op");
  g.batch(() => { g.set("s", 1); g.set("s", 2); g.complete("s"); });
  g.complete("inner"); // frees the slot; the queued 2 projects onto the ended inner, which ends at once
  assert.deepEqual(g.get("op").ended, ["COMPLETE"]);
});

test("mergeMap: the operator keeps its value and its one START while inners are added (rewire keeps the instance)", () => {
  const g = createGraph();
  g.state("s"); g.state("a", 10); g.state("b");
  mergeMap(g, "op", "s", (v) => follow(v));
  g.subscribe("out", "op");
  g.set("s", "a");
  assert.equal(g.get("op").value, 10);
  g.set("s", "b"); // b has no value yet
  assert.deepEqual(g.get("op"), { active: true, has: true, value: 10, values: [10], ended: null });
  assert.equal(starts(g, "out"), 1);
  assert.deepEqual(g.describe().find((d) => d.id === "op").deps, ["s", "op/inner/0", "op/inner/1"]);
});

test("mergeMap: adding an inner does not resend the live inners' values or reproject the source's", () => {
  const g = createGraph();
  g.state("s"); g.state("a", 1); g.state("b", 2); g.state("c", 3);
  const seen = [];
  mergeMap(g, "op", "s", (v) => { seen.push(v); return follow(v); });
  g.subscribe("out", "op");
  g.set("s", "a"); g.set("s", "b"); g.set("s", "c");
  assert.deepEqual(values(g, "out"), [1, 2, 3]);
  assert.deepEqual(seen, ["a", "b", "c"]);
});

test("mergeMap: inners added in one wave each pass on their value", () => {
  const g = createGraph();
  g.state("s"); g.state("a", "A"); g.state("b", "B"); g.state("c", "C");
  mergeMap(g, "op", "s", (v) => follow(v));
  g.subscribe("out", "op");
  g.batch(() => { g.set("s", "a"); g.set("s", "b"); g.set("s", "c"); });
  assert.deepEqual(values(g, "out"), ["A", "B", "C"]);
});

test("mergeMap: an inner that sends several values as it activates passes them all on, as TS (K3)", () => {
  const g = createGraph();
  g.state("s");
  mergeMap(g, "op", "s", (v) => ({ deps: [], fn: (ctx) => ctx.down([["DATA", v], ["DATA", v + 1]]) }));
  g.subscribe("out", "op");
  g.set("s", 1);
  assert.deepEqual(values(g, "out"), [1, 2], "TS's [v, v + 1] inner gives 1, 2");
});

test("mergeMap: an inner that completes as it activates is done at once", () => {
  const g = createGraph();
  g.state("s");
  mergeMap(g, "op", "s", (v) => ({ deps: [], fn: (ctx) => ctx.down([["DATA", v], ["COMPLETE"]]) }));
  g.subscribe("out", "op");
  g.set("s", 1); g.set("s", 2);
  g.complete("s");
  assert.deepEqual(values(g, "out"), [1, 2]);
  assert.deepEqual(g.get("op").ended, ["COMPLETE"]);
});

test("mergeMap: a source value that arrives while an inner is being added is added after it", () => {
  const g = createGraph();
  g.state("s");
  // Subscribed before the operator, so its write is queued ahead of the operator's rewire.
  g.subscribe("early", "s", (msgs) => { if (msgs.some((m) => m[1] === 1)) g.set("s", 2); });
  mergeMap(g, "op", "s", (v) => ({ deps: [], fn: (ctx) => ctx.down([["DATA", v], ["COMPLETE"]]) }));
  g.subscribe("out", "op");
  g.set("s", 1);
  g.complete("s");
  assert.deepEqual(values(g, "out"), [1, 2], "the inner for 1 ended before the inner for 2 was added");
  assert.deepEqual(g.get("op").ended, ["COMPLETE"]);
});

test("mergeMap: a completed inner is removed, and its node reused", () => {
  const g = createGraph();
  g.state("s");
  const { made, def } = subjects();
  mergeMap(g, "op", "s", def);
  g.subscribe("out", "op");
  for (let v = 1; v <= 4; v += 1) {
    g.set("s", v);
    made.at(-1).ctx.down([["DATA", v], ["COMPLETE"]]);
  }
  assert.deepEqual(values(g, "out"), [1, 2, 3, 4]);
  const inners = g.describe().filter((d) => d.id.startsWith("op/inner/")).map((d) => d.id);
  assert.deepEqual(inners, ["op/inner/0"]);
});

test("mergeMap: a fresh activation starts with no inner", () => {
  const g = createGraph();
  g.state("s", "a"); g.state("a", 1); g.state("b", 2);
  mergeMap(g, "op", "s", (v) => follow(v));
  g.subscribe("out", "op");
  g.set("s", "b");
  assert.deepEqual(values(g, "out"), [1, 2]);
  g.unsubscribe("out", "op");
  assert.equal(g.get("a").active, false);
  g.set("s", "a");
  g.subscribe("again", "op");
  assert.deepEqual(values(g, "again"), [1], "only the source's current value is projected");
  assert.equal(g.get("b").active, false);
});

test("mergeMap: a throwing projector keeps the inner values forwarded in the same wave, then ERROR (TS D81)", () => {
  const g = createGraph();
  g.state("s", 1);
  mergeMap(g, "op", "s", (v) => { if (v === 2) throw new Error("project boom"); return follow("s"); });
  g.subscribe("out", "op");
  g.set("s", 2);
  assert.deepEqual(values(g, "out"), [1, 2]);
  assert.deepEqual(g.get("op").ended, ["ERROR", "project boom"]);
});

test("mergeMap: an inner that completes in the wave of a new source value hands its node to the new inner", () => {
  const g = createGraph();
  g.state("s"); g.state("t");
  // Each inner passes on its value, then completes on t's next value.
  mergeMap(g, "op", "s", (v) => ({ deps: ["t"], fn: (ctx) => ctx.down(ctx.deps[0].waves.length && ctx.state.get() ? [["COMPLETE"]] : (ctx.state.set(true), [["DATA", v]])) }));
  g.subscribe("out", "op");
  g.set("s", 1);
  g.batch(() => { g.set("t", 0); g.set("s", 2); });
  assert.deepEqual(values(g, "out"), [1, 2]);
  assert.deepEqual(g.describe().find((d) => d.id === "op").deps, ["s", "op/inner/0"]);
  g.complete("s");
  g.set("t", 1);
  assert.deepEqual(g.get("op").ended, ["COMPLETE"]);
});
