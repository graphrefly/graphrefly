import { assertLocalName } from "../kernel/kernel.mjs";

// Restart as a module over the reference kernel (DS-17 O7). Non-normative.
// The owner itself is in reference/operators/recover.mjs since 2026-11-24, where retry and repeat
// are built on it; this module adds the handle of an outside restart request.
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
//   deps ──► id/inner ──► id          id/restart ──► id
//   deps ──────────────► id           (the owner's hold; it reads only the inner and id/restart)
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
//   restart() a request from outside, through the declared control state `${id}/restart`
//             (P11). It starts a new attempt and counts toward neither. A request is served
//             once: at activation the owner takes the state's current value as served, as
//             the demand log does with its pulls, so a request made before, or while the
//             owner was inactive, does not restart the inner it has just activated (decided
//             by the user 2026-11-09).
//
// The owner asks for the replace from its own function. The kernel queues it until the
// wave is over (K8), like TS's ctx.rewireNext. A delayed retry belongs to the attempt that
// failed: it is dropped if the owner's lifetime has closed by then, or if another attempt has
// started meanwhile, as an outside request does (decided by the user 2026-11-09). While a retry
// waits, the owner's private state says so (`waiting`), and a restored owner whose state says so
// starts that retry's delay again in full (D812, 2026-11-18; the record since the QA of
// 2026-11-19). When the owner deactivates without having ended, an inner
// that has ended is replaced too, so the owner's next activation starts a fresh inner, as a
// new subscription does in TS, rather than on the ended inner's snapshot; with no other
// subscriber it is inactive, so only its definition is renewed. No restart is attempted when a
// fresh inner would end at once on its dependencies' snapshots (P5), sending their last values
// again round after round: under the inner's auto policies, when every dependency has ended or
// one has ended with ERROR.

import { owned, recoverRecipes } from "../operators/recover.mjs";
import { retryPolicy } from "./resilience.mjs";

// `fn` is the inner's function. With `recipe`, a recipe { ref, config } that builds it, the inner
// and the owner carry their recipes and a checkpoint can restore them (F6, 2026-11-10);
// restartRecipes goes in the restore's registry. A restart replaces the inner with its own
// current definition, recipe and setup included, so only its instance changes. After a restore,
// restartableOf(g, id) gives the handle.
export function restartable(g, id, { deps, fn, recipe, rounds = 1, retry = retryPolicy() }) {
  assertLocalName(id);
  owned(g, id, { deps, fn, options: recipe ? { recipe } : {} }, { rounds, retry });
  return restartableOf(g, id);
}

export function restartableOf(g, id) {
  const restartId = `${id}/restart`;
  // The request number is the state's value, so it goes on after a restore (a set with a function, 2026-11-10).
  return { id, innerId: `${id}/inner`, restart() { g.set(restartId, (n) => (n ?? 0) + 1); } };
}

// The owner runs its retry delays on the host's timers here; an operator that is given timers of
// its own (reference/operators/recover.mjs) brings a registry bound to them.
export const restartRecipes = Object.freeze({ "restart.owner": recoverRecipes()["restart.owner"] });
