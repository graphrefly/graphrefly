// Replays C-34's next-execution clauses (spec/conformance.jsonl) against the restart module
// (DS-17 O7). In the module, S's next execution is a replace of its inner, `S/inner`, which
// the owner `S` asks for when its policy says so; REPLAY.md lists every clause.

import test from "node:test";
import assert from "node:assert/strict";
import { createGraph, format } from "../kernel/kernel.mjs";
import { restartable } from "./restart.mjs";

// S/inner hands out its ctx; the test sends DATA1+COMPLETE through it. X, during that
// fanout, asks to subscribe Z and to reuse its own callback, then throws.
function scene({ ownerFirst }) {
  const reports = [];
  const g = createGraph({ report: (r) => reports.push(r) });
  const inner = {};
  restartable(g, "S", { deps: [], fn: (ctx) => { inner.ctx = ctx; }, rounds: 2 });
  const X = (msgs) => {
    if (msgs[0][0] !== "DIRTY") return;
    g.subscribe("Z", "S/inner");
    g.subscribe("X", "S/inner", X);
    throw new Error("X failed");
  };
  if (ownerFirst) g.subscribe("down", "S");
  g.subscribe("X", "S/inner", X);
  g.subscribe("Y", "S/inner");
  if (!ownerFirst) g.subscribe("down", "S");
  const start = g.trace.length;
  inner.ctx.down([["DATA", 1], ["COMPLETE"]]);
  return { trace: g.trace.slice(start).map(format), reports };
}

test("C-34 on restart: Y gets the whole old array; the next execution starts after the fanout; Z gets its own START", () => {
  const { trace, reports } = scene({ ownerFirst: true });
  assert.deepEqual(trace, [
    "down <- S: [DIRTY, DATA(1)]",               // the owner forwards the value, not the COMPLETE
    "X <- S/inner: [DIRTY, DATA(1), COMPLETE]",
    "Y <- S/inner: [DIRTY, DATA(1), COMPLETE]",  // the full old array, although X threw
    "X <- S/inner: [START]",                     // the replace: X's registration goes on (O7)
    "Y <- S/inner: [START]",
    "Z <- S/inner: [START]",                     // Z, after the fanout and the old close
  ]);
  assert.deepEqual(reports, [{ source: "sink X", error: "X failed" }], "not S's ERROR; X's reuse request added nothing");
});

test("C-34 on restart: a request queued before the owner's replace gets the old execution's ended snapshot, then the new one", () => {
  // X and Y subscribed to the inner before the owner did, so X's requests are queued
  // ahead of the replace the owner asks for in the same fanout.
  const { trace, reports } = scene({ ownerFirst: false });
  assert.deepEqual(trace, [
    "X <- S/inner: [DIRTY, DATA(1), COMPLETE]",
    "Y <- S/inner: [DIRTY, DATA(1), COMPLETE]",
    "down <- S: [DIRTY, DATA(1)]",
    "Z <- S/inner: [START, DATA(1), COMPLETE]", // queued ahead of the replace (order-dependent)
    "X <- S/inner: [START]",
    "Y <- S/inner: [START]",
    "Z <- S/inner: [START]", // the replace keeps subscribers (decision 4)
  ]);
  assert.deepEqual(reports, [{ source: "sink X", error: "X failed" }]);
});
