// Both arms against the unchanged photo-scenes spec, and the graph arm's topology as data.

import test from "node:test";
import assert from "node:assert/strict";
import { runSpec } from "./run-spec.mjs";
import { defineOperations, graphOf } from "./graph-operations.mjs";

for (const arm of ["plain", "graph"]) {
  test(`${arm} arm passes all 27 tests of the unchanged spec`, async () => {
    const r = await runSpec({ arm });
    assert.equal(r.tests.length, 27, r.stderr.slice(0, 500));
    assert.deepEqual(r.failed, []);
  });
}

test("graph arm: the tree is declared topology", () => {
  const app = defineOperations({
    path: "app",
    children: {
      place: { children: { plate: { run() {} } } },
      cacheWrite: { conflictPolicy: "queue", locks: ["cache"], run() {} },
    },
  });
  assert.deepEqual(graphOf(app).describe().map(({ id, deps }) => [id, deps]), [
    ["commands", []],
    ["runs", ["commands"]],
    ["runs:app", ["commands", "runs"]],
    ["runs:app/place", ["commands", "runs:app"]],
    ["flags:app/cacheWrite", ["runs:app"]],
    ["flags:app/place/plate", ["runs:app/place"]],
    ["flags:app/place", ["runs:app", "flags:app/place/plate"]],
    ["flags:app", ["runs", "flags:app/place", "flags:app/cacheWrite"]],
    ["effects", ["runs", "runs:app", "runs:app/place"]],
  ]);
});
