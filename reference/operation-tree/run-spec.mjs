// Runs the vendored photo-scenes spec, unchanged, against one arm, in a fresh directory that
// holds exactly the bytes under test. Source edits (mutants) are applied to those copies; the
// checkout is never touched. Each vendored file is checked against its recorded digest first.
//
// Layout of the run directory:
//   operations.spec.ts                         the vendored spec
//   packages/operations/src/index.ts           the arm (the spec and its subprocess test load it)
//   reference/kernel/kernel.mjs, reference/operation-tree/graph-operations.mjs   graph arm only

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const HOOKS = join(HERE, "hooks.mjs");

// photo-scenes commit a331d71 (the package and spec are unchanged since 2cb9b89), and the
// package as it was before each of Codex's three code QA rounds was fixed.
export const VENDOR = {
  "reference/operation-tree/vendor/operations/index.ts": "377ea48aea224ff88d179e60bbd21d144f98b84c4e5de267e37a61c5613cc7a8",
  "reference/operation-tree/vendor/operations.spec.ts": "f6d56fc08658f426ff7a7d849c6748beb68d839a720fbe88ce919509ac188e26",
  "reference/operation-tree/vendor/history/132889d.ts": "858a3208f312fc21e09ecf4427863a9d2b497e4ceb94f059a50a81b3a4411881",
  "reference/operation-tree/vendor/history/007843d.ts": "2d8d6541a87076e96012a5961df594968d01c391ac6e97c076299710b7a603e9",
  "reference/operation-tree/vendor/history/420d546.ts": "97a0006346579bc85d8b35f6794a888188210a6375c2ab1ec4d23ec28bc9fe06",
};

const ENTRY = "packages/operations/src/index.ts";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function vendored(path) {
  const bytes = await readFile(join(ROOT, path));
  if (sha256(bytes) !== VENDOR[path]) throw new Error(`${path} does not match its recorded digest`);
  return bytes.toString("utf8");
}

// What each arm's run directory holds, keyed by its path there.
async function filesOf(arm) {
  if (arm === "graph") {
    return {
      [ENTRY]: 'export * from "../../../reference/operation-tree/graph-operations.mjs";\n',
      "reference/kernel/kernel.mjs": await readFile(join(ROOT, "reference/kernel/kernel.mjs"), "utf8"),
      "reference/operation-tree/graph-operations.mjs": await readFile(join(HERE, "graph-operations.mjs"), "utf8"),
    };
  }
  const source = arm === "plain" ? "reference/operation-tree/vendor/operations/index.ts" : `reference/operation-tree/vendor/history/${arm}.ts`;
  if (!VENDOR[source]) throw new Error(`unknown arm ${arm}`);
  return { [ENTRY]: await vendored(source) };
}

function applyEdit(files, edit) {
  const text = files[edit.path];
  if (text === undefined) throw new Error(`edit for ${edit.path}, which this arm does not load`);
  const count = text.split(edit.from).length - 1;
  if (count !== 1) throw new Error(`edit for ${edit.path} matches ${count} times: ${edit.from}`);
  files[edit.path] = text.replace(edit.from, () => edit.to);
}

// Top-level results from node:test's TAP output. An assertion failure carries
// ERR_ASSERTION; anything else (a timeout, a load error, a crash) is kept apart.
function parseTap(out) {
  const tests = [];
  const lines = out.split("\n");
  lines.forEach((line, i) => {
    const m = /^(not ok|ok) \d+ - (.*)$/.exec(line);
    if (!m) return;
    const ok = m[1] === "ok";
    let kind = "pass";
    if (!ok) {
      const block = [];
      for (let j = i + 1; j < lines.length && !/^(not ok|ok) \d+ - /.test(lines[j]); j++) block.push(lines[j]);
      const yaml = block.join("\n");
      kind = /failureType: 'testTimeoutFailure'/.test(yaml) ? "timeout"
        : /code: 'ERR_ASSERTION'/.test(yaml) ? "assertion" : "error";
    }
    tests.push({ name: m[2].replace(/\\#/g, "#"), ok, kind });
  });
  return tests;
}

export async function runSpec({ arm, edits = [], testTimeoutMs = 10_000, timeoutMs = 120_000 }) {
  const files = await filesOf(arm);
  files["operations.spec.ts"] = await vendored("reference/operation-tree/vendor/operations.spec.ts");
  for (const edit of edits) applyEdit(files, edit);
  const dir = await mkdtemp(join(tmpdir(), "operation-tree-"));
  try {
    for (const [path, text] of Object.entries(files)) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), text);
    }
    const args = ["--experimental-transform-types", "--no-warnings", "--import", HOOKS,
      "--test", "--test-reporter=tap", `--test-timeout=${testTimeoutMs}`, "operations.spec.ts"];
    const { stdout, stderr, code } = await new Promise((done, fail) => {
      // A child started under node --test would report to the parent runner, not as TAP.
      const { NODE_TEST_CONTEXT: _, ...env } = process.env;
      const child = spawn(process.execPath, args, { cwd: dir, env });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => { stdout += d; });
      child.stderr.on("data", (d) => { stderr += d; });
      const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
      child.on("error", fail);
      child.on("close", (code) => { clearTimeout(timer); done({ stdout, stderr, code }); });
    });
    const tests = parseTap(stdout);
    return { code, tests, failed: tests.filter((t) => !t.ok), stdout, stderr };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
