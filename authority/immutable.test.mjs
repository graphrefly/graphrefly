// What graphrefly:D815 and graphrefly:D816 (1) make immutable on main, held against a baseline
// (graphrefly:B146). The first tests edit a copy of the root's own ledgers, one thing at a time, and
// ask for exactly the error of that thing; the last ones run the gate itself, against a directory
// and against main as git has it.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkImmutable, immutableErrors, ledgersFrom } from "./immutable.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const fromRepo = (path) => { try { return readFileSync(join(repo, path), "utf8"); } catch { return null; } };
const base = ledgersFrom(fromRepo);
const LABEL = "the baseline";

// The rows the tests edit, found in the real set so that each stands for its kind.
const rule = base.rules.find((row) => (row.activated_by ?? []).length > 0 && !row.transition);
const draftRule = base.rules.find((row) => !(row.activated_by ?? []).length && !row.transition);
const main = base.decisions.find((ledger) => ledger.path === "decisions/decisions.jsonl");
const locked = main.rows.filter((row) => row.status === "locked");
const decision = locked[Math.floor(locked.length / 2)];
const notLocked = main.rows.find((row) => row.status !== "locked");
const active = (row) => (row.activated_by ?? []).length > 0 && !row.transition;
// An active contract with links at its use and at two exceptions, each of which links a trace, the
// first of them one that the use does not link: half the linked traces are linked by an exception only.
const contract = base.contracts.find((row) => active(row) && row.traces.length > 1 && row.exceptions.length > 1 && row.exceptions.every((item) => item.traces.length > 0)
  && row.exceptions[0].traces.some((id) => !row.traces.includes(id)));
const revised = base.contracts.find((row) => row.transition);
const at = `${contract.id}@${contract.revision}`;
const [first, second] = contract.exceptions;
const linkedId = contract.traces[0];
const exceptionLinkId = first.traces.find((id) => !contract.traces.includes(id));
const execution = base.decisions.find((ledger) => ledger.path === "decisions/execution.jsonl");
const executed = execution.rows.find((row) => row.status === "locked");
const replaced = base.rules.find((row) => (row.activated_by ?? []).length > 0 && row.transition);
// A decision the baseline does not hold: what a new revision, transition or succession names.
const NEW_DECISION = "D99999";
const noOperator = base.contracts.find((row) => active(row) && !row.operator);

// `now` is the baseline after one edit.
const edited = (edit) => { const now = structuredClone(base); edit(now); return immutableErrors(base, now, LABEL); };
const contractIn = (now, id = contract.id, revision = contract.revision) => now.contracts.find((row) => row.id === id && row.revision === revision);
const traceIn = (now, id) => now.traces.find((row) => row.id === id);
const decisionIn = (now, id) => now.decisions.find((ledger) => ledger.path === main.path).rows.find((row) => row.id === id);
const only = (errors, pattern) => {
  assert.equal(errors.length, 1, JSON.stringify(errors));
  assert.match(errors[0], pattern);
  assert.match(errors[0], /which the baseline holds \(graphrefly:D815, graphrefly:D816\)$/);
};
const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// The change adds the decision it names: a locked row of the root's ledger, which the baseline lacks.
const admit = (now, id = NEW_DECISION, over = {}) => { now.decisions.find((ledger) => ledger.path === main.path).rows.push({ id, status: "locked", decision: "New.", ...over }); };

test("the root's ledgers hold every kind of row these tests edit, and the set as it is changes nothing", () => {
  for (const [name, row] of Object.entries({ rule, draftRule, decision, notLocked, contract, revised, executed, replaced, noOperator })) assert.ok(row, `the ledgers hold ${name}`);
  assert.notEqual(first.topic, second.topic);
  assert.notEqual(linkedId, exceptionLinkId, "the use's trace and the exception's are two traces");
  assert.ok(!contract.traces.includes(exceptionLinkId), "the exception's trace is linked by the exception only");
  assert.ok((revised.activated_by ?? []).length > 0, "the revised contract was activated");
  assert.ok(base.decisions.every((ledger) => ledger.rows.every((row) => row.id !== NEW_DECISION)));
  assert.deepEqual(immutableErrors(base, structuredClone(base), LABEL), []);
});

