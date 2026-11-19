# Operator walkthrough and review notes

DS-20 · Discussion started 2026-11-13 · Review snapshot 2026-11-18 · Codex chat 01a1d682-9518-7143-8f1f-fbeab60c2841

This is a review record. “Agreed” means the maintainer selected the design during the walkthrough. For current obligations see [rule revisions](../../spec/rules.jsonl) and the [revision contract](../../authority/README.md). Agreed invalidation behavior and the agreed design review method are recorded separately below. Package API spellings and implementation status need separate verification. The original temporary inventory is no longer available at its supplied path. The chat is the source for these choices.

## Agreed operator choices and tradeoffs

Operators are the primary vocabulary for occurrence processing and orchestration. State management also gets a familiar state/derived pair. Ordinary map sees every occurrence, while derived computes from latest dependency values. Keep a convenient operation when its frequency or lifetime handling justifies the name, even if a longer composition can express it.

| Choice | Observable behavior and reason |
|---|---|
| Keep map, filter, tap | Process individual DATA in order and preserve surviving array groups. Omit empty filtered arrays. Tap is synchronous, ignores its return, and a throw errors the branch. Drop onFirstData. |
| Keep scan, reduce | With a seed, scan emits each intermediate in its input group, without an initial seed emission. Reduce emits one result with normal COMPLETE, including the seed for an empty source. ERROR discards its pending result. |
| Keep distinctUntilChanged, pairwise | Compare against the last emitted value using caller equality or documented language equality. Pairwise starts on the second input, crosses arrays, and assigns the pair to the second input's group. |
| Keep take, skip, takeWhile, first, last | Count occurrences. Nonnegative integer counts, take(0) completes on activation, skip(0) passes through, and the nth take value ends its branch in the same array. TakeWhile excludes the first false item. First/last can take a predicate. Empty/no match completes without DATA. Last flushes only on normal completion. Drop find and elementAt. |
| Keep merge and withLatestFrom, drop combine | Merge preserves arrays with dependency order as the same-wave tie-breaker. All sources must complete, any error ends it. WithLatestFrom has a primary clock: emit once per primary occurrence, preserve primary groups, use the final secondary latest for the wave. Drop primary occurrences while any latest is missing. Secondary-only activity produces nothing. A completed secondary keeps its latest, primary completion ends the branch, errors propagate. Derived covers latest-state combination without another public alias. |
| Keep zip, concat, race | Zip queues by ordinal position, emits all tuples formed in one run in one array, and ends when an ended input has no queued item left. No implicit capacity/drop. Concat subscribes only to the current source, so switching later gives its normal snapshot, with no backlog guarantee. Race selects the first DATA or terminal, breaking same-wave ties by dependency order, then releases losing subscriptions. |
| Keep sample and takeUntil | Sample consumes a fresh pending source value on a clock tick. Multiple ticks cannot repeat it without another source occurrence. Same wave: collect source before clock. Source COMPLETE does not flush and clock COMPLETE alone does not end sampling. TakeUntil completes its branch on notifier DATA, ahead of simultaneous source DATA; notifier COMPLETE alone does nothing. AbortSignal handles resource cancellation separately. |
| Keep buffer and bufferCount | Collect payloads, dropping only input-array grouping. DATA([1,2]) then DATA(3) yields [[1,2],3]. Three scalar occurrences yield [1,2,3]. Flush takes same-wave source DATA first, skips empty batches, and flush-source COMPLETE alone does not end collection. Count uses positive, nonoverlapping batches. Normal COMPLETE flushes a nonempty tail with the terminal. ERROR drops the tail. History preserves wave and array grouping. |
| Keep switchMap, mergeMap, concatMap, exhaustMap | For an idle operator receiving [A,B],[C] in one wave, switch projects only C, merge accepts all subject to capacity, concat starts A and queues B,C, exhaust accepts A and ignores B,C even if A ends immediately on attachment. Queued inputs are projected only when admitted. First forward existing inner DATA and free slots from ended inners. Outer COMPLETE drains accepted work. A connected error or project throw errors the branch. |
| Keep debounce, throttle, auditTime | Debounce waits a full quiet interval after the last occurrence. Throttle admits the first, with no trailing emission. AuditTime opens a fixed window on input and emits its latest candidate at the original deadline. Normal COMPLETE immediately flushes pending debounce/auditTime candidates; ERROR discards them. Timers do not hold a wave open. Drop generic audit: separate notifier/window composition can cover the use case, and no frequent case justified another selection API. |
| Keep delay, bufferTime, timeout | Delay moves DATA, its groups, and normal COMPLETE along the same timeline. ERROR ends immediately and drops pending output. BufferTime batches payloads in fixed windows from activation, skips empty windows and flushes a nonempty tail on normal completion. Timeout measures silence from activation and after each DATA (including an activation snapshot). Only DATA resets it. Competing waves follow processing order. Expiry raises an error on this branch, leaving recovery to catchError/retry. |
| Replace rescue with catchError | On source ERROR, keep prior DATA, including preceding DATA in the terminal array, and switch at most once per execution to the Node returned by the handler. Normal COMPLETE bypasses it. A handler throw or replacement ERROR ends the branch with that new error. The replacement supplies its ordinary snapshot and terminal. Compose a second handler for a second fallback. |
| Keep retry and repeat | Use the restart owner/inner mechanism. Retry on ERROR within the shared retry policy (maxAttempts includes the first launch, with configured backoff). Repeat counts normally completed rounds separately and resets the per-round attempt budget. Already delivered DATA remains delivered. |
| Keep valve and pause; drop settle | Valve gates DATA using the final control value for the wave, initially closed. No replay on reopening, no abortInFlight. Pause holds arrays for later release. Explicit valve is preferable to a three-operator composition for common gating. Settle counts local runs and cannot by itself establish convergence or elapsed silence. |
| Keep latestAsync | Common switch-to-latest single-result task with cooperative cancellation and suppression of stale successes and errors. Only the final input in a wave starts a job. Outer COMPLETE waits for the current job. Its callback may return Promise/PromiseLike. Prefer Node outputs for higher-order project/recovery callbacks. Keyed sharing and first-value extraction solve different problems. |

