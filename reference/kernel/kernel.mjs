// GraphReFly kernel reference interpreter.
//
// Non-normative. Implements a subset of the kernel concerns in
// sessions/active/SESSION-kernel-module-classification.md (DS-17); see README.md for
// what is covered and what is not. Comments cite the DS-17 principles (P1-P10).
//
// The interpreter is deterministic and has no dependencies. A node function has the
// TS baseline's shape, (ctx) => void (R-fn-contract): it reads ctx.deps and ctx.state
// and emits only through ctx.down. Every delivery to a sink is appended to
// graph.trace, which is the observable behavior under test.

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
const freshInput = () => ({ has: false, value: undefined, ended: null, wave: [] });

// P2/K1: stable sort by tier; order within a tier and every DATA occurrence are kept.
function normalize(msgs) {
  for (const m of msgs) {
    if (!(m[0] in TIER)) throw new KernelError(`unknown message type ${m[0]}`);
  }
  return msgs.map((m, i) => [m, i]).sort((a, b) => TIER[a[0][0]] - TIER[b[0][0]] || a[1] - b[1]).map(([m]) => m);
}

// K2: DATA and RESOLVED cannot share one array. Treated here as a computation failure
// of the producing node; DS-17 does not yet fix this routing.
function checkOutput(down) {
  if (down.some((m) => m[0] === "DATA") && down.some((m) => m[0] === "RESOLVED")) {
    return [["ERROR", "DATA and RESOLVED in one array"]];
  }
  return down;
}

export function format(entry) {
  const body = entry.msgs.map((m) => (m.length > 1 ? `${m[0]}(${JSON.stringify(m[1])})` : m[0])).join(", ");
  return `${entry.to} <- ${entry.from}: [${body}]`;
}

