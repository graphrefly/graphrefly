# Composition Guide — Level 2: Domain Patterns

> **Audience:** Pattern authors working in specific domains (AI, orchestration, CQRS, memory).
>
> Patterns for composing domain-level primitives: promptNode, dynamicNode, multi-agent handoffs, guardrails, process managers, and reactive memory. Assumes familiarity with [Protocol](./COMPOSITION-GUIDE-PROTOCOL.md) and [Graph](./COMPOSITION-GUIDE-GRAPH.md) levels.
>
> See also: [GRAPHREFLY-SPEC.md](./GRAPHREFLY-SPEC.md) for the behavioral spec.

---

## Pattern registry

| If you're asking... | See |
|---|---|
| "How do I pair triggers with context?" | §16 (nested `withLatestFrom`) |
| "How do I dedupe retried items?" | §17 (`trackingKey` / `relatedTo`) |
| "How do multi-agent handoffs work?" | §29 (full handoff vs agent-as-tool) |
| "How do I cancel the agent mid-generation?" | §30 (parallel guardrail) |
| "How do I expose a reactive tool list?" | §31 (dynamic tool selection) |
| "How do I keep system prompts prefix-cache-friendly?" | §33 (`frozenContext` snapshot) |
| "How do I route between agents reactively?" | §34 (`handoff` primitive — sugar over §29) |
| "How do I share an audit log + rollback shape across primitives?" | §35 (imperative-controller-with-audit) |
| "How do I model a long-running multi-step async workflow?" | §36 (process manager) |
| "How do I track which handler version produced an output?" | §37 (handler versioning via audit metadata) |

---

### 8. promptNode SENTINEL gate

`promptNode` gates on nullish deps and empty prompt text: if any dep value is
`null`/`undefined` (checked via `!= null` — loose equality catches both), or the
prompt function returns falsy text, `promptNode` skips the LLM call and emits `null`.

**Pattern:** Return empty string from prompt functions when input is meaningless.
Use `!= null` (not `!== null`) in guards to catch both `null` and `undefined`.

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

### 15. Scenario patterns (spec Appendix C)

The spec's **Appendix C** scenario validation table is the canonical index. Quick
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
input --> streamingPromptNode --> streamTopic --> contentGate(classifier)
              |                        |                    |
              |                        +-> thinkingRenderer  |
              |                                             v
              +---- cancel (AbortSignal) <---- tripwire fires
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

### 40. Reactive `extractFn` for `distill` — cancel-on-new-input recipe

`distill`'s `extractFn` is called **once at wiring time** and receives
both the source and the existing-store as `Node`s. The user wires the
reactive flow — distill no longer wraps the callback in a switchMap, so
the user picks the cancellation / queueing semantics.

**Cancel-on-new-input (most common — supersedes in-flight extraction):**

```ts
import { switchMap } from "@graphrefly/graphrefly/extra";
import { DATA } from "@graphrefly/graphrefly";

const bundle = distill(source, (rawNode, existingNode) => {
  // Closure mirror: read `existingNode.cache` ONCE at wiring time
  // (§5.12-sanctioned boundary read), keep current via subscribe so
  // the inner switchMap fn never peeks across the reactive boundary.
  let latest: ReadonlyMap<string, TMem> = existingNode.cache ?? new Map();
  existingNode.subscribe((msgs) => {
    for (const m of msgs) if (m[0] === DATA) latest = m[1];
  });
  return switchMap(rawNode, (raw) => extractFromLLM(raw, latest));
}, opts);
```

**Other reactive operators give different semantics:**

| Operator | Behavior |
|---|---|
| `switchMap(rawNode, fn)` | Cancel-on-new-input — supersede in-flight |
| `concat(rawNode, fn)` | Queue — run sequentially in order |
| `mergeMap(rawNode, fn)` | Parallel — run all concurrently, results interleave |
| `derived([rawNode], fn)` | Synchronous transform per emission — no async at all |

**Why closure-mirror, not `withLatestFrom`:** `withLatestFrom(rawNode,
existingNode)` swallows the initial source emission because primary's
push-on-subscribe fires before secondary subscribes (same hazard
described in §32). The closure-mirror at wiring time + subscribe-handler
pattern avoids this and makes `existing` available inside any reactive
fn body.

**Sync transforms (when no async / cancel needed):**

```ts
distill(source, (rawNode) => derived([rawNode], ([raw]) => ({
  upsert: [{ key: String(raw), value: raw }],
})), opts);
```

