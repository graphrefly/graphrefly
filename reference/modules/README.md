# Modules over the reference kernel

Non-normative. Each module here is built only from the [reference kernel](../kernel/README.md)'s
public surface: nodes, state, `ctx`, and requests. If a module needs a kernel change, that is a
finding about the DS-17 classification, not something to patch in quietly.

```bash
npm run test:reference
```

Every module builds its nodes on an ordinary graph, each with its recipe in its definition (the
kernel's node option `recipe`), so a graph with any module can be captured and restored (F6, the
user's choice, 2026-11-10; one build path since D799 the same day). Each module exports its recipes
(`pauseRecipes`, `demandRecipes`, `restartRecipes`, `higherOrderRecipes`, `historyRecipes`), which a
restore's registry must include, and a handle over a restored graph (`pauseControl`, `pausableOf`,
`pullableOf`, `restartableOf`). A function a module takes from its user is always given as a function;
to make the module's nodes restorable the user adds a recipe that builds it: demand's
`pullable(g, id, input, serve, { recipe })`, restart's `{ fn, recipe }`, and a higher-order
`project` whose definitions carry `recipe` plus the operator's `{ recipe }` for the projector.

## Pause ([pause.mjs](pause.mjs), [pause.test.mjs](pause.test.mjs))

First module, 2026-11-06, for DS-17 O8 and the R-pause-lockset / R-pause-modes /
R-paused-invalidate cluster.

`pausable(g, id, inputId, { control })` places a pausable `id` after `inputId`, and returns a handle
with `pause(lock?)` (returns the lock) and `resume(lock)`. `control` lets several pausables share
one lock state. `controlPair(g, id)` is the same handle with no node of its own, for a source that
must stop working itself.

Topology:

```text
inputId ──► id
id.pauseLocks ──┘
```

One node since 2026-11-09, when INVALIDATE got a manual policy (K6): the input's INVALIDATE is the
pausable's input, so it drops what it held and sends INVALIDATE itself. Before, it took two nodes;
see "Why two nodes" below, kept as the record of what the policy replaced.

**The declared control pair is an ordinary dependency.** The pausable depends on a plain state node
`${id}.pauseLocks` whose value is the list of held locks. That gives every O8 condition without kernel
help:

| O8 condition | How |
|---|---|
| Directed: reach pausable2 alone | Each pausable has its own lock state |
| Declared at construction, drawable as a control edge | It is a real declared edge |
| A call during a wave applies at the wave boundary | It is a state write, queued by K8 |
| Pause state observable | It is the control state's value |
| Locks survive the pausable's close (R-pause-lockset) | Plain state keeps its value (K7) |
| A source that must stop does it in its own function | It declares the control dependency (test "a source that must stop working...") |

**One kind of pausable, no modes.** While paused nothing goes out and every array that arrives is
held, in order and with its boundaries. On the final resume all held arrays go out in one wave, each
as it arrived: `[1]`, `[INV]`, `[2, 3]`, `[4, 5]` while paused gives `[INV]` at once and `[2, 3]`,
`[4, 5]` on resume. An INVALIDATE passes at once and discards what was held before it (finding 3). A
terminal passes at once and discards what was held.

TS has two modes on the paused node itself: default pause skips the node's function while paused
and runs it once on resume, seeing everything buffered in `waveData`; resumeAll lets the function
run and holds only its publication. Here they are where the pausable goes:

| TS | Here |
|---|---|
| Default pause of node N | A pausable before N: N gets no value while paused, and on resume runs once on every array held since the last INVALIDATE |
| resumeAll of node N | A pausable after N: N keeps computing; what it publishes is held |

An earlier version had a `"latest"` mode that sent only the input's current value on resume. TS has
no such mode: what a default-paused node sends on resume is up to its function (value sugar such as
`derived` uses the latest values, a per-occurrence function sees them all). Removed on 2026-11-06.

Since 2026-11-10 the handle keeps nothing: `pause` and `resume` set the lock state with a function
(`g.set(id, fn)`, K8), so the lock state is the only copy, a restored lock is released by any handle, and
a default lock gets a random id. Mutation-checked then: the old closure handle (a lock held only in
the state is never released), and in the kernel a function computed at call time (two pauses in one
wave lose a lock). Earlier mutations: a handle that reads and rewrites graph state instead of keeping
its own lock set (loses a lock when two pauses happen in one wave); never paused; auto complete; releasing an unknown
lock still writing; the log without its invalidate hook; the log silent while paused (it then has
no value and misses an INVALIDATE); the log keeping its queue after a resume; `id` releasing while
paused; either node swallowing COMPLETE; `control` ignored; the release node merging the held
arrays, or releasing only the latest. Each fails at least one of the 20 tests or the 9 replay tests.

Fixed 2026-11-09, found while writing `formal/module_pause.tla`: unpaused, an array such as
`[DATA 5, COMPLETE]` came out as `[COMPLETE]`, losing its DATA, because the log answered a terminal
without looking at what came with it, and auto ERROR dropped the DATA beside an ERROR the same way.
Both nodes now use manual COMPLETE and ERROR, and the terminal goes out after the arrays that came
with it (while paused, alone, discarding what was held). New test: "unpaused, an array with DATA and
a terminal passes unchanged; paused, only the terminal passes"; it fails on the old module.

The pause clauses of C-30, C-31 and C-36 are replayed in
[pause.replay.test.mjs](pause.replay.test.mjs); [REPLAY.md](../kernel/REPLAY.md) labels each one.

### Findings

1. **Pause needs no kernel change.** No class-1 message, no keyed `ctx.up`, no hook H1 or H3. This
   answers O8's question (no H3; pairs instead of keyed `ctx.up` for pause) and narrows O2: of the
   class-1 types, only PULL, and the O7 restart request if that stays a message, still need the
   upward channel.
2. **Every pause or resume is a wave through the pausable.** Downstream sees `[DIRTY, RESOLVED]`, and a
   raw downstream function runs on all-RESOLVED (P8); value sugar such as `derived` does nothing.
   Options: accept it; make the pausable quiet (H6), so control changes reach no one, at the cost of
   pass-through DATA also arriving one wave later; or add a per-dependency quiet edge to the kernel,
   a new concept. Accepted by the user on 2026-11-06.
3. **Every INVALIDATE discards what was held before it.** The kernel passes INVALIDATE without
   running any function (K6), so the pausable cannot hold it in order the way
   R-pause-modes and R-paused-invalidate expect (`DATA(1), INVALIDATE, DATA(2)` all on resume).
   Decided by the user on 2026-11-06: the INVALIDATE goes out at once and the values held before it
   are discarded, so downstream never receives a value older than an INVALIDATE it already has.
   `[1]`, `[INV]`, `[2]`, `[INV]`, `[3]` while paused comes out as `[INVALIDATE]` at once and `[3]` on
   resume. Rejected then: giving INVALIDATE an auto/manual policy like terminals (O6), a
   new kernel option. **Reversed on 2026-11-09** after two independent reviews (a Fable session and
   Codex) showed that demand had copied the two nodes below, history needed the hook, and A2 had
   grown from it: the policy replaces the `onInvalidate` hook, so the kernel loses a concept.
   **Why two nodes (until 2026-11-09).** A node learns of an INVALIDATE only through its own `onInvalidate`, which runs
   only when its own value is invalidated. A single node that holds arrays while paused has no value
   after the first INVALIDATE and cannot get one without showing it downstream, so it misses the next
   INVALIDATE. A first version did exactly that and sent `[2]`, `[3]` above. So
   `${id}.pauseLog` republishes its whole queue on every arrival while paused, has a value whenever it
   holds anything, and clears its own state on every INVALIDATE that matters. `id` shows nothing
   while paused. Each node keeps only its own `ctx.state`; nothing is shared through the handle.
   The `[DIRTY, RESOLVED]` that follows such an INVALIDATE on resume does not bring a value back:
   RESOLVED settles the pending DIRTY and refers to no value, so downstream stays absent and value
   sugar does not run (R-resolved-undirty). Dropping it would leave that DIRTY open; reporting an
   error would turn every pause or resume after an INVALIDATE into an ERROR.
