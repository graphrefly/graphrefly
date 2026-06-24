# SESSION - Ontology and Agent Observability Research

**Status:** active research / discussion note, non-locking
**Opened:** 2026-06-24
**Trigger:** User saw Alibaba Cloud's "Ontology is trending again. Can it improve my AI agent's performance?" plus short-form summaries about O&M ontology and Agent observability, then asked how this maps to GraphReFly, `fromOTel`, and the WorkItem solution.
**Scope:** Market/architecture research and product-direction discussion only. This session records vocabulary, positioning, gaps, and candidate surfaces. It does not create D# decisions, protocol rules, conformance scenarios, package APIs, or pre-1.0 commitments.

---

## Research Signals

- Alibaba Cloud's UModel / STAROps article validates a domain-ontology pattern
  for O&M: shift from data-oriented logs/metrics/traces/events toward
  entity-oriented topology, entity-bound telemetry, entity-bound runbooks, and
  explainable RCA evidence. External source:
  <https://www.alibabacloud.com/blog/ontology-is-trending-again--can-it-improve-my-ai-agents-performance_603207>
- OpenTelemetry is the existing vendor-neutral telemetry substrate. The OTel
  Collector already defines receiver -> processor -> exporter pipelines over
  traces, metrics, and logs. External source:
  <https://opentelemetry.io/docs/collector/architecture/>
- Grafana Tempo's Service Graph validates that service dependency topology can
  be inferred from trace spans and OpenTelemetry semantic conventions. External
  source:
  <https://grafana.com/docs/grafana/latest/datasources/tempo/service-graph/>
- Agent observability tooling is converging on tracing LLM calls, tool calls,
  retrieval steps, token/cost, latency, and evaluation outcomes. Langfuse frames
  LLM observability around application tracing with prompts, responses, token
  usage, latency, and tool/retrieval steps. External source:
  <https://langfuse.com/docs/observability/overview>
- LangSmith added end-to-end OpenTelemetry support so LangChain/LangGraph traces
  can flow into LangSmith or other observability backends. External source:
  <https://www.langchain.com/blog/end-to-end-opentelemetry-langsmith>

---

## Working Vocabulary

### Ontology

Ontology in this thread means an explicit semantic map of a domain: entities,
entity types, relationships, constraints, observations, and entity-bound
knowledge. In O&M this means services, pods, hosts, databases, queues, routes,
metrics, logs, traces, incidents, runbooks, and dependency/failure-propagation
relationships.

### Trace / Log / Metric

- Trace: a causally linked execution path, usually a span tree or DAG with
  trace/span/parent ids and timing.
- Log: a point event that may be correlated to a trace/span.
- Metric: an aggregated time-series signal.

For Agent observability, these map onto LLM calls, tool calls, retrieval steps,
decision points, state transitions, context snapshots, usage/cost, safety
signals, and evaluation results.

### `fromOTel`

Future vocabulary only. `fromOTel` should mean the lower-level OTLP/OTel ingest
adapter that receives traces, metrics, logs, and resource attributes as
reactive input streams.

### `fromOTelEntityGraph`

Future vocabulary only. `fromOTelEntityGraph` should mean a higher-level
solution recipe that consumes OTel telemetry and incrementally projects a live
entity/fact graph: services, routes, pods, hosts, databases, queues, spans,
logs, metrics, observed dependency edges, latency/error facts, anomaly facts,
and RCA evidence candidates.

Important boundary: observed services do not need to use GraphReFly. Existing
services with OTel instrumentation can feed the recipe through an OTel Collector
or OTLP endpoint. GraphReFly-native services could optionally expose richer
internal graph/node causality, but that is an enhancement, not a prerequisite.

Likely product boundary: GraphReFly performs semantic reactive reduction over
telemetry; it does not try to replace the OTel Collector's mature transport,
batching, sampling, and fan-out role.

---

## GraphReFly Positioning

UModel is a domain ontology product layer. GraphReFly is the reactive substrate
and solution recipe layer that could host similar models.

The promising wedge is not "GraphReFly also has ontology", but:

> GraphReFly can turn telemetry and workflow facts into live reactive entity
> graphs, explainable reductions, RCA candidates, dashboards, and audit
> receipts.

This aligns with the project direction around graph-first topology,
inspectability, fact projection, evidence-first workflows, and graph-visible
audit/status/issue material.

---

## WorkItem Solution vs Agent Observability

Discussion conclusion: the WorkItem/Workspace solution already covers much of
the semantic foundation for multi-agent observability.

Existing or designed graph-visible material includes:

- WorkItem authoring facts.
- `VerificationPlan`.
- `WorkItemEffectPlan`.
- effect requests.
- Agent/tool requests.
- provider-neutral `ExecutorOutcome`.
- evidence and verification results.
- proposal/admission/application records.
- status, issues, and audit.
- repair, retry, scheduling, readiness, and workQueue material.
- read-model and query descriptors.

This forms an audit-first harness model. A span/log/metric product surface
should therefore be a projection over existing graph-visible facts, not a new
execution architecture.

Important boundary: only graph-visible facts/status/issues/audit/evidence and
bounded supplied material are queryable. Runtime-private clients, credentials,
subprocess handles, opaque storage/query cursors, raw provider responses, and
large/sensitive logs stay behind refs, summaries, redaction, or host-private
adapters per the existing D270/D293/D359/D361/D448/D452/D464/D478-style
boundaries.

---

## Candidate Future Surfaces

These are not approved. They are names and shapes to revisit only if this
research thread becomes product work.

- `WorkItem Observatory`: product/solution surface for agent workflow
  observability over WorkItem/Workspace facts.
- `workItemTrace(workItemId)`: span-like WorkItem/effect/run DAG projection.
- `workItemEventLog(filter)`: chronological fact/status/issue/audit projection.
- `workItemMetrics(window)`: success/failure/retry/blockage/manual-review/
  latency/cost summaries.
- `contextReceipt(effectRunId | agentRequestId)`: bounded source refs, revision
  coordinates, prompt/tool/material refs, artifact refs, and redaction evidence.
- `toAgentTrace()` or OTel projection: export WorkItem/agent traces to
  Langfuse/LangSmith/Grafana-style ecosystems.
- `fromOTelEntityGraph`: external-service observability recipe over OTel
  telemetry.

---

## Non-Goals Captured By This Session

- No protocol rule, message tier, conformance scenario, D-number, package API,
  or pre-1.0 commitment is locked here.
- Do not position GraphReFly as an OTel Collector replacement in the first
  slice.
- Do not claim a complete Agent observability product exists merely because the
  fact model can support one.
- Do not make Canvas or a UI host a raw fact store, storage/query adapter, or
  runtime-private handle owner.
- Do not inline raw provider outputs, credentials, subprocess internals, or
  large/sensitive logs into graph DATA or Agent context.

---

## Open Questions

1. Should `WorkItem Observatory` become a visible solution wedge, or remain an
   internal projection pattern until WorkItem/Workspace hardening is further
   along?
2. Should the first observability proof be WorkItem-native (`workItemTrace`) or
   external-service-native (`fromOTelEntityGraph`)?
3. If exporting to OTel, should GraphReFly produce standard spans/logs/metrics
   only, or also preserve a richer GraphReFly-specific receipt format for
   evidence, source refs, policy refs, and repair status?
4. Should `fromOTelEntityGraph` define a minimal ontology schema itself, or
   bridge OTel/CMDB/Kubernetes metadata into user-defined entity types?
