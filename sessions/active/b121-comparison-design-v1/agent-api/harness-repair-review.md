# B121 offline harness review

## Scope and evidence

User authorized offline investigation and repair after the DeepSeek/Together attempt. No provider calls, key changes, new execution grants, or scoring-policy changes in this repair. Baseline: `/tmp/b121-harness-audit-baseline/`; prior dirty work preserved. Input evidence is the immutable `runs/bbadd60cc8e46ee34628fc042c88333bb585e316f72f7ffed4fa9d419367f385/journal.jsonl`; derived aggregate: `harness-diagnostics.json`.

## Findings and implemented repairs

- **Patch:** malformed model operations incorrectly sealed unanswered cases as budget-exhausted. They now remain missing, with the exact fatal cause separately retained. Timeout and genuine budget stops keep their original statuses. Scores and denominator are unchanged.
- **Patch:** forecast-based budget stops lacked an explicit reason/remaining allowance. They now record both without asserting actual exhaustion. Frozen run evidence is unchanged.
- **Patch:** prepared manifest described the transferred forecast as calibrated. It now explicitly says unqualified for the new model. Regenerated manifest remains disabled and requires a fresh exact grant.
- **Evidence:** executed requests' forecast/actual ratios were 1.407, 1.395, 1.404 and 1.439. These are observations, not safe replacement multipliers. Blocked requests have no actual token measurement.
- **Evidence:** first three sessions stopped with 8,627 / 20,204 / 13,983 actual input tokens left. Estimated next inputs were 10,394 / 20,855 / 19,078. Context is resent cumulatively; cache discounts reduce money, not the cumulative input-token measure.
- **Evidence:** broker schema exposes `requests` as a string. The provider can constrain the outer envelope without enforcing the JSON nested inside. The failed operation used `tool: read_file`; the documented shape was `op: read`. This is an eval-tool instruction failure, not a GraphReFly API call.
- **Keep:** same 48k/8k session limits, evidence material, role/arm ordering, fixed denominator, exact pricing, no model fallback, no runtime code changes.

## Proposed next eval revision — not implemented

1. Expose operation objects directly through a typed tool schema, including operation enum, allowed fields, phase and vocabulary. Runtime validation remains mandatory. Provider schema support must be qualified; never claim JSON-schema enforcement from metadata alone.
2. Measure input with a verified matching tokenizer if available, including chat/tool formatting. Otherwise retain a visibly heuristic forecast and test representative full-session traces offline. Do not divide estimates by the observed 1.4 ratio and claim a bound. Compare compact batching against current trajectories without silently discarding evidence/history or enlarging budgets.
3. Isolate participant-format failure: seal that session as failed/missing and move to the next independent slot without a repair prompt or retry. Keep global stops for qualification, route/identity, accounting, exhausted spend, transport failure and persistence errors. Existing manifest explicitly says malformed responses stop the campaign, so revise and review that contract before changing execution. Keep all failed and unrun slots in the denominator.

Acceptance before another paid run: real serialized operation schemas exercised for read/submit/entry and malformed variants; no future-phase exposure; synthetic complete A/B plus entry traces assessed under original budgets; a participant failure followed by a fresh independent slot; global failures still stop; no score gains from dropping failed slots. An offline feasibility result is not model-success evidence.

## Verification and suggested review order

112 comparison tests passed. A new regression test checks that malformed output retains charges and marks unanswered items missing. Offline diagnostic test covers qualification exclusion, separate sessions, estimate-versus-actual, and unknown blocked-request usage. Local blind/edge/verification passes used for this focused repair; no independent review claimed.

Review attribution in `scripts/b121-comparison/api-runner.mjs` first, aggregate evidence in `harness-diagnostics.json` second, then `api-diagnostics.test.mjs` and the malformed-operation regression in `api-runner.test.mjs`. Broader schema and failure-isolation changes remain proposed; B121 is not complete.

## Structured controller revision v2 — implemented after user continued

