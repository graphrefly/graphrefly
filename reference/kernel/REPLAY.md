# Replaying C-28 to C-39

First replay, 2026-11-06, of the D796 candidate scenarios in
[spec/conformance.jsonl](../../spec/conformance.jsonl) against this reference kernel. The scenarios
are prose, so each clause was sorted by where it belongs. Tests are in
[replay.test.mjs](replay.test.mjs) (14) and [kernel.test.mjs](kernel.test.mjs).

Labels:

- **Kernel**: reproduced by the kernel alone; the test is named.
- **Decided away**: the clause manages a situation that a DS-17 decision removed.
- **Changed (O11, O12)**: the draft expects something the user decided against after this replay.
  The 2026-11-08 replay of C-34 and C-8 uses the same label for O4, O7 and K8.
- **Module**: belongs to a module the kernel does not have yet (pause, demand, replay, checkpoint,
  rewire, restart owner, revision observer).
- **Not modeled**: needs a surface the interpreter does not have.

## Summary

| Scenario | Kernel | Decided away | Changed by a decision (O4, O7, O11, O12, K8) | Module or not modeled |
|---|---|---|---|---|
| C-28 intact arrays, early notification | 6 clauses | early-DIRTY observer requests, rollback (O3) | standalone DIRTY prefixes (O11); callback batch rejection (O12) | — |
| C-29 rollback and notification ownership | — | all (O3 and O11): no notification outlives its wave | — | — |
| C-30 pause gates and resumeAll | — | — | re-pause between held arrays | 4 clauses: pause module |
| C-31 intrinsic state and locks | 3 clauses | — | — | 2 clauses: pause module; value evidence: revision observer |
| C-32 PULL demand | — | routed diamond (no routing) | — | 5 clauses: demand module |
| C-33 lifecycle and cleanup | 5 clauses | close during an unwinding invocation (K8) | — | public `node.down`, native listener failure |
| C-34 terminal fanout and acquisition | 3 clauses | — | old registrations detached (O7) | next execution: restart module (2 clauses, order-dependent); acquisition failure |
| C-35 partial wiring | — | — | — | partial first-run gate, rewire, acquisition failure |
| C-36 input frames and terminal admission | 3 clauses | — | resumeAll INVALIDATE hold (decided) | 3 clauses: pause module |
| C-37 upstream routing | — | — | — | K9 routing, rewire |
| C-38 restore and replay | — | — | — | checkpoint, replay modules |
| C-39 revision evidence | — | — | — | revision observer (O9) |
| C-8 runtime rewire (activated R-rewire; replayed 2026-11-08) | 6 clauses with `replace` | mid-wave removal (K8) | cache kept, surgical, idempotent, sentinel wait, terminal D, mid-fn rewire (O4, O7, K8) | first-run gate (sugar) |

No clause that the kernel covers failed. What the replay found instead were two kernel bugs in
batch, now fixed, and two places where the kernel and the draft part ways; the user settled both
as DS-17 O11 and O12 on 2026-11-06.

The pause clauses were replayed on 2026-11-06 against the [pause module](../modules/README.md), in
[pause.replay.test.mjs](../modules/pause.replay.test.mjs) (9 tests); see "Pause module" below.

## Found and fixed

- Output a node sent through `ctx.down` after its run, called inside a batch body, bypassed the batch:
  it ran as its own wave before the batch committed. It is now staged with the host inputs and
  commits in the same wave (C-28 "batch is its declared accumulation regime").
- Batch had no exclusivity check, so staged DATA and a later RESOLVED for the same node only failed
  at commit, as that node's ERROR. The conflicting submission is now rejected and earlier staging is
  kept (C-28). Output staged by a lifetime that closes before commit is dropped; without that it
  would have been cached on an inactive node and shown to the next subscriber.

## O11: standalone DIRTY (decided: kernel only)

C-28 sends "standalone DIRTY before a separate DATA array", and all of C-29 is about notifications
that stay open across time: who owns an open interval, when a delayed compensation is obsolete.
Under DS-17 so far no DIRTY spans time (O3 for batch, P9 for async). The kernel still lets a node
send `[DIRTY]` alone, and the result is inconsistent: sinks receive `[DIRTY]`, but dependent nodes
ignore it and settle without waiting. The TS baseline never emits a DIRTY-only array outside the
substrate itself (no such call in `packages/ts/src` at `dafc5ae` outside the node runtime and batch).
Even across processes it does not: the wire edge-group bridge collects remote DIRTY and DATA frames
and releases one local DATA wave, so a remote DIRTY never stays open in the local graph.

