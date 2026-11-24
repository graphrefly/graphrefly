// What the canonical traces (operators/traces.jsonl, run by traces.test.mjs) cannot say about the
// higher-order operators, because a trace only builds well-formed graphs and reads only sinks: that
// each carries a recipe when its projector has one, that what it holds is saved as JSON, that a
// capacity which is not a positive integer is refused, that an inner which ended is no longer a
// dependency, what payload a throwing projector's ERROR has (a trace's `["ERROR"]` matches any),
// that the module's operators are these, and when two definitions are the same: a trace's projector
// only follows one node with one recipe, so its definitions differ by that node alone.

import test from "node:test";
import assert from "node:assert/strict";
import { createGraph } from "../kernel/kernel.mjs";
import { capture, restore } from "../modules/checkpoint.mjs";
import * as module from "../modules/higher-order.mjs";
import { concatMap, exhaustMap, higherOrderRecipes, mergeMap, relay, switchMap } from "./higher-order.mjs";

const follow = (v) => ({ deps: [v], fn: relay, recipe: { ref: "higher.relay" } });
const registry = { ...higherOrderRecipes, follow: () => follow };
const BUILD = { switchMap, mergeMap, concatMap, exhaustMap };

test("each higher-order operator carries a recipe when its projector has one, so a graph that requires recipes accepts it and a restore builds it again with its inners", () => {
  const g = createGraph({ requireRecipe: true });
  g.state("A", "a1"); g.state("B", "b1"); g.state("o");
  for (const [name, build] of Object.entries(BUILD)) build(g, name, "o", follow, { recipe: { ref: "follow", config: null } });
  assert.deepEqual(Object.keys(BUILD).map((id) => g.definition(id).recipe.config), [
    { sourceId: "o", mode: "switch", capacity: null, project: { ref: "follow", config: null } },
    { sourceId: "o", mode: "merge", capacity: null, project: { ref: "follow", config: null } },
    { sourceId: "o", mode: "merge", capacity: 1, project: { ref: "follow", config: null } },
    { sourceId: "o", mode: "exhaust", capacity: null, project: { ref: "follow", config: null } },
  ]);
  for (const id of Object.keys(BUILD)) g.subscribe("k", id);
  g.set("o", "A"); g.set("o", "B");
  const saved = capture(g);
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), saved);
  // What each holds: the inners' nodes and definitions, the outer values that wait, the outer's end.
  const held = (id) => saved.nodes.find((n) => n.id === id).saved.state;
  assert.deepEqual(held("switchMap").inners.map((x) => x.def.deps), [["B"]]);
  assert.deepEqual(held("mergeMap").inners.map((x) => x.def.deps), [["A"], ["B"]]);
  assert.deepEqual([held("concatMap").inners.map((x) => x.def.deps), held("concatMap").queue], [[["A"]], ["B"]]);
  assert.deepEqual([held("exhaustMap").inners.map((x) => x.def.deps), held("exhaustMap").queue], [[["A"]], []]);
  const r = restore(saved, registry, { requireRecipe: true });
  for (const id of Object.keys(BUILD)) r.subscribe("k", id);
  r.set("A", "a2"); r.set("B", "b2");
  assert.deepEqual(Object.keys(BUILD).map((id) => r.get(id).values), [["b2"], ["b2"], ["a2"], ["a2"]]);
});

test("an operator whose projector has no recipe carries none, and a graph that requires recipes refuses it", () => {
  for (const [name, build] of Object.entries(BUILD)) {
    const plain = createGraph();
    plain.state("o");
    build(plain, "x", "o", follow);
    assert.equal(plain.definition("x").recipe, null, name);
    const strict = createGraph({ requireRecipe: true });
    strict.state("o");
    assert.throws(() => build(strict, "x", "o", follow), name);
  }
});

