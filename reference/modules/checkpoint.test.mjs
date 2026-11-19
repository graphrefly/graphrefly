import test from "node:test";
import assert from "node:assert/strict";
import { createGraph, format } from "../kernel/kernel.mjs";
import { capture, restore } from "./checkpoint.mjs";
import { historyRecipe } from "./history.mjs";
import { frameSource, wireEdgeGroupIn, wireEdgeGroupOut } from "./bridge.mjs";

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

// D812 (4), decided by the user 2026-11-18: capture already refused what is not JSON, yet wrote a
// checkpoint for a node it knew could not be restored. The refusal is made at capture now.
test("a node without a recipe is local-only, and capture refuses the graph and names it", () => {
  const reg = registry();
  const g = createGraph();
  g.state("a", 1);
  node(g, reg, "s", ["a"], "sum");
  g.node("raw", ["a"], (ctx) => ctx.down([["DATA", 0]]));
  assert.throws(() => capture(g), { message: "not restorable: raw: local-only, built or replaced without a recipe" });
});

test("a checkpoint that already holds a local-only node, as one written before D812, fails at restore", () => {
  const reg = registry();
  const g = createGraph();
  g.state("a", 1);
  node(g, reg, "s", ["a"], "sum");
  const cp = capture(g);
  cp.nodes.push({ id: "raw", kind: "node", deps: ["a"], local: true });
  assert.throws(() => restore(cp, reg), { message: "not restorable: raw: local-only, built or replaced without a recipe" });
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
  assert.throws(() => capture(g), { message: "not restorable: p: local-only, built or replaced without a recipe" }, "saving it as the old recipe would restore 4 where the original gives 6");
  g.replace("p", ["a"], reg.times({ k: 3 }), { recipe: { ref: "times", config: { k: 3 } } });
  assert.deepEqual(roundTrip(capture(g)).nodes.map((n) => n.local), [undefined, undefined, undefined], "a replace with a recipe is saved as that recipe");
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
  // D812 (4), confirmed by the user 2026-11-18: the refusal names the reference as well as the node.
  assert.throws(() => restore(cp, withoutScan), { message: "not restorable: t: missing recipe scan" });
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
  g.state("s"); node(g, reg, "h", ["s"], "history", { n: 3 });
  g.subscribe("k", "h");
  for (const v of [1, 2, 3]) g.set("s", v);
  return { g, reg, cp: roundTrip(capture(g)) };
}

test("a restored history needs no rerun and keeps its list across an INVALIDATE, as the original does (D812)", () => {
  const { g, reg, cp } = historyPair();
  const r = restore(cp, reg);
  assert.deepEqual(during(r, () => r.subscribe("k", "h")), ["k <- h: [START, DATA([[[1]],[[2]],[[3]]])]"]);
  for (const x of [g, r]) { x.invalidate("s"); x.set("s", 9); }
  assert.deepEqual(r.get("h").value, [[[2]], [[3]], [[9]]]);
  assert.deepEqual(r.get("h").value, g.get("h").value);
  // A restored node receives no waves before its first activation, so it cannot see an INVALIDATE
  // made then; keeping the list makes it agree with one that saw it when the value written after
  // it is another one.
  const unseen = restore(cp, reg);
  unseen.invalidate("s"); unseen.set("s", 9);
  unseen.subscribe("k", "h");
  assert.deepEqual(unseen.get("h").value, g.get("h").value);
});

// R-checkpoint@2 (the user, 2026-11-19): what a restored node makes of an INVALIDATE it could not see.
test("an INVALIDATE before a restored node's first subscription: seen as the write after it, not seen, or as a dependency without a value", () => {
  let runs = 0;
  const reg = { plus: () => (ctx) => { runs += 1; const d = ctx.deps[0]; if (d.has) ctx.down([["DATA", d.value + 1]]); } };
  const g = createGraph();
  g.state("a", 1); node(g, reg, "p", ["a"], "plus");
  g.subscribe("k", "p");
  const cp = roundTrip(capture(g));
  const after = (act) => { const r = restore(cp, reg); runs = 0; act(r); const first = during(r, () => r.subscribe("k", "p")); return [runs, first, r.get("p").has]; };
  assert.deepEqual(after((r) => { r.invalidate("a"); r.set("a", 5); }), [1, ["k <- p: [START, DATA(6)]"], true], "another value: the write");
  assert.deepEqual(after((r) => { r.invalidate("a"); r.set("a", 1); }), [0, ["k <- p: [START, DATA(2)]"], true], "the value it had received: not seen");
  assert.deepEqual(after((r) => { r.invalidate("a"); }), [1, ["k <- p: [START, DATA(2)]"], true], "alone: a runs without a value, and p's own value stays");
});

// Second QA (2026-11-19; the user: "我们要be honest"). A restored history is not always as the
// original. It is told only what its input holds at its first activation (R-checkpoint), so two
// things done before its first subscription are not seen as the original saw them.
test("a restored history differs from the original after an unseen INVALIDATE with the same value written again, or alone", () => {
  // The value the source had at the capture, written again: the original has a new entry; the
  // restored node's input is unchanged, so it does not run and keeps the saved list.
  const same = historyPair();
  const r1 = restore(same.cp, same.reg);
  for (const x of [same.g, r1]) { x.invalidate("s"); x.set("s", 3); }
  r1.subscribe("k", "h");
  assert.deepEqual(same.g.get("h").value, [[[2]], [[3]], [[3]]]);
  assert.deepEqual(r1.get("h").value, [[[1]], [[2]], [[3]]]);
  // The INVALIDATE alone: the original holds no value until the next DATA; the restored node
  // still holds its saved list and sends it.
  const alone = historyPair();
  const r2 = restore(alone.cp, alone.reg);
  for (const x of [alone.g, r2]) x.invalidate("s");
  assert.deepEqual(during(r2, () => r2.subscribe("k", "h")), ["k <- h: [START, DATA([[[1]],[[2]],[[3]]])]"]);
  assert.deepEqual([alone.g.get("h").has, r2.get("h").has], [false, true]);
  // The next value brings them together again.
  for (const x of [alone.g, r2]) x.set("s", 9);
  assert.deepEqual(r2.get("h").value, alone.g.get("h").value);
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

// D812 (2), decided by the user 2026-11-18: a pending retry is state. The failure count and the
// attempt number are in the owner's private state, so its setup starts that retry's delay again in
// full, for the same attempt. Until then a restored owner renewed its inner at once, which kept the
// failure count and skipped the backoff a process that crashes and restarts repeatedly needs most.
const waitingOwner = (reg, recipe, bad) => {
  const g = createGraph();
  g.state("a", 1);
  restartable(g, "r", { deps: ["a"], fn: reg[recipe](), recipe: { ref: recipe }, retry: retryPolicy({ maxAttempts: 3, initialMs: 60_000 }) });
  g.subscribe("s", "r");
  g.set("a", bad); // the inner fails; a retry waits for a minute
  assert.equal(g.get("r/inner").ended?.[0], "ERROR");
  const cp = roundTrip(capture(g));
  g.unsubscribe("s", "r"); // drops the original's timer
  return cp;
};

test("F6, D812: an owner restored while a retry was waiting waits that retry's delay again in full, then starts a fresh inner", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const r = restore(waitingOwner(fwdRecipes, "fwd", "bad"), fwdRecipes);
  r.set("a", 5);
  r.subscribe("s", "r");
  assert.deepEqual([r.get("r").value, r.get("r").ended, r.get("r/inner").ended], [1, null, ["ERROR", "bad"]], "no inner is started at its activation");
  t.mock.timers.tick(59_999);
  assert.deepEqual(r.get("r/inner").ended, ["ERROR", "bad"], "nor before the full delay has passed since then");
  t.mock.timers.tick(1);
  assert.deepEqual([r.get("r").value, r.get("r").ended, r.get("r/inner").ended], [5, null, null], "a fresh inner over a = 5");
  assert.deepEqual([r.privateState("r").failures, r.privateState("r").attempt], [1, 1], "the same attempt, and no further failure counted");
  r.unsubscribe("s", "r");
});

// Fable review 2b (2026-11-10): the seed's note reaches only the seeded instance's first run, so the
// inner the retry starts runs its function on a's snapshot even when nothing changed since the capture.
test("F6, D812: an owner restored while a retry was waiting, with no input changed, runs the inner its retry starts", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const flaky = { fail: true };
  const reg = { ...restartRecipes, flaky: () => (ctx) => {
    for (const v of ctx.deps[0].waves.flat()) ctx.down([flaky.fail && v === 2 ? ["ERROR", "flaky"] : ["DATA", v]]);
  } };
  const cp = waitingOwner(reg, "flaky", 2);
  flaky.fail = false;
  const r = restore(cp, reg);
  r.subscribe("s", "r");
  assert.deepEqual([r.get("r").value, r.get("r").ended, r.get("r/inner").ended], [1, null, ["ERROR", "flaky"]]);
  t.mock.timers.tick(60_000);
  assert.deepEqual([r.get("r").value, r.get("r").ended, r.get("r/inner").ended], [2, null, null], "the inner ran on a = 2");
  r.set("a", 3);
  assert.equal(r.get("r").value, 3);
  r.unsubscribe("s", "r");
});

test("F6, D812: the restored retry makes no hopeless attempt, is dropped by another attempt, and is cleared when the lifetime closes", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const cp = waitingOwner(fwdRecipes, "fwd", "bad");
  // Counts the instances of r/inner a sink sees: one START at its subscription, one more per replace.
  const instances = (g) => { const seen = { n: 0 }; g.subscribe("t", "r/inner", (msgs) => { if (msgs[0][0] === "START") seen.n += 1; }); return seen; };
  // An upstream that ended meanwhile: no inner is started over it, and the owner ends with the inner's ERROR.
  const ended = restore(cp, fwdRecipes);
  ended.complete("a");
  ended.subscribe("s", "r");
  const hopeless = instances(ended);
  t.mock.timers.tick(60_000);
  assert.deepEqual([ended.get("r").ended, ended.get("r/inner").ended, hopeless.n], [["ERROR", "bad"], ["ERROR", "bad"], 1], "no instance was started over the ended upstream");
  // A request from outside starts another attempt, which fails in turn; the retry that was waiting
  // belongs to the earlier attempt and is dropped when its delay ends, and the new attempt's retry is made.
  const other = restore(cp, fwdRecipes);
  other.set("a", 5);
  other.subscribe("s", "r");
  const seen = instances(other);
  t.mock.timers.tick(10_000);
  restartableOf(other, "r").restart();
  assert.deepEqual([other.get("r").value, seen.n], [5, 2], "the request's fresh inner");
  other.set("a", "bad"); // it fails: a second failure, whose retry waits a minute from now
  t.mock.timers.tick(50_000); // the restored retry's delay ends here
  assert.deepEqual([seen.n, other.get("r/inner").ended], [2, ["ERROR", "bad"]], "the earlier attempt's retry starts nothing");
  other.set("a", 6);
  t.mock.timers.tick(10_000);
  assert.deepEqual([seen.n, other.get("r").value, other.privateState("r").failures], [3, 6, 2], "the new attempt's own retry is made");
  other.unsubscribe("s", "r"); other.unsubscribe("t", "r/inner");
  // Closing the lifetime clears the timer; the next activation starts a fresh inner, as at any deactivation.
  const closed = restore(cp, fwdRecipes);
  closed.set("a", 7);
  closed.subscribe("s", "r");
  closed.unsubscribe("s", "r");
  t.mock.timers.tick(60_000);
  closed.subscribe("s", "r");
  assert.deepEqual([closed.get("r").value, closed.get("r/inner").ended], [7, null]);
  closed.unsubscribe("s", "r");
});

