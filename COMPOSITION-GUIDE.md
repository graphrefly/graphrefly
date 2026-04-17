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
- `"sentinel"` when no subscribers are present (compute nodes also clear cache)

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

**`dynamicNode` uses the same first-run gate.** All possible deps are declared at
construction time (superset). fn receives a `track(dep)` function to selectively read
dep values. The first-run gate works identically — all declared deps must deliver at
least one value before fn fires. When an unused dep updates, fn fires but equals
absorption prevents downstream propagation. No rewire buffer, no `MAX_RERUN` cap.

**Diagnostic:** If `.cache` returns `undefined`/`None`, check `node.status`:
- `"sentinel"` → compute node with no subscribers (cache cleared per ROM/RAM)
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
guard code needed in the fn body — `null` is a valid DATA value; `undefined`
is the protocol-reserved sentinel and is never emitted as DATA.

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
processing the initial `null`. Use `== null` (loose) — never `=== null` (strict).
Loose equality catches both `null` and `undefined`; since `undefined` is never a
valid DATA payload, it won't appear here in practice, but loose equality is still
the idiomatic guard for "nullish initial value" and matches the `!= null` pattern
used elsewhere in the codebase.

```ts
// null IS a valid domain value (e.g. state(null)):
const source = state<T | null>(null);
effect([source], ([val]) => {
  if (val == null) return;  // guard — only needed because `null` is the initial
  // safe to process val
});
```

**Never use `=== undefined` as a reactive dep guard — with one documented exception.**
`undefined` is the protocol-reserved "never sent DATA" sentinel: it is the value
`dep.prevData` holds before any DATA has been received and the value `.cache` returns
when a node is in SENTINEL state. `DATA(undefined)` is not a valid emission;
implementations do not emit it. Using `=== undefined` as a guard in a normal `derived`
or `effect` fn will always be dead code — the first-run gate ensures the fn never runs
with an uninitialized dep.

**Exception: `partial: true`.** `derived`, `effect`, and `autoTrackNode` accept a
`partial` option that opts out of the sentinel guard:

```ts
// partial: true — fn runs even if some deps have not yet initialized
const partial = derived([a, b], ([va, vb]) => {
  if (va === undefined) return b_only(vb);  // a not yet ready
  if (vb === undefined) return a_only(va);  // b not yet ready
  return both(va, vb);
}, { partial: true });
```

When `partial: true`, the fn may receive `undefined` for any dep that has not yet
delivered its first DATA. Guarding with `=== undefined` IS the documented pattern here
— it detects uninitialized deps. This is the **only** case where `=== undefined` is
correct. For all other cases, use SENTINEL (no `initial`) so the first-run gate
handles "not ready yet" automatically.

**Rule of thumb:** use `node<T>()` (SENTINEL) for "not ready yet". Only use
`state(null)` + `== null` guard when `null` is a meaningful domain value. Use
`partial: true` only when you need the fn to run with a mix of initialized and
uninitialized deps and guard explicitly with `=== undefined`.

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
subscriber triggers activation (subscribing to all deps via DepRecord), which causes
deps to push their cached values, which drives computation. Without any subscriber,
derived nodes stay in `"sentinel"` status and never compute. The keepalive itself is
just an empty sink — the activation happens because subscribing triggers dep connection.

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

**Connection-time:** When D activates, it subscribes to all deps sequentially.
All DepRecords start with `dirty=true` (pre-set). Settlement is deferred until
all deps have pushed at least one DATA/RESOLVED. After all deps settle, fn runs
exactly once with all deps' latest values from DepRecord.

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
expect(d.cache).toBe(expected);
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

### 11. dynamicNode superset model

`dynamicNode` declares a **superset** of all possible dependencies at construction
time. fn receives a `track(dep)` function that reads values from pre-allocated
DepRecords. This is the same `NodeImpl` class with `_isDynamic: true` — no separate
`DynamicNodeImpl`.

```ts
const d = dynamicNode([toggle, expensiveCalc, fallback], (track) => {
  const flag = track(toggle);
  if (flag) return track(expensiveCalc);
  return track(fallback);
});
```

**Key properties:**

- **Same first-run gate as static nodes.** All declared deps must deliver at least one
  value before fn fires. No `undefined` first-pass, no rewire buffer.
