// QA-21 current baseline, NOT the proposed zero-old-owner admission contract.
// Run with graphrefly-ts as cwd. Private subscriber count is diagnostic only.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { Graph } = await import(pathToFileURL(resolve("packages/ts/src/graph/graph.ts")).href);
const g = new Graph();
let runs = 0;
const a = g.producer((ctx: any) => { ctx.down([["DATA", ++runs]]); },
  { name: "A", resubscribable: true });
const b = g.derived([a], (value: unknown) => value, { name: "B", completeWhenDepsComplete: false });
const bData: unknown[] = [];
const offB = b.subscribe((m: readonly unknown[]) => { if (m[0] === "DATA") bData.push(m[1]); });
const releaseRetain = g.retain(a, { reason: "QA-21 diagnostic" });
assert.equal(a._lifecycle.subscribers.size, 2);
a.down([["COMPLETE"]]);
assert.equal(a._lifecycle.subscribers.size, 2);
const cData: unknown[] = [];
const offC = a.subscribe((m: readonly unknown[]) => { if (m[0] === "DATA") cData.push(m[1]); });
assert.equal(runs, 2);
assert.equal(a._lifecycle.subscribers.size, 1);
a.down([["DATA", 99]]);
assert.deepEqual(bData, [1]);
assert.deepEqual(cData, [2, 99]);
assert.equal(b.deps[0], a);
const edgeStillDeclared = g.describe().edges.some((edge: any) => edge.from === "A" && edge.to === "B");
assert.equal(edgeStillDeclared, true);
console.log(JSON.stringify({ runs, oldOwnersBeforeReset: 2, actualSubscribersAfterReset: 1,
  bData, cData, edgeStillDeclared }));
offC(); releaseRetain(); offB();
