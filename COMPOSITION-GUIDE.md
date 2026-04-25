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

## Pattern registry

Quick index — jump to the section that matches your problem.

| If you're asking… | See |
|---|---|
| "Why isn't my derived computing?" | §1 (first-run gate), §3 (guard patterns) |
| "Why are values missing/stale?" | §1 (SENTINEL), §2 (subscription ordering) |
| "How do I guard `null`/`undefined`?" | §3 (the only two guards) |
| "How do I break an infinite loop?" | §7 (feedback cycles) |
| "How do I wire a factory?" | §5 (graph factory wiring order) |
| "What's glitch-free diamond resolution?" | §9, §9a (two-phase + batch-coalescing) |
| "How do I get `withLatestFrom` initial pair?" | §28 (factory-time seed) |
| "How do I pair triggers with context?" | §16 (nested `withLatestFrom`) |
| "How do I dedupe retried items?" | §17 (`trackingKey` / `relatedTo`) |
| "Where do I put persistent fn state?" | §20 (`ctx.store`) |
| "What's `actions.emit` vs `actions.down`?" | §21 |
| "Why is my operator leaking mid-wave emits?" | §19 (terminal-emission operators) |
| "How do I make a rescue / error-to-fallback op?" | §23 (`errorWhenDepsError: false`) |
| "How do I tier persistence (hot/warm/cold)?" | §27 (`attachStorage`) |
| "How do multi-agent handoffs work?" | §29 (full handoff vs agent-as-tool) |
| "How do I cancel the agent mid-generation?" | §30 (parallel guardrail) |
| "How do I expose a reactive tool list?" | §31 (dynamic tool selection) |
| "PY test hangs for 60s then times out?" | §14 (blocking async bridge deadlock) |
| "Consumer reads stale switchMap cache across session boundaries?" | §32 (state-mirror for cross-wave reset) |
| "How do I keep system prompts prefix-cache-friendly?" | §33 (`frozenContext` snapshot) |
| "How do I route between agents reactively?" | §34 (`handoff` primitive — sugar over §29) |
| "How do I share an audit log + rollback shape across primitives?" | §35 (imperative-controller-with-audit) |
| "How do I model a long-running multi-step async workflow?" | §36 (process manager) |
| "How do I track which handler version produced an output?" | §37 (handler versioning via audit metadata) |

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

**Companion-node pattern for "last value with disambiguation."** When a
primitive needs to expose "the most recently delivered value" *and* `T`
itself may include nullish:

```ts
// reactiveLog, TopicGraph, JobQueueGraph.events, cqrs.dispatches, etc.
log.lastValue;   // Node<T | undefined> — RESOLVED on empty, never DATA(undefined)
log.hasLatest;   // Node<boolean>       — disambiguates "no entries" from "T = undefined was appended"
```

Both companions are **lazy** — accessing either getter (or calling
`withLatest()`) activates them; subsequent accesses return the same
nodes. They appear in `describe()` once activated, so cross-graph
explainability still resolves.

The companion pair (`Node<T | undefined>` + `Node<boolean>`) is the
project-wide convention whenever `T` may include nullish. Surfaces that
ship this:

| Surface | Last-value node | Boolean disambiguation |
|---|---|---|
| `reactiveLog` bundle | `bundle.lastValue` | `bundle.hasLatest` |
| `TopicGraph<T>` | `topic.lastValue` | `topic.hasLatest` |

When the companion's compute fn would otherwise emit `DATA(undefined)`
on the **empty-log path** (no entries yet, or post-`clear()`), it emits
`RESOLVED` instead — keeping the spec §1.2 "DATA(undefined) is not a
valid emission" invariant intact.

**When `T` itself includes `undefined`**, appending a literal `undefined`
value DOES produce a `DATA(undefined)` emission on the companion (the
per-value transition is preserved so subscribers can observe it).
`hasLatest` is the only reliable way to tell "no entries yet" from "an
undefined value was appended" — `lastValue.cache` is ambiguous.

Some legacy surfaces use the older **null-sentinel** pattern instead —
e.g. CQRS `cmdNode.meta.error: Node<unknown | null>` returns `null` to
mean "no error" (the value never includes null itself, so the sentinel
is unambiguous). Don't introduce new null-sentinel pairs in new code;
prefer the SENTINEL + companion pattern above.

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

Use `batch()` explicitly in source nodes for diamond paths; derived nodes
auto-emit `[[DIRTY], [DATA, value]]` so they're already two-phase. One update
wave produces one settle — downstream fn runs exactly once with all deps'
latest values, glitch-free.

```ts
// Diamond path: use two-phase for glitch-free resolution from a source node
batch(() => { source.down([[DIRTY]]); source.down([[DATA, 42]]); });
// or equivalently:
source.down([[DIRTY], [DATA, 42]]);
```

(See GRAPHREFLY-SPEC.md §2.7 for the protocol-level guarantee and §1.3 invariant 1 for the two-phase invariant.)

### 9a. Batch-coalescing rule

K consecutive `.emit()` calls to the same source inside `batch(() => {...})`
coalesce per-node into ONE multi-message delivery per child edge — one
DIRTY-bundle (tier 1) + one DATA-bundle (tier 3).

Without `batch()`, K emits produce K full DIRTY/DATA waves, so K fan-in
over-fires at diamonds. Inside `batch()`, downstream `fn` runs once with
`data: [v1, v2, …, vK]` — all values delivered in a single wave.

```ts
batch(() => {
  source.emit(1);
  source.emit(2);
  source.emit(3);
});
// downstream fn receives data: [1, 2, 3] in one call — not three separate waves
```

(GRAPHREFLY-SPEC.md §1.3 invariant 7 amends this rule.)

### 10. SENTINEL vs null-guard cascading in pipelines

The choice between SENTINEL and null-guard (see §3) propagates through every
downstream stage — a single wrong guard cascades into intermediate emissions
across the whole pipeline.

```ts
// WRONG: null guard creates intermediate emissions through every join
const classify = task(g, "classify", ([doc]) => {
  if (doc == null) return "pending";   // ← emits "pending" on every activation
  return doc.type;
}, { deps: ["input"] });

// RIGHT: SENTINEL deps — pipeline stays quiet until real input arrives
const classify = task(g, "classify", ([doc]) => doc.type, { deps: ["input"] });
```

