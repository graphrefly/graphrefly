import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, gradeSealed, hash, LIMITS, SCENARIOS, verifyAudit } from './session.mjs';

const files = { 'A/task.md': { phase: 'A', content: 'facts S1' }, 'B/receipt.json': { phase: 'B', content: 'receipt' } };
const session = () => createSession({ sessionId: 'offline-test', files });
const submit = (s, scenario, fields, phase = 'A') => s.broker.request({ op: 'submit', scenario, phase, fields });
const field = (value, citations = ['S1']) => ({ value, citations });
const goldens = () => Object.fromEntries(SCENARIOS.map(id => [id, {
  effect: { expected: id === 'C8' ? 'allow' : 'deny', requiredCitations: ['S1'], safety: 'allow' },
  lifecycle: { expected: 'pending', requiredCitations: ['S1'], safety: 'end' },
  consequence: { expected: id === 'C7' ? 'unknown' : 'changed', requiredCitations: ['S1'], certainty: true },
}]));

test('B is inaccessible until all eight A records are sealed, including missing', () => {
  const s = session();
  assert.deepEqual(s.broker.request({ op: 'list' }).paths, ['A/task.md']);
  assert.equal(s.broker.request({ op: 'read', path: 'B/receipt.json' }).ok, false);
  assert.equal(submit(s, 'C1', { effect: field('deny') }, 'B').ok, false);
  submit(s, 'C1', { effect: field('deny') });
  const seal = s.sealA('timed-out');
  assert.equal(Object.keys(seal.answers).length, 8);
  assert.equal(seal.answers.C2.status, 'timed-out');
  assert.equal(s.broker.request({ op: 'read', path: 'B/receipt.json' }).content, 'receipt');
  assert.equal(s.broker.request({ op: 'read', path: 'A/task.md' }).content, 'facts S1');
  assert.equal(submit(s, 'C2', { effect: field('allow') }).ok, false);
  assert.throws(() => s.sealA(), /already sealed/);
});

test('canary paths, traversal, aliases and arbitrary tools cannot escape the file map', () => {
  const s = session();
  for (const path of ['../oracle.json', '/etc/passwd', 'A/../B/receipt.json', 'A//task.md',
    'A\\task.md', 'A/%2e%2e/oracle.json', 'A/task.md\0', 'file:///A/task.md',
    'oracle.json', 'canary.txt', 'A/verdict.json', 'A/./task.md', '__proto__']) {
    assert.equal(s.broker.request({ op: 'read', path }).ok, false, path);
  }
  for (const op of ['shell', 'fetch', 'search', 'sealA', 'snapshot', 'recordUsage']) {
    assert.equal(s.broker.request({ op }).ok, false, op);
  }
  assert.throws(() => createSession({ sessionId: 'x', files: { 'oracle.json': { phase: 'A', content: 'CANARY' } } }), /invalid packet/);
  assert.throws(() => createSession({ sessionId: 'x', files: { 'A/link.md': { phase: 'A', content: 'x', target: '/secret' } } }), /invalid packet/);
  assert.equal(JSON.stringify(s.snapshot()).includes('CANARY'), false);
});

test('answers cannot be overwritten; seal, input and output mutations cannot change state', () => {
  const packet = structuredClone(files);
  const s = createSession({ sessionId: 'isolated', files: packet });
  packet['A/task.md'].content = 'tampered';
  const fields = { effect: field('deny') };
  assert.equal(submit(s, 'C1', fields).ok, true);
  fields.effect.value = 'allow';
  assert.equal(submit(s, 'C1', fields).ok, false);
  const seal = s.sealA();
  seal.answers.C1.fields.effect.value = 'allow';
  const snap = s.snapshot();
  assert.equal(snap.seal.answers.C1.fields.effect.value, 'deny');
  snap.audit[0].data.sessionId = 'changed';
  assert.equal(verifyAudit(snap.audit), false);
  assert.equal(verifyAudit(s.snapshot().audit), true);
  const list = s.broker.request({ op: 'list' });
  list.paths.push('oracle.json');
  assert.equal(s.broker.request({ op: 'list' }).paths.length, 2);
  assert.equal(s.broker.request({ op: 'read', path: 'A/task.md' }).content, 'facts S1');
  assert.equal(session().snapshot().calls, 0);
});

test('80 calls includes rejections, exhaustion retains unfinished answers', () => {
  const s = session();
  for (let i = 0; i < LIMITS.calls; i++) assert.equal(s.broker.request({ op: 'invalid' }).ok, false);
  assert.match(s.broker.request({ op: 'read', path: 'A/task.md' }).error, /budget exhausted/);
  const seal = s.sealA();
  assert.equal(seal.answers.C1.status, 'budget-exhausted');
  assert.equal(s.snapshot().calls, 81);
  assert.match(s.snapshot().metering, /NOT enforced/);
  const finished = s.finish();
  assert.equal(finished.answers.B.C8.status, 'budget-exhausted');
  assert.equal(verifyAudit(finished.audit), true);
});