This follow-up implements the preceding native-array and participant-isolation proposal within B121. It does not authorize a provider run or change the scoring/material/token-budget contract. Baseline `/tmp/b121-structured-baseline/` preserves the prior dirty tree. Frozen proposal and bundle are now v2; old attempt directories remain unchanged.

### Implementation

- `api-tool.mjs` publishes native operation arrays with exact list/read/judgment/entry object shapes, seven typed fields, phase/scenario/concept enums and bounded lengths. It requests strict function arguments, but provider enforcement is unqualified. Answer vocabulary remains enforced by the runtime using the visible packet; it is not injected from hidden grading material. References: https://openrouter.ai/docs/guides/features/tool-calling and https://openrouter.ai/docs/guides/features/structured-outputs .
- `api-runner.mjs` explicitly tags malformed broker JSON/operations and unavailable paths as participant errors. Their unanswered items remain missing, charges remain counted, and there is no correction prompt or participant retry. Unexpected infrastructure, usage, identity, replay and persistence failures remain campaign errors.
- `api-campaign.mjs` continues only after explicitly tagged participant errors; every new slot has fresh history/controller/budget. The fixed denominator remains 1344. Summary includes the failed participant IDs and reasons even if campaign-wide failure is null.
- `api-prepare.mjs` binds the new schema, declares both failure scopes and remains execution-disabled. Prior live grants cannot match the new manifest.

### Budget feasibility, not a successful model evaluation

`api-feasibility.mjs` runs the real controller with synthetic size estimates, no network or credentials. `feasibility.json` retains 48 plans: 12 slots × mandatory/optional relation expansion × focused/all source expansion. Both mandatory-only variants complete A/B in all 12 slots under the heuristic (~40.3k input). The six P slots finish. All six G slots stop before their first entry/task read: ~19.1k next-request estimate versus ~7.7k left. Reading optional relations instead stops all slots after A. Entry source variants therefore remain untested beyond their planned inputs.

These are synthetic formatting probes, not correct answers, exact token counts or proof the model cannot fit. No guessed tokenizer multiplier, context deletion or budget increase was applied. Source selection for focused entry is an explicit audit assumption, not a proven minimum. The new schema still requires real provider qualification before any later live inference.

### QA and review order

119 comparison tests pass; scoped Biome check has no errors (existing style suggestions remain). Independent blind and edge reviewers found the same entry path coercion bug: an array could pass key lookup and then throw a global TypeError. Fixed with a participant-scoped string check; four malformed path forms now have regression coverage. Verification reviewer found the old any-fatal flag in the proposal; replaced it with explicit failure scopes and a proposal test. No unresolved implementation finding from these passes.

Review concerns in order:
1. Failure isolation: `api-campaign.mjs` participant loop → `api-runner.mjs` typed failure classification → real campaign tests for qualification/global route failure/12 fresh participant failures and unchanged denominator.
2. Tool contract: `api-tool.mjs` native schema → schema/parse tests → entry malformed-path tests. Runtime validation remains required even with strict requested.
3. Budget evidence: `api-feasibility.mjs` real-controller synthetic replay → `feasibility.json` mode summaries and limitations. Do not treat the 48 synthetic trials as 48 paid or independent model experiments.

### Remaining design choice

Recommended next revision: keep the A/B evidence-judgment comparison intact, but evaluate Graph code entry separately with fresh context and its own original-sized 48k input/8k output budget. Report it as a distinct code-usability exercise, not continuation under the old combined budget or proof against a matched plain-code task. This recommendation changes the prior post-A/B, shared-budget condition and is not implemented here. No new paid run is authorized.

## Independent code-entry revision v3 — user approved and implemented

The user approved separating code entry into fresh contexts with independent 48k input / 8k output budgets, while preserving the A/B comparison. This is an offline harness revision within B121, not a live/spend grant or GraphReFly runtime semantic change. Baseline: `/tmp/b121-split-baseline/`.

### Final behavior and acceptance

