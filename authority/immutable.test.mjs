// What graphrefly:D815 and graphrefly:D816 (1) make immutable on main, held against a baseline
// (graphrefly:B146). The first tests edit a copy of the root's own ledgers, one thing at a time, and
// ask for exactly the error of that thing; the last two run the gate itself, against a directory
// and against main as git has it.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
// An active contract with links at its use and at two exceptions, each of which links a trace.
const contract = base.contracts.find((row) => active(row) && row.traces.length > 1 && row.exceptions.length > 1 && row.exceptions.every((item) => item.traces.length > 0));
const revised = base.contracts.find((row) => row.transition);
const at = `${contract.id}@${contract.revision}`;
const [first, second] = contract.exceptions;
const linkedId = contract.traces[0];
const exceptionLinkId = first.traces[0];

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

test("the root's ledgers hold every kind of row these tests edit, and the set as it is changes nothing", () => {
  for (const [name, row] of Object.entries({ rule, draftRule, decision, notLocked, contract, revised })) assert.ok(row, `the ledgers hold ${name}`);
  assert.notEqual(first.topic, second.topic);
  assert.deepEqual(immutableErrors(base, structuredClone(base), LABEL), []);
});

test("an activated rule revision's statement and a locked decision's text are held, and their rows", () => {
  only(edited((now) => { now.rules.find((row) => row.id === rule.id && row.revision === rule.revision).statement += " And more."; }), new RegExp(`^the statement of activated rule revision ${escaped(rule.id)}@${rule.revision} changed`));
  only(edited((now) => { now.rules = now.rules.filter((row) => !(row.id === rule.id && row.revision === rule.revision)); }), new RegExp(`^activated rule revision ${escaped(rule.id)}@${rule.revision} is gone`));
  only(edited((now) => { decisionIn(now, decision.id).decision += " And more."; }), new RegExp(`^the text of locked decision ${decision.id} changed`));
  only(edited((now) => { const ledger = now.decisions.find((item) => item.path === main.path); ledger.rows = ledger.rows.filter((row) => row.id !== decision.id); }), new RegExp(`^locked decision ${decision.id} is gone from decisions/decisions.jsonl`));
  // A locked decision stays held when the edit also changes its status.
  only(edited((now) => { const row = decisionIn(now, decision.id); row.status = "open"; row.decision = "Something else."; }), new RegExp(`^the text of locked decision ${decision.id} changed`));
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
  const succeed = (now) => { now.traces.push(structuredClone(successor)); traceIn(now, exceptionLinkId).succeeded_by = next; };
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
