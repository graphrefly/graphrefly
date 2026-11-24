// switchMap and mergeMap over the reference kernel's rewire. Non-normative.
//
// One operator, as TS's mapOperator (higher-order.ts, D47/D81). Built 2026-11-08: switchMap
// first as an owner with a replaced inner, mergeMap first on replace (git 75ee4c8), then
// mergeMap on rewire (79026f7); merged once both fitted the same shape. Since 2026-11-23 the
// function is reference/operators/higher-order.mjs, written from the operator contracts
// (graphrefly:D813), which also holds concatMap and exhaustMap; this module gives the same
// operators under the names it had.
//
// Where the operators now differ from what this module did after TS, each as its contract or
// O-common says: an ERROR of the outer or of a held inner ends the operator without that wave's
// DATA, and a throwing projector ends it without what the run had sent (R-failure; TS D81 sends
// the inner values first); a switch sends nothing of the inner it supersedes in the switching
// wave; an outer INVALIDATE releases a switch's selection.

import { mergeMap as merge } from "../operators/higher-order.mjs";

export { concatMap, exhaustMap, higherOrderRecipes, relay, switchMap } from "../operators/higher-order.mjs";

// TS's MergeMapOptions name the capacity `concurrent`.
export function mergeMap(g, id, sourceId, project, { concurrent, ...options } = {}) {
  return merge(g, id, sourceId, project, { ...(concurrent !== undefined && { capacity: concurrent }), ...options });
}
