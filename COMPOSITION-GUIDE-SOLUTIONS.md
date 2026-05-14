# Composition Guide — Level 3: Solutions

> **Audience:** Authors building high-level presets like `harnessLoop`, `agentMemory`, `refineLoop`.
>
> Solution-level composition recipes that wire multiple domain patterns (Level 2) into complete, deployable systems. These are the highest-level patterns in the library today.
>
> Assumes familiarity with [Protocol](./COMPOSITION-GUIDE-PROTOCOL.md), [Graph](./COMPOSITION-GUIDE-GRAPH.md), and [Patterns](./COMPOSITION-GUIDE-PATTERNS.md) levels.

---

## Harness 7-stage composition

The reactive collaboration loop (INTAKE → TRIAGE → QUEUE → GATE → EXECUTE → VERIFY → REFLECT) is GraphReFly's canonical solution-level pattern. Each stage is a handoff (§29) with gates between them.

**Stage wiring overview:**

```
INTAKE (TopicGraph)
  → TRIAGE (promptNode + withLatestFrom strategy)
    → QUEUE (JobQueueGraph)
      → GATE (human approval / auto-valve)
        → EXECUTE (promptNode + tools)
          → VERIFY (verifiable + promptNode)
            → REFLECT (strategy update + reingestion)
```

**Key composition decisions:**

- **TRIAGE → QUEUE**: Use `withLatestFrom(intake.latest, strategy.node)` to avoid §7 feedback cycles — strategy is advisory, not a trigger.
- **GATE**: Human approval via `gate.approve()` / `gate.reject()` / `gate.modify()`. Auto mode via `valve` (boolean flow control). Both emit to the same audit log (§35).
- **EXECUTE → VERIFY**: Wire via `verifiable(executeOutput, verifyFn, { autoVerify: true })`. The `switchMap` inside verifiable cancels stale verification when a new execution arrives.
- **VERIFY → REFLECT**: Use nested `withLatestFrom` (§16) — reflect fires only when verify settles, sampling execute output + input as context.
- **REFLECT → INTAKE** (reingestion): Items that fail verification re-enter INTAKE with `relatedTo: [originalKey]` for stable dedup (§17).

**Strategy model.** The REFLECT stage updates `strategy.node` with `rootCause × intervention → successRate` entries. Future TRIAGE reads use `withLatestFrom` to route items toward interventions with higher historical success rates. This is the closed-loop learning that makes the harness improve over time.

**Inspection.** `harnessProfile(graph)` returns per-stage stats (throughput, latency, error rate, queue depth). `graph.describe({ format: "mermaid" })` renders the full 7-stage topology.

See `archive/docs/SESSION-reactive-collaboration-harness.md` for the full design history.

---

## Memory tier composition

`agentMemory` composes multiple Level-2 primitives into a unified memory system:

```
collection (reactiveMap)
  + vectorIndex (derived, cosine similarity)
  + knowledgeGraph (reactiveMap of edges)
  + decay (effect, time-based scoring)
  + retrieval (derived, budget-constrained via distill)
```

**Key wiring:**

- **Collection → vectorIndex**: `derived([collection.entries], fn)` recomputes embeddings on collection change.
- **Retrieval**: `distill(query, extractFn, { score, cost, budget })` composes collection + vectorIndex + knowledgeGraph into a budget-constrained context window. The `compact` node is the input to `promptNode.context`.
- **Decay**: `effect([fromTimer(decayIntervalMs), collection.entries], fn)` periodically re-scores entries and evicts below-threshold items.
- **Consolidation**: `distill`'s `consolidateTrigger` fires periodic merge of related entries via LLM (§40 reactive extractFn pattern).

**`frozenContext` integration (§33).** Wrap `memory.context` in `frozenContext` to stabilize the system prompt prefix across turns. Refresh on stage transitions or time intervals, not on every memory write.

---

## Resilient pipeline composition

Production LLM pipelines compose Level-2 resilience primitives in a standard order:

```
rateLimiter → budgetGate → withBreaker → timeout → retry → fallback
```

**Wiring:**

```ts
const pipeline = pipe(
  userInput,
  rateLimiter({ rpm: 60, tpm: 100_000 }),
  budgetGate(costMeter, { maxCost: 10.0 }),
  withBreaker({ failureThreshold: 5, resetTimeMs: 30_000 }),
  timeout({ ms: 30_000 }),
  retry({ maxAttempts: 3, backoff: [100, 500, 2_000] }),
  fallback(cachedResponse),
);
```

**Order matters:**
- `rateLimiter` first — prevents burst from hitting provider rate limits.
- `budgetGate` second — stops before spending tokens on a doomed request.
- `withBreaker` third — fast-fails when provider is down (avoids timeout wait).
- `timeout` fourth — caps individual attempt duration.
- `retry` fifth — retries on transient failures (timeout, 5xx).
- `fallback` last — serves cached/default response when all retries exhausted.

**Each primitive is a `Node` in the graph.** `describe()` shows the full pipeline topology. `observe(budgetGate)` logs every gate decision. `graphProfile(graph)` reports per-stage latency.

**`handlerVersion` (§37) on each stage** enables per-stage version tracking in the audit log.

---

## Multi-agent orchestration patterns

Three patterns for composing multiple agents, in increasing complexity:

### 1. Sequential chain (simplest)

```ts
const researcher = agentLoop(researchAdapter, { tools: [searchTool] });
const writer = agentLoop(writeAdapter, { tools: [editTool] });

// Chain: researcher output feeds writer input
const researchResult = researcher.output;
const writerInput = derived([researchResult], ([r]) => `Write about: ${r}`);
// Wire writerInput as writer's prompt source
```

### 2. Fan-out / fan-in (parallel specialists)

```ts
// Fan-out: one input to N specialists
const specialists = topics.map(topic =>
  agentLoop(adapter, { tools: topicTools[topic] })
);

// Fan-in: merge all specialist outputs
const allResults = merge(...specialists.map(s => s.output));
const synthesized = promptNode(adapter, [allResults], synthesizePrompt);
```

### 3. Supervisor with handoffs (§29 + §34)

```ts
// Supervisor decides routing
const supervisor = agentLoop(supervisorAdapter, {
  tools: [
    // Each specialist registered as a tool (agent-as-tool mode)
    ...specialists.map(s => ({
      name: s.name,
      execute: (args) => s.run(args.query),
    })),
  ],
});
```

**Shared state across agents:** All agents mount into the same `Graph` and share `agentMemory`. No explicit context-passing — the graph IS the shared state (§29).

**Guardrails across agents:** Wire `contentGate` (§30) at the supervisor level to gate all specialist outputs before they reach the user.

---

## Future solution patterns

As the library grows upward, additional solution-level patterns will be added here:

- **Eval harness** — two-tier eval (fast synthetic + slow human-graded) composing verifiable + distill + harness stages
- **Multi-tenant orchestration** — per-tenant subgraphs with shared infrastructure nodes