**Cascading rule:** The first SENTINEL anywhere in the pipeline silences
every downstream node through the first-run gate (§1). Any null-guard break
in that chain re-starts downstream emissions with the default value — usually
not what you want. See §3 for the full SENTINEL-vs-null-guard decision.

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

**Symptom:** PY test hangs 60s then raises `TimeoutError` from `first_value_from`.

**Cause:** `first_value_from()` blocks on `threading.Event.wait()`. Under
`AsyncioRunner`, that wait happens on the event-loop thread, starving the
coroutine that would unblock it — classic deadlock. TS is unaffected because
`firstDataFromNode` returns a `Promise`, so the microtask queue keeps advancing.

**Workaround:** use `_ThreadRunner` (test conftest) when the pipeline contains
blocking bridges. It runs coroutines in separate threads so the main-thread
wait doesn't starve them.

**Long-term fix:** refactor `_resolve_node_input` to return `NodeInput`
(Node or plain value) instead of resolving to a plain value; callers wire
reactively via `from_any`, matching TS's `switchMap` pattern.

| Runner | Safe with `first_value_from`? |
|--------|--------------------------------|
| `_ThreadRunner` (test conftest) | Yes |
| `AsyncioRunner` | **No** — deadlocks from event-loop thread |
| `TrioRunner` | Same risk as `AsyncioRunner` |

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

### 27. Tiered storage composition (three-layer architecture)

Storage is **N-tier and free-form** — users decide hot/cold combinations.
The framework prescribes nothing about how many tiers, in what order, or
which kinds. Three layers compose cleanly:

```
Layer 3 — wiring         graph.attachStorage(tiers)
                         bundle.attachStorage(tiers)
                         cqrs.attachEventStorage(tiers)
                         jobQueue.attachEventStorage(tiers)
              │
              ▼
Layer 2 — typed tiers    SnapshotStorageTier<T>     // one record per save
                         AppendLogStorageTier<T>    // sequential entries
                         KvStorageTier<T>           // arbitrary keyed records
                          ↳ flush() / rollback()
                          ↳ debounceMs / compactEvery / filter
                          ↳ keyOf? for partitioning
              │
              ▼
Layer 1 — bytes backend  StorageBackend
                          ↳ read / write / delete / list
                          ↳ memory / file / sqlite / indexedDb
```

**Layer 1 — bytes-level `StorageBackend`.** Pure byte I/O. No tier-level
concerns (debounce, codec, transactions) — those live at Layer 2.
Reference backends: `memoryBackend()`, `fileBackend(dir)`,
`sqliteBackend(path)` (Node-only), `indexedDbBackend(spec)` (browser-only).

**Layer 2 — tier specializations.** Wrap a backend with a typed shape +
codec + write semantics:

- `snapshotStorage<T>(backend, opts?)` — one record per `save(snapshot)`;
  full-state replacement.
- `appendLogStorage<T>(backend, opts?)` — bulk-friendly sequential entries;
  partition via `keyOf?`.
- `kvStorage<T>(backend, opts?)` — many records under arbitrary keys.

Convenience factories combine each kind with each backend:
`memorySnapshot<T>()`, `memoryAppendLog<T>()`, `memoryKv<T>()`,
`fileSnapshot<T>(dir)`, `fileAppendLog<T>(dir)`, `fileKv<T>(dir)`,
`sqliteSnapshot<T>(path)`, `sqliteAppendLog<T>(path)`, `sqliteKv<T>(path)`,
`indexedDbSnapshot<T>(spec)`, `indexedDbAppendLog<T>(spec)`,
`indexedDbKv<T>(spec)`.

**Layer 3 — high-level wiring.** Primitives that own state expose
`attachStorage(tiers)` (or domain-named variants like
`attachEventStorage`):

```ts
// Graph snapshots — one snapshot tier per ordered slot.
graph.attachStorage([
  memorySnapshot(),                                          // hot
  fileSnapshot(".graphrefly", { debounceMs: 5_000 }),        // warm
  indexedDbSnapshot(spec, { debounceMs: 60_000 }),           // cold
]);

// CQRS event log — append-log tiers, partition by aggregate.
cqrs.attachEventStorage([
  fileAppendLog(".audit", { keyOf: cqrsEventKeyOf }),
]);

// Reactive-log audit (gate, queue, dispatches, invocations, etc.)
queue.events.attachStorage([
  fileAppendLog(".audit", { keyOf: jobEventKeyOf }),
]);
```

**Composition rules:**

- **Tier count is the user's call.** Single tier (just memory, just file),
  two tier (memory + file), N-tier (memory + file + remote). Snapshot only,
  append-only, or fan out to both. The framework doesn't recommend a
  combination — pick the latency / durability profile that fits.
- **Read order.** First tier in the array is checked first. The
  primitive's wiring layer (`graph.attachStorage`,
  `reactiveLog.attachStorage`, `cqrs.attachEventStorage`) iterates tiers
  in order on the pre-load path and stops at the first hit; userspace
  code that fans reads across multiple tiers walks the array the same
  way. Put the fastest tier first. **Cross-tier merge for append-log
  reads is not in v0.1** — first-tier-wins is the only mode; users who
  need to fold entries from multiple tiers iterate explicitly today.
- **Per-tier baseline.** Each tier tracks its own pending state and last
  fingerprint. A cold tier's diff is against its own last save, not the
  hot tier's. No cross-tier contamination.
- **Debounced writes are independent.** Sync tiers (`debounceMs === 0`)
  flush at every wave-close. Debounced tiers fire on their own timer; one
  debounce window covers N waves.
- **`filter?` skips wholesale.** A snapshot tier whose `filter` returns
  `false` skips the save entirely.
- **`compactEvery: N` forces flush.** Useful for append-log tiers — caps
  the buffer at N entries regardless of debounce.

**Transaction model — "one wave = one transaction":**

Every storage tier exposes `flush?()` and `rollback?()` lifecycle hooks
called by the framework:

- `save(snapshot)` / `appendEntries(entries)` adds to an in-memory buffer
  (does NOT persist immediately when debounced).
- After a successful wave (or `batch()` close), the framework calls
  `tier.flush()` on each attached tier to commit pending writes.
- On wave-throw, the framework calls `tier.rollback()` to discard pending
  writes — pairs with the spec-level `batch()` rollback (see §29 below).
- If `debounceMs > 0`, `flush()` is deferred until the debounce timer
  fires; the buffer accumulates across waves and the transaction-of-record
  extends to the debounce boundary.
- If `compactEvery: N`, flush is forced every N buffered writes regardless
  of debounce.

**Cross-tier atomicity is best-effort.** Each tier is its own transaction.
If tier A flushes successfully and tier B fails, partial persistence
results. The default contract is "every tier flushes independently;
errors surface via `options.onError`." Callers needing strict cross-tier
atomicity build a transactional adapter that internally coordinates flush
across multiple backends (e.g., one SQL transaction wrapping snapshot +
append).

**Codec parameterization:**

`Codec<T>` is the (de)serialization shim between tier-level `T` and
backend-level bytes. Built-in `jsonCodec` covers most cases; users
register others (`dag-cbor`, etc.) via `defaultConfig.registerCodec(codec)`
before first node.

```ts
import { createDagCborCodec } from "@graphrefly/graphrefly-ts";
import * as dagCbor from "@ipld/dag-cbor";

defaultConfig.registerCodec(createDagCborCodec(dagCbor));

// Pass an explicit codec at tier construction:
fileSnapshot<MyState>(dir, { codec: createDagCborCodec(dagCbor) });
```

The v1 envelope carries the codec name + version so the read side doesn't
need prior knowledge of which codec produced the bytes.

**`keyOf` recommended exports.** Each primitive that emits audit /
event records exports a default `keyOf` for partitioning:

| Primitive | Recommended `keyOf` | Default partitions by |
|---|---|---|
| `cqrs.attachEventStorage` | `cqrsEventKeyOf` | `${type}::${aggregateId ?? "__default__"}` |
| `gate.decisions.attachStorage` | `decisionKeyOf` | `action` (`approve`/`reject`/`modify`/...) |
| `queue.events.attachStorage` | `jobEventKeyOf` | `action` (`enqueue`/`claim`/`ack`/`nack`) |
| `cqrs.dispatches.attachStorage` | `dispatchKeyOf` | `commandName` |
| `saga.invocations.attachStorage` | `sagaInvocationKeyOf` | `eventType` |
| `processManager.instances.attachStorage` | `processInstanceKeyOf` | `correlationId` |

Users override with custom `keyOf` if their storage strategy differs
(e.g., partition by `id` instead of `action`).

**What doesn't change:** in-memory records stay JS objects throughout the
pipeline. Codec encoding happens only at the Layer 1 boundary. Memory
tiers / test fixtures don't involve a codec — everything stays as JS
values.

### 28. Factory-time seed pattern (multi-dep push-on-subscribe)

**The fix.** Capture the dep's `.cache` at wiring time (sanctioned as an
external-observer boundary read per foundation-redesign §3.6), stash in a
closure, update via a subscribe handler, read the closure inside the reactive fn:

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
closure variable, not a `.cache`. This is the pattern used by `stratify`'s
`latestRules`, `budgetGate`'s `latestValues`, `gate()`'s `latestIsOpen`, and
`distill`'s `latestStore`.

**Why it's needed.** When a compute node has multiple `state()` deps,
`_activate` subscribes them sequentially. Each push-on-subscribe fires **as
its own wave** — they don't coalesce. Any operator fn that emits only on
"primary fired this wave" silently drops the initial paired emission.

**Symptom.** `verified.cache === null` after `verifiable(state(2), trigger)`;
`store.has("seed")` returns false after `distill(state("seed"), ...)`. Both
are caused by `withLatestFrom` losing the first paired emission under
`state()` + `state()` deps on initial activation.

**When `withLatestFrom` is still fine.** When the primary has no initial
cached value, or you only care about run-time emissions (not push-on-subscribe),
`withLatestFrom` works as documented.

**Why not fix `withLatestFrom` directly?** A naïve dep-order flip breaks
topology-sensitive diamond callers. A broader fix needs audit of all in-tree
diamond topologies. Tracked in `docs/optimizations.md`.

---

### 29. Multi-agent handoff pattern

**Context.** The "handoff" is the dominant mental model for multi-agent routing
(popularized by OpenAI Agents SDK, CrewAI, AutoGen). GraphReFly's harness loop
(§9.0) already implements handoffs — this section names the patterns explicitly
so newcomers recognize them.

**Two handoff modes:**

| Mode | Mechanism | Use when |
|------|-----------|----------|
| **Full handoff** | Triage `promptNode` routes to specialist queue via TopicGraph fan-out; specialist becomes the active agent for the rest of the task | Specialist should own the response; prompts stay focused |
| **Agent-as-tool** | Manager `promptNode` calls a specialist `promptNode` as a bounded subtask tool; manager retains control and combines outputs | Manager needs to synthesize multiple specialist results |

**Full handoff wiring:**

```ts
// Triage outputs a routing decision
const triageNode = promptNode(graph, "triage", {
  prompt: (item) => `Classify: ${item.summary}. Route to: codefix | docs | investigate`,
  deps: [intakeTopic.latest],
  model: adapter,
  output: "json",
});

// Fan-out to specialist queues based on triage result
const codeFix = derived([triageNode], (result) =>
  result.route === "codefix" ? result : undefined,
);
const docsfix = derived([triageNode], (result) =>
  result.route === "docs" ? result : undefined,
);

// Each specialist is its own promptNode consuming from its queue
const codeFixAgent = promptNode(graph, "codefix-agent", {
  prompt: (item) => `Fix this code issue: ${item.summary}\n${item.evidence}`,
  deps: [codeFix],
  model: adapter,
});
```

The `TopicGraph` + `SubscriptionGraph` infrastructure (cursor-based, independent
pace) is GraphReFly's native handoff channel. The specialist doesn't "become
active" imperatively — it's always wired, it just doesn't fire until data arrives.

**Agent-as-tool wiring:**