4. **The two TS modes are placement, and a raw function behind a pausable still runs.** Default
   pause of N is a pausable before N; resumeAll of N is a pausable after N (see the table above).
   Upstream of a pausable keeps computing unless a source declares the control dependency; that is
   the O8 direction (pausable nodes are designed in advance). One difference remains: the draft and
   TS run no function of a default-paused node while paused. Here a raw function of N runs on each
   `[DIRTY, RESOLVED]` that a pause, a resume or a held arrival causes (P8, finding 2), and sees no
   value; value sugar does not run. Test "placed before a node...".
5. **The TLA+ inconsistency DS-17 lists resolves in the draft rule's favor.** After the pausable ends,
   its locks stay in the control state, as R-pause-lockset says, not cleared as
   `TerminalClearsPauseState` in `formal/wave_protocol.tla` requires.
6. **Held arrays keep their boundaries; a re-pause applies after the resume wave.** A first
   version merged the held arrays into one, because the kernel then merged a run's `ctx.down` calls
   (an unstated difference from TS, fixed 2026-11-06, see the kernel README). Now each held array
   goes out as it arrived. C-30 also expects a re-pause issued while the first array is delivered to
   stop before the second; here all held arrays go out in the resume wave, and the re-pause, a
   request, applies after it (K8). Stopping between them would need one wave per held array, which
   the module would have to request itself.
7. **A self-stopping source runs its function to read the lock.** C-30 says default pause starts no
   new function, including activation. A source that declares the lock dependency does run, at
   activation and on every lock change, because that is how it reads the lock; it starts no work.
8. **A node with several inputs pauses at each input, with one shared lock state.** C-36 pauses D,
   which has inputs A and B. One pausable per input, sharing one `control`, gives D one invocation on
   resume with the latest of both; with separate lock states each resume would be its own wave and D
   would run once per input (mutation-checked).

### New things this module introduces

Not discussed before, kept, with the reason:

| Kept | Why |
|---|---|
| `controlPair`, and the `${id}.pauseLocks` naming | One shape for pausables and self-stopping sources. The name says, in the topology, that the node is the pause lock set of `id` (first named `${id}.control`, renamed 2026-11-06 because a topology reader could not tell it was about pause). A real implementation may use node metadata instead |
| The handle keeps no lock set; `pause` and `resume` set the lock state with a function, and a default lock gets a random id | Until 2026-11-10 the handle kept the authoritative set, since two `set`s in one wave read the same old state and lose a lock; a set with a function computes each write in request order, so the state is the only copy and a restore keeps the locks. A counter for default locks would repeat after a restore |
| Default lock ids `${id}#n` | Readable in the control state; callers may pass their own |
| Placement instead of modes | The pausable passes values through unchanged, so TS's default pause and resumeAll differ here only by which side of the node it sits on. Replaced the `"latest"`/`"all"` modes on 2026-11-06 |
| The pausable nodes use manual complete | The lock state never completes, so auto complete would never end them |
| While open, the pausable forwards every occurrence | P2: pause must not merge DATA when it is not paused |
| The `control` option of `pausable` | Lets several pausables share one lock state, so one resume releases them in one wave (finding 8, C-36). Without it there is no way to pause a node at several inputs and get one invocation |
| The pausable's private state, the arrays held since the last INVALIDATE | With the manual INVALIDATE policy the node sees every INVALIDATE as input (K6, 2026-11-09). Until then a second node, `${id}.pauseLog`, published the queue as its value so that its `onInvalidate` hook would see every INVALIDATE |

## Demand ([demand.mjs](demand.mjs), [demand.test.mjs](demand.test.mjs))

Second module, 2026-11-06, for DS-17 O2 and R-pull. Decided with the user: the request travels
through a declared control pair, as pause does, not through upward routing.

`pullable(g, id, inputId, serve)` places a holder `id` after `inputId` and returns a bundle with
`pull(params)`. Between pulls the holder holds what arrives and shows nothing downstream, not even
DIRTY. A pull runs `serve(ctx)` once, with `ctx.deps[0].waves` the arrays held since the last
INVALIDATE and `ctx.pull.params` the params, even when nothing changed; what it sends goes out as a
later wave. `pull` only writes the bundle's state node; it creates nothing.

```text
inputId ──► id
id.pullDemand ──┘
```

One quiet node since 2026-11-09 (manual INVALIDATE policy, K6); until then a log node sat before the
holder, as in pause.

| R-pull@2 / C-32 | Here |
|---|---|
| Quiet outside service | The holder is a quiet node (H6); between pulls its subscribers receive nothing |
| A matching PULL at an inactive holder drops without activation or banking | `pull` writes the demand state, which keeps its value; on activation the holder records that request as seen and serves only later ones |
| Only the latest unserved params are kept | A batch of pulls is one wave; the holder serves the newest request in it |
| Invoke once even without changed dependencies | The demand state's DATA is input to the holder |
| Backlog waits for the outer batch and publishes outside its fate | A pull in a batch is staged; the service is a later wave after commit; a throwing batch serves nothing |
| RESUME alone creates no demand and flushes no backlog | A pausable in front of the holder releases into the holder, which holds |
| Routed diamond serves once per routed request | Decided away: no routing; one `pull` is one write and one service |
| Subscription is START-only | **Not here.** A later subscriber gets the last served value in its START, because the kernel puts the retained value in every START. Making a node START-only is DS-17 H2, a kernel option; left out until a real case needs it |
| Output carries no ACK or guaranteed DATA | Same: `serve` may stay silent, and then nothing goes out |

An INVALIDATE discards what was held before it and reaches subscribers as the holder's own output.
The holder has the manual INVALIDATE policy, so the INVALIDATE is its function's input and the
function sends INVALIDATE itself; like all of a quiet node's output it goes out as a later wave.
**Difference from before 2026-11-09 and from TS:** the INVALIDATE reached subscribers in the current
wave, because the quiet holder passed an auto INVALIDATE on at once. Keeping that would need an
exception in the kernel's quiet handling for a manual node's own INVALIDATE.

Mutations checked (two-node version, before 2026-11-09), each failing at least one of the 14 tests:
an old request served on activation; the log without its invalidate hook; the holder not quiet; the log silent while holding; the oldest
request served instead of the latest; the log keeping its queue after a service; the holder serving
on a record that is not a service; the log swallowing COMPLETE.

