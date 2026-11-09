# Kernel reference interpreter

Non-normative slices for [graphrefly:B143](../../plan/backlog.jsonl). It writes the kernel
from [DS-17](../../sessions/active/SESSION-kernel-module-classification.md) as a small deterministic
program, so the classification can be checked by running it instead of by reading prose. It does not
define current protocol behavior; [spec/rules.jsonl](../../spec/rules.jsonl) does. It is not package
code either: the TS, Rust and Python runtimes stay the implementations, and accepted traces from here
are meant to become conformance scenarios for them.

```bash
npm run test:reference
```

## Files

| File | Contents |
|---|---|
| [kernel.mjs](kernel.mjs) | The kernel. Every delivery to a sink is appended to `graph.trace` |
| [sugar.mjs](sugar.mjs) | `derived`, `map`, `filter`, `reduce`, `latestAsync` as ordinary node functions. They show that a policy can live outside the kernel; they are not a chosen operator set |
| [kernel.test.mjs](kernel.test.mjs) | One trace test per implemented behavior |
| [replay.test.mjs](replay.test.mjs), [REPLAY.md](REPLAY.md) | The kernel-applicable clauses of C-28 to C-39, and where every other clause belongs |

## Surface

The graph: `createGraph({ report })` takes an optional host reporter. Then `state(id, initial)`, `node(id, deps, fn, { terminal, quiet, seed })`,
`subscribe(sinkId, id, callback?)`, `unsubscribe`, `replace(id, deps, fn)`, `rewire(id, deps, fn)`, `set`, `invalidate`, `complete`, `error`, `batch`,
`get(id)` (`active`, `has`, `value`, `ended`), `status(id)`, `describe()`, `idle()`, `privateState(id)` and `trace`.

`idle()` and `privateState(id)` were added 2026-11-08 for the checkpoint module, as reads only:
`idle()` is true at a wave boundary (no request running and no batch body open; O5 captures only
there), and `privateState(id)` is the private state of the node's current lifetime (R-snapshot
saves all of it). The kernel never reads either. TS reads the same through internal accessors.

`seed` (H4) is optional and was added 2026-11-08 for restore, at the user's request. Before that,
the checkpoint module built without a seed found two cases it could not restore (see the
[modules README](../modules/README.md)).
- What it holds: `{ value?, ended?, state? }`. It gives a computed node a retained value (present
  when `value` is a key, so `null` is a value), a terminal and private state, without running its fn.
  Without a seed nothing changes.
- A seeded ended node is ended like any ended node after its last release: it keeps its declared
  dependencies and never runs (P5).
- A seeded node that has not ended activates as usual: its fn runs on the activation snapshots and,
  if it sends nothing, keeps the seeded value.
- TS does the same through `restoreStateOfNode` and a restored-activation flag. That flag makes the
  first activation take its dependencies' values without running the fn, and skips the subscription
  of an ended dependency. Here the first activation runs the fn as usual; not running it, and the
  refresh on a changed input, are the checkpoint module's policy.

