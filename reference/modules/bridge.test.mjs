import test from "node:test";
import assert from "node:assert/strict";
import { createGraph } from "../kernel/kernel.mjs";
import { frameSink, frameSource, wireEdgeGroupIn, wireEdgeGroupOut } from "./bridge.mjs";

const enc = (v) => new TextEncoder().encode(JSON.stringify(v));
const dec = (b) => JSON.parse(new TextDecoder().decode(b));

// An in-memory channel the test delivers by hand: send queues a frame, flush delivers queued frames
// to the receiving end, hand delivers a frame the test built.
function channel() {
  let deliver = null;
  const queue = [];
  return {
    queue,
    send: (f) => queue.push(f),
    open: (d) => { deliver = d; return () => { deliver = null; }; },
    flush(n = queue.length) { for (const f of queue.splice(0, n)) deliver(f); },
    hand: (f) => deliver(f),
    get open_() { return deliver !== null; },
  };
}

// Counts a node function's runs and keeps what each run saw.
function counted(fn) {
  const runs = [];
  const wrapped = (ctx) => { runs.push(ctx.deps.map((d) => (d.has ? dec(d.value) : undefined))); fn(ctx); };
  wrapped.runs = runs;
  return wrapped;
}
const mapNode = (f) => (ctx) => { if (ctx.deps[0].waves.some((w) => w.length)) ctx.down([["DATA", enc(f(dec(ctx.deps[0].value)))]]); };
const dataOf = (msgs) => msgs.filter((m) => m[0] === "DATA").map((m) => m[1]);

// C-1: A and D in g1, B and C in g2; ga carries a from g1 to g2, gbc carries b and c back.
function crossGraphDiamond() {
  const c1 = channel(); // ga's frames, g1 -> g2
  const c2 = channel(); // gbc's frames, g2 -> g1
  const g1 = createGraph();
  const g2 = createGraph();
  g1.state("A", enc(1));
  wireEdgeGroupOut(g1, "ga", { group: "ga", edges: { a: "A" } });
  frameSource(g2, "ga.frames", c1.open);
  const ga = wireEdgeGroupIn(g2, "ga.in", { group: "ga", frames: "ga.frames", edges: ["a"] });
  g2.node("B", [ga.inbound.a], counted(mapNode((a) => a * 10)));
  g2.node("C", [ga.inbound.a], counted(mapNode((a) => a * 100)));
  wireEdgeGroupOut(g2, "gbc", { group: "gbc", edges: { b: "B", c: "C" } });
  frameSource(g1, "gbc.frames", c2.open);
  const gbc = wireEdgeGroupIn(g1, "gbc.in", { group: "gbc", frames: "gbc.frames", edges: ["b", "c"] });
  const dFn = counted((ctx) => {
    const [b, c] = ctx.deps;
    if (b.has && c.has) ctx.down([["DATA", enc(`${dec(b.value)}:${dec(c.value)}`)]]);
  });
  g1.node("D", [gbc.inbound.b, gbc.inbound.c], dFn);
  const dArrays = [];
  g1.subscribe("sd", "D", (msgs) => dArrays.push(dataOf(msgs).map(dec)));
  g2.subscribe("t2", "gbc", frameSink(c2.send));
  g1.subscribe("t1", "ga", frameSink(c1.send));
  return { g1, g2, c1, c2, dFn, dArrays };
}

test("C-1: each write of A is one cause each way, and D runs once on legs of the same A", () => {
  const { g1, c1, c2, dFn, dArrays } = crossGraphDiamond();
  c1.flush();
  assert.equal(c2.queue.length, 2, "gbc's first cause (no values yet) and the cause for A's first value");
  assert.deepEqual(c2.queue[1].edges.map((e) => e.edge), ["b", "c"], "one cause carries both legs");
  c2.flush();
  assert.deepEqual(dArrays.at(-1), ["10:100"], "D starts on B's and C's values over A's first value");
  const runs = dFn.runs.length;

  g1.set("A", enc(2));
  c1.flush();
  assert.equal(c2.queue.length, 1, "one g2 wave, one gbc cause");
  c2.flush();
  assert.equal(dFn.runs.length, runs + 1, "D runs once");
  assert.deepEqual(dFn.runs.at(-1), [20, 200]);
  assert.deepEqual(dArrays.at(-1), ["20:200"], "D's sinks get one array");

  g1.set("A", enc(3)); c1.flush();
  g1.set("A", enc(4)); c1.flush();
  assert.equal(c2.queue.length, 2);
  c2.flush();
  assert.deepEqual(dFn.runs.slice(-2), [[30, 300], [40, 400]], "two held causes, two g1 waves, in order");
  for (const [b, c] of dFn.runs.filter(([b, c]) => b !== undefined && c !== undefined)) {
    assert.equal(c, b * 10, "D never runs on one new and one old leg");
  }
});