Kernel fix found while building it: a quiet node that sent several arrays in one settlement published
each as its own later wave; they now go out together as one later wave (kernel test "H6: a quiet
node's arrays...").

### New things this module introduces

| Kept | Why |
|---|---|
| `pullable(g, id, inputId, serve)` returning `{ pull }` | The bundle holds the author's function, as a TS pull node holds its fn; `pull` is the controller side of the pair |
| `${id}.pullDemand` | The declared control edge, as in pause; what arrived is the holder's private state |
| The demand record `{ seq, params }` | A fresh value per pull, so every pull is DATA, and a sequence so the holder can tell an old request (there before activation) from a new one. Since 2026-11-10 `pull` is a set with a function that takes the next number from the state's value, so no counter sits in a closure and the numbers go on after a restore |
| `serve` gets a view of ctx: the holder's own ctx with `deps` replaced by the held input and `pull` added | Keeps the TS shape (`ctx.deps` input, `ctx.pull.params`); `down`, `state` and the hooks are the holder's own |

## Observation, H5 ([observe.mjs](observe.mjs), [observe.test.mjs](observe.test.mjs))

DS-17 lists H5, committed-output observation, as a kernel hook used by revision evidence, the
flagship's evidence retention and replay. It turned out to need no hook: a kernel subscriber
already receives exactly what a node committed, after the node applied it. An INVALIDATE that
removed nothing never reaches it; the kernel's own RESOLVED and DIRTY do. `observe(g, ids, sink)`
subscribes one sink per node and hands each array on as `{ id, msgs }`, in delivery order, which is
the order the wave reached the nodes. It returns a function that stops it.

It works like TS `Graph.observe` (a real subscriber: it activates a cold node and keeps it active).
The differences:

| Here | TS `Graph.observe` | Why |
|---|---|---|
| An event carries one array | An event carries one message | Kernel sinks receive arrays (R-wave-boundary) |
| No `tier` | `tier: messageTier(msg[0])` | Derived: `TIER[msg[0]]` |
| No `seq` | A graph-local sequence shared with topology events | Events arrive in order, and a log that appends keeps it. The kernel has no topology events to interleave with |
| The caller passes ids | No path means the whole graph; a `::` prefix means a subtree | The builder knows the ids (O14); the kernel has no mount paths |

What the tests pin:
- array boundaries and propagation order;
- an ineffective INVALIDATE is not observed, and the kernel's RESOLVED is;
- R-node-revision evidence can be counted from the events: the START array is installation and is
  skipped, DIRTY is skipped, an equal DATA still counts, and a repeat INVALIDATE never arrives;
- other subscribers are unaffected; two observers are two subscribers;
- a write from inside an observer is a later wave;
- a quiet node's output is observed in its later wave.

Mutations, each failing at least one test:
- one sink id shared by every observer (this needed the two-observer test);
- a stop that does nothing;
- only the last message handed on;
- consecutive arrays from one node merged.

### New things this module introduces

| New | Why it stays |
|---|---|
| `observe(g, ids, sink)` and the `{ id, msgs }` event | TS's envelope minus the two fields that are derived (`tier`) or not needed without topology events (`seq`) |
| The sink id `observe#n` | The kernel's subscribe takes a sink id; one per observer keeps two observers of a node apart |

## Restart, O7 ([restart.mjs](restart.mjs), [restart.test.mjs](restart.test.mjs))

Added 2026-11-08, after the user chose the module option for O7 and graph-level replace for it.
`restartable(g, id, { deps, fn, rounds, retry })` returns `{ id, innerId, restart() }`.

```text
deps ──► id/inner ──► id          id.restart ──► id
```

- **One owner faces downstream for good.** `id` forwards the inner's values. When the inner ends,
  the owner's policy restarts it or ends the owner with that same terminal, which is then final.
  While a restart is possible no protocol terminal reaches downstream: the owner's terminals are
  manual (O6), so it runs on the inner's COMPLETE or ERROR instead of ending with it.
- **The inner keeps a fixed path,** `${id}/inner`. A restart is the kernel's `replace` of that node:
  same id and subscribers, a fresh instance. So `describe()` is the same before and after, and a sink
  on the inner sees each attempt begin with START. The inner depends on long-lived nodes outside the
  owner with ordinary dependencies, so nothing upstream needs to be resubscribable, and a shared
  upstream stays active across a restart. The owner holds those dependencies too, listed ahead of
  the inner, and reads only the inner and the restart state: an inner that ends releases its
  dependencies at once (R-lifetime), so until 2026-11-10 an upstream that nothing else held closed
  and opened again at every attempt (C5a, from the Codex review). Listed after the inner, the hold
  came too late at activation, when an inner that ends in its first run had already released it.
- **Policy is the owner's:** `rounds` is how many times the inner may complete (TS `repeat`'s count);
  `retry` is the library's retry policy (see Retry policy below): within a round, an ERROR from
  attempt n is retried after `retryDelayMs(retry, n)`, and each round gets the policy's attempts
  again; `restart()` sets the
  declared control state `${id}.restart` (P11) to the next request number, taken from its value
  (with a function since 2026-11-10, so no counter sits in a closure), and starts a new attempt that
  counts as neither.
- **The owner asks for the replace from its own function,** and the kernel runs it after the wave
  (K8), as TS applies `ctx.rewireNext` after the wave. A delayed retry is dropped once the owner's
  lifetime has closed, even if a new one has opened. When the owner deactivates without having
  ended, an inner that has ended is renewed, so its next activation starts a fresh inner, as a new
  subscription does in TS, rather than on the ended inner's snapshot. Once an upstream of the inner
  has ended, no restart is attempted: a fresh inner would start on that ended snapshot (P5) and end
  at once, sending the upstream's last value again each round. Both reasons were rewritten when P5
  was relaxed (2026-11-08); before, the kernel refused these acquisitions.
