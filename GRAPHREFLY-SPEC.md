# GraphReFly Spec v0.4

> Reactive graph protocol for human + LLM co-operation.
>
> **graph** — the universal container. **re** — reactive, review, reusable. **fly** — lightweight, fast.

This spec defines the protocol, primitives, and container that both `graphrefly-ts` and
`graphrefly-py` implement. Language-specific ergonomics (syntax, concurrency model, type
encoding) are implementation choices — the spec defines **behavior**.

---

## 1. Message Protocol

### 1.1 Format

All communication between nodes uses a single format: **an array of messages**, where each
message is a tuple `[Type, Data?]`. Always an array of tuples — no single-message shorthand.

```
Messages = [[Type, Data?], ...]
```

Examples:

```
[[DATA, 42]]                                    — single value
[[DIRTY], [DATA, 42]]                           — two-phase update
[[DIRTY], [RESOLVED]]                           — unchanged after dirty
[[DATA, "a"], [DATA, "b"], [COMPLETE]]          — burst + close
[[PAUSE, lockId]]                               — pause with lock
[[RESUME, lockId], [DATA, "resumed"]]           — resume + value
[[ERROR, err]]                                  — error termination
```

### 1.2 Message Types

| Type | Data | Purpose |
|------|------|---------|
| `START` | — | Subscribe handshake: "upstream is connected and ready to flow" |
| `DATA` | value | Value delivery |
| `DIRTY` | — | Phase 1: value about to change |
| `RESOLVED` | — | Phase 2 alt: was dirty, value unchanged |
| `INVALIDATE` | — | Clear cached state, don't auto-emit |
| `RESET` | — | Clear cache + re-push initial (INVALIDATE then push) |
| `PAUSE` | lockId | Suspend activity (lock identifies the pauser) |
| `RESUME` | lockId | Resume after pause (must match PAUSE lockId) |
| `TEARDOWN` | — | Permanent cleanup, release resources |
| `COMPLETE` | — | Clean termination |
| `ERROR` | error | Error termination |

The message type set is open. Implementations MAY define additional types. Nodes MUST forward
message types they don't recognize — this ensures forward compatibility.

**`START` handshake (§2.2):** Emitted by a node to each new sink at the top of `subscribe()`,
before any other downstream delivery for that subscription. Shape: `[[START]]` alone when the
node's cache is SENTINEL, or `[[START], [DATA, cached]]` when the node has a cached value.
Receipt of `START` means "the subscription is established and the upstream is ready to flow";
absence means the node is terminal (COMPLETE/ERROR without `resubscribable`). `START` is
informational for wave tracking — it does not participate in DIRTY/DATA/RESOLVED wave masks
and is not forwarded through intermediate nodes (each node emits its own `START` to its own
new sinks).

**DATA requires a payload.** `[DATA, value]` MUST include the second element. The value
MAY be `undefined` (TS) / `None` (PY) / `null` — these are valid data values. A bare
`[DATA]` tuple (missing the payload entirely) is a protocol violation. Implementations
SHOULD reject or ignore it rather than silently coercing to `undefined`/`None`.

### 1.3 Protocol Invariants

1. **DIRTY precedes DATA or RESOLVED.** Within the same batch, `[DIRTY]` comes before
   `[DATA, v]` or `[RESOLVED]`. This invariant is universal: every outgoing tier-3
   payload is preceded by DIRTY in the same batch, regardless of which entry point
   produced the emission. The dispatcher synthesizes a `[DIRTY]` prefix whenever the
   caller omits it, provided (a) any tier-3 message is present in the batch and (b)
   the node is not already in `dirty` status from an earlier emission in the same
   wave. This applies uniformly to every emission path — `node.emit(v)`,
   `node.down(msgs)`, `actions.emit(v)`, `actions.down(msgs)`, passthrough
   forwarding, and equals-substituted `[DATA, v]` → `[RESOLVED]` rewrites. There is
   no "raw down skips framing" compatibility carve-out: raw and framed paths are
   observationally identical on the wire.

2. **Two-phase push.** Phase 1 (DIRTY) propagates through the entire graph before phase 2
   (DATA/RESOLVED) begins. Guarantees glitch-free diamond resolution.

