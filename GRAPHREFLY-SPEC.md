# GraphReFly Spec v0.1

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
| `DATA` | value | Value delivery |
| `DIRTY` | — | Phase 1: value about to change |
| `RESOLVED` | — | Phase 2 alt: was dirty, value unchanged |
| `INVALIDATE` | — | Clear cached state, don't auto-emit |
| `PAUSE` | lockId? | Suspend activity |
| `RESUME` | lockId? | Resume after pause |
| `TEARDOWN` | — | Permanent cleanup, release resources |
| `COMPLETE` | — | Clean termination |
| `ERROR` | error | Error termination |

The message type set is open. Implementations MAY define additional types. Nodes MUST forward
message types they don't recognize — this ensures forward compatibility.

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

### 2.2 Interface

Every node exposes:

```
node.get()              → cached value (never errors, even when disconnected)
node.status             → "disconnected" | "dirty" | "settled" | "resolved" |
                          "completed" | "errored"
node.down(messages)     → send messages downstream: [[DATA, value]]
node.up(messages)       → send messages upstream: [[PAUSE, lockId]]
node.unsubscribe()      → disconnect from upstream deps
node.meta               → companion stores (each key is a subscribable node)
```

Source nodes (no deps) have no upstream, so `.up()` and `.unsubscribe()` are no-ops.
Implementations expose them on all node instances for uniformity (the `Node` interface
types them as optional), but calling them on a source node has no effect. When a node
or graph subscribes to another node, it can use `up()` to send messages upstream
through that subscription.

#### get()

Returns the cached value. Does NOT guarantee freshness and does NOT trigger computation.
**`status` is the source of truth** — always check it before trusting the return value
of `get()`:

| Status | Meaning | `get()` returns |
|--------|---------|-----------------|
| `disconnected` | Not connected to deps | `initial` if provided, else `undefined`/`None` |
| `dirty` | DIRTY received, waiting for DATA | Previous value (stale) |
| `settled` | DATA received, value current | Current value (fresh) |
| `resolved` | Was dirty, value confirmed unchanged | Current value (fresh) |
| `completed` | Terminal: clean completion | Final value |
| `errored` | Terminal: error occurred | Last good value or `initial` or `undefined`/`None` |

When no `initial` option was provided and no value has been emitted, `get()` returns
`undefined` (TS) / `None` (PY). Internally, implementations use a sentinel value to
distinguish "no value yet" from "emitted `undefined`/`None`".

Implementations MAY pull-recompute on `get()` when disconnected, but the spec does not
require it. `get()` never throws.

> **Debugging guidance** has been moved to `COMPOSITION-GUIDE.md` §1 "Lazy activation".
> Key rule: when `get()` returns unexpected values, check `status` first — it distinguishes
> `disconnected` (lazy, no subscriber) from `errored` (fn threw) instantly.

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

Disconnect this node from its upstream dependencies. The node retains its cached value
(accessible via `get()`) but status becomes `"disconnected"`. May reconnect on next
downstream subscription (lazy reconnect).

### 2.3 Meta (Companion Stores)

`meta` is an object where each key is itself a subscribable node. This replaces all
`with*()` wrapper patterns.

