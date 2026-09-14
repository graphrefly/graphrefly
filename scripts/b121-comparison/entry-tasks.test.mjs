import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createSession } from './session.mjs';
import { createEntryAcceptance, validateEntrySnippet } from './entry-tasks.mjs';
const tsRoot = fileURLToPath(new URL('../../../graphrefly-ts/', import.meta.url));
const session = () => createSession({ sessionId: 'offline-entry-smoke', files: {} });
function closed() {
  const controller = session();
  controller.sealA();
  controller.finish();
  return controller;
}
function syntheticReview(task, passed = true) {
  return { reviewerId: 'synthetic-test-only-not-participant', checks: Object.fromEntries(
    task.criteria.map(id => [id, { passed, evidence: `Synthetic grader branch fixture: ${id}` }])) };
}

test('entry delivery and reference snippets denied during A and B, enabled only after close', () => {
  const controller = session();
  const acceptance = createEntryAcceptance({ controller, tsRoot });
  assert.throws(() => acceptance.releaseTasks(), /must be closed/);
  assert.throws(() => acceptance.referenceSnippets(), /must be closed/);
  controller.sealA();
  assert.throws(() => acceptance.releaseTasks(), /must be closed/);
  controller.finish();
  const packet = acceptance.releaseTasks();
  assert.equal(packet.tasks.length, 3);
  assert.equal(packet.scope, 'Graph-only');
  assert.equal(packet.comparisonProof.sealB, controller.snapshot().sealB.hash);
  assert.deepEqual(acceptance.results(), []);
});

test('forged closed flag and changed sealed answer fail release proof', () => {
  const open = session().snapshot();
  open.phase = 'closed';
  assert.throws(() => createEntryAcceptance({ controller: { snapshot: () => open }, tsRoot }).releaseTasks());
  const modified = closed().snapshot();
  modified.answers.B.C1.status = 'submitted';
  assert.throws(() => createEntryAcceptance({ controller: { snapshot: () => modified }, tsRoot }).releaseTasks(), /seal mismatch/);
});

test('released source contents and task references match current source SHA256', () => {
  const acceptance = createEntryAcceptance({ controller: closed(), tsRoot });
  const packet = acceptance.releaseTasks();
  for (const source of packet.sources) {
    const bytes = readFileSync(resolve(tsRoot, source.path));
    assert.equal(source.content, bytes.toString('utf8'));
    assert.equal(source.sha256, createHash('sha256').update(bytes).digest('hex'));
    for (const task of packet.tasks) {
      assert.deepEqual(task.sourceBindings.find(b => b.path === source.path), { path: source.path, sha256: source.sha256 });
    }
  }
  packet.sources[0].content = 'tampered caller copy';
  assert.notEqual(acceptance.releaseTasks().sources[0].content, packet.sources[0].content);
});

test('all three actual reference snippets typecheck without running their code', () => {
  const acceptance = createEntryAcceptance({ controller: closed(), tsRoot });
  for (const { id, snippet } of acceptance.referenceSnippets()) {
    const compiled = validateEntrySnippet(tsRoot, snippet);
    assert.equal(compiled.ok, true, `${id}: ${JSON.stringify(compiled.diagnostics)}`);
  }
});

test('invented imperative view API fails semantic typecheck', () => {
  const result = validateEntrySnippet(tsRoot, `import type { SpendingAlertsView } from './causal-preset.js';
export function invalid(view: SpendingAlertsView) { view.publish(); }`);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(d => d.code === 2339 && d.message.includes('publish')));
});

test('Graph-only per-task grading requires review and keeps rejected/missing results separate', () => {
  const acceptance = createEntryAcceptance({ controller: closed(), tsRoot });
  const packet = acceptance.releaseTasks();
  const refs = acceptance.referenceSnippets();
  assert.throws(() => acceptance.grade({ taskId: 'ordinary', snippet: refs[0].snippet }), /reviewer/);
  const valid = acceptance.grade({ taskId: 'ordinary', snippet: refs[0].snippet,
    review: syntheticReview(packet.tasks[0]) });
  assert.equal(valid.accepted, true);
  assert.equal(valid.scope, 'Graph-only');
  assert.throws(() => acceptance.grade({ taskId: 'ordinary', snippet: refs[0].snippet,
    review: syntheticReview(packet.tasks[0]) }), /already retained/);
  const rejected = acceptance.grade({ taskId: 'framework', snippet: refs[1].snippet,
    review: syntheticReview(packet.tasks[1], false) });
  assert.equal(rejected.compilation.ok, true);
  assert.equal(rejected.accepted, false);
  assert.equal(acceptance.results().length, 2);
  assert.equal(acceptance.results().some(r => r.taskId === 'maintainer'), false);
  const invalid = acceptance.grade({ taskId: 'maintainer', snippet: 'const invalid: number = true;',
    review: syntheticReview(packet.tasks[2]) });
  assert.equal(invalid.compilation.ok, false);
  assert.equal(invalid.accepted, false);
});
