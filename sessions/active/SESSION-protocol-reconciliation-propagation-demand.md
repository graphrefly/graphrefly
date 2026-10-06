# Protocol reconciliation: propagation and demand

DS-16. Non-normative interactive review opened 2026-09-17.
Continues DS-15, which remains active with its outstanding items intact.
User-authorized scope: review and notes only; no rule activation, D# or runtime changes.
After all five themes, reconcile Rules for concision and complete composition semantics.

Resume cursor: see [the 2026-10-05 continuation and handoff](#continuation-reconciliation-and-migration-handoff-2026-10-05).
Later accepted refinements in that section supersede the earlier candidates explicitly named there.

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
before selecting a uniform rule; D161 review remains outstanding. No implementation or normative
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
remain non-auto-unsubscribe. Do not generalize to post-transfer activation failure: TS D161 private
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
method from probe output. TS D161 and construction-scope start already record release before first
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
records release before callbacks and governs retained leases after failure; D161 graph-owned
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
A depless promise source need not announce DIRTY just because activation started; it first sends START.
An async fn returning without output must not automatically produce RESOLVED while a result is owed.

Tradeoff retained: immediate observers get intact arrays; batch and delayed work keep useful advance
notification. "One original down call", logical dirty debt and actual phase delivery are not synonyms.

### User-confirmed pause buffering, drain ownership and failure behavior

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
