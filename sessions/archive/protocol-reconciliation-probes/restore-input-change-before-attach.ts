// Current baseline only. No proposed invalidation/tracking mechanism is installed.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const load = (p: string) => import(pathToFileURL(resolve(p)).href);
const { Graph } = await load("packages/ts/src/graph/graph.ts");
const { restoreGraph, defaultRestoreRegistry } = await load("packages/ts/src/graph/restore.ts");
const { depLatest } = await load("packages/ts/src/ctx/types.ts");

for (const scenario of [
  { name: "unchanged", writes: [], versioning: 0 },
  { name: "same-value-event", writes: [1], versioning: 0 },
  { name: "different-value", writes: [5], versioning: 0 },
  { name: "several-unobserved-events", writes: [3, 5], versioning: 0 },
  { name: "versioning-disabled", writes: [5], versioning: false },
] as const) {
  const original = new Graph({ versioning: scenario.versioning });
  const input = original.state(1, { name: "input" });
  const derived = original.node([input], (ctx: any) => {
    ctx.down([["DATA", depLatest(ctx, 0) + 1]]);
  }, { name: "derived", restore: { ref: "controlled-inc" } });
  const originalOff = derived.subscribe(() => {});
  const saved = original.checkpoint();
  originalOff();
  let calls = 0;
  const restored = restoreGraph(saved, { registry: {
    ...defaultRestoreRegistry,
    "controlled-inc": {
      ref: "controlled-inc",
      create(ctx: any) {
        return ctx.registerNode("controlled-inc", ctx.deps, (run: any) => {
          calls++;
          run.down([["DATA", depLatest(run, 0) + 1]]);
        }, { name: ctx.name });
      },
    },
  } });
  const a = restored.find("input");
  const d = restored.find("derived");
  const before = a.version;
  for (const value of scenario.writes) a.set(value);
  const after = a.version;
  const output: unknown[] = [];
  const off = d.subscribe((m: readonly unknown[]) => {
    if (m[0] === "DATA") output.push(m[1]);
  });
  assert.deepEqual(output, [2]);
  assert.equal(calls, 0);
  assert.equal(a.cache, scenario.writes.at(-1) ?? 1);
  if (scenario.versioning === false) assert.equal(after, undefined);
  else assert.equal(after.counter - before.counter, scenario.writes.length);
  const initialOutput = [...output];
  a.set(a.cache);
  assert.equal(calls, 1);
  assert.equal(output.at(-1), a.cache + 1);
  off();
  console.log(JSON.stringify({ scenario: scenario.name, writes: scenario.writes,
    before, after, firstAttachmentValues: initialOutput, firstAttachmentCalls: 0,
    callsAfterSubscribedSameValueDATA: calls }));
}
console.log("DONE 5 baseline cases; future freshness policy is not implemented/tested");