test("an activated rule revision's statement and a locked decision's text are held, and their rows", () => {
  only(edited((now) => { now.rules.find((row) => row.id === rule.id && row.revision === rule.revision).statement += " And more."; }), new RegExp(`^the statement of activated rule revision ${escaped(rule.id)}@${rule.revision} changed`));
  only(edited((now) => { now.rules = now.rules.filter((row) => !(row.id === rule.id && row.revision === rule.revision)); }), new RegExp(`^activated rule revision ${escaped(rule.id)}@${rule.revision} is gone`));
  only(edited((now) => { decisionIn(now, decision.id).decision += " And more."; }), new RegExp(`^the text of locked decision ${decision.id} changed`));
  only(edited((now) => { const ledger = now.decisions.find((item) => item.path === main.path); ledger.rows = ledger.rows.filter((row) => row.id !== decision.id); }), new RegExp(`^locked decision ${decision.id} is gone from decisions/decisions.jsonl`));
  // An activated revision that has its transition is history and is held like the current one.
  const at = `${replaced.id}@${replaced.revision}`;
  only(edited((now) => { now.rules.find((row) => row.id === replaced.id && row.revision === replaced.revision).statement += " And more."; }), new RegExp(`^the statement of activated rule revision ${escaped(at)} changed`));
  only(edited((now) => { now.rules = now.rules.filter((row) => !(row.id === replaced.id && row.revision === replaced.revision)); }), new RegExp(`^activated rule revision ${escaped(at)} is gone`));
  // The root's other decision ledger is held like the first.
  const executedIn = (now) => now.decisions.find((ledger) => ledger.path === execution.path);
  only(edited((now) => { executedIn(now).rows.find((row) => row.id === executed.id).decision += " And more."; }), new RegExp(`^the text of locked decision ${executed.id} changed`));
  only(edited((now) => { const ledger = executedIn(now); ledger.rows = ledger.rows.filter((row) => row.id !== executed.id); }), new RegExp(`^locked decision ${executed.id} is gone from decisions/execution.jsonl`));
  // A decision moved to the other ledger is gone from its own.
  only(edited((now) => { const ledger = now.decisions.find((item) => item.path === main.path); const row = ledger.rows.find((item) => item.id === decision.id); ledger.rows = ledger.rows.filter((item) => item !== row); executedIn(now).rows.push(row); }), new RegExp(`^locked decision ${decision.id} is gone from decisions/decisions.jsonl`));
  // A locked decision stays held when the edit also changes its status, and that change is an
  // error of its own (graphrefly:B152).
  const both = edited((now) => { const row = decisionIn(now, decision.id); row.status = "open"; row.decision = "Something else."; });
  assert.equal(both.length, 2, JSON.stringify(both));
  assert.ok(both.some((error) => error.startsWith(`the text of locked decision ${decision.id} changed`)));
  assert.ok(both.some((error) => error.startsWith(`locked decision ${decision.id} is no longer locked`)));
});

// graphrefly:B152. The field by which a row is held says from when it is held; taking it off does
// not end the hold. Until then each of these edits passed, and once main held it the row was free.
test("a row that main holds is not released in place: activated_by stays, and a locked decision stays locked and gains no superseded_by", () => {
  const ruleIn = (now, of = rule) => now.rules.find((row) => row.id === of.id && row.revision === of.revision);
  const lost = (of) => new RegExp(`^activated rule revision ${escaped(`${of.id}@${of.revision}`)} lost activated_by`);
  only(edited((now) => { delete ruleIn(now).activated_by; }), lost(rule));
  only(edited((now) => { ruleIn(now).activated_by = []; }), lost(rule));
  // An activated revision that has its transition is history, and held like the current one.
  const replaced = base.rules.find((row) => (row.activated_by ?? []).length > 0 && row.transition);
  assert.ok(replaced, "the ledger holds an activated revision that has a transition");
  only(edited((now) => { delete ruleIn(now, replaced).activated_by; }), lost(replaced));
  only(edited((now) => { delete contractIn(now).activated_by; }), new RegExp(`^active contract ${escaped(at)} lost activated_by`));
  only(edited((now) => { contractIn(now).activated_by = []; }), new RegExp(`^active contract ${escaped(at)} lost activated_by`));
  for (const status of ["open", "superseded", undefined]) {
    only(edited((now) => { const row = decisionIn(now, decision.id); if (status === undefined) delete row.status; else row.status = status; }), new RegExp(`^locked decision ${decision.id} is no longer locked`));
  }
  only(edited((now) => { decisionIn(now, decision.id).superseded_by = decision.id; }), new RegExp(`^locked decision ${decision.id} gained superseded_by`));
  only(edited((now) => { decisionIn(now, decision.id).superseded_by = notLocked.id; }), new RegExp(`^locked decision ${decision.id} gained superseded_by`));
  // One that carries the field already keeps it as it is. No row of the root does, so the baseline is made.
  const carrying = structuredClone(base);
  decisionIn(carrying, decision.id).superseded_by = "D1";
  const changed = structuredClone(carrying);
  decisionIn(changed, decision.id).superseded_by = "D2";
  only(immutableErrors(carrying, changed, LABEL), new RegExp(`^the superseded_by of locked decision ${decision.id} changed`));
  assert.deepEqual(immutableErrors(carrying, structuredClone(carrying), LABEL), []);

  // What the loss would release: against a baseline that had let the field go, the row is free.
  const released = structuredClone(base);
  delete contractIn(released).activated_by;
  const rewritten = structuredClone(released);
  contractIn(rewritten).use = "Something else.";
  assert.deepEqual(immutableErrors(released, rewritten, LABEL), [], "the second step passes, so the first is the one to stop");

  // Left free. Which decision an activated row names is not held, only that it names one.
  assert.deepEqual(edited((now) => { ruleIn(now).activated_by = ["D900"]; }), [], "a rule revision's activating decision changed");
  assert.deepEqual(edited((now) => { contractIn(now).activated_by = ["D900"]; }), [], "a contract's activating decision changed");
  assert.deepEqual(edited((now) => { const row = decisionIn(now, notLocked.id); row.status = "open"; row.superseded_by = "D900"; }), [], "a decision that is not locked");
  // A contract revision that has its transition keeps the field too, as a rule revision does.
  only(edited((now) => { delete contractIn(now, revised.id, revised.revision).activated_by; }), new RegExp(`^contract ${escaped(`${revised.id}@${revised.revision}`)} lost activated_by`));
  // A contract that has no operator is held like any other.
  only(edited((now) => { delete contractIn(now, noOperator.id, noOperator.revision).activated_by; }), new RegExp(`^active contract ${escaped(`${noOperator.id}@${noOperator.revision}`)} lost activated_by`));
  // The root's other decision ledger is held in the same way.
  const executedIn = (now) => now.decisions.find((ledger) => ledger.path === execution.path).rows.find((row) => row.id === executed.id);
  only(edited((now) => { executedIn(now).status = "open"; }), new RegExp(`^locked decision ${executed.id} is no longer locked`));
  only(edited((now) => { executedIn(now).superseded_by = decision.id; }), new RegExp(`^locked decision ${executed.id} gained superseded_by`));
  only(edited((now) => { const row = executedIn(now); row.supersedes = [...(row.supersedes ?? []), decision.id]; }), new RegExp(`^the supersedes of locked decision ${executed.id} changed`));
  // A row the baseline does not hold exists only on the branch.
  const onBranch = structuredClone(base);
  onBranch.rules.push({ id: "R-branch", revision: 1, statement: "First.", introduced_by: ["D900"], activated_by: ["D900"] });
  const withdrawn = structuredClone(onBranch);
  delete withdrawn.rules.at(-1).activated_by;
  assert.deepEqual(immutableErrors(base, withdrawn, LABEL), [], "an activation that exists only on the branch is taken back there");
  only(immutableErrors(onBranch, withdrawn, LABEL), /^activated rule revision R-branch@1 lost activated_by/);
});

