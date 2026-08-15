#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAuthorityViews, loadFormalArtifacts, loadJsonl } from "./model.mjs";
import { loadFederation } from "./federation.mjs";
import { loadWorkFederation } from "./work-federation.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = process.argv.includes("--workspace");
const federation = loadFederation(root, { includeExternal: workspace });
const work = loadWorkFederation(root, { includeExternal: workspace, decisionIndex: federation.qualifiedIndex });
const views = buildAuthorityViews({
  decisions: federation.decisionRecords,
  rules: loadJsonl(join(root, "spec", "rules.jsonl")),
  conformance: loadJsonl(join(root, "spec", "conformance.jsonl")),
  formalArtifacts: loadFormalArtifacts(join(root, "formal")),
  federation: federation.ledgers,
  knownExternalDecisionIds: federation.relocations.map((relocation) => relocation.id),
});
console.log("=== GraphReFly authority gate ===");
console.log("metrics:", views.metrics);
console.log("federation:", {
  qualifiedDecisions: federation.qualifiedIds.length,
  referenceEdges: federation.referenceEdges.length,
  supersessionCycles: federation.supersessionCycles.length,
  relocations: federation.relocations.length,
  unverifiedRelocations: federation.unverifiedRelocations.length,
  currentProductComplete: federation.currentProduct.complete,
  currentProductRecords: federation.currentProduct.current_qualified_ids.length,
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
for (const error of federation.errors) views.errors.push(error);
for (const error of work.errors) views.errors.push(error);
views.gateOk = views.errors.length === 0;
if (federation.warnings.length) console.warn(`federation warnings (${federation.warnings.length}):\n  ${federation.warnings.join("\n  ")}`);
if (work.warnings.length) console.warn(`work federation warnings (${work.warnings.length}):\n  ${work.warnings.join("\n  ")}`);
if (views.warnings.length) console.warn(`warnings (${views.warnings.length}):\n  ${views.warnings.join("\n  ")}`);
if (views.errors.length) console.error(`errors (${views.errors.length}):\n  ${views.errors.join("\n  ")}`);
if (!views.gateOk) process.exit(1);
