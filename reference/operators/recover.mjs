// catchError, retry and repeat over the reference kernel, written from their contracts
// (operators/contracts.jsonl, O-catchError, O-retry, O-repeat; graphrefly:D813). Non-normative.
//
// This file imports nothing of the checkout, so recover.mutants.test.mjs can load edited copies
// of it; reference/modules/restart.mjs builds its restartable on the owner here.
//
// catchError   one node that follows its source and, at the source's ERROR, the replacement the
//              handler gives. handler(error) returns the replacement's definition
//              { deps, fn, recipe? }, as a switchMap's project does; to follow a node X that
//              exists it returns { deps: [X], fn: relay }. The replacement sits at id/inner, and
//              the switch is one ctx.rewire, asked for in the run and made after the wave, so
//              what the replacement holds arrives as a wave of its own. Private state says
//              whether it has switched, so a restored one is on its replacement and its handler
//              is not called again. In the wave of the source's ERROR the source's DATA is sent
//              first (O-catchError), where any other operator drops it (O-common); a throw from
//              the handler is a throw of the function, so what that run had sent is dropped
//              (R-failure).
//
// retry,       the restart owner and its inner (R-restart). The inner is the part that may end
// repeat       and start again: a node at id/inner over long-lived dependencies, which the owner
//              holds too. The owner forwards the inner's DATA; the inner's COMPLETE starts the
//              next round while rounds are left, and its ERROR the next attempt, after the
//              policy's delay, while the round has attempts left; otherwise the owner ends with
//              that terminal. A new attempt replaces the inner by a new instance of its own
//              definition, which runs on what its dependencies hold then. retry(inner, policy)
//              is an owner of one round, repeat(inner, rounds) one whose rounds may each have a
//              retry policy.
//
// Time. A retry's delay runs on the `timers` the operator is given,
// { set(fn, ms) -> handle, clear(handle) }, or the host's (the user, 2026-11-24, as of the time
// family). Timers are not JSON, so recoverRecipes(timers) gives a restore's registry.

const completed = (d) => d.terminal?.[0] === "COMPLETE";
const errored = (d) => d.terminal?.[0] === "ERROR";
const data = (values) => values.map((v) => ["DATA", v]);

export const hostTimers = Object.freeze({ set: (fn, ms) => setTimeout(fn, ms), clear: (handle) => clearTimeout(handle) });
export const recoverPolicies = Object.freeze({ terminal: Object.freeze({ complete: "manual", error: "manual" }), invalidate: "manual" });

export const relay = (ctx) => {
  for (const values of ctx.deps[0].waves) if (values.length) ctx.down(data(values));
};

// A callback that must give a Node gives its definition { deps, fn, recipe? }. Any other result is
// the operator's ERROR, as a throw of the callback is (O-common).
const definitionOf = (result) => {
  if (result === null || typeof result !== "object" || !Array.isArray(result.deps) || typeof result.fn !== "function") {
    throw new TypeError("the callback's result is not a node");
  }
  return result;
};
// catchError. Private state is { switched }.
function catchErrorOf({ sourceId }, { g, id }, handler) {
  const innerId = `${id}/inner`;
  const exists = () => g.describe().some((n) => n.id === innerId);
  const place = (def) => {
    const opts = def.recipe ? { recipe: def.recipe } : {};
    if (exists()) g.replace(innerId, def.deps, def.fn, opts); else g.node(innerId, def.deps, def.fn, opts);
  };
  return (ctx) => {
    const switched = ctx.state.get()?.switched === true;
    const followed = ctx.deps.find((d) => d.id === (switched ? innerId : sourceId));
    ctx.state.set({ switched });
    if (followed.invalidated) ctx.down([["INVALIDATE"]]);
    if (switched) {
      // The replacement is followed as any input is: its ERROR ends the branch without that
      // wave's DATA (O-common).
      if (errored(followed)) { ctx.down([followed.terminal]); return; }
      for (const values of followed.waves) if (values.length) ctx.down(data(values));
      if (completed(followed)) ctx.down([["COMPLETE"]]);
      return;
    }
    for (const values of followed.waves) if (values.length) ctx.down(data(values));
    if (completed(followed)) { ctx.down([["COMPLETE"]]); return; }
    if (!errored(followed)) return;
    place(definitionOf(handler(followed.terminal[1])));
    ctx.state.set({ switched: true });
    ctx.rewire([innerId]);
  };
}

// `handler(error)` returns the replacement's definition { deps, fn, recipe? }. With `recipe`, a
// recipe { ref, config } that builds the handler, the operator carries its own recipe and a
// checkpoint can restore it.
export function catchError(g, id, sourceId, handler, { recipe } = {}) {
  const config = { sourceId };
  g.node(id, [sourceId], catchErrorOf(config, { g, id }, handler), {
    ...recoverPolicies,
    ...(recipe && { recipe: { ref: "recover.catchError", config: { ...config, handler: recipe } } }),
  });
  return { id };
}

