import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { createGraph, format } from "../kernel/kernel.mjs";
import { restartable } from "./restart.mjs";
import { retryPolicy } from "./resilience.mjs";

const values = (g, sinkId) => g.trace.filter((e) => e.to === sinkId).flatMap((e) => e.msgs)
  .filter((m) => m[0] === "DATA").map((m) => m[1]);
const msgsOf = (g, sinkId) => g.trace.filter((e) => e.to === sinkId).map(format);

async function until(cond, ms = 500) {
  for (const end = Date.now() + ms; !cond();) {
    if (Date.now() > end) throw new Error("timed out");
    await sleep(1);
  }
}

// A finite source: each instance plays `items` one wave at a time after it starts, then
// completes. A fresh instance plays them again.
const play = (items) => (ctx) => {
  if (ctx.state.get()) return;
  ctx.state.set(true);
  queueMicrotask(() => {
    for (const v of items) ctx.down([["DATA", v]]);
    ctx.down([["COMPLETE"]]);
  });
};

test("rounds: plays a fresh inner `rounds` times in sequence, then COMPLETE once (TS repeat)", async () => {
  const g = createGraph();
  restartable(g, "r", { deps: [], fn: play([1, 2]), rounds: 3 });
  g.subscribe("s", "r");
  await until(() => g.get("r").ended);
  assert.deepEqual(values(g, "s"), [1, 2, 1, 2, 1, 2]);
  const ends = g.trace.filter((e) => e.to === "s").flatMap((e) => e.msgs).filter((m) => m[0] === "COMPLETE");
  assert.equal(ends.length, 1, "no protocol terminal reached downstream while a restart was possible");
  assert.deepEqual(g.get("r").ended, ["COMPLETE"]);
});

test("rounds = 1 plays the inner exactly once", async () => {
  const g = createGraph();
  restartable(g, "r", { deps: [], fn: play([7]) });
  g.subscribe("s", "r");
  await until(() => g.get("r").ended);
  assert.deepEqual(values(g, "s"), [7]);
});

test("an inner ERROR with no retries left ends the owner with that ERROR; a throwing inner is one", () => {
  const g = createGraph();
  g.state("a", 1);
  restartable(g, "r", { deps: ["a"], fn: () => { throw new Error("inner boom"); } });
  g.subscribe("s", "r");
  assert.deepEqual(g.get("r").ended, ["ERROR", "inner boom"]);
});

test("retry: an ERROR is retried under the policy; when no attempt is left the ERROR is final", async () => {
  for (const [maxAttempts, expected] of [[3, { ended: ["COMPLETE"], values: ["ok"] }], [2, { ended: ["ERROR", "fail 2"], values: [] }]]) {
    const g = createGraph();
    let attempt = 0;
    restartable(g, "r", {
      deps: [],
      fn: (ctx) => {
        attempt += 1;
        if (attempt <= 2) throw new Error(`fail ${attempt}`);
        play(["ok"])(ctx);
      },
      retry: retryPolicy({ maxAttempts, initialMs: 2 }),
    });
    g.subscribe("s", "r");
    await until(() => g.get("r").ended);
    assert.deepEqual({ ended: g.get("r").ended, values: values(g, "s") }, expected, `maxAttempts ${maxAttempts}`);
    assert.equal(attempt, Math.min(maxAttempts, 3));
  }
});

test("retry counts within a round: each round gets the policy's attempts again", async () => {
  const g = createGraph();
  let attempt = 0;
  restartable(g, "r", {
    deps: [],
    // Every round fails once, then plays. With maxAttempts 2 that needs a fresh count per round.
    fn: (ctx) => { attempt += 1; if (attempt % 2 === 1) throw new Error("once"); play([attempt])(ctx); },
    rounds: 2,
    retry: retryPolicy({ maxAttempts: 2 }),
  });
  g.subscribe("s", "r");
  await until(() => g.get("r").ended);
  assert.deepEqual(g.get("r").ended, ["COMPLETE"]);
  assert.deepEqual(values(g, "s"), [2, 4]);
});

