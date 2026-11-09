// switchMap as an owner with a replaced inner, over the reference kernel. Non-normative.
//
// Built 2026-11-08 to check the claim behind the C-8 decision (REPLAY.md): an operator that
// follows one inner at a time keeps its value across switches without a seed, because only
// its inner is replaced, never the operator itself. It is restart's shape (O7):
//
//   sourceId ──► id ◄── id/inner ◄── (the projected inner's dependencies)
//
// project(value) returns the inner's definition, { deps, fn }. To follow a node X that
// already exists, project to { deps: [X], fn: relay }. On the last source value of a wave the
// owner replaces `${id}/inner` with the projection; the kernel runs it after the wave (K8).
// The old inner's lifetime closes, so its late output is dropped and a dependency only it
// had is released: that is the cancellation. A projection with the same fn and deps as the
// current one keeps the live inner, as TS keeps a re-projected live inner.
//
// As TS's switch mode (mapOperator, D47/D81): the inner's values are forwarded; a source
// or inner ERROR, or a throwing projector, ends the owner with ERROR (the inner is released
// when the owner's lifetime closes); the owner completes once the source has completed and
// no inner is live or pending. The owner's terminals are manual (O6). A projection onto an
// ended node is an ERROR. When the owner deactivates, the inner goes back to none.

export const relay = (ctx) => {
  for (const w of ctx.deps[0].waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));
};

export function switchMap(g, id, sourceId, project) {
  const innerId = `${id}/inner`;
  const none = () => {};
  g.node(innerId, [], none); // no inner until the first source value
  g.node(id, [sourceId, innerId], (ctx) => {
    const [source, inner] = ctx.deps;
    const st = ctx.state.get() ?? { live: false, sourceDone: false, current: null };
    ctx.state.set(st);
    // A fresh activation starts with no inner, as TS's does; an ended inner would also
    // refuse it (P5). Not after the owner itself has ended.
    ctx.onDeactivation(() => { if (!g.get(id).ended) g.replace(innerId, [], none); });
    for (const w of inner.waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));

    const error = [source.terminal, inner.terminal].find((t) => t?.[0] === "ERROR");
    if (error) { ctx.down([error]); return; }
    if (inner.terminal) st.live = false; // the inner completed
    if (source.terminal) st.sourceDone = true;

    const last = source.waves.flat().at(-1);
    if (source.waves.flat().length) {
      let next;
      try { next = project(last); } catch (e) { ctx.down([["ERROR", e instanceof Error ? e.message : e]]); return; }
      // An ended node cannot be acquired (P5); the queued replace would be refused and the
      // owner would wait for good. TS's rewire rejects it too (C-8).
      const ended = next.deps.find((d) => g.get(d).ended);
      if (ended) { ctx.down([["ERROR", `${id}: cannot follow ${ended}, which has ended`]]); return; }
      const same = st.live && st.current && next.fn === st.current.fn
        && next.deps.length === st.current.deps.length && next.deps.every((d, i) => d === st.current.deps[i]);
      if (!same) g.replace(innerId, next.deps, next.fn);
      st.current = next;
      st.live = true;
    }
    if (st.sourceDone && !st.live) ctx.down([["COMPLETE"]]);
  }, { terminal: { complete: "manual", error: "manual" } });
  return { id, innerId };
}