test("an active contract's use and its exceptions, each with its topic and statement, are held", () => {
  only(edited((now) => { contractIn(now).use += " And more."; }), new RegExp(`^the use of active contract ${escaped(at)} changed`));
  only(edited((now) => { contractIn(now).exceptions[0].statement += " And more."; }), new RegExp(`^the ${first.topic} exception of active contract ${escaped(at)} changed`));
  only(edited((now) => { contractIn(now).exceptions.shift(); }), new RegExp(`^the ${first.topic} exception of active contract ${escaped(at)} is gone`));
  only(edited((now) => { now.contracts = now.contracts.filter((row) => !(row.id === contract.id && row.revision === contract.revision)); }), new RegExp(`^active contract ${escaped(at)} is gone`));
  // A topic renamed is an exception gone and one gained.
  const free = ["same-wave", "completion", "invalidation", "recovery"].find((topic) => !contract.exceptions.some((item) => item.topic === topic));
  assert.ok(free, `${at} leaves a topic free`);
  const renamed = edited((now) => { contractIn(now).exceptions[0].topic = free; });
  assert.equal(renamed.length, 2, JSON.stringify(renamed));
  assert.ok(renamed.some((error) => error.startsWith(`the ${first.topic} exception of active contract ${at} is gone`)));
  assert.ok(renamed.some((error) => error.startsWith(`active contract ${at} gained a ${free} exception`)));
  only(edited((now) => { contractIn(now).exceptions.push({ topic: free, statement: "New.", traces: [linkedId] }); }), new RegExp(`^active contract ${escaped(at)} gained a ${free} exception`));
});

test("a link of an active contract is not removed, nor moved to another exception", () => {
  only(edited((now) => { const row = contractIn(now); row.traces = row.traces.filter((id) => id !== linkedId); }), new RegExp(`^the link of active contract ${escaped(at)} to ${linkedId} is gone from its use`));
  only(edited((now) => { const item = contractIn(now).exceptions[0]; item.traces = item.traces.filter((id) => id !== exceptionLinkId); }), new RegExp(`^the link of active contract ${escaped(at)} to ${exceptionLinkId} is gone from its ${first.topic} exception`));
  // Moved: gone from the one place, and a new link at the other, which is free.
  const onlyThere = first.traces.find((id) => !second.traces.includes(id));
  assert.ok(onlyThere, "an exception's link that the next does not have");
  only(edited((now) => { const [a, b] = contractIn(now).exceptions; a.traces = a.traces.filter((id) => id !== onlyThere); b.traces.push(onlyThere); }), new RegExp(`^the link of active contract ${escaped(at)} to ${onlyThere} is gone from its ${first.topic} exception`));
});

test("the nodes, steps and expectation of a trace an active contract links are held, and its row", () => {
  for (const id of [linkedId, exceptionLinkId]) {
    only(edited((now) => { traceIn(now, id).nodes[0].id += "x"; }), new RegExp(`^the nodes of trace ${id}, which an active contract links, changed`));
    only(edited((now) => { traceIn(now, id).steps.pop(); }), new RegExp(`^the steps of trace ${id}, which an active contract links, changed`));
    only(edited((now) => { traceIn(now, id).expect.at(-1).push(["k", "x", [["DATA", 1]]]); }), new RegExp(`^the expectation of trace ${id}, which an active contract links, changed`));
    only(edited((now) => { now.traces = now.traces.filter((row) => row.id !== id); }), new RegExp(`^trace ${id}, which an active contract links, is gone`));
  }
  // An expected ERROR's payload is part of the expectation.
  const withError = base.traces.find((row) => JSON.stringify(row.expect).includes('["ERROR"]') && base.contracts.some((c) => active(c) && [...c.traces, ...c.exceptions.flatMap((item) => item.traces)].includes(row.id)));
  only(edited((now) => { traceIn(now, withError.id).expect = JSON.parse(JSON.stringify(withError.expect).replace('["ERROR"]', '["ERROR","given"]')); }), new RegExp(`^the expectation of trace ${withError.id}`));
});

