// Offline import qualification only; no participant implementation or provider calls.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { compileInProcess } from '../../../../../scripts/b121-comparison/compiler-process.mjs';
import { digest } from '../../../../../scripts/b121-comparison/frozen-compiler.mjs';

const base = fileURLToPath(new URL('.', import.meta.url));
const run = resolve(base, '../candidate-runs/88c2fc7e66bdd554ef62ba8ab91ddbde634d4ade1f48ffe4ec424d937960f518');
const read = (name) => readFileSync(resolve(base, name), 'utf8');
const materialsJSON = readFileSync(resolve(run, 'materials.json'), 'utf8');
const materials = JSON.parse(materialsJSON);
const tasks = JSON.parse(read('tasks.json'));
const rubric = JSON.parse(read('reviewer-rubric-draft.json'));
const exposure = JSON.parse(read('exposure-and-samples.json'));
assert.equal(digest(materialsJSON), tasks.materialSHA256);
assert.equal(digest(read('tasks.json')), rubric.taskSHA256);
assert.deepEqual(tasks.tasks.map(t => t.id), rubric.tasks.map(t => t.id));
assert.deepEqual(tasks.tasks.map(t => t.id), exposure.samples.map(t => t.taskId));
assert.equal(new Set(tasks.tasks.map(t => t.id)).size, 3);
for (const task of rubric.tasks) {
  for (const criterion of task.criteria) {
    assert.equal(digest(materials.files[criterion.evidencePath]), criterion.evidenceSHA256);
  }
}
const environmentJSON = gunzipSync(readFileSync(resolve(run, 'compiler-environment.json.gz'))).toString();
const expectedSHA256 = JSON.parse(readFileSync(resolve(run, 'integration-pins.json'))).environmentSHA256;
const snippets = [
  'import type { Graph, GraphTopologySnapshot } from "@graphrefly/ts/graph"; export type API = (g: Graph) => GraphTopologySnapshot;',
  'import type { NodeVersion, NodeVersionV0, NodeVersionV1 } from "@graphrefly/ts/core"; export type API = readonly (NodeVersion | NodeVersionV0 | NodeVersionV1 | undefined)[];',
  'import type { DataResult, DataIssue } from "../../packages/ts/src/data/index.js"; export type API<T> = (r: readonly DataResult<T>[]) => { values: readonly T[]; issues: readonly DataIssue[] };',
];
const results = [];
const receiptRoot = resolve(base, 'offline', process.argv[2] ?? 'imports-01');
mkdirSync(receiptRoot, { recursive: true });
for (const [index, snippet] of snippets.entries()) {
  const outcome = await compileInProcess({ environmentJSON, expectedSHA256, snippet,
    directory: resolve(receiptRoot, tasks.tasks[index].id),
    context: { stage: 'module-import-only', taskId: tasks.tasks[index].id },
  });
  results.push({ taskId: tasks.tasks[index].id, ...outcome });
}
writeFileSync(resolve(base, 'verification.json'), JSON.stringify({
  formalReady: false, providerCalls: 0, participantSolutions: 0,
  materialSHA256: digest(materialsJSON), environmentSHA256: expectedSHA256,
  artifactSHA256: Object.fromEntries(['tasks.json', 'reviewer-rubric-draft.json', 'exposure-and-samples.json', 'verify.mjs'].map(p => [p, digest(read(p))])),
  meaning: 'Only import availability, source bindings and sample/rubric alignment. Not answerability, consumer probes, semantic calibration or campaign readiness.',
  results,
}, null, 2) + '\n');
assert(results.every(r => r.compilation?.ok && !r.compilerFailure), 'Import qualification failed; inspect retained receipts');
console.log('3/3 frozen import checks; task/rubric/sample/source bindings match; provider calls 0');
