# Composition Guide

> **Accumulated patterns for building factories and domain APIs on top of GraphReFly primitives.**
>
> This is NOT the spec. The spec (`GRAPHREFLY-SPEC.md`) defines **protocol behavior** — what MUST happen. This guide captures **"good to know before you fail"** — patterns, insights and recipes that composition authors (human or LLM) encounter when wiring primitives into higher-level APIs.
>
> Both `graphrefly-ts` and `graphrefly-py` CLAUDE.md files reference this guide.

---

## How to use this guide

- **Before building a factory** that composes derived nodes, TopicGraphs, or gates: scan the categories below.
- **When debugging silent failures** (undefined values, missing messages, empty topics): check "Silent failure modes" first.
- **When writing tests** for composition code: see "Testing composition" for patterns.

---

## Categories

### 1. Push-on-subscribe and activation (START + first-run gate)

Every subscription starts with a `[[START]]` handshake (spec §2.2). A node with a
cached value delivers `[[START], [DATA, cached]]` to each new sink; a SENTINEL node
delivers just `[[START]]`. The START message carries no wave-state implication and
is not forwarded through intermediate nodes — each node emits its own START to its
own new sinks.

**First-run gate.** A compute node (derived/effect) does NOT run fn until every
declared dep has delivered at least one real value. If any dep is SENTINEL, the
node stays in `"pending"` status; fn only fires once every dep transitions out of
SENTINEL via a real DATA. This is the composition-guide rule #1 — "derived nodes
depending on a SENTINEL dep will not compute until that dep receives a real value."

**Status after subscribe.** `node.status` becomes:
- `"settled"` / `"resolved"` when fn has run and emitted a value
- `"pending"` when the subscribe flow completes but fn hasn't run (blocked on a
  SENTINEL dep)
- `"disconnected"` when no subscribers are present (compute nodes also clear cache)

```ts
// Derived computes on subscribe — all deps have values
const count = state(0);
const doubled = derived([count], ([v]) => v * 2);
doubled.subscribe(sink);
// Sink receives: [[START]], then [[DIRTY],[DATA,0]] from doubled's activation.

// Derived does NOT compute — SENTINEL dep blocks the first-run gate
const pending = node<string>();  // SENTINEL — no initial
const upper = derived([pending], ([v]) => v.toUpperCase());
upper.subscribe(sink);
// Sink receives: [[START]] only. upper.status === "pending".
pending.down([[DATA, "hello"]]);
// NOW the gate opens, upper computes, sink receives [[DIRTY],[DATA,"HELLO"]].
```

**`dynamicNode` is different.** Because deps are discovered at runtime via the
tracking `get()` proxy, dynamicNode cannot gate on "all deps delivered" upfront.
It runs fn on first subscribe — possibly seeing `undefined` for lazy/disconnected
deps — then uses a rewire buffer to detect discrepancies and re-run fn once when
real values arrive. See §11 (dynamicNode rewire buffer) for the full pattern.

**Diagnostic:** If `get()` returns `undefined`/`None`, check `node.status`:
- `"disconnected"` → compute node with no subscribers (cache cleared per ROM/RAM)
- `"pending"` → subscribed but fn hasn't run (SENTINEL dep blocking the first-run gate)
- `"settled"` or `"resolved"` → value is current, it really is `undefined`/`None`
- `"errored"` → fn threw

### 2. Subscription ordering (streaming sources only)

**State** nodes (and any node with a cached value) push `[[DATA, cached]]` to **every**
new subscriber on subscribe. Late subscribers receive the current value — ordering does
not matter for state-like nodes.

For **producer** and streaming sources (fromPromise, fromAsyncIter, etc.), messages are
fire-and-forget. If you subscribe after a producer has already emitted, you miss the
emission. Wire observers before starting producers.

```ts
// State: order doesn't matter — late subscribers get current value
const s = state(42);
s.down([[DATA, 100]]);
s.subscribe(handler);  // handler receives [[DATA, 100]] (current cached value)

// Producer/stream: order matters
const p = producer((_deps, { emit }) => { emit(42); });
p.subscribe(handler);  // handler receives 42 (subscribed before emit)
// vs. subscribing after emit → missed
```

**Escape hatch:** `TopicGraph.retained()` returns all buffered entries for late
subscribers. `SubscriptionGraph` provides cursor-based catch-up automatically.

### 3. Null/undefined guards — two patterns, no third

GraphReFly has exactly **two** guard patterns for "no value yet". Do not invent
a third.

