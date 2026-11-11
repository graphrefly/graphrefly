// Wire edge groups (R-bridge) over the reference kernel. Non-normative.
//
// A group carries a fixed set of edges from a sender graph to a receiver graph.
//   - Sender: the group's outbound node depends on the group's edges. It is a fan-in, so it runs
//     at most once per wave on a consistent set of inputs (R-wave), and each run in which some edge
//     brought input is one cause: one frame, sent as one DATA value. A sink hands frames to the
//     transport; the transport is not the bridge's.
//   - Receiver: frames come out of a node with no dependencies whose setup opens the receiving end,
//     as a timer source's ticks do, so each frame is one wave. The gate checks it, and every inbound
//     node depends on the gate, so the edges of a cause settle in that one wave and a fan-in over
//     them runs once. Nothing waits across graphs and nothing is drained by hand.
//
// A frame: { group, session, cause, edges: [{ edge, arrays }] }. Each array holds only DATA,
// INVALIDATE, COMPLETE and ERROR messages, DATA values and ERROR payloads as bytes (Uint8Array).
// Bridge nodes carry no recipe: a checkpoint of them is not covered by R-bridge (their values are
// bytes, not JSON), so they are local-only.

const CROSSING = new Set(["DATA", "INVALIDATE", "COMPLETE", "ERROR"]);
const isTerminal = (m) => m[0] === "COMPLETE" || m[0] === "ERROR";
const isBytes = (v) => v instanceof Uint8Array;

// What one input brought in this run, as the outbound node's ctx gives it: an INVALIDATE (the
// manual policy shows it, and what came before it is gone), then the arrays that carried DATA, in
// order, then a terminal. An input that brought only RESOLVED brings nothing.
function brought(dep) {
  const arrays = [];
  if (dep.invalidated) arrays.push([["INVALIDATE"]]);
  for (const w of dep.waves) if (w.length) arrays.push(w.map((v) => ["DATA", v]));
  if (dep.terminal) arrays.push([dep.terminal]);
  return arrays;
}

// The sender side. `edges` maps each edge id to a node of this graph. A session is one lifetime of
// this node: its setup names the session, and its causes are numbered from 1. The first run brings
// every edge's snapshot; an edge without one gets an INVALIDATE, so a receiver that kept a value
// from an earlier session drops it.
export function wireEdgeGroupOut(g, id, { group, edges }) {
  const edgeIds = Object.keys(edges);
  g.node(id, edgeIds.map((e) => edges[e]), (ctx) => {
    const st = ctx.state.get();
    const first = st.cause === 0;
    const carried = [];
    ctx.deps.forEach((dep, i) => {
      const arrays = brought(dep);
      if (arrays.length) carried.push({ edge: edgeIds[i], arrays });
      else if (first) carried.push({ edge: edgeIds[i], arrays: [[["INVALIDATE"]]] });
    });
    if (!carried.length) return; // a run with no new input forms no cause
    for (const { edge, arrays } of carried) {
      for (const m of arrays.flat()) {
        if ((m[0] === "DATA" || m[0] === "ERROR") && !isBytes(m[1])) {
          throw new TypeError(`${id}: edge ${edge} sent a ${m[0]} that is not bytes; encode it before the edge`);
        }
      }
    }
    const cause = st.cause + 1;
    ctx.state.set({ ...st, cause });
    ctx.down([["DATA", Object.freeze({ group, session: st.session, cause, edges: carried })]]);
  }, {
    // Manual policies: the edges' terminals and INVALIDATEs are this node's input, to carry, not
    // to act on.
    terminal: { complete: "manual", error: "manual" },
    invalidate: "manual",
    setup: (ctx) => { ctx.state.set({ session: crypto.randomUUID(), cause: 0 }); },
  });
  return id;
}

// A sink callback that hands every frame a subscription delivers, the START snapshot's included,
// to `send`. A frame delivered twice is dropped by the receiver as a cause already taken.
export function frameSink(send) {
  return (msgs) => { for (const m of msgs) if (m[0] === "DATA") send(m[1]); };
}

// The receiving end: a node with no dependencies. Its setup calls open(deliver), which returns the
// close function; each deliver(frame) is a late output, so one wave.
export function frameSource(g, id, open) {
  g.node(id, [], () => {}, { setup: (ctx) => open((frame) => ctx.down([["DATA", frame]])) });
  return id;
}

// The receiver side: the gate `id` over `frames`, an inbound node `${id}/${edge}` per declared
// edge and the issues node `${id}.issues`.
export function wireEdgeGroupIn(g, id, { group, frames, edges }) {
  const manual = { terminal: { complete: "manual", error: "manual" } };
  g.node(id, [frames], gateFn(group, edges), manual);
  const inbound = Object.fromEntries(edges.map((e) => [e, `${id}/${e}`]));
  for (const e of edges) g.node(inbound[e], [id], inboundFn(e), manual);
  g.node(`${id}.issues`, [id], issuesFn, manual);
  return { gate: id, inbound, issues: `${id}.issues` };
}

