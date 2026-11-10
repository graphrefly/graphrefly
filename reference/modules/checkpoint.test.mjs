import test from "node:test";
import assert from "node:assert/strict";
import { createGraph, format } from "../kernel/kernel.mjs";
import { recipes, restore } from "./checkpoint.mjs";
import { historyOpts, historyRecipe } from "./history.mjs";

function during(g, body) {
  const start = g.trace.length;
  body();
  return g.trace.slice(start).map(format);
}

// Recipes count how often a real fn runs; restore must not run one by itself.
function registry() {
  const calls = { sum: 0, scan: 0 };
  const values = (ctx) => ctx.deps.flatMap((d) => d.waves.flat());
  return {
    calls,
    sum: () => (ctx) => { calls.sum += 1; ctx.down([["DATA", ctx.deps.reduce((a, d) => a + (d.value ?? 0), 0)]]); },
    // Adds every value this run received; the running total is private state.
    scan: () => (ctx) => {
      calls.scan += 1;
      const acc = values(ctx).reduce((a, v) => a + v, ctx.state.get() ?? 0);
      ctx.state.set(acc);
      ctx.down([["DATA", acc]]);
    },
    plus: ({ k }) => (ctx) => ctx.down([["DATA", ctx.deps[0].value + k]]),
  };
}

// a=1, b=2; s = a+b; t = running total of a and b. Subscribed, then a set to 3.
function original(reg = registry()) {
  const b = recipes(createGraph(), reg);
  b.state("a", 1); b.state("b", 2);
  b.node("s", ["a", "b"], "sum");
  b.node("t", ["a", "b"], "scan");
  b.g.subscribe("ks", "s"); b.g.subscribe("kt", "t");
  b.g.set("a", 3);
  return b;
}

const roundTrip = (cp) => JSON.parse(JSON.stringify(cp));

test("restore builds the topology, runs no fn and sends nothing", () => {
  const b = original();
  assert.deepEqual([b.g.get("s").value, b.g.get("t").value], [5, 6]); // t: 1+2 at activation, then +3
  const reg = registry();
  const r = restore(roundTrip(b.capture()), reg);
  assert.deepEqual(r.g.trace, []);
  assert.deepEqual(reg.calls, { sum: 0, scan: 0 });
  assert.deepEqual(r.g.describe(), b.g.describe());
  assert.equal(r.g.get("s").active, false, "no subscriber yet, as TS's restoreGraph");
});

test("a first subscription gets the saved value without running the fn; later waves run it", () => {
  const reg = registry();
  const r = restore(roundTrip(original().capture()), reg);
  assert.deepEqual(during(r.g, () => { r.g.subscribe("ks", "s"); r.g.subscribe("kt", "t"); }), [
    "ks <- s: [START, DATA(5)]",
    "kt <- t: [START, DATA(6)]",
  ]);
  assert.deepEqual(reg.calls, { sum: 0, scan: 0 });
  assert.deepEqual(during(r.g, () => r.g.set("b", 10)), ["ks <- s: [DIRTY, DATA(13)]", "kt <- t: [DIRTY, DATA(16)]"],
    "t's private state came back: 6 + 10");
  assert.deepEqual(reg.calls, { sum: 1, scan: 1 });
  assert.deepEqual(r.capture().nodes.find((n) => n.id === "t").saved.values, [16], "once activated, capture saves the live lifetime");
});

test("C-38: an upstream change before the first subscription runs the fn once, with only the changed input", () => {
  const reg = registry();
  const r = restore(roundTrip(original().capture()), reg);
  r.g.set("a", 5); // nobody is subscribed: no fn runs
  assert.deepEqual(reg.calls, { sum: 0, scan: 0 });
  assert.deepEqual(during(r.g, () => { r.g.subscribe("ks", "s"); r.g.subscribe("kt", "t"); }), [
    "ks <- s: [START, DATA(7)]",
    "kt <- t: [START, DATA(11)]", // 6 + 5, as a live wave from a would have made it; b did not change
  ]);
  assert.deepEqual(reg.calls, { sum: 1, scan: 1 });
});

test("after an upstream change, a run that sends nothing keeps the saved value, as a live run would", () => {
  const reg = { ...registry(), even: () => (ctx) => { if (ctx.deps[0].value % 2 === 0) ctx.down([["DATA", ctx.deps[0].value]]); } };
  const b = recipes(createGraph(), reg);
  b.state("a", 2);
  b.node("v", ["a"], "even");
  b.g.subscribe("k", "v");
  const r = restore(roundTrip(b.capture()), reg);
  r.g.set("a", 3);
  assert.deepEqual(during(r.g, () => r.g.subscribe("k", "v")), ["k <- v: [START, DATA(2)]"]);
});

