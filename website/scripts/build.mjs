import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(root);
const srcDir = join(root, "src");
const publicDir = join(root, "public");
const distDir = join(root, "dist");
const dashboardDir = join(repoRoot, "dashboard");
const dashboardOut = join(distDir, "status");
const learnRecordsPath = join(repoRoot, "guide", "learn.jsonl");
const compositionRecordsPath = join(repoRoot, "guide", "composition.jsonl");
const examplesRecordsPath = join(repoRoot, "guide", "examples.jsonl");
const referenceRecordsPath = join(repoRoot, "guide", "reference.jsonl");
const guideRegistryPath = join(repoRoot, "guide", "guide.jsonl");
const publicRoutes = new Set([
  "/learn",
  "/concepts",
  "/composition",
  "/examples",
  "/packages",
  "/reference",
  "/ts",
  "/py",
  "/rust",
]);
const packageRoutes = new Set(["/ts", "/py", "/rust"]);

const banned = [
  "GraphSpec",
  "GraphReflyModule",
  "GraphReflyGuard",
  "CqrsGraph",
  "BindingBoundary",
  "cross-track-ledger",
  "Impl parity",
  "structural parity",
  "symbol parity",
  "retired root",
  "port-model",
  "port model",
  "port ledger",
  "protocol tiers",
  "protocol messages",
];

const publicRecordBanned = [
  /\bGraphSpec\b/i,
  /\bImpl\b/,
  /\bfacade\b/i,
  /\bstructural parity\b/i,
  /\bsymbol parity\b/i,
  /\bport model\b/i,
  /\bport-model\b/i,
  /\bport ledger\b/i,
  /\bMessageTypeRegistry\b/i,
  /\bcustom message type\b/i,
  /\bcustom message types\b/i,
];

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) entries.push(...walk(path));
    else entries.push(path);
  }
  return entries;
}

