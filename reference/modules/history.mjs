// Bounded history (R-replay-buffer) as a module over the reference kernel. Non-normative.
//
// Built 2026-11-08. The user decided that the kernel's START snapshot carries the source's last
// array (K3), and that history across arrays is a module rather than a kernel option: in TS,
// `replayBuffer` is used only by the occurrence solutions, never by ordinary nodes.
//
// history(g, id, sourceId, n) is a node whose value is the list of the last n waves in which
// sourceId published DATA since the history node was activated, oldest first. Each entry is that
// wave's ctx.deps[0].waves, the arrays that carried DATA, each as its DATA payloads in order
// (decided by the user 2026-11-09), so the list keeps both which waves the values came in and how
// each wave was split into arrays: [[[2]], [[3], [4]]] is a wave with one array [2], then a wave
// with two arrays [3] and [4]. Equal values are included; an array without DATA (RESOLVED) is left
// out, and a wave without DATA is not an entry and sends nothing. Each wave with DATA sends the new
// list once. A new subscriber, sink or dependent, gets the list in its START snapshot like any
// value. The list lives in private state, so:
// - an INVALIDATE from the source removes the node's value and keeps the list (the default, auto
//   policy; D812, decided by the user 2026-11-18): the next wave with DATA sends the list with its
//   earlier entries, and arrays that came before the INVALIDATE in the same wave are not in that
//   wave's entry, since the kernel drops them (K6). Until D812 the node had the manual policy and
//   cleared the list;
// - deactivation drops it (K7), as TS's ring is dropped (BH6);
// - checkpoint saves it: the node carries its recipe { ref: "history", config: { n } }, and
//   historyRecipes goes in the restore's registry (2026-11-10).
// On activation the list starts with one entry, a wave of one array: the source's last array, all
// its START snapshot holds.

// It needs no policy of its own: it is a scan over waves. Under the auto INVALIDATE policy the
// kernel removes the node's value without running this function, and the private state, where
// the list is, stays (K6).
export const historyRecipe = ({ n }) => (ctx) => {
  const wave = ctx.deps[0].waves.filter((w) => w.length);
  if (!wave.length) return;
  const list = [...(ctx.state.get() ?? []), wave].slice(-n);
  ctx.state.set(list);
  ctx.down([["DATA", list]]);
};

export function history(g, id, sourceId, n) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`history ${id}: n must be a positive integer`);
  return g.node(id, [sourceId], historyRecipe({ n }), { recipe: { ref: "history", config: { n } } });
}

export const historyRecipes = Object.freeze({ history: historyRecipe });
