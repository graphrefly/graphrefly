// sample, takeUntil, buffer and bufferCount over the reference kernel, written from their
// contracts (operators/contracts.jsonl, O-sample, O-takeUntil, O-buffer, O-bufferCount;
// graphrefly:D813). Non-normative, as the whole reference is.
//
// Each is one node with its recipe in its definition, so a graph that holds one can be captured
// (R-checkpoint); notifierRecipes goes in a restore's registry. None takes a callback. This file
// imports nothing, so notifier.mutants.test.mjs can load edited copies of it.
//
// The first three have two inputs of different roles: a source, whose DATA is collected or sent
// on, and a notifier, whose DATA is an action. That needs two policies the default does not give:
//   - manual INVALIDATE (R-invalidation): a source INVALIDATE retracts the output, and a notifier
//     INVALIDATE alone changes nothing. Under the auto policy either input's would retract it.
//   - manual COMPLETE (R-terminals): the source's COMPLETE ends the node, and the notifier's alone
//     does not. Under the auto policy the node would wait for both.
//   - manual ERROR (R-terminals): either input's ERROR ends the node, and what was pending is not
//     sent, as under the auto policy; but under that policy the kernel would also retract the
//     output for a notifier INVALIDATE that came in the ERROR's wave, and a notifier INVALIDATE
//     never retracts (the user, 2026-11-20). takeUntil needs it besides because a notifier DATA
//     ends the branch with COMPLETE whatever ERROR the wave carries (the user, the same day).
//
// What a notifier delivers in the run of the operator's activation is not an action, whatever the
// notifier held or sent then; its DATA in any later wave is (the user, 2026-11-20). The activation
// run is the first run of a lifetime: the one that finds no private state, or, in a restored
// node, the one that is handed the seed's note (ctx.seed, R-invocation). So what the notifier
// holds at a restored operator's first activation is not an action either, also when it changed
// while the graph was saved: the kernel compares values there, and could not see a tick of an
// equal value. The saved private state stands, unlike at an activation after a deactivation.
// What is not an action then is the notifier's DATA: a notifier that had ended with ERROR when
// the operator activates ends it with that ERROR, a terminal being no action (the user,
// 2026-11-21).
//
// The two inputs are distinct nodes: one node given as both is refused when the operator is built
// (O-common; the user, 2026-11-20). The kernel itself takes a repeated dependency.

const occurrences = (d) => d.waves.flat();
const completed = (d) => d.terminal?.[0] === "COMPLETE";
const errored = (d) => d.terminal?.[0] === "ERROR";
const activationRun = (ctx) => ctx.state.get() === undefined || ctx.seed !== undefined;
const firstError = (...deps) => deps.find(errored)?.terminal;
const twoRoles = { terminal: { complete: "manual", error: "manual" }, invalidate: "manual" };

// sample: private state is { pending: [value] } for a source value no tick has taken, { pending: [] }
// otherwise. The wave's source values are read before its tick, so the tick takes the last of them,
// also in the wave of the source's COMPLETE. A restored sample whose source no longer holds a value
// had its source invalidated while it was saved, and discards the pending value as it would have.
function sampleFn(ctx) {
  const [source, clock] = ctx.deps;
  const activation = activationRun(ctx);
  let pending = ctx.state.get()?.pending ?? [];
  if (source.invalidated) {
    pending = [];
    ctx.down([["INVALIDATE"]]);
  } else if (activation && !source.has) {
    pending = [];
  }
  const error = firstError(source, clock);
  if (error) { ctx.down([error]); return; }
  const values = occurrences(source);
  if (values.length) pending = [values[values.length - 1]];
  const tick = !activation && occurrences(clock).length > 0;
  const sent = tick ? pending : [];
  if (tick) pending = [];
  ctx.state.set({ pending });
  if (sent.length) ctx.down([["DATA", sent[0]]]);
  if (completed(source)) ctx.down([["COMPLETE"]]); // a pending value no tick took is not sent
}

