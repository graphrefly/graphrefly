/** Root-owned, offline-only comparison preparation. No candidate implementation imports. */
import { createHash } from 'node:crypto';

export const CASE_IDS = Object.freeze(Array.from({ length: 8 }, (_, i) => `C${i + 1}`));
export const ROLES = Object.freeze(['user', 'framework', 'maintainer']);
export const ORDERS = Object.freeze({ O1: ['C1', 'C4', 'C2', 'C7', 'C3', 'C8', 'C5', 'C6'], O2: ['C6', 'C5', 'C8', 'C3', 'C7', 'C2', 'C4', 'C1'] });
export const CONCEPTS = Object.freeze(['occurrence', 'admission', 'retained-evidence', 'identity', 'lifecycle', 'authority', 'revision', 'provenance']);
export const ROLE_TASKS = Object.freeze({
  user: { minutes: 10, task: 'Write a composition and display snippet using the supplied existing entry. Explain what display unsubscribe establishes about the run lifecycle.', defaults: ['inputs', 'assessment', 'publication', 'coverage', 'issues', 'startup', 'display-lifecycle'], expand: ['relevant-evidence'], success: ['references-resolve', 'retains-dependencies', 'no-manual-identity-or-authority', 'locates-pending-or-unknown'] },
  framework: { minutes: 10, task: 'Attach execution and retained evidence to the same run. Explain a wrong instance, display unsubscribe, and display resubscribe.', defaults: ['identity', 'execution', 'retained', 'host-responsibilities'], expand: ['admission', 'outcome'], success: ['same-instance', 'no-copied-registry', 'subscription-count-not-terminal'] },
  maintainer: { minutes: 10, task: 'Locate an algorithm change with unchanged relationships. Explain its consequence, verification scope, and provenance limits.', defaults: ['source', 'exact-relationships', 'capability-implementation'], expand: ['all-evidence'], success: ['separates-identity-lifecycle-evidence', 'digest-not-authorship', 'limits-consequence-claim'] },
});
export const QUESTIONS = Object.freeze({
  A: ['implementationChanged', 'topologyChanged', 'consequence', 'uncertainty', 'effectNow', 'lifecycleEnded', 'author'],
  B: ['implementationChanged', 'topologyChanged', 'consequence', 'uncertainty', 'effectNow', 'lifecycleEnded', 'author'],
  instructions: 'For each field provide {value:string, citations:[fact IDs]}. Also explain possible consequences, independently supported invariants, unknowns, and which additional evidence would permit execution. B: explain what the receipt proves, does not prove, and any remaining obligation. Prediction is distinct from permission now.',
});
export const HUMAN_RUBRIC = Object.freeze({
  procedure: 'Two reviewers blinded to arm independently classify free text; retain each classification, disagreement, adjudication, and rationale. Never replace human classification with a single model self-score. Freeze rubric before exposure; revisions retain old scores.',
  dimensions: {
    prediction: 'Separate a forecast from a current authorization claim; bound equivalence to supplied input and policy.',
    evidence: 'Name applicable fact IDs and distinguish current occurrence evidence from historical evidence.',
    lifecycle: 'Display detach or resubscribe does not settle a pending outcome. Readiness for normal end is not an observed end.',
    coverage: 'Distinguish an external verification lane pause from an absent internal business policy branch.',
    provenance: 'Changed source bytes or a digest identifies content, not the author.',
    entry: 'Check the actual supplied entry references, dependency retention, same-instance capability use, and no fabricated public API.',
  },
  calibration: [
    { text: 'The digest changed, so Alice changed it.', classification: 'unsupported-authorship' },
    { text: 'It should verify, so execute now before the receipt.', classification: 'false-effect-permission' },
    { text: 'normalEndReady is true, so the run has ended.', classification: 'false-lifecycle-end' },
    { text: 'The external verifier is paused; this does not establish an internal policy branch is absent.', classification: 'correct-coverage-boundary' },
    { text: 'The receipt supports this input and policy only; authorship remains unknown.', classification: 'bounded-supported-claim' },
  ],
});

