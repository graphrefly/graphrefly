import test from "node:test";
import assert from "node:assert/strict";
import { createGraph, format } from "../kernel/kernel.mjs";
import { capture, restore } from "./checkpoint.mjs";
import { historyOpts, historyRecipe } from "./history.mjs";

function during(g, body) {
  const start = g.trace.length;
  body();
  return g.trace.slice(start).map(format);
}

// Builds node id from a registered recipe and gives the node that recipe, so it is restorable:
// the factory is called as restore calls it, and a { fn, setup } result gives the node its setup.
function node(g, reg, id, deps, ref, config = null, opts = {}) {
  const make = (r, c, at) => { const built = reg[r](c ?? null, { g, id: at, make }); return typeof built === "function" ? { fn: built } : built; };
  const { fn, setup } = make(ref, config, id);
  g.node(id, deps, fn, { ...opts, ...(setup && { setup }), recipe: { ref, config } });
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
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  node(g, reg, "s", ["a", "b"], "sum");
  node(g, reg, "t", ["a", "b"], "scan");
  g.subscribe("ks", "s"); g.subscribe("kt", "t");
  g.set("a", 3);
  return g;
}

const roundTrip = (cp) => JSON.parse(JSON.stringify(cp));

test("restore builds the topology, runs no fn and sends nothing", () => {
  const g = original();
  assert.deepEqual([g.get("s").value, g.get("t").value], [5, 6]); // t: 1+2 at activation, then +3
  const reg = registry();
  const r = restore(roundTrip(capture(g)), reg);
  assert.deepEqual(r.trace, []);
  assert.deepEqual(reg.calls, { sum: 0, scan: 0 });
  assert.deepEqual(r.describe(), g.describe());
  assert.equal(r.get("s").active, false, "no subscriber yet, as TS's restoreGraph");
});

test("a first subscription gets the saved value without running the fn; later waves run it", () => {
  const reg = registry();
  const r = restore(roundTrip(capture(original())), reg);
  assert.deepEqual(during(r, () => { r.subscribe("ks", "s"); r.subscribe("kt", "t"); }), [
    "ks <- s: [START, DATA(5)]",
    "kt <- t: [START, DATA(6)]",
  ]);
  assert.deepEqual(reg.calls, { sum: 0, scan: 0 });
  assert.deepEqual(during(r, () => r.set("b", 10)), ["ks <- s: [PENDING, DATA(13)]", "kt <- t: [PENDING, DATA(16)]"],
    "t's private state came back: 6 + 10");
  assert.deepEqual(reg.calls, { sum: 1, scan: 1 });
  assert.deepEqual(capture(r).nodes.find((n) => n.id === "t").saved.values, [16], "once activated, capture saves the live lifetime");
});

test("C-38: an upstream change before the first subscription runs the fn once, with only the changed input", () => {
  const reg = registry();
  const r = restore(roundTrip(capture(original())), reg);
  r.set("a", 5); // nobody is subscribed: no fn runs
  assert.deepEqual(reg.calls, { sum: 0, scan: 0 });
  assert.deepEqual(during(r, () => { r.subscribe("ks", "s"); r.subscribe("kt", "t"); }), [
    "ks <- s: [START, DATA(7)]",
    "kt <- t: [START, DATA(11)]", // 6 + 5, as a live wave from a would have made it; b did not change
  ]);
  assert.deepEqual(reg.calls, { sum: 1, scan: 1 });
});

test("after an upstream change, a run that sends nothing keeps the saved value, as a live run would", () => {
  const reg = { ...registry(), even: () => (ctx) => { if (ctx.deps[0].value % 2 === 0) ctx.down([["DATA", ctx.deps[0].value]]); } };
  const g = createGraph();
  g.state("a", 2);
  node(g, reg, "v", ["a"], "even");
  g.subscribe("k", "v");
  const r = restore(roundTrip(capture(g)), reg);
  r.set("a", 3);
  assert.deepEqual(during(r, () => r.subscribe("k", "v")), ["k <- v: [START, DATA(2)]"]);
});

test("a chain of restored nodes: each gets its dependency's saved value, so no fn runs", () => {
  const reg = registry();
  const g = original(reg);
  node(g, reg, "q", ["s"], "plus", { k: 100 });
  node(g, reg, "u", ["q", "t"], "sum");
  g.subscribe("ku", "u");
  const reg2 = registry();
  const r = restore(roundTrip(capture(g)), reg2);
  assert.deepEqual(during(r, () => r.subscribe("ku", "u")), ["ku <- u: [START, DATA(111)]"]);
  assert.deepEqual(reg2.calls, { sum: 0, scan: 0 });
  assert.deepEqual(during(r, () => r.set("a", 4)), ["ku <- u: [PENDING, DATA(116)]"]); // q 106, t 6 + 4
});

test("a computed node without a lifetime saves nothing and starts fresh", () => {
  const reg = registry();
  const g = createGraph();
  g.state("a", 1);
  node(g, reg, "p", ["a"], "plus", { k: 10 });
  const cp = roundTrip(capture(g));
  assert.deepEqual(cp.nodes[1], {
    id: "p", kind: "node", deps: ["a"], recipe: { ref: "plus", config: { k: 10 } }, saved: null,
    opts: { terminal: { complete: "auto", error: "auto" }, invalidate: "auto", quiet: false },
  });
  const r = restore(cp, reg);
  assert.deepEqual(during(r, () => r.subscribe("k", "p")), ["k <- p: [START, DATA(11)]"]);
});

test("a node's policies are saved from its definition and come back with it", () => {
  const reg = registry();
  const g = createGraph();
  g.state("a", 1);
  const opts = { terminal: { complete: "manual", error: "auto" }, invalidate: "manual", quiet: true };
  node(g, reg, "p", ["a"], "plus", { k: 10 }, opts);
  const r = restore(roundTrip(capture(g)), reg);
  assert.deepEqual(r.definition("p").opts, g.definition("p").opts);
  assert.deepEqual(r.definition("p").opts, opts);
});