## Agreed recovery direction

- Ordinary logical state survives a checkpoint. Standard operator recipes carry registered factory refs and JSON configuration. A missing restoration recipe or unserializable required value must surface explicitly.
- Restore time operators as newly created on activation, with fresh windows/deadlines and current dependency snapshots. Pending timer candidates, old delay queues and elapsed time are discarded. Ended nodes retain their result/terminal.
- Keep high-order scheduling progress: active inner identities/recipes, queued unprojected inputs in FIFO order, and outer completion. Reconstruct accepted inners without rerunning project. Do not treat an unchanged saved outer or already forwarded inner snapshot as a new occurrence. Restore a switched catchError on its replacement without invoking the handler again.
- Ordinary factories create fresh work. Explicitly resumable factories own keyed job identity and lookup. Reconnect requires a store that outlives the graph; process-local promise sharing alone cannot guarantee recovery after process loss. A consumer releasing a shared job need not cancel the actual task.
- Retry/repeat keep completed rounds and used attempts. A pending retry waits the full delay for that same pending attempt after restore. Reconnecting the same job consumes no extra attempt; actually launching fresh work consumes budget. If reconnect fails and the budget is exhausted, surface a recovery failure.
- Allocate recovery-only records according to a graph checkpoint switch. Keep runtime state required by normal execution under either setting. Keep one owner of each record, avoiding duplicate recipe bookkeeping across replace/rollback. Potential memory or speed gains are unmeasured. See the agreed graph option below.

## Agreed invalidation behavior

An effective INVALIDATE retracts the retained output. It cannot undo delivered occurrences. The automatic policy keeps private state; modules can handle arriving invalidations manually. A node without a retained value can suppress propagation. Actual lifetime closure releases resources and drops private state. On later activation an unended computed node runs on dependency snapshots. Business segmentation can be expressed by creating a fresh branch with switchMap.

| Operator | On arriving INVALIDATE |
|---|---|
| history | Preserve the grouped history and its readable list. Express a new segment with switchMap. No resetOnInvalidate flag. This changes the existing R-history@1 draft and reference module. |
| buffer, bufferCount, pairwise | Clear output snapshot, retain internal occurrences. A, invalidation, B may still produce batch [A,B] or pair (A,B). |
| zip, withLatestFrom | Both clear the output snapshot. Zip keeps unmatched queues. WithLatestFrom clears only an invalidated secondary latest; primary invalidation preserves secondaries. |
| debounce, auditTime, throttle | Clear output. Debounce drops candidate and timer. AuditTime drops candidate and retains the window end. Throttle retains the active suppression deadline. |
| bufferTime, timeout | Clear output. BufferTime retains collected occurrences and window end. Timeout retains its existing deadline. |
| delay | Delay INVALIDATE alongside DATA in source order. Invalidate the output snapshot when the delayed invalidation arrives. ERROR remains immediate. |

