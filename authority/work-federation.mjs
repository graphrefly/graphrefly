import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { loadJsonl, splitRefs } from "./model.mjs";

const WORK_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const QUALIFIED_WORK_REF = /^[a-z0-9][a-z0-9-]*:[A-Za-z0-9][A-Za-z0-9._-]*$/;
const DECISION_REF = /^(?:[a-z0-9][a-z0-9-]*:)?(?:D\d+|DR-\d+|R\d+)$/;
const OWNER_ID = /^[a-z0-9][a-z0-9-]*$/;
const SHA256 = /^[a-f0-9]{64}$/;
const LIFECYCLE = new Set(["proposed", "planned", "in-progress", "complete", "superseded", "deferred", "cancelled"]);
const WORK_KINDS = new Set(["roadmap-outcome", "program-phase", "backlog-item", "implementation-slice", "integration-milestone"]);
const WORK_CLASSES = new Set(["roadmap", "program-phase", "backlog-item", "implementation-slice", "integration-milestone", "cursor", "completion-trace"]);
const ADAPTERS = new Set(["work-jsonl-v1", "phase-jsonl-v0", "backlog-jsonl-v0", "prose-roadmap-v0", "canvas-roadmap-md-v1", "canvas-program-state-v1", "canvas-slices-jsonl-v2"]);
const GENERATED_FIELDS = [
  "__source",
  "aggregate_status",
  "authorized",
  "critical_path",
  "cursor",
  "dependents",
  "dispatch_approved",
  "execution_authorized",
  "implementation_authorized",
  "legacy",
  "lifecycle_status",
  "next_candidate",
  "origin",
  "prerequisite_specs",
  "qualified_id",
  "ready",
  "readiness",
  "readiness_reasons",
  "superseded_by",
  "supersededBy",
];

const PHASE_STATUS = new Map([
  ["design", "proposed"],
  ["gap", "proposed"],
  ["open", "proposed"],
  ["ready", "planned"],
  ["impl", "in-progress"],
  ["implementing", "in-progress"],
  ["qa", "in-progress"],
  ["qa-pending", "in-progress"],
  ["design-needed", "proposed"],
  ["eligible-after-current-candidate", "planned"],
  ["externally-blocked", "planned"],
  ["demand-blocked", "planned"],
  ["blocked", "planned"],
  ["done", "complete"],
  ["closed", "complete"],
  ["complete", "complete"],
  ["fulfilled", "complete"],
  ["resolved", "complete"],
  ["deferred", "deferred"],
  ["superseded", "superseded"],
  ["cancelled", "cancelled"],
]);

function refs(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value.filter(Boolean) : splitRefs(value);
}

function sha256(raw) {
  return createHash("sha256").update(raw).digest("hex");
}

function readJsonlRows(path) {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line, index) => {
      if (!line.trim()) return null;
      try {
        return { record: JSON.parse(line), raw: line, line: index + 1, sha256: sha256(line) };
      } catch (error) {
        throw new Error(`${path}:${index + 1} invalid JSON: ${error.message}`);
      }
    })
    .filter(Boolean);
}

