import test from "node:test";
import assert from "node:assert/strict";
import { createGraph } from "../kernel/kernel.mjs";
import { observe } from "./observe.mjs";

const show = ({ id, msgs }) =>
  `${id}: ${msgs.map((m) => (m.length > 1 ? `${m[0]}(${JSON.stringify(m[1])})` : m[0])).join(", ")}`;

function recorder() {
  const events = [];
  const sink = (e) => events.push(e);
  return { events, sink, shown: () => events.map(show), clear: () => { events.length = 0; } };
}

// b sends two arrays per input value; c adds one.
function chain(g) {
  g.state("a", 1);
  g.node("b", ["a"], (ctx) => {
    for (const v of ctx.deps[0].waves.flat()) {
      ctx.down([["DATA", v * 10]]);
      ctx.down([["DATA", v * 10 + 1]]);
    }
  });
  g.node("c", ["b"], (ctx) => {
    for (const w of ctx.deps[0].waves) ctx.down(w.map((v) => ["DATA", v + 1]));
  });
}

test("H5: an observer sees each node's committed arrays, with their boundaries, in the order the wave reaches them", () => {
  const g = createGraph();
  chain(g);
  const r = recorder();
  observe(g, ["a", "b", "c"], r.sink);
  assert.deepEqual(r.shown(), ["a: START, DATA(1)", "b: START, DATA(11)", "c: START, DATA(12)"]);
  r.clear();
  g.set("a", 2);
  assert.deepEqual(r.shown(), [
    "a: PENDING, DATA(2)",
    "b: PENDING, DATA(20)",
    "b: PENDING, DATA(21)",
    "c: PENDING, DATA(21)",
    "c: PENDING, DATA(22)",
  ]);
});

test("H5: what a node did not commit is not observed; what the kernel adds is", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("odd", ["a"], (ctx) => {
    for (const v of ctx.deps[0].waves.flat()) if (v % 2) ctx.down([["DATA", v]]);
  });
  const r = recorder();
  observe(g, ["a", "odd"], r.sink);
  r.clear();
  g.set("a", 2);
  assert.deepEqual(r.shown(), ["a: PENDING, DATA(2)", "odd: PENDING, RESOLVED"], "the kernel's RESOLVED is committed output");
  r.clear();
  g.invalidate("a");
  g.invalidate("a");
  assert.deepEqual(r.shown(), ["a: PENDING, INVALIDATE", "odd: PENDING, INVALIDATE"], "the repeat removed nothing and is not observed");
});

test("H5: the observed order is enough to keep R-node-revision evidence", () => {
  const g = createGraph();
  g.state("a", 1);
  const revisions = new Map();
  observe(g, ["a"], ({ id, msgs }) => {
    const r = revisions.get(id) ?? { revision: 0, valueRevision: 0 };
    if (msgs[0][0] === "START") { revisions.set(id, r); return; } // installation advances neither
    for (const [type] of msgs) {
      if (type === "PENDING") continue; // a notification, not output
      r.revision += 1;
      if (type === "DATA" || type === "INVALIDATE") r.valueRevision += 1;
    }
    revisions.set(id, r);
  });
  g.set("a", 1); // equal DATA is still an occurrence
  g.invalidate("a");
  g.invalidate("a"); // removes nothing: no transition
  g.complete("a");
  assert.deepEqual(revisions.get("a"), { revision: 3, valueRevision: 2 });
});

test("H5: observing is a subscription: it activates a cold node, others see the same, and stopping releases it", () => {
  const g = createGraph();
  chain(g);
  const other = recorder();
  observe(g, ["c"], other.sink);
  const r = recorder();
  const stop = observe(g, ["b"], r.sink);
  assert.equal(g.get("b").active, true);
  other.clear();
  r.clear();
  g.set("a", 3);
  assert.deepEqual(other.shown(), ["c: PENDING, DATA(31)", "c: PENDING, DATA(32)"], "the other subscriber is unaffected");
  stop();
  assert.equal(g.get("b").active, true, "b stays active for c's observer");
  g.node("d", ["a"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  const stopCold = observe(g, ["d"], recorder().sink);
  assert.equal(g.get("d").active, true, "observing activated cold d");
  stopCold();
  assert.equal(g.get("d").active, false, "stopping released it");
});

test("H5: a write from inside an observer is a later wave, after the one it observed", () => {
  const g = createGraph();
  chain(g);
  g.state("log", 0);
  const r = recorder();
  observe(g, ["a", "c", "log"], (e) => {
    r.sink(e);
    if (e.id === "a" && e.msgs.some((m) => m[0] === "DATA" && m[1] === 4)) g.set("log", 1);
  });
  r.clear();
  g.set("a", 4);
  assert.deepEqual(r.shown(), [
    "a: PENDING, DATA(4)",
    "c: PENDING, DATA(41)",
    "c: PENDING, DATA(42)",
    "log: PENDING, DATA(1)",
  ]);
});

test("H5: a quiet node's output is observed in its later wave", () => {
  const g = createGraph();
  g.state("a", 1);
  g.node("q", ["a"], (ctx) => {
    for (const v of ctx.deps[0].waves.flat()) ctx.down([["DATA", v]]);
  }, { quiet: true });
  const r = recorder();
  observe(g, ["a", "q"], r.sink);
  r.clear();
  g.set("a", 2);
  assert.deepEqual(r.shown(), ["a: PENDING, DATA(2)", "q: PENDING, DATA(2)"]);
});

test("H5: two observers of one node are two subscribers; stopping one leaves the other", () => {
  const g = createGraph();
  g.state("a", 1);
  const r1 = recorder();
  const r2 = recorder();
  const stop1 = observe(g, ["a"], r1.sink);
  observe(g, ["a"], r2.sink);
  stop1();
  g.set("a", 2);
  assert.deepEqual(r1.shown(), ["a: START, DATA(1)"]);
  assert.deepEqual(r2.shown(), ["a: START, DATA(1)", "a: PENDING, DATA(2)"]);
});
