// Mutations of both arms, each run against the unchanged photo-scenes spec (the unmutated
// arms pass it: spec.test.mjs). A mutant edits
// the bytes the runner loads, never the checkout. It is killed when every test still loads
// and runs (27 results) and at least one fails; a load error does not count. A test that
// hangs under a mutant fails by timeout, which counts: the spec awaits the outcome.
//
// Three groups:
//   1. the nine mutations photo-scenes' evidence lists for its package, on both arms;
//   2. one mutant per QA bug class (Codex's code QA Q1–Q10), on each arm that can express it;
//   3. the real history: the package as it was before each QA round was fixed.

import test from "node:test";
import assert from "node:assert/strict";
import { availableParallelism } from "node:os";
import { runSpec } from "./run-spec.mjs";

const P = "packages/operations/src/index.ts";
const G = "reference/operation-tree/graph-operations.mjs";
const e = (path, from, to) => ({ path, from, to });

// Group 1: photo-scenes' own mutation list (docs/evidence/2026-11-04-ops-operation-tree.md).
const listed = [
  ["sync ignores liveness",
    e(P, "sync(effect: () => void): boolean {\n\t\t\t\tif (!run.alive) return false;", "sync(effect: () => void): boolean {"),
    e(G, "        if (!alive(run)) return false;\n        effect();", "        effect();")],
  ["handles from a dead run act on the current run",
    e(P, "const alive = () => boundTo === null || boundTo.alive;", "const alive = () => true;"),
    e(G, "const ok = () => boundTo === null || alive(boundTo);", "const ok = () => true;")],
  ["cancellation skips children",
    e(P, "for (const child of r.children) invalidate(child);", ""),
    e(G, "for (const [path, s] of Object.entries(st.slots)) for (const run of s.runs) if (run.alive) kill(path, run);", "")],
  ["queue behaves like preempt",
    e(P, 'const policy = definition.conflictPolicy ?? "preempt";', 'const policy = definition.conflictPolicy === "queue" ? "preempt" : (definition.conflictPolicy ?? "preempt");'),
    e(G, 'const policy = slot.definition.conflictPolicy ?? "preempt";', 'const policy = slot.definition.conflictPolicy === "queue" ? "preempt" : (slot.definition.conflictPolicy ?? "preempt");')],
  ["a run settles without waiting for its waited promises",
    e(P, "while (run.pending.size > 0) await Promise.allSettled([...run.pending]);", ""),
    e(G, "while (run.pending.size > 0) await Promise.allSettled([...run.pending]);", "")],
  ["wait does not reject on abort",
    e(P, "const onAbort = () => reject(abortedError());", "const onAbort = () => {};"),
    e(G, "const onAbort = () => reject(abortedError());", "const onAbort = () => {};")],
  ["locks compared across containers (Q6)",
    e(P, "if (a.parent !== b.parent || a.isContainer || b.isContainer) return false;", "if (a.isContainer || b.isContainer) return false;"),
    null], // graph: a container's runs node sees only its own children; see the README
  ["drop ignores cancelled runs that still hold the lock (Q4)",
    e(P, "if (conflictingRuns.length > 0 || conflictingWaiters.length > 0)", "if (conflictingRuns.some((run) => run.alive) || conflictingWaiters.length > 0)"),
    e(G, "if (runs.length || waiters.length)", "if (runs.some((r) => r.run.alive) || waiters.length)")],
  ["a body is entered although its run died before entry (Q1)",
    e(P, "if (run.alive) {\n\t\t\ttry {\n\t\t\t\tawait definition.run", "if (true) {\n\t\t\ttry {\n\t\t\t\tawait definition.run"),
    e(G, "    if (alive(run)) {\n      try {", "    if (true) {\n      try {")],
];

