// Current-runtime replay/checkpoint diagnostic, not candidate codec validation.
// Run from the TS checkout; no timers, network, or external resources.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const load = (path: string) => import(pathToFileURL(resolve(path)).href);
const { Graph } = await load("packages/ts/src/graph/graph.ts");
const { restoreGraph, defaultRestoreRegistry } = await load("packages/ts/src/graph/restore.ts");
const graph = new Graph();
const source = graph.state(0, { name: "history", replayBuffer: 3 });
const releaseKeepAlive = source.subscribe(() => {});

function initialValues(node: any): unknown[] {
  const values: unknown[] = [];
  const release = node.subscribe((message: readonly unknown[]) => {
    if (message[0] === "DATA") values.push(message[1]);
  });
  release();
  return values;
}

try {
  source.set(20);
  source.set(20);
  source.set(30);
  const before = initialValues(source);
  assert.deepEqual(before, [20, 20, 30]);
  const checkpoint = JSON.parse(JSON.stringify(graph.checkpoint()));
  // Supply the SAME capacity explicitly: this isolates loss of runtime history
  // from the separate omission of replay configuration in the current format.
  const restored = restoreGraph(checkpoint, {
    registry: {
      ...defaultRestoreRegistry,
      state: {
        ...defaultRestoreRegistry.state,
        create(ctx: any) {
          return ctx.registerState({ name: ctx.name, replayBuffer: 3 });
        },
      },
    },
  });
  const after = initialValues(restored.find("history"));
  assert.deepEqual(after, [30]);
  console.log(JSON.stringify({ before, after, restoredCapacity: 3,
    meaning: "current checkpoint loses replay history even with matching restored capacity" }));
} finally {
  releaseKeepAlive();
}
console.log("DONE 1 baseline replay roundtrip counterexample; no proposed codec implementation tested");