### Higher-order operators (agreed)

An outer INVALIDATE clears the owner's retained output. switchMap releases its selected inner and ignores subsequent results from that selection. mergeMap and concatMap keep running accepted inners and retain unprojected inputs in FIFO order. exhaustMap keeps its accepted inner busy and continues to ignore new outer values until the slot opens.

An attached inner's INVALIDATE clears the owner's retained output. The inner stays attached and keeps its slot; the queue and other accepted inners survive. For mergeMap this holds even if B supplied the last output and A invalidates: a new subscriber sees no retained value until fresh DATA arrives. The maintainer chose this broader retraction to avoid tracking the source of the output snapshot. An inner which was already detached has no further say over the snapshot.

### latestAsync (agreed)

On an arriving source INVALIDATE, clear the output snapshot, revoke the current invocation's right to publish, and abort its task signal. A late fulfillment or rejection of that invocation is ignored, even if no newer task has started or the old task ignores cancellation. This also applies before the first output, when there is work to cancel but no snapshot to retract downstream. Keep the operator active. With surviving DATA after the last invalidation in the same wave, start just one invocation for its final value using a fresh signal. Without subsequent DATA, wait for input; source COMPLETE with no current job can finish immediately. A value delivered before invalidation remains a past occurrence. Pending/RESOLVED alone does not revoke a job.

### retry, repeat and catchError (agreed)

- retry and repeat retract the retained output on an effective invalidation of their active inner. Keep the current attempt, retry budget and round. Only an eligible ERROR schedules a retry; only a normal COMPLETE advances repeat. The inner applies its own input invalidation policy to its work.
- During backoff the failed inner has ended. If an upstream dependency held by the owner invalidates it during the wait, retract any retained owner output. Keep the pending attempt, original deadline and budget. At the deadline apply the usual restart eligibility check. A new attempt reads the then-current dependency snapshots.
- catchError forwards invalidation from whichever branch is selected and stays on it. An original-source ERROR can still switch once after invalidation. On the replacement, invalidation retracts the output while preserving that selection; a later replacement ERROR ends the branch. Invalidation never calls or re-arms the handler.
- In a wave containing invalidation followed by a terminal, apply the invalidation first and then the selected branch's normal terminal policy once.

### scan, reduce and distinctUntilChanged (agreed)

- scan and reduce retain their accumulator across source invalidation. scan retracts its visible output. Neither calls the reducer or emits the accumulator on invalidation. Across separate waves with seed 0 and sum, DATA(2), INVALIDATE, DATA(3), COMPLETE yields intermediate scan values 2 and 5 with the retraction between them. reduce emits 5 with COMPLETE. Completing directly after the invalidation instead yields 2 from reduce.
- distinctUntilChanged retracts its output and clears its comparison baseline. The first subsequent DATA passes even when equal to the retracted value. For A, A, INVALIDATE, A, A in separate waves, downstream sees DATA(A), INVALIDATE, DATA(A). Retaining the baseline instead could leave a downstream snapshot empty indefinitely while valid equal values keep arriving.

### take, skip, takeWhile, first and last (agreed)

For an open branch, source INVALIDATE retracts any retained output and leaves selection progress intact. take and skip count only DATA and keep the number already seen. takeWhile and first(predicate) do not invoke a predicate on invalidation. An open branch continues with the next DATA; a branch already ended by a match, limit or failed takeWhile predicate stays ended with its terminal snapshot.

last(predicate) retains the most recent matching occurrence across invalidation. With separate waves DATA(A), INVALIDATE, COMPLETE, an A that matched is delivered as [DATA(A), COMPLETE]. The operation answers which occurrence last matched during the lifetime. An empty or never-matching stream completes without DATA, and ERROR still discards the candidate.

## Agreed documentation direction: discovering operator behavior when composing a graph