- 12 A/B comparison sessions end at seal B. They retain their original material, ordered questions, per-session limits and fixed score denominator 1344. Their completed count no longer depends on an entry submission.
- Six G entry sessions run afterward with unique `-entry` IDs, independent history and original-sized 48k/8k/80-operation/75-minute budgets. They can run after comparison participant failures; campaign-level failure prevents further dispatch. The same campaign-wide money, call and replay controls remain in force.
- Entry requests receive only entry instructions and role/session metadata. Entry exposes only its own task/source map, returns `controller:null`, cannot read A/B files, and cannot fabricate comparison seals. Its results, started/completed/unrun counts and failures are separate from comparison scoring.
- Standalone code review explicitly requires `experiment:'entry'`, Graph arm, null comparison controller, exact role/task/source bindings and exact submission/reviewer binding. Compilation does not execute participant code. Successful compilation alone remains pending trusted review. Independent results do not claim a comparisonProof.
- Proposal/bundle are v3, frozen with 18 unique sessions and the new source bindings. Maximum generation calls: 1444 (18×80+4 qualification). Normal full study token envelope: $0.432 before qualification, cache discounts or retries. Local $2 envelope remains proposed and actual dispatch disabled; a new live grant would need these exact bounds.

### Offline evidence and limits

36 size-estimated synthetic trajectories exercise the real runner: 24 comparison (mandatory/optional relations) and 12 independent entry (focused/all source). Required-material A/B completes 12/12; expanded relations completes 0/12. Focused independent entry completes 2/6 (user role); framework/maintainer 4/6 still hit cumulative input limits. All-source entry completes 0/6. Therefore splitting helps but does not establish all tasks are ready for a paid run. The source selection is an explicit audit assumption; more selective reads may behave differently. Do not equate this heuristic forecast with actual tokenizer/model usage or library usability.

`feasibility.json` retains planned and unconsumed batches, synthetic usage, source/bundle hashes and explicit zero-provider-cost labels. No old run journal or score was rewritten. No new provider calls, credentials, key limit changes or billable retries occurred.

### Verification and review trail

124 comparison tests passed, followed by 62 runner tests including two additional isolation/reset regressions (126 unique tests in final suite). Independent blind and edge reviewers found no actionable split regression. Verification checks cover exact frozen entry maps, real campaign dispatch and offline review, separate summary counts, the original denominator, global-stop cases, source drift, no comparison-file access and independent near-limit input budgets.

Concern order for review:
1. `api-campaign.mjs`: 12 comparison runs, then six standalone runs; separate rows/counts and common global cost/replay guard.
2. `api-runner.mjs`: mode-specific instructions/maps/controllers and budgets; `api-entry-review.mjs` / `entry-tasks.mjs`: standalone acceptance without invented A/B proof.
3. `api-prepare.mjs`: frozen v3 session identities and full cost/call envelope; `api-feasibility.mjs` and `feasibility.json`: remaining budget constraints, not a model success claim.

This completes the authorized offline split. B121 and real code-usability evaluation remain incomplete. Further work should investigate bounded, targeted source-reading trajectories before another paid trial; do not automatically enlarge budgets or silently shrink tasks to turn this evidence green.

## Targeted source-reading audit — offline only

The user requested continuing the investigation of targeted reads after the independent split. Baseline `/tmp/b121-targeted-baseline/` preserves the previous dirty state. Only the offline feasibility probe/tests and derived evidence changed; participant material, runtime controller, task requirements, scores, caps and frozen live inputs remain unchanged.

The previous task-focused plan unnecessarily read the entire Graph implementation for framework and maintainer roles. A third author-selected navigation probe now keeps every non-Graph file from that plan and narrows Graph reads to its class declaration; maintainers additionally retain the complete `describe` and `_describe` method spans. TypeScript AST locates these spans from reconstructed frozen chunks; the source SHA is checked before selection. Every intersecting 80-line chunk is retained, without clipping function bodies. No goldens, reference snippets or model-generated answers select the paths.

