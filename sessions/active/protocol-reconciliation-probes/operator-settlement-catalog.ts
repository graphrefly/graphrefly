// TS dafc5ae5 baseline diagnostics. These do not implement/test a deferred-ticket redesign.
// Run from the TS checkout with node_modules/.bin/tsx and this file's absolute path.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const fromCheckout = (path: string) => import(pathToFileURL(resolve(path)).href);
const { Graph } = await fromCheckout("packages/ts/src/graph/graph.ts");
const { filter, map, reduce } = await fromCheckout("packages/ts/src/graph/operators.ts");
const { bufferCount, zip } = await fromCheckout("packages/ts/src/graph/combinators.ts");
const { mergeMap, switchMap } = await fromCheckout("packages/ts/src/graph/higher-order.ts");
const { delay } = await fromCheckout("packages/ts/src/graph/time.ts");

const data = (messages: any[]) => messages.filter((m) => m[0] === "DATA").map((m) => m[1]);
const types = (messages: any[]) => messages.map((m) => m[0]);
const results: Record<string, unknown> = {};

{
  const g = new Graph(), source = g.node([], null);
  const output = g.initNode(reduce((sum: number, v: number) => sum + v, 0), [source]);
  const messages: any[] = [], off = output.subscribe((m: unknown) => messages.push(m));
  source.down([["DATA", 1]]);
  const beforeComplete = [...messages];
  assert.equal(messages.at(-1)[0], "RESOLVED");
  assert.deepEqual(data(messages), []);
  source.down([["COMPLETE"]]);
  assert.deepEqual(data(messages), [1]);
  assert.equal(messages.at(-1)[0], "COMPLETE");
  results.reduce = { beforeComplete, messages };
  off();
}
{
  const g = new Graph(), source = g.node([], null);
  const output = g.initNode(bufferCount(3), [source]);
  const messages: any[] = [], off = output.subscribe((m: unknown) => messages.push(m));
  source.down([["DATA", 1]]);
  assert.equal(messages.at(-1)[0], "RESOLVED");
  source.down([["DATA", 2]]);
  assert.deepEqual(data(messages), []);
  assert.equal(messages.at(-1)[0], "RESOLVED");
  const beforeThird = [...messages];
  source.down([["DATA", 3]]);
  assert.deepEqual(data(messages), [[1, 2, 3]]);
  results.bufferCount = { beforeThird, messages };
  off();
}
{
  const g = new Graph(), a = g.node([], null), b = g.node([], null);
  const output = g.initNode(zip(), [a, b]);
  const messages: any[] = [], off = output.subscribe((m: unknown) => messages.push(m));
  a.down([["DATA", 1]]);
  assert.equal(messages.at(-1)[0], "RESOLVED");
  assert.deepEqual(data(messages), []);
  const beforeB = [...messages];
  b.down([["DATA", 2]]);
  assert.deepEqual(data(messages), [[1, 2]]);
  results.zip = { beforeB, messages };
  off();
}
{
  const g = new Graph(), source = g.node([], null), inner = g.node([], () => {});
  const output = g.initNode(mergeMap(() => inner), [source]);
  const messages: any[] = [], off = output.subscribe((m: unknown) => messages.push(m));
  source.down([["DATA", 1]]);
  assert.ok(types(messages).includes("RESOLVED"));
  assert.deepEqual(data(messages), []);
  const beforeInner = [...messages];
  inner.down([["DATA", 10]]);
  assert.deepEqual(data(messages), [10]);
  results.mergeMap = { beforeInner, messages };
  off();
}
{
  const g = new Graph(), source = g.node([], null);
  let cancelledA = 0;
  const a = g.node([], (ctx: any) => ctx.onDeactivation(() => cancelledA++));
  const b = g.node([], () => {});
  const output = g.initNode(switchMap((v: number) => v === 1 ? a : b), [source]);
  const messages: any[] = [], off = output.subscribe((m: unknown) => messages.push(m));
  source.down([["DATA", 1]]);
  source.down([["DATA", 2]]);
  assert.equal(cancelledA, 1);
  assert.ok(types(messages).includes("RESOLVED"));
  a.down([["DATA", 9]]);
  assert.deepEqual(data(messages), []);
  b.down([["DATA", 20]]);
  assert.deepEqual(data(messages), [20]);
  results.switchMap = { cancelledA, messages };
  off();
}
{
  const g = new Graph(), source = g.node([], null), output = g.initNode(delay(5), [source]);
  const messages: any[] = [];
  let delivered!: () => void;
  const ready = new Promise<void>((resolveReady) => { delivered = resolveReady; });
  const off = output.subscribe((m: any) => {
    messages.push(m);
    if (m[0] === "DATA") delivered();
  });
  source.down([["DATA", 7]]);
  assert.ok(types(messages).includes("RESOLVED"));
  assert.deepEqual(data(messages), []);
  const beforeTimer = [...messages];
  await ready;
  assert.deepEqual(data(messages), [7]);
  results.delay = { beforeTimer, messages };
  off();
}
{
  const g = new Graph(), source = g.node([], null), inner = g.node([], () => {});
  const fast = g.initNode(map((v: number) => v), [source]);
  const slow = g.initNode(mergeMap(() => inner), [source]);
  const pairs: unknown[][] = [];
  const join = g.derived([fast, slow], (a: unknown, b: unknown) => {
    pairs.push([a, b]);
    return [a, b];
  }, { partial: true });
  const off = join.subscribe(() => {});
  source.down([["DATA", 1]]);
  assert.deepEqual(pairs, [[1, undefined]]);
  inner.down([["DATA", 10]]);
  assert.deepEqual(pairs, [[1, undefined], [1, 10]]);
  results.join = { pairs: pairs.map((pair) => pair.map((v) => v === undefined ? "missing" : v)) };
  off();
}
{
  const g = new Graph(), source = g.node([], null);
  let finishWithoutData!: () => void;
  const output = g.node([source], (ctx: any) => {
    finishWithoutData = () => ctx.down([["RESOLVED"]]);
  }, { pool: "async" });
  const messages: any[] = [], off = output.subscribe((m: unknown) => messages.push(m));
  source.down([["DATA", 1]]);
  assert.equal(messages.at(-1)[0], "DIRTY");
  assert.ok(!types(messages).includes("RESOLVED"));
  finishWithoutData();
  assert.equal(messages.at(-1)[0], "RESOLVED");
  assert.deepEqual(data(messages), []);
  results.explicitAsyncResolved = { messages };
  off();
}
{
  const g = new Graph(), source = g.node([], null);
  const output = g.initNode(filter(() => false), [source], { pool: "async" });
  const messages: any[] = [], off = output.subscribe((m: unknown) => messages.push(m));
  source.down([["DATA", 1]]);
  assert.equal(messages.at(-1)[0], "DIRTY");
  assert.ok(!types(messages).includes("RESOLVED"));
  results.asyncPoolFilterReject = { messages };
  off();
}
console.log(JSON.stringify(results));