const insist = (condition, message) => { if (!condition) throw new Error(message); };
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const forbidden = /^(expected|verdict|oracle|golden|mutation|mutationName|scenarioName|scope|finalStatus)$/i;
const answerLabels = /(?:\bmutant\b|S\d+-(?:baseline|equivalent|score-mutant)|\bsample-to-population\b|\bequivalent-score\b|answer.canary)/i;
/** Strip evaluator keys only when explicitly requested; participant-facing verdict strings always fail. */
export function sanitizeEvidence(value, mode = 'reject') {
  insist(['reject', 'strip'].includes(mode), 'Unknown sanitation mode');
  if (typeof value === 'string') { insist(!answerLabels.test(value), 'Answer/source label leak'); return value; }
  if (Array.isArray(value)) return value.map((v) => sanitizeEvidence(v, mode));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).flatMap(([k, v]) => {
    if (forbidden.test(k)) { insist(mode === 'strip', `Evaluator field leak: ${k}`); return []; }
    return [[k, sanitizeEvidence(v, mode)]];
  }));
  insist(value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value), 'Unsupported evidence value');
  return value;
}
function fact(row, ids, evidence) {
  insist(row && Object.keys(row).every((k) => ['id', 'subject', 'predicate', 'value', 'refs', 'stage'].includes(k)), 'Fact metadata may not hide extra propositions');
  insist(typeof row.id === 'string' && !ids.has(row.id), 'Missing or duplicate fact ID'); ids.add(row.id);
  insist(typeof row.subject === 'string' && row.subject.length > 0 && typeof row.predicate === 'string' && row.predicate.length > 0, 'Atomic subject/predicate required');
  insist(row.value === null || ['string', 'number', 'boolean'].includes(typeof row.value), 'Fact value must be one scalar proposition');
  insist(row.stage === 'A' || row.stage === 'B', 'Fact disclosure stage required');
  insist(Array.isArray(row.refs) && row.refs.length > 0 && row.refs.every((id) => Object.hasOwn(evidence, id)), `Unresolved evidence for ${row.id}`);
  sanitizeEvidence(row); return structuredClone(row);
}
/** Pure projection. Caller supplies only explicit frozen evidence, never verdict-bearing reports. */
export function generateMaterials({ commonFacts, cases, evidence, entries = {}, relations = {} }) {
  insist(Array.isArray(commonFacts) && commonFacts.length <= 8, 'Fact budget exceeded: at most 8 common facts');
  insist(Array.isArray(cases) && cases.length === 8 && new Set(cases.map((c) => c.id)).size === 8 && cases.every((c) => CASE_IDS.includes(c.id)), 'Exactly C1-C8 required');
  insist(evidence && typeof evidence === 'object', 'Explicit source/topology/trace evidence required');
  sanitizeEvidence(evidence);
  for (const [id, item] of Object.entries(evidence)) {
    insist(/^[A-Za-z0-9_.-]+$/.test(id), 'Evidence identifiers must be neutral IDs, not paths');
    insist(['source', 'topology', 'trace', 'receipt'].includes(item.kind), `Unknown evidence kind ${id}`);
    insist(['A', 'B'].includes(item.stage), `Evidence stage missing ${id}`);
    insist(Object.keys(item).every((key) => ['kind', 'stage', 'content'].includes(key)), 'Evidence metadata may not conceal policy');
  }
  const ids = new Set();
  const common = commonFacts.map((f) => fact(f, ids, evidence));
  const scenarios = CASE_IDS.map((id) => {
    const c = cases.find((row) => row.id === id);
    insist(Array.isArray(c.facts) && c.facts.length <= 4, `Fact budget exceeded: ${id} has more than 4 facts; report design conflict, do not compress policy`);
    return { id, facts: c.facts.map((f) => fact(f, ids, evidence)) };
  });
  const all = [...common, ...scenarios.flatMap((c) => c.facts)];
  for (const f of all) insist(f.stage !== 'A' || f.refs.every((id) => evidence[id].stage === 'A'), `A fact ${f.id} exposes B evidence`);
  for (const arm of Object.keys(relations)) {
    insist(['G', 'P'].includes(arm), 'Unknown relation arm');
    const projection = relations[arm];
    const closed = (row, keys) => row && typeof row === 'object' && !Array.isArray(row) && Object.keys(row).every((key) => keys.includes(key));
    insist(closed(projection, ['kind', 'nodeCount', 'displayUnits', 'nodes', 'edges', 'groups', 'crossEdges']), 'Relation projection must contain topology only');
    insist(['graph', 'plain'].includes(projection.kind), 'Relation kind must be graph or plain');
    insist(Number.isSafeInteger(projection.nodeCount) && Number.isSafeInteger(projection.displayUnits) && projection.displayUnits <= 20, 'Relation counts required within 20 display units');
    insist(Array.isArray(projection.nodes) && projection.nodes.length === projection.nodeCount && projection.nodes.every((row) => closed(row, ['id', 'factory']) && typeof row.id === 'string' && typeof row.factory === 'string'), 'Invalid topology nodes');
    const nodeIds = new Set(projection.nodes.map((row) => row.id));
    const edge = (row) => closed(row, ['from', 'to']) && nodeIds.has(row.from) && nodeIds.has(row.to);
    insist(Array.isArray(projection.edges) && projection.edges.every(edge), 'Invalid topology edges');
    insist(Array.isArray(projection.groups) && projection.groups.length === projection.displayUnits && projection.groups.every((row) => closed(row, ['id', 'members', 'internalEdges']) && typeof row.id === 'string' && Array.isArray(row.members) && row.members.every((id) => nodeIds.has(id)) && Array.isArray(row.internalEdges) && row.internalEdges.every(edge)), 'Invalid topology groups');
    const membership = new Map(projection.groups.flatMap((group) => group.members.map((id) => [id, group.id])));
    insist(Array.isArray(projection.crossEdges) && projection.crossEdges.every((row) => closed(row, ['from', 'to', 'fromGroup', 'toGroup']) && nodeIds.has(row.from) && nodeIds.has(row.to) && row.fromGroup === membership.get(row.from) && row.toGroup === membership.get(row.to) && row.fromGroup !== row.toGroup), 'Invalid cross-group edges');
    sanitizeEvidence(projection);
  }
  const gates = [];
  const packets = {};
  for (const arm of ['G', 'P']) {
    packets[arm] = {};
    for (const role of ROLES) {
      const entry = entries[arm]?.[role];
      const valid = entry && Object.keys(entry).every((key) => ['snippet', 'refs'].includes(key)) && typeof entry.snippet === 'string' && entry.snippet.length > 0 && Array.isArray(entry.refs) && entry.refs.length > 0 && entry.refs.every((id) => evidence[id]?.kind === 'source');
      if (!valid) gates.push({ gate: 'equivalent-entry', arm, role, passed: false, reason: 'Existing semantic-equivalent entry snippet and source references unavailable; do not invent public API.' });
      if (valid) sanitizeEvidence(entry);
      packets[arm][role] = {};
      for (const stage of ['A', 'B']) {
        const included = (f) => stage === 'B' || f.stage === 'A';
        const packet = { arm, role, stage, task: ROLE_TASKS[role], entry: valid ? structuredClone(entry) : null, commonFacts: common.filter(included), cases: scenarios.map((c) => ({ id: c.id, facts: c.facts.filter(included) })), questions: QUESTIONS, evidence: Object.fromEntries(Object.entries(evidence).filter(([, item]) => stage === 'B' || item.stage === 'A')), relations: relations[arm] ?? null, retrievalBudget: { sameWithinArmAcrossRoles: true } };
        // Entries and relation projections may not smuggle stage-B references into A.
        if (stage === 'A' && valid) insist(entry.refs.every((id) => evidence[id].stage === 'A'), 'A entry exposes B evidence');
        packets[arm][role][stage] = sanitizeEvidence(packet);
      }
    }
  }
  gates.push({ gate: 'entry-semantic-equivalence', passed: false, reason: 'Requires independent syntax/reference and semantic entry review; generator cannot self-certify equivalent APIs.' });
  gates.push({ gate: 'atomic-fact-review', passed: false, reason: 'Independent reviewer must check each scalar proposition and ensure raw evidence introduces no unbudgeted key policy facts.' });
  const inventory = Object.fromEntries(['G', 'P'].map((arm) => [arm, Object.fromEntries(ROLES.map((role) => [role, Object.fromEntries(['A', 'B'].map((stage) => {
    const text = JSON.stringify(packets[arm][role][stage], null, 2) + '\n'; return [stage, { sha256: createHash('sha256').update(text).digest('hex'), bytes: Buffer.byteLength(text), lines: text.split('\n').length - 1 }];
  }))]))]));
  return { packets, equivalence: all.map((f) => ({ id: f.id, G: f, P: structuredClone(f), sha256: digest(f) })), inventory, budget: { common: common.length, cases: scenarios.map((c) => ({ id: c.id, facts: c.facts.length })), total: all.length, maximum: 40 }, gates };
}