test("a chain of restored nodes: each gets its dependency's saved value, so no fn runs", () => {
  const reg = registry();
  const b = original(reg);
  b.node("q", ["s"], "plus", { k: 100 });
  b.node("u", ["q", "t"], "sum");
  b.g.subscribe("ku", "u");
  const reg2 = registry();
  const r = restore(roundTrip(b.capture()), reg2);
  assert.deepEqual(during(r.g, () => r.g.subscribe("ku", "u")), ["ku <- u: [START, DATA(111)]"]);
  assert.deepEqual(reg2.calls, { sum: 0, scan: 0 });
  assert.deepEqual(during(r.g, () => r.g.set("a", 4)), ["ku <- u: [DIRTY, DATA(116)]"]); // q 106, t 6 + 4
});

test("a computed node without a lifetime saves nothing and starts fresh", () => {
  const reg = registry();
  const b = recipes(createGraph(), reg);
  b.state("a", 1);
  b.node("p", ["a"], "plus", { k: 10 });
  const cp = roundTrip(b.capture());
  assert.deepEqual(cp.nodes[1], { id: "p", kind: "node", deps: ["a"], ref: "plus", config: { k: 10 }, opts: {} });
  const r = restore(cp, reg);
  assert.deepEqual(during(r.g, () => r.g.subscribe("k", "p")), ["k <- p: [START, DATA(11)]"]);
});

test("an ended node comes back ended, with its dependencies; a subscriber gets its terminal snapshot, as before", () => {
  const reg = { ...registry(), last: () => (ctx) => { if (ctx.deps[0].waves.length) ctx.down([["DATA", ctx.deps[0].value]]); } };
  const b = recipes(createGraph(), reg);
  b.state("a", 1);
  b.node("e", ["a"], "last"); // auto: ends with a
  b.g.subscribe("ke", "e");
  b.g.set("a", 2); b.g.error("a", "boom");
  const r = restore(roundTrip(b.capture()), reg);
  for (const id of ["a", "e"]) {
    assert.deepEqual({ ...r.g.get(id), active: null }, { ...b.g.get(id), active: null }, "sinks are not restored");
    assert.deepEqual(during(r.g, () => r.g.subscribe("k", id)), [`k <- ${id}: [START, DATA(2), ERROR("boom")]`]);
  }
  assert.deepEqual(r.g.describe(), b.g.describe());
  assert.deepEqual(roundTrip(r.capture()), roundTrip(b.capture()), "captured again, it is the same checkpoint");
});

// w reports which inputs' terminals arrived in its run.
const ends = () => (ctx) => ctx.down([["DATA", ctx.deps.filter((d) => d.terminal).map((d) => d.id).join(",") || "-"]]);

test("a node holding an ended dependency comes back and works; the ended node does not run", () => {
  const reg = registry();
  let lastCalls = 0;
  reg.last = () => (ctx) => { lastCalls += 1; if (ctx.deps[0].waves.length) ctx.down([["DATA", ctx.deps[0].value]]); };
  const b = recipes(createGraph(), reg);
  b.state("config", 1); b.state("input", 0);
  b.node("e", ["config"], "last");
  b.node("s", ["e", "input"], "sum"); // default policy: open while input is
  b.g.subscribe("k", "s");
  b.g.complete("config");
  assert.deepEqual([b.g.get("e").ended, b.g.get("s").ended], [["COMPLETE"], null]);
  const r = restore(roundTrip(b.capture()), reg);
  const before = { ...reg.calls };
  lastCalls = 0;
  assert.deepEqual(during(r.g, () => r.g.subscribe("k", "s")), ["k <- s: [START, DATA(1)]"]);
  assert.deepEqual(during(r.g, () => r.g.set("input", 5)), ["k <- s: [DIRTY, DATA(6)]"]);
  assert.deepEqual([reg.calls.sum - before.sum, lastCalls], [1, 0]);
  assert.deepEqual(during(r.g, () => r.g.subscribe("k2", "e")), ["k2 <- e: [START, DATA(1), COMPLETE]"]);
  assert.equal(lastCalls, 0);
});

test("an input that ended before the first subscription reaches the fn; one that had ended before capture does not again", () => {
  const reg = { ...registry(), ends };
  const b = recipes(createGraph(), reg);
  b.state("config", 1); b.state("input", 0);
  b.node("w", ["config", "input"], "ends");
  b.g.subscribe("k", "w");
  const open = roundTrip(b.capture());
  b.g.complete("config");
  b.g.set("input", 1);
  const closed = roundTrip(b.capture());
  const r1 = restore(open, reg);
  r1.g.complete("config");
  assert.deepEqual(during(r1.g, () => r1.g.subscribe("k", "w")), ["k <- w: [START, DATA(\"config\")]"]);
  const r2 = restore(closed, reg);
  r2.g.set("input", 2);
  assert.deepEqual(during(r2.g, () => r2.g.subscribe("k", "w")), ["k <- w: [START, DATA(\"-\")]"]);
});

