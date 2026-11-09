// Checkpoint and restore over the reference kernel, without a kernel seed (H4). Non-normative.
//
// Built 2026-11-08 (DS-17 O5: capture at a wave boundary, no pending-FIFO or receipt capture
// in the kernel). The user chose to do it in the module only, to test whether H4 is needed.
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
// and runs no fn. A saved lifetime of a node that has not ended is put back when the node is
// first activated, by a wrapper around its fn (K3: activation output only sets the retained
// value): the private state is set and the saved value sent, and the real fn does not run,
// unless a dependency's value differs from what the node had received (an upstream
// change before the first subscription). Then the real fn runs once, with only the changed
// dependencies as input, as a live wave would have had them (C-38, R-input-receipts). Every
// later run is the real fn's.
//
// Without a seed the kernel cannot create an ended computed node with its dependencies, so an
// ended node comes back as an ended state with its value: it never runs again and nothing can
// acquire it (P5), as before, but describe() shows it as a state with no dependencies. For the
// same reason (P5) a graph where a node that has not ended holds an ended dependency is refused
// at capture: the restored node could not acquire it.

import { isDeepStrictEqual } from "node:util";
import { createGraph } from "../kernel/kernel.mjs";

const json = (v, where) => {
  const text = JSON.stringify(v);
  if (text === undefined || !isDeepStrictEqual(JSON.parse(text), v)) throw new TypeError(`checkpoint: ${where} is not JSON`);
  return v;
};

// A terminal cannot differ: no saved input has ended (refused at capture), and an input that
// ended since cannot be acquired (P5).
const sameInput = (d, saved) => d.has === saved.has && (!d.has || isDeepStrictEqual(d.value, saved.value));

export function recipes(g, registry) {
  // id -> { kind, deps, ref, config, opts } and, until the node's first activation puts it
  // back, `entry`: its checkpoint entry. An ended node keeps its entry for good.
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
      ctx.state.set(saved.state);
      if (saved.has) ctx.down([["DATA", saved.value]]);
      const changed = ctx.deps.map((d, i) => !sameInput(d, saved.inputs[i]));
      if (!changed.some(Boolean)) return;
      const deps = ctx.deps.map((d, i) => (changed[i] ? d : { ...d, waves: [] }));
      real(Object.create(ctx, { deps: { value: deps } }));
    };
  }

  function live(id, kind, deps) {
    const { active, has, value, ended } = g.get(id);
    if (kind === "state") return { has, ...(has && { value }), ended };
    if (!active && !ended) return null; // no lifetime, nothing held
    const held = !ended && deps.find((d) => g.get(d).ended);
    if (held) throw new Error(`capture: ${id} holds ${held}, which has ended; a restored ${id} could not acquire it (P5)`);
    const state = g.privateState(id);
    return {
      has, ...(has && { value }), ended, ...(state !== undefined && { state }),
      // What it received from each dependency: at a wave boundary, the dependency's value.
      inputs: deps.map((d) => { const x = g.get(d); return { has: x.has, ...(x.has && { value: x.value }) }; }),
    };
  }

  return {
    g,
    state(id, initial) {
      g.state(id, initial);
      made.set(id, { kind: "state", deps: [] });
      return id;
    },
    node(id, deps, ref, config, opts) {
      const rec = { kind: "node", deps: [...deps], ref, config: json(config ?? null, `${id} config`), opts: json(opts ?? {}, `${id} opts`) };
      g.node(id, deps, restorable(rec, lookup(ref)(rec.config)), rec.opts);
      made.set(id, rec);
      return id;
    },
    capture() {
      if (!g.idle()) throw new Error("capture: a wave or batch is running; capture at a wave boundary (O5)");
      return { nodes: g.describe().map(({ id, kind, deps }) => {
        const rec = made.get(id);
        if (rec?.entry?.saved?.ended) return rec.entry; // an ended node, restored as a state
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
      if (n.kind === "state" || saved?.ended) {
        g.state(n.id, saved?.has ? saved.value : undefined);
        if (saved?.ended) g[saved.ended[0] === "COMPLETE" ? "complete" : "error"](n.id, saved.ended[1]);
        made.set(n.id, { kind: "state", deps: [], ...(saved?.ended && { entry: n }) });
        return n.id;
      }
      const rec = { kind: "node", deps: [...n.deps], ref: n.ref, config: n.config, opts: n.opts, entry: saved ? n : null };
      g.node(n.id, n.deps, restorable(rec, lookup(n.ref)(n.config)), n.opts);
      made.set(n.id, rec);
      return n.id;
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