With the same size heuristic and original cumulative limits, all six targeted entry trajectories finish their synthetic envelopes. Estimated inputs: user 23,223; framework 10,776; maintainer 21,929 tokens per session. This is 6/6 **serialization feasibility**, not 6/6 correct task solutions. Outputs remain placeholders; realistic code/explanations or extra search turns cost more. The earlier whole-file and all-source failures remain visible in the 42-trajectory report.

Crucially, this audit does not prove that an independent model can discover these locations, that the selected excerpts suffice semantically, or that GraphReFly is easy to use. The author-selected paths were not added as model hints and no task requirement was removed. A practical next experiment would measure source discovery with a neutral navigation/search facility, independently from code correctness; this audit does not silently add such a facility or authorize a paid run.

Verification: 128 comparison tests pass. Five targeted feasibility tests cover all allocations, full histories and budgets, preservation of non-Graph reads, complete method-span chunk coverage, and rejection of frozen-source drift. Scoped Biome clean; frozen live input verification passed. Focused local QA lenses used; no independent-review claim for this small audit-only change. Review `api-feasibility.mjs` targetedGraphChunks → syntheticPlan → report limitations, then `api-feasibility.test.mjs` and `feasibility.json`. Zero provider calls and actual cost $0.

## Neutral source navigation — v4 prepared offline

User continued source-discovery work. Baseline `/tmp/b121-navigation-baseline/` preserves prior dirty work. Added `source-navigation.mjs`: deterministic per-file indexes from the already supplied TypeScript source, with names, syntax kinds and one-based declaration/method line spans. No role, task, answer, reference snippet or rubric input participates in generation. Source hashes and parse validity are checked. All roles receive identical indexes; all original source chunks remain accessible.

`entry/task.json` links per-source navigation maps under `entry/navigation/`. Entry instructions explain locating chunks from line ranges and require implementation source for evidence. Index reads use the existing read broker, consume ordinary operations/tokens and do not count as first implementation-source inspection. A/B cannot read them. No new tool verb, filesystem access, model/provider change or budget change was introduced. Frozen proposal/bundle are v4 and bind the generator plus generated material.

The new indexed-targeted trajectory pays for an additional navigation-read turn before the unchanged targeted source reads. All six synthetic entry trajectories still fit the original limits: user 42,234 estimated input / 950 output, framework 26,119 / 665, maintainer 36,406 / 854. These are placeholder formatting probes, not complete correct solutions. Source selection remains author-planned; no independent model discovery or solution quality is established. In particular, the user-role trajectory has only about 5.8k estimated input allowance left, so extra discovery turns may exhaust it. The 48-trajectory report retains earlier broader-read failures too.

Verification: 132 tests passed; scoped formatting/checks passed with existing style suggestions. Independent blind/edge/verification reviews found no runtime issue. Fixed the test that counted navigation maps as source chunks and the stale claim that no navigation had been added. Exact frozen input validation passed. No inference calls, key changes or added spend occurred.

Review trail: source-navigation.mjs (source-only construction and hash guard) → api-prepare.mjs (uniform entry maps/frozen binding) → api-runner.mjs (entry-only read and instructions) → api-feasibility.mjs indexed-targeted (metered navigation overhead). Actual model discovery, strict schema adherence and code correctness remain live/unverified; a later paid campaign needs a new explicit grant bound to v4. B121 remains incomplete.

## v5 — bounded search and source line reads (offline)

User approved implementing grep/rg-style search and original-path line reads; code graph is a fallback if needed. Owner remains B121's root eval controller, with the same frozen nine TypeScript sources, tasks, judgments and per-session budgets. No library/runtime semantics changed. This is a local harness repair and offline evidence, not a live/spend grant or durable decision. Git HEAD, staged/unstaged/untracked state and full pre-edit source/evidence snapshots are retained at `/tmp/b121-search-baseline`.

Acceptance: given the frozen source map, literal search returns only matching source paths/line numbers with bounded snippets and deterministic pagination; range reads preserve original lines, cap 80 lines/12,000 serialized bytes and return a continuation line. Hidden files, navigation storage, raw chunk paths, filesystem traversal, wrong phases and malformed operations remain inaccessible/participant-local. Empty matches and EOF are valid results; invalid ranges fail explicitly. No shell/network/provider/MCP capability is handed to the participant.

