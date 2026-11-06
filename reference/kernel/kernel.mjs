// GraphReFly kernel reference interpreter.
//
// Non-normative. Implements a subset of the kernel concerns in
// sessions/active/SESSION-kernel-module-classification.md (DS-17); see README.md for
// what is covered and what is not. Comments cite the DS-17 principles (P1-P10).
//
// The interpreter is deterministic and has no dependencies. Node functions are pure:
// they receive an invocation view and return { down, state }. Every delivery to a
// sink is appended to graph.trace, which is the observable behavior under test. A
// sink may also have a callback; callbacks and node functions that call back into the
// graph anyway (through a captured graph reference) are handled by K8 below.

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
const settles = (m) => isValue(m) || isTerminal(m);
const messageOf = (e) => (e instanceof Error ? e.message : e);

// P2/K1: stable sort by tier; order within a tier and every DATA occurrence are kept.
function normalize(msgs) {
  for (const m of msgs) {
    if (!(m[0] in TIER)) throw new KernelError(`unknown message type ${m[0]}`);
  }
  return msgs.map((m, i) => [m, i]).sort((a, b) => TIER[a[0][0]] - TIER[b[0][0]] || a[1] - b[1]).map(([m]) => m);
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
  let inWave = false;
  let touched = [];
  let settledThisWave = new Set();

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
    const terminal = { complete: "auto", error: "auto", ...(opts?.terminal ?? {}) };
    const n = {
      id, kind, deps, fn, terminal,
      subs: [],            // ordered: { kind: "sink", id, cb } | { kind: "node", id, dep }
      active: false,
      has: initial !== undefined,
      cache: initial,
      ended: null,         // P5: COMPLETE/ERROR message once output has ended
      privateState: undefined,
      announced: false,    // P3: this node announced DIRTY in the current wave
      dirtyDeps: new Set(),
      pending: deps.map(() => ({ data: [], resolved: false, terminal: null })),
      received: deps.map(() => ({ has: false, value: undefined, ended: null })),
      invocations: 0,
    };
    nodes.set(id, n);
    return n;
  }

  // ---- Out-of-wave requests (P7, K8) --------------------------------------
  //
  // A request that arrives while the kernel is busy (from a sink callback, or from a
  // node function that reaches the graph through a closure) is not run inside the
  // current wave. It waits and runs afterwards as its own request, in arrival order.
  // Running it immediately would let one wave's cone grow after parts of it settled.

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

  function assertAcquirable(n) {
    // P5: an ended output cannot be acquired again (restart is a module, O7).
    if (n.ended) throw new KernelError(`${n.id} has ended`);
    if (!n.active) for (const d of n.deps) assertAcquirable(nodeOf(d));
  }

  function activate(n) {
    n.active = true;
    if (n.kind === "state") return;
    n.deps.forEach((depId, i) => {
      const dep = nodeOf(depId);
      if (!dep.active) activate(dep);
      dep.subs.push({ kind: "node", id: n.id, dep: i });
      // K3: the dependency's initialization snapshot becomes this node's received input.
      n.received[i] = { has: dep.has, value: dep.cache, ended: dep.ended };
    });
    // Activation invocation: the function sees each dependency's retained value once.
    // Waiting for every dependency to have a value is a sugar policy, not a kernel gate.
    const view = n.deps.map((_, i) => ({
      data: n.received[i].has ? [n.received[i].value] : [],
      resolved: false,
      terminal: n.received[i].ended,
      ...n.received[i],
    }));
    // Nothing subscribes to this node yet, so its output only sets the retained value
    // that the new subscriber's START snapshot will carry. It is not a live wave.
    for (const m of normalize(invoke(n, view, true))) {
      if (m[0] === "DATA") { n.has = true; n.cache = m[1]; }
      if (isTerminal(m)) n.ended = m;
    }
    if (n.ended) retireInputs(n);
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
    retireInputs(n);
    n.privateState = undefined;
    n.received = n.deps.map(() => ({ has: false, value: undefined, ended: null }));
    if (!n.ended) {
      // K7: a computed node clears its output for a fresh activation.
      n.has = false;
      n.cache = undefined;
    }
  }

  // ---- Invocation (K4, P4, P10) -------------------------------------------

  function invoke(n, view, activation) {
    n.invocations += 1;
    let result;
    running.push(n);
    try {
      result = n.fn({ deps: view, state: n.privateState, activation }) ?? {};
    } catch (e) {
      return [["ERROR", messageOf(e)]]; // P10
    } finally {
      running.pop();
    }
    if ("state" in result) n.privateState = result.state;
    const down = result.down ?? [];
    const hasData = down.some((m) => m[0] === "DATA");
    const hasResolved = down.some((m) => m[0] === "RESOLVED");
    if (hasData && hasResolved) {
      // K2: DATA and RESOLVED cannot share one array. Treated here as a computation
      // failure of this node; DS-17 does not yet fix this routing.
      return [["ERROR", "DATA and RESOLVED in one array"]];
    }
    return down;
  }

  // ---- Waves (P3, K2) -----------------------------------------------------

  function announce(n) {
    // P3: DIRTY reaches every reachable dependent before any settlement runs.
    // Membership is idempotent per connection.
    for (const sub of n.subs) {
      if (sub.kind !== "node") continue;
      const m = nodeOf(sub.id);
      if (m.ended) continue;
      m.dirtyDeps.add(sub.dep);
      if (!m.announced) {
        m.announced = true;
        touched.push(m);
        announce(m);
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
    let out = normalize(msgs);
    if (out.some(isValue)) {
      if (!n.announced) {
        // A node emitting a value without having announced (a source, or a node
        // answering a terminal-only wave) announces its own cone first (P3).
        n.announced = true;
        touched.push(n);
        announce(n);
      }
      if (out[0][0] !== "DIRTY") out = [["DIRTY"], ...out]; // K2: leading DIRTY
    }
    if (out.some(settles)) settledThisWave.add(n);
    for (const m of out) {
      if (m[0] === "DATA") { n.has = true; n.cache = m[1]; }
      if (isTerminal(m)) n.ended = m;
    }
    // K3: deliver to the subscriber list as it was when publication began.
    for (const sub of [...n.subs]) {
      if (sub.kind === "sink") deliverToSink(sub, n.id, out);
      else receive(nodeOf(sub.id), sub.dep, out);
    }
    if (n.ended) retireInputs(n); // K5: an ended node no longer needs its inputs
  }

  function receive(m, i, msgs) {
    if (m.ended) return;
    let settled = false;
    for (const msg of msgs) {
      if (msg[0] === "DATA") {
        m.pending[i].data.push(msg[1]); // P2: every occurrence reaches the function
        m.received[i] = { ...m.received[i], has: true, value: msg[1] };
      } else if (msg[0] === "RESOLVED") {
        m.pending[i].resolved = true;
      } else if (isTerminal(msg)) {
        m.pending[i].terminal = msg;
        m.received[i] = { ...m.received[i], ended: msg };
      }
      if (settles(msg)) settled = true;
    }
    if (settled) m.dirtyDeps.delete(i);
    if (m.dirtyDeps.size === 0) settle(m);
  }

  function settle(m) {
    const pending = m.pending;
    m.pending = m.deps.map(() => ({ data: [], resolved: false, terminal: null }));
    const anyInput = pending.some((p) => p.data.length || p.resolved || p.terminal);
    if (!anyInput) return;

    // K5, error=auto: a dependency ERROR ends this node without running its function.
    const depError = pending.find((p) => p.terminal?.[0] === "ERROR");
    if (depError && m.terminal.error === "auto") {
      publish(m, [depError.terminal]);
      return;
    }

    const manualTerminal = pending.some((p) =>
      p.terminal && (p.terminal[0] === "COMPLETE" ? m.terminal.complete : m.terminal.error) === "manual");
    let out = [];
    if (pending.some((p) => p.data.length || p.resolved) || manualTerminal) {
      const view = pending.map((p, i) => ({ ...p, ...m.received[i], terminal: p.terminal }));
      out = invoke(m, view, false);
    }

    // K5, complete=auto: a separate postlude once every dependency has ended.
    const allEnded = m.received.every((r) => r.ended);
    const postlude = m.terminal.complete === "auto" && allEnded && !out.some(isTerminal);

    if (out.some(settles)) publish(m, out);
    else if (m.announced && !postlude) publish(m, [...out, ["RESOLVED"]]); // P4
    else if (out.length) publish(m, out);
    if (postlude) publish(m, [["COMPLETE"]]);
  }

  function runWave(entries) {
    entries = entries.filter(({ node }) => !node.ended); // P5: input to an ended source is dropped
    if (!entries.length) return;
    inWave = true;
    touched = [];
    settledThisWave = new Set();
    try {
      // P3: announce every source of the wave before any settlement (batch, K2).
      for (const { node, msgs } of entries) {
        if (msgs.some(isValue) && !node.announced) {
          node.announced = true;
          touched.push(node);
          announce(node);
        }
      }
      for (const { node, msgs } of entries) publish(node, msgs);
    } finally {
      for (const n of touched) { n.announced = false; n.dirtyDeps.clear(); }
      settledThisWave = new Set();
      inWave = false;
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

  // Pending: this node will receive or publish something before the current wave or the
  // open batch finishes, so its retained value is about to change or be confirmed.
  function isPending(n) {
    if (inWave) return n.announced && !settledThisWave.has(n);
    if (staging) return [...staging.keys()].some((s) => s === n.id || dependsOn(n, s));
    return false;
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
    // The retained value as of now, and whether the current wave or open batch will
    // still change or confirm it. Reading never computes.
    get(id) {
      const n = nodeOf(id);
      return { has: n.has, value: n.cache, pending: isPending(n) };
    },
    inspect(id) {
      const n = nodeOf(id);
      return { active: n.active, has: n.has, cache: n.cache, ended: n.ended, invocations: n.invocations };
    },
  };
}
