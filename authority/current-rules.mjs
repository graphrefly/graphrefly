#!/usr/bin/env node
// Prints the current protocol by part, so a reader does not have to pick the 19 current rules
// out of the full revision history in spec/rules.jsonl. Everything here is derived by model.mjs.
//
//   node authority/current-rules.mjs                 every part
//   node authority/current-rules.mjs kernel          one part: kernel, graph, module or principle
//   node authority/current-rules.mjs --drafts        also the open draft rules of the parts shown
//   node authority/current-rules.mjs --scenarios     scenario ids by level instead of rule text
//   node authority/current-rules.mjs --json          the same data as JSON
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RULE_PARTS, buildAuthorityViews, loadFormalArtifacts, loadJsonl, rulePart } from "./model.mjs";
import { loadFederation } from "./federation.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const wanted = args.filter((arg) => !arg.startsWith("--"));
const unknown = [...wanted.filter((part) => !RULE_PARTS.includes(part)), ...[...flags].filter((flag) => !["--drafts", "--scenarios", "--json"].includes(flag))];
if (unknown.length) {
  console.error(`unknown argument ${unknown.join(", ")}; parts are ${RULE_PARTS.join(", ")}; flags are --drafts, --scenarios, --json`);
  process.exit(2);
}
const shown = wanted.length ? RULE_PARTS.filter((part) => wanted.includes(part)) : RULE_PARTS;

const federation = loadFederation(root, { includeExternal: false });
const ruleRows = loadJsonl(join(root, "spec", "rules.jsonl"));
const { currentProtocol } = buildAuthorityViews({
  decisions: federation.decisionRecords,
  rules: ruleRows,
  conformance: loadJsonl(join(root, "spec", "conformance.jsonl")),
  formalArtifacts: loadFormalArtifacts(join(root, "formal")),
  federation: federation.ledgers,
  knownExternalDecisionIds: federation.relocations.map((relocation) => relocation.id),
});
const drafts = ruleRows
  .filter((row) => currentProtocol.draftRules.includes(`${row.id}@${row.revision}`))
  .map((row) => ({ id: row.id, revision: row.revision, coordinate: `${row.id}@${row.revision}`, area: row.area, part: rulePart(row.area), statement: row.statement, decisions: row.introduced_by ?? [] }));

if (flags.has("--scenarios")) {
  // A principle has no level of its own: a scenario that covers one counts with the kernel.
  const levels = wanted.length ? shown.filter((part) => part !== "principle") : ["kernel", "graph", "module", "none"];
  const data = {
    levels: Object.fromEntries(levels.map((level) => [level, currentProtocol.scenarioLevels[level]])),
    withoutCurrentRule: wanted.length ? [] : currentProtocol.scenariosWithoutCurrentRule,
  };
  if (flags.has("--json")) console.log(JSON.stringify(data, null, 2));
  else {
    for (const [level, ids] of Object.entries(data.levels)) console.log(`${level} (${ids.length}): ${ids.join(" ")}`);
    if (!wanted.length) console.log(`\nscenarios that cover no current rule (${data.withoutCurrentRule.length}):`);
    for (const item of data.withoutCurrentRule) {
      const why = [item.draft.length ? `draft ${item.draft.join(", ")}` : "", item.notCurrent.length ? `replaced or retired ${item.notCurrent.join(", ")}` : ""].filter(Boolean).join("; ");
      console.log(`  ${item.id}: ${why || "covers nothing"}`);
    }
  }
  process.exit(0);
}

const sections = shown.map((part) => ({
  part,
  current: currentProtocol.rules.filter((rule) => rule.part === part),
  drafts: flags.has("--drafts") ? drafts.filter((rule) => rule.part === part) : [],
}));
if (flags.has("--json")) {
  console.log(JSON.stringify({ sections, upwardCitations: currentProtocol.upwardCitations.filter((item) => shown.includes(item.part)) }, null, 2));
  process.exit(0);
}
for (const { part, current, drafts: open } of sections) {
  console.log(`# ${part}: ${current.length} current rule${current.length === 1 ? "" : "s"}${flags.has("--drafts") ? `, ${open.length} open draft${open.length === 1 ? "" : "s"}` : ""}\n`);
  for (const rule of current) {
    console.log(`## ${rule.coordinate} (area ${rule.area}; decisions ${rule.decisions.join(", ")}; scenarios ${rule.conformance.join(", ") || "none"}; models ${rule.formal.length})\n`);
    console.log(`${rule.statement}\n`);
  }
  for (const rule of open) {
    console.log(`## DRAFT, not in force: ${rule.coordinate} (area ${rule.area}; introduced by ${rule.decisions.join(", ")})\n`);
    console.log(`${rule.statement}\n`);
  }
}
const upward = currentProtocol.upwardCitations.filter((item) => shown.includes(item.part));
if (upward.length) {
  console.log("# citations of a higher part\n");
  for (const item of upward) console.log(`${item.from} (${item.part}) cites ${item.cites} (${item.citedPart})`);
}
