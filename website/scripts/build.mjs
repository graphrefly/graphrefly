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
const dashboardOut = join(distDir, "status");
const publicContentReportOut = join(dashboardOut, "public-content-report.json");
const learnRecordsPath = join(repoRoot, "guide", "learn.jsonl");
const conceptsRecordsPath = join(repoRoot, "guide", "concepts.jsonl");
const compositionRecordsPath = join(repoRoot, "guide", "composition.jsonl");
const examplesRecordsPath = join(repoRoot, "guide", "examples.jsonl");
const packageRecordsPath = join(repoRoot, "guide", "packages.jsonl");
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
  "composition",
  "concepts",
  "examples",
  "index.html",
  "learn",
  "packages",
  "py",
  "reference",
  "rust",
  "scripts",
  "status",
  "styles",
  "ts",
]);
const primaryNav = [
  ["Learn", "/learn"],
  ["Concepts", "/concepts"],
  ["Composition", "/composition"],
  ["Examples", "/examples"],
  ["Packages", "/packages"],
  ["Reference", "/reference"],
];
const internalRouteNames = new Set(["decisions", "guide", "maintainers", "spec"]);

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

function assertPackageRefs(record) {
  for (const pkg of record.package_refs ?? []) {
    const expectedRoute = packageRouteById.get(pkg.package);
    if (!expectedRoute) {
      throw new Error(`${record.id} package ref ${pkg.label ?? pkg.package} must use ts, py, or rust`);
    }
    const href = typeof pkg.href === "string" ? pkg.href.replace(/\/$/, "") : "";
    if (href !== expectedRoute) {
      throw new Error(`${record.id} package ref ${pkg.label ?? pkg.package} must delegate to ${expectedRoute}/, got ${pkg.href}`);
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
  for (const match of fragment.matchAll(/\s(href|src)="([^"]+)"/g)) {
    attrs.push({ name: match[1], value: match[2] });
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
    if (topLevel === "status" && rel !== "status/dashboard.html") {
      throw new Error(`${relative(repoRoot, htmlFile)} may link only to status/dashboard.html, got ${attr.value}`);
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

function assertPrimaryNav(htmlFile, html) {
  const navMatch = html.match(/<nav class="nav" aria-label="Primary">([\s\S]*?)<\/nav>/);
  if (!navMatch) {
    throw new Error(`${relative(repoRoot, htmlFile)} is missing primary nav`);
  }
  const links = [...navMatch[1].matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map((match) => {
    const target = resolveLocalRef(htmlFile, match[1]);
    const rel = target ? relative(distDir, target).replace(/\/index\.html$/, "") : match[1];
    return [match[2], `/${rel}`];
  });
  if (JSON.stringify(links) !== JSON.stringify(primaryNav)) {
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
    h1: textFromHtml(html, /<h1>([\s\S]*?)<\/h1>/),
    source_label: textFromHtml(html, /<footer[\s\S]*?<span>([\s\S]*?)<\/span>/),
    dashboard_link: dashboardLinks.length === 1 ? "footer-only" : "none",
    package_route_links: [...new Set(packageRouteLinks)].sort(),
    outbound_package_links: [...new Set(outboundPackageLinks)].sort(),
  };
}

function refsForRecord(record) {
  const refs = record.refs ?? {};
  return {
    decisions: refs.decisions ?? [],
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
    if (page.dashboard_link !== "footer-only") {
      throw new Error(`public content report page ${page.route} lost footer-only dashboard status`);
    }
    if (page.source_kind === "jsonl" && (!page.source_jsonl || page.record_ids.length === 0)) {
      throw new Error(`public content report page ${page.route} must include source_jsonl and records`);
    }
    if (page.source_jsonl && !page.source_label.includes(page.source_jsonl)) {
      throw new Error(`public content report page ${page.route} source label must mention ${page.source_jsonl}`);
    }
  }
  const packagePages = report.pages.filter((page) => ["/packages/", "/ts/", "/py/", "/rust/"].includes(page.route));
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
  const merged = { decisions: new Set(), rules: new Set(), conformance: new Set(), sources: new Set() };
  for (const record of records) {
    const refs = refsForRecord(record);
    for (const key of Object.keys(merged)) {
      for (const value of refs[key]) merged[key].add(value);
    }
  }
  return Object.fromEntries(Object.entries(merged).map(([key, values]) => [key, [...values].sort()]));
}

function writePublicContentReport({ learnRecords, conceptsRecords, compositionRecords, examplesRecords, packageRecords, referenceRecords }) {
  const renderedPages = walk(distDir)
    .filter((item) => item.endsWith(".html") && !relative(distDir, item).startsWith("status/"))
    .map(renderedPageSummary)
    .sort((a, b) => a.route.localeCompare(b.route));
  const guideRecordsByRoute = new Map([
    ["/learn/", { sourceJsonl: "guide/learn.jsonl", records: learnRecords.filter((record) => record.publicness === "public" && record.status === "active") }],
    ["/concepts/", { sourceJsonl: "guide/concepts.jsonl", records: conceptsRecords.filter((record) => record.publicness === "public" && record.status === "active") }],
    ["/composition/", { sourceJsonl: "guide/composition.jsonl", records: compositionRecords.filter((record) => record.publicness === "public" && record.status === "active") }],
    ["/examples/", { sourceJsonl: "guide/examples.jsonl", records: examplesRecords.filter((record) => record.publicness === "public" && record.status === "active") }],
    ["/reference/", { sourceJsonl: "guide/reference.jsonl", records: referenceRecords.filter((record) => record.publicness === "public" && record.status === "active") }],
  ]);
  for (const record of packageRecords.filter((item) => item.publicness === "public" && item.status === "active")) {
    guideRecordsByRoute.set(`${record.route}/`, { sourceJsonl: "guide/packages.jsonl", records: [record] });
  }
  guideRecordsByRoute.set("/packages/", { sourceJsonl: "guide/packages.jsonl", records: packageRecords.filter((item) => item.publicness === "public" && item.status === "active") });

  const pages = renderedPages.map((page) => {
    const source = guideRecordsByRoute.get(page.route);
    return {
      ...page,
      source_jsonl: source?.sourceJsonl ?? null,
      source_kind: source ? "jsonl" : "static",
      record_ids: source?.records.map((record) => record.id) ?? [],
      provenance: source ? mergeRefs(source.records) : { decisions: [], rules: [], conformance: [], sources: [] },
    };
  });

  const report = {
    kind: "graphrefly-public-content-corpus",
    generated_at: new Date().toISOString(),
    policy: {
      primary_nav: primaryNav.map(([label, route]) => ({ label, route })),
      public_routes: [...publicRoutes].sort(),
      package_routes: [...packageRoutes].sort(),
      internal_routes_blocked: [...internalRouteNames].sort(),
      dashboard_link_policy: "footer-only status/dashboard.html",
      package_api_policy: "delegate",
    },
    pages,
    public_records: [
      ...learnRecords.filter((record) => record.publicness === "public" && record.status === "active").map((record) => publicRecordSummary(record, "guide/learn.jsonl")),
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

function assertDashboardFooterOnly(htmlFile, html) {
  const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
  const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? "";
  if (/status\/dashboard\.html/.test(`${header}\n${main}`)) {
    throw new Error(`${relative(repoRoot, htmlFile)} exposes dashboard outside the footer`);
  }
  const footer = html.match(/<footer[\s\S]*?<\/footer>/)?.[0] ?? "";
  const dashboardLinks = [...html.matchAll(/status\/dashboard\.html/g)].length;
  if (dashboardLinks > 1 || (dashboardLinks === 1 && !/status\/dashboard\.html/.test(footer))) {
    throw new Error(`${relative(repoRoot, htmlFile)} must keep the dashboard link footer-only`);
  }
}

function assertRenderedPublicSurface() {
  for (const name of readdirSync(distDir)) {
    if (!publicTopLevelEntries.has(name)) {
      throw new Error(`website dist exposes unexpected top-level public entry ${name}`);
    }
  }

  const statusFiles = new Set(readdirSync(dashboardOut));
  for (const name of statusFiles) {
    if (!["dashboard.html", "dashboard.css", "dashboard.js", "public-content-report.json"].includes(name)) {
      throw new Error(`status route exposes unexpected dashboard artifact ${name}`);
    }
  }

  for (const file of walk(distDir).filter((item) => item.endsWith(".html"))) {
    const rel = relative(distDir, file);
    if (rel.startsWith("status/")) continue;
    const html = readFileSync(file, "utf8");
    assertLocalRefsExist(file, html);
    assertNoInternalRouteLinks(file, html);
    assertPrimaryNav(file, html);
    assertDashboardFooterOnly(file, html);
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

function renderEntryLinks(links = []) {
  if (!links.length) return "";
  return `<div class="entry-link-list">${links.map((link) => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`).join("")}</div>`;
}

function renderPackageCards(records) {
  return records
    .filter((record) => record.publicness === "public" && record.status === "active")
    .map((record) => {
      const route = routeHref(`${record.route}/`, "packages");
      const links = renderEntryLinks(record.entry_links);
      return `<article class="composition-record package-record"><h2>${escapeHtml(record.title)}</h2><section class="composition-section"><h3>Package</h3><div><p>${escapeHtml(record.package_name)}</p></div></section><section class="composition-section"><h3>Ownership</h3><div><p>${escapeHtml(record.public_summary)}</p></div></section><section class="composition-section"><h3>Open</h3><div><a href="${escapeHtml(route)}">Package route</a></div></section><section class="composition-section"><h3>Package Links</h3><div>${links}</div></section></article>`;
    })
    .join("");
}

function renderPackageDetail(record) {
  const sections = record.public_sections
    .map((section) => {
      const body = section.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
      return `<section class="composition-section"><h3>${escapeHtml(section.heading)}</h3><div>${body}${renderList(section.bullets)}</div></section>`;
    })
    .join("");
  const links = renderEntryLinks(record.entry_links);
  return `<article class="composition-record package-record"><h2>${escapeHtml(record.package_name)}</h2><section class="composition-section"><h3>Delegated Docs</h3><div><p>${escapeHtml(record.public_summary)}</p></div></section>${sections}<section class="composition-section"><h3>Package-Owned Links</h3><div>${links}</div></section></article>`;
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

function renderPackages(records) {
  const outDir = join(distDir, "packages");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), pageShell({
    title: "GraphReFly Packages",
    eyebrow: "Packages",
    heading: "Language docs are delegated, not mirrored.",
    intro: "Each implementation owns generated API reference, examples, demos, package release notes, and install flow. This shared site records the entry points and keeps cross-language concepts here.",
    footerSource: "guide/packages.jsonl",
    routeName: "packages",
    cards: renderPackageCards(records),
  }));

  for (const record of records.filter((item) => item.publicness === "public" && item.status === "active")) {
    const routeName = record.route.replace(/^\/+/, "");
    const routeDir = join(distDir, routeName);
    mkdirSync(routeDir, { recursive: true });
    writeFileSync(join(routeDir, "index.html"), pageShell({
      title: `GraphReFly ${record.title} Docs`,
      eyebrow: "Package",
      heading: record.title,
      intro: `${record.package_name} docs stay package-local. This route is a delegation page with package-owned links, not a generated API mirror.`,
      footerSource: "guide/packages.jsonl",
      routeName,
      cards: renderPackageDetail(record),
    }));
  }
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
assertGuideRegistry(guideRegistryRecords);
assertPublicGuideRecords(learnRecords, "guide/learn.jsonl");
assertPublicGuideRecords(conceptsRecords, "guide/concepts.jsonl");
assertPublicGuideRecords(compositionRecords, "guide/composition.jsonl");
assertPublicGuideRecords(examplesRecords, "guide/examples.jsonl");
assertPackageEntryRecords(packageRecords);
assertPublicGuideRecords(referenceRecords, "guide/reference.jsonl");
assertPublicReferenceRecords(referenceRecords);
execFileSync(process.execPath, [join(dashboardDir, "build.mjs")], { cwd: repoRoot, stdio: "inherit" });
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
copyIfPresent(srcDir, distDir);
copyIfPresent(publicDir, distDir);
copyPublicRoutes();

renderGuidePage(learnRecords, "learn", {
  title: "Learn GraphReFly",
  eyebrow: "Learn",
  heading: "Build a declared reactive graph.",
  intro: "A language-neutral first path: understand the topology, then jump to TypeScript, Python, or Rust for runnable syntax.",
  footerSource: "guide/learn.jsonl",
});
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

mkdirSync(dashboardOut, { recursive: true });
for (const name of ["dashboard.html", "dashboard.css", "dashboard.js"]) {
  const from = join(dashboardDir, name);
  if (!existsSync(from)) {
    throw new Error(`missing dashboard artifact: ${relative(repoRoot, from)}`);
  }
  cpSync(from, join(dashboardOut, name));
}

writePublicContentReport({ learnRecords, conceptsRecords, compositionRecords, examplesRecords, packageRecords, referenceRecords });
assertRenderedPublicSurface();

console.log(`[website] built ${relative(repoRoot, distDir)}`);