// takeUntil: a notifier DATA completes the branch, and nothing else of that wave is sent: not the
// source's DATA, and no ERROR, the notifier's own included, which follows its DATA and so reaches
// a branch that has ended. Otherwise an ERROR of either input ends the branch without that wave's
// DATA, as the auto policy would (R-terminals), and the source's arrays pass as they came, its
// COMPLETE following as an array of its own, as a map's does.
function takeUntilFn(ctx) {
  const [source, notifier] = ctx.deps;
  const activation = activationRun(ctx);
  ctx.state.set({ started: true });
  if (source.invalidated) ctx.down([["INVALIDATE"]]);
  if (!activation && occurrences(notifier).length) { ctx.down([["COMPLETE"]]); return; }
  if (errored(source) || errored(notifier)) { ctx.down([errored(source) ? source.terminal : notifier.terminal]); return; }
  for (const w of source.waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));
  if (completed(source)) ctx.down([["COMPLETE"]]);
}

// buffer: private state is { items }, the payloads collected since the last batch. The wave's
// source values are collected before its flush. A source INVALIDATE keeps them. The source's
// COMPLETE sends a nonempty tail in the terminal's array; a batch sent for a flush in that wave is
// an array of its own and the COMPLETE follows in another, as O-common says of DATA the operator
// would have sent anyway.
function bufferFn(ctx) {
  const [source, flush] = ctx.deps;
  const activation = activationRun(ctx);
  let items = [...(ctx.state.get()?.items ?? []), ...occurrences(source)];
  if (source.invalidated) ctx.down([["INVALIDATE"]]);
  const error = firstError(source, flush);
  if (error) { ctx.down([error]); return; }
  const out = [];
  if (items.length && ((!activation && occurrences(flush).length) || completed(source))) {
    out.push(["DATA", items]);
    items = [];
  }
  if (completed(source)) out.push(["COMPLETE"]);
  ctx.state.set({ items });
  if (out.length === 2 && !activation && occurrences(flush).length) for (const message of out) ctx.down([message]);
  else if (out.length) ctx.down(out);
}

// bufferCount: one input, so the auto INVALIDATE policy already does what its contract says: the
// output is retracted and the private state, where the collected payloads are, is kept. Each batch
// is its own array, so the node's snapshot is always one batch (the user's choice, 2026-11-20).
// The source's COMPLETE goes in the array of a nonempty tail, and otherwise in one of its own.
const positiveInteger = (n) => Number.isInteger(n) && n >= 1;
const bufferCountFn = ({ n }) => {
  if (!positiveInteger(n)) throw new RangeError("bufferCount: n must be a positive integer");
  return (ctx) => {
    const [source] = ctx.deps;
    const items = [...(ctx.state.get()?.items ?? []), ...occurrences(source)];
    let at = 0;
    for (; items.length - at >= n; at += n) ctx.down([["DATA", items.slice(at, at + n)]]);
    const tail = items.slice(at);
    ctx.state.set({ items: completed(source) ? [] : tail });
    if (completed(source)) ctx.down(tail.length ? [["DATA", tail], ["COMPLETE"]] : [["COMPLETE"]]);
  };
};

const distinct = (name, a, b) => {
  if (a === b) throw new RangeError(`${name}: its inputs are distinct nodes`);
};

export function sample(g, id, sourceId, clockId) {
  distinct(`sample ${id}`, sourceId, clockId);
  return g.node(id, [sourceId, clockId], sampleFn, { ...twoRoles, recipe: { ref: "operators.sample", config: null } });
}

export function takeUntil(g, id, sourceId, notifierId) {
  distinct(`takeUntil ${id}`, sourceId, notifierId);
  return g.node(id, [sourceId, notifierId], takeUntilFn, { ...twoRoles, recipe: { ref: "operators.takeUntil", config: null } });
}

export function buffer(g, id, sourceId, flushId) {
  distinct(`buffer ${id}`, sourceId, flushId);
  return g.node(id, [sourceId, flushId], bufferFn, { ...twoRoles, recipe: { ref: "operators.buffer", config: null } });
}

export function bufferCount(g, id, sourceId, n) {
  if (!positiveInteger(n)) throw new RangeError(`bufferCount ${id}: n must be a positive integer`);
  return g.node(id, [sourceId], bufferCountFn({ n }), { terminal: { complete: "manual" }, recipe: { ref: "operators.bufferCount", config: { n } } });
}

// A recipe's policies travel in the checkpoint with the node (R-checkpoint), so a factory gives
// the function alone.
export const notifierRecipes = Object.freeze({
  "operators.sample": () => sampleFn,
  "operators.takeUntil": () => takeUntilFn,
  "operators.buffer": () => bufferFn,
  "operators.bufferCount": (config) => bufferCountFn(config ?? {}),
});