// C-1b: a sender with edges x and y, a receiver with fan-in F over inbound x and y.
function oneHop({ xNode } = {}) {
  const ch = channel();
  const s = createGraph();
  const r = createGraph();
  s.state("x", enc("x0"));
  s.state("y", enc("y0"));
  if (xNode) xNode(s);
  wireEdgeGroupOut(s, "out", { group: "g", edges: { x: xNode ? "x2" : "x", y: "y" } });
  frameSource(r, "frames", ch.open);
  const grp = wireEdgeGroupIn(r, "in", { group: "g", frames: "frames", edges: ["x", "y"] });
  const fFn = counted(() => {});
  r.node("F", [grp.inbound.x, grp.inbound.y], fFn);
  const got = { x: [], y: [], issues: [] };
  r.subscribe("sx", grp.inbound.x, (m) => got.x.push(m));
  r.subscribe("sy", grp.inbound.y, (m) => got.y.push(m));
  r.subscribe("si", grp.issues, (m) => got.issues.push(...dataOf(m)));
  r.subscribe("sf", "F");
  s.subscribe("t", "out", frameSink(ch.send));
  return { s, r, ch, grp, fFn, got };
}
const body = (msgs) => msgs.filter((m) => m[0] !== "PENDING").map((m) => (m.length > 1 ? [m[0], dec(m[1])] : m));

test("C-1b: the first cause carries the snapshots; each sender wave is one cause of the edges that sent", () => {
  const { s, ch, fFn, got } = oneHop();
  assert.deepEqual(ch.queue.map((f) => [f.cause, f.edges.map((e) => e.edge)]), [[1, ["x", "y"]]]);
  ch.flush();
  assert.deepEqual(body(got.x.at(-1)), [["DATA", "x0"]]);
  const runs = fFn.runs.length;

  s.set("x", enc("x1"));
  s.set("y", enc("y1"));
  s.batch(() => { s.set("x", enc("x2")); s.set("y", enc("y2")); });
  assert.deepEqual(ch.queue.map((f) => [f.cause, f.edges.map((e) => e.edge)]), [[2, ["x"]], [3, ["y"]], [4, ["x", "y"]]]);
  ch.flush(1);
  assert.deepEqual(body(got.y.at(-1)), [["RESOLVED"]], "an edge the cause does not carry sends nothing");
  assert.equal(fFn.runs.length, runs + 1, "one receiver wave, F runs once");
  ch.flush();
  assert.equal(fFn.runs.length, runs + 3);
  assert.deepEqual(fFn.runs.at(-1), ["x2", "y2"]);
});

test("C-1b: an edge's arrays cross as they were sent, INVALIDATE and COMPLETE included", () => {
  const { s, ch, got } = oneHop({
    xNode: (g) => g.node("x2", ["x"], (ctx) => {
      if (!ctx.deps[0].waves.some((w) => w.length)) return;
      const v = dec(ctx.deps[0].value);
      ctx.down([["DATA", enc(`${v}a`)]]);
      ctx.down([["DATA", enc(`${v}b`)], ["DATA", enc(`${v}c`)]]);
    }),
  });
  ch.flush();
  s.set("x", enc("k"));
  assert.deepEqual(ch.queue.at(-1).edges[0].arrays.map((a) => a.map((m) => dec(m[1]))), [["ka"], ["kb", "kc"]], "two arrays stay two");
  const before = got.x.length;
  ch.flush();
  assert.deepEqual(got.x.slice(before).map(body), [[["DATA", "ka"]], [["DATA", "kb"], ["DATA", "kc"]]]);

  s.invalidate("x");
  s.complete("y");
  const n = got.x.length;
  ch.flush();
  assert.deepEqual(got.x.slice(n).map(body), [[["INVALIDATE"]], [["RESOLVED"]]]);
  assert.deepEqual(body(got.y.at(-1)), [["COMPLETE"]]);
});

