// Replays the pause clauses of C-30, C-31 and C-36 (spec/conformance.jsonl) against the
// pause module. REPLAY.md ("Pause module") lists every clause with its label.

import test from "node:test";
import assert from "node:assert/strict";
import { createGraph, format } from "../kernel/kernel.mjs";
import { derived } from "../kernel/sugar.mjs";
import { controlPair, isPaused, pausable } from "./pause.mjs";

function during(g, body) {
  const start = g.trace.length;
  body();
  return g.trace.slice(start).map(format);
}
const settled = () => new Promise((r) => setTimeout(r, 0));
const values = (trace) => trace.filter((x) => !x.endsWith("[DIRTY, RESOLVED]"));

test("C-30: a source paused before its first activation starts no work; its function only reads the lock", () => {
  const g = createGraph();
  const control = controlPair(g, "src");
  const started = [];
  g.node("src", [control.locksId], (ctx) => {
    if (isPaused(ctx.deps[0])) return;
    started.push("work");
    ctx.down([["DATA", "first"]]);
  });
  const lock = control.pause();
  assert.deepEqual(during(g, () => g.subscribe("s", "src")), ["s <- src: [START]"]);
  assert.deepEqual(started, [], "activation ran the function, which did no work");
  assert.deepEqual(values(during(g, () => control.resume(lock))), ['s <- src: [DIRTY, DATA("first")]']);
});

test("C-30: earlier started deferred work may still publish while paused", async () => {
  const g = createGraph();
  const control = controlPair(g, "src");
  let finish;
  g.node("src", [control.locksId], (ctx) => {
    if (isPaused(ctx.deps[0]) || finish) return;
    new Promise((r) => { finish = r; }).then((v) => ctx.down([["DATA", v]]));
  });
  g.subscribe("s", "src");
  const lock = control.pause(); // reruns the function, which starts nothing new; the lifetime stays open
  const start = g.trace.length;
  finish("late");
  await settled();
  assert.deepEqual(g.trace.slice(start).map(format), ['s <- src: [DIRTY, DATA("late")]']);
  control.resume(lock);
});

test("C-30: resumeAll lets upstream compute while paused and holds only publication", () => {
  const g = createGraph();
  g.state("a", 1);
  let runs = 0;
  g.node("x", ["a"], derived((v) => { runs++; return v * 10; }));
  const p = pausable(g, "p", "x");
  g.subscribe("s", "p");
  const lock = p.pause();
  runs = 0;
  assert.deepEqual(values(during(g, () => { g.set("a", 2); g.set("a", 3); })), []);
  assert.equal(runs, 2, "upstream computed while paused");
  assert.deepEqual(values(during(g, () => p.resume(lock))), ["s <- p: [DIRTY, DATA(20)]", "s <- p: [DIRTY, DATA(30)]"]);
  assert.equal(runs, 2, "resume reruns no consumed input");
});

test("C-30: resumeAll releases the held arrays in one wave; a re-pause from a delivery observer applies after it (Changed)", () => {
  const g = createGraph();
  g.state("a", 0);
  const p = pausable(g, "p", "a");
  let armed = false;
  let again = null;
  g.subscribe("s", "p", (msgs) => { if (armed && !again && msgs.some((m) => m[0] === "DATA")) again = p.pause("again"); });
  const first = p.pause();
  armed = true;
  g.set("a", 1);
  g.set("a", 2);
  // The draft lets the re-pause stop before the second array; here both arrays go out in
  // the resume wave, and the re-pause, a request, waits for that wave to end (K8).
  assert.deepEqual(values(during(g, () => p.resume(first))), ["s <- p: [DIRTY, DATA(1)]", "s <- p: [DIRTY, DATA(2)]"]);
  assert.equal(again, "again");
  assert.deepEqual(values(during(g, () => g.set("a", 3))), [], "the re-pause holds what comes next");
});