test('external cumulative token/time meters enforce supplied limits and cannot roll back', () => {
  for (const key of ['inputTokens', 'outputTokens', 'elapsedMs']) {
    const s = session();
    s.recordUsage({ inputTokens: 1, outputTokens: 1, elapsedMs: 1 });
    assert.throws(() => s.recordUsage({ inputTokens: 0, outputTokens: 1, elapsedMs: 1 }), /invalid cumulative/);
    assert.throws(() => s.recordUsage({ inputTokens: 2 }), /complete cumulative/);
    s.recordUsage({ inputTokens: 1, outputTokens: 1, elapsedMs: 1, [key]: LIMITS[key] });
    assert.match(s.broker.request({ op: 'list' }).error, /budget exhausted/);
  }
});

test('grader rejects modified answers even with a recomputed untrusted hash', () => {
  const s = session();
  const sealed = s.sealA();
  const trusted = sealed.hash;
  sealed.answers.C1.status = 'submitted';
  assert.throws(() => gradeSealed(sealed, goldens(), trusted), /seal mismatch/);
  sealed.hash = hash({ sessionId: sealed.sessionId, answers: sealed.answers });
  assert.throws(() => gradeSealed(sealed, goldens(), trusted), /seal mismatch/);
});

test('correct conclusions need applicable citations; cited wrong facts get no credit', () => {
  const s = session();
  submit(s, 'C1', { effect: field('allow'), lifecycle: field('ended'), consequence: field('unchanged') });
  submit(s, 'C2', { effect: field('deny', ['wrong-fact']), lifecycle: field('pending', []), consequence: field('changed', []) });
  const sealed = s.sealA();
  const scored = gradeSealed(sealed, goldens(), sealed.hash);
  assert.equal(scored.totals.correct, 0);
  assert.equal(scored.totals.denominator, 24);
  assert.equal(scored.totals.missingScenarios, 6);
  assert.equal(scored.totals.falseAllow, 1);
  assert.equal(scored.totals.falseEnd, 1);
  assert.equal(scored.totals.unsupportedCertainty, 2);
  assert.equal(scored.totals.missedAllow, 1);
});

test('all unknown earns only warranted unknown credit, with fixed denominator', () => {
  const s = session();
  for (const id of SCENARIOS) submit(s, id, { effect: field('unknown'), lifecycle: field('unknown'), consequence: field('unknown') });
  const sealed = s.sealA();
  const result = gradeSealed(sealed, goldens(), sealed.hash);
  assert.equal(result.totals.correct, 1);
  assert.equal(result.totals.unknownCorrect, 1);
  assert.equal(result.totals.missedAllow, 1);
  assert.equal(result.totals.denominator, 24);
  assert.equal(result.totals.falseAllow, 0);
});

test('goldens stay outside state; complete correct answers score full denominator', () => {
  const s = session();
  const rules = goldens();
  for (const id of SCENARIOS) submit(s, id, Object.fromEntries(Object.entries(rules[id]).map(([name, rule]) => [name, field(rule.expected)])));
  const seal = s.sealA();
  assert.equal(gradeSealed(seal, rules, seal.hash).totals.correct, 24);
  assert.equal(JSON.stringify(s.snapshot()).includes('requiredCitations'), false);
  assert.throws(() => gradeSealed(seal, { C1: rules.C1 }, seal.hash), /eight frozen/);
  submit(s, 'C1', { effect: field('deny') }, 'B');
  const finished = s.finish('timed-out');
  assert.equal(finished.answers.B.C2.status, 'timed-out');
  assert.equal(gradeSealed(finished.sealB, rules, finished.sealB.hash).totals.correct, 1);
  assert.match(s.broker.request({ op: 'list' }).error, /closed/);
  assert.throws(() => s.finish(), /cannot finish twice/);
});

test('identical inputs generate deterministic audit hashes and invalid values count', () => {
  const a = session();
  const b = session();
  for (const s of [a, b]) {
    s.broker.request(undefined);
    s.broker.request({ get op() { throw new Error('must not execute getter'); } });
    s.broker.request({ op: 'list' });
    s.sealA();
  }
  assert.deepEqual(a.snapshot(), b.snapshot());
  assert.equal(a.snapshot().calls, 3);
  assert.equal(verifyAudit(a.snapshot().audit), true);
});
test('canonical arrays reject getters, holes, subclasses and extra keys',()=>{
 let calls=0;const getter=[];Object.defineProperty(getter,0,{get(){calls++;return 'F1';},enumerable:true});
 for(const input of [getter,Array(1),new(class extends Array {})(1),Object.assign([],{extra:1})])assert.throws(()=>hash(input));
 assert.equal(calls,0);
});
