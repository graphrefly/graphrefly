# Protocol reconciliation: values and occurrences

DS-15 — non-normative interactive review, opened 2026-09-17.
Source: Codex task 01a0b15b-a223-7873-ba1a-116a84012e6a.

## Scope and authorization

Theme one of five: values/occurrences; later themes are propagation/demand, pause/async,
lifecycle/resources, and public programming model. Review one point at a time and pause
for discussion. User authorizes review and notes, not runtime changes or rule activation.
On 2026-09-17 the user accepted recording the distinctions below. After ALL walkthroughs,
return to Rules and make them concise, complete, nonduplicative and internally consistent.
Do not rewrite Rules prematurely, or treat these notes as a new normative authority.

## Rules — current surface and reconciliation candidates

Canonical references: ../../spec/rules.jsonl and ../../authority/README.md.

- R-resolved-undirty@1 is in the current resolver projection, verified during this task.
  DATA preserves equal-valued occurrences. RESOLVED settles DIRTY without new DATA;
  it is not a claim that a recomputed value compared equal. Same-node same-wave DATA
  and RESOLVED are exclusive. R-equals@1 has an explicit replacement transition.
- R-initial retains old first-emit equals wording but lacks activation metadata: stale
  draft text, not a conflict between two current rules. R-ctx-wave-data also lacks
  activation metadata. Code/test behavior must not silently activate either rule.
- User clarified intended invocation: eligible all-RESOLVED settlement invokes raw fn
  after coordinated pending dependencies settle, for one or several deps. Existing gates
  still apply; independent waves need not become one invocation. Record for later Rules
  reconciliation; this discussion does not itself activate a normative revision.
- Keep occurrence, value equality, wave, raw invocation and user callback count distinct.
  One array can contain several DATA; batch has its own R-wave-boundary accumulation.
- Raw waveData[i]: no wave [], RESOLVED [[]], DATA(23) [[23]], DATA(null) [[null]],
  DATA([]) [[[]]], INVALIDATE [[undefined]] in TS. depBatch flattens/removes SENTINEL:
  no wave becomes null; RESOLVED becomes []. It loses some raw distinctions.
- A sender's no-DATA settlement does not guarantee downstream silence: a receiver may
  create DATA. Effect has outgoing protocol settlement without normally producing DATA.
- Wording candidates: explicit raw invocation eligibility/local message meaning in Rules;
  narrower callback/output policies in package API contracts. No wording applied yet.

## Decisions — rationale, revisions, discussion clarification

Canonical locator: ../../authority/ledgers.jsonl. Root rationale:
../../decisions/decisions.jsonl.

- graphrefly:D15 allowed substitution for exactly one DATA and cited skip-fn benefit.
  graphrefly:D49 removed substrate substitution because it destroyed occurrence counting,
  retained DIRTY-balancing RESOLVED, and moved equality suppression to opt-in operators.
  Original commit c845c047bb58e7b3fe897a6f1a1f50d1ce873ebd was checked: those reasons
  were present on introduction, not inferred from current implementation.
- graphrefly:D53 leaves suppression to the fn instead of automatic unread-dep masks.
  graphrefly:D77 preserves wave distinctions. Historical raw field names are not current API.
- User rationale: sugar such as derived/effect deliberately provides restricted common
  value-level usage. Full protocol-aware control belongs to raw node. Lack of waveData
  in value callbacks is intentional, not a capability gap to repair.
- Different wrapper policies are not inherently inconsistent. map was selected because
  report G9 contrasted it with derived/effect, not because it represents every operator.
- No substrate equals restoration or wrapper change is approved. Complete revision-chain
  review remains unfinished. Later graphrefly-ts:D147/D151 concern quiet admission
  boundaries and caller settlement patches; they do not authorize protocol changes.
- graphrefly:B13 concerns accumulator reconnect / merge RESOLVED passthrough; it cannot
  serve as approval for state/derived.equals.

## Work — candidates, owners, acceptance and evidence

Review candidates only, not new canonical work items or implementation authorization.

- Root owner: after walkthrough completion reconcile Rules wording, stale text and activation
  gaps. Acceptance: legal behavior/composition is understandable without reconstructing
  Decisions or Work; no duplication/contradiction or implicit activation.
- TS owner: verify and document policies across per-occurrence transforms, filters/dedup,
  accumulators, multi-input combinations and terminal-driven operators. map is not universal.
- Outstanding: INVALIDATE/SENTINEL interactions, batch and multi-dep boundaries, full historical
  refinements, formal/scenario coverage, and exact G9 report provenance/conditions.

Source inspected: /Users/davidchenallio/src/graphrefly-ts at
`dafc5ae57d446a59a7388214c31bd7a6e73d1519`. At initial inspection only skill files were dirty;
runtime code was clean. Root baseline `7c8569bc31d75f743fa668eff4684418688d353f` had unrelated
campaign changes. Codegraph archive/evals results were excluded as runtime evidence.

Actual checks during this task:

1. From current TS root: `./node_modules/.bin/vitest run packages/ts/src/__tests__/core.test.ts -t 'occurrences stay DATA' --cache=false`.
   Result: 3 passed, 29 skipped; equal, changed and multi-DATA emission.
2. Source-import probe via installed tsx loader, after initialization:
   source(23) -> distinctUntilChanged -> parallel raw/map/derived/effect.
   Repeated DATA(23): equality called once. Explicit RESOLVED: equality called zero times.
   Both cases: raw fn 1 call, map user callback 0, derived user callback 1, effect callback 1.
   distinct/raw/map/effect emitted DIRTY then RESOLVED; derived emitted DIRTY then DATA(46).
   Raw body emitted nothing; derived returned v*2. This confirms the reported wrapper difference
   in this bounded condition, not full conformance or correctness of the rule itself.
   Tool output is retained in the source task. Temporary probe file is no longer available
   at note-writing time; do not present it as a durable evidence artifact.

Code locations in current TS package: node/node-input-runtime.ts (receive/tryRun/runWave),
node/node-output-runtime.ts (DATA output), ctx/types.ts (waveData and helpers),
graph/graph.ts (derived/effect), graph/operators.ts (map/distinctUntilChanged).

No legacy runtime pass flags were treated as new execution evidence. No runtime/spec/decision
ledger mutation was performed by this walkthrough.
