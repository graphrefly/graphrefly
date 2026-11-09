// switchMap and mergeMap over the reference kernel's rewire. Non-normative.
//
// One operator, as TS's mapOperator (higher-order.ts, D47/D81). Built 2026-11-08: switchMap
// first as an owner with a replaced inner, mergeMap first on replace (git 75ee4c8), then
// mergeMap on rewire (79026f7); merged here once both fitted the same shape.
//
//   sourceId ──► id ◄── id/inner/0, id/inner/1, ... ◄── (each projected inner's dependencies)
//
// `id` depends on the source and on every live inner and forwards the inners' values. It
// completes once the source has completed and no inner is live, and ends with ERROR on a
// source or inner ERROR or a throwing projector, after the inner values it forwarded in that
// wave. A change of the inner set is one rewire, asked for during the wave and run after it
// (K8), as TS's rewireNext is drained at the boundary; an added inner's value arrives as an
// ordinary input wave. Dependencies are read by id (ctx.deps[i].id).
//
// project(value) returns the inner's definition { deps, fn }; to follow a node X that already
// exists, project to { deps: [X], fn: relay }. Inner nodes sit at id/inner/k, because the
// kernel cannot delete a node: a definition goes into a node with replace (a new node the
// first time). A projection with the same definition as a live inner keeps that inner (TS
// keeps an already live inner). A projection onto an ended node is an ERROR (P5).
//
// switch: the last source value of a wave is projected into id/inner/0. Replacing that node
// closes the live inner's lifetime, so its late output is dropped and a dependency only it
// had is released: that is the cancellation.
// merge: every source value is projected, into the first node not live. `concurrent` bounds
// the live inners; further values wait, unprojected, until one completes (MergeMapOptions).

export const relay = (ctx) => {
  for (const w of ctx.deps[0].waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));
};

const sameDef = (a, b) => a.fn === b.fn && a.deps.length === b.deps.length && a.deps.every((d, i) => d === b.deps[i]);

function mapOperator(g, id, sourceId, project, mode, concurrent) {
  const inner = (k) => `${id}/inner/${k}`;
  let made = 0; // inner nodes created so far
  const place = (k, def) => {
    if (k === made) { g.node(inner(k), def.deps, def.fn); made += 1; } else g.replace(inner(k), def.deps, def.fn);
  };

  const fn = (ctx) => {
    // inners: the live inners, as the last requested dependency list has them.
    const st = ctx.state.get() ?? { inners: [], queue: [], sourceDone: false };
    ctx.state.set(st);
    // A fresh activation starts with no inner, as TS's does. Not after the operator ended.
    ctx.onDeactivation(() => { if (!g.get(id).ended) g.rewire(id, [sourceId], fn); });
    const source = ctx.deps.find((d) => d.id === sourceId);
    const live = ctx.deps.filter((d) => d.id !== sourceId);

    for (const d of live) for (const w of d.waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));
    const error = ctx.deps.map((d) => d.terminal).find((t) => t?.[0] === "ERROR");
    if (error) { ctx.down([error]); return; }
    const completed = new Set(live.filter((d) => d.terminal).map((d) => d.id));
    const before = st.inners.length;
    st.inners = st.inners.filter((x) => !completed.has(x.node));
    let changed = st.inners.length !== before;
    if (source.terminal) st.sourceDone = true;

    const values = source.waves.flat();
    st.queue.push(...(mode === "switch" ? values.slice(-1) : values));
    while (st.queue.length && (mode === "switch" || st.inners.length < concurrent)) {
      let next;
      try { next = project(st.queue.shift()); } catch (e) { ctx.down([["ERROR", e instanceof Error ? e.message : e]]); return; }
      const ended = next.deps.find((d) => g.get(d).ended);
      if (ended) { ctx.down([["ERROR", `${id}: cannot follow ${ended}, which has ended`]]); return; }
      if (st.inners.some((x) => sameDef(x.def, next))) continue;
      let k = 0;
      if (mode === "merge") {
        // Not live. One that completed in this wave is still held; replacing it sends the
        // operator its new value, and the rewire below keeps it in place.
        const taken = new Set(st.inners.map((x) => x.node));
        while (taken.has(inner(k))) k += 1;
      }
      place(k, next);
      const added = { node: inner(k), def: next };
      st.inners = mode === "switch" ? [added] : [...st.inners, added];
      changed = true;
    }
    if (changed) g.rewire(id, [sourceId, ...st.inners.map((x) => x.node)], fn);
    if (st.sourceDone && !st.inners.length) ctx.down([["COMPLETE"]]); // a waiting value implies a live inner
  };

  g.node(id, [sourceId], fn, { terminal: { complete: "manual", error: "manual" } });
  return { id };
}

export function switchMap(g, id, sourceId, project) {
  return mapOperator(g, id, sourceId, project, "switch", 1);
}

export function mergeMap(g, id, sourceId, project, { concurrent = Infinity } = {}) {
  if (concurrent !== Infinity && (!Number.isInteger(concurrent) || concurrent < 1)) {
    throw new RangeError(`mergeMap ${id}: concurrent must be a positive integer or Infinity`);
  }
  return mapOperator(g, id, sourceId, project, "merge", concurrent);
}
