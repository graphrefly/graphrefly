// Value sugar over the kernel reference. Not kernel behavior: these are ordinary node
// functions, (ctx) => void, which is the point of DS-17 (first-run gating,
// per-occurrence policy and cancellation live here, not in the substrate). They exist
// to show that each policy can live outside the kernel; they are not a chosen operator
// set.

// derived: runs once every dependency has a value; recomputes from latest values when
// any dependency delivered DATA in this wave. All-RESOLVED settlement emits nothing, so
// the kernel settles the announced DIRTY with RESOLVED.
export const derived = (f) => (ctx) => {
  if (!ctx.deps.every((d) => d.has) || !ctx.deps.some((d) => d.data.length)) return;
  ctx.down([["DATA", f(...ctx.deps.map((d) => d.value))]]);
};

// map: one output occurrence per input occurrence.
export const map = (f) => (ctx) => ctx.down(ctx.deps[0].data.map((v) => ["DATA", f(v)]));

// filter: drops occurrences that fail the predicate.
export const filter = (pred) => (ctx) => ctx.down(ctx.deps[0].data.filter(pred).map((v) => ["DATA", v]));

// reduce: accumulates in private state and emits the result when its input completes.
// Requires { terminal: { complete: "manual" } }.
export const reduce = (f, seed) => (ctx) => {
  const [d] = ctx.deps;
  let acc = ctx.state.get() ?? seed;
  for (const v of d.data) acc = f(acc, v);
  ctx.state.set(acc);
  if (d.terminal?.[0] === "COMPLETE") ctx.down([["DATA", acc], ["COMPLETE"]]);
};

// latestAsync: starts f(value, signal) for the latest input occurrence; its result goes
// out through ctx.down after the function returned, which makes it a new wave (P9).
// Only the newest request may publish: the previous one is aborted when a newer input
// arrives or when the node's lifetime closes. The kernel pairs nothing.
export const latestAsync = (f) => (ctx) => {
  const [d] = ctx.deps;
  if (!d.data.length) return;
  ctx.state.get()?.abort(); // a newer input makes the older request obsolete
  const ctrl = new AbortController();
  ctx.state.set(ctrl);
  ctx.onDeactivation(() => ctrl.abort());
  Promise.resolve()
    .then(() => f(d.data[d.data.length - 1], ctrl.signal))
    .then(
      (v) => { if (!ctrl.signal.aborted) ctx.down([["DATA", v]]); },
      (e) => { if (!ctrl.signal.aborted) ctx.down([["ERROR", e instanceof Error ? e.message : e]]); },
    );
};
