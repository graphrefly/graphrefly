// Pause as a module over the reference kernel (DS-17 O8). Non-normative.
//
// A pausable node is placed in the graph in advance, between an input and whatever
// should stop. Its declared control pair is an ordinary dependency: a plain state node
// `${id}.pauseLocks` whose value is the list of locks currently held. So
//   - the control edge is a real edge that any observer can draw;
//   - pause is directed: each pausable has its own control state, and pausing p2 does
//     not touch p1 or p3;
//   - a pause or resume issued during a wave is a state write, so it waits for the wave
//     boundary like any other request (K8);
//   - the pause state is readable as that state's value, and survives the pausable's
//     close because plain state keeps its value (R-pause-lockset, K7).
// Nothing here needs a kernel hook, a class-1 message or a kernel change.
//
// One kind of pausable, no modes (R-pause-modes). While paused nothing goes out; every
// array that arrives is held, in order and with its boundaries. On the final resume all
// held arrays go out in one wave, each as it arrived. An INVALIDATE passes at once (the
// kernel runs no function for it, K6) and discards everything held before it, so
// downstream never receives a value older than an INVALIDATE it already has. A terminal
// passes at once, paused or not, and discards anything held.
//
// TS's two modes are where the pausable is placed, not two behaviors:
//   - before a node: that node does not run while paused, and on resume runs once on
//     every array held since the last INVALIDATE (TS default pause: the paused node's
//     function is skipped and runs once on resume, seeing everything buffered in
//     waveData);
//   - after a node: that node keeps computing and only its publication is held
//     (TS resumeAll).
// It takes two nodes, see below.

// The controller side of a declared control pair for node id: a plain state node
// `${id}.pauseLocks` holding the lock list, and a handle to change it. The handle keeps the
// authoritative lock set so that several calls inside one wave cannot lose each other's
// locks, and writes the whole set each time. A source that must stop working declares a
// dependency on locksId and starts or stops in its own function (O8).
export function controlPair(g, id) {
  const locksId = `${id}.pauseLocks`;
  g.state(locksId, Object.freeze([]));
  const locks = new Set();
  let next = 0;
  const write = () => g.set(locksId, Object.freeze([...locks]));
  return {
    locksId,
    pause(lock = `${id}#${++next}`) {
      if (!locks.has(lock)) { locks.add(lock); write(); }
      return lock;
    },
    resume(lock) {
      if (locks.delete(lock)) write();
    },
  };
}

// `control` lets several pausables share one lock state, so that a node pausing at each
// of its inputs is released by one resume, in one wave (C-36).
export function pausable(g, id, inputId, { control = controlPair(g, id) } = {}) {
  // The lock state never completes; only the input ends these nodes, hence manual complete.
  const opts = { terminal: { complete: "manual" } };
  g.node(`${id}.pauseLog`, [inputId, control.locksId], pauseLog, opts);
  g.node(id, [`${id}.pauseLog`, control.locksId], releaseLog, opts);
  return { id, ...control };
}

export const isPaused = (control) => control.has && control.value.length > 0;

// Why two nodes. To learn of every INVALIDATE, a node must have a value
// whenever it holds anything, because the kernel tells a node of an INVALIDATE only by
// invalidating its own value (onInvalidate). But a node that has a value shows it to its
// subscribers. So one node keeps the held values as its value, and a second one, the
// node downstream sees, releases them.

// `${id}.pauseLog`: its value is the queue of arrays held since the last INVALIDATE,
// each as it arrived. While paused, every arrival republishes the whole queue, so it has
// a value whenever it holds anything; every INVALIDATE that matters then invalidates it
// and clears its own state. While unpaused it publishes each wave's arrays (or, on
// resume, the queue it held).
function pauseLog(ctx) {
  const [input, control] = ctx.deps;
  ctx.onInvalidate(() => ctx.state.set([]));
  if (input.terminal?.[0] === "COMPLETE") { ctx.down([["COMPLETE"]]); return; }
  const arrived = input.waves.filter((w) => w.length);
  const queue = [...(ctx.state.get() ?? []), ...arrived];
  if (isPaused(control)) {
    ctx.state.set(queue);
    if (arrived.length) ctx.down([["DATA", queue]]);
    return;
  }
  ctx.state.set([]);
  if (queue.length) ctx.down([["DATA", queue]]);
}

// `${id}`: nothing while paused; unpaused, the queue the log just published, one array
// per held array, so the arrays keep the boundaries they arrived with.
function releaseLog(ctx) {
  const [log, control] = ctx.deps;
  if (log.terminal?.[0] === "COMPLETE") { ctx.down([["COMPLETE"]]); return; }
  if (isPaused(control) || !log.waves.flat().length) return;
  for (const w of log.value) ctx.down(w.map((v) => ["DATA", v]));
}
