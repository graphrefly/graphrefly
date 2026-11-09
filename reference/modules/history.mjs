// Bounded history (R-replay-buffer) as a module over the reference kernel. Non-normative.
//
// Built 2026-11-08. The user decided that the kernel's START snapshot carries the source's last
// array (K3), and that history across arrays is a module rather than a kernel option: in TS,
// `replayBuffer` is used only by the occurrence solutions, never by ordinary nodes.
//
// history(g, id, sourceId, n) is a node whose value is the list of the last n DATA occurrences
// sourceId has published since the history node was activated, oldest first, equal values
// included. Each wave that brings values sends the new list; a wave without any (RESOLVED, a
// terminal alone) sends nothing. A new subscriber, sink or dependent, gets the list in its START
// snapshot like any value. The list lives in private state, so:
// - an INVALIDATE from the source clears the value (K6) and the list (an onInvalidate hook);
// - deactivation drops it (K7), as TS's ring is dropped (BH6);
// - checkpoint saves it, when the node is built from `historyRecipe` through `recipes`.
// On activation the list starts with the source's last array, all its START snapshot holds.

export const historyRecipe = ({ n }) => (ctx) => {
  ctx.onInvalidate(() => ctx.state.set([]));
  const added = ctx.deps[0].waves.flat();
  if (!added.length) return;
  const list = [...(ctx.state.get() ?? []), ...added].slice(-n);
  ctx.state.set(list);
  ctx.down([["DATA", list]]);
};

export function history(g, id, sourceId, n) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`history ${id}: n must be a positive integer`);
  return g.node(id, [sourceId], historyRecipe({ n }));
}
