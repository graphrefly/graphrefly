// What is immutable on main, held against a baseline (graphrefly:B146).
//
// graphrefly:D815 names an activated rule revision's statement and a locked decision's text.
// graphrefly:D816 (1) adds, of an active operator contract: its use; its exceptions, each with its
// topic and statement; the links it and its exceptions have to traces, none removed or moved to
// another exception; and the nodes, steps and expectation of every trace it links. Each changes
// only through a new revision or decision. Nothing else is held here: a rationale, a trace's name
// and basis, a draft, a new trace and a new link are corrected or added in place (D816 (2)).
//
// The baseline is what main holds: `origin/main` and `main`, read through git, or a directory given
// to the check. A row the baseline does not hold exists only on the current branch and may be
// corrected there, so only rows of the baseline are compared. A recorded content hash was the other
// way this item's acceptance allowed; an edit could change the hash in the same commit.
//
// A linked trace is not edited: it is succeeded by a new one and keeps its row, with `succeeded_by`.
// A link to it may then move to its successor in the same place.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
  const paths = manifest === null ? ROOT_DECISIONS : rows(manifest).map((row) => row.path).filter((path) => typeof path === "string" && !path.startsWith(".."));
  return {
    rules: rows(read(FILES.rules)),
    contracts: rows(read(FILES.contracts)),
    traces: rows(read(FILES.traces)),
    decisions: paths.map((path) => ({ path, rows: rows(read(path)) })),
  };
}

const isActive = (row) => list(row.activated_by).length > 0 && !row.transition;
const places = (contract) => [["its use", list(contract.traces)], ...list(contract.exceptions).map((item) => [`its ${item.topic} exception`, list(item.traces)])];

// The errors of `now` against `base`, each naming what changed and where the baseline is from.
export function immutableErrors(base, now, label) {
  const errors = [];
  const fail = (what) => errors.push(`${what}, which ${label} holds (graphrefly:D815, graphrefly:D816)`);

  const ruleNow = new Map(now.rules.map((row) => [`${row.id}@${row.revision}`, row]));
  for (const row of base.rules.filter((item) => list(item.activated_by).length > 0)) {
    const at = `${row.id}@${row.revision}`;
    const other = ruleNow.get(at);
    if (!other) fail(`activated rule revision ${at} is gone`);
    else if (other.statement !== row.statement) fail(`the statement of activated rule revision ${at} changed`);
  }

  for (const ledger of base.decisions) {
    const decisionNow = new Map((now.decisions.find((item) => item.path === ledger.path)?.rows ?? []).map((row) => [row.id, row]));
    for (const row of ledger.rows.filter((item) => item.status === "locked")) {
      const other = decisionNow.get(row.id);
      if (!other) fail(`locked decision ${row.id} is gone from ${ledger.path}`);
      else if (!isDeepStrictEqual(other.decision, row.decision)) fail(`the text of locked decision ${row.id} changed`);
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

  const traceBase = new Map(base.traces.map((row) => [row.id, row]));
  for (const id of held) {
    const row = traceBase.get(id);
    if (!row) continue; // a link the baseline could not resolve is the link check's to report
    const other = traceNow.get(id);
    if (!other) { fail(`trace ${id}, which an active contract links, is gone`); continue; }
    for (const key of ["nodes", "steps", "expect"]) {
      if (!isDeepStrictEqual(other[key], row[key])) fail(`the ${key === "expect" ? "expectation" : key} of trace ${id}, which an active contract links, changed`);
    }
  }
  return errors;
}

const fromDirectory = (dir) => (path) => (existsSync(join(dir, path)) ? readFileSync(join(dir, path), "utf8") : null);

// The commits of origin/main and main, each once. Empty where there is no git or neither exists.
function gitBaselines(root) {
  const git = (args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 });
  const found = new Map();
  for (const name of ["origin/main", "main"]) {
    let commit;
    try { commit = git(["rev-parse", "--verify", "--quiet", `${name}^{commit}`]).trim(); } catch { continue; }
    if (commit && !found.has(commit)) found.set(commit, name);
  }
  return [...found].map(([commit, name]) => ({
    label: name,
    read: (path) => { try { return git(["show", `${commit}:${path}`]); } catch { return null; } },
  }));
}

// Compares the checkout at `root` with each baseline. With `baselineDir` that directory is the one
// baseline, which is how a test runs this without git. `compared` names the baselines used; when it
// is empty nothing was compared, and the caller says so.
export function checkImmutable(root, { baselineDir } = {}) {
  const baselines = baselineDir ? [{ label: `the baseline at ${baselineDir}`, read: fromDirectory(baselineDir) }] : gitBaselines(root);
  const now = ledgersFrom(fromDirectory(root));
  const errors = [];
  for (const baseline of baselines) {
    for (const error of immutableErrors(ledgersFrom(baseline.read), now, baseline.label)) if (!errors.includes(error)) errors.push(error);
  }
  return { errors, compared: baselines.map((baseline) => baseline.label) };
}