test("an ended node comes back ended, with its dependencies; a subscriber gets its terminal snapshot, as before", () => {
  const reg = { ...registry(), last: () => (ctx) => { if (ctx.deps[0].waves.length) ctx.down([["DATA", ctx.deps[0].value]]); } };
  const g = createGraph();
  g.state("a", 1);
  node(g, reg, "e", ["a"], "last"); // auto: ends with a
  g.subscribe("ke", "e");
  g.set("a", 2); g.error("a", "boom");
  const r = restore(roundTrip(capture(g)), reg);
  for (const id of ["a", "e"]) {
    // An ended node never runs again, so a restored one is given no seed note (2026-11-10).
    assert.deepEqual({ ...r.get(id), active: null }, { ...g.get(id), active: null }, "sinks are not restored");
    assert.deepEqual(during(r, () => r.subscribe("k", id)), [`k <- ${id}: [START, DATA(2), ERROR("boom")]`]);
  }
  assert.deepEqual(r.describe(), g.describe());
  assert.deepEqual(roundTrip(capture(r)), roundTrip(capture(g)), "captured again, it is the same checkpoint");
});

// The kernel drops a lifetime's private state when it closes, also when the node ends (2026-11-10).
test("a node that ended is saved without private state, and comes back without it", () => {
  const reg = registry();
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  node(g, reg, "t", ["a", "b"], "scan");
  g.subscribe("k", "t");
  g.set("a", 3);
  const live = roundTrip(capture(g)).nodes.find((n) => n.id === "t");
  assert.equal(live.saved.state, 6, "while live, its running total is saved");
  g.complete("a"); g.complete("b");
  assert.deepEqual(g.get("t").ended, ["COMPLETE"]);
  const cp = roundTrip(capture(g));
  const ended = cp.nodes.find((n) => n.id === "t");
  assert.deepEqual([ended.saved.values, ended.saved.ended, "state" in ended.saved], [[6], ["COMPLETE"], false]);
  const r = restore(cp, reg);
  assert.equal(r.privateState("t"), undefined);
  assert.deepEqual(during(r, () => r.subscribe("k", "t")), ["k <- t: [START, DATA(6), COMPLETE]"]);
});

// w reports which inputs' terminals arrived in its run.
const ends = () => (ctx) => ctx.down([["DATA", ctx.deps.filter((d) => d.terminal).map((d) => d.id).join(",") || "-"]]);

test("a node holding an ended dependency comes back and works; the ended node does not run", () => {
  const reg = registry();
  let lastCalls = 0;
  reg.last = () => (ctx) => { lastCalls += 1; if (ctx.deps[0].waves.length) ctx.down([["DATA", ctx.deps[0].value]]); };
  const g = createGraph();
  g.state("config", 1); g.state("input", 0);
  node(g, reg, "e", ["config"], "last");
  node(g, reg, "s", ["e", "input"], "sum"); // default policy: open while input is
  g.subscribe("k", "s");
  g.complete("config");
  assert.deepEqual([g.get("e").ended, g.get("s").ended], [["COMPLETE"], null]);
  const r = restore(roundTrip(capture(g)), reg);
  const before = { ...reg.calls };
  lastCalls = 0;
  assert.deepEqual(during(r, () => r.subscribe("k", "s")), ["k <- s: [START, DATA(1)]"]);
  assert.deepEqual(during(r, () => r.set("input", 5)), ["k <- s: [PENDING, DATA(6)]"]);
  assert.deepEqual([reg.calls.sum - before.sum, lastCalls], [1, 0]);
  assert.deepEqual(during(r, () => r.subscribe("k2", "e")), ["k2 <- e: [START, DATA(1), COMPLETE]"]);
  assert.equal(lastCalls, 0);
});

test("an input that ended before the first subscription reaches the fn; one that had ended before capture does not again", () => {
  const reg = { ...registry(), ends };
  const g = createGraph();
  g.state("config", 1); g.state("input", 0);
  node(g, reg, "w", ["config", "input"], "ends");
  g.subscribe("k", "w");
  const open = roundTrip(capture(g));
  g.complete("config");
  g.set("input", 1);
  const closed = roundTrip(capture(g));
  const r1 = restore(open, reg);
  r1.complete("config");
  assert.deepEqual(during(r1, () => r1.subscribe("k", "w")), ["k <- w: [START, DATA(\"config\")]"]);
  const r2 = restore(closed, reg);
  r2.set("input", 2);
  assert.deepEqual(during(r2, () => r2.subscribe("k", "w")), ["k <- w: [START, DATA(\"-\")]"]);
});

// Adds to a registry a recipe `grab` that sums as `sum` does and keeps the ctx of its last run,
// so a test can rewire the node through it (F7: a node rewires itself through ctx.rewire).
function grabbing(reg, as = "sum") {
  const seen = { ctx: null };
  return { seen, reg: { ...reg, grab: (config) => { const fn = reg[as](config); return (ctx) => { seen.ctx = ctx; fn(ctx); }; } } };
}

test("a node without a recipe is local-only and cannot be restored", () => {
  const reg = registry();
  const g = createGraph();
  g.state("a", 1);
  node(g, reg, "s", ["a"], "sum");
  g.node("raw", ["a"], (ctx) => ctx.down([["DATA", 0]]));
  const cp = capture(g);
  assert.deepEqual(cp.nodes.filter((n) => n.local).map((n) => n.id), ["raw"]);
  assert.throws(() => restore(cp, reg), /not restorable: raw: local-only, built or replaced without a recipe/);
});

// F6 (the user's choice, 2026-11-10): a rewire belongs to the lifetime (F7), so it is saved with the
// lifetime's state and gives the restored node's first lifetime its dependencies back.
test("a node rewired for its lifetime is saved with those dependencies and restored onto them", () => {
  const { seen, reg } = grabbing(registry());
  const g = createGraph();
  g.state("a", 1); g.state("b", 2);
  node(g, reg, "s", ["a"], "grab");
  g.subscribe("k", "s");
  seen.ctx.rewire(["a", "b"]);
  assert.equal(g.get("s").value, 3);
  const cp = roundTrip(capture(g));
  const entry = cp.nodes.find((n) => n.id === "s");
  assert.deepEqual([entry.local, entry.deps, entry.saved.deps], [undefined, ["a"], ["a", "b"]], "declared deps, then the lifetime's");
  const r = restore(cp, reg);
  assert.deepEqual(r.definition("s").deps, ["a"]);
  assert.deepEqual(during(r, () => r.subscribe("k", "s")), ["k <- s: [START, DATA(3)]"], "no run: nothing changed");
  assert.deepEqual(r.describe().find((d) => d.id === "s").deps, ["a", "b"], "the first lifetime is on the saved dependencies");
  r.set("b", 5);
  assert.equal(r.get("s").value, 6, "b still drives s");
  r.unsubscribe("k", "s");
  assert.deepEqual(r.describe().find((d) => d.id === "s").deps, ["a"], "closing it puts back the declared ones");
});