function parseJsonl(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${relative(repoRoot, file)}:${index + 1} is invalid JSON: ${error.message}`);
      }
    });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function routeHref(href, fromRoute) {
  if (!href.startsWith("/")) return href;
  const trimmed = href.replace(/^\/+/, "");
  if (fromRoute !== "home") return `../${trimmed}`;
  return trimmed;
}

function assertCleanSource() {
  for (const file of walk(srcDir)) {
    if (!/\.(html|css|js)$/.test(file)) continue;
    const text = readFileSync(file, "utf8");
    for (const term of banned) {
      if (text.includes(term)) {
        const rel = relative(repoRoot, file);
        throw new Error(`website source contains rejected stale term "${term}" in ${rel}`);
      }
    }
  }
}

function assertPublicGuideRecords(records, fileLabel) {
  const allowedPublicness = new Set(["public", "maintainer-link", "internal", "archive-source"]);
  const ids = new Set();
  for (const record of records) {
    if (!record.id || ids.has(record.id)) {
      throw new Error(`${fileLabel} has missing or duplicate id: ${record.id}`);
    }
    ids.add(record.id);
    if (!allowedPublicness.has(record.publicness)) {
      throw new Error(`${record.id} has invalid publicness: ${record.publicness}`);
    }
    if (!record.owner || !record.canonical_repo) {
      throw new Error(`${record.id} must declare owner and canonical_repo`);
    }
    if (record.publicness === "public") {
      if (!Array.isArray(record.public_sections) || record.public_sections.length === 0) {
        throw new Error(`${record.id} must provide public_sections`);
      }
      const publicText = JSON.stringify({
        title: record.title,
        summary: record.public_summary,
        sections: record.public_sections,
        package_refs: record.package_refs,
      });
      for (const pattern of publicRecordBanned) {
        if (pattern.test(publicText)) {
          throw new Error(`public guide record ${record.id} contains rejected stale term matching ${pattern}`);
        }
      }
      if (typeof record.public_summary !== "string" || record.public_summary.length === 0) {
        throw new Error(`${record.id} must provide public_summary`);
      }
      for (const [index, section] of record.public_sections.entries()) {
        if (typeof section.heading !== "string" || section.heading.length === 0) {
          throw new Error(`${record.id} public_sections[${index}] must provide heading`);
        }
        if (!Array.isArray(section.body) || section.body.some((paragraph) => typeof paragraph !== "string")) {
          throw new Error(`${record.id} public_sections[${index}] body must be an array of strings`);
        }
        if (section.bullets != null && (!Array.isArray(section.bullets) || section.bullets.some((item) => typeof item !== "string"))) {
          throw new Error(`${record.id} public_sections[${index}] bullets must be an array of strings`);
        }
      }
      if (record.render_policy?.api_docs !== "delegate") {
        throw new Error(`${record.id} must delegate API docs to package-local docs`);
      }
      if (record.render_policy?.render_refs !== "provenance-only") {
        throw new Error(`${record.id} must render refs as provenance-only`);
      }
      if (!publicRoutes.has(record.route)) {
        throw new Error(`${record.id} route must be one of the public routes, got ${record.route}`);
      }
      for (const pkg of record.package_refs ?? []) {
        if (typeof pkg.href !== "string" || !publicRoutes.has(pkg.href.replace(/\/$/, ""))) {
          throw new Error(`${record.id} package ref ${pkg.label ?? pkg.package} must delegate to a public package route, got ${pkg.href}`);
        }
      }
      if (record.area === "examples") {
        if (typeof record.intent !== "string" || record.intent.length === 0) {
          throw new Error(`${record.id} example records must provide intent`);
        }
        if (!Array.isArray(record.topology) || record.topology.length === 0) {
          throw new Error(`${record.id} example records must provide topology`);
        }
        for (const [index, node] of record.topology.entries()) {
          if (typeof node.role !== "string" || typeof node.label !== "string") {
            throw new Error(`${record.id} topology[${index}] must provide role and label strings`);
          }
        }
      }
    }
  }
}

const referenceAllowedKeys = new Set([
  "id",
  "title",
  "area",
  "kind",
  "audience",
  "publicness",
  "status",
  "owner",
  "canonical_repo",
  "route",
  "public_summary",
  "public_sections",
  "learn_more",
  "refs",
  "package_refs",
  "render_policy",
]);

const referenceRawAuthorityKeys = new Set([
  "rules",
  "decisions",
  "conformance",
  "raw",
  "content",
  "markdown",
  "body_md",
  "rules_text",
  "decisions_text",
  "conformance_text",
  "backlog_text",
  "sessions_text",
  "dashboard_text",
]);

const referenceAllowedRefKeys = new Set(["decisions", "rules", "conformance", "sources"]);

const referenceTextBanned = [
  /"id"\s*:\s*"(R-|D\d+|C-\d+|B\d+|DS-)/,
  /"(statement|decision|rationale|covers_by|runtimes|blocked|harness|supersedes)"\s*:/,
  /\bfull protocol rules?\b/i,
  /\bfull decisions?\b/i,
  /\bfull conformance\b/i,
  /\braw conformance\b/i,
  /\braw decisions?\b/i,
  /\braw rules?\b/i,
  /\bdashboard search\b/i,
  /\bproject-control state\b/i,
  /\bSENTINEL\b/,
  /\bDIRTY\b/,
  /\bDATA\b/,
  /\bRESOLVED\b/,
  /\bmessageTier\b/,
  /\bctx\.up\b/,
  /\bctx\.down\b/,
  /\bD\d+\b/,
  /\bDR-\d+\b/,
  /\bR-[a-z0-9-]+\b/,
  /\bC-\d+[a-z]?\b/,
  /\bGraphSpec\b/i,
  /\bImpl\b/,
  /\bfacade\b/i,
  /\bstructural parity\b/i,
  /\bsymbol parity\b/i,
  /\bport model\b/i,
  /\bport-model\b/i,
  /\bport ledger\b/i,
];

function assertStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings`);
  }
}

function assertRefAnchors(values, label, pattern) {
  assertStringArray(values, label);
  for (const value of values) {
    if (!pattern.test(value)) {
      throw new Error(`${label} must contain compact provenance anchors only, got ${value}`);
    }
  }
}

function collectPublicReferenceText(record) {
  const sectionText = (record.public_sections ?? []).flatMap((section) => [
    section.heading,
    ...(section.body ?? []),
    ...(section.bullets ?? []),
  ]);
  const learnMoreText = (record.learn_more ?? []).flatMap((link) => [link.label, link.href]);
  const packageRefText = (record.package_refs ?? []).flatMap((pkg) => [pkg.label, pkg.href]);
  return [record.title, record.public_summary, ...sectionText, ...learnMoreText, ...packageRefText]
    .filter((value) => value != null)
    .join("\n");
}

