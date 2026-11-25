#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAuthorityViews, loadFormalArtifacts, loadJsonl } from "./model.mjs";
import { loadFederation, resolverDisagreements } from "./federation.mjs";
import { loadWorkFederation } from "./work-federation.mjs";
import { buildOperatorViews, loadOperatorLedgers } from "./operators.mjs";
import { checkImmutable } from "./immutable.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = process.argv.includes("--workspace");
// --baseline <dir>: hold what is immutable against that directory, not against main as git has it.
const baselineAt = process.argv.indexOf("--baseline");
const baselineDir = baselineAt >= 0 ? process.argv[baselineAt + 1] : undefined;
if (baselineAt >= 0 && !baselineDir) throw new Error("--baseline needs a directory");
const federation = loadFederation(root, { includeExternal: workspace });
const work = loadWorkFederation(root, { includeExternal: workspace, decisionIndex: federation.qualifiedIndex });
const ruleRows = loadJsonl(join(root, "spec", "rules.jsonl"));
const views = buildAuthorityViews({
  decisions: federation.decisionRecords,
  rules: ruleRows,
  conformance: loadJsonl(join(root, "spec", "conformance.jsonl")),
  formalArtifacts: loadFormalArtifacts(join(root, "formal")),
  federation: federation.ledgers,
  knownExternalDecisionIds: federation.relocations.map((relocation) => relocation.id),
  externalSuperseders: federation.externalSuperseders,
});
console.log("=== GraphReFly authority gate ===");
console.log("metrics:", views.metrics);
console.log("protocol parts:", {
  currentRules: Object.fromEntries(Object.entries(views.currentProtocol.parts).map(([part, ids]) => [part, ids.length])),
  scenarioLevels: Object.fromEntries(Object.entries(views.currentProtocol.scenarioLevels).map(([level, ids]) => [level, ids.length])),
  // Both lists are for review and never fail the gate; `node authority/current-rules.mjs` prints the detail.
  scenariosWithoutCurrentRule: views.currentProtocol.scenariosWithoutCurrentRule.map((item) => item.id),
  upwardRuleCitations: views.currentProtocol.upwardCitations.map((item) => `${item.from} cites ${item.cites}`),
});
console.log("federation:", {
  qualifiedDecisions: federation.qualifiedIds.length,
  referenceEdges: federation.referenceEdges.length,
  supersessionCycles: federation.supersessionCycles.length,
  relocations: federation.relocations.length,
  unverifiedRelocations: federation.unverifiedRelocations.length,
  currentProductComplete: federation.currentProduct.complete,
  currentProductRecords: federation.currentProduct.current_qualified_ids.length,
  partiallySuperseded: federation.currentProduct.partially_superseded.map((item) => item.id),
  // For review, never a gate failure: a partial successor that lists none of its predecessor's concerns.
  partialSuccessorsTakingNothing: federation.currentProduct.partial_successors_taking_nothing.map((item) => `${item.by} of ${item.of}`),
});
console.log("ledgers:", federation.ledgers);
console.log("work federation:", {
  contract: work.contract,
  authority: work.authority,
  metrics: work.metrics,
  dependencyEdges: work.dependencyEdges.length,
  dependencyCycles: work.dependencyCycles.length,
  supersessionCycles: work.supersessionCycles.length,
  orphans: work.orphans.length,
});
// The operator contracts of graphrefly:D813 are outside the protocol projection; the gate only holds their links.
const operators = buildOperatorViews({
  ...loadOperatorLedgers(root),
  rules: ruleRows,
  currentRuleIds: views.currentProtocol.rules.map((rule) => rule.id),
  draftRuleIds: views.currentProtocol.draftRules.map((coordinate) => coordinate.split("@")[0]),
  decisionIds: federation.decisionRecords.map((record) => record.id),
  operatorDecisionIds: federation.decisionRecords.filter((record) => (record.concerns ?? []).some((concern) => String(concern).startsWith("operators."))).map((record) => record.id),
});
console.log("operator contracts:", {
  ...operators.metrics,
  // For review, never a gate failure; `node authority/current-operators.mjs --review` prints the detail.
  draftExceptionsWithoutTrace: operators.review.draftExceptionsWithoutTrace.length,
  openQuestions: operators.review.openQuestions.length,
  draftsCitingDraftRules: operators.review.draftsCitingDraftRules,
  unlinkedTraces: operators.review.unlinkedTraces,
});
for (const error of operators.errors) views.errors.push(error);
// What graphrefly:D815 and graphrefly:D816 make immutable on main, against main as git has it.
const immutable = checkImmutable(root, { baselineDir });
console.log("immutable content:", { comparedWith: immutable.compared, changed: immutable.errors.length });
if (!immutable.compared.length) views.warnings.push("immutable content was not compared: this checkout has no git, or neither origin/main nor main");
for (const error of immutable.errors) views.errors.push(error);
for (const error of federation.errors) views.errors.push(error);
for (const id of resolverDisagreements(federation, views.currentProductConstitution.current)) views.errors.push(`${id} is current in one resolver and not in the other`);
for (const error of work.errors) views.errors.push(error);
views.gateOk = views.errors.length === 0;
if (federation.warnings.length) console.warn(`federation warnings (${federation.warnings.length}):\n  ${federation.warnings.join("\n  ")}`);
if (work.warnings.length) console.warn(`work federation warnings (${work.warnings.length}):\n  ${work.warnings.join("\n  ")}`);
if (views.warnings.length) console.warn(`warnings (${views.warnings.length}):\n  ${views.warnings.join("\n  ")}`);
if (views.errors.length) console.error(`errors (${views.errors.length}):\n  ${views.errors.join("\n  ")}`);
if (!views.gateOk) process.exit(1);
