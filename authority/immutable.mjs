// What is immutable on main, held against a baseline (graphrefly:B146, graphrefly:B152).
//
// What this is for: an edit of held content made by mistake, or as a shortcut, does not pass
// unnoticed. It is no defence against someone who means to get round it: the gate is a file of the
// same repository.
//
// graphrefly:D815 names an activated rule revision's statement and a locked decision's text.
// graphrefly:D816 (1) adds, of an active operator contract: its use; its exceptions, each with its
// topic and statement; the links it and its exceptions have to traces, none removed or moved to
// another exception; and the nodes, steps and expectation of every trace it links. Each changes
// only through a new revision or decision. Not held, as D816 (2) says: a rationale, a trace's name
// and basis, a draft, a new trace and a new link.
//
// A row that main holds is not released in place (graphrefly:B152; the user, 2026-11-25, as what
// D815 and D816 already mean).
// - The field by which a row is held says from when it is held, and taking it off does not end the
//   hold: a rule revision or a contract that was activated keeps an activated_by, and a locked
//   decision stays locked and gains no superseded_by.
// - What releases a row names a new decision: a locked row that the same change adds to one of the
//   root's ledgers, under an id no decision of the baseline has. That holds for the transition an
//   activated rule revision or an active contract gains, and for the succession of a trace an
//   active contract links, whose successor is a trace the baseline does not have.
// - No decision of the baseline gains or loses a supersedes, locked or not: a decision supersedes
//   when it is made.
// - A transition that an activated rule revision or an activated contract has stays as it is, with
//   the contract's row; a trace the baseline holds as succeeded stays with its succession.
// Not held: which decision activated_by names; what a contract revision says once it has its
// transition; a row that was never activated.
//
// The manifest keeps the identity of each of the root's ledgers (origin, owner, authority class):
// another file cannot take a ledger's place while the old one stays, unread, as it was.
//
// The baseline is what main held where the checkout left it: for `origin/main` and for `main`,
// the merge base with HEAD, read through git; or a directory given to the check. A row the
// baseline does not hold exists only on the current branch and may be corrected there, and a
// branch that is behind main is not asked for what main gained since. An error says "which main
// holds" of that commit. A recorded content hash was the other way graphrefly:B146's acceptance
// allowed; an edit could change the hash in the same commit.
//
// Limits.
// - Two branches that each pass may not pass together: one that links a trace while the other
//   edits it merges cleanly. A fast-forward merge cannot do this, and after any other the check on
//   main finds it while origin/main is where main was. With several merge bases git names one.
// - In a shallow clone, or a history that shares nothing with main, there is no merge base and
//   the ref itself is the baseline, so a branch that is behind is refused for what main gained.
// - A decision and the rows it changes land together: once main holds the decision it is no new
//   one, and a transition or succession added in its name afterwards is refused.
// - A baseline two changes old may refuse a later, allowed one: a link that followed two
//   successions, or a correction of a contract revision that has since got its transition.
// - Refs named main or origin/main that are not those branches are believed, and a checkout inside
//   another repository reads that repository's files.
// - On main with nothing ahead of origin/main the comparison is with itself, so the check has to
//   run before a push.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { isDeepStrictEqual } from "node:util";

const FILES = Object.freeze({ rules: "spec/rules.jsonl", contracts: "operators/contracts.jsonl", traces: "operators/traces.jsonl" });
const MANIFEST = "authority/ledgers.jsonl";
const ROOT_DECISIONS = Object.freeze(["decisions/decisions.jsonl", "decisions/execution.jsonl"]);

const list = (value) => (Array.isArray(value) ? value : []);
const rows = (text) => (text ?? "").split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line));

// `read(path)` gives a file's text, or null when it is not there.
export function ledgersFrom(read) {
  // The root's own decision ledgers are those the manifest lists inside the repository.
  const manifest = read(MANIFEST);
  // As authority/federation.mjs has it: only a path that starts with ../ is another repository's.
  const own = manifest === null ? [] : rows(manifest).filter((row) => typeof row.path === "string" && !row.path.startsWith("../"));
  const paths = manifest === null ? ROOT_DECISIONS : own.map((row) => row.path);
  return {
    manifest: own,
    rules: rows(read(FILES.rules)),
    contracts: rows(read(FILES.contracts)),
    traces: rows(read(FILES.traces)),
    decisions: paths.map((path) => ({ path, rows: rows(read(posix.normalize(path))) })), // read as git names it
  };
}

const isActive = (row) => list(row.activated_by).length > 0 && !row.transition;
const places = (contract) => [["its use", list(contract.traces)], ...list(contract.exceptions).map((item) => [`its ${item.topic} exception`, list(item.traces)])];

