// QA-20 current output-processing baseline, NOT the proposed observer request FIFO.
// Calls below model successive application steps directly. Run from graphrefly-ts.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { Graph } = await import(pathToFileURL(resolve("packages/ts/src/graph/graph.ts")).href);

for (const terminal of ["COMPLETE", "ERROR"] as const) {
  const g = new Graph(), n = g.node([], null, { initial: 20, pausable: "resumeAll" });
  const seen: unknown[][] = [];
  const off = n.subscribe((m: readonly unknown[]) => { seen.push([...m]); });
  seen.length = 0;
  n.up([["PAUSE", "L"]]);
  n.down([["DATA", 30]]);
  assert.equal(n._control.pauseBuffer.length, 1);
  assert.deepEqual(seen, []);
  const terminalWave = terminal === "COMPLETE" ? [["COMPLETE"]] : [["ERROR", new Error("end")]];
  n.down(terminalWave);
  assert.equal(n._control.pauseBuffer.length, 0);
  n.up([["RESUME", "L"]]);
  assert.deepEqual(seen.map((m) => m[0]), [terminal]);
  console.log(JSON.stringify({ terminal, appliedDataFirst: true, visibleTypes: seen.map((m) => m[0]) }));
  off();
}

{
  const g = new Graph(), n = g.node([], null, { initial: 20, pausable: "resumeAll" });
  const seen: unknown[][] = [];
  const off = n.subscribe((m: readonly unknown[]) => { seen.push([...m]); });
  seen.length = 0;
  n.up([["PAUSE", "L"]]);
  n.down([["DATA", 30]]);
  n.up([["RESUME", "L"]]);
  n.down([["COMPLETE"]]);
  assert.deepEqual(seen.map((m) => m[0]), ["DIRTY", "DATA", "COMPLETE"]);
  assert.equal(seen[1][1], 30);
  console.log(JSON.stringify({ case: "resume-before-terminal", visibleTypes: seen.map((m) => m[0]) }));
  off();
}
