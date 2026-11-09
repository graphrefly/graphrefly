import test from "node:test";
import assert from "node:assert/strict";
import { createGraph } from "../kernel/kernel.mjs";
import { recipes, restore } from "./checkpoint.mjs";
import { revisionObserver } from "./revision.mjs";

const at = (o, id) => {
  const { revision, valueRevision } = o.get(id);
  return [revision, valueRevision];
};

// Even values pass; an odd value leaves the pending mark to the kernel's RESOLVED.
const evens = (ctx) => {
  const kept = ctx.deps[0].waves.flat().filter((v) => v % 2 === 0);
  if (kept.length) ctx.down(kept.map((v) => ["DATA", v]));
};

test("subscribing and the START snapshot advance nothing", () => {
  const g = createGraph();
  g.state("a", 1);
  const o = revisionObserver(g, ["a"]);
  assert.deepEqual(at(o, "a"), [0, 0]);
  revisionObserver(g, ["a"]); // a second observer is a late subscriber to a
  assert.deepEqual(at(o, "a"), [0, 0]);
});

test("each committed message counts: equal DATA, RESOLVED, an effective INVALIDATE, a terminal", () => {
  const g = createGraph();
  g.state("a", 2);
  g.node("e", ["a"], evens);
  const o = revisionObserver(g, ["a", "e"]);
  g.set("a", 2); // an equal DATA is an occurrence
  assert.deepEqual(at(o, "a"), [1, 1]);
  assert.deepEqual(at(o, "e"), [1, 1]);
  g.set("a", 3); // e sends nothing; the kernel settles it with RESOLVED
  assert.deepEqual(at(o, "a"), [2, 2]);
  assert.deepEqual(at(o, "e"), [2, 1], "RESOLVED advances revision only");
  g.invalidate("a");
  assert.deepEqual(at(o, "a"), [3, 3], "an INVALIDATE removes the value");
  assert.deepEqual(at(o, "e"), [3, 3]);
  g.invalidate("a"); // removes nothing, so it is not delivered
  assert.deepEqual(at(o, "a"), [3, 3]);
  g.complete("a");
  assert.deepEqual(at(o, "a"), [4, 3], "a terminal advances revision only");
});

test("an array of several values counts each of them", () => {
  const g = createGraph();
  g.state("a", 0);
  const o = revisionObserver(g, ["a"]);
  g.batch(() => { g.set("a", 1); g.set("a", 2); });
  assert.deepEqual(at(o, "a"), [2, 2]);
});

test("the hash describes the current retained values or their absence", () => {
  const g = createGraph();
  g.state("a", 1);
  const o = revisionObserver(g, ["a"], { hash: (values) => JSON.stringify(values) });
  assert.equal(o.get("a").hash, "[1]");
  g.batch(() => { g.set("a", 2); g.set("a", 3); });
  assert.equal(o.get("a").hash, "[2,3]");
  g.invalidate("a");
  assert.equal(o.get("a").hash, "null");
  assert.equal("hash" in revisionObserver(g, ["a"]).get("a"), false, "no hash unless asked for");
});

test("two observers count apart, and stop ends counting", () => {
  const g = createGraph();
  g.state("a", 0);
  const first = revisionObserver(g, ["a"]);
  g.set("a", 1);
  const second = revisionObserver(g, ["a"]);
  g.set("a", 2);
  assert.deepEqual(at(first, "a"), [2, 2]);
  assert.deepEqual(at(second, "a"), [1, 1]);
  first.stop();
  g.set("a", 3);
  assert.deepEqual(at(first, "a"), [2, 2]);
  assert.deepEqual(at(second, "a"), [2, 2]);
});

test("positions saved beside a checkpoint come back unchanged, and go on from there", () => {
  const registry = { plus: ({ k }) => (ctx) => ctx.down([["DATA", ctx.deps[0].value + k]]) };
  const b = recipes(createGraph(), registry);
  b.state("a", 1);
  b.node("p", ["a"], "plus", { k: 10 });
  const o = revisionObserver(b.g, ["a", "p"]);
  b.g.set("a", 2);
  b.g.set("a", 3);
  const saved = JSON.parse(JSON.stringify({ checkpoint: b.capture(), revisions: o.capture() }));
  assert.deepEqual(saved.revisions, { a: { revision: 2, valueRevision: 2 }, p: { revision: 2, valueRevision: 2 } });

  const { g } = restore(saved.checkpoint, registry);
  const r = revisionObserver(g, ["a", "p"], { from: saved.revisions });
  assert.deepEqual(r.capture(), saved.revisions, "restore and the new subscription advance nothing");
  g.set("a", 4);
  assert.deepEqual(at(r, "a"), [3, 3]);
  assert.deepEqual(at(r, "p"), [3, 3]);
});

test("a position never wraps: an array that would pass the limit is refused whole", () => {
  const reports = [];
  const g = createGraph({ report: (x) => reports.push(x) });
  g.state("a", 0);
  const max = Number.MAX_SAFE_INTEGER;
  const o = revisionObserver(g, ["a"], { from: { a: { revision: max - 1, valueRevision: 5 } } });
  g.batch(() => { g.set("a", 1); g.set("a", 2); });
  assert.deepEqual(at(o, "a"), [max - 1, 5]);
  assert.equal(reports.length, 1);
  assert.match(reports[0].error, /MAX_SAFE_INTEGER/);
  g.set("a", 3);
  assert.deepEqual(at(o, "a"), [max, max]);
});

test("an invalid saved position is refused", () => {
  const g = createGraph();
  g.state("a", 0);
  for (const bad of [{ revision: -1, valueRevision: 0 }, { revision: 1.5, valueRevision: 0 }, { revision: 1, valueRevision: 2 }, {}]) {
    assert.throws(() => revisionObserver(g, ["a"], { from: { a: bad } }), RangeError);
  }
});

test("capture returns a copy: later waves do not change it", () => {
  const g = createGraph();
  g.state("a", 0);
  const o = revisionObserver(g, ["a"]);
  g.set("a", 1);
  const c = o.capture();
  g.set("a", 2);
  assert.deepEqual(c, { a: { revision: 1, valueRevision: 1 } });
});

test("an ERROR advances revision only", () => {
  const g = createGraph();
  g.state("a", 1);
  const o = revisionObserver(g, ["a"]);
  g.error("a", "boom");
  assert.deepEqual(at(o, "a"), [1, 0]);
});