```ts
// Specialist wrapped as a tool
const researchTool = {
  name: "research",
  description: "Deep-dive research on a topic",
  parameters: { query: { type: "string" } },
  execute: async (args) => {
    // Fire specialist promptNode and await result
    researchInput.down([[DATA, args.query]]);
    return firstValueFrom(researchOutput);
  },
};

// Manager can call the specialist as one of its tools
const managerAgent = promptNode(graph, "manager", {
  prompt: "You are a project manager. Use tools to gather info, then synthesize.",
  deps: [userInput],
  model: adapter,
  tools: [researchTool, lintTool, testTool],
});
```

**Context transfer on handoff.** Use `agentMemory` shared between agents — the
specialist reads the same memory store the triage agent wrote to. No explicit
"context object" passing needed; the graph IS the shared state.

**Relation to harness stages.** The 7-stage loop (INTAKE→TRIAGE→QUEUE→GATE→
EXECUTE→VERIFY→REFLECT) is a chain of handoffs with gates between them. Each
stage "hands off" to the next via its output topic. The strategy model makes
future handoff routing better over time — no other framework has this.

---

### 30. Parallel guardrail pattern (optimistic execution + cancel)

**Context.** OpenAI Agents SDK popularized "parallel guardrails" — the agent
starts executing concurrently with the guardrail check; if the guardrail trips,
the agent is cancelled mid-execution. GraphReFly implements this natively via
`switchMap` + `AbortSignal` (shipped in §9.0 `gatedStream`).

**The pattern:**

```
input ──→ streamingPromptNode ──→ streamTopic ──→ contentGate(classifier)
              │                        │                    │
              │                        └─→ thinkingRenderer │
              │                                             ▼
              └──── cancel (AbortSignal) ◄──── tripwire fires
```

**Wiring:**

```ts
// Agent executes optimistically (starts immediately)
const agentStream = streamingPromptNode(graph, "agent", {
  prompt: dynamicPrompt,
  deps: [userInput],
  model: adapter,
  stream: true,
});

// Guardrail runs concurrently on the same stream
const safety = contentGate(agentStream.streamTopic, toxicityClassifier, {
  threshold: 0.7,
});

// On tripwire: cancel in-flight generation
const guarded = gatedStream(agentStream, {
  gate: safety,           // 'allow' | 'review' | 'block'
  onBlock: "cancel",      // AbortController.abort() kills generation
  onReview: "hold",       // pause output, wait for human gate.approve()
});
```

**Three execution modes (all supported today):**

| Mode | Mechanism | Cost/latency tradeoff |
|------|-----------|----------------------|
| **Blocking** | `gate` before `promptNode` — agent doesn't start until guardrail passes | Zero wasted tokens; adds guardrail latency |
| **Parallel** (optimistic) | `gatedStream` + cancel — agent starts immediately, cancelled if guardrail trips | May waste partial generation tokens; zero added latency on pass |
| **Post-hoc** | `contentGate` after completion — checks final output, rejects or rewrites | Full generation cost; only useful for output validation |

**When to use parallel mode:**
- Guardrail is fast (cheap model / regex / embedding similarity)
- Agent is expensive (large model, long generation)
- Tripwire rate is low (< 5% of inputs are malicious)
- Acceptable to waste partial tokens on the rare trip

