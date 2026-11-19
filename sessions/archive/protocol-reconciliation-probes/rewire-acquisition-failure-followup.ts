// Current-runtime diagnostic: outward dependency startup failure during rewire.
// No proposed abandonment gate/rollback implementation. Run from TS checkout.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const load = (path: string) => import(pathToFileURL(resolve(path)).href);
const { Graph } = await load("packages/ts/src/graph/graph.ts");
const { depLatest } = await load("packages/ts/src/ctx/types.ts");
const graph = new Graph();
const b = graph.state(1, { name: "B" });
const fault = new Error("C startup failed during rewire");
let cleanupCalls = 0;
const c = graph.node([], (ctx: any) => {
  ctx.onDeactivation(() => { cleanupCalls++; });
  throw fault;
}, { name: "C" });
const n = graph.node([b], (ctx: any) => {
  ctx.down([["DATA", depLatest(ctx, 0) * 10]]);
}, { name: "N" });
const values: number[] = [];
const inputs: unknown[][] = [];
const release = n.subscribe((message: any) => {
  if (message[0] === "DATA") values.push(message[1]);
});
try {
  assert.deepEqual(values, [10]);
  assert.throws(() => n.replaceDeps([b, c], (ctx: any) => {
    const pair = [depLatest(ctx, 0), depLatest(ctx, 1)];
    inputs.push(pair);
    ctx.down([["DATA", (pair[0] ?? 0) + (pair[1] ?? 0)]]);
  }), (error: unknown) => error === fault);
  assert.equal(n._lifecycle.activated, true);
  assert.deepEqual(n._slot.deps, [b, c]);
  assert.deepEqual(inputs, []);
  assert.equal(cleanupCalls, 0);
  b.set(2);
  assert.deepEqual(inputs, [[2, undefined]]);
  assert.deepEqual(values, [10, 2]);
  console.log(JSON.stringify({ values, inputs: [[2, "SENTINEL"]],
    activeAfterFailure: n._lifecycle.activated, depsAfterFailure: ["B", "C"],
    meaning: "rewire throws after replacing fn/topology; later B input runs new fn despite C startup failure" }));
} finally {
  release();
}
assert.equal(cleanupCalls, 1);
console.log("DONE 1 baseline rewire/acquisition failure case; proposed abandonment policy not tested");
