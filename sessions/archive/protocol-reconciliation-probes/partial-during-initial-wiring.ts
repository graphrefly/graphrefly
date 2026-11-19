// Diagnostic assertions for TS baseline dafc5ae5, not future conformance.
// Run from the TS checkout: node_modules/.bin/tsx <absolute path to this file>.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const fromCheckout = (path: string) => import(pathToFileURL(resolve(path)).href);
const { Graph } = await fromCheckout("packages/ts/src/graph/graph.ts");
const { takeUntil } = await fromCheckout("packages/ts/src/graph/combinators.ts");
const { subscriberCountOfNode } = await fromCheckout("packages/ts/src/node/runtime-accessors.ts");
const { depBatch, depLatest } = await fromCheckout("packages/ts/src/ctx/types.ts");

const graph = new Graph();
const b = graph.state(10);
const trace: unknown[] = [];
const c = graph.node([], (ctx: any) => {
  trace.push({ kind: "C-start" });
  ctx.down([["DATA", 20]]);
});
const d = graph.node([b, c], (ctx: any) => {
  trace.push({
    kind: "D-fn",
    cSubscribers: subscriberCountOfNode(c),
    b: depLatest(ctx, 0),
    c: depLatest(ctx, 1) ?? "empty",
  });
}, { partial: true });
const off = d.subscribe(() => {});
assert.deepEqual(trace, [
  { kind: "D-fn", cSubscribers: 0, b: 10, c: "empty" },
  { kind: "C-start" },
  { kind: "D-fn", cSubscribers: 1, b: 10, c: 20 },
]);
off();

const graph2 = new Graph();
const source = graph2.state(23);
const notifier = graph2.state(true);
const op = takeUntil();
const invocations: Array<{ notifierSubscribers: number; source: unknown[]; notifier: unknown[] }> = [];
const taken = graph2.initNode({ ...op, body: (ctx: any) => {
  invocations.push({
    notifierSubscribers: subscriberCountOfNode(notifier),
    source: [...(depBatch(ctx, 0) ?? [])],
    notifier: [...(depBatch(ctx, 1) ?? [])],
  });
  op.body(ctx);
} }, [source, notifier]);
const messages: any[] = [];
const release = taken.subscribe((message: unknown) => messages.push(message));
assert.deepEqual(messages.filter((message) => message[0] === "DATA").map((message) => message[1]), [23]);
assert.equal(messages.at(-1)[0], "COMPLETE");
assert.equal(invocations[0].notifierSubscribers, 0);

// Body-only counterfactual: retained source and notifier inputs coalesced into one invocation.
// This is NOT a runtime implementation or test of a complete deferred/replay design.
const coalescedBodyOnly: unknown[] = [];
op.body({
  waveData: [[[23]], [[true]]],
  down: (wave: unknown[]) => coalescedBodyOnly.push(...wave),
} as any);
assert.deepEqual(coalescedBodyOnly, [["COMPLETE"]]);
release();
console.log(JSON.stringify({ trace, takeUntil: { invocations, messages, coalescedBodyOnly } }));