test("an inner that ended is released: the operator depends on its outer and on the inners it holds, in the graph and in a capture", () => {
  for (const [name, build] of Object.entries(BUILD)) {
    const g = createGraph();
    g.state("A", "a1"); g.state("B", "b1"); g.state("o");
    build(g, "x", "o", follow, { recipe: { ref: "follow", config: null } });
    g.subscribe("k", "x");
    const deps = (graph) => graph.describe().find((n) => n.id === "x").deps;
    g.set("o", "A");
    assert.deepEqual(deps(g), ["o", "x/inner"], name);
    g.complete("A");
    assert.deepEqual(deps(g), ["o"], `${name}: after its inner ended`);
    const r = restore(capture(g), registry);
    r.subscribe("k", "x");
    assert.deepEqual(deps(r), ["o"], `${name}: restored`);
  }
});

// R-failure: the ERROR's payload is the message of the error thrown.
test("a throw from project is the operator's ERROR, with the message thrown as its payload", () => {
  for (const [name, build] of Object.entries(BUILD)) {
    const g = createGraph();
    g.state("o");
    build(g, "x", "o", () => { throw new Error("no inner for this"); });
    g.subscribe("k", "x");
    g.set("o", "A");
    assert.deepEqual(g.get("x").ended, ["ERROR", "no inner for this"], name);
  }
});

test("a mergeMap capacity that is not a positive integer is refused, and no node is left behind", () => {
  for (const capacity of [0, -1, 1.5, "2", null, NaN]) {
    const g = createGraph();
    g.state("o");
    assert.throws(() => mergeMap(g, "x", "o", follow, { capacity }), /its capacity is a positive integer or Infinity/, String(capacity));
    assert.deepEqual(g.describe().map((node) => node.id), ["o"]);
  }
  const g = createGraph();
  g.state("o");
  mergeMap(g, "x", "o", follow, { capacity: Infinity, recipe: { ref: "follow", config: null } });
  assert.equal(g.definition("x").recipe.config.capacity, null, "Infinity is saved as null, JSON having none");
});

test("the higher-order module's operators are these, and its mergeMap takes the capacity as `concurrent`", () => {
  assert.equal(module.switchMap, switchMap);
  assert.equal(module.concatMap, concatMap);
  assert.equal(module.exhaustMap, exhaustMap);
  assert.equal(module.relay, relay);
  assert.equal(module.higherOrderRecipes, higherOrderRecipes);
  const g = createGraph();
  g.state("o");
  module.mergeMap(g, "x", "o", follow, { concurrent: 2, recipe: { ref: "follow", config: null } });
  assert.equal(g.definition("x").recipe.config.capacity, 2);
});

// The contracts speak of "the definition already attached" and "a definition it already holds"
// without saying when two are the same. Here they are when their dependencies are, in order, and
// their recipes are, configuration included, or, without recipes, their functions are. A new
// selection shows as the inner's snapshot sent again; a value that selects nothing sends nothing.
test("two definitions are the same when their dependencies in order and their recipes are, or without recipes their functions", () => {
  const other = (ctx) => relay(ctx);
  const DEFS = {
    A: { deps: ["a"], fn: relay }, AB: { deps: ["a", "b"], fn: relay }, BA: { deps: ["b", "a"], fn: relay }, AC: { deps: ["a", "c"], fn: relay },
    A2: { deps: ["a"], fn: other }, AR: { deps: ["a"], fn: relay, recipe: { ref: "higher.relay" } },
    AR1: { deps: ["a"], fn: relay, recipe: { ref: "higher.relay", config: 1 } }, AR2: { deps: ["a"], fn: relay, recipe: { ref: "higher.relay", config: 2 } },
    BAR: { deps: ["b", "a"], fn: relay, recipe: { ref: "higher.relay" } }, ABR: { deps: ["a", "b"], fn: relay, recipe: { ref: "higher.relay" } },
  };
  // [outer value, what the sink receives: the new inner's first value, or nothing]
  const STEPS = [["A", "a1"], ["A", null], ["AB", "a1"], ["AB", null], ["A", "a1"], ["AB", "a1"], ["BA", "b1"], ["AB", "a1"], ["AC", "a1"], ["A", "a1"], ["A2", "a1"], ["A", "a1"],
    ["AR", "a1"], ["AR", null], ["A", "a1"], ["AR1", "a1"], ["AR1", null], ["AR2", "a1"], ["AR1", "a1"], ["AR", "a1"], ["BAR", "b1"], ["BAR", null], ["ABR", "a1"], ["ABR", null]];
  const g = createGraph();
  g.state("a", "a1"); g.state("b", "b1"); g.state("c", "c1"); g.state("o");
  switchMap(g, "x", "o", (v) => ({ ...DEFS[v] }));
  g.subscribe("k", "x");
  const data = () => g.trace.filter((e) => e.to === "k").flatMap((e) => e.msgs).filter((m) => m[0] === "DATA").map((m) => m[1]);
  let before = "nothing";
  for (const [value, sent] of STEPS) {
    const had = data().length;
    g.set("o", value);
    assert.deepEqual(data().slice(had), sent === null ? [] : [sent], `${value} after ${before}`);
    before = value;
  }
});

