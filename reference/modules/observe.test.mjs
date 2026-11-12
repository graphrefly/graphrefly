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

// C-48 (R-graph-surface@1, D805): find, describe, observe and retain.
test("C-48: find, describe, observe and retain", async () => {
  const { find, retain } = await import("./observe.mjs");
  const g = createGraph();
  g.state("a", 1);
  g.node("b", ["a"], (ctx) => ctx.down([["DATA", ctx.deps[0].value * 10]]));
  g.node("c", ["a"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]));
  let dctx;
  g.node("d", ["a"], (ctx) => { dctx = ctx; });

  assert.equal(find(g, "b"), "b");
  assert.equal(find(g, "nope"), null);
  assert.deepEqual(g.describe(), [
    { id: "a", kind: "state", deps: [], quiet: false },
    { id: "b", kind: "node", deps: ["a"], quiet: false },
    { id: "c", kind: "node", deps: ["a"], quiet: false },
    { id: "d", kind: "node", deps: ["a"], quiet: false },
  ], "creation order, exactly { id, kind, deps, quiet }");
  assert.equal(g.get("b").active, false, "find and describe activate nothing");

  const events = [];
  const stop = observe(g, ["b"], (e) => events.push(e));
  assert.equal(g.get("b").active, true, "observe is a subscriber: it activates b");
  g.set("a", 2);
  assert.deepEqual(events, [
    { id: "b", msgs: [["START"], ["DATA", 10]] },
    { id: "b", msgs: [["PENDING"], ["DATA", 20]] },
  ], "one event per array, START first, PENDING included, no tier or sequence");
  const other = [];
  const stop2 = observe(g, ["b"], (e) => other.push(e));
  stop();
  g.set("a", 3);
  assert.equal(events.length, 2, "nothing after stop");
  assert.deepEqual(other.at(-1), { id: "b", msgs: [["PENDING"], ["DATA", 30]] }, "another observer goes on");
  stop2();
  assert.equal(g.get("b").active, false);

  const r1 = retain(g, "c");
  const r2 = retain(g, "c");
  assert.equal(g.get("c").active, true, "retain activates");
  r1();
  assert.equal(g.get("c").active, true, "each retain is its own subscription");
  r2();
  assert.equal(g.get("c").active, false);

  retain(g, "d");
  dctx.rewire(["a", "c"]);
  assert.deepEqual(g.describe().find((n) => n.id === "d").deps, ["a", "c"], "describe gives the current dependencies");
  assert.deepEqual(g.definition("d").deps, ["a"], "definition gives the declared ones");
});

test("D808: observe stop suppresses later arrays immediately; subscribe release remains queued", () => {
  const g = createGraph();
  g.state("s", 0);
  g.node("n", ["s"], (ctx) => {
    if (ctx.deps[0].value === 1) { ctx.down([["DATA", 1]]); ctx.down([["DATA", 2]]); }
  });
  const observed = [], subscribed = [];
  const stop = observe(g, ["n"], ({ msgs }) => {
    for (const [type, value] of msgs) if (type === "DATA") { observed.push(value); stop(); }
  });
  g.subscribe("plain", "n", (msgs) => {
    for (const [type, value] of msgs) if (type === "DATA") { subscribed.push(value); g.unsubscribe("plain", "n"); }
  });
  g.set("s", 1);
  assert.deepEqual(observed, [1]);
  assert.deepEqual(subscribed, [1, 2]);
  stop();
  assert.equal(g.get("n").active, false);
});

test("observe validates all targets before acquiring any lifetime", () => {
  const g = createGraph();
  let setups = 0, cleanups = 0;
  g.node("n", [], () => {}, { setup: () => { setups++; return () => { cleanups++; }; } });
  assert.throws(() => observe(g, ["n", "missing"], () => {}), /unknown node missing/);
  assert.deepEqual([setups, cleanups, g.get("n").active], [0, 0, false]);
  const targets = ["n"];
  const stop = observe(g, targets, () => {});
  targets.length = 0;
  stop();
  assert.deepEqual([setups, cleanups, g.get("n").active], [1, 1, false]);
});
