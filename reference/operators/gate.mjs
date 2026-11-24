// valve and pause over the reference kernel, written from their contracts
// (operators/contracts.jsonl, O-valve, O-pause; graphrefly:D813). Non-normative.
//
// Each is one node over a source and a control, with its recipe in its definition, so a graph
// that holds one can be captured (R-checkpoint); gateRecipes goes in a restore's registry. Neither
// takes a callback. This file imports nothing, so gate.mutants.test.mjs can load edited copies of
// it; reference/modules/pause.mjs builds its pausable on pausableFn and gatePolicies from here.
//
//   valve  sends the source's DATA while the control's value is true, and drops it otherwise.
//          No private state: what decides is the control's value after the wave (R-invocation
//          gives the latest value received), so a control that has no value, as before its first
//          one or after its INVALIDATE, leaves the valve closed, and one that completed keeps
//          the valve where it was. Reopening sends nothing: only a wave's own source DATA goes.
//   pause  holds the source's arrays while the lock state holds a non-empty list and sends them,
//          each as it arrived, when it no longer does (R-pause). The held arrays are private
//          state. An array that comes with the source's terminal goes on as it came, the
//          terminal in it; while paused only the terminal goes, and what was held is dropped.
//          The lock state's COMPLETE alone changes nothing, and its list stays; its ERROR ends
//          the pausable, as an input's ERROR ends any operator (O-common; the user, 2026-11-23:
//          until then the reference passed over the lock state's terminal altogether).
//          A restored pausable whose source no longer holds a value had its source invalidated
//          while the graph was saved (R-checkpoint), and discards what it held, as it would
//          have; its output stays, as a restored node's own value does (the user, 2026-11-23,
//          as of a restored sample's pending value on 2026-11-20).
//
// The two inputs have different roles, which needs three policies the default does not give:
//   - manual INVALIDATE (R-invalidation): a source INVALIDATE retracts the output, and a control
//     INVALIDATE alone retracts nothing. Under the auto policy either input's would retract it.
//   - manual COMPLETE (R-terminals): the source's COMPLETE ends the node, and the control's alone
//     does not. Under the auto policy the node would wait for both.
//   - manual ERROR (R-terminals): under the auto policy the kernel would also retract the output
//     for a control INVALIDATE that came in an ERROR's wave, and a control INVALIDATE never
//     retracts (the user, 2026-11-23, as of a notifier's on 2026-11-20). Both end with either
//     input's ERROR, the source's first when both end with one (O-common); the pausable sends its
//     source's ERROR in the array it came in, as it does the source's COMPLETE (R-pause).
//
// The two inputs are distinct nodes: one node given as both is refused when the operator is built
// (O-common). The kernel itself takes a repeated dependency.

const completed = (d) => d.terminal?.[0] === "COMPLETE";
const errored = (d) => d.terminal?.[0] === "ERROR";
export const gatePolicies = Object.freeze({ terminal: Object.freeze({ complete: "manual", error: "manual" }), invalidate: "manual" });

// An ERROR of either input ends the valve, without that wave's DATA. The source's COMPLETE
// follows the wave's DATA as an array of its own.
function valveFn(ctx) {
  const [source, control] = ctx.deps;
  if (source.invalidated) ctx.down([["INVALIDATE"]]);
  const error = ctx.deps.find(errored)?.terminal;
  if (error) { ctx.down([error]); return; }
  const open = control.has && control.value === true;
  if (open) for (const w of source.waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));
  if (completed(source)) ctx.down([["COMPLETE"]]);
}

export const isPaused = (control) => control.has && control.value.length > 0;

// Private state: the arrays held since the last source INVALIDATE, each as it arrived, which a
// checkpoint saves. While
// paused, nothing but the source's terminal goes out; unpaused, or on the release, the held
// arrays and the new ones go out one per array, the source's terminal in the last of them.
export function pausableFn(ctx) {
  const [input, control] = ctx.deps;
  let held = ctx.state.get() ?? [];
  if (input.invalidated) {
    held = [];
    ctx.down([["INVALIDATE"]]);
  }
  // A restored pausable's first run (ctx.seed): a source that holds no value now was invalidated
  // while the graph was saved. The output stays (R-checkpoint).
  if (ctx.seed !== undefined && !input.has) held = [];
  // The lock state's ERROR ends the pausable without that run's DATA and without what was held,
  // unless the source ended with an ERROR of its own, which comes first in declared order.
  if (errored(control) && !errored(input)) { ctx.state.set([]); ctx.down([control.terminal]); return; }
  held = [...held, ...input.waves.filter((w) => w.length)];
  const end = input.terminal;
  if (isPaused(control)) {
    ctx.state.set(end ? [] : held);
    if (end) ctx.down([end]);
    return;
  }
  ctx.state.set([]);
  held.forEach((w, i) => ctx.down([...w.map((v) => ["DATA", v]), ...(end && i === held.length - 1 ? [end] : [])]));
  if (end && !held.length) ctx.down([end]);
}

const distinct = (name, a, b) => {
  if (a === b) throw new RangeError(`${name}: its inputs are distinct nodes`);
};

export function valve(g, id, sourceId, controlId) {
  distinct(`valve ${id}`, sourceId, controlId);
  return g.node(id, [sourceId, controlId], valveFn, { ...gatePolicies, recipe: { ref: "operators.valve", config: null } });
}

// The lock state is any state node whose value is the list of locks held.
export function pause(g, id, sourceId, locksId) {
  distinct(`pause ${id}`, sourceId, locksId);
  return g.node(id, [sourceId, locksId], pausableFn, { ...gatePolicies, recipe: { ref: "operators.pause", config: null } });
}

// A recipe's policies travel in the checkpoint with the node (R-checkpoint), so a factory gives
// the function alone.
export const gateRecipes = Object.freeze({
  "operators.valve": () => valveFn,
  "operators.pause": () => pausableFn,
});