Keeping it would have meant tracking an open notification per node across waves, which is what C-29
tests. The user decided on 2026-11-06 that DIRTY is sent by the kernel only: node output containing
DIRTY is rejected (kernel test "O11: DIRTY in node output is rejected..."). Standalone DIRTY was
meant to announce once, compute or wait, then send DATA without repeated DIRTY; batch covers that,
and async results get their DIRTY from the DATA they carry. C-29 is retired with it, and when the
draft is revisited R-dirty-before-data, R-resolved-undirty, R-output-ownership and
R-undirty-settle-timing shrink as listed in DS-17 O11.

## O12: batch from a callback (decided: allowed, no extra rule)

C-28 expects "callback-origin public batch rejects before its body executes". The kernel lets a sink
callback or node function open a batch; its writes are staged and commit later as one wave (K8 test
"a batch opened by a function during a wave commits later as one wave"). With no early DIRTY there is
nothing for such a batch to disturb, so rejection buys nothing here. The user decided on 2026-11-06
to keep it allowed rather than add a special clause.

## Clause by clause

### C-28

| Clause | Label | Where |
|---|---|---|
| Preserve all three occurrences in one array; DIRTY before settlement | Kernel | replay: "one array of three occurrences..." |
| Separate explicit calls stay separate; batch is its accumulation | Kernel | replay: "separate explicit calls..." |
| Observer requests apply after the complete fanout; no peer cut off mid-array | Kernel | replay: "observer requests apply only after..." |
| Each later live array has its own DIRTY prefix; membership idempotent | Kernel for value arrays; the standalone case is Changed (O11) | kernel: "each set is its own wave...", "O11: DIRTY in node output is rejected..." |
| Early-DIRTY observer requests wait for the outer outcome; not canceled by rollback | Decided away (O3: no DIRTY before commit, so no observer sees the batch early) | kernel: "a throwing batch body publishes nothing" |
| Caught exclusivity rejection keeps earlier staging and commits the valid class | Kernel (after fix) | replay: "a rejected conflicting submission..." |
| Callback-origin public batch rejects before its body | Changed (O12) | kernel: "a batch opened by a function during a wave..." |
| Observer error after commit does not roll back | Kernel | replay: "an observer failure after commit..." |

### C-29

| Clause | Label |
|---|---|
| Rollback never balances an interval the batch did not open | Decided away (O3, O11) |
| Obsolete delayed compensation drops before any effect | Decided away in the kernel; recheck for the pause module |
| A new notification stays outstanding after old compensation is discarded | Decided away (O11) |

### C-30

Pause module (replay tests in `../modules/pause.replay.test.mjs`):

| Clause | Label | Where |
|---|---|---|
| Default pause starts no new fn, including activation | Module, with a difference: a self-stopping source's function runs to read the lock and does no work; a raw function behind a pausable runs on RESOLVED only | "a source paused before its first activation starts no work..." |
| Earlier started deferred work may emit | Module (P9: the lifetime stays open across pause) | "earlier started deferred work may still publish while paused" |
| resumeAll allows computation and holds publication | Module | "resumeAll lets upstream compute while paused..." |
| Resume drains held arrays FIFO; a queued re-pause stops before the next array | Changed: the held arrays go out in order, each as it arrived, but all in the resume wave; a re-pause is a request and applies after that wave (K8) | "resumeAll releases the held arrays in one wave; a re-pause..." |
| No rerun of consumed input or invalidation hooks | Module | "resumeAll lets upstream compute..." (no rerun), "resume does not rerun invalidation hooks" |

### C-31

| Clause | Label | Where |
|---|---|---|
| Nonterminal close keeps the intrinsic value and adopts it into the retained cache | Kernel | replay: "ordinary last-off keeps the state's intrinsic value..." |
| Ordinary last-off preserves an admitted manual write | Kernel | same test |
| Terminal keeps its sealed cache; a queued write after it is dropped before mutation | Kernel | replay: "a terminal seals the state..." |
| External lock survives close; new admission respects it | Module (pause) | pause replay: "under resumeAll the lock survives close..." |
| resumeAll discards held DATA in a terminal-containing array; resume never leaks it | Module (pause) | pause replay: "under resumeAll, DATA in the same array as a terminal..." |
| "Advances represented value evidence without live DATA" | Module (revision observer, O9) |  |

### C-32

Demand module (tests in `../modules/demand.test.mjs`, 2026-11-06):

| Clause | Label | Where |
|---|---|---|
| Inactive demand neither activates nor banks | Module | "a pull at an inactive holder..." |
| Active blocked requests retain only params2 | Module (a batch of pulls) | "C-32: several pulls before one service..." |
| Backlog waits for the outer batch and publishes outside its fate | Module | "C-32: a pull inside a batch..." |
| Latest demand is consumed only at actual service | Module | same tests |
| No demand means no holder invocation on RESUME; RESUME does not flush the backlog | Module | "C-32: with a pausable before the holder..." |
| Routed diamond duplicates service only once per routed request | Decided away: a pull travels through a declared control pair, not by routing | |