**Pattern 1: SENTINEL (preferred).** Use `node<T>()` with no `initial`. The
first-run gate blocks computation until every dep has delivered real DATA. No
guard code needed in the fn body — `undefined` and `null` are both valid DATA
values, never used as "not ready" sentinels.

```ts
// "Not ready yet" → use SENTINEL. No guard needed.
const source = node<T>();  // SENTINEL → effect stays `"pending"` until DATA arrives
effect([source], ([val]) => {
  // val is always a real value here; no guard needed.
  process(val);
}).subscribe(() => {});
```

**Pattern 2: `== null` guard (loose equality).** Only needed when `null` is a
meaningful initial domain value (e.g. `state(null)`) and you want to skip
processing the initial `null`. Use `== null` (loose) — never `=== undefined` or
`=== null` (strict). Loose equality catches both `null` and `undefined`, which
is the correct domain guard since both are valid DATA values that may appear as
initial state.

```ts
// null IS a valid domain value (e.g. state(null)):
const source = state<T | null>(null);
effect([source], ([val]) => {
  if (val == null) return;  // guard — only needed because `null` is the initial
  // safe to process val
});
```

**Never use `=== undefined` as a reactive dep guard.** `undefined` is a valid
DATA value in the protocol. The "no value yet" signal is SENTINEL + START
handshake, not `undefined`. Using `=== undefined` conflates JavaScript variable
state with reactive protocol semantics and will silently break when a dep
legitimately emits `undefined` as DATA.

**Rule of thumb:** use `node<T>()` (SENTINEL) for "not ready yet". Only use
`state(null)` + `== null` guard when `null` is a meaningful domain value.

### 4. Versioned wrapper navigation

`ReactiveMapBundle.node` (TS) / `.data` (PY) emits `Versioned<{ map: ReadonlyMap<K,V> }>`
snapshots. The `Versioned` wrapper exists for efficient RESOLVED deduplication (compare
version numbers instead of deep map equality).

**Pattern:** Use `.get(key)` on the bundle directly for single-key reads. Only navigate
the Versioned wrapper when using the node as a reactive dep.

### 5. Graph factory wiring order

When building a factory that composes multiple stages, wire in this order:

1. Create all TopicGraphs / state nodes (sinks)
2. Create derived/effect nodes that read from them (processors)
3. Subscribe / keepalive internal nodes
4. Mount subgraphs into the parent graph
5. Return the controller

This ensures that when stage N emits, stage N+1 is already wired to receive.

**Keepalive vs activation:** In the push model, keepalive subscriptions
(`node.subscribe(() => {})`) serve to **activate** the computation chain. The first
subscriber triggers upstream wiring (internal `_connectUpstream`), which causes deps to
push their cached values, which drives computation. Without any subscriber, derived
nodes stay disconnected and never compute. The keepalive itself is just an empty sink —
the activation happens because subscribing triggers upstream connection.

### 6. Cross-language data structure parity

When using `ReactiveMapBundle`, `reactiveLog`, or `reactiveList` across TS and PY:

- TS `ReactiveMapBundle` has `.get(key)`, `.has(key)`, `.size`. PY exposes `.data` (node)
  with `.set()` / `.delete()` / `.clear()` but no `.get(key)` (parity gap).
- Both wrap internal state in `Versioned` snapshots.
- Always check the language-specific API rather than assuming parity.

### 7. Feedback cycles in multi-stage factories

When a downstream effect writes back to an upstream node that is a reactive dep of a
derived node, the system enters an infinite loop: A → B → C → ... → write(A) → A → B → ...

**Pattern:** Use `withLatestFrom(trigger, advisory)` to read advisory context without
making it a reactive trigger. Only the `trigger` (primary) causes downstream emission;
`advisory` (secondary) is sampled silently.

```ts
// WRONG: strategy as reactive dep creates feedback cycle
const triage = promptNode(adapter, [intake.latest, strategy.node], fn);

// RIGHT: withLatestFrom — intake triggers, strategy sampled
const triageInput = withLatestFrom(intake.latest, strategy.node);
const triage = promptNode(adapter, [triageInput], fn);
```

### 8. promptNode SENTINEL gate

`promptNode` gates on nullish deps and empty prompt text: if any dep value is
`null`/`undefined` (checked via `!= null` — loose equality catches both), or the
prompt function returns falsy text, `promptNode` skips the LLM call and emits `null`.

**Pattern:** Return empty string from prompt functions when input is meaningless.
Use `!= null` (not `!== null`) in guards to catch both `null` and `undefined`.

### 9. Diamond resolution and two-phase protocol

Diamond topologies (A→B,C→D) are resolved glitch-free at both connection time
and during subsequent updates:

