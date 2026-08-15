import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadWorkFederation, qualifyWorkRef } from "./work-federation.mjs";

function writeJsonl(path, records) {
  writeFileSync(path, records.length > 0 ? `${records.map((record) => JSON.stringify(record)).join("\n")}\n` : "");
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "graphrefly-work-"));
  mkdirSync(join(root, "authority"));
  mkdirSync(join(root, "plan"));
  writeJsonl(join(root, "authority/work-relocations.jsonl"), []);
  return root;
}

function valid(overrides = {}) {
  return {
    id: "W-1",
    owner: "graphrefly",
    kind: "program-phase",
    outcome: "Produce one bounded result",
    status: "planned",
    governing_refs: ["graphrefly:D787"],
    prerequisites: [],
    acceptance: ["The bounded result is verified"],
    evidence_refs: [],
    produces: [],
    consumes: [],
    supersedes: [],
    non_goals: [],
    ...overrides,
  };
}

test("strict work records use origin-qualified identities and dependencies", () => {
  const root = fixture();
  try {
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "implementation-slice", path: "plan/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
    ]);
    writeJsonl(join(root, "plan/work.jsonl"), [
      valid({ id: "W-1", status: "complete", evidence_refs: [{ ref: "test:W-1", revision: "0123456789abcdef0123456789abcdef01234567" }] }),
      valid({ id: "W-2", outcome: "Consume the first result", prerequisites: [{ work_ref: "graphrefly:W-1" }] }),
    ]);
    const work = loadWorkFederation(root);
    assert.deepEqual(work.errors, []);
    assert.deepEqual(work.qualifiedIds, ["graphrefly:W-1", "graphrefly:W-2"]);
    assert.deepEqual(work.dependencyEdges, [{ from: "graphrefly:W-2", to: "graphrefly:W-1", relation: "prerequisite" }]);
    assert.ok(work.generated.ready_but_not_authorized.includes("graphrefly:W-2"));
    assert.equal(work.generated.owner_next_candidates[0].execution_authority, false);
    assert.equal(qualifyWorkRef("W-1", "graphrefly"), "graphrefly:W-1");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("canonical lifecycle excludes ready and generated authority fields", () => {
  const root = fixture();
  try {
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "implementation-slice", path: "plan/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
    ]);
    writeJsonl(join(root, "plan/work.jsonl"), [valid({ status: "ready", readiness: "ready", implementation_authorized: true, superseded_by: "graphrefly:W-2" })]);
    const work = loadWorkFederation(root);
    assert.ok(work.errors.some((error) => error.includes("invalid canonical status ready")));
    assert.ok(work.errors.some((error) => error.includes("cannot persist generated field readiness")));
    assert.ok(work.errors.some((error) => error.includes("cannot persist generated field implementation_authorized")));
    assert.ok(work.errors.some((error) => error.includes("cannot persist generated field superseded_by")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("complete requires revision-bound evidence", () => {
  const root = fixture();
  try {
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "implementation-slice", path: "plan/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
    ]);
    writeJsonl(join(root, "plan/work.jsonl"), [valid({ status: "complete" })]);
    const work = loadWorkFederation(root);
    assert.ok(work.errors.some((error) => error.includes("complete work requires immutable evidence_refs")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("completion evidence rejects nonstandard commit-length hex strings", () => {
  const root = fixture();
  try {
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "implementation-slice", path: "plan/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
    ]);
    writeJsonl(join(root, "plan/work.jsonl"), [valid({ status: "complete", evidence_refs: [{ ref: "test:W-1", revision: "a".repeat(41) }] })]);
    const work = loadWorkFederation(root);
    assert.ok(work.errors.some((error) => error.includes("must bind a full commit revision or SHA-256 digest")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("cross-repository prerequisites fail on unqualified or broken refs", () => {
  const root = fixture();
  try {
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "implementation-slice", path: "plan/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
    ]);
    writeJsonl(join(root, "plan/work.jsonl"), [valid({ prerequisites: [{ work_ref: "W-0" }, { work_ref: "unknown:W-9" }] })]);
    const work = loadWorkFederation(root);
    assert.ok(work.errors.some((error) => error.includes("origin-qualified work_ref")));
    assert.ok(work.errors.some((error) => error.includes("unregistered origin unknown:W-9")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("cross-owner prerequisites require an exact artifact coordinate", () => {
  const root = fixture();
  try {
    mkdirSync(join(root, "stack"));
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "program-phase", path: "plan/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
      { origin: "graphrefly-stack", owner: "graphrefly-stack", work_class: "program-phase", path: "stack/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
    ]);
    writeJsonl(join(root, "plan/work.jsonl"), [valid({ id: "W-P", status: "complete", evidence_refs: [{ ref: "test:producer", digest: `sha256:${"a".repeat(64)}` }] })]);
    writeJsonl(join(root, "stack/work.jsonl"), [valid({ id: "W-C", owner: "graphrefly-stack", outcome: "Consume root output", prerequisites: [{ work_ref: "graphrefly:W-P" }] })]);
    const work = loadWorkFederation(root, { includeExternal: true });
    assert.ok(work.errors.some((error) => error.includes("requires artifact_ref, schema and revision")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("dependency cycles fail across owners", () => {
  const root = fixture();
  try {
    mkdirSync(join(root, "stack"));
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "implementation-slice", path: "plan/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
      { origin: "graphrefly-stack", owner: "graphrefly-stack", work_class: "implementation-slice", path: "stack/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
    ]);
    writeJsonl(join(root, "plan/work.jsonl"), [valid({ prerequisites: [{ work_ref: "graphrefly-stack:W-2" }] })]);
    writeJsonl(join(root, "stack/work.jsonl"), [valid({ id: "W-2", owner: "graphrefly-stack", outcome: "Stack result", prerequisites: [{ work_ref: "graphrefly:W-1" }] })]);
    const work = loadWorkFederation(root, { includeExternal: true });
    assert.ok(work.errors.some((error) => error.includes("federated work dependency cycle")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("duplicate qualified identity fails while same-outcome different identities require owner review", () => {
  const root = fixture();
  try {
    mkdirSync(join(root, "other"));
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "program-phase", path: "plan/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
      { origin: "graphrefly", owner: "graphrefly", work_class: "implementation-slice", path: "other/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
      { origin: "other", owner: "other", work_class: "implementation-slice", path: "other/second.jsonl", adapter: "work-jsonl-v1", availability: "required" },
    ]);
    writeJsonl(join(root, "plan/work.jsonl"), [valid()]);
    writeJsonl(join(root, "other/work.jsonl"), [valid()]);
    writeJsonl(join(root, "other/second.jsonl"), [valid({ id: "W-2", owner: "other" })]);
    const work = loadWorkFederation(root, { includeExternal: true });
    assert.ok(work.errors.some((error) => error.includes("qualified work identity duplicates graphrefly:W-1")));
    assert.ok(work.warnings.some((warning) => warning.includes("possible duplicate active outcome requires owner review")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("integration owner and artifact revision mismatches fail closed", () => {
  const root = fixture();
  try {
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "implementation-slice", path: "plan/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
    ]);
    writeJsonl(join(root, "plan/work.jsonl"), [
      valid({ id: "W-P", outcome: "Produce schema v1", produces: [{ artifact_ref: "artifact:one", schema: "v1", revision: "r1" }] }),
      valid({ id: "W-C", kind: "integration-milestone", outcome: "Consume schema v2", integration_owner: "other", consumes: [{ artifact_ref: "artifact:one", schema: "v2", revision: "r1" }] }),
    ]);
    const work = loadWorkFederation(root);
    assert.ok(work.errors.some((error) => error.includes("integration milestone must name its ledger owner")));
    assert.ok(work.errors.some((error) => error.includes('consumes unresolved artifact ["artifact:one","v2","r1"]')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a prerequisite artifact must match the named producer revision", () => {
  const root = fixture();
  try {
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "implementation-slice", path: "plan/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
    ]);
    writeJsonl(join(root, "plan/work.jsonl"), [
      valid({ id: "W-P", outcome: "Produce schema v1", produces: [{ artifact_ref: "artifact:one", schema: "v1", revision: "r1" }] }),
      valid({ id: "W-C", outcome: "Consume schema v2", prerequisites: [{ work_ref: "graphrefly:W-P", artifact_ref: "artifact:one", schema: "v2", revision: "r1" }] }),
    ]);
    const work = loadWorkFederation(root);
    assert.ok(work.errors.some((error) => error.includes('does not produce required artifact ["artifact:one","v2","r1"]')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("artifact consumption must name the producer as a prerequisite", () => {
  const root = fixture();
  try {
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "program-phase", path: "plan/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
    ]);
    writeJsonl(join(root, "plan/work.jsonl"), [
      valid({ id: "W-P", outcome: "Produce schema v1", produces: [{ artifact_ref: "artifact:one", schema: "v1", revision: "r1" }] }),
      valid({ id: "W-C", outcome: "Consume schema v1", consumes: [{ artifact_ref: "artifact:one", schema: "v1", revision: "r1" }] }),
    ]);
    const work = loadWorkFederation(root);
    assert.ok(work.errors.some((error) => error.includes("without a prerequisite on graphrefly:W-P")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("missing optional sibling ledger is unavailable rather than complete or blocked", () => {
  const root = fixture();
  try {
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly-ts", owner: "graphrefly-ts", work_class: "implementation-slice", path: "../graphrefly-ts/plan/work.jsonl", adapter: "work-jsonl-v1", availability: "workspace-optional" },
    ]);
    const work = loadWorkFederation(root, { includeExternal: true });
    assert.deepEqual(work.errors, []);
    assert.equal(work.ledgers[0].state, "unavailable");
    assert.equal(work.metrics.unavailable_ledgers, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("missing optional producer keeps decision and artifact refs unavailable rather than broken", () => {
  const root = fixture();
  try {
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "program-phase", path: "plan/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
      { origin: "graphrefly-ts", owner: "graphrefly-ts", work_class: "implementation-slice", path: "../graphrefly-ts/plan/work.jsonl", adapter: "work-jsonl-v1", availability: "workspace-optional" },
    ]);
    writeJsonl(join(root, "plan/work.jsonl"), [valid({
      governing_refs: ["graphrefly:D787", "graphrefly-ts:D1"],
      prerequisites: [{ work_ref: "graphrefly-ts:W-P", artifact_ref: "graphrefly-ts:proof", schema: "proof/v1", revision: "r1" }],
      consumes: [{ artifact_ref: "graphrefly-ts:proof", schema: "proof/v1", revision: "r1" }],
    })]);
    const decisionIndex = new Map([
      ["graphrefly:D787", { ledger: { authority_class: "durable-root" }, record: { decision_kind: "durable-architecture" } }],
    ]);
    const work = loadWorkFederation(root, { includeExternal: true, decisionIndex });
    assert.deepEqual(work.errors, []);
    assert.ok(work.warnings.some((warning) => warning.includes("governing decision is unavailable")));
    assert.ok(work.warnings.some((warning) => warning.includes("consumed artifact is unavailable")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("relocation markers bind canonical path, owner and bytes", () => {
  const root = fixture();
  try {
    const record = valid();
    const raw = JSON.stringify(record);
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "implementation-slice", path: "plan/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
    ]);
    writeFileSync(join(root, "plan/work.jsonl"), `${raw}\n`);
    writeJsonl(join(root, "authority/work-relocations.jsonl"), [{
      qualified_id: "graphrefly:W-1",
      origin: "graphrefly",
      owner: "graphrefly",
      canonical_path: "plan/work.jsonl",
      relocated_from: "plan/old.jsonl",
      relocated_from_owner: "graphrefly",
      relocated_from_adapter: "work-jsonl-v1",
      migration_ref: "graphrefly:D787",
      sha256: createHash("sha256").update(raw).digest("hex"),
      former_sha256: createHash("sha256").update(raw).digest("hex"),
    }]);
    assert.deepEqual(loadWorkFederation(root).errors, []);
    writeJsonl(join(root, "authority/work-relocations.jsonl"), [{
      qualified_id: "graphrefly:W-1",
      origin: "graphrefly",
      owner: "graphrefly",
      canonical_path: "plan/work.jsonl",
      relocated_from: "plan/old.jsonl",
      relocated_from_owner: "graphrefly",
      relocated_from_adapter: "work-jsonl-v1",
      migration_ref: "graphrefly:D787",
      sha256: "stale",
      former_sha256: createHash("sha256").update(raw).digest("hex"),
    }]);
    assert.ok(loadWorkFederation(root).errors.some((error) => error.includes("integrity mismatch")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("execution approval refs resolve only to execution-approval decisions", () => {
  const root = fixture();
  try {
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "implementation-slice", path: "plan/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
    ]);
    writeJsonl(join(root, "plan/work.jsonl"), [valid({ execution_approval_refs: ["graphrefly:D2", "graphrefly:D3"] })]);
    const decisionIndex = new Map([
      ["graphrefly:D787", { ledger: { authority_class: "durable-root" }, record: { decision_kind: "durable-architecture" } }],
      ["graphrefly:D2", { ledger: { authority_class: "durable-root" }, record: { decision_kind: "durable-architecture" } }],
      ["graphrefly:D3", { ledger: { authority_class: "evaluation-execution" }, record: { decision_kind: "implementation-receipt" } }],
    ]);
    const work = loadWorkFederation(root, { decisionIndex });
    assert.ok(work.errors.some((error) => error.includes("not an execution-approval: graphrefly:D2")));
    assert.ok(work.errors.some((error) => error.includes("not an execution-approval: graphrefly:D3")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("relocation fails while the old canonical body remains", () => {
  const root = fixture();
  try {
    const record = valid();
    const raw = JSON.stringify(record);
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "implementation-slice", path: "plan/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
    ]);
    writeFileSync(join(root, "plan/work.jsonl"), `${raw}\n`);
    writeFileSync(join(root, "plan/old.jsonl"), `${raw}\n`);
    writeJsonl(join(root, "authority/work-relocations.jsonl"), [{
      qualified_id: "graphrefly:W-1",
      origin: "graphrefly",
      owner: "graphrefly",
      canonical_path: "plan/work.jsonl",
      relocated_from: "plan/old.jsonl",
      relocated_from_owner: "graphrefly",
      relocated_from_adapter: "work-jsonl-v1",
      migration_ref: "graphrefly:D787",
      sha256: createHash("sha256").update(raw).digest("hex"),
      former_sha256: createHash("sha256").update(raw).digest("hex"),
    }]);
    assert.ok(loadWorkFederation(root).errors.some((error) => error.includes("canonical-body duplicate")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("in-progress implementation requires a separately resolved execution approval", () => {
  const root = fixture();
  try {
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "implementation-slice", path: "plan/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
    ]);
    writeJsonl(join(root, "plan/work.jsonl"), [valid({ kind: "implementation-slice", status: "in-progress" })]);
    const work = loadWorkFederation(root);
    assert.ok(work.errors.some((error) => error.includes("in-progress implementation requires an execution_approval_ref")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("in-progress strict work cannot bypass an incomplete same-owner prerequisite", () => {
  const root = fixture();
  try {
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "program-phase", path: "plan/phases.jsonl", adapter: "phase-jsonl-v0", availability: "required" },
    ]);
    writeJsonl(join(root, "plan/phases.jsonl"), [
      valid({ work_contract: "graphrefly-work-v1", id: "UPSTREAM", kind: "program-phase", status: "planned" }),
      valid({ work_contract: "graphrefly-work-v1", id: "DOWNSTREAM", kind: "program-phase", status: "in-progress", prerequisites: [{ work_ref: "graphrefly:UPSTREAM" }] }),
    ]);
    const work = loadWorkFederation(root);
    assert.ok(work.errors.some((error) => error.includes("graphrefly:DOWNSTREAM cannot be in-progress before prerequisite evidence is complete: graphrefly:UPSTREAM")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("hybrid owner schemas may project canonical status only when dependency order matches", () => {
  const root = fixture();
  try {
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "program-phase", path: "plan/phases.jsonl", adapter: "phase-jsonl-v0", availability: "required" },
    ]);
    writeJsonl(join(root, "plan/phases.jsonl"), [
      valid({ work_contract: "graphrefly-work-v1", id: "ROOT", status: "ready", canonical_status: "planned", deps: [] }),
      valid({ work_contract: "graphrefly-work-v1", id: "NEXT", deps: ["ROOT"], prerequisites: [] }),
    ]);
    const work = loadWorkFederation(root);
    assert.equal(work.records.find((record) => record.id === "ROOT")?.lifecycle_status, "planned");
    assert.ok(work.errors.some((error) => error.includes("deps compatibility projection must match canonical prerequisites")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("malformed strict collections fail diagnostically instead of crashing", () => {
  const root = fixture();
  try {
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "program-phase", path: "plan/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
    ]);
    writeJsonl(join(root, "plan/work.jsonl"), [valid({ outcome: null, evidence_refs: "bad", produces: {}, consumes: "bad", supersedes: "bad" })]);
    const work = loadWorkFederation(root);
    assert.ok(work.errors.some((error) => error.includes("must declare outcome")));
    assert.ok(work.errors.some((error) => error.includes("evidence_refs must be an array")));
    assert.ok(work.errors.some((error) => error.includes("produces must be an array")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("manifest rejects path traversal and multiple current owners for one origin", () => {
  const root = fixture();
  try {
    mkdirSync(join(root, "other"));
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "program-phase", path: "plan/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
      { origin: "graphrefly", owner: "other", work_class: "backlog-item", path: "other/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
      { origin: "escape", owner: "escape", work_class: "program-phase", path: "plan/../../outside/work.jsonl", adapter: "work-jsonl-v1", availability: "workspace-optional" },
    ]);
    writeJsonl(join(root, "plan/work.jsonl"), []);
    writeJsonl(join(root, "other/work.jsonl"), []);
    const work = loadWorkFederation(root, { includeExternal: true });
    assert.ok(work.errors.some((error) => error.includes("multiple current owners")));
    assert.ok(work.errors.some((error) => error.includes("unapproved external path")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("strict active slices without graph or cursor anchors fail as orphans", () => {
  const root = fixture();
  try {
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "implementation-slice", path: "plan/work.jsonl", adapter: "work-jsonl-v1", availability: "required" },
    ]);
    writeJsonl(join(root, "plan/work.jsonl"), [valid({ kind: "implementation-slice" })]);
    const work = loadWorkFederation(root);
    assert.deepEqual(work.orphans, ["graphrefly:W-1"]);
    assert.ok(work.errors.some((error) => error.includes("strict active work is orphaned")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Canvas Markdown roadmap projects one strict consumer-owned integration edge", () => {
  const root = fixture();
  try {
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly-stack", owner: "graphrefly-stack", work_class: "backlog-item", path: "plan/stack.jsonl", adapter: "backlog-jsonl-v0", availability: "required" },
      { origin: "graphrefly-canvas", owner: "graphrefly-canvas", work_class: "roadmap", path: "plan/canvas.md", adapter: "canvas-roadmap-md-v1", availability: "required" },
    ]);
    writeJsonl(join(root, "plan/stack.jsonl"), [{
      id: "B25",
      title: "Define a mapping contract",
      state: "deferred",
      produces: [{ artifact_ref: "stack:mapping", schema: "stack/mapping/v1", revision: "contract-v1" }],
    }]);
    writeFileSync(join(root, "plan/canvas.md"), `# Canvas roadmap

- **CT-1 Existing prose:** remains intentionally unavailable to the generated graph.

### CT-7. Stack review integration

- **Outcome:** Consume the Stack mapping without taking producer authority.
- **Acceptance:** Exact schema and revision match and Canvas supplies integration evidence.
- **Non-goals:** Automatic dispatch or Stack-owned Canvas completion.

<!-- graphrefly-work-v1
{"id":"CT-7","owner":"graphrefly-canvas","kind":"integration-milestone","status":"deferred","governing_refs":["graphrefly:D787"],"prerequisites":[{"work_ref":"graphrefly-stack:B25","artifact_ref":"stack:mapping","schema":"stack/mapping/v1","revision":"contract-v1"}],"consumes":[{"artifact_ref":"stack:mapping","schema":"stack/mapping/v1","revision":"contract-v1"}],"integration_owner":"graphrefly-canvas"}
-->
`);
    const decisionIndex = new Map([
      ["graphrefly:D787", { ledger: { authority_class: "durable-root" }, record: { decision_kind: "durable-architecture" } }],
    ]);
    const work = loadWorkFederation(root, { decisionIndex });
    assert.deepEqual(work.errors, []);
    assert.ok(work.warnings.some((warning) => warning.includes("prose-only roadmap items") && warning.includes("CT-1")));
    assert.equal(work.metrics.strict_records, 1);
    assert.equal(work.records.find((record) => record.qualified_id === "graphrefly-canvas:CT-7")?.integration_owner, "graphrefly-canvas");
    assert.ok(work.dependencyEdges.some((edge) => edge.from === "graphrefly-canvas:CT-7" && edge.to === "graphrefly-stack:B25"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Canvas Markdown roadmap projects multiline CT outcomes and exact root aggregate dependencies", () => {
  const root = fixture();
  try {
    writeJsonl(join(root, "authority/work-ledgers.jsonl"), [
      { origin: "graphrefly", owner: "graphrefly", work_class: "program-phase", path: "plan/phases.jsonl", adapter: "phase-jsonl-v0", availability: "required" },
      { origin: "graphrefly", owner: "graphrefly", work_class: "backlog-item", path: "plan/backlog.jsonl", adapter: "backlog-jsonl-v0", availability: "required" },
      { origin: "graphrefly-canvas", owner: "graphrefly-canvas", work_class: "roadmap", path: "plan/canvas.md", adapter: "canvas-roadmap-md-v1", availability: "required" },
    ]);
    writeJsonl(join(root, "plan/phases.jsonl"), [{
      id: "CSP-14",
      title: "Aggregate causal proof",
      status: "design",
      produces: [{ artifact_ref: "root:causal", schema: "root/causal/v1", revision: "csp14-v1" }],
    }]);
    writeJsonl(join(root, "plan/backlog.jsonl"), [{ id: "B4", title: "Old Canvas work", state: "superseded" }]);
    writeFileSync(join(root, "plan/canvas.md"), `# Canvas roadmap

### CT-1. Truth baseline

- **User-visible outcome:** inspect the exact runtime graph and
  preserve its source revision.
- **Acceptance/measures:** exact topology and revision coordinates agree.
- **Exit criteria:** retained evidence proves the exact graph.
- **Non-goals:** causal occurrence claims.

<!-- graphrefly-work-v1
{"id":"CT-1","owner":"graphrefly-canvas","kind":"roadmap-outcome","status":"proposed","governing_refs":["graphrefly:D787"],"prerequisites":[],"supersedes":["graphrefly:B4"]}
-->

### CT-2. Causal navigation

- **Outcome/journey:** navigate exact causal evidence.
- **Exit:** aggregate evidence passes.
- **Non-goals:** Canvas-owned causal identity.

<!-- graphrefly-work-v1
{"id":"CT-2","owner":"graphrefly-canvas","kind":"roadmap-outcome","status":"planned","governing_refs":["graphrefly:D787"],"prerequisites":[{"work_ref":"graphrefly-canvas:CT-1"},{"work_ref":"graphrefly:CSP-14","artifact_ref":"root:causal","schema":"root/causal/v1","revision":"csp14-v1"}],"consumes":[{"artifact_ref":"root:causal","schema":"root/causal/v1","revision":"csp14-v1"}]}
-->
`);
    const decisionIndex = new Map([
      ["graphrefly:D787", { ledger: { authority_class: "durable-root" }, record: { decision_kind: "durable-architecture" } }],
    ]);
    const work = loadWorkFederation(root, { decisionIndex });
    assert.deepEqual(work.errors, []);
    assert.equal(work.metrics.strict_records, 2);
    assert.ok(!work.warnings.some((warning) => warning.includes("prose-only roadmap items")));
    assert.equal(work.records.find((record) => record.qualified_id === "graphrefly-canvas:CT-1")?.outcome, "inspect the exact runtime graph and preserve its source revision.");
    assert.deepEqual(work.records.find((record) => record.qualified_id === "graphrefly-canvas:CT-1")?.acceptance, [
      "exact topology and revision coordinates agree.",
      "retained evidence proves the exact graph.",
    ]);
    assert.ok(work.dependencyEdges.some((edge) => edge.from === "graphrefly-canvas:CT-2" && edge.to === "graphrefly:CSP-14"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