Pure transforms don't need `existing` — the existing-store node is
ignored and the function runs synchronously per source emission.

---

### 41. Criteria-grid verifier recipe (Phase 13.G7 reframe)

**Context.** The "verifier rubber-stamps" pain point (Anthropic 2026-04
multi-agent failure-modes survey, item 7): a single LLM verifier asked
"is this good?" tends to approve marginal outputs because it has no
forced decomposition of the criteria. The fix is the **criteria-grid**
pattern: replace the single yes/no verifier with N binary axes.

**Originally proposed as a factory; reframed as a recipe** (Phase 13.G7,
2026-04-28) — per the "schema convention is not a factory" rule from the
human-LLM intervention session. The substrate ships everything needed:
`humanInput<{axes}>` for human verifiers, `promptNode` with structured
output for LLM verifiers, `derived(.every)` for aggregation, and
`approvalGate` for the gate.

**Human verifier:**

```ts
import { humanInput, approvalGate } from "@graphrefly/graphrefly-ts";

interface CriteriaResult {
  axes: { id: string; pass: boolean; evidence: string }[];
}

const criteria = humanInput<CriteriaResult>({
  hub,
  prompt: state(`Verify the change against the criteria grid.`),
  schema: {
    type: "object",
    required: ["axes"],
    properties: {
      axes: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "pass", "evidence"],
          properties: {
            id: { type: "string" },
            pass: { type: "boolean" },
            evidence: { type: "string" },
          },
        },
      },
    },
  },
});

const verified = derived([criteria], ([r]) => r.axes.every((a) => a.pass));
const approved = approvalGate(verified, opts);
```

**LLM verifier:** swap `humanInput` for a structured-output `promptNode`
over the same schema; the rest of the pipeline is identical. This is the
key advantage of the recipe form — human and LLM verifiers are
substitutable. Tests can exercise both by swapping the source Node.

**Why decomposition matters.** Each axis independently forces evidence;
`every(.pass)` is the conjunction. The single yes/no verifier collapses
to one boolean with no forced structure — the criteria grid forces N
bool + N evidence strings, which makes failure modes legible.

**Pairs with `auto-solidify`** (Phase 15 catalog automation): each
verified-true criterion can be promoted into the catalog as a learned
heuristic, with the evidence as the audit trail.

---

### 42. Cost-bubble recipe (Phase 13.G8 hardened)

**Context.** Industry pain #8: "cost explosion hard to control by
harness engineering" — multi-agent compositions amplify per-call cost
without a shared observable. graphrefly's `agent()` (Phase 13.G) ships
`bundle.cost: Node<CostState>` per agent; the recipe is how parents
aggregate.

**Per-agent cost is shipped.** `bundle.cost` carries `{ usage, turns }`
where `usage` is the canonical `TokenUsage` (cache classes / reasoning /
audio / multimodal / extensions / auxiliary all preserved). USD
conversion is a downstream `derived` over `usage`.

**Parent aggregator:**

```ts
import { agent, derived, sumInputTokens, sumOutputTokens } from "@graphrefly/graphrefly-ts";

const a = agent(parent, { name: "researcher", adapter, ... });
const b = agent(parent, { name: "coder", adapter, ... });

// Token total across both agents (current input scope).
const totalTokens = derived([a.cost, b.cost], ([costA, costB]) =>
  sumInputTokens(costA.usage) + sumOutputTokens(costA.usage) +
  sumInputTokens(costB.usage) + sumOutputTokens(costB.usage),
);

// USD total (pricing function is caller-supplied, e.g. from
// `patterns/ai/adapters/core/pricing.ts`).
const totalUsd = derived([a.cost, b.cost], ([costA, costB]) =>
  pricer.priceCall(costA.usage) + pricer.priceCall(costB.usage),
);
```

**Budget gate:**

```ts
const budgetGate = state<BudgetConstraint[]>([{ kind: "max", maxUsd: 5.0 }]);
const canSpawn = budgetGate(totalUsd, budgetGate);
const sp = spawnable({ hub, registry, budgetGate: canSpawn });
```

(Where `budgetGate(...)` is the existing resilience-layer factory that
gates a stream when its cost exceeds the constraint.)

**Honest cost control.** Two pieces are needed: **(1)** the bubble
above for observability + propagation cuts, **(2)** the adapter-abort
hookup so closing the gate also cancels in-flight HTTP calls (Phase 1
adapter-abort, shipped 2026-04). Without (2), `budgetGate` cuts only
propagation — the in-flight token burn continues.

