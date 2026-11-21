// What the canonical traces (operators/traces.jsonl, run by traces.test.mjs) cannot say about map,
// filter, tap, scan and reduce, because a trace only builds well-formed graphs with recipes: that
// a seed is required where the operator is built and where its recipe is, that an operator given
// a callback without a recipe is local-only, and that a callback's recipe no restore could use is
// refused when the operator is built.

import test from "node:test";
import assert from "node:assert/strict";
import { createGraph } from "../kernel/kernel.mjs";
import { capture } from "../modules/checkpoint.mjs";
import { filter, map, tap, transformRecipes } from "./transform.mjs";
import { accumulateRecipes, reduce, scan } from "./accumulate.mjs";

const double = (v) => v * 2;
const sum = (acc, v) => acc + v;
const recipe = { ref: "app.callback", config: null };
const at = { make: () => ({ fn: sum }) };

test("scan and reduce refuse to be built without a seed, and their recipes refuse a configuration without one", () => {
  const g = createGraph();
  g.state("s");
  assert.throws(() => scan(g, "a", "s", sum), /scan a: a seed is required/);
  assert.throws(() => reduce(g, "r", "s", sum), /reduce r: a seed is required/);
  assert.deepEqual(g.describe().map((n) => n.id), ["s"], "nothing was built");
  for (const [ref, name] of [["operators.scan", "scan"], ["operators.reduce", "reduce"]]) {
    assert.throws(() => accumulateRecipes[ref]({ f: recipe }, at), new RegExp(`${name}: a seed is required`));
    assert.throws(() => accumulateRecipes[ref](null, at), new RegExp(`${name}: a seed is required`));
    assert.equal(typeof accumulateRecipes[ref]({ f: recipe, seed: 0 }, at), "function", "a seed of 0 is a seed");
  }
});

test("given a recipe for its callback each operator carries its own, which holds the seed; a graph that requires recipes accepts them", () => {
  const g = createGraph({ requireRecipe: true });
  g.state("s");
  map(g, "m", "s", double, { recipe }); filter(g, "f", "s", double, { recipe }); tap(g, "t", "s", double, { recipe });
  scan(g, "a", "s", sum, 0, { recipe }); reduce(g, "r", "s", sum, [], { recipe });
  assert.deepEqual(["m", "f", "t", "a", "r"].map((id) => g.definition(id).recipe), [
    { ref: "operators.map", config: { f: recipe } }, { ref: "operators.filter", config: { p: recipe } }, { ref: "operators.tap", config: { f: recipe } },
    { ref: "operators.scan", config: { f: recipe, seed: 0 } }, { ref: "operators.reduce", config: { f: recipe, seed: [] } },
  ]);
  assert.deepEqual(Object.keys({ ...transformRecipes, ...accumulateRecipes }).sort(),
    ["operators.filter", "operators.map", "operators.reduce", "operators.scan", "operators.tap"]);
  assert.throws(() => map(g, "bare", "s", double), /recipe/, "without a recipe the graph refuses the node");
});

test("without a recipe for its callback an operator is local-only: the graph works and cannot be captured", () => {
  for (const build of [(g) => map(g, "x", "s", double), (g) => filter(g, "x", "s", double), (g) => tap(g, "x", "s", double),
    (g) => scan(g, "x", "s", sum, 0), (g) => reduce(g, "x", "s", sum, 0)]) {
    const g = createGraph();
    g.state("s", 1);
    build(g);
    g.subscribe("k", "x");
    assert.throws(() => capture(g), /x/, "capture names the node it cannot save");
  }
});

test("a callback's recipe that no restore could use is refused when the operator is built, and a factory that gives a setup is refused at restore", () => {
  const builders = [(g, r) => map(g, "x", "s", double, { recipe: r }), (g, r) => filter(g, "x", "s", double, { recipe: r }), (g, r) => tap(g, "x", "s", double, { recipe: r }),
    (g, r) => scan(g, "x", "s", sum, 0, { recipe: r }), (g, r) => reduce(g, "x", "s", sum, 0, { recipe: r })];
  for (const bad of [{}, { ref: "" }, { ref: 7 }, "app.callback", true, null]) {
    for (const build of builders) {
      const g = createGraph();
      g.state("s");
      assert.throws(() => build(g, bad), /a callback's recipe is \{ ref, config \} with a non-empty ref/, JSON.stringify(bad));
      assert.deepEqual(g.describe().map((n) => n.id), ["s"], "nothing was built");
    }
  }
  const withSetup = { make: () => ({ fn: sum, setup: () => {} }) };
  for (const [ref, config] of [["operators.map", { f: recipe }], ["operators.filter", { p: recipe }], ["operators.tap", { f: recipe }]]) {
    assert.throws(() => transformRecipes[ref](config, withSetup), /gives a function alone/);
    assert.throws(() => transformRecipes[ref](null, at), /a callback's recipe is/);
  }
  for (const ref of ["operators.scan", "operators.reduce"]) {
    assert.throws(() => accumulateRecipes[ref]({ f: recipe, seed: 0 }, withSetup), /gives a function alone/);
    assert.throws(() => accumulateRecipes[ref]({ seed: 0 }, at), /a callback's recipe is/);
  }
});

test("scan and reduce end with ERROR when the reducer returns no value, in the wave it does", () => {
  for (const build of [scan, reduce]) {
    const g = createGraph();
    g.state("s");
    build(g, "x", "s", (acc, v) => (v === 2 ? undefined : acc + v), 0);
    g.subscribe("k", "x");
    g.set("s", 1); g.set("s", 2);
    assert.deepEqual(g.trace.at(-1).msgs, [["PENDING"], ["ERROR", "the reducer returned no value"]]);
  }
});

test("a callback that is not a function is refused when the operator is built", () => {
  for (const build of [(g) => map(g, "x", "s", 0, { recipe }), (g) => filter(g, "x", "s", "even", { recipe }), (g) => tap(g, "x", "s", undefined, { recipe }),
    (g) => scan(g, "x", "s", null, 0, { recipe }), (g) => reduce(g, "x", "s", {}, 0, { recipe })]) {
    const g = createGraph();
    g.state("s");
    assert.throws(() => build(g), /is a function/);
    assert.deepEqual(g.describe().map((n) => n.id), ["s"], "nothing was built");
  }
});
