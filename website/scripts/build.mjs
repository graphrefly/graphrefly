import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { renderHomeShowcase } from "./home-showcase.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(root);
const srcDir = join(root, "src");
const publicDir = join(root, "public");
const distDir = join(root, "dist");
const checkMetaDir = join(root, ".generated");
const publicContentReportOut = join(checkMetaDir, "public-content-report.json");
const publicCnamePath = join(publicDir, "CNAME");
const distCnamePath = join(distDir, "CNAME");
const learnRecordsPath = join(repoRoot, "guide", "learn.jsonl");
const conceptsRecordsPath = join(repoRoot, "guide", "concepts.jsonl");
const compositionRecordsPath = join(repoRoot, "guide", "composition.jsonl");
const packageRecordsPath = join(repoRoot, "guide", "packages.jsonl");
const referenceRecordsPath = join(repoRoot, "guide", "reference.jsonl");
const blogRecordsPath = join(repoRoot, "guide", "blog.jsonl");
const siteRecordsPath = join(repoRoot, "guide", "site.jsonl");
const guideRegistryPath = join(repoRoot, "guide", "guide.jsonl");
const decisionRecordsPath = join(repoRoot, "decisions", "decisions.jsonl");
const ruleRecordsPath = join(repoRoot, "spec", "rules.jsonl");
const conformanceRecordsPath = join(repoRoot, "spec", "conformance.jsonl");
const protocolAuthoritySource = "decisions/decisions.jsonl + spec/rules.jsonl + spec/conformance.jsonl";
const publicRoutes = new Set([
  "/protocol",
  "/why",
  "/blog",
  "/learn",
  "/concepts",
  "/composition",
  "/packages",
  "/reference",
]);
const packageRoutes = new Set();
const expectedSourceJsonlByRoute = new Map([
  ["/", "guide/site.jsonl"],
  ["/why/", "guide/site.jsonl"],
  ["/protocol/", protocolAuthoritySource],
  ["/learn/", "guide/learn.jsonl"],
  ["/concepts/", "guide/concepts.jsonl"],
  ["/composition/", "guide/composition.jsonl"],
  ["/packages/", "guide/packages.jsonl"],
  ["/reference/", "guide/reference.jsonl"],
  ["/blog/", "guide/blog.jsonl"],
]);
const packageRouteById = new Map([
  ["ts", "https://ts.graphrefly.dev/"],
  ["py", "https://py.graphrefly.dev/"],
  ["rust", "https://rs.graphrefly.dev/"],
]);
const packageRepoById = new Map([
  ["ts", "graphrefly-ts"],
  ["py", "graphrefly-py"],
  ["rust", "graphrefly-rs"],
]);
const publicTopLevelEntries = new Set([
  "assets",
  "blog",
  "CNAME",
  "composition",
  "concepts",
  "index.html",
  "learn",
  "packages",
  "protocol",
  "reference",
  "scripts",
  "styles",
  "why",
]);
const localPackageRouteById = new Map(
  [...packageRouteById].filter(([, route]) => route.startsWith("/")),
);
for (const route of localPackageRouteById.values()) {
  publicRoutes.add(route);
  packageRoutes.add(route);
  expectedSourceJsonlByRoute.set(`${route}/`, "guide/packages.jsonl");
}
const primaryNav = [
  { label: "Why", route: "/why" },
  { label: "Packages", route: "/packages" },
  { label: "Blog", route: "/blog" },
  { label: "GitHub", href: "https://github.com/graphrefly" },
];
const blogCategories = new Set(["Product", "Engineering", "Ideas", "Community", "Project", "Ecosystem"]);
const packageDocsHrefById = new Map([
  ["ts", "https://ts.graphrefly.dev/"],
  ["py", "https://py.graphrefly.dev/"],
  ["rust", "https://rs.graphrefly.dev/"],
]);
const internalRouteNames = new Set(["decisions", "guide", "maintainers", "spec", "status"]);
const internalSurfaceText = [
  /\bdashboard(?:\.html)?\b/i,
  /\bproject[- ]control\b/i,
  /\bbacklog\b/i,
  /\bsessions?\b/i,
  /\bgaps?\b/i,
  /\braw decisions?\b/i,
  /\braw rules?\b/i,
  /\bconformance coverage\b/i,
  /\blocalhost\b/i,
  /\b127\.0\.0\.1\b/,
  /\bdecisions\.jsonl\b/i,
  /\brules\.jsonl\b/i,
];
const textSourceExtensions = new Set([".html", ".css", ".js", ".json", ".jsonl", ".md", ".svg", ".txt", ".yml", ".yaml"]);

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

function assertInsideDist(target, sourceLabel, href) {
  const rel = relative(distDir, target);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`${sourceLabel} links outside website dist: ${href}`);
  }
}

function packageRepoPathMatches(pathname, expectedRepo) {
  const expected = `/graphrefly/${expectedRepo}`;
  return pathname === expected || pathname.startsWith(`${expected}/`);
}

function isTextSourceFile(file) {
  return textSourceExtensions.has(file.slice(file.lastIndexOf(".")).toLowerCase()) || file.endsWith("CNAME");
}

function assertCleanSource() {
  for (const baseDir of [srcDir, publicDir]) {
    if (!existsSync(baseDir)) continue;
    for (const file of walk(baseDir)) {
      if (!isTextSourceFile(file)) continue;
      const text = readFileSync(file, "utf8");
      for (const term of banned) {
        if (text.includes(term)) {
          const rel = relative(repoRoot, file);
          throw new Error(`website source contains rejected stale term "${term}" in ${rel}`);
        }
      }
    }
  }
}

function assertPackageRefs(record) {
  for (const pkg of record.package_refs ?? []) {
    const expectedRoute = packageRouteById.get(pkg.package);
    const expectedDocsHref = packageDocsHrefById.get(pkg.package);
    if (!expectedRoute || !expectedDocsHref) {
      throw new Error(`${record.id} package ref ${pkg.label ?? pkg.package} must use ts, py, or rust`);
    }
    const href = typeof pkg.href === "string" ? pkg.href.replace(/\/$/, "") : "";
    if (href !== expectedRoute && href !== expectedDocsHref.replace(/\/$/, "")) {
      throw new Error(`${record.id} package ref ${pkg.label ?? pkg.package} must delegate to ${expectedDocsHref}, got ${pkg.href}`);
    }
  }
}

function assertPublicGuideRecords(records, fileLabel, expected = {}) {
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
      if (!Array.isArray(record.audience) || !record.audience.includes("developer")) {
        throw new Error(`${record.id} public records must include developer audience`);
      }
      if (expected.area && record.area !== expected.area) {
        throw new Error(`${record.id} must have area ${expected.area}, got ${record.area}`);
      }
      if (expected.route && record.route !== expected.route) {
        throw new Error(`${record.id} must route to ${expected.route}, got ${record.route}`);
      }
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
      assertRecordRefs(record);
      assertPackageRefs(record);
    }
  }
}

const packageAllowedKeys = new Set([
  "id",
  "title",
  "area",
  "kind",
  "package",
  "package_name",
  "audience",
  "publicness",
  "status",
  "owner",
  "canonical_repo",
  "route",
  "public_summary",
  "public_sections",
  "entry_links",
  "refs",
  "render_policy",
]);

