# Composition Guide

> **Accumulated patterns for building factories and domain APIs on top of GraphReFly primitives.**
>
> This is NOT the spec. The spec (`GRAPHREFLY-SPEC.md`) defines **protocol behavior** — what MUST happen. This guide captures **"good to know before you fail"** — patterns, insights and recipes that composition authors (human or LLM) encounter when wiring primitives into higher-level APIs.
>
> Entries are accumulated in `composition-guide.jsonl` and summarized here. Both `graphrefly-ts` and `graphrefly-py` CLAUDE.md files reference this guide.

---

## How to use this guide

- **Before building a factory** that composes derived nodes, TopicGraphs, or gates: scan the categories below.
- **When debugging silent failures** (undefined values, missing messages, empty topics): check "Silent failure modes" first.
- **When writing tests** for composition code: see "Testing composition" for patterns.

---

## Categories

### 1. Push-on-subscribe and activation

Source nodes (state with a value) push `[[DATA, cached]]` to each new subscriber on
subscribe (spec §2.2). Derived nodes compute reactively from this push — no special
activation step needed.

**What this means for factories:** When you create a derived node depending on state
nodes that have initial values, the derived computes automatically when it gets its
first subscriber. The push cascades through the dependency chain.

**SENTINEL nodes:** A node created without `initial` (cache holds SENTINEL) does NOT
push on subscribe. Derived nodes depending on a SENTINEL dep will not compute until
that dep receives a real value via `down([[DATA, v]])`. If your factory needs derived
nodes to compute immediately, ensure all deps have initial values.

```ts
// Derived computes on subscribe — deps have initial values
const count = state(0);
const doubled = derived([count], ([v]) => v * 2);
doubled.subscribe(sink);  // sink receives [[DATA, 0]] from doubled

// Derived does NOT compute — dep has no initial value
const pending = node<string>();  // SENTINEL — no initial
const upper = derived([pending], ([v]) => v.toUpperCase());
upper.subscribe(sink);  // sink receives nothing — pending has no value
pending.down([[DATA, "hello"]]);  // NOW upper computes → sink receives result
```

**Diagnostic:** If `get()` returns `undefined`/`None`, check `node.status`:
- `"disconnected"` → no subscriber (lazy node, needs subscribe)
- `"settled"` or `"resolved"` → value is current, it really is undefined/None
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

### 3. Null/undefined guards in effects

Effect nodes fire when deps push values — including the initial push from state nodes
that hold `null`/`None`. Guard against null at the top of every effect fn that
processes structured data.

```ts
// When null IS a valid domain value (e.g. state(null)):
effect([source], ([val]) => {
  if (val == null) return;  // guard — != catches both null and undefined
  // safe to process val
});

// When "no value yet" is the intent, prefer SENTINEL instead:
const source = node<T>();  // no initial → no push → effect waits for real data
```

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
