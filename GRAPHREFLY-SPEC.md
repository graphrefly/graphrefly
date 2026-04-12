# GraphReFly Spec v0.3

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
   `[DATA, v]` or `[RESOLVED]`. Receiving DATA without prior DIRTY is valid for raw/external
   sources (compatibility path).

2. **Two-phase push.** Phase 1 (DIRTY) propagates through the entire graph before phase 2
   (DATA/RESOLVED) begins. Guarantees glitch-free diamond resolution.

3. **RESOLVED enables transitive skip.** If a node recomputes and finds its value unchanged,
   it sends `[RESOLVED]` instead of `[DATA, v]`. Downstream nodes skip recompute entirely.

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
node.down(messages)     → send messages downstream: [[DATA, value]]
node.up(messages)       → send messages upstream: [[PAUSE, lockId]]
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

#### down(messages)

Send messages downstream to all subscribers. For source nodes, this is the primary emit
mechanism:

```
node.down([[DATA, 42]])                         — emit value
node.down([[DIRTY], [DATA, 42]])                — two-phase emit
node.down([[COMPLETE]])                         — terminate
```

For compute nodes (with deps and fn), `down()` is available for explicit protocol control
(operator pattern). For pure compute (derived pattern), the node auto-emits based on fn
return value — `down()` is not typically called directly.

#### up(messages)

Send messages upstream toward dependencies:

```
node.up([[PAUSE, lockId]])                      — pause upstream
node.up([[RESUME, lockId]])                     — resume upstream
node.up([[TEARDOWN]])                           — request teardown
```

Only available on nodes that have deps.

#### unsubscribe()

Disconnect this node from its upstream dependencies. State nodes retain `.cache`;
compute nodes clear it (ROM/RAM rule). Status becomes `"sentinel"`. May reconnect
on next downstream subscription (lazy reconnect).

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
  To explicitly invalidate a meta node, send `down([[INVALIDATE]])` directly.
- **COMPLETE/ERROR** — not propagated from parent to meta (meta outlives terminal state
  for post-mortem writes like setting `meta.error` after ERROR).
- **TEARDOWN** — propagated from parent on parent's own TEARDOWN, releasing meta resources.

### 2.4 Node fn Contract

When a node has deps and fn:

```
node(deps, fn, opts?)
```

`fn` receives `(latestData, actions, ctx)`:

- **`latestData`** — array of latest DATA values from deps (from DepRecord).
- **`actions`** — `{ emit(value), down(messages), up(messages) }`.
  - `emit(v)` — convenience: runs `equals`, emits `[[DIRTY],[DATA,v]]` or `[[RESOLVED]]`.
  - `down(msgs)` — raw protocol: send full message tuples downstream.
  - `up(msgs)` — send messages upstream toward deps.
- **`ctx`** — `{ dataFrom: boolean[], terminalDeps: (true|unknown)[] }`.
  - `dataFrom[i]` — true if dep `i` sent DATA in this wave (vs RESOLVED).
  - `terminalDeps[i]` — `true` = COMPLETE, error payload = ERROR, `undefined` = live.

**fn return is cleanup only.** The return value is NEVER auto-framed as DATA or
RESOLVED. ALL emission is explicit via `actions.emit(v)` or `actions.down(msgs)`.

- **Returns a function:** registered as cleanup, called before next fn invocation or
  on teardown/deactivation.
- **Returns anything else (including undefined/void):** ignored.
- **Throws:** emits `[[ERROR, err]]` to downstream subscribers.

Sugar constructors (`derived`, `map`, `filter`, etc.) wrap user functions internally
to call `actions.emit()` — the user's function returns a value, but the sugar
converts it to an explicit emission. This separation keeps the primitive clean while
providing ergonomic APIs.

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

**`initial` semantics:** When `initial` is provided (even as `undefined`/`None`), the
node's cache is pre-populated and `.cache` returns that value before any emission. Source
nodes with `initial` push `[[DATA, initial]]` to each new subscriber (§2.2). On first
`actions.emit(v)`, `equals` IS called against the initial value — if the computed value
matches, the node emits `RESOLVED` instead of `DATA`. When `initial` is **absent**
(option key not present), the cache holds SENTINEL; the node does not push on subscribe,
and the first emission always produces `DATA` regardless of the value. `INVALIDATE` and
`resetOnTeardown` return the cache to the SENTINEL state.

