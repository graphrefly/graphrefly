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
//             (P11). It starts a new attempt and counts toward neither.
//
// The owner asks for the replace from its own function. The kernel queues it until the
// wave is over (K8), like TS's ctx.rewireNext. A delayed retry is dropped if the owner's
// lifetime has closed by then. When the owner deactivates without having ended, an inner
// that has ended is replaced too, since it would otherwise refuse the owner's next
// activation (P5); with no other subscriber it is inactive, so only its definition is
// renewed. No restart is attempted once an upstream of the inner has ended: the fresh
// instance could not acquire it (P5), and the owner would wait for good.

import { retryDelayMs, retryPolicy } from "./resilience.mjs";

export function restartable(g, id, { deps, fn, rounds = 1, retry = retryPolicy() }) {
  const innerId = `${id}/inner`;
  const restartId = `${id}.restart`;
  g.state(restartId); // no value until the first request, so activation sees none
  g.node(innerId, deps, fn);
  g.node(id, [innerId, restartId], (ctx) => {
    const [inner, request] = ctx.deps;
    const st = ctx.state.get() ?? { round: 1, failures: 0 };
    ctx.state.set(st);
    // Unless the owner itself has ended for good, its next activation needs an inner that
    // has not ended (P5).
    ctx.onDeactivation(() => { if (!g.get(id).ended && g.get(innerId).ended) g.replace(innerId, deps, fn); });
    for (const w of inner.waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));

    const end = inner.terminal;
    let delay = 0;
    // A fresh inner could not acquire an ended upstream (P5), so none is attempted: the
    // owner ends with the inner instead of waiting for a restart that cannot happen.
    const restartable = !deps.some((d) => g.get(d).ended);
    let again = restartable && request.waves.length > 0;
    if (restartable && !again && end?.[0] === "COMPLETE" && st.round < rounds) { st.round += 1; st.failures = 0; again = true; }
    if (restartable && !again && end?.[0] === "ERROR") {
      const wait = retryDelayMs(retry, st.failures + 1);
      if (wait !== undefined) { st.failures += 1; delay = wait; again = true; }
    }
    if (!again) { if (end) ctx.down([end]); return; }

    const { signal } = ctx;
    const replace = () => { if (!signal.aborted) g.replace(innerId, deps, fn); };
    if (delay > 0) setTimeout(replace, delay);
    else replace();
  }, { terminal: { complete: "manual", error: "manual" } });

  let seq = 0;
  return { id, innerId, restart() { g.set(restartId, ++seq); } };
}
