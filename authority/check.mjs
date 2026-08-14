#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAuthorityViews, loadFormalArtifacts, loadJsonl } from "./model.mjs";
import { loadFederation } from "./federation.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const federation = loadFederation(root, { includeExternal: process.argv.includes("--workspace") });
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
for (const error of federation.errors) views.errors.push(error);
views.gateOk = views.errors.length === 0;
if (federation.warnings.length) console.warn(`federation warnings (${federation.warnings.length}):\n  ${federation.warnings.join("\n  ")}`);
if (views.warnings.length) console.warn(`warnings (${views.warnings.length}):\n  ${views.warnings.join("\n  ")}`);
if (views.errors.length) console.error(`errors (${views.errors.length}):\n  ${views.errors.join("\n  ")}`);
if (!views.gateOk) process.exit(1);
