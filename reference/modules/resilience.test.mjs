import test from "node:test";
import assert from "node:assert/strict";
import { retryDelayMs, retryPolicy } from "./resilience.mjs";

test("the default policy is one attempt and no retry", () => {
  assert.deepEqual(retryPolicy(), { maxAttempts: 1, initialMs: 0, factor: 1 });
  assert.equal(retryDelayMs(retryPolicy(), 1), undefined);
});

test("retryDelayMs answers both whether to retry and after how long", () => {
  const p = retryPolicy({ maxAttempts: 3, initialMs: 10 });
  assert.deepEqual([1, 2, 3].map((n) => retryDelayMs(p, n)), [10, 10, undefined], "factor 1: a constant delay; attempt 3 was the last");
  const none = retryPolicy({ maxAttempts: 2 });
  assert.equal(retryDelayMs(none, 1), 0, "initialMs 0: retry at once");
});

test("exponential: initialMs * factor^(n-1), a fractional factor kept, capped by maxMs", () => {
  const p = retryPolicy({ maxAttempts: 5, initialMs: 100, factor: 1.5, maxMs: 300 });
  assert.deepEqual([1, 2, 3, 4].map((n) => retryDelayMs(p, n)), [100, 150, 225, 300]);
  // TS's own example (linear 10 + 5, max 18) has no counterpart here; its exponential with
  // initial 10 and factor 2, max 18 becomes this:
  const q = retryPolicy({ maxAttempts: 3, initialMs: 10, factor: 2, maxMs: 18 });
  assert.deepEqual([1, 2].map((n) => retryDelayMs(q, n)), [10, 18]);
});

test("an attempt number that is not a positive integer gets no retry", () => {
  const p = retryPolicy({ maxAttempts: 3, initialMs: 10 });
  for (const n of [0, -1, 1.5, NaN]) assert.equal(retryDelayMs(p, n), undefined, String(n));
});

test("retryPolicy refuses invalid values instead of correcting them", () => {
  const bad = [
    [{ maxAttempts: 0 }, /maxAttempts/], [{ maxAttempts: 1.5 }, /maxAttempts/],
    [{ initialMs: -1 }, /initialMs/], [{ initialMs: NaN }, /initialMs/], [{ initialMs: Infinity }, /initialMs/],
    [{ factor: 0.5 }, /factor/], [{ factor: Infinity }, /factor/],
    [{ maxMs: -1 }, /maxMs/], [{ maxMs: Infinity }, /maxMs/],
  ];
  for (const [opts, message] of bad) assert.throws(() => retryPolicy(opts), message, JSON.stringify(opts));
  assert.ok(Object.isFrozen(retryPolicy()));
});