test("C-1b: a new session starts the count again and invalidates an edge it has no value for", () => {
  const { s, ch, got } = oneHop();
  ch.flush();
  const first = got.x.length;
  s.unsubscribe("t", "out"); // the outbound node's lifetime, the session, ends
  s.invalidate("x");
  s.subscribe("t", "out", frameSink(ch.send));
  const [frame] = ch.queue;
  assert.equal(frame.cause, 1);
  assert.deepEqual(frame.edges.map((e) => [e.edge, e.arrays[0][0][0]]), [["x", "INVALIDATE"], ["y", "DATA"]]);
  ch.flush();
  assert.deepEqual(body(got.x.at(-1)), [["INVALIDATE"]], "the old session's x is dropped");
  assert.ok(got.x.length > first);
  assert.deepEqual(got.issues, [], "a new session is not a gap or a stale cause");
});

test("C-1b: stale causes are dropped, a gap is released and reported, bad frames are refused whole", () => {
  const { s, ch, got, fFn } = oneHop();
  ch.flush();
  s.set("x", enc("x1"));
  const sent = ch.queue[0];
  ch.flush();
  const sid = sent.session;
  const xData = () => got.x.flat().filter((m) => m[0] === "DATA").map((m) => dec(m[1]));
  const frame = (cause, edges) => ({ group: "g", session: sid, cause, edges });
  const data = (v) => [[["DATA", enc(v)]]];

  ch.hand(sent);                                     // a duplicate of a released cause
  ch.hand(frame(1, [{ edge: "x", arrays: data("old") }])); // an older cause
  assert.deepEqual(xData(), ["x0", "x1"], "neither is released");
  ch.hand(frame(4, [{ edge: "x", arrays: data("x4") }]));  // two past the last (2)
  assert.deepEqual(fFn.runs.at(-1), ["x4", "y0"], "the cause past the next is released");
  ch.hand(frame(5, [{ edge: "z", arrays: data("z") }]));
  ch.hand(frame(6, [{ edge: "x", arrays: [[["PENDING"]]] }]));
  ch.hand(frame(7, [{ edge: "y", arrays: [[["COMPLETE"]]] }, { edge: "x", arrays: data("x7") }]));
  ch.hand(frame(8, [{ edge: "y", arrays: data("after end") }, { edge: "x", arrays: data("x8") }]));
  ch.hand({ ...frame(9, [{ edge: "x", arrays: data("other") }]), group: "other" });
  ch.hand(frame(9, [{ edge: "x", arrays: data("x9") }]));
  assert.deepEqual(fFn.runs.at(-1), ["x9", "y0"], "refused frames released nothing, and 9 is no gap");
  assert.deepEqual(got.issues.map((i) => [i.kind, i.cause ?? i.from]), [
    ["stale", 2], ["stale", 1], ["gap", 3], ["refused", 5], ["refused", 6], ["refused", 8],
  ]);
  assert.equal(got.y.flat().some((m) => m[0] === "COMPLETE"), true, "frame 7 was valid: y completed");
  assert.equal(got.x.flat().some((m) => m[0] === "ERROR"), false, "no inbound node fails from an issue");
});

test("C-1b: a late subscriber to an inbound edge gets what the edge last brought", () => {
  const { s, r, ch, grp } = oneHop();
  ch.flush();
  s.set("y", enc("y1"));
  s.set("x", enc("x1")); // the last cause carries only x
  ch.flush();
  r.unsubscribe("sy", grp.inbound.y);
  r.unsubscribe("sf", "F"); // inbound y deactivates and drops its value
  assert.equal(r.get(grp.inbound.y).active, false);
  const late = [];
  r.subscribe("late", grp.inbound.y, (m) => late.push(m));
  assert.deepEqual(body(late[0]), [["START"], ["DATA", "y1"]]);
});

test("C-1b: a value that is not bytes is a throw of the outbound node, so its ERROR", () => {
  const s = createGraph();
  s.state("x", enc(1));
  wireEdgeGroupOut(s, "out", { group: "g", edges: { x: "x" } });
  const seen = [];
  s.subscribe("t", "out", (m) => seen.push(m));
  s.set("x", 2);
  assert.match(String(seen.flat().find((m) => m[0] === "ERROR")?.[1]), /not bytes/);
});