const packageTextBanned = [
  /```/,
  /\bimport\s+[{*]/,
  /\bfrom\s+["']@graphrefly\//,
  /\bnpm\s+install\b/i,
  /\bpip\s+install\b/i,
  /\bcargo\s+(add|install)\b/i,
  /\bAPI signature\b/i,
  /\bsymbol table\b/i,
  /\brelease notes? body\b/i,
  /\bdemo body\b/i,
  /\bGraphSpec\b/i,
  /\bImpl\b/,
  /\bfacade\b/i,
  /\bstructural parity\b/i,
  /\bsymbol parity\b/i,
  /\bport model\b/i,
  /\bport-model\b/i,
  /\bport ledger\b/i,
];

function collectPackageText(record) {
  const sectionText = (record.public_sections ?? []).flatMap((section) => [
    section.heading,
    ...(section.body ?? []),
    ...(section.bullets ?? []),
  ]);
  const linkText = (record.entry_links ?? []).map((link) => link.label);
  return [record.title, record.package_name, record.public_summary, ...sectionText, ...linkText]
    .filter((value) => value != null)
    .join("\n");
}

function assertPackageEntryRecords(records) {
  const seenPackages = new Set();
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!packageAllowedKeys.has(key)) {
        throw new Error(`package record ${record.id ?? "(unknown)"} contains unsupported top-level key ${key}`);
      }
    }
    if (record.area !== "packages" || record.kind !== "package-entry") {
      throw new Error(`${record.id} must be a package-entry record`);
    }
    if (!packageRouteById.has(record.package)) {
      throw new Error(`${record.id} has invalid package ${record.package}`);
    }
    if (seenPackages.has(record.package)) {
      throw new Error(`duplicate package entry for ${record.package}`);
    }
    seenPackages.add(record.package);
    const expectedRoute = packageRouteById.get(record.package);
    const expectedRepo = packageRepoById.get(record.package);
    if (record.route !== expectedRoute) {
      throw new Error(`${record.id} must route to ${expectedRoute}, got ${record.route}`);
    }
    if (record.canonical_repo !== expectedRepo) {
      throw new Error(`${record.id} canonical_repo must be ${expectedRepo}, got ${record.canonical_repo}`);
    }
    if (record.publicness !== "public" || record.status !== "active") {
      throw new Error(`${record.id} package records must be public and active`);
    }
    if (record.owner !== "graphrefly") {
      throw new Error(`${record.id} package records must be owned by graphrefly`);
    }
    if (!Array.isArray(record.audience) || !record.audience.includes("developer")) {
      throw new Error(`${record.id} package records must include developer audience`);
    }
    if (typeof record.public_summary !== "string" || record.public_summary.length === 0) {
      throw new Error(`${record.id} must provide public_summary`);
    }
    if (!Array.isArray(record.public_sections) || record.public_sections.length === 0) {
      throw new Error(`${record.id} must provide public_sections`);
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
    if (!Array.isArray(record.entry_links) || record.entry_links.length === 0) {
      throw new Error(`${record.id} must provide entry_links`);
    }
    for (const [index, link] of record.entry_links.entries()) {
      if (typeof link.label !== "string" || typeof link.href !== "string") {
        throw new Error(`${record.id} entry_links[${index}] must provide label and href strings`);
      }
      let parsed;
      try {
        parsed = new URL(link.href);
      } catch {
        throw new Error(`${record.id} entry_links[${index}] must provide an absolute package-owned URL`);
      }
      if (parsed.protocol !== "https:" || parsed.hostname !== "github.com" || !packageRepoPathMatches(parsed.pathname, expectedRepo)) {
        throw new Error(`${record.id} entry_links[${index}] must point to the package-owned ${expectedRepo} repo`);
      }
    }
    if (record.render_policy?.primary !== true || record.render_policy?.api_docs !== "delegate" || record.render_policy?.package_docs !== "delegate") {
      throw new Error(`${record.id} must delegate package docs and API docs`);
    }
    assertRecordRefs(record);
    const refs = record.refs ?? {};
    if (!refs.decisions?.includes("D32") || !refs.decisions?.includes("D563")) {
      throw new Error(`${record.id} package records must cite D32 and D563`);
    }
    const publicText = collectPackageText(record);
    for (const pattern of packageTextBanned) {
      if (pattern.test(publicText)) {
        throw new Error(`package record ${record.id} contains package-local or stale public text matching ${pattern}`);
      }
    }
  }
  for (const pkg of packageRouteById.keys()) {
    if (!seenPackages.has(pkg)) {
      throw new Error(`missing package entry for ${pkg}`);
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

const protocolRuleAreas = new Set(["wave", "runtime", "graph", "node", "control"]);

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

function assertRecordRefs(record) {
  if (record.refs == null || typeof record.refs !== "object" || Array.isArray(record.refs)) {
    throw new Error(`${record.id} must provide refs provenance anchors`);
  }
  for (const key of Object.keys(record.refs)) {
    if (!referenceAllowedRefKeys.has(key)) {
      throw new Error(`${record.id} refs contains unsupported authority key ${key}`);
    }
  }
  assertRefAnchors(record.refs.decisions ?? [], `${record.id} refs.decisions`, /^(D\d+|DR-\d+)$/);
  assertRefAnchors(record.refs.rules ?? [], `${record.id} refs.rules`, /^R-[a-z0-9-]+$/);
  assertRefAnchors(record.refs.conformance ?? [], `${record.id} refs.conformance`, /^C-\d+[a-z]?$/);
  assertStringArray(record.refs.sources ?? [], `${record.id} refs.sources`);
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
    const isPublic = record.publicness === "public" && record.status === "active";
    const isInternal = record.publicness === "internal" && record.status === "active";
    if (!isPublic && !isInternal) {
      throw new Error(`${record.id} reference records must be active public guarantees or active internal source records`);
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
    assertRecordRefs(record);
    assertPackageRefs(record);
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
    if (isPublic) {
      const publicText = collectPublicReferenceText(record);
      for (const pattern of referenceTextBanned) {
        if (pattern.test(publicText)) {
          throw new Error(`reference record ${record.id} contains raw/internal public text matching ${pattern}`);
        }
      }
    }
  }
}

function assertBlogRecords(records) {
  const ids = new Set();
  const slugs = new Set();
  for (const record of records) {
    if (!record.id || ids.has(record.id)) {
      throw new Error(`guide/blog.jsonl has missing or duplicate id: ${record.id}`);
    }
    ids.add(record.id);
    if (record.area !== "blog" || !["post", "editorial-brief"].includes(record.kind) || record.route !== "/blog") {
      throw new Error(`${record.id} must be a blog post or editorial brief routed to /blog`);
    }
    if (typeof record.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.slug)) {
      throw new Error(`${record.id} must provide a URL-safe slug`);
    }
    if (slugs.has(record.slug)) {
      throw new Error(`duplicate blog slug ${record.slug}`);
    }
    slugs.add(record.slug);
    if (typeof record.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
      throw new Error(`${record.id} must provide date as YYYY-MM-DD`);
    }
    if (typeof record.time !== "string" || !/^\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(record.time)) {
      throw new Error(`${record.id} must provide time as HH:mm:ss±HH:mm`);
    }
    const isPublished = record.kind === "post" && record.publicness === "public" && record.status === "active";
    const isEditorialBrief = record.kind === "editorial-brief" && record.publicness === "internal" && record.status === "draft";
    if (!isPublished && !isEditorialBrief) {
      throw new Error(`${record.id} must be either a public active post or an internal draft editorial brief`);
    }
    if (record.owner !== "graphrefly" || record.canonical_repo !== "graphrefly") {
      throw new Error(`${record.id} blog records must be owned by graphrefly`);
    }
    if (typeof record.title !== "string" || record.title.trim().length === 0) {
      throw new Error(`${record.id} must provide a title`);
    }
    if (!Array.isArray(record.audience) || record.audience.length === 0) {
      throw new Error(`${record.id} blog records must declare an audience`);
    }
    if (!Array.isArray(record.tags) || record.tags.some((tag) => typeof tag !== "string" || tag.length === 0)) {
      throw new Error(`${record.id} must provide string tags`);
    }
    if (typeof record.summary !== "string" || record.summary.length === 0) {
      throw new Error(`${record.id} must provide summary`);
    }
    if (isPublished) {
      if (!record.audience.includes("developer")) {
        throw new Error(`${record.id} public posts must include developer audience`);
      }
      if (!blogCategories.has(record.category)) {
        throw new Error(`${record.id} must use an approved blog category`);
      }
      if (typeof record.author !== "string" || record.author.length === 0) {
        throw new Error(`${record.id} must provide an author`);
      }
      if (!Number.isInteger(record.read_time_minutes) || record.read_time_minutes < 1) {
        throw new Error(`${record.id} must provide a positive integer read_time_minutes`);
      }
    }
    if (!Array.isArray(record.sections) || record.sections.length === 0) {
      throw new Error(`${record.id} must provide sections`);
    }
    for (const [sectionIndex, section] of record.sections.entries()) {
      if (typeof section.heading !== "string" || section.heading.length === 0) {
        throw new Error(`${record.id} sections[${sectionIndex}] must provide heading`);
      }
      if (!Array.isArray(section.body) || section.body.length === 0) {
        throw new Error(`${record.id} sections[${sectionIndex}] must provide body blocks`);
      }
      for (const [blockIndex, block] of section.body.entries()) {
        if (block?.type === "paragraph") {
          if (typeof block.text !== "string" || block.text.length === 0) {
            throw new Error(`${record.id} sections[${sectionIndex}].body[${blockIndex}] paragraph must provide text`);
          }
        } else if (block?.type === "bullets") {
          if (!Array.isArray(block.items) || block.items.some((item) => typeof item !== "string" || item.length === 0)) {
            throw new Error(`${record.id} sections[${sectionIndex}].body[${blockIndex}] bullets must provide string items`);
          }
        } else {
          throw new Error(`${record.id} sections[${sectionIndex}].body[${blockIndex}] has unsupported block type ${block?.type}`);
        }
      }
    }
    if (isPublished) {
      const publicText = JSON.stringify({
        title: record.title,
        summary: record.summary,
        category: record.category,
        author: record.author,
        tags: record.tags,
        sections: record.sections,
      });
      for (const pattern of publicRecordBanned) {
        if (pattern.test(publicText)) {
          throw new Error(`public blog record ${record.id} contains rejected stale term matching ${pattern}`);
        }
      }
    }
    assertRecordRefs(record);
    assertPackageRefs(record);
    if (record.render_policy?.render_refs !== "provenance-only" || record.render_policy?.api_docs !== "delegate") {
      throw new Error(`${record.id} must use provenance-only refs and delegate API docs`);
    }
    if (record.migration_source != null) {
      if (typeof record.migration_source.kind !== "string" || !Array.isArray(record.migration_source.sources)) {
        throw new Error(`${record.id} migration_source must include kind and sources`);
      }
    }
  }
}

function assertSiteRecords(records) {
  const expected = new Map([
    ["/", { id: "site.home", kind: "landing-page" }],
    ["/why", { id: "site.why", kind: "narrative-page" }],
  ]);
  if (records.length !== expected.size) {
    throw new Error(`guide/site.jsonl must contain exactly ${expected.size} public page records`);
  }
  for (const record of records) {
    const shape = expected.get(record.route);
    if (!shape || record.id !== shape.id || record.kind !== shape.kind) {
      throw new Error(`${record.id ?? "(unknown)"} is not an admitted public site page`);
    }
    if (record.area !== "site" || record.publicness !== "public" || record.status !== "active") {
      throw new Error(`${record.id} must be an active public site record`);
    }
    if (record.owner !== "graphrefly" || record.canonical_repo !== "graphrefly") {
      throw new Error(`${record.id} must be owned by graphrefly`);
    }
    if (!record.audience?.includes("developer") || !record.audience?.includes("executive")) {
      throw new Error(`${record.id} must include executive and developer audiences`);
    }
    for (const field of ["title", "description", "public_summary"]) {
      if (typeof record[field] !== "string" || record[field].trim().length === 0) {
        throw new Error(`${record.id} must provide ${field}`);
      }
    }
    if (!Array.isArray(record.public_sections) || record.public_sections.length === 0) {
      throw new Error(`${record.id} must provide public_sections for corpus indexing`);
    }
    const requireText = (value, field) => {
      if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${record.id} must provide ${field}`);
    };
    const requireItems = (items, field) => {
      if (!Array.isArray(items) || items.length === 0) throw new Error(`${record.id} must provide ${field}`);
      return items;
    };
    const requireUniqueIds = (items, field) => {
      const ids = new Set();
      for (const item of requireItems(items, field)) {
        if (typeof item.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id) || ids.has(item.id)) {
          throw new Error(`${record.id} ${field} must use unique URL-safe ids`);
        }
        ids.add(item.id);
      }
    };
    if (record.route === "/") {
      requireText(record.hero?.meta, "hero.meta");
      for (const action of [record.hero?.primary_action, record.hero?.secondary_action]) {
        requireText(action?.label, "hero action label");
        requireText(action?.href, "hero action href");
      }
      requireText(record.hero?.body, "hero.body");
      for (const [index, line] of requireItems(record.hero?.headline, "hero.headline").entries()) requireText(line, `hero.headline[${index}]`);
      if (record.hero.headline.length !== 2) throw new Error(`${record.id} hero.headline must contain exactly two lines`);
      requireText(record.hero?.category, "hero.category");
      for (const field of ["eyebrow", "heading", "intro", "source_label", "result_label", "problem", "solution"]) requireText(record.example?.[field], `example.${field}`);
      for (const [index, branch] of requireItems(record.example?.branches, "example.branches").entries()) {
        requireText(branch.label, `example.branches[${index}].label`);
        requireText(branch.detail, `example.branches[${index}].detail`);
      }
      if (record.example.branches.length !== 3) throw new Error(`${record.id} example.branches must contain exactly three branches`);
      for (const field of ["heading", "aria_label", "source_detail", "result_detail", "caption_lead", "caption_body"]) {
        requireText(record.example?.diagram?.[field], `example.diagram.${field}`);
      }
      for (const field of ["eyebrow", "heading"]) requireText(record.reasons?.[field], `reasons.${field}`);
      requireUniqueIds(record.reasons?.items, "reasons.items");
      for (const [index, item] of record.reasons.items.entries()) {
        for (const field of ["number", "title", "body", "benefit", "href"]) requireText(item[field], `reasons.items[${index}].${field}`);
      }
      if (record.reasons.items.length !== 3) throw new Error(`${record.id} reasons.items must contain exactly three reasons`);
      for (const field of ["eyebrow", "heading", "intro"]) requireText(record.inspection?.[field], `inspection.${field}`);
      for (const [index, item] of requireItems(record.inspection?.items, "inspection.items").entries()) {
        requireText(item.name, `inspection.items[${index}].name`);
        requireText(item.body, `inspection.items[${index}].body`);
      }
      if (record.inspection.items.length !== 3) throw new Error(`${record.id} inspection.items must contain exactly three entries`);
      for (const section of ["problem", "boundary", "shared_truth", "evidence", "adoption"]) {
        requireText(record[section]?.heading, `${section}.heading`);
        requireText(record[section]?.body, `${section}.body`);
      }
      for (const field of ["eyebrow", "without_label", "without", "with_label", "with"]) requireText(record.problem?.[field], `problem.${field}`);
      requireText(record.boundary?.callout, "boundary.callout");
      requireText(record.shared_truth?.note, "shared_truth.note");
      requireText(record.progress?.heading, "progress.heading");
      for (const [index, item] of requireItems(record.progress?.items, "progress.items").entries()) {
        requireText(item.label, `progress.items[${index}].label`);
        requireText(item.body, `progress.items[${index}].body`);
      }
      if (record.progress.items.length !== 3) throw new Error(`${record.id} progress.items must contain exactly three entries`);
      requireText(record.adoption?.note, "adoption.note");
      for (const [index, action] of requireItems(record.adoption?.actions, "adoption.actions").entries()) {
        requireText(action.label, `adoption.actions[${index}].label`);
        requireText(action.href, `adoption.actions[${index}].href`);
      }
      for (const field of ["eyebrow", "heading", "intro"]) requireText(record.packages?.[field], `packages.${field}`);
    } else {
      for (const field of ["eyebrow", "heading", "body"]) requireText(record.hero?.[field], `hero.${field}`);
      requireText(record.index_label, "index_label");
      requireUniqueIds(record.sections, "sections");
      const expectedSectionIds = ["one-coherent-explanation", "the-graph-is-the-system", "connected-change", "smaller-context", "causal-evidence", "explicit-boundaries", "what-changes", "where-to-start"];
      if (record.sections.map((section) => section.id).join("|") !== expectedSectionIds.join("|")) {
        throw new Error(`${record.id} sections must preserve the approved eight-section order`);
      }
      for (const section of record.sections) {
        for (const field of ["mark", "index_title", "heading"]) requireText(section[field], `sections.${section.id}.${field}`);
        if (!Array.isArray(section.body)) throw new Error(`${record.id} sections.${section.id}.body must be an array`);
        for (const [index, paragraph] of section.body.entries()) requireText(paragraph, `sections.${section.id}.body[${index}]`);
        if (section.callout != null) requireText(section.callout, `sections.${section.id}.callout`);
        if (section.after != null) requireText(section.after, `sections.${section.id}.after`);
        if (section.bullets != null) for (const [index, item] of requireItems(section.bullets, `sections.${section.id}.bullets`).entries()) requireText(item, `sections.${section.id}.bullets[${index}]`);
        if (section.example != null) for (const field of ["without_label", "without", "with_label", "with"]) requireText(section.example[field], `sections.${section.id}.example.${field}`);
        if (section.table != null) {
          if (!Array.isArray(section.table.columns) || section.table.columns.length !== 3) throw new Error(`${record.id} sections.${section.id}.table must have three columns`);
          if (!Array.isArray(section.table.rows) || section.table.rows.some((row) => !Array.isArray(row) || row.length !== 3)) throw new Error(`${record.id} sections.${section.id}.table rows must have three cells`);
        }
      }
      if (record.sections.length !== 8) throw new Error(`${record.id} sections must contain exactly eight sections`);
      for (const field of ["eyebrow", "heading", "body"]) requireText(record.coda?.[field], `coda.${field}`);
      for (const [index, action] of requireItems(record.coda?.actions, "coda.actions").entries()) {
        requireText(action.label, `coda.actions[${index}].label`);
        requireText(action.href, `coda.actions[${index}].href`);
        if (!new Set(["primary", "secondary"]).has(action.style)) throw new Error(`${record.id} coda.actions[${index}] has invalid style`);
      }
    }
    assertRecordRefs(record);
  }
}

