// What the canonical traces (operators/traces.jsonl, run by traces.test.mjs) cannot say about
// catchError, retry and repeat, because a trace only builds well-formed graphs and reads only
// sinks: that each carries a recipe and is restored on the timers its registry is bound to, what
// is refused when one is built, what a capture holds, that a retry's timer goes with its
// lifetime, that the retry policy here is the library's, and that the restart module is built on
// the owner here.

import test from "node:test";
import assert from "node:assert/strict";
import { createGraph } from "../kernel/kernel.mjs";
import { capture, restore } from "../modules/checkpoint.mjs";
import * as library from "../modules/resilience.mjs";
import { restartable, restartableOf, restartRecipes } from "../modules/restart.mjs";
import { createClock } from "./clock.mjs";
import { catchError, hostTimers, owned, recoverPolicies, recoverRecipes, relay, repeat, retry, retryDelayMs, retryPolicy } from "./recover.mjs";

const data = (messages) => messages.flat().filter((m) => m[0] === "DATA").map((m) => m[1]);
// An inner that sends its source's values on and fails on "bad".
const fwd = () => (ctx) => {
  for (const v of ctx.deps[0].waves.flat()) ctx.down([v === "bad" ? ["ERROR", "bad"] : ["DATA", v]]);
};
const follow = (to) => () => ({ deps: [to], fn: relay, recipe: { ref: "recover.relay" } });
const registry = (timers) => ({ ...recoverRecipes(timers), fwd, follow: (config) => follow(config.to) });
const inner = () => ({ deps: ["s"], fn: fwd(), options: { recipe: { ref: "fwd" } } });

test("each recover operator carries a recipe, so a graph that requires recipes accepts all three, and a restore builds them on the timers its registry is bound to", () => {
  const clock = createClock();
  const g = createGraph({ requireRecipe: true });
  g.state("s", 1); g.state("r", "r1");
  catchError(g, "c", "s", follow("r"), { recipe: { ref: "follow", config: { to: "r" } } });
  retry(g, "t", inner(), { maxAttempts: 3, initialMs: 100 }, { timers: clock.timers });
  repeat(g, "p", inner(), 2, { timers: clock.timers });
  assert.deepEqual(g.definition("c").recipe, { ref: "recover.catchError", config: { sourceId: "s", handler: { ref: "follow", config: { to: "r" } } } });
  assert.deepEqual(g.definition("t").recipe, { ref: "restart.owner", config: { deps: ["s"], rounds: 1, retry: { maxAttempts: 3, initialMs: 100, factor: 1 } } });
  assert.deepEqual(g.definition("p").recipe, { ref: "restart.owner", config: { deps: ["s"], rounds: 2, retry: { maxAttempts: 1, initialMs: 0, factor: 1 } } });
  assert.deepEqual(["t/inner", "p/inner"].map((id) => g.definition(id).recipe), [{ ref: "fwd" }, { ref: "fwd" }]);
  for (const id of ["c", "t", "p"]) g.subscribe("k", id);
  g.set("s", "bad"); // the retry waits; catchError keeps following its source, which has not ended
  assert.equal(clock.running, 1);
  const later = createClock();
  const r = restore(JSON.parse(JSON.stringify(capture(g))), registry(later.timers), { requireRecipe: true });
  const got = { c: [], t: [], p: [] };
  for (const id of ["c", "t", "p"]) r.subscribe("k", id, (messages) => got[id].push(...messages.filter((m) => !["START", "PENDING", "RESOLVED"].includes(m[0]))));
  assert.equal(later.running, 1, "the restored retry waits again, on the restore's timers");
  r.set("s", 2);
  clock.advance(1000);
  later.advance(100);
  assert.deepEqual(got, {
    c: [["DATA", "bad"], ["DATA", 2]], // its source has not ended, and it goes on following it
    t: [["DATA", 1], ["DATA", 2]], // what it had sent, and the retry's attempt a full delay after the restore
    p: [["DATA", 1], ["ERROR", "bad"]], // a repeat without a policy had ended with its inner's ERROR
  });
});

