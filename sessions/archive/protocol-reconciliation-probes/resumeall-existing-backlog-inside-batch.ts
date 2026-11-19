// Current-runtime diagnostic, not the accepted occurrence-preserving batch design.
// Old separately accepted DATA/RESOLVED waves versus ambient batch accumulation.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const load = (path: string) => import(pathToFileURL(resolve(path)).href);
const { Graph } = await load("packages/ts/src/graph/graph.ts");
const { depLatest } = await load("packages/ts/src/ctx/types.ts");
const { batch } = await load("packages/ts/src/batch/batch.ts");
function run(inBatch: boolean) {
  const graph = new Graph();
  const source = graph.state(1, { name: "source" });
  const held = graph.node([source], (ctx: any) => {
    const value = depLatest(ctx, 0);
    ctx.down(value === 3 ? [["RESOLVED"]] : [["DATA", value * 100]]);
  }, { name: "held", pausable: "resumeAll" });
  const data: number[] = [];
  const release = held.subscribe((message: any) => {
    if (message[0] === "DATA") data.push(message[1]);
  });
  try {
    held.up([["PAUSE", "lock"]]);
    source.set(2);
    source.set(3);
    assert.deepEqual(held._control.pauseBuffer, [[["DATA", 200]], [["RESOLVED"]]]);
    const resume = () => held.up([["RESUME", "lock"]]);
    if (inBatch) batch(resume);
    else resume();
    return { inBatch, data: [...data], cache: held.cache };
  } finally {
    release();
  }
}
const outside = run(false);
const inside = run(true);
assert.deepEqual(outside.data, [100, 200]);
assert.equal(outside.cache, 200);
assert.deepEqual(inside.data, [100]);
assert.equal(inside.cache, 100);
console.log(JSON.stringify({ outside, inside,
  meaning: "current ambient batch captures old buffered waves and last-write coalescing loses DATA200; proposed accumulation would instead encounter tier-3 exclusivity" }));
console.log("DONE 2 baseline backlog/batch cases; no proposed scheduling or accumulator tested");
