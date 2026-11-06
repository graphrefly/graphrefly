// Demand (PULL) as a module over the reference kernel (DS-17 O2, R-pull). Non-normative.
//
// A pullable holder `id` sits after an input and stays quiet until it is pulled: input
// that arrives is held, and nothing reaches the holder's subscribers, not even DIRTY.
// `pull(params)`, a method of the returned bundle, asks for one service: the holder's
// function runs once with everything held since the last INVALIDATE and with the
// params, and what it sends goes out as a later wave. It runs even when nothing changed.
//
// The request travels through a declared control pair, as pause does (O8): `pull` writes
// the state node `${id}.pullDemand`, a real edge into the bundle. No class-1 message
// and no upward routing are needed, so no kernel change either.
//
// Nodes, created once by pullable():
//   inputId ──► id.pullLog ──► id          id.pullDemand ──► id.pullLog
//
// Rules from R-pull@2 and how they hold here:
//   - A pull while the holder is inactive does nothing: it neither activates the holder
//     nor is kept for later. (The demand state keeps its value, so on activation the log
//     records the request already there as seen and serves only later ones.)
//   - Several pulls before one service keep only the latest params (a batch of pulls is
//     one wave; the log serves the newest request in it).
//   - The holder runs only at actual service; what it sends is ordinary output.
// Difference from TS: a new subscriber gets the holder's last served value in its START,
// since the kernel puts the retained value in every START; a TS pull node gives START
// only.

// `${id}.pullLog`: like `${id}.pauseLog`, its value is what it holds since the last
// INVALIDATE, republished on every arrival so it always has a value while holding
// anything, which is how its own onInvalidate sees every INVALIDATE. On a fresh request
// it publishes a service record carrying the held arrays and the params, and empties.
function pullLog(ctx) {
  const [input, demand] = ctx.deps;
  // First run of this lifetime: a request already in the demand state is old.
  const state = ctx.state.get() ?? { queue: [], seen: demand.has ? demand.value.seq : 0 };
  ctx.state.set(state);
  ctx.onInvalidate(() => ctx.state.set({ ...ctx.state.get(), queue: [] }));
  if (input.terminal?.[0] === "COMPLETE") { ctx.down([["COMPLETE"]]); return; }
  const arrived = input.waves.filter((w) => w.length);
  const queue = [...state.queue, ...arrived];
  const request = demand.waves.flat().filter((r) => r.seq > state.seen).at(-1);
  if (request) {
    ctx.state.set({ queue: [], seen: request.seq });
    ctx.down([["DATA", { queue, has: input.has, value: input.value, params: request.params }]]);
    return;
  }
  ctx.state.set({ ...state, queue });
  if (arrived.length) ctx.down([["DATA", { queue }]]);
}

// `${id}`, quiet (H6): on a service record, runs the author's function once with
// ctx.deps[0] showing the held arrays and ctx.pull.params; otherwise does nothing, and,
// being quiet, shows nothing downstream.
const holder = (serve) => (ctx) => {
  const [log] = ctx.deps;
  const service = log.waves.flat().filter((r) => "params" in r).at(-1);
  if (!service) return;
  const view = Object.create(ctx);
  view.deps = [{ waves: service.queue, terminal: null, has: service.has, value: service.value }];
  view.pull = { params: service.params };
  serve(view);
};

export function pullable(g, id, inputId, serve) {
  const demandId = `${id}.pullDemand`;
  const logId = `${id}.pullLog`;
  g.state(demandId); // no value until the first pull
  let seq = 0;
  // The demand state never completes; only the input ends the log, hence manual complete.
  g.node(logId, [inputId, demandId], pullLog, { terminal: { complete: "manual" } });
  g.node(id, [logId], holder(serve), { quiet: true }); // ends when the log ends (auto complete)
  return {
    id,
    demandId,
    pull(params) { g.set(demandId, Object.freeze({ seq: ++seq, params })); },
  };
}
