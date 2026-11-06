// QA-19 current public down baseline. Does NOT simulate the proposed observer FIFO.
// Run with graphrefly-ts as cwd; private lifecycle inspection is diagnostic only.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { Graph } = await import(pathToFileURL(resolve("packages/ts/src/graph/graph.ts")).href);

{
  const g = new Graph();
  let runs = 0;
  const n = g.producer((ctx: any) => { runs++; ctx.down([["DATA", 10]]); });
  const off = n.subscribe(() => {});
  off();
  assert.equal(n.cache, undefined);
  assert.equal(n._lifecycle.activated, false);
  n.down([["DATA", 30]]);
  assert.equal(n.cache, 30);
  assert.equal(n._lifecycle.activated, false);
  assert.equal(runs, 1);
  const data: unknown[] = [];
  const offNew = n.subscribe((m: readonly unknown[]) => { if (m[0] === "DATA") data.push(m[1]); });
  assert.deepEqual(data, [30, 10]);
  assert.equal(runs, 2);
  console.log(JSON.stringify({ case: "inactive-producer-cache-repopulated-by-public-down", data, runs }));
  offNew();
}

{
  const g = new Graph(), n = g.producer(() => {});
  const off = n.subscribe(() => {});
  off();
  n.down([["COMPLETE"]]);
  assert.equal(n._lifecycle.activated, false);
  assert.equal(n.status, "completed");
  assert.throws(() => n.subscribe(() => {}), /non-resubscribable/);
  console.log(JSON.stringify({ case: "inactive-producer-terminal-by-public-down", status: n.status }));
}

{
  const g = new Graph(), state = g.state(10), manual = g.node([], null);
  const offState = state.subscribe(() => {}), offManual = manual.subscribe(() => {});
  offState(); offManual();
  state.set(30);
  manual.down([["DATA", 40]]);
  assert.equal(state.cache, 30);
  assert.equal(manual.cache, 40);
  console.log(JSON.stringify({ case: "inactive-stable-inputs", stateCache: state.cache, manualCache: manual.cache }));
}