function collectPublicRecordText(record) {
  const sectionText = (record.public_sections ?? []).flatMap((section) => [
    section.heading,
    ...(section.body ?? []),
    ...(section.bullets ?? []),
  ]);
  return [record.title, record.public_summary, ...sectionText]
    .filter((value) => value != null)
    .join("\n");
}

function mapById(records, label) {
  const byId = new Map();
  for (const record of records) {
    if (!record.id || byId.has(record.id)) {
      throw new Error(`${label} has missing or duplicate id: ${record.id}`);
    }
    byId.set(record.id, record);
  }
  return byId;
}

function assertProtocolAuthorityAnchor({ id, type, record }) {
  if (!record) {
    throw new Error(`protocol projection cites missing ${type} ${id}`);
  }
  if (type === "decision" && record.status !== "locked") {
    throw new Error(`protocol projection cites decision ${id}, but its status is ${record.status}`);
  }
  if (type === "rule" && record.status !== "active") {
    throw new Error(`protocol projection cites rule ${id}, but its status is ${record.status}`);
  }
  if (type === "conformance") {
    if (record.status !== "required") {
      throw new Error(`protocol projection cites conformance ${id}, but its status is ${record.status}`);
    }
    const runtimes = Object.values(record.runtimes ?? {});
    if (runtimes.length === 0 || runtimes.some((status) => status !== "pass")) {
      throw new Error(`protocol projection cites conformance ${id}, but not every runtime has passed`);
    }
  }
}

function protocolRecordsFromAuthority({ decisionRecords, ruleRecords, conformanceRecords }) {
  const decisionsById = mapById(decisionRecords, "decisions/decisions.jsonl");
  const conformanceById = mapById(conformanceRecords, "spec/conformance.jsonl");
  return ruleRecords
    .filter((rule) => rule.status === "active" && protocolRuleAreas.has(rule.area))
    .map((rule, index) => {
      for (const id of String(rule.since ?? "").split(",").filter(Boolean)) {
        assertProtocolAuthorityAnchor({ id, type: "decision", record: decisionsById.get(id) });
      }
      for (const id of rule.covers_by ?? []) {
        assertProtocolAuthorityAnchor({ id, type: "conformance", record: conformanceById.get(id) });
      }
      return {
        ...rule,
        title: rule.id,
        kind: "authority-rule",
        display_order: index + 1,
        route: "/protocol",
        publicness: "public",
        refs: {
          decisions: String(rule.since ?? "").split(",").filter(Boolean),
          rules: [rule.id],
          conformance: rule.covers_by ?? [],
          sources: [],
        },
        conformance_records: (rule.covers_by ?? []).map((id) => {
          const conformance = conformanceById.get(id);
          return {
            id,
            name: conformance.name,
            runtimes: conformance.runtimes,
          };
        }),
      };
    });
}