Use an operator index and a short entry at the package API or operator-family README. Give the normal use first, then observable exceptions by topic (e.g. invalidation, normal completion, recovery), with links to their owning contracts and scenario IDs. A shared scenario has one canonical input/expected trace; link or render it at each relevant operator. Keep implementation-specific guarantees and tests with their package. Distinguish approved discussion from activated behavior and from verification for a particular runtime. For an interaction such as distinctUntilChanged followed by pairwise across an invalidation, each entry should lead to the same composition example. Physical distribution of shared conformance records would change current ownership/tooling and is a separate decision.

## Agreed invalidation behavior for data and notifier inputs

For sample, buffer and takeUntil, notifier DATA triggers an action. Invalidation of the notifier alone leaves the operator's output snapshot and outstanding source state intact. Apply normal wave normalization first: any surviving notifier DATA still triggers its ordinary action.

| Operator | Source INVALIDATE | Notifier INVALIDATE alone |
|---|---|---|
| sample | Retract output and discard the pending source value. A clock tick must await a new source occurrence before it can emit again. | Preserve both the previous sample snapshot and any pending source value. No tick is consumed. |
| buffer | Retract output, retain buffered payloads (already agreed). | Preserve the previous batch snapshot and the pending batch; wait for flush DATA or normal source completion. |
| takeUntil | Retract output and continue listening to both inputs while open. | Keep the branch open and preserve its output. Only notifier DATA triggers a stop. An already ended branch stays ended. |

Review trace: source A, clock DATA, source B, clock INVALIDATE in separate waves. The sample snapshot remains A, and the next clock DATA emits B. Replacing clock INVALIDATE with source INVALIDATE clears both the snapshot and the pending B. Per-input handling matters: the kernel's automatic policy would treat either dependency's invalidation alike.

## Agreed review method: predict behavior with fewer rules

Candidate model for INVALIDATE (not a new protocol rule): retract the current value, preserve processed occurrences and progress, and handle each input according to what its DATA supplies (current value, accepted work, or action trigger). For each operator separately ask what the visible snapshot represents and whether invalidation reaches it. To test composition, a sum scan seeded at 0 feeding distinctUntilChanged on successive waves 2, INVALIDATE, 0 should emit 2, INVALIDATE, 2. This is a prediction from the discussion, not runtime evidence.

Counterexamples for a blind review: both scan and history summarize past occurrences, but only history keeps its published snapshot on source invalidation. An invalidation from mergeMap inner A clears a snapshot supplied by B. Derive the choices if possible or identify which extra premise is needed. Have the reviewer predict an unseen trace from the short operator contracts and common principles, then compare with the recorded outcomes. Keep independent choices explicit; reconsider recurring exceptions before introducing more rules.

### Applying the method to same-wave ordering (review conclusion accepted)

R-wave@3 and R-invocation@3 give one settled view of ordered, grouped inputs per dependency and at most one invocation per wave. The operator still defines how to combine roles. Given source [1,2] and one notifier DATA in the same wave: sample emits 2, buffer emits one batch [1,2], and takeUntil emits COMPLETE without source DATA. Composition probe with both operators already active and an empty buffer: buffer(source, tick) feeding takeUntil(bufferOutput, tick) on that same tick produces a batch at the buffer and only COMPLETE at the final sink. A global convention that puts every notifier first or last cannot explain this.

Review irreducible choices separately. A race between two eligible dependencies needs a tie-breaker (declared order, agreed). The name switchMap alone does not say whether an already-attached inner's DATA in the switching wave reaches downstream (forward it before applying the new selection, agreed). Use these as blind prediction checks. These traces describe design outcomes, not runtime test results.

### Applying the method to terminals (review conclusion accepted)

A terminal closes its emitting instance. For an operator consuming that terminal, ask which input ended and what still authorizes delivery. On normal source completion, reduce publishes its accumulated result, bufferCount flushes a nonempty tail, and sample without a clock tick drops its pending candidate. All three propagate source ERROR without converting pending state into final DATA. High-order operators can drain previously accepted work after outer COMPLETE; an ERROR handled by catchError or retry can end one inner without ending its owner.

Prediction from the selected local contracts, with 1, 2 and ERROR in separate waves and a replacement Node that only completes: catchError before a sum reduce makes reduce observe normal completion and emit [DATA(3), COMPLETE]. The same catchError after reduce yields only COMPLETE because reduce has already ended with ERROR. No placement-specific rule is needed.

