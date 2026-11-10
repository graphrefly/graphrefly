import test from "node:test";
import assert from "node:assert/strict";
import { createGraph, format } from "../kernel/kernel.mjs";
import { controlPair, isPaused, pausable } from "./pause.mjs";

function during(g, body) {
  const start = g.trace.length;
  body();
  return g.trace.slice(start).map(format);
}

test("nothing is forwarded while paused; the final resume sends every held array in one wave", () => {
  const g = createGraph();
  g.state("a", 0);
  const p = pausable(g, "p", "a");
  g.subscribe("s", "p");
  const lock = p.pause();
  const out = during(g, () => {
    g.set("a", 1);
    g.set("a", 2);
    p.resume(lock);
  });
  assert.deepEqual(out, [
    "s <- p: [DIRTY, RESOLVED]",
    "s <- p: [DIRTY, RESOLVED]",
    "s <- p: [DIRTY, DATA(1)]",
    "s <- p: [DIRTY, DATA(2)]",
  ]);
});

test("every pause and resume is a wave that reaches downstream as DIRTY then RESOLVED", () => {
  const g = createGraph();
  g.state("a", 0);
  const p = pausable(g, "p", "a");
  g.subscribe("s", "p");
  assert.deepEqual(during(g, () => { const l = p.pause(); p.resume(l); }), [
    "s <- p: [DIRTY, RESOLVED]",
    "s <- p: [DIRTY, RESOLVED]",
  ]);
});

test("locks compose: only the last release opens; acquiring and releasing are idempotent by identity", () => {
  const g = createGraph();
  g.state("a", 0);
  const p = pausable(g, "p", "a");
  g.subscribe("s", "p");
  p.pause("ui");
  p.pause("ui");
  p.pause("sync");
  assert.deepEqual(g.get("p.pauseLocks").value, ["ui", "sync"], "pause state is readable as plain state");
  g.set("a", 1);
  assert.deepEqual(during(g, () => p.resume("nobody")), [], "releasing a lock nobody holds is no wave at all");
  p.resume("ui");
  assert.deepEqual(during(g, () => g.set("a", 2)), ["s <- p: [DIRTY, RESOLVED]"], "still held by sync");
  assert.deepEqual(during(g, () => p.resume("sync")), ["s <- p: [DIRTY, DATA(1)]", "s <- p: [DIRTY, DATA(2)]"]);
});

test("pause is directed: pausing p2 leaves p1 and p3 flowing", () => {
  const g = createGraph();
  g.state("a", 0);
  const ps = [1, 2, 3].map((i) => pausable(g, `p${i}`, "a"));
  for (const p of ps) g.subscribe(`s${p.id}`, p.id);
  ps[1].pause();
  assert.deepEqual(during(g, () => g.set("a", 5)), [
    "sp1 <- p1: [DIRTY, DATA(5)]",
    "sp2 <- p2: [DIRTY, RESOLVED]",
    "sp3 <- p3: [DIRTY, DATA(5)]",
  ]);
});

test("a pause issued during a wave applies at the wave boundary", () => {
  const g = createGraph();
  g.state("a", 0);
  const p = pausable(g, "p", "a");
  g.subscribe("s1", "p", (msgs) => { if (msgs.some((m) => m[0] === "DATA" && m[1] === 1)) p.pause("late"); });
  g.subscribe("s2", "p");
  assert.deepEqual(during(g, () => g.set("a", 1)), [
    "s1 <- p: [DIRTY, DATA(1)]",
    "s2 <- p: [DIRTY, DATA(1)]",      // the wave finishes unpaused
    "s1 <- p: [DIRTY, RESOLVED]",     // then the pause applies as its own wave
    "s2 <- p: [DIRTY, RESOLVED]",
  ]);
  assert.deepEqual(during(g, () => g.set("a", 2)), ["s1 <- p: [DIRTY, RESOLVED]", "s2 <- p: [DIRTY, RESOLVED]"]);
});

test("paused before activation: the first subscription gets no value until resume", () => {
  const g = createGraph();
  g.state("a", 7);
  const p = pausable(g, "p", "a");
  const lock = p.pause(); // the pausable is not active yet; pausing does not activate it
  assert.equal(g.get("p").active, false);
  assert.deepEqual(during(g, () => g.subscribe("s", "p")), ["s <- p: [START]"]);
  assert.deepEqual(during(g, () => p.resume(lock)), ["s <- p: [DIRTY, DATA(7)]"]);
});

test("locks survive the pausable's close; a new subscription is still paused", () => {
  const g = createGraph();
  g.state("a", 1);
  const p = pausable(g, "p", "a");
  g.subscribe("s", "p");
  const lock = p.pause();
  g.unsubscribe("s", "p");
  g.set("a", 2);
  assert.deepEqual(during(g, () => g.subscribe("s", "p")), ["s <- p: [START]"]);
  assert.deepEqual(during(g, () => p.resume(lock)), ["s <- p: [DIRTY, DATA(2)]"]);
});

