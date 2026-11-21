// What the canonical traces (operators/traces.jsonl, run by traces.test.mjs) cannot say about the
// compare and select operators, because a trace only builds well-formed graphs with recipes: that
// a bad n is refused where the operator is built and where its recipe is, which operators carry a
// recipe, and that a callback's recipe no restore could use is refused when the operator is built.

import test from "node:test";
import assert from "node:assert/strict";
import { createGraph } from "../kernel/kernel.mjs";
import { capture } from "../modules/checkpoint.mjs";
import { compareRecipes, distinctUntilChanged, pairwise } from "./compare.mjs";
import { first, last, selectRecipes, skip, take, takeWhile } from "./select.mjs";

const even = (v) => v % 2 === 0;
const recipe = { ref: "app.callback", config: null };
const at = { make: () => ({ fn: even }) };
const graph = (options) => { const g = createGraph(options); g.state("s"); return g; };

test("take and skip refuse an n that is not a nonnegative integer, when built and when their recipe is; 0 is allowed", () => {
  for (const [build, ref] of [[take, "operators.take"], [skip, "operators.skip"]]) {
    for (const n of [-1, 1.5, "2", undefined, null, Infinity, NaN]) {
      const g = graph();
      assert.throws(() => build(g, "x", "s", n), RangeError, `built with ${String(n)}`);
      assert.deepEqual(g.describe().map((node) => node.id), ["s"], "nothing was built");
      assert.throws(() => selectRecipes[ref]({ n }), RangeError, `recipe with ${String(n)}`);
    }
    assert.throws(() => selectRecipes[ref](null), RangeError);
    assert.equal(typeof selectRecipes[ref]({ n: 0 }), "function");
    build(graph(), "x", "s", 0);
  }
});

test("each operator carries a recipe when it can be restored: always without a callback, and with one when a recipe for it is given", () => {
  const g = graph({ requireRecipe: true });
  take(g, "t", "s", 2); skip(g, "k", "s", 1); pairwise(g, "pw", "s"); distinctUntilChanged(g, "d", "s"); first(g, "f", "s"); last(g, "l", "s");
  distinctUntilChanged(g, "d2", "s", { equal: Object.is, recipe }); takeWhile(g, "w", "s", even, { recipe }); first(g, "f2", "s", { p: even, recipe }); last(g, "l2", "s", { p: even, recipe });
  assert.deepEqual(["t", "k", "pw", "d", "f", "l", "d2", "w", "f2", "l2"].map((id) => g.definition(id).recipe), [
    { ref: "operators.take", config: { n: 2 } }, { ref: "operators.skip", config: { n: 1 } }, { ref: "operators.pairwise", config: null },
    { ref: "operators.distinctUntilChanged", config: { equal: null } }, { ref: "operators.first", config: { p: null } }, { ref: "operators.last", config: { p: null } },
    { ref: "operators.distinctUntilChanged", config: { equal: recipe } }, { ref: "operators.takeWhile", config: { p: recipe } },
    { ref: "operators.first", config: { p: recipe } }, { ref: "operators.last", config: { p: recipe } },
  ]);
  assert.deepEqual(Object.keys({ ...compareRecipes, ...selectRecipes }).sort(),
    ["operators.distinctUntilChanged", "operators.first", "operators.last", "operators.pairwise", "operators.skip", "operators.take", "operators.takeWhile"]);
  for (const bare of [() => takeWhile(g, "x", "s", even), () => first(g, "x", "s", { p: even }), () => last(g, "x", "s", { p: even }), () => distinctUntilChanged(g, "x", "s", { equal: Object.is })]) {
    assert.throws(bare, /recipe/, "a callback without a recipe makes the node local-only, which this graph refuses");
  }
});

test("a callback without a recipe makes the operator local-only: the graph works and cannot be captured", () => {
  for (const build of [(g) => takeWhile(g, "x", "s", even), (g) => first(g, "x", "s", { p: even }), (g) => last(g, "x", "s", { p: even }), (g) => distinctUntilChanged(g, "x", "s", { equal: Object.is })]) {
    const g = graph();
    build(g);
    g.subscribe("k", "x");
    g.set("s", 2);
    assert.throws(() => capture(g), /x/, "capture names the node it cannot save");
  }
});