test("a mergeMap holds a definition once: one that differs from each it holds in its dependencies, their order, its function or its recipe is another inner", () => {
  const other = (ctx) => relay(ctx);
  const DEFS = [
    ["A", { deps: ["a"], fn: relay }], ["AB", { deps: ["a", "b"], fn: relay }], ["BA", { deps: ["b", "a"], fn: relay }], ["AC", { deps: ["a", "c"], fn: relay }], ["A2", { deps: ["a"], fn: other }],
    ["AR", { deps: ["a"], fn: relay, recipe: { ref: "higher.relay" } }], ["AR1", { deps: ["a"], fn: relay, recipe: { ref: "higher.relay", config: 1 } }], ["AR2", { deps: ["a"], fn: relay, recipe: { ref: "higher.relay", config: 2 } }],
    ["BAR", { deps: ["b", "a"], fn: relay, recipe: { ref: "higher.relay" } }], ["ABR", { deps: ["a", "b"], fn: relay, recipe: { ref: "higher.relay" } }],
  ];
  const g = createGraph();
  g.state("a", "a1"); g.state("b", "b1"); g.state("c", "c1"); g.state("o");
  mergeMap(g, "x", "o", (v) => ({ ...Object.fromEntries(DEFS)[v] }));
  g.subscribe("k", "x");
  const held = () => g.describe().find((n) => n.id === "x").deps.length - 1;
  DEFS.forEach(([value], i) => { g.set("o", value); assert.equal(held(), i + 1, `${value} is another inner`); });
  for (const [value] of DEFS) { g.set("o", value); assert.equal(held(), DEFS.length, `${value} again adds none`); }
});

test("a selected inner that was invalidated is still the definition attached, and an inner's node carries its recipe with its configuration", () => {
  const g = createGraph();
  g.state("a", "a1"); g.state("b", "b1"); g.state("o");
  switchMap(g, "x", "o", () => ({ deps: ["a", "b"], fn: relay, recipe: { ref: "higher.relay", config: 1 } }));
  g.subscribe("k", "x");
  g.set("o", "AB");
  assert.deepEqual(g.definition("x/inner").recipe, { ref: "higher.relay", config: 1 });
  g.invalidate("b"); // the inner's INVALIDATE, from a dependency it does not relay
  assert.deepEqual(g.get("x").values, []);
  g.set("o", "AB");
  assert.deepEqual(g.get("x").values, [], "the same definition supersedes nothing, so what its first dependency holds is not sent again");
});

test("each inner a mergeMap holds carries its recipe, in whichever slot", () => {
  const g = createGraph({ requireRecipe: true });
  for (const id of ["A", "B", "C", "D"]) g.state(id, id);
  g.state("o");
  mergeMap(g, "x", "o", follow, { recipe: { ref: "follow", config: null } });
  g.subscribe("k", "x");
  for (const id of ["A", "B", "C", "D"]) g.set("o", id);
  assert.deepEqual(["x/inner", "x/inner1", "x/inner2", "x/inner3"].map((id) => g.definition(id).recipe), Array(4).fill({ ref: "higher.relay" }));
  g.complete("B"); g.set("o", "B"); // a slot used a second time
  assert.deepEqual(g.definition("x/inner1").recipe, { ref: "higher.relay" });
});
