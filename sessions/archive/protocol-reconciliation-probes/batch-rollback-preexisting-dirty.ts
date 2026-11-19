// Current-runtime diagnostic: rollback after a pre-existing output DIRTY.
// No candidate notification identity/ownership implementation.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const load = (path: string) => import(pathToFileURL(resolve(path)).href);
const { Graph } = await load("packages/ts/src/graph/graph.ts");
const { batch } = await load("packages/ts/src/batch/batch.ts");
const graph = new Graph();
const source = graph.state(10, { name: "source" });
const messages: unknown[] = [];
const release = source.subscribe((message: unknown) => messages.push(message));
try {
  messages.length = 0;
  source.down([["DIRTY"]]);
  assert.deepEqual(messages, [["DIRTY"]]);
  batch((ctx: any) => {
    source.down([["DATA", 20]]);
    ctx.rollback();
  });
  assert.deepEqual(messages, [["DIRTY"], ["DIRTY"], ["RESOLVED"]]);
  assert.equal(source.cache, 10);
  console.log(JSON.stringify({ messages, cache: source.cache,
    meaning: "current rollback emits RESOLVED despite an outstanding pre-batch DIRTY; proposed ownership guard not tested" }));
} finally {
  release();
}
console.log("DONE 1 baseline pre-existing DIRTY/rollback case; no candidate ownership tested");
