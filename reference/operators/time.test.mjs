// What the canonical traces (operators/traces.jsonl, run by traces.test.mjs) cannot say about the
// time operators, because a trace only builds well-formed graphs and reads only sinks: that each
// carries a recipe and is restored on the timers its registry is bound to, that an ms which is not
// a positive integer is refused, that what is pending is saved as JSON, that no timer is left
// running when a lifetime closes, and that without timers of its own an operator runs on the
// host's.

import test from "node:test";
import assert from "node:assert/strict";
import { createGraph } from "../kernel/kernel.mjs";
import { capture, restore } from "../modules/checkpoint.mjs";
import { createClock } from "./clock.mjs";
import { auditTime, bufferTime, debounce, delay, hostTimers, throttle, timeout, timeRecipes } from "./time.mjs";

const ALL = { debounce, throttle, auditTime, delay, bufferTime, timeout };
const data = (messages) => messages.flat().filter((m) => m[0] === "DATA").map((m) => m[1]);

test("each time operator carries a recipe with its ms, so a graph that requires recipes accepts all six, and a restore builds them on the timers its registry is bound to", () => {
  const clock = createClock();
  const g = createGraph({ requireRecipe: true });
  g.state("s", 1);
  for (const [name, build] of Object.entries(ALL)) build(g, name, "s", 100, { timers: clock.timers });
  assert.deepEqual(Object.keys(ALL).map((name) => g.definition(name).recipe), Object.keys(ALL).map((name) => ({ ref: `operators.${name}`, config: { ms: 100 } })));
  for (const name of Object.keys(ALL)) g.subscribe("k", name);
  const saved = JSON.parse(JSON.stringify(capture(g)));
  const later = createClock();
  const r = restore(saved, timeRecipes(later.timers), { requireRecipe: true });
  const got = [];
  for (const name of Object.keys(ALL)) r.subscribe("k", name, (messages) => got.push([name, ...data([messages])]));
  assert.equal(later.running, 5, "the debounce's interval, the audit window, the delayed value, the buffer window and the timeout's deadline; the throttle's interval is not kept");
  clock.advance(1000);
  later.advance(100);
  assert.deepEqual(got.filter(([, ...values]) => values.length), [["throttle", 1], ["timeout", 1], ["debounce", 1], ["auditTime", 1], ["delay", 1], ["bufferTime", [1]]]);
});

test("an ms that is not a positive integer is refused when the operator is built and when its recipe is, and no node is left behind", () => {
  for (const [name, build] of Object.entries(ALL)) {
    for (const ms of [0, 1.5, -1, NaN, Infinity, "100", null, undefined]) {
      const g = createGraph();
      g.state("s", 1);
      assert.throws(() => build(g, "x", "s", ms), /ms is a positive integer/, `${name}(${ms})`);
      assert.deepEqual(g.describe().map((node) => node.id), ["s"], `${name}(${ms}): no node is left behind`);
      assert.throws(() => timeRecipes()[`operators.${name}`]({ ms }), /ms is a positive integer/, `${name} recipe ${ms}`);
    }
    assert.throws(() => timeRecipes()[`operators.${name}`](null), /ms is a positive integer/, `${name}: a recipe without a configuration`);
  }
});

