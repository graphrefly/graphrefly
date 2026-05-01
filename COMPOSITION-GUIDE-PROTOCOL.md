# Composition Guide — Level 0: Protocol

> **Audience:** Core contributors, operator authors.
>
> Patterns and insights at the protocol layer — message flow, activation semantics, cache lifecycle, wave mechanics. These are the foundation that higher-level APIs build on.
>
> See also: [GRAPHREFLY-SPEC.md](./GRAPHREFLY-SPEC.md) for the behavioral spec. [Debugging & Testing](#debugging-composition) appendix at the end.

---

## Pattern registry

| If you're asking... | See |
|---|---|
| "Why isn't my derived computing?" | §1 (first-run gate) |
| "Why are values missing/stale?" | §1 (SENTINEL), §2 (subscription ordering) |
| "Should I emit a `null` placeholder for 'no value yet'?" | §1a (no — stay SENTINEL) |
| "Should I add a `hasValue` / `hasLatest` companion dep?" | §1a (almost never — `prevData[i] === undefined` is the answer) |
| "What's glitch-free diamond resolution?" | §9, §9a (two-phase + batch-coalescing) |
| "What's `actions.emit` vs `actions.down`?" | §21 |
| "Why is my operator leaking mid-wave emits?" | §19 (terminal-emission operators) |
| "How do I get `withLatestFrom` initial pair?" | §28 (factory-time seed) |
| "Consumer reads stale switchMap cache across session boundaries?" | §32 (state-mirror for cross-wave reset) |
| "Why can't I mix `RESOLVED` and `DATA` in the same wave?" | §41 (tier-3 wave exclusivity) |

---

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

### 1a. Stay SENTINEL for "no value yet" — don't add `hasValue` companion deps

When a node needs to signal "no real value yet," **do not emit a placeholder** (`null`, `0`, empty string, empty array passed as DATA). Stay SENTINEL — return `[]` from a derived fn for RESOLVED-only waves; omit `initial:` from a state node. SENTINEL IS the answer.

A consumer fn that needs to detect "has this dep ever delivered DATA?" reads it directly:

```ts
const data = batchData.map((batch, i) =>
    batch != null && batch.length > 0 ? batch.at(-1) : ctx.prevData[i],
);
if (data[i] === undefined) return; // dep is SENTINEL — never emitted DATA
```

`ctx.prevData[i]` is `undefined` until the dep emits its first DATA, then carries the cached value. Combined with `batchData[i]` empty, this is the canonical "no value yet" detector — already in every fn that follows the standard `batch.at(-1) ?? ctx.prevData[i]` pattern.

**Anti-pattern: eager-placeholder + companion `hasFooData: Node<boolean>` dep.**

```ts
// BAD — eagerly emits null on empty; type leaks `T | null`
this.latest = derived([events], (d) => {
    const entries = d[0] as readonly T[];
    return [entries.length === 0 ? null : entries.at(-1)!]; // ⚠
});
// Consumer must now add a sibling `hasLatest: Node<boolean>` dep to
// disambiguate "topic empty" from "topic published `null` when T includes `null`".
```

```ts
// GOOD — stay SENTINEL on empty; type stays `Node<T>`
this.latest = derived([events], (d) => {
    const entries = d[0] as readonly T[];
    return entries.length === 0 ? [] : [entries.at(-1) as T]; // ✓ RESOLVED-only on empty
});
// Consumer just guards `data[i] === undefined`. No companion dep needed.
```

**Why this keeps biting people:**
- A `T | null` type makes `null` ambiguous the moment `T` itself includes `null` — the placeholder collides with legit DATA. Same trap with `T | 0`, `T | ""`, `T | -1`, etc.
- A `hasValue` companion duplicates information already encoded in SENTINEL state. Every downstream consumer has to remember to wire it. Failure is silent — the side effect fires with the placeholder.
- The fix at the source costs one branch (`return []` instead of `return [null]`); the workaround at every call site costs N companion deps + N matching gates.

**Decision rule when designing a derived/state Node:**
- "What value should I emit when there's no real value yet?" → **none. Don't emit. Stay SENTINEL.**
- The only legitimate reason to emit a "no-value" placeholder is when `T` *requires* a non-SENTINEL initial (rare — usually a layering mistake). When it's truly required, document the placeholder semantics explicitly and ship a companion that disambiguates (e.g., `reactiveLog.hasLatest` exists because the log accepts `T = undefined` payloads at the data layer).

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

**Historical note (Phase 10.5).** The `partial: false` flip in `withLatestFrom`
(Phase 10.5) fixed the W1 initial-pair drop for the common case. Some closure-mirror
sites in `composite.ts` (verifiable, distill consolidate) were migrated to
`withLatestFrom` reactive edges post-10.5. Sites in Level-3 infrastructure
(agent-loop, pipeline-graph) retain closure-mirrors for other reasons (§7 feedback
cycles, imperative gate patterns). See the session doc for the full migration audit.

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

### 38. Naming conventions — `::` vs `/` path separators

GraphReFly uses two distinct path separators for node names. They are
not interchangeable and should not be mixed inside a single path.

**`::` — compound-factory internals.** When one factory ships multiple
sub-nodes that operate together as a single unit, the sub-nodes share a
base name and use `::` to separate the role:

```ts
// promptNode topology — three named sub-nodes from one factory
prompt_node::messages   // derived: builds ChatMessage[] from deps
prompt_node::call       // producer: per-wave LLM invocation
prompt_node::output     // switchMap product: parsed response

// suggestStrategy
suggestStrategy::call

// reduction stage
${stage.name}::input
${stage.name}::output
```

The `::` prefix matches `meta.ai.kind` filters (e.g.
`meta.ai.kind === "prompt_node::call"`) and is what
`describe({ format: "pretty" })` renders. Factory authors own the
convention; downstream tools match on the prefix.

**`/` — namespace / domain grouping.** Independent nodes that are not
sub-parts of any compound factory but belong together by topic use `/`:

```ts
pane/main-ratio
pane/side-split
viewport/width
graph/mermaid
hover/target
highlight/code-scroll
meta/debug
```

`/` reads as a path under a logical domain (filesystem-friendly mental
model). Anyone naming nodes can use it.

**Rule of thumb.** If you authored a factory that returns multiple
coordinated nodes, use `::`. If you are naming independent nodes that
just happen to live in the same domain, use `/`. Do not mix the two in
one path (avoid `pane/main::ratio`).

### 39. Function identity via meta — fn-id convention

Functions are **non-serializable**. They survive in-memory, but cannot be
round-tripped through `decompileSpec` → `compileSpec`, audit logs, or
cross-process snapshots. A graph that closes over `(deps) => deps[0] +
deps[1]` cannot tell a future replay which lambda was attached, even
though that lambda governs the node's behavior.

The convention: when fn identity matters (replay determinism, version
tracking, A/B comparison, incident analysis), the **caller** stamps an
identifier onto the node's `meta`:

```ts
import { meta } from "@graphrefly/graphrefly";

const extractor = derived([raw], extractFn, {
  meta: { ...meta.fnId("extractor::v1"), domain: "memory" },
});
```

`describe()` surfaces `meta.fnId` like any other meta field, so consumers
filtering by version (`meta.fnId === "extractor::v1"`) find the node
without holding the function reference.

**Why caller-stamped, not factory-implicit:** factories cannot synthesize
stable identifiers from function bodies — closure-state (variable
captures, environment) breaks naive `Function.prototype.toString` hashing
across runtimes. The user knows what label is meaningful for their
versioning scheme; the library just preserves whatever they stamp.

**Naming format:** `{role}::{version}` aligns with §38 (compound-factory
internals): `"extractor::v1"`, `"verifier::tier-3"`, `"reducer::2026-04-15"`.
Free-form strings work too — the convention is just for readability.

**Pairs with handler-version audit (§37).** §37 stamps version on audit
*records* (per-invocation provenance); §39 stamps version on the node
*itself* (topology-time identity). Use both when both matter.

### 41. Tier-3 wave exclusivity — `RESOLVED` and `DATA` are mutually exclusive per wave

**The rule.** Within any single wave at any single node, the tier-3 slot is
either ≥1 `DATA` *or* exactly 1 `RESOLVED` — **never mixed**. `RESOLVED`
represents "wave settled with no observable change" (the equals-substituted
form of a single `DATA`). It is not interleavable with real `DATA`
emissions in the same wave.

This is the author-facing version of the rule documented in
`GRAPHREFLY-SPEC.md` §1.3.3 "Tier-3 wave exclusivity." The spec describes
the contract; this section describes how to author fns and operators that
respect it.

**Both of these are protocol violations:**

```ts
// Mixed in a single delivery
actions.down([[DATA, v1], [RESOLVED], [DATA, v2]]);

// Mixed across deliveries to the same node within one batch frame
batch(() => {
  node.down([[RESOLVED]]);
  node.emit(v2);
});
```

**Legal shapes** (one tier-3 message kind per wave):

```ts
// Multiple DATAs in one wave
actions.down([[DATA, v1], [DATA, v2]]);
batch(() => { node.emit(v1); node.emit(v2); });

// Single DATA — equals-eval may substitute to RESOLVED at _emit
actions.emit(v1);
node.down([[DATA, v1]]);

// Explicit RESOLVED standalone (e.g. operator drop-all path)
actions.down([[RESOLVED]]);
```

**Operator convention.** Operators that drop entries from a multi-value
batch (`filter`, `take`, `skip`, `takeWhile`, `distinctUntilChanged`) emit
one `RESOLVED` only when the entire wave produces zero `DATA`. Per-dropped-
item `RESOLVED` is **not** part of the operator contract — see the current
`filter` shape at `extra/operators/index.ts`:

```ts
let emitted = false;
for (const v of batch0) {
  if (predicate(v as T)) { a.emit(v as T); emitted = true; }
}
if (!emitted) a.down([[RESOLVED]]);  // ← only when nothing passed
```

A consumer that needs per-item batch-drain accounting (e.g. tier-3
counters tracking "every input got a settlement signal") must count
**upstream** of any filtering operator, not at the operator's output.
`tap` on the upstream source is the canonical pattern; or a counter
inside the source-side fn body.

**Why this rule exists.**
- `RESOLVED` is defined as "single-DATA equals-substituted" (spec §1.3.3).
  Mixing it with real DATA breaks that semantic — a downstream observer
  cannot tell whether `RESOLVED` reflects "previous DATA was equal to
  cache" or "this wave also emitted a different DATA."
- `_frameBatch` ([core/node.ts](../graphrefly-ts/src/core/node.ts)) tier-
  sorts but does NOT enforce wave-exclusivity. Authors are responsible
  for the contract; runtime enforcement is implementation-defined.
- The rule keeps the per-wave protocol "either changed (≥1 DATA) or
  settled-unchanged (RESOLVED)" — a clean two-valued state at every
  node boundary.

**Diagnostic.** If your fn emits `actions.down([[DATA, v], [RESOLVED]])`
or interleaves them via `batch()`, downstream nodes see protocol-incorrect
input. Symptoms: spurious recompute (downstream re-runs on the trailing
RESOLVED expecting a settle but cache already advanced), or stale-cache
reads in fan-in topologies. Refactor to a single tier-3-kind per wave.

---

## Debugging composition

When a composed factory produces unexpected behavior (OOM, infinite loops, silent
failures, stale values):

### Step 1: Re-read the relevant guide

Most composition bugs are covered by an existing section:
- **OOM / infinite loop?** → Check §7 (feedback cycles) in [Graph guide](./COMPOSITION-GUIDE-GRAPH.md)
- **Undefined values?** → Check §1 (SENTINEL deps) and §3 (null guards) in [Graph guide](./COMPOSITION-GUIDE-GRAPH.md)
- **Missed messages?** → Check §2 (subscription ordering for streaming sources) above
- **promptNode not firing?** → Check §8 (SENTINEL gate) in [Patterns guide](./COMPOSITION-GUIDE-PATTERNS.md)

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
