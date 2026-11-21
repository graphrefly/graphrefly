// What the canonical traces (operators/traces.jsonl, run by traces.test.mjs) cannot say about the
// notifier operators, because a trace only builds well-formed graphs: that each carries a recipe,
// and that a bad n is refused both where the operator is built and where its recipe is.

import test from "node:test";
import assert from "node:assert/strict";
import { createGraph } from "../kernel/kernel.mjs";
import { capture, restore } from "../modules/checkpoint.mjs";
import { buffer, bufferCount, notifierRecipes, sample, takeUntil } from "./notifier.mjs";

test("each notifier operator carries a recipe, so a graph that requires recipes accepts all four", () => {
  const g = createGraph({ requireRecipe: true });
  g.state("s"); g.state("t");
  sample(g, "sa", "s", "t"); takeUntil(g, "u", "s", "t"); buffer(g, "b", "s", "t"); bufferCount(g, "c", "s", 3);
  assert.deepEqual(["sa", "u", "b", "c"].map((id) => g.definition(id).recipe),
    [{ ref: "operators.sample", config: null }, { ref: "operators.takeUntil", config: null },
      { ref: "operators.buffer", config: null }, { ref: "operators.bufferCount", config: { n: 3 } }]);
});

test("bufferCount refuses an n that is not a positive integer, when built and when its recipe is", () => {
  for (const n of [0, -1, 1.5, "2", undefined, null, Infinity, NaN]) {
    const g = createGraph();
    g.state("s");
    assert.throws(() => bufferCount(g, "c", "s", n), RangeError, `built with ${String(n)}`);
    assert.throws(() => notifierRecipes["operators.bufferCount"]({ n }), RangeError, `recipe with ${String(n)}`);
  }
  assert.throws(() => notifierRecipes["operators.bufferCount"](null), RangeError);
  assert.throws(() => notifierRecipes["operators.bufferCount"]({}), RangeError);
});

test("a checkpoint whose bufferCount recipe holds a bad n is refused at restore; no graph comes back to loop", () => {
  const g = createGraph();
  g.state("s"); bufferCount(g, "c", "s", 2);
  for (const config of [{ n: 0 }, { n: 1.5 }, {}]) {
    const text = JSON.stringify(capture(g)).replace('"config":{"n":2}', `"config":${JSON.stringify(config)}`);
    assert.notEqual(text, JSON.stringify(capture(g)), "the checkpoint holds the recipe's configuration");
    assert.throws(() => restore(JSON.parse(text), notifierRecipes), /not restorable: c: bufferCount: n must be a positive integer/, JSON.stringify(config));
  }
});

test("one node given as both inputs is refused when sample, takeUntil or buffer is built", () => {
  for (const [name, build] of [["sample", sample], ["takeUntil", takeUntil], ["buffer", buffer]]) {
    const g = createGraph();
    g.state("s", 1);
    assert.throws(() => build(g, "x", "s", "s"), /its inputs are distinct nodes/, name);
    assert.deepEqual(g.describe().map((node) => node.id), ["s"], `${name}: no node is left behind`);
  }
});
