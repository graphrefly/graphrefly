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
| [sugar.mjs](sugar.mjs), [sugar.test.mjs](sugar.test.mjs) | `derived` (also `combineLatest`), `map`, `filter`, `reduce`, `latestAsync`, `merge`, `withLatestFrom`, `zip` as ordinary node functions. They show that a policy can live outside the kernel; they are not a chosen operator set |
| [kernel.test.mjs](kernel.test.mjs) | One trace test per implemented behavior |
| [replay.test.mjs](replay.test.mjs), [REPLAY.md](REPLAY.md) | The kernel-applicable clauses of C-28 to C-39, and where every other clause belongs |

## Surface

The graph: `createGraph({ report })` takes an optional host reporter. Then `state(id, initial)`, `node(id, deps, fn, { terminal, quiet, seed })`,
`subscribe(sinkId, id, callback?)`, `unsubscribe`, `replace(id, deps, fn)`, `rewire(id, deps, fn)`, `set`, `invalidate`, `complete`, `error`, `batch`,
`get(id)` (`active`, `has`, `value`, `ended`), `status(id)`, `describe()`, `idle()`, `privateState(id)`, `definition(id)` and `trace`.

`idle()` and `privateState(id)` were added 2026-11-08 for the checkpoint module, as reads only:
`idle()` is true at a wave boundary (no request running and no batch body open; O5 captures only
there), and `privateState(id)` is the private state of the node's current lifetime (R-snapshot
saves all of it). The kernel never reads either. TS reads the same through internal accessors.
`definition(id)` was added 2026-11-10 for the same module, also a read: a node's dependencies and
its current instance's function (null for a state), so checkpoint can tell that a replace or rewire
changed the function even with the dependencies unchanged (C6).

Three scopes nest (R-node, stated 2026-11-10 after the reviews found "no execution layer" untrue):
the node under its id keeps its subscribers, policies and setup; an instance, from creation or a
`replace` to the next `replace`, has the dependencies and function, the retained values and the
terminal; a lifetime, one activation, has the ctx, private state, signal and cleanup. A terminal
ends the instance, and a `replace` of an ended node gives its sinks START again.

`seed` (H4) is optional and was added 2026-11-08 for restore, at the user's request. Before that,
the checkpoint module built without a seed found two cases it could not restore (see the
[modules README](../modules/README.md)).
- What it holds: `{ values?, ended?, state? }`. It gives a computed node its last array's values
  (K3; `[null]` is a value, `[]` none), a terminal and private state, without running its fn.
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
| `signal` | Aborted when the lifetime closes; async work that must stop with the lifetime follows it |
| `deps[i].invalidated` | Under the manual INVALIDATE policy only: an INVALIDATE arrived on this input in this invocation |

The function registers no cleanup. `onInvalidate(f)` was removed on 2026-11-09, replaced by the
manual INVALIDATE policy; `onDeactivation(f)` on 2026-11-10, replaced by the node's setup (K7).

`g.node(id, deps, fn, opts)` takes, besides the policies (`terminal`, `invalidate`) and `quiet`, an
optional `setup(ctx)`: it runs once per lifetime, just before the function's first run, with that
run's ctx; what it sends is part of that run's output, a throw in it ends the node as a throw of the
function does, and a function it returns is the lifetime's cleanup. It stays with the node across
`replace`, as the policies do. TS's `source(factory, setup)` helper has the same shape.

An array keeps the order its author wrote (DS-17 O13): a terminal must be last, DATA and RESOLVED
cannot share one, and an array is split at its last INVALIDATE, dropping what came before it:
`[1, INV, 2, 3]` is published as `[INV]` then `[2, 3]`.

### Differences from the TS baseline (`dafc5ae`)

