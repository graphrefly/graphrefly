import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(root);
const distDir = join(root, "dist");
const statusDir = join(distDir, "status");
const reportPath = join(statusDir, "public-content-report.json");

const expectedRoutes = new Set([
  "/",
  "/learn/",
  "/concepts/",
  "/composition/",
  "/examples/",
  "/packages/",
  "/reference/",
  "/ts/",
  "/py/",
  "/rust/",
]);
const packagePageRoutes = new Set(["/packages/", "/ts/", "/py/", "/rust/"]);
const internalRouteNames = new Set(["decisions", "guide", "maintainers", "spec"]);
const allowedStatusFiles = new Set(["dashboard.css", "dashboard.html", "dashboard.js", "public-content-report.json"]);

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

function attrsFrom(html) {
  return [...html.matchAll(/\s(href|src)="([^"]+)"/g)].map((match) => ({ name: match[1], value: match[2] }));
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

function assertStatusArtifacts() {
  for (const name of readdirSync(statusDir)) {
    if (!allowedStatusFiles.has(name)) fail(`unexpected status artifact ${name}`);
  }
}

function assertRenderedHtmlLinks() {
  for (const file of walk(distDir).filter((item) => item.endsWith(".html"))) {
    const rel = relative(distDir, file);
    if (rel.startsWith("status/")) continue;
    const html = readFileSync(file, "utf8");
    for (const attr of attrsFrom(html)) {
      const target = localTarget(file, attr.value);
      if (!target) continue;
      if (!existsSync(target)) fail(`${relative(repoRoot, file)} has broken ${attr.name} ${attr.value}`);
      const targetRel = relative(distDir, target);
      const [topLevel] = targetRel.split("/");
      if (internalRouteNames.has(topLevel)) fail(`${relative(repoRoot, file)} links to internal route ${attr.value}`);
      if (topLevel === "status" && targetRel !== "status/dashboard.html") {
        fail(`${relative(repoRoot, file)} may link only to status/dashboard.html, got ${attr.value}`);
      }
    }
    const dashboardLinks = [...html.matchAll(/status\/dashboard\.html/g)].length;
    const footer = html.match(/<footer[\s\S]*?<\/footer>/)?.[0] ?? "";
    if (dashboardLinks !== 1 || !footer.includes("status/dashboard.html")) {
      fail(`${relative(repoRoot, file)} must link to dashboard exactly once from the footer`);
    }
  }
}

function assertReport() {
  if (!existsSync(reportPath)) fail("missing website/dist/status/public-content-report.json");
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  if (report.kind !== "graphrefly-public-content-corpus") fail("public content report has wrong kind");
  const routes = new Set((report.pages ?? []).map((page) => page.route));
  for (const route of expectedRoutes) {
    if (!routes.has(route)) fail(`public content report is missing ${route}`);
  }
  for (const route of routes) {
    if (!expectedRoutes.has(route)) fail(`public content report contains unexpected route ${route}`);
  }
  for (const page of report.pages ?? []) {
    if (page.dashboard_link !== "footer-only") fail(`${page.route} lost footer-only dashboard status`);
    if (page.source_kind === "jsonl" && (!page.source_jsonl || !page.record_ids?.length)) {
      fail(`${page.route} must include source_jsonl and record_ids`);
    }
    if (packagePageRoutes.has(page.route)) {
      if (page.source_jsonl !== "guide/packages.jsonl") fail(`${page.route} must source guide/packages.jsonl`);
      if (!page.outbound_package_links?.length) fail(`${page.route} must expose package-owned outbound links`);
    }
  }
  if ((report.public_records ?? []).length === 0) fail("public content report has no public records");
  if ((report.package_entries ?? []).length !== 3) fail("public content report must include three package entries");
}

run("build website", ["website/scripts/build.mjs"]);
run("check dashboard links", ["dashboard/build.mjs", "--check"]);
assertStatusArtifacts();
assertRenderedHtmlLinks();
assertReport();
console.log("[public-docs gate] ok");
