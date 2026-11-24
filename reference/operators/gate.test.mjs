// What the canonical traces (operators/traces.jsonl, run by traces.test.mjs) cannot say about the
// gate operators, because a trace only builds well-formed graphs and reads only sinks: that each
// carries a recipe, that what a pausable holds is saved as JSON, that one node given as both inputs
// is refused, and that the pause module's pausable is the same function under the module's own
// recipe.

import test from "node:test";
import assert from "node:assert/strict";
import { createGraph } from "../kernel/kernel.mjs";
import { capture, restore } from "../modules/checkpoint.mjs";
import { pausable, pauseRecipes } from "../modules/pause.mjs";
import { gateRecipes, pause, valve } from "./gate.mjs";

test("each gate operator carries a recipe, so a graph that requires recipes accepts both and a restore builds them again", () => {
  const g = createGraph({ requireRecipe: true });
  g.state("s", 1); g.state("c", true); g.state("l", []);
  valve(g, "v", "s", "c"); pause(g, "p", "s", "l");
  assert.deepEqual(["v", "p"].map((id) => g.definition(id).recipe), [{ ref: "operators.valve", config: null }, { ref: "operators.pause", config: null }]);
  g.subscribe("k", "v"); g.subscribe("k", "p");
  const r = restore(JSON.parse(JSON.stringify(capture(g))), gateRecipes, { requireRecipe: true });
  assert.deepEqual(["v", "p"].map((id) => r.get(id).values), [[1], [1]]);
});

// R-checkpoint: private state must be JSON. A trace's restore step would throw on a pausable that
// held its arrays in something else, and a trace that throws shows nothing at a sink.
test("a pausable that holds arrays is captured with them as JSON, and the restored one sends them at the release", () => {
  const g = createGraph();
  g.state("s"); g.state("l", []);
  pause(g, "p", "s", "l");
  g.subscribe("k", "p");
  g.set("s", 1); g.set("l", ["A"]); g.set("s", 2);
  g.batch(() => { g.set("s", 3); g.set("s", 4); });
  const saved = capture(g);
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), saved);
  assert.deepEqual(saved.nodes.find((n) => n.id === "p").saved.state, [[2], [3, 4]]);
  const r = restore(saved, gateRecipes);
  const got = [];
  r.subscribe("k", "p", (messages) => got.push(messages));
  r.set("l", []);
  assert.deepEqual(got.flat().filter((m) => m[0] === "DATA"), [["DATA", 1], ["DATA", 2], ["DATA", 3], ["DATA", 4]]);
  assert.deepEqual(r.get("p").values, [3, 4]);
});

test("one node given as both inputs is refused when valve or pause is built, and when the module's pausable is", () => {
  for (const [name, build] of [["valve", valve], ["pause", pause]]) {
    const g = createGraph();
    g.state("s", 1);
    assert.throws(() => build(g, "x", "s", "s"), /its inputs are distinct nodes/, name);
    assert.deepEqual(g.describe().map((node) => node.id), ["s"], `${name}: no node is left behind`);
  }
  const g = createGraph();
  g.state("s", []);
  assert.throws(() => pausable(g, "x", "s", { control: { locksId: "s" } }), /its inputs are distinct nodes/);
  assert.deepEqual(g.describe().map((node) => node.id), ["s"]);
});

test("the pause module's pausable is the pause operator's function and policies under the module's recipe", () => {
  const g = createGraph();
  g.state("s", 1); g.state("l", []);
  pause(g, "op", "s", "l");
  pausable(g, "mod", "s", { control: { locksId: "l" } });
  const [op, mod] = ["op", "mod"].map((id) => g.definition(id));
  assert.equal(mod.fn, op.fn);
  assert.deepEqual(mod.opts, op.opts);
  assert.equal(pauseRecipes["pause.pausable"](), gateRecipes["operators.pause"]());
});