**Activation-wave exemption.** The DIRTY-before-DATA/RESOLVED invariant is a *state-transition* invariant. The subscribe ceremony (fn's first run during `subscribe()`) is exempt: the initial emission during activation does not require a preceding DIRTY. Two-phase applies to all post-activation waves where a dep actually transitions through DIRTY.

3. **RESOLVED enables transitive skip — dispatch-layer equals substitution.** Every outgoing
   DATA payload is subject to equals-vs-cache substitution: if `equals(cache, newValue)`
   returns true, the node emits `[RESOLVED]` instead of `[DATA, v]`, and `cache` is not
   re-advanced. This applies uniformly to every emission path — computed fn results,
   `actions.emit(v)`, `actions.down(msgs)`, raw `node.down([[DATA, v]])`, and passthrough
   forwarding — so the node's cache cannot drift from "the last DATA payload actually
   delivered downstream." Downstream nodes skip recompute on RESOLVED entirely.

4. **COMPLETE and ERROR are terminal.** After either, no further messages from that node.
   A node MAY be resubscribable (opt-in), in which case a new subscription starts fresh.

5. **Effect nodes complete when ALL deps complete.** Not ANY. Matches combineLatest semantics.

6. **Unknown message types forward unchanged.** Forward compatibility.

7. **Batch defers DATA and RESOLVED, not DIRTY.** Inside a batch, DIRTY propagates
   immediately. DATA and RESOLVED (phase-2 messages) are deferred until batch exits.
   During drain, further phase-2 emissions are re-deferred to preserve strict
   DIRTY-before-DATA ordering across the entire flush. Dirty state established across
   the graph before recomputation.

8. **START precedes any other message on a subscription.** A sink never receives DATA,
   DIRTY, RESOLVED, COMPLETE, ERROR, or any other message from a node without first
   receiving `START` from that node on the same subscription. `START` is emitted through
   the same `downWithBatch` path as other messages, so it respects batch semantics when
   `subscribe()` is called inside `batch()`.

**Signal tier table** (for `messageTier` / `message_tier` utilities and batch drain
ordering):

| Tier | Signals | Role | Batch behavior |
|------|---------|------|----------------|
| 0 | `START` | Subscribe handshake | Immediate |
| 1 | `DIRTY`, `INVALIDATE` | Notification | Immediate |
| 2 | `PAUSE`, `RESUME` | Flow control | Immediate |
| 3 | `DATA`, `RESOLVED` | Value settlement | Deferred in batch |
| 4 | `COMPLETE`, `ERROR` | Terminal lifecycle | Deferred (drains after phase-3) |
| 5 | `TEARDOWN` | Destruction | Immediate |

Auto-checkpoint saves (§3.8) gate on `messageTier >= 3` (DATA / RESOLVED / COMPLETE /
ERROR / TEARDOWN). Worker-bridge wire filtering (extra layer) uses the same threshold.

### 1.4 Directions

Messages flow in two directions:

- **down** — downstream from source toward sinks (DATA, DIRTY, RESOLVED, COMPLETE, ERROR)
- **up** — upstream from sink toward source (PAUSE, RESUME, INVALIDATE, TEARDOWN)

Both directions use the same `[[Type, Data?], ...]` format.

These are **conventions**, not enforced constraints. Implementations do not validate
message types by direction. In particular, lifecycle messages (TEARDOWN, INVALIDATE)
may propagate downstream for graph-wide lifecycle management (e.g. `graph.destroy()`
sends TEARDOWN downstream to all nodes). Similarly, a source may forward PAUSE/RESUME
downstream when pausing consumers.

---

## 2. Node

One primitive. A node is a node.

### 2.1 Construction

```
node(deps?, fn?, opts?)
```

What a node does depends on what you give it:

| Config | Behavior | Sugar name |
|--------|----------|------------|
| No deps, no fn | Manual source. User calls `.down()` to emit | `state()` |
| No deps, with fn | Auto source. fn runs, emits via actions | `producer()` |
| Deps, fn returns value | Reactive compute. Recomputes on dep change | `derived()` |
| Deps, fn uses `.down()` | Full protocol access, custom transform | `derived()` |
| Deps, fn returns nothing | Side effect, graph leaf | `effect()` |
| Deps, no fn | Passthrough wire | — (use `node([dep])`) |

These sugar names are convenience constructors. They all create nodes. Implementations SHOULD
provide them for ergonomics and readability. They are not separate types.

**`dynamicNode`** is a construction variant of `node` that declares a **superset** of all
possible dependencies at construction time but selectively reads from them at runtime via a
`track(dep)` function. Unlike static `derived` where fn always receives all dep values,
`dynamicNode` fn picks which deps to read on each invocation. All declared deps participate
in wave tracking; when an unused dep updates, fn fires but equals absorption prevents
downstream propagation. This is the same `node` primitive with `_isDynamic: true` — not a
separate class.

### 2.2 Interface

Every node exposes:

```
node.cache              → cached value (readonly getter, never errors)
node.status             → "sentinel" | "pending" | "dirty" | "settled" |
                          "resolved" | "completed" | "errored"
node.down(msgOrMsgs)    → send one or more messages downstream.
                          Accepts `Message | Messages` — one call = one wave.
node.emit(value)        → sugar for down([[DATA, value]]).
node.up(msgOrMsgs)      → send upstream. Same Message | Messages shape.
                          Tier 3/4 (DATA/RESOLVED/COMPLETE/ERROR) throw.
node.subscribe(sink)    → receive downstream messages, returns unsubscribe fn
node.meta               → companion stores (each key is a subscribable node)
```

**`.cache` replaces `.get()`.** Renamed to avoid collision with TC39 Signals `.get()`.
Read-only getter that returns the cached value or `undefined`/`None` when SENTINEL.

Source nodes (no deps) have no upstream, so `.up()` is a no-op. Implementations expose
it on all node instances for uniformity (the `Node` interface types it as optional).
When a node or graph subscribes to another node, it can use `up()` to send messages
upstream through that subscription.

#### subscribe(sink) → unsubscribe

Adds a sink callback to receive downstream messages. Returns a function that removes
the sink. This is the **only** way to connect to a node's output.

**§2.2 subscribe flow (START handshake + activation):**

```
subscribe(sink, actor?):
  1. if terminal and resubscribable → reset (clear cache, status, DepRecords)
  2. increment sinkCount; register sink
  3. if not terminal → emit START handshake to `sink` via `downWithBatch`:
        • cache is SENTINEL → [[START]]
        • cache has value v → [[START], [DATA, v]]
        • if replayBuffer enabled → deliver buffered DATA after START
  4. if sinkCount == 1 and not terminal → activate:
        • state node (no deps, no fn): no-op
        • producer (no deps, with fn): run fn (may emit via actions)
        • derived/effect (deps, with fn): subscribe to all deps
  5. if activation did not produce a value and cache is still SENTINEL,
     transition status to `"pending"`
  6. return unsubscribe function (last unsub → deactivate)
```

The `START` message is the first thing any sink ever receives from a subscription.
It is emitted through `downWithBatch`, so when `subscribe()` is called inside
`batch(() => …)` the `[DATA, cached]` portion respects batch deferral (drains in
phase 3), while `[START]` itself is immediate (phase 0).

**ROM/RAM cache semantics (§2.2):** state nodes retain their cached value across
disconnect — the value is intrinsic and non-volatile (ROM). Compute nodes (producer,
derived, dynamic, effect) clear their cache on `_onDeactivate` because their value
is a function of live subscriptions; reconnect re-runs fn from scratch. Consequently:

- `.cache` on a disconnected **state** returns the retained value.
- `.cache` on a disconnected **compute node** returns `undefined`/`None`.
- Reconnect on a compute node always re-runs fn (DepRecord is cleared on deactivate),
  giving effects with cleanup a fresh fire/cleanup cycle.
- Runtime writes via `state.down([[DATA, v]])` persist across subscriber churn.

**First-run gate (§2.7):** a compute node does NOT run fn until every declared dep
has delivered at least one real value. The dep's subscribe-time push delivers its
cached value as `[[DATA, cached]]` — a dep that pushes only `[[START]]` (SENTINEL) is
NOT considered settled, and the derived stays in `"pending"` status. This is the
composition-guide §1 rule: "derived nodes depending on a SENTINEL dep will not
compute until that dep receives a real value."

`dynamicNode` uses the same first-run gate as static nodes: all declared deps must
deliver at least one value before fn fires. The difference is that fn receives a
`track(dep)` function instead of a flat array — it picks which deps to read per
invocation. Unused deps still participate in wave tracking; their updates fire fn but
equals absorption prevents downstream propagation.

#### cache (readonly getter)

Returns the cached value. Does NOT guarantee freshness and does NOT trigger computation.
**`status` is the source of truth** — always check it before trusting `.cache`:

| Status | Meaning | `.cache` returns |
|--------|---------|------------------|
| `sentinel` | No subscribers, no value ever set (compute: cache cleared) | `undefined` / `None` |
| `pending` | Subscribed + upstream connected, waiting for first DATA | `undefined` / `None` |
| `dirty` | DIRTY or INVALIDATE received, waiting for DATA | previous value (stale) |
| `settled` | DATA received, value current | current value (fresh) |
| `resolved` | Was dirty, value confirmed unchanged | current value (fresh) |
| `completed` | Terminal: clean completion | final value |
| `errored` | Terminal: error occurred | last good value or `initial` or `undefined`/`None` |

When no `initial` option was provided and no value has been emitted, `.cache` returns
`undefined` (TS) / `None` (PY). Internally this is the SENTINEL state.

`.cache` never throws. `.cache` never triggers computation.

**ROM/RAM semantics:** State nodes retain `.cache` across disconnect (ROM). Compute
nodes clear `.cache` on deactivation (RAM) — status becomes `"sentinel"`.

#### down(msgOrMsgs)

Send one or more messages downstream to all subscribers. Accepts either a
single `Message` tuple or a `Messages` array of tuples — one call = one wave.
The dispatch pipeline tier-sorts the input, auto-prefixes `[DIRTY]` when a
tier-3 payload is present and the node is not already dirty, runs equals
substitution, and delivers with phase deferral.

```
node.down([DATA, 42])                           — single-tuple shape
node.down([[DATA, 42]])                         — array shape (equivalent)
node.down([[DIRTY], [DATA, 42]])                — explicit two-phase
node.down([[COMPLETE]])                         — terminate
```

#### emit(value)

Sugar for `down([[DATA, value]])`. One wave with a single DATA payload;
identical wire output to the `down` form.

```
node.emit(42)                                   — equivalent to down([[DATA, 42]])
```

#### up(msgOrMsgs)

Send one or more messages upstream toward dependencies. Same
`Message | Messages` shape as `down`. Tier 3 (DATA / RESOLVED) and tier 4
(COMPLETE / ERROR) are downstream-only — `up` is restricted to DIRTY,
INVALIDATE, PAUSE, RESUME, and TEARDOWN, and MUST throw on tier-3/4 input.

```
node.up([PAUSE, lockId])                        — pause upstream (lockId required)
node.up([RESUME, lockId])                       — resume upstream (must match)
node.up([TEARDOWN])                             — request teardown
```

Only available on nodes that have deps.

#### unsubscribe()

Disconnect this node from its upstream dependencies. State nodes retain `.cache` and
their current status (ROM); compute nodes clear `.cache` and transition to `"sentinel"`
(RAM). May reconnect on next downstream subscription (lazy reconnect).

### 2.3 Meta (Companion Stores)

`meta` is an object where each key is itself a subscribable node. This replaces all
`with*()` wrapper patterns.

```
const n = node(deps, fn, {
  meta: { status: "idle", error: null, latency: 0 }
})

n.meta.status.cache              // "idle"
n.meta.error.cache               // null

// Subscribe to a single meta field reactively
n.meta.error.subscribe((msgs) => { /* handle error */ })

// Update meta (from inside fn, or externally)
n.meta.status.down([[DATA, "loading"]])
```

Common meta fields:

| Field | Type | Purpose |
|-------|------|---------|
| `description` | string | Human/LLM-readable purpose |
| `type` | string | Value type hint: "string", "number", "boolean", "enum" |
| `range` | [min, max] | Valid range for numeric values |
| `values` | string[] | Valid values for enums |
| `format` | string | Display format: "currency", "percentage", "status" |
| `access` | string | Who can write: "human", "llm", "both", "system" |
| `tags` | string[] | Categorization |
| `unit` | string | Measurement unit |

Because meta fields are nodes, they appear in `describe()` output and are individually
observable via `observe()`.

**Companion lifecycle:** Meta nodes are companion stores — they survive graph-wide
lifecycle signals that would disrupt their cached values:

- **INVALIDATE** via `graph.signal()` — no-op on meta nodes (cached values preserved).
  The filtering is a graph-layer responsibility: `graph.signal([[INVALIDATE]])` iterates
  registered nodes and skips meta children of registered parents before broadcasting.
  The core `_emit` INVALIDATE path itself does not distinguish meta from non-meta —
  sending `[[INVALIDATE]]` directly to a meta node's `down()` does wipe its cache.
- **COMPLETE/ERROR** — not propagated from parent to meta (meta outlives terminal state
  for post-mortem writes like setting `meta.error` after ERROR).
- **TEARDOWN** — propagated from parent on parent's own TEARDOWN, releasing meta resources.
  The fan-out happens at the **top of the parent's `_emit` pipeline**, before the parent's
  own state-transition walk — meta children observe TEARDOWN while the parent's
  `_cached` / `_status` are still at their pre-teardown values. This ordering keeps the
  dispatch walk re-entrance-free: a meta child's own `_emit` cannot observe a
  half-committed parent state.

### 2.4 Node fn Contract

When a node has deps and fn:

```
node(deps, fn, opts?)
```

`fn` receives `(data, actions, ctx)`:

- **`data`** — batch-per-dep array. `data[i]` is `readonly unknown[] | undefined`:
  - `undefined` — dep `i` was not involved in this wave.
  - `[]` — dep `i` settled RESOLVED this wave (no new DATA value).
  - `[v1, v2, ...]` — dep `i` delivered one or more DATA values this wave, in arrival order. Most waves: `[v]` (single-element array).
- **`actions`** — `{ emit(value), down(msgOrMsgs), up(msgOrMsgs) }`. Every action call
  produces one wave. Multiple calls within a single fn invocation produce multiple
  independent waves. There is no accumulation or flush boundary at fn return.
  - `emit(v)` — sugar for `down([[DATA, v]])`. One wave with a single DATA payload.
  - `down(msgOrMsgs)` — send one or more messages downstream. Accepts either a single
    `Message` tuple (e.g. `down([DATA, 42])`) or a `Messages` array of tuples (e.g.
    `down([[DIRTY], [DATA, 42]])`). The dispatch pipeline tier-sorts the input,
    auto-prefixes `[DIRTY]` when tier-3 is present and the node is not already dirty
    (§1.3.1), runs equals substitution (§1.3.3), and delivers with phase deferral.
  - `up(msgOrMsgs)` — send messages upstream toward deps. Accepts the same
    `Message | Messages` shape. Tier-3 (DATA/RESOLVED) and tier-4 (COMPLETE/ERROR)
    are downstream-only and throw — `up` is for DIRTY, INVALIDATE, PAUSE, RESUME,
    and TEARDOWN only.
- **`ctx`** — `{ latestData: unknown[], terminalDeps: (true|unknown)[], store: object }`.
  - `latestData[i]` — last-known DATA value from dep `i` (from any prior wave, not just this one). Use as fallback when `data[i]` is `undefined` or `[]`.
  - `terminalDeps[i]` — `true` = COMPLETE, error payload = ERROR, `undefined` = live.
  - `store` — mutable bag that persists across fn runs within one activation cycle.
    Wiped on deactivation and on resubscribable terminal reset.

**fn return is cleanup only.** The return value is NEVER auto-framed as DATA or
RESOLVED. ALL emission is explicit via `actions.emit(v)` or `actions.down(msgs)`.

- **Returns a function:** registered as cleanup, called before the next fn invocation,
  on deactivation, AND on `[[INVALIDATE]]` (the node treats invalidate as "about to
  re-run" and flushes the prior cleanup). This INVALIDATE firing point is the
  reactive hook for flushing external caches tied to dep values — measurement
  caches, file handles, debouncers — on broadcast `graph.signal([[INVALIDATE]])`.
- **Returns `{ deactivation: () => void }`:** opt-in alternative. Fires ONLY on
  deactivation, NOT on fn re-run or INVALIDATE. Used for long-lived resources that
  should survive across fn invocations within one activation cycle.
- **Returns anything else (including undefined/void):** ignored.
- **Throws:** emits `[[ERROR, err]]` to downstream subscribers.

Sugar constructors (`derived`, `effect`, `task`, and similar) wrap user functions
internally to call `actions.emit()` — the user's function returns a value, but the
sugar converts it to an explicit emission. They also automatically unwrap the batch
format to a scalar per dep using the pattern:
`batch != null && batch.length > 0 ? batch.at(-1) : ctx.latestData[i]`.
Direct `node()` callers receive the raw batch arrays and must handle that format
themselves. This separation keeps the primitive clean while providing ergonomic APIs.

### 2.5 Options

All nodes accept these options:

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `name` | string | — | Identifier for graph registration |
| `equals` | (a, b) → bool | `Object.is` / `is` | Custom equality for RESOLVED check (see below) |
| `initial` | any | *(absent)* | Initial cached value (see below) |
| `meta` | object | — | Companion store fields |
| `resubscribable` | bool | false | Allow reconnection after COMPLETE |
| `resetOnTeardown` | bool | false | Clear cached value on TEARDOWN |
| `pausable` | bool \| `"resumeAll"` | `true` | PAUSE/RESUME behavior (see §2.6) |
| `replayBuffer` | number | — | Buffer last N outgoing DATA for late subscribers |
| `completeWhenDepsComplete` | bool | `true` | Auto-emit COMPLETE when all deps have completed. Set to `false` for terminal-emission operators (e.g. `last`, `reduce`) that control their own COMPLETE timing. |
| `errorWhenDepsError` | bool | `true` | Auto-emit ERROR when any dep errors. Set to `false` for rescue/catchError operators that handle errors explicitly via `ctx.terminalDeps[i]`. |

**`initial` semantics:** When `initial` is provided and is **not** `undefined` (TS) /
`None` (PY), the node's cache is pre-populated and `.cache` returns that value before
any emission. Source nodes with `initial` push `[[DATA, initial]]` to each new subscriber
(§2.2). On first `actions.emit(v)`, `equals` IS called against the initial value — if
the computed value matches, the node emits `RESOLVED` instead of `DATA`. When `initial`
is **absent** or explicitly set to `undefined` (TS) / `None` (PY), the cache holds
SENTINEL; the node does not push on subscribe, and the first emission always produces
`DATA` regardless of the value. `INVALIDATE` and `resetOnTeardown` return the cache to
the SENTINEL state.

**`undefined` / `None` as DATA payload.** `undefined` (TS) is reserved as the
protocol-internal "never sent DATA" sentinel — it is the value `.cache` returns when a
node has no cached value and the value stored in `dep.prevData` before any DATA has been
received. `DATA(undefined)` MUST NOT be emitted; implementations MUST reject or ignore
attempts to send `[[DATA, undefined]]`. `null` (TS/PY) is a valid DATA value and a valid
`initial` value — use `null` to represent domain-level absence. The type of `initial`
is therefore `T | null` (never `T | undefined`).

**`equals` contract:** `equals` is called between two consecutively cached values. It
is never called when the cache is in its SENTINEL state (no `initial`, or `initial:
undefined`/`None`, or after `INVALIDATE` / `resetOnTeardown` / resubscribe reset). When
the cache holds a real value — whether from `initial` or a prior emission — `equals`
compares it against the new value. The default `Object.is` / `is` handles all cases;
custom `equals` need only handle the value types the node actually produces.

### 2.6 Singleton Hooks and Per-Node Options

The node primitive has two per-node behavior hooks (`fn` and `equals`) and two
system-level options (`pausable` and `replayBuffer`).

#### PAUSE/RESUME (`pausable` option)

PAUSE/RESUME is default behavior, controlled by the `pausable` node option:

| Value | Behavior |
|-------|----------|
| `true` (default) | On PAUSE, suppress fn execution. On RESUME, fire fn once with the latest dep values (only the most recent wave matters). |
| `"resumeAll"` | On RESUME, replay every outgoing tier-3/4 message that was buffered while paused, in order. See "bufferAll mode" below. |
| `false` | Ignore PAUSE/RESUME — fn fires normally regardless of flow control signals. Appropriate for sources like reactive timers that must keep ticking regardless of downstream backpressure. |

**Lock-id tracking (mandatory).** Every tier-2 message MUST carry a `lockId`
payload: `[[PAUSE, lockId]]` / `[[RESUME, lockId]]`. Bare `[[PAUSE]]` /
`[[RESUME]]` is a protocol violation and implementations MUST reject it. The
`lockId` is opaque to the protocol — any value unique to the pauser is
acceptable (symbols, strings, counter-derived objects). Implementations track
active locks in a per-node set and derive the paused state from
`lockSet.size > 0`. This gives multi-pauser correctness by construction: if
controller A and controller B both hold pause locks, releasing A's lock does
not resume the node while B still holds its lock. Unknown-`lockId` RESUME is
a no-op, so `dispose()` on a pauser is idempotent.

PAUSE/RESUME flows through tier 2 (immediate). The node tracks a lock set
keyed by `lockId`; when the set is non-empty, wave completion skips fn but
DepRecord continues updating with latest values. On final-lock RESUME, if any
wave completed while paused, fn fires immediately with the latest dep values.

**bufferAll mode (`pausable: "resumeAll"`).** While any lock is held, the
node captures every outgoing tier-3 / tier-4 message from its own emission
pipeline into a per-node buffer. Tier 0–2 (START / DIRTY / INVALIDATE /
PAUSE / RESUME) and tier 5 (TEARDOWN) continue to dispatch synchronously
while paused — subscribers, downstream pausers, and graph teardown MUST
observe them regardless of flow control. On final-lock RESUME, the buffered
messages are replayed through the node's own `_emit` pipeline BEFORE the
RESUME signal is forwarded downstream. The replay passes through the normal
tier-3 equals substitution walk (§1.3.3), so a buffered `[DATA, v]` whose
value matches the pre-pause cache collapses to `[RESOLVED]` on replay —
producer "pulses" that write the same value while paused are absorbed. This
matches diamond-safety intent: `.cache` remains coherent with "the last
DATA actually delivered to sinks." Producers that need pulse semantics
(every write observable regardless of value) should set `equals: () => false`
on the node.

**Teardown.** On TEARDOWN or deactivation, the buffer and lock set are
discarded. Buffered in-flight DATA is NOT drained before teardown — TEARDOWN
is a hard reset. Resubscribable nodes also clear the lock set on resubscribe
so a new lifecycle cannot inherit a lock from a prior one.

#### `replayBuffer` option

When `replayBuffer: N` is set, the node maintains a circular buffer of the last N
outgoing DATA values. Late subscribers receive buffered DATA after the START handshake
but before live updates. This replaces the `replay()` operator and `wrapSubscribeHook`
monkey-patching.

```
node(deps, fn, { replayBuffer: 5 })  // buffer last 5 DATA values
```

#### Singleton hooks (framework-level)

Message interception and subscribe ceremony customization are **singleton** (global)
hooks configured once at application startup, not per-node options. This replaces the
per-node `onMessage` option from v0.2:

```
// TS
configure((cfg) => {
  cfg.onMessage = (msg, depIndex, node, actions) => { ... };
  cfg.onSubscribe = (node, sink) => { ... };
  cfg.registerMessageType(MY_TYPE, { tier: 3 });
});
// Config freezes on first node creation.
```

Custom message types (e.g., store mutation events) are registered via the singleton
`MessageTypeRegistry`. Unknown message types forward unchanged (§1.3.6).

### 2.7 Diamond Resolution

When a node depends on multiple deps that share an upstream ancestor:

```
    A
   / \
  B   C
   \ /
    D       ← D depends on [B, C], both depend on A
```

1. A changes → `[DIRTY]` propagates to B and C → both propagate `[DIRTY]` to D
2. D's DepRecord array marks: dep 0 dirty, dep 1 dirty (needs both to settle)
3. B settles (DATA or RESOLVED) → D marks dep 0 settled
4. C settles (DATA or RESOLVED) → D marks dep 1 settled → all dirty deps settled → D recomputes

D recomputes exactly once, with both deps settled. This is the glitch-free guarantee.

**Connection-time diamond:** When D subscribes for the first time and both B and C
activate (pushing their initial values), D's settlement machinery ensures fn runs
exactly once after all deps have settled — not once per dep.

### 2.8 Sugar Constructors

Implementations SHOULD provide these for readability:

```
state(initial, opts?)           = node([], { initial, ...opts })
producer(fn, opts?)             = node(fn, { describeKind: "producer", ...opts })
derived(deps, userFn, opts?)    = node(deps, wrappedFn, opts)  // wraps: actions.emit(userFn(data))
effect(deps, fn, opts?)         = node(deps, fn, opts)         // fn for side-effects, no auto-emit
dynamicNode(allDeps, fn, opts?) = node(allDeps, wrappedFn, { _isDynamic: true, ...opts })
pipe(source, ...ops)            = left-to-right fold
```

These are not distinct types. `describe()` infers a type label (`state`, `producer`,
`derived`, `operator`, `effect`) from the node's `describeKind` option for readability.

**`derived` wraps the user function** — the user returns a value, the sugar calls
`actions.emit(value)` internally. This is the "fn return is cleanup only" invariant:
the raw node primitive never auto-frames return values. Sugar constructors provide the
ergonomic "return a value" API on top.

---

## 3. Graph

The container that organizes nodes into a named, inspectable, composable artifact.

### 3.1 Construction

```
Graph(name, opts?)
```

A graph is a named collection of nodes with explicit edges.

### 3.2 Node Management

```
graph.add(name, node)           — register a node with a local name
graph.remove(name)              — unregister and teardown
graph.get(name)                 — get a node's current value (shorthand for graph.node(name).cache)
graph.set(name, value)          — set a writable node's value (shorthand for down([[DATA, v]]))
graph.node(name)                — get the node object itself
```

### 3.3 Edges

```
graph.connect(fromName, toName) — wire output of one node as input to another
graph.disconnect(fromName, toName)
```

Edges are pure wires. No transforms on edges. If you need a transform, add a node in between.
This keeps edges trivially serializable and the graph topology fully visible.

### 3.4 Composition

```
graph.mount(name, childGraph)   — embed a child graph as a subgraph
```

Mounting makes child nodes addressable under the parent's namespace. Lifecycle signals
propagate from parent to mounted children.

### 3.5 Namespace

Double-colon (`::`) delimited paths. No separate namespace primitive. Single colons
are allowed in node and graph names.

```
"system"                        — root graph
"system::payment"               — mounted subgraph
"system::payment::validate"     — node within subgraph
```

Rules:
- Mount automatically prepends parent scope
- Within a graph, use local names (`"validate"`)
- Cross-subgraph references use relative paths from the shared parent
- `graph.resolve(path)` → the actual node

### 3.6 Introspection

Core introspection uses two methods: `describe()` and `observe()`. Implementations MAY add
graph-native debugging helpers (for example reasoning traces or diagram export) without
introducing a separate Inspector object.

#### describe()

Static structure snapshot. Returns JSON.

```json
{
  "name": "payment_flow",
  "nodes": {
    "retry_limit": {
      "type": "state",
      "status": "settled",
      "value": 3,
      "deps": [],
      "meta": {
        "description": "Max retry attempts",
        "type": "integer",
        "range": [1, 10],
        "access": "both"
      }
    },
    "validate": {
      "type": "derived",
      "status": "settled",
      "value": true,
      "deps": ["input"],
      "meta": { "description": "Validates payment data" }
    }
  },
  "edges": [
    { "from": "input", "to": "validate" },
    { "from": "validate", "to": "charge" }
  ],
  "subgraphs": ["email"]
}
```

Knobs = writable nodes with meta (filter by `type: "state"` or writable nodes with meta).
Gauges = readable nodes with meta (filter by nodes that have `meta.description` or `meta.format`).
No separate knob/gauge API — `describe()` is the single source.

The `type` field in describe output comes from the `describeKind` option set by sugar
constructors. When not set, it is inferred:
- No deps, no fn → `"state"`
- No deps, with fn → `"producer"`
- Deps, with fn → `"derived"` (default for compute nodes)
- No fn, with deps → passthrough (labeled `"derived"`)

#### observe(name?)

Live message stream. Returns a subscribable source with an optional upstream channel.

```
graph.observe("validate")       — messages from one node
graph.observe()                 — messages from all nodes, prefixed with node name
```

The returned handle exposes:
- `subscribe(sink)` — receive downstream messages from the observed node(s). Because
  observe uses subscribe internally, the observer receives the initial `[[DATA, cached]]`
  push if the observed node has a cached value (§2.2).
- `up(messages)` (single-node) / `up(path, messages)` (all-nodes) — send messages
  upstream toward the observed node's sources (e.g. `[[PAUSE, lockId]]`).
  If a node guard denies the upstream message, it is silently dropped.

For testing:
```
const obs = graph.observe("myNode")
// Receives: [[DIRTY], [DATA, 42]], [[DIRTY], [RESOLVED]], etc.

// Backpressure: pause the upstream source
obs.up([[PAUSE, lockId]])
```

This replaces Inspector.observe(). The Graph IS the introspection layer.

### 3.7 Lifecycle

```
graph.signal(messages)          — send to all nodes: e.g. [[PAUSE, lockId]]
graph.destroy()                 — send [[TEARDOWN]] to all nodes, cleanup
```

### 3.8 Persistence

```
graph.snapshot()                — serialize: structure + current values → JSON
graph.restore(data)             — rebuild state from snapshot
Graph.fromSnapshot(data)        — construct new graph from snapshot
graph.toObject()                — deterministic JSON-serializable snapshot (sorted keys)
graph.toJSONString()            — UTF-8 text + stable newlines (git-versionable)
```

Snapshots capture **wiring and state values**, not computation functions. The fn lives in
code. The snapshot captures which nodes exist, how they're connected, their current values,
and their meta.

Same state → same JSON bytes → git can diff.

**TS:** `toObject()` returns a plain object; `toJSONString()` returns deterministic text.
`JSON.stringify(graph)` works via the ECMAScript `toJSON()` hook (delegates to `toObject()`).
**PY:** `to_dict()` returns a dict; `to_json_string()` returns deterministic text.

#### Auto-checkpoint

```
graph.autoCheckpoint(adapter, opts?)    — arm debounced reactive persistence
```

Wires `observe()` → debounced save. Trigger gate uses **message tier**: batches containing
tier `>=2` messages (value, terminal, or teardown lifecycle) schedule a save; pure
tier `0/1` control waves do not. This avoids snapshotting mid-batch. Returns a disposable
handle (disposed on `graph.destroy()`).

Options: `debounceMs` (default 500), `filter` (name/node predicate for which nodes trigger
saves), `compactEvery` (full snapshot interval for incremental diff mode), `onError`.

Implementations SHOULD support incremental snapshots via `Graph.diff()` — save only changed
nodes, with periodic full snapshot compaction.

#### Node factory registry

```
Graph.registerFactory(pattern, factory)  — register node factory by name glob
Graph.unregisterFactory(pattern)         — remove registered factory
```

Factory signature: `(name, { value, meta, deps, type, ...context }) → Node`. When `fromSnapshot(data)`
is called without a `build` callback, the registry matches each snapshot node's name against
registered patterns to reconstruct nodes with computation functions and guards reattached.

Reconstruction order:
1. Mount hierarchies (subgraphs)
2. State/producer nodes (no deps needed)
3. Derived/operator/effect nodes (deps resolved to step 2 nodes)
4. Edges
5. `restore()` to hydrate values

Pattern matching uses glob semantics (`"issue/*"`, `"policy/*"`). Global registry — solves
the chicken-and-egg problem (graph doesn't exist before `fromSnapshot` creates it).

When a `build` callback is provided, it takes precedence over the registry (existing
behavior preserved).

---

## 4. Utilities

### 4.1 pipe

Linear composition shorthand.

```
pipe(source, op1, op2, ...)     — returns the final node in the chain
```

Pipe creates a chain of nodes. It does not create a Graph — use `graph.add()` to register
piped chains if you want them named and inspectable.

### 4.2 Central timer and messageTier utilities

All time-dependent logic must use the central clock:

- **`monotonicNs()` / `monotonic_ns()`** — monotonic nanoseconds for internal event ordering,
  duration measurement, and debounce intervals. Immune to wall-clock adjustments.
- **`wallClockNs()` / `wall_clock_ns()`** — wall-clock nanoseconds for external attribution
  payloads (timestamps visible to users, logs, audit trails).

Never call `Date.now()`, `performance.now()`, `time.time_ns()`, or `time.monotonic_ns()`
directly outside the clock module.

**`messageTier` / `message_tier`** classifies message types into tiers for batch ordering
and auto-checkpoint gating. Always use the provided tier utilities rather than hardcoding
type checks. Tier `>=2` gates auto-checkpoint saves (§3.8).

### 4.3 batch

Defers DATA phase across multiple writes.

```
// TS
batch(() => {
  a.down([[DATA, 1]])
  b.down([[DATA, 2]])
})

// Python
with batch():
    a.down([[DATA, 1]])
    b.down([[DATA, 2]])
```

DIRTY propagates immediately for both. DATA deferred until batch exits. Downstream nodes
recompute once, not twice.

---

## 5. Design Principles

### 5.1 Control flows through the graph, not around it

Lifecycle events propagate as messages through graph topology. Never as imperative calls
that bypass the graph. If a new node needs registering in a flat list for lifecycle
management, the design is wrong.

### 5.2 Signal names must match behavior

When semantics diverge from names, rename the signal. Don't change correct behavior to
match a misleading name. (RESET → INVALIDATE.)

### 5.3 Nodes are transparent by default

Nodes forward messages they don't recognize. Deduplication is opt-in (`equals` option or
distinctUntilChanged), not default. No silent swallowing.

### 5.4 High-level APIs speak domain language

Higher layers (orchestration, messaging, AI) use domain terms. Protocol internals are
accessible via `inner` or `.node()` when needed, but the surface API never mentions
DIRTY, RESOLVED, bitmask, etc.

### 5.5 Composition over configuration

Prefer `pipe(source, withRetry(3), withTimeout(5000))` over
`source({ retries: 3, timeout: 5000 })`. Each concern is a separate node.

### 5.6 Everything is a node

Transforms on edges? Add a node. Conditional routing? Add a node. The graph has one kind
of thing (nodes) connected by one kind of thing (edges).

### 5.7 Graphs are artifacts

A graph can be snapshotted, versioned, restored, shared, and composed. It persists beyond
the process that created it. It represents a solution.

### 5.8 No polling

State changes propagate reactively via messages. Never poll a node's value on an interval
or busy-wait for status changes. If you need periodic behavior, use a timer source
(`fromTimer`, `fromCron`) that emits messages through the graph.

### 5.9 No imperative triggers outside the graph

Never use imperative side-channel calls (event emitters, callbacks, direct function calls)
to trigger graph behavior. All coordination uses reactive `NodeInput` signals and message
flow through topology. If you find yourself reaching for `setTimeout` + manual `set()`,
the design needs a reactive source node instead.

### 5.10 No raw async primitives in the reactive layer

TS: Do not use bare `Promise`, `queueMicrotask`, `setTimeout`, or `process.nextTick` to
schedule reactive work. Use the central timer in `core/clock.ts` for timestamps and the
batch system for deferred delivery. Async boundaries belong in sources (`fromPromise`,
`fromAsyncIter`) and the runner layer, not in node fns or operators.

PY: Do not use bare `asyncio.ensure_future`, `asyncio.create_task`, `threading.Timer`, or
raw coroutines to schedule reactive work. Use `core/clock.py` for timestamps and the batch
context manager for deferred delivery. Async boundaries belong in sources and the runner
layer (`compat/asyncio_runner`, `compat/trio_runner`).

### 5.11 Domain-layer APIs speak developer language

Domain-layer APIs (orchestration, messaging, memory, AI, CQRS) and framework integrations
must be developer-friendly: sensible defaults, minimal boilerplate, clear error messages,
and discoverable options. Protocol internals (`DIRTY`, `RESOLVED`, bitmask) are accessible
via `.node()` or `inner` but never surface in the primary API. A developer who has never
read the spec should be able to use `pipeline()`, `agentMemory()`, or `chatStream()` from
examples alone.

### 5.12 Data flows through messages, not peeks

All data propagation — including initial values at connection time — flows through the
message protocol (`[[DATA, v]]`). Nodes do not peek dep values via `.cache` to seed
computation. `.cache` is a read-only accessor for external consumers; the reactive
graph relies exclusively on messages for state propagation.

This ensures a single mental model: if data moved, a message carried it.

---

## 6. Implementation Guidance

> **Detailed implementation guidance** (language-specific adaptations, output slot optimization,
> single-dep optimization, graph factory patterns) has been moved to `COMPOSITION-GUIDE.md`.
> The spec defines **behavior**; the guide captures **how-to** patterns.

### 6.1 Language-Specific Adaptations

| Aspect | Guidance |
|--------|----------|
| Message types | TS: Symbol or string enum. Python: Enum class. |
| Pipe syntax | TS: `pipe(a, op)`. Python: `a \| op` or `pipe(a, op)`. |
| Batch syntax | TS: callback. Python: context manager. |
| Resource cleanup | TS: `.unsubscribe()`. Python: context manager + `.unsubscribe()`. |
| Concurrency | TS: single-threaded. Python: per-subgraph locks. |

### 6.2 Output Slot Optimization

Recommended subscriber storage: `null → single sink → Set<sink>`. Saves ~90% memory for
typical graphs where 70-80% of nodes have 0-1 subscribers. Implementation optimization,
not a spec requirement.

### 6.3 DepRecord (per-dep state)

Each node maintains a `DepRecord` array — one entry per declared dep — consolidating
all per-dep tracking into a single structure:

```
DepRecord {
  node: Node              // the dep itself
  unsub: fn | null        // subscription cleanup
  latestData: T | SENTINEL // latest DATA payload
  dirty: boolean          // received DIRTY, not yet settled
  settled: boolean        // received DATA/RESOLVED this wave
  terminal: boolean | err // false=live, true=COMPLETE, other=ERROR payload
}
```

This replaces separate BitSet masks, last-dep-values arrays, and upstream-unsub arrays.
Wave completion check: all deps where `dirty=true` must have `settled=true`.

---

## 7. Node Versioning (Progressive, Optional)

| Level | Fields | Cost | Enables |
|-------|--------|------|---------|
| V0 | id, version | ~16 bytes | Identity, change detection |
| V1 | + cid, prev | ~60 bytes | Content addressing, linked history |
| V2 | + schema | ~40 bytes | Type validation, migration |
| V3 | + caps, refs | ~80 bytes | Access control, cross-graph references |

Versioning is **opt-in** — the minimum observable level is V0, selectable per
node or graph-wide. Unversioned nodes (the default) skip the version counter
entirely. Higher levels extend the state monotonically: a node at V1 carries
V0's fields plus the V1 additions, and so on.

### 7.1 Attaching versioning

Three entry points, resolved in priority order:

1. **Per-node `opts.versioning`** — set at construction via
   `node(deps, fn, { versioning: 0 })`. Highest priority; overrides any
   config- or graph-level default.
2. **`GraphReFlyConfig.defaultVersioning`** — config-level default. Every
   node bound to that config inherits the level unless its own options
   override. Set once at application startup via `configure(cfg => {
   cfg.defaultVersioning = 0; })` before the first node is created.
   `GraphReFlyConfig.defaultHashFn` provides the same inheritance story for
   the content-hash function used to compute V1 `cid` — swap to a faster
   non-crypto hash for hot-path workloads, or a stronger hash when V1 cids
   serve as audit anchors.
3. **`Graph.setVersioning(level)`** — graph-level default. Bulk-applies the
   level to every node already registered in the graph, AND stores the
   default so `Graph.add(name, node)` applies it to nodes added later. The
   retroactive apply path uses `NodeImpl._applyVersioning(level)` under the
   hood.

### 7.2 Retroactive upgrade (`_applyVersioning`)

A node's versioning level can be bumped **upward only** after construction.
The internal `NodeImpl._applyVersioning(level, opts?)` method attaches (or
upgrades) versioning state on a quiescent node. It is intended for
`Graph.setVersioning` bulk application and for rare cases where a specific
node needs to be upgraded from V0 to V1 after construction.

- **Monotonic.** Levels only go up. Downgrade (e.g., V1 → V0) is a no-op —
  once a node carries higher-level metadata, dropping it would tear the
  linked-history invariant for V1 and above.
- **Quiescence guard.** `_applyVersioning` is rejected mid-wave. It MUST
  throw if the node is currently executing its fn. Callers at quiescent
  points — before the first sink subscribes, after all sinks unsubscribe,
  or between external `down()` / `emit()` invocations — are safe.
- **Identity preserved.** The existing `id` and `version` counter are
  preserved across upgrades so downstream consumers watching `v.id` don't
  see an identity jump.

### 7.3 Linked-history boundary at V0 → V1 upgrade

V0 → V1 retroactive upgrade produces a **fresh history root**. The new V1
state has `cid = hash(currentCachedValue)` and `prev = null`, not a
synthetic `prev` anchored to any prior V0 value. The V0 monotonic `version`
counter is preserved across the upgrade, but the linked-cid chain starts
fresh at the upgrade point.

Downstream audit tools that walk `v.cid.prev` backwards through time will
encounter a `null` boundary at the upgrade. **This is intentional**: V0 has
no cid to link to, and fabricating one would misrepresent the hash. Callers
that require an unbroken cid chain from birth MUST attach versioning at
construction via `opts.versioning` or `GraphReFlyConfig.defaultVersioning`,
not retroactively.

---

## 8. Spec Versioning

Follows semver:
- **Patch** (0.2.x): clarifications, examples
- **Minor** (0.x.0): new optional features, new message types
- **Major** (x.0.0): breaking changes to protocol or primitive contracts

Current: **v0.4.0** — unified dispatch waist; `actions.bundle` deleted; mandatory PAUSE/RESUME lockId; versioning §7 expanded

**Changelog:**
- **v0.4.0** — Unified dispatch waist. The `actions.bundle` / `Bundle` / `BundleFactory`
  user-facing framing surface is **deleted**: actions are `emit`, `down`, `up` only.
  Every emission path — `node.emit(v)`, `node.down(msgs)`, `actions.emit(v)`,
  `actions.down(msgs)`, passthrough forwarding, recursive ERROR after equals-throw —
  converges at a single internal `_emit` waist that owns terminal filtering,
  tier sort, synthetic `[DIRTY]` prefix, PAUSE/RESUME lock bookkeeping, meta
  TEARDOWN fan-out, equals substitution / cache advance, and phase-deferred
  dispatch. §1.3.1 is tightened: the "raw DATA without prior DIRTY is a compat
  path" carve-out is **removed** — the dispatcher synthesizes `[DIRTY]`
  unconditionally when tier-3 is present and the node is not already dirty, so
  raw and framed paths are observationally identical on the wire. `node.down`,
  `node.up`, `actions.down`, and `actions.up` now accept either a single `Message`
  tuple or a `Messages` array. `actions.up` throws on tier-3/4 (DATA/RESOLVED/
  COMPLETE/ERROR are downstream-only). One action call = one wave; there is no
  fn-return accumulation boundary. PAUSE/RESUME lockId is now **mandatory** —
  bare `[[PAUSE]]` / `[[RESUME]]` throws. Per-node lock set provides multi-pauser
  correctness by construction; unknown-lockId RESUME is a no-op for dispose
  idempotency. `pausable: "resumeAll"` bufferAll mode is fully specified (§2.6):
  tier-3/4 outgoing messages are buffered while any lock is held, replayed
  through `_emit` on final-lock RESUME (equals substitution still applies —
  duplicate values collapse to RESOLVED), and discarded on teardown/deactivate.
  Versioning §7 expanded: new §7.1 covers construction-time opt-in via
  `opts.versioning`, config-level defaults via `GraphReFlyConfig.defaultVersioning`
  and `defaultHashFn`, and graph-level bulk apply via `Graph.setVersioning`. New
  §7.2 documents retroactive `_applyVersioning` — monotonic, mid-wave rejected,
  identity preserved across upgrades. New §7.3 pins the V0 → V1 upgrade semantic:
  fresh history root with `prev = null`, intentional. Function-form fn cleanup
  now documented to fire on `[[INVALIDATE]]` as well as deactivation and
  pre-re-run — the reactive hook for flushing external caches on broadcast
  `graph.signal([[INVALIDATE]])` (reactive-layout pattern). Meta TEARDOWN fan-out
  ordering pinned in §2.3: parent notifies meta children at the top of `_emit`
  before the parent's own state-transition walk. `graph.signal([[INVALIDATE]])`
  meta filtering is clarified as a graph-layer responsibility, not core. Breaking:
  `actions.bundle` callers, bare `[[PAUSE]]` / `[[RESUME]]` emitters, and
  composition-guide table rows referencing `bundle(...).resolve()` must migrate.
- **v0.3.1** — Equals substitution is a dispatch-layer invariant (§1.3.3, scope
  broadened). Every outgoing DATA payload — computed fn results, `actions.emit(v)`,
  bundle-wrapped down, raw `actions.down([[DATA, v]])`, and passthrough forwarding —
  runs through a single equals-vs-live-cache check; on match the tuple is rewritten
  to `[RESOLVED]` and cache is not re-advanced. When substitution fires on a
  raw-path emission without a prior DIRTY, the dispatcher auto-synthesizes
  `[DIRTY]` to preserve §1.3.1 (DIRTY precedes DATA or RESOLVED). Equals-throw
  mid-batch delivers the successfully-walked prefix before emitting ERROR so
  `.cache` stays coherent with what subscribers observe. `.cache` gains a
  well-defined meaning: "the last DATA payload this node actually emitted
  downstream." Compat layers: §D.12 Invariant I updated — choosing a particular
  `actions` API no longer bypasses `equals`; use `equals: () => false` at node
  construction to force-emit same-valued DATA. No user-facing API change; no new
  message types; pre-v0.3.1 user code continues to work with the only observable
  difference being that same-value raw-down writes now produce `[DIRTY, RESOLVED]`
  on the wire instead of `[DATA, v]` (semantically equivalent). Compatible patch.
- **v0.3.0** — Foundation redesign. fn return is cleanup only — all emission via
  `actions.emit(v)` or `actions.down(msgs)`. Per-dep state consolidated into DepRecord
  (replaces BitSet masks). NodeBase + NodeImpl merged into single class. `dynamicNode`
  uses superset deps model (no rewire buffer). `.get()` renamed to `.cache`. Status
  enum: `"disconnected"` → `"sentinel"`. Per-node `onMessage` → singleton config.
  PAUSE/RESUME promoted to default node option (`pausable`). `replayBuffer` node option
  replaces `replay()` operator. `bridge.ts` deleted. Single-dep DIRTY-skip optimization
  removed. `CleanupResult` wrapper removed. Sugar constructors (`derived`, `map`, etc.)
  wrap user functions with `actions.emit()`.
- **v0.2.0** — All nodes with cached value push `[[DATA, cached]]` to every new
  subscriber on subscribe. Derived nodes compute reactively from upstream push instead
  of eager compute on connection. Removes the peek-via-`.get()` connection path.
  Adds RESET message type (§1.2). PAUSE/RESUME lockId now required. Adds `dynamicNode`
  construction variant (§2.1). Adds §4.2 timer/messageTier utilities. Adds §5.13
  (data flows through messages). Updates §2.2 subscribe behavior table.
- **v0.1.0** — Initial draft.

---

## Appendix A: Message Type Reference

```
DATA          [DATA, value]           Value delivery
DIRTY         [DIRTY]                 Phase 1: about to change
RESOLVED      [RESOLVED]              Phase 2: unchanged
INVALIDATE    [INVALIDATE]            Clear cache
RESET         [RESET]                 Clear cache + re-push initial
PAUSE         [PAUSE, lockId]         Suspend (lockId required)
RESUME        [RESUME, lockId]        Resume (must match PAUSE lockId)
TEARDOWN      [TEARDOWN]              Permanent end
COMPLETE      [COMPLETE]              Clean termination
ERROR         [ERROR, err]            Error termination
```

## Appendix B: describe() JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["name", "nodes", "edges"],
  "properties": {
    "name": { "type": "string" },
    "nodes": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["type"],
        "properties": {
          "type": {
            "type": "string",
            "enum": ["state", "derived", "producer", "operator", "effect"]
          },
          "status": {
            "description": "Present at detail >= 'standard'. Omitted at 'minimal' detail level.",
            "type": "string",
            "enum": ["sentinel", "pending", "dirty", "settled", "resolved", "completed", "errored"]
          },
          "value": {},
          "deps": {
            "type": "array",
            "items": { "type": "string" }
          },
          "meta": { "type": "object" },
          "v": {
            "description": "Optional versioning payload when node versioning is enabled (Spec §7).",
            "oneOf": [
              {
                "type": "object",
                "required": ["id", "version"],
                "properties": {
                  "id": { "type": "string" },
                  "version": { "type": "integer", "minimum": 0 }
                },
                "additionalProperties": false
              },
              {
                "type": "object",
                "required": ["id", "version", "cid", "prev"],
                "properties": {
                  "id": { "type": "string" },
                  "version": { "type": "integer", "minimum": 0 },
                  "cid": { "type": "string" },
                  "prev": { "type": ["string", "null"] }
                },
                "additionalProperties": false
              }
            ]
          }
        }
      }
    },
    "edges": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["from", "to"],
        "properties": {
          "from": { "type": "string" },
          "to": { "type": "string" }
        }
      }
    },
    "subgraphs": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

