// Restart as a module over the reference kernel (DS-17 O7). Non-normative.
//
// One owner node `id` faces downstream for good. What may end and be restarted lives
// inside it as an owned inner node at a fixed path, `${id}/inner`. A restart replaces that
// node (kernel `replace`): same id, same subscribers, a fresh instance. So describe and
// observe(`${id}/inner`) go on across attempts, and nothing upstream needs to be
// resubscribable: the inner subscribes to long-lived nodes outside the owner with
// ordinary dependencies.
//
//   deps ──► id/inner ──► id          id.restart ──► id
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

export function restartable(g, id, { deps, fn, rounds = 1, retry = retryPolicy() }) {
  const innerId = `${id}/inner`;
  const ends = () => deps.map((d) => g.get(d).ended);
  const wouldEndAtOnce = () => {
    const e = ends();
    return (e.length > 0 && e.every(Boolean)) || e.some((t) => t?.[0] === "ERROR");
  };
  const restartId = `${id}.restart`;
  g.state(restartId); // no value until the first request, so activation sees none
  g.node(innerId, deps, fn);
  g.node(id, [innerId, restartId], (ctx) => {
    const [inner, request] = ctx.deps;
    // `seen` is the last request served; `attempt` counts the replaces this lifetime asked for.
    const st = ctx.state.get() ?? { round: 1, failures: 0, seen: request.value, attempt: 0 };
    ctx.state.set(st);
    for (const w of inner.waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));

    const end = inner.terminal;
    let delay = 0;
    // No attempt when a fresh inner would end at once on its dependencies' snapshots (P5): under
    // its auto policies, when every dependency has ended or one has ended with ERROR. Then the
    // owner ends with the inner. One ended dependency among open ones does not stop a retry
    // (fixed 2026-11-09 after a review found a completed config blocking every retry).
    const restartable = !wouldEndAtOnce();
    let again = restartable && request.value !== st.seen;
    st.seen = request.value;
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
      g.replace(innerId, deps, fn);
    };
    if (delay > 0) setTimeout(replace, delay);
    else replace();
  }, {
    terminal: { complete: "manual", error: "manual" },
    // Unless the owner itself has ended for good, its next activation starts a fresh inner.
    setup: () => () => { if (!g.get(id).ended && g.get(innerId).ended) g.replace(innerId, deps, fn); },
  });

  // The request number is the state's value, so it goes on after a restore (a set with a function, 2026-11-10).
  return { id, innerId, restart() { g.set(restartId, (n) => (n ?? 0) + 1); } };
}