test("an inner or a handler without a recipe gives an operator without one, which no checkpoint can save", () => {
  const g = createGraph();
  g.state("s", 1);
  g.state("r", "r1");
  catchError(g, "c", "s", follow("r"));
  assert.equal(g.definition("c").recipe ?? null, null, "a catchError whose handler came without a recipe carries none");
  retry(g, "t", { deps: ["s"], fn: fwd() }, { maxAttempts: 2 });
  assert.equal(g.definition("t").recipe ?? null, null);
  g.subscribe("k", "t");
  assert.throws(() => capture(g), /not restorable/);
});

test("a repeat's rounds that are not a positive integer, and a policy the library refuses, are refused when the operator is built, and no node is left behind", () => {
  for (const rounds of [0, 1.5, -1, NaN, Infinity, "2", null, undefined]) {
    const g = createGraph();
    g.state("s", 1);
    assert.throws(() => repeat(g, "x", inner(), rounds), /rounds is a positive integer/, String(rounds));
    assert.deepEqual(g.describe().map((node) => node.id), ["s"], `repeat(${rounds}): no node is left behind`);
  }
  for (const policy of [{ maxAttempts: 0 }, { maxAttempts: 1.5 }, { initialMs: -1 }, { initialMs: Infinity }, { factor: 0.5 }, { factor: NaN }, { maxMs: -1 }]) {
    for (const build of [(g) => retry(g, "x", inner(), policy), (g) => repeat(g, "x", inner(), 2, { retry: policy })]) {
      const g = createGraph();
      g.state("s", 1);
      assert.throws(() => build(g), /retryPolicy: /, JSON.stringify(policy));
      assert.deepEqual(g.describe().map((node) => node.id), ["s"], `${JSON.stringify(policy)}: no node is left behind`);
    }
  }
});

test("the retry policy here is the library's: the same policies, refusals and delays", () => {
  const policies = [{}, { maxAttempts: 4 }, { maxAttempts: 5, initialMs: 100 }, { maxAttempts: 5, initialMs: 100, factor: 2 }, { maxAttempts: 6, initialMs: 10, factor: 1.5, maxMs: 30 }, { maxAttempts: 3, initialMs: 0, factor: 3, maxMs: 0 }];
  for (const given of policies) {
    assert.deepEqual(retryPolicy(given), library.retryPolicy(given), JSON.stringify(given));
    for (const failed of [0, 1, 2, 3, 4, 5, 6, 1.5]) assert.equal(retryDelayMs(retryPolicy(given), failed), library.retryDelayMs(library.retryPolicy(given), failed), `${JSON.stringify(given)} after ${failed}`);
  }
  for (const bad of [{ maxAttempts: 0 }, { initialMs: -1 }, { factor: 0.5 }, { maxMs: -1 }]) {
    assert.throws(() => retryPolicy(bad), RangeError);
    assert.throws(() => library.retryPolicy(bad), RangeError);
  }
});

// R-checkpoint: private state must be JSON, and a node whose lifetime dependencies a rewire
// changed is saved with them.
test("a capture holds an owner's round, failures and waiting retry as JSON, and a switched catchError's selection with its replacement's recipe", () => {
  const clock = createClock();
  const g = createGraph();
  g.state("s", 1); g.state("e"); g.state("r", "r1");
  repeat(g, "p", inner(), 3, { retry: { maxAttempts: 2, initialMs: 100 }, timers: clock.timers });
  catchError(g, "c", "e", follow("r"), { recipe: { ref: "follow", config: { to: "r" } } });
  g.subscribe("k", "p"); g.subscribe("k", "c");
  g.set("s", "bad");
  g.error("e", "e1");
  const saved = capture(g);
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), saved);
  const node = (id) => saved.nodes.find((n) => n.id === id);
  assert.deepEqual(node("p").saved.state, { round: 1, failures: 1, attempt: 1, waiting: true, seen: 0 });
  assert.deepEqual(node("c").saved.state, { switched: true });
  assert.deepEqual(node("c/inner").recipe, { ref: "recover.relay" });
  assert.deepEqual(g.describe().find((n) => n.id === "c").deps, ["c/inner"], "a switched catchError depends on its replacement alone");
});