### C-33

| Clause | Label | Where |
|---|---|---|
| Revoke old rights, cancel, release dependencies, own hooks, late cleanup; isolate a failing cleanup | Kernel | kernel: "each run replaces the previous run's cleanup..."; "output through a closed lifetime's ctx is dropped..." |
| Close while a synchronous invocation is unwinding | Decided away (K8: a close requested during an invocation waits for it) | replay: "a close requested during an invocation waits..." |
| Old down drops; new ctx and signal are distinct | Kernel | replay: "old-life output is dropped..." |
| Staged old-life output does not survive into a new life | Kernel (after fix) | replay: "output staged in a batch by a lifetime that closes..." |
| Public producer/computed `down` bound to the admitting life | Not modeled (no public `node.down`) |  |
| Native listener failure keeps its host boundary | Not modeled |  |

### C-34

| Clause | Label | Where |
|---|---|---|
| Y receives the full old array | Kernel | replay: "during DATA+COMPLETE fanout..." |
| Next-execution requests wait for fanout and close | Kernel (they wait; without restart they find the source ended) | same test |
| They get their own START in a new execution | Module (restart, 2026-11-08), when the owner's replace is queued first: S/inner is replaced after the fanout, then Z subscribes and gets START | restart replay: "Y gets the whole old array; the next execution starts..." |
| (the same) when an observer subscribed to the inner before the owner did | Module, differs: its requests are queued ahead of the replace and find the old execution ended | restart replay: "a request queued before the owner's replace..." |
| Next-execution requests do not attach to a finished callback registration | Changed (O7): a replace keeps the node's subscribers, so X's registration goes on into the next execution and gets its START; the reuse request adds nothing | restart replay, first test |
| Old releases cannot remove new registrations | Kernel for dependency edges (the old edge objects are released, the new ones stay); for sinks there is no old and new registration (O7) | kernel: "replace: new dependencies are acquired before..." |
| Observer failure does not become S's ERROR | Kernel; also on restart | same tests |
| Failed acquisitions unwind their own leases | Not modeled (acquisition cannot fail here) |  |

### C-35

Partial first-run gating is sugar here, activation is atomic, and acquisition cannot fail, so the
clauses about early partial work and abandoned wiring are Not modeled; rewire is a module.

### C-36

| Clause | Label | Where |
|---|---|---|
| One invocation sees admitted DATA and terminal metadata (complete=input) | Kernel | replay: "one invocation sees the admitted DATA and the terminal..." |
| Automatic terminal adds no balancing RESOLVED | Kernel | replay: "under complete=auto the terminal ends the node..." |
| Full-array gate sees absence after a trailing INVALIDATE | Kernel; since O13 the DATA before the INVALIDATE is dropped, so the published array is `[INVALIDATE]` | replay: "a trailing INVALIDATE in the same array..." |
| Paused A DATA superseded; INV, A40 and B input survive in order; one invocation on resume | Module (pause, with one lock shared by both inputs) | pause replay: "D paused at both inputs..." |
| Throw after resume does not reinsert consumed input | Module | pause replay: "a throw in the invocation after resume..." |
| Effective INVALIDATE proceeds under default pause without waiting | Module | pause replay: "D paused at both inputs..." |
| resumeAll holds INVALIDATE publication | Changed (decided 2026-11-06): INVALIDATE goes out at once and discards what was held before it | `../modules/README.md` finding 3 |

### C-37, C-38, C-39

Upstream connection routing is K9, not covered; rewire, checkpoint, replay and revision evidence are
modules. Nothing in these three is kernel-only.

### C-8 (replayed 2026-11-08 against `replace`)

C-8 is not a D796 candidate: it is the activated R-rewire scenario, with ts, rust and py passing.
`replace` is graph-level and not surgical (O4), so this replay pins what `replace` does at each step
and labels the clauses it does not reproduce. Tests are in [replay.test.mjs](replay.test.mjs), section
"C-8".

