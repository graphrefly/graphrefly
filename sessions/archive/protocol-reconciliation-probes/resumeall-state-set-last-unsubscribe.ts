// Diagnostic assertions for TS baseline dafc5ae5, not the proposed future contract.
// Independently reconstructed from the human-provided QA-4 trace; run with TS repo as cwd.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { Graph } = await import(pathToFileURL(resolve("packages/ts/src/graph/graph.ts")).href);
const graph = new Graph();
const state = graph.state(20, { pausable: "resumeAll" });
const off = state.subscribe(() => {});
state.up([["PAUSE", "lock"]]);
state.set(30);
const whilePaused = state.cache;
off();
const afterOff = state.cache;
const replayed: unknown[] = [];
const offAgain = state.subscribe((msg: readonly unknown[]) => {
  if (msg[0] === "DATA") replayed.push(msg[1]);
});
assert.equal(whilePaused, 20);
assert.equal(afterOff, 20);
assert.deepEqual(replayed, [20]);
console.log(JSON.stringify({ whilePaused, afterOff, replayed }));
offAgain();