```
const n = node(deps, fn, {
  meta: { status: "idle", error: null, latency: 0 }
})

n.meta.status.get()              // "idle"
n.meta.error.get()               // null

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

`fn` receives the current values of deps. Its return value determines behavior:

- **Returns a value:** node caches it, emits `[[DIRTY], [DATA, value]]` if changed, or
  `[[DIRTY], [RESOLVED]]` if unchanged per `equals`.
- **Returns nothing (undefined/None):** treated as side effect. No auto-emit.
- **Uses `down()` explicitly:** full protocol control. No auto-emit from return value.
- **Returns a cleanup function:** called before next invocation or on teardown.
- **Throws:** emits `[[ERROR, err]]` to downstream subscribers.

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
| `onMessage` | fn | — | Custom message type handler (see §2.6) |

**`initial` semantics:** When `initial` is provided (even as `undefined`/`None`), the
node's cache is pre-populated and `get()` returns that value before any emission. On
first `_downAutoValue`, `equals` IS called against the initial value — if the computed
value matches, the node emits `RESOLVED` instead of `DATA`. When `initial` is **absent**
(option key not present), the cache is empty (internal sentinel); the first emission
always produces `DATA` regardless of the value. `INVALIDATE` and `resetOnTeardown`
return the cache to the empty-sentinel state.

**`equals` contract:** `equals` is called between two consecutively cached values. It
is never called when the cache is in its empty-sentinel state (no `initial`, or after
`INVALIDATE` / `resetOnTeardown` / resubscribe reset). When the cache holds a real
value — whether from `initial` or a prior emission — `equals` compares it against the
new value. `equals` MAY receive `undefined`/`None` as an argument when the node has
explicitly received `[[DATA, undefined]]` / `[[DATA, None]]` or was initialized with
`initial: undefined` / `initial=None`. The default `Object.is` / `is` handles all
cases; custom `equals` need only handle the value types the node actually produces.

### 2.6 Custom Message Handling (`onMessage`)

The message type set is open (§1.2). Nodes forward unrecognized types by default. The
`onMessage` option lets a node **intercept** specific message types before the default
dispatch:

```
node(deps, fn, {
  onMessage(msg, depIndex, actions) {
    // msg:      the message tuple [Type, Data?]
    // depIndex: which dep sent it
    // actions:  { down(), emit(), up() } — same as fn receives
    //
    // Return true  → message consumed, skip default handling
    // Return false → message not handled, proceed with default dispatch
  }
})
```

`onMessage` is called **for every message** from every dep — including DIRTY, DATA,
RESOLVED, COMPLETE, etc. This gives full control. However, intercepting protocol messages
(DIRTY, DATA, RESOLVED) can break two-phase invariants; users SHOULD only intercept
custom types unless they fully understand the protocol.

When `onMessage` returns `true`:
- The message is consumed. It is NOT forwarded downstream.
- The default dispatch (dirty tracking, settlement, forwarding) is skipped for that message.
- The handler MAY call `actions.down()` or `actions.emit()` to produce downstream output.

When `onMessage` returns `false` (or is not set):
- The default dispatch runs: DIRTY/DATA/RESOLVED drive the settlement cycle, unknown
  types forward unchanged (§1.3.6).

When `onMessage` throws:
- The exception is caught by the node. The node emits `[[ERROR, err]]` downstream
  (same behavior as fn throwing — §2.4). No further messages from that dep batch are
  processed.

Example — intercepting a custom `ESCROW_LOCKED` type:

```
// TS
const ESCROW_LOCKED = Symbol.for("web3/ESCROW_LOCKED");

const handler = node([escrowSource], computeFn, {
  onMessage(msg, depIndex, actions) {
    if (msg[0] === ESCROW_LOCKED) {
      actions.emit({ status: "locked", tx: msg[1] });
      return true;
    }
    return false;
  }
});

// Python
ESCROW_LOCKED = "ESCROW_LOCKED"

def handle_escrow(msg, dep_index, actions):
    if msg[0] == ESCROW_LOCKED:
        actions.emit({"status": "locked", "tx": msg[1]})
        return True
    return False