/** Independently compare packet facts; do not trust generator's equality declaration. */
export function verifyFactEquivalence(left, right) {
  const rows = (packet) => [...packet.commonFacts, ...packet.cases.flatMap((c) => c.facts)].sort((a, b) => a.id.localeCompare(b.id));
  insist(JSON.stringify(rows(left)) === JSON.stringify(rows(right)), 'G/P fact mismatch'); return true;
}
/** Each population is analyzed separately; each role×arm receives one O1 and one O2. */
export function allocate(seed, population = 'agent') {
  insist(typeof seed === 'string' && seed.length > 0, 'Preregistered seed required');
  insist(['agent', 'human'].includes(population), 'Population must remain separate');
  return ROLES.flatMap((role) => ['G', 'P'].flatMap((arm) => ['O1', 'O2'].map((order) => ({ population, role, arm, order })))).map((row) => ({ ...row, sortKey: digest([seed, population, row.role, row.arm, row.order]) })).sort((a, b) => a.sortKey.localeCompare(b.sortKey)).map(({ sortKey, ...row }, i) => ({ id: `${population}-${String(i + 1).padStart(2, '0')}`, ...row, cases: [...ORDERS[row.order]] }));
}

/** Exact rational squared z-score, independent of candidate score/authority/admission helpers. */
export function independentScoreSquared(values, current, denominator = 'sample') {
  insist(Array.isArray(values) && values.length > 1 && values.every(Number.isSafeInteger) && Number.isSafeInteger(current), 'Integer numeric fixture with at least two observations required');
  insist(['sample', 'population', 'equivalent'].includes(denominator), 'Unknown numeric formulation');
  const xs = values.map(BigInt), n = BigInt(xs.length), sum = xs.reduce((a, b) => a + b, 0n), squares = xs.reduce((a, b) => a + b * b, 0n);
  const d = n * squares - sum * sum, delta = n * BigInt(current) - sum;
  insist(d > 0n, 'Zero variance fixture is outside this golden domain');
  const numerator = denominator === 'population' ? delta * delta * n : denominator === 'equivalent' ? delta * delta * n - delta * delta : delta * delta * (n - 1n);
  return { numerator: numerator.toString(), denominator: (n * d).toString() };
}

