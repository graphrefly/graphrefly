import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadFederation, qualifyDecisionRef, resolveDecisionRef } from "./federation.mjs";

function writeJsonl(path, records) {
  writeFileSync(path, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
}

test("origin-qualified identities coexist and contextual references resolve uniquely", () => {
  const root = mkdtempSync(join(tmpdir(), "graphrefly-authority-"));
  try {
    mkdirSync(join(root, "authority"));
    mkdirSync(join(root, "decisions"));
    mkdirSync(join(root, "stack"));
    writeJsonl(join(root, "authority/ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", authority_class: "durable-root", path: "decisions/root.jsonl", availability: "required", include_in_root_dashboard: true },
      { origin: "graphrefly-stack", owner: "graphrefly-stack", authority_class: "product-local", path: "stack/decisions.jsonl", availability: "required", include_in_root_dashboard: false },
    ]);
    writeJsonl(join(root, "decisions/root.jsonl"), [{ id: "D1", status: "locked", supersedes: [] }]);
    writeJsonl(join(root, "stack/decisions.jsonl"), [{ id: "D1", status: "locked", supersedes: [], upstream_refs: ["D1"] }]);
    writeJsonl(join(root, "authority/relocations.jsonl"), []);

    const federation = loadFederation(root, { includeExternal: true });
    assert.deepEqual(federation.errors, []);
    assert.deepEqual(federation.qualifiedIds, ["graphrefly-stack:D1", "graphrefly:D1"]);
    assert.equal(qualifyDecisionRef("D1", "graphrefly-stack"), "graphrefly-stack:D1");
    assert.equal(qualifyDecisionRef("D1", "graphrefly-stack", { upstream: true }), "graphrefly:D1");
    assert.equal(resolveDecisionRef(federation.qualifiedIndex, "D1", "graphrefly-stack")?.record.id, "D1");
    assert.deepEqual(federation.referenceEdges, [{ from: "graphrefly-stack:D1", to: "graphrefly:D1", relation: "upstream_refs", source_ref: "D1" }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("one root origin may retain distinct owner-local history ledgers", () => {
  const root = mkdtempSync(join(tmpdir(), "graphrefly-authority-"));
  try {
    mkdirSync(join(root, "authority"));
    mkdirSync(join(root, "decisions"));
    writeJsonl(join(root, "authority/ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly-ts", authority_class: "package-local-history", path: "decisions/ts.jsonl", availability: "required", include_in_root_dashboard: false },
      { origin: "graphrefly", owner: "graphrefly-py", authority_class: "package-local-history", path: "decisions/py.jsonl", availability: "required", include_in_root_dashboard: false },
    ]);
    writeJsonl(join(root, "decisions/ts.jsonl"), [{ id: "D1", status: "locked", supersedes: [] }]);
    writeJsonl(join(root, "decisions/py.jsonl"), [{ id: "D2", status: "locked", supersedes: [] }]);
    writeJsonl(join(root, "authority/relocations.jsonl"), []);

    const federation = loadFederation(root);
    assert.deepEqual(federation.errors, []);
    assert.deepEqual(federation.qualifiedIds, ["graphrefly:D1", "graphrefly:D2"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("future owner-ledger admission requires classification and lifecycle metadata", () => {
  const root = mkdtempSync(join(tmpdir(), "graphrefly-authority-"));
  try {
    mkdirSync(join(root, "authority"));
    mkdirSync(join(root, "decisions"));
    writeJsonl(join(root, "authority/ledgers.jsonl"), [
      { origin: "graphrefly-canvas", owner: "graphrefly-canvas", authority_class: "product-local", path: "decisions/canvas.jsonl", availability: "required", include_in_root_dashboard: false, admission_after: 0 },
    ]);
    writeJsonl(join(root, "decisions/canvas.jsonl"), [{ id: "D1", status: "locked", supersedes: [] }]);
    writeJsonl(join(root, "authority/relocations.jsonl"), []);

    const federation = loadFederation(root);
    assert.ok(federation.errors.some((error) => error.includes("must declare non-empty stable concerns")));
    assert.ok(federation.errors.some((error) => error.includes("invalid decision_kind")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("future semantic protocol admission is root-only and obligation-complete", () => {
  const root = mkdtempSync(join(tmpdir(), "graphrefly-authority-"));
  try {
    mkdirSync(join(root, "authority"));
    mkdirSync(join(root, "decisions"));
    writeJsonl(join(root, "authority/ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", authority_class: "durable-root", path: "decisions/root.jsonl", availability: "required", include_in_root_dashboard: true, admission_after: 0 },
    ]);
    writeJsonl(join(root, "decisions/root.jsonl"), [{
      id: "D1", status: "locked", supersedes: [], concerns: ["protocol.wave"],
      decision_kind: "protocol-decision", change_kind: "new", protocol_impact: "semantic",
      spec_amend: "SA-1", conformance_obligations: ["C-new"], formal_obligations: ["Wave.tla"],
      completion: { complete_when: "ratified", historical_when: "superseded" },
    }]);
    writeJsonl(join(root, "authority/relocations.jsonl"), []);

    const federation = loadFederation(root);
    assert.deepEqual(federation.errors, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("relocation locators fail when canonical bytes change", () => {
  const root = mkdtempSync(join(tmpdir(), "graphrefly-authority-"));
  try {
    mkdirSync(join(root, "authority"));
    mkdirSync(join(root, "decisions"));
    const record = { id: "D7", status: "locked", supersedes: [] };
    const raw = JSON.stringify(record);
    writeJsonl(join(root, "authority/ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", authority_class: "evaluation-execution", path: "decisions/execution.jsonl", availability: "required", include_in_root_dashboard: true },
    ]);
    writeFileSync(join(root, "decisions/execution.jsonl"), `${raw}\n`);
    writeJsonl(join(root, "authority/relocations.jsonl"), [{
      qualified_id: "graphrefly:D7",
      id: "D7",
      origin: "graphrefly",
      owner: "graphrefly",
      authority_class: "evaluation-execution",
      canonical_path: "decisions/execution.jsonl",
      sha256: createHash("sha256").update(`${raw} changed`).digest("hex"),
    }]);

    const federation = loadFederation(root);
    assert.ok(federation.errors.some((error) => error.includes("integrity mismatch")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("federated supersession cycles fail across owner ledgers", () => {
  const root = mkdtempSync(join(tmpdir(), "graphrefly-authority-"));
  try {
    mkdirSync(join(root, "authority"));
    mkdirSync(join(root, "decisions"));
    writeJsonl(join(root, "authority/ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", authority_class: "durable-root", path: "decisions/root.jsonl", availability: "required", include_in_root_dashboard: true },
    ]);
    writeJsonl(join(root, "decisions/root.jsonl"), [
      { id: "D1", status: "locked", supersedes: ["D2"] },
      { id: "D2", status: "locked", supersedes: ["D1"] },
    ]);
    writeJsonl(join(root, "authority/relocations.jsonl"), []);

    const federation = loadFederation(root);
    assert.ok(federation.errors.some((error) => error.includes("federated decision supersession cycle")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("root-only checks resolve an external relocation locator without copying its body", () => {
  const root = mkdtempSync(join(tmpdir(), "graphrefly-authority-"));
  const sibling = mkdtempSync(join(tmpdir(), "graphrefly-owner-"));
  try {
    mkdirSync(join(root, "authority"));
    mkdirSync(join(root, "decisions"));
    mkdirSync(join(sibling, "decisions"));
    const record = { id: "D9", status: "locked", supersedes: [] };
    const raw = JSON.stringify(record);
    const siblingRelative = `../${sibling.slice(sibling.lastIndexOf("/") + 1)}/decisions/history.jsonl`;
    writeJsonl(join(root, "authority/ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", authority_class: "durable-root", path: "decisions/root.jsonl", availability: "required", include_in_root_dashboard: true },
      { origin: "graphrefly", owner: "graphrefly-canvas", authority_class: "product-local-history", path: siblingRelative, availability: "workspace-optional", include_in_root_dashboard: false },
    ]);
    writeJsonl(join(root, "decisions/root.jsonl"), [{ id: "D1", status: "locked", supersedes: ["D9"] }]);
    writeFileSync(join(sibling, "decisions/history.jsonl"), `${raw}\n`);
    writeJsonl(join(root, "authority/relocations.jsonl"), [{
      qualified_id: "graphrefly:D9",
      id: "D9",
      origin: "graphrefly",
      owner: "graphrefly-canvas",
      authority_class: "product-local-history",
      canonical_path: siblingRelative,
      sha256: createHash("sha256").update(raw).digest("hex"),
      relocated_from: "decisions/root.jsonl",
    }]);

    const rootOnly = loadFederation(root);
    assert.deepEqual(rootOnly.errors, []);
    assert.deepEqual(rootOnly.unverifiedRelocations, ["graphrefly:D9"]);
    assert.equal(rootOnly.currentProduct.complete, false);
    assert.ok(rootOnly.referenceEdges.some((edge) => edge.from === "graphrefly:D1" && edge.to === "graphrefly:D9" && edge.relation === "supersedes"));
    const workspace = loadFederation(root, { includeExternal: true });
    assert.deepEqual(workspace.errors, []);
    assert.deepEqual(workspace.unverifiedRelocations, []);
    assert.ok(workspace.qualifiedIds.includes("graphrefly:D9"));
    assert.equal(workspace.currentProduct.complete, true);
    assert.deepEqual(workspace.currentProduct.current_qualified_ids, ["graphrefly:D1"]);
    assert.deepEqual(workspace.currentProduct.historical_qualified_ids, ["graphrefly:D9"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(sibling, { recursive: true, force: true });
  }
});
