// switchMap and mergeMap over the reference kernel's rewire. Non-normative.
//
// One operator, as TS's mapOperator (higher-order.ts, D47/D81). Built 2026-11-08: switchMap
// first as an owner with a replaced inner, mergeMap first on replace (git 75ee4c8), then
// mergeMap on rewire (79026f7); merged here once both fitted the same shape.
//
//   sourceId ──► id ◄── id/inner0, id/inner1, ... ◄── (each projected inner's dependencies)
//
// `id` depends on the source and on every live inner and forwards the inners' values. It
// completes once the source has completed and no inner is live, and ends with ERROR on a
// source or inner ERROR or a throwing projector, after the inner values it forwarded in that
// wave. A change of the inner set is one ctx.rewire, asked for during the wave and run after it
// (K8), as TS's rewireNext is drained at the boundary; an added inner's value arrives as an
// ordinary input wave. Dependencies are read by id (ctx.deps[i].id).
//
// project(value) returns the inner's definition { deps, fn }; to follow a node X that already
// exists, project to { deps: [X], fn: relay }. Inner nodes sit at id/innerN, because the
// kernel cannot delete a node: a definition goes into a node with replace (a new node the
// first time). A projection with the same definition as a live inner keeps that inner (TS
// keeps an already live inner). A projection onto an ended node gives an inner that starts on
// its snapshot (P5): its last value, if any, then its end (TS's rewire refuses it instead).
//
// switch: the last source value of a wave is projected into id/inner0. Replacing that node
// closes the live inner's lifetime, so its late output is dropped and a dependency only it
// had is released: that is the cancellation.
// merge: every source value is projected, into the first node not live. `concurrent` bounds
// the live inners; further values wait, unprojected, until one completes (MergeMapOptions).

import { isDeepStrictEqual } from "node:util";

export const relay = (ctx) => {
  for (const w of ctx.deps[0].waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));
};

// A projected definition is { deps, fn, recipe? }; with a recipe { ref, config } the inner can be
// restored (F6, 2026-11-10), relay's being { ref: "higher.relay" }. Two definitions are the same
// when their deps are and their recipes are, or, without recipes, their functions are.
const sameDef = (a, b) => a.deps.length === b.deps.length && a.deps.every((d, i) => d === b.deps[i])
  && (a.recipe || b.recipe ? isDeepStrictEqual(a.recipe, b.recipe) : a.fn === b.fn);
// What the operator keeps of a definition in its private state: JSON when it has a recipe.
const kept = (def) => (def.recipe ? { deps: def.deps, recipe: def.recipe } : def);

function operator({ sourceId, mode, concurrent }, { g, id }, projectFn) {
  const bound = concurrent ?? Infinity; // JSON has no Infinity
  const inner = (k) => `${id}/inner${k}`;
  const exists = (nodeId) => g.describe().some((n) => n.id === nodeId);
  // Inner nodes sit at id/innerN; the kernel cannot delete a node, so a slot once made is
  // replaced. Which slots exist is read from the graph, not counted here, so it holds after a
  // restore too.
  const place = (k, def) => {
    const opts = def.recipe ? { recipe: def.recipe } : {};
    if (exists(inner(k))) g.replace(inner(k), def.deps, def.fn, opts); else g.node(inner(k), def.deps, def.fn, opts);
  };

  return (ctx) => {
    // inners: the live inners, as the last requested dependency list has them.
    const st = ctx.state.get() ?? { inners: [], queue: [], sourceDone: false };
    ctx.state.set(st);
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
    while (st.queue.length && (mode === "switch" || st.inners.length < bound)) {
      let next;
      try { next = projectFn(st.queue.shift()); } catch (e) { ctx.down([["ERROR", e instanceof Error ? e.message : e]]); return; }
      if (st.inners.some((x) => sameDef(x.def, next))) continue;
      let k = 0;
      if (mode === "merge") {
        // Not live. One that completed in this wave is still held; replacing it sends the
        // operator its new value, and the rewire below keeps it in place.
        const taken = new Set(st.inners.map((x) => x.node));
        while (taken.has(inner(k))) k += 1;
      }
      place(k, next);
      const added = { node: inner(k), def: kept(next) };
      st.inners = mode === "switch" ? [added] : [...st.inners, added];
      changed = true;
    }
    if (changed) ctx.rewire([sourceId, ...st.inners.map((x) => x.node)]);
    if (st.sourceDone && !st.inners.length) ctx.down([["COMPLETE"]]); // a waiting value implies a live inner
  };
}

// `project(value)` returns the inner's definition { deps, fn, recipe? }. With `recipe`, a recipe
// { ref, config } that builds the projector, the operator carries its own recipe and a checkpoint
// can restore it (F6, 2026-11-10); higherOrderRecipes goes in the restore's registry.
function mapOperator(g, id, sourceId, project, mode, concurrent, recipe) {
  const config = { sourceId, mode, concurrent: concurrent === Infinity ? null : concurrent };
  // A fresh activation starts with no inner, as TS's does: the rewire belongs to the lifetime
  // (F7, 2026-11-10), so the operator's dependencies go back to [sourceId] when it closes. Until
  // then a cleanup rewired the operator back.
  g.node(id, [sourceId], operator(config, { g, id }, project), {
    terminal: { complete: "manual", error: "manual" },
    ...(recipe && { recipe: { ref: "higher.map", config: { ...config, project: recipe } } }),
  });
  return { id };
}

export function switchMap(g, id, sourceId, project, { recipe } = {}) {
  return mapOperator(g, id, sourceId, project, "switch", 1, recipe);
}

export function mergeMap(g, id, sourceId, project, { concurrent = Infinity, recipe } = {}) {
  if (concurrent !== Infinity && (!Number.isInteger(concurrent) || concurrent < 1)) {
    throw new RangeError(`mergeMap ${id}: concurrent must be a positive integer or Infinity`);
  }
  return mapOperator(g, id, sourceId, project, "merge", concurrent, recipe);
}

export const higherOrderRecipes = Object.freeze({
  "higher.map": ({ project, ...config }, at) => operator(config, at, at.make(project.ref, project.config).fn),
  "higher.relay": () => relay,
});