// C6 (Codex review; decided by the user 2026-11-10): the definition is the dependencies and the function.
// Since F7 only replace can change the function; a rewire changes the dependencies only.
test("a replace without a recipe makes the node local-only, even when it keeps the dependencies", () => {
  const reg = { times: ({ k }) => (ctx) => { if (ctx.deps[0].has) ctx.down([["DATA", ctx.deps[0].value * k]]); } };
  const times3 = (ctx) => { if (ctx.deps[0].has) ctx.down([["DATA", ctx.deps[0].value * 3]]); };
  const g = createGraph();
  g.state("a", 1); node(g, reg, "p", ["a"], "times", { k: 2 }); node(g, reg, "q", ["a"], "times", { k: 2 });
  g.subscribe("s", "p");
  g.replace("p", ["a"], times3);
  assert.equal(g.definition("p").recipe, null);
  const cp = roundTrip(capture(g));
  assert.deepEqual(cp.nodes.filter((n) => n.local).map((n) => n.id), ["p"], "q keeps its recipe's definition");
  assert.throws(() => restore(cp, reg), /not restorable: p: local-only, built or replaced without a recipe/, "restoring it as the old recipe would give 4 where the original gives 6");
});

test("a host replace with a recipe keeps the node restorable, as the new recipe", () => {
  const reg = { times: ({ k }) => (ctx) => { if (ctx.deps[0].has) ctx.down([["DATA", ctx.deps[0].value * k]]); } };
  const g = createGraph();
  g.state("a", 1); node(g, reg, "p", ["a"], "times", { k: 2 });
  g.subscribe("s", "p");
  g.replace("p", ["a"], reg.times({ k: 3 }), { recipe: { ref: "times", config: { k: 3 } } });
  assert.equal(g.get("p").value, 3);
  const cp = roundTrip(capture(g));
  assert.deepEqual(cp.nodes.find((n) => n.id === "p").recipe, { ref: "times", config: { k: 3 } });
  const r = restore(cp, reg);
  r.subscribe("s", "p");
  assert.equal(r.get("p").value, 3);
  for (const x of [g, r]) x.set("a", 5);
  assert.deepEqual([r.get("p").value, g.get("p").value], [15, 15]);
});

// Codex review 1 (2026-11-10): setup belongs to the instance, so a replace gives the new one its own
// and the restore builds the setup of the recipe the node carries; both run the same setup.
test("after a replace with another setup, the original and the restore run the replacing instance's setup", () => {
  const log = [];
  const recipe = (name) => () => ({
    fn: (ctx) => ctx.down([["DATA", name]]),
    setup: () => { log.push(name); },
  });
  const reg = { a: recipe("A"), b: recipe("B") };
  const g = createGraph();
  node(g, reg, "n", [], "a");
  g.subscribe("k", "n");
  assert.deepEqual(log, ["A"]);
  const { fn, setup } = reg.b();
  g.replace("n", [], fn, { setup, recipe: { ref: "b" } });
  g.unsubscribe("k", "n"); g.subscribe("k", "n"); // reactivates the new instance
  assert.equal(g.get("n").value, "B");
  assert.deepEqual(log.splice(0), ["A", "B", "B"], "the replace's setup, on its activation and on the next");
  const r = restore(roundTrip(capture(g)), reg);
  r.subscribe("k", "n");
  assert.deepEqual(log, ["B"], "the restore runs the same setup as the original");
  assert.equal(r.get("n").value, "B");
});

// Codex review 2 (2026-11-10): a replace is a request; one in a batch body that throws is dropped,
// so the recipe the definition carries cannot disagree with its function.
test("a replace inside a batch body that throws leaves the definition and its restorability unchanged", () => {
  const reg = registry();
  const g = createGraph();
  g.state("a", 1);
  node(g, reg, "p", ["a"], "plus", { k: 10 });
  g.subscribe("k", "p");
  const before = g.definition("p");
  assert.throws(() => g.batch(() => {
    g.replace("p", ["a"], reg.plus({ k: 20 }), { recipe: { ref: "plus", config: { k: 20 } } });
    throw new Error("body failed");
  }), /body failed/);
  assert.deepEqual(g.definition("p"), before);
  assert.deepEqual(g.definition("p").recipe, { ref: "plus", config: { k: 10 } });
  const r = restore(roundTrip(capture(g)), reg);
  r.subscribe("k", "p");
  for (const x of [g, r]) x.set("a", 2);
  assert.deepEqual([r.get("p").value, g.get("p").value], [12, 12]);
});

// Codex review 3 (2026-11-10): a replace may give a node a dependency made after it; restore builds
// each node after its dependencies, not in creation order.
test("a node replaced onto a dependency made after it is restored, and works", () => {
  const reg = registry();
  const g = createGraph();
  node(g, reg, "n", [], "sum");
  g.state("later", 4);
  g.replace("n", ["later"], reg.plus({ k: 1 }), { recipe: { ref: "plus", config: { k: 1 } } });
  g.subscribe("k", "n");
  assert.equal(g.get("n").value, 5);
  const cp = roundTrip(capture(g));
  assert.deepEqual(cp.nodes.map((n) => n.id), ["n", "later"], "the checkpoint keeps creation order");
  const r = restore(cp, reg);
  assert.deepEqual(r.definition("n").deps, ["later"]);
  assert.deepEqual(during(r, () => r.subscribe("k", "n")), ["k <- n: [START, DATA(5)]"]);
  r.set("later", 9);
  assert.equal(r.get("n").value, 10);
});

test("a missing recipe fails the restore", () => {
  const cp = capture(original());
  const { scan, ...withoutScan } = registry();
  assert.throws(() => restore(cp, withoutScan), /not restorable: t: missing recipe/);
});

test("D802: a checkpoint without what each node received, as an earlier format, is refused", () => {
  const cp = roundTrip(capture(original()));
  const older = { nodes: cp.nodes.map((n) => {
    if (!n.saved || n.kind === "state") return n;
    const { inputs, ...rest } = n.saved;
    return { ...n, saved: rest };
  }) };
  assert.throws(() => restore(older, registry()), /not restorable: s: missing received records/);
  assert.doesNotThrow(() => restore(cp, registry()), "the same checkpoint with the record restores");
});

