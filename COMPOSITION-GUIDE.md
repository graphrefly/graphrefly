# Composition Guide

> **Accumulated patterns for building Phase 4+ factories and domain APIs on top of GraphReFly primitives.**
>
> This is NOT the spec. The spec (`GRAPHREFLY-SPEC.md`) defines **protocol behavior** — what MUST happen. This guide captures **"good to know before you fail"** — patterns, insights and recipes that composition authors (human or LLM) encounter when wiring primitives into higher-level APIs.
>
> Entries are accumulated in `composition-guide.jsonl` and summarized here. Both `graphrefly-ts` and `graphrefly-py` CLAUDE.md files reference this guide.

---

## How to use this guide

- **Before building a factory** that returns derived nodes, composes TopicGraphs, or wires gates: scan the categories below.
- **When debugging silent failures** (undefined values, missing messages, empty topics): check "Silent failure modes" first.
- **When writing tests** for composition code: see "Testing composition" for activation patterns.

---

## Categories

### 1. Lazy activation

Derived nodes are lazy — `get()` returns `undefined`/`None` until a downstream subscriber activates the computation chain. This is correct behavior (spec §2.2) but surfaces as a silent failure in factories.

**Pattern:** When a factory returns a derived node that callers may read via `get()` without subscribing, add a keepalive subscription internally.

```ts
// TS
function myFactory(): { node: Node<T> } {
  const result = derived([dep], fn);
  const _unsub = result.subscribe(() => {}); // keepalive
  return { node: result };
}
```

```python
# PY
def my_factory():
    result = derived([dep], fn)
    _unsub = result.subscribe(lambda _: None)  # keepalive
    return result
```

**Diagnostic:** If `get()` returns `undefined`/`None`, check `node.status`. If `"disconnected"` → no subscriber, lazy node. If `"errored"` → fn threw. Both look identical from `get()` alone. `status` (or `describe()`) distinguishes them instantly.

### 2. Subscription ordering

In reactive systems, the order you wire things determines whether you receive messages. If you subscribe to a sink *after* a source has already emitted, you miss the emission.

**Pattern:** Wire outputs (sinks, observers) before inputs (sources, emitters). In factories, wire topology in reverse: sinks → operators → sources.

```ts
// WRONG: subscribe after emit → miss the message
source.down([[DATA, 42]]);
sink.subscribe(handler);  // handler never fires for 42

// RIGHT: subscribe before emit
sink.subscribe(handler);
source.down([[DATA, 42]]);  // handler fires
```

**Escape hatch:** `TopicGraph.retained()` returns all buffered entries. If you subscribe late, you can catch up via `retained()`. This is the cursor-reading model — `SubscriptionGraph` does this automatically.

**Does `retained()` violate design invariants?** No. It's a synchronous read of existing graph state (same as `node.get()`), not polling (§5.8) or an imperative trigger (§5.9).

### 3. Null/undefined guards in effects

Effect nodes fire on initial activation when deps already hold values. If the dep's initial value is `null`/`None`/`undefined` (e.g., `state(null)`), the effect fn receives it. Guard against null at the top of every effect fn that processes structured data.

**Pattern:**

```ts
effect([source], ([val]) => {
  if (val == null) return;  // guard
  // safe to process val
});
```

### 4. Versioned wrapper navigation

`ReactiveMapBundle.node` (TS) / `.data` (PY) emits `Versioned<{ map: ReadonlyMap<K,V> }>` snapshots. The `Versioned` wrapper exists for efficient RESOLVED deduplication (compare version numbers instead of deep map equality). This is a protocol optimization that leaks into composition code.

**Pattern:** Use `.get(key)` on the bundle directly (synchronous key lookup) instead of navigating the Versioned wrapper. If you need the full map as a derived dep, unwrap it in your derived fn:

```ts
// TS
derived([_map.node], ([snap]) => {
  const map = (snap as ReactiveMapSnapshot<K, V>).value.map;
  // work with map
});
```

```python
# PY — use .data node, unwrap Versioned
derived([_map.data], lambda deps, _: deps[0].value if isinstance(deps[0], Versioned) else {})
```

**Prefer:** `bundle.get(key)` for single-key reads. Only navigate the Versioned wrapper when using the node as a reactive dep.

### 5. Graph factory wiring order

When building a factory that composes multiple stages (e.g., `harnessLoop`, `observabilityGraph`), wire in this order:

1. Create all TopicGraphs / state nodes (sinks)
2. Create derived/effect nodes that read from them (processors)
3. Subscribe / keepalive internal nodes
4. Mount subgraphs into the parent graph
5. Return the controller

This ensures that when stage N emits, stage N+1 is already wired to receive.

### 6. Cross-language data structure parity

When using `ReactiveMapBundle`, `reactiveLog`, or `reactiveList` across TS and PY:

- TS `ReactiveMapBundle` has `.get(key)`, `.has(key)`, `.size`. PY exposes `.data` (node) with `.set()` / `.delete()` / `.clear()` but no `.get(key)` (parity gap — tracked in `docs/optimizations.md`).
- Both wrap internal state in `Versioned` snapshots. The snapshot shape differs slightly: TS uses `{ version, value: { map } }`, PY uses `Versioned(version, value)` named tuple where `value` is a `MappingProxyType`.
- Always check the language-specific API rather than assuming parity.