Remaining explicit choices: the final partial buffer is delivered, debounce and auditTime flush candidates on normal completion even before the timer fires, and delay puts normal completion behind queued DATA but propagates ERROR immediately. Blind review should distinguish these product choices from consequences of the kernel terminal rule.

## Agreed invalidation behavior for valve and pause inputs

On source invalidation, retract any retained output through a closed valve or a paused branch. The pausable also discards held input arrays older than the retraction so resume cannot republish them. Buffer, by contrast, promises a batch of observed occurrences and preserves those payloads.

On control invalidation alone, use the control's final state for the wave. A valve requires an explicit true, so an absent control closes it, preserves the previously admitted output snapshot and drops new inputs until reopened, without replay. For pause, the agreed behavior follows the reference: the lock-state node starts with an empty list; only a present nonempty list pauses. Retracting the entire list releases all held arrays in one wave, preserving their boundaries. If nothing is held, the previous output snapshot remains. The cost is that invalidating a shared list removes every controller's lock at once. Normal per-owner release uses resume(lock). The alternative considered was to hold until an explicit empty list arrives. In a release wave that also carries source invalidation, clear old held arrays first; only surviving new source data can be released.

## Restore prediction exercise: delay feeding a sum scan (review conclusion accepted)

Take an active, open graph with a single scalar source snapshot, delay(100ms) and scan(sum, 0). The scan has already incorporated 10. The source then emits 2. In trace A, capture at a wave boundary before the delay delivers 2. In trace B, capture after the delay has delivered 2 and scan has incorporated it. Restore cold, then subscribe with the source still holding 2 and no subsequent host input. The saved scan accumulators are 10 and 12 respectively. Do not count an existing subscription snapshot twice. The fresh delay schedules the source snapshot on activation, then emits a new DATA(2) in a later wave. Predicted sums after that wave are 12 and 14 respectively. The maintainer accepted these design outcomes; they are not observed runtime results. The general rule for deciding whether to rerun a seeded function on first activation in activated R-checkpoint@1 does not by itself implement fresh temporal recovery.

A value comparison cannot distinguish two equal occurrences. Skipping all activation snapshots would lose the pending 2 in trace A unless additional delivery progress were retained. Fresh temporal execution may re-present a previously delivered input to a state-preserving downstream operator.

### Application choices and candidate conformance traces

When delay is solely for presentation, place the sum scan before delay. A fresh delivery then republishes the absolute total; observers can still receive another occurrence. When delay must precede a business update, carry an event identity allocated at the source across restore and keep applied identity and total in the same checkpointed accumulator. For one ordered source with monotonically increasing sequence numbers, event 41 (+2) after snapshot (40,10) gives (41,12); after snapshot (41,12) it leaves (41,12). A distinct event 42 (+2) still gives (42,14). Equal totals may still be emitted by scan. For unordered streams a single high-water mark can drop legitimate events; use a suitable identity set or replay protocol. For external effects the destination must enforce the identity atomically with the effect. These techniques address duplicate processing; a discarded delay queue with multiple pending inputs is a separate loss case.

Candidate conformance should exercise both checkpoint boundaries above, assert no new contribution on subscription, then check the actual delayed occurrence. Keep application examples in the guide and link the scenario. The agreed plain-sum expectation for trace B is 14.

## Restore prediction exercise: latestAsync job and delivered result (review conclusion accepted)

Capture at a wave boundary with input A still selected. Restore cold. On activation, if the job for A was pending and A remains current, an ordinary factory starts fresh with a new signal. An explicitly resumable factory receives the saved job identity and obtains the same job or its retained result. Reattachment alone must not submit a second external job. The factory owns lookup and must distinguish an unavailable job from an invitation to create new work. New selection or invalidation supersedes A under the ordinary latestAsync rules.

Distinguish completion in the external service from delivery into this graph. If the graph had not committed the result at capture, a resumable factory can supply the stored result on activation. If the graph had already published the result and remained open for later inputs, retain its snapshot and skip invocation for the unchanged saved input. A new subscriber can read the snapshot; a restored downstream accumulator must not count it again. A genuinely new input occurrence may start new work even when its payload equals A. Probe both capture points with a factory submission counter and a downstream count of delivered results.