test("what graphrefly:D816 (2) leaves to correction in place is not held", () => {
  const next = `OT-${Math.max(...base.traces.map((row) => Number(row.id.slice(3)))) + 1}`;
  const fresh = { ...structuredClone(base.traces.find((row) => row.id === linkedId)), id: next, name: "a new trace", basis: "added" };
  assert.deepEqual(edited((now) => { now.traces.push(fresh); contractIn(now).traces.push(next); }), [], "a new trace and a link to it from the use");
  assert.deepEqual(edited((now) => { now.traces.push(fresh); contractIn(now).exceptions[0].traces.push(next); }), [], "a new trace and a link to it from an exception");
  const already = second.traces.find((id) => !first.traces.includes(id));
  assert.deepEqual(edited((now) => { contractIn(now).exceptions[0].traces.push(already); }), [], "a link to a trace already in the ledger");
  assert.deepEqual(edited((now) => { contractIn(now).rationale = "Said otherwise."; const trace = traceIn(now, linkedId); trace.name = "another name"; trace.basis = "another basis"; }), [], "a rationale, and a trace's name and basis");
  assert.deepEqual(edited((now) => { now.rules.find((row) => row.id === draftRule.id && row.revision === draftRule.revision).statement = "A draft may change."; }), [], "a draft rule's statement");
  assert.deepEqual(edited((now) => { decisionIn(now, notLocked.id).decision = "Not locked."; }), [], "the text of a decision that is not locked");
  assert.deepEqual(edited((now) => { contractIn(now, revised.id, revised.revision).use = "A revision that has a transition is history."; }), [], "a contract revision that already had its transition");
  // A new revision: the earlier one gains its transition and keeps everything else.
  assert.deepEqual(edited((now) => {
    const row = contractIn(now);
    now.contracts.push({ ...structuredClone(row), revision: row.revision + 1, use: `${row.use} And more.` });
    row.transition = { kind: "revise", by: "D900", to: { id: row.id, revision: row.revision + 1 } };
    admit(now, "D900");
  }), [], "a revision that gains its transition");
  // A row the baseline does not hold exists only on the branch.
  const before = structuredClone(base);
  const onBranch = structuredClone(base);
  onBranch.rules.push({ id: "R-branch", revision: 1, statement: "First.", introduced_by: ["D900"], activated_by: ["D900"] });
  const corrected = structuredClone(onBranch);
  corrected.rules.at(-1).statement = "Corrected.";
  assert.deepEqual(immutableErrors(before, corrected, LABEL), [], "a rule revision that exists only on the branch");
  only(immutableErrors(onBranch, corrected, LABEL), /^the statement of activated rule revision R-branch@1 changed/);
});

test("a link moves in place to the trace that succeeded the one it named, and nowhere else", () => {
  const next = `OT-${Math.max(...base.traces.map((row) => Number(row.id.slice(3)))) + 1}`;
  const successor = { ...structuredClone(base.traces.find((row) => row.id === exceptionLinkId)), id: next, name: "the successor", basis: "succeeds" };
  const succeed = (now, under = NEW_DECISION) => { now.traces.push(structuredClone(successor)); const old = traceIn(now, exceptionLinkId); old.succeeded_by = next; if (under !== null) old.succeeded_under = under; if (under === NEW_DECISION) admit(now); };
  const unlink = (now) => { const item = contractIn(now).exceptions[0]; item.traces = item.traces.filter((id) => id !== exceptionLinkId); return item; };
  // Every active contract that links the succeeded trace moves its link; the test moves them all.
  const moveAll = (now, where) => {
    for (const row of now.contracts.filter(active)) {
      for (const holder of [row, ...row.exceptions]) {
        if (!holder.traces.includes(exceptionLinkId)) continue;
        holder.traces = holder.traces.filter((id) => id !== exceptionLinkId);
        (where?.(row, holder) ?? holder).traces.push(next);
      }
    }
  };
  assert.deepEqual(edited((now) => { succeed(now); moveAll(now); }), [], "moved to the successor in the same place");
  only(edited((now) => { succeed(now); moveAll(now, (row, holder) => (row.id === contract.id && holder === row.exceptions[0] ? row.exceptions[1] : holder)); }), new RegExp(`^the link of active contract ${escaped(at)} to ${exceptionLinkId} is gone from its ${first.topic} exception`));
  // Without succeeded_by the new trace is not a successor, so the link is simply gone.
  const plain = edited((now) => { now.traces.push(structuredClone(successor)); unlink(now).traces.push(next); });
  assert.ok(plain.some((error) => error.startsWith(`the link of active contract ${at} to ${exceptionLinkId} is gone from its ${first.topic} exception`)), JSON.stringify(plain));
  // A succeeded trace keeps its row as it was.
  const rewritten = edited((now) => { succeed(now); moveAll(now); traceIn(now, exceptionLinkId).steps.pop(); });
  only(rewritten, new RegExp(`^the steps of trace ${exceptionLinkId}, which an active contract links, changed`));

  // A succession names a decision the baseline does not hold (graphrefly:B152).
  const noNew = new RegExp(`^trace ${exceptionLinkId} was succeeded without naming a new decision`);
  only(edited((now) => { succeed(now, null); moveAll(now); }), noNew); // no succeeded_under at all
  only(edited((now) => { succeed(now, decision.id); moveAll(now); }), noNew);
  only(edited((now) => { succeed(now, ""); moveAll(now); }), noNew);
  // A new decision is a locked row the change adds: an id without a row, or a row that is not locked, is none.
  only(edited((now) => { succeed(now, "D99998"); moveAll(now); }), noNew);
  only(edited((now) => { succeed(now, "D99998"); admit(now, "D99998", { status: "open" }); moveAll(now); }), noNew);
  // And the successor is a new trace: one the baseline holds cannot take the place of another, which
  // would take a link off (here the exception's link goes, and the trace is no longer run).
  const sibling = first.traces.find((id) => id !== exceptionLinkId) ?? second.traces.find((id) => id !== exceptionLinkId);
  assert.ok(sibling, "another trace of the baseline");
  only(edited((now) => {
    const old = traceIn(now, exceptionLinkId); old.succeeded_by = sibling; old.succeeded_under = NEW_DECISION; admit(now);
    const item = contractIn(now).exceptions[0]; item.traces = item.traces.filter((id) => id !== exceptionLinkId); if (!item.traces.includes(sibling)) item.traces.push(sibling);
  }), new RegExp(`^trace ${exceptionLinkId} was succeeded by ${sibling}, which is not a new trace`));

  // Nor one that the baseline holds without a link.
  const loose = structuredClone(base);
  loose.traces.push({ ...structuredClone(successor), id: "OT-99990" });
  const ontoLoose = structuredClone(loose);
  { const old = traceIn(ontoLoose, exceptionLinkId); old.succeeded_by = "OT-99990"; old.succeeded_under = NEW_DECISION; admit(ontoLoose);
    for (const row of ontoLoose.contracts.filter(active)) for (const holder of [row, ...row.exceptions]) holder.traces = holder.traces.map((id) => (id === exceptionLinkId ? "OT-99990" : id)); }
  only(immutableErrors(loose, ontoLoose, LABEL), new RegExp(`^trace ${exceptionLinkId} was succeeded by OT-99990, which is not a new trace`));

  // Once main holds the succession, the succeeded trace stays in the ledger as it is, though no
  // active contract links it any more (graphrefly:D816 (1)).
  const after = structuredClone(base);
  succeed(after); moveAll(after);
  assert.deepEqual(immutableErrors(base, after, LABEL), []);
  const later = (change) => { const now = structuredClone(after); change(now); return immutableErrors(after, now, LABEL); };
  assert.deepEqual(later(() => {}), []);
  only(later((now) => { now.traces = now.traces.filter((row) => row.id !== exceptionLinkId); }), new RegExp(`^succeeded trace ${exceptionLinkId} is gone`));
  only(later((now) => { traceIn(now, exceptionLinkId).steps.pop(); }), new RegExp(`^the steps of succeeded trace ${exceptionLinkId} changed`));
  only(later((now) => { traceIn(now, exceptionLinkId).expect.pop(); }), new RegExp(`^the expectation of succeeded trace ${exceptionLinkId} changed`));
  only(later((now) => { traceIn(now, exceptionLinkId).nodes[0].id += "x"; }), new RegExp(`^the nodes of succeeded trace ${exceptionLinkId} changed`));
  only(later((now) => { traceIn(now, exceptionLinkId).succeeded_by = linkedId; }), new RegExp(`^the succession of trace ${exceptionLinkId} changed`));
  only(later((now) => { delete traceIn(now, exceptionLinkId).succeeded_by; }), new RegExp(`^the succession of trace ${exceptionLinkId} changed`));
  only(later((now) => { traceIn(now, exceptionLinkId).succeeded_under = decision.id; }), new RegExp(`^the succession of trace ${exceptionLinkId} changed`));
});