- **Three gaps found on 2026-11-09** while preparing the formal model, by probing the module
  against R-restart's text; all three are fixed and tested.
  - A request was seen again: the restart state keeps its value, so after a `restart()` the
    owner's next activation found it in its snapshot and replaced the fresh inner it had just
    activated. A request is now served once: at activation the owner takes the state's current
    value as served (`seen`), as the demand log does with its pulls. A request made while the owner
    is inactive therefore does nothing, which is right, since the next activation starts a fresh
    inner anyway. (The user's decision; R-restart gained a sentence.)
  - A stale retry: an ERROR had a delayed retry pending, `restart()` started a new attempt, and the
    retry then replaced that attempt too. A delayed retry now belongs to the attempt that failed and
    is dropped once another has started (`attempt`, a count of the replaces this lifetime asked
    for). (The user's decision; R-restart's sentence on a closed lifetime was widened.)
  - A retry after the upstream ended: the ended inner no longer hears its upstream, so an upstream
    that ended while a retry waited went unseen, and the retry started a fresh inner over it, which
    resent the upstream's last value and ended the owner with COMPLETE instead of the ERROR. The
    check is now made again when the retry fires; the owner then ends with the inner's ERROR. This
    was a module bug against R-restart as written ("No restart is attempted once a dependency of
    the inner has ended").
- **C-34 replayed** in [restart.replay.test.mjs](restart.replay.test.mjs); see the kernel's
  [REPLAY.md](../kernel/REPLAY.md). The next execution starts after the fanout and a request made
  during it gets its own START, but only when the owner's replace is queued first, and the old
  registrations go on instead of ending (O7). Both are listed there as decisions for the user.

**Finding for DS-17: restart needs a kernel `replace`.** The reference kernel had no way to change
topology, and only the kernel can rebind a node's dependents and subscribers to a new instance. The
DS-17 rewire row named only hook H4 (a seed); restart does not need a seed, so none was added. See
the kernel README for what `replace` does.

**What TS has today (`dafc5ae`).** No production source sets `resubscribable: true`; only two
lifecycle tests do. `repeat` is used only in its tests; it is already an owner, swapping a fresh
inner per round with `ctx.rewireNext`, but each inner gets a new synthetic id. Retry is done by the
drivers (bridge, environment outbound, websocket session, tool-provider runs): they retry outside the
graph and publish attempt, retry and failure events as DATA, and `retryStatusBundle` projects them.
So every current use fits this module, and retry as it is in TS does not need it at all.

| Here | TS | Why |
|---|---|---|
| The inner at a fixed path, replaced per attempt | A fresh inner per round under a synthetic id | O7: observation goes on across attempts |
| `rounds`, `retry`, `restart()` on one owner | `repeat(factory, count)`; `RetryPolicy` used by drivers | O7 puts attempts and backoff in the owner; `retry` is the shared policy, rewritten (below) |
| The inner's definition is reused, and each instance gets fresh private state | `factory()` mints a new node per round | A new lifetime already starts fresh (K7) |
| A synchronous burst at activation reaches the owner as its retained value only (K3) | The inner's activation output is delivered | Kernel K3; the tests' inner plays its items after it starts |

What the tests pin: `rounds` 3 and 1, as in TS's `repeat` tests; an inner ERROR or a throwing inner
with no retry left; retries under the policy, and exhaustion; a fresh count per round; the same `describe()` and a START per
attempt on the inner's sink; an outside restart of a live inner, with a shared upstream never
released and the old instance's late output dropped; a closed lifetime's delayed retry dropped; a
request served once, also across a reactivation and while inactive; a pending retry dropped once a
request has started another attempt; no retry over an upstream that ended while it waited; one
lifetime of an upstream across three attempts (C5a, failing without the owner's hold and with the
hold listed after the inner).

Mutations, each failing at least one test: no outside restart; no signal check on a delayed retry
(this needed the timing test); no renewal on deactivation; renewal even after the owner ended; no
fresh retry count per round; the policy's delay ignored; a restart attempted after an upstream
ended (the owner then never ends).

Mutations checked on 2026-11-09 after the three fixes, 12 in all, each failing at least one test: a
request seen again at activation (the old `request.waves` check, or `seen` not taken at
activation, or not updated); a stale retry not dropped; the signal check dropped; no renewal; a
restart after an upstream ended; unlimited rounds; no fresh retry count per round; requests never
served; the check on the retry's firing dropped, or the owner then not ended.

### New things this module introduces

| New | Why it stays |
|---|---|
| Kernel `replace(id, deps, fn)` | The only way to give a node a new instance; the finding above |
| START at the start of each attempt on the inner's sinks | It is what a fresh subscription sends, and it tells an observer that an attempt began |
| `${id}.restart` and `restart()` | O7: a restart request reaches the owner on a declared edge (P11) |
| `rounds` and `retry` | O7's attempts and backoff; `rounds` is TS `repeat`'s count, `retry` the shared policy |
| The owner holding the inner's dependencies, ahead of the inner | An ended inner releases them at once (R-lifetime), so without the hold an upstream closed and opened again at every attempt (C5a) |
| Renewing an ended inner when the owner deactivates | Without it the owner's next activation would start on the ended inner's snapshot |
| No restart when a fresh inner would end at once (every dependency ended, or one ended with ERROR) | Without it each round would end at once and resend the upstream's last value; with unlimited rounds, for good. Until a 2026-11-09 review it was "any dependency ended", which let a completed configuration block every retry |
| `seen` and `attempt` in the owner's private state | A request is served once, and a delayed retry only replaces the attempt that failed; both are per lifetime, like the rest of the owner's state |

## Retry policy ([resilience.mjs](resilience.mjs), [resilience.test.mjs](resilience.test.mjs))

The library-wide retry vocabulary (D130/D132), shared by whoever retries: TS's drivers (bridge,
environment outbound, websocket session, tool-provider runs) and here the restart owner. Passive
data: it schedules nothing and owns no graph state, and it can travel as a DATA fact, as TS's
tool-provider retry does.

`retryPolicy({ maxAttempts = 1, initialMs = 0, factor = 1, maxMs })` builds a frozen policy;
`maxAttempts` counts every attempt, the first included, and no `maxMs` means no cap.
`retryDelayMs(policy, failedAttempt)` returns the delay before the next attempt,
`min(initialMs * factor^(failedAttempt - 1), maxMs)`, or undefined when no attempt is left.

Rewritten on 2026-11-08 with the user, not ported as it is. At `dafc5ae` no production source names a
backoff kind (the default `none` only); tests use `constant` a dozen times and `linear` once, and
`exponential` and `fibonacci` never. Every production caller pairs `shouldRetry` with
`nextRetryDelayMs`: bridge, environment outbound and websocket session add `?? 0`, tool-provider
runs report an error if no delay comes back, and `retryStatusBundle` calls both.

| Here | TS `graph/resilience.ts` | Why |
|---|---|---|
| `retryDelayMs(policy, failedAttempt)`: a number to retry after, undefined to stop | `shouldRetry(policy, failedAttempt)` and `nextRetryDelayMs(policy, nextAttempt)`, each checking the range | One answer, so the decision and the delay cannot disagree; inside the retry range the `?? 0` and the tool-provider error never fire |
| One backoff shape `{ initialMs, factor, maxMs? }` in the policy | `BackoffPolicy` with five kinds: none, constant, linear, exponential, fibonacci, nested as `backoff` | `factor` 1 is constant, `initialMs` 0 is none, `factor` > 1 is exponential; linear and fibonacci had no user |
| The first retry waits `initialMs` | The delay before attempt n is the backoff of n, so the first retry waits `backoff(2)` (exponential: `initialMs * factor`) | The name says initial. Same for constant |
| `retryPolicy` throws on an invalid value | Corrected at every computation: `factor` truncated to an integer (1.5 becomes 1), a negative, NaN or infinite number becomes 0 | Invalid input is refused where it is written; 1.5 is a common factor |
| `retryPolicy({ … })` takes one object | `retryPolicy(maxAttempts, backoff)` | The fields are flat now |

Kept as in TS: a policy is data, not a function; `maxAttempts` includes the first attempt; no jitter
(it needs a random source, and nothing uses it). The capacity and retention vocabulary of D80
(`CapacityPolicy`, `RetentionPolicy`, LRU order) is a separate part of the shared policies and is
not touched here.

Mutations, each failing at least one test: the last attempt allowed one more retry; the exponent
counted from n instead of n - 1; no cap; the factor truncated as in TS; a non-integer attempt
accepted; each of the four validations removed; the policy not frozen.

## switchMap and mergeMap ([higher-order.mjs](higher-order.mjs), [higher-order.test.mjs](higher-order.test.mjs))

One operator for both, as TS's `mapOperator` (D47/D81). How it got here, all on 2026-11-08:

1. `switchMap` was built first as an owner with a replaced inner, to check the claim behind the first
   C-8 decision ([REPLAY.md](../kernel/REPLAY.md)): an operator that follows one inner at a time keeps
   its value across switches without a seed (H4), because only its inner is replaced. That held.
2. `mergeMap`, with a varying number of inners, was expected to be the first case for a seed. Built on
   `replace` alone (git `75ee4c8`), it passed TS's mergeMap tests without one, but replace cost it four
   things: a fixed outward node in front of a replaced core, so the value and the single START
   survive; the core's state carried in the next fn's closure, with a first-run skip of snapshots
   already handled; one inner per replace, since an activation keeps one value (K3); and leaving an
   ended source out (P5). A seed would have removed only the second.
3. The user then asked for the surgical form, and the kernel got `rewire(id, deps, fn)`; `mergeMap`
   was rebuilt on it as one node (`79026f7`), and the four costs were gone.
4. With both on the same shape, the user asked for the simplification: the two modules (74 lines of code)
   became this one (57), and `switchMap` lost its owner and its own inner reset.

```text
sourceId ──► id ◄── id/inner/0, id/inner/1, ... ◄── (each projected inner's dependencies)
```

`switchMap(g, id, sourceId, project)` and `mergeMap(g, id, sourceId, project, { concurrent })` return
`{ id }`. `id` depends on the source and on every live inner and forwards their values. It completes
once the source has completed and no inner is live, and ends with ERROR on a source or inner ERROR or a
throwing projector, after the inner values it forwarded in that wave. Each change of the inner set is
one `ctx.rewire`, asked for during the wave and run after it (K8), as TS's `rewireNext` is drained at
the boundary; an added inner's value arrives as an ordinary input wave. The function finds its
dependencies by `ctx.deps[i].id`. When `id` deactivates, it goes back to no inner: the rewire belongs
to the lifetime, so closing it puts back `[sourceId]` (F7, 2026-11-10; until then a cleanup rewired
the operator back).

`project(value)` returns the inner's definition `{ deps, fn }`; to follow a node X that already
exists, project to `{ deps: [X], fn: relay }`. The definition goes into an inner node with `replace` (a
new node the first time). switch projects the last source value of a wave into `${id}/inner/0`;
replacing that node closes the live inner's lifetime, so its late output is dropped and a dependency
only it had is released: that is the cancellation. merge projects every value into the first node
that is not live, and `concurrent` bounds the live inners; further values wait unprojected until one
completes.

| Here | TS (`dafc5ae`) | Why |
|---|---|---|
| `project` returns a definition `{ deps, fn }` | `project` returns a node (or something `fromAny` turns into one) | The kernel cannot delete a node, so a fresh node per value would pile up |
| Inner nodes at `${id}/inner/k`, reused once not live; switch always uses `${id}/inner/0` | A fresh node per inner, under a synthetic id in `describe()` (D51) | Bounded by the peak number live; O7: observation goes on across switches |
| One `rewire` with the whole new list per change | `rewireNext.unsubscribeDep` and `subscribeDep` per inner, removes before adds so the list stays aligned with positions | The kernel compares the lists, and dependencies are read by id |
| A projection with the same `fn` and `deps` as a live inner keeps it | A re-projected node that is already live is kept (switch) or skipped (merge) | The same rule, by definition instead of node identity |
| A projection onto an ended node gives an inner that starts on its snapshot: its last value, then its end | merge skips a node that completed in the same wave ("does not re-add a just-completed inner"); rewire rejects a non-resubscribable terminal dependency (C-8), an ERROR | P5 relaxed (2026-11-08); until then this was an ERROR here too |
| The inner node is created at the first projection | — | Nothing exists to observe before there is an inner |
| No `concatMap`, `exhaustMap`, `flatMap`, `fromAny` | Present | Not needed so far; concat and exhaust would be further modes of the same loop, not built |

What the tests pin. switchMap: TS's two tests (cancel the in-flight inner; a re-projected live inner
is neither cancelled nor duplicated); the value kept across a switch, and the live inner in
`describe()`; a fresh computation's late answer dropped; completion with a live inner and with none;
source, inner and projector ERROR, each releasing the inner; inner values before a projector ERROR; an
ended projection (its last value, the operator open); a fresh activation after the inner ended; the same definition restarted once its
inner completed; the last of several values in one wave. mergeMap: TS's tests (interleaving, release
and removal of a completed inner; bounded concurrency; invalid `concurrent`; an already live inner
merged once with later removals aligned; completion; source, inner and projector ERROR releasing
every inner; inner DATA before its ERROR; the just-completed re-projection, an inner that ends at once here); the value
and single START kept while inners are added; no resend of live inners' values and no reprojection of
the source's; several inners added in one wave; an inner that sends several values as it activates in one array passing them all on, as TS (since K3 keeps the last array); an inner that completes as it
activates; a source value queued ahead of the operator's rewire; node reuse, also by an inner that
completes in the wave of a new source value; a fresh activation.

