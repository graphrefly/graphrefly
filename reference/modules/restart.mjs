// Restart as a module over the reference kernel (DS-17 O7). Non-normative.
//
// One owner node `id` faces downstream for good. What may end and be restarted lives
// inside it as an owned inner node at a fixed path, `${id}/inner`. A restart replaces that
// node (kernel `replace`): same id, same subscribers, a fresh instance. So describe and
// observe(`${id}/inner`) go on across attempts, and nothing upstream needs to be
// resubscribable: the inner subscribes to long-lived nodes outside the owner with
// ordinary dependencies. The owner holds those dependencies too, ahead of the inner, since
// an inner that ends releases its dependencies at once (R-lifetime): without the owner's
// hold an upstream that nothing else held closed and opened again at every attempt (C5a,
// decided by the user 2026-11-10).
//
//   deps ──► id/inner ──► id          id.restart ──► id
//   deps ──────────────► id           (the owner's hold; it reads only the inner and id.restart)
//
// The owner forwards the inner's values. When the inner ends, the owner's policy decides:
// restart it, or end the owner with that same terminal, which is then final. While a
// restart is possible no protocol terminal reaches downstream. The owner's terminals are
// manual (O6), so it runs on the inner's COMPLETE or ERROR instead of ending with it.
//
// Policy, as in O7 (attempts and backoff are the owner's):
//   rounds    how many times the inner may complete in all (TS repeat's count);
//   retry     the library's retry policy (resilience.mjs): within a round, an ERROR from
//             attempt n is retried after retryDelayMs(retry, n), unless that is undefined.
//             Default retryPolicy(): one attempt, no retry;
//   restart() a request from outside, through the declared control state `${id}.restart`
//             (P11). It starts a new attempt and counts toward neither. A request is served
//             once: at activation the owner takes the state's current value as served, as
//             the demand log does with its pulls, so a request made before, or while the
//             owner was inactive, does not restart the inner it has just activated (decided
//             by the user 2026-11-09).
//
// The owner asks for the replace from its own function. The kernel queues it until the
// wave is over (K8), like TS's ctx.rewireNext. A delayed retry belongs to the attempt that
// failed: it is dropped if the owner's lifetime has closed by then, or if another attempt has
// started meanwhile, as an outside request does (decided by the user 2026-11-09). When the owner deactivates without having ended, an inner
// that has ended is replaced too, so the owner's next activation starts a fresh inner, as a
// new subscription does in TS, rather than on the ended inner's snapshot; with no other
// subscriber it is inactive, so only its definition is renewed. No restart is attempted when a
// fresh inner would end at once on its dependencies' snapshots (P5), sending their last values
// again round after round: under the inner's auto policies, when every dependency has ended or
// one has ended with ERROR.

import { retryDelayMs, retryPolicy } from "./resilience.mjs";
import { builder } from "./build.mjs";

// `g` is a kernel graph or a checkpoint bundle (F6, 2026-11-10). Through a bundle the owner and
// its inner can be restored: the inner is then given as a registered recipe, `inner: { ref,
// config }`, instead of `fn`, and restartRecipes must be in the restore's registry. A restart
// replaces the inner with its own current definition, so only its instance changes and it stays
// restorable. After a restore, restartableOf(g, id) gives the handle.
export function restartable(g, id, { deps, fn, inner, rounds = 1, retry = retryPolicy() }) {
  const b = builder(g);
  const innerId = `${id}/inner`;
  const restartId = `${id}.restart`;
  b.state(restartId); // no value until the first request, so activation sees none
  b.node(innerId, deps, b.restorable ? inner : { factory: () => fn });
  // The owner holds the inner's dependencies too, ahead of the inner, so an inner that ends does
  // not release the last hold on them: upstream stays active across attempts (C5a, 2026-11-10).
  // The owner reads only the inner and the restart state.
  b.node(id, [...deps, innerId, restartId],
    { ref: "restart.owner", config: { deps, rounds, retry }, factory: restartRecipes["restart.owner"] },
    { terminal: { complete: "manual", error: "manual" } });
  return restartableOf(g, id);
}

export function restartableOf(g, id) {
  const kernel = builder(g).kernel;
  const restartId = `${id}.restart`;
  // The request number is the state's value, so it goes on after a restore (a set with a function, 2026-11-10).
  return { id, innerId: `${id}/inner`, restart() { kernel.set(restartId, (n) => (n ?? 0) + 1); } };
}

function owner({ deps, rounds, retry }, { g, id }) {
  const kernel = builder(g).kernel;
  const innerId = `${id}/inner`;
  const restartId = `${id}.restart`;
  const ends = () => deps.map((d) => kernel.get(d).ended);
  const wouldEndAtOnce = () => {
    const e = ends();
    return (e.length > 0 && e.every(Boolean)) || e.some((t) => t?.[0] === "ERROR");
  };
  // A new instance of the inner's own definition.
  const renew = () => kernel.replace(innerId, deps, kernel.definition(innerId).fn);
  const fn = (ctx) => {
    const inner = ctx.deps.find((d) => d.id === innerId);
    const request = ctx.deps.find((d) => d.id === restartId);
    // `seen` is the last request served; `attempt` counts the replaces this lifetime asked for.
    // No request yet counts as 0, the number the first one follows, so the state stays JSON.
    const requested = request.value ?? 0;
    const st = ctx.state.get() ?? { round: 1, failures: 0, seen: requested, attempt: 0 };
    ctx.state.set(st);
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

    const { signal } = ctx;
    const attempt = ++st.attempt;
    const replace = () => {
      if (signal.aborted || st.attempt !== attempt) return;
      // An upstream may have ended while a retry waited; the ended inner no longer hears it, so
      // the check is made again here. Then no attempt is made and the owner ends with the inner.
      if (wouldEndAtOnce()) { if (end) ctx.down([end]); return; }
      renew();
    };
    if (delay > 0) {
      // The timer goes with the lifetime: a pending retry is dropped at close, and its timer
      // cleared then rather than left to fire into nothing (2026-11-10).
      const timer = setTimeout(replace, delay);
      signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
    } else replace();
  };
  const setup = (ctx) => {
    // A restored owner (it has private state before its first run) whose inner had ended was
    // waiting for a retry, whose timer no checkpoint holds: as at a deactivation, the pending
    // retry is gone and the inner is renewed (F6, 2026-11-10). A fresh activation has no state.
    if (ctx.state.get() !== undefined && !kernel.get(id).ended && kernel.get(innerId).ended) renew();
    // Unless the owner itself has ended for good, its next activation starts a fresh inner.
    return () => { if (!kernel.get(id).ended && kernel.get(innerId).ended) renew(); };
  };
  return { fn, setup };
}

export const restartRecipes = Object.freeze({ "restart.owner": owner });