// graphrefly:B152, from its review. What releases a held row names a decision the baseline does not
// hold: D815 and D816 say that each changes only through a new revision or decision.
test("an active contract gains a transition only by a new decision, and a transition it has stays", () => {
  const old = contract.activated_by[0];
  const gained = new RegExp(`^active contract ${escaped(at)} gained a transition that names no new decision`);
  only(edited((now) => { contractIn(now).transition = { kind: "retire", by: old }; }), gained);
  only(edited((now) => { contractIn(now).transition = { kind: "retire" }; }), gained);
  // A decision of the root's other ledger is no new one either.
  only(edited((now) => { contractIn(now).transition = { kind: "retire", by: executed.id }; }), gained);
  only(edited((now) => {
    const row = contractIn(now);
    now.contracts.push({ ...structuredClone(row), revision: row.revision + 1 });
    row.transition = { kind: "revise", by: old, to: { id: row.id, revision: row.revision + 1 } };
  }), gained);
  assert.deepEqual(edited((now) => { contractIn(now).transition = { kind: "retire", by: NEW_DECISION }; admit(now); }), [], "retired by a new decision");
  // A new decision is a locked row the change adds.
  only(edited((now) => { contractIn(now).transition = { kind: "retire", by: NEW_DECISION }; }), gained);
  for (const status of ["open", "superseded", undefined]) {
    only(edited((now) => { contractIn(now).transition = { kind: "retire", by: NEW_DECISION }; admit(now, NEW_DECISION, { status }); }), gained);
  }
  // A contract that has no operator, which no trace's check stands behind.
  const bare = `${noOperator.id}@${noOperator.revision}`;
  only(edited((now) => { contractIn(now, noOperator.id, noOperator.revision).transition = { kind: "retire", by: noOperator.activated_by[0] }; }), new RegExp(`^active contract ${escaped(bare)} gained a transition that names no new decision`));
  // A transition main holds is not taken off again, which would bring the revision back in force.
  const was = `${revised.id}@${revised.revision}`;
  const kept = new RegExp(`^the transition of contract ${escaped(was)} changed`);
  only(edited((now) => { delete contractIn(now, revised.id, revised.revision).transition; }), kept);
  only(edited((now) => { contractIn(now, revised.id, revised.revision).transition.by = NEW_DECISION; }), kept);
  only(edited((now) => { contractIn(now, revised.id, revised.revision).transition.kind = "retire"; }), kept);
  only(edited((now) => { contractIn(now, revised.id, revised.revision).transition.to = { id: revised.id, revision: 99 }; }), kept);
  // Nor does its row go: with the row the transition would go.
  only(edited((now) => { now.contracts = now.contracts.filter((row) => !(row.id === revised.id && row.revision === revised.revision)); }), new RegExp(`^contract ${escaped(was)}, which has its transition, is gone`));
});

