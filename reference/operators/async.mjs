// latestAsync over the reference kernel, written from its contract (operators/contracts.jsonl,
// O-latestAsync; graphrefly:D813). Non-normative.
//
// One node over its source, with its recipe in its definition; asyncRecipes goes in a restore's
// registry. This file imports nothing of the checkout, so async.mutants.test.mjs can load edited
// copies of it.
//
// f(value, signal) is called for the last value of a wave and gives its result later, in the
// language's own deferred form: here a Promise or a PromiseLike, or a plain value, which is the
// result itself. The result goes out through the ctx of the run that started the job, after
// that run returned, so it is a wave of its own (R-wave). Only the job that was started last
// may publish: a newer value, a source INVALIDATE and the lifetime's close each take that right
// from the job before and abort its signal, and what a job that lost the right resolves or
// fails with is ignored. Which job holds the right is kept per lifetime, under the lifetime's
// signal; the input it was started for is private state, { pending, sourceDone }, which a
// checkpoint saves, so a restored operator calls f again for it.
//
// Policies: manual INVALIDATE, since a source INVALIDATE revokes the job; manual COMPLETE,
// since after the source's COMPLETE the operator waits for its job; manual ERROR, as the other
// families have it, so the source's ERROR ends the operator in the function.
//
// As the user took them on 2026-11-24, most without a sentence: f is called in the run, so that
// a throw of f is a throw of the function (R-failure); a result that is no deferred value is the
// result itself; a job that has published is not aborted afterwards; a restored operator whose
// source changed starts a job for the new value alone, and one whose source no longer holds a
// value starts none; and a failed job's ERROR carries what R-failure gives a thrown value.

const occurrences = (d) => d.waves.flat();
const completed = (d) => d.terminal?.[0] === "COMPLETE";
const errored = (d) => d.terminal?.[0] === "ERROR";
// As R-failure gives a thrown value's payload: an error's message, or the value itself, and the
// empty string for one that cannot be a payload.
const payloadOf = (e) => {
  const payload = e instanceof Error ? e.message : e;
  return payload === undefined || typeof payload === "boolean" ? "" : payload;
};

// A restored operator's first activation (ctx.seed) whose source no longer holds a value: the
// source was invalidated while the graph was saved, whether or not it then ended. Until the first
// blind round a source that had been invalidated and then completed was not taken so, and the
// operator kept the input as pending with no job, and never ended.
const lostItsValue = (ctx, source) => ctx.seed !== undefined && !source.has;

export const asyncPolicies = Object.freeze({ terminal: Object.freeze({ complete: "manual", error: "manual" }), invalidate: "manual" });

// lifetime signal -> the job that may publish: { controller, release }
const current = new WeakMap();

function latestAsyncOf(f) {
  // Takes the right to publish from the job that holds it, and aborts its signal.
  const revoke = (ctx) => {
    const job = current.get(ctx.signal);
    if (!job) return;
    current.delete(ctx.signal);
    job.release();
    job.controller.abort();
  };
  const start = (ctx, value, sourceDone) => {
    revoke(ctx);
    const controller = new AbortController();
    const onClose = () => { current.delete(ctx.signal); controller.abort(); };
    ctx.signal.addEventListener("abort", onClose, { once: true });
    const job = { controller, release: () => ctx.signal.removeEventListener("abort", onClose) };
    current.set(ctx.signal, job);
    ctx.state.set({ pending: [value], sourceDone });
    const mine = () => current.get(ctx.signal) === job;
    // A job that has published is done: it is not aborted afterwards.
    const finish = () => { current.delete(ctx.signal); job.release(); };
    const result = f(value, controller.signal); // a throw here is the function's (R-failure)
    Promise.resolve(result).then((v) => {
      if (!mine()) return;
      const done = ctx.state.get()?.sourceDone === true; // a lifetime that closed has no state
      finish();
      ctx.state.set({ pending: [], sourceDone: done });
      // A result that is no value cannot be sent as DATA (R-messages): the operator ends with
      // ERROR (O-common).
      try { ctx.down([["DATA", v]]); } catch (e) { ctx.down([["ERROR", payloadOf(e)]]); return; }
      if (done) ctx.down([["COMPLETE"]]);
    }, (e) => {
      if (!mine()) return;
      finish();
      ctx.down([["ERROR", payloadOf(e)]]);
    });
  };
  const fn = (ctx) => {
    const [source] = ctx.deps;
    let { pending, sourceDone } = ctx.state.get() ?? { pending: [], sourceDone: false };
    if (source.invalidated === true || lostItsValue(ctx, source)) { revoke(ctx); pending = []; }
    if (source.invalidated === true) ctx.down([["INVALIDATE"]]);
    if (errored(source)) { revoke(ctx); ctx.state.set({ pending: [], sourceDone }); ctx.down([source.terminal]); return; }
    sourceDone ||= completed(source);
    ctx.state.set({ pending, sourceDone });
    const values = occurrences(source);
    if (values.length) { start(ctx, values[values.length - 1], sourceDone); return; }
    if (sourceDone && !pending.length) ctx.down([["COMPLETE"]]);
  };
  // A restored operator that holds a pending input calls f again for it, with a new signal,
  // while its source still holds that input and has not ended with ERROR. When the source
  // changed while the graph was saved, the function's run starts the new value's job, and
  // that one alone.
  const setup = (ctx) => {
    const st = ctx.state.get();
    const [source] = ctx.deps;
    const still = source.has && !errored(source) && st?.pending.length > 0 && JSON.stringify(source.value) === JSON.stringify(st.pending[0]);
    if (still) start(ctx, st.pending[0], st.sourceDone);
  };
  return { fn, setup };
}

// With `recipe`, a recipe { ref, config } that builds f, the operator carries its own recipe and
// a checkpoint can restore it.
export function latestAsync(g, id, sourceId, f, { recipe } = {}) {
  if (typeof f !== "function") throw new TypeError(`latestAsync ${id}: f is a function`);
  const built = latestAsyncOf(f);
  return g.node(id, [sourceId], built.fn, {
    ...asyncPolicies, setup: built.setup,
    ...(recipe !== undefined && { recipe: { ref: "operators.latestAsync", config: { f: recipe } } }),
  });
}

export const asyncRecipes = Object.freeze({
  "operators.latestAsync": ({ f }, at) => latestAsyncOf(at.make(f.ref, f.config).fn),
});