test("a terminal passes while paused and discards what was held", () => {
  const g = createGraph();
  g.state("a", 0);
  const p = pausable(g, "p", "a");
  g.subscribe("s", "p");
  p.pause();
  g.set("a", 5);
  assert.deepEqual(during(g, () => g.complete("a")), ["s <- p: [COMPLETE]"]);
});

test("unpaused, an array with DATA and a terminal passes unchanged; paused, only the terminal passes", () => {
  for (const [end, shown] of [[(g) => g.complete("a"), "COMPLETE"], [(g) => g.error("a", "boom"), "ERROR(\"boom\")"]]) {
    const g = createGraph();
    g.state("a", 0);
    g.subscribe("s", pausable(g, "p", "a").id);
    assert.deepEqual(during(g, () => g.batch(() => { g.set("a", 5); end(g); })), [`s <- p: [DIRTY, DATA(5), ${shown}]`]);
    const h = createGraph();
    h.state("a", 0);
    const q = pausable(h, "p", "a");
    h.subscribe("s", "p");
    q.pause();
    assert.deepEqual(during(h, () => h.batch(() => { h.set("a", 5); end(h); })), [`s <- p: [${shown}]`]);
  }
});

test("an INVALIDATE while paused passes at once, and the resume then has nothing to send", () => {
  const g = createGraph();
  g.state("a", 1);
  const p = pausable(g, "p", "a");
  g.subscribe("s", "p");
  const lock = p.pause();
  g.set("a", 2);
  assert.deepEqual(during(g, () => g.invalidate("a")), ["s <- p: [INVALIDATE]"]);
  assert.deepEqual(during(g, () => p.resume(lock)), ["s <- p: [DIRTY, RESOLVED]"]);
  p.pause("again");
  g.set("a", 3);
  assert.deepEqual(during(g, () => p.resume("again")), ["s <- p: [DIRTY, DATA(3)]"], "DATA after the INVALIDATE is sent");
});

test("every array that arrives while paused goes out on resume, in order, each as it arrived", () => {
  const g = createGraph();
  g.state("a", 0);
  const p = pausable(g, "p", "a");
  g.subscribe("s", "p");
  const lock = p.pause();
  g.set("a", 1);
  g.batch(() => { g.set("a", 2); g.set("a", 2); });
  assert.deepEqual(during(g, () => p.resume(lock)), ["s <- p: [DIRTY, DATA(1)]", "s <- p: [DIRTY, DATA(2), DATA(2)]"]);
});

test("an INVALIDATE that reaches downstream discards what was held before it", () => {
  const g = createGraph();
  g.state("a", 0);
  const p = pausable(g, "p", "a");
  g.subscribe("s", "p");
  const lock = p.pause();
  g.set("a", 1);
  const out = during(g, () => {
    g.invalidate("a");
    g.set("a", 2);
    p.resume(lock);
  });
  // The INVALIDATE goes out at once (the kernel runs no function for it); DATA(1)
  // is older than it and is dropped, so downstream never gets a value older than an
  // INVALIDATE it already has.
  assert.deepEqual(out, [
    "s <- p: [INVALIDATE]",
    "s <- p: [DIRTY, RESOLVED]",
    "s <- p: [DIRTY, DATA(2)]",
  ]);
});

test("every INVALIDATE discards what was held before it, including one downstream never sees", () => {
  const g = createGraph();
  g.state("a", 0);
  const p = pausable(g, "p", "a");
  g.subscribe("s", "p");
  const lock = p.pause();
  g.set("a", 1);
  g.invalidate("a"); // reaches downstream at once; DATA(1) is dropped; p is now absent
  g.set("a", 2);
  const out = during(g, () => {
    g.invalidate("a"); // p has no value, so nothing goes out, but DATA(2) is dropped all the same
    g.set("a", 3);
    p.resume(lock);
  });
  assert.deepEqual(out, [
    "s <- p: [DIRTY, RESOLVED]",          // the DATA(3) wave
    "s <- p: [DIRTY, DATA(3)]",
  ]);
});

test("the held values live in a node named after the pausable, readable while paused", () => {
  const g = createGraph();
  g.state("a", 0);
  const p = pausable(g, "p", "a");
  g.subscribe("s", "p");
  const lock = p.pause();
  g.set("a", 1);
  g.set("a", 2);
  assert.deepEqual(g.get("p.pauseLog").value, [[1], [2]]);
  g.invalidate("a");
  assert.equal(g.get("p.pauseLog").has, false);
  p.resume(lock);
  assert.equal(g.get("p").has, false, "downstream ends absent, like upstream");
});

test("a source that must stop working declares the control dependency and stops in its own function", () => {
  const g = createGraph();
  const control = controlPair(g, "ticker");
  const log = [];
  const ticker = {};
  g.node("ticker", [control.locksId], (ctx) => {
    const running = !isPaused(ctx.deps[0]);
    log.push(running ? "start" : "stop");
    ticker.tick = running ? (n) => ctx.down([["DATA", n]]) : () => {};
  });
  g.subscribe("s", "ticker");
  const out = during(g, () => {
    ticker.tick(1);
    const lock = control.pause();
    ticker.tick(2);
    control.resume(lock);
    ticker.tick(3);
  });
  assert.deepEqual(log, ["start", "stop", "start"]);
  assert.deepEqual(out, [
    "s <- ticker: [DIRTY, DATA(1)]",
    "s <- ticker: [DIRTY, RESOLVED]", // the pause wave
    "s <- ticker: [DIRTY, RESOLVED]", // the resume wave; tick(2) while stopped sent nothing
    "s <- ticker: [DIRTY, DATA(3)]",
  ]);
});