## Appendix C: Scenario Validation

> **Detailed scenario patterns** are in `COMPOSITION-GUIDE.md` (section 15) and
> summarized below.

| Scenario | Primitives |
|----------|------------|
| LLM cost control | `state` (knob) → `derived` → gauges via meta |
| Security policy | `state` + `derived` + `effect` + PAUSE |
| Human-in-the-loop | `state` × 2 → `derived` gate → `effect` |
| Multi-agent routing | `Graph.mount` + `connect` |
| LLM builds graph | `Graph.fromSnapshot` + `describe()` |
| Git-versioned graphs | `toJSONString()` / `to_json_string()` |
| Custom domain signals | Singleton `MessageTypeRegistry` + unknown type forwarding |

---

## Appendix D: v0.4 Foundation Redesign Addendum

Behavioral additions and clarifications from the v0.4 foundation redesign that extend
the main spec sections above. See `graphrefly-ts/archive/docs/SESSION-foundation-redesign.md`
for the full decision log.

### D.1 `NodeOptions.errorWhenDepsError`

Separate from `completeWhenDepsComplete`. Default `true`. ERROR auto-propagates when
any dep errors, independently of COMPLETE auto-propagation. Only rescue / catchError
operators set `errorWhenDepsError: false` to handle errors explicitly via
`ctx.terminalDeps[i]`.

