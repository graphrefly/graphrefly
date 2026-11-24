// Runs the canonical operator traces (operators/traces.jsonl, graphrefly:D813) on the reference
// kernel, for the operators the reference has. Non-normative, as the whole reference is: a pass is
// candidate evidence that a trace is consistent with the kernel rules, not a runtime result.
//
// A trace that uses an operator the reference lacks is skipped and named, so the list of skips is
// the list of operators without any run behind their traces. KNOWN_DIFFERENCES holds the traces the
// reference is known to fail, each with why; the test asserts they still fail, so the entry goes
// when the reference follows the contract. Neither is allowed to a trace of an active contract:
// the last test fails when one is skipped or listed as a difference.
//
// A trace with an advance step is run a second time with the timers that are due at the same
// instant fired in the other order, and must give the same, receiver by receiver: that order is
// not part of an expectation (operators/README.md), and neither is which of two nodes' sinks
// received first.

import test from "node:test";
import assert from "node:assert/strict";
import { contracts, matches, passes, runTrace, runTraceOn, traces, unrunnable } from "./run-trace.mjs";

const KNOWN_DIFFERENCES = {
};

const notRun = new Map(); // trace id -> why it is not a plain pass
for (const trace of traces) {
  const name = `${trace.id}: ${trace.name}`;
  const why = unrunnable(trace);
  if (why) {
    notRun.set(trace.id, why);
    test(name, { skip: why }, () => {});
  } else if (KNOWN_DIFFERENCES[trace.id]) {
    notRun.set(trace.id, `known difference: ${KNOWN_DIFFERENCES[trace.id]}`);
    test(`${name} (known difference: ${KNOWN_DIFFERENCES[trace.id]})`, async () => {
      assert.equal(await passes(trace), false, "the reference now gives this trace: remove it from KNOWN_DIFFERENCES");
    });
  } else {
    test(name, async () => {
      const { got, late } = runTraceOn(trace);
      if (!matches(got, trace.expect)) assert.deepEqual(got, trace.expect); // shows the difference
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.deepEqual(late(), [], "nothing arrives after the last step");
      if (!trace.steps.some((step) => step[0] === "advance")) return;
      const other = runTraceOn(trace, {}, { reverse: true }).got;
      if (!matches(other, got)) assert.deepEqual(other, got, "the same when timers due at the same instant fire in the other order");
    });
  }
}

test("every known difference names a trace that exists", () => {
  for (const id of Object.keys(KNOWN_DIFFERENCES)) assert.ok(traces.some((trace) => trace.id === id), id);
});

test("an expectation's ERROR without a payload accepts any payload, and nothing else is loose", () => {
  const got = [[["k", "m", [["PENDING"], ["ERROR", "whatever the runtime made of the throw"]]]]];
  assert.ok(matches(got, [[["k", "m", [["PENDING"], ["ERROR"]]]]]));
  assert.ok(!matches(got, [[["k", "m", [["PENDING"], ["ERROR", "boom"]]]]]));
  assert.ok(!matches([[["k", "m", [["PENDING"], ["COMPLETE"]]]]], [[["k", "m", [["PENDING"], ["ERROR"]]]]]));
  assert.ok(!matches([[["k", "m", [["PENDING"], ["DATA", 1], ["ERROR", "x"]]]]], [[["k", "m", [["PENDING"], ["ERROR"]]]]]));
});

test("a step is compared receiver by receiver: what one sink received from one node is in order, and which sink received first does not count", () => {
  const a = ["k", "m", [["PENDING"], ["DATA", 1]]], a2 = ["k", "m", [["PENDING"], ["DATA", 2]]], b = ["j", "n", [["PENDING"], ["DATA", 9]]];
  const late = ["late", "m", [["PENDING"], ["DATA", 1]]], late2 = ["late", "m", [["PENDING"], ["DATA", 2]]];
  assert.ok(matches([[a, b, a2]], [[b, a, a2]]), "sinks of different nodes");
  assert.ok(matches([[late, late2, a, a2]], [[a, a2, late, late2]]), "two sinks of one node");
  assert.ok(!matches([[a2, a, b]], [[a, a2, b]]), "what one sink received, in another order");
  assert.ok(!matches([[a, a2, late2, late]], [[a, a2, late, late2]]), "what the second sink of a node received, in another order");
  assert.ok(!matches([[a, late]], [[a, a2, late]]), "an entry missing");
  assert.ok(!matches([[a, b]], [[a]]), "a node that was not expected");
  assert.ok(!matches([[a, late]], [[a]]), "a sink that was not expected");
  assert.ok(!matches([[a], [b]], [[a, b], []]), "an entry in another step");
  assert.ok(!matches([[a]], [[a], []]), "a step missing");
  const odd = ["a", "b\u0000c", [["PENDING"], ["DATA", 1]]], odder = ["a\u0000b", "c", [["PENDING"], ["DATA", 2]]];
  assert.ok(matches([[odd, odder]], [[odder, odd]]), "names that would run together are still two receivers");
});

