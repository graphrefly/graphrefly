// Retry policy, the library-wide vocabulary (D130/D132). Non-normative.
//
// Rewritten 2026-11-08 from graphrefly-ts `packages/ts/src/graph/resilience.ts` at `dafc5ae`,
// with the user, in three places:
//   1. One function, retryDelayMs, answers both "retry?" and "after how long?". TS has
//      shouldRetry plus nextRetryDelayMs, and every caller pairs them, guarding against
//      an undefined delay that cannot occur inside the retry range.
//   2. One backoff shape instead of five kinds: before the retry that follows failed
//      attempt n, wait min(initialMs * factor^(n-1), maxMs). factor 1 is TS's constant,
//      initialMs 0 is TS's none, factor > 1 is exponential. Linear and fibonacci had no
//      user, so they are gone.
//   3. retryPolicy validates when it builds the policy and throws. TS corrects at every
//      computation: a non-integer factor is truncated (1.5 becomes 1), and a negative,
//      NaN or infinite number becomes 0.
// It stays data, as in TS (a policy can travel as a DATA fact), and stays passive: it
// schedules nothing and owns no graph state. Whoever retries, a driver or the restart
// owner, reads it.
//
// RetryPolicy: { maxAttempts, initialMs, factor, maxMs? }. maxAttempts counts every
// attempt, the first included; no maxMs means no cap.

export function retryPolicy({ maxAttempts = 1, initialMs = 0, factor = 1, maxMs } = {}) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new RangeError("retryPolicy: maxAttempts must be a positive integer");
  if (!Number.isFinite(initialMs) || initialMs < 0) throw new RangeError("retryPolicy: initialMs must be a finite number >= 0");
  if (!Number.isFinite(factor) || factor < 1) throw new RangeError("retryPolicy: factor must be a finite number >= 1");
  if (maxMs !== undefined && (!Number.isFinite(maxMs) || maxMs < 0)) throw new RangeError("retryPolicy: maxMs must be a finite number >= 0");
  return Object.freeze(maxMs === undefined ? { maxAttempts, initialMs, factor } : { maxAttempts, initialMs, factor, maxMs });
}

// After attempt `failedAttempt` (1 for the first) failed: the delay before the next
// attempt, or undefined when no attempt is left.
export function retryDelayMs(policy, failedAttempt) {
  if (!Number.isInteger(failedAttempt) || failedAttempt < 1 || failedAttempt >= policy.maxAttempts) return undefined;
  const delay = policy.initialMs * policy.factor ** (failedAttempt - 1);
  return policy.maxMs === undefined ? delay : Math.min(delay, policy.maxMs);
}
