// QA-17 diagnostics of current per-message TS baseline, NOT full-wave conformance.
// Run with graphrefly-ts as cwd. Each case explicitly releases its surviving subscriptions.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { Graph } = await import(pathToFileURL(resolve("packages/ts/src/graph/graph.ts")).href);

{
  const g = new Graph(), n = g.state(10), seen: unknown[][] = [];
  let offC: (() => void) | undefined;
  const offA = n.subscribe((msg: readonly unknown[]) => {
    if (msg[0] === "DATA" && msg[1] === 23) {
      offC = n.subscribe((next: readonly unknown[]) => { seen.push([...next]); });
    }
  });
  n.down([["DATA", 23], ["DATA", 30]]);
  assert.deepEqual(seen, [["START"], ["DATA", 23], ["DATA", 30]]);
  console.log(JSON.stringify({ case: "new-subscriber-joins-message-suffix", seen }));
  offA(); offC?.();
}

{
  const g = new Graph(), n = g.state(10), seen: unknown[][] = [];
  const b = (msg: readonly unknown[]) => { seen.push([...msg]); };
  let offB: () => void = () => {};
  let offNewB: (() => void) | undefined;
  const offA = n.subscribe((msg: readonly unknown[]) => {
    if (msg[0] === "DATA" && msg[1] === 30) {
      offB();
      offNewB = n.subscribe(b);
    }
  });
  offB = n.subscribe(b);
  seen.length = 0;
  n.set(30);
  assert.equal(seen.filter((m) => m[0] === "DATA" && m[1] === 30).length, 2);
  console.log(JSON.stringify({ case: "remove-readd-same-callback-retargets-old-fanout", seen }));
  offA(); offNewB?.();
}
