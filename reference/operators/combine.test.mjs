// What the canonical traces (operators/traces.jsonl, run by traces.test.mjs) cannot say about the
// combine operators and derived, because a trace only builds well-formed graphs with recipes: what
// is refused when an operator is built or its recipe is, and which operators carry a recipe.

import test from "node:test";
import assert from "node:assert/strict";
import { createGraph } from "../kernel/kernel.mjs";
import { capture, restore } from "../modules/checkpoint.mjs";
import { combineRecipes, concat, merge, race, withLatestFrom, zip } from "./combine.mjs";
import { derived, stateRecipes } from "./state.mjs";

const pair = (a, b) => [a, b];
const recipe = { ref: "app.pair", config: null };
const graph = (options) => { const g = createGraph(options); g.state("a"); g.state("b"); return g; };

test("the combine operators always carry a recipe; derived carries one when it is given one for its function", () => {
  const g = graph({ requireRecipe: true });
  merge(g, "m", ["a", "b"]); withLatestFrom(g, "w", "a", ["b"]); zip(g, "z", ["a", "b"]); concat(g, "c", ["a", "b"]); race(g, "r", ["a", "b"]); derived(g, "d", ["a", "b"], pair, { recipe });
  assert.deepEqual(["m", "w", "z", "c", "r", "d"].map((id) => g.definition(id).recipe), [
    { ref: "operators.merge", config: null }, { ref: "operators.withLatestFrom", config: null }, { ref: "operators.zip", config: null },
    { ref: "operators.concat", config: { sources: ["a", "b"] } }, { ref: "operators.race", config: null }, { ref: "operators.derived", config: { f: recipe } },
  ]);
  assert.deepEqual(g.definition("c").deps, ["a"], "concat declares its first source alone");
  assert.deepEqual(Object.keys({ ...combineRecipes, ...stateRecipes }).sort(),
    ["operators.concat", "operators.derived", "operators.merge", "operators.race", "operators.withLatestFrom", "operators.zip"]);
  assert.throws(() => derived(g, "bare", ["a"], pair), /recipe/, "a function without a recipe makes the node local-only, which this graph refuses");
});

test("an empty or malformed list of inputs is refused when the operator is built, and by concat's recipe", () => {
  for (const build of [(g, ids) => merge(g, "x", ids), (g, ids) => zip(g, "x", ids), (g, ids) => concat(g, "x", ids), (g, ids) => race(g, "x", ids), (g, ids) => withLatestFrom(g, "x", "a", ids)]) {
    for (const bad of [[], undefined, "a", [""], [7]]) {
      const g = graph();
      assert.throws(() => build(g, bad), RangeError, JSON.stringify(bad));
      assert.deepEqual(g.describe().map((node) => node.id), ["a", "b"], "nothing was built");
    }
  }
  assert.throws(() => derived(graph(), "x", [], pair, { recipe }), RangeError);
  for (const bad of [null, {}, { sources: [] }, { sources: "a" }]) assert.throws(() => combineRecipes["operators.concat"](bad), RangeError, JSON.stringify(bad));
  assert.equal(typeof combineRecipes["operators.concat"]({ sources: ["a"] }), "function");
});

test("derived without a recipe for its function is local-only; a recipe no restore could use, or a factory that gives a setup, is refused", () => {
  const g = graph();
  derived(g, "d", ["a", "b"], pair);
  g.subscribe("k", "d");
  assert.throws(() => capture(g), /d/, "capture names the node it cannot save");
  for (const bad of [{}, { ref: "" }, null, "app.pair"]) assert.throws(() => derived(graph(), "x", ["a"], pair, { recipe: bad }), /a callback's recipe is \{ ref, config \} with a non-empty ref/);
  assert.throws(() => stateRecipes["operators.derived"]({ f: recipe }, { make: () => ({ fn: pair, setup: () => {} }) }), /gives a function alone/);
  assert.throws(() => stateRecipes["operators.derived"](null, { make: () => ({ fn: pair }) }), /a callback's recipe is/);
});

test("an input given twice is refused when the operator is built, and a concat source that does not exist is too", () => {
  for (const build of [(g) => merge(g, "x", ["a", "a"]), (g) => zip(g, "x", ["a", "b", "a"]), (g) => race(g, "x", ["a", "a"]), (g) => concat(g, "x", ["a", "b", "a"]),
    (g) => withLatestFrom(g, "x", "a", ["b", "b"]), (g) => withLatestFrom(g, "x", "a", ["a"]), (g) => derived(g, "x", ["a", "a"], pair, { recipe })]) {
    const g = graph();
    assert.throws(() => build(g), /distinct nodes/);
    assert.deepEqual(g.describe().map((node) => node.id), ["a", "b"], "nothing was built");
  }
  assert.throws(() => concat(graph(), "x", ["a", "nope"]), /concat x: nope does not exist/);
  assert.throws(() => derived(graph(), "x", ["a"], 0, { recipe }), /f is a function/);
});

test("a concat whose saved position is not the source it depends on ends with an ERROR instead of waiting for good", () => {
  const g = graph();
  concat(g, "x", ["a", "b"]);
  g.subscribe("k", "x");
  const checkpoint = JSON.parse(JSON.stringify(capture(g)).replace('"index":0', '"index":1'));
  assert.notDeepEqual(checkpoint, JSON.parse(JSON.stringify(capture(g))), "the checkpoint holds the position");
  const r = restore(checkpoint, combineRecipes);
  r.subscribe("k", "x");
  r.set("a", 1);
  assert.deepEqual(r.trace.at(-1).msgs, [["PENDING"], ["ERROR", "concat: its saved position is not the source it depends on"]]);
});
