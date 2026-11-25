// latestAsync (async.mjs) with jobs this file settles by hand. Beside what the canonical traces
// hold, this file keeps what a trace cannot show: the recipe, what a capture holds, what f may
// return, a result that is no value, and the payloads of a failed job's ERROR.

import test from "node:test";
import assert from "node:assert/strict";
import { createGraph } from "../kernel/kernel.mjs";
import { capture, restore } from "../modules/checkpoint.mjs";
import { asyncRecipes, latestAsync } from "./async.mjs";

const flush = () => new Promise((resolve) => setImmediate(resolve));
// The jobs of one test: f(value, signal) returns a promise the test settles by the value it was
// started for; `log` holds the starts and the aborts in order.
const world = ({ throwsOn, returns = "promise" } = {}) => {
  const jobs = [], log = [];
  const f = (value, signal) => {
    if (value === throwsOn) throw new Error("boom");
    log.push(`start ${value}`);
    signal.addEventListener("abort", () => log.push(`abort ${value}`));
    if (returns === "value") return `${value}!`;
    let resolve, reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    jobs.push({ value, resolve, reject, settled: false });
    return returns === "thenable" ? { then: (a, b) => promise.then(a, b) } : promise;
  };
  const settle = async (how, value, v) => {
    const job = jobs.find((j) => j.value === value && !j.settled);
    job.settled = true;
    job[how](v);
    await flush();
  };
  return { f, log, resolve: (value, v) => settle("resolve", value, v), reject: (value, e) => settle("reject", value, e) };
};
const build = (w, initial = []) => {
  const g = createGraph();
  g.state("s", ...initial);
  latestAsync(g, "x", "s", w.f, { recipe: { ref: "job", config: null } });
  const got = [];
  g.subscribe("k", "x", (messages) => got.push(...messages.filter((m) => !["START", "PENDING", "RESOLVED"].includes(m[0]))));
  return { g, got };
};

test("only the job started last publishes, as a wave of its own; a job before it is aborted and what it resolves or fails with is ignored", async () => {
  const w = world();
  const { g, got } = build(w);
  g.set("s", 1);
  g.set("s", 2);
  assert.deepEqual(w.log, ["start 1", "abort 1", "start 2"]);
  await w.resolve(1, "one");
  assert.deepEqual(got, []);
  g.set("s", 3);
  await w.reject(2, "old");
  assert.deepEqual(got, []);
  await w.resolve(3, "three");
  assert.deepEqual(got, [["DATA", "three"]]);
  assert.deepEqual(w.log, ["start 1", "abort 1", "start 2", "abort 2", "start 3"], "a job that published is not aborted");
});

test("the current job's failure ends the operator with an ERROR: an error's message, or the value it failed with", async () => {
  for (const [reason, payload] of [[new Error("no"), "no"], ["bad", "bad"], [0, 0], [undefined, ""], [false, ""]]) {
    const w = world();
    const { g, got } = build(w);
    g.set("s", 1);
    await w.reject(1, reason);
    assert.deepEqual(got, [["ERROR", payload]], String(reason));
    assert.deepEqual(w.log, ["start 1"]);
  }
});

test("f is called in the run: a throw of f is the function's, and ends the operator in that wave; a job before it is aborted", async () => {
  const w = world({ throwsOn: 9 });
  const { g, got } = build(w);
  g.set("s", 1);
  g.set("s", 9);
  assert.deepEqual(got, [["ERROR", "boom"]], "at once, not as a later wave");
  assert.deepEqual(w.log, ["start 1", "abort 1"]);
  await w.resolve(1, "one");
  assert.deepEqual(got, [["ERROR", "boom"]]);
});

test("f may give a PromiseLike, or a value, which is the result itself and goes out as a later wave; a result that is no value ends the operator with ERROR", async () => {
  const thenable = world({ returns: "thenable" });
  const a = build(thenable);
  a.g.set("s", 1);
  await thenable.resolve(1, "one");
  assert.deepEqual(a.got, [["DATA", "one"]]);

  const plain = world({ returns: "value" });
  const b = build(plain);
  b.g.set("s", 1);
  assert.deepEqual(b.got, [], "not in the run");
  await flush();
  assert.deepEqual(b.got, [["DATA", "1!"]]);

  const nothing = world();
  const c = build(nothing);
  c.g.set("s", 1);
  await nothing.resolve(1, undefined);
  assert.equal(c.got.length, 1);
  assert.equal(c.got[0][0], "ERROR");
});

test("after the source's COMPLETE the operator waits for its job and then ends, the COMPLETE in an array of its own; with no job it ends at once", async () => {
  const w = world();
  const { g, got } = build(w);
  g.set("s", 1);
  g.complete("s");
  assert.deepEqual(got, []);
  await w.resolve(1, "one");
  assert.deepEqual(got, [["DATA", "one"], ["COMPLETE"]]);
  assert.deepEqual(g.get("x").values, ["one"]);

  const idle = world();
  const b = build(idle);
  b.g.set("s", 1);
  await idle.resolve(1, "one");
  b.g.complete("s");
  assert.deepEqual(b.got, [["DATA", "one"], ["COMPLETE"]]);

  const failing = world();
  const c = build(failing);
  c.g.set("s", 1);
  c.g.complete("s");
  await failing.reject(1, "bad");
  assert.deepEqual(c.got, [["ERROR", "bad"]]);
});