- **Same wave tracking.** All deps participate in DIRTY/settled tracking via DepRecord.
  When an unused dep updates, fn fires but computes the same result → equals absorption
  emits RESOLVED instead of DATA. No wasted downstream propagation.
- **No rewire, no buffer, no `MAX_RERUN`.** Deps are fixed at construction. `track(dep)`
  is just a lookup: `depRecords[depIndexMap.get(dep)].latestData`. O(1).
- **`track` replaces `get`.** The proxy function is named `track` (not `get`) to avoid
  confusion with `node.cache` and TC39 Signals.

**When to use `dynamicNode` vs `derived`:**

- Use `derived([deps], fn)` when fn always uses all deps. Simpler — fn receives a flat
  array.
- Use `dynamicNode([allDeps], track => ...)` when fn conditionally reads different deps
  per invocation. All deps must be known at construction; if deps are truly unknown
  (e.g., Jotai atom discovery), a two-phase approach is needed (deferred, designed
  separately from core).

**Comparison with v0.2 dynamicNode (deleted):**

| Aspect | v0.2 `DynamicNodeImpl` | v0.3 superset model |
|--------|------------------------|---------------------|
| Deps | Discovered at runtime via `get()` | Declared at construction (superset) |
| First-run | Runs immediately, may see `undefined` | Waits for all deps (first-run gate) |
| Rewire | `_rewire()` + buffer + `MAX_RERUN` | None — deps fixed |
| Wave tracking | Separate `Set<number>` masks | Same DepRecord array as static |
| Class | Separate `DynamicNodeImpl` | `NodeImpl` with `_isDynamic` flag |
| Unused dep updates | Only tracked deps trigger fn | All deps trigger fn, equals absorbs |

### 12. ROM/RAM cache semantics in composition

State nodes are **ROM** — their cached value survives deactivation. Compute nodes
(derived, producer, effect, dynamic) are **RAM** — cache clears on deactivation.

**Composition consequences:**

- `state.cache` always returns the last set value, even with zero subscribers.
  Safe to read from external code at any time.
- `derived.cache` returns `undefined` when deactivated (no subscribers).
  Always subscribe before reading a compute node's value.
- Reconnect always re-runs fn from scratch (DepRecord is cleared on deactivate).
  Effects with cleanup get a fresh fire/cleanup cycle.

```ts
const s = state(42);
const d = derived([s], ([v]) => v * 2);

// No subscribers yet — d is in sentinel status.
d.cache;  // undefined (RAM — cache cleared)
s.cache;  // 42 (ROM — retained)

const unsub = d.subscribe(() => {});
d.cache;  // 84 (computed, cache live)
unsub();
d.cache;  // undefined (RAM — cache cleared again)
s.cache;  // 42 (ROM — still retained)
```

**Test pattern:** Always read `.cache` before `unsub()` for compute nodes. After
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
| Custom domain signals | User-defined message types via singleton `MessageTypeRegistry`; unhandled types forward through graph |

See `GRAPHREFLY-SPEC.md` Appendix C for the full summary table and spec context.

### 16. Nested `withLatestFrom` for multi-stage context assembly

In multi-stage pipelines (e.g., EXECUTE → VERIFY → REFLECT), the verify
effect needs the verify output *as trigger* and the execute output + execute
input *as context*. A single `withLatestFrom(verify, execute, input)` would
fire on ANY of the three — incorrect when you want "fire only when verify
settles."

**Pattern: nested `withLatestFrom`.**

```ts
// WRONG: fires on execute OR verify changes
const ctx = withLatestFrom(verifyNode, executeNode, executeInput);

// RIGHT: fire ONLY on verifyNode, sample the rest
const verifyWithExec = withLatestFrom(verifyNode, executeNode);
const verifyContext = withLatestFrom(verifyWithExec, executeInput);
effect([verifyContext], ([[[vo, exec], input]]) => { ... });
```

The outer `withLatestFrom` triggers on `verifyWithExec` (which triggers on
`verifyNode`), and samples `executeInput` without making it a reactive
trigger. This prevents mismatched values when a new item arrives before the
previous verification finishes.

**When to use:** Any pipeline where stage N's effect needs context from
stages N-1 and N-2, but should only fire when stage N settles. Common in
harness loops, multi-step LLM pipelines, and approval workflows.

### 17. Stable identity for retried/reingested items (`trackingKey`)

