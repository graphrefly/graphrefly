// GraphReFly kernel reference interpreter.
//
// Non-normative. Implements a subset of the kernel concerns in
// sessions/active/SESSION-kernel-module-classification.md (DS-17); see README.md for
// what is covered and what is not. Comments cite the DS-17 principles (P1-P10).
//
// The interpreter is deterministic and has no dependencies. A node function has the
// TS baseline's shape, (ctx) => void (R-fn-contract): it reads ctx.deps and ctx.state
// and emits only through ctx.down. Every array delivered to a sink is appended to
// graph.trace, which is the observable behavior under test.
//
// Arrays keep their boundaries (R-wave-boundary): each ctx.down call is its own array,
// and a node may publish several arrays in one wave. Subscribers receive each array;
// a dependent function sees them per dependency as ctx.deps[i].waves, like TS waveData.

export const TIER = Object.freeze({
  START: 0,
  PAUSE: 1, RESUME: 1, PULL: 1,
  DIRTY: 2,
  DATA: 3, RESOLVED: 3,
  INVALIDATE: 4,
  COMPLETE: 5, ERROR: 5,
  TEARDOWN: 6,
});

export class KernelError extends Error {}

const isValue = (m) => m[0] === "DATA" || m[0] === "RESOLVED";
const isTerminal = (m) => m[0] === "COMPLETE" || m[0] === "ERROR";
// K2/K6: each of these releases a connection's dirty membership.
const settles = (m) => isValue(m) || isTerminal(m) || m[0] === "INVALIDATE";
const messageOf = (e) => (e instanceof Error ? e.message : e);
const freshInput = () => ({ has: false, value: undefined, ended: null, frames: [] });
const hasValue = (frames) => frames.some((f) => f.some(isValue));

// One submitted array, checked and split into the arrays that are published. Messages
// keep the order the author wrote; nothing is sorted by tier (DS-17 O13). A terminal
// must come last. An INVALIDATE removes everything before it in the same array, and
// goes out as an array of its own, so INVALIDATE never shares an array with a value:
// [1, INV, 2, 3] is published as [INV] then [2, 3]. Rejections throw, before anything
// is accepted (K2: DATA and RESOLVED cannot share one array).
function prepare(msgs) {
  for (const m of msgs) {
    if (!(m[0] in TIER)) throw new KernelError(`unknown message type ${m[0]}`);
  }
  const end = msgs.findIndex(isTerminal);
  if (end >= 0 && end < msgs.length - 1) throw new KernelError("a terminal must be the last message of its array");
  const cut = msgs.map((m) => m[0]).lastIndexOf("INVALIDATE");
  const rest = msgs.slice(cut + 1);
  if (rest.some((m) => m[0] === "DATA") && rest.some((m) => m[0] === "RESOLVED")) {
    throw new KernelError("DATA and RESOLVED in one array");
  }
  const frames = cut >= 0 ? [[["INVALIDATE"]]] : [];
  if (rest.length) frames.push(rest);
  return frames;
}

export function format(entry) {
  const body = entry.msgs.map((m) => (m.length > 1 ? `${m[0]}(${JSON.stringify(m[1])})` : m[0])).join(", ");
  return `${entry.to} <- ${entry.from}: [${body}]`;
}