test("C-30: resume does not rerun invalidation hooks", () => {
  const g = createGraph();
  g.state("a", 1);
  let hooks = 0;
  g.node("x", ["a"], (ctx) => { ctx.onInvalidate(() => hooks++); ctx.down(ctx.deps[0].waves.flat().map((v) => ["DATA", v])); });
  const p = pausable(g, "p", "x");
  g.subscribe("s", "p");
  const lock = p.pause();
  g.invalidate("a");
  g.set("a", 2);
  p.resume(lock);
  assert.equal(hooks, 1);
});

test("C-31: under resumeAll the lock survives close, and a new subscription is held until resume", () => {
  const g = createGraph();
  g.state("s", 20);
  const p = pausable(g, "p", "s");
  g.subscribe("o", "p");
  const lock = p.pause();
  g.set("s", 30);
  g.unsubscribe("o", "p");
  assert.equal(g.get("s").value, 30, "the state keeps its intrinsic value across close");
  assert.deepEqual(g.get("p.pauseLocks").value, [lock], "the lock survives");
  assert.deepEqual(during(g, () => g.subscribe("o", "p")), ["o <- p: [START]"], "new admission respects the lock");
  assert.deepEqual(values(during(g, () => p.resume(lock))), ["o <- p: [DIRTY, DATA(30)]"]);
});

test("C-31: under resumeAll, DATA in the same array as a terminal is discarded and never leaks on resume", () => {
  const g = createGraph();
  const src = {};
  g.node("src", [], (ctx) => { src.ctx = ctx; ctx.down([["DATA", 20]]); });
  const p = pausable(g, "p", "src");
  g.subscribe("o", "p");
  const lock = p.pause();
  assert.deepEqual(during(g, () => src.ctx.down([["DATA", 30], ["COMPLETE"]])), ["o <- p: [COMPLETE]"]);
  assert.deepEqual(during(g, () => p.resume(lock)), []);
  assert.deepEqual(g.get("p"), { active: true, has: true, value: 20, ended: ["COMPLETE"] }, "sealed at 20");
});

test("C-36: D paused at both inputs: INVALIDATE goes through at once; one resume runs D once with the latest", () => {
  const g = createGraph();
  g.state("A", 10);
  g.state("B", "b0");
  const control = controlPair(g, "D");
  pausable(g, "D.A", "A", { control });
  pausable(g, "D.B", "B", { control });
  const runs = [];
  g.node("D", ["D.A", "D.B"], derived((a, b) => { runs.push([a, b]); return `${a}${b}`; }));
  g.subscribe("s", "D");
  runs.length = 0;
  const lock = control.pause();
  const paused = values(during(g, () => {
    g.set("A", 20); g.set("A", 20); g.set("A", 30);
    g.invalidate("A");
    g.set("A", 40);
    g.set("B", "b1");
  }));
  assert.deepEqual(paused, ["s <- D: [INVALIDATE]"], "the INVALIDATE does not wait for resume");
  assert.deepEqual(runs, [], "no new invocation while paused");
  assert.deepEqual(values(during(g, () => control.resume(lock))), ['s <- D: [DIRTY, DATA("40b1")]']);
  assert.deepEqual(runs, [[40, "b1"]], "one invocation, superseded A values gone");
});

test("C-36: a throw in the invocation after resume ends the node; consumed input is not offered again", () => {
  const g = createGraph();
  g.state("A", 1);
  const p = pausable(g, "p", "A");
  let runs = 0;
  g.node("D", ["p"], (ctx) => { if (!ctx.deps[0].waves.flat().length) return; runs++; if (runs > 1) throw new Error("boom"); });
  g.subscribe("s", "D");
  const lock = p.pause();
  g.set("A", 2);
  assert.deepEqual(values(during(g, () => p.resume(lock))), ['s <- D: [ERROR("boom")]']);
  const again = p.pause();
  p.resume(again);
  assert.equal(runs, 2);
});