When items flow through a retry or reingestion loop, their summaries get
decorated with context (e.g., `[RETRY 1/3] original summary — failure
details`). Deriving identity keys from mutated summaries is fragile — any
new decoration pattern generates novel keys that defeat dedup and can cause
infinite loops.

**Pattern: `relatedTo[0]` as stable key.**

```ts
// In _internal.ts / _internal.py
function trackingKey(item: { summary: string; relatedTo?: string[] }): string {
    return item.relatedTo?.[0] ?? item.summary;
}
```

On retry/reingestion, set `relatedTo: [originalKey]` so all retries share
the same identity. First-time items (no `relatedTo`) use the raw summary.

**Key insight:** the original key is carried forward immutably through the
`relatedTo` array, not reconstructed from a mutated summary string.

---

## Advanced Implementation Patterns

### 19. Terminal-emission operators: stay silent during accumulation

Operators that emit only at upstream COMPLETE (`last`, `reduce`, `toArray`,
`bufferCount` at terminal) should emit **nothing** during accumulation
waves. Use `completeWhenDepsComplete: false` to opt out of auto-COMPLETE,
then explicitly emit `[DIRTY, DATA, COMPLETE]` on terminal via
`actions.emit(accumulator)` + `actions.down([[COMPLETE]])`.

```ts
export function reduce<T, R>(src: Node<T>, reducer, seed: R): Node<R> {
  return node([src], (data, a, ctx) => {
    if (!("acc" in ctx.store)) ctx.store.acc = seed;
    const batch0 = data[0];
    const v = batch0 != null && batch0.length > 0 ? batch0.at(-1) : ctx.latestData[0];
    // ERROR is auto-propagated by the framework before fn runs
    // (default `errorWhenDepsError: true`) — no guard needed here.
    if (ctx.terminalDeps[0] === true) {
      a.emit(ctx.store.acc);
      a.down([[COMPLETE]]);
      return;
    }
    if (batch0 != null && batch0.length > 0) {
      ctx.store.acc = reducer(ctx.store.acc, v);
    }
    // Silent — downstream's pre-set-dirty DepRecord holds wave open
  }, { completeWhenDepsComplete: false });
}
```

**Anti-pattern:** emitting `RESOLVED` on every accumulation wave. This
was used in earlier drafts as an "I'm alive" signal, but it pollutes the
wave ordering and confuses diamond tests. Downstream's wave machinery
naturally waits for the terminal emission.

**Batch input model — raw `node()` vs sugar constructors:**

- **Sugar constructors** (`derived`, `effect`, `task`) receive
  `data: readonly unknown[]` — the batch is unwrapped automatically
  using `batch.at(-1) ?? ctx.latestData[i]`. Each element is the
  latest DATA value for that dep, just as in pre-v0.4 APIs.
- **Raw `node()` callers** receive
  `data: readonly (readonly unknown[] | undefined)[]` — each element
  is the full batch of DATA values emitted by that dep this wave, or
  `undefined` if the dep sent no DATA. To get the latest value and
  guard for DATA presence:
  ```ts
  const batch = data[i];
  const v = batch != null && batch.length > 0 ? batch.at(-1) : ctx.latestData[i];
  // Guard: only act when dep sent new DATA this wave
  if (batch != null && batch.length > 0) { /* ... */ }
  ```

### 20. `ctx.store` for persistent fn state

Replaces closure `let` vars that needed `onResubscribe` reset. The store
is a per-node object that persists across fn runs within one activation
cycle, and is wiped on deactivation / resubscribable terminal reset.

```ts
const counter = derived([src], (data, ctx) => {
  ctx.store.count = ((ctx.store.count as number) ?? 0) + 1;
  return ctx.store.count;
});
```

**Cleanup shapes:**
- `() => void` — default. Fires before next fn run, on deactivation, AND
  on `[[INVALIDATE]]`. The INVALIDATE firing point is the reactive hook
  for flushing external caches tied to dep values when broadcast
  `graph.signal([[INVALIDATE]])` reaches the node. Example:
  ```ts
  const measured = node([text, font], ([t, f], actions) => {
    const result = measureCache.measure(t as string, f as string);
    actions.emit(result);
    // Fires on next fn run, deactivation, OR INVALIDATE — flushes the
    // measurement cache so INVALIDATE actually recomputes from scratch.
    return () => measureCache.clear();
  });
  ```
