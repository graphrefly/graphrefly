# Design Decision Archive

This directory preserves detailed design discussions from key sessions for the GraphReFly spec repo. For the full implementation-level archive, see `~/src/graphrefly-ts/archive/docs/DESIGN-ARCHIVE-INDEX.md`.

---

## GraphReFly Spec Sessions

### Session snapshot-hydration-design (March 30) — Seamless Snapshot/Hydration: Auto-Checkpoint & Node Factory Registry
**Topic:** Designing zero-friction resume for dynamic graphs — auto-checkpoint (reactive persistence wired to `observe()`) and node factory registry (`Graph.registerFactory()` for `fromSnapshot` reconstruction of runtime-added nodes). Motivated by reactive issue tracker, agent memory (`distill()`), and security policy hot-reload use cases.

**Key decisions:**
- **Auto-checkpoint fires after settlement** — filter to DATA/RESOLVED (phase-2 messages), debounce ~500ms; snapshotting mid-DIRTY produces inconsistent state
- **Incremental snapshots** via `Graph.diff()` — reduces I/O from O(graph_size) to O(changed_nodes) per mutation; periodic full snapshot compaction
- **Factory registry by name glob pattern** — not by node type (too coarse) or custom meta field (pollutes snapshot); global registry solves chicken-and-egg with `fromSnapshot`
- **Guards reconstruct from data** — `policyFromRules(snap.value.rules)` rebuilds guard fns from persisted policy rules
- **Topological reconstruction order** — mounts → state/producer → derived/operator/effect → edges → restore values

**Spec impact:** §3.8 Persistence extended with auto-checkpoint and node factory registry APIs.

**Files:** `archive/docs/SESSION-snapshot-hydration-design.md`

---

## Archive Format

Each session file contains:
- SESSION ID and DATE
- TOPIC
- KEY DISCUSSION (reasoning, code examples, decisions)
- REJECTED ALTERNATIVES (what was considered, why not)
- KEY INSIGHTS (main takeaways)
- FILES CHANGED (implementation side effects)

---

**Created:** March 30, 2026
**Updated:** March 30, 2026
**Archive Status:** Active — snapshot/hydration design