// QA of D812 (2026-11-19). The inner is activated before the owner's setup runs, so an inner that
// fails only at the restored owner's first activation is ended there too. The owner had recorded no
// waiting retry, so that failure is the function's to count, once, and its retry waits, as in a
// graph that was never captured. The first D812 setup took "the inner is ended" for "a retry was
// waiting": it renewed the inner at once and the function counted the failure as well.
test("D812: an owner restored with a live inner, whose input fails before its first subscription, goes on as the original", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const maxAttempts of [2, 3]) {
    const g = createGraph();
    g.state("a", 1);
    restartable(g, "r", { deps: ["a"], fn: fwd(), recipe: { ref: "fwd" }, retry: retryPolicy({ maxAttempts, initialMs: 60_000 }) });
    g.subscribe("s", "r");
    assert.equal(g.privateState("r").waiting, false, "no retry is waiting at the capture");
    const r = restore(roundTrip(capture(g)), fwdRecipes);
    r.set("a", "bad");
    r.subscribe("s", "r");
    g.set("a", "bad");
    const facts = (x) => [x.get("r").value, x.get("r").ended, x.get("r/inner").ended, x.privateState("r").failures, x.privateState("r").attempt, x.privateState("r").waiting];
    assert.deepEqual(facts(r), [1, null, ["ERROR", "bad"], 1, 1, true], `maxAttempts ${maxAttempts}: one failure, and its retry waits`);
    assert.deepEqual(facts(r), facts(g));
    r.set("a", 5); g.set("a", 5);
    t.mock.timers.tick(59_999);
    assert.deepEqual(facts(r), [1, null, ["ERROR", "bad"], 1, 1, true]);
    t.mock.timers.tick(1);
    assert.deepEqual(facts(r), [5, null, null, 1, 1, false], "the retry is made after the full delay");
    assert.deepEqual(facts(r), facts(g));
    r.unsubscribe("s", "r"); g.unsubscribe("s", "r");
  }
});