test("an activated rule revision gains a transition only by a new decision, and a transition it has stays", () => {
  const ruleIn = (now, of = rule) => now.rules.find((row) => row.id === of.id && row.revision === of.revision);
  const current = `${rule.id}@${rule.revision}`;
  const gained = new RegExp(`^activated rule revision ${escaped(current)} gained a transition that names no new decision`);
  // Retired in place by a decision main holds, the rule would leave the protocol without a decision.
  only(edited((now) => { ruleIn(now).transition = { kind: "retire", by: rule.activated_by[0] }; }), gained);
  only(edited((now) => { ruleIn(now).transition = { kind: "retire", by: executed.id }; }), gained);
  only(edited((now) => { ruleIn(now).transition = { kind: "retire" }; }), gained);
  only(edited((now) => {
    const row = ruleIn(now);
    now.rules.push({ ...structuredClone(row), revision: row.revision + 1 });
    row.transition = { kind: "revise", by: rule.activated_by[0], to: { id: row.id, revision: row.revision + 1 } };
  }), gained);
  assert.deepEqual(edited((now) => {
    const row = ruleIn(now);
    now.rules.push({ ...structuredClone(row), revision: row.revision + 1, statement: `${row.statement} And more.`, activated_by: [NEW_DECISION] });
    row.transition = { kind: "revise", by: NEW_DECISION, to: { id: row.id, revision: row.revision + 1 } };
    admit(now);
  }), [], "a new revision by a new decision");
  only(edited((now) => { ruleIn(now).transition = { kind: "retire", by: NEW_DECISION }; }), gained);
  only(edited((now) => { ruleIn(now).transition = { kind: "retire", by: NEW_DECISION }; admit(now, NEW_DECISION, { status: "open" }); }), gained);
  const was = `${replaced.id}@${replaced.revision}`;
  const kept = new RegExp(`^the transition of activated rule revision ${escaped(was)} changed`);
  only(edited((now) => { delete ruleIn(now, replaced).transition; }), kept);
  only(edited((now) => { ruleIn(now, replaced).transition.by = NEW_DECISION; }), kept);
  only(edited((now) => { ruleIn(now, replaced).transition.kind = "retire"; }), kept);
  only(edited((now) => { ruleIn(now, replaced).transition.to = { id: "R-other", revision: 1 }; }), kept);
  // A draft is not held: it gets its transition by whatever decision replaces it.
  assert.deepEqual(edited((now) => { ruleIn(now, draftRule).transition = { kind: "retire", by: rule.activated_by[0] }; }), [], "a draft's transition");
});

test("a locked decision's supersedes is held: a decision is superseded by a new one", () => {
  const changed = (id) => new RegExp(`^the supersedes of locked decision ${id} changed`);
  only(edited((now) => { const row = decisionIn(now, decision.id); row.supersedes = [...(row.supersedes ?? []), notLocked.id]; }), changed(decision.id));
  const superseding = locked.findLast((row) => (row.supersedes ?? []).length > 0);
  assert.ok(superseding, "a locked decision that supersedes another");
  only(edited((now) => { decisionIn(now, superseding.id).supersedes = []; }), changed(superseding.id));
  only(edited((now) => { decisionIn(now, superseding.id).supersedes.push(decision.id); }), changed(superseding.id));
  only(edited((now) => { decisionIn(now, superseding.id).supersedes[0] = decision.id; }), changed(superseding.id));
  only(edited((now) => { decisionIn(now, decision.id).supersedes = notLocked.id; }), changed(decision.id));
  // One that is not locked does not supersede in place either: it is no new decision.
  only(edited((now) => { decisionIn(now, notLocked.id).supersedes = [decision.id]; }), new RegExp(`^the supersedes of decision ${notLocked.id} changed`));
  assert.deepEqual(edited((now) => { now.decisions.find((ledger) => ledger.path === main.path).rows.push({ id: NEW_DECISION, status: "locked", decision: "New.", supersedes: [decision.id] }); }), [], "a new decision supersedes");
});

test("the root's own ledgers are those the loader reads as the root's, each read at its path", () => {
  const row = (path) => JSON.stringify({ origin: "o", owner: "o", authority_class: path, path });
  const files = {
    "authority/ledgers.jsonl": ["decisions/d.jsonl", "../other/decisions/d.jsonl", "..x/d.jsonl", "decisions/./e.jsonl"].map(row).join("\n"),
    "decisions/d.jsonl": '{"id":"D1"}', "..x/d.jsonl": '{"id":"D2"}', "decisions/e.jsonl": '{"id":"D3"}', "../other/decisions/d.jsonl": '{"id":"D4"}',
  };
  const got = ledgersFrom((path) => files[path] ?? null);
  // Only a path that starts with ../ is another repository's (authority/federation.mjs); a
  // directory of the root named ..x is the root's. A path is read as git would name it.
  assert.deepEqual(got.manifest.map((item) => item.path), ["decisions/d.jsonl", "..x/d.jsonl", "decisions/./e.jsonl"]);
  assert.deepEqual(got.decisions.map((ledger) => [ledger.path, ledger.rows.map((item) => item.id)]), [["decisions/d.jsonl", ["D1"]], ["..x/d.jsonl", ["D2"]], ["decisions/./e.jsonl", ["D3"]]]);
});