Entry has its own strict tool schema and initial task instruction. The former shared description's `orientation.json` instruction contradicted independent entry materials; removed from shared broker and replaced by mode-specific session instructions. Qualification now exercises entry search/range shapes in its existing four-call envelope. Both allowed exact schemas remain enforced by transport configuration validation. Old live runs are untouched and v5 manifest is disabled pending a new explicit grant.

Storage chunks and source-derived declaration indices remain internal/offline audit data; entry list/read/search exposes only task metadata and original source paths. Retrieval reconstructs and verifies source hashes; it never queries the mutable workspace. Codegraph MCP is available to the coding agent, but exposing its unrestricted workspace index would violate the frozen participant boundary. No codegraph integration or index initialization is claimed in v5. Literal search is implemented in-process (rg -F semantics, case toggle), not arbitrary shell/regex execution.

Verification matrix: real-source search → range → submission; comparison denial; hidden answer and traversal rejection; stable pagination and prefix filtering; Unicode/long lines/byte cap/EOF; malformed operations participant isolation; source hash drift; synthetic campaign qualification with distinct schemas; unchanged call/token accounting and frozen bindings. Search-guided feasibility uses author-selected queries, returned line locations, bounded neighborhoods and placeholder submissions, not a correct solution or model-discovery proof.

Suggested Review Order: `api-runner.mjs` (entry dispatch/schema/instructions) → `source-access.mjs` (source-only boundary and bounded output) → `api-tool.mjs` + `api-transport.mjs` (strict provider contract/qualification) → `source-access.test.mjs`, `api-runner.test.mjs` and `api-feasibility.mjs` (actual broker consumer and honest offline evidence).

Final v5 evidence: `node --test scripts/b121-comparison/*.test.mjs` passed **139/139** (`/tmp/b121-search-final-tests.log`); scoped Biome completed with no errors/warnings (style infos only); frozen bindings verified. `node scripts/b121-comparison/api-feasibility.mjs` ran **54** synthetic trajectories: search-guided **6/6**, input estimates user **11,493**, framework **10,450**, maintainer **20,084**. Whole-source **0/6** and expanded-relations **0/12** failures are retained; no budget inflation or selective removal. Three independent read-only QA lenses completed. Two concrete patch findings were fixed: obsolete qualification first-read instruction, and null broker-operation TypeError escalating to campaign scope. Null/non-object regression is now exercised in both experiments. Entry tool/schema hashes are explicit in bundle/feasibility metadata. No unresolved blocking findings.

New disabled manifest SHA: `2ed7b40707b08f8645d6d40e5b7709e87a10e65329b7ea43763490d154b211ab`. Provider calls **0**, new spend **$0**. No codegraph MCP connection, provider trial, B121 completion, or independent model usability success is claimed.

## v6 — retrieval defaults and recoverable argument errors (offline)

User explicitly approved simplifying reads and allowing correction of retrieval errors inside the existing budgets. This is a B121 controller repair; no new provider run/spend grant, model change, library semantic change or work/decision record. Baseline: `/tmp/b121-retrieval-recovery-baseline` retains Git state plus pre-edit sources and evidence.

Read accepts a source path alone (first bounded page), either bound independently, both bounds, or null defaults. Oversized ranges are capped to 80 lines and 12,000 serialized bytes, with nextLine pointing to the next unread line in the requested extent. Original source path/hash/line numbering remain explicit. Task metadata is still distinct from source text. Range/query/pagination mistakes return ok:false with recoverable argument feedback; results enter the ordinary paired tool history and every operation remains charged. Denied paths, malformed envelopes/submissions and unrecognized operations retain participant-stop behavior. Frozen corruption and infrastructure failures retain their existing global-stop behavior. No automatic provider retry, budget reset, answer correction or hidden material access was added.

