// mergeMap over the reference kernel's replace, without a seed. Non-normative.
//
// Built 2026-11-08 to check the claim in REPLAY.md (decision 1) that mergeMap, with a
// varying number of inners, is the first case that needs a seed (H4). It is built here
// without one; what that costs is listed in modules/README.md.
//
//   sourceId ──► id/core ──► id          id/core's dependencies: [sourceId, id/inner/0, ...]
//                  ▲
//                  └── id/inner/k ◄── (each projected inner's dependencies)
//
// As TS's merge mode (mapOperator, D47/D81), id/core depends on the source and on every
// live inner, forwards the inners' values, completes once the source has completed and
// nothing is live or waiting, and ends with ERROR on a source or inner ERROR or a throwing
// projector. TS adds a dependency in place (rewireNext.subscribeDep). Here an inner is added
// by replacing id/core with one more dependency, and four things follow from that:
//   1. `id` is a fixed node that forwards id/core, so it keeps its value and its subscribers
//      see one START; a replaced node loses its value and sends its sinks a START.
//   2. id/core's state (live inners, waiting values, source done) is carried to the new
//      instance in its fn's closure. The new instance's first run receives every
//      dependency's START snapshot; all but the added inner's were handled already, so it
//      skips them.
//   3. One inner is added per replace. An activation keeps only the last value it sends
//      (K3), so two inners added at once would pass on one value.
//   4. Once the source has ended, a replace leaves it out: an ended node cannot be
//      acquired again (P5), and the replace would be refused.
// An inner that completes stays a dependency, doing nothing, until the next replace drops
// it; its own lifetime has closed, so what it used is already released. Inner nodes sit at
// id/inner/k and are reused once no instance holds them, because the kernel cannot
// delete a node.
//
// project(value) returns the inner's definition { deps, fn }, as in switchMap. A projection
// with the same definition as a live or waiting inner adds nothing (TS skips an already
// live inner). A projection onto an ended node is an ERROR. `concurrent` bounds the live
// inners; further source values wait, unprojected, until one completes (TS MergeMapOptions).

import { relay } from "./switch-map.mjs";

const manual = { terminal: { complete: "manual", error: "manual" } };
const sameDef = (a, b) => a.fn === b.fn && a.deps.length === b.deps.length && a.deps.every((d, i) => d === b.deps[i]);

export function mergeMap(g, id, sourceId, project, { concurrent = Infinity } = {}) {
  if (concurrent !== Infinity && (!Number.isInteger(concurrent) || concurrent < 1)) {
    throw new RangeError(`mergeMap ${id}: concurrent must be a positive integer or Infinity`);
  }
  const coreId = `${id}/core`;
  const slot = (k) => `${id}/inner/${k}`;
  let slots = 0; // inner nodes created so far
  // inners: the inners the current instance holds, in dependency order.
  // waiting: projected, not added yet. queue: source values over the concurrency bound.
  const fresh = () => ({ inners: [], waiting: [], queue: [], sourceDone: false, adding: false });

  // Requests the replace that adds the next waiting inner, unless one is on its way: that
  // one's first run adds the next, with dependencies that leave out what ended meanwhile.
  const addNext = (st) => {
    if (st.adding || !st.waiting.length) return;
    const def = st.waiting.shift();
    const held = new Set(st.inners.map((x) => x.slot));
    let k = 0;
    while (held.has(slot(k))) k += 1;
    if (k === slots) { g.node(slot(k), def.deps, def.fn); slots += 1; } else g.replace(slot(k), def.deps, def.fn);
    st.inners = [...st.inners.filter((x) => !x.done), { slot: slot(k), def, done: false }];
    st.adding = true;
    // A source that has ended cannot be acquired again (P5), so it is left out.
    const withSource = !st.sourceDone;
    const deps = [...(withSource ? [sourceId] : []), ...st.inners.map((x) => x.slot)];
    g.replace(coreId, deps, core(st, st.inners, withSource, true));
  };

  // mine: the inners this instance holds, after the source when withSource. A replaced
  // instance was created to add the last of them; a fresh core holds none.
  const core = (st, mine, withSource, replaced) => (ctx) => {
    const first = !ctx.state.get();
    ctx.state.set(true);
    if (first && replaced) st.adding = false;
    // A fresh activation starts with no inner, as TS's does. Not on a replace (the node
    // stays active) and not after the core has ended.
    ctx.onDeactivation(() => {
      const c = g.get(coreId);
      if (!c.active && !c.ended) g.replace(coreId, [sourceId], core(fresh(), [], true, false));
    });
    // null: a START snapshot the previous instance already handled.
    const deps = ctx.deps.map((d, i) => (first && replaced && i !== ctx.deps.length - 1 ? null : d));
    const [source, ...inners] = withSource ? deps : [null, ...deps];

    for (const d of inners) if (d) for (const w of d.waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));
    const error = deps.map((d) => d?.terminal).find((t) => t?.[0] === "ERROR");
    if (error) { ctx.down([error]); return; }
    inners.forEach((d, i) => { if (d?.terminal) mine[i].done = true; });
    if (source?.terminal) st.sourceDone = true;

    const live = () => st.inners.filter((x) => !x.done).length + st.waiting.length;
    const take = (v) => {
      let next;
      try { next = project(v); } catch (e) { return e instanceof Error ? e.message : e; }
      const ended = next.deps.find((d) => g.get(d).ended);
      if (ended) return `${id}: cannot follow ${ended}, which has ended`;
      if (![...st.inners.filter((x) => !x.done).map((x) => x.def), ...st.waiting].some((d) => sameDef(d, next))) st.waiting.push(next);
      return null;
    };
    for (const v of source?.waves.flat() ?? []) st.queue.push(v);
    while (st.queue.length && live() < concurrent) {
      const failure = take(st.queue.shift());
      if (failure !== null) { ctx.down([["ERROR", failure]]); return; }
    }
    addNext(st);
    if (st.sourceDone && !live() && !st.queue.length) ctx.down([["COMPLETE"]]); // live counts an inner being added
  };

  g.node(coreId, [sourceId], core(fresh(), [], true, false), manual);
  g.node(id, [coreId], (ctx) => {
    relay(ctx);
    if (ctx.deps[0].terminal) ctx.down([ctx.deps[0].terminal]);
  }, manual);
  return { id, coreId };
}