| Clause | Label | Where |
|---|---|---|
| (1) The first-run gate opens on A's value | Not modeled (a gate is sugar, as in C-35) |  |
| (2) An added cached dependency's value reaches D and D recomputes | Kernel | replay: "C-8 (2)(3)..." |
| (2) The first-run gate is not re-armed | Not modeled (no gate) |  |
| (2) An added dependency with no value delivers START only, with no recompute until it emits | Changed (O4): the new instance runs once at once | replay: "an added dependency with no value..." |
| (3) The new dependency drives D | Kernel | replay: "C-8 (2)(3)..." |
| (4) A removed dependency's record and dirty contribution are discarded | Kernel (a replace never runs mid-wave, so there is no dirty contribution to clear) | replay: "C-8 (4)(5)..." |
| (4) D's cache is preserved across every rewire (R-rom-ram) | Changed (O4): a replace recomputes D's value; preserving it would need the H4 seed, which nothing here needs | same test |
| (5) A removed dependency no longer drives D | Kernel | same test |
| (6) Rewiring to the current set is idempotent | Changed (O4): a fresh instance runs and sinks get START | replay: "C-8 (6)..." |
| Kept dependencies keep their subscription and record, no unsubscribe and resubscribe | Partly: a kept dependency stays subscribed throughout (acquired before release), but D gets a fresh record with a fresh snapshot (O4) | kernel: "replace: new dependencies are acquired before..." |
| Removal while A's DIRTY is in flight; a removed dependency's queued INVALIDATE is drained | Decided away (K8: a replace runs between waves) |  |
| Rejects self-dependency and a cycle | Kernel | kernel: "replace: refused for a state node and for a dependency on itself" |
| Rejects adding a non-resubscribable terminal dependency | Kernel (found missing in this replay, fixed) | kernel: "replace: an active node cannot acquire an ended dependency..." |
| Rejects a rewire on a terminal D | Changed (O7): replacing an ended node is how restart works | kernel: "replace: an ended node gets a fresh instance..." |
| Rejects a mid-fn rewire as the D37 feedback ERROR, and a reentrant rewire | Changed (K8): it is queued until the wave is over, like every request made during a wave | replay: "a replace D asks for from its own function waits..." |
| Rewiring to zero dependencies: no-input function, cache preserved, no auto-deactivate | Kernel for "no input, stays active"; Changed (O4) for the cache | replay: "replacing to no dependencies..." |
| Every rewire needs an explicit function; intra-graph only | Kernel (the signature; ids are per graph) |  |

## Decisions from the 2026-11-08 replay

These follow from O4 and O7, which the user accepted with their defaults on 2026-11-08. C-8 belongs
to an activated rule, so each was put to the user separately; all five were decided the same day.
They change C-8 and C-34 when the draft rules are revisited (B140); `spec/` is not touched here.

1. **Decided by the user 2026-11-08: replace, with a seed (H4) added when a case first needs it.**
   R-rewire's surgical contract (C-8) keeps D's cache, rewires only the changed dependencies, is
   idempotent for the current set, and lets an added dependency with no value wait. Those clauses
   change when the draft rules are revisited. Why: surgical lets a node change shape while it is
   alive, which takes five rules (R-rewire, -deferred, -deferred-committed-boundary, -async-live-edge,
   -batch-boundary: shifting dependency positions, records kept across reorder, an in-flight async
   view of the old shape, batch outcome, pause locks, abandoned acquisition). With replace the old
   instance ends and the new one starts, so those become the existing lifetime rules (K7, K8, K3);
   a seed only says what the new instance takes over. Costs accepted: one rerun and a START per
   change, O(n) re-acquisition when one dependency is added (mergeMap), and the old instance's own
   async work is aborted. Single-inner operators (`switchMap`, `exhaustMap`, `concatMap`, `repeat`)
   can be an owner with a replaced inner and keep their cache without a seed; checked the same day
   by building `switchMap` this way ([../modules/switch-map.mjs](../modules/switch-map.mjs));
   `mergeMap`, with a varying number of inners, is the first case that needs the seed. Surgical
   stays a possible later optimization over the same semantics.
2. **Decided by the user 2026-11-08: replace on an ended node is allowed.** R-rewire rejects a rewire on a terminal D; restart (O7)
   needs exactly that.
3. **Decided by the user 2026-11-08: a topology request from inside a node function is queued, not an ERROR.** R-rewire calls a mid-fn
   rewire the D37 feedback ERROR. This settles the same question for a `set` from inside a function
   (DS-17): a write to the function's own upstream is still rejected, anything else is queued (K8).
   Restart's owner relies on the queue.
4. **Decided by the user 2026-11-08: subscribers survive a restart (C-34).** C-34 wants next-execution requests to get new
   registrations and old ones to end with the old execution. O7 wants observation to go on across
   attempts, so a replace keeps them.
5. **Decided by the user 2026-11-08: a next-execution request made during the terminal fanout depends on order (C-34), with no new kernel rule.** It succeeds
   only if the owner's replace is queued first, which holds when the owner subscribed to the inner
   before the observer did. Otherwise it finds the old execution ended and is reported. The kernel
   could hold such a request for a pending replace, but that would be a new kernel rule.
