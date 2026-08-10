# SESSION — Data Agent Solution / Query-as-Verified-Pipeline

**Status:** 🌱 EXPLORATION ACTIVE — D718 solution/product contract locked; public solution remains deferred
**Opened:** 2026-06-06  
**Trigger:** User asked to deepen GraphReFly's Data Agent direction beyond a demo, integrating external user-pattern research, Snowflake Cortex-style data-agent harness lessons, and the existing GraphReFly building blocks around messaging, orchestration, harnesses, async runtime, and agentic memory.  
**Method:** Product/solution research session. Records positioning, scenarios, and preset shape. Does **not** amend the wave protocol, clean-slate core, or L0 narrow-waist decision.

---

## Relationship to Clean-Slate

This session is intentionally separate from `SESSION-clean-slate-redesign.md`.

The clean-slate core remains a horizontal narrow waist: GraphReFly is a reactive universal reduction layer. Data Agent work belongs above that waist as a preset / solution candidate, likely under a future `solutions/data-agent` starter kit once consumer pressure justifies a bundled vertical.

The goal is not to make the core data-specific. The goal is to prove that GraphReFly's generic building blocks can support a serious data-agent solution:

- declarative, inspectable topology;
- messaging hub for dynamic work;
- orchestration / pipeline helpers for stable workflow shape;
- job queues and job flows for async execution and verification;
- guarded execution and approval gates for high-risk steps;
- agentic memory for business context, semantic definitions, verified examples, feedback, and stale-context handling;
- async / remote runtime adapters so enterprise data can stay inside the correct trust boundary.

## Locked Product Contract — D718

D718 locks the Data Agent WorkGraph boundary without adding a core primitive. Stable semantic stages,
causal dependencies, policy/admission gates, independent verification, and user-review boundaries may be
real nodes or named bundles. Tables, documents, source candidates, messages, model turns, tool calls, and
attempts remain bounded DATA, ledgers, or evidence whose cardinality does not automatically change
topology. LLMs may propose plans, requests, recovery, or WorkGraph edits, but only a separately authorized
and host-accepted immutable revision may change executable topology or dispatch external work.

Canvas therefore shows the actual admitted workload Graph in Topology Lens and shows run-specific DATA,
turns, attempts, outcomes, and evidence in Side Panel/trajectory surfaces. The first Canvas wedge remains
app-private and sequenced after local-v0 closure. B116 defers any public `solutions/data-agent` extraction
until two independent scenarios prove a genuinely reusable bundle rather than merely reusing existing
WorkItem, hub, context, executor, admission, and verification building blocks.

---

## Positioning

The opportunity is not "GraphReFly helps an LLM write SQL." The stronger product shape is:

> Query-as-verified-pipeline: turn an analytical or data-engineering question into an inspectable, explainable, locally replaceable reactive topology whose steps carry inputs, outputs, semantic grounding, validation evidence, owner/context metadata, failure cause, and downstream impact.

The topology should be a preset/recipe, not a closed product. Developers, data engineers, analytics engineers, or platform teams should be able to assemble their own variant from GraphReFly building blocks.

GraphReFly should not replace dbt, Cube, Snowflake, ClickHouse, lakehouse engines, catalogs, or semantic-layer runtimes. It should sit around them as the reactive verification and orchestration graph:

```text
semantic/runtime systems + warehouse engines + catalogs + memory
        wrapped by
GraphReFly reactive topology + messaging hub + verifier + gates
```

---

## User Patterns and Pain Points

External research and product examples point to recurring enterprise pain:

- Users do not primarily want raw SQL. They want to find the right table, understand the definition, trust the result, and know how the answer was produced.
- Production text-to-SQL fails most dangerously when it returns a plausible but semantically wrong number.
- Business meaning usually lives outside the database schema: semantic layers, dbt models, BI definitions, docs, team conventions, verified query history, and human owners.
- Table/source discovery is a primary problem in large warehouses because duplicate, stale, deprecated, team-local, and derived tables coexist.
- Data users want guided workflows: source selection, reference queries, validation display, clarification, editable plans, and evidence before trusting an answer.
- Data engineers and analytics engineers already expect pipelines/assets to be inspectable objects with lineage, checks, freshness, retries, and failure state.
- Data context drifts: schemas change, metrics are redefined, owners move, event instrumentation breaks, and source-of-truth status expires.
- Enterprise platform teams care about governance, privacy, row-level access, credentials, budget, audit, and safe separation between read, write, delete, and admin operations.

