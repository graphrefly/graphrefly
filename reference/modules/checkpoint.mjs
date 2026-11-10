// Checkpoint and restore over the reference kernel. Non-normative.
//
// Built 2026-11-08 (DS-17 O5: capture at a wave boundary, no pending-FIFO or receipt capture
// in the kernel). Built first without a kernel seed (git b6468e6); that left an ended computed
// node coming back as a state and refused any graph where a node held an ended dependency. The
// same day the user had the optional seed (H4) added to the kernel and P5 relaxed, so a node
// can be activated over an ended dependency.
//
// A node is restorable when it is built through `recipes(g, registry)`: a state, or a computed
// node whose fn is `registry[ref](config)`, which returns the function or { fn, setup }.
// Function bodies are never saved (R-snapshot). Any
// other node, or a recipe node whose definition was changed since (its dependencies or its
// function, by rewire or replace), is saved as local-only, and restoring a local-only node fails.
// The function is compared with the kernel's definition(id), so a change made through any path
// is seen (C6, decided by the user 2026-11-10: a replace that kept the dependencies but changed
// the function used to restore as the old recipe).
//
// capture() runs at a wave boundary only and saves, per node, what the kernel holds: a state's
// last array's values and terminal; a computed node's values, terminal, private state and the input it received
// from each dependency, if it had a lifetime (an inactive computed node holds nothing, K7).
//
// restore(checkpoint, registry) builds a new graph with no subscribers, as TS's restoreGraph,
// and runs no fn: each saved computed node gets its value, terminal and private state as a
// kernel seed. On its first activation its setup runs, as at every activation (K7), so a timer
// source starts a new timer; the real fn runs once only when a dependency's value or terminal
// differs from what the node had received (an upstream change before the first subscription):
// a changed value comes with its snapshot arrays, an end alone without them (C-38,
// R-input-receipts; TS keeps the restored value instead). The run gets only the changed
// dependencies; a run that sends nothing keeps the saved value. Otherwise the real fn does not
// run. (From 2026-11-09 to 2026-11-10, A2 ran the fn of a node whose last run had registered a
// cleanup, so it would register it again; the per-lifetime setup replaced that.)
// Before the first subscription a restored node is inactive and receives no waves, so only the
// values and ends then are compared: an INVALIDATE followed by a write is seen as the write. A
// host that must not lose such an INVALIDATE subscribes before writing upstream (R-checkpoint).

import { isDeepStrictEqual } from "node:util";
import { createGraph } from "../kernel/kernel.mjs";

const json = (v, where) => {
  const text = JSON.stringify(v);
  if (text === undefined || !isDeepStrictEqual(JSON.parse(text), v)) throw new TypeError(`checkpoint: ${where} is not JSON`);
  return v;
};

// A dependency's snapshot is the values of its last array (R-subscription), which reach the
// first run as its one input array; the comparison is on all of them, not only the last value
// (fixed 2026-11-09 after a review found [1, 2] -> [3, 2] taken for unchanged).
const snapshotOf = (d) => (d.waves.length ? d.waves[d.waves.length - 1] : []);
const sameValue = (d, saved) => d.has === saved.has && (!d.has || isDeepStrictEqual(snapshotOf(d), saved.values));
const sameEnd = (d, saved) => isDeepStrictEqual(d.terminal, saved.ended);