**When to use blocking mode:**
- Agent has side effects (tool calls that can't be undone)
- Cost is critical (pay-per-token with tight budget)
- Tripwire rate is high (untrusted input source)

**Relation to `valve` vs `gate`:**
- `valve` (boolean flow control) → blocking guardrail (auto, no human)
- `gate` (human approval) → blocking with human review
- `gatedStream` + cancel → parallel guardrail (optimistic)
- `contentGate` + downstream check → post-hoc guardrail

---

### 31. Dynamic tool selection (reactive tool availability)

**Context.** In multi-agent systems, the set of available tools should change
based on system state — budget depletion removes expensive tools, policy
violations disable destructive tools, pipeline stage determines which tools
are relevant. Static tool lists miss this. (Inspired by "Logit Masking" pattern
from structured-output defense literature.)

**The pattern:**

```ts
// All possible tools registered globally
const allTools: Tool[] = [searchTool, writeTool, deleteTool, llmTool, ...];

// Constraints are reactive nodes
const budgetRemaining = derived([costMeter], (cost) => cost.total < budget);
const destructiveAllowed = derived([policyNode], (p) => p.allowDestructive);
const stageTools = derived([currentStage], (stage) => STAGE_TOOL_MAP[stage]);

// Tool selector composes constraints reactively
const availableTools = derived(
  [budgetRemaining, destructiveAllowed, stageTools],
  (hasBudget, canDestruct, stageSet) =>
    allTools.filter((t) => {
      if (!hasBudget && t.meta?.expensive) return false;
      if (!canDestruct && t.meta?.destructive) return false;
      if (stageSet && !stageSet.includes(t.name)) return false;
      return true;
    }),
);

// promptNode receives reactive tool list
const agent = promptNode(graph, "agent", {
  prompt: taskPrompt,
  deps: [userInput],
  model: adapter,
  tools: availableTools,  // Node<Tool[]> — re-evaluated each turn
});
```

**Key properties:**
- **Reactive:** tool list updates mid-conversation as state changes
- **Composable:** each constraint is an independent node; add/remove freely
- **Observable:** `describe(availableTools)` shows current tool set + why
- **Auditable:** `observe(availableTools)` logs every tool-set change

**Relation to tool interception (§11, Composition C):**
- Tool **selection** controls what's offered to the LLM (pre-generation)
- Tool **interception** gates what's executed after LLM chooses (post-generation)
- Both compose: selection narrows the menu, interception validates the order

**Anti-pattern:** Don't use tool selection as a security boundary alone. An
LLM can hallucinate tool calls not in its offered set. Always pair with
`toolInterceptor` for enforcement. Selection is UX (reduce confusion);
interception is security (prevent unauthorized execution).

---

### 32. State-mirror pattern — cross-wave reset checkpoints

**Context.** Some upstream nodes hold cache that persists across logical
"runs" of a higher-level operation, with no built-in reset path. The most
common case is a `switchMap` output: each new outer DATA causes switchMap
to subscribe a fresh inner, but the OUTPUT node's cache stays at the last
DATA the prior inner emitted. There's no "clear" semantic on switchMap
output — caches are carried forward indefinitely.

When a downstream consumer needs to distinguish "currently active inner
emission" from "stale cache from a prior session," depending directly on
the switchMap output is unsafe — the consumer can resolve with cached
state from a prior session. The fix: introduce a `state()` mirror that the
session boundary explicitly resets, and depend on the mirror.

**Worked example (from `agentLoop`).**

```ts
// llmResponse is a switchMap output — its cache survives across run() calls.
const llmResponse = switchMap(promptInput, (input) => fromAny(adapter.invoke(input)));

// State mirror: gets reset to null at every new run() boundary.
const lastResponseState = state<LLMResponse | null>(null, { name: "lastResponse" });

const effResponse = effect([llmResponse], ([resp]) => {
  batch(() => {
    lastResponseState.emit(resp);   // mirror tracks current session response
    statusNode.emit("done");         // drives terminalResult
  });
});

// terminalResult depends on the MIRROR, not the producer — so when run()'s
// reset batch nulls the mirror, a subsequent status="done" emission (e.g.
// from an abort path) reads `resp = null` and emits ERROR(AbortError) instead
// of resolving with the prior session's cached response.
const _terminalResult = derived([lastResponseState, statusNode], ([resp, stat]) => {
  if (stat === "done" && resp != null) return resp;
  if (stat === "done" && resp == null) throw new Error("aborted");
  return null;
});

// In the public run() method:
async run(input?: string, signal?: AbortSignal): Promise<LLMResponse | null> {
  batch(() => {
    this.turn.emit(0);
    this.aborted.emit(false);
    this.status.emit("idle");
    this.lastResponse.emit(null);  // ← LOAD-BEARING: the actual reset
  });
  // … kick the session, await terminalResult …
}
```

**Why this works.** `llmResponse.cache` would still hold the prior
session's response after the reset batch — switchMap output has no reset.
But the mirror is a `state()` node, which DOES reset cleanly. The reset
batch nulls it. The next `effAbort` → `status.emit("done")` wave fires
`terminalResult`'s fn with `resp = null`, which throws AbortError instead
of resolving with stale data.

**Key properties:**
- **Reset is the point.** The mirror exists so the session boundary has a
  reset target. Without the mirror, `terminalResult` would see whatever
  `llmResponse` last cached, with no clean way to invalidate.
- **Reactive-compliant.** No imperative queue, no `.cache` reads inside
  callbacks. The mirror is a real state node; dependents depend on it via
  constructor-declared deps (§24 edges are derived).
- **Visible in `describe()`.** The mirror surfaces as a node with its own
  edges — future auditors can see the "checkpoint" shape in the graph
  structure.

**When to use.** Whenever a downstream consumer's correctness depends on
distinguishing "fresh value for THIS session" from "leftover cache from a
prior session," AND the upstream is a `switchMap` / `producer` / external
boundary that doesn't accept a reset signal. The checklist:
1. Upstream cache survives session boundaries.
2. A reset event (new run, new turn, abort) needs to invalidate
   downstream's view of that cache.
3. Downstream `derived` would otherwise re-evaluate against stale upstream
   cache and emit a wrong DATA.

If any of (1)–(3) doesn't hold, depend on the producer directly — the
mirror adds one node and equals-dedup layer for no benefit.

**Verified by:** the agentLoop QA C3 regression tests (`run() with
pre-aborted signal rejects AbortError` and `second run() with pre-aborted
signal rejects AbortError (no stale response leak)`) — both fail when
`_terminalResult` is rewired to depend on `llmResponse` directly.

---

#### Historical note: the mid-wave hazard hypothesis

Earlier versions of this section (and the `agentLoop` source comment)
described §32 as a fix for a **mid-wave** "stale peer-read" hazard: when
`effResponse`'s nested `batch(() => statusNode.emit("done"))` fires inside
`llmResponse`'s outer wave, terminalResult's status dep would settle while
its `llmResponse` dep was still pending in the outer sink iteration —
terminalResult's fn would run with stale `prevData[llmResponse]`.

A focused investigation on 2026-04-25 confirmed **this hazard does not
actually reproduce on the current substrate**. The `_dirtyDepCount` gate
in `_maybeRunFnOnSettlement` already blocks the dependent's fn from
running while ANY peer dep is still DIRTY for the in-flight wave. When
`effResponse`'s nested batch fires `status.emit("done")` mid-iteration:
- terminal's status dep settles
- terminal's `llmResponse` dep is still DIRTY (Phase 1 marked it, Phase 2
  hasn't reached it yet)
- The fn does NOT run
- Phase 2 then visits terminal, settles the `llmResponse` dep, fn runs
  once with both peers consistent

Verification artifacts:
- The agentLoop multi-turn test (`executes tool calls and loops`) passes
  with the mirror reverted to `[statusNode, llmResponse]` — the canonical
  trigger pattern doesn't fire the bug.
- Fast-check invariant `#12b nested-drain-peer-consistency-compound`
  exercises the switchMap-upstream shape and passes on bare substrate.

So the framework-level options that this section once flagged as
"deferred" — `_emit` defer, Versioned emission tagging — are **not
needed**. The protocol layer is correct as-is. The state-mirror pattern
remains the right pattern, but the right *reason* is cross-wave reset
semantics (above), not protocol-layer mid-wave consistency.

---

### 33. `frozenContext` — prefix-cache-friendly snapshot

**Context.** LLM providers (Anthropic, OpenAI, Google) charge a discount and
return faster on tokens that match a previously-sent prefix. Long-running
harness loops typically include heavyweight context — `agentMemory` summary,
stage history, user profile — in every system prompt. If that context is a
reactive node whose value drifts on every change, the prefix cache is
invalidated on every turn and the discount disappears.

**Pattern.** Wrap the drifting source in `frozenContext(source, opts?)` so
downstream `promptNode` / `agentLoop` consumers see a stable snapshot. The
snapshot only re-materializes when an explicit `refreshTrigger` fires (or
on graph-wide `INVALIDATE` for the single-shot variant) — coarse-grained
refresh keeps 90%+ prefix cache hits while context stays useful.

```ts
import { frozenContext, promptNode } from "@graphrefly/graphrefly/patterns/ai";
import { fromCron } from "@graphrefly/graphrefly";

// Single-shot: read once on first activation, never refresh.
// Use for session-start snapshots that must stay byte-stable for the
// lifetime of the loop.
const sessionContext = frozenContext(memory.context);

// Refresh-on-trigger: re-materialize only when the trigger fires.
// Source-only drifts (memory writes, store mutations) are silently held.
const stageContext = frozenContext(memory.context, {
  refreshTrigger: fromCron("*/30 * * * *"),  // every 30 min
});

const reply = promptNode({
  context: stageContext,
  // ...
});
```

**Two modes, one primitive:**

| Mode | When `refreshTrigger` is | Refresh fires on |
|------|--------------------------|------------------|
| Single-shot | omitted | first activation only (+ graph-wide `INVALIDATE` escape hatch) |
| Refresh-on-trigger | a `Node<unknown>` | each `DATA` from the trigger; source-only drifts are held |

**Trade-off.** Slightly stale context vs. prefix cache hit rate. The
freshness window is bounded by your refresh cadence — pick a cron / stage
transition that matches how stale the context can be without affecting
correctness. Memory writes that MUST be visible immediately should bypass
`frozenContext` and be wired as a separate reactive dep on the consumer.

**Composes with:** `agentMemory.context`, `promptNode.context`, `agentLoop`'s
system prompt slot. The frozen value flows through `derived` / `effect`
edges normally — `describe()` shows the snapshot node and its trigger
upstream, so the cache shape is inspectable.

**Pairs with §28 (factory-time seed)** for the "captured at wiring time, kept
fresh by subscribe" pattern: `frozenContext` is the explicit primitive when
the freshness needs to be a first-class graph node rather than a closure
mirror.

---

### 34. `handoff` primitive — reactive sugar over §29

**Context.** §29 names the two handoff modes (full handoff vs agent-as-tool)
and shows them wired manually. The `handoff(from, toFactory, opts?)` sugar
is the named primitive for the **full handoff** mode — a reactive route
from one agent's output into a specialist factory, with an optional
condition gate.

**Use the sugar when:**
- The specialist's lifetime is "active while condition is open."
- The triage / source agent's output is the input the specialist consumes.
- You want describe() to clearly show the handoff edge.

**Use the manual §29 wiring when:**
- The handoff is one-of-many fan-out (multiple specialists from one source);
  use a `TopicGraph` + per-route `derived` filter instead.
- The specialist needs a transformed input (combine source with other
  reactive deps before handing off); compose `derived` then call `handoff`
  on the combined node.

**Shape:**

```ts
import { handoff, promptNode } from "@graphrefly/graphrefly/patterns/ai";

// Triage node decides urgency.
const triage = promptNode(adapter, [userMessage], (msg) =>
  `Classify urgency of: ${msg}. Reply "high" or "normal".`);
const isUrgent = derived([triage], ([v]) => v === "high");

// `handoff` routes userMessage into the specialist when isUrgent is true;
// passes through `userMessage` directly when isUrgent is false.
const specialist = handoff(
  userMessage,
  (input) => promptNode(specialistAdapter, [input], (m) =>
    `Respond urgently: ${m}`),
  { condition: isUrgent },
);
```

**Lifecycle.** The specialist factory is called per source emission via
`switchMap` — each `v != null` DATA on `from` allocates a fresh
`state<T>(v)` and invokes `toFactory`; switchMap supersede cancels the
prior branch. For per-turn routing (≤ 1 emit/sec) this is negligible. For
high-frequency sources, batch upstream via `audit` / `throttle` /
`distinctUntilChanged` before the `handoff`.

**Context transfer.** The specialist sees only the value `from` emits. To
share `agentMemory` / tool registries, wire them as additional reactive
deps INSIDE the `toFactory` closure — same memory bundle threaded into
both triage and specialist makes the handoff context-preserving without
explicit "context object" passing (§29's "the graph IS the shared state"
principle applies).

**Agent-as-tool handoff stays manual.** Register a `promptNode` instance as
a `ToolDefinition` on the parent's `toolRegistry`. No new primitive needed
— the tool registry IS the bounded-subtask channel.

---

### 35. Imperative-controller-with-audit pattern

**Context.** Five primitives across orchestration / messaging / job-queue /
CQRS share the same shape: imperative mutations holding closure state,
emitting a reactive audit log, with rollback-on-throw and freeze-at-entry.
Rather than a base class, the library ships **helpers** in
`patterns/_internal/imperative-audit.ts`.

| Primitive | Mutation methods | Audit log | `keyOf` export |
|---|---|---|---|
| `pipeline.gate` | `approve` / `reject` / `modify` / `open` / `close` | `decisions: ReactiveLogBundle<Decision>` | `decisionKeyOf` |
| `JobQueueGraph` | `enqueue` / `claim` / `ack` / `nack` / `removeById` | `events: ReactiveLogBundle<JobEvent>` | `jobEventKeyOf` |
| `CqrsGraph.dispatch` | `dispatch(name, payload)` | `dispatches: ReactiveLogBundle<DispatchRecord>` | `dispatchKeyOf` |
| `CqrsGraph.saga` | per-event handler invocation | `invocations: ReactiveLogBundle<SagaInvocation>` | `sagaInvocationKeyOf` |
| `processManager` | `start` / `cancel` / step transitions | `instances: ReactiveLogBundle<ProcessInstance>` | `processInstanceKeyOf` |

Every primitive also exposes a `.audit` property pointing at the same
bundle. Tools that traverse `.audit` work uniformly across primitives;
domain code uses the readable name.

**Helpers (internal):**

- `createAuditLog<R>(opts)` — wraps `reactiveLog` with audit defaults:
  bounded `retainedLimit = 1024`, `DEFAULT_AUDIT_GUARD` denies external
  writes, `withLatest()` activated.
- `wrapMutation<TArgs, TResult, R>(action, opts)` — surrounds a closure
  mutation with: freeze-at-entry (`Object.freeze(structuredClone(args))`),
  open `batch()` frame, run action, append `onSuccess(args, result, meta)`
  audit record on success; on throw, **rolls back the in-band batch** and
  appends a separate failure record OUTSIDE the rolled-back transaction,
  then re-throws.
- `registerCursor(graph, name, initial)` — promotes a closure counter
  (e.g. `_seq`) to a state node mounted under `graph` for observability.
- `registerCursorMap(graph, name, keys, initial?)` — promotes a closure
  `Map<K, number>` to N state nodes (used by saga's per-event-type cursor).
- `DEFAULT_AUDIT_GUARD` — denies external `write`, allows `observe` /
  `signal` (constants from `core/guard.ts`).

**Rollback-on-throw — two layers, with one limit:**

1. **Helper-level:** `wrapMutation` catches throws inside an open
   `batch()`. The throw aborts the batch, which discards
   `drainPhase2`/`drainPhase3`/`drainPhase4` work for that frame —
   downstream consumers never see the in-band emissions. The failure
   record is appended OUTSIDE the rolled-back batch so the audit trail
   still captures the failed attempt with `errorType` set. The cursor
   advance from `seq?` is bumped INSIDE the batch and rolled back too,
   so the audit-log seq stays in sync with successful invocations.
2. **Spec-level (core `batch.ts`):** Universal protection — any user code
   that throws inside `batch(() => …)` triggers the same rollback. Helpers
   layer on top; user-authored imperative code gets the same guarantee.

**What rollback does NOT cover.** The `batch()` rollback discards
**reactive emissions** (anything that flowed through `node.down(...)` /
`node.emit(...)`) and the `seq` cursor. It does **not** roll back
**closure-state mutations** the action performed — array splices,
`Map.set`, counter increments via plain JS, etc. Author the action so
those mutations happen *after* potentially-throwing work, or treat them
as committed and recover in `onFailure`. Example: gate's
`modifyImpl` dequeues items via `queue.splice()` *before* calling the
user-supplied `fn`; if `fn` throws, the splice has already happened, so
those items are gone from the pending queue regardless of rollback. This
is the documented contract — keep it in mind when authoring new
`wrapMutation`-backed primitives.

**Saga error policy** is the one variation. Per-event handler invocations
in `saga(name, eventNames, handler, { errorPolicy })`:
- `"advance"` (default) — failure is recorded; cursor moves past the
  failing event so subsequent events still process.
- `"hold"` — cursor stops at the failure; subsequent events are NOT
  processed until the handler stops throwing.

**`.audit` is property duplication, not a getter.** Set once in the
constructor: `this.audit = this.decisions;`. No getter overhead, no
method-call ergonomics, clean readonly property.

**Storage attach via the bundle.** Storage tiers attach directly to the
audit log bundle with the recommended `keyOf`:

```ts
queue.events.attachStorage([
  fileAppendLog(".audit", { keyOf: jobEventKeyOf }),
]);

cqrs.dispatches.attachStorage([
  fileAppendLog(".audit", { keyOf: dispatchKeyOf }),
]);
```

**Don't** roll your own:

- Imperative mutation that should atomically emit + audit → use
  `wrapMutation`.
- Closure counter that needs to appear in `describe()` or persist across
  restarts → use `registerCursor` (or `registerCursorMap` for keyed sets).
- New primitive joining the family → expose `.<domain>` (the named bundle)
  and `.audit` (the alias). Stamp records via `wrapMutation`'s
  `onSuccess` / `onFailure` callbacks. Export a `keyOf` for the record
  shape.

---

### 36. Process manager pattern

**Context.** `cqrs.saga` handles **synchronous** side effects per event;
`cqrs.command + dispatch` is **one-shot**. Long-running async stateful
workflows that correlate events across aggregates with retries and
compensation need a separate primitive — `processManager` in
`patterns/process/`.

**Use a process manager when:**
- The workflow has multiple steps spread across time (minutes, hours, days).
- Per-instance state must survive across event arrivals.
- Events from multiple aggregates correlate via `correlationId`.
- You need retry-with-backoff or compensating actions on failure.
- Step bodies may be async (HTTP calls, queue publishes, sleeps).

**Don't use a process manager when:**
- The reaction is one-shot, sync, no per-instance state → use `saga`.
- It's a linear pipeline with no cross-aggregate correlation → use
  `jobFlow`.
- The workflow is expressed naturally as a graph of `derived` / `effect`
  nodes → just compose primitives directly.

**Differences from saga and jobFlow:**

| Primitive | Sync/async | Per-instance state | Cross-aggregate correlation | Timer/scheduling | Compensation | Use case |
|---|---|---|---|---|---|---|
| `cqrs.saga` | sync | none | aggregate filter (single) | none | error policy only | sync side effects per event |
| `jobFlow` | sync or async (`work` hook) | per-job | none | none | nack on error | linear queue chain pipelines |
| `processManager` | sync or async | per-correlation | yes (across aggregates) | yes | full compensation | long-running multi-step workflows |

**Shape:**

```ts
import { processManager, type ProcessStepResult } from
  "@graphrefly/graphrefly/patterns/process";

type FulfillmentState = {
  step: "awaiting-payment" | "awaiting-shipment" | "complete";
  orderId: string;
  paid?: boolean;
  shipped?: boolean;
};

const fulfillment = processManager<FulfillmentState, MyEventMap>(cqrs, "fulfillment", {
  initial: { step: "awaiting-payment", orderId: "" },
  watching: ["paymentReceived", "shipmentSent"],
  steps: {
    paymentReceived: (state, event) => {
      if (state.step !== "awaiting-payment") {
        return { kind: "continue", state };
      }
      return {
        kind: "continue",
        state: { ...state, step: "awaiting-shipment", paid: true },
        emit: [{ type: "shippingRequested", payload: { orderId: state.orderId } }],
        schedule: { afterMs: 60_000 * 30, eventType: "shipmentTimeout" },
      };
    },
    shipmentSent: (state) => ({
      kind: "terminate",
      state: { ...state, step: "complete", shipped: true },
    }),
  },
  compensate: async (state, error) => {
    if (state.paid && !state.shipped) {
      await issueRefund(state.orderId);
    }
  },
  retryMax: 3,
  backoffMs: [100, 500, 2_000],
  handlerVersion: { id: "fulfillment", version: "2.1.0" },  // Audit 5
});

// Start an instance.
fulfillment.start("order-123", { orderId: "order-123" });

// Or cancel one in flight (triggers compensate).
fulfillment.cancel("order-123", "user-requested");
```

**Discriminated union step result.** Every step returns one of:

```ts
type ProcessStepResult<TState> =
  | { kind: "continue"; state: TState; emit?: ...; schedule?: ProcessSchedule }
  | { kind: "terminate"; state: TState; emit?: ...; reason?: string }
  | { kind: "fail"; error: unknown };          // triggers compensate
```

`continue` advances state and optionally emits side-effect events / schedules
a timer. `terminate` archives the instance. `fail` (or a thrown step) runs
the user-supplied `compensate` handler and marks the instance compensated.

**Synthetic event types** namespace the per-process lifecycle stream.
The current implementation reserves the `_process_<name>_*` prefix and
emits `_process_<name>_started` per `start()` call as an event-sourced
audit trail; future state-snapshot and timer-event channels (`_state`,
`_timer`) are reserved by the same prefix. Avoid user event-type names
starting with `_process_` to prevent collisions even today.

Side-effect events (`result.emit`) dispatch under the user-declared event
type — they're not namespaced. Scheduled events (`result.schedule`) fire
under the user-supplied `eventType`, not a synthetic timer type.

**Persistence (Audit 4 wiring).** Pass `eventStorage` tiers via
`opts.persistence` — the started-event stream (and any future synthetic
streams) is persisted via `cqrs.attachEventStorage`, so process audit
trail survives restarts:

```ts
processManager(cqrs, "fulfillment", {
  // ...
  persistence: {
    eventStorage: [fileAppendLog(".processes", { keyOf: cqrsEventKeyOf })],
  },
});
```

**Audit log** — `result.instances` (and `result.audit` alias) is a
`ReactiveLogBundle<ProcessInstance>` per Audit 2. Recommended `keyOf` for
storage partitioning is `processInstanceKeyOf` (partitions by
`correlationId`).

**Concurrency safety.** Multiple events for the same `correlationId`
serialize through the step pipeline — the second event waits for the
first step's promise to resolve before its own step runs.
`cancel()` during an in-flight async step is single-shot: the in-flight
step completes (or rejects), but its result is discarded; compensate runs
once.

**Out of scope (post-1.0):** state-machine validation, distributed
cross-CqrsGraph correlation. Users with strict transition validation
needs construct their own (e.g., switch on `state.step` inside the step
fn and throw on impossible transitions).

---

### 37. Versioning handlers via audit metadata

**Context.** Tracking "which version of the handler produced this output"
matters for incident analysis, A/B testing, regression debugging, and
replay determinism. The library exposes versioning as **opt-in
registration metadata** stamped onto audit records — no handler-as-node
ceremony, no hot-swap atomicity contract.

**Shape:**

```ts
// CQRS command
cqrs.command("placeOrder", {
  handler: (payload, actions) => actions.emit("orderPlaced", payload),
  emits: ["orderPlaced"],
  handlerVersion: { id: "place-order", version: "1.2.0" },
});

// CQRS saga
cqrs.saga("orderProcessor", ["orderPlaced"], handler, {
  errorPolicy: "advance",
  handlerVersion: { id: "order-processor", version: "1.0.0" },
});

// jobFlow stage
jobFlow("pipeline", {
  stages: [
    { name: "process", work: workFn,
      handlerVersion: { id: "process-stage", version: "2.0.0" } },
  ],
});

// pipeline.catch
pipeline.catch("recover", src, recoverFn, {
  on: "error",
  handlerVersion: { id: "recover-strategy", version: "1.0" },
});

// processManager
processManager(cqrs, "fulfillment", {
  // ...
  handlerVersion: { id: "fulfillment", version: "2.1.0" },
});
```

The version is stamped onto the corresponding audit record — every
`DispatchRecord`, `SagaInvocation`, `JobEvent`, `Decision`, or
`ProcessInstance` produced by the handler carries the matching
`handlerVersion: { id, version }` triple.

**`BaseAuditRecord.handlerVersion`** is the canonical field
(`patterns/_internal/imperative-audit.ts`). Every audit record extends
this base; the field stays optional so callers who don't care don't need
to pass anything.

**Conventions:**
- `id: string` — stable identifier (e.g., `"place-order-handler"`).
- `version: string | number` — semver string (`"1.2.0"`), build number
  (`42`), or git SHA (`"abc1234"`). User-supplied; the library doesn't
  hash function bodies (cross-runtime flakiness, surprising behavior).

**What versioning is for:**

| Use case | How it helps |
|---|---|
| Incident analysis | "Which dispatch records produced bad output?" → grep audit log by `handlerVersion.id + version`. |
| A/B testing | Wire two handler versions behind a feature flag; the audit log stamps which version was active per record. |
| Regression debugging | Bisect `version` values until you find when a behavior broke. |
| Compliance | "Reproduce the decision" — record the version + the audit record's payload, replay later. |

**Hot-swap is intentionally NOT a library feature.** Production hot-swap
happens via deploy, not runtime mutation. Hot-swap atomicity has subtle
issues (in-flight calls, version skew across replicas). Users who
genuinely need runtime swap construct their own indirection in user code:

```ts
let currentHandler = handlerV1;
cqrs.command("placeOrder", {
  handler: (p, a) => currentHandler(p, a),
  emits: ["orderPlaced"],
  handlerVersion: { id: "place-order", version: "ref" },
});
// Later in user code:
currentHandler = handlerV2;
```

The `handlerVersion: "ref"` is then a stable label; the user's own code
manages which body the indirection points at.

**Replay determinism stays intact.** Projection reducers are NOT
versioned at the registration site — projections always replay from the
event log via a pure reducer, and the reducer is the same code that ran
originally (deploy-time-pinned). Don't version projection reducers; do
version handlers that emit events or have side effects.

---
