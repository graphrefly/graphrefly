// Loads one arm of the flagship from exact bytes (brief sections 4 and 6). It copies the
// files to a fresh directory, applies the requested source edits there (each must occur
// exactly once), hashes the bytes it wrote, checks them again just before the import, and
// imports the arm from that directory. The checkout is never modified, and the arm cannot
// run any bytes but the ones the source digest names.

import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url)); // reference/
const sha = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const enc = (v) => Array.isArray(v) ? `[${v.map(enc).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${enc(v[k])}`).join(",")}}`
  : JSON.stringify(v);

// The executing closure: every file an arm can load.
export const CLOSURE = [
  "kernel/kernel.mjs",
  "modules/observe.mjs",
  "flagship/consumer/business.mjs",
  "flagship/consumer/vendor-stats.mjs",
  "flagship/consumer/inbox-host.mjs",
  "flagship/consumer/graph-app.mjs",
  "flagship/consumer/plain-app.mjs",
];
// Files of the consumer outside the closure; a change there is shown, and is not a change
// to what runs.
export const OUTSIDE = ["flagship/cli.mjs"];

const patchDigest = ({ path, from, to }) => sha(enc({ path, from, to }));
export { patchDigest };

function applyEdits(path, text, edits) {
  for (const e of edits.filter((x) => x.path === path)) {
    const at = text.indexOf(e.from);
    if (at < 0 || text.indexOf(e.from, at + 1) >= 0) throw new Error(`edit for ${path} must match exactly once: ${JSON.stringify(e.from)}`);
    text = text.slice(0, at) + e.to + text.slice(at + e.from.length);
  }
  return text;
}

export async function load({ arm, edits = [] }) {
  for (const e of edits) if (![...CLOSURE, ...OUTSIDE].includes(e.path)) throw new Error(`no such consumer file ${e.path}`);
  const dir = await mkdtemp(join(tmpdir(), "flagship-"));
  const files = [];
  for (const path of [...CLOSURE, ...OUTSIDE]) {
    const raw = await readFile(join(ROOT, path), "utf8");
    const loaded = applyEdits(path, raw, edits);
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), loaded);
    files.push({ path, rawSha256: sha(raw), loadedSha256: sha(loaded) });
  }
  const manifest = files.filter((f) => CLOSURE.includes(f.path));
  for (const f of manifest) {
    if (sha(await readFile(join(dir, f.path))) !== f.loadedSha256) throw new Error(`loaded bytes of ${f.path} differ from the bound bytes`);
  }
  const mod = await import(pathToFileURL(join(dir, `flagship/consumer/${arm}-app.mjs`)).href);
  return {
    arm, createApp: mod.createApp, sources: mod.sources ?? {}, edits, manifest, files,
    sourceDigest: sha(enc(manifest)),
    runtimeDigest: sha(enc({ node: process.version, platform: process.platform, arch: process.arch })),
  };
}

// Brief section 4: what changed between two loads, kept apart from who changed it.
// Implementation changed: closure files whose bytes differ, and the nodes bound to them.
// Outside: consumer files that changed but are not loaded. Attribution: an edit's declared
// provenance counts only if it names that exact patch; otherwise it is unknown.
export function implementationReport(base, candidate) {
  const before = new Map(base.files.map((f) => [f.path, f.loadedSha256]));
  const changed = candidate.files.filter((f) => before.get(f.path) !== f.loadedSha256).map((f) => f.path);
  const inClosure = changed.filter((p) => CLOSURE.includes(p));
  return {
    sourceDigestChanged: base.sourceDigest !== candidate.sourceDigest,
    changedFiles: inClosure,
    outsideClosure: changed.filter((p) => !CLOSURE.includes(p)),
    changedNodes: Object.entries(candidate.sources).filter(([, f]) => inClosure.includes(f)).map(([id]) => id),
    attribution: candidate.edits.map((e) => ({
      path: e.path,
      actor: e.provenance && e.provenance.patchDigest === patchDigest(e) ? e.provenance.actor : "unknown",
    })),
  };
}
