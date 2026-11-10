import test from "node:test";
import assert from "node:assert/strict";
import { createGraph, format } from "../kernel/kernel.mjs";
import { history, historyOpts, historyRecipe } from "./history.mjs";
import { recipes, restore } from "./checkpoint.mjs";

function during(g, body) {
  const start = g.trace.length;
  body();
  return g.trace.slice(start).map(format);
}

test("history: a late subscriber gets the source's last n waves, oldest first (TS's replayBuffer test)", () => {
  const g = createGraph();
  g.state("s");
  history(g, "h", "s", 3);
  g.subscribe("k", "h");
  for (const v of [1, 2, 3, 4]) g.set("s", v);
  assert.deepEqual(during(g, () => g.subscribe("late", "h")), ["late <- h: [START, DATA([[[2]],[[3]],[[4]]])]"]);
});

test("history: equal values are occurrences; an array keeps its values together", () => {
  const g = createGraph();
  g.state("s");
  history(g, "h", "s", 4);
  g.subscribe("k", "h");
  g.set("s", 7); g.set("s", 7);
  g.batch(() => { g.set("s", 8); g.set("s", 9); });
  assert.deepEqual(g.get("h").value, [[[7]], [[7]], [[8, 9]]], "a batch's two writes are one wave of one array");
});

test("history: a dependent gets the list like any value", () => {
  const g = createGraph();
  g.state("s");
  history(g, "h", "s", 2);
  g.subscribe("k", "h");
  g.set("s", 1); g.set("s", 2); g.set("s", 3);
  const seen = [];
  g.node("d", ["h"], (ctx) => { seen.push(ctx.deps[0].value); });
  g.subscribe("kd", "d");
  assert.deepEqual(seen, [[[[2]], [[3]]]]);
});

test("history: a RESOLVED array is not recorded, and a wave without values sends nothing", () => {
  const g = createGraph();
  g.state("s");
  g.node("f", ["s"], (ctx) => { if (ctx.deps[0].value % 2 === 0) ctx.down([["DATA", ctx.deps[0].value]]); });
  history(g, "h", "f", 3);
  g.subscribe("k", "h");
  g.set("s", 2);
  assert.deepEqual(during(g, () => g.set("s", 3)), ["k <- h: [DIRTY, RESOLVED]"]);
  assert.deepEqual(g.get("h").value, [[[2]]]);
});

test("history: an INVALIDATE clears the list (TS BH6), and deactivation drops it", () => {
  const g = createGraph();
  g.state("s");
  history(g, "h", "s", 3);
  g.subscribe("k", "h");
  g.set("s", 1); g.set("s", 2);
  g.invalidate("s");
  assert.deepEqual(during(g, () => g.subscribe("late", "h")), ["late <- h: [START]"], "no stale history");
  g.set("s", 3);
  assert.deepEqual(g.get("h").value, [[[3]]]);
  g.unsubscribe("k", "h"); g.unsubscribe("late", "h");
  g.set("s", 4);
  g.subscribe("k", "h");
  assert.deepEqual(g.get("h").value, [[[4]]], "a new activation starts from the source's last array");
});

test("history: the source's end ends it; a new subscriber gets the list and the terminal (P5)", () => {
  const g = createGraph();
  g.state("s");
  history(g, "h", "s", 3);
  g.subscribe("k", "h");
  g.set("s", 1); g.set("s", 2);
  g.complete("s");
  assert.deepEqual(during(g, () => g.subscribe("late", "h")), ["late <- h: [START, DATA([[[1]],[[2]]]), COMPLETE]"]);
});

test("history: n counts waves; an entry keeps how its wave was split into arrays", () => {
  const g = createGraph();
  g.state("s", [1]);
  // x sends one array per value, so a write of [2, 3] makes two arrays in one wave.
  g.node("x", ["s"], (ctx) => { for (const v of ctx.deps[0].value) ctx.down([["DATA", v]]); });
  history(g, "h", "x", 2);
  g.subscribe("k", "h");
  assert.deepEqual(g.get("h").value, [[[1]]], "activation: one wave of one array");
  assert.deepEqual(during(g, () => g.set("s", [2, 3])), ["k <- h: [DIRTY, DATA([[[1]],[[2],[3]]])]"],
    "two arrays in one wave are one entry, and the list is sent once");
  g.set("s", [4]);
  assert.deepEqual(g.get("h").value, [[[2], [3]], [[4]]], "n = 2 keeps two waves, not two arrays");
  // y sends both values in one array.
  g.node("y", ["s"], (ctx) => { ctx.down(ctx.deps[0].value.map((v) => ["DATA", v])); });
  history(g, "hy", "y", 2);
  g.subscribe("ky", "hy");
  g.set("s", [5, 6]);
  assert.deepEqual(g.get("hy").value, [[[4]], [[5, 6]]], "one array with two values stays one array");
});

test("history: n must be a positive integer", () => {
  const g = createGraph();
  g.state("s");
  assert.throws(() => history(g, "h", "s", 0), RangeError);
  assert.throws(() => history(g, "h", "s", 1.5), RangeError);
});

test("history: built from its recipe, checkpoint saves the list and restore brings it back", () => {
  const reg = { history: historyRecipe };
  const b = recipes(createGraph(), reg);
  b.state("s");
  b.node("h", ["s"], "history", { n: 3 }, historyOpts);
  b.g.subscribe("k", "h");
  for (const v of [1, 2, 3, 4]) b.g.set("s", v);
  const r = restore(JSON.parse(JSON.stringify(b.capture())), reg);
  assert.deepEqual(during(r.g, () => r.g.subscribe("k", "h")), ["k <- h: [START, DATA([[[2]],[[3]],[[4]]])]"]);
  r.g.set("s", 5);
  assert.deepEqual(r.g.get("h").value, [[[3]], [[4]], [[5]]], "the list went on from its saved private state");
});
