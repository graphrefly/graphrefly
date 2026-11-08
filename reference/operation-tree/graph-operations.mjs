// The operation tree as a graph on the DS-17 reference kernel. Same API and the same
// behavior as photo-scenes' packages/operations, so the same spec runs against both.
//
// Graph (one wave per change):
//   commands ─► runs ─► runs:<container> ─► runs:<child container> ...   (top-down)
//   runs:<holder> + flags:<children> ─► flags:<slot>                      (bottom-up)
//   every runs node ─► effects ─► host
//
// A container's runs node decides for its child slots: their revisions, their runs (alive,
// or dead and still holding locks until they settle), the waiting starts, and the
// preempt / drop / queue policies with sibling locks. It reads its own run from its
// holder's runs node over a declared edge, so a cancelled or restarted container kills its
// children in the same wave. `runs` (no path) is the holder of the root.
//
// The host owns what cannot be data: the task bodies, their AbortControllers, the promises
// handed to `wait`, the start promises, and the order in which callbacks into outside code
// run after a wave.

import { createGraph } from "../kernel/kernel.mjs";

class OperationAbortedError extends Error {
  name = "OperationAbortedError";
  constructor() { super("The operation was cancelled or replaced."); }
}

export function isAborted(error) {
  return error instanceof OperationAbortedError
    || (typeof error === "object" && error !== null && error.name === "AbortError");
}

const now = () => (typeof performance === "undefined" ? Date.now() : performance.now());
const aborted = () => ({ status: "aborted" });
const aliveRun = (slotState) => slotState?.runs.find((r) => r.alive) ?? null;

// ---- The declared tree -------------------------------------------------------

function build(definition, name, path, parent) {
  const isContainer = !(typeof definition.run === "function");
  if (isContainer && !definition.children) throw new Error(`${path}: a container needs children; a task needs run`);
  if (!isContainer && definition.children) throw new Error(`${path}: only containers have children`);
  const slot = { name, path, definition, isContainer, parent, children: [] };
  if (isContainer) {
    for (const [childName, child] of Object.entries(definition.children)) {
      slot.children.push(build(child, childName, `${path}/${childName}`, slot));
    }
  }
  return slot;
}

const conflicts = (a, b) => a === b || (!a.isContainer && !b.isContainer
  && (a.definition.locks ?? []).some((lock) => (b.definition.locks ?? []).includes(lock)));

const isUnder = (slot, container) => {
  for (let p = slot.parent; p; p = p.parent) if (p === container) return true;
  return false;
};

// ---- A container's decisions, as a node function --------------------------------

