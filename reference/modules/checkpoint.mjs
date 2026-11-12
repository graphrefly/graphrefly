// Checkpoint and restore over the reference kernel. Non-normative.
//
// Built 2026-11-08 (DS-17 O5: capture at a wave boundary, no pending-FIFO or receipt capture
// in the kernel); the seed (H4) and the P5 relaxation came the same day, for restore.
//
// Reshaped on 2026-11-10 after the second reviews (the user's choice): checkpoint is two
// functions over an ordinary graph, capture(g) and restore(checkpoint, registry). It keeps no
// record of its own. A node is restorable when its definition carries a recipe, `{ ref, config }`
// with a JSON config, given as the node option `recipe` (and to replace, for a new instance); the
// kernel stores it and never reads it, as TS's node option `restore` is. Function bodies are never
// saved (R-checkpoint). A node whose definition has no recipe is local-only, and restoring it fails:
// a node built without one, or replaced without one (C6). A node rewired for its lifetime (F7) is
// restorable: its lifetime's dependencies are saved with the rest of its lifetime.
//
// capture(g) runs at a wave boundary only and saves, per node in creation order, what the kernel
// holds: a state's last array's values and terminal; a computed node's recipe, policies, values,
// terminal, private state, what it received from each dependency and, when a ctx.rewire changed
// them, its lifetime's dependencies, if it had a lifetime (an inactive computed node holds nothing,
// K7; a restored node not activated yet holds its seed, which is saved again as it is).
//
// restore(checkpoint, registry) builds a new graph with no subscribers, as TS's restoreGraph, each
// node after its declared dependencies (a replace may have moved a dependency after its node), and
// runs no fn. A factory is called as registry[ref](config, { g, id, make }), where make(ref, config)
// builds another registered recipe, for one that takes another by reference (demand's serve, a
// higher-order projector, a restart's inner). Each saved computed node gets its values, terminal,
// private state and lifetime dependencies as a kernel seed, whose note holds what it had received.
// On its first activation its setup runs, as at every activation (K7), so a timer source starts a
// new timer; the real fn runs once only when a dependency's value or terminal differs from what the
// node had received (an upstream change before the first subscription): a changed value comes with
// its snapshot arrays, an end alone without them (C-38; TS keeps the restored value instead). The
// run gets only the changed dependencies; a run that sends nothing keeps the saved value. The note
// reaches only the seeded instance's first run (ctx.seed), so a later instance, such as a restart's
// renewal of an ended inner, runs as usual. Before the first subscription a restored node is
// inactive and receives no waves, so only the values and ends then are compared: an INVALIDATE
// followed by a write is seen as the write. A host that must not lose such an INVALIDATE
// subscribes before writing upstream (R-checkpoint).

import { isDeepStrictEqual } from "node:util";
import { createGraph } from "../kernel/kernel.mjs";
import { withDependencies } from "./context.mjs";

const notRestorable = (id, reason) => new Error(`not restorable: ${id}: ${reason}`);
const json = (v, id, reason) => {
  try {
    const text = JSON.stringify(v);
    if (text !== undefined && isDeepStrictEqual(JSON.parse(text), v)) return v;
  } catch { /* cyclic values and throwing codecs are not JSON values */ }
  throw notRestorable(id, reason);
};
const validateSaved = (id, saved) => {
  if (!saved) return;
  json(saved.values, id, "its retained values are not JSON");
  if (saved.state !== undefined) json(saved.state, id, "its private state is not JSON");
  if (saved.ended?.[0] === "ERROR") json(saved.ended[1], id, "its ERROR payload is not JSON");
  for (const input of saved.inputs ?? []) {
    if (input.has) json(input.values, id, "its received values are not JSON");
    if (input.ended?.[0] === "ERROR") json(input.ended[1], id, "its ERROR payload is not JSON");
  }
};

// A dependency's snapshot is the values of its last array (R-subscription), which reach the
// first run as its one input array; the comparison is on all of them, not only the last value
// (fixed 2026-11-09 after a review found [1, 2] -> [3, 2] taken for unchanged).
const snapshotOf = (d) => (d.waves.length ? d.waves[d.waves.length - 1] : []);
const sameValue = (d, saved) => d.has === saved.has && (!d.has || isDeepStrictEqual(snapshotOf(d), saved.values));
const sameEnd = (d, saved) => isDeepStrictEqual(d.terminal, saved.ended);

// What a node received from each dependency: at a wave boundary, the dependency's value.
const receivedFrom = (g, deps) => deps.map((d) => {
  const x = g.get(d);
  return { has: x.has, ...(x.has && { values: x.values }), ended: x.ended };
});

export function capture(g) {
  if (!g.idle()) throw new Error("capture: a wave or batch is running; capture at a wave boundary (O5)");
  const checkpoint = { nodes: g.describe().map(({ id, kind, deps: current }) => {
    const def = g.definition(id);
    const x = g.get(id);
    validateSaved(id, { values: x.values, ended: x.ended, state: g.privateState(id) });
    if (kind === "state") return { id, kind, deps: [], saved: { values: x.values, ended: x.ended } };
    if (def.recipe) json(def.recipe.config ?? null, id, "its recipe config is not JSON");
    const entry = { id, kind, deps: def.deps, recipe: def.recipe, opts: def.opts };
    let saved = null;
    if (x.seed) {
      // Restored and not run since: what it holds is its seed, saved again as it is.
      saved = { values: x.values, ended: x.ended, ...x.seed };
      const state = g.privateState(id);
      if (state !== undefined) saved.state = state;
    } else if (x.active || x.ended) {
      const state = g.privateState(id);
      saved = {
        values: x.values, ended: x.ended, ...(state !== undefined && { state }),
        inputs: receivedFrom(g, current),
        // A ctx.rewire's dependencies belong to the lifetime (F7) and come back with it.
        ...(!isDeepStrictEqual(current, def.deps) && { deps: current }),
      };
    }
    validateSaved(id, saved);
    if (!def.recipe) return { id, kind, deps: def.deps, local: true };
    // Explicit null distinguishes a cold node from a truncated lifetime record.
    return { ...entry, saved };
  }) };
  return JSON.parse(JSON.stringify(checkpoint));
}

