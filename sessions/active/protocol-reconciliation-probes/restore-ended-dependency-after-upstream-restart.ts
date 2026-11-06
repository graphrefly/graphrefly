// Current-runtime checkpoint diagnostic. No new revision fields/proposed lifecycle code.
// No timers, network, or external resources.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const load = (p: string) => import(pathToFileURL(resolve(p)).href);
const { Graph } = await load("packages/ts/src/graph/graph.ts");
const { restoreGraph, defaultRestoreRegistry } = await load("packages/ts/src/graph/restore.ts");
const { depLatest } = await load("packages/ts/src/ctx/types.ts");
const sum = (ctx: any) => ctx.down([["DATA", depLatest(ctx, 0) + depLatest(ctx, 1)]]);
const g = new Graph();
const a = g.state(1, { name: "a", resubscribable: true, restore: { ref: "restartable-state" } });
const b = g.state(2, { name: "b" });
const d = g.node([a, b], sum, { name: "d", restore: { ref: "sum" } });
const originalValues: unknown[] = [];
const offD = d.subscribe((m: readonly unknown[]) => { if (m[0] === "DATA") originalValues.push(m[1]); });
assert.equal(d.cache, 3);
a.down([["COMPLETE"]]);
assert.equal(d._dep.terminal[0], true);
const offNewA = a.subscribe(() => {});
a.set(10);
assert.equal(a.cache, 10);
assert.equal(d._dep.prev[0], 1);
assert.equal(d._dep.terminal[0], true);
const checkpoint = g.checkpoint();
assert.equal(checkpoint.nodes.find((n: any) => n.id === "a").value.data, 10);
b.set(3);
assert.equal(d.cache, 4);

const restored = restoreGraph(checkpoint, { registry: {
  ...defaultRestoreRegistry,
  "restartable-state": {
    ref: "restartable-state",
    create(ctx: any) { return ctx.registerState({ name: ctx.name, resubscribable: true }); },
  },
  sum: {
    ref: "sum",
    create(ctx: any) { return ctx.registerNode("sum", ctx.deps, sum, { name: ctx.name }); },
  },
} });
const restoredValues: unknown[] = [];
const rd = restored.find("d");
const offRD = rd.subscribe((m: readonly unknown[]) => { if (m[0] === "DATA") restoredValues.push(m[1]); });
assert.equal(rd.cache, 3);
assert.equal(rd._dep.prev[0], 10);
assert.equal(rd._dep.terminal[0], undefined);
restored.find("b").set(3);
assert.equal(rd.cache, 13);
console.log(JSON.stringify({ sourceCurrentValueAtCapture: 10, endedInputRetainedValueAtCapture: 1,
  originalValues, restoredValues, originalResultAfterB3: 4, restoredResultAfterB3: 13,
  meaning: "current per-node snapshot loses an ended dependency input across upstream restart" }));
offRD(); offD(); offNewA();
console.log("DONE 1 current-runtime roundtrip counterexample; no candidate baseline/lifecycle implementation tested");