// A trace's restore step would throw on a replacement without its recipe, and a trace that throws
// shows nothing at a sink.
test("a replacement that is placed again after a deactivation keeps its recipe, and an inner that an owner started again keeps its own", () => {
  const g = createGraph();
  g.state("e"); g.state("r", "r1"); g.state("s", 1);
  catchError(g, "c", "e", follow("r"), { recipe: { ref: "follow", config: { to: "r" } } });
  retry(g, "t", inner(), { maxAttempts: 3 });
  g.subscribe("k", "c"); g.subscribe("k", "t");
  g.error("e", "e1");
  g.unsubscribe("k", "c");
  g.subscribe("k", "c"); // the handler is called again, and its replacement replaces the first
  g.set("s", "bad"); // two attempts follow at once, each a new instance of the inner
  assert.deepEqual(["c/inner", "t/inner"].map((id) => g.definition(id).recipe), [{ ref: "recover.relay" }, { ref: "fwd" }]);
  const saved = capture(g);
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), saved);
});

test("a waiting retry's timer goes with its lifetime: none runs after the owner deactivates or ends, and none while no retry waits", () => {
  for (const end of ["unsubscribe", "error"]) {
    const clock = createClock();
    const g = createGraph();
    g.state("s", 1);
    retry(g, "t", inner(), { maxAttempts: 3, initialMs: 100 }, { timers: clock.timers });
    const got = [];
    g.subscribe("k", "t", (messages) => got.push(...messages));
    assert.equal(clock.running, 0);
    g.set("s", "bad");
    assert.equal(clock.running, 1);
    if (end === "unsubscribe") g.unsubscribe("k", "t"); else g.error("s", "gone");
    const seen = got.length;
    clock.advance(1000);
    if (end === "unsubscribe") assert.equal(got.length, seen, "nothing arrives after the unsubscribe");
    assert.equal(clock.running, 0, `after ${end}`);
  }
});

test("without timers of its own an owner waits on the host's, and so does a registry", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const g = createGraph();
  g.state("s", 1);
  retry(g, "t", inner(), { maxAttempts: 2, initialMs: 50 });
  const got = [];
  g.subscribe("k", "t", (messages) => got.push(...data([messages])));
  g.set("s", "bad");
  g.set("s", 2);
  t.mock.timers.tick(49);
  assert.deepEqual(got, [1]);
  t.mock.timers.tick(1);
  assert.deepEqual(got, [1, 2]);
  g.set("s", "bad"); // no attempt is left
  assert.equal(g.get("t").ended?.[0], "ERROR");
  assert.equal(typeof hostTimers.set, "function");
  assert.equal(typeof recoverRecipes()["restart.owner"], "function");
});

test("the restart module's restartable is the owner here under the same recipe, with the handle of an outside request", () => {
  const g = createGraph();
  g.state("s", 1);
  const handle = restartable(g, "m", { deps: ["s"], fn: fwd(), recipe: { ref: "fwd" }, rounds: 2 });
  owned(g, "o", inner(), { rounds: 2 });
  const { fn: mfn, setup: msetup, ...m } = g.definition("m");
  const { fn: ofn, setup: osetup, ...o } = g.definition("o");
  assert.deepEqual({ ...m, deps: m.deps.map((d) => d.replace(/^m\//, "o/")) }, o, "the same definition but for its id");
  assert.equal(typeof mfn, "function"); assert.equal(typeof msetup, "function"); assert.equal(typeof ofn, "function"); assert.equal(typeof osetup, "function");
  assert.deepEqual(m.recipe, { ref: "restart.owner", config: { deps: ["s"], rounds: 2, retry: { maxAttempts: 1, initialMs: 0, factor: 1 } } });
  assert.equal(typeof restartRecipes["restart.owner"], "function");
  assert.deepEqual(recoverPolicies, { terminal: { complete: "manual", error: "manual" }, invalidate: "manual" });
  const got = [];
  g.subscribe("k", "m", (messages) => got.push(...data([messages])));
  handle.restart();
  assert.deepEqual(got, [1, 1], "a request starts a new attempt, which sends what the source holds again");
  // An INVALIDATE of the restart state is no request, retracts nothing, and the next request is served.
  g.invalidate("m/restart");
  assert.deepEqual([got, g.get("m").value], [[1, 1], 1]);
  restartableOf(g, "m").restart();
  assert.deepEqual(got, [1, 1, 1]);
});