test("observation goes on across attempts: same topology, and the inner's sink sees each attempt start", async () => {
  const g = createGraph();
  restartable(g, "r", { deps: [], fn: play([1]), rounds: 2 });
  const before = JSON.stringify(g.describe());
  g.subscribe("s", "r");
  g.subscribe("o", "r/inner");
  await until(() => g.get("r").ended);
  assert.equal(JSON.stringify(g.describe()), before);
  assert.deepEqual(msgsOf(g, "o"), [
    "o <- r/inner: [START]",
    "o <- r/inner: [PENDING, DATA(1)]",
    "o <- r/inner: [PENDING, COMPLETE]",
    "o <- r/inner: [START]",
    "o <- r/inner: [PENDING, DATA(1)]",
    "o <- r/inner: [PENDING, COMPLETE]",
  ]);
});

test("restart(): an outside request restarts a live inner; a shared upstream stays active; old late output is dropped", async () => {
  const g = createGraph();
  g.state("a", 1);
  const log = [];
  g.node("up", ["a"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]), { setup: () => () => log.push("up closed") });
  const lates = [];
  const r = restartable(g, "r", {
    deps: ["up"],
    fn: (ctx) => {
      if (!ctx.state.get()) {
        ctx.state.set(true);
        lates.push(ctx);
        ctx.signal.addEventListener("abort", () => log.push("inner aborted"));
      }
      ctx.down([["DATA", ctx.deps[0].value * 10]]);
    },
  });
  g.subscribe("s", "r");
  g.set("a", 2);
  r.restart();
  assert.deepEqual(log, ["inner aborted"], "the inner restarted; up was never released");
  lates[0].down([["DATA", "late"]]);
  g.set("a", 3);
  assert.deepEqual(values(g, "s"), [10, 20, 20, 30]);
  assert.equal(g.get("r").ended, null);
});

test("a delayed retry is dropped once the owner's lifetime has closed, even if a new one has opened", async () => {
  const g = createGraph();
  let attempts = 0;
  restartable(g, "r", { deps: [], fn: () => { attempts += 1; throw new Error("boom"); }, retry: retryPolicy({ maxAttempts: 2, initialMs: 60 }) });
  g.subscribe("s", "r"); // attempt 1 fails; its retry would run at about 60 ms
  await sleep(30);
  g.unsubscribe("s", "r");
  g.subscribe("s", "r"); // a new owner lifetime: attempt 2 fails; its retry runs at about 90 ms
  await sleep(45);
  assert.equal(attempts, 2, "at about 75 ms the closed lifetime's retry has not run");
  await until(() => g.get("r").ended);
  assert.equal(attempts, 3);
  assert.deepEqual(g.get("r").ended, ["ERROR", "boom"]);
});

test("no restart once an upstream of the inner has ended: the owner ends with the inner instead of waiting", () => {
  const g = createGraph();
  g.state("a", 1);
  // The inner passes a's new values on and ends with it (complete=auto). It sends only on new
  // input: the run that sees a's COMPLETE brings no value (R-invocation, R-terminals).
  restartable(g, "r", { deps: ["a"], fn: (ctx) => { if (ctx.deps[0].waves.some((w) => w.length)) ctx.down([["DATA", ctx.deps[0].value]]); }, rounds: 5 });
  g.subscribe("s", "r");
  g.complete("a");
  assert.deepEqual(g.get("r").ended, ["COMPLETE"]);
  // A fresh inner would start on a's ended snapshot (P5) and end at once, sending a's last
  // value again each round; with no limit on rounds it would never stop.
  const data = g.trace.filter((e) => e.to === "s").flatMap((e) => e.msgs).filter((m) => m[0] === "DATA");
  assert.deepEqual(data, [["DATA", 1]]);
});

test("a request is served once: the owner's next activation does not restart the inner it activates", () => {
  const g = createGraph();
  let starts = 0;
  const r = restartable(g, "r", { deps: [], fn: (ctx) => {
    if (!ctx.state.get()) { ctx.state.set(true); starts += 1; }
    ctx.down([["DATA", starts]]);
  } });
  g.subscribe("s", "r");
  r.restart();
  assert.equal(starts, 2, "the request restarted the live inner");
  g.unsubscribe("s", "r");
  g.subscribe("s", "r");
  assert.equal(starts, 3, "one fresh inner for the new activation, not a second one for the old request");
  g.unsubscribe("s", "r");
  r.restart(); // while inactive: the next activation starts a fresh inner anyway
  g.subscribe("s", "r");
  assert.equal(starts, 4);
  r.restart();
  assert.equal(starts, 5, "a new request after activation is served");
});