Mutations, each failing at least one test: no keep of the same live inner; no ended check (removed
with the P5 relaxation); no catch
around the projector (the kernel would turn the throw into ERROR but drop the inner values forwarded
earlier in that run); a completed inner kept; a removal not rewired; no reset on deactivation; no
concurrency bound; only the source's ERROR handled; inner values not forwarded; switch taking the
first value of a wave; switch keeping the old inner as well; merge reusing a live node; completion
ignoring live inners; an invalid `concurrent` accepted. Removed because they survived every test:
excluding a node that completed in this wave from reuse (replacing it sends the operator its new
value, and the rewire keeps it in place), and waiting for an empty queue before completing (a waiting
value implies a live inner).

### New things this module introduces

| New | Why it stays |
|---|---|
| `switchMap`, `mergeMap` (with `concurrent`, TS's `MergeMapOptions`) over one `mapOperator` | TS's own structure |
| `project` returning `{ deps, fn }`, and `relay` | A definition because nodes cannot be deleted; `relay` follows an existing node, which is what TS's tests project to |
| Keeping the live inner when the definition is the same | TS's rule, by definition |
| Inner node reuse at `${id}/inner/k` | Without it inner nodes would grow by one per source value |

The kernel side, `rewire` and `ctx.deps[i].id`, is listed in the kernel README.

## Checkpoint and restore, O5 ([checkpoint.mjs](checkpoint.mjs), [checkpoint.test.mjs](checkpoint.test.mjs))

**Reshaped on 2026-11-10 (D799), after the second reviews.** F6 had first made every module restorable
through a building service, `recipes(g, registry)`, that kept its own record of how each node was
built, beside the kernel: the bundle's `replace` and `make`, a `builder` in every module with two build
paths, factories given `{ g, id }`, and a comparison of functions with `definition(id)`. Both reviews
traced these to that record, and each reproduced a defect of it: a replace inside a throwing batch
lost the recipe (Codex); after a replace the restored graph ran the new recipe's setup while the
original kept the old one (Codex); a restart's renewal of a restored ended inner skipped its run,
because the first-activation check sat on the node rather than the instance (Fable). The user chose
the TS shape: the recipe is part of the instance's definition (`recipe` node option, given to
`replace` with the setup), so checkpoint is two functions, `capture(g)` and `restore(cp, registry)`,
with no record of its own. Restore builds each node after its declared dependencies (a replace may
point a node at one made later, which broke restore; Codex), and the first-activation check reads the
seed's note, which the kernel hands only to the seeded instance's first run (`ctx.seed`). Demand and
restart record the activation's request as seen in their setup, so a restored holder or owner no
longer serves a request made while it was inactive (Fable), and the restore wrapper's `deps` view is
writable (a restored holder had ended with ERROR; Fable). A restored node's definition function is
the restore wrapper, which runs the real function unchanged once its note is used.