export function recipes(g, registry) {
  // id -> { deps, ref, config, opts } and, until the node's first activation, `entry`: its
  // checkpoint entry, whose saved inputs that activation compares.
  const made = new Map();
  let bundle; // what this function returns; a recipe's factory gets it to reach the graph
  const lookup = (ref) => {
    if (typeof registry[ref] !== "function") throw new Error(`restore: no recipe ${ref}`);
    return registry[ref];
  };

  function restorable(rec, real) {
    return (ctx) => {
      const saved = rec.entry?.saved;
      rec.entry = null;
      if (!saved) { real(ctx); return; }
      // Per dependency, what it brings: a changed value comes with its snapshot arrays; an end
      // alone comes without them, since those values were already received; an unchanged
      // dependency brings nothing.
      let changed = false;
      const deps = ctx.deps.map((d, i) => {
        const was = saved.inputs[i];
        const value = !sameValue(d, was), end = !sameEnd(d, was);
        if (value || end) changed = true;
        return value ? d : { ...d, waves: [], terminal: end ? d.terminal : null };
      });
      // The seed holds the value and private state.
      if (changed) real(Object.create(ctx, { deps: { value: deps } }));
    };
  }

  function addState(id, initial) {
    g.state(id, initial);
    made.set(id, { deps: [] });
    return id;
  }

  // A factory gets its JSON config and { g, id }: the bundle, through which a function that
  // builds or replaces nodes keeps them restorable, and the node's id (2026-11-10, F6). It returns
  // the function or { fn, setup }.
  function build(id, rec) {
    const built = lookup(rec.ref)(rec.config, { g: bundle, id });
    return typeof built === "function" ? { fn: built } : built;
  }

  function addNode(id, deps, rec, seed) {
    const { fn, setup } = build(id, rec);
    rec.fn = restorable(rec, fn); // the function the kernel runs while the recipe's definition stands
    g.node(id, deps, rec.fn, { ...rec.opts, ...(setup && { setup }), ...(seed && { seed }) });
    made.set(id, rec);
    return id;
  }

  function live(id, kind, deps) {
    const { active, values, ended } = g.get(id);
    if (kind === "state") return { values, ended };
    if (!active && !ended) return null; // no lifetime, nothing held
    const state = g.privateState(id);
    return {
      values, ended, ...(state !== undefined && { state }),
      // What it received from each dependency: at a wave boundary, the dependency's value.
      inputs: deps.map((d) => { const x = g.get(d); return { has: x.has, ...(x.has && { values: x.values }), ended: x.ended }; }),
    };
  }

  bundle = {
    g,
    state: addState,
    node(id, deps, ref, config, opts) {
      return addNode(id, deps, { deps: [...deps], ref, config: json(config ?? null, `${id} config`), opts: json(opts ?? {}, `${id} opts`) });
    },
    // What a registered recipe builds, for a recipe that takes another one by reference, as
    // demand's holder takes its serve function (2026-11-10, F6).
    make(ref, config, id) { return build(id, { ref, config }); },
    // A replace that keeps the node restorable: the new definition is a recipe too, recorded
    // here when it is asked for (2026-11-10, F6). The node keeps its opts and setup (R-node).
    // A replace made on the kernel directly makes the node local-only (C6).
    replace(id, deps, ref, config) {
      const rec = made.get(id);
      if (!rec?.ref) throw new Error(`replace: ${id} was not built from a recipe`);
      const next = { ...rec, deps: [...deps], ref, config: json(config ?? null, `${id} config`), entry: null };
      next.fn = restorable(next, build(id, next).fn);
      made.set(id, next);
      g.replace(id, deps, next.fn);
      return id;
    },
    capture() {
      if (!g.idle()) throw new Error("capture: a wave or batch is running; capture at a wave boundary (O5)");
      return { nodes: g.describe().map(({ id, kind, deps: current }) => {
        const rec = made.get(id);
        // The definition is what the recipe built; `current` (from describe) is the lifetime's,
        // which a ctx.rewire may have changed (F7). It is saved with the lifetime's state and
        // given back as the first lifetime's dependencies (2026-11-10, F6).
        const { deps, fn } = g.definition(id);
        if (!rec || !isDeepStrictEqual(rec.deps, deps) || (kind === "node" && fn !== rec.fn)) return { id, kind, deps, local: true };
        if (rec.entry) return rec.entry; // restored, not activated since
        const saved = live(id, kind, current);
        if (saved && kind === "node" && !isDeepStrictEqual(current, deps)) saved.deps = current;
        return json({ id, kind, deps, ...(kind === "node" && { ref: rec.ref, config: rec.config, opts: rec.opts }), ...(saved && { saved }) }, `node ${id}`);
      }) };
    },
    // Builds one checkpoint entry into this graph (restore calls it in checkpoint order).
    put(n) {
      if (n.local) throw new Error(`restore: ${n.id} is local-only (no recipe, or its definition changed since it was built)`);
      const { saved } = n;
      if (n.kind === "state") {
        addState(n.id, undefined);
        // Its last array's values come back as one array (a batch), with no subscriber to see it.
        if (saved?.values.length) g.batch(() => saved.values.forEach((v) => g.set(n.id, v)));
        if (saved?.ended) g[saved.ended[0] === "COMPLETE" ? "complete" : "error"](n.id, saved.ended[1]);
        return n.id;
      }
      const rec = { deps: [...n.deps], ref: n.ref, config: n.config, opts: n.opts, entry: saved ? n : null };
      return addNode(n.id, n.deps, rec, saved && { values: saved.values, ended: saved.ended, state: saved.state, ...(saved.deps && { deps: saved.deps }) });
    },
  };
  return bundle;
}

// In checkpoint order, which is creation order: a restorable node's dependencies existed when it
// was built (P1) and cannot have changed since, so they come first.
export function restore(checkpoint, registry, graphOptions) {
  const b = recipes(createGraph(graphOptions), registry);
  for (const n of checkpoint.nodes) b.put(n);
  return b;
}