test("a node without a recipe, or rewired since, is local-only and cannot be restored", () => {
  const reg = registry();
  const b = recipes(createGraph(), reg);
  b.state("a", 1); b.state("b", 2);
  b.node("s", ["a"], "sum");
  b.g.node("raw", ["a"], (ctx) => ctx.down([["DATA", 0]]));
  b.g.rewire("s", ["a", "b"], reg.sum());
  const cp = b.capture();
  assert.deepEqual(cp.nodes.filter((n) => n.local).map((n) => n.id), ["s", "raw"]);
  assert.throws(() => restore(cp, reg), /s is local-only/);
});

test("a restored node rewired before its first activation is local-only too", () => {
  const reg = registry();
  const r = restore(roundTrip(original().capture()), reg);
  r.g.rewire("t", ["a"], reg.scan());
  assert.deepEqual(r.capture().nodes.filter((n) => n.local).map((n) => n.id), ["t"]);
});

// C6 (Codex review; decided by the user 2026-11-10): the definition is the dependencies and the function.
test("a replace or rewire that keeps the dependencies but changes the function makes the node local-only", () => {
  const reg = { times: ({ k }) => (ctx) => { if (ctx.deps[0].has) ctx.down([["DATA", ctx.deps[0].value * k]]); } };
  const times3 = (ctx) => { if (ctx.deps[0].has) ctx.down([["DATA", ctx.deps[0].value * 3]]); };
  for (const op of ["replace", "rewire"]) {
    const b = recipes(createGraph(), reg);
    b.state("a", 1); b.node("p", ["a"], "times", { k: 2 }); b.node("q", ["a"], "times", { k: 2 });
    b.g.subscribe("s", "p");
    b.g[op]("p", ["a"], times3);
    const cp = roundTrip(b.capture());
    assert.deepEqual(cp.nodes.filter((n) => n.local).map((n) => n.id), ["p"], `${op}: q keeps its recipe's definition`);
    assert.throws(() => restore(cp, reg), /p is local-only/, `${op}: restoring it as the old recipe would give 4 where the original gives 6`);
  }
});

test("a missing recipe fails the restore", () => {
  const cp = original().capture();
  const { scan, ...withoutScan } = registry();
  assert.throws(() => restore(cp, withoutScan), /no recipe scan/);
});

test("O5: capture is refused inside a wave and inside a batch body", () => {
  const b = original();
  let seen;
  b.g.subscribe("watch", "a", () => { if (b.g.get("a").value === 4) try { b.capture(); } catch (e) { seen = e.message; } });
  b.g.set("a", 4);
  assert.match(seen, /wave boundary/);
  assert.throws(() => b.g.batch(() => b.capture()), /wave boundary/);
  assert.deepEqual(b.capture().nodes.find((n) => n.id === "a").saved.values, [4], "between waves it is allowed");
});

test("a value or private state that is not JSON is refused at capture", () => {
  const reg = { ...registry(), keep: () => (ctx) => { ctx.state.set({ f: () => {} }); ctx.down([["DATA", 1]]); } };
  const b = recipes(createGraph(), reg);
  b.state("a", 1);
  b.node("k", ["a"], "keep");
  b.g.subscribe("s", "k");
  assert.throws(() => b.capture(), /node k is not JSON/);
  assert.throws(() => b.node("x", ["a"], "plus", { k: () => 1 }), /x config is not JSON/);
});

test("a restored graph captured again before anything subscribes keeps the saved lifetimes", () => {
  const reg = registry();
  const once = restore(roundTrip(original().capture()), reg);
  once.g.set("a", 5); // received by nobody yet: the saved inputs still say a=3
  const twice = restore(roundTrip(once.capture()), reg);
  assert.deepEqual(during(twice.g, () => twice.g.subscribe("kt", "t")), ["kt <- t: [START, DATA(11)]"]);
  assert.equal(reg.calls.scan, 1);
});

test("K3: every value of a node's last array is saved and comes back in its snapshot", () => {
  const reg = { ...registry(), pair: () => (ctx) => { const v = ctx.deps[0].value; ctx.down([["DATA", v], ["DATA", -v]]); } };
  const b = recipes(createGraph(), reg);
  b.state("a", 0);
  b.node("p", ["a"], "pair");
  b.g.subscribe("k", "p");
  b.g.batch(() => { b.g.set("a", 1); b.g.set("a", 2); });
  const r = restore(roundTrip(b.capture()), reg);
  assert.deepEqual(r.g.get("a").values, [1, 2], "a state's last array, back as one array");
  assert.deepEqual(during(r.g, () => r.g.subscribe("k", "p")), ["k <- p: [START, DATA(2), DATA(-2)]"]);
});

