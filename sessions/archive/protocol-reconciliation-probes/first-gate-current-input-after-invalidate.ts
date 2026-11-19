// QA-15 baseline diagnostic, NOT validation of proposed complete-wave gate semantics.
// Run from graphrefly-ts. Callback undefined is actual absence, not DATA(undefined).
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { Graph } = await import(pathToFileURL(resolve("packages/ts/src/graph/graph.ts")).href);

for (const partial of [false, true]) {
  const g = new Graph(), a = g.node([], null), b = g.node([], null);
  const calls: unknown[][] = [];
  const n = g.derived([a, b], (av: unknown, bv: unknown) => { calls.push([av, bv]); }, { partial });
  const off = n.subscribe(() => {});
  n.up([["PAUSE", "L"]]);
  a.down([["DATA", 10]]);
  b.down([["DATA", 20]]);
  a.down([["INVALIDATE"]]);
  assert.deepEqual(calls, []);
  n.up([["RESUME", "L"]]);
  assert.deepEqual(calls, partial ? [[undefined, 20]] : []);
  a.down([["RESOLVED"]]);
  assert.deepEqual(calls, partial ? [[undefined, 20], [undefined, 20]] : []);
  a.down([["DATA", 11]]);
  assert.deepEqual(calls.at(-1), [11, 20]);
  if (!partial) assert.equal(calls.length, 1);
  a.down([["INVALIDATE"]]);
  b.down([["DATA", 21]]);
  assert.deepEqual(calls.at(-1), [undefined, 21]);
  console.log(JSON.stringify({ case: "paused-first-call", partial, calls,
    note: "JSON null denotes callback undefined/absence" }));
  off();
}

{
  const g = new Graph(), a = g.node([], null), b = g.state(20);
  const calls: unknown[][] = [];
  const n = g.derived([a, b], (av: unknown, bv: unknown) => { calls.push([av, bv]); });
  const off = n.subscribe(() => {});
  a.down([["DATA", 10], ["INVALIDATE"]]);
  assert.deepEqual(calls, [[10, 20]]);
  console.log(JSON.stringify({ case: "same-array-gate-before-invalidation-clear", calls }));
  off();
}
