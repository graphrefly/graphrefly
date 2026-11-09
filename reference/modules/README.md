# Modules over the reference kernel

Non-normative. Each module here is built only from the [reference kernel](../kernel/README.md)'s
public surface: nodes, state, `ctx`, and requests. If a module needs a kernel change, that is a
finding about the DS-17 classification, not something to patch in quietly.

```bash
npm run test:reference
```

## Pause ([pause.mjs](pause.mjs), [pause.test.mjs](pause.test.mjs))

First module, 2026-11-06, for DS-17 O8 and the R-pause-lockset / R-pause-modes /
R-paused-invalidate cluster.

`pausable(g, id, inputId, { control })` places a pausable `id` after `inputId`, and returns a handle
with `pause(lock?)` (returns the lock) and `resume(lock)`. `control` lets several pausables share
one lock state. `controlPair(g, id)` is the same handle with no node of its own, for a source that
must stop working itself.

Topology:

```text
inputId ──► id.pauseLog ──► id
id.pauseLocks ──┴──────────────┘
```

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

Mutations checked: a handle that reads and rewrites graph state instead of keeping its own lock set
(loses a lock when two pauses happen in one wave); never paused; auto complete; releasing an unknown
lock still writing; the log without its invalidate hook; the log silent while paused (it then has
no value and misses an INVALIDATE); the log keeping its queue after a resume; `id` releasing while
paused; either node swallowing COMPLETE; `control` ignored; the release node merging the held
arrays, or releasing only the latest. Each fails at least one of the 20 tests or the 9 replay tests.

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
   resume. Rejected: giving INVALIDATE an auto/manual policy like terminals (O6), a
   new kernel option.
   **Why two nodes.** A node learns of an INVALIDATE only through its own `onInvalidate`, which runs
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
| The handle keeps the authoritative lock set | Two pauses in one wave would otherwise read the same old state and lose a lock (mutation-checked) |
| Default lock ids `${id}#n` | Readable in the control state; callers may pass their own |
| Placement instead of modes | The pausable passes values through unchanged, so TS's default pause and resumeAll differ here only by which side of the node it sits on. Replaced the `"latest"`/`"all"` modes on 2026-11-06 |
| The pausable nodes use manual complete | The lock state never completes, so auto complete would never end them |
| While open, the pausable forwards every occurrence | P2: pause must not merge DATA when it is not paused |
| The `control` option of `pausable` | Lets several pausables share one lock state, so one resume releases them in one wave (finding 8, C-36). Without it there is no way to pause a node at several inputs and get one invocation |
| `${id}.pauseLog` and its value, the queue of arrays held since the last INVALIDATE | The only way to see every INVALIDATE without a kernel change (finding 3). Only `id` reads the queue; downstream never sees that shape |

## Demand ([demand.mjs](demand.mjs), [demand.test.mjs](demand.test.mjs))

Second module, 2026-11-06, for DS-17 O2 and R-pull. Decided with the user: the request travels
through a declared control pair, as pause does, not through upward routing.

`pullable(g, id, inputId, serve)` places a holder `id` after `inputId` and returns a bundle with
`pull(params)`. Between pulls the holder holds what arrives and shows nothing downstream, not even
DIRTY. A pull runs `serve(ctx)` once, with `ctx.deps[0].waves` the arrays held since the last
INVALIDATE and `ctx.pull.params` the params, even when nothing changed; what it sends goes out as a
later wave. `pull` only writes the bundle's state node; it creates nothing.

```text
inputId ──► id.pullLog ──► id
id.pullDemand ──┘
```