**P5 relaxed** (the user's decision, 2026-11-08). P5 says COMPLETE and ERROR end a node's output for
good and nothing follows them; it does not say an ended node cannot be subscribed. Until this
change the kernel added that ban, and needed an exception to it, for seeded nodes only, to restore
a node that held an ended dependency. Asked which reading is more uniform, the user chose to drop
the ban:
- An ended node is subscribed, depended on, or added by `rewire` or `replace` like any node. Its
  START snapshot carries its last value, if any, and its terminal; it is never run again, and no
  host input reaches it (`set` on an ended state is refused).
- So the first run of a lifetime (activation, or replace's new instance) can see a terminal in a
  snapshot, and K5 applies there as in a settlement: with auto policy an ERROR ends the node without
  running its fn, and once every dependency has ended, COMPLETE follows the run.
- A rewire of an ended node is still refused: the instance has nothing to keep, and `replace` gives
  it a new one.
- The same graph no longer behaves differently by when a subscription comes, before or after a
  dependency ended, and restore needs no exception.
- TS refuses a subscription to an ended non-resubscribable node (R-terminal, R2.2.7.b), so a new
  dependent of one cannot activate, and its rewire refuses an ended dependency (C-8). Here both are
  accepted. This is a rule change for B140; `spec/` is untouched.

`describe()` is P1's "topology is data", added 2026-11-07 for the flagship (S1 compares the
topology of a base and a candidate): every node in creation order as `{ id, kind, deps, quiet }`, a
copy. It is the structural part of TS `describe()`, with no values, status or explain paths.

`status(id)` is K10 as R-status-enum@2 has it, decided with the user on 2026-11-06: a projection of
what the kernel already holds, with no stored status. `cache` is `empty` (no value), `stale` (a
notification it received or sent in the current wave is not settled yet) or `ready`; `output` is
`open`, `completed` or `errored`; `lifecycle` is `inactive`, `active` or `closing` (its lifetime's
cleanups are running). Since no DIRTY spans time, `stale` is visible only from inside a wave, for
example in a sink callback. TS stores one of seven values instead (`sentinel`, `pending`, `dirty`,
`settled`, `resolved`, `completed`, `errored`); `settled` and `resolved` (last settlement DATA or
RESOLVED) have no counterpart here, and `pending` is never set in TS.

A node function has the TS baseline's shape, `(ctx) => void` (R-fn-contract, D8):

| ctx member | Meaning |
|---|---|
| `deps[i].id` | The dependency's id (added 2026-11-08 with `rewire`, so a function need not track positions) |
| `deps[i].waves` | The value arrays dependency `i` delivered to this invocation, each its DATA payloads in order; a RESOLVED array is `[]`; no arrays is `[]` |
| `deps[i].terminal` | Its COMPLETE/ERROR this invocation, or `null` |
| `deps[i].has`, `deps[i].value` | The latest value received from it |
| `state.get()`/`state.set(v)` | Private state of this lifetime |
| `down(msgs)` | During the run: one array of this invocation's output; each call is its own array (R-wave-boundary). After the run returned: a new wave from this node (P9). After the lifetime closed: dropped. DIRTY is not accepted: only the kernel sends it (O11) |
| `signal` | Aborted when the lifetime closes |
| `onDeactivation(f)`, `onInvalidate(f)` | Cleanup for this run (R-cleanup-hooks) |

An array keeps the order its author wrote (DS-17 O13): a terminal must be last, DATA and RESOLVED
cannot share one, and an array is split at its last INVALIDATE, dropping what came before it:
`[1, INV, 2, 3]` is published as `[INV]` then `[2, 3]`.

### Differences from the TS baseline (`dafc5ae`)

Audited on 2026-11-06 against `packages/ts/src/node/node-context-runtime.ts` and its callers, after
two differences turned out to be unstated (a run's `ctx.down` calls were merged into one array, and
`deps[i].data` flattened the array boundaries; both now follow TS and R-wave-boundary@2). Two more
found in the audit were the interpreter's own and now follow TS on the user's decision: a late
registration while the lifetime is open is accepted, and `onInvalidate` hooks are not consumed.

| Here | TS | Source of the difference |
|---|---|---|
| `deps[i].waves` | `ctx.waveData[i]`, which also carries an INVALIDATE absence marker inside an array | O13: INVALIDATE never shares an array with a value, so no marker is needed |
| `deps[i].terminal` is the message or `null` | `ctx.terminal[i]` is `false`, `true` (COMPLETE) or the ERROR payload | Interpreter shape, same information |
| `deps[i].has`/`value` are public | The dependency cache sugar reads sits behind a symbol (`CTX_DEP_CACHE`) | Interpreter shape |
| `deps[i].id` | No dependency identity on ctx; TS's mapOperator keeps its inner list aligned with the dependency positions by issuing removes before adds | Added with `rewire`: a dependency list that changes is read by id, and nothing depends on positions |
| Arrays keep written order | Every `_down` array is sorted by tier | O13 |
| A dependent runs once on all arrays a dependency sent in the wave; they reach each subscriber after the function returned, all arrays to one subscriber, then the next | Each `_down` call is delivered to all subscribers at once, while the function runs | Delivering after the run comes from P9; one delivery per subscriber keeps a dependent from settling between two arrays of the same dependency |
| A sink receives one array per call, `cb(msgs)` | A sink receives one message per call plus delivery metadata, `sink(msg, { wave, last })` | R-wave-boundary@2: the array is the unit. Same information; found 2026-11-07 while writing the H5 module, not listed before |
| `signal` | No signal on ctx | R-fn-contract@2 and R-ctx-lifetime (draft) |
| A registration after close runs once at once | Ignored | R-cleanup-hooks@2 (draft) |
| `replace(id, deps, fn)`: graph-level replace of one computed node, at a wave boundary | No counterpart: TS restarts through `resubscribable` | Added 2026-11-08 for the restart module (O7): a fresh instance under the same id |
| `rewire(id, deps, fn)`: one request with the whole new dependency list and fn; from inside a function it is queued (K8) | `ctx.rewireNext.subscribeDep`/`unsubscribeDep`/`replaceDeps` (D47), and the immediate `subscribeDep`/`unsubscribeDep`/`replaceDeps` on a node | Added 2026-11-08 at the user's request, after mergeMap on `replace` showed what replace costs it. One form: the kernel compares the lists, so add, remove and reorder are the same request |
| A `subscribe`, `unsubscribe`, `replace` or `rewire` made in a batch body runs after the commit, in request order; a throwing body drops it with the inputs | A rewire waits for the batch only when its node has uncommitted batch output, and is dropped on rollback; any other topology change runs at once | O3 and K8 (2026-11-08): nothing is delivered before commit, and a topology change delivers (a START snapshot, a settlement, cleanups), so it waits like any request made during a wave |
| `node(..., { seed })`: value, terminal and private state; the first activation runs the fn | `restoreStateOfNode` after construction, also restoring status, version and first-call history; the first activation does not run the fn | Added 2026-11-08 for restore. Not running the fn is the checkpoint module's wrapper; there is no first-run gate, status is derived (K10), and versions are O9 |
| An ended node can be subscribed, depended on and added by `rewire` or `replace`; its snapshot carries its terminal | A subscription to an ended non-resubscribable node throws (R-terminal, R2.2.7.b), and rewire refuses one as a dependency (C-8) | P5 relaxed by the user, 2026-11-08 |
| No `up`, `upNext`, `rewireNext`, `pull`, `environment`, `track`, `persist` | Present | Not covered yet (K9, modules) |

The kernel does not know or care whether a late `ctx.down` came from async work.

## Covered so far

- K1 the closed message set, in written order with the O13 split at INVALIDATE; K2 waves, DIRTY
  prepass, one leading DIRTY per value array, kernel RESOLVED, separate arrays per `ctx.down` call,
  batch as one accumulated array per node with every occurrence kept, DATA/RESOLVED exclusivity.
- K3 START snapshot with the retained value; idempotent subscription. A new node's activation run
  sees its dependencies' snapshots as that run's input.
- K4 invocation view and private state; a throw becomes ERROR (P10).
- K10 `status(id)` as above. A quiet node is settled for status once it has absorbed its input,
  since its value changes only in its later wave. `stale` is the `pending` flag that P3 marking
  sets, cleared where the node settles; `closing` is a lifetime that exists and is no longer open.
- K5 terminal policy as auto or manual per kind (DS-17 O6), also at the first run of a lifetime;
  nothing follows a terminal, and an ended node's snapshot carries it (P5, relaxed 2026-11-08).
- K6: `invalidate` on a state, and an invalidated input, clear the retained value down the cone and
  run `onInvalidate` hooks after the value is gone. No DIRTY, no function run for the INVALIDATE. A
  repeat, or a node with no value, is a no-op; a pending node then settles with RESOLVED. What an
  input sent before its INVALIDATE in the wave is dropped; what it or another input sent after is
  ordinary input, and the function runs for it after the invalidation (and its hooks) took effect.
- K7 lifetimes: each activation opens one. Closing it (last release or terminal) aborts `signal`,
  releases dependencies in declaration order, then runs this lifetime's deactivation cleanups in
  registration order; a failing cleanup goes to the host reporter and the rest still run. Each run's
  registrations replace the previous run's without calling them. A registration after the run
  returned joins the current run's registrations, as in TS; one after close runs once at once
  (R-cleanup-hooks@2). `onInvalidate` hooks stay registered after they run, as in TS, so a later
  effective INVALIDATE without a rerun runs them again. Computed nodes clear on last release; plain state keeps its value.
- K8: a request that arrives while the kernel is busy waits and runs afterwards in arrival order: a
  late `ctx.down`, and `set`, `batch`, `subscribe`, `unsubscribe` reached through a captured graph
  reference. A function writing its own upstream is rejected, and the throw becomes its ERROR. A
  failing sink or queued request goes to the host reporter. Without a reporter the kernel keeps no
  failure history (R-operation-failure); a reporter that throws is ignored.
- O3 as decided on 2026-11-06: batch delivers no DIRTY before commit. Inside a batch body a node's
  late `ctx.down` is staged with host inputs; a submission that would mix DATA and RESOLVED for one
  node is rejected and earlier staging kept; staged output of a lifetime that closed is dropped. A body declared `async` is
  refused before any of it runs; a plain body that returns a promise commits its synchronous part,
  and a report says that writes after its first await are separate waves. A topology request in a
  body (`subscribe`, `unsubscribe`, `replace`, `rewire`, from 2026-11-08) waits with the batch: it
  runs after the commit wave, in request order and before any request that wave makes, against
  the committed topology (C-22); a nested batch's requests join the outer one; a throwing body drops
  its requests with its inputs, so the body changes nothing. The checks a request makes when it is
  called still throw in the body; one that the commit makes invalid is reported as a queued request.
- P9: the invocation that started async work settles its wave at once, so no DIRTY stays open while
  the work runs. Results arrive in arrival order and combine with whatever the other inputs hold then.
- Replace (added 2026-11-08 for O7): `replace(id, deps, fn)` gives a computed node a new instance
  under the same id, keeping its subscribers. It is a request (K8). The old lifetime closes: its signal
  aborts, its late output is dropped, its cleanups run; no value, private state or terminal survives,
  so an ended node gets a new execution. The dependencies are exchanged as by `rewire` (one shared
  function since 2026-11-08): a dependency in both lists keeps its connection, and keeps its place
  among its dependency's subscribers; added ones are acquired before removed ones are released, so a
  shared one stays active; then the old cleanups run, as when a lifetime closes (K7). The new instance
  activates like a first subscription (K3): it gets every dependency's START snapshot, kept ones
  included; its first run only sets the retained value; each sink gets a `[START, …]` snapshot and each
  dependent receives the snapshot as its input, in one wave, so a diamond below settles once. An
  inactive node only changes its definition. Refused for a state node, for a dependency on itself,
  for duplicate dependencies (the exchange matches them by id). An ended dependency was refused too
  (found missing in the C-8 replay, added, then dropped with the P5 relaxation): the new instance now
  starts on its snapshot. REPLAY.md lists where it differs from R-rewire (C-8).
  Only the kernel can do this, because it rebinds the dependents' input records; the DS-17 rewire row
  had named only H4 (a seed), which restart does not need, so it is not implemented.
- Rewire (added 2026-11-08, surgical, C-8): `rewire(id, deps, fn)` keeps the node's instance: its
  lifetime, private state, retained value and subscribers stay, and sinks get no START. A dependency in
  both lists keeps its connection and input record at its new position; a removed one is released
  without a wave (a request runs between waves, so nothing of it is pending, K8); an added one is
  acquired as at activation, before any is released. The added dependencies' START snapshots are the
  node's input in one ordinary settlement: the function runs and its output is delivered, its cone
  marked pending first if it sends a value (P3); if it sends nothing, nothing goes below. An added
  dependency with no value sends nothing, so the function waits for it. The new fn takes over the next
  run; a rewire alone causes none, so the current list is a no-op. An inactive node only changes its
  definition. Refused for a state node, for itself or a cycle, for duplicate dependencies, and for an
  ended node (`replace` gives it a new instance). An added dependency that has ended arrives as its
  snapshot, with its terminal (P5 relaxed; TS and C-8 refuse it). Removing the
  last dependency still open does not complete a `complete: "auto"` node, although every remaining
  one has ended: the auto completion is decided when a terminal arrives (K5). TS does the same
  (checked 2026-11-08 by running `unsubscribeDep` at `dafc5ae`); such a node stays open. REPLAY.md
  replays C-8 against it. Most of R-rewire's machinery (a removal while the dependency's DIRTY is in
  flight, records kept across a wave, batch outcome) does not arise, because the request runs only
  between waves.
