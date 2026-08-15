import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadWorkFederation } from "./work-federation.mjs";
import { loadFederation } from "./federation.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspace = process.argv.includes("--workspace");
const decisions = loadFederation(root, { includeExternal: workspace });
const work = loadWorkFederation(root, { includeExternal: workspace, decisionIndex: decisions.qualifiedIndex });

console.log(JSON.stringify({
  contract: work.contract,
  authority: work.authority,
  ledgers: work.ledgers,
  metrics: work.metrics,
  dependencyEdges: work.dependencyEdges.length,
  dependencyCycles: work.dependencyCycles,
  supersessionCycles: work.supersessionCycles,
  orphans: work.orphans,
  generated: {
    authority: work.generated.authority,
    critical_path: work.generated.critical_path,
    critical_path_basis: work.generated.critical_path_basis,
    owner_next_candidates: work.generated.owner_next_candidates,
    ready_but_not_authorized: work.generated.ready_but_not_authorized,
    waiting_on_prerequisite: work.generated.waiting_on_prerequisite,
    genuinely_blocked: work.generated.genuinely_blocked,
    integration_milestones: work.generated.integration_milestones,
    stale_or_missing_evidence: work.generated.stale_or_missing_evidence,
  },
  warnings: work.warnings,
  errors: work.errors,
}, null, 2));

if (work.errors.length > 0) process.exit(1);