**Connection-time:** When D subscribes for the first time, `_connectUpstream`
subscribes to all deps sequentially. Settlement is deferred until all deps
are subscribed (structural invariant: `_upstreamUnsubs.length < _deps.length`).
After all deps are connected, one settlement check fires → fn runs exactly once
with all deps settled.

**Subsequent updates (two-phase required):** Derived nodes auto-emit
`[[DIRTY], [DATA, value]]` — the two-phase protocol ensures DIRTY propagates
through the entire graph before DATA. In diamond topologies, both B and C
receive DIRTY before either settles with DATA, so D waits for both.

**Source nodes in diamonds:** `state.down([[DATA, v]])` sends bare DATA (no
DIRTY). For single-path updates this is fine — derived nodes auto-prepend DIRTY.
But if you need glitch-free propagation from a source node through a diamond,
use two-phase explicitly:

```ts
// Single-path: bare DATA is fine (derived auto-prepends DIRTY)
source.down([[DATA, 42]]);

// Diamond path: use two-phase for glitch-free resolution
batch(() => {
  source.down([[DIRTY]]);
  source.down([[DATA, 42]]);
});
// or equivalently:
source.down([[DIRTY], [DATA, 42]]);
```

### 10. SENTINEL vs null-guard cascading in pipelines

When composing multi-stage pipelines with `join`, the choice between SENTINEL
deps and null guards has cascading consequences:

- **SENTINEL** (no `initial`): deps don't push on subscribe. Downstream
  effects/derived nodes simply wait for the first real value. No intermediate
  emissions. Preferred when "no value yet" is the intent.

- **Null guard** (`if (val == null) return defaultValue`): converts the null
  push into a real emission with a default value. This propagates downstream
  through all derived/join nodes, causing intermediate results where you
  expected none.

```ts
// WRONG: null guard creates intermediate emissions through join
const input = sensor(g, "input");  // SENTINEL
const classify = task(g, "classify", ([doc]) => {
  if (doc == null) return "pending";  // ← emits "pending" immediately
  return doc.type;
}, { deps: ["input"] });

// RIGHT: SENTINEL deps — pipeline only fires when input arrives
const input = sensor(g, "input");  // SENTINEL — no push
const classify = task(g, "classify", ([doc]) => {
  return doc.type;  // no guard needed — fn only runs when input has value
}, { deps: ["input"] });
```

**Rule of thumb:** Use SENTINEL for "not ready yet". Use `state(null)` + guard
only when `null` is a meaningful domain value.

---

## Debugging composition

When a composed factory produces unexpected behavior (OOM, infinite loops, silent
failures, stale values):

### Step 1: Re-read this guide

Most composition bugs are covered by an existing section:
- **OOM / infinite loop?** → Check §7 (feedback cycles)
- **Undefined values?** → Check §1 (SENTINEL deps) and §3 (null guards)
- **Missed messages?** → Check §2 (subscription ordering for streaming sources)
- **promptNode not firing?** → Check §8 (SENTINEL gate)

### Step 2: Isolate the failing scenario

Run a single test or scenario in isolation. Do not debug against the full suite.

### Step 3: Inspect node states

Use `describe()`, `node.status`, and profiling tools (TS: `graphProfile`,
`harnessProfile`; PY: equivalent) to snapshot the graph.

Key diagnostics:
- **`node.status`** — `disconnected` (no subscribers), `errored` (fn threw),
  `settled` (value is current)
- **`describe({ detail: "standard" })`** — all nodes, edges, statuses at once

### Step 4: Trace the reactive chain

Once you know which node has the wrong state, trace upstream: what is its dep?
What did the dep emit? Is the dep settled or still dirty?

### Step 5: Fix the root cause

An OOM is rarely a wiring-pattern problem — it's usually a key-tracking bug, an
unbounded counter, or a missing guard. Isolation and inspection reveal which.

---

## Testing composition

### Subscribe to activate

Derived nodes require a downstream subscriber to activate. In tests, subscribe
before asserting:

```ts
const d = derived([dep], fn);
d.subscribe(() => {});  // activates → dep pushes → d computes
expect(d.get()).toBe(expected);
```

### State subscribers receive current value

Unlike the old model, state now pushes to each new subscriber. Tests can
subscribe after state has a value and still receive it:

```ts
const s = state(42);
const values: number[] = [];
s.subscribe(msgs => {
  for (const m of msgs) if (m[0] === DATA) values.push(m[1]);
});
// values = [42] — received on subscribe
```

### SENTINEL for "no value yet"

