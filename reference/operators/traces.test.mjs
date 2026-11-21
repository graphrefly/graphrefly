// Runs the canonical operator traces (operators/traces.jsonl, graphrefly:D813) on the reference
// kernel, for the operators the reference has. Non-normative, as the whole reference is: a pass is
// candidate evidence that a trace is consistent with the kernel rules, not a runtime result.
//
// A trace that uses an operator the reference lacks is skipped and named, so the list of skips is
// the list of operators without any run behind their traces. KNOWN_DIFFERENCES holds the traces the
// reference is known to fail, each with why; the test asserts they still fail, so the entry goes
// when the reference follows the contract. Neither is allowed to a trace of an active contract:
// the last test fails when one is skipped or listed as a difference.

import test from "node:test";
import assert from "node:assert/strict";
import { contracts, matches, passes, runTrace, runTraceOn, traces, unrunnable } from "./run-trace.mjs";

const KNOWN_DIFFERENCES = {
  "OT-20": "reference/modules/higher-order.mjs sends the superseded inner's DATA before it switches; O-switchMap@1 (Q2, 2026-11-18) applies the new selection first",
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
});

test("every trace of an active contract is run here and passes: none is skipped or a known difference", () => {
  const active = contracts.filter((row) => !row.transition && Array.isArray(row.activated_by) && row.activated_by.length);
  const held = active.flatMap((row) => [...row.traces, ...row.exceptions.flatMap((item) => item.traces)]
    .filter((id) => notRun.has(id)).map((id) => `${row.id}@${row.revision} ${id}: ${notRun.get(id)}`));
  assert.deepEqual(held, []);
});
