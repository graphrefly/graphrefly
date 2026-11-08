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
    "o <- r/inner: [DIRTY, DATA(1)]",
    "o <- r/inner: [COMPLETE]",
    "o <- r/inner: [START]",
    "o <- r/inner: [DIRTY, DATA(1)]",
    "o <- r/inner: [COMPLETE]",
  ]);
});

test("restart(): an outside request restarts a live inner; a shared upstream stays active; old late output is dropped", async () => {
  const g = createGraph();
  g.state("a", 1);
  const log = [];
  g.node("up", ["a"], (ctx) => {
    ctx.onDeactivation(() => log.push("up closed"));
    ctx.down([["DATA", ctx.deps[0].value]]);
  });
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