These patterns imply that a serious Data Agent cannot be a single prompt or agent loop. It needs a topology with context, execution, validation, memory, and human/policy gates as first-class pieces.

---

## Runtime and Privacy Posture

A credible Data Agent preset should assume that enterprise data cannot leave the trust boundary. Async runtime is therefore a product argument, not just an implementation detail.

Recommended posture:

- Keep the visible GraphReFly topology local and inspectable.
- Push execution to an async/remote runtime close to the data when needed.
- Pass handles, result references, summaries, lineage, and validation evidence through the graph rather than pulling warehouse-scale rows into the Node process.
- Keep credentials out of agent-visible execution contexts; use adapter-side credential injection or platform-native identity.
- Treat write/delete/admin operations as separately gated capabilities, not as ordinary query execution.
- Make high-risk changes explicit topology or semantic-definition diffs that a developer/data engineer can review, modify, approve, or reject.

This directly answers the privacy and governance concern: GraphReFly can orchestrate and verify the workflow without becoming the place where sensitive data rows accumulate.

---

## Likely User Roles

- **Data engineers:** build and repair ETL/ELT steps, track lineage, enforce checks, manage retries, and inspect failures.
- **Analytics engineers:** preserve metric definitions, dbt/Cube/Semantic Layer mappings, freshness expectations, and downstream impact.
- **BI / growth / marketing analysts:** turn ambiguous business questions into grounded analysis plans and verified result narratives.
- **Data platform teams:** provide reusable harnesses, policy gates, cost controls, catalog adapters, and audit trails.
- **Application developers:** embed governed analytics workflows into internal tools without hand-building a data-agent harness.

The exact buyer/user split is still open. The likely builder is a developer, data engineer, analytics engineer, or platform engineer. The end user may be an analyst, marketer, product manager, support lead, or operator.

---

## Candidate Application Scenarios

### A/B Testing and Experiment Readouts

The preset grounds metric definitions, resolves cohorts and exclusion rules, checks sample windows and guardrail metrics, runs warehouse queries, validates effect-size / confidence assumptions, and produces a decision-ready evidence packet for product or marketing teams.

The value is not only computing a result; it is preserving the assumptions and checks that make a product or marketing decision defensible.

### Growth and Marketing Insights

Campaign, channel, cohort, funnel, retention, LTV, CAC, ROAS, and attribution questions become reusable verified pipelines instead of one-off SQL. The graph records source choices, attribution model, filters, date windows, and caveats.

This is a strong scenario because marketing decisions often combine ambiguous business language with operational urgency.

### Product Analytics and Funnel Diagnostics

Event schemas drift frequently. A verified pipeline can resolve event definitions, detect missing instrumentation, compare current versus historical funnels, and surface stale or deprecated events.

This is a natural fit for agentic memory: corrections to event semantics and known instrumentation issues should become durable facts with provenance.

### Revenue / Finance Metric Investigation

MRR, churn, expansion, refunds, bookings, revenue recognition, and cohort revenue questions require strict semantic grounding and auditability. The preset can force metric-source lookup and verifier evidence before emitting an answer.

This scenario has high value but also high trust requirements; it should be gated and evidence-heavy.

### Customer Support and Success Operations

Account health, incident impact, SLA breach analysis, customer usage anomalies, and renewal-risk analysis can combine warehouse facts, CRM context, ticket systems, and human approval gates.

This is a good multi-system context scenario: the answer usually crosses structured analytics, operational systems, and business ownership.

### Data Quality Incident Triage

When a dashboard breaks or a metric spikes, the graph can route through freshness checks, upstream asset checks, schema diffs, sample queries, lineage traversal, and owner notification.

This scenario shows GraphReFly as an operational harness, not just an analyst assistant.

### dbt / Semantic-Layer Assisted Development

The agent proposes model or metric changes as topology diffs, runs tests/freshness checks, validates downstream dependencies, and asks for approval before changing governed definitions.

GraphReFly should wrap deterministic semantic runtimes rather than compete with them.

### ClickHouse / Lakehouse Operational Analytics

High-volume event and log stores are a natural fit for handle-based execution: queries stay near ClickHouse, Iceberg/Delta/Hudi, or object-storage-backed engines while GraphReFly carries query handles, summaries, and validation events.

This scenario highlights async runtime and privacy: the graph coordinates work without pulling large result sets into the app process.