// A cleanup is a closure and cannot be saved; a node that holds an outside resource opens it in
// its setup, which runs at every activation, a restored one's included (K7, the user's choice
// 2026-11-10, replacing A2's extra run of the function).

// history over s, n = 3, after 1, 2, 3; the same steps on the original and on its restore.
function historyPair() {
  const reg = { history: historyRecipe };
  const b = recipes(createGraph(), reg);
  b.state("s"); b.node("h", ["s"], "history", { n: 3 }, historyOpts);
  b.g.subscribe("k", "h");
  for (const v of [1, 2, 3]) b.g.set("s", v);
  return { b, reg, cp: roundTrip(b.capture()) };
}

test("a restored history needs no rerun: under the manual INVALIDATE policy an INVALIDATE is its input", () => {
  const { b, reg, cp } = historyPair();
  const r = restore(cp, reg);
  assert.deepEqual(during(r.g, () => r.g.subscribe("k", "h")), ["k <- h: [START, DATA([[[1]],[[2]],[[3]]])]"]);
  for (const g of [b.g, r.g]) { g.invalidate("s"); g.set("s", 9); }
  assert.deepEqual(r.g.get("h").value, [[[9]]]);
  assert.deepEqual(r.g.get("h").value, b.g.get("h").value);
});

test("a restored source starts a new timer in its setup and goes on from its saved count; its function does not run", () => {
  const timers = new Set();
  let setups = 0, runs = 0;
  const tick = () => [...timers].forEach((t) => t());
  const reg = { interval: () => ({
    fn: () => { runs += 1; },
    setup: (ctx) => {
      setups += 1;
      const t = () => { const n = (ctx.state.get() ?? 0) + 1; ctx.state.set(n); ctx.down([["DATA", n]]); };
      timers.add(t);
      return () => timers.delete(t);
    },
  }) };
  const b = recipes(createGraph(), reg);
  b.node("i", [], "interval");
  b.g.subscribe("k", "i");
  tick(); tick();
  const cp = roundTrip(b.capture());
  b.g.unsubscribe("k", "i");
  assert.equal(timers.size, 0, "the cleanup stopped the original's timer");
  setups = 0; runs = 0;
  const r = restore(cp, reg);
  r.g.subscribe("k", "i");
  assert.deepEqual([setups, runs, timers.size, r.g.get("i").value], [1, 0, 1, 2], "one setup, no run, one timer, the saved value");
  tick();
  assert.equal(r.g.get("i").value, 3, "the count goes on");
});

test("an input that only ended before the first subscription brings its end, not its values again", () => {
  const { b, reg, cp } = historyPair();
  const r = restore(cp, reg);
  for (const g of [b.g, r.g]) g.complete("s");
  r.g.subscribe("k", "h");
  assert.deepEqual([r.g.get("h").value, r.g.get("h").ended], [[[[1]], [[2]], [[3]]], ["COMPLETE"]]);
  assert.deepEqual([r.g.get("h").value, r.g.get("h").ended], [b.g.get("h").value, b.g.get("h").ended]);
});

test("R-checkpoint: before the first subscription only values are compared; subscribed first, an INVALIDATE is seen", () => {
  const { b, reg, cp } = historyPair();
  b.g.invalidate("s"); b.g.set("s", 9);
  const early = restore(cp, reg);
  early.g.invalidate("s"); early.g.set("s", 9);
  early.g.subscribe("k", "h");
  assert.deepEqual(early.g.get("h").value, [[[2]], [[3]], [[9]]], "the INVALIDATE before the subscription is not seen");
  const first = restore(cp, reg);
  first.g.subscribe("k", "h");
  first.g.invalidate("s"); first.g.set("s", 9);
  assert.deepEqual(first.g.get("h").value, b.g.get("h").value, "subscribed first, the restore behaves as the original");
});

test("a dependency's snapshot is compared as a whole array: [1, 2] -> [3, 2] is a change", () => {
  const reg = { vals: () => (ctx) => ctx.down([["DATA", ctx.deps[0].waves.flat()]]) };
  const b = recipes(createGraph(), reg);
  b.state("s"); b.node("d", ["s"], "vals");
  b.g.subscribe("k", "d");
  b.g.batch(() => { b.g.set("s", 1); b.g.set("s", 2); });
  const cp = roundTrip(b.capture());
  assert.deepEqual(cp.nodes.find((n) => n.id === "d").saved.inputs[0].values, [1, 2]);
  const r = restore(cp, reg);
  r.g.batch(() => { r.g.set("s", 3); r.g.set("s", 2); }); // the same last value, another array
  r.g.subscribe("k", "d");
  assert.deepEqual(r.g.get("d").value, [3, 2]);
  const same = restore(cp, reg);
  same.g.subscribe("k", "d");
  assert.deepEqual(same.g.get("d").value, [1, 2], "an unchanged array is no change");
});