// The function a restored node runs: on the seeded instance's first run (ctx.seed), it compares
// each dependency with what the node had received and runs the real function only on a change,
// with only the changed dependencies; on any other run it is the real function.
function restorable(real) {
  return (ctx) => {
    const note = ctx.seed;
    if (!note) { real(ctx); return; }
    // Per dependency, what it brings: a changed value comes with its snapshot arrays; an end
    // alone comes without them, since those values were already received; an unchanged
    // dependency brings nothing.
    let changed = false;
    const deps = ctx.deps.map((d, i) => {
      const was = note.inputs[i];
      const value = !sameValue(d, was), end = !sameEnd(d, was);
      if (value || end) changed = true;
      return value ? d : { ...d, waves: [], terminal: end ? d.terminal : null };
    });
    // The seed holds the value and private state.
    if (changed) real(withDependencies(ctx, deps));
  };
}

// Each node after its declared dependencies, otherwise in checkpoint order: a replace may have
// given a node a dependency made after it (found by the second reviews, 2026-11-10).
function buildOrder(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const done = new Set(), order = [];
  const visit = (n, path) => {
    if (done.has(n.id)) return;
    if (path.has(n.id)) throw new Error(`restore: ${n.id} depends on itself`);
    path.add(n.id);
    for (const d of n.deps) {
      if (!byId.has(d)) throw new Error(`restore: ${n.id} depends on ${d}, which is not in the checkpoint`);
      visit(byId.get(d), path);
    }
    path.delete(n.id);
    done.add(n.id);
    order.push(n);
  };
  for (const n of nodes) visit(n, new Set());
  return order;
}

export function restore(checkpoint, registry, graphOptions) {
  const g = createGraph(graphOptions);
  const lookup = (ref, id) => {
    if (typeof registry[ref] !== "function") throw notRestorable(id, "missing recipe");
    return registry[ref];
  };
  const make = (ref, config, id) => {
    const built = lookup(ref, id)(config ?? null, { g, id, make: (ref, config) => make(ref, config, id) });
    return typeof built === "function" ? { fn: built } : built;
  };
  for (const n of checkpoint.nodes) if (n.local) throw notRestorable(n.id, "local-only, built or replaced without a recipe");
  // A checkpoint that lacks what R-checkpoint saves, such as one written to an earlier format
  // without what each node had received, is refused rather than completed from its dependencies'
  // saved values, which a replace of a dependency would make wrong (D802, 2026-11-10).
  for (const n of checkpoint.nodes) {
    const s = n.saved;
    if (n.kind === "state") { validateSaved(n.id, s); continue; }
    if (!Object.hasOwn(n, "saved")) throw notRestorable(n.id, "missing received records");
    if (!n.recipe) throw notRestorable(n.id, "missing recipe");
    json(n.recipe.config ?? null, n.id, "its recipe config is not JSON");
    if (!s || s.ended) { validateSaved(n.id, s); continue; }
    const deps = s.deps ?? n.deps;
    if (!Array.isArray(s.inputs) || s.inputs.length !== deps.length || s.inputs.some((input) =>
      !input || typeof input.has !== "boolean" || !Object.hasOwn(input, "ended") ||
      (input.ended !== null && (!Array.isArray(input.ended) ||
        !["COMPLETE", "ERROR"].includes(input.ended[0]) ||
        input.ended.length !== (input.ended[0] === "ERROR" ? 2 : 1))) ||
      (input.has && (!Array.isArray(input.values) || !input.values.length)))) {
      throw notRestorable(n.id, "missing received records");
    }
    validateSaved(n.id, s);
  }
  // Neither the source graph nor the restored graph may mutate this checkpoint.
  checkpoint = JSON.parse(JSON.stringify(checkpoint));
  for (const n of buildOrder(checkpoint.nodes)) {
    const { saved } = n;
    if (n.kind === "state") {
      g.state(n.id);
      // Its last array's values come back as one array (a batch), with no subscriber to see it.
      if (saved?.values.length) g.batch(() => saved.values.forEach((v) => g.set(n.id, v)));
      if (saved?.ended) g[saved.ended[0] === "COMPLETE" ? "complete" : "error"](n.id, saved.ended[1]);
      continue;
    }
    const { fn, setup } = make(n.recipe.ref, n.recipe.config, n.id);
    const seed = saved && {
      values: saved.values, ended: saved.ended, state: saved.state, ...(saved.deps && { deps: saved.deps }),
      // An ended node never runs again, so it gets no note to compare with.
      ...(!saved.ended && { note: { inputs: saved.inputs, ...(saved.deps && { deps: saved.deps }) } }),
    };
    g.node(n.id, n.deps, saved ? restorable(fn) : fn, { ...n.opts, recipe: n.recipe, ...(setup && { setup }), ...(seed && { seed }) });
  }
  return g;
}
