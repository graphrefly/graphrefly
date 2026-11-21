// merge, withLatestFrom, zip, concat and race over the reference kernel, written from their
// contracts (operators/contracts.jsonl, O-merge, O-withLatestFrom, O-zip, O-concat, O-race;
// graphrefly:D813). Non-normative.
//
// None takes a callback, so each node always carries a recipe; combineRecipes goes in a restore's
// registry. This file imports nothing, so combine.mutants.test.mjs can load edited copies of it.
//
//   merge           default policies, no private state: every input's arrays, inputs in declared
//                   order within a wave.
//   withLatestFrom  manual COMPLETE: the primary's ends it, a secondary's does not. No private
//                   state: a secondary's latest value is what the kernel holds of it, which an
//                   INVALIDATE of that secondary removes (R-invalidation).
//   zip             manual COMPLETE: it ends when an input that has ended has nothing queued. The
//                   queues are private state, which an INVALIDATE keeps. A run's tuples go in one
//                   array, the COMPLETE with them (graphrefly:D797 (9)). Manual ERROR: a DATA that
//                   completes zip's last tuple ends it, and an ERROR of that wave then reaches a
//                   zip that has ended (the user, 2026-11-20, as for take and takeUntil).
//   concat          depends on one source at a time and moves to the next, by ctx.rewire, when
//                   that one completes (manual COMPLETE). Which source it is at is private state.
//   race            depends on every input until one delivers DATA or a terminal, then on that one
//                   alone, by ctx.rewire. Manual COMPLETE and ERROR: before the selection a
//                   terminal selects its input, and in the selecting wave a loser's is not read.
//                   Manual INVALIDATE: the rewire waits behind requests already made
//                   (R-request-order), and until it runs a loser is still a dependency whose
//                   INVALIDATE must not retract what the selected input supplied.
//
// The inputs of each are distinct nodes: one given twice is refused when the operator is built
// (the user, 2026-11-20). The kernel takes a repeated dependency at creation and refuses it at a
// rewire, which made a race end with that refusal and a concat wait on itself for good.
//
// A rewire is a request, made after the wave (R-request-order); what the new dependency holds
// arrives as a wave of its own (R-wave). The lifetime's dependencies are saved by a checkpoint and
// go back to the declared ones when the lifetime closes (R-lifetime, R-checkpoint).

const occurrences = (d) => d.waves.flat();
const completed = (d) => d.terminal?.[0] === "COMPLETE";
const errored = (d) => d.terminal?.[0] === "ERROR";
const sendArrays = (ctx, d) => { for (const w of d.waves) if (w.length) ctx.down(w.map((v) => ["DATA", v])); };

function mergeFn(ctx) {
  for (const d of ctx.deps) sendArrays(ctx, d);
}

// Each array of the primary becomes one array of [value, ...latest of each secondary]; a primary
// DATA is dropped while a secondary has no value.
function withLatestFromFn(ctx) {
  const [primary, ...secondaries] = ctx.deps;
  if (secondaries.every((d) => d.has)) {
    for (const w of primary.waves) if (w.length) ctx.down(w.map((v) => ["DATA", [v, ...secondaries.map((d) => d.value)]]));
  }
  if (completed(primary)) ctx.down([["COMPLETE"]]);
}

function zipFn(ctx) {
  const state = ctx.state.get() ?? { queues: ctx.deps.map(() => []), done: ctx.deps.map(() => false) };
  const queues = state.queues.map((queue, i) => [...queue, ...occurrences(ctx.deps[i])]);
  const done = state.done.map((was, i) => was || completed(ctx.deps[i]));
  const out = [];
  while (queues.every((queue) => queue.length)) out.push(["DATA", queues.map((queue) => queue.shift())]);
  const ends = done.some((ended, i) => ended && !queues[i].length); // no tuple can form after that
  ctx.state.set({ queues, done });
  // An ERROR ends zip without this wave's tuples, unless a tuple of this wave ended zip first.
  const error = ctx.deps.find(errored)?.terminal;
  if (error && !(ends && out.length)) { ctx.down([error]); return; }
  if (ends) out.push(["COMPLETE"]);
  if (out.length) ctx.down(out);
}