function assertProtocolRecords(records) {
  const seenIds = new Set();
  for (const record of records) {
    if (!record.id || seenIds.has(record.id)) {
      throw new Error(`protocol authority projection has missing or duplicate rule id: ${record.id}`);
    }
    seenIds.add(record.id);
    if (record.kind !== "authority-rule" || record.route !== "/protocol") {
      throw new Error(`${record.id} must render as an authority rule routed to /protocol`);
    }
    if (record.status !== "active" || !protocolRuleAreas.has(record.area)) {
      throw new Error(`${record.id} must be an active public protocol rule area`);
    }
    if (typeof record.statement !== "string" || record.statement.length === 0) {
      throw new Error(`${record.id} must render authority statement text`);
    }
    if (!Number.isInteger(record.display_order) || record.display_order < 1) {
      throw new Error(`${record.id} must retain source-order display_order`);
    }
    assertRecordRefs(record);
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

function attrsFrom(fragment) {
  const attrs = [];
  for (const match of fragment.matchAll(/\s(href|src)=(["'])(.*?)\2/g)) {
    attrs.push({ name: match[1], value: match[3] });
  }
  return attrs;
}

function resolveLocalRef(htmlFile, value) {
  if (/^(https?:|mailto:|tel:|#)/.test(value)) return null;
  if (value.startsWith("/")) {
    throw new Error(`${relative(repoRoot, htmlFile)} uses root-relative local URL ${value}`);
  }
  const withoutHash = value.split("#")[0].split("?")[0];
  const target = join(dirname(htmlFile), withoutHash);
  const resolved = withoutHash.endsWith("/") || !/\.[a-z0-9]+$/i.test(withoutHash)
    ? join(target, "index.html")
    : target;
  assertInsideDist(resolved, relative(repoRoot, htmlFile), value);
  return resolved;
}

function assertLocalRefsExist(htmlFile, html) {
  for (const attr of attrsFrom(html)) {
    const target = resolveLocalRef(htmlFile, attr.value);
    if (target && !existsSync(target)) {
      throw new Error(`${relative(repoRoot, htmlFile)} has broken ${attr.name} ${attr.value}`);
    }
  }
}

function assertNoInternalRouteLinks(htmlFile, html) {
  for (const attr of attrsFrom(html).filter((item) => item.name === "href")) {
    const target = resolveLocalRef(htmlFile, attr.value);
    if (!target) continue;
    const rel = relative(distDir, target);
    const [topLevel] = rel.split("/");
    if (internalRouteNames.has(topLevel)) {
      throw new Error(`${relative(repoRoot, htmlFile)} links to internal route ${attr.value}`);
    }
  }
}

function normalizeRenderedRoute(htmlFile) {
  const rel = relative(distDir, htmlFile);
  if (rel === "index.html") return "/";
  return `/${rel.replace(/\/index\.html$/, "/")}`;
}

function normalizeHrefRoute(htmlFile, href) {
  if (!href || /^(https?:|mailto:|tel:|#)/.test(href)) return null;
  const target = resolveLocalRef(htmlFile, href);
  if (!target) return null;
  const rel = relative(distDir, target).replace(/\/index\.html$/, "");
  return rel === "index.html" ? "/" : `/${rel}`;
}

function textFromHtml(html, pattern) {
  const match = html.match(pattern);
  return match ? match[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() : "";
}

function footerSourceLabel(html) {
  const match = html.match(/<footer\b[^>]*\bdata-source="([^"]+)"/);
  return match ? match[1] : textFromHtml(html, /<footer[\s\S]*?<span>([\s\S]*?)<\/span>/);
}

function assertPrimaryNav(htmlFile, html) {
  const navMatch = html.match(/<nav class="nav" aria-label="Primary">([\s\S]*?)<\/nav>/);
  if (!navMatch) {
    throw new Error(`${relative(repoRoot, htmlFile)} is missing primary nav`);
  }
  const links = [...navMatch[1].matchAll(/<a\b[^>]*\shref="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((match) => {
    const target = resolveLocalRef(htmlFile, match[1]);
    const rel = target ? relative(distDir, target).replace(/\/index\.html$/, "") : match[1];
    return { label: match[2], route: target ? `/${rel}` : match[1] };
  });
  const expected = primaryNav.map((item) => ({ label: item.label, route: item.route ?? item.href }));
  if (JSON.stringify(links) !== JSON.stringify(expected)) {
    throw new Error(`${relative(repoRoot, htmlFile)} primary nav drifted from the public IA`);
  }
}

function renderedPageSummary(htmlFile) {
  const html = readFileSync(htmlFile, "utf8");
  const anchors = attrsFrom(html).filter((attr) => attr.name === "href");
  const outboundPackageLinks = anchors
    .map((attr) => attr.value)
    .filter((href) => /^https:\/\/github\.com\/graphrefly\/graphrefly-(ts|py|rs)(\/|$)/.test(href));
  const packageRouteLinks = anchors
    .map((attr) => normalizeHrefRoute(htmlFile, attr.value))
    .filter((route) => packageRoutes.has(route?.replace(/\/$/, "") ?? ""));
  const dashboardLinks = anchors
    .map((attr) => attr.value)
    .filter((href) => href.includes("status/dashboard.html"));
  return {
    route: normalizeRenderedRoute(htmlFile),
    file: relative(distDir, htmlFile),
    title: textFromHtml(html, /<title>([\s\S]*?)<\/title>/),
    h1: textFromHtml(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/),
    source_label: footerSourceLabel(html),
    dashboard_link: dashboardLinks.length === 0 ? "none" : "public-link",
    package_route_links: [...new Set(packageRouteLinks)].sort(),
    outbound_package_links: [...new Set(outboundPackageLinks)].sort(),
  };
}

function assertCnameArtifact() {
  if (!existsSync(publicCnamePath)) {
    throw new Error("website/public/CNAME is missing");
  }
  if (!existsSync(distCnamePath)) {
    throw new Error("website dist is missing CNAME");
  }
  const sourceValue = readFileSync(publicCnamePath, "utf8").trim();
  const distValue = readFileSync(distCnamePath, "utf8").trim();
  if (sourceValue !== "graphrefly.dev" || distValue !== "graphrefly.dev") {
    throw new Error("CNAME must contain exactly graphrefly.dev after trimming whitespace");
  }
}

function refsForRecord(record) {
  const refs = record.refs ?? {};
  return {
    rules: refs.rules ?? [],
    conformance: refs.conformance ?? [],
    sources: refs.sources ?? [],
  };
}

function packageRefsForRecord(record) {
  return (record.package_refs ?? []).map((pkg) => ({
    package: pkg.package,
    label: pkg.label,
    href: pkg.href,
  }));
}

function publicRecordSummary(record, sourceJsonl) {
  return {
    id: record.id,
    title: record.title,
    area: record.area,
    kind: record.kind,
    route: record.route,
    slug: record.slug,
    source_jsonl: sourceJsonl,
    provenance: refsForRecord(record),
    package_refs: packageRefsForRecord(record),
  };
}

function packageEntrySummary(record) {
  return {
    id: record.id,
    title: record.title,
    package: record.package,
    route: record.route,
    source_jsonl: "guide/packages.jsonl",
    canonical_repo: record.canonical_repo,
    provenance: refsForRecord(record),
    entry_links: record.entry_links,
    render_policy: record.render_policy,
  };
}

function assertPublicContentReport(report, activeBlogRecords) {
  if (report.kind !== "graphrefly-public-content-corpus") {
    throw new Error("public content report has the wrong kind");
  }
  const expectedRoutes = new Set([
    "/",
    ...[...publicRoutes].map((route) => `${route}/`),
    ...activeBlogRecords.map((record) => `/blog/${record.slug}/`),
  ]);
  const actualRoutes = new Set(report.pages.map((page) => page.route));
  for (const route of expectedRoutes) {
    if (!actualRoutes.has(route)) {
      throw new Error(`public content report is missing page ${route}`);
    }
  }
  for (const route of actualRoutes) {
    if (!expectedRoutes.has(route)) {
      throw new Error(`public content report includes unexpected page ${route}`);
    }
  }
  for (const page of report.pages) {
    if (page.dashboard_link !== "none") {
      throw new Error(`public content report page ${page.route} links to the internal dashboard`);
    }
    if (page.source_kind === "jsonl" && (!page.source_jsonl || page.record_ids.length === 0)) {
      throw new Error(`public content report page ${page.route} must include source_jsonl and records`);
    }
    const expectedSource = expectedSourceJsonlByRoute.get(page.route);
    if (expectedSource) {
      if (page.source_kind !== "jsonl" || page.source_jsonl !== expectedSource || page.record_ids.length === 0) {
        throw new Error(`public content report page ${page.route} must source ${expectedSource}`);
      }
    } else if (page.source_kind !== "jsonl") {
      throw new Error(`public content report page ${page.route} must be sourced from structured records`);
    }
  }
  const homePage = report.pages.find((page) => page.route === "/");
  const homeInputs = new Map((homePage?.source_inputs ?? []).map((input) => [input.source_jsonl, new Set(input.record_ids)]));
  if (!homeInputs.get("guide/site.jsonl")?.has("site.home")) {
    throw new Error("public content report home page must include site.home as a source input");
  }
  const expectedHomePackageIds = new Set(report.package_entries.map((entry) => entry.id));
  const actualHomePackageIds = homeInputs.get("guide/packages.jsonl") ?? new Set();
  if (actualHomePackageIds.size !== expectedHomePackageIds.size || [...expectedHomePackageIds].some((id) => !actualHomePackageIds.has(id))) {
    throw new Error("public content report home page must include every rendered package record as a source input");
  }
  const packagePages = report.pages.filter((page) => ["/packages/"].includes(page.route));
  for (const page of packagePages) {
    if (page.source_jsonl !== "guide/packages.jsonl") {
      throw new Error(`public content report package page ${page.route} must source guide/packages.jsonl`);
    }
    if (page.outbound_package_links.length === 0) {
      throw new Error(`public content report package page ${page.route} must expose package-owned outbound links`);
    }
  }
  if (report.package_entries.length !== packageRouteById.size) {
    throw new Error("public content report must include one package entry per language");
  }
  for (const entry of report.package_entries) {
    if (entry.render_policy?.api_docs !== "delegate" || entry.render_policy?.package_docs !== "delegate") {
      throw new Error(`public content report package entry ${entry.id} must preserve delegated docs policy`);
    }
  }
}

function mergeRefs(records) {
  const merged = { rules: new Set(), conformance: new Set(), sources: new Set() };
  for (const record of records) {
    const refs = refsForRecord(record);
    for (const key of Object.keys(merged)) {
      for (const value of refs[key]) merged[key].add(value);
    }
  }
  return Object.fromEntries(Object.entries(merged).map(([key, values]) => [key, [...values].sort()]));
}

function writePublicContentReport({ siteRecords, learnRecords, protocolRecords, conceptsRecords, compositionRecords, packageRecords, referenceRecords, blogRecords }) {
  const renderedPages = walk(distDir)
    .filter((item) => item.endsWith(".html") && !relative(distDir, item).startsWith("status/"))
    .map(renderedPageSummary)
    .sort((a, b) => a.route.localeCompare(b.route));
  const guideRecordsByRoute = new Map([
    ["/", { sourceJsonl: "guide/site.jsonl", records: siteRecords.filter((record) => record.route === "/") }],
    ["/why/", { sourceJsonl: "guide/site.jsonl", records: siteRecords.filter((record) => record.route === "/why") }],
    ["/protocol/", { sourceJsonl: protocolAuthoritySource, records: protocolRecords.filter((record) => record.publicness === "public" && record.status === "active") }],
    ["/learn/", { sourceJsonl: "guide/learn.jsonl", records: learnRecords.filter((record) => record.publicness === "public" && record.status === "active") }],
    ["/concepts/", { sourceJsonl: "guide/concepts.jsonl", records: conceptsRecords.filter((record) => record.publicness === "public" && record.status === "active") }],
    ["/composition/", { sourceJsonl: "guide/composition.jsonl", records: compositionRecords.filter((record) => record.publicness === "public" && record.status === "active") }],
    ["/reference/", { sourceJsonl: "guide/reference.jsonl", records: referenceRecords.filter((record) => record.publicness === "public" && record.status === "active") }],
    ["/blog/", { sourceJsonl: "guide/blog.jsonl", records: blogRecords.filter((record) => record.publicness === "public" && record.status === "active") }],
  ]);
  const activeBlogRecords = blogRecords.filter((record) => record.publicness === "public" && record.status === "active");
  for (const record of activeBlogRecords) {
    guideRecordsByRoute.set(`/blog/${record.slug}/`, { sourceJsonl: "guide/blog.jsonl", records: [record] });
  }
  const activePackageRecords = packageRecords.filter((item) => item.publicness === "public" && item.status === "active");
  guideRecordsByRoute.set("/packages/", { sourceJsonl: "guide/packages.jsonl", records: activePackageRecords });
  for (const record of activePackageRecords) {
    if (localPackageRouteById.has(record.package)) {
      guideRecordsByRoute.set(`${record.route}/`, { sourceJsonl: "guide/packages.jsonl", records: [record] });
    }
  }

  const pages = renderedPages.map((page) => {
    const source = guideRecordsByRoute.get(page.route);
    const sourceInputs = source
      ? [{ source_jsonl: source.sourceJsonl, record_ids: source.records.map((record) => record.id) }]
      : [];
    if (page.route === "/") {
      sourceInputs.push({ source_jsonl: "guide/packages.jsonl", record_ids: activePackageRecords.map((record) => record.id) });
    }
    return {
      ...page,
      source_jsonl: source?.sourceJsonl ?? null,
      source_kind: source ? "jsonl" : "unmapped",
      record_ids: source?.records.map((record) => record.id) ?? [],
      source_inputs: sourceInputs,
      provenance: source ? mergeRefs(source.records) : { rules: [], conformance: [], sources: [] },
    };
  });

  const report = {
    kind: "graphrefly-public-content-corpus",
    generated_at: new Date().toISOString(),
    policy: {
      primary_nav: primaryNav.map((item) => ({ label: item.label, route: item.route ?? item.href })),
      public_routes: [...publicRoutes, ...activeBlogRecords.map((record) => `/blog/${record.slug}`)].sort(),
      package_routes: [...packageRoutes].sort(),
      dashboard_link_policy: "isolated: no public dashboard links",
      package_api_policy: "delegate",
    },
    pages,
    public_records: [
      ...siteRecords.map((record) => publicRecordSummary(record, "guide/site.jsonl")),
      ...learnRecords.filter((record) => record.publicness === "public" && record.status === "active").map((record) => publicRecordSummary(record, "guide/learn.jsonl")),
      ...protocolRecords.filter((record) => record.publicness === "public" && record.status === "active").map((record) => publicRecordSummary(record, protocolAuthoritySource)),
      ...conceptsRecords.filter((record) => record.publicness === "public" && record.status === "active").map((record) => publicRecordSummary(record, "guide/concepts.jsonl")),
      ...compositionRecords.filter((record) => record.publicness === "public" && record.status === "active").map((record) => publicRecordSummary(record, "guide/composition.jsonl")),
      ...referenceRecords.filter((record) => record.publicness === "public" && record.status === "active").map((record) => publicRecordSummary(record, "guide/reference.jsonl")),
      ...blogRecords.filter((record) => record.publicness === "public" && record.status === "active").map((record) => publicRecordSummary(record, "guide/blog.jsonl")),
    ],
    package_entries: packageRecords
      .filter((record) => record.publicness === "public" && record.status === "active")
      .map(packageEntrySummary),
  };

  assertPublicContentReport(report, activeBlogRecords);
  writeFileSync(publicContentReportOut, `${JSON.stringify(report, null, 2)}\n`);
}

function assertNoPublicDashboardLinks(htmlFile, html) {
  if (/status\/dashboard\.html/.test(html)) {
    throw new Error(`${relative(repoRoot, htmlFile)} links to the internal dashboard`);
  }
}

function assertRenderedPublicSurface() {
  for (const name of readdirSync(distDir)) {
    if (!publicTopLevelEntries.has(name)) {
      throw new Error(`website dist exposes unexpected top-level public entry ${name}`);
    }
  }

  for (const file of walk(distDir).filter((item) => item.endsWith(".html"))) {
    const rel = relative(distDir, file);
    if (rel.startsWith("status/")) continue;
    const html = readFileSync(file, "utf8");
    assertLocalRefsExist(file, html);
    assertNoInternalRouteLinks(file, html);
    assertPrimaryNav(file, html);
    assertNoPublicDashboardLinks(file, html);
    for (const pattern of internalSurfaceText) {
      if (pattern.test(html)) {
        throw new Error(`${relative(repoRoot, file)} exposes internal/source-control copy matching ${pattern}`);
      }
    }
  }
}

function renderList(items = []) {
  if (!items.length) return "";
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderPrimaryNav(routeName, pathPrefix = "../") {
  const activeRoute = `/${routeName}`;
  return primaryNav
    .map((item) => {
      if (item.href) {
        return `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`;
      }
      const route = item.route;
      const href = `${pathPrefix}${route.replace(/^\/+/, "")}/index.html`;
      const current = route === activeRoute ? ' aria-current="page"' : "";
      return `<a href="${escapeHtml(href)}"${current}>${escapeHtml(item.label)}</a>`;
    })
    .join("");
}

function renderHeader(routeName, pathPrefix = "../") {
  return `<header class="site-header"><a class="brand" href="${pathPrefix}index.html"><span class="brand-word">Graph<span>ReFly</span></span></a><nav class="nav" aria-label="Primary">${renderPrimaryNav(routeName, pathPrefix)}</nav></header>`;
}

function renderFooter(footerSource, pathPrefix = "../") {
  return `<footer class="site-footer rich-footer" data-source="${escapeHtml(footerSource)}"><div class="footer-brand">GraphReFly<small>Reactive graphs for understandable systems</small></div><div class="footer-links" aria-label="Footer links"><div><b>Site</b><a href="${pathPrefix}why/index.html">Why GraphReFly</a><a href="${pathPrefix}packages/index.html">Packages</a><a href="${pathPrefix}blog/index.html">Blog</a></div><div><b>Learn</b><a href="${pathPrefix}learn/index.html">Start here</a><a href="${pathPrefix}concepts/index.html">Core ideas</a><a href="${pathPrefix}reference/index.html">Guarantees</a></div><div><b>Maintainers</b><a href="${pathPrefix}protocol/index.html">Runtime contract</a><a href="https://github.com/graphrefly">GitHub</a></div><div><b>Packages</b><a href="https://ts.graphrefly.dev/">TypeScript</a><a href="https://py.graphrefly.dev/">Python</a><a href="https://rs.graphrefly.dev/">Rust</a></div></div></footer>`;
}

function renderRecordCards(records) {
  return records
    .filter((record) => record.publicness === "public" && record.status === "active")
    .map((record) => {
      const topology = Array.isArray(record.topology)
        ? `<section class="composition-section topology-strip"><h3>Shape</h3><div class="topology-pills">${record.topology.map((node) => `<span><b>${escapeHtml(node.role)}</b>${escapeHtml(node.label)}</span>`).join("")}</div></section>`
        : "";
      const learns = Array.isArray(record.learns) && record.learns.length
        ? `<section class="composition-section"><h3>Useful ideas</h3><div class="topic-tags">${record.learns.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div></section>`
        : "";
      const intent = typeof record.intent === "string"
        ? `<p class="record-intent">${escapeHtml(record.intent)}</p>`
        : "";
      const sections = record.public_sections
        .map((section) => {
          const body = section.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
          return `<section class="composition-section"><h3>${escapeHtml(section.heading)}</h3><div>${body}${renderList(section.bullets)}</div></section>`;
        })
        .join("");
      return `<article class="composition-record record-card"><header class="record-card-head"><h2>${escapeHtml(record.title)}</h2><p>${escapeHtml(record.public_summary)}</p></header>${intent}${topology}${learns}${sections}</article>`;
    })
    .join("");
}

function renderReferenceCards(records, fromRoute) {
  return records
    .filter((record) => record.publicness === "public" && record.status === "active")
    .map((record) => {
      const learnMore = (record.learn_more ?? [])
        .map((link) => `<a href="${escapeHtml(routeHref(link.href, fromRoute))}">${escapeHtml(link.label)}</a>`)
        .join(" · ");
      const sections = record.public_sections
        .map((section) => {
          const body = section.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
          const heading = section.heading === "Guarantee" ? "What it means" : section.heading === "Use It" ? "When it helps" : section.heading;
          return `<section class="composition-section"><h3>${escapeHtml(heading)}</h3><div>${body}${renderList(section.bullets)}</div></section>`;
        })
        .join("");
      const learnMoreSection = learnMore
        ? `<section class="composition-section"><h3>Explore next</h3><div>${learnMore}</div></section>`
        : "";
      return `<article class="composition-record reference-record record-card"><header class="record-card-head"><h2>${escapeHtml(record.title)}</h2><p>${escapeHtml(record.public_summary)}</p></header>${sections}${learnMoreSection}</article>`;
    })
    .join("");
}

function renderBlogBlock(block) {
  if (block.type === "paragraph") {
    return `<p>${escapeHtml(block.text)}</p>`;
  }
  if (block.type === "bullets") {
    return renderList(block.items);
  }
  return "";
}

function renderBlogCards(records) {
  return records
    .filter((record) => record.publicness === "public" && record.status === "active")
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
    .map((record) => {
      const tags = record.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
      return `<article id="${escapeHtml(record.slug)}" class="blog-card"><div class="blog-card-meta"><span>${escapeHtml(record.category)}</span><time datetime="${escapeHtml(record.date)}">${escapeHtml(record.date)}</time></div><h2><a href="${escapeHtml(record.slug)}/index.html">${escapeHtml(record.title)}</a></h2><p>${escapeHtml(record.summary)}</p><div class="blog-card-foot"><span>${escapeHtml(record.author)} · ${escapeHtml(record.read_time_minutes)} min read</span><div class="topic-tags">${tags}</div><a class="blog-read-link" href="${escapeHtml(record.slug)}/index.html">Read article <span aria-hidden="true">-&gt;</span></a></div></article>`;
    })
    .join("");
}

function renderBlogArticle(record) {
  const sections = record.sections
    .map((section) => `<section><h2>${escapeHtml(section.heading)}</h2>${section.body.map(renderBlogBlock).join("")}</section>`)
    .join("");
  return renderDocument({
    title: `${record.title} · GraphReFly`,
    description: record.summary,
    routeName: "blog",
    pathPrefix: "../../",
    footerSource: "guide/blog.jsonl",
    main: `<main class="blog-post">
      <a class="blog-back" href="../index.html">&lt;- All posts</a>
      <header class="blog-post-head"><p class="eyebrow">${escapeHtml(record.category)}</p><h1>${escapeHtml(record.title)}</h1><p class="blog-deck">${escapeHtml(record.summary)}</p><div class="blog-byline"><span>${escapeHtml(record.author)}</span><time datetime="${escapeHtml(record.date)}">${escapeHtml(record.date)}</time><span>${escapeHtml(record.read_time_minutes)} min read</span></div></header>
      <article class="blog-post-body">${sections}</article>
      <aside class="blog-post-next"><p>See where GraphReFly fits.</p><div class="route-actions"><a class="button" href="../../why/index.html">Why GraphReFly</a><a class="button secondary" href="../../packages/index.html">Choose a package</a></div></aside>
    </main>`,
  });
}

function protocolAnchor(record) {
  return record.id.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
}

function protocolAreaAnchor(area) {
  return `protocol-area-${area.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;
}

function humanizeProtocolLabel(value) {
  return String(value)
    .replace(/^R-/, "")
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function protocolGroups(records) {
  const groups = new Map();
  for (const record of records) {
    if (!groups.has(record.area)) groups.set(record.area, []);
    groups.get(record.area).push(record);
  }
  return [...groups.entries()].map(([area, areaRecords]) => ({ area, records: areaRecords }));
}

function renderProtocolRule(record) {
  return `<article id="${escapeHtml(protocolAnchor(record))}" class="protocol-record protocol-record-${escapeHtml(record.area)}"><header class="protocol-record-head"><span>${String(record.display_order).padStart(2, "0")}</span><h3>${escapeHtml(humanizeProtocolLabel(record.id))}</h3><code class="protocol-rule-id">${escapeHtml(record.id)}</code></header><div class="protocol-record-body"><section class="protocol-record-section statement"><h4>Technical guarantee</h4><p>${escapeHtml(record.statement)}</p></section></div></article>`;
}

function renderProtocolCards(records) {
  const publicRecords = records
    .filter((record) => record.publicness === "public" && record.status === "active")
    .sort((a, b) => a.display_order - b.display_order);
  const groups = protocolGroups(publicRecords);
  const map = groups
    .map((group) => `<li><a href="#${escapeHtml(protocolAreaAnchor(group.area))}"><span>${group.records.length}</span>${escapeHtml(humanizeProtocolLabel(group.area))}</a></li>`)
    .join("");
  const flow = groups
    .map((group) => `<section id="${escapeHtml(protocolAreaAnchor(group.area))}" class="protocol-area-group"><header class="protocol-area-head"><p>Topic</p><h2>${escapeHtml(humanizeProtocolLabel(group.area))}</h2><span>${group.records.length} guarantees</span></header>${group.records.map(renderProtocolRule).join("")}</section>`)
    .join("");
  return `<div class="protocol-board"><aside class="protocol-map" aria-label="Protocol topics"><p>Browse by topic</p><p class="protocol-map-note">This maintainer contract keeps language runtimes aligned. Product users should begin with Why or a language package.</p><ol>${map}</ol></aside><div class="protocol-flow">${flow}</div></div>`;
}

function renderEntryLinks(links = []) {
  if (!links.length) return "";
  return `<div class="entry-link-list">${links.map((link) => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`).join("")}</div>`;
}

const packageRuntimeCopy = new Map([
  ["ts", {
    packageLabel: "@graphrefly/ts",
    languageLabel: "TypeScript",
    install: "npm install @graphrefly/ts",
  }],
  ["py", {
    packageLabel: "graphrefly",
    languageLabel: "Python",
    install: "pip install graphrefly",
  }],
  ["rust", {
    packageLabel: "graphrefly-rs",
    languageLabel: "Rust",
    install: "cargo add graphrefly-rs",
  }],
]);

function packageInstallCommand(record) {
  const copy = packageRuntimeCopy.get(record.package);
  if (!copy?.install) return "";
  return `<code class="install-command">${escapeHtml(copy.install)}</code>`;
}

function packagePrimaryLink(record) {
  return record.entry_links?.[0]?.href ?? `https://github.com/graphrefly/${record.canonical_repo}`;
}

function renderPackageCards(records) {
  return records
    .filter((record) => record.publicness === "public" && record.status === "active")
    .map((record) => {
      const docsHref = packageDocsHrefById.get(record.package);
      const copy = packageRuntimeCopy.get(record.package);
      const packageName = copy?.packageLabel ?? record.package_name;
      return `<article class="runtime-card runtime-card-${escapeHtml(record.package)}"><div class="runtime-card-top"><h2>${escapeHtml(copy?.languageLabel ?? record.title)}</h2><code class="package-name-command">${escapeHtml(packageName)}</code>${packageInstallCommand(record)}</div><div class="runtime-card-body"><div class="runtime-card-actions"><a class="button" href="${escapeHtml(docsHref)}">Open docs <span aria-hidden="true">-></span></a><a class="button secondary" href="${escapeHtml(packagePrimaryLink(record))}">Repository</a></div></div></article>`;
    })
    .join("");
}

function renderDocument({ title, description = "", routeName, pathPrefix = "../", main, footerSource, bodyClass = "" }) {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />${description ? `<meta name="description" content="${escapeHtml(description)}" />` : ""}<title>${escapeHtml(title)}</title><link rel="icon" href="${pathPrefix}assets/favicon.svg" type="image/svg+xml" /><link rel="stylesheet" href="${pathPrefix}styles/site.css" /></head>
  <body data-site-shell="public"${bodyClass ? ` class="${escapeHtml(bodyClass)}"` : ""}>
    ${renderHeader(routeName, pathPrefix)}
    ${main}
    ${renderFooter(footerSource, pathPrefix)}<script src="${pathPrefix}scripts/site.js"></script>
  </body>
</html>`;
}

function renderPackageChooser() {
  return `<aside class="page-package-chooser"><div><p class="eyebrow">Ready to try it?</p><h2>Start with the language your team already uses.</h2></div><div class="page-package-links"><a href="https://ts.graphrefly.dev/">TypeScript</a><a href="https://py.graphrefly.dev/">Python</a><a href="https://rs.graphrefly.dev/">Rust</a></div></aside>`;
}

function pageShell({ title, description = "", eyebrow, heading, intro, routeName, cards, footerSource, mainClass = "", afterCards = "" }) {
  return renderDocument({
    title,
    description,
    routeName,
    footerSource,
    main: `<main class="route-page composition-page route-${escapeHtml(routeName)} ${escapeHtml(mainClass)}">
      <section class="route-hero">
        <p class="eyebrow">${escapeHtml(eyebrow)}</p>
        <h1>${escapeHtml(heading)}</h1>
        <p>${escapeHtml(intro)}</p>
      </section>
      <section class="composition-list">${cards}</section>
      ${afterCards}
    </main>`,
  });
}

function renderGuidePage(records, routeName, page) {
  const outDir = join(distDir, routeName);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), pageShell({
    ...page,
    routeName,
    cards: renderRecordCards(records),
    afterCards: renderPackageChooser(),
  }));
}

function renderProtocol(records) {
  const outDir = join(distDir, "protocol");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), pageShell({
    title: "GraphReFly Maintainer Protocol",
    eyebrow: "Maintainer reference",
    heading: "The contract used to keep runtimes aligned.",
    intro: "This internal maintainer view tracks the guarantees shared by GraphReFly implementations. Product users should begin with Why or choose a language package.",
    footerSource: "authority protocol projection",
    routeName: "protocol",
    cards: renderProtocolCards(records),
  }));
}

function renderReference(records) {
  const outDir = join(distDir, "reference");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), pageShell({
    title: "GraphReFly Reference",
    eyebrow: "Guarantees",
    heading: "What your team can rely on.",
    intro: "A plain-language view of the promises behind GraphReFly: visible relationships, coherent updates, honest missing data, and clear boundaries for outside work.",
    footerSource: "guide/reference.jsonl",
    routeName: "reference",
    cards: renderReferenceCards(records, "reference"),
    afterCards: renderPackageChooser(),
  }));
}

function renderBlog(records) {
  const outDir = join(distDir, "blog");
  mkdirSync(outDir, { recursive: true });
  const publicRecords = records
    .filter((record) => record.publicness === "public" && record.status === "active")
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  writeFileSync(join(outDir, "index.html"), pageShell({
    title: "GraphReFly Blog",
    eyebrow: "Blog",
    heading: "Notes from building GraphReFly.",
    intro: "Product releases, engineering stories, comparisons, community notes, and the ideas shaping a graph-first reactive library.",
    footerSource: "guide/blog.jsonl",
    routeName: "blog",
    mainClass: "blog-index",
    cards: renderBlogCards(publicRecords),
  }));
  for (const record of publicRecords) {
    const postDir = join(outDir, record.slug);
    mkdirSync(postDir, { recursive: true });
    writeFileSync(join(postDir, "index.html"), renderBlogArticle(record));
  }
}

function renderPackages(records) {
  const outDir = join(distDir, "packages");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), pageShell({
    title: "GraphReFly Packages",
    eyebrow: "Packages",
    heading: "Pick the language your team already uses.",
    intro: "The graph model is shared across TypeScript, Python, and Rust. Each package owns its installation guide, runnable examples, and exact API reference.",
    footerSource: "guide/packages.jsonl",
    routeName: "packages",
    cards: renderPackageCards(records),
  }));
}

function renderComposition(records) {
  const publicRecords = records.filter((record) => record.publicness === "public" && record.status === "active");
  const cards = renderRecordCards(publicRecords);
  const html = renderDocument({
    title: "GraphReFly Composition",
    routeName: "composition",
    footerSource: "guide/composition.jsonl",
    main: `<main class="route-page composition-page route-composition">
      <section class="route-hero">
        <p class="eyebrow">Composition</p>
        <h1>Common shapes for software that changes over time.</h1>
        <p>These patterns show how to arrange inputs, calculations, joins, and outward effects before worrying about language-specific syntax.</p>
      </section>
      <section class="composition-list">${cards}</section>
      ${renderPackageChooser()}
    </main>`,
  });
  const outDir = join(distDir, "composition");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), html);
}

function renderHome(record, packageRecords) {
  const headline = record.hero.headline.map((line, index) => `<span${index === record.hero.headline.length - 1 ? ' class="is-accent"' : ""}>${escapeHtml(line)}</span>`).join(" ");
  const reasons = record.reasons.items
    .map((item) => `<a class="home-reason trace-surface" href="${escapeHtml(item.href)}"><span>${escapeHtml(item.number)}</span><div class="home-reason-principle"><small>Principle</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></div><div class="home-reason-result"><small>Practical result</small><b>${escapeHtml(item.benefit)}</b></div></a>`)
    .join("");
  const inspection = record.inspection.items
    .map((item) => `<article><code>${escapeHtml(item.name)}</code><p>${escapeHtml(item.body)}</p></article>`)
    .join("");
  const adoptionActions = record.adoption.actions
    .map((action) => action.style === "text"
      ? `<a class="text-link" href="${escapeHtml(action.href)}">${escapeHtml(action.label)} <span aria-hidden="true">-&gt;</span></a>`
      : `<a class="button${action.style === "secondary" ? " secondary" : ""}" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>`)
    .join("");
  const packageLanes = packageRecords
    .filter((item) => item.publicness === "public" && item.status === "active")
    .map((item) => {
      const copy = packageRuntimeCopy.get(item.package);
      return `<a class="package-lane" href="${escapeHtml(packageDocsHrefById.get(item.package))}"><span>${escapeHtml(item.title)}</span><code class="package-name-command">${escapeHtml(item.package_name)}</code><code class="install-command">${escapeHtml(copy.install)}</code><small>Enter ${escapeHtml(item.title)} docs</small></a>`;
    })
    .join("");
  const causalMessages = [
    ["START", "start"],
    ["DIRTY", "dirty"],
    ["DATA", "data"],
    ["COMPLETE", "complete"],
  ].map(([label, type]) => `<span class="causal-protocol-message causal-protocol-message-${type}" data-protocol-message><i></i><b>${label}</b></span>`).join("");
  const diamondMessages = ["dirty", "data"]
    .flatMap((type) => ["out", "in"].flatMap((leg) => [0, 1, 2].map((index) => `<span class="causal-diamond-message causal-diamond-message-${type}" data-diamond-message data-message-type="${type}" data-message-leg="${leg}" data-message-index="${index}"><i></i><b>${type.toUpperCase()}</b></span>`)))
    .join("");
  const causalFlow = `<div class="causal-flow" aria-hidden="true">
        <svg class="causal-flow-map" preserveAspectRatio="none">
          <path class="causal-flow-rail" data-causal-rail />
          <path class="causal-flow-progress" data-causal-progress />
          <g class="causal-flow-branches" data-causal-branches></g>
          <g class="causal-flow-masks" data-causal-masks></g>
          <g class="causal-flow-branch-progress" data-causal-branch-progress></g>
        </svg>
        <div class="causal-flow-nodes" data-causal-nodes></div>
        <div class="causal-protocol-messages">${causalMessages}</div>
        <div class="causal-diamond-messages">${diamondMessages}</div>
        <div class="causal-flow-spark" data-causal-spark><i></i></div>
      </div>`;
  const main = `<main class="home-page" data-causal-flow>
      <section class="focus-hero" data-flow-label="EXECUTABLE GRAPH" data-flow-detail="The graph is the system" data-flow-side="right" data-flow-x="0.79" data-flow-y="0.72">
        <p class="hero-equation" aria-label="Graph plus Reactive equals Fly"><span>Graph</span><b>+</b><span>Re<i>[active]</i></span><b>=</b><em>Fly</em></p>
        <div class="flow-section-content">
          <p class="hero-meta">${escapeHtml(record.hero.meta)}</p>
          <h1>${headline}</h1>
          <p class="focus-hero-body">${escapeHtml(record.hero.body)}</p>
          <div class="hero-actions"><a class="button" href="${escapeHtml(record.hero.primary_action.href)}">${escapeHtml(record.hero.primary_action.label)} <span aria-hidden="true">-&gt;</span></a><a class="button secondary" href="${escapeHtml(record.hero.secondary_action.href)}">${escapeHtml(record.hero.secondary_action.label)}</a></div>
          <p class="focus-category">${escapeHtml(record.hero.category)}</p>
        </div>
      </section>
      <section class="band focus-example" id="causal-walkthrough" data-flow-label="${escapeHtml(record.example.eyebrow)}" data-flow-detail="One cause through registered paths" data-flow-side="left" data-flow-x="0.18" data-flow-node-y="92">
        <div class="flow-section-content">
          <div class="home-section-heading trace-surface"><h2>${escapeHtml(record.example.heading)}</h2><p>${escapeHtml(record.example.intro)}</p></div>
          <div class="focus-example-grid">
            <div class="focus-example-copy trace-surface"><div class="focus-example-contrast"><div><span>The risk</span><p>${escapeHtml(record.example.problem)}</p></div><div><span>The graph behavior</span><p>${escapeHtml(record.example.solution)}</p></div></div></div>
            ${renderHomeShowcase(record.example)}
          </div>
        </div>
      </section>
      <section class="band home-reasons" data-flow-label="${escapeHtml(record.reasons.eyebrow)}" data-flow-detail="A delivery address fans out" data-flow-side="left" data-flow-x="0.17" data-flow-pattern="diamond" data-flow-branches="${escapeHtml(record.example.branches.map((branch) => branch.label).join("|"))}">
        <div class="flow-section-content">
          <div class="home-section-heading trace-surface"><h2>${escapeHtml(record.reasons.heading)}</h2></div>
          <div class="home-reason-grid">${reasons}</div>
        </div>
      </section>
      <section class="band home-inspect-system" data-flow-label="INSPECT THE SYSTEM" data-flow-detail="Read-only evidence from the graph" data-flow-side="right" data-flow-x="0.79" data-flow-node-y="96">
        <div class="flow-section-content">
          <div class="home-section-heading trace-surface"><h2>${escapeHtml(record.inspection.heading)}</h2></div>
          <div class="home-inspect-layout">
            <div class="home-inspect-intro trace-surface"><p>${escapeHtml(record.inspection.intro)}</p><strong>${escapeHtml(record.evidence.heading)}</strong></div>
            <div class="inspection-list trace-surface">${inspection}</div>
          </div>
        </div>
      </section>
      <section class="band home-start-boundary" data-flow-label="START AT A BOUNDARY" data-flow-detail="One bounded result returns as facts" data-flow-side="left" data-flow-x="0.21" data-flow-node-y="96">
        <div class="flow-section-content">
          <div class="home-section-heading trace-surface"><h2>Start where coordination becomes unclear.</h2></div>
          <div class="home-boundary-grid">
            <article class="home-module home-module-boundary trace-surface"><span>Boundary rule</span><h3>${escapeHtml(record.boundary.heading)}</h3><p>${escapeHtml(record.boundary.body)}</p><strong>${escapeHtml(record.boundary.callout)}</strong></article>
            <article class="home-module home-module-start trace-surface"><span>Starting point</span><h3>${escapeHtml(record.adoption.heading)}</h3><p>${escapeHtml(record.adoption.body)}</p><div class="home-adoption-actions">${adoptionActions}</div></article>
          </div>
        </div>
      </section>
      <section class="band package-section" id="package-routes" data-flow-label="${escapeHtml(record.packages.eyebrow)}" data-flow-detail="TypeScript, Python, Rust" data-flow-side="left" data-flow-x="0.21" data-flow-node-y="94">
        <div class="flow-section-content">
          <div class="home-section-heading trace-surface"><h2>${escapeHtml(record.packages.heading)}</h2><p>${escapeHtml(record.packages.intro)}</p></div>
          <div class="package-lanes">${packageLanes}</div>
        </div>
      </section>
      ${causalFlow}
    </main>`;
  writeFileSync(join(distDir, "index.html"), renderDocument({
    title: record.title,
    description: record.description,
    routeName: "",
    pathPrefix: "",
    footerSource: "guide/site.jsonl",
    main,
  }));
}

function renderWhySection(section) {
  const paragraphs = section.body.length
    ? `<div class="why-brief">${section.body.map((paragraph, index) => `<p class="why-sentence why-sentence-${index === 0 ? "lead" : "support"}">${escapeHtml(paragraph)}</p>`).join("")}</div>`
    : "";
  const table = section.table
    ? `<div class="why-table-wrap why-evidence-table"><table><caption>How each representation can drift from execution</caption><thead><tr>${section.table.columns.map((column) => `<th scope="col">${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${section.table.rows.map((row) => `<tr><th scope="row">${escapeHtml(row[0])}</th>${row.slice(1).map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
    : "";
  const example = section.example
    ? `<div class="why-contrast why-comparison">${section.example.label ? `<p class="why-example-label">${escapeHtml(section.example.label)}</p>` : ""}<div><span>${escapeHtml(section.example.without_label)}</span><p>${escapeHtml(section.example.without)}</p></div><div><span>${escapeHtml(section.example.with_label)}</span><p>${escapeHtml(section.example.with)}</p></div></div>`
    : "";
  const bullets = section.bullets
    ? `<ul class="why-start-list why-parallel-list">${section.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
  return `<article class="why-record why-layout-${section.table ? "table" : section.example ? "contrast" : "prose"}" id="${escapeHtml(section.id)}"><div class="why-mark"><span>${escapeHtml(section.mark)}</span></div><div class="why-copy"><h2>${escapeHtml(section.heading)}</h2>${paragraphs}${table}${example}${bullets}${section.callout ? `<p class="why-payoff why-punchline">${escapeHtml(section.callout)}</p>` : ""}${section.after ? `<p class="why-after">${escapeHtml(section.after)}</p>` : ""}</div></article>`;
}

function renderWhy(record) {
  const index = record.sections
    .map((item, position) => `<a href="#${escapeHtml(item.id)}"${position === 0 ? ' aria-current="true"' : ""}><span>${String(position + 1).padStart(2, "0")}</span><b>${escapeHtml(item.index_title)}</b></a>`)
    .join("");
  const argumentsHtml = record.sections.map(renderWhySection).join("");
  const actions = record.coda.actions
    .map((action) => `<a class="button${action.style === "secondary" ? " secondary" : ""}" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>`)
    .join("");
  const main = `<main class="why-page" data-why-flow>
      <section class="why-hero"><p class="eyebrow">${escapeHtml(record.hero.eyebrow)}</p><h1>${escapeHtml(record.hero.heading)}</h1><p>${escapeHtml(record.hero.body)}</p></section>
      <section class="why-board"><nav class="why-index" aria-label="Why page index"><i aria-hidden="true"></i><p>${escapeHtml(record.index_label)}</p>${index}</nav><section class="why-ledger" aria-label="Why GraphReFly arguments">${argumentsHtml}</section></section>
      <section class="why-coda"><p class="eyebrow">${escapeHtml(record.coda.eyebrow)}</p><h2>${escapeHtml(record.coda.heading)}</h2><p>${escapeHtml(record.coda.body)}</p><div class="route-actions">${actions}</div></section>
    </main>`;
  const outDir = join(distDir, "why");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), renderDocument({
    title: record.title,
    description: record.description,
    routeName: "why",
    footerSource: "guide/site.jsonl",
    main,
  }));
}

function copyIfPresent(from, to) {
  if (!existsSync(from)) return false;
  cpSync(from, to, { recursive: true });
  return true;
}

function copySiteAssets() {
  const admittedEntries = new Set(["scripts", "styles"]);
  for (const name of readdirSync(srcDir)) {
    if (!admittedEntries.has(name)) {
      throw new Error(`website/src contains unadmitted source entry ${name}; add an explicit build policy before publishing it`);
    }
  }
  copyIfPresent(join(srcDir, "scripts"), join(distDir, "scripts"));
  copyIfPresent(join(srcDir, "styles"), join(distDir, "styles"));
  for (const file of walk(srcDir)) {
    if (file.endsWith(".html")) {
      throw new Error(`${relative(repoRoot, file)} is a static HTML source; render public pages from structured records instead`);
    }
  }
}

assertCleanSource();
const learnRecords = parseJsonl(learnRecordsPath);
const conceptsRecords = parseJsonl(conceptsRecordsPath);
const compositionRecords = parseJsonl(compositionRecordsPath);
const packageRecords = parseJsonl(packageRecordsPath);
const referenceRecords = parseJsonl(referenceRecordsPath);
const blogRecords = parseJsonl(blogRecordsPath);
const siteRecords = parseJsonl(siteRecordsPath);
const guideRegistryRecords = parseJsonl(guideRegistryPath);
const decisionRecords = parseJsonl(decisionRecordsPath);
const ruleRecords = parseJsonl(ruleRecordsPath);
const conformanceRecords = parseJsonl(conformanceRecordsPath);
const protocolRecords = protocolRecordsFromAuthority({ decisionRecords, ruleRecords, conformanceRecords });
assertGuideRegistry(guideRegistryRecords);
assertPublicGuideRecords(learnRecords, "guide/learn.jsonl", { area: "learn", route: "/learn" });
assertProtocolRecords(protocolRecords);
assertPublicGuideRecords(conceptsRecords, "guide/concepts.jsonl", { area: "concepts", route: "/concepts" });
assertPublicGuideRecords(compositionRecords, "guide/composition.jsonl", { area: "composition", route: "/composition" });
assertPackageEntryRecords(packageRecords);
assertPublicGuideRecords(referenceRecords, "guide/reference.jsonl", { area: "reference", route: "/reference" });
assertPublicReferenceRecords(referenceRecords);
assertBlogRecords(blogRecords);
assertSiteRecords(siteRecords);
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
copySiteAssets();
copyIfPresent(publicDir, distDir);
assertCnameArtifact();

renderHome(siteRecords.find((record) => record.route === "/"), packageRecords);
renderWhy(siteRecords.find((record) => record.route === "/why"));

renderGuidePage(learnRecords, "learn", {
  title: "Learn GraphReFly",
  eyebrow: "Start here",
  heading: "See the graph before the syntax.",
  intro: "Begin with three questions: what can change, what depends on it, and where should the result leave the graph? Then choose a language for runnable code.",
  footerSource: "guide/learn.jsonl",
});
renderProtocol(protocolRecords);
renderGuidePage(conceptsRecords, "concepts", {
  title: "GraphReFly Concepts",
  eyebrow: "Concepts",
  heading: "Three ideas explain most of GraphReFly.",
  intro: "A graph shows the relationships. A wave keeps one change coherent. A boundary makes outside work explicit.",
  footerSource: "guide/concepts.jsonl",
});
renderComposition(compositionRecords);
renderPackages(packageRecords);
renderReference(referenceRecords);
renderBlog(blogRecords);

mkdirSync(checkMetaDir, { recursive: true });
writePublicContentReport({ siteRecords, learnRecords, protocolRecords, conceptsRecords, compositionRecords, packageRecords, referenceRecords, blogRecords });
assertRenderedPublicSurface();

console.log(`[website] built ${relative(repoRoot, distDir)}`);
