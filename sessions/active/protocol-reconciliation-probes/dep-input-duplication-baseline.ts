// Current-runtime field/reader comparison, not candidate storage validation.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const load = (path: string) => import(pathToFileURL(resolve(path)).href);
const { Graph } = await load("packages/ts/src/graph/graph.ts");
const { depBatch, depLatest } = await load("packages/ts/src/ctx/types.ts");
const graph = new Graph();
const source = graph.state(0, { name: "source" });
const invocations: Array<{ values: unknown; latest: unknown }> = [];
const consumer = graph.node([source], (ctx: any) => {
  invocations.push({ values: [...(depBatch(ctx, 0) ?? [])], latest: depLatest(ctx, 0) });
  ctx.down([["DATA", depLatest(ctx, 0)]]);
}, { name: "consumer" });
const release = consumer.subscribe(() => {});
try {
  consumer.up([["PAUSE", "hold"]]);
  source.set(20);
  source.set(20);
  source.set(30);
  assert.deepEqual(consumer._dep.batch[0], [20, 20, 30]);
  assert.deepEqual(consumer._dep.waveData[0], [[20], [20], [30]]);
  assert.equal(consumer._dep.prev[0], 30);
  assert.equal(consumer._dep.hasData[0], true);
  assert.equal(consumer._dep.dirty[0], false);
  assert.equal(consumer._wave.pending, 0);
  source.down([["INVALIDATE"]]);
  assert.equal(consumer._dep.batch[0], null);
  assert.deepEqual(consumer._dep.waveData[0], [[20], [20], [30], [undefined]]);
  assert.equal(consumer._dep.prev[0], undefined);
  assert.equal(consumer._dep.hasData[0], false);
  source.set(40);
  assert.deepEqual(consumer._dep.batch[0], [40]);
  consumer.up([["RESUME", "hold"]]);
  assert.deepEqual(invocations.at(-1), { values: [20, 20, 30, 40], latest: 40 });
  console.log(JSON.stringify({ paused: { internalBatch: [20, 20, 30], pending: 0 },
    afterInvalidate: { internalBatch: null, retainedInput: "SENTINEL",
      rawWaves: [[20], [20], [30], ["SENTINEL"]] },
    resumedFn: invocations.at(-1),
    meaning: "internal batch is cleared by INVALIDATE but raw waveData/depBatch retains older DATA; naive flat() is not a drop-in replacement" }));
} finally {
  release();
}
console.log("DONE 1 baseline input storage/INVALIDATE case; no candidate representation tested");
