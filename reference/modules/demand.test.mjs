import test from "node:test";
import assert from "node:assert/strict";
import { createGraph, format } from "../kernel/kernel.mjs";
import { pullable } from "./demand.mjs";

function during(g, body) {
  const start = g.trace.length;
  body();
  return g.trace.slice(start).map(format);
}

// A holder that reports what it saw and sends a page: the params plus every held value.
function pageHolder(g, seen) {
  return pullable(g, "h", "a", (ctx) => {
    seen.push({ waves: ctx.deps[0].waves, params: ctx.pull.params });
    ctx.down([["DATA", `${ctx.pull.params}:${ctx.deps[0].waves.flat().join(",")}`]]);
  });
}

test("quiet: input that arrives between pulls reaches no subscriber, not even DIRTY", () => {
  const g = createGraph();
  g.state("a", 0);
  const seen = [];
  pageHolder(g, seen);
  g.subscribe("s", "h");
  assert.deepEqual(during(g, () => { g.set("a", 1); g.set("a", 2); }), []);
  assert.deepEqual(seen, [], "the holder's function does not run without a pull");
});

test("a pull runs the holder once with every array held since the last INVALIDATE and the params", () => {
  const g = createGraph();
  g.state("a", 0);
  const seen = [];
  const h = pageHolder(g, seen);
  g.subscribe("s", "h");
  g.set("a", 1);
  g.batch(() => { g.set("a", 2); g.set("a", 3); });
  assert.deepEqual(during(g, () => h.pull("p1")), ['s <- h: [DIRTY, DATA("p1:0,1,2,3")]']);
  assert.deepEqual(seen, [{ waves: [[0], [1], [2, 3]], params: "p1" }], "the activation snapshot 0 is held too");
});

test("a pull with nothing new still runs the holder; staying silent sends nothing", () => {
  const g = createGraph();
  g.state("a", 0);
  let runs = 0;
  const h = pullable(g, "h", "a", (ctx) => { runs++; if (ctx.pull.params === "send") ctx.down([["DATA", "x"]]); });
  g.subscribe("s", "h");
  h.pull("send");
  assert.deepEqual(during(g, () => h.pull("quiet")), [], "silent service: nothing at all downstream");
  assert.equal(runs, 2);
});

test("a pull at an inactive holder neither activates it nor is kept for later", () => {
  const g = createGraph();
  g.state("a", 0);
  const seen = [];
  const h = pageHolder(g, seen);
  h.pull("early");
  assert.equal(g.get("h").active, false);
  assert.deepEqual(during(g, () => g.subscribe("s", "h")), ["s <- h: [START]"]);
  assert.deepEqual(seen, [], "the early request is not served on activation");
  assert.deepEqual(during(g, () => h.pull("now")), ['s <- h: [DIRTY, DATA("now:0")]']);
});

test("C-32: several pulls before one service keep only the latest params", () => {
  const g = createGraph();
  g.state("a", 0);
  const seen = [];
  const h = pageHolder(g, seen);
  g.subscribe("s", "h");
  seen.length = 0;
  g.batch(() => { h.pull("params1"); h.pull("params2"); });
  assert.deepEqual(seen.map((x) => x.params), ["params2"]);
});

test("C-32: a pull inside a batch is served after the batch commits; a throwing batch serves nothing", () => {
  const g = createGraph();
  g.state("a", 0);
  g.state("b", 0);
  const seen = [];
  const h = pageHolder(g, seen);
  g.subscribe("s", "h");
  g.subscribe("sb", "b");
  assert.deepEqual(during(g, () => g.batch(() => { g.set("b", 1); h.pull("p"); })), [
    "sb <- b: [DIRTY, DATA(1)]",                // the batch's own wave
    's <- h: [DIRTY, DATA("p:0")]',            // the service, a later wave
  ]);
  assert.throws(() => g.batch(() => { h.pull("lost"); throw new Error("rollback"); }), /rollback/);
  assert.deepEqual(seen.map((x) => x.params), ["p"]);
});