### Embedded Analytics for SaaS Apps

Product teams can expose natural-language analytics inside an app while routing through policy gates, tenant filters, row-level access checks, and verified semantic runtime adapters.

This is likely a developer-facing wedge for the preset because it packages a hard internal-platform problem behind reusable GraphReFly topology.

### Reverse ETL / Activation Workflows

A business question may end in an action list, not a chart. The graph can validate audience definitions, produce handles to eligible users/accounts, require approval, and then hand off to Braze, Salesforce, HubSpot, ad platforms, or internal systems.

This scenario must keep audience writes and external activation behind explicit gates.

### Governed Data Migration and Reconciliation

During warehouse migrations or semantic-layer rewrites, GraphReFly can compare old/new query outputs, track accepted deltas, preserve evidence, and route discrepancies to owners.

This is a strong engineering scenario because "verified pipeline" means repeatable reconciliation, not chat output.

### Agentic Memory / Context Curation

Verified queries, metric definitions, table summaries, owner corrections, failed validations, and deprecation signals become durable facts with provenance, confidence, validity windows, and refresh triggers.

This scenario connects Data Agent directly to GraphReFly's broader agentic-memory solution.

---

## Building-Block Mapping

- `MessagingHubGraph` is the dynamic substrate for data-agent events: questions, context requests, candidate sources, semantic facts, plan proposals, execution requests, execution results, validation findings, verifier verdicts, feedback, and dead letters.
- `PipelineGraph` is the stable human-readable workflow topology: task, classify, combine, approval gate, catch/recovery.
- `JobQueueGraph` / `JobFlowGraph` handle async execution and verifier stages with claim/ack/nack, retries, stage depth, and audit events.
- `agentMemory` / the reactive fact store provides agentic memory for business context, semantic definitions, table metadata, verified examples, deprecations, and user feedback.
- `guardedExecution`, policy gates, and approval gates preserve human control over high-risk semantic or warehouse actions.
- Future migration of legacy `@graphrefly/graphrefly` orchestration and messaging surfaces should treat the messaging hub as a foundation acceptance scenario: dynamic agent work should be represented as retained topics, cursor subscriptions, bridges, projections, and durable message facts rather than hidden chat state.

---

## Preset Shape Sketch

The likely `solutions/data-agent` starter should look like a configurable recipe:

```text
question
  -> intent / clarification
  -> context request
  -> catalog + semantic retrieval
  -> source ranking
  -> metric / entity grounding
  -> plan proposal
  -> policy or human approval
  -> query / transform execution
  -> validation checks
  -> independent verifier verdict
  -> answer / evidence packet
  -> feedback
  -> memory update
```

Candidate hub topics:

```text
questions
context-requests
context-candidates
semantic-facts
source-candidates
plan-proposals
query-drafts
execution-requests
execution-results
validation-findings
verdicts
answers
feedback
dead-letter
```

The design bias should be **dynamic data, stable topology**: route changing work through messages and handles; only propose topology or semantic-definition changes as explicit diffs that a developer/data engineer can review.

---

## Open Questions

- After the app-private Canvas wedge and B116's second independent scenario, does evidence justify a public `solutions/data-agent` preset, or should the result remain a Canvas recipe/cookbook composition over existing public building blocks?
- Is the primary builder persona a data engineer, analytics engineer, platform engineer, or application developer embedding analytics into a product?
- Which runtime adapter should prove the privacy story first: Snowflake, ClickHouse, DuckDB/local lakehouse, dbt Semantic Layer, Cube, or a generic handle-returning warehouse adapter?
- Should the first workflow end at a verified answer, a proposed topology diff, a dbt/semantic-layer PR, or a reverse-ETL activation handoff?
- How much agentic memory should be included in the preset versus left as an adapter contract?

---

## Research Inputs

This session incorporates:

- the 2026-06-04 research summary on semantic-layer/context-layer trends, dbt/Cube/Snowflake/Dagster/Airflow/Prefect positioning, and GraphReFly as a reactive verification substrate;
- the 2026-06-06 discussion of data-domain agent harness differences: external semantic ground truth, risk at data location, persistent domain context, independent completion verification, and model-tier routing;
- external user-pattern research around enterprise text-to-SQL, context layers, semantic runtimes, table/source discovery, data quality, and pipeline observability;
- local library inspection of `solutions`, `presets/harness`, `utils/messaging`, `utils/orchestration`, `utils/job-queue`, and `utils/memory`.
