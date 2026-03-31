---
SESSION: snapshot-hydration-design
DATE: March 30, 2026
TOPIC: Seamless snapshot/hydration — auto-checkpoint, node factory registry, and runtime persistence for reactive graphs
REPO: graphrefly-ts (primary), graphrefly (spec)
---

## CONTEXT

GraphReFly's `graph.snapshot()` / `graph.restore()` / `Graph.fromSnapshot()` (§3.8) already captures structure + current values + meta. But seamless resume — closing a process and picking up exactly where you left off — requires two missing pieces:

1. **Auto-checkpoint:** Mutations persist automatically without manual checkpoint calls.
2. **Node factory registry:** `fromSnapshot()` reconstructs dynamic graphs (runtime-added nodes) without a hardcoded `build` callback.

These are critical for domain graph factories (Phase 4 — orchestration, memory, AI surface) where nodes are added/removed at runtime and must survive process restarts.

---

## DESIGN 1: AUTO-CHECKPOINT

Wire `observe()` → debounced save. Key constraints:

- **Fire after settlement, not during batch.** Filter to DATA/RESOLVED (phase-2 messages), debounce by ~500ms. Snapshotting mid-DIRTY produces inconsistent state.
- **Incremental snapshots.** Full `snapshot()` on every mutation is O(graph_size). Use `Graph.diff(prev, current)` for diffs, periodic full snapshots for compaction.
- **Selective scoping.** Filter which nodes trigger checkpointing (typically state nodes only; derived nodes recompute).
- **Restore ordering.** State nodes restore before derived nodes connect, preventing spurious recomputation waves.

### Spec-level API

```
graph.autoCheckpoint(adapter, opts?)  — arm debounced persistence on mutation
                                        returns disposable effect node
```

Options: `debounceMs` (default 500), `filter` (name/node predicate), `compactEvery` (full snapshot interval), `onError`.

Returns a node — participates in graph lifecycle, torn down on `graph.destroy()`.

---

## DESIGN 2: NODE FACTORY REGISTRY

Register factories by name pattern. The snapshot carries type info; the registry maps pattern to a factory that reconstructs the node with code (fns, guards) reattached.

### Spec-level API

```
Graph.registerFactory(pattern, factory)    — register a node factory by name glob
Graph.unregisterFactory(pattern)           — remove a registered factory
Graph.fromSnapshot(data)                   — uses registry when no build callback
Graph.fromSnapshot(data, build)            — build callback takes precedence (existing)
```

Factory signature: `(name, { value, meta, deps, type }) → Node`

### Reconstruction order

1. Reconstruct mount hierarchies (subgraphs)
2. Reconstruct state/producer nodes (no deps needed)
3. Reconstruct derived/operator/effect nodes (deps resolved to step 2 nodes)
4. Reconstruct edges
5. Call `restore()` to hydrate values

### Key decisions

- **Match by name prefix pattern** (glob), not node type (too coarse) or custom meta field (pollutes snapshot)
- **Global registry** (`Graph.registerFactory`) — solves the chicken-and-egg problem (graph doesn't exist before `fromSnapshot`)
- **Guards reconstruct from data:** `policyFromRules(snap.value.rules)` rebuilds guard fns from persisted policy data, not serialized functions

---

## HOW THEY COMPOSE

```
Startup → fromSnapshot (registry reconstructs N runtime-added nodes)
        → autoCheckpoint (arm debounced save)
        → runtime add/remove (new nodes, policy changes)
        → auto-persist (debounced to disk)
        → crash/restart → fromSnapshot picks up exactly where left off
```

---

## USE CASES

- **Reactive issue tracker:** 50+ issues added at runtime, verifiers reattach via factory, regressions persist across sessions
- **Agent memory (`distill()`):** memory store entries survive restarts, eviction/scoring logic reactivates from restored values
- **Security policies:** guards added/removed at runtime, policy data persists, guard fns reconstruct from persisted rules via `policyFromRules()`

---

## REJECTED ALTERNATIVES

- **Serialize functions** — security and correctness problems; data serializes, code lives in code
- **Store factory key in snapshot metadata** — couples snapshot format to registry mechanism; name-pattern matching is decoupled
- **Per-graph registry only** — can't use before graph exists (chicken-and-egg with fromSnapshot); global registry solves this

---

## KEY INSIGHTS

1. The snapshot already captures values. The gap is *when* to persist (auto-checkpoint) and *how* to reconstruct (registry).
2. Auto-checkpoint must fire after settlement (phase-2 messages), not during batch.
3. The registry turns `fromSnapshot` from "restore known topology" to "restore arbitrary topology" — critical for dynamic collections.
4. Guards reconstruct from data (`policyFromRules()`), not from serialized functions.
5. The two features compose: registry handles reconstruction, auto-checkpoint handles persistence.

---

## FILES

- This file: `archive/docs/SESSION-snapshot-hydration-design.md` (spec repo)
- Full design with code examples: `~/src/graphrefly-ts/archive/docs/SESSION-snapshot-hydration-design.md`
- Spec update: `GRAPHREFLY-SPEC.md` §3.8 extended
- Roadmap update: `~/src/graphrefly-ts/docs/roadmap.md` Phase 1.4b