Tests (40 in this file): the earlier ones on the new API, round trips of every module, and one per
defect above, each failing on the old behaviour. Mutations, 5 more, each failing at least one test:
RESOLVED accepted from a node; replace keeping the old recipe; the seed note reaching every run;
restore in checkpoint order; a holder keeping the saved `seen`. At R-checkpoint's activation (D802,
2026-11-10) restore refuses a checkpoint without what each node received, as one written to an
earlier format, instead of completing it from the dependencies' saved values (one test; mutation:
the check removed), and capture refuses an ERROR payload that is not JSON (added to the JSON test).

Built 2026-11-08. O5 had been decided the same day with its default: capture at a wave boundary, no
pending-FIFO or receipt capture in the kernel. The user's choices, in order:

1. **The module first, without a kernel seed (H4)**, to test whether the seed is needed (git
   `b6468e6`). It was, in two places, both because the kernel then refused to acquire an ended
   node:
   - An ended computed node could only come back as an ended state, so `describe()` showed no
     dependencies.
   - A node that had not ended but held an ended dependency could not be activated again, so
     `capture()` refused the whole graph. With the default policy that is any node with several
     inputs where one has completed: auto COMPLETE waits for all of them.
2. **Then the seed, as an option**, added to the kernel the same day once the second gap turned out
   this wide, first with an exception to that refusal for a seeded node's first activation. Asked
   whether to simplify, the user then had the refusal dropped altogether (P5 relaxed): an ended node
   can be subscribed and depended on, and its snapshot carries its terminal. The exception went with
   it. The kernel side is in the kernel README.
3. **An upstream change before the first subscription runs the fn once.** This follows the C-38
   and R-input-receipts draft rather than TS. TS keeps the restored value and records the
   dependencies' current values as received, so its value does not match its inputs until the next
   change.
