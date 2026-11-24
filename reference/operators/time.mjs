// debounce, throttle, auditTime, delay, bufferTime and timeout over the reference kernel, written
// from their contracts (operators/contracts.jsonl, O-debounce, O-throttle, O-auditTime, O-delay,
// O-bufferTime, O-timeout; graphrefly:D813). Non-normative.
//
// Each is one node over its source, with its recipe in its definition. None takes a callback, and
// this file imports nothing, so time.mutants.test.mjs can load edited copies of it.
//
// Time. An operator is given `timers`, { set(fn, ms) -> handle, clear(handle) }, and never reads
// the time: it starts a timer and cancels it (the user, 2026-11-24). Without one it takes the
// host's. Timers are not JSON, so a recipe cannot hold them: timeRecipes(timers) gives the
// registry of a restore, bound to the timers the restoring host runs on. A timer's firing sends
// through the ctx of the run that started it, after that run returned, so each firing is a wave
// of its own (R-wave, O-common), and belongs to the lifetime: the cleanup clears what is still
// running, and what a closed lifetime's ctx sends is dropped (R-lifetime).
//
// What is pending is private state, as JSON, and a checkpoint saves it; a running timer is not,
// and a setup starts it again in full at a restored operator's first activation (R-checkpoint):
//   debounce    { candidate }: the latest DATA, sent once `ms` passed without another.
//   auditTime   { candidate }: the latest DATA, sent when the window that an input opened ends.
//   delay       { queue }: one item per source wave, { invalidate, arrays, complete }.
//   bufferTime  { items }: the payloads of the window that is open.
//   throttle and timeout keep nothing: a deadline is not kept.
// Which timers run is kept per lifetime, under the lifetime's signal.
//
// Policies. Manual INVALIDATE: a function is told of an INVALIDATE only under it (R-invalidation),
// and debounce and auditTime drop their candidate then, while delay sends it on later; the other
// three do under it what the auto policy would. Manual COMPLETE: delay sends the COMPLETE later;
// the others end their own output in the function, which the auto policy would leave as it is.
// Manual ERROR, as the gate family has it: the source's ERROR ends the operator in the function,
// which drops what is pending.
//
// A restored debounce or auditTime whose source no longer holds a value had its source invalidated
// while the graph was saved, and drops its candidate, as a restored sample, pausable and switchMap
// drop theirs; a timeout ends with the ERROR "timeout"; and ms is a positive integer, any other
// being refused when the operator is built or its recipe is (the user, 2026-11-24).

const occurrences = (d) => d.waves.flat();
const completed = (d) => d.terminal?.[0] === "COMPLETE";
const errored = (d) => d.terminal?.[0] === "ERROR";
const data = (values) => values.map((v) => ["DATA", v]);

export const timePolicies = Object.freeze({ terminal: Object.freeze({ complete: "manual", error: "manual" }), invalidate: "manual" });
export const hostTimers = Object.freeze({ set: (fn, ms) => setTimeout(fn, ms), clear: (handle) => clearTimeout(handle) });

const positive = (ms) => Number.isInteger(ms) && ms >= 1;
const checked = (name, ms) => {
  if (!positive(ms)) throw new RangeError(`${name}: ms is a positive integer`);
  return ms;
};

// The timers one lifetime runs, under its signal, which every ctx of the lifetime shares.
const lifetimes = new WeakMap();
const running = (ctx) => {
  if (!lifetimes.has(ctx.signal)) lifetimes.set(ctx.signal, new Set());
  return lifetimes.get(ctx.signal);
};
// start(ctx, timers, ms, fn) starts a timer of the lifetime and gives its handle; stop cancels
// one, and stopAll every one, which is each operator's cleanup.
const start = (ctx, timers, ms, fn) => {
  const set = running(ctx);
  const handle = timers.set(() => { set.delete(handle); fn(); }, ms);
  set.add(handle);
  return handle;
};
const stopAll = (ctx, timers) => {
  const set = running(ctx);
  for (const handle of set) timers.clear(handle);
  set.clear();
};
const cleanup = (ctx, timers) => () => stopAll(ctx, timers);
// A restored operator's first run (ctx.seed), whose source no longer holds a value.
const lostItsValue = (ctx, source) => ctx.seed !== undefined && !source.has;