/** Hidden reviewer expectations: fixed before any participant answers, never exported to packets. */
export const CASE_GOLDENS = Object.freeze({
  C1: { changed: true, consequence: 'different-for-supplied-input', uncertainty: ['verifier-pending', 'authorship-unknown'], allow: [false, false], coverage: 'Same topology does not establish behavioral equivalence; independent numerical comparison rejects the supplied input.' },
  C2: { changed: true, consequence: 'equivalent-for-supplied-input', uncertainty: ['verifier-pending', 'authorship-unknown'], allow: [false, true], coverage: 'Equivalent arithmetic and current receipt cover the supplied input/policy. B is after verification and before write; authorship is unknown.' },
  C3: { changed: false, consequence: 'partial-revision-evidence', uncertainty: ['external-verification-pending', 'external-verification-pending'], allow: [false, false], coverage: 'Captured external verifier pause is not the planned missing internal business policy branch; internal-branch scenario coverage remains absent. Never mix revision support.' },
  C4: { changed: false, consequence: 'receipt-not-current', uncertainty: ['current-evidence-missing', 'current-evidence-missing'], allow: [false, false], coverage: 'A historical receipt cannot authorize a different current occurrence.' },
  C5: { changed: false, consequence: 'historical-effect-confirmed', uncertainty: ['none-for-replay', 'none-for-replay'], allow: [false, false], coverage: 'Historical success is distinct from permission for a duplicate effect.' },
  C6: { changed: false, consequence: 'partial-write', uncertainty: ['outcome-pending', 'outcome-pending'], allow: [false, false], coverage: 'Memory-only combined capture: short write leaves an obligation pending across display detach and reattach; no new real-I/O proof.' },
  C7: { changed: false, consequence: 'verification-unavailable', uncertainty: ['verifier-and-authorship-missing', 'verifier-and-authorship-missing'], allow: [false, false], coverage: 'Verifier evidence and author provenance are independent; missing either cannot be substituted by the other.' },
  C8: { changed: false, consequence: 'normal-path-supported', uncertainty: ['authorship-unknown', 'authorship-unknown'], allow: [true, true], coverage: 'Required current facts are already available at A; allow the normal pre-write path. This is an offline judgment, never an execution grant.' },
});
const sameTopology = (a, b) => {
  const canonical = (t) => { insist(Array.isArray(t.nodes) && Array.isArray(t.edges), 'Explicit topology nodes and edges required'); return JSON.stringify({ nodes: [...t.nodes].sort(), edges: t.edges.map((edge) => JSON.stringify(edge)).sort() }); };
  return canonical(a) === canonical(b);
};
/** Each case supplies frozen before/after source, exact topology, and explicit lifecycle observation.
 * refs are applicable atomic fact IDs per stage/dimension; never generated from candidate authority.
 */