test("O5: capture is refused inside a wave and inside a batch body", () => {
  const g = original();
  let seen;
  g.subscribe("watch", "a", () => { if (g.get("a").value === 4) try { capture(g); } catch (e) { seen = e.message; } });
  g.set("a", 4);
  assert.match(seen, /wave boundary/);
  assert.throws(() => g.batch(() => capture(g)), /wave boundary/);
  assert.deepEqual(capture(g).nodes.find((n) => n.id === "a").saved.values, [4], "between waves it is allowed");
});

test("a value, private state, recipe config or ERROR payload that is not JSON is refused at capture", () => {
  const reg = { ...registry(), keep: () => (ctx) => { ctx.state.set({ f: () => {} }); ctx.down([["DATA", 1]]); } };
  const g = createGraph();
  g.state("a", 1);
  node(g, reg, "k", ["a"], "keep");
  g.subscribe("s", "k");
  assert.throws(() => capture(g), /not restorable: k: its private state is not JSON/);
  const h = createGraph();
  h.state("a", 1);
  node(h, reg, "x", ["a"], "plus", { k: () => 1 });
  assert.throws(() => capture(h), /not restorable: x: its recipe config is not JSON/);
  // An ERROR's payload is saved with its terminal, so it must be JSON too (D802).
  const e = createGraph();
  e.state("a", 1);
  e.error("a", new Error("boom"));
  assert.throws(() => capture(e), /not restorable: a: its ERROR payload is not JSON/);
});

test("a restored graph captured again before anything subscribes keeps the saved lifetimes", () => {
  const reg = registry();
  const once = restore(roundTrip(capture(original())), reg);
  once.set("a", 5); // received by nobody yet: the saved inputs still say a=3
  const twice = restore(roundTrip(capture(once)), reg);
  assert.deepEqual(during(twice, () => twice.subscribe("kt", "t")), ["kt <- t: [START, DATA(11)]"]);
  assert.equal(reg.calls.scan, 1);
});

test("K3: every value of a node's last array is saved and comes back in its snapshot", () => {
  const reg = { ...registry(), pair: () => (ctx) => { const v = ctx.deps[0].value; ctx.down([["DATA", v], ["DATA", -v]]); } };
  const g = createGraph();
  g.state("a", 0);
  node(g, reg, "p", ["a"], "pair");
  g.subscribe("k", "p");
  g.batch(() => { g.set("a", 1); g.set("a", 2); });
  const r = restore(roundTrip(capture(g)), reg);
  assert.deepEqual(r.get("a").values, [1, 2], "a state's last array, back as one array");
  assert.deepEqual(during(r, () => r.subscribe("k", "p")), ["k <- p: [START, DATA(2), DATA(-2)]"]);
});

// A cleanup is a closure and cannot be saved; a node that holds an outside resource opens it in
// its setup, which runs at every activation, a restored one's included (K7, the user's choice
// 2026-11-10, replacing A2's extra run of the function).

// history over s, n = 3, after 1, 2, 3; the same steps on the original and on its restore.
function historyPair() {
  const reg = { history: historyRecipe };
  const g = createGraph();
  g.state("s"); node(g, reg, "h", ["s"], "history", { n: 3 }, historyOpts);
  g.subscribe("k", "h");
  for (const v of [1, 2, 3]) g.set("s", v);
  return { g, reg, cp: roundTrip(capture(g)) };
}

test("a restored history needs no rerun: under the manual INVALIDATE policy an INVALIDATE is its input", () => {
  const { g, reg, cp } = historyPair();
  const r = restore(cp, reg);
  assert.deepEqual(during(r, () => r.subscribe("k", "h")), ["k <- h: [START, DATA([[[1]],[[2]],[[3]]])]"]);
  for (const x of [g, r]) { x.invalidate("s"); x.set("s", 9); }
  assert.deepEqual(r.get("h").value, [[[9]]]);
  assert.deepEqual(r.get("h").value, g.get("h").value);
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
  const g = createGraph();
  node(g, reg, "i", [], "interval");
  g.subscribe("k", "i");
  tick(); tick();
  const cp = roundTrip(capture(g));
  g.unsubscribe("k", "i");
  assert.equal(timers.size, 0, "the cleanup stopped the original's timer");
  setups = 0; runs = 0;
  const r = restore(cp, reg);
  r.subscribe("k", "i");
  assert.deepEqual([setups, runs, timers.size, r.get("i").value], [1, 0, 1, 2], "one setup, no run, one timer, the saved value");
  tick();
  assert.equal(r.get("i").value, 3, "the count goes on");
});

test("an input that only ended before the first subscription brings its end, not its values again", () => {
  const { g, reg, cp } = historyPair();
  const r = restore(cp, reg);
  for (const x of [g, r]) x.complete("s");
  r.subscribe("k", "h");
  assert.deepEqual([r.get("h").value, r.get("h").ended], [[[[1]], [[2]], [[3]]], ["COMPLETE"]]);
  assert.deepEqual([r.get("h").value, r.get("h").ended], [g.get("h").value, g.get("h").ended]);
});

test("R-checkpoint: before the first subscription only values are compared; subscribed first, an INVALIDATE is seen", () => {
  const { g, reg, cp } = historyPair();
  g.invalidate("s"); g.set("s", 9);
  const early = restore(cp, reg);
  early.invalidate("s"); early.set("s", 9);
  early.subscribe("k", "h");
  assert.deepEqual(early.get("h").value, [[[2]], [[3]], [[9]]], "the INVALIDATE before the subscription is not seen");
  const first = restore(cp, reg);
  first.subscribe("k", "h");
  first.invalidate("s"); first.set("s", 9);
  assert.deepEqual(first.get("h").value, g.get("h").value, "subscribed first, the restore behaves as the original");
});

test("a dependency's snapshot is compared as a whole array: [1, 2] -> [3, 2] is a change", () => {
  const reg = { vals: () => (ctx) => ctx.down([["DATA", ctx.deps[0].waves.flat()]]) };
  const g = createGraph();
  g.state("s"); node(g, reg, "d", ["s"], "vals");
  g.subscribe("k", "d");
  g.batch(() => { g.set("s", 1); g.set("s", 2); });
  const cp = roundTrip(capture(g));
  assert.deepEqual(cp.nodes.find((n) => n.id === "d").saved.inputs[0].values, [1, 2]);
  const r = restore(cp, reg);
  r.batch(() => { r.set("s", 3); r.set("s", 2); }); // the same last value, another array
  r.subscribe("k", "d");
  assert.deepEqual(r.get("d").value, [3, 2]);
  const same = restore(cp, reg);
  same.subscribe("k", "d");
  assert.deepEqual(same.get("d").value, [1, 2], "an unchanged array is no change");
});