export function createGraph() {
  const nodes = new Map();
  const trace = [];
  const reports = [];   // P10: failures with no caller to return to (host reporter)
  let staging = null;   // Map<nodeId, msgs[]> while a batch body runs
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
      // Per dependency: the latest value and terminal received, and this wave's messages.
      inputs: deps.map(freshInput),
    };
    nodes.set(id, n);
    return n;
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
        reports.push({ source: "queued request", error: messageOf(e) }); // its caller has returned
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
      reports.push({ source: `cleanup ${n.id}`, error: messageOf(e) }); // P10: not n's ERROR
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
      n.inputs[i] = { has: dep.has, value: dep.cache, ended: dep.ended, wave: [] };
      if (dep.has) n.inputs[i].wave.push(["DATA", dep.cache]);
      if (dep.ended) n.inputs[i].wave.push(dep.ended);
    });
    // The activation invocation sees each snapshot as this wave's input. Waiting for
    // every dependency to have a value is a sugar policy, not a kernel gate. Nothing
    // subscribes to this node yet, so its output only sets the retained value that the
    // new subscriber's START snapshot will carry.
    const out = invoke(n);
    n.inputs.forEach((input) => { input.wave = []; });
    for (const m of normalize(out)) {
      if (m[0] === "DATA") { n.has = true; n.cache = m[1]; }
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
  // ctx.down called while the function runs is this invocation's output. Called after
  // the function returned, it is a new wave from this node (P9): the kernel neither
  // knows nor cares that the caller was async. Called after the lifetime closed, it is
  // dropped (R-ctx-lifetime).

  function invoke(n) {
    const life = n.life;
    // R-cleanup-hooks: this run's registrations replace the previous run's, which are
    // dropped without being called.
    const hooks = { deactivation: [], invalidate: [] };
    life.hooks = hooks;
    const out = [];
    let invoking = true;
    const register = (kind, f) => {
      if (invoking) { hooks[kind].push(f); return; }
      // A registration that comes back after its lifetime closed is attempted once,
      // now. Registering later into a live lifetime is refused here.
      if (!life.open) { runCleanup(n, f); return; }
      throw new KernelError(`${n.id} registered cleanup after its invocation returned`);
    };
    const ctx = {
      // K4: per dependency, this wave's DATA occurrences, whether it settled with
      // RESOLVED, its terminal this wave, and the latest value received.
      deps: n.inputs.map((input) => ({
        data: input.wave.filter((m) => m[0] === "DATA").map((m) => m[1]),
        resolved: input.wave.some((m) => m[0] === "RESOLVED"),
        terminal: input.wave.find(isTerminal) ?? null,
        has: input.has,
        value: input.value,
      })),
      state: { get: () => n.privateState, set: (v) => { n.privateState = v; } },
      down(msgs) {
        if (invoking) { out.push(...msgs); return; }
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
      return [["ERROR", messageOf(e)]]; // P10
    } finally {
      running.pop();
      invoking = false;
    }
    return checkOutput(out);
  }

  // Output that is not part of the current wave: sent after an invocation returned
  // (P9), or anything a quiet node emits (H6). It becomes its own wave from n.
  function publishLater(n, life, msgs) {
    request(() => {
      if (!life.open || n.life !== life) return; // R-ctx-lifetime: old output is dropped
      runWave([{ node: n, msgs: checkOutput(msgs) }]);
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
      reports.push({ source: `sink ${sub.id}`, error: messageOf(e) });
    }
  }

  function publish(n, msgs) {
    if (n.ended) return;
    const out = [];
    let invalidated = false;
    for (const m of normalize(msgs)) {
      if (m[0] === "DATA") { n.has = true; n.cache = m[1]; }
      if (m[0] === "INVALIDATE") {
        // K6: effective only while a value is retained; a repeat is a no-op. This is
        // also why a diamond invalidates its fan-in once without any DIRTY.
        if (!n.has) continue;
        n.has = false;
        n.cache = undefined;
        invalidated = true;
      }
      if (isTerminal(m)) n.ended = m;
      out.push(m);
    }
    // P4: an announced node that ends up with nothing settling still settles.
    if (n.announced && !out.some(settles)) out.push(["RESOLVED"]);
    if (!out.length) return;
    if (out.some(isValue)) {
      if (!n.announced) {
        // A node emitting a value without having announced (a source, later output,
        // or a node answering a terminal-only wave) announces its own cone first (P3).
        n.announced = true;
        announce(n);
      }
      if (out[0][0] !== "DIRTY") out.unshift(["DIRTY"]); // K2: leading DIRTY
    }
    if (invalidated && n.life) {
      // R-invalidate-idempotent: the value is already absent when these run.
      const hooks = n.life.hooks.invalidate;
      n.life.hooks.invalidate = [];
      for (const f of hooks) runCleanup(n, f);
    }
    // K3: deliver to the subscriber list as it was when publication began.
    for (const sub of [...n.subs]) {
      if (sub.kind === "sink") deliverToSink(sub, n.id, out);
      else receive(nodeOf(sub.id), sub.dep, out);
    }
    if (n.ended) closeLife(n); // K5/K7: an ended node closes its lifetime
  }

  function receive(m, i, msgs) {
    if (m.ended) return;
    const input = m.inputs[i];
    for (const msg of msgs) {
      if (msg[0] === "DIRTY") continue;
      input.wave.push(msg); // P2: every occurrence reaches the function
      if (msg[0] === "DATA") { input.has = true; input.value = msg[1]; }
      if (msg[0] === "INVALIDATE") { input.has = false; input.value = undefined; }
      if (isTerminal(msg)) input.ended = msg;
    }
    if (msgs.some(settles)) m.dirtyDeps.delete(i);
    if (m.dirtyDeps.size === 0) settle(m);
  }

  function settle(m) {
    const waves = m.inputs.map((input) => input.wave);
    if (!waves.some((w) => w.length)) return;
    // H6: everything a quiet node outputs is a later wave; nothing downstream waits on
    // it, so silence needs no RESOLVED.
    const emit = (msgs) => (m.quiet ? msgs.length && publishLater(m, m.life, msgs) : publish(m, msgs));

    // K5, error=auto: a dependency ERROR ends this node without running its function.
    const depError = waves.flat().find((x) => x[0] === "ERROR");
    if (depError && m.terminal.error === "auto") {
      m.inputs.forEach((input) => { input.wave = []; });
      emit([depError]);
      return;
    }

    // K6: an invalidated input invalidates this node's value; the function does not
    // run for this wave. It runs again when the input has a value again.
    if (waves.flat().some((x) => x[0] === "INVALIDATE")) {
      m.inputs.forEach((input) => { input.wave = []; });
      emit([["INVALIDATE"]]);
      return;
    }

    const manualTerminal = waves.flat().some((x) =>
      isTerminal(x) && (x[0] === "COMPLETE" ? m.terminal.complete : m.terminal.error) === "manual");
    const runs = waves.flat().some(isValue) || manualTerminal;
    const out = runs ? invoke(m) : [];
    m.inputs.forEach((input) => { input.wave = []; });

    // K5, complete=auto: a separate postlude once every dependency has ended.
    const allEnded = m.inputs.every((input) => input.ended);
    const postlude = m.terminal.complete === "auto" && allEnded && !out.some(isTerminal) ? [["COMPLETE"]] : [];

    if (m.quiet) {
      emit([...out, ...postlude]);
      return;
    }
    if (out.length || !postlude.length) publish(m, out); // P4: publish adds RESOLVED if silent
    if (postlude.length) publish(m, postlude);
  }

  function runWave(entries) {
    entries = entries.filter(({ node }) => !node.ended); // P5: input to an ended source is dropped
    if (!entries.length) return;
    try {
      // P3: announce every source of the wave before any settlement (batch, K2).
      for (const { node, msgs } of entries) {
        if (msgs.some(isValue) && !node.announced) {
          node.announced = true;
          announce(node);
        }
      }
      for (const { node, msgs } of entries) publish(node, msgs);
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
    if (staging) {
      if (!staging.has(id)) staging.set(id, []);
      staging.get(id).push(msg);
      return;
    }
    request(() => {
      // Checked again: a queued input may find its node ended by an earlier request.
      if (n.ended) throw new KernelError(`${id} has ended`);
      runWave([{ node: n, msgs: [msg] }]);
    });
  }

  return {
    trace,
    reports,
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
          reports.push({ source: "batch", error: "batch body returned a promise; writes after its first await are separate waves" });
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
      request(() => runWave([...staged].map(([id, msgs]) => ({ node: nodeOf(id), msgs }))));
    },
    // The retained value as of now. Reading never computes; whether a node is about to
    // change is node status (K10), not covered yet.
    get(id) {
      const n = nodeOf(id);
      return { active: n.active, has: n.has, value: n.cache, ended: n.ended };
    },
  };
}
