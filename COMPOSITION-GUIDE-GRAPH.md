# Composition Guide — Level 1: Graph

> **Audience:** Pattern authors building domain APIs on top of Graph primitives.
>
> Guard patterns, feedback cycle avoidance, storage composition, compat bridges, and other Graph-level concerns. Assumes familiarity with [Protocol-level concepts](./COMPOSITION-GUIDE-PROTOCOL.md).
>
> See also: [GRAPHREFLY-SPEC.md](./GRAPHREFLY-SPEC.md) for the behavioral spec.

---

## Pattern registry

| If you're asking... | See |
|---|---|
| "How do I guard `null`/`undefined`?" | §3 (the only two guards) |
| "How do I break an infinite loop?" | §7 (feedback cycles) |
| "Where do I put persistent fn state?" | §20 (`ctx.store`) |
| "How do I make a rescue / error-to-fallback op?" | §23 (`errorWhenDepsError: false`) |
| "How do I tier persistence (hot/warm/cold)?" | §27 (`attachStorage`) |
| "PY test hangs for 60s then times out?" | §14 (blocking async bridge deadlock) |

---

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

**Companion-node pattern for "last value with disambiguation."** Restricted to
the data-layer primitive `reactiveLog`, where `T` may include `undefined`
(the protocol SENTINEL itself is allowed at the log layer because `append` is
unrestricted). Higher-layer surfaces (topic, queue, etc.) do NOT need the
companion pair — they reject `publish(undefined)` at the API boundary, so
SENTINEL on the latest-value node is unambiguous. See [PROTOCOL §1a](./COMPOSITION-GUIDE-PROTOCOL.md#1a-stay-sentinel-for-no-value-yet--dont-add-hasvalue-companion-deps)
for the no-companion rule at higher layers.

```ts
// reactiveLog only — the primitive that genuinely needs `T | undefined` semantics.
log.lastValue;   // Node<T | undefined> — RESOLVED on empty, never DATA(undefined)
log.hasLatest;   // Node<boolean>       — disambiguates "no entries" from "undefined was appended"
```

Both companions are **lazy** — accessing either getter (or calling
`withLatest()`) activates them; subsequent accesses return the same
nodes. They appear in `describe()` once activated, so cross-graph
explainability still resolves.

| Surface | Last-value node | Boolean disambiguation |
|---|---|---|
| `reactiveLog` bundle | `bundle.lastValue` | `bundle.hasLatest` |
| `TopicGraph<T>` | `topic.latest: Node<T>` (SENTINEL on empty) | — (use `cache === undefined` / `prevData[i] === undefined`) |

When `reactiveLog.lastValue`'s compute fn would otherwise emit `DATA(undefined)`
on the **empty-log path** (no entries yet, or post-`clear()`), it emits
`RESOLVED` instead — keeping the spec §1.2 "DATA(undefined) is not a
valid emission" invariant intact.

**Why TopicGraph dropped the companion pair (2026-04-30):** `topic.publish(undefined)` is rejected at the publish boundary, so `T` cannot include `undefined` on the read side; SENTINEL therefore unambiguously means "empty" — the boolean companion was redundant. PROTOCOL §1a covers the design rule.

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
              |
              v
Layer 2 — typed tiers    SnapshotStorageTier<T>     // one record per save
                         AppendLogStorageTier<T>    // sequential entries
                         KvStorageTier<T>           // arbitrary keyed records
                          -> flush() / rollback()
                          -> debounceMs / compactEvery / filter
                          -> keyOf? for partitioning
              |
              v
Layer 1 — bytes backend  StorageBackend
                          -> read / write / delete / list
                          -> memory / file / sqlite / indexedDb
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
// Graph snapshots — paired tier slots (Phase 14.6, DS-14-storage). Each
// slot pairs a snapshot tier (mode:"full" baselines) with an optional WAL
// companion (intermediate WALFrame records between baselines). Omit `wal`
// to skip WAL replay — that slot writes only baselines (effectively
// `compactEvery: 1` since intermediate state can't be recovered).
graph.attachStorage([
  { snapshot: memorySnapshot(),                          wal: memoryKv() },         // hot
  { snapshot: fileSnapshot(".graphrefly", { debounceMs: 5_000 }), wal: fileKv(".graphrefly") }, // warm
  { snapshot: indexedDbSnapshot(spec, { debounceMs: 60_000 }) },                    // cold (no WAL)
]);

// Forward-replay an existing graph from a paired slot:
const result = await graph.restoreSnapshot({
  mode: "diff",
  source: { tier: snapshotTier, walTier },
  // Optional Q9 controls:
  // lifecycle: ["data"],          // skip topology rewinds
  // targetSeq: 1234,              // point-in-time recovery
  // onTornWrite: ({ frame_seq, reason }) => "skip",
});
// result.replayedFrames / .skippedFrames / .finalSeq / .phases for inspection.

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

- **WAL-paired slots (Phase 14.6 — `graph.attachStorage`).** A slot that
  pairs `{ snapshot, wal }` writes `mode:"full"` baselines to `snapshot`
  and intermediate `WALFrame<T>` records to `wal` between them. The shared
  per-slot `seq` cursor lets `graph.restoreSnapshot({ mode: "diff" })`
  filter `frame_seq > baseline.seq` against either tier. The WAL companion
  must implement `BaseStorageTier.listByPrefix` (the default `kvStorage`
  does); other shapes throw `StorageError("backend-no-list-support")` on
  first replay. Cross-scope replay order is `spec → data → ownership`
  (DS-14 PART 4); each phase runs inside its own `graph.batch()` so a
  phase failure rolls back its own writes. **Loud caveat:** strict
  cross-tier atomicity is M4-side (Rust `redb`); pure-TS impl is
  best-effort under crash. See §3.8 "WAL replay" in the spec for the
  six-section amendment.

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
