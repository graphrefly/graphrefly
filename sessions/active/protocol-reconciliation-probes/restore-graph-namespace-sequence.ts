// Baseline diagnostic for omitted graph allocation/retirement/observation state.
// Run from the TS checkout. No proposed metadata or runtime implementation.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const load = (path: string) => import(pathToFileURL(resolve(path)).href);
const { Graph } = await load("packages/ts/src/graph/graph.ts");
const { restoreGraph, defaultRestoreRegistry } = await load("packages/ts/src/graph/restore.ts");
const graph = new Graph();
graph.state(0); // state#0 remains live
const group = graph.topologyGroup();
group.state(1); // state#1 is permanently retired
group.release();
function observationSeqs(g: any): number[] {
  const seqs: number[] = [];
  const release = g.observe("state#0").subscribe((event: any) => seqs.push(event.seq));
  release();
  return seqs;
}
assert.deepEqual(observationSeqs(graph), [0, 1]);
const checkpoint = JSON.parse(JSON.stringify(graph.checkpoint()));
const restored = restoreGraph(checkpoint, { registry: defaultRestoreRegistry });
assert.throws(() => graph.state(9, { name: "state#1" }), /released/);
const originalNext = graph.state(2);
const restoredNext = restored.state(2);
assert.equal(graph.find("state#2"), originalNext);
assert.equal(restored.find("state#1"), restoredNext);
const originalSeqs = observationSeqs(graph);
const restoredSeqs = observationSeqs(restored);
assert.deepEqual(originalSeqs, [2, 3]);
assert.deepEqual(restoredSeqs, [0, 1]);
console.log(JSON.stringify({ originalNext: "state#2", restoredNext: "state#1",
  reusedRetiredId: true, originalSeqs, restoredSeqs,
  meaning: "current checkpoint omits allocation watermark, retirement and observation sequence" }));
console.log("DONE 1 baseline graph namespace/sequence case; no proposed metadata implementation tested");
