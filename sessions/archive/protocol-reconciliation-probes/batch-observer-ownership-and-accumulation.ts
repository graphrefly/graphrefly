// QA-18 current baseline diagnostics, not validation of proposed observer FIFO/batch retention.
// Run with graphrefly-ts as cwd. Observer callbacks are currently per-message.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { Graph } = await import(pathToFileURL(resolve("packages/ts/src/graph/graph.ts")).href);

for (const abort of [false, true]) {
  const g = new Graph(), a = g.state(10), b = g.state(0);
  const events: unknown[][] = [];
  let armed = true;
  const offA = a.subscribe((m: readonly unknown[]) => {
    events.push(["A", ...m]);
    if (m[0] === "DIRTY" && armed) { armed = false; b.set(99); }
  });
  const offB = b.subscribe((m: readonly unknown[]) => { events.push(["B", ...m]); });
  events.length = 0;
  g.batch((ctx: { rollback(): void }) => {
    a.set(20);
    assert.equal(b.cache, 0);
    if (abort) ctx.rollback();
  });
  assert.equal(a.cache, abort ? 10 : 20);
  assert.equal(b.cache, abort ? 0 : 99);
  console.log(JSON.stringify({ case: "early-dirty-observer-update-joins-ambient-batch", abort,
    aCache: a.cache, bCache: b.cache, events }));
  offA(); offB();
}

for (const updates of [
  [[["DATA", 23]], [["DATA", 23]], [["DATA", 30]]],
  [[["RESOLVED"]], [["DATA", 30]]],
  [[["DATA", 30]], [["RESOLVED"]]],
] as const) {
  const g = new Graph(), n = g.state(10), seen: unknown[][] = [];
  const off = n.subscribe((m: readonly unknown[]) => { seen.push([...m]); });
  seen.length = 0;
  g.batch(() => { for (const wave of updates) n.down(wave); });
  const last = updates.at(-1)!;
  assert.deepEqual(seen, [["DIRTY"], ...last]);
  assert.equal(n.cache, last[0][0] === "DATA" ? 30 : 10);
  console.log(JSON.stringify({ case: "last-submission-replaces-earlier-batch-data", updates, seen, cache: n.cache }));
  off();
}
