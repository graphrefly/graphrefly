// QA-18 current baseline diagnostics, not proposed callback admission/error isolation.
// Run with graphrefly-ts as cwd. Manual recovery below is explicit diagnostic cleanup.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { Graph } = await import(pathToFileURL(resolve("packages/ts/src/graph/graph.ts")).href);

{
  const g = new Graph(), a = g.state(10), b = g.state(0);
  let innerResult: number | undefined;
  const offA = a.subscribe((m: readonly unknown[]) => {
    if (m[0] === "DIRTY") innerResult = g.batch(() => { b.set(99); return 42; });
  });
  const offB = b.subscribe(() => {});
  g.batch((ctx: { rollback(): void }) => { a.set(20); ctx.rollback(); });
  assert.equal(innerResult, 42);
  assert.equal(a.cache, 10);
  assert.equal(b.cache, 0);
  console.log(JSON.stringify({ case: "observer-batch-runs-body-and-joins-ambient-frame",
    innerResult, aCache: a.cache, bCache: b.cache }));
  offA(); offB();
}

{
  const g = new Graph(), a = g.state(10), b = g.state(0);
  const failure = new Error("A observer fails during commit");
  const seenA: unknown[][] = [], seenB: unknown[][] = [];
  let armed = false;
  const offA = a.subscribe((m: readonly unknown[]) => {
    seenA.push([...m]);
    if (armed && m[0] === "DATA") throw failure;
  });
  const offB = b.subscribe((m: readonly unknown[]) => { seenB.push([...m]); });
  seenA.length = 0; seenB.length = 0; armed = true;
  assert.throws(() => g.batch(() => { a.set(20); b.set(30); }), (e) => e === failure);
  assert.equal(a.cache, 20);
  assert.equal(b.cache, 0);
  assert.equal(b.status, "dirty");
  assert.deepEqual(seenB, [["DIRTY"]]);
  console.log(JSON.stringify({ case: "commit-observer-error-aborts-later-target",
    aCache: a.cache, bCache: b.cache, bStatus: b.status, seenA, seenB }));
  armed = false;
  b.__rollbackBatched(); // Baseline did NOT perform this recovery itself.
  offA(); offB();
}
