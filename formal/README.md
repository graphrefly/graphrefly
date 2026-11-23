# GraphReFly formal specification

This directory contains the TLA+ formal specification of the GraphReFly
wave protocol. The CANONICAL normative source is [`spec/rules.jsonl`](../spec/rules.jsonl)
(clean-slate); each TLA+ invariant pins one or more `R-*` rules.

## D797 kernel models (active since 2026-11-10, graphrefly:D798; module models check draft module rules)

New models for the D797 draft rules, written for graphrefly:B140. The models below verify the
currently active rules and are retired or rescoped at activation, not edited now.

| Module | Covers | Conformance |
|---|---|---|
| `kernel_wave.tla` (`kernel_wave.cfg`, `kernel_wave_3.cfg`) | R-wave, R-messages, R-invalidation, R-terminals, R-subscription, R-failure: a state S and a diamond S->B,C->D, B and C under the default auto policies and D under each combination of auto and manual COMPLETE, ERROR and INVALIDATE, chosen at Init; host inputs to S (set, a batch of two, invalidate, complete, error); computed nodes choose outputs from a menu that includes rejected arrays; nodes settle in every order the dependencies allow. Invariants: RunOnce, SettleOnce, FanInAfterSettle, NoWedge, PendingPrefix, InvalidateAlone, NoDataWithResolved, NoStartSent, TerminalLastAndFinal, InvalidateEffective, RetainedMatchesSent, AutoErrorNoRun, AutoTerminals, ManualEndsByFunction, ManualSeesInput, ManualInvalidateKept, InvalidatedNotKept. TLC-green 2026-11-09 with the INVALIDATE policy and INVALIDATE marking the cone: two waves 990,778 distinct states (depth 11); three waves 114,655,914 distinct states (depth 16). 2026-11-10, RESOLVED is the kernel's alone (D799): an output with RESOLVED is rejected like one with PENDING, and the run-level check of that morning, with its two menu entries and NoDataWithResolvedInRun, is gone again: two waves 990,778 distinct states (depth 11); three waves 114,655,914 distinct states (depth 16, 41 min), as before the run-level check. 2026-11-10, START is the kernel's too (D801): an output with START is rejected like one with PENDING, with a menu entry for it and the invariant NoStartSent; two waves 990,778 distinct states (depth 11, 17 s), unchanged, since a rejected output becomes the ERROR the menu already offers. The three-wave run was not repeated for this change. 2026-11-11 (D806): the run that sees the last terminal under auto COMPLETE runs the function also when the terminal is its only input (the model had encoded the skip, C F9 of the D797 migration review), with the invariant AutoCompleteAfterRun; and a node Q between S and the diamond, quiet or not as chosen at Init (a quiet Q is never marked pending, holds its output for a later wave of its own, and passes an auto INVALIDATE on at once, F 2.10). Two waves 2,580,844 distinct states (depth 17, 3 min); the three-wave run was not repeated (the last one needed tens of gigabytes before Q was added, more than this disk had free). Not modeled (graphrefly:D814, 2026-11-19): a message's payload. A DATA or ERROR without the payload R-messages requires is one more rejected output array, which the model has without its contents, and the empty-string payload of a throw that cannot be one is data the model does not hold; the reference tests pin both. | C-16, C-17, C-28, C-34, C-36, C-40, C-41, C-42, C-44 |
| `kernel_lifetime.tla` (`kernel_lifetime.cfg`, `kernel_lifetime_4.cfg`) | R-lifetime, R-request-order: a state S and a chain S->P->A->M, with N over A that a rewire or replace moves to {P}, {A} or {P, A}; host sinks on M and N; each request (subscribe, unsubscribe, set, complete, rewire, replace, late output) is one step, a wave is one step in which each open node of the cone runs once, and the requests made while one runs wait in a queue; A and N may have a setup (chosen at Init) that registers the lifetime's one cleanup before the first run; runs may start late work that keeps its ctx, set private state or complete; one batch body, opened at a boundary or from a callback during a request, stages writes and topology requests, then returns or throws; opened during a request, its commit waits in the queue. Invariants: ActiveIffDemand, EdgesMatchDeps, OpenIffLive, InactiveHoldsNothing, StateKeeps, PrivOfCurrentLifetime, RetainedFromCurrentLifetime, CleanupOnce, ClosedRan, OpenNotRun, OneCleanupPerLifetime, RunOncePerRequest, KeptUpstreamStays, RewireKeeps, DeclaredWhenClosed, RewireOfThisLifetime, EndedHoldsNoPriv, FIFO, AfterMaker, IdleDrained, BodyAfterCommit, ThrownDropped, BatchThrowNothing. TLC-green 2026-11-10 with the per-lifetime setup and N's rewire on its ctx (it carries its lifetime, and closing the lifetime puts back the declared dependencies): three requests 99,380 distinct states (depth 11, 3 s); four requests 2,242,372 distinct states (depth 13, 2 min). With D799 (a replace gives N's new instance its own setup or none; a node that ends drops its private state): three requests 149,216 distinct states (depth 11, 7 s); four requests 4,227,370 (depth 13, 2 min). 2026-11-11 (D806, F 2.9 of the D797 migration review): replaces of M onto N, of N onto M and of M back onto A, a replace onto a cycle refused when asked for and again when it runs, waves settling in the current dependencies' order, and the invariant Acyclic. Three requests 218,102 distinct states (depth 11, 14 s); four requests 7,242,546 distinct states (depth 13, 3 min 15 s). | C-29, C-31, C-33, C-35, C-37, C-41 |
| `module_pause.tla` (`module_pause.cfg`, `module_pause_6.cfg`) | R-pause: the one-node pausable of `reference/modules/pause.mjs` (pausableFn over the input and a lock state, manual COMPLETE, ERROR and INVALIDATE) run over the kernel's settle semantics beside a pausable written from R-pause's text; each wave is one host batch to the input (writes, INVALIDATE, a terminal) and/or a new lock set. Every array the input sends marks the pausable pending, an INVALIDATE included; an INVALIDATE the pausable sends while it has no value is dropped, and the wave settles with RESOLVED. The two-node version (pauseLog, then release) was retired on 2026-11-09, when INVALIDATE got a manual policy. Invariants: Refines (wave-by-wave output equal, a trailing terminal compared in an array of its own), HeldMatches, NoValueWhilePaused, EndsWithInput. TLC-green 2026-11-09: four waves 1,542 distinct states (depth 5); six waves 12,823 distinct states (depth 7, 4 s). | C-30 |
| `module_demand.tla` (`module_demand.cfg`, `module_demand_7.cfg`) | R-demand: the one-node pullable of `reference/modules/demand.mjs` (the quiet holder over the input and a demand state, manual COMPLETE and INVALIDATE, auto ERROR) run over the kernel's settle semantics beside a holder written from R-demand's text; a step is a host batch writing the input and making zero, one or two pulls, or the sink subscribing or unsubscribing; the service sends one DATA or stays silent. Nothing goes out in the wave; the holder's INVALIDATE, service output and terminal go out as a later wave, the INVALIDATE dropped while the holder has no value. The two-node version (pullLog, then the holder) was retired on 2026-11-09, when INVALIDATE got a manual policy. Invariants: Serves, OutputMatches, HeldMatches, ServeOnlyOnPull, InactiveHoldsNothing, EndsWithInput. TLC-green 2026-11-09: five steps 15,678 distinct states (depth 6); seven steps 140,323 distinct states (depth 8, 1 min). | C-32 |
| `module_history.tla` (`module_history.cfg`) | R-history: the history node of `reference/modules/history.mjs` (auto policies, the auto INVALIDATE policy included since graphrefly:D812: an INVALIDATE removes its value and keeps its list) over a computed source X kept active by its own sink, run over the kernel's settle semantics beside a history written from R-history's text; a step is a wave of X (one entry of a menu: several arrays, an array with two values, RESOLVED alone or before values, INVALIDATE and values, two INVALIDATEs, values with a terminal, a terminal alone, values with an ERROR, an INVALIDATE before a terminal with and without values between) or H's sink subscribing or unsubscribing; N = 2, and the list's entries are waves of arrays. Invariants: Refines, ListMatches, ValueIsList, InactiveEmpty. TLC-green 2026-11-20: eight steps 17,389 generated, 2,475 distinct states (1 s; 16,069 and 2,444 before the sixth QA's wave, 15,451 and 2,381 before the fifth's). Third QA, the same day: both sides had dropped an INVALIDATE that comes before the source's ERROR in one wave, so H ended still holding its value, where the reference sends the INVALIDATE and then the ERROR (R-terminals); the menu had no such wave and has two now, and the old formula on either side alone trips Refines. Of that review's other mutations 23 trip an invariant and five are green (this line said 27 in all, which does not add up, and the list was not kept): three of operators both sides share (the gate on an ended H, N, X's snapshot), one that changes no behavior (a stored value left while `has` is cleared), and the rule's side keeping its list across a deactivation, which holds by the step's own text and is checked only on the composition (InactiveEmpty). Fourth QA, the same day: the menu still lacked three shapes the rules tell apart, and a fault on one side alone was green for each: an INVALIDATE before COMPLETE, DATA between an INVALIDATE and the source's ERROR, and COMPLETE alone. It has five more waves (15,451 generated and 2,381 distinct, from 12,361 and 1,769), and six mutations, one per side and shape, each trip Refines: the INVALIDATE dropped when the wave carries COMPLETE, a list sent in an ERROR wave when DATA follows an INVALIDATE, COMPLETE ending the node only when the wave has DATA. Fifth QA, 2026-11-20: one shape was still missing, DATA after an INVALIDATE in a wave that ends with COMPLETE, where this line said the menu had an INVALIDATE before a terminal with and without values between, which held for ERROR alone. One wave more (16,069 generated and 2,444 distinct), and two mutations that were green without it trip Refines: the composition sending no list in such a wave, and the rule's side giving it no entry. Sixth QA, the same day: two DATA arrays after an INVALIDATE were missing too; with that wave, an entry that keeps only its last array after an INVALIDATE trips Refines on either side. Not modeled: an activation over a source that has ended; n other than 2; a checkpoint of the list and several sources, as said below. Before the third QA: 1,609 distinct, 1,085 before the second QA added four waves to the menu, 651 before the D812 revision. | C-38, C-45 |
| `module_checkpoint.tla` (`module_checkpoint.cfg`, `module_checkpoint_9.cfg`, `module_checkpoint_require.cfg`) | R-checkpoint, R-invocation: states A and B and a recipe node P over them, whose run keeps the last N input values in private state; at Init, whether P has a setup that opens an outside resource (the kernel runs it at every activation, a restored one's included) and whether P has the manual INVALIDATE policy, under which the function empties the values it keeps in private state at an INVALIDATE, while its pending record stays with its job; the original graph takes host steps live, then one capture and restore, a window in which host steps reach only the states, and the restored P's first subscription through the module's seed, the setup and the wrapper, after which both graphs take the same steps. The reference is the original P given the window's net change as one live wave. Invariants: StateMatches, ResourceMatches, OutMatches, NoNeedlessRun, RestoreBuilds, LocalOnlyRefused, RestoredAsInstance, PendingMatches, RefusalMatches, RequiredNeverLocal. TLC-green 2026-11-10 with the setup choice: seven steps 177,962 distinct states (depth 8); nine steps 608,960 distinct states (depth 10). Extended the same day for D802 (Q5 of the checkpoint admission): a replace of the original P before capture (recipe r1, r2 or none, with or without a setup) and, at Init, P made before its dependency B; invariants RestoreBuilds, LocalOnlyRefused and RestoredAsInstance. Seven steps 858,172 distinct states (depth 8, 8 s); nine steps 3,285,136 distinct states (depth 10, 32 s). Revised 2026-11-18 for graphrefly:D812 (R-checkpoint@2, activated the same day once this model and the reference modules agreed with it): capture is refused while P is local-only and writes no checkpoint, where the restore failed before; each run starts a job outside the graph, a step lets it finish with a late output, and a third choice at Init says whether P records its pending job in private state, which the restored P's setup opens again without a run of its function, while a job that was not recorded is lost. New invariant PendingMatches; LocalOnlyRefused now says that no checkpoint of a local-only P is written. TLC-green 2026-11-18: seven steps 8,077,848 states generated, 2,827,084 distinct; nine steps 50,992,236 generated, 14,702,524 distinct (2 min 10 s). Six mutations on the seven-step config, each tripping an invariant: the setup not reopening the recorded job, the checkpoint resuming a job that was not recorded, capture not saving what is pending (PendingMatches); reopening the job running the function (NoNeedlessRun); capture writing a checkpoint of a local-only P, as before D812, and a refused capture leaving a checkpoint (LocalOnlyRefused). The mutations recorded for the earlier versions were not rerun. Revised 2026-11-19 after the independent QA of the D812 work, which found PendingMatches comparing two sides that both set the job from the recorded flag, and nothing modeling the order of the refusals or the recipe requirement. The reference side of a restored job now reads what was in flight at the capture and whether P records, not the flag; a replacing instance may hold what is not JSON, and the reason a capture is refused is computed once as `checkpoint.mjs` checks (JSON first, then the recipe) and once from R-checkpoint@2's text; `Require` is a constant under which a replace without a recipe is not a step (`module_checkpoint_require.cfg`, R-node@3). New invariants RefusalMatches and RequiredNeverLocal; the rule's side of NoNeedlessRun compares the states with what P received directly. TLC-green 2026-11-19: seven steps 9,385,560 generated, 3,135,756 distinct (23 s); seven steps with Require 8,336,344 generated, 2,876,460 distinct (20 s); nine steps 53,261,708 generated, 15,216,796 distinct (2 min 19 s). Twelve mutations, each tripping an invariant, on the seven-step config (the last on the Require one): the setup reopening no job, or one whatever the state says, a run not recording its job, a finished job left recorded, the rule losing a recorded job, the rule resuming a job that was not recorded (PendingMatches); the recipe always run at the first activation (NoNeedlessRun); the local-only check ahead of the JSON check, what is not JSON captured, the rule refusing a local-only node as local-only first (RefusalMatches); a local-only node captured (LocalOnlyRefused); a requiring graph accepting a replace without a recipe (RequiredNeverLocal). LocalOnlyRefused restates how Capture is written and RequiredNeverLocal follows from the Replace guard: they record the rule's consequence, and the reference tests are what pin the module. Not modeled: several nodes, so which node a capture names when more than one cannot be saved (the first node in creation order that cannot be saved, since the user's choice of 2026-11-19; the model has what is not JSON first within its one node); a recipe that was given without a reference; a bridged graph. The reference tests pin all three. Nor, as the third QA listed: capture refused inside a wave or a batch body; the requirement asked for again at a restore (Require guards only a replace before the capture); any refusal at restore (an earlier format, a local-only record, a missing factory, the node and reference named, no graph returned); the node's policies being saved; lifetime dependencies after a ctx.rewire; a computed node that has not ended and has no lifetime saved as holding nothing; that only the seeded instance's first run reads the seed; the factory's arguments. D812's third formal obligation, on the recipe requirement: kernel_lifetime needs no new step, since a refused request changes nothing the kernel holds, and the refused replace is in this model's Require config, where RequiredNeverLocal follows from its guard. Also not modeled (second QA, 2026-11-19): a recipe that drops its record while its job is still in flight. The rule's side reads "in flight and P records", which is what R-checkpoint@2 says ("recorded in private state") only for a recipe that keeps its record as long as the job runs, as the modeled one and `latestAsync` do; for one that drops it the rule says the job is lost. Nor, from the wording confirmed that day: that a reference is a non-empty string; the three readings of an INVALIDATE a restored node could not see, of which the model has the write of another value and the write of the same one but no INVALIDATE alone on a node whose function then sends nothing; and that a restored graph's creation order may differ from its original's, the model having one computed node. The reference tests pin all of these. Fifth QA, 2026-11-20: an ended P kept its private state on both sides, and a capture saved it with what P had received, against the kernel (private state goes with the lifetime, R-lifetime) and against R-checkpoint@2 since it says an ended node is saved with its values and its terminal alone. P now drops it where it ends, on the original, the rule's side and the restored P, and an ended P's received record is not saved. TLC-green 2026-11-20: seven steps 9,379,424 generated, 3,116,700 distinct (27 s); with Require 8,332,160 and 2,863,100 (25 s); nine steps 53,243,988 and 15,059,172. Three mutations trip StateMatches: the state kept at the end by the restored P, by the rule's side, by the original. Saving an ended P's received record is green: nothing reads it. BuildFrom takes the first buildable node in creation order, which is R-checkpoint@2's order for these three nodes and not for four; its comment had cited the rule for it. Sixth QA, the same day: a fourth drop of the state, in Replace, could not be reached (a P that has ended is not replaced) and is taken out, the counts unchanged. Not modeled: a record of an ended P that holds more than its values and terminal (the model's capture cannot write one, so "a restore reads nothing else" is the reference tests'), a replace of an ended P, and that an ended restored P runs no setup, which the model's end masks. | C-38, C-45, C-46, C-50 |
| `module_restart.tla` (`module_restart.cfg`, `module_restart_10.cfg`) | R-restart: the owner of `reference/modules/restart.mjs` (manual terminals, private round, failures, last request served and attempt count, the lifetime's signal, the renewal in the cleanup its setup returns, replace at the end of the wave) over an inner on an upstream U, beside an owner written from R-restart's text that numbers attempts and lifetimes; a step is the sink subscribing or unsubscribing, the inner sending a value, COMPLETE, ERROR or a value with COMPLETE, U ending, a restart request, a pending retry's timer, or a superseded retry's timer; retries wait for a timer or not (chosen at Init). Invariants: Refines, CountsMatch, PendingMatches, RecordMatches, TerminalOnlyWhenFinal. TLC-green 2026-11-18, with the checkpoint round trip added for graphrefly:D812 (a capture and restore of the active graph, then the restored owner's first activation, where an owner that was waiting for a retry starts its delay again for the same attempt): two rounds and two attempts, seven steps 7,714 distinct states; three attempts, ten steps 49,821 distinct states (1 s). Before the revision: 4,638 and 25,974. Six mutations of the restored activation, each tripping an invariant in both configs: the inner renewed at once, as before D812 (Refines); another failure counted (CountsMatch); a new attempt number (PendingMatches); nothing re-armed (PendingMatches); the timer kept across the restore (PendingMatches); a request already in the restart state not counted as served (CountsMatch). Revised 2026-11-19 after the independent QA of the D812 work found a defect that model could not reach: both sides took "the inner is ended" for "a retry was waiting", the rule's pending retry was erased at the restore and rebuilt from the composition's state, and the inner could not send between the restore and the first activation, so an inner that fails only at that activation, which the module then renewed at once while its function counted the failure too, was not a state. Now the composition keeps `waiting` in the private state, as `restart.mjs` does, and its setup reads only that; the rule's owner keeps its own record of the retry across the restore (`sp.saved`); and a restored live inner may send a value, COMPLETE, ERROR or a value with COMPLETE at the first activation. New invariant RecordMatches: the private state records a waiting retry exactly when the rule's owner has one. TLC-green 2026-11-19: seven steps 22,006 generated, 9,574 distinct; ten steps 182,873 generated, 66,606 distinct (2 s). The third QA gave the model a superseded retry's timer that is still armed while a later retry waits: with one timer slot, that timer clearing the record of the retry waiting now could not be reached, and the reference's tests let it through too. It was first a flag whose step fired into nothing (22,001 and 181,188 generated, 9,569 and 65,804 distinct), which asserted that such a timer is inert: the fourth QA found every mutation of the flag green, and the fault caught only when written by hand into that step. The superseded timers are now kept with their attempt numbers (`stale`) and fire through the guard the current timer fires through (`Fire`, StaleFires), so the guard is what the model checks. Six mutations of it: the record cleared before the attempt is checked trips RecordMatches in both configs, a timer that fires whatever its attempt trips Refines in both, and superseded timers kept across an unsubscribe trip Refines in ten steps; green are superseded timers never kept (the model before the third QA, with nothing to compare them with), kept across a restore (a restored owner's attempt is compared with nothing, as said below) and left armed after firing (inert each time). Fifth QA, 2026-11-20, left as they are with the user: `timer` and `stale` stay armed after the owner ends and across an ended owner's unsubscribe, where the reference aborts the lifetime at the end; they are inert through Fire's guard, and clearing them is green (21,849 and 178,902 generated). `SpecPending`'s conjunct on the lifetime is dead: without it the counts are the same. Before the third QA 21,983 and 174,280 generated, 9,552 and 63,229 distinct; this line gave 19,683 and 155,240 generated until then, the counts before the second QA's change. Thirteen mutations, each tripping an invariant in both configs: the setup guessing from the inner and re-arming (PendingMatches) or renewing at once, the QA defect (Refines); a waiting owner's inner renewed at once, as before D812 (Refines); nothing re-armed (PendingMatches); another failure counted (CountsMatch); the record never set, set for every attempt, or not cleared when the timer fires (RecordMatches); the timer kept across the restore (PendingMatches); a request already in the restart state not counted as served (CountsMatch); and three of the rule's side: the waiting retry not kept (PendingMatches), another failure counted (CountsMatch), the inner renewed at once (Refines). Revised again that day after the second QA: a waiting owner's function never ran at the restored activation, so a re-arm made only when the function does not run stayed green; the function may now run there on another input's change, with nothing from the inner (same 9,552 and 63,229 distinct states), and six more mutations trip PendingMatches in both configs: the re-arm only without a run, only with one, at an ended inner, or never; the rule keeping its saved retry only without a run, or dropping it. "A new attempt number" from the list above is no longer counted: the composition's attempt number is compared with nothing outside it, so the mutation changes no behavior. The third QA's 27 mutations on the model with the stale timer: 24 trip an invariant in both configs; green are the function never running at the restored activation on another input's change (an operator both sides share), a new attempt number for the restored retry (compared with nothing, as said), and the record cleared in TimerFires' own branch for a superseded timer, which changed nothing there because that branch was reached only when no retry waits (that list was run on the flag; with `Fire` the same mutation trips RecordMatches). Not modeled: the inner's sinks receiving START at each attempt and the unchanged topology description; that the new inner is an instance of the inner's own definition; an upstream that ended with ERROR as against COMPLETE; time, so that the delay starts again in full is pinned by the reference tests (59,999 ms and 1 ms; a backoff's second delay), not here; and a second capture before the restored owner's first activation, which a reference test pins. | C-43, C-46 |
| `module_bridge.tla` (`module_bridge.cfg`, `module_bridge_3.cfg`, `module_bridge_diamond.cfg`) | R-bridge (and R-graph-domain's cross-graph clause): one wire edge group of `reference/modules/bridge.mjs` over edges x and y, a sender whose wave changes a non-empty set of edges that have not ended (a value, an INVALIDATE of one, or a COMPLETE) and whose outbound node forms one cause per wave, a transport that under Faults delivers a late copy of a frame (a duplicate, or an older cause after newer ones) or loses one, a restart that opens a new session on a new connection, and the receiver's gate (session, last cause taken, drop at or below it, release past a gap and report it, count again for a new session, skip an ended inbound edge's entries and report the skip when they do not end in COMPLETE); RoundTrip makes every sender wave set both edges to one version of A, C-1's return leg (the first hop carries one edge, so its grouping is trivial). ERROR behaves as COMPLETE and is not modeled apart; malformed frames and refusals are pinned by the reference tests. Invariants: TypeOK, ViewIsSenderState, OneWavePerCause, AtMostOnce, InOrder, EventsMatch, QuiescentAgreement, GapReported, SameVersion, NoFalseDivergence. TLC-green 2026-11-11 with COMPLETE (D804): two waves 1,272,966 distinct states (depth 22, 8 s); three waves 64,289,021 distinct states (depth 26, 12 min 23 s); RoundTrip, three waves, 114,261 distinct states (depth 26, 1 s). | C-1, C-1b |
| `kernel_replaced_input.tla` (`kernel_replaced_input.cfg`) | One mechanism of R-invocation, R-subscription and R-checkpoint, and nothing else of them: a computed A that can be replaced by an instance that holds nothing, holds a value or has ended, a state B, and Z over [A, B] under the manual COMPLETE policy, whose function keeps in private state which inputs completed and drops its count of an input it is told was replaced. The kernel marks Z's input at a replace; Z's next run reads the mark, which clears it; a capture saves a mark not yet read and the restored Z's first activation runs for it. `owed` is the model's own record that A was replaced since Z last ran. Invariants: ToldAsOwed, CountIsCurrent, EndsOnCurrent. Up to three replaces and two captures: 199 distinct states | reference tests are candidate evidence |
| `kernel_repeated_dependency.tla` (`kernel_repeated_dependency.cfg`) | One mechanism of R-request-order, and nothing else of it: the exchange of one node's dependency list, a sequence over two states of up to three places, as a rewire and a replace share it. The connections held to each dependency queue up in the order of their places; a place of the new list takes the head of its dependency's queue or a new connection that brings the dependency's value; what is left is released. Both sides are kept, the node's connection at each place and each dependency's connections, with the record of what the node last received on each. Invariants: OnePerPlace, BothSidesAgree, RecordsCurrent, KthKeepsKth. Up to three exchanges: 11,545 states generated, 2,244 distinct | reference tests are candidate evidence |
| `kernel_seed_cycle.tla` (`kernel_seed_cycle.cfg`) | One clause of R-request-order, and nothing else of it: the cycle check of a replace and a rewire over the three lists a node can hold, its declared dependencies, those of its current lifetime and those a seed gives its first lifetime. Three computed nodes; a rewire, a replace, an activation that starts on the seed's list, a deactivation that goes back to the declared one, and a capture and restore that leaves a rewired node's list in a seed. Invariants: Acyclic, RunsAcyclic. 35,205 states generated, 2,312 distinct | reference tests are candidate evidence |

`kernel_wave.tla`, 2026-11-23, for graphrefly:D824 (R-failure@5, R-terminals@2, R-invalidation@2;
graphrefly:B148's first to fifth points). The model already did what the rules now say: an INVALIDATE
of any input in the wave goes before an auto ERROR and before the function's output, the kernel's
COMPLETE is a frame of its own, and a run that failed gives its ERROR alone. Two invariants are
added, AutoCompleteAlone and InvalidateBeforeOutput, the second through a flag set where D sent DATA
in a settlement and holds none after it. `kernel_wave.cfg`: 4,013,410 states generated, 2,580,844
distinct, depth 17, in 2 min 41 s, as before the two invariants. Mutations, each checked against its
invariant alone: the kernel's COMPLETE joining the function's last array (AutoCompleteAlone); an auto
INVALIDATE going out after the function's output (InvalidateBeforeOutput); an auto ERROR that does
not apply the wave's INVALIDATE first (InvalidatedNotKept). The three-wave run was not repeated.
Payloads are abstract, so the payload of a throw's ERROR has no model.

Written 2026-11-23 for graphrefly:D822 (R-request-order@6, graphrefly:B148's seventh point). Mutations
checked on `kernel_seed_cycle.cfg`, each tripping Acyclic, and RunsAcyclic when that is checked alone:
a check that does not read a seed's dependencies, one that does not read declared ones, one that does
not read current ones, one that follows a single step, and a rewire that is not checked. Out of scope:
requests queued together (kernel_lifetime.tla), a node created over a dependency that reaches a seed
naming it before it existed, and everything a cycle would do to a wave.

Written 2026-11-23 for graphrefly:D821 (R-request-order@5, graphrefly:B148's sixth point). Mutations
checked on `kernel_repeated_dependency.cfg`, each tripping an invariant: connections matched by id
alone (OnePerPlace); what is left in the queues not released, and a new connection not added at the
dependency's side (BothSidesAgree); a write that reaches one of a dependency's connections, and an
added place that does not bring the dependency's value (RecordsCurrent); the later connection kept,
and every place given a new connection (KthKeepsKth). Each invariant was also checked alone and is
tripped by at least one of them. Out of scope: the order in which a dependency delivers to its
connections, when the node runs (R-wave), a replace's new records, and terminals.
`kernel_lifetime.tla` still models a dependency list as a set.

Written 2026-11-22 for graphrefly:B148's eleventh point, which graphrefly:D819 settled on
2026-11-23 (R-subscription@4, R-invocation@4, R-checkpoint@3). Mutations checked on `kernel_replaced_input.cfg`,
each tripping ToldAsOwed: a replace that leaves no mark, a capture that drops it, a restore that does
not run for it, a restore that runs and does not tell, and a run that leaves the mark; and a function
that keeps its count when told, which trips CountIsCurrent. CountIsCurrent and EndsOnCurrent were each
checked alone against the first, the second and the last of these. Out of scope: a replace made
after a restore and before the restored node's first activation, when the node is not active; the
kernel's other reads of an input; and what an operator does with the telling.

Mutations checked on `kernel_wave.cfg`, each tripping an invariant: settling while a dependency is
pending (FanInAfterSettle); no kernel RESOLVED (NoWedge); no PENDING prefix (PendingPrefix); no split
at INVALIDATE (InvalidateAlone); INVALIDATE effective without a value (InvalidateEffective); no
output check (NoDataWithResolved); auto ERROR running the function (AutoErrorNoRun); no auto COMPLETE
(AutoTerminals); applying after a terminal (TerminalLastAndFinal, after a menu entry with an array
after a terminal was added); inbox not cleared (RunOnce); pending not cleared on delivery
(FanInAfterSettle, and SettleOnce when checked alone); DATA not replacing retained values
(RetainedMatchesSent); cone not marked (RunOnce). A "not ended" clause in `Ready` was dropped as
equivalent: an ended node has released its dependencies, so nothing reaches it (same 58,287 states
with it).

Revised 2026-11-09 for the activation plan: D's two terminal policies are chosen at Init, which
takes over `wave_deps_complete` and `wave_protocol_rescue_MC`, with two new invariants,
ManualEndsByFunction and ManualSeesTerminal. With manual policies the model found that a wave of
terminals alone ran D once per terminal (RunOnce): only arrays carrying DATA or RESOLVED marked the
cone pending, so nothing held the fan-in, and each run saw one leg's terminal. The reference kernel
did the same. The user decided that an array carrying a terminal marks the cone and gets PENDING,
under auto and manual policies alike, and INVALIDATE neither. The model then found that the
postlude of an auto COMPLETE, delivered apart from the run's output, marked the cone a second time
(SettleOnce); it now goes out in the same delivery, in the kernel too. Mutations checked again, 19
in all, each tripping an invariant: the 13 above, plus the old rules (PENDING only on value arrays:
PendingPrefix; terminals not marking: RunOnce), the old separate postlude (SettleOnce), manual ERROR
or manual COMPLETE treated as auto (ManualEndsByFunction), and a manual terminal not running the
function (ManualSeesTerminal, now ManualSeesInput).

Revised again the same day when INVALIDATE got a manual policy and marks the cone: D's INVALIDATE
policy joins the Init choices, with ManualInvalidateKept (the kernel never invalidates a manual D)
and InvalidatedNotKept (an INVALIDATE under auto, or before an auto ERROR, leaves D without a value
unless D sent DATA after it). Mutations checked, 23 in all, each tripping an invariant: the 19 above
(ManualSeesTerminal read as ManualSeesInput), plus INVALIDATE not marking (InvalidateAlone), manual
INVALIDATE treated as auto (ManualInvalidateKept), manual INVALIDATE not running the function
(ManualSeesInput), and an auto ERROR dropping an INVALIDATE before it, the kernel's behavior until
module_demand.tla found it (InvalidatedNotKept). On 2026-11-10 a run-level check of DATA with RESOLVED
came and went (D799: RESOLVED is the kernel's alone); its mutation became a node's RESOLVED accepted
(NoDataWithResolved), 24 in all. On 2026-11-10 (D801) a node's START accepted (NoStartSent), 25 in all. Run: `java -cp <tla2tools.jar> tlc2.TLC -deadlock -config kernel_wave.cfg kernel_wave`.

Mutations checked on `kernel_lifetime.cfg`, 31 in all since 2026-11-10, each tripping an invariant; every invariant
was also checked alone against the mutation aimed at it. Deactivation keeping a computed node's
values (InactiveHoldsNothing) or private state (InactiveHoldsNothing); the state node clearing its
value (StateKeeps); a close that does not release (EdgesMatchDeps) or run cleanups (ClosedRan);
an unsubscribe that does not deactivate (ActiveIffDemand); a terminal that does not close the lifetime
(OpenIffLive); an ended node that opens a lifetime on activation (OpenIffLive) or accepts a rewire
(EdgesMatchDeps); no setup, a setup on every run, or a replace whose new instance skips it
(OneCleanupPerLifetime); a cleanup run while its lifetime is open (OpenNotRun); a close that runs
one twice (CleanupOnce); late output without the lifetime check (RetainedFromCurrentLifetime); rewire releasing before it acquires
(KeptUpstreamStays: P closes and opens again), opening a new lifetime or dropping private state
(RewireKeeps); replace keeping private state (PrivOfCurrentLifetime) or not running the old cleanups
(ClosedRan); a LIFO queue (FIFO); a request run at once while another runs (AfterMaker); a
boundary with requests still queued (IdleDrained); a thrown body that commits (BatchThrowNothing) or
keeps its requests (ThrownDropped); a commit split into one wave per write (RunOncePerRequest); body
requests run before the commit (BodyAfterCommit); the commit of a batch opened during a request run
at once (AfterMaker). Late output and the LIFO queue need three requests,
which is why the main configuration has three. Revised 2026-11-10, when a per-lifetime setup
replaced per-run registration: the late registration through an old ctx and the four mutations of
replaced registrations went, four setup mutations came in, and each new or changed invariant was
checked alone again, and with D799 one more, 32 in all: an ended node keeping its private state
(EndedHoldsNoPriv, also alone). Revised again the same day when rewire moved onto ctx (F7): the rewire
carries its lifetime; the ended-node refusal mutation went, and four came in, each also alone: a
rewire applied whatever its lifetime, a rewire not undone at close, a replace that keeps the old
declared dependencies (DeclaredWhenClosed), and a queued rewire from an older lifetime applied in
the next (RewireOfThisLifetime). Not modeled: `set(id, fn)` with a function (2026-11-10). Its value is computed when it
runs, so its order is the request order this model checks (FIFO, AfterMaker); that it reads the
writes before it, in a batch too, and writes nothing for an unchanged value is pinned by kernel tests.

Revised 2026-11-22 for R-request-order revision 4 (graphrefly:B148's eighth point): the requests node
functions make during one request run in the order their nodes were created, each node's own in
the order it made them, at the places in the queue that such requests were made at. A queued
request carries the node whose function made it (M, N, or none for a sink callback or a cleanup),
and any request may be a function's; FIFO became RequestOrder, checked as each request starts
against what is still queued. Not modeled: the commit of a batch a function opened, which the
reference kernel orders as that function's request and a kernel test pins; here a commit is no
function's. With three requests: 3,248,466 states generated, 722,428 distinct (218,102 before the
revision). With four: 256,428,291 generated, 55,911,570 distinct, depth 13, in 20 min 38 s with
eight workers; TLC's estimate that a fingerprint collision hid a state is 0.019 from the actual
fingerprints (6.1E-4 calculated).
Mutations, each tripping RequestOrder: no reordering, the rule before this revision; later-created
nodes first; a node's own requests in reverse; the functions' requests moved ahead of the wave's
other requests; the LIFO queue; and rewires alone reordered, which the user settled first and which
moved a mergeMap's rewire ahead of its own replace (reference/modules/higher-order.test.mjs).
With four requests, one more: the functions' requests of different requests ordered together.

Writing this model found three things the reference kernel did that the D797 draft text did not
say. The user settled all three on 2026-11-09 as the kernel does them, and R-lifetime, R-terminals,
R-request-order and D797 now say so: (1) each run replaces the previous run's cleanup registrations
without running them (from R-cleanup-hooks@1 and @2; C-33; replaced on 2026-11-10 by a per-lifetime
setup, see above); (2) a batch called during a wave runs its
body at once, and only its commit waits for the wave to end, while batch returns what the body
returned (C-29; the reference kernel's outer batch returned nothing until then); (3) a node that ends
closes its lifetime at once, releasing its dependencies and running its cleanups while it keeps its
values, terminal and subscribers (from R-terminal@2; C-34).

Not modeled yet: manual policies, quiet nodes, async output inside a wave, nested batches and late
output inside a batch body.

Mutations checked on `module_pause.cfg` for the one-node module, 16 in all, each tripping an
invariant, every invariant also alone: an INVALIDATE that keeps what was held, and the auto
INVALIDATE policy (Refines, HeldMatches); the INVALIDATE not sent on, sent after the released arrays,
or sent although the pausable has no value (Refines); the held arrays kept after the resume
(HeldMatches, and Refines alone); a terminal while paused sending the held arrays with it, and
release while paused (Refines, NoValueWhilePaused); a terminal dropped, paused or not (Refines,
EndsWithInput); the held arrays reversed (Refines, HeldMatches); the release sending only the latest
array (Refines); no kernel RESOLVED, and an INVALIDATE array not marking the pausable pending, so a
dropped INVALIDATE leaves the wave unsettled (Refines); auto ERROR, dropping the DATA beside the
terminal (Refines); the lock value from before the wave (Refines, HeldMatches, NoValueWhilePaused).
No module bug was found. The model also settles the pause recheck of R-undirty-settle-timing: a
pending pausable that holds still settles with RESOLVED in its wave, so no balancing RESOLVED is ever
held. A function sees a dependency's terminal apart from its DATA arrays (R-invocation), so no node
can tell whether a terminal shared an array with the last DATA; outputs are compared up to that
boundary. Not modeled: lifetimes, a source reading the lock state, several pausables on one lock
state, placement before a node. (The two-node version's 12 mutations, checked earlier the same day,
went with it.)

Mutations checked on `module_demand.cfg` for the one-node module, 16 in all, each tripping an
invariant, every invariant also alone: an INVALIDATE that keeps the queue, the queue kept after a
service, the queue reversed, no snapshot at activation (HeldMatches, and Serves alone); the auto
INVALIDATE policy (HeldMatches, and Serves and OutputMatches alone); the pull already in the demand
state served at activation, and a request served again on every later run (Serves, and
OutputMatches, HeldMatches and ServeOnlyOnPull alone); the first params of a batch served instead of
the latest, and a service in the wave of the input's COMPLETE (Serves); the INVALIDATE not sent on,
or sent although the holder has no value (OutputMatches); the holder not quiet, sending in the wave
(OutputMatches); deactivation keeping the queue (InactiveHoldsNothing); COMPLETE not ending the holder
(OutputMatches, and EndsWithInput alone); the input's ERROR given to the function, which ignores it
(OutputMatches, and Serves, HeldMatches and EndsWithInput alone); an auto ERROR dropping the
INVALIDATE before it (OutputMatches alone; the full set stops on an evaluation error). The model
found that last one in the kernel: an INVALIDATE followed by an ERROR in one array was lost under
auto ERROR, so an ended node kept a value its input had invalidated, for any auto-ERROR node. The
kernel now applies such an INVALIDATE first (sent with the ERROR by a quiet node), and kernel_wave
checks it (InvalidatedNotKept). Not modeled: a pull during a wave (kernel_lifetime), a pausable
before the holder, a later subscriber's START, activation after the input ended.

`module_history.tla`'s first version, with a flat list, found that R-history's draft text sent one
list per source array while `history.mjs` sends one per wave (the two differ only when a computed
source sends several arrays in one wave). The user chose one per wave and, on the same day, a list
of waves, each entry a wave's `ctx.deps[0].waves` without RESOLVED arrays, `n` counting waves; the
rule text, the module and the model were changed to match. Mutations checked on
`module_history.cfg`, 12 in all, each tripping an invariant, every invariant also alone: a wave's
arrays merged into one, RESOLVED arrays recorded as `[]`, arrays as entries instead of waves, one
list per array, no bound, newest first, a wave without values sending, no snapshot at activation
(Refines); no invalidate hook, the list kept when an INVALIDATE leaves
nothing (ListMatches); the value not the list (ValueIsList); deactivation keeping the list
(InactiveEmpty). Not modeled: checkpoint and restore of the list (C-38), several sources. Revised 2026-11-09: H has the manual INVALIDATE policy, so its function empties the list; the
`nohook` mutation became the function not emptying it (ListMatches). Revised 2026-11-18 for
graphrefly:D812: H has the auto INVALIDATE policy, so an INVALIDATE removes its value and keeps its
list, in the composition and in the rule alike, and the menu gained two waves with values before an
INVALIDATE. `module_history.cfg` (MaxSteps 8): 8,289 states generated, 1,085 distinct, no error.
Three mutations of the composition, each tripping an invariant: the list cleared on an INVALIDATE,
as under the old manual policy (ListMatches); an INVALIDATE not removing the value (Refines); arrays
before an INVALIDATE kept in their wave's entry (Refines). The twelve mutations above were not rerun.
Revised 2026-11-19 after the independent QA of the D812 work, which found that both sides read the
wave through one operator (`After`), so that removing it from both, which keeps the arrays before
an INVALIDATE, stayed green: the three mutations above had each changed the composition alone. The
rule's side now walks the wave's arrays itself and drops its entry at an INVALIDATE; only the
composition uses the kernel's view of the wave. Same 1,085 distinct states. Six mutations, three of
the composition and three of the rule, each tripping an invariant: the function given the arrays
before the INVALIDATE too (Refines), the list cleared (ListMatches), the INVALIDATE not forwarded
(Refines); the rule keeping the arrays before an INVALIDATE (Refines), clearing the list
(ListMatches), not removing the value (Refines).
Revised again on 2026-11-19 after the second QA, which found that the sentence above was true only
of the INVALIDATE reading: both sides still shared `LastN`, `DataOf`, `HasTerm` and the activation
snapshot, so no bound at all, the oldest waves kept, one payload per array and no snapshot at
activation each stayed green when made on both sides, and no wave carried DATA with an ERROR. The
rule's side now has its own bound (`SpecKeep`), payloads (`SpecPayloads`), terminals (`SpecSends`)
and activation (`SpecStart`), and shares only the tokens with the composition; the menu gained a
value before an ERROR, a value with an ERROR in one array, and two waves with two INVALIDATEs.
`module_history.cfg`: 11,125 states generated, 1,609 distinct, no error. Sixteen mutations, each
on one side alone and each tripping Refines: of the composition, no bound, the oldest kept, one
payload per array, a run although the source sent ERROR, no snapshot at activation, the arrays
before an INVALIDATE kept, the INVALIDATE leaving the value; of the rule, the same seven, a wave
with no array counted as an entry, and COMPLETE not seen. The rule's side reads a wave that carries
the source's ERROR as ending the node with no list for it (the kernel's auto ERROR policy);
R-history@1 says so since the user confirmed that wording the same day.

Before `module_checkpoint.tla` was written, probing the module against the original graph found that
a restored node that had not run had no cleanups (a cleanup is a closure registered by a run, and no
checkpoint holds it): a restored history kept stale entries after an INVALIDATE, and a restored timer
source never fired again. It also found that a dependency that only ended before the first
subscription brought its values again, so history appended its snapshot twice. The user chose A2 (a
node whose last run registered a cleanup runs once at its first activation, with only the changed
inputs), an end alone without its values, and a host convention for what the restored node cannot
see before its first subscription. Mutations checked on `module_checkpoint.cfg`, 6 in all, each
tripping an invariant, every invariant also alone: A2 off, the cleanup record not saved
(HookMatches, StateMatches, OutMatches); every restored node always run (NoNeedlessRun); an end
alone bringing its values again, unchanged inputs brought as new, the seed without private state
(StateMatches). Since INVALIDATE got a manual policy (2026-11-09), clearing on INVALIDATE no longer
depends on the A2 rerun, so A2 off is caught by HookMatches alone and no longer by OutMatches;
OutMatches still kills the re-appended end and the unchanged inputs brought as new alone.
Equivalent in this model and pinned by the module tests instead: an end alone not
counted as a change (no recipe here sees an end under the auto policy), and the seed's terminal
ignored (an ended P implies ended states). Not modeled: a manual terminal policy, chains of
restored nodes, recapture before activation, local-only nodes and refusals. Revised 2026-11-10,
when the node's setup replaced A2: Hook became Setup and HookMatches became ResourceMatches (the
restored P holds an open resource exactly when the reference does). Mutations now, 7 in all, each
tripping an invariant, the new ones also alone: no setup at the restored activation, a setup only
when the function runs (A2's shape), a resource kept open by a P that ends at activation
(ResourceMatches); every restored node always run (NoNeedlessRun); and the three StateMatches
mutations above. Extended on 2026-11-10 for D802, with 3 more, 10 in all, each tripping the invariant named:
capture taking the first instance's recipe and setup after a replace (RestoredAsInstance, and
ResourceMatches without it), restore in creation order (RestoreBuilds), no local-only refusal
(LocalOnlyRefused). Rechecked then on the extended model: every restored node always run
(NoNeedlessRun), the seed without private state (StateMatches), no setup at the restored
activation (ResourceMatches); the other four were not rerun.

Before `module_restart.tla` was written, probing the module against R-restart's text found three
gaps: an old restart request restarted the fresh inner at the owner's next activation; a pending
retry replaced the attempt an outside request had started; and a retry fired after the inner's
upstream had ended, starting an inner over it. The user chose to serve a request once (the restart
state's value at activation counting as served) and to drop a retry once another attempt has
started; the third was a module bug against the rule as written. Mutations checked on
`module_restart.cfg`, 11 in all, each tripping an invariant, every invariant also alone: the old
request served again, a stale retry not dropped, the retry's upstream check dropped, no renewal of
an ended inner, unlimited rounds, a restart over an ended upstream, requests never served,
unlimited retries, the first COMPLETE always final (Refines; the last also TerminalOnlyWhenFinal
alone); no fresh retry count per round (CountsMatch); the retry kept across a deactivation
(PendingMatches). Not modeled: several upstreams, the inner's own values and late output, C-34's
fanout timing, a request and an inner terminal in one wave, and U's lifetime: that the owner's hold
on the inner's dependencies (C5a, 2026-11-10) keeps U active across attempts is pinned by the
restart tests; this model's U has no lifetime, only whether it has ended.

`module_bridge.tla` was written on 2026-11-11 for D803, after the user decided the bridge model.
Writing the proposal had found that an inbound node activated after a frame that did not carry its
edge would have no snapshot, so the gate keeps a view of what each edge last brought (approved by the
user with the proposal's section 9; pinned by the reference tests, not this model). Mutations,
selected by the `Mutant` constant, 9 in all, each tripping the invariant named also alone (on
`module_bridge.cfg`, the diamond one on `module_bridge_diamond.cfg`): each edge of a cause released
as its own wave (OneWavePerCause, ViewIsSenderState); a cause per edge instead of per wave
(ViewIsSenderState, SameVersion); no check of the cause number (AtMostOnce, EventsMatch); any number
other than the last accepted (InOrder); unchanged edges resent (EventsMatch); a new session keeping
the old count (QuiescentAgreement); no first cause at a session's start (QuiescentAgreement); no
INVALIDATE in it for an edge without a value (QuiescentAgreement); a gap not reported
(GapReported). R-graph-domain@3's per-graph wave, queue and batch are not modeled: C-47 and the
reference kernel's tests pin them.

Extended on 2026-11-11 with COMPLETE for D804 (R-bridge@2), after graphrefly-py's stage 6 found that
@1 refused a new session's first cause whole when an edge had ended on the receiver, losing the
INVALIDATE it carried for another edge; the model had no terminals, so it could not see it. Writing
the terminals found a second gap: @1 put the INVALIDATE only on an edge without any snapshot, so an
edge that had lost its value and ended came back ended with the old value. EventsMatch now counts the
values skipped at an ended inbound edge, and ViewIsSenderState and QuiescentAgreement leave out an
edge that ended on the receiver after a loss (a new session cannot reopen it; R-bridge says so). New
mutations, each tripping the invariant named alone: refusing the frame whole (QuiescentAgreement),
reporting every skip (NoFalseDivergence), the INVALIDATE only without a snapshot
(QuiescentAgreement). The nine earlier mutations were rerun on the extended model and are each still
caught alone.

Mutations added on 2026-11-11 for D806, each tripping the invariant named alone: the run that sees
the last terminal skipped (AutoCompleteAfterRun, on `kernel_wave.cfg`, also rerun on the model with
Q); a quiet Q delivering its INVALIDATE while still pending, so it marks nothing (RunOnce alone;
SettleOnce trips first with every invariant); no cycle check when a replace runs (Acyclic, on
`kernel_lifetime.cfg`). The earlier 25 `kernel_wave` mutations and the `kernel_lifetime` mutations
were not rerun on the extended models.

## Retired models (deleted at the D797 kernel activation, graphrefly:D798, 2026-11-10)

These models checked the rules the D797 kernel set replaced. They were deleted when that set was
activated (the user's choice, 2026-11-09: authority counts formal coverage by the rule ids that files
under `formal/` mention, so a model left in place would count as coverage of rules it no longer
checks). Git history keeps them, with the README sections that described them. Each one's destination:

| Model (and its configs) | Destination |
|---|---|
| `wave_protocol.tla`, `wave_protocol_MC`, `wave_protocol_invalidate_MC`, `wave_protocol_invalidate_diamond_MC` | Succeeded by `kernel_wave.tla` (wave, settlement, INVALIDATE, terminals); the protocol's actions changed nearly everywhere, so it was replaced rather than updated |
| `wave_protocol_nested_MC` | Succeeded by `kernel_lifetime.tla` (requests made during a request, batches opened from a callback) |
| `wave_protocol_rescue_MC`, `wave_deps_complete.tla` | Succeeded by `kernel_wave.tla`'s manual COMPLETE and ERROR policies |
| `wave_terminal_dirty.tla` | Succeeded by `kernel_wave.tla` (NoWedge: a terminal settles its pending mark) |
| `wave_protocol_replay_MC` | Succeeded by `module_history.tla` (history is a module node) |
| `wave_pull.tla` (and the resumeAll config) | Succeeded by `module_demand.tla` |
| `wave_paused_invalidate.tla` | Succeeded by `module_pause.tla` (INVALIDATE through a pausable) |
| `wave_snapshot_restore.tla` | Succeeded by `module_checkpoint.tla` |
| `wave_reentrancy.tla` (and the acyclic config) | Succeeded by `kernel_lifetime.tla`: a function's write to its own upstream is a queued request (RunOncePerRequest, FIFO, AfterMaker) |
| `wave_rewire.tla`, `wave_rewire_batch.tla` | Succeeded by `kernel_lifetime.tla` (RewireKeeps, DeclaredWhenClosed, RewireOfThisLifetime, BodyAfterCommit) |
| `wave_protocol_pause_MC`, `wave_protocol_bufferall_MC`, `wave_protocol_gap_MC`, `wave_protocol_q14_MC` | Retired: pause modes and PAUSE as a message are gone (pause is placement, `module_pause.tla`) |
| `wave_protocol_resubscribe_MC`, `wave_protocol_replay_resubscribe_MC` | Retired: there is no resubscription (R-terminals); restart is a module (`module_restart.tla`) |
| `wave_protocol_multisink_MC`, `wave_protocol_multisink_batch_MC` | Retired: delivery to several sinks is one step in the D797 models; each subscriber receiving a whole array before the next is pinned by C-34 and the kernel tests |
| `wave_protocol_up_MC`, `wave_up_source.tla`, `wave_pull_routing.tla` (with the sibling config), `wave_pull_routing_diamond.tla` | Retired: nothing travels up the graph (K9 decided away) |
| `wave_protocol_meta_teardown_MC`, `wave_teardown_terminal.tla` | Retired: TEARDOWN decided away |
| `wave_undirty_settle_timing.tla` | Retired: no notification outlives its wave |
| `wave_rewire_deferred.tla`, `wave_rewire_deferred_committed.tla`, `wave_rewire_async_ctx.tla`, `wave_rewire_emit.tla` | Retired: a rewire is the node's own request, run between waves and scoped to its lifetime (`kernel_lifetime.tla`) |
| `wave_async.tla`, `wave_async_paused.tla` (with its ignore, leaf and resumeAll configs) | Retired: an async result is a later wave from the node (`kernel_lifetime.tla`'s late output); a pausable holds it like any array (`module_pause.tla`) |
| `wave_xgraph.tla` | Retired: its two-phase wire gate does not hold under D797 (PENDING only prefixes a settling array). Succeeded on 2026-11-11 by `module_bridge.tla` (D803: a cause is a sender wave, one frame, one receiver wave) |

Kept: `wave_ctx_wave_data.tla` (`wave_ctx_wave_data.cfg`), the raw ctx encoding of the replaced
R-ctx-wave-data@1, as a porting reference: no D797 model checks the shape of `ctx.deps` yet (C-23
and the kernel tests do).

Active rules without a model after the activation: R-sentinel@1 (the absence value is each
language's own, with no cross-language behavior to model), R-node@1, R-node-thin@2,
R-no-imperative@2 and R-graph-domain@2. Since D803 (2026-11-11), `module_bridge.tla` checks R-bridge@1
and R-graph-domain@3's cross-graph clause; its per-graph clause is pinned by C-47. Since D805
(2026-11-11), R-graph-surface@1 and R-primary-api-clean@2 have no model either: they fix shapes
(describe's fields, observe's event), which C-48 and the reference tests pin, and observe's order
is the kernel's delivery order.

`formal/states/` holds TLC state directories from earlier runs; it is not tracked by git.

## Running TLC

```bash
TLA_JAR="/Applications/TLA+ Toolbox.app/Contents/Eclipse/tla2tools.jar"
cd ~/src/graphrefly/formal
java -XX:+UseParallelGC -cp "$TLA_JAR" tlc2.TLC -workers auto -deadlock -config kernel_wave.cfg kernel_wave
```

Each model's row above names its configs, invariants and the state counts of its last green run.
Pass `-metadir <dir>` to keep TLC's state files out of this directory; a three-wave `kernel_wave`
run needs tens of gigabytes.

## Adding a new invariant

Add the operator to the model it belongs to, list it in each of that model's configs, check that a
mutation aimed at it trips it alone, and record the run and the mutation in that model's row above.

## D808 rereview models (2026-11-12)

`kernel_invocation.tla` checks R-invocation@3 over two invocations: dependency reads belong to the supplying invocation, never the whole lifetime. Both a saved ctx and a saved view carry that capability; post-return reads and old-view reads during a later call are rejected. `kernel_invocation.cfg` checks InvocationOnly and CurrentReadable. Mutation switches AllowExpired and ReviveOld must each fail InvocationOnly.

`kernel_batch_output.tla` isolates R-request-order@3/R-wave@3's body-throw, commit-failure and closed-lifetime combinations. Quiet staged output shares commit outcome; late requests survive failed commits but not failed bodies; quiet final DATA and COMPLETE are separate arrays in one wave. `kernel_batch_output.cfg` checks BodyThrowNothing, FailedCommitNothing, LateIndependent, ClosedOutputDropped and QuietTerminalTogether; BindLateToCommit and SplitQuiet must fail their respective invariants. This bounded model does not claim full topology coverage.

`kernel_wave.tla` now lets Q emit one final DATA when its terminal-only invocation runs, making the quiet final DATA/COMPLETE combination reachable. It already groups the arrays into one QuietLater delivery; the old reference split was not justified by this model. The existing two-wave config is rerun; the large three-wave config is not required for this added discriminating trace. Execution results follow in the repair evidence.

D808 execution (2026-11-12, TLC 2.19, two workers): `kernel_invocation.cfg` completed
7 distinct / 16 generated states; `kernel_batch_output.cfg` completed 20 / 20;
`kernel_wave.cfg` (MaxWaves=2, now including quiet final DATA) completed 2,580,844 /
4,013,410 in 4m51s, with all listed invariants satisfied. In separate temporary configs,
AllowExpired and ReviveOld each violated InvocationOnly, BindLateToCommit violated
LateIndependent, and SplitQuiet violated QuietTerminalTogether. These mutations
establish discrimination for those axes; the finite bounds remain the coverage limit.

## QA2 quiet auto-ERROR combination (2026-11-12)

`kernel_quiet_error.tla` checks C-16's four combinations (auto/manual INVALIDATE,
retained/empty quiet output) with another branch updating in the same batch.
The immediate invalidation prevents a stale fan-in DATA3; the later ERROR is
dropped when its lifetime closes. TLC 2.19 checked 24 distinct states at depth 5,
with NoStaleData, ImmediateInvalidation and ClosedErrorDropped passing.
Both delayed-invalidation and manual-policy-bypass mutations violated NoStaleData.
This focused finite model does not cover arbitrary graphs or replace the kernel wave model.
Logs: `/private/tmp/qa2-kernel_quiet_error*.log`; observed host load is in each log.