// The delay that starts again is the waiting retry's own: under a backoff, the one that follows the
// failure count the owner saved, not the first delay and not the next one.
test("D812: a restored waiting retry starts the delay of the failure it follows, under a backoff", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const g = createGraph();
  g.state("a", 1);
  restartable(g, "r", { deps: ["a"], fn: fwd(), recipe: { ref: "fwd" }, retry: retryPolicy({ maxAttempts: 4, initialMs: 1_000, factor: 3 }) });
  g.subscribe("s", "r");
  g.set("a", "bad"); // the first failure: its retry waits 1 s
  t.mock.timers.tick(1_000); // the retry's fresh inner fails on "bad" again: the second failure, 3 s
  assert.deepEqual([g.privateState("r").failures, g.privateState("r").attempt, g.privateState("r").waiting], [2, 2, true]);
  const cp = roundTrip(capture(g));
  g.unsubscribe("s", "r");
  const r = restore(cp, fwdRecipes);
  r.set("a", 5);
  r.subscribe("s", "r");
  t.mock.timers.tick(2_999);
  assert.deepEqual([r.get("r").value, r.get("r/inner").ended], [1, ["ERROR", "bad"]], "past the first delay, short of the second");
  t.mock.timers.tick(1);
  assert.deepEqual([r.get("r").value, r.get("r/inner").ended], [5, null]);
  assert.deepEqual([r.privateState("r").failures, r.privateState("r").attempt, r.privateState("r").waiting], [2, 2, false]);
  // Captured now, nothing is waiting, and a restore arms no timer: an inner that fails later is retried once.
  const again = restore(roundTrip(capture(r)), fwdRecipes);
  r.unsubscribe("s", "r");
  again.subscribe("s", "r");
  again.set("a", "bad");
  assert.deepEqual([again.privateState("r").failures, again.privateState("r").attempt, again.privateState("r").waiting], [3, 3, true]);
  again.unsubscribe("s", "r");
});

