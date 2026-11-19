// QA-14 diagnostic of current TS baseline; no proposed INVALIDATE repair is implemented.
// Run with graphrefly-ts as cwd. Undefined in waveData is the INVALIDATE sentinel.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const fromCheckout = (path: string) => import(pathToFileURL(resolve(path)).href);
const { Graph } = await fromCheckout("packages/ts/src/graph/graph.ts");
const { scan } = await fromCheckout("packages/ts/src/graph/operators.ts");
const copy = (ctx: any) => ctx.waveData.map((dep: any[]) => dep.map((wave: any[]) => [...wave]));

{
  const g = new Graph(), source = g.state(10);
  const rawInputs: any[] = [], derivedCalls: unknown[] = [], sums: unknown[] = [];
  const raw = g.node([source], (ctx: any) => { rawInputs.push(copy(ctx)); });
  const derived = g.derived([source], (v: unknown) => { derivedCalls.push(v); return v; });
  const accumulated = g.initNode(scan((acc: number, v: number) => acc + v, 0), [source]);
  const releases = [raw.subscribe(() => {}), derived.subscribe(() => {}),
    accumulated.subscribe((m: readonly unknown[]) => { if (m[0] === "DATA") sums.push(m[1]); })];
  for (const n of [raw, derived, accumulated]) n.up([["PAUSE", "L"]]);
  for (const value of [20, 21, 30]) source.set(value);
  assert.equal(rawInputs.length, 1);
  assert.deepEqual(derivedCalls, [10]);
  assert.deepEqual(sums, [10]);
  for (const n of [raw, derived, accumulated]) n.up([["RESUME", "L"]]);
  assert.deepEqual(rawInputs, [[[[10]]], [[[20], [21], [30]]]]);
  assert.deepEqual(derivedCalls, [10, 30]);
  assert.deepEqual(sums, [10, 30, 51, 81]);
  console.log(JSON.stringify({ case: "pause-preserves-occurrences", rawInputs, derivedCalls, sums }));
  for (const off of releases) off();
}

{
  const g = new Graph(), source = g.state(10), inputs: any[] = [];
  const n = g.node([source], (ctx: any) => { inputs.push(copy(ctx)); });
  const off = n.subscribe(() => {});
  n.up([["PAUSE", "L"]]);
  source.set(20);
  source.down([["INVALIDATE"]]);
  n.up([["RESUME", "L"]]);
  assert.equal(inputs.length, 1); // D50 cancels this paused invocation.
  source.set(30);
  assert.deepEqual(inputs[1], [[[20], [undefined], [30]]]);
  console.log(JSON.stringify({ case: "invalidate-cancels-call-but-retains-history", inputs,
    note: "JSON null in the second projection denotes undefined/INVALIDATE, not DATA(null)" }));
  off();
}
