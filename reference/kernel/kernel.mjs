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
// and a node may send several arrays in one wave. Subscribers receive each array;
// a dependent function sees them per dependency as ctx.deps[i].waves, like TS waveData.

// The closed set of message types (K1). Control is not a message (P11, K9), and there is
// no TEARDOWN: a lifetime ends at the last unsubscribe (K7). Both decided 2026-11-09.
export const TIER = Object.freeze({
  START: 0,
  DIRTY: 2,
  DATA: 3, RESOLVED: 3,
  INVALIDATE: 4,
  COMPLETE: 5, ERROR: 5,
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
  let staging = null;   // Map<nodeId, { msgs, lifetime }> while a batch body runs
  let batchRequests = null; // requests made in that body, run after its commit (O3, K8)
  let busy = false;     // K8: the kernel is running a request (wave, activation, release)
  const queue = [];     // K8: requests that arrived while busy, run in arrival order
  let running = null;   // the node whose function is executing; runs never nest (K8)

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
    // H4, optional (2026-11-08, for restore): { values?, ended?, state? } gives a computed node
    // its last array's values, terminal and private state without running its fn.
    const seed = opts?.seed;
    const values = seed ? [...(seed.values ?? [])] : initial !== undefined ? [initial] : [];
    const n = {
      id, kind, deps, fn,
      terminal: { complete: "auto", error: "auto", ...(opts?.terminal ?? {}) }, // O6
      quiet: Boolean(opts?.quiet), // H6: consumes input waves without forwarding DIRTY
      subs: [],            // ordered: { kind: "sink", id, cb } | { kind: "node", id, dep }
      active: false,
      lifetime: null,      // K7: the current lifetime of a computed node, see openLifetime; while it
                           // closes it is no longer open, and once closed it is gone
      // K3 (2026-11-08): the DATA values of the last array that had any, in order. The retained
      // value is the last of them; a new subscriber's START snapshot carries them all.
      values,
      has: values.length > 0,
      cache: values.at(-1),
      ended: seed?.ended ?? null, // P5: COMPLETE/ERROR message once output has ended
      privateState: seed?.state,
      pending: false,    // P3: notified in the current wave and not settled yet (stale)
      pendingDeps: new Set(),
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
  function stage(n, lifetime, msgs) {
    const entry = staging.get(n.id) ?? { msgs: [], lifetime };
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
    if (batchRequests) { batchRequests.push(op); return; } // the batch's wave has not run yet
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

  function openLifetime(n) {
    n.lifetime = { open: true, controller: null, hooks: { deactivation: [], invalidate: [] } };
  }

  function runCleanup(n, f) {
    try { f(); } catch (e) {
      report({ source: `cleanup ${n.id}`, error: messageOf(e) }); // P10: not n's ERROR
    }
  }

  function closeLifetime(n) {
    const lifetime = n.lifetime;
    if (!lifetime?.open) return;
    lifetime.open = false;
    lifetime.controller?.abort();
    releaseDeps(n);
    const hooks = lifetime.hooks.deactivation;
    lifetime.hooks = { deactivation: [], invalidate: [] };
    for (const f of hooks) runCleanup(n, f);
    n.lifetime = null;
  }

  // exchange matches dependencies by id, so both lists must be free of repeats.
  function assertDistinct(op, n, deps) {
    if (new Set(deps).size !== deps.length || new Set(n.deps).size !== n.deps.length) {
      throw new KernelError(`${op}: ${n.id} needs distinct dependencies`);
    }
  }

  function activate(n) {
    n.active = true;
    // P5: an ended node is connected and gives its snapshot, but never runs again.
    if (n.kind === "state" || n.ended) return;
    openLifetime(n);
    acquireDeps(n);
    // Nothing subscribes to this node yet, so publishing its output only sets the retained
    // value that the new subscriber's START snapshot will carry.
    down(n, firstRun(n));
  }

  // The first invocation of a lifetime sees each dependency's snapshot as its input. Waiting
  // for every dependency to have a value is a sugar policy, not a kernel gate. K5 applies to
  // the terminal a snapshot carries when a dependency has ended, as in settle: with auto policy
  // an ERROR ends the node without running its function, and once every dependency has ended,
  // COMPLETE follows the run (dropped if the run ended the node itself).
  function firstRun(n) {
    const depError = n.inputs.map((input) => input.ended).find((t) => t?.[0] === "ERROR");
    const out = depError && n.terminal.error === "auto" ? [[depError]] : invoke(n);
    n.inputs.forEach((input) => { input.frames = []; });
    const allEnded = n.deps.length > 0 && n.inputs.every((input) => input.ended);
    return n.terminal.complete === "auto" && allEnded ? [...out, [["COMPLETE"]]] : out;
  }

  function acquireDeps(n) {
    n.deps.forEach((_, i) => acquire(n, i));
  }

  function acquire(n, i) {
    const dep = nodeOf(n.deps[i]);
    if (!dep.active) activate(dep);
    dep.subs.push({ kind: "node", id: n.id, dep: i });
    n.inputs[i] = snapshotInput(dep);
  }

  // K3: what a new subscriber gets after START: the retained values, then the terminal (P5).
  function snapshotOf(n) {
    return [...n.values.map((v) => ["DATA", v]), ...(n.ended ? [n.ended] : [])];
  }

  // K3: a dependency's START snapshot is the first input it gives a new connection.
  function snapshotInput(dep) {
    const snapshot = snapshotOf(dep);
    return { has: dep.has, value: dep.cache, ended: dep.ended, frames: snapshot.length ? [snapshot] : [] };
  }

  function release(dep, sub) {
    const i = dep.subs.indexOf(sub);
    if (i >= 0) dep.subs.splice(i, 1);
    if (dep.subs.length === 0 && dep.active) deactivate(dep);
  }

  function releaseDeps(n) {
    n.deps.forEach((depId, i) => {
      const dep = nodeOf(depId);
      const sub = dep.subs.find((s) => s.kind === "node" && s.id === n.id && s.dep === i);
      if (sub) release(dep, sub);
    });
  }

  function deactivate(n) {
    n.active = false;
    if (n.kind === "state") return; // K7: plain state keeps its value across disconnect
    closeLifetime(n);
    n.privateState = undefined;
    n.inputs = n.deps.map(freshInput);
    if (!n.ended) {
      // K7: a computed node clears its output for a fresh activation.
      n.has = false;
      n.cache = undefined;
      n.values = [];
    }
  }

  // ---- Invocation (K4, P4, P9, P10) ---------------------------------------
  //
  // ctx.down called while the function runs is this invocation's output; each call is
  // its own array (R-wave-boundary). Called after the function returned, it is a new
  // wave from this node (P9): the kernel neither knows nor cares that the caller was
  // async. Called after the lifetime closed, it is dropped (R-ctx-lifetime).

  function invoke(n) {
    const lifetime = n.lifetime;
    // R-cleanup-hooks: this run's registrations replace the previous run's, which are
    // dropped without being called.
    const hooks = { deactivation: [], invalidate: [] };
    lifetime.hooks = hooks;
    const out = [];
    let invoking = true;
    const register = (kind, f) => {
      // A registration that comes back after its lifetime closed is attempted once, now
      // (R-cleanup-hooks@2). Otherwise, during or after the run, it joins the current
      // run's registrations, as in TS.
      if (!lifetime.open) { runCleanup(n, f); return; }
      lifetime.hooks[kind].push(f);
    };
    const ctx = {
      // K4: per dependency, this wave's value arrays as TS waveData does it (each array
      // its DATA payloads in order; a RESOLVED array is []), its terminal this wave, and
      // the latest value received.
      deps: n.inputs.map((input, i) => ({
        id: n.deps[i],
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
        later(n, lifetime, frames);
      },
      // Aborted when this lifetime closes; not by INVALIDATE or by a rerun. Created on
      // first access; first access after close returns an already aborted signal.
      get signal() {
        if (!lifetime.controller) {
          lifetime.controller = new AbortController();
          if (!lifetime.open) lifetime.controller.abort();
        }
        return lifetime.controller.signal;
      },
      onDeactivation(f) { register("deactivation", f); },
      onInvalidate(f) { register("invalidate", f); },
    };
    running = n;
    try {
      n.fn(ctx);
    } catch (e) {
      return [[["ERROR", messageOf(e)]]]; // P10: what it sent before the throw is dropped
    } finally {
      running = null;
      invoking = false;
    }
    return out;
  }

  // Output that is not part of the current wave: sent after an invocation returned
  // (P9), or what a quiet node emits (H6). It becomes its own wave from n, its arrays
  // together; inside a batch body it is staged instead (O3).
  function later(n, lifetime, frames) {
    if (!frames.length) return;
    if (staging && lifetime.open) { stage(n, lifetime, frames.flat()); return; }
    request(() => {
      if (!lifetime.open || n.lifetime !== lifetime) return; // R-ctx-lifetime: old output is dropped
      runWave([{ node: n, frames }]);
    });
  }

  // ---- Waves (P3, K2, K6, H6) ---------------------------------------------

  // Marks every node reachable from n pending (TS _markDirty), and records in each which
  // inputs it waits on. P3: this reaches the whole cone before any settlement runs.
  // Membership is idempotent per connection. H6: a quiet node records its own pending
  // inputs but does not pass the notification on.
  function markPending(n) {
    for (const sub of n.subs) {
      if (sub.kind !== "node") continue;
      const m = nodeOf(sub.id);
      if (m.ended) continue;
      m.pendingDeps.add(sub.dep);
      if (!m.pending) {
        m.pending = true;
        if (!m.quiet) markPending(m);
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
  const invalidateHooks = (n) => [...(n.lifetime?.hooks.invalidate ?? [])];

  // A node's output for the wave is applied to what the node holds, then delivered
  // (TS _down).
  const down = (n, frames) => deliver(n, apply(n, frames));

  // Writes the node's own output into what it holds (value, invalidation, terminal) and
  // returns the arrays that remain to be sent. Like TS's _down before _emitToSubs.
  function apply(n, frames) {
    const out = [];
    for (const frame of frames) {
      if (n.ended) break; // P5: nothing after a terminal
      const f = [];
      const values = [];
      for (const m of frame) {
        if (m[0] === "DATA") { n.has = true; n.cache = m[1]; values.push(m[1]); }
        if (m[0] === "INVALIDATE") {
          // K6: effective only while a value is retained; a repeat is a no-op, as in TS
          // (nothing downstream still holds a value from this node). This is also why a
          // diamond invalidates its fan-in once without any DIRTY.
          if (!n.has) continue;
          n.has = false;
          n.cache = undefined;
          n.values = [];
          // R-invalidate-idempotent: the value is already absent when these run.
          for (const h of invalidateHooks(n)) runCleanup(n, h);
        }
        if (isTerminal(m)) n.ended = m;
        f.push(m);
      }
      if (values.length) n.values = values; // K3: an array with values replaces the retained ones
      if (f.length) out.push(f);
    }
    return out;
  }

  // Sends arrays already applied to n. All of them go to one subscriber, then the next,
  // so that a dependent settles once on all of them.
  function deliver(n, out) {
    // P4: a pending node that ends up with nothing settling still settles.
    if (n.pending && !out.some((f) => f.some(settles))) out = [...out, [["RESOLVED"]]];
    if (!out.length) return;
    if (hasValue(out) && !n.pending) {
      // A node emitting a value without being pending (a source, later output, or a
      // node answering a terminal-only wave) marks its own cone pending first (P3).
      n.pending = true;
      markPending(n);
    }
    n.pending = false; // settled: its subscribers now see its new state
    out = out.map((f) => (f.some(isValue) ? [["DIRTY"], ...f] : f)); // K2: one per value array
    // K3: deliver to the subscriber list as it was when publication began.
    for (const sub of [...n.subs]) {
      if (sub.kind === "sink") for (const f of out) deliverToSink(sub, n.id, f);
      else receive(nodeOf(sub.id), sub.dep, out);
    }
    if (n.ended) closeLifetime(n); // K5/K7: an ended node closes its lifetime
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
    if (frames.some((f) => f.some(settles))) m.pendingDeps.delete(i);
    if (m.pendingDeps.size === 0) settle(m);
  }

  function settle(m) {
    if (!m.inputs.some((input) => input.frames.length)) return;
    const clear = () => m.inputs.forEach((input) => { input.frames = []; });

    // K5, error=auto: a dependency ERROR ends this node without running its function.
    const depError = m.inputs.flatMap((input) => input.frames.flat()).find((x) => x[0] === "ERROR");
    if (depError && m.terminal.error === "auto") {
      clear();
      if (m.quiet) { m.pending = false; later(m, m.lifetime, [[depError]]); }
      else down(m, [[depError]]);
      return;
    }

    // K6: an invalidated input invalidates this node's value without running the
    // function for it. What came before the INVALIDATE on that input is gone; what came
    // after it is ordinary input, for which the function runs below. The invalidation
    // is applied first, so its hooks (registered by the previous run) run before the
    // new run replaces them. It carries no DIRTY, so a quiet node passes it on now too.
    const isInvalidate = (f) => f[0]?.[0] === "INVALIDATE";
    let lead = [];
    if (m.inputs.some((input) => input.frames.some(isInvalidate))) {
      for (const input of m.inputs) input.frames = input.frames.slice(input.frames.findLastIndex(isInvalidate) + 1);
      lead = apply(m, [[["INVALIDATE"]]]); // [[INVALIDATE]] if m had a value, else []
    }

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
      // H6: what a quiet node outputs is a later wave, its arrays of one settlement
      // together; nothing downstream waits on it, so silence needs no RESOLVED. Only an
      // INVALIDATE, which carries no DIRTY, goes on now (as in TS).
      if (lead.length) deliver(m, lead);
      m.pending = false;
      later(m, m.lifetime, out);
      if (postlude.length) later(m, m.lifetime, [postlude]);
      return;
    }
    const frames = [...lead, ...apply(m, out)];
    if (frames.length || !postlude.length) deliver(m, frames); // P4: adds RESOLVED if silent
    if (postlude.length) down(m, [postlude]);
  }

  function runWave(entries) {
    entries = entries.filter(({ node }) => !node.ended); // P5: input to an ended source is dropped
    if (!entries.length) return;
    // P3: mark every source of the wave pending before any settlement (batch, K2).
    // Every pending node settles in this wave and clears its own flag and memberships, so
    // nothing is reset afterwards.
    for (const { node, frames } of entries) {
      if (hasValue(frames) && !node.pending) {
        node.pending = true;
        markPending(node);
      }
    }
    for (const { node, frames } of entries) down(node, frames);
  }

  // ---- Replace (DS-17 rewire row, O4, O7) ----------------------------------
  //
  // Graph-level replace: the node keeps its id and its subscribers, and gets a new
  // instance with new dependencies and a new function. The old lifetime closes (its
  // signal aborts, its late output is dropped, its cleanups run) and nothing of the old
  // instance survives: no value, private state or terminal. The dependencies are exchanged
  // as by rewire (a dependency in both lists keeps its connection, added ones are acquired
  // before removed ones are released), then the old cleanups run, as when a lifetime closes
  // (K7). The new instance is activated like a first subscription (K3): it gets each
  // dependency's START snapshot, kept ones included, and its first invocation only sets its
  // retained value; each sink gets a START snapshot and each dependent receives the
  // snapshot as its input, in one wave. Only the kernel can do this, because it rebinds the
  // dependents' input records.

  function replaceNode(n, deps, fn) {
    const old = n.lifetime; // null when inactive or when the old instance has ended
    if (old) { old.open = false; old.controller?.abort(); }
    if (!old) n.deps = []; // an ended instance has released its dependencies already
    exchange(n, deps);
    if (old) for (const f of old.hooks.deactivation) runCleanup(n, f);
    Object.assign(n, {
      fn, lifetime: null, values: [], has: false, cache: undefined, ended: null, privateState: undefined, pending: false,
    });
    n.pendingDeps.clear();
    if (!n.active) return; // the next subscription activates the new instance

    openLifetime(n);
    n.inputs = deps.map((depId) => snapshotInput(nodeOf(depId))); // a new instance: every record new
    apply(n, firstRun(n)); // the retained value only, as at a first activation

    const snap = snapshotOf(n);
    const nodeSubs = [];
    for (const sub of [...n.subs]) {
      if (sub.kind === "sink") deliverToSink(sub, n.id, [["START"], ...snap]);
      else { nodeOf(sub.id).inputs[sub.dep] = freshInput(); nodeSubs.push(sub); }
    }
    if (snap.length) {
      // One wave from n: its cone is marked pending first (P3), then each dependent
      // receives the snapshot as its input.
      if (hasValue([snap])) { n.pending = true; markPending(n); n.pending = false; }
      for (const sub of nodeSubs) receive(nodeOf(sub.id), sub.dep, [snap]);
    }
    if (n.ended) closeLifetime(n);
  }

  // ---- Rewire (C-8 surgical, 2026-11-08) -----------------------------------
  //
  // The node keeps its instance: lifetime, private state, retained value and fn runs go on.
  // The added dependencies' START snapshots are this node's input in one wave, as an
  // ordinary settlement: the fn runs and its output is delivered; if it sends nothing,
  // nothing goes below. An added dependency with no value sends nothing, so the fn does not
  // run for it. The new fn takes over the next run; a rewire alone causes none.

  function rewireNode(n, deps, fn) {
    n.fn = fn;
    const added = exchange(n, deps);
    if (added.some((i) => n.inputs[i].frames.length)) settle(n);
  }

  // Gives n the dependency list deps; shared by replace and rewire. An inactive node only
  // changes its list. For an active one, a dependency in both lists keeps its connection and
  // input record at its new position; an added one is acquired as at activation, before any
  // release, so a shared upstream stays active; then a removed one is released, without a
  // wave (between waves nothing of it is pending, K8). Returns the added positions.
  function exchange(n, deps) {
    if (!n.active) {
      n.deps = deps;
      n.inputs = deps.map(freshInput);
      return [];
    }
    const held = new Map(n.deps.map((depId, i) => [depId, {
      input: n.inputs[i],
      sub: nodeOf(depId).subs.find((s) => s.kind === "node" && s.id === n.id && s.dep === i),
    }]));
    const added = [];
    n.inputs = deps.map((depId, i) => {
      const kept = held.get(depId);
      if (!kept) { added.push(i); return freshInput(); }
      held.delete(depId);
      kept.sub.dep = i;
      return kept.input;
    });
    n.deps = deps;
    for (const i of added) acquire(n, i);
    for (const [depId, { sub }] of held) release(nodeOf(depId), sub);
    return added;
  }

  // ---- Host input ---------------------------------------------------------

  function hostInput(id, msg) {
    const n = nodeOf(id);
    if (n.kind !== "state") throw new KernelError(`${id} is not a state node`);
    const fn = running;
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
      // P5: an ended node can be subscribed; its START snapshot carries its terminal.
      request(() => {
        if (n.subs.some((s) => s.kind === "sink" && s.id === sinkId)) return; // idempotent
        if (!n.active) activate(n);
        const sub = { kind: "sink", id: sinkId, cb };
        n.subs.push(sub);
        deliverToSink(sub, id, [["START"], ...snapshotOf(n)]);
      });
    },
    unsubscribe(sinkId, id) {
      const n = nodeOf(id);
      request(() => {
        const sub = n.subs.find((s) => s.kind === "sink" && s.id === sinkId);
        if (sub) release(n, sub);
      });
    },
    // A request like any other (K8): during a wave it waits until the wave is over.
    replace(id, deps, fn) {
      const n = nodeOf(id);
      if (n.kind !== "node") throw new KernelError(`${id} is not a computed node`);
      assertDistinct("replace", n, deps);
      for (const d of deps) {
        if (d === id || dependsOn(nodeOf(d), id)) throw new KernelError(`replace: ${id} would depend on itself through ${d}`);
      }
      request(() => replaceNode(n, deps, fn));
    },
    // Surgical: the same instance with a new dependency list and fn. A request (K8).
    rewire(id, deps, fn) {
      const n = nodeOf(id);
      if (n.kind !== "node") throw new KernelError(`${id} is not a computed node`);
      assertDistinct("rewire", n, deps);
      for (const d of deps) {
        if (d === id || dependsOn(nodeOf(d), id)) throw new KernelError(`rewire: ${id} would depend on itself through ${d}`);
      }
      // An ended instance has nothing to keep; replace gives the node a new one.
      const check = () => { if (n.ended) throw new KernelError(`rewire: ${id} has ended`); };
      if (!busy) check(); // a queued rewire reports this instead
      request(() => { check(); rewireNode(n, deps, fn); });
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
      batchRequests = [];
      let staged, requests, result;
      try { result = body(); staged = staging; requests = batchRequests; } finally { staging = null; batchRequests = null; }
      reportPromise(result);
      // Nothing was delivered or changed before commit, so a throwing body leaves nothing to
      // undo: its inputs and its requests are dropped. Commit marks the whole cone pending
      // (DIRTY), then delivers (O3). The body's requests (subscribe, unsubscribe, replace,
      // rewire) were made during the batch's wave, so they run after it (K8), against the
      // committed topology, and before anything the commit wave itself requests.
      request(() => {
        queue.unshift(...requests);
        runWave([...staged]
          .map(([id, { msgs, lifetime }]) => ({ node: nodeOf(id), frames: prepare(msgs), lifetime }))
          // R-ctx-lifetime: a node's staged late output is dropped if its lifetime closed.
          .filter(({ node, lifetime }) => !lifetime || (lifetime.open && node.lifetime === lifetime)));
      });
    },
    // The retained value as of now. Reading never computes or activates.
    get(id) {
      const n = nodeOf(id);
      return { active: n.active, has: n.has, value: n.cache, values: [...n.values], ended: n.ended };
    },
    // True at a wave boundary: no request running or queued and no batch body open (O5).
    idle() { return !busy && !staging; }, // the queue drains before busy clears
    // The private state of the node's current lifetime, as of now (undefined without one).
    // Read for a checkpoint (R-snapshot); the kernel keeps no copy and never reads it.
    privateState(id) { return nodeOf(id).privateState; },
    // P1: the topology as data, in creation order: each node's id, kind, declared
    // dependencies and whether it is quiet (H6). Read-only; a structural subset of TS
    // describe(), without values or status.
    describe() {
      return [...nodes.values()].map((n) => ({ id: n.id, kind: n.kind, deps: [...n.deps], quiet: n.quiet }));
    },
    // K10, R-status-enum@2: a read-only projection of what the kernel already holds; no
    // status is stored. cache: empty (no value), stale (a notification this node received
    // or sent in the current wave is not settled yet; outside a wave never, since no
    // DIRTY spans time), ready. output: open, completed, errored. lifecycle: inactive,
    // active (subscribed, whether running or settled), closing (its lifetime is closing).
    status(id) {
      const n = nodeOf(id);
      return {
        cache: !n.has ? "empty" : n.pending ? "stale" : "ready",
        output: !n.ended ? "open" : n.ended[0] === "COMPLETE" ? "completed" : "errored",
        lifecycle: n.lifetime && !n.lifetime.open ? "closing" : n.active ? "active" : "inactive",
      };
    },
  };
}