test("the runner refuses what it does not know instead of running something else", () => {
  const base = { detail: "messages", nodes: [{ id: "s", state: [] }, { id: "m", op: "map", deps: ["s"], args: { f: "double" } }], steps: [["subscribe", "k", "m"]], expect: [[]] };
  assert.throws(() => runTrace({ ...base, nodes: [base.nodes[0], { ...base.nodes[1], args: { f: "doubel" } }], steps: [["subscribe", "k", "m"], ["set", "s", 1]] }), /no callback named doubel/);
  assert.throws(() => runTrace({ ...base, nodes: [base.nodes[0], { id: "x", op: "switchMap", deps: ["s"], args: { project: "nonsense" } }] }), /no projector named nonsense/);
  assert.throws(() => runTrace({ ...base, steps: [["unsubscribe", "k", "m"]] }), /never subscribed/);
  assert.throws(() => runTrace({ ...base, steps: [["frobnicate", "s"]] }), /no frobnicate step/);
  assert.throws(() => runTrace({ ...base, nodes: [base.nodes[0], { ...base.nodes[1], args: { f: "double", throwOn: 3 } }] }), /does not know the option throwOn of map m/);
  assert.throws(() => runTrace({ ...base, nodes: [base.nodes[0], { ...base.nodes[1], args: { f: "double", n: 2 } }] }), /does not know the option n of map m/);
  assert.throws(() => runTrace({ ...base, nodes: [base.nodes[0], { ...base.nodes[1], arg: { f: "double" } }] }), /does not know the key arg of node m/);
  assert.throws(() => runTrace({ ...base, nodes: [{ id: "s", state: [], args: { n: 1 } }, base.nodes[1]] }), /state s takes no args/);
  assert.throws(() => runTrace({ ...base, nodes: [base.nodes[0], { ...base.nodes[1], deps: ["s", "s"] }] }), /map m takes 1 dependencies, and the trace gives 2/);
  assert.throws(() => runTrace({ ...base, nodes: [base.nodes[0], { id: "x", op: "sample", deps: ["s"] }] }), /sample x takes 2 dependencies, and the trace gives 1/);
  assert.throws(() => runTrace({ ...base, nodes: [base.nodes[0], { id: "x", op: "merge", deps: [] }] }), /merge x takes at least 1 dependencies/);
  assert.throws(() => runTrace({ ...base, nodes: [base.nodes[0], { ...base.nodes[1], deps: "s" }] }), /the deps of node m are a list of node ids/);
});

test("an advance step takes a positive integer and stands outside a batch, as a restore does; with no timer running it delivers nothing", () => {
  const base = { detail: "messages", nodes: [{ id: "s", state: [1] }, { id: "m", op: "map", deps: ["s"], args: { f: "double" } }], steps: [["subscribe", "k", "m"]], expect: [[]] };
  assert.deepEqual(runTrace({ ...base, steps: [["subscribe", "k", "m"], ["advance", 1000], ["set", "s", 2]] }).map((step) => step.length), [1, 0, 1]);
  for (const ms of [0, -5, 1.5, "100", null]) assert.throws(() => runTrace({ ...base, steps: [["subscribe", "k", "m"], ["advance", ms]] }), /advances by a positive integer/, String(ms));
  assert.throws(() => runTrace({ ...base, steps: [["subscribe", "k", "m"], ["batch", [["set", "s", 2], ["advance", 100]]]] }), /a batch holds no advance step/);
  assert.throws(() => runTrace({ ...base, steps: [["subscribe", "k", "m"], ["batch", [["restore"]]]] }), /a batch holds no restore step/);
});

test("every trace of an active contract is run here and passes: none is skipped or a known difference", () => {
  const active = contracts.filter((row) => !row.transition && Array.isArray(row.activated_by) && row.activated_by.length);
  const held = active.flatMap((row) => [...row.traces, ...row.exceptions.flatMap((item) => item.traces)]
    .filter((id) => notRun.has(id)).map((id) => `${row.id}@${row.revision} ${id}: ${notRun.get(id)}`));
  assert.deepEqual(held, []);
});