function decide(container, isTop, bySlotPath) {
  const kids = new Map(container.children.map((s) => [s.path, s]));
  return (ctx) => {
    let st = ctx.state.get();
    const first = !st;
    if (first) {
      st = { gen: undefined, waiting: [], slots: Object.fromEntries(container.children.map((s) => [s.path, { revision: 0, runs: [] }])) };
    }
    const fx = { deaths: [], resolves: [], enters: [] };
    let changed = first;
    const put = (path, slotState) => { st.slots = { ...st.slots, [path]: slotState }; changed = true; };
    const kill = (path, run) => {
      const slot = kids.get(path);
      const runs = st.slots[path].runs;
      put(path, { ...st.slots[path], runs: slot.isContainer ? runs.filter((r) => r !== run) : runs.map((r) => (r === run ? { ...r, alive: false } : r)) });
      if (!slot.isContainer) fx.deaths.push(run.id); // a container's death reaches its children over the holder edge
    };
    const refuse = (waiter) => {
      st.waiting = st.waiting.filter((w) => w !== waiter);
      fx.resolves.push({ reqId: waiter.reqId, outcome: aborted() });
      changed = true;
    };
    const begin = (slot, request) => {
      const revision = st.slots[slot.path].revision + 1;
      const run = { id: `${slot.path}#${revision}`, revision, alive: true };
      put(slot.path, { revision, runs: slot.isContainer ? [run] : [...st.slots[slot.path].runs, run] });
      if (!slot.isContainer) fx.enters.push({ reqId: request.reqId, runId: run.id, path: slot.path, revision, args: request.args });
    };
    // Task runs not settled yet, alive or not: they hold their locks.
    const unsettled = () => Object.entries(st.slots).flatMap(([path, s]) => (kids.get(path).isContainer ? [] : s.runs.map((run) => ({ path, run }))));

    // This container's own run, as its holder decided it in this wave. A new generation, or
    // none, kills every run of the old one and refuses its waiting starts.
    const gen = isTop ? "top" : aliveRun(ctx.deps[1].value.slots[container.path])?.id ?? null;
    if (gen !== st.gen) {
      for (const [path, s] of Object.entries(st.slots)) for (const run of s.runs) if (run.alive) kill(path, run);
      for (const w of [...st.waiting]) refuse(w);
      st.gen = gen;
      changed = true;
    }

    const startHere = (slot, cmd) => {
      if (slot.isContainer) {
        const current = aliveRun(st.slots[slot.path]);
        if (current) {
          if (slot.definition.conflictPolicy === "drop") { fx.resolves.push({ reqId: cmd.reqId, outcome: { status: "dropped" } }); return; }
          kill(slot.path, current);
        }
        begin(slot, cmd);
        fx.resolves.push({ reqId: cmd.reqId, outcome: { status: "completed" } });
        return;
      }
      const policy = slot.definition.conflictPolicy ?? "preempt";
      const runs = unsettled().filter((r) => conflicts(slot, kids.get(r.path)));
      const waiters = st.waiting.filter((w) => conflicts(slot, kids.get(w.path)));
      if (policy === "drop") {
        // A cancelled run still holds its locks until it settles, so it still refuses a drop.
        if (runs.length || waiters.length) fx.resolves.push({ reqId: cmd.reqId, outcome: { status: "dropped" } });
        else begin(slot, cmd);
        return;
      }
      if (policy === "preempt") {
        for (const w of waiters) refuse(w);
        for (const { path, run } of runs) if (run.alive) kill(path, run);
        begin(slot, cmd);
        return;
      }
      st.waiting = [...st.waiting, { reqId: cmd.reqId, path: slot.path, args: cmd.args }];
      changed = true;
    };

    for (const wave of ctx.deps[0].waves) {
      for (const cmd of wave) {
        if (!cmd) continue;
        const target = bySlotPath.get(cmd.path);
        if (cmd.type === "start" && !kids.has(cmd.path) && (isTop || isUnder(target, container))) {
          // A start deeper down: the child container on the way must run.
          const via = container.children.find((k) => isUnder(target, k));
          if (!aliveRun(st.slots[via.path])) begin(via);
          continue;
        }
        if (!kids.has(cmd.path)) continue;
        const own = st.slots[cmd.path];
        const run = own.runs.find((r) => r.id === cmd.runId);
        if (cmd.type === "start") startHere(target, cmd);
        if (cmd.type === "cancel") {
          for (const w of st.waiting.filter((x) => x.path === cmd.path)) refuse(w);
          const current = aliveRun(own);
          if (current) kill(cmd.path, current);
        }
        if (cmd.type === "cancelRun" && run?.alive) kill(cmd.path, run);
        // The body returned: the run is no longer alive, and keeps its locks until it settles.
        if (cmd.type === "returned" && run?.alive) put(cmd.path, { ...own, runs: own.runs.map((r) => (r === run ? { ...r, alive: false } : r)) });
        if (cmd.type === "settled" && run) put(cmd.path, { ...own, runs: own.runs.filter((r) => r !== run) });
      }
    }

    // Admit the first waiting start whose conflicts have all settled, then look again.
    for (;;) {
      const runs = unsettled();
      const i = st.waiting.findIndex((w, index) => {
        const slot = kids.get(w.path);
        return !runs.some((r) => conflicts(slot, kids.get(r.path)))
          && !st.waiting.slice(0, index).some((earlier) => conflicts(slot, kids.get(earlier.path)));
      });
      if (i < 0) break;
      const w = st.waiting[i];
      st.waiting = st.waiting.filter((x) => x !== w);
      begin(kids.get(w.path), w);
    }

    ctx.state.set(st);
    if (changed || fx.resolves.length) ctx.down([["DATA", { slots: st.slots, effects: fx }]]);
  };
}

// ---- The API -----------------------------------------------------------------