### 7. Feedback cycles in multi-stage factories

When a downstream effect writes back to an upstream node that is a reactive dep of a derived node, the system enters an infinite loop: A → B → C → ... → write(A) → A → B → ...

**Example:** `harnessLoop` — verify stage records to `strategy.record()` → `strategy.node` changes → triage (which depends on strategy.node) re-fires → execute → verify → strategy.record() → loop.

**Pattern:** Use `withLatestFrom(trigger, advisory)` to read advisory context without making it a reactive trigger. Only the `trigger` (primary) causes downstream emission; `advisory` (secondary) is sampled silently.

```ts
// WRONG: strategy as reactive dep creates feedback cycle
const triage = promptNode(adapter, [intake.latest, strategy.node], fn);

// RIGHT: withLatestFrom — intake triggers, strategy sampled
const triageInput = withLatestFrom(intake.latest, strategy.node);
const triage = promptNode(adapter, [triageInput], fn);
```

**Why `node.get()` is not the answer:** While synchronous `get()` reads are not spec violations (COMPOSITION-GUIDE §2), `withLatestFrom` is preferable because it keeps the dependency in the reactive graph — visible to `describe()`, auditable, and consistently updated. Sync `get()` hides the relationship.

### 8. promptNode SENTINEL gate

`promptNode` gates on nullish deps and empty prompt text: if any dep value is `null`/`undefined`, or the prompt function returns falsy text, `promptNode` skips the LLM call and emits `null`. This eliminates the need for null guards in every prompt function.

**Pattern:** Return empty string from prompt functions when input is meaningless. `promptNode` handles the rest.

```ts
// promptNode's internal SENTINEL gate (already built in):
// if (values.some(v => v == null)) return [];  // dep not ready
// if (!text) return [];                         // prompt says "nothing to ask"

// For withLatestFrom tuple deps, the tuple itself is non-null.
// The prompt function must return "" when the inner item is falsy:
promptNode(adapter, [withLatestFromNode], (pair) => {
  const [item, context] = pair;
  if (!item) return "";  // triggers SENTINEL gate
  return buildPrompt(item, context);
});
```

**Relates to:** §3 (null/undefined guards in effects) — effects still need `if (val == null) return;` because they don't have the SENTINEL gate.

---

## Debugging composition

When a composed factory produces unexpected behavior (OOM, infinite loops, silent failures, stale values):

### Step 1: Re-read this guide

Most composition bugs are covered by an existing section. Before writing any fix:
- **OOM / infinite loop?** → Check §7 (feedback cycles) — is a downstream effect writing back to an upstream dep?
- **Undefined values?** → Check §1 (lazy activation) and §3 (null guards).
- **Missed messages?** → Check §2 (subscription ordering) and §5 (wiring order).
- **promptNode not firing?** → Check §8 (SENTINEL gate) — is a dep null or the prompt empty?

### Step 2: Isolate the failing scenario

Run a single test or scenario in isolation. Do not debug against the full suite — concurrent test instances obscure the signal. Narrowing to one case makes the reactive chain traceable.

### Step 3: Inspect node states

Use `describe()`, `node.status`, and profiling tools (TS: `graphProfile`, `harnessProfile`; PY: equivalent) to snapshot the graph before and after the operation.

Key diagnostics:
- **`node.status`** — `disconnected` (lazy/no subscribers), `errored` (fn threw), `settled` (value is current)
- **`describe({ detail: "standard" })`** — all nodes, edges, statuses at once
- **Profiling** — per-node memory (value size), subscriber counts, queue depths, tracker sizes

Write a diagnostic test that instruments the factory rather than adding console.logs and re-running blindly.

### Step 4: Trace the reactive chain

Once you know which node has the wrong state, trace upstream: what is its dep? What did the dep emit? Is the dep settled or still dirty? Follow the chain until you find where the expected value diverges from reality.

### Step 5: Fix the root cause

An OOM is rarely a wiring-pattern problem — it's usually a key-tracking bug, an unbounded counter, or a missing guard. Isolation and inspection (Steps 2–4) reveal which.

---

## Testing composition

### Activate before asserting

Derived nodes require a downstream subscriber to compute. In tests, always subscribe before checking `get()`:

```ts
const d = derived([dep], fn);
d.subscribe(() => {});  // activate
expect(d.get()).toBe(expected);
```

### Wire observers before emitting

```ts
const topic = new TopicGraph<T>("test");
const items: T[] = [];
topic.latest.subscribe(msgs => {
  for (const msg of msgs) {
    if (msg[0] === DATA && msg[1] != null) items.push(msg[1] as T);
  }
});
topic.publish(value);  // items now has [value]
```

### Effect + state(null) pattern

For testing effect-based bridges, use `state(null)` as the source, subscribe to the effect to activate it, subscribe to the output, then emit:

```ts
const source = state<T | null>(null);
const bridgeNode = myBridge(source, output);
bridgeNode.subscribe(() => {});  // activate
output.latest.subscribe(collector);  // wire observer
source.down([[DATA, realValue]]);    // emit
```
