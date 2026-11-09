import test from "node:test";
import assert from "node:assert/strict";
import { createGraph, format } from "../kernel/kernel.mjs";
import { recipes, restore } from "./checkpoint.mjs";

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

test("an ended node comes back as an ended state with its value; nothing can acquire it, as before", () => {
  const reg = { ...registry(), last: () => (ctx) => { if (ctx.deps[0].waves.length) ctx.down([["DATA", ctx.deps[0].value]]); } };
  const b = recipes(createGraph(), reg);
  b.state("a", 1);
  b.node("e", ["a"], "last"); // auto: completes with a
  b.g.subscribe("ke", "e");
  b.g.set("a", 2); b.g.error("a", "boom");
  const r = restore(roundTrip(b.capture()), reg);
  for (const id of ["a", "e"]) {
    assert.deepEqual(r.g.get(id), { active: false, has: true, value: 2, ended: ["ERROR", "boom"] });
    assert.throws(() => r.g.subscribe("k", id), /has ended/);
  }
  // The difference: without a seed the kernel cannot create an ended computed node.
  assert.deepEqual(r.g.describe().find((n) => n.id === "e"), { id: "e", kind: "state", deps: [], quiet: false });
  assert.deepEqual(roundTrip(r.capture()), roundTrip(b.capture()), "captured again, it is the same checkpoint");
});

test("P5: a node that has not ended but holds an ended dependency is refused at capture", () => {
  const b = recipes(createGraph(), registry());
  b.state("a", 1); b.state("c", 0);
  b.node("m", ["a", "c"], "sum", null, { terminal: { complete: "manual" } });
  b.g.subscribe("km", "m");
  b.g.complete("a");
  assert.throws(() => b.capture(), /m holds a, which has ended/);
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
  assert.equal(b.capture().nodes.find((n) => n.id === "a").saved.value, 4, "between waves it is allowed");
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