const concatFn = ({ sources }) => {
  order("concat", sources);
  return (ctx) => {
    const [current] = ctx.deps;
    let index = ctx.state.get()?.index ?? 0;
    // A saved position that is not the source it depends on, as in a checkpoint edited by hand,
    // would wait for good or end early.
    if (sources[index] !== current.id) throw new TypeError("concat: its saved position is not the source it depends on");
    sendArrays(ctx, current);
    if (completed(current)) {
      index += 1;
      if (index < sources.length) ctx.rewire([sources[index]]);
      else ctx.down([["COMPLETE"]]);
    }
    ctx.state.set({ index });
  };
};

// The first input, in declared order, that delivered DATA or a terminal is selected for good.
function raceFn(ctx) {
  let winner = ctx.state.get()?.winner ?? null;
  if (winner === null) {
    const first = ctx.deps.find((d) => occurrences(d).length || d.terminal);
    if (!first) return;
    winner = first.id;
    ctx.state.set({ winner });
    if (ctx.deps.length > 1) ctx.rewire([winner]);
  }
  const selected = ctx.deps.find((d) => d.id === winner);
  if (selected.invalidated) ctx.down([["INVALIDATE"]]); // the selected input's alone
  if (errored(selected)) { ctx.down([selected.terminal]); return; } // without that wave's DATA, as the auto policy
  sendArrays(ctx, selected);
  if (completed(selected)) ctx.down([["COMPLETE"]]);
}

const order = (name, ids) => {
  if (!Array.isArray(ids) || !ids.length || ids.some((id) => typeof id !== "string" || !id)) throw new RangeError(`${name}: a list of at least one node id`);
  if (new Set(ids).size !== ids.length) throw new RangeError(`${name}: its inputs are distinct nodes`);
};
const exist = (g, name, ids) => {
  const known = new Set(g.describe().map((node) => node.id));
  for (const id of ids) if (!known.has(id)) throw new RangeError(`${name}: ${id} does not exist`);
};
const recipe = (ref, config = null) => ({ recipe: { ref: `operators.${ref}`, config } });

export function merge(g, id, inputIds) {
  order(`merge ${id}`, inputIds);
  return g.node(id, inputIds, mergeFn, recipe("merge"));
}

export function withLatestFrom(g, id, primaryId, secondaryIds) {
  order(`withLatestFrom ${id}`, secondaryIds);
  order(`withLatestFrom ${id}`, [primaryId, ...secondaryIds]);
  return g.node(id, [primaryId, ...secondaryIds], withLatestFromFn, { terminal: { complete: "manual" }, ...recipe("withLatestFrom") });
}

export function zip(g, id, inputIds) {
  order(`zip ${id}`, inputIds);
  return g.node(id, inputIds, zipFn, { terminal: { complete: "manual", error: "manual" }, ...recipe("zip") });
}

export function concat(g, id, sourceIds) {
  order(`concat ${id}`, sourceIds);
  exist(g, `concat ${id}`, sourceIds); // a source that does not exist would only fail at its turn
  const sources = [...sourceIds];
  return g.node(id, [sources[0]], concatFn({ sources }), { terminal: { complete: "manual" }, ...recipe("concat", { sources }) });
}

export function race(g, id, inputIds) {
  order(`race ${id}`, inputIds);
  return g.node(id, inputIds, raceFn, { terminal: { complete: "manual", error: "manual" }, invalidate: "manual", ...recipe("race") });
}

export const combineRecipes = Object.freeze({
  "operators.merge": () => mergeFn,
  "operators.withLatestFrom": () => withLatestFromFn,
  "operators.zip": () => zipFn,
  "operators.concat": (config) => concatFn(config ?? {}),
  "operators.race": () => raceFn,
});
