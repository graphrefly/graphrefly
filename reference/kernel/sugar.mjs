// Value sugar over the kernel reference. Not kernel behavior: these are ordinary node
// functions, which is the point of DS-17 (first-run gating and per-occurrence policy
// live here, not in the substrate).

// derived: runs once every dependency has a value; recomputes from latest values when
// any dependency delivered DATA in this wave. All-RESOLVED settlement emits nothing, so
// the kernel settles the announced DIRTY with RESOLVED.
export const derived = (f) => ({ deps, activation }) => {
  if (!deps.every((d) => d.has)) return {};
  if (!activation && !deps.some((d) => d.data.length)) return {};
  return { down: [["DATA", f(...deps.map((d) => d.value))]] };
};

// map: one output occurrence per input occurrence.
export const map = (f) => ({ deps: [d] }) => ({ down: d.data.map((v) => ["DATA", f(v)]) });

// filter: drops occurrences that fail the predicate.
export const filter = (pred) => ({ deps: [d] }) => ({
  down: d.data.filter(pred).map((v) => ["DATA", v]),
});

// reduce: accumulates in private state and emits the result when its input completes.
// Requires { terminal: { complete: "manual" } }.
export const reduce = (f, seed) => ({ deps: [d], state }) => {
  let acc = state ?? seed;
  for (const v of d.data) acc = f(acc, v);
  if (d.terminal?.[0] === "COMPLETE") return { state: acc, down: [["DATA", acc], ["COMPLETE"]] };
  return { state: acc };
};

// latestAsync: starts f(value, signal) for the latest input occurrence and publishes
// its result later as a new wave (P9). Only the newest request may publish: the
// previous one is aborted when a newer input arrives or when the node's lifetime
// closes. The kernel pairs nothing; this policy lives entirely here.
export const latestAsync = (f) => ({ deps: [d], state, ctx }) => {
  if (!d.data.length) return {};
  state?.abort(); // a newer input makes the older request obsolete
  const ctrl = new AbortController();
  ctx.onDeactivation(() => ctrl.abort());
  const send = ctx.later();
  Promise.resolve()
    .then(() => f(d.data[d.data.length - 1], ctrl.signal))
    .then(
      (v) => { if (!ctrl.signal.aborted) send([["DATA", v]]); },
      (e) => { if (!ctrl.signal.aborted) send([["ERROR", e instanceof Error ? e.message : e]]); },
    );
  return { state: ctrl };
};
