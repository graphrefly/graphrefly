import test from "node:test";
import assert from "node:assert/strict";
import { createGraph } from "./kernel.mjs";
import { capture, restore } from "../modules/checkpoint.mjs";
import { controlPair, pausable } from "../modules/pause.mjs";
import { pullable } from "../modules/demand.mjs";
import { restartable } from "../modules/restart.mjs";
import { mergeMap, switchMap, relay } from "../modules/higher-order.mjs";
import { history } from "../modules/history.mjs";
import { frameSource, wireEdgeGroupIn, wireEdgeGroupOut } from "../modules/bridge.mjs";

const forbidden = { message: "name must not contain '::'" };
const ids = (g) => g.describe().map(({ id }) => id);

test("C-49: local names refuse the mount delimiter before mutation", () => {
  const g = createGraph();
  for (const name of ["a::b", "::a", "a::", "a/inner::b", "#a::b"]) {
    for (const build of [() => g.state(name), () => g.node(name, [], () => {}),
      () => pausable(g, name, "source"),
      () => wireEdgeGroupIn(g, "bridge", { group: "g", frames: "frames", edges: ["valid", name] })]) {
      assert.throws(build, forbidden);
      assert.deepEqual(g.describe(), []);
    }
  }
  g.state("User.Label-with_case", 1);
  assert.equal(g.get("User.Label-with_case").value, 1, "user labels are preserved");
});

test("C-49: checkpoint name admission precedes all recipe calls", () => {
  const g = createGraph();
  g.node("good", [], () => {}, { recipe: { ref: "counted" } });
  g.state("later");
  const cp = capture(g);
  cp.nodes[1].id = "bad::name";
  let calls = 0;
  assert.throws(() => restore(cp, { counted: () => { calls++; return () => {}; } }), forbidden);
  assert.equal(calls, 0);
});

// Every reference public factory that creates nodes. Observer/recipe-only helpers
// create none. Required ids are explicit because the reference has no defaults.
const factories = [
  ["controlPair", (g) => controlPair(g, "pause"), ["pause/locks"]],
  ["pausable", (g) => pausable(g, "pause", "source"), ["pause/locks", "pause"]],
  ["pullable", (g) => pullable(g, "pull", "source", () => {}), ["pull/demand", "pull"]],
  ["restartable", (g) => restartable(g, "restart", { deps: ["source"], fn: relay }),
    ["restart/restart", "restart/inner", "restart"]],
  ["history", (g) => history(g, "history", "source", 2), ["history"]],
  ["frameSource", (g) => frameSource(g, "frames", () => () => {}), ["frames"]],
  ["wireEdgeGroupOut", (g) => wireEdgeGroupOut(g, "bridge", { group: "g", edges: { x: "source" } }), ["bridge"]],
  ["wireEdgeGroupIn", (g) => wireEdgeGroupIn(g, "bridge", { group: "g", frames: "source", edges: ["x", "issues"] }),
    ["bridge", "bridge/edges/x", "bridge/edges/issues", "bridge/issues"]],
  ...[["switchMap", switchMap], ["mergeMap", mergeMap]].map(([name, build]) => [name, (g) => {
    build(g, "project", "source", () => ({ deps: ["source"], fn: relay }));
    g.subscribe("hold", "project"); // Include the lazy inner.
  }, ["project", "project/inner"]]),
];

for (const [name, build, expected] of factories) test(`C-49: ${name} generated paths`, () => {
  const g = createGraph();
  g.state("source", 1);
  build(g);
  const generated = ids(g).slice(1);
  assert.deepEqual(generated, expected);
  for (const id of generated) for (const part of id.split("/")) {
    assert.match(part, /^[a-z][a-zA-Z0-9]*$/, id);
  }
});

test("C-49: bridge edge issues and issue projection remain distinct and operational", () => {
  const g = createGraph();
  g.state("frames");
  const bridge = wireEdgeGroupIn(g, "bridge", { group: "g", frames: "frames", edges: ["issues"] });
  const seen = [];
  g.subscribe("edge", bridge.inbound.issues, (msgs) => seen.push(...msgs.filter(([t]) => t === "DATA")));
  g.subscribe("diagnostics", bridge.issues);
  const value = new Uint8Array([7]);
  g.set("frames", { group: "g", session: "session", cause: 1, edges: [{ edge: "issues", arrays: [[["DATA", value]]] }] });
  assert.deepEqual(seen, [["DATA", value]]);
  assert.notEqual(bridge.inbound.issues, bridge.issues);
});

test("C-49: shared inventory exposes absent modules and enforces every role", async () => {
  const { checkNamingFixture, namingFixture } = await import("./probe-naming.mjs");
  checkNamingFixture(namingFixture);
});


test("C-49: boundary colons are refused; internal single colons remain legal", () => {
  const error = { message: "name must not start or end with ':'" };
  const g = createGraph();
  for (const name of [":", ":a", "a:", "a/b:"]) {
    for (const build of [() => controlPair(g, name),
      () => pausable(g, name, "source"),
      () => pullable(g, name, "source", () => {}),
      () => restartable(g, name, { deps: ["source"], fn: () => {} })]) {
      assert.throws(build, error);
      assert.deepEqual(g.describe(), [], "module prefix rejects before any generated child");
    }
    assert.throws(() => g.state(name), error);
    assert.throws(() => g.node(name, [], () => {}), error);
    assert.throws(() => wireEdgeGroupIn(g, "bridge", { group: "g", frames: "frames", edges: ["x", name] }), error);
    assert.deepEqual(g.describe(), []);
  }
  g.state("a:b", 1);
  assert.equal(g.get("a:b").value, 1);
  g.node("good", [], () => {}, { recipe: { ref: "counted" } });
  const cp = capture(g);
  cp.nodes[0].id = "a:";
  let calls = 0;
  assert.throws(() => restore(cp, { counted: () => { calls++; return () => {}; } }), error);
  assert.equal(calls, 0);
});