- H6: `{ quiet: true }` records its own dirty inputs but does not pass DIRTY on, so its dependents do
  not wait for it. What it outputs, including an inherited ERROR, is a later wave from it; the arrays
  of one settlement go out together in that wave. Silence needs no RESOLVED. An INVALIDATE carries no
  DIRTY, so a quiet node passes it on at once, as TS does (since the second simplification pass).

Mutations checked on 2026-11-06 for O13 and array boundaries, each failing at least one test: no
split at INVALIDATE; tier sort restored; a run's `ctx.down` calls merged; `waves` flattened; a
dependency's arrays delivered to a dependent one by one; the invalidation applied after the run;
a terminal allowed anywhere; a dependent keeping what came before an INVALIDATE; resumeAll merging
its held arrays. For K10: settling not clearing stale; dependents never stale; a quiet node, or a
quiet node inheriting an ERROR, staying stale; no closing state. After aligning hooks with TS: invalidate hooks consumed after running; a late
registration rejected; a late registration ignored. Rerun after the second simplification pass, each
still failing at least one test: no split; merged `ctx.down` calls; arrays delivered one by one;
invalidation after the run; a quiet INVALIDATE as a later wave; an applied INVALIDATE applied again;
settling not clearing stale; dependents never stale; a quiet node, or one inheriting an ERROR,
staying stale; no closing state; no kernel RESOLVED; requests run immediately; upstream writes
allowed; activation output not published; invalidate hooks consumed. After the `apply`/`deliver`
split: the invalidation applied again with the output (12 tests fail); applied after the run; an
ineffective INVALIDATE kept; late output in a batch not staged; a quiet INVALIDATE delayed; no kernel
RESOLVED; no DIRTY prefix; an ended node not closing its lifetime. The last one survived every test
until kernel test "K5/K7: a node that ends closes its lifetime at once, while still subscribed" was
added.

