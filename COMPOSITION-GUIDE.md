# Composition Guide

> **Accumulated patterns for building factories and domain APIs on top of GraphReFly primitives.**
>
> This is NOT the spec. The spec (`GRAPHREFLY-SPEC.md`) defines **protocol behavior** — what MUST happen. This guide captures **"good to know before you fail"** — patterns, insights and recipes that composition authors (human or LLM) encounter when wiring primitives into higher-level APIs.
>
> Both `graphrefly-ts` and `graphrefly-py` CLAUDE.md files reference this guide.

---

## Guide structure

The composition guide is organized into 4 levels, each building on the one below. Start at the level that matches your task.

| Level | File | Audience | What's covered |
|-------|------|----------|----------------|
| **L0 — Protocol** | [COMPOSITION-GUIDE-PROTOCOL.md](./COMPOSITION-GUIDE-PROTOCOL.md) | Core contributors, operator authors | Message flow, activation, cache lifecycle, wave mechanics, naming conventions |
| **L1 — Graph** | [COMPOSITION-GUIDE-GRAPH.md](./COMPOSITION-GUIDE-GRAPH.md) | Pattern authors | Guard patterns, feedback cycles, storage tiers, compat bridges, ctx.store |
| **L2 — Patterns** | [COMPOSITION-GUIDE-PATTERNS.md](./COMPOSITION-GUIDE-PATTERNS.md) | Domain pattern authors | promptNode, dynamicNode, multi-agent, guardrails, process managers, audit |
| **L3 — Solutions** | [COMPOSITION-GUIDE-SOLUTIONS.md](./COMPOSITION-GUIDE-SOLUTIONS.md) | Preset authors | Harness loop, memory tier, resilient pipeline, multi-agent orchestration |

Each level imports concepts from the level below but can be read independently.

---

## Quick lookup

| If you're asking... | See |
|---|---|
| "Why isn't my derived computing?" | L0 §1 (first-run gate), L1 §3 (guard patterns) |
| "Why are values missing/stale?" | L0 §1 (SENTINEL), L0 §2 (subscription ordering) |
| "Should I emit `null` for 'no value yet' / add a `hasValue` companion dep?" | L0 §1a (no — stay SENTINEL; `prevData[i] === undefined` is the detector) |
| "How do I guard `null`/`undefined`?" | L1 §3 (the only two guards) |
| "How do I break an infinite loop?" | L1 §7 (feedback cycles) |
| "How do I wire a factory?" | L0 §5 (graph factory wiring order) |
| "What's glitch-free diamond resolution?" | L0 §9, §9a (two-phase + batch-coalescing) |
| "How do I get `withLatestFrom` initial pair?" | L0 §28 (factory-time seed) |
| "How do I pair triggers with context?" | L2 §16 (nested `withLatestFrom`) |
| "How do I dedupe retried items?" | L2 §17 (`trackingKey` / `relatedTo`) |
| "Where do I put persistent fn state?" | L1 §20 (`ctx.store`) |
| "What's `actions.emit` vs `actions.down`?" | L0 §21 |
| "Why is my operator leaking mid-wave emits?" | L0 §19 (terminal-emission operators) |
| "How do I make a rescue / error-to-fallback op?" | L1 §23 (`errorWhenDepsError: false`) |
| "How do I tier persistence (hot/warm/cold)?" | L1 §27 (`attachStorage`) |
| "How do multi-agent handoffs work?" | L2 §29 (full handoff vs agent-as-tool) |
| "How do I cancel the agent mid-generation?" | L2 §30 (parallel guardrail) |
| "How do I expose a reactive tool list?" | L2 §31 (dynamic tool selection) |
| "PY test hangs for 60s then times out?" | L1 §14 (blocking async bridge deadlock) |
| "Consumer reads stale switchMap cache across session boundaries?" | L0 §32 (state-mirror for cross-wave reset) |
| "How do I keep system prompts prefix-cache-friendly?" | L2 §33 (`frozenContext` snapshot) |
| "How do I route between agents reactively?" | L2 §34 (`handoff` primitive — sugar over §29) |
| "How do I share an audit log + rollback shape across primitives?" | L2 §35 (imperative-controller-with-audit) |
| "How do I model a long-running multi-step async workflow?" | L2 §36 (process manager) |
| "How do I track which handler version produced an output?" | L2 §37 (handler versioning via audit metadata) |
| "Why can't I mix `RESOLVED` and `DATA` in the same wave?" | L0 §41 (tier-3 wave exclusivity) |

---

## Cross-cutting concerns

### Cross-language data structure parity (§6)

When using `ReactiveMapBundle`, `reactiveLog`, or `reactiveList` across TS and PY:

- TS `ReactiveMapBundle` has `.get(key)`, `.has(key)`, `.size`. PY exposes `.data` (node)
  with `.set()` / `.delete()` / `.clear()` but no `.get(key)` (parity gap).
- Both wrap internal state in `Versioned` snapshots.
- Always check the language-specific API rather than assuming parity.

### Debugging composition

See [Protocol guide — Debugging composition](./COMPOSITION-GUIDE-PROTOCOL.md#debugging-composition).

### Testing composition

See [Protocol guide — Testing composition](./COMPOSITION-GUIDE-PROTOCOL.md#testing-composition).
