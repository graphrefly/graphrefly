import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(root);
const srcDir = join(root, "src");
const publicDir = join(root, "public");
const distDir = join(root, "dist");
const dashboardDir = join(repoRoot, "dashboard");
const publicMetaDir = join(distDir, "_meta");
const publicContentReportOut = join(publicMetaDir, "public-content-report.json");
const publicCnamePath = join(publicDir, "CNAME");
const distCnamePath = join(distDir, "CNAME");
const learnRecordsPath = join(repoRoot, "guide", "learn.jsonl");
const conceptsRecordsPath = join(repoRoot, "guide", "concepts.jsonl");
const compositionRecordsPath = join(repoRoot, "guide", "composition.jsonl");
const examplesRecordsPath = join(repoRoot, "guide", "examples.jsonl");
const packageRecordsPath = join(repoRoot, "guide", "packages.jsonl");
const referenceRecordsPath = join(repoRoot, "guide", "reference.jsonl");
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
  "/examples",
  "/packages",
  "/reference",
]);
const packageRoutes = new Set();
const expectedSourceJsonlByRoute = new Map([
  ["/protocol/", protocolAuthoritySource],
  ["/learn/", "guide/learn.jsonl"],
  ["/concepts/", "guide/concepts.jsonl"],
  ["/composition/", "guide/composition.jsonl"],
  ["/examples/", "guide/examples.jsonl"],
  ["/packages/", "guide/packages.jsonl"],
  ["/reference/", "guide/reference.jsonl"],
]);
const packageRouteById = new Map([
  ["ts", "/ts"],
  ["py", "/py"],
  ["rust", "/rust"],
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
  "examples",
  "index.html",
  "learn",
  "packages",
  "protocol",
  "reference",
  "scripts",
  "styles",
  "why",
  "_meta",
]);
const staticPublicRoutes = new Set(["/blog/", "/why/"]);
const primaryNav = [
  { label: "Why", route: "/why" },
  { label: "Protocol", route: "/protocol" },
  { label: "Packages", route: "/packages" },
  { label: "Blog", route: "/blog" },
  { label: "GitHub", href: "https://github.com/graphrefly" },
];
const packageDocsHrefById = new Map([
  ["ts", "https://graphrefly.dev/ts/"],
  ["py", "https://graphrefly.dev/py/"],
  ["rust", "https://docs.rs/graphrefly-rs/"],
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
    const publicText = collectPublicReferenceText(record);
    for (const pattern of referenceTextBanned) {
      if (pattern.test(publicText)) {
        throw new Error(`reference record ${record.id} contains raw/internal public text matching ${pattern}`);
      }
    }
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

function assertPublicContentReport(report) {
  if (report.kind !== "graphrefly-public-content-corpus") {
    throw new Error("public content report has the wrong kind");
  }
  const expectedRoutes = new Set(["/", ...[...publicRoutes].map((route) => `${route}/`)]);
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
    } else if (page.route !== "/" && !staticPublicRoutes.has(page.route) && page.source_kind !== "jsonl") {
      throw new Error(`public content report page ${page.route} must be sourced from guide JSONL`);
    }
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

function writePublicContentReport({ learnRecords, protocolRecords, conceptsRecords, compositionRecords, examplesRecords, packageRecords, referenceRecords }) {
  const renderedPages = walk(distDir)
    .filter((item) => item.endsWith(".html") && !relative(distDir, item).startsWith("status/"))
    .map(renderedPageSummary)
    .sort((a, b) => a.route.localeCompare(b.route));
  const guideRecordsByRoute = new Map([
    ["/protocol/", { sourceJsonl: protocolAuthoritySource, records: protocolRecords.filter((record) => record.publicness === "public" && record.status === "active") }],
    ["/learn/", { sourceJsonl: "guide/learn.jsonl", records: learnRecords.filter((record) => record.publicness === "public" && record.status === "active") }],
    ["/concepts/", { sourceJsonl: "guide/concepts.jsonl", records: conceptsRecords.filter((record) => record.publicness === "public" && record.status === "active") }],
    ["/composition/", { sourceJsonl: "guide/composition.jsonl", records: compositionRecords.filter((record) => record.publicness === "public" && record.status === "active") }],
    ["/examples/", { sourceJsonl: "guide/examples.jsonl", records: examplesRecords.filter((record) => record.publicness === "public" && record.status === "active") }],
    ["/reference/", { sourceJsonl: "guide/reference.jsonl", records: referenceRecords.filter((record) => record.publicness === "public" && record.status === "active") }],
  ]);
  guideRecordsByRoute.set("/packages/", { sourceJsonl: "guide/packages.jsonl", records: packageRecords.filter((item) => item.publicness === "public" && item.status === "active") });

  const pages = renderedPages.map((page) => {
    const source = guideRecordsByRoute.get(page.route);
    return {
      ...page,
      source_jsonl: source?.sourceJsonl ?? null,
      source_kind: source ? "jsonl" : "static",
      record_ids: source?.records.map((record) => record.id) ?? [],
      provenance: source ? mergeRefs(source.records) : { rules: [], conformance: [], sources: [] },
    };
  });

  const report = {
    kind: "graphrefly-public-content-corpus",
    generated_at: new Date().toISOString(),
    policy: {
      primary_nav: primaryNav.map((item) => ({ label: item.label, route: item.route ?? item.href })),
      public_routes: [...publicRoutes].sort(),
      package_routes: [...packageRoutes].sort(),
      dashboard_link_policy: "isolated: no public dashboard links",
      package_api_policy: "delegate",
    },
    pages,
    public_records: [
      ...learnRecords.filter((record) => record.publicness === "public" && record.status === "active").map((record) => publicRecordSummary(record, "guide/learn.jsonl")),
      ...protocolRecords.filter((record) => record.publicness === "public" && record.status === "active").map((record) => publicRecordSummary(record, protocolAuthoritySource)),
      ...conceptsRecords.filter((record) => record.publicness === "public" && record.status === "active").map((record) => publicRecordSummary(record, "guide/concepts.jsonl")),
      ...compositionRecords.filter((record) => record.publicness === "public" && record.status === "active").map((record) => publicRecordSummary(record, "guide/composition.jsonl")),
      ...examplesRecords.filter((record) => record.publicness === "public" && record.status === "active").map((record) => publicRecordSummary(record, "guide/examples.jsonl")),
      ...referenceRecords.filter((record) => record.publicness === "public" && record.status === "active").map((record) => publicRecordSummary(record, "guide/reference.jsonl")),
    ],
    package_entries: packageRecords
      .filter((record) => record.publicness === "public" && record.status === "active")
      .map(packageEntrySummary),
  };

  assertPublicContentReport(report);
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

function renderPrimaryNav(routeName) {
  const activeRoute = `/${routeName}`;
  return primaryNav
    .map((item) => {
      if (item.href) {
        return `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`;
      }
      const route = item.route;
      const href = `../${route.replace(/^\/+/, "")}/index.html`;
      const current = route === activeRoute ? ' aria-current="page"' : "";
      return `<a href="${escapeHtml(href)}"${current}>${escapeHtml(item.label)}</a>`;
    })
    .join("");
}

function renderHeader(routeName) {
  return `<header class="site-header"><a class="brand" href="../index.html"><span class="brand-word">Graph<span>ReFly</span></span></a><nav class="nav" aria-label="Primary">${renderPrimaryNav(routeName)}</nav></header>`;
}

function renderFooter(footerSource) {
  return `<footer class="site-footer rich-footer" data-source="${escapeHtml(footerSource)}"><div class="footer-brand">GraphReFly<small>Reactive Graph Protocol</small></div><div class="footer-links" aria-label="Footer links"><div><b>Site</b><a href="../why/index.html">Why</a><a href="../protocol/index.html">Protocol</a><a href="../packages/index.html">Packages</a><a href="../blog/index.html">Blog</a></div><div><b>Packages</b><a href="https://graphrefly.dev/ts/">TypeScript</a><a href="https://graphrefly.dev/py/">Python</a><a href="https://docs.rs/graphrefly-rs/">Rust</a></div><div><b>Source</b><a href="https://github.com/graphrefly">GitHub organization</a><a href="../blog/index.html">Blog archive</a></div></div></footer>`;
}

function renderRecordCards(records, fromRoute) {
  return records
    .filter((record) => record.publicness === "public" && record.status === "active")
    .map((record) => {
      const packageLinks = (record.package_refs ?? [])
        .map((pkg) => `<a href="${escapeHtml(packageDocsHrefById.get(pkg.package) ?? routeHref(pkg.href, fromRoute))}">${escapeHtml(pkg.label)}</a>`)
        .join(" · ");
      const topology = Array.isArray(record.topology)
        ? `<section class="composition-section topology-strip"><h3>Topology</h3><div class="topology-pills">${record.topology.map((node) => `<span><b>${escapeHtml(node.role)}</b>${escapeHtml(node.label)}</span>`).join("")}</div></section>`
        : "";
      const learns = Array.isArray(record.learns) && record.learns.length
        ? `<section class="composition-section"><h3>Learns</h3><div class="topic-tags">${record.learns.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div></section>`
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
      return `<article class="composition-record record-card"><header class="record-card-head"><p>${escapeHtml(record.kind)}</p><h2>${escapeHtml(record.title)}</h2></header><section class="composition-section"><h3>Summary</h3><div><p>${escapeHtml(record.public_summary)}</p></div></section>${intent}${topology}${learns}${sections}<div class="record-meta"><span>Package docs: ${packageLinks}</span></div></article>`;
    })
    .join("");
}

function renderReferenceCards(records, fromRoute) {
  return records
    .filter((record) => record.publicness === "public" && record.status === "active")
    .map((record) => {
      const packageLinks = (record.package_refs ?? [])
        .map((pkg) => `<a href="${escapeHtml(packageDocsHrefById.get(pkg.package) ?? routeHref(pkg.href, fromRoute))}">${escapeHtml(pkg.label)}</a>`)
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
      return `<article class="composition-record reference-record record-card"><header class="record-card-head"><p>Guarantee</p><h2>${escapeHtml(record.title)}</h2></header><section class="composition-section"><h3>Public Promise</h3><div><p>${escapeHtml(record.public_summary)}</p></div></section>${sections}${learnMoreSection}<div class="record-meta"><span>Package docs: ${packageLinks}</span></div></article>`;
    })
    .join("");
}

function protocolAnchor(record) {
  return record.id.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
}

function protocolAreaAnchor(area) {
  return `protocol-area-${area.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;
}

function renderProtocolMeta(record) {
  const conformance = (record.conformance_records ?? [])
    .map((item) => {
      const runtimes = Object.entries(item.runtimes ?? {})
        .map(([runtime, status]) => `${runtime}:${status}`)
        .join(" · ");
      return `<li><span>${escapeHtml(item.id)}</span>${escapeHtml(item.name)}${runtimes ? `<small>${escapeHtml(runtimes)}</small>` : ""}</li>`;
    })
    .join("");
  const rows = [
    ["Area", record.area],
    ["Status", record.status],
    ["Since", record.since],
    ["Covers By", record.covers_by?.join(", ")],
  ].filter(([, value]) => value != null && String(value).length > 0);
  return `<dl class="protocol-authority-meta">${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>${conformance ? `<section class="protocol-conformance"><h3>Conformance</h3><ul>${conformance}</ul></section>` : ""}`;
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
  return `<article id="${escapeHtml(protocolAnchor(record))}" class="protocol-record protocol-record-${escapeHtml(record.area)}"><header class="protocol-record-head"><span>${String(record.display_order).padStart(2, "0")}</span><h3>${escapeHtml(record.id)}</h3>${renderProtocolMeta(record)}</header><div class="protocol-record-body"><section class="protocol-record-section statement"><h4>Statement</h4><p>${escapeHtml(record.statement)}</p></section></div></article>`;
}

function renderProtocolCards(records) {
  const publicRecords = records
    .filter((record) => record.publicness === "public" && record.status === "active")
    .sort((a, b) => a.display_order - b.display_order);
  const groups = protocolGroups(publicRecords);
  const map = groups
    .map((group) => `<li><a href="#${escapeHtml(protocolAreaAnchor(group.area))}"><span>${group.records.length}</span>${escapeHtml(group.area)}</a></li>`)
    .join("");
  const flow = groups
    .map((group) => `<section id="${escapeHtml(protocolAreaAnchor(group.area))}" class="protocol-area-group"><header class="protocol-area-head"><p>Area</p><h2>${escapeHtml(group.area)}</h2><span>${group.records.length} rules</span></header>${group.records.map(renderProtocolRule).join("")}</section>`)
    .join("");
  return `<div class="protocol-board"><aside class="protocol-map" aria-label="Protocol records"><p>Authority filter</p><dl><div><dt>Status</dt><dd>active</dd></div><div><dt>Records</dt><dd>${publicRecords.length}</dd></div><div><dt>Areas</dt><dd>${groups.length}</dd></div></dl><ol>${map}</ol></aside><div class="protocol-flow">${flow}</div></div>`;
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

function pageShell({ title, eyebrow, heading, intro, routeName, cards, footerSource }) {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(title)}</title><link rel="icon" href="../assets/favicon.svg" type="image/svg+xml" /><link rel="stylesheet" href="../styles/site.css" /></head>
  <body>
    ${renderHeader(routeName)}
    <main class="route-page composition-page route-${escapeHtml(routeName)}">
      <section class="route-hero">
        <p class="eyebrow">${escapeHtml(eyebrow)}</p>
        <h1>${escapeHtml(heading)}</h1>
        <p>${escapeHtml(intro)}</p>
      </section>
      <section class="composition-list">${cards}</section>
    </main>
    ${renderFooter(footerSource)}<script src="../scripts/site.js"></script>
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

function renderProtocol(records) {
  const outDir = join(distDir, "protocol");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), pageShell({
    title: "GraphReFly Protocol",
    eyebrow: "Protocol",
    heading: "Active protocol rules.",
    intro: "Mechanical filter: active authority rule records in wave, runtime, graph, node, and control areas. Conformance rows are resolved from covered scenarios with all runtimes passing.",
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
    eyebrow: "Reference",
    heading: "What developers can rely on.",
    intro: "These records summarize the stable behavior promises behind GraphReFly. Use them as a public map, then follow package docs for exact syntax.",
    footerSource: "guide/reference.jsonl",
    routeName: "reference",
    cards: renderReferenceCards(records, "reference"),
  }));
}

function renderPackages(records) {
  const outDir = join(distDir, "packages");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), pageShell({
    title: "GraphReFly Packages",
    eyebrow: "Packages",
    heading: "Choose your runtime.",
    intro: "Install a package, then open the language-owned docs for API details and examples.",
    footerSource: "guide/packages.jsonl",
    routeName: "packages",
    cards: renderPackageCards(records),
  }));
}

function renderComposition(records) {
  const publicRecords = records.filter((record) => record.publicness === "public" && record.status === "active");
  const cards = renderRecordCards(publicRecords, "composition");

  const html = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>GraphReFly Composition</title><link rel="icon" href="../assets/favicon.svg" type="image/svg+xml" /><link rel="stylesheet" href="../styles/site.css" /></head>
  <body>
    ${renderHeader("composition")}
    <main class="route-page composition-page route-composition">
      <section class="route-hero">
        <p class="eyebrow">Composition</p>
        <h1>Patterns for declared reactive graphs.</h1>
        <p>Use these public patterns to shape inputs, reductions, joins, lifecycle, and effects before jumping to package-specific syntax.</p>
      </section>
      <section class="composition-list">${cards}</section>
    </main>
    ${renderFooter("guide/composition.jsonl")}<script src="../scripts/site.js"></script>
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

function copyPublicRoutes() {
  const routesDir = join(distDir, "routes");
  if (!existsSync(routesDir)) return;
  for (const name of readdirSync(routesDir)) {
    if (publicRoutes.has(`/${name}`)) {
      cpSync(join(routesDir, name), join(distDir, name), { recursive: true });
    }
  }
  rmSync(routesDir, { recursive: true, force: true });
}

assertCleanSource();
const learnRecords = parseJsonl(learnRecordsPath);
const conceptsRecords = parseJsonl(conceptsRecordsPath);
const compositionRecords = parseJsonl(compositionRecordsPath);
const examplesRecords = parseJsonl(examplesRecordsPath);
const packageRecords = parseJsonl(packageRecordsPath);
const referenceRecords = parseJsonl(referenceRecordsPath);
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
assertPublicGuideRecords(examplesRecords, "guide/examples.jsonl", { area: "examples", route: "/examples" });
assertPackageEntryRecords(packageRecords);
assertPublicGuideRecords(referenceRecords, "guide/reference.jsonl", { area: "reference", route: "/reference" });
assertPublicReferenceRecords(referenceRecords);
execFileSync(process.execPath, [join(dashboardDir, "build.mjs")], { cwd: repoRoot, stdio: "inherit" });
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
copyIfPresent(srcDir, distDir);
copyIfPresent(publicDir, distDir);
copyPublicRoutes();
assertCnameArtifact();

renderGuidePage(learnRecords, "learn", {
  title: "Learn GraphReFly",
  eyebrow: "Learn",
  heading: "Build a declared reactive graph.",
  intro: "A language-neutral first path: understand the topology, then jump to TypeScript, Python, or Rust for runnable syntax.",
  footerSource: "guide/learn.jsonl",
});
renderProtocol(protocolRecords);
renderGuidePage(conceptsRecords, "concepts", {
  title: "GraphReFly Concepts",
  eyebrow: "Concepts",
  heading: "The graph is the coordination surface.",
  intro: "GraphReFly organizes work as inspectable topology: one graph owns one ordered concurrency domain, waves carry updates through declared edges, and async or remote work re-enters through explicit boundaries.",
  footerSource: "guide/concepts.jsonl",
});
renderComposition(compositionRecords);
renderGuidePage(examplesRecords, "examples", {
  title: "GraphReFly Examples",
  eyebrow: "Examples",
  heading: "Recipes that delegate to package code.",
  intro: "These examples describe intent and topology. Runnable examples, generated API docs, demos, install commands, and release material stay package-local.",
  footerSource: "guide/examples.jsonl",
});
renderPackages(packageRecords);
renderReference(referenceRecords);

mkdirSync(publicMetaDir, { recursive: true });
writePublicContentReport({ learnRecords, protocolRecords, conceptsRecords, compositionRecords, examplesRecords, packageRecords, referenceRecords });
assertRenderedPublicSurface();

console.log(`[website] built ${relative(repoRoot, distDir)}`);