- `{ deactivation: () => void }` — opt-in. Fires ONLY on deactivation.
  NOT on fn re-run, NOT on INVALIDATE. Use for persistent resources
  (sockets, intervals) that survive fn re-runs and should outlive an
  in-place invalidation.

### 21. `actions.emit` vs `actions.down`

Under v0.4.0, all three `actions` APIs converge at the same internal `_emit` waist.

| Call | Use for |
|------|---------|
| `actions.emit(v)` | Value emission — the common case |
| `actions.down(msgOrMsgs)` | Multi-message or mixed-tier batches |
| `actions.up(msgOrMsgs)` | Upstream control signals only (throws on tier-3/4) |

**Rule of thumb:** use `emit` for value emission. Use `down` only when you need to send
a multi-message batch in a single wave (e.g., `down([[DATA, 1], [DATA, 2], [COMPLETE]])`).

**Forcing same-value re-emission:** configure `equals: () => false` at node construction —
there is no way to bypass equals substitution by choice of API.

### 22. `autoTrackNode` — runtime dep discovery for pull-based compat

Use for Jotai/TC39-Signals-style APIs where deps are discovered by
running the fn. The P3 "no cross-node `.cache` reads" rule is relaxed
at the compat boundary during discovery (fn may read `dep.cache` as a
stub value for a newly discovered dep).

```ts
import { autoTrackNode } from "@graphrefly/graphrefly-ts";

const doubled = autoTrackNode((track) => {
  const value = track(someNode);     // auto-discovers someNode
  return (value as number) * 2;
});
```

**When to use:** compat layers (Jotai, TC39 Signals). For graph-native
code, prefer `dynamicNode(allDeps, fn)` — it requires upfront dep
declaration but avoids the P3 discovery exception.

**Re-run depth limit.** Each discovery re-run increments an internal counter. If the
counter exceeds 100, the node emits `[[ERROR]]` immediately — this is a safety guard
against reactive cycles introduced during dep discovery. If you hit it, the fn is
likely reading a dep that triggers a write that triggers the same fn.

### 23. Rescue pattern with `errorWhenDepsError: false`

Most operators should allow ERROR to propagate automatically. The
exception is rescue-style operators that catch ERROR and emit a fallback
value. Use `errorWhenDepsError: false` to suppress auto-ERROR, then
handle it explicitly via `ctx.terminalDeps[i]`:

```ts
export function rescue<T>(src: Node<T>, fallback: T): Node<T> {
  return node([src], ([v], a, ctx) => {
    const terminal = ctx.terminalDeps[0];
    if (terminal !== undefined && terminal !== true) {
      // dep errored — emit fallback
      a.emit(fallback);
      a.down([[COMPLETE]]);
      return;
    }
    a.emit(v);
  }, { errorWhenDepsError: false });
}
```

### 24. Edges are derived, not declared

`Graph.connect` / `Graph.disconnect` do not exist. Edges are a **pure
function** of `(nodes, each node's _deps, mounts)` and are derived on
demand by `graph.edges(opts?)` and every `describe()` call.

**What this means for composition:**

- No post-hoc "wire A to B" step. If you need B to react to A, B's
  constructor must receive A in its `deps` array.