function assertPublicReferenceRecords(records) {
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!referenceAllowedKeys.has(key)) {
        throw new Error(`reference record ${record.id ?? "(unknown)"} contains unsupported top-level key ${key}`);
      }
      if (referenceRawAuthorityKeys.has(key)) {
        throw new Error(`reference record ${record.id ?? "(unknown)"} contains raw authority key ${key}`);
      }
    }
    if (record.area !== "reference" || record.kind !== "guarantee" || record.route !== "/reference") {
      throw new Error(`${record.id} must be a reference guarantee routed to /reference`);
    }
    if (record.publicness !== "public" || record.status !== "active") {
      throw new Error(`${record.id} reference records must be public and active`);
    }
    if (record.owner !== "graphrefly" || record.canonical_repo !== "graphrefly") {
      throw new Error(`${record.id} reference records must be owned by graphrefly`);
    }
    if (!Array.isArray(record.audience) || !record.audience.includes("developer")) {
      throw new Error(`${record.id} reference records must include developer audience`);
    }
    if (record.render_policy?.primary !== true) {
      throw new Error(`${record.id} reference records must set render_policy.primary=true`);
    }
    const refs = record.refs ?? {};
    for (const key of Object.keys(refs)) {
      if (!referenceAllowedRefKeys.has(key)) {
        throw new Error(`${record.id} refs contains unsupported authority key ${key}`);
      }
    }
    assertRefAnchors(refs.decisions ?? [], `${record.id} refs.decisions`, /^(D\d+|DR-\d+)$/);
    assertRefAnchors(refs.rules ?? [], `${record.id} refs.rules`, /^R-[a-z0-9-]+$/);
    assertRefAnchors(refs.conformance ?? [], `${record.id} refs.conformance`, /^C-\d+[a-z]?$/);
    assertStringArray(refs.sources ?? [], `${record.id} refs.sources`);
    for (const pkg of record.package_refs ?? []) {
      const href = typeof pkg.href === "string" ? pkg.href.replace(/\/$/, "") : "";
      if (!packageRoutes.has(href)) {
        throw new Error(`${record.id} package refs must delegate only to /ts/, /py/, or /rust/, got ${pkg.href}`);
      }
    }
    if (record.learn_more != null) {
      if (!Array.isArray(record.learn_more)) {
        throw new Error(`${record.id} learn_more must be an array`);
      }
      for (const [index, link] of record.learn_more.entries()) {
        if (typeof link.label !== "string" || typeof link.href !== "string") {
          throw new Error(`${record.id} learn_more[${index}] must provide label and href strings`);
        }
        if (!publicRoutes.has(link.href.replace(/\/$/, ""))) {
          throw new Error(`${record.id} learn_more[${index}] must point to a public route, got ${link.href}`);
        }
      }
    }
    const publicText = collectPublicReferenceText(record);
    for (const pattern of referenceTextBanned) {
      if (pattern.test(publicText)) {
        throw new Error(`reference record ${record.id} contains raw/internal public text matching ${pattern}`);
      }
    }
  }
}

function assertGuideRegistry(records) {
  for (const record of records) {
    if (!record.path) {
      throw new Error(`guide registry record ${record.id ?? "(unknown)"} is missing path`);
    }
    const target = join(repoRoot, record.path);
    if (!existsSync(target)) {
      throw new Error(`guide registry record ${record.id} points to missing ${record.path}`);
    }
    if (record.record_shape === "jsonl") {
      parseJsonl(target);
    }
  }
}