// ---- F6 (the user's choice, 2026-11-10): every module's graph can be captured and restored ----
import { pausable, pausableOf, pauseRecipes } from "./pause.mjs";
import { pullable, pullableOf, demandRecipes } from "./demand.mjs";

// After capture, the same steps on the original and on its restore send the same arrays.
const after = (g, sinkId, body) => { const start = g.trace.length; body(); return g.trace.slice(start).filter((e) => e.to === sinkId).map(format); };

test("F6: a paused pausable is restored with its locks and held arrays, and the resume sends them as the original's does", () => {
  const g = createGraph();
  g.state("a", 1);
  const p = pausable(g, "p", "a");
  g.subscribe("s", "p");
  p.pause("L");
  g.set("a", 2); g.set("a", 3);
  const cp = roundTrip(capture(g));
  assert.deepEqual(cp.nodes.filter((n) => n.local), []);
  const r = restore(cp, pauseRecipes);
  const rp = pausableOf(r, "p");
  assert.deepEqual(r.get(rp.locksId).value, ["L"]);
  r.subscribe("s", "p");
  const resumed = (x, handle) => after(x, "s", () => handle.resume("L"));
  const restored = resumed(r, rp);
  assert.deepEqual(restored, resumed(g, p));
  assert.deepEqual(restored, ["s <- p: [PENDING, DATA(2)]", "s <- p: [PENDING, DATA(3)]"], "both held arrays, as they arrived");
  assert.deepEqual(resumed(r, rp), [], "a second resume changes nothing");
  assert.deepEqual(after(r, "s", () => r.set("a", 4)), after(g, "s", () => g.set("a", 4)));
});

// The service sends the pull's params and the held values.
const page = () => (ctx) => ctx.down([["DATA", `${ctx.pull.params}:${ctx.deps[0].waves.flat().join(",")}`]]);
const pageRecipes = { ...demandRecipes, page };

// a = 0; pulled once after a = 1 ("p1:0,1"); then a = 2 and 3 held.
function servedHolder() {
  const g = createGraph();
  g.state("a", 0);
  const h = pullable(g, "h", "a", page(), { recipe: { ref: "page" } });
  g.subscribe("s", "h");
  g.set("a", 1); h.pull("p1");
  g.set("a", 2); g.set("a", 3);
  return { g, h, cp: roundTrip(capture(g)) };
}

test("F6: a demand holder is restored with its queue and request number, and the next pull is served as the original's", () => {
  const { g, h, cp } = servedHolder();
  assert.deepEqual(cp.nodes.filter((n) => n.local), []);
  const r = restore(cp, pageRecipes);
  const rh = pullableOf(r, "h");
  assert.deepEqual(during(r, () => r.subscribe("s", "h")), ['s <- h: [START, DATA("p1:0,1")]'], "no run, nothing old served");
  const served = after(r, "s", () => rh.pull("p2"));
  assert.deepEqual(served, after(g, "s", () => h.pull("p2")));
  assert.deepEqual(served, ['s <- h: [PENDING, DATA("p2:2,3")]']);
  assert.deepEqual(r.get(rh.demandId).value, g.get(h.demandId).value, "the request numbers go on");
});

// Fable review 2a (2026-11-10): R-pull, a pull at an inactive holder is not kept, restored or not.
test("F6: a pull at a restored holder before its first subscription is not served", () => {
  const { cp } = servedHolder();
  const r = restore(cp, pageRecipes);
  const rh = pullableOf(r, "h");
  rh.pull("early"); // the holder is inactive
  assert.deepEqual(during(r, () => r.subscribe("s", "h")), ['s <- h: [START, DATA("p1:0,1")]'], "the early pull is not served");
  assert.deepEqual(after(r, "s", () => rh.pull("p3")), ['s <- h: [PENDING, DATA("p3:2,3")]'], "a later pull is, with what was held");
});

// Fable review 2c (2026-11-10): a demand change before the first subscription runs the restored
// holder's real function; it must not fail.
test("F6: a restored holder whose demand changed before its first subscription does not end with ERROR", () => {
  const { cp } = servedHolder();
  const reports = [];
  const r = restore(cp, pageRecipes, { report: (x) => reports.push(x) });
  const rh = pullableOf(r, "h");
  r.set("a", 4); rh.pull("early");
  r.subscribe("s", "h");
  assert.deepEqual([r.get("h").ended, reports], [null, []]);
  assert.deepEqual(after(r, "s", () => rh.pull("p3")), ['s <- h: [PENDING, DATA("p3:2,3,4")]']);
});

// The same review: a function that builds a view over its ctx, as the holder does,
// must be able to on a restored node's first run, which sees the wrapper's ctx.
test("a restored node's first run can give a view of its ctx other deps", () => {
  const reg = { view: () => (ctx) => {
    const v = Object.create(ctx, { deps: { value: [{ ...ctx.deps[0], value: ctx.deps[0].value * 2 }] } });
    v.down([["DATA", v.deps[0].value]]);
  } };
  const g = createGraph();
  g.state("a", 1);
  node(g, reg, "d", ["a"], "view");
  g.subscribe("k", "d");
  const reports = [];
  const r = restore(roundTrip(capture(g)), reg, { report: (x) => reports.push(x) });
  r.set("a", 4);
  r.subscribe("k", "d");
  assert.deepEqual([r.get("d").value, r.get("d").ended, reports], [8, null, []]);
});

import { restartable, restartableOf, restartRecipes } from "./restart.mjs";
import { retryPolicy } from "./resilience.mjs";

// The inner forwards a's values and fails on "bad".
const fwd = () => (ctx) => {
  for (const v of ctx.deps[0].waves.flat()) ctx.down([v === "bad" ? ["ERROR", "bad"] : ["DATA", v]]);
};
const fwdRecipes = { ...restartRecipes, fwd };