| R-pull@2 / C-32 | Here |
|---|---|
| Quiet outside service | The holder is a quiet node (H6); between pulls its subscribers receive nothing |
| A matching PULL at an inactive holder drops without activation or banking | `pull` writes the demand state, which keeps its value; on activation the log records that request as seen and serves only later ones |
| Only the latest unserved params are kept | A batch of pulls is one wave; the log serves the newest request in it |
| Invoke once even without changed dependencies | The demand state's DATA is input to the log |
| Backlog waits for the outer batch and publishes outside its fate | A pull in a batch is staged; the service is a later wave after commit; a throwing batch serves nothing |
| RESUME alone creates no demand and flushes no backlog | A pausable in front of the holder releases into the log, which holds |
| Routed diamond serves once per routed request | Decided away: no routing; one `pull` is one write and one service |
| Subscription is START-only | **Not here.** A later subscriber gets the last served value in its START, because the kernel puts the retained value in every START. Making a node START-only is DS-17 H2, a kernel option; left out until a real case needs it |
| Output carries no ACK or guaranteed DATA | Same: `serve` may stay silent, and then nothing goes out |

An INVALIDATE discards what was held before it and reaches subscribers at once, as in TS: a quiet
node passes an INVALIDATE on in the current wave, since it carries no DIRTY.

The log works like `${id}.pauseLog`: it republishes its queue on every arrival so that it always has
a value while holding anything, which is how its own `onInvalidate` sees every INVALIDATE.

Mutations checked, each failing at least one of the 14 tests: an old request served on activation;
the log without its invalidate hook; the holder not quiet; the log silent while holding; the oldest
request served instead of the latest; the log keeping its queue after a service; the holder serving
on a record that is not a service; the log swallowing COMPLETE.

Kernel fix found while building it: a quiet node that sent several arrays in one settlement published
each as its own later wave; they now go out together as one later wave (kernel test "H6: a quiet
node's arrays...").

### New things this module introduces

| Kept | Why |
|---|---|
| `pullable(g, id, inputId, serve)` returning `{ pull }` | The bundle holds the author's function, as a TS pull node holds its fn; `pull` is the controller side of the pair |
| `${id}.pullDemand` and `${id}.pullLog` | The declared control edge, and the holder of what arrived, as in pause |
| The demand record `{ seq, params }` | A fresh value per pull, so every pull is DATA, and a sequence so the log can tell an old request (there before activation) from a new one |
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
  upstream stays active across a restart.
- **Policy is the owner's:** `rounds` is how many times the inner may complete (TS `repeat`'s count);
  `retry` is the library's retry policy (see Retry policy below): within a round, an ERROR from
  attempt n is retried after `retryDelayMs(retry, n)`, and each round gets the policy's attempts
  again; `restart()` writes the
  declared control state `${id}.restart` (P11) and starts a new attempt that counts as neither.
- **The owner asks for the replace from its own function,** and the kernel runs it after the wave
  (K8), as TS applies `ctx.rewireNext` after the wave. A delayed retry is dropped once the owner's
  lifetime has closed, even if a new one has opened. When the owner deactivates without having
  ended, an inner that has ended is renewed, since it would otherwise refuse the owner's next
  activation (P5). Once an upstream of the inner has ended, no restart is attempted: the fresh
  instance could not acquire it, so the owner ends with the inner instead of waiting for good.
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
released and the old instance's late output dropped; a closed lifetime's delayed retry dropped.

Mutations, each failing at least one test: no outside restart; no signal check on a delayed retry
(this needed the timing test); no renewal on deactivation; renewal even after the owner ended; no
fresh retry count per round; the policy's delay ignored; a restart attempted after an upstream
ended (the owner then never ends).

### New things this module introduces

| New | Why it stays |
|---|---|
| Kernel `replace(id, deps, fn)` | The only way to give a node a new instance; the finding above |
| START at the start of each attempt on the inner's sinks | It is what a fresh subscription sends, and it tells an observer that an attempt began |
| `${id}.restart` and `restart()` | O7: a restart request reaches the owner on a declared edge (P11) |
| `rounds` and `retry` | O7's attempts and backoff; `rounds` is TS `repeat`'s count, `retry` the shared policy |
| Renewing an ended inner when the owner deactivates | Without it the owner could never be subscribed again (P5) |
| No restart once an upstream of the inner has ended | Without it the owner waits for good for a replace the kernel refuses (P5) |

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

