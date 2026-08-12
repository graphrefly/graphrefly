import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(root);
const distDir = join(root, "dist");
const statusDir = join(distDir, "status");
const reportPath = join(root, ".generated", "public-content-report.json");
const blogRecordsPath = join(repoRoot, "guide", "blog.jsonl");
const siteRecordsPath = join(repoRoot, "guide", "site.jsonl");
const packageRecordsPath = join(repoRoot, "guide", "packages.jsonl");
const referenceRecordsPath = join(repoRoot, "guide", "reference.jsonl");
const cnamePath = join(distDir, "CNAME");
const legacySharedRustDocsUrl = "https://graphrefly.dev" + "/rs";
const legacyRustPagesUrl = "https://graphrefly.github.io" + "/graphrefly-rs/";

const expectedRoutes = new Set([
  "/",
  "/protocol/",
  "/why/",
  "/blog/",
  "/learn/",
  "/concepts/",
  "/composition/",
  "/packages/",
  "/reference/",
]);
const packagePageRoutes = new Set(["/packages/"]);
const protocolAuthoritySource = "decisions/decisions.jsonl + spec/rules.jsonl + spec/conformance.jsonl";
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
const internalRouteNames = new Set(["decisions", "guide", "maintainers", "spec", "status"]);

function fail(message) {
  throw new Error(`[public-docs gate] ${message}`);
}

function run(label, args) {
  console.log(`[public-docs gate] ${label}`);
  execFileSync(process.execPath, args, { cwd: repoRoot, stdio: "inherit" });
}

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

function readJsonl(file) {
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        fail(`${relative(repoRoot, file)}:${index + 1} is invalid JSON: ${error.message}`);
      }
    });
}

