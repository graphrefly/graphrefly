# GraphReFly formal specification

This directory contains the TLA+ formal specification of the GraphReFly
wave protocol. The CANONICAL normative source is [`spec/rules.jsonl`](../spec/rules.jsonl)
(clean-slate); each TLA+ invariant pins one or more `R-*` rules.

## D797 kernel models (active since 2026-11-10, graphrefly:D798; module models check draft module rules)

New models for the D797 draft rules, written for graphrefly:B140. The models below verify the
currently active rules and are retired or rescoped at activation, not edited now.

| Module | Covers | Conformance |
|---|---|---|
| `kernel_wave.tla` (`kernel_wave.cfg`, `kernel_wave_3.cfg`) | R-wave, R-messages, R-invalidation, R-terminals, R-subscription, R-failure: a state S and a diamond S->B,C->D, B and C under the default auto policies and D under each combination of auto and manual COMPLETE, ERROR and INVALIDATE, chosen at Init; host inputs to S (set, a batch of two, invalidate, complete, error); computed nodes choose outputs from a menu that includes rejected arrays; nodes settle in every order the dependencies allow. Invariants: RunOnce, SettleOnce, FanInAfterSettle, NoWedge, PendingPrefix, InvalidateAlone, NoDataWithResolved, TerminalLastAndFinal, InvalidateEffective, RetainedMatchesSent, AutoErrorNoRun, AutoTerminals, ManualEndsByFunction, ManualSeesInput, ManualInvalidateKept, InvalidatedNotKept. TLC-green 2026-11-09 with the INVALIDATE policy and INVALIDATE marking the cone: two waves 990,778 distinct states (depth 11); three waves 114,655,914 distinct states (depth 16). 2026-11-10, RESOLVED is the kernel's alone (D799): an output with RESOLVED is rejected like one with PENDING, and the run-level check of that morning, with its two menu entries and NoDataWithResolvedInRun, is gone again: two waves 990,778 distinct states (depth 11); three waves 114,655,914 distinct states (depth 16, 41 min), as before the run-level check. | C-28, C-34, C-36, C-40, C-41, C-42, C-44 |
| `kernel_lifetime.tla` (`kernel_lifetime.cfg`, `kernel_lifetime_4.cfg`) | R-lifetime, R-request-order: a state S and a chain S->P->A->M, with N over A that a rewire or replace moves to {P}, {A} or {P, A}; host sinks on M and N; each request (subscribe, unsubscribe, set, complete, rewire, replace, late output) is one step, a wave is one step in which each open node of the cone runs once, and the requests made while one runs wait in a queue; A and N may have a setup (chosen at Init) that registers the lifetime's one cleanup before the first run; runs may start late work that keeps its ctx, set private state or complete; one batch body, opened at a boundary or from a callback during a request, stages writes and topology requests, then returns or throws; opened during a request, its commit waits in the queue. Invariants: ActiveIffDemand, EdgesMatchDeps, OpenIffLive, InactiveHoldsNothing, StateKeeps, PrivOfCurrentLifetime, RetainedFromCurrentLifetime, CleanupOnce, ClosedRan, OpenNotRun, OneCleanupPerLifetime, RunOncePerRequest, KeptUpstreamStays, RewireKeeps, DeclaredWhenClosed, RewireOfThisLifetime, EndedHoldsNoPriv, FIFO, AfterMaker, IdleDrained, BodyAfterCommit, ThrownDropped, BatchThrowNothing. TLC-green 2026-11-10 with the per-lifetime setup and N's rewire on its ctx (it carries its lifetime, and closing the lifetime puts back the declared dependencies): three requests 99,380 distinct states (depth 11, 3 s); four requests 2,242,372 distinct states (depth 13, 2 min). With D799 (a replace gives N's new instance its own setup or none; a node that ends drops its private state): three requests 149,216 distinct states (depth 11, 7 s); four requests 4,227,370 (depth 13, 2 min). | C-29, C-31, C-33, C-35, C-37, C-41 |
| `module_pause.tla` (`module_pause.cfg`, `module_pause_6.cfg`) | R-pause: the one-node pausable of `reference/modules/pause.mjs` (pausableFn over the input and a lock state, manual COMPLETE, ERROR and INVALIDATE) run over the kernel's settle semantics beside a pausable written from R-pause's text; each wave is one host batch to the input (writes, INVALIDATE, a terminal) and/or a new lock set. Every array the input sends marks the pausable pending, an INVALIDATE included; an INVALIDATE the pausable sends while it has no value is dropped, and the wave settles with RESOLVED. The two-node version (pauseLog, then release) was retired on 2026-11-09, when INVALIDATE got a manual policy. Invariants: Refines (wave-by-wave output equal, a trailing terminal compared in an array of its own), HeldMatches, NoValueWhilePaused, EndsWithInput. TLC-green 2026-11-09: four waves 1,542 distinct states (depth 5); six waves 12,823 distinct states (depth 7, 4 s). | C-30 |
| `module_demand.tla` (`module_demand.cfg`, `module_demand_7.cfg`) | R-demand: the one-node pullable of `reference/modules/demand.mjs` (the quiet holder over the input and a demand state, manual COMPLETE and INVALIDATE, auto ERROR) run over the kernel's settle semantics beside a holder written from R-demand's text; a step is a host batch writing the input and making zero, one or two pulls, or the sink subscribing or unsubscribing; the service sends one DATA or stays silent. Nothing goes out in the wave; the holder's INVALIDATE, service output and terminal go out as a later wave, the INVALIDATE dropped while the holder has no value. The two-node version (pullLog, then the holder) was retired on 2026-11-09, when INVALIDATE got a manual policy. Invariants: Serves, OutputMatches, HeldMatches, ServeOnlyOnPull, InactiveHoldsNothing, EndsWithInput. TLC-green 2026-11-09: five steps 15,678 distinct states (depth 6); seven steps 140,323 distinct states (depth 8, 1 min). | C-32 |
| `module_history.tla` (`module_history.cfg`) | R-history: the history node of `reference/modules/history.mjs` (auto policies, manual INVALIDATE policy, its function emptying its list) over a computed source X kept active by its own sink, run over the kernel's settle semantics beside a history written from R-history's text; a step is a wave of X (one entry of a menu: several arrays, an array with two values, RESOLVED alone or before values, INVALIDATE and values, values with a terminal) or H's sink subscribing or unsubscribing; N = 2, and the list's entries are waves of arrays. Invariants: Refines, ListMatches, ValueIsList, InactiveEmpty. TLC-green 2026-11-09: eight steps 651 distinct states (depth 9, 1 s). | C-38 |
| `module_checkpoint.tla` (`module_checkpoint.cfg`, `module_checkpoint_9.cfg`) | R-checkpoint, R-invocation: states A and B and a recipe node P over them, whose run keeps the last N input values in private state; at Init, whether P has a setup that opens an outside resource (the kernel runs it at every activation, a restored one's included) and whether P has the manual INVALIDATE policy, under which an INVALIDATE empties the private state; the original graph takes host steps live, then one capture and restore, a window in which host steps reach only the states, and the restored P's first subscription through the module's seed, the setup and the wrapper, after which both graphs take the same steps. The reference is the original P given the window's net change as one live wave. Invariants: StateMatches, ResourceMatches, OutMatches, NoNeedlessRun. TLC-green 2026-11-10 with the setup choice: seven steps 177,962 distinct states (depth 8); nine steps 608,960 distinct states (depth 10). | C-38 |
| `module_restart.tla` (`module_restart.cfg`, `module_restart_10.cfg`) | R-restart: the owner of `reference/modules/restart.mjs` (manual terminals, private round, failures, last request served and attempt count, the lifetime's signal, the renewal in the cleanup its setup returns, replace at the end of the wave) over an inner on an upstream U, beside an owner written from R-restart's text that numbers attempts and lifetimes; a step is the sink subscribing or unsubscribing, the inner sending a value, COMPLETE, ERROR or a value with COMPLETE, U ending, a restart request, or a pending retry's timer; retries wait for a timer or not (chosen at Init). Invariants: Refines, CountsMatch, PendingMatches, TerminalOnlyWhenFinal. TLC-green 2026-11-09: two rounds and two attempts, seven steps 4,638 distinct states (depth 8); three attempts, ten steps 25,974 distinct states (depth 11, 1 s). | C-43 |

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
(NoDataWithResolved), 24 in all. Run: `java -cp <tla2tools.jar> tlc2.TLC -deadlock -config kernel_wave.cfg kernel_wave`.

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
`nohook` mutation became the function not emptying it (ListMatches).

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
mutations above.

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
| `wave_xgraph.tla` | Retired: its two-phase wire gate does not hold under D797 (PENDING only prefixes a settling array). R-graph-domain@2 puts cross-graph consistency in the bridge's release of one cause as one batch (C-1); the bridge module gets a new model when it is written, so R-graph-domain@2 has no model until then |

Kept: `wave_ctx_wave_data.tla` (`wave_ctx_wave_data.cfg`), the raw ctx encoding of the replaced
R-ctx-wave-data@1, as a porting reference: no D797 model checks the shape of `ctx.deps` yet (C-23
and the kernel tests do).

Active rules without a model after the activation: R-sentinel@1 (the absence value is each
language's own, with no cross-language behavior to model), R-node@1, R-node-thin@2,
R-no-imperative@2 and R-graph-domain@2.

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