test("several pauses issued inside one wave keep every lock", () => {
  const g = createGraph();
  g.state("a", 0);
  g.state("t", 0);
  const p = pausable(g, "p", "a");
  g.subscribe("s", "p");
  g.subscribe("st", "t", (msgs) => {
    if (msgs[0][0] !== "DIRTY") return;
    p.pause("x");
    p.pause("y");
  });
  g.set("t", 1);
  assert.deepEqual(g.get("p.pauseLocks").value, ["x", "y"]);
  p.resume("x");
  assert.deepEqual(during(g, () => g.set("a", 1)), ["s <- p: [DIRTY, RESOLVED]"], "y still holds");
});

test("values held before an INVALIDATE that nothing followed are dropped on resume", () => {
  const g = createGraph();
  g.state("a", 0);
  const p = pausable(g, "p", "a");
  g.subscribe("s", "p");
  const lock = p.pause();
  g.set("a", 1);
  const out = during(g, () => {
    g.invalidate("a");
    p.resume(lock);
  });
  assert.deepEqual(out, ["s <- p: [INVALIDATE]", "s <- p: [DIRTY, RESOLVED]"]);
  assert.equal(g.get("p").has, false, "downstream ends absent, like upstream");
});

test("paused before p had a value, values held before an INVALIDATE are dropped when nothing followed", () => {
  const g = createGraph();
  g.state("a", 0);
  const p = pausable(g, "p", "a");
  const lock = p.pause();
  g.subscribe("s", "p"); // p never had a value, so the INVALIDATE below reaches no one downstream
  g.set("a", 1);
  const out = during(g, () => {
    g.invalidate("a");
    p.resume(lock);
  });
  assert.deepEqual(out, ["s <- p: [DIRTY, RESOLVED]"]);
  assert.equal(g.get("p").has, false, "downstream ends absent, like upstream");
});

test("after a resume nothing is sent twice, unpaused or in the next pause", () => {
  const g = createGraph();
  g.state("a", 0);
  const p = pausable(g, "p", "a");
  g.subscribe("s", "p");
  const out = during(g, () => {
    const first = p.pause();
    g.set("a", 1);
    p.resume(first);
    g.set("a", 2);
    const second = p.pause();
    g.set("a", 3);
    p.resume(second);
  }).filter((x) => !x.endsWith("[DIRTY, RESOLVED]"));
  assert.deepEqual(out, ["s <- p: [DIRTY, DATA(1)]", "s <- p: [DIRTY, DATA(2)]", "s <- p: [DIRTY, DATA(3)]"]);
});

test("arrays keep their boundaries; an INVALIDATE drops the ones before it ([1], [INV], [2, 3], [4, 5])", () => {
  const g = createGraph();
  const src = {};
  g.node("src", [], (ctx) => { src.ctx = ctx; });
  const p = pausable(g, "p", "src");
  g.subscribe("s", "p");
  const lock = p.pause();
  src.ctx.down([["DATA", 1]]);
  const out = during(g, () => {
    src.ctx.down([["INVALIDATE"]]);
    src.ctx.down([["DATA", 2], ["DATA", 3]]);
    src.ctx.down([["DATA", 4], ["DATA", 5]]);
    p.resume(lock);
  });
  assert.deepEqual(out.filter((x) => !x.endsWith("[DIRTY, RESOLVED]")), [
    "s <- p: [DIRTY, DATA(2), DATA(3)]",
    "s <- p: [DIRTY, DATA(4), DATA(5)]",
  ]);
});

test("placed before a node (TS default pause): no value reaches the node while paused; on resume it runs once on every held array", () => {
  const g = createGraph();
  g.state("a", 0);
  const p = pausable(g, "p", "a");
  const seen = [];
  g.node("n", ["p"], (ctx) => { seen.push(ctx.deps[0].waves); ctx.down([["DATA", ctx.deps[0].value]]); });
  g.subscribe("s", "n");
  seen.length = 0;
  const lock = p.pause();
  g.set("a", 1);
  g.batch(() => { g.set("a", 2); g.set("a", 3); });
  // A raw function still runs on each [DIRTY, RESOLVED] the pause causes (P8), but sees
  // no value; value sugar such as derived does not run at all. In TS it does not run.
  assert.ok(seen.every((waves) => waves.flat().length === 0), "no value reaches it while paused");
  seen.length = 0;
  assert.deepEqual(during(g, () => p.resume(lock)), ["s <- n: [DIRTY, DATA(3)]"]);
  assert.deepEqual(seen, [[[1], [2, 3]]], "one invocation, every held array, boundaries kept");
});
