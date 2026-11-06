// Baseline diagnostic: a live quiet PULL edge can retain DATA that restore loses.
// Run from the TS checkout. No candidate snapshot schema or runtime changes.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const load = (path: string) => import(pathToFileURL(resolve(path)).href);
const { Graph } = await load("packages/ts/src/graph/graph.ts");
const { restoreGraph, defaultRestoreRegistry } = await load("packages/ts/src/graph/restore.ts");
const { depLatest } = await load("packages/ts/src/ctx/types.ts");
const pullId = "snapshot";
const holderFn = (ctx: any) => ctx.down([["DATA", depLatest(ctx, 0)]]);
const sumFn = (ctx: any) => ctx.down([["DATA", (depLatest(ctx, 0) ?? 0) + (depLatest(ctx, 1) ?? 0)]]);
const graph = new Graph();
const source = graph.state(10, { name: "source" });
const other = graph.state(2, { name: "other" });
const holder = graph.node([source], holderFn, {
  name: "holder", pullId, restore: { ref: "pull-holder" },
});
const sum = graph.node([holder, other], sumFn, {
  name: "sum", partial: true, restore: { ref: "sum" },
});
const releases: Array<() => void> = [];
try {
  releases.push(sum.subscribe(() => {}));
  holder.up([["PULL", { pullId }]]);
  assert.equal(sum.cache, 12);
  assert.equal(sum._dep.hasData[0], true);
  assert.equal(sum._dep.prev[0], 10);
  assert.equal(sum._dep.terminal[0], undefined);
  const checkpoint = JSON.parse(JSON.stringify(graph.checkpoint()));
  const restored = restoreGraph(checkpoint, {
    registry: {
      ...defaultRestoreRegistry,
      "pull-holder": {
        ref: "pull-holder",
        create(ctx: any) { return ctx.registerNode("pull-holder", ctx.deps, holderFn, {
          name: ctx.name, pullId,
        }); },
      },
      sum: {
        ref: "sum",
        create(ctx: any) { return ctx.registerNode("sum", ctx.deps, sumFn, {
          name: ctx.name, partial: true,
        }); },
      },
    },
  });
  const restoredSum = restored.find("sum");
  releases.push(restoredSum.subscribe(() => {}));
  assert.equal(restoredSum.cache, 12);
  assert.equal(restored.find("holder").cache, 10);
  assert.equal(restoredSum._dep.hasData[0], false);
  other.set(3);
  restored.find("other").set(3);
  assert.equal(sum.cache, 13);
  assert.equal(restoredSum.cache, 3);
  console.log(JSON.stringify({ originalInput: 10, restoredInput: restoredSum._dep.prev[0] ?? "SENTINEL",
    originalAfterOther3: sum.cache, restoredAfterOther3: restoredSum.cache,
    meaning: "node-only restore loses received DATA on a nonterminal quiet PULL dependency" }));
} finally {
  for (const release of releases.reverse()) release();
}
console.log("DONE 1 baseline live PULL input counterexample; no proposed checkpoint implementation tested");