// Second QA (2026-11-19). The test above captures with two failures and two attempts, so it could not
// tell the two counts apart. After a request from outside and one failure they differ: the delay
// that starts again follows the one failure (1 s), not the second attempt (3 s).
test("D812: the restored delay follows the failure count, not the attempt number", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const g = createGraph();
  g.state("a", 1);
  restartable(g, "r", { deps: ["a"], fn: fwd(), recipe: { ref: "fwd" }, retry: retryPolicy({ maxAttempts: 4, initialMs: 1_000, factor: 3 }) });
  g.subscribe("s", "r");
  restartableOf(g, "r").restart();
  g.set("a", "bad");
  assert.deepEqual([g.privateState("r").failures, g.privateState("r").attempt, g.privateState("r").waiting], [1, 2, true]);
  const cp = roundTrip(capture(g));
  g.unsubscribe("s", "r");
  const r = restore(cp, fwdRecipes);
  r.set("a", 5);
  r.subscribe("s", "r");
  t.mock.timers.tick(999);
  assert.deepEqual([r.get("r").value, r.get("r/inner").ended], [1, ["ERROR", "bad"]]);
  t.mock.timers.tick(1);
  assert.deepEqual([r.get("r").value, r.get("r/inner").ended], [5, null], "after the first delay, not the second");
  r.unsubscribe("s", "r");
});

