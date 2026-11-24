// The trace runner's clock (clock.mjs). Non-normative.

import test from "node:test";
import assert from "node:assert/strict";
import { createClock } from "./clock.mjs";

const logged = (clock) => {
  const log = [];
  return { log, at: (ms, name) => clock.timers.set(() => log.push(name), ms) };
};

test("a timer fires when the clock reaches its due time, not before, and once", () => {
  const clock = createClock();
  const { log, at } = logged(clock);
  at(100, "a");
  clock.advance(99);
  assert.deepEqual(log, []);
  clock.advance(1);
  assert.deepEqual(log, ["a"]);
  clock.advance(1000);
  assert.deepEqual(log, ["a"]);
  assert.equal(clock.running, 0);
});

test("timers fire in the order of their due times, whatever the order they were set in", () => {
  const clock = createClock();
  const { log, at } = logged(clock);
  at(300, "c");
  at(100, "a");
  at(200, "b");
  clock.advance(250);
  assert.deepEqual(log, ["a", "b"]);
  assert.equal(clock.running, 1);
});

test("a timer started by a firing is due from that firing's time: one advance over several periods fires each", () => {
  const clock = createClock();
  const log = [];
  const again = (n) => clock.timers.set(() => { log.push(n); again(n + 1); }, 100);
  again(1);
  clock.advance(350);
  assert.deepEqual(log, [1, 2, 3]);
  clock.advance(50);
  assert.deepEqual(log, [1, 2, 3, 4], "the fourth was due at 400, not at 350 + 100");
});

test("a timer started at a firing for a time within the advance fires in it, between the others", () => {
  const clock = createClock();
  const { log, at } = logged(clock);
  clock.timers.set(() => { log.push("b"); at(30, "b+30"); at(60, "b+60"); }, 50);
  at(100, "a");
  clock.advance(100);
  assert.deepEqual(log, ["b", "b+30", "a"]);
  clock.advance(10);
  assert.deepEqual(log, ["b", "b+30", "a", "b+60"]);
});

test("a cleared timer does not fire, also when a firing of the same instant clears it; clearing again or an unknown handle does nothing", () => {
  const clock = createClock();
  const { log, at } = logged(clock);
  const a = at(100, "a");
  clock.timers.clear(a);
  clock.timers.clear(a);
  clock.timers.clear("nothing");
  let later;
  clock.timers.set(() => { log.push("first"); clock.timers.clear(later); }, 100);
  later = at(100, "later");
  clock.advance(100);
  assert.deepEqual(log, ["first"]);
  assert.equal(clock.running, 0);
});

test("timers due at the same instant fire in the order they were set, and with reverse the later one first; due times still come first", () => {
  const order = (reverse) => {
    const clock = createClock({ reverse });
    const { log, at } = logged(clock);
    at(100, "a");
    at(50, "early");
    at(100, "b");
    at(100, "c");
    clock.advance(100);
    return log;
  };
  assert.deepEqual(order(false), ["early", "a", "b", "c"]);
  assert.deepEqual(order(true), ["early", "c", "b", "a"]);
});

test("a timer of no time fires at the next advance, and one started by a firing for no time in that same advance", () => {
  const clock = createClock();
  const { log, at } = logged(clock);
  clock.timers.set(() => { log.push("a"); at(0, "a+0"); }, 0);
  assert.deepEqual(log, [], "setting a timer fires nothing");
  clock.advance(1);
  assert.deepEqual(log, ["a", "a+0"]);
});

test("drop leaves every running timer behind, and the clock goes on", () => {
  const clock = createClock();
  const { log, at } = logged(clock);
  at(100, "old");
  clock.advance(60);
  clock.drop();
  assert.equal(clock.running, 0);
  at(100, "new");
  clock.advance(99);
  assert.deepEqual(log, []);
  clock.advance(1);
  assert.deepEqual(log, ["new"]);
});

test("the clock refuses an advance that is not a positive integer, an advance from a timer, a timer without a function or with a negative time, and a timer that starts itself without end", () => {
  const clock = createClock();
  for (const ms of [0, -1, 1.5, "10", NaN, Infinity, undefined]) assert.throws(() => clock.advance(ms), /advances by a positive integer/, String(ms));
  assert.throws(() => clock.timers.set(null, 10), /given a function/);
  for (const ms of [-1, NaN, Infinity, "10", undefined]) assert.throws(() => clock.timers.set(() => {}, ms), /not negative/, String(ms));
  assert.equal(clock.running, 0);
  clock.timers.set(() => clock.advance(1), 10);
  assert.throws(() => clock.advance(10), /from outside a timer/);
  clock.advance(1); // usable after a throw
  const loop = () => clock.timers.set(loop, 0);
  loop();
  assert.throws(() => clock.advance(1), /more than 10000 timers fired in one advance/);
});

test("a throw from a timer leaves the clock at that timer's time, with the timers not yet fired still running", () => {
  const clock = createClock();
  const { log, at } = logged(clock);
  clock.timers.set(() => { throw new Error("boom"); }, 50);
  at(80, "after");
  assert.throws(() => clock.advance(100), /boom/);
  assert.equal(clock.running, 1);
  clock.advance(30);
  assert.deepEqual(log, ["after"], "due at 80, and the clock stood at 50");
});
