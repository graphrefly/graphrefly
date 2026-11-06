// Bounded current-TS diagnostic; does not implement the accepted whole-array redesign.
// Run from a TS checkout: node_modules/.bin/tsx <absolute path to this file>.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const fromCheckout = (path: string) => import(pathToFileURL(resolve(path)).href);
const { Graph } = await fromCheckout("packages/ts/src/graph/graph.ts");
const { map, tap, rescue, valve } = await fromCheckout("packages/ts/src/graph/operators.ts");
const { withLatestFrom, race } = await fromCheckout("packages/ts/src/graph/combinators.ts");
const results: Record<string, unknown> = {};

function run(name: string, setup: (g: any, source: any, calls: unknown[]) => any,
  suffix: any[], expectedData: unknown[], expectedCalls?: unknown[], expectedTerminal = true) {
  const g = new Graph();
  const source = g.node([], null);
  const calls: unknown[] = [];
  const output = setup(g, source, calls);
  const messages: any[] = [];
  const off = output.subscribe((m: any) => messages.push(m));
  try {
    source.down([["DATA", 23], ...suffix]);
    const values = messages.filter(m => m[0] === "DATA").map(m => m[1]);
    const terminals = messages.filter(m => m[0] === "COMPLETE" || m[0] === "ERROR");
    assert.deepEqual(values, expectedData);
    assert.equal(terminals.length > 0, expectedTerminal);
    if (expectedCalls !== undefined) assert.deepEqual(calls, expectedCalls);
    results[name] = { values, calls, terminals };
  } finally {
    off();
  }
}

run("mapComplete", (g, s) => g.initNode(map((v: number) => v * 2), [s]),
  [["COMPLETE"]], [46]);
run("tapFunctionComplete", (g, s, calls) => g.initNode(tap((v: number) => calls.push(v)), [s]),
  [["COMPLETE"]], [23], [23]);
run("tapObserverComplete", (g, s, calls) => g.initNode(tap({
  data: (v: number) => calls.push(v), complete: () => calls.push("complete"),
}), [s]), [["COMPLETE"]], [], ["complete"]);
run("tapObserverError", (g, s, calls) => g.initNode(tap({
  data: (v: number) => calls.push(v), error: (e: unknown) => calls.push(e),
}), [s]), [["ERROR", "fault"]], [], ["fault"]);
run("withLatestFromPrimaryComplete", (g, s) => g.initNode(withLatestFrom(), [s, g.state(9)]),
  [["COMPLETE"]], []);
run("openValveComplete", (g, s) => g.initNode(valve(), [s, g.state(true)]),
  [["COMPLETE"]], []);
run("rescueError", (g, s) => g.initNode(rescue(() => 99), [s]),
  [["ERROR", "fault"]], [23, 99], undefined, false);
run("raceWinningDataComplete", (g, s) => g.initNode(race(), [s, g.node([], null)]),
  [["COMPLETE"]], [23], undefined, false);

console.log(JSON.stringify({ baseline: "dafc5ae57d446a59a7388214c31bd7a6e73d1519", results }));
console.log("DONE 8");