export function createGraph({ report: hostReport } = {}) {
  const nodes = new Map();
  const trace = [];
  // P10/R-operation-failure: a failure with no caller to return to goes to the host
  // reporter if the host configured one. Without one the kernel keeps no failure
  // history. A reporter that throws is ignored, so it cannot break the wave it reports.
  const report = (entry) => {
    if (!hostReport) return;
    try { hostReport(entry); } catch { /* the reporter's own failure has nowhere to go */ }
  };
  let staging = null;   // Map<nodeId, { msgs, life }> while a batch body runs
  let busy = false;     // K8: the kernel is running a request (wave, activation, release)
  const queue = [];     // K8: requests that arrived while busy, run in arrival order
  const running = [];   // node functions currently executing (innermost last)

  const nodeOf = (id) => {
    const n = nodes.get(id);
    if (!n) throw new KernelError(`unknown node ${id}`);
    return n;
  };

  // True when node n depends, directly or transitively, on node targetId.
  const dependsOn = (n, targetId) => n.deps.some((d) => d === targetId || dependsOn(nodeOf(d), targetId));

  function makeNode(id, kind, deps, fn, opts, initial) {
    if (nodes.has(id)) throw new KernelError(`duplicate node ${id}`);
    for (const d of deps) nodeOf(d); // P1: dependencies are declared and must exist
    const n = {
      id, kind, deps, fn,
      terminal: { complete: "auto", error: "auto", ...(opts?.terminal ?? {}) }, // O6
      quiet: Boolean(opts?.quiet), // H6: consumes input waves without forwarding DIRTY
      subs: [],            // ordered: { kind: "sink", id, cb } | { kind: "node", id, dep }
      active: false,
      life: null,          // K7: the current lifetime of a computed node, see openLife
      has: initial !== undefined,
      cache: initial,
      ended: null,         // P5: COMPLETE/ERROR message once output has ended
      privateState: undefined,
      announced: false,    // P3: this node announced DIRTY in the current wave
      dirtyDeps: new Set(),
      // Per dependency: the latest value and terminal received, and this wave's arrays.
      inputs: deps.map(freshInput),
    };
    nodes.set(id, n);
    return n;
  }

  // O3: inside a batch body every input is staged, whether it comes from the host or
  // from a node's late ctx.down, and the whole batch commits as one wave, one
  // accumulated array per node (R-wave-boundary). A submission that would make that
  // array invalid (DATA and RESOLVED together, K2) is rejected and leaves the earlier
  // staging as it was.
  function stage(n, life, msgs) {
    const entry = staging.get(n.id) ?? { msgs: [], life };
    const all = [...entry.msgs, ...msgs];
    try { prepare(all); } catch (e) { throw new KernelError(`${n.id}: ${messageOf(e)} (batch)`); }
    entry.msgs = all;
    staging.set(n.id, entry);
  }

  // ---- Out-of-wave requests (P7, K8) --------------------------------------
  //
  // A request that arrives while the kernel is busy (from a sink callback, from output a
  // node sends after its invocation returned, or from a node function that reaches the
  // graph through a closure) is not run inside the current wave. It waits and runs
  // afterwards as its own request, in arrival order. Running it immediately would let
  // one wave's cone grow after parts of it settled.

  function request(op) {
    if (busy) { queue.push(op); return; }
    let failure = null;
    busy = true;
    try { op(); } catch (e) { failure = e; } finally { busy = false; }
    while (queue.length) {
      const next = queue.shift();
      busy = true;
      try { next(); } catch (e) {
        report({ source: "queued request", error: messageOf(e) }); // its caller has returned
      } finally { busy = false; }
    }
    if (failure) throw failure;
  }

  // ---- Lifetimes (P6, K7) -------------------------------------------------
  //
  // A computed node gets a new lifetime on each activation. Everything a function gets
  // through ctx belongs to the lifetime of the invocation that received it. Closing a
  // lifetime (last release or terminal) aborts its signal, releases dependencies in
  // declaration order, then runs its deactivation cleanups in registration order.
  // Output sent through a closed lifetime's ctx is dropped.

  function openLife(n) {
    n.life = { open: true, controller: null, hooks: { deactivation: [], invalidate: [] } };
  }

  function runCleanup(n, f) {
    try { f(); } catch (e) {
      report({ source: `cleanup ${n.id}`, error: messageOf(e) }); // P10: not n's ERROR
    }
  }

  function closeLife(n) {
    const life = n.life;
    if (!life?.open) return;
    life.open = false;
    life.controller?.abort();
    retireInputs(n);
    const hooks = life.hooks.deactivation;
    life.hooks = { deactivation: [], invalidate: [] };
    for (const f of hooks) runCleanup(n, f);
  }

  function assertAcquirable(n) {
    // P5: an ended output cannot be acquired again (restart is a module, O7).
    if (n.ended) throw new KernelError(`${n.id} has ended`);
    if (!n.active) for (const d of n.deps) assertAcquirable(nodeOf(d));
  }

  function activate(n) {
    n.active = true;
    if (n.kind === "state") return;
    openLife(n);
    n.deps.forEach((depId, i) => {
      const dep = nodeOf(depId);
      if (!dep.active) activate(dep);
      dep.subs.push({ kind: "node", id: n.id, dep: i });
      // K3: the dependency's START snapshot is this node's first received input.
      const snapshot = [];
      if (dep.has) snapshot.push(["DATA", dep.cache]);
      if (dep.ended) snapshot.push(dep.ended);
      n.inputs[i] = { has: dep.has, value: dep.cache, ended: dep.ended, frames: snapshot.length ? [snapshot] : [] };
    });
    // The activation invocation sees each snapshot as this wave's input. Waiting for
    // every dependency to have a value is a sugar policy, not a kernel gate. Nothing
    // subscribes to this node yet, so its output only sets the retained value that the
    // new subscriber's START snapshot will carry.
    const out = invoke(n);
    n.inputs.forEach((input) => { input.frames = []; });
    for (const m of out.flat()) {
      if (n.ended) break;
      if (m[0] === "DATA") { n.has = true; n.cache = m[1]; }
      if (m[0] === "INVALIDATE") { n.has = false; n.cache = undefined; }
      if (isTerminal(m)) n.ended = m;
    }
    if (n.ended) closeLife(n);
  }

  function release(dep, sub) {
    const i = dep.subs.indexOf(sub);
    if (i >= 0) dep.subs.splice(i, 1);
    if (dep.subs.length === 0 && dep.active) deactivate(dep);
  }

  function retireInputs(n) {
    n.deps.forEach((depId, i) => {
      const dep = nodeOf(depId);
      const sub = dep.subs.find((s) => s.kind === "node" && s.id === n.id && s.dep === i);
      if (sub) release(dep, sub);
    });
  }

  function deactivate(n) {
    n.active = false;
    if (n.kind === "state") return; // K7: plain state keeps its value across disconnect
    closeLife(n);
    n.privateState = undefined;
    n.inputs = n.deps.map(freshInput);
    if (!n.ended) {
      // K7: a computed node clears its output for a fresh activation.
      n.has = false;
      n.cache = undefined;
    }
  }

  // ---- Invocation (K4, P4, P9, P10) ---------------------------------------
  //
  // ctx.down called while the function runs is this invocation's output; each call is
  // its own array (R-wave-boundary). Called after the function returned, it is a new
  // wave from this node (P9): the kernel neither knows nor cares that the caller was
  // async. Called after the lifetime closed, it is dropped (R-ctx-lifetime).

  function invoke(n) {
    const life = n.life;
    // R-cleanup-hooks: this run's registrations replace the previous run's, which are
    // dropped without being called.
    const hooks = { deactivation: [], invalidate: [] };
    life.hooks = hooks;
    const out = [];
    let invoking = true;
    const register = (kind, f) => {
      // A registration that comes back after its lifetime closed is attempted once, now
      // (R-cleanup-hooks@2). Otherwise, during or after the run, it joins the current
      // run's registrations, as in TS.
      if (!life.open) { runCleanup(n, f); return; }
      life.hooks[kind].push(f);
    };
    const ctx = {
      // K4: per dependency, this wave's value arrays as TS waveData does it (each array
      // its DATA payloads in order; a RESOLVED array is []), its terminal this wave, and
      // the latest value received.
      deps: n.inputs.map((input) => ({
        waves: input.frames.filter((f) => f.some(isValue))
          .map((f) => f.filter((m) => m[0] === "DATA").map((m) => m[1])),
        terminal: input.frames.flat().find(isTerminal) ?? null,
        has: input.has,
        value: input.value,
      })),
      state: { get: () => n.privateState, set: (v) => { n.privateState = v; } },
      down(msgs) {
        // DS-17 O11: DIRTY is sent by the kernel only, as the prefix of a value array.
        // A node cannot open a notification and settle it later, so none spans time.
        if (msgs.some((m) => m[0] === "DIRTY")) {
          throw new KernelError(`${n.id}: DIRTY is sent by the kernel, not by node output`);
        }
        const frames = prepare(msgs);
        if (invoking) { out.push(...frames); return; }
        publishLater(n, life, msgs);
      },
      // Aborted when this lifetime closes; not by INVALIDATE or by a rerun. Created on
      // first access; first access after close returns an already aborted signal.
      get signal() {
        if (!life.controller) {
          life.controller = new AbortController();
          if (!life.open) life.controller.abort();
        }
        return life.controller.signal;
      },
      onDeactivation(f) { register("deactivation", f); },
      onInvalidate(f) { register("invalidate", f); },
    };
    running.push(n);
    try {
      n.fn(ctx);
    } catch (e) {
      return [[["ERROR", messageOf(e)]]]; // P10: what it sent before the throw is dropped
    } finally {
      running.pop();
      invoking = false;
    }
    return out;
  }

  // Output that is not part of the current wave: sent after an invocation returned
  // (P9), or anything a quiet node emits (H6). It becomes its own wave from n.
  // priorHooks: see settle.
  function publishLater(n, life, msgs) {
    if (staging && life.open) { stage(n, life, msgs); return; }
    publishFramesLater(n, life, prepare(msgs));
  }

  // Several arrays as one later wave from n (a quiet node's output of one settlement).
  function publishFramesLater(n, life, frames, priorHooks = null) {
    if (!frames.length) return;
    request(() => {
      if (!life.open || n.life !== life) return; // R-ctx-lifetime: old output is dropped
      runWave([{ node: n, frames, priorHooks }]);
    });
  }

  // ---- Waves (P3, K2, K6, H6) ---------------------------------------------

  function announce(n) {
    // P3: DIRTY reaches every reachable dependent before any settlement runs.
    // Membership is idempotent per connection. H6: a quiet node records its own dirty
    // inputs but does not pass the notification on.
    for (const sub of n.subs) {
      if (sub.kind !== "node") continue;
      const m = nodeOf(sub.id);
      if (m.ended) continue;
      m.dirtyDeps.add(sub.dep);
      if (!m.announced) {
        m.announced = true;
        if (!m.quiet) announce(m);
      }
    }
  }

  function deliverToSink(sub, from, msgs) {
    trace.push({ to: sub.id, from, msgs });
    if (!sub.cb) return;
    try { sub.cb(msgs); } catch (e) {
      // P10: a sink failure has no node to end; it goes to the host reporter and the
      // remaining deliveries of the wave continue.
      report({ source: `sink ${sub.id}`, error: messageOf(e) });
    }
  }

  // The current run's invalidate hooks. They stay registered after they run, as in TS:
  // a later effective INVALIDATE without a rerun runs them again.
  const invalidateHooks = (n) => [...(n.life?.hooks.invalidate ?? [])];

  // Publishes this node's arrays for the wave, in order, to each subscriber. All of them
  // go out in one call so that a dependent settles once on all of them.
  // priorHooks: invalidate hooks to run for the first effective INVALIDATE instead of the
  // current ones (a quiet node, see settle). applied: the first array is an INVALIDATE
  // that settle already applied.
  function publish(n, frames, { priorHooks = null, applied = false } = {}) {
    if (n.ended) return;
    const out = [];
    for (const [k, frame] of frames.entries()) {
      if (n.ended) break; // P5: nothing after a terminal
      if (k === 0 && applied) { out.push(frame); continue; }
      const f = [];
      for (const m of frame) {
        if (m[0] === "DATA") { n.has = true; n.cache = m[1]; }
        if (m[0] === "INVALIDATE") {
          // K6: effective only while a value is retained; a repeat is a no-op. This is
          // also why a diamond invalidates its fan-in once without any DIRTY.
          if (!n.has) continue;
          n.has = false;
          n.cache = undefined;
          // R-invalidate-idempotent: the value is already absent when these run.
          const hooks = priorHooks ?? invalidateHooks(n);
          priorHooks = null;
          for (const h of hooks) runCleanup(n, h);
        }
        if (isTerminal(m)) n.ended = m;
        f.push(m);
      }
      if (f.length) out.push(f);
    }
    // P4: an announced node that ends up with nothing settling still settles.
    if (n.announced && !out.some((f) => f.some(settles))) out.push([["RESOLVED"]]);
    if (!out.length) return;
    if (hasValue(out) && !n.announced) {
      // A node emitting a value without having announced (a source, later output, or a
      // node answering a terminal-only wave) announces its own cone first (P3).
      n.announced = true;
      announce(n);
    }
    for (const f of out) if (f.some(isValue)) f.unshift(["DIRTY"]); // K2: one per value array
    // K3: deliver to the subscriber list as it was when publication began.
    for (const sub of [...n.subs]) {
      if (sub.kind === "sink") for (const f of out) deliverToSink(sub, n.id, f);
      else receive(nodeOf(sub.id), sub.dep, out);
    }
    if (n.ended) closeLife(n); // K5/K7: an ended node closes its lifetime
  }

  function receive(m, i, frames) {
    if (m.ended) return;
    const input = m.inputs[i];
    for (const frame of frames) {
      const f = frame.filter((msg) => msg[0] !== "DIRTY");
      for (const msg of f) {
        if (msg[0] === "DATA") { input.has = true; input.value = msg[1]; }
        if (msg[0] === "INVALIDATE") { input.has = false; input.value = undefined; }
        if (isTerminal(msg)) input.ended = msg;
      }
      input.frames.push(f); // P2: every occurrence and every array boundary is kept
    }
    if (frames.some((f) => f.some(settles))) m.dirtyDeps.delete(i);
    if (m.dirtyDeps.size === 0) settle(m);
  }

  function settle(m) {
    if (!m.inputs.some((input) => input.frames.length)) return;
    const clear = () => m.inputs.forEach((input) => { input.frames = []; });

    // K5, error=auto: a dependency ERROR ends this node without running its function.
    const depError = m.inputs.flatMap((input) => input.frames.flat()).find((x) => x[0] === "ERROR");
    if (depError && m.terminal.error === "auto") {
      clear();
      if (m.quiet) publishLater(m, m.life, [depError]);
      else publish(m, [[depError]]);
      return;
    }

    // K6: an invalidated input invalidates this node's value without running the
    // function for it. What came before the INVALIDATE on that input is gone; what came
    // after it is ordinary input, for which the function runs below. The invalidation
    // is applied first, so its hooks (registered by the previous run) run before the
    // new run replaces them. A quiet node's value changes only in its later wave (H6),
    // so its hooks are taken now and run then.
    const isInvalidate = (f) => f[0]?.[0] === "INVALIDATE";
    const invalidated = m.inputs.some((input) => input.frames.some(isInvalidate));
    let priorHooks = null;
    let applied = false;
    if (invalidated) {
      for (const input of m.inputs) input.frames = input.frames.slice(input.frames.findLastIndex(isInvalidate) + 1);
      if (m.has && m.quiet) priorHooks = invalidateHooks(m);
      else if (m.has) {
        m.has = false;
        m.cache = undefined;
        for (const h of invalidateHooks(m)) runCleanup(m, h); // R-invalidate-idempotent
        applied = true;
      }
    }
    const lead = applied || (invalidated && m.quiet) ? [[["INVALIDATE"]]] : [];

    const rest = m.inputs.flatMap((input) => input.frames.flat());
    const manualTerminal = rest.some((x) =>
      isTerminal(x) && (x[0] === "COMPLETE" ? m.terminal.complete : m.terminal.error) === "manual");
    const runs = rest.some(isValue) || manualTerminal;
    const out = runs ? invoke(m) : [];
    clear();

    // K5, complete=auto: a separate postlude once every dependency has ended.
    const allEnded = m.inputs.every((input) => input.ended);
    const postlude = m.terminal.complete === "auto" && allEnded && !out.flat().some(isTerminal) ? [["COMPLETE"]] : [];

    if (m.quiet) {
      // H6: everything a quiet node outputs is a later wave; nothing downstream waits
      // on it, so silence needs no RESOLVED.
      // Its arrays of this settlement stay together, as one later wave.
      publishFramesLater(m, m.life, [...lead, ...out], priorHooks);
      if (postlude.length) publishFramesLater(m, m.life, [postlude]);
      return;
    }
    const frames = [...lead, ...out];
    if (frames.length || !postlude.length) publish(m, frames, { applied }); // P4: adds RESOLVED if silent
    if (postlude.length) publish(m, [postlude]);
  }

  function runWave(entries) {
    entries = entries.filter(({ node }) => !node.ended); // P5: input to an ended source is dropped
    if (!entries.length) return;
    try {
      // P3: announce every source of the wave before any settlement (batch, K2).
      for (const { node, frames } of entries) {
        if (hasValue(frames) && !node.announced) {
          node.announced = true;
          announce(node);
        }
      }
      for (const { node, frames, priorHooks } of entries) publish(node, frames, { priorHooks });
    } finally {
      for (const n of nodes.values()) { n.announced = false; n.dirtyDeps.clear(); }
    }
  }

  // ---- Host input ---------------------------------------------------------

  function hostInput(id, msg) {
    const n = nodeOf(id);
    if (n.kind !== "state") throw new KernelError(`${id} is not a state node`);
    const fn = running[running.length - 1];
    if (fn && dependsOn(fn, id)) {
      // A function writing its own upstream would feed its output back into its
      // input. Rejected; inside a node function the throw becomes its ERROR (P10).
      throw new KernelError(`${fn.id} wrote its upstream ${id}`);
    }
    if (n.ended) throw new KernelError(`${id} has ended`);
    if (staging) { stage(n, null, [msg]); return; }
    request(() => {
      // Checked again: a queued input may find its node ended by an earlier request.
      if (n.ended) throw new KernelError(`${id} has ended`);
      runWave([{ node: n, frames: [[msg]] }]);
    });
  }

  return {
    trace,
    state(id, initial) { makeNode(id, "state", [], null, {}, initial); return id; },
    node(id, deps, fn, opts) { makeNode(id, "node", deps, fn, opts, undefined); return id; },
    subscribe(sinkId, id, cb) {
      const n = nodeOf(id);
      if (!busy) assertAcquirable(n); // a queued subscribe reports this instead
      request(() => {
        assertAcquirable(n);
        if (n.subs.some((s) => s.kind === "sink" && s.id === sinkId)) return; // idempotent
        if (!n.active) activate(n);
        const sub = { kind: "sink", id: sinkId, cb };
        n.subs.push(sub);
        const snap = [["START"]];
        if (n.has) snap.push(["DATA", n.cache]);
        if (n.ended) snap.push(n.ended);
        deliverToSink(sub, id, snap);
      });
    },
    unsubscribe(sinkId, id) {
      const n = nodeOf(id);
      request(() => {
        const sub = n.subs.find((s) => s.kind === "sink" && s.id === sinkId);
        if (sub) release(n, sub);
      });
    },
    set(id, value) { hostInput(id, ["DATA", value]); },
    invalidate(id) { hostInput(id, ["INVALIDATE"]); },
    complete(id) { hostInput(id, ["COMPLETE"]); },
    error(id, err) { hostInput(id, ["ERROR", err]); },
    batch(body) {
      // DS-17 O3: a batch is one synchronous wave. An async function returns at its
      // first await, and the batch cannot hold the graph open until it finishes, so it
      // is refused before any of it runs.
      if (Object.prototype.toString.call(body) === "[object AsyncFunction]") {
        throw new KernelError("batch body is an async function; await first, then batch the writes");
      }
      const reportPromise = (result) => {
        // A plain function that returns a promise cannot be recognized beforehand. Its
        // synchronous part has really run and is committed; writes after its first
        // await happen later as separate waves, which the host is told about.
        if (typeof result?.then === "function") {
          report({ source: "batch", error: "batch body returned a promise; writes after its first await are separate waves" });
        }
        return result;
      };
      if (staging) return reportPromise(body()); // nested batch shares the outer accumulation
      staging = new Map();
      let staged, result;
      try { result = body(); staged = staging; } finally { staging = null; }
      reportPromise(result);
      // Nothing was delivered before commit, so a throwing body leaves nothing to undo.
      // Commit announces DIRTY to the whole cone, then publishes (O3).
      request(() => runWave([...staged]
        .map(([id, { msgs, life }]) => ({ node: nodeOf(id), frames: prepare(msgs), life }))
        // R-ctx-lifetime: a node's staged late output is dropped if its lifetime closed.
        .filter(({ node, life }) => !life || (life.open && node.life === life))));
    },
    // The retained value as of now. Reading never computes; whether a node is about to
    // change is node status (K10), not covered yet.
    get(id) {
      const n = nodeOf(id);
      return { active: n.active, has: n.has, value: n.cache, ended: n.ended };
    },
  };
}