test("the manifest keeps the identity of each of the root's ledgers", () => {
  assert.ok(base.manifest.some((row) => row.path === main.path), "the manifest lists the root's decision ledger");
  const rowIn = (now, path = main.path) => now.manifest.find((row) => row.path === path);
  for (const key of ["origin", "owner", "authority_class"]) {
    only(edited((now) => { rowIn(now)[key] = "another"; }), /^the identity of ledger decisions\/decisions\.jsonl changed in the manifest/);
  }
  only(edited((now) => { now.manifest = now.manifest.filter((row) => row.path !== main.path); now.decisions = now.decisions.filter((ledger) => ledger.path !== main.path); }), /^ledger decisions\/decisions\.jsonl is gone from the manifest/);
  // The review's case: another file takes the ledger's identity, with a decision's text rewritten
  // in it, while the old file stays as it was under another identity.
  only(edited((now) => {
    const old = rowIn(now);
    const copy = structuredClone(now.decisions.find((ledger) => ledger.path === main.path).rows);
    copy.find((row) => row.id === decision.id).decision = "Something else.";
    now.manifest.push({ ...old, path: "decisions/decisions2.jsonl" });
    now.decisions.push({ path: "decisions/decisions2.jsonl", rows: copy });
    Object.assign(old, { origin: "frozen", owner: "frozen" });
  }), /^the identity of ledger decisions\/decisions\.jsonl changed in the manifest/);
  // Left free: what is no part of a ledger's identity, and a ledger added.
  assert.deepEqual(edited((now) => { rowIn(now).admission_after = 1; rowIn(now).availability = "workspace-optional"; }), []);
  assert.deepEqual(edited((now) => { now.manifest.push({ origin: "other", owner: "other", authority_class: "durable-root", path: "decisions/other.jsonl" }); now.decisions.push({ path: "decisions/other.jsonl", rows: [] }); }), []);
});

// The gate itself. Each directory holds the ledgers the check reads, copied from the checkout.
const HELD = ["authority/ledgers.jsonl", "spec/rules.jsonl", "operators/contracts.jsonl", "operators/traces.jsonl", "decisions/decisions.jsonl", "decisions/execution.jsonl"];
const copyLedgers = (dir) => { for (const path of HELD) { mkdirSync(dirname(join(dir, path)), { recursive: true }); cpSync(join(repo, path), join(dir, path)); } };
const rewrite = (dir, path, change) => {
  const lines = readFileSync(join(dir, path), "utf8").split("\n");
  writeFileSync(join(dir, path), lines.map((line) => (line.trim() ? JSON.stringify(change(JSON.parse(line))) : line)).join("\n"));
};
const otherStatement = (row) => (row.id === rule.id && row.revision === rule.revision ? { ...row, statement: `${row.statement} As main has it.` } : row);