Mutations of `replace` checked on 2026-11-08, together with the restart module's tests, each failing
at least one test: no pending mark before the snapshot wave; old dependencies released before the
new ones are acquired; old cleanups not run; old signal not aborted; no START to sinks; dependents
keeping the old input record; a new instance that ends at once keeping its lifetime; no cycle check;
run at once instead of queued; an inactive node keeping its old terminal. Four of them (the pending
mark, the input record, ending at once, the inactive terminal) survived until their tests were added.

After `replace` and `rewire` were made to share one dependency exchange (2026-11-08, the user's
choice), every mutation of both was run again with the module tests, 35 in all, each failing at least
one test. Two survived at first: releasing removed dependencies before the new instance runs, which
needs no order (the exchange already acquires first), so the exchange now releases them itself and
the old cleanups run before the new instance, as at a lifetime's close; and a replace keeping a kept
dependency's old input record, killed by the test "the new instance gets a START snapshot from a
dependency it keeps". A random test (scratch, not committed) also ran 2000 sequences of set,
complete, subscribe, unsubscribe, rewire, replace and batch, checking after every step that no node
is pending, every connection's position points back at its dependency, an active node holds each
dependency once, a node without a lifetime holds none, and inputs match their dependency's value;
none failed, and a mutant that does not move a kept connection's position failed 235 of 400.