export function defineOperations(root, options = {}) {
  const { path, ...definition } = root;
  if ("run" in definition) throw new Error(`${path}: the root must be a container, not a task`);
  const rootSlot = build(definition, path, path, null);
  const top = { path: null, isContainer: true, children: [rootSlot], parent: null };

  const slots = [];
  const containers = [];
  const visit = (s) => { slots.push(s); if (s.isContainer) { containers.push(s); s.children.forEach(visit); } };
  visit(rootSlot);
  const bySlotPath = new Map(slots.map((s) => [s.path, s]));
  const holder = (s) => s.parent ?? top;
  const runsId = (c) => (c === top ? "runs" : `runs:${c.path}`);
  const flagsId = (s) => `flags:${s.path}`;

  const g = createGraph();
  g.state("commands", null);
  g.node("runs", ["commands"], decide(top, true, bySlotPath));
  for (const c of containers) g.node(runsId(c), ["commands", runsId(holder(c))], decide(c, false, bySlotPath));
  for (const s of [...slots].reverse()) {
    g.node(flagsId(s), [runsId(holder(s)), ...s.children.map(flagsId)], (ctx) => {
      const isRunning = Boolean(aliveRun(ctx.deps[0].value.slots[s.path]));
      const isBusy = (isRunning && !s.isContainer && s.definition.shouldCountAsBusy === true)
        || ctx.deps.slice(1).some((d) => d.value?.isBusy);
      const prev = ctx.state.get();
      if (prev && prev.isRunning === isRunning && prev.isBusy === isBusy) return;
      ctx.state.set({ isRunning, isBusy });
      ctx.down([["DATA", { isRunning, isBusy }]]);
    });
  }
  const allRuns = [top, ...containers].map(runsId);
  // One wave's effects: the aborts children first (deeper containers before their holders),
  // then refusals and body entries.
  g.node("effects", allRuns, (ctx) => {
    const changed = allRuns.flatMap((_, i) => (ctx.deps[i].waves.some((w) => w.length) ? [ctx.deps[i].value.effects] : []));
    if (!changed.length) return;
    ctx.down([["DATA", {
      aborts: [...changed].reverse().flatMap((e) => e.deaths),
      resolves: changed.flatMap((e) => e.resolves),
      enters: changed.flatMap((e) => e.enters),
    }]]);
  });

  // ---- Host --------------------------------------------------------------------

  let fresh = [];
  g.subscribe("host", "effects", (msgs) => {
    for (const [type, v] of msgs) {
      if (type === "DATA") fresh.push(v);
      if (type === "ERROR") fresh.push({ error: v });
    }
  });
  g.subscribe("host-flags", flagsId(rootSlot), () => {});

  const queue = [];       // callbacks into outside code, run after the change that caused them
  let draining = false;
  let publishQueued = false;
  let lastFlags = "";
  const live = new Map();     // runId -> the host's half of a task run
  const requests = new Map(); // reqId -> resolve of a start's promise
  let nextReq = 0;

  const report = (error) => {
    if (options.onError) {
      try { options.onError(error); return; } catch (secondary) { error = secondary; }
    }
    if (typeof globalThis.reportError === "function") globalThis.reportError(error);
    else queueMicrotask(() => { throw error; });
  };
  const guarded = (call) => { try { call(); } catch (error) { report(error); } };
  const answer = (reqId, outcome) => { const resolve = requests.get(reqId); requests.delete(reqId); resolve(outcome); };

  // Runs the queue in order; a callback's own changes append to it, so chains run one
  // after another, not by recursion.
  function drain() {
    draining = true;
    try { while (queue.length) guarded(queue.shift()); } finally { draining = false; }
  }

  function publish() {
    if (!options.onFlagsChange || publishQueued) return;
    publishQueued = true;
    queue.push(() => {
      publishQueued = false;
      const all = {};
      for (const s of slots) all[s.path] = flagsOf(s);
      const key = JSON.stringify(all);
      if (key === lastFlags) return;
      lastFlags = key;
      options.onFlagsChange(all); // drain reports what it throws
    });
  }

  // One change is one wave. Its aborts run before it returns when it was made from inside a
  // callback, and join the queue otherwise; everything else joins the queue.
  function change(cmd, after = []) {
    fresh = [];
    g.set("commands", cmd);
    const out = fresh;
    fresh = [];
    const aborts = [];
    const enters = [];
    for (const fx of out) {
      if (fx.error) throw new Error(`graph arm: ${fx.error}`);
      aborts.push(...fx.aborts);
      enters.push(...fx.enters);
      for (const r of fx.resolves) answer(r.reqId, r.outcome);
    }
    for (const e of enters) live.set(e.runId, { ...e, slot: bySlotPath.get(e.path), controller: new AbortController(), pending: new Set() });
    const abortAll = aborts.map((id) => () => live.get(id)?.controller.abort());
    if (draining) abortAll.forEach(guarded);
    else queue.push(...abortAll);
    queue.push(...after);
    if (out.length) publish();
    for (const e of enters) queue.push(() => answer(e.reqId, execute(live.get(e.runId))));
    if (!draining) drain();
  }

  const alive = (run) => g.get(runsId(holder(run.slot))).value.slots[run.path].runs.some((r) => r.id === run.runId && r.alive);
  const flagsOf = (s) => ({ ...g.get(flagsId(s)).value });

  async function execute(run) {
    const started = now();
    let outcome = aborted();
    if (alive(run)) {
      try {
        await run.slot.definition.run(operation(run), run.args);
        if (alive(run)) outcome = { status: "completed" };
      } catch (error) {
        if (alive(run) && !isAborted(error)) outcome = { status: "failed", error };
      }
    }
    change({ type: "returned", path: run.path, runId: run.runId });
    // Hold the locks until every promise handed to `wait` has settled too.
    while (run.pending.size > 0) await Promise.allSettled([...run.pending]);
    const entry = { path: run.path, revision: run.revision, outcome: outcome.status, ms: now() - started };
    const log = options.log;
    change({ type: "settled", path: run.path, runId: run.runId }, log ? [() => log(entry)] : []);
    live.delete(run.runId);
    return outcome;
  }

  function operation(run) {
    const abortedError = () => new OperationAbortedError();
    return {
      path: run.path,
      revision: run.revision,
      get parent() { return run.slot.parent ? handle(run.slot.parent, run) : null; },
      get flags() { return flagsOf(run.slot); },
      signal: run.controller.signal,
      wait(promise) {
        if (!alive(run)) {
          promise.catch(() => {});
          return Promise.reject(abortedError());
        }
        run.pending.add(promise);
        const release = () => run.pending.delete(promise);
        return new Promise((resolve, reject) => {
          const onAbort = () => reject(abortedError());
          run.controller.signal.addEventListener("abort", onAbort, { once: true });
          promise.then(
            (value) => { release(); run.controller.signal.removeEventListener("abort", onAbort); if (alive(run)) resolve(value); else reject(abortedError()); },
            (error) => { release(); run.controller.signal.removeEventListener("abort", onAbort); reject(alive(run) ? error : abortedError()); },
          );
        });
      },
      sync(effect) {
        if (!alive(run)) return false;
        effect();
        return true;
      },
      cancel() { if (alive(run)) change({ type: "cancelRun", path: run.path, runId: run.runId }); },
    };
  }

  function start(slot, args) {
    const reqId = ++nextReq;
    const promise = new Promise((resolve) => requests.set(reqId, resolve));
    change({ type: "start", path: slot.path, reqId, args });
    return promise;
  }

  // A slot handle. Bound to a run, it acts only while that run is alive.
  const stable = new Map();
  function handle(slot, boundTo) {
    const ok = () => boundTo === null || alive(boundTo);
    const children = {};
    const h = {
      path: slot.path,
      get revision() { return g.get(runsId(holder(slot))).value.slots[slot.path].revision; },
      get parent() { return slot.parent ? handle(slot.parent, boundTo) : null; },
      children,
      get flags() { return flagsOf(slot); },
      start: (args) => (ok() ? start(slot, args) : Promise.resolve(aborted())),
      cancel: () => { if (ok()) change({ type: "cancel", path: slot.path }); },
    };
    for (const child of slot.children) {
      Object.defineProperty(children, child.name, { enumerable: true, get: () => (boundTo ? handle(child, boundTo) : stable.get(child)) });
    }
    return h;
  }
  for (const s of slots) stable.set(s, handle(s, null));

  graphs.set(stable.get(rootSlot), g);
  return stable.get(rootSlot);
}

// The kernel graph behind a tree, for describe(). Not part of the photo-scenes API.
const graphs = new WeakMap();
export const graphOf = (rootHandle) => graphs.get(rootHandle);