## switchMap ([switch-map.mjs](switch-map.mjs), [switch-map.test.mjs](switch-map.test.mjs))

Added 2026-11-08 to check the claim behind the first C-8 decision ([REPLAY.md](../kernel/REPLAY.md)):
an operator that follows one inner at a time keeps its value across switches without a seed (H4),
because only its inner is replaced, never the operator. The claim holds: the test "the owner keeps
its value across a switch with no seed" passes. `exhaustMap`, `concatMap` and `repeat` follow one
inner at a time too, so they fit the same shape. `mergeMap`, with a varying number of inners, was
then expected to be the first case for a seed; it is not (next section).

```text
sourceId ──► id ◄── id/inner ◄── (the projected inner's dependencies)
```

`switchMap(g, id, sourceId, project)` returns `{ id, innerId }`. `project(value)` returns the inner's
definition `{ deps, fn }`; to follow a node X that already exists, project to `{ deps: [X], fn: relay }`.
On the last source value of a wave the owner asks for `replace(${id}/inner, …)`, which runs after the
wave (K8). The old inner's lifetime closes, so its late output is dropped and a dependency only it
had is released: that is the cancellation. Otherwise as TS's switch mode (`mapOperator`, D47/D81):
the inner's values are forwarded; a source or inner ERROR, or a throwing projector, ends the owner
with ERROR after the inner values it forwarded in that wave; the owner completes once the source has
completed and no inner is live or pending.

| Here | TS `switchMap` (`dafc5ae`) | Why |
|---|---|---|
| `project` returns a definition `{ deps, fn }` | `project` returns a node (or something `fromAny` turns into one) | The reference kernel cannot remove nodes, so a fresh node per value would pile up; the inner is one node at a fixed path |
| A projection with the same `fn` and `deps` keeps the live inner | A re-projected node that is already live is kept | The same rule, by definition instead of node identity |
| The inner is `${id}/inner` in `describe()`, its deps showing what it follows | The live inner appears under a synthetic id (D51) | O7: observation goes on across switches |
| A projection onto an ended node is an ERROR | Rewire rejects a non-resubscribable terminal dependency (C-8) | The same outcome; the owner checks first, since a queued `replace` that is refused would leave it waiting |
| When the owner deactivates, the inner goes back to none | A fresh activation starts with no inners | The same; an ended inner would also refuse the next activation (P5) |

What the tests pin: TS's two switchMap tests (cancel the in-flight inner; a re-projected live inner
is neither cancelled nor duplicated); the owner's value kept across a switch, and the live inner in
`describe()`; a fresh computation's late answer dropped; completion with a live inner and with
none; source, inner and projector ERROR, each releasing the inner; the inner values before a
projector ERROR kept; an ended projection; a fresh activation after the inner ended; the same
definition restarted once its inner completed; the last of several values in one wave.

Mutations, each failing at least one test: no keep of the same live inner; "same" ignoring whether
the inner is live; the first value of a wave instead of the last; errors not forwarded; inner
completion not tracked; completion ignoring a live inner; no ended check; no renewal on
deactivation; no catch around the projector (the kernel would turn the throw into ERROR anyway, but
drop the inner values forwarded earlier in that run); inner values not forwarded.

### New things this module introduces

| New | Why it stays |
|---|---|
| `switchMap(g, id, sourceId, project)` with `project` returning `{ deps, fn }` | The check above; a definition because nodes cannot be removed |
| `relay` | The definition that follows an existing node, which is what TS's tests project to |
| Keeping the live inner when the definition is the same | TS's own rule, "re-projecting the same live inner does not cancel or duplicate it" |

## mergeMap ([merge-map.mjs](merge-map.mjs), [merge-map.test.mjs](merge-map.test.mjs))

