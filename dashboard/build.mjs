#!/usr/bin/env node
// GraphReFly internal dashboard generator.
// jsonl (single source of truth) -> data model -> consistency check -> dashboard.html
// UI is a PLACEHOLDER shell; styling/interaction is a separate /frontend-design pass.
// Run: node dashboard/build.mjs        (writes dashboard/dashboard.html)
//      node dashboard/build.mjs --check (report only; non-zero exit on broken links)

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

function loadJsonl(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l, i) => {
      try {
        return JSON.parse(l);
      } catch (e) {
        throw new Error(`${rel}:${i + 1} invalid JSON: ${e.message}`);
      }
    });
}

const model = {
  decisions: loadJsonl("decisions/decisions.jsonl"),
  phases: loadJsonl("plan/phases.jsonl"),
  backlog: loadJsonl("plan/backlog.jsonl"),
  antipatterns: loadJsonl("plan/antipatterns.jsonl"),
  rules: loadJsonl("spec/rules.jsonl"),
  conformance: loadJsonl("spec/conformance.jsonl"),
  flowcharts: loadJsonl("spec/flowcharts.jsonl"),
  sessions: loadJsonl("sessions/sessions.jsonl"),
  guide: loadJsonl("guide/guide.jsonl"),
};

// ---- consistency checks (fixes P4 stale-premise + P6 link-rot) ----
const decIds = new Set(model.decisions.map((d) => d.id));
const sessIds = new Set(model.sessions.map((s) => s.id));
const ruleIds = new Set(model.rules.map((r) => r.id));
const broken = [];
const orphans = [];

for (const s of model.sessions)
  for (const d of s.locks ?? [])
    if (!decIds.has(d)) broken.push(`session ${s.id} locks missing decision ${d}`);
for (const p of model.phases)
  for (const ds of p.sessions ?? [])
    if (!sessIds.has(ds)) broken.push(`phase ${p.id} refs missing session ${ds}`);
const legacyRefs = [];
for (const d of model.decisions)
  for (const sup of d.supersedes ?? []) {
    if (decIds.has(sup)) continue;
    // 3-digit D### (e.g. D080/D196/D206/D221) are legacy decisions from the old
    // main-branch log that clean-slate supersedes — external refs, not broken links.
    if (/^D\d{3}$/.test(sup) || /^R\d+$/.test(sup)) legacyRefs.push(`${d.id} supersedes legacy ${sup}`);
    else broken.push(`decision ${d.id} supersedes unknown ${sup}`);
  }
for (const c of model.conformance)
  for (const r of c.covers ?? [])
    if (!ruleIds.has(r)) broken.push(`conformance ${c.id} covers missing rule ${r}`);
for (const fc of model.flowcharts)
  for (const e of fc.explains ?? [])
    if (!ruleIds.has(e) && !decIds.has(e)) broken.push(`flowchart ${fc.id} explains unknown ${e}`);

const referencedDecisions = new Set([
  ...model.sessions.flatMap((s) => s.locks ?? []),
]);
for (const d of model.decisions)
  if (!referencedDecisions.has(d.id)) orphans.push(`decision ${d.id} referenced by no session`);

// ---- gaps ----
const gaps = {
  designPhases: model.phases.filter((p) => p.gap || p.status === "design").map((p) => p.id),
  openDecisions: model.decisions.filter((d) => d.status === "open").map((d) => d.id),
  deferredBacklog: model.backlog.filter((b) => b.state === "deferred").map((b) => b.id),
  uncoveredRules: model.rules
    .filter((r) => !(r.covers_by?.length) && !model.conformance.some((c) => c.covers?.includes(r.id)))
    .map((r) => r.id),
  todoConformance: model.conformance
    .filter((c) => Object.values(c.runtimes ?? {}).some((v) => v === "todo"))
    .map((c) => c.id),
};

// ---- report ----
const counts = Object.fromEntries(Object.entries(model).map(([k, v]) => [k, v.length]));
console.log("=== GraphReFly dashboard build ===");
console.log("counts:", counts);
console.log("gaps:", Object.fromEntries(Object.entries(gaps).map(([k, v]) => [k, v.length])));
if (broken.length) console.error("BROKEN LINKS:\n  " + broken.join("\n  "));
if (orphans.length) console.warn("orphans:\n  " + orphans.join("\n  "));
if (legacyRefs.length) console.log("legacy external refs (ok):\n  " + legacyRefs.join("\n  "));

if (checkOnly) {
  if (broken.length) process.exit(1);
  process.exit(0);
}

// ---- emit shell: data payload + link to dashboard.css / dashboard.js ----
// build.mjs owns the DATA; dashboard.css + dashboard.js own the PRESENTATION
// (authored via /frontend-design). The shell only embeds the payload + links them.
const payload = {
  builtAt: new Date().toISOString(),
  counts,
  gaps,
  broken,
  orphans,
  legacyRefs,
  gateOk: broken.length === 0,
  model,
};
// Semantic skeleton: header / gauges / nav / main(view sections) / footer are all
// real elements in the HTML; dashboard.js fills (progressively enhances) the named
// containers rather than wiping one #app blob. Tab panels exist pre-JS.
// Cache-bust stamp — appended to css/js URLs so a rebuild always defeats a
// stale browser cache (the "new HTML + old cached JS" failure class).
const stamp = Date.now().toString(36);
const head = [
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  "<title>GraphReFly · Control</title>",
  `<link rel="stylesheet" href="./dashboard.css?v=${stamp}">`,
].join("\n  ");

const viewSections = ["dashboard", "gaps", "structure", "search"]
  .map(
    (id, i) =>
      `    <section class="view${i === 0 ? " active" : ""}" id="view-${id}" role="tabpanel" aria-labelledby="tab-${id}"></section>`,
  )
  .join("\n");

const shell = [
  `<header class="topbar" id="topbar" aria-busy="true">Loading control panel…</header>`,
  `  <section class="gauges" id="gauges"></section>`,
  `  <nav class="tabs" id="tabs" role="tablist"></nav>`,
  `  <main class="views" id="views">`,
  viewSections,
  `  </main>`,
  `  <footer id="footer"></footer>`,
].join("\n  ");

const html = `<!doctype html>
<html lang="en">
<head>
  ${head}
</head>
<body data-gate="${broken.length === 0 ? "pass" : "fail"}">
  <script type="application/json" id="payload">${JSON.stringify(payload)}</script>
  ${shell}
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <script src="./dashboard.js?v=${stamp}"></script>
</body>
</html>`;
writeFileSync(join(ROOT, "dashboard", "dashboard.html"), html);
console.log("wrote dashboard/dashboard.html");