function renderList(items = []) {
  if (!items.length) return "";
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderRecordCards(records, fromRoute) {
  return records
    .filter((record) => record.publicness === "public" && record.status === "active")
    .map((record) => {
      const refs = record.refs ?? {};
      const provenance = [
        ...(refs.decisions ?? []),
        ...(refs.rules ?? []),
        ...(refs.conformance ?? []),
      ];
      const packageLinks = (record.package_refs ?? [])
        .map((pkg) => `<a href="${escapeHtml(routeHref(pkg.href, fromRoute))}">${escapeHtml(pkg.label)}</a>`)
        .join(" · ");
      const topology = Array.isArray(record.topology)
        ? `<section class="composition-section"><h3>Topology</h3><div>${renderList(record.topology.map((node) => `${node.role}: ${node.label}`))}</div></section>`
        : "";
      const learns = Array.isArray(record.learns) && record.learns.length
        ? `<section class="composition-section"><h3>Learns</h3><div>${renderList(record.learns)}</div></section>`
        : "";
      const intent = typeof record.intent === "string"
        ? `<section class="composition-section"><h3>Intent</h3><div><p>${escapeHtml(record.intent)}</p></div></section>`
        : "";
      const sections = record.public_sections
        .map((section) => {
          const body = section.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
          return `<section class="composition-section"><h3>${escapeHtml(section.heading)}</h3><div>${body}${renderList(section.bullets)}</div></section>`;
        })
        .join("");
      return `<article class="composition-record"><h2>${escapeHtml(record.title)}</h2><section class="composition-section"><h3>Summary</h3><div><p>${escapeHtml(record.public_summary)}</p></div></section>${intent}${topology}${learns}${sections}<div class="record-meta"><span>Provenance: ${escapeHtml(provenance.join(", ") || "guide record")}</span><span>Package docs: ${packageLinks}</span></div></article>`;
    })
    .join("");
}

function renderReferenceCards(records, fromRoute) {
  return records
    .filter((record) => record.publicness === "public" && record.status === "active")
    .map((record) => {
      const refs = record.refs ?? {};
      const provenance = [
        ...(refs.decisions ?? []),
        ...(refs.rules ?? []),
        ...(refs.conformance ?? []),
      ];
      const packageLinks = (record.package_refs ?? [])
        .map((pkg) => `<a href="${escapeHtml(routeHref(pkg.href, fromRoute))}">${escapeHtml(pkg.label)}</a>`)
        .join(" · ");
      const learnMore = (record.learn_more ?? [])
        .map((link) => `<a href="${escapeHtml(routeHref(link.href, fromRoute))}">${escapeHtml(link.label)}</a>`)
        .join(" · ");
      const sections = record.public_sections
        .map((section) => {
          const body = section.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
          return `<section class="composition-section"><h3>${escapeHtml(section.heading)}</h3><div>${body}${renderList(section.bullets)}</div></section>`;
        })
        .join("");
      const learnMoreSection = learnMore
        ? `<section class="composition-section"><h3>Learn More</h3><div>${learnMore}</div></section>`
        : "";
      return `<article class="composition-record reference-record"><h2>${escapeHtml(record.title)}</h2><section class="composition-section"><h3>Public Guarantee</h3><div><p>${escapeHtml(record.public_summary)}</p></div></section>${sections}${learnMoreSection}<div class="record-meta"><details><summary>Provenance anchors</summary><span>${escapeHtml(provenance.join(", ") || "guide record")}</span></details><span>Package docs: ${packageLinks}</span></div></article>`;
    })
    .join("");
}

function pageShell({ title, eyebrow, heading, intro, routeName, cards, footerSource }) {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(title)}</title><link rel="icon" href="../assets/favicon.svg" type="image/svg+xml" /><link rel="stylesheet" href="../styles/site.css" /></head>
  <body>
    <header class="site-header"><a class="brand" href="../index.html"><span class="brand-word">Graph<span>ReFly</span></span><span class="brand-sub">developer docs</span></a><nav class="nav" aria-label="Primary"><a href="../learn/index.html">Learn</a><a href="../concepts/index.html">Concepts</a><a href="../composition/index.html">Composition</a><a href="../examples/index.html">Examples</a><a href="../packages/index.html">Packages</a><a href="../reference/index.html">Reference</a></nav></header>
    <main class="route-page composition-page">
      <p class="eyebrow">${escapeHtml(eyebrow)}</p>
      <h1>${escapeHtml(heading)}</h1>
      <p>${escapeHtml(intro)}</p>
      <section class="composition-list">${cards}</section>
    </main>
    <footer class="site-footer"><span>Source: ${escapeHtml(footerSource)}</span><a href="../status/dashboard.html">Maintainer dashboard</a></footer><script src="../scripts/site.js"></script>
  </body>
</html>`;
}

function renderGuidePage(records, routeName, page) {
  const outDir = join(distDir, routeName);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), pageShell({
    ...page,
    routeName,
    cards: renderRecordCards(records, routeName),
  }));
}

function renderReference(records) {
  const outDir = join(distDir, "reference");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), pageShell({
    title: "GraphReFly Reference",
    eyebrow: "Reference",
    heading: "Public guarantees for building with GraphReFly.",
    intro: "These records summarize what developers can rely on. Maintainer authority details stay in dashboard and repository surfaces, while this page keeps the public guarantees concise.",
    footerSource: "guide/reference.jsonl",
    routeName: "reference",
    cards: renderReferenceCards(records, "reference"),
  }));
}

function renderComposition(records) {
  const publicRecords = records.filter((record) => record.publicness === "public" && record.status === "active");
  const cards = renderRecordCards(publicRecords, "composition");

  const html = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>GraphReFly Composition</title><link rel="icon" href="../assets/favicon.svg" type="image/svg+xml" /><link rel="stylesheet" href="../styles/site.css" /></head>
  <body>
    <header class="site-header"><a class="brand" href="../index.html"><span class="brand-word">Graph<span>ReFly</span></span><span class="brand-sub">developer docs</span></a><nav class="nav" aria-label="Primary"><a href="../learn/index.html">Learn</a><a href="../concepts/index.html">Concepts</a><a href="../composition/index.html">Composition</a><a href="../examples/index.html">Examples</a><a href="../packages/index.html">Packages</a><a href="../reference/index.html">Reference</a></nav></header>
    <main class="route-page composition-page">
      <p class="eyebrow">Composition</p>
      <h1>Patterns rendered from guide records.</h1>
      <p>These records are public summaries with compact provenance anchors. Raw decisions, rules, conformance, backlog, sessions, and dashboard state stay in maintainer surfaces.</p>
      <section class="composition-list">${cards}</section>
    </main>
    <footer class="site-footer"><span>Source: guide/composition.jsonl</span><a href="../status/dashboard.html">Maintainer dashboard</a></footer><script src="../scripts/site.js"></script>
  </body>
</html>`;
  const outDir = join(distDir, "composition");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), html);
}

