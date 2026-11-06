// Diagnostic consumer qualification; NOT an implementation of the proposed scheduler/lifecycle.
// Real TS library helpers receive a controlled Node-shaped test double whose initial delivery is
// synchronous or manually deferred. This isolates assumptions about subscribe-return timing.
// Run from graphrefly-ts: node_modules/.bin/tsx <absolute path to this file>
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const load = (path: string) => import(pathToFileURL(resolve(path)).href);
const { subscribeNodeValues, readableStore, externalStore } = await load("packages/ts/src/adapters/store.ts");
const { firstValueFrom, singleFromAny } = await load("packages/ts/src/graph/sources.ts");
const { Graph } = await load("packages/ts/src/graph/graph.ts");
const { reactiveList } = await load("packages/ts/src/graph/data-structures/reactive-list.ts");
const { persistReactiveCollection } = await load("packages/ts/src/adapters/reactive-collection-storage.ts");
const { memoryKv, memoryAppendLog } = await load("packages/ts/src/storage/index.ts");
type Sink = (msg: readonly unknown[], delivery?: unknown) => void;

function controlled(options: { deferred: boolean; value?: unknown; fail?: Error }) {
  const registrations = new Set<{ sink: Sink; live: boolean }>();
  const tasks: Array<() => void> = [];
  let releases = 0, starts = 0;
  const facade = {
    cache: options.value,
    subscribe(sink: Sink) {
      const registration = { sink, live: true };
      registrations.add(registration);
      const initialize = () => {
        if (!registration.live) return;
        if (options.fail) {
          registration.live = false;
          registrations.delete(registration);
          throw options.fail; // model the proposed pre-START transition/acquisition failure
        }
        starts++;
        sink(["START"]);
        if (options.value !== undefined) sink(["DATA", options.value]); // initial snapshot: no live metadata
      };
      if (options.deferred) tasks.push(initialize);
      else initialize();
      return () => {
        if (!registration.live) return;
        registration.live = false;
        registrations.delete(registration);
        releases++;
      };
    },
  };
  return {
    facade,
    flush() { for (const task of tasks.splice(0)) task(); },
    emit(msg: readonly unknown[]) {
      for (const registration of [...registrations]) {
        if (registration.live) registration.sink(msg, { waveToken: {}, last: true });
      }
    },
    facts: () => ({ releases, starts, registrations: registrations.size, tasks: tasks.length }),
  };
}

for (const deferred of [false, true]) {
  const source = controlled({ deferred, value: 23 });
  const values: unknown[] = [];
  const off = subscribeNodeValues(source.facade, (value: unknown) => values.push(value), { changesOnly: true });
  source.flush();
  assert.deepEqual(values, deferred ? [23] : []);
  off();
  console.log(JSON.stringify({ case: "changesOnly-initial-snapshot", deferred, values,
    qualification: deferred ? "counterexample: initial snapshot leaks as a change" : "baseline" }));
}

for (const deferred of [false, true]) {
  const source = controlled({ deferred, value: 23 });
  const values: unknown[] = [];
  const off = readableStore(source.facade).subscribe((value: unknown) => values.push(value));
  assert.deepEqual(values, [23]); // helper's explicit immediate read still works before return
  source.flush();
  assert.deepEqual(values, deferred ? [23, 23] : [23]);
  off();
  console.log(JSON.stringify({ case: "readableStore-immediate-read-plus-initial-snapshot", deferred, values,
    qualification: deferred ? "counterexample: duplicate initial value" : "baseline" }));
}

for (const deferred of [false, true]) {
  const source = controlled({ deferred, value: 23 });
  let notifications = 0;
  const store = externalStore(source.facade);
  const off = store.subscribe(() => notifications++);
  assert.equal(store.getSnapshot(), 23);
  source.flush();
  assert.equal(notifications, deferred ? 1 : 0);
  off();
  console.log(JSON.stringify({ case: "externalStore-change-only-notifications", deferred, notifications }));
}

async function drainMicrotasks() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function observe(promise: Promise<unknown>) {
  const state: { kind: string; value?: unknown } = { kind: "pending" };
  promise.then(value => { state.kind = "resolved"; state.value = value; },
    error => { state.kind = "rejected"; state.value = error; });
  return state;
}

{
  const source = controlled({ deferred: true });
  const result = observe(firstValueFrom(source.facade));
  source.flush();
  source.emit(["DATA", 17]);
  await drainMicrotasks();
  assert.deepEqual(result, { kind: "resolved", value: 17 });
  assert.equal(source.facts().registrations, 0);
  assert.equal(source.facts().releases, 1);
  console.log(JSON.stringify({ case: "firstValueFrom-deferred-success", result, facts: source.facts() }));
}

