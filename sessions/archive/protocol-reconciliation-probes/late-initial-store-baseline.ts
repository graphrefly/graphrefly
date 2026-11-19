// Real consumer qualification of a late START-only baseline reset.
// This is NOT an implementation of queued acquisition or the accepted immediate adapter lowering.
// A Node-shaped source double models old cache23 -> fresh empty baseline -> optional later live50.
// Run from TS checkout: node_modules/.bin/tsx <absolute path to this file>.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const load = (path: string) => import(pathToFileURL(resolve(path)).href);
const { externalStore, recordReadableStore } = await load("packages/ts/src/adapters/store.ts");
const { Graph } = await load("packages/ts/src/graph/graph.ts");

type Sink = (message: readonly unknown[], delivery?: unknown) => void;
function delayedEmptyBaseline() {
  const sinks = new Set<Sink>();
  let releaseCalls = 0;
  const source = {
    cache: 23 as number | undefined,
    subscribe(sink: Sink) {
      sinks.add(sink);
      return () => { if (sinks.delete(sink)) releaseCalls++; };
    },
  };
  return {
    source,
    initializeEmpty() {
      source.cache = undefined;
      for (const sink of [...sinks]) if (sinks.has(sink)) sink(["START"]);
    },
    next(value: number) {
      source.cache = value;
      for (const sink of [...sinks]) if (sinks.has(sink)) {
        const wave = {};
        sink(["DIRTY"], { wave, last: false });
        sink(["DATA", value], { wave, last: true });
      }
    },
    facts: () => ({ subscriptions: sinks.size, releaseCalls }),
  };
}

{
  const controlled = delayedEmptyBaseline();
  const store = externalStore(controlled.source);
  const notifications: unknown[] = [];
  const before = store.getSnapshot();
  const off = store.subscribe(() => notifications.push(store.getSnapshot()));
  controlled.initializeEmpty();
  assert.equal(before, 23);
  assert.equal(store.getSnapshot(), undefined);
  assert.deepEqual(notifications, []);
  console.log(JSON.stringify({ case: "externalStore-late-empty-baseline", before,
    afterIsUndefined: store.getSnapshot() === undefined, notifications,
    qualification: "counterexample: getter changes without notifying existing listener" }));
  controlled.next(50);
  assert.deepEqual(notifications, [50]);
  off();
  assert.equal(controlled.facts().subscriptions, 0);
  console.log(JSON.stringify({ case: "externalStore-later-live-recovery", notifications,
    facts: controlled.facts() }));
}

{
  const controlled = delayedEmptyBaseline();
  const graph = new Graph();
  const keys = graph.state(["a"]);
  const store = recordReadableStore(keys, () => ({ value: controlled.source }));
  const values: Array<Record<string, { value: number | undefined }>> = [];
  const off = store.subscribe((value: Record<string, { value: number | undefined }>) => values.push(value));
  assert.equal(values.length, 1);
  assert.equal(values[0].a.value, 23);
  controlled.initializeEmpty();
  assert.equal(store.get().a.value, undefined);
  assert.equal(values.length, 1);
  assert.equal(values[0].a.value, 23);
  console.log(JSON.stringify({ case: "recordReadableStore-field-late-empty-baseline",
    delivered: values, getterFieldIsUndefined: store.get().a.value === undefined,
    qualification: "counterexample: aggregate listener retains old field until a live DATA occurs" }));
  controlled.next(50);
  assert.equal(values.length, 2);
  assert.equal(values[1].a.value, 50);
  off();
  assert.equal(controlled.facts().subscriptions, 0);
  console.log(JSON.stringify({ case: "recordReadableStore-later-live-recovery", values,
    facts: controlled.facts() }));
}
console.log("DONE: 4 real-helper observations; simulated late initialization, unchanged runtime");
