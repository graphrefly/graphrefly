// Current-runtime diagnostic: FIFO backlog on one leg versus latest-value join.
// Run from the TS checkout. No timers, network, or candidate implementation.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const load = (path: string) => import(pathToFileURL(resolve(path)).href);
const { Graph } = await load("packages/ts/src/graph/graph.ts");
const { depLatest } = await load("packages/ts/src/ctx/types.ts");
const graph = new Graph();
const source = graph.state(1, { name: "S" });
const scale = (factor: number) => (ctx: any) =>
  ctx.down([["DATA", depLatest(ctx, 0) * factor]]);
const b = graph.node([source], scale(10), { name: "B" });
const c = graph.node([source], scale(100), { name: "C", pausable: "resumeAll" });
const pairs: number[][] = [];
const d = graph.node([b, c], (ctx: any) => {
  const pair = [depLatest(ctx, 0), depLatest(ctx, 1)];
  pairs.push(pair);
  ctx.down([["DATA", pair[0] + pair[1]]]);
}, { name: "D" });
const values: number[] = [];
const release = d.subscribe((message: any) => {
  if (message[0] === "DATA") values.push(message[1]);
});
try {
  assert.deepEqual(values, [110]);
  const lock = "hold-C";
  c.up([["PAUSE", lock]]);
  source.set(2);
  source.set(3);
  assert.equal(b.cache, 30);
  assert.equal(c.cache, 100);
  assert.deepEqual(values, [110]);
  c.up([["RESUME", lock]]);
  assert.deepEqual(pairs, [[10, 100], [30, 200], [30, 300]]);
  assert.deepEqual(values, [110, 230, 330]);
  console.log(JSON.stringify({ pairs, values,
    meaning: "resumed C backlog joins latest B, not historical B from its original source wave" }));
} finally {
  release();
}
console.log("DONE 1 baseline mixed-time diamond case; no candidate whole-array delivery tested");