// The errors of `now` against `base`, each naming what changed and where the baseline is from.
export function immutableErrors(base, now, label) {
  const errors = [];
  const fail = (what) => errors.push(`${what}, which ${label} holds (graphrefly:D815, graphrefly:D816)`);

  // A new decision is a locked row that the change adds to one of the root's ledgers: its id is
  // none the baseline holds, in any of them. An id without a row, or a row that is not locked, is
  // no decision yet; and once main holds the row it is held as every locked decision is.
  const known = new Set(base.decisions.flatMap((ledger) => ledger.rows.map((row) => row.id)));
  const lockedNow = new Set(now.decisions.flatMap((ledger) => ledger.rows.filter((row) => row.status === "locked").map((row) => row.id)));
  const isNew = (id) => typeof id === "string" && !known.has(id) && lockedNow.has(id);

  const ruleNow = new Map(now.rules.map((row) => [`${row.id}@${row.revision}`, row]));
  for (const row of base.rules.filter((item) => list(item.activated_by).length > 0)) {
    const at = `${row.id}@${row.revision}`;
    const other = ruleNow.get(at);
    if (!other) { fail(`activated rule revision ${at} is gone`); continue; }
    if (other.statement !== row.statement) fail(`the statement of activated rule revision ${at} changed`);
    if (list(other.activated_by).length === 0) fail(`activated rule revision ${at} lost activated_by`);
    // A current rule leaves the protocol by a new decision; a transition main holds stays, since
    // without it the revision would be current again.
    if (!row.transition && other.transition && !isNew(other.transition.by)) fail(`activated rule revision ${at} gained a transition that names no new decision`);
    if (row.transition && !isDeepStrictEqual(other.transition, row.transition)) fail(`the transition of activated rule revision ${at} changed`);
  }

  const IDENTITY = ["origin", "owner", "authority_class"];
  const gone = new Set();
  for (const row of list(base.manifest)) {
    const other = list(now.manifest).find((item) => item.path === row.path);
    if (!other) { gone.add(row.path); fail(`ledger ${row.path} is gone from the manifest`); }
    else if (IDENTITY.some((key) => !isDeepStrictEqual(other[key], row[key]))) fail(`the identity of ledger ${row.path} changed in the manifest`);
  }
  for (const ledger of base.decisions) {
    if (gone.has(ledger.path)) continue; // reported above, once
    const decisionNow = new Map((now.decisions.find((item) => item.path === ledger.path)?.rows ?? []).map((row) => [row.id, row]));
    // A decision supersedes when it is made: no row of the baseline gains or loses one in place,
    // locked or not.
    for (const row of ledger.rows.filter((item) => item.status !== "locked")) {
      const other = decisionNow.get(row.id);
      if (other && !isDeepStrictEqual(other.supersedes ?? [], row.supersedes ?? [])) fail(`the supersedes of decision ${row.id} changed`);
    }
    for (const row of ledger.rows.filter((item) => item.status === "locked")) {
      const other = decisionNow.get(row.id);
      if (!other) { fail(`locked decision ${row.id} is gone from ${ledger.path}`); continue; }
      if (!isDeepStrictEqual(other.decision, row.decision)) fail(`the text of locked decision ${row.id} changed`);
      if (other.status !== "locked") fail(`locked decision ${row.id} is no longer locked`);
      if (!isDeepStrictEqual(other.superseded_by, row.superseded_by)) {
        fail(row.superseded_by === undefined ? `locked decision ${row.id} gained superseded_by` : `the superseded_by of locked decision ${row.id} changed`);
      }
      if (!isDeepStrictEqual(other.supersedes ?? [], row.supersedes ?? [])) fail(`the supersedes of locked decision ${row.id} changed`);
    }
  }

  const contractNow = new Map(now.contracts.map((row) => [`${row.id}@${row.revision}`, row]));
  const traceNow = new Map(now.traces.map((row) => [row.id, row]));
  const held = new Set();
  for (const row of base.contracts.filter(isActive)) {
    const at = `${row.id}@${row.revision}`;
    for (const [, ids] of places(row)) for (const id of ids) held.add(id);
    const other = contractNow.get(at);
    if (!other) { fail(`active contract ${at} is gone`); continue; }
    if (other.use !== row.use) fail(`the use of active contract ${at} changed`);
    if (list(other.activated_by).length === 0) fail(`active contract ${at} lost activated_by`);
    if (other.transition && !isNew(other.transition.by)) fail(`active contract ${at} gained a transition that names no new decision`);
    const topics = new Map(list(other.exceptions).map((item) => [item.topic, item]));
    for (const item of list(row.exceptions)) {
      if (!topics.has(item.topic)) fail(`the ${item.topic} exception of active contract ${at} is gone`);
      else if (topics.get(item.topic).statement !== item.statement) fail(`the ${item.topic} exception of active contract ${at} changed`);
    }
    for (const topic of topics.keys()) if (!list(row.exceptions).some((item) => item.topic === topic)) fail(`active contract ${at} gained a ${topic} exception`);
    const placesNow = new Map(places(other));
    for (const [place, ids] of places(row)) {
      if (!placesNow.has(place)) continue; // an exception that is gone is reported above, once
      const there = new Set(placesNow.get(place));
      for (const id of ids) {
        if (there.has(id)) continue;
        // A link may move in place to the trace that succeeded the one it named.
        const successor = traceNow.get(id)?.succeeded_by;
        if (successor === undefined || !there.has(successor)) fail(`the link of active contract ${at} to ${id} is gone from ${place}`);
      }
    }
  }

  // A revision that was activated and has its transition keeps its row, the transition and its
  // activated_by: without the transition it would be in force again, with whatever it says by then.
  for (const row of base.contracts.filter((item) => list(item.activated_by).length > 0 && item.transition)) {
    const at = `${row.id}@${row.revision}`;
    const other = contractNow.get(at);
    if (!other) { fail(`contract ${at}, which has its transition, is gone`); continue; }
    if (!isDeepStrictEqual(other.transition, row.transition)) fail(`the transition of contract ${at} changed`);
    if (list(other.activated_by).length === 0) fail(`contract ${at} lost activated_by`);
  }

  const traceBase = new Map(base.traces.map((row) => [row.id, row]));
  const named = (key) => (key === "expect" ? "expectation" : key);
  for (const id of held) {
    const row = traceBase.get(id);
    if (!row || row.succeeded_by !== undefined) continue; // an unresolved link is the link check's; a succeeded trace is held below
    const other = traceNow.get(id);
    if (!other) { fail(`trace ${id}, which an active contract links, is gone`); continue; }
    for (const key of ["nodes", "steps", "expect"]) {
      if (!isDeepStrictEqual(other[key], row[key])) fail(`the ${named(key)} of trace ${id}, which an active contract links, changed`);
    }
    if (other.succeeded_by === undefined) continue;
    // Succeeded since the baseline: under a new decision, and by a new trace.
    if (!isNew(other.succeeded_under)) fail(`trace ${id} was succeeded without naming a new decision`);
    if (traceBase.has(other.succeeded_by)) fail(`trace ${id} was succeeded by ${other.succeeded_by}, which is not a new trace`);
  }
  // A trace the baseline holds as succeeded stays in the ledger as it is, whether or not a contract
  // still links it (graphrefly:D816 (1)).
  for (const row of base.traces.filter((item) => item.succeeded_by !== undefined)) {
    const other = traceNow.get(row.id);
    if (!other) { fail(`succeeded trace ${row.id} is gone`); continue; }
    for (const key of ["nodes", "steps", "expect"]) {
      if (!isDeepStrictEqual(other[key], row[key])) fail(`the ${named(key)} of succeeded trace ${row.id} changed`);
    }
    if (other.succeeded_by !== row.succeeded_by || other.succeeded_under !== row.succeeded_under) fail(`the succession of trace ${row.id} changed`);
  }
  return errors;
}

