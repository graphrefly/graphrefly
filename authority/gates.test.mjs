import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Fourth QA (2026-11-19): the check and the dashboard build compare the two resolvers, and nothing
// pinned either call: with both removed every test and gate stayed green. The real ledgers cannot
// make the resolvers disagree, a fault in one of them does, so this runs the two gates over a copy
// of authority/ and dashboard/build.mjs beside links to everything else, once as they are and once
// with a comparison that reports a disagreement.
const repo = join(dirname(fileURLToPath(import.meta.url)), "..");

function copyOfTheGates(patch) {
  const root = mkdtempSync(join(tmpdir(), "graphrefly-gates-"));
  for (const name of readdirSync(repo)) {
    if (name === ".git") continue;
    if (name === "authority" || name === "dashboard") cpSync(join(repo, name), join(root, name), { recursive: true });
    else symlinkSync(join(repo, name), join(root, name));
  }
  if (patch) {
    const path = join(root, "authority/federation.mjs");
    const source = readFileSync(path, "utf8");
    const signature = "export function resolverDisagreements(federation, modelCurrentIds) {";
    assert.equal(source.split(signature).length, 2, "the comparison's signature");
    writeFileSync(path, source.replace(signature, `export function resolverDisagreements() { return ["graphrefly:D1"]; }\nfunction replaced(federation, modelCurrentIds) {`));
  }
  return root;
}

const gates = [["authority/check.mjs"], ["dashboard/build.mjs", "--check"]];
const run = (root, [script, ...args]) => spawnSync(process.execPath, [join(root, script), ...args], { encoding: "utf8" });

test("the check and the dashboard build fail when the two resolvers disagree about a record", () => {
  const asIs = copyOfTheGates(false);
  const disagreeing = copyOfTheGates(true);
  try {
    for (const gate of gates) {
      const clean = run(asIs, gate);
      assert.equal(clean.status, 0, `${gate[0]} passes on the copy as it is: ${clean.stderr}`);
      const failed = run(disagreeing, gate);
      assert.equal(failed.status, 1, `${gate[0]} fails`);
      assert.match(failed.stdout + failed.stderr, /graphrefly:D1 is current in one resolver and not in the other/, gate[0]);
    }
  } finally {
    rmSync(asIs, { recursive: true, force: true });
    rmSync(disagreeing, { recursive: true, force: true });
  }
});