**`equals` contract:** `equals` is called between two consecutively cached values. It
is never called when the cache is in its SENTINEL state (no `initial`, or after
`INVALIDATE` / `resetOnTeardown` / resubscribe reset). When the cache holds a real
value — whether from `initial` or a prior emission — `equals` compares it against the
new value. `equals` MAY receive `undefined`/`None` as an argument when the node has
explicitly received `[[DATA, undefined]]` / `[[DATA, None]]` or was initialized with
`initial: undefined` / `initial=None`. The default `Object.is` / `is` handles all
cases; custom `equals` need only handle the value types the node actually produces.

### 2.6 Singleton Hooks and Per-Node Options

The node primitive has two per-node behavior hooks (`fn` and `equals`) and two
system-level options (`pausable` and `replayBuffer`).

#### PAUSE/RESUME (`pausable` option)

PAUSE/RESUME is default behavior, controlled by the `pausable` node option:

| Value | Behavior |
|-------|----------|
| `true` (default) | On PAUSE, suppress fn execution. On RESUME, fire fn with latest dep values (only most recent matters). |
| `"resumeAll"` | On RESUME, replay all buffered updates since PAUSE (ordered). |
| `false` | Ignore PAUSE/RESUME — fn fires normally regardless of flow control signals. |

PAUSE/RESUME flows through tier 2 (immediate). The node tracks a `_paused` flag;
when paused, wave completion skips fn but DepRecord continues updating with latest
values. On RESUME, if any wave completed while paused, fn fires immediately.

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

V0 is recommended minimum. Higher levels are opt-in.

---

## 8. Spec Versioning

Follows semver:
- **Patch** (0.2.x): clarifications, examples
- **Minor** (0.x.0): new optional features, new message types
- **Major** (x.0.0): breaking changes to protocol or primitive contracts

Current: **v0.3.0** — fn-return-cleanup-only, consolidated NodeImpl, DepRecord

**Changelog:**
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

## Appendix D: v0.4 Foundation Redesign Addendum (2026-04-12)

This addendum captures v5 foundation redesign additions and clarifications
not yet integrated into the main spec sections above. See
`graphrefly-ts/archive/docs/SESSION-foundation-redesign.md` §10.6 for the
full decision log.

### D.1 `Node.emit(value, options?)` — public framed emit

Public sugar on the `Node<T>` interface, parallel to `Node.down(msgs)`:

```ts
interface Node<T> {
  down(messages: Messages, options?: NodeTransportOptions): void; // raw
  emit(value: T, options?: NodeTransportOptions): void;            // framed
  up?(messages: Messages, options?: NodeTransportOptions): void;   // raw
}
```

`emit(v)` runs `equals(cache, v)` to decide DATA vs RESOLVED, frames
through the singleton `bundle` (tier sort + DIRTY auto-prefix), and
delivers via the raw `_emit` pipeline. Diamond-safe by construction.

Use `emit` for state-node writes from external code when diamond safety
matters. Use `down` for raw protocol traffic (forwarding COMPLETE/ERROR/
TEARDOWN, spec §1.3.1 compat path for no-DIRTY DATA).

### D.2 `FnCtx.store` — persistent scratch pad

```ts
interface FnCtx {
  dataFrom: readonly boolean[];
  terminalDeps: readonly unknown[];
  store: Record<string, unknown>;  // NEW
}
```

`store` is a mutable per-node object that persists across fn invocations
within one activation cycle. Wiped on deactivation and on resubscribable
terminal reset. Replaces the factory / `afterResubscribe` patterns for
operators that need stateful accumulation (`reduce`, `takeWhile`,
`bufferCount`).

### D.3 Dual cleanup shape

```ts
type NodeFnCleanup = (() => void) | { deactivation: () => void };
```

- `() => void` — default. Fires before the next fn re-run AND on
  deactivation (RxJS/useEffect semantics).
- `{ deactivation: () => void }` — opt-in. Fires ONLY on deactivation.
  Used by operators with persistent resources that shouldn't be
  rebuilt between fn runs.