4. **A node whose last run registered a cleanup runs once at its first activation (A2,
   2026-11-09).** Probing for the formal model found that a restored node that had not run had no
   cleanups: a restored history kept stale entries after an INVALIDATE, a restored pause or demand
   log too, and a restored timer source never fired again. A cleanup is a closure, so no checkpoint
   can hold it; running is the only way to register it again. A research session compared running
   every node (A), clearing private state in the kernel on INVALIDATE (breaks demand's `seen`),
   declaring hooks outside the run (a second registration mechanism), a run whose output is
   discarded (a new kind of run), and a hold that keeps restored nodes active until the host
   releases them (fixes the INVALIDATE before the first subscription, but adds a new concept and
   differs from TS). The user chose A2, with two more points: an end alone brings no repeated
   values, and an INVALIDATE before the first subscription is not seen, so a host subscribes before
   writing upstream. **Replaced on 2026-11-10** by the node's setup (K7), after the reviews traced
   A2 to per-run cleanup registration: the setup runs at every activation, a restored one's
   included, so what it opened outside the graph is opened again and the function does not run for
   it. The checkpoint no longer saves a cleanup flag or wraps `ctx`.

```js
const registry = { sum: () => sumFn, plus: ({ k }) => plusFn(k) };
g.state("a", 1);
g.node("p", ["a"], plusFn(10), { recipe: { ref: "plus", config: { k: 10 } } }); // ref and JSON config
const cp = capture(g);                 // JSON; at a wave boundary only
const r = restore(cp, registry);       // a new graph, nothing subscribed
```

**Semantics**

- A node is restorable when it is a state, or a computed node whose current instance carries a
  recipe `{ ref, config }`; at restore `registry[ref](config, { g, id, make })` returns the function
  or `{ fn, setup }`. Function bodies are never saved. (Superseded wording kept for history:) A node built another way, or a recipe
  node whose definition has changed since (its dependencies or its function, by `replace`), or
  that is rewired for its current lifetime (`ctx.rewire`, as `mapOperator` does), is saved as
  local-only, and restoring it fails, as R-snapshot
  has it. The function is compared through the kernel's `definition(id)`, so a change made by any
  path is seen; until 2026-11-10 only the dependencies were compared, and a replace that kept them
  but changed the function restored as the old recipe (C6, from the Codex review).
- `capture()` saves what the kernel holds per node:
  - a state's last array's values (K3) and terminal;
  - a computed node's last array's values, terminal and private state, and what it received from each dependency,
    when it had a lifetime. An inactive computed node holds nothing (K7) and comes back fresh.

  Capture is refused unless the kernel is idle (`g.idle()`: no wave and no batch body). Values must be
  JSON.
- `restore()` builds the graph in checkpoint order, with no subscribers, as TS's `restoreGraph` does,
  and runs no recipe fn.
  - State: its saved values come back as one batch (one wave, with no subscriber), then `complete`
    or `error` if it had ended.
  - Saved computed node: gets its values, terminal and private state as a kernel seed. An ended one
    stays ended, with its dependencies.
  - First activation of a seeded node: a wrapper around its fn compares each dependency with what
    the node had received. The real fn runs once if any differs; otherwise it does not run. The
    node's setup runs either way, since the kernel runs it at every activation. The run gets only
    the changed dependencies as input:
    - a changed value comes with its snapshot arrays;
    - an end alone comes without them, since those values were already received;
    - an unchanged dependency has no wave and no terminal.

    That is what a live wave would have given it, so a running total adds only the change, a run
    that sends nothing keeps the seeded value, and a timer source, whose setup starts a new timer,
    counts on from its saved state. History needs no run since 2026-11-09: with the manual
    INVALIDATE policy an INVALIDATE is its function's input.
  - Until its first activation a restored node receives no waves, so only the values and ends then
    are compared: an INVALIDATE followed by a write is seen as the write. A host that must not lose
    it subscribes before writing upstream.
  - A seeded node, like any node, can be activated although a dependency has ended (P5). The ended
    dependency's fn does not run again.
- A restored graph captured again before anything subscribes gives back the saved lifetimes as they
  were. Once a node has been activated, capture saves its live lifetime.

**Not covered**:
- the replay buffer (there is no replay module);
- version evidence: the revision observer (below) keeps its positions outside the graph; save them beside the checkpoint;
- graph namespaces and mounts (the kernel has none);
- resource reattach (R-resource-reattach).

Pending async work is lost rather than re-issued. The kernel does not know about it, and a restored
lifetime is new, so a late result from the old lifetime cannot arrive. O5 asked for an in-flight call
to be re-issued or recorded as unknown.

### What the tests pin

- Restore runs no fn, sends nothing, and gives the same `describe()`.
- A first subscription gets the saved value and private state without running the fn; later waves
  run the real fn; once a node is activated, capture saves its live lifetime.
- After an upstream change:
  - the fn runs once, with only the changed input;
  - a run that sends nothing keeps the saved value;
  - an input that ended after restore reaches the fn, while one that had ended before capture does
    not reach it again;
  - an input that only ended brings its end without its values again.
- A restored timer source's setup starts one timer and its function does not run; it counts on from
  its saved count. A restored history is not rerun, and a later INVALIDATE still clears it as in the
  original (manual INVALIDATE policy).
- Before the first subscription an INVALIDATE is not seen; subscribed first, the restore behaves as
  the original.
- A chain of restored nodes runs no fn; an inactive node starts fresh.
- Ended nodes come back ended with their dependencies; a subscriber gets their terminal snapshot.
- A node holding an ended dependency comes back and works; the ended node does not run, also when a
  new subscriber gets its snapshot.
- Refusals:
  - local-only nodes: built without a recipe, rewired for the current lifetime, or given a new
    function by replace with the same dependencies;
  - a missing recipe;
  - capture inside a wave or a batch body;
  - values that are not JSON.
- Recapture before activation.

**Mutations checked on 2026-11-10** for the setup that replaced A2, with the kernel, sugar, restart,
higher-order and checkpoint tests, 8 in all, each failing at least one test: setup run on every run;
no setup; no cleanup at close; cleanup before dependency release; replace not running the old
cleanup; replace dropping the setup; setup after the first run; a throwing setup not ending the
node. Plus `latestAsync` not following the lifetime's signal, caught by the test of a run without a
new value.

**Mutations checked on 2026-11-09** for A2 (since replaced) and the end-alone fix, with the history and revision
tests, 8 in all, each failing at least one test: A2 off; every node always run; the record not
reset per run; the record not saved; the first, unrestored run not observed; an end alone bringing
its values again; an end alone dropped; an end alone not counted as a change.

**Mutations checked on 2026-11-08** against the seeded version, together with the kernel, replay,
restart and higher-order tests. 25 in all, each failing at least one test.

- Kernel side:
  - the seed's value, `null` value, private state or terminal ignored;
  - (in the version with the exception, since replaced by the relaxed P5) no exception, one for every
    node, or one kept after the first activation; an ended dependency activated, or left inactive;
  - replace keeping the seed flag.
- Module side:
  - the real fn always run;
  - terminals not compared, or not masked;
  - unchanged inputs not masked;
  - never or always refreshing;
  - no seed passed, or one without private state;
  - no recapture before activation;
  - the saved entry not cleared after activation (survived until the test "once activated, capture
    saves the live lifetime" was added);
  - no idle check;
  - no local-only check;
  - an ended state not ended;
  - no JSON check;
  - an inactive node saving a lifetime.

Removed because they could not change anything:
- the seed flag being off for an ended seed: an ended node is never activated;
- keeping the saved entry only for nodes that have not ended;
- from the version without a seed: the wrapper's own sending of the saved value and private state,
  and the "has private state" check.

### New things this module introduces

| New | Why it stays |
|---|---|
| `capture(g)` and `restore(checkpoint, registry)`, over a graph whose instances carry recipes | R-snapshot's factory reference; TS's node option `restore` and `restoreGraph(checkpoint, { registry })` |
| Per computed node, the inputs it received | Needed for the change check, and for capturing a restored graph again before activation, when a dependency may have changed after restore. Equal to the dependencies' values at a wave boundary, so the kernel need not expose its input records |
| The first-activation wrapper, which only compares inputs | The refresh on a pre-attachment change is the user's choice (point 3 above), a policy rather than kernel behavior; without it the seed alone gives TS's behavior |

The kernel side, `idle()`, `privateState(id)`, the optional seed and the P5 relaxation, is listed in the
kernel README.

## Bridge, R-bridge ([bridge.mjs](bridge.mjs), [bridge.test.mjs](bridge.test.mjs))

Written 2026-11-11 for graphrefly:D803 (R-bridge@1; the user's choices are in
[PROPOSAL-B140-bridge-module.md](../../sessions/active/PROPOSAL-B140-bridge-module.md)). A wire edge
group carries a fixed set of edges from a sender graph to a receiver graph.

```text
sender:    edge nodes ──► wireEdgeGroupOut ──► sink (frameSink) ──► transport
receiver:  transport ──► frameSource ──► gate ──► gate/x, gate/y (inbound) ──► app
                                           └────► gate.issues
```

- `wireEdgeGroupOut(g, id, { group, edges })`, `edges` mapping edge ids to sender nodes: a fan-in
  under manual COMPLETE, ERROR and INVALIDATE policies. Each run in which an edge brought input is
  one cause, sent as one DATA frame `{ group, session, cause, edges: [{ edge, arrays }] }` carrying
  only the edges that brought input, each as the ctx gives it (an INVALIDATE, the DATA arrays, a
  terminal). Its setup names the session; causes count from 1; the first run, the session's first
  cause, carries every snapshot, with an INVALIDATE ahead of it for an edge without a value (D804). A value or ERROR payload
  that is not a `Uint8Array` throws, so the node ends with ERROR.
- `frameSink(send)`: a sink callback handing every frame delivered, the START snapshot's included,
  to the transport.
- `frameSource(g, id, open)`: a node with no dependencies whose setup calls `open(deliver)` and keeps
  the close it returns; each `deliver(frame)` is late output, so one wave.
- `wireEdgeGroupIn(g, id, { group, frames, edges })`: the gate `id`, inbound nodes `${id}/${edge}`
  and `${id}.issues`. The gate's private state holds the session, the last cause taken and a view of
  what each edge last brought; each run with a frame of its group sends one value `{ released,
  issues, view }`. An inbound node sends its edge's arrays from the released causes, and on the
  first run of a lifetime its snapshot from the view. An inbound edge that has ended takes nothing
  more: its arrays in a later frame are skipped and the rest released, and an `ended` issue is
  reported when the skipped arrays do not end with a terminal (R-bridge@2, D804). Issues are
  `stale`, `gap`, `refused`, `ended` and `malformed` values.

Not restorable: the nodes carry no recipe, since R-bridge does not cover checkpoints of bridge nodes
(their values are bytes, not JSON), so the modules' F6 convention does not apply here. A wave in
which the gate reports only an issue still marks the inbound nodes pending; they send nothing and
get the kernel's RESOLVED, and a fan-in over them may run with no new input (R-invocation).

The tests follow C-1 (a diamond split across two graphs, D running once per cause on legs of the
same A) and C-1b. Mutations checked against them on 2026-11-11, each failing a test: no stale check,
a gap not reported, no INVALIDATE in the first cause, a new session keeping the count, no snapshot
from the view, an array accepted after the edge's terminal, a refused frame's number not taken.
Added with D804, each failing a test: refusing a frame whole for an ended edge (R-bridge@1), the
divergence not reported, every skip reported, an array after a terminal in the same frame accepted,
the INVALIDATE only for an edge without any snapshot.

## History, R-replay-buffer ([history.mjs](history.mjs), [history.test.mjs](history.test.mjs))

Built 2026-11-08. The user made two decisions before it was built:
- **The kernel's START snapshot carries the last array.** A new subscriber gets every DATA value of
  the node's last array that had any, not only the last value; arrays are not merged (K3, kernel
  README).
- **History across arrays is a module, not a kernel option.** In TS, `replayBuffer` is used only by
  the occurrence solutions (`solutions/occurrence.ts`, `solutions/causal-occurrence`), never by
  ordinary nodes or operators, so it does not belong on every node.

`history(g, id, sourceId, n)` is a node whose value is the list of the last `n` waves in which the
source published DATA since the history node was activated, oldest first.
- Each entry is that wave's `ctx.deps[0].waves`: the arrays that carried DATA, each as its DATA
  payloads in order. So the list keeps both the waves and how each wave was split into arrays:
  `[[[2]], [[3], [4]], [[5, 6]]]` is a wave with one array `[2]`, a wave with two arrays `[3]` and
  `[4]`, and a wave with one array of two values. `n` counts waves. Equal values are included; a
  RESOLVED array is left out. (The user's decision, 2026-11-09; the list was flat before.)
- Each wave that brings values sends the new list once. A wave without any (RESOLVED, or a
  terminal alone) is not an entry and sends nothing.
- A new subscriber gets the list in its START snapshot, like any value. This holds for sinks and
  dependents alike.
- The list lives in private state:
  - the node has the manual INVALIDATE policy (`historyOpts`), so an INVALIDATE from the source is
    its function's input: it clears the list and sends INVALIDATE itself (until 2026-11-09 an
    `onInvalidate` hook cleared the list), as
    TS's BH6 does;
  - deactivation drops the list (K7), as TS drops its ring;
  - built from `historyRecipe` through the checkpoint module's `recipes`, the list is saved and
    restored, and goes on from there.
- On activation the list starts with one entry, a wave holding the source's last array, since that
  is all the source's START snapshot holds.
- The source's terminal ends the history node (auto policy). A late subscriber gets the list, then
  the terminal (P5).

| Here | TS (`dafc5ae`) | Why |
|---|---|---|
| A separate node whose value is the list | `replayBuffer: N` on the node itself; a late sink gets N separate DATA after START, and a late dependent's fn runs once per value | The user's decision: one value that sinks and dependents see alike, and no kernel option for one use |
| The list holds waves of arrays, and `n` counts waves | The ring holds the last N DATA values; wave and array boundaries are lost | The user's decision: each entry has the shape a dependent reads in `ctx.deps[i].waves` |
| The list starts at the history node's activation | The ring starts when the node is active, and is cleared on deactivation (BH6) | The same, except that the list begins with the source's last array |

**What the tests pin**:
- TS's replayBuffer test: the last 3 of 4 waves, oldest first;
- equal values counted as occurrences, and a batch's writes kept as one wave of one array;
- `n` counting waves, a wave of two arrays kept as one entry with both arrays and sent once, and
  one array with two values kept as one array;
- a dependent getting the list;
- a RESOLVED array not recorded, and a wave without values sending nothing;
- INVALIDATE clearing the list, and deactivation dropping it;
- the source's end;
- `n` validated;
- a checkpoint round trip that goes on from the saved list.

**Mutations checked on 2026-11-08, and again on 2026-11-09 after the change of shape**, each
failing at least one test: no clear on INVALIDATE; no bound; empty waves sending; no check of `n`;
newest first; a flat list (the old shape); arrays as entries instead of waves; a wave's arrays
merged into one; RESOLVED arrays recorded as `[]`.

### New things this module introduces

| New | Why it stays |
|---|---|
| `history(g, id, sourceId, n)` and `historyRecipe` | R-replay-buffer's bounded history, as a module (the user's decision); the recipe so a checkpoint can rebuild it |