// Private state: the current session, the last cause number taken in it, and the view, what each
// edge last brought (its last values, its terminal), which gives a late subscriber its snapshot.
// Each run with a frame of this group sends one value: the causes released, the issues, the view.
function gateFn(group, declared) {
  const known = new Set(declared);
  return (ctx) => {
    let st = ctx.state.get() ?? { session: null, last: 0, view: {} };
    const released = [];
    const issues = [];
    for (const frame of ctx.deps[0].waves.flat()) {
      if (frame?.group !== group) continue; // another group's frame on the same channel
      if (typeof frame.session !== "string" || !Number.isSafeInteger(frame.cause) || frame.cause < 1 || !Array.isArray(frame.edges)) {
        issues.push({ kind: "malformed", frame });
        continue;
      }
      if (frame.session !== st.session) st = { ...st, session: frame.session, last: 0 };
      const { session, cause } = frame;
      if (cause <= st.last) { issues.push({ kind: "stale", session, cause, last: st.last }); continue; }
      const gap = cause > st.last + 1 ? { kind: "gap", session, from: st.last + 1, to: cause - 1 } : null;
      st = { ...st, last: cause };
      const view = refuse(frame, known, st.view);
      if (typeof view === "string") { issues.push({ kind: "refused", session, cause, reason: view }); continue; }
      if (gap) issues.push(gap);
      st = { ...st, view };
      released.push(frame);
    }
    ctx.state.set(st);
    if (released.length || issues.length) {
      ctx.down([["DATA", Object.freeze({ released, issues, view: st.view })]]);
    }
  };
}

// Checks a frame against what its inbound nodes could send as their own output and returns the
// view after it, or the reason it is refused whole.
function refuse(frame, known, view) {
  try { return viewAfter(frame, known, view); } catch (e) {
    if (e instanceof BadFrame) return e.message;
    throw e;
  }
}
class BadFrame extends Error {}

function viewAfter(frame, known, view) {
  const next = { ...view };
  const seen = new Set();
  for (const entry of frame.edges) {
    const { edge, arrays } = entry ?? {};
    if (!known.has(edge)) throw new BadFrame(`undeclared edge ${edge}`);
    if (seen.has(edge)) throw new BadFrame(`edge ${edge} twice`);
    seen.add(edge);
    if (!Array.isArray(arrays) || !arrays.length) throw new BadFrame(`edge ${edge} carries no array`);
    let { values = null, terminal = null } = next[edge] ?? {};
    for (const a of arrays) {
      if (!Array.isArray(a) || !a.length) throw new BadFrame(`edge ${edge}: an empty array`);
      if (terminal) throw new BadFrame(`edge ${edge}: an array after its terminal`);
      a.forEach((m, i) => {
        if (!Array.isArray(m) || !CROSSING.has(m[0])) throw new BadFrame(`edge ${edge}: ${m?.[0]} does not cross`);
        if ((m[0] === "DATA" || m[0] === "ERROR") && !isBytes(m[1])) throw new BadFrame(`edge ${edge}: ${m[0]} without bytes`);
        if (isTerminal(m) && i !== a.length - 1) throw new BadFrame(`edge ${edge}: a terminal not last`);
      });
      // As the kernel applies it (R-wave, R-invalidation): what came before the last INVALIDATE is
      // gone and the value with it, the DATA after it is the value, and a terminal ends the edge.
      const k = a.findLastIndex((m) => m[0] === "INVALIDATE");
      if (k >= 0) values = null;
      const data = a.slice(k + 1).filter((m) => m[0] === "DATA").map((m) => m[1]);
      if (data.length) values = data;
      terminal = a.find(isTerminal) ?? null;
    }
    next[edge] = Object.freeze({ values, terminal });
  }
  return Object.freeze(next);
}

// An inbound node sends, in each wave, the arrays of its edge in the causes released, as its own
// output, and nothing when they do not carry it. Its first run in a lifetime sends instead what the
// edge last brought, from the gate's view, whichever frames carried it: that is its snapshot.
function inboundFn(edge) {
  return (ctx) => {
    const gates = ctx.deps[0].waves.flat();
    if (!ctx.state.get()) {
      ctx.state.set(true);
      const last = gates.at(-1)?.view[edge];
      if (last && (last.values || last.terminal)) {
        ctx.down([...(last.values ?? []).map((v) => ["DATA", v]), ...(last.terminal ? [last.terminal] : [])]);
      }
      return;
    }
    for (const { released } of gates) {
      for (const frame of released) {
        for (const a of frame.edges.find((e) => e.edge === edge)?.arrays ?? []) ctx.down(a);
      }
    }
  };
}

// The group's issues: drops, gaps and refusals, each a value. The first run of a lifetime does not
// repeat the issues of the gate's last value.
function issuesFn(ctx) {
  const gates = ctx.deps[0].waves.flat();
  if (!ctx.state.get()) { ctx.state.set(true); return; }
  const issues = gates.flatMap((x) => x.issues);
  if (issues.length) ctx.down(issues.map((i) => ["DATA", Object.freeze(i)]));
}
