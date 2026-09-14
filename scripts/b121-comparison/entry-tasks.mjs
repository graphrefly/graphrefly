/** Offline Graph-only entry acceptance. Trusted controller/reviewer APIs, never an A/B broker tool. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { hash, SCENARIOS, verifyAudit } from './session.mjs';

const sourcePaths = [
  'examples/spending-alerts/causal-entry.ts',
  'examples/spending-alerts/causal-inputs.ts',
  'examples/spending-alerts/causal-resource.ts',
  'examples/spending-alerts/causal-preset.ts',
  'examples/spending-alerts/causal-view-binding.ts',
  'examples/spending-alerts/causal-focused-host.ts',
  'examples/spending-alerts/causal-audience.examples.ts',
  'packages/ts/src/solutions/causal-occurrence/capabilities.ts',
  'packages/ts/src/graph/graph.ts',
];
const sha256 = text => createHash('sha256').update(text).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));

const specs = [
  {
    id: 'ordinary',
    prompt: 'Given the application Graph and prepared SpendingCreationInputs, compose one spending instance and subscribe its actual five-port view. Return the observer cleanup separately from the application-owned instance. Do not open resources or feed inputs in this exercise.',
    criteria: ['prepared-input-compose', 'actual-five-port-observation', 'observation-cleanup-only'],
    reference: `import type { Graph } from "../../packages/ts/src/graph/graph.js";
import { spendingAlertsFor, type SpendingCreationInputs } from "./causal-entry.js";
import { mountSpendingView, type SpendingViewObservation } from "./causal-view-binding.js";
export function ordinary(graph: Graph, prepared: SpendingCreationInputs,
  render: (observation: SpendingViewObservation) => void) {
  const instance = spendingAlertsFor(graph, { name: "entry-acceptance", diagnostics: "off" }).compose({
    evaluations: prepared.evaluations,
    verification: prepared.verification,
    localAuthority: prepared.localAuthority,
    inbox: { resource: prepared.inbox.resource },
  });
  const stopObserving = mountSpendingView(instance.view, render);
  return { instance, stopObserving };
}
`,
  },
  {
    id: 'framework',
    prompt: 'Given the original issued full capabilities, their owning Graph and exact binding, validate the binding and pass the original identity, execution and retained handles onward. Explain why a structural copy does not preserve issued authority and why execution grants no transport call.',
    criteria: ['issued-binding-validation', 'original-reference-lineage', 'no-transport-authority'],
    reference: `import type { Graph } from "../../packages/ts/src/graph/graph.js";
import { assertCausalCapabilities, type FullCausalCapability, type CausalBinding }
  from "../../packages/ts/src/solutions/causal-occurrence/capabilities.js";
export function framework<T>(graph: Graph, full: FullCausalCapability<T>, binding: CausalBinding) {
  assertCausalCapabilities(graph, full, binding);
  const identity = full.identity;
  const execution = full.execution;
  const retained = full.retained;
  if (execution.identity !== identity || retained.execution !== execution) throw new Error("lineage");
  return { identity, execution, retained };
}
`,
  },
  {
    id: 'maintainer',
    prompt: 'Given the actual composed instance and Graph, inspect the complete graph and source-backed host dependencies. Trace causal-entry.compose to composeSpendingHost, owner startup, hostGuard and runEndReady. Explain why normalEndReady and local quiescence are different, citing source lines; do not mutate topology or invoke transport.',
    criteria: ['complete-graph-inspection', 'source-construction-trace', 'host-end-boundary'],
    reference: `import type { Graph } from "../../packages/ts/src/graph/graph.js";
import type { spendingAlertsFor } from "./causal-entry.js";
type Instance = ReturnType<ReturnType<typeof spendingAlertsFor>["compose"]>;
export function maintainer(graph: Graph, instance: Instance) {
  return {
    completeGraph: graph.describe(),
    startup: instance.owner.startup,
    hostFacts: instance.source,
    guardDependencies: instance.guard.deps,
    endDependencies: instance.runEndReady.deps,
    hostObservation: instance.inspect(),
  };
}
`,
  },
];

/** Typecheck only: virtual source, no emit, no imports or participant code executed. */
export function validateEntrySnippet(tsRoot, snippet) {
  if (typeof snippet !== 'string' || !snippet.trim() || snippet.length > 32000) throw new Error('bounded snippet required');
  const root = resolve(tsRoot);
  const require = createRequire(resolve(root, 'package.json'));
  const ts = require('typescript');
  const filename = resolve(root, 'examples/spending-alerts/__b121_entry_validation__.ts');
  const options = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, skipLibCheck: true,
    esModuleInterop: true, noEmit: true, types: ['node'], typeRoots: [resolve(root, 'node_modules/@types')] };
  const host = ts.createCompilerHost(options);
  const read = host.readFile.bind(host), exists = host.fileExists.bind(host);
  host.readFile = path => path === filename ? snippet : read(path);
  host.fileExists = path => path === filename || exists(path);
  const program = ts.createProgram([filename], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program).map(d => ({ code: d.code,
    file: d.file?.fileName ?? null,
    message: ts.flattenDiagnosticMessageText(d.messageText, '\n') }));
  return { ok: diagnostics.length === 0, compilerVersion: ts.version, diagnostics,
    validation: 'static-typecheck-only; no runtime or effect execution' };
}

