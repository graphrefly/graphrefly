# B121 public API round v1 — author package

## Scope and fixed tasks

This author-only package defines four fresh participant tasks. They assess whether a model can find and use real public TypeScript package APIs using normal documentation plus frozen production source. These are static coding/interpretation tasks, **not executed behavioral tests**, a Graph-versus-plain comparison, or a broad verdict about the library.

| Task | New capability | Main public surfaces | Edge cases |
|---|---|---|---|
| build-filtered-running-total | Build a graph-registered operator pipeline over caller-owned input | graph, core, operators | accepted zero/negative input; rejected occurrences; seed versus emitted DATA |
| adapt-host-push-lifetime | Adapt host input into a lazy source and own one subscription | graph, core, sources | synchronous registration delivery; zero; last versus shared subscriber cleanup |
| report-bounded-downstream-impact | Query bounded directed snapshot reachability | graph diagnostics | cycle exclusion; depth 0; missing origin; conservative truncation |
| read-one-audit-page | Read one bounded typed storage page with continuation | storage | cursor -1; sequence/amount 0; full final page; later appends |

These are fixed at four tasks. The parent round controls sample count, provider, budget and freezing. Do not replace a task after observing a participant answer.

## Novelty and author exposure

The author knew the prior task titles and evaluation-method history. None of these four tasks repeats the earlier spending-display, instance composition, capability handoff, instance inspection, structure export, node-version report, or business-result collector task. The push adapter is a new source-construction/registration-lifetime problem, not merely a renamed display subscriber. The reachability task uses the public diagnostic result's direction/depth/cycle semantics rather than exporting a snapshot. The pipeline constructs actual operator dependencies rather than composing previously supplied domain instances. The storage task handles paging rather than collecting graph DATA.

The author read current implementation and public exports, wrote positive/negative calibration code, and is therefore not blind to the solutions. No prior failed model answer was opened or used as a solution template. Freshness is to participant task exposure, not a claim of independent task authorship, source novelty, or resistance to training contamination. The author knows the expected answers; independent source-based review should precede freeze.

Codegraph was consulted first. It returned archived `archive/evals/.../graph/operators.ts` copies, so current `packages/ts/src` files were read directly. No source/library/harness changes were made by this subtask, and no provider was called.

## Artifacts and boundaries

- `tasks-draft.json`: candidate-entry task shape. Cross-artifact material hash is deliberately pending the parent freeze. Participant instructions use public package imports; virtual snippet is `consumer/__b121_entry_validation__.ts` and entry is `packages/ts/README.md`.
- `rubric-draft.json`: three source-hashed criteria per task, static-scoring policy, author exposure and separate consumer probes. Task hash is pending freeze. Every criterion's evidence path is production source included in the uniform material package.
- `calibration-index.json`: positive and negative cases with expected compile outcome and expected failed static criteria.
- `calibration/`: four positive snippets with explanations, four semantic negatives that **must still compile**, four shape negatives rejected by separate consumers, and four standalone consumer probes. All of this directory is author/reviewer-only.
- `build-drafts.py`: authoring generator; deliberately fixed tasks, no model calls.
- `validate-static.mjs`: trusted compiler capture using parent `materials.json`; compiles snippet plus probe, never evaluates submitted code. It writes `static-validation.json` and `.log` with digests and diagnostics.

The parent round must exclude this entire `author/` tree, rubric and probes from participant materials. Consumer contracts are visible in task text; exact probe source and calibration solutions are not.

## Static validation

Executed `node --max-old-space-size=6144 .../author/validate-static.mjs` with the actual frozen-compiler API against the parent's uniform materials. All 12 criterion/source hashes matched. All 12 calibration compile expectations matched: four positives and four semantic negatives compile; four wrong-return/metadata negatives fail in the consumer probe; zero material diagnostics. The log records each case. No participant code ran and these compile results do not prove runtime behavior.

The semantic-negative expectations come from source-based author review, not an automated semantic oracle: a truthiness filter drops accepted zero; a truthiness push check drops zero; upstream direction violates a downstream request; `nextAfter || after` loses sequence zero. A grader must reject those criteria even though compilation passes. Passing compiler/probe is necessary and insufficient.

## Review concerns before parent freeze

1. **Public resolution**: all imported symbols must remain present in real package exports. Aliases must uniformly mirror package entrypoints, including root. No task-specific compiler shim or source-relative import should rescue an answer.
2. **Fair prompt/rubric alignment**: each scored property is stated in the prompt. Do not enforce the exact positive implementation, variable names, import grouping or prose wording. No unstated naming/format criterion.
3. **Lifecycle interpretation**: push `stop` only releases its own subscriber; another subscriber can retain the registration. Source teardown invokes the optional registrar cleanup; this is not whole-transport/Graph shutdown. The source callback can deliver during registration, so a solution must not delay installing its own receiver.
4. **Conservative diagnostic flag**: current `reachable` marks a depth-boundary node with adjacency as truncated even when adjacency only returns to an already-seen node. This round explicitly measures that existing contract; do not rewrite it to an idealized BFS interpretation mid-round.
5. **Page exhaustion**: the helper uses one extra lookahead record. A full last page may be `done:true`. The boolean describes that read, not durable stream closure or a proof that future appends are impossible.
6. **Coverage limits**: one small deterministic operator pipeline, one source adapter, one diagnostic helper and one storage helper do not establish generic API ease, concurrency safety, all-language parity, runtime correctness, or Graph's advantage over ordinary code. Assess each sample honestly, then feed specific friction back into library/docs for a subsequent version.
7. **Compilation versus runtime**: no callback or submitted function is executed. In particular, the lifecycle and edge-case explanations are source-based acceptance, not measured behavior from the participant implementation.
8. **No hidden pass repair**: if a source/material/rubric contradiction is found after freeze, retain the attempt and mark affected assessment invalid/pending; do not score it as a model failure or fix the answer in place.

## Suggested review order

1. `tasks-draft.json`: task scope and exact caller-owned objects.
2. `rubric-draft.json`: source-pinned acceptance and caller probes.
3. `calibration-index.json` and positive/semantic-negative pairs: what typechecking can and cannot detect.
4. `static-validation.json`: actual checked outcomes and no-material-error evidence.

The parent must set final cross-artifact hashes/pins and independently review before any live dispatch. This subtask ends at authored/static-validated drafts.
