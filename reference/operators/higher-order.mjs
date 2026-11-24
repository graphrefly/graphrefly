// switchMap, mergeMap, concatMap and exhaustMap over the reference kernel, written from their
// contracts (operators/contracts.jsonl, O-switchMap, O-mergeMap, O-concatMap, O-exhaustMap;
// graphrefly:D813). Non-normative.
//
// One function in four modes, as reference/modules/higher-order.mjs had switch and merge since
// 2026-11-08; that module is now built on this file, which imports nothing of the checkout, so
// higher-order.mutants.test.mjs can load edited copies of it.
//
//   outer ──► id ◄── id/inner, id/inner1, ... ◄── (each projected inner's dependencies)
//
// `id` depends on the outer and on every inner it holds, and sends the inners' DATA. project(value)
// returns the inner's definition { deps, fn, recipe? }; to follow a node X that exists, it returns
// { deps: [X], fn: relay }. An inner sits at id/innerN, since the kernel cannot delete a node: a
// definition goes into a node with replace (a new node the first time). A change of the held
// inners is one ctx.rewire, asked for in the run and made after the wave (R-request-order), so
// what an inner holds when it is attached arrives as a wave of its own.
//
//   switch   holds the inner of the latest outer value. The new selection is applied first: what
//            the inner it supersedes delivers in that wave, DATA or ERROR, is not sent; its
//            INVALIDATE still retracts. An outer INVALIDATE releases the selection, also one that
//            came while the graph was saved (the user, 2026-11-23, as of a restored pausable). A
//            value that projects to the definition held supersedes nothing.
//   merge    holds up to `capacity` inners; further outer values wait in order, unprojected.
//   concat   merge with a capacity of one.
//   exhaust  holds one inner and drops the outer values that arrive while it does.
//
// In a run the held inners' DATA goes out first and the slots of those that ended are freed; then
// outer values are admitted. After the outer's COMPLETE the operator ends when it holds no inner,
// which also means that no value waits. An ERROR of the outer or of a held inner ends it without
// that wave's DATA and without calling project (O-common). A switch is the one exception to the
// last: in the wave of its selected inner's ERROR it calls project for the last outer value, since
// only the result says whether that inner is superseded, and a superseded inner's ERROR is not
// sent. A throw from project, or a result the kernel refuses to build, is a throw of the function
// (R-failure).
//
// Policies: manual COMPLETE, since an inner's COMPLETE frees a slot and the outer's alone ends
// nothing; manual ERROR, since a superseded inner's ERROR is not the operator's; manual
// INVALIDATE, since an outer INVALIDATE releases a switch's selection. Every input's INVALIDATE
// retracts the output, as the auto policy would, but in a run in which project throws: what a run
// that throws had sent is dropped, an INVALIDATE under the manual policy included (R-failure).