// The retry policy, as reference/modules/resilience.mjs has it: { maxAttempts, initialMs, factor,
// maxMs? }, maxAttempts counting every attempt, the first included. After attempt n failed the
// next waits min(initialMs * factor^(n-1), maxMs), or there is none.
export function retryPolicy({ maxAttempts = 1, initialMs = 0, factor = 1, maxMs } = {}) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new RangeError("retryPolicy: maxAttempts must be a positive integer");
  if (!Number.isFinite(initialMs) || initialMs < 0) throw new RangeError("retryPolicy: initialMs must be a finite number >= 0");
  if (!Number.isFinite(factor) || factor < 1) throw new RangeError("retryPolicy: factor must be a finite number >= 1");
  if (maxMs !== undefined && (!Number.isFinite(maxMs) || maxMs < 0)) throw new RangeError("retryPolicy: maxMs must be a finite number >= 0");
  return Object.freeze(maxMs === undefined ? { maxAttempts, initialMs, factor } : { maxAttempts, initialMs, factor, maxMs });
}
export function retryDelayMs(policy, failedAttempt) {
  if (!Number.isInteger(failedAttempt) || failedAttempt < 1 || failedAttempt >= policy.maxAttempts) return undefined;
  const delay = policy.initialMs * policy.factor ** (failedAttempt - 1);
  return policy.maxMs === undefined ? delay : Math.min(delay, policy.maxMs);
}

// The owner (R-restart). Private state is { round, failures, attempt, waiting, seen }: the round
// that runs, the failures counted in it, the replaces this lifetime asked for, whether a retry
// waits for its delay, and the last request of id/restart that was served.
export function owner({ deps, rounds, retry }, { g, id }, timers = hostTimers) {
  const kernel = g;
  const innerId = `${id}/inner`;
  const restartId = `${id}/restart`;
  const ends = () => deps.map((d) => kernel.get(d).ended);
  const wouldEndAtOnce = () => {
    const e = ends();
    return (e.length > 0 && e.every(Boolean)) || e.some((t) => t?.[0] === "ERROR");
  };
  // A new instance of the inner's own definition (R-restart), its dependencies included. Until
  // 2026-11-23 the replace took the list the caller had given, which the caller could still change:
  // the next attempt's inner then depended on nodes the owner did not hold.
  const renew = () => {
    const d = kernel.definition(innerId);
    kernel.replace(innerId, d.deps, d.fn, { setup: d.setup, recipe: d.recipe });
  };
  // Starts the attempt st.attempt after `delay`: at once without one, else when a timer ends,
  // unless the owner's lifetime has closed or another attempt has started by then. `end` is the
  // terminal the owner ends with when no attempt can be made. While the timer runs, st.waiting
  // records the retry, so a checkpoint saves it (R-checkpoint: pending work is state).
  const schedule = (ctx, st, delay, end) => {
    const { signal } = ctx;
    const { attempt } = st;
    const replace = () => {
      if (signal.aborted || st.attempt !== attempt) return;
      st.waiting = false;
      // An upstream may have ended while a retry waited; the ended inner no longer hears it, so
      // the check is made again here. Then no attempt is made and the owner ends with the inner.
      if (wouldEndAtOnce()) { if (end) ctx.down([end]); return; }
      renew();
    };
    if (delay > 0) {
      st.waiting = true;
      // The timer goes with the lifetime: a pending retry is dropped at close, and its timer
      // cleared then rather than left to fire into nothing (2026-11-10).
      const timer = timers.set(replace, delay);
      signal.addEventListener("abort", () => timers.clear(timer), { once: true });
    } else replace();
  };
  const fn = (ctx) => {
    const inner = ctx.deps.find((d) => d.id === innerId);
    const request = ctx.deps.find((d) => d.id === restartId);
    // `seen` is the last request served; `attempt` counts the replaces this lifetime asked for.
    // No request yet counts as 0, the number the first one follows, so the state stays JSON.
    const requested = request.value ?? 0;
    const st = ctx.state.get();
    // An INVALIDATE of the restart state is no request: the state holds none then, and the
    // request numbers start again from it.
    if (request.invalidated === true && !request.has) st.seen = 0;
    // The inner's INVALIDATE retracts the output, and it alone while the inner runs: what the
    // inner does with an INVALIDATE of a dependency is its own (O-retry, O-repeat; the user,
    // 2026-11-24). Once the inner has ended, as while a retry waits, a dependency's does. The
    // restart state's never does. Until then the owner had the auto policy, and retracted for
    // any dependency's INVALIDATE, also one a valve or a delay as inner had not passed on.
    const ended = inner.terminal !== null || kernel.get(innerId).ended != null;
    if (inner.invalidated === true || (ended && ctx.deps.some((d) => deps.includes(d.id) && d.invalidated === true))) ctx.down([["INVALIDATE"]]);
    for (const w of inner.waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));

    const end = inner.terminal;
    let delay = 0;
    // No attempt when a fresh inner would end at once on its dependencies' snapshots (P5): under
    // its auto policies, when every dependency has ended or one has ended with ERROR. Then the
    // owner ends with the inner. One ended dependency among open ones does not stop a retry
    // (fixed 2026-11-09 after a review found a completed config blocking every retry).
    const restartable = !wouldEndAtOnce();
    let again = restartable && requested !== st.seen;
    st.seen = requested;
    if (restartable && !again && end?.[0] === "COMPLETE" && st.round < rounds) { st.round += 1; st.failures = 0; again = true; }
    if (restartable && !again && end?.[0] === "ERROR") {
      const wait = retryDelayMs(retry, st.failures + 1);
      if (wait !== undefined) { st.failures += 1; delay = wait; again = true; }
    }
    if (!again) { if (end) ctx.down([end]); return; }

    st.attempt += 1;
    schedule(ctx, st, delay, end);
  };
  const setup = (ctx) => {
    // At each activation, restored ones included, a request already in the restart state is old
    // (moved here on 2026-11-10: a restored owner, whose private state came back, served one).
    const request = ctx.deps.find((d) => d.id === restartId);
    ctx.state.set({ ...(ctx.state.get() ?? { round: 1, failures: 0, attempt: 0, waiting: false }), seen: request.value ?? 0 });
    // A restored owner that recorded a waiting retry (D812 (2), decided by the user 2026-11-18): the
    // pending retry is state, so its delay starts again in full, for the same attempt and without
    // counting another failure; both numbers came back with the private state. When it ends, the
    // retry is made or dropped as any delayed retry is. Until D812 the inner was renewed here at once
    // (F6), which kept the failure count and skipped the backoff. The record, not the inner's being
    // ended, says a retry was waiting: the inner is activated before this setup runs, so one that
    // fails only now is ended here too, and its failure is the function's to count (QA 2026-11-19).
    const st = ctx.state.get();
    // A fresh activation has no record of one: its state starts with waiting false.
    if (st.waiting) schedule(ctx, st, retryDelayMs(retry, st.failures), kernel.get(innerId).ended);
    // Unless the owner itself has ended for good, its next activation starts a fresh inner.
    return () => { if (!kernel.get(id).ended && kernel.get(innerId).ended) renew(); };
  };
  return { fn, setup };
}