// R-checkpoint: private state must be JSON. A trace's restore step would throw on an operator that
// kept what is pending in something else, and a trace that throws shows nothing at a sink.
test("what is pending is captured as JSON: a debounce's and an auditTime's candidate, a delay's queue with its INVALIDATE and COMPLETE, a bufferTime's payloads; a throttle and a timeout keep nothing", () => {
  const clock = createClock();
  const g = createGraph();
  g.state("s");
  for (const [name, build] of Object.entries(ALL)) { build(g, name, "s", 100, { timers: clock.timers }); g.subscribe("k", name); }
  g.set("s", 1);
  g.batch(() => { g.set("s", 2); g.set("s", 3); });
  clock.advance(10);
  g.invalidate("s");
  g.batch(() => { g.set("s", 4); g.complete("s"); });
  const before = capture(g);
  assert.deepEqual(JSON.parse(JSON.stringify(before)), before);
  const state = (saved, id) => saved.nodes.find((n) => n.id === id).saved.state;
  assert.deepEqual(state(before, "delay"), { queue: [
    { invalidate: false, arrays: [[1]], complete: false },
    { invalidate: false, arrays: [[2, 3]], complete: false },
    { invalidate: true, arrays: [], complete: false },
    { invalidate: false, arrays: [[4]], complete: true },
  ] });

  const h = createGraph();
  h.state("s");
  for (const [name, build] of Object.entries(ALL)) { build(h, name, "s", 100, { timers: clock.timers }); h.subscribe("k", name); }
  h.set("s", 1);
  h.batch(() => { h.set("s", 2); h.set("s", 3); });
  const pending = capture(h);
  assert.deepEqual(JSON.parse(JSON.stringify(pending)), pending);
  assert.deepEqual(["debounce", "auditTime", "bufferTime", "throttle", "timeout"].map((id) => state(pending, id)),
    [{ candidate: [3] }, { candidate: [3] }, { items: [1, 2, 3] }, undefined, undefined]);
});

test("a lifetime's timers go with it: none runs after the operator deactivates, or after it ends with its source", () => {
  for (const [name, build] of Object.entries(ALL)) {
    for (const end of ["unsubscribe", "complete", "error"]) {
      const clock = createClock();
      const g = createGraph();
      g.state("s");
      build(g, "x", "s", 100, { timers: clock.timers });
      const got = [];
      g.subscribe("k", "x", (messages) => got.push(...messages));
      g.set("s", 1);
      clock.advance(30);
      g.set("s", 2);
      assert.ok(clock.running >= 1, `${name}: a timer runs`);
      if (end === "unsubscribe") g.unsubscribe("k", "x"); else if (end === "complete") g.complete("s"); else g.error("s", "bad");
      // a delay sends its source's COMPLETE later, and holds its timers until then
      if (!(name === "delay" && end === "complete")) assert.equal(clock.running, 0, `${name} after ${end}`);
      const seen = got.length;
      clock.advance(1000);
      assert.equal(clock.running, 0, `${name} after ${end} and a second`);
      if (!(name === "delay" && end === "complete")) assert.equal(got.length, seen, `${name}: nothing arrives after ${end}`);
    }
  }
});

test("while it is active an operator runs no more timers than it needs: one interval, window or deadline, and one for each item a delay holds", () => {
  const running = (name, values) => {
    const clock = createClock();
    const g = createGraph();
    g.state("s");
    ALL[name](g, name, "s", 100, { timers: clock.timers });
    g.subscribe("k", name);
    for (const v of values) { g.set("s", v); clock.advance(10); }
    return clock.running;
  };
  assert.deepEqual(Object.keys(ALL).map((name) => [name, running(name, [1, 2, 3])]),
    [["debounce", 1], ["throttle", 1], ["auditTime", 1], ["delay", 3], ["bufferTime", 1], ["timeout", 1]]);
});

test("without timers of its own an operator runs on the host's, and so does a registry", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const g = createGraph();
  g.state("s");
  delay(g, "x", "s", 50);
  const got = [];
  g.subscribe("k", "x", (messages) => got.push(...data([messages])));
  g.set("s", 1);
  t.mock.timers.tick(49);
  assert.deepEqual(got, []);
  t.mock.timers.tick(1);
  assert.deepEqual(got, [1]);
  g.set("s", 2);
  const r = restore(JSON.parse(JSON.stringify(capture(g))), timeRecipes());
  r.subscribe("k", "x", (messages) => got.push(...data([messages])));
  t.mock.timers.tick(50);
  assert.deepEqual(got, [1, 1, 2, 2], "the original and the restored delay, each on the host's timers; the restored sink's snapshot is the second 1");
  assert.equal(typeof hostTimers.set, "function");
});