export const relay = (ctx) => {
  for (const w of ctx.deps[0].waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Two definitions are the same when their deps are and their recipes are, or, without recipes,
// their functions are.
const sameDef = (a, b) => a.deps.length === b.deps.length && a.deps.every((d, i) => d === b.deps[i])
  && (a.recipe || b.recipe ? same(a.recipe ?? null, b.recipe ?? null) : a.fn === b.fn);
// What the operator keeps of a definition in its private state: JSON when it has a recipe.
const kept = (def) => (def.recipe ? { deps: def.deps, recipe: def.recipe } : def);
const errored = (d) => d.terminal?.[0] === "ERROR";

export const higherOrderPolicies = Object.freeze({ terminal: Object.freeze({ complete: "manual", error: "manual" }), invalidate: "manual" });

export function operator({ sourceId, mode, capacity }, { g, id }, projectFn) {
  const bound = mode === "merge" ? capacity ?? Infinity : 1; // JSON has no Infinity
  const inner = (k) => `${id}/inner${k || ""}`;
  const exists = (nodeId) => g.describe().some((n) => n.id === nodeId);
  // Which slots exist is read from the graph, not counted here, so it holds after a restore too.
  const place = (k, def) => {
    const opts = def.recipe ? { recipe: def.recipe } : {};
    if (exists(inner(k))) g.replace(inner(k), def.deps, def.fn, opts); else g.node(inner(k), def.deps, def.fn, opts);
  };

  return (ctx) => {
    // inners: the inners held, as the last requested dependency list has them. queue: the outer
    // values that wait, unprojected.
    const st = ctx.state.get() ?? { inners: [], queue: [], sourceDone: false };
    const source = ctx.deps.find((d) => d.id === sourceId);
    let inners = st.inners, queue = st.queue, changed = false;
    const values = source.waves.flat();

    if (ctx.deps.some((d) => d.invalidated)) ctx.down([["INVALIDATE"]]);
    if (errored(source)) { ctx.down([source.terminal]); return; }

    // switch: the selection is settled before anything of the held inner is sent.
    let selected = null;
    if (mode === "switch") {
      // A restored switch's first run (ctx.seed): an outer that holds no value now was invalidated
      // while the graph was saved, which releases the selection too. The output stays (R-checkpoint).
      if (source.invalidated || (ctx.seed !== undefined && !source.has)) { changed = inners.length > 0; inners = []; }
      if (values.length) {
        const next = projectFn(values[values.length - 1]);
        if (!inners.some((x) => sameDef(x.def, next))) selected = next;
      }
      if (selected) inners = [];
    }

    // The held inners, in the order they were accepted: an ERROR ends the operator, DATA goes
    // out, and one that ended frees its slot.
    const held = inners.map((x) => ctx.deps.find((d) => d.id === x.node)).filter(Boolean);
    const error = held.find(errored)?.terminal;
    if (error) { ctx.down([error]); return; }
    for (const d of held) for (const w of d.waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));
    const ended = new Set(held.filter((d) => d.terminal).map((d) => d.id));
    if (ended.size) { inners = inners.filter((x) => !ended.has(x.node)); changed = true; }

    if (selected) {
      place(0, selected);
      inners = [{ node: inner(0), def: kept(selected) }];
      changed = true;
    } else if (mode === "exhaust") {
      if (!inners.length && values.length) queue = [values[0]];
    } else if (mode !== "switch") {
      queue = [...queue, ...values];
    }
    while (queue.length && inners.length < bound) {
      const next = projectFn(queue[0]);
      queue = queue.slice(1);
      if (inners.some((x) => sameDef(x.def, next))) continue;
      // The first slot not held. One whose inner ended in this wave is free; replacing it sends
      // the operator its new value, and the rewire below keeps it in place.
      const taken = new Set(inners.map((x) => x.node));
      let k = 0;
      while (taken.has(inner(k))) k += 1;
      place(k, next);
      inners = [...inners, { node: inner(k), def: kept(next) }];
      changed = true;
    }

    const sourceDone = st.sourceDone || source.terminal !== null;
    ctx.state.set({ inners, queue, sourceDone });
    if (changed) ctx.rewire([sourceId, ...inners.map((x) => x.node)]);
    if (sourceDone && !inners.length) ctx.down([["COMPLETE"]]); // a waiting value implies a held inner
  };
}

// `project(value)` returns the inner's definition { deps, fn, recipe? }. With `recipe`, a recipe
// { ref, config } that builds the projector, the operator carries its own recipe and a checkpoint
// can restore it; higherOrderRecipes goes in the restore's registry.
function build(g, id, sourceId, project, mode, capacity, recipe) {
  const config = { sourceId, mode, capacity };
  // A fresh activation starts with no inner: the rewire belongs to the lifetime (R-lifetime), so
  // the operator's dependencies go back to [sourceId] when it closes.
  g.node(id, [sourceId], operator(config, { g, id }, project), {
    ...higherOrderPolicies,
    ...(recipe && { recipe: { ref: "higher.map", config: { ...config, project: recipe } } }),
  });
  return { id };
}

export function switchMap(g, id, sourceId, project, { recipe } = {}) {
  return build(g, id, sourceId, project, "switch", null, recipe);
}

export function mergeMap(g, id, sourceId, project, { capacity = Infinity, recipe } = {}) {
  if (capacity !== Infinity && (!Number.isInteger(capacity) || capacity < 1)) {
    throw new RangeError(`mergeMap ${id}: its capacity is a positive integer or Infinity`);
  }
  return build(g, id, sourceId, project, "merge", capacity === Infinity ? null : capacity, recipe);
}

export function concatMap(g, id, sourceId, project, { recipe } = {}) {
  return build(g, id, sourceId, project, "merge", 1, recipe);
}

export function exhaustMap(g, id, sourceId, project, { recipe } = {}) {
  return build(g, id, sourceId, project, "exhaust", null, recipe);
}

export const higherOrderRecipes = Object.freeze({
  "higher.map": ({ project, ...config }, at) => operator(config, at, at.make(project.ref, project.config).fn),
  "higher.relay": () => relay,
});