test("npm run authority:check fails when the checkout differs from the baseline it is given, and names what differs", () => {
  const dir = mkdtempSync(join(tmpdir(), "graphrefly-baseline-"));
  try {
    copyLedgers(dir);
    const gate = (baseline) => spawnSync(process.execPath, [join(repo, "authority/check.mjs"), "--baseline", baseline], { encoding: "utf8", timeout: 120_000 });
    const same = gate(dir);
    assert.equal(same.status, 0, same.stderr);
    assert.match(same.stdout, /immutable content: \{\s*comparedWith: \[\s*'the baseline at /);
    assert.match(same.stdout, /changed: 0\s*\}/);
    // The baseline holds another statement for an activated revision, so the checkout has changed it.
    rewrite(dir, "spec/rules.jsonl", otherStatement);
    const differs = gate(dir);
    assert.equal(differs.status, 1);
    assert.match(differs.stderr, new RegExp(`the statement of activated rule revision ${escaped(rule.id)}@${rule.revision} changed, which the baseline at `));
    // The directory may also be given after an equals sign.
    const joined = spawnSync(process.execPath, [join(repo, "authority/check.mjs"), `--baseline=${dir}`], { encoding: "utf8", timeout: 120_000 });
    assert.equal(joined.status, 1);
    assert.match(joined.stderr, /changed, which the baseline at /);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a baseline directory that is not there, or holds no ledger, is refused", () => {
  const dir = mkdtempSync(join(tmpdir(), "graphrefly-none-"));
  try {
    assert.throws(() => checkImmutable(repo, { baselineDir: join(dir, "typo") }), /the baseline directory .*typo does not exist/);
    assert.throws(() => checkImmutable(repo, { baselineDir: dir }), /the baseline directory .* does not hold the ledgers/);
    const gate = spawnSync(process.execPath, [join(repo, "authority/check.mjs"), "--baseline", join(dir, "typo")], { encoding: "utf8", timeout: 120_000 });
    assert.notEqual(gate.status, 0);
    assert.match(gate.stderr, /does not exist/);
    const flag = spawnSync(process.execPath, [join(repo, "authority/check.mjs"), "--baseline", "--workspace"], { encoding: "utf8", timeout: 120_000 });
    assert.notEqual(flag.status, 0);
    assert.match(flag.stderr, /--baseline needs a directory/);
    // A directory that holds one ledger and not the others is no baseline.
    mkdirSync(join(dir, "operators"), { recursive: true });
    cpSync(join(repo, "operators/traces.jsonl"), join(dir, "operators/traces.jsonl"));
    assert.throws(() => checkImmutable(repo, { baselineDir: dir }), /the baseline directory .* does not hold the ledgers/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a branch is compared with main where it left it, and with origin/main beside main", () => {
  const dir = mkdtempSync(join(tmpdir(), "graphrefly-behind-"));
  const git = (...args) => execFileSync("git", ["-C", dir, "-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  try {
    copyLedgers(dir);
    git("init", "-q", "-b", "main");
    git("add", "-A");
    git("commit", "-q", "-m", "main");
    const left = git("rev-parse", "HEAD").trim();
    git("branch", "work");
    // main gains a locked decision after the branch left it; the branch changes nothing.
    writeFileSync(join(dir, main.path), `${readFileSync(join(dir, main.path), "utf8").replace(/\n*$/, "\n")}${JSON.stringify({ id: NEW_DECISION, status: "locked", decision: "Made on main." })}\n`);
    git("commit", "-q", "-am", "main gains a decision");
    git("checkout", "-q", "work");
    assert.deepEqual(checkImmutable(dir), { errors: [], compared: ["main"] }, "a branch that is only behind main has changed nothing");
    // The same with origin/main where main is: both are compared where the branch left them, one commit.
    git("update-ref", "refs/remotes/origin/main", git("rev-parse", "main").trim());
    assert.deepEqual(checkImmutable(dir), { errors: [], compared: ["origin/main"] }, "nor is it behind origin/main");
    git("update-ref", "-d", "refs/remotes/origin/main");
    rewrite(dir, "spec/rules.jsonl", otherStatement);
    assert.equal(checkImmutable(dir).errors.length, 1, "what main held when the branch left it is still held");
    git("checkout", "-q", "--", ".");
    // origin/main stays where the branch left main; main then commits an edit of a held statement.
    // main compared with itself finds nothing, and origin/main finds it.
    git("update-ref", "refs/remotes/origin/main", left);
    git("checkout", "-q", "main");
    rewrite(dir, "spec/rules.jsonl", otherStatement);
    git("commit", "-q", "-am", "an edit committed on main");
    const found = checkImmutable(dir);
    assert.deepEqual(found.compared, ["origin/main", "main"]);
    assert.equal(found.errors.length, 1, JSON.stringify(found.errors));
    assert.match(found.errors[0], new RegExp(`^the statement of activated rule revision ${escaped(rule.id)}@${rule.revision} changed, which origin/main holds`));
    // A history that shares nothing with main has left it nowhere: it is compared with main itself.
    git("update-ref", "-d", "refs/remotes/origin/main");
    git("checkout", "-q", "--orphan", "apart");
    git("commit", "-q", "-am", "no common history");
    const apart = checkImmutable(dir);
    assert.deepEqual(apart.compared, ["main"]);
    assert.deepEqual(apart.errors, [], "the same files as main");
    writeFileSync(join(dir, main.path), readFileSync(join(dir, main.path), "utf8").split("\n").filter((line) => !line.includes(`"id":"${NEW_DECISION}"`)).join("\n"));
    assert.equal(checkImmutable(dir).errors.length, 1, "what main holds is asked of it");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("npm run authority:check, given no baseline, compares its checkout with main as git has it, and says when it compared nothing", () => {
  // The check reads the repository it is in, so this runs a copy of it: the gate's code and the
  // held ledgers are copied, everything else is linked.
  const dir = mkdtempSync(join(tmpdir(), "graphrefly-cli-"));
  const git = (...args) => execFileSync("git", ["-C", dir, "-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const copied = new Set(["authority", "spec", "decisions", "operators"]);
  try {
    for (const name of readdirSync(repo)) {
      if (name === ".git" || name === "node_modules") continue;
      if (copied.has(name)) cpSync(join(repo, name), join(dir, name), { recursive: true });
      else symlinkSync(join(repo, name), join(dir, name));
    }
    const gate = () => spawnSync(process.execPath, [join(dir, "authority/check.mjs")], { encoding: "utf8", timeout: 120_000 });
    const none = gate();
    assert.equal(none.status, 0, none.stderr);
    assert.match(none.stderr, /immutable content was not compared/);
    git("init", "-q", "-b", "main");
    git("add", "-A");
    git("commit", "-q", "-m", "main");
    const same = gate();
    assert.equal(same.status, 0, same.stderr);
    assert.match(same.stdout, /comparedWith: \[ 'main' \], changed: 0/);
    assert.doesNotMatch(same.stderr, /immutable content was not compared/);
    rewrite(dir, "spec/rules.jsonl", otherStatement);
    const differs = gate();
    assert.equal(differs.status, 1);
    assert.match(differs.stderr, new RegExp(`the statement of activated rule revision ${escaped(rule.id)}@${rule.revision} changed, which main holds`));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("without a directory the baseline is main as git has it, and a checkout without git compares nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "graphrefly-git-"));
  const git = (...args) => execFileSync("git", ["-C", dir, "-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  try {
    copyLedgers(dir);
    assert.deepEqual(checkImmutable(dir), { errors: [], compared: [] }, "no git, nothing compared");
    git("init", "-q", "-b", "main");
    git("add", "-A");
    git("commit", "-q", "-m", "main");
    assert.deepEqual(checkImmutable(dir), { errors: [], compared: ["main"] });
    // On a branch: an edit of what main holds is found, committed or not; a row made on the branch is free.
    git("checkout", "-q", "-b", "work");
    rewrite(dir, "spec/rules.jsonl", otherStatement);
    const found = checkImmutable(dir);
    assert.deepEqual(found.compared, ["main"]);
    only(found.errors.map((error) => error.replace("which main holds", "which the baseline holds")), new RegExp(`^the statement of activated rule revision ${escaped(rule.id)}@${rule.revision} changed`));
    git("commit", "-q", "-am", "edit");
    assert.equal(checkImmutable(dir).errors.length, 1, "the same once it is committed on the branch");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
