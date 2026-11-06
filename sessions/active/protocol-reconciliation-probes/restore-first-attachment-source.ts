// Current-baseline restore/activation diagnostic. No external work/network/timer is started.
// A source's fn entry counter stands in for setup; NOT a proposed reconnect policy implementation.
// Run from graphrefly-ts: node_modules/.bin/tsx <absolute path>.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const load = (path: string) => import(pathToFileURL(resolve(path)).href);
const { Graph } = await load("packages/ts/src/graph/graph.ts");
const { restoreGraph, defaultRestoreRegistry } = await load("packages/ts/src/graph/restore.ts");

const original = new Graph();
let originalEntries = 0, restoredEntries = 0;
const source = original.node([], (ctx: any) => {
  originalEntries++;
  ctx.down([["DATA", 23]]);
}, { name: "source", restore: { ref: "controlled-source" } });
const originalOff = source.subscribe(() => {});
const checkpoint = original.checkpoint();
assert.equal(originalEntries, 1);
const saved = checkpoint.nodes.find((n: any) => n.id === "source");
assert.equal(saved.lifecycle.hasCalledFnOnce, true);
originalOff();

const restored = restoreGraph(checkpoint, { registry: {
  ...defaultRestoreRegistry,
  "controlled-source": {
    ref: "controlled-source",
    create(ctx: any) {
      return ctx.registerNode("controlled-source", [], (run: any) => {
        restoredEntries++;
        run.down([["DATA", 24]]);
      }, { name: ctx.name });
    },
  },
} });
const node = restored.find("source");
assert.equal(node.cache, 23);
assert.equal(node._restoredActivationPending, true);
const firstValues: unknown[] = [];
const firstOff = node.subscribe((m: readonly unknown[]) => { if (m[0] === "DATA") firstValues.push(m[1]); });
assert.deepEqual(firstValues, [23]);
assert.equal(restoredEntries, 0);
assert.equal(node._restoredActivationPending, false);
console.log(JSON.stringify({ case: "restored-first-attachment", firstValues, restoredFnEntries: restoredEntries,
  activated: node._lifecycle.activated, hasCalledFnOnce: node._wave.hasCalledFnOnce,
  restoredActivationPending: node._restoredActivationPending,
  interpretation: "cached result attaches without fn/setup re-entry; not proof of live external resources" }));

firstOff();
const secondValues: unknown[] = [];
const secondOff = node.subscribe((m: readonly unknown[]) => { if (m[0] === "DATA") secondValues.push(m[1]); });
assert.deepEqual(secondValues, [24]);
assert.equal(restoredEntries, 1);
console.log(JSON.stringify({ case: "later-ordinary-reactivation", secondValues,
  restoredFnEntries: restoredEntries, restoredActivationPending: node._restoredActivationPending }));
secondOff();
for (const scenario of ["never-evaluated-derived", "input-changed-before-first-attachment"] as const) {
  const original = new Graph();
  const input = original.state(1, { name: "input" });
  const derived = original.node([input], (ctx: any) => {
    ctx.down([["DATA", input.cache + 1]]);
  }, { name: "derived", restore: { ref: "controlled-derived" } });
  const originalOff = scenario === "input-changed-before-first-attachment"
    ? derived.subscribe(() => {}) : undefined;
  const saved = original.checkpoint();
  originalOff?.();
  let entries = 0;
  const restored = restoreGraph(saved, { registry: {
    ...defaultRestoreRegistry,
    "controlled-derived": {
      ref: "controlled-derived",
      create(ctx: any) {
        return ctx.registerNode("controlled-derived", ctx.deps, (run: any) => {
          entries++;
          run.down([["DATA", ctx.deps[0].cache + 1]]);
        }, { name: ctx.name });
      },
    },
  } });
  const restoredInput = restored.find("input");
  const restoredDerived = restored.find("derived");
  if (scenario === "input-changed-before-first-attachment") restoredInput.set(5);
  const values: unknown[] = [];
  const off = restoredDerived.subscribe((m: readonly unknown[]) => { if (m[0] === "DATA") values.push(m[1]); });
  assert.equal(entries, 0);
  assert.deepEqual(values, scenario === "never-evaluated-derived" ? [] : [2]);
  assert.equal(restoredInput.cache, scenario === "never-evaluated-derived" ? 1 : 5);
  console.log(JSON.stringify({ case: scenario, initialValues: [...values], input: restoredInput.cache,
    derivedCacheIsUndefined: restoredDerived.cache === undefined, restoredFnEntries: entries,
    hasCalledFnOnce: restoredDerived._wave.hasCalledFnOnce,
    interpretation: "baseline observation for separate bootstrap eligibility/freshness decision" }));
  restoredInput.set(6);
  assert.equal(values.at(-1), 7);
  assert.equal(entries, 1);
  off();
}
console.log("DONE: 4 current-runtime restore observations; no candidate reconnect semantics installed");