// Group 2: each QA bug class put back. null: the arm has no code where it could go.
const qa = [
  ["Q1: a callback runs while the cancelled subtree is half dead",
    e(P, "\t\t\t\tr.alive = false;\n\t\t\t\tif (r.node.current === r) r.node.current = null;\n\t\t\t\tdying.push(r);", "\t\t\t\tr.alive = false;\n\t\t\t\tr.controller.abort();\n\t\t\t\tif (r.node.current === r) r.node.current = null;\n\t\t\t\tdying.push(r);"),
    e(G, 'if (type === "DATA") fresh.push(v);', 'if (type === "DATA") { fresh.push(v); for (const id of v.aborts) live.get(id)?.controller.abort(); }')],
  ["Q2: admission enters a body while it drains the queue",
    e(P, "return new Promise((resolve) => this.defer(() => resolve(this.execute(run, args))));", "return this.execute(run, args);"),
    null], // graph: the admission node holds no body to call; bodies are the host's
  ["Q3: the queue is not drained after a cancel",
    e(P, "\t\t\tthis.drain();\n\t\t\tconst effect = frame.effects.shift();\n\t\t\tif (!effect) return;", "\t\t\tconst effect = frame.effects.shift();\n\t\t\tif (!effect) return;\n\t\t\tthis.drain();"),
    e(G, "    for (;;) {", '    for (; !ctx.deps[0].waves.flat().some((c) => c?.type === "cancel");) {')],
  ["Q5: a task root is accepted",
    e(P, "if (\"run\" in definition) throw new Error(`${path}: the root must be a container, not a task`);", ""),
    e(G, "if (\"run\" in definition) throw new Error(`${path}: the root must be a container, not a task`);", "")],
  ["Q7: an observer's error escapes into the change",
    // Survives: plain catches an observer's error twice, in observe and again in flush.
    { ...e(P, "private observe(call: () => void) {\n\t\ttry {\n\t\t\tcall();\n\t\t} catch (error) {\n\t\t\tthis.report(error);\n\t\t}\n\t}", "private observe(call: () => void) {\n\t\tcall();\n\t}"), survives: true },
    e(G, "try { while (queue.length) guarded(queue.shift()); }", "try { while (queue.length) queue.shift()(); }")],
  ["Q8: a nested change's aborts wait for the outer callbacks",
    e(P, "this.deferInChange(() => r.controller.abort());", "this.defer(() => r.controller.abort());"),
    e(G, "if (draining) abortAll.forEach(guarded);\n    else queue.push(...abortAll);", "queue.push(...abortAll);")],
  ["Q9: a nested change runs its callbacks at once",
    e(P, "private defer(effect: () => void) {\n\t\tconst outermost = this.frames[0];", "private defer(effect: () => void) {\n\t\tconst outermost = this.frames.at(-1);"),
    e(G, "for (const e of enters) queue.push(() => answer(e.reqId, execute(live.get(e.runId))));", "for (const e of enters) answer(e.reqId, execute(live.get(e.runId)));")],
  ["Q10: with no handler and no reportError, an observer error is lost",
    e(P, "\t\telse\n\t\t\tqueueMicrotask(() => {\n\t\t\t\tthrow error;\n\t\t\t});", ""),
    e(G, "    else queueMicrotask(() => { throw error; });", "")],
];

// Group 3: photo-scenes' own history. Each version fails exactly the QA tests written after it.
const qaTests = (...ids) => (name) => ids.some((id) => name.endsWith(`(${id})`));
const history = [
  ["132889d", "before code QA", qaTests("QA Q1", "QA Q2", "QA Q3", "QA Q4", "QA recheck Q7", "QA recheck-2 Q8", "QA recheck-2 Q9", "QA recheck-2 Q10"), ["definitions are typed: argument types, child names and container rules"]],
  ["007843d", "before the recheck", qaTests("QA recheck Q7", "QA recheck Q8", "QA recheck-2 Q8", "QA recheck-2 Q10"), []],
  ["420d546", "before the second recheck", qaTests("QA recheck-2 Q8", "QA recheck-2 Q9"), []],
];

const runs = [];
for (const [name, plain, graph] of [...listed, ...qa]) {
  for (const [arm, edit] of [["plain", plain], ["graph", graph]]) {
    if (edit) runs.push({ label: `${arm}: ${name}${edit.survives ? " (survives)" : ""}`, arm, edits: [edit], survives: Boolean(edit.survives) });
  }
}

// A mutant that hangs fails its test by timeout, so keep that short.
const killed = async (arm, edits) => {
  const r = await runSpec({ arm, edits, testTimeoutMs: 4000 });
  assert.equal(r.tests.length, 27, `the spec did not load and run: ${r.stderr.slice(0, 500)}`);
  return r;
};

test("mutants are killed, except the kept redundant defense", { concurrency: availableParallelism() }, async (t) => {
  await Promise.all(runs.map((m) => t.test(m.label, async () => {
    const r = await killed(m.arm, m.edits);
    if (m.survives) assert.deepEqual(r.failed, [], "a kept redundant defense now fails a test");
    else assert.ok(r.failed.length > 0, "the mutant passed the whole spec");
  })));
});

test("photo-scenes history: each version fails exactly the QA tests written after it", { concurrency: true }, async (t) => {
  await Promise.all(history.map(([commit, when, isLater, alsoFails]) => t.test(`${commit} (${when})`, async () => {
    const r = await killed(commit, []);
    const failed = r.failed.map((f) => f.name).sort();
    const expected = r.tests.map((x) => x.name).filter((n) => isLater(n) || alsoFails.includes(n)).sort();
    assert.deepEqual(failed, expected);
  })));
});