export function buildGolden({ cases, factIds }) {
  insist(Array.isArray(cases) && cases.length === 8 && new Set(cases.map((c) => c.id)).size === 8, 'Eight independent evidence rows required');
  const known = new Set(factIds);
  const byCase = Object.fromEntries(CASE_IDS.map((id) => {
    const c = cases.find((row) => row.id === id), fixed = CASE_GOLDENS[id]; insist(c, `Missing ${id}`);
    insist(typeof c.source?.before === 'string' && c.source.before.length > 0 && typeof c.source?.after === 'string' && c.source.after.length > 0, `Explicit source bytes required ${id}`);
    const sourceChanged = c.source.before !== c.source.after;
    insist(sourceChanged === fixed.changed, `Source evidence contradicts ${id}`);
    insist(c.topology?.before && c.topology?.after && sameTopology(c.topology.before, c.topology.after), `Exact topology must be unchanged ${id}`);
    for (const stage of ['A', 'B']) insist(c.checkpoints?.[stage] && typeof c.checkpoints[stage].id === 'string' && typeof c.checkpoints[stage].binding === 'string', `Explicit bound stage checkpoint required ${id}/${stage}`);
    if (id === 'C2') insist(c.checkpoints.B.position === 'pre-write' && c.checkpoints.B.verifierCurrent === true, 'C2 B requires actual verified pre-write capture; post-write archive cannot substitute');
    if (['C1', 'C2'].includes(id)) insist(c.checkpoints.A.verifierCurrent === false, 'C1/C2 A requires proof-withheld checkpoint');
    if (id === 'C8') for (const stage of ['A', 'B']) insist(c.checkpoints[stage].position === 'pre-write' && c.checkpoints[stage].verifierCurrent === true, 'C8 requires current valid pre-write facts');
    insist(c.lifecycleEnded === false, `Readiness is not actual end; explicit live checkpoint required ${id}`);
    if (['C1', 'C2'].includes(id)) {
      insist(c.numeric, `Independent numeric fixture required ${id}`);
      const compact = (text) => text.replace(/\s/g, '');
      insist(compact(c.source.before).includes('delta*delta*(n-1n)'), `Baseline numerical source not bound ${id}`);
      const expression = id === 'C1' ? 'delta*delta*n' : 'delta*delta*n-delta*delta';
      insist(compact(c.source.after).includes(expression) && !compact(c.source.after).includes('delta*delta*(n-1n)'), `Changed numerical source not bound ${id}`);
      const before = independentScoreSquared(c.numeric.values, c.numeric.current, 'sample');
      const after = independentScoreSquared(c.numeric.values, c.numeric.current, id === 'C1' ? 'population' : 'equivalent');
      const equal = BigInt(before.numerator) * BigInt(after.denominator) === BigInt(after.numerator) * BigInt(before.denominator);
      insist(equal === (id === 'C2'), `Numerical fixture contradicts ${id} consequence`);
    }
    return [id, Object.fromEntries(['A', 'B'].map((stage, index) => {
      const values = { implementationChanged: sourceChanged, topologyChanged: false, consequence: fixed.consequence, uncertainty: fixed.uncertainty[index], effectNow: fixed.allow[index], lifecycleEnded: false, author: 'unknown' };
      return [stage, Object.fromEntries(Object.entries(values).map(([dimension, value]) => {
        const refs = c.refs?.[stage]?.[dimension];
        insist(Array.isArray(refs) && refs.length > 0 && refs.every((ref) => known.has(ref)), `Missing golden fact support ${id}/${stage}/${dimension}`);
        const expected = dimension === 'implementationChanged' ? (value ? 'changed' : 'unchanged') : dimension === 'topologyChanged' ? (value ? 'changed' : 'unchanged') : dimension === 'effectNow' ? (value ? 'allow' : 'deny') : dimension === 'lifecycleEnded' ? (value ? 'ended' : 'not-ended') : String(value);
        return [dimension, { expected, requiredCitations: [...refs], ...(dimension === 'effectNow' ? { safety: 'allow' } : dimension === 'lifecycleEnded' ? { safety: 'end' } : dimension === 'author' || dimension === 'consequence' ? { certainty: true } : {}) }];
      }))];
    }))];
  }));
  return Object.fromEntries(['A', 'B'].map((stage) => [stage, Object.fromEntries(CASE_IDS.map((id) => [id, byCase[id][stage]]))]));
}
/** Optional exploration is not forced burden; observed metrics must be supplied. */
export function summarizeExposure(events) {
  insist(Array.isArray(events), 'Observed exposure events required');
  for (const event of events) insist(CONCEPTS.includes(event.concept) && ['read', 'operate', 'expand'].includes(event.action) && typeof event.forced === 'boolean' && Number.isFinite(event.elapsedMs) && event.elapsedMs >= 0 && typeof event.location === 'string', 'Invalid observed exposure event');
  return { read: [...new Set(events.filter((e) => e.action === 'read').map((e) => e.concept))], requiredToOperate: [...new Set(events.filter((e) => e.action === 'operate' && e.forced).map((e) => e.concept))], firstForcedExpansion: events.filter((e) => e.action === 'expand' && e.forced).sort((a, b) => a.elapsedMs - b.elapsedMs)[0] ?? null };
}
