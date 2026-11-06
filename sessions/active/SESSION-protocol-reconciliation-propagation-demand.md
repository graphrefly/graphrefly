# Protocol reconciliation: propagation and demand

DS-16. Non-normative interactive review opened 2026-09-17.
Continues DS-15, which remains active with its outstanding items intact.
User-authorized scope: walkthrough review, followed by the 2026-11-05 Rules/Decisions/Work
reconciliation. Runtime implementation, commit and push are not part of this slice.
The accepted directions now have D796 draft rule revisions; B140 tracks verification and explicit activation.

Current reading entry: [review map and current cursor](#review-map-and-current-cursor).
The [2026-10-05 continuation and handoff](#continuation-reconciliation-and-migration-handoff-2026-10-05)
is historical migration context, not the current review cursor. Later explicitly accepted refinements
control the review direction; preserve their approval/scope rather than infer acceptance by date alone.

## Reconciliation handoff — Rules, Decisions and Work

Updated 2026-11-05 after the user's final version-policy approval and instruction to consolidate.
The semantic walkthrough has reached its agreed closure. This handoff is the current reading entry;
the older chronological proposals remain provenance, not competing current choices.

| Surface | Unique body / reading order | Status |
| --- | --- | --- |
| Rules | [spec/rules.jsonl](../../spec/rules.jsonl), the 50 rows introduced_by D796: 42 successor revisions plus 8 new rule IDs. Start with wave framing/notification, then input/invocation, control/publication, lifecycle/ownership and recovery/revision. | Accepted design expressed as draft contract. Existing activated predecessors are unchanged; new rows have no activated_by. |
| Decisions | [graphrefly:D796](../../decisions/decisions.jsonl), question/rationale and concern-scoped predecessor supersession. Detailed alternatives/approval traces remain in DS-15/DS-16 below. | Root protocol rationale admitted. Package-local operator/API implementation stays with its owner; no per-attempt or per-wording decisions. |
| Work | [graphrefly:B140](../../plan/backlog.jsonl), eight acceptance groups for reconciliation, formal, conformance, owner routing, provenance/consumer evidence, encoding and activation. | Planned integration/verification, not runtime dispatch or completion. |
| Verification obligations | [C-28 through C-39](../../spec/conformance.jsonl). All three runtime outcomes are todo. | Authored discriminating traces, not passing harnesses. Formal reconciliation is explicitly pending under B140. |

The new Rules state behavior; rationale is in D796 and delivery requirements are in B140. No second
protocol Markdown body, decision ledger or sequencer is introduced. Read the new set by its D796
revision membership, not by picking every historical row or treating dashboard rule-ID coverage as
revision-qualified evidence. The [revision manifest and receipts](#rules-reconciliation-output-revision-manifest-and-validation-receipts-2026-11-05)
below give the exact activation boundary and remaining work.

## Review map and current cursor

Updated 2026-11-05. This is navigation within the existing indexed DS-16 session, not a new
protocol/decision/work ledger. Detailed source discussions, alternatives and receipts remain below.

### Rules — authority and review status

- **Current protocol:** resolve activated revisions from [rules.jsonl](../../spec/rules.jsonl) under
  [the authority contract](../../authority/README.md). This session does not activate rules.
- **Accepted review direction:** explicitly approved design recorded here; normative amendments,
  formal/conformance work and runtime implementation can still be pending. Acceptance is scoped.
- **Proposal / open question:** not approved. An old heading saying "proposed" or "not selected"
  records that turn's status; follow its later explicit acceptance/refinement before reusing it.
- **Evidence:** source inspection or a bounded run establishes only the stated behavior/scope.
  Current baseline probes do not validate the proposed replacement runtime.

### Decisions — thematic navigation

Rows locate accepted directions and their rationale, not independent canonical rule bodies.
Open details and verification limits remain in the linked source and the work section below.

| Concern | Review direction / latest entry points |
| --- | --- |
| Wave framing, DIRTY and batch | [Live prefixes/idempotent membership](#user-accepts-qa-9-live-prefixes-and-idempotent-dirty-membership-2026-10-14); [batch ownership/occurrence accumulation](#user-accepts-qa-18-four-directions-nested-batch-and-reporting-addendum-2026-10-18). |
| Partial startup and abandoned computation | [Progressing partial versus abandonment](#user-accepts-progressing-partial-versus-abandoned-setup-distinction-2026-10-14); [prior legitimate results](#user-accepts-earlier-result-delivery-after-later-setup-failure-2026-10-14); [installed-rewire scope and minimal marker](#failed-installed-rewire-abandonment-accepted-shared-lifetime-identityphase-proposal-2026-11-05). |
| Lifecycle identity and internal storage | [Accepted current-lifetime owner/derivations](#lifetime-owner-shape-accepted-and-record-organization-2026-11-05); [full logical state/buffer inventory](#unified-checkpoint-statebuffer-coverage-audit-2026-11-03-design-review-no-runtime-changes). The small shape is logical, not a locked physical layout. |
| Cancellation and cleanup | [Managed cleanup contract](#user-accepts-consolidated-cleanup-contract-2026-09-27); [signal close order/native errors](#signal-close-ordernative-errors-accepted-lifecycle-compatibility-and-minimal-reason-proposal-2026-11-03); [default reason and lazy access](#lazy-signal-direction-accepted-return-to-unified-lifecyclesetup-representation-2026-11-04). Switch policy stays helper/operator-owned. |
| Terminal handling and execution retirement | [Grouped terminal policy](#user-accepts-grouped-terminal-policy-defaults-defers-completeany-2026-09-29); [subscription/resource retirement](#qa-21-terminal-subscription-execution-cleanup-and-retain-scope-2026-10-18-accepted-direction) and its subsequent rewire/retention refinements. |
| Subscription admission, initialization and reentry | [Origin/admission matrix](#user-accepts-qa-16-main-matrix-hook-origin-addendum-and-qa-17-fanout-2026-10-16); [START-array initialization](#qa-1qa-2-initial-snapshot-recognition-from-the-start-array-2026-10-18-accepted-direction). Follow later immediate-adapter and same-callback/fresh-execution qualifications. |
| Upstream routing and stable connections | [Invocation-bound routing](#user-accepts-invocation-bound-directed-ctx-routing-2026-09-29), followed by topology-owned connection identity, removal/re-add and deferred-delivery checks in the chronological review. |
| PULL, pause and buffered publication | [Old backlog outside enclosing batch ownership](#qa-27-batch-independent-backlog-accepted-lifecycle-checks-and-start-ownership-clarification-2026-11-03); [latest parameterized PULL service after backlog](#parameterized-pull-after-backlog-accepted-compatibility-check-and-d30-cancellation-provenance-2026-11-03). No-demand quiet and one latest owed slot remain distinct from the output FIFO. |
| Replay and retained snapshots | [Uniform ordinary replay](#qa-27-ordinary-replay-accepted-checkpoint-history-roundtrip-and-minimal-representation-proposal-2026-11-02); [stale/rebase and mixed-time diamond](#graph-namespace-continuity-accepted-replay-consistency-and-remaining-diamond-boundary-2026-11-03), followed by explicit mixed-time acceptance. |
| Restore, input receipts and versions | [Revision/valueRevision naming and baselines](#qa-22-revisionvaluerevision-names-accepted-baseline-establishhandoffinvalidate-review-2026-10-29); [compact receipts](#qa-22-compact-ended-input-checkpoint-record-accepted-compatibility-audit-advances-to-qa-23-2026-10-29); [live-receipt/buffer inventory](#unified-checkpoint-statebuffer-coverage-audit-2026-11-03-design-review-no-runtime-changes); [graph namespace/observation continuity](#graph-namespace-continuity-accepted-replay-consistency-and-remaining-diamond-boundary-2026-11-03). |
| Public inspection | [Three-state cache projection](#qa-24-three-state-cache-accepted-combined-review-advances-to-qa-25-2026-11-02). Public status remains derived {cache,output,lifecycle}; setup outcome is internal admission information. |
| Failure reporting and observer feedback | [Runtime-origin host reporter](#qa-25-environment-reporter-accepted-entryreentry-qualification-advances-to-qa-26-2026-11-02); [unrestricted completed-wave feedback](#qa-26-unrestricted-observer-feedback-accepted-qa-27-output-array-ownership-2026-11-02). No implicit retry, error-history store or runaway cap was selected. |

### Work — current cursor and unresolved scope

**Current cursor:** [Rules reconciliation output and validation receipts](#rules-reconciliation-output-revision-manifest-and-validation-receipts-2026-11-05).
The [received-input proposal](#received-input-records-retained-facts-unconsumed-occurrences-and-dirty-membership-2026-11-05),
[current-code comparison](#received-input-proposal-versus-current-code-reduction-candidates-and-invalidate-caveat-2026-11-05)
and [paused INVALIDATE reconciliation](#input-simplification-direction-accepted-paused-invalidate-already-selected-contract-2026-11-05)
remain the integration basis; field deletion is not implemented or mechanically safe. Output-owner,
invocation-start consumption, notification-reference/rollback-overlap and deferred compensation
publication-time validation are accepted. Cache freshness encoding/transitions and the node-local
pending-publication FIFO/cursor, operation-specific admission and entry-point update ordering are
accepted. The combined closure audit consolidates those facts and distinguishes remaining version/
API choices from verified operator implementation gaps. Current-snapshot hash and the qualified
operator DATA-before-terminal repair direction and the clarified existing private-retention surface
are accepted. The user has also accepted always-maintained base positions and removal of the automatic legacy
DATA counter. D796 now records rationale, its candidate rule set supplies the contract, and B140
records verification/activation work. Encoding and evidence gaps are not a reason to restart the walkthrough.
The small current-lifetime owner/derivation shape is accepted. Continue input/output/queued-work
integration using the existing inventory; do not reopen signal/abandonment choices merely to rename fields.

Keep these categories separate:

| Category | Still to do / boundary |
| --- | --- |
| Remaining design integration | Minimum-state/owner synthesis is recorded in the combined closure audit, with no new contradiction found among the selected directions. Resolve its remaining policy recommendations and concrete operator findings; exact TS names/packing are not new protocol states. |
| Explicit acceptance audit | Final user approval now selects always-maintained revision/valueRevision, optional current-snapshot hash and no automatic DATA counter. Exact encoding/previous-CID/schema work must remain consistent with that choice; it is not implicitly implemented. |
| Original consumer qualification | Locate/recover the originally referenced job-pool/dependency-manager consumers; scoped current-source searches found no matching paths. Their compatibility is not verified or closed. |
| Earlier-session provenance | Preserve DS-15/G9 and remaining history/formal/Work-reconciliation follow-ups from the migration handoff; this map does not claim them completed. |
| Normative reconciliation | Enumerate affected active/draft rule revisions and explicit supersessions, including D30's cancellation half. Keep Rules concise and independently understandable; do not silently turn session agreement into activation. |
| Implementation and evidence | Amend formal/conformance/runtime only in their separately authorized workflow. Existing TS baseline lacks several accepted contracts. No complete-runtime, all-QA or cross-runtime pass claim follows from this review. |

**Already deferred:** request ACK/correlation/idempotency (user land), run while another dep stays
DIRTY, downstream-requested restart, multi-node recovery wrapper, complete:any, deep cloning,
persistent cleanup-failure blockade and restoration of currently unsupported execution states.
Do not relabel them pending core requirements or reopen them without a concrete request.

### Work — evidence entry points

[Portable diagnostics directory](protocol-reconciliation-probes/) contains reconstructed baseline
cases. Detailed receipts remain with each discussion; run count, corrected failed attempts,
HEAD/scope and cleanup are not replaced by a generic "tests pass" label. Selected examples:

| Diagnostic | Establishes in the recorded current baseline |
| --- | --- |
| [Rewire acquisition failure](protocol-reconciliation-probes/rewire-acquisition-failure-followup.ts) | Installed new binding can run after added-dep startup throws; not a test of the accepted abandonment gate. |
| [Old backlog inside batch](protocol-reconciliation-probes/resumeall-existing-backlog-inside-batch.ts) | Ambient batch captures old waves; current last-write coalescing loses DATA. |
| [Pre-existing DIRTY and rollback](protocol-reconciliation-probes/batch-rollback-preexisting-dirty.ts) | Current rollback sends RESOLVED even when a DIRTY interval existed before the batch; candidate ownership policy remains untested. |
| [Replay checkpoint](protocol-reconciliation-probes/replay-checkpoint-roundtrip.ts) | Matching replay capacity alone does not preserve retained history through current restore. |
| [Live PULL input restore](protocol-reconciliation-probes/restore-live-pull-input.ts) | Current restore can lose a received live quiet-holder input. |
| [Graph namespace/sequence](protocol-reconciliation-probes/restore-graph-namespace-sequence.ts) | Current checkpoint omits allocation/retirement/observation continuity metadata. |
| [Operator terminal arrays](protocol-reconciliation-probes/operator-terminal-array-closure.ts) | Eight current-runtime cases distinguish working combined DATA/terminal controls from tap/withLatestFrom/valve/race gaps; not replacement-runtime validation. |

### Maintaining this review

For each material topic, keep: **Rules** (affected contract and exact gap), **Decisions** (choice,
scope, rationale, alternatives/tradeoff and explicit acceptance/supersession), **Work** (remaining
outcome, owner and bounded evidence). Update this thematic map/current cursor when a topic closes.
Keep provisional details marked and point to later acceptance; preserve the detailed chronological
trail below. This avoids making future readers recover the current direction from a long chat or
mistake a historical proposal for implementation. No additional authority ledger is introduced.

---

The chronological review and source receipts begin below.

## Rules — first reading point

Source: ../../spec/rules.jsonl and ../../authority/README.md.
R-push-subscribe@1 has activated_by D9/D55 and no transition. For an ordinary settled
cached source, subscription delivers START then cached DATA. For a quiet pull source,
subscription delivers START only. Cache presence is not a demand or an emitted message.
First example excludes replay buffers, terminals, dirty subscription and activation work.
R-pull@1, R-up-routing@1 and R-up-routing-diamond@1 currently lack activated_by metadata;
record their text as proposed/unactivated under current resolver mechanics, not silently
as active public protocol. R-push-subscribe references R-pull: track this normative dependency
on an unactivated rule for final reconciliation.
R-pull text distinguishes serviceable holder invocation from downstream output, and says
PULL is demand while RESUME only releases pause locks. PULL does not automatically emit cache.
Do not infer these clauses solely from historical conformance pass flags.

## Decisions — rationale and revision trail

Root records: ../../decisions/decisions.jsonl.
D55 introduced quiet pull to permit expensive snapshots on demand while cheap updates push.
The quiet node suppresses DIRTY as well as DATA to avoid leaving downstream waiting for
settlement. Its RESUME-as-demand wording is historical.
D269 separates PULL from RESUME; D272 installs ctx.pull as holder-visible demand context;
D278 permits holder invocation on unchanged dependencies, with downstream output chosen
by the helper. These records were read, not converted into automatic rule activation.
Still follow full D55/D59/D63 -> D269/D272/D278 revision chain and relevant later refinements.
No fresh design choice made at this first stop.

## Work — actual evidence and remaining scope

Implementation evidence: /Users/davidchenallio/src/graphrefly-ts at
`dafc5ae57d446a59a7388214c31bd7a6e73d1519`. Worktree is dirty (skills, AGENTS.md and
examples/spending-alerts/README.md observed); current package runtime files used, not archives.
Source: packages/ts/src/node/node.ts:447 (subscription delivery branches).
Tests: packages/ts/src/__tests__/core.test.ts:28 and pull.test.ts:200.
Executed from current TS root:
`./node_modules/.bin/vitest run packages/ts/src/__tests__/core.test.ts packages/ts/src/__tests__/pull.test.ts -t 'push-on-subscribe delivers|pull node never push-on-subscribes' --cache=false`
Result: 2 tests passed, 41 skipped; no broader runtime or formal qualification claimed.

Root owner candidate: reconcile activation and current normative dependency gaps after all
walkthroughs. Acceptance: readers determine legal demand/composition from current Rules alone.
TS evidence follow-up: quiet+replay-buffer subscription branch deserves inspection because
replay branch precedes pull guard; no behavior finding yet (valid option combinations unchecked).
Next stops: ordinary push vs explicit routed demand, serviceable/no-change holder execution,
declared-cone directed/broadcast routing and diamond idempotence, missing-holder behavior.
Check batch/self-demand and pause boundaries only as needed; full pause/lifecycle review belongs
to themes three/four. Preserve DS-15 INVALIDATE/SENTINEL, batch, multi-dep, history/formal and
G9 provenance follow-ups rather than declaring them completed.

## Follow-up: why activation metadata is absent

Rules: authority/model.mjs:91-94 requires nonempty activated_by and no transition for
revisioned rules to enter the current projection. introduced_by alone records provenance.
The absence excludes R-pull/R-up-routing/R-up-routing-diamond; it does not prove lack of
historical design approval or implementation. R-push-subscribe still references excluded
R-pull, so the projected contract is incomplete across this dependency.

History checked with git show: before root commit 935460b these three rules were active
and described RESUME-based demand. At 935460b their wording switched to explicit PULL
(including subsequent holder-context refinements) and status became draft. D269 explicitly
requires rules/formal/conformance reset before runtime implementation. This is consistent
with an intentional amendment-stage reset, not merely metadata dropped by migration.
At authority migration 74a9c24, legacy active rows acquired activated_by; these already-draft
rows received introduced_by only. They remain that way at HEAD. No subsequent activation
record has been located in this review; do not assert none exists outside searched surfaces.

Work/root: reconcile the transition/activation record after examining amendment acceptance
and actual implementation/formal/scenario evidence. Distinguish a missing bookkeeping closure
from unresolved semantic acceptance. Do not reactivate retired RESUME-demand behavior or
infer activation from test success. Rules changes remain deferred until all walkthroughs.

## Second stop: no-change demand invokes; output is separate

Rules: R-pull wording distinguishes holder invocation from forced cache output. Activation
closure remains unresolved; do not imply runtime defect merely from missing metadata.
A quiet helper which emits nothing owes no RESOLVED to downstream when it announced no DIRTY.
Decisions: D278 (root ledger line 259) explains stable retained data with varying page/limit
params. D272 installs ctx.pull only for holder demand context. D55's blanket no-change silence
must not be read as a prohibition on holder invocation after these refinements.
Work/evidence: inspected current TS conformance.part-03.test.ts:320-370 and
node/node-output-runtime.ts:365-420. Tests exercise stable [1,2,3] -> limit 1 / limit 2 outputs,
and a helper which runs twice but emits only on its first demand; RESUME is negative control.
Command: ./node_modules/.bin/vitest run packages/ts/src/__tests__/conformance.part-03.test.ts -t 'C-27' --cache=false.
See task tool output for actual result. This stop does not exercise routed intermediary/diamond paths.
Formal wave_pull.tla includes D278 vocabulary but TLC has not been run in this walkthrough.
Boundary follow-up: resumeAll buffer-drain path returns before holder fn invocation; reconcile
its applicability with exactly-once holder wording during the pause intersection review.
Do not classify it as a confirmed defect without testing valid configurations and history.

## Follow-up: dedup scope and external pause (2026-09-18)

Rules/readout clarification: unchanged deps do not cause the substrate to ignore an eligible
PULL. A helper may invoke yet choose no DATA. pullId identifies the holder, not a globally
unique request/retry key. Same-routed-wave diamond duplicates are idempotent per holder;
separate demands before service coalesce with latest owed params. Cross-wave replay-key
semantics are not supplied by either guarantee. User suggested an idempotency key; retain
as an open use-case/design question, not approved protocol extension. A helper-level key
would need explicit scope, params/content binding, retention, and replay-response semantics.

Correction to earlier shorthand: RESUME creates no PULL but can unblock an already owed
PULL after external locks clear and dependencies settle. Verified node-output-runtime.ts:328
and :365/:430. Quiet latch is separate from external pause locks (D272). pull.test.ts:58 has
an obsolete comment describing lockset as including pullId; executable token-collision test
at :67 verifies separation. Candidate TS docs/comment repair; not performed here.
Executed focused tests: vitest run packages/ts/src/__tests__/pull.test.ts -t
'EXTERNALLY paused|without colliding' --cache=false. Actual output in task.
Earlier C-27 run: 2 passed, 17 skipped. Those 17 were excluded by the -t C-27 name filter,
not evidence of obsolete tests or declared test.skip; no deletion is justified.
Pause/async full behavior remains reserved for theme three.

## Clarifications: silence and one owed demand (2026-09-18)

User withdraws cross-request idempotency-key design from this review; treat it as user/helper
policy rather than an open substrate extension candidate. No implementation requested.
Silence in the examined no-output PULL path means no downstream protocol messages caused
by that service: no DIRTY, DATA, or balancing RESOLVED. It does not mean no holder invocation,
no incoming PULL, or absence of internal/helper work. No DIRTY was announced to balance.
Separate requests received before service replace one demandOwed slot, including params;
there is no FIFO request history or counter to replay. This is distinct from any resumeAll
buffer of output waves. User states last-request-only service makes sense. Current source
node-output-runtime.ts:382-385 assigns demandOwed=demand; :370-377 clears that slot and
installs activePull only during service. Preserve this distinction in final rule wording.

## Open question: caller-observable fulfillment (2026-09-18)

User challenges whether silent holder service fulfills a snapshot demand, how receivers
identify demand-caused DATA, and whether the demander needs completion notification.
Rules/current implementation distinction: holder service is not a guaranteed snapshot response.
Message DATA is [DATA,payload], with no automatic pullId/request/origin response tag;
ctx.pull is holder invocation context only. No dedicated per-demand ACK/completion message
exists in the closed set. RESOLVED balances node DIRTY, not a correlated request completion;
COMPLETE is node lifecycle terminal, not completion of one demand. Output is ordinary downstream
propagation, not a private return channel to the requester. With only downstream silence a caller
cannot generally distinguish no-output service, still-owed demand, or an unmatched holder id.

Decision question remains open: is PULL intended solely as a coalescible evaluation demand,
or should a snapshot/helper contract additionally promise an observable result/no-result outcome?
Do not silently change PULL or add request identity/ACK. User deferred idempotency-key design;
this distinct fulfillment question does not reopen cross-request dedup automatically.
Work: current schema inspected in packages/ts/src/protocol/messages.ts:12-32 and holder context
lifetime in node/node-output-runtime.ts:370-378. No new test run for this schema inspection.
Future acceptance needs requester-visible traces, including silent/no-change, owed/coalesced
requests and multiple subscribers, after contract choice is resolved.

## User disposition: retain current PULL scope (2026-09-18)

The user explicitly prefers retaining current library behavior: additional snapshot-response,
request-correlation, completion-acknowledgement and cross-request idempotency requirements
are specialized needs to solve in user land. This closes the preceding fulfillment question
for this walkthrough without introducing a new protocol/API requirement or runtime change.

Rules reconciliation candidate: clearly describe PULL as a coalescible demand for eligible
holder execution, with output chosen by the holder/helper; no automatic cached response,
per-request acknowledgement, origin tag or private reply channel is promised. Keep this
as notes until the agreed final Rules reconciliation. Existing routing/eligibility guarantees
and the activation-record closure investigation remain in scope.

Decision rationale: preserve the narrow existing substrate; applications with stronger
response contracts may implement those contracts explicitly through their own payloads
and graph composition. No new D# or semantic amendment is warranted merely to record this
confirmation. Work: remove protocol ACK/correlation additions from candidates; retain
boundary documentation and remaining routing/pause/history verification. No new runtime
tests were needed for this discussion-only disposition.

## Third stop: declared-edge routing and diamond scope (2026-09-18)

Rules/readout: R-up-routing and R-up-routing-diamond remain outside current activation
projection, as previously recorded. Their intended routing: broadcast follows declared deps;
directed up selects one first-hop dependency, subsequent nonholders forward up their deps.
Matching holder consumes the demand (does not forward through itself); an unmatched leaf drops
it. pullId identifies eligible holders within reachable topology, not a global node lookup.
Same-wave dedup is per actual holder, not a global one-responder limit across distinct nodes
configured with the same id. Response output travels normal downstream edges; directed demand
does not restrict its response to the path or caller that issued demand.

Decisions: read full graphrefly:D59 and D63. D59 chose declared-cone routing to avoid hidden
node-reference/cache reads outside wave ordering. D63 explicitly repaired tree-only assumptions:
multiple routes to one holder must not invoke it repeatedly, even if output coalescing happens
to hide the second execution. D269 retains that guarantee using explicit PULL; old RESUME
examples and pause-lock collision explanations are historical, not current API guidance.

Work/TS evidence: node-output-runtime.ts:277-305 shares route state and tracks holders in a
Set; directed dependency index is applied at the first hop and not propagated as a path index.
Current TS call order is up(msgs, towardDep), whereas rule prose uses up(towardDep,msgs).
Candidate documentation/API notation clarification for final reconciliation, no edit applied.
Focused command: vitest run packages/ts/src/__tests__/conformance.part-02.test.ts -t
'routing: pullId|routing: towardDep|C-18' --cache=false. Actual result in task output.
Tests at :272, :296, :384 cover sibling selection, directed pruning and holder-handler count.
C-18 monkey-patches _onDemand and does not forward its demand argument, so it is evidence
only for handler count, not correct ctx.pull params or complete output/callback trace. Need a
public-surface probe for params and end-to-end diamond behavior before claiming those verified.
Remaining: same-wave conflicting params policy, separate-demand coalescing and valid replay/pause
boundary combinations; formal models contain old routing comments requiring historical review.

## Fourth stop: self-demand and committed boundary (2026-09-18)

Rules: R-rewire-deferred and R-rewire-deferred-committed-boundary describe ctx.upNext
self-demand; both still lack activation metadata. Read with R-reentrancy. Immediate PULL
inside consumer C can cause holder output to re-enter C before its current fn completes;
use ctx.upNext to route only after the committed wave boundary. This is a fresh synchronous
wave, not a timer, Promise or inherently asynchronous request. If the requesting owner is
paused, boundary work waits; batch-owned queued demand is dropped on rollback. Keep this
boundary check bounded; general batch/pause semantics remain later review scope.
Decisions: D37 rejects recursive in-wave fn reentry rather than finding a fixpoint; D47
introduced deferred boundary work, D55/D59 applied it to self-demand, D269 changed only
its demand message to PULL, and D110 binds deferred work to batch commit fate.
Work: inspected batch/boundary.ts:44-52 and :79-96, tests conformance.part-02.test.ts:251
and :317, conformance.part-03.test.ts:152. Ran vitest on these two files with name filter
'SELF-demand via ctx.upNext|in-fn demand whose delivery|rollback drops ctx.upNext'. Results
in task output. Coverage: end-to-end deferred delivery, immediate reentry rejection, rollback
no-delivery. This does not establish arbitrary self-demand termination; issuing another
PULL on every returned snapshot can still cause unbounded fresh-wave feedback.

## Fifth stop: replayBuffer crosses quiet subscription boundary (2026-09-18)

Rules finding: activated R-push-subscribe@1 says a quiet pull node sends START only,
whereas unactivated R-replay-buffer@1 says late subscribers receive buffered DATA.
No precedence/exception for their combination was located in the reviewed text. Do not
call this two active rules conflicting. Current implementation permits the option combination
and takes the replay branch before the pull guard (node/node.ts:448-455).
Decisions: rationale is unsettled for this combination; reviewed root decisions did not yield
an explicit replayBuffer/pull precedence decision. Do not choose semantics from branch order.
Work/actual probe: current TS source, graph state(42) -> holder with pullId and replayBuffer
0 or 2; retain first subscriber, send one PULL to populate output, add second subscriber
without another demand. 0: late subscriber START only. 2: START,DATA(42). Both add zero
holder fn calls. No deactivate/reconnect involved. This is observable replay, not new holder
execution. No runtime fix or rule amendment performed. Need user review of intended quiet-vs-
replay precedence; owner root for contract, TS for code/evidence after resolution. Possible
interpretations: quiet gates all late DATA; replay is explicit exception; reject combination.
Original executed command: node --import /Users/davidchenallio/src/graphrefly-ts/node_modules/tsx/dist/loader.mjs /tmp/graphrefly-pull-replay-review.mts.
Probe retained below (temporary external path need not survive):

```ts
import { graph } from '/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/graph/graph.ts';
import { depLatest } from '/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/ctx/types.ts';
for(const replayBuffer of [0,2]){
 const g=graph();const s=g.state(42);const pullId=Symbol('snapshot');let calls=0;
 const h=g.node([s],ctx=>{calls++;ctx.down([['DATA',depLatest(ctx,0)]])},{pullId,replayBuffer});
 const early:any[]=[];const stop1=h.subscribe(m=>early.push(m));
 h.up([['PULL',{pullId}]]);
 const before=calls;const late:any[]=[];const stop2=h.subscribe(m=>late.push(m));
 console.log(JSON.stringify({replayBuffer,early,late,extraCalls:calls-before}));
 stop2();stop1();
}

```

## Replay tradeoffs and resumeAll/owed-PULL interaction (2026-09-18)

User requests tradeoffs/recommendation for quiet+replayBuffer and proposes draining resume
buffer before fulfilling owed PULL. Distinguish late-subscriber replayRing (already delivered
DATA history) from pauseBuffer (withheld output waves), and from single demandOwed slot.

Recommendation for discussion only: quiet pull gates automatic late-subscriber replay;
keep first subscription START-only. This preserves demand gating but loses automatic warm
history on that holder. Alternative explicit replay exception preserves convenient warm history
and current behavior but makes subscribe another delivery trigger. Rejecting the option pair is
another possible policy. No choice approved and no runtime change applied. Do not infer that
PULL should dump replayRing; replay delivery policy is separate.

Fresh probe confirms resumeAll intersection: source(10) -> pull holder with pausable:resumeAll,
prime/drain initial buffer; externally PAUSE, source DATA(20), DATA(30), queue PULL params
{request:latest}, then RESUME. While paused holder ordinary invocations produce buffered records
20/30 with no pull params and no output. On RESUME outputs are DIRTY,DATA(20),DIRTY,DATA(30),
but holder invocation count during resume is zero. The latest demand params are not processed.
node-output-runtime.ts:370 clears demandOwed before service; :388-396 drains buffer then returns.
This proves the valid configuration reaches the previously suspected buffer-only service path.
Tension: R-pull/D278's serviceable holder invocation wording vs older resumeAll backlog-as-delivery
policy. Do not resolve by assuming output replay counts as invoking the holder with current params.

Candidate ordering matching user proposal: after final-lock release AND existing PULL eligibility,
drain retained output waves, then invoke holder once with latest owed params, ordinary output policy,
then re-quiet. Tradeoff: replay may end with DATA equal to the fresh demand result; no automatic dedup.
Need review whether RESUME WITHOUT owed PULL should release buffered output: recommend retaining
current demand gate (remain quiet) for pull holders; ordinary non-pull resumeAll may drain on RESUME.
These are discussion proposals, not activated rules or authorized implementation.
Executed source-import probe using node/tsx; exact probe:

```ts
import { graph } from '/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/graph/graph.ts';
import { depLatest } from '/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/ctx/types.ts';
const g=graph(), s=g.state(10), pullId=Symbol('h'), pause=Symbol('p');
const calls:any[]=[],out:any[]=[];
const h=g.node([s],ctx=>{const record={value:depLatest(ctx,0),params:ctx.pull?.params??null};calls.push(record);ctx.down([['DATA',record]])},{pullId,pausable:'resumeAll'});
const unsub=h.subscribe(m=>out.push(m));
h.up([['PULL',{pullId}]]);calls.length=0;out.length=0;
h.up([['PAUSE',pause]]);s.set(20);s.set(30);
h.up([['PULL',{pullId,params:{request:'latest'}}]]);
console.log(JSON.stringify({phase:'before resume',calls:[...calls],out:[...out]}));
calls.length=0;out.length=0;
h.up([['RESUME',pause]]);
console.log(JSON.stringify({phase:'resume',calls:[...calls],out:[...out]}));
unsub();

```

## User feedback: distinguish replay cause; avoid redundant fresh snapshot (2026-09-18)

User agrees pull-demand holders should remain quiet and asks whether ordinary replay and
PULL demand are distinguishable. Clarification: runtime distinguishes subscription replayRing,
withheld pauseBuffer, and activePull context; generic emitted DATA has no automatic cause tag.
Confirming quiet demand behavior does not by itself settle every replayBuffer combination;
retain the previously discussed quiet-on-subscription preference without broadening it.

User reconsiders drain-then-invoke recommendation: buffered 20,30 already conveys latest progress;
a forced further DATA(30) is redundant and difficult for consumers to distinguish. Withdraw
any implication that unconditional extra snapshot output is desirable. No implementation change.
For unparameterized backlog/progress delivery, current drain-only behavior is reasonable and
matches D55's resumeAll backlog policy. Still unresolved: parameterized PULL may ask for a result
not represented by old buffered output (e.g. limit/cursor). Current drain-only return never
invokes the holder with those new params. Distinguish holder invocation from mandatory output:
invoking after drain need not emit DATA, but helper needs sufficient policy/state to decide.
Final reconciliation must explicitly resolve D55 delivery-content vs D278 invocation wording;
do not blanket-label all drain-only service a bug or assume user approved ignoring parameters.
No new lock, rule activation, API, dedup mechanism or runtime repair authorized.

## User accepts two coexistence principles (2026-09-18)

User endorses: (1) no owed PULL means a pull holder stays quiet after RESUME; pause release
alone creates no demand; (2) buffered output ending in 30 and a subsequent demand result 30
are separate legal occurrences; suppression is explicit policy, not substrate equality.
These resolve the conceptual objection to possible duplicate-valued output. Distinguish
that resolution from the observed implementation question: current buffer-drain early return
skips the holder invocation with latest owed params. D278's invocation guarantee and D55's
backlog-delivery policy still need explicit reconciliation for this path. Do not claim code
fixed, arbitrary params served, or an extra DATA mandatory. User-endorsed principles remain
review guidance for the deferred final Rules pass; no normative activation or runtime edits.

## Correction: user intends no second demand invocation after buffered delivery (2026-09-18)

User explicitly corrects assistant's proposed sequence: omit "process latest owed demand"
after resume buffer delivery. Do NOT interpret the previous endorsement as approval of a
second holder invocation. User proposes that a paused holder need not remember PULL because
RESUME would send DATA. This is a proposal being evaluated, not a locked rule.

Separate claims: buffered output may satisfy demand without another invocation; dropping all
memory of demand is stronger. Under the earlier no-demand/no-output-on-RESUME preference, the
holder still needs to distinguish whether a PULL occurred. Removing that distinction would
make resumed delivery unconditional or make a previously received demand unobservable.
Also resume may have no buffered output (no upstream update, default coalescing mode, or
no-output helper), and parameterized demands may not be answered by prior buffered values.
Thus "RESUME guarantees DATA" is not established by current behavior. Discuss these bounded
counterexamples before deriving any broad paused-PULL-drop semantics. No code/rule changed.

## Reopened question: uniform subscription replay vs pull quiet (2026-09-18)

User questions whether quiet should suppress subscription replay, emphasizing an expectation
that every new subscriber receives predecessor cache and warning against special cases.
Do not treat previous quiet-demand agreement as final approval to suppress subscription replay.
Current TS already suppresses ordinary cached push on nodes configured with pullId, regardless
of whether a demand has arrived. replayRing branch precedes that guard, so replayBuffer output
is an exception to that existing pull subscription rule. A PULL may populate the buffer, making
history visible indirectly, but no transient demand flag gates the subscription branch.

A pull guard on replay would be a small local implementation edit, not proof of full semantic
safety. The actual choice is whether quiet gates only fresh production or also subscription
history delivery. Uniform cache/replay delivery to new subscribers is a coherent alternative,
but revises D55/R-push-subscribe's explicit pull exception; it is not current behavior.
Retain both interpretations for discussion; no rule/code change or settled precedence claimed.

## User resolves pull-mode subscription precedence (2026-09-18)

User selects only-on-PULL-demand behavior for pull-mode nodes: subscription itself does not
deliver values. Read "Prime Mode" in this message as the pull-mode concept under discussion,
not authorization for a new named mode/API. START handshake remains; both cached DATA and
replayBuffer DATA are withheld on subscription. Ordinary non-pull subscription behavior is
outside this choice. This supersedes the immediately preceding open subscription-policy
question in these review notes.

Rules candidate: pull-mode quiet-on-subscribe takes precedence over automatic cache/replay
history delivery. Maintainer rationale: preserve explicit demand as the value-delivery trigger
at this boundary. Work/TS: the observed replayRing-first subscription path must be reconciled
with this agreed behavior after the full walkthrough; acceptance includes retained late
subscribers with populated replayBuffer as well as ordinary cached pull nodes. No runtime
implementation, normative edit or new D# performed. The choice does not specify that a PULL
must dump replayRing, promise DATA/ACK, or resolve resumeAll buffered-output vs parameterized
holder invocation; those are separate semantics.

## Real parameterized-holder audit (2026-09-18)

User requested checking actual consumers before choosing a repair. Searched current TS
packages/ts/src for ctx.pull and pull params uses outside tests/benchmarks (not archive snapshots).
Found concrete parameterized holders:
- messaging/index.ts:250-343: topic snapshots, catalog, deadLetter, subscription.available.
  Params in messaging/types.ts:246-266 include limit, afterSeq, afterTopic and filters.
- work-queue/index.ts:345-399: available and deadLetter (work snapshot itself is unparameterized).
  Params in work-queue/types.ts:315-326 include limit, afterAdmissionSeq/afterWorkId, nowMs,
  includeIssues and afterDeadLetterSeq.
These factories pass pullId but no pausable override, using constructor default pausable:true.
Their public projection options expose names and domain-specific configuration, not resumeAll.
Graph._nodeOpts injects dispatcher/versioning, not a global pause-mode override. No dirty files
were reported for these runtime directories at inspection; HEAD remains
`dafc5ae57d446a59a7388214c31bd7a6e73d1519`.

Conclusion scope: parameterized demand is real implemented library behavior, but the previously
reproduced resumeAll buffer-drain/ignored-params case is NOT established as reachable through
these stock factory APIs. Ordinary external PAUSE does not switch them to resumeAll. A public
raw node configured with both pullId and pausable:resumeAll does permit it (prior probe); this
remains a raw composition/contract gap, not a demonstrated messaging/workQueue regression.
No arbitrary wrapper on the downstream side changes the holder's own pausable configuration.

Actual execution: public messageBus topic holder with orders o1/o2/o3. Subscribe yields START;
PAUSE; PULL limit1; PULL afterSeq1+limit2; no output while paused; RESUME delivers exactly
DIRTY+DATA with o2/o3 (latest owed params honored). With no upstream change, next PULL limit1
returns o1. Assertions passed using node with installed tsx loader.
Focused existing tests: vitest run packages/ts/src/__tests__/messaging.test.ts -t
'projections answer explicit PULL params|subscription available PULL is read-only' --cache=false.
Result 2 passed, 11 excluded by filter. Work-queue factories inspected, not executed in this run.
Work: retain combined raw-mode question for theme-three pause review/final reconciliation;
do not invent a stock-consumer fix or automatically reject the combination. No code/rules changed.

Public factory probe source:
```ts
import assert from 'node:assert/strict';
import { graph } from '/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/graph/graph.ts';
import { messageBus } from '/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/messaging/index.ts';
const g=graph();const bus=messageBus(g,{topics:['orders'],name:'bus',now:()=>0});
bus.publish('orders',{id:'o1'});bus.publish('orders',{id:'o2'});bus.publish('orders',{id:'o3'});
const {snapshot,snapshotPullId}=bus.topic('orders');const messages:any[]=[];
const stop=snapshot.subscribe(m=>messages.push(m));
assert.deepEqual(messages,[['START']]);messages.length=0;
const lock=Symbol('pause');snapshot.up([['PAUSE',lock]]);
snapshot.up([['PULL',{pullId:snapshotPullId,params:{limit:1}}]]);
snapshot.up([['PULL',{pullId:snapshotPullId,params:{afterSeq:1,limit:2}}]]);
assert.deepEqual(messages,[]);
snapshot.up([['RESUME',lock]]);
assert.deepEqual(messages.map(m=>m[0]),['DIRTY','DATA']);
assert.deepEqual(messages[1][1].messages.map((m:any)=>m.payload.id),['o2','o3']);
console.log(JSON.stringify({phase:'resume',messageTypes:messages.map(m=>m[0]),ids:messages[1][1].messages.map((m:any)=>m.payload.id)}));
messages.length=0;
snapshot.up([['PULL',{pullId:snapshotPullId,params:{limit:1}}]]);
assert.deepEqual(messages[1][1].messages.map((m:any)=>m.payload.id),['o1']);
console.log(JSON.stringify({phase:'unchanged state, new params',ids:messages[1][1].messages.map((m:any)=>m.payload.id)}));stop();

```

## Proposed uniform owed-demand service across pause modes (2026-09-18)

User asks whether ordinary pullable nodes should retain only the latest pending demand,
then process it after resumeAll delivery or ordinary resume, for simpler behavior.
Recommendation: yes, separate one-slot demand bookkeeping from pause/output buffering.
When the final external pause lock is released AND holder eligibility holds, first drain
applicable resumeAll withheld output in order, then invoke holder once with the latest owed
PullDemand (params included), then re-quiet. Default mode has no historical-output drain.
No owed PULL means a pull holder remains quiet; no demand created by RESUME alone. A pending
demand waits for remaining dependency/first-run eligibility rather than resume overriding it.
Invocation does not mandate DATA or ACK. If emitted result equals final buffered DATA, keep
occurrence fidelity; helper may choose silence/dedup as explicit policy. The latest-demand
slot is not a FIFO queue; separately serviceable requests are separate invocations.

This is a reviewed candidate answering the user's design question, not a new normative lock
or implementation approval. Current default-mode behavior agrees in the tested messaging
case; resumeAll buffer-drain early return remains the identified change candidate if approved.
User's pagination analogy: afterSeq is exclusive sequence-cursor pagination, not a row-count
offset; limit caps page size. No protocol pagination field introduced.

## Transition to pause walkthrough: evaluation versus delivery (2026-09-18)

User agrees that demand invocation need not emit DATA and asks to continue. First pause
reading point isolates a subscribed synchronous dependency-bearing non-pull node. With
identity output, initial 10, PAUSE, separate upstream 20 and 30 waves, final-lock RESUME:
pausable:true skips dep-triggered fn calls during pause and evaluates once using latest 30;
resumeAll evaluates during each ready upstream wave and buffers its emitted settle slices,
then replays 20,30 without repeating those fn calls; false continues evaluation/delivery.
This is a value trace, not a claim that PAUSE silences all protocol messages. DIRTY can
propagate while paused; resumeAll is not suspension of user fn side effects. It buffers output,
not a queue of callbacks to execute on resume. Default leaf own-production and in-flight async
compute results require separate follow-up under D44/R-async-paused.

Rules: R-pause-modes@1 and R-pause-lockset@1 currently lack activated_by. R-async-paused@1
is activated. R-pause-modes retains obsolete conceptual-cache equals wording and the
pull delivery-content clause already under reconciliation; do not treat this text as a fully
reconciled current contract. Original lockset rationale D10: independent pause sources must
not cancel one another. D44 distinguishes recomputation gating from output buffering.

Work/source: node-input-runtime.ts:214-220 gates default evaluation;
node-output-runtime.ts:95-109 buffers settle slices, :328-362 releases/drains, :437-449
selects buffering by mode and node kind. Existing control.test.ts covers final-lock gating,
false bypass, resumeAll withholding DATA without synthetic mid-pause RESOLVED, and async
late output. No runtime or authority record changed; full async/terminal/batch interactions
remain later reading points.

## Pause walkthrough: own production and in-flight compute output (2026-09-23)

Current TS HEAD remains dafc5ae57d446a59a7388214c31bd7a6e73d1519. Inspected
node-output-runtime.ts:437-449 and conformance.part-01.test.ts C-2/C-9/C-10.
For non-pull nodes, default true-mode does not buffer a depless source's own
production, including async production. A dependency-bearing async compute node's
late output is buffered while paused. resumeAll buffers both classes' settle output;
false buffers neither. Pause does not itself cancel an already-started operation.
The difference follows the D44 precedence and activated R-async-paused; unresolved
R-pause-modes activation/wording remains as previously recorded. No new design choice.

Executed vitest conformance.part-01.test.ts with name filter
'C-2 async-result|C-9 pausable:false|C-10 true-mode' and --cache=false:
3 passed, 26 excluded by filter. This run verifies the selected async source/compute
arms, not all combinations or formal/cross-runtime conformance. Next interaction to
inspect: a buffered old compute result alongside newer dep changes on final resume.
No runtime or normative changes.

## Three source-pause alternatives requested for comparison (2026-09-23)

Review only, no choice locked. A=current default source own-emission bypass. B=source does
not support default pause, output pause requires resumeAll; distinguish rejecting explicit
true / unsupported PAUSE from silent ignore or blanket false default. Blanket false on all
deps.length===0 nodes conflicts with pullId+false rejection and depless pull holders; dynamic
rewire can also change leaf classification. C=default pause suppresses source output AND
cancels underlying async work; viable only with cooperative cancellation and a separately
specified resume/restart contract, not a universally enforceable Promise contract.

Inspected current sources.ts source helper (cleanup via onDeactivation), fromPromise:943
(existing PromiseLike, external AbortSignal triggers ERROR, cleanup suppresses callbacks but
does not own generic underlying abort), fromAsyncIter:1002 (local abort checked after yielded
values; no universal interruption of pending next), node-lifecycle-runtime.ts:76 (deactivation
also clears cache/state/locks/demand), node-output-runtime.ts:187 (terminal clears pauseBuffer).
Cannot reuse deactivation as pause without changing lifecycle semantics. Timer/driver factory
pausable:false defaults also need audit before claiming a changed default stops these sources.
Found stale sources.ts JSDoc at 14 and 928 claiming default paused source buffers late output;
this contradicts D44/current code, retained as documentation repair candidate.

Concrete public API probe: graph().initNode(fromPromise(p), [], {pausable}); subscribe,
PAUSE, resolve(20), flush Promise microtasks, RESUME. true produces DIRTY DATA20 COMPLETE
while paused; resumeAll produces COMPLETE only and no value on resume (DATA buffered then
cleared by same-wave COMPLETE). Assertions passed. Initial exploratory probe incorrectly
passed options as fourth argument and was discarded; corrected third-argument call is the
valid evidence. Thus previous broad 'resumeAll holds output until resume' explanation needs
terminal qualification. This is observed terminal precedence, not an automatic bug verdict
or authorization to change it. The comparison must include this existing edge, especially if
B makes resumeAll the only source output-pause mode.

External primary references read: RxJS 7.8.2 innerFrom.ts (fromPromise only checks subscriber
closed; no Promise cancellation), observable/dom/fetch.ts (fromFetch owns AbortController
and teardown abort while abortable), subscription guide (unsubscribe resource disposal).
Callbag/callbag readme specification (0/1/2, termination) and getting-started guide (pullable
request versus listenable independent production, per-subscription talkback cancellation).
These do not define GraphReFly-style node-global pause-lock+resume semantics. Compared as
analogies, not evidence of a mandated policy or universal cancellability.

Remaining comparison axes: consumer explainability vs runtime role/capability detection;
source shared by multiple consumers; state cache and dropped occurrences; cancellation races,
no-wedge DIRTY settlement, terminal vs suspension, replay/late subscribers, latest pending
PULL and restart ordering; external side effects cannot be rolled back by local cancellation;
unbounded buffering and burst replay; cross-runtime Rules/model/conformance scope. Recommendation
will remain proposal, favor preserving generic semantics or explicit unsupported capability
rather than promising universal cancel-on-PAUSE.

## Candidate D: uniform output buffering, latest versus all (2026-09-23)

User proposes comparing B with D: pause uniformly buffers source/compute output;
default resume retains last value and discards earlier values, resumeAll drains all.
Working interpretation for comparison: D continues eligible computation during pause and
buffers output for all pause-supporting node kinds, retaining normal readiness/dispatcher
rules. If compute fn remains stopped, buffer must instead hold input, so that is a different
hybrid policy and must not be silently equated with uniform output buffering. pausable:false
is kept outside the assumed pause-supporting modes unless user changes its explicit contract.
No cancellation implied by D; no selection locked or implementation authorized.

Code read: nodeMaybeRun default pause gate, nodeRunWave dispatcher and no-output settlement,
scan's depBatch processing, effect's actual user callback, and nodeOnResume drain/recompute.
D would run effects during pause and would not save paused node's computation costs, although
it reduces downstream deliveries. B preserves default compute scheduling and restricts source
pause capability; B raw fn may consume multiple retained dep projections on its eventual run,
so do not claim every stateful operator processes only last input under B. Latest-value callback
and effect invocation counts are the unambiguous comparison cases.

D's last-value policy needs protocol-aware settlement reduction: DATA20 then RESOLVED must
not erase undelivered DATA20; DATA20 then INVALIDATE must not replay stale DATA20; a single
wave with DATA20,DATA30 raises explicit last-DATA versus last-whole-wave choice; terminal
buffer fate remains the demonstrated fromPromise edge. Opt-in paused coalescing is not equals
substitution and retained equal DATA must remain DATA. Latest arrival of async result differs
from latest input/request; no automatic stale-work cancellation or suppression follows.

Additional policy boundaries: output cache versus internal ctx.state/late subscriber visibility;
DIRTY propagation and downstream pending balance; PULL remains demand-triggered (RESUME alone
must not invoke quiet holder), no accidental expensive quiet computation via removing shared
default pause/pull gate; overlapping locks final release; shared producer scope; replay memory
and burst, terminal/error/teardown, dynamic rewiring, cross-runtime models/conformance.
Default D may compact incrementally to a bounded settlement summary rather than retain a full
history until resume, once reduction semantics are decided; not necessarily one raw message.
B is smaller capability/API change, D medium-to-large scheduling/protocol change with simpler
source/compute output rule but greater effect and lifecycle consequences. Recommendation is
conditional on whether PAUSE's desired promise is postpone evaluation or postpone visibility.

## Revised candidate: default PAUSE gates new fn invocations only (2026-09-23)

User's latest proposal supersedes the preceding suggestion to buffer pre-pause work results:
default PAUSE prevents new fn dispatches; executions started beforehand continue and their
outputs propagate normally without pause buffering. resumeAll remains separate output-buffer
mode unless changed explicitly. Arrival order remains output order, not latest-request-wins.
No cancellation, no node-generation freshness filter, no default output coalescing implied.
For ordinary source setup already invoked, captured callbacks keep producing. Preventing new
node fn invocation cannot stop arbitrary future work scheduled inside a previously invoked
source setup; source lifecycle management remains separate. PULL quiet and terminal rules
remain independent constraints on output/demand; do not broaden proposal to bypass them.

Inspected default maybeRun gate, output buffer-before-cache handling, data cache/replay updates,
subscribe cache/replay branches, and resume drain/recompute. Existing runtime probe at source
values 0/1/2: finish initial job0 to cache0; input1 starts async job1; PAUSE; input2 postpones
job2; job1 emits10 while paused. Current runtime: jobs[0,1], cache0, existing subscriber DIRTY,
new subscriber START DATA0. RESUME: buffered DATA10 delivered/cache10, job2 starts; later
job2 emits20 with DIRTY DATA20. Actual output confirms output cache/replay track delivered
DATA, dependency input retention is separate, subscription does not have a general pause gate.
This probe characterizes current behavior, not a modified candidate runtime.

Candidate benefit: remove default async-compute late-result output buffering while retaining
new-invocation suppression, making source/compute late output consistent without cancellation.
Requires revision of activated R-async-paused/D44 behavior and C-2, not merely doc cleanup.
DIRTY needs explicit review at intersection: new input marks dirty during pause; older result
may settle downstream before deferred new computation. Owed recompute must survive that result,
and later resumed output must have correct DIRTY pairing including no-output fn, multiple deps
and diamond paths. Distinguish pending evaluation from output dirty status; no defect asserted
without candidate implementation test. Broader 'no new fn' promise must cover activation and
rewire/demand dispatch entrypoints, not only current maybeRun gate. Recommendation remains
review proposal, no runtime or normative edits authorized.

## User endorses invocation-gating direction; isolated candidate probe (2026-09-23)

User agrees PAUSE prevents new node fn invocation but does not stop callbacks/work already
started by source setup, and endorses continuing the candidate investigation. This is design
walkthrough guidance; formal rule amendment/runtime implementation remains deferred.

Probe /tmp/graphrefly-pause-inflight-candidate.mts uses current public graph setup and overrides
only _shouldBufferOnPause on one non-pull default-mode async compute instance, returning false.
It simulates the proposed late-output passthrough, not a complete implementation. No repository
runtime code changed. Baseline input0 completes; input10 starts job; PAUSE A+B; inputs20,30
arrive; job10 completes while paused. Verified calls remain [0,10], cache=100, a late subscriber
receives START DATA100. RESUME A still gates; final RESUME B invokes input30 exactly once.

Two result timing arms:
- resumed job emits later: output after resume is DIRTY DATA300; pairing holds.
- resumed fn emits immediately (legal even in pool:async): output after resume is DATA300 alone;
  missing DIRTY. Previous old result cleared emittedDirtyThisWave; nodeOnResume calls tryRun
  without reannouncing DIRTY, and insideRunWave output skips late-emit DIRTY synthesis.

Conclusion: candidate preserves pending recomputation independently of old result delivery in
this trace, but merely disabling default async buffering is insufficient. Resume invocation must
honor fresh DIRTY-before-settlement when earlier output already settled downstream. This is a
candidate-change interaction discovered by instrumentation, not a claim that unmodified runtime
fails this test. No fix, formal qualification, diamond coverage or all-entrypoint verification.

## User confirms pause modes, terminal precedence, and pre-activation gate (2026-09-24)

Explicit walkthrough consensus from the latest exchanges:
- Default PAUSE blocks new node fn invocations, including the first activation-triggered
  invocation. Existing executions/callbacks continue and late outputs deliver normally,
  subject to independent terminal, batch and pull rules. This is the agreed design direction,
  not a statement that current runtime already implements it.
- If PAUSE precedes first subscription, establish subscription and START normally, but defer
  initial fn invocation until final-lock RESUME while subscription remains valid and other
  eligibility conditions hold. Existing cache is not automatically hidden by this choice.
  Cancellation/deactivation before resume must not launch orphaned deferred activation.
- resumeAll retains existing evaluation/output separation: fn may run while paused; settle
  output buffers and drains in order after final release (pull demand conditions remain).
- COMPLETE/ERROR retain immediate precedence and discard buffered output, including the
  verified fromPromise DATA+COMPLETE case. User explicitly accepts this loss-on-terminal
  behavior; do not reopen it as an unresolved product choice without new evidence.

Final Rules/runtime reconciliation stays deferred until the walkthrough is complete. No
new D#, normative activation, implementation, or cross-runtime qualification performed.
Retain the isolated candidate probe's missing resumed DIRTY finding as required implementation
work, and audit all dispatch entrypoints against the agreed invocation gate.

## Default PAUSE x INVALIDATE walkthrough (2026-09-24)

Read activated R-paused-invalidate@1 (rules:60), D50 (decisions:55), current
node-input-runtime.ts:46-79, C-13 tests in conformance.part-01.test.ts:667.
Scope is an already-activated default-mode compute node. INVALIDATE supersedes that
dependency's paused pending value-change and clears its retained current value; if no
other dep has a surviving buffered change, cancel deferred recomputation. Later DATA
re-arms it. Another dependency's pending update survives and may trigger one fn call
on resume with the invalidated dependency SENTINEL; do not equate settle-ready with
all dependencies having DATA. Raw callback in C-13(c) explicitly guards missing input.
Existing node output cache is invalidated immediately, with idempotence/never-valued
settlement handling; default pause is not a barrier to this control operation.
This cancellation is of deferred invocation, not cancellation of previously-started work.
Existing first-run activation deferral needs separate bookkeeping from this dep-change
rule. No new semantic choice or runtime edit. Focused C-13 test run requested with
--cache=false; observed result recorded in conversation. Existing tests assert runs/cache,
not complete DIRTY protocol trace or old-in-flight-output-after-invalidation semantics;
those remain separate verification points.

## INVALIDATE versus results of previously-started work (2026-09-24)

Read activated R-invalidate-idempotent@1 (rules:11), R-cleanup-hooks@1 (:23),
R-ctx-state@1 (:24); historical D28/D29/D30/D38/D47/D50. D38 describes cache-drop
request with next value source-owned. D30 says default no-cancel but also contains historical
switch:true/AbortSignal-via-ctx wording not established by current public Ctx/NodeOptions;
do not advertise that old syntax as an implemented API. No explicit universal pre-invalidation
result-rejection rule was located in the relevant owner records searched. D50 cancels deferred
input recomputation, not in-flight operations. Current ctx.down has no INVALIDATE generation
check; it delegates to normal down with release/terminal guards. Invalidation leaves lifecycle
and private state continuing; output cache and replay ring clear when populated.

Public API probe without PAUSE, with an async compute over source10 and held finish callback:
(1) prepopulated output cache1, hook only records: source INVALIDATE fires hook once, clears
cache, sends INVALIDATE; old callback emits20 => DIRTY DATA20 accepted and cache repopulated.
(2) prepopulated, hook disables callback-local valid flag: same invalidation, late result
suppressed by helper, cache remains empty. (3) never-populated output, same helper guard:
INVALIDATE fires no hook and sends no output; callback still emits20 => DIRTY DATA20.
All three assertions passed. Case3 matches explicit R-invalidate-idempotent, not incidental
bug. Hooks are latest-run registrations only, so also not a blanket cancel-all-inflight list.

Assessment: current behavior is coherent as cache invalidation, not revocation of all work
started from past inputs. Automatic causal stale-result fencing would be a stronger separate
policy. Final Rules should explicitly distinguish this boundary; onInvalidate cannot be
promised as a universal async cancellation hook, especially before first DATA. Probe did not
exercise PAUSE or apply the agreed future pause semantics; existing paused async buffering
continues until authorized reconciliation. No runtime/rule changes.

## Lifecycle walkthrough: TEARDOWN versus last unsubscribe (2026-09-24)

User agrees latest-run hook lifecycle explanation and continues. Read R-terminal@1,
R-cleanup-hooks@1, R-teardown-terminal-relay@1 (activated), R-teardown-complete@1
(no activated_by), D17/D28/D65 and current node output/lifecycle/context runtimes.
TEARDOWN downstream from a nonterminal node synthesizes COMPLETE then relays TEARDOWN;
current raw subscribe does not automatically unsubscribe on terminal/control receipt.
Last subscriber removal invokes nodeDeactivate, fires live onDeactivation hooks, removes
input subscriptions and resets default private state, compute/producer cache, pause/pull state.
Normal nonterminal deactivation is not terminal and permits future activation.

Public raw async node probes, no runtime modifications:
1. Hold raw subscriber; send down TEARDOWN; old callback DATA7. Observed COMPLETE TEARDOWN,
no DATA, cleanup count0. Explicit unsubscribe then raises cleanup count1. Thus TEARDOWN
message/terminal guard does not itself invoke this node's onDeactivation on raw subscription.
2. Activate raw source storing ctx callback and hook that only counts; last unsubscribe invokes
hook once. Old callback DATA11 while inactive repopulates cache. Re-subscribe yields START
DATA11 and invokes fn anew; old first-lifecycle callback DATA12 reaches new subscriber as
DIRTY DATA12. Assertions passed. Current ctx.down has release/terminal guards, not lifecycle
identity fencing; terminal reset/resubscribable compositions need separate review.

Scope: these raw probes deliberately provide no output-suppression cleanup. Do not generalize
to stock fromPromise, whose cleanup sets settled=true, or claim all async helpers leak.
Semantic assessment pending: cleanup ownership is explicit, but whether prior lifecycle ctx
must be revoked on reactivation is a distinct lifecycle-isolation question. Existing code alone
cannot establish it is intended. No normative or runtime change; preserve as reconciliation
question rather than silently adding generation checks or automatic TEARDOWN unsubscription.

## Deeper lifecycle ownership comparison (2026-09-26)

User asks implications of cleanup-only versus substrate lifecycle isolation. Review-only.
Read full node-context-runtime.ts, deactivation and reset paths, relevant active lifecycle
rules including R-ctx-state and R-restore. Current sync ctx reused across lifecycles; async
ctx has input snapshots but live node-backed state/up/down/hooks. Public probes for both
pool kinds: activate, unsubscribe, reactivate; old ctx.state.set changes current state;
old ctx.onDeactivation registration fires on next deactivation. Assertions passed.
Sync oldCtx===newCtx true, async false. This extends prior confirmed stale-output probe.
No runtime changes and no benchmark; perf costs discussed qualitatively only.

Comparison: cleanup-only minimizes substrate changes and permits intentional cross-lifecycle
resource reuse, but relies on all helpers to guard all graph mutations, including races and
noncancellable work; latest-run hooks not historical task ownership. Lifecycle isolation would
reject post-close old-ctx graph effects without promising cancellation of external work, and
should not invalidate older runs within same lifecycle, PAUSE, INVALIDATE, or restore merely
because restore occurs (R-restore is state-preserving). Revocation starts at closure, not only
next activation, to prevent inactive-cache contamination. Full isolation requires reviewing
up/down/upNext/rewire/state writes/persist/hook registration and node-backed reads; down-only
is narrower protection and must not be named full ctx revocation. Existing queued boundary
tasks need separate origin/fate policy, preserving decided committed-boundary/terminal rules.

Implementation candidate only: private per-activation token/version captured immutably by ctx;
new sync ctx at new lifecycle, reuse inside it; cannot refresh old token on reused ctx. Fresh
async contexts within same lifecycle share validity token. No public message/handle/generation
API implied. State.persist retains selected data, not automatically old writer authority;
shared mutable object references cannot be retroactively revoked by ctx checks, and external
Node references/drivers/side effects remain outside this fence. Long-lived resources need an
explicit owner/rebind-to-current-consumer mechanism if old ctx expires; no new API proposed.

Unresolved design knobs: exact closing point and cleanup's allowed state access/mutations;
no-op vs thrown stale-call errors (recommend late output/control drop with diagnostic visibility,
not automatic protocol ERROR); live state reads after expiry; terminal resubscribe/reset;
handling new requests from old ctx vs already accepted queued tasks. Resource cancellation
still mandatory helper responsibility when desired. Recommend lifecycle isolation as a distinct
protocol boundary, not default run cancellation; user has not selected it yet. Final amendment
remains deferred until full walkthrough.

## User accepts ctx lifecycle isolation direction; cleanup ordering review (2026-09-26)

User agrees summary recommendation: output terminal, lifecycle closure, external cancellation
are distinct; ctx graph-operation authority expires with its originating lifecycle; old ctx
must not regain authority on reactivation. Same-lifecycle rerun/PAUSE/INVALIDATE do not revoke
it. Cleanup retains resource cancellation responsibility. Formal/runtime changes still deferred.
User has NOT yet resolved cross-lifecycle private-state retention (persist vs explicit state node),
cleanup state-access boundary, read-after-close behavior or precise diagnostics.

Reviewed real onDeactivation consumers: cascading-cache and keyed-rate-limit capture private
state object, disable active flag and clear/cancel resources; worker captures cancel function;
browser animation cancels scheduling/removes listeners; source helper invokes setup cleanup.
Reactive-layout readinessTextMeasurements and blockMeasurementProvider cleanup call depLatest
on ctx to locate adapters before clearing caches. Thus forbidding every read at cleanup start
would affect real consumers, not only hypothetical state-reading cleanup. No exhaustive consumer
proof claimed and no source edits performed.

Proposed next reading point: begin closing by rejecting old ctx output/control/new scheduling,
state-slot writes and new hook registrations; execute already-registered synchronous cleanups
with access to retiring lifecycle inputs/state (not future lifecycle state), plus captured resources;
then finish normal state cleanup/retention and close. Captured mutable resource objects can be
cleaned; no rollback/deep-clone guarantee or automatic stopping external work. Read behavior after
cleanup, cleanup exceptions and synchronous reentrant subscription need explicit bounded design
before implementation. This ordering is a recommendation for discussion, not yet user-approved.

## User accepts cleanup closing-phase boundary (2026-09-26)

User explicitly agrees preceding cleanup-order recommendation. Begin lifecycle closure by
revoking old ctx output/control/new-task submission, state-slot writes and hook-registration
permissions. Execute already-registered onDeactivation cleanup with read access to retiring
lifecycle inputs/private state and captured resources; then complete lifecycle state cleanup.
Cleanup may release/mutate captured external resources but cannot use old ctx to drive this
node again. A synchronous callback caused by resource.close must not reopen output authority.
This does not promise sandboxing of captured mutable references or rollback of external effects.

Still unresolved: cleanup failure policy and reentrant subscription ordering, read behavior after
closing completes, private-state persistence/reactivation policy. Agreement is walkthrough
consensus for final reconciliation, not activation of Rules or runtime implementation approval.

## Cleanup errors and same-node reentrant subscribe probes (2026-09-26)

Current ordinary nodeDeactivate (not graph-owned permanent release) has no per-cleanup catch.
Public probe: two onDeactivation hooks, first throws; unsubscribe calls first only, throws,
leaves previously-emitted cache1 intact because later reset code never executes. Distinguish
this from permanent release's separately implemented failure aggregation; do not extrapolate
its contract to ordinary deactivation.

Second raw public probe: cleanup calls same node.subscribe synchronously. New subscriber gets
START DATA1 from old cache; nodeActivate sees hasCalledFnOnce still true and does not run fn;
outer cleanup then clears cache/hooks/first-run state. Observed runs=1 (no new invocation),
cleanups=1; subsequent new subscriber unsubscribe invokes no additional cleanup. No runtime
edits. Demonstrates actual closing/reentry interleaving, not just hypothetical stale ctx.

Recommendations for discussion, not yet accepted: revoke old ctx graph authority before any
user cleanup or cascading dependency cleanup; attempt all independent registered cleanup and
dependency unsubscriptions despite failures; finalize logical lifecycle bookkeeping, report
collected cleanup failures after attempts, do not synthesize protocol ERROR or auto-retry.
Logical closure must not be reported as proof every external resource was released.
Reject same-node subscribe while closing, before installing subscriber or sending START; allow
normal later subscription after closing under existing terminal/activation rules. This narrower
alternative avoids inventing deferred-subscribe/activation-queue semantics merely for reentry.
Subscription to unrelated nodes is not blanket-prohibited; cycles reentering a closing node
meet the same check. Failed-cleanup resource recovery and eligibility of later reactivation
remain to review separately; no new decision/rule/runtime edits.

## Existing lifecycle fields cannot identify cleanup-in-progress (2026-09-26)

User authorizes checking reuse before adding closing state. Current LifecycleState has only
subscribers and activated (core.ts:75). nodeDeactivate sets activated=false BEFORE dependency
unsubscriptions/hooks; it remains false after closure. Subscriber count is zero both during
and after closing. Public value status, terminal/hasTorndown, hasCalledFnOnce and insideRunWave
encode different concerns and cannot reliably distinguish the two phases; fn/activation can
also be absent or reentrant. _released denotes permanent graph release, not reusable inactivity.

Conclusion: some additional transient distinction is necessary to reject only subscriptions
during cleanup while allowing later activation. It need not be a public Status member or an
independent boolean. Recommend folding it into the already-proposed internal lifecycle identity/
phase representation, deriving activated if needed, rather than redundant independently mutable
flags. Exact representation (phase vs guard+token) remains implementation design; phase alone
does not distinguish old/new active lifecycles, so identity fencing is still required. No extra
public message/status/API proposed and no implementation or authority mutation performed.

## State design sequencing and ordinary reactivation (2026-09-27)

User accepts deriving state design from semantic questions rather than historical field layout:
node runtime owns protocol facts; coordinated transition entrypoints maintain consistency;
published output, invocation work/readiness, lifecycle identity/phase, and user algorithm state
are distinct concerns. Do not lock exact enum/storage/public status API now. User agrees to
walk restart/resubscription/reactivation first and then derive minimal stored/derived state.

First ordinary nonterminal reactivation stop, current TS HEAD unchanged dafc5ae57d446a59a7388214c31bd7a6e73d1519.
Read R-rom-ram@1 (rules:20; lacks activated_by), active R-ctx-state@1, lifecycle tests and code.
Clarify state retention classification: plain state has neither deps nor fn; depless producer
has fn and follows cache-clear path. No terminal, pause, restore, dirty cleanup or late callback
in baseline probes. Subscriptions count includes graph dependencies/retains, not only UI sinks.

Public probes: state10 -> compute double with private invocation counter. Subscribe outputs20;
last unsubscribe runs cleanup and clears compute output, preserves state10; state.set30 while
disconnected does not invoke compute; subscribe again emits START DATA60 and invokes fn anew.
Private counter reads [0,0] under default, [0,1] with persist=true. Both asserted. Depless producer
with two subscribers: first unsubscribe no cleanup, last unsubscribe cleanup1/cache cleared;
reconnect starts fn second time and emits START DATA2. Asserted. Reconnect itself is not PULL.
Output cache retention and private-state persistence are independent; persist does not retain
compute output cache, active subscriptions or old ctx authority. Current deactivation clears
pause locks/buffer, pending demand, dep records and replay ring; future agreed ctx fencing is
not implemented by these tests. No rules/runtime changes. Separate-node retained state requires
its own owner/lifetime; process restart durability remains distinct. Pending design question is
whether private cross-lifecycle persistence remains or all such state becomes explicit node-owned.

## Alternatives to private-state persist (2026-09-27)

User asks how persist capabilities could be replaced if removed; no removal approved. Search
current TS src found 9 calls in CQRS runtime/projection, eventFlow runtime/projection, process,
admissionHandoff, keyed-rate-limit correlation, wire-edge-group output/gate. Inspected nearby
state: counters, seen IDs, aggregate values, high-water/cursors, pending correlations and cause
tombstones. This is not exclusively resource retention or trivial cache. No migration/test run.

Alternatives discussed: longer-lived explicit owner/reducer with declared downstream views;
graph-owned retain keeps owner active (existing graph.retain) but changes disconnected processing
and resource lifetime, so not equivalent to dormant memory preservation; reconstruct from complete
explicit snapshot+replay/cursor material when available; host-owned durable model for process restart.
Plain state as input suffices for externally-written values but not free replacement for reducer
private accumulator: next state depends on prior state plus event; making remembered node an input
and mutating it inside consuming fn risks undeclared feedback/reentrancy; ctx.up cannot send DATA.
Do not propose hidden cache peeks, closure Map or broad new persistence API to erase one method.
Recommendation: no claim lossless zero-cost removal; decide data ownership versus activation lifetime
before removing persist, and validate replacement on aggregate plus correlation/dedup real consumers.
User already accepted plain state retention/compute recomputation baseline; private persistence
policy remains open and old ctx authority is separate from retained data lifetime.

## User accepts private-state retention capability; API form remains open (2026-09-27)

After distinguishing ctx.state (node-private memory), graph.state (explicit graph node),
ctx.state.persist(true) (method) and internal/checkpoint ctxState.persist (same policy's
representation, not another public NodeOptions entrypoint), user agrees persist has a useful
role. Retain the capability to preserve private state across lifecycle transitions; do not force
all such memory into another state node. User explicitly reserves naming, number of expressions/
entrypoints and public API shape for later review. This is not approval of all current syntax,
new options, disk persistence or continued authority for old ctx. State retention and ctx lifecycle
revocation remain separate. Final Rules/API/runtime reconciliation remains deferred.

## Terminal resubscription versus ordinary reactivation (2026-09-27)

Next walkthrough stop after private retention agreement. Active R-terminal@1/D17 specifies
terminal late subscribe rejection by default and fresh-lifecycle reset for resubscribable opt-in.
Current nodeSubscribeOwned invokes reset on any terminal late subscription; reset clears old
subscriber set, terminal, dep records, pause/demand/replay state, compute/producer cache and
nonpersist private state; plain state cache is retained. Tests explicitly detach terminal-era
subscribers. It does not require old subscriber count to reach zero first.

Public probe: async producer resubscribable:true, per-run output id and cleanup recording id.
First subscriber gets id1; COMPLETE while still subscribed; second subscriber resets and gets
START DATA2. runs2, cleanup log empty. Old first-run callback DATA99 reaches fresh subscriber
as DIRTY DATA99; old subscriber receives nothing. Unsubscribe both afterward yields cleanup
log [2] only. nodeResetLifecycle does not fire this node's live onDeactivation hooks; next fn
clears old hook list. These are verified current gaps relative to accepted future lifecycle
isolation/cleanup direction, not a full protocol conformance verdict. No runtime changes.

Recommended composition for discussion: resubscribable authorizes starting another lifecycle,
not bypassing closure of old one. If old lifecycle already deactivated, don't run cleanup twice;
otherwise revoke ctx/close old lifecycle (using agreed read-only cleanup boundary) before reset
and new subscriber installation/activation. Old subscribers remain detached; ordinary state and
opted-in private data retention are separate from output/ctx rights. Cleanup-failure admission
of a new lifecycle remains unresolved and must not be silently selected here. No normative edits.

## User accepts close-before-terminal-resubscription (2026-09-27)

User agrees terminal resubscription must close previous lifecycle before starting next:
resubscribable grants eligibility, not cleanup bypass; if already deactivated do not repeat
cleanup; detach old subscribers, revoke old ctx, apply independently selected data retention.
Cleanup-failure permission to start next lifecycle remains unresolved. Clarification requested:
'reset' refers to existing internal _resetLifecycle -> nodeResetLifecycle, invoked by terminal
subscribe when resubscribable:true, not a public node.reset() or new user API. No runtime or
Rules changes; final reconciliation remains deferred.

## User accepts cleanup failure without persistent restart blocking (2026-09-27)

User accepts the recommendation: revoke old ctx, attempt remaining independent cleanup and
finish internal closure, then report cleanup errors. An operation encountering those errors
does not continue into starting a new lifecycle. A later subscription attempt is evaluated
under normal activation/resubscription eligibility; no persistent cleanup-failure blockade,
explicit unblock API, or external resource probe is introduced. Later subscription is not
proof that resources were successfully released or that the caller handled the error.
No automatic retry of old cleanup; no conversion of cleanup failure into protocol ERROR.
Helpers needing exclusive resource ownership may enforce their own setup/resource policy.
Error reporting/diagnostic retention details remain to be designed; this agreement does not
require retaining error objects forever. This records walkthrough agreement only: no runtime,
Rules, formal, conformance, or decision-ledger changes; final reconciliation remains deferred.

## User accepts activation-failure ownership distinction (2026-09-27)

User agrees to distinguish subscription-establishment throws, fn failures converted to protocol
ERROR, and startup that has already admitted external effects/obligations. Ordinary-node candidate:
release subscriptions acquired by the failed attempt; if that ends its lifecycle, revoke ctx and
run cleanup; report original and cleanup failures without persistent restart blocking. Shared
dependencies lose only this attempt's subscription. Resource release cannot retract delivered
messages or external effects. Reconcile this candidate with graphrefly-ts:D161 retained ownership
before selecting a uniform rule; graphrefly-ts:D161 review remains outstanding. No implementation or normative
record change authorized by this walkthrough agreement.

## User accepts external-only failure history retention (2026-09-27)

User agrees: historical failures are offered as diagnostic events to external receivers;
without a receiver, do not retain history, buffer it for later delivery, or provide retroactive
replay. External receivers own storage, presentation and retention. Internal runtime keeps only
facts needed for current execution and correctness, including temporary aggregation of errors
while attempting independent cleanup. Current-operation failures must still be reported to the
caller regardless of diagnostic receivers; diagnostic absence does not swallow exceptions.
Inspection reads current owner-maintained state; history requires an external recording owner.
Diagnostic receiver failure must not interrupt lifecycle cleanup or change protocol results.
Diagnostics do not automatically produce protocol ERROR or retries. Export API and receiver
failure handling details remain deferred to final design. This is walkthrough agreement only;
no runtime, normative rule, formal, conformance or decision-ledger changes.

## User accepts helper ownership before cleanup handoff (2026-09-27)

User agrees: before cleanup responsibility is successfully handed to lifecycle management,
the fn/helper that acquired an external resource owns its cleanup, including partial setup
failure. After successful handoff, lifecycle management invokes the registered cleanup on
closure under the previously agreed failure-reporting policy. Retain the simple returned-cleanup
interface; do not add generic discovery/tracking of arbitrary user-created resources. Current
effect registers only a successfully returned cleanup; internal source wrapper registers an
early trampoline but still needs setup to return the actual cleanup, so a throw before return
can leave resources unknown to runtime. Helpers must handle their own pre-handoff failures;
report setup/cleanup failures rather than claiming successful release. This does not alter
existing per-run hook replacement or make protocol ERROR automatically deactivate a node.
No runtime or normative changes; final reconciliation remains deferred.

## User accepts cleanup returned after lifecycle closure (2026-09-27)

User agrees: if synchronous reentrancy closes a lifecycle while setup/fn is still executing,
a cleanup subsequently returned by that invocation is executed immediately once and remains
owned by the retiring lifecycle; it must not be registered onto a new activation. Wrapper-level
cleanup handoff is established before invoking setup/fn; this does not permit closed ctx hook
registration or revive its operational authority. Actual lifecycle closure is required; protocol
terminal alone does not imply deactivation. Late cleanup failure follows cleanup error policy:
report it, do not convert it into protocol ERROR, and do not retry automatically. Local per-call
handoff bookkeeping does not require a new public status or historical tracking. Current internal
source wrapper already handles return-after-deactivation with a flag and early trampoline;
current effect registers only after fn returns and lacks that handling. Its broad try/catch
will need separation of invocation failure from cleanup failure during later implementation.
Exact handoff representation, interaction with reactivation during the remaining old call stack,
and failure-reporting plumbing remain for final design. No runtime/normative edits.

## User accepts rejecting fresh lifecycle during retiring synchronous invocation (2026-09-27)

User agrees: while the same node is closing or a retiring lifecycle's synchronous invocation
and associated synchronous cleanup/unwind have not exited, reject a subscription that would
start a new lifecycle before installing the subscription, resetting lifecycle state or emitting
START. Do not queue it or retain a failure blockade. Ordinary extra subscriptions within the
same valid lifecycle follow normal subscription rules. Once the retiring synchronous invocation
and closure finish, later subscriptions follow ordinary eligibility. Do not wait for arbitrary
old external async work; old ctx isolation and helper resource cleanup remain responsible there.
This orders late-returned cleanup before new activation without introducing a public status or
unlock API. Existing insideRunWave rejects fn reentry too late to establish this whole guarantee;
exact reusable guard/phase representation is deferred to consolidated state design. This records
a walkthrough agreement only, not runtime, rules, formal, conformance or decision-ledger edits.

## User accepts private-state finalization after retiring synchronous cleanup (2026-09-27)

User agrees to the ordering: revoke old ctx driving/mutation/registration rights immediately
on closure; allow retiring cleanup to read required old-lifecycle data; process registered
cleanup and any cleanup returned by the still-unwinding synchronous invocation; then finalize
private-state retention (clear nonpersist state, retain opted-in state) before another lifecycle
may start. Waiting here means synchronous stack unwinding, not awaiting external async work or
introducing asynchronous shutdown. Cleanup errors do not prevent remaining independent cleanup
or final retention/reset processing; report them without retaining nonpersist state for diagnosis.
Persist retains the object, not a pre-cleanup snapshot: captured object/resource mutations made
by cleanup remain observable in retained data, and persistence does not promise live reusable
resources. Helpers own the distinction between retained progress and resources to recreate.
No deep copy, resource repair, renewed old-ctx authority, or historical diagnostic retention.
Exact phase/guard/read-view representation remains deferred. Walkthrough agreement only;
no runtime, rules, formal, conformance or decision-ledger edits.

## User accepts rejecting closed ctx dynamic reads (2026-09-27)

User agrees: active ctx reads normally; retiring cleanup, including late-returned cleanup,
may read the old data needed for cleanup; after full closure old ctx dynamic reads (private
state access and dynamic input reads) reject with an explicit invalid-context error rather
than returning undefined/SENTINEL or exposing a later lifecycle's data. Do not retain a new
historical snapshot just to support old ctx reads. Persist preserves data for a fresh ctx,
not authority for the old ctx. Previously obtained ordinary JS values/object references cannot
be revoked; no deep freeze, deep copy or reference tracking promised. Exposed value fields and
method boundaries must be classified in final API design; do not claim every old ctx property
becomes unreadable. Inspection accesses current state through its separate read-only surface.
Walkthrough agreement only; no runtime/normative changes.

## User accepts invalid ctx operation outcomes (2026-09-27)

User agrees: once ctx lifecycle authority is revoked, down drops late output without throwing;
up/upNext, dependency mutation, private-state set/persist and hook registration reject with an
invalid-context error. Dynamic reads reject after full closure except the agreed retiring-cleanup
read window. Wrapper-managed late cleanup does not use invalid ctx registration. PAUSE,
INVALIDATE and same-lifecycle reruns alone do not revoke ctx. Terminal message handling remains
separate. No mandatory history or default fault record for every dropped late output; optional
external diagnostics must not affect execution. No runtime/normative changes.

## User accepts lifecycle ownership of deferred ctx work (2026-09-27)

User agrees: ctx-submitted upNext/rewireNext work belongs to its submitting lifecycle; revoke
not-yet-executed work when that lifecycle starts closing. Same-lifecycle reruns or PAUSE do not
alone cancel it. Preserve D62 terminal-only queued-rewire behavior while the lifecycle remains
open; terminal and actual closure are distinct. New lifecycle does not inherit old queued work.
Previously valid submissions invalidated by closure are dropped, unlike fresh submission through
an invalid ctx which throws. Reuse lifecycle identity rather than introducing a task state system.
Executed effects are not rolled back. Necessary resource release must not rely solely on queued
rewire; dependency unsubscription and cleanup must support actual closure. No normative edits.

## Consolidated remaining cleanup choices for review (2026-09-27)

User requests all remaining cleanup decisions together, then moving to next walkthrough topic.
Proposals (not yet approved): deterministic existing local ordering (dependency releases in dep
order, then own registered hooks in registration order, late-returned cleanup when available),
without a whole-graph order guarantee; one invocation attempt per live registration, consumed
before call, duplicate function registrations not deduplicated; synchronous cleanup contract
without awaiting returned async work, helper-owned async completion/error handling; transient
structured failure collection preserving primary operation failure and cleanup failures with
phase/owner attribution, exact public error carrier deferred. Existing per-run hook replacement
remains unchanged. Async thenable misuse handling is an API-validation detail still to resolve;
do not silently claim asynchronous resource release completed. Final reconciliation remains deferred.

## User accepts consolidated cleanup contract (2026-09-27)

User accepts the four consolidated proposals above: dependency releases in dependency order,
then own live hooks in registration order, with late-returned cleanup executed when available;
no graph-global cleanup order. Each live registration is consumed before invocation and attempted
once, even on throw/reentrancy; duplicate function registrations remain distinct. Cleanup contract
is synchronous, with no Promise waiting; helper owns async close completion/failure and runtime
closure is not proof of external async release. Preserve original operation failure and aggregate
other cleanup failures without overwriting; retain only transient report material. Exact error
carrier and async-contract enforcement remain interface details for final design. Own cleanup
cannot assume dependencies remain active, though agreed retiring data reads remain available.
Resources requiring a specific interdependent close order belong in an explicitly ordered helper
cleanup. Existing per-run hook replacement remains unchanged. Cleanup walkthrough provisionally
closed; next topic is reactivation dependency initialization, cached/initial messages, and first-fn
readiness. No runtime, normative, formal, conformance or decision-ledger changes.

## User accepts independent partial and terminal-input capabilities (2026-09-27)

User agrees to retain the independent semantics of partial true/false and terminalAsRealInput
true/false. partial controls the initial all-dependencies-input readiness gate, without bypassing
PAUSE or outstanding DIRTY/readiness conditions. terminalAsRealInput treats dependency terminal
as fn input, both allowing a no-DATA terminal dependency to satisfy its own initial gate and
supporting subsequent terminal-driven processing. Exact names, defaults and sugar exposure remain
for final API design. Persisted private state does not replace new-lifecycle dependency inputs.
No implementation/normative changes.

## User accepts initial-gate occurrence retention and consumption distinction (2026-09-27)

User agrees: while initial all-input readiness blocks fn invocation, retain received DATA
occurrences (including equal values) and per-dependency wave boundaries; value-level derived/effect
callbacks consume latest values rather than implicitly running once per retained occurrence.
Substrate does not choose pairing/cartesian/latest semantics for arbitrary multi-dependency fn.
No implicit truncation or latest-only replacement to bound this pending occurrence storage. A
missing dependency may permit unbounded accumulation from others; partial:true permits operator
consumption with explicit retention/coalescing/drop policy. Bounded policy belongs to explicit
operator/helper semantics, not hidden modification of first-run readiness. No normative/code edits.

## User defers invocation while other dependencies remain DIRTY (2026-09-27)

Clarified user meant invoking fn as soon as one dependency delivers DATA even while other
already-DIRTY dependencies remain unresolved, not initial missing-value tolerance. Current
nodeTryRun checks pending > 0 before partial; neither partial:true nor current merge supports
this timing mode. This is an independent scheduling dimension from initial input completeness.
User explicitly parks the capability until a concrete need arises; do not add a mode, API,
implementation or active work item now. Existing settlement gating remains unchanged. The prior
recommendation to retain first-run-only partial:false after INVALIDATE was discussed but not
explicitly accepted; that choice remains open for the walkthrough. No normative/runtime edits.

## User accepts first-run-only completeness gate (2026-09-27)

User explicitly accepts retaining current partial:false first-run-only completeness semantics:
after fn has run, INVALIDATE does not re-arm the all-input readiness gate; another dependency's
later settlement may invoke fn while an invalidated dependency is SENTINEL. New lifecycle resets
the first-run gate. All ordinary settlement/PAUSE/PULL gates still apply. State this limit clearly;
do not imply partial:false guarantees populated inputs on every invocation. Reconcile value-level
callback typing with possible missing values during final API design. No new always-complete
mode introduced; the separately discussed early invocation while other deps remain DIRTY stays
deferred. Walkthrough agreement only, no runtime or normative edits.

## User accepts explicit terminal-handling responsibility (2026-09-27)

User annotation explicitly accepts: ordinary compute nodes retain default automatic dependency
ERROR propagation and COMPLETE once all dependencies are terminal; operators that need terminal
processing explicitly take responsibility for the relevant termination policy (reduce final output
and COMPLETE, catch ERROR handling). Consolidated API design must make option combinations and
priorities explicit rather than present mutually overriding behavior as fully independent flags.
Current implementation checks automatic ERROR before terminalAsRealInput, and terminalAsRealInput
before automatic all-terminal COMPLETE. Exact API combination validation/representation is not
chosen here. This approval addresses the annotated responsibility recommendation; it does not
separately approve every previously described edge case, including indefinite initial waiting
when a dependency completes without DATA. No runtime/normative changes.

## Error recovery capability distinction confirmed (2026-09-27)

User confirms distinction after investigation: terminalAsRealInput:true lets an empty terminal
dep satisfy its own initial gate without inventing DATA or bypassing other readiness gates.
Current rescue (catchError alias) absorbs upstream ERROR and emits a recovered DATA value without
self-termination; it neither revives its terminal source nor switches to a replacement source.
Focused operators.test.ts run passed 3 rescue/catchError tests; 42 tests excluded by name filter.
Replacement-source recovery and continuing subsequent inputs after a single computation failure
remain distinct requirements for discussion, not delivered by that rescue behavior. User has not
selected an implementation, changed terminal-is-forever, or authorized a new operator here.
Do not label the entire recovery need implemented or infer which historical failed attempt was
meant without further evidence. No runtime/normative changes.

## User accepts local recovery first; defers multi-node recovery wrapper (2026-09-27)

User agrees to prioritize handling recoverable per-operation failures at the operation boundary,
before they become protocol ERROR. This includes synchronous computation callbacks and source-
owned async failure handling: emit a recovery value or explicit failure DATA as appropriate, so
later inputs/operations can continue when the underlying capability remains usable. A synchronous
try/catch alone does not catch later Promise rejection. Existing terminal upstream nodes are not
revived by downstream error-to-DATA conversion; closed sources may still require reconnect,
resubscribe or replacement. Defer a generic owned multi-node recovery/restart wrapper until a
concrete need for rebuilding a group exists. Preserve protocol ERROR terminal semantics. No new
wrapper API, default automatic recovery, retry policy or implementation selected/authorized here;
final sugar API design remains deferred. Walkthrough agreement only, no normative/runtime edits.

## User accepts same-wave DATA and terminal handling (2026-09-28)

User agrees: retain DATA occurrences preceding terminal in the same wave; when eligible, one
raw fn invocation can observe the accumulated DATA plus terminal metadata, without a redundant
second invocation solely for that terminal. Operator callbacks may run per DATA inside that
invocation. Terminal does not retroactively undo delivered DATA, but DATA does not bypass other
readiness, PAUSE or demand gates; automatic terminal propagation need not wait for deferred fn
processing. Default terminal policy versus explicit operator terminal ownership remains separate.
Consistent with prior accepted terminal-immediate/pause-buffer-discard direction. No code or
normative edits.

## User accepts terminal state versus invocation input distinction (2026-09-28)

User agrees to retain the distinction between persistent runtime dependency-terminal state
(readiness/all-terminal decisions) and per-invocation ctx.terminal metadata. After the invocation
consumes the terminal input, later calls driven by other dependencies do not repeat it; false
means no terminal input for this invocation, not that the dependency became live again. Deferred
terminal input may be observed by a later eligible invocation, subject to node terminal/lifecycle
closure semantics. Operators needing algorithmic memory of terminated inputs maintain it in
private state; public ctx.terminal is not a current-state snapshot of all dependencies. Current
conformance.part-03 test explicitly covers COMPLETE on A then DATA on B with no repeated A
terminal metadata. No tests rerun for this note and no runtime/normative edits.

## User defers downstream-requested upstream restart without a use case (2026-09-28)

User agrees not to introduce generic downstream-requested/forced upstream restart and explicitly
states there is currently no user scenario requiring it. Dependency topology alone does not grant
lifecycle ownership over shared upstream nodes. Retain per-node resubscription eligibility; a
consumer's resubscribable or terminalAsRealInput setting does not override upstream eligibility.
Possible future helper-owned reconnect requests and coordinated multi-node recovery remain
hypothetical, not selected APIs or active implementation work. Do not add a protocol message,
restart permission system, request deduplication or recovery coordinator for this speculation.
No normative/runtime edits.

## User accepts restore versus fresh lifecycle distinction (2026-09-28)

User agrees restore preserves represented logical state/cache and all serialized private state,
including nonpersist state, rather than applying fresh-lifecycle clearing. Reconnection alone
must not recompute restored derived cache. Restore does not recreate external execution state,
old ctx authority, cleanup closures or task handles; adapters own explicit resource reestablishment.
Clarified hasCalledFnOnce preserves a behaviorally necessary fact: after first invocation the
completeness gate stays open even after invalidation, and cache presence cannot encode this.
Exact flag name/storage remains deferred. Example private run count was user-owned illustrative
ctx.state content, not a runtime field. Current code drops pause/deferred execution material;
full checkpoint admissibility/coverage is not newly promised by this agreement. Proceed to
consolidated state design, retaining restore-adapter and checkpoint coverage limits as explicit
follow-up details. No implementation or normative edits.

## User accepts consolidated state information model (2026-09-28)

User accepts the proposed information model as the basis for consolidated design: distinguish
published protocol facts, received inputs/owed work and scheduling facts, lifecycle/resource/ctx
ownership, and user private algorithm state. Node runtime coordinates the first three through
explicit transitions rather than independent competing managers; fn/helper owns algorithm content,
with lifecycle management applying agreed retention/cleanup rules. Store irreducible facts such
as first-invocation history and lifecycle identity; derive pause/ctx permissions/invocation and
reactivation eligibility rather than duplicate mutable booleans. Performance-derived counters
may remain with explicit invariants (pending equals unresolved dirty dependency count). Candidate
internal phase direction inactive -> active -> closing -> inactive is accepted at this model
level; closing includes retiring synchronous invocation/late cleanup, terminal remains orthogonal,
and permanent release is not ordinary inactive. Public status is a read-only representation of
facts, not the full internal state machine; preserve observable distinctions such as resolved
rather than infer them solely from cache. Exact fields/layout, permission interfaces, transition
implementation and restore coverage remain for subsequent design. No runtime or normative edits.

## User accepts lifecycle permission matrix and centralized admission (2026-09-28)

User agrees: check lifecycle identity/phase first, then independent protocol constraints
(terminal, PAUSE, PULL/readiness). Active ctx dynamic reads/writes/hooks/control/output follow
normal rules; closing revokes writes/hooks/control and drops output, permits only agreed cleanup
reads, and invalidates pending lifecycle-owned work. Fully retired ctx dynamic reads throw and
never revive when the node becomes active again. Node subscription admission is separate:
nonterminal inactive may activate; nonterminal active may add a subscriber; closing or retiring
synchronous invocation rejects before acquisition/START; terminal requires own resubscribable
eligibility and close-before-new with cleanup failure stopping the current attempt; permanently
released nodes reject. Default PAUSE can coexist with activation/subscription but gates new fn
invocations. Terminal alone does not revoke all ctx authority or imply closing; preserve prior
queued-rewire distinction. Lifecycle management supplies shared admission/permission logic to ctx,
subscription and deferred execution entrypoints; dispatcher receives admitted calls, inspection
reads projections. Cleanup-only read authorization must not be a blanket phase-based allowance
for every old callback, including synchronous reentrant callbacks. Exact mechanism remains a
pending implementation-design question, not a new public status/API. No runtime/normative edits.

## User accepts lifecycle transition ordering and return-path checks (2026-09-28)

User accepts: establish lifecycle/resource ownership and internal transition facts before any
user-code callback; revalidate originating lifecycle and subscription after callbacks before
continuing startup. Fresh activation establishes identity/start bookkeeping before observable
callbacks, records acquired subscriptions before START/cache/dependency delivery, and invokes fn
only through dispatcher when eligible. Active means lifecycle exists, not fully wired or fn-run.
Closure enters closing/revokes rights and invalidates queued work before resource callbacks;
consume each release/hook record before invoking it to prevent repeated execution on reentry.
Repeated closure requests while closing do not initiate another cleanup pass. Handle late cleanup,
finalize retention/transient facts, and return inactive only after retiring synchronous execution
and cleanup exit. After fn returns, runtime must revalidate lifecycle before ordinary post-run
settlement/reset/scheduling: a retired invocation must not synthesize RESOLVED or overwrite closed
state; only its required unwind/cleanup remains. Retain existing agreed ordinary versus transferred
owner failure handling; collect independent cleanup failures, report after internal transition,
and do not roll back observable messages/effects. Synchronous reentry observes coherent ownership
and phase, not a promised invisible atomic lifecycle transaction. Exact implementation and
normative reconciliation remain pending; no code/rules edits.

## Consolidated status view direction (2026-09-28)

User agrees to a derived read-only status view and the selection principle: public status answers
stable caller questions rather than mirrors all implementation flags. Proposed structure is
status:{cache,output,lifecycle}, with cache candidates empty/waiting/ready/stale, output
open/completed/errored, and lifecycle inactive/active/closing. Combine facts only when equivalent
for that view; DATA and RESOLVED may both mean ready while remaining distinct protocol events.
Output and lifecycle are orthogonal. Derive status from owner-maintained facts, no independently
mutable duplicate status object; update facts before observable callbacks, produce a consistent
read snapshot. Basic status gives conclusions; optional inspection explains simultaneous blockers;
internal identity/reentry/cleanup bookkeeping is not automatically public. Terminal/cache
combination rules, precise freshness terminology and implementation storage remain open. No
runtime or normative edits; previous settled/resolved observable-status representation changes
require later formal reconciliation, not silent implementation.

## User accepts cache status transitions at terminal (2026-09-28)

User agrees to the refined proposed cache view: empty=no value/no pending wait; waiting=no value
and awaiting settlement, not necessarily executing fn; ready=value with no unresolved staleness
mark; stale=retained value with unresolved staleness, without promising a future update. On
COMPLETE/ERROR: empty stays empty, waiting becomes empty, ready stays ready, stale stays stale.
Terminal closes the wait/output but does not certify an already-stale cached value as fresh.
Ready is protocol-relative, not a claim of external-world freshness. Lifecycle closure applies
existing selected retention behavior (compute/producer cache cleared, plain state value retained)
and does not itself invent COMPLETE. Preserve the irreducible cache-staleness fact across terminal
instead of overwriting it with terminal status; exact representation remains for design. This is
a new agreed status-view direction pending formal reconciliation, not current runtime behavior
or authorization to edit runtime/rules.

## User accepts START versus activation and active-terminal clarification (2026-09-28)

User accepts: START is the per-subscription handshake and alone changes neither cache, output
nor lifecycle status. First subscription may independently establish active lifecycle; adding a
subscriber to an active node does not create another lifecycle. START does not imply DATA or fn
invocation (including pre-activation PAUSE). output:completed with lifecycle:active means the old
lifecycle has not yet closed, not that terminal resubscription retained completed output. Last
unsubscribe may close it while output remains terminal; an allowed terminal resubscription closes
the old lifecycle before new initialization with output open. No runtime/normative edits.

## User accepts minimal status backing facts (2026-09-28)

User agrees: derive status from cache presence/value, unresolved cache-settlement/staleness fact,
current terminal record and lifecycle phase; lifecycle identity additionally protects ctx/tasks
without being public status. Cache staleness cannot be equated to unresolved dependency count
(pause may leave stale cache with zero pending deps) or downstream DIRTY debt (quiet pull may be
stale without announcing DIRTY). With value, staleness selects stale/ready; without value, open
output plus unsettled cache selects waiting, otherwise empty. Terminal ends waiting without
certifying a stale retained value. Current terminal ERROR payload is necessary current state,
not historical diagnostic retention. Exact representation/name and justified redundant presence
cache remain implementation design, with one canonical authority and explicit invariants.
No runtime or normative edits.

## User accepts released status variant and on-read projection (2026-09-28)

User accepts status as an on-read O(1) derived snapshot, with normal cache/output/lifecycle fields
and a permanently retired variant {lifecycle:'released'} without misleading cache/output fields.
Released means runtime unusable, not proven successful external resource cleanup. Reuse existing
permanent release fact; exact closing-to-release implementation still follows ownership/cleanup
rules. Getter performs no dependency scan, fn invocation, messages or computation demand; captured
status is a point-in-time value, not a live object. Default no cached status object or invalidation
system; optimize allocations only with evidence. Read-only API/runtime enforcement details remain
for implementation design. No code/normative edits.

## User accepts rejecting unsupported in-progress restorable checkpoints (2026-09-29)

User explicitly agrees to reject generation of a restorable checkpoint when runtime-known
in-progress state is unsupported by checkpoint/restore, rather than silently discard it or claim
complete restoration. User asks whether save should wait and whether a dispatcher queue owns this;
no automatic waiting/queue, async core, cancellation, forced draining or checkpoint scheduling API
is approved by that question. Distinguish synchronous state capture from external asynchronous
storage, and current eligibility from future completion guarantees. Broader exact checkpoint
coverage/admission API remains to be designed. No implementation or normative edits.

## User accepts future checkpoint-wait helper ownership (2026-09-29)

User annotation accepts the conditional direction: if automatic wait-then-capture/save is needed,
a graph-layer checkpoint coordination helper owns async waiting, cancellation/timeout and
non-completion policy, and revalidates eligibility at the synchronous capture boundary. Dispatcher
invocation completion or FIFO position does not establish graph/external-resource quiescence.
This is not a request to implement the helper, add a waiting queue or authorize forced RESUME/PULL.
Synchronous capture remains separate from asynchronous storage. No runtime/normative edits.

## Error reporting agreement and existing DATA result vocabulary (2026-09-29)

User accepts separating protocol ERROR, operation/lifecycle failures reported to their caller or
transferred owner, and optional external diagnostics. Single failures preserve original errors;
multiple operation/cleanup failures retain original causes and phase attribution in a transient
report, exact carrier deferred. Late cleanup errors belong to retiring invocation, not a fresh
ctx/protocol ERROR. Async helper failures need explicit helper-owned reporting; diagnostic receiver
failures cannot alter protocol/lifecycle outcomes or recursively produce diagnostic failure loops.
User highlights existing nonterminal DATA-level result contract; assistant initially invented an
ok:boolean illustrative shape and user corrected it. Verified canonical existing exported types
in packages/ts/src/data/index.ts: DataResult<T,E> = DataOk<T> | DataError<E>, discriminant kind:
'ok'/'error', DataIssue kind:'issue' with required code/message and optional severity etc. This
passive D184 vocabulary carries no protocol terminal/lifecycle semantics; use it rather than
invent a competing Result shape. DATA(DataError) may yield ready cache and open output; substrate
does not interpret payload kind/error/retryable as terminal or automatic retry. No code edits.

## Verified missing value after INVALIDATE despite settlement gating (2026-09-29)

User questions whether all A/B dependencies must deliver DATA/RESOLVED before any post-first
invocation, which would exclude (undefined,21). Read runtime and ran /tmp/graphrefly-first-gate-probe.ts
using current source via pnpm exec tsx. For both partial:false and partial:true: state A10/B20,
subscribe derived and discard initial captures, A.down(INVALIDATE) produces no callback, B.set(21)
produces exactly [[undefined,21]], asserted successfully. No runtime edits. Distinction: pending
counts only outstanding DIRTY dependencies, not every declared dependency on every invocation;
INVALIDATE releases its dep's dirty debt and clears its value. RESOLVED also does not invent a
missing value. Callback typing change remains proposed, not approved; if user intends a stronger
ongoing gate, reconcile behavior before modifying types.

## User approves optional value callback inputs (2026-09-29)

User explicitly chooses T | undefined for each dependency parameter of derived/effect value-level
callbacks, following verified post-first-run INVALIDATE missing-input behavior. Retain existing
first-run-only partial completeness and dirty-settlement gates; do not add an always-complete mode
or silently skip missing-input callbacks. Callback may guard missing inputs or handle them as
business state. Input undefined remains SENTINEL absence; derived return undefined remains no emit;
DataResult error remains ordinary DATA. Applies even with partial:false, since that option does
not guarantee populated inputs after first invocation. This is an approved API type direction for
consolidated changes; source types/runtime have not been changed during the walkthrough.

## User accepts explicit cleanup read view (2026-09-29)

User accepts cleanup-specific read view supplied by lifecycle management, rather than temporarily
re-enabling reads on retired ctx. Proposed raw hook shape onDeactivation(cleanupView => ...)
provides narrow old-private-state/allowed-input reads without output/control/state writes/hooks/
rewire. Lifecycle management enters closing/revokes ordinary ctx, supplies view for each cleanup
call, then revokes that view in finally; node may remain closing for other cleanup after this
view expires. View validity is owned by lifecycle invocation management, not user private state,
so no circular state dependency. Explicitly passed view can be delegated; no sandbox/deep-copy
promise or automatic revocation of obtained ordinary references. Ordinary effect returned
zero-argument cleanup need not gain raw ctx access. This refines prior read-during-cleanup intent;
exact view name/type and late-cleanup adapter plumbing remain for design. No code/normative edits.

## User accepts uniform per-invocation input views across sync/async (2026-09-29)

User accepts revised recommendation after questioning sync/async surprise: both sync and async
calls expose stable per-invocation input views (waveData, terminal input, PULL parameters and
observed dependency latest values), not a publicly retained sync ctx refreshed to later inputs.
This supersedes the unapproved suggestion to preserve public sync ctx reuse across calls.
Private ctx.state remains shared node algorithm state; operation authority remains lifecycle-
bound, not revoked merely by fn return or another same-lifecycle invocation. No implicit latest-
request-wins fencing. Payload objects are not automatically deep-copied/frozen; stability covers
runtime-owned input-view structure/references, not arbitrary user object mutation. Internal
sharing/reuse is allowed only without changing already-exposed views, with performance choices
validated by benchmarks. Dynamic access after lifecycle closure still follows invalid-ctx rules;
already-obtained ordinary references cannot be revoked. No historical snapshot registry or new
public status required. Exact retention/reclamation, getters and cleanup-view integration remain
implementation design. No runtime or normative edits.

## User accepts cleanup input view versus current private state (2026-09-29)

User agrees: cleanup input metadata comes from the invocation that registered the cleanup;
cleanupView.state.get reads the retiring lifecycle's current shared private state before final
retention/clearing, not a registration-time private-state copy. Input view and algorithm state
are different information, not competing versions of one value. Late-returned cleanup likewise
belongs to its originating invocation. Existing per-run hook replacement remains unchanged.
Live cleanup registrations reference existing invocation input views rather than introducing a
historical snapshot registry; release runtime references after replacement/execution as applicable.
Payload object references are still not deep-copied. Old ctx remains invalid during cleanup;
reads use the restricted cleanup view. No runtime or normative edits.

## User accepts grouped terminal policy defaults; defers complete:any (2026-09-29)

Following discussion of interdependent terminal booleans, user accepts grouped terminal policy
direction with defaults complete:'all', error:'propagate'. Proposed per-kind policies replace
conflicting independent boolean interpretation: complete all/input/ignore and error propagate/input/
ignore. input delegates that terminal kind to fn rather than simultaneously applying automatic
handling; reduce can own COMPLETE while retaining automatic ERROR, rescue can own both. Ignore
still records dependency terminal state and releases DIRTY; it does not erase protocol facts.
Exact first-run admission and option migration require formal reconciliation before implementation.
For suggested early completion, prefer name complete:'any' (any COMPLETE) over propagate to pair
with all. User accepts deferring this new capability until a concrete operator use case; do not
expose a reserved/nonfunctional option now. Any hypothetical any applies only to this node's
COMPLETE output; downstream nodes retain their own policy. Absorbed ERROR is not a COMPLETE event;
all retains existing all-dependencies-terminal meaning including absorbed errors. Auto COMPLETE
does not itself imply cleanup. No code, rule, conformance or formal edits.

## User accepts independent all-completion after error input handling (2026-09-29)

User accepts grouped-policy interaction complete:'all' with error:'input': record terminal and
release dependency DIRTY, offer input processing subject to normal invocation gates, then if the
node remains nonterminal and every dependency is terminal emit COMPLETE. Reversing COMPLETE/ERROR
arrival order must not disable all-terminal completion. Do not await future async output or bypass
PAUSE/readiness; operators owning delayed recovery completion must choose complete:'input' and
manage completion themselves. This intentionally differs from the old blanket terminalAsRealInput
branch suppressing automatic completion. Requires later normative/conformance/runtime reconciliation;
no implementation changes made.

## User accepts per-kind terminal input readiness (2026-09-29)

User agrees: valid DATA satisfies a dependency's initial input condition; no-DATA COMPLETE/ERROR
satisfies that dependency's condition only when the respective complete/error policy is input.
Ignore does not satisfy input readiness by terminal alone; complete:all contributes to automatic
completion without itself being fn input; error:propagate terminates according to policy without
waiting for initial invocation. Input does not satisfy other dependencies' missing initial inputs.
partial:true allows such missing inputs but still respects outstanding DIRTY and other gates.
After first invocation the completeness gate stays open as previously agreed; callback types remain
T | undefined. Preserve distinction among terminal handling policy, initial completeness and dirty
settlement readiness. New per-kind readiness requires later formal/spec/conformance reconciliation;
no runtime or normative edits.

## User accepts invocation-bound directed ctx routing (2026-09-29)

User agrees to cover directed ctx.up and ctx.upNext using invocation-bound stable dependency
connection records, retaining numeric public indices. Each invocation's index resolves to its
connection identity, then current position; retained connections survive reorder, removed
connections invalidate, re-adding the same node creates a distinct connection. Reuse idxBox-like
bookkeeping rather than per-call indexOf lookup, with lifecycle guards and stable invocation
mapping; current idxBoxes only protect input delivery so this is not already implemented for up.
Immediate directed submission to an invalid connection rejects; queued upNext valid at submission
but invalidated before execution is dropped without retargeting. Existing node-local message
handling remains distinct from upstream target resolution; exact preflight ordering needs tests.
O(1) target lookup does not imply O(1) rewire or whole-cone delivery. Broadcast without index remains
open for discussion. Requires later rules/conformance/runtime reconciliation, no edits made.

## User accepts skipping removed broadcast targets versus directed rejection (2026-09-29)

After distinguishing stable invocation input from live connection authority, user explicitly
accepts skipping removed targets during broadcast while continuing surviving targets, and
rejecting an immediate directed operation on an invalid connection. Retained input values do not
retain a hidden control edge; no retargeting to replacement connections. This annotation approves
the quoted invalid-target policy. Invocation-scoped broadcast candidate selection (exclude later
added first-hop connections; subsequent hops follow current topology) was proposed in context,
but not separately confirmed as a full broadcast contract; preserve that distinction when
consolidating. Prior queued directed work invalidated before execution remains dropped under
its already accepted rule. No runtime/normative changes.

## User accepts per-delivery validation during reentrant broadcast (2026-09-29)

User agrees: freeze candidate connection list/order for a broadcast operation, then before each
actual delivery revalidate originating lifecycle and target connection. Removed connections are
skipped; closed originating lifecycle stops remaining delivery. Connections added during broadcast
are not appended to that operation. A synchronous callback can invalidate later targets, so initial
validation alone is insufficient. Already delivered control effects are not rolled back; no automatic
replay/retry, graph-wide locking or transactional-broadcast guarantee. Reuse stable connection and
lifecycle facts. This does not by itself settle every distinction between invocation-time candidate
selection and broadcast-start selection; keep that earlier scope question explicit. No code or
normative edits.

## User accepts ctx versus node routing scope (2026-09-29)

User explicitly accepts full routing entry table: directed ctx.up resolves an invocation-bound
connection, ctx broadcast candidates are invocation-bound, and ctx.upNext keeps the same origin
binding until execution; public node.up resolves directed/broadcast candidates from current
declared topology at call time. Both use fixed operation candidates with per-delivery validation,
no retargeting or adding newly connected candidates mid-operation. Node is a current-node control
surface, ctx represents an invocation; no extra historical/current mode parameter. Node-level
local control and declared topology must work without assuming active subscription idxBoxes,
including PAUSE before first subscription. This resolves earlier broadcast-candidate scope question.
Exact representation and message-local handling preflight remain implementation design. No code
or normative edits.

## User accepts local connection-record implementation direction (2026-09-29)

User agrees to retain declared dependency arrays plus stable active-lifecycle connection records
and per-invocation arrays of references. No global edge registry or public edge IDs. Create/own
records before callback-producing acquisition; retained same-lifecycle connections update position
on reorder, removals invalidate before unsubscribe, re-add creates new record, lifecycle closure
invalidates old records and later activation never revives them. idxBox is an implementation
starting point, not proof all required guards exist. Avoid redundant lifecycle permission flags.
Invocation views retain references, directed lookup O(1), broadcast O(n); no runtime history list
of removed records. Public node.up can use declared topology while inactive; exact reentrant
validation of node-level inactive routing still requires concrete design verification. No runtime
or normative changes.

## Combined routing/lifecycle and terminal interaction investigation (2026-09-29)

User authorizes investigating the first two interaction categories together and surfacing conflicts.
This entry records evidence/proposals only, owned by this existing root walkthrough; no new semantic
approval, normative edits or runtime changes. Baseline TS HEAD dafc5ae57d446a59a7388214c31bd7a6e73d1519.

Confirmed representation gap: the accepted node.up contract applies to inactive declared topology,
but the proposed stable records were active-lifecycle-only. /tmp/graphrefly-cross-boundary-probe.ts
uses real nodes: inactive C declares A,B; C.up(INVALIDATE) reaches active A, whose onInvalidate
synchronously removes B from C then re-adds it; current broadcast still invalidates B. Assertion
passed with trace A invalidated -> B removed and readded -> B invalidated. nodeForwardUp iterates
the old dependency array, without connection revalidation. Node membership alone would also fail
the remove/readd case. Current runtime mismatch is expected; importantly the previously proposed
representation also lacks the facts needed to implement the approved inactive routing semantics.
Recommendation (not approved): declared connection identity survives inactivity; active subscription
resources and invocation lifecycle authority remain separate. Reordering retains identity, removal
invalidates it, re-add creates a new one. ctx still requires its invocation lifecycle to remain valid.
No global edge registry/public edge IDs are needed. Exact representation/performance remains design.

Terminal checks: same probe verifies DATA+COMPLETE delivered to terminalAsRealInput raw fn invokes
once; default PAUSE defers it until RESUME, then invokes once with terminal metadata preserved.
These exercise current legacy options, not the proposed grouped terminal policy API. Focused existing
suites rewire-deferred.test.ts, pull.test.ts, rewire.test.ts: 37 passed, 3 files, no skips. They include
queued topology draining after output terminal; this alone is not a lifecycle closure and does not
contradict closure-cancels-old-work. R-terminal rev1, R-deps-terminal rev1 and R-first-run-gate rev1
have activation metadata; R-rewire-deferred rev1 lacks activated_by and is not promoted to active
contract by these tests. New grouped terminal policy combinations still need formal conformance
reconciliation; no exhaustive coverage or implemented-conformance claim is made. No additional
terminal design contradiction established in this bounded pass.

## Broadcast clarification and checkpoint support boundary accepted (2026-09-29)

User accepts fixed connection candidates: removed/readded B misses the ongoing broadcast;
special needs use a new explicit broadcast or directed send. node-level new sends use current
topology, old ctx remains invocation-bound. User also accepts rejecting currently unsupported
restorable checkpoint states while explicitly requiring broader restoration support over time.
The pause probe /tmp/graphrefly-checkpoint-pause-probe.ts demonstrated identical checkpoints
before/after PAUSE on state(23): runtime knows its lock but capture omits it. Rejection is an
interim support boundary, not a permanent exclusion. No runtime or normative edits.

## Fourth category: performance and storage baseline (2026-09-29)

User requests continuing the fourth category. Read context construction, input projection and
B49 probe in worktree 7a26 at dafc5ae57d446a59a7388214c31bd7a6e73d1519. Existing sync context
is reused; async path snapshots nested wave arrays and latest/terminal. Uniform invocation views
therefore have an allocation concern not quantified by current baseline. Proposed optimization,
not a lock: share a topology-version connection reference array until rewire; preserve per-call
input via explicit ownership/immutable completed arrays, never share arrays still being mutated.
Do not deep-copy payload objects. Lifecycle/connection validation adds constant work per delivery;
whole broadcast remains linear in first-hop candidates, not constant across the cone. Old contexts
can retain input and records; no runtime historical list should be introduced. Needed future
measurements include allocations/GC, retained heap after dropped ctx references, large fan-in,
rewire churn, and reentrant removal correctness, with identical semantic traces across variants.

Ran pnpm run probe:b49:ts (Node v24.18.0) successfully: median ms FIFO 20000 tasks 6.458;
fanout512/waves2000 1053.548; INVALIDATE set-only500.892/set+invalidate573.294;
diamond128/waves2000 293.041; rewire10000 81.603; lifecycle2500 28.341.
All embedded delivery/count assertions passed. These are baseline total scenario times, not new
proposal performance or isolated per-operation latency. Existing retained-cleanup probe checks
invoked cleanup payload byte counts, not heap reclamation. Benchmark launcher populated missing
worktree dependencies; tracked git status remained clean. No runtime changes or new perf threshold.

## User accepts performance validation direction (2026-09-29)

User agrees to preserve stable invocation semantics while comparing straightforward copying and
safe structural sharing by measurement. Topology-reference arrays may be shared while unchanged;
per-call input views must remain stable, payloads are not deep-copied, permission checks remain
per delivery. Runtime adds no historical ctx registry. Benchmark acceptance must include allocation,
GC/retained heap and correctness, not throughput alone; no object pool/cache mechanism or numerical
regression budget is approved. Existing B49 results are current-runtime baseline only. Continue with
concrete API drafts; implementation and formal amendments remain separate.

## User accepts API read-view and cleanup error reporting directions (2026-09-29)

User accepts shared invocation-input read interface for Ctx/CleanupView, existing read helpers
accepting the narrower view, cleanup exposing state.get only with per-cleanup synchronous read
validity, and unchanged plain effect cleanup. Exact names remain drafts. User also accepts
AggregateError-based multiple-cleanup reporting with original causes and attribution, single
failure rethrown unchanged, and step (cleanup operation) rather than ambiguous stage (not node
lifecycle). Proposed CleanupStep cases remain a draft. No runtime/normative edits.

## User accepts preserving normalized protocol error causes (2026-09-29)

User accepts retaining original reason as Error.cause when errorPayload must wrap undefined or
boolean host failures for protocol ERROR. Keep current terminal shorthand/excluded payload domain;
cleanup operation failures remain original unknown values and are not normalized to protocol.
No runtime/normative edits. The current helper drops the original reason on this wrapping path.

## Receiver error ownership agreed; ordinary sink failure probe (2026-09-29)

User accepts that receiver node B's computation failure becomes B's protocol ERROR under its sugar
contract, not upstream A's ERROR via a broad catch. Bare subscriber callbacks have no own output
node; their delivery/reporting policy remains a separate design question. Current real-node probe
/tmp/graphrefly-sink-failure-probe.ts: first sink throws on DATA; second sink records messages;
n.down(DIRTY,DATA23,COMPLETE) throws original error, second sink sees only DIRTY, cache becomes23,
status settled; trailing COMPLETE not processed. Assertions passed in 7a26 worktree. Thus catching
only after a subscriber loop would not suffice: later messages in the same wave also need protection.
Candidate, not approved: isolate ordinary sink callback failures, finish valid remaining deliveries
and wave settlement, report originals/aggregate at owning outer operation boundary, no source ERROR,
implicit retry or auto-unsubscribe. Boundary propagation/reporting and first-subscription handshake
failure need explicit reconciliation; do not claim existing behavior or universal runtime fault recovery.

## User accepts ordinary subscriber failure isolation (2026-09-29)

User agrees to the preceding proposal: ordinary subscriber callback failure does not interrupt
remaining valid subscribers or remaining messages in the same wave. Finish valid delivery and
settlement, then report original/aggregate failures at the owning synchronous operation boundary.
Do not convert the failure into the source node's protocol ERROR, automatically retry, or
unsubscribe the callback. Receiver node computation failures remain receiver-owned protocol
ERROR under their own sugar contract. This is limited to ordinary subscriber callback exceptions,
not a blanket recovery policy for internal runtime faults. First-subscription START/cache delivery
failure and acquisition success semantics remain open for the next review. No implementation or
normative amendment authorized by this agreement.

## First-subscription handshake failure investigation (2026-09-29)

User requests next boundary. Current _subscribeOwned installs sink and records private acquisition
before START/cache delivery; plain public subscribe has no acquisition owner and returns release
only after activation. Probe /tmp/graphrefly-subscribe-handshake-probe.ts tests START and initial
cached DATA callback exceptions on node(initial23). Both subscribe calls throw original failure
without returning unsubscribe; subsequent DATA30 still delivers DIRTY+DATA to the installed sink.
Initial probe expected DATA only; corrected expectation for synthesized DIRTY, both cases passed.

Proposal, not approved: public initial START/cache/replay failure before activation aborts this
subscription acquisition and removes only the registration acquired by that attempt; leave existing
subscriptions/resources untouched, do not rewind already delivered callbacks. Report original and
any cleanup failures under accepted aggregation policy. Existing subscription delivery failures
remain non-auto-unsubscribe. Do not generalize to post-transfer activation failure: graphrefly-ts:D161 private
owned acquisition records release before callbacks and preserves graph-owned faulted instance and
obligations after transfer. Activation-failure/handoff reconciliation remains separate. Duplicate
sink registrations currently Set-backed; no acquisition may remove a preexisting registration it
did not acquire, so eventual implementation must account for that ownership case. No code/rules edits.

## User accepts public initial handshake acquisition abort (2026-09-29)

User accepts prior recommendation for ordinary public subscribe START/cache handshake failure:
abort this attempt's newly acquired registration, do not proceed to activation, preserve preexisting
subscriptions, report original and cleanup failures. Do not undo already delivered callback effects.
Private pre-transferred acquisition remains owner-governed. Activation failure investigated next.

## Activation failure owner boundary investigation (2026-09-29)

Real probe /tmp/graphrefly-activation-failure-probe.ts: raw depless fn registers cleanup then throws;
public subscribe throws original, receives no release handle; cleanup count remains0, later downDATA30
still delivers DIRTY+DATA to the sink. Assertions passed after removing a stale nonexistent diagnostic
method from probe output. graphrefly-ts:D161 and construction-scope start already record release before first
callback and retain post-transfer graph-owned faulted instance/leases; no blanket rollback of that
path. Candidate, not approved: ordinary public subscribe activation failure aborts only its newly
acquired registration and follows normal reference-count close if no owner/subscriber remains;
explicitly owned internal acquisition reports failure to that owner with leases retained. Cleanup
is resource teardown, never cancellation/rollback of external authority obligations. Helpers own
pre-handoff resources and cannot rely on runtime inferring them. Verify shared-owner acquisition
and error reporting before implementation; no new public faulted node status proposed.

## User accepts activation failure ownership split (2026-09-29)

User agrees: ordinary public subscribe throwing during activation aborts only the attempt's newly
acquired registration; if no other subscriber or retaining owner remains, follow normal lifecycle
close/cleanup. Pre-handoff helper resources remain helper responsibility; cleanup never implies
undoing effects or cancelling external authority obligations. Explicit private subscription owner
records release before callbacks and governs retained leases after failure; graphrefly-ts:D161 graph-owned
faulted construction remains intact. No universal node faulted status added. Successful subscribe
return and a node's protocol ERROR are distinct: activation can return normally with terminal
ERROR and still yield an established subscription. No runtime or normative implementation edits.

## Duplicate callback subscription ownership investigation (2026-09-29)

User requests continuation. Current LifecycleState subscribers is Set<Sink>. Real probe
/tmp/graphrefly-duplicate-subscription-probe.ts: subscribe same callback twice -> two STARTs;
DATA23 -> one callback delivery; first unsubscribe removes sole Set entry -> DATA30 reaches neither
subscription. Assertions passed. Thus release closures do not own distinct acquisitions; rollback
of a failed repeated subscribe could delete earlier successful registration. R-push-subscribe rev1
requires per-subscription handshake but does not explicitly decide duplicate-callback identity.
Candidate, not approved: every subscribe call acquires a distinct local registration, delivery once
per surviving registration, unsubscribe idempotently releases only its own registration. Callback
identity is not subscription identity. Initial-failure cleanup then removes only newly acquired
registration; no public subscription ID/global registry introduced. Per-registration storage cost
belongs in the accepted allocation/retention measurements. No runtime/normative edits.

## User selects callback-identity idempotent subscriptions (2026-09-29)

User rejects distinct subscriptions for repeated calls using the same callback object. User then
accepts the clarified idempotent proposal: same node + same callback + existing subscription reuses
that subscription without another START/cache delivery; returned release capabilities alias that
registration. Any alias releases it once. After removal, resubscription creates a fresh registration;
old release cannot remove the new registration. New callback objects request separate subscriptions.
This supersedes the unapproved per-call registration candidate. Initial failure rollback only applies
if the attempt actually acquired a new registration. No runtime/normative edits.

## Unsubscribe during delivery investigation (2026-09-29)

Probe /tmp/graphrefly-unsubscribe-during-delivery-probe.ts: two ordinary callbacks A/B on bare node;
A handles DATA by invoking offB. Current copied subscriber-array loop still delivers that DATA to B;
assertion observed [A,B]. Candidate not approved: each downstream message snapshots registration
candidates, verifies current registration before actual delivery; removed registration skipped,
remove/readd not retargeted. New subscription during delivery receives its own normal START/cache
handshake and participates in subsequent messages; do not freeze downstream subscriber candidates
for the entire multi-message wave, which could deny a newly established subscription the subsequent
COMPLETE. Exclusion from current fanout is distinct from permitted initial cache delivery. Source
lifecycle validity still follows previously approved closure rules. No runtime/normative edits.

## Wave-sized subscription delivery reassessment (2026-09-29)

User questions single-message delivery despite wave-sized ctx.down, then requests impact review of
making subscription minimum unit Wave. This is reassessment, not approval or implementation request.
Current Sink Message+DeliveryMeta and nodeDown iterate messages across copied subscriber sets;
nodeReceiveFromDep uses wave token/last to defer value invocation. User expectation initially referred
to node fn input, whereas ordinary subscribe currently sees per-message callbacks. Synchronous
callbacks can immediately unsubscribe/reenter; wave-sized callback does not prevent A's callback
from removing B before B is delivered, nor prevent nested down calls. Subscription mutation timing
is an independent choice from callback input granularity.

Active R-two-phase rev1 and R-diamond rev1 require graph-wide DIRTY-before-settle and once-at-join;
naive full-wave per-subscriber DFS can settle one branch before another is dirtied. Whole transport
replacement needs explicit phase scheduling, batch/pause slices, terminal/initial handshake handling,
error ownership and source/bridge migration; no async core needed or authorized. External wave
observation with private tier/message processing preserved is a narrower candidate, but simple
buffer-until DeliveryMeta.last is inadequate: batch currently emits early DIRTY with last:false and
later commit reenters down with another delivery token. Need explicit wave/phase completion semantics
rather than guessing, merging multiple ctx.down calls or awaiting future source completion.
Potential cost benefit fewer callback calls; extra aggregation allocation/retention and latency must
be measured under fourth-category policy. Candidate directions remain unapproved; no source edits.

## User accepts wave observation design direction (2026-09-29)

User agrees with recommendation to first design ordinary external subscription callbacks receiving
wave-sized deliveries while retaining internal two-phase tier/message processing. Wave boundaries
and propagation phases must be explicitly reconciled for diamond, batch, pause, initial START/cache/
replay, multiple DATA+terminal, exceptions and reentrancy before deciding transport unification.
This approves a design investigation direction, not a finalized Sink signature, whole-wave mutation
barrier, runtime changes or normative amendment. Wave callbacks may still synchronously reenter;
subscription mutation timing remains separate. Earlier per-message external candidate suggestion
must be revisited under this direction, not silently retained as the final contract.

## User requests historical and current DIRTY/wave ordering review (2026-09-29)

User asks to ground reassessment in implementation/history, considers separate DIRTY handling for
diamond and one tier-ordered wave versus repeating DIRTY before INVALIDATE and terminal; leans
one leading DIRTY. This is investigation, not final wave-observer/delivery design approval.
Relevant rationale root D8 one msgs array=wave; D34 seven-tier ordering; D49 preserves occurrence
and diamond/undirty semantics; D77 preserves per-wave input projections. Active R-two-phase rev1,
R-diamond rev1, R-dirty-before-data rev1 and R-terminal-settles-dirty rev1 govern two-phase ordering
and existing dirty debt release; R-tier text includes D34/D269 but lacks activation metadata.

Current real-runtime probe /tmp/graphrefly-dirty-order-probe.ts wraps internal receive only in the
isolated process for trace. Diamond: B DIRTY -> D DIRTY -> C DIRTY -> D DIRTY -> B DATA -> B fn ->
D DATA -> C DATA -> C fn -> D DATA -> D fn. Assertions: all traced DIRTY before first DATA, D fn
once. A separate node.down(COMPLETE,DIRTY,INVALIDATE,DATA23,DIRTY) yields exactly DIRTY,DATA,
INVALIDATE,COMPLETE. Standalone populated INVALIDATE, COMPLETE,ERROR each yield themselves without
new DIRTY. All assertions passed. Tier sorting coalesces emitted DIRTY; INVALIDATE and terminal
clear any existing dependency debt without new dirty phases. Separate sources sequential outside
batch are separate waves; inside batch all announcements precede deferred settle, so do not apply
source-at-a-time completion blindly. Synchronous callback reentrancy still requires separate policy.

Earlier assistant suggestion to delay external DIRTY until complete output remains unapproved and
must not be treated as established behavior/necessary consequence of wave callbacks. Before such a
split, define unified phase ordering and callback granularity against these concrete traces. No
runtime or normative changes, no public observer-phase split locked.

## User accepts single DIRTY plus tier-ordered suffix clarification (2026-09-29)

User accepts preceding grounded ordering review: one dirty announcement phase, DATA occurrences or
RESOLVED, optional INVALIDATE, optional terminal; no new DIRTY inserted before each later tier.
All affected diamond paths must be marked before settle starts; ordinary source-at-a-time call
completion does not mean per-branch fullwave DFS, and batch still defers multi-source settle.
External delayed DIRTY proposal not approved; observer contract remains under reassessment.

## Candidate delivery-phase granularity clarification (2026-09-29)

Candidate for discussion: distinguish original msgs-array wave from actual phase deliveries.
Immediate DIRTY and one intact ordered settle suffix can be delivered as two arrays associated
internally with the same logical wave; this removes callbacks between DATA occurrences/INVALIDATE/
terminal within that suffix, while keeping two-phase scheduling. It is not a once-per-original-wave
callback guarantee. Same receive-array shape can serve ordinary observers/protocol intake; fn still
passes gates/dispatcher and must not execute merely on DIRTY. Delayed batch/pause results require
explicit association/boundary definition, not legacy last-token guessing. Competes with complete
wave observation plus a private protocol-phase receiver, no choice locked or code amended.

## User favors two-phase array delivery (2026-09-30)

User annotation endorses the proposed direction: immediate DIRTY array propagation followed by
one intact tier-ordered suffix array for DATA occurrences or RESOLVED, optional INVALIDATE and
terminal. Both phase deliveries belong to the same logical wave; one ctx.down may invoke a receiver
twice, not once per original msgs array. Prefer investigating a common array shape for protocol
intake and ordinary subscribers rather than prematurely introducing an observer-specific delayed
DIRTY contract. This is acceptance of design direction, not final API signature, batch/pause
association scheme, mutation/reentrancy policy, implementation authorization or normative amendment.
Remaining verification covers phase scheduling, lifecycle cancellation, initial subscription and
error attribution. No runtime or formal edits.

## Phase-gap membership and rewire probes (2026-09-30)

Continuation of approved two-phase array design investigation, not implementation. Probe
/tmp/graphrefly-phase-subscription-probe.ts on node(initial10): a callback adds a new subscriber
upon DIRTY before DATA23. New sink sees START,DATA10,DATA23 without DIRTY; asserted. Current
cached-first handshake cannot be assumed to establish pending input for a dirty new connection.
Proposed suffix recipient policy remains to approve: current live registrations at settle delivery,
per-registration validation, no old registration retargeting; new joins need correct initial dirty
state before suffix. Whole-wave fixed candidate snapshots would exclude such joins and potentially
miss terminal, so not automatically adopt upstream broadcast scope for downstream subscriptions.

/tmp/graphrefly-rewire-dirty-phase-probe.ts keeps B active before observer, then wires C and join D;
source DIRTY reaches B/D before observer removes B from D, before C gets DIRTY. Current rewire
calls replacement D fn with C's cached0, then later with23 as C settles; observed [0,23]. Rewire
currently creates its own computation wave, so this is a concrete reentrancy interaction needing
policy, not automatically classified as a violated once-per-wave invariant. Candidate: removal
invalidates/releases old edge debt immediately, but affected recomputation must not start until
DIRTY propagation phase completes and ordinary gates pass. Retained reordered connections keep
pending debt; removed/readded edge gets new identity and its own handshake. Lifecycle close cancels
old-lifecycle delivery and waiting facts; never transfer to reactivation. No subscriber API, global
barrier, runtime flags or normative locks introduced by this entry.

## User accepts phase-gap connection and recomputation policy (2026-09-30)

User agrees with preceding table/proposal: settle-phase delivery uses effective live registrations;
removed subscription/edge skipped, removed dependency debt released immediately; retained reordered
edge keeps identity/debt; remove/readd establishes new identity and own initial subscription state;
closing origin lifecycle stops old delivery rather than redirecting to reactivation. New registrations
may participate in settle phase after acquiring correct current dirty readiness. Affected recomputation
caused by removal/rewire during DIRTY propagation waits until that propagation phase completes, then
normal pending/initial/pause/demand gates apply. No indefinite debt from removed edges and no transient
zero-count early computation before remaining dirty announcements. Exact scheduling representation,
new-subscription stale-cache handshake and global/reentrant phase scope require subsequent design;
this does not impose a blanket graph transaction or authorize runtime/formal edits.

## User proposes connection work between dirty and settle phases (2026-09-30)

User asks whether all DIRTY propagation can finish first, then subscription work, then remaining
output delivery. Candidate is a distinct alternative to previously approved immediate edge removal
plus deferred recomputation: requests during dirty phase are queued, actual subscription/rewire
application occurs at an intervening connection boundary. Synchronous scope, no Promise/microtask
required. Connection phase must initialize current dirty readiness for added paths and release
removed debt without firing computations/settle output; cold activation/initial cached pushes can
currently run fn and therefore need scheduling admission under the new design. New connections
into dirty sources need dirty accounting/propagation on newly affected paths before settle; do not
assume one pass over old topology marks future edges. Existing closing/released ctx validity rules
remain stronger than any deferred resource cleanup; don't silently postpone logical revocation.

Current subscribe synchronously START/cache/activates before returning; delaying a subscribe made
inside a dirty callback would permit returning its acquired cancellation capability before handshake,
with delayed callback/setup failures attributed to owning wave operation. Existing internal owner-
before-first-callback rule still required. This timing/error-reporting change must be explicit, not
just a queue implementation detail. Existing rewireNext remains whole-wave-boundary work, not
implicitly moved to inter-phase boundary. No new choice locked, no runtime/normative edits.

## Continuation reconciliation and migration handoff (2026-10-05)

Recorded from the continuing source chat, Codex task `01a0b15b-a223-7873-ba1a-116a84012e6a`.
Classification: non-normative review notes and migration evidence, owned by graphrefly in this
already indexed DS-16 body. User authorized the review notes earlier and on 2026-10-05 selected
moving this walkthrough, its handoff and the relevant branches of the six core repositories.
This is not permission to implement the reviewed changes, activate Rules, mint Decisions, run
providers, merge branches or include unrelated task changes/worktrees/stashes in the migration.
The runtime inspected remains graphrefly-ts `dafc5ae57d446a59a7388214c31bd7a6e73d1519`.

### Rules status and historical corrections

Rules continue to resolve through `spec/rules.jsonl` and `authority/README.md`; discussion approval
does not activate a revision. Current R-wave-boundary@1, R-dirty-before-data@1, R-two-phase@1,
R-push-subscribe@1 and R-first-run-gate@1 must be reconciled together. R-tier and other draft
records lacking activation metadata are not silently published as current by this handoff.
Root history such as graphrefly:D9/D34/D37/D49/D77/D124 supplies rationale, not hidden clauses.
graphrefly-ts:D161 remains the distinct TS owned-construction boundary, not root graphrefly:D161.

The earlier public two-phase-array direction in "User favors two-phase array delivery" was
refined during the continuing chat. Ordinary immediate output now favors one complete observer
array plus an internal DIRTY prepass; publicly visible early DIRTY remains intentional for batch
and genuinely deferred settlement. Do not resume from the old candidate as though it were final.
The proposed inter-phase connection queue was not selected as a general public subscribe queue.

### User-confirmed raw invocation and explicit DIRTY boundary

> Rules candidate, not activated. Reconciliation targets: R-wave-boundary@1, R-dirty-before-data@1, R-first-run-gate@1, R-resolved-undirty@1.
> Accepted review direction; unresolved combinations remain open below.

- Keep explicit DIRTY available to raw-node authors. The user considered ignoring authored DIRTY,
  then accepted retaining it. Do not silently discard it or replace that choice with a blanket ban.
- START and DIRTY do not independently invoke the raw fn. The user explicitly rejected adding
  invocation while pending inputs remain unsettled. Source activation is a lifecycle operation,
  not a raw fn reacting to a received START. DATA/RESOLVED settlement still obeys normal gates.
- INVALIDATE clears the applicable value and uses the agreed invalidation-hook conditions; it
  is not a new general raw-fn trigger. Terminal invocation belongs to the terminal policy.
- Distinguish subscription callbacks from raw node fns and restricted value-level sugar callbacks.
- Separate non-batch down calls are separate waves. An explicit DIRTY call followed by a separate
  DATA(23) call is observed as DIRTY, then the later wave's DIRTY+DATA(23). It is not automatically
  stitched into one wave. Per-dependency dirty accounting is idempotent, not a debt count per DIRTY.
- Keep one notification phase before the value/settle suffix, rather than inserting a new DIRTY
  before every DATA, INVALIDATE and terminal message. Preserve all DATA occurrences.

Tradeoff retained: protocol-aware authors keep explicit notification control; ordinary value output
still receives the required automatic prefix. Pending settlement and callback count remain distinct.

### User-confirmed ordinary, batch and deferred array delivery

> Rules candidate, not activated. Reconciliation targets: R-wave-boundary@1, R-dirty-before-data@1, R-two-phase@1, R-diamond@1.
> Accepted review direction; unresolved combinations remain open below.

For an ordinary synchronous output already available in one down call, perform the internal DIRTY
prepass across all affected paths before settlement, then deliver the complete normalized array to
each eligible ordinary subscription callback. No ordinary observer callback runs inside that private
prepass. A complete wave per branch in a naive depth-first walk remains incorrect for a diamond.
The common array shape does not remove protocol phase scheduling or the raw-fn gates/dispatcher.

An explicit standalone DIRTY call remains its own complete immediate delivery. Separate down calls
remain separate arrays. Do not wait indefinitely for a future DATA to complete a callback array.
Batch retains public early DIRTY notification and a complete settlement array at commit. Queuing or
internal phase work does not make the synchronous core asynchronous or require a global dirty counter.
Exactly which internal scheduler facts are stored remains for the unified design.

For asynchronous work, the pool label alone does not force a callback split. If a dependency change
already announced DIRTY and the result is deferred, that early DIRTY remains visible. A later down
call is its own full wave, including its normal automatic DIRTY prefix, multiple DATA and terminal.
A depless promise source need not announce DIRTY just because activation started. The subscription
initializer sends that registration's START initial array; source setup/result output does not send
the handshake. (Clarified in the 2026-11-03 QA-27 ownership review below.)
An async fn returning without output must not automatically produce RESOLVED while a result is owed.

Tradeoff retained: immediate observers get intact arrays; batch and delayed work keep useful advance
notification. "One original down call", logical dirty debt and actual phase delivery are not synonyms.

### User-confirmed pause buffering, drain ownership and failure behavior

> Rules candidate, not activated. Reconciliation targets: R-terminal@1, R-resolved-undirty@1; draft R-pause-modes@1.
> Accepted review direction; unresolved combinations remain open below.

Default PAUSE prevents new node-fn invocations, including first activation; already started work may
still produce normal output. It does not automatically cancel registered timers or external operations.
resumeAll allows computation but buffers eligible output. These are reviewed directions, not a claim
that every current call entrance implements them. Terminal bypasses buffering and drops held output,
including held DATA in the same terminal-containing call. User accepted that possible data loss.

Buffered outputs retain their individual array boundaries and FIFO order. For example, buffered
[DATA20,DATA21] and [DATA30] resume as two complete normalized arrays, not one merged replay array.
If a callback re-pauses during the first array, finish that array for remaining valid registrations,
then stop before the next array. Removing a registration skips its not-yet-delivered work. Closing
the origin lifecycle stops its runner and discards the old lifecycle's remaining buffered entries.
Reactivation must not inherit them. Old unconsumed entries precede output produced during drain.
Nested RESUME does not start a second drain owner. Recheck eligibility before each next array.

An established observer exception does not abort the remaining eligible fanout or, by itself, stop
later eligible arrays. The observer is not implicitly removed and its failed array is not retried.
The runtime cannot force a throwing callback to finish its own application-level loop. Collect errors
only for the owning synchronous operation, finish applicable work, then report the original error or
an aggregate. A callback's explicit PAUSE or lifecycle close still affects subsequent work normally.
These observer failures do not become the source's protocol ERROR; receiver node-fn failures retain
their own protocol policy. Initialization failure still follows its separate acquisition-abort rule.

Recorded historical probes found current re-pause/new-output ordering [20,21,40,30], old buffered30
leaking into a new lifecycle, and a first observer throw abandoning other fanout/buffer entries.
Those temporary probe sources are no longer available in the current /tmp inventory. Treat them as
recorded bounded observations from the source chat, not portable conformance receipts or new runs.

### User-confirmed callback-origin output FIFO

> Rules candidate, not activated. Reconciliation targets: R-wave-boundary@1, R-two-phase@1, R-terminal@1.
> Accepted review direction; unresolved combinations remain open below.

The recommendation to reject an ordinary observer callback's nested new output was withdrawn after
the user explained that normal callers expect internal queuing. Accepted direction: queue those new
external output requests until the current synchronous flow reaches its applicable safe boundary.
Current-wave dependency propagation continues; illegal synchronous raw-fn feedback cycles remain
rejected. Do not indiscriminately queue all ctx.down calls and thereby evade graphrefly:D37.

Queue acceptance is not execution: nested calls return before the new cache update, computation and
delivery. The outermost synchronous operation drains executable accepted work before returning or
reporting collected failures; no Promise/microtask is added to the protocol core. Within queued work,
preserve FIFO. The observed current nested-source order A=[23,30], B=[30,23], cache=30 motivated this
direction. Queue scope, admission classification and the boundary representation remain to design.

Lifecycle-owned ctx output requests are cancelled when their lifecycle closes. A public state.set
request belongs to stable node/state input, rather than whichever callback happened to submit it:
it can survive ordinary nonterminal last-unsubscribe and update the cache without a live subscriber.
Old pause buffers are lifecycle-owned and are not equivalent to an accepted external state request.

Terminal and queued output retain issue order across waves. DATA30, COMPLETE, DATA40 delivers30 then
terminal and ignores40 if no reset intervenes. When terminal takes effect it seals old pending output;
a later reset must not resurrect that queued40. Genuinely new post-reset DATA50 is eligible normally.
Do not merely check the latest terminal flag at dequeue, because reset could have cleared it.
Terminal's output seal is distinct from actual lifecycle closure. Existing deferred rewireNext is not
automatically cancelled by terminal alone; closure cancels old lifecycle-owned work.

Quiescent release of existing graph-owned ephemeral groups remains quiescent-only (graphrefly:D124).
An active delivery or accepted pending request prevents release; do not silently cancel requests to
force disposal or introduce automatic deferred release. This is not a new public node.dispose API.

Tradeoff retained: callback-origin requests are convenient and consistently ordered, at the cost of
deferred visible cache changes and explicit ownership/barrier checks. A rejected output attempt is
not automatically turned into an asynchronous scheduler or a persistent node fault.

### User-confirmed admission and ownership of wave structure

> Rules candidate, not activated. Reconciliation targets: R-dirty-before-data@1, R-resolved-undirty@1; draft R-data-payload@1.
> Accepted review direction; unresolved combinations remain open below.

Validate message/payload legality, same-wave DATA versus RESOLVED exclusivity and applicable ctx
permission before admitting a request or causing DIRTY side effects. On execution recheck current
lifecycle, terminal-output permission and applicable pause/eligibility conditions. Validation of a
stable admitted protocol structure need not be repeated as though the caller could mutate it.

Retain stable array and message-tuple structure on submission, via shallow structural copy or trusted
owned immutable input. Mutation of the caller's original array/tuple must not rewrite queued DATA23
into DATA30. Payload objects retain ordinary reference semantics by default; no general deep clone
was accepted. Explicit existing value snapshot/versioning policies remain applicable where configured.
Read-only callback typing, runtime ownership and physical freezing are distinct; the exact enforcement
and allocation plan remain for design. Current deferred branches precede the exclusivity check and
need eventual reconciliation; no runtime edit was made in this review.

### User-confirmed initial subscription arrays and stale cache

> Rules candidate, not activated. Reconciliation targets: R-push-subscribe@1, R-first-run-gate@1.
> Accepted review direction; unresolved combinations remain open below.

Construct and deliver a stable initial array to the newly acquired registration before activation.
For a settled ordinary source: START alone if empty, START+cached DATA if populated, or START plus
all configured replay DATA occurrences. Replay values are initial delivery; the current replay ring
does not preserve historical wave boundaries. Quiet pull subscription sends START only, including
when replayBuffer is configured. Initial cache delivery does not announce a fresh source change to
all existing subscribers. Activation's output is a separate delivery from the initial array.

The stale-cache case is now explicitly selected by the user:

```text
A has retained23 and outstanding DIRTY; C newly subscribes to A.
C initial array = [[START], [DATA,23], [DIRTY]]
```

Preserve this order; subscription initialization does not use ordinary down's tier sorting or add
an unnecessary automatic DIRTY. Process the complete array before deciding whether to invoke fn.
DATA seeds23 using normal input handling, then the final DIRTY leaves that dependency pending.
RESOLVED later releases the pending contribution while retaining23; DATA30 later updates/release it.
No raw invocation occurs merely on the final DIRTY. This is the agreed conceptual input-array contract,
not behavior supplied by the current per-message handshake (which prioritizes cache and omits DIRTY).

Withdrawn alternatives: START+DIRTY alone lacks the initial value if the only later settle is RESOLVED;
START+DIRTY+DATA with special non-settling initial DATA was rejected in favor of natural message order.
The assistant also conflated prefix insertion with sorting; user corrected that adding a prefix while
preserving order could yield START+DIRTY+DATA23+DIRTY. Prefix insertion alone would not erase the final
dirty state; the actual current tier sort would move that final DIRTY ahead of DATA. Do not repeat
the mistaken explanation or reintroduce special initial DATA semantics as an approved alternative.

### User-confirmed initial callback work versus activation

> Rules candidate, not activated. Reconciliation targets: R-push-subscribe@1, R-first-run-gate@1, R-terminal@1.
> Accepted review direction; unresolved combinations remain open below.

After complete initial delivery, recheck surviving registration/lifecycle and ordinary invocation
gates. Complete allowed activation before draining the callback-origin external output FIFO.
Example: cold source fn emits10; START callback queues DATA30. Chosen visible value order is10,30,
not30,10. The explicit accepted cost: a COMPLETE queued by START's callback may execute only after
first fn has started. A queued request is not already-effective terminal state. Descendant work of
the current activation flow is distinct from the new external wave queue.

Nested subscriptions with a different callback establish their own registration/initial array but
must not steal activation while the surrounding initialization callback is still running. Activation
is lifecycle-owned pending work, attempted once at a safe initialization boundary. User accepted
this requirement and explicitly preferred avoiding a special activation-owner object/transfer system.
Reuse the unified boundary/lifecycle design if possible; no new public activating status was accepted.
Do not simply set current activated=true early and pretend upstream subscriptions already exist.

If one initializer fails, abort only its newly acquired registration under the established rules.
Other successfully acquired subscribers still retain normal activation demand after applicable
failure/close bookkeeping. The precise combined failure-reporting and pending-work scheduling must
be covered in unified design; no extra public failure state or blanket transaction was selected.

### User-confirmed duplicate callback during initialization and immediate unsubscribe

> Rules candidate, not activated. Reconciliation targets: R-push-subscribe@1; registration identity refinement.
> Accepted review direction; unresolved combinations remain open below.

The earlier callback-identity rule applies as soon as registration is installed, before START/cache
callback. Reentrant subscribe with the same node+callback reuses that registration, returns its release
alias and delivers no second START/cache array. It does not create another activation obligation.

If the callback immediately uses that alias to remove the only registration, old-lifecycle pending
activation is cancelled. Outer initialization returns without invoking fn. Its eventual returned off
capability is already inactive/idempotent and cannot remove a later fresh registration. Expected trace:
one START, zero fn calls. User agreed to this combined behavior on 2026-10-05. No new subscription mode,
public status or special initializer-disposal scheduler was selected.

### Portable bounded implementation evidence

Two surviving temporary diagnostic probes have been copied into `protocol-reconciliation-probes/`.
They assert the CURRENT TS baseline behavior that motivated the review; they deliberately do not
assert the approved future behavior and must not be mistaken for conformance tests.

From the sibling graphrefly-ts checkout after installing its declared dependencies:

```sh
node_modules/.bin/tsx ../graphrefly/sessions/active/protocol-reconciliation-probes/nested-initial-subscription.ts
node_modules/.bin/tsx ../graphrefly/sessions/active/protocol-reconciliation-probes/initial-duplicate-off.ts
```

Both probes import source from the working directory, so sibling paths are portable across hosts.
At TS dafc5ae57d446a59a7388214c31bd7a6e73d1519 the recorded bounded observations were:

- nested-initial-subscription: fn1; fn runs before A's START callback exits; A gets DATA twice.
  Events: A:START, A:initial-enter, B:START, fn, A:DATA, B:DATA, A:initial-exit, A:DATA.
- initial-duplicate-off: fn2, START twice, final fn after alias unsubscribe removed the only sink.
  Events: START, START, fn, DATA, alias:off, fn.

Original tool runs passed their baseline assertions. Repeat runs of the portable copies and document/
authority gates belong to the migration completion report; do not infer their results from this text.
Earlier /tmp probes named above and in older sections are historical tool evidence and may be missing.
They require reconstruction/re-execution for future verification, not a claim of complete test coverage.

### Remaining bounded walkthrough scope and next cursor

Five original themes: values/occurrences; propagation/demand; pause/async; lifecycle/resources;
public programming model. DS-16 already spans later themes through their concrete intersections.
Do not reopen all of them merely because the original title names only propagation and demand.

Remaining review, not implementation authorization:

1. Finish cross-case checks for initialization/activation failure with surviving subscriptions,
   multi-dependency wiring/readiness and the chosen callback queue boundaries. Preserve first-run-only
   partial gates and never reinterpret partial:true as running while another input remains DIRTY.
2. Consolidate runtime fact ownership, lifecycle/input/output permission checks and safe-boundary
   scheduling into one restrained design. Keep cache/output/lifecycle public status derived on read,
   pause from its lock set, stable per-invocation input views, lifecycle-isolated ctx, cleanup finalization,
   current-only error reporting and connection identities. Concrete structs/flags/queue ownership and
   allocation/performance qualification remain open; earlier table grouping is conceptual, not code.
3. Verify the public API/operator policy matrix and relevant historical refinements: raw versus
   value sugar, per-occurrence transforms, filters/dedup, accumulators, multi-input operators and
   delegated terminal/recovery. Retain approved T|undefined sugar inputs, grouped terminal policy,
   private-state persistence capability and open API expression cleanup. DS-15's historical G9
   provenance/formal/scenario follow-ups remain open where not explicitly resolved here.
4. After walkthrough closure, prepare the unified Rules reconciliation for correctness, concision,
   completeness and activation/transition gaps. Link maintainer rationale to its unique owner, then
   use the separately authorized spec-first formal/conformance/runtime workflow. Conversation choices
   must not substitute for current Rules or evidence-bound completion. No feature implementation starts
   merely because the review reaches a recommended design or a migration branch is pushed.

Do not expand this closure into newly speculative capabilities. Already deferred: cross-request PULL
idempotency/ACK/cause fields (user land), run-while-other-dependency-dirty mode, downstream-requested
upstream restart, multi-node recovery wrapper, complete:any, persistent cleanup-failure restart blockade,
default deep cloning, and unsupported checkpoint state restoration. Checkpoints fail explicitly for
known unsupported active state today; future coverage may grow through its own approved design.

Immediate next stop after the migration/status discussion: the already accepted initializer-abort
contract composed with a surviving independently acquired subscription and pending activation. Use
one concrete trace; report a real contradiction if found, otherwise identify it as existing-rule
composition. Do not create an additional ownership mechanism merely to make another edge-case table.

### Cross-computer continuation entry

The user selected only this walkthrough and relevant branches of six core repositories. Preserve
unrelated working-tree edits, old worktrees, stash contents and other GraphReFly repositories locally.
Git does not transmit this chat, /tmp, ignored dependencies, credentials or personal ~/.codex skills.
This session is the portable review cursor; it records semantic outcomes and tradeoffs, not a verbatim
transcript. Refer to original chat when wording/provenance beyond the written record is needed.

Publish coordinated branches named `codex/protocol-walkthrough-handoff-2026-10-05` in graphrefly,
graphrefly-ts, graphrefly-rs, graphrefly-py, graphrefly-canvas and graphrefly-stack. Branch manifest and
execution receipts belong to this existing review surface. Root/TS documentation/workflow pointers
needed by this review can be captured without taking unrelated campaign/runtime changes. Rust/Python/
Canvas/Stack snapshot branches reference their selected existing commits without invented changes.
No default-branch merge, force push, PR creation, release or automatic remote execution is requested.

On the remote computer, clone/fetch those six branches into sibling directories with exactly those
repository names. Start in graphrefly, read AGENTS.md, the maintained decision-guard/design-review
skills, DS-15 and this DS-16 continuation. Install declared TS dependencies before probes; personal
workflow skills referenced by AGENTS.md must also be available on that host separately. Resume the
next cursor above in Chinese, one concrete issue at a time, honoring approved choices and deferrals.
GitHub branch-tip verification and exact commands/commit coordinates will be added after execution.

### Prepared migration coordinates and local verification (2026-10-05)

The user selected the narrow migration scope above through the task's text clarification. Publication
is authorized for the same named handoff branch in all six core repos. Unrelated local changes and
stashes are excluded. Root and TS commits are prepared in separate isolated worktrees so their primary
checkout indexes/branches are preserved. Branches are snapshots for continuation, not default-branch
merges or declarations that the reviewed protocol has been implemented.

| Repository | Selected coordinate |
| --- | --- |
| graphrefly | Handoff branch containing this document; base `96f5c902ba9358b9b0c9b63f4231471eeb9dd452` |
| graphrefly-ts | `88af2f96e58ef287c6a10b48fd51d250ff6849e5` (workflow docs only; runtime baseline remains dafc5ae5) |
| graphrefly-rs | `b2bd4968fa301cb40a7826a97bb20d25e50384cb` |
| graphrefly-py | `0d96c4692adadc47f3c40397e32ef81f9abb1d4f` |
| graphrefly-canvas | `8a834b7141c835b93d047a4cb04ba6a92186ee7e` |
| graphrefly-stack | `ca76bf654f2284024bfdbe651de1326ef9c42d36` (selected existing backend-continuation history) |

All six publish to `codex/protocol-walkthrough-handoff-2026-10-05`. Remote branch-tip equality is the
publication completion criterion; the source chat reports the actual final root commit and verification.
The root document cannot embed the hash of its own containing commit; obtain it from `git rev-parse HEAD`
and the immutable source-chat GitHub link. The table's other five selected commits are exact pins.

Executed local checks on the prepared handoff on 2026-10-05:

- Both portable diagnostic probe copies passed against the unchanged TS source baseline and printed
  the bounded observations listed above. They demonstrate current deviations, not fixes.
- `node dashboard/build.mjs --check`: exit0. It still reports the existing D792 session-orphan warning
  and non-workspace unavailable-artifact warnings. No new unresolved references were introduced.
- `npm run authority:check:workspace`: exit0, all required/available owner ledgers resolved; unresolved
  references and revision/supersession cycles0. Historical metrics remain: 441 unclassified decisions,
  44 draft protocol rules, two active uncovered rules, three formal-coverage-pending entries, and the
  Canvas legacy append-only revision-coordinate warning. These are not closed by this migration.
- Copied root/TS skill relative links resolve. No protocol/rule/decision/formal/runtime source is
  amended by the prepared commits. No broad runtime qualification is claimed for a docs handoff.

Fresh remote checkout example (run only where these sibling directories do not already exist):

```sh
mkdir -p "$HOME/src"
cd "$HOME/src"
handoff_branch=codex/protocol-walkthrough-handoff-2026-10-05
for handoff_repo in graphrefly graphrefly-ts graphrefly-rs graphrefly-py graphrefly-canvas graphrefly-stack; do
  git clone --branch "$handoff_branch" "git@github.com:graphrefly/$handoff_repo.git" "$handoff_repo"
done
```

For an existing clean clone, fetch the same branch from origin and switch to its tracking branch;
do not force/reset an unrelated working tree. Verify the selected package pins above. Then read root
AGENTS.md, DS-15 and this continuation, and resume the bounded next cursor. The runtime proposals remain
review-only, despite the Git branches containing their discussion. Install dependencies/personal skills
on that host as needed; the remote computer itself has not been contacted by this local handoff.

### Publication verification receipt (2026-10-05)

The six authorized non-force branch pushes completed successfully. Fresh `git ls-remote --heads`
queries verified exact equality for all six selected branch tips: root review payload commit
`5d2c521637482f1cc288d7f4f17ceb35b0cfb937`, and the other five exact commits in the table above.
All six remote main branch tips remained equal to their pre-publication values. This receipt is
recorded in a subsequent root docs commit, so the final root handoff tip includes this receipt as a
normal fast-forward descendant of the verified review payload; it is not a self-referential hash.
The final source-task verification records that descendant tip after its push.

Only review notes, their existing session index, bounded diagnostic probes and related root/TS
workflow pointers were newly committed. No new Rules, D#, formal/conformance or package runtime
behavior was admitted. Other worktree edits/stashes and unrelated uncommitted tasks were not pushed.
The remote computer must still clone/fetch the named branches and prepare its local dependencies.

### Continuation: failed initializer with a surviving nested subscriber (2026-10-05)

Rules review: activated R-push-subscribe rev1 establishes START/cache handshake and R-first-run-gate
rev1 governs first invocation, but neither specifies this failed-initializer/surviving-registration
composition. The previously approved acquisition-abort and lifecycle-owned pending-activation review
contracts above are still proposals for normative reconciliation, not silently activated Rules.

Concrete trace: cold depless N; A's START initializer successfully subscribes distinct callback B,
then throws. B's acquisition has returned its release capability. Under the already accepted review
contracts, B must not steal activation inside A's initializer; failure removes only A's newly acquired
registration; B keeps the lifecycle and its activation demand. No owner transfer object, public
faulted/activating status, protocol ERROR, automatic retry, or rollback of B is justified here.

Proposed reporting order, pending explicit user acceptance: finish A's failed-acquisition bookkeeping;
recheck the surviving lifecycle, subscribers and invocation gates; attempt the one owed activation
for B if eligible; finish applicable safe-boundary work; report A's original failure to the outer
subscribe caller. In the simple successful activation trace, fn emits10 to B before the caller catches
A's error. A receives no DATA. If ordinary pause blocks invocation, B's activation remains owed rather
than being forced; if B has gone away, no retaining owner means normal close and no activation.
Additional activation/cleanup failures use the previously accepted current-operation failure policy;
this trace does not independently settle every combined-error case or authorize implementation.

Work/evidence: inspected TS _subscribeOwned in packages/ts/src/node/node.ts:421-465 and nodeActivate
in node-lifecycle-runtime.ts:7-20 at unchanged baseline dafc5ae5. Ran a bounded tsx -e diagnostic in
/Users/davidchenallio/.codex/worktrees/7a26/graphrefly-ts (no source edits). Asserted original thrown
error identity, fn before A:throw, and two DATA deliveries each to A/B (activation10 and later30).
Exit0; actual events:
A:START, B:START, fn, A:DATA, B:DATA, A:throw, caller:catch,
A:DIRTY, B:DIRTY, A:DATA, B:DATA.
This confirms early nested activation and leaked failed registration in this baseline. The probe is
an inline diagnostic, not a saved conformance test or evidence of the proposed trace working.
Remaining verification belongs to the unified implementation design: surviving B, B removed before
boundary, pause-gated pending activation, and combined activation/cleanup errors. No runtime,
normative records, formal model, conformance scenarios, D# or remote refs changed by this review.

### User accepts surviving-subscriber activation before reporting failed initializer (2026-10-05)

User agrees to the preceding simple-trace order: abort only A's newly acquired registration;
complete eligible lifecycle-owned activation for surviving B; finish applicable boundary work;
then report A's initialization failure to the outer caller. B may receive activation output before
that caller catches A's error. Pause keeps activation pending; no surviving owner cancels it through
normal close. Approval concerns review semantics only, not implementation or normative admission.

Next combined-case investigation: distinguish a fn failure handled by its wrapper as protocol ERROR
from an activation exception escaping that wrapper. TS graph.derived catches fn throws and emits
ERROR (graph.ts:438-451); dispatcher.invoke propagates unhandled invocation errors
(dispatcher/index.ts:159-170); nodeRunWave restores insideRunWave in finally without a generic ERROR
conversion (node-input-runtime.ts:280-307). These inspected paths are evidence of error routing,
not verification of the proposed delayed-activation implementation.

Proposed composition for review: if B's activation returns normally after a wrapper emits ERROR,
B receives that terminal wave; outer subscribe(A) still reports A's original initialization error
alone, unless separate delivery/operation failures occurred. A protocol ERROR is not automatically
a second thrown operation failure. If activation instead throws outward, retain both A's initializer
cause and the activation cause in the accepted temporary AggregateError reporting scheme with step
attribution. B has already successfully acquired its subscription/release capability; do not roll it
back as though A owned it, nor silently retry the failed activation. Output terminal/lifecycle and
later cleanup continue under their independent existing rules. B retention does not promise successful
computation or completed dependency wiring. Partial wiring failure/re-entry invariants remain a
separate required next cross-check, not a new faulted status chosen by this paragraph.
No new semantic acceptance for this combined case is inferred yet; no runtime/Rules/formal/scenario
or D# edits, and no GitHub push, accompany this local review-note update.

### User accepts combined initializer/activation failure routing (2026-10-08)

User agrees with the preceding discussion: protocol ERROR handled within a wrapper is distinct from
an outward activation exception. In the first case, report the original initializer failure to the
outer caller without automatically duplicating the protocol error as another operation exception.
In the second, aggregate the actual outward failures with original causes and operation attribution.
Retain independently successful B subscription/release rights; do not silently retry activation.
This is review acceptance only; normative/runtime admission remains separate.

### Multi-dependency activation interrupted by a thrown dependency startup (2026-10-08)

Rules: activated R-push-subscribe rev1, R-first-run-gate rev1 and R-cleanup-hooks rev1 cover handshake,
first-value/partial gates and live cleanup, but do not explicitly settle this incomplete wiring
composition. R-rom-ram rev1 lacks activated_by and is not promoted to current contract here.
The already approved review separates lifetime validity, complete connection establishment, first-value
availability and pending DIRTY settlement; this investigation exposes their concrete interaction.

Evidence/rationale: graphrefly-ts:D161, in its unique package owner ledger and
 docs/design/causal-construction-v1.md, requires acquisition recording before callback execution and
retained post-transfer leases/obligations for its private graph-owned composition. That specialized
startup=faulted result is not a new universal Node status or permission to redefine ordinary public
subscribe. Current nodeActivate sets activated=true before iterating deps. nodeSubscribeDepAt records
release before dependency START/output/fn execution; a dependency fn throwing outward stops iteration.
nodeMaybeRun defers during rewire but has no equivalent initial-wiring eligibility gate.

Bounded tsx -e probe at unchanged TS baseline dafc5ae5: N declares P,Q,R. P's depless fn emits1 and
registers cleanup; Q registers cleanup then throws the exact fault; R would emit3. Use existing private
owned-acquisition record hook to obtain the N subscription release before callbacks (deliberately a
private-owner trace, not proof the delayed public B activation proposal is implemented). For both
partial values, P/Q/R subscriber counts after throw are [1,1,0], N activated=true, and the owned release
removes all acquired dep subscriptions with P/Q cleanup once each. partial:false N fn0;
partial:true N fn1, before Q startup failure. Both corrected baseline assertions pass (exit0).
The first diagnostic run used a nonexistent isNodeActivated export and failed as a probe setup error;
corrected to existing isNodeActiveForRelease before drawing conclusions. No persisted test was added.

Proposed clarification, not yet approved: initial activation must establish all declared dependency
subscriptions successfully before allowing the node's pending fn invocation. partial:true permits
missing DATA on established dependencies, not incomplete/failed connection setup. This introduces no
new public partial variant, faulted status, retry API or separate resource registry. If wiring throws
with a surviving subscriber/retaining owner, retain acquired release obligations under that owner,
report the failure, block fn on incomplete wiring and do not automatically retry. If no owner remains,
use normal lifecycle closure and cleanup. Later normal close and eligible fresh activation remain
possible; failure does not create a permanent restart blockade. A dependency protocol ERROR handled
normally is not automatically a structural wiring failure; it follows terminal policy. Existing
external obligations and already delivered output cannot be rolled back by resource cleanup.

Work still required if accepted: pin wiring-complete readiness/permission facts in the unified minimal
state design; reconcile public acquisition with retained private graphrefly-ts:D161 startup; define initial pending
input/occurrence handling at this boundary; cover successful multi-dep activation, partial:true with a
connected never-valued dependency, outward setup failure, cleanup errors, and later normal close.
This paragraph is a proposal and bounded evidence, not amended Rules, conformance, formal model or
runtime. Notes are local only; no additional GitHub push has occurred in this continuation.

### Clarification: subscription release versus an up-going protocol message (2026-10-10)

User asks whether downstream unsubscription propagation exists in the wave protocol and how Callbag/
RxJS compare. This is a clarification, not acceptance of the pending multi-dep readiness proposal.
Verified baseline: Node._subscribeOwned release removes its exact sink and deactivates on zero sinks
(node.ts:440-443); nodeDeactivate invokes stored dependency release callbacks
(node-lifecycle-runtime.ts:76-80). Thus the runtime already cascades release of owned subscription
resources. It does not do so by ctx.up or by fabricating COMPLETE/ERROR/TEARDOWN or an UNSUBSCRIBE wave.
Releasing live dependency subscriptions leaves the declared dependency topology intact, allowing later
eligible activation; removing a declared dependency is the separate rewire concern. The lifecycle's
owned acquisition/release chain is distinct from protocol-message routing. Current activated handshake/
cleanup rules do not fully spell out the entire reference-count release contract; final Rules must
make this lifecycle behavior understandable without reconstructing the code.

Primary comparison sources checked 2026-10-10: Callbag specification
https://github.com/callbag/callbag#specification allows the sink to terminate its source after handshake
using type2, typically through its talkback. Therefore cancellation is part of Callbag's bidirectional
wire contract. RxJS Subscription guide (official repo guide/subscription.md) describes unsubscribe
and attached child subscription teardown; 7.x share.ts defaults resetOnRefCountZero=true and tears
its source connection down when last subscriber unsubscribes while the stream is open. Shared source
lifetime depends on sharing configuration; do not generalize every sink cancellation to destroying
all upstream users. GraphReFly's checked release path is method/closure-driven ownership cleanup,
closer in mechanism to RxJS subscription teardown than Callbag type2. External cancellation still
requires the source/helper's actual cleanup, not a blanket guarantee that outside work stops.
No rule, runtime, decision-ledger or remote-ref edit accompanies this clarification.

### User accepts separately recording protocol routing and subscription lifetime (2026-10-10)

User understands and agrees that message propagation and subscription/lifecycle resource release must
be documented distinctly, and requests continuation of the wiring-failure review. This approval does
not silently approve the still-proposed incomplete-wiring readiness/retention policy from 2026-10-08.

### Acquired dependency lease is not successful initialization (2026-10-10)

Follow-up evidence narrows the proposed eligibility fact. N has only P,Q, partial:true. P emits1;
Q registers cleanup then throws outward. Use the existing private owned acquisition seam to retain
N's subscription release before activation, as in the earlier bounded diagnostic. All declared
upstream lease slots can be acquired even though the last dependency initialization failed.
Therefore neither a full release-callback collection nor activated=true proves wiring succeeded.

Unchanged TS dafc5ae5 bounded tsx -e diagnostic: after exact Q throw, P/Q subscriber counts [1,1];
N fn had run once. P subsequently emits2 and N fn runs again even though Q startup failed. Then
owned off releases both leases and Q cleanup runs. Assertions passed, exit0. Exact event trace:
B:START, N:fn, Q:start, caller:catch, B:DIRTY, N:fn, B:RESOLVED, B:off, Q:cleanup.
This diagnostic deliberately exercises the current private retained-owner path; it does not claim
public delayed B subscription or the proposed failure gate is implemented.

Proposed wording remains pending: a node's own initial dependency setup must finish successfully
before its pending fn invocation becomes eligible. Resource acquisition establishes release ownership;
successful setup establishes invocation eligibility. partial:true waives first-value completeness,
not dependency setup success. A normally returned dependency subscription with no DATA is compatible
with partial:true; a normally handled dependency protocol ERROR follows terminal policy; an outward
initialization exception does not establish successful setup merely because a release was recorded.
On the proposed retained-owner failure path, later upstream DATA alone must not bypass this gate.
Use minimal lifecycle-owned setup-completion facts in unified design; no per-dep public status,
new faulted enum, separate owner registry or automatic retry is admitted here. Initial accumulated
occurrence preservation, previously announced DIRTY obligations and repair/close interactions still
require their bounded review rather than silently assuming all failure semantics are settled.
No runtime, normative Rules, conformance/formal or owner-ledger change; local notes only.

### User accepts setup success as a separate invocation gate (2026-10-10)

> Scope reopened on 2026-10-14: user clarifies partial:true was intended to permit fn before later
> dependency subscriptions exist. Consumer evidence below confirms observable early-wiring semantics.
> Do not implement this as a universal partial:true setup-success gate pending reconciliation.
> Resource acquisition/release ownership and the later failed-attempt gate remain separate concerns.

User agrees: initial dependency subscription setup must finish successfully before N checks partial,
DIRTY settlement, pause and other fn eligibility gates. Record resource release responsibility at
acquisition, not after successful initialization; acquired releases/activated=true alone do not prove
setup success. This records review semantics only, not normative/implementation authorization.
The earlier detailed retain-until-close policy remains distinguishable from this gate: no separate
approval is inferred for every proposed failure-state retention/storage/recovery consequence.

### Successful setup and retained initial input occurrences (2026-10-10)

Existing approved retention contract (2026-09-27 above) composes with the new setup-success gate:
pending legitimate input occurrences must preserve equal DATA and per-dependency wave boundaries;
setup waiting is not an implicit latest-only coalescing policy. Once eligible, raw fn can consume
accumulated projections in one invocation; value-level derived/effect consume latest values under
their intentional policy, not automatically once per retained occurrence. Consumed input waves must
not be replayed as new occurrences on the next invocation. No Cartesian/pairwise multi-input policy
or automatic equality suppression is introduced.

Bounded current-baseline check: P's activation emits wave DATA23,DATA23,DATA30, then separate wave
DATA40. Q activates normally without DATA. N partial:false holds first invocation, then external
Q DATA5 allows it to run once. Copied ctx.waveData immediately inside fn (baseline sync ctx isn't
claimed to have the future immutable-input design): first input [[[23,23,30],[40]],[[5]]]; next Q DATA6
input [[],[[6]]]. Assertions passed, exit0, using tsx -e in unchanged TS dafc5ae5. This verifies existing
first-value-gate retention/consumption, not the new setup-completion implementation or every partial
initial wiring case. R-ctx-wave-data rev1 remains unactivated; D77/D78 explain the retained projection
shape but do not silently activate it. Runtime receipt is bounded baseline evidence only.

Next real interaction still open: after setup fails outward with a retained subscriber/owner, upstream
leases may continue delivering DATA although this activation cannot compute and no automatic retry is
permitted. Define pending-input storage/acceptance and outstanding downstream DIRTY obligations without
inventing protocol ERROR, silently coalescing normal pending input, or retaining history forever.
This failure interaction is not solved merely by proving successful first-gate accumulation above.
No normative/rule/runtime changes or remote push by this local note update.

### Failure-state DATA storage recommendation (2026-10-11; pending user acceptance)

User accepts preceding successful-setup occurrence retention explanation and requests a recommendation
for P's continued DATA after Q's outward setup failure. Normal setup/first-value waiting remains a
live computation that retains complete occurrences. A failed setup attempt, with no accepted in-place
recovery/automatic retry policy, must not be treated as that normal waiting case merely because a
subscriber or resource owner remains.

Proposed bounded default: retire this attempt as a computation consumer; stop admitting subsequent
DATA into N's pending fn inputs, do not update N's computation input cache to make this look like a
latest-only buffer, do not invoke fn, and discard the failed attempt's unconsumed DATA projections.
Keep the facts/capabilities still required for resource release, connection/lifetime validation and
outstanding protocol obligations; dropping DATA storage is not permission to erase DIRTY bookkeeping.
Do not propagate new fn-driven DIRTY solely for input that this failed consumer will discard. Control,
terminal and mixed-message waves require their existing typed policies, not a blanket ignore-all rule.
Already announced downstream DIRTY still requires a separately explicit settlement review; do not
manufacture DATA, ERROR or an unjustified RESOLVED merely to implement this storage recommendation.

This is local to N's failed computation attempt. It neither stops P's other subscribers nor erases
P's cache, durable business fact ledger or already admitted obligations. Acquired release callbacks
remain owned and usable until the accepted owner/lifecycle policy releases them. An eligible future
fresh activation gets its own input history and current subscription initialization; it does not
implicitly replay failed-attempt occurrences or revive that failed attempt. Consumers needing durable
recovery across failed startup must explicitly retain/replay facts at an appropriate source/helper
boundary. graphrefly-ts:D161's retained graph-owned startup obligations and healthy connected branches are not
blanket-disabled by this node-local recommendation.

Tradeoff: failed-attempt inputs cannot be silently recovered in place; benefit: no unbounded queue
for an invocation that cannot happen, no hidden latest-only coalescing, no automatic startup retries.
Implementation must distinguish pending normal setup from ended unsuccessful setup using minimal
owner facts. This distinction and its effects are a proposal, not an added public faulted enum or
settled universal repair/rewire policy. Next concrete question is previously emitted DIRTY at this
failure boundary. No new runtime tests/fixes, normative admission, owner-ledger edits or push here;
current input/runtime code inspection confirms unconditional DATA accumulation in the baseline.

### User accepts no ongoing DATA accumulation after failed setup (2026-10-12)

User agrees to the preceding recommendation: failed setup attempt no longer admits/accumulates future
DATA for fn, does not coalesce it into a latest-only buffer or automatically revive on DATA, and
releases its unconsumed DATA storage. Preserve resource release responsibility and outstanding protocol
obligations. This is local to N's failed attempt, not P's cache, other consumers or business ledger.
Future eligible fresh activation does not implicitly replay failed-attempt events. Review agreement
only; no implementation or normative admission is authorized.

### Proposed balance of a previously announced DIRTY after setup abandonment (2026-10-12)

Current activated R-resolved-undirty rev1 (D49) defines no-occurrence undirty, including batch rollback;
R-dirty-before-data rev1 governs tier3 delivery, and R-invalidate-idempotent rev1 prevents nonexistent
value invalidation from fabricating a change. No explicit current rule names failed setup abandonment.
Thus the following is a proposed extension/clarification, not code-derived normative status.

Recommendation: if the still-valid node lifetime has announced DIRTY and this attempt is conclusively
abandoned with no N DATA produced for the owed settlement, finish that outstanding dirty obligation
with exactly one runtime-owned RESOLVED. If it announced no DIRTY, emit no balancing output. Keep N's
output value unchanged (empty remains empty); RESOLVED promises no new value occurrence/clears pending,
not successful setup, external work cancellation, recovery or proof of computation correctness. Do
not create protocol ERROR/COMPLETE merely from the outward setup exception. Report the actual operation
failure under already accepted ownership/aggregation after applicable boundary work.

Do not insert RESOLVED into a wave that already contains DATA, or duplicate settlement already provided
by terminal/INVALIDATE. Output settlement ownership must remain live and honor batch/resumeAll timing;
this is not a stale ctx regaining permission or an immediate bypass of output buffering. Suppressed
future input from the failed consumer must not generate new downstream DIRTY. Dirty accounting still
needed for other live work is not blanket-cleared. Mixed-wave and retained-owner combined cases require
formal/scenario coverage when the future amendment is authorized.

Downstream cost made explicit: RESOLVED is protocol input, so raw fn and value sugar may invoke under
their normal gates; it is not guaranteed to skip all downstream fn. Per-occurrence operators may skip
by their own policy. If N has never delivered DATA, RESOLVED clears pending but does not supply a first
value; partial:false may still wait normally. No new equality check or failure message is introduced.

Bounded baseline mechanism diagnostic in unchanged TS dafc5ae5: P held by independent keeper announces
DIRTY, then N acquires P and Q via existing private retained subscription owner; Q startup throws.
Observed N sink START,DIRTY; attach raw M(partial:true) to N, which remains pending. Explicit diagnostic
N.down(RESOLVED) yields START,DIRTY,RESOLVED at sink, N fn0, N cache still undefined/empty, and M invokes
once with waveData [[[]]]. Assertions passed, exit0. The manual diagnostic validates existing RESOLVED
release/cache/downstream invocation behavior; it does not claim automatic failure balancing or the new
setup gate/drop-input policy is implemented. No persisted test/source/model/Rules/decision-ledger edit
or GitHub push. This paragraph is pending user approval, not a completed repair.

### User accepts runtime-owned undirty settlement after abandoned setup (2026-10-12)

User agrees with the preceding recommendation: balance an outstanding N DIRTY with exactly one
RESOLVED when this live attempt is abandoned without N DATA or another existing settlement. No
announcement means no manufactured settlement; preserve cache/absence; follow batch/resumeAll timing;
do not claim setup success or guaranteed downstream fn suppression. DATA/RESOLVED exclusivity and
existing INVALIDATE/terminal settlement guards still apply. This is review semantics only.

### Terminal output before an outward startup exception: bounded composition (2026-10-12)

Under the default propagated dependency ERROR policy, Q may emit a legitimate protocol ERROR and
then throw a separate outward initialization exception. N output terminal takes precedence over
failure RESOLVED balancing: N ERROR already settles its downstream pending; do not append RESOLVED
or reopen N output. The actual outward exception must still reach the operation caller (aggregated
with independent initializer/cleanup faults when applicable), without automatically counting the
protocol error payload as a second thrown cause. Already delivered protocol output is not rolled back.
N output terminal does not by itself close its lifetime or release retained leases; release responsibility
remains with its subscriber/owner until the normal close/release conditions. Whether a dependency's
terminal causes N terminal is governed by terminal policy; Q terminal alone is not proof N settled.

Authority: activated R-terminal rev1, R-deps-terminal rev1 and R-terminal-settles-dirty rev1 establish
terminal finality, default cascade and dirty release. Prior review already distinguishes terminal output
from actual lifecycle closure. This is an existing-rule composition, not a new faulted node mode.
Normal handled dependency terminal that returns without outward setup failure remains separate from
failed setup gating. Terminal-input/ignore/all-complete combinations remain in the public policy matrix
review; no exhaustive combined-case validation is claimed here.

Bounded TS dafc5ae5 diagnostic (tsx -e): independent keeper activates P, which announces DIRTY.
N(P,Q,R) has a private pre-recorded owned sink release. Q registers cleanup, emits ERROR(protocolError),
then throws distinct setupError. Asserted N sink START,DIRTY,ERROR and exact error identities; N fn0,
R fn0, retained N subscriber1, Q cleanup0 before release, retained P/Q/R subscription counts [2,1,0].
Diagnostic N.down(RESOLVED) after terminal changes no output. Owned N release runs Q cleanup once,
removes Q subscription, and leaves P keeper independently active. All assertions passed, exit0.
This proves those existing runtime mechanisms, not automatic new failed-setup balancing/eligibility.
No persisted test/runtime/normative/formal/conformance/owner-ledger change or remote push.

Next review cursor: consolidate the owner facts required by successful setup, failed computation
consumption, still-owned leases, output settlement and actual lifecycle closure in the restrained
state design. Avoid promoting each concern to its own public status or duplicating derived flags.
Remaining terminal/operator API matrix, original concrete consumers (job pool/dependency manager),
D30/destroy provenance and stale Work reconciliation still remain in walkthrough closure scope.

### Unified runtime fact/ownership design draft (2026-10-12; not yet accepted)

User requests the unified state design: stored facts, derivable views and each owner. This is an
explicit design-review request, not runtime implementation or normative admission. The following
consolidates the accepted information model, on-read status/permissions, lifetime isolation, stable
connections/input views, failed setup gating/consumption and settlement outcomes. No new universal
faulted status or historical error storage is proposed.

Rules classification: active R-ctx-state rev1, R-first-run-gate rev1, R-terminal rev1,
R-resolved-undirty rev1 and R-terminal-settles-dirty rev1 constrain private state, first-invocation
history, terminal and settlement. R-node-thin rev1, R-status-enum rev1, R-ctx-wave-data rev1 and
R-dispatch-all rev1 lack activation and cannot be silently treated as active projection. Prior user
review commitments (and their cited decision rationale) remain proposed requirements for final
Rules reconciliation, not hidden clauses supplied by this draft. D5/D8/D22/D23/D29/D49/D77 and
package-owned graphrefly-ts:D161 explain concern boundaries, but do not grant new implementation scope.

Design principle: store irreducible history/identity, live value facts, actual owned resources and
accepted work. Derive availability, permission and presentation. Performance counters are explicit
maintained indexes with equality invariants, not independent authorities. One node runtime coordinator
orders cross-concern transitions before callbacks; concern ownership identifies unique mutators and
does not require new classes/managers/registries. NodeCore may physically hold graph-local storage,
but storage location is not semantic ownership or permission for every reader to mutate it.

Stored fact groups and sole mutators:
- Declared deps/config/fn binding and stable connection identity/position: topology mutation logic;
  graph owns registration/group binding, dispatcher owns fn pool/handle registration and invocation.
  Lifecycle release does not remove declared edges or unregister fn needed for later activation.
- Output cache with unique absence representation, unresolved cache freshness, terminal record/current
  ERROR payload, and any existing version/replay facts: node output transition logic. A redundant
  hasData can be removed only where legal SENTINEL makes presence derivable; retain protocol distinctions.
- Each dep's retained current value/terminal, outstanding DIRTY membership, unconsumed projections and
  wave/terminal-event boundaries: input reducer. Retained latest and unconsumed occurrences are different
  facts; do not delete one merely because the last value is presently duplicated. Avoid parallel batch
  and waveData histories absent a proven separate semantic need.
- Downstream dirty/settlement obligations and generated-versus-delivered settlement ownership: output
  transition/delivery logic. Buffer entries/frame receipts identify generated settle; owed delivery
  cannot be inferred from dep dirty count or cache freshness. Do not add duplicate settle flags where
  explicit queue/frame records suffice.
- First-fn invocation history: node invocation admission records when the invocation begins, not when
  a successful result arrives. Cache invalidation cannot reconstruct it; fresh activation/reset and
  supported checkpoint restore follow their previously accepted distinct policies.
- Lifecycle identity/phase and initial dependency setup outcome: node lifecycle logic. Proposed setup
  result is one tag unsettled/ready/abandoned, replacing several contradictory ready/failed/pending
  booleans. It denotes this node's own initial dep setup, not all graph startup or fn success. An own
  fn throw after ready is not automatically a setup abandonment; a dep subscribe throwing during this
  node's setup is. Pending versus currently executing setup comes from execution/work records rather
  than a second saved setup-running flag. Outcome is not inferred from release slots or retained errors.
- Sink registrations/release capability identity, retaining leases and dependency cleanup/release
  records: lifecycle/resource logic, respecting private transferred ownership and consume-before-call.
  Fn supplies/registers resource cleanup through valid ctx; lifecycle owns subsequent invocation.
- Pause lock membership/mode and latest owed PULL request: control-message logic. In-flight demand
  belongs to its invocation frame; no separately maintained paused/canPull/resumed flags.
- Ordered undelivered output waves: node delivery logic; immutable accepted arrays, life binding and
  FIFO position remain necessary. Buffer length/state gives hasBufferedOutput. Terminal discards under
  the accepted policy; generation of settle and its delivery must remain distinguishable.
- Accepted boundary operations/current execution scopes with exact life/connection/batch bindings:
  graph-local boundary scheduler owns queue/frame mutation. Node owners decide permission, cancellation
  and owed work. No requirement to collapse distinct pause/output/boundary sequences into one blocking
  global FIFO. An activation/dirty/pull cause must remain represented where not derivable from existing
  records; absence of a queued task is not proof of successful/failed setup.
- Private algorithm value/persist policy: fn/helper owns content via valid ctx; lifecycle applies
  agreed close/reset/retention, cleanup view offers only its permitted reads. No diagnostic reader writes.
- Permanent retirement: existing graph/runtime registration release owner, one canonical fact distinct
  from ordinary inactive. Current-operation errors are temporary aggregation owned by the operation's
  reporting boundary; external diagnostic receiver owns historical persistence, not the node.

Derived views: status.cache from absence/freshness/terminal; status.output from terminal;
status.lifecycle from phase/permanent retirement. ctx validity from life identity+phase+retirement,
then operation-specific terminal/connection/admission constraints. Fn eligibility combines legitimate
owed cause, active allowed lifetime, setup ready, no unbalanced input DIRTY, first-value/terminal-input
policy, pause/PULL policy and safe callback/mutation/invocation/batch boundary. Generic scheduling
readiness must not apply fn's no-terminal gate to already admitted deferred topology tasks that remain
legal after output terminal. Restart/subscription permission follows the existing lifetime/terminal/
resubscribable/cleanup rules, not a separate mutable canRestart flag. Initial-value completeness and
pending count are logical derivations from input records; O(1) maintained counts may be justified,
with one reducer and exact update invariants for removal/terminal/initial snapshots. Status stays O(1),
side-effect-free and on-read; optional inspection may explain setup and other blockers without exposing
all internal flags or retaining error history.

Representative trace under the approved behavior: N acquires P, Q throws, B survives. Lifetime remains
active; setup outcome abandoned; acquired leases remain owned; unconsumed failed input removed; owed
DIRTY finishes through RESOLVED under delivery timing; no-value N status becomes
{cache:empty, output:open, lifecycle:active}. Fn is still ineligible because setup abandoned. Optional
inspection can explain that current outcome without holding the thrown error. Closing after last
owner revokes ctx/tasks before releases; fresh activation uses a new identity and unsettled setup,
not old snapshots/failed input. Terminal with retained cache may remain stale after output closes,
and quiet pull may have stale cache with no downstream DIRTY; these prove separate backing facts.

Evidence: read existing core.ts state groups, node lifecycle/input/output/context runtime, NodeCore
boundary queues and batch/boundary.ts. Existing status/activated flags and duplicated dep projections
are inspected baseline, not proof this draft exists. No new test or benchmark run for this design;
future verification must cover reentrant setup failure/cleanup, buffer/terminal/batch interactions,
pending count and identity invariants, restore rejection of unsupported work, and allocation/retention.
Exact field names, physical layout, completion tag admission, shared permission interface and queue/frame
representation remain proposed for human review and bounded follow-up design. No runtime, D#, Rules,
formal/conformance change or GitHub push.


### Imported independent QA snapshot: provenance (2026-10-12)

Human supplied the Downloads copy of this session after another agent performed QA on the
2026-10-05 review state. Import only its QA section, preserving the local 10-05 through 10-12
continuation rather than replacing the entire divergent file. The report below is external review
evidence, not authority or newly accepted choices. Five-lens convergence counts and its original
probe/gate receipts are source claims, not independently re-run receipts. The source names two
additional probe files not supplied locally; local QA-4/6/8 reconstructions are separately documented.
Original source line coordinates refer to that supplied snapshot. Our later corrections, baseline
checks and dispositions follow this imported section. No Rules or D# is created by this import.

### QA pass over the accepted directions (2026-10-05)

User requested a full QA of the directions accepted so far, looking for unconsidered cases and
conflicts. Method: five independent read-only review lenses (lifecycle/cleanup; subscription/
activation/FIFO; wave structure/delivery; pause/terminal/demand; status/API/record discipline) over
DS-15, DS-16 and the current `spec/rules.jsonl`, plus the reviewer's own cross-check and spot checks
of every high-severity citation. Findings that two or more lenses reached independently are marked
with their convergence count. Nothing below locks a choice; each item ends in the question the
maintainer must answer. Items are numbered QA-n for one-at-a-time discussion.

Rules — conflicts and gaps between accepted directions (one trace each)

- QA-1 (×3) Terminal resubscription inside the old lifecycle's own terminal fanout. S resubscribable,
  observers X then Y. S delivers [[DATA,1],[COMPLETE]]; facts are updated before callbacks, so S is
  already terminal when X runs; X calls subscribe(S, Z) → close-before-new closes L1 and detaches
  X and Y mid-fanout → per-delivery validation skips Y → Y never receives DATA(1) or COMPLETE, and
  L1's post-delivery bookkeeping runs after L2 exists. The closing-rejection rule covers "retiring
  synchronous invocation", not the node's own delivery loop. Q: is a subscribe that would close the
  current lifecycle admissible inside that lifecycle's delivery (immediate / deferred to the owning
  boundary / rejected), and what do detached co-subscribers observe?
- QA-2 (×2) Callback-identity reuse vs terminal resubscription. cb registered in L1; S COMPLETE while
  cb still registered; caller calls subscribe(S, cb) to restart. Identity rule: reuse, alias, no START,
  no restart (silent hang). Close-before-new: close L1, fresh registration, cb's old release dead.
  The permission matrix orders lifecycle phase, then terminal, but never places the identity check.
  Q: does "existing subscription" mean a registration of the current open nonterminal lifecycle?
- QA-3 (×4) Ownership of the pause lockset and of an owed PullDemand across closure/reset. PAUSE
  before first subscription is accepted as a node fact; buffers are lifecycle-owned; current
  deactivation and active R-terminal@1 reset clear locks and demand. Pauser P holds L; last
  unsubscribe closes; resubscribe runs fn although P never resumed; P's RESUME is an unknown-lock
  no-op. Same for terminal reset and for a PULL received while inactive. Checkpoint omits locks.
  Q: which node-surface control facts survive closure/reset, and does R-terminal's "drains pause
  lockset" stand?
- QA-4 (×2, probe-verified) resumeAll plain state node loses an accepted set. state(20, resumeAll);
  subscriber; PAUSE; set(30) executes into the pause buffer (cache stays 20); last unsubscribe
  discards lifecycle-owned buffer; later subscribers see 20. Conflicts with "public state.set belongs
  to stable node/state input, survives last-unsubscribe, updates the cache". Baseline probe
  `protocol-reconciliation-probes/resumeall-state-set-last-unsubscribe.ts` reproduces the loss.
  Q: does a plain state node participate in resumeAll buffering, and is an executed-but-undelivered
  set lifecycle-owned or node input?
- QA-5 (×2) "Result is owed" has no observable definition. "An async fn returning without output must
  not automatically produce RESOLVED while a result is owed" revises active R-resolved-undirty@1
  (absent from the 10-05 reconcile list). Pool label, returned thenable and authored DIRTY are each
  excluded or indistinguishable. If owed is wrongly assumed, the cone wedges forever (status
  waiting); if wrongly denied, RESOLVED lies about occurrence. Q: what fact marks an owed result, and
  who balances the DIRTY when the owed result is silence?
- QA-6 (×4) Control issued from an observer callback: immediate or queued? Output requests are
  queued; PAUSE is immediate; RESUME/INVALIDATE/PULL/TEARDOWN are unmentioned. Immediate RESUME of a
  resumeAll leg from inside another node's fanout releases the join's single idempotent dirty unit
  with an old buffered array, so the join recomputes twice in one wave with a stale pair (violates
  R-diamond@1); outcome depends on subscriber order. Same with mid-wave INVALIDATE. Q: classify
  each up-tier message from callbacks, and may a buffered old-wave settle release a unit that also
  covers the in-flight wave?
- QA-7 (×2) Pre-activation PAUSE inverts the accepted 10-then-30 order. PAUSE before subscribe;
  START callback queues down(DATA30); activation owed but gated; FIFO drains 30 now; RESUME runs
  first invocation → DATA10 overwrites the newer 30. Variant: queued COMPLETE seals a node whose fn
  never ran, contradicting "may execute only after first fn has started". Q: when activation is
  owed but not allowed, does the FIFO still drain, and who drains later?
- QA-8 (×3) Deferred invocation vs automatic terminal. Paused effect/rescue with complete:'all' (or
  error:'input'); dep sends [DATA,23],[COMPLETE] (or ERROR without DATA); invocation blocked;
  all-terminal auto-COMPLETE fires now (accepted: need not wait for deferred fn). On RESUME the
  deferred invocation either runs with sealed output (side effect after downstream saw COMPLETE)
  or is cancelled (last value / delegated error never processed). Variant: error:'input' plus
  first-run gate blocked by a no-DATA COMPLETE on another dep → auto-COMPLETE, fn never offered the
  delegated ERROR. Q: does auto-completion wait for a PAUSE-deferred (not async) invocation; if not,
  cancel or run sealed, policy-dependent?
- QA-9 (×4) DIRTY prefix policy is undefined at the observer boundary. Active R-dirty-before-data@1
  synthesizes DIRTY only "when the node is not already dirty", but the accepted explicit-DIRTY trace
  shows DIRTY then DIRTY+DATA(23); deferred/async "own full wave with prefix"; resumeAll drained
  arrays "normalized"; batch commit array; activation output ([DATA10] per R-two-phase exemption or
  [DIRTY,DATA10]). Per-array reading: observers may see unbounded DIRTYs per settle; per-debt reading:
  drained second array arrives at a non-pending receiver (violates R-dirty-before-data/R-two-phase).
  Q: is DIRTY a per-array invariant or a per-debt invariant, for ordinary, activation, batch-commit,
  deferred and resumeAll-drained arrays?
- QA-10 (×3) Initial array for a waiting node (no value, outstanding DIRTY) is not enumerated, and
  partial:true during wiring double-fires. Active R-push-subscribe@1 says [START,DIRTY]; the 10-05
  catalogue says START alone if empty. Diamond D=fn(B,C) partial:true, C cold and pending on A:
  with [START] only, D fires with (b',SENTINEL) then again with (b',c') — the activation-time glitch
  R-diamond forbids and the phase-gap policy's "no transient zero-count early computation". Also
  R-first-run-gate literal counts not-yet-wired deps as zero dirty. Q: (a) waiting initial array;
  (b) are unwired deps pending until the wiring sequence completes, regardless of partial?
- QA-11 (×3) Dependency already terminal at wiring time. A completed non-resubscribable promise with
  cache; new C=fn(A,B) with complete:'input' subscribes → R-terminal rejects → C's activation fails
  and subscribe throws; resubscribable variant restarts a shared upstream by mere dependency
  declaration (contradicts "topology does not grant lifecycle ownership"). TEARDOWN-then-reset variant
  closes the old lifecycle then fails activation. Q: is a dependency acquisition a "late subscribe"
  for reject/reset, or is a terminal node wire-able read-only as [START,(DATA),terminal]?
- QA-12 Abort window of a subscribe operation. Observer throws on the activation-output array or
  during the FIFO drain inside the creating subscribe(A). Handshake abort covers only START/cache/
  replay; established-observer policy keeps the registration and reports at the owning boundary, i.e.
  subscribe throws → caller never receives the release → leaked registration (the baseline leak,
  now by design). Q: is the abort window the whole subscribe operation until it returns?
- QA-13 Closure nested inside a running fn. fn emits, observer unsubscribes last, lifecycle closes
  inside down(); fn then calls ctx.state.set → accepted: rejects with invalid-context error. Where
  does that escape go: protocol ERROR on the node-level terminal record (poisons the next lifecycle)
  or operation failure to the unrelated outermost caller? Related: R-cleanup-hooks clears hook lists
  before invocation; closure in the window before re-registration runs no hooks and the late
  onDeactivation registration is rejected → resource leak. Q: do post-closure writes from the
  retiring invocation throw or drop, and is a hook registration attempted by the retiring invocation
  treated like late-returned cleanup?
- QA-14 Default-PAUSE deferred invocation input: "latest dep values" (R-pause-modes, 09-18 trace)
  vs "retain received DATA occurrences and per-dependency wave boundaries, no latest-only
  replacement" (accepted for the initial gate). Raw scan under PAUSE with DATA20,21,30 either loses
  occurrences (the substitution D49 removed) or retains unbounded paused input. Q: which, and what
  does INVALIDATE clear within the retained history?
- QA-15 (×2) INVALIDATE before the first run (stale seed or PAUSE-deferred first run). Dep delivered
  DATA then INVALIDATE before fn ever ran; R-first-run-gate counts "delivered ≥1 DATA ever" → first
  invocation runs with undefined, the one case the T|undefined approval excluded; or the node hangs.
  Q: is initial readiness historical delivery or currently retained value?
- QA-16 Subscribe origin matrix beyond initialization callbacks. subscribe(X) from inside a raw fn
  (X cold, in the fn's ancestor cone) → immediate activation re-enters the fn (D37 ERROR) though no
  dep set was touched; from an ordinary delivery callback → nested activation wave inside a callback
  (what the FIFO avoids for output). Q: immediate / boundary-deferred / rejected, and where relative
  to the FIFO?
- QA-17 (×2) Reentrant subscribe mid-fanout. Observer O1 receiving [[DIRTY],[DATA,30]] subscribes O2:
  cache already 30 → O2 gets START+DATA30 and, if live registrations join the in-flight array, DATA30
  again (duplicate occurrence); cache still 23 → stale array then must join. off-then-resubscribe of
  the same callback inside its own callback has the same question. Q: cache update before or after
  fanout; candidate set frozen at array start or live per delivery?
- QA-18 Batch interactions. Callback-origin output queued during a batch's early-DIRTY callback:
  batch-owned (dropped on rollback) or independent; drained inside the batch (accumulated into the
  commit wave, breaking "separate down calls remain separate arrays") or after commit; commit array
  shape; accumulated RESOLVED then DATA across two in-batch calls violates exclusivity — which
  submission loses. Q: all four.
- QA-19 (×2) Public node.down on a fn-bearing node queued by a callback whose lifecycle closes before
  drain: lifecycle-owned (cancelled) or node input (populates the cache of a closed compute node that
  R-rom-ram says holds none; a queued COMPLETE makes an inactive node terminal unobserved). The seal
  example DATA30,COMPLETE,DATA40,reset,DATA50 cannot be produced from a callback because subscribe is
  immediate while output is queued. Q: ownership of public down per surface; is the seal keyed to the
  lifecycle in which terminal took effect?
- QA-20 (×2) Two queues, two terminal policies. FIFO text "DATA30, COMPLETE delivers 30 then
  terminal" vs pause-buffer "terminal drops held output": on a resumeAll-paused target the queued 30
  is buffered and then dropped. Q: restate FIFO as issue order, and state that queued-then-buffered
  output is subject to the terminal drop?
- QA-21 Close-before-new "detach old subscribers" vs dependents and graph.retain. B=node([A]) and a
  retain hold A; terminal resubscription of A either severs a declared edge without rewire
  (describe still shows A→B; retain dropped) or cannot reach zero registrations. Q: what counts as an
  old subscriber, and is terminal resubscription admissible with dependents/retains attached?
- QA-22 Restore. "Reconnect must not recompute restored cache" has no backing fact in the minimal
  status facts and applies to one activation only; a depless fn source (websocket) either never
  reconnects or double-produces. Q: dedicated post-restore fact and its clearing; applicability to
  depless fn nodes.
- QA-23 Permanent release (D122/D124) vs ordinary closure. Live external registrations on a released
  group observe nothing; release requested while a member is closing; release keeps a separate failure
  aggregation while ordinary closure got the AggregateError contract. Q: do live registrations make a
  group non-quiescent; is release admissible while closing; one failure contract?
- QA-24 Staleness fact undefined. Quiet holder that evaluated with current inputs but emitted nothing:
  stale forever (cleared by settle) or ready (cleared by invocation)? Default PAUSE with late pre-pause
  result delivered and newer input owed: ready or stale? Owed activation / owed first input: waiting or
  empty? "Preserve the resolved distinction" vs a view where RESOLVED-settled and DATA-settled are both
  ready/empty; draft R-status-enum@1 replaced without being named. Q: setting/clearing events.
- QA-25 Observer failure when the owning synchronous operation is a pool callback or timer tick (no
  user caller): the aggregate is thrown into the async callback. Q: destination of observer errors for
  runtime-originated waves.
- QA-26 (×2) Observer-origin feedback livelock: cb → set → fresh wave → cb → set … drained forever by
  the outermost operation; D37 does not see it. Q: accepted user-level runaway (document) or bounded?
- QA-27 Smaller wording gaps: fn-authored output plus same-cause synthesized terminal/RESOLVED — one
  array or two (invocation count differs for reduce/effect); tier-sort vs authored order for
  [DATA1,INVALIDATE,DATA2] and [COMPLETE,DATA]; resumeAll×INVALIDATE clears cache at arrival or at
  drain; resumeAll on one diamond leg yields a mixed-time join (inherent, undocumented); quiet pull
  holder's activation-time first run suppressed or not; replayBuffer delivered to a dependency node
  re-derives historical occurrences; "depless promise source first sends START" conflates handshake
  with output; replay ring plus stale cache ordering.

Decisions — questions and record corrections, no new lock

- Raw escape vs protocol ERROR discriminator (raw never converts / sugar always) is inferred from
  probes, not written; it is a prerequisite for the recorded next cursor (survivor-owed activation
  failing) and for QA-13.
- resumeAll drain-then-invoke with owed parameterized PULL: the 09-18 correction ("no second demand
  invocation") and the later drain-then-invoke-once proposal both stand; 09-18 "demand invocation
  need not emit DATA" does not resolve it; it is absent from the 10-05 deferred list. Record one of
  accepted / deferred / open.
- D30: its opt-in cancellation half ({switch:true}, AbortSignal via ctx) is foreclosed by later
  accepted directions without a named supersession; "destroy" is undefined against TEARDOWN (D65),
  permanent release (D122/D124), closing, and draft R-graph-lifecycle@2. Already a closure item.
- Active rules that the accepted directions revise and that the unified reconciliation must name:
  R-push-subscribe@1 (stale initial array; waiting array), R-dirty-before-data@1 and R-two-phase@1
  (prefix policy, activation exemption), R-first-run-gate@1 (per-kind readiness, wiring order),
  R-deps-terminal@1 (grouped policy), R-resolved-undirty@1 (owed async result), R-terminal@1 (lockset
  drain, dependency wiring as late subscribe), R-cleanup-hooks@1 (QA-13 window); draft R-status-enum@1
  replaced by the derived view; drafts R-pause-modes/R-replay-buffer revised by pull precedence and
  terminal drop.
- Record discipline: bare "D161" at line 1732 and "TS D161" at 1699/1717 resolve, per decision-guard,
  to graphrefly:D161 (relocated to graphrefly-ts root-origin-history, a restore record), not to
  graphrefly-ts:D161; correct to the qualified ref. The six "User-confirmed" subsections carry
  imperative protocol prose without "Rules candidate — revises R-x@n" labels; re-label before the
  unified pass so affected revisions can be enumerated mechanically.

Work — evidence, coverage and follow-ups

- Spot checks performed on the citations behind QA-2, QA-4, QA-5, QA-8, QA-9 and the drain-then-invoke
  record; all hold. QA-4 reproduced at TS dafc5ae5 (events START, DATA20, cache 20 throughout, new
  subscriber DATA20; no 30 anywhere). A second scratch probe confirmed the current runtime does not
  implement the pre-activation PAUSE gate (fn ran immediately), so QA-7 is design-level only.
- Consistent under all lenses (not re-raised): initializer abort with surviving subscription;
  duplicate callback during initialization; ctx-owned deferred work cancelled at closing; persist
  retains the object; cleanup consume-before-call; subscriber failure isolation; terminal seal vs
  queued rewire; pull START-only precedence; buffered arrays FIFO and re-pause behaviour; INVALIDATE
  as invalidation-not-revocation; T|undefined inputs with first-run-only gate.
- Already deferred and left alone: cross-request PULL idempotency/ACK, run-while-other-dep-dirty,
  downstream-requested restart, multi-node recovery wrapper, complete:'any', deep clone, unsupported
  checkpoint states. The survivor-owed activation failure remains the recorded next cursor; QA-16 and
  the RESUME-deferred first activation reach the same open question by other triggers.
- No Rules, D#, formal, conformance or runtime change. Items for the unified pass: resolve QA-1…QA-27
  one at a time per the user's pacing, then enumerate the affected active revisions above.

### Local reconciliation of the imported QA snapshot (2026-10-12)

User supplied an independent QA report and then the Downloads source path. Reading/importing its
findings does not mean accepting all classifications or locking the proposed repairs. The report is
a 2026-10-05 snapshot; compare it against subsequent 10-08 through 10-12 review agreements. No child
agents were started here. Imported only the QA section, preserving both sources' continuations.

Rules — initial disposition, with bounded evidence and explicit unresolved cases:

- QA-4: confirmed baseline loss and a missing ownership-stage contract. State20 + resumeAll pause +
  set30 + last-off -> new sink sees20, never30. Stable node-input acceptance and lifetime-owned output
  dropping cannot be joined by silently relabelling an executed state update as disposable output.
  The earlier claim that node-owned state requests survive close was not qualified/verified at this
  executed-but-undelivered transition. This needs a user choice; do not use baseline as justification.
- QA-6: independently reproduced control interleaving. Right branch holds old1 under resumeAll; left
  DATA callback resumes right during source2 fanout. Join traces [0,0],[2,1],[2,2]. This is a real mixed-
  wave/settlement hazard; classify callback-origin RESUME/PULL/INVALIDATE/TEARDOWN separately and pin
  the safe execution boundary before claiming the future FIFO/array scheduler solves it. Proposed
  priority is external effect-producing control at the same safe boundary as external output, retaining
  explicit immediate pause acquisition if agreed; not a blanket rule to queue all raw ctx controls.
- QA-8: the interaction is real, but an unconditional logical contradiction is not yet established.
  Accepted text already says DATA cannot bypass gates, auto terminal need not wait, and deferred
  terminal input is subject to output/lifecycle closure. A coherent default is terminal cancels owed
  invocation, no post-terminal side effects. Probe default effect: initial0, PAUSE, DATA23+COMPLETE,
  RESUME -> effects[0], output completed. Legacy delegated-terminal variant
  completeWhenDepsComplete:false, terminalAsRealInput:true -> effects[0,23], no automatic COMPLETE.
  This does not close the untested complete:all/error:input/blocked-first-gate variants; their grouped
  policy matrix must state cancellation/processing guarantees and is still open.
- QA-9: active-rule wording versus per-array notification promises remains an explicit unresolved
  reconciliation, including activation, batch commit, deferred result and buffered-array drain. A
  DIRTY membership bit is not sufficient to define public array shape. Do not choose a prefix policy
  through the status design alone.
- QA-1/2/3/7/11/12/16/18/19/21: continue as admission, lifetime, ownership or queue-scope questions.
  This pass does not claim to have proved every asserted contradiction. In particular, upstream's
  own resubscribable permission versus generic downstream restart, and whole-subscribe abort versus
  an already returned independent survivor, need distinct traces and explicit ownership.
- QA-10(b): setup-completion-before-fn was accepted 10-10 and refined after testing; never infer it
  from dirty count or acquired release slots. QA-10(a), empty-with-outstanding-DIRTY initial array,
  still needs explicit enumeration. Raw outward failure versus wrapper protocol ERROR, listed as
  missing in the imported Decisions paragraph, was explicitly reviewed/accepted after that snapshot;
  retiring-invocation exception routing in QA-13 remains separately open.
- QA-13/14/15/22/24/25/26/27: keep the remaining precise permission/hook, paused-input retention,
  initial readiness wording, restore cause, freshness transitions, runtime callback error egress,
  runaway and wave/operator cases open. Existing stored-fact grouping is not proof of these semantics.
- QA-17: verify registration candidate freezing/identity, current cache snapshot and nested acquisition
  order together; a stable candidate list alone does not settle every off/readd or new-init trace.
- QA-20: FIFO issue/execution order and guaranteed visible delivery are different. Existing accepted
  resumeAll terminal-drop policy can drop a queued DATA after it enters the pause buffer, even if its
  request executed before COMPLETE. Qualify the generic DATA30->COMPLETE delivery example with this
  policy rather than pretend ordering overrides terminal drop.
- QA-23: existing quiescent release excludes live/accepted work and ordinary inactive differs from
  permanent retirement. Closing admission and a consistent operation failure interface still need
  concrete verification; no new permanent error blockade or release mechanism is approved.

Decisions — record and design consequences:

Qualified the local construction-related bare D161 refs as graphrefly-ts:D161. The imported report
preserves its source coordinates and original citation warning. Added non-normative Rules-candidate
labels and reconciliation targets to the eight current User-confirmed subsections, including the six
identified in the report. These labels neither activate a revision nor resolve their open conflicts.
R-resolved-undirty@1 and R-cleanup-hooks@1 are included in affected-rule reconciliation; activation,
terminal, prefix and draft status/pause/replay changes remain explicit. Preserve DS-15 follow-ups.

The unified state/owner proposal is a draft, not a complete design. Add two axes before a layout is
approved: lifetime (stable node/topology, active lifetime, invocation, wave/batch, accepted request)
and stage (admitted input, applied state, generated output, buffered output, delivered output). Owner
alone cannot explain when information may be discarded. Pause lock/PULL lifetime, restore-only
reconnection intent, async result obligations and exact freshness transitions cannot be declared
covered merely because their group has an owner. No extra flag/API is selected by this observation.

Suggested first concrete choice for QA-4, not yet accepted: preserve the applied plain-state assignment
at stable node scope while pause controls delivery. Its lifetime-owned undelivered notification may
be dropped on last-off, but a later subscription must initialize from the surviving current state30.
This requires explicitly deciding whether public cache denotes assigned state or last published
output, plus replay/pause/subscription behavior. Separate stable input value from delivered output
only where those facts actually diverge; do not invent a second mirrored cache for every node. An
alternative is to redefine resumeAll state assignment as cancelable/delivery-committed, which narrows
the earlier stable-state promise. Do not automatically implement either option or blanket-exempt all
sources from pause. PAUSE lock lifetime (QA-3) must be resolved alongside the continuation trace.

The resumeAll owed parameterized-PULL drain/service question remains open: 09-18 accepted correction
and later uniform proposal are both recorded; a terminal silence explanation does not resolve
whether buffered output fulfills changed params. Earlier handoff wording gave it more certainty than
its acceptance chain warrants. Recover the exact approval chain before labeling accepted/deferred.
Keep D30/destroy provenance and original job-pool/dependency-manager consumer checks in closure scope.

Work — independently obtained evidence:

Saved three portable diagnostic reconstructions (baseline assertions, not future conformance tests):
resumeall-state-set-last-unsubscribe.ts (QA-4), observer-resume-diamond.ts (QA-6),
paused-effect-terminal.ts (QA-8). Source QA's initializer-abort probe was not supplied; do not claim
it was copied or independently re-run. Ran all three from TS worktree7a26 at unchanged dafc5ae5;
each exit0 and outputs match the traces above. No package runtime file changed, no full runtime
qualification or five-reviewer independence claim for this local audit. Run the root dashboard gate
separately and record its real result. No new D#, normative Rules, formal/conformance edits or push.
Next review cursor: QA-4 applied state value versus paused delivery, coordinating lock lifetime with
QA-3; then QA-6 effect-producing control boundaries; then complete QA-8 terminal policy matrix.

Local QA reconciliation gate receipt: node dashboard/build.mjs --check exited0 on 2026-10-12.
Unresolved authority refs/cycles0; existing D792 session-orphan and unavailable external work/artifact
warnings remain. A passing documentation gate does not close QA-1 through QA-27 or validate proposed
runtime semantics. No authority ledger was changed, so no owner-ledger admission is claimed.

### QA-4/QA-3 joint state/cache/pause lifetime proposal (2026-10-12; pending acceptance)

User explicitly selects discussion of plain state value, cache and pause locks, including last-off
and reactivation. This proposal builds on the accepted stable-state request ownership and snapshot
handshake, while correcting the confirmed resumeAll assignment loss. It does not implement a fix.

Rules candidates: revise/narrow activated R-terminal@1's unconditional pause-lockset drain on fresh
terminal resubscription; clarify activated R-push-subscribe@1 initialization from the new plain-state
baseline and snapshot versus live delivery; reconcile draft R-rom-ram@1 and R-pause-modes@1 with the
applied input/published snapshot distinction. Preserve current activation/deferred request legality,
terminal output finality, quiet-PULL START-only and the separate pending prefix-policy review.

Stored facts / scope / mutator proposal:
- Applied plain-state value: stable node input, changed only when a valid set is actually applied.
  Admission/queuing is not application; no write before safe-boundary execution, lawful batch commit
  or output-seal checks. Source/state input logic owns this value, not cleanup. No new public .value
  accessor or second canonical input for every computed/producer node is implied.
- Output cache: output logic owns the current retained output snapshot. During an active resumeAll
  pause, applied state may advance to30 while cache remains20 and undelivered DATA30 is buffered.
  Draining older30 then40 advances cache in output order but must not reapply them to the already
  current state40. These are different facts only when they diverge, not duplicate authorities.
- Pause lockset: node-scoped control facts, changed by matching explicit PAUSE/RESUME; survive ordinary
  deactivation and eligible terminal reset of the same node. Permanent retirement discards the node's
  control material. No scope inference from subscriber count; caller/helper issuing a lock must arrange
  its release. Default pause versus resumeAll remains mode-derived. A departed subscriber must not
  silently release another caller's lock. pausable:false remains its ignore policy.
- Pause output buffer, output fanout registrations, active ctx/cleanup resources: active lifetime.
  Ordinary last-off with no other retaining owner closes/revokes that lifetime, releases its resources
  and drops old output entries. Stable applied state and node locks are not dropped with the entries.

Concrete nonterminal proposal: initial state20/cache20; PAUSE lockL; apply set30 -> state30/cache20,
old-life buffer DATA30. Last-off closes old lifetime and drops that buffer while preserving state30
and lockL. During ordinary nonterminal close finalization, rebase the inactive plain-state retained
cache/snapshot to state30, with no subscriber delivery and no retroactive claim that DATA30 was sent.
Reactivation initializes from that surviving baseline before START callback: new sink receives
START+DATA30 snapshot while lockL remains held. Subscription initialization is the already accepted
snapshot path, not a flush or new fn invocation. This ordinary PAUSE does not become quiet-PULL:
quiet pull still sends START only. If nothing new was buffered, subsequent explicit RESUME lockL
sends no extra30 and does not run a plain-state fn (there is none). A later set40 in the new paused
lifetime applies state40, buffers its live output, and leaves cache30 until permitted delivery.

Within the same still-active lifetime, additional subscriptions use its retained output cache:
if state30/cache20/output pending, the new initial snapshot uses cache20 plus outstanding DIRTY under
the chosen initial-array ordering, not the ahead-of-delivery state30. This avoids turning an existing
buffered occurrence into a premature latest snapshot then delivering it again. Old subscribers remain
paused. Fresh-lifetime snapshot30 and same-lifetime stale snapshot20 are distinct initialization cases.
Existing explicit replayBuffer policy remains separate; do not redefine it as the assignment history.

Terminal must not be bypassed by cache rebasing: if output already terminal, last-off does not reopen
or rewrite the sealed output snapshot. Applied state from before terminal still survives independently;
only an eligible explicit fresh terminal resubscription resets output and seeds the new baseline.
set requests blocked by the terminal/old-output seal are not applied to stable value. All old ctx and
release aliases remain tied to old lifetime identities. External lockL remains until RESUME even
across this reset; this changes R-terminal@1's lock clearing and needs future normative amendment.

Tradeoffs: explicit locks can remain held after their issuing code goes away; this is responsibility,
not permission to infer cancellation. Subscription snapshots can initialize a new consumer while
live delivery is paused, consistent with the accepted no-general-subscription-pause policy. A user
requiring quiet subscription must use the separately agreed quiet-PULL boundary. The public cache
is a current retained snapshot, not an immutable historical last-message log; ordinary nonterminal
inactive state can rebase to its stable intrinsic value without announcing a live occurrence.

These choices are not yet accepted. Exact public value-read surface, version/replay metadata on
baseline rebasing, INVALIDATE handling of intrinsic state, callback/batch timing and pooled/native
public down ownership require bounded follow-up qualification; do not claim QA-4/3 fully closed by
this paragraph. Owed PULL request lifetime likewise cannot be derived from lock lifetime and remains
its separate source/owner/service-stage question. No scope modes, automatic lock release, new verb,
public faulted status, runtime/Rules/formal/conformance/decision-ledger change or GitHub push.

### User accepts plain-state/cache and node-scoped pause-lock directions (2026-10-12)

User agrees with the preceding joint QA-4/QA-3 recommendation: applied plain-state value is stable
node input; active output cache may lag under resumeAll; ordinary nonterminal close rebases its
retained snapshot from intrinsic state without live emission; terminal cache remains sealed until
eligible fresh reset. Old lifetime buffer/resources are released independently. Pause locks survive
ordinary close and eligible same-node terminal reset until explicit matching RESUME or permanent
retirement. Initial ordinary snapshots remain distinct from paused live output and quiet-PULL
START-only. Accepted review direction only, not runtime/Rules/D# admission. Public intrinsic-value
accessor, version/replay/INVALIDATE details and other qualified follow-ups remain open.

### Owed PULL lifetime recommendation (2026-10-12; pending acceptance)

User asks whether a previously owed demand survives last-off/reactivation. Recommend retaining the
single latest owed demand only within the holder's current active lifetime. Node control-message logic
owns its storage and attaches the holder lifetime identity; lifecycle close cancels the unserved slot.
If another subscription/retaining owner keeps the holder lifetime alive, leaving one subscriber does
not cancel it, even if that subscriber originally caused the PULL. There is no per-requester correlation
or automatic requester-unsubscribe cancellation in the chosen protocol. Still-active blocked demand
continues to wait for normal pause/readiness eligibility; latest params replace earlier pending params.

Once actual holder lifetime closes, clear its unserved demand along with transient invocation/control
work. Terminal/fresh reset must not revive that old request. Applied state and node-scoped external
pause locks survive under the separate accepted rules; preservation of locks does not create demand.
New lifetime starts quiet, subscription gives START only for quiet-PULL, and a later RESUME merely
releases remaining locks. With no fresh PULL, no service fn or replay of old params is manufactured.
A new PULL is a new request governed by the current lifetime's gates.

Trace: L1 held by A, pause lockL; receive PULL params1 then params2 -> retain only2. Last A leaves with
no retaining owner -> close L1, discard owed2, preserve lockL. B later subscribes -> L2, START-only,
no owed request. RESUME lockL -> unlock, remain quiet. New PULL params3 -> service under current
eligibility with ctx.pull=3; output follows helper policy, not guaranteed DATA/ACK. If another owner
had kept L1 alive, owed2 would instead remain eligible after final unlock. No historic request FIFO,
automatic cross-lifetime reissue, correlation field, completion ACK or new message is proposed.

If fn service has already begun, the demand is consumed (ctx.pull belongs to that invocation), not
still owed. Closure's old-ctx revocation and helper resource cleanup apply; dropping demand metadata
is not proof external execution was cancelled or business obligations disappeared. Failures and
DIRTY obligations remain handled by their separate operation/output owners, not a PULL-cancellation
RESOLVED fabricated as an ACK. A user requiring durable demand/retry can keep explicit business facts
and arrange a fresh request under its own lifecycle/recovery policy.

Rules/current evidence: R-pull@1 and R-up-routing@1 lack activated_by; D269/D272/D278 explain current
latest-slot, quiet and service/output distinctions, without silently activating these drafts. Current
TS nodeDeactivate explicitly clears demandOwed; nodeOnDemand overwrites that one slot while blocked;
nodeDeliverPullDemand consumes it before invoking the service. The old baseline also clears pause
locks, which conflicts with the newly accepted lock direction and requires amendment. This source
inspection is not a test of combined future behavior. Pending-PULL input/buffer drain service ordering
remains an independently open historical question; this lifetime choice does not settle it.

Separate next entrance to review: a PULL received by a holder with no active lifetime (including a
pre-subscription pause). Define admission/activation rather than creating a silent durable demand slot
outside lifetime ownership. This question is not answered by active-lifetime last-off cancellation.
No runtime/model/conformance/Rules/decision-ledger edits, no new test or GitHub push.

### User accepts holder-lifetime ownership of owed PULL (2026-10-12)

User agrees with the preceding recommendation, then asks for the inactive-holder entrance. Accepted
review direction: retain only the latest unserved demand within the holder's current active lifetime;
one requester's departure does not cancel it while another owner keeps that lifetime alive; actual
holder close discards it. Fresh activation does not inherit demand, even when node-scoped pause locks
survive. Begun service, old-ctx revocation and external business cancellation remain distinct. This
acceptance does not activate R-pull, amend normative authority, or settle inactive admission, callback
control scheduling, or resumeAll drain/service ordering.

### Inactive-holder PULL entrance audit and recommendation (2026-10-12; pending acceptance)

Rules candidate — clarify the inactive admission boundary in draft R-pull@1/R-up-routing@1 and its
interaction with the accepted holder-lifetime demand ownership and setup-before-fn gate. D269/D272/D278
justify latest-slot demand, quiet behavior and unchanged-input invocation, but do not establish an
owner or duration for an implicit PULL-created lifetime. These draft rules still lack activated_by.

Recommend: a matching holder with no active lifetime consumes/drops PULL locally; it neither starts
fn nor banks a request for an unspecified future subscription. No synthetic DATA/RESOLVED/ERROR ACK,
no automatic lifetime or durable demand slot. This is a proposed choice, not existing TS behavior.
An active lifetime whose activation/setup has not yet completed is different: it has an owner, so a
demand may occupy its latest owed slot, but service must wait for successful setup and normal gates.
Abandoned setup cannot service that request; it does not become an autonomous retry. Existing closing,
terminal and permanent-release admission rules still apply; this proposal does not silently replace
their failure behavior with inactive silence.

An inactive intermediate node may still forward PULL through declared topology under the accepted
node.up routing model. Test the matching holder's lifetime at the destination, not every intermediary's
subscriber count. A holder explicitly retained by a graph is active even with no business observer;
the existing graph.retain(holder) API establishes a subscription/owner and returns a release handle.
That owner must eventually release it. Keeping only the bus runtime active does not retain every
snapshot projection that depends on it.

Alternatives considered: implicitly start a PULL-owned lifetime, or retain a node-scoped preactivation
demand. Both require another ownership boundary: when to close after silence/async output, who cleans
up, whether a paused holder remains alive indefinitely, and whether demand survives later activation.
They are not implied by request routing. Prefer explicit retention/subscription rather than adding
that boundary without an identified need for implicit lifetime ownership.

Work — current TS evidence at unchanged worktree7a26 baseline dafc5ae5:
- Standard pull.test.ts service scenarios subscribe via collect before PULL; this alone does not
  establish that all existing consumers require an active holder.
- A bounded inline diagnostic showed a depless cold holder invokes fn with ctx.pull.params, writes
  cache7 and registers cleanup while activated=false and subscriberCount=0. That cleanup ran once only
  after a later subscription and last-off. A second cold paused holder banked pre-life params and
  serviced them after later subscribe/RESUME. Current nodeCanFireDemand has no active-lifetime gate.
- A real consumer exists in messaging.test.ts's strict unknown-topic test: bus.catalog().snapshot
  receives PULL without its own subscription, then cache is inspected. The catalog factory does not
  retain its snapshot; only the bus runtime is retained. A separate inline diagnostic asserted the
  snapshot was inactive with zero subscribers before and after PULL, and had a populated orders
  catalog cache afterward. Exit0. Thus the proposed inactive policy changes a real current usage; do
  not describe it as merely repairing an untested corner or preserving existing consumer behavior.
- If this direction is accepted, that headless catalog use must explicitly acquire/release a snapshot
  owner (or its helper must declare that ownership). The existing graph.retain implementation supports
  the mechanism. No factory-retention change or public API redesign is locked by this recommendation.

No package runtime edit, normative Rules/formal/conformance amendment, D#, new saved probe, commit or
GitHub push. The inactive policy awaits user acceptance; its cost and current-runtime difference must
be included in the walkthrough answer.

### User accepts inactive-holder PULL admission direction (2026-10-12)

User agrees with the preceding inactive-holder recommendation and selects QA-6 next. A matching
holder without an active lifetime consumes/drops demand without fn invocation or pre-life banking;
an owned lifetime awaiting successful setup is distinct. Explicit graph retention permits headless
service. Inactive intermediaries may route across declared topology. The real cold catalog usage
requires an explicit snapshot owner under this direction; no implementation or helper ownership
change was made. Closing/terminal/released permissions, deferred routing identities and setup gates
remain separately qualified. Accepted review direction, not normative rule activation or a D#.

### QA-6 observer-origin control scheduling proposal (2026-10-12; pending acceptance)

Rules candidates — reconcile activated R-two-phase@1/R-diamond@1/R-wave-boundary@1 with the accepted
ordinary intact-array delivery, callback output FIFO and deferred-control entrance. R-reentrancy@1
still rejects illegal synchronous raw-fn feedback. Draft R-pull@1/R-up-routing@1/R-pause-modes@1 do
not independently activate an observer scheduling policy. Activated R-teardown-terminal-relay@1
preserves terminal TEARDOWN relay, not automatic subscription removal or source destruction.

Recommend queuing RESUME, INVALIDATE, PULL and TEARDOWN requests issued from an ordinary subscription
observer while a graph propagation/fanout is in progress. Use the same graph-local boundary request
ordering as observer-origin external output; avoid a second control-priority queue. Outside an active
flow there is no reason to add latency: these requests execute synchronously under normal admission.
This classification is not a blanket queue for node fns, derived/effect evaluation, internal input
reducers, invalidation/cleanup hooks or all ctx.up calls. Those entrances retain their own permissions
and D37 feedback rules; explicitly deferred fn demand remains its existing separate surface.

Effects motivating classification:
- RESUME releases a lock and can drain multiple buffered arrays, run a postponed fn, or service owed
  PULL. Queue the request, including lock release; do not delete the lock immediately and merely defer
  delivery, which would open other fn gates in the interrupted wave. RESUME creates no new demand.
- INVALIDATE can clear retained cache, call onInvalidate and send a settling cascade. Defer these
  effects together, rather than expose cleared cache to half of an in-progress fanout. Keep invalidation
  idempotency/hook conditions and normal routing; queueing does not turn it into a new fn trigger.
- PULL can invoke a holder even with unchanged inputs and can emit a new wave. Defer its service/admission
  effects to the boundary, preserving holder-lifetime identity: an old request must not retarget a fresh
  holder lifetime after close/reset. A blocked accepted request enters the holder's single latest slot;
  it does not block later queued RESUME from being processed. Separate serviceable PULLs still each
  invoke once; do not deduplicate all queued demands or conflate this FIFO with latest-owed coalescing.
- TEARDOWN follows the same order, with no emergency bypass merely because it is terminal-related.
  Up-going TEARDOWN currently forwards and drops at a depless terminus (graphrefly:D38; draft
  R-up-at-source@1); down-going TEARDOWN follows its terminal synthesis/relay policy. Neither means
  unsubscribe, automatic cleanup, forced upstream restart, nor ownership of source cancellation.

Boundary proposal: finish the entire interrupted ordinary wave's internal propagation and eligible
fanout before executing these requests, not merely the callback or one source-to-sink branch. Each
executed request's resulting propagation must complete before the next queued request runs. The
outer synchronous operation drains executable work before returning/reporting collected failures;
no Promise/microtask or async wave core. An open batch is not committed merely to service a queued
control; batch/control ordering remains governed by its separate commit/admission contract and still
needs the explicit QA-18 matrix. Waiting for every pending async result in the graph is not required.

Retain stable whole-array structure and the already reviewed captured connection/ctx identities;
execute a deferred control array as a unit under ordinary within-array protocol ordering, not a set of
independent priority jobs. Revalidate target/lifetime/output permissions at execution. Queue admission
does not promise the operation will still be valid at execution; actual invalid targets, terminal seals
and retired ctx follow their existing classified failure/drop behavior. A queued protocol TEARDOWN
must not be broadened into a lifecycle-close mechanism. Exact lowering/record layout is not locked.

Important limitation: deferring RESUME removes old-buffer delivery from the middle of another wave;
it does not itself erase old resumeAll occurrences. If the right leg has buffered1 and2 while the
left has current2, a later FIFO drain can still produce join pairs [2,1] then[2,2] as distinct resumed
waves under the accepted replay policy. Do not promise only[2,2], claim queueing repairs all dirty-debt
accounting, or mark QA-9 closed. Normalized prefixes, per-array versus per-debt DIRTY and eligibility
of each resumed array require that separate reconciliation. Each replayed array must finish before
processing observer-origin work that would otherwise interrupt its propagation.

Unresolved interacting exception: existing observer PAUSE-immediate direction. Pure PAUSE only
closes a gate and was accepted as immediate, but simple per-message immediate-PAUSE/deferred-RESUME
can reorder an authored mixed array or separate same-lock calls: queued RESUME(L), then immediate
PAUSE(L), followed by the earlier RESUME release. We cannot simultaneously promise universal issue
order and that exception. Recommend whole-array deferral for an array containing any of the four
deferred types, rather than splitting its PAUSE out; pure PAUSE versus earlier queued RESUME ordering
still requires an explicit choice. Do not invent lock generations, a priority overlay, or silently
change the accepted PAUSE contract to resolve it. This is the next bounded QA-6 question, not an
unmentioned implementation detail. Pending controls, output FIFO and resumeAll drain scheduling need
one shared boundary/owner design after the semantics settle.

Work evidence: re-read current nodeUp/pauseRelease/onResume/onDemand/invalidate/down-TEARDOWN paths;
public node.up enters a wave but currently runs _up immediately. Re-ran the saved
observer-resume-diamond.ts diagnostic from unchanged TS worktree7a26: exit0, traces
[[0,0],[2,1],[2,2]]. This verifies the baseline interleaving, not a test of the proposed scheduler.
No runtime, normative Rules, formal/conformance, decision-ledger, saved probe or GitHub change.
Recommendation awaits acceptance; QA-6 is not fully closed by the four-message table.

### User accepts four observer-origin controls at the boundary (2026-10-13)

User agrees that RESUME, INVALIDATE, PULL and TEARDOWN issued from subscription observers queue,
then asks whether PAUSE should retain immediate behavior or also queue. Record acceptance of the
four-message direction above, including synchronous processing, whole-array admission, ordinary
terminal/routing permissions and no conversion of TEARDOWN to unsubscribe. The PAUSE exception,
batch/initialization matrix, dirty-debt/replayed-array interaction and scheduler lowering remain open.
This is accepted walkthrough direction only; no normative amendment or implementation authorization.

### QA-6 PAUSE comparison and unified-boundary recommendation (2026-10-13; pending acceptance)

Rules candidate — refine the earlier immediate observer-PAUSE review direction, preserving activated
R-wave-boundary@1/R-two-phase@1/R-diamond@1 and the agreed default versus resumeAll distinction.
Recommend queuing observer-origin PAUSE on the same request boundary as the other four controls,
without modifying the pause lockset at admission. Outside in-progress propagation/initialization,
lawful PAUSE still applies synchronously before its call returns. Internal protocol/input handling,
raw fn control/feedback, cleanup hooks and deliberately deferred fn surfaces are not indiscriminately
converted to observer requests. This is a material refinement, not already accepted or current TS code.

Comparison:
- Immediate observer PAUSE can prevent a not-yet-entered sibling fn in the current wave; it gives
  earlier gating, but the result can depend on whether the observer runs before that sibling's input
  processing. It cannot undo an already-started fn or cancel registered external work. Keeping it
  beside deferred RESUME also permits a later PAUSE to execute before an earlier unlock, including
  different same-tier messages in one array. A priority exception must be explicitly documented.
- Queued observer PAUSE preserves issue order of accepted requests and whole-array boundaries without
  a pure-PAUSE/mixed-array split. It can allow additional computation/effects within the interrupted
  current wave before the pause applies. That is the principal behavioral cost. A caller requiring
  those invocations not to start must PAUSE before driving that wave, or express its business gate
  in its own fn; this is not automatic cancellation.
- Immediate speculative gating plus later FIFO lock application would require an overlay/pending
  gate or lock-generation/cancellation policy. Do not introduce it to recover both promises without
  a demonstrated consumer need. Prefer one lockset mutator and the already required request queue.

Ordered trace: initially lockL is held; one callback submits separate RESUME(L), then PAUSE(L).
At the boundary, RESUME executes then PAUSE, so the final lock is held. If RESUME lawfully services
an existing owed PULL or runs a delayed fn before the later PAUSE, that work is not retroactively
cancelled. FIFO is ordered effects, not transaction-wide lookahead/coalescing. The reverse PAUSE then
RESUME ends unlocked. Two same-tier messages in a single array keep their legal within-array order;
no message from that array is pulled out for immediate execution. Actual issue order still depends
on which observer issued first; this proposal removes mid-wave control effects, not all application
dependence on observer execution order.

ResumeAll example: buffered waveW1=[DATA20,DATA21], W2=[DATA30]. While W1 is delivered, its observer
requests PAUSE(L). Finish W1's entire reachable propagation and valid fanout, process pending observer
requests at that wave boundary, then check eligibility before starting W2. W2 remains buffered.
RESUME therefore releases locks/enables a drain owner; it must not run an uninterruptible multi-wave
buffer sweep ahead of controls issued during the first replayed wave. Clarify the preceding proposal's
"finish a request's resulting propagation": finish the current individual wave, not every future
buffered wave enabled by that request. No microtask/Promise is implied; all eligible continuation and
request processing remains in the owning synchronous operation. Existing old-buffer-before-new-output
direction remains: newly requested output cannot overtake old undelivered buffer entries merely because
its request was applied at an intervening boundary. Exact runner/queue lowering remains for design.

Ordinary default-pause example: source wave23 is already propagating; an observer requests PAUSE(N).
Any N invocation legitimately reached by that wave may complete before its boundary; then PAUSE
applies and later wave30 cannot start a new N invocation while the lock remains. Already-started async
callbacks still follow the accepted output/lifetime policy. Status/lock reads inside the issuing
callback describe applied facts, so they do not yet report the submitted PAUSE as applied.

Initialization qualification: a PAUSE authored during START is queued under this proposed observer
policy, not an immediate means of stopping an activation that precedes request draining. The earlier
initial-array -> eligible activation -> observer requests ordering therefore may allow the first fn
to run. Pre-subscription PAUSE still applies before initialization and blocks first invocation under
the accepted gate. Do not silently reorder initial queued output ahead of activation or claim this
closes QA-7; its deferred activation/output/terminal matrix remains separately open. Open batch commit,
PULL admission lifetime binding, terminal fanout and per-debt DIRTY remain bounded follow-ups.

Work: re-read the accepted re-pause/finish-current-array notes and current boundary.ts. Baseline uses
outermost call-stack exit for its existing deferred rewire queue and nodeOnResume loops through its
buffer synchronously; neither proves the proposed between-replayed-wave observer boundary exists.
No new probe/runtime test was run, no runtime/Rules/formal/conformance/owner ledger changed, no D#,
commit or push. User acceptance is still required for this refinement of observer PAUSE timing.

### User accepts queued observer PAUSE; QA-6 cursor moves to QA-8 (2026-10-13)

User agrees with unified queuing of observer-origin PAUSE and asks whether anything else is needed
for QA-6 before proceeding to QA-8. Accepted review direction: all five selected control kinds
(PAUSE, RESUME, INVALIDATE, PULL, TEARDOWN) defer applied effects during observer-origin reentry,
preserve request/array ordering, and execute synchronously at the relevant whole-wave boundary.
This refines the preceding immediate-PAUSE review direction. No lock mutation at queue admission;
no extra speculative gate. Between resumeAll replayed arrays, process eligible observer requests and
recheck continuation so PAUSE can stop the next array after the current one finishes. Current-wave
fn/effects may run before observer PAUSE applies; pre-wave/pre-subscription PAUSE remains available.

Do not label this a complete implementation or close every interacting QA: DIRTY prefix/debt and
old-buffer settlement remain QA-9; START/prepaused deferred activation/output/terminal remain QA-7;
batch commit/rollback and control interaction remain QA-18; queued holder/ctx/connection identities
retain their earlier lifetime requirements. Explicit observer-authored DIRTY is not silently covered
by the five-message choice. Scheduler layout and the complete caller-source permission matrix are
still for unified design. No additional immediate-versus-queued fork for these five messages is
needed to begin QA-8. No runtime/normative/D# change or implementation authorization.

### QA-8 automatic terminal versus deferred fn recommendation (2026-10-13; pending acceptance)

Rules candidates — qualify activated R-terminal@1/R-deps-terminal@1/R-first-run-gate@1 and
R-terminal-settles-dirty@1 for the accepted grouped terminal-policy replacement and deferred
invocation cancellation. Existing per-kind options are review direction, not implemented/current
normative API. Reconcile September28 same-wave DATA preservation and September29 independent
complete:all after error:input handling: neither bypasses PAUSE/readiness/demand nor promises a
deferred fn eventually runs after this node automatically becomes terminal.

Recommendation: when an automatic COMPLETE/ERROR lawfully applies to this node, seal output and
cancel not-yet-started deferred fn invocations from that output epoch, including pending PAUSE-
blocked DATA/terminal-input processing and unserved demand. A later RESUME releases its node-scoped
locks but cannot start those cancelled calls. Do not run new effects after downstream terminal,
wait indefinitely for RESUME, or force fn through a blocked first-input gate. This cancellation is
not actual lifecycle close, automatic cleanup, state clearing, lock cancellation, nor cancellation
of external work already launched by an earlier invocation. Queued topology/control retains its
separately qualified owner/terminal permissions; do not erase all queued work indiscriminately.

Terminal timing here means no waiting for PAUSE/readiness at the normal terminal processing point;
it does not grant a callback-origin terminal request priority over its queue, bypass normal batch
handling, or invalidate the already agreed terminal/output request order.

Concrete matrix under applied default PAUSE:
- Defaults complete:all/error:propagate, dep DATA23+COMPLETE and all deps terminal: fn23 remains
  blocked; automatic COMPLETE applies; RESUME does not run fn23. Likewise propagated ERROR seals
  immediately under its normal processing rules. This accepts the missed paused effect/last value.
- complete:input (with suitable error policy), dep DATA23+COMPLETE: COMPLETE is retained as fn input,
  not automatically emitted as this node's COMPLETE. On resume, successful setup and normal gates
  permit the combined fn invocation; operator decides its final output and completion. No guarantee
  that another propagated ERROR or lifecycle close cannot preempt it.
- complete:all/error:input, ERROR arrives while another dep remains live: no all-terminal completion
  yet; retain terminal-input work under ordinary gates for eligible processing.
- The same combination, but all deps are now terminal and ERROR processing is PAUSE/first-value/
  demand-blocked: automatic COMPLETE applies; cancel blocked input processing. error:input offers
  gated handling, not guaranteed delivery or immunity from the other terminal kind's policy.
- complete:input/error:input: fn owns both kinds. Terminal input satisfies only that dependency's
  per-kind first-input condition; another still-live dependency without DATA can still block
  partial:false. partial:true only removes that first completeness gate, not outstanding DIRTY,
  PAUSE, setup or quiet-demand gates. Under complete:all/error:input above, a no-value COMPLETE
  does not satisfy that dependency's fn-input gate. Do not introduce a universal terminal bypass.

In a serviceable same-wave DATA/terminal case, retain DATA occurrences and allow the single combined
fn invocation as previously accepted, then apply the appropriate automatic completion if still live.
If fn can start now, complete:all does not preempt that lawful synchronous processing; if it cannot
start now, automatic terminal does not owe it future processing. Async output from an already-started
fn is not awaited by complete:all. Operators needing delayed recovery/final accumulation must own
COMPLETE with complete:input and emit their own terminal when appropriate. Value-only effect sugar
does not thereby gain raw terminal metadata; a terminal-owning operator/helper needs the suitable
raw programming surface. This is no new universal guarantee that every terminal-input callback runs.

Tradeoff: default terminal may intentionally skip the final paused value or delegated ERROR. In
return, no effects start after node output is final and no unbounded automatic terminal wait needs
another pending-completion state. Explicit terminal ownership permits delayed final processing but
must release locks/meet readiness and eventually complete or remain open by its own policy. An
empty/no-value first-input combination can remain unserviceable; do not falsely promise resolution.

Work evidence: re-read the relevant accepted policy sections and current node-input-runtime terminal
branch. Re-ran paused-effect-terminal.ts on unchanged TS worktree7a26: exit0; default effects[0],
completed before RESUME, observed START/DIRTY/COMPLETE; legacy delegated mode effects[0,23], observed
START/DIRTY/RESOLVED and no automatic COMPLETE. Baseline blanket terminalAsRealInput bypasses the
auto-complete branch, so this probe does NOT validate the proposed grouped complete:all/error:input
matrix. Those future combinations need conformance/formal tests after semantic acceptance. No new
runtime edit, normative Rule/formal/conformance/owner-ledger edit, D#, commit or push. Recommendation
awaits user acceptance; no blanket claim that QA-8 was an unconditional existing-rule contradiction.

### User accepts automatic terminal cancellation of unstarted fn; moves to QA-9 (2026-10-14)

User agrees with the QA-8 recommendation and asks to continue. Accepted review direction: a lawful
automatic terminal seals this output epoch and cancels unstarted paused/readiness/demand-blocked
fn work; later RESUME cannot run it. Already-started external work, lifecycle cleanup and node-scoped
locks remain separate. Terminal input is gated handling rather than guaranteed eventual delivery;
an operator needing deferred final processing must own COMPLETE and meet its invocation gates.
Serviceable same-wave DATA/terminal keeps the previously accepted combined invocation behavior.
The proposed grouped policy matrix is not implemented by the legacy blanket terminalAsRealInput
branch; formal/conformance/runtime reconciliation remains required. No new D# or normative change.

### QA-9 DIRTY array prefix versus dirty membership proposal (2026-10-14; pending acceptance)

Rules candidates — amend activated R-dirty-before-data@1's "node is not already dirty" synthesis
condition for the agreed intact observer arrays; reconcile activated R-two-phase@1's first-compute
activation exemption, R-wave-boundary@1, R-diamond@1 and R-resolved-undirty@1. Retain activated
R-push-subscribe@1's initialization role, with the separately accepted snapshot ordering revision.
Draft R-same-wave-merge@1 is not authority for silently collapsing arbitrary authored messages.

Recommend separating the observable array prefix from pending-dependency membership:
- Every live output array carrying DATA or RESOLVED has a DIRTY notification prefix, whether or not
  the origin previously announced an outstanding change. Preserve all DATA occurrences and their
  array boundary. Automatically add one prefix if absent; an existing prefix does not need another
  automatic copy. Pure control/INVALIDATE/terminal arrays are not given a DIRTY solely by this rule.
- The receiver tracks whether each dependency is dirty, not a count of DIRTY arrivals. On clean->dirty
  add that dependency to pending; another DIRTY while it is already dirty changes no membership.
  A lawful settlement removes it once. After it has settled, a later distinct wave's DIRTY starts a
  new pending interval. No queue of one settlement debt per repeated prefix or extra RESOLVED ACK.
- Prefix packaging does not authorize a second operational notification pass after settlement has
  begun. The graph still completes the required internal DIRTY prepass before value processing.
  A complete observer array may include the notification already processed by internal scheduling;
  do not feed that same logical notification into internal input reduction a second time. Exact
  delivery-phase metadata/representation remains for unified design, without a new public message.
- One multi-DATA array releases its dependency membership once and remains processed as a complete
  array before testing invocation gates; prefixing must not trigger fn after its first DATA tuple.

Concrete example: early authored array [[DIRTY]] sets A's pending membership. Later array
[[DIRTY],[DATA,23],[DATA,23],[COMPLETE]] retains both value occurrences. Its prefix leaves already-dirty
A's membership unchanged; the settlement/terminal handling removes it once under normal gates and
policies. Do not require two RESOLVEDs merely because two DIRTY tuples were observed over time.
DIRTY observations are protocol notification, not DATA occurrence count. This does not settle the
general outstanding-async-result fact in QA-5 or imply all standalone DIRTY must settle synchronously.

Proposed cases:
- Ordinary immediate value output: complete DIRTY+DATA/RESOLVED array after the internal prepass.
- Async/delayed result after early standalone DIRTY: its later value array still carries a prefix;
  early and later arrays are not retrospectively stitched together.
- Batch commit: retain early public notification; committed value array also has its prefix. Early
  and repeated commit prefix do not add another pending membership. Rollback RESOLVED uses its normal
  live prefix while settling the original announced change; no fabricated DATA.
- resumeAll: each actually delivered buffered value array has its own prefix. Once the first array
  settles, the second needs its own clean->dirty transition; it cannot rely on the first array's debt.
  Preserve their FIFO boundaries and the newly accepted observer-control boundary between arrays.
- First compute/source fn value output after successful activation: recommend the same live prefix,
  removing the first-output exemption in R-two-phase@1. This is a newly proposed choice, not an
  inference that the exemption was already retired. It simplifies observable live outputs at the
  cost of an additional initial notification. A silent initial fn still needs no synthetic value
  or DIRTY just because activation occurred.
- Subscription initialization/cache/replay: distinct snapshot path, not a live output by that fn.
  Settled cached value stays START+DATA; stale cached value stays START+DATA+DIRTY; empty but actually
  waiting stays START+DIRTY under active R-push-subscribe, to be explicitly catalogued in QA-10.
  Quiet-PULL initialization remains START only. Do not normalize/reorder these snapshots with the
  live-prefix rule or invent pending membership from cache absence alone.

Important remaining boundary: queued RESUME prevents insertion of old buffered output into an
unfinished live wave, but idempotent dirty membership alone does not prove every old-buffer/current-
debt interaction correct. Need conformance of the resumed-array prepass/settlement scheduling with
the accepted FIFO replay and waiting snapshot. A published DIRTY prefix is not proof that an old
settlement belongs to a newer obligation. Do not claim all QA-6/QA-9 interactions fixed by framing.
Explicit authored duplicate DIRTY normalization and observer-origin standalone DIRTY admission need
separate wording; this proposal does not silently remove the raw author's accepted DIRTY capability.

Tradeoff: an observer can see repeated DIRTY notifications before one settlement, as intentionally
allowed by repeated authored early notifications plus a later full array. The runtime does not
promise one visible DIRTY per value or per unfinished invocation. It does promise no debt multiplication
from repeated notification while the dependency remains dirty. No additional per-DIRTY debt queue,
value-equality substitution, public wave-id API or global dirty counter is proposed.

Work evidence: inspected active rule rows and current nodeDown's emittedDirtyThisWave guard plus
nodeReceiveFromDep's per-dependency boolean/pending increment/decrement. Baseline confirms the
membership distinction but does not implement the proposed whole-array framing or uniform first
activation prefix. No new probe/test or normative/runtime/ledger edit, D#, commit or push. All new
prefix and activation choices await acceptance; this is not completed implementation/conformance.

### User accepts QA-9 live prefixes and idempotent dirty membership (2026-10-14)

User agrees with the preceding recommendation and asks to continue. Accepted review direction:
each live DATA/RESOLVED output array has a DIRTY prefix even after early notification; ordinary,
async result, batch commit and each resumeAll replayed array share that contract. Prefix framing
does not multiply an already-dirty dependency's pending membership or duplicate the internal
notification prepass. Preserve DATA occurrences and complete-array invocation gates. First
activation fn value output also takes the live prefix, refining activated R-two-phase@1's exemption;
subscription initialization/cache/replay remains a distinct snapshot path with its accepted ordering.
This acceptance requires future normative/formal/conformance reconciliation, not silent rule
activation. Pure INVALIDATE/terminal does not gain DIRTY solely from the value-array rule. Authored
duplicate DIRTY normalization, observer-origin standalone DIRTY and old buffered obligations remain
qualified follow-ups; no universal debt model or new public wave ID was approved. No implementation.

### QA-10 waiting snapshot and setup barrier reconciliation (2026-10-14)

> Setup-barrier interpretation reopened by the user's next clarification and consumer audit below.
> The waiting-snapshot catalogue is separate; this entry is not final authority for changing partial.

Rules: activated R-push-subscribe@1 already states START+DIRTY for dirty-without-value. The preceding
initial-array catalogue's "START alone if empty" was incomplete, not a new user preference overriding
that rule. Reconcile it with the accepted intact snapshot and START+DATA+DIRTY ordering. Activated
R-first-run-gate@1's partial flag concerns first input completeness; the user separately accepted
successful initial setup as a prerequisite on October10. Do not conflate setup success, cache absence,
upstream input pending, and this node's outstanding announced downstream settlement.

Recommended explicit snapshot catalogue (current output epoch, before the new callback):
- Ordinary empty cache with no announced outstanding downstream DIRTY: [[START]].
- Ordinary empty cache with announced outstanding downstream DIRTY: [[START],[DIRTY]].
- Ordinary populated, settled output: [[START],[DATA,value]] (configured replay is its existing
  distinct initial DATA sequence).
- Ordinary populated output with announced outstanding DIRTY: [[START],[DATA,value],[DIRTY]].
- Quiet PULL: [[START]] under the accepted quiet subscription precedence, irrespective of retained
  cache or absorbed upstream changes; do not manufacture downstream DIRTY from upstream pending.
Terminal late-subscription admission/reset remains QA-11 and is not bypassed by this table.

No DATA(undefined) is invented for missing cache. Initialize the new input registration from the
whole snapshot before eligibility checks. Its terminal/dirty facts are snapshot facts, not a new
occurrence from another fn. Missing cache by itself does not announce pending output. Conversely,
actual outstanding notification cannot be hidden merely because no value has arrived yet.

Setup barrier reaffirmation: while establishing any of this node's declared initial dependency
subscriptions, retain legitimate input projections but do not invoke its fn. Only when that setup
finishes successfully evaluate the normal dirty/pause/first-input/demand/terminal gates. A zero
pending count, activated=true or a full collection of acquired releases does not prove setup success.
Do not mark unwired dependencies artificially DIRTY or demand matching fabricated RESOLVEDs; use the
already approved lifecycle-owned setup fact, not another per-dependency pending counter. Outward
setup failure retains its prior failed-attempt/cleanup behavior. A normally handled protocol ERROR
still follows terminal policy and is not automatically an outward connection-setup failure.

Trace: D declares B,C with partial:true. B's snapshot supplies10; C has no retained value but an
outstanding announcement. B's arrival during D's setup does not invoke D. C's START+DIRTY establishes
its pending membership. Successful setup ends but D still cannot invoke, because pending>0. Once C
lawfully settles with DATA20, D can run with (10,20) under the other gates. If C instead has no value
and no DIRTY, and both subscriptions finish successfully, partial:true may run with (10,undefined).
Later C DATA20 may produce a second invocation as a later wave; this is permitted partial behavior,
not evidence of the premature partial-wiring bug. partial:false instead continues waiting for C's
first admissible input. RESOLVED may clear DIRTY without supplying first DATA; partial:false then
still waits, whereas partial:true can run with an undefined value after the other gates permit.

This consolidates existing active/review choices and fills the snapshot catalogue omission; it adds
no public partial mode, synthetic dependency notification, faulted status or global startup barrier.
The barrier concerns this node's own completed setup, not every node in the graph or future async
source readiness. Existing setup-wait input occurrence retention remains in force.

Work evidence: inspected current _subscribeOwned and nodeMaybeRun/nodeTryRun. A bounded inline TS
probe on unchanged worktree7a26 created an active empty raw node, announced standalone DIRTY, then
subscribed a second observer. Assertions passed (exit0): cache absent, observed tuples START then
DIRTY. Baseline still invokes callbacks per tuple; this verifies snapshot contents, not the accepted
future one-array delivery. Prior setup-failure diagnostics already establish the separate missing
initial wiring barrier; no repeat or future conformance claim. No runtime, normative Rules, formal,
conformance, owner ledger, saved probe, D#, commit or push. Present this reconciliation for walkthrough
confirmation, without asking the user to reapprove the previously accepted setup prerequisite.

### User clarifies early partial intent; concrete consumer audit (2026-10-14)

User explicitly says the intended partial:true behavior permits B DATA to invoke D before C's
subscription has been established, and asks whether the codebase has that need. This is more specific
than merely allowing C's first DATA to be absent. Investigate before claiming the universal successful-
setup gate is harmless or that all mid-wiring fn invocation is a bug. Earlier acceptance of the gate
is preserved as history, with its scope reopened; no silent normative replacement is made here.

Rules: current activated R-first-run-gate@1 removes the first-value gate under partial:true and does
not explicitly establish a universal successful-wiring prerequisite. Current R-two-phase/R-diamond
still apply to known in-wave pending notifications. The proposed setup-success prerequisite and
single accumulated initial invocation were walkthrough choices, not existing normative behavior.
The prior inference that initial-phase fn invocation is inherently erroneous was too broad.

Work — verified unchanged TS dafc5ae5 behavior:
- nodeActivate subscribes declared deps in order; nodeMaybeRun/nodeTryRun have no initial-wiring
  barrier. A bounded probe gives B cached10 and C a cold source that emits20 on startup. D partial:true
  invokes with (10,undefined) while C subscriberCount=0, then C starts, then D invokes with (10,20).
  Thus current behavior is exactly the stronger early-subscription semantics the user describes,
  not just a connected-but-silent C.
- Existing core.test.ts case "partial:true fires without waiting for all deps" uses cached A plus
  uncached B and asserts output-1. By itself that post-subscribe assertion does not distinguish early
  invocation from a later-after-setup invocation, so do not overstate its coverage.
- Real operator takeUntil uses partial:true and checks notifier DATA before forwarding source DATA
  in the same invocation. With source cached23 and notifier cachedtrue, the current live runtime
  invokes first when notifier subscriberCount=0, outputs DATA23, then invokes on notifier input and
  emits COMPLETE. Assertions passed. The same existing operator body given both retained inputs
  together emits only COMPLETE. This body-only comparison proves that the previously proposed
  setup wait + single coalesced invocation changes observable output; it is not a complete runtime
  implementation/test of every possible delayed scheduling or ordered replay scheme.
- race's existing fromIter test expects the first subscribed source to win, and combinator source
  comments explicitly recover event-driven partial behavior with queues/winner/phase state. merge,
  buffer, race and takeUntil use partial:true; withLatestFrom deliberately does not, with an explicit
  comment that early primary invocation before secondary input drops the initial pair. These are
  distinct input/scheduling needs. The presence of partial:true in many one-dependency pull/projector
  callers alone does not prove reliance on multi-dependency wiring interleaving.
- Relevant existing suites executed from packages/ts: vitest run src/__tests__/core.test.ts
  src/__tests__/combinators.test.ts src/__tests__/operators.test.ts --reporter=dot. Exit0: 3 files,
  96 tests passed, no skipped tests. These validate the baseline, not the proposed redesign.

Saved the bounded diagnostic as protocol-reconciliation-probes/partial-during-initial-wiring.ts;
ran that saved copy from TS checkout with tsx: exit0, both traces and body-only comparison match
the assertions above. TS git status --short remains empty. No runtime file changed.

Decisions/reconciliation implications: user's premise is correct for current implementation and
there is concrete consumer-visible startup ordering, not merely unused permissiveness. Reopen the
universal setup-success gate and coalesced initial invocation recommendation; do not apply either
mechanically to partial:true. This does not select a new public mode, abandon ownership-before-
callbacks, permit continuing after an ended failed attempt, or waive pending DIRTY/PAUSE/terminal
gates. Need distinguish a still-progressing initial setup that permits partial evaluation from an
attempt already abandoned after an outward setup failure. Earlier already-produced effects cannot
be rolled back; future failure handling must describe that fact rather than assume fn never ran.
Known incomplete/waiting snapshot and diamond constraints still need composition with this intent.

Alternative delayed designs preserving each input delivery and original cross-dependency order
could potentially preserve some outputs, but require separate design; per-dependency buffers plus
one merged fn invocation are not equivalent. No such alternative is selected here. Recommend
reassessing the gate with the user using the concrete takeUntil trace, not minting a D# or changing
protocol/runtime in response to this investigation. No normative/formal/conformance edit or push.

### Partial startup versus abandoned setup: revised recommendation (2026-10-14; pending acceptance)

User acknowledges the consumer audit and asks to continue. This continues design review; it does
not authorize implementation or automatically replace the earlier accepted gate in normative rules.

Rules candidates: narrow/revise the October10 universal setup-success prerequisite in light of
the user's clarified intent and current consumer evidence. Keep activated R-first-run-gate@1's
partial first-value distinction, R-two-phase@1/R-diamond@1 for actual changed dependencies, and the
accepted PAUSE/demand/terminal gates. The node must still have a valid lifecycle/resource owner
before invoking fn. Acquiring release obligations precedes callbacks; it is not contingent on all
dependency subscriptions eventually succeeding.

Recommendation:
- While initial dependency subscriptions are still being established normally, allow partial:true
  to invoke on serviceable received input even if later declared deps have not been subscribed.
  Do not add an all-subscriptions-successfully-returned barrier or coalesce those initial invocations
  solely because they occur inside the same outer subscribe call. partial:false retains its initial
  admissible-input completeness gate; input completeness and a subscription call returning normally
  remain distinct facts. No new initial-setup success barrier is inferred for that mode either.
- An actually ended outward setup failure is different from still-progressing setup. Mark this
  attempt abandoned, stop future DATA-driven fn calls/accumulation under the previously accepted
  failed-consumer policy, and do not let later upstream DATA implicitly repair/retry it. Already
  acquired leases remain with surviving owners until normal close; cleanup is not optional just
  because startup failed. A normally handled protocol ERROR uses terminal policy, not an automatic
  structural setup-failure classification.
- Values/effects produced by lawful early invocations remain produced. Keep the resulting output
  cache subject to existing terminal/lifetime retention rules; report the actual outward failure
  without inventing a protocol ERROR/COMPLETE or rolling back downstream observers. A later eligible
  fresh activation is distinct; its inputs are not a replay of failed-attempt transient history.
- Setup completion itself does not replay already-consumed input or unconditionally manufacture
  another fn call. Only retained unconsumed serviceable input and the normal invocation reasons
  can do so. Missing future dependency values are not new DATA(undefined) occurrences.

Concrete proposed trace with a retained independent owner: D depends on B,C, partial:true. B cached10
causes a lawful early D invocation/output10 while C is not subscribed. C subsequently acquires a
release capability then throws outward during startup. Preserve output10 and release responsibility;
report C's startup failure. Later B DATA11 is not admitted to another D invocation on this abandoned
attempt. No automatic RESOLVED is owed merely because C threw: if output10 already settled D's only
announcement, there is nothing to balance. Existing balancing applies only to a separately outstanding
obligation with no remaining output to provide it, subject to batch/resumeAll/lifetime rules.

Explicit cost and QA-10 correction: the preceding QA-10 trace promising that D first runs only with
(10,20) cannot hold generally under early partial semantics. D may have already run with
(10,undefined) before C's START+DIRTY becomes known. Once C's real DIRTY is received, its outstanding
membership blocks subsequent invocation until settlement; partial does not bypass that known pending
condition. An unwired dependency is not automatically dirty, and two sequential dependency snapshot
deliveries must not be silently treated as one combined initial invocation. Initialization need not
present one all-dependencies-ready view. Preserve the real same-wave notification-before-settlement
contract; the startup diamond/reentrant subscription boundary must still be checked against it, rather
than claiming every double initial run is a bug or that all diamond protection has been waived.
This is a material scope correction for the review, not an implemented exception to activated rules.

Remaining next boundary: a lawful early fn may launch work that has not produced its result when a
later dependency setup fails. Retiring future input consumption is not automatically cancelling that
work, closing the lifecycle, revoking its ctx, or sealing output. Do not apply the previous failed-
setup RESOLVED balance while such work may still own an outstanding result. Whether to let it finish
or fence/cancel it needs an explicit follow-up; no new task generation or attempt-level revocation
mechanism is selected here. Keep this distinct from the already accepted automatic terminal
cancellation of not-yet-started calls and actual lifetime close revocation.

Work: read the existing failed-consumer/RESOLVED/lifecycle context records and current ctx.down
permission implementation. No new probe/test run; previous successful takeUntil/early-partial probe
and 96-test baseline receipt remain the evidence. No runtime, normative Rules/formal/conformance,
owner ledger, D#, commit or push. Recommendation awaits user confirmation before final consolidation.

### User accepts progressing partial versus abandoned setup distinction (2026-10-14)

User agrees with the revised recommendation and asks whether a result from earlier async work may
arrive after C's setup failure. Accepted walkthrough direction: preserve early partial evaluation
during normal setup, do not merge/replay its consumed inputs merely on setup completion, stop new
fn invocation/input accumulation after a conclusive outward failure, preserve actual earlier outputs
and owner-held release responsibilities. No automatic terminal/retry/rollback follows from the
outward failure. Initial complete-view/once-only promise is narrowed; actual DIRTY, PAUSE, terminal
and first-input constraints remain. This acceptance refines the October10 universal setup-success
gate but does not admit a normative revision or authorize runtime implementation. Already-started
work's result authority is the next separate proposal, not implied by that acceptance.

### Result after later dependency setup failure: recommendation (2026-10-14; pending acceptance)

Rules candidates — compose activated R-terminal@1/R-resolved-undirty@1/R-cleanup-hooks@1 with the
accepted lifecycle-identity/closing permissions and failed-attempt input policy. Current rules do
not explicitly specify an attempt-abandonment revocation boundary for an otherwise live ctx; neither
baseline permission checks nor the earlier universal gate can supply that missing requirement.

Recommend allowing output from a legitimately begun invocation despite a later dependency's outward
setup failure, provided the original holder lifecycle is still active/valid, its output epoch remains
open and the output satisfies ordinary protocol/pause/batch/queue rules. The invocation's retained
input view remains its own partial view; it does not acquire inputs from a future failed/restarted
attempt. No bypass to resumeAll buffering, terminal sealing or old-lifetime revocation is implied.

Concrete trace: D partial:true owns B,C. B10 lawfully starts work for input10. C setup then throws;
the caller receives the real operation failure and the attempt stops admitting new fn work. Another
valid owner retains D's lifetime. That earlier work later produces100 -> permit its ordinary live
DATA100 and update cache under normal delivery policy. Do not claim this DATA proves C connected or
startup recovered; the setup failure remains a separate diagnostic/operation fact. Later B11 or a
new demand cannot use the abandoned attempt to start another D invocation or silently repair it.

Conditions that instead prevent value delivery:
- Last valid owner has left and closure revokes the originating lifecycle: late ctx DATA is dropped
  under the already accepted invalid-ctx output policy, regardless of external work cancellation.
- D output has lawfully become COMPLETE/ERROR (possibly via C protocol ERROR before its outward
  throw): late DATA cannot reopen output. Eligible fresh reset does not restore old invocation
  permissions or redirect this old result into the new lifecycle/output epoch.
- Ordinary live-output admission or buffering constraints still apply. Same-lifetime INVALIDATE and
  helper-specific cancellation/replacement policies remain their separately reviewed contract;
  this proposal is no generic latest-request-wins or stale-business-result guarantee.

Rationale/tradeoffs:
- Allowing earlier results respects partial evaluation's legitimacy and the already accepted
  distinction between preventing new node-fn invocation and cancelling existing work. It reuses
  lifecycle/output permissions without creating setup failure as another ctx revocation reason.
  Cost: observers may receive an earlier result after the initiating subscribe operation reported
  startup failure, when an independent owner still retains the node. They must not interpret DATA
  as whole-graph successful startup. Earlier irreversible effects cannot be rolled back in either
  design; continuing result delivery is explicit rather than accidental recovery.
- Forbidding results gives a stronger "no new output after failed startup" promise. A check could
  reuse the existing abandoned-setup fact; it need not inherently add another stored flag or costly
  generation. Its substantive cost is the new revocation semantics: discard useful completed work,
  decide which ctx capabilities are revoked while cleanup ownership/lifetime remain live, and balance
  abandoned output obligations. Discarding output alone does not cancel I/O or external effects.
  Automatically closing the whole lifetime instead would require revisiting the independent retained
  owner policy, not just inserting a result check. No separate failure-cleanup API is proposed.

DIRTY qualification: setup failure can settle an obligation only when the relevant result really is
abandoned, not merely because an input subscription failed. If previously begun work is still the
legitimate producer for an outstanding result, do not synthesize failure RESOLVED ahead of it.
Its ordinary DATA/explicit no-occurrence completion or actual lifecycle/terminal handling must own
settlement under the corresponding policy. If no output is owed/announced, manufacture no balance.
This does not introduce one debt per task or rely on a Promise/pool label to infer result ownership.
The runtime-observable fact establishing "result still owed" and no-output/cancellation settlement
remains QA-5; current evidence does not justify a new task counter or an automatic async-silence
RESOLVED. A task that never resolves can still leave an obligation outstanding until owner policy
closes/cancels it; no new timeout or automatic recovery policy is selected.

Work — bounded diagnostic at unchanged TS worktree7a26 dafc5ae5: B cached10 starts D partial:true
in an async-labelled pool and captures a delayed completion callback with its input10. C startup
throws exact fault. Existing private owned-acquisition seam records the D release before callback
execution, retaining one valid owner deliberately; this is not proof public subscribe hands back a
release after throwing. After catch, D active=true/subscribers1; manually invoke saved completion ->
observed START,DIRTY,DATA100, cache100, cleanup0. Recorded owner release then runs cleanup once.
Assertions passed, exit0. No network/Promise timing or actual external cancellation was exercised;
no claim future failed-input gating, close/reset ctx fencing or complete async machinery is tested.

No runtime/model/conformance/Rules/owner-ledger edit, new saved probe, D#, commit or push. This
recommendation awaits user acceptance; further admission must amend the applicable current rules
and specify the QA-5 result-obligation boundary rather than silently relying on historical rationale.

### User accepts earlier-result delivery after later setup failure (2026-10-14)

User agrees with the preceding recommendation and selects QA-5. Accepted review direction: legitimately
started work may still output after another dependency's outward startup failure while its original
lifecycle is valid and output open, subject to normal pause/batch/queue/admission rules. Failure stops
new evaluation, not automatically prior work or ctx permissions. Actual close/reset identity and
terminal seals still block old results. Do not synthesize failure RESOLVED ahead of a result still
responsible for outstanding settlement. This is semantic review acceptance, not implemented guards
or a settled definition of how the runtime observes deferred-result responsibility.

### QA-5 explicit deferred-settlement ownership recommendation (2026-10-14; pending acceptance)

Rules candidates — amend activated R-resolved-undirty@1's no-output completion point and compose it
with accepted live DIRTY framing, lifecycle/output identity and buffering. Draft R-fn-contract@1,
R-dispatch-all@1/R-no-raw-async@1/R-primary-api-clean@1 explain relevant API/layer rationale but are
not activated by this review. Keep synchronous void dispatcher invocation and no return-value framing;
do not await Promise results in the wave core, infer debt from pool kind, or add a wire message.

Premise/evidence: dispatcher PoolTable invokes sync and async-labelled fns identically and returns
void. Current nodeRunWave suppresses automatic no-output RESOLVED solely for _isAsyncPool(). There
is no explicit deferred-result registration/completion channel in the inspected ctx or dispatcher.
An inline baseline diagnostic verifies both mismatches: async-labelled fn starts no work and emits
nothing; after upstream set1 observer sees START,DIRTY with no RESOLVED. Conversely a sync-labelled
fn captures a delayed completion callback; upstream set1 causes START,DIRTY,RESOLVED before manually
calling that callback, then it emits DIRTY,DATA10. Exit0, unchanged TS worktree7a26 dafc5ae5. The
second is a manually delayed raw callback diagnostic, not an external async pool qualification or
claim that every raw callback pattern is an approved source boundary.

Recommend an explicit logical settlement-ownership transfer at the source/adapter/pool-helper
boundary that actually starts deferred result production. Default synchronous invocation owns its
processing until normal return; absent explicit transfer, a no-output completed invocation can be
balanced under the normal conditions. If its existing result is intentionally deferred, register
that fact synchronously before returning, then explicitly finish that responsibility on completion,
no-output outcome, or cancellation that abandons the result. The runtime observes those declared
facts, not hidden Promise/network/timer activity. Sugar value callbacks remain protocol-free because
the owning wrapper performs this bookkeeping; raw ctx authors use the corresponding power surface.

Illustrative API only, not a selected public method/name/shape:
    const responsibility = ctx.deferSettlement();
    adapter.start(input, {
      data: value => ctx.down([[DATA, value]]),
      done: () => responsibility.finish()
    });
Actual adapter success/error/cancel finally paths must arrange completion; a throw during work
submission cannot leave an acquired responsibility stranded. Existing terminal/error and cleanup
reporting policy, rather than swallowed failures, governs unsuccessful submission/completion.
No new API implementation or complete adapter contract is approved by this pseudocode.

Responsibility scope/constraints:
- It describes pending logical result/settlement, not all asynchronous work or resource lifetime.
  A producer activated without any announced downstream DIRTY owes no balancing RESOLVED just
  because a Promise, listener or worker exists. Future independent emissions are ordinary waves.
- Bind each responsibility to the originating lifecycle/output identity and the particular still-
  outstanding settlement it can keep open. Finishing an obsolete responsibility cannot clear a
  newer unrelated DIRTY. Per-dependency dirty membership stays idempotent; do not count each task
  as another upstream/downstream DIRTY debt or introduce a public wave-id protocol field.
- Multiple calls may overlap: finishing one no-output responsibility must not settle while another
  valid owner still owes that same result. A node-wide "any work exists" flag is also insufficient,
  since unrelated work must not keep an old settlement dirty forever. Exact bounded representation
  and overlap/coalescing rules need the next design trace before API/storage admission.
- Finishing is at-most-once/idempotent as a responsibility operation; it is not automatic ctx
  revocation, task cancellation, latest-request-wins, node COMPLETE or lifecycle close. Already
  delivered DATA and existing settled obligations are not replayed/balanced a second time.
- Active bookkeeping belongs to the runtime output-settlement owner. The launching helper owns the
  actual external work and its declared completion paths. Cleanup/lifecycle close retires old claims;
  they cannot emit into a new lifetime. Keep no completed-job registry or historical failure ledger.
  No new public node-status enum is proposed; concrete getter/diagnostic surface remains separate.

Proposed RESOLVED decision conditions:
1. This output epoch has an actually announced, still-unsettled DIRTY obligation and remains live/open.
2. Normal input processing for that obligation is finished or conclusively abandoned; not merely
   waiting for first input, DIRTY settlement, PAUSE, setup progress or quiet demand.
3. No valid deferred-result responsibility still owns that obligation.
4. No actual or retained output settlement already covers it. In particular DATA accepted into a
   resumeAll/batch buffer is not "no output"; do not synthesize RESOLVED in front of that result.
Then the runtime provides one balancing RESOLVED via normal output scheduling/framing. If there was
no announcement, stay silent. DATA plus RESOLVED exclusivity holds within one output array. Terminal
settlement/old-epoch retirement does not produce an extra late RESOLVED. Batch rollback removes its
uncommitted retained values and uses the existing rollback obligation policy, not fake DATA.

Consequences: sync filter rejection -> normal automatic balance; async-labelled early reject that
registered no deferred result -> same balance; explicitly deferred result -> no balance at fn return;
eventual no-output finish -> balance only if the same obligation is still outstanding with no other
owner/retained output; ordinary DATA -> no subsequent finish RESOLVED for that already settled debt.
Later C setup failure drops future/unstarted work but cannot release the earlier started owner's
responsibility; its real completion/cancellation or actual terminal/lifetime end determines the rest.

Alternatives/tradeoffs: a static manual-settlement policy with raw authors explicitly sending
RESOLVED could avoid a completion capability, but moves every reject/cancel/no-output path to author
code and still needs a policy for setup failure versus already-started work. Pool-kind inference is
insufficient as demonstrated. Explicit responsibility supplies an observable basis for automatic
balancing at the cost of declaring/completing deferred ownership and handling overlap correctly.
Forgetting completion can still leave a legitimate wait forever; do not hide it with a timeout or
heuristic RESOLVED. Async boundary wrappers should own the common paths. Synchronous fast paths need
not allocate a deferred handle; no global task tracker or all-I/O completion promise is intended.

Remaining design before locking a concrete mechanism: exercise two overlapping invocations with
DATA/no-output outcomes in both completion orders, an old completion after a fresh DIRTY, buffered
DATA then cancellation, and close/reset. Clarify whether first produced settlement can retire a
responsibility automatically or finish must always occur; do not silently decide with an example.
This is a new protocol-facing ctx/adapter capability proposal, not a claim existing runtime already
knows owed results. No runtime/Rules/formal/conformance/owner-ledger edit, D#, saved probe, commit
or push; semantic direction and any concrete API/storage choice still need user approval.

### QA-5 full public-operator audit and message-owned alternative (2026-10-14)

User requests applying the proposed model to all operators and questions whether a new runtime flag
is necessary instead of the async owner sending DATA or another message at completion. This is an
audit/reassessment request, not acceptance of deferSettlement(), a new responsibility registry, any
flag, or an automatic per-job completion guarantee. Keep the earlier proposal as a candidate.

Scope/evidence boundary: current TypeScript dafc5ae57d446a59a7388214c31bd7a6e73d1519 public
operators/index.ts has49 value exports. Exclude infrastructure define/initNode/restoreRegistry;
the remaining46 operator/composition-helper names, including aliases, were all statically classified
below. A TypeScript AST inventory checked exact set equality:46 actual,46 classified, no missing,
extra or duplicate names. Shared implementations and their helpers in graph/operators.ts,
combinators.ts, higher-order.ts and time.ts were inspected. Additional source-boundary review covers
graph/sources.ts factories/coercion and sources/browser.ts/sources/node.ts callback/cleanup patterns.
This is not a claim every private application node, arbitrary define body, language runtime, execution
pool override, or branch combination was dynamically model-tested.

Rules findings: activated R-resolved-undirty@1 distinguishes no occurrence in this wave from future
stateful emissions. The proposed explicit responsibility model can be compatible if opt-in and scoped
to a genuinely deferred settlement; applying it to every retained value, live inner, timer, queue or
future possibility of DATA changes current operator semantics. Retained algorithm state and node
liveness are not proof the current notification must remain unsettled. The wrapper-clean value API
rationale and ctx-level explicit DATA/RESOLVED escape hatch remain distinct. No new wire message,
public verb, output equality substitution or mandatory global async-job accounting is justified.

Complete operator-name classification (TS paths under packages/ts/src/graph):

| Group | All exported names in group | Existing settlement behavior / model qualification |
| --- | --- | --- |
| Immediate transforms/forwarding | map, scan, merge, tap, onFirstData, tapFirst | Current DATA forwards normally; no-DATA/RESOLVED-input paths may auto-balance. Hooks/state do not by themselves register deferred work. tap observer terminal handling owns its normal terminal output. |
| Suppression/stateful selection | filter, distinctUntilChanged, skip, pairwise, valve | Rejected/not-yet-paired/closed-gate input ends this invocation without DATA, so balance now if dirty. Future values or retained previous/current values do not keep this wave open. |
| Selection with early terminal | take, takeWhile, first, find, elementAt | DATA and/or explicit COMPLETE settles; rejected search/counting waves may balance now. Do not append RESOLVED to terminal or already-produced DATA. |
| Terminal accumulators | reduce, last | Store values now, auto-balance current no-output processing; eventual COMPLETE input produces final DATA/terminal in later handling. Holding every earlier wave until final accumulation would change behavior. |
| Wave-based convergence | settle | Emits contributing DATA; quiet no-DATA waves may balance; its own COMPLETE follows its quiet/max policy. Its name is not a deferred-result completion API. |
| Recovery | rescue, catchError | Forward values or recover ERROR into DATA, otherwise follow owned completion/ERROR policy. Recovery callback is synchronous; returning a Promise would not automatically await it or register deferred settlement. |
| Latest/winner/control combinators | combine, combineLatest, withLatestFrom, race, takeUntil | Combine gate, secondary-only wave or losing input may produce no DATA now; auto-balance rather than wait for some future trigger. Keep partial/startup and terminal policies separate. |
| Queue/notifier combinators | zip, concat, buffer, bufferCount, sample | Store unmatched/queued/latest values; current input can settle without DATA. Future counterpart, phase transition or notifier causes a later invocation. Pending private values are not deferred-settlement handles. |
| Higher order | switchMap, mergeMap, flatMap, concatMap, exhaustMap, repeat | Scheduling an inner/subscription or retaining an outer queue may complete current processing with RESOLVED; later inner DATA is a new input wave. Cancellation/inner cleanup and final completion remain operator-owned. Do not hold current DIRTY for every active inner/queued outer; shared mapOperator and repeat inspected. |
| Time compositions | delay, debounce, debounceTime, throttle, throttleTime, audit, auditTime, timeout, bufferTime | Actual implementations use declared timer/interval/duration deps and synchronous bodies, not a hidden async fn continuation. Current no-output processing settles; later notifier/inner DATA triggers new output. Debounce cancellation/audit replacement must not create a task-registry requirement. Timer liveness is not a current-wave result debt. |

Supplementary source boundaries:
- Finite sources (of/fromIter/empty/throwError, fromPromise/fromAsyncIter, process/HTTP/IDB results)
  explicitly emit DATA and/or COMPLETE/ERROR. Stream completion with no DATA already has a terminal
  settlement; do not add RESOLVED after it.
- Event/timer/interval/cron/SSE/websocket/webhook/push/RAF/filesystem/git sources can remain silent
  indefinitely between independent events. They are normally depless; activation by itself announces
  no DIRTY. No per-task/stream registration is needed just to keep the source alive. Later callbacks
  emit ordinary waves; cleanup ends resources, not an invented no-output result for every interval.
- fromEvent/fromPushNotification/timer/RAF/cron and Node host sources can receive later host callbacks
  despite sync/default pool labels. fromPromise/fromAsyncIter/driver helpers use async labels. This
  confirms pool kind is neither a universal external-work detector nor logical settlement identity.
- firstValueFrom/singleFromAny are host escapes/coercion/dedupe helpers, not in-graph operator
  settlement primitives. ExistingNode/scalar/Promise/iterable coercion follows the source selected.

Concrete bounded probes, saved as protocol-reconciliation-probes/operator-settlement-catalog.ts and
run successfully from TS checkout with tsx (exit0; ordinary tuple-delivery baseline, not future framing):
1. reduce after input1: START,DIRTY,RESOLVED; later source COMPLETE -> final DATA1,COMPLETE.
2. bufferCount(3): inputs1 and2 each settle RESOLVED while private buffer remains; input3 -> DATA[1,2,3].
3. zip: A1 -> RESOLVED; later B2 -> DATA[1,2].
4. mergeMap: outer input wires a silent live inner and settles RESOLVED; later inner10 -> DATA10.
5. switchMap: new outer cancels A (cleanup once); both outer no-output waves settle. A's removed
   source cannot forward later9, while B20 forwards normally. No outstanding job registry required.
6. Actual delay(5): initial processing ends RESOLVED before the real timer; later timer -> DATA7.
7. Shared source -> immediate map and mergeMap -> partial join: observed (1,undefined), then (1,10)
   when inner emits. Treating the live inner as holding the earlier notification would suppress the
   first partial result: a real observable change, not just internal bookkeeping.
8. Raw async-labelled consumer: initially keeps DIRTY; manually executing its no-output completion
   callback with ctx.down(RESOLVED) settles using existing messages and no added runtime work flag.
9. Real public configuration gap: g.initNode(filter(()=>false),[source],{pool:'async'}) leaves only
   START,DIRTY after input. No deferred operation was started. Current _isAsyncPool() suppression
   prevents normal empty-result settlement; do not claim defaults alone qualify every pool override.

Relevant existing suites ran from packages/ts: vitest run operators.test.ts, operators-tap.test.ts,
combinators.test.ts, higher-order.test.ts, time.test.ts, sources.part-01.test.ts, sources.part-02.test.ts,
sources-browser.test.ts and sources-node.test.ts (each under src/__tests__), --reporter=dot. Exit0:
9 files,191 tests passed, no skips. These are baseline regression receipts, not passing tests of a
new deferred-result mechanism. The first AST pretty-printer extraction used an incorrect EmitHint
and failed; corrected extraction and final inventory succeeded before classification conclusions.

Revised recommendation (pending user acceptance): do not introduce deferSettlement/hasAsyncWork or
per-job substrate tracking as a mandatory solution. Retain ordinary synchronous operator no-output
auto-balance; state/queues/inners ending this processing may yield later independent waves. A genuine
ctx-level deferred boundary can explicitly own manual settlement and send DATA, RESOLVED for an owed
no-occurrence outcome, or terminal only when the stream really ends. Runtime must not also auto-balance
at its scheduling return. Existing async-labelled raw path demonstrates the message-owned mechanism,
but execution placement and settlement responsibility need an explicit contract, not pool-kind
guessing. In value-level operators, including supported async/remote pool overrides, wrapper/runner
must report actual completion/no-output instead of making predicates/users send protocol messages.
Do not simply remove _isAsyncPool() or auto-defer all time operators based on this audit.

Manual-mode limits: helper/adapter that owns cancellation/concurrency must decide which no-output
completion can send RESOLVED. An old cancelled callback must not blindly settle while the newer
result it replaces is still owed. Existing node-wave messages do not carry per-invocation result IDs;
there is no free substrate guarantee of independently tracked async-job completion. If such automatic
guarantees are required later, explicit responsibility association is one candidate, but it is an
additional capability rather than necessary for the current46-operator catalogue. Helper-local
algorithm/cancellation state and existing runtime dirty/terminal/lifecycle facts remain; "no extra
global task flag" does not mean no state anywhere. No arbitrary stream COMPLETE to finish one task,
no INVALIDATE-as-done, and no manufactured RESOLVED when nothing was announced/owed.

Separate unresolved composition: the accepted failed-setup rule must not auto-RESOLVE merely because
future input consumption stops when an earlier manual producer can still return. Without per-job
runtime tracking, its boundary owns completion and the runtime cannot infer silence. Record this
explicitly rather than silently claiming automatic per-result guarantees from wave messages alone.
No runtime, normative Rules/formal/conformance or owner-ledger edit, D#, commit or push. TS source
git status remains clean; only local canonical session notes and the diagnostic probe changed.

### User accepts message-owned raw async settlement, no new task tracker (2026-10-15)

After clarification that "helper" means the existing implementation that launches/manages work,
the user agrees to add no new asynchronous-task tracking and assigns DATA/RESOLVED to raw async
nodes, then asks to continue if QA-5 needs no further decision. Accepted review direction: preserve
normal operator no-output automatic settlement; a raw async boundary deliberately deferring this
settlement owns its existing-message completion and must not be auto-RESOLVED merely at scheduling
return. No deferSettlement API, per-job registry, hasAsyncWork flag or new wire message is selected.
Concurrency/cancellation strategy stays with the actual producer implementation, not a new unnamed
library supervisor. Existing lifecycle/terminal/output/dirty bookkeeping remains necessary.

Final wording qualifications for QA-5, not additional task-tracker choices:
- DATA remains an occurrence, explicit RESOLVED supplies owed no-occurrence settlement, and terminal
  ends node output. No-output silence is allowed when nothing was announced/owed. INVALIDATE is not
  task completion; COMPLETE/ERROR cannot be fabricated merely to finish a nonterminal job.
- Manual producer completion must follow its overlap/cancellation policy; the substrate promises no
  implicit per-task correlation/latest-wins. Do not let an old cancellation blindly clear settlement
  still owned by replacement work. No automatic conclusion that input setup failure ends earlier
  manually owned result production.
- Pool placement alone cannot define result completion. Value-level operators must retain wrapper/
  runner-owned no-output settlement even under supported execution pool overrides; predicate users
  do not acquire protocol obligations. The verified async-pool filter rejection remains a bounded
  implementation/contract reconciliation work item, not permission to immediately remove the pool
  guard and prematurely settle real deferred raw work. Exact registration/wrapper lowering belongs
  to later design; no extra mutable task state or public settlement option is approved here.

The semantic direction can leave QA-5 discussion; implementation qualification is not complete.
Raw fn/scheduling-return versus real no-output completion and failure cancellation must be reflected
in the future Rules amendment/conformance. User agreement is not normative activation or runtime
implementation authorization. Return to QA-11, after the earlier QA-10/partial reconciliation.

### QA-11 terminal upstream during ordinary dependency acquisition (2026-10-15; pending confirmation)

Current activated R-terminal@1 explicitly rejects late subscription to a non-resubscribable terminal
node and permits fresh reset when that node opts into resubscribable. R-push-subscribe@1 does not
provide a separate read-only-terminal dependency path. R-deps-terminal@1 and accepted grouped
complete/error input policy handle terminal messages after lawful acquisition; they do not grant
the acquiring node permission to override its upstream's admission/activation contract. September28
review deferred downstream-forced restart; no new generic retry/control message is introduced.

Recommendation: keep ordinary dependency acquisition subject to the same upstream subscription
permissions as other subscriptions. Merely constructing a declared edge performs no activation;
downstream activation acquiring an actual owned subscription is a real lifecycle demand, with release
responsibility. It is not "topology declaration alone" restarting an upstream. If A itself opted
into resubscribable, such a lawful later acquisition can start its eligible new lifecycle. C's own
resubscribable/complete:input/error:input does not force A to opt in. Preserve normal close-before-new,
closing/released checks and terminal-fanout boundary protections; exact QA-1/2/21 interaction is not
settled by simply calling _resetLifecycle mid-delivery.

Ordinary entrance matrix:
- Nonterminal active A: acquire an additional subscription under normal initial-snapshot rules.
- Nonterminal inactive A: acquire an owner and activate under existing gates.
- Terminal A, resubscribable:false: reject the acquisition; C's startup follows existing outward
  setup-failure/resource ownership rules. Do not silently replace this failure with cached DATA or
  a terminal snapshot. Earlier lawful partial output is not rolled back.
- Terminal A, resubscribable:true: eligible fresh acquisition resets through the lifecycle/cleanup
  contract, rather than returning a read-only view of the previous terminal epoch.
- Closing/permanently released A: existing admission rejection applies; terminal snapshot does not
  bypass it. An in-progress terminal fanout requires the separately reviewed safe admission boundary.

Concrete rationale/consumer cost: A already completed with value23. New C depends on A and requests
complete:input. If A is non-resubscribable, C cannot use that option to read old DATA23+COMPLETE as
though acquisition succeeded. This is the present public rule, not automatically a protocol defect.
An operator such as rescue attached only after upstream ERROR likewise cannot bypass admission.
Wire the consumer before termination, use an explicitly retained result/failure DATA node, or acquire
a fresh/restartable source under its own contract. No new snapshot factory/public read-only mode is
selected. A user need to read sealed terminal history would justify revisiting the public terminal
admission rule or explicitly designing that access; internal dependency special casing is not free.

Alternative: supply START,(retained DATA),terminal without activation. Convenient for consuming
completed results and avoids restarting shared work, but changes R-terminal or creates a distinct
kind of acquisition/ownership with replay/cleanup/terminal/PULL precedence to define. It must not
be inserted merely to make complete:input appear universally connectable. Prefer the uniform
existing contract absent an explicit new consumer requirement. The QA report's "declaration alone
restarts upstream" premise conflates declaration with actual activation-time subscription acquisition;
the convenience limitation is real, while an unconditional owner contradiction is not established.

Work evidence: re-read _subscribeOwned, nodeSubscribeDepAt and restored-dependency seeding. Normal
dep wiring calls _subscribeOwned, including terminal reject/reset; the existing restore seed shortcut
is specialized restore behavior, not general terminal read-only subscription authority. Inline
diagnostic at unchanged TS worktree7a26 dafc5ae5 passed: terminal non-resubscribable A cache23 rejects
new C acquisition despite legacy terminalAsRealInput:true and C fn calls0. A retained release is
recorded using the private acquisition seam to avoid claiming a public off was returned on failure.
Second case: restartable source runs1, completes, original subscription released; later C acquisition
starts source again with value2, runs2 and C sees[2]. This tests eligible quiescent reset, not active
terminal fanout/nested restart or the proposed grouped terminal API. Exit0. No new full suite run,
saved probe, runtime/Rules/formal/conformance/owner-ledger edit, D#, commit or push.

### User accepts uniform subscription admission; QA-12 release handoff (2026-10-16)

User agrees to retain the uniform subscription rules recommended in QA-11 above, then requests
QA-12: callback failure before subscribe returns, and subscription/release responsibility. This
acceptance does not resolve nested terminal fanout/reset precedence (QA-1/2/21), activate a Rule,
or authorize runtime implementation.

**Rules — current contract and proposed clarification (QA-12 pending confirmation).** Activated
R-push-subscribe@1 establishes START/cache initialization, but does not specify failure rollback or
release transfer through the complete synchronous public subscribe operation. Earlier accepted
September29 handshake/activation-abort directions and the October5 callback-identity/initialization
directions require reconciliation here; they are review directions, not additional activated Rules.
The abort window must include activation and any mandatory synchronous boundary drain before the
public call really returns. Executing `return unsubscribe` inside try is not a completed handoff
when finally/exitWave can still throw.

Recommendation: an outward-failing public subscribe aborts only the new registration acquired by
that call whose release responsibility has not already transferred. No last owner remaining means
ordinary lifecycle close, old-ctx revocation and best-effort independent cleanup; surviving owners
retain normal lifecycle/resource responsibilities. Do not roll back delivered DATA, effects, or
independently accepted work. Complete unaffected valid fanout and required boundary bookkeeping,
then report original/aggregate failures under the accepted error policy. Cleanup is synchronous,
at most once, and does not imply external I/O cancellation or resource-release success.

Important combinations to cover in later design/conformance:
- START/cache/replay callback, activation-output callback, or required drain failure can all prevent
  the public release return. The release-handoff test, rather than callback message type, controls
  abort ownership. Failure of some other established observer can also cause this call to throw;
  the newly untransferred registration still needs abort, while established observers keep theirs.
- Reusing an already established same-callback registration creates no acquisition to roll back.
  No failed alias call can remove that older registration; old release aliases cannot remove a
  different later registration with the same callback object.
- A START callback may successfully subscribe distinct B, retain offB, then throw for A. Abort A;
  B remains an owner with its independently returned release. Preserve the accepted safe pending
  activation/failure-bookkeeping order rather than undoing B or leaving ownerless pending work.
- A successfully returned nested alias for the same provisional callback is a further pending
  clarification of the same ownership principle: it transfers a release for the one registration,
  without another START, registration or refcount. Recommend preserving that registration if the
  outer call later fails, since a release is already held externally. If that alias already removed
  it, abort is a no-op and must not target a subsequently re-created registration. This is not a
  new public subscription mode or special activation-owner transfer object; exact minimal internal
  handoff representation remains design work, not an approved new flag/API.
- A nested subscribe that returned successfully before a later enclosing wave/drain fails has
  completed its own handoff. The enclosing failure cannot retroactively make its release absent.
- Private owned acquisition records release before callbacks; that explicit owner already has the
  responsibility and follows the accepted retained-lease failure contract (graphrefly-ts:D161).
  Public no-handoff abort is not blanket rollback of graph-owned faulted construction/resources.
- A protocol ERROR delivered under the node's own error contract is different from subscribe
  throwing outward. If subscribe returns normally, it can return a valid release even for terminal
  output. Errors after successful return use established-observer isolation/reporting, without
  automatic unsubscribe or retry. No fabricated source protocol ERROR to report observer cleanup.

**Decisions — rationale and alternatives.** Prefer extending the existing acquisition/handoff
principle over changing subscribe's public signature or returning an error object containing off.
Leaving a newly installed subscription after an outward throw requires callers to recover a release
they never received; auto-removing every throwing callback would instead destroy established or
independently transferred subscriptions. The proposed ownership boundary avoids both, at the cost
of tracking which exact registration was acquired and whether release was actually handed off.
This bookkeeping is not a historical failure log, async cleanup, or a new node-status dimension.
Same-callback nested alias handoff is surfaced explicitly for confirmation rather than silently
overriding either callback idempotence or successful ownership transfer.

**Work — inspected baseline evidence and remaining work.** Re-read node._subscribeOwned and
batch/boundary.exitWave/drain at TS worktree7a26 dafc5ae5. There is no public failure rollback;
finally can override the pending return. Added bounded diagnostic
`protocol-reconciliation-probes/subscribe-abort-before-return.ts`, run from that TS checkout with
`node_modules/.bin/tsx /Users/davidchenallio/src/graphrefly/sessions/active/protocol-reconciliation-probes/subscribe-abort-before-return.ts`.
Exit0: both initial START callback failure and injected deferred-boundary failure throw the original
error, return no release, retain the registration, and deliver a later DATA30. Each diagnostic then
obtains a release via a separate successful call and cleans up. Boundary injection uses private
NodeCore/deferRewire for the exact finally failure window; it does not demonstrate future queued
observer controls or future complete-array callback behavior. It asserts the current defect shape,
not proposed conformance. No new full suite run or evidence claim for nested alias/terminal-fanout
combinations. Later work must specify the full handoff/cleanup/error boundary, add focused scenarios,
and amend applicable normative surfaces before implementation. No runtime, Rules/formal/conformance,
owner-ledger, D#, commit or push change.

### User accepts QA-12; QA-13 retiring invocation and cleanup registration (2026-10-16)

User agrees to the preceding QA-12 recommendation, including successful same-callback nested release
alias transfer, and asks to proceed if no further QA-12 choice remains. QA-12's ownership direction
is accepted for review; whole-operation return/finally/drain, exact registration identity and the
explicit private-owner handoff remain implementation/conformance requirements, not further choices
to silently redefine. No normative activation or runtime implementation is authorized.

**Rules — QA-13 gap and pending recommendation.** Activated R-cleanup-hooks@1 clears both hook lists
before each run and discards superseded registrations without invoking them. Existing accepted
September27-28 review directions revoke ctx mutation/control/hook-registration on actual lifecycle
close, drop late down, permit restricted cleanup reads, immediately execute wrapper-managed cleanup
returned by a retiring invocation, and delay fresh activation until its synchronous unwind finishes.
They do not fully specify exception routing when ordinary remaining fn code runs after nested close.
Terminal alone remains distinct from lifecycle closure. R-fn-contract@1 lacks activation metadata;
do not treat the broad fn/sugar description as an activated answer to this lifecycle exception case.

Concrete trace: N's fn emits DATA; its last observer unsubscribes during delivery; N closes and
revokes old ctx; down returns to the still-running fn; ctx.state.set or onDeactivation now rejects
under the accepted permission rule. Recommendation: keep those explicit invalid-context errors.
Allow fn/helper to catch them locally. If uncaught, report under the operation-failure policy at
the boundary that owns that invocation, after required synchronous cleanup/unwind, preserving
original/aggregate errors. Do not turn a retired invocation failure into N's protocol ERROR or mutate
a fresh lifecycle's cache/terminal record. This does not change ordinary still-valid fn failure
conversion under its sugar contract. A lifecycle/owner check belongs at error-conversion and normal
post-run paths, not merely inside ctx.down (whose stale-output drop must not swallow the failure).
For external asynchronous callbacks, reporting belongs to their actual pool/adapter/host boundary;
there is no fictional old synchronous caller or permission to inject the failure into a later
unrelated operation. Exact cross-pool carrier remains later design (QA-25).

Second trace: run1 registered cleanup for a held resource; run2 starts and clears old hooks; run2
emits before re-registering; last unsubscribe closes N with no registered cleanup. A late hook
registration must remain rejected, not be stored on inactive N or routed into a future activation.
Recommend no generic "invalid ctx onDeactivation executes immediately" exception. Reuse the already
accepted handoff distinction: raw fn/helper owns resources before successful registration and must
release on setup/handoff failure; register cleanup before emission or other reentrant user-code calls
when possible. The surrounding helper must cover closure during acquisition/registration itself
with its own try/finally or equivalent local ownership guard. Resource retention across repeated runs
also requires ensuring the current run's cleanup handoff before such reentrant work; old hook
discard is not evidence that an old external resource was released. Runtime cannot discover it.

The effect/source returned-cleanup interface keeps the separate wrapper-owned handoff established
before setup: if that invocation returns cleanup after actual closure, run it once for the retiring
lifecycle, under cleanup failure policy. It does not call invalid ctx.onDeactivation to accomplish
this. If setup throws before yielding an unknown cleanup, setup still owns partial resource release.
No async cleanup, public closing status addition, resource registry or automatic I/O cancellation.

**Decisions — alternatives and tradeoffs, pending acceptance.** Keep the agreed invalid-operation
errors rather than silently dropping state writes; silent dropping would hide erroneous continuation.
Route retired errors as operation failures rather than protocol ERROR; this preserves lifecycle
isolation while keeping failures observable. Keep explicit handoff over special late-hook behavior;
the latter blurs invalid ctx authority and would need distinct onInvalidate treatment/once semantics.
Retaining prior hooks until a successful replacement would cover part of the clear-before-register
window, but changes activated R-cleanup-hooks@1 and previously accepted per-run replacement semantics,
requires replacement/failure ownership rules, and could change which resources close invokes. Do not
silently adopt that alternative to repair this trace. The current recommendation retains per-run
clear with an explicit resource-owner obligation; whether to revisit the hook replacement contract
is a surfaced alternative, not an already approved repair.

**Work — verified baseline, not future-model validation.** Inspected nodeRunWave (clear-before-call,
finally only clears insideRunWave), nodeDeactivate, nodeMakeCtx/nodeMakeState (no lifecycle fencing),
Graph.effect's broad throw-to-ERROR catch, and sources.source's early trampoline/late-return cleanup.
Added diagnostic `protocol-reconciliation-probes/retiring-invocation-error-and-hook.ts`; run from TS
worktree7a26 with node_modules/.bin/tsx and its absolute path. First run failed because the probe
mistook terminal storage for a message tuple; corrected the assertion to the existing direct error
payload, with no source changes. Rerun exit0: (1) effect triggered by state1 calls its last off then
throws; active=false yet status=errored, terminal is the same original Error; (2) raw run2 emits,
observer removes the last subscription, then registers cleanup; active=false, cleanup calls0 and
inactive onDeactivation list length1. The diagnostic hook owns no real resource and was explicitly
removed afterward. These expose the current baseline failure shapes; it does not test future ctx
rejection, whole-array fanout, return-path fences or error-reporting implementation. Later work must
cover normal valid error conversion versus retiring errors, cleanup-error aggregation, all wrappers,
early registration and late-return cleanup, and cross-pool ownership under the approved scope.
No full suite rerun, runtime, normative Rules/formal/conformance, ledger, D#, commit or push change.

### User accepts QA-13; QA-14 paused invocation input retention (2026-10-16)

User agrees to the preceding QA-13 recommendation and asks to move to QA-14 if nothing else needs
a choice. Accepted review direction: retain invalid-ctx rejection and stale-output dropping; report
uncaught retiring-invocation failures through the invocation's operation owner rather than poisoning
node output; keep explicit resource handoff, early raw hook registration/helper responsibility and
wrapper-managed immediate once-only late-returned cleanup. Per-run hook replacement is retained;
no generic invalid-ctx immediate-hook-registration exception selected. Remaining exact error carrier,
pool routing (QA-25), wrapper audit and lifecycle fencing are work, not a new public state dimension.

**Rules — QA-14 current contract and pending recommendation.** Activated R-resolved-undirty@1
(graphrefly:D49) preserves value occurrences, disallows equality substitution, and leaves explicit
operator reduction policy possible. R-pause-modes@1 lacks activation metadata; its "fire once with
latest dep values" shorthand is not a fully reconciled activated rule and conflates raw inputs with
value-sugar policy if read as dropping all other occurrences. The September18 identity-value trace
does not establish that raw ctx loses history. R-ctx-wave-data@1 is also unactivated; its retained
per-dependency per-wave input projection is accepted review direction/history, not normative activation.
Activated R-paused-invalidate@1 (graphrefly:D50) explicitly cancels/supersedes an affected dep's paused
pending change; September24 walkthrough accepted that control policy. Initial-gate accumulation and
subsequent partial-startup refinement must not silently be reinterpreted as latest-only pending input.

Recommend preserve each unconsumed DATA occurrence and its per-dependency wave boundary while default
PAUSE prevents new fn calls. On final-lock release, invoke raw fn once when all other gates permit,
with accumulated surviving input projections. Derived/effect intentionally call their value callback
once with current values; scan/map/etc consume occurrences according to their operator contract.
One raw invocation does not mean one occurrence, one operator callback, or one output. Equal DATA is
still repeated DATA. No automatic Cartesian pairing/global historical multi-dependency interleaving
promise is introduced by the per-dependency wave arrays. Resume does not bypass pending DIRTY,
first-input, PULL quiet, lifecycle or terminal gates. Previously started results continue under the
accepted default no-output-buffer proposal; resumeAll remains output buffering with fn running.

Concrete pending-input policy candidate for INVALIDATE: retain its explicit destructive meaning
under R-paused-invalidate rather than silently replaying cancelled paused inputs later. When a dep
is invalidated during default PAUSE, discard that dep's unconsumed pre-invalidation paused inputs,
clear its retained current value, and retain the INVALIDATE marker as needed for any later valid
invocation. Preserve other deps' surviving input and later DATA on the invalidated dep; later DATA
re-arms eligibility. If no other surviving pending input/demand/activation reason exists, no resumed
fn is manufactured merely to consume the marker. Example A20,A21,INVALIDATE,A30 while paused: future
surviving input for A reflects INVALIDATE then30, without replaying20/21. If B also has surviving
DATA, a resumed fn can observe A's INVALIDATE/absence plus B's input, with raw/sugar missing-value
rules unchanged. This is a proposed pending-input cancellation policy, not universal erasure of DATA
history: do not undo already executed reducer state, prior outputs, or work started before PAUSE;
do not change ordinary non-paused same-wave DATA+INVALIDATE preservation by this recommendation.
Exact marker/wave truncation must preserve the surviving original per-dependency wave grouping.

**Decisions — tradeoffs and alternatives, pending acceptance.** Prefer one occurrence-preserving
raw input rule across legitimate invocation deferral over a hidden PAUSE-only latest replacement.
It keeps scan/reduce/event-counting correct and makes value-sugar latest selection explicit. Cost:
unconsumed input storage grows with traffic and pause duration; default PAUSE saves dispatch/expensive
computation, not bounded-memory upstream backpressure. Source events may continue. Do not claim a
bounded buffer or add an unapproved capacity/drop flag. A consumer needing only a current snapshot
can choose a composition that explicitly stores/reduces to latest before the paused computation;
the actual boundary placement matters because derived's latest callback alone does not prove its
substrate avoided pending storage. A generic bounded/latest-only pause policy would be a separate
choice with overflow semantics. Rejecting historical replay only after explicit INVALIDATE follows
the accepted cancellation rationale, but its raw-history representation is a material clarification
to confirm; alternatively preserving old DATA plus INVALIDATE requires operators to interpret it as
history and changes what cancelling a pending input means. Do not silently choose by current code.

**Work — baseline evidence and unresolved reconciliation.** Re-read nodeRecordDepProjection,
nodeReceiveFromDep DATA/RESOLVED/INVALIDATE, default maybeRun/onResume, depWaves/depBatch/depLatest,
map and scan bodies. Added `protocol-reconciliation-probes/default-pause-input-occurrences.ts`, run
via node_modules/.bin/tsx with its absolute root path from unchanged TS worktree7a26. Exit0. Case1:
source10, pause raw/derived/scan, separate DATA20,21,30, resume. Raw calls stay1 while paused then
one call receives [[[20],[21],[30]]]; derived callback inputs [10,30]; scan outputs [10,30,51,81].
This proves current default pause retains raw occurrences, not latest-only; callback counts and
value trace distinguish substrate from sugar. It does not prove future complete-array output/FIFO
or every operator/multi-dependency interaction.

Case2: raw initialized from10, pause, DATA20 then INVALIDATE then resume: no resumed fn. Later DATA30
invokes with [[[20],[undefined],[30]]]. The flag/batch cancellation does not clear waveData, and
depBatch filters SENTINEL rather than truncating earlier values. Thus old cancelled paused history
can surface in a later invocation (and event operators could consume it). JSON output renders the
undefined marker as null; assertion uses actual undefined, never DATA(null). This exposes a contract/
history-storage reconciliation gap, not evidence that the proposed pruning policy is implemented.
Later scenarios must cover multiple/equal DATA per wave, empty RESOLVED waves, INVALIDATE attribution
and re-arm, multiple deps, pause+first gate/PULL, terminal cancellation, consumption exactly once,
and memory policy. No runtime, normative Rules/formal/conformance, owner ledger, D#, full-suite run,
commit or push. QA-14 recommendation remains pending user acceptance.

### User accepts QA-14; QA-15 first-input readiness after INVALIDATE (2026-10-16)

User accepts the preceding QA-14 recommendation and asks to proceed to QA-15 if no further choice
remains. Accepted review direction: default PAUSE retains all unconsumed input occurrences/per-dep
wave boundaries, one eligible resumed raw invocation can consume them, value sugar chooses latest,
and occurrence operators keep their own callback/output policies. Accept memory growth rather than
silently add an implicit cap/drop/coalescing policy. Explicit INVALIDATE discards that dep's still
unconsumed pre-invalidation paused input, preserves relevant invalidation marker and other deps'
surviving input, and allows later DATA to re-arm; already consumed state/output is not rolled back.
This is scoped pending paused-input cancellation, not erasing ordinary non-paused DATA history.
Exact per-wave truncation, gate combinations and pruning implementation remain work; no new choice
or runtime permission is inferred. QA-14's selected direction can leave discussion.

**Rules — QA-15 ambiguity and pending recommendation.** Activated R-first-run-gate@1 says delivered
at least one real DATA "this or a prior wave", first-run-only, INVALIDATE does not re-arm. Read as
an irreversible per-dependency ever-delivered flag, the first clause conflicts with clearing a
retained value before the first invocation. R-invalidate-idempotent@1 and R-paused-invalidate@1
establish value clearing/cancellation, but do not alone provide the complete initial-admission
wording. September27 accepted first-run-only completeness and September29 T|undefined callback
types describe post-first-call missing inputs; neither requires granting the initial gate merely
because some discarded DATA once arrived. QA-14's input-history cancellation reinforces the need
to distinguish historical occurrence delivery, current presence, and whether fn has ever run.

Recommend: until first invocation under partial:false, every dependency must currently retain an
admissible real value at the gate check, or satisfy its configured terminal-as-input admission.
First delivery followed by INVALIDATE before first execution loses that dependency's value-based
readiness. A new DATA can restore readiness; RESOLVED does not create a missing value, though it
may clear outstanding DIRTY and permits invocation when all other conditions already hold. Once
the fn has actually run, this initial completeness gate is retired for that lifecycle; INVALIDATE
does not re-arm it, and other valid input may invoke with that dep undefined. partial:true omits
initial completeness but still respects real DIRTY settlement, PAUSE, demand and lifecycle/terminal
constraints, including the accepted early partial initialization policy. Delegated terminal input
is a separate admissibility alternative, not fabricated DATA; automatic terminal seals/cancels
unstarted work under QA-8. No always-complete mode or extra historical ever-had-data flag selected.

Concrete trace, no terminal delegation: subscribe N(A,B), pause before any DATA, A10, B20,
A INVALIDATE, resume. partial:false still has zero fn calls, because A has no current value;
A RESOLVED leaves zero; A11 allows first invocation with (11,20). After that, A INVALIDATE and
B21 may invoke with (undefined,21). partial:true can first invoke with (undefined,20) once resumed
and settled. Remaining waiting when A never supplies replacement is the declared initial gate,
not permission to invent an undefined first input, automatically complete, retry or reactivate.

Whole-array intersection: under the accepted complete-wave-before-eligibility direction, handle
the entire dependency array before checking this initial gate. If the array ends DATA10,INVALIDATE,
the resulting current value is absent and cannot satisfy partial:false merely during the temporary
DATA processing step. A following DATA in that same array can leave a present final value instead.
This statement concerns gate readiness, not dropping the real occurrence history in a normal
non-paused array: retained raw projections may still contain DATA and INVALIDATE for later lawful
consumption. Do not generalize QA-14's explicit paused cancellation to all occurrence histories.
The gate does not promise total cross-dependency historical ordering or rerun for each projection.

**Decisions — rationale and alternatives (pending acceptance).** Prefer current input completeness
at the first invocation, reusing dependency presence and has-called-fn facts. An irreversible
"ever received DATA" admission admits a value known to have been invalidated before any actual
computation, weakens partial:false's first-call meaning, and may require redundant history state.
Checking completeness on every call would block legitimate post-first missing-input processing
and reverse the explicit earlier first-run-only agreement. Current-first-only covers initialization
without adding another partial mode or stronger ongoing invariant. Clarify the rule wording and
document waiting/terminal behavior; runtime agreement on independent waves does not activate a
new rule or validate full-array scheduling.

**Work — bounded baseline evidence.** Read nodeReceiveFromDep INVALIDATE (hasData=false),
nodeTryRun/nodeAllDepsSettled (current hasData plus delegated terminal, guarded by hasCalledFnOnce),
and prior first-gate/T|undefined approvals. Added probe
`protocol-reconciliation-probes/first-gate-current-input-after-invalidate.ts`; run with
node_modules/.bin/tsx and its absolute root path from TS worktree7a26, exit0. Both partial settings
start with empty A/B and are paused before A10,B20,A INVALIDATE. partial:false resumes with zero
calls, stays zero on RESOLVED, first calls on A11 with (11,20); after invalidation B21 produces
(undefined,21). partial:true first resumes with (undefined,20); another RESOLVED invokes again
without inventing a value, as permitted by raw/value-sugar RESOLVED policy. No new flags needed to
explain these current traces. JSON null in printed arguments is undefined absence, not DATA(null).

Separate same-array probe with B cache20 and initially empty A: A.down(DATA10,INVALIDATE) currently
invokes once with (10,20), because INVALIDATE handling calls maybeRun before clearing current A.
This is evidence of the old temporary-state invocation path, not validation of the proposed final
array admission. Later whole-array/gate scenarios must cover DATA+INVALIDATE(+DATA), PAUSE/first
activation, terminal-input admission and automatic terminal cancellation, snapshot current presence,
post-first behavior, and no accidental loss/replay of legitimate retained raw DATA. No runtime,
normative Rules/formal/conformance, owner ledger, D#, full-suite run, commit or push change.

### User accepts QA-15; QA-16 subscribe origin and activation boundary (2026-10-16)

User accepts the preceding QA-15 recommendation and asks to proceed to QA-16 if nothing else needs
a choice. Accepted review direction: partial:false initially checks currently admissible input,
not irreversible past DATA receipt; INVALIDATE before first invocation loses value-based readiness,
RESOLVED does not manufacture missing values, configured terminal-input admission remains separate.
After the first actual fn call, completeness is not re-armed by INVALIDATE. Eligibility is checked
after the complete delivered array; ordinary retained raw occurrence history is distinct from
current value presence. QA-14 cancellation is not generalized to all DATA+INVALIDATE histories.
No extra ever-had-data flag/always-complete mode, normative activation or runtime changes selected.

**Rules — QA-16 gap and pending recommendation.** Activated R-push-subscribe@1 specifies initial
START/cache delivery but no public subscribe execution-origin matrix. Activated R-reentrancy@1
rejects actual synchronous fn feedback; it does not prohibit every public subscribe made from a
fn, nor make all immediate nested subscriptions safe. Activated R-rewire@1 and deferred rewire
rules provide declared topology/resource acquisition paths, and accepted QA-6 observer external
requests use graph-local safe-boundary scheduling. Existing initial-subscription proposals permit
nested registration/initial snapshots but defer activation until surrounding initialization exits.
These are relevant distinct current/proposed contracts, not an already activated QA-16 policy.

Recommend this origin split for same-graph work:
- Host public subscribe outside an executing graph flow: ordinary synchronous acquisition, initial
  snapshot, eligible activation and required boundary work before actual return. QA-12 owns failure
  rollback/handoff. No Promise/microtask or asynchronous subscribe return is introduced.
- Public GraphReFly subscribe invoked directly from a raw fn or derived/effect/operator body:
  reject before acquiring a registration, including same-callback alias calls for a uniform public
  origin rule. Graph relationships belong in declared deps or supported dynamic rewire; do not
  queue this implicitly into a hidden later subscription. This is a NEW admission proposal, not
  established R-reentrancy or a claim that all node code is already prevented from subscribing.
  An ordinary valid fn wrapper routes the resulting invocation failure under its own error contract.
  Do not label a harmless unrelated cold subscribe an actual detected D37 feedback cycle.
- Public subscribe from an ordinary subscriber callback, including initial callbacks: immediate
  normal admission/registration and one initial snapshot, with release available synchronously,
  but no new fn dispatch/activation nested inside the observer callback or current wave fanout.
  Pending activation becomes eligible at the safe graph boundary, subject to normal locks,
  readiness, terminal/lifecycle and ownership rules. Already active targets need no new activation.
  This does not settle whether a newly registered observer joins an in-flight array (QA-17).
- Runtime-owned dependency acquisition remains part of the current lawful activation/rewire flow,
  records release before callbacks, and can drive eligible partial initialization normally. It is
  not a public observer callback request to defer wholesale, and is not public subscribe from a
  user fn. Preserve the same upstream terminal/admission permissions accepted in QA-11; different
  lifecycle acquisition ownership does not create a read-only terminal loophole or inline fn bypass.

Role is semantic execution origin, not "some node has insideRunWave=true on the stack": an
observer callback invoked by ctx.down is still observer code even with its producer's fn underneath.
Foreign SDK/Observable subscriptions in legitimate source adapters are not the GraphReFly public
node.subscribe API; this proposal must not accidentally ban normal source setup. Inspected
firstValueFrom(GraphReFly Node) is explicitly documented host-only, not reactive-body composition.
Same-node closing/retiring fresh-lifecycle rejection remains in force; cleanup is not authority to
bypass it. Other-node subscription initiated by lifecycle hooks must be classified explicitly in
the final origin table (possible observer-style scheduling); this review does not add a blanket
ban on all host resource registration from cleanup, nor prove cross-graph synchronous safety.

Pending ordering recommendation: observer-requested activation must retain its request position
relative to the shared external-request FIFO, rather than globally giving all pending activations
priority over earlier controls/outputs. Establish the activation obligation/order before invoking
that subscription's initial callback, so the callback's newly submitted external work follows the
subscription request. Thus an earlier observer PAUSE(X) precedes a later subscribe(X) activation;
subscribe(X) followed by PAUSE(X) permits the activation first. An initializing callback's DATA30
still follows its subscription's eligible activation DATA10, preserving the earlier accepted10,30
trace. Complete the already executing wave and valid fanout before this new activation begins.
Nested same-callback subscriptions reuse one registration/activation obligation; no second task
or reference count. A blocked activation leaves lifecycle-owned owed activation, rather than
head-blocking the FIFO so RESUME can never execute. Precise minimal scheduler representation is
design work; do not introduce a public activation owner/transfer object or status enum as a shortcut.

Revalidate registration/lifecycle and gates at execution. An off returned before deferred activation
can remove the last owner and cancel that activation. Once nested subscribe returns release, later
activation failure reports at the executing outer operation boundary; QA-12 must not retroactively
pretend that release was never handed off. Failure before its public return still follows the
new-untransferred acquisition rule; surviving independently handed-off B/alias keeps ownership.
Terminal fanout reset/admission and same-callback precedence remain QA-1/2/21, not solved by this
activation policy. Batch fate/order is still QA-18. Public subscribe return proves release handoff,
not guaranteed successful computation or first DATA, particularly for nested/deferred/paused cases.

**Decisions — tradeoffs, pending acceptance.** Prefer public fn-origin rejection over accepting an
undeclared subscription with helper-owned release/effects absent from inspectable graph topology.
Immediate registration/snapshot plus boundary activation preserves existing synchronous initial
delivery/release and nested idempotence agreements while preventing a new node fn inside ordinary
fanout. Cost: snapshot callbacks can still nest, and successful nested subscribe can return before
activation; origin attribution and lifecycle-owned pending work must be represented accurately.
Queueing the entire subscribe would simplify execution placement but change initial snapshot timing,
error handoff and pending-release semantics. Leaving everything immediate permits nested activation
and feedback. Giving activation universal queue priority would conflict with earlier explicitly
queued controls, so prefer admission order with the initializer's activation position established
before its own callback. This is a surfaced new ordering choice, not a claim QA-6 already decided it.

**Work — verified baseline and remaining cases.** Re-read public _subscribeOwned immediate _activate,
private nodeSubscribeDepAt, dispatcher.invoke and source.firstValueFrom docs. Static scan of public
operator/combinator/higher-order/time/source implementations found direct GraphReFly Node.subscribe
in host-only firstValueFrom; the source adapter's other subscribe usage is foreign-interface setup.
This bounded scan is not a proof no application/custom operator uses the rejected pattern.
Added diagnostic `protocol-reconciliation-probes/subscribe-origin-nested-activation.ts`, run from
TS worktree7a26 via node_modules/.bin/tsx plus absolute root probe path, exit0. Cold X subscribed
from either an ordinary state DATA callback or a raw node fn currently traces origin:enter,
X:START,X:fn,X:DATA,origin:exit. Both releases were obtained and explicitly called. This confirms
current nested activation and lack of the proposed public origin restriction; all fn still route
through dispatcher. It does not dynamically prove the ancestor feedback variant or future FIFO.
Later scenarios: raw/sugar rejection with no acquired registration, observer-role override while
producer fn is on stack, immediate cached/dirty/quiet snapshots, duplicate initialization/off,
PAUSE-before/after activation, initializer queued output, independently handed-off owner failure,
terminal fanout, hooks, batch and correct origin/error carrier. No runtime, normative Rules/formal/
conformance, owner ledger, D#, full-suite run, commit or push change. QA-16 remains pending acceptance.

### User accepts QA-16 main matrix; hook origin addendum and QA-17 fanout (2026-10-16)

User accepts the preceding QA-16 recommendation and asks whether anything else needs clarification,
otherwise proceed to QA-17. Accepted review direction: host synchronous subscribe; observer immediate
registration/initial snapshot/release with safe-boundary activation in request order; direct public
GraphReFly subscribe in node fn/sugar/operator bodies rejected before acquisition; runtime-owned
dependency wiring retains its normal declared/partial acquisition path and uniform upstream admission.
Logical origin overrides underlying producer call stacks. Activation order precedes work submitted by
its own initializer, but not controls submitted earlier than the subscription. QA-12 release transfer
and off-before-activation cancellation remain in force. This is review acceptance, not implementation
authorization or activated Rule text.

**Rules — remaining QA-16 origin clarification (pending acceptance).** The prior note explicitly
left lifecycle-hook-origin public subscription classification open. Recommend treating public
subscribe initiated by onInvalidate/onDeactivation user callbacks as callback-origin for scheduling:
ordinary target admission and immediate initialization/release, new activation only after the
current graph flow and synchronous lifecycle cleanup/unwind reach their safe boundary, preserving
request order. A target currently closing/retiring still rejects fresh activation before registering
or START under the already accepted closure guard. This does not let a revoked ctx submit controls,
state writes or hooks, and does not give the closing lifecycle ownership of a newly independently
handed-off subscription on another node. Caller must retain/release that capability normally. It is
not internal runtime dep acquisition or permission to block cleanup awaiting async work. Rejecting
all subscriptions on other nodes from hooks would be an additional restriction without an identified
need; queuing all subscription initialization would change the accepted callback contract. Exact
origin tags and a boundary around release-triggered cleanup are implementation design. This added
classification is recommended explicitly, not silently included in the user's prior acceptance.

**Rules — QA-17 proposed ordinary complete-array delivery contract (pending acceptance).** Activated
R-push-subscribe@1 supplies an initial snapshot role but no registration membership cutoff or cache
publication timing for reentrant fanout. Accepted callback identity, whole-array observation, immediate
removal, initial snapshot and QA-16 activation scheduling must compose. September30 phase-gap live
settlement membership was accepted under an earlier two-phase public candidate, later refined to
ordinary full-array callbacks plus private DIRTY prepass. Do not blindly carry its message-suffix
membership into the new ordinary complete-array delivery.

Recommend: fix candidate registration identities for each ordinary complete array before executing
its observer callbacks, publish that array's final node cache/output facts before those callbacks,
then deliver once per still-valid candidate. A subscription created during a callback receives its
normal immediate snapshot of current published state, but is excluded from this in-flight array.
It participates in later arrays under normal eligibility, without replaying a suffix or the entire
old array as a fresh occurrence. No global all-graph atomic commit is promised by node-local facts
before callbacks; internal DIRTY propagation/settlement scheduling still obeys the diamond contract.
The cutoff is each actual array delivery, not a permanent subscriber set at original down/PAUSE/
batch start, and not a queue of future output pre-snapshotted with today's registrations.

Concrete open-output trace: N publishes normalized [[DIRTY],[DATA,30]], candidate observers A,B.
A's callback subscribes C. C immediately gets its own [[START],[DATA,30]], joins no remaining part
of that same live array, and receives future waves normally. For live DATA23,DATA23,DATA30, A sees
all three occurrences in its intact array, while C's ordinary latest-cache snapshot is DATA30.
An explicitly configured replay snapshot may include more history under its own policy; quiet
PULL still initializes START-only. Snapshot DATA is not a fresh global source occurrence and must
not be broadcast to already established subscribers. No equality suppression is involved.

Before each candidate delivery, revalidate its exact registration identity and origin lifecycle.
A can remove B and skip B's not-yet-delivered array. Removing then re-adding the same callback
creates Bnew: Bnew gets its own initial snapshot, old B's candidate is skipped, and Bnew cannot
replace old B's delivery slot. Repeating subscribe with an existing valid callback remains idempotent:
no new START/cache/current-array delivery, just release alias. A self off/re-subscribe intentionally
requests a fresh initial snapshot and can therefore observe the current cached value again; do not
call that an accidental duplicate of the old registration's live array. Old aliases never remove
Bnew. Actual source lifecycle close stops old fanout and cannot retarget its remainder to reactivation.
Observer failure keeps the accepted continue-valid-fanout/report policy and QA-12 ownership split.

Batch early DIRTY and later commit are separate complete deliveries: C created during the early
notification is excluded from that DIRTY array but can be included when the future commit array
starts. It receives the correct dirty initial snapshot under the earlier START,DATA,DIRTY rule.
Likewise each resumeAll buffered entry takes its own candidates when actually replayed, with pause/
close/terminal revalidation between entries. Thus fixed array candidates do not generally deny a
new join the later settle that clears its initial pending contribution. A truly standalone DIRTY
wave remains separate. Runtime dep rewiring within internal propagation is not proved correct by
the ordinary observer candidate rule alone; retain the separate phase/readiness protections.

If this same complete array seals output via COMPLETE/ERROR, publish that terminal fact before
observer callbacks and preserve QA-11's uniform terminal admission. A new non-resubscribable late
subscription is rejected rather than admitted for cache only and then stranded without terminal.
Resubscribable nested reset, same-callback terminal priority and old-recipient preservation remain
QA-1/2/21; do not reset/drop old candidates mid-fanout merely to admit the new request. This review
does not select a terminal read-only special subscription or claim terminal reentry fully settled.

**Decisions — rationale and alternatives, pending acceptance.** Prefer fixed per-array candidates
with per-delivery identity checks over a live mutable iteration that can double-deliver a newly
initialized registration. Prefer facts-before-observer callbacks over stale initialization plus
replay of the old array suffix, which conflicts with intact-wave delivery and requires more state.
Freezing candidates does not mean delivering to removed registrations. Queueing all subscribe or
making removal only effective after fanout would change QA-16 or immediate cancellation behavior;
neither is needed for the recommended ordinary case. Reuse registration/lifecycle identity already
needed for idempotence and old release aliases; no global registry/public IDs/new message type.
Allocation/iteration strategy and internal propagation integration remain measured design work.
The per-message live-suffix September candidate is refined for ordinary whole-array observers;
separate advance-notification-to-future-settlement behavior remains as described above.

**Work — actual baseline evidence.** Inspected nodeDown: cache/replay/status updates before each
message callback; nodeEmitToSubs copies callback Set per message but does not check whether each
copied entry still has its original registration. Public initial snapshot immediately reads cache.
Added `protocol-reconciliation-probes/subscribe-during-fanout-registration.ts`, run from TS7a26 via
node_modules/.bin/tsx plus absolute root path, exit0. Case1: initial10; A receives DATA23 from an
array DATA23,DATA30 and subscribes C; C gets START,DATA23,DATA30 (initial cache plus later message
suffix). This is current per-message behavior, not future array callback framing. Case2: A on DATA30
removes old B then re-subscribes the exact same callback; B records DIRTY,START,DATA30,DATA30. One
DATA30 is new initialization and one is old copied fanout incorrectly retargeted to that callback.
Surviving releases explicitly called. A single ordinary DATA late subscribe already avoids duplicate
delivery via current copied callback candidates; do not falsely claim every current new join gets
two DATA. The remove/readd case demonstrates why callback copying alone is insufficient.
Future scenarios need array callback recipients, facts-before-callback snapshot, exact identity/off
validation, same-callback aliases, early DIRTY/commit joins, replay/PULL, terminal rejection/fresh
reset and internal connection dirtiness. No source, normative Rules/formal/conformance, owner ledger,
D#, full-suite run, commit or push changes. Hook addendum and QA-17 remain pending confirmation.

### User accepts hook-origin addendum and QA-17 array fanout (2026-10-18)

User replies "同意" to the preceding hook-origin clarification and QA-17 recommendation. Accepted
review direction: lifecycle user callbacks follow callback-origin public subscription scheduling;
ordinary admission/initialization/release remain synchronous, new activation waits for the current
flow/cleanup safe boundary, and closing/retiring target admission still rejects as previously agreed.
This does not restore invalid ctx permissions or transfer ownership of an independent subscription
to the closing lifecycle.

Rules candidate, not activated: each ordinary complete-array delivery fixes its candidate registration
identities, publishes its resulting node cache/output facts before ordinary observer callbacks, and
revalidates exact registration/lifecycle before each delivery. New subscriptions receive their own
normal current-state snapshot but do not join the in-flight array. Removal skips undelivered old
registrations; remove/readd does not retarget an old slot; an existing valid same-callback subscription
remains idempotent. Future arrays take their own candidates, including a batch commit after a separate
early DIRTY notification. Explicit replay/quiet-PULL and terminal admission retain their own contracts.
The ordinary live-message-suffix September candidate is refined accordingly; a separate early
notification does not prevent a newly initialized subscriber joining a later settlement array.

Rationale and work remain in the preceding section; no new flag/API, global registry, runtime or
normative amendment is authorized by this review acceptance. Terminal reentrant reset and callback
identity precedence remain QA-1/2/21; internal propagation integration is not proved by observer
candidate freezing. Next walkthrough topic is QA-18, batch ownership/commit/rollback and queued
callback work. No new diagnostic/full-suite run, owner-ledger/D#, commit or push in this acceptance.

### QA-18 batch ownership, observer requests and accumulated settlement (2026-10-18; pending acceptance)

User requests continuation after accepting QA-16/17. This section proposes the four QA-18 choices;
it does not mark them accepted or amend normative/runtime authority.

**Rules — current contract and reconciliation.** Activated R-wave-boundary@1 expressly distinguishes
outside-batch one down array per wave from inside-batch accumulation until commit as one wave.
Activated R-resolved-undirty@1 preserves DATA occurrences and forbids DATA plus RESOLVED in one
settlement wave. Activated R-two-phase@1/R-diamond@1 still require correct dirty propagation and
join scheduling. graphrefly:D12 supplies declarative success/throw/explicit rollback rationale;
graphrefly:D49 removed implicit occurrence loss/equality substitution. R-same-wave-merge@1 and
R-rewire-deferred-committed-boundary@1 lack activation metadata and must not be promoted through
this review. graphrefly:D110 and earlier accepted self-demand review establish the intended
batch-owned deferred ctx task fate, but do not by themselves define the origin/owner of new public
requests made by an observer of early DIRTY. QA-6/16 selected queuing/admission order; QA-17 kept
early DIRTY and commit as distinct deliveries. "Separate calls remain separate arrays" was explicitly
outside batch; it must not erase the active batch accumulation exception.

Recommendation, pending confirmation:
1. Explicit batch-body updates/staged output belong to that batch. Previously batch-owned ctx self-
   boundary work retains its selected commit fate. Observer-origin public output/control/activation
   requests already covered by QA-6/16 are independently owned accepted requests, not silently batch
   writes merely because an ambient batch frame is on the stack. Keep ordinary lifecycle/connection/
   terminal cancellation authority; "independent of batch" does not mean never cancellable.
2. Do not drain those observer requests while the enclosing outer batch is uncommitted or its commit/
   rollback settlement is still propagating. Complete the batch outcome, balance any already announced
   DIRTY on rollback, then drain eligible independent requests in their queue order, synchronously
   before the owning outer operation returns/reports. Do not absorb them into the staged commit,
   expose their cache/state/control effects at admission, or flush them between batched source commits.
   A body exception/explicit rollback cancels uncommitted batch writes and batch-owned self-tasks;
   it does not erase independent observer requests. Preserve original failures and report actual
   additional operation failures under accepted collection policy, rather than making later queued
   failure retroactively undo an already observed commit. No transaction over arbitrary effects.
3. Each node's successful explicit batch accumulation commits one normalized array, with a DIRTY
   prefix under accepted QA-9 framing. Preserve every admitted DATA, including equal values, in
   same-node submission/value order, plus other lawful messages under the ordinary normalization
   contract. Example three staged submissions DATA23,DATA23,DATA30 commit as
   [[DIRTY],[DATA,23],[DATA,23],[DATA,30]], not DATA30 only or three independent waves. Early public
   DIRTY remains its own delivery; repeated commit prefix does not multiply pending dependency
   membership. Raw fn invocation count, occurrence operator callbacks, and sugar latest-value policy
   remain distinct. Across nodes, this does not create a global per-event historical merge order.
4. Validate accumulated tier-3 exclusivity as each batch submission is admitted. If existing staged
   content for that node has RESOLVED, a later DATA submission conflicts; conversely later RESOLVED
   conflicts with existing DATA. Reject the incoming conflicting submission before changing staged
   contents/creating fresh observable effects, rather than silently overwriting/dropping either
   admitted settlement. If the exception escapes the body, normal rollback follows. If caller handles
   it, earlier valid staged work can remain for commit. An explicit mixed DATA+RESOLVED array is
   likewise invalid. Repeated no-occurrence RESOLVED can normalize to its single settlement; this
   is not loss of DATA occurrence. Automatic no-output synthesis must inspect the eventual logical
   settlement, not inject RESOLVED alongside admitted DATA. No new mixed message type or escape
   from exclusivity is selected. Exact synthesis/admission lowering remains design work.

Concrete observer case, targets open/otherwise eligible: batch stages A20; early A DIRTY observer
calls B.set99. On success, commit A20 and its propagation first, then B99 is a fresh independent
wave. On rollback, discard A20, keep A's old published value, complete its owed no-occurrence
settlement, then process B99 as its own wave. B does not announce DIRTY or change intrinsic/public
state until that queued request actually applies. A PAUSE/RESUME/PULL/INVALIDATE/TEARDOWN request
from the observer follows the same outer batch boundary; it cannot interrupt the middle of that
batch commit merely because the early DIRTY array has returned. Eligible activation retains the
subscription request position under QA-16 after this barrier. A subscription/release already handed
off is not undone as if no off returned merely because the batch later rolls back. Direct body
updates are the explicit batched path; a public observer request is the independently queued path.

**Decisions — alternatives and tradeoffs.** Observer independence makes accepted public requests
and acquired release responsibilities explicit: ambient call-stack state alone cannot silently
withdraw PAUSE or a stable state input. Cost: observing speculative DIRTY can cause a later action
even if the triggering batch rolls back; observers needing committed business values should react
to committed settlement rather than assume DIRTY promises success. Batch ownership for all observer
requests would simplify blanket token tagging but change those requests' guarantees and would not
automatically roll back already performed callback effects/subscription handoffs. Running observer
requests between early notification and commit would absorb separate requests or expose intermediate
views, defeating the whole-batch boundary. Do not remove D110/self-task ownership as a shortcut to
observer independence; origin/ownership attribution needs actual context.

For explicit batch contents, latest-only coalescing is cheaper but destroys counting/scan history;
preserving all admitted DATA is the occurrence-preserving candidate with storage cost proportional
to pending traffic. Keeping only DATA while silently discarding an explicit RESOLVED is a possible
normalization alternative, but reinterprets raw author's protocol submission; current recommendation
is fail-fast on accumulated conflicts under the existing exclusive wave model. Keeping each batch
call separate would avoid this conflict but contradict R-wave-boundary's explicit one-batch-wave
exception and change joins. No bounded buffer/drop flag, event-equality check or async core is added.

**Work — baseline evidence, not candidate implementation.** Inspected batch.ts: active frame, nested
frame joining, Map.set last-submission replacement, outer commit/rollback; boundary.ts and node
deferred ctx requests tag pending batch tokens; nodeDown's early DIRTY callback precedes deferToBatch
registration, and rollback emits the owed RESOLVED. Source code confirms no observer-role override
or proposed external-request FIFO exists on these paths yet. Added bounded diagnostic
`protocol-reconciliation-probes/batch-observer-ownership-and-accumulation.ts`, run from TS7a26 via
node_modules/.bin/tsx and its absolute root path, exit0, five cases:
- Early A DIRTY observer executes B.set99 in the ambient batch. Success caches A20/B99; events
  A DIRTY, B DIRTY, B DATA99, A DATA20 (B enters the batch order during A's early callback).
- Same observer path with explicit rollback keeps A10/B0, emits B/A RESOLVED; B's request was
  absorbed and discarded, unlike the proposed independent observer request.
- Same-node batch DATA23,DATA23,DATA30 delivers only DIRTY,DATA30.
- Batch RESOLVED then DATA30 delivers DIRTY,DATA30 without conflict error.
- Batch DATA30 then RESOLVED delivers DIRTY,RESOLVED and cache remains10: staged DATA was replaced.
Each case explicitly releases subscriptions. This is current per-message/last-write baseline,
not whole-array/FIFO validation. batch.ts itself documents last-write coalescing as a refinement
gap; do not claim this was newly introduced by the walkthrough or that current runtime retention
already satisfies the proposed batch occurrence contract. No new full suite or formal run.

Remaining unified design interactions must stay explicit before declaring all QA-18 combinations
complete: observer invocation of batch() itself versus explicit nested body joining (batch has a
synchronous return value and is not automatically covered by the selected queued message APIs),
partial commit/error reporting versus precommit rollback, blocked owners/request readiness, and
origin-aware interleaving with batch-owned self-boundary tasks. The four recommendations above do
not grant permission to queue arbitrary return-valued APIs or infer global transactional rollback.
Later work: origin/ownership facts, staged accumulation preflight, complete commit/rollback array
framing, per-array registration candidates, state intrinsic-vs-output commit timing, duplicate DATA,
both RESOLVED conflict orders, explicit/throw/nested rollback, observer controls/activation, retained
subscription ownership and combined errors. No runtime, normative Rules/formal/conformance, owner
ledger, D#, commit or push; recommendation awaits user acceptance.

### User accepts QA-18 four directions; nested batch and reporting addendum (2026-10-18)

User says "同意继续" to the preceding four QA-18 recommendations. Accepted review directions:
explicit batch-body updates and previously batch-owned ctx self-tasks retain batch fate; selected
observer-origin queued public requests are independent of that ambient batch; they run after the
outer batch outcome/settlement, not inside commit; accumulated per-node DATA preserves all occurrences
in one batch commit array; accumulated DATA/RESOLVED conflict rejects the new conflicting submission
instead of silently overwriting. User approval does not activate Rules or authorize runtime fixes.

**Rules — two remaining boundaries (recommendation pending acceptance).** Activated R-wave-boundary@1
provides explicit batch accumulation, not an origin-specific admission/return contract. Current
batch returns its body's R synchronously after its immediate commit/rollback path. An observer's
batch call cannot transparently queue the whole body and still synchronously return its R. Existing
QA-6 queued message methods/QA-16 subscribe release handoff do not automatically authorize queueing
all return-valued APIs. Ordinary callback exception isolation was accepted for complete valid fanout
and outward operation reporting, not automatic protocol ERROR or global rollback of visible data.

Recommend reject public batch() invoked from runtime observer/initialization/lifecycle user callbacks,
and from node fn/sugar/operator bodies, before invoking its body or starting/joining a frame. This is
a NEW public origin restriction to confirm, not current behavior or an already active R-reentrancy
clause. Directly scripted nested batch calls inside an admitted host batch body still share the
outer frame, with no savepoint/separate commit: explicit inner rollback marks the shared frame for
rollback. An inner exception that escapes the outermost body causes rollback; if handled inside the
outer body, it is not a separate automatic savepoint rollback and the shared frame can retain its
earlier valid staged contents unless explicit rollback is requested. Runtime-triggered callbacks
retain their semantic origin despite being on that host batch body's stack.

The ordinary observer can still submit the previously selected public output/control/subscription
requests with their accepted independent FIFO rules; rejecting batch does not reject those. It does
mean no grouping multiple such observer requests as a fresh batch through the existing API. A real
consumer need for that grouping would justify separately designing explicit deferred batching;
no new batchNext API, Promise result, microtask workaround or automatically queued closure is selected.
Foreign event/host callbacks that call graph APIs while no graph execution is active are ordinary
host entrypoints, not runtime observer callbacks merely because JavaScript calls them callbacks.

Error boundary recommendation: only an explicit precommit rollback or a body failure escaping the
outermost body cancels uncommitted batch contents under that path. An ordinary observer callback
error is collected under the accepted observer policy; it does not abort remaining valid delivery
or later staged target commits and is reported after the batch settles and required eligible boundary
work completes. Thus for staged A20,B30 with A's delivery observer throwing: A20 and B30 still commit;
finish valid fanout/dirty settlement, then batch throws the original error (or aggregate). An outward
throw does not imply published updates were rolled back. Do not manufacture a source protocol ERROR,
retry or automatically unsubscribe that established observer. Early-DIRTY observer failure likewise
belongs to collected operation reporting; it is not itself an escaping batch-body exception that
silently prevents the batch body from continuing under the isolation model.

Collected observer failures do not prevent marking the otherwise completed data commit as committed
for its batch-owned self-boundary tasks; do not lose legitimate deferred work merely because an
observer error will be reported afterward. On actual precommit body rollback, cancel batch-owned
tasks and settle announced DIRTY, then service eligible independent observer requests and report
original/additional outward failures. Failure during those later requests cannot undo the already
published batch. Cleanup aggregation/lifecycle/terminal cancellation remain their own established
contracts. No graph-wide transactional undo of external effects or raw output history is promised.

This isolates the verified ordinary-observer case, not every possible internal/runtime/uncaught raw
fn fault during commit. Their operation-local failure routing and safe bookkeeping must be specified
and tested under the existing owner boundaries; this note does not claim arbitrary partial internal
failure is recoverable, continue after corrupted invariants, or blindly synthesize RESOLVED for a
still-owned manual async result. Never label an internal partially published commit as a successful
rollback. Internal fault recovery is not newly authorized by observer isolation.

**Decisions — alternatives and tradeoffs.** Rejecting graph-callback batch is the smallest explicit
contract that preserves immediate host batch return semantics and avoids implicit nested commit/
ambient-frame capture. Cost: observer code cannot currently atomically group several independent
requests; making that limitation explicit is preferable to pretending each caller already has a
deferred batch capability. Alternatives: queue the whole body (requires a changed return/error
contract), or execute its body now into an independent staged frame and commit later (can preserve
body result but needs separate frame/ownership, early-DIRTY timing and partial-effect semantics).
Neither alternative is impossible, but neither is free or selected without a consumer need. Keeping
all callback batch calls immediate retains nested propagation/rollback surprises. Separating body
rollback from observer delivery failures avoids attempting to retract DATA/effects already visible;
it refines overly broad "any throw means rollback" wording, rather than adding distributed commit.

**Work — actual evidence.** Re-read active batch joining, commit loop, rollback and Graph.batch's
pass-through return. Added probe `protocol-reconciliation-probes/batch-nested-callback-and-commit-error.ts`,
run from TS7a26 using node_modules/.bin/tsx plus its absolute root path, exit0. Case1: early A DIRTY
observer runs inner g.batch setting B99 and returning42; outer explicit rollback yields innerResult42,
A cache10/B cache0. The inner body ran immediately and joined the ambient batch; proposed rejection
is not implemented. Case2: staged A20,B30; A DATA observer throws exact Error during commit. Current
batch throws, A cache20, B cache0/status dirty, B only saw DIRTY. This proves partial commit and
missing continuation/settlement in the baseline observer case. Diagnostic explicitly calls B's
rollback bridge afterward to remove that known debt, then releases subscriptions; that recovery
was NOT performed automatically by the baseline. It does not validate future complete-array error
collection or recovery of arbitrary internal faults. No source, normative Rules/formal/conformance,
owner-ledger/D#, full suite, commit or push changes. Addendum remains pending confirmation.

### User accepts QA-18 addendum; QA-19 public down ownership (2026-10-18)

User says "同意，继续" to the preceding QA-18 addendum. Accepted review direction: reject public
batch invoked from graph observer/initialization/lifecycle callbacks or node fn bodies before its
body executes; ordinary host batch and explicit nested body sharing remain. Uncaught outer body
failure/explicit rollback cancels uncommitted work; ordinary observer delivery failures are collected,
valid remaining fanout/target commits and required settlement continue, and outward reporting follows.
An observer error after data commit does not retroactively mark that commit rolled back or discard
otherwise lawful batch-owned boundary work. No arbitrary internal-fault recovery or deferred-batch
API was selected. Implementation/error-carrier/origin bookkeeping remains work, not runtime approval.

**Rules — QA-19 ownership gap and pending recommendation.** Activated R-terminal@1 seals output
until eligible fresh reset; activated R-wave-boundary@1 defines output waves and batch accumulation.
R-node-iface@1 and R-rom-ram@1 lack activation metadata; their public down surface and manual-source
versus compute-cache retention describe relevant historical intent, not a fully activated answer.
Earlier accepted review makes ctx output lifecycle-owned, stable state.set input node-owned, and
terminal sealing independent of actual lifecycle close. It leaves public down on fn/dependency-bearing
nodes unclassified, so neither all-public-is-stable-input nor all-down-is-lifecycle-output follows.

Recommend retain public down as an active-lifecycle raw output escape for computed/producer nodes,
but bind that admitted request to the target lifecycle in which it was accepted. Presence of an
external node reference does not turn arbitrary compute output into intrinsic state. If that
lifecycle closes before execution, drop the accepted request without cache/state/terminal mutation,
no automatic activation, and no retargeting to a later lifecycle. A new direct public down on such
a node without a live lifecycle rejects before admission (including closing/released checks), rather
than implicitly activating it or populating inactive compute output. A lifecycle held by an independent
retaining owner remains valid after just one subscriber exits. "Live lifecycle" includes valid owned
pending activation, not a claim fn has already run or wiring fully succeeded. Failed setup still
uses its accepted old-result permission/input-consumption split; output acceptance does not repair it.
This active-only public admission is a new direction to confirm, not current code or activated rule.

Manual input role remains distinct: state.set and public down on existing bare manual ingress
node([],null), without deps/fn, are stable node-input requests and can apply without subscribers or
survive ordinary nonterminal last-off. StateNode.set currently delegates directly to public down;
its DATA path must use the same assignment/ownership policy, not a second write bypass. Computed
nodes include depless fn producers and dependency-bearing passthroughs as well as ordinary derived
nodes. Classification is not "deps.length===0 means stable state". ctx.down always retains originating
ctx lifetime authority; public manual input has node intent, and public computed down uses current
target lifecycle at admission. Do not bind all public requests to the subscriber that submitted them.
No new public down mode, queued-request revival flag or second intrinsic value for all nodes.

Separate output-epoch rule: an admitted output/input request cannot regain delivery permission merely
because current terminal later becomes undefined. Capture its current output epoch at admission and
revalidate at application along with applicable lifecycle ownership. Terminal taking effect seals
that epoch; an eligible fresh reset creates a fresh output epoch, without reviving its old requests.
Ordinary nonterminal manual-source last-off does not by itself change the stable input epoch, so
state requests still survive as previously selected. Computed ordinary close already cancels its
lifecycle-owned requests. A state request blocked by terminal/old epoch must not advance intrinsic
state before being dropped. Reuse terminal plus epoch/lifecycle identities; no historical failure
ledger, public status field, per-job tracking or new message type is implied. Exact minimal storage
is later state design, not an already implemented flag arrangement.

Example: valid N.down(DATA30) is admitted during an observer callback, then the last retaining owner
of computed N leaves before drain. Cancel that request; later subscribe starts N normally without
seeding30 from it. In contrast S.set30 on an open manual state survives the analogous last-off and
can update its retained state with no subscriber. In an unchanged epoch, queued DATA30,COMPLETE,
DATA40 executes in order, with DATA40 dropped after sealing. A genuinely later eligible reset and
new DATA50 belongs to the fresh epoch. Do not assert that merely calling subscribe after enqueueing
COMPLETE already resets: enqueue is not terminal application. Nonterminal subscribe still acquires
the current eligible lifecycle; a terminal reset may only be requested once terminal is effective
and its admission/boundary permits it. Terminal fanout/retains/reset remain QA-1/2/21; this note does
not dynamically establish an interleaving forbidden by those pending admission rules.

Limit to be explicit: an old callback that retains only the public node and invokes down afresh
after a new lifecycle already exists is making a new current-node request. The runtime cannot
infer its historical producer origin. Async completions needing old-lifecycle isolation should use
their captured ctx.down, or helper-owned cancellation, not assume public node references preserve
old invocation provenance. Binding already accepted requests is different from classifying a future
new call; retain the same public-node versus captured-ctx distinction used for up routing.

**Decisions — alternatives and tradeoffs, pending acceptance.** Stable ownership for every public
down preserves broad injection convenience but can repopulate an inactive compute cache or terminate
a later lifecycle with old queued work. Lifecycle ownership for every public input would reverse
accepted state/manual ingress semantics and break real node-backed command/delta sources. The split
preserves both existing roles at the cost of explicit admission/owner/epoch checks. A stricter
alternative is forbidding public computed down entirely and requiring ctx output; that would remove
an escape surface and requires a separate consumer/API choice. Current recommendation keeps it
while active; no extra option/scope parameter or factory-name exception is introduced. Current-role
changes via rewire and pending stable-input capability conversion still need qualification; do not
silently turn an ingress into a persistent-input compute hybrid or retarget existing ownership.

**Work — actual baseline evidence and real consumers.** Inspected Node.down (released check only
before _down), nodeDeactivate (compute cache clear), _down terminal guard and _resetLifecycle,
StateNode.set, graph/adapters public down sites. Real stable inputs include collectionCore.delta,
wire bridge command/inbound, timeout inputs and releaseCohorts: explicit bare node([],null). Source
operators normally emit via captured ctx. reactiveMap.intent in graph mode is a no-op fn operator,
while non-graph mode uses bare manual input; graph mode retains apply, which owns its intent
subscription. It is not proof all depless fn nodes are manual input. This is an integration audit
item: preserve the component's intended lifetime via its existing owner or explicitly reconcile its
ingress representation, not a hidden factory-name bypass. The bounded scan is not all app consumers.

Added diagnostic `protocol-reconciliation-probes/public-down-after-compute-close.ts`, run via
node_modules/.bin/tsx plus its absolute root path from TS7a26, exit0. Case1: producer emits10 on
activation, last-off clears cache; inactive public down(DATA30) currently repopulates cache30 without
running fn; next subscribe sees DATA30 snapshot then activation DATA10, runs2. Case2: public COMPLETE
after producer close marks inactive node completed; later non-resubscribable subscription rejects.
Case3: last-off then state.set30/manual-source down40 retains their respective cache30/40, as intended
for stable inputs. Surviving acquired releases explicitly called; no external resources. These are
current direct-call diagnostics, NOT proposed observer FIFO/epoch isolation or restart tests.
Later scenarios need admission-before-mutation, computed/passthrough/producer/manual/state roles,
retaining-owner versus actual close, pending activation, queued terminal versus effective seal,
fresh epoch/reset, stale ctx versus new public calls, and consumer ingress/rewire integration.
No runtime, normative Rules/formal/conformance, owner ledger, D#, full-suite run, commit or push.
QA-19 recommendation remains pending acceptance.

### User accepts QA-19; QA-20 FIFO execution versus buffered delivery (2026-10-18)

User says "同意，继续" to QA-19's ownership/admission recommendation. Accepted review direction:
manual state/source input remains stable node intent; ctx output retains original ctx lifecycle;
computed/producer public down binds to target live lifecycle at admission, closes cancel admitted
requests, fresh inactive public computed down rejects. A retaining owner preserves that lifecycle.
Output epoch seals survive reset for old request validation, without cancelling stable manual input
merely on ordinary nonterminal last-off. A later fresh public call is current-node intent, not
automatically inferred as an old producer completion; captured ctx remains the isolation surface.
No new mode/API/status, normative activation, runtime change or blanket consumer migration approved.

**Rules — QA-20 is a composition clarification, not a new terminal policy.** Activated R-terminal@1
seals output. Draft R-pause-modes@1 lacks activation metadata and has other historical conflicts;
do not call it fully current authority. The user previously accepted resumeAll output buffering,
terminal bypass and discarding all still-held output, including DATA held from a terminal-containing
array. QA-6/18 selected ordered request application at safe boundaries, not guaranteed subscriber
visibility of every accepted output. R-undirty-settle-timing@1 remains normal settlement timing;
terminal completes stream settlement without a fabricated post-terminal RESOLVED.

Clarification: request FIFO preserves issue/application order among executable requests; applying
one request can move its output into the lifecycle-owned resumeAll buffer. This is not completed
delivery. A later COMPLETE/ERROR can take effect in order, discard held output and seal the epoch.
Therefore "DATA30 then COMPLETE delivers30 then terminal" must be qualified to cases where DATA30
is actually deliverable before terminal, not used as an override of buffering or close/terminal
cancellation. Example paused resumeAll target: execute DATA30 -> buffer30; execute COMPLETE ->
discard30, emit COMPLETE; later RESUME -> no30 and no extra RESOLVED. ERROR is analogous. If RESUME
lawfully drains30 before terminal takes effect,30 remains delivered and cannot be rolled back.
Ordinary observer callback queuing does not allow a terminal request to cut into an already executing
complete array; process that array's valid fanout first. Terminal may discard still-held future
entries at its next lawful application boundary, not undo completed delivery. Preserve per-array
pause/revalidation, epoch and independent request versus buffer ownership from prior agreements.

**Decisions — rationale.** No new choice between "FIFO" and "terminal drops buffer" is necessary:
they govern request application and output retention respectively. Retain the user's chosen immediate
terminal/held-output-drop policy. Delaying terminal until buffer exhaustion or force-flushing held
DATA before terminal would reverse that choice and may await an indefinitely held pause; neither
is selected. This also does not turn default PAUSE back into output buffering for prestarted work,
or alter stable intrinsic state versus published cache under QA-4. No delivery ACK/per-task tracking.

**Work — bounded verification.** Re-read nodeDown's pause-slice buffering, COMPLETE/ERROR buffer
clear, and nodeOnResume terminal guard. Added diagnostic
`protocol-reconciliation-probes/resumeall-terminal-after-applied-data.ts`; run from TS7a26 with
node_modules/.bin/tsx plus its absolute root path, exit0. Three direct successive-application cases:
paused bare manual source buffers DATA30, then COMPLETE or ERROR clears buffer; RESUME delivers
no DATA, only the corresponding terminal observed. If RESUME precedes COMPLETE, visible types are
DIRTY,DATA,COMPLETE with DATA30. All subscriptions explicitly released. This validates the existing
buffer/terminal output composition only, not proposed observer FIFO/whole-array scheduling, intrinsic
state separation, or terminal reentry. Wording/scenarios need to qualify FIFO visibility in future
normative reconciliation; no new semantic fork identified. No runtime, normative Rules/formal/
conformance, owner ledger, D#, full-suite run, commit or push. Next substantive topic QA-21: terminal
reset with ordinary observers, dependent subscriptions and retaining owners.

### User confirms QA-20; QA-21 terminal reset with existing owners (2026-10-18; pending acceptance)

> Reassessment below ("QA-21 use-case validation challenges zero-old-owner admission", 2026-10-18)
> withdraws zero-old-owner/manual-release as the general recommendation. It was never user accepted.
> Preserve this earlier proposal/rationale as history, not as a selected semantic lock.

User says "同意，继续" to QA-20's execution-versus-visibility clarification. Confirmed review wording:
FIFO does not guarantee DATA delivery when resumeAll buffers it and a later terminal drops held
output. Previously delivered arrays are not retracted; terminal/close revalidation applies normally.
No new terminal policy selected. Continue to QA-21, which reveals a material revision of an earlier
accepted reset-admission direction rather than merely another status field or implementation fix.

**Rules — conflict and pending replacement direction.** Activated R-terminal@1 currently allows
resubscribable late subscribe to reset before installing the new sink; it does not require existing
owners to release first. September27 accepted close-before-new while detaching terminal-era
subscribers. September28 separately accepted output terminal with lifecycle still active and no
automatic unsubscribe/cleanup on terminal. QA-11 preserved uniform upstream admission, QA-12/16
made ownership handoff explicit, and routing review separated declared topology from active leases.
Clearing all old subscribers during a fresh public subscription therefore revokes unrelated owners'
leases, including active dependent acquisition and graph retain, without their normal release path.
Declared topology remaining is not by itself the violation: inactive declared edges are lawful.
The concrete conflict is an active dependent still holding an acquired release/dep record while
the target silently discards that acquisition to serve another owner's restart.

Recommend revise the earlier "detach old subscribers to restart" direction: resubscribable grants
eligibility for another lifecycle, not authority to evict existing owners. A NEW subscription that
would reset terminal output is admissible only after all valid registrations/retaining owners of
the old lifecycle have been released and the old delivery/invocation/cleanup unwind has finished.
Reject before installing registration or emitting START if those conditions do not hold. No implicit
wait-until-owners-leave queue, no auto-unsubscribe on terminal, no forced downstream close or topology
rewire, and no transferring old owners to a new stream epoch. Non-resubscribable still rejects new
terminal acquisition. Eligible zero-owner resubscribable reset keeps normal close-before-new cleanup,
retention, locks, ctx revocation, output epoch and first-run rules; cleanup failure stops this attempt
and is reported without a persistent restart blockade or repeated completed cleanup.

Owner checks include ordinary valid callback registrations, runtime-owned dependency acquisitions,
and retain leases uniformly. They need no new public owner-kind enum or special-case exception for
"important" subscribers. One owner's release is insufficient when another remains. Declared but
inactive edges alone do not count as active leases; they remain topology and can acquire a lawful
subscription on later activation under the same uniform terminal admission. graph.retain currently
uses an ordinary no-op subscription; it is not a detached flag that reset may discard. Closing B's
lifecycle or an explicit lawful rewire can release B's A subscription; merely terminating A does
not grant a new observer permission to do so on B's behalf.

Concrete trace: A resubscribable, active B depends on A, graph.retain(A) also holds A. A COMPLETE
leaves both owners under the previously chosen terminal/lifecycle split. New C subscribe(A) rejects
without changing A, B, or retain. If retain releases but B still owns its acquisition, reset still
rejects. After B releases that acquisition through its normal lifecycle/rewire path, all old owners
are gone and cleanup/unwind is complete; a later fresh subscribe(A) may reset and activate. B's
declared A edge can remain while B is inactive; it is not secretly retargeted to the new lifecycle.
If a consumer needs B to continue while another A execution starts, construct/own a fresh A branch
or explicitly redesign those ownership/rewire boundaries; no generic forced upstream restart chosen.

Intersection with QA-1: if called inside the old terminal fanout, valid old recipients still own
registrations, so a new resetting subscription rejects and cannot cut off sibling delivery. Even
if explicit off calls remove every registration, the old node's in-flight delivery/unwind must
finish before fresh reset; extend the existing retiring-execution guard to cover that delivery,
not just an inside-fn flag. This is a surfaced admission proposal requiring confirmation, not a
claim that the baseline already protects terminal fanout. An explicit off can still skip a sibling
under QA-17; the restriction prevents reset from silently evicting it. Same-callback idempotence
versus terminal priority is QA-2 and still needs an explicit ordered check: the owner admission
proposal concerns a genuinely NEW registration/reset attempt, not a silent choice to restart or
reject a request that may only be asking for an alias of an existing registration.

**Decisions — alternatives and tradeoffs.** Prefer zero-old-owner admission because ownership and
release stay with their existing holders, and terminal no longer doubles as permission for one
observer to restart everyone else's shared node. It avoids migrating dependent records, inventing
a permanent owner registry or treating retain as expendable. Cost: resubscribable no longer means
any late subscriber can restart while old terminal observers/retains remain; callers must explicitly
release the old subscription, and a retained helper can intentionally prevent restart. This is a
material narrowing of activated R-terminal and the September27 review acceptance; surface it for
approval and amend normative/formal/conformance before implementation. Close-before-new sequencing
survives; forced old-owner detachment does not. Alternatives: force-close all owners as before
(requires an explicit revocation contract and reentrant fanout/dep/retain handling), or carry existing
owners into the new lifecycle (changes terminal stream semantics, dep state and release provenance).
Neither is a free preservation of existing relationships. Special-casing only dep/retain owners but
evicting ordinary observers complicates the uniform subscription ownership principle.

**Work — concrete current baseline.** Read node._subscribeOwned reset-before-install, nodeResetLifecycle
subscriber Set clearing, Graph.retain (node.subscribe(noop)), dependency acquisition owner recording,
and lifecycle.test.ts terminal-reset detachment test. Added diagnostic
`protocol-reconciliation-probes/terminal-reset-with-dependent-and-retain.ts`; run from TS7a26 with
node_modules/.bin/tsx plus absolute root path, exit0. A producer emits run number and opts resubscribable;
B derived from A with completeWhenDepsComplete:false remains active, retain(A) adds a second owner.
After A COMPLETE, subscriber count remains2. New C subscribe resets A immediately, runs becomes2,
subscriber count1 (only C). New A DATA99 reaches C ([2,99]), B stays [1], B.deps still references A,
and describe still declares A->B. Surviving acquired releases explicitly invoked. This verifies the
silent old lease loss; it does not validate zero-owner rejection, terminal callback safety or new
cleanup/epoch guards. Current tests expressly expect ordinary observer detachment, so do not call
the proposed admission narrowing an already implemented conformance fix.
Later work: old owner count/validity and normal close, dep/retain/observer combinations, inactive
declared edges, rejection before START/acquisition side effects, unwind guard, original cleanup
failure policy, same-callback terminal alias ordering QA-2, and no auto-transfer/retry. No runtime,
normative Rules/formal/conformance, owner ledger, D#, full-suite run, commit or push changes.

### QA-21 use-case validation challenges zero-old-owner admission (2026-10-18)

User challenges the pending zero-old-owner recommendation as potentially incompatible with library
use cases and requests verification. This is reassessment authorization, not acceptance of that
proposal or runtime change. Research scope: terminal re-subscription, shared source reset, repeat/
retry with a persistent outer consumer, retained graph roots and completed-result replay. Applied
root research/design-review/decision-guard workflows, using current source and runnable baselines;
external library contracts are comparison evidence, not GraphReFly authority.

**Rules — correction and unresolved contract.** Activated R-terminal@1 and existing TS tests permit
resubscribable late subscribe without manual release of terminal-era observers. The earlier accepted
close-before-new direction still needs safety and owner semantics; it cannot be repaired merely by
adding a universal count==0 check while also retaining the selected "terminal does not automatically
unsubscribe/deactivate" behavior. Such a combination obstructs the current late-new-execution use
case and lets a long-held retain prevent every further execution. Counterexample is enough to reject
the claim that the earlier proposal generally covers ordinary resubscription needs. Withdraw it as
the general recommendation; no approved Rule or earlier user acceptance is silently changed here.

Material distinction from comparisons: retaining a subscription/release object is not necessarily
retaining a live subscription to its execution. RxJS ends a Subscriber on complete/error; our agreed
terminal/lifecycle split presently leaves registrations/leases until explicit close/release. A
zero-ACTIVE-subscriber condition can naturally hold after RxJS terminal without caller action, but
the proposed GraphReFly condition required manual release under a different contract. Do not claim
RxJS permits concurrent active old consumers to be silently cut off, or that its semantics can be
copied while ignoring our different resource/terminal ownership. Declared graph identity, one
execution's stream subscription, and any longer-lived keepalive intent need explicit reconciliation.

Safe-boundary/ctx/cleanup requirements survive the reassessment: complete valid terminal fanout before
fresh execution; do not revive old ctx or queued output; close the previous execution through its
normal cleanup/error route; do not automatically migrate a terminal consumer to a fresh stream or
force a downstream restart. But do not require callers to manually release every FINISHED stream
subscription merely to let a new consumer start another opted-in execution. The recommended next
design discussion is whether/how terminal finishes stream registrations independently of resource
lifecycle closure, and whether retain owns one execution or a cross-execution node intent. These
may require reopening selected "terminal does not auto-unsubscribe" details; do not silently pretend
this distinction is already implemented or solved by another public flag. No final replacement
owner/retain scheme is selected or newly approved by this validation.

**Decisions — verified comparison and scenario coverage.** Primary sources checked 2026-10-18:
- RxJS7.8.2 share source/doc comments:
  https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/operators/share.ts
  default resetOnComplete/resetOnError true; source terminal finishes old subscribers, later new
  subscription can create fresh source execution. Terminal reset is explicitly not transparent retry
  for old consumers; retry/repeat should be placed before sharing for that use case.
- RxJS7.8.2 Subscriber:
  https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/Subscriber.ts
  _complete/_error call unsubscribe in finally after notifying the destination. Callers need not
  manually unsubscribe the old object before subscribing a new one. This differs from current
  GraphReFly terminal-held registration semantics.
- RxJS repeat docs: https://rxjs.dev/api/operators/repeat ; repeat resubscribes on completion,
  retry on error. Its source execution model is not identical to our shared node identity.
- RxJS7.8.2 shareReplay:
  https://github.com/ReactiveX/rxjs/blob/7.8.2/src/internal/operators/shareReplay.ts
  completed results remain cached (resetOnComplete:false). This is another legitimate consumer
  policy, not an implicit request to restart. GraphReFly QA-11's terminal readonly admission choice
  differs and would need its own explicit reassessment if that capability is wanted; do not conflate
  it with zero-old-owner reset or silently replace QA-11.
- Specific callbag-share implementation:
  https://github.com/staltz/callbag-share/blob/master/index.js
  broadcasts terminal then empties its sink list; subsequent subscribers can connect again without
  manual cancellation from all finished sinks. This is a bounded source inspection of that operator,
  not a claim about all Callbag libraries or proof of safe nested terminal reentry.

Scenario verdicts: same shared source's later new subscriber after completion is obstructed by the
zero-manual-owner candidate under our terminal-retention contract; outer retry/repeat can remain
subscribed while inner executions change, which is a different ownership boundary; long-term retain
versus execution-scoped subscription cannot be settled by one total count; completed-cache replay
is a separate terminal admission policy. Explicit full teardown/rebuild is supported by the candidate
but insufficient as a universal replacement for these other patterns. An old consumer that already
received terminal should not unexpectedly receive the next execution, even while its stored object
or declarative node relation remains accessible.

**Work — runnable evidence and bounded local consumer scan.** Found installed RxJS7.8.2 via checkout
resolution; installed nothing. Added
`protocol-reconciliation-probes/terminal-resubscription-rxjs-comparison.ts`, run from TS7a26 with
node_modules/.bin/tsx and its absolute root path, exit0, five cases:
1. RxJS share controlled source: A/B subscribe, source emits1 and completes. A/B objects are retained,
   neither manually unsubscribed, both report closed=true, first teardown occurs. C subscribes and
   starts execution2, gets2, completes; a=[1],b=[1],c=[2], executions2/teardowns2. Confirms no old
   consumer migration and no required caller release of already closed subscriptions.
2. RxJS retry(1): one outer subscription receives7 after first source attempt errors and second
   succeeds, executions2. Confirms persistent outer consumer across inner attempts, not automatic
   revival of a consumer that already received terminal.
3. RxJS shareReplay buffer1/refCount true: two sequential subscribers both receive1, executions1,
   both closed. Confirms cached-completed-result policy, separate from reset.
4. Current GraphReFly producer resubscribable:true emits run number+COMPLETE. Keep offA without
   calling it, subscribe B: executions2, A=[1],B=[2]. Old registered count before B is1, so the proposed
   zero-old-owner admission predicate would reject. Predicate reported only; no proposed gate was
   installed. Both current returned releases explicitly invoked afterward.
5. Current GraphReFly factory repeat(() => [1,2],3) delivers [1,2,1,2,1,2] through one outer subscription
   and completes. This real existing approach already covers repeated fresh inner work without
   restarting the same shared node while its owners remain. Explicit release afterward.

Static scan: literal resubscribable:true in packages/ts/src occurs in the two lifecycle tests, not
production adapter calls in that bounded scope; this does not prove no dynamically configured/app
consumer exists. lifecycle.test.ts explicitly expects new subscription to reset while old observer
has not released. higher-order.repeat requires a fresh factory node each round and uses rewireNext;
environment-websocket-session handles connection error/completion as DATA retry events and starts
another attempt within a still-open outer source. It is not evidence every adapter needs same-node
terminal reset, and strict owner admission would not break every existing resilience path. No new
full suite or formal run, no competitor runtime package installation, and no comparison claim beyond
the inspected versions/cases. Earlier callbag raw README URL returned404; relied on official repo/
specific share implementation instead. No source, normative Rules/formal/conformance, owner ledger,
D#, commit or push. QA-21 remains OPEN for revised design; zero-old-owner is not the selected solution.

### QA-21 terminal subscription, execution cleanup and retain scope (2026-10-18; accepted direction)

User says "好，继续像你说的", authorizing the proposed next design discussion, not approving a
replacement lifecycle scheme. This section separates stream subscription completion, execution
resources, stable node/topology and longer-lived composition. The prior universal manual zero-owner
gate remains withdrawn. No implementation or authority mutation beyond this existing review note.

**Rules — verified premises and proposed direction.** Activated R-terminal@1 seals output and
permits eligible resubscribable reset; R-cleanup-hooks@1 and R-ctx-state@1 define cleanup and fresh
lifecycle retention. Earlier review explicitly retained subscriptions/resources after terminal until
off or close-before-reset. That combination supports delayed cleanup but leaves take/first-style
completed branches holding upstream leases. Reframing a terminal registration as "finished for
delivery" without releasing it can remove a restart blocker, yet does not fix completed branches'
continued resource ownership. A current Node/declared edge persisting does not require an ended
stream subscription to remain an active resource lease forever.

Initial inclination in this turn was to preserve terminal-alone no cleanup, mark delivery finished
and retain off-or-reset cleanup. A new concrete take(1) probe below shows the cost of that scheme;
therefore the FINAL recommendation for this turn is automatic subscription retirement at a safe
boundary. Do not treat the earlier commentary inclination as a separate accepted proposal.

Pending recommendation:
- COMPLETE/ERROR delivered as OUTPUT terminates this execution's stream subscriptions. Complete
  the terminal-containing full array's valid fanout and safe current-fn/unwind work before automatic
  retirement; do not clear recipients halfway through or revoke a still-running operator's ctx
  merely inside its terminal-emitting down call. take currently writes ctx.state after down returns.
- Automatically release those finished registrations/leases under ordinary idempotent resource
  ownership. If this removes the last real owner of an execution, perform normal lifecycle close,
  ctx revocation and cleanup under the agreed safe ordering and failure policy. A branch completing
  releases its own upstream lease; an upstream shared by another still-live branch remains running.
  This is not a force-close of the entire declared graph, auto-retry, or guaranteed preemption of
  arbitrary already-running source/host work. Helpers still own cooperative cancellation/resources.
- Release handles returned to callers stay safe/idempotent after automatic retirement and cannot
  remove a fresh registration/lifecycle. A subsequent opted-in resubscription need not manually off
  old finished subscriptions first, nor migrate those old consumers into the new stream. New execution
  starts only after required old cleanup/unwind and applicable permission checks, preserving cleanup-
  failure reporting/no persistent blockade and output-epoch isolation.
- graph.retain remains an ordinary subscription keeping its current execution alive while open.
  It is not a hidden permanent promise to restart or follow the same Node across terminal epochs.
  Its subscription ends at that terminal too; it neither loops automatically nor transfers to a
  later execution. Cross-attempt/repeated keepalive is expressed by retaining an outer still-open
  factory/retry/repeat/session composition, using existing mechanisms. No retain mode/owner-kind
  enum/cross-epoch resubscribe service is selected. Users needing a distinct permanent topology-level
  ownership capability must surface that need separately rather than changing retain implicitly.
- Declared topology/node identity and applicable intrinsic/persisted data remain under their existing
  retention owners. A dependent can retain the terminal input/value from the finished upstream run;
  its declared edge is not secretly removed or rebound to the next upstream epoch. Recovery/repeat
  that wants another stream explicitly manages new acquisition/inner binding, as already designed.
  Automatic resource lease retirement is not a topology rewire or automatic downstream restart.

This revises the September review's terminal-does-not-auto-unsubscribe/close direction; do not disguise
the change by claiming cleanup is merely indirect and therefore semantics unchanged. Terminal now
drives automatic retirement at a safe boundary, whereas before manual off/reset was required. Cleanup
still uses owner-local machinery and need not happen in the middle of terminal delivery. New explicit
semantic approval and normative/formal/conformance reconciliation are required before implementation.
Logical subscription idempotence should apply to a still-live registration, not indefinitely reuse
a completed one; exact same-callback order and fresh admission inside terminal callbacks remain the
next QA-1/2 trace to review, rather than a secretly finalized scheduler API here.

**Decisions — evidence-driven tradeoffs.** Prefer automatic retirement because take(1)/first/early
completion should finish their use of upstream resources without retaining an otherwise unnecessary
lease until host code manually calls off. It preserves normal owner sharing: releasing one branch
does not stop unrelated consumers. Retain follows the same one-execution subscription meaning as its
existing implementation and does not add a second keepalive axis. Cost: changes previously accepted
terminal/lifecycle behavior, the steady-state status view, and deferred ctx work/cache retention
intersections. The alternative of keeping leases until explicit off or new reset maintains old
timing but requires users/operators to manage ordinary ended-stream cleanup and can leave take
sources running. A delivery-finished marker alone does not solve that resource case. Do not add
terminal-only cleanup hooks or arbitrary resource tracking merely to preserve both incompatible
rules. Runtime cannot force source setup/iterators to stop external work without their cooperation.

Important unresolved interactions before calling this design complete:
1. R-rewire-deferred@1's recorded text permits preterminal queued topology work to drain after terminal
   (activation metadata is absent; see the subsequent correction).
   Automatic closure cancels lifecycle-owned queued work. Need explicitly reconcile eligible terminal
   drain versus closure ordering, and paused/batch-gated tasks; cannot silently claim both unchanged
   or wait indefinitely for a pause to release. Reuse ordinary closure cancellation only after the
   revised contract chooses the boundary. No blanket removal of D62/QA-6/QA-18 is inferred.
2. Normal compute close clears its output cache/nonpersist state. Automatic terminal close affects
   the terminal cache/inspection/checkpoint story; decide what terminal result facts remain without
   pretending old execution resources must stay active to retain a value. Plain-state intrinsic
   retention and terminal sealing from QA-4 are separate. Do not silently add a second cache.
3. User off during terminal callback versus automatic safe-boundary release, synchronous returned
   cleanup, same-callback new subscription and new activation before old fanout unwinds need the
   concrete QA-1/2 ordering. A logical ended subscription is not by itself proof permanent group
   release is quiescent/safe (QA-23), nor permission to revive old ctx.

**Work — concrete probes and source.** Read Graph.retain=node.subscribe(noop), normal nodeDeactivate,
take body (DATA+COMPLETE followed by state write), takeUntil body and real retained collection roots.
Added `protocol-reconciliation-probes/terminal-stream-versus-resource-release.ts`, ran it as it
expanded, final run via node_modules/.bin/tsx plus absolute root path from TS7a26 exited0, five cases:
1. Producer DATA1+COMPLETE delivered, lifecycle activated=true/subscriberCount1 and cleanup0; explicit
   off then invokes cleanup once. Current terminal/cleanup separation is demonstrated, not the new
   automatic-retirement recommendation.
2. Retain alone starts one terminal producer run, does not repeat it. Later new subscriber restarts
   resubscribable source for run2; baseline reset skips run1 cleanup, old retain release does not
   remove distinct new sink, final new off only cleans run2. Supports keeping close-before-new cleanup
   fixes without a manual old-owner gate. No actual external resources allocated in these hook tests.
3. GraphReFly take(1) over a controlled producer completes after DATA7 but leaves sourceSubscriptions1,
   cleanup0 until explicit off; then cleanup1. This is the concrete resource-use case that changes
   the initial delayed-cleanup inclination.
4. Installed RxJS7.8.2 equivalent take(1) closes subscription and invokes source teardown1 after
   source next7 without caller unsubscribe. Primary Subscriber lifecycle evidence was already read
   in the preceding comparison; no new external source assumption/installation required.
5. GraphReFly shared source with take(1) and another consumer: explicit off of completed take branch
   leaves one upstream subscriber/cleanup0, other consumer receives7 then8; its later off cleans once.
   This tests the EXISTING explicit-release mechanism proposed for automatic reuse, not an automatic
   candidate implementation or proof of all diamond/deferred-work interactions. Surviving handles
   explicitly released; no full suite/formal run, runtime, normative Rules/formal/conformance,
   owner-ledger/D#, commit or push. The user subsequently replied "同意，继续", accepting the FINAL
   automatic-retirement/current-execution-retain direction above. This supersedes the earlier
   September no-auto-retirement review direction, not the still-current normative rule by itself.
   The three listed intersections remain unresolved until separately discussed.

### QA-21 pending terminal rewire versus automatic retirement (2026-10-18; accepted direction)

User accepted the preceding automatic-retirement direction and asked to continue. Examined the
deferred-work intersection first; terminal cache/private-state retention and QA-1/2 reentrant
subscription ordering remain subsequent concerns. No implementation authorization inferred.

**Rules — candidate reconciliation, not normative/current.** R-rewire-deferred@1's recorded text explicitly
allows preterminal pending rewire to drain after terminal; graphrefly:D62 explains both helper release
and declared topology for a later reset. Its committed/unpaused gates also appear in that activated
rule text; both it and R-rewire-deferred-committed-boundary@1 lack activation metadata. Automatic
retirement cannot both close immediately at its safe boundary and promise indefinitely to retain
paused tasks. Proposed ordering:
- Keep lawful, already accepted preterminal rewire tasks at their existing queue positions. Do not
  discard all of them merely because terminal output was sealed, and do not give them a new global
  priority ahead of other earlier queued requests.
- Automatic execution close is due only after the terminal array's valid fanout/current invocation
  and required commit unwind. Earlier queued work that can lawfully run before that close executes
  normally, preserving its topology effect. Output remains sealed throughout. Neither rewire nor
  automatic close bypasses a still-uncommitted batch; rollback keeps its existing task fate.
- A pause/readiness-blocked task must not hold automatic close open indefinitely. At the due close,
  cancel remaining work owned by the retiring lifecycle, as with ordinary closure. It cannot revive
  on later RESUME or transfer to a fresh lifecycle. Do not bypass its pause gate or mutate only its
  declaration after closure. No add/remove-specific exception is proposed.
- Cleanup releases all remaining owned upstream leases even when a queued unsubscribe never ran.
  This is resource release, not equivalent to editing declared deps: a canceled unsubscribe leaves
  the declared edge unchanged. Any later eligible activation starts from the actually committed
  topology. The exact scheduler placement for terminal-callback new subscriptions remains QA-1/2;
  this proposal does not authorize mid-fanout close/new activation.

Examples: unsubscribeDep(timer) queued before COMPLETE, otherwise ready -> boundary removal then
automatic close; subscribeDep(inner) queued before COMPLETE, otherwise ready -> normal add/activation
then automatic release on close (shared inner stays alive if another owner remains). A pause-blocked
old task at terminal close -> cancel, release actual leases through cleanup, no delayed topology
effect after RESUME. Thus the old D62 test expecting inner to remain active after terminal must
change under the accepted retirement scheme even when its ready topology mutation is preserved.

**Decisions — recommendation and cost.** Recommend preserving ordinary queued intent while it is
eligible, then using normal lifecycle cancellation at close. This retains real repeat/bufferTime
terminal removals without a terminal-only topology executor, new task-ownership class or waiting
service. Cost: a lawful ready add may briefly activate an upstream and then release it; terminal
does not make arbitrary user-authored rewire free of side effects. Gate timing affects which topology
work actually commits, as with other lifecycle cancellation. Universal cancellation at terminal is
simpler but drops real final-round removal intent; waiting for every task can retain timers/resources
forever under an unreleased pause. Applying declaration-only mutations after close changes the
meaning/ownership of ctx.rewireNext and is not selected. This is a refinement of D62's unconditional
terminal-drain wording and must be explicitly reconciled before normative amendment/implementation.

**Work — static evidence only this turn.** Read node-rewire-runtime, boundary drain, repeat final-round
unsubscribe-before-COMPLETE (graph/higher-order.ts), and bufferTime terminal unsubscribe-before-
COMPLETE/ERROR (graph/time.ts). Existing rewire-deferred.test.ts has both a terminal add that starts
an inner and a terminal removal that deactivates a helper. These verify current dependencies, not
the proposed automatic retirement or blocked-task policy. No new probe/full test run was needed
for this proposal; earlier runnable terminal-resource probes remain baseline evidence. Failed initial
reads used nonexistent operators/higher-order.repeat.ts and extra/sugar directories; corrected to
the actual graph files. No runtime, normative Rules/formal/conformance, jsonl/owner ledger, D#,
commit or push changes. Terminal output cache/private-state retention remains pending.

#### Evaluation of ready terminal rewire cost (2026-10-18; still proposed)

User asks to explain the cost and judge the tradeoff; this is NOT acceptance of the pending-rewire
proposal. Rechecked the existing terminal-add test and node-rewire-runtime allowTerminalOwner path.
The baseline demonstrates post-terminal upstream activation; automatic subsequent retirement is
the candidate design, not implemented behavior verified by that test.

**Rules — unchanged pending candidate.** No extra add/remove exception, post-close topology-only
executor, task registry or cross-lifecycle task transfer is selected. Deferred failures after output
seals still need observable operation-failure reporting under the agreed failure separation; do not
silently route them only to an already-sealed protocol ERROR. Exact integration remains design work,
not a new error-reporting API selected here.

**Decisions — evaluation.** Continue recommending ready FIFO work before due automatic close,
with explicit lifecycle cancellation of blocked leftovers. The cost is more than allocation/CPU:
an added source that newly activates can synchronously perform an external request, resource setup
or other user side effect. Immediate subscription release afterward cannot undo such effects or
guarantee cooperative cancellation. A shared already-running upstream only acquires/releases this
branch's lease and must not be stopped for other owners. New output cannot reopen the terminal
owner. A successfully committed add also remains in declared topology for a later eligible
activation, even though its current resource lease is released. Queued task/cleanup exceptions need
proper reporting and cannot invalidate already-delivered terminal. These costs are observable;
do not describe activation-followed-by-close as a harmless no-op or promise bounded external work.

The benefit is a coherent meaning for lawfully accepted rewire requests, including real repeat and
bufferTime final removal intent, without terminal-specific mutation semantics. Ordinary close alone
releases resources but does not commit a requested dependency removal; blanket cancellation can
therefore change the topology used by a later execution. The non-compatibility rationale is preserving
explicit topology intent, not preserving an old test for its own sake. The proposal requires scheduler
ordering/cancellation/error-path verification, so it is not zero implementation cost or proof no
extra internal facts will be needed. Terminal-time adds should not be recommended as an operator
authoring pattern merely because they are lawful. If preventing all not-yet-started upstream side
effects at terminal becomes a required guarantee, blanket cancellation is the better policy, at the
explicit cost of losing pending topology changes; a remove-only exception is not recommended.

**Work.** Static reread only. No runtime/tests/probe, normative records, owner ledger/D#, commit or
push changed. Previous accepted automatic-retirement direction remains accepted; rewire policy
and the remaining cache/private-state intersection remain pending.

#### User accepts the ready-rewire/close tradeoff (2026-10-18)

User replies "好，同意，继续" to the evaluation: preserve lawful, eligible queued topology intent in
ordinary order before due automatic close; cancel blocked old-lifecycle work on close without
waiting indefinitely; accept that an eligible add may activate external work before its lease is
released, and cleanup cannot undo every side effect. No remove-only exception or topology-only
post-close task mode selected. Earlier paragraphs marked proposed/pending describe the review
history; this acceptance settles that direction only, not QA-1/2 scheduler details or implementation.

Authority correction from this turn's direct row check: R-rewire-deferred@1 has introduced_by but
NO activated_by, like R-rewire-deferred-committed-boundary@1. Previous statements calling it
activated were inaccurate; corrected in this section and the preceding open-intersection list.
Its graphrefly:D62 historical rationale and current implementation/tests remain evidence, but do
not place that row in the resolver's current protocol projection. This metadata correction does
not itself approve activation, alter the accepted tradeoff or authorize a normative amendment.

### QA-21 terminal output snapshot versus execution-private retention (2026-10-18; accepted direction)

Next concern after accepted rewire ordering: automatic terminal retirement now closes the execution;
ordinary compute-close cache clearing would otherwise erase the final output immediately. September
review retained cache on terminal but cleared compute cache on later lifecycle close; automatic
retirement makes that combination unsuitable if the terminal result should remain inspectable.

**Rules — candidate revising the earlier compute-close direction; NOT accepted/current.** Recommend:
- Output logic retains the current terminal output record (COMPLETE or ERROR with its payload),
  cache presence/value, and any necessary retained-value staleness fact at the stable node level
  after terminal-driven execution close. Keep the existing single output cache, not a new terminal
  result/history/replay store. Terminal preserves ready/stale when a value exists; no-value waiting
  becomes empty. Closing resources does not certify stale data as fresh or reopen output.
- Lifecycle close still revokes old ctx, releases subscriptions/resources, clears consumed hooks,
  per-execution dependency/input queues, replay/pause delivery buffers and owed demand under their
  agreed rules. Already accepted node-scoped pause locks survive. Such execution facts do not need
  retention merely to inspect the last output.
- Private ctx.state follows its existing opt-in retention: cleanup/required retiring-invocation
  unwind gets the agreed restricted read view before final clearing; nonpersist state is then
  cleared, persist state remains. A retained terminal output does not implicitly persist all private
  state or make any old ctx valid. Persistent user data is not automatic resource cancellation.
- Nonterminal ordinary close continues the selected compute/producer cache-clear behavior; plain
  state preserves its intrinsic value/rebases only as previously agreed. Terminal-driven close
  instead preserves the sealed output snapshot for every node role. No terminal rebase from
  ahead-of-output plain-state intrinsic value. Repeated old off aliases do not erase the snapshot.
- An eligible fresh terminal reset clears the old terminal record; compute/producer output starts
  empty and is recomputed under normal admission gates, while plain state seeds from surviving
  intrinsic value. Opted-in private persist and explicit node locks keep their separately accepted
  meanings. Permanent release discards node-owned retained data. No new reset/dispose/cache API.
- Inspection is not subscription admission: non-resubscribable terminal late subscription remains
  rejected under QA-11/R-terminal@1; resubscribable acquisition starts a fresh execution, not replay
  of the old completed result. Checkpoint support still requires the separate capability checks;
  retaining a result alone does not prove a restorable execution.

Concrete example: computed N emits DATA23+COMPLETE; after valid complete-array delivery and safe
close, its subscriptions/ordinary private state are gone, cache23 remains, status projection is
{cache:'ready', output:'completed', lifecycle:'inactive'}. If previously stale and no new DATA fixed
it, retain stale instead. If paused buffer30 was dropped at terminal while cache20 remained, the
terminal snapshot remains20; closing must not manufacture delivery30. A lawful fresh reset of a
compute node clears23 before new START/activation; persisted private data is independent.

**Decisions — recommendation and cost.** Separate the node's current result from the execution
resources needed to produce it. Preserving terminal cache makes inspection stable across automatic
cleanup and avoids making diagnostic/result reads depend on capturing a transient callback window.
It extends the already agreed node-level output-cache/terminal ownership, not a duplicate cache.
Cost: a referenced terminal node retains the last value/error payload (which may reference a large
object) until eligible reset/permanent release/node garbage collection; no claim that resource
cleanup releases every payload reference. Clearing compute cache on all closes is simpler/uniform
but erases final results solely because cleanup ran. Keeping all private execution state instead
retains unnecessary implementation data and undermines persist opt-in. Recommend the single
terminal output snapshot, with the explicit nonterminal/terminal close distinction. This is a new
review choice, not assumed approved by the user's agreement to rewire ordering.

**Work.** Read nodeDeactivate/nodeResetLifecycle and earlier accepted status/cache/private-state,
QA-4 plain-state/terminal-seal directions. Activated R-terminal@1, R-cleanup-hooks@1 and R-ctx-state@1
are relevant; R-rom-ram@1 has no activated_by. Current TS deactivation clears compute cache; it does
not implement this proposed retention or automatic terminal retirement. No new probe/full suite
run for the design discussion. Only this existing review note edited; no runtime, normative
Rules/formal/conformance, jsonl/owner ledger/D#, commit or push changes.

### QA-21 combined-direction audit and remaining boundary (2026-10-18)

User replies "好的，在qa-21里，用我们的决定后把其他方面都想一遍，还有没有不协调的？没有的话是不是可以到下一个了？"
after the terminal-cache recommendation. This accepts the terminal snapshot/private retention
direction and asks for a combined design audit before advancing. Earlier proposed wording records
history; normative activation/runtime implementation remains unauthorized. QA-21's automatic
subscription retirement, current-execution retain, eligible preterminal rewire, and sealed terminal
cache directions are now accepted review directions together.

**Rules — combined consistency check, not a verified candidate implementation.** Checked these
combinations against prior accepted directions; no further material choice found in these traces:
1. Shared A, B/C subscribers: terminal ends the A stream registrations, including retain(A), without
   removing declared A->B/A->C edges. B/C retain their own received terminal/value facts. A later fresh
   run cannot resume old downstream streams or replace their stored dependency input by silently
   rebinding. If only B itself terminates, release B's lease of a still-open A; C keeps A alive.
2. A terminal during dependency setup: an acquired subscription can already be finished before its
   release is handed off; record/hand off an identity-bound idempotent release, not a revived lease.
   Receiving node retains the lawful delivered array/input facts. Its own complete/error policy,
   setup gates and partial behavior govern invocation; upstream auto-close does not itself imply
   downstream termination or make a late terminal acquisition legal. QA-11 remains unchanged.
3. Default PAUSE and prestarted async work: terminal policy still may cancel not-started invocations
   without waiting for PAUSE. The completed execution now additionally retires at its safe boundary.
   After output seals, late DATA cannot escape even before actual close; after close, old ctx also
   loses authority. Cancellation of external work remains cooperative. Complete/error delegated as
   raw INPUT is not OUTPUT terminal and does not automatically retire that receiving node.
4. resumeAll and plain state: intrinsic30/cache20 plus buffered30 then terminal drops30, preserves
   sealed cache20, and cleanup does not rebase it to30. Eligible fresh state reset may seed intrinsic30.
   This respects QA-4 and does not claim30 was delivered. Default nonterminal close retains its
   different plain-state rebase and compute-cache-clear policies.
5. Pause locks and PULL: explicit node locks survive, life-owned owed demand/buffers do not. RESUME
   alone cannot revive completed output, canceled demand or queued old ctx work; no new requester
   acknowledgement or demand replay guarantee. Retain is not a cross-epoch hidden service owner.
6. Rewire: ready accepted tasks keep ordinary order; output stays sealed during any added upstream's
   activation. Cleanup releases remaining leases, blocked old-life tasks cancel; topology retains only
   actually committed changes. Automatic close must not wait indefinitely for a pause or bypass a
   batch rollback. Topology mutation, lease release and result-cache retention remain distinct owners.
7. Cleanup and observer failures: finish unaffected valid fanout/required bookkeeping, attempt
   independent cleanup once, complete logical close and report failures. Neither a throwing observer
   nor cleanup error changes an already delivered COMPLETE to protocol ERROR or preserves ctx rights.
   Restricted cleanup reads precede private-state finalization. Untransferred failed acquisition is
   still QA-12; an already handed-off release may now simply be inert after retirement. No rollback
   of delivered messages or external effects, nor a persistent restart blockade.
8. Status and persistence: final cache/terminal facts remain node-owned; inactive can be completed/
   errored with ready/stale/empty cache. No phantom waiting after terminal. Nonpersist private state
   clears; opted-in data and locks remain without old callbacks regaining permission. No duplicate
   terminal cache or historical failure log. Later old off aliases cannot clear a new registration
   or retained terminal snapshot. The full cache freshness transition audit still belongs to QA-24.
9. Restore/permanent release: snapshot retention does not imply support for restoring locks, active
   I/O, closing work or pending requests. Existing reject-unsupported checkpoint direction remains;
   QA-22 still must design restore initialization. Automatic ordinary close is not graph permanent
   release or proof of group quiescence; QA-23 remains distinct.

Historical reconciliation: QA-8's statement that terminal does not itself do actual close/cleanup
has been superseded by QA-21 automatic retirement after safe delivery/unwind. Its cancellation of
unstarted invocations, terminal-input versus output distinction, and no wait for PAUSE remain. The
September active+terminal status remains possible transiently until safe close, rather than the
ordinary indefinitely retained terminal execution. Do not retain the old text as a competing
current direction during final refinement. Earlier D62 terminal-inner-stays-active test expectation,
compute cache clearing on terminal close and retain-until-manual-off likewise need later scenario/
normative/runtime reconciliation; passing old tests is not validation of the accepted replacement.

**Decisions — one already identified intersection remains OPEN (QA-1/QA-2).** Automatic retirement
does not by itself answer synchronous reentrant subscribe during terminal fanout. Trace: S delivers
DATA1+COMPLETE to X then Y; X requests subscribe(S,Z), or reuses X's own callback, before Y receives
the full array. Immediate close/reset can detach Y; applying ordinary callback-idempotence to the
still physically present but finished X registration can instead suppress an intended fresh run.
Must settle the admission/release/initial START boundary for a next-execution request, not silently
attach it to the retiring execution. QA-16 immediate registration/snapshot with deferred activation
left exactly this terminal exception open; declaring only fn activation deferred does not resolve
the initial snapshot/lifecycle ownership. Preserve no mid-array reset, identity-bound old releases,
no automatic migration and close-before-fresh activation. Whether to reject this in-flight fresh
request or admit a cancelable boundary-deferred acquisition remains a choice, NOT selected here.
Same closing/retiring cleanup-origin admission restrictions must not be silently relaxed.

Recommend advance from QA-21's settled owner/cache policy to combined QA-1/QA-2 now, before QA-22.
QA-21 core direction is accepted; mark its reentrant boundary as dependent on QA-1/2, not universally
closed/verified. No additional policy fork found in the nine combinations above; this finite static
audit does not claim exhaustive protocol proof or completion of QA-7/22/23/24/25/26/27.

**Work.** Read original QA-1/2/21/22 findings, accepted QA-8/11/12/16/17/18/19/20 and current combined
QA-21 directions, with TS lifecycle/reset/deferred source and existing probe receipts as bounded
baseline evidence. No new runtime tests/probes run: accepted replacement is not implemented and
rerunning baseline would not prove it. Session-note-only edit, diff whitespace check; no normative
Rules/formal/conformance, jsonl/owner-ledger/D#, runtime, commit or push changes. Future work must
cover these combined traces after spec/model/scenario reconciliation under separate authorization.

### QA-1/QA-2 reentrant fresh subscription and callback identity (2026-10-18; proposed)

> Consumer qualification below found real adapter assumptions and a missing per-acquisition failure
> path. This proposal remains OPEN; outer-operation reporting alone is insufficient. Do not mark
> it accepted or consumer-compatible based on the successful delayed-DATA case.

User says "好，继续" to the combined QA-21 audit and moving to these two outstanding boundary
questions. This authorizes discussion, not a selection of pending-acquisition semantics, normative
edits, or implementation. Continue root decision-guard/design-review and existing walkthrough notes.

**Rules — current contract versus proposed extension.** Activated R-terminal@1 permits opted-in
fresh terminal reset and rejects non-resubscribable terminal acquisition. Activated R-push-subscribe@1
requires START first; it does not define this reentrant acquisition's return/handshake timing.
R-reentrancy@1 does not by itself settle observer-origin admission. QA-16 selected immediate normal
registration/snapshot with deferred activation but explicitly left this terminal case open; QA-17
fixes candidate registrations per complete array. QA-21 requires complete old fanout/unwind/cleanup
before a new execution, automatic old subscription retirement, no migration, retained sealed cache
and identity-bound release. Callback idempotence applies to one still-live registration, not a
physically present but already-ended old stream registration.

Proposed material choice: accept a cancelable boundary-deferred public subscription when the target
has terminal output, is resubscribable, and its prior execution cannot yet safely finish. This is
an exception to QA-16 immediate initial-snapshot timing, not merely deferred fn dispatch. Keep the
ordinary closing/retiring cleanup-origin and raw-fn-origin admission restrictions; no blanket
permission to subscribe a closing/released target. Terminal observer delivery before actual closing
is the motivating permitted phase, not a cleanup hook loophole. Once old cleanup is already complete,
ordinary eligible reset/registration plus QA-16 origin-based activation scheduling applies.

Candidate observable trace (S resubscribable; old observers X,Y):
1. S's output facts seal; its complete [DATA1,COMPLETE] array reaches X.
2. X calls subscribe(S,Z): validate admission, record its external subscription request at the
   ordinary FIFO position, return an idempotent release synchronously. Do not reset S, deliver
   START/old DATA to Z, count Z as an owner of the old execution, or let Z join the old array.
3. Complete valid delivery to Y and safe current-invocation/commit unwind; perform the accepted
   automatic retirement/eligible queued-work/cleanup ordering. Observer failures do not cut off Y.
4. Once old close has completed, execute the surviving fresh request at its lawful position,
   revalidate permission/node/registration identity, reset output under ordinary fresh-life rules,
   install the new registration, and deliver its new initial array beginning with START. Compute
   old cache1 is not replayed into the fresh execution; plain state baseline and quiet-PULL rules
   retain their separately agreed meanings. Eligible fn dispatch follows through dispatcher.

Release and callback identity details proposed together:
- Calling the returned offZ before request application cancels that request; no START or source
  activation is owed for it. After application it releases only that acquired new registration.
  Multiple aliases release the same registration/request once, not independent refcounts.
- An old release for X/Y cannot cancel a pending/fresh registration, even with the identical callback
  object. COMPLETE/ERROR has logically ended the old stream, so old physically retained registration
  membership is not a basis for idempotent reuse. Non-resubscribable terminal still rejects, including
  same-callback calls. Open-stream same-callback reuse remains unchanged.
- Repeated requests for the same target and callback while its new subscription request is pending
  reuse that pending acquisition, with no second request/START/restart. Remove a canceled/applied
  pending request from its pending lookup before invoking user callbacks; do not let a terminal
  emitted by the new execution alias a finished previous request. No public subscription ID,
  owner object, Promise, new status axis or protocol message is proposed; minimal internal pending
  acquisition/cancellation bookkeeping is necessary and must not be described as zero state cost.
- Distinct callback requests remain distinct ordinary FIFO acquisitions. Do not gather them into
  an implicit activation batch. If the first fresh acquisition completes its entire new execution
  synchronously before the next request applies, the next request follows ordinary terminal opt-in
  admission again; they are not promised to share exactly one new execution. A pending same-callback
  alias still means one request, even if that request ends synchronously when eventually applied.
- A queued PAUSE issued before the subscription request is applied first; one issued afterward does
  not gain priority merely because this request had to await cleanup. Final lock gates activation,
  not ordinary new initial snapshot. No task may dispatch the fresh fn inside old fanout/unwind or
  bypass an uncommitted batch. Earlier lawful rewire keeps its accepted position/close cancellation.

Failure qualifications proposed with this design: once nested subscribe returns release, subsequent
initial-callback/activation failures belong to the executing outer operation's reporting boundary,
not a retroactive throw from the earlier returned call. Ownership has already transferred: do not
apply QA-12's pre-return abort to silently delete an established registration merely because a
later callback/setup fails. Preserve identity-bound release and ordinary surviving-owner/failed-
setup responsibilities, unaffected fanout, independent aliases and terminal-driven retirement.
The returned release must still be able to clean up any acquired resources; no automatic retry.
If required old close reports cleanup failure, finish its internal teardown, fail/cancel requests
waiting on that failed transition without START/automatic retry, and report the failure. A later
separate request may attempt lawful new activation without a persistent node fault blockade. This
failure cohort/timing qualification remains proposed with the rest, not previously accepted just
by the phrase "at a safe boundary". Cleanup errors are not transformed to protocol ERROR on sealed S.

**Decisions — alternatives and recommendation.** Immediate reset violates old-recipient preservation
and old-fn/ctx isolation. Rejecting reentrant fresh acquisition is simpler (no pending subscription
record/late START) but makes a natural terminal-observer restart require host-side rescheduling or
another explicit composition. Recommend cancelable queued acquisition: it preserves the synchronous
release shape and safe queue model already used for observer requests, supports same-callback
intentional restart without old release authority leaking, and keeps fn dispatch synchronous at
the outer boundary. Cost: returned release can precede START, acquisition callbacks/errors can
occur after the nested call returns, pending-callback dedup/cancellation needs internal bookkeeping,
and cleanup-before-new imposes transition-failure handling. This is a real public timing change,
not automatic implication of QA-16 or compatibility with every eager-subscribe assumption. Factory
retry/repeat remains preferable for built-in compositions; this does not restart existing consumers
automatically or provide a generic cross-epoch retain service. Runaway repeated terminal-callback
restart remains the separate QA-26 issue; no microtask loop or numeric cap selected here.

**Work — evidence and scope.** Reread activated rule rows/authority projection definition; ordinary
_subscribeOwned currently resets terminal immediately before Set.add/START/cache, and its release
deletes by callback identity. owned-acquisition.ts provides pre-callback release recording but no
implementation of proposed boundary-deferred public acquisition. Existing terminal/fanout/release
probes are baseline evidence only. No new probe/full-suite run for this unimplemented proposal;
no runtime, normative Rules/formal/conformance, jsonl/owner ledger/D#, commit or push changes.
After user selection, test design must cover X/Y/Z full-array trace, same-callback dedup/old release,
cancel-before-START, multiple requests/synchronous source termination, PAUSE/FIFO/batch, nested
initialization failure/alias transfer and old cleanup failure. QA-1/2 remain OPEN pending acceptance.

### QA-1/QA-2 actual consumer qualification (2026-10-18; proposal incomplete)

User asks "这个，你也验一下能够满足library吗？" This is verification of the proposed deferred public
acquisition against actual library consumers, NOT acceptance or implementation authorization.
Static inspection plus controlled timing qualification finds two real contract gaps. Do not claim
that a complete candidate scheduler/lifecycle implementation has passed: none was installed.

**Rules — gaps exposed by composing the proposal with real helpers.**
1. Initial snapshot identity cannot be inferred from whether subscribe has returned. Actual
   adapters/store.ts subscribeNodeValues uses `subscribing && delivery === undefined` to suppress
   initial DATA for changesOnly/immediate. Under delayed initial delivery, subscribing is already
   false. Controlled real-helper cases: changesOnly receives23 instead of nothing; readableStore
   emits23 immediately and again from the same initial snapshot; externalStore sends an initial
   change notification instead of none. Actual persistent-collection adapter has the same guard;
   a controlled delayed cached list delta is appended to the change log again (one write vs zero
   for synchronous initialization). agentic-memory-storage uses the same pattern statically.
   These are conditional incompatibilities under the proposed delivery timing, not claims that all
   present framework subscriptions or default collections already trigger the terminal restart path.
   A compute reset with empty cache emits no old initial DATA; genuine fresh activation DATA remains
   a valid occurrence, even with an equal value, and must not be filtered by an equality workaround.
   A fresh plain-state baseline can still contain initial DATA, so the incompatibility is real in
   the supported general node surface. Fix must distinguish initial snapshot versus live occurrence
   explicitly at the adapter boundary; START by itself is not a sufficient end-of-initialization
   marker, and a scheduled tick/one skipped DATA can suppress a real first output on an empty source.
   Existing delivery metadata is a possible boundary, not a new wire field/message selected here.
2. Returning release before initialization creates a failure handoff obligation. Real firstValueFrom
   catches immediate subscribe throws through the Promise executor, and otherwise settles from
   DATA/ERROR/early terminal. A proposed pre-START failure (e.g. required old cleanup fails) that
   cancels the request and reports only to the outer wave never reaches that Promise. Controlled
   qualification: synchronous pre-START throw -> rejected; deferred throw -> outer error observed,
   request canceled/no tasks or registration remain, Promise still pending with no remaining route
   to settle. This is not just a timeout or failed observation of a slow source: the modeled failed
   acquisition has ended without any callback channel. Real singleFromAny then retains the pending
   Promise in its inFlight map: another call for the same key returns the same Promise and factory
   count stays1, whereas synchronous rejection clears the entry and a later call invokes factory2.
   A pending release is not a completion/failure notification. Do not fix by inventing stream ERROR
   or COMPLETE for node output when the operation, not that stream's execution, failed. A per-request
   acquisition-owner failure path is missing from the proposal; outer error reporting alone is not
   enough. That is distinct from the explicitly rejected per-async-job tracking scheme (QA-5).

Positive bounded cases: real firstValueFrom handles delayed DATA17 and unsubscribes once; handles
delayed actual protocol ERROR and rejects/unsubscribes; canceling before initial delivery suppresses
START/DATA; actual graph.retain wrapper can return/cancel release without first seeing START (tested
with a real graph-owned node and only its subscription seam replaced). Open stream/ordinary host
subscription behavior need not change. Higher-order repeat/switchMap/mergeMap/etc acquire declared
dependencies through rewire, not this public observer subscription exception; their admission and
automatic retirement remain separate integration work. Retain/observe/storage still must use their
normal node/graph permissions; these checks do not exempt raw fn bodies from QA-16.

**Decisions — reassessment, NOT selected by the user.** Keep the cancelable-queued-acquisition
direction as a candidate, but withdraw any implication that the proposal as stated is sufficient
for the current library. Before selection, design (a) initial snapshot recognition independent of
subscribe-return timing, and (b) a reliable acquisition-failure handoff to an owner such as a Promise
bridge. The existing private owned-acquisition seam (release recorded before callbacks) could be
extended as one implementation candidate; do not silently add onFailure/public subscribe options,
node task flags, error streams or protocol ERROR reinterpretation. If that extra ownership mechanism
is not worth its cost, rejecting terminal-in-flight fresh subscription remains the simpler coherent
alternative. Restricting firstValueFrom to outside every graph observer callback would instead be
a new restriction; its host-boundary remark bans reactive bodies, not an already accepted blanket
observer ban. No requirement or restriction is locked merely to make this probe green. Plain-state
last-result reads by readableStore's explicit immediate get remain node snapshots, not proof a new
execution has begun; review initial-versus-new-result terminology rather than silently erase them.

**Work — actual scope and receipts.** TS7a26 remains at baseline dafc5ae57d446a59a7388214c31bd7a6e73d1519.
Worktree has no .codegraph index; the sibling main checkout does have one but is not treated as an
exact index for this checkout. Used direct source inspection, no autonomous index initialization.
Read Node.subscribe/owned acquisition, firstValueFrom/singleFromAny, store adapters, graph.retain/
observe, repeat/higher-order paths, persistence attach, storage/agentic-memory attach guards, bridge
retain/release, messaging sink, and representative framework example consumers. Framework examples
import separate @graphrefly/react/svelte/vue/solid packages; this scope does not execute or certify
those package implementations or browser/framework rendering. No external library comparison or
network access needed for these local implementation claims.

TypeScript AST inventory over packages/ts/src excluding __tests__/__bench__ counted62 property-call
subscribe sites and33 retain sites; no literal resubscribable:true production property assignment.
Counts include other stream APIs/property-call syntax and are not a type-resolved whole-workspace
call graph. Dynamic options/app consumers can opt in; absence of a production literal does not
justify declaring the public surface unused. Groups: adapters subscribe4/retain2; graph9/4;
executors38/0; orchestration6/13; messaging1/1; solutions4/1; cqrs0/10; patterns0/1; work-queue0/1.

Added protocol-reconciliation-probes/deferred-subscribe-consumer-qualification.ts. It loads real
library helpers from the current checkout and supplies a minimal Node-shaped synchronous/deferred
initialization double; retain/persistence use real Graph-owned nodes with only the subscribe seam
replaced in memory and restored afterward. This is controlled consumer assumption testing, NOT
a conformant substitute runtime, automatic terminal cleanup implementation or proof that current
production defaults already hit these counterexamples. Storage uses in-memory tiers only. Final
run node_modules/.bin/tsx plus absolute probe path from TS7a26 exited0, DONE16 cases: six store timing
comparisons, delayed Promise DATA/error, two acquisition-failure timings, cancel, retain, two keyed
loader failure timings, two persistent-list timing comparisons. Assertions deliberately pin both
working cases and observed counterexamples; "exit0" does not mean the candidate passed conformance.
Microtasks were drained for Promise observation; failed modeled acquisitions have no remaining
registration/task/future callback. No real resource/network work or dependency installation.

Baseline regression run from packages/ts with ../../node_modules/.bin/vitest run sources.part-02,
higher-order and lifecycle (src/__tests__ paths), --reporter=dot: exit0,3 files/77 tests passed,
no skips. Focused existing reactive-collection-storage.d161-persistreactivecollection-and-
openpersistentreactive.test.ts run also exited0,1 file/12 tests passed,no skips (total4 files/89
baseline tests). These test the unchanged implementation, not the proposal. Initial shell search used an unmatched adapters*.test.ts
glob and one nonexistent graph/sugar.ts path; corrected to concrete real files. No runtime or
normative Rules/formal/conformance, jsonl/owner ledger/D#, commit or push changes. Only this existing
review note and the diagnostic probe changed. QA-1/2 stay OPEN for the newly exposed handoff design.

### QA-1/QA-2 queued subscription failure handoff via acquisition owner (2026-10-18; proposed)

User asks to discuss queued subscription failure notification first, recommends reuse of existing
mechanisms and minimal state. This authorizes a concrete review proposal, not implementation or
approval of a new public API. Root owns the cross-runtime operation/lifecycle principle; TypeScript
private lowering shown here is an implementation candidate, not a separately locked public symbol.

**Rules — candidate handoff extension, not an activated contract.** Relevant activated R-terminal@1
and R-push-subscribe@1 cover reset/admission and START-first delivery, but not request failure after
release return. QA-12 records release ownership before callbacks/whole-return abort; QA-16 selected
post-return activation failure reporting at the executing outer operation; QA-5 rejects new async
job tracking. Preserve those divisions. Recommend extending the existing private subscription
acquisition owner seam with an optional failure receiver, alongside its existing record(release).
Current SubscriptionAcquisition has ONLY record; the receiver does not exist yet.

Candidate behavior:
- Failures returned through a still-live synchronous subscribe call keep ordinary throw/QA-12
  behavior; firstValueFrom's existing Promise executor/catch can reject. Do not secretly convert
  every subscription to a Promise or force an async completion handshake.
- For an accepted queued request, its existing request/initialization work carries the optional
  owner's failure receiver. If permission/required old cleanup/dependency setup prevents that
  acquisition or required initialization, notify that specific owner; do not rely on the original
  call stack still existing. firstValueFrom routes this into its existing finish/reject path and
  owned release; singleFromAny's existing rejection cleanup can then remove its inFlight key.
- Preserve outer operation error reporting in addition to this owner notification. The receiver
  is a way to end an owner's wait, not an error-consumption/acknowledgement service that suppresses
  cleanup or setup failures. No receiver means ordinary outer reporting is sufficient for a raw
  callback subscription. Both paths may observe the same cause; do not claim single-observation
  semantics or add a handled flag, error de-dup registry or node failure history to hide that cost.
  A shared old-close failure is reported once by its close operation and separately notifies each
  affected pending acquisition owner; those notifications must not manufacture N additional copies
  of the same close error in the outer error aggregate. Distinct actual errors remain reportable.
- Establish failed-request/no-rerun bookkeeping and any required lifecycle finalization before
  invoking the receiver. Consume its once-only request notification route before callbacks so
  finish()->release or reentry cannot notify it again. Other registrations/aliases/resources obey
  QA-12/failed-setup ownership; notification alone does not authorize runtime-wide unsubscribe or
  rollback. In particular, firstValueFrom releases its own lease as its helper policy, not all owners.
- A receiver throwing is an additional operation-reporting failure: preserve the original cause,
  continue independent notifications/cleanup and report under the existing aggregation policy.
  Do not retry the receiver or let it prevent the remaining owners from being notified.
- Explicit caller cancellation before START is not failure and does not invoke the failure receiver.
  A runtime inability to fulfill an accepted uncanceled acquisition must not be silently treated
  as that explicit cancellation. Pending release aliases stay identity-bound/inert after terminal
  request failure; ordinary post-return acquired resources remain releasable under the selected
  owner rules. A release is still not a public completion/failure-query object.
- The receiver covers acquisition/required initialization work, including an already selected
  pending activation obligation if initialization has not yet run. It is not retained to monitor
  arbitrary future async work or every later rewire/control operation. After successful initialization,
  subsequent source DATA/protocol ERROR/COMPLETE are handled by existing stream rules. A configured
  pause/quiet gate is not itself failure; an open source legitimately not producing DATA does not
  trigger a timeout or synthetic notification. No waiting for the first DATA to declare acquisition
  initialized, and no per-result completion discovery is implied.
- Only failures belonging to that acquisition/initialization are notified through its receiver.
  Do not reinterpret any exception escaping the entire shared drain (including an unrelated
  observer or another node's operation failure) as this request's own failure. Existing operation
  attribution, not a new global failure listener, supplies this distinction.
- Preserve settled-result truth: firstValueFrom uses its existing settled guard; if DATA already
  resolved it, a later initialization/cleanup error cannot turn it into rejection. Outer reporting
  remains visible, including when the helper's receiver deliberately does nothing after settlement.
  This also respects lawful partial results before a later dependency setup failure. Business
  DataResult and protocol ERROR keep their existing meanings.

Example: terminal observer requests firstValueFrom(S), gets its Promise while the subscription is
pending; required old cleanup later fails before START -> the affected acquisition is failed, its
private receiver calls existing finish(reject(error)), its pending release becomes inert/owned
lease released as applicable, and singleFromAny clears its key on rejection. The close failure also
reaches the existing outer operation reporter. No START, invented node ERROR/COMPLETE, implicit retry
or permanent restart blockade. Later independent requests retain ordinary eligibility checks.

**Decisions — state budget, alternatives and recommendation.** Recommend this extension because the
private owner seam already exists for construction roots and dependency acquisition; release/error
ownership belongs to an acquisition rather than a node's value cache or dispatcher task registry.
The optional receiver is held by the already necessary pending request/activation work, then cleared
when that initialization completes, fails or is explicitly canceled. Normal public subscribe still
returns only release; current construction owners without a receiver keep their existing exception
handling. firstValueFrom reuses its Promise, finish/settled and release handling; singleFromAny reuses
its map and rejection cleanup. No per-subscribe completion Promise, node hasFailed/hasAsyncWork flag,
new public status, error bus/history, success acknowledgement, retry queue or async-job map. This is
not literally zero cost: it adds an optional owner callback reference/closure and routing through
the operation that actually executes; exact representation remains implementation design.

Keeping outer reporting is the deliberate low-state choice: it preserves QA-16 and catches errors
after a Promise already resolved. Exclusive handled-versus-unhandled routing would require an extra
handler-result convention and correct consumption classification; it is not selected here. The two
observation paths may be inconvenient to code logging both, but external logging policy need not
become retained node state. An optional private receiver does not expose a new public subscription
error callback; ordinary public callback users still observe operation failure at the outer boundary.
Whether adapters should expose that ownership to power users is a separate API need, not implied
by this internal helper repair. Do not repurpose SubscribeValuesOptions.onError (currently stream
ERROR) as an acquisition-failure callback without separate approval.

Alternatives: reject all in-flight terminal fresh acquisitions (simpler and coherent but loses the
chosen candidate convenience); add a public Promise/result subscription (larger API/timing change);
use a global error listener to reject promises (loses request attribution); fabricate protocol ERROR
(conflates operation failure with sealed stream output). Recommend the optional private owner
notification plus existing outer reporting. Its user acceptance and actual lowering remain pending;
the initial-snapshot adapter gap is separate and still OPEN.

**Work — verified premises only.** Reread owned-acquisition.ts SubscriptionAcquisition.record,
Node._subscribeOwned/runtime host, lifecycle dependency acquisition, construction-scope.startConstruction
record-before-START owner handoff, BoundaryTask/apply and existing outer drain catch/report, and
firstValueFrom/singleFromAny actual state/rejection paths. Current boundary runtime rethrows first
escape; the broader agreed aggregation/reporting scheme is a proposed redesign, not silently claimed
implemented. Previous16 controlled consumer cases show the need, not this receiver implementation.
No new probe/suite rerun for an unimplemented design; no runtime/normative Rules/formal/conformance,
jsonl/owner ledger/D#, commit or push changes. Only existing review note edited, whitespace check.
Future qualification must include pre-START and paused-initialization failure, owner absent/present,
Promise already resolved, shared cleanup failure with multiple owners, explicit cancel, receiver
throw, alias/release identity and unrelated drain failure attribution without polling or history.

### QA-1/QA-2 evaluating an overloaded ctx ERROR route (2026-10-18; discussion, not selected)

User proposes modifying the ctx passed around subscribe/activate so ERROR is intercepted as the
owner's catch, reusing an existing route rather than adding another callback. Treat this as an
architectural alternative, not approval of the previous optional-failure-receiver proposal or
permission to change the public protocol.

**Rules — distinguish routing reuse from phase-dependent node output.** Actual public subscribe
takes a Sink, private _subscribeOwned additionally takes SubscriptionAcquisition (record only),
and nodeActivate takes an internal runtime host. The public raw NodeFn Ctx is constructed for
invocation; its down currently routes to that node's _down. Therefore there is no existing public
subscribe/activate Ctx argument whose owner-failure semantics can simply be toggled. It is possible
to introduce or reuse a private operation-context binding, but it is not the raw node fn Ctx.

Changing the raw ctx.down ERROR behavior merely because activation is on the stack is not
recommended: a legitimate source invocation can emit DATA+ERROR during initial activation. ERROR
must still seal this execution's node output and be delivered according to the ordinary stream
policy; redirecting it only to one request owner can leave the node open and other lawful observers/
dependents uninformed. A subscription/setup failure can also precede any NodeFn invocation/ctx
construction, so such an override cannot cover the observed pre-START cleanup failure by itself.
Nested acquisition failures, observer throws and old cleanup errors are not all attributable to
the most recently invoked source ctx. Captured async ctx must retain stable origin/lifecycle rules,
not switch the meaning of ERROR according to whether the activation stack has unwound.

Private implementation reuse is viable: a request-local operation context can bind its existing
acquisition owner and route its own failure to that owner; common error-notification code may be
shared. Raw node ctx.down ERROR still routes to the protocol, including during activation. This
needs no new public ctx class/mode, node flag or global current-owner variable. The necessary fact
is still which operation/request owns the failure; overloading a method name or reusing the ERROR
constant cannot remove that routing responsibility. Prefer reusing the existing private acquisition
as that operation context rather than creating a second whole NodeFn ctx with state/up/down/hooks.

Sending a fabricated ERROR directly to the ordinary subscriber Sink to exploit its existing ERROR
branch would be another semantic choice: it is per-acquisition failure delivery rather than the
node's protocol output, and before START would violate the current START-first expectation. Adding
a fabricated START first merely hides the distinction; no successful initialization/fresh node
execution has thereby occurred. Do not silently choose either variant to avoid the optional owner
receiver. Whether a private operation context uses a generic typed emitter internally is an
implementation detail only if operation and stream error channels remain unambiguous externally.

**Decisions — recommendation pending.** Accept the user's goal of sharing an existing context/route
and minimizing state, but recommend sharing at the private acquisition/operation boundary rather
than phase-overloading raw ctx.down. The useful reuse is stable request-bound error ownership;
using the public down name with a different meaning does not simplify that ownership. If the user
intends source-emitted ERROR during activation to become an operation failure instead of node
terminal, explicitly reopen that larger stream/lifecycle policy before claiming it is a harmless
overload. No raw output rewrite, new wire error kind or optional owner callback is approved here.

**Work.** Read node-context-runtime nodeMakeCtx down binding, node lifecycle activation/acquisition,
Ctx exported type, Node.subscribe and runtime-host signatures. This is source-grounded semantic
analysis, not a dynamic test of an alternative context proxy. No runtime/probe/test or normative
Rules/formal/conformance/jsonl/owner ledger/D#, commit or push changes; existing session note only.
Queued acquisition and its failure handoff remain OPEN, along with initial snapshot recognition.

### User accepts acquisition-bound failure routing; combined audit (2026-10-18)

User says "明白，那就沿用acquisition这一层，不改raw ctx.down的语义。你再看看这个方案有没有其他不协调的，没有的话继续初始快照识别的问题。"
Accept the acquisition-layer owner-failure direction and fixed raw ctx.down meaning; exact private
names/representation and broader deferred subscription timing remain subject to final design.
This is review acceptance, not normative activation, owner-ledger admission or implementation.

**Rules — accepted boundary and audit qualifications.** Ordinary source-emitted protocol ERROR,
including during activation, still follows node output/terminal policy. Subscription establishment/
required initialization failures follow the acquisition's owner route plus selected outer operation
reporting. Current code does not yet have this optional failure notification; prior proposed wording
is not a current activated Rule. Checked: explicit pending release cancels without a failure; inability
to fulfill an uncanceled accepted request notifies its owner; failing requests consume their once-only
notification before reentry; notifications cannot revive old ctx or change sealed output; established
resources remain subject to QA-12 ownership, and firstValueFrom releases only its own lease. Existing
Promise settled guard prevents a later error rewriting a DATA result, while outer reporting still
exposes later cleanup/setup failure. Shared close failure must not be duplicated N times in the
outer aggregate merely because N waiting owners are notified; receiver throw is an additional real
failure and does not abandon other independent notifications. Normal stream ERROR after initialization
is not also reclassified as acquisition failure. Failed setup's DIRTY/manual-async settlement duties
remain under earlier selected rules; this notification does not invent DATA/RESOLVED/terminal.

Callback aliases reuse one logical pending acquisition/registration and its established ownership;
do not silently replace its failure owner or add a failure-listener registry just because another
alias is returned. firstValueFrom creates its own callback/owner. Internal alias-owner representation
must preserve this invariant; no new public multi-owner subscription API selected. Independent
requests remain independently owned. No new semantic conflict found in these finite combinations.
No global current-owner field, node failure flag, per-job tracking, history or retry mechanism needed
by the selected direction. Representation, error attribution and cases still require implementation/
conformance qualification rather than assuming existing unmodified code already supports them.

**Decisions.** Acquisition is the minimal relevant owner because failure can happen before any new
raw ctx exists. Preserve separate protocol and operation meanings while permitting shared internal
reporting code. Two observable error paths remain an explicit accepted-direction cost; this turn
does not introduce suppression/dedup state or repurpose adapter stream onError. Proceed to initial
delivery recognition; no additional failure-routing fork needs selection before that discussion.

**Work.** Static source/narrative cross-check, no new runtime/probe/test runs or source edits. The
previous16 controlled cases establish the original gap, not implementation of this remedy. No
normative Rules/formal/conformance, jsonl/owner ledger/D#, commit or push changes. Existing session
note only. Initial snapshot roles/timing and their interaction with adapter immediate reads remain
the next concern; QA-1/2 as a whole are not claimed completely implemented or formally closed.

### QA-1/QA-2 initial snapshot recognition from the START array (2026-10-18; accepted direction)

**Rules — proposed lowering of already selected delivery structure.** The user-confirmed initial
subscription arrays section defines one intact initial array beginning with START, including cached
DATA or configured replay DATA and any trailing DIRTY. Activation output is a separate live array;
quiet PULL initialization is START only. This design is more informative than the current per-message
Sink plus optional DeliveryMeta. Recommend derive initial-delivery role from the complete START
array, rather than subscribe-return timing or another per-node initialized flag.

- A subscription initializer constructs/delivers the initial array beginning with START to its
  exact registration. The whole initial array has that role, including all replay DATA and a stale
  cache's final DIRTY. Waiting for a safe boundary does not change its role into a live occurrence.
- Subsequent live output arrays carry ordinary occurrence meaning and no subscription START. Even
  synchronous activation immediately after initial delivery is live. Do not append activation output
  to the START array, infer initialization until the first DATA, or treat all work before public
  return as initial delivery. START remains the system subscription handshake, not a source-level
  flag that user output may forge to suppress occurrence handling.
- Whole-array adapters can inspect its existing START prefix directly. If an internal per-message
  path remains, its parent delivery can pass the already-known array role locally through existing
  delivery plumbing; exact private metadata shape is not selected. No new wire message, tier,
  public raw ctx mode or persistent node initial flag is needed. Do not use `delivery===undefined`
  as a universal semantic classifier: current live rollback/settlement paths can omit metadata,
  and future complete-array delivery will need boundary metadata for initial arrays too.
- changesOnly consumers/persistence delta appenders can exclude initial snapshot/replay DATA while
  retaining every actual live DATA occurrence, including equal payloads. Raw node input seeding,
  configured replay delivered to ordinary observers, and raw fn first-value/dirty gates keep their
  existing rules; identifying initial DATA does not globally suppress it in the substrate.

Example: initial [[START],[DATA,23]] is the registration's baseline; subsequent activation
[[DIRTY],[DATA,23]] is a real occurrence despite equality. Empty/quiet initialization [[START]]
does not cause the first later DATA23 to be skipped. Stale initial [[START],[DATA,23],[DIRTY]] still
seeds23 and leaves that dependency pending until a later lawful settle. These cases need no separate
initialization completion message, metadata registry or asynchronously timed handshake flag.

**Decisions — recommendation and remaining adapter policy.** Prefer using the already selected
START-containing full array over adding a redundant public origin field or stack-based guessing.
If transport representation later needs an explicit private discriminator, derive it at construction
and carry it with that delivery, not as another node-state authority. Current per-message code must
be changed under the separately authorized wave delivery design; this is not a one-line patch to
remove subscribing from existing guards.

Important unresolved interaction discovered during this audit: `immediate:true` is more than
changesOnly. readableStore currently reads cache immediately BEFORE actual subscribe, then suppresses
the synchronous initial cache echo. With a deferred fresh plain-state reset, that early read can be
the sealed old cache20 while the later new baseline is intrinsic30. Blindly suppressing ALL initial
arrays would leave the listener at20, even though the correct new baseline is30. With no value change,
delivering both reads repeats23. Therefore classification solves which delivery is initial, but does
not by itself choose immediate store behavior. Must separately choose whether the adapter's initial
callback waits for the actual initial array, or exposes a current provisional snapshot followed by
the initialized baseline; no equality check should be smuggled into substrate live occurrence policy.
The normal synchronous readable-store contract, quiet PULL, custom getSnapshot and store wrappers
need to be considered in that next subtopic. No adapter-equality rule, provisional flag/public mode,
forced eager snapshot or delayed-first-callback behavior is approved here.

**Work.** Read current DeliveryMeta {wave,last}, _subscribeOwned's START/cache/replay branch,
nodeDown and metadata-less rollback RESOLVED, nodeRecordDepProjection's live inference, store and
both persistence guards. Source lookup initially used nonexistent node-receive-runtime/node-output-
wave filenames; corrected to actual node-input-runtime/node-output-runtime. Existing selected full
array architecture and previous consumer probes, not a new runtime implementation, ground the
proposal. No new tests needed to claim implementation success; none run for this design step.
Only existing note edited, no runtime/normative/jsonl/owner ledger/D#, commit or push changes.
Initial-array role recognition is proposed; immediate store timing remains explicitly OPEN.

### User accepts START-array recognition; meaning of adapter immediate (2026-10-19)

User explicitly agrees to use the START array to identify initial delivery, then asks what
immediate:true is for. This accepts array-role recognition only, not a resolution of immediate
adapter timing. Prior proposed wording above is review history, not an activated protocol amendment.

**Rules — existing TypeScript adapter behavior, not new protocol policy.** immediate is an option
of SubscribeValuesOptions used by subscribeNodeValues, not a node/substrate activation or pause
option. Actual store.ts first selects opts.getSnapshot or node.cache, then calls run(read()) when
immediate is true, BEFORE calling node.subscribe. This guarantees that adapter invocation immediately
attempts a current-value callback even when the node has no DATA (the callback receives undefined).
It does not invoke fn to produce a value or promise the read belongs to a fresh execution. Existing
code suppresses synchronous initial/replay DATA while subscribing to avoid echoing the manually
read value, then forwards live DATA. That suppression's call-stack test is the previously identified
gap under deferred initialization, not a newly accepted correct implementation.

readableStore/writableStore and nanoAtom.subscribe default immediate:true; changes-only consumers
such as externalStore use the separate changesOnly behavior. immediate:false does NOT mean
future-changes-only: an ordinary populated node can still deliver cached DATA via its initial
subscription handshake. If the node is empty, no DATA means no value callback until actual DATA;
immediate:true instead supplies undefined immediately. Custom getSnapshot can supply a wrapper's
own current snapshot. No equality-based suppression of genuine live DATA is implied.

**Decisions.** Purpose is initializing a store/value listener from a current snapshot without
waiting for a later DATA event. The manual pre-subscribe read and actual initial delivery may
refer to different moments/epochs when fresh subscription must queue. START-role recognition
removes classification ambiguity but does not decide whether to preserve the early callback,
deliver a later updated baseline or wait for initialized baseline. No timing choice selected in
response to this definition question; immediate policy remains OPEN.

**Work.** Read store.ts SubscribeValuesOptions and subscribeNodeValues/readableStore/writableStore/
nanoAtom callsites in TS7a26. Local code evidence suffices; no external framework-contract claim.
No new runtime/probe/tests, normative Rules/formal/conformance, jsonl/owner ledger/D#, commit or
push changes. Existing note only. Client date/time context: 2026-10-19 America/Los_Angeles.

### Immediate adapter initialization with START-first delivery and synchronous fallback (2026-10-19; accepted direction)

User says "好的，继续" after the definition of immediate:true. This requests the next timing
discussion, not selection of a policy. START-array role recognition and acquisition-bound failure
routing remain accepted directions; adapter initial notification timing remains a new choice.

**Rules — proposed TypeScript adapter policy, not a new substrate rule.** Recommend keep immediate's
synchronous current-value notification guarantee while making actual START-array delivery the
ordinary initialization source. Unlike the current implementation, do not unconditionally read/call
the value listener before attempting subscription. Candidate sequence:
1. Begin owned subscription and retain its identity-bound release under the accepted acquisition/
   helper ownership rules. If the full initial START array arrives synchronously, immediate:true
   reads its current store snapshot once and calls the listener there. Treat its cached/replay DATA
   as initialization, not additional immediate value notifications. Activation output stays separate.
2. If the owned subscription returns pending without that initial array having been delivered, call
   the listener with the currently readable snapshot before the adapter itself returns. This value
   belongs to the currently readable node/store view, not a promise fresh initialization succeeded.
3. When the deferred initial START array is actually delivered, call the listener with the now-
   initialized current snapshot once. Do this even if its payload/reference equals the earlier
   fallback snapshot: these are two snapshot notifications at different moments, not two invented
   node DATA occurrences. A normal synchronous subscription does not need the fallback, so it still
   gets one initial notification. No adapter equality comparator or previous-value buffer selected.
4. Every subsequent live DATA occurrence is forwarded under the existing value adapter policy,
   including equal payloads. ChangesOnly without immediate continues to suppress initial snapshot/
   replay DATA; ordinary raw observers and input initialization keep their full arrays unchanged.
   No forced fn call, early reset, PULL, microtask or timer is needed to satisfy immediate.

The existing local subscribing Boolean can be replaced by an initial-array-delivered fact, set before
calling user code. This fact is per adapter subscription, not node status or a second readiness
authority. It determines only whether to issue the synchronous fallback; it does NOT classify later
DATA by whether the outer call returned. START-array structure supplies that role. Release/cancel
already prevents a canceled pending request receiving its later START. No fallback-only public mode,
stored previous snapshot, initialized node flag, equality hook, new protocol field/message or owner
registry is proposed. Exact private adapter lowering and the final whole-array Sink type are pending.

Candidate traces (only immediate value notifications shown):
- Synchronous initial cache23: START initializes listener23; no fallback, no repeated cached echo.
- Empty synchronous START: listener(undefined), then live DATA23 invokes listener23 normally.
- Pending fresh state initialization, readable old cache20/new baseline30: synchronous fallback20,
  then actual START initializes30. Does not leave listener stuck at20.
- Pending unchanged baseline23: fallback23, then actual START initializes23 again. This duplicate is
  an explicit proposed cost, not a falsely claimed real source occurrence or a runtime conformance
  bug to suppress with equality. An observer that requires occurrence semantics should use raw/live
  subscriptions, not interpret every immediate store snapshot as a new source event.
- Pending fresh compute, old cache23/reset baseline empty: fallback23, actual START initializes
  undefined, later live DATA23 is forwarded. Empty initialization must not be interpreted as "ignore
  first real DATA" or permission to keep the previous execution's value forever.
- Configured initial replay: immediate store reads its current snapshot once at initial delivery;
  it does not iterate replay DATA as fresh changes, matching the existing latest-value adapter role.
  Custom getSnapshot is used at each snapshot notification, rather than assuming DATA payloads equal
  the wrapper's projected store value. Object payloads retain normal reference semantics, no clone.
- Quiet PULL still emits START only at the node boundary; an explicit immediate adapter snapshot
  read remains a get, not an automatic demand or a synthetic node DATA delivery. It can expose an
  already-readable cache under the existing immediate option. A requirement for value adapters
  themselves to hide all cached reads would be a separate adapter policy, not inferred here.

Failure qualifications: synchronously rejected subscription need not emit a fake successful initial
value first. If the adapter's own synchronous snapshot callback throws before its outward release
handoff, the helper must release the acquisition it owns before reporting under QA-12, preserving
any separately handed-off valid alias. A later deferred initialization/notification failure is
post-handoff and follows the selected operation/owner rules; no automatic deletion of others or
protocol ERROR rewrite. An already-delivered fallback value is not rolled back on later failure.
Do not introduce a new failure receiver API just to implement this snapshot timing policy.

**Decisions — rationale and alternatives.** Preserve synchronous first notification because it is
not only a historical convenience: official Svelte store contract explicitly requires subscribe's
initial value callback synchronously; Nano Stores documentation distinguishes immediate subscribe
from listen. Sources read2026-10-19: https://svelte.dev/docs/svelte/stores#Store-contract and
https://github.com/nanostores/nanostores (Listening/subscribe vs listen). These substantiate only the
initial timing requirement, not certification of all GraphReFly framework adapters or nested-write
semantics. Focused bindings are separate packages and no browser/framework integration was run.

Always waiting for the actual initial array is simpler but can violate that synchronous contract
for the specific queued terminal re-acquisition case. Always pre-reading and suppressing the real
initial baseline loses20->30 or old23->empty corrections. Always pre-reading and unconditionally
re-emitting the initial baseline duplicates even ordinary synchronous subscription initialization.
Pre-read plus initial-only equality comparison can avoid equal repeats but requires retaining a
value/reference and choosing equality semantics for mutable/custom snapshots; not needed to preserve
the core occurrence rule and contrary to this bounded preference for minimal state. Recommend use
START normally, fallback only if needed, and accept the extra identical notification only when
initialization actually waited. This is a surfaced behavior change/cost, not dictated by the user
or by framework documentation. No backward-compatibility rationale overrides the architectural choice.

**Work.** Reread actual SubscribeValuesOptions/subscribeNodeValues, readableStore/writableStore/
nanoAtom/externalStore and existing consumer qualification probes. Browsed only primary framework
documentation for material external compatibility claims. No candidate implementation, new probe,
test rerun, runtime/normative Rules/formal/conformance, jsonl/owner ledger/D#, commit or push changes;
existing session note only, whitespace check. Previous16 consumer probes demonstrate the earlier
timing defects, not success of this new lowering. Selection remains pending; qualification after
selection must cover synchronous/deferred/empty/quiet/replay/custom snapshots, equal baseline,
baseline change/reset-to-empty, live equal DATA, callback reentry/error and cancel-before-START.

### Accepted immediate policy; consumer audit finds late store-baseline refresh gap (2026-10-19)

User agrees to the preceding immediate policy and requests another actual-library compatibility
check before moving to the next item if no conflict remains. Record immediate's synchronous
START-or-fallback direction accepted for review; no runtime/normative implementation authorized.
Do NOT advance to QA-22 claiming no remaining consumer issue: a real non-immediate store path
still misses a late initialized baseline, independently of the selected immediate policy's validity.

**Rules — combined-direction gap.** Accepted initial-role recognition identifies a START-containing
array even when no DATA is present. An initial array seeds a consumer; it is not a fresh source DATA
occurrence. However, a store listener that has already returned using/read an earlier snapshot may
need a notification when actual initialization changes the readable view. Universal "ignore initial
arrays" is suitable for an occurrence-only delta appender, but cannot by itself guarantee a store
observer's getSnapshot and last delivered value stay coherent.

Actual externalStore uses subscribeNodeValues with changesOnly:true; actual recordReadableStore
reads an aggregate immediately while listening to keys/fields through changesOnly:true. Both value
sinks ignore START and react to DATA only. Candidate trace: terminal old compute cache23, accepted
fresh subscription waits, store returns using23; fresh reset later clears compute cache, initial
array is START only, activation remains legitimately blocked/no new DATA. The readable snapshot is
now undefined, but these store observers receive no notification. A record store may retain its
delivered {a:{value:23}} while store.get() already reports {a:{value:undefined}}. No equality test or
first-DATA skip fixes that absent-event gap. Allowing equal fallback/initial notifications in
immediate wrappers does not cover these wrappers, because they do not use immediate:true.

**Decisions — pending reconciliation proposal, not user-selected.** Preserve the accepted immediate
policy. Extend store-facing initialization handling to distinguish a view-baseline refresh from a
source DATA occurrence: if a store subscription had to await its initial array after its ordinary
subscribe/read setup returned, notify its state-view owner once when that real initial array arrives,
including START-only/reset-to-empty. It may notify even if the value compares equal, consistent with
the accepted no-extra-equality/rare-repeated-baseline tradeoff. Normal synchronous initialization can
still be handled by the store's existing initial read/aggregate sync, without an extra setup echo.
No new wire event or node flag; initial role remains derived from START, while already-needed local
request/adapter initialization facts govern notification timing. Exact shared helper lowering is
pending, not a public onInitial option or a new source mode chosen here.

Do not globally change changesOnly's occurrence-filter policy or make persistence append cached
delta as a new change. externalStore/onStoreChange and aggregate record listeners are view refresh
consumers, not delta occurrence logs. Persistent delta recognition still skips initial/replay DATA;
establishing a durable snapshot baseline is a separate sidecar operation and must not be repaired
by replaying old deltas. Opted-in immediate cache reads for quiet PULL remain explicit reads rather
than automatic demand/node DATA. Ordinary raw consumers, Promise DATA/error settlement, retain,
live equal occurrence preservation and shared-owner cleanup keep the already accepted meanings.
This is an additional notification-policy choice: do not mark it implicitly accepted just because
the user accepted immediate:true. Callback exceptions/reentry/cancellation still use acquisition
ownership and ordinary failure reporting. No unrelated permanently blocked source must be forced
to emit to refresh a store, and no timer/polling fallback is proposed.

**Work — concrete actual-helper counterexample, bounded scope.** Added diagnostic
protocol-reconciliation-probes/late-initial-store-baseline.ts. It loads actual externalStore and
recordReadableStore from unchanged TS7a26; supplies a Node-shaped source with manually deferred
START-only initialization, old cache23 -> new undefined, followed optionally by real live DATA50.
recordReadableStore keys are a real Graph-owned state node; only its field source is a controlled
double. No production runtime or adapter is patched, and the probe is NOT a full implementation
of queued acquisition or accepted immediate lowering. Run from TS7a26 with node_modules/.bin/tsx
and absolute probe path exited0, DONE4 observations:
1. externalStore getSnapshot changes23->undefined; callback notification list remains empty.
2. Later live DATA50 correctly notifies50; release removes its only registration once.
3. recordReadableStore delivers23 once; actual get().a.value becomes undefined at late START while
   listener remains at23, showing aggregate store is not covered by immediate's proposed fix.
4. Later live DATA50 correctly refreshes aggregate; release removes field subscription once.
These assertions verify actual helper behavior under a controlled initialization timing, not a
current default production execution or candidate conformance pass. No network/I/O or new package.

Static recheck included readable/writable/nano immediate callsites; externalStore, Jotai/signal
change listeners and record aggregate; source firstValueFrom/singleFromAny, retain, and persistent
snapshot/delta attach roles from earlier audit. No additional claim that the generic changesOnly
policy already solves every UI/store wrapper. The existing89 baseline test receipt remains baseline
only; no repeated full suite needed for this source-unchanged diagnostic. No runtime/normative
Rules/formal/conformance, jsonl/owner ledger/D#, commit or push changes; existing note and probe only.
Immediate direction accepted; QA-1/2 consumer integration remains OPEN on late view-baseline refresh.
Defer QA-22 until this newly exposed choice is reconciled.

### User accepts late store-baseline refresh; QA-1/2 audit cursor advances (2026-10-19)

User agrees to the late view-baseline refresh supplement and asks for another coordination check,
then QA-22 if no issue remains. This accepts state-view owner notification at a delayed real initial
array (including START-only), without treating it as live DATA or changing delta append policy.
Prior pending wording above remains review history. No public onInitial API, hidden initial DATA,
equality gate or node flag is selected, and no implementation authorization is inferred.

**Rules — finite combined audit.** No further semantic conflict found within the reviewed cases:
normal synchronous store initialization is still one baseline notification; queued immediate
subscriptions get current fallback then actual initialized view (possibly equal); non-immediate
state-view wrappers receive delayed-baseline refresh; pure occurrence/delta consumers do not append
initial cache/replay. START-only after fresh compute reset can refresh undefined without forcing
fn or inventing DATA. Quiet-PULL node initialization stays START-only and adapter explicit reads
do not create PULL. Custom getSnapshot is used for view reads, not assumed equal to a DATA payload.
Live equal DATA remains an occurrence and is not suppressed by baseline notification policy.

For recordReadableStore, a late initial key set must use its existing sync/rebinding path, not only
run(read): release old field subscriptions and acquire the current key set before normal aggregate
notification. A late initial field only refreshes the current aggregate view. Removed/replaced
pending field registrations cannot call back via old identities, and release-before-START cancels
them. This follows existing key-driven sync versus field-driven read ownership, not a new graph
rewire API, coalescing policy or callback queue. Multiple valid delayed field baselines may produce
multiple legitimate view refreshes; no new all-fields-ready barrier for stores is inferred.

Callbacks/getters that throw retain the accepted pre-/post-handoff acquisition rules; unaffected
fanout and required cleanup continue. Explicit cancellation is not owner failure, required setup
failure notifies its acquisition owner without altering raw ctx.down ERROR, and already-resolved
Promise results remain resolved while later errors still report. FirstValueFrom/singleFromAny,
retains and actual source cancellation remain under their separate policies, not snapshot-count
heuristics. Initializing a persistent durable snapshot remains its own attach operation; skipping
old delta is not permission to claim future restored/late baseline support without qualification.

**Decisions.** Accepted directions can advance the walkthrough cursor from QA-1/2 to QA-22. Do not
call the runtime repaired, full conformance green or every related API finalized. Remaining tasks
are the already listed normative/transport/private lowering and combined-scenario verification,
not another unselected immediate-versus-deferred policy fork in the cases just reviewed. No new
backlog/work ledger identity or D# minted for this review cursor update.

**Work.** Static cross-check of actual store wrapper callsites and the saved16 consumer/4 late-store
diagnostic observations; those receipts are not tests of the selected new lowering. No new store
implementation or repeated baseline test suite run. Existing note only for this audit, no normative
Rules/formal/conformance/jsonl/owner ledger, runtime, commit or push change.

### QA-22 opening: restored logical state, first attachment and execution resources (2026-10-19; proposed)

**Rules — existing authority and observed implementation.** September28 accepted restore as distinct
from fresh-lifecycle reset: preserve represented cache/private state (including nonpersist) and
first-invocation history, no automatic recomputation solely from reconnecting an unchanged restored
baseline, no restored old ctx/cleanup/I/O handles. R-restore@1 records related historical policy but
has no activated_by; do not call it current normative authority. Activated R-first-run-gate@1 and
R-ctx-state@1 remain relevant; later accepted first-value/terminal/cleanup policies also require
reconciliation, not inferential activation of this draft.

Correct the premise "there is no restore marker" if read as an implementation claim: TS already
has _restoredActivationPending, set by nodeRestoreState, consumed by first nodeActivate, and used
to seed restored dependency caches while skipping their ordinary initial pushes. The QA-22 finding
is that the proposed minimal fact model omitted this cause/first-attachment distinction and its
scope, not that current code has no Boolean. hasCalledFnOnce records logical first-invocation
history; neither it nor cache presence proves runtime external resources are attached/started.

Proposed first design direction (not selected this turn):
- Keep represented logical state separate from new runtime resource ownership. A checkpoint commit
  installs the former; restored nodes initially have no subscribers, old ctx, cleanup closures or
  active external tasks. No I/O begins merely because checkpoint decoding/construction ran.
- Reuse the existing one-time restore-first-attachment/bootstrap cause, owned by initialization,
  rather than adding another public node status, isRestored flag and separate skippedCompute flag.
  Its exact storage may be the existing Boolean or an existing pending activation record; no new
  representation choice is locked. Consume it on the actual admitted initialization attempt, not
  on an unrelated getter/duplicate subscriber or before a PAUSE-blocked initialization can begin.
  Normal actual close/fresh reset no longer uses that one-time bootstrap cause; failed setup keeps
  the accepted no-in-place-auto-retry and owned cleanup rules. No extra serialized field is implied
  just because a restore operation creates a transient runtime bootstrap obligation.
- Preserved hasCalledFnOnce remains the first-value gate history, not a proxy for a timer/socket
  being connected. An explicitly restorable factory/adapter must define how resources are safely
  reestablished; blanket rerun of every depless fn or clearing first-invocation history can repeat
  unrelated effects/one-shot work and is not selected. Exact resource reentry API remains OPEN.
- Preserve an already evaluated result only against reconnection of its unchanged checkpoint
  baseline. A never-evaluated restored computation and genuinely newer upstream input require their
  ordinary invocation/freshness semantics; do not turn restore into permanent suppression. Need
  explicitly resolve cold first evaluation, input changes before first attachment and bootstrap
  completion/failure before deciding how the restore cause clears. No input-equality gate or
  mandatory versioning strategy is selected by this principle.

**Decisions — concrete questions for this item.** Three concerns must not be collapsed into cache
presence or a single "already run" bit: logical prior computation, one-time restored attachment,
and current execution resources. Prefer reusing existing restore bootstrap rather than a new public
status; independently define whether/how a factory can reattach resources. The earlier no-recompute
phrase cannot justify suppressing a cold initial evaluation or missing actual newer inputs. The
means of knowing baseline changed (represented received input/version/graph transitions) needs
design; do not quietly add generic per-job tracking, hidden subscriptions, fn replay or an equality
check that erases occurrence semantics. Restored terminal deps' baseline seed shortcut versus QA-11
ordinary admission is another explicit restore distinction to revisit after these initial cases.
These are QA-22 questions, not newly found contradictions in the just-settled store refresh policy.

**Work — bounded baseline evidence.** Read node-checkpoint-runtime,node-lifecycle-runtime activation/
seed path, restoreGraph state installation and named restore tests. Added diagnostic
protocol-reconciliation-probes/restore-first-attachment-source.ts; final tsx run from TS7a26 with
absolute path exited0,DONE4 baseline observations:
1. Open depless fn source checkpoint after DATA23: restore preserves23/hasCalledFnOnce=true; first
   subscription sees23, marks active, consumes _restoredActivationPending but fn entries0. Entry
   counter models setup only; no real external resource/network/timer exists. This proves preserved
   history can prevent fn reentry, not that every depless source should automatically reconnect.
2. Ordinary off then another subscribe in that restored graph runs fn once and produces24; one-time
   bootstrap behavior is not the same as ordinary later reactivation.
3. Never-evaluated derived D=A+1 with checkpointed A1: first attachment after restore yields no DATA,
   D cache remains absent and fn entries0 despite hasCalledFnOnce=false. Actual subsequent A6 runs
   it and yields7. Need decide intended cold bootstrap eligibility, not declare tested code normative.
4. Previously evaluated D2/A1 checkpoint; after restore, set A5 before D first attachment. That
   attachment still yields restored D2 and fn entries0, not6. Subsequent A6 yields7. This isolates
   pre-attachment input freshness, not just resource adapters or asynchronous I/O. New policy/fix
   not implemented. Probe releases every acquired subscription.

Existing restoreGraph-focused suite run from packages/ts via ../../node_modules/.bin/vitest run
src/__tests__/graph.restoregraph-fresh-graph-restore-r-restore-d94-d95.test.ts --reporter=dot exited0,
1 file/30 tests passed,no skips. These baseline tests include unchanged memo/private state retention,
restored cold-source actual live input, terminal-dep baseline seed and pre-activation rewire; they
do not prove intended behavior of all four diagnostic cases or any new reconnect mechanism. Initial
search referenced nonexistent restore-registry/restore-types files; actual types live in restore.ts.
Only existing note and diagnostic probe edited; no runtime, normative Rules/formal/conformance,
jsonl/owner ledger/D#, commit or push changes. QA-22 remains OPEN for design choices above.

### QA-22 ROM/RAM recollection versus checkpoint restore history (2026-10-21)

User recalls state as ROM retaining cache after recovery, other nodes as RAM needing recomputation,
and asks whether this still applies. Treat as an authority/history clarification and possible prompt
to reassess simplification, NOT acceptance of the previous QA-22 proposal or a new restore policy.

**Rules — distinguish lifecycle operations before applying the analogy.** R-rom-ram@1 text explicitly
describes disconnect/deactivation/reconnect: intrinsic plain state retains value, compute nodes clear
cache and reconnect fresh. It has no activated_by; it is not a resolved current public Rule. Its
introduced_by D5 references the broader Node/Graph split; actual graphrefly:D5 ledger text does not
itself spell out the ROM/RAM retention rule, so cite the rule text/review for that specific claim,
not a fabricated quote from D5. TS nodeDeactivate currently implements the plain-state/compute cache
split. This remains the selected ordinary NONTERMINAL closure/reactivation direction.

Checkpoint restore has distinct later history: graphrefly:D83 (2026-06-03, root decision row83)
preserves represented caches, all serialized private state and first-run history instead of fresh-
lifecycle wiping; graphrefly:D117 (2026-06-05, root row110) explicitly preserves restored derived cache
against recomputation solely from reconnecting topology. graphrefly:D94 is relocated root-origin
history in graphrefly-ts:decisions/root-origin-history.jsonl:8, not a root-current-body or a TS-origin
D94; it implements the descriptor/commit separation. R-restore@1 summarizes that policy but also
lacks activation metadata. September28's accepted review section explicitly retained this checkpoint
restore/fresh-lifecycle distinction. Current nodeRestoreState installs caches for both state/compute
and marks one-time restored attachment, matching that historical direction in the bounded baseline.
The recent accepted terminal-auto-close result-cache retention is another deliberate exception to
universal compute-cache-on-close clearing; keep ordinary nonterminal versus terminal close explicit.

**Decisions — clarification and open reconsideration.** The user's ROM/RAM memory corresponds to a
real disconnect/reactivation model; the same colloquial "恢复" can refer to either that operation
or checkpoint recovery. Do not dismiss the recollection or falsely claim the historical model never
existed. The previous QA-22 explanation should have made this distinction explicit before pursuing
bootstrap machinery. Present two separate behaviors rather than assume all restores must use the
later checkpoint exception solely because it was written later. Earlier and later records exercise
different operations; their justification still merits the user's current reassessment.

Unifying checkpoint recovery with the ordinary RAM recompute policy is a legitimate new design
alternative, not a bug-fix implication of R-rom-ram. It could simplify cache-validity/bootstrap rules,
but would change D83/D117 and the accepted restoration of represented logical/private state; stateful
accumulators/effects/resource-producing fn need explicit replay/side-effect policy. E.g. rerunning
an accumulator with restored private accumulated total can apply an already-accounted input again.
That is an illustrative tradeoff/inference, not claimed as a verbatim historical rationale. No
user selection to preserve/revise D83/D117 or serialize only state is inferred from this question.
QA-22 stays OPEN; first gate/cold source/input-changed-before-attach observations remain valid
baseline evidence, not pressure to adopt more flags or an unapproved recovery architecture.

**Work.** Read exact rule rows, relevant root owner rows D5/D83/D117/D160 and relocation entry for
graphrefly:D94; compared relocated D94 in TS worktree and sibling main ledger, both matching content;
read accepted September28 review and recent terminal snapshot direction. Re-read TS deactivation and
restore installation. Broad initial ledger grep returned noisy/truncated unrelated rows; corrected
to exact JSON id extraction. No new runtime/probe/tests or normative Rules/formal/conformance,
jsonl/owner ledger/D#, commit or push changes. Existing review note only; client date2026-10-21.

### QA-22 comparison: preserve logical checkpoint versus rebuild from durable inputs (2026-10-22; proposed)

User asks to compare the alternatives; this is NOT approval of either new wording or a change to
the historical restore direction.

**Rules — scope and competing traces.** Ordinary NONTERMINAL deactivation/reactivation keeps the
selected plain-state ROM / compute RAM split. Checkpoint recovery is the separate operation under
review. R-rom-ram@1 and R-restore@1 both lack activation metadata; the historical D83/D117 and
September28 accepted review explain the preservation direction but do not activate either row.
Recent terminal-close retention/admission remains a separate constraint: rebuilding compute is not
implicit permission to reopen completed/errored executions or replay their effects.

Compare A, restoring represented logical cache/private state/first-run history, with B, restoring
durable state inputs and rebuilding compute. B needs an explicit private-state choice: retaining it
while applying the old current input again can double-count; resetting it cannot reconstruct history
from a single retained input. Concrete illustration grounded in current scan/reduce: inputs 5 then7
produce accumulated12 with upstream latest7. A restores accumulated12 (and scan output12, whereas
reduce may still have no output); later new DATA3 gives15. B resetting accumulation and processing
latest7 gives7, then3 gives10; B retaining12 and processing latest7 gives19, then3 gives22. These
are hypothetical B traces, not observed candidate-runtime behavior. Replaying full event history,
or explicitly externalizing accumulator state and separating baseline from new occurrences, can
reconstruct it, but requires additional stored information/application or adapter policy.

**Decisions — proposed recommendation, not selected.** Prefer A for the existing generic graph
checkpoint contract because scan/reduce/take/pairwise contain real execution history, not merely
disposable pure-function caches. Pure derived recomputation is a strong fit for B, but does not
justify silently redefining stateful execution as reconstructible from current input values.
Preserving checkpoint state must not be described as preserving live execution: old ctx, cleanup
closures, timers, sockets and requests are not revived. Both A and B need explicit resource
re-establishment; A alone can leave a source logically restored but resource-less, B alone can
repeat an effect or external action. Neither provides exactly-once external effects.

A costs more serialized state and first-attachment/input-freshness/bootstrap reasoning; B can
reduce those cache-preservation branches and payload/recompute tradeoffs are workload-dependent.
B does not eliminate lifecycle, first-input readiness, terminal or resource handling, and moves
stateful-history reconstruction into operators/factories/application state or an event log. D160
collections additionally retain their authoritative backend through contributors, rather than
turning backend data into disposable node cache. Avoid inventing two public restore modes or a
per-node policy matrix merely to postpone the contract choice. If B is preferred, explicitly
reassess the contract as rebuilding from durable inputs, including the changed history guarantees.
No choice is justified merely by compatibility with existing D83/D117.

Current QA-22 source-without-resource, never-run-derived and changed-input-before-first-attach
observations remain open shortcomings of the bounded A baseline. This comparison does not bless
them or settle their implementation. No extra flag, versioning, equality or resource-start API
is selected by the recommendation.

**Work/evidence.** Read actual TS scan/reduce/take/distinctUntilChanged/pairwise implementations
in packages/ts/src/graph/operators.ts, derived/effect wrappers in graph/graph.ts, source setup and
cleanup ownership in graph/sources.ts, checkpoint-state installation and existing restore tests.
scan/reduce use ctx.state accumulation; take stores count; pairwise stores previous input; effect
body and resource/cleanup registration are not separate public entrypoints. These demonstrate
behavioral requirements, not a claim that all closure-based operators currently have portable
registry descriptors. Existing take descriptors and memo/private-state restore tests corroborate
the existing contract; no new test/probe or test rerun was needed for this alternative comparison.
Only this review note changed; no runtime, normative Rules/formal/conformance, jsonl/owner ledger,
D#, commit or push changes. QA-22 remains OPEN pending the user's contract preference and later
resolution of bootstrap/resource/freshness details.

### QA-22 logical-state preservation accepted; external resource boundary next (2026-10-22)

**Rules — accepted review direction, pending normative reconciliation.** User said "同意，继续"
after the A/B comparison. Record acceptance of A: graph checkpoint restores represented logical
cache, private algorithm state and first-run history, rather than discarding compute state and
rebuilding from durable inputs. Ordinary NONTERMINAL deactivation/reactivation keeps the selected
plain-state ROM / compute RAM policy; terminal close/reset remains separately governed. This
acceptance neither activates R-restore@1/R-rom-ram@1 nor authorizes runtime/spec/ledger changes.
It does not select the resource/bootstrap/freshness mechanisms left open in QA-22.

**Decisions — next proposal, not accepted yet.** Separate the responsibilities of rebuilding a
restorable node's external resources from preserving its logical computation history. Prefer the
explicit factory/adapter to define a safe reconstruction policy; runtime controls admission,
dispatcher invocation, current ctx authority, PAUSE and lifecycle-owned cleanup. Do not infer
reconstruction from no-deps, cache presence, hasCalledFnOnce, or merely a registry-ref name.

Proposed boundary: constructing/committing a restored graph does not start external work. On an
eligible activation of an open node, an explicitly supported resource reconstruction action may
establish NEW resources while preserving represented algorithm state. Default PAUSE gates new
setup invocations under the already accepted policy; ordinary resumeAll output semantics still
apply. Terminal restore does not automatically reopen a source. New actual output from setup is
live DATA, not checkpoint replay; no equality filter or blanket suppression is implied. Synchronous
setup output and initial snapshot ordering still follow/need reconciliation with initialization
rules; this paragraph does not settle a new ordering.

A restorable continuous-source factory must define what its new connection/subscription means;
continuity, server cursor replay and downtime event recovery are not provided by node cache alone.
A one-shot side effect (e.g. an external write) must not be repeated just because fn had previously
run. A Promise/old socket is not serialized or resurrected. If the intended continuation cannot
be supported by its representation/descriptor, reject the unsupported recovery rather than claim
execution recovery from a cache-only result. Validation of representable recovery policy is distinct
from predicting whether a later live connection will succeed. Operation versus protocol failure
remains the accepted separate ownership question, not a new universal ERROR conversion.

This adds an explicit resource-reconstruction path/contract for relevant factories, not a generic
tracker of individual tasks or another public node status. Exact hook/registration surface and
whether an existing activation invocation can carry the action remain OPEN; do not claim the
current create-only descriptor already implements this proposal. Avoid starting I/O from create
before restore state commit or clearing hasCalledFnOnce to trick normal fn gates into rerunning.

**Work/evidence.** Read GraphRestoreDescriptor/Context in TS graph/restore.ts: validateConfig and
create only; constructPrepared constructs descriptors first and then installs runtime state.
timerRestoreDescriptor registers the ordinary timer fn. Node activation currently gates a depless
fn using !hasCalledFnOnce, explaining the prior source-bootstrap diagnostic. source setup owns
cleanup via onDeactivation; periodic timer count currently lives in a setup closure, not serialized
ctx.state. Only plain one-shot timer has the built-in portable timer descriptor; this discussion
does not claim periodic timer/socket/fromPromise already has portable continuation support.
No new probe/test/run or external calls needed for this boundary review. Existing session note
only; no runtime, normative Rules/formal/conformance, jsonl/owner-ledger/D#, commit or push edits.

### QA-22 resource responsibility accepted; minimal reattachment entry proposal (2026-10-22)

**Rules — accepted boundary and next gap.** User explicitly accepts the factory/adapter versus
runtime responsibility split and asks to design the smallest reconstruction entry. The preceding
boundary is now an accepted review direction; it is not implementation or normative-activation
authorization. Preserve checkpoint logical history, do not revive old ctx/resources, do not start
external work during restore construction/commit, and do not automatically reopen terminal nodes.
The agreed F-DISPATCH-ALL/F-SYNC-CORE floor plus activated R-ctx-state@1, R-first-run-gate@1 and
R-cleanup-hooks@1 constrain the proposal. R-dispatch-all@1/R-sync-core@1 themselves lack activated_by;
do not mislabel those rows current merely because their content reflects that floor. In particular
cleanup remains the selected per-invocation replacement
contract; an extra reconstruction callback cannot silently create a permanent parallel hook owner.

**Decisions — proposed surface, not yet selected.** Add one optional reattach callback only to the
restore descriptor's registerNode options, not to general raw Ctx, node status, messages, public
g.node lifecycle options, or both descriptor-level and registration-level duplicate surfaces.
Illustrative TS shape (naming and final generic syntax remain proposal):

    registerNode(factory, deps, fn, opts?: SugarOpts & { reattach?: NodeFn })

The descriptor creates this callback from its resolved config, implementations and environment;
no function/connection/Handle is added to checkpoint JSON. Existing NodeFn=(ctx)=>void and dispatcher
register/invoke are sufficient invocation types. A simple source may supply its ordinary setup
function as both fn and reattach; a factory needing different reconstruction supplies a different
callback. Do not infer that an arbitrary old fn is safe to replay, or add a ctx.isRestoring flag
solely to force every invocation's body to distinguish resource setup from data processing.
This is an opt-in path, not an assertion all existing operators are resource-restorable.

Store the optional dispatcher action with the existing one-time restored initialization work,
replacing/extending _restoredActivationPending rather than adding parallel pending/started/done
booleans. Ordinary restored nodes need only the existing baseline-initialization cause; resource
nodes additionally carry the optional callback handle until admission/consumption/cancellation.
Both representations and exact slot placement remain implementation design, not new serialized
state. There is real incremental cost: registration of a temporary handle and integration of this
action with the existing activation boundary. It is not zero-cost merely because types are reused.

Admission must use the established lifecycle/ctx/PAUSE/initialization scheduling rules, not a second
queue or an inline call from create. Keep the work pending while default PAUSE blocks it; consume
the reattachment action just before its actual admitted invocation so reentrancy cannot execute it
twice. Close/cancellation before invocation retires the pending action, never transfers it into a
fresh ordinary lifecycle. Release its temporary dispatcher handle on consume/failure/cancellation;
an async callback retaining a valid current ctx is independent of the registration's temporary
dispatch slot. A normal future fresh activation uses the factory's ordinary fn path.

Resource reconstruction uses current lifecycle ctx and represented private state, with no invented
DATA/RESOLVED/START input and no logical first-run-history reset or false first-computation mark.
For a checkpointed node whose ordinary fn never ran, use ordinary first-invocation eligibility;
do not execute reattach plus fn as two automatic setup calls. The optional callback expresses the
factory's reconstruction policy for a previously evaluated restored execution, not proof that
hasCalledFnOnce itself means an external resource exists.
Resource setup alone does not dirty the output or settle an unrelated pending input wave. Actual
ctx.down output follows ordinary complete-wave normalization, including automatic DIRTY when
needed. Do not call existing _runWave unchanged: it sets hasCalledFnOnce, replaces hook lists and
consumes dep projections/settlement bookkeeping. Reuse its safe invocation/ctx machinery as
appropriate, while keeping resource setup distinct from consuming an ordinary calculation wave.
Dep-bearing initialization/wiring/partial gates must follow the already accepted activation
contract; no full-wiring barrier or permission to ignore failed wiring is selected here. Detailed
ordering of synchronous setup outputs versus snapshot/live activation input remains QA-22 follow-up.

Use ctx.onDeactivation/onInvalidate under the existing hook contract and QA-13 resource handoff:
setup owns partial acquisition until successful registration, and wrapper-owned late cleanup handles
closure during setup. A later ordinary fn invocation still replaces hooks; the factory must rehand
off cleanup for resources it retains on that run. No permanent-resource hook class, accumulated
hook registry or new public resourceStarted state is introduced to evade that rule. A factory
cannot treat reattach as a general hidden effect replay/automatic dependency computation.

Reattachment entry failure is an activation/acquisition operation failure under the established
ownership/cleanup/no-in-place-auto-retry contract; do not wrap it in value-sugar's generic throw-to-
protocol-ERROR conversion. Explicit protocol output from a source, and later driver failures, keep
their own existing protocol/adapter failure semantics. Failed setup must not run the ordinary fn
as fallback or report the node as successfully initialized. Surviving-owner/quarantine details
reuse the accepted wiring-failure direction rather than minting another failure-state mechanism.

Tradeoffs: running every restored no-deps fn is smaller in lines but unsafe for side effects;
an extra raw ctx reason field makes all invocation handling broader and still needs runtime
admission metadata; general activation hooks widen the whole lifecycle API. The proposed bounded
descriptor callback is a small explicit addition with existing dispatch/cleanup/context mechanisms.
It does not by itself solve server cursor continuity, missing timer closure state, exactly-once
external work, new-input-before-first-attachment freshness, or cold first computation.

**Work/evidence.** Re-read dispatcher/index.ts (Pool/NodeFn/Handle/register/invoke/unregister),
graph/restore.ts descriptor registration, node-lifecycle-runtime.ts, node-input-runtime.ts nodeRunWave,
node-runtime-host.ts and ctx/types.ts; cross-checked QA-13 hook handoff and per-run replacement.
Initial searches for dispatcher/types.ts and node-wave-runtime.ts failed because those files do
not exist; corrected to dispatcher/index.ts and node-input-runtime.ts. Read review/governance
references. Existing note only, no prototype/runtime changes, tests or external I/O executed;
candidate entry not claimed verified. No Rules/formal/conformance/jsonl/owner ledger/D#/commit/push
mutations. User has accepted the responsibility boundary, not yet this concrete entry proposal.

### QA-22 reattach entry accepted; source/operator/cleanup compatibility review (2026-10-22)

**Rules — acceptance and findings.** User accepts the optional restore-registration reattach entry
and requests compatibility review before moving on. The prior entry shape/admission/history/cleanup
direction is an accepted review candidate, not code/spec/ledger edit authorization. Do not declare
QA-22 closed: concrete existing cleanup deviation and initialization ordering gap below require
reconciliation. R-cleanup-hooks@1 is activated and requires re-registration on each invocation;
the accepted QA-13 handoff and no stale ctx registration remain applicable. Ordinary operator
R-fn-contract text lacks activation metadata; use the inspected source plus agreed dispatcher floor
and accepted walkthrough directions, not false activation, for the implementation comparison.

**Decisions — compatibility assessment and proposed follow-ups.**

1. Pure/value-history operators map/filter/scan/reduce/take/pairwise/distinctUntilChanged need no
   resource reattach callback. Preserving represented state/cache and not feeding old snapshot DATA
   again avoids duplicate accumulation/counting. Do not automatically use operator body as reattach.
   Higher-order *Map additionally has live Node references in private state and dynamic inner deps;
   the callback is not an automatic portable encoding/remapping or resumption of pending work.
   Existing strict portability/admissibility checks still apply; no blanket new support is claimed.
2. The source helper's early onDeactivation trampoline and wrapper-owned late-return cleanup are
   compatible with the proposed callback and QA-13 handoff. Preserve that wrapper when adapting a
   resource source instead of invoking an unwrapped setup whose returned cleanup would be ignored
   by NodeFn's void contract. Simple timer/stream callbacks still need their own represented progress:
   timer count and asynchronous iterator position currently live in closures/external objects.
   Explicit recoverability remains required; reattach alone does not serialize them.
3. Existing source/operator wrappers can catch their own error and explicitly down(ERROR).
   Uncaught reattach invocation failure remains acquisition/operation failure; a wrapper's already
   handled explicit protocol ERROR remains protocol output. Runtime must not reinterpret all
   protocol ERROR as acquisition failure or claim supplying an existing wrapped NodeFn makes its
   internal error policy disappear. No new error carrier/handled flag is proposed.
4. Confirmed PRE-EXISTING cleanup deviation in adapters/environment-websocket-session.ts:
   initWebSocketSessionState sets cleanupInstalled once and registers only if false. nodeRunWave
   clears both hook lists on the next ordinary command invocation; cleanupInstalled remains true,
   preventing registration of the current cleanup. This already leaks cancellation on ordinary
   start->send->last unsubscribe without checkpoint/reattach. Proposed repair direction is removing
   the redundant cleanupInstalled gate and re-registering the current cleanup every invocation,
   retaining per-run hooks and resource handoff. Do not add a permanent hook list, preserve old hooks
   invisibly, or change reattach to fix an old consumer deviation. This review did not implement repair.
5. New entry ORDERING GAP: dependency activation can deliver actual live DATA and run an ordinary
   resource-owning fn before deferred reattach runs. Then a late reattach can start a second resource
   or replace the ordinary run's cleanup; reverse order also needs ordinary fn to rehand off cleanup
   rather than blindly open another connection. Proposed local ordering is treating optional reattach
   as a prerequisite to the first ordinary fn dispatch of that restored resource node; setup's
   synchronous emissions/controls follow the existing boundary, then ordinary eligible work runs.
   No all-graph/full-dependency-wiring barrier and no weaker partial:true semantics are implied.
   Preserve incoming work under the already chosen input/pause/initialization policy; never fabricate
   baseline events or consume an ordinary dep wave as part of reattach. Factories must co-design
   reattach and ordinary fn for shared resource ownership and per-run cleanup, rather than expect
   runtime to deduplicate unknown external connections. Existing restored-initialization work can
   express this sequencing; no separate resourceStarted/done flag selected. This ordering is proposed,
   NOT user accepted by their approval of the entry before this cross-check.
6. PULL compatibility is constrained by accepted quiet/demand semantics: reattachment is not a
   demand, supplies no ctx.pull, does not restore owed old-life PULL or push cached replay. Resource
   setup cannot be used to bypass the holder's existing quiet/output policy; do not universally
   run it through ordinary PULL-demand dispatch. Exact admission/output composition for an opted-in
   resource holder remains a named qualification before implementation, not implicit proof that the
   new callback respects quiet solely because it uses ctx.down.

**Work — evidence and limits.** Inspected source helper, driverOneShotSource/driverStreamSource,
timer, fromPromise/fromAsyncIter and source factory surfaces; ordinary/stateful/higher-order operator
bodies, operatorNodeFn error wrapper, WebSocket session and keyed-rate-limit/cascading-cache cleanup
consumers; node-context-runtime, node-input-runtime and output pause/PULL branches. Source lookup
for node-ctx-runtime/node-subscribe-runtime/node-control-runtime and a nonexistent cache directory
failed; corrected to actual node-context-runtime and node-output-runtime, known lifecycle paths.
An unquoted nonexistent websocket test glob failed; corrected to rg over __tests__.

Added diagnostic protocol-reconciliation-probes/reattach-websocket-cleanup-baseline.ts with the REAL
Graph/webSocketSession adapter and a controlled in-memory EnvironmentDrivers websocket. It creates no
network/socket/timer resources and does not implement or emulate the new reattach path. Run from
TS7a26 using node_modules/.bin/tsx <absolute probe path>: exit0, DONE2 observations. Control start/open/
off: one connect, hook count1 before off, cancel called1. start/open/send/off: one connect and one send,
hook count1 after start then0 before off, cancel called0 despite node inactive. All assertions pass
for those baseline observations; no assertion that candidate reattach works. Cleared fake callback
references; no live resources to release. Source itself was unchanged. This validates finding4,
not the proposed ordering/admission or any new portable resource support.

No broad test rerun or runtime repair warranted for this bounded design review. Only existing
session note and diagnostic file changed; no normative Rules/formal/conformance/jsonl/owner-ledger,
D#, commit or push changes. Stay on QA-22 compatibility before freshness/next item; obtain the user's
direction on these gaps rather than silently choosing new semantics or reporting no conflicts.

### QA-22 three compatibility supplements accepted; pending reattach versus rewire (2026-10-22)

**Rules — accepted directions and remaining boundary.** User explicitly accepts all three last
supplements: WebSocket adapter re-registers current cleanup on every invocation instead of the
cleanupInstalled one-time guard; resource reattachment precedes ordinary fn dispatch of the same
restored resource node with factory-coordinated shared resource cleanup and no global/full-wiring
barrier; a quiet PULL holder keeps reattach pending until an eligible PULL, then setup precedes
the demand fn. No repair implementation or external execution authorization is implied. Last
review's PULL qualification is now resolved at that semantic level; these are accepted review
directions, not activated rules or verified candidate-runtime behavior.

Recheck implications rather than add mechanisms: because reattach is not itself a demand it must
not inherit ctx.pull merely from running inside nodeDeliverPullDemand's activePull scope. Only
the subsequent actual demand fn sees the admitted demand. If setup emits terminal, closes its
lifecycle or fails, do not dispatch the demand fn afterward; revalidate the established admission
conditions at the next boundary. Callback-origin controls remain queued in accepted FIFO order;
do not execute PAUSE/TEARDOWN inline to make this special path work. This is a consequence of
accepted authority/scheduling, not a new per-task tracker or second control queue.

**Decisions — remaining genuine composition question, proposed resolution.** Existing public
replaceDeps(...,fn) and other rewire operations replace the computation's dispatcher registration;
an inactive restored node can be rewired before first attachment, and an active resource holder
can be rewired while PAUSE/quiet keeps its reattach pending. A callback constructed by the old
descriptor can capture old config/resource logic. If it survives an effective fn replacement,
it may start the obsolete resource before the new fn. This requires explicitly defining ownership
of the pending action; it is not proof of a new runtime bug because reattach is still unimplemented.

Recommend binding pending reattach to the restored computation registration that supplied it.
An effective fn replacement cancels an unstarted old action and releases its temporary handle;
no resource cleanup is owed for an action never run. Rejected/uncommitted queued rewire must not
cancel it merely on request. A completed setup resource still follows existing live cleanup rules,
not silent cancellation under this pending-work rule. New fn follows ordinary rewire/activation
eligibility and must explicitly own any resource setup it needs; do not claim it automatically
inherits a compatible old callback or automatically receives an extra startup invocation. A
fresh restore descriptor registration is an explicit supported way to supply a new action;
extending public rewire to install callbacks is not included in this proposal.

Tradeoff: conservative cancellation may also discard a callback that an author knows remains
compatible after a logically harmless fn/dependency change; runtime cannot establish closure
compatibility from source equality. This does not require a new revision counter if cancellation
is owned by the existing effective registration replacement path. Keeping callbacks instead would
bind resource lifetime to the old factory independently of the replaced computation and require
an explicit invariant/transfer contract. Neither choice was selected by the user's earlier
three-supplement approval. Stay on this boundary before declaring resource compatibility complete.

**Work/evidence.** Read nodeRewire: after validation and actual batch deferral, it currently clears
_restoredActivationPending when inactive and registers the replacement fn, releasing old handle;
read nodeActivate, demand activePull scoping and fire gates. Existing restore test at
graph.restoregraph-fresh-graph-restore-r-restore-d94-d95.test.ts:318 deliberately rewires before
activation, demonstrating this is a supported baseline composition: initial old cache2 then new
computation11. It does not test resource callback ownership. No new probe/test rerun is needed to
prove an unimplemented callback policy. Existing cleanup probe receipt remains exit0/DONE2 and
does not validate candidate reattach. Only existing review note changed; no runtime, normative
Rules/formal/conformance/jsonl/owner ledger/D#/commit/push mutations. QA-22 remains OPEN for this
owner choice and subsequent cold/input-freshness cases.

### QA-22 assessment of extending public rewire with reattach (2026-10-22; proposed)

User asks whether public rewire should accept a replacement reattach after the clarification that
fn and optional reattach belong to one execution definition but serve different invocation purposes.
That question does not itself approve the previous cancel-on-effective-fn-replacement proposal or
a broader execution-definition API.

**Rules — existing distinction.** Activated R-rewire@1 specifies surgical topology/fn replacement,
preserving kept subscriptions, cache and first-run history; it is not a fresh lifecycle/resource
restart. R-cleanup-hooks@1 is activated. R-rewire-deferred@1 and R-restore@1 lack activated_by;
the accepted walkthrough amendments still need normative reconciliation. Rewire currently requires
an explicit NodeFn for positional deps, in both public Node methods and ctx.rewireNext. The pending
restore callback is new approved-in-review work, not an existing public general resource hook.

**Decisions — alternatives and current recommendation, not locked.**
- No extension now: keep restore-registration reattach explicit and bounded; effective replacement
  of its computation cancels an unstarted old action under the still-proposed ownership rule.
  Ordinary rewire neither inherits it nor creates an extra startup invocation. Existing new-node +
  consumer-rewire composition remains available when switching resource sources. This changes source
  identity/private state, so do not claim equivalence to replacing a resource recipe on the SAME
  stateful node; that is the concrete currently unsupported requirement that could justify extension.
- If that same-node requirement is established, a coherent future shape is one atomic execution
  definition containing fn plus optional reattach, applied through the same internal path for public
  and deferred rewire. This is an alternative for review, not a selected signature, overload or new
  method. Omission must not silently retain an old callback. It need not require new booleans,
  but it broadens public/deferred API and operation ownership and needs a complete recovery contract.

Important costs of the extension: installing a callback cannot implicitly mean immediately opening
another resource or restarting a lifecycle; already-started resources still follow current cleanup.
One must define callback installation before versus after the one-time restore obligation has been
consumed, cancellation/disposal of queued or failed replacements, and checkpoint factory-ref/config
consistency for the changed definition. fn bodies/reattach closures cannot be serialized by putting
them into a definition object. Existing graph Entry restore metadata does not automatically become
correct when a public raw fn is replaced. Do not add a public callback argument that appears to
promise future portable recovery without addressing that factory contract.

Proposed recommendation is NO public expansion yet, based on inspected consumers rather than a
blanket impossibility claim. Higher-order operators create and rewire inner sources; bridge/process
rewire command-routing projection fn without transferring external connection ownership. No examined
consumer requires retaining the same node/private algorithm state while swapping its resource
reconstruction recipe. The entry can be reconsidered when that concrete need exists; lack of a
current caller is not evidence no user could need it. No new status, callback-inheritance guess or
duplicate rewire-resource API is selected. Pending callback cancellation remains awaiting the user's
choice; do not label it approved by this recommendation.

**Work/evidence.** Read public Node replaceDeps/subscribeDep/unsubscribeDep, RewireNext and underlying
registration replacement; higher-order mapOperator creation/removal/addition, bridge.ts command
source attach/detach and process.ts command-source attach/detach, and restore descriptor context.
Initial dynamic*.ts unquoted nonexistent glob failed; corrected to known call sites/direct rg.
Broad rule search was noisy; corrected to exact JSON IDs and activation metadata. No new runtime
prototype/tests, since this is an API necessity/cost assessment, not a candidate behavioral proof.
Incidental review observation: bridge initBridgeState also uses cleanupInstalled to guard hook
registration; the same structural per-run-hook mismatch as WebSocket is suspected, not independently
probe-verified here. Keep it with cleanup-consumer qualification rather than treating a new resource
API as its repair or declaring all consumers fixed.
Only existing session note changed; no runtime/spec/formal/conformance/jsonl/owner-ledger/D# or
commit/push mutations. QA-22 rewire expansion and pending-action ownership remain review choices.

### QA-22 public rewire scope accepted; pre-first-subscription input changes (2026-10-25)

**Rules — accepted scope and baseline gap.** User explicitly agrees not to extend public rewire,
and to cancel old unstarted reattach when fn is effectively replaced. Record both as accepted
review directions, preserving rejected/uncommitted request versus effective-replacement distinction
and existing cleanup for already-started resources. Continue QA-22 input freshness; no runtime or
normative/ledger edit authorization follows. The preserved logical checkpoint direction and
graphrefly:D117's historical unchanged-reconnection versus actual post-commit-event distinction
remain the context. R-restore@1 still lacks activated_by; no activation inferred.

The current first restored attachment seeds dep caches and suppresses ordinary initial pushes
without checking whether upstream DATA changed after restore commit. Thus restored A1/D2, A.set5
before D subscribes, first subscribe still yields only2 with fn calls0. Same-value A.set1 is also
an actual event but suppressed at that restored attachment. Do not call this equal-value suppression
by an explicit comparator: current code suppresses initialization wholesale. After D is subscribed,
even A.set(A.cache) invokes the fn normally. The issue is bootstrap/freshness, not changing the
already selected live DATA occurrence contract or adding equality to it.

**Decisions — proposed behavior, not accepted.** For a previously evaluated open restored compute:
an unchanged checkpoint baseline reconnect does not compute again; actual post-commit upstream
change must not be hidden forever by restored-initialization suppression. First eligible activation
should refresh from the current visible inputs when the baseline is known to have advanced. A1/D2
then A5 should progress to6; equal-valued A1 DATA also counts as advancement and can produce new
DATA2. Retained D2 may remain an initial snapshot, but cannot be presented as a newly recomputed
result or the end of catching up. Initial START snapshot and refreshed calculation output retain
their distinct roles and agreed dirty/settlement scheduling; this note does not silently add a new
message type, blanket first-run reset, graph-wide barrier or synchronous getter recomputation.
Never-evaluated restored computations use ordinary first-run/partial admission rather than a
fictional preserved computed result. Terminal, INVALIDATE, pause and PULL keep their own gates;
this simple pure-derived trace does not override them.

Proposed inactive-branch boundary: do not promise replay of all intermediate events emitted while
that branch had no active dependency subscription. A3 then A5 before first D attachment should
initialize against current5 rather than require synthetic replay of3 and5; exact history needs an
explicit event log/replay source. This is NOT permission to coalesce/erase arrays actually delivered
to an active dependency subscription or within the accepted wiring/pause rules. Consumers sharing
the upstream through live branches continue to receive their actual occurrences. Restored stateful
operators retain their represented historical state; catching up through a new current baseline is
not equivalent to recovering all unseen scan/reduce inputs, which cannot be inferred from cache.
How callback projections/initial origin express that refresh and how a dependency chain establishes
upstream freshness without double-running require follow-up before a mechanism is locked.

The evidence required is occurrence/control advancement, not value inequality, a hash of the latest
payload or wall-clock timing. No-change-by-value misses equal DATA and change-away-and-back. Current
node version0/1 counters advance for DATA, including equal DATA; versioning can be disabled, and
INVALIDATE does not advance the DATA counter. Thus mandatory correctness cannot silently depend on
optional versioning alone. Graph.observe is a real activating subscriber, not a passive all-node
mutation feed, and cannot be installed secretly to solve inactive freshness without changing
lifecycle/resource behavior. No new global history, per-job tracker, required versioning counter,
hidden observer subscription or separate public status is selected here. Select observable inactive
refresh behavior before comparing concrete evidence/storage strategies under F-PERF.

**Work — bounded baseline evidence.** TS worktree still HEAD dafc5ae57d446a59a7388214c31bd7a6e73d1519
and clean runtime source. Re-read pending restore installation, graph.observe, core/graph owner facts,
DATA version policy and advancement; optional false does disable stored NodeVersion, graph observe
clock advances only on observed egress, not every inactive-node mutation. Added diagnostic
protocol-reconciliation-probes/restore-input-change-before-attach.ts, real Graph/restoreGraph and
controlled registered increment fn, no external work. Run via node_modules/.bin/tsx <absolute path>
from TS7a26: exit0, DONE5 cases. Unchanged/equal DATA1/different DATA5/two DATA3,5/versioning:false DATA5
all first-attach [2], fn calls0. Enabled upstream counter increments by0/1/1/2 respectively; disabled
case has no version. Each case then calls set(current value) while subscribed: fn calls1 and emits
current input+1. All original/restored subscriptions released. This verifies the baseline omission
and data-counter limits, NOT proposed future refresh/reattach behavior. No full test rerun required.
Only existing note plus diagnostic changed; no runtime, Rules/formal/conformance/jsonl/owner-ledger,
D#, commit or push changes. Client date2026-10-25; behavior/evidence strategy remains under discussion.

### QA-22 inactive refresh boundary accepted; minimal change evidence proposal (2026-10-26)

**Rules — user acceptance and invariant.** User accepts unchanged baseline preserves computation,
post-restore advancement triggers eligible refresh (including equal DATA), and an inactive branch
does not implicitly retain/replay all intermediate upstream events. Actual active-edge occurrences
remain protected. User asks for the smallest evidence mechanism, without depending on optional
versioning or many flags. Prior reattach/rewire scope decisions remain accepted; no implementation
or normative/ledger edit authorization. D117 remains historical rationale, R-restore@1 unactivated.
Private algorithm state, cache, pending dirty and terminal facts retain their established owners.

**Decisions — proposed temporary summary, not yet selected.** Prefer a restore-initialization-owned
temporary sparse change summary keyed by exact node identity, rather than adding a permanent
node revision/epoch token plus baseline versions per dependency. Reuse the already required
restored-initialization work/registry as owner and lifetime; a WeakMap or equivalent weak identity
side attachment is one possible representation, not a locked container API. No callback/payload/
wave history or duplicate cache is stored. Existing per-node initialization cause and optional
reattach action still express scheduling; do not introduce parallel changed/needsRefresh/alreadySeen/
resourceStarted booleans in ordinary nodes, per-dep records, public status and dispatcher.

A plain touched-node Set is insufficient for RAW compatibility: a RESOLVED-only upstream change
retains its cache but is not DATA; refreshing a downstream accumulator with cached DATA would
invent an occurrence. Proposed summary distinguishes no entry versus DATA advancement, INVALIDATE,
RESOLVED-only, or control-state advancement. Illustrative tags, not final public enums:
data / invalidated / resolved / control. Latest payload/absence, dirty/pending and terminal remain
read from existing state. A summary is not replay of the missed source waves and must not be emitted
as a synthetic source wave to existing subscribers.

Proposed fixed reducer principles: applied DATA (including equal payloads) sets data; effective
INVALIDATE sets invalidated and supersedes earlier unobserved data; a later DATA supersedes it.
RESOLVED records resolved only when no stronger data/invalidation advancement is retained; it must
not erase a preceding unseen DATA simply because that DATA was followed by a no-change settlement.
DIRTY/terminal/TEARDOWN can establish control advancement without overwriting data/invalidation
evidence; actual current pending/terminal/teardown facts decide readiness/output closure. START
snapshot/cache replay, checkpoint installation, PAUSE/RESUME/PULL requests and unrelated getters do
not fabricate output advancement. Terminal combined with DATA retains that latest-data evidence;
terminal-only with an old retained cache must not turn that cache into a new DATA input. INVALIDATE
no-op while absent does not invent an output event. A fixed transition table and raw input
projections for these cases still require follow-up review before implementation; no claim that
this sketch alone proves every multi-control/lifecycle composition.

Have the fixed runtime message/state-application path record applied output facts BEFORE observer
callbacks at the agreed wave commit boundary; do not instrument user subscription delivery, requests
that are later rejected/rolled back, or per-subscriber copies. Track only while restore initialization
work needs the evidence. This requires a NEW internal fixed recording call/attachment: existing
graph.observe cannot be reused since it activates nodes, and existing topology egress does not
observe value changes. Use existing core/registration ownership for that bounded bookkeeping;
do not add user-replaceable onMessage hooks or a hidden activation subscription. Buffered output is
not recorded as delivered DATA merely on enqueue; its actual committed output and current buffer/
pause facts retain the existing distinction.

At initialization, inspect declared deps using their identities and summaries plus current owner
facts. No entry means unchanged OUTPUT since that restore commit, not proof an upstream compute's
inputs are fresh: initialize upstream through ordinary dependency activation first/when admitted.
A->B->C must not inspect unchanged cached B and declare C current while B still needs input refresh.
Use established initialization/partial/dirty settlement machinery, not a global full-wiring barrier
or transitive dirty propagation across inactive edges on every event. Resource reconstruction itself
does not mark changed unless it actually applies output. Freshness can be discovered during upstream
initialization and its actual output then reaches already-connected downstream through ordinary
waves; no second dispatch solely for reading the summary. Detailed consume point and activation
projection deduplication remain the next qualification, including no-output RESOLVED and paused/
quiet upstream cases. Do not silently consume live wave projections as initialization evidence.

Lifetime: an upstream's own initialization finishing does NOT justify deleting its summary while
other restored consumers still need it. Keep bounded per-node summaries until relevant pending
initialization work has finished/canceled; the simplest global lifetime is this restored graph's
remaining initialization work, after which drop the whole table. Use existing work membership to
derive completion, not another public completed flag/counter. Weak identity storage avoids retaining
released/churned node identities merely as history. An indefinitely cold branch can extend table
lifetime; this is a stated O(live-node identities) space cost, not promised immediate cleanup.

Compared with permanent output tokens/counters: those allow cheap comparisons but affect all node
outputs, need per-consumer baseline references, and still do not identify RESOLVED versus DATA.
Optional NodeVersion is unsuitable for required correctness (false allowed; DATA-only advancement).
The temporary summary also adds runtime recording branches and initialization lookups; it is not
zero cost. Expected bookkeeping is O(1) per applied output, at most one summary per live identity,
and dependency examination during initialization, not a fanout traversal on every inactive emission.
No benchmark claim or representation choice is verified here.

Checkpoint interaction: a new checkpoint must not discard known-but-unrepresented refresh work
and later claim complete recovery. Reuse the already accepted admissibility boundary: if the current
format cannot represent an outstanding changed-input initialization obligation, report unsupported
capture rather than activate nodes, wait in dispatcher or silently erase it. Do not blanket-reject
every unchanged restored/cold graph merely because initialization markers exist. Exact eligibility
and whether to serialize additional supported initialization state are follow-up scope, not a new
serialization schema approved in this turn.

**Work/evidence.** Read runtime-accessors exact live registration/graph attachment, core value/wave/
lifecycle state ownership, graph registration/observe, restore commit/install, output applied DATA/
RESOLVED/INVALIDATE/terminal and buffering paths, and nodeEmitToSubs call sites. These confirm the
optional graph/node core can host internal initialization facts but no passive all-output recorder
exists today. Existing baseline input-change probe exit0/DONE5 remains evidence of the current
omission, not this candidate summary/reducer. No new diagnostic or runtime prototype/tests this
turn: proposed reducer/projection semantics remain under user review. Existing session note only;
no runtime/Rules/formal/conformance/jsonl/owner-ledger/D#/commit/push edits. Client date2026-10-26.

### QA-22 summary-table purpose/necessity/cost challenge (2026-10-26; clarification)

User asks what the proposed table is for, who uses it, its size, whether it is necessary and its
maintainability. This is a request for justification, NOT acceptance or rejection of the candidate.

**Rules.** The user-selected observable boundary requires distinguishing unchanged restored input
from post-commit equal DATA even when NodeVersion is disabled. Some occurrence evidence is therefore
required somewhere: A1->no event and A1->DATA1 can end with identical cache/settled/first-run facts,
yet the selected initialization behavior differs. That lower bound does NOT prove a graph-owned
table, a permanent counter, five tags or any particular record layout necessary. Current cache,
pending/terminal/absence remain canonical and should not be mirrored into new records. No change
to live occurrence semantics or private-state ownership is inferred from a mechanism discussion.

**Decisions — explain and qualify, not lock.** Intended consumer is runtime's restored initialization
decision, not user fn, inspection, dispatcher scheduling policy or application event history. It
would remember bounded post-restore output advancement so a late restored attachment can decide
which old baseline is still usable; output application would be the sole evidence writer. Sparse
logical size is O(K) tracked changed-node identities, with K potentially near the graph's node count,
not O(number of messages). Actual host WeakMap/map/reference overhead is unmeasured; do not claim
byte counts, immediate GC or a hard physical live-node bound under delayed GC/container growth.
Indefinitely cold nodes can keep the recovery recording window open for a long time, so temporary
means bounded by initialization need, not necessarily short-lived.

The map operations are not the maintainability concern. Summary reduction, raw DATA/RESOLVED/
INVALIDATE projection, chain/diamond initialization, controls/pause/PULL, rewire/release and a new
checkpoint during pending refresh are material obligations. A table does not make those semantics
settled. Reclassify the previous concrete five-way summary as a candidate requiring a demonstrated
advantage over smaller evidence, not a required foundational subsystem. Do not implement it or add
public flags. First isolate information that cannot be derived from existing owner state, then
compare its placement/lifetime; avoid deciding an enum and later expanding it for every edge case.
This qualification preserves the agreed refresh behavior while making its implementation cost
an explicit design gate. No alternative representation or simpler changed-only projection is
silently selected by this clarification.

**Work/evidence.** Re-read last proposed note and actual DATA/RESOLVED state application in
node-output-runtime.ts: DATA replaces cache/hasData/status with settled and advances only optional
version, RESOLVED retains cache and sets resolved/sentinel. Existing baseline five-case probe remains
the current-runtime evidence; no new prototype/test or memory benchmark. Only existing session
note edited; no runtime, authority/jsonl/spec/formal/conformance/D#/commit/push changes. Candidate
mechanism remains unaccepted, with necessity of evidence separated from necessity of this table.

### QA-22 node-owned evidence versus optional versioning (2026-10-26; clarification)

User asks to derive change from the node itself where possible, add only necessary missing facts,
and asks whether this is versioning. This steers the design toward node-owned evidence, not approval
of a mandatory counter/schema or the earlier summary table.

**Rules.** Current cache/status cannot distinguish every equal-value event history; version:false
means NodeVersion is absent. Existing version0 has a DATA counter, version1 adds content/previous
hash, and neither is a complete stamp for INVALIDATE/RESOLVED/control progression. A runtime-required
correctness marker cannot be silently conditional on optional NodeVersion. Conversely, calling a
new always-on marker internal does not make its cost or version:false policy change disappear.
The relative question "changed since this checkpoint/baseline" needs a comparison baseline as well
as the node's current evidence; it is not derivable from a current token alone.

**Decisions — clarify candidate approach, not locked.** A small node-owned occurrence/change marker
is the same general idea as a revision/generation, without implying public version/hash/history.
Illustrative counter7->8 on equal DATA1 distinguishes it from no event. Let fixed output processing
own updates, and let existing restored-initialization work retain the comparison baseline only
where needed. Do not mirror current cache/terminal/dirty facts into a separate summary system.
Reuse lower-level evidence for optional public versions where semantics truly match rather than
maintain duplicate drifting counters, but no such unification is selected by this explanation.
Marker scope/lifetime, exact events, permanent versus restore-scoped recording, and minimal fields
remain to be designed. A single monotonic number establishes advancement only; it does not prove
whether unseen progression included DATA rather than RESOLVED or its raw invocation projection.
Do not advertise it as already solving the type/initialization-chain problem or infer a new flag
for every message. Keep the five-class table an unaccepted alternative.

**Work.** Re-read Node.version getter and versioning.ts policies/types/advanceNodeVersion, confirming
false disables the stored version and enabled counters increment in the DATA application path.
Existing note only; no new probe/test/runtime or normative/ledger edits, commits or pushes. The
user has steered the information-ownership question; no particular marker implementation approved.

### QA-22 node-owned direction accepted; derived facts and two-position candidate (2026-10-26)

**Rules — acceptance and scope.** User accepts node-owned minimal evidence as direction and asks
for a per-case inventory plus minimal proposal. This is not approval of a counter layout or runtime
change. Keep inactive latest-visible-baseline catch-up distinct from actual live wave preservation;
no exact event-history recovery is promised. Current ValueState.hasData/cache, dirty/pending, terminal,
control locks and lifecycle/rewire permissions retain their owners. R-restore@1 remains unactivated;
the accepted review directions still require normative reconciliation before implementation.

**Decisions — proposed inventory.** Current payload/absence needs no new history: cache+hasData.
Current readiness needs no second paused/pending flag: use output freshness and existing dependency
dirty/pending plus locks/owed demand. Current terminal kind/payload needs no new ERROR/COMPLETE
flag: use existing terminal. First-computation gate and fn/ctx/lifecycle identity remain distinct
existing/selected facts, not inferred from cache. TEARDOWN/reset/release must follow their lifecycle
and ownership semantics; do not silently translate them into an INVALIDATE or an ordinary DATA.

Missing evidence: equal DATA cannot be inferred from final cache/status; RESOLVED may leave the
same already-resolved/sentinel state; and final state alone does not reveal an effective INVALIDATE
followed by RESOLVED versus an already-absent RESOLVED-only baseline. A single total output count
also fails: from cache1, DATA1->RESOLVED and RESOLVED->RESOLVED produce the same value/settled state
and two applied settlements, but one contains DATA and the other does not. Terminal/current DIRTY
can obscure the previous settlement class, so relying on the current status enum alone fails too.

Proposed minimal candidate for this information problem is TWO node-owned integer positions:
progress, advanced for every actually applied DATA/RESOLVED/effective INVALIDATE/COMPLETE/ERROR;
valueAt, set to the new progress only for DATA (including equal payload) or effective INVALIDATE.
valueAt is an occurrence position, NOT payload inequality and NOT a DATA occurrence counter.
No-op INVALIDATE or rejected/rolled-back work does not advance it. DIRTY readiness remains current
state, not a new settlement; START/replay installation and PAUSE/RESUME/PULL requests do not
advance these positions. Control-induced cache clearing/reset is NOT included automatically in
this DATA/INVALIDATE classification; lifecycle/baseline admission must be checked separately.

Reader compares progress/valueAt to its restored-input baseline position b:
- progress==b: no applied settlement advancement in this evidence domain.
- valueAt>b and current hasData: latest unobserved value operation was DATA; current cache supplies
  its value, even if RESOLVED/terminal/DIRTY arrived afterward.
- valueAt>b and current !hasData: latest such value operation was INVALIDATE, within the stated
  same-output-lifetime domain; later RESOLVED must not erase that information.
- progress>b but valueAt<=b: no new DATA/INVALIDATE value operation; consult existing terminal/
  readiness to distinguish terminal handling, waiting, or a no-value settlement. A retained cache
  must not become fabricated DATA simply because it is available.
This is information classification, NOT permission to run fn or an already-approved raw projection
algorithm. DIRTY/pause/quiet/terminal/first-input/initialization gates still decide dispatch. A new
live event delivered during attachment must not be consumed once from normal waveData and again
from these positions. A->B->C still initializes upstream as admitted and propagates actual output;
no counter reading causes fn calls, repairs upstream in a getter, or bypasses partial:true semantics.

Illustrative order: DATA1->RESOLVED records progress2/valueAt1/hasData=true; RESOLVED->RESOLVED records
progress2/valueAt0/hasData=true. DATA1->INVALIDATE->RESOLVED ends progress3/valueAt2/hasData=false,
so no payload history or five-class enum is needed to recover that latest value-operation kind.
These examples use a zero fresh restore baseline for readability; this isn't a serialized revision
format. Do not claim information-theoretic minimality across arbitrary resets, lossless history,
multiple snapshot baselines or all lifecycle transitions based on these examples.

Storage/ownership candidate: optional evidence attached to node runtime value/output ownership,
only on restored nodes during the needed initialization window; existing restored-initialization
work owns the comparison baseline(s), not a second event table. A shared commit can start positions
at0 when there are no retained readers of an earlier evidence domain. Presence of the evidence
record expresses enabledness: no separate enabled/changed/needsRefresh booleans. Output application
updates it before observer reentrancy at the accepted commit boundary, not once per subscriber,
attempted emission or buffer enqueue. Cache/status/terminal aren't duplicated. NodeVersion0/1 keeps
its existing DATA-count/hash meaning; neither field should be mislabeled the existing counter.
version:false remains supported; these are separate proposed correctness facts with real runtime
cost, not secretly turning public versioning on.

Do not clear/reset positions merely when the upstream's own initial attachment finishes if later
restored consumers still need to compare them. Existing pending initialization work determines when
the evidence domain can retire; clearing it before then gives false unchanged results. Ordinary
fn replacement/close/output reset/release must invalidate or reestablish relevant old baselines
through their explicit transition paths, never numerically compare unrelated lifetimes or pretend
this bounded two-number model has already defined that behavior. Exact cross-lifecycle baseline
ownership remains a required qualification, including downstream restored readers not yet attached;
do not conflate new ctx-resource activation after restore with a logical output reset.

Costs: two integer positions per tracked node plus existing initialization baseline references,
O(1) applied-event bookkeeping, and no payload/event-history allocation or graph-wide per-emission
fanout. Optional record/container/branch overhead is unmeasured, not literally two machine words
in JS. Retiring evidence uses the existing initialization lifetime and can be delayed by cold
consumers. A new checkpoint must still respect previously selected unsupported-state admissibility
if it cannot represent pending catch-up; don't silently drop the evidence, serialize new fields
without design, or promise all snapshot support by adding two counters.

**Work — bounded information evidence, not candidate runtime correctness.** Re-read core.ts owner
facts, node-input-runtime and node-output-runtime DATA/RESOLVED/INVALIDATE/terminal, current lifecycle
reset/activation and restored dep seed behavior. Added diagnostic
protocol-reconciliation-probes/node-change-evidence-model.ts. It models one output lifetime with
current DIRTY readiness, terminal sealing, and no-op absent INVALIDATE, then compares the two-number
summary to an independent retained full effective-history reference for latest DATA/INVALIDATE kind
and existence of settlement advancement. Run from TS7a26 via node_modules/.bin/tsx <absolute path>:
exit0,DONE39216 histories (both initial value-present/absent, seven events, length0..5). Includes
explicit indistinguishable one-total-counter DATA1/R versus R/R counterexample. It does NOT test
GraphReFly fn invocation, wave framing, lifecycle reset/rewire, PAUSE buffers, PULL, checkpoint
recapture or live/initial double processing. No runtime code/prototype or broad test rerun.
Only existing note and diagnostic model changed; no normative Rules/formal/conformance/jsonl,
owner ledger/D#/commit/push changes. Two-position design remains a proposal for user review.

### QA-22 unified version ownership and revised optional policy (2026-10-29; proposed)

User observes progress/value evidence are different kinds of version information and asks whether
they should live under version, allowing the switch contract to change. Treat as a design proposal,
not yet approval of a concrete public shape, mandatory always-on counters or removal of DATA count.

**Rules/history.** Existing graphrefly:D109 is relocated root-origin history in the TS owner ledger,
NOT found in the current root body; it selected core-held optional node runtime versions, DATA-only
V0 counter and V1 hash chain. graphrefly:D112 root refines canonical-byte hashing. Current TS
VersionState={policy,value} and node.version getter expose optional V0/V1, with version:false
disabling value. Existing selected recovery correctness cannot depend on that optional switch.
No compatibility constraint prevents reviewing D109, but changing its counter/policy meanings must
be explicit, not falsely described as already equivalent to the candidate output revision.

**Decisions — recommended ownership consolidation, not locked.** Agree conceptually with grouping
the node-owned change positions under one version/revision responsibility, reusing VersionState/
versioning module instead of maintaining a separate unrelated changes subsystem in ValueState.
One output update path owns advancement. Distinct semantic fields may coexist in that owner:
settlement progress, latest DATA/effective-INVALIDATE position, optional DATA occurrence count,
and optional content hashing; do not conflate them because all are numbers or called versions.
Do not silently turn old DATA counter into all-settlement progress, remove it without consumer
assessment, or maintain both as supposed aliases. Public field grouping/names and serialization
are a later concrete proposal, not a schema selected by this turn.

Recommend revising option semantics around necessity/cost: runtime-required base revision evidence
cannot be user-disabled while a recovery reader needs it; hashing/content-chain and optional
exposure/additional metadata remain optional. Base evidence can still be enabled/retired according
to actual initialization need; this does not require two permanent counters on every normal node.
Whether public node.version includes internal evidence, whether to rename/remove the misleading
all-off versioning:false surface, and exact sharing of DATA count/hash maintenance remain OPEN.
Do not use an internal/public distinction to hide the cost of mandatory base bookkeeping or claim
existing false behavior remains unchanged. No new parallel enabled/changed flags are implied.

This revises the previous insistence on a separate progress mechanism based merely on today's
versioning opt-out: the switch is a revisable design, while correctness is not optional. It does
NOT solve outstanding input-baseline, raw projection, lifecycle and recapture cases; existing
39216-history model supports only the bounded information claim, not this ownership/API policy.

**Work/evidence.** Re-read node/versioning.ts V0/V1 types/policy/advancement, node.version getter,
checkpoint version fields and restore installation. Read exact relocated graphrefly:D109 and root
D112 after the first root-only lookup returned no D109 body. Bounded production search found a
DATA-counter use in node-checkpoint-runtime's V1 absence guard; no exhaustive consumer audit or
claim that removal/renaming is safe. Existing note only; no code/types, normative Rules/formal/
conformance/jsonl/owner-ledger/D#/commit/push changes or new tests. Client date2026-10-29.

### QA-22 unified version owner accepted; concrete fields/options/checkpoint proposal (2026-10-29)

**Rules — acceptance and authorization.** User explicitly agrees to unified version ownership and
asks to design fields/switches, assess retaining DATA counter and define checkpoint persistence.
Ownership consolidation is accepted in review. The exact fields/options/counter removal/lifetime/
capture restrictions below are PROPOSALS, not approved implementation or normative changes. Existing
accepted logical cache/private-state preservation and unsupported checkpoint admissibility remain
constraints; root-origin graphrefly:D109 in the TS relocated ledger fixes the old DATA-only optional
V0/V1 contract, and root graphrefly:D112 fixes canonical-byte DATA hashing. Revising the old contract
is legitimate in this pre-1.0 review, but must be explicit in the later owner/spec workflow.

**Decisions — recommended concrete shape, not locked.** Prefer one readonly NodeVersion projection:

    { progress: number, valueEventAt: number,
      hash?: { cid: string, prev: string | null } }

Base progress/valueEventAt retain the candidate applied-settlement/latest-DATA-or-effective-INVALIDATE
position meanings and guards described above, with 0<=valueEventAt<=progress, nonnegative safe
integers in TS, and no silent wrapping. START, initialization/replay, restore installation and
control requests do not count as newly applied settlements. New node starts0/0, successful restore
installs saved positions unchanged, and resource reattach does not reset or advance them unless
actual output is applied. Do not reset visible version numbers on ordinary unsubscribe/resubscribe
or retire them merely because a bootstrap reader finished; unrelated execution/reset baselines
still require explicit invalidation, not numerical comparison across an obsolete definition.

Recommend ALWAYS maintaining the two base positions under this unified public version meaning,
instead of the earlier restore-scoped allocation/retirement candidate. This is an explicit new
tradeoff proposal: two fixed node scalars and constant applied-output updates even without recovery
readers, in exchange for no enable/retire reader bookkeeping, no public revisions disappearing or
starting over after bootstrap, and simpler checkpoint continuity. Presence-based restore-scoped
recording was an alternative, not already user locked. Do not present always-on as zero cost or
as the user's approval merely to put fields under version. Internal owner can hold mutable scalar
facts and produce a readonly snapshot on inspection; no need for another cached version view or
new enabled/changed flags. No benchmark/memory-size claim is made.

Options proposal: keep graph default/per-node override of versioning, but reduce policy to
versioning:{hash?:false|true|NodeVersionHashFn}, default hash:false. true selects the existing default
hash implementation; custom function keeps canonical DATA bytes input. No versioning:false global
off, no numeric0/1 levels or legacy compatibility overloads. Hash-off disables canonicalization/
hash chain costs, not base correctness. Public Node.version has a single required shape, with
optional hash metadata. hash keeps the current DATA-content CID/previous-CID behavior: equal DATA
still advances base positions even if CID is identical; RESOLVED/INVALIDATE/terminal do not hash
old cache as new DATA. This proposal does not turn optional hash into a tamper-proof audit log,
hash the whole protocol wave, or invent a new hash-history capability.

Recommend DROP the old default DATA-only counter, not alias it to progress/valueEventAt and not
keep a third count automatically. DATA counts cannot be reconstructed from the new positions
(INVALIDATE participates in valueEventAt; intervening settlements affect positions), so this
deliberately removes that metadata capability, not claims equivalence. Examined production TS
uses are version creation/advance/validation/readonly describe/checkpoint/export plus the V1 absence
guard; no discovered business scheduling/dedup algorithm depends on exact DATA count. This is a
bounded TS source finding, not a claim about unexamined external users, all sibling runtimes or
future count use cases. Explicit opt-in application/diagnostic DATA counting remains possible.

Existing V1 counter>0 versus prev!=null constraints are coupled: under generated hash metadata,
initial prev=null and each DATA replaces it with the previous CID. Thus current "hashed DATA existed
but current value absent" rejection need not force preserving a numeric DATA count; an explicit
hash/current-value admissibility check can preserve honest failure. Do not validate a retained last-
DATA CID against absent/current cache as if it hashed INVALIDATE. Existing limitation stays explicit:
hash metadata whose matching DATA is unavailable cannot be claimed verified/restorable. New JSON
validation no longer checks counter0/prev-null relation through a deleted field; validate new
invariants and hash/current-value consistency. This is a proposed rewrite, not tested code.

Checkpoint proposal for an ADMISSIBLE consistent boundary: save required base positions and optional
hash metadata exactly, alongside already-selected topology/factory refs, intrinsic state/cache
distinction, absence/freshness/terminal, represented private state and first-run history. Absence of
hash metadata expresses hash-off; no separate hashEnabled flag and no function/handle/socket/cleanup
serialization. Hash strategy functions must still be supplied explicitly by trusted restore options/
factory configuration as needed, as current custom hashing is not portable closure serialization.
Validate hash before installing cache/version or exposing restored graph. The checkpoint envelope's
format identifier is separate from runtime node version; later schema amendment must update it
honestly and reject unsupported old shape instead of keeping compatibility aliases in pre-1.0.

Restore creates per-input comparison baselines from saved upstream progress AT THE RESTORE COMMIT,
not from a later first subscription (which would miss pre-subscription writes). Keep those baselines
with existing restoration/initialization work, not new permanently serialized per-edge history in
the first minimal format. This works only if capture doesn't discard known pending refresh or
unrepresented execution work: progress values alone don't establish that downstream cache has
consumed upstream events. E.g. A advanced, D still owes restored initialization; saving only current
node positions and rebasing D at restore would erase the obligation. Reuse accepted admissibility:
reject capture as recoverable while such unsupported work is pending, without automatic activation,
dispatcher wait or claiming all cold restored graphs are invalid. Unchanged cold graphs without
owed refresh can remain admissible. If later supporting checkpoint during pending catch-up, explicit
input baseline/initialization state needs a separately designed representation. Do not silently save
the numbers, drop owed work, and label that a full checkpoint. Transitive dependency/lifecycle reset
qualification and raw projection/initial-live handoff remain QA-22 work, not solved by this schema.

**Work/evidence and scope.** Read actual NodeVersion types/policy/defaults, core VersionState,
describe/checkpoint/read accessors, prepareRuntime, _checkpointNode and restore hash guard. Re-ran
bounded TS source symbol/counter searches: relevant NodeVersion references confined to versioning/
node core and API, graph options/describe/checkpoint/restore and barrels; exact counter-dependent
runtime predicate outside the version module is the hash/absence guard. Legacy restore tests assert
DATA counts/levels and disabled .version; these are expected contract migration surfaces, not proof
the new proposal is backward compatible or already passes. A broad packages search accidentally
included enormous qualification embedded-source snapshots and was truncated; corrected to real
packages/ts/src *.ts excluding tests/bench. No wider-consumer absence conclusion is drawn from the
truncated search. _checkpointNode already rejects dirty/pending statuses; accepted richer runtime-
known obligation checks are not implemented by that simple current status gate.

Existing two-position model exit0/DONE39216 remains bounded same-lifetime information evidence only.
No new test/prototype/runtime/API/schema change this turn; source inspection cannot prove the future
checkpoint/policy implementation. Only existing review note edited; no normative Rules/formal/
conformance/jsonl/owner-ledger/D#/commit/push changes. Concrete proposal awaits user review.

### QA-22 revision/valueRevision names accepted; baseline establish/handoff/invalidate review (2026-10-29)

**Rules — naming acceptance and review scope.** User explicitly selects revision/valueRevision
names for progress/valueEventAt and asks to review baseline establishment, consumption and invalidation
against other rules. Record the names and meanings as the selected review vocabulary; do not infer
approval of every unrelated always-on/hash/counter-removal/checkpoint-policy detail merely from this
naming acceptance. Existing accepted same-value occurrence/inactive latest-baseline boundary,
QA-14 occurrence-preserving paused input, whole-array membership/initial START roles, QA-4 intrinsic
state versus cache and rewire connection identity constrain the review. The version scheme remains
unimplemented, and R-restore@1 lacks activation metadata.

**Decisions — proposed baseline protocol, not yet selected.**

Establish each restored declared dependency's comparison basis at the successful graph restore
commit from that upstream's saved revision, associated with the exact declared connection/source
identity and this recovery's admissible logical result. Never initialize it from a version read at
the later first subscription. Runtime initialization owns writes/retirement; output logic owns
node revisions; no fn/inspection/version getter mutates baselines. Only admissible checkpoint states
can use upstream checkpoint revisions as an already-processed logical basis; known unrepresented
pending catch-up must still reject capture rather than be silently normalized away on restore.

At actual dependency acquisition/initialization, select a snapshot boundary q: retained cache/
absence, freshness/terminal and revision/valueRevision must be read together before callbacks can
queue more work. Preserve accepted ownership-before-initial-delivery and whole-wave candidate
membership semantics. Compare old basis b with that snapshot at q exactly once to seed unchanged
input or hand off latest missing initialization input, subject to raw DATA/RESOLVED/INVALIDATE roles.
No post-activation unconditional reseed/diff against whatever upstream revision is current later.
Example b8, initial snapshot DATA20 atq9, callback queues live DATA30 at10: hand off20 once, then
the normal live wave30 once. Reading10 when acknowledging snapshot9 either skips30 or produces
a second catch-up for the same live30. Bind evidence to the selected snapshot, not a future getter.

Define "consumed" here as successfully HANDED OFF to the existing normal input bookkeeping, not
necessarily evaluated by user fn. After the snapshot/projection is accepted into existing pending
buffers (or unchanged input is validly seeded), that part of baseline work can retire/advance to q.
If admission/initialization is rejected or canceled before handoff, do not falsely acknowledge it.
PAUSE, first-value pending and quiet PULL can still hold invocation: normal pending projections/
control facts retain the work, and checkpoint eligibility must not treat a completed handoff as
completed evaluation. No second lastFnProcessedRevision counter, async-job tracker or public flag
is proposed. Explicit INVALIDATE may supersede buffered inputs under accepted QA-14; intentional
cancellation does not roll the coverage boundary backward and resurrect discarded inputs.

All live arrays acquired AFTER the snapshot boundary follow ordinary occurrence-preserving
input processing, including equal DATA; do not use revisions to replace or coalesce them. DIRTY
does not advance revision in the prior candidate and MUST NOT be dropped merely because its numeric
revision equals b. TEARDOWN/control routing also does not become a generic revision dedup filter.
Whole-wave membership should keep the source snapshot and subsequent live delivery disjoint;
existing wave identity/readiness metadata and initial record are the intended seam. Current TS
DeliveryMeta has only wave/last, so a coherent snapshot/version capture is work still to implement,
not an assertion that the present message-at-a-time code already has such an atomic snapshot.
No new public wire field/message is selected. Terminal/failure/close after setup cancels admission
of later normal demand work under the previously accepted boundary; it is not proof all inputs
were user-evaluated. Runtime's resource attachment alone neither consumes input nor resets basis.

Baseline identity on rewire: keep numeric input coverage with surviving declared connections when
reordering; remove it when its edge is removed; re-add is a new connection with ordinary initial
delivery, never inherit an old connection's basis by node name or index. Fn replacement invalidates
the OLD restored-computation exemption and pending old reattach under selected ownership, but does
not authorize clearing kept edge pending DATA, rearming first-value history or forcing a restart.
Distinguish that restoration trust from surviving edge bookkeeping. Source ordinary close/reset,
terminal fresh reset and permanent release require explicit handling of affected baseline scope;
retired ctx may not acknowledge a fresh lifecycle's work. A restored resource ctx being new does
not itself mean the checkpoint logical output history reset. Exact cross-lifetime input-view
qualification remains work; do not claim a phase or numeric counter alone proves identity.

**Material reconciliation gap — silent state snapshot rebasing.** Accepted QA-4/3 says an applied
plain-state value survives old output pause buffer; ordinary nonterminal last-off rebases retained
cache from intrinsic state WITHOUT a live DATA occurrence. Candidate revision/valueRevision only
advance on DATA/RESOLVED/effective INVALIDATE/terminal. Trace: restored source S cache20, consumer D
cache21 and baseline S:r8; another owner keeps S active with resumeAll, applied set30 is buffered,
last owner leaves, buffer discarded and S retained cache silently becomes30. No recorded settlement
means S stillr8. Later first restored D attach compares r8==b8 and incorrectly treats its old21 as
unchanged instead of recognizing the new source snapshot30. The two-position information model
explicitly excluded lifecycle/rebase and does not validate this trace.

Proposed repair: version revision represents committed RESULT/RETAINED-SNAPSHOT updates, not merely
counting visible protocol settlements. A genuine adoption of a newer accepted intrinsic assignment
into retained cache advances revision/valueRevision even when publication is a later initial
snapshot; no live DATA/DIRTY is manufactured on last-off. valueRevision means latest retained-value
write/clear corresponding to a committed result/snapshot, including equal DATA and such a material
rebase. Do not bump it just for copying unchanged state during housekeeping, initial START/replay,
or resource attachment without newer input: determine a real outstanding accepted assignment from
existing stable-state/buffer/commit ownership, not payload equality. This keeps two fields but
revises their previously DATA/INVALIDATE-only update boundary, so needs explicit user review.

If hash is promised to describe the retained value, silent rebase must update it consistently with
that value (same canonical-byte contract) or explicitly remain historical last-DATA metadata; do
not leave a supposedly current CID for20 beside cache30. Prefer consistency with the new retained
snapshot, explicitly revisiting old DATA-only advancement rather than hiding the semantic change.
Terminal output remains sealed: no last-off rebase/version update that bypasses it. Raw projection
must still distinguish snapshot refresh from a new source occurrence. Lifecycle-reset/TEARDOWN
cache clearing and pending-input identity need the same qualification; do not casually label every
internal clear INVALIDATE or assume two scalar fields eliminate transition semantics. No third
epoch/dirty flag or independent change table is proposed as an automatic repair.

**Work/evidence.** Read existing restored activation/dep seed and source activePull/output guards,
rewire kept-record carry, ctx construction and nodeRunWave clear paths. Cross-checked accepted
QA-14 paused per-dep occurrence accumulation (case20,21,30 runs once with all values), QA-16 owned
initialization/activation ordering, START snapshot origin and whole-wave subscriber membership,
and accepted QA-4 intrinsic/cache/last-off rebasing. Current direct seed clears dirty and ignores
initial push; no new version fields or atomic cut metadata are implemented. Existing diagnostic
39216-history model proves same-output-lifetime evidence classification only, not these interactions.
No new runtime/prototype/test this turn; these are concrete review traces and a surfaced conflict,
not candidate implementation verification. Existing session note only; no normative Rules/formal/
conformance/jsonl/owner ledger/D#/commit/push changes. Stop on this material update-boundary choice
before declaring baseline protocol fully consistent or moving to another QA item.

### QA-22 silent snapshot versioning accepted; lifecycle-bound baselines and checkpoint counterexample (2026-10-29)

**Rules — accepted supplement and governing distinctions.** User explicitly accepts advancing
versions for silent retained-snapshot updates without manufacturing live DATA, and asks to review
lifecycle reset/baseline invalidation. Record that supplement as accepted in review. Do not infer
implementation authorization or every related hash-policy detail approved. Keep agreed ctx-life
authority, stable declared connection identity, ordinary nonterminal ROM/RAM behavior, preserved
terminal snapshots and current-execution-only subscription/retain semantics distinct. Existing
R-restore@1 lacks activation metadata; accepted directions still require normative reconciliation.

**Decisions — recommended lifecycle matrix, pending user review.**
- New resource ctx/reattach after checkpoint restore does not itself reset logical output or the
  restored comparison basis. Installation of checkpoint versions and recreated resources alone
  does not bump revision or rearm first-value history. Do not equate new ctx identity with a new
  logical input generation.
- Consumer ordinary actual close cancels its owned initialization/baselines and unconsumed inputs;
  a later genuine fresh consumer activation uses normal first-run/private-state policy. Persisting
  user ctx.state does not preserve runtime input authority, pending PULL or old baselines. Declared
  connections can remain while leases and consumer-owned transient work end.
- Plain state ordinary close preserves intrinsic value/snapshot authority; do not invalidate all
  consumers' baselines merely because a resource/subscription life ended. A material newer intrinsic
  assignment adopted into retained cache advances versions under the now-accepted silent rule.
- Open compute ordinary deactivation clears RAM output under the selected policy; old recovery
  computation trust cannot be carried into a fresh run. A subsequent acquisition follows normal
  initialization/admission; clearing internal RAM is NOT a fabricated protocol INVALIDATE and
  must not silently execute onInvalidate on downstream as if that message was delivered.
- Upstream terminal seals that execution and its delivered final input; automatic resource close
  revokes ctx/leases but does not retract arrays or terminal/value facts the downstream already
  received. Do not cancel downstream-owned queued work merely because the upstream owner closes;
  downstream's own terminal/close policy still decides its fate.
- Eligible terminal fresh reset creates a new execution. A downstream that already received the old
  final input retains that old contribution; it does NOT automatically subscribe/rebind to the new
  upstream run through the same node object. Numeric monotonic revision alone is not authority to
  cross this boundary. Clearing terminal seal/committing a new retained snapshot advances revision
  as appropriate under the proposed committed-result meaning; only an actual retained-value
  write/clear advances valueRevision. No live DATA is manufactured by reset itself.
- Explicit edge removal/re-addition and permanent release retire old scope/identity as already
  selected; reorder keeps connection bookkeeping. Use exact registration/connection and selected
  lifecycle identity checks, not user-visible node names or a second public epoch counter. A stable
  NodeRegistration is node identity, not proof of unchanged execution. Current TS activated boolean
  is not that already-selected lifecycle fencing implementation.

Baseline validity must therefore test ownership/input scope before comparing b with revision. A
baseline for an already-ended received dependency is not the same object as an outstanding
bootstrap request for a new dependency acquisition; successful cleanup does not erase the former.
Reuse existing dependency retained-value/terminal bookkeeping and selected acquisition/lifecycle
identity; do not add another changed/freshRun/finalInput flag or restart dispatcher tracker merely
to restate their facts. A first-time acquisition of an already-terminal source still follows the
selected ordinary QA-11 admission rules; it cannot be treated as if a terminal input had already
been received. Exact restore representation of those received-input facts must be explicit.

**Material checkpoint gap — upstream current snapshot can belong to a different run.** The prior
minimal proposal "derive restored input bases from current upstream checkpoint revisions at commit"
needs a prerequisite stronger than status-quiescence. Trace: A(resubscribable state1) and B(state2)
feed D=sum. D receives A1 and A COMPLETE while B stays open; it retains A1/terminal in DepRecord.
Another subscriber restarts A and sets10; D's old terminated dependency does not follow the new
run. Snapshot now contains current A10 and D3. Original B.set3 yields D4 using the ended A1.
Current restore only saves node snapshots, then seeds D's dep from current A10 with no old terminal
record; restored B.set3 yields D13. revision/valueRevision numbers alone do not recover A1/old
terminal/input scope from current A10. Nor can D.cache/private state generally reconstruct its
raw inputs for arbitrary fn.

Proposed minimal response: keep correct live lifetime/input isolation, and use the already accepted
unsupported-checkpoint gate. Do not capture this known incompatible old-input/current-upstream state
as a recoverable checkpoint with the present per-node representation. Do not fix it by rewiring D
to A's new run, forcing restart, faking INVALIDATE, or adding a numeric node epoch that still lacks
the old received value/terminal. Supporting such captures later needs an explicit representation
of affected dependency input scope/final retained view (or a source-history reference that resolves
it), not necessarily a full event log. Current aligned terminal inputs and never-acquired terminal
sources also require qualification; no blanket assertion all terminal dependencies are supported
or all cold/terminal graphs should reject. The exact minimal predicate/encoding must be designed
without guessing receipt solely from hasCalledFnOnce/activated or current terminal equality.
No per-edge serialization schema or broad new runtime state is selected by this recommendation.

**Work — actual runtime roundtrip evidence, not candidate verification.** Added diagnostic
protocol-reconciliation-probes/restore-ended-dependency-after-upstream-restart.ts using real Graph,
state/resubscribe, depLatest, custom registered sum/restore descriptors and default state restore.
No external resource, timer or network. Runs from unchanged TS7a26 via node_modules/.bin/tsx
<absolute path>: exit0,DONE1 counterexample. Before capture A.cache10 while original D.dep.prev[A]=1
and D.dep.terminal[A]=true. Original values [3,4]; restored values [3,13] after same B update2->3.
Restored D.dep.prev[A]=10, terminal undefined. All three acquired subscriptions released. This
proves current node-only restore loses that received dependency state; it does NOT test new
versions, automatic retirement/fencing implementation, capture-rejection guard or a new codec.
Read current deactivate/reset, registration identity and restore prepare/seed; checked accepted
terminal current-execution retention and historical checkpoint/nonfresh distinction. Prior
39216-history model excluded these lifecycle/serialization cases and is not evidence against this
gap. Existing session note and diagnostic only; no runtime, normative Rules/formal/conformance,
jsonl/owner-ledger/D#/commit/push changes. Stop on this capture-scope recommendation before claiming
lifecycle baseline design complete or advancing to another QA item.

### QA-22 unrepresentable ended-input checkpoint rejection accepted; minimal receipt evidence proposal (2026-10-29)

**Rules — accepted review boundary.** User replies agreement to the preceding lifecycle matrix
and unsupported-checkpoint recommendation. Record acceptance in this review: preserve the correct
live ended-dependency contribution; reject a recoverable capture when the represented per-node
snapshots cannot reconstruct that held input. Do not silently rebind the consumer, rerun it, or
fabricate INVALIDATE. Restore resource reattachment alone does not invalidate logical baselines;
consumer actual close retires its own transient baselines; source terminal close does not retract
already-delivered final input. This is design acceptance, not an activated rule or implementation.

**Decisions — next minimal evidence proposal, NOT yet selected.** Current DepBookkeeping has
received value/absence and terminal facts, but no terminal receipt revision. Payload equality or
current upstream terminal status alone cannot prove that a received final input belongs to the
current source execution: the source can restart and terminate again with the same payload.
Propose retaining the upstream committed revision accompanying the actually received terminal,
inside that existing dependency record. If a general adopted-input revision is retained for the
baseline handoff design, reuse it rather than add an independent terminal counter/flag; freeze it
once this dependency ends. Capture the revision with the delivered source result, not by reading
the current node after callbacks have caused newer work. Initial terminal receipt follows the
same coherent snapshot cut; never infer receipt for an unacquired declared edge.

Proposed qualification for this specific gap: when a consumer can still run and retains an ended
dependency, a node-only checkpoint may derive that final input from the source snapshot only if
the exact source/connection scope is valid, the source is still terminal, and its current revision
matches that terminal receipt revision. A mismatch or absent necessary evidence rejects capture
under the accepted unsupported-state gate. A source fresh reset must advance revision even if it
preserves the same state value; otherwise equal-payload restart/terminate cannot be distinguished.
No new public epoch, event history, or per-edge serialized payload is proposed for this narrow gate.
Receipt evidence belongs to consumer dependency bookkeeping; output logic owns source revision;
checkpoint only reads/validates. Reorder retains the record; actual consumer close/removal discards
it. A new cold edge has no received final input to validate; a terminal consumer whose contract no
longer needs its old runtime inputs is not rejected solely for having declared dependencies.

Tradeoff: one retained source position per relevant dependency (or reuse the same coverage
position), bounded O(edges); cannot be derived from final payload/status alone. It is not another
independently incremented counter. Same execution/final receipt can qualify; restarted source,
including same-valued retermination, cannot with this minimal format. Other checkpoint obligations
(pending inputs, quiet PULL, pause locks, bootstrap still owed, cold terminal acquisition and
represented private/resource state) keep their own admission checks. This is a necessary narrow
test, not a claim of a complete checkpoint eligibility algorithm or proof every aligned terminal
initialization is already supported.

**Work/evidence.** Inspected current DepBookkeeping, terminal receive path, lifecycle reset and
Graph._checkpointNode. Current checkpoint serializes node snapshots only; no terminal receipt
revision or new capture guard exists. Rechecked graphrefly:D83/D117 and unactivated R-restore@1/
R-rom-ram@1 texts against the accepted review distinctions. Prior real-runtime roundtrip probe is
the evidence for the loss; no new run or candidate implementation validation this turn. Only this
session note changed; TS runtime remains untouched. No normative rules/formal/conformance/jsonl,
owner ledger/D#, commit or push changes. Await user choice on the additional receipt evidence
before treating it as selected storage design.

### QA-22 dependency receipt revision accepted; restore representation still needs a choice (2026-10-29)

**Rules — accepted supplement.** User agrees to reuse the existing dependency record to retain
the received revision, and requests a lifecycle/restore compatibility check before advancing.
Record this runtime evidence ownership as accepted. It is received-input provenance, not proof
that the user fn evaluated that input; existing unconsumed input/checkpoint admission remains
separate. No implementation or normative rule edit is authorized by the design agreement.

**Decisions — compatibility and remaining representation gap.** Retaining the position with the
dependency record fits reorder preservation, connection removal/re-add identity, consumer actual
close, and upstream terminal-resource closure. In particular, upstream cleanup does not erase
the surviving consumer's final received position; ctx reattachment does not advance it; a fresh
source execution does not rewrite it; persistent private state does not resurrect discarded
runtime input authority. Pending projection/evaluation is still tracked by existing bookkeeping,
not inferred from this received position. No new conflict found in these ownership boundaries.

However, capture validation alone does not preserve the terminal receipt through restore. The
current checkpoint has per-node terminal/lifecycle/cache/version and declared deps, but no received
terminal-edge record. Current restore resets DepBookkeeping and later seeds from the source's
current state; for resubscribable terminal sources it can then acquire a new subscription and reset
the source. A received ended input must instead remain that ended input, with no automatic fresh
subscription. A cold declared edge to a terminal source follows ordinary acquisition admission,
not that already-received-input path. hasCalledFnOnce is not a general edge receipt indicator,
especially across partial wiring and restored-before-attachment recapture. An input scope that
cannot be represented must still reject capture rather than guess from current source terminal.

There is also a retained-value presence distinction: a quiet pull source may have cache23 before
a new consumer subscribes; the consumer receives no DATA, then terminal. Another consumer might
already have received DATA23. Both can receive the same final terminal revision, but one has no
retained value and the other has23. Revision identifies the received final boundary, not the
consumer's hasData bit. Current subscription guards and nodeSeedRestoredDepAt's !pull rule show
why unconditional copying the upstream cache is unsound; always excluding pull cache also loses
the prior receiver's actual value. This is a contract/source trace, not a new executed probe.

Next proposal, NOT selected: serialize a sparse record for relevant actually-ended dependency
inputs, containing the accepted receipt revision and the existing retained-value presence. Record
presence itself establishes that this edge actually received terminal; do not add a parallel
receivedTerminal flag. Associate it with the declared dependency identity; exact portable encoding
is deferred. If the accepted capture guard proves the source snapshot still represents that final
input, reuse that node's saved terminal and, when hasData, its value rather than duplicate payloads
or save event history. Restore installs this logical ended DepRecord before any acquisition and
does not replay a terminal invocation or restart the upstream for that edge. Any unconsumed
terminal projection remains covered by the unsupported-pending-work gate. Carry the sparse record
through recapture before attachment; source changes after restore do not overwrite its held final
input. If recapture can no longer represent that held input using current source snapshots, reject
again. The conservative alternative is to reject captures requiring these unrepresented received
terminal inputs until the format supports them. This is a format-support tradeoff requiring user
selection, not implicit approval from agreeing to an in-memory revision field.

**Work/evidence.** Read nodeRestoreState (resets dependency state, keeps hasCalledFnOnce, starts
resource-inactive), nodeSubscribeDepAt/nodeSeedRestoredDepAt, pull subscription cache guards,
DepBookkeeping and surgical rewire carry/reset paths, and GraphCheckpointNode. Existing terminal
input/carry limitations are current implementation evidence, not proof of candidate correctness.
No new runtime probe/test run this turn; no runtime/schema/rules/formal/conformance/jsonl/owner-
ledger/D#/commit/push changes. Only this existing session note updated. Keep QA-22 open for the
specific portable receipt representation choice; do not advance to QA-23 claiming this is solved.

### QA-22 compact ended-input checkpoint record accepted; compatibility audit advances to QA-23 (2026-10-29)

**Rules — accepted supplement.** User explicitly agrees that checkpoint saves the compact
dependency receipt record and requests a restore/PULL/lifecycle audit, then next item if clear.
Record acceptance of the sparse actually-ended input representation: received revision plus
existing retained-value presence, associated with the exact declared dependency in this capture.
Its existence identifies received terminal; no parallel receivedTerminal flag or historical event
log is needed. Capture still rejects when current saved source snapshots cannot represent the
held final input. Approval does not authorize runtime/codec/spec edits or select all earlier
version hash/counter/switch details.

**Decisions — compatibility review, no additional policy fork found in this bounded pass.**
- Validate a sparse record against an actual declared source, its saved terminal and matching
  revision before restore commits. A true hasData must have a usable saved source value; false
  keeps the consumer's absence even if that source has cache. No payload equality is used to
  establish execution identity. Unsupported/unrepresentable input still fails honestly.
- Materialize the logical ended input at restore COMMIT from that validated checkpoint data,
  before resource attachment or post-commit source changes. Do not postpone reading its value/
  terminal until the consumer's first subscription, where another owner could have restarted
  the source. Restored resource attachment must not overwrite this record with fresh source state.
  This is restore of existing input, not a new ordinary late subscription or synthetic terminal
  delivery, and neither restarts the source nor reruns terminal input processing.
- Quiet PULL semantics hold: no synthetic PULL, no banked old demand, and no new DATA on subscription
  merely to rebuild an input. Retaining a previously received pull-source value is legal; the
  sparse hasData keeps it distinct from never receiving that value. A restored pull holder remains
  quiet until a serviceable new demand; reattach/first-input/PAUSE admission is unchanged.
- Keep received evidence separate from evaluated input. Existing pending projection, DIRTY,
  pause-buffer and owed-demand checkpoint gates still apply; this format addition does not claim
  to capture unconsumed work. A cold, never-acquired edge gets no invented ended-input record and
  remains subject to ordinary acquisition admission. Source terminal resource close is not
  downstream input cancellation, and source restart does not make an ended edge follow a new run.
- Reorder carries the record with the same connection. Removal/re-add creates ordinary new input
  identity. Consumer actual close/fresh reset discards its transient input evidence; private-state
  persist does not override that. Fn replacement alone preserves surviving connection facts as
  already selected, while retiring old restored-result trust/pending reattach under its own rules.
- Recapture before first attachment keeps the materialized ended input and its provenance. If the
  source has meanwhile restarted/changed so current node snapshots no longer represent it,
  recapture rejects under the accepted gate; it does not silently refresh the old edge. This
  intentionally bounded format does not yet support saving every old execution's final payload.

**Work/evidence.** Cross-read the current checkpoint shape, restore wipe/seed/acquisition path,
quiet subscription guard and accepted QA-21/22 ownership/reattach/baseline text. Current TS has no
new receipt fields, matching guard or materialization seam, so this is reviewed design coverage,
not a passing candidate-runtime test. No new probes or test runs; earlier actual restart roundtrip
counterexample remains relevant. No new material conflict found within this review scope. Advance
the discussion cursor to QA-23, without declaring QA-22 implemented, normatively reconciled or
cross-runtime verified. Existing unresolved detailed codec/version-policy/qualification work stays
explicit. Only this session note changed; no runtime/schema/rules/formal/conformance/jsonl/owner-
ledger/D#/commit/push mutations.

### QA-23 opening: quiescent group release and ordinary lifecycle cleanup (2026-10-29; proposed)

**Rules/current authority.** graphrefly:D122 owns atomic permanent removal of an ephemeral node
group, retired IDs and graph-owned runtime release; graphrefly:D124 selects quiescent-only rejection
before commit, no forced cascading or synthetic protocol COMPLETE/TEARDOWN. These are graph-layer
decisions, not a newly activated release wave rule. graphrefly:D152 supplies explicit graph-owned
groups. graphrefly-ts:D167 owns exact issued runtime identity/release-start/access-close structure;
root graphrefly:D167 is unrelated memory retention and must not be substituted. Previously accepted
ordinary cleanup attempts independent work, finalizes logical closure and reports operation errors
without automatic retry or converting them to protocol ERROR. QA-23 asks how these fit permanent
release, actual external owners and closing-phase admission.

**Decisions — recommendation, NOT yet selected.** Retain quiescent-only release. Preflight the
whole group read-only before committing anything: outside declared dependents (even inactive),
actual live outside subscriptions/retain owners, an in-progress invocation/delivery/closing phase,
or accepted uncommitted work prevent immediate release. Do not queue release implicitly, evict
external owners, wait for closing or manufacture settling messages; caller can retry after the
existing boundary/owner release. A terminal output alone does not prove owners/queues are gone.

Distinguish declared dependency from an actual subscription lease. Only actual group-owned
subscription registrations may be excluded from outside-owner checks. An ended input from QA-21/
22 retains a declared edge and final value but no continuing source subscription. Do not count
one internal subscriber merely because its dependent is active and declares that source. Read the
existing acquisition/connection lease records; no second global lease registry or shadow counter
is proposed. Outside declared dependencies still prevent release because topology cannot retain
dangling node references even when that particular runtime input has ended.

After successful preflight, commit permanent retirement for the whole group before user cleanup
can reenter; revoke execution authority under selected lifetime/access boundaries. Attempt each
independent cleanup/unsubscribe/dispatcher release once, continue after failures, finish internal
retirement and report operation failures with the shared aggregate/stage semantics. No rollback
to live nodes, protocol ERROR, automatic retry or permanent runtime failure-history store is
introduced by this proposal. A committed retirement with cleanup failures is distinct from a
preflight rejection: group released view must reflect committed graph ownership even if cleanup
reporting throws. Exact handling of existing D167 residual resource-failure evidence and release
event observer failures needs qualification; do not erase required live resource ownership merely
by calling it historical diagnostics, or claim that reporting proves resources were all released.

**Work/evidence.** Current Graph._releaseNodes preflights outside declared dependencies, runtime
quiescence and outside subscriber counts, removes all registry entries/retire IDs before cleanup,
then attempts each node. Current internal subscriber estimate is active-dependent plus declared
deps, not actual lease identity; this must be reconciled with ended/restored dependencies. Current
node release tries independent unsubs/hooks/unregister, stores residual resource failure records
and throws the first cause; graph release likewise reports only the first caught error. Current
TopologyGroup.release updates its local released flag/members only after the call returns, so a
postcommit cleanup exception can leave that wrapper view behind committed graph removal. Current
runtime quiescence has no selected closing/delivery-boundary queue facts. These are inspected
implementation differences/gaps, not probe-confirmed new failure traces.

Located graph.part-02 tests for atomic removal, blocked outside consumers/subscribers, cleanup
failure release events and current internal subscriber arithmetic; read test locations only, no
test execution this turn. A lookup in graph/__tests__ failed (directory absent); corrected to
packages/ts/src/__tests__. TS HEAD dafc5ae57d446a59a7388214c31bd7a6e73d1519, runtime tree unchanged.
No implementation, normative authority edits, commit or push. Present this release recommendation
for user review before changing semantics, failure evidence retention or the group wrapper.

### QA-23 release direction accepted; consumer/cleanup compatibility review (2026-10-29)

**Rules — acceptance.** User agrees to QA-23's recommendation and requests a cleanup/lifecycle/
existing-consumer check before the next item. Record acceptance of group-wide read-only preflight,
rejection with live outside owners/dependents or non-quiescent work/closing, actual lease-based
internal subscription accounting, logical group retirement before user cleanup, independent
cleanup attempts and the shared operation-error reporting contract. Postcommit cleanup failure
does not undo release; released views must represent the committed fact. No runtime changes are
authorized. graphrefly:D122/D124 remain governing release rationale; graphrefly-ts:D167's current
resource ownership obligations are not silently erased or replaced.

**Decisions — compatibility review, no new material policy fork found in this bounded pass.**
1. Ordinary lifecycle close and permanent group release share once-only independent cleanup and
   error reporting, but only permanent release retires graph registration/IDs. Keep the existing
   per-cleanup narrow read view long enough for the cleanup call; revoking active ctx operations
   must not prevent accepted cleanup state/input reads. Reentrant subscribe/rewire/down cannot
   revive any node in the already-committed release group, including members not yet cleaned.
2. Only actual outside owners prevent release. Internal lease accounting must use actual owned
   registrations, not topology/active estimates; ended/restored logical input contributes no
   source subscription. Outside declared edges still block permanent removal even when cold or
   runtime-ended, because removal cannot leave dangling topology/checkpoint references. Root
   retain leases must be intentionally released by their owner, not silently evicted by a group.
3. Collection/view wrappers need the same preflight-versus-postcommit distinction. A rejected view
   release remains usable and stays memoized/owned. A committed view release with cleanup error
   must update disposed/released and evict that retired view before reporting the error. Do not
   return the dead view from a memo on a later lookup. No new parallel lifecycle state is needed:
   derive the wrapper transition from the committed graph-owned registration/group result.
4. Parent collection dispose is not automatically one atomic node group: ViewMemoCache.disposeAll
   visits independent view groups, and collection disposers also release binds/activation roots.
   Attempt independent cleanup as appropriate and report failures, but preserve any still-live
   view's parent/resource prerequisites when that view's PRECOMMIT check rejects. "Try other
   cleanup" does not authorize tearing down resources on which the retained live consumer depends.
   Do not claim all-or-nothing release across several separately committed groups, or promise
   parent disposal succeeded while some required component remains live. This applies the same
   existing ownership-before-release rule; it adds no parent transaction or automatic retry.
5. Cold construction abort releases only its own acquisitions and respects borrowed handles,
   externally published survivors and dependency guards. Preserve the original failure plus all
   independent cleanup failures. Do not turn pre-publication cleanup into a fresh subscription or
   rollback already-delivered effects after ownership transfer. D167 residual resource locators
   are evidence of potentially unreleased obligations, not a generic historical error log. The
   no-new-history/no-automatic-retry position does not authorize deleting these ownership facts
   or claiming external resources were released. Permanent retired identity is not an ordinary
   reactivation eligible node; the ordinary no-cleanup-fault-restart-blockade rule stays intact.
6. Release topology observations describe committed removal, not COMPLETE/ERROR messages. An
   observation failure cannot reverse removal, skip remaining independent cleanup or overwrite
   earlier failure causes; it follows operation/observer error ownership, not protocol ERROR
   synthesis. Runtime-originated failure egress without a synchronous caller stays for QA-25.

**Work/evidence.** Inspected createLightView.dispose, ViewMemoCache.disposeAll, reactiveMap/list/
log dispose and bind release, GraphTopologyGroup.release, Graph._releaseNodes and retain,
ConstructionScope.abort/start/ownership locators, cleanupNodeAcquisition and D167 design text.
Current view/group flags update only after normal return and memo cleanup can be skipped by a
postcommit exception; view/parent loops stop at first exception. These are consumer adaptation
surfaces, not evidence the selected shared reporting/finalization contract already works. Existing
graph.part-02 cases inspect atomic release, cleanup failure events, live outside ownership and
current active/topology subscriber arithmetic; no tests were executed or added this turn. A
lookup of nonexistent node-runwave-runtime.ts/operators/pull.ts failed; runWave was read in
node-input-runtime.ts and pull rules read directly. Runtime HEAD/tree unchanged. Only this note
updated; no normative rules/formal/conformance/jsonl/owner ledger/D#/commit/push edits. No new
choice needed for the bounded compatibility points; advance discussion to QA-24, with wrapper,
lease accounting, aggregate reporting and qualification remaining implementation work.

### QA-24 opening: cache freshness is result settlement, not fn execution (2026-10-29; proposed)

**Rules/current authority and earlier accepted design.** Earlier selected status is derived
{cache,output,lifecycle}: cache empty/waiting/ready/stale from value presence and unresolved cache
settlement, independent of lifecycle, terminal and raw dependency pending count. Stale means a
retained value with unresolved freshness; it need not promise future output. Quiet pull can be
stale without announcing downstream DIRTY. Terminal ends waiting but does not certify stale
values fresh. R-status-enum@1 lacks activated_by; R-pull@1 also remains unactivated; selected
review semantics require later normative reconciliation. R-resolved-undirty@1 is activated and
distinguishes no-occurrence RESOLVED from DATA; QA-5 retains message-owned raw deferred settlement
without a new task tracker.

**Decisions — recommendation, NOT yet selected.** For the first QA-24 choice, do not clear cache
staleness solely because a fn was invoked or returned without output. Invocation may update private
bookkeeping or initiate deferred external work without certifying that the published cache is
valid. A quiet PULL helper may intentionally emit nothing; when no downstream DIRTY was announced,
no balancing RESOLVED is owed. Keep that silence and the unresolved cache fact distinct from a
claim that this retained result was settled. Example: cache20 -> changed upstream input -> local
stale/no downstream DIRTY -> PULL invokes fn -> no DATA/RESOLVED -> cache remains stale. This is
legal and does not require a future output. A helper that knows its retained result is still
acceptable can explicitly emit RESOLVED; normal delivery/quiet admission applies and the event
is observable. Ordinary sync paths that already owe and legitimately synthesize RESOLVED use
that settlement normally; no new public acknowledge method, fn-called version, async-job flag,
silent local-settlement hook or extra status dimension is proposed. Alternative: make no-output
return silently certify the cache, but that overloads return and infers intent unavailable for
raw deferred producers. Prefer explicit existing settlement semantics.

Scope: this first choice does not yet settle attribution of a pre-pause output while newer input
remains owed, status during buffered resumeAll output, initialization waiting versus cold empty,
or the exact minimal backing representation. Do not equate receipt revision with evaluated result
or apply revision equality as a freshness filter. Those QA-24 transition interactions remain next
after this choice; no generic latest-request-wins or async completion inference is introduced.

**Work/evidence.** Current nodeMarkDirty marks local status dirty even when pull-quiet absorbs
downstream notification. nodeRunWave only auto-emits no-output RESOLVED when downstream DIRTY was
owed and its other gates allow; nodeDown sets status on actual DATA/RESOLVED. The current scalar
status getter is not the selected derived status design. Source inspection supports this proposed
distinction, not a complete cache-freshness transition implementation/test. Existing note only;
no new probe/test/runtime/authority/schema edits. Present QA-24 first choice to the user.

### QA-24 no-output return choice accepted; old output with deferred new input (2026-10-29; proposed)

**Rules — acceptance and governing scope.** User agrees and asks to continue. Record acceptance:
fn invocation/return alone does not clear cache staleness. Existing legitimate sync synthesized
RESOLVED remains a settlement; quiet no-output return without owed downstream DIRTY remains
silent and can retain stale cache. No new async-job tracker, implicit acknowledgement method or
fn-run version counter is selected. Existing accepted default PAUSE gates new fn invocation,
permits output from already-started work, preserves pending input occurrences under QA-14, and
uses arrival-order output rather than latest-request-wins. Cache/output/lifecycle remain distinct.

**Decisions — next recommendation, NOT yet selected.** When an already-started invocation emits
DATA while newer known input is still awaiting invocation/processing, accept the DATA normally,
update the retained output cache and preserve its DATA occurrence. Do not cancel old work or
filter the output by input revision. However, that output does not clear the still-owed input
work: derive cache as stale while that known obligation remains. Distinguish latest accepted
output from settlement of all currently known cache-staleness reasons. Output DIRTY balance can
settle for the delivered array while this node retains an internal stale/cache-work fact; do
not force every internal pending computation into another early downstream DIRTY or keep
downstream debt open merely to make status look consistent.

Concrete trace under the selected future default-pause contract: cache0; input10 starts a job;
PAUSE; inputs20,30 arrive and remain unconsumed; old job10 emitsDATA100. Cache becomes100 and the
normal output wave is delivered, but local cache status remains stale because20/30 still await
the selected resume path. Final RESUME admits one raw invocation with retained20/30 projections
(latest-value sugar uses30); return alone does not certify ready. Its DATA300, or an applicable
explicit/legitimate synthesized RESOLVED, can settle the cache when no other runtime-known stale
reason remains. Subsequent output must have the accepted fresh DIRTY prefix/normal debt balance,
even though DATA100 already settled the previously announced debt. Do not erase unconsumed
projections or rely on the old emittedDirty bit to represent the owed invocation.

This is not async completion tracking: readiness is protocol-relative and can cover only known
input/control/output obligations plus existing result settlement. No count of all launched jobs,
invocation generation rejection or newest-request filter is added. Once newer input has been
admitted and two jobs are running, this choice does not identify which eventual callback is
"the latest result"; valid messages retain arrival-order semantics and raw async helpers own
their eventual DATA/RESOLVED policy. Do not advertise ready as all external work finished or a
proof that the output reflects the latest input. Lifecycle close cancels owned owed work under
normal rules; terminal does not retroactively certify a retained stale result as fresh.

Alternative: treat any DATA as globally ready even with known owed input. Simpler assignment,
but falsely hides the very deferred computation PAUSE is retaining. Prefer the derived stale
view from existing pending-input/settlement facts, with no separate hasOldAsyncWork boolean.
The exact representation of unresolved cache settlement remains for unified storage design;
it cannot be reduced to dependency DIRTY count, invocation return or output DIRTY debt alone.

**Work/evidence.** Re-read current nodeDown buffering/cache updates, nodeMaybeRun/nodeTryRun,
nodeRunWave input consumption/auto-RESOLVED and nodeOnResume. Current TS default async pause still
buffers pre-pause outputs, so the stated passthrough/status trace is a candidate-contract review,
not current-runtime verification. The earlier Sept23 isolated override probe in this note found
owed resume invocation survives old output but immediate resumed output can lack DIRTY; this
turn did not rerun it and does not claim a complete fix or proof. Current status is still scalar,
and no status/queue/ctx/version implementation was changed. No new probe/test run, rules/formal/
conformance/jsonl/owner ledger/D#, commit or push. Only this existing review note updated. Next
QA-24 subtopics remain resumeAll buffered/draining output and cold initialization waiting/empty;
obtain user choice on this known-owed-input precedence before declaring them reconciled.

### QA-24 deferred-input freshness accepted; resumeAll buffered/draining status proposal (2026-11-02)

**Rules — acceptance.** User agrees and continues. Record acceptance of the preceding default-
PAUSE review: pre-pause work may publish its valid DATA/update cache, but known newer unconsumed
input preserves local stale status and owed processing. The delivered output settles its own
downstream interval; do not erase pending input or require an async-task tracker/latest-wins
filter. Ready is protocol-relative, not proof all asynchronous work finished. No implementation
authorization is inferred.

**Decisions — resumeAll recommendation, NOT yet selected.** Derive freshness against the retained
committed output, not the newest calculated output held behind resumeAll. A pause lock alone does
not stale a previously ready cache. Once there is an outstanding held result/settlement, keep the
last committed cache unchanged and expose stale when it has a value, waiting when it has none and
output remains open. Do not make buffered DATA visible via cache/version/replay before normal
commit merely because computation finished. Plain-state intrinsic assignment remains a separate
owner; QA-4 silent last-off rebase and its accepted revision update remain an explicit exception
to "only live delivery changes snapshots", not an excuse to leak the pause buffer early.

Trace (two separate buffered arrays, no other pending work): cache10 ready; PAUSE resumeAll with
no result yet keeps10 ready; hold DATA20 and DATA30 -> cache10 stale; deliver the20 array ->
cache20 stale because the30 array remains owed; deliver final30 array -> cache30 ready. All
arrays retain their normal prefix/FIFO boundaries and DATA occurrences. Ready requires a normal
settlement and no other known stale obligation; finishing this drain does not override newer
unconsumed inputs or deferred work. Re-pause after the20 array keeps20 stale and holds30. When
cache is absent, the analogous open-output view is waiting; a buffered INVALIDATE does not clear
the currently visible value until applied, and applying it while later DATA remains owed yields
waiting rather than ready. A buffered RESOLVED likewise follows normal result application rather
than silently acknowledging freshness at enqueue time.

Terminal remains independent: COMPLETE/ERROR bypasses and drops held output under the accepted
policy, keeps the sealed current value/freshness, and changes no-value waiting to empty. Dropping
a pending20/30 buffer is not proof that retained10 became fresh. Ordinary actual lifecycle close
discards owned buffer; compute cache clears, plain-state snapshot rebase follows QA-4, and none
of the retired entries transfers to a new lifecycle. PULL admission remains its own axis; this
status proposal changes neither quiet subscription nor which serviceable demand owns a drain.

Queue ownership consequence: the single output/drain owner must keep not-yet-committed entries
visible as owned pending output while callbacks inspect status. Do not infer "no output owed"
just because a drain has moved pauseBuffer into a local array and emptied the field. An owner-
visible remaining queue/cursor can supply the fact; no second independently mutable
isDraining/hasBufferedOutput/public status flag or general async-job count is selected. Inspect
status after committing the complete current array and establishing remaining owned work, before
its observer callbacks; do not expose tuple-by-tuple intermediate facts as the whole-array view.
Existing boundary controls/revalidation decide whether the next array remains eligible.

Alternative: mark ready after the first replayed DATA even with known later output buffered.
That hides the known deferred result and makes inspection depend on whether the backlog is in
the field or a drain-local variable. Prefer the same known-owed-work precedence accepted for
default PAUSE, with the output queue supplying the missing fact.

**Work/evidence.** TS HEAD remains dafc5ae57d446a59a7388214c31bd7a6e73d1519; runtime working tree
unchanged. Read current nodeDown pause buffering before cache/version/replay application and its
DATA/RESOLVED/terminal branches, and nodeOnResume which copies the queue to local buf and clears
pauseBuffer before iteration. Existing code explains the storage/inspection seam but does not
implement the proposed derived freshness/drain view. Re-read accepted whole-array/FIFO/re-pause
contract at the continuation and QA-9 sections. R-undirty-settle-timing@1 is activated;
R-pause-modes@1/R-status-enum@1 lack activation metadata and must not be called current normative
coverage. No new probe/test run; no runtime/schema/rules/formal/conformance/jsonl/owner ledger/D#,
commit or push edits. Only this existing session note updated. Obtain user review of the buffered
freshness proposal; cold initialization empty/waiting remains the next QA-24 subtopic.

### QA-24 resumeAll freshness accepted; cold initialization empty/waiting proposal (2026-11-02)

**Rules — acceptance and previous scope.** User agrees and continues. Record acceptance of the
resumeAll freshness proposal: output cache remains the committed value; known held/draining
results preserve stale/waiting until normal settlement and no other known outstanding reason;
PAUSE alone does not stale a ready value; terminal dropping held output does not certify a stale
value fresh. The output/drain owner must expose remaining work even if current code empties the
pauseBuffer field into a local variable. No additional independent public drain flag or async-job
tracker is selected. This is review acceptance, not implementation or normative amendment.

**Decisions — next recommendation, NOT yet selected.** For an open output with no retained value,
empty means no runtime-known current result/initial-evaluation obligation; waiting means such an
obligation exists but no result value is currently available. Neither term promises a future DATA,
running fn or successful startup. A never-activated cold node stays empty; adding a PAUSE lock
alone to that inactive node stays empty. A normal compute node with an owned requested first
evaluation held by deferred activation, PAUSE or initial input-completeness/readiness is waiting.
A quiet pull holder with no demanded/changed input work is empty; no PULL is invented just to
initialize it. Absorbed input changes awaiting demand, an active owed PULL, actual announced
unsettled result, or held output give the corresponding known waiting reason when there is no
value. PULL received while inactive still drops under the accepted admission rule and does not
create waiting. If a value exists, use the prior ready/stale rules, not this no-value projection.

The ordinary activation request and quiet-PULL initial posture are distinct: merely declaring
deps or attaching a quiet holder does not request its first evaluation. partial:false first-input
completeness contributes waiting only in an actual requested evaluation, not as a graph-wide
obligation for every cold declaration. partial:true does not gain a setup barrier from this view;
runtime-owned dependency acquisition can still drive early partial evaluation while wiring.

Do not derive or emit a protocol DIRTY just because public cache status is waiting. The accepted
START snapshot catalogue uses actual announced output notification: no announcement -> START
only when absent; announced outstanding DIRTY -> START+DIRTY. Quiet PULL subscription remains
START only, even when its local view is waiting/stale. A node whose first fn is PAUSE-gated can
therefore be waiting locally without placing its downstream in protocol pending. Likewise an
upstream C waiting for activation/first input without announced DIRTY must not prevent D's
legitimate partial:true run on B's DATA. START alone changes none of these facts.

Respect QA-5's no-task-tracker boundary. A depless source setup may register a Promise/timer and
return without announcing DIRTY; do not infer external pending result from the closure, pool label
or presence of async work. Such an active source can remain empty until it publishes a result or
announces known settlement. An owed startup call can cease to be owed when admitted; that is not
acknowledging an unresolved output result. Fn return alone still cannot clear any established
cache-staleness/result obligation. A RESOLVED without a value produces empty only when no other
known waiting reason remains; it cannot satisfy partial:false's missing value requirement.
Terminal changes no-value waiting to empty, close cancels its owned transient waits under the
existing policies, and permanent release uses only the released variant. Restore of a cold graph
does not activate it or turn every absent cache into waiting; its actually restored logical input
facts and admitted later acquisition/demand determine the view.

Storage/owner implication: reuse lifecycle-owned owed activation, evaluation/readiness scheduling,
known unsettled-cache fact, control-owned demand and output-owned queued/draining work. Status
only reads an O(1) projection and performs no dep scan, demand, registration or fn call. Exact
canonical backing layout still belongs to unified state design; this recommendation does not
claim the present activated/pending/status fields already suffice or add a second isWaiting flag.
Alternative: every active empty node is waiting. That falsely makes quiet subscription/long-lived
sources a result promise and is incompatible with the accepted no-implicit-demand semantics.
Prefer the known-owned-obligation distinction.

**Work/evidence.** Read current subscription START/cache/pull guards and nodeActivate depless
dispatch, nodeMaybeRun/nodeTryRun first-input checks, accepted QA-10 notification-based initial
snapshot catalogue (not its later-rejected full-wiring barrier), QA-15 first gate and QA-16 owned
boundary activation. R-push-subscribe@1/R-first-run-gate@1 are activated; R-status-enum@1 is not.
Earlier accepted async paragraph explicitly says a depless promise source need not announce
DIRTY merely on activation. Runtime HEAD remains dafc5ae57d446a59a7388214c31bd7a6e73d1519 and tree
unchanged; proposed derived status/obligation machinery is not implemented. No new probe/test,
runtime/rules/formal/conformance/jsonl/owner ledger/D#, commit or push. Only existing session note
updated. Await this last QA-24 initialization choice before final combined freshness review and
the QA-25 runtime-originated error reporting topic.

### QA-24 user reopens whether cache needs a waiting category (2026-11-02)

**Rules/review status.** User annotates the preceding empty/waiting table and asks whether cache
state needs this distinction. Treat as reopening the projection choice, not acceptance of the
last initialization proposal or authorization to implement. Earlier September28 accepted four-
state cache projection is a design direction, not activated R-status-enum@1 (which still lacks
activation). No change to protocol readiness/dirty/input/cleanup/restore obligations follows
merely from simplifying a public inspection field.

**Decisions — revised recommendation, NOT selected.** Retain the useful cache questions: is there
a retained value, and if present does it have unresolved known staleness? Recommend public cache
as empty | ready | stale. Collapse no-value empty/waiting in this field: the proposed waiting
catalogue mixes startup/demand/readiness scheduling into the cache projection, and the same no-
value situation has many possible causes. Public waiting would not reliably tell whether a task
is running, whether DATA will arrive or whether downstream has DIRTY pending. Detailed inspection
can explain existing actual owned blockers/demand/notification without a new stored work status.
Tradeoff is losing the convenient no-value-awaiting shorthand in basic status; it can be added
later only for a concrete stable caller question, rather than exposing an incomplete async/job
promise. Keep {cache,output,lifecycle} grouping and derived-on-read ownership; no replacement
isWaiting flag or second status record is proposed.

Collapsing the view does not erase owed activation, pending inputs/PULL, buffer/drain entries,
unsettled cache facts or actual published DIRTY. Those still govern scheduling and checkpoint
eligibility. START snapshot composition continues to use actual announced output state rather
than the public cache enum, so empty can legally accompany START alone or START+DIRTY according
to that existing protocol fact; quiet PULL still suppresses initial output. Terminal/lifecycle
fields report their own transitions. This is a projection simplification proposal, not a change
to previously selected PAUSE/PULL/restore/result settlement behavior.

**Work/evidence.** Re-read the September28 status principles and four-state acceptance, latest
QA-24 initialization proposal, R-status-enum@1 activation absence and current session boundary.
No runtime, normative rules/formal/conformance, schema/jsonl/owner ledger/D#, probe/test, commit
or push changes. Only this existing note updated; await user's choice before replacing the
selected four-state direction or moving to QA-25.

### QA-24 three-state cache accepted; combined review advances to QA-25 (2026-11-02)

**Rules — acceptance/supersession within this review.** User agrees to the revised recommendation.
Select public derived cache empty | ready | stale; this replaces September28's four-state
projection and the previous unaccepted cold-initialization waiting catalogue as public API design.
Where earlier accepted pause/buffer/terminal review text refers to no-value waiting, the public
projection is now empty; its actual internal obligation is retained. No new work/waiting status
field is selected. Preserve {cache,output,lifecycle}, released-only variant, on-read/O(1)/no-side-
effect inspection, current logical output cache and protocol-relative staleness semantics.
This review supersession does not activate/amend R-status-enum@1 or authorize implementation.

**Decisions — combined compatibility review.** Empty now means retained-value absence only and
must never stand in for quiescent/admissible/ready-to-call. Actual DIRTY debt, pending inputs,
owed activation/demand, setup/readiness, pause locks and output/drain queues remain owner facts.
START versus START+DIRTY is still derived from actual announced output state, not empty versus
waiting. Quiet subscriptions remain START only; partial:true is not blocked by a fabricated
DIRTY inferred from cache inspection. No change to automatic RESOLVED, raw async responsibility,
terminal input policy or exact retained final dependency records. Checkpoint still rejects
unsupported obligations even when cache is empty/ready; compact ended-input hasData/revision
records and restore-at-commit materialization do not need a public waiting enum. Normal close,
terminal seal, ROM/RAM retention and permanent release keep their own transitions. Cache stale
still survives known newer unconsumed input/queued output despite an older valid DATA and is
not cleared just by invoking/returning from fn. Ready does not prove latest-request-wins or all
external work finished. No new material inconsistency found in these bounded interactions.

**Work/evidence.** Existing runtime scalar status/early subscriber loop still do not implement
the selected status, whole-wave/error or lifecycle contracts. No new test/probe was run. Runtime
tree remains unchanged. Mark discussion choices of QA-24 reconciled enough to advance to QA-25;
minimal backing facts/layout and normative/model/scenario/API/runtime qualification remain work,
not completed implementation. Only this session note updated; no rules/formal/conformance/jsonl/
owner ledger/D#/commit/push changes.

### QA-25 opening: operation failures at asynchronous host entry (2026-11-02; proposed)

**Rules/history.** Accepted ordinary observer-failure isolation completes valid whole-wave
fanout/settlement and reports original/aggregate operation failures without source protocol
ERROR, implicit retry or automatic observer removal. Receiver fn failures retain their own
protocol ERROR contract. Accepted external diagnostics are optional/no-history, but absence of
a diagnostic receiver must not swallow current operation failure. Late async helper errors
already require explicit helper-owned reporting. QA-25 addresses the case where the owning
operation starts at timer/Promise/pool/driver callback rather than a caller awaiting state.set.
Sync-core and dispatcher invocation stay synchronous; no new message or dispatcher policy.

**Decisions — recommendation, NOT selected.** Keep synchronous host-initiated calls reporting to
their caller after applicable work. For runtime/adapter-originated callback entry, the host/
environment adapter owns the same completed operation's failure and explicitly reports it via
a thin host failure boundary. It must finish applicable runtime bookkeeping, independent fanout/
cleanup and source continuation before failure reporting can throw or escape into a Promise.
Observer delivery error is not source I/O failure and must not enter an existing catch path that
emits source ERROR. Do not swallow the error, resolve an unrelated business PULL as failed, retry
the event, or retire the source/observer solely because notification failed.

A single configurable host operation-error reporter at the environment/adapter boundary is a
possible minimal shape, not an existing API or a chosen name/signature. If installed it owns the
report; avoid duplicate unconditional rethrow plus reporter call. Without a configured receiver,
use the host's ordinary uncaught-error/rejection reporting path, preserving a visible failure;
optional diagnostic event export alone is insufficient. Do not retain a runtime history/buffer
of failures or add an error Node/dispatcher catch-all. Reporter failure must preserve the
original failure and terminate through a bounded fallback rather than recursively reporting
itself; exact carrier/fallback is a follow-up design question. Admission/scheduling and protocol
state must already be finalized before this egress. Plain synchronous operations do not become
silently handled merely because an optional diagnostic receiver exists.

Concrete consumer trace under the selected future observer policy: timer emits DATA23; observer
A throws; valid observer B still receives the whole array; applicable source bookkeeping is
completed; host receives A's original failure (aggregate if multiple). No source ERROR is
manufactured. A source operation whose actual acquisition/I/O fails still follows its own
existing source ERROR policy. Original Promise rejection and a failure thrown by a successful
Promise callback's ctx.down are different causes and need separate catch boundaries.

Alternative: let failures propagate through every adapter callback with no boundary work. This
is small in code but can stop source continuation or be caught as the wrong domain's failure.
Alternative: swallow/log diagnostics only. That violates current-operation error reporting and
hides failure when no logger exists. Prefer a small explicit host-owned reporting boundary,
with no new protocol state, until exact existing host integration can be qualified.

**Work/evidence.** Inspected Dispatcher/PoolTable sync invoke, GraphOptions/EnvironmentDrivers
current surfaces, timerSource, fromPromise/fromAsyncIter and fetchHttpDriver. No unified operation
failure reporter found on the inspected graph/environment options; do not claim one exists.
fromPromise uses a void .then result; callback throws can become otherwise unowned rejection.
fromAsyncIter's broad try covers ctx.down as well as iteration and catches into ERROR: inspected
risk of reclassification/abandoned pump, not a newly executed counterexample. timerSource installs
its periodic interval after initial ctx.down; a throwing publication can skip that continuation
unless the selected future boundary handles reporting after applicable source bookkeeping.
Current native timer errors/Promise rejection default reporting is host behavior, not a portable
GraphReFly observer contract. No external source or timer run, new probe/test or implementation.
Several guessed observe/dispatcher/clock paths did not exist; corrected to dispatcher/index.ts,
graph source files and timerSource's direct timer code. Only this existing note changed; no
normative authority/API/schema/jsonl/D#/commit/push mutation. Exact report API, throwing reporter
fallback and adapter/pool catch audit remain proposed work for user selection.

### QA-25 host error ownership accepted; minimal environment reporter proposal (2026-11-02)

**Rules — acceptance.** User agrees and asks to continue. Record acceptance of QA-25's routing:
valid ordinary observer delivery/settlement and applicable callback bookkeeping finish first;
sync host calls report to their caller, runtime-originated callback operations report at a host/
adapter boundary. Observer errors are not source protocol ERROR, implicit cancellation/retry or
automatic observer removal. Missing diagnostic listeners do not swallow current failures.
This does not authorize runtime/API edits or select the concrete reporter surface.

**Decisions — minimal concrete proposal, NOT selected.** Reuse the immutable graph-injected
EnvironmentDrivers bag, already passed to source/adapter contexts. Add one optional synchronous
application callback, illustrative TS spelling onUnhandledError(error: unknown): void, configured
through the existing environment constructor/GraphOptions.environment path. An original single
operation failure stays unchanged; multiple failures use the already selected aggregate carrier.
No second Graph.onError, dispatcher hook, error Node, persistent event queue or node fault flag.
The fixed host reporting helper owns default/fallback, and adapters own entry classification;
do not overload ctx.down to mean ERROR-as-catch or infer origin merely from pool kind.

Proposed behavior: a configured callback receives the completed runtime-originated operation's
failure once; if it returns normally, do not also unconditionally throw that same failure.
Without the callback, use one deferred native host throw outside the graph operation (TS can
use a one-shot microtask), so failures do not become a discarded internal Promise result or
interrupt source continuation before bookkeeping completes. Only reporting is deferred; fn
dispatch, full-wave processing and boundary work stay synchronous. Fallback must be outside
source I/O/iterator catch regions, preserving the cause's domain. This schedules no retry or
graph reevaluation and creates no retained failure history/replay.

If the application callback itself throws, preserve original operation error plus reporter
error in one aggregate and use the fixed default fallback once. Do not invoke that same
callback recursively or emit another diagnostic event to it. A synchronous reporting callback
is the contract; it is not an async task awaited by the runtime. Applications doing async
recording own that later operation/rejection explicitly. Diagnostic export remains an optional
history/observability surface, not a replacement for this ownership handoff. Ordinary state.set/
host subscribe exceptions still report to their existing caller; installing this callback must
not turn synchronous operation errors into silently handled ones.

Scope and residual qualification: adapters must establish a real runtime-originated entry and
finalize applicable continuation/cleanup before calling the fixed reporter. There is no claim
that an environment property automatically intercepts arbitrary raw-fn closures/custom SDK or
Pool callbacks; the corresponding adapter/custom host owns those entries and must use the same
explicit boundary contract. Do not catch arbitrary internal runtime faults as ordinary observer
reports or hide an actual source I/O failure. Standard library timer/Promise/iterator/driver
paths require a focused adoption audit. Future Rust/Python may use native host error egress;
the TS hook name and microtask mechanism are package choices, not new protocol messages.

Alternative: a second GraphOptions reporter/bus. It duplicates the existing environment injection
route and adds ownership/questions on raw source access. Alternative: per-source reporter knobs.
They multiply policies across helpers and do not cover common callbacks consistently. Prefer one
optional environment hook plus fixed fallback, with current diagnostic-history policy unchanged.

**Work/evidence.** Read EnvironmentDriversInit/EnvironmentDrivers immutable constructor and
withX-copy design, GraphOptions.environment and node ctx.environment plumbing. Current bag has
only process/http/SSE/WebSocket/webhook drivers, not this reporter. Current source callback and
dispatcher facts remain as inspected in QA-25 opening. No new APIs, fallback microtask, callback
wrapper, runtime/probe/test or authority edits were implemented/run; this is a reviewable proposal.
Only existing session note updated; no normative rules/formal/conformance/jsonl/owner ledger/D#,
commit or push. User selection is needed before adopting the hook/fallback details; reporter
reentry into the graph and standard adapter qualification remain subsequent compatibility work.

### QA-25 environment reporter accepted; entry/reentry qualification advances to QA-26 (2026-11-02)

**Rules — acceptance.** User agrees and asks to continue. Select the reviewed environment-local
optional synchronous onUnhandledError reporter, completed-operation handoff, one deferred host
fallback when absent, and original-plus-reporter aggregate/fixed fallback when it throws. Do
not recursively call the same hook; do not redirect ordinary synchronous caller exceptions to
it. No runtime/API/authority implementation authorization follows from this design acceptance.

**Decisions — compatibility qualifications, no additional policy fork found.** Callback shape or
pool label does not establish async-origin ownership. A driver can invoke its callback during
start(), before the original subscribe/activation returns. That work inherits the enclosing
operation and its existing caller/acquisition handoff policy; it must not be diverted to
onUnhandledError merely because its node uses pool:'async'. A later callback with no enclosing
caller-owned operation uses the selected host-owned entry report. Nested failures aggregate at
the one actual owner, not once per ctx.down, helper or graph field. Initializer failures and
transferred acquisitions keep QA-12/QA-16 routing; no START/ownership rollback is inferred from
a reporting choice. Publication failure must not fall into start/iterator/network catches.

Run the reporter after the completed operation's valid delivery, source continuation and
required boundary/cleanup work. Treat its synchronous application callback as a host caller for
new causal operations. A reporter may deliberately call state.set/subscribe under ordinary
host admission; errors of that new synchronous operation return to its caller, the reporter.
If uncaught there, the fixed reporter wrapper preserves original error plus new error and uses
the selected fallback once. No special graph permissions, implicit retry or global reporting
blockade is granted. Call-stack operation ownership supplies this boundary; do not add a node
reporting flag or infer it from source lifecycle identity. New async work scheduled by the
application is a later independent entry and remains application-owned, not permanently tied
to the old reporting call. A callback that schedules an endless series of later operations is
the runaway problem, not solved by recursive-report protection.

Keep the environment snapshot used by the originating entry; current core owners/lifecycle
checks still prevent an ended ctx from publishing, and reporting itself cannot revive it.
Reporter callback/configuration is host resource setup, not serialized private state or a
checkpointed function. Restore uses the target environment just as it rebuilds target drivers.
No report queue/replay, global mutable singleton, second GraphOptions channel or protocol ERROR
is introduced. Standard/custom adapters must adopt the boundary explicitly; a new option does
not intercept arbitrary user callback code by itself. Remaining concrete qualification includes
immediate driver callback, delayed callback, nested transferred acquisition, throw from reporter
and aggregate preservation; no candidate implementation exists to test yet.

**Work/evidence.** Read driverOneShotSource/driverStreamSource synchronous start(callback) and
their broad catches, source setup's early cleanup handoff, batch/boundary enter/exit/drain,
GraphOptions.environment and existing mock driver callback surfaces. Current boundary drain
keeps only first escaping failure; current sources can misclassify callback escape as start
failure; proposed full operation aggregation/host reporting is not implemented. No new test or
probe run, external callback/timer dispatch or runtime/authority change. Only this note updated.
QA-25 discussion can advance with exact entry/catch/cleanup integration retained as work, not a
passing conformance claim. TS runtime HEAD/tree unchanged; no commit/push.

### QA-26 opening: repeated observer requests after completed waves (2026-11-02; proposed)

**Rules/history.** Activated R-reentrancy@1 and graphrefly:D37 reject fn reentry before its current
wave completes; they do not detect repeated individually valid operations after each wave.
graphrefly:D47 explicitly classifies indefinitely oscillating net-changing deferred rewires as
user-level runaway, with no substrate numeric cap; R-rewire-deferred@1 text lacks activated_by
and must not be called an activated public rule. Sync-core/dispatcher floor and selected
observer-request FIFO/no-coalescing/preserved DATA occurrences constrain the analogous observer
loop. Extending the D47 rationale to observer requests is a recommendation here, not a hidden
already-activated obligation.

**Decisions — recommendation, NOT selected.** Keep ordinary observer-origin requests queued
until valid boundaries and drained synchronously in FIFO order, without a default numeric
iteration cap, automatic yielding, equality suppression, dropped requests or synthesized
protocol ERROR. A callback that requests set(x+1) on every DATA wave without a stopping condition
creates an unbounded sequence of individually valid waves. A guard such as x<3 produces a legal
finite sequence; the runtime cannot infer that more than some arbitrary wave count is a loop.
Likewise same-value DATA repeats are still occurrences; do not silently use equality to stop
them. Preserve D37's separate actual fn-reentry rejection.

Tradeoff: an infinite observer feedback sequence can keep the owning synchronous operation from
returning and monopolize its thread. FIFO/whole-wave completion avoids unsafe interleaving but
does not prove global termination or fairness to future host events. A timer scheduled elsewhere
cannot interrupt that synchronous drain. The composition must supply its own finite condition,
explicit occurrence filter or separately modeled asynchronous iteration when that is intended.
No public maxWaves knob/debug watchdog/new scheduler state is proposed without a concrete use
case. A reporter that schedules an unbounded stream of independent operations is similarly not
fixed by report-recursion protection.

Alternatives: a fixed iteration cap falsely rejects legitimate long finite propagation and
requires policy for remaining accepted requests/partial effects; automatic microtask/time-slice
yield changes synchronous completion, error delivery and batch/boundary semantics; dropping or
coalescing loses accepted DATA occurrences. Prefer explicit user-level termination responsibility
and document this cost, consistent with D47, while keeping scheduling errors and actual fn
reentry distinct. Do not run an actual unbounded loop merely to demonstrate the issue.

**Work/evidence.** Current batch/boundary.ts drain explicitly comments on D47 user-level runaway
and drains newly enqueued tasks in its loop. Reviewed graphrefly:D37/D47 and corresponding rule
activation metadata. This is a structural trace under accepted future observer-output queuing,
not a newly executed hanging test or proof that current observer queuing is implemented. No
runtime test/probe, normative rules/formal/conformance/jsonl/owner ledger/D#, commit or push.
Only session note updated; obtain user choice on default runaway policy before QA-27.

### QA-26 unrestricted observer feedback accepted; QA-27 output-array ownership (2026-11-02)

**Rules — acceptance.** User explicitly agrees and says not to restrict users. Select no default
wave-count cap, automatic yield, equality suppression, dropped requests, watchdog or fabricated
protocol ERROR for repeated individually valid observer-origin requests. Preserve sync FIFO/
whole-wave processing and D37's distinct actual fn-reentry rejection. An unbounded composition
can keep the owning call from returning; its stopping/filtering policy belongs to the composition.
No new implementation or normative authority change is authorized. QA-26 can leave discussion.

**Rules/current contract — QA-27 first subtopic.** Activated R-wave-boundary@1 states one down
array is a wave outside batch; selected intact observer arrays, separate explicit down calls,
automatic terminal policy, same-input DATA+terminal raw invocation and raw async settlement
responsibility constrain synthetic output. R-deps-terminal@1 and R-resolved-undirty@1 are
activated; accepted grouped terminal and automatic cancellation refinements still need later
reconciliation. Do not infer that one upstream input array guarantees one downstream output
array through every operator, or that common causal origin erases explicit output boundaries.

**Decisions — recommendation, NOT selected.** Keep each explicit ctx.down array as its own output
wave. A runtime automatic terminal after an eligible fn's already-published output is a separate
terminal array; do not hold all fn output until return, append to an already-delivered array or
merge two explicit calls merely because the same input caused them. Example source DATA23+
COMPLETE invokes map's raw body once; its explicit DATA46 array is followed by a runtime COMPLETE
array under default completion policy. A downstream terminal-aware reduce may consequently have
one input invocation for DATA46 and another for COMPLETE. That follows two output arrays, not a
duplicate terminal invocation inside the same input array. A terminal-owning operator such as
reduce/last can explicitly down([DATAfinal,COMPLETE]) and produce a single downstream input wave.
No new public coalescing/flush option or implicit fn-return output batch is proposed.

For automatic RESOLVED, retain only needed balancing output. If this fn already produces DATA,
explicit RESOLVED, INVALIDATE or terminal that legitimately settles the announced work, do not
add a redundant balancing RESOLVED. If the input's selected automatic terminal policy will close
this output immediately at the end of this handling, terminal itself settles DIRTY: no
RESOLVED-before-terminal solely to balance that same notification. Decide that postlude before
publishing a synthetic no-output RESOLVED; this does not require buffering user-authored DATA.
If no automatic terminal is selected (e.g. terminal explicitly delegated/absorbed) and a valid
sync invocation leaves an actual announced DIRTY unsettled, synthesize normal prefixed RESOLVED.
Raw deferred output still follows QA-5; don't synthesize from return/pool label alone. If fn
already closes output itself, do not append a second terminal. Invocation failure after earlier
published DATA follows that fn's existing failure policy; no rollback or retroactive array merge.

PAUSE/PULL/readiness and terminal precedence remain: automatic terminal does not wait for an
unstarted blocked fn. resumeAll may buffer the explicit DATA array, then terminal bypass/drop
that held DATA under the accepted policy. Grouping fn DATA with an automatic terminal merely to
avoid that accepted loss would change pause semantics and is not a packaging-only fix. Callback-
origin requests stay at their accepted safe boundary; user callback errors do not become this
runtime terminal. Batch remains its explicit accumulation/commit regime, not an excuse to merge
ordinary separate arrays outside it. Automatic terminal grouping is a new choice here; no claim
the earlier same-input invocation acceptance already selected transitive output grouping.

Alternatives: collect an entire fn invocation plus runtime postlude into one output array. It
reduces downstream invocation count but delays explicitly submitted output, changes partial
failure visibility and requires handling multiple calls/mixed DATA+RESOLVED. Or let a terminal
owner construct the combined array explicitly. Prefer explicit arrays plus minimal synthetic
postlude, preserving the current ownership model and power-user freedom with less runtime state.

**Work/evidence.** Inspected mapFromFunction/filter per-occurrence ctx.down, reduce's explicit
DATA+COMPLETE array and terminal-owning opts, nodeReceiveFromDep terminal run/automatic terminal,
nodeRunWave no-output RESOLVED and explicit array acceptance text. Current code can synthesize
RESOLVED in nodeRunWave before nodeReceiveFromDep emits automatic terminal; omitting that
redundant postlude needs implementation/normative work. Current message-at-a-time fanout is not
the selected intact-array runtime. No new test/probe or candidate implementation; examples are
source-grounded design traces. Runtime HEAD/tree unchanged. Only existing session note updated;
no rules/formal/conformance/jsonl/owner ledger/D#, commit or push. Await this array/postlude choice;
QA-27 tier normalization, invalidate/buffer and replay/quiet/diamond items remain subsequent.

### QA-27 explicit output arrays accepted; tier order versus authored sequence (2026-11-02)

**Rules — acceptance.** User agrees and continues. Select preserving each explicit down array
outside batch, automatic terminal as a separate array after already-published fn output, and
only necessary runtime balancing RESOLVED. A selected automatic terminal that immediately
settles this handling needs no preceding RESOLVED solely for that same debt. Terminal-owning
operators may explicitly submit DATA+terminal together. No implicit fn-return output batch,
retroactive merge or runtime implementation authorization is selected. Batch and delayed output
retain their previously selected rules; terminal precedence/cancellation remains unchanged.

**Rules/history — tier subtopic.** graphrefly:D34 pins tier DATA/RESOLVED3, INVALIDATE4,
COMPLETE/ERROR5; September29 review explicitly accepted one DIRTY phase followed by value,
optional invalidate and terminal. Activated R-wave-boundary@1 and R-resolved-undirty@1 govern
arrays/exclusivity, but R-tier@1/R-same-wave-merge@1 lack activation metadata. They are history/
draft text pending normative reconciliation, not a shortcut to declaring this detail current.

**Decisions — recommended explicit clarification, NOT selected this turn.** Ordinary live down
arrays use stable ascending tier order, preserving all DATA occurrence order within their tier.
Thus authored [DATA1,INVALIDATE,DATA2] delivers normalized [DIRTY,DATA1,DATA2,INVALIDATE] and ends
with absent cache. Authored [COMPLETE,DATA23] normalizes to [DIRTY,DATA23,COMPLETE] and ends with
retained23/terminal, subject to already-terminal entry guards. Do not drop equal DATA, truncate
because a higher-tier terminal appeared earlier in the author's array, or interpret the array
as an imperative sequential command script. DATA+RESOLVED stays invalid, not something sorting
can repair. No new DIRTY is inserted before INVALIDATE/terminal merely because their tiers differ.

Outside batch, to clear then publish2, explicitly use down([INVALIDATE]) followed by
down([DATA2]); those are two ordered waves and final cache2. Inside an explicit batch, the selected
accumulation/commit regime applies, so separate calls alone do not promise two independent live
arrays. START-bearing initial subscription snapshots keep the selected dedicated ordering and
roles (e.g. START,DATAold,DIRTY); do not tier-sort them through ordinary live-down normalization.
Retain complete-array observer and invocation gates; the no-value first gate remains QA-15 and
does not become satisfied merely by an intermediate DATA that the same initialization invalidates.

graphrefly:D50/R-paused-invalidate@1 shorthand [DATA(v1),INVALIDATE,DATA(v2)] describes a temporal
delivery trace in its formal model, not a demonstrated same-array imperative order. The model's
DepData and DepInvalidate are separate actions. Rewrite teaching examples with explicit wave
boundaries when they mean re-arm after invalidation. This preserves the later DATA re-arm rule
without using ambiguous bracket notation to contradict tier sorting. QA-14 cancellation remains
scoped to that dependency's unconsumed paused inputs; this sorting clarification is not blanket
permission to erase ordinary delivered DATA history. Detailed same-array/raw-projection delivery
and buffered INVALIDATE application still need the next cross-axis review.

Alternative: respect arbitrary interleaved author order across tiers. That would let DATA after
INVALIDATE restore cache in one array, but abandons the accepted phase/tier model and needs
reconciliation of terminal/dirty/diamond behavior. Prefer stable tier normalization plus explicit
separate waves for sequential clear-then-set, which reuses existing concepts and no new flags.
This scope does not silently decide conflicting multiple terminal normalization or other duplicate
control cases; any remaining ambiguity must stay explicit in final grammar review.

**Work/evidence.** Read protocol/messages tier table, nodeDown's sort/duplicate-INVALIDATE code,
validation and nodeReceiveFromDep invalidate path, graphrefly:D34/D50, active rule metadata and
formal/wave_paused_invalidate.tla DepData/DepInvalidate actions. Current nodeDown sorts as above;
current input receive still may run before invalidate bookkeeping and is not the selected
full-array runtime. No new probe/test or TLC run, nor candidate implementation proof. A test-file
glob failed on absent protocol*.test.ts and was corrected to rg --glob over the real __tests__
directory; no behavior claim rests on that failed search. Existing runtime HEAD/tree unchanged.
Only this session note updated; no normative rules/formal/conformance/jsonl/owner ledger/D#,
commit/push changes. Present the unambiguous tier/temporal-trace clarification to the user before
advancing to resumeAll INVALIDATE arrival-versus-drain timing.

### QA-27 stable tiers accepted; resumeAll INVALIDATE stages and local hooks (2026-11-02)

**Rules — acceptance.** User agrees to stable tier normalization and explicitly selects the next
resumeAll INVALIDATE timing question. Record acceptance of normal live-array tier ordering,
within-tier DATA occurrence order, distinct temporal waves outside batch, and the dedicated START
snapshot exception. Ambiguous D50 bracket examples need explicit temporal boundaries. No runtime
or normative edit is authorized; conflicting multiple-terminal grammar is not silently decided.

**Rules/history and previously selected scope.** ResumeAll continues computation while holding
eligible output arrays FIFO; its published cache/replay/version does not advance to held output.
Previously accepted QA-24 buffer review already defers visible cache clearing for a buffered
INVALIDATE. Activated R-paused-invalidate@1 is scoped to default pause and does not establish
resumeAll's local-hook/visible-output split. R-invalidate-idempotent@1 ties effective invalidation
to populated versus absent/reset state; R-cleanup-hooks@1 uses latest-run hook registrations;
R-ctx-state@1 preserves private state except explicit helper flushing. R-pause-modes@1 is draft,
not activated authority for resolving this interaction without review.

**Decisions — staged recommendation, NOT selected.** Distinguish input receipt/local production
from output publication. Receipt of an upstream INVALIDATE clears that dependency's retained
input/readiness/dirty contribution at its actual input processing boundary, before subsequent
fn admission. Do not postpone input absence until output resumes or allow fn to keep reading
the vanished dependency value. Respect complete-array gates/raw occurrence bookkeeping and the
scope of QA-14 default-paused input cancellation; do not erase every already generated resumeAll
output merely because a later invalidation arrived.

For this node's OUTPUT INVALIDATE, enqueue its publication with other generated result arrays.
Published cache/replay clearing, committed revision/valueRevision and downstream INVALIDATE happen
when that queued event is actually applied in FIFO order. Example separate output arrays behind
pause: DATA20, INVALIDATE, DATA30, with previously published cache10. While held, public cache is
10/stale. Drain commits20/stale -> absence/empty ->30/ready if no other known obligation. The
empty interval does not mean no pending30 exists; public waiting has been removed. No new DIRTY
solely for an INVALIDATE-only array, and every delivered DATA/RESOLVED array keeps its prefix.
Do not immediately clear published cache but leave buffered DATA20 to resurrect it later, or
silently discard that earlier output to repair such a split.

**Material local-hook qualification.** Delaying onInvalidate together with output publication is
not automatically equivalent. ResumeAll lets later fn calls continue. Existing production bodies
use onInvalidate to clear algorithm/adapter state: causal committedEffects projection clears its
private dedup slot; measurement providers clear retained measurement/adapter caches. A generic
same-pattern trace has prior result object V, local seen=V, effective input invalidation, then
new DATA containing V again while output remains paused. If the local invalidation hook has not
run, equality-based helper dedup can suppress the legitimate new occurrence, or a later delayed
hook can flush private state computed after the invalidation. These inspected hook uses show the
semantic dependency; this turn did not run a resumeAll consumer probe and does not claim the
specific existing factory currently exposes/configures that combination.

Recommend effective local invalidation/hooks at acceptance on the generated-result timeline,
before later fn work; the buffer carries the publication effect only. Draining that record must
not fire the same local hook again. Keep existing no-value/idempotent and latest-registration
principles, but define their effective presence against that generated timeline: repeated
INVALIDATE without intervening DATA does not flush twice; generated DATA between them can re-arm
it even if neither output has yet been published. Never-generated/no-effective-value invalidation
does not become a universal cancellation hook. Lifecycle/terminal still govern live ctx authority;
INVALIDATE alone neither ends lifecycle nor automatically fences prior async work. A terminal
can discard pending publication but cannot undo already performed local cleanup.

This has a genuine minimum-information cost: when output is held, published hasData and generated
effective value presence can differ. The latter is needed for local invalidation idempotence;
it cannot always be inferred from the published cache bit. Reuse the output queue/production
owner's normalization facts or derive from the queued result sequence; do not promise zero
additional representation or a full second payload cache. Exact O(1) summary/queue encoding and
hook-failure staging remain next design work, not a selected new flag/API in this note. The
committed revision fields remain publication/snapshot positions; do not repurpose them as a
generated-work counter. Private algorithm ownership remains fn/helper, not an automatic blanket
ctx.state reset.

Alternatives: delay all input/private effects until drain, which conflicts with continuing
computation; or let INVALIDATE bypass output pause, which changes visible FIFO and requires a
policy for earlier held DATA. Delaying output plus local acceptance-time cleanup preserves
the chosen resumeAll purpose with explicit stage ownership. User review is needed for that
local-hook/effective-presence qualification before treating the interaction as settled.

**Work/evidence.** Current nodeDown buffers value/INVALIDATE before cache application, but
nodeReceiveFromDep directly calls _invalidate, which clears this node's output/replay, fires
hooks and emits immediately. Current own-output and received-input paths therefore combine
effects differently; do not claim the staged proposal exists. Read nodeInvalidate, tier buffer
predicate, conformance C-19 never-populated invalidation balance case and lifecycle invalidation
tests (source only, not run), plus actual onInvalidate bodies in solutions/reactive-layout/
measurements.ts and solutions/causal-occurrence/construction.ts. C-19 exercises the never-valued
RESOLVED path, not a general populated resumeAll invalidate timing proof. No new probe/test,
runtime/API/schema/rules/formal/conformance/jsonl/owner ledger/D#, commit or push changes. Only
existing session note updated. Present staged recommendation and its actual local-state cost;
do not advance past the unresolved effective-invalidation/hook representation as if trivial.

### QA-27 staged INVALIDATE accepted; minimal queue-tail presence and failure semantics proposal (2026-11-02)

**Rules — acceptance.** User agrees and asks to continue. Select the staged resumeAll direction:
dependency input/readiness bookkeeping at input processing, effective local invalidation/hooks
on the accepted generated-result timeline, and cache/replay/committed-version/downstream effects
at FIFO publication. Drain must not fire local hooks again. Preserve generated DATA occurrence
order, effective/no-value invalidation and latest-run registrations, no automatic async fencing,
and terminal/lifecycle ownership. No implementation/API or normative edit is authorized.

**Decisions — minimal representation recommendation, NOT selected.** Keep published cache and
hasData as their existing output-commit facts. The one output queue owner needs only effective
presence after the accepted generated tail, not a second payload cache. It is derivable by
folding the normalized pending output over committed presence: DATA -> present, effective
INVALIDATE -> absent, RESOLVED -> unchanged. Recommend an O(1) tail-presence summary on the
existing owned pending-output/drain record, allocated/used while output is held, instead of
repeated queue scans or a second full result state. It is a cached queue summary with a precise
recomputable invariant, not an independently toggled node status or a version/async-job counter.
Exact TS field spelling/layout remains design work.

When no pending output exists and no local transition is being applied, derive from published
presence. On accepting valid output, update the tail summary consistently with the queue record
before invoking local invalidation callbacks. Generated DATA arms presence even if not yet
published; an INVALIDATE only transitions true->false once; another INVALIDATE without DATA is
no-op under existing balance rules. DATA later can re-arm. Acceptance includes normal payload/
exclusivity/tier validation and applicable batch commit; merely enqueueing an observer request
or provisional batch intent must not trigger irreversible hooks or mutate this accepted summary.
Batch rollback before acceptance discards tentative work without an invalidation callback.

Table from an initially absent output, with a consistently live current-run invalidation hook:
DATA20 -> tail present/hook0; INVALIDATE -> absent/hook1; INVALIDATE -> absent/hook1; DATA30 ->
present/hook1; INVALIDATE -> absent/hook2. Drain applies the retained publication entries without
hook3/4. This makes no-value INVALIDATE idempotence apply to the selected generated timeline,
even when published presence is still absent. Output postlude must still balance actual DIRTY
where no effective INVALIDATE publication is available; a no-op is not authority to wedge it.

Drain consumes publication effects only. Committing an older queue head must not overwrite
tail presence with that intermediate cache state. Existing single drain owner/remaining cursor
can keep this invariant while re-pause/new output is handled. Once all work is committed, tail
presence equals current published presence and its optional summary can retire. Ordinary close
or terminal drop retires the queue/summary; public cache retention/terminal staleness and plain
state intrinsic rebase retain their already selected separate policies. Restore never invents
pending output from this summary; unsupported held-output checkpoints still reject. No new
summary checkpoint field or retained old-lifecycle state is proposed.

**Hook attempts/failure recommendation.** Establish this effective invalidation and its pending
publication before calling user hook code, then attempt the applicable current hook registrations
in order, preserving independent failures for the operation owner. Reentrant INVALIDATE cannot
see the old populated local state and repeat the same event's hooks. A hook failure does not
restore the logical value, withdraw its already accepted publication, skip independent callbacks,
retry cleanup or automatically emit protocol ERROR; finalize applicable state/queue work and
report under the selected sync-caller/host-entry rules. Lifecycle changes still cancel old owned
publication by their normal authority, not because cleanup threw. Draining never repeats hooks
or tries to complete failed external cleanup retroactively.

Keep per-run hook replacement. For reusable onInvalidate registrations, distinguish one attempt
per effective invalidation event from permanent removal of the registration: another accepted
DATA and then a genuinely new invalidation can invoke the then-current registrations again.
An onDeactivation cleanup remains once per retiring lifetime. Earlier blanket "consume cleanup
registration before invocation" wording needs this event-versus-lifetime qualification for
onInvalidate; the pending callback ATTEMPT of this event is consumed before user code. It must
not silently turn onInvalidate into a one-shot hook that stops flushing later source emissions.
This clarification is presented for user review, not claimed unambiguously selected earlier.

Alternatives: scan all queued arrays on every acceptance (same semantics, potentially quadratic
backlog work); keep a full production cache (unnecessary payload/state duplication); or decide
effectiveness solely from published hasData (wrong for queued DATA+INVALIDATE). Prefer the small
queue-owned recomputable summary plus separately staged fixed acceptance/publication paths.
No per-entry hookFired flag is required merely to record that the publication path does not own
hook execution. Failure aggregation and exact reentrant admission implementation still need
qualification rather than a silent broad catch around raw fn.

**Work/evidence.** Read current ValueState/ControlState, nodeInvalidate's guard/clear/hook/send
and accepted cleanup once/registration-order/reentrancy rules. Current pauseBuffer is Wave[];
no queue-tail presence or selected staged invalidation path exists. Its hook loop is not
failure-isolated, so the proposal is not current implementation behavior. No new test/probe,
model run, runtime/API/schema/rules/formal/conformance/jsonl/owner ledger/D#, commit or push.
Only existing session note updated. Await choice on minimal summary and repeatable invalidation
attempt semantics before advancing remaining QA-27 replay/quiet/diamond topics.

### QA-27 queue-tail and hook failure scheme accepted; cleanup/batch/lifecycle review (2026-11-02)

**Rules — acceptance.** User agrees to the minimal queue-tail summary and hook-failure scheme,
requests compatibility review then next item if clear. Select a recomputable tail-presence
summary owned by pending-output/drain state rather than a second payload cache; state-before-
callback, one attempt per effective invalidation event, reusable current-run onInvalidate
registrations, independent hook attempts and operation-owned errors. Drain only publishes;
deactivation remains once per retiring lifetime. No runtime/authority implementation grant.

**Decisions — combined checks, no additional policy fork found within this scope.**
- Batch remains outside acceptance of provisional outputs. Precommit rollback does not run hooks
  or alter accepted output-tail state. Successful commit normalizes the node's accumulated array
  by the selected tier/occurrence rules, then applies local acceptance effects once and either
  publishes or hands to resumeAll. A batch with separate DATA20/INVALIDATE/DATA30 submissions
  normalizes DATA20,DATA30,INVALIDATE; it does not replay provisional hook transitions in author
  order. Postcommit hook error is reported after applicable work, not treated as precommit body
  rollback. Already accepted independent observer requests survive rollback and execute later
  under their own ownership; ambient batch presence cannot change their fate.
- Preserve existing per-node/per-wave INVALIDATE dedup/cascade rules and normal duplicate-
  INVALIDATE normalization. Tail presence is not a replacement for wave identity or permission
  to flush once per diamond path. Once a logical invalidation event is accepted, mark it applied
  before hooks and attempt its current registrations without reentry/retry of that event. A new
  accepted DATA plus a distinct lawful invalidation can re-arm the current-run registrations;
  a new fn invocation still replaces registrations per the selected per-run policy.
- Hook failure does not restore value, erase the accepted publication or prevent independent
  cleanup. Operation-local aggregation avoids feeding cleanup failure into a sugar broad catch
  as fn/business ERROR. Hook-origin graph requests retain the already selected origin/admission/
  FIFO rules; first request may not mutate the current output array mid-delivery. No new global
  cleanup transaction or async hook waiting. Invalid ctx/lifecycle guards retain authority.
- Commit/drop of output entries changes the one owner's head/cursor/summary consistently. A
  replayed head cannot overwrite the accepted tail; re-pause retains remaining entries. Terminal
  or actual close discards old owned pending publication/summary, with no reversal of already
  performed hooks. Public terminal cache/staleness, plain-state intrinsic last-off rebase and
  actual compute RAM clear remain their existing policies. Node-scoped pause locks are not
  implicitly cleared merely because old output queue storage retires. New activation/eligible
  fresh execution initializes from its actual retained output facts, never old queue metadata.
- Permanent release remains preflight/quiescent and cannot silently flush/drop a live held
  buffer. Restore does not reconstruct unsupported pending output or serialize a new tail flag:
  it rejects that checkpoint under the selected gate. Supported restore reinstalls committed
  cache and distinct ended-input receipts; resource reattach alone does not manufacture events.
  Fn replacement does not cancel already accepted output just because pending old reattach
  belongs to a replaced computation registration. Input facts, private state, output queue and
  diagnostic history keep their separate owners.

**Work/evidence.** Cross-read accepted QA-18 batch/observer request fate, current batch commit/
rollback, nodeDown batch-before-pause paths, queue drain, invalidate hook and ordinary deactivate,
per-run hook and narrow cleanup reads, prior terminal/release/restore decisions. Current batch
still replaces staged waves with last-value coalescing and hook paths remain bundled; these do
not implement the selected contracts. No new test/probe/model run; no runtime/spec/formal/
conformance/schema/jsonl/owner ledger/D#, commit or push changes. Only this review note updated.
Actual stage/identity/error-route qualification remains work; this scoped consistency check
does not assert all combined runtime invariants verified. Advance to replay subscription policy.

### QA-27 replay opening: quiet precedence and dependency initialization (2026-11-02; proposed)

**Rules/history.** R-push-subscribe@1 is activated; R-replay-buffer@1 lacks activated_by. September18
user explicitly selected pull-mode subscription START only even with populated replayBuffer;
that precedence is already accepted and is not a newly open choice. Selected START arrays
identify initialization, ordinary complete-array membership keeps that snapshot disjoint from
live fanout, and restoration of already-processed logical state is not fresh recomputation.

**Decisions — recommendation for ordinary replay, NOT selected this turn.** For a non-pull node
with explicitly configured replay history, deliver its retained DATA entries in order in the
new subscription's START initial array; equal entries remain distinct. Do not append current
cache a second time when it is already the ring's last entry. If an actual output DIRTY is
outstanding, preserve the initial snapshot's trailing DIRTY after its retained DATA sequence.
When no history entries are retained, use the selected ordinary cache/absence initial path.
Do not leak resumeAll's generated-but-uncommitted output into history: append replay only on
normal output publication and clear it on the applied published INVALIDATE, not on the earlier
local cleanup. Terminal admission still follows its own rules and is not bypassed for replay.

Apply this same explicitly chosen history to an ordinary new dependency subscription as to an
ordinary external subscription. No automatic internal-subscriber "latest only" exception. A new
map dependency receives e.g. historical20,30 in one START snapshot and can map both to40,60;
raw initialization is processed as one full array subject to gates, while map's callback is
per DATA occurrence. Replay is initial input for the newly acquired subscription, not another
live emission by the source: source revisions do not advance on replay, but actual new derived
output still follows ordinary DATA/version rules. Do not promise exactly-once algorithm effects
across independent resubscriptions/private persist; a helper needing live-only processing must
use the selected initial/live distinction rather than global equality/revision suppression.

PULL nodes still give START only on subscription, regardless of populated replay/cached value;
PULL is not specified to dump replay history automatically. Unchanged restored consumers keep
their saved processed basis and must not re-apply history as if ordinary cold initialization;
this is the already-selected restore distinction, not a new internal-vs-external replay shortcut.
Replay history checkpoint representation/eligibility and ring ordering under rare retained
snapshot rebases require their own qualification: current format does not save the ring. Do not
claim saving only latest cache restores arbitrary configured history or silently select a codec
expansion here. Remaining QA-27 diamond mixed-time and message grammar topics stay open.

Alternative: distinguish external observers from internal dependencies and replay only to the
former. That reduces re-derivation but adds a subscription-role exception and changes existing
ordinary data movement. Prefer uniform explicitly configured replay with START initialization
roles and the existing quiet/restore exceptions; default cache-only remains for no replay config.

**Work/evidence.** Inspected nodeSubscribeOwned's replay-first branch (currently bypasses pull
guard), output DATA replay insertion and invalidate replay clearing, and depWaves/depLiveWaves/
depLiveBatch in ctx/types.ts. map currently loops depBatch values. Current callback delivery is
still per message, so no candidate claim of one raw init invocation from that implementation.
A guessed ctx/readers.ts path was absent; reader definitions are in ctx/types.ts. Earlier saved
September18 pull/replay source probe is historical evidence, not rerun. No new probe/test or
runtime/API/normative authority/codec/jsonl/D#/commit/push changes. Existing note only. Present
ordinary replay/dependency policy for selection before resolving remaining replay support cases.

### QA-27 ordinary replay accepted; checkpoint history roundtrip and minimal representation proposal (2026-11-02)

**Rules — acceptance.** User agrees and asks to continue. Select uniform explicitly configured
ordinary replay for new external and dependency subscriptions, preserving initial START array,
DATA order/equal occurrences and no extra duplicate latest cache. Replay does not advance source
revision or masquerade as new live source emission. Actual output notification supplies trailing
DIRTY when owed. Prior quiet-PULL subscription START-only and already-processed restored consumer
baseline remain distinct accepted exceptions. No new implementation/authority authorization.

**Material current checkpoint gap — actual baseline probe.** New diagnostic
protocol-reconciliation-probes/replay-checkpoint-roundtrip.ts uses real Graph/state/restoreGraph,
retains a source while emitting20,20,30 with replayBuffer3, serializes the checkpoint as JSON, then
restores with a custom state descriptor explicitly preserving replayBuffer3. Before snapshot a
new ordinary subscriber receives[20,20,30]; after restore it receives[30]. Exit0/DONE1 verifies
history loss even when capacity is restored correctly. This is current-runtime evidence, not a
test of a new codec/whole-array implementation. No timers/network/external resources; temporary
subscriptions and keepalive are released. Current checkpoint also lacks the capacity, and the
built-in state restore descriptor does not reapply it; the custom descriptor isolates history
loss from that independent configuration omission.

**Decisions — recommendation, NOT selected.** Treat retained configured replay as bounded logical
output state, rather than reconstructible runtime resources. Propose optional node checkpoint
data, illustrative shape replay:{capacity:N,values:[oldest,...,newest]}. Save capacity even if the
positive-capacity history is currently empty; list length cannot infer configured capacity and
latest cache cannot reconstruct20/20/30. Omit for disabled replay. Preserve all retained values,
including equal values, in logical order; do not serialize physical ring head/slots, timestamps,
per-entry revision IDs, callback functions or a full event log. Existing per-node latest cache
remains separately represented; no cross-field compression is needed for this minimal scheme.

Capture uses the same admitted consistent checkpoint boundary. Save only actually committed
replay entries; resumeAll pending output/accepted local cleanup is not replay history and is
still unsupported checkpoint work. Existing strict-JSON validation applies to EVERY retained
entry, not merely current cache; an unrepresentable older retained entry rejects capture rather
than silently disappearing. Validate capacity/list bounds and internal value/history consistency
under the codec contract. Registry/configuration must reconstruct matching replay behavior from
that canonical captured configuration, not silently override it with a different factory default.
Exact field name/schema revision and registrar integration remain implementation/API design.

At restore commit, reinstall capacity and retained ordered history without running fn, emitting
DATA, advancing source revision or creating a new replay occurrence. A genuinely new ordinary
subscriber can then obtain the same retained initial values as before capture, subject to normal
terminal/pull admission. Already-restored downstream consumers must not re-fold the ring as a
new cold history: preserve their processed initialization basis. Quiet PULL still sends START
only; preserving history does not require a PULL to dump it or promise a demand ACK. Subsequent
live DATA updates the bounded window normally. Restore is not ordinary last-off/fresh reset;
this does not select new replay lifetime retention for those distinct transitions.

Non-authoritative collection helpers remain subordinate to graphrefly:D160 backend authority.
Do not restore their arbitrary stale cached/replay payloads as authoritative merely because a
generic replay field is added. Combinations whose logical history is not represented by a
supported contributor/descriptor still need honest rejection/explicit qualification. No automatic
event-log replay, private-state reexecution, old ctx recovery or expanded async support is claimed.
Until the format/runtime actually supports required history/configuration, use the accepted
unsupported-checkpoint gate rather than describing current cache-only restore as full replay
recovery. This is recommended work, not an implemented guard.

Alternatives: save latest cache only (changes observable replay); reject all configured replay
captures (honest but gives up an already bounded JSON-representable state); or save physical ring/
event provenance (unnecessary data/portability cost). Prefer capacity plus ordered retained values.
Payload storage/serialization cost is O(N) in configured retained history and explicit at opt-in;
no additional unbounded history or node-level flags are introduced.

**Work/evidence.** Read GraphCheckpointNode/_checkpointNode, checkpointStateOfNode, nodeRestoreState
(unconditionally empties replayRing), restore PreparedRuntime and built-in state descriptor,
and replay option initialization. Ran new diagnostic from TS7a26 with node_modules/.bin/tsx at
HEAD dafc5ae57d446a59a7388214c31bd7a6e73d1519: exit0, before[20,20,30],after[30], matching capacity3,
DONE1. No candidate field/restore implementation or conformance proof. Only existing session
note and diagnostic added; runtime tree unchanged. No normative rules/formal/conformance/jsonl/
owner ledger/D#, commit or push. Await approval of bounded replay checkpoint representation;
replay/stale/rebase and resumeAll diamond policy remain following QA-27 topics.

### QA-27 user asks whether saving last wave/all existing buffers is sufficient (2026-11-03)

**Rules/review scope.** User annotates the replay roundtrip conclusion and asks whether saving
the previous wave or all buffers (including resumeAll) would suffice. Treat as a checkpoint
coverage/design question, not acceptance of the preceding replay field shape, authorization
to enable arbitrary in-progress recovery, or a request for a new event history. Preserve the
accepted no-silent-loss eligibility policy and logical-state/resource reconstruction boundary.

**Decisions — clarification and recommendation, not a new selected schema.** Yes to a unified
model that captures existing owned serializable logical state, including required buffer content,
rather than inventing independent history for each discovered case. The proposed replay data
would export the existing replayRing and capacity; it is not a second runtime history. Existing
checkpoint already saves cache, terminal, selected lifecycle facts and all ctx.state. Replay is
one demonstrated missing piece of that representation, not a claim latest cache plus replay
alone represents the whole graph.

Last wave alone cannot reconstruct bounded replay: histories20,20,30 and10,20,30 have the same
last DATA30 but different late-subscriber input. Saving all MESSAGE VALUES alone also cannot
distinguish equal buffers with different pause locks/demand/admission/terminal/input scope.
Save the actual remaining normalized arrays/order for a supported pending-output recovery,
plus the existing control/owner/progress facts that decide their fate. Prefer storing only the
remaining work at a valid capture boundary over both full consumed queue and a redundant cursor.
Queue field/owner can already identify publication-versus-input role; do not add per-message
metadata merely to restate the container's meaning. Current processed private algorithm state
and retained dependency input can outlive all message buffers, so buffers do not replace them.

Example: public cache10 with pending DATA20,INVALIDATE,DATA30 may already have performed local
invalidation cleanup and computed new private state. Restore would need those committed/local
logical facts plus remaining PUBLICATION entries; replaying them as fresh input/ctx.down work
could run hooks or algorithms again. The already selected staged invalidation queue is meant
to preserve that role; no extra hookFired flag is automatically needed. Tail-presence summary
can be derived from the captured cache/pending queue instead of stored independently if the
normalization invariant holds. Likewise recreate new subscriptions/ctx/cleanup registrations
and external resources through factories/reattach, not by serializing closure addresses.

Proposed overall coverage discipline: enumerate existing owner facts once as saved logical state,
derivable summaries, reconstructed runtime resources, or unsupported recovery states. Support a
buffer category only when its contents AND replay/continuation meaning can be restored together.
Pure replay has no uncommitted delivery obligation and is a bounded straightforward addition;
resumeAll pending delivery needs pause identity/mode/lifetime/entry-stage rules as well. A full
external in-flight request is not recovered merely by saving its empty/current buffers; it needs
an explicit source recovery contract or rejection. Do not manufacture a global event log,
per-event revision history or generic async-task tracker as a conclusion from this question.

**Work/evidence.** Re-read current ValueState/DepBookkeeping/ControlState/BoundaryState and
GraphCheckpointNode, current replay roundtrip receipt and accepted unsupported in-progress
capture boundary. No new probe/test/run or runtime/schema/rules/formal/conformance/jsonl/owner
ledger/D#, commit or push. Only existing session note updated. Replay field schema and broader
pending-buffer recovery are still proposals; user has not selected expansion simply by asking
whether existing buffers are sufficient.

### Unified checkpoint state/buffer coverage audit (2026-11-03; design review, no runtime changes)

**Rules — request and review boundary.** User agrees to a unified inventory of existing state
and buffers, classifying what must be saved, derived or reconstructed while minimizing new
state. This authorizes this review and bounded diagnostics, not implementation, activation of
rules, a new durable ledger record or blanket support for previously unsupported checkpoints.
graphrefly:D83/D117 preserve represented logical state/first-run history and avoid recomputation
on restore alone; graphrefly:D160 keeps backend contents in their collection owner rather than
ctx.state. R-restore@1/R-rom-ram@1 remain unactivated historical texts. Prior accepted refusal
of unsupported known obligations stays in force until each recovery category is implemented.

**Inventory scope and notation.** Inspected TS7a26 HEAD
dafc5ae57d446a59a7388214c31bd7a6e73d1519. Source inventory enumerated all 66 field declarations
across 12 owner records in packages/ts/src/node/core.ts: DepBookkeeping12, ValueState6,
VersionState2, WaveState8, ControlState7, PrivateState2, CleanupHooks2, SyncCtxState1,
LifecycleState2, BoundaryTask3, BoundaryState2, NodeSlot19. Also examined the Node wrapper,
NodeCore storage, graph registry/inspection, active batch/boundary queues, construction owners,
descriptor/backend capture and restore. NodeState's grouped references are aliases to these
owners, not another snapshot of their values. This is TS source coverage plus protocol-facing
recommendations; it is not a Rust/Python storage inventory or proof of a future codec.

S = logically save when the checkpoint claims to support that category; D = derive/reset from
canonical supported facts at restore; R = recreate using existing factories/acquisition/reattach;
G = reject capture while present until the corresponding continuation has an implemented contract.
S+G does not mean the current runtime already supports it. Current format is much narrower.

**Decisions — complete node-owner classification (recommendations, not a selected new schema).**

| Existing owner fields | Classification | Minimum canonical representation / reason |
| --- | --- | --- |
| ValueState.cache, ValueState.hasData | S + D | Save one tagged value/absence using existing GraphCheckpointValue. Runtime hasData derives from the tag; no duplicate serialized boolean required. Retained cache is the committed output snapshot. |
| ValueState.status | D | Rebuild public empty/ready/stale, output and lifecycle projection; do not store both legacy scalar status and a new status object as independent authorities. A known unsettled-cache fact that cannot be derived from other saved work MUST be represented once with output state; terminal cannot reconstruct lost prior staleness. |
| ValueState.terminal | S | Keep one COMPLETE/ERROR/none record including supported ERROR payload; derive output.completed/errored from it. No duplicate completed/errored flags. |
| ValueState.hasTorndown | D / qualify | Current supported boundary resets this implementation guard; terminal/current topology describe the retained outcome. Do not add an ever-torndown history merely to copy it. Any future teardown semantic not reconstructible from those facts needs explicit logical representation, not inference from a stale boolean. |
| ValueState.replayRing | S | Save the existing bounded committed replay sequence, in oldest-to-newest logical order and including equal values. No ring head/physical slots/event IDs; source replay is not new DATA on restore. Current format omits it. |
| VersionState.value | S | Keep required baseline evidence and selected optional hash metadata. Proposed revision/valueRevision are not the current DATA-only counter implementation. Do not reset historical evidence used for freshness or add an independent last-wave log to replace it. |
| VersionState.policy | S + R | Preserve serializable policy in one restore configuration; rebind registered hash code in the target. Do not serialize hash closures. Exact always-on/exposure/hash/counter policy remains previously open design. |
| DepBookkeeping.prev, DepBookkeeping.hasData, DepBookkeeping.terminal | S / verified derivation | Preserve the consumer's actual retained input view where current upstream snapshot is insufficient. Use one dependency receipt representation, not separate live-input and ended-input tables. Reuse source checkpoint data only when source revision/scope/presence prove correspondence; otherwise retain required local value explicitly under an approved format or reject. Current source mismatch guard remains selected for unsupported old executions. |
| DepBookkeeping.waveData, DepBookkeeping.waveLive, DepBookkeeping.terminalInput | S+G | For future pending-input recovery, keep remaining unconsumed per-dep projected waves/order, initial/live origin and unconsumed terminal input. Empty [] versus [[]] and SENTINEL markers have meaning; reuse tagged absence codecs rather than silently JSON-dropping them. Consumed terminal status is not the same as terminalInput. Current unsupported-pending gate remains. |
| DepBookkeeping.batch | D | It is a flattened/summary input view; derive from canonical remaining waveData rather than save a second copy of all DATA. |
| DepBookkeeping.dirty | S+G | A dependency's actual unsettled notification membership cannot be inferred merely from value absence or public status. Future continuation saves canonical membership once; it is not a counter of DIRTY prefix occurrences. Current unsupported unsettled work rejects. |
| DepBookkeeping.tier | D / ephemeral | Scheduling summary for current projection, not another history; derive needed meaning from saved normalized input/terminal records. Do not use it to infer terminal receipt from a current upstream snapshot. |
| DepBookkeeping.waveTokens | D / R | Delivery object identity is transient. Capture at complete-array boundaries; saved remaining groups/origin carry necessary logical boundaries. Rebuild local grouping tokens only if needed; no new public/global wave ID. In-flight partial delivery rejects. |
| DepBookkeeping.unsubs, DepBookkeeping.idxBoxes | R | Reacquire actual subscriptions, releases and index-routing records from restored logical connections. Retained final input has no continuing source lease. No function or old array-index identity serialization. |
| WaveState.pending | D | Count canonical unresolved dirty dependency membership, not an additional saved authority. Keep O(1) runtime counter if useful with the invariant pending=count(dirty). |
| WaveState.hasCalledFnOnce | S | Existing irreducible logical first-invocation history. Cache absence, partial flag or resource inactivity cannot recover it. Restore must not re-arm a completed first gate. |
| WaveState.emittedDirtyThisWave | split D / S+G | The implementation mixes a temporary run guard with actual published DIRTY debt. Reset temporary run bookkeeping; retain real unresolved output notification in its one output owner when supporting continuation. Do not derive notification from stale/empty or keep two competing dirty flags. Current such execution rejects until supported. |
| WaveState.emittedSettleThisWave | D | Per-invocation postlude guard; restore no suspended JS invocation. Do not serialize it as completed work proof. |
| WaveState.insideRunWave, WaveState.inDepMutation | G then D | Capture during invocation/mutation rejects. Valid restore begins with no executing fn/mutation, so reset guards. No continuation-stack or program-counter capture. |
| WaveState.rewireRunPending | D / S+G | If it only summarizes pending canonical topology/input work, derive it; if an admitted unrepresented owed invocation remains, that obligation must be represented or capture rejected. Never discard the work because this one flag is false. |
| WaveState.batchDirtyOwed | G then D | An open/committing batch is not a supported capture point. After a legitimate finished boundary no unrepresented rollback-balance flag should remain. Future batch transaction recovery is not selected here. |
| ControlState.pauseLockset | S+G | Save actual node-owned lock identities/mode semantics when recovery is supported. Do not serialize a second paused boolean. Strings/stable registry bindings can be portable; Symbol.description is not identity. Current lock-bearing captures need rejection until target release/binding semantics are supported. |
| ControlState.pausedDepWaveOccurred | D | Derive a wakeup summary from actual owed activation/input work; preserve work rather than an ambiguous boolean that loses occurrences. |
| ControlState.pauseBuffer | S+G | For future resumeAll recovery save remaining accepted publication arrays and FIFO order, not consumed prefixes. Container role means publish-only; it must not rerun local INVALIDATE hooks, fn or intrinsic state assignments. Source owner/lifetime/pause identity must be recoverable. Current generic pending-output recovery remains unsupported. |
| ControlState.demandOwed | S+G | One latest owed PullDemand with params and exact holder binding when supporting it; no historical request queue or new idempotency ledger. Current demand-bearing captures reject. Inactive discarded PULL is not an owed demand to save. |
| ControlState.activePull, ControlState.inDeliverDemand | G then D | Active service is a running invocation/entry, not another pending PULL. Reject capture while executing and restore no active service context. |
| ControlState.pullDirtyOwed | D / S+G | Temporary demand-output intent derives from restored admitted demand/notification rules. If a true unresolved output notification survives, save that canonical output debt, not a second boolean here. |
| PrivateState.value, PrivateState.persist | S | Reuse ALL supported ctx.state snapshot plus existing retention setting, including persist:false. Persist controls later normal lifecycle transitions, not whether checkpoint saves the value. Non-JSON resources/closures cannot be silently stripped. |
| CleanupHooks.onDeactivation, CleanupHooks.onInvalidate | R | Re-register functions through descriptor/reattach/current fn rules, with fresh cleanup read views. Do not serialize closures or rerun already-applied invalidation cleanup from publication queues. Resource-owning factory lacking reconstruction cannot claim full recovery. |
| SyncCtxState.value | R | New invocation/lifecycle ctx and immutable input views; do not serialize or revive stashed ctx identity. The selected uniform sync/async view contract is not current sync-ctx reuse behavior. |
| LifecycleState.subscribers | R | External subscribers and exact releases are new acquisitions; internal leases follow actual restored topology/owner recipes. No subscriber count/callback set can stand in for logical first-run/input state. |
| LifecycleState.activated | R + preserve logical basis | Actual resource activation is rebuilt, not copied to true without resources. Preserve logical evaluation/input history separately; restore is not a fresh logical run. Held logical execution/roots need an explicit reconstruction recipe or rejection, not invented ownership. |
| BoundaryTask.apply, BoundaryTask.isReady, BoundaryTask.batchToken | G / future S+R | Current closures/predicates/frame identity are not serializable. Future supported queues need existing operation kind/data, exact targets/owner and deterministic fixed handlers; do not stringify functions. Empty queue requires no new machinery. |
| BoundaryState.queue, BoundaryState.head | S+G + D | Save only remaining supported logical tasks/order; head can restart at0. Current boundary closures/rewire fn bodies are unsupported; accepted queued work must reject capture until portable intent representation exists. |
| NodeSlot.id | R | Physical NodeCore slot index is target-local; use captured logical node IDs/topology for relationships. No old core array/free-list serialization. |
| NodeSlot.deps | S + R | Save ordered actual declarative topology using existing deps/mount data; restore registrations/connections with fresh internal identity, preserving logical references. Do not add a second graph edge authority. |
| NodeSlot.handle | R | Named factory/definition resolves a new dispatcher handle; old pool/handle addresses are not durable identity. Anonymous/local-only behavior fails cross-process restore honestly. |
| NodeSlot.pool | S + R | Behavioral pool intent/required registered implementation belongs in restore recipe; numeric dispatcher pool address is target-local. Async label alone does not recreate a running task. |
| NodeSlot.dispatcher, NodeSlot.environment | R | Inject target dispatcher/drivers/reporter via existing environment and restore options. Do not persist host connections or reporter functions. |
| NodeSlot.partial, NodeSlot.terminalAsRealInput, NodeSlot.completeWhenDepsComplete, NodeSlot.errorWhenDepsError | S + R | Preserve effective behavior through one factory/config recipe, validating its reconstructed policy. Do not save both legacy booleans and selected grouped terminal API as competing truths. Current built-in descriptors do not generically retain caller overrides. |
| NodeSlot.resubscribable, NodeSlot.resetOnTeardown, NodeSlot.pausable, NodeSlot.dynamic | S + R | Effective behavior is not derivable from last cache; restore recipe must reproduce it or capture/restore must reject unsupported overrides. Reuse config/registry path rather than one new state flag per checkpoint feature. |
| NodeSlot.pull, NodeSlot.pullLock | S + R | Derive pull enabled from the one configured holder identity; rebind portable identities consistently between holder/demanders. Do not store enabled and key as independent authorities or serialize a raw Symbol by description. |
| NodeSlot.replayN | S | Capacity is existing behavior configuration, not inferable from current ring length. Store once, either in canonical replay record or its owning restore config; do not duplicate both without a consistency rule. Current representation location is not yet locked. |
| NodeSlot.name, NodeSlot.factory | S + R | Reuse existing logical ID/name/factory reference/config metadata, rebuild physical registrations. A display name is not an execution/connection epoch. |

**Cross-owner inventory and minimization.**

| Existing or already-selected concern | Classification and minimum approach |
| --- | --- |
| Stable applied plain-state value versus published cache | S separately when they can differ. QA-4 already selected two facts; current StateNode.set simply calls down and has not implemented that separation. A terminal can discard buffered publication while applied state remains ahead of its sealed cache, so absence of pauseBuffer does not prove the two equal. Capture the state owner's value once; do not invent a second intrinsic value for every compute node. Public accessor/INVALIDATE details remain separately qualified. |
| Cache unsettled/stale reason, actual notification debt | S when irreducible; D when exactly proven by other saved work. Ready/stale after quiet no-output or terminal cannot always be reconstructed from value, terminal, pending count or queues. Reuse the canonical output fact selected in the status review instead of multiple isStale/isWaiting/isDirty/public status copies. |
| Received input revision and end-of-input scope | S / safe source reference. Extend the same actual dependency record for live as well as ended input; do not create a separate ended-input registry. New diagnostic below proves the ended-only scope is insufficient. |
| Normalized pending input projections | S+G; wave boundaries/origin/terminal input are canonical. Flattened batch, pending count and grouping object identities derive/rebuild. Pending recovery may preserve typed absence using existing codecs; no need retain the entire last source wave after it has been consumed. |
| Pending publication and queue-tail presence summary | Remaining publication arrays S+G; tail presence D by folding cache plus remaining output. Do not persist a second payload cache or hookFired flag. Local private state already reflects completed cleanup; restoration publishes remaining effects only. |
| Logical restore baseline/init action, _restoredActivationPending | R/D from captured processed input evidence and descriptor recipe. Do not save an extra wasRestored boolean. Pending resource reattach must not erase saved logical inputs; restoring resource identity alone never increments result revision. Unsupported unrepresented owed logical initialization must still reject. |
| Lifecycle identity/phase and _released | New runtime identity R; source execution scope represented by logical records, not serialized JS tokens. Capturing closing/invoking/fanout rejects; retired nodes remain absent from live topology. Do not mark active without resources or restore a permanent retired ctx. |
| NodeCore arrays, nextId and Node wrapper owner aliases | R from newly constructed live nodes; source memory addresses and slot arrays are not protocol state. No NodeCore dump alongside per-node records. |
| Active batch order/deferred/commit/rollback state | G at capture; actual stable boundary first. Do not serialize the active callback/stack/frame as a generic resumable transaction. Finished normalized outputs follow normal per-node handling. |
| Shared selected observer/output/control request FIFO | S+G if future portable recovery is defined; preserve operation/owner/target/order and batch fate. Current selected all-request FIFO is not fully implemented; the existing NodeCore boundary queue is not evidence every kind is captured. No opaque closure serialization. |
| Source/algorithm data held only in JS closures | Cannot be generically inferred. Move necessary data into existing ctx.state or an explicit factory-owned contributor/recipe when implementing that source's checkpoint support; otherwise reject its unsupported state. Timers, iterator positions, dedup state, external IDs/deadlines may be logical facts even if absent from core buffers. No generic async task registry is required by this finding. |
| Collection backend and derived helper cache | S through existing collection-owned backend contributor/restore descriptor (D160); do not mirror collection contents in ctx.state or restore unqualified helper cache/replay as authority. Large/reference-backed data needs its declared recovery contract. |
| External requests, timers, sockets, streams, cancellation functions | R only through a source/resource recipe that can reconstruct required behavior; arbitrary in-flight process state is G. Payload buffer alone does not recover remote completion/side effects. No automatic retry/restart/duplicate effect is authorized. |
| Graph live IDs/topology/config/name/mounts | S through existing checkpoint/descriptor structure; rebuild entries/byId, owner WeakMaps, physical mount forwarders and live connection records. Exact same topology is not proof matching factory behavior, so validate both. |
| Graph _seq, _synthSeq, _synthIds, _retiredIds | Allocation/retired logical name constraints can affect later graph operations. Rebuild object-to-live-ID maps from topology; preserve existing allocation watermarks/retired-ID constraints if claiming continuation of the same logical namespace, rather than a second registry. Current format omits them. Fresh target physical identity does not itself decide the logical namespace policy; proposed preservation needs selection, not an unstated epoch system. |
| Graph _clock, _topologyObserverSeq | The observable monotonic sequence and target callback-registration counter have different roles. Preserve existing sequence position if continuation promises cursor continuity; callback IDs rebuild. Exact fresh observation-session versus continued sequence contract needs explicit selection; do not infer it from node revision. No new event history/stream epoch is selected in this inventory. |
| Graph _topologyObservers, mounted forwarders, observation subscriptions | R from target subscribers/environment; do not serialize callbacks. _topologyDelivering/queued fanout are G during capture; don't replay inspection events as protocol input. |
| Dispatcher fn table, pool/free lists, profiling maps | R from registry and target pool setup. Profiles/historical counters are optional external diagnostics, not algorithm restart facts. No automatic history retention or prior handle-number reuse. |
| ConstructionScope cold journal/phase and OwnedConstruction roots | Cold/starting/closing in-flight acquisition G. Published domain facts stay in existing graph/private owners; resource manifests/root ownership need explicit descriptor/owner reconstruction or an unsupported classification. Do not declare a started logical instance fully restored with its keepalive/resource owner missing. Reuse existing finite acquisition/cleanup paths rather than a new general transaction manager. |
| Capability-issued tables and raw host references | Recreate valid target-issued references through their declared owner; never encode pointer addresses or accidentally transfer old ctx/host operation authority. Supported stable logical references use existing registry/config bindings. |
| Operation error aggregate, reporter invocation, retired residual resource diagnostics | Current operation aggregation finishes outside capture; no default persisted error history. Actual outstanding resource ownership remains its owner's recovery responsibility, not proof resource release succeeded. Do not introduce a global cleanup-failure checkpoint blockade merely to persist diagnostics. |

**New actual counterexample — a live PULL input also needs receipt state.** Added
protocol-reconciliation-probes/restore-live-pull-input.ts. Real source10 -> quiet holder A;
A plus other2 feed a partial sum D. After a PULL, D has A10 and cache12; A is NOT terminal and
no pending output/demand remains. Capture and restore with matching explicit pullId/partial
factory options. D initially exposes restored cache12, but its seeded A input becomes absent
because nodeSeedRestoredDepAt deliberately excludes pull cache. other2->3 yields originalD13,
restoredD3. Exit0/DONE1. Both subscriptions released; no timers/network/external resources.
This proves current per-node-only snapshots lose a nonterminal received input too; it does not
test a new receipt codec. Thus the minimal proposed record should be the existing dependency
input view/receipt, with optional terminal information, rather than a second ended-only table.
Where received value matches a validated source revision/scope, reuse that source snapshot;
absence must remain explicit even if the source has cache. Different old source executions
still follow the accepted rejection boundary unless their value/scope is explicitly represented.

**Minimal integration recommendation — not a new checkpoint engine.** Keep the current graph
capture/prepare/construct/commit path, registry descriptors and backend contributors. Extend the
one node capture/restore representation for missing logical facts; do not serialize NodeCore
and per-node state in parallel. Keep four conceptual content groups (not mandatory new public
objects): definition/topology/config; owner values and retained inputs; committed output/replay/
version; remaining supported logical obligations. Derive summaries and create resources through
the existing mechanisms. Capacity/control policy must have one canonical config location, not
dispersed duplicate toggles. An old-wave log is unnecessary once its effects are in private
state/retained input/output; only unconsumed work and explicitly configured replay remain.

For implementation staging, first support already representable stable snapshots with complete
definition/value/input/replay coverage and a read-only owner-based eligibility gate. Pause locks,
pending input/publication, owed demand and closure-based deferred tasks are classified S+G,
not silently dropped or automatically enabled by this inventory. Adding each continuation needs
its capture/restore/admission identity rules and qualification. No new goal, automatic waiting,
forced RESUME/PULL, job tracker, generic history store or new public status flag is selected.
This preserves the user's desired unified audit without claiming all buffers are now restorable.

**Material choices surfaced, not autonomously locked.** Generalizing compact dependency receipts
to relevant LIVE inputs is necessary for the proposed minimal correctness envelope (actual probe).
Stable state versus sealed output may need separate persisted values (accepted semantics, not
yet current implementation). Restore definition/config coverage cannot rely on default opts.
Same logical graph name retirement/allocation and observation sequence continuity need a stated
scope before filling their schema. This inventory recommends preserving observable logical facts
through existing owners rather than adding new runtime histories, but leaves those schema/policy
selections explicit. Arbitrary host-object aliasing, Symbol identity, source closures and external
in-flight effects are not made portable by copying JSON buffers; use supported logical IDs/
codecs/recipes or honest rejection, not a generic heap/continuation serializer.

**Work/evidence and source stops.** Reads included node/core.ts (all 66 fields), node/types.ts,
node/node.ts, node-runtime-host.ts, runtime-accessors.ts, node-input/output/lifecycle/checkpoint
paths; graph/graph.ts/checkpoint.ts/restore.ts/graph-support.ts/environment/graph-lifecycle/
construction-scope/inspect; batch/batch.ts/boundary.ts; dispatcher/index.ts; relevant source,
operator, collection and accepted session records. Resolved graphrefly:D83/D117/D160 authority;
kept activated rules versus draft metadata distinct. Current state set only delegates to down;
current checkpoint lacks replay/input/control/namespace coverage, and restore resets many such
owners. Existing replay and ended-input actual probes remain relevant without rerun.

New live PULL diagnostic run from unchanged TS7a26 via node_modules/.bin/tsx: exit0,
originalInput10/restoredInputSENTINEL, originalAfterOther3=13/restoredAfterOther3=3, DONE1. No full
test suite or model run: runtime unchanged and no candidate serializer implemented. Source-field
enumeration was read-only. Only this session note and the diagnostic changed; no runtime/API/
normative Rules/formal/conformance/jsonl/owner ledger/D#, commit or push edits. The user gets a
reviewable minimal coverage proposal; new choices remain recommendations pending selection.

Audit completion receipt: a read-only source-to-note coverage check matched all 66/66 actual
owner.field names to the inventory (DONE). This checks enumeration coverage only. The single
live-PULL counterexample was executed twice with identical exit0/DONE1 results; these are two
runs of one case, not two independent cases or candidate restore validation.

### Graph restore namespace/observation metadata review (2026-11-03; proposed)

**Rules — accepted inventory and new question.** User agrees to the unified classification and
explicitly asks which naming watermarks, retired IDs and observation sequence should survive
restore versus be rebuilt, reusing current state. Record acceptance of the inventory categories,
including relevant live dependency receipts and no opaque runtime-buffer dump; exact metadata
policy/schema remains this next choice. No runtime/spec implementation is authorized. Governing
history: graphrefly:D26/D39 make seq graph-local ordering; D51 has stable synthetic IDs with a
separate allocator; D83 preserves represented logical state without fresh-lifecycle reset;
D122/D145/D152/D153 retire graph-owned names and keep one graph registry. Prior scope did not
explicitly settle cross-restore namespace/clock continuity, so present a new recommendation.

**Decisions — recommended minimal policy, NOT selected.** A restore continues the captured
logical graph namespace and its observation numbering, while constructing new runtime objects.
Save the three existing next-position counters and existing retirement set, with no new epoch,
allocator manager, full allocation history or observer event log:

| Existing graph state | Recommended treatment | Reason |
| --- | --- | --- |
| _seq | Save/restore exact next auto-name position | Scanning live names loses consumed/released positions and can change the next observable generated ID. Do not fill old holes. |
| _synthSeq | Save/restore exact next synthetic-name position | Old discovered objects can disappear without remaining in live topology; latest live IDs do not retain the allocation frontier. Keep separate from normal naming. |
| _retiredIds | Save/restore the existing exact local set | Released explicit names cannot be reconstructed from live topology or a maximum numeric suffix. Preserve no-reuse behavior; do not create an additional all-ever-observed-name registry. |
| _clock | Save/restore the next observation sequence | The next emitted ObserveEvent/TopologyEvent continues after the captured position using the existing shared graph-local counter. No historical event replay or acknowledgement guarantee follows. |
| _entries, _byId, _synthIds | Rebuild from saved logical IDs/topology and new objects | Do not serialize Map/WeakMap keys or a second registry. Retain assigned live IDs; target object identity is fresh. Respect ordinary/synthetic allocation roles rather than changing watermarks as an artifact of reconstruction. |
| _topologyObserverSeq, _topologyObservers and unsubscribe handles | Rebuild/reset from target subscriptions | Registration IDs are runtime-local, not public logical sequence IDs. Old callback/release identity does not cross restore. |
| _topologyDelivering, _topologyQueue | Require an eligible settled capture boundary | No mid-fanout continuation or replay of half-delivered inspection events. They are not durable graph-state history. |

Persist NEXT counters, not last-used values, and validate nonnegative safe positions and logical
namespace consistency. Reuse the current graph checkpoint envelope for graph-owned metadata;
do not put it in node ctx.state/backendState or allocate extra runtime flags. Capture metadata
after the existing live-topology/synthetic-ID discovery has assigned IDs, at the same valid
capture boundary, so that the checkpoint's watermark covers its own saved IDs. No DATA/result
revision or user fn is generated just because inspection assigned a stable identity.

During restore, prepare/validate metadata and live/retired namespace constraints, construct the
saved topology with its saved IDs, then install captured watermarks/clock at the restore commit
before exposing normal operations. Temporary constructor counter increments or registry bootstrap
events do not count as new logical allocations/observation records; do not substitute their
intermediate counters for the saved next positions. No externally visible node-registered/DATA
stream replay is manufactured to rebuild the counter. An older format lacking this necessary
metadata cannot silently promise the same namespace/sequence continuation; explicit support
limits/migration belong to the eventual schema change, with no compatibility shim assumed.

Each mounted graph retains its own counters and local retired names inside its existing nested
checkpoint. Do not merge child/root allocators or retired sets. Rebuild mounted observation
forwarders normally; the existing parent and child sequence owners remain distinct. Restoring
one checkpoint twice creates two independent runtime graph domains which can allocate the same
next logical ID/seq in their separate namespaces. These counters are not global uniqueness,
cross-instance event dedup or external cursor acknowledgement. External recorders distinguish
the graph occurrences they attach to; no new mandatory global epoch is selected.

Observation initialization is still a NEW observation: START/cache/replay delivered to a new
observer uses new seq values from the restored next position, even if it carries old cache
content. That does not advance source revision or make the payload a new source DATA occurrence.
Gaps remain legal; the shared clock orders actual observation/topology records, not durable
execution counts. Installing the saved _clock itself does not emit anything or replay missed
events; diagnostics/history storage remains external under prior agreement.

Alternatives: reconstruct watermarks from current live IDs (incomplete); reset clock and add a
mandatory observation-session epoch (coherent but adds a concept to every consumer); retain
all allocation/event history (unnecessary). Prefer preserving the existing small counters/set
and reconstructing object indexes, matching logical checkpoint continuity with minimum runtime
state. This is a schema/policy proposal, not a claim all older restore history already required it.

**Work/evidence — actual baseline case.** Added
protocol-reconciliation-probes/restore-graph-namespace-sequence.ts. Real graph creates state#0,
creates/releases state#1 as a topology group, observes state#0 (seq0,1), captures and restores
through built-in state descriptors. Original rejects explicit reuse of state#1 and next auto
node is state#2; restored next auto node is state#1. Next observation is original seq2,3 versus
restored seq0,1. Exit0/DONE1 demonstrates current metadata omission and observable difference,
not a violation verdict for a previously activated cross-restore clock rule, nor a test of the
new proposal. Observation subscriptions released; no timers/network/external resources. One
exec invocation yielded session32601, polled once to successful completion; no background run remains.

Read graph counter declarations, registration/addWithId, retirement/availability checks,
synthetic-ID assignment in describe/checkpoint/topology, observe/observeTopology and mounted
forwarding, ObserveEvent/TopologyEvent seq documentation, current checkpoint/restore omission,
and qualified governing decisions. Runtime HEAD/tree unchanged. Only existing session note and
new diagnostic changed; no implementation/schema/rules/formal/conformance/jsonl/owner ledger/D#,
commit or push changes. Await user choice before treating graph metadata continuity as selected.

### Graph namespace continuity accepted; replay consistency and remaining diamond boundary (2026-11-03)

**Rules — user acceptance and compatibility review.** User accepts the preceding proposal and
requests a check against restore, naming and observation rules before advancing. Record the
selection: preserve graph-local next _seq, next _synthSeq, next _clock and exact _retiredIds;
rebuild object indexes, observer registrations and forwarding resources. This is an accepted
design direction, not an implemented checkpoint schema or activated rule amendment. No new
epoch, global name registry or observation history is selected.

Retirement constraints must protect the restore CONSTRUCTION phase too: validate saved live IDs
against retired IDs before invoking descriptors, and apply the captured no-reuse constraints to
registrations during construction. Installing the retirement set only after factories run would
leave a reuse window. At final restore commit install the captured NEXT counters/clock, removing
bootstrap construction increments rather than treating reconstruction as new logical activity.
This uses existing prepare/construct/commit ownership; exact implementation stays pending.
Capture synthetic discovery before watermarks; preserve separate ordinary/synthetic allocator
roles and parent/child graph domains. Validate inconsistent namespace metadata rather than repair
it by silently increasing a counter. Existing allocation collision checks remain necessary.

New observers consume fresh observation seq values for START/cache/replay, without advancing
source revision or re-emitting source DATA. Preserving _clock neither acknowledges external
records nor replays history; separate restores may share logical next values in separate runtime
domains. These checks expose no additional semantic choice for namespace continuity. Current
runtime omissions remain implementation work, not resolved by this note.

**Decisions — replay/stale compatibility check.** Ordinary configured replay remains retained
committed DATA oldest-first in one START initial array, with trailing DIRTY only when actual
published dirty debt exists. Public stale alone is not an instruction to invent DIRTY. No extra
copy of latest cache is appended. A local invalidation may already have cleaned resources while
published replay/cache remain unchanged until its FIFO publication boundary. A normal lifecycle
close follows the already-reviewed replay reset and state silent-rebase rules: a silent intrinsic
rebase is not a new replay DATA occurrence. Checkpoint restore preserves supported logical replay
and is not an ordinary fresh lifecycle. Quiet PULL remains START-only. No additional retention
policy or stale-history special case is selected by this check.

**Rules — next QA-27 question, not yet resolved.** Activated R-two-phase@1 requires dirty
propagation before settlement and R-diamond@1 says D recomputes exactly once after changed deps
settle in the same wave. Accepted resumeAll retains complete output arrays FIFO while unrelated
branches may advance. The remaining question is the scope of the diamond guarantee when those
arrays are deliberately delayed: normal same-wave consistency does not by itself specify
historical cross-branch correlation after buffered publication. Do not use current behavior alone
to declare the rule question resolved; eventual rule reconciliation must make this scope explicit.

Concrete trace (separate host calls, no batch):

    S=1 -> B=S*10=10, C=S*100=100 -> D=B+C=110
    PAUSE C (resumeAll)
    S=2 -> B=20; C generated200 is buffered; D waits
    S=3 -> B=30; C generated300 is buffered; D still waits
    RESUME C -> publish200, then300
    D receives (B30,C200) ->230, then (B30,C300) ->330

**Decisions — recommendation, NOT selected.** Preserve explicit FIFO arrays and the ordinary
latest-retained-input join. Resumed C publications are distinct delivery waves; do not claim that
C200 comes with a retained B20 snapshot. The 230 intermediate result is an observable consequence
of delaying one branch, not evidence that source S ever had a value yielding that pair. Diamond
glitch freedom within a coordinated propagation is not an automatic temporal join across a
pause boundary. This scope needs explicit wording in the later rule reconciliation.

Benefits: preserves DATA occurrences, existing per-dependency retained inputs and buffer ownership;
no global origin IDs, branch-history store, historical rollback or additional synchronization gate.
Cost: branch-local backlog can produce mixed-time combinations. Alternatives have real semantic
costs: keep only newest buffered output (loses selected FIFO occurrences); retain matching history
on every branch (adds correlation/storage/retention policy); hold the entire relevant computation
or explicitly join user-provided keys (intentional application/composition policy). Pausing D's
output alone would only buffer already-computed mixed pairs; it would not fix pairing. No automatic
drop, equality suppression or extra batching is proposed. Applications requiring each historical
pair must express correlation; latest-only consumers can explicitly gate the expensive join's
invocation using the already-selected default PAUSE policy, accepting their value-level semantics.

**Work/evidence.** Added protocol-reconciliation-probes/resumeall-diamond-mixed-time.ts and ran
once via pnpm exec tsx from TS checkout HEAD dafc5ae57d446a59a7388214c31bd7a6e73d1519.
Exit0/DONE1: actual invocation pairs [[10,100],[30,200],[30,300]], DATA [110,230,330], with no D
DATA during C pause. This is current-runtime diagnostic evidence, not a candidate whole-array
delivery or amended diamond-rule conformance test. One command yielded session20702 and one poll
completed it. Subscription released; no timers/network/external resources or background run.
Reviewed activated diamond/two-phase wording, control tests, graph allocation/retirement/clock
sites, restore construction and preceding replay rules. A zsh filename glob found no matching
pause test and one guessed control source path was absent; actual tests were located with rg and
used instead. Only this session note and bounded diagnostic changed; runtime, JSONL, rules,
formal/conformance, ledgers, D#, checkpoint schema, commits and pushes remain untouched.

### QA-27 mixed-time join accepted; old resumeAll backlog versus batch ownership gap (2026-11-03)

**Rules — acceptance and scoped checks.** User accepts the latest-retained-input/FIFO recommendation
for a single paused diamond branch and asks for compatibility with DIRTY, batch and pause before
advancing. Record that choice: resumed publications are distinct waves outside batch, may combine
with another branch's newer retained input, and provide no automatic historical correlation.
This refines the intended scope of R-diamond@1/R-two-phase@1; normative/formal/conformance
reconciliation remains pending. It does not approve any new batching/backlog ownership rule.

QA-9 already selects one DIRTY prefix on each published DATA/RESOLVED array, per-dependency
idempotent dirty membership, one membership release per complete settlement array, and an internal
prepass before value processing. The first replayed array can clear outstanding membership;
the next array creates a fresh interval. No count of early/prefix DIRTYs or debt per buffered entry
is introduced. A prefix is not a task/result identity and promises no historical pairing.
resumeAll still evaluates and holds output, default PAUSE still gates new fn invocations without
holding already-started results. Reentrant controls wait for safe boundaries; an observer PAUSE
between replay arrays stops the next array, without truncating the current one. Mixed-time
semantics do not authorize insertion into another active wave or bypass pending input gates.
Terminal/close still have the selected cancellation/drop authority, without historical repair.

**Rules — real remaining batch composition gap, not closed.** R-wave-boundary@1 and accepted
QA-18 accumulate same-node explicit batch submissions into one normalized wave. All admitted
DATA occurrences survive; incoming DATA/RESOLVED conflicts reject rather than overwrite. The
already accepted resumeAll FIFO stores separate previously accepted waves, which may validly
alternate DATA and RESOLVED. Applying RESUME from an explicit host batch currently feeds that
old queue through the ambient batch path. Naively applying the selected accumulator would turn
two valid old waves into an invalid new mixed settlement:

    prior to batch: C holds W1=[DATA200], W2=[RESOLVED]
    batch(() => C.up(RESUME))
    naive combined commit: DIRTY,DATA200,RESOLVED  // forbidden

Keeping only the last wave loses DATA; dropping RESOLVED reinterprets an explicit authored
settlement; rejecting an incoming conflicting old entry is not a complete resource/queue policy.
Rollback must not erase output accepted before this batch, nor may the drain remove entries merely
because provisional batch staging succeeded. This is not resolved by idempotent dirty membership
or by the accepted mixed-time join choice. QA-18's manual-submission rejection remains selected;
the gap concerns involuntary enlistment of already accepted publication continuations.

**Decisions — recommendation, NOT selected.** Treat pre-existing resumeAll publication backlog
as owned continuation, not newly authored batch contents. A RESUME applied within an open host
batch releases its matching lock under existing control rules, but enables the normal boundary
drain only AFTER that batch's commit/rollback and resulting propagation complete. Retain the old
arrays and their FIFO boundaries. Reuse existing batch boundary readiness plus the existing
output/drain owner, rather than copying old entries into the batch or adding a second queue,
wave history, async task, per-entry ACK or new public flag.

Only actual publication consumes old queue entries. Ordinary batch body rollback does not erase
old accepted output; eventual terminal/close can still discard it under the established policy.
Recheck actual locks/lifecycle/output eligibility when the continuation becomes runnable. A later
PAUSE can prevent drain; observer-origin RESUME already waits outside the enclosing batch under
QA-18 and needs no separate special timing. Preserve normal queue ordering and between-array
observer boundaries; no priority leap over earlier admitted requests is selected. Existing
old-buffer-before-new-output ownership still applies: newly accepted output cannot bypass old
pending publication merely because the last pause lock was removed. A successful batch may
produce new output that queues behind the older entries; an uncommitted batch rollback drops
only its own provisional output. Terminal retains its previously selected bypass/drop exception.

Benefits: preserves old occurrences, exclusive wave grammar, rollback ownership and FIFO; no
historical joining or transactional replay bookkeeping. Cost: wrapping RESUME in batch cannot
collapse old FIFO replay into one historical/latest-only commit; its publications occur after
the batch outcome. Alternatives: reject host RESUME in a batch with any old backlog (simpler
prohibition but reduces composition), or enlist backlog transactionally (requires rollback/cursor
restoration and still needs an explicit incompatible DATA/RESOLVED policy). Prefer deferred
continuation using existing owners. Obtain user choice before using this to close the batch gap
or advance the remaining QA-27 handshake wording.

**Work/evidence.** Read nodeDown's batch-before-pause staging, nodeOnResume's old-buffer loop,
batch.ts's active frame/commit/rollback, accepted QA-6/9/18 and initial START-array recognition.
Added protocol-reconciliation-probes/resumeall-existing-backlog-inside-batch.ts, one run with two
finite cases at unchanged TS HEAD dafc5ae57d446a59a7388214c31bd7a6e73d1519; exit0/DONE2.
Both begin with held arrays [[DATA200],[RESOLVED]]. Outside batch, DATA observations [100,200]
and cache200; inside batch, observations [100] and cache100: current Map.set last-write coalescing
discards DATA200. This confirms the actual enlistment path/current loss, not implementation of
the selected occurrence accumulator or the proposed deferred drain. No candidate conformance
claim. Subscriptions released; no timers/network/external resources or remaining run. One guessed
batch/index.ts read failed; actual batch/batch.ts was discovered with rg and inspected. Only
this session note and diagnostic changed; no runtime/schema/normative/formal/conformance/JSONL/
owner-ledger/D#/commit/push mutation. The new batch ownership recommendation remains open.

### QA-27 batch-independent backlog accepted; lifecycle checks and START ownership clarification (2026-11-03)

**Rules — acceptance.** User accepts the preceding deferred-backlog recommendation and requests
compatibility review with batch, pause and lifecycle before advancing. Select old accepted output
as lifecycle-owned publication continuation: host RESUME in an open batch may release its lock,
but old queue publication waits until the batch outcome/propagation completes and retains FIFO
array boundaries. This does not enlist old output in the batch's accumulator or rollback. Current
runtime and activated rule texts still require the previously identified reconciliation work.

**Decisions — compatibility checks, no additional policy fork found in this bounded review.**
- Existing batchToken cancellation is ownership, not mere scheduling provenance. The old drain
  continuation must NOT acquire the open batch's rollback-cancellable token just because RESUME
  enabled it inside that body. It uses normal boundary readiness to wait. Explicit batch-owned
  ctx tasks retain their original commit fate; independent observer requests retain theirs. This
  is reuse of existing ownership/readiness distinctions, not one new task type or flag per cause.
- Nested admitted host batches share the outer frame, so wait for the outer outcome, not inner
  return. A body rollback drops only provisional batch output; any rollback DIRTY balancing and
  applicable propagation finish before old backlog drains. A completed commit followed by observer/
  cleanup failure remains a commit. Finish eligible independent continuation and report under the
  existing operation-error policy; no rollback of already published arrays or blanket retry.
- Releasing the final lock does not make old entries fresh input to the batch. New committed output
  queues behind them under the existing one-owner/FIFO policy; rejected/uncommitted submissions
  never enter that accepted queue. Admission-time invalidation effects are not rerun during drain.
  The existing pending-output owner preserves staleness even after the lock is gone. No new public
  paused/draining/waiting status, second payload cache or extra settlement debt is selected.
- Recheck actual pause locks before starting each array. RESUME followed by PAUSE in the body can
  leave publication blocked; repeated/unknown RESUME starts no duplicate runner. Observer controls
  preserve their independently queued order after the enclosing outcome and between replay arrays.
  An already delivered current array finishes valid fanout before re-pause stops the next array.
  Equivalent attempts to drain the same old queue through another internal control path cannot
  bypass its batch boundary readiness; this does not change PULL's separately selected admission/
  parameter/quiet policy or invent demand from RESUME.
- The continuation is bound to the old lifecycle. Terminal still drops eligible held publication
  under the selected bypass policy; ordinary close/last-owner-off discards the retiring lifecycle's
  remaining queue. Later activation does not revive its drain. Node-owned locks and intrinsic state
  retain their separate lifetime rules, so clearing the old queue does not clear those facts. Fresh
  activation while an old boundary closure is still queued cannot give that closure authority.
  Permanent release and checkpoint keep their existing quiescence/unsupported-pending-state gates.

These are consequences of the accepted ownership boundary, not a promise the current boundary
scheduler already enforces them. No generic transaction over controls, resource cleanup or side
effects is introduced. No new trace-specific semantic choice was found beyond implementation/
qualification obligations already recorded.

**Rules — next QA-27 item, START handshake wording.** Activated R-push-subscribe@1 makes START the
first subscription delivery and prohibits forwarding it through intermediate nodes. The already
accepted START-array recognition review explicitly makes initial arrays subscription-owned and
activation output separate live arrays. The early sentence "a depless promise source ... first
sends START" was ambiguous about owner; corrected it in place above, preserving this reason here.
It does not mean raw setup must down(START), START triggers fn, or source activation itself is a
DATA/result obligation. This is reconciliation with an already selected contract, not a new lock.

    subscribe to a cold source
      -> subscription runtime delivers [[START]] to that registration
      -> eligible source fn/setup runs (or remains gated by pre-existing default PAUSE)
      -> later ctx.down([[DATA,23],[COMPLETE]]) is a separate live result array
      -> normal live DIRTY prefix yields [[DIRTY],[DATA,23],[COMPLETE]]

For sync sources, the same split applies even when result publication occurs before subscribe
returns. Later independent registrations get their own initial snapshot/START; an idempotent alias
of an existing callback registration gets no duplicate START. Cached/replay/trailing actual DIRTY,
quiet PULL, deferred acquisition and terminal admission remain their existing paths. No source-wide
started bit, source-authored handshake or artificial DIRTY/RESOLVED at setup return is needed.
No new choice about invalid authored START error mechanics is made here; earlier no-forged-initial-
role contract remains for implementation. This closes the identified wording ambiguity, not all
runtime/formal/conformance gaps or every outstanding reconciliation qualification.

**Work/evidence.** Read batch/boundary.ts's batchToken drop/readiness mechanics, batch.ts outcome
logic, nodePauseRelease/nodeOnResume, lifecycle close/release and accepted QA-6/9/18/21 policies.
Located actual subscription START in node.ts (a guessed node-subscription-runtime.ts path was
absent), and read fromPromise/of source bodies: setup/results down DATA/terminal, not START.
No new probe/test was warranted for this note-only ownership/wording check; prior DONE2 baseline
backlog/batch cases remain evidence of current enlistment/loss, not candidate scheduling success.
TS working tree remains clean. Only the existing session note changed this turn; no runtime,
schema, normative rules, formal/conformance, JSONL, owner ledger, D#, commit or push edits.

### QA-27 START clarification accepted; coverage checkpoint and retained PULL service question (2026-11-03)

**Rules — acceptance and QA-27 scope.** User accepts the START ownership clarification and asks
whether QA-27 needs further decisions, otherwise proceed. START remains subscription-initializer
owned, not source-output authored; no artificial result debt merely from source setup. This is
accepted reconciliation with R-push-subscribe@1 and the selected START-array contract, not runtime
implementation. Check the imported eight-item QA-27 list against the reviewed directions:

| Original QA-27 concern | Selected design disposition |
| --- | --- |
| Fn-authored arrays versus synthesized terminal/RESOLVED | Explicit arrays remain separate outside batch; automatic terminal is a postlude; no redundant balancing RESOLVED before terminal settling the same obligation. Terminal-owning operators can author DATA+terminal together. |
| Tier order versus authored sequence | Stable tier normalization; preserve same-tier DATA occurrence order; clear-then-set uses separate calls outside batch. |
| resumeAll INVALIDATE timing | Local accepted invalidation/hooks before subsequent computation; public cache/replay/version/downstream publication FIFO; drain never repeats hooks. |
| One paused diamond leg | Latest-input join may combine a resumed old result with a newer other-branch input; no implicit historical pairing. |
| Quiet holder activation | Subscription alone creates neither demand nor automatic first holder evaluation; initial array is START only. Explicit admitted demand/readiness gates remain. |
| Replay to a dependency | Ordinary explicitly configured replay initializes new dependency as well as external subscriber; no internal latest-only shortcut. Already-restored processed consumers do not re-fold it. |
| Promise source START wording | Subscription runtime sends initial START; setup and live results are separate, including synchronous setup/results. |
| Replay plus stale cache | Retained committed DATA in order, no redundant cache copy, trailing actual published DIRTY; local pending status alone cannot invent notification. |

The additional old-backlog-in-batch gap has also received explicit acceptance: old publication
continuation waits for outer batch outcome and is not a rollback-cancelled batch submission.
No additional material choice was found WITHIN THIS QA-27 LIST. This is design coverage, not all
27 findings globally closed, precise checkpoint/API codec finalized, or rule/model/runtime tests
passing. Normative revisions, runtime changes, source-bound scenarios (including mixed-time and
rollback/re-pause/lifecycle traces) and authored invalid-handshake admission mechanics remain work.

**Rules — next retained question, still open.** The imported QA Decisions section and its October12
reconciliation explicitly retain resumeAll backlog versus parameterized PULL service. September18
contains a user correction removing a second demand invocation after buffer delivery, plus subsequent
recognition that empty buffers/new params can require actual service. Later lifetime acceptance
explicitly does NOT settle drain/service ordering. Do not treat it as closed by repetition of the
latest-demand slot, no-forced-DATA, quiet subscription or the new batch timing decision.

R-pull@1/R-pause-modes@1 still lack activated_by. graphrefly:D55 originally treats demand content
as latest/backlog; D269/D272 separate PULL from RESUME and install holder-visible demand context;
D278 deliberately invokes a serviceable accepted holder exactly once even without input change.
Current nodeFirePullDemand drains pauseBuffer then returns without invoking holder with new params.
This contract/revision question needs an explicit choice rather than a silent implementation fix.

**Decisions — recommendation, NOT selected.** Keep old buffered output and the latest owed demand
as separately owned facts. When a live holder has an admitted owed PULL and is otherwise eligible:
finish permitted old FIFO publication, then recheck lifecycle, terminal, actual locks, dependency
readiness and latest owed request before ONE holder invocation with ctx.pull. Keep that request owed
until actual admission of service, rather than consume it merely because an unrelated old array
was published. If output/lifecycle closes, existing close policy cancels the unserved demand; if
re-paused/not-ready, normal gates delay it. No owed PULL still means quiet RESUME, not a new service
or unconditional old-buffer release. Respect the selected outer-batch barrier for old publication.

Example: old buffer contains two results computed without the latest params; the latest pending
PULL asks {afterSeq:100,limit:1}. Publishing those older results cannot establish that this request
was interpreted. Invoke once with these params after old publication; the fn may emit DATA, emit
appropriate no-occurrence settlement if actually owed, or stay silent under existing rules. No
mandatory extra snapshot, request ACK, result tag, equality test or generic async tracker. Repeated
PULLs before service retain the existing one latest slot, not a historical demand queue.

This recommendation would replace the early drain-only shortcut for the owed-demand path. Benefit:
parameters cannot be silently skipped by existence of old output; uniform service meaning matches
D278. Cost: one additional holder call after backlog, which can produce a duplicate-valued DATA
occurrence. A helper wanting no extra output can implement that policy in its existing retained
state; substrate cannot infer from equality or inspect domain params that backlog answered a request.
Alternatives: blanket drain-only (may ignore new parameters), bifurcate no-params versus params
semantics (adds another protocol rule and guesses domain intent), or reject pull+resumeAll (narrows
an existing raw composition without solving it). Prefer uniform invocation, separating invocation
from output as D278 intended. User choice remains required; no new locked decision is recorded.

**Work/evidence.** Cross-read original QA-27 list and acceptance chain, September18 correction/
consumer audit, October12 demand-lifetime sections, current R-pull/R-pause-modes projection and
qualified root D55/D269/D272/D278 history. Inspected nodeFirePullDemand's drainedBuffer early return,
and current messaging/work-queue projection factories and messageBus page parameter types.
Real helpers use limit/cursor params, but stock factories still set pullId with no resumeAll override;
this is an existing raw-composition contract question, not a proven stock messaging/work-queue
regression. Earlier finite raw-mode diagnostic is historical evidence, not rerun this turn.
One guessed library/message-bus path was absent; rg located actual messaging/index.ts/types.ts.
No new probe/test or runtime edit. Only session note changed; no schema/normative rules/formal/
conformance/JSONL/ledger/D#/commit/push changes. QA-27 design list can advance; retained PULL
service-versus-backlog choice is now the explicit next cursor.

### Parameterized PULL after backlog accepted; compatibility check and D30 cancellation provenance (2026-11-03)

**Rules — acceptance.** User accepts the preceding uniform service recommendation and asks for
compatibility review. Select: old backlog does not fulfill latest demand merely by being published;
finish permitted old FIFO publication, then admit at most one holder invocation with latest owed
params under ordinary gates. No mandatory DATA/ACK/equality dedup. This explicitly replaces the
September18 drain-only-after-backlog direction for the admitted owed-demand path; preserve the
earlier no-demand/no-service and duplicate-valued-occurrence principles. R-pull/R-pause-modes
remain unactivated drafts and runtime early-return behavior remains unreconciled.

**Decisions — combined trace and boundaries, no new policy fork found in this scoped check.**
- Keep the existing latest owed slot during old publication. Do not capture A at drain entry and
  later invoke stale A after a newer B has actually applied. If W1's observer requests PULL B and
  PAUSE L, finish W1's valid propagation, apply eligible queued requests in issue order, retain B,
  and leave W2/service blocked. After matching RESUME, finish eligible W2 then use the current
  slot once. Only applied requests replace the slot; queue admission alone does not mutate it.
- ctx.pull/activePull belongs to the actual service invocation. Do not install new params while
  merely publishing old results or consume demand on entry to a long multi-array drain. At lawful
  invocation admission, transfer the slot to invocation context, clear the owed slot, and use the
  dispatcher/ordinary first-run, input-completeness, dependency-settlement and pause gates. No
  synthetic activation call just to service what the single normal invocation already handles.
- Ordinary observer-origin PULL during service is queued until its safe boundary, not dropped
  merely because the old inDeliverDemand guard is set on the stack. When it applies after service
  it is a fresh demand, subject to current lifetime/gates. Actual synchronous fn reentry and
  raw self-demand remain governed by their existing rejection/deferred-ctx policies. This does not
  add parallel service, a request FIFO or async completion tracking. Service fn return consumes
  its request even if it emits nothing; failures do not automatically retry that demand.
- No pending PULL still means quiet pull RESUME: releasing external locks alone neither grants
  demand nor flushes that quiet holder unconditionally. Subscription stays START-only. Inactive
  matching holder still drops PULL without activation/banking; actual lifetime close/reset cancels
  unserved demand. Merely losing one requester does not cancel while another owner retains the
  holder. Node-owned locks can survive close without carrying demand into the next lifetime.
- Terminal/close during backlog cancels remaining old publication and unserved demand under existing
  policies; no holder invocation after output sealing. Re-pause or newly dirty dependencies delay
  service instead of losing it. Observer exceptions alone do not cancel service or retry failed
  arrays; finish applicable work then report under the owning operation policy.
- An enclosing batch cannot merge old buffered waves or run that continuation between source
  commits. Old publication and its eligible follow-on service wait for outer outcome/propagation,
  using the existing old-lifetime continuation; a triggering batch's rollback cannot erase an
  earlier accepted demand/backlog. Explicit batch-owned new writes/tasks keep their selected fate;
  no generic rollback of applied control state is introduced. Check latest slot and actual locks
  again after the barrier rather than pre-clearing it. FIFO new-output ordering and callback
  boundaries remain; invocation does not replay local INVALIDATE hooks from old entries.

The existing control slot + invocation context + output/drain owner + lifecycle identity supply
the needed ownership facts. No added hasAsyncWork, demand-fulfilled flag, request IDs, output cause
tag or observer history. Current delivery helper clears demand too early and holds inDeliverDemand
through backlog, so implementation must separate these stages rather than merely delete its return.
Exact queue lowering and qualification remain work; static consistency is not conformance evidence.

**Rules — next closure item, D30 history.** The imported QA explicitly retained D30 cancellation
and ambiguous destroy wording. Root graphrefly:D30 says default no-cancel with {switch:true} opt-in
and AbortSignal via ctx. Current public Ctx/NodeOptions do not establish those generic substrate
options. Later accepted PAUSE, INVALIDATE, old-ctx fencing and helper cleanup distinguish external
cancellation from output/lifecycle authority. Root D65 uses destroy/unwire for protocol TEARDOWN;
D122/D124 define separate quiescent permanent graph/group release with retired IDs and no synthetic
terminal/TEARDOWN. Preserve history while identifying the exact obsolete promise, rather than
using "destroy" as a catch-all operation or silently treating old syntax as a supported API.

**Decisions — recommendation, NOT selected.** Keep D30's default no automatic cancellation, and
explicitly retire its generic {switch:true}/ctx-provided AbortSignal promise in final reconciliation.
Cancellation policy remains source/operator/helper-owned using its real resource/driver contract
and existing cleanup hooks. Lifecycle closure revokes old ctx output authority regardless of whether
external cancellation succeeds; INVALIDATE/default PAUSE alone do not universally cancel running
work. A helper may deliberately abort on its own switch/invalidation policy. Do not remove actual
per-language controller-bearing helper options merely because D30's generic core API is obsolete.

Use precise terms: terminal seals output; deactivation/closure retires an execution lifetime and
releases its acquired resources; TEARDOWN is the protocol destroy/unwire relay with its own terminal
rules; permanent release removes graph-owned registrations/retires names at a valid quiescent boundary;
external cancellation asks owned work to stop. No new destroy() API, phase enum or cancellation flag.
Shared upstream: removing one dependency lease cannot assume the shared source has closed; remaining
owners still have authority under their lifetime. Cleanup/driver policy decides resource cancellation.

This preserves the simpler agreed core and existing source/operator cancellation capabilities, at
the cost of no universal automatic cancellation knob. Do not alter D30's separate throw/error clause
under this cancellation-only cleanup; raw/business/operation error routing has its own review history.
No new normative supersession record is created until the user selects this precise disposition.

**Work/evidence.** Read control demand consumption/active context/early-return/reentry guards,
boundary/core queue ownership and selected paused-drain rules. Reviewed qualified root D30/D65/
D122/D124, earlier INVALIDATE probes and cleanup/lifecycle acceptance. Inspected public Ctx and
current helper cancellation references (RewireNext input-side cleanup; operator abortInFlight and
higher-order/time source composition). These are bounded source/history checks, not new behavior
tests. No new probe run or runtime change; only existing session note updated. No schema, normative
rules, formal/conformance, JSONL, owner ledger, D#, commit or push edits. PULL compatibility direction
is recorded; D30 cancellation/destroy terminology is the explicit next review cursor.

### D30 generic cancellation rationale challenge (2026-11-03; discussion, not accepted)

**Rules/review status.** User asks WHY retire the generic {switch:true}/ctx AbortSignal proposal.
This is a request for rationale, not acceptance or implementation authorization. Root D30 really
is a locked historical record: its rationale says cancellation as an async pool feature is least
surprise. No named supersession is being claimed as already admitted. Later accepted message-owned
async results, lifecycle-owned ctx revocation and PAUSE/INVALIDATE rules constrain the recommendation
but do not themselves erase that old record. Keep its cancellation-only replacement pending choice.

**Decisions — rationale and balanced alternatives.** Generic switch is convenient for repeated
search/fetch: new invocation can retire old work without each source author rewriting controller
management. Its value is real. However fn invocation is not a generic external-task boundary: a
source setup may start a long-lived listener; a raw invocation may start zero/one/multiple operations;
the async pool label is not an automatic work ledger. A meaningful switch:true must specify whether
it supersedes a prior invocation, all its external operations, its result authority, or the whole
node lifetime. New DATA/RESOLVED, INVALIDATE, PAUSE and close have already selected different effects.
The core cannot obtain one universal cancellation policy merely by supplying a signal.

AbortSignal itself is cooperative notification, not proof external work stopped or remote effects
were rolled back. Ignored/unsupported cancellation still needs an explicit late-result policy;
same-lifecycle per-invocation result fencing would be additional semantics, whereas current accepted
automatic fencing is on lifecycle close. Shared dependencies add another ownership distinction:
one consumer switching away releases its own lease, not permission to abort work kept by others.
Source/operator knows task boundaries, resource ownership, supported abort mechanism and whether
abort should be silent or observable under its contract; core context alone does not supply them.

Do not overstate cost: one AbortController bound ONLY to a node lifecycle is implementable without
a generic task tracker, and can coexist with existing cleanup. It would mean "this lifetime closed,"
not "previous invocation superseded," so it does not by itself implement D30's switch:true promise.
That narrower convenience could be reviewed if repeated source/driver code justifies it; no need
to prohibit future ctx conveniences or move all cancellation into handwritten application code.
Current helpers already offer source-specific mechanisms, so prefer policy there now and keep the
core's fixed authority boundary small. Tradeoff is less universal raw-node convenience and possible
helper boilerplate, rather than pretending removal has no ergonomic cost.

**Work/evidence.** Read complete root D30 including rationale; current Ctx type has no universal
signal field. Actual switchMap selects switch policy and inner dependency replacement; resource stop
depends on the inner source's cleanup and remaining owners. valve accepts abortInFlight controller/
factory and aborts on its defined control edge. fromPromise accepts an external signal, suppresses
later forwarding/listeners on cleanup, but receiving an already-created Promise does not grant it
the ability to cancel the underlying operation. Thus unsubscribe/result suppression and cancellation
must not be equated. Source-backed explanation only; no new probe/test. Only session note updated;
no runtime, normative/ledger/schema/formal/conformance/JSONL/D#/commit/push edits. Await the user's
assessment of this rationale; do not advance or treat retirement as approved from the question.

### Lifecycle ctx.signal preference versus historical switch:true (2026-11-03; clarification)

**Rules/review status.** User asks whether ctx.signal means AbortSignal, favors having that generic
facility, and requests a reminder of switch:true. Record preference for a lifecycle-bound common
signal direction, not approval of generic per-invocation switching, exact abort phase/order/reason,
eager allocation, public signature or runtime implementation. Current public Ctx has no such field.

**Decisions — distinction and recommendation.** Yes: proposed readonly ctx.signal would expose an
AbortSignal; lifecycle management owns its controller, fn/helper consumes the signal. Recommend one
signal per execution lifetime, shared by that lifetime's invocations; actual lifetime closing aborts
it, fresh activation receives a new signal. New DATA/RESOLVED, ordinary PAUSE/RESUME and INVALIDATE
do not by themselves abort that lifetime signal. Abort is cooperative notification, not proof work
stopped, automatic protocol ERROR or substitution for old-ctx authority fencing. Precise closing
ordering with cleanup/reentrant listeners remains to review before calling this a complete API.

Historical root D30 only records {switch:true} opt-in + AbortSignal via ctx; it does not fully specify
scope/triggers/late-result rules. Explain intended switch behavior as a conceptual latest-invocation
policy, not a recovered detailed contract: invocation A starts request A, invocation B supersedes
and requests cancellation of A while starting B. That needs per-invocation cancellation domains,
unlike the lifecycle signal which stays live through both calls. Already existing switchMap is an
operator choosing inner dependency replacement; it does not establish a generic NodeOptions flag.

Recommendation remains: offer the narrow common lifetime notification under its own explicit
contract, while leaving latest-request switching to explicit operator/helper policy. This revises
the previous all-or-nothing framing of D30 cancellation: accepting a lifecycle signal need not
accept a generic switch flag. User has not yet approved retiring switch:true merely by asking what
it means. Do not carry an aborted signal across restore/reactivation or serialize host controller
objects; those follow the already-selected rebuild-resource boundary if this direction is adopted.

**Work/evidence.** Re-read full root D30 and current Ctx/switchMap declaration; no detailed historical
switch flag contract or implemented universal ctx.signal found in those sources. Explanation and
session-note update only. No runtime/API/schema/rules/formal/conformance/JSONL/ledger/D#/commit/push
changes, and no new tests/probes. Keep this clarification at the current review cursor.

### ctx.signal notification direction and dynamicNode history check (2026-11-03)

**Rules/review scope.** User favors a common signal but asks whether it issues graph destroy/
terminate, and whether switch:true was originally for dynamic nodes. These are clarification
questions, not approval of new graph control APIs, exact abort ordering or generic switching.

**Decisions — recommended signal direction.** Proposed ctx.signal is read-only AbortSignal for
this node execution lifetime. Lifecycle management owns the AbortController. Runtime closing that
lifetime aborts it to notify the fn/helper's owned external work; fn cannot call signal.abort()
to command graph termination. Controller authority is not exposed by providing the signal. A graph
operation which actually closes member lifetimes could consequently trigger their respective signals;
the signal is not the graph control entry, and abort observation does not synthesize protocol ERROR,
COMPLETE or TEARDOWN. No graph-wide shared cancellation domain is selected. Users may explicitly
react to a notification using legal APIs, but that is their policy rather than signal's built-in
graph mutation. Actual node-close/ctx revocation/cleanup phase ordering remains for review.

**Decisions — historical evidence and term distinction.** Root DS-1 L4-Q10 explicitly calls
switch:true "switchMap semantics" plus AbortSignal; D30 places it under error/cancellation and
describes an async-pool feature. Neither record located says it was exclusively a dynamicNode
feature. Root D35, recorded the following day, defines dynamicNode as fixed declared superset plus
per-invocation track read-selection, explicitly distinct from dep-set rewire. Current dynamicNode
declaration preserves that read-selection meaning under later D49 occurrence semantics. Do not
infer that selecting a different dep automatically cancels the previously read shared source.

If user means dynamic switching of an inner source/task, that is a plausible USE CASE of the
switchMap semantics named by L4-Q10; it is not evidence that D30 was scoped to the API named
dynamicNode. Fixed topology can also require latest-request cancellation (search input changes),
and dynamic topology can intentionally keep multiple tasks (merge). Separate topology/read
selection, task replacement policy, and lifetime closure notification. No new historical intent is
invented beyond these inspected records; no generic switch disposition is yet accepted.

**Work/evidence.** Read root D30/D35 and DS-1 line3428; current dynamicNode declaration in
node.ts:821 describes fixed superset/track and distinguishes later D49 changes. Bounded search
of canonical session Markdown found the explicit switchMap wording but no located link making
switch:true dynamicNode-only; absence from this search is not proof of every past conversation's
intent. Only existing note updated; no runtime/normative/schema/formal/conformance/JSONL/ledger/D#/
commit/push changes or new tests/probes. Keep signal lifetime/timing design and switch policy separate.

### Lifecycle signal retained; close/abort/cleanup ordering proposal (2026-11-03)

**Rules — explicit selection and next scope.** User selects a common lifecycle ctx.signal and
operator/helper-owned switch policy, then asks for trigger and order relative to ctx revocation/
cleanup. Record those two selections. Generic {switch:true} is not retained as a core node option
in this direction; D30's cancellation half needs explicit later reconciliation. No implementation,
public signature, new graph shutdown method or normative-ledger mutation is authorized here.

Existing accepted constraints: closure revokes ctx driving/writes/new hooks/deferred authority;
cleanup uses its own restricted read view; dependency releases precede own cleanup registrations;
private-state finalization follows required retiring synchronous cleanup/unwind; no async waiting;
new lifetime cannot start inside old closing/unwind. Terminal automatic retirement waits until
the full terminal array's fanout/current-fn/commit unwind at its lawful boundary (QA-21), rather
than revoking ctx inside terminal down(). Abort must fit this sequence, not silently change it.

**Decisions — recommended order, NOT selected yet.** At actual lifecycle closure admission:

1. Enter existing closing phase and irrevocably withdraw old ordinary ctx operation authority;
   invalidate its unexecuted owned work. Do this before ANY new abort/cleanup callback. Repeat
   close requests cannot start a second close, second abort or duplicate cleanup pass.
2. Synchronously abort that lifetime's signal once, before releasing its dependency leases or
   running own cleanup hooks. State is already closing; the signal's aborted state is visible
   before abort listeners run. Do not defer abort to a microtask or await cooperative cancellation.
   Runtime owns controller; no task completion/ACK follows merely from abort returning.
3. Keep existing cleanup order: acquired dependency leases in dependency order, then own live
   onDeactivation registrations in registration order, plus wrapper-owned late-returned cleanup
   as already defined. Consume managed registrations before attempting them, attempt independent
   remaining cleanup after failures, and preserve original/aggregate operation reporting.
4. Finish required retiring synchronous unwind/late cleanup, then finalize nonpersist private
   state clearing versus persist retention and the selected output/input lifetime resets. Complete
   closing before admitting a new execution. No waiting for arbitrary async resource shutdown.
   Fresh activation owns a fresh nonaborted signal; old captured signal stays aborted forever.

Why this placement: abort-first-before-revocation lets synchronous listeners use live ctx during
retirement; cleanup-before-abort delays stop notification and lets cleanup observe a misleadingly
live signal. Chosen candidate marks closure facts/authority first, notifies promptly, then releases
resources deterministically. This adds a notification phase without changing managed cleanup's
existing relative order or adding closingFinished/cancelled/task flags.

Trigger means ACTUAL closure: last owner leaves, accepted automatic terminal retirement reaches
its close boundary, close-before-fresh-reset, or valid graph-owned permanent release/other existing
close path. COMPLETE/ERROR tuple reception/emission alone is not a separate early abort trigger.
A shared dependency's signal remains live while another owner keeps its lifetime open. Per-run
hook replacement, fn return/new invocation, PAUSE/RESUME/PULL, INVALIDATE and ordinary same-lifetime
rewire do not themselves abort this signal. They can have other already selected effects; if an
operation genuinely closes a removed source's last-owned lifetime, that source's close aborts its
own signal. Permanent graph/group release still obeys its quiescence/preflight contract.

Abort listener reentry receives no privileged ctx window: old down follows stale-output drop;
old mutation/control/new-hook operations reject; same-node fresh activation cannot start while
closing/unwinding. Legal independent graph requests use the existing origin/boundary policy, not
a special synchronous bypass. Listeners use captured resources; ordinary old ctx dynamic state
reads are not reenabled just because notification happens during closing. Managed cleanup retains
its existing cleanupView reads of registering input metadata/current retiring private state.

**Decisions — native AbortSignal error boundary, explicit qualification.** Standard abort dispatch
invokes listeners synchronously, but EventTarget listener exceptions are reported by the host rather
than reliably escaping controller.abort() to its caller. Node documents uncaught-exception reporting
on nextTick. Thus try/catch around abort() cannot promise collection of arbitrary third-party listener
errors into the library cleanup aggregate. Recommend native AbortSignal semantics, no custom signal,
global error interception or monkeypatched listener registry. Library-owned listener adapters must
contain/report their own errors under existing operation/host policy; user native listeners retain
native host behavior. Managed onDeactivation remains the ordered/collectable cleanup mechanism.
Abort notification does not synthesize protocol ERROR or silently count as successful cleanup.
No reason taxonomy, eager-versus-lazy controller allocation or per-language cancellation type is
selected in this timing proposal. Signal/controller resources rebuild across restore; no serialization.

**Work/evidence.** Read September26-29 accepted closing/revocation/cleanupView/retiring-state order,
QA-13 late-registration/unwind and QA-21 terminal-retirement precedence. Current TS nodeDeactivate
has no signal/controller or complete selected lifecycle guards: this is a proposal, not present code.
Verified native timing/idempotence through WHATWG DOM abort algorithms
(https://dom.spec.whatwg.org/#abortsignal-signal-abort) and Node EventTarget error handling
(https://nodejs.org/api/events.html#eventtarget-error-handling); no raw source article or secondary
library inference. Host here reports Node v24.18.0; no new native/runtime probe was executed.
Only session note updated; no runtime/API/schema/normative/formal/conformance/JSONL/owner-ledger/D#/
commit/push edits. Await user choice on this sequence and native-listener boundary before advancing.

### Signal close order/native errors accepted; lifecycle compatibility and minimal reason proposal (2026-11-03)

**Rules — acceptance.** User accepts revoke -> abort -> existing managed cleanup -> state
finalization ordering AND native abort-listener exception boundary; asks for cleanup/lifecycle/
reactivation compatibility review then next concern. Record the exact prior sequence as selected,
not runtime behavior. Common lifecycle signal plus helper/operator switching remains accepted;
controller allocation, accessor details and reason policy were not selected by that acceptance.

**Decisions — bounded compatibility check, no additional semantic conflict found.**
- Lifecycle signal does not reset at fn return or per-run hook replacement. Native listeners have
  native lifetime/removal behavior, not the managed onDeactivation registration replacement rule.
  Repeated fn invocations cannot silently remove prior signal consumers expecting actual lifecycle
  closure. Helpers registering repeatedly own once/removal discipline; no new runtime listener
  history or permanent managed-cleanup list is introduced.
- Abort notification does not consume a managed cleanup registration or prove its resource has
  closed. Managed cleanup still runs once per live registration in the selected order. A helper
  using both signal cancellation and cleanup for one resource must coordinate safe repeated
  cancel/close or separate responsibilities; no generic once-per-resource registry is promised.
- Closure during synchronous acquisition still revokes/aborts promptly. A wrapper-owned cleanup
  returned later runs once for that retiring lifecycle before state finalization/new activation;
  it observes the same already-aborted signal. New resource acquisition checks/abort-aware APIs
  must honor an already-aborted signal rather than expect a newly registered native listener to
  replay a past abort event. Resource ownership before cleanup handoff remains helper-owned.
- Native abort callbacks get no cleanupView privilege or renewed ctx rights. Managed cleanup
  still receives its own restricted read window; current retiring private state remains available
  there until required synchronous cleanup/unwind completes. Captured signal/resources are ordinary
  references, not permission to read/write future lifecycle data. Abort listener graph reentry
  follows existing closing/origin/admission policy; same-node activation waits for allowed later
  admission and cannot cross the old closing/unwind boundary. This review adds no queued restart.
- Terminal-driven close follows QA-21 safe array/current-invocation/commit precedence. Close/reset
  and permanent group release use existing ownership/quiescence checks; no abort during failed
  release preflight. Shared upstream signal aborts only when its own lifetime closes, not when one
  consumer dep lease ends. Repeated close/abort cannot restart cleanup or change the same signal.
- Reactivation gets a fresh nonaborted signal even if ctx.state.persist retains algorithm state.
  Retained resources containing an old signal must be deliberately rebuilt; persist does not turn
  a host cancellation object into reusable progress. Restore constructs a new runtime lifetime/
  signal and does not serialize controller/listeners/native signal through checkpoint. Supported
  resource reattach must use the target lifetime signal and handoff cleanup normally. Unsupported
  in-flight external work remains rejected/unrepresented as already selected; signal adds no resume.
- Native listener errors remain host-owned unless a library-owned adapter explicitly contains/
  reports its callback failure. They do not cancel independent managed cleanup, synthesize protocol
  ERROR, reopen a node or require a new fault history. Managed cleanup errors preserve existing
  attempt/aggregation/finalization policy; no waiting for listener-returned Promises or abort ACK.

No new public status or lifetime enum is needed for these consequences. The existing lifecycle
identity/phase remains authoritative for ctx permissions; native signal state reports cancellation
notification, not a duplicate lifecycle-state machine. This is static design compatibility within
the inspected traces, not runtime conformance or an exhaustive external-consumer claim.

**Decisions — next minimal reason recommendation, NOT selected.** Use native default abort reason
for core lifecycle close (controller.abort() with no custom reason, standard AbortError). Do not
introduce close-reason enum, copy protocol ERROR payload into signal.reason, or store a second
termination diagnostic solely for cancellation. All actual closure paths deliver the same stop
notification meaning; business/output failures and cleanup/operation failures keep their already
separate reporting owners. A helper may define a richer independent task-cancellation contract
using its own controller without changing the core lifecycle signal.

Benefits: standard host API, no new reason taxonomy/state or coupling between terminal payload and
resource cancellation; close after normal completion is not misrepresented as protocol ERROR.
Cost: signal.reason alone cannot tell last-off from terminal retirement/permanent release; use
existing output/inspection/external diagnostic context where needed. Do not promise every such
cause can be reconstructed from current node status after a later activation. Exact controller
allocation/accessor storage remains subsequent design/implementation work, not silently locked by
this reason proposal. This next choice stays pending user review.

**Work/evidence.** Cross-read accepted helper pre-handoff/late-return cleanup, retiring-invocation
guard, cleanupView/private-state finalization, QA-13, QA-21 terminal boundary and QA-22 resource
reattach. Prior inspected WHATWG abort algorithm sets default AbortError and ignores repeated
abort; native listener error boundary is the user-accepted host mechanism. No new test/probe needed
for the note-only compatibility review and reason proposal. Original job-pool/dependency-manager
consumer follow-up remains outstanding: initial scoped path search found no matching current
packages/ts/src directory, so no claim those original consumers were verified here. Only session
note updated; no runtime/API/schema/normative/formal/conformance/JSONL/ledger/D#/commit/push edits.

### Default AbortError accepted; minimal signal access and allocation proposal (2026-11-03)

**Rules — acceptance and owner boundary.** User agrees and continues after the default reason
proposal. Select native default AbortError for core lifecycle abort with no new reason taxonomy,
protocol ERROR payload reuse or cancellation-history store. Keep separate error/diagnostic owners.
Signal/controller creation and old-ctx accessor semantics are this next proposal, not already
approved code. Lifetime identity/closure meaning is cross-runtime design; native AbortController
and the illustrative TS getter/storage are package-level implementation/API lowering, not a new
wire message, tier or mandatory JavaScript object for other runtimes.

**Decisions — recommendation, NOT selected.** Expose readonly ctx.signal with stable per-lifetime
identity, implemented as a lazy getter in TS. The lifecycle owner holds at most one optional native
controller for that execution lifetime; getter derives signal from controller.signal. No separate
stored signal, aborted flag, cancelled flag, signal-read flag, task ledger or global controller map.
Do not allocate controllers for pure nodes whose contexts never request a signal. All invocations
within one active lifetime get the same signal; new lifetime owns a fresh independent cell.

On first access during active life, allocate/store controller and return its signal. At closure,
abort an already-created controller at the selected post-revocation/pre-cleanup point. If no signal
was ever exposed, closure need not allocate a controller purely to notify nobody. Lifecycle phase/
identity remains the existing authority for closure; signal state does not replace that owner.

Explicit old-access recommendation: ctx.signal stays readable as stable cancellation metadata after
ordinary ctx permissions expire. An existing cell returns the same aborted signal. First-ever
access during/after closing may lazily materialize and cache an ALREADY-aborted signal for that old
lifetime, with standard default reason, before returning it. Never return a temporarily live signal
and schedule abort later. No consumer held it before first materialization, so no earlier visible
notification was skipped. Reading it runs no node fn, updates no output cache/revision and grants
no old state/input/control authority. Old dynamic state/input reads remain invalid as selected.

Every getter binds the originating lifetime identity/cell, not a mutable "current node controller"
lookup; an old ctx must never get the new activation's live signal, including when its first read
occurs only after reactivation. Same old ctx repeated reads return its same signal. Closing reentry
sees already stored controller and aborted state. One closed old ctx reference can retain its own
small cancellation cell, but no node-level history of retired signals or runtime input snapshots
is kept for this access. Normal reclamation follows actual ctx/signal references.

Alternative eager allocation at every activation is simpler and valid but charges pure compute
nodes for a feature they may never use. Lazy access adds a getter/one optional cell and requires
explicit old-lifetime binding, which the accepted ctx isolation already needs. Prefer lazy at this
design stage; exact representation and performance validation remain TS work, not a measured win.
Do not assert current LifecycleState already has the accepted phase/identity or signal cell.

Restore never serializes controller/signal/listeners; target resource reattach uses its target
lifetime. Persisted private state does not turn an old aborted host object into a new signal;
captured unsupported host objects remain subject to honest checkpoint validation. Controller
creation does not become another node revision, replay occurrence, subscription or checkpoint fact.

**Work/evidence.** Inspected current Ctx, nodeMakeCtx/nodeBuildCtx and core LifecycleState. Current
implementation still reuses sync ctx and lacks selected lifecycle identity/phase and signal: neither
new accessor nor older accepted per-invocation input isolation is implemented by this proposal.
Cross-read existing September27 closed dynamic-read versus retained ordinary-value distinction;
the proposed signal accessor classifies cancellation metadata explicitly without reopening dynamic
state reads. No runtime/prototype/test/benchmark run. Only existing review note updated; no API/code,
normative/schema/formal/conformance/JSONL/ledger/D#/commit/push edits. Await choice on lazy access and
old-ctx signal semantics before treating this minimal lowering as selected.

### Lazy signal direction accepted; return to unified lifecycle/setup representation (2026-11-04)

**Rules — acceptance and clarification.** User first asked who performs the first read; explained
ordinary fn/operator/helper access to ctx.signal, not first subscription/invocation and not a
signal() method. User then agrees and continues. Record acceptance of the lazy per-lifetime signal
direction in the preceding minimal-access proposal, with stable original-lifetime binding and no
duplicate cancelled/aborted flags. Keep the full old-access behavior explicit: first access after
old closure returns already-aborted old signal, never new activation's signal or a transiently live
one. This note is design acceptance, not runtime/API implementation or measured performance.

**Decisions — scoped compatibility check.** All same-lifetime invocations share one optional
controller owner; per-run hook replacement cannot replace it. Close stores/revokes authority before
any signal callback and aborts an exposed controller at the selected point. First read inside
closing/cleanup materializes an already-aborted signal before exposure; later closure bookkeeping
cannot accidentally create another live controller. An old getter captures old lifetime identity/
cell even if it is first used after reset/reactivation, while fresh contexts bind the fresh owner.
Retaining signal metadata does not retain permission to read old dynamic private/input state.
Persist/checkpoint cannot transplant native objects into the target life; restore/reattach uses new
resources and prior unsupported-state gates. No new semantic conflict found in these bounded cases.
Accessor representation/allocation and retained-reference qualification still require implementation
tests; current core lacks the already-selected lifetime isolation, so this is not a code-pass claim.

**Rules — next original review scope.** Return to the October12 unified runtime fact/ownership draft
interrupted by the imported QA audit, rather than add speculative signal capabilities. The draft's
setup-success prerequisite was refined by October14 accepted early partial evaluation: fn can run
WHILE wiring progresses, whereas an outward-abandoned setup stops new evaluations without revoking
previous work's valid lifecycle/output authority. This must be reflected in consolidated storage/
admission design; old shorthand "setup ready required for every fn" is too strong.

**Decisions — minimal representation recommendation, NOT selected.** Keep lifecycle phase/identity
and initial dependency-acquisition outcome as separate concerns in the SAME lifecycle/acquisition
owner. No new manager or public status axis. Represent one setup attempt's outcome using one tag
(illustrative names connecting | ready | abandoned), not three independent boolean flags:

| Setup outcome within the current active lifecycle | Meaning for new fn admission |
| --- | --- |
| connecting | Initial wiring is still progressing normally; partial:true may evaluate serviceable input before later deps attach. Other DIRTY/pause/first-input/demand/terminal gates still apply. |
| ready | This setup attempt finished successfully; normal admission gates apply. It does not mean every dependency currently has DATA or no task is pending. |
| abandoned | Outward setup failed/was abandoned; stop new evaluation and failed-attempt input accumulation, with no implicit retry from later DATA/PULL. Already-started lawful work retains normal ctx/output authority until actual close/terminal. |

Lifecycle management/acquisition coordinator alone changes this outcome. Invocation admission reads
it; inspection may explain it read-only. fn/helpers cannot set it via ctx.state. Reuse the existing
owned acquisition attempt/record when implementing, retaining its needed outcome with its lifetime
instead of storing another mirrored public startup status or the thrown error for future gates.
Exact physical storage can derive connecting from an actual live acquisition frame/task where that
evidence is authoritative; do not add redundant stored tags merely for presentation. The abandoned
versus successfully-finished distinction must survive disappearance of the frame. Do not infer
success from absence of queued work or from the number of acquired release handles/cache presence.

Example: D(B,C), partial:true, valid retaining owner. B input starts D's work before C attaches;
C later throws outward, so setup becomes abandoned. D remains active, signal un-aborted, output
open; old work can publish its result under normal rules, but B's next DATA cannot start a new D
call. Last owner then leaves -> closing/revocation -> abort -> cleanup -> finalization. New eligible
activation has fresh identity/signal and a new setup attempt, never an automatic repair of old one.
An ordinary handled protocol ERROR is not classified as a structural acquisition failure solely
because it is an ERROR message. No-dep setup has no dependencies to acquire and can finish ready
without manufacturing an extra fn invocation or demand.

This preserves partial behavior and signal scope without a universal wiring barrier, public failed
node state, stored canRun boolean, error-history record or async task tracker. Public lifecycle can
still be active in all three setup rows; status.cache/output remain their distinct derived facts.
What is being proposed now is the minimal storage/reader boundary, not a new evaluation semantic
or permission for explicit same-life recovery. Future explicit structural recovery remains under
its separately specified contract, never inferred from resetting this tag opportunistically.

**Work/evidence.** Read current LifecycleState (subscribers/activated only), nodeActivate acquisition
loop, owned-acquisition handoff sites and the accepted October14 progressing/abandoned/earlier-result
records. Existing current paths do not implement this selected failed-attempt admission behavior.
No new probe/test/benchmark or runtime changes. Root/worktree filename search found no current
job-pool/dependency-manager file names; original consumer qualification remains outstanding and is
not closed by this design. Only existing session note updated; no normative/API/schema/formal/
conformance/JSONL/ledger/D#/commit/push mutations. Next user review is lifecycle/setup fact separation.

### Setup outcome versus public status: overlap/minimal-state clarification (2026-11-05)

**Rules/review scope.** User asks whether the proposed setup labels add a status state and overlap
other states. This asks for clarification/minimization; no acceptance of the setup representation
is inferred. Public selected status remains {cache,output,lifecycle}; do not add a public setup
axis, rename cache.ready or fold wiring success into lifecycle.active through this question.

**Decisions — distinguish facts, reuse storage.** The prior table described three semantic cases,
not a requirement for a second independently updated node-status state machine. Lifecycle.active
means an owned execution lifetime exists, not that dependency acquisition succeeded. Output.open
means not terminal, not permission for every invocation. Cache presence/freshness says nothing
conclusive about whether a later dependency subscribe threw. pending=0 means no known DIRTY dep
membership, not all deps have connected. hasCalledFnOnce can be true from early partial evaluation
before later acquisition fails. None can replace the abandoned-attempt fact.

Concrete counterexample: D(B,C), partial:true, B causes the first call, C acquisition later fails,
independent owner retains D. D can be active/output-open/hasCalledFnOnce=true/pending=0 and retain
an earlier result; nevertheless later input must not start another call. Already-started result
delivery and cleanup remain legal until actual close, so active cannot simply become failed or
closing to encode this. A fresh lifetime starts a distinct attempt, not inherited abandoned history.

Refine the minimal representation recommendation rather than silently lock the whole three-tag
table: reuse authoritative acquisition attempt/progress records for connecting. Retain only the
necessary completion outcome (success versus abandonment) with its lifecycle/acquisition owner
when it cannot be reconstructed after the attempt finishes. Do not store an extra public status,
three booleans, an independent connecting enum alongside the same attempt, or the thrown error.
If the chosen attempt record already owns this outcome, scheduling reads that same fact. If no
equivalent outcome exists, some new irreducible information really is needed; do not claim it is
all derivation. Exact tag/optional-record/bit representation remains review/implementation design.

Both labels named ready in cache and setup invite confusion: setup success is only acquisition
success, not general fn readiness. Use explicit setup-result wording in the final layout; public
cache.ready keeps its selected meaning. Owner alone mutates the acquisition outcome; admission
and diagnostics read it; ctx.state and public status are not alternative authorities. Current
LifecycleState only has subscribers/activated, and current owned-acquisition structures supply
resource handoff rather than an already implemented durable abandoned-setup gate.

**Work/evidence.** Cross-read October12 owner draft (whose universal setup-ready gate was later
refined), November4 minimal representation proposal, accepted early partial/abandoned/old-result
semantics, current core LifecycleState and owned-acquisition interfaces. This is explanation of
accepted semantic requirements and refinement of pending storage proposal; no new runtime test,
normative/API/schema/formal/conformance/JSONL/ledger/D#/commit/push changes. Existing note only.

### Setup minimization direction accepted; irreducible abandonment marker proposal (2026-11-05)

**Rules — acceptance and scope.** User confirms the preceding explanation and asks to continue.
Select the direction of no added public status axis, reuse acquisition progress/result authorities,
and store only irreducible admission information. Exact marker/record representation remains this
next recommendation. Existing early partial, abandoned-attempt gating, prior-result permission,
lifecycle signal and cleanup semantics are not reopened or silently broadened.

**Decisions — refined minimal proposal, NOT selected yet.** A persistent successful/ready setup
tag is not needed merely to permit ordinary fn calls: successful wiring does not create a new
evaluation reason, and early partial calls do not require completed wiring. Ongoing/not-yet-started
setup uses its actual acquisition execution/pending-activation record. The durable fact still needed
after those process records disappear is that this attempt was ABANDONED. Prefer one life-bound
abandonment marker (illustrative setupAbandoned), or the same single conclusion in an existing
authoritative acquisition result, never both. No separate connected, connecting, setupReady,
setupFailed or canRun fields. This refines the earlier illustrative three-tag table rather than
claiming every table row requires storage.

Initialize the fact clear on an actually fresh lifetime. Set it when outward initial dependency
acquisition is actually abandoned, before completing failure handling can reenter user code. Do not
set it merely for a dependency's lawful protocol ERROR/COMPLETE, an ordinary still-valid fn failure,
cleanup error or pause. It remains set for that attempt; later DATA/PULL/RESUME do not clear it or
implicitly resume acquisition. Ordinary successful completion discards temporary process material
without storing an independent success flag. A genuinely new allowed activation owns a new clear
marker/attempt; a restored logical abandoned execution is NOT such an implicit fresh-success retry.
No explicit same-life recovery API is introduced or decided by this representation.

Owner/write/read boundary: lifecycle/acquisition coordinator is sole writer. Invocation admission
reads abandonment together with ordinary reasons/gates; failed-attempt input handling uses it to
avoid new accumulation under the selected policy. Optional diagnostics can explain the block from
the same fact, without a second public lifecycle state or retained exception. Resource release,
already-started ctx.down and lifecycle signal must not substitute this admission fact for actual
closure. Acquired leases retain their existing owner until close; old lawful output stays subject
to terminal/pause/batch/queue rules. This marker alone neither aborts the signal nor synthesizes a
protocol ERROR or unconditional RESOLVED.

Concrete compact outcome table:
- No setup yet but activation owed: pending activation owns that intent; absence of a setup frame
  must not be mistaken for a successful setup or an independent fn-invocation reason.
- Wiring progressing: actual attempt owns progress; early partial admission remains possible.
- Wiring succeeds: drop its transient progress; no extra success boolean for normal scheduling.
- Wiring abandoned with retaining owner: retain the one abandonment conclusion, stop new calls,
  preserve prior legitimate work/resources under their own authorities.
- Actual lifetime close: retire that attempt's admission fact with its other transient material;
  cleanup/retained logical-state policy remains separate.

Success cannot be inferred from pending=0/cache/hasCalledFnOnce, but also need not be separately
stored when there is no reader requiring a durable success certificate. Exact allocation/packing
is implementation work. Resource reattach or other actions explicitly needing a completed setup
must be scheduled by actual completion of that attempt, not by a fabricated cache-ready test.
If a supported checkpoint claims to preserve an abandoned execution, it must preserve this logical
admission fact and its supported resource/continuation meaning; otherwise use the existing honest
unsupported-state rejection. No schema expansion or unsupported recovery is authorized here.

**Work/evidence.** Re-read nodeActivate's synchronous acquisition loop, SubscriptionAcquisition
release handoff, core LifecycleState and accepted owed-activation/early-partial/abandonment records.
Current implementation lacks the proposed abandoned-attempt admission marker and selected lifecycle
isolation; not an existing-runtime claim. No new probe/test run for this representation proposal.
Only existing session note updated; no runtime/API/schema/normative/formal/conformance/JSONL/ledger/
D#/commit/push edits. User choice remains on this minimal life-bound abandonment representation.

### Abandonment marker accepted; compatibility review exposes failed-rewire scope (2026-11-05)

**Rules — acceptance.** User accepts the single life-bound abandonment conclusion/reuse-existing-
outcome representation and asks for conflicts. Record this representation choice for the already
selected INITIAL acquisition-abandonment semantics, with no new public status or duplicate flags.
Do not infer approval of applying it to every failure or all topology mutations.

**Decisions — initial-scope checks.** Early partial evaluation remains admitted during progressing
wiring; actual abandonment blocks only new fn work, not prior lawful results. Existing output
cache/terminal/buffer, ctx validity, signal and owned cleanup remain their separate authorities.
Failed-attempt DATA stops entering computation storage, but typed control/terminal/INVALIDATE and
required dep-DIRTY/output-debt accounting must not be removed by a blanket receive() early return.
Balance already announced DIRTY only under accepted message-owned result/settlement rules: no
duplicate RESOLVED, no manufactured success/error/terminal, no automatic settling ahead of live
deferred result ownership. PULL/default RESUME cannot bypass the admission block or reset it.
No changes to other consumers/upstream cache. Cleanup error alone, normal protocol terminal and
ordinary fn failure are not structural acquisition abandonment. Actual close retires the old
attempt; fresh activation has a fresh one. Checkpoint cannot silently drop a captured logical
abandonment fact or use reconnect as implicit retry; reject unsupported representation as agreed.
No contradiction found within these already selected initial-acquisition cases.

**Rules — newly identified bounded rewire gap.** Activated R-rewire@1 specifies surgical deps,
preserved first-run history/cache/pause and atomic post-mutation settle, but does not in its inspected
text define recovery/continued evaluation after a NEW dependency's outward startup failure during
an already-running node's rewire. The proposed life marker was scoped to initial setup. Applying
it only at initial nodeActivate while reuse paths acquire deps inside rewire leaves a different
failure/admission policy on a materially similar partially-acquired computation binding. Current
code first replaces fn, edits leases/dep records, then subscribes additions; a throw is not proof
old fn/topology were restored. This is a contract gap/scope choice, not an activated-rule violation
verdict based on implementation behavior.

Trace: N(B) runs normally and publishes10. replaceDeps([B,C],newFn) installs new fn and declared
deps; C's startup throws outward after acquisition. N remains active; later B2 invokes newFn with
(2,SENTINEL), publishes2 under a deliberately absence-tolerant test fn. A real consumer may or may
not want this continuation, but it cannot be labeled the same already-approved initial-abandonment
policy without deciding whether failed rewire abandons the new computation binding.

**Decisions — recommendation, NOT selected.** For this specific post-binding-change/new-dep-
acquisition failure, extend the SAME life-bound abandonment conclusion to the newly abandoned
binding. No second rewireFailed flag/public state/diagnostic history. Stop new fn calls and failed
input accumulation, preserve already acquired resources/releases, legitimate earlier work/output
and ordinary terminal/ctx/cleanup policies. Report actual rewire failure through its established
owner route; do not synthesize another protocol ERROR solely to encode the marker or claim rollback
of already-executed external effects. Existing explicit error-to-terminal wrapper policy is not
changed here. Keep marker until actual old-lifetime retirement; no automatic in-place repair is
introduced by subsequently editing topology or issuing DATA/PULL/RESUME.

Preflight rejection before any binding/resource mutation (self-dep/cycle/illegal target) leaves
the valid old execution unmarked and able to continue. Mark at actual outward abandonment before
failure reporting/reentrant callbacks, not merely because a rewire request exists or throws during
validation. This recommendation does NOT classify arbitrary cleanup/handle errors as dependency
startup abandonment; their failure progression still follows their own specified contract.

Tradeoff: an installed binding whose new dependency startup failed cannot keep computing until a
genuinely eligible fresh execution; callers must not expect automatic partial recovery. Benefit:
consistent failed-acquisition behavior and no hidden partial-state "success". Alternative restoring
old computation/leases transactionally is a larger contract and cannot undo already-visible I/O or
effects; alternative partial continuation needs its own explicit meaning. Prefer uniform abandonment
for the failed installed binding, without claiming it was already selected or all rewires are atomic
transactions. Exact marker name can later reflect binding rather than initial-only setup.

**Work/evidence.** Read typed input reducer/settle paths, accepted failed-consumer storage and QA-5
settlement qualifications, current rewire preflight/fn swap/rebuild/addition loop/finally/settle,
and activated R-rewire@1. Added protocol-reconciliation-probes/rewire-acquisition-failure-followup.ts.
First execution reached assertions but failed on a guessed nonexistent isActivated() accessor;
finally released the subscription. Corrected the diagnostic to inspected _lifecycle.activated,
then reran one finite case: exit0/DONE1, values[10,2], new invocation inputs[2,SENTINEL], deps[B,C],
active after throw, C cleanup0 before off and1 after final off. No external resources/timers/network.
First run session43860 and rerun26918 were each polled to completion; no background run remains.
This is baseline evidence, not implementation/conformance of any abandonment policy. Only existing
session note and bounded diagnostic changed; TS runtime tree remains unchanged. No normative/API/
schema/formal/conformance/JSONL/ledger/D#/commit/push mutations. Initial marker choice recorded;
failed installed-rewire binding disposition is a new user decision before claiming compatibility.

### Failed installed-rewire abandonment accepted; shared lifetime identity/phase proposal (2026-11-05)

**Rules — acceptance.** User agrees and continues. Select the preceding specific extension: a new
dependency's outward startup failure AFTER rewire installed the new binding abandons computation
for that current lifetime using the same marker/outcome. Pre-mutation preflight rejection leaves
the valid prior computation unaffected. No automatic in-place retry, transaction-wide rollback,
second rewireFailed flag, extra protocol ERROR or forced signal abort is introduced. Earlier work,
acquired leases, terminal/output/debt policies and actual close authority remain separate.

**Decisions — scoped combined checks.** Valid preaccepted deferred topology work retains ordinary
origin/lifetime/connection/batch admission; a computation-abandonment marker must not be reused as
a universal queue/cleanup/ctx-revocation gate. A legal topology edit does not implicitly clear it
and new fn admission remains blocked. Earlier async invocation keeps its original input/connection
view and output rights under existing validation, even if fn binding changed meanwhile. New output
cannot bypass terminal, old output FIFO or batch. Signal remains live until actual close. Deferred
rewire's pre-existing error-to-terminal adapter policy is not silently changed; if terminal really
results, safe retirement/close follows its selected rules. Close clears the retiring attempt;
checkpoint/restore cannot treat new object construction as automatic recovery of abandoned logical
execution. No new contradiction was found within the selected initial/installed-rewire cases.

**Rules — next storage question.** Lifecycle identity, active/closing phase, the life-bound wiring
abandonment conclusion and optional controller now have one lifetime owner. The accepted model
requires active -> closing -> inactive and old-ctx isolation; it does not require independent
activated/closing/closed/ctxValid/canRestart/signalAborted booleans. Consolidate this part before
moving to other input/output authorities. Public status remains a derived view, not another owner.

**Decisions — recommended logical shape, NOT selected.** One current lifetime reference, absent
when ordinarily inactive; its small lifetime cell is its own identity. Illustrative TS lowering:

    currentLife?: {
      phase: "active" | "closing";
      wiringAbandoned: boolean;
      abortController?: AbortController;
    }

Names/layout are illustrative; reuse an existing authoritative acquisition outcome instead of a
duplicated wiringAbandoned field if that is the chosen backing. This is a logical owner sketch,
not a requirement to move all NodeCore arrays into a new large object/class or allocate a manager.
Use the cell identity as the ctx/deferred-work origin token; no second monotonically allocated
life ID/counter if object identity already establishes the needed domain. Other runtimes may
represent the same identity differently without a JavaScript-object wire contract.

Establish the current lifetime before callbacks can acquire work under it. During close keep the
same cell current with phase=closing through abort, cleanup and required synchronous unwind. Only
after finalization detach it from currentLife; a fresh activation installs a new cell. Old ctx keeps
its old cell, so it cannot obtain the new signal or regain rights. An old cell no longer current is
retired by identity comparison; no separate closed enum/old-lifetime history map is needed. Cleanup
releases its live references normally, not retaining an execution history through the node.

Derivations:
- public ordinary inactive: no current lifetime (after first checking existing permanent retirement).
- public active/closing: current cell's phase; terminal remains independently output-owned.
- ctx lifetime authority: bound cell equals current cell AND phase active AND not permanently
  retired, followed by existing operation-specific protocol/connection constraints.
- signal notification: optional controller's native state; no copied signalAborted boolean.
- new fn eligibility: lifetime authority plus NOT wiring-abandoned plus normal reason/input/pause/
  demand/terminal/boundary gates. This is a derived predicate, never separately stored canRun.

Signal.aborted is deliberately NOT a ctx-validity test: controllers may not exist, and closing
revokes rights before the subsequent abort callback phase. Wiring abandonment is deliberately NOT
lifetime revocation: earlier work/cleanup ownership remains valid. Ordinary inactive is NOT released;
existing permanent graph/runtime retirement must still be checked separately before activation.
Node-scoped pause locks, declared connection identity/topology, applied state, output facts and
supported restore receipts retain their separately selected owners/lifetimes outside this cell.
Do not clear those by deleting currentLife. Restore rebuilds identity/controller resources while
preserving represented logical facts, with unsupported-state rejection as already selected.

Tradeoff: the small per-execution identity cell/reference is real runtime material, not claimed
zero allocation. It lets ctx validity, lazy signal, queued cancellation and abandonment share the
same identity/phase rather than separate epochs/flags. Exact physical layout, retained-reference
cost and allocation performance remain TS implementation qualification; not a measured optimization.

**Work/evidence.** Cross-read accepted September28 identity/phase/admission model, later terminal
retirement precedence, node-scoped pause lock scope, signal ordering/lazy access, and the failed-
rewire marker proposal. Current LifecycleState only stores subscribers/activated and context code
checks current release rather than the proposed lifetime cell; this proposal is not implemented.
No new diagnostic run was needed after previous baseline rewire DONE1 and unchanged runtime.
Only session note updated; no runtime/API/schema/normative/formal/conformance/JSONL/ledger/D#/commit/
push changes. Await selection of this consolidated lifetime owner/derivation shape.

### Lifetime owner shape accepted and record organization (2026-11-05)

**Rules/Decisions — acceptance.** User accepts the preceding consolidated logical current-lifetime
owner and derived inactive/ctx-validity shape, and explicitly requests well-structured organization
of all review records. Record selection of shared lifetime identity/active-or-closing phase, one
wiring-abandonment outcome and optional controller, with independent topology/pause/output/state
owners. Object identity is illustrative TS lowering; exact fields/packing/performance still need
implementation qualification. Do not add redundant activated/closed/ctxValid/canRun/signalAborted
flags or mistake acceptance for code/spec authorization.

**Work — organization.** Replaced the obsolete top-level resume cursor with a thematic review map,
authority/status legend, accepted-direction entry points, current cursor, categorized open/deferred/
implementation work and bounded probe evidence links. Retained original chronological discussion,
alternatives and receipts unchanged apart from that navigation entry. This is organization within
the existing indexed session, not a new canonical ledger or a claim all prior proposals are locked.
Current cursor advances to the remaining unified input/output/queued-work integration review.
Validation: all 36 new entry-map/navigation/authority/evidence links resolve to existing headings
or local paths; the new acceptance entry occurs once. TS runtime working tree remains clean.
This is documentation-link validation, not runtime/formal/conformance testing. No runtime, JSONL,
normative/formal/conformance/schema/ledger/D#, commit or push changes.

### Received-input records: retained facts, unconsumed occurrences and dirty membership (2026-11-05)

**Rules/review scope.** User asks to continue after record organization. Resume the selected
unified input/output integration cursor. Accepted semantic constraints: DATA occurrences survive
ordinary readiness/default-pause waiting; per-dep wave boundaries and initial/live role matter;
START/DIRTY alone do not invoke raw fn; per-dep DIRTY membership is idempotent; ordinary INVALIDATE
supersession, abandoned-consumer drops and terminal policies remain their explicit exceptions.
Do not turn this storage proposal into automatic equality/coalescing or new invocation behavior.

**Decisions — recommendation, NOT selected.** One consumer-owned received-input record per declared
connection, referencing the existing topology-owned stable connection identity. Distinguish three
irreducible families WITHIN that owner, not three duplicated managers/public statuses:

| Fact | Retention/meaning |
| --- | --- |
| Retained received input | Current value/absence, received terminal status and the already-selected receipt/baseline evidence where needed. Remains after fn consumes pending occurrences. It is the consumer's actual received view, not an unconditional read of current upstream cache. |
| Unconsumed invocation input | Ordered, still-admitted projected per-dep waves plus required initial/live origin and terminal-event metadata. Canonical occurrence storage; empty/no-wave, RESOLVED-only, DATA and absence-clearing distinctions survive. |
| Unsettled notification membership | One dirty boolean for this dependency's actual current DIRTY contribution. Repeated prefix does not increment it; lawful complete-array settlement clears it once under selected scheduling. |

Use the input reducer as sole mutator of received facts/membership, with invocation admission owning
the explicit handoff/consumption boundary for its pending material. Fn/helper reads stable invocation
views; it cannot mutate the live received record. Topology owns connection validity/reorder/removal;
lifecycle/resource owner owns actual subscribe/release capabilities. They can reference the same
connection record without moving ownership of all connection facts into one lifetime object.

Concrete distinction: while default-paused N receives three whole nonterminal upstream value
arrays DATA20, DATA20, DATA30 (each with its normal DIRTY prefix), its retained input is30,
pending input contains all three original value waves, and source DIRTY membership can be false
because each source settlement arrived. Source input-pending count0 does NOT mean N has no owed
evaluation. N's own output notification/debt remains a separate output-owned fact. On legal later
invocation raw input retains three waves; value sugar can read latest30 under its selected policy.
Conversely, a new standalone DIRTY may make membership true with no new DATA stored. A settled
retained value can remain after pending input has been consumed. Thus none of the three substitutes
for another; holding only latest upstream/downstream cache would lose observable information.

Derive redundant views from these authorities:
- hasData from the unique value/absence representation; if a runtime retains an optimized presence
  index, maintain exact equality rather than give it independent truth/checkpoint storage.
- Flattened depBatch/DATA view from canonical pending waves; do not copy every occurrence into a
  second independently accumulated history alongside waveData. Any justified performance cache
  must be explicitly derived/invariant-bound and is not another serialized authority.
- pending count from dirty membership; an O(1) maintained count is allowed with the invariant
  pending=count(current dirty dependency records). It is not queue length or a count of DIRTY tuples.
- ctx.waveData/terminal and initial/live helper views from the invocation's handed-off projections,
  not another exposed mutable current input array. Already-exposed per-invocation views remain stable
  through later invocations; no second public raw input channel is added.

Received terminal status and an unconsumed terminal event are different facts: consuming the event
must not reopen that dependency, and later unrelated invocations must not see it as newly arrived
terminal input. Terminal metadata remains separate from DATA projections under the selected raw
contract. Pending storage retains only unconsumed/admitted material, not the last entire source wave
forever; control-specific supersession/discard rules still apply. Already consumed source replay is
not re-folded on restore. Initial/live origin is retained locally as needed, not a new wire message
or global event identity. Same origin/grouping can be encoded without duplicated wave payloads.

Existing live/ended dependency receipt restore counterexamples require retaining the actual received
view when source cache is newer/different/quiet; no separate live versus ended input registry. Keep
the earlier exact portable-reference/value representation and unsupported-pending-state gate: this
proposal neither promises new checkpoint support nor finalizes a schema/physical array layout.
Subsequent review must check invocation handoff/consumption, INVALIDATE/terminal, abandoned wiring,
dynamic removal and restore against this single-owner model before declaring the integration complete.

**Work/evidence.** Inspected DepBookkeeping, nodeReceiveFromDep/nodeReleaseDepDirty, ctx depWaves/
depBatch/depLiveBatch/depLatest, and the accepted QA-14 pause retention/inventory. Current DATA input
path accumulates both batch and waveData; helper depBatch already flattens/filter-SENTINEL from raw
waves. That supports a derivation direction, not a proven safe field deletion or allocation win.
Current invocation arrays and sync ctx reuse still differ from accepted input-view isolation. No new
probe/test/benchmark/runtime change. Updated thematic cursor to this proposal; only existing note
changed, with no normative/API/schema/formal/conformance/JSONL/ledger/D#/commit/push edits.

### Received-input proposal versus current code: reduction candidates and INVALIDATE caveat (2026-11-05)

**Rules/review status.** User asks whether the proposed input owner model really simplifies the
current code. This is comparison/verification, not approval of the proposal or field deletion.
Accepted occurrence, INVALIDATE supersession, complete-array and invocation-consumption rules
constrain any refactor. Keep actual baseline behavior separate from candidate correctness.

**Decisions — verdict.** Current DepBookkeeping already represents the three logical fact families;
the proposal is useful chiefly for reducing duplicate maintenance and misplaced transient data.
Do not claim twelve existing fields collapse to three scalar fields or that wrapping them in one
new object automatically simplifies anything. Existing parallel arrays may remain the fastest
physical layout; logical owner consolidation does not require an object allocation per dependency.

| Current field(s) | Evidence / proposed treatment | Qualification |
| --- | --- | --- |
| prev + hasData | Legal SENTINEL uniquely expresses absence, so presence can derive in O(1) from prev rather than another independent array. | Current first gate reads hasData; all writes/reset/restore/rewire must preserve the intended invariant before deletion. |
| tier | Inspected production dep-tier references assign/reset or copy on rewire; no scheduling/semantic predicate found reading it. Strong dead-state deletion candidate. | Other graph/observation tier fields are different and must not be removed. Bounded source finding, not proof about unknown external private access. |
| batch + waveData | DATA path currently appends payload references into BOTH arrays; public depBatch already derives by flattening waveData. Target one canonical pending representation plus derived effective views. | Internal batch has INVALIDATE/reset/passthrough consumption behavior not identical to public depBatch; naive flat/filter replacement is NOT behavior-preserving. |
| waveTokens | Current per-message grouping guard; move grouping responsibility to known full-array delivery scope under the already accepted array design. | Cannot remove while retaining the present message-at-a-time lowering without another equivalent boundary mechanism. |
| waveLive + terminalInput | Initial/live role and pending terminal-event meaning remain necessary. Associate with canonical pending-wave metadata rather than independently aligned arrays where useful. | Relocation/cohesion, not elimination of information; object metadata could cost allocations. Persistent terminal and pending terminal event cannot merge. |
| prev + terminal + dirty | Preserve distinct retained input, ended-input status and unsettled membership. | Source cache, pending queue or one status enum cannot reconstruct these facts generally. |
| unsubs + idxBoxes | Reuse lifecycle-owned subscription release and topology-owned stable connection/position records. | Ownership cleanup is not permission to erase resource release or routing identity; no newly claimed storage saving merely by moving them. |

Useful O(1) pending count remains a maintained dirty-membership index. Deriving it by scanning all
deps on every message would shift cost, not simplify the runtime. Likewise avoid repeated full
history flattening for every gate: use explicit consumption-aware derivation at appropriate times,
and add only justified invariant-bound performance indexes/caches if measurement warrants. No
performance/memory benchmark claim. Duplicate DATA arrays currently duplicate references/list
bookkeeping, not automatic deep copies of payload objects, so no "half the payload memory" claim.

**Rules — important concrete qualification/correction.** The previous shorthand "flatten canonical
pending waves instead of batch" is a TARGET, not a drop-in description of current state. On
INVALIDATE current nodeReceiveFromDep clears internal batch and retained prev/hasData but keeps
older DATA in waveData plus the SENTINEL marker. Public depBatch(ctx) flattens/filter-SENTINEL,
so it still returns old values. A future unified representation needs an explicit distinction
between any retained raw projection and the effective pending-change view after control actions,
or must implement the approved supersession/consumption semantics directly in canonical reduction.
Do not silently change either raw visibility or control effects merely by deleting the array.
Pass-through also consumes internal batch outside nodeRunWave; consolidate that consumption boundary,
not just DATA insertion. This qualification does not select a new raw-history policy.

Concrete baseline: default-pause consumer; upstream DATA20,DATA20,DATA30 -> internal batch
[20,20,30], waveData [[20],[20],[30]], retained30, dirty=false/pending0. INVALIDATE -> batch=null,
retained absent, waveData [[20],[20],[30],[SENTINEL]]. Then DATA40 -> internal batch[40]; RESUME
raw fn's depBatch returns [20,20,30,40], latest40. This is exact observed behavior, not a new
correctness verdict about how all pending projection cases should be specified. It prevents the
incorrect premise that both arrays currently hold identical information at every boundary.

**Work/evidence.** Read all twelve DepBookkeeping fields, DATA/INVALIDATE input paths, first gate,
terminal dirty settle, pass-through/runWave consumption, context projection/read helpers,
reset/restore seeding and rewire copying. Production field-reference searches excluded tests/bench;
dep tier matches outside these files were unrelated graph/observation records. Worktree has no
.codegraph index, so used source search rather than indexing. TS HEAD remains
dafc5ae57d446a59a7388214c31bd7a6e73d1519. Added bounded
protocol-reconciliation-probes/dep-input-duplication-baseline.ts, one execution exit0/DONE1 with
the snapshots above; subscription released, no timers/network/external resources. This is not
candidate equivalence/performance validation. Only session note/probe changed; no runtime/API/
schema/normative/formal/conformance/JSONL/ledger/D#/commit/push edits. Field-reduction/metadata
lowering remains proposed, and raw/control consumption equivalence must be reviewed before removal.

### Input simplification direction accepted; paused INVALIDATE already-selected contract (2026-11-05)

**Rules — acceptance and recovered scope.** User agrees with the current-code comparison and
staged simplification recommendation, then asks to continue. Record acceptance of the direction:
hasData/tier reduction candidates first; unify batch/waveData only after control/consumption
equivalence; keep the O(1) pending membership index; no forced array-of-objects layout or measured
performance claim. This authorizes continued design review, not runtime field deletion.

The next proposed question about whether raw fn should retain pre-INVALIDATE PAUSE inputs was
already explicitly settled by "User accepts QA-14; QA-15 first-input readiness after INVALIDATE"
(October16). That acceptance selects discarding the affected dep's still-unconsumed pre-invalidation
PAUSE input, keeping relevant INVALIDATE metadata/other deps' surviving input/later DATA. Correct
the prior comparison's caution: its raw snapshot is exact current behavior, but in this scoped
paused case the discrepancy is a runtime reconciliation gap against accepted design, not an
unresolved invitation to preserve old DATA. No new semantic approval is needed to restate it.

**Decisions — consolidate storage under the selected rule.** For the prior finite probe's case:

    default PAUSE; DATA20; DATA20; DATA30; INVALIDATE; DATA40; RESUME
    intended surviving raw input: INVALIDATE marker, then DATA40 in original surviving wave order
    intended depBatch DATA view: [40], retained input40
    current baseline raw depBatch: [20,20,30,40]

INVALIDATE during this PAUSE cancels that dep's older still-unconsumed change input, not a second
unrelated history. Make canonical pending input reduction apply this cancellation before raw/value
views are produced; both should project the same surviving content. An extra effective pending
history alongside raw old DATA is not required to preserve a choice the user explicitly rejected
for this case. This is the concrete prerequisite for eliminating independently accumulated batch:
canonical surviving waves first, derived DATA/has-value/has-pending-change views second.

Keep accepted qualifications:
- No INVALIDATE: retain both DATA20 occurrences and DATA30; no implicit equality/coalescing.
- Preserve other dependencies' admitted input and later new DATA, relevant origin/group boundaries
  and invalidation marker as needed by a later lawful invocation.
- Marker alone does not manufacture a fn invocation if no surviving reason remains. Pending DIRTY,
  initial-input, demand, pause, lifecycle and terminal gates continue to apply; first-gate presence
  cannot be satisfied by DATA already invalidated before the first call.
- Already handed-off/executed invocation input, private reducer state, prior outputs and legitimately
  running work are not retroactively erased or cancelled by clearing the live pending queue.
- This scoped paused-input rule does not automatically erase DATA within ordinary non-paused
  same-array DATA+INVALIDATE processing or turn output resumeAll FIFO publication into an input
  cancellation buffer. Initial-gate-only deferral and all compound-wave boundaries must be checked
  against their own accepted scope instead of silently generalized by the refactor.

**Work — next integration stop.** Review exact fn-admission handoff/consumption: transfer the
selected input projection to an invocation frame so pending-queue edits and later calls cannot
mutate its already-exposed view; determine which material retires at admission versus after return,
including fn failure. That review should implement previously selected no-retry/input-isolation
semantics with one authority, not add another independently accumulated queue.

**Decisions — next handoff recommendation, NOT selected.** At lawful fn admission, detach that
invocation's selected surviving waves/event metadata from the live pending owner and bind them,
with its fixed input/latest/connection view, to the invocation frame BEFORE calling user fn.
Gated/not-started work stays pending. Once actually invoked, its input is consumed even if fn
throws; do not reinsert it or automatically retry it. Retained input values/terminal status and
actual dirty obligations are not erased by this transfer. Later incoming input belongs to a new
pending set; later INVALIDATE cannot mutate a previously exposed invocation view. Reuse data/
references where safe without deep-copying payload objects; avoid copying into two independently
updated histories. Current nodeRunWave clears arrays after dispatcher.invoke returns; its finally
only resets insideRunWave, so an escaping throw skips that clearing. This source fact motivates
review, not a claim that all current sugar/host failure paths replay data or that a candidate handoff
has been implemented. Error/output settlement remains with its already selected owner policy.

**Evidence.** Read complete QA-14 pending-input recommendation and explicit October16 acceptance,
current INVALIDATE reducer and the last run's dep-input-duplication-baseline.ts receipt. No rerun:
the baseline code is unchanged; earlier exit0/DONE1 remains evidence of current behavior only.
Only session note updated; no runtime/API/schema/normative/formal/conformance/JSONL/ledger/D#/commit/
push changes. The clarification resolves this paused-case policy from existing approval, not a
new all-INVALIDATE semantic extension. Thematic cursor points to this reconciliation and next handoff check.

### Invocation input consumption accepted; compatibility check and output notification ownership (2026-11-05)

**Rules — acceptance.** User accepts the invocation-start consumption boundary and asks for
INVALIDATE/batch/pause/lifecycle compatibility before advancing. Select handoff of the chosen
surviving input projection into its invocation frame before user fn executes; unstarted/gated work
stays pending. An actually attempted fn does not get automatic input reinsertion/retry on throw.
No input rollback, output settlement or permission renewal is implied by the handoff. Remaining
dispatcher/admission preparation failures must not be confused with a call that has started.

**Decisions — bounded compatibility checks, no new semantic conflict found.**
- Gates/ctx identity/connection checks precede invocation commitment. Ordinary rejection before
  invocation does not consume input; actual close can retire its pending work under existing rules.
  Do not create a dequeue/requeue retry loop or claim a fn that never ran consumed business input.
  Dispatcher still owns every fn invocation; the new frame is not a direct-call bypass.
- INVALIDATE applies to the still-live pending owner with the already selected scoped supersession
  rules. It cannot modify an earlier handed-off wave structure/input/latest/terminal view. Retained
  consumer value/terminal state can change for future calls while an older invocation keeps its
  own read view. No deep-copy/freeze of user payload objects or historical snapshot registry.
- Default PAUSE/first-input/DIRTY/demand/abandoned-wiring gates prevent handoff until an invocation
  is lawful. An admitted resume consumes its selected surviving waves once, preserving duplicates
  and array boundaries. resumeAll allows invocation/input consumption normally while its resulting
  publication is held; those output entries are not pending fn inputs and are not rerun at drain.
- Precommit batch output is provisional at its batch owner, not prematurely consumed downstream
  DATA. Rollback drops its staged work/balances actual announcements under existing policy. Calls
  which actually ran through another admitted path are not transactionally undone by later body
  failure; completed commit plus observer/cleanup error remains committed. Observer requests and
  old-backlog continuation keep their separately selected ownership/fate; no replay of consumed
  frames to simulate rollback. Successful batch commit still preserves its admitted occurrences.
- Closure during fn revokes old ctx, aborts and runs managed cleanup with the existing retiring
  frame's input metadata/current old private state. Required synchronous unwind/late cleanup ends
  before new activation. Old fn return cannot clear a new life's pending input or synthesize its
  RESOLVED: recheck originating life before any normal post-run action. Same-cell abandoned wiring
  blocks new calls without reclaiming the earlier lawful frame or aborting its signal by itself.
- Consumed terminal EVENT metadata clears from future invocation input, while received terminal
  STATUS stays with its dep record. hasCalledFnOnce records actual admission/start rather than
  successful result. Fn throw/output failure follows its existing operation/business policy and
  cannot reinterpret the frame as automatically pending again. Input consumption does not clear
  cache staleness or actual downstream notification debt merely because no input queue remains.
- Checkpoint still rejects active unsupported frames/partial fanout/closing work. Supported restore
  reconstructs represented logical received/processed facts and resources, not replay of old
  invocation as fresh input or serialization of a stashed ctx. No additional restore support.

Exact transfer, stable view representation, prepare-versus-start boundary and failure qualification
remain implementation work. Current clear-after-invoke loop does not establish these guarantees.
This review is static design consistency, not runtime/formal/cross-runtime conformance.

**Rules — next owner question.** QA-24 already accepts that consuming input/returning fn is not
output settlement, and old valid DATA can settle its published interval while newer local work
keeps cache stale. QA-5 rejects generic task tracking. QA-9 requires per-array prefixes but per-dep
idempotent membership. Consequently output's actual announced-not-yet-settled notification cannot
be inferred from dep pending count, raw input queue length, known async work, or public cache.stale.

**Decisions — next recommendation, NOT selected.** Make actual output notification/settlement a
canonical fact owned by the existing output transition/delivery owner, with existing lifetime/
batch/publication bindings. Do not maintain a second general node-dirty status or add per-task
settlement counters. A real DIRTY announcement opens/maintains the interval; actual lawful published
settlement closes it once. Input handoff, fn return, queue admission and held-but-unpublished DATA
do not themselves close it. Per-array prefix does not multiply debt; a later distinct publication
after settlement opens a fresh interval. No new wire ID/ACK or causal latest-result guarantee.

Illustrative distinction from the accepted default-pause old-result trace: N has newer input20
waiting under PAUSE; an already-started invocation emitsDATA100. Retained output becomes100, input
DIRTY count can be0, new input20 remains unconsumed, the DATA publication settles its downstream
interval, but cache still projects stale due to known newer work. Quiet PULL can likewise have
stale cache without announcing downstream DIRTY at all. One dirty/stale/pending flag cannot encode
these different facts, and deleting all input arrays cannot resolve them.

Current emittedDirtyThisWave mixes temporary prefix/run suppression with announced notification;
emittedSettleThisWave records generated per-call settle; batchDirtyOwed records rollback obligation.
They are NOT blindly interchangeable: preserve which batch/owner owes rollback settlement and do
not clear unrelated old obligations. Place transient per-wave/per-invocation suppression in its
existing execution frame; consolidate only duplicated representation of the same actual output
notification. Pending publication queue and irreducible cache freshness remain separately owned
facts/derived reasons under the selected model. Exact encoding/minimum storage is the next review,
not an approved new notifiedDirty flag or authority for deleting current bookkeeping now.

**Work/evidence.** Read dispatcher.invoke, nodeRunWave post-call cleanup/synthesis, output prefix/
DATA/RESOLVED publication, batch defer/commit/rollback and current three settle-related fields.
Cross-read accepted lifecycle return-path fencing, QA-5 message-owned completion and QA-24
old-output/new-input freshness. No new probe/test or candidate implementation. Updated thematic
cursor; only existing session note changed. No runtime/API/schema/normative/formal/conformance/
JSONL/ledger/D#/commit/push mutations. Next user review concerns output notification ownership.

### Output owner accepted; minimal notification, frame and batch representation (2026-11-05)

**Rules — acceptance/scope.** User agrees and continues after the output-owner recommendation.
Select one output transition/delivery authority for actual announced-not-yet-settled notification,
distinct from input consumption, cache freshness and queued publication. No generic task tracking,
new public status or immediate clearing at fn return/buffer admission. Specific identity encoding
and rollback treatment of pre-existing intervals below remain a new proposal, not accepted merely
from approving the owner boundary.

**Decisions — minimum logical lowering, NOT selected.** Preserve the necessary facts at their
real lifetimes, rather than three node-global flags with mixed scope:

| Existing mixed field | Proposed canonical scope/meaning |
| --- | --- |
| emittedDirtyThisWave | Actual current output notification interval lives with output owner; prefix/prepass suppression lives only with current whole-array delivery/execution frame. |
| emittedSettleThisWave | One bounded invocation-frame fact that this call has accepted appropriate settlement output, including lawful held publication; not a node-lifetime "finished" flag or async-job state. |
| batchDirtyOwed | Rollback responsibility belongs to the existing per-node batch entry and references the notification interval it actually opened. No independent node-level historical batch boolean. |

Illustrative encoding: output owner has optional current notification reference. Absence means no
outstanding announced interval; presence is both that fact and its identity. Reuse an existing
appropriate delivery/execution record identity where possible; no public/global wave ID, monotonic
counter, retained interval history or new object per message is selected. Generated-output/frame
state stays frame-local. Batch entry stores an optional reference to an interval it opened, rather
than another boolean claiming all node DIRTY must be balanced by this batch.

Normal publication keeps prior per-array DIRTY prefix policy. A repeated DIRTY while an interval is
already open retains its identity; lawful actual settlement closes it once. Held DATA does not close
it merely on enqueue. Each later replayed complete DATA/RESOLVED array can open/settle a fresh
interval as already accepted. This identity is solely local notification/rollback ownership, NOT a
task/result identifier: old legitimate producer output remains allowed to settle the currently
published interval under arrival-order semantics. No new latest-task result rejection is implied.

**Rules — concrete overlap requiring selection.** Previously approved batch rollback balances its
own announcement; the exact case of an unrelated pre-batch open interval was not explicitly locked.
Current rollback uses unconditional batchDirtyOwed once a tier3/4 slice was staged, even if the
receiving dependency was already dirty before the batch. Proposed owner rule:

    outside batch: N announces DIRTY for existing work (interval A)
    batch stages N DATA20, then rolls back
    proposed: drop staged20; keep interval A open, no rollback RESOLVED for A
    original producer later DATA/RESOLVED -> normal settlement

A batch entry records a notification reference only if its accepted work actually opened a new
interval. At rollback, emit normal balancing RESOLVED only if that same reference is STILL the
current open interval. If it did not open one, or another actual publication already settled it,
do not settle an unrelated/current newer interval. This handles pre-existing notification and
stale ownership without a debt count per DIRTY or per task. Rollback cannot use value equality or
queue emptiness as an ownership proof. Commit clears batch staging ownership, not actual output
debt in advance of lawful publication (which may still be buffered by resumeAll).

This overlap policy is a proposed refinement, not a new assertion that the activated rules already
say it verbatim. R-undirty-settle-timing@1 still constrains how a legitimately owed balancing
RESOLVED travels. It cannot be implemented with the current bare subscriber send/early status reset.
Output terminal/actual close follow their existing cancellation/settlement rules and retire stale
old-lifetime references; an old batch entry cannot affect a new lifetime's notification interval.

Benefits: one real notification authority plus frame-local generation and batch-local responsibility;
stale booleans cannot release someone else's waiting interval. Cost: interval identity/guarded
ownership must exist, although it can reuse prior frame objects and does not require a new registry.
No measured allocation/performance win or simplistic "three flags become one" claim. A boolean-only
alternative is insufficient unless one proves the referenced interval cannot end/reopen before the
batch action. Exact physical representation remains package work after policy acceptance.

**Work/evidence.** Inspected normal prefix/publication, buffered settle accounting, runWave local
generation/post-return reset, nodeCommitBatchedWave/nodeRollbackBatched and current batch Map entries.
Added protocol-reconciliation-probes/batch-rollback-preexisting-dirty.ts and ran once: exit0/DONE1,
starting cache10; standalone DIRTY, batch DATA20 then rollback -> observed DIRTY,DIRTY,RESOLVED;
cache stays10. No producer DATA/RESOLVED was supplied for the earlier interval. This confirms current
source behavior, not candidate identity implementation or a blanket active-rule violation verdict.
Subscription released; no timers/network/external resources or background run. Updated thematic
cursor/evidence table. Only session note/probe changed; no runtime/API/schema/normative/formal/
conformance/JSONL/ledger/D#/commit/push edits. Await choice on this lowering and overlap rule.

### Notification reference scheme accepted; deferred compensation must revalidate at publication (2026-11-05)

**Rules — acceptance.** User accepts the notification reference/frame/batch scheme and asks for
DIRTY/batch/pause/lifecycle compatibility before advancing. Record the optional current notification
identity, bounded invocation-local accepted-output fact, and batch-entry reference to the interval
it actually opened. Rollback does not balance an unrelated pre-batch interval or a replaced/settled
one. No public ID/task registry, unconditional field deletion or measured allocation result follows.

**Decisions — scoped compatibility checks.** Repeated DIRTY/prefix keeps the same open interval;
no debt multiplication. Actual complete-array publication settles once; later separate replayed
arrays can open their own interval. Raw old legitimate DATA/RESOLVED remains arrival-ordered, not
filtered by which invocation opened notification. Nested admitted batches share the outer frame;
rollback ownership resides with that frame/entry, not a second node-wide flag. Commit to resumeAll
buffer does not clear actual published debt early. Quiet PULL cannot gain DIRTY merely from stale
cache; fn/input consumption cannot clear notification. Terminal/close and lifecycle identity keep
their existing authority; an old entry cannot settle a new life's interval. Observer controls and
old-output FIFO keep their selected boundaries. These checks do not add a generic async-result
completion tracker or force a future result when a no-output helper stayed quiet.

**Rules — publication-stage qualification to select.** The previous proposal described checking
current interval at rollback, but legitimately owed balancing RESOLVED itself obeys pause/batch/
boundary delivery timing (R-undirty-settle-timing@1 and selected resumeAll rules). A check performed
only when compensation is planned/enqueued is not sufficient to establish ownership when it is
later published. Carry the already selected target notification reference with the synthesized
pending compensation and revalidate immediately before its actual output publication.

Design scheduling trace (not a newly executed runtime/candidate probe): rollback legitimately
plans a balance for interval A; its publication is delayed. If an earlier lawful output settles A
before the balance reaches the head, the balance is obsolete. Publishing it as a new ordinary
DIRTY+RESOLVED array would manufacture another interval/callback. If a distinct interval is then
open, it must not be settled by A's stale compensation either. This describes the guard's required
temporal scope, not proof every source/batch combination admits each possible interleaving.

**Decisions — recommendation, NOT selected yet.** Treat runtime-generated compensation as a
targeted pending publication until delivery. At lawful publication boundary check originating
life/output authority AND exact still-open notification identity. If either is invalid, retire the
whole obsolete compensation entry, including its would-be synthetic DIRTY prefix. Check BEFORE
internal DIRTY prepass, cache/version changes or external callbacks. Do not emit a balancing
RESOLVED and only afterward discover its target was stale. If still valid, use the ordinary
normalized delivery/settlement path and clear the interval once; never bypass buffering with a
bare subscriber send. Re-pause keeps a valid not-yet-published balance queued under normal ordering.

The pending entry's internal target metadata reuses the same notification/lifetime reference;
no new cancelled flag, epoch counter, wire message, acknowledgement or history table is needed.
State-before-callback and current-array completion still apply: once publication has begun, finish
its valid fanout under the accepted whole-array rules instead of rechecking per tuple/sink and
partially withdrawing it. Dropping an obsolete planned balance creates no new published revision
and does not recursively schedule another compensation for a now-different interval.

Scope is ONLY runtime-synthesized balancing work. Explicit user DATA and RESOLVED retain ordinary
message semantics and are not stamped with per-task expected-interval identities or silently
discarded by this guard. Accepted real DATA occurrences are not dropped. This respects QA-5's
message-owned raw async completion policy and QA-9's repeated-prefix membership rule. Lifecycle
close cancels the old pending entry; fresh execution cannot inherit its target. Legitimately
closed terminal output suppresses stale balance under its existing guards. Supported restore of
such pending work would need logical owner rebinding; it remains unsupported/rejected today.

This is a proposed tightening of WHEN the already selected ownership check runs, rather than a
new cancellation strategy or a demonstrated current-rule violation. Prefer it over priority-flushing
all compensations (breaks FIFO/pause boundaries) or unconditionally publishing an obsolete no-op
settlement (observable raw invocations). Obtain user choice before declaring this delayed-delivery
qualification closed; cache-freshness representation remains the following integration topic.

**Work/evidence.** Cross-read current nodeOnResume and nodeRollbackBatched, accepted QA-6 between-
array observer controls, QA-9 prefix/debt split and old-backlog/batch ownership. Current rollback
bare-sends RESOLVED and lacks the candidate identity/deferred-compensation path, so the trace above
is design reasoning, NOT a baseline observation of that future path. Previous pre-existing-DIRTY
rollback probe remains exit0/DONE1 and was not rerun; no new diagnostic/test/benchmark/runtime edit.
Updated thematic cursor and acceptance chain only. No API/schema/normative/formal/conformance/
JSONL/ledger/D#/commit/push changes; pending metadata placement remains implementation work.

### Deferred compensation publication check accepted; minimal cache freshness proposal (2026-11-05)

**Rules — acceptance and compatibility.** User accepts the deferred compensation publication-time
check and requests DIRTY/batch/pause/lifecycle compatibility, then cache freshness. Record the
selection: synthesized balance retains its notification target; revalidate life/output/target at
actual publication BEFORE DIRTY prepass/cache/version/callback effects; drop the entire obsolete
entry. Once valid publication starts, finish applicable whole-array propagation/fanout rather than
withdraw it halfway. Explicit user DATA/RESOLVED has no per-task target filter. Repeated notification
retains interval identity; new interval/new life cannot be settled by old compensation. Legitimate
balancing uses normal buffering/outer-batch boundaries; queue admission does not clear debt. Nested
batches share ownership; terminal/close cancel old entries, observer error alone does not retry or
cancel valid work. No new semantic conflict found within these selected combinations. This does
not claim the candidate delayed-identity path exists in current runtime or has passed conformance.

**Rules — existing freshness constraints.** QA-24 selected cache empty/ready/stale, no public
waiting, O(1) derived inspection, no freshening just from fn call/return. Legitimate older DATA
may settle downstream notification while newer known local input/held output keeps cache stale.
Quiet PULL may remain stale after service returns silently, with no downstream notification or
remaining pending-input queue. Terminal can discard work but does not certify the old retained
value fresh. These were already selected semantics; the next choice is minimum backing/updates.

**Decisions — recommended minimum encoding, NOT selected.** Keep one logical local cache-
unsettled bit in the existing output/cache owner (illustrative cacheUnsettled), plus existing
value/absence and the separately selected current notification reference. Do not keep the old
stored scalar ValueState.status alongside another public status copy. Native terminal state,+lifecycle and actual queue owners remain separate authorities. No stale-reason enum, one boolean
per cause, task tracker, last-output input-revision vector or new dirty counter.

The bit retains local cache-unsettled information which may survive consumption of all known
input; it does not mean a task is running or a DATA must eventually arrive. Known accepted input/
result work that invalidates the retained result marks it unsettled under existing transition
rules. Consuming that input, calling fn and returning silently do not clear it. PAUSE alone or an
unchanged no-output demand does not by itself create a new general async-job inference.

Illustrative O(1) projection, after existing permanent-release handling:

    no retained value                         -> cache: empty
    cacheUnsettled OR actual notification open -> cache: stale
    otherwise                                 -> cache: ready

This is derivation from two already-distinct meanings, not three independent public-state flags.
Actual notification captures announced-but-unsettled protocol interval, including provisional batch
notification; local bit captures cache history not recoverable from interval/queue emptiness. The
status getter reads only these facts and does not scan the graph/dep queues, dispatch or mutate them.
Output transition coordination updates the bit using existing input/work/queue facts; any justified
O(1) work index is explicitly derived/rebuildable rather than a new reason authority.

Proposed transitions required for that encoding:
- Actual local input/result changes affecting cache freshness, including accepted held resumeAll
  result, retain the local unsettled conclusion. Merely staging provisional batch output need not
  overwrite that local bit: its real early notification alone already projects stale while open.
- A normal cache-settling DATA/RESOLVED publication may clear the local bit only when no already
  known newer input/held result/other selected cache obligation remains. Otherwise accept/update
  output normally and keep stale; no latest-request filtering. Fn admission/return never acts as
  substitute publication. Core does not track opaque external tasks or guarantee latest-task freshness.
- Runtime rollback compensation balances only its own notification, not a pre-existing local
  stale-cache fact. With no prior local staleness, closing its interval can reveal ready again;
  with a prior quiet stale cache it remains stale. Do not treat every synthesized RESOLVED as
  independent proof the old cache has been recomputed/certified. Normal no-output operator settlement
  retains its already selected cache-settling policy; source/ownership matters to transition meaning.
- Expired compensation dropped before publication changes neither local freshness nor cache/version.
  Held balance admission cannot freshen cache. Normal result publication still preserves all DATA.
- Terminal must preserve the PRE-terminal stale conclusion before it seals output/retires notification
  or drops a queue. If an open interval was the only stale evidence, latch that conclusion in the
  local bit before clearing the interval, so terminal cannot accidentally reveal ready. DATA then
  terminal in an ordinary already-settled array can preserve ready normally. No new terminal reason flag.
- INVALIDATE clears retained value under its chosen timing and displays empty; it does not erase
  unrelated input/output obligations. Ordinary compute close clears RAM value; preserved sealed
  output preserves its freshness. Plain-state silent intrinsic rebase is the separately selected
  explicit snapshot transition, not a new DATA or blanket rule that all closure makes cache ready.

The local bit belongs with logical retained output, not the transient currentLife cell: a sealed
stale cache can survive execution retirement. Supported checkpoint must retain irreducible local
freshness once (or derive it only with an exact proof), rather than store public status plus all
reason copies. Unsupported capture remains rejected; no new schema or execution-state restoration
is approved. Existing revision/valueRevision alone does not provide an automatic output-to-input
freshness proof; do not add a revision vector solely to avoid one necessary cache conclusion.

Why a bit is necessary: cache20 -> quiet holder receives changed input -> stale without downstream
DIRTY -> PULL consumes input and returns no output. Queue empty/notification absent cannot distinguish
this from a ready retained result. Why bit alone is not every output fact: a provisional batch can
announce DIRTY without consuming/certifying an older quiet stale-cache obligation, and rollback must
not clear the latter. Combining the bit with existing notification identity avoids another per-batch
snapshot/restore flag just to preserve pre-existing local staleness.

This encoding/transition proposal goes beyond simply restating public QA-24 semantics; particularly
rollback versus cache confirmation and terminal latching must be reviewed before calling it selected.
Exact names/physical packing and helper adaptation remain implementation work, not a measured gain.

**Work/evidence.** Read QA-24 original no-output choice/explicit acceptance, newer-input/old-output
and buffered/terminal compatibility, current ValueState.status and DATA/RESOLVED/status writes.
Reviewed accepted compensation target/publication gate and current bare rollback/status reset.
No new runtime/model/probe/test/benchmark run; current status overwrite path does not implement
this selected public freshness model or proposed backing. Updated thematic cursor. Only session
note changed; no runtime/API/schema/normative/formal/conformance/JSONL/ledger/D#/commit/push edits.

### Cache freshness encoding accepted; compatibility check and publication queue proposal (2026-11-05)

**Rules — acceptance.** User accepts the minimum cache freshness representation and requests
DIRTY/RESOLVED/batch/pause/terminal/restore checks before advancing. Select one local logical
cache-unsettled bit in existing output state, replacing legacy scalar status meanings, plus actual
notification identity/value presence for the public O(1) empty/ready/stale projection. Local bit
does not mean an async task exists or a result is guaranteed. Names/packing remain illustrative;
no separate public-status cache, waiting enum, task ledger or per-cause boolean family is added.

**Decisions — compatibility checks, no new semantic conflict found in this bounded matrix.**
- DIRTY: actual notification opens its owner reference and may make retained cache project stale.
  Local cache-unsettled is not another notification: quiet PULL can set/retain local staleness
  without downstream DIRTY. START's trailing DIRTY derives actual notification, not this local bit.
  Repeated prefix does not multiply either debt or local cause records; equality is never consulted.
- RESOLVED: no DATA occurrence, no fabrication of a missing value. Its ordinary publication still
  participates in raw-fn/derived scheduling and notification settlement as selected. Normal result
  acknowledgment clears local staleness only under the chosen no-known-newer-work check. Runtime
  targeted rollback balance clears only its own notification, preserving older local staleness;
  explicit raw RESOLVED is not silently suppressed or given a task-identity filter. These internal
  meanings do not add a wire variant or make stale mean an unreported protocol ERROR.
- Batch: provisional writes alone do not overwrite the committed local cache conclusion. Actual
  early notification gives visible staleness while staging is pending. Successful commit follows
  normal accepted output/publication rules. Rollback of its own interval can reveal ready if no
  older local uncertainty existed, but cannot certify a prior quiet stale cache. Pre-existing
  interval preservation/target validation still apply. No rollback over an actually executed fn,
  independent observer request or old owned output. No extra per-batch freshness snapshot selected.
- Pause: default pause gate/known newer input keeps affected cache unsettled, while PAUSE alone
  does not stale ready cache. Input handoff/quiet no-output return does not clear the bit. Legitimate
  older DATA is accepted arrival-order; newer retained work can keep stale even after downstream
  debt closes. resumeAll queued results do not update cache/version/replay early; successive normal
  publications may keep stale while real held work remains. Native/raw opaque task completion is
  not discovered by scanning closures or treating every pool label as a task registry.
- Terminal: preserve the pre-terminal stale conclusion before dropping notification/queue. A stale
  cause represented only by the interval is latched locally before that interval retires; no queue-
  emptiness freshening. Already-normal DATA settlement followed by COMPLETE can preserve ready.
  No value remains empty regardless of hidden work. Output sealing and safe lifecycle retirement
  still have separate timing; signal/cleanup does not certify cache or revoke DATA retroactively.
- Lifecycle/state: terminal's retained snapshot/freshness can survive inactive; output bit is not
  destroyed by deleting currentLife. Ordinary compute RAM clearing removes the value and displays
  empty. The accepted plain-state silent intrinsic rebase is its explicit baseline transition,
  not a general close=ready rule. Wiring abandonment blocks new calls without being synonymous
  with stale or closed; earlier lawful output still follows its ordinary rules. Permanent release
  retains the already selected released-only public projection.
- Restore: save the irreducible local bit/logical facts once, not public enum plus aliases. A
  recoverable quiet stale cache with no queue must not restore ready merely because a resource was
  reattached. Actual notification/pending execution still need their supported representations;
  currently unsupported states reject. Do not fold every public stale cause into the local bit
  and erase real notification ownership. Value absence/SENTINEL stays distinct from DATA null.
  Restored controllers/ctx identities are new, represented cache semantics are not recomputed by
  default. No new checkpoint support, version-derived freshness proof or historical task resume.

The checks support the selected design; current scalar status overwrites still need reconciliation.
No implementation/candidate conformance claim follows. Runtime transition summaries may need
invariant-bound indexes for efficient updates, but public getter remains side-effect-free/O(1).

**Rules — next buffer/storage concern.** Accepted pause review already requires one FIFO drain
owner, normal boundaries between complete output arrays, re-pause before the next array, old-before-
new accepted output, no old-life runner leakage, staged INVALIDATE hooks only at acceptance, and
publication-time target checks on synthesized compensation. Current nodeOnResume moves all entries
to local buf and empties pauseBuffer before delivery; that representation hides remaining work
from its owner while running. The selected logical inventory also distinguishes batch staging,
accepted unpublished output, committed replay history and queued control/mutation requests.

**Decisions — next recommendation, NOT selected.** One owner-visible pending-publication FIFO
with a drain cursor; retain it in the output/drain owner while delivering, instead of copy-out/
clear-before-loop. Drain advances retirement of actually published or lawfully obsolete head entries;
new accepted output appends after older remaining entries. One currently executing delivery/
continuation owns drain; reuse that frame/owner identity rather than a second independently stored
draining flag or nested sweep. Exact reusable runner frame is implementation work, not present code.

Minimum logical queue material: each accepted normalized output array, required internal entry
metadata (e.g. target ref ONLY for synthesized balance), cursor/remaining entries and its existing
origin output/lifetime binding. Bind common lifetime once at the queue owner rather than repeat
unnecessary IDs on every tuple. Do not add a public queue ID, cloned last-wave log, deep payload
copy or event history. Immediate otherwise-eligible output with no backlog need not be forced
through an extra persistent queued allocation; preserve normal whole-array/publication scope.

Keep distinct stores with distinct fate:

| Material | Fate / owner |
| --- | --- |
| Batch provisional accumulation | Existing batch entry until commit/rollback; not yet accepted publication whose local effects must survive rollback. |
| Accepted pending publication | One output FIFO/drain owner; pause/re-pause delays it, terminal/actual close may drop under selected rules, callbacks do not rerun fn/hooks. |
| Committed replay ring | Existing bounded published DATA history for new initial subscribers/checkpoint, not pending output. |
| Accepted controls/topology/acquisition work | Existing boundary scheduler with origin/readiness/fate; not raw output arrays to merge into FIFO. |

This is unified ownership of one category, not a universal queue/transaction. It avoids rollback
of accepted invalidation hooks and distinguishes stage-local output/cache/replay transitions.
Before each next queued entry recheck eligibility; discard stale targeted compensation before any
DIRTY prepass. Once an actual array begins publication, finish its valid propagation/fanout under
existing rules. Pause stops the NEXT array; close invalidates the old runner. Old pending arrays
never enlist into an enclosing batch. Tail-presence summary remains recomputable from published
cache plus accepted remaining queue and its acceptance timeline, not a second payload cache.

On completion/drop retire references/cursor consistently; no unbounded completed-entry history
through the node. Memory can grow while user-selected lossless pause retains real pending output;
no new capacity/drop/backpressure policy. Proposed simplicity is one visible source of pending
publication/runner ownership, not proof every store collapses to one array or that allocation is
free. Future portable pending-output recovery still needs explicit support and remains rejected today.

**Work/evidence.** Re-read QA-24 acceptance chain, minimal bit proposal, targeted compensation
publication gate, pause queue drain/terminal discard and accepted replay/tail-presence inventory.
Current nodeOnResume's copy-out sweep and scalar status do not implement the selected ownership/
freshness behavior. No new test/probe/model/benchmark/runtime edit; previous focused baselines remain
their stated evidence only. Updated thematic cursor. Only existing session note changed; no API/
schema/normative/formal/conformance/JSONL/ledger/D#/commit/push mutations. Pending FIFO layout/runner
representation is the next user choice, not already selected by the freshness acceptance.

### Node-local publication FIFO accepted; compatibility review and operation admission proposal (2026-11-05)

**Rules — status and scope.** The user accepts the preceding node-local pending-publication
FIFO/cursor direction and requests checks against batch, pause, lifecycle and restore before
continuing. This is session design acceptance, not a normative rule amendment, runtime change or
new checkpoint support. It is not a global output queue. Existing graph boundary scheduling holds
eligible continuation work; the output arrays remain owned once by their node's output FIFO.

**Decisions — accepted representation.** Retain remaining accepted output and its cursor in the
output owner throughout draining. Append newer accepted output after the existing remainder. One
executing delivery/continuation owns the drain; do not introduce an independently updated draining
flag or nested copy-out sweep. Common origin-lifetime binding belongs to the owner; entry-specific
metadata is only what that entry needs, such as a synthesized compensation's target interval.
Immediate eligible output without backlog need not allocate a persistent queue. Release retired
entries promptly. Batch staging, pending publication, committed replay and boundary requests retain
their distinct owners/fates. No new queue capacity, dropping policy or deep payload copying.

**Work — compatibility review.** No new contradiction found in these selected interaction traces:

| Interaction | Required behavior / consequence |
| --- | --- |
| Batch staging versus accepted backlog | Uncommitted batch output stays in its batch entry. Old accepted backlog waits until the outer batch's outcome/propagation boundary, then resumes outside that batch's accumulation and rollback token. Commit must not silently merge its separate arrays; rollback cannot delete it. |
| PAUSE / resumeAll / re-pause | Default PAUSE still gates new fn calls, not already-started lawful results. resumeAll holds eligible publication. After an array starts, finish its valid whole-array delivery; apply callback-origin controls at their selected boundary and recheck before the next entry. One visible cursor/runner prevents a second drain from overtaking it. |
| PULL | Backlog publication and latest owed demand remain different facts. Drain eligible old output first, then recheck the latest demand and invocation gates before consuming it. No demand means no new holder invocation; the FIFO does not synthesize demand or guarantee DATA. |
| INVALIDATE / compensation | Accepted local INVALIDATE effects/hooks are not repeated by drain. Published cache/replay/version changes retain their selected publication timing. Revalidate synthesized compensation before its DIRTY prepass; an obsolete entry is retired without publication or revision advancement. Explicit user output is not task-correlated by that check. |
| Terminal / actual lifecycle close | Preserve the selected terminal bypass/discard behavior; actual close revokes the old runner and drops its pending output. A fresh life never inherits that runner. Node-owned pause locks and intrinsic state are not erased merely because the old FIFO is retired. Preserve required terminal cache freshness before discarding its only queue/notification evidence. |
| Restore | Current unsupported pending-publication states still reject recoverable capture. If support is later added, serialize remaining logical entries/order and supported metadata, not retired prefixes, native runner/call stack, closures or raw identity refs. A restored cursor can start at zero over the remainder and use a fresh runner; portable target reconstruction still needs an explicit contract. |
| Replay / inspection | Only published DATA enters committed replay. Remaining FIFO entries are not replay and cannot be exposed as already committed cache. Retiring an entry updates the owner-visible remainder before the next eligibility decision; it does not discard the irreducible cache-freshness fact. |

This queue representation does not make runtime operations atomic across nodes. Internal DIRTY
propagation, whole-array fanout and queued observer requests retain their existing selected
boundaries. A callback failure is reported under the accepted observer isolation policy; it is not
a reason to replay an already delivered head or strand the rest of the node's FIFO.

**Decisions — next recommendation, NOT selected.** Integrate the owners through operation-specific
admission predicates, using their existing facts rather than storing canRun/canPublish/canRestart
booleans. Share the origin-lifetime/phase check where applicable, but do not make new-fn eligibility
the gate for every operation:

| Operation | Facts it must use; distinction to preserve |
| --- | --- |
| Admit a new fn invocation | Current active life, output policy, wiring-abandonment outcome, default-pause mode/locks, pending dependency membership, first-input policy and any demand requirement. Consume its selected input only at actual invocation admission. resumeAll alone does not prohibit fn execution. |
| Publish accepted output | Origin authority/output terminal rules, batch boundary, older FIFO entries, publication-pause mode and entry-specific compensation validity. Default PAUSE or wiring abandonment alone must not suppress lawful results of earlier work. Finish an already-started array under its fanout rule. |
| Apply a control/topology/acquisition request | Its existing origin, target identity, boundary ordering and operation contract. Do not gate RESUME behind the lock it must release, or require fn readiness just to apply control. Closure/permanent release still enforce their own permission matrix. |
| Perform closing cleanup | Closing owner and registered resources/read-only cleanup view. New-fn admission is deliberately closed; cleanup must still run in the accepted revoke/abort/release/cleanup/finalize order. |
| Inspect or capture | Read canonical facts without changing them. Public status is a projection; recoverable capture separately validates supported pending state and must not infer safety merely from a ready cache. |

Example: N starts async work, then default PAUSE is applied and a new dependency value is received.
No new fn invocation starts; the input remains pending. The earlier lawful result can still publish
under normal output rules. If resumeAll also holds publication, that result instead waits in this
node's FIFO. Neither outcome consumes the pending newer input. Actual close revokes the old work's
authority and retires its FIFO; default RESUME is not equivalent to closing or clearing input.

This consolidates admission responsibilities, not a new global phased execution pipeline. The next
check is update ordering at each existing entry point so canonical owner facts are installed before
user callbacks and a resumed operation rechecks the right owner; no full-wiring barrier or raw fn
trigger on START/DIRTY is proposed.

**Work/evidence.** Re-read the selected batch-independent backlog, latest PULL, INVALIDATE local/
publication split, compensation publication gate, terminal freshness and unsupported-restore
boundaries. Rechecked current node-output-runtime's batch-before-pause staging and copy-out resume
sweep, plus boundary scheduler ownership. Current code is baseline evidence, not implementation of
this accepted FIFO/cursor scheme. No new probe/runtime test or API/schema/formal/conformance/JSONL/
ledger/D#/commit/push change. Updated this note's thematic cursor; all other unresolved categories
remain open as listed there.

### Operation admission accepted; entry-point ordering and compatibility review (2026-11-05)

**Rules — status.** The user accepts operation-specific admission derived from the existing owners,
then requests entry-point ordering checks against batch, pause, lifecycle and restore, with minimal
new machinery. Acceptance does not introduce stored canRun/canPublish/canRestart flags or a global
operation pipeline. The ordering below is the next review recommendation; it consolidates selected
boundaries without authorizing runtime or normative changes.

**Decisions — entry-point ordering recommendation.** At each existing callback-producing entry,
install that operation's authoritative facts before invoking the applicable user code. After user
code, validate the origin and the next operation's conditions again before further work. This is
not permission to withdraw a started array from remaining valid fanout recipients. It also does
not require updating every node in the graph before any callback can run.

| Entry | Required local ordering / reuse |
| --- | --- |
| Subscription / activation / resource acquisition | Apply the existing callback-identity/admission policy; establish the applicable registration/lifetime and record acquired release ownership before START, setup or callback-producing dependency subscription. Initialize each received START snapshot as a whole before its invocation-gate check. Internal wiring still permits early partial:true invocation: no all-dependencies-wired barrier is added. After callback-producing acquisition, recheck the originating attempt/connection/life before continuing; a late release remains owned and must be handled under the selected acquisition-close rules. |
| Dependency input | During the internal DIRTY phase set that connection's dirty membership/pending index before propagating its notification. Reduce the complete admitted settlement array into the received view, pending projections and typed terminal/invalidation bookkeeping under their selected policies before checking its fn gate. No raw fn trigger on START/DIRTY; do not check readiness halfway through several DATA occurrences or lose a trailing INVALIDATE. User invalidation hooks retain their explicit local-effect boundary, not an implicit deferral until every graph operation ends. |
| Actual fn admission | Check the applicable gates; bind/detach the selected input and connection view into the invocation frame and establish the attempted-call/reentry scope before dispatcher entry. Keep resource-hook handoff under the already selected close-during-fn rule. Gated input stays pending. Restore the executing scope in finally; never bulk-clear the current live pending input after return, and never let an old invocation clear a newer life's work. Postlude/synthesized balance uses the originating invocation/output authority and selected terminal precedence. |
| Output acceptance / publication | Validate an author's complete array before its irreversible effects; batch intent remains provisional until the selected commit boundary. On actual acceptance, register its publication responsibility and generated-tail state before local invalidation hooks. Hold resumeAll output in the existing node FIFO without advancing published cache/replay/version. At eligible publication, check origin/head/compensation validity before DIRTY prepass; maintain the existing graph-wide DIRTY-before-settlement discipline, then apply the array's published output/cache/replay/version facts before its external whole-array observer callbacks. Do not repeat acceptance hooks at drain. |
| PAUSE / RESUME / PULL and queued mutation application | Observer-origin requests first retain their existing boundary order; merely enqueueing them does not apply their effects. At actual application, update the lock/latest-demand/connection fact before testing any newly eligible continuation. Re-evaluate after each completed array/boundary request under the accepted scheduling rules; consume a PULL only at actual service. Keep old accepted backlog outside ambient batch staging. No RESUME bypass of earlier queued PAUSE and no lock-gated RESUME. |
| Actual close / eligible reactivation | First enter closing and revoke old ctx/owned work. Then abort, release dependency leases and run managed cleanup under their selected order/error policy; finish required synchronous unwind and state retention/reset before detaching the old life. Keep the old cell closing until completion. A new activation receives a fresh identity only after this boundary; node-owned locks/intrinsic state are not lifecycle cleanup debris. Terminal fanout completes before the actual closing phase selected for it. |
| Checkpoint / restore | Capture only at the already supported stable boundary, validate represented state before declaring a recoverable checkpoint, and reject unsupported pending execution. Restore validates and installs the represented logical state/topology/receipts before admitting observer delivery, activation or reattach code that could see a partial restoration. Rebuild native resources through the accepted deferred reconstruction seam, using fresh life/ctx/signal/runner identities; an entry-point guard is not extra checkpoint support. |

The input row concerns a single admitted input array and its existing graph propagation boundary,
not a demand to wait for all initial dependency acquisitions. The publication row retains the two
different times for INVALIDATE: accepted generated state/local hooks versus published cache and
downstream effects. Likewise a DIRTY-only notification can be observable before later settlement;
"facts before callbacks" does not falsely present future DATA as committed during that phase.

For a queued output head, keep the current entry bound to its sole executing delivery frame while
its callbacks run; do not make it available for a second drain. Once valid fanout has completed
(including isolated observer-failure handling), retire that entry, then service the next boundary
work/entry under existing ordering. A callback error must not cause redelivery. Actual close at
its lawful boundary retires the old remainder; it does not retroactively revoke an array's completed
delivery. This reuses runner ownership rather than adding a delivered/cancelled/draining flag set.

**Work — compatibility result.** No new contradiction identified in the reviewed combinations:
- Batch rollback discards tentative output without local invalidation hooks. Accepted old FIFO
  entries and input already consumed by an actual fn are not transactional rollback material.
  Notifications and targeted compensation keep their accepted identity/publication checks.
- Default PAUSE preserves unstarted input; started lawful output remains eligible. resumeAll
  permits computation and holds publication, so acceptance-tail facts and published cache must
  remain distinct. Re-pause after a callback takes effect at the selected boundary before the
  next eligible array, without interrupting the current intact array.
- Automatic terminal still cancels unstarted gated work under QA-8. Eligible fn output and automatic
  terminal keep their selected separate arrays/postlude; a no-output postlude must not synthesize
  redundant RESOLVED before terminal. Terminal can discard held DATA under the accepted policy.
- Structural wiring abandonment closes new-call admission without revoking earlier lawful output.
  Rechecking the next operation must use its own predicate; a generic life-and-canRun test would
  incorrectly suppress such output or closing cleanup.
- Restore does not turn receipt baselines into live DATA, replay into pending output, or a fresh
  resource identity into retained logical progress. Unsupported pending states still reject;
  supported saved facts are installed before reconstruction side effects.

**Work — implementation reuse and verified gaps.** Reuse existing enterWave/exitWave boundary
scope, dispatcher invocation, owned-acquisition record-before-callback seam, typed input reducer,
batch entries and node-local publication owner. Use existing invocation/delivery scopes and
try/finally for unwind, not a second global phase queue or duplicated status object. This is
responsibility/order guidance, not a claim these mechanisms already satisfy every selected rule.
Current TS still lowers input per tuple, clears input after dispatcher return, moves pauseBuffer
to a hidden local sweep, and clears pauseLockset on ordinary deactivate. Those are known baseline
differences from the accepted direction; copying current ordering would not resolve them. Current
activation marks activated before wiring and owned acquisition records release before callback,
which are useful reuse points, but do not alone prove close/reentry/restore correctness.

Read node-input-runtime receive/runWave, node-output-runtime publication/control paths,
node-lifecycle-runtime activation/deactivation and node.ts subscription/acquisition entry. Located
node-checkpoint-runtime and graph/checkpoint paths before following their restore/reset behavior.
No new test/probe or runtime implementation was performed. Only this existing session note/cursor
changed; no API/schema/normative/formal/conformance/JSONL/ledger/D#/commit/push edits. The next
integration pass, after ordering acceptance, can consolidate the minimum stored facts, derived
indexes and owner-only mutators against this entry-point table rather than add another state layer.

### Entry-point ordering accepted; remaining discussion versus reconciliation work (2026-11-05)

**Rules — acceptance/status.** The user accepts the preceding entry-point ordering recommendation
and asks what remains undiscussed. Record that acceptance without claiming all walkthrough topics,
current Rules, implementation or conformance complete. The original five themes have already been
visited through their concrete intersections; do not restart five wholesale reviews from their titles.

**Decisions — remaining discussion inventory.**

| Item | Remaining outcome; boundary |
| --- | --- |
| Minimum-state/owner consolidation | Produce one final view of stored facts, derived projections/indexes, unique mutators/readers, lifetime and reset/restore behavior, using the accepted input/output/lifetime/queue/admission/ordering directions. This is synthesis, not an expectation of new states or an additional manager. Surface only concrete contradictions or material unresolved choices. |
| Version policy acceptance audit | revision/valueRevision naming and several baseline/receipt refinements are accepted. The always-on base cost/switch policy, legacy DATA-counter removal and precise optional-hash/checkpoint API proposal were explicitly not accepted wholesale by that naming choice. Recover the acceptance chain and present only genuinely unselected details for decision. Do not reopen accepted receipt/restore semantics. |
| Public expression and operator policy closure | Private-state persistence capability is accepted, while naming/number of entrypoints were explicitly reserved. Check the final API-policy matrix across raw node, value sugar and operator families against the accepted terminal/input/occurrence policies. This is a bounded closure audit, not an unsupported claim that every existing operator or exact API combination has already been verified. |

Recommended order: minimum-state/owner synthesis, remaining version-policy choices, then public
expression/operator matrix. Avoid mixing physical field packing or implementation repairs into
new semantic decisions. If consolidation exposes no real fork, mark it reconciled and advance.

**Work — unfinished work that is not automatically another design topic.**
- Original job-pool/dependency-manager consumers still need to be located/recovered and qualified;
  previous scoped searches found no matching current paths. This is an evidence gap, not proof
  the design fails or a reason to invent substitutes. DS-15 still carries G9 report provenance,
  historical refinement and formal/scenario follow-ups. Its INVALIDATE/batch/multi-dependency
  headings overlap later DS-16 review; map actual coverage rather than repeat all those discussions
  or declare the older session closed without that audit.
- Prepare the promised concise Rules reconciliation and affected-revision/supersession list,
  retaining rationale in Decisions and delivery/evidence in Work. The session is not rule activation.
- Runtime repairs and formal/conformance/consumer evidence belong to separately authorized work.
  Existing baseline probes show specified current gaps; they do not validate the replacement design.
- Already deferred user-land/special-purpose capabilities remain deferred as listed in the map;
  do not count them as unfulfilled core requirements.

**Work/evidence.** Re-read the original bounded scope, DS-15 Work section, private-state retention
API reservation, QA-22 concrete version proposal and explicit naming-only acceptance qualification,
and the current thematic map. Updated the map/cursor to distinguish acceptance from remaining work.
Only this existing session note changed; no runtime test or API/schema/normative/formal/conformance/
JSONL/ledger/D#/commit/push change. This is a scoped remaining-work inventory, not a new exhaustive
cross-repository audit or a promise of a fixed count of future semantic issues.

### Combined closure audit: minimum owners, version policy and operator terminal findings (2026-11-05)

#### Rules — request, scope and verdict

The user asks to do all three closure passes and surface conflicts requiring discussion. This
authorizes synthesis, source/acceptance-chain audit, bounded diagnostics and this note, not runtime
repairs or autonomous selection of the remaining version/API choices. No new contradiction found
among the accepted minimum-owner/admission/entry-order directions. Remaining policy choices and
current operator discrepancies are different findings, detailed below.

Relevant current records: activated R-wave-boundary@1, R-diamond@1, R-sentinel@1,
R-resolved-undirty@1, R-terminal@1, R-deps-terminal@1, R-first-run-gate@1 and R-ctx-state@1.
R-pause-modes@1 and R-restore@1 still lack activated_by in their current rows; do not silently
activate them through this review. Several accepted session refinements deliberately revise older
wording, including default PAUSE, terminal subscription retirement, surviving node-owned locks,
whole-array delivery, occurrence-preserving accumulation and richer receipt/restore support.
Their Rules/formal/conformance reconciliation remains work, not proof of a design contradiction.

#### Decisions — consolidated minimum facts, mutators and lifetimes

This is a projection of previously accepted concern ownership, not a new store/class/ledger. The
logical sections may reuse current NodeCore storage and transition helpers; physical object/array
packing is not locked here. Cross-owner events call the owning transition rather than write an
independent alias. Public observers/inspection do not mutate these facts.

| Canonical material to retain | Unique modifying responsibility | Authorized readers / purpose | End/reset/restore boundary |
| --- | --- | --- | --- |
| Declared deps/config and stable connection identity | Topology/rewire application | Routing, input reducer, acquisition and inspection/restore recipe | Reorder preserves identity; remove retires it; re-add is new. Ordinary inactive does not delete declared topology. Rebuild physical references at restore. |
| Subscription registrations and resource releases | Acquisition/lifecycle owner | Delivery recipient selection, owner counting and close | Callback-identity idempotence within the selected registration scope; record release before callbacks; terminal/last-owner retirement follows selected safe boundary. Restore acquires new resources, not old callbacks. |
| Current life cell: identity, active/closing phase, setup-abandonment outcome, optional native controller | Lifecycle/acquisition transition code; getter allocates controller only for its bound life | ctx authority, new-call admission, cleanup and public lifecycle projection | Keep closing cell through unwind/finalization, then detach; new activation has new cell. Abandonment gates new calls, not earlier lawful results. No serialized native identity/controller. |
| Intrinsic plain-state value/applied assignment | State input/commit owner | set handling, output/silent snapshot adoption, capture | Survives last-off, including accepted set whose live publication was buffered/dropped. Nonterminal silent rebase uses this authority; sealed terminal is not bypassed. Store independently of lifecycle publication FIFO. |
| Published cache/absence, output-execution identity, terminal result, irreducible cacheUnsettled conclusion and bounded replay | Output transition owner | Publication, subscription snapshot, status projection and checkpoint | Open compute ordinary close clears RAM; plain-state and retained terminal snapshots follow their selected policies. Record stale evidence before discarding its only notification/queue cause. Save supported logical facts once; no independent public status copy. |
| Current announced-unsettled notification reference | Output notification transition owner | DIRTY/settlement propagation, cache projection, targeted balance and batch rollback | Repeated DIRTY shares the outstanding interval; actual publication settles it. Queue acceptance alone does not. Closure/terminal uses selected retirement; native reference is not a portable ID. |
| Accepted remaining publication arrays, cursor, needed entry metadata and generated-tail presence index | Output acceptance/drain owner | Eligibility/drain and local INVALIDATE effectiveness; supported capture validation | One runner, old-before-new, no repeated hooks/fn. Close/terminal drops under selected policies. Tail summary derives; future supported capture saves remainder, not raw runner or retired prefix. Unsupported pending states still reject. |
| Per-connection received value/absence, terminal state and received-revision/baseline evidence | Input initialization/reducer owner | fn input view, initial admission, recovery comparison and capture | Upstream resource close/restart does not rewrite the consumer's already-ended receipt. Consumer actual close retires its inputs/baselines; rewire survival/removal follows connection identity. Restore saved live/ended receipts before fresh resource attachment. |
| Unconsumed admitted input projections and event/origin metadata | Input reducer; invocation admission transfers selected material | Dispatcher invocation-frame builder and capture validation | Default PAUSE retains surviving input; QA-14 INVALIDATE supersedes the affected paused contribution only. Actual attempted fn consumes its frame, including on throw; later input belongs to fresh pending material. Unsupported pending capture rejects. |
| Per-dependency dirty membership and first-call history | Input reducer / actual invocation admission respectively | O(1) pending gate and first-input gate | DIRTY is idempotent per connection; settlement releases once. First-call history is logical input history, not resource-active or fn-running status. Restore represented history; fresh execution resets under selected policy. |
| Pause lock set/mode | Control application owner | Operation-specific admission/publication gates | Node-owned locks survive ordinary close/eligible reset; matching RESUME or permanent release handles retirement. No separate paused flag. Portable nonempty-lock recovery requires explicit support. |
| Latest unserved PULL | Holder control/service owner | Actual service admission and ctx.pull frame | Inactive matching holder drops demand; active blocked holder retains only latest. Consume at actual service after backlog/gate recheck. Actual holder close discards; never bank into a new life. |
| Private state value/retention policy and current managed hook registrations | fn/helper via valid ctx; lifecycle manager performs selected retain/clear/handoff | Same node's valid fn/helper; narrow closing read view | Private retention does not retain ctx authority or cleanup closures. Hooks follow current-run registration and late-return cleanup contract. Restore logical private data even when not persist; rebuild resource hooks through selected recipe. |
| Current invocation/delivery scope and temporary output-accepted fact | Existing execution/delivery-frame code | Reentry protection, immutable input view, fanout completion and postlude | Establish before dispatcher/callback entry; release/finalize once on unwind. Not node history, task tracking, checkpoint data or extra canRun/draining booleans. |
| Provisional batch material and its own notification target | Existing batch-entry owner | Commit/rollback and output acceptance | Commit accepts normalized output; rollback drops tentative material and balances only its still-applicable interval. No rollback of already-consumed input, published arrays or accepted old backlog. Active batch capture rejects. |
| Queued controls/topology/acquisitions and ready continuation references | Existing boundary-request scheduler/operation owner | Ordered application using origin/target/phase guards | Preserve selected request order and batch fate. Payload remains in its actual owner, not a second global output FIFO. Opaque pending closures cannot be serialized as recoverable work. |
| Node revision evidence/optional hash policy; graph namespace and observation watermarks | Version transition owner; graph allocation/observation owners respectively | Baseline comparison, describe/capture and later name allocation | Preserve selected logical continuity, rebuild physical maps/listeners. Exact base policy/counter/hash questions below remain proposals; inspection never advances these positions. |
| Current operation failures/reporting | Owning synchronous operation or host-entry reporter | Immediate caller/report recipient | Aggregate/report after applicable work; no default node error-history buffer or cleanup-failure restart blockade. Resource ownership remains recorded by its real owner despite a cleanup failure. |

Derive instead of store separately: hasData from unique absence representation; public
status.cache/output/lifecycle from canonical facts; paused from lockset/mode; ctx authority from
bound life/phase; fn/publication eligibility from operation predicates; canRestart from admission
rules. Keep pending count as a maintained O(1) dirty-membership index and held-output tail presence
as a recomputable index when useful. Do not add per-node input-version vectors, async task flags,
second payload caches or historical error logs. Current duplicated input batch/waveData and dead
dep tier remain deletion/consolidation candidates, not proven safe mechanical removals.

#### Decisions — version acceptance audit and remaining recommendations

Already selected: unified version responsibility; revision/valueRevision names; distinct receipt
versus evaluated-input evidence; the reviewed baseline lifecycle/connection rules; silent retained
snapshot adoption advances versions without live DATA; supported checkpoint continuity does not
reset logical progress merely to rebuild resources. The naming acceptance explicitly reserves the
always-on/optional policy, legacy DATA-counter removal and exact hash/API shape.

Recommend, still NOT selected:
1. Always maintain the two base revision positions. Their recovery correctness is not optional;
   two fixed scalars and constant updates avoid enable/retire-reader state. Hash/canonicalization
   remains opt-in. This is a real default-cost/API choice, not a free rename of versioning:false.
2. Drop the automatic DATA-only counter rather than alias it to revision. They count different
   things, and application/diagnostic counting can be explicit. Refreshed bounded production
   search in node/graph finds counter reads in version creation/validation/serialization and the
   hash/absence restore guard, not a business scheduler needing an exact DATA total. This is not
   proof about unexamined external consumers or sibling-runtime API consumers.
3. Resolve optional hash meaning in favor of the current retained snapshot, using the existing
   canonical-value/absence hashing seam and optional cid/previous-cid material, not a new hash log.
   DATA including equal values advances the base positions; a fingerprint may stay identical.
   RESOLVED/terminal alone need not rehash an unchanged snapshot. Effective value removal, reset
   or silent adoption must keep any claimed current fingerprint consistent with the actual retained
   value/absence. This explicitly revises the earlier proposal's historical DATA-only hash lane.
   Exact absent encoding, previous-CID transition rules and option/schema spelling must accompany
   that choice in the final contract; none is implemented or newly approved here.

Concrete unresolved composition, already identified in the QA-22 silent-rebase section but not
closed for hash by the later revision acceptance: published cache20/hash20; accepted intrinsic
set30 held by resumeAll; last-off drops pending publication and silently adopts cache30. Accepted
base versions advance. If optional cid is still DATA-only hash20 but restore validates against
current cache30, validation fails for an otherwise legitimate snapshot. Calling hash20 current
would be false. Alternatives are explicitly historical last-DATA metadata with appropriately
limited validation/recovery, or a separate retained hash input/history; the former narrows capture
and the latter adds state. Current-snapshot hashing is the recommended simpler fit. This is an
unresolved optional-hash proposal interaction, not two already accepted hash promises in conflict.

Checkpoint recommendation: save canonical positions/selected hash facts once, plus the already
selected result/private/receipt/replay/config facts required by the declared supported categories;
derive indexes/public status, rebuild native resources, reject unsupported executing states.
Hash-enabled capture/restore must validate the same semantic snapshot and schema, before exposure.
Do not add a DATA counter solely to validate a hash, or treat hash correctness as freshness proof.

#### Decisions — public API and operator policy audit

For private retention, recommend keeping the single existing ctx.state.persist(on?) entrypoint.
The stored ctxState.persist boolean is that policy's checkpoint representation, not another
public option or a graph state node. Nine current non-test ctx.state.persist(true) call sites were
found in event-flow, keyed-rate-limit, CQRS, admission-handoff, bridge-wire and process helpers.
No consumer in this bounded search requires a second public persistence entrypoint. This naming/
surface recommendation is not newly selected merely because the user requested the audit.

Raw versus sugar remains consistent: raw gets fixed invocation message/input metadata; derived/
effect intentionally receive values and retain the accepted T|undefined contract. Their default
handling of an eligible RESOLVED invocation is not equality substitution. derived may output DATA;
effect has no ordinary return-value DATA but still participates in protocol settlement/terminal.
Their existing exported DepValues type still omits undefined: an already accepted implementation
gap, not an additional semantic fork. Grouped complete/error policy replaces the legacy three
booleans with per-kind responsibility, preserving partial and dirty-settlement gates independently.

Refreshed operators/index.ts export-block inventory:49 value exports, minus define/initNode/
restoreRegistry leaves46 operator/composition-helper names. The ten-family classification from
QA-5 matches exactly, with no missing/extra/duplicate name. Earlier full static classification is
at the same TS HEAD; refreshed representative bodies and all family policy/config seams below.
This is not46 exhaustive dynamic operator tests or a cross-runtime conformance result.

| Family / exact public names | Integration result / required policy |
| --- | --- |
| map, scan, merge, tap, onFirstData, tapFirst | DATA-occurrence processing and private state fit the input-frame/output-array model. tap observer terminal-first branch is a verified gap below. |
| filter, distinctUntilChanged, skip, pairwise, valve | Suppression/pairing/gating is explicit operator policy; no-output processing balances only actual notification, not every private value. Equality stays here, not substrate. Open-valve same-array terminal is a verified gap. |
| take, takeWhile, first, find, elementAt | Selection may end before later occurrences by its declared policy; same-array terminal still finishes the valid chosen output before safe retirement. Writes after terminal down remain inside the selected safe fn unwind. |
| reduce, last | Consume DATA before owned terminal output; retain algorithm state without registering generic deferred async work. Current reduce body is a compatible control for combined DATA+COMPLETE processing. |
| settle | Its optional equals classifies quiet/convergence while emitted DATA occurrences remain DATA. Its algorithm counter is not the legacy node DATA counter proposed for removal. |
| rescue, catchError | Own ERROR handling; forward admitted DATA then emit recovered DATA as its own explicit array. Recovery does not revive/restart a terminated source. Verified rescue control below retains both values. |
| combine, combineLatest, withLatestFrom, race, takeUntil | Value/winner/notifier selection remains explicit; partial never bypasses another outstanding DIRTY. withLatestFrom and first-winning race terminal handling have verified gaps. takeUntil notifier-first suppression is its selection policy, not a universal transparent-forwarding rule. |
| zip, concat, buffer, bufferCount, sample | Private unmatched/buffered/latest values are processed algorithm state, separate from runtime unconsumed input and pending publication. Later notifier/counterpart is a new invocation; terminal handling remains operator-owned. |
| switchMap, mergeMap, flatMap, concatMap, exhaustMap, repeat | Stable invocation views plus queued rewire/removal and terminal-safe resource retirement support existing topology policy. switch selects latest outer batch value, exhaust selects only while idle, merge/concat retain their queues: preserving substrate occurrences does not make all projectors per-occurrence maps. Document these family policies rather than silently impose map's callback count. |
| delay, debounce, debounceTime, throttle, throttleTime, audit, auditTime, timeout, bufferTime | Existing timer/notifier deps and operator-owned cancellation fit lifecycle signal/cleanup without core switch/task tracking. Timers/closures still need explicit restore recipes or rejection. No automatic timer restart/deadline recovery claimed. |

#### Work — newly verified terminal-array discrepancies

Saved portable probe [operator-terminal-array-closure.ts](protocol-reconciliation-probes/operator-terminal-array-closure.ts).
Run once from TS worktree with node_modules/.bin/tsx, source HEAD
dafc5ae57d446a59a7388214c31bd7a6e73d1519: exit0, DONE8. All subscriptions released in finally;
no timers/network/host resources were started. Assertions certify the observed current baseline,
not acceptance of these outcomes or a test of the proposed replacement runtime.

Each source sends DATA23 and COMPLETE (or stated ERROR) in ONE down array:

| Case | Observed current result |
| --- | --- |
| map(v=>v*2), control | DATA46 then COMPLETE. |
| tap(function), control | Function sees23; DATA23 then COMPLETE. |
| tap(observer), COMPLETE | No DATA callback or DATA output; only observer complete and output COMPLETE. |
| tap(observer), ERROR fault | No DATA callback or DATA output; only observer error and output ERROR. |
| withLatestFrom, secondary already9 | No DATA pair; only COMPLETE. |
| valve, control already true | No DATA; only COMPLETE. |
| rescue(()=>99), ERROR fault, control | DATA23 then DATA99; output stays open, as recovery owns terminal policy. |
| race, other dep silent | DATA23; no COMPLETE despite winning source's COMPLETE in the same array. |

Source causes: tap observer, withLatestFrom and valve check terminal and return before their
DATA path; race selects/forwards its first winner in one branch and only checks winner terminal
in a later already-winner branch. These current-code findings challenge the earlier generic
QA-5 family statement that immediate forwards simply preserve current DATA; that settlement-only
audit did not establish mixed-terminal correctness for every body. Preserve that evidence limit.

Recommended repair policy, NOT implemented/independently selected here: when an otherwise
serviceable array's DATA is admitted by that operator's existing selection policy, transparent
tap/open-valve and primary withLatestFrom process it before their terminal action. race must handle
the newly selected winner's same-array terminal after its admitted DATA. Keep one combined raw
input invocation; do not fix these bodies by forcing two core invocations or inventing a priority
flag, extra terminal status or new queue. Preserve intentional gate/notifier/winner suppression
elsewhere; no blanket rule that every operator emits all incoming DATA.

#### Work — closure status and next discussion

Minimum facts/owners/read permissions and boundary ordering are now consolidated; no newly required
runtime fact or manager emerged. Concrete remaining discussion is the version cost/switch/counter/
hash package, the single persist entrypoint recommendation, and the terminal-array operator repair
policy. Existing qualified original-consumer/G9 provenance gaps remain evidence work; this bounded
audit does not close them. Rules supersession/refinement and separately authorized runtime/formal/
conformance work remain next delivery phases. Deferred capabilities stay deferred.

Reviewed core.ts, current version helpers/restore guard, graph raw/value sugar, ctx state/helpers,
operator export set and family source seams, relevant accepted session chains and current rule rows.
One new8-case baseline diagnostic plus one static46-name classification check; no full TS suite,
benchmark or sibling-runtime run. Only existing note and the new portable probe changed; no runtime,
public API/schema, normative Rules/formal/conformance, JSONL/ledger/D#, commit or push mutations.

### Current-snapshot hash and operator order accepted; version label and persist scope clarification (2026-11-05)

**Rules — user disposition.** Annotation1 explicitly accepts hash describing the current retained
snapshot, including silent updates, and asks whether this belongs to version2.0. Annotation2
clarifies ordinary message-tier order and explicit operator-specific selection/ordering, accepting
the qualified DATA-before-terminal direction. Annotation3 asks whether private-state persist affects
whole-graph persistence; it is a scope question, not independent approval of the proposed API naming.
These are review acceptance/clarification only; no runtime/normative implementation authorization.

**Decisions — hash and version label.** Select consistency between the optional hash and the current
retained value/absence: a real silent snapshot update must update the hash as well, without creating
live DATA. This closes the old-hash20/cache30 meaning fork in the closure audit. Exact canonical
absence/previous-CID/schema transitions remain contract work, not permission to serialize native
objects or introduce a new hash log. The two-base-position always-on policy and old DATA-counter
removal remain separately unselected; do not infer them from this hash approval.

"Version2.0" can describe the revised versioning design conversationally, but is not an admitted
public option, package release milestone, checkpoint format number or level:2. Current code and
relocated graphrefly:D109 define only levels0/1 and reserve V2/V3 pending separate design. This
review has not assigned that reserved level to the new revision/valueRevision plus optional-hash
scheme. Explain that distinction rather than promise implementation under an existing V2 contract.

**Decisions — operator order.** Gate is an operator's permission/selection policy (e.g. valve's
control input); notifier is an input role that triggers an action (buffer flush or takeUntil stop),
not a new node/message type. Preserve explicit selection rules: a closed valve can suppress DATA;
takeUntil can choose its notifier stop over same-invocation source DATA. These do not contradict
retention of every occurrence by the substrate. Ordinary admitted input follows existing tiers
DIRTY2, DATA/RESOLVED3, INVALIDATE4, COMPLETE/ERROR5. Where the operator's contract admits both
DATA and terminal processing, handle the admitted DATA before terminal. Any distinct selection/
ordering belongs explicitly to that operator's contract, not an accidental terminal-first return.

Record the qualified repair direction accepted: tap observer, primary withLatestFrom and an open
valve should not lose admitted same-array DATA solely by terminal preemption; race handles its new
winner's same-array terminal after its admitted DATA. Keep one combined raw invocation and the
selected explicit output-array boundaries; do not add two-call core lowering, a new priority flag
or blanket forwarding by every operator. November5 diagnostic remains current-code evidence only.

**Rules/clarification — private retention versus graph checkpoint.** ctx.state.persist(on?) controls
one node's private memory at an actual fresh-lifecycle retain/clear boundary. It does not initiate
graph checkpoint/storage and is not an include/exclude-node switch. When a supported checkpoint
includes the node, its current represented private state AND retention policy are captured, even
with persist:false. Restore preserves that checkpointed private state: restore is not itself a
fresh-lifecycle wipe. Later genuine fresh-life transitions apply the saved retention policy.
persist:true does not make arbitrary sockets, functions, timers or unrepresented work serializable;
unsupported/private-data encoding limitations still apply under the existing capture contract.
Current collection non-authoritative helper caches keep their explicit collection-owned exception.

The stored ctxState.persist boolean is the representation of this one retention policy. The
single-entrypoint recommendation remains a public-expression proposal; the user has asked its
meaning, not approved additional graph-wide persistence behavior. No second runtime flag/store or
global persistence switch is proposed by this clarification.

**Work/evidence.** Read current node/versioning.ts levels/validation, relocated graphrefly:D109,
graph._checkpointNode private-state capture, CtxState contract/state setter and accepted private
retention/restore boundary. Existing graph capture records private data regardless of persist,
apart from the explicit non-authoritative collection-helper path. Source and review evidence do
not implement the new hash meaning or operator repairs. Updated thematic cursor; only this note
changed, with no new tests/probes/API/schema/normative/formal/conformance/JSONL/ledger/D#/commit/push.

### Persistence clarification accepted; final version-policy choices and review closure boundary (2026-11-05)

**Rules — disposition.** The user says understood/agreed after the version-label, operator tier/
selection and persistence-scope explanation, then asks whether discussion is complete. Record
acceptance of those explanations and the reviewed existing ctx.state.persist(on?) private-retention
surface without a second graph-wide persistence switch. This does not convert the separately
reserved base-version cost/opt-out and legacy counter questions into approval.

**Decisions — bounded remaining discussion.** Core behavior/owner/ordering walkthrough is ready
to close subject to two final explicit version-policy choices:
1. Recommend always maintaining revision/valueRevision and leaving hashing optional, replacing
   an all-off versioning switch. Cost is two base scalar positions and their updates; benefit is
   no reader-dependent enable/retire state or disabled recovery evidence.
2. Recommend removing the automatically maintained legacy DATA-only counter, with explicit
   application/diagnostic counting when required. It is not an alias for either revision position.
These are still recommendations. The current-snapshot hash meaning, silent snapshot handling,
operator qualified DATA-before-terminal direction and single private-retention surface do not
need another round merely because the final contract wording is not yet assembled.

**Work — closure is not delivery completion.** Once the two choices are resolved, move to the
promised concise Rules reconciliation, unique-owner rationale and implementation/evidence plan.
Exact portable encoding/previous-CID/schema transition details must be specified consistently;
surface a genuine new material fork if that preparation reveals one, rather than deciding it
silently or assuming all details are already locked. Original consumer/G9 provenance gaps and
formal/conformance/runtime repairs stay visible as unfinished work. No full-runtime verification,
all-QA completion or implementation authorization follows from discussion closure. Existing
deferred capabilities stay deferred.

Rechecked closure inventory and explicit acceptance chain. This turn changes only this session
note/cursor, with no new probe/test/runtime/API/schema/normative/formal/conformance/JSONL/ledger/
D#/commit/push change.


### Rules reconciliation output: revision manifest and validation receipts (2026-11-05)

#### Rules — final approvals and canonical draft

The user explicitly accepted both remaining version choices: always maintain revision/valueRevision
with hashing optional, and remove the independent automatic DATA counter. The user then authorized
refining/unifying Rules, preserving rationale in Decisions and follow-up tasks in Work, surfacing
only genuine unresolved conflicts. This supersedes the old review-only/no-ledger-edit scope for this
bounded records slice; it does not authorize runtime implementation, commit or push.

Admitted graphrefly:D796 and wrote its 50 concise rule bodies once in spec/rules.jsonl. They express
42 existing-ID successors and 8 new logical-contract IDs. New normative bodies contain4701 whitespace-
delimited words, versus4985 in the42 predecessor statements, while adding explicit ownership,
observer, failure, revision and recovery obligations. This is a text-size observation, not a proof
of semantic completeness. No new message/tier or physical layout is mandated.

The affected existing rules include active predecessors and historical drafts. All old rows retain
their exact contents; no new activated_by or predecessor transition has been written. The resolved
current protocol remains23 rules as before. New rule activation and its exact revise edges belong
to B140's formal/scenario/activation boundary; this prevents false claims that old passes validate
new traces. New draft bodies and authored conformance requirements are concrete reviewable artifacts,
not merely another summary of the chat.

#### Decisions — canonical rationale and review repairs

D796 is one root protocol decision for the accepted cohesive revision set, with partial supersession
limited to the changed predecessor clauses. It preserves the reasons for occurrences, separate
invocation/publication pause, ordered requests, topology/lifecycle/output identity, local-effect/
publication staging, targeted balancing, private retention, two base revisions and current-snapshot
hashing. It does not copy old decision bodies, claim operator syntax is cross-runtime parity, or
mint a decision for each repair/test. Private retention remains independent of checkpoint inclusion.

Three independent read-only QA lenses reviewed the candidate contract, interaction traces and
verification gaps under the shared QA workflow. Repairs recovered ALREADY ACCEPTED distinctions:
- quiet PULL RESUME with no demand must not unconditionally flush backlog;
- reject accumulated batch DATA/RESOLVED conflict before staging mutation; caught rejection keeps
  earlier valid material;
- early-DIRTY observer requests wait until the full outer batch outcome/settlement boundary;
- computed/producer public down is active-life-bound; stable manual ingress survives ordinary
  nonterminal last-off; terminal/output-execution identity prevents old accepted requests reviving
  after reset or mutating intrinsic state before a lawful drop;
- public batch from observer/initialization/lifecycle callbacks rejects before its body executes;
- default-pause local INVALIDATE timing remains immediate through its ordinary publication path;
- scenarios explicitly distinguish a later array's own prefix, stale compensation versus a newly
  open interval, and resumeAll discard of DATA in the terminal-containing array itself.

The output-execution identity in the owner table is the previously accepted QA-19 logical authority,
not a new public epoch counter or duplicate notification/lifecycle flag. Each narrow repair was
re-read by its originating reviewer with no residual material finding. These are static review
results; no runtime or new formal execution is claimed. No new unresolved semantic conflict arose.

#### Rules — planned revision/activation manifest

| Successor / new rule | Predecessor disposition at this handoff |
| --- | --- |
| [R-msg-format@2](../../spec/rules.jsonl#L70) | R-msg-format@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-tier@2](../../spec/rules.jsonl#L71) | R-tier@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-wave-boundary@2](../../spec/rules.jsonl#L72) | R-wave-boundary@1 remains activated; planned revise to this successor only with explicit activation. |
| [R-dirty-before-data@2](../../spec/rules.jsonl#L73) | R-dirty-before-data@1 remains activated; planned revise to this successor only with explicit activation. |
| [R-two-phase@2](../../spec/rules.jsonl#L74) | R-two-phase@1 remains activated; planned revise to this successor only with explicit activation. |
| [R-diamond@2](../../spec/rules.jsonl#L75) | R-diamond@1 remains activated; planned revise to this successor only with explicit activation. |
| [R-same-wave-merge@2](../../spec/rules.jsonl#L76) | R-same-wave-merge@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-invalidate-idempotent@2](../../spec/rules.jsonl#L77) | R-invalidate-idempotent@1 remains activated; planned revise to this successor only with explicit activation. |
| [R-push-subscribe@2](../../spec/rules.jsonl#L78) | R-push-subscribe@1 remains activated; planned revise to this successor only with explicit activation. |
| [R-terminal@2](../../spec/rules.jsonl#L79) | R-terminal@1 remains activated; planned revise to this successor only with explicit activation. |
| [R-deps-terminal@2](../../spec/rules.jsonl#L80) | R-deps-terminal@1 remains activated; planned revise to this successor only with explicit activation. |
| [R-ctx-up@2](../../spec/rules.jsonl#L81) | R-ctx-up@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-node-iface@2](../../spec/rules.jsonl#L82) | R-node-iface@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-status-enum@2](../../spec/rules.jsonl#L83) | R-status-enum@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-rom-ram@2](../../spec/rules.jsonl#L84) | R-rom-ram@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-fn-contract@2](../../spec/rules.jsonl#L85) | R-fn-contract@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-ctx-wave-data@2](../../spec/rules.jsonl#L86) | R-ctx-wave-data@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-cleanup-hooks@2](../../spec/rules.jsonl#L87) | R-cleanup-hooks@1 remains activated; planned revise to this successor only with explicit activation. |
| [R-ctx-state@2](../../spec/rules.jsonl#L88) | R-ctx-state@1 remains activated; planned revise to this successor only with explicit activation. |
| [R-first-run-gate@2](../../spec/rules.jsonl#L89) | R-first-run-gate@1 remains activated; planned revise to this successor only with explicit activation. |
| [R-initial@2](../../spec/rules.jsonl#L90) | R-initial@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-dynamic-node@2](../../spec/rules.jsonl#L91) | R-dynamic-node@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-pause-lockset@2](../../spec/rules.jsonl#L92) | R-pause-lockset@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-pause-modes@2](../../spec/rules.jsonl#L93) | R-pause-modes@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-async-paused@2](../../spec/rules.jsonl#L94) | R-async-paused@1 remains activated; planned revise to this successor only with explicit activation. |
| [R-replay-buffer@2](../../spec/rules.jsonl#L95) | R-replay-buffer@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-restore@2](../../spec/rules.jsonl#L96) | R-restore@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-snapshot@2](../../spec/rules.jsonl#L97) | R-snapshot@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-rewire@2](../../spec/rules.jsonl#L98) | R-rewire@1 remains activated; planned revise to this successor only with explicit activation. |
| [R-reentrancy@2](../../spec/rules.jsonl#L99) | R-reentrancy@1 remains activated; planned revise to this successor only with explicit activation. |
| [R-up-at-source@2](../../spec/rules.jsonl#L100) | R-up-at-source@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-rewire-deferred@2](../../spec/rules.jsonl#L101) | R-rewire-deferred@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-rewire-deferred-committed-boundary@2](../../spec/rules.jsonl#L102) | R-rewire-deferred-committed-boundary@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-resolved-undirty@2](../../spec/rules.jsonl#L103) | R-resolved-undirty@1 remains activated; planned revise to this successor only with explicit activation. |
| [R-paused-invalidate@2](../../spec/rules.jsonl#L104) | R-paused-invalidate@1 remains activated; planned revise to this successor only with explicit activation. |
| [R-terminal-settles-dirty@2](../../spec/rules.jsonl#L105) | R-terminal-settles-dirty@1 remains activated; planned revise to this successor only with explicit activation. |
| [R-pull@2](../../spec/rules.jsonl#L106) | R-pull@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-up-routing@2](../../spec/rules.jsonl#L107) | R-up-routing@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-up-routing-diamond@2](../../spec/rules.jsonl#L108) | R-up-routing-diamond@1 remains draft; planned revise to this successor only with explicit activation. |
| [R-undirty-settle-timing@2](../../spec/rules.jsonl#L109) | R-undirty-settle-timing@1 remains activated; planned revise to this successor only with explicit activation. |
| [R-rewire-async-live-edge@2](../../spec/rules.jsonl#L110) | R-rewire-async-live-edge@1 remains activated; planned revise to this successor only with explicit activation. |
| [R-rewire-batch-boundary@2](../../spec/rules.jsonl#L111) | R-rewire-batch-boundary@1 remains activated; planned revise to this successor only with explicit activation. |
| [R-subscription-ownership@1](../../spec/rules.jsonl#L112) | New rule ID; draft only, no predecessor or implicit activation. |
| [R-observer-boundary@1](../../spec/rules.jsonl#L113) | New rule ID; draft only, no predecessor or implicit activation. |
| [R-ctx-lifetime@1](../../spec/rules.jsonl#L114) | New rule ID; draft only, no predecessor or implicit activation. |
| [R-operation-failure@1](../../spec/rules.jsonl#L115) | New rule ID; draft only, no predecessor or implicit activation. |
| [R-output-ownership@1](../../spec/rules.jsonl#L116) | New rule ID; draft only, no predecessor or implicit activation. |
| [R-node-revision@1](../../spec/rules.jsonl#L117) | New rule ID; draft only, no predecessor or implicit activation. |
| [R-input-receipts@1](../../spec/rules.jsonl#L118) | New rule ID; draft only, no predecessor or implicit activation. |
| [R-resource-reattach@1](../../spec/rules.jsonl#L119) | New rule ID; draft only, no predecessor or implicit activation. |

This manifest is a work plan, not additional canonical transition metadata. Actual transitions
will be written once at the owning predecessor row together with explicit successor activation.
Unchanged rule IDs remain governed by their existing records. Former equality substitution stays
retired; this handoff does not revive it or infer activation for all historical drafts.

#### Work — unique follow-up and verification scope

Root B140 contains the integration outcome and acceptance. It routes runtime implementation and
operator/sugar/API work to their owners rather than copying those bodies into a root ledger.
Immediate outstanding work is formal/model alignment, exact hash/absence/previous-CID/receipt
encoding, revision-qualified conformance harnesses, original consumer/G9 provenance qualification
and explicit activation. TS mixed-terminal tap/withLatestFrom/valve/race repairs remain package work.
DS-15's overlapping concerns need coverage mapping, not wholesale repeated design discussion.
Unsupported in-progress recovery remains rejected; deferred capabilities remain deferred.

Added C-28..C-39 with discriminating cross-axis traces and todo for TS/Rust/Python. Old scenario
statuses and formal artifacts are untouched. Coverage is currently derived by rule ID, so the
dashboard's reduced uncovered count after adding these rows is NOT new revision verification.
No per-language runtime, TLC or mutation result is inferred from authored scenarios or link gates.

Final validation receipts, 2026-11-05 (after review repairs):
- node dashboard/build.mjs --check: exit0; unresolved references/revision cycles/ambiguous current governors=0; current protocol remains23 rules;12 authored scenarios remain todo.
- npm run authority:check:workspace: exit0; all available owner ledgers resolve, unverified relocations=0. This is structural authority validation, not semantic/runtime completion.
- npm run work:check:workspace: exit0; errors, dependency/supersession cycles and strict work orphans are empty.
- npm run test:authority: exit0;40 tests,40 pass,0 fail/skip/cancel/todo. These test the resolver/federation/work machinery, not the replacement runtime.
- Scoped git diff --check: exit0. Four pre-edit JSONL prefixes retain their exact baseline SHA-256 (rules69 rows, conformance30, root decisions472, backlog135); unrelated edits were not reset.
- Navigation validation:47 entry/map links resolve;50 new draft rule rows have zero activation fields. Independent QA corrections were re-read cleanly; no TLC, runtime suite, new baseline probe or benchmark was run in this consolidation slice.

Canonical artifact hashes at handoff (mutable working-tree state, not committed evidence):
- spec/rules.jsonl: sha256:17ce23d85a4d48774cde3604a25eff9a6855facdea23b0df10a783373f0f90a2.
- spec/conformance.jsonl: sha256:0a725db10ab2673451583a12f317a8040a40d0f7984a9cd8125a257fa3a6c8f8.
- decisions/decisions.jsonl: sha256:950bae35883d82fa69172d754dffd6574b6d0d492d2d6a173d5fc9f7a7d243e7.
- plan/backlog.jsonl: sha256:941035439a0fdf1fa44aa723ef80d64b4d853f3a9ddbc6fb95d84983289822bb.

Existing known authority warnings/legacy evidence debt remain reported by the gates; exit0 is not a
claim those historical warnings or original consumer/G9 provenance gaps were resolved. Only the five
canonical record/index files and this existing session note changed for this slice. Runtime and formal
implementation, commit and push were not performed.