## Agreed checkpoint option: choose when creating the graph

For ordinary graph creation, default checkpoint support to off. Choose the mode once at construction. An off graph still maintains normal operator state. Do not retain records solely for recovery. capture on this graph returns an explicit disabled error before attempting serialization, even for a graph that happens to contain only recoverable values. For an enabled graph, allocate recovery-only records when needed and use ordinary wave-boundary and serializability checks at capture. Activation of checkpoint support does not itself schedule storage writes or guarantee that a future capture will succeed. A restored graph is checkpoint-enabled by default so it can be captured again.

Review probe: two equivalent open sum scans must emit the same sums with the option off and on. At an idle boundary the off graph rejects capture, while an enabled graph with a registered recipe and serializable state can be captured and restored. The agreed recipe contract below defines when missing reconstruction information is diagnosed.

## Agreed recipe contract: surface failures when the necessary facts are available

On a checkpoint-enabled graph, validate a computed definition before creating or replacing the instance, including dynamically constructed inners. Require a recipe ref and JSON configuration sufficient to rebuild the definition, including callback refs as needed. A registered enclosing factory may construct a closure from its config; a naked callback with no reconstruction path is local-only. Rejection leaves the old definition and subscriptions intact on replace. On an ordinary checkpoint-disabled graph, local-only callbacks remain valid.

Library/package owners supply built-in operator factories; application or module authors supply stable refs and factories for custom behavior. The restoring host supplies the registry for its environment. At capture, validate the actual values that must be saved and report the node and field if serialization fails. At restore, resolve the required refs in the target registry and report the node and missing ref before returning any usable graph. This earlier rejection of known local-only definitions differs from the current reference, which can capture a local marker and later refuse restore. Review with missing callback metadata, invalid replacement, non-JSON runtime state and a target missing a referenced factory.

## Independent review handoff

The scheduled operator walkthrough topics have been discussed. Begin the independent review with the [prediction exercise](REVIEW-operator-prediction-exercise.md); open this session only after recording the first-pass answers. The host adapter catalog remains a separate walkthrough.

Ask the independent reviewer to try merge/concat/race invalidation, conflicting same-wave signals and the other probes below from the short contracts. Bring back cases with two defensible observable outputs for a maintainer decision.

Independent review returned 2026-11-18 (Fable): [review and rule reconciliation proposal](PROPOSAL-DS20-operator-review-reconciliation.md). The maintainer agreed to its recommendations for Q1–Q9 in conversation on 2026-11-18. The choices that differ from the rules are recorded as graphrefly:D812, and the ownership of operator contracts as graphrefly:D813. No rule revision exists yet, and nothing above has been changed to match either.

## Questions for independent review

1. Trace cross-wave and same-wave DATA/INVALIDATE/terminal combinations under R-wave@3, R-invalidation@1 and R-terminals@1. Which semantics require manual policies? Can an intervening empty node swallow an invalidation needed by a pending task?
2. Check the proposed delay timeline against the kernel's array normalization and late output grouping. Compare the chosen debounce completion and delay grouping with the actual package implementations.
3. Reconcile fresh temporal recovery, inner reattachment, and opt-in records with activated R-checkpoint@1 (including unchanged-input suppression and in-flight loss). R-history@1, R-pause@1 and R-restart@1 are draft surfaces. Audit behavior per runtime before claiming parity.
4. Resolve invalidation for remaining stateful operators (including control or notifier inputs), same-wave high-order precedence, and any retention of stale callbacks. The conversation explored examples beyond the confirmed rows above.
5. Review the agreed checkpoint switch defaults and lifecycle, and the agreed callback/recipe registration ownership and local-only failure behavior. Source adapters fromAny, singleFromAny and firstValueFrom were discussed for comparison; their full API remains outside the selected operator set.

For follow-up review, cite each affected rule and give a small counterexample trace, the expected output, and whether it reveals a design choice, a rule gap or an implementation difference. Useful starting points are [higher order](../../reference/modules/higher-order.mjs), [restart](../../reference/modules/restart.mjs), [checkpoint](../../reference/modules/checkpoint.mjs), [history](../../reference/modules/history.mjs) and [kernel sugar](../../reference/kernel/sugar.mjs).