function copyIfPresent(from, to) {
  if (!existsSync(from)) return false;
  cpSync(from, to, { recursive: true });
  return true;
}

assertCleanSource();
const learnRecords = parseJsonl(learnRecordsPath);
const compositionRecords = parseJsonl(compositionRecordsPath);
const examplesRecords = parseJsonl(examplesRecordsPath);
const referenceRecords = parseJsonl(referenceRecordsPath);
const guideRegistryRecords = parseJsonl(guideRegistryPath);
assertGuideRegistry(guideRegistryRecords);
assertPublicGuideRecords(learnRecords, "guide/learn.jsonl");
assertPublicGuideRecords(compositionRecords, "guide/composition.jsonl");
assertPublicGuideRecords(examplesRecords, "guide/examples.jsonl");
assertPublicGuideRecords(referenceRecords, "guide/reference.jsonl");
assertPublicReferenceRecords(referenceRecords);
execFileSync(process.execPath, [join(dashboardDir, "build.mjs")], { cwd: repoRoot, stdio: "inherit" });
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
copyIfPresent(srcDir, distDir);
copyIfPresent(publicDir, distDir);

const routesDir = join(distDir, "routes");
if (existsSync(routesDir)) {
  cpSync(routesDir, distDir, { recursive: true });
  rmSync(routesDir, { recursive: true, force: true });
}

renderGuidePage(learnRecords, "learn", {
  title: "Learn GraphReFly",
  eyebrow: "Learn",
  heading: "Build a declared reactive graph.",
  intro: "A language-neutral first path: understand the topology, then jump to TypeScript, Python, or Rust for runnable syntax.",
  footerSource: "guide/learn.jsonl",
});
renderComposition(compositionRecords);
renderGuidePage(examplesRecords, "examples", {
  title: "GraphReFly Examples",
  eyebrow: "Examples",
  heading: "Recipes that delegate to package code.",
  intro: "These examples describe intent and topology. Runnable examples, generated API docs, demos, install commands, and release material stay package-local.",
  footerSource: "guide/examples.jsonl",
});
renderReference(referenceRecords);

mkdirSync(dashboardOut, { recursive: true });
for (const name of ["dashboard.html", "dashboard.css", "dashboard.js"]) {
  const from = join(dashboardDir, name);
  if (!existsSync(from)) {
    throw new Error(`missing dashboard artifact: ${relative(repoRoot, from)}`);
  }
  cpSync(from, join(dashboardOut, name));
}

console.log(`[website] built ${relative(repoRoot, distDir)}`);