test("a source INVALIDATE retracts the output and revokes the job, whose result is then ignored; a value after it in the wave starts one job, and the source's ERROR ends the operator at once", async () => {
  const w = world();
  const { g, got } = build(w);
  g.set("s", 1);
  await w.resolve(1, "one");
  g.set("s", 2);
  g.invalidate("s");
  assert.deepEqual(got, [["DATA", "one"], ["INVALIDATE"]]);
  assert.deepEqual(w.log, ["start 1", "start 2", "abort 2"]);
  await w.resolve(2, "two");
  assert.deepEqual(got, [["DATA", "one"], ["INVALIDATE"]]);
  g.set("s", 3);
  g.batch(() => { g.set("s", 4); g.invalidate("s"); g.set("s", 5); g.set("s", 6); });
  assert.deepEqual(w.log.slice(3), ["start 3", "abort 3", "start 6"], "one job, for the last value after the INVALIDATE");
  g.error("s", "bad");
  assert.deepEqual(got.at(-1), ["ERROR", "bad"]);
  assert.deepEqual(w.log.at(-1), "abort 6");
  await w.resolve(6, "six");
  assert.deepEqual(got.at(-1), ["ERROR", "bad"]);
});

test("a lifetime's job goes with it: deactivation aborts it and forgets its input, and the next activation starts one for what the source holds", async () => {
  const w = world();
  const { g, got } = build(w);
  g.set("s", 1);
  g.unsubscribe("k", "x");
  assert.deepEqual(w.log, ["start 1", "abort 1"]);
  await w.resolve(1, "one");
  g.subscribe("k", "x", (messages) => got.push(...messages.filter((m) => m[0] === "DATA")));
  assert.deepEqual(w.log, ["start 1", "abort 1", "start 1"]);
  await w.resolve(1, "again");
  assert.deepEqual(got, [["DATA", "again"]]);
});

test("the operator carries a recipe, a capture holds the input its job is pending for as JSON, and a restored one calls f again for it with a new signal", async () => {
  const w = world();
  const { g } = build(w);
  assert.deepEqual(g.definition("x").recipe, { ref: "operators.latestAsync", config: { f: { ref: "job", config: null } } });
  g.set("s", 1);
  const saved = capture(g);
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), saved);
  assert.deepEqual(saved.nodes.find((n) => n.id === "x").saved.state, { pending: [1], sourceDone: false });
  const later = world();
  const r = restore(saved, { ...asyncRecipes, job: () => later.f });
  const got = [];
  r.subscribe("k", "x", (messages) => got.push(...messages.filter((m) => m[0] === "DATA")));
  assert.deepEqual(later.log, ["start 1"]);
  await w.resolve(1, "the captured graph's"); // a job of the graph that was captured
  assert.deepEqual(got, []);
  await later.resolve(1, "fresh");
  assert.deepEqual(got, [["DATA", "fresh"]]);
});

test("a restored operator: no job for an input whose result it had published; a new value's job alone when the source changed; none when the source was invalidated; its job and then the end when the source completed", async () => {
  const saved = async (prepare) => {
    const w = world();
    const { g } = build(w);
    await prepare(g, w);
    return JSON.parse(JSON.stringify(capture(g)));
  };
  const restored = (checkpoint, change = () => {}) => {
    const w = world();
    const r = restore(checkpoint, { ...asyncRecipes, job: () => w.f });
    change(r);
    const got = [];
    r.subscribe("k", "x", (messages) => got.push(...messages.filter((m) => !["START", "PENDING", "RESOLVED"].includes(m[0]))));
    return { w, r, got };
  };
  const published = restored(await saved(async (g, w) => { g.set("s", 1); await w.resolve(1, "one"); }));
  assert.deepEqual([published.w.log, published.got], [[], [["DATA", "one"]]]);

  const pending = await saved((g) => { g.set("s", 1); });
  const changed = restored(pending, (r) => r.set("s", 2));
  assert.deepEqual(changed.w.log, ["start 2"]);
  const invalidated = restored(pending, (r) => r.invalidate("s"));
  assert.deepEqual([invalidated.w.log, invalidated.got], [[], []]);
  const completed = restored(pending, (r) => r.complete("s"));
  assert.deepEqual(completed.w.log, ["start 1"]);
  await completed.w.resolve(1, "one");
  assert.deepEqual(completed.got, [["DATA", "one"], ["COMPLETE"]]);
  const errored = restored(pending, (r) => r.error("s", "bad"));
  assert.deepEqual([errored.w.log, errored.got], [[], [["ERROR", "bad"]]]);
});

test("an f that is not a function is refused when the operator is built, and no node is left behind", () => {
  const g = createGraph();
  g.state("s");
  assert.throws(() => latestAsync(g, "x", "s", "job"), /f is a function/);
  assert.deepEqual(g.describe().map((node) => node.id), ["s"]);
});