---

### 43. `boundaryDrain` recipe (Phase 13.J — locked as recipe, no factory)

**Context.** Next-boundary injection — accumulate items on a topic until
a "boundary" signal pulses (an LLM token-finished event, a turn
boundary, a user keypress), then drain the accumulated batch downstream.
Common shape for context injection between LLM turns, batched user
inputs, etc.

**Locked as a recipe** (Phase 13.J, 2026-05-01) — the existing
`buffer(source, notifier)` operator already covers `bufferWhen`
semantics. No new factory; document the alias.

**Recipe:**

```ts
import { buffer } from "@graphrefly/graphrefly-ts";

// Drain `topic.events` whenever `boundary` fires (LLM-turn-end, user
// pulse, etc.). `drained` is a Node<readonly T[]> of accumulated items
// flushed at each boundary.
const drained = buffer(topic.events, boundary);
```

`buffer(source, notifier)`'s contract: accumulate every `source` DATA
since the last emission, emit the batch when `notifier` fires. Maps
directly onto the `bufferWhen` shape from Rx / callbag with no rename.

**When to upgrade to a factory.** If a second consumer surfaces with
non-trivial wiring around the buffer (e.g., max-buffer-size cap,
fallback emission on timeout, per-boundary TTL), introduce
`boundaryDrain(topic, notifier, opts)` as a thin sugar. Until then, the
recipe is the canonical form.

---

### 44. `T | Node<T>` parameter widening (when not to make a primitive)

**Context.** When a working imperative helper operates on an existing reactive Node (e.g., `tryIncrementBounded(counter, cap)` over a `Node<number>`), the temptation is to wrap it as a "reactive primitive" — `boundedCounter(cap)` returning a bundle with the counter Node, derived companions, the imperative helper renamed as a method, and a reset.

**Skip the wrap when the bundle's contents are all trivially expressible inline.** If the proposed primitive contains:

1. The Node the helper already operates on (already reactive)
2. A trivially-derivable companion (`derived(node, fn)` one-liner)
3. The imperative helper itself, renamed as a method
4. A reset/init one-liner

…then no new semantic content is being introduced. The wrap is packaging — net new API surface, zero new behavior. The vicious cycle: take a working imperative helper → wrap it as a primitive → realize the primitive needs the imperative entry point → bolt it back on as a method → ship more API for no semantic gain.

**Why `reactiveMap.set` / `reactiveList.push` / `Topic.publish` exist:** because the underlying reactive thing has non-trivial reactive structure that the mutation method commits into (a map's keys, a list's elements, a topic's log). A counter Node with a `tryIncrementBounded` helper does NOT — the Node is the structure; the function is just a sanctioned read-then-write boundary.

**The right widening.** Instead of wrapping, accept `T | Node<T>` on the helper's parameters. Inside the function, branch:

```ts
function tryIncrementBounded(
  counter: Node<number>,
  cap: number | Node<number>,
  by = 1,
): boolean {
  const capValue = typeof cap === "number" ? cap : (cap.cache as number);
  const cur = counter.cache as number;
  if (cur + by > capValue) return false;
  counter.down([[DATA, cur + by]]);
  return true;
}
```

Callers opt into reactive control by passing a Node when they need it; opt out by passing a scalar. Same function, no new abstraction.

**Decision rubric — wrap as primitive vs widen with `T | Node<T>`:**

| Sign | → wrap as primitive | → widen helper |
|---|---|---|
| Underlying *structure* is reactive (map/list/topic/queue) | ✓ | |
| Single value being read-then-written | | ✓ |
| Bundle has 3+ members that are one-line each | | ✓ |
| Mutation commits into multi-edge graph state | ✓ | |
| Reactive composition just needs Node-shaped input | | ✓ |
| Caller wants `instanceof <Primitive>` narrowing | ✓ | |

**Cross-reference:** §35 (Imperative-controller-with-audit) — a different shape where imperative-with-discipline IS the right answer because the controller coordinates multiple reactive edges. §44 covers when *no controller is needed at all* and a parameter widening suffices.

**Decision provenance:** DS-13.5.D walk, 2026-05-01. Original proposal was `boundedCounter` primitive wrapping `tryIncrementBounded`; user pushed back on the "wrap-imperative-as-reactive-then-bolt-imperative-back" anti-pattern. Revised to keep `tryIncrementBounded` as-is, optionally widen `cap` to `number | Node<number>`.
