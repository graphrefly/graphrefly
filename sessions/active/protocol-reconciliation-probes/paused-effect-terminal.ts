// Current TS policy comparison for QA-8; proposed grouped terminal options are not implemented.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { Graph } = await import(pathToFileURL(resolve("packages/ts/src/graph/graph.ts")).href);
for (const delegated of [false, true]) {
  const graph = new Graph();
  const source = graph.state(0);
  const effects: unknown[] = [];
  const effect = graph.effect([source], (value: unknown) => { effects.push(value); },
    delegated ? { completeWhenDepsComplete: false, terminalAsRealInput: true } : {});
  const observed: string[] = [];
  const off = effect.subscribe((msg: readonly unknown[]) => { observed.push(String(msg[0])); });
  effect.up([["PAUSE", "lock"]]);
  source.down([["DATA", 23], ["COMPLETE"]]);
  const beforeResume = effect.status;
  effect.up([["RESUME", "lock"]]);
  assert.deepEqual(effects, delegated ? [0, 23] : [0]);
  if (delegated) assert.ok(!observed.includes("COMPLETE"));
  else {
    assert.equal(beforeResume, "completed");
    assert.ok(observed.includes("COMPLETE"));
  }
  console.log(JSON.stringify({ delegated, effects, beforeResume, observed }));
  off();
}