function attrsFrom(html) {
  return [...html.matchAll(/\s(href|src)=(["'])(.*?)\2/g)].map((match) => ({ name: match[1], value: match[3] }));
}

function localTarget(htmlFile, href) {
  if (/^(https?:|mailto:|tel:|#)/.test(href)) return null;
  if (href.startsWith("/")) fail(`${relative(repoRoot, htmlFile)} uses root-relative URL ${href}`);
  const clean = href.split("#")[0].split("?")[0];
  const target = join(dirname(htmlFile), clean);
  const resolved = clean.endsWith("/") || !/\.[a-z0-9]+$/i.test(clean) ? join(target, "index.html") : target;
  const rel = relative(distDir, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) fail(`${relative(repoRoot, htmlFile)} links outside website dist: ${href}`);
  return resolved;
}

function assertNoStatusArtifacts() {
  if (existsSync(statusDir)) fail("public website dist must not expose internal status/dashboard artifacts");
}

function assertNoSharedRustRoute() {
  for (const name of ["rs", "rust"]) {
    if (existsSync(join(root, "src", "routes", name))) fail(`shared website source must not own /${name}`);
    if (existsSync(join(distDir, name))) fail(`public website dist must not publish /${name}`);
  }
}

function assertNoLegacyRustDocsUrl() {
  for (const file of walk(distDir).filter((item) => item.endsWith(".html") || item.endsWith(".json"))) {
    const rel = relative(distDir, file);
    if (rel.startsWith("status/")) continue;
    const text = readFileSync(file, "utf8");
    if (text.includes(`${legacySharedRustDocsUrl}/`) || text.includes(legacySharedRustDocsUrl)) {
      fail(`${relative(repoRoot, file)} still points to the legacy shared Rust docs URL`);
    }
    if (text.includes(legacyRustPagesUrl)) {
      fail(`${relative(repoRoot, file)} still points to the old Rust GitHub Pages rustdoc URL`);
    }
  }
}

function assertCnameArtifact() {
  if (!existsSync(cnamePath)) fail("public website dist must include CNAME");
  const value = readFileSync(cnamePath, "utf8").trim();
  if (value !== "graphrefly.dev") fail("public website dist CNAME must be graphrefly.dev");
}

function assertRenderedHtmlLinks() {
  for (const file of walk(distDir).filter((item) => item.endsWith(".html"))) {
    const rel = relative(distDir, file);
    if (rel.startsWith("status/")) continue;
    const html = readFileSync(file, "utf8");
    if (!html.includes('data-site-shell="public"')) {
      fail(`${relative(repoRoot, file)} was not rendered through the shared public shell`);
    }
    if (/(?:>|=")undefined(?:<|")|undefined\/index\.html/.test(html)) {
      fail(`${relative(repoRoot, file)} exposes a missing renderer value as undefined`);
    }
    for (const attr of attrsFrom(html)) {
      const target = localTarget(file, attr.value);
      if (!target) continue;
      if (!existsSync(target)) fail(`${relative(repoRoot, file)} has broken ${attr.name} ${attr.value}`);
      const targetRel = relative(distDir, target);
      const [topLevel] = targetRel.split("/");
      if (internalRouteNames.has(topLevel)) fail(`${relative(repoRoot, file)} links to internal route ${attr.value}`);
    }
    const dashboardLinks = [...html.matchAll(/status\/dashboard\.html/g)].length;
    if (dashboardLinks !== 0) {
      fail(`${relative(repoRoot, file)} links to the internal dashboard`);
    }
  }
}

function assertReport() {
  if (!existsSync(reportPath)) fail("missing website/.generated/public-content-report.json");
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  const sourceBlogRecords = readJsonl(blogRecordsPath);
  const sourceSiteRecords = readJsonl(siteRecordsPath);
  const sourcePackageRecords = readJsonl(packageRecordsPath);
  const sourceReferenceRecords = readJsonl(referenceRecordsPath);
  const sourcePublicBlogRecords = sourceBlogRecords.filter(
    (record) => record.kind === "post" && record.publicness === "public" && record.status === "active",
  );
  const sourcePublicBlogById = new Map(sourcePublicBlogRecords.map((record) => [record.id, record]));
  const sourceInternalBlogIds = new Set(
    sourceBlogRecords.filter((record) => !sourcePublicBlogById.has(record.id)).map((record) => record.id),
  );
  const sourceInternalRecordIds = new Set([
    ...sourceInternalBlogIds,
    ...sourceReferenceRecords.filter((record) => record.publicness !== "public" || record.status !== "active").map((record) => record.id),
  ]);
  const sourceSiteByRoute = new Map(sourceSiteRecords.map((record) => [record.route === "/" ? "/" : `${record.route}/`, record]));
  const expectedSiteIds = new Map([["/", "site.home"], ["/why/", "site.why"]]);
  if (sourceSiteRecords.length !== 2 || sourceSiteByRoute.size !== 2) {
    fail("guide/site.jsonl must contain exactly two records");
  }
  for (const [route, id] of expectedSiteIds) {
    const record = sourceSiteByRoute.get(route);
    const expectedKind = route === "/" ? "landing-page" : "narrative-page";
    if (record?.id !== id || record.area !== "site" || record.kind !== expectedKind || record.publicness !== "public" || record.status !== "active" || record.owner !== "graphrefly" || record.canonical_repo !== "graphrefly") {
      fail(`guide/site.jsonl must declare ${id} as the active public record for ${route}`);
    }
  }
  const rustRecord = sourcePackageRecords.find((record) => record.id === "package.rust");
  if (rustRecord?.route !== "https://rs.graphrefly.dev/" || rustRecord.canonical_repo !== "graphrefly-rs" || rustRecord.render_policy?.package_docs !== "delegate") {
    fail("guide/packages.jsonl must delegate Rust docs to https://rs.graphrefly.dev/");
  }
  for (const file of [join(distDir, "index.html"), join(distDir, "packages", "index.html")]) {
    const html = readFileSync(file, "utf8");
    const main = html.match(/<main\b[\s\S]*?<\/main>/)?.[0] ?? "";
    if (!main.includes('href="https://rs.graphrefly.dev/"')) {
      fail(`${relative(repoRoot, file)} main content must delegate Rust docs directly to rs.graphrefly.dev`);
    }
  }
  if (report.kind !== "graphrefly-public-content-corpus") fail("public content report has wrong kind");
  const routes = new Set((report.pages ?? []).map((page) => page.route));
  for (const route of expectedRoutes) {
    if (!routes.has(route)) fail(`public content report is missing ${route}`);
  }
  for (const route of routes) {
    if (!expectedRoutes.has(route) && !/^\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/.test(route)) {
      fail(`public content report contains unexpected route ${route}`);
    }
  }
  const blogIndex = (report.pages ?? []).find((page) => page.route === "/blog/");
  const blogArticles = (report.pages ?? []).filter((page) => /^\/blog\/.+\/$/.test(page.route));
  const expectedBlogRecordIds = new Set(blogIndex?.record_ids ?? []);
  if (expectedBlogRecordIds.size !== sourcePublicBlogById.size) {
    fail("blog index must contain exactly the public active posts declared in guide/blog.jsonl");
  }
  for (const recordId of expectedBlogRecordIds) {
    if (!sourcePublicBlogById.has(recordId)) {
      fail(`blog index exposes non-public or unknown record ${recordId}`);
    }
  }
  const renderedBlogRecordIds = new Set();
  for (const page of blogArticles) {
    if (page.source_jsonl !== "guide/blog.jsonl" || page.record_ids?.length !== 1) {
      fail(`${page.route} must render exactly one guide/blog.jsonl record`);
    }
    const [recordId] = page.record_ids;
    const sourceRecord = sourcePublicBlogById.get(recordId);
    if (!sourceRecord) fail(`${page.route} renders non-public or unknown record ${recordId}`);
    if (!expectedBlogRecordIds.has(recordId)) fail(`${page.route} renders a record absent from the blog index`);
    if (page.route !== `/blog/${sourceRecord.slug}/`) {
      fail(`${page.route} does not match the source slug for ${recordId}`);
    }
    if (renderedBlogRecordIds.has(recordId)) fail(`blog record ${recordId} renders more than one article page`);
    renderedBlogRecordIds.add(recordId);
  }
  if (renderedBlogRecordIds.size !== expectedBlogRecordIds.size) {
    fail("every public blog index record must render exactly one article page");
  }
  for (const page of report.pages ?? []) {
    for (const recordId of page.record_ids ?? []) {
      if (sourceInternalRecordIds.has(recordId)) fail(`${page.route} exposes internal source record ${recordId}`);
    }
    if (typeof page.title !== "string" || page.title.trim().length === 0) {
      fail(`${page.route} is missing a rendered title in the public content report`);
    }
    if (typeof page.h1 !== "string" || page.h1.trim().length === 0) {
      fail(`${page.route} is missing a rendered h1 in the public content report`);
    }
    if (page.dashboard_link !== "none") fail(`${page.route} links to the internal dashboard`);
    if (page.source_kind === "jsonl" && (!page.source_jsonl || !page.record_ids?.length)) {
      fail(`${page.route} must include source_jsonl and record_ids`);
    }
    const expectedSource = expectedSourceJsonlByRoute.get(page.route);
    if (expectedSource) {
      if (page.source_kind !== "jsonl" || page.source_jsonl !== expectedSource || !page.record_ids?.length) {
        fail(`${page.route} must source ${expectedSource}`);
      }
    } else if (page.source_kind !== "jsonl") {
      fail(`${page.route} must be sourced from structured records`);
    }
    if (packagePageRoutes.has(page.route)) {
      if (page.source_jsonl !== "guide/packages.jsonl") fail(`${page.route} must source guide/packages.jsonl`);
      if (!page.outbound_package_links?.length) fail(`${page.route} must expose package-owned outbound links`);
    }
  }
  for (const [route, record] of sourceSiteByRoute) {
    const page = (report.pages ?? []).find((item) => item.route === route);
    if (page?.source_jsonl !== "guide/site.jsonl" || page.record_ids?.length !== 1 || page.record_ids[0] !== record.id) {
      fail(`${route} must render exactly ${record.id} from guide/site.jsonl`);
    }
  }
  const homePage = (report.pages ?? []).find((page) => page.route === "/");
  const whyPage = (report.pages ?? []).find((page) => page.route === "/why/");
  const sourceHomeRecord = sourceSiteByRoute.get("/");
  const sourceWhyRecord = sourceSiteByRoute.get("/why/");
  const homeHeadline = sourceHomeRecord?.hero?.headline?.join(" ");
  const whyHeadline = sourceWhyRecord?.hero?.heading;
  if (homeHeadline !== "The graph you see, the system that runs." || homePage?.h1 !== homeHeadline) {
    fail("Home must lead with the causal WYSIWYG promise");
  }
  if (whyHeadline !== "Software becomes hard to change when it has more than one version of the truth." || whyPage?.h1 !== whyHeadline) {
    fail("Why must lead with the model-drift problem");
  }
  const homeHtml = readFileSync(join(distDir, "index.html"), "utf8");
  const whyHtml = readFileSync(join(distDir, "why", "index.html"), "utf8");
  if ([...homeHtml.matchAll(/class="home-reason(?:\s|")/g)].length !== 3 || !homeHtml.includes('class="focus-showcase"') || !homeHtml.includes('id="causal-walkthrough"')) {
    fail("Home must render three differentiators around one clearly bounded causal walkthrough");
  }
  for (const requiredClass of ["focus-example", "home-reasons", "home-inspect-system", "home-start-boundary", "package-section"]) {
    if (!homeHtml.includes(`class="band ${requiredClass}`)) fail(`Home must render the ${requiredClass} section`);
  }
  if ([...homeHtml.matchAll(/<section class=/g)].length !== 6) {
    fail("Home must stay focused across six primary sections");
  }
  if ([...whyHtml.matchAll(/class="why-record\b/g)].length !== 8) {
    fail("Why must render exactly eight sections in the approved argument order");
  }
  const expectedWhySectionIds = ["one-coherent-explanation", "the-graph-is-the-system", "connected-change", "smaller-context", "causal-evidence", "explicit-boundaries", "what-changes", "where-to-start"];
  if ((sourceWhyRecord?.sections ?? []).map((section) => section.id).join("|") !== expectedWhySectionIds.join("|")) {
    fail("Why must preserve the approved eight-section identity and order");
  }
  const whyArgumentIds = new Set((sourceWhyRecord?.sections ?? []).map((section) => section.id));
  const reasonFragments = (sourceHomeRecord?.reasons?.items ?? []).map((reason) => {
    const match = reason.href.match(/^why\/index\.html#([a-z0-9]+(?:-[a-z0-9]+)*)$/);
    if (!match) fail(`Home reason ${reason.id} must target why/index.html#<section-id>`);
    return match[1];
  });
  for (const fragment of reasonFragments) {
    if (!whyArgumentIds.has(fragment)) fail(`Home reason target #${fragment} must name a Why section`);
    if (!whyHtml.includes(`id="${fragment}"`)) fail(`Why page is missing Home reason target #${fragment}`);
  }
  const publicPositioning = `${homePage?.h1 ?? ""}\n${whyPage?.h1 ?? ""}\n${homeHtml.match(/<main\b[\s\S]*?<\/main>/)?.[0] ?? ""}\n${whyHtml.match(/<main\b[\s\S]*?<\/main>/)?.[0] ?? ""}`;
  for (const rejected of ["ontology", "auditable causal graph", "smaller verified steps", "explains exactly why"]) {
    if (publicPositioning.toLowerCase().includes(rejected)) fail(`Home and Why must not overclaim or drift into rejected positioning: ${rejected}`);
  }
  for (const retiredSurface of ["guarantee-sheet", "problem-system", "requirement-band", "data-legacy-showcase"]) {
    if (homeHtml.includes(retiredSurface)) fail(`Home must not restore the retired ${retiredSurface} narrative surface`);
  }
  const homeInputs = new Map((homePage?.source_inputs ?? []).map((input) => [input.source_jsonl, new Set(input.record_ids ?? [])]));
  if (!homeInputs.get("guide/site.jsonl")?.has("site.home")) {
    fail("home source_inputs must include site.home from guide/site.jsonl");
  }
  const expectedHomePackageIds = new Set(
    sourcePackageRecords
      .filter((record) => record.publicness === "public" && record.status === "active")
      .map((record) => record.id),
  );
  const actualHomePackageIds = homeInputs.get("guide/packages.jsonl") ?? new Set();
  if (actualHomePackageIds.size !== expectedHomePackageIds.size || [...expectedHomePackageIds].some((id) => !actualHomePackageIds.has(id))) {
    fail("home source_inputs must include every active public package record from guide/packages.jsonl");
  }
  const reportedSiteIds = new Set(
    (report.public_records ?? [])
      .filter((record) => record.source_jsonl === "guide/site.jsonl")
      .map((record) => record.id),
  );
  if (reportedSiteIds.size !== expectedSiteIds.size || [...expectedSiteIds.values()].some((id) => !reportedSiteIds.has(id))) {
    fail("public content report must contain exactly the Home and Why site records");
  }
  const reportedBlogRecordIds = new Set(
    (report.public_records ?? [])
      .filter((record) => record.source_jsonl === "guide/blog.jsonl")
      .map((record) => record.id),
  );
  if (reportedBlogRecordIds.size !== sourcePublicBlogById.size) {
    fail("public content report must contain exactly the public active Blog source records");
  }
  for (const recordId of reportedBlogRecordIds) {
    if (!sourcePublicBlogById.has(recordId)) fail(`public content report exposes internal blog record ${recordId}`);
  }
  for (const record of report.public_records ?? []) {
    if (sourceInternalRecordIds.has(record.id)) fail(`public content report exposes internal source record ${record.id}`);
  }
  if ((report.public_records ?? []).length === 0) fail("public content report has no public records");
  if ((report.package_entries ?? []).length !== 3) fail("public content report must include three package entries");
}

run("build website", ["website/scripts/build.mjs"]);
assertNoStatusArtifacts();
assertNoSharedRustRoute();
assertNoLegacyRustDocsUrl();
assertCnameArtifact();
assertRenderedHtmlLinks();
assertReport();
console.log("[public-docs gate] ok");
