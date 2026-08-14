import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadJsonl } from "./model.mjs";

const DECISION_ID = /^(?:D\d+|DR-\d+)$/;
const LEGACY_EXTERNAL_ID = /^R\d+$/;
const DECISION_KINDS = new Set(["durable-product", "durable-architecture", "protocol-decision", "execution-approval", "evaluation-method", "implementation-receipt"]);
const CHANGE_KINDS = new Set(["new", "clarification", "extension", "partial-supersession", "full-supersession"]);
const PROTOCOL_IMPACTS = new Set(["none", "editorial", "semantic"]);
const EXECUTION_KINDS = new Set(["execution-approval", "evaluation-method", "implementation-receipt"]);

export function qualifyDecisionRef(ref, contextOrigin, { upstream = false } = {}) {
  if (typeof ref !== "string" || ref.length === 0) return null;
  if (ref.includes(":")) return ref;
  if (!DECISION_ID.test(ref)) return null;
  return `${upstream ? "graphrefly" : contextOrigin}:${ref}`;
}

export function resolveDecisionRef(index, ref, contextOrigin, options = {}) {
  const qualified = qualifyDecisionRef(ref, contextOrigin, options);
  return qualified ? index.get(qualified) : undefined;
}

function refs(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function findSupersessionCycles(keys, edges) {
  const nodes = [...keys];
  const outgoing = new Map(nodes.map((key) => [key, []]));
  for (const edge of edges) if (edge.relation === "supersedes" && outgoing.has(edge.to)) outgoing.get(edge.from)?.push(edge.to);
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const cycles = [];
  function visit(key) {
    if (visiting.has(key)) {
      cycles.push([...stack.slice(stack.indexOf(key)), key]);
      return;
    }
    if (visited.has(key)) return;
    visiting.add(key);
    stack.push(key);
    for (const target of outgoing.get(key) ?? []) visit(target);
    stack.pop();
    visiting.delete(key);
    visited.add(key);
  }
  for (const key of nodes) visit(key);
  return cycles;
}

function readRowsWithIntegrity(path) {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      let record;
      try {
        record = JSON.parse(line);
      } catch (error) {
        throw new Error(`${path}:${index + 1} invalid JSON: ${error.message}`);
      }
      return {
        record,
        sha256: createHash("sha256").update(line).digest("hex"),
        line: index + 1,
      };
    });
}

function validateAdmittedRecord(record, ledger, coordinate, errors) {
  const concerns = Array.isArray(record.concerns) ? record.concerns : [];
  if (concerns.length === 0 || concerns.some((concern) => typeof concern !== "string" || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(concern))) {
    errors.push(`${coordinate} must declare non-empty stable concerns`);
  }
  if (!DECISION_KINDS.has(record.decision_kind)) errors.push(`${coordinate} has invalid decision_kind ${String(record.decision_kind)}`);
  if (!CHANGE_KINDS.has(record.change_kind)) errors.push(`${coordinate} has invalid change_kind ${String(record.change_kind)}`);
  if (!PROTOCOL_IMPACTS.has(record.protocol_impact)) errors.push(`${coordinate} has invalid protocol_impact ${String(record.protocol_impact)}`);
  if (typeof record.completion?.complete_when !== "string" || typeof record.completion?.historical_when !== "string") {
    errors.push(`${coordinate} must declare completion.complete_when and completion.historical_when`);
  }
  const supersedes = refs(record.supersedes);
  if (["partial-supersession", "full-supersession"].includes(record.change_kind) && supersedes.length === 0) {
    errors.push(`${coordinate} ${record.change_kind} must declare supersedes`);
  }
  if (["new", "clarification", "extension"].includes(record.change_kind) && supersedes.length > 0) {
    errors.push(`${coordinate} ${record.change_kind} cannot declare supersedes`);
  }
  if (ledger.authority_class === "evaluation-execution" && !EXECUTION_KINDS.has(record.decision_kind)) {
    errors.push(`${coordinate} durable decision_kind cannot enter evaluation-execution`);
  }
  if (ledger.authority_class !== "evaluation-execution" && EXECUTION_KINDS.has(record.decision_kind)) {
    errors.push(`${coordinate} ${record.decision_kind} must use an evaluation/execution ledger`);
  }
  if (record.protocol_impact === "semantic") {
    if (ledger.owner !== "graphrefly" || record.decision_kind !== "protocol-decision") {
      errors.push(`${coordinate} semantic protocol impact must be a root protocol-decision`);
    }
    if (typeof record.spec_amend !== "string" || record.spec_amend.length === 0) errors.push(`${coordinate} semantic protocol impact requires spec_amend`);
    if (!Array.isArray(record.conformance_obligations) || record.conformance_obligations.length === 0) errors.push(`${coordinate} semantic protocol impact requires conformance_obligations`);
    if (!Array.isArray(record.formal_obligations) || record.formal_obligations.length === 0) errors.push(`${coordinate} semantic protocol impact requires formal_obligations`);
  }
  if (ledger.owner !== "graphrefly" && record.protocol_impact !== "none") {
    errors.push(`${coordinate} owner-local records cannot claim protocol impact`);
  }
}

