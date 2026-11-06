// Value sugar over the kernel reference. Not kernel behavior: these are ordinary node
// functions, (ctx) => void, which is the point of DS-17 (first-run gating,
// per-occurrence policy and cancellation live here, not in the substrate). They exist
// to show that each policy can live outside the kernel; they are not a chosen operator
// set.
//
// ctx.deps[i].waves is that dependency's value arrays this wave, each a list of DATA
// payloads ([] for RESOLVED). Sugar that maps occurrences keeps the arrays as they came.

const occurrences = (d) => d.waves.flat();

// derived: runs once every dependency has a value; recomputes from latest values when
// any dependency delivered DATA in this wave. All-RESOLVED settlement emits nothing, so
// the kernel settles the announced DIRTY with RESOLVED.
export const derived = (f) => (ctx) => {
  if (!ctx.deps.every((d) => d.has) || !ctx.deps.some((d) => occurrences(d).length)) return;
  ctx.down([["DATA", f(...ctx.deps.map((d) => d.value))]]);
};

// map: one output occurrence per input occurrence, one output array per input array.
export const map = (f) => (ctx) => {
  for (const w of ctx.deps[0].waves) if (w.length) ctx.down(w.map((v) => ["DATA", f(v)]));
};

// filter: drops occurrences that fail the predicate; an array left empty is not sent.
export const filter = (pred) => (ctx) => {
  for (const w of ctx.deps[0].waves) {
    const kept = w.filter(pred);
    if (kept.length) ctx.down(kept.map((v) => ["DATA", v]));
  }
};

// reduce: accumulates in private state and emits the result when its input completes.
// Requires { terminal: { complete: "manual" } }.
export const reduce = (f, seed) => (ctx) => {
  const [d] = ctx.deps;
  let acc = ctx.state.get() ?? seed;
  for (const v of occurrences(d)) acc = f(acc, v);
  ctx.state.set(acc);
  if (d.terminal?.[0] === "COMPLETE") ctx.down([["DATA", acc], ["COMPLETE"]]);
};

// latestAsync: starts f(value, signal) for the latest input occurrence; its result goes
// out through ctx.down after the function returned, which makes it a new wave (P9).
// Only the newest request may publish: the previous one is aborted when a newer input
// arrives or when the node's lifetime closes. The kernel pairs nothing.
export const latestAsync = (f) => (ctx) => {
  const values = occurrences(ctx.deps[0]);
  if (!values.length) return;
  ctx.state.get()?.abort(); // a newer input makes the older request obsolete
  const ctrl = new AbortController();
  ctx.state.set(ctrl);
  ctx.onDeactivation(() => ctrl.abort());
  Promise.resolve()
    .then(() => f(values[values.length - 1], ctrl.signal))
    .then(
      (v) => { if (!ctrl.signal.aborted) ctx.down([["DATA", v]]); },
      (e) => { if (!ctrl.signal.aborted) ctx.down([["ERROR", e instanceof Error ? e.message : e]]); },
    );
};