Mutations of `rewire` checked on 2026-11-08, together with the C-8 replay and mergeMap, each failing
at least one test: removed dependencies released before added ones are acquired; a kept dependency's
connection keeping its old position; a kept input record dropped; a pending mark before the
settlement (a silent node would send `[DIRTY, RESOLVED]`); no settlement for the added snapshots; an
inactive node taking the active path; an ended node accepted; an added ended dependency accepted; a
kept ended dependency refused; duplicates accepted; the fn not replaced; no cycle check; no `id` on
`ctx.deps`. A first version marked the cone pending before the settlement; that mutant survived
every test, since `deliver` already marks the cone when the node sends a value, so the mark was
removed.

Mutations of the seed and the P5 relaxation checked on 2026-11-08, together with the checkpoint,
restart, higher-order, pause, demand and observation tests, each failing at least one test:
- the ban back, for a subscription or for a dependency; a rewire of an ended node allowed;
- an ended node run when connected, or not marked active;
- at the first run, no auto ERROR, or one under manual policy; no COMPLETE, one for a node with no
  dependencies, or one under manual policy; replace's new instance skipping that policy;
- the seed's value, `null` value, private state or terminal ignored.

Removed because they could not change anything: the seeded flag and the exception (with the ban
gone), and a check that the first run had not ended the node before COMPLETE is added (output after
a terminal is dropped).

Mutations of the batch's topology requests checked on 2026-11-08, each failing at least one kernel
test: run at once in the body (the old kernel); appended after requests already queued; placed after
the requests of the commit wave; run before the commit; kept when the body throws; a nested batch
running its own at once. The random test above, extended with batches that set a state and make a
`rewire` or `replace` and a `subscribe` or `unsubscribe`, ran 2000 sequences with no failure.

