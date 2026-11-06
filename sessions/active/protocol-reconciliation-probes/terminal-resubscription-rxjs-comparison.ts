// QA-21 use-case validation. Runs installed RxJS and current GraphReFly baselines.
// The zero-old-owner candidate is NOT implemented; its admission predicate is reported separately.
// Run from graphrefly-ts. No dependency installation or runtime source edit.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const checkoutRequire = createRequire(resolve("package.json"));
const { Observable, defer, of, throwError, share, shareReplay, retry } = checkoutRequire("rxjs");
const rxVersion = checkoutRequire("rxjs/package.json").version;
const { Graph } = await import(pathToFileURL(resolve("packages/ts/src/graph/graph.ts")).href);
const { repeat } = await import(pathToFileURL(resolve("packages/ts/src/graph/higher-order.ts")).href);

{
  const executions: any[] = [];
  let teardowns = 0;
  const source = new Observable((sink: any) => {
    executions.push(sink);
    return () => { teardowns++; };
  }).pipe(share());
  const a: unknown[] = [], b: unknown[] = [], c: unknown[] = [];
  const subA = source.subscribe((v: unknown) => a.push(v));
  const subB = source.subscribe((v: unknown) => b.push(v));
  assert.equal(executions.length, 1);
  executions[0].next(1); executions[0].complete();
  assert.equal(subA.closed, true); assert.equal(subB.closed, true);
  assert.equal(teardowns, 1);
  // Keep both old subscription objects; never call their unsubscribe before subscribing C.
  const subC = source.subscribe((v: unknown) => c.push(v));
  assert.equal(executions.length, 2);
  executions[1].next(2); executions[1].complete();
  assert.deepEqual([a, b, c], [[1], [1], [2]]);
  assert.equal(subC.closed, true); assert.equal(teardowns, 2);
  console.log(JSON.stringify({ rxVersion, case: "share-late-new-execution-with-old-subscription-objects-retained",
    executions: executions.length, teardowns, a, b, c, oldSubscriptionsClosed: true }));
}

{
  let executions = 0;
  const values: unknown[] = [];
  const subscription = defer(() => ++executions === 1 ? throwError(() => new Error("first attempt")) : of(7))
    .pipe(retry(1)).subscribe((v: unknown) => values.push(v));
  assert.equal(executions, 2); assert.deepEqual(values, [7]); assert.equal(subscription.closed, true);
  console.log(JSON.stringify({ case: "retry-keeps-outer-consumer-through-inner-attempts", executions, values }));
}

{
  let executions = 0;
  const source = defer(() => of(++executions)).pipe(shareReplay({ bufferSize: 1, refCount: true }));
  const a: unknown[] = [], b: unknown[] = [];
  const first = source.subscribe((v: unknown) => a.push(v));
  const second = source.subscribe((v: unknown) => b.push(v));
  assert.equal(executions, 1); assert.deepEqual([a, b], [[1], [1]]);
  assert.equal(first.closed, true); assert.equal(second.closed, true);
  console.log(JSON.stringify({ case: "completed-shareReplay-retains-result", executions, a, b }));
}

{
  const g = new Graph();
  let executions = 0;
  const n = g.producer((ctx: any) => { ctx.down([["DATA", ++executions], ["COMPLETE"]]); },
    { resubscribable: true });
  const a: unknown[] = [], b: unknown[] = [];
  const offA = n.subscribe((m: readonly unknown[]) => { if (m[0] === "DATA") a.push(m[1]); });
  const oldRegistrations = n._lifecycle.subscribers.size;
  assert.equal(oldRegistrations, 1);
  const zeroOldOwnerCandidateWouldAdmit = oldRegistrations === 0;
  assert.equal(zeroOldOwnerCandidateWouldAdmit, false);
  const offB = n.subscribe((m: readonly unknown[]) => { if (m[0] === "DATA") b.push(m[1]); });
  assert.equal(executions, 2); assert.deepEqual([a, b], [[1], [2]]);
  console.log(JSON.stringify({ case: "GraphReFly-existing-late-resubscription", executions, a, b,
    zeroOldOwnerCandidateWouldAdmit }));
  offA(); offB();
}

{
  const g = new Graph(), values: unknown[] = [];
  const n = g.initNode(repeat(() => [1, 2], 3), []);
  const off = n.subscribe((m: readonly unknown[]) => { if (m[0] === "DATA") values.push(m[1]); });
  assert.deepEqual(values, [1, 2, 1, 2, 1, 2]); assert.equal(n.status, "completed");
  console.log(JSON.stringify({ case: "GraphReFly-factory-repeat-keeps-one-outer-subscription", values }));
  off();
}