{
  const source = controlled({ deferred: true });
  const error = new Error("protocol failure delivered to the subscribed stream");
  const result = observe(firstValueFrom(source.facade));
  source.flush();
  source.emit(["ERROR", error]);
  await drainMicrotasks();
  assert.equal(result.kind, "rejected");
  assert.equal(result.value, error);
  assert.equal(source.facts().releases, 1);
  console.log(JSON.stringify({ case: "firstValueFrom-deferred-protocol-error", result: result.kind, facts: source.facts() }));
}

for (const deferred of [false, true]) {
  const error = new Error("required old cleanup / acquisition failed before START");
  const source = controlled({ deferred, fail: error });
  const result = observe(firstValueFrom(source.facade));
  let outerError: unknown;
  try { source.flush(); } catch (caught) { outerError = caught; }
  await drainMicrotasks();
  assert.equal(result.kind, deferred ? "pending" : "rejected");
  if (deferred) assert.equal(outerError, error);
  else assert.equal(result.value, error);
  assert.equal(source.facts().registrations, 0);
  assert.equal(source.facts().tasks, 0);
  console.log(JSON.stringify({ case: "firstValueFrom-pre-START-acquisition-failure", deferred,
    promise: result.kind, outerErrorObserved: outerError === error, facts: source.facts(),
    qualification: deferred ? "counterexample: cancelled acquisition has no path to reject Promise" : "baseline" }));
}

{
  const source = controlled({ deferred: true, value: 23 });
  const values: unknown[] = [];
  const off = subscribeNodeValues(source.facade, (value: unknown) => values.push(value));
  off();
  source.flush();
  assert.deepEqual(values, []);
  assert.equal(source.facts().starts, 0);
  console.log(JSON.stringify({ case: "cancel-before-delayed-START", values, facts: source.facts() }));
}

{
  // A real Graph-owned node preserves retain's locality check; only its subscription seam is
  // replaced for this test. No production source file or scheduler is patched.
  const graph = new Graph();
  const node = graph.state(23);
  const source = controlled({ deferred: true, value: 23 });
  const original = node.subscribe;
  Object.defineProperty(node, "subscribe", { configurable: true, value: source.facade.subscribe });
  try {
    const release = graph.retain(node, { reason: "QA-1/2 consumer timing qualification" });
    assert.equal(source.facts().starts, 0);
    release();
    source.flush();
    assert.equal(source.facts().starts, 0);
    assert.equal(source.facts().registrations, 0);
    console.log(JSON.stringify({ case: "graph-retain-release-does-not-require-immediate-START", facts: source.facts() }));
  } finally {
    Object.defineProperty(node, "subscribe", { configurable: true, value: original });
  }
}

for (const deferred of [false, true]) {
  const source = controlled({ deferred, fail: new Error("pre-START transition failed") });
  let factoryCalls = 0;
  const loader = singleFromAny(() => { factoryCalls++; return source.facade; });
  const first = loader("key");
  const observedFirst = observe(first);
  try { source.flush(); } catch { /* the simulated outer operation observes this failure */ }
  await drainMicrotasks();
  const second = loader("key");
  const observedSecond = observe(second);
  try { source.flush(); } catch { /* same bounded test-double failure path */ }
  await drainMicrotasks();
  assert.equal(factoryCalls, deferred ? 1 : 2);
  assert.equal(first === second, deferred);
  assert.equal(observedFirst.kind, deferred ? "pending" : "rejected");
  assert.equal(observedSecond.kind, deferred ? "pending" : "rejected");
  console.log(JSON.stringify({ case: "singleFromAny-inflight-key-after-acquisition-failure", deferred,
    factoryCalls, samePromise: first === second, promise: observedFirst.kind,
    qualification: deferred ? "counterexample: failed key stays in flight" : "baseline" }));
}

for (const deferred of [false, true]) {
  const graph = new Graph();
  const list = reactiveList([1], { graph, name: "list" });
  list.append(2);
  const source = controlled({ deferred, value: list.delta.cache });
  const delta = list.delta;
  const original = delta.subscribe;
  const changes = memoryAppendLog("qualification-changes");
  Object.defineProperty(delta, "subscribe", { configurable: true, value: source.facade.subscribe });
  try {
    const persistence = persistReactiveCollection(graph, list, {
      kind: "reactiveList", name: "qualification-persistence", snapshotStore: memoryKv(),
      changeLog: changes, snapshotOnAttach: false,
    });
    source.flush();
    await new Promise<void>(done => persistence.flush(() => done()));
    const entries = await changes.read();
    assert.equal(entries.length, deferred ? 1 : 0);
    await new Promise<void>(done => persistence.dispose(() => done()));
    console.log(JSON.stringify({ case: "persistent-list-initial-delta-treated-as-new-write", deferred,
      changeWrites: entries.length,
      qualification: deferred ? "counterexample under deferred seam: cached delta persisted again" : "baseline" }));
  } finally {
    Object.defineProperty(delta, "subscribe", { configurable: true, value: original });
  }
}

console.log("DONE consumer qualification: 16 cases; controlled timing, not candidate runtime conformance");
