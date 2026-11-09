// Checkpoint and restore over the reference kernel. Non-normative.
//
// Built 2026-11-08 (DS-17 O5: capture at a wave boundary, no pending-FIFO or receipt capture
// in the kernel). Built first without a kernel seed (git b6468e6); that left an ended computed
// node coming back as a state and refused any graph where a node held an ended dependency. The
// same day the user had the optional seed (H4) added to the kernel and P5 relaxed, so a node
// can be activated over an ended dependency.
//
// A node is restorable when it is built through `recipes(g, registry)`: a state, or a computed
// node whose fn is `registry[ref](config)`. Function bodies are never saved (R-snapshot). Any
// other node, or a recipe node whose dependencies were changed since (by rewire or replace), is
// saved as local-only, and restoring a local-only node fails.
//
// capture() runs at a wave boundary only and saves, per node, what the kernel holds: a state's
// value and terminal; a computed node's value, terminal, private state and the input it received
// from each dependency, if it had a lifetime (an inactive computed node holds nothing, K7).
//
// restore(checkpoint, registry) builds a new graph with no subscribers, as TS's restoreGraph,
// and runs no fn: each saved computed node gets its value, terminal and private state as a
// kernel seed. On its first activation the real fn does not run, unless a dependency's value or
// terminal differs from what the node had received (an upstream change before the first
// subscription). Then the real fn runs once, with only the changed dependencies as input, as a
// live wave would have had them (C-38, R-input-receipts; TS keeps the restored value instead).

import { isDeepStrictEqual } from "node:util";
import { createGraph } from "../kernel/kernel.mjs";

const json = (v, where) => {
  const text = JSON.stringify(v);
  if (text === undefined || !isDeepStrictEqual(JSON.parse(text), v)) throw new TypeError(`checkpoint: ${where} is not JSON`);
  return v;
};

const sameInput = (d, saved) => d.has === saved.has && (!d.has || isDeepStrictEqual(d.value, saved.value))
  && isDeepStrictEqual(d.terminal, saved.ended);

export function recipes(g, registry) {
  // id -> { deps, ref, config, opts } and, until the node's first activation, `entry`: its
  // checkpoint entry, whose saved inputs that activation compares.
  const made = new Map();
  const lookup = (ref) => {
    if (typeof registry[ref] !== "function") throw new Error(`restore: no recipe ${ref}`);
    return registry[ref];
  };

  function restorable(rec, real) {
    return (ctx) => {
      const saved = rec.entry?.saved;
      rec.entry = null;
      if (!saved) { real(ctx); return; }
      const changed = ctx.deps.map((d, i) => !sameInput(d, saved.inputs[i]));
      if (!changed.some(Boolean)) return; // the seed already holds the value and private state
      const deps = ctx.deps.map((d, i) => (changed[i] ? d : { ...d, waves: [], terminal: null }));
      real(Object.create(ctx, { deps: { value: deps } }));
    };
  }

  function addState(id, initial) {
    g.state(id, initial);
    made.set(id, { deps: [] });
    return id;
  }

  function addNode(id, deps, rec, seed) {
    g.node(id, deps, restorable(rec, lookup(rec.ref)(rec.config)), { ...rec.opts, ...(seed && { seed }) });
    made.set(id, rec);
    return id;
  }

  function live(id, kind, deps) {
    const { active, has, value, ended } = g.get(id);
    if (kind === "state") return { has, ...(has && { value }), ended };
    if (!active && !ended) return null; // no lifetime, nothing held
    const state = g.privateState(id);
    return {
      has, ...(has && { value }), ended, ...(state !== undefined && { state }),
      // What it received from each dependency: at a wave boundary, the dependency's value.
      inputs: deps.map((d) => { const x = g.get(d); return { has: x.has, ...(x.has && { value: x.value }), ended: x.ended }; }),
    };
  }

  return {
    g,
    state: addState,
    node(id, deps, ref, config, opts) {
      return addNode(id, deps, { deps: [...deps], ref, config: json(config ?? null, `${id} config`), opts: json(opts ?? {}, `${id} opts`) });
    },
    capture() {
      if (!g.idle()) throw new Error("capture: a wave or batch is running; capture at a wave boundary (O5)");
      return { nodes: g.describe().map(({ id, kind, deps }) => {
        const rec = made.get(id);
        if (!rec || !isDeepStrictEqual(rec.deps, deps)) return { id, kind, deps, local: true };
        if (rec.entry) return rec.entry; // restored, not activated since
        const saved = live(id, kind, deps);
        return json({ id, kind, deps, ...(kind === "node" && { ref: rec.ref, config: rec.config, opts: rec.opts }), ...(saved && { saved }) }, `node ${id}`);
      }) };
    },
    // Builds one checkpoint entry into this graph (restore calls it in checkpoint order).
    put(n) {
      if (n.local) throw new Error(`restore: ${n.id} is local-only (no recipe, or rewired since it was built)`);
      const { saved } = n;
      if (n.kind === "state") {
        addState(n.id, saved?.has ? saved.value : undefined);
        if (saved?.ended) g[saved.ended[0] === "COMPLETE" ? "complete" : "error"](n.id, saved.ended[1]);
        return n.id;
      }
      const rec = { deps: [...n.deps], ref: n.ref, config: n.config, opts: n.opts, entry: saved ? n : null };
      return addNode(n.id, n.deps, rec, saved && { ...(saved.has && { value: saved.value }), ended: saved.ended, state: saved.state });
    },
  };
}

// In checkpoint order, which is creation order: a restorable node's dependencies existed when it
// was built (P1) and cannot have changed since, so they come first.
export function restore(checkpoint, registry, graphOptions) {
  const b = recipes(createGraph(graphOptions), registry);
  for (const n of checkpoint.nodes) b.put(n);
  return b;
}
