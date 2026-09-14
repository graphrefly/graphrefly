import test from 'node:test';
import assert from 'node:assert/strict';
import { CASE_IDS, ROLES, ORDERS, QUESTIONS, generateMaterials, verifyFactEquivalence, allocate, sanitizeEvidence, independentScoreSquared, buildGolden, summarizeExposure } from './materials.mjs';
import { createSession, gradeSealed } from './session.mjs';

// These are synthetic module controls, not captured observations or participant results.
const input = () => ({
  commonFacts: [{ id: 'F1', subject: 'display detach', predicate: 'ends run', value: false, refs: ['E1'], stage: 'A' }],
  cases: CASE_IDS.map(id => ({ id, facts: [{ id: `${id}F1`, subject: id, predicate: 'checkpoint', value: 'synthetic', refs: ['E1'], stage: 'A' }] })),
  evidence: { E1: { kind: 'source', stage: 'A', content: 'function fixture() { return 1; }' }, E2: { kind: 'receipt', stage: 'B', content: { observedBytes: 7 } } },
});
function goldenInput() {
  const topology = { nodes: ['n1', 'n2'], edges: [['n1', 'n2']] };
  return { factIds: ['F1'], cases: CASE_IDS.map(id => ({ id, source: { before: 'delta * delta * (n - 1n)', after: id === 'C1' ? 'delta * delta * n' : id === 'C2' ? 'delta * delta * n - delta * delta' : 'delta * delta * (n - 1n)' }, topology: { before: topology, after: topology }, lifecycleEnded: false,
    checkpoints: Object.fromEntries(['A', 'B'].map(stage => [stage, { id: `${id}-${stage}`, binding: 'synthetic-fixture-only', position: 'pre-write', verifierCurrent: id === 'C8' || id === 'C2' && stage === 'B' }])),
    numeric: { values: [1, 2, 3], current: 3 }, refs: Object.fromEntries(['A', 'B'].map(stage => [stage, Object.fromEntries(QUESTIONS[stage].map(d => [d, ['F1']]))])),
  })) };
}
test('canonical G/P facts, role rights, receipt staging, explicit unready entries, inventory', () => {
  const result = generateMaterials(input());
  assert.equal(result.budget.total, 9);
  assert.equal(verifyFactEquivalence(result.packets.G.user.A, result.packets.P.user.A), true);
  assert.deepEqual(result.packets.G.user.A.evidence, result.packets.G.maintainer.A.evidence);
  assert.equal(result.packets.G.user.A.evidence.E2, undefined);
  assert.equal(result.packets.G.user.B.evidence.E2.content.observedBytes, 7);
  assert.ok(result.gates.some(g => g.gate === 'equivalent-entry' && g.passed === false));
  assert.ok(result.inventory.G.user.A.bytes > 0);
  const changed = structuredClone(result.packets.P.user.A); changed.commonFacts[0].value = true;
  assert.throws(() => verifyFactEquivalence(result.packets.G.user.A, changed), /mismatch/);
});
test('fact budgets reject overflow and non-atomic metadata instead of hiding policy', () => {
  const a = input(); a.commonFacts = Array.from({ length: 9 }, (_, i) => ({ ...a.commonFacts[0], id: `F${i}` }));
  assert.throws(() => generateMaterials(a), /budget/);
  const b = input(); b.cases[0].facts = Array.from({ length: 5 }, (_, i) => ({ ...b.cases[0].facts[0], id: `CF${i}` }));
  assert.throws(() => generateMaterials(b), /budget/);
  const c = input(); c.commonFacts[0].policy = { another: true };
  assert.throws(() => generateMaterials(c), /metadata/);
  const d = input(); d.commonFacts[0].value = { two: 'claims' };
  assert.throws(() => generateMaterials(d), /scalar/);
});
test('verdict/source leaks rejected, explicit evaluator-key stripping, unknown labels preserved as task facts', () => {
  assert.throws(() => sanitizeEvidence({ verdict: 'pass' }), /leak/);
  assert.deepEqual(sanitizeEvidence({ observed: 3, expected: 3 }, 'strip'), { observed: 3 });
  assert.throws(() => sanitizeEvidence({ source: 'S1-score-mutant' }, 'strip'), /leak/);
  assert.equal(sanitizeEvidence('current verifier absent'), 'current verifier absent');
  const a = input(); a.commonFacts[0].refs = ['E2']; assert.throws(() => generateMaterials(a), /exposes B/);
  const b = input(); b.relations = { G: { receipt: { stage: 'B', content: 'later receipt' } } }; assert.throws(() => generateMaterials(b), /topology only/);
});
test('relation schema admits only exact topology and rejects nested receipt data', () => {
  const a = input(); a.relations = { G: { kind: 'graph', nodeCount: 1, displayUnits: 1, nodes: [{ id: 'n', factory: 'node' }], edges: [], groups: [{ id: 'g', members: ['n'], internalEdges: [] }], crossEdges: [] } };
  generateMaterials(a);
  a.relations.G.nodes[0].receipt = { stage: 'B' };
  assert.throws(() => generateMaterials(a), /topology nodes/);
});
test('seeded allocations balanced separately by population and role×arm', () => {
  const a = allocate('frozen-seed'); assert.deepEqual(a, allocate('frozen-seed'));
  assert.notDeepEqual(a, allocate('different-seed'));
  assert.equal(a.length, 12); assert.deepEqual(ORDERS.O2, [...ORDERS.O1].reverse());
  for (const role of ROLES) for (const arm of ['G', 'P']) assert.deepEqual(a.filter(x => x.role === role && x.arm === arm).map(x => x.order).sort(), ['O1', 'O2']);
  assert.ok(allocate('frozen-seed', 'human').every(row => row.population === 'human'));
});
test('independent exact arithmetic distinguishes changed formulation and preserves equivalent rewrite', () => {
  const sample = independentScoreSquared([1, 2, 3], 3, 'sample');
  assert.deepEqual(sample, { numerator: '18', denominator: '18' });
  assert.deepEqual(independentScoreSquared([1, 2, 3], 3, 'equivalent'), sample);
  assert.deepEqual(independentScoreSquared([1, 2, 3], 3, 'population'), { numerator: '27', denominator: '18' });
  assert.throws(() => independentScoreSquared([1, 1], 1), /Zero variance/);
});
test('golden binds changed source, unchanged topology and live pre-write checkpoints', () => {
  const a = goldenInput(), result = buildGolden(a);
  assert.equal(result.A.C2.effectNow.expected, 'deny'); assert.equal(result.B.C2.effectNow.expected, 'allow');
  assert.equal(result.A.C8.effectNow.expected, 'allow'); assert.equal(result.B.C6.lifecycleEnded.expected, 'not-ended');
  a.cases[1].checkpoints.B.position = 'post-write'; assert.throws(() => buildGolden(a), /actual verified pre-write/);
  const b = goldenInput(); b.cases[0].source.after = b.cases[0].source.before; assert.throws(() => buildGolden(b), /Source evidence/);
  const c = goldenInput(); c.cases[0].topology.after = { nodes: ['other'], edges: [] }; assert.throws(() => buildGolden(c), /topology/);
  const d = goldenInput(); d.cases[5].lifecycleEnded = true; assert.throws(() => buildGolden(d), /Readiness/);
});
test('synthetic generator→broker→seal→grader contract, with receipt denied before A seal', () => {
  const packets = generateMaterials(input()).packets.G.user, golden = buildGolden(goldenInput());
  const session = createSession({ sessionId: 'synthetic-module-control', files: { 'A.json': { phase: 'A', content: JSON.stringify(packets.A) }, 'B.json': { phase: 'B', content: JSON.stringify(packets.B) } } });
  assert.equal(session.broker.request({ op: 'read', path: 'B.json' }).ok, false);
  for (const stage of ['A', 'B']) {
    for (const scenario of CASE_IDS) {
      const fields = Object.fromEntries(Object.entries(golden[stage][scenario]).map(([key, rule]) => [key, { value: rule.expected, citations: rule.requiredCitations }]));
      assert.equal(session.broker.request({ op: 'submit', phase: stage, scenario, fields }).ok, true);
    }
    const seal = stage === 'A' ? session.sealA() : session.finish().sealB;
    const grade = gradeSealed(seal, golden[stage], seal.hash);
    assert.equal(grade.totals.correct, 56); assert.equal(grade.totals.falseAllow, 0);
  }
});
test('exposure uses supplied observations and optional exploration is not forced work', () => {
  const result = summarizeExposure([{ concept: 'identity', action: 'read', forced: false, elapsedMs: 2, location: 'details' }, { concept: 'admission', action: 'operate', forced: false, elapsedMs: 3, location: 'optional' }, { concept: 'lifecycle', action: 'expand', forced: true, elapsedMs: 4, location: 'status' }]);
  assert.deepEqual(result.requiredToOperate, []); assert.equal(result.firstForcedExpansion.location, 'status');
  assert.throws(() => summarizeExposure([{ concept: 'invented' }]), /Invalid/);
});
