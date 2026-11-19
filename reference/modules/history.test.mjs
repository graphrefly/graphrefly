import test from "node:test";
import assert from "node:assert/strict";
import { createGraph, format } from "../kernel/kernel.mjs";
import { history, historyRecipes } from "./history.mjs";
import { capture, restore } from "./checkpoint.mjs";

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
  assert.deepEqual(during(g, () => g.set("s", 3)), ["k <- h: [PENDING, RESOLVED]"]);
  assert.deepEqual(g.get("h").value, [[[2]]]);
});

// D812 (3), decided by the user 2026-11-18: history has the auto INVALIDATE policy, like buffer,
// pairwise and scan, which keep what they have seen. Until then an INVALIDATE cleared the list.
test("history: an INVALIDATE removes its value and keeps the list; deactivation drops it", () => {
  const g = createGraph();
  g.state("s");
  history(g, "h", "s", 3);
  g.subscribe("k", "h");
  g.set("s", 1); g.set("s", 2);
  g.invalidate("s");
  assert.deepEqual(during(g, () => g.subscribe("late", "h")), ["late <- h: [START]"], "no value to read in the gap");
  assert.deepEqual(during(g, () => g.set("s", 3)).filter((l) => l.startsWith("late <-")),
    ["late <- h: [PENDING, DATA([[[1]],[[2]],[[3]]])]"], "the next DATA sends the list with its earlier entries");
  g.unsubscribe("k", "h"); g.unsubscribe("late", "h");
  g.set("s", 4);
  g.subscribe("k", "h");
  assert.deepEqual(g.get("h").value, [[[4]]], "a new activation starts from the source's last array");
});

test("history: arrays before an INVALIDATE in the same wave are not part of that wave's entry", () => {
  const g = createGraph();
  g.state("t");
  // x sends, in one run, [a], INVALIDATE, [b].
  g.node("x", ["t"], (ctx) => {
    const v = ctx.deps[0].waves.flat().at(-1);
    if (v === "go") { ctx.down([["DATA", "a"]]); ctx.down([["INVALIDATE"]]); ctx.down([["DATA", "b"]]); }
    else if (v !== undefined) ctx.down([["DATA", v]]);
  });
  history(g, "h", "x", 5);
  g.subscribe("k", "h");
  g.set("t", "v1");
  assert.deepEqual(during(g, () => g.set("t", "go")).filter((l) => l.startsWith("k <-")),
    ["k <- h: [PENDING, INVALIDATE]", 'k <- h: [PENDING, DATA([[["v1"]],[["b"]]])]']);
});

// R-history@1: "a wave left with no array is not an entry and sends no list" (second QA, 2026-11-19).
test("history: a wave whose only value comes before an INVALIDATE is not an entry and sends no list", () => {
  const g = createGraph();
  g.state("a", 1);
  history(g, "h", "a", 5);
  g.subscribe("k", "h");
  assert.deepEqual(during(g, () => g.batch(() => { g.set("a", 7); g.invalidate("a"); })).filter((l) => l.startsWith("k <-")),
    ["k <- h: [PENDING, INVALIDATE]"]);
  assert.deepEqual(during(g, () => g.set("a", 8)).filter((l) => l.startsWith("k <-")),
    ["k <- h: [PENDING, DATA([[[1]],[[8]]])]"]);
});

// R-history@1 (the user, 2026-11-19): the auto ERROR policy ends the node without a run.
test("history: a wave that carries DATA and the source's ERROR ends it with no list for that wave", () => {
  const g = createGraph();
  g.state("a", 1);
  history(g, "h", "a", 5);
  g.subscribe("k", "h");
  assert.deepEqual(during(g, () => g.batch(() => { g.set("a", 5); g.error("a", "E"); })).filter((l) => l.startsWith("k <-")),
    ['k <- h: [PENDING, ERROR("E")]']);
  assert.deepEqual([g.get("h").value, g.get("h").ended], [[[[1]]], ["ERROR", "E"]]);
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
  assert.deepEqual(during(g, () => g.set("s", [2, 3])), ["k <- h: [PENDING, DATA([[[1]],[[2],[3]]])]"],
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

test("history: it carries its recipe, so checkpoint saves the list and restore brings it back", () => {
  const g = createGraph();
  g.state("s");
  history(g, "h", "s", 3);
  assert.deepEqual(g.definition("h").recipe, { ref: "history", config: { n: 3 } });
  g.subscribe("k", "h");
  for (const v of [1, 2, 3, 4]) g.set("s", v);
  const r = restore(JSON.parse(JSON.stringify(capture(g))), historyRecipes);
  assert.equal(r.definition("h").opts.invalidate, "auto", "it has the default INVALIDATE policy");
  assert.deepEqual(during(r, () => r.subscribe("k", "h")), ["k <- h: [START, DATA([[[2]],[[3]],[[4]]])]"]);
  r.set("s", 5);
  assert.deepEqual(r.get("h").value, [[[3]], [[4]], [[5]]], "the list went on from its saved private state");
});