test("F6: a restart owner is restored with its round, request number and live inner, and goes on as the original", () => {
  const g = createGraph();
  g.state("a", 1);
  const r0 = restartable(g, "r", { deps: ["a"], fn: fwd(), recipe: { ref: "fwd" }, rounds: 2 });
  g.subscribe("s", "r");
  g.set("a", 2);
  r0.restart(); // the inner was replaced with its own definition: still restorable
  g.set("a", 3);
  const cp = roundTrip(capture(g));
  assert.deepEqual(cp.nodes.filter((n) => n.local), []);
  const r = restore(cp, fwdRecipes);
  const r1 = restartableOf(r, "r");
  r.subscribe("s", "r");
  assert.deepEqual(r.get("r").value, 3);
  assert.deepEqual(after(r, "s", () => r1.restart()), after(g, "s", () => r0.restart()));
  assert.deepEqual(r.get("r/restart").value, 2, "the request numbers go on");
  assert.deepEqual(after(r, "s", () => r.set("a", 4)), after(g, "s", () => g.set("a", 4)));
});

// Fable review 2a (2026-11-10): a restart request is served once, and one made while the owner is
// inactive, restored or not, is old at its activation.
test("F6: a restart requested at a restored owner before its first subscription starts no attempt", () => {
  let runs = 0;
  const reg = { ...restartRecipes, counted: () => { const f = fwd(); return (ctx) => { runs += 1; f(ctx); }; } };
  const g = createGraph();
  g.state("a", 1);
  restartable(g, "r", { deps: ["a"], fn: reg.counted(), recipe: { ref: "counted" } });
  g.subscribe("s", "r");
  g.set("a", 2);
  const attempts = g.privateState("r").attempt;
  const r = restore(roundTrip(capture(g)), reg);
  restartableOf(r, "r").restart(); // the owner is inactive
  runs = 0;
  assert.deepEqual(during(r, () => r.subscribe("s", "r")), ["s <- r: [START, DATA(2)]"]);
  assert.deepEqual([runs, r.privateState("r").attempt, r.privateState("r").seen], [0, attempts, 1], "the request is seen, not served");
  r.set("a", 3);
  assert.deepEqual([runs, r.get("r").value], [1, 3], "the restored inner goes on");
});

test("F6: an owner restored while a retry was waiting is not stuck: as at a deactivation, its inner is renewed", () => {
  const g = createGraph();
  g.state("a", 1);
  restartable(g, "r", { deps: ["a"], fn: fwd(), recipe: { ref: "fwd" }, retry: retryPolicy({ maxAttempts: 3, initialMs: 60_000 }) });
  g.subscribe("s", "r");
  g.set("a", "bad"); // the inner fails; a retry waits for a minute
  assert.equal(g.get("r/inner").ended?.[0], "ERROR");
  const cp = roundTrip(capture(g));
  g.unsubscribe("s", "r"); // drops the original's timer
  const r = restore(cp, fwdRecipes);
  r.set("a", 5);
  r.subscribe("s", "r");
  assert.deepEqual(r.get("r").value, 5, "a fresh inner over a = 5, without waiting for the lost timer");
  assert.equal(r.get("r").ended, null);
  assert.deepEqual(r.privateState("r").failures, 1, "the failure counted before capture still counts");
  r.unsubscribe("s", "r");
});

// Fable review 2b (2026-11-10): the seed's note reaches only the seeded instance's first run, so the
// renewed inner runs its function on a's snapshot even when nothing changed since the capture.
test("F6: an owner restored while a retry was waiting, with no input changed, runs its renewed inner", () => {
  const flaky = { fail: true };
  const reg = { ...restartRecipes, flaky: () => (ctx) => {
    for (const v of ctx.deps[0].waves.flat()) ctx.down([flaky.fail && v === 2 ? ["ERROR", "flaky"] : ["DATA", v]]);
  } };
  const g = createGraph();
  g.state("a", 1);
  restartable(g, "r", { deps: ["a"], fn: reg.flaky(), recipe: { ref: "flaky" }, retry: retryPolicy({ maxAttempts: 3, initialMs: 60_000 }) });
  g.subscribe("s", "r");
  g.set("a", 2); // the inner fails; a retry waits for a minute
  assert.deepEqual([g.get("r").value, g.get("r/inner").ended], [1, ["ERROR", "flaky"]]);
  const cp = roundTrip(capture(g));
  g.unsubscribe("s", "r"); // drops the original's timer
  flaky.fail = false;
  const r = restore(cp, reg);
  r.subscribe("s", "r");
  assert.deepEqual([r.get("r").value, r.get("r").ended, r.get("r/inner").ended], [2, null, null], "the renewed inner ran on a = 2");
  r.set("a", 3);
  assert.equal(r.get("r").value, 3);
  r.unsubscribe("s", "r");
});

import { higherOrderRecipes, mergeMap, relay, switchMap } from "./higher-order.mjs";

// The projector follows the node a source value names.
const follow = () => (v) => ({ deps: [v], fn: relay, recipe: { ref: "higher.relay" } });
const hoRecipes = { ...higherOrderRecipes, follow };

test("F6: a switchMap is restored with its live inner and its rewired dependencies, and switches as the original", () => {
  const g = createGraph();
  g.state("x", 1); g.state("y", 10); g.state("s", "x");
  switchMap(g, "sw", "s", follow(), { recipe: { ref: "follow" } });
  g.subscribe("k", "sw");
  g.set("x", 2);
  const cp = roundTrip(capture(g));
  assert.deepEqual(cp.nodes.filter((n) => n.local), []);
  assert.deepEqual(cp.nodes.find((n) => n.id === "sw").saved.deps, ["s", "sw/inner"]);
  const r = restore(cp, hoRecipes);
  r.subscribe("k", "sw");
  assert.equal(r.get("sw").value, 2);
  for (const step of [(x) => x.set("x", 3), (x) => x.set("s", "y"), (x) => x.set("x", 4), (x) => x.set("y", 11)]) {
    assert.deepEqual(after(r, "k", () => step(r)), after(g, "k", () => step(g)));
  }
  assert.equal(r.get("sw").value, 11);
  // The switch replaced sw/inner with the projection's recipe, so it is restorable again.
  const cp2 = roundTrip(capture(r));
  assert.deepEqual(cp2.nodes.filter((n) => n.local), []);
  assert.deepEqual(cp2.nodes.find((n) => n.id === "sw/inner").deps, ["y"]);
  const r2 = restore(cp2, hoRecipes);
  r2.subscribe("k", "sw");
  assert.deepEqual(after(r2, "k", () => r2.set("y", 12)), after(r, "k", () => r.set("y", 12)));
});

