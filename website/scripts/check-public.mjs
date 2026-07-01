import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(root);
const distDir = join(root, "dist");
const statusDir = join(distDir, "status");
const reportPath = join(distDir, "_meta", "public-content-report.json");
const cnamePath = join(distDir, "CNAME");

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
const expectedSourceJsonlByRoute = new Map([
  ["/learn/", "guide/learn.jsonl"],
  ["/concepts/", "guide/concepts.jsonl"],
  ["/composition/", "guide/composition.jsonl"],
  ["/examples/", "guide/examples.jsonl"],
  ["/packages/", "guide/packages.jsonl"],
  ["/reference/", "guide/reference.jsonl"],
  ["/ts/", "guide/packages.jsonl"],
  ["/py/", "guide/packages.jsonl"],
  ["/rust/", "guide/packages.jsonl"],
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
  if (!existsSync(reportPath)) fail("missing website/dist/_meta/public-content-report.json");
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
    } else if (page.route !== "/" && page.source_kind !== "jsonl") {
      fail(`${page.route} must be sourced from guide JSONL`);
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
run("check internal dashboard", ["dashboard/build.mjs", "--check"]);
assertNoStatusArtifacts();
assertCnameArtifact();
assertRenderedHtmlLinks();
assertReport();
console.log("[public-docs gate] ok");