### D.4 `NodeOptions.errorWhenDepsError`

Separate from `completeWhenDepsComplete`. Default `true`. ERROR auto-
propagates when any dep errors, independently of COMPLETE auto-propagation.
Only `rescue` / `catchError` operators set `errorWhenDepsError: false`
to handle errors explicitly via `ctx.terminalDeps[i]`.

### D.5 `NodeOptions.config`

Pass a custom `GraphReFlyConfig` instance for test isolation or custom
protocol stacks. Defaults to the module-level `defaultConfig`.

```ts
const custom = new GraphReFlyConfig({...});
custom.registerMessageType(MY_TYPE, { tier: 3 });
const n = state(0, { config: custom });
```

### D.6 `Graph.connect(from, to)` creates a reactive edge

`connect()` wires a reactive edge post-construction by calling
`NodeImpl._addDep(sourceNode)` on the target. The target's `_deps` array
grows, the source is subscribed to, and the new dep participates in
wave tracking from that point forward.

**Breaking change from prior spec:** `connect()` no longer requires the
target to include the source in its constructor deps. It auto-adds.
This enables pattern factories (stratify, feedback, gate, forEach) to
wire nodes after creation.

### D.7 `autoTrackNode` — runtime dep discovery

Sugar factory for Jotai/signals-style auto-tracking. Deps are discovered
at runtime via `track(dep)` calls inside fn. Two-phase discovery:

1. Run fn. Each `track(dep)` for an unknown dep: subscribe via `_addDep`,
   return `dep.cache` as stub (P3 boundary exception for discovery).
2. After fn returns, if all new deps settled synchronously → emit
   directly (stub values match protocol values). Otherwise wait for wave
   machinery to re-run with protocol values.
3. Converges when no new deps found.

Re-entrance safety: `_execFn` guards against recursive calls triggered
by `_addDep`'s synchronous subscribe delivery.

### D.8 Terminal-emission operators emit nothing during accumulation

`last`, `reduce`, `toArray` stay silent during accumulation waves. They
emit `[DIRTY, DATA, COMPLETE]` only at upstream COMPLETE. Downstream's
pre-set-dirty DepRecord naturally holds the wave open until the terminal
emission — no intermediate RESOLVED needed.

This clarifies an earlier misuse: RESOLVED was being emitted as an
"activation ceremony" signal, which conflicted with its semantic meaning
("my wave settled, value unchanged").

### D.9 Two-phase invariant applies to transitions only

The DIRTY → DATA/RESOLVED two-phase invariant is a **state transition**
invariant. It does NOT apply to:
- Subscribe handshake (`[[START]]` + cached DATA) — §2.2 already exempt
- Activation wave (fn's first run during subscribe ceremony)

An accumulating operator's first RESOLVED emission during activation
does NOT require a preceding DIRTY. This is ceremony, not transition.
Two-phase applies to all post-activation waves where deps actually
transition through DIRTY.

### D.10 ROM rule: state nodes preserve status on disconnect

**Clarification of §2.2:** "Status becomes `sentinel` on disconnect"
applies only to **compute nodes**. State nodes preserve their status
across disconnect (ROM rule: their identity is their value, disconnect
is a subscriber lifecycle event not a value lifecycle event).

- State node after `INVALIDATE` → unsub → status stays `"dirty"`
- Compute node after first activation → unsub → status → `"sentinel"`
- Resubscribable terminal compute node → unsub → status → `"sentinel"`
  (resubscribable means "can re-activate after terminal", so terminal
  state doesn't persist)

### D.11 `NodeImpl._addDep` and `_setInspectorHook` (internal)

Two internal methods surfaced for graph/sugar consumers:

- **`_addDep(depNode): number`** — post-construction dep addition,
  subscribes immediately, returns dep index. Used by `Graph.connect()`
  and `autoTrackNode`.
- **`_setInspectorHook(hook?): () => void`** — per-node inspection
  callback. Fires `{ kind: "dep_message", depIndex, message }` in
  `_onDepMessage` and `{ kind: "run", depValues }` in `_execFn`. Used
  by `Graph.observe(path, { causal, derived })` for causal tracing.

Both are `@internal` — not part of the public `Node<T>` interface. Use
through `Graph` APIs or sugar factories.