test("an INVALIDATE discards what was held before it; it passes to subscribers as a later wave", () => {
  const g = createGraph();
  g.state("a", 0);
  const seen = [];
  const h = pageHolder(g, seen);
  g.subscribe("s", "h");
  h.pull("first");
  g.set("a", 1);
  assert.deepEqual(during(g, () => g.invalidate("a")), ["s <- h: [INVALIDATE]"]);
  g.set("a", 2);
  assert.deepEqual(during(g, () => h.pull("second")), ['s <- h: [DIRTY, DATA("second:2")]']);
});

test("START: the first subscriber gets START only; a later one gets the last served value (differs from TS)", () => {
  const g = createGraph();
  g.state("a", 0);
  const h = pageHolder(g, []);
  assert.deepEqual(during(g, () => g.subscribe("s1", "h")), ["s1 <- h: [START]"]);
  h.pull("p");
  assert.deepEqual(during(g, () => g.subscribe("s2", "h")), ['s2 <- h: [START, DATA("p:0")]']);
});

test("a pull issued during a wave is served after it (K8), and the method can be called from anywhere", () => {
  const g = createGraph();
  g.state("a", 0);
  g.state("t", 0);
  const seen = [];
  const h = pageHolder(g, seen);
  g.subscribe("s", "h");
  g.subscribe("st", "t", (msgs) => { if (msgs[0][0] === "DIRTY") h.pull("from a callback"); });
  assert.deepEqual(during(g, () => g.set("t", 1)), ["st <- t: [DIRTY, DATA(1)]", 's <- h: [DIRTY, DATA("from a callback:0")]']);
});

test("closing the holder discards what it held; after reactivation it holds the input's current value", () => {
  const g = createGraph();
  g.state("a", 0);
  const seen = [];
  const h = pageHolder(g, seen);
  g.subscribe("s", "h");
  g.set("a", 1);
  g.unsubscribe("s", "h");
  g.set("a", 2);
  g.subscribe("s", "h");
  seen.length = 0;
  h.pull("p");
  assert.deepEqual(seen, [{ waves: [[2]], params: "p" }]);
});

test("the input's COMPLETE ends the holder and discards what was held", () => {
  const g = createGraph();
  g.state("a", 0);
  const seen = [];
  const h = pageHolder(g, seen);
  g.subscribe("s", "h");
  g.set("a", 1);
  assert.deepEqual(during(g, () => g.complete("a")), ["s <- h: [COMPLETE]"]);
  assert.deepEqual(during(g, () => h.pull("late")), []);
  assert.deepEqual(seen, []);
});

test("every INVALIDATE discards what was held before it, including one that finds the log without a value", () => {
  const g = createGraph();
  g.state("a", 0);
  const seen = [];
  const h = pageHolder(g, seen);
  g.subscribe("s", "h");
  h.pull("first");
  g.set("a", 1);
  g.invalidate("a"); // the log is now absent
  g.set("a", 2);
  g.invalidate("a"); // seen only because the log republished when 2 arrived
  g.set("a", 3);
  seen.length = 0;
  h.pull("p");
  assert.deepEqual(seen, [{ waves: [[3]], params: "p" }]);
});

test("a service hands over what it held; the next service sees only what came after", () => {
  const g = createGraph();
  g.state("a", 0);
  const seen = [];
  const h = pageHolder(g, seen);
  g.subscribe("s", "h");
  h.pull("p1");
  g.set("a", 1);
  h.pull("p2");
  h.pull("p3");
  assert.deepEqual(seen.map((x) => x.waves), [[[0]], [[1]], []]);
});

test("C-32: with a pausable before the holder, a resume without a pull neither runs the holder nor flushes what it holds", async () => {
  const { pausable } = await import("./pause.mjs");
  const g = createGraph();
  g.state("src", 0);
  const p = pausable(g, "a", "src"); // the holder's input is the pausable `a`
  const seen = [];
  const h = pageHolder(g, seen);
  g.subscribe("s", "h");
  const lock = p.pause();
  g.set("src", 1);
  assert.deepEqual(during(g, () => p.resume(lock)), [], "the released array is held by the holder");
  assert.deepEqual(seen, []);
  assert.deepEqual(during(g, () => h.pull("p")), ['s <- h: [DIRTY, DATA("p:0,1")]']);
});
