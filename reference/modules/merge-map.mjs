// mergeMap over the reference kernel's rewire. Non-normative.
//
// Built 2026-11-08, first on replace without a seed (git 75ee4c8), then rebuilt on the
// surgical rewire the user asked for once that build showed what replace costs it.
//
//   sourceId ──► id ◄── id/inner/0, id/inner/1, ... ◄── (each projected inner's dependencies)
//
// As TS's merge mode (mapOperator, D47/D81): `id` depends on the source and on every live
// inner, forwards the inners' values, completes once the source has completed and nothing
// is live or waiting, and ends with ERROR on a source or inner ERROR or a throwing
// projector, after the inner values it forwarded in that wave. Inners are added and
// removed with rewire, which keeps the node's instance (value, private state, lifetime),
// so `id` is the operator itself, as in TS. A rewire asked for during the wave runs after it
// (K8), like TS's rewireNext; an added inner's value arrives as an ordinary input wave.
// The fn finds its dependencies by id (ctx.deps[i].id), so nothing depends on positions.
//
// project(value) returns the inner's definition { deps, fn }, as in switchMap; inner nodes
// sit at id/inner/k and are reused once the operator no longer holds them, because the
// kernel cannot delete a node. A projection with the same definition as a live inner adds
// nothing (TS skips an already live inner). A projection onto an ended node is an ERROR.
// `concurrent` bounds the live inners; further source values wait, unprojected, until one
// completes (TS MergeMapOptions).

const sameDef = (a, b) => a.fn === b.fn && a.deps.length === b.deps.length && a.deps.every((d, i) => d === b.deps[i]);

export function mergeMap(g, id, sourceId, project, { concurrent = Infinity } = {}) {
  if (concurrent !== Infinity && (!Number.isInteger(concurrent) || concurrent < 1)) {
    throw new RangeError(`mergeMap ${id}: concurrent must be a positive integer or Infinity`);
  }
  const slot = (k) => `${id}/inner/${k}`;
  let slots = 0; // inner nodes created so far

  const fn = (ctx) => {
    // inners: the live inners, as the last requested dependency list has them.
    const st = ctx.state.get() ?? { inners: [], queue: [], sourceDone: false };
    ctx.state.set(st);
    // A fresh activation starts with no inner, as TS's does. Not after the operator ended.
    ctx.onDeactivation(() => { if (!g.get(id).ended) g.rewire(id, [sourceId], fn); });
    const source = ctx.deps.find((d) => d.id === sourceId);
    const inners = ctx.deps.filter((d) => d.id !== sourceId);

    for (const d of inners) for (const w of d.waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));
    const error = ctx.deps.map((d) => d.terminal).find((t) => t?.[0] === "ERROR");
    if (error) { ctx.down([error]); return; }
    const completed = new Set(inners.filter((d) => d.terminal).map((d) => d.id));
    const before = st.inners.length;
    st.inners = st.inners.filter((x) => !completed.has(x.slot));
    let changed = st.inners.length !== before;
    if (source.terminal) st.sourceDone = true;

    for (const v of source.waves.flat()) st.queue.push(v);
    while (st.queue.length && st.inners.length < concurrent) {
      let next;
      try { next = project(st.queue.shift()); } catch (e) { ctx.down([["ERROR", e instanceof Error ? e.message : e]]); return; }
      const ended = next.deps.find((d) => g.get(d).ended);
      if (ended) { ctx.down([["ERROR", `${id}: cannot follow ${ended}, which has ended`]]); return; }
      if (st.inners.some((x) => sameDef(x.def, next))) continue;
      // Free: not live. One that completed in this wave is still held; replacing it sends
      // the operator its new value, and the rewire below keeps it in place.
      const taken = new Set(st.inners.map((x) => x.slot));
      let k = 0;
      while (taken.has(slot(k))) k += 1;
      if (k === slots) { g.node(slot(k), next.deps, next.fn); slots += 1; } else g.replace(slot(k), next.deps, next.fn);
      st.inners.push({ slot: slot(k), def: next });
      changed = true;
    }
    if (changed) g.rewire(id, [sourceId, ...st.inners.map((x) => x.slot)], fn);
    if (st.sourceDone && !st.inners.length) ctx.down([["COMPLETE"]]); // a waiting value implies a live inner
  };

  g.node(id, [sourceId], fn, { terminal: { complete: "manual", error: "manual" } });
  return { id };
}