Audited on 2026-11-06 against `packages/ts/src/node/node-context-runtime.ts` and its callers, after
two differences turned out to be unstated (a run's `ctx.down` calls were merged into one array, and
`deps[i].data` flattened the array boundaries; both now follow TS and R-wave-boundary@2). Two more
found in the audit were the interpreter's own and now follow TS on the user's decision: a late
registration while the lifetime is open is accepted, and `onInvalidate` hooks were not consumed
(the hook itself is gone since 2026-11-09).

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
| `set(id, fn)`: given a function, the value is computed from the state's value when the write runs in request order (in a batch, from the writes staged before it, at the commit); a function that returns the value it was given writes nothing; a throw fails the write, in a batch the whole commit; a plain value is always written, and a function is written as a value only wrapped (`set(id, () => f)`) | TS's state `set` takes a value only (only TS's adapter store has `update(fn)`); TS's pause lock set lives inside the paused node | Added 2026-11-10 at the user's choice (root cause 3 of the D797 review), first as a separate `update(id, fn)` and folded into `set` the same day, as React's `setState`: `set` replaces the whole value and cannot read a write still queued, so the pause handle kept its own lock set and demand and restart kept request counters in closures, outside the graph and lost on restore. The identity bail-out follows React's `setState(prev => prev)`, so a resume of a lock nobody holds starts no wave |
| `rewire(id, deps, fn)`: one request with the whole new dependency list and fn; from inside a function it is queued (K8) | `ctx.rewireNext.subscribeDep`/`unsubscribeDep`/`replaceDeps` (D47), and the immediate `subscribeDep`/`unsubscribeDep`/`replaceDeps` on a node | Added 2026-11-08 at the user's request, after mergeMap on `replace` showed what replace costs it. One form: the kernel compares the lists, so add, remove and reorder are the same request |
| A `subscribe`, `unsubscribe`, `replace` or `rewire` made in a batch body runs after the commit, in request order; a throwing body drops it with the inputs | A rewire waits for the batch only when its node has uncommitted batch output, and is dropped on rollback; any other topology change runs at once | O3 and K8 (2026-11-08): nothing is delivered before commit, and a topology change delivers (a START snapshot, a settlement, cleanups), so it waits like any request made during a wave |
| `node(..., { seed })`: value, terminal and private state; the first activation runs the fn | `restoreStateOfNode` after construction, also restoring status, version and first-call history; the first activation does not run the fn | Added 2026-11-08 for restore. Not running the fn is the checkpoint module's wrapper; there is no first-run gate, status is derived (K10), and versions are O9 |
| A START snapshot carries every DATA value of the node's last array that had any | It carries the cached value only, unless the node has `replayBuffer: N`; a new dependent's fn runs once per replayed value | K3 changed by the user, 2026-11-08: the array is the unit (R-wave-boundary), so a late subscriber sees what the node last sent. History across arrays is a module, not `replayBuffer` |
| An ended node can be subscribed, depended on and added by `rewire` or `replace`; its snapshot carries its terminal | A subscription to an ended non-resubscribable node throws (R-terminal, R2.2.7.b), and rewire refuses one as a dependency (C-8) | P5 relaxed by the user, 2026-11-08 |
| `derived` needs every input on every run: after an input is invalidated it waits for a new value | The first-run gate (`partial: false`) checks only before the first run (R-first-run-gate); later the fn runs with a missing input as SENTINEL. `partial: true` turns the gate off | The user's choice, 2026-11-08: no SENTINEL to guard, and one rule for every run. There is no `partial` option: a gate is sugar (DS-17), and a plain node fn, `merge`, `zip` or `withLatestFrom` is what `partial: true` was. R-first-run-gate@2's clause that an INVALIDATE before the first run removes eligibility holds |
| No `ctx.up` or `upNext`: nothing travels up the graph | `ctx.up` and `ctx.upNext` route DIRTY, PAUSE, RESUME, PULL, INVALIDATE and TEARDOWN along declared connections (R-ctx-up, R-up-routing) | K9 decided away by the user, 2026-11-09. In TS's production code the only upward message is PULL from `ctx.upNext`; pause, demand and restart use declared control pairs (P11), and the builder holds the target's handle (O14) |
| No TEARDOWN message and no `resetOnTeardown` | TEARDOWN is forwarded downstream, with a COMPLETE synthesized before it (R-teardown-complete) | Decided away by the user, 2026-11-09: TS's production code never originates it |
| No `rewireNext`, `pull`, `environment`, `track`, `persist` | Present | `rewire` is queued from a function (K8); `pull` is the demand module; the rest are not covered yet (modules) |

The kernel does not know or care whether a late `ctx.down` came from async work.

**Which arrays a combinator sends** (agreed with the user 2026-11-08, once K3 kept the last array).
The array is the unit, so each combinator in [sugar.mjs](sugar.mjs) follows one of three rules:
- **State**: reads the latest values and sends one array per run. `derived`, also named
  `combineLatest`: when `a` sends `[2, 3]`, the output is one tuple with 3; 2 is never combined.
- **Occurrence**: one output array per input array. `map`, `filter`, `merge` (each dependency's
  arrays as they came, in declaration order), `withLatestFrom` (each primary array becomes one array
  of `[value, latest secondary]` pairs).
- **Pairing**: one array per run, holding every result formed in it. `zip` (with the COMPLETE in
  the same array once a completed dependency's queue is empty).

The tests in [sugar.test.mjs](sugar.test.mjs) are the examples agreed on.
- TS sends one array per value in `merge`, `withLatestFrom` and `zip`. Its `combine` is the same.
- RESOLVED is not an occurrence, so `zip` skips it. A diamond with a filter therefore pairs values
  from different source waves, as in TS and RxJS; that does not come from the array being the unit.

Mutations checked on 2026-11-08, each failing at least one test:
- `merge` sending one array per value, merging one dependency's arrays, or reversing their order
  (merging the arrays survived until a test with two arrays in one run was added);
- `withLatestFrom` with no secondary check, one array per value, no COMPLETE, or completing on the
  secondary;
- `zip` with one array per tuple, completing at once, or never completing;
- `combineLatest` not giving a tuple by default.

## Covered so far

- K1 the closed message set, in written order with the O13 split at INVALIDATE; K2 waves, DIRTY
  prepass, one leading DIRTY per value array, kernel RESOLVED, separate arrays per `ctx.down` call,
  batch as one accumulated array per node with every occurrence kept, DATA/RESOLVED exclusivity.
- K3 START snapshot with the retained values; idempotent subscription. A new node's activation run
  sees its dependencies' snapshots as that run's input. Since 2026-11-08 (the user's decision) a
  node retains the DATA values of its last array that had any, not only the last value; arrays are
  not merged, since the array is the unit (R-wave-boundary). A node that sent `[DATA 1]` and then
  `[DATA 2, DATA 3]`, in one run or two, gives a new subscriber `[START, DATA 2, DATA 3]`, and a new
  dependent `[[2, 3]]` as its first run's input. `get(id).values` reads them (`value` is still the
  last). An array without values keeps them; an INVALIDATE clears them; a computed node drops them on
  its last release (K7), a state keeps them; a batch is one array, so all its occurrences stay. A
  first version kept every value of the last wave, merging its arrays; the user corrected that the
  same day.
- K4 invocation view and private state; a throw becomes ERROR (P10).
- K10 `status(id)` as above. A quiet node is settled for status once it has absorbed its input,
  since its value changes only in its later wave. `stale` is the `pending` flag that P3 marking
  sets, cleared where the node settles; `closing` is a lifetime that exists and is no longer open.
- K5 terminal policy as auto or manual per kind (DS-17 O6), also at the first run of a lifetime;
  nothing follows a terminal, and an ended node's snapshot carries it (P5, relaxed 2026-11-08).
- K6 as decided on 2026-11-09: each node has an INVALIDATE policy, auto or manual, default auto.
  Auto: an invalidated input clears the node's retained value down the cone without running its
  function. Manual: the INVALIDATE is the function's input (`ctx.deps[i].invalidated`), and the
  function clears what it holds and sends INVALIDATE itself. An INVALIDATE array marks the cone and
  carries the prefix like any settling array. A node with no value drops an INVALIDATE; a host
  INVALIDATE to a state without a value starts no wave; a pending node that drops one settles with
  RESOLVED. What an input sent before its INVALIDATE in the wave is dropped; what came after is
  ordinary input. The `onInvalidate` hook is gone: pause, demand and history now use the policy.
- K7 lifetimes: each activation opens one, and the node's setup, if any, runs once in it before the
  first run. Closing it (last release or terminal) aborts `signal`, releases dependencies in
  declaration order, then runs the cleanup the setup returned; a failing cleanup goes to the host
  reporter and the close completes. Until 2026-11-10 every run registered its cleanups again and
  replaced the previous run's (R-cleanup-hooks@1, @2), so a run that registered nothing dropped a
  live cleanup: `latestAsync` lost its abort when a run brought no new value. Computed nodes clear on
  last release; plain state keeps its value.
- K8: a request that arrives while the kernel is busy waits and runs afterwards in arrival order: a
  late `ctx.down`, and `set`, `batch`, `subscribe`, `unsubscribe` reached through a captured graph
  reference. A function writing its own upstream makes an ordinary request too: it runs after the
  wave and reaches the function in a later wave, so the function is never reentered and a feedback
  loop of completed waves is the composition's to end (decided by the user 2026-11-09; until then
  the write was rejected and the throw became the function's ERROR). A
  failing sink or queued request goes to the host reporter. Without a reporter the kernel keeps no
  failure history (R-operation-failure); a reporter that throws is ignored.
- K2 as decided on 2026-11-09: an array carrying a terminal marks the sender's cone pending and gets
  the PENDING prefix like a value array, under auto and manual policies alike, so a fan-in waits for
  a wave's terminals and a manual one runs once on all of them; INVALIDATE does neither. An auto
  COMPLETE goes out in the same delivery as the run's output, so it does not mark the cone again.
  Both were found by `formal/kernel_wave.tla` once it had manual policies.
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
  Called during a wave, the body runs at once and only the commit waits; `batch` returns what the body
  returned, outer or nested, as TS does (user 2026-11-09; the outer batch returned nothing before).
- P9: the invocation that started async work settles its wave at once, so no DIRTY stays open while
  the work runs. Results arrive in arrival order and combine with whatever the other inputs hold then.
- Replace (added 2026-11-08 for O7): `replace(id, deps, fn)` gives a computed node a new instance
  under the same id, keeping its subscribers. It is a request (K8). The old lifetime closes: its signal
  aborts, its late output is dropped, its cleanup runs; no value, private state or terminal survives,
  so an ended node gets a new execution. The dependencies are exchanged as by `rewire` (one shared
  function since 2026-11-08): a dependency in both lists keeps its connection, and keeps its place
  among its dependency's subscribers; added ones are acquired before removed ones are released, so a
  shared one stays active; then the old cleanup runs, as when a lifetime closes (K7). The new instance
  keeps the node's policies and setup, and activates like a first subscription (K3): it gets every dependency's START snapshot, kept ones
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

Mutations of last-array retention checked on 2026-11-08, with the module tests, each failing at
least one test: values merged across arrays; only the last value kept; values never replaced after
the first array; an INVALIDATE keeping them; deactivation or replace keeping them; the seed's values
ignored; a snapshot of the last value only; `get` handing out the kernel's own array (killed after
the copy test was added).

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

- START snapshots of an unsettled node; the released lifecycle of R-status-enum@2.
- Modules: history across waves (R-replay-buffer) is the history module; there is no kernel
  option for it (the user's decision, 2026-11-08). The H4 seed exists only for restore: switchMap and mergeMap were built without
  one (mergeMap first on `replace`, then on `rewire`, now one module with switchMap). Checkpoint
  was first built without one, found the two cases above, and now uses it. Pause, demand,
  observation (H5), restart (O7), switchMap, mergeMap, checkpoint and history are in
  [../modules/](../modules/README.md). H5 needed no kernel hook: a subscriber already receives
  what a node committed.
- The flagship acceptance (B139 S1–S8) runs on this kernel in [../flagship/](../flagship/README.md);
  its only kernel addition was `describe()`.

Decided away rather than left out:

- Upward INVALIDATE (R-up-at-source), the user, 2026-11-08: TS's production code never sends it
  (only a benchmark does). A node that wants a source invalidated goes through a declared control
  edge (P11), or the host calls `invalidate`.
- K9 upward control routing as a whole (R-ctx-up, R-up-at-source, R-up-routing,
  R-up-routing-diamond), the user, 2026-11-09. TS's production code sends only PULL upward, through
  `ctx.upNext`; nothing sends PAUSE, RESUME, DIRTY or TEARDOWN up. Pause, demand and restart
  each run on a declared control pair, and a pull made from a function is a state write queued
  until the wave ends (K8), as `upNext` deferred it to the wave boundary. What goes with it:
  anonymous routing to a holder (O14 already said the builder passes the handle), frozen
  broadcast lists, connection targets kept across a rewire, and once-per-holder delivery over a
  diamond. C-37's last clause, that a closed lifetime revokes old work, is K8's rule that a
  request dies with the innermost scope it was made in.
- TEARDOWN, with R-teardown-complete and R-teardown-terminal-relay, the user, 2026-11-09. TS's
  production code never originates it (it only forwards it), and R-graph-lifecycle@2 already
  withdraws `graph.destroy()`'s broadcast. A lifetime ends at the last unsubscribe (K7); a host that
  wants downstream bridges to settle calls `complete` on the source. The message types are the
  seven K1 lists; `ctx.down` refuses PAUSE, RESUME, PULL and TEARDOWN as unknown types.

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
  previous request's controller, and the lifetime's signal, combined with it, covers close.
- A sink that writes its own source on every wave never drains. The kernel does not guard this (P8);
  a module or the host must.
- Async batch bodies (user discussion 2026-11-06): committing only the part before the first await
  splits writes the user meant to apply together; holding the batch open until the promise settles
  would freeze or interleave every other input for network time. Refusing an `async` function before
  it runs is the only option that applies nothing by surprise. Recognizing `async` relies on native
  async functions; code compiled to generators falls into the promise-returning case.
- Delivery order across sinks follows settlement order, not subscription order: in a batch, a node
  that depends only on the first input settles before one that waits for a second input.