test("a pending retry is dropped once another attempt has started, as an outside request does", async () => {
  const g = createGraph();
  let attempts = 0;
  const r = restartable(g, "r", {
    deps: [],
    fn: (ctx) => { attempts += 1; if (attempts === 1) throw new Error("boom"); ctx.down([["DATA", attempts]]); },
    retry: retryPolicy({ maxAttempts: 3, initialMs: 20 }),
  });
  g.subscribe("s", "r"); // attempt 1 fails; its retry is due at about 20 ms
  r.restart(); // attempt 2 starts now
  assert.equal(attempts, 2);
  await sleep(50);
  assert.equal(attempts, 2, "the retry of attempt 1 did not replace attempt 2");
  assert.deepEqual(values(g, "s"), [2]);
});

test("no restart once an upstream has ended, also when it ends while a retry waits: the owner ends with the ERROR", async () => {
  const g = createGraph();
  g.state("a", 1);
  let attempts = 0;
  restartable(g, "r", {
    deps: ["a"],
    fn: (ctx) => { attempts += 1; if (attempts === 1) throw new Error("boom"); ctx.down([["DATA", ctx.deps[0].value]]); },
    retry: retryPolicy({ maxAttempts: 3, initialMs: 20 }),
  });
  g.subscribe("s", "r"); // attempt 1 fails; its retry is due at about 20 ms
  g.complete("a");
  await until(() => g.get("r").ended);
  assert.equal(attempts, 1, "no fresh inner over the ended upstream");
  assert.deepEqual(g.get("r").ended, ["ERROR", "boom"]);
  assert.deepEqual(values(g, "s"), []);
});

test("one ended dependency among open ones does not stop a retry; every one ended, or an ERROR, does", () => {
  const g = createGraph();
  g.state("cfg", 1); g.state("clock", 0);
  g.complete("cfg"); // a fixed configuration that has completed
  let attempts = 0;
  restartable(g, "r", {
    deps: ["cfg", "clock"],
    fn: (ctx) => { attempts += 1; if (attempts === 1) throw new Error("boom"); ctx.down([["DATA", attempts]]); },
    retry: retryPolicy({ maxAttempts: 3 }),
  });
  g.subscribe("s", "r");
  assert.equal(attempts, 2, "the retry ran over the completed cfg and the open clock");
  assert.deepEqual([g.get("r").ended, values(g, "s")], [null, [2]]);
  const h = createGraph();
  h.state("a", 1); h.state("b", 2);
  h.error("b", "down");
  let n = 0;
  restartable(h, "r", { deps: ["a", "b"], fn: () => { n += 1; throw new Error("boom"); }, retry: retryPolicy({ maxAttempts: 3 }) });
  h.subscribe("o", "r/inner");
  h.subscribe("s", "r");
  assert.equal(n, 0, "a fresh inner over an errored dependency would end at once: no attempt runs its function");
  assert.equal(msgsOf(h, "o").filter((m) => m.includes("START")).length, 1, "and none is made: the inner is never replaced");
  assert.deepEqual(h.get("r").ended, ["ERROR", "down"]);
});

test("the request number lives in the restart state, so a request after a restored one is served", () => {
  const g = createGraph();
  g.state("a", 1);
  let starts = 0;
  const r = restartable(g, "r", { deps: ["a"], fn: (ctx) => { if (!ctx.state.get()) { ctx.state.set(true); starts += 1; } } });
  g.set("r/restart", 1); // as a restore would bring it back
  g.subscribe("s", "r");
  assert.equal(starts, 1);
  r.restart();
  assert.equal(starts, 2, "the owner started a fresh inner");
  assert.equal(g.get("r/restart").value, 2);
});

// C5a (Codex review, 2026-11-10): an ended inner releases its dependencies at once (R-lifetime), so
// without another hold an upstream closed and opened again at every attempt.
test("upstream stays active across attempts: the owner holds the inner's dependencies", () => {
  const g = createGraph();
  const log = [];
  g.state("a", 1);
  g.node("U", ["a"], (ctx) => ctx.down([["DATA", ctx.deps[0].value]]), { setup: () => { log.push("open"); return () => log.push("close"); } });
  restartable(g, "r", { deps: ["U"], rounds: 3, fn: (ctx) => { if (ctx.deps[0].waves.length) ctx.down([["DATA", ctx.deps[0].value], ["COMPLETE"]]); } });
  g.subscribe("s", "r");
  assert.deepEqual(values(g, "s"), [1, 1, 1]);
  assert.deepEqual(g.get("r").ended, ["COMPLETE"]);
  assert.deepEqual(log, ["open", "close"], "one lifetime of U for the three attempts, closed when the owner ended");
});
