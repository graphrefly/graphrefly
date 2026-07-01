import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(root);
const distDir = join(root, "dist");
const reportPath = join(distDir, "_meta", "public-content-report.json");
const requirePlaywright = process.argv.includes("--require-playwright") || process.env.GRAPHREFLY_REQUIRE_PLAYWRIGHT === "1";
const chromeExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 900 },
];

const mimeByExt = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
]);

function fail(message) {
  throw new Error(`[public-docs smoke] ${message}`);
}

function log(message) {
  console.log(`[public-docs smoke] ${message}`);
}

function publicRoutesFromReport(report) {
  return report.pages
    .map((page) => page.route)
    .filter((route) => route !== "/" && !route.startsWith("/status/"))
    .sort();
}

function readReport() {
  if (!existsSync(reportPath)) fail("missing website/dist/_meta/public-content-report.json; run docs:public:check first");
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  if (report.kind !== "graphrefly-public-content-corpus") fail("public content report has wrong kind");
  return report;
}

function safeFilePath(requestUrl) {
  const parsed = new URL(requestUrl, "http://127.0.0.1");
  const decoded = decodeURIComponent(parsed.pathname);
  const clean = decoded.endsWith("/") ? `${decoded}index.html` : decoded;
  const target = normalize(join(distDir, clean));
  const rel = relative(distDir, target);
  if (rel.startsWith("..")) return null;
  return target;
}

function startServer() {
  const server = createServer((request, response) => {
    const target = safeFilePath(request.url ?? "/");
    if (!target || !existsSync(target) || !statSync(target).isFile()) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
      return;
    }
    response.writeHead(200, { "content-type": mimeByExt.get(extname(target)) ?? "application/octet-stream" });
    response.end(readFileSync(target));
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    if (requirePlaywright) fail(`Playwright is required but unavailable: ${error.message}`);
    log(`SKIP browser smoke: Playwright is not installed for this repo (${error.message})`);
    return null;
  }
}

async function launchBrowser(chromium) {
  try {
    return await chromium.launch({
      headless: true,
      ...(chromeExecutable ? { executablePath: chromeExecutable } : {}),
    });
  } catch (error) {
    if (requirePlaywright) fail(`Playwright browser launch failed: ${error.message}`);
    log(`SKIP browser smoke: Playwright is present but no browser launched (${error.message.split("\n")[0]})`);
    return null;
  }
}

function assertNav(actualLabels, expectedNav, route, viewportName) {
  const expectedLabels = expectedNav.map((item) => item.label);
  if (JSON.stringify(actualLabels) !== JSON.stringify(expectedLabels)) {
    fail(`${route} ${viewportName} primary nav drifted: got ${actualLabels.join(", ")}`);
  }
}

async function inspectPage(page, route, viewportName, expectedNav) {
  const errors = [];
  const onPageError = (error) => errors.push(`pageerror: ${error.message}`);
  const onConsole = (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  };
  page.on("pageerror", onPageError);
  page.on("console", onConsole);

  try {
    const response = await page.goto(route, { waitUntil: "load" });
    if (!response?.ok()) fail(`${route} ${viewportName} returned HTTP ${response?.status() ?? "unknown"}`);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForTimeout(120);
    const result = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      const scrollWidth = Math.max(html.scrollWidth, body.scrollWidth);
      const dashboardLinks = [...document.querySelectorAll('a[href*="status/dashboard.html"], a[href*="dashboard.html"]')];
      return {
        title: document.title.trim(),
        h1: document.querySelector("h1")?.textContent?.trim() ?? "",
        navLabels: [...document.querySelectorAll('nav[aria-label="Primary"] a')].map((link) => link.textContent?.trim() ?? ""),
        overflow: scrollWidth - window.innerWidth,
        dashboardLinks: dashboardLinks.length,
      };
    });

    if (errors.length) fail(`${route} ${viewportName} produced browser errors: ${errors.join(" | ")}`);
    if (!result.title || !result.h1) fail(`${route} ${viewportName} is missing title or h1`);
    assertNav(result.navLabels, expectedNav, route, viewportName);
    if (result.overflow > 1) fail(`${route} ${viewportName} has horizontal overflow of ${result.overflow}px`);
    if (result.dashboardLinks !== 0) {
      fail(`${route} ${viewportName} links to the internal dashboard`);
    }
  } finally {
    page.off("pageerror", onPageError);
    page.off("console", onConsole);
  }
}

const report = readReport();
const publicRoutes = ["/", ...publicRoutesFromReport(report)];
const expectedNav = report.policy?.primary_nav ?? [];
if (expectedNav.length === 0) fail("public content report has no primary nav policy");

const playwright = await loadPlaywright();
if (!playwright) process.exit(0);

const browser = await launchBrowser(playwright.chromium);

if (!browser) process.exit(0);

const server = await startServer();
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

try {
  for (const viewport of viewports) {
    for (const route of publicRoutes) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      try {
        await inspectPage(page, `${baseUrl}${route}`, viewport.name, expectedNav);
      } finally {
        await page.close();
      }
    }
  }
  log(`ok: browser-smoked ${publicRoutes.length} routes at ${viewports.map((item) => item.name).join(" + ")}`);
} finally {
  await browser.close();
  server.close();
}