test("a callback's recipe that no restore could use, or one given without its callback, is refused when the operator is built", () => {
  const builders = [(g, r) => takeWhile(g, "x", "s", even, { recipe: r }), (g, r) => first(g, "x", "s", { p: even, recipe: r }),
    (g, r) => last(g, "x", "s", { p: even, recipe: r }), (g, r) => distinctUntilChanged(g, "x", "s", { equal: Object.is, recipe: r })];
  for (const bad of [{}, { ref: "" }, { ref: 7 }, "app.callback", true, null]) {
    for (const build of builders) {
      const g = graph();
      assert.throws(() => build(g, bad), /a callback's recipe is \{ ref, config \} with a non-empty ref/, JSON.stringify(bad));
      assert.deepEqual(g.describe().map((node) => node.id), ["s"], "nothing was built");
    }
  }
  assert.throws(() => first(graph(), "x", "s", { recipe }), /a recipe is for a predicate, and none was given/);
  assert.throws(() => last(graph(), "x", "s", { recipe }), /a recipe is for a predicate, and none was given/);
  assert.throws(() => distinctUntilChanged(graph(), "x", "s", { recipe }), /a recipe is for an equality, and none was given/);
  const withSetup = { make: () => ({ fn: even, setup: () => {} }) };
  for (const [recipes, ref, config] of [[selectRecipes, "operators.takeWhile", { p: recipe }], [selectRecipes, "operators.first", { p: recipe }],
    [selectRecipes, "operators.last", { p: recipe }], [compareRecipes, "operators.distinctUntilChanged", { equal: recipe }]]) {
    assert.throws(() => recipes[ref](config, withSetup), /gives a function alone/);
    assert.equal(typeof recipes[ref](config, at), "function");
  }
  assert.throws(() => selectRecipes["operators.takeWhile"](null, at), /a callback's recipe is/);
});

test("a predicate or equality given as null is none given, alive and restored alike; a saved recipe that says neither is refused", () => {
  const g = graph({ requireRecipe: true });
  first(g, "f", "s", { p: null }); last(g, "l", "s", { p: null }); distinctUntilChanged(g, "d", "s", { equal: null });
  assert.deepEqual(["f", "l", "d"].map((id) => g.definition(id).recipe.config), [{ p: null }, { p: null }, { equal: null }]);
  assert.throws(() => first(graph(), "x", "s", { p: null, recipe }), /a recipe is for a predicate, and none was given/);
  assert.throws(() => distinctUntilChanged(graph(), "x", "s", { equal: null, recipe }), /a recipe is for an equality, and none was given/);
  for (const ref of ["operators.first", "operators.last"]) {
    assert.equal(typeof selectRecipes[ref]({ p: null }, at), "function");
    for (const bad of [null, {}, "x", { p: 0 }, { p: "" }, { p: false }, { p: {} }]) assert.throws(() => selectRecipes[ref](bad, at), TypeError, `${ref} ${JSON.stringify(bad)}`);
  }
  assert.equal(typeof compareRecipes["operators.distinctUntilChanged"]({ equal: null }, at), "function");
  for (const bad of [null, {}, "x", { equal: 0 }, { equal: "" }, { equal: {} }]) assert.throws(() => compareRecipes["operators.distinctUntilChanged"](bad, at), TypeError, JSON.stringify(bad));
});

test("take(-0) and skip(-0) are take(0) and skip(0), which a checkpoint can save", () => {
  const g = graph();
  take(g, "t", "s", -0); skip(g, "k", "s", -0);
  assert.ok(Object.is(g.definition("t").recipe.config.n, 0) && Object.is(g.definition("k").recipe.config.n, 0));
  capture(g);
});

test("a predicate or equality that is neither a function nor absent is refused when the operator is built", () => {
  for (const bad of [0, false, "", NaN, "even", {}]) {
    for (const build of [(g) => first(g, "x", "s", { p: bad, recipe }), (g) => last(g, "x", "s", { p: bad, recipe }), (g) => takeWhile(g, "x", "s", bad, { recipe }),
      (g) => distinctUntilChanged(g, "x", "s", { equal: bad, recipe })]) {
      const g = graph();
      assert.throws(() => build(g), /is a function/, String(bad));
      assert.deepEqual(g.describe().map((node) => node.id), ["s"], "nothing was built");
    }
  }
  assert.throws(() => takeWhile(graph(), "x", "s", undefined, { recipe }), /its predicate is a function/);
});
