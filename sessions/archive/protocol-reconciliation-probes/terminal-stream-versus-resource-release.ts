// Current TS separation of terminal delivery and cleanup, not the proposed retirement contract.
// Run from graphrefly-ts. Hooks count cleanup attempts; no actual external resource is acquired.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { Graph } = await import(pathToFileURL(resolve("packages/ts/src/graph/graph.ts")).href);
const { take } = await import(pathToFileURL(resolve("packages/ts/src/graph/operators.ts")).href);

{
  const g = new Graph(), cleanups: number[] = [], types: unknown[] = [];
  const n = g.producer((ctx: any) => {
    ctx.onDeactivation(() => { cleanups.push(1); });
    ctx.down([["DATA", 1], ["COMPLETE"]]);
  }, { resubscribable: true });
  const off = n.subscribe((m: readonly unknown[]) => { types.push(m[0]); });
  assert.equal(types.at(-1), "COMPLETE");
  assert.deepEqual(cleanups, []);
  assert.equal(n._lifecycle.activated, true);
  const afterTerminal = { terminalDelivered: true, cleanupCalls: 0, registrationCount: n._lifecycle.subscribers.size };
  off();
  assert.deepEqual(cleanups, [1]);
  console.log(JSON.stringify({ case: "terminal-then-explicit-off", afterTerminal, afterOffCleanups: cleanups }));
}

{
  const g = new Graph(), cleanups: number[] = [];
  let runs = 0;
  const n = g.producer((ctx: any) => {
    const run = ++runs;
    ctx.onDeactivation(() => { cleanups.push(run); });
    ctx.down([["DATA", run], ["COMPLETE"]]);
  }, { resubscribable: true });
  const releaseRetain = g.retain(n, { reason: "QA-21 execution scope diagnostic" });
  assert.equal(runs, 1); // Retain alone did not automatically repeat the completed source.
  const values: unknown[] = [];
  const off = n.subscribe((m: readonly unknown[]) => { if (m[0] === "DATA") values.push(m[1]); });
  assert.equal(runs, 2);
  assert.deepEqual(values, [2]);
  assert.deepEqual(cleanups, []); // Baseline reset skipped old run's cleanup.
  releaseRetain();
  assert.equal(n._lifecycle.subscribers.size, 1); // Old release does not remove the distinct new sink.
  off();
  assert.deepEqual(cleanups, [2]);
  console.log(JSON.stringify({ case: "retain-does-not-imply-auto-repeat", runs, values,
    cleanedRuns: cleanups, oldRunCleanupSkippedByBaseline: true }));
}

{
  const g = new Graph();
  let sourceCtx: any, cleanups = 0;
  const source = g.producer((ctx: any) => {
    sourceCtx = ctx;
    ctx.onDeactivation(() => { cleanups++; });
  });
  const one = g.initNode(take(1), [source]);
  const seen: unknown[][] = [];
  const off = one.subscribe((m: readonly unknown[]) => { seen.push([...m]); });
  sourceCtx.down([["DATA", 7]]);
  assert.equal(one.status, "completed");
  assert.equal(cleanups, 0);
  const beforeOff = { cleanups, sourceSubscriptions: source._lifecycle.subscribers.size };
  off();
  assert.equal(cleanups, 1);
  console.log(JSON.stringify({ case: "GraphReFly-take1-retains-upstream-until-off", beforeOff, afterOffCleanups: cleanups }));
}

{
  const fromCheckout = createRequire(resolve("package.json"));
  const { Observable, take: rxTake } = fromCheckout("rxjs");
  let sourceSink: any, cleanups = 0;
  const source = new Observable((sink: any) => { sourceSink = sink; return () => { cleanups++; }; });
  const subscription = source.pipe(rxTake(1)).subscribe(() => {});
  sourceSink.next(7);
  assert.equal(subscription.closed, true);
  assert.equal(cleanups, 1);
  console.log(JSON.stringify({ case: "RxJS-take1-releases-upstream-without-manual-off", cleanups, closed: subscription.closed }));
}

{
  const g = new Graph();
  let sourceCtx: any, cleanups = 0;
  const source = g.producer((ctx: any) => {
    sourceCtx = ctx;
    ctx.onDeactivation(() => { cleanups++; });
  });
  const one = g.initNode(take(1), [source]);
  const offOne = one.subscribe(() => {});
  const other: unknown[] = [];
  const offOther = source.subscribe((m: readonly unknown[]) => { if (m[0] === "DATA") other.push(m[1]); });
  sourceCtx.down([["DATA", 7]]);
  assert.equal(one.status, "completed");
  offOne(); // Existing explicit release, not automatic candidate behavior.
  assert.equal(source._lifecycle.subscribers.size, 1);
  assert.equal(cleanups, 0);
  sourceCtx.down([["DATA", 8]]);
  assert.deepEqual(other, [7, 8]);
  offOther();
  assert.equal(cleanups, 1);
  console.log(JSON.stringify({ case: "release-one-branch-preserves-other-source-owner", other, finalCleanups: cleanups }));
}