Added 2026-11-08 to check the other half of the first C-8 decision: that `mergeMap`, with a varying
number of inners, is the first case that needs a seed (H4). It did not need one. Built first on
`replace` alone (git `75ee4c8`), it passed TS's mergeMap tests but replace cost it four things: a
fixed outward node in front of a replaced core, so the value and the single START survive; the
core's state carried in the next fn's closure, with a first-run skip of snapshots already handled;
one inner per replace, since an activation keeps one value (K3); and leaving an ended source out
(P5). A seed would have removed only the second. The user then asked for the surgical form, and the
kernel got `rewire(id, deps, fn)` ([kernel README](../kernel/README.md)); this module was rebuilt on
it, and the four costs are gone.

```text
sourceId ──► id ◄── id/inner/0, id/inner/1, ... ◄── (each projected inner's dependencies)
```

`mergeMap(g, id, sourceId, project, { concurrent })` returns `{ id }`. As TS's merge mode
(`mapOperator`, D47/D81), `id` depends on the source and on every live inner and forwards their
values; it completes once the source has completed and no inner is live, and ends with ERROR on a
source or inner ERROR or a throwing projector, after the inner values it forwarded in that wave.
`concurrent` bounds the live inners; further source values wait unprojected until one completes. Each
change of the inner set is one `rewire`, asked for during the wave and run after it (K8), as TS's
`rewireNext` is drained at the boundary. An added inner's value arrives as an ordinary input wave.
The function finds its dependencies by `ctx.deps[i].id`, so it keeps no position bookkeeping.

| Here | TS `mergeMap` (`dafc5ae`) | Why |
|---|---|---|
| `project` returns a definition `{ deps, fn }` | `project` returns a node (or something `fromAny` turns into one) | As switchMap: nodes cannot be removed |
| Inner nodes at `${id}/inner/k`, reused once not live | A fresh node per inner | The kernel cannot delete a node; reuse bounds them by the peak number live |
| One `rewire` with the whole new list per change | `rewireNext.unsubscribeDep` and `subscribeDep` per inner, removes before adds so the list stays aligned with positions | The kernel compares the lists; dependencies are read by id, so there is no alignment to keep |
| A projection with the same `fn` and `deps` as a live inner adds nothing | A projected node that is already live is skipped | The same rule, by definition |
| A projection onto an ended node is an ERROR | A node that completed in the same wave is skipped (the test "does not re-add a just-completed inner") | As switchMap: an ended node cannot be acquired (P5) |
| An inner that sends several values as it activates passes on its last | `mergeMap(v => [v, v + 1])` gives both | K3: an activation only sets the retained value. The same holds for switchMap's inner and for any first subscription |
| No `flatMap` alias, no `fromAny` coercion | Both | Sugar; nothing here needs them |

What the tests pin: TS's mergeMap tests (interleaving, and release and removal of a completed inner;
bounded concurrency; invalid `concurrent`; an already live inner merged once with later removals
aligned; completion; source, inner and projector ERROR releasing every inner; inner DATA before its
ERROR; the just-completed re-projection, which is an ERROR here); the operator's value and single
START kept while inners are added; no resend of live inners' values and no reprojection of the
source's; several inners added in one wave each passing on their value; the K3 last value of an
inner's activation; an inner that completes as it activates; a source value queued ahead of the
operator's rewire; node reuse, also by an inner that completes in the wave of a new source value; a
fresh activation; inner values before a projector ERROR.

Mutations, each failing at least one test: no "same definition" skip; no ended check; no catch
around the projector; a completed inner kept; a removal not rewired; no renewal on deactivation; no
concurrency bound; only the source's ERROR handled; inner values not forwarded. Two checks survived
every test and were removed: excluding a node that completed in this wave from reuse (replacing it
sends the operator its new value, and the rewire keeps it in place), and waiting for an empty queue
before completing (a waiting value implies a live inner).

### New things this module introduces

| New | Why it stays |
|---|---|
| `mergeMap(g, id, sourceId, project, { concurrent })` | The check above; `concurrent` is TS's `MergeMapOptions` |
| Inner node reuse at `${id}/inner/k` | Without it inner nodes would grow by one per source value |

The kernel side, `rewire` and `ctx.deps[i].id`, is listed in the kernel README.