Acceptance evidence: defaults, 80..160 off-by-one and 1..130 oversized requests, independent start/end and nulls, EOF/byte continuation, invalid-range feedback followed by correction in real runner, mixed successful/error batch, denied path after feedback, and 80 repeated errors exhausting the existing operation budget. Schema acceptance tests cover all new read forms. Three independent read-only lenses found optional-bound wording/runtime mismatch and missing provider-schema regression coverage; both fixed and tested. No remaining blocking finding.

Final checks: **145/145** full B121 tests pass (`/tmp/b121-recovery-final-tests.log`); scoped Biome no errors/warnings, style infos only; `git diff --check` clean; frozen bindings verified. `retrieval-recovery.json` replays all **6/6** v5 failed entry retrieval batches successfully with the new bounded semantics. This proves the observed failing requests are handled, not that complete future model sessions or submitted code will succeed. The 54-trajectory offline feasibility report is regenerated without network or model calls.

Disabled v6 manifest SHA: `b1c687f0b41d5d1b1a7e78cf72adcb73765d1607597a583d5aed7b0bde7c482e`. Provider calls **0**, spend **$0**. Earlier live claims and results remain unchanged. Review order: `api-tool.mjs` (participant contract) → `source-access.mjs` (bounded defaults versus recoverable/denied classification) → `api-runner.test.mjs` (history and original budget termination) → `retrieval-recovery.json` (observed failure replay).

## v7 — distinguish failed generation billing from successful pricing (offline)

User approved offline repair after the v6 HTTP200 error-finish incident. This is B121 transport/receipt handling, not a library semantic change, new recovery class or spend authorization. Baseline `/tmp/b121-error-response-baseline` retains the complete pre-edit Git/source/evidence state. Existing paid runs remain immutable.

The transport now classifies any error-finish response before applying success-only pricing arithmetic, after existing route/replay checks. Failure receipts validate token/cost quantities and retain top-level provider-reported billing independently of upstream compute cost. Valid zero is zero, valid positive cost remains recorded even above reserve, and missing/malformed usage retains the unknown reservation. Failure billing diagnostics are explicit alongside the original envelope. No output or broker operation is accepted from a failed generation. Unknown retryability remains terminal; HTTP/network recovery uses the existing CSP11 policy without expansion. Success pricing audits remain unchanged.

Acceptance/verification: zero cost versus nonzero upstream detail; absent/negative/string cost; positive over-reservation charge; correct failure token accumulation; retained unknown reservation; wrong-route rejection; unchanged success pricing; no tool dispatch, wait or retry for error-finish. Full B121 suite **149/149** passed (`/tmp/b121-error-tests.log`), three independent read-only QA lenses found no blocking issues, scoped Biome had no errors/warnings (style infos only), frozen bindings verified, `git diff --check` clean. The exact v6 failed response was replayed through fake HTTP (`error-response-replay.json`): failureKind provider-generation-error, billed $0, upstream compute $0.0032289, unknown reserve $0, one synthetic dispatch, no retry. This is classification/accounting evidence, not a claim that the upstream failure is repaired or that another campaign would complete.

Disabled v7 manifest SHA: `f14b20fe8ed933b216b8a614300a02a77b9f4d34de9761a56391ad67490ebe99`. Provider calls **0**, spend **$0**. Review order: `api-transport.mjs` error-finish branch → `api-provider.mjs:readFailedGenerationUsage` → appended runner/transport regression tests → `error-response-replay.json`.

## v8 — provider window and cumulative budget (2026-09-16)
User explicitly authorized related edits and reruns until success or funds exhausted. Existing cumulative USD2 remains enforced, including retired key USD0.022818016 and current key USD0.396120504 before v8. Together metadata freshly checked: context1048576, max completion943718, max prompt null (not unlimited), status0, input/output USD0.30/1.20 per million. API-specific cumulative input200000 per session replaces48000; output8000 and operations80 unchanged. Legacy offline session defaults remain48000. Combined request context checked before dispatch and against successful/failed receipts. Shared controller accepts frozen explicit limits; manifest cost derived from API limits (18-session token maximumUSD1.2528). Three independent read-only QA lenses completed; fixed missing combined-context failure receipt check, strengthened near-limit comparison submission regression, and preserved context-stop diagnostics. Fallback controller limit aligned for consistency; no demonstrated grading impact. Full offline suite151/151 passes. Offline feasibility 54/54; probes are synthetic serialization evidence, not usability. No library behavior or scoring changes.