function readCanvasRoadmapRows(path, errors, warnings) {
  const raw = readFileSync(path, "utf8");
  const visibleIds = [...raw.matchAll(/^(?:###\s+|- \*\*)(CT-\d+)(?:\.|\s)/gm)].map((match) => match[1]);
  const rows = [];
  const projectedIds = new Set();
  const marker = /<!--\s*graphrefly-work-v1\s*\n([\s\S]*?)\n-->/g;
  for (const match of raw.matchAll(marker)) {
    const markerStart = match.index ?? 0;
    const prefix = raw.slice(0, markerStart);
    const headings = [...prefix.matchAll(/^###\s+(CT-\d+)\.\s+(.+)$/gm)];
    const heading = headings.at(-1);
    const coordinate = `${path}:${prefix.split(/\r?\n/).length}`;
    if (!heading) {
      errors.push(`${coordinate} graphrefly-work-v1 marker has no CT-* heading`);
      continue;
    }
    const headingStart = heading.index ?? markerStart;
    const body = raw.slice(headingStart, markerStart);
    let metadata;
    try {
      metadata = JSON.parse(match[1]);
    } catch (error) {
      errors.push(`${coordinate} graphrefly-work-v1 metadata is invalid JSON: ${error.message}`);
      continue;
    }
    if (metadata.id !== heading[1]) errors.push(`${coordinate} metadata id ${String(metadata.id)} does not match heading ${heading[1]}`);
    const markdownFields = (labels) => {
      const alternatives = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
      return [...body.matchAll(new RegExp(`(?:^|\\n)- \\*\\*(?:${alternatives}):\\*\\*\\s+([\\s\\S]*?)(?=\\n- \\*\\*|\\n###|\\n<!--|$)`, "g"))]
        .map((field) => field[1].replace(/\s+/g, " ").trim())
        .filter(Boolean);
    };
    const outcome = markdownFields(["Outcome", "User-visible outcome", "Outcome/journey"])[0];
    const acceptance = markdownFields(["Acceptance", "Acceptance scenarios", "Acceptance/measures", "Measurable evidence", "Exit criteria", "Exit"]);
    const nonGoals = markdownFields(["Non-goals"]);
    const source = raw.slice(headingStart, markerStart + match[0].length);
    projectedIds.add(heading[1]);
    rows.push({
      record: {
        ...metadata,
        outcome,
        acceptance,
        evidence_refs: metadata.evidence_refs ?? [],
        produces: metadata.produces ?? [],
        consumes: metadata.consumes ?? [],
        supersedes: metadata.supersedes ?? [],
        non_goals: nonGoals,
      },
      raw: source,
      line: raw.slice(0, headingStart).split(/\r?\n/).length,
      sha256: sha256(source),
    });
  }
  const unstructured = [...new Set(visibleIds.filter((id) => !projectedIds.has(id)))];
  if (unstructured.length > 0) warnings.push(`${path} has prose-only roadmap items unavailable to the work graph: ${unstructured.join(", ")}`);
  return rows;
}

function qualifyLocal(ref, origin) {
  if (typeof ref !== "string" || ref.length === 0) return null;
  if (ref.includes(":")) return QUALIFIED_WORK_REF.test(ref) ? ref : null;
  return WORK_ID.test(ref) ? `${origin}:${ref}` : null;
}

export function qualifyWorkRef(ref, contextOrigin) {
  return qualifyLocal(ref, contextOrigin);
}

function lifecycle(status) {
  return PHASE_STATUS.get(status) ?? (LIFECYCLE.has(status) ? status : "unknown");
}

function sourceMeta(ledger, row) {
  return { path: ledger.path, line: row.line, sha256: row.sha256, adapter: ledger.adapter };
}

function legacyRecord(record, ledger, row, options = {}) {
  const id = record.id;
  const localDeps = refs(options.deps ?? record.deps).map((ref) => qualifyLocal(ref, ledger.origin)).filter(Boolean);
  const upstreamDeps = refs(options.upstreamRefs ?? record.upstream_refs)
    .filter((ref) => !DECISION_REF.test(ref))
    .map((ref) => (ref.includes(":") ? qualifyLocal(ref, ledger.origin) : qualifyLocal(ref, "graphrefly")))
    .filter(Boolean);
  return {
    id,
    qualified_id: `${ledger.origin}:${id}`,
    origin: ledger.origin,
    owner: ledger.owner,
    kind: options.kind ?? ledger.work_class,
    outcome: record.outcome ?? record.title ?? record.name ?? id,
    lifecycle_status: lifecycle(options.status ?? record.status ?? record.state),
    raw_status: options.status ?? record.status ?? record.state,
    priority: record.priority,
    governing_refs: refs(record.governing_refs ?? record.refs ?? record.ref ?? record.decisionRefs ?? record.locks),
    prerequisites: [...new Set([...localDeps, ...upstreamDeps])],
    acceptance: refs(record.acceptance ?? record.gate ?? record.completionCriteria),
    evidence_refs: refs(record.evidence_refs ?? record.evidenceRefs ?? record.closureEvidence),
    produces: refs(record.produces),
    consumes: refs(record.consumes),
    integration_owner: record.integration_owner,
    supersedes: refs(record.supersedes).map((ref) => qualifyLocal(ref, ledger.origin)).filter(Boolean),
    horizon: record.horizon,
    non_goals: refs(record.non_goals ?? record.excludedClaims),
    legacy_prerequisite_notes: refs(record.blockedBy),
    legacy_readiness_hint: ["externally-blocked", "demand-blocked"].includes(options.status ?? record.status ?? record.state)
      ? "waiting-on-prerequisite"
      : (options.status ?? record.status ?? record.state) === "blocked" ? "blocked" : undefined,
    legacy: true,
    __source: sourceMeta(ledger, row),
  };
}

function validateEvidenceRef(value, coordinate, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${coordinate} evidence_refs entries must be objects`);
    return;
  }
  if (typeof value.ref !== "string" || value.ref.length === 0) errors.push(`${coordinate} evidence ref must declare ref`);
  const immutableRevision = typeof value.revision === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value.revision);
  const immutableDigest = typeof value.digest === "string" && SHA256.test(value.digest.replace(/^sha256:/, ""));
  if (!immutableRevision && !immutableDigest) {
    errors.push(`${coordinate} evidence ref must bind a full commit revision or SHA-256 digest`);
  }
}

function validateArtifact(value, coordinate, errors, { requireRevision = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${coordinate} artifact entries must be objects`);
    return;
  }
  if (typeof value.artifact_ref !== "string" || value.artifact_ref.length === 0) errors.push(`${coordinate} artifact must declare artifact_ref`);
  if (typeof value.schema !== "string" || value.schema.length === 0) errors.push(`${coordinate} artifact must declare schema`);
  if (requireRevision && (typeof value.revision !== "string" || value.revision.length === 0)) errors.push(`${coordinate} artifact must declare revision`);
}

function strictRecord(record, ledger, row, errors) {
  const coordinate = `${ledger.path}:${row.line}`;
  const canonicalStatus = record.canonical_status ?? record.status;
  if (!WORK_ID.test(record.id ?? "")) errors.push(`${coordinate} has invalid work id ${String(record.id)}`);
  if (record.owner !== ledger.owner) errors.push(`${coordinate} owner ${String(record.owner)} does not match ledger owner ${ledger.owner}`);
  if (!WORK_KINDS.has(record.kind)) errors.push(`${coordinate} has invalid kind ${String(record.kind)}`);
  if (typeof record.outcome !== "string" || record.outcome.trim().length === 0) errors.push(`${coordinate} must declare outcome`);
  if (!LIFECYCLE.has(canonicalStatus)) errors.push(`${coordinate} has invalid canonical status ${String(canonicalStatus)}`);
  for (const field of GENERATED_FIELDS) if (Object.hasOwn(record, field)) errors.push(`${coordinate} cannot persist generated field ${field}`);
  if (!Array.isArray(record.governing_refs) || record.governing_refs.length === 0 || record.governing_refs.some((ref) => !/^[a-z0-9][a-z0-9-]*:(?:D\d+|DR-\d+)$/.test(ref))) {
    errors.push(`${coordinate} must declare non-empty origin-qualified governing_refs`);
  }
  if (!Array.isArray(record.prerequisites)) errors.push(`${coordinate} must declare prerequisites as an array`);
  if (!Array.isArray(record.acceptance) || record.acceptance.length === 0 || record.acceptance.some((item) => typeof item !== "string" || item.length === 0)) {
    errors.push(`${coordinate} must declare non-empty acceptance`);
  }
  const prerequisites = Array.isArray(record.prerequisites) ? record.prerequisites : [];
  for (const prerequisite of prerequisites) {
    if (!prerequisite || typeof prerequisite !== "object" || Array.isArray(prerequisite) || !QUALIFIED_WORK_REF.test(prerequisite.work_ref ?? "")) {
      errors.push(`${coordinate} prerequisite must declare an origin-qualified work_ref`);
      continue;
    }
    if (prerequisite.artifact_ref != null) validateArtifact(prerequisite, `${coordinate} prerequisite ${prerequisite.work_ref}`, errors, { requireRevision: true });
  }
  if (record.deps != null) {
    if (!Array.isArray(record.deps)) errors.push(`${coordinate} deps compatibility projection must be an array`);
    else {
      const projected = record.deps.map((ref) => qualifyLocal(ref, ledger.origin)).filter(Boolean).sort();
      const canonical = prerequisites.map((item) => item?.work_ref).filter(Boolean).sort();
      if (JSON.stringify(projected) !== JSON.stringify(canonical)) errors.push(`${coordinate} deps compatibility projection must match canonical prerequisites`);
    }
  }
  for (const field of ["evidence_refs", "produces", "consumes", "supersedes", "execution_approval_refs", "non_goals"]) {
    if (record[field] != null && !Array.isArray(record[field])) errors.push(`${coordinate} ${field} must be an array`);
  }
  const evidenceRefs = Array.isArray(record.evidence_refs) ? record.evidence_refs : [];
  if (canonicalStatus === "complete" && evidenceRefs.length === 0) errors.push(`${coordinate} complete work requires immutable evidence_refs`);
  for (const evidence of evidenceRefs) validateEvidenceRef(evidence, coordinate, errors);
  const produces = Array.isArray(record.produces) ? record.produces : [];
  const consumes = Array.isArray(record.consumes) ? record.consumes : [];
  for (const artifact of produces) validateArtifact(artifact, `${coordinate} produces`, errors, { requireRevision: canonicalStatus === "complete" });
  for (const artifact of consumes) validateArtifact(artifact, `${coordinate} consumes`, errors, { requireRevision: true });
  if (record.kind === "integration-milestone" && record.integration_owner !== ledger.owner) {
    errors.push(`${coordinate} integration milestone must name its ledger owner as integration_owner`);
  }
  if (record.integration_owner != null && record.integration_owner !== ledger.owner) {
    errors.push(`${coordinate} integration_owner cannot differ from the canonical work owner`);
  }
  for (const ref of refs(record.supersedes)) if (!QUALIFIED_WORK_REF.test(ref)) errors.push(`${coordinate} supersedes must use origin-qualified work refs`);
  for (const ref of refs(record.execution_approval_refs)) if (!/^[a-z0-9][a-z0-9-]*:D\d+$/.test(ref)) errors.push(`${coordinate} execution_approval_refs must use origin-qualified decision refs`);

  return {
    ...record,
    lifecycle_status: canonicalStatus,
    qualified_id: `${ledger.origin}:${record.id}`,
    origin: ledger.origin,
    governing_refs: Array.isArray(record.governing_refs) ? record.governing_refs : [],
    prerequisite_specs: prerequisites,
    prerequisites: prerequisites.map((item) => item.work_ref).filter(Boolean),
    evidence_refs: evidenceRefs,
    produces,
    consumes,
    supersedes: Array.isArray(record.supersedes) ? record.supersedes : [],
    execution_approval_refs: Array.isArray(record.execution_approval_refs) ? record.execution_approval_refs : [],
    non_goals: Array.isArray(record.non_goals) ? record.non_goals : [],
    legacy: false,
    __source: sourceMeta(ledger, row),
  };
}

function adaptRows(rows, ledger, errors, warnings, cursors) {
  if (ledger.adapter === "work-jsonl-v1") return rows.map((row) => strictRecord(row.record, ledger, row, errors));
  if (ledger.adapter === "canvas-roadmap-md-v1") return rows.map((row) => strictRecord(row.record, ledger, row, errors));
  if (ledger.adapter === "phase-jsonl-v0") return rows.map((row) => row.record.work_contract === "graphrefly-work-v1" ? strictRecord(row.record, ledger, row, errors) : legacyRecord(row.record, ledger, row, { kind: "program-phase" }));
  if (ledger.adapter === "backlog-jsonl-v0") return rows.map((row) => row.record.work_contract === "graphrefly-work-v1" ? strictRecord(row.record, ledger, row, errors) : legacyRecord(row.record, ledger, row, { kind: "backlog-item" }));
  if (ledger.adapter === "canvas-slices-jsonl-v2") {
    const latest = new Map();
    for (const row of rows) latest.set(row.record.id, row);
    const repeated = rows.length - latest.size;
    if (repeated > 0) warnings.push(`${ledger.path} has ${repeated} append-only legacy revisions without immutable row coordinates`);
    return [...latest.values()].map((row) => legacyRecord(row.record, ledger, row, { kind: "implementation-slice" }));
  }
  if (ledger.adapter === "canvas-program-state-v1") {
    const row = rows[0];
    const candidates = Array.isArray(row.record.candidateQueue) ? row.record.candidateQueue : [];
    const cursor = row.record.nextAction?.candidateId;
    if (typeof cursor === "string" && cursor.length > 0) cursors.push({ owner: ledger.owner, work_ref: qualifyLocal(cursor, ledger.origin), source: ledger.path });
    return candidates.map((candidate) => legacyRecord(candidate, ledger, row, { kind: "implementation-slice" }));
  }
  if (ledger.adapter === "prose-roadmap-v0") {
    warnings.push(`${ledger.path} is a registered prose roadmap with no machine-readable work projection`);
    return [];
  }
  errors.push(`work ledger ${ledger.path} has unknown adapter ${ledger.adapter}`);
  return [];
}

function graphCycles(records, relation) {
  const index = new Map(records.map((record) => [record.qualified_id, record]));
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const cycles = [];
  function visit(id) {
    if (visiting.has(id)) {
      cycles.push([...stack.slice(stack.indexOf(id)), id]);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    stack.push(id);
    for (const target of relation(index.get(id))) if (index.has(target)) visit(target);
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of index.keys()) visit(id);
  return cycles;
}

function artifactCoordinate(artifact) {
  return JSON.stringify([artifact.artifact_ref, artifact.schema, artifact.revision ?? "unversioned"]);
}

export function loadWorkFederation(root, { includeExternal = false, decisionIndex } = {}) {
  const manifest = loadJsonl(resolve(root, "authority/work-ledgers.jsonl"));
  const relocations = loadJsonl(resolve(root, "authority/work-relocations.jsonl"));
  const errors = [];
  const warnings = [];
  const ledgers = [];
  const records = [];
  const cursors = [];
  const manifestCoordinates = new Set();
  const manifestPaths = new Set();
  const currentOwnerByOrigin = new Map();
  const manifestOrigins = new Set(manifest.map((ledger) => ledger.origin));

  for (const ledger of manifest) {
    const coordinate = `${ledger.origin}/${ledger.owner}/${ledger.work_class}/${ledger.path}`;
    if (!ledger.origin || !ledger.owner || !ledger.work_class || !ledger.path || !ledger.adapter) {
      errors.push("work ledger manifest row is missing origin/owner/work_class/path/adapter");
      continue;
    }
    if (!OWNER_ID.test(ledger.origin) || !OWNER_ID.test(ledger.owner)) errors.push(`work ledger ${coordinate} has invalid origin or owner`);
    if (!WORK_CLASSES.has(ledger.work_class)) errors.push(`work ledger ${coordinate} has invalid work_class ${String(ledger.work_class)}`);
    if (!ADAPTERS.has(ledger.adapter)) errors.push(`work ledger ${coordinate} has invalid adapter ${String(ledger.adapter)}`);
    if (!["required", "workspace-optional"].includes(ledger.availability)) errors.push(`work ledger ${coordinate} has invalid availability ${String(ledger.availability)}`);
    if (!ledger.historical_only) {
      const priorOwner = currentOwnerByOrigin.get(ledger.origin);
      if (priorOwner && priorOwner !== ledger.owner) errors.push(`work origin ${ledger.origin} has multiple current owners: ${priorOwner} and ${ledger.owner}`);
      else currentOwnerByOrigin.set(ledger.origin, ledger.owner);
    }
    if (manifestCoordinates.has(coordinate)) errors.push(`work ledger manifest duplicates ${coordinate}`);
    manifestCoordinates.add(coordinate);
    if (isAbsolute(ledger.path)) {
      errors.push(`work ledger ${coordinate} cannot use an absolute path`);
      ledgers.push({ ...ledger, state: "invalid-path", records: 0 });
      continue;
    }
    const path = resolve(root, ledger.path);
    const relativePath = relative(root, path);
    const external = relativePath === ".." || relativePath.startsWith(`..${sep}`);
    if (external && !/^\.\.\/graphrefly-(?:ts|rs|py|canvas|stack)\//.test(ledger.path)) {
      errors.push(`work ledger ${coordinate} uses an unapproved external path`);
      ledgers.push({ ...ledger, state: "invalid-path", records: 0 });
      continue;
    }
    if (manifestPaths.has(path)) {
      errors.push(`work ledger canonical path is registered more than once: ${ledger.path}`);
      ledgers.push({ ...ledger, state: "duplicate-path", records: 0 });
      continue;
    }
    manifestPaths.add(path);
    if (external && !includeExternal) {
      ledgers.push({ ...ledger, state: "registered-external", records: 0 });
      continue;
    }
    if (!existsSync(path)) {
      const message = `work ledger ${ledger.origin}/${ledger.work_class} missing ${ledger.path}`;
      if (ledger.availability === "required") errors.push(message);
      else warnings.push(message);
      ledgers.push({ ...ledger, state: "unavailable", records: 0 });
      continue;
    }
    if (ledger.adapter === "prose-roadmap-v0") {
      ledgers.push({ ...ledger, state: "available-unstructured", records: 0 });
      adaptRows([], ledger, errors, warnings, cursors);
      continue;
    }
    let rows;
    if (ledger.adapter === "canvas-roadmap-md-v1") {
      rows = readCanvasRoadmapRows(path, errors, warnings);
    } else if (ledger.adapter === "canvas-program-state-v1") {
      const raw = readFileSync(path, "utf8");
      try {
        rows = [{ record: JSON.parse(raw), raw, line: 1, sha256: sha256(raw) }];
      } catch (error) {
        throw new Error(`${path}:1 invalid JSON: ${error.message}`);
      }
    } else {
      rows = readJsonlRows(path);
    }
    const adapted = adaptRows(rows, ledger, errors, warnings, cursors);
    records.push(...adapted);
    ledgers.push({ ...ledger, state: "available", records: adapted.length, source_records: rows.length });
  }

  const index = new Map();
  for (const record of records) {
    if (index.has(record.qualified_id)) errors.push(`qualified work identity duplicates ${record.qualified_id}`);
    else index.set(record.qualified_id, record);
  }

  const availableOrigins = new Set(ledgers.filter((ledger) => ledger.state === "available").map((ledger) => ledger.origin));
  const unavailableOrigins = new Set([...manifestOrigins].filter((origin) => !availableOrigins.has(origin)));
  const partialOrigins = new Set([...manifestOrigins].filter((origin) => {
    const states = ledgers.filter((ledger) => ledger.origin === origin).map((ledger) => ledger.state);
    return states.some((state) => state === "available") && states.some((state) => state !== "available");
  }));
  const dependencyEdges = [];
  for (const record of records) {
    for (const target of record.prerequisites ?? []) {
      dependencyEdges.push({ from: record.qualified_id, to: target, relation: "prerequisite" });
      if (index.has(target)) continue;
      const targetOrigin = target.slice(0, target.indexOf(":"));
      if (!manifestOrigins.has(targetOrigin)) errors.push(`${record.qualified_id} prerequisite references unregistered origin ${target}`);
      else if (unavailableOrigins.has(targetOrigin) || partialOrigins.has(targetOrigin)) warnings.push(`${record.qualified_id} prerequisite is unavailable in this checkout: ${target}`);
      else if (record.legacy) warnings.push(`${record.qualified_id} has unresolved legacy prerequisite ${target}`);
      else errors.push(`${record.qualified_id} prerequisite references missing work ${target}`);
    }
  }

  const dependencyCycles = graphCycles(records, (record) => record?.prerequisites ?? []);
  for (const cycle of dependencyCycles) errors.push(`federated work dependency cycle: ${cycle.join(" -> ")}`);
  const supersessionCycles = graphCycles(records, (record) => record?.supersedes ?? []);
  for (const cycle of supersessionCycles) errors.push(`federated work supersession cycle: ${cycle.join(" -> ")}`);

  const relocationKeys = new Set(relocations.map((relocation) => relocation.qualified_id));
  for (const record of records.filter((item) => !item.legacy)) {
    for (const target of record.supersedes ?? []) {
      if (index.has(target) || relocationKeys.has(target)) continue;
      const targetOrigin = target.slice(0, target.indexOf(":"));
      if (!manifestOrigins.has(targetOrigin)) errors.push(`${record.qualified_id} supersedes unregistered origin ${target}`);
      else if (unavailableOrigins.has(targetOrigin)) warnings.push(`${record.qualified_id} supersedes unavailable work ${target}`);
      else errors.push(`${record.qualified_id} supersedes missing work ${target}`);
    }
    if (decisionIndex) {
      for (const ref of refs(record.governing_refs)) {
        if (decisionIndex.has(ref)) continue;
        const refOrigin = ref.slice(0, ref.indexOf(":"));
        if (unavailableOrigins.has(refOrigin) || partialOrigins.has(refOrigin)) warnings.push(`${record.qualified_id} governing decision is unavailable in this checkout: ${ref}`);
        else errors.push(`${record.qualified_id} governing decision does not resolve: ${ref}`);
      }
      for (const ref of refs(record.execution_approval_refs)) {
        const approval = decisionIndex.get(ref);
        if (!approval) errors.push(`${record.qualified_id} execution approval does not resolve: ${ref}`);
        else if (approval.ledger.authority_class !== "evaluation-execution" || approval.record.decision_kind !== "execution-approval") {
          errors.push(`${record.qualified_id} execution approval ref is not an execution-approval: ${ref}`);
        }
      }
    }
    if (record.kind === "implementation-slice" && record.lifecycle_status === "in-progress" && refs(record.execution_approval_refs).length === 0) {
      errors.push(`${record.qualified_id} in-progress implementation requires an execution_approval_ref`);
    }
  }

  const strictCurrent = records.filter((record) => !record.legacy && !["complete", "superseded", "cancelled"].includes(record.lifecycle_status));
  const outcomes = new Map();
  for (const record of records.filter((item) => !["complete", "superseded", "cancelled"].includes(item.lifecycle_status))) {
    if (typeof record.outcome !== "string" || record.outcome.trim().length === 0) continue;
    const key = record.outcome.trim().toLowerCase().replace(/\s+/g, " ");
    const prior = outcomes.get(key);
    if (prior && prior.owner !== record.owner) warnings.push(`possible duplicate active outcome requires owner review: ${prior.qualified_id} and ${record.qualified_id}`);
    else outcomes.set(key, record);
  }

  const producers = new Map();
  for (const record of records) {
    for (const artifact of Array.isArray(record.produces) ? record.produces : []) {
      if (!artifact || typeof artifact !== "object") continue;
      const key = artifactCoordinate(artifact);
      const prior = producers.get(key);
      if (prior && prior.qualified_id !== record.qualified_id) errors.push(`artifact producer duplicates ${key}: ${prior.qualified_id} and ${record.qualified_id}`);
      else producers.set(key, record);
    }
  }
  for (const record of records.filter((item) => !item.legacy)) {
    for (const prerequisite of record.prerequisite_specs ?? []) {
      const targetOrigin = prerequisite.work_ref?.slice(0, prerequisite.work_ref.indexOf(":"));
      if (targetOrigin && targetOrigin !== record.origin && (!prerequisite.artifact_ref || !prerequisite.schema || !prerequisite.revision)) {
        errors.push(`${record.qualified_id} cross-repository prerequisite ${prerequisite.work_ref} requires artifact_ref, schema and revision`);
      }
      const producer = index.get(prerequisite.work_ref);
      if (!producer) continue;
      if (prerequisite.artifact_ref) {
        const coordinate = artifactCoordinate(prerequisite);
        const declared = (Array.isArray(producer.produces) ? producer.produces : []).some((artifact) => artifact && typeof artifact === "object" && artifactCoordinate(artifact) === coordinate);
        if (!declared) errors.push(`${record.qualified_id} prerequisite ${prerequisite.work_ref} does not produce required artifact ${coordinate}`);
      }
      if (["in-progress", "complete"].includes(record.lifecycle_status) && (producer.lifecycle_status !== "complete" || producer.evidence_refs.length === 0)) {
        errors.push(`${record.qualified_id} cannot be ${record.lifecycle_status} before prerequisite evidence is complete: ${prerequisite.work_ref}`);
      }
    }
    for (const artifact of Array.isArray(record.consumes) ? record.consumes : []) {
      const producer = producers.get(artifactCoordinate(artifact));
      if (!producer) {
        const artifactOrigin = typeof artifact.artifact_ref === "string" ? artifact.artifact_ref.slice(0, artifact.artifact_ref.indexOf(":")) : "";
        if (unavailableOrigins.has(artifactOrigin) || partialOrigins.has(artifactOrigin)) warnings.push(`${record.qualified_id} consumed artifact is unavailable in this checkout: ${artifactCoordinate(artifact)}`);
        else errors.push(`${record.qualified_id} consumes unresolved artifact ${artifactCoordinate(artifact)}`);
      }
      else if (!(record.prerequisites ?? []).includes(producer.qualified_id)) errors.push(`${record.qualified_id} consumes ${artifactCoordinate(artifact)} without a prerequisite on ${producer.qualified_id}`);
    }
  }

  for (const cursor of cursors) {
    if (!cursor.work_ref || !index.has(cursor.work_ref)) errors.push(`cursor ${cursor.source} references missing work ${String(cursor.work_ref)}`);
  }

  relocationKeys.clear();
  for (const relocation of relocations) {
    if (!QUALIFIED_WORK_REF.test(relocation.qualified_id ?? "")) errors.push(`work relocation has invalid qualified_id ${String(relocation.qualified_id)}`);
    if (relocationKeys.has(relocation.qualified_id)) errors.push(`work relocation duplicates ${relocation.qualified_id}`);
    relocationKeys.add(relocation.qualified_id);
    const relocationOrigin = String(relocation.qualified_id).split(":")[0];
    if (relocation.origin !== relocationOrigin) errors.push(`work relocation ${relocation.qualified_id} origin mismatch`);
    if (!relocation.relocated_from || !relocation.relocated_from_owner || !relocation.relocated_from_adapter || !relocation.migration_ref) {
      errors.push(`work relocation ${relocation.qualified_id} must declare relocated_from, relocated_from_owner, relocated_from_adapter and migration_ref`);
    }
    if (!SHA256.test(relocation.sha256 ?? "") || !SHA256.test(relocation.former_sha256 ?? "")) errors.push(`work relocation ${relocation.qualified_id} must declare canonical and former SHA-256 digests`);
    if (!/^[a-z0-9][a-z0-9-]*:D\d+$/.test(relocation.migration_ref ?? "")) errors.push(`work relocation ${relocation.qualified_id} migration_ref must be an origin-qualified decision`);
    if (decisionIndex && relocation.migration_ref && !decisionIndex.has(relocation.migration_ref)) errors.push(`work relocation ${relocation.qualified_id} migration_ref does not resolve`);
    const target = index.get(relocation.qualified_id);
    if (!target) {
      const origin = String(relocation.qualified_id).split(":")[0];
      if (unavailableOrigins.has(origin)) warnings.push(`work relocation target unavailable: ${relocation.qualified_id}`);
      else errors.push(`work relocation target missing: ${relocation.qualified_id}`);
      continue;
    }
    if (target.owner !== relocation.owner || target.__source.path !== relocation.canonical_path) errors.push(`work relocation ${relocation.qualified_id} ownership/path mismatch`);
    if (target.__source.sha256 !== relocation.sha256) errors.push(`work relocation ${relocation.qualified_id} integrity mismatch`);
    const formerPath = relocation.relocated_from ? resolve(root, relocation.relocated_from) : null;
    if (formerPath && formerPath !== resolve(root, target.__source.path) && existsSync(formerPath) && relocation.relocated_from_adapter?.includes("jsonl")) {
      const duplicate = readJsonlRows(formerPath).some((row) => row.record.id === target.id);
      if (duplicate) errors.push(`work relocation ${relocation.qualified_id} still has a canonical-body duplicate in ${relocation.relocated_from}`);
    } else if (formerPath && existsSync(formerPath) && !relocation.relocated_from_adapter?.includes("jsonl")) {
      errors.push(`work relocation ${relocation.qualified_id} uses unsupported former adapter ${String(relocation.relocated_from_adapter)}`);
    }
  }

  const inbound = new Set(dependencyEdges.map((edge) => edge.to));
  const cursorRefs = new Set(cursors.map((cursor) => cursor.work_ref));
  const orphans = strictCurrent
    .filter((record) => ["implementation-slice", "integration-milestone"].includes(record.kind))
    .filter((record) => record.prerequisites.length === 0 && !inbound.has(record.qualified_id) && !cursorRefs.has(record.qualified_id))
    .map((record) => record.qualified_id)
    .sort();
  for (const orphan of orphans) errors.push(`strict active work is orphaned from prerequisites, dependents and cursor: ${orphan}`);
  const unknownLegacyStatuses = [...new Set(records.filter((record) => record.legacy && record.lifecycle_status === "unknown").map((record) => String(record.raw_status)))];
  if (unknownLegacyStatuses.length > 0) warnings.push(`legacy work statuses remain unmapped: ${unknownLegacyStatuses.join(", ")}`);
  const legacyCompleteWithoutEvidence = records.filter((record) => record.legacy && record.lifecycle_status === "complete" && record.evidence_refs.length === 0).length;
  const dependentsById = new Map();
  for (const edge of dependencyEdges) {
    const dependents = dependentsById.get(edge.to) ?? [];
    dependents.push(edge.from);
    dependentsById.set(edge.to, dependents);
  }
  const derivedRecords = records.map((record) => {
    const reasons = [];
    for (const prerequisite of record.prerequisites ?? []) {
      const producer = index.get(prerequisite);
      if (!producer) {
        const origin = prerequisite.slice(0, prerequisite.indexOf(":"));
        reasons.push({ prerequisite, state: unavailableOrigins.has(origin) || partialOrigins.has(origin) ? "unavailable" : "missing" });
      } else if (producer.lifecycle_status !== "complete") {
        reasons.push({ prerequisite, state: producer.lifecycle_status === "superseded" || producer.lifecycle_status === "cancelled" ? "invalid-terminal" : "waiting" });
      } else if (producer.evidence_refs.length === 0) {
        reasons.push({ prerequisite, state: "missing-evidence" });
      }
    }
    let readiness;
    if (["complete", "superseded", "cancelled"].includes(record.lifecycle_status)) readiness = "terminal";
    else if (record.lifecycle_status === "in-progress") readiness = "in-progress";
    else if (record.lifecycle_status === "deferred") readiness = "deferred";
    else if (record.lifecycle_status === "proposed") readiness = "proposed";
    else if (reasons.some((reason) => reason.state === "unavailable")) readiness = "unavailable";
    else if (reasons.length > 0) readiness = "waiting-on-prerequisite";
    else readiness = "ready-but-not-authorized";
    return {
      work_ref: record.qualified_id,
      owner: record.owner,
      kind: record.kind,
      lifecycle_status: record.lifecycle_status,
      readiness,
      readiness_reasons: reasons,
      dependents: [...new Set(dependentsById.get(record.qualified_id) ?? [])].sort(),
      cursor: cursorRefs.has(record.qualified_id),
      latest_verified_revision: record.lifecycle_status === "complete" ? (record.evidence_refs[0]?.revision ?? record.evidence_refs[0]?.digest ?? "missing") : null,
    };
  });
  const derivedById = new Map(derivedRecords.map((record) => [record.work_ref, record]));
  const owners = [...new Set(records.map((record) => record.owner))].sort();
  const ownerNextCandidates = owners.map((owner) => {
    const cursor = cursors.find((item) => item.owner === owner);
    if (cursor) return { owner, work_ref: cursor.work_ref, selection_basis: "owner-cursor", execution_authority: false };
    const candidates = records
      .filter((record) => record.owner === owner && !record.legacy && !["complete", "superseded", "cancelled", "deferred"].includes(record.lifecycle_status))
      .sort((left, right) => {
        const rank = { "in-progress": 0, "ready-but-not-authorized": 1, proposed: 2, "waiting-on-prerequisite": 3, unavailable: 4 };
        return (rank[derivedById.get(left.qualified_id)?.readiness] ?? 9) - (rank[derivedById.get(right.qualified_id)?.readiness] ?? 9)
          || left.prerequisites.length - right.prerequisites.length
          || (left.priority ?? Number.MAX_SAFE_INTEGER) - (right.priority ?? Number.MAX_SAFE_INTEGER)
          || left.qualified_id.localeCompare(right.qualified_id);
      });
    return { owner, work_ref: candidates[0]?.qualified_id ?? null, selection_basis: candidates.length > 0 ? "generated-priority-candidate" : "none", execution_authority: false };
  });
  const activeDependentMap = new Map();
  for (const record of records.filter((item) => !["complete", "superseded", "cancelled"].includes(item.lifecycle_status))) {
    for (const prerequisite of record.prerequisites ?? []) {
      const values = activeDependentMap.get(prerequisite) ?? [];
      values.push(record.qualified_id);
      activeDependentMap.set(prerequisite, values);
    }
  }
  const longestCursorPath = (start, seen = new Set()) => {
    if (!start || seen.has(start)) return [];
    const nextSeen = new Set(seen).add(start);
    const branches = (activeDependentMap.get(start) ?? []).map((dependent) => longestCursorPath(dependent, nextSeen));
    branches.sort((left, right) => right.length - left.length || String(left[0] ?? "").localeCompare(String(right[0] ?? "")));
    return [start, ...(branches[0] ?? [])];
  };
  const criticalPath = cursors.length === 1 ? longestCursorPath(cursors[0].work_ref) : [];
  const generated = {
    authority: "read-only-generated-view-not-execution-authority",
    derived_records: derivedRecords,
    owner_next_candidates: ownerNextCandidates,
    critical_path: criticalPath,
    critical_path_basis: cursors.length === 1 ? "single-owner-cursor-longest-dependent-chain" : "unavailable-without-one-global-anchor",
    ready_but_not_authorized: derivedRecords.filter((record) => !index.get(record.work_ref)?.legacy && record.readiness === "ready-but-not-authorized").map((record) => record.work_ref),
    waiting_on_prerequisite: derivedRecords.filter((record) => !index.get(record.work_ref)?.legacy && record.readiness === "waiting-on-prerequisite").map((record) => record.work_ref),
    unavailable: derivedRecords.filter((record) => !index.get(record.work_ref)?.legacy && record.readiness === "unavailable").map((record) => record.work_ref),
    genuinely_blocked: [],
    integration_milestones: records.filter((record) => record.kind === "integration-milestone").map((record) => record.qualified_id),
    stale_or_missing_evidence: derivedRecords.filter((record) => !index.get(record.work_ref)?.legacy && (record.latest_verified_revision === "missing" || record.readiness_reasons.some((reason) => reason.state === "missing-evidence"))).map((record) => record.work_ref),
    completed_or_superseded_history: records.filter((record) => ["complete", "superseded", "cancelled"].includes(record.lifecycle_status)).map((record) => record.qualified_id),
    orphan_work: orphans,
    duplicate_ownership: warnings.filter((warning) => warning.startsWith("possible duplicate active outcome")),
    latest_verified_revision_by_work: Object.fromEntries(derivedRecords.filter((record) => record.latest_verified_revision && record.latest_verified_revision !== "missing").map((record) => [record.work_ref, record.latest_verified_revision])),
  };

  return {
    contract: "graphrefly-work-v1",
    authority: "read-only-generated-view-not-execution-authority",
    manifest,
    relocations,
    ledgers,
    records,
    cursors,
    dependencyEdges,
    dependencyCycles,
    supersessionCycles,
    orphans,
    generated,
    errors,
    warnings: [...new Set(warnings)],
    qualifiedIds: [...index.keys()].sort(),
    metrics: {
      records: records.length,
      strict_records: records.filter((record) => !record.legacy).length,
      legacy_records: records.filter((record) => record.legacy).length,
      legacy_complete_without_evidence: legacyCompleteWithoutEvidence,
      unavailable_ledgers: ledgers.filter((ledger) => ledger.state === "unavailable").length,
      unstructured_ledgers: ledgers.filter((ledger) => ledger.state === "available-unstructured").length,
    },
  };
}