// The owner and its inner on a graph. `inner` is { deps, fn, options? }, the inner node's
// definition: its options are its own policies, setup and recipe. With a recipe on the inner the
// owner carries one too, and a checkpoint can restore both.
export function owned(g, id, inner, { rounds = 1, retry = retryPolicy(), timers = hostTimers } = {}) {
  const deps = [...inner.deps]; // its own list: a caller that changes its list afterwards changes nothing here
  const innerId = `${id}/inner`;
  const restartId = `${id}/restart`;
  const options = inner.options ?? {};
  g.state(restartId); // no value until the first request, so activation sees none
  g.node(innerId, deps, inner.fn, options);
  // The owner holds the inner's dependencies too, ahead of the inner, so an inner that ends does
  // not release the last hold on them: upstream stays active across attempts (C5a, 2026-11-10).
  // The owner reads only the inner and the restart state.
  const config = { deps, rounds, retry };
  const built = owner(config, { g, id }, timers);
  g.node(id, [...deps, innerId, restartId], built.fn, {
    ...recoverPolicies, setup: built.setup,
    ...(options.recipe && { recipe: { ref: "restart.owner", config } }),
  });
  return { id, innerId };
}

const positive = (n) => Number.isInteger(n) && n >= 1;

export function retry(g, id, inner, policy, { timers } = {}) {
  return owned(g, id, inner, { retry: retryPolicy(policy), timers });
}

// rounds is a positive integer and counts every round, the first included; with a retry policy
// each round has its attempts (the user, 2026-11-24).
export function repeat(g, id, inner, rounds, { retry: policy, timers } = {}) {
  if (!positive(rounds)) throw new RangeError(`repeat ${id}: rounds is a positive integer`);
  return owned(g, id, inner, { rounds, retry: retryPolicy(policy), timers });
}

// The registry of a restore, bound to the timers the restored owners run on.
export const recoverRecipes = (timers = hostTimers) => Object.freeze({
  "recover.catchError": ({ handler, ...config }, at) => catchErrorOf(config, at, at.make(handler.ref, handler.config).fn),
  "recover.relay": () => relay,
  "restart.owner": (config, at) => owner(config, at, timers),
});