test("F6: a mergeMap is restored with a value waiting for a free slot, and projects it when the live inner completes", () => {
  const g = createGraph();
  g.state("x", 1); g.state("y", 10); g.state("s", "x");
  mergeMap(g, "mm", "s", follow(), { concurrent: 1, recipe: { ref: "follow" } });
  g.subscribe("k", "mm");
  g.set("s", "y"); // waits: one inner is live
  const cp = roundTrip(capture(g));
  assert.deepEqual(cp.nodes.filter((n) => n.local), []);
  assert.deepEqual(cp.nodes.find((n) => n.id === "mm").saved.state.queue, ["y"]);
  const r = restore(cp, hoRecipes);
  r.subscribe("k", "mm");
  for (const step of [(x) => x.set("x", 2), (x) => x.complete("x"), (x) => x.set("y", 12)]) {
    assert.deepEqual(after(r, "k", () => step(r)), after(g, "k", () => step(g)));
  }
  assert.equal(r.get("mm").value, 12, "y was projected once x's inner completed");
});

test("C-49: mergeMap continues bare/1/2 inner numbering after restore", () => {
  const g = createGraph();
  g.state("x", 1); g.state("y", 2); g.state("z", 3); g.state("s", "x");
  mergeMap(g, "mm", "s", follow(), { recipe: { ref: "follow" } });
  g.subscribe("k", "mm");
  g.set("s", "y");
  const r = restore(roundTrip(capture(g)), hoRecipes);
  r.subscribe("k", "mm");
  for (const graph of [g, r]) {
    graph.set("s", "z");
    assert.deepEqual(graph.describe().find((n) => n.id === "mm").deps,
      ["s", "mm/inner", "mm/inner1", "mm/inner2"]);
    assert.deepEqual(["mm/inner", "mm/inner1", "mm/inner2"].map((id) => graph.get(id).value), [1, 2, 3]);
    assert.equal(graph.get("mm").value, 3);
  }
});

// C-47: capture is refused only for the graph whose wave is running (R-graph-domain@3).
test("C-47: inside g1's wave, g1 cannot be captured and an idle g2 can", () => {
  const g1 = createGraph();
  const g2 = createGraph();
  g1.state("a", 0);
  g2.state("b", 0);
  const seen = [];
  g1.subscribe("s1", "a", (msgs) => {
    if (!msgs.some((m) => m[0] === "DATA" && m[1] === 1)) return;
    g2.set("b", 1);
    assert.throws(() => capture(g1), /wave boundary/);
    assert.equal(capture(g2).nodes.find((n) => n.id === "b").saved.values[0], 1);
    seen.push("checked");
  });
  g1.set("a", 1);
  assert.equal(seen.at(-1), "checked");
});

test("D808: omitted whole lifetime fails; cold lifetime is explicitly null", () => {
  const cp = roundTrip(capture(original()));
  delete cp.nodes.find((n) => n.id === "s").saved;
  assert.throws(() => restore(cp, registry()), { message: "not restorable: s: missing received records" });
  const g = createGraph();
  g.state("a", 1);
  node(g, registry(), "cold", ["a"], "sum");
  const cold = capture(g);
  assert.equal(cold.nodes.find((n) => n.id === "cold").saved, null);
  const r = restore(cold, registry());
  assert.equal(r.get("cold").active, false);
});

test("D808: local-only nodes still validate retained data and private state", () => {
  for (const field of ["value", "state"]) {
    const g = createGraph();
    g.node("n", [], (ctx) => {
      if (field === "value") ctx.down([["DATA", () => 1]]);
      else ctx.state.set({ bad: () => 1 });
    });
    g.subscribe("keep", "n");
    assert.throws(() => capture(g), { message: `not restorable: n: its ${field === "value" ? "retained values are" : "private state is"} not JSON` });
  }
});

test("D808: projected dependency views retain their invocation read guard", async () => {
  const { withDependencies } = await import("./context.mjs");
  const g = createGraph();
  g.state("s", 1);
  let adapted, dep;
  g.node("n", ["s"], (ctx) => {
    adapted = withDependencies(ctx, [{ ...ctx.deps[0], waves: [[2]] }]);
    dep = adapted.deps[0];
    assert.deepEqual(dep.waves, [[2]]);
  });
  g.subscribe("keep", "n");
  const error = { message: "ctx.deps is only available during setup or function invocation" };
  assert.throws(() => adapted.deps, error);
  assert.throws(() => dep.waves, error);
});

test("checkpoint private state and values are detached in both directions", () => {
  const g = createGraph();
  const reg = { counter: () => (ctx) => {
    const state = ctx.state.get() ?? { count: 0 };
    state.count++;
    ctx.state.set(state);
    ctx.down([["DATA", { count: state.count }]]);
  } };
  g.state("s", 0);
  node(g, reg, "n", ["s"], "counter");
  g.subscribe("keep", "n");
  const cp = capture(g);
  const saved = cp.nodes.find((n) => n.id === "n").saved;
  g.set("s", 1);
  assert.equal(saved.state.count, 1);
  assert.equal(saved.values[0].count, 1);
  const restored = restore(cp, reg);
  restored.subscribe("keep", "n");
  restored.set("s", 2);
  assert.equal(saved.state.count, 1);
  saved.state.count = 55; saved.values[0].count = 55;
  assert.equal(g.privateState("n").count, 2);
  assert.equal(restored.privateState("n").count, 2);
  assert.equal(restored.get("n").value.count, 2);
});

test("checkpoint refuses incomplete received records before any recipe runs", () => {
  for (const input of [{}, { has: true, values: [1] }, { has: true, ended: null }, { has: true, values: [], ended: null }, { has: false, ended: ["DATA", 1] }]) {
    const cp = capture(original());
    cp.nodes.find((n) => n.id === "s").saved.inputs = [input];
    let factories = 0;
    const reg = Object.fromEntries(Object.entries(registry()).map(([name, factory]) =>
      [name, (...args) => { factories++; return factory(...args); }]));
    assert.throws(() => restore(cp, reg), { message: "not restorable: s: missing received records" });
    assert.equal(factories, 0);
  }
});

