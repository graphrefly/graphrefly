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
   RESOLVED settles the announced DIRTY and refers to no value, so downstream stays absent and value
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

An INVALIDATE discards what was held before it and reaches subscribers as a later wave (the
holder is quiet). TS passes a pull node's INVALIDATE on at once.

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