export function loadFederation(root, { includeExternal = false } = {}) {
  const manifestPath = resolve(root, "authority/ledgers.jsonl");
  const relocationPath = resolve(root, "authority/relocations.jsonl");
  const manifest = loadJsonl(manifestPath);
  const relocations = loadJsonl(relocationPath);
  const errors = [];
  const warnings = [];
  const available = [];
  const decisionRecords = [];
  const qualified = new Map();
  const manifestCoordinates = new Set();
  const manifestOrigins = new Set(manifest.map((ledger) => ledger.origin));
  const relocationKeys = new Set();
  for (const relocation of relocations) {
    if (relocationKeys.has(relocation.qualified_id)) errors.push(`relocation registry duplicates ${relocation.qualified_id}`);
    relocationKeys.add(relocation.qualified_id);
  }

  for (const ledger of manifest) {
    const manifestCoordinate = `${ledger.origin}/${ledger.owner}/${ledger.authority_class}`;
    if (!ledger.origin || !ledger.owner || !ledger.authority_class || !ledger.path) {
      errors.push(`decision ledger manifest row is missing origin/owner/authority_class/path`);
      continue;
    }
    if (manifestCoordinates.has(manifestCoordinate)) errors.push(`decision ledger manifest duplicates ${manifestCoordinate}`);
    manifestCoordinates.add(manifestCoordinate);
    const external = ledger.path.startsWith("../");
    const path = resolve(root, ledger.path);
    if (external && !includeExternal) {
      available.push({ ...ledger, state: "registered-external" });
      continue;
    }
    if (!existsSync(path)) {
      const message = `decision ledger ${ledger.origin}/${ledger.authority_class} missing ${ledger.path}`;
      if (ledger.availability === "required") errors.push(message);
      else warnings.push(message);
      available.push({ ...ledger, state: "unavailable", records: 0 });
      continue;
    }
    const rows = readRowsWithIntegrity(path);
    available.push({ ...ledger, state: "available", records: rows.length });
    for (const row of rows) {
      if (!DECISION_ID.test(row.record.id ?? "")) errors.push(`${ledger.path}:${row.line} has invalid decision id ${row.record.id}`);
      const key = `${ledger.origin}:${row.record.id}`;
      if (ledger.historical_only && !relocationKeys.has(key)) errors.push(`${ledger.path}:${row.line} historical ledger record ${key} has no relocation locator`);
      const numericId = /^D(\d+)$/.exec(row.record.id ?? "");
      if (Number.isInteger(ledger.admission_after) && numericId && Number(numericId[1]) > ledger.admission_after) {
        validateAdmittedRecord(row.record, ledger, `${ledger.path}:${row.line} ${key}`, errors);
      }
      if (qualified.has(key)) errors.push(`qualified decision identity duplicates ${key}`);
      else qualified.set(key, { ledger, path, ...row });
      if (ledger.include_in_root_dashboard) {
        decisionRecords.push({
          ...row.record,
          __authority: {
            origin: ledger.origin,
            owner: ledger.owner,
            authority_class: ledger.authority_class,
            path: ledger.path,
            qualified_id: key,
          },
        });
      }
    }
  }

  const referenceEdges = [];
  for (const [from, source] of qualified) {
    const relationGroups = [
      ["supersedes", refs(source.record.supersedes), false],
      ["superseded_by", refs(source.record.superseded_by), false],
      ["upstream_refs", refs(source.record.upstream_refs), true],
    ];
    for (const [relation, values, upstream] of relationGroups) {
      for (const ref of values) {
        if (typeof ref === "string" && LEGACY_EXTERNAL_ID.test(ref)) {
          referenceEdges.push({ from, to: `legacy-external:${ref}`, relation, source_ref: ref });
          continue;
        }
        const to = qualifyDecisionRef(ref, source.ledger.origin, { upstream });
        if (!to) {
          errors.push(`${from} ${relation} has invalid decision reference ${String(ref)}`);
          continue;
        }
        referenceEdges.push({ from, to, relation, source_ref: ref });
        if (qualified.has(to) || relocationKeys.has(to)) continue;
        const targetOrigin = to.slice(0, to.indexOf(":"));
        if (!manifestOrigins.has(targetOrigin)) errors.push(`${from} ${relation} references unregistered origin ${to}`);
        else if (includeExternal || targetOrigin === source.ledger.origin || targetOrigin === "graphrefly") {
          errors.push(`${from} ${relation} references unresolved decision ${to}`);
        }
      }
    }
  }
  const supersessionCycles = findSupersessionCycles(qualified.keys(), referenceEdges);
  for (const cycle of supersessionCycles) errors.push(`federated decision supersession cycle: ${cycle.join(" -> ")}`);

  const unverifiedRelocations = [];
  for (const relocation of relocations) {
    const key = relocation.qualified_id;
    const target = qualified.get(key);
    if (!target) {
      const registeredTarget = manifest.find((ledger) => ledger.origin === relocation.origin && ledger.path === relocation.canonical_path);
      if (registeredTarget?.path.startsWith("../") && !includeExternal) {
        unverifiedRelocations.push(key);
        continue;
      }
      errors.push(`relocation ${key} does not resolve to an available canonical record`);
      continue;
    }
    if (target.ledger.path !== relocation.canonical_path) {
      errors.push(`relocation ${key} path mismatch: ${relocation.canonical_path} != ${target.ledger.path}`);
    }
    if (relocation.id !== target.record.id || relocation.origin !== target.ledger.origin || relocation.owner !== target.ledger.owner || relocation.authority_class !== target.ledger.authority_class) {
      errors.push(`relocation ${key} identity/ownership metadata mismatch`);
    }
    if (target.sha256 !== relocation.sha256) errors.push(`relocation ${key} integrity mismatch`);
    const formerPath = relocation.relocated_from ? resolve(root, relocation.relocated_from) : null;
    if (formerPath && formerPath !== target.path && existsSync(formerPath)) {
      const duplicate = readRowsWithIntegrity(formerPath).some((row) => row.record.id === relocation.id);
      if (duplicate) errors.push(`relocation ${key} still has a canonical-body duplicate in ${relocation.relocated_from}`);
    }
  }

  const superseded = new Set();
  for (const edge of referenceEdges) {
    if (edge.relation === "supersedes") superseded.add(edge.to);
    if (edge.relation === "superseded_by") superseded.add(edge.from);
  }
  const productEntries = [...qualified].filter(([, source]) => !["evaluation-execution", "implementation-receipt"].includes(source.ledger.authority_class));
  const currentProductIds = productEntries
    .filter(([key, source]) => source.record.status === "locked" && !superseded.has(key))
    .map(([key]) => key)
    .sort();
  const currentByOwner = {};
  for (const key of currentProductIds) {
    const owner = qualified.get(key).ledger.owner;
    (currentByOwner[owner] ??= []).push(key);
  }
  const historicalProductIds = productEntries
    .filter(([key, source]) => source.record.status !== "locked" || superseded.has(key))
    .map(([key]) => key)
    .sort();
  const ownerDecisionRecords = [...qualified]
    .filter(([, source]) => !source.ledger.include_in_root_dashboard)
    .map(([key, source]) => ({
      ...source.record,
      id: key,
      bare_id: source.record.id,
      __authority: {
        origin: source.ledger.origin,
        owner: source.ledger.owner,
        authority_class: source.ledger.authority_class,
        path: source.ledger.path,
        qualified_id: key,
      },
    }));

  return {
    manifest,
    relocations,
    ledgers: available,
    decisionRecords,
    errors,
    warnings,
    qualifiedIds: [...qualified.keys()].sort(),
    referenceEdges,
    supersessionCycles,
    unverifiedRelocations,
    qualifiedIndex: qualified,
    currentProduct: {
      complete: unverifiedRelocations.length === 0,
      current_qualified_ids: currentProductIds,
      current_by_owner: currentByOwner,
      historical_qualified_ids: historicalProductIds,
    },
    ownerDecisionRecords,
  };
}