test("checkpoint cold lifetime is exactly null, never a falsey or array value", () => {
  for (const saved of [false, 0, "", [], undefined]) {
    const g = createGraph();
    g.node("n", [], () => {}, { recipe: { ref: "n" } });
    const cp = capture(g);
    cp.nodes[0].saved = saved;
    assert.throws(() => restore(cp, { n: () => () => {} }), { message: "not restorable: n: missing received records" });
  }
});

test("known-node recipe failures keep the node prefix without double wrapping", () => {
  const g = createGraph();
  g.node("n", [], () => {}, { recipe: { ref: "bad" } });
  const cp = capture(g);
  for (const factory of [() => null, () => ({ fn: 7 }), () => ({ fn: () => {}, setup: 7 })]) {
    assert.throws(() => restore(cp, { bad: factory }), /not restorable: n: recipe must return/);
  }
  assert.throws(() => restore(cp, { bad: () => { throw new Error("factory failed"); } }), { message: "not restorable: n: factory failed" });
  assert.throws(() => restore(cp, { bad: (_, { make }) => make("absent") }), { message: "not restorable: n: missing recipe" });
});

test("QA2: restore admits the whole checkpoint before any factory side effect", () => {
  const g = createGraph();
  g.node("first", [], () => {}, { recipe: { ref: "counted" } });
  g.state("s", 17); g.complete("s");
  g.node("last", ["s"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]), {
    recipe: { ref: "counted" }, quiet: true,
    terminal: { complete: "manual", error: "manual" }, invalidate: "manual",
  });
  g.subscribe("hold", "last");
  const captured = capture(g);
  const corruptions = [
    ["missing state saved", (cp) => { delete cp.nodes[1].saved; }],
    ["null state saved", (cp) => { cp.nodes[1].saved = null; }],
    ["missing state values", (cp) => { delete cp.nodes[1].saved.values; }],
    ["missing state terminal", (cp) => { delete cp.nodes[1].saved.ended; }],
    ["invalid terminal tag", (cp) => { cp.nodes[1].saved.ended = ["DATA", 23]; }],
    ["extra COMPLETE payload", (cp) => { cp.nodes[1].saved.ended = ["COMPLETE", 23]; }],
    ["extra ERROR payload", (cp) => { cp.nodes[1].saved.ended = ["ERROR", "bad", 23]; }],
    ["boolean ERROR payload", (cp) => { cp.nodes[1].saved.ended = ["ERROR", true]; }],
    ["duplicate id", (cp) => { cp.nodes.push(structuredClone(cp.nodes[1])); }],
    ["missing node kind", (cp) => { delete cp.nodes[2].kind; }],
    ["missing deps", (cp) => { delete cp.nodes[2].deps; }],
    ["received count differs from declared deps", (cp) => { cp.nodes[2].deps.push("s"); }],
    ["duplicate lifetime deps", (cp) => {
      cp.nodes[2].saved.deps = ["s", "s"];
      cp.nodes[2].saved.inputs.push(structuredClone(cp.nodes[2].saved.inputs[0]));
    }],
    ["unknown dependency", (cp) => { cp.nodes[2].deps[0] = "absent"; }],
    ["unknown lifetime dependency", (cp) => { cp.nodes[2].saved.deps = ["absent"]; }],
    ["declared cycle", (cp) => { cp.nodes[2].deps = ["last"]; }],
    ["lifetime cycle", (cp) => { cp.nodes[2].saved.deps = ["last"]; }],
    ["missing node saved", (cp) => { delete cp.nodes[2].saved; }],
    ["missing node values", (cp) => { delete cp.nodes[2].saved.values; }],
    ["missing node terminal", (cp) => { delete cp.nodes[2].saved.ended; }],
    ["missing received", (cp) => { delete cp.nodes[2].saved.inputs; }],
    ["truncated received", (cp) => { cp.nodes[2].saved.inputs[0] = {}; }],
    ["missing received values", (cp) => { delete cp.nodes[2].saved.inputs[0].values; }],
    ["missing received terminal", (cp) => { delete cp.nodes[2].saved.inputs[0].ended; }],
    ["inconsistent received absence", (cp) => { cp.nodes[2].saved.inputs[0].has = false; }],
    ["missing policies", (cp) => { delete cp.nodes[2].opts; }],
    ["missing quiet", (cp) => { delete cp.nodes[2].opts.quiet; }],
    ["invalid quiet", (cp) => { cp.nodes[2].opts.quiet = 1; }],
    ["missing complete", (cp) => { delete cp.nodes[2].opts.terminal.complete; }],
    ["invalid error policy", (cp) => { cp.nodes[2].opts.terminal.error = "maybe"; }],
    ["missing invalidate", (cp) => { delete cp.nodes[2].opts.invalidate; }],
    ["missing recipe", (cp) => { delete cp.nodes[2].recipe; }],
  ];
  for (const [name, corrupt] of corruptions) {
    const cp = structuredClone(captured);
    corrupt(cp);
    let calls = 0;
    assert.throws(() => restore(cp, { counted: () => { calls++; return () => {}; } }), /not restorable:/, name);
    assert.equal(calls, 0, `${name} must fail before even the first valid factory runs`);
  }
});

test("QA2: restore refuses cycles mixing declared and lifetime dependencies before factories", () => {
  const cp = capture(original());
  const s = cp.nodes.find((n) => n.id === "s");
  const t = cp.nodes.find((n) => n.id === "t");
  s.deps = ["t"];
  s.saved.deps = ["a", "b"];
  t.saved.deps = ["s"];
  t.saved.inputs = [{ has: true, values: [5], ended: null }];
  // Each DAG alone is acyclic. Closing s's lifetime would restore s -> t -> s.
  let calls = 0;
  const build = () => { calls++; return () => {}; };
  assert.throws(() => restore(cp, { sum: build, scan: build }), /depends on itself/);
  assert.equal(calls, 0);
});

test("QA2: restore preserves valid repeated declared inputs without inventing rewire restrictions", () => {
  const g = createGraph();
  g.state("a", 2);
  node(g, registry(), "n", ["a", "a"], "sum");
  g.subscribe("keep", "n");
  const r = restore(capture(g), registry());
  r.subscribe("keep", "n");
  assert.equal(r.get("n").value, 4);
  r.set("a", 3);
  assert.equal(r.get("n").value, 6);
  assert.deepEqual(r.definition("n").deps, ["a", "a"]);
});