- Factories that previously used `graph.connect(from, to)` for edge
  decoration (annotating a dep that wasn't in the constructor array) now
  have no way to surface that in describe — don't try. If the dep isn't
  a real `_deps` entry, it isn't an edge.
- Factories that needed **runtime dep discovery** (wire later based on
  observed values) use `autoTrackNode` (TS) — `track(dep)` inside the fn
  calls `_addDep` under the hood. Discovered deps surface in `edges()`
  automatically on next call (no stored registry, always fresh).
- Producer-pattern factories that manually `source.subscribe` inside their
  fn body (like old `stratify`, `gate`) produce nodes whose `_deps` is
  empty even though they react to something. Those edges are intentionally
  invisible — the describe output reflects constructor-time deps only.
  If you want the edge visible, restructure so the dep is a real
  constructor argument.

**Rule of thumb:** if `describe()` shows an edge, there is a real protocol
subscription behind it. If a factory wants to hide an edge, it keeps the
subscription private (producer pattern). There is no in-between.

### 25. Activation wave is ceremony, not transition

The DIRTY → DATA/RESOLVED two-phase invariant applies to state
transitions only, not the activation wave (fn's first run during the
subscribe ceremony). Spec §2.2 exempts START handshake from DIRTY; the
same exemption extends to the activation wave's first emission.

Operators that fire on activation (`last` accumulating its first value,
`derived` computing its initial result) emit without a preceding DIRTY.
Two-phase kicks in starting from the first post-activation state
transition.

**Test implication:** `globalDirtyBeforePhase2` helpers that check "DIRTY
precedes any DATA/RESOLVED globally" will fail for accumulating operators
because the initial activation RESOLVED has no preceding DIRTY. Rewrite
such tests to check "DIRTY precedes the terminal DATA" instead.

### 26. Compat layers are two-way bridges

Every compat layer (`Signal.State`/`Signal.Computed`, Jotai `atom`, Nanostores, Zustand, etc.)
MUST expose its backing node (`._node`) and that node MUST be wave-correct when observed
natively. See **GRAPHREFLY-SPEC.md Appendix D.4** for the full invariant set (write-path
equivalence, mandatory emit-not-return, `equals`-config encoding, and testability rules).

**Testing rule:** Always include a two-way bridge test — subscribe directly to `._node` and
compare the DATA sequence against the compat subscribe path. `.get()`/`.cache` assertions
alone miss mid-wave glitch bugs.

### 27. Tiered storage composition

`graph.attachStorage(tiers)` takes an **ordered list** of `StorageTier`
instances — hot tier first, cold tier last. Each tier has its own cadence
(`debounceMs`), compaction frequency (`compactEvery`), and optional
`filter`. One primitive covers the full hot/warm/cold spectrum:

```ts
graph.attachStorage([
  memoryStorage(),                           // hot: sync-through
  fileStorage(".graphrefly"),                // warm: periodic (default)
  indexedDbStorage({                         // cold: async, long debounce
    dbName: "my-app",
    storeName: "graph-snapshots",
    debounceMs: 60_000,
    compactEvery: 100,
  }),
]);
```

**Composition rules:**

- **Order matters for reads.** `fromStorage(name, tiers)` tries tiers in
  order and takes the first hit. Put fastest-to-read tier first.
- **Order matters for writes too.** On each triggering event, sync tiers
  (`debounceMs === 0`) all fire in the same microtask using one shared
  `snapshot()` result. Debounced tiers fire independently on their timer,
  each computing its own fresh snapshot.
- **Per-tier baseline.** Each tier tracks its own `{lastSnapshot, lastFingerprint}`.
  A cold tier's diff is against its own last save, not the hot tier's last
  save. No cross-tier contamination.
- **V0 short-circuit.** If a tier's version fingerprint hasn't changed since
  its last save, the save is skipped entirely (regardless of debounce).
  Works per-tier, so hot tier can skip redundant 0-second saves while cold
  tier is still waiting to flush.
- **Filter first, then compact.** A tier's `filter` returning `false`
  rolls back the tier's `seq` counter so `compactEvery` alignment against
  the actually-persisted records is preserved.
- **Async tiers don't block sync tiers.** The `save` return is typed
  `void | Promise<void>`. Sync tiers return `undefined`; async tiers
  return a Promise that's attached to `options.onError` for surfacing
  failures. Callers that `await` a sync tier's save get an immediate
  no-op resolution.

**Migration from pre-unification APIs:**

| Old | New |
|-----|-----|
| `graph.autoCheckpoint(adapter, {debounceMs})` | `graph.attachStorage([adapter], { ... })` |
| `new MemoryCheckpointAdapter()` | `memoryStorage()` |
| `new FileCheckpointAdapter(dir)` | `fileStorage(dir)` |
| `new SqliteCheckpointAdapter(path)` | `sqliteStorage(path)` |
| `saveGraphCheckpointIndexedDb(graph, spec)` | `graph.attachStorage([indexedDbStorage(spec)])` |
| `tieredStorage([a, b])` | `cascadingCache([a, b])` (for keyed lookup cache) |
| `graph.toJSONString()` | `graph.snapshot({format: "json-string"})` |
| `graph.toObject()` | `graph.snapshot()` (object by default) |

**Bytes and envelopes:**

Storage tiers that sit at a true I/O boundary (disk, wire, IPC) serialize
via codecs:

```ts
import { createDagCborCodec } from "@graphrefly/graphrefly-ts";
import * as dagCbor from "@ipld/dag-cbor";

config.registerCodec(createDagCborCodec(dagCbor));  // before first node

// Inside a storage tier's save:
const bytes = graph.snapshot({ format: "bytes", codec: "dag-cbor" });
await writeToDisk(bytes);

// On read:
const bytes = await readFromDisk();
const snap = Graph.decode(bytes, { config });  // envelope self-describes
```

The v1 envelope carries the codec name and version, so the read side
doesn't need prior knowledge of which codec produced the bytes. Built-in
`JsonCodec` is registered on `defaultConfig` at module load.

**What doesn't change:** in-memory `GraphCheckpointRecord` / `WALEntry`
stays a JS object throughout the attachStorage pipeline. Envelopes appear
only at the I/O boundary. If a tier keeps its data in-process (memory
tier, test fixture), no codec is involved — everything is JS objects.

### 28. Multi-dep push-on-subscribe ordering — factory-time seed over `withLatestFrom` for initial-state pairing

**The gap.** When a compute node has multiple deps that are all `state()` nodes
with cached values at activation time, `_activate` subscribes them sequentially
in declaration order. Each subscribe synchronously fires that dep's
push-on-subscribe — **as its own wave**. They don't coalesce into one
"initial activation wave." Consequences for operators whose semantic depends
on pair coincidence:

1. Dep[0]'s push-on-subscribe wave arrives while dep[1] is still SENTINEL →
   first-run gate (spec §2.7) forces RESOLVED.
2. Dep[1]'s push-on-subscribe wave arrives with dep[0] now silent **this
   wave** (its DATA landed in a prior wave and advanced `prevData[0]`).
3. Any operator fn that emits only on "primary fired this wave" silently
   drops the initial paired emission.

This is NOT a protocol invariant violation (push-on-subscribe, first-run
gate, DIRTY/DATA ordering all behave correctly per their contracts). It IS a
semantic gap users hit when composing operators like `withLatestFrom` over
state-backed deps.

**Symptom.** `verified.cache === null` after `verifiable(state(2), trigger)`
when you expect an initial verification to have fired. `store.has("seed")`
returns false after `distill(state("seed"), extractFn, ...)` when the
initial extraction was supposed to populate. Both silently dropped because
the underlying `withLatestFrom(source, storeOrTrigger)` composition lost the
first paired emission.

**Fix: factory-time seed + subscribe-handler update.** Capture the dep's
`.cache` at wiring time (explicitly sanctioned as an external-observer
boundary read per foundation-redesign §3.6), stash in a closure, update via
a subscribe handler, read the closure inside the reactive fn:

```ts
// WRONG: withLatestFrom drops the initial pair under state+state deps
const verifyStream = switchMap(
  withLatestFrom(triggerNode, sourceNode),
  ([, src]) => verifyFn(src as T),
);

// RIGHT: factory-time seed pattern
let latestSource: T | undefined = sourceNode.cache as T | undefined;
sourceNode.subscribe((msgs) => {
  for (const m of msgs) {
    if (m[0] === DATA) latestSource = m[1] as T;
  }
});
const verifyStream = switchMap(triggerNode, () => verifyFn(latestSource as T));
```

The closure reads inside the reactive fn are NOT P3 violations — they read a
closure variable, not a `.cache`. The subscribe handler outside the fn
updates the closure via protocol delivery. This is the pattern used by
`stratify`'s `latestRules`, `budgetGate`'s `latestValues`, `gate()`'s
`latestIsOpen`, and `distill`'s `latestStore`.

**When `withLatestFrom` is still fine.** When the primary is a raw `node()`
without an initial cached value, or when you only care about emissions from
run-time events (not the push-on-subscribe wave), `withLatestFrom` works as
documented. The gap only bites for `state()` + `state()` combinations on
initial activation.

**Why not fix `withLatestFrom` directly?** A naïve `[secondary, primary]`
flip in the dep declaration produces the correct initial pair but breaks
topology-sensitive diamond callers (e.g. `harness/loop.ts:executeContextNode`
depends on the current ordering for same-wave dep settlement through
`executeInput → executeNode → executeContextNode` plus `executeInput →
executeContextNode` diamond). A broader fix needs careful audit of all
in-tree diamond topologies. Tracked in `docs/optimizations.md`.
