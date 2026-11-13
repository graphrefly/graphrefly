import { assertLocalName } from "../kernel/kernel.mjs";

import { withDependencies } from "./context.mjs";

// Demand (PULL) as a module over the reference kernel (DS-17 O2, R-pull). Non-normative.
//
// A pullable holder `id` sits after an input and stays quiet until it is pulled: input
// that arrives is held, and nothing reaches the holder's subscribers, not even PENDING.
// `pull(params)`, a method of the returned bundle, asks for one service: the holder's
// function runs once with everything held since the last INVALIDATE and with the
// params, and what it sends goes out as a later wave. It runs even when nothing changed.
//
// The request travels through a declared control pair, as pause does (O8): `pull` writes
// the state node `${id}/demand`, a real edge into the bundle. No class-1 message
// and no upward routing are needed, so no kernel change either.
//
// Nodes, created once by pullable():
//   inputId ──► id          id/demand ──► id
// One quiet node with the manual INVALIDATE policy (K6, 2026-11-09): the input's INVALIDATE
// is its function's input, so it drops what it held and sends INVALIDATE itself, which goes
// out as a later wave, like all of a quiet node's output. Until then a second node, a log
// that published its queue as a value to learn of every INVALIDATE, sat before the holder.
//
// Rules from R-pull@2 and how they hold here:
//   - A pull while the holder is inactive does nothing: it neither activates the holder
//     nor is kept for later. (The demand state keeps its value, so on activation the log
//     records the request already there as seen and serves only later ones.)
//   - Several pulls before one service keep only the latest params (a batch of pulls is
//     one wave; the log serves the newest request in it).
//   - The holder runs only at actual service; what it sends is ordinary output.
// Difference from TS: a new subscriber gets the holder's last served value in its START,
// since the kernel puts the retained value in every START; a TS pull node gives START
// only.


// The holder: holds the input's arrays since the last INVALIDATE; on a fresh request runs the
// author's function once with ctx.deps[0] showing the held arrays and ctx.pull.params.
const holder = (serve) => (ctx) => {
  const [input, demand] = ctx.deps;
  const st = ctx.state.get();
  let queue = st.queue;
  if (input.invalidated) {
    queue = [];
    ctx.down([["INVALIDATE"]]);
  }
  if (input.terminal?.[0] === "COMPLETE") {
    ctx.state.set({ queue: [], seen: st.seen });
    ctx.down([["COMPLETE"]]);
    return;
  }
  queue = [...queue, ...input.waves.filter((w) => w.length)];
  const request = demand.waves.flat().filter((r) => r.seq > st.seen).at(-1);
  if (!request) { ctx.state.set({ queue, seen: st.seen }); return; }
  ctx.state.set({ queue: [], seen: request.seq });
  const view = withDependencies(ctx, [{ id: input.id, waves: queue, terminal: null, has: input.has, value: input.value, invalidated: false }]);
  view.pull = { params: request.params };
  serve(view);
};

// At each activation, restored ones included, a request already in the demand state is old: the
// setup records it as seen before the first run (moved there on 2026-11-10, when the second
// reviews found that a restored holder, whose private state came back, served a pull made while it
// was inactive).
const holderSetup = (ctx) => {
  const demand = ctx.deps[1];
  const st = ctx.state.get() ?? { queue: [], seen: 0 };
  ctx.state.set({ ...st, seen: demand.has ? demand.value.seq : 0 });
};

// `serve` is the holder's service function. With `recipe`, a recipe { ref, config } that builds
// it, the holder carries its own recipe and a checkpoint can restore it (F6, 2026-11-10);
// demandRecipes goes in the restore's registry. After a restore, pullableOf(g, id) gives the handle.
export function pullable(g, id, inputId, serve, { recipe } = {}) {
  assertLocalName(id);
  const demandId = `${id}/demand`;
  g.state(demandId); // no value until the first pull
  // The demand state never completes; only the input ends the holder, hence manual complete.
  g.node(id, [inputId, demandId], holder(serve), {
    quiet: true, terminal: { complete: "manual" }, invalidate: "manual", setup: holderSetup,
    ...(recipe && { recipe: { ref: "demand.holder", config: { serve: recipe } } }),
  });
  return pullableOf(g, id);
}

export function pullableOf(g, id) {
  const demandId = `${id}/demand`;
  return {
    id,
    demandId,
    // The request number is part of the state's value, not a counter in this closure, so it goes
    // on after a restore (a set with a function, 2026-11-10).
    pull(params) { g.set(demandId, (prev) => Object.freeze({ seq: (prev?.seq ?? 0) + 1, params })); },
  };
}

export const demandRecipes = Object.freeze({
  "demand.holder": ({ serve }, { make }) => ({ fn: holder(make(serve.ref, serve.config).fn), setup: holderSetup }),
});