Mutations checked on 2026-11-06 after the simplification pass, each failing at least one test: no
batch-wide DIRTY prepass; no kernel RESOLVED; requests run immediately; a quiet node forwarding DIRTY,
or publishing its output or ERROR in the current wave (the invalidation case was reversed in the
second pass); INVALIDATE always effective; an
invalidated input running the function; closed-lifetime output not dropped; cleanups accumulating
across runs; own cleanups before dependency release; an async batch body accepted; `ctx.down` after
return lost; `ctx.down` during the run treated as a later wave. The unsubscribe-during-a-wave test
passes even without the queue, because delivery already uses the subscriber list as it was when
publication began (K3).

## Simplification pass (2026-11-06)

The user asked that anything not discussed before and absent from earlier implementations be
questioned and, if kept, listed. Removed in this pass:

- `ctx.later()`, the return value `{ down, state }` and the `activation` flag: one output path,
  `ctx.down`, as in the TS baseline.
- The `pending` flag on reads, with the state behind it (a wave flag, a per-wave set of settled nodes,
  a staged-cone search). Whether a node is about to change is node status, K10, to be done against the
  TS `Status` set.
- Two per-dependency records merged into one; the per-wave list of touched nodes, the lifetime
  counter and `inspect` with its `invocations` and `dropped` counters. Tests count invocations
  themselves.

Second pass, 2026-11-06, after O13, array boundaries, quiet arrays and K10 had been added. Removed:

- The `priorHooks` path that carried a quiet node's invalidate hooks to its later wave. A quiet
  node now passes an INVALIDATE on at once (it carries no DIRTY, and TS does the same), so every
  node applies an invalidation the same way. Behavior change: kernel test "H6: a quiet node passes
  an INVALIDATE on at once...".
- The K10 `open` flag: it was `announced` cleared at settlement. `announced` now means "notified in
  this wave and not settled yet"; every node clears it where it settles, so the reset of all nodes
  at the end of each wave (and the `try/finally` around it) went too.
- The K10 `closing` flag: a closed lifetime is now dropped (`n.life = null`), so "a lifetime that
  exists and is no longer open" is closing.
- The `running` stack: node functions never run nested (requests during a run are queued), so one
  variable is enough.
- The activation run's own copy of "apply output to the node": it uses `publish`, the node having no
  subscriber yet.

`publish` split into `apply` and `deliver`, 2026-11-06, on the user's decision. `apply` writes a
node's own output into what it holds (value, invalidation with its hooks, terminal) and returns what
remains to send; `deliver` adds the kernel RESOLVED, announces if needed, prefixes DIRTY, hands the
arrays to each subscriber and closes an ended lifetime. `publish` is `deliver(apply(...))`. TS has the
same two halves (`_down` and `_emitToSubs`). Settle applies an input's invalidation with `apply`
before the function runs and later delivers it together with the run's output, so the `applied`
parameter, its skip-the-first-array case and settle's own copy of the invalidation code are gone.
Without it, a second application would have found no value and dropped the INVALIDATE. The two
helpers for later output (`publishLater`, `publishFramesLater`) became one, `later`; inside a batch
body it stages the arrays as one accumulated array, which is what staging did before.

Renamed 2026-11-07 after comparing with TS and other reactive libraries, on the user's decision:
`publish` → `down` (TS `_down`; RxJS has a deprecated `publish()` operator with another meaning),
`announce`/`announced`/`dirtyDeps` → `markPending`/`pending`/`pendingDeps` (TS `_markDirty`; the
user prefers "pending", which other libraries use for "possibly stale"), `retireInputs` →
`releaseDeps` (one verb with `release`), `life` → `lifetime` (R-ctx-lifetime). The wire message
keeps the spec's name DIRTY; renaming it is DS-17 O15. The earlier sections above keep the names
they were written with. `runWave` stays although TS `_runWave` runs one node's function (the
kernel's `invoke`): here it runs the whole wave. `settle` stays too, on the user's decision: the
spec uses the word (R-diamond "after all changed deps settle"), and TS has no function of that name.
It is TS's per-message dependency handling in `node-input-runtime.ts` (ERROR with error=auto,
INVALIDATE, automatic COMPLETE) plus `_maybeRun`/`_tryRun`. The kernel calls it once per wave,
after every input the node waits on has settled, which is `_tryRun`'s `_wave.pending > 0` check;
it is one function because the kernel handles a wave's arrays together, not one message at a time.
`maybeRun` was not taken: settle does not always run the function (a dependency ERROR ends the
node without it).