handler = node([escrow_source], compute_fn, on_message=handle_escrow)
```

Nodes without `onMessage` forward all unrecognized types unchanged — the spec default
(§1.3.6) is preserved.

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
2. D's bitmask records: dep 0 dirty, dep 1 dirty (needs both to settle)
3. B settles (DATA or RESOLVED) → D records dep 0 settled
4. C settles (DATA or RESOLVED) → D records dep 1 settled → D now recomputes

D recomputes exactly once, with both deps settled. This is the glitch-free guarantee.

### 2.8 Sugar Constructors

Implementations SHOULD provide these for readability:

```
state(initial, opts?)           = node([], null, { initial, ...opts })
producer(fn, opts?)             = node([], fn, opts)
derived(deps, fn, opts?)        = node(deps, fn, opts)         // fn returns value or uses down()
effect(deps, fn)                = node(deps, fn)               // fn returns nothing
pipe(source, ...ops)            = left-to-right fold
```

These are not distinct types. `describe()` infers a type label (`state`, `producer`,
`derived`, `operator`, `effect`) from the node's configuration for readability. The
`operator` label is inferred when fn uses `down()` explicitly — no separate sugar needed.

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
graph.get(name)                 — get a node's current value (shorthand for graph.node(name).get())
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

The `type` field in describe output is inferred from node configuration:
- No deps, no fn → `"state"`
- No deps, with fn → `"producer"`
- Deps, fn returns value → `"derived"`
- Deps, fn uses down() → `"operator"`
- Deps, fn returns nothing → `"effect"`

#### observe(name?)

Live message stream. Returns a subscribable source with an optional upstream channel.

```
graph.observe("validate")       — messages from one node
graph.observe()                 — messages from all nodes, prefixed with node name
```

The returned handle exposes:
- `subscribe(sink)` — receive downstream messages from the observed node(s).
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

### 4.2 batch

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

### 5.11 Central timer and messageTier utilities

All time-dependent logic must use the central clock (`monotonicNs()` / `monotonic_ns()` for
event ordering, `wallClockNs()` / `wall_clock_ns()` for attribution). Never call `Date.now()`,
`performance.now()`, `time.time_ns()`, or `time.monotonic_ns()` directly outside the clock
module. Message tier classification (`messageTier`) gates auto-checkpoint behavior and batch
ordering — always use the provided tier utilities rather than hardcoding type checks.

### 5.12 Phase 4+ APIs speak developer language

Domain-layer APIs (orchestration, messaging, memory, AI, CQRS) and framework integrations
must be developer-friendly: sensible defaults, minimal boilerplate, clear error messages,
and discoverable options. Protocol internals (`DIRTY`, `RESOLVED`, bitmask) are accessible
via `.node()` or `inner` but never surface in the primary API. A developer who has never
read the spec should be able to use `pipeline()`, `agentMemory()`, or `chatStream()` from
examples alone.

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

### 6.3 Single-Dep Optimization

When a node has exactly one dep in an unbatched path, implementations MAY skip the DIRTY
message and send DATA directly. The semantic guarantee (DIRTY precedes DATA) is preserved
within batched contexts. This is a performance optimization — the spec does not require it.

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
- **Patch** (0.1.x): clarifications, examples
- **Minor** (0.x.0): new optional features, new message types
- **Major** (x.0.0): breaking changes to protocol or primitive contracts

Current: **v0.1.0** (draft)

---

## Appendix A: Message Type Reference

```
DATA          [DATA, value]           Value delivery
DIRTY         [DIRTY]                 Phase 1: about to change
RESOLVED      [RESOLVED]              Phase 2: unchanged
INVALIDATE    [INVALIDATE]            Clear cache
PAUSE         [PAUSE, lockId?]        Suspend
RESUME        [RESUME, lockId?]       Resume
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
            "enum": ["disconnected", "dirty", "settled", "resolved", "completed", "errored"]
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

> **Detailed scenario patterns** have been moved to `COMPOSITION-GUIDE.md` and
> `composition-guide.jsonl`. The table below is a summary index.

| Scenario | Primitives |
|----------|------------|
| LLM cost control | `state` (knob) → `derived` → gauges via meta |
| Security policy | `state` + `derived` + `effect` + PAUSE |
| Human-in-the-loop | `state` × 2 → `derived` gate → `effect` |
| Multi-agent routing | `Graph.mount` + `connect` |
| LLM builds graph | `Graph.fromSnapshot` + `describe()` |
| Git-versioned graphs | `toJSONString()` / `to_json_string()` |
| Custom domain signals | `onMessage` + unknown type forwarding |
