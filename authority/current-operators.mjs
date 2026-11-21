#!/usr/bin/env node
// Prints the operator contracts of graphrefly:D813 by family. Everything here is derived by operators.mjs.
//
//   node authority/current-operators.mjs              active contracts, by family
//   node authority/current-operators.mjs time         one family (or several)
//   node authority/current-operators.mjs --drafts     also the draft contracts
//   node authority/current-operators.mjs --traces     each linked trace's steps and expectation
//   node authority/current-operators.mjs --review     the review lists: missing traces, open questions
//   node authority/current-operators.mjs --json       the same data as JSON
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAuthorityViews, loadFormalArtifacts, loadJsonl } from "./model.mjs";
import { loadFederation } from "./federation.mjs";
import { buildOperatorViews, loadOperatorLedgers } from "./operators.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function operatorViews(rootDir = root) {
  const federation = loadFederation(rootDir, { includeExternal: false });
  const rules = loadJsonl(join(rootDir, "spec", "rules.jsonl"));
  const { currentProtocol } = buildAuthorityViews({
    decisions: federation.decisionRecords,
    rules,
    conformance: loadJsonl(join(rootDir, "spec", "conformance.jsonl")),
    formalArtifacts: loadFormalArtifacts(join(rootDir, "formal")),
    federation: federation.ledgers,
    knownExternalDecisionIds: federation.relocations.map((relocation) => relocation.id),
  });
  return buildOperatorViews({
    ...loadOperatorLedgers(rootDir),
    rules,
    currentRuleIds: currentProtocol.rules.map((rule) => rule.id),
    draftRuleIds: currentProtocol.draftRules.map((coordinate) => coordinate.split("@")[0]),
    decisionIds: federation.decisionRecords.map((record) => record.id),
    operatorDecisionIds: federation.decisionRecords.filter((record) => (record.concerns ?? []).some((concern) => String(concern).startsWith("operators."))).map((record) => record.id),
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((arg) => arg.startsWith("--")));
  const wanted = args.filter((arg) => !arg.startsWith("--"));
  const views = operatorViews();
  const unknown = [...wanted.filter((family) => !views.families.includes(family)), ...[...flags].filter((flag) => !["--drafts", "--traces", "--review", "--json"].includes(flag))];
  if (unknown.length) {
    console.error(`unknown argument ${unknown.join(", ")}; families are ${views.families.join(", ")}; flags are --drafts, --traces, --review, --json`);
    process.exit(2);
  }
  const shown = wanted.length ? views.families.filter((family) => wanted.includes(family)) : views.families;
  const rows = [...views.active, ...(flags.has("--drafts") ? views.drafts : [])];
  const traceById = new Map(views.traces.map((trace) => [trace.id, trace]));
  if (flags.has("--json")) {
    console.log(JSON.stringify({ families: shown.map((family) => ({ family, contracts: rows.filter((row) => row.family === family) })), review: views.review, errors: views.errors }, null, 2));
  } else if (flags.has("--review")) {
    for (const [name, items] of Object.entries(views.review)) {
      console.log(`# ${name} (${items.length})\n`);
      for (const item of items) console.log(typeof item === "string" ? `  ${item}` : `  ${item.contract}: ${item.question}`);
      console.log("");
    }
  } else {
    const printTrace = (id) => {
      const trace = traceById.get(id);
      console.log(`    ${id} (${trace.detail}): ${trace.name}`);
      if (!flags.has("--traces")) return;
      console.log(`      nodes: ${trace.nodes.map((node) => (node.op ? `${node.id} = ${node.op}(${node.deps.join(", ")})${node.args ? ` ${JSON.stringify(node.args)}` : ""}` : `${node.id} = state${node.state.length ? `(${JSON.stringify(node.state[0])})` : ""}`)).join("; ")}`);
      trace.steps.forEach((step, i) => console.log(`      ${JSON.stringify(step)} -> ${JSON.stringify(trace.expect[i])}`));
    };
    for (const family of shown) {
      const contracts = rows.filter((row) => row.family === family);
      console.log(`# ${family}: ${contracts.filter((row) => row.lifecycle === "active").length} active${flags.has("--drafts") ? `, ${contracts.filter((row) => row.lifecycle === "draft").length} draft` : ""}\n`);
      for (const row of contracts) {
        console.log(`## ${row.lifecycle === "draft" ? "DRAFT, not in force: " : ""}${row.coordinate}${row.operator ? ` ${row.operator}` : ""} (cites ${row.cites.join(", ") || "nothing"})\n`);
        console.log(`${row.use}\n`);
        row.traces.forEach(printTrace);
        for (const item of row.exceptions) {
          console.log(`  ${item.topic}: ${item.statement}`);
          if (item.traces.length) item.traces.forEach(printTrace); else console.log("    no canonical trace yet");
        }
        for (const question of row.open) console.log(`  OPEN: ${question}`);
        console.log("");
      }
    }
  }
  if (views.errors.length) {
    console.error(`errors (${views.errors.length}):\n  ${views.errors.join("\n  ")}`);
    process.exit(1);
  }
}