## Revision evidence, O9 ([revision.mjs](revision.mjs), [revision.test.mjs](revision.test.mjs))

Built 2026-11-09. The user decided on 2026-11-08 (O9) that revision evidence is an observer module,
not kernel state. It has no consumer yet, so on 2026-11-09 the user held its rule, R-revision, as a
draft until incremental checkpoints or an agent inspection tool needs it. `revisionObserver(g, ids, { hash, from })` subscribes to each node through
`observe` (H5) and returns `{ get(id), capture(), stop() }`.

- `revision` advances once per committed DATA, RESOLVED, INVALIDATE, COMPLETE or ERROR; `valueRevision`
  is the revision of the latest DATA or INVALIDATE.
- The START array is installation and advances nothing, so subscribing, restore and a late
  subscriber change no position. PENDING (still DIRTY in the kernel) is not output. An equal DATA counts.
  An INVALIDATE that removed nothing is never delivered (K6), so it cannot count.
- Like `observe`, it is a real subscriber: it activates a node and keeps it active, so positions do
  not reset on a disconnect while it runs.
- `capture()` gives the positions as JSON (a copy); a new observer started with `{ from }` goes on from
  them. Saving them beside a checkpoint and restoring both keeps them unchanged.
- `hash(values)` is optional. It gets the node's retained values (K3), or `null` for absence, and is
  computed when read, so it always agrees with the snapshot. The canonical encoding is open
  (B140 Checkpoint/encoding).
- A position never wraps: an array that would take `revision` past `Number.MAX_SAFE_INTEGER` is
  refused whole, the positions stay, and the throw goes to the host reporter (P10). An invalid saved
  position is refused at the start.

| Here | R-node-revision (D796 draft) | Why |
|---|---|---|
| An observer over the ids it is given | Every node maintains revision and valueRevision | O9: whole-graph restore at a wave boundary needs no comparison, so only an inspector needs positions |
| Positions live in the observer and are saved by the host | Checkpoints save represented evidence | The checkpoint module does not know about the observer; the host saves both |
| No silent-rebase case | Silent retained-snapshot adoption advances revision | The kernel has no silent adoption: every change to what a node holds is a delivered message |

What the tests pin: START and late subscribers advance nothing; each kind of committed message, with
RESOLVED, COMPLETE and ERROR advancing `revision` only; several values in one array; the hash with
values and with absence; two observers apart, and `stop`; a checkpoint round trip; the limit; invalid
saved positions; `capture` returning a copy.

Mutations checked on 2026-11-09, 17 in all, each failing at least one of the 10 tests: START counted;
RESOLVED, a terminal or ERROR treated as a value change; INVALIDATE not treated as one; RESOLVED, a
terminal or ERROR not counted; DIRTY counted; no limit check; one count per array; `from` ignored; the
order and integer checks on saved positions removed; absence not passed to the hash; `capture`
sharing its objects; `stop` doing nothing.

### New things this module introduces

| New | Why it stays |
|---|---|
| `revisionObserver(g, ids, { hash, from })` returning `{ get, capture, stop }` | O9's observer; `from` and `capture` are how positions survive a restore without the checkpoint module knowing about them |
| `hash(values)` taking the retained values or `null` | R-node-revision's optional current-snapshot hash, with the encoding left to the caller until B140 picks one |
| Refusing an array whole at the limit | R-node-revision's "reject numerical exhaustion rather than silently wrap", without a half-counted array |