// debounce: every wave with DATA makes its last value the candidate and starts the quiet interval
// again. A source INVALIDATE drops the candidate and its timer; the source's COMPLETE sends the
// candidate in the terminal's array, and its ERROR discards it.
function debounceOf({ ms }, timers) {
  checked("debounce", ms);
  const wait = (ctx) => {
    stopAll(ctx, timers);
    start(ctx, timers, ms, () => {
      const { candidate } = ctx.state.get();
      ctx.state.set({ candidate: [] });
      ctx.down(data(candidate));
    });
  };
  const fn = (ctx) => {
    const [source] = ctx.deps;
    let candidate = ctx.state.get()?.candidate ?? [];
    if (source.invalidated || lostItsValue(ctx, source)) { candidate = []; stopAll(ctx, timers); }
    if (source.invalidated) ctx.down([["INVALIDATE"]]);
    if (errored(source)) { ctx.state.set({ candidate: [] }); ctx.down([source.terminal]); return; }
    const values = occurrences(source);
    if (values.length) candidate = [values[values.length - 1]];
    if (completed(source)) { ctx.state.set({ candidate: [] }); ctx.down([...data(candidate), ["COMPLETE"]]); return; }
    ctx.state.set({ candidate });
    if (values.length) wait(ctx);
  };
  // A restored debounce that holds a candidate waits a full interval again.
  const setup = (ctx) => {
    if (ctx.state.get()?.candidate.length) wait(ctx);
    return cleanup(ctx, timers);
  };
  return { fn, setup };
}

// throttle: the first DATA of a wave is sent when no interval runs, and starts one; every other
// DATA is dropped. Nothing is pending, so the interval is the running timer alone.
function throttleOf({ ms }, timers) {
  checked("throttle", ms);
  const fn = (ctx) => {
    const [source] = ctx.deps;
    if (source.invalidated) ctx.down([["INVALIDATE"]]);
    if (errored(source)) { ctx.down([source.terminal]); return; }
    const values = occurrences(source);
    if (values.length && running(ctx).size === 0) {
      ctx.down([["DATA", values[0]]]);
      start(ctx, timers, ms, () => {});
    }
    if (completed(source)) ctx.down([["COMPLETE"]]);
  };
  return { fn, setup: (ctx) => cleanup(ctx, timers) };
}

// auditTime: a wave with DATA makes its last value the candidate, and opens a window when none is
// open; the window's end sends the candidate there is then. A source INVALIDATE drops the
// candidate and keeps the window.
function auditTimeOf({ ms }, timers) {
  checked("auditTime", ms);
  const open = (ctx) => start(ctx, timers, ms, () => {
    const { candidate } = ctx.state.get();
    if (!candidate.length) return;
    ctx.state.set({ candidate: [] });
    ctx.down(data(candidate));
  });
  const fn = (ctx) => {
    const [source] = ctx.deps;
    let candidate = ctx.state.get()?.candidate ?? [];
    if (source.invalidated || lostItsValue(ctx, source)) candidate = [];
    if (source.invalidated) ctx.down([["INVALIDATE"]]);
    if (errored(source)) { ctx.state.set({ candidate: [] }); ctx.down([source.terminal]); return; }
    const values = occurrences(source);
    if (values.length) candidate = [values[values.length - 1]];
    if (completed(source)) { ctx.state.set({ candidate: [] }); ctx.down([...data(candidate), ["COMPLETE"]]); return; }
    ctx.state.set({ candidate });
    if (values.length && running(ctx).size === 0) open(ctx);
  };
  // A restored auditTime that holds a candidate opens a full window again.
  const setup = (ctx) => {
    if (ctx.state.get()?.candidate.length) open(ctx);
    return cleanup(ctx, timers);
  };
  return { fn, setup };
}

