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
  assert.deepEqual(during(r.g, () => r.g.set("b", 10)), ["ks <- s: [PENDING, DATA(13)]", "kt <- t: [PENDING, DATA(16)]"],
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
  assert.deepEqual(during(r.g, () => r.g.set("a", 4)), ["ku <- u: [PENDING, DATA(116)]"]); // q 106, t 6 + 4
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
  assert.deepEqual(during(r.g, () => r.g.set("input", 5)), ["k <- s: [PENDING, DATA(6)]"]);
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

// Adds to a registry a recipe `grab` that sums as `sum` does and keeps the ctx of its last run,
// so a test can rewire the node through it (F7: a node rewires itself through ctx.rewire).
function grabbing(reg, as = "sum") {
  const seen = { ctx: null };
  return { seen, reg: { ...reg, grab: (config) => { const fn = reg[as](config); return (ctx) => { seen.ctx = ctx; fn(ctx); }; } } };
}

test("a node without a recipe is local-only and cannot be restored", () => {
  const reg = registry();
  const b = recipes(createGraph(), reg);
  b.state("a", 1);
  b.node("s", ["a"], "sum");
  b.g.node("raw", ["a"], (ctx) => ctx.down([["DATA", 0]]));
  const cp = b.capture();
  assert.deepEqual(cp.nodes.filter((n) => n.local).map((n) => n.id), ["raw"]);
  assert.throws(() => restore(cp, reg), /raw is local-only/);
});

// F6 (the user's choice, 2026-11-10): a rewire belongs to the lifetime (F7), so it is saved with the
// lifetime's state and gives the restored node's first lifetime its dependencies back.
test("a node rewired for its lifetime is saved with those dependencies and restored onto them", () => {
  const { seen, reg } = grabbing(registry());
  const b = recipes(createGraph(), reg);
  b.state("a", 1); b.state("b", 2);
  b.node("s", ["a"], "grab");
  b.g.subscribe("k", "s");
  seen.ctx.rewire(["a", "b"]);
  assert.equal(b.g.get("s").value, 3);
  const cp = roundTrip(b.capture());
  const entry = cp.nodes.find((n) => n.id === "s");
  assert.deepEqual([entry.local, entry.deps, entry.saved.deps], [undefined, ["a"], ["a", "b"]], "declared deps, then the lifetime's");
  const r = restore(cp, reg);
  assert.deepEqual(r.g.definition("s").deps, ["a"]);
  assert.deepEqual(during(r.g, () => r.g.subscribe("k", "s")), ["k <- s: [START, DATA(3)]"], "no run: nothing changed");
  assert.deepEqual(r.g.describe().find((d) => d.id === "s").deps, ["a", "b"], "the first lifetime is on the saved dependencies");
  r.g.set("b", 5);
  assert.equal(r.g.get("s").value, 6, "b still drives s");
  r.g.unsubscribe("k", "s");
  assert.deepEqual(r.g.describe().find((d) => d.id === "s").deps, ["a"], "closing it puts back the declared ones");
});

// C6 (Codex review; decided by the user 2026-11-10): the definition is the dependencies and the function.
// Since F7 only replace can change the function; a rewire changes the dependencies only.
test("a replace that keeps the dependencies but changes the function makes the node local-only", () => {
  const reg = { times: ({ k }) => (ctx) => { if (ctx.deps[0].has) ctx.down([["DATA", ctx.deps[0].value * k]]); } };
  const times3 = (ctx) => { if (ctx.deps[0].has) ctx.down([["DATA", ctx.deps[0].value * 3]]); };
  const b = recipes(createGraph(), reg);
  b.state("a", 1); b.node("p", ["a"], "times", { k: 2 }); b.node("q", ["a"], "times", { k: 2 });
  b.g.subscribe("s", "p");
  b.g.replace("p", ["a"], times3);
  const cp = roundTrip(b.capture());
  assert.deepEqual(cp.nodes.filter((n) => n.local).map((n) => n.id), ["p"], "q keeps its recipe's definition");
  assert.throws(() => restore(cp, reg), /p is local-only/, "restoring it as the old recipe would give 4 where the original gives 6");
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

// ---- F6 (the user's choice, 2026-11-10): every module's graph can be captured and restored ----
import { pausable, pausableOf, pauseRecipes } from "./pause.mjs";
import { pullable, pullableOf, demandRecipes } from "./demand.mjs";

// After capture, the same steps on the original and on its restore send the same arrays.
const after = (g, sinkId, body) => { const start = g.trace.length; body(); return g.trace.slice(start).filter((e) => e.to === sinkId).map(format); };

test("F6: a paused pausable is restored with its locks and held arrays, and the resume sends them as the original's does", () => {
  const b = recipes(createGraph(), pauseRecipes);
  b.state("a", 1);
  const p = pausable(b, "p", "a");
  b.g.subscribe("s", "p");
  p.pause("L");
  b.g.set("a", 2); b.g.set("a", 3);
  const cp = roundTrip(b.capture());
  assert.deepEqual(cp.nodes.filter((n) => n.local), []);
  const r = restore(cp, pauseRecipes);
  const rp = pausableOf(r, "p");
  assert.deepEqual(r.g.get(rp.locksId).value, ["L"]);
  r.g.subscribe("s", "p");
  const resumed = (g, handle) => after(g, "s", () => handle.resume("L"));
  const restored = resumed(r.g, rp);
  assert.deepEqual(restored, resumed(b.g, p));
  assert.deepEqual(restored, ["s <- p: [PENDING, DATA(2)]", "s <- p: [PENDING, DATA(3)]"], "both held arrays, as they arrived");
  assert.deepEqual(resumed(r.g, rp), [], "a second resume changes nothing");
  assert.deepEqual(after(r.g, "s", () => r.g.set("a", 4)), after(b.g, "s", () => b.g.set("a", 4)));
});

test("F6: a demand holder is restored with its queue and request number, and the next pull is served as the original's", () => {
  const reg = { ...demandRecipes, page: () => (ctx) => ctx.down([["DATA", `${ctx.pull.params}:${ctx.deps[0].waves.flat().join(",")}`]]) };
  const b = recipes(createGraph(), reg);
  b.state("a", 0);
  const h = pullable(b, "h", "a", "page");
  b.g.subscribe("s", "h");
  b.g.set("a", 1); h.pull("p1");
  b.g.set("a", 2); b.g.set("a", 3);
  const cp = roundTrip(b.capture());
  assert.deepEqual(cp.nodes.filter((n) => n.local), []);
  const r = restore(cp, reg);
  const rh = pullableOf(r, "h");
  assert.deepEqual(during(r.g, () => r.g.subscribe("s", "h")), ['s <- h: [START, DATA("p1:0,1")]'], "no run, nothing old served");
  const served = after(r.g, "s", () => rh.pull("p2"));
  assert.deepEqual(served, after(b.g, "s", () => h.pull("p2")));
  assert.deepEqual(served, ['s <- h: [PENDING, DATA("p2:2,3")]']);
  assert.deepEqual(r.g.get(rh.demandId).value, b.g.get(h.demandId).value, "the request numbers go on");
});

import { restartable, restartableOf, restartRecipes } from "./restart.mjs";
import { retryPolicy } from "./resilience.mjs";

// The inner forwards a's values and fails on "bad".
const fwdRecipes = { fwd: () => (ctx) => {
  for (const v of ctx.deps[0].waves.flat()) ctx.down([v === "bad" ? ["ERROR", "bad"] : ["DATA", v]]);
} };

test("F6: a restart owner is restored with its round, request number and live inner, and goes on as the original", () => {
  const reg = { ...restartRecipes, ...fwdRecipes };
  const b = recipes(createGraph(), reg);
  b.state("a", 1);
  const r0 = restartable(b, "r", { deps: ["a"], inner: { ref: "fwd" }, rounds: 2 });
  b.g.subscribe("s", "r");
  b.g.set("a", 2);
  r0.restart(); // the inner was replaced with its own definition: still restorable
  b.g.set("a", 3);
  const cp = roundTrip(b.capture());
  assert.deepEqual(cp.nodes.filter((n) => n.local), []);
  const r = restore(cp, reg);
  const r1 = restartableOf(r, "r");
  r.g.subscribe("s", "r");
  assert.deepEqual(r.g.get("r").value, 3);
  assert.deepEqual(after(r.g, "s", () => r1.restart()), after(b.g, "s", () => r0.restart()));
  assert.deepEqual(r.g.get("r.restart").value, 2, "the request numbers go on");
  assert.deepEqual(after(r.g, "s", () => r.g.set("a", 4)), after(b.g, "s", () => b.g.set("a", 4)));
});

test("F6: an owner restored while a retry was waiting is not stuck: as at a deactivation, its inner is renewed", () => {
  const reg = { ...restartRecipes, ...fwdRecipes };
  const b = recipes(createGraph(), reg);
  b.state("a", 1);
  restartable(b, "r", { deps: ["a"], inner: { ref: "fwd" }, retry: retryPolicy({ maxAttempts: 3, initialMs: 60_000 }) });
  b.g.subscribe("s", "r");
  b.g.set("a", "bad"); // the inner fails; a retry waits for a minute
  assert.equal(b.g.get("r/inner").ended?.[0], "ERROR");
  const cp = roundTrip(b.capture());
  b.g.unsubscribe("s", "r"); // drops the original's timer
  const r = restore(cp, reg);
  r.g.set("a", 5);
  r.g.subscribe("s", "r");
  assert.deepEqual(r.g.get("r").value, 5, "a fresh inner over a = 5, without waiting for the lost timer");
  assert.equal(r.g.get("r").ended, null);
  assert.deepEqual(r.g.privateState("r").failures, 1, "the failure counted before capture still counts");
});

import { higherOrderRecipes, mergeMap, switchMap } from "./higher-order.mjs";

// The projector follows the node a source value names.
const hoRecipes = { ...higherOrderRecipes, follow: () => (v) => ({ deps: [v], ref: "higher.relay" }) };

test("F6: a switchMap is restored with its live inner and its rewired dependencies, and switches as the original", () => {
  const b = recipes(createGraph(), hoRecipes);
  b.state("x", 1); b.state("y", 10); b.state("s", "x");
  switchMap(b, "sw", "s", "follow");
  b.g.subscribe("k", "sw");
  b.g.set("x", 2);
  const cp = roundTrip(b.capture());
  assert.deepEqual(cp.nodes.filter((n) => n.local), []);
  assert.deepEqual(cp.nodes.find((n) => n.id === "sw").saved.deps, ["s", "sw/inner/0"]);
  const r = restore(cp, hoRecipes);
  r.g.subscribe("k", "sw");
  assert.equal(r.g.get("sw").value, 2);
  for (const step of [(g) => g.set("x", 3), (g) => g.set("s", "y"), (g) => g.set("x", 4), (g) => g.set("y", 11)]) {
    assert.deepEqual(after(r.g, "k", () => step(r.g)), after(b.g, "k", () => step(b.g)));
  }
  assert.equal(r.g.get("sw").value, 11);
  // The switch replaced sw/inner/0 with a recipe through the bundle, so it is restorable again.
  const cp2 = roundTrip(r.capture());
  assert.deepEqual(cp2.nodes.filter((n) => n.local), []);
  assert.deepEqual(cp2.nodes.find((n) => n.id === "sw/inner/0").deps, ["y"]);
  const r2 = restore(cp2, hoRecipes);
  r2.g.subscribe("k", "sw");
  assert.deepEqual(after(r2.g, "k", () => r2.g.set("y", 12)), after(r.g, "k", () => r.g.set("y", 12)));
});

test("F6: a mergeMap is restored with a value waiting for a free slot, and projects it when the live inner completes", () => {
  const b = recipes(createGraph(), hoRecipes);
  b.state("x", 1); b.state("y", 10); b.state("s", "x");
  mergeMap(b, "mm", "s", "follow", { concurrent: 1 });
  b.g.subscribe("k", "mm");
  b.g.set("s", "y"); // waits: one inner is live
  const cp = roundTrip(b.capture());
  assert.deepEqual(cp.nodes.filter((n) => n.local), []);
  assert.deepEqual(cp.nodes.find((n) => n.id === "mm").saved.state.queue, ["y"]);
  const r = restore(cp, hoRecipes);
  r.g.subscribe("k", "mm");
  for (const step of [(g) => g.set("x", 2), (g) => g.complete("x"), (g) => g.set("y", 12)]) {
    assert.deepEqual(after(r.g, "k", () => step(r.g)), after(b.g, "k", () => step(b.g)));
  }
  assert.equal(r.g.get("mm").value, 12, "y was projected once x's inner completed");
});
