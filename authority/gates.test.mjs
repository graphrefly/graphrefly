import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadFederation } from "./federation.mjs";

// Fourth QA (2026-11-19): the check and the dashboard build compare the two resolvers, and nothing
// pinned either call: with both removed every test and gate stayed green. The real ledgers cannot
// make the resolvers disagree, a fault in one of them does, so this runs the two gates over a copy
// of authority/ and dashboard/ beside links to everything else, as they are and with one resolver
// made to lose a current decision.
//
// Fifth QA (2026-11-20): the first version replaced the comparison itself with one that always
// disagreed, so a gate that compared a resolver with itself, or compared only without
// --workspace, still passed. Now the comparison is left alone and each resolver in turn loses a
// decision, with and without --workspace.
//
// Sixth QA (2026-11-20): both resolvers lost the first decision, so a gate that compared only the
// first few passed; the decision lost is now one from the middle, and the line must name it. A
// copy has no sibling checkouts, so with --workspace a gate fails there for that alone: its exit
// status is asked only without it, and with it only the comparison's line. Nothing here pins that
// the gates give the model the other ledgers' successors (externalSuperseders); the real
// --workspace runs do.
const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const line = /^\s*(\S+) is current in one resolver and not in the other$/gm;
const rootCurrent = loadFederation(repo, { includeExternal: false }).currentProduct.current_qualified_ids.filter((id) => id.startsWith("graphrefly:"));
const lost = rootCurrent[Math.floor(rootCurrent.length / 2)];

const faults = {
  "the model resolver": ["authority/model.mjs", "current: supersessionGraph.currentCandidates,",
    `current: supersessionGraph.currentCandidates.filter((id) => id !== ${JSON.stringify(lost.slice("graphrefly:".length))}),`],
  "the federation resolver": ["authority/federation.mjs", "current_qualified_ids: currentProductIds,",
    `current_qualified_ids: currentProductIds.filter((id) => id !== ${JSON.stringify(lost)}),`],
};

function copyOfTheGates(roots, fault) {
  const root = mkdtempSync(join(tmpdir(), "graphrefly-gates-"));
  roots.push(root);
  for (const name of readdirSync(repo)) {
    if (name === ".git") continue;
    if (name === "authority" || name === "dashboard") cpSync(join(repo, name), join(root, name), { recursive: true });
    else symlinkSync(join(repo, name), join(root, name));
  }
  if (fault) {
    const [file, from, to] = fault;
    const source = readFileSync(join(root, file), "utf8");
    assert.equal(source.split(from).length, 2, `${file} still has the line this test changes`);
    writeFileSync(join(root, file), source.replace(from, to));
  }
  return root;
}

const gates = [["authority/check.mjs"], ["dashboard/build.mjs", "--check"]];
function disagreements(root, [script, ...args], mode) {
  const run = spawnSync(process.execPath, [join(root, script), ...args, ...mode], { encoding: "utf8", timeout: 60_000 });
  assert.equal(run.error, undefined, `${script} ${mode.join(" ")} ran`);
  return { status: run.status, lines: [...(run.stdout + run.stderr).matchAll(line)].map((m) => m[1]) };
}

test("the check and the dashboard build report a decision that one resolver alone calls current", () => {
  const roots = [];
  try {
    const asIs = copyOfTheGates(roots, null);
    for (const gate of gates) {
      for (const mode of [[], ["--workspace"]]) {
        assert.deepEqual(disagreements(asIs, gate, mode).lines, [], `${gate[0]} ${mode.join(" ")} on the copy as it is`);
      }
    }
    for (const [which, fault] of Object.entries(faults)) {
      const faulty = copyOfTheGates(roots, fault);
      for (const gate of gates) {
        for (const mode of [[], ["--workspace"]]) {
          const got = disagreements(faulty, gate, mode);
          assert.deepEqual(got.lines, [lost], `${gate[0]} ${mode.join(" ")} names the one decision ${which} lost`);
          if (!mode.length) assert.equal(got.status, 1, `${gate[0]} fails`);
        }
      }
    }
  } finally {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  }
});
