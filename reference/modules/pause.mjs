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
// held arrays go out in one wave, each as it arrived. An INVALIDATE passes at once and
// discards everything held before it, so downstream never receives a value older than an
// INVALIDATE it already has. A terminal passes at once, paused or not, and discards anything
// held. The pausable is one node with the manual INVALIDATE policy (K6, 2026-11-09): the
// INVALIDATE is its function's input. Until then it took two nodes, see the README.
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
// `${id}.pauseLocks` holding the lock list, and a handle to change it. The lock list is the
// only copy: each call is a set with a function (K8), computed from the list when it takes its place in
// request order, so several calls inside one wave do not lose each other's locks (the handle
// kept its own lock set for that until 2026-11-10). A default lock gets a random id, so a lock
// taken after a restore cannot coincide with one already held. A source that must stop
// working declares a dependency on locksId and starts or stops in its own function (O8).
export function controlPair(g, id) {
  const locksId = `${id}.pauseLocks`;
  g.state(locksId, Object.freeze([]));
  return {
    locksId,
    pause(lock = `${id}#${crypto.randomUUID()}`) {
      g.set(locksId, (ls = []) => (ls.includes(lock) ? ls : Object.freeze([...ls, lock])));
      return lock;
    },
    resume(lock) {
      g.set(locksId, (ls = []) => (ls.includes(lock) ? Object.freeze(ls.filter((l) => l !== lock)) : ls));
    },
  };
}

// `control` lets several pausables share one lock state, so that a node pausing at each
// of its inputs is released by one resume, in one wave (C-36).
export function pausable(g, id, inputId, { control = controlPair(g, id) } = {}) {
  // Manual terminals: only the input's terminal ends the node (the lock state's is ignored),
  // and it passes with whatever came in its array, so an unpaused pausable forwards an array
  // like [DATA, COMPLETE] or [DATA, ERROR] unchanged instead of dropping its DATA. Manual
  // INVALIDATE: the input's INVALIDATE reaches the function, which drops what it held.
  const opts = { terminal: { complete: "manual", error: "manual" }, invalidate: "manual" };
  g.node(id, [inputId, control.locksId], pausableFn, opts);
  return { id, ...control };
}

export const isPaused = (control) => control.has && control.value.length > 0;

// Private state: the arrays held since the last INVALIDATE, each as it arrived. While paused,
// nothing but a terminal goes out; unpaused (or on the resume), the held arrays and the new
// ones go out one per array, the input's terminal in the last of them.
function pausableFn(ctx) {
  const [input, control] = ctx.deps;
  let held = ctx.state.get() ?? [];
  if (input.invalidated) {
    held = [];
    ctx.down([["INVALIDATE"]]);
  }
  held = [...held, ...input.waves.filter((w) => w.length)];
  const end = input.terminal;
  if (isPaused(control)) {
    ctx.state.set(end ? [] : held);
    if (end) ctx.down([end]);
    return;
  }
  ctx.state.set([]);
  held.forEach((w, i) => ctx.down([...w.map((v) => ["DATA", v]), ...(end && i === held.length - 1 ? [end] : [])]));
  if (end && !held.length) ctx.down([end]);
}