function closedProof(snapshot) {
  if (snapshot.phase !== 'closed' || !verifyAudit(snapshot.audit)) throw new Error('comparison A and B must be closed');
  const a = snapshot.seal, b = snapshot.sealB;
  for (const [seal, phase] of [[a, 'A'], [b, 'B']]) {
    if (!seal || seal.sessionId !== snapshot.sessionId ||
      Object.keys(seal.answers).sort().join() !== [...SCENARIOS].sort().join() ||
      hash(seal.answers) !== hash(snapshot.answers[phase]) ||
      hash({ sessionId: snapshot.sessionId, answers: seal.answers }) !== seal.hash)
      throw new Error('comparison seal mismatch');
  }
  const events = snapshot.audit;
  const ia = events.findIndex(e => e.type === 'seal-A');
  const ib = events.findIndex(e => e.type === 'seal-B');
  const ic = events.findIndex(e => e.type === 'closed');
  if (!(ia > 0 && ib > ia && ic > ib) || hash(events[ia].data) !== hash(a) ||
    hash(events[ib].data) !== hash(b) || events[ic].data.answersHash !== hash(snapshot.answers))
    throw new Error('comparison close audit mismatch');
  return { sessionId: snapshot.sessionId, sealA: a.hash, sealB: b.hash, closedAuditHash: events[ic].hash };
}

/** Controller and reviewer are trusted harness inputs. Hashes are not authentication or isolation.
 * Keep this module, references and rubric out of both A and B participant packets.
 * Each result is Graph-only usage acceptance, never comparative plain-entry evidence.
 */
export function createEntryAcceptance({ controller, tsRoot }) {
  if (typeof controller?.snapshot !== 'function') throw new Error('trusted session controller required');
  const snapshot = controller.snapshot.bind(controller);
  let packet;
  const results = new Map();
  function releaseTasks() {
    const proof = closedProof(snapshot());
    if (!packet) {
      const sources = sourcePaths.map(path => {
        const content = readFileSync(resolve(tsRoot, path), 'utf8');
        return { path, sha256: sha256(content), content };
      });
      packet = { format: 'b121-graph-entry-acceptance-v1', scope: 'Graph-only', comparisonProof: proof,
        limitations: ['consumer-private examples; not new public library APIs',
          'static reference checks do not execute a host or prove runtime behavior',
          'trusted source/rubric review required; no participant acceptance inferred'],
        sources, tasks: specs.map(({ reference, ...spec }) => ({ ...spec,
          sourceBindings: sources.map(({ path, sha256 }) => ({ path, sha256 })) })) };
    }
    return clone(packet);
  }
  function referenceSnippets() {
    releaseTasks();
    return specs.map(({ id, reference }) => ({ id, snippet: reference }));
  }
  function grade({ taskId, snippet, review }) {
    const released = releaseTasks();
    const task = specs.find(t => t.id === taskId);
    if (!task || results.has(taskId)) throw new Error('unknown task or result already retained');
    for (const source of released.sources) {
      if (sha256(readFileSync(resolve(tsRoot, source.path), 'utf8')) !== source.sha256)
        throw new Error('source changed after task release');
    }
    if (!review || typeof review.reviewerId !== 'string' || !review.reviewerId.trim() ||
      Object.keys(review.checks ?? {}).sort().join() !== [...task.criteria].sort().join())
      throw new Error('complete trusted reviewer assessment required');
    for (const check of Object.values(review.checks)) {
      if (typeof check?.passed !== 'boolean' || typeof check.evidence !== 'string' || !check.evidence.trim())
        throw new Error('criterion evidence required');
    }
    const compilation = validateEntrySnippet(tsRoot, snippet);
    const result = { taskId, scope: 'Graph-only', comparisonProof: released.comparisonProof,
      snippetHash: sha256(snippet), compilation, review: clone(review),
      accepted: compilation.ok && Object.values(review.checks).every(c => c.passed),
      basis: 'static typecheck plus trusted reviewer assessment; not runtime verification' };
    results.set(taskId, result);
    return clone(result);
  }
  return Object.freeze({ releaseTasks, referenceSnippets, grade,
    results: () => clone([...results.values()]) });
}