### D.2 `NodeOptions.config` and `GraphReFlyConfig` surface

Pass a custom `GraphReFlyConfig` instance for test isolation or custom protocol
stacks. Defaults to the module-level `defaultConfig`. A config freezes on first hook
read — all mutating calls (registering custom message types, setting hooks, setting
`defaultVersioning` / `defaultHashFn`) MUST happen at application startup, before any
node is created.

```ts
const custom = new GraphReFlyConfig({
  onMessage: (...) => undefined,
  onSubscribe: (...) => undefined,
  defaultVersioning: 0,              // every node inherits V0 unless overridden
  defaultHashFn: customHash,         // swap the V1 cid hash function
});
custom.registerMessageType(MY_TYPE, { tier: 3 });
const n = state(0, { config: custom });
```

`GraphReFlyConfig` fields relevant to user code:

- **`onMessage`** — global message interceptor (singleton hook).
- **`onSubscribe`** — global subscribe ceremony (singleton hook).
- **`defaultVersioning?: VersioningLevel`** — fallback versioning level for every node
  bound to this config unless the node's own `opts.versioning` provides an override.
- **`defaultHashFn?: HashFn`** — fallback content-hash function for V1 `cid`.
- **`tierOf(type)`** — pre-bound tier lookup available as a public field for inspection.