const fromDirectory = (dir) => (path) => (existsSync(join(dir, path)) ? readFileSync(join(dir, path), "utf8") : null);

// A commit at which the checkout left origin/main, and one for main, each once: git's merge base
// with HEAD, or the ref itself where there is none. Empty where there is no git or neither ref exists.
function gitBaselines(root) {
  const git = (args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 });
  const found = new Map();
  for (const name of ["origin/main", "main"]) {
    let commit;
    try { commit = git(["rev-parse", "--verify", "--quiet", `${name}^{commit}`]).trim(); } catch { continue; }
    try { commit = git(["merge-base", "HEAD", commit]).trim() || commit; } catch { /* no HEAD yet, or no common history: the ref itself */ }
    if (commit && !found.has(commit)) found.set(commit, name);
  }
  return [...found].map(([commit, name]) => ({
    label: name,
    read: (path) => { try { return git(["show", `${commit}:${path}`]); } catch { return null; } },
  }));
}

// Compares the checkout at `root` with each baseline. With `baselineDir` that directory is the one
// baseline, which is how a test runs this without git; a directory that is not there, or does not
// hold the rules, the contracts, the traces and a decision ledger, is refused. `compared` names the baselines used; without a directory it is empty where
// there is no git or neither ref, and the caller says that nothing was compared.
export function checkImmutable(root, { baselineDir } = {}) {
  if (baselineDir !== undefined) {
    if (!existsSync(baselineDir)) throw new Error(`the baseline directory ${baselineDir} does not exist`);
    const there = ledgersFrom(fromDirectory(baselineDir));
    if (!there.rules.length || !there.contracts.length || !there.traces.length || !there.decisions.some((ledger) => ledger.rows.length)) throw new Error(`the baseline directory ${baselineDir} does not hold the ledgers`);
  }
  const baselines = baselineDir ? [{ label: `the baseline at ${baselineDir}`, read: fromDirectory(baselineDir) }] : gitBaselines(root);
  const now = ledgersFrom(fromDirectory(root));
  const errors = [];
  for (const baseline of baselines) {
    for (const error of immutableErrors(ledgersFrom(baseline.read), now, baseline.label)) if (!errors.includes(error)) errors.push(error);
  }
  return { errors, compared: baselines.map((baseline) => baseline.label) };
}
