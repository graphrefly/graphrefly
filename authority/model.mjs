import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DECISION_ID = /^(?:D\d+|DR-\d+)$/;
const LEGACY_DECISION_ID = /^R\d+$/;
const RULE_ID = /^R-[a-z0-9-]+$/;
const CONFORMANCE_ID = /^C-\d+[a-z]?$/;

export function loadJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${path}:${index + 1} invalid JSON: ${error.message}`);
      }
    });
}

export function loadFormalArtifacts(formalDir) {
  if (!existsSync(formalDir)) return [];
  return readdirSync(formalDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:tla|cfg)$/.test(entry.name))
    .map((entry) => ({
      path: `formal/${entry.name}`,
      source: readFileSync(join(formalDir, entry.name), "utf8"),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function splitRefs(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function indexUnique(records, label, coordinateFor, errors) {
  const index = new Map();
  for (const [position, record] of records.entries()) {
    const coordinate = coordinateFor(record);
    if (!coordinate) {
      errors.push(`${label}:${position + 1} has no stable coordinate`);
      continue;
    }
    if (index.has(coordinate)) errors.push(`${label} duplicates ${coordinate}`);
    else index.set(coordinate, record);
  }
  return index;
}

function findCycles(nodes, outgoing) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const cycles = [];
  function visit(id) {
    if (visiting.has(id)) {
      const start = stack.indexOf(id);
      cycles.push([...stack.slice(start), id]);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    stack.push(id);
    for (const target of outgoing.get(id) ?? []) if (nodes.has(target)) visit(target);
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of nodes.keys()) visit(id);
  return cycles;
}

function ruleRevision(record) {
  return Number.isInteger(record.revision) && record.revision > 0 ? record.revision : "legacy-v0";
}

function ruleCoordinate(record) {
  return record.id ? `${record.id}@${ruleRevision(record)}` : "";
}

function ruleDecisionRefs(record) {
  if (Array.isArray(record.introduced_by) || Array.isArray(record.activated_by)) {
    return [...new Set([...(record.introduced_by ?? []), ...(record.activated_by ?? [])])];
  }
  return splitRefs(record.since);
}

function isActivatedTerminal(record) {
  if (ruleRevision(record) === "legacy-v0") return record.status === "active";
  return Array.isArray(record.activated_by) && record.activated_by.length > 0 && record.transition == null;
}

// The protocol's parts, derived from a rule's area: module, graph and principle each name a part,
// and every other area is the kernel. A rule may cite rules of its own rank or below: kernel and
// principle rules come first, then the graph layer, then modules.
export const RULE_PARTS = ["kernel", "graph", "module", "principle"];
const PART_RANK = { kernel: 0, principle: 0, graph: 1, module: 2 };
const RULE_REFERENCE = /(?<![A-Za-z0-9-])R-[a-z0-9]+(?:-[a-z0-9]+)*(?![A-Za-z0-9-])/g;

export function rulePart(area) {
  return area === "module" || area === "graph" || area === "principle" ? area : "kernel";
}

function transitionTarget(record) {
  const target = record.transition?.to;
  return target ? `${target.id}@${target.revision}` : null;
}

// The concerns a decision still governs, given the decisions that supersede it. A partial
// supersession takes over only the concerns its successor lists, so the rest stay with the
// predecessor (D783: a partial supersession is not inferred to be whole). A full supersession, or a
// successor that does not say it is partial, as every record before admission metadata, leaves none.
// So does a `superseded_by` field on the record itself, which only old records carry: the
// federation reads it as whole, and the two resolvers agree (QA 2026-11-19).
//
// Two limits, both left to the reader of the records. Inside one concern nothing is partial: a
// predecessor whose every concern its partial successors list is historical, even where the
// successor says some of its choices stand, and those choices are then read through the successor's
// `supersedes` edge. And a partial successor that lists none of its predecessor's concerns takes
// nothing; partialSuccessorsTakingNothing lists such pairs so that this is seen.
export function partialSuccessorsTakingNothing(record, superseders) {
  const concerns = new Set(Array.isArray(record.concerns) ? record.concerns : []);
  if (concerns.size === 0) return [];
  return superseders
    .filter((superseder) => superseder.change_kind === "partial-supersession" && !(superseder.concerns ?? []).some((concern) => concerns.has(concern)))
    .map((superseder) => superseder.id);
}

export function concernsStillGoverned(record, superseders) {
  const concerns = Array.isArray(record.concerns) ? record.concerns : [];
  if (record.superseded_by !== undefined && record.superseded_by !== null) return [];
  if (superseders.length === 0) return concerns;
  if (superseders.some((superseder) => superseder.change_kind !== "partial-supersession")) return [];
  const taken = new Set(superseders.flatMap((superseder) => superseder.concerns ?? []));
  return concerns.filter((concern) => !taken.has(concern));
}

function deriveDecisionGraph(decisions, decisionById, errors, knownExternalDecisionIds = new Set()) {
  const incoming = new Map([...decisionById.keys()].map((id) => [id, []]));
  const outgoing = new Map([...decisionById.keys()].map((id) => [id, []]));
  const legacyExternalRefs = [];
  const relocatedExternalRefs = [];
  for (const decision of decisions) {
    for (const target of decision.supersedes ?? []) {
      if (decisionById.has(target)) {
        outgoing.get(decision.id).push(target);
        incoming.get(target).push(decision.id);
      } else if (knownExternalDecisionIds.has(target)) {
        relocatedExternalRefs.push({ from: decision.id, to: target });
      } else if (LEGACY_DECISION_ID.test(target)) legacyExternalRefs.push({ from: decision.id, to: target });
      else errors.push(`decision ${decision.id} supersedes unresolved ${target}`);
    }
  }
  const cycles = findCycles(decisionById, outgoing);
  for (const cycle of cycles) errors.push(`decision supersession cycle: ${cycle.join(" -> ")}`);
  const isProductConstitutionRecord = (decision) => {
    const ledgerClass = decision.__authority?.authority_class;
    return ledgerClass !== "evaluation-execution" && ledgerClass !== "implementation-receipt";
  };
  const governed = new Map();
  const partiallySuperseded = [];
  const takingNothing = [];
  for (const decision of decisions) {
    const superseders = (incoming.get(decision.id) ?? []).map((id) => decisionById.get(id));
    const concerns = concernsStillGoverned(decision, superseders);
    governed.set(decision.id, concerns);
    for (const by of partialSuccessorsTakingNothing(decision, superseders)) takingNothing.push({ by, of: decision.id });
    if (superseders.length > 0 && concerns.length > 0 && isProductConstitutionRecord(decision) && decision.status === "locked") {
      partiallySuperseded.push({ id: decision.id, by: superseders.map((superseder) => superseder.id), governs: concerns });
    }
  }
  const currentCandidates = decisions
    .filter((decision) => isProductConstitutionRecord(decision) && decision.status === "locked"
      && (governed.get(decision.id).length > 0
        || ((incoming.get(decision.id)?.length ?? 0) === 0 && (decision.superseded_by === undefined || decision.superseded_by === null))))
    .map((decision) => decision.id);
  const currentSet = new Set(currentCandidates);
  const concernGovernors = new Map();
  const unclassified = [];
  for (const decision of decisions) {
    const ledgerClass = decision.__authority?.authority_class;
    if (ledgerClass === "evaluation-execution" || ledgerClass === "implementation-receipt") continue;
    if (!currentSet.has(decision.id)) continue;
    const concerns = governed.get(decision.id);
    const owner = decision.__authority?.owner ?? decision.owner;
    const authorityClass = ledgerClass ?? decision.authority_class;
    if (concerns.length === 0 || !owner || !authorityClass) {
      unclassified.push(decision.id);
      continue;
    }
    for (const concern of concerns) {
      if (!concernGovernors.has(concern)) concernGovernors.set(concern, []);
      concernGovernors.get(concern).push(decision.id);
    }
  }
  const ambiguousCurrentGovernors = [...concernGovernors]
    .filter(([, ids]) => ids.length !== 1)
    .map(([concern, ids]) => ({ concern, decisions: ids }));
  return {
    edges: [...outgoing].flatMap(([from, targets]) => targets.map((to) => ({ from, to }))),
    reverse: Object.fromEntries([...incoming].filter(([, ids]) => ids.length)),
    cycles,
    legacyExternalRefs,
    relocatedExternalRefs,
    currentCandidates,
    partiallySuperseded,
    partialSuccessorsTakingNothing: takingNothing,
    concernGovernors: Object.fromEntries(concernGovernors),
    ambiguousCurrentGovernors,
    unclassified,
  };
}

function deriveFormalCoverage(formalArtifacts, revisionsById, errors) {
  const coverage = new Map([...revisionsById.keys()].map((id) => [id, []]));
  for (const artifact of formalArtifacts) {
    if (typeof artifact?.path !== "string" || typeof artifact?.source !== "string") {
      errors.push("formal artifact must declare string path and source");
      continue;
    }
    const referenced = new Set(artifact.source.match(RULE_REFERENCE) ?? []);
    for (const ruleId of referenced) {
      if (!revisionsById.has(ruleId)) {
        errors.push(`formal artifact ${artifact.path} references unresolved rule ${ruleId}`);
        continue;
      }
      coverage.get(ruleId).push(artifact.path);
    }
  }
  for (const artifacts of coverage.values()) artifacts.sort();
  return coverage;
}

function deriveProtocol({ rules, conformance, formalArtifacts, decisionById, errors, warnings }) {
  const conformanceById = indexUnique(conformance, "conformance", (record) => record.id, errors);
  const ruleByCoordinate = indexUnique(rules, "rule revision", ruleCoordinate, errors);
  const revisionsById = new Map();
  const derivedCoverage = new Map();
  for (const rule of rules) {
    if (!RULE_ID.test(rule.id ?? "")) errors.push(`rule has invalid id ${rule.id}`);
    if (ruleRevision(rule) === "legacy-v0") {
      errors.push(`rule ${rule.id} uses forbidden legacy-v0 lifecycle fields`);
    } else {
      if (!Array.isArray(rule.introduced_by) || rule.introduced_by.length === 0) {
        errors.push(`rule ${ruleCoordinate(rule)} must declare introduced_by`);
      }
      if (rule.activated_by != null && !Array.isArray(rule.activated_by)) {
        errors.push(`rule ${ruleCoordinate(rule)} activated_by must be an array`);
      }
      if (rule.transition != null) {
        if (!["revise", "replace", "retire"].includes(rule.transition.kind)) {
          errors.push(`rule ${ruleCoordinate(rule)} has invalid transition kind ${rule.transition.kind}`);
        }
        if (!DECISION_ID.test(rule.transition.by ?? "") || !decisionById.has(rule.transition.by)) {
          errors.push(`rule ${ruleCoordinate(rule)} transition references unresolved decision ${rule.transition.by}`);
        }
        if (rule.transition.kind === "retire" && rule.transition.to != null) {
          errors.push(`rule ${ruleCoordinate(rule)} retire transition must not declare a target`);
        }
        if (["revise", "replace"].includes(rule.transition.kind) && rule.transition.to == null) {
          errors.push(`rule ${ruleCoordinate(rule)} ${rule.transition.kind} transition must declare a target`);
        }
      }
    }
    if (!revisionsById.has(rule.id)) revisionsById.set(rule.id, []);
    revisionsById.get(rule.id).push(rule);
    derivedCoverage.set(rule.id, derivedCoverage.get(rule.id) ?? []);
    for (const decisionId of ruleDecisionRefs(rule)) {
      if (!decisionById.has(decisionId)) errors.push(`rule ${ruleCoordinate(rule)} references unresolved decision ${decisionId}`);
    }
    for (const field of ["status", "since", "covers_by"]) {
      if (Object.hasOwn(rule, field)) errors.push(`rule ${ruleCoordinate(rule)} carries forbidden legacy field ${field}`);
    }
  }
  for (const scenario of conformance) {
    if (!CONFORMANCE_ID.test(scenario.id ?? "")) errors.push(`conformance has invalid id ${scenario.id}`);
    for (const ruleId of scenario.covers ?? []) {
      if (!revisionsById.has(ruleId)) errors.push(`conformance ${scenario.id} covers unresolved rule ${ruleId}`);
      else derivedCoverage.get(ruleId).push(scenario.id);
    }
  }
  for (const ids of derivedCoverage.values()) ids.sort();
  const formalCoverage = deriveFormalCoverage(formalArtifacts, revisionsById, errors);
  const transitionEdges = [];
  const transitionOutgoing = new Map([...ruleByCoordinate.keys()].map((id) => [id, []]));
  for (const rule of rules) {
    const from = ruleCoordinate(rule);
    const to = transitionTarget(rule);
    if (!to) continue;
    transitionEdges.push({ from, to, kind: rule.transition.kind, by: rule.transition.by });
    transitionOutgoing.get(from).push(to);
    if (!ruleByCoordinate.has(to)) errors.push(`rule ${from} transitions to unresolved ${to}`);
  }
  const cycles = findCycles(ruleByCoordinate, transitionOutgoing);
  for (const cycle of cycles) errors.push(`rule revision cycle: ${cycle.join(" -> ")}`);
  const currentRules = [];
  const lifecycle = [];
  for (const [id, revisions] of revisionsById) {
    const terminals = revisions.filter(isActivatedTerminal);
    lifecycle.push({ id, revisions: revisions.map(ruleCoordinate), current: terminals.map(ruleCoordinate) });
    if (terminals.length > 1) {
      errors.push(`rule ${id} has ambiguous current revisions: ${terminals.map(ruleCoordinate).join(", ")}`);
      continue;
    }
    if (terminals.length === 0) continue;
    const rule = terminals[0];
    currentRules.push({
      id: rule.id,
      revision: ruleRevision(rule),
      coordinate: ruleCoordinate(rule),
      area: rule.area,
      part: rulePart(rule.area),
      tier: rule.tier,
      statement: rule.statement,
      rationale: rule.rationale,
      decisions: ruleDecisionRefs(rule),
      conformance: derivedCoverage.get(rule.id) ?? [],
      formal: formalCoverage.get(rule.id) ?? [],
      owner: "graphrefly",
      authority_class: "protocol-rule",
      source: "spec/rules.jsonl",
    });
  }
  const statements = new Map();
  for (const rule of currentRules) {
    const statement = String(rule.statement ?? "").trim();
    if (!statement) errors.push(`current rule ${rule.coordinate} has an empty statement`);
    if (!statements.has(statement)) statements.set(statement, []);
    statements.get(statement).push(rule.coordinate);
  }
  const exactDuplicateStatements = [...statements.values()].filter((ids) => ids.length > 1);
  for (const ids of exactDuplicateStatements) errors.push(`current rules duplicate exact statement: ${ids.join(", ")}`);
  const draftRuleRows = rules.filter((rule) => ruleRevision(rule) !== "legacy-v0" && rule.transition == null && !isActivatedTerminal(rule));
  const draftRules = draftRuleRows.map((rule) => ruleCoordinate(rule));

  const parts = Object.fromEntries(RULE_PARTS.map((part) => [part, currentRules.filter((rule) => rule.part === part).map((rule) => rule.coordinate)]));
  const currentPart = new Map(currentRules.map((rule) => [rule.id, rule.part]));
  const draftPart = new Map(draftRuleRows.map((rule) => [rule.id, rulePart(rule.area)]));
  const partOf = (ruleId) => currentPart.get(ruleId) ?? draftPart.get(ruleId);

  // A scenario's level is the highest part among the current and draft rules it covers, so the
  // kernel scenarios are a definite list. A scenario that covers no current rule is listed for
  // review; it is not an error, since a scenario may wait for a module's rule to be activated.
  const scenarioLevels = { kernel: [], graph: [], module: [], none: [] };
  const scenariosWithoutCurrentRule = [];
  for (const scenario of conformanceById.values()) {
    const covers = scenario.covers ?? [];
    const rank = Math.max(-1, ...covers.map((ruleId) => PART_RANK[partOf(ruleId)] ?? -1));
    scenarioLevels[["none", "kernel", "graph", "module"][rank + 1]].push(scenario.id);
    if (covers.some((ruleId) => currentPart.has(ruleId))) continue;
    scenariosWithoutCurrentRule.push({
      id: scenario.id,
      draft: covers.filter((ruleId) => draftPart.has(ruleId)),
      notCurrent: covers.filter((ruleId) => !draftPart.has(ruleId)),
    });
  }

  // Listed for review rather than refused: whether such a citation is an exception is a
  // maintainer's judgment.
  const upwardCitations = [];
  for (const rule of currentRules) {
    for (const cited of new Set(String(rule.statement ?? "").match(RULE_REFERENCE) ?? [])) {
      const citedPart = cited === rule.id ? undefined : partOf(cited);
      if (citedPart && PART_RANK[citedPart] > PART_RANK[rule.part]) upwardCitations.push({ from: rule.coordinate, part: rule.part, cites: cited, citedPart });
    }
  }

  return {
    schemaVersion: 1,
    projection: "fail-closed-current-terminal-activated-revisions",
    rules: currentRules,
    lifecycle,
    transitionEdges,
    cycles,
    exactDuplicateStatements,
    draftRules,
    parts,
    scenarioLevels,
    scenariosWithoutCurrentRule,
    upwardCitations,
    coverageByRule: Object.fromEntries(derivedCoverage),
    formalCoverageByRule: Object.fromEntries(formalCoverage),
    conformanceEvidence: [...conformanceById.values()].map((scenario) => ({
      id: scenario.id,
      covers: scenario.covers ?? [],
      evidenceState: "unverified-no-commit-bound-receipt-ledger",
      legacyDeclaredRuntimeStatus: scenario.runtimes ?? {},
    })),
  };
}

export function buildAuthorityViews(model) {
  const errors = [];
  const warnings = [];
  const decisions = model.decisions ?? [];
  const decisionById = indexUnique(decisions, "decision", (record) => record.id, errors);
  for (const decision of decisions) if (!DECISION_ID.test(decision.id ?? "")) errors.push(`decision has invalid id ${decision.id}`);
  const knownExternalDecisionIds = new Set(model.knownExternalDecisionIds ?? []);
  const supersessionGraph = deriveDecisionGraph(decisions, decisionById, errors, knownExternalDecisionIds);
  const currentProtocol = deriveProtocol({
    rules: model.rules ?? [],
    conformance: model.conformance ?? [],
    formalArtifacts: model.formalArtifacts ?? [],
    decisionById,
    errors,
    warnings,
  });
  const uncoveredCurrentRules = currentProtocol.rules.filter((rule) => rule.conformance.length === 0).map((rule) => rule.id);
  return {
    schemaVersion: 1,
    gateOk: errors.length === 0,
    errors,
    warnings,
    metrics: {
      unresolvedRefs: errors.filter((error) => error.includes("unresolved")).length,
      supersessionCycles: supersessionGraph.cycles.length,
      ruleRevisionCycles: currentProtocol.cycles.length,
      ambiguousCurrentGovernors: supersessionGraph.ambiguousCurrentGovernors.length,
      unclassifiedDecisions: supersessionGraph.unclassified.length,
      partiallySupersededDecisions: supersessionGraph.partiallySuperseded.length,
      partialSuccessorsTakingNothing: supersessionGraph.partialSuccessorsTakingNothing.length,
      currentProtocolRules: currentProtocol.rules.length,
      draftProtocolRules: currentProtocol.draftRules.length,
      scenariosWithoutCurrentRule: currentProtocol.scenariosWithoutCurrentRule.length,
      upwardRuleCitations: currentProtocol.upwardCitations.length,
      exactDuplicateCurrentRuleStatements: currentProtocol.exactDuplicateStatements.length,
      activeUncoveredRules: uncoveredCurrentRules.length,
      formalCoveragePending: currentProtocol.rules.filter((rule) => rule.formal.length === 0).length,
    },
    currentProductConstitution: {
      state: supersessionGraph.unclassified.length === 0 ? "derived" : "derived-current-set-with-unclassified-concerns",
      current: supersessionGraph.currentCandidates,
      governors: supersessionGraph.concernGovernors,
      partiallySuperseded: supersessionGraph.partiallySuperseded,
      partialSuccessorsTakingNothing: supersessionGraph.partialSuccessorsTakingNothing,
      ambiguous: supersessionGraph.ambiguousCurrentGovernors,
    },
    currentProtocol,
    authorityOwnership: model.federation ?? {
      root: {
        protocolRules: currentProtocol.rules.map((rule) => rule.id),
        decisionsAwaitingClassification: supersessionGraph.unclassified,
      },
    },
    supersessionGraph,
    unresolvedConflicts: [
      ...supersessionGraph.ambiguousCurrentGovernors.map((item) => ({ kind: "ambiguous-current-governor", ...item })),
      ...(supersessionGraph.unclassified.length ? [{ kind: "legacy-decisions-await-owner-class-concern", count: supersessionGraph.unclassified.length }] : []),
      ...(currentProtocol.draftRules.length ? [{ kind: "draft-rule-activation-review", count: currentProtocol.draftRules.length, rules: currentProtocol.draftRules }] : []),
    ],
    uncoveredCurrentRules,
  };
}
