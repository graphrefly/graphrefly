// Diagnostic assertions for TS baseline dafc5ae5, not a conformance receipt.
// QA-6: a callback's immediate RESUME drains an old wave into an in-flight diamond.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { Graph } = await import(pathToFileURL(resolve("packages/ts/src/graph/graph.ts")).href);
const graph = new Graph();
const source = graph.state(0);
const left = graph.derived([source], (value: unknown) => value);
const right = graph.derived([source], (value: unknown) => value, { pausable: "resumeAll" });
let armed = false;
const offLeft = left.subscribe((msg: readonly unknown[]) => {
  if (armed && msg[0] === "DATA") right.up([["RESUME", "lock"]]);
});
const traces: unknown[] = [];
const join = graph.derived([left, right], (a: unknown, b: unknown) => {
  traces.push([a, b]);
  return [a, b];
});
const offJoin = join.subscribe(() => {});
right.up([["PAUSE", "lock"]]);
source.set(1);
armed = true;
source.set(2);
assert.deepEqual(traces, [[0, 0], [2, 1], [2, 2]]);
console.log(JSON.stringify({ traces }));
offJoin();
offLeft();