## v8 live evidence and v9 repair (2026-09-16)
V8 run `837c281f2a4a0eb74396dae8907b0aef529ed1425e74ce25744b2d8425720a01`: 12 comparison slots ran, 11 complete, 185/192 answers. Six entry slots ran, none submitted: four cumulative-input stops and two fatal unmatched search prefixes for unprovided contracts.ts. 143 generation calls, USD0.164522484 reconciled against key; cumulative USD0.583461004, remaining USD1.416538996. 1236 journal records verified. Frozen source bindings verified before further edits. No infrastructure failure or unknown reservation.

V9 follows the user's standing edit/rerun grant. Cumulative input raised to1000000 per session; provider combined request window remains1048576, output8000/session, operations80. Safe unmatched search prefixes now return recoverable argument feedback, with list/empty-prefix correction; traversal, absolute and backslash paths remain rejected. No read-map expansion, no grading or reference-answer changes. Theoretical 18-slot token maximumUSD5.5728 exceeds authorization; manifest explicitly distinguishes this from the cumulative USD2 dispatch ceiling, which includes all prior usage and retries. Targeted independent edge review found no new defect. 152/152 offline tests passed; 54/54 synthetic feasibility trajectories complete. Live v9 launched under standing grant with fresh key/route checks, preserving all previous attempts.

## v9 provider interruption and v10 attempt identity (2026-09-16)
V9 `a47fc6f9b79f50d6348eb8787afcf5e15d364f58cdf401661dd5b860f5294c30`: first qualification request503; existing availability retry succeeded. First two comparison sessions completed, including one using202326 input tokens beyond prior200k. Third comparison stopped on provider finish_reason=error, cost0, no diagnostic reason permitting automatic request retry. 32 generation calls, USD0.021276156 eventually reconciled. Cumulative known USD0.60473716; unknown503 reservationUSD0.3151872 is carried forward, conservative committedUSD0.91992436. 258 journal records and frozen bindings verified before v10 edits. Initial key poll lagged; settled-reconciliation.json supersedes its billing totals.

V10 adds optional trusted attemptId to the manifest-bound exclusive claim directory. Reusing same manifest/attempt fails before HTTP, distinct authorized attempts retain independent artifacts; default legacy directories remain supported. No implicit dispatch or grant follows from an ID. Offline review binds the full journal claim approval to the persisted approval so journals from two same-manifest attempts cannot be interchanged. Three independent QA lenses reviewed; one evidence-association finding fixed with actual swapped-journal regression. 152 tests passed before final review repair; affected10 campaign/entry tests pass after that repair (first repair test failure was fixture /var vs /private/var path alias, then corrected to actual returned directory). V10 authorized-r1 launched under standing grant, carryingUSD0.3151872 unknown reserve into priorUsageUSD. Token limits and rubric unchanged fromv9.

V10 final:152/152 full offline tests passed. Live ec081c7e1b89bf9b2997cafb0d7f86f456af8d7e39813f05eae56d98a69736a2--authorized-r1 stopped at cost gate:12 comparisons ran,9 complete,161/192 answers;4entry started,0submitted,2unrun. Three entry1M cumulative stops, fourth interrupted by safe dispatch budget.225generation attempts;USD0.193837428 settled. Final cumulative knownUSD0.798574588; carried/current unknown reservesUSD0.9541632; conservative remainingUSD0.247262212 cannot cover nextUSD0.319488 full-context reservation.1867journalrecords and sourcebindings verified. See provider-limits-outcome-20260916.md for concern walkthrough and exact limits. No more live requests under current budget; study remains incomplete.
