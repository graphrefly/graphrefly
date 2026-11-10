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
// the kernel settles the pending node with RESOLVED.
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
// arrives, and every one when the node's lifetime closes, through the lifetime's signal (it
// registered a cleanup per request before 2026-11-10, and a run without a new value dropped
// the abort). The kernel pairs nothing.
export const latestAsync = (f) => (ctx) => {
  const values = occurrences(ctx.deps[0]);
  if (!values.length) return;
  ctx.state.get()?.abort(); // a newer input makes the older request obsolete
  const ctrl = new AbortController();
  ctx.state.set(ctrl);
  const signal = AbortSignal.any([ctx.signal, ctrl.signal]);
  Promise.resolve()
    .then(() => f(values[values.length - 1], signal))
    .then(
      (v) => { if (!signal.aborted) ctx.down([["DATA", v]]); },
      (e) => { if (!signal.aborted) ctx.down([["ERROR", e instanceof Error ? e.message : e]]); },
    );
};

// ---- Combining several dependencies (2026-11-08) ------------------------------------
//
// The array is the unit (R-wave-boundary, K3), so each combinator says which arrays it sends,
// by one of three rules the user agreed on:
// - a state combinator reads the latest values and sends one array per run (derived, which
//   is combineLatest);
// - an occurrence combinator sends one output array per input array (map, filter, merge,
//   withLatestFrom on its primary);
// - a pairing combinator sends one array per run, holding every result formed in it (zip).
// Arrays of several dependencies in one run are taken in declaration order. TS sends one array
// per value in merge, withLatestFrom and zip.

// combineLatest: the same as derived, under its RxJS name.
export const combineLatest = (f = (...vs) => vs) => derived(f);

// merge: every dependency's arrays, as they came.
export const merge = () => (ctx) => {
  for (const d of ctx.deps) for (const w of d.waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));
};

// withLatestFrom: each array of the primary (dependency 0) becomes one array of
// [value, latest secondary] pairs; nothing while the secondary has no value, and a secondary
// change alone sends nothing. Ends with the primary: requires { terminal: { complete: "manual" } }.
export const withLatestFrom = () => (ctx) => {
  const [primary, secondary] = ctx.deps;
  if (secondary.has) for (const w of primary.waves) if (w.length) ctx.down(w.map((v) => ["DATA", [v, secondary.value]]));
  if (primary.terminal?.[0] === "COMPLETE") ctx.down([["COMPLETE"]]);
};

// zip: queues each dependency's values and sends, in one array, every tuple that can be formed
// in this run. Completes once a dependency has completed and its queue is empty, since no tuple
// can form after that: requires { terminal: { complete: "manual" } }.
export const zip = () => (ctx) => {
  const st = ctx.state.get() ?? { queues: ctx.deps.map(() => []), done: ctx.deps.map(() => false) };
  ctx.state.set(st);
  ctx.deps.forEach((d, i) => {
    st.queues[i].push(...occurrences(d));
    if (d.terminal?.[0] === "COMPLETE") st.done[i] = true;
  });
  const out = [];
  while (st.queues.every((q) => q.length)) out.push(["DATA", st.queues.map((q) => q.shift())]);
  if (st.done.some((done, i) => done && !st.queues[i].length)) out.push(["COMPLETE"]);
  if (out.length) ctx.down(out); // this run's one array
};