Tried and kept: deriving an input's ended state from the dependency's own `ended`. It differs from
what the node has received within one wave (draft R-ctx-wave-data: received, not current upstream),
so a node completed before its dependency's own COMPLETE reached it. Kernel test "K5: automatic
COMPLETE waits until the node has received every dependency's terminal..." now pins this.

Kept although not discussed before, with the reason:

| Kept | Why |
|---|---|
| `ctx.deps[i]` as one record instead of TS's `waveData`/`terminal`/dependency cache | Same information, including the per-array boundaries since 2026-11-06; the shape is the interpreter's, not a proposal |
| An invalidated input and DATA from another input in one wave: the node invalidates, then its function runs | Changed 2026-11-06 with O13; it was "the function does not run". This matches TS, which invalidates and then runs |
| An invalid output array (DATA with RESOLVED, a terminal not last) throws from `ctx.down`; uncaught, the throw is the producer's ERROR | DS-17 does not settle the routing. Before 2026-11-06 a DATA+RESOLVED array was turned into ERROR without throwing |
| The host reporter as an optional `report` callback | The draft's host reporter (R-operation-failure). It was a growing array until 2026-11-06, which kept the failure history the rule says the kernel must not keep by default |
| Ignoring a reporter that throws | Its failure has nowhere else to go, and throwing would break the wave it reports on |
| Sink ids and `trace` | Test instrumentation, not kernel behavior |

## Not covered yet

Each of these is left out rather than approximated:

- K9 upward control routing: not needed for pause or demand (control pairs, DS-17 P11); START
  snapshots of an unsettled node; the released lifecycle of R-status-enum@2.
- Upward INVALIDATE (R-up-at-source); INVALIDATE before a node's first invocation (R-first-run-gate).
- Modules: replay. The H4 seed exists only for restore: switchMap and mergeMap were built without
  one (mergeMap first on `replace`, then on `rewire`, now one module with switchMap). Checkpoint
  was first built without one, found the two cases above, and now uses it. Pause, demand,
  observation (H5), restart (O7), switchMap, mergeMap and checkpoint are in
  [../modules/](../modules/README.md). H5 needed no kernel hook: a subscriber already receives
  what a node committed.
- The flagship acceptance (B139 S1–S8) runs on this kernel in [../flagship/](../flagship/README.md);
  its only kernel addition was `describe()`.

## Observations so far

- First replay of C-28 to C-39 (REPLAY.md): no kernel clause failed; two batch bugs were found and
  fixed. The two disagreements with the draft became DS-17 O11 (DIRTY is sent by the kernel only,
  which retires C-29) and O12 (batch from a callback stays allowed, no extra rule).

- No DIRTY spans time. Batch announces only at commit (O3), node output cannot contain DIRTY (O11),
  and async work cannot hold a wave open:
  the starting wave settles now and the result is a fresh wave with its own DIRTY. R-async-paused@2
  says a raw deferred-result author "must eventually send DATA, RESOLVED or terminal"; under this
  model the author owes the protocol nothing.
- Writing another node from inside a wave would, if run at once, add DIRTY to a cone after parts of
  it settled: a fan-in could run twice in one wave, and whether it saw the write would depend on
  execution order. Queueing gives the same two waves in either order (see the K8/P7 test).
- INVALIDATE needs no DIRTY to stay glitch-free in a diamond, because the second arrival at the fan-in
  finds no value and is a no-op.
- `latestAsync` shows that switch-style cancellation needs no kernel help: private state holds the
  previous request's controller, and a cleanup hook covers close.
- A sink that writes its own source on every wave never drains. The kernel does not guard this (P8);
  a module or the host must.
- Async batch bodies (user discussion 2026-11-06): committing only the part before the first await
  splits writes the user meant to apply together; holding the batch open until the promise settles
  would freeze or interleave every other input for network time. Refusing an `async` function before
  it runs is the only option that applies nothing by surprise. Recognizing `async` relies on native
  async functions; code compiled to generators falls into the promise-returning case.
- Delivery order across sinks follows settlement order, not subscription order: in a batch, a node
  that depends only on the first input settles before one that waits for a second input.