// delay: what a source wave brought is one item of the queue, with a timer of its own. The delays
// are equal, so the items come due in queue order, and a firing sends the head of the queue,
// whichever timer it is: source order does not rest on which of two timers due together fires
// first. An item's INVALIDATE goes first, then its arrays as they came, then its COMPLETE as an
// array of its own (O-common), each a wave. The source's ERROR ends the delay at once.
function delayOf({ ms }, timers) {
  checked("delay", ms);
  const later = (ctx) => start(ctx, timers, ms, () => {
    const [item, ...queue] = ctx.state.get().queue;
    ctx.state.set({ queue });
    if (item.invalidate) ctx.down([["INVALIDATE"]]);
    for (const values of item.arrays) ctx.down(data(values));
    if (item.complete) ctx.down([["COMPLETE"]]);
  });
  const fn = (ctx) => {
    const [source] = ctx.deps;
    const queue = ctx.state.get()?.queue ?? [];
    if (errored(source)) { stopAll(ctx, timers); ctx.state.set({ queue: [] }); ctx.down([source.terminal]); return; }
    const item = { invalidate: source.invalidated === true, arrays: source.waves.filter((values) => values.length), complete: completed(source) };
    if (!item.invalidate && !item.arrays.length && !item.complete) { ctx.state.set({ queue }); return; }
    ctx.state.set({ queue: [...queue, item] });
    later(ctx);
  };
  // A restored delay starts a full delay again for every item it holds.
  const setup = (ctx) => {
    for (const _ of ctx.state.get()?.queue ?? []) later(ctx);
    return cleanup(ctx, timers);
  };
  return { fn, setup };
}

// bufferTime: windows follow one another from the activation, whatever the source does; the end
// of one sends the payloads collected in it, if any, as one DATA. A source INVALIDATE keeps them.
// The source's COMPLETE sends a nonempty tail in the terminal's array.
function bufferTimeOf({ ms }, timers) {
  checked("bufferTime", ms);
  const fn = (ctx) => {
    const [source] = ctx.deps;
    const items = [...(ctx.state.get()?.items ?? []), ...occurrences(source)];
    if (source.invalidated) ctx.down([["INVALIDATE"]]);
    if (errored(source)) { ctx.state.set({ items: [] }); ctx.down([source.terminal]); return; }
    if (completed(source)) { ctx.state.set({ items: [] }); ctx.down(items.length ? [["DATA", items], ["COMPLETE"]] : [["COMPLETE"]]); return; }
    ctx.state.set({ items });
  };
  const setup = (ctx) => {
    const window = () => start(ctx, timers, ms, () => {
      window();
      const items = ctx.state.get()?.items ?? [];
      if (!items.length) return;
      ctx.state.set({ items: [] });
      ctx.down([["DATA", items]]);
    });
    window();
    return cleanup(ctx, timers);
  };
  return { fn, setup };
}

// timeout: the source's arrays pass as they came. The deadline runs from the activation and again
// from every wave with DATA; when it comes the timeout ends with an ERROR.
function timeoutOf({ ms }, timers) {
  checked("timeout", ms);
  const watch = (ctx) => {
    stopAll(ctx, timers);
    start(ctx, timers, ms, () => ctx.down([["ERROR", "timeout"]]));
  };
  const fn = (ctx) => {
    const [source] = ctx.deps;
    if (source.invalidated) ctx.down([["INVALIDATE"]]);
    if (errored(source)) { ctx.down([source.terminal]); return; }
    for (const values of source.waves) if (values.length) ctx.down(data(values));
    if (occurrences(source).length) watch(ctx);
    if (completed(source)) ctx.down([["COMPLETE"]]);
  };
  const setup = (ctx) => {
    watch(ctx);
    return cleanup(ctx, timers);
  };
  return { fn, setup };
}

const FACTORIES = { debounce: debounceOf, throttle: throttleOf, auditTime: auditTimeOf, delay: delayOf, bufferTime: bufferTimeOf, timeout: timeoutOf };
const builder = (name) => (g, id, sourceId, ms, { timers = hostTimers } = {}) => {
  checked(`${name} ${id}`, ms);
  const { fn, setup } = FACTORIES[name]({ ms }, timers);
  return g.node(id, [sourceId], fn, { ...timePolicies, setup, recipe: { ref: `operators.${name}`, config: { ms } } });
};

export const debounce = builder("debounce");
export const throttle = builder("throttle");
export const auditTime = builder("auditTime");
export const delay = builder("delay");
export const bufferTime = builder("bufferTime");
export const timeout = builder("timeout");

// The registry of a restore, bound to the timers the restored operators run on. A recipe's
// policies travel in the checkpoint with the node (R-checkpoint), so a factory gives the function
// and its setup.
export const timeRecipes = (timers = hostTimers) => Object.freeze(Object.fromEntries(
  Object.entries(FACTORIES).map(([name, factory]) => [`operators.${name}`, (config) => factory(config ?? {}, timers)]),
));
