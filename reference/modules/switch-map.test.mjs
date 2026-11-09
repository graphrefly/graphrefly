import test from "node:test";
import assert from "node:assert/strict";
import { createGraph, format } from "../kernel/kernel.mjs";
import { relay, switchMap } from "./switch-map.mjs";

const values = (g, sinkId) => g.trace.filter((e) => e.to === sinkId).flatMap((e) => e.msgs)
  .filter((m) => m[0] === "DATA").map((m) => m[1]);
const follow = (x) => ({ deps: [x], fn: relay });

test("cancels the in-flight inner on a new source value and forwards only the current one (TS)", () => {
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

test("re-projecting the same live inner does not cancel or duplicate it (TS)", () => {
  const g = createGraph();
  g.state("s"); g.state("inner");
  const log = [];
  switchMap(g, "op", "s", () => follow("inner"));
  g.subscribe("out", "op");
  g.subscribe("watch", "op/inner", (msgs) => log.push(msgs.map((m) => m[0]).join()));
  g.set("s", 1);
  g.set("s", 2);
  assert.deepEqual(log, ["START", "START"], "one replace only: the inner was not restarted for s = 2");
  g.set("inner", 10);
  assert.deepEqual(values(g, "out"), [10]);
});

test("the owner keeps its value across a switch with no seed: only the inner is replaced", () => {
  const g = createGraph();
  g.state("s"); g.state("a", 10); g.state("b");
  switchMap(g, "op", "s", (v) => follow(v === 1 ? "a" : "b"));
  g.subscribe("out", "op");
  g.set("s", 1);
  assert.equal(g.get("op").value, 10);
  g.set("s", 2); // b has no value yet
  assert.deepEqual(g.get("op"), { active: true, has: true, value: 10, ended: null });
  assert.equal(g.describe().find((d) => d.id === "op/inner").deps[0], "b", "describe shows the live inner");
});

test("a fresh computation per value: the old one's late output is dropped", async () => {
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

test("COMPLETE once the source has completed and the inner has completed", () => {
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

test("a source completing with no inner completes at once", () => {
  const g = createGraph();
  g.state("s");
  switchMap(g, "op", "s", () => follow("x"));
  g.subscribe("out", "op");
  g.complete("s");
  assert.deepEqual(g.get("op").ended, ["COMPLETE"]);
});

test("source ERROR, inner ERROR and a throwing projector each end the owner with ERROR, releasing the inner", () => {
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

test("a projection onto an ended node is an ERROR, not a wait", () => {
  const g = createGraph();
  g.state("s"); g.state("done", 1);
  g.complete("done");
  switchMap(g, "op", "s", () => follow("done"));
  g.subscribe("out", "op");
  g.set("s", 1);
  assert.deepEqual(g.get("op").ended, ["ERROR", "op: cannot follow done, which has ended"]);
});

test("a fresh activation starts with no inner, even after the inner ended", () => {
  const g = createGraph();
  g.state("s", 1); g.state("a", 5);
  switchMap(g, "op", "s", () => ({ deps: ["a"], fn: (ctx) => ctx.down([["DATA", ctx.deps[0].value], ["COMPLETE"]]) }));
  g.subscribe("out", "op");
  assert.deepEqual(g.get("op/inner").ended, ["COMPLETE"]);
  g.unsubscribe("out", "op");
  g.subscribe("again", "op");
  assert.deepEqual(values(g, "again"), [5]);
});

test("re-projecting the same definition after its inner completed starts a fresh inner", () => {
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

test("several source values in one wave switch to the last one only", () => {
  const g = createGraph();
  g.state("s"); g.state("a", "A"); g.state("b", "B");
  const seen = [];
  switchMap(g, "op", "s", (v) => { seen.push(v); return follow(v); });
  g.subscribe("out", "op");
  g.batch(() => { g.set("s", "a"); g.set("s", "b"); });
  assert.deepEqual(seen, ["b"]);
  assert.deepEqual(values(g, "out"), ["B"]);
});

test("a throwing projector keeps the inner values it forwarded in the same wave, then ERROR (TS D81)", () => {
  const g = createGraph();
  g.state("s", 1);
  // The inner follows s itself, so a write to s reaches the inner and the source in one wave.
  switchMap(g, "op", "s", (v) => { if (v === 2) throw new Error("project boom"); return follow("s"); });
  g.subscribe("out", "op");
  g.set("s", 2);
  const tail = g.trace.filter((e) => e.to === "out").map(format).at(-1);
  assert.equal(tail, 'out <- op: [ERROR("project boom")]');
  assert.deepEqual(values(g, "out"), [1, 2], "the inner's 2 was forwarded before the ERROR");
});