### D.3 `Graph.connect(from, to)` — reactive edge, post-construction

`connect()` wires a reactive edge after construction by calling `NodeImpl._addDep(sourceNode)`
on the target. The target's `_deps` array grows, the source is subscribed to, and the new
dep participates in wave tracking from that point forward.

**Breaking change from prior spec:** `connect()` no longer requires the target to include the
source in its constructor deps — it auto-adds. This enables pattern factories (stratify,
feedback, gate, forEach) to wire nodes after creation.

### D.4 Compat-layer two-way bridge invariant

Compat layers (`Signal.State`/`Signal.Computed`, Jotai `atom`, Nanostores `atom`/`computed`/`map`,
Zustand `create`, etc.) are first-class composable `Node<T>` producers, not one-way polyfills.
Every compat object MUST expose its backing node (`._node`, `store.node(name)`) and that node
MUST behave as any other protocol-compliant node when observed from the native layer.

**Invariant I — Write paths.** All three shapes are equivalent and produce identical wire output
under v0.4.0 (unified dispatch waist):
1. `n.emit(value)` — preferred idiom.
2. `n.down([DATA, value])` — single-tuple shape.
3. `n.down([[DIRTY], [DATA, value]])` — explicit two-phase shape.

`equals` cannot be bypassed by choice of write API. To force same-value re-emission, configure
`equals: () => false` at node construction.

**Invariant II — Compute paths.** Compat compute nodes MUST produce exactly one framed outcome
per wave — either DATA (value changed) or RESOLVED (value unchanged). Silently returning
without emitting leaves downstream `dep.dirty` stuck and freezes subsequent sibling waves.

**Invariant III — Equality semantics** MUST be encoded as `NodeOptions.equals`, not as
a side-effect of omitting emission. Jotai and Nanostores use `Object.is` → default equals.
Zustand fires on every `setState` → `equals: () => false` at node construction.

**Testability.** Compat-layer conformance to invariants I–III is testable only via:
1. Live subscribers observing `cb` arguments and fire counts (`.cache` reads are insensitive
   to mid-wave glitches because `.cache` is updated at end-of-wave).
2. Two-way bridge tests: subscribe directly to the compat object's backing node and compare
   the DATA sequence against the compat subscribe path.

**Scope.** Applies to every compat layer in `compat/` and any future compat layer.