Use `node()` without `initial` (SENTINEL) when the dep should start with no value.
SENTINEL nodes do not push on subscribe, so effects depending on them simply wait
for the first real value — no null guard needed:

```ts
const source = node<T>();       // SENTINEL — no initial value, no push
const e = effect([source], ([val]) => {
  process(val);                 // val is always a real value — no guard needed
});
e.subscribe(() => {});          // activates, but source has no value → effect doesn't fire
source.down([[DATA, real]]);    // NOW effect fires with real value
```

Use `state(null)` only when `null` is a **meaningful domain value** (e.g., "explicitly
cleared"). In that case, guard with `if (val == null) return;` since the initial `null`
push is intentional.

---

## Advanced topics

### 11. dynamicNode rewire buffer (lazy-dep stabilization)

`dynamicNode` discovers deps at runtime via a tracking `get()` proxy. Because deps
are unknown at subscribe time, it **cannot** use the pre-set dirty mask that static
nodes use for first-run gating (§9). Instead, it runs fn immediately on first
subscribe — possibly seeing `undefined` for lazy/disconnected deps — then uses a
**rewire buffer** to detect and correct discrepancies.

**The problem:** When fn calls `get(lazyDep)`, the dep may be disconnected (no
subscribers). `get()` returns `undefined` (RAM semantics — compute nodes clear cache
on disconnect). After fn returns, `_rewire` subscribes to the dep, which triggers the
dep's activation cascade. By the time the dep pushes its real value, fn has already
completed with the stale `undefined`.

**The solution — rewire buffer (3 phases after fn):**

1. **Rewire with buffering.** `_rewire` subscribes to new deps with `_rewiring = true`.
   Messages arriving during rewire go to `_bufferedDepMessages` instead of the normal
   wave handler.
2. **Scan for discrepancies.** After rewire, scan the buffer for DATA values that
   differ (by `equals`) from what fn tracked via `get()`. If any differ, re-run fn
   with the updated dep values.
3. **Stabilization cap.** Re-runs are bounded by `MAX_RERUN` (16). If fn doesn't
   stabilize (e.g., each run discovers new deps that change values), the node emits
   `ERROR` to prevent infinite loops.

```ts
// Lazy dep: `expensiveCalc` has no subscribers, so get() returns undefined.
// After _rewire subscribes to it, its activation push triggers a re-run.
const d = dynamicNode((get) => {
  const flag = get(toggle);       // toggle has value → returns it
  if (flag) {
    return get(expensiveCalc);    // first run: undefined (disconnected)
                                  // re-run after rewire: real value
  }
  return get(fallback);
});
d.subscribe(() => {});
// fn runs twice: once with undefined, once with real value.
// Only the second result is emitted downstream.
```

**Identity check (`_depValuesDifferFromTracked`).** After rewire, if a dep's
subscribe-time push delivers the same value fn already saw (e.g., dep was already
cached), the identity check prevents a redundant re-run. This is critical when
`subscribe()` is called inside `batch()` — the deferred DATA handshake arrives after
rewire finishes but carries the same value fn read synchronously via `get()`.

**Key differences from static nodes:**

| Aspect | Static (`NodeImpl`) | Dynamic (`DynamicNodeImpl`) |
|--------|--------------------|-----------------------------|
| First-run gate | Pre-set dirty mask — fn waits for all deps | None — fn runs immediately |
| SENTINEL deps | Block fn until real value arrives | fn sees `undefined`, rewire corrects |
| Wave tracking | `BitSet` masks (`_depDirtyMask`, `_depSettledMask`) | `Set<number>` (`_depDirtyBits`, `_depSettledBits`) |
| Dep changes | Never (fixed at construction) | Every `_runFn` may rewire |

**When to use `dynamicNode` vs static `derived`:**

- Use `derived([deps], fn)` when deps are known at construction time. Static nodes
  get the pre-set dirty mask, SENTINEL gating, and simpler wave tracking.
- Use `dynamicNode(get => ...)` when deps depend on runtime values (conditional
  branches, data-driven graphs). Accept the rewire overhead and `undefined` first-pass
  trade-off.

### 12. ROM/RAM cache semantics in composition

State nodes are **ROM** — their cached value survives disconnect. Compute nodes
(derived, producer, effect, dynamic) are **RAM** — cache clears on disconnect.

**Composition consequences:**

- `state.get()` always returns the last set value, even with zero subscribers.
  Safe to read from external code at any time.
- `derived.get()` returns `undefined` when disconnected (no subscribers).
  Always subscribe before reading a compute node's value.
- Reconnect always re-runs fn from scratch (`_lastDepValues` cleared on deactivate).
  Effects with cleanup get a fresh fire/cleanup cycle.

```ts
const s = state(42);
const d = derived([s], ([v]) => v * 2);

// No subscribers yet — d is disconnected.
d.get();  // undefined (RAM — cache cleared)
s.get();  // 42 (ROM — retained)

const unsub = d.subscribe(() => {});
d.get();  // 84 (computed, cache live)
unsub();
d.get();  // undefined (RAM — cache cleared again)
s.get();  // 42 (ROM — still retained)
```

**Test pattern:** Always call `get()` before `unsub()` for compute nodes. After
unsubscribe, the cache is gone.

### 13. `startWith` removal — use `derived` with `initial`

The `startWith(source, value)` operator has been removed. The first-run gate and
START handshake make it unnecessary for most cases. Use `derived` with `initial`:

```ts
// Old: startWith(source, defaultValue)
// New: derived with initial
const withDefault = derived([source], ([v]) => v, { initial: defaultValue });
```

The `initial` option sets the node's cache before any subscriber connects. When a
sink subscribes, the START handshake pushes `[[START], [DATA, initial]]` immediately.
When the source dep later pushes a real value, the derived node recomputes and emits
the updated value.

For SENTINEL sources that may never push, prefer `node<T>()` (SENTINEL) + the
first-run gate over a default value — the gate automatically holds downstream
computation until real data arrives.

### 14. Blocking async bridge deadlock (PY only)

**Symptom:** PY test or application hangs for 60s, then `TimeoutError` from
`first_value_from`. Happens when `AsyncioRunner` is the default runner and any
factory internally calls `first_value_from()` (e.g. `promptNode`, `_resolve_node_input`,
tool handlers).

**Root cause:** `first_value_from()` blocks the calling thread with
`threading.Event.wait()`. If the calling thread IS the asyncio event loop thread,
and the runner is `AsyncioRunner` (which schedules work on that same loop via
`call_soon_threadsafe`), the scheduled task can never execute — deadlock.

```
Event loop thread:
  promptNode fn → _resolve_node_input → first_value_from → Event.wait() ← BLOCKED
                                                                ↑
  AsyncioRunner task (needs loop to run) ───────────────────────┘ NEVER RUNS
```

**TS does not have this problem.** TS `resolveToolHandlerResult` is `async` and
returns a `Promise`. `firstDataFromNode` returns a `Promise` too — non-blocking.
The microtask queue stays free. PY has no equivalent — `first_value_from` must
block because Python node fns are synchronous.

**Workaround:** Use a thread-spawning runner (e.g. `_ThreadRunner` in test
conftest) instead of `AsyncioRunner` when the pipeline includes blocking bridges.
The thread-spawning runner runs coroutines in separate threads, so
`first_value_from` blocks the main thread while the coroutine completes in the
other thread — no deadlock.

**Long-term fix:** Refactor PY `_resolve_node_input` to return a `NodeInput`
(Node or plain value) instead of always resolving to a plain value. The calling
factory (promptNode) would then wire the result reactively via `from_any`, matching
TS's `switchMap`-based approach. This eliminates blocking entirely and makes
`AsyncioRunner` safe for the full pipeline.

| Runner | `first_value_from` safe? | Use case |
|--------|--------------------------|----------|
| `_ThreadRunner` (test conftest) | Yes — coroutines run in threads | Sync tests, any pipeline with blocking bridges |
| `AsyncioRunner` | **No** — deadlocks if called from event loop thread | Pure-reactive pipelines without `first_value_from` |
| `TrioRunner` | Same deadlock risk as AsyncioRunner | — |

### 15. Scenario patterns (spec Appendix C)

The spec’s **Appendix C** scenario validation table is the canonical index. Quick
composition-oriented patterns (same rows, shorthand):

| Scenario | Pattern |
|----------|---------|
| LLM cost control | `state` (knob via meta) → `derived` chain → gauges via meta |
| Security policy enforcement | `state` + `derived` + `effect` with PAUSE propagation |
| Human-in-the-loop | Two state nodes (human + LLM) → `derived` gate → `effect` |
| Multi-agent routing | `Graph.mount` + `connect` across subgraphs |
| LLM builds graph from snapshot | `Graph.fromSnapshot` + `describe()` for introspection |
| Git-versioned graphs | `toJSONString()` / `to_json_string()` → deterministic, diffable output |
| Custom domain signals | User-defined message types + `onMessage` to intercept; unhandled types forward through graph |

See `GRAPHREFLY-SPEC.md` Appendix C for the full summary table and spec context.