// A restored owner that is captured again before anyone subscribes has not run its setup yet: the
// record is still in its saved private state, and the second restore waits the delay in full too.
test("D812: a waiting owner captured again before its first activation still waits its delay in full", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const first = restore(waitingOwner(fwdRecipes, "fwd", "bad"), fwdRecipes);
  const again = roundTrip(capture(first));
  assert.equal(again.nodes.find((n) => n.id === "r").saved.state.waiting, true);
  const r = restore(again, fwdRecipes);
  r.set("a", 5);
  r.subscribe("s", "r");
  t.mock.timers.tick(59_999);
  assert.deepEqual([r.get("r").value, r.get("r/inner").ended, r.privateState("r").failures], [1, ["ERROR", "bad"], 1]);
  t.mock.timers.tick(1);
  assert.deepEqual([r.get("r").value, r.get("r/inner").ended, r.privateState("r").failures], [5, null, 1]);
  r.unsubscribe("s", "r");
});

// R-restart: "a pending retry's timer is cleared". The graph behaves the same when the timer is
// left to fire into a closed lifetime, so the timers themselves are counted here, for the original
// and for the one a restored owner starts again.
test("D812: a waiting retry's timer is cleared when the owner's lifetime closes, restored or not", (t) => {
  const armed = new Set();
  let ids = 0;
  t.mock.method(globalThis, "setTimeout", () => { armed.add(++ids); return ids; });
  t.mock.method(globalThis, "clearTimeout", (id) => { armed.delete(id); });
  const g = createGraph();
  g.state("a", 1);
  restartable(g, "r", { deps: ["a"], fn: fwd(), recipe: { ref: "fwd" }, retry: retryPolicy({ maxAttempts: 3, initialMs: 60_000 }) });
  g.subscribe("s", "r");
  g.set("a", "bad");
  assert.equal(armed.size, 1, "the retry waits on one timer");
  const cp = roundTrip(capture(g));
  g.unsubscribe("s", "r");
  assert.equal(armed.size, 0, "cleared with the lifetime");
  const r = restore(cp, fwdRecipes);
  r.subscribe("s", "r");
  assert.equal(armed.size, 1, "the restored owner's setup started the delay again");
  r.unsubscribe("s", "r");
  assert.equal(armed.size, 0);
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

test("D808: a local-only node that holds what is not JSON is refused for that, not as local-only", () => {
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

// QA of D812 (2026-11-19): what a node received is checked with what it holds, so D808's order
// covers it too. n was made before b and replaced onto it, so capture meets n first.
test("D808, D812: a local-only node that received what is not JSON is refused for that, not as local-only", () => {
  const g = createGraph();
  g.node("n", [], () => {});
  g.state("b", () => 1);
  g.replace("n", ["b"], () => {});
  g.subscribe("keep", "n");
  assert.throws(() => capture(g), { message: "not restorable: n: its received values are not JSON" });
});

// D812 (4), corrected 2026-11-19 (the user's choice): the JSON refusals come first for the whole
// graph, so no capture that was refused before D812 changes its reason. Only when everything the
// graph holds is JSON is a node without a usable recipe refused, the first in creation order.
test("D812: every JSON refusal comes before a missing recipe, across nodes; then the first node without a usable recipe is named", () => {
  const refused = (build, message) => { const g = createGraph(); build(g); assert.throws(() => capture(g), { message }); };
  refused((g) => {
    g.node("A", [], () => {}); // local-only, made first
    g.node("B", [], (ctx) => ctx.down([["DATA", () => 1]]), { recipe: { ref: "b", config: null } });
    g.subscribe("s", "B");
  }, "not restorable: B: its retained values are not JSON");
  refused((g) => { g.node("A", [], () => {}); g.state("z", () => 1); }, "not restorable: z: its retained values are not JSON");
  refused((g) => { g.node("A", [], () => {}); g.node("B", [], () => {}, { recipe: { ref: "b", config: () => 1 } }); }, "not restorable: B: its recipe config is not JSON");
  refused((g) => { g.node("X", [], () => {}, { recipe: {} }); g.node("A", [], () => {}); }, "not restorable: X: missing recipe");
  refused((g) => { g.node("A", [], () => {}); g.node("X", [], () => {}, { recipe: {} }); }, "not restorable: A: local-only, built or replaced without a recipe");
});

// QA of D812 (2026-11-19). The kernel checks only that a recipe was given and never reads it
// (R-node), so anything but none passes the requirement; capture read "no recipe" as any falsy
// one, so such a node passed creation and was then called local-only. A recipe that was given but
// has no reference is refused at capture with the reason restore gives for the same record.
test("D812: a recipe given without a reference passes the requirement and is refused at capture as a missing recipe", () => {
  for (const recipe of [false, 0, "", {}, { config: 1 }, "name", [], { ref: "" }, { ref: 5 }]) {
    const g = createGraph({ requireRecipe: true });
    g.node("n", [], () => {}, { recipe });
    assert.throws(() => capture(g), { message: "not restorable: n: missing recipe" }, JSON.stringify(recipe));
    // The same through replace, which keeps what it was given as node does (second QA, 2026-11-19).
    const h = createGraph({ requireRecipe: true });
    h.node("n", [], () => {}, { recipe: { ref: "x", config: null } });
    h.replace("n", [], () => {}, { recipe });
    assert.throws(() => capture(h), { message: "not restorable: n: missing recipe" }, `replace: ${JSON.stringify(recipe)}`);
  }
});

// R-checkpoint@2 (the user, 2026-11-19): a reference is a non-empty string. A checkpoint written by
// hand with an empty one is refused at restore with the same reason, without a reference after it.
test("D812: a checkpoint whose recipe has an empty reference is refused at restore as a missing recipe", () => {
  const reg = { sum: () => (ctx) => ctx.down([["DATA", 1]]) };
  const g = createGraph();
  g.node("n", [], reg.sum(), { recipe: { ref: "sum", config: null } });
  const cp = roundTrip(capture(g));
  cp.nodes.find((n) => n.id === "n").recipe.ref = "";
  assert.throws(() => restore(cp, { ...reg, "": reg.sum }), { message: "not restorable: n: missing recipe" });
});

// R-node@3 (the user, 2026-11-19): a request that builds several nodes, as a module's, and is
// refused for one of them leaves none of them, so the same build can be asked for again. Until
// then restartable and pullable left their control state behind and the second call failed on a
// duplicate id.
test("D812: a module's build that is refused leaves none of its nodes, whatever refuses it", () => {
  const ids = (g) => g.describe().map((n) => n.id);
  const noRecipe = (id) => ({ message: `${id}: this graph requires a recipe on every computed node` });
  const required = createGraph({ requireRecipe: true });
  required.state("a", 1);
  assert.throws(() => restartable(required, "r", { deps: ["a"], fn: fwd() }), noRecipe("r/inner"));
  assert.throws(() => pullable(required, "d", "a", () => {}), noRecipe("d"));
  assert.throws(() => wireEdgeGroupIn(required, "in", { group: "ga", frames: "a", edges: ["x"] }), noRecipe("in"));
  assert.deepEqual(ids(required), ["a"]);
  restartable(required, "r", { deps: ["a"], fn: fwd(), recipe: { ref: "fwd" } });
  pullable(required, "d", "a", () => {}, { recipe: { ref: "serve" } });
  assert.deepEqual(ids(required), ["a", "r/restart", "r/inner", "r", "d/demand", "d"], "the same builds, given recipes");
  // Refused for another reason, on an ordinary graph: a dependency that does not exist, and an
  // id taken by the last node of the build.
  const g = createGraph();
  g.state("a", 1);
  assert.throws(() => restartable(g, "r", { deps: ["nowhere"], fn: fwd() }), { message: /nowhere/ });
  assert.throws(() => pullable(g, "d", "nowhere", () => {}), { message: /nowhere/ });
  assert.throws(() => pausable(g, "p", "nowhere"), { message: /nowhere/ });
  g.state("in/issues");
  assert.throws(() => wireEdgeGroupIn(g, "in", { group: "ga", frames: "a", edges: ["x"] }), { message: "duplicate node in/issues" });
  assert.deepEqual(ids(g), ["a", "in/issues"]);
  // A pausable over a control pair made beforehand does not take that pair with it.
  const control = pausableOf(g, "shared", { control: undefined });
  g.state("shared/locks", []);
  assert.throws(() => pausable(g, "q", "nowhere", { control }), { message: /nowhere/ });
  assert.deepEqual(ids(g), ["a", "in/issues", "shared/locks"]);
});

// R-bridge@3: a bridge's nodes carry no recipes; R-checkpoint@2: such a graph cannot be captured.
test("D812: a graph that holds a bridge group cannot be captured, and a graph that requires recipes cannot hold one", () => {
  const localOnly = (id) => ({ message: `not restorable: ${id}: local-only, built or replaced without a recipe` });
  const sender = createGraph();
  sender.state("A");
  wireEdgeGroupOut(sender, "ga", { group: "ga", edges: { a: "A" } });
  assert.throws(() => capture(sender), localOnly("ga"));
  const receiver = createGraph();
  frameSource(receiver, "frames", () => () => {});
  wireEdgeGroupIn(receiver, "in", { group: "ga", frames: "frames", edges: ["a"] });
  assert.throws(() => capture(receiver), localOnly("frames"));
  const required = createGraph({ requireRecipe: true });
  required.state("A");
  assert.throws(() => wireEdgeGroupOut(required, "ga", { group: "ga", edges: { a: "A" } }), { message: "ga: this graph requires a recipe on every computed node" });
  assert.throws(() => frameSource(required, "frames", () => () => {}), { message: "frames: this graph requires a recipe on every computed node" });
  assert.deepEqual(required.describe().map((n) => n.id), ["A"]);
});

// D812 (5): the recipe requirement belongs to the graph a host creates, and a checkpoint does not
// hold it. A host that restores passes it again, as the third argument, and the restored graph then
// refuses what the original refused; without it the restored graph is an ordinary one.
test("D812: a graph that requires recipes is captured and restored; the host gives the requirement to the restore", () => {
  const reg = { sum: () => (ctx) => ctx.down([["DATA", ctx.deps[0].value + 1]]) };
  const g = createGraph({ requireRecipe: true });
  g.state("a", 1);
  g.node("p", ["a"], reg.sum(), { recipe: { ref: "sum", config: null } });
  g.subscribe("s", "p");
  const cp = roundTrip(capture(g));
  const refusal = { message: "raw: this graph requires a recipe on every computed node" };
  const required = restore(cp, reg, { requireRecipe: true });
  required.subscribe("s", "p");
  assert.equal(required.get("p").value, 2);
  assert.throws(() => required.node("raw", ["a"], () => {}), refusal);
  assert.throws(() => required.replace("p", ["a"], () => {}), { message: "replace: p: this graph requires a recipe on every computed node" });
  assert.deepEqual(capture(required).nodes.map((n) => n.id), ["a", "p"], "and it is captured again");
  const ordinary = restore(cp, reg);
  ordinary.node("raw", ["a"], () => {});
  assert.throws(() => capture(ordinary), { message: "not restorable: raw: local-only, built or replaced without a recipe" });
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
  assert.throws(() => restore(cp, { bad: (_, { make }) => make("absent") }), { message: "not restorable: n: missing recipe absent" });
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

// ---- D812 (1), decided by the user 2026-11-18: pending work is state ----
// Checkpoint neither resumes nor re-issues late output in flight at capture. A node that must not
// lose its pending work records it in its private state, as JSON, and its setup opens it again.
import { latestAsync, latestAsyncNode } from "../kernel/sugar.mjs";

const turn = () => new Promise((resolve) => setImmediate(resolve));

// A graph with one latestAsync node q over a, built from a recipe; `jobs` records every job started.
function reportGraph(jobs) {
  const job = (v, signal) => new Promise((resolve) => { jobs.push({ v, signal, resolve }); });
  const reg = { report: () => latestAsyncNode(job) };
  const g = createGraph();
  g.state("a", "q1");
  const built = reg.report();
  g.node("q", ["a"], built.fn, { setup: built.setup, recipe: { ref: "report", config: null } });
  g.subscribe("s", "q");
  return { g, reg };
}

test("D812: latestAsync records its pending input as JSON, so a graph with a job in flight can be captured", async () => {
  const jobs = [];
  const { g } = reportGraph(jobs);
  await turn();
  assert.deepEqual(jobs.map((j) => j.v), ["q1"]);
  assert.deepEqual(g.privateState("q"), { pending: ["q1"] });
  const cp = roundTrip(capture(g)); // until D812 this was refused: "its private state is not JSON"
  assert.deepEqual(cp.nodes.find((n) => n.id === "q").saved.state, { pending: ["q1"] });
  jobs[0].resolve("r1");
  await turn();
  assert.deepEqual([g.get("q").value, g.privateState("q")], ["r1", { pending: [] }], "published: nothing is pending");
  g.unsubscribe("s", "q");
});

test("D812: restored while its job was pending, latestAsync starts a fresh job for the unchanged input; its function does not run", async () => {
  const jobs = [];
  const { g, reg } = reportGraph(jobs);
  await turn();
  const cp = roundTrip(capture(g));
  g.unsubscribe("s", "q");
  assert.equal(jobs[0].signal.aborted, true, "the original's job is aborted with its lifetime, and checkpoint does not resume it");
  jobs.length = 0;
  const r = restore(cp, reg);
  const seen = during(r, () => r.subscribe("s", "q"));
  assert.deepEqual(seen, ["s <- q: [START]"], "nothing is published at activation");
  await turn();
  assert.deepEqual(jobs.map((j) => [j.v, j.signal.aborted]), [["q1", false]], "one fresh job, for the same input, with the same identity to look a job up by");
  jobs[0].resolve("r1");
  await turn();
  assert.deepEqual([r.get("q").value, r.privateState("q")], ["r1", { pending: [] }]);
  // A newer input still makes the pending job obsolete.
  const again = restore(cp, reg);
  jobs.length = 0;
  again.subscribe("s", "q");
  again.set("a", "q2");
  await turn();
  assert.deepEqual(jobs.map((j) => [j.v, j.signal.aborted]), [["q1", true], ["q2", false]]);
  r.unsubscribe("s", "q"); again.unsubscribe("s", "q");
});

test("D812: restored after its result was published, latestAsync starts no job", async () => {
  const jobs = [];
  const { g, reg } = reportGraph(jobs);
  await turn();
  jobs[0].resolve("r1");
  await turn();
  const cp = roundTrip(capture(g));
  g.unsubscribe("s", "q");
  jobs.length = 0;
  const r = restore(cp, reg);
  assert.deepEqual(during(r, () => r.subscribe("s", "q")), ['s <- q: [START, DATA("r1")]']);
  await turn();
  assert.deepEqual(jobs, [], "the unchanged-input rule already gives this");
  r.unsubscribe("s", "q");
});

// QA of D812 (2026-11-19). latestAsync(f) is the function alone, without the setup that reads the
// record. It recorded the pending input all the same, so a node built with it came back from a
// checkpoint saying a job was pending, with none started and nothing to start one. It now records
// nothing, and its job in flight at a capture is lost, as the rule says of work a node did not record.
test("D812: latestAsync alone records nothing; its job in flight at a capture is lost, and the next input starts one", async () => {
  const jobs = [];
  const job = (v) => new Promise((resolve) => { jobs.push({ v, resolve }); });
  const reg = { alone: () => latestAsync(job) };
  const g = createGraph();
  g.state("a", "q1");
  g.node("q", ["a"], reg.alone(), { recipe: { ref: "alone", config: null } });
  g.subscribe("s", "q");
  await turn();
  assert.deepEqual([jobs.map((j) => j.v), g.privateState("q")], [["q1"], undefined]);
  const cp = roundTrip(capture(g));
  g.unsubscribe("s", "q");
  const r = restore(cp, reg);
  r.subscribe("s", "q");
  await turn();
  assert.deepEqual([jobs.length, r.get("q").has, r.privateState("q")], [1, false, undefined], "no job, and no record that says there is one");
  r.set("a", "q2");
  await turn();
  jobs[1].resolve("r2");
  await turn();
  assert.deepEqual([jobs.map((j) => j.v), r.get("q").value], [["q1", "q2"], "r2"]);
  r.unsubscribe("s", "q");
});

test("latestAsync: a job that fails ends the node with ERROR, its message as the payload; an obsolete job's failure is dropped", async () => {
  const jobs = [];
  const built = latestAsyncNode((v) => new Promise((resolve, reject) => { jobs.push({ v, resolve, reject }); }));
  const g = createGraph();
  g.state("a", "q1");
  g.node("q", ["a"], built.fn, { setup: built.setup });
  g.subscribe("s", "q");
  await turn();
  g.set("a", "q2"); // q1's job is obsolete
  await turn();
  jobs[0].reject(new Error("late"));
  await turn();
  assert.deepEqual([g.get("q").ended, g.privateState("q")], [null, { pending: ["q2"] }], "the obsolete failure ends nothing");
  jobs[1].reject(new Error("no report"));
  await turn();
  assert.deepEqual(g.get("q").ended, ["ERROR", "no report"]);
  g.unsubscribe("s", "q");
});
