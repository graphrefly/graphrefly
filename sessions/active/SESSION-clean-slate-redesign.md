# SESSION — Clean-Slate Redesign (L0–L6 full-stack greenfield)

**Status:** 🌱 DESIGN LOCKED (L0–L6) — implementation proceeds through the CSP sequencer
**Opened:** 2026-05-27
**Trigger:** User-initiated greenfield redesign on a NEW branch. Explicit terms: *no backward compat · no scope limit · all best practices · top-down design*. Follows the handle-dispatch substrate session (R1–R12) and the user's hypothesis that handle-dispatch can "resolve TS↔Rust parity altogether."
**Method:** Top-down 6-layer design (L0 Identity → L6 Distribution). Each layer fully locked before descending; **lower layers may not overturn upper layers**. Each lock may carry ≤1 hard constraint downward (recorded as `F-*` forced constraints). Forcing-question Q&A driven; every answer reformulated into a locked statement and confirmed.

**Relationship to prior work:**
- SUPERSEDES the incremental implementation-plan for the purposes of a clean-slate branch (does NOT delete the existing repo's plan; this is a parallel greenfield target).
- Builds directly on `SESSION-handle-dispatch-substrate.md` R8/R9/R10/R11/R12 (uniform handle table · callback-IS-wave · FactoryRegistry-as-primitive · DIRTY-as-consistency-primitive).
- **Resolves the parity hypothesis** at L3-Q7: parity moves from *structural* (`Impl` symbol set) to *behavioral* (protocol conformance). `docs/cross-track-ledger.md` retires.
- R11's pre-1.0 wedge (memory+harness) is **overturned** at L0.5 → horizontal narrow-waist, no wedge.

---

## How to read this doc

Each layer has a lockdown table. `F-*` = forced constraint propagated downward. `🔴` = open risk that was routed through `/design-review` or later backlog/design records. Strawman code is illustrative, not normative — the normative content is the lock tables plus the D# log.

This began as a pure design artifact, but the active implementation state now lives in the jsonl sources: `decisions/decisions.jsonl`, `plan/phases.jsonl`, `plan/backlog.jsonl`, `spec/rules.jsonl`, and `spec/conformance.jsonl`. Treat this markdown as narrative context; the structured records are the current sequencer.

### Recent spec/design locks

- 2026-07-29 D667-D668: expanded the still-open D642 local functional Workbench to the
  approved non-LLM Canvas product spine and locked its missing code boundary. D667 names a
  separately certified rootless-Podman local-untrusted-JS compute family rather than
  reclassifying hosted D612 E2B, the fixed D645 PostgreSQL workload, or the D614 iframe
  renderer. A fixed host compiler and runner admit immutable bounded JS/TS-derived bundles,
  expose only the runner-owned Graph's bounded answer/topology/describe/provenance, deny
  ambient npm/shell/network/filesystem/secret/datasource authority, and require fresh
  containers, exact cancellation and zero-residue cleanup. D668 keeps Code Pane drafts
  session-local, accepts immutable code WorkGraph revisions through an app-private SQLite
  CAS repository in the ephemeral profile, separates save/materialize/run authorization,
  treats runtime inspection as Lens primary truth, admits generated widget artifacts
  separately through D614, and requires real browser refresh/fresh-host reopen of code,
  historical result topology and pinned widget presentation. D624 Docker, hosted E2B,
  cloud/D615, M8, ClickHouse/M15 breadth and LLM integration remain deferred.

- 2026-07-24 B113.5/CSP-13 closeout: the approved D643 focused TypeScript
  record-use gate is complete through B113.1-B113.4, including strict
  request/decision data, complete synchronous identities, exact-one fail-closed
  cardinality, valid-denial-ready semantics, bounded material-free diagnostics,
  one immutable graph-visible snapshot and allowedRecords-only governed
  retrieval topology. The removable B113.5 comparison then exercised the real
  Another Hello ProductGathering continuation selector and transitions across
  exact current sources, blocking, purpose revocation, source deletion, stale
  and refreshed external decisions, and a non-empty JSON restart. Its retained
  probe proves exact source-id/version set equality from the application
  selector through gate and governed retrieval, plus a complete `describe()`
  topology with no raw-record bypass. That candidate deleted no product-policy
  computation, so its no-adoption finding applies only to the shallow
  selector-to-decision-to-gate wrapper. A separately approved disposable
  upstream experiment then modeled a temporary file-backed SQLite authoritative
  snapshot, a commit-pushed rebuildable Graph mirror, one eligibility projection
  shared by view/context/proposal/createPlan, and a declared
  create-plan-to-effect-request seam. It observed one selector evaluation per
  committed source or policy coordinate change, instrumented zero selector
  execution inside continuation transactions, duplicate-ref denial, stale
  source/policy failure, exact idempotency replay/conflict behavior, and exact
  rebuild after closing and reopening SQLite. SQLite/domain truth remains
  application-owned, but the transaction requirement is the atomic expected
  source revision, policy revision and idempotency/material fence—not mandatory
  full selector recomputation. Another Hello retained no production GraphReFly
  dependency or adapter and its product/domain contracts did not change. B113
  remains `done`; with B114 already done, CSP-13 remains `done` with
  `gap:false`. Another Hello HELLO-25/26 remain independently sequenced.

- 2026-07-23 D642: locked Canvas local-first productization to one finite,
  operator-owned ephemeral full-stack Workbench v0 before cloud/live work
  resumes. The profile keeps the private Control Plane host-local and composes
  digest-pinned Keycloak, SpiceDB, SPIRE, OpenBao, PostgreSQL, dedicated
  renderer-origin and the exact D613/D624 Docker family without becoming the
  D615 production topology. Per-run private bootstrap material stays outside
  the repository and browser; real canaries, existing authorization/admission/
  credential/runtime owners, fail-closed shutdown and terminal cleanup—not
  Compose health—establish connected-loopback evidence. The ordinary Workbench
  exposes only end-to-end wired functions, omits fixture-only or unimplemented
  capability, and may use only explicitly inert placeholders. Its global Help
  control is an accessible session-local guided tour over stable UI anchors,
  carries no operation or authority and adds no graph nodes or edges. Hosted
  E2B/D636, managed Kubernetes, customer-hosted workers, ClickHouse/M15 and M8
  remain deferred; the campaign cannot claim deployed, production-like,
  release-ready or live-certified posture.

- 2026-07-23 D641: locked B114 to the two approved persistence
  capabilities. Existing `attachObserveSink`/`attachObserveEventLog`,
  strict observe frames, and passive append logs remain the explicit
  selected-node/path Graph DATA persistence path; whole-graph capture is not
  default, and observation logs are audit/projection inputs rather than domain
  truth or restore authority. Reusable committed-fact mechanics move below
  vertical solutions as a focused application-infrastructure journal contract
  for canonical batches, whole-batch visibility, identity/material equality,
  ordered reads, distinct fact/backend cursors, normalized commit results, and
  bounded diagnostics. Domains retain their schemas, coordinates, validation,
  materializers, and source authority. AgenticMemory remains the first profile
  without generalizing `AgenticMemoryRecord`; a non-memory fixture must prove
  domain neutrality. Startup re-entry remains explicit caller-wired DATA, with
  automatic event sourcing, hot hydration, multi-writer, physical erasure,
  protocol, spec, and conformance outside this slice.
  B114 landed the same day: the selected observe-event path now requires an
  explicit path and projection and canonicalizes complete frames; the focused
  `@graphrefly/ts/committed-facts` journal owns strict batches, normalized
  outcomes, stream/backend cursor separation, bounded diagnostics and
  corruption checks; deterministic non-memory and AgenticMemory profiles prove
  neutrality; and raw plus insight startup materialization is exercised across
  separate cold Node processes. At that B114 landing checkpoint, CSP-13
  remained `impl` because B113 was still open; the dated B113.5 closeout above
  records its later completion.

- 2026-07-23 D640: locked a solution-level, externally authorized
  AgenticMemory use boundary. Admission remains the decision that candidate
  material may become record truth, application remains the evidence that the
  record changed, the new use gate decides whether one exact record version may
  enter one exact subject/purpose/scope use, and retrieval/ranking operates only
  over the gate's allowed records. Host/application authority supplies bounded
  decisions pinned to current record and source/policy coordinates; missing,
  duplicate, mismatched, stale, or denied decisions fail closed. Model output,
  similarity, confidence, and ranking cannot widen the allowed set. Another
  Hello remains an optional derived-only first consumer whose SQLite sources,
  audiences, purposes, corrections, and deletions stay authoritative; WorkItem
  scope/relevance is the second concrete consumer. D588-D594 committed fact-log
  persistence can later supply restored records to the same gate, but D640 does
  not change fact families, hot hydration, physical deletion/redaction, storage
  authority, protocol, or conformance. CSP-13/B113 owns later separately
  approved TS implementation, while B114 tracks portable durable
  fact/memory/insight persistence hardening over the existing adapters.

- 2026-07-23 D643: locked B113's exact v1 record-use gate contract. One
  static gate instance represents one exact use and consumes current records,
  one strict request, and external decisions. Strict-canonical request and
  complete-record identities carry currentness synchronously; domain revisions
  remain request source coordinates rather than a second owner-version truth.
  Every input record requires exactly one matching decision, including a
  fail-closed identical-duplicate rule, while a valid denial is a successful
  evaluation rather than a gate error. One immutable snapshot projects bounded
  allowed records, exclusions, status, issues, audit, and an evaluation/count
  cursor that is distinct from identity, revision, storage, and fact-stream
  cursors. Governed consumers wire only allowed records into retrieval, and
  multiple uses remain multiple inspectable gate instances. B113.1-B113.4 are
  now design-ready but still require separately approved implementation.

- 2026-07-27 B112.6.1 (TS commit e1301aba): completed the separately approved private empirical
  prerequisite contract model under D638-D639. The TS-only eval-support surface
  now validates an exactly-five-task synthetic 3+2 catalog shape, semantic task
  uniqueness, clean single-baseline qualification observations, a closed
  task/profile- and harness-bound verifier-evidence set, explicit one-provider
  binding coordinates, isolated actor/judge/redactor authorities, hierarchical
  budgets, canonical report/catalog digests, and a fail-closed frozen-manifest
  gate. Fixtures are calibration-only placeholders; actual observations remain
  ignored private evidence by default. No provider invocation, real task
  freeze, worktree runner, protection pipeline, trial observation/scorecard
  persistence, public/package/runtime API, deterministic correctness change,
  Demo/web surface, protocol/conformance change, or cross-language work entered
  this slice. B112 remains open for separately approved B112.6.2+ work.

- 2026-07-27 D652: locked B112's private semantic model boundary to one
  explicit model turn. The host runner owns the agent/tool loop, tool
  execution, later calls, step and budget ledgers, timeout/cancellation policy,
  worktrees, persistence, verification, and memory lifecycle. The port accepts
  one strict bounded manifest/task/trial/role/step-bound request and emits
  either structured output or declared tool intents plus bounded
  provider-neutral status, usage, latency, evidence, issues, and protection
  receipt. Focused provider bindings require explicit credential capabilities;
  no credential material, ambient environment lookup, hidden retry/fallback,
  raw provider response, provider registry, callback engine, public API, Graph
  node, or protocol surface enters the contract. B112.6.2 is authorized only
  for private contracts, validators, and deterministic fake-binding evidence;
  the first real provider/model binding and remote invocation remain separately
  approved future work.

- 2026-07-27 D653: closed B112.6.2 QA design findings. The frozen manifest
  owns a bounded private strict-json-shape.v1 catalog whose canonical material
  and digest are copied into each turn and validated without a hidden registry;
  the package-private validator checks final structured output and tool
  arguments itself. Source-ingress, tool-ingress, and model-egress protection
  receipts bind the exact material digest and frozen policy but make no durable
  receipt or perfect secret-detection claim. Remote request count is 0 or 1,
  completed outcomes require one request, token nullability depends on the
  frozen usage source, and missing required usage is non-evaluable. Step index
  is bounded by configuration plus agent-run step/request limits; canonical
  output and host-measured bytes both obey the remaining byte budget. Validation
  consumes B112.6.1's frozen-manifest wrapper and qualified report. No real
  provider, network, store, schema SDK/registry, public API, Graph node, or
  protocol/cross-language surface is authorized.

- 2026-07-27 D654: resolved the one-turn structured-output null ambiguity.
  The private strict-json-shape catalog keeps null available recursively for
  nested values, tool arguments, structured input, and tool results, while a
  role output schema root must not semantically accept JSON null. The existing
  `structuredOutput: null` remains the unique no-output sentinel; no presence
  flag, nullable-value envelope, provider sentinel, or outcome version is
  added. A future empirical requirement for completed root-null output must
  trigger a separately approved versioned presence design.

- 2026-07-27 B112.6.2 (TS commit 3c60a2df): completed the private one-turn
  semantic model contract under D652-D654. The frozen qualified manifest owns
  exact bounded tool/output schema material; requests bind protected structured
  input and prior host tool results; outcomes bind protected structured output
  or tool intents plus honest 0-or-1 request usage, latency, evidence, and
  remaining step/token/byte budgets. Root-null role outputs are rejected while
  nested and tool null values remain valid. Structural and arbitrary strict
  JSON validation rejects executable descriptors, sparse/non-index material,
  cycles, excessive depth/nodes/bytes, and huge sparse lengths without
  unbounded scans. A deterministic fake proves explicit credential capability,
  exact request matching, and host cancellation without adding a real provider
  or hidden loop. Focused tests (20), full TS tests (1923 passed, 1 skipped),
  lint/typecheck/raw-async, build/export smoke, privacy/topology scans,
  `git diff --check`, two-agent adversarial QA, and dashboard consistency
  passed. B112 remains open for separately approved real provider invocation,
  final task freeze, worktree/protection execution, host runner, and empirical
  observation/scorecard persistence.

- 2026-07-27 D655: locked truthful blocked model-egress evidence without
  expanding the private one-turn outcome v1 shape. One synchronous local-first
  protection capability serves the contracted source-ingress, tool-ingress,
  and model-egress stages. Allowed model completions keep their receipt bound
  to canonical published egress; a blocked bounded provider candidate produces
  a non-evaluable outcome with no model output or tool intents, exactly one
  model-egress-blocked-subject evidence ref bound to the candidate digest, and
  one blocked receipt bound to that same digest. Raw candidates, matched
  material, provider objects, secrets, and unprocessed errors are not
  persisted. Non-protection failures protect sanitized failure egress, policy
  execution failures fail closed as protection non-evaluable, and receipts
  remain neither durable nor proof of perfect detection. D655 authorizes the
  design lock only; protection implementation, provider binding, and network
  invocation remain separately approved B112 work.

- 2026-07-27 B112 provider rollout approval: the intended focused-binding
  roster is OpenAI, Anthropic, Google Gemini, xAI/Grok, DeepSeek,
  Moonshot/Kimi, Zhipu/GLM, and OpenRouter. This records the target roster and
  staged order, not simultaneous implementation or a provider registry. D639
  remains unchanged: after D655 protection implementation, OpenAI is the sole
  first binding/smoke; Anthropic is the materially different second-provider
  semantic-port smoke; Gemini, Grok, DeepSeek, Kimi, and GLM follow as
  separately approved focused bindings; OpenRouter follows last with explicit
  downstream route/model identity and no hidden fallback. Each runner remains
  constructed for one exact binding, provider/model/endpoint/adapter/usage/
  pricing coordinates remain frozen per campaign manifest, and no generic
  OpenAI-compatible adapter, mega union, dynamic discovery, public provider
  SDK, simultaneous first wave, or cross-provider token-unit comparison is
  authorized.

- 2026-07-23 D639: locked B112's empirical experiment protocol. One
  preregistered matched trial block runs a real cold attempt and, only after an
  independently verified eligible task failure, fans the same immutable cold
  evidence into five fresh-worktree warm arms: relevant-applied,
  proposal-only, admission-rejected, irrelevant-applied, and
  wrong-scope-applied. Proposal-only is the primary natural-retry control;
  provider, infrastructure, cleanup, protection, and unverifiable-verifier
  outcomes remain visible but non-evaluable. The first calibration catalog is
  five immutable graphrefly-ts tasks (three historical pre-fix regressions and
  two held-out defect overlays), with no result-driven replacement. Closed
  executable verifier profiles reuse WorkItem acceptance and verification
  vocabulary without exposing treatment, memory, expectations, planner
  verdicts, or auxiliary model judgment. Campaign aggregation reports paired
  relevant-memory lift, each negative-control contrast, task-clustered
  versioned intervals, conformance, attribution, non-evaluable rate, cost,
  latency, and provider-scoped usage. Smoke, calibration, and preregistered
  confirmatory profiles remain distinct; private manifest, trial-observation,
  and campaign-scorecard v1 artifacts do not alter D635 publication truth.
  B112 remains open pending separately approved implementation.

- 2026-07-23 D638: locked CSP-11's private empirical solution-eval
  execution and evidence boundary. Real-model lanes reuse the D626/D627
  cases, independent verifier, predicates, and scorecard through one
  provider-neutral semantic model port plus focused runtime-private bindings.
  Token usage remains scoped to provider/model/endpoint/adapter and optional
  tokenizer coordinates rather than becoming a false cross-model unit. Cold
  and warm runs use separate fresh worktrees from one immutable repository
  snapshot, with graph-visible admitted/applied/retrieved memory as the only
  intended treatment. Protection is staged and local-first; only sanitized
  strict-JSON artifacts persist by default, while any future raw debug vault
  remains explicit, encrypted, host-retained, and outside Graph DATA. Actor,
  auxiliary judge, and semantic redactor keep separate policy/input authority;
  model judgment never overrides the independent verifier or family verdict.
  B112 owns the remaining experiment-protocol design and later separately
  approved implementation; B106 remains presentation-only.

- 2026-07-15 D626-D627: locked CSP-11's private, evidence-first solution
  eval program and the B105 deterministic v1 evidence/verdict contract. Planner
  owns only route plus structured trace; deterministic executor outcome and an
  independent WorkItem-criteria verifier establish cold/warm truth; reflector,
  mapper-only bridge, AgenticMemory admission/application, retrieval, and warm
  rerun remain separately attributable. Actual stage predicates, case-specific
  expectation, case conformance, and family verdict are distinct; the relevant
  applied-memory case alone uses the canonical four-predicate positive gate,
  while four required negative controls may conform through expected warm
  failure. Cold/warm equivalence uses the strict-canonical WorkItem SHA-256
  digest plus fixed world/planner/executor/verifier revisions. Private strict-
  JSON v1 observations and family scorecards report same-input, prior-route
  avoidance, relevant-memory lift, verifier-derived false-positive rate, exact
  trace attribution, and proposal/admission/application stage counts. No public
  Eval/testing SDK, D610 reuse, model/provider/CLI lane, Demo 6, web surface, or
  protocol/spec/conformance change is authorized.

- 2026-07-08 D594: locked the AgenticMemory concrete committed fact-log
  backend policy. Concrete reference backends may implement the existing D592
  backend adapter contract directly; no separate reference-backend policy DTO is
  required before the first concrete adapter. Concrete backends may choose
  physical schema, transaction boundaries, storage keys, writer mode, and
  durability attempt strategy, but their only GraphReFly-facing semantic
  operations remain append canonical committed fact batches and read committed
  facts in fact-stream order. Fsync/transaction guarantees, writer mode,
  storage cursors, row ids, health, and capabilities may appear only as backend
  status, issue, and audit DATA. The first reference backend should be
  single-writer unless it uses an explicit passive conditional-create
  capability. Multi-writer correctness, retention, deletion, redaction,
  migration, encryption, auth, retry schedulers, hot refresh, restore
  lifecycle, and graph commit barriers remain separate reviewed designs.
  Backend row ids and storage cursors must never be fact-log cursors, and
  uncertain append remains unresolved until explicit read/idempotency
  resolution.

- 2026-07-08 D593: locked the AgenticMemory materialized fact-log
  bootstrap and restore-input boundary. AgenticMemory may expose explicit
  bootstrap/re-entry composition helpers that accept already-materialized D591
  records, priorEvidence, evidence, status, issues, audit, and cursor DATA and
  project caller-wirable inputs for later admission, application, bootstrap, or
  restore-input flows as ordinary graph DATA. These helpers may validate
  readiness and partial-read status, expose status/issues/audit/cursor, and
  require caller-visible wiring. They do not read storage, call backends,
  mutate live graph caches invisibly, refresh subscribers, bypass
  admission/application ownership, feed current-evaluation application
  decisions back into the same evaluation, claim restore completion, or create
  graph wave/batch commit barriers. Any protocol-observable graph
  restore/hydration lifecycle integration routes through spec-amend against
  R-restore/R-snapshot.

- 2026-07-08 D592: locked the AgenticMemory committed fact-log backend adapter
  contract. AgenticMemory may expose a narrow adapter contract whose only
  GraphReFly-facing semantic operations are append canonical committed fact
  batches and read committed fact results in fact-stream order. Adapters may own
  physical transactions, durability attempts, storage cursors, diagnostics, and
  environment-specific capabilities, but normalize public results to D589
  append/read result DATA. They must not materialize records, replay facts into
  application state, apply/admit/mutate records, own restore/bootstrap, expose
  backend row ids as fact cursors, hydrate live graphs, refresh subscribers, or
  act as graph commit barriers.

- 2026-07-08 D591: locked the AgenticMemory fact-log read
  materialization re-entry boundary. AgenticMemory may expose explicit
  solution-level DATA projections over D589 committed fact-log read results:
  the library owns validation, stream-order materialization, status, issues,
  audit, and cursor facts, and may emit ordinary records, priorEvidence, and
  evidence DATA for callers to wire into later admission, application,
  bootstrap, or restore inputs. Backends only supply read results; they do not
  replay, apply, admit, mutate records, choose conflict winners, hydrate live
  graph state, refresh subscribers, or own restore/bootstrap semantics.
  Re-entry is explicit and caller-wired, not hot hydration, live graph truth
  mutation, same-evaluation feedback, or a graph wave/batch commit barrier.

- 2026-07-07 D590: locked the AgenticMemory durable-result gate
  boundary. AgenticMemory may expose a solution-level DATA read model over
  D589 committed fact-log append/read results so downstream application
  workflows can explicitly gate on durable persistence progress. The gate may
  emit durability result, status, issue, audit, and cursor facts, but those
  facts describe fact-log persistence only: they are not application
  acknowledgements, live graph truth, record mutation authority, hot hydration,
  or graph wave/batch commit barriers. `uncertain` remains neither success nor
  failure and must resolve through read/idempotency. Backend transaction,
  retry, retention, auth, live refresh, hot hydration, and protocol-observable
  commit-barrier behavior remain later reviewed/spec-amend designs.

- 2026-07-07 D589: locked the AgenticMemory committed fact-log v0
  contract. The log appends canonical AgenticMemory-owned fact batches with
  deterministic fact/material identity, whole-batch visibility, stream cursors,
  closed commit statuses (`committed`, `duplicate`, `conflict`, `rejected`,
  `uncertain`), and library-owned deterministic materialization from committed
  facts. Commit results describe durable fact-log persistence only: they are
  not application acknowledgements, live graph truth, or record mutation
  authority. SQLite schemas, hot hydration, graph commit barriers, retention,
  migration, and authorization remain later reviewed designs.

- 2026-07-07 D588: locked AgenticMemory durable fact-log authority.
  Durable stored facts may become the source of truth for memory state, but
  the authority is the canonical committed AgenticMemory fact stream, not an
  adapter callback, live graph cache, application output snapshot, or backend
  storage handle. The library owns schemas/codecs, ordering/cursors,
  idempotency/conflict rules, replay/materialization rules, and snapshot/tail
  compaction invariants. Hosts own physical backends and concrete durability,
  transaction, retention, backup, and deployment policy. Commit-barrier and
  hot-hydration APIs remain separate reviewed designs.

- 2026-07-05 D587: locked WorkItem-to-AgenticMemory admission/application
  composition into a separate cross-family solution surface. The
  WorkItem-memory bridge remains mapper-only under D581/D582, and AgenticMemory
  core remains independent of WorkItem. The composition recipe may wire bridge
  proposal outputs into AgenticMemory-owned admission/application helpers, but
  it does not own policy selection, record truth mutation, storage, hydration,
  providers/runtimes, WorkItem mutation, or D584 same-evaluation evidence
  self-feedback.

- 2026-07-05 D583-D586: locked the next AgenticMemory application-boundary
  expansion set. Admission policy sourcing is an AgenticMemory-owned DATA
  projection boundary, not WorkItem bridge authority. Application evidence and
  history project prior evidence for future evaluations, while current
  application decisions must not synchronously self-feed the same application
  evaluation. Durable record hydration/storage stays adapter/host-owned with
  AgenticMemory limited to passive DATA-only snapshot/store-frame/codec helpers.
  Update/replace sources must materialize complete next records before
  application; true patch/merge remains deferred to a later AgenticMemory-local
  design and must not become a generic mutation DSL.

- 2026-07-04 D579: locked AgenticMemory application material identity and
  operation-scoped status. Application evidence carries a DATA-only canonical
  material identity for the complete candidate application material, and
  idempotency requires both operation/version/id coordinates and material
  identity to match. Operation-scoped application status is a read-model over
  decisions while aggregate status remains available for whole-evaluation
  health. No storage, hydration, provider/runtime, permission, WorkItem, graph
  handle, protocol, patch, or merge semantics are introduced.

- 2026-07-02 D570: locked the Rust `from_sse` adapter-local parser contract
  over the D567/D568 HTTP stream fallback. The parser accumulates chunks across
  boundaries, decodes UTF-8 incrementally, accepts CRLF/CR/LF, ignores comment
  and unknown fields, splits field lines on the first colon, strips one leading
  value space, dispatches only data-bearing events on blank lines, joins
  repeated `data` fields with newline, maps `event`/`id`/valid decimal `retry`
  into `SseEvent`, and dispatches a buffered data-bearing event before stream
  `Complete`. The HTTP fallback accepts 2xx `text/event-stream` heads with
  parameters, while unacceptable heads, invalid UTF-8, or parser overflow emit
  adapter `ERROR` and cancel/ignore the stream per D569. The parser remains
  private to `from_sse` with no public parser type, generic text-event stream,
  retry/reconnect scheduling, Last-Event-ID management, provider/runtime
  authority, or protocol/conformance behavior.

- 2026-07-02 D569: locked the Rust `LocalHttpStreamDriver` lifecycle
  contract. A stream invocation emits exactly one `Head`, then zero or more
  `Chunk` events, then exactly one terminal `Complete` or `Error`; setup or
  head-acquisition failure may emit exactly one `Error` before any `Head`.
  Chunks cannot precede `Head`, a second `Head` is invalid, and callbacks must
  not fire after driver terminal delivery or after cancel takes effect. Driver
  callbacks may occur synchronously before `DriverCancel` is returned, so source
  adapters must fence active/terminal state independently of cancel-slot
  installation. Typed adapters own semantic `Head` acceptance and must ignore
  later chunks after rejection while canceling once possible. The driver owns no
  retry, reconnect, scheduler, parser, backpressure authority, domain truth, or
  graph mutation authority.

- 2026-07-02 D568: locked Rust `from_sse` over the D567 HTTP stream
  capability. `from_sse` / `from_sse_with_options` resolve through a typed
  override plus stream fallback: an installed `LocalSseDriver` wins and
  preserves host-parsed/test protocol hooks; otherwise `LocalHttpStreamDriver`
  lowers the SSE request to an HTTP GET stream, adds `Accept:
  text/event-stream` when absent, validates response head material, and parses
  chunks into `SseEvent` inside the source adapter. Official concrete runtime
  support should implement `TokioHttpStreamDriver`, not a separate
  `TokioSseDriver`. The parser remains adapter-local and does not become a
  public generic stream parser, provider/runtime adapter, retry/reconnect
  scheduler, or WebSocket session replacement.

- 2026-07-02 D567: locked the Rust B72 EnvironmentDrivers streaming runtime
  boundary. Rust should add a narrow graph-owned HTTP byte-stream capability
  (`LocalHttpStreamDriver` over response head/chunk/error/complete events, with
  optional concrete drivers such as `TokioHttpStreamDriver`) rather than a broad
  `RuntimeDriver` abstraction. Typed source adapters such as `from_sse` may use
  this capability to parse protocol-specific events, while preserving existing
  typed `LocalSseDriver` compatibility as needed. The capability is
  inbound/network-only boundary work: it does not execute providers, own
  schedulers, mutate graph truth, expose runtime handles, create generic sinks,
  replace WebSocket session semantics, or merge with Dispatcher WorkerPool or
  wire-bridge responsibilities.

- 2026-06-30 D565: locked Canvas graph-built implementation and
  `dev-dispatch` topology delta reporting. Canvas implementation should
  default to named `@graphrefly/ts` graph bundles for nontrivial Workbench or
  product behavior whose state, dependency, execution-visibility, or review
  shape is graph-like. Durable graph-built slices should expose stable graph
  names, topology group names, node names, and `graph.topology()` /
  `graph.describe()` snapshots or fixtures so implementation progress can be
  reviewed as real added, removed, or changed nodes and edges. `dev-dispatch`
  rounds touching graph-built surfaces must report a real topology delta when a
  before/after inspection source is available, and must separately label
  product overlay deltas. Docs-only, pure DTO/schema/type, static copy,
  CSS/layout, React-only, or fallback semantic projection work must say that no
  real graph delta is available and why. This does not force every UI or data
  record into a graph node, and it does not allow Canvas-owned API, provider,
  storage, credential, runtime, WorkItem mutation, or graph-truth mutation
  authority to move into `@graphrefly/ts` or Canvas UI.

- 2026-06-30 D564: locked the Canvas graph-first Topology Lens and
  WorkGraph construction correction. Canvas Topology Lens primary topology
  truth is the live `@graphrefly/ts` inspection surface:
  `graph.topology()`, `graph.describe()`, boundary inspection, or a
  host-admitted snapshot derived from those surfaces. Canvas feature logic
  should prefer named graph bundles and graph-visible projection facts so the
  lens reveals the real construction graph. The D390 `deriveWorkspaceTopology`
  path is superseded as the default lens source and may remain only as product
  semantic overlay, compatibility/fallback material, or annotation over real
  graph nodes/edges. WorkItem, WorkGraphRef, widget, review, evidence, and host
  feedback records remain data/ref material under D537-D539/D555, not live
  runtime handles or mutation authority. Any future durable WorkGraph,
  topology, scope, or control-panel slice must state whether its topology source
  is real graph inspection, product overlay, or fallback semantic projection.

- 2026-06-30 D563: locked the public website and docs migration
  architecture. `graphrefly.dev` is the curated external developer docs site,
  not the full internal authority dashboard. Public pages render user-facing
  views from selected structured records: learn/getting-started, concepts,
  composition patterns, examples, package entry points, and curated reference
  guarantees. The full decisions/rules/backlog/sessions/gaps/conformance
  control surface remains in the generated dashboard and raw repo records for
  maintainers. New shared docs content defaults to structured guide-local JSONL
  records with audience/publicness metadata; legacy `GRAPHREFLY-SPEC.md` and
  `COMPOSITION-GUIDE*.md` remain migration/reference material until extracted,
  then archived or removed. Language API docs, examples, demos, generated refs,
  and release/install docs remain package-local in TS/Python/Rust repos.

- 2026-06-29 D562: locked B101 inbound WireEdgeGroup
  adapter-projector drain-before-tombstone/reset. After B98/C-1 closeout,
  inbound WireEdgeGroup strengthens the timing target from private release
  cohort admission/enqueue-before-tombstone to adapter-local projector drain:
  the adapter-owned inbound edge projectors must consume the complete private
  release cohort before the cause is marked released, its released-cause
  tombstone is added, or active cause state is reset. This is not arbitrary
  downstream graph drain; application downstream nodes, external subscribers,
  pause/resumeAll replay, batch/boundary-task consequences, downstream throws,
  and cross-graph effects are outside the adapter-local guarantee. Full graph
  downstream drain remains spec-amend-only (rules + formal + conformance before
  code). Host pumps remain FIFO byte transport only: no ACK/filter/dedupe/repair
  timers/schedulers, payload-equality stale dedupe, WireEdgeFrame lineage,
  protocol tier/message/verb/ctx expansion, raw command/native handles,
  Node.up/down, or ctx.up/down exposure.
- 2026-06-29 B98 closeout accepted after explicit audit. C-1 runtime arms are
  all pass (TS/Rust/Python), D558/D559 bridge boundary discipline and
  D560/D561/D562 WireEdgeGroup behavior have runtime evidence, and TS
  tests/lint/build plus dashboard check passed. B98 is resolved only for the
  accepted admission/enqueue-before-tombstone timing; stronger release-drain
  before tombstone remains a separate future design/spec question.
- 2026-06-29 C-1 TS arm accepted after the D560/D561/D562 equivalence
  and mixed-locality umbrella proof. `graphrefly-ts`
  `packages/ts/src/__tests__/wire-bridge.protobuf-d497.test.ts` proves the
  equivalent TS shape with `A,D` in `g1`, `B,C` in `g2`, public `wireBridge`
  plus `wireBridgeProtobuf` plus `WireEdgeGroup` adapters, canonical protobuf
  bytes at the host transport boundary, deterministic FIFO byte pumps, fresh
  stimulus cause material, diagnostic-only partial inbound progress, one
  coherent return-leg cohort release, and exactly one `D` join on the stimulus.
  Focused TS tests cover D560/D561/D562 fresh outbound admission and inbound
  release-lane isolation. This flips `C-1.runtimes.ts` to pass; py/rust remain
  pass. B98 closed only after the later explicit closeout audit above.
  D562 TS release-lane timing is interpreted as successful graph message-flow
  admission/enqueue before tombstone/reset, not a stronger drain-barrier
  guarantee that downstream projectors have already run under every batch/pause
  interleaving. A future drain-before-tombstone semantic would need explicit
  design/spec authority and is not part of the accepted C-1 proof.
- 2026-06-29 C-1 Rust arm accepted after the full mixed-locality bridge
  diamond proof. `graphrefly-rs`
  `crates/graphrefly/tests/c1_mixed_locality_harness.rs` proves the equivalent
  Rust shape with `A,D` in `g1`, `B,C` in `g2`, public `wire_bridge` plus
  `WireEdgeGroup` adapters, canonical protobuf bytes at the host transport
  boundary, deterministic FIFO byte pumps, fresh stimulus cause material,
  diagnostic-only partial inbound progress, one coherent return-leg cohort
  release, and exactly one `D` join on the stimulus. This flips only
  `C-1.runtimes.rust` to pass; `C-1.runtimes.ts` remains todo and B98 remains
  deferred until the TS umbrella arm has equivalent evidence.
- 2026-06-29 C-1 Python arm accepted after the B98/D562 proof review.
  D562 was treated as a D496/D558-D561 adapter-local implementation slice,
  not a new architectural decision: inbound WireEdgeGroup progress, issues,
  and status remain diagnostic lanes, while inbound edge projectors now observe
  one private cohort-valued release lane for a completed remote cause. The
  Python full mixed-locality harness proves the public facade shape with `A,D`
  in `g1`, `B,C` in `g2`, deterministic FIFO protobuf byte pumps, fresh
  outbound causes, diagnostic-only partial inbound progress, one coherent
  return-leg cohort release, and exactly one `D` join on the stimulus. This
  originally flipped only `C-1.runtimes.py` to pass; the Rust acceptance is
  tracked in the 2026-06-29 Rust line above, `C-1.runtimes.ts` remains todo
  in this historical line because equivalent full mixed-locality bridge diamond
  evidence had not yet landed at that point.
- 2026-06-28 D561: locked outbound WireEdgeGroup fresh-source
  admission. Fresh-cohort admission is event-origin based: one initial
  lifecycle bootstrap cohort may be admitted from the first complete edge DATA
  set, but after a cause has emitted, new causes require dependency DATA
  occurrences produced by fresh graph events since the previous cause.
  Activation/current snapshot replay, late-subscriber drain, retained values,
  and status/diagnostic replay cannot by themselves admit a new cause.
  Freshness is not payload equality, so a fresh occurrence with the same bytes
  remains eligible. Inbound WireEdgeGroup stays a structural cause lifecycle
  gate only, and host pumps remain deterministic FIFO byte transport.
- 2026-06-27 D560: locked outbound WireEdgeGroup fresh-cohort cause
  formation. A new outbound wire-edge cause is emitted only after every
  expected outbound edge has produced fresh DATA since the previous cause;
  retained snapshots are diagnostics/status material only and cannot fill a
  missing edge. Partial cohorts stay adapter-local as nonterminal status/issues,
  do not emit protocol terminals, and do not ask the host pump to filter,
  dedupe, repair, schedule, or sleep. Duplicate same-edge DATA before cohort
  completion keeps the latest fresh value, completion emits DIRTY for all
  expected edges followed by DATA for all expected edges, and SENTINEL or
  invalidation clears pending/retained material without producing a wire cause.
- 2026-06-27 D559: locked the B98/C-1 implementation contract details under
  D558. Wire-admissible bridge DATA is limited to copied canonical bytes,
  canonical WireEdgeFrame material, or strict JSON-like material; undefined,
  NaN/infinities, -0, subnormal/unsafe integers, bigint, symbols, functions,
  accessors, class instances, non-plain prototypes, Date/Map/Set/Error/Promise
  or thenables, sparse arrays, symbol keys, cycles, Node/Ctx handles, live
  topology, mutable graph-owned state, raw command sources, host runtime objects,
  and pending/diamond accounting are rejected as status/issues. Remote-call
  orphans emit issue/status and are never buffered for future calls; only
  matching terminal result/error consumes pending, while matching status is
  non-terminal. TS keeps the focused `wireBridgeAckDriver(graph, bridge,
  {clock, timeoutMs, name?})` shape with private ack-timeout command projection.
  The Python C-1 replay probe is decode-only FIFO-pump diagnostics carrying
  session/seq/attempt/edge/cause/kind fields and must not filter transport.
- 2026-06-27 D558: locked the B98/C-1 bridge boundary discipline. B98
  closes through adapter/application boundaries, not wave-protocol changes:
  wire bridge payloads must be approved semantic DATA material and fail closed
  as status/issues when invalid; remote-call responses may satisfy only a
  currently pending request correlation and unknown early responses are never
  buffered for future requests; ack timeout/retry ingress is driven by explicit
  graph-visible clock/readiness/timeout facts through adapter-owned drivers; and
  old-cause DATA replay is blocked at the WireEdgeGroup cause lifecycle gate,
  not by host pump filtering. C-1 remains todo until the full two-graph
  mixed-locality diamond proves exactly-one join end to end.
- 2026-06-26 D555: locked the Canvas host-derived display DTO and typed
  follow-up intent consolidation boundary.
  D543-D554 are superseded by D555 in the canonical decision log; their
  detailed historical records remain in decisions.jsonl, but this active view
  treats them as one consolidated host-derived DTO plus typed-follow-up-intent
  pattern. For remaining Workspace surfaces that
  merely display host-derived state, explain status, summarize activity/audit/
  history, show diagnostics, expose non-authoritative recommendations, or offer
  follow-up affordances over already-admitted refs, Canvas may use a single
  consolidated pattern: data-only host-derived display DTOs plus D519 typed
  follow-up intents. Such DTOs may include bounded ids, kinds, actor refs,
  target refs, source refs, summaries, timestamps/freshness, status/result/
  evidence refs, visibility/redaction posture, reason/diagnostic summaries,
  capability/policy refs, idempotency material when the DTO is an affordance,
  and audit/status refs. Workbench may display, filter, group, sort, navigate,
  preview, explain, dismiss, snooze, request details, and emit typed follow-up
  intents such as retry, refresh, restore, request access, request detail,
  create follow-up, link, annotate, export, import, or otherwise ask the host to
  act. Workbench must not replay activity, reconstruct truth from history, own
  audit logs, infer hidden state from summaries, persist authoritative state
  directly, mutate WorkItems, mutate graph truth, change policy, grant
  permissions, approve reviews, alter queue/promotion/verification state, access
  providers/storage/artifacts/runners/sandboxes, execute runtimes, install/
  promote components, or treat display DTOs as command/callback/runtime handles.
  Hosts own admission, authorization, derivation, ordering, retention, redaction
  /privacy filtering, persistence, idempotency/deduplication, audit integrity,
  detail access, execution, mutation, notification, and downstream effects. A
  new D# is required only when a future Canvas surface introduces a new
  authority boundary, persistence/truth class, runtime/provider/credential
  access path, component/sandbox lifecycle, review/permission/policy semantics,
  graph/WorkItem mutation route, or generic registry/DSL/execution mechanism.
- 2026-06-26 D541: locked the Canvas widget draft and local state boundary.
  Canvas may define widget draft and local-state DTOs for transient or
  host-admitted persisted UI interaction state on pinned widgets and Workspace
  surfaces. Such DTOs may describe widget id, slot id, draft kind, bounded draft
  value summary, validation display, dirty-since summary, actor ref, session or
  persistence scope, target refs, status summary, conflict/freshness summary,
  selection/focus/expansion/filter/sort/pagination posture, wizard/confirmation
  posture, and audit/status refs when host-admitted persistence is involved.
  Workbench may own session-local draft, focus, selection, expansion, temporary
  filter/sort, unsaved form, inline-edit, confirmation, and optimistic visual
  state, and may render host-admitted project-persistent or shared draft DTOs.
  Draft/local state is not substrate DATA, graph truth, WorkItem/WorkGraph
  truth, workflow/policy rule, review/promotion decision, permission grant,
  credential ref, runtime state, provider/storage state, generated truth, widget
  action execution, or project setting unless and until a host admits and
  persists an explicit project-scoped DTO. Save, submit, apply, clear, restore,
  share, discard, conflict-resolve, or convert-to-project-state operations must
  be expressed as D519 typed intents and admitted by the host. Hosts own
  project/shared draft admission, authorization, authoritative validation,
  conflict detection/resolution, persistence, audit, idempotency/deduplication,
  status reporting, and downstream effects.
- 2026-06-25 D540: locked the Canvas widget action and control intent
  boundary. Canvas may define data-only widget action and control descriptors
  for host-admitted controls on pinned widgets and Workspace surfaces. An action
  descriptor may include action id, action kind, label/icon summary, widget id,
  slot id, target refs, capability ref, input summary, precondition/status
  summary, confirmation posture, approval/audit/status refs, and idempotency
  material. Widget action descriptors are affordance and intent material only,
  not callback/function props, raw command strings, shell/path/token material,
  provider/storage queries, runtime handles, workflow/policy rules, permission
  grants, credential refs, review/promotion decisions, graph mutation authority,
  WorkItem mutation authority, generated truth, or component registry authority.
  Workbench may render admitted actions, display enabled/disabled/pending/
  needs-approval/result status, keep session-local focus/draft/confirmation UI
  state, and emit D519 typed intents when the user triggers an action. Hosts own
  action admission, authorization, validation, approval gates, execution,
  batching/retry/cancellation semantics, audit, idempotency/deduplication,
  status/result/evidence production, and all downstream effects.
  Generated/sandboxed/custom widgets may consume only admitted action
  descriptors and emit only typed intents; malformed, missing, stale,
  unauthorized, unsupported, over-cap, or precondition-failed actions fail
  closed as diagnostics and disabled affordances.
- 2026-06-25 D539: locked the Canvas widget input/output binding boundary.
  Canvas may define data-only widget input/output binding descriptors that map
  widget slots to admitted refs and host-derived display material. A binding
  descriptor may include widget id, slot id, slot kind, binding kind, source
  ref, target ref, display role, schema/shape summary, required/optional
  posture, freshness/status summary, capability ref, bounded validation
  summary, and audit/status refs. Widget bindings are presentation and
  interaction descriptors only, not GraphReFly substrate edges, WorkItem truth,
  WorkGraph truth, workflow/policy rules, arbitrary selector/query expressions,
  provider/storage cursors, runtime subscriptions, command channels, permission
  grants, credential refs, execution permission, review/promotion decisions, or
  generated truth. Workbench may display binding state, render host-admitted
  input/output material, keep session-local editing focus/draft UI state, and
  emit D519 typed intents such as edit draft, submit input, request data,
  refresh, rebind, clear binding, or act through an admitted capability. Hosts
  own binding admission, authorization, data derivation, hydration,
  authoritative validation, persistence, execution effects, status reporting,
  audit, and idempotency/deduplication. Generated/sandboxed/custom widgets may
  consume only admitted binding/display/input DTOs and emit only typed intents;
  malformed, missing, stale, unauthorized, unsupported, or schema-mismatched
  bindings fail closed as diagnostics and disabled affordances.
- 2026-06-25 D538: locked the Canvas widget composition and pinned surface
  boundary. Canvas may define data-only widget composition and pinned-surface
  DTOs that let users pin, create, duplicate, arrange, resize, configure, and
  remove widgets over WorkItemRef, WorkGraphRef, EvidenceRef, ResultRef,
  ArtifactRef, CapabilityRef, review/decision refs, queue/timeline/notification
  refs, and input/output refs. Widget configuration may include widget id/kind,
  surface kind, target/input/output refs, capability refs, display config,
  bounded filter/sort/group summaries, layout frame, title/label, visibility
  posture, pinned-by summary, and status/audit refs. Widget composition is
  presentation intent only, not workflow/policy/query/queue truth, graph truth,
  WorkItem truth, provider/storage access, runtime execution, permission grant,
  review/promotion decision, sandbox lifecycle, generated truth, or component
  registry authority. Workbench may own session-local layout/selection state and
  may display host/project-derived pinned widgets; it may emit D519 typed widget
  configuration/action intents. Hosts own project persistence, admission,
  authorization, audit, data derivation, runtime execution, component/sandbox
  hosting, and downstream effects. Generated/sandboxed/custom widgets may
  consume only admitted DTOs and emit typed intents; missing, stale,
  unauthorized, or malformed widget refs/config fail closed as diagnostics and
  disabled affordances.
- 2026-06-25 D537: locked the Canvas Workspace WorkItem and WorkGraph data
  reference boundary. Workspace WorkItems are product DATA records, not
  GraphReFly substrate nodes, live graph nodes, runtime handles, queue items, or
  widget instances. WorkGraphs inside Workspace are represented as bounded data
  descriptors and WorkGraphRef-style address/evidence/correlation material that
  WorkItems, widgets, evidence, review decisions, freshness views, queues,
  timelines, and verification/testing intents may reference. A WorkGraphRef may
  summarize identity, label, topology/input/output contract posture,
  source/evidence/artifact refs, freshness, and capability compatibility, but it
  is not hydrate authority, provider or storage cursor, live graph handle,
  sandbox handle, Docker/container handle, runner handle, executable graph,
  permission grant, policy object, credential ref, or execution permission. A
  WorkItem may reference one or more WorkGraphRefs as subject/context, including
  verification/testing/review/promotion/repair/data-question work, but WorkItem
  status, ownership, evidence links, policy refs, and review posture remain
  data-only product material. When a WorkItem requests verification, testing,
  review, or execution over a WorkGraphRef, Workbench may emit D519 typed
  intents carrying WorkItem ref, WorkGraphRef, capability ref/kind, policy refs,
  evidence refs, actor/audit refs, and idempotency material. Hosts own resolving
  WorkGraphRefs, authorization, permitted source/spec/topology hydration,
  injection into sandbox/Docker/runner/CI/code-definition runtimes, execution,
  isolation, artifact/evidence collection, audit, status reporting, and all
  downstream effects. Canvas may display WorkItems, WorkGraphRefs, linked
  evidence, and verification status, and may let users pin widgets over these
  refs, but must not resolve refs, hydrate work graphs, execute/inject runtimes,
  mutate WorkItems, mutate graph truth, synthesize WorkGraph truth, grant
  permissions, approve review/promotion, apply proposals, or create generated
  truth facts.
- 2026-06-25 D536: locked the Canvas bulk action and multi-select intent
  boundary. Canvas may define data-only bulk action and multi-select intent
  DTOs for host-derived queue, review, evidence, artifact, result, runner,
  sandbox, permission, promotion, source review, notification, timeline,
  component review, and proposal-follow-up surfaces. Workbench may own
  session-only selection state, display selected counts and host-derived bulk
  affordance availability, and emit D519 typed bulk intents carrying bulk intent
  kind, selected item refs, target refs, actor refs, policy refs, evidence/audit
  refs when applicable, idempotency material, bounded operation summaries,
  client-side selection summaries, and optional validation/dry-run request
  coordinates. Workbench must not execute bulk actions, split a bulk intent into
  per-item effects, loop single-item intents as hidden batching, order per-item
  execution, guarantee all-or-nothing semantics, retry failures, cancel
  in-flight host work, write partial results, mutate queue membership,
  assignments, priority/SLA/completion, record audit, approve reviews, grant
  permissions, approve promotion, install components, apply proposals, mutate
  graph truth, mutate WorkItems, change sandbox trust/lifecycle, execute
  providers/runners, or create generated truth facts. Hosts own validation,
  admission, authorization, per-item expansion, batching semantics, ordering,
  partial success/failure, retries, cancellation, audit, idempotency/
  deduplication, status reporting, and all downstream effects. Bulk
  result/status material returned to Canvas is host-derived display evidence
  only and must follow the result/evidence, notification, queue, and timeline
  boundaries.
- 2026-06-25 D535: locked the Canvas queue and review inbox display boundary.
  Canvas may define data-only queue/review-inbox display DTOs for host-derived
  work summaries across review decisions, evidence freshness, artifacts/results,
  runner and sandbox status, permissions, promotion, source review, capability
  availability, component review, timeline drilldowns, notification drilldowns,
  and proposal-follow-up surfaces. Queue items may carry refs, queue kinds,
  target refs, status, severity, bounded summaries, source capability refs,
  related evidence/artifact/result/note/decision refs, assigned actor summaries,
  priority summaries, dueAt/SLA summaries, available action intent kinds, audit
  refs, freshness/status summaries, and redaction/truncation metadata.
  Workbench may display, sort, filter, group, collapse, paginate, visually
  prioritize, session-dismiss, and open queue items through D519 typed intents,
  and may emit typed follow-up intents such as request re-review, open artifact,
  rerun check, submit decision, open stale evidence, or open capability status.
  Workbench must not own durable tasks, queue membership, assignment, priority,
  SLA, completion state, workflow state, audit persistence, graph truth,
  WorkItem mutation, review approval, runner execution, proposal application,
  permission grant, promotion, sandbox lifecycle effects, provider execution,
  component installation, or generated truth facts. Local sort/filter/group/
  collapse choices are presentation preferences only and must not become
  authoritative priority, assignment, completion, queue membership, audit,
  project truth, or graph-visible policy unless a host explicitly records them.
  Queue items are display projections only, not WorkItems, tasks, review
  requests, approvals, runner commands, permission grants, promotion decisions,
  proposal applications, or sandbox lifecycle facts.
- 2026-06-25 D534: locked the Canvas cross-surface notification and badge
  display boundary. Canvas may define data-only notification/badge display DTOs
  for host-derived summaries across runner, sandbox, artifact/evidence, note,
  decision, freshness, permission, promotion, source review, capability,
  timeline, component review, and proposal-follow-up surfaces. DTOs may carry
  refs, kinds, severity, counts, labels, bounded summaries, target refs, source
  capability refs, related evidence/artifact/result/note/decision refs, display
  state, dismiss posture, open/filter/follow-up intent kinds, audit refs, and
  redaction/truncation metadata. Workbench may display, group, filter, collapse,
  visually prioritize, and session-dismiss these summaries, and may emit D519
  typed open/filter/follow-up intents such as open review queue, filter
  timeline, open stale evidence, open capability status, or request re-review.
  Workbench must not own durable notification persistence, unread/read
  authority, reminder scheduling, email/webhook/system notification delivery,
  browser notification permissions, audit persistence, workflow state, event
  ordering, graph truth, WorkItem mutation, runner execution, review approval,
  proposal application, permission grant, promotion, sandbox lifecycle effects,
  provider execution, or generated truth facts. Session-only dismiss/collapse
  state is local presentation state and must not become project truth, audit,
  workflow truth, or graph-visible policy unless a host explicitly records it.
  Counts are display summaries only, not authoritative event counts, review
  queues, WorkItem truth, proposal truth, permission state, promotion state,
  sandbox state, or runner state.
- 2026-06-25 D533: locked the Canvas capability and evidence timeline display
  boundary. Canvas may define data-only timeline display DTOs for host-derived
  activity across runner, sandbox, artifact, evidence, result, note, decision,
  freshness, permission, promotion, source review, capability descriptor,
  component review, and proposal-follow-up surfaces. Timeline items may carry
  display ids, timeline kinds, host-provided ordering summaries, occurredAt or
  display-time summaries, source capability refs, target refs, actor refs,
  status, bounded summaries, refs to results/artifacts/evidence/notes/
  decisions/review requests, audit refs, redaction/truncation metadata, and
  partial/unavailable/out-of-order display diagnostics. Workbench may display,
  group, filter, collapse, paginate, and open referenced material through D519
  typed intents, but must not write timeline events, own audit/event
  persistence, infer authoritative causality, create ordering authority, repair
  gaps, merge conflicting histories, synthesize missing events, mutate graph
  truth, mutate WorkItems, trigger retries, approve decisions, apply proposals,
  change permissions, approve promotion, change sandbox trust/lifecycle,
  execute providers/runners, lower component events, or create generated truth
  facts. Timeline items are display projections only, not authoritative audit
  events, workflow state, proposal/admission/application material, graph truth,
  WorkItem truth, permission grants, promotion decisions, sandbox lifecycle
  facts, runner execution commands, or storage cursors.
- 2026-06-25 D532: locked the Canvas review evidence freshness and stale
  decision boundary. Canvas may define data-only freshness/stale-decision
  display DTOs for review requests, decisions, artifacts, evidence refs, result
  refs, source refs/fingerprints, sandbox sessions/generations, permission
  posture summaries, capability descriptors, promotion/proposal targets, and
  policy refs. Workbench may display host-derived freshness status such as
  current, stale, expired, superseded, mismatched, missing, unauthorized,
  unverifiable, needs re-review, or blocked, and may emit D519 typed intents to
  refresh evidence, request re-review, rerun checks, open current evidence, or
  request a new decision. Workbench must not compute authoritative freshness,
  compare fingerprints/generations as admission authority, revoke decisions,
  extend decisions, approve based on freshness, mutate policy, mutate graph
  truth, mutate WorkItems, apply proposals, approve promotion, grant
  permissions, retry runners, change sandbox trust/lifecycle, execute
  providers/runners, lower component events, or create generated truth facts.
  Freshness DTOs may carry bounded correlation material such as source/fingerprint
  summaries, refs, sandbox session/generation, capability version summary,
  permission posture summary, target refs, review request refs,
  decidedAt/observedAt/expiresAt summaries, stale reasons, audit refs, and
  diagnostics, but must not carry raw source/artifacts/logs, signed URLs,
  runtime handles, clients, callbacks, credentials, permission objects,
  provider/storage/query/runner handles, or opaque cursors. Stale/expired/
  mismatched/superseded/missing/unauthorized/unsupported/malformed/
  unverifiable evidence fails closed unless a host-owned review/admission path
  explicitly accepts it.
- 2026-06-25 D531: locked the Canvas review decision and approval intake
  boundary. Canvas may define data-only review decision/approval display and
  draft DTOs for promotion, permission, source review, sandbox, runner,
  credential, component-review, artifact/evidence, and proposal-follow-up
  surfaces. Workbench may display host-derived review request and decision
  state such as pending review, approved, rejected, request changes, accept
  risk, waived, needs second reviewer, expired, stale, or blocked. Workbench
  may emit D519 typed decision intents carrying decision kind, review request
  refs, target refs, reviewer refs, policy refs, evidence refs, artifact refs,
  note refs, bounded rationale, audit context, visibility posture, and
  idempotency material. Workbench must not record decisions, write audit, verify
  reviewer authority, mutate policy, grant permissions, approve promotion,
  install components, apply proposals, mutate graph truth, mutate WorkItems,
  execute providers/runners, change sandbox trust or lifecycle, retry runners,
  trigger repair, lower component events, create generated truth facts, or own
  approval workflow state. Notes may be cited as evidence refs, but note text
  must not automatically become approval/rejection/waiver/risk acceptance.
  Hosts own reviewer authorization, identity verification, recording, audit,
  decision persistence, workflow linkage, idempotency handling, stale evidence
  checks, and all downstream effects.
- 2026-06-25 D530: locked the Canvas human review note and evidence
  annotation boundary. Canvas may define data-only human review note and
  annotation display/draft DTOs for artifact, evidence, result, runner,
  sandbox, source, promotion, permission, credential, and component-review
  surfaces. Workbench may display host-derived notes/annotations and may emit
  D519 typed note or annotation draft intents carrying bounded text or body
  summary, topic kind, target refs, evidence refs, artifact refs, result refs,
  author refs, policy refs, visibility posture, audit context, and idempotency
  material. Review notes are user-authored context and evidence annotations by
  default; they are not approval, rejection, verification authority, policy
  mutation, audit records, graph truth, WorkItem truth, promotion trust changes,
  permission grants, sandbox lifecycle changes, runner retry commands, repair
  triggers, proposal admission/application, provider execution, or generated
  truth facts. Workbench must not persist notes, moderate notes, write audit,
  approve/reject, mutate policy, mutate graph truth, mutate WorkItems, grant
  permissions, install/promote components, change sandbox trust posture,
  advance sandbox lifecycle, retry runners, trigger repair, admit/apply
  proposals, mark evidence verified as authority, or own review workflow state.
  Hosts own recording, moderation, retention, deletion, visibility, audit,
  reviewer identity verification, review workflow linkage, and decision
  semantics.
- 2026-06-25 D529: locked the C-1 focused conformance record shape.
  `C-1a`, `C-1b`, and `C-1c` are independent sibling conformance scenario
  records, not nested fields inside `C-1`. The original `C-1` cross-graph
  diamond coalesce scenario remains required and stays todo until the full
  mixed-locality bridge diamond is implemented and tested end-to-end. `C-1a`
  covers canonical protobuf bridge envelope and wire-edge frame
  byte/golden-vector behavior. `C-1b` covers public high-level single-direction
  `WireEdgeGroup` behavior: bytes-only edges, DIRTY-before-DATA gating,
  fail-closed issue/status facts, describe-visible topology, release, and
  bounded recent replay guard. `C-1c` covers explicit graph-visible
  ack-timeout ingress, stale/malformed no-op or issue behavior,
  retry/exhausted facts, and absence of hidden core timer pumps. The focused
  records do not overclaim protocol-rule coverage; `C-1` remains the
  rule-covering mixed-locality scenario for R-diamond/R-tier/R-two-phase/
  R-dirty-before-data/R-graph-domain. Any `conformance.jsonl` edit requires the
  dashboard check.
- 2026-06-25 D528: locked the Canvas artifact ref and evidence link display
  boundary. Canvas may define data-only artifact/evidence link display DTOs
  containing refs, labels, kinds, bounded summaries, source capability refs,
  target refs, availability, redaction/truncation metadata, access posture
  summaries, audit refs, and supported open/preview/download/request-detail
  intent kinds. Workbench may display these links, show unavailable/expired/
  oversize/redacted/authorization-required status, and emit D519 typed user
  intents to open, preview, download, refresh, or request detail for an
  artifact/evidence ref. Workbench must not carry signed URLs, bearer links,
  raw filesystem paths, real local/user paths, file handles, storage handles,
  artifact bytes, preview blobs, download streams, browser File/Blob handles,
  clients, callbacks, opaque cursors, credentials, tokens, cookies, permission
  objects, or artifact-store handles. Hosts own artifact storage,
  authorization, signed URL generation, link refresh, file reading, preview
  rendering, download streaming, retention, revocation, and audit. Artifact/
  evidence refs are display and correlation material only, not permission
  grants, storage locators, hydrate authority, execution inputs, proposal
  admission/application, graph truth, WorkItem mutation, promotion approval,
  sandbox trust changes, runner retry triggers, or generated truth facts.
- 2026-06-25 D527: locked the Python C-1 facade release and lifetime
  semantics. Python C-1 bridge facade bundles are graph-lifetime-owned
  releasable resources. `wire_bridge`, `wire_edge_group`,
  `wire_bridge_protobuf`, and `wire_bridge_ack_driver` bundles expose
  idempotent `release()` as the canonical lifecycle API; they may support
  context-manager `__enter__`/`__exit__`, but must not add a separate `close`
  alias in v1. Construction requires all graph, bridge, clock, and edge Node
  inputs to share the same Python Graph lifetime and owner thread. `release()`
  from a non-owner thread raises `GraphReflyRuntimeError`, and `Graph.close()`
  releases still-live C-1 bundles in reverse creation/attachment order. Child
  release detaches only that bundle's native command or inbound sources and
  owned topology/nodes; bridge release cascades to still-live children before
  releasing bridge-owned native resources. Release is lifecycle cleanup only,
  not protocol TEARDOWN/COMPLETE/ERROR or graph truth synthesis. Native detach
  happens before owned topology release and failed release must restore source
  attachment when possible. No finalizer, hidden timer, background cleanup task,
  raw PyO3 handle, command-source method, or Python wave-core hook owns release.
- 2026-06-25 D526: locked the Python C-1 status and issue facade
  vocabulary. Python C-1 bridge facades expose graph-visible status, issue,
  and timeout values as frozen slots dataclasses with Pythonic snake_case
  fields and closed string `Literal` value vocabularies. Public values include
  `WireBridgeStatus`, `WireBridgeIssue`, `WireEdgeGroupStatus`,
  `WireEdgeGroupIssue`, `WireBridgeProtobufStatus`,
  `WireBridgeProtobufIssue`, `WireBridgeAckTimeout`,
  `WireBridgeAckDriverStatus`, and `WireBridgeAckDriverIssue`. They must not
  be raw dicts, Rust/PyO3 enum objects, raw bridge/protocol DTOs, arbitrary
  `DataIssue.details` bags, callbacks, Node/Ctx handles, protocol messages,
  or native handles. `WireBridgeStatus` uses bounded state strings and integer
  counters/coordinates; WireEdgeGroup and protobuf status/issues preserve the
  D501/D506/D523 semantic vocabulary with snake_case fields; ack driver status
  exposes `last_timeout` rather than `last_command`. This is semantic parity,
  not structural TS/Rust API parity.
- 2026-06-25 D525: locked the Canvas extension result and artifact evidence
  intake boundary. Canvas may define data-only result/evidence intake DTOs for
  external runner, sandbox, Docker/CI, Playwright, fixture-pack,
  code-definition test, credential validation, source review, component review,
  and promotion review systems. These DTOs may carry bounded redacted summaries,
  statuses, diagnostics, issue summaries, artifact refs, evidence refs,
  redaction/truncation metadata, source capability refs, target refs,
  intent/idempotency correlation, compatibility/version summaries, and audit
  refs. Raw stdout/stderr, full logs, full stacks, raw Error objects,
  screenshots, videos, coverage blobs, large diffs, source excerpts, source
  maps, package archives, dependency trees, database dumps, container logs,
  browser traces, clients, handles, callbacks, opaque cursors, credentials,
  tokens, env vars, connection strings, permission objects, executable modules,
  and executable result material remain host-private or artifact-store-private.
  Results are evidence/display material only: they may update host-derived
  Canvas status views, support review/promotion/source/permission/runner
  panels, and provide evidence refs to later proposal, review, approval, or
  promotion flows, but must not directly mutate graph truth, mutate WorkItems,
  grant permissions, approve promotion, install components, change sandbox trust
  posture, advance sandbox lifecycle, retry runners, trigger repair, admit/apply
  proposals, execute providers/runners, lower component events, or create
  generated truth facts.
- 2026-06-25 D524: locked the Python C-1 ack-timeout driver
  facade. Python may add a public high-level
  `wire_bridge_ack_driver(graph, bridge, *, clock, timeout_ms, name=None)`
  facade over Rust/native-owned bridge semantics. The helper consumes
  graph-visible monotonic clock facts and the opaque Python `WireBridge`
  facade, derives ack-timeout facts for pending bridge attempts, and returns
  `timeouts`, status, issues, and release material. `timeouts` is a Python
  facade Node of `WireBridgeAckTimeout` dataclass facts for inspection, not a
  raw `WireBridgeCommand` node or command constructor. Native-private
  implementation may attach derived timeout facts to the bridge's private
  ack-timeout command ingress and detach them on release. Invalid
  `timeout_ms` is a construction error; invalid or regressing clock facts
  become graph-visible driver issues/status. Stale or mismatched timeout facts
  remain bridge-owned fail-closed no-ops, and malformed ingress remains
  issue/status, not a protocol terminal. The facade must not expose raw bridge
  commands, generic command sources, imperative `bridge.ack_timeout` methods,
  PyO3 handles, raw protocol DTO construction, timers, sleeps, hidden retry
  pumps, missed/catch-up policies, or Python wave-core duplication.
- 2026-06-25 D523: locked the Python C-1 protobuf byte transport
  facade. Python may add a public high-level
  `wire_bridge_protobuf(graph, bridge, *, name=None)` facade over
  Rust/native-owned canonical protobuf bridge helpers. The facade returns
  `inbound_bytes`, `outbound_bytes`, status, issues, and release material.
  `inbound_bytes` accepts only bytes through ordinary Python Node facade
  ingress; `outbound_bytes` emits canonical protobuf bytes for host transport
  subscribers. Malformed inbound bytes, outbound encode failures, non-bytes
  ingress, and canonical validation failures become graph-visible protobuf
  issue/status facts, not local protocol terminals. The facade must not expose
  public CanonicalWireBridgeEnvelope, CanonicalWireEdgeFrame,
  WireBridgeEnvelope, WireBridgeCommand, or field-level protobuf builders;
  must not add a production value codec registry; and must not make strict
  JSON fixture bytes a production value encoding contract. Native
  implementation details remain private under D521.
- 2026-06-25 D522: locked the Canvas extension capability descriptor
  boundary. Canvas may define data-only extension capability descriptors for
  host-derived capabilities such as sandbox runners, Docker or CI harnesses,
  Playwright suites, code-definition test systems, fixture packs, credential
  providers, component reviewers, source scanners, and promotion pipelines.
  Descriptors may include display labels, capability kind, supported typed
  intent kinds, supported artifact/evidence kinds, compatibility summaries,
  version summaries, permission posture summaries, status/audit refs, disabled
  or blocked reasons, and redacted host posture. Workbench may display these
  descriptors, use them to enable or disable bounded affordances, and emit D519
  typed intents that name the selected capability or capability kind, but must
  not install, discover, load, invoke, configure, permission, version-manage,
  update, uninstall, retain handles to, or execute extensions. Hosts own
  extension discovery, installation, configuration, permissioning, version
  compatibility, lifecycle, execution, audit, result reporting, and mapping
  Canvas intents to concrete extension implementations. Capability descriptors
  are display/routing hints only, not plugin registry entries, executable
  modules, callback hooks, provider adapters, command refs, permission grants,
  credential refs, runtime handles, package manifests as authority, or
  marketplace records.
- 2026-06-25 D521: locked the Python C-1 private native binding
  boundary. Python C-1 implementation uses private PyO3 foundation
  classes/functions for wireBridge and WireEdgeGroup, wrapped by public Python
  facade objects. Native private classes may own Rust wireBridge/WireEdgeGroup
  bundles, graph-local command-source attachment, native release, and
  status/issue node handles, but remain implementation details outside
  `graphrefly.__all__` and outside documented public API. Public Python
  facade objects expose only the D516 high-level `wire_bridge` and
  `wire_edge_group` shape, Python Node facade instances, frozen
  dataclass/enum status and issue values, and idempotent `release()`. Native
  classes stay unsendable and graph-owned. The implementation must not expose
  raw Core handles, PyO3 object handles, raw WireBridgeEnvelope/
  WireBridgeCommand/WireEdgeFrame construction, raw protocol ingress/down/up
  methods, bridge command mutation methods, Python-only protocol aliases, or
  a Python wave-core reimplementation.
- 2026-06-25 D520: locked the Canvas fixture and test material extension
  boundary. Canvas fixtures, tests, snapshots, mockups, dashboard examples, and
  optional fixture packs are reusable data material, not execution plugins.
  Canvas may publish or consume bounded redacted fixture material, DTO examples,
  expected diagnostics, expected status/audit/approval views, event-envelope
  examples, sandbox posture examples, runner/credential posture examples,
  source/promotion evidence examples, redaction/truncation evidence, and pure
  validators/builders for those shapes. External hosts, runners, sandbox
  extensions, Docker/CI harnesses, Playwright suites, local test tools, or
  code-definition test systems may consume that material and execute tests
  however they choose, but execution remains outside Canvas. Canvas must not own
  the test runner, sandbox/container/VM lifecycle, code-definition runner,
  dependency installer, filesystem/network permission enforcement, credential
  lookup, source hydration, runtime message transport, result persistence,
  artifact store, retry policy, or test admission workflow. Runnable work enters
  Canvas only as typed runner/sandbox/source/promotion/status intents under the
  governing handoff boundaries, and results return only as host-derived redacted
  status, diagnostics, evidence refs, artifact refs, and bounded display DTOs.
  Fixture material and snapshots must not contain raw secrets, tokens,
  passwords, env vars, connection strings, raw shell, raw filesystem paths, real
  local/user paths, raw component source bodies, executable modules as
  authority, package archives, raw logs, full stack traces, source-map-expanded
  frames, raw Error objects, clients, handles, callbacks, registry objects,
  opaque cursors, permission objects, or credential material.
- 2026-06-25 D519: locked the Canvas Workbench intent handoff and
  idempotency boundary. Workbench intent handoff is data-only, typed,
  caller-owned, and idempotency-aware. Workbench may construct, display, and
  surface bounded user intent DTOs for reviewed Canvas affordances such as
  setting changes, runner commands, credential setup, sandbox permission
  requests, component promotion review, component source review, sandbox
  lifecycle requests, sandbox log/error follow-up, UI navigation, and
  cross-capability status follow-up. Each intent should name an explicit intent
  kind, target refs, actor refs, policy refs, evidence/audit refs when
  applicable, caller-supplied intent id or idempotency key, and bounded data
  parameters. Workbench must not own a durable outbox, retry queue, callback
  registry, action dispatcher, command bus, admission lifecycle, approval
  lifecycle, audit writer, persistence owner, workflow state machine, transport
  channel, or runtime executor. Hosts/callers own receiving intents, validating
  and deduplicating idempotency material, admitting/rejecting, persisting,
  auditing, executing, retrying, cancelling, and reporting host-derived status
  back to Canvas display DTOs. Intent DTOs must not carry callbacks, promises,
  raw shell, raw paths, secrets, credentials, tokens, env vars, clients,
  provider/query/storage/runner handles, iframe/window/MessagePort handles,
  runtime handles, registry objects, executable component maps, opaque cursors,
  raw source/log/error material, or permission objects.
- 2026-06-25 D518: locked the C-1 conformance scenario split.
  C-1 remains the required umbrella end-to-end cross-graph diamond coalesce
  scenario and must not be marked pass until the full mixed-locality diamond
  is implemented and tested through the bridge. Focused scenarios should be
  added before honest pass flips: C-1a covers canonical protobuf bridge
  envelope and wire-edge frame bytes/golden vectors; C-1b covers public
  high-level single-direction WireEdgeGroup behavior including bytes-only
  edges, DIRTY-before-DATA gating, fail-closed issues/status,
  describe-visible event/gate/projector topology, release, and bounded recent
  replay guard without making the numeric tombstone limit public; C-1c covers
  explicit graph-visible ack-timeout command ingress, stale/malformed no-op
  or issue behavior, retry/exhausted facts, and absence of hidden core timer
  pumps. Runtime arms may pass each focused scenario only when that runtime
  exposes and tests the corresponding behavior; public ack-driver helper names
  are not conformance requirements.
- 2026-06-25 D517: locked the Canvas cross-capability status, audit, and
  approval display boundary. Canvas may define a focused data-only
  cross-capability status/audit/approval display vocabulary for Workbench
  surfaces. The vocabulary may normalize host-derived status summaries,
  approval posture, audit refs, evidence refs, issue summaries, blocked/denied/
  retryable reasons, last host decision summaries, and next-intent affordances
  across runner commands, credential setup, sandbox permission requests,
  component promotion review, component source review, sandbox lifecycle
  restart/suspend/teardown, sandbox log/error follow-up, and other reviewed
  Canvas host-capability surfaces. Workbench may display this already-derived
  material and may emit data-only user intents with requested follow-up,
  actor/policy/target/evidence refs, idempotency material, and audit context,
  but must not own approval lifecycle state, write audit records, mutate policy,
  grant permissions, validate credentials, execute retries, run commands,
  advance sandbox lifecycle, install or promote components, admit/apply
  proposals, lower component events, write graph truth, mutate WorkItems, or
  become the source of capability truth. The shared vocabulary is not a generic
  workflow registry, state-machine engine, approval engine, policy engine,
  action dispatcher, or provider/runtime adapter. Missing/stale/contradictory/
  unauthorized/unsupported/unverifiable material fails closed as visible
  diagnostics and disabled/blocked affordances.
- 2026-06-25 D516: locked the Python C-1 bridge and WireEdgeGroup
  facade exact shape. Python adds high-level public `wire_bridge(...)` and
  `wire_edge_group(...)` facades over Rust/native-owned bridge semantics.
  `wire_bridge(graph, *, session_id, name=None)` returns an opaque Python
  WireBridge facade bundle sufficient for WireEdgeGroup composition and
  graph-visible status/issues/release, but does not expose raw
  WireBridgeEnvelope, WireBridgeCommand, WireEdgeFrame construction, PyO3
  handles, or raw protocol ingress. `wire_edge_group(graph, bridge, *,
  name=None, inbound_edges=None, outbound_edges=None)` requires exactly one
  of `inbound_edges` or `outbound_edges`; inbound edges are non-empty edge id
  iterables and outbound edges are non-empty edge id -> bytes-valued Node
  mappings. Returned material is a Python WireEdgeGroup bundle with inbound
  edge nodes, status, issues, and idempotent `release()`. Status/issues are
  Python facade dataclasses/enums mapped from native facts. Outbound
  non-bytes values, malformed remote frames, unknown edges, duplicate frames,
  competing causes, incomplete causes, and replay-window violations become
  graph-visible issue/status facts, not local protocol terminals.
- 2026-06-25 D515: locked the Canvas sandbox and component focused public
  surface boundary. Canvas sandbox/component-admission public API remains
  focused-subpath-only and data-only. The package root must not grow with
  sandbox runtime, lifecycle, permission, source intake, promotion, log/error,
  message bridge, registry, or generated-component admission symbols. Focused
  subpaths such as the existing workspace-component-renderer surface may expose
  only data-only DTOs, builders, validators, preview helpers, status helpers,
  and manifest/descriptor summary helpers for generated, pasted, marketplace,
  sandboxed, and host-registered components. If the sandbox/admission surface
  outgrows the renderer-focused boundary, Canvas may add a separately reviewed
  focused workspace-component-sandbox subpath under the same data-only and
  no-runtime-authority constraints. Workbench UI components, host registries,
  runtime drivers, iframe/window/worker/postMessage/MessagePort transports,
  React component maps, executable renderer maps, host adapters, source stores,
  package installers, permission enforcers, credential/network/storage/runner/
  provider brokers, callbacks, raw source/log/error captures, filesystem paths,
  opaque cursors, and runtime handles remain private/internal. Focused public
  helpers may describe already-derived material and validate bounded DTO shapes,
  but must not allocate sessions, install renderers, load source, execute code,
  mutate registries, enforce permissions, persist settings, dispatch actions,
  lower events, write graph truth, mutate WorkItems, or become generic selector/
  provider/registry APIs.
- 2026-06-25 D514: locked the Canvas sandbox message protocol and
  event-port bridge boundary. Canvas may define data-only sandbox message
  envelope views, event-port bridge previews, validation diagnostics, and typed
  event-envelope preview material that connects host-normalized sandbox
  messages to the existing D417/D426 event-envelope/lowering path. Workbench may
  display message validation and bridge status, but must not listen to iframe
  messages, parse raw postMessage payloads, mutate routing, dispatch actions,
  call callbacks, or own message transport. Host-private runtime owns raw
  postMessage listeners, origin checks, MessagePort handles, session/generation
  validation, raw payload capture, transport ordering, and private runtime
  correlation. Messages enter Canvas only after host normalization and current
  session/generation validation. Event ports remain the only routing authority;
  payload may supply bounded draft/data only after clone/data/schema validation
  and must not override actionId, loweringKind, targetRefs, policyRefs,
  actorRefs, rendererRef, componentId, contractId, sandboxSessionRef,
  generation, permission posture, lifecycle state, or host admission context.
  Unknown/non-ready/malformed/unauthorized/stale/post-teardown/revoked/
  unsupported messages fail closed as diagnostics/status and do not lower into
  events, proposal intake, dispatch, repair, promotion, graph truth, WorkItem
  mutation, provider/runner execution, permission changes, or generated truth
  facts.
- 2026-06-25 D513: locked the Canvas sandbox session lifecycle and
  teardown boundary. Canvas may define data-only sandbox session descriptors,
  lifecycle status views, lifecycle diagnostics, restart/suspend/teardown
  request intents, stale-message summaries, crash summaries, audit refs, and
  evidence refs. Workbench may display sandbox lifecycle state and emit
  data-only lifecycle request intents, but must not own the sandbox session
  map, create or dispose iframes/workers, hold iframe/window/MessagePort/
  timer/heartbeat handles, send runtime teardown commands directly, restart
  runtimes directly, retry crashes, or subscribe to post-teardown events.
  Host-private sandbox/runtime infrastructure owns `sandboxSessionId`
  allocation, generation fencing, iframe/worker/window/MessagePort handles,
  heartbeat and timeout policy, resource cleanup, actual start/suspend/
  restart/teardown, crash handling, stale message rejection, runtime maps, and
  retention of private lifecycle evidence. Canvas session refs are display/
  correlation material only, not runtime handles or permission to address a
  running iframe. Lifecycle DTOs may carry bounded session/component/source/
  generation/state/reason/status/evidence material, but must not carry runtime
  handles, ports, window references, callbacks, timers, origin/CSP enforcement
  objects, permission objects, clients, credentials, storage/query/provider
  handles, opaque cursors, raw logs, raw errors, or raw source material.
  Sandbox messages are valid only when session ref and generation match an
  active admitted session; stale, unknown, post-teardown, post-crash, revoked,
  or old-generation messages fail closed as diagnostics/status and do not lower
  into component events, proposal intake, repair actions, promotion decisions,
  graph truth, WorkItem mutation, provider/runner execution, or generated
  truth facts.
- 2026-06-25 D512: locked the Canvas sandbox network and storage
  permission boundary. Untrusted generated, pasted, or marketplace sandbox UI
  has no network access, persistent storage, credential access, host storage
  API, cookie access, or direct browser storage authority by default. Canvas
  may define data-only sandbox permission posture views, permission request
  intents, admission status views, allowed-capability summaries, quota
  summaries, redacted origin summaries, and blocked/denied reason material.
  Workbench may display permission posture and emit user or component
  permission request intents, but must not enforce permissions, grant
  permissions, mutate sandbox policy, write allowlists, broker credentials,
  create storage namespaces, pass network/storage handles, or treat
  component-declared manifests as executable authority. Host-private sandbox/
  runtime infrastructure owns origin policy, CSP, iframe sandbox flags,
  network proxying, URL/origin allowlists, storage namespace allocation,
  quota, cookie isolation, credential mediation, permission admission,
  enforcement, revocation, and audit persistence. Canvas permission DTOs must
  not carry raw URL allowlists, credential material, cookies, tokens,
  connection strings, env vars, storage handles, browser storage handles,
  filesystem paths, clients, provider/query/storage handles, runtime handles,
  iframe/window references, permission objects, opaque cursors, or callback
  maps. Component manifests or source intake records may request or summarize
  desired capabilities, but access becomes effective only after host-owned
  admission and host-owned enforcement; summaries are display material, not
  permission proof.
- 2026-06-25 D511: locked the C-1 cross-runtime WireEdgeGroup
  facade and conformance split. C-1 uses public high-level WireEdgeGroup
  facades in participating runtimes. TypeScript and Rust expose their
  high-level `wireEdgeGroup` / `wire_edge_group` adapter surfaces; Python may
  add an idiomatic public `wire_edge_group` facade only as a wrapper over
  Rust/native-owned bridge and WireEdgeGroup semantics. Edge values remain
  bytes, groups remain inbound-only or outbound-only per D506, returned
  material is facade-level inbound nodes plus status/issues/release wrappers,
  and release follows native source/topology release discipline. Python must
  not duplicate the wave core, construct protocol messages directly, expose
  raw WireBridge/WireEdgeFrame DTO construction, expose PyO3 handles, expose
  raw `Node.up/down` or `ctx.up/down`, add Python-only protocol aliases, add
  a production value codec registry, or widen storage/checkpoint hydration.
  C-1 conformance should split before any honest pass flip into focused
  protobuf canonical byte helper, WireEdgeGroup single-direction behavior,
  and explicit ack-timeout command-ingress scenarios or arms. Public Rust/TS
  ack-driver helpers remain optional ergonomics; conformance requires
  explicit graph-visible timeout ingress, not helper names or hidden timers.
- 2026-06-25 D510: locked the Canvas sandbox log and error capture
  boundary. Canvas may define data-only sandbox log display records, sandbox
  error display records, diagnostic status views, redaction evidence
  summaries, artifact/log refs, and Side Panel console/debug display sections.
  Workbench may display host-produced bounded/redacted log and error records
  for selected sandboxed or generated components, but must not subscribe
  directly to iframe console streams, read runtime error objects, inspect
  iframe handles, expand source maps, parse raw stacks, read raw source
  excerpts, store full log buffers, or perform redaction itself as runtime
  authority. Host-private sandbox/runtime infrastructure owns raw console
  capture, raw error capture, stack collection, source-map expansion, source
  excerpt handling, log buffering, redaction, truncation, retention, artifact
  storage, and correlation to private sandbox runtime handles. Canvas DTOs
  contain only bounded fields such as sandbox session refs, component ids,
  source kind, level, error kind, message summary, optional source label,
  optional occurredAtMs, redaction status, truncation/size evidence, issue
  summaries, and artifact/log refs. They must not carry raw console streams,
  full stack traces, raw Error objects, source-map-expanded frames, raw source
  excerpts, filesystem paths, tokens, secrets, env vars, credentials,
  connection strings, clients, provider/storage/query handles, runtime handles,
  iframe/window references, callback maps, opaque cursors, or permission
  objects. Component crashes and sandbox runtime failures are sandbox/component
  status and diagnostics, not protocol terminals, graph node ERROR facts,
  WorkItem lifecycle failures, proposal admission/application, repair triggers,
  promotion approval, provider/runner execution, or generated truth facts by
  default.
- 2026-06-25 D509: locked the Canvas component source intake material
  boundary. Canvas may define data-only source intake views and review
  intents that expose only bounded source posture: component id, source kind,
  display name, source availability, source/artifact refs, source fingerprint
  or content hash, declared binding manifest snapshots, event-port summaries,
  sandbox posture, sandbox evidence refs, review status, and issue summaries.
  Workbench may display source posture and review readiness and emit data-only
  source review or intake intents with component ids, source refs, requested
  review kinds, actor refs, policy refs, evidence refs, and audit context, but
  must not store raw component source, parse source, load dependencies, build
  modules, hydrate refs, execute code, infer trust, install renderers, or
  derive binding/event manifests from raw source. Raw generated or pasted
  source code, uploaded files, package archives, dependency graphs or
  lockfiles, build outputs, executable modules, source maps, scanner raw logs,
  signing keys, registry objects, runtime handles, filesystem paths, clients,
  credentials, provider/storage/query handles, opaque cursors, and permission
  objects remain host-private or artifact-store-private material. Source refs,
  artifact refs, and fingerprints are evidence/address material only; they are
  not authority to hydrate, execute, install, promote, or bypass sandbox/
  admission. Missing, restricted, stale, mismatched, unavailable, oversize,
  malformed, or unverifiable source material fails closed as visible source
  status/issues/audit refs and must not fall back to inline source DTOs, direct
  execution, host preview, proposal admission/application, WorkItem mutation,
  or generated truth facts.
- 2026-06-25 D508: locked the Canvas generated component promotion
  boundary. Canvas may define data-only promotion candidate views, review
  checklist views, promotion request intents, promotion status views, and
  installed renderer-manifest preview material for generated, pasted,
  marketplace, sandboxed, and host-registered component sources. Workbench
  may display eligibility and emit data-only promotion request intents with
  candidate ids, target trust posture, actor refs, policy refs, evidence refs,
  and audit context, but must not install component packs, assign renderer ids,
  write host registries, execute generated or pasted source, load dependencies,
  build packages, sign artifacts, mutate trust policy, or mark a component
  trusted by UI toggle. Host-private review/runtime infrastructure owns source
  storage and retrieval, dependency audit, code/security review, build,
  signing, packaging, registry installation, rendererId assignment,
  trust-policy enforcement, rollback, uninstall, and runtime binding. Canvas
  promotion DTOs use bounded summaries, manifest snapshots, source/artifact
  refs, fingerprints, sandbox evidence refs, review statuses, issues, and
  installed renderer manifest previews; they must not carry raw source code,
  package archives, dependency trees, build outputs, executable modules,
  registry objects, callback maps, clients, credentials, filesystem paths,
  provider/runtime handles, opaque cursors, or permission objects. Promotion is
  a reviewed trust transition for future rendering posture only and does not
  retroactively trust old sandbox sessions, change graph truth, expand event
  ports, bypass typed event envelopes, auto-admit/apply proposals, mutate
  WorkItems, satisfy input gates, execute providers/runners, or alter
  proposal/application authority.
- 2026-06-25 D507: locked the Canvas topology behavior persistence
  split. Workbench may own ephemeral session-only topology UI state such as
  overlay open/closed, hovered topology node, selected topology node,
  temporary tracking override, minimap expanded/collapsed, debug panel
  open/closed, and pan/zoom viewport. These values are local presentation
  state and must not become project truth, graph truth, WorkItem truth,
  proposal/admission/application material, or durable audit by default.
  Caller-owned project settings may provide typed effective defaults under
  D503, including default lens mode, default tracking mode, minimap default
  visibility, whether selection may follow pinned widgets, and whether
  inferred input UI is enabled. Persistence, admission, and audit remain
  host/project-owned; Workbench may consume an already-derived effective
  topology behavior view and emit data-only topology setting-change intents,
  but must not persist settings directly or append setting events as lifecycle
  owner. Conservative defaults remain locked: topology overlay starts
  closed/off; when opened the lens mode defaults to focused-path, hover
  tracking defaults to none, pinned-node hover shows pinned state only,
  unpinned-node hover shows a ghost frame only, canvas pan on hover is
  disabled, minimap defaults hidden/collapsed unless enabled by an effective
  setting, and debug-protocol is session/dev-only rather than a project
  default. Topology behavior changes are presentation preferences by default
  and do not synthesize graph-visible policy, mutate WorkItems, alter graph
  topology, execute runtime/provider work, or change proposal/application
  authority.
- 2026-06-25 D506: locked the C-1 WireEdgeGroup residual
  directionality and tombstone-retention choices. WireEdgeGroup v1
  declarations are single-direction bundles: an instance may be inbound-only
  or outbound-only, but must not mix inbound-only and outbound edges. Callers
  needing bidirectional bridge composition create separate inbound and
  outbound WireEdgeGroup bundles over the same wireBridge, preserving D501's
  static expected edge set and per-cause DIRTY+DATA-for-every-edge rule.
  Ack-timeout command ingress keeps D502 parity: a missing
  `observedAtMs`/`observed_at_ms` means the explicit driver command asserts
  the timeout is due now; delayed retry suppression applies only when a
  timestamp is present and earlier than the stored retry due time.
  WireEdgeGroup failed and released cause tombstones are bounded
  recent-memory guards, not unbounded replay logs; recent replays fail
  closed, while evicted very old cause ids are outside v1 exact
  replay-detection guarantees. This adds no protocol messages, tiers, raw
  wire facades, production codec registries, storage/checkpoint replay,
  scheduler policy, or missed/catch-up timer semantics.
- 2026-06-25 D505: locked the Canvas runner and credentials boundary.
  Canvas may define data-only runner capability views, credential posture
  views, credential setup intents, typed runner command intents, run status
  views, approval display material, audit display material, bounded log
  summaries, and artifact/evidence refs. Workbench may display runner and
  credential readiness and may emit user intents to start a caller-owned
  credential setup flow or request a typed runner command, but it must not
  collect secrets, tokens, passwords, OAuth codes, env vars, connection
  strings, private keys, filesystem paths, raw shell strings, raw SQL
  connection material, runner handles, clients, storage/query/provider
  handles, callbacks, registries, or opaque runtime cursors. Credential setup
  forms in Canvas accept only redacted metadata and setup intent coordinates;
  secret entry, OAuth exchange, vault writes, token refresh, and credential
  validation remain host/private-runner responsibilities. Runner launch
  intents must name typed command kinds over runner-scoped refs and bounded
  parameters, such as tests over repo refs, dbt over project refs and model
  selectors, SQL over warehouse profile refs and query-plan refs, or
  verification over issue/work graph refs. They must not carry raw shell, raw
  path, raw token, raw environment, arbitrary command argv, or direct
  filesystem/credential handles from the browser. The runner or host admission
  path owns workspace/repo authorization, filesystem and command allowlists,
  credential lookup, approval gates, runtime limits, execution, cancellation,
  artifact/log/evidence collection, and audit persistence. Workbench is not
  the approval lifecycle owner or audit writer; approval, status, issues,
  audit, logs, and evidence appear in Canvas only as already-derived data-only
  views or refs.
- 2026-06-25 D504: locked the Canvas sandbox runtime boundary. Canvas
  may define data-only sandbox request intents, admission/session
  descriptors, runtime status views, typed event-envelope material,
  bounded log displays, and bounded component error displays for generated,
  pasted, marketplace, host-registered, and trusted-built-in component
  sources. Workbench may emit sandbox request intents and display
  host-produced lifecycle/status/diagnostic material, but it must not create
  isolation hosts, wire `postMessage`, load assets, register renderers,
  enforce origin/sandbox/CSP/permission policy, own teardown, or hold runtime
  handles. Actual iframe, worker, dynamic-source, `postMessage`, origin,
  asset, lifecycle, and permission enforcement remain host-private runtime
  responsibilities. Hosts may privately map `sandboxSessionId` values to
  iframe/runtime instances, but those handles must not enter graph truth,
  display DTOs, tests, snapshots, generated proposals, or public Canvas
  surfaces. Sandbox props are serializable data derived from the admitted
  render preview and declared input schema only; sandbox messages lower only
  into validated typed event envelopes and existing event-lowering preview
  paths. Malformed, unknown, stale, or unauthorized messages fail closed as
  data-only status/diagnostic material, not protocol terminals, graph truth,
  Workspace mutation, proposal admission/application, provider execution, or
  raw command dispatch. Logs/errors are bounded and redacted display records;
  promotion to a trusted component pack is a separate reviewed host workflow
  and never changes graph semantics or automatic proposal/application
  authority.
- 2026-06-25 D503: locked the Canvas project settings authority
  model. Canvas may define a focused data-only project settings
  surface for known setting domains, effective display views, redacted
  runtime posture, and user setting-change intent DTOs. A typed settings
  catalog is allowed only as definition/view material, not an executable
  registry or persistence owner. Workbench may own ephemeral session UI
  state such as open panels, temporary toggles, collapsed sections, and
  hover/follow display state, but it must not become project settings
  authority, append setting events as lifecycle owner, or persist settings
  directly. Project-persistent settings remain caller/project-owned; hosts
  may pass already-derived effective settings views into Workbench and
  receive data-only setting-change intents, then decide admission,
  persistence, and audit outside Workbench. Secrets, provider tokens, env
  vars, runner bindings, storage/query handles, callbacks, registries,
  clients, opaque cursors, and runtime handles remain outside setting
  values and graph/display/test/snapshot/generated material except as
  explicitly redacted posture metadata. Future settings domains such as
  topology behavior, sandbox policy, runner posture, credential posture,
  and display preferences should be typed known domains in a focused
  subpath, not open arbitrary setting plugins or casual root exports.
- 2026-06-25 D502: locked the TypeScript `wireBridge` ack-driver exact
  API shape. Hidden `setTimeout`/captured-ctx ack scheduling is replaced by
  a graph-visible `ack-timeout` command ingress and a focused
  `wireBridgeAckDriver(graph, bridge, { clock, timeoutMs, name? })` helper.
  The command variant carries `{ kind: "ack-timeout", seq, attempt,
  observedAtMs? }`; malformed commands become invalid/issue facts, while
  well-formed stale or mismatched commands are fail-closed no-ops. `wireBridge`
  remains the owner of pending state, retry/exhausted/outbound/status/error
  facts, and retry policy. The driver only derives timeout commands from
  graph-visible clock and declared bridge facts, attaches through the existing
  command-source release discipline, and returns commands/status/issues/release.
  No EnvironmentDrivers expansion, hidden timer fallback, protocol
  message/tier, core scheduler behavior, or `WireEdgeGroup` runtime lands in
  this lock.
- 2026-06-25 D501: locked the concrete C-1 `WireEdgeGroup` adapter
  shape and ack-driver ingress. `WireEdgeGroup` v1 is byte-valued and static
  over `wireBridge`, returns inbound edge nodes keyed by `edgeId` plus
  status/issues/release, and declares outbound edge sources in options rather
  than hidden remote deps. Each cause uses the static expected edge set and must
  carry both DIRTY and DATA for every expected edge; DIRTY gates release and
  DATA settles the local inbound edge node. Missing snapshots, unknown edges,
  duplicate frames, competing causes, malformed frames, and incomplete causes
  fail closed as issue/status facts, never protocol terminals. Internal
  event/gate/projector lanes derive public nodes through declared deps so
  `describe()` can show causality. Ack timeout/retry uses passive math plus
  explicit graph-visible driver timeout ingress; timer/sleep/retry/wake drivers
  remain only adapter/driver/source helpers. Rust `wireBridgeProtobuf` remains a
  byte-specific semantic DTO helper, not a raw wire facade, value codec
  registry, storage hydration, checkpoint replay, or Python public raw surface.
- 2026-06-25 D500: narrowed the D498 follow-up boundary. Rust
  `wireBridgeProtobuf` byte helpers are byte-specific DTO/helpers over existing
  semantic bridge envelopes and wire-edge frames, not core `wireBridge` options,
  protocol, value codecs, storage hydration, checkpoint replay, or Python public
  raw wire facade. C-1 `WireEdgeGroup` v1 returns local inbound source nodes plus
  status/issues/release, uses a static expected DIRTY set, allows one in-flight
  bridge-local cause id, and fails closed on competing/malformed causes. Ack
  timeout/retry is a cross-runtime adapter-driver semantic contract; timer/retry
  pumps live only at adapter/driver/source boundaries and surface graph-visible
  status/issues.
- 2026-06-25 D499: locked the TS adapter side-fact projector discipline for the
  D498 `wireBridgeProtobuf` follow-up. Public side facts such as
  protobuf `issues` and `status` must derive from declared internal
  event/result lanes rather than hidden sibling `.down()` writes. The helper
  keeps malformed bytes as bridge invalid/issue facts, keeps status in
  `ctx.state`, preserves the public bundle shape, and does not change protocol,
  tier, message, or ctx semantics.
- 2026-06-25 D498: locked the B2/C-1 bridge adapter implementation
  surfaces. B2 byte integration lands as focused `wireBridgeProtobuf` helpers
  over existing D134/D140/D141 semantic `wireBridge` bundles, not core
  `wireBridge` options or a new protocol surface. Decode/encode failures become
  graph-visible bridge invalid/issue facts, never local protocol terminals.
  Python first consumes D497 golden vectors through a private/native validator
  gate over Rust-owned canonical protobuf validation, not a public raw wire
  facade. C-1 `WireEdgeGroup` is a static graph/application adapter over
  `wireBridge` that owns bridge-local cause ids, allows one in-flight cause,
  gates inbound DATA until all expected DIRTY frames for that cause arrive, and
  returns local inbound edge source nodes plus status/issues; no remote ordinary
  deps, raw Node/Ctx handles, live topology, distributed same-wave state, or
  remote COMPLETE/ERROR terminals cross.
- 2026-06-24 D497: locked the B2 canonical protobuf wire profile for
  bridge envelopes and wire-edge frames. Canonical bytes are defined as
  decode → semantic validation → deterministic re-encode → byte-equal input.
  Unknown fields, duplicate singular fields, non-canonical ordering/default
  emission, missing required semantic fields, invalid oneof combinations, and
  invalid wire-edge kind/value combinations are rejected. Runtime validators
  are part of B2 because proto3 cannot express all GraphReFly semantic
  constraints. Golden vectors live in the language-neutral authority repo and
  are consumed by TS, Rust, and Python/native gates. C-1 fixture values use a
  strict canonical JSON v1 bytes profile only for tests/golden vectors; this is
  not a production value registry, storage codec, or analytics/export format.
  `WireEdgeGroup` remains the D496 graph/application adapter and does not add a
  protocol tier/message or distributed same-wave semantics.
- 2026-06-24 D496: locked C-1 wire-edge bridge semantics and protobuf
  canonical bytes. C-1 uses a static v1 `WireEdgeGroup` adapter over the
  existing D134/D140 `wireBridge` envelope; envelope metadata owns session
  ordering, sequence, cursor, idempotency, ack/nack, attempts, and request
  correlation. Wire-edge frames add only `dirty(edgeId,causeId)` and
  `data(edgeId,causeId,value)`, with `causeId` as a bridge-local causal emission
  id rather than a graph `waveId`. v1 allows one in-flight cause at a time and
  gates DATA release until all expected DIRTY frames for that cause have
  arrived. Inbound adapters inject ordinary local DIRTY/DATA through the owning
  graph boundary; remote ordinary deps, distributed same-wave semantics, raw
  Node/Ctx handles, live topology, function bodies, local pending/diamond
  accounting, and remote COMPLETE/ERROR terminals do not cross. TS and Rust own
  self-contained idiomatic APIs over the shared semantic frame contract; Python
  exposes only a facade over native/Rust-owned bridge semantics. B2 canonical
  bytes are protobuf for bridge envelopes and wire-edge frames; Avro is not in
  C-1 v1.
- 2026-06-24 D495: locked TypeScript NestJS focused transport
  ergonomics as a D494 follow-up. WebSocket and microservice/message subpaths
  may add focused provider-bundle helpers such as `provideGraphWsProviders(...)`
  and `provideGraphMessageProviders(...)`, returning ordinary explicit provider
  arrays over existing bridge options. These helpers must stay only in their
  focused optional-peer subpaths and must not add cross-transport/native
  bundles, root/native optional-peer imports, container scanning, graph
  creation, route registries, event buses, retry/session ownership, or hidden
  transport lifecycle policy. Diagnostics remain recipe/composition-first over
  the explicit sanitized diagnostics ingress boundary; no `onDiagnostic`
  callback/logging API is added. Cron remains D489 skip/current-time/five-field
  behavior. Live WebSocket/TCP tests may be added only as test-only acceptance
  over existing APIs and must not imply new public transport policy.
- 2026-06-24 D494: locked TypeScript NestJS v1.1 ergonomics,
  diagnostics, and cron testability as a D488/D489 follow-up. NestJS may add
  explicit provider-bundle helpers and explicit target helpers, but no
  container scanning, hidden route registry, hidden graph creation,
  module-owned business graph, hidden event bus, live transport e2e
  requirement, or optional-peer leakage. Diagnostics remain host-side snapshots
  by default; graph-visible diagnostics require an explicitly wired diagnostic
  ingress boundary that emits sanitized data-only payloads and no raw
  sockets/clients/contexts/callbacks/transport handles/Promises/Observables or
  raw Error objects. Cron ergonomics may add a deterministic manual controller
  and explicit target helpers reused by the Nest scheduler provider, while
  keeping five-field minute grammar, skip/current-time behavior only, per-minute
  dedupe, no seconds grammar, no missed-status or catch-up DATA, no
  scheduledAt/actualAt/missedCount payload semantics, and no graph-core
  scheduler.
- 2026-06-24 D493: locked Canvas Workspace bounded current-view
  material and Workbench display consumption. Workbench and public focused
  surfaces consume already-derived display DTOs/statuses only; no owner/store,
  event appender, selector, registry, handle, cursor, callback, or lifecycle
  authority may leak. Host-private repair action intent release barriers may be
  retained as compact data-only barrier signatures carrying only releaseId,
  target kind/id, viewId, intentId, optional actionKind, and durable proposal/
  application coordinates; they must not be silently evicted and clear only on
  matching fresh intent DATA or owner disposal. Repair successor preparation may
  use bounded summary/ref/content-ref envelope material plus an immutable
  canonical handoff signature/tombstone. Refs/contentRefs are provenance or
  material-address hints only, not storage/query/provider/runtime handles or
  hydration authority; hash-only identity, readyRequest revocation, truth
  deletion, public selector/store authority, and callbacks remain forbidden.
- 2026-06-24 D492: locked Python C-24 snapshot/restore
  implementation discipline as a D490 follow-up. The slice should split into
  public facade (`Graph.checkpoint()`, `restore_graph`, `restore_registry`,
  `restore_ref`, descriptor/context/checkpoint typing and errors), explicit
  descriptor protocol (`ref`, optional `validate_config`, `create(ctx)`),
  Rust/PyO3-owned checkpoint extraction, restore construction, and runtime
  state seeding, strict-JSON value rules with explicit DATA-vs-SENTINEL
  discriminants, local-only-by-default function-backed nodes unless
  `restore=restore_ref(...)` opts in, and scenario-split C-24 tests. Python
  must not replay topology or seed cache/state as a second wave core. Storage
  hydration, incremental diff replay, same-process host-value checkpoint,
  Python value-codec registry, arbitrary object/pickle serialization, and hot
  restore into an existing graph remain separate future designs.
- 2026-06-24 D491: locked Canvas Workspace current-view display
  surface and bounded material follow-up. Canvas may add a focused
  `@graphrefly/canvas/workspace-current-view` surface only for data-only
  current-view display DTO types/builders and related display composition
  helpers. That surface must not export the host/session owner, store reducer,
  owner state, intent release barriers, event append helpers, selectors,
  registries, providers, query/storage handles, callbacks, opaque cursors, or
  Workbench lifecycle authority. Workbench remains a consumer of already-derived
  display DTOs/statuses. Host-private repair intent release barriers must not be
  silently evicted; future bounded policy should preserve stale-preview blocking
  through compact data-only barrier signatures and/or diagnostics. Repair
  successor preparation remains exact signature/tombstone in the current slice;
  future bounded summary/ref/content-ref material is preferred when material
  pressure appears, but requires a separate reviewed envelope design.
- 2026-06-24 D490: locked Python public snapshot/restore facade
  for C-24. Python may expose `Graph.checkpoint()`,
  `restore_graph(checkpoint, *, registry)`,
  `restore_registry(entries, *, include_builtins=True)`, `restore_ref(...)`,
  and `RestoreDescriptor` / `RestoreContext` typing. User-defined restorable
  nodes opt in via keyword-only `restore=restore_ref(...)`; inline or opt-out
  function-backed nodes checkpoint as local-only and fail restore honestly.
  The first checkpoint value surface is strict-JSON-compatible data for cache,
  `ctx.state`, terminal diagnostics, factory config, and metadata, preserving
  DATA `None` separately from SENTINEL absence. `restore_graph` performs no
  storage I/O, owns no async runtime, exposes no raw Node/Ctx/PyO3 handles, and
  commits a fresh restored graph through the Rust-native restore foundation.
  Python value-codec registry, storage-backed hydration, incremental diff
  replay, and arbitrary object serialization remain separate future designs.
- 2026-06-24 D489: locked TypeScript cron misfire and catch-up
  policy. `fromCron` and `GraphCron` remain skip-by-default,
  minute-granularity, five-field cron surfaces: they match the current
  wall-clock minute, dedupe repeated checks for the same matched minute, and
  resume after host/provider/event-loop downtime from current time only. They
  do not synthesize missed tick DATA, catch-up replay DATA, missed-status DATA,
  `scheduledAt` / `actualAt` / `missedCount` payload fields, or seconds-field
  grammar in this slice. Future missed reporting should be reviewed as a
  separate diagnostic/status surface that does not change tick DATA occurrence
  count; replay or seconds grammar requires a separate reviewed decision.
- 2026-06-24 D488: locked TypeScript NestJS WebSocket and
  microservice/message native consumers. Native consumers must live in focused
  optional-peer subpaths,
  `@graphrefly/ts/adapters/nestjs/websockets` and
  `@graphrefly/ts/adapters/nestjs/microservices`, with phase-specific
  providers/decorators over existing boundary nodes. Correlation is by
  graph-visible `requestId` plus `bindingId`, while socket/client/message
  context/ack/reply handles and timeout state remain host-private. Wrong
  binding, stale request ids, malformed egress, terminal egress, timeout, and
  handler cleanup are host-side diagnostics/cleanup, not hidden graph mutation
  or protocol ERROR; no HTTP native entry, catch-all router, container scan,
  hidden event bus, graph creation, retry policy, or graph-visible socket handle
  is added.
- 2026-06-24 D487: locked Canvas Workspace current-view owner wiring
  and consumer discipline. Canvas current-view owner wiring remains a pure
  host/session transition over caller-owned state, not a class singleton,
  Workbench-private controller, public store, registry, or selector API. A
  host/session step may batch mixed concrete current-view DTO events and
  release facts in caller order; the two-array helper preserves
  `currentViewEvents` before `projectionCurrentViewEvents`, and finer
  interleaving requires one ordered event list or explicit split batches.
  Internal consumer reads must be concrete per known target kind, never a
  generic selector/fact reader, and Workbench remains a data-only consumer, not
  lifecycle authority. Repair successor preparation stays exact
  signature/tombstone; bounded summary/ref/content-ref material requires a
  separate reviewed decision.
- 2026-06-24 D486: locked TypeScript NestJS native hardening and
  future phase bridge boundaries. `GraphGuardDecision` denial headers require
  a narrow GraphReFly-owned targeted guard-denial filter/helper that writes
  status/body/headers for GraphReFly's own denial exception, not a catch-all
  `APP_FILTER` or generic Nest exception owner. Future WebSocket and
  microservice/message native consumers must live in focused optional-peer
  subpaths such as `@graphrefly/ts/adapters/nestjs/websockets` and
  `@graphrefly/ts/adapters/nestjs/microservices`. Cron misfire/catch-up is
  not added now: missed ticks are skipped, recovery resumes from current time,
  no missed-status/catch-up DATA is synthesized, and future replay/reporting
  semantics require a separate reviewed decision.
- 2026-06-24 D485: locked Canvas Workspace current-view owner integration.
  Canvas current-view ownership lives in a host/session-level internal
  `graphrefly-canvas` module, not a Workbench-private controller and not a
  public focused surface. The owner accepts only previous data-only
  `currentViews` plus ordered `currentViewEvents` /
  `projectionCurrentViewEvents` from concrete DTO producers and Canvas slot
  lifecycle release lowering, exposes only reducer `currentViews` and
  `statuses` to internal renderer/detail/advisory/repair consumers, and keeps
  preparation material exact signature/tombstone until a separate
  summary/ref/content-ref design is reviewed.
- 2026-06-23 D483: locked Canvas Workspace current-view store
  implementation discipline. The next slice keeps the store host-private,
  uses `currentViewEvents` / `projectionCurrentViewEvents`, reduces existing
  currentViews before ordered events, exposes only reducer `currentViews` and
  `statuses`, keeps DTO production per concrete projector/adapter, and does
  not add preparation summary/ref material yet.
- 2026-06-23 D482: locked Canvas Workspace current-view store and replay
  discipline. Canvas integration uses a host-private current-view store over
  explicit data-only current-view DTO events and projection release facts;
  fresh DATA rebuilds a view only by producing a fresh DTO event, and bulky
  preparation bounding remains exact signature/tombstone or future bounded
  public summary/ref plus canonical signature, never storage/query/runtime
  handles or projector-local retained/missed/pruned authority.
- 2026-06-23 D481: locked Python async convenience adapter boundaries.
  Python may add caller-owned Trio/AnyIO runner adapters and explicit
  host-scheduled `GraphReentryQueue.drain` recipes/adapters, but must not
  create hidden loops, portals, background threads, nurseries, task groups,
  core auto-drain, blocking pump-until-idle semantics, or implicit
  cancel-on-new-input for ordinary `async_node`. Cancel-on-new-input remains
  a separately named future factory such as `switch_async_node`.
- 2026-06-23 D480: locked Python owner-thread async re-entry queue.
  Python may expose a per-Graph `GraphReentryQueue` bound to the graph
  facade lifetime and owner thread. Runner adapters may wrap an `AsyncRunner`
  so background completions enqueue GraphReFly-owned private completion thunks;
  the queue must not expose arbitrary public graph mutation, raw protocol
  handles, PyO3 handles, or generic callable enqueue. The owner thread
  explicitly drains the queue, and drain revalidates graph lifetime, node
  liveness, and generation fences before re-entering the synchronous native
  boundary. Close, deactivation, or fatal poison drops pending completions and
  performs cleanup/cancellation without graph `ERROR`. Different Python graphs
  may bind to different owner threads, but one graph cannot be directly mutated
  from a non-owner thread.

- 2026-06-23 D479: locked Canvas Workspace projection lifecycle vocabulary
  and retention pressure.
  Canvas Workspace projection lifecycle keeps one semantic transition,
  `release-current-view-slot`; concrete causes such as selection change,
  slot replacement, tab close, workspace unload, scope reset, and repair-flow
  reset are closed reason vocabulary, not separate release semantics. Bulk
  lifecycle operations are represented as concrete per-slot lifecycle facts
  with optional grouping/sequence, never wildcard workspace-wide release.
  Bounded projection retention pressure is diagnostic/status-only in v0 and
  must not directly prune, leak pruned/missed/not-retained state, delete DATA
  history, revoke handoffs, mutate repair/proposal/WorkItem truth, or act as
  hidden TTL/LRU/cache/storage policy.

- 2026-06-23 D477: locked Python framework-neutral async runner public
  API.
  Python async integration uses an explicit host-owned `AsyncRunner` argument
  for `from_awaitable(graph, runner, factory, ...)`,
  `from_async_iter(graph, runner, factory, ...)`, and
  `async_node(graph, deps, runner, callback, ...)`. The core API is not
  asyncio-only: optional `asyncio_runner`, `trio_runner`, or `anyio_runner`
  adapters may exist, but they remain convenience adapters over the neutral
  runner protocol. Awaitable and async-iterable inputs are factory-shaped;
  async task handles stay host-private and never enter graph DATA, describe, or
  checkpoints. `async_node` is value-level async compute over declared deps,
  uses a generation fence for stale completions, and does not expose async
  `Ctx` authoring or implicit switchMap/cancel-on-new-input semantics. Ordinary
  graph callbacks remain synchronous.

- 2026-06-23 D476: locked Canvas Workspace projection lifecycle release
  policy.
  Canvas may lower explicit product UI lifecycle transitions into
  `WorkspaceProposalProjectionRelease` facts only from graph-visible Canvas
  projection slot/current-view material. Release remains Workspace projection
  lifecycle material, not a Canvas private dispose callback, UI action intent,
  proposal/application truth, storage eviction, or revocation. `canvasViewId`/
  `canvasSessionId` are owner/provenance context, while `viewId` is a projection
  slot identity. Release observability may report malformed release material and
  Canvas-side emission/validation/skipped-slot status, but release-consuming
  projectors must not emit authoritative pruned/not-retained/missed facts.
  Repair action lifecycle releases follow the current-view chain without
  revoking prepared readyRequests or mutating repair/proposal/WorkItem truth.

- 2026-06-23 D475: locked Python conformance expressibility and async
  runner boundary.
  Python conformance must use approved public facade first when a scenario is
  honestly expressible through documented graph-owned APIs. D447 private helpers
  remain allowed only for fixed scenario-specific stimuli that would otherwise
  pressure the public API into raw protocol escape hatches. Python async runtime
  integration remains a separate public API design: ordinary graph callbacks
  stay synchronous until an explicit async runner API is approved.

- 2026-06-23 D474: locked TypeScript NestJS adapter boundary nodes.
  The public `@graphrefly/ts/adapters/nestjs` surface uses keyed ingress/egress
  boundary nodes plus Nest decorator/provider binding helpers over ordinary
  graph nodes. The adapter owns only host-private binding/pending-handle maps
  and request/message/connection ids; graph-visible material is the bounded
  `{requestId,bindingId,version,payload}` envelope, while user graph composition
  owns admission, lifecycle policy, CQRS, queues, retries, audit, and domain
  semantics.

- 2026-06-23 D473: locked Workspace projection release diagnostic
  observability.
  Malformed or unsafe projection release material remains fail-closed for D472
  release-consuming projectors: invalid release facts do not throw, do not
  prune, do not mutate truth, and do not emit protocol ERROR. Hosts that need
  observability may wire a separate diagnostic surface that emits closed,
  data-only display diagnostics/status over the release fact itself. These
  diagnostics are not policy/capability proof, release admission, storage/cache
  eviction, revocation, or evidence that any retained target existed or was
  pruned.

- 2026-06-23 D472: locked Workspace projection current-view release
  and retention discipline.
  Workspace projection retention is controlled by explicit graph-visible release
  material, not hidden TTL/LRU/cache/storage ownership. Release may prune
  projector-local current-view/request/input/emitted-signature material, but
  does not delete historical DATA, revoke proposal handoffs, mutate proposal/
  admission/application/family/WorkItem truth, or satisfy policy/capability
  validation. For D467/D471 successor preparation, release may compact bulky
  retained ready-request material only to an immutable signature/tombstone; the
  same `preparationId` still cannot prepare a different ready request later.

- 2026-06-23 D471: locked Workspace repair successor ready-request
  projector immutability.
  A graph-visible repair successor ready-request preparation projector treats
  the first successfully prepared `WorkspaceProposalReadyRequest` for a
  `preparationId` as an immutable handoff. Later identical replay may dedupe,
  but later blocked, mismatched, or different ready-request material for the
  same `preparationId` emits blocked preparation/issues material and must not
  withdraw, replace, or re-emit a different ready request. The readyRequests
  stream is an append-only ordinary proposal handoff convenience, not a
  revocation/current-view channel.

- 2026-06-22 D470: locked Outcome detail richer fact supply and
  pagination discipline.
  Outcome detail drilldown may grow closed, bounded, data-only supplied fact
  facets attached to explicit thin outcome refs, with size caps, coordinate
  validation, malformed diagnostics, and forbidden-runtime-material
  diagnostics. Pagination remains a deterministic window over requested thin
  outcome refs using `afterOutcomeRef` and `nextAfterOutcomeRef`; graph-visible
  supply requests/results must not carry opaque provider cursors, storage/query
  handles, full-fact index denormalization, generic fact-reader authority,
  generated ids, recorded truth, or mutation material.

- 2026-06-22 D469: locked Host-private outcome detail selector adapter
  concrete convention.
  Real selector adapters are host-local functions, sources, or bridges that may
  privately use storage/query/provider/domain-cache/runtime material, but their
  only graph-visible handoff is bounded data-only supplied outcome facts or
  D452/D462-compatible supply results. Canvas continues to expose only DTOs and
  pure supply/read-model helpers, with no public selector adapter registry,
  callback API, component map, runtime handle, opaque cursor, permission object,
  or generic family fact reader.

- 2026-06-22 D468: locked Workspace repair action display-only
  policy advisory.
  Repair action policy preview material must be separate display-only advisory
  material keyed by descriptor/request/action/full coordinates, not descriptor
  permission truth. Its vocabulary uses `authority: "display-only-advisory"`
  and `displayAssessment` values such as `not-evaluated`,
  `no-known-blocker`, `known-blocker`, `needs-review`, and `unknown`; it must
  avoid permission-proof names like allowed, permitted, authorized, or
  canSubmit. Intent/intake validation remains the only policy/capability/stale
  authority.

- 2026-06-22 D467: locked Workspace repair successor preview-to-proposal
  handoff.
  Repair successor previews may enter the ordinary Workspace proposal path only
  through a Workspace-owned ready-request preparation helper that consumes the
  preview plus explicit Workspace/caller-supplied successor proposalId,
  intakeRequestId, final idempotencyKey, workspaceId, actor/capability refs,
  policy refs, projection refs, sourceRefs, audit, target refs, successor
  family/lowering kind, and final draft material or draft refs. The helper may
  return ordinary WorkspaceProposalReadyRequest material but must not record,
  admit, apply, mutate truth, generate canonical ids, choose final idempotency,
  execute runtime/provider/storage/file/network work, or treat suggested draft
  patch material as final unless the caller explicitly supplies it as final.

- 2026-06-22 D466: locked Python C-25 full-pass coverage
  strategy.
  Python should finish C-25 through the existing public D454/D465 facade
  first: public `ctx.request_pull_next(...)` for the PULL self-demand
  committed-boundary matrix and public `ctx.rewire_next` for the remaining
  topology ordering facets. The final-RESUME-inside-open-batch case should
  be expressed by pre-pausing the owner, resuming the final lock inside an
  open batch, and proving the queued task waits for batch commit. D447
  private harness additions remain fallback only for scenario-specific
  orderings that cannot be honestly expressed publicly; no new public API or
  protocol behavior change is approved.

- 2026-06-22 D465: locked Python public deferred rewire
  facade.
  Python may expose callback-scoped `Ctx.rewire_next` with exactly
  `subscribe_dep(dep, callback)`, `unsubscribe_dep(dep, callback)`, and
  `replace_deps(deps, callback)`. The methods accept same-graph public
  `Node` facades and a required `Ctx` callback that re-declares the fn/deps
  pairing, lower to existing Rust native `R-rewire-deferred` behavior, and
  must not expose raw `ctx.up`, `Node.up/down`, arbitrary messages, generic
  op objects, Python-only protocol aliases, cross-graph rewire, or immediate
  in-fn topology mutation.

- 2026-06-22 D464: locked Host-private outcome detail selector
  adapter convention.
  Real outcome detail selector adapters remain host-owned and
  runtime-private. Hosts may privately read storage/query/provider/domain-cache
  material, but the only graph-visible handoff is bounded data-only supplied
  facts or D452/D462-compatible supply-result material. Adapters must preserve
  refs, pagination, missing/divergent/mismatched diagnostics, sourceRefs, and
  audit, and must not expose runtime handles, opaque cursors, registries,
  callbacks, ids, mutations, index denormalization, or generic family readers.

- 2026-06-22 D463: locked Workspace repair action policy
  material placement.
  Repair action descriptors stay lifecycle/display affordances with only
  obvious lifecycle disabled states. Actor, capability, Workspace policy,
  stale-state, and permission gating belongs to Workspace-owned
  intent/intake validation, which emits blocked/status/issues/audit material.

- 2026-06-22 D462: locked Workspace proposal family outcome detail
  supply concrete shape.
  Outcome detail supply uses request/result DTOs with supplyRequestId,
  optional viewId, full coordinates, requested thin outcome refs, bounded
  page/filter options, supplied facts, missing/mismatched refs, diagnostics,
  sourceRefs, and audit. Pure supply must not call storage/query/runtime APIs,
  store cursors, record facts, create ids, mutate truth, denormalize indexes,
  or become a generic family fact reader.

- 2026-06-22 D461: locked Canvas proposal family read-model query
  concrete presentation options.
  D455 sort/group/search options use closed display fields, deterministic
  normalization, and identity/dedupe inclusion. Search is bounded display
  matching only; grouping may add display grouping material while preserving
  flat read-model material and must not classify raw issues, synthesize
  statuses, introduce cursors, or call storage/query/runtime APIs.

- 2026-06-22 D460: locked Workspace repair successor proposal
  intake preview.
  `open-successor-proposal-flow` lowers to a Workspace-owned preview that may
  produce bounded proposal-ready context and suggested draft patch material,
  but must not record proposal truth, generate canonical proposal/admission/
  application ids, choose final idempotency keys, execute repair work, or
  mutate family/application/WorkItem truth.

- 2026-06-22 D459: locked Workspace repair action intent
  concrete shape.
  Repair action selections use data-only intent material carrying intent,
  descriptor, request, action, full coordinates, actor/reviewer refs,
  sourceRefs, audit, and bounded metadata. Validation must match descriptor,
  request, action, and coordinates; malformed or mismatched material fails
  closed and review-only actions lower only to D450 input preparation.

- 2026-06-22 D458: locked Canvas proposal descriptor host-owned
  rendering convention.
  DescriptorKind-to-component mapping for proposal family application display
  is host-owned and runtime-private. Canvas may expose only data-only
  descriptor, read-model, and host-slot DTOs through focused surfaces; it must
  not expose a public component registry, React map, callback/action handler,
  renderer lifecycle, permission object, runtime handle, or mutation command
  API.

- 2026-06-22 D457: locked Workspace proposal outcome detail
  read-only selector adapter boundary.
  Real outcome detail selection lives outside the thin outcome index and
  outside the D452 pure supply helper as a separately reviewed read-only
  Workspace/family-owned selector adapter. Graph-visible material may contain
  only bounded data-only supplied facts or supply-result DTOs, with
  missing/divergent/mismatched refs preserved as diagnostics and no cursors,
  full facts, storage/query/provider/runtime handles, ids, recording, mutation,
  or generic family fact reader authority.

- 2026-06-22 D456: locked Workspace proposal repair-review
  decision recording projector.
  Workspace may add a graph-visible projector that consumes repair-review
  requests, explicit Workspace/caller-supplied decision-recording input facts,
  and optional matching stale-guard status material. It calls the D450 pure
  helper, emits recording results/issues and valid review decision DATA, and
  must not emit or mutate application status, family facts, WorkItem/input/link
  truth, outcome facts, commands, runtime/provider/client/credential/file or
  network material, or repair execution.

- 2026-06-22 D455: locked Canvas proposal family read-model query
  extension discipline.
  D448 read-model query descriptors may grow closed presentation-level
  sort/group/search options over already-projected or explicitly supplied
  material. Those options are normalized into identity/dedupe, fail closed as
  display diagnostics when malformed or unsupported, and must not introduce
  storage cursors, opaque continuation tokens, storage/query/runtime calls,
  generic fact reader semantics, raw issue classification, family/application
  truth synthesis, commands, callbacks, mutation intents, or Canvas authority.

- 2026-06-22 D454: locked Python public PULL and pause-mode
  facade.
  Python may extend public `Graph.node` keyword-only advanced options with
  `pausable` and `pull_id`, expose read-only `Ctx.pull` / `PullContext` and
  `Ctx.pull_params()`, and expose narrow `Ctx.request_pull(...)` /
  `Ctx.request_pull_next(...)` helpers. These helpers construct only PULL
  demand over declared dep edges and must not expose raw `ctx.up(msgs)`,
  public `Node.up(msgs)`, arbitrary message construction, or public
  `ctx.rewire_next`; full self-rewire remains separately design-gated.

- 2026-06-22 D453: locked Workspace repair action intake
  handoff.
  UI selections of repair action descriptor material become data-only
  intent/intake material. Review-only actions lower through the D450
  repair-review decision recording path with Workspace/caller-supplied ids,
  policy, audit, and source refs. Successor or follow-up actions enter a
  separate successor proposal intake/preview path, while actual repair, retry,
  replacement, or follow-up work remains ordinary Workspace
  proposal/admission/application flow.

- 2026-06-22 D452: locked Workspace proposal family outcome detail
  fact supply boundary.
  Outcome detail fact supply is a separate read-only Workspace/family-owned
  boundary before the existing detail read-model projector. It may validate and
  filter explicit supplied facts for requested thin refs, but never records
  facts, creates canonical ids, mutates domain/application/family truth, calls
  storage/query/runtime/provider/file/network APIs, or denormalizes full facts
  into the thin outcome index.

- 2026-06-22 D451: locked Canvas proposal family host display
  slot contract.
  Host display remains a host-owned rendering convention over data-only
  descriptor/read-model DTOs. Canvas may expose descriptor bundles, diagnostic
  descriptors, outcome detail read-models, event envelopes, and previews, but
  must not expose or own a public component registry, React component map,
  callback/action handler, renderer lifecycle, permission handle,
  provider/runtime/client/credential/file/network handle, or mutation command
  API.

- 2026-06-22 D450: locked Workspace proposal repair-review
  decision intake concrete shape.
  Repair-review human decisions are recorded through a Workspace-owned pure
  helper over an existing repair-review request plus explicit reviewDecisionId,
  intent, reviewer/actor refs, policy/source/audit material, and optional
  resolves/supersedes refs. Coordinates are copied from the request, current
  status is optional guard context only, and recording decisions never mutates
  requests, application/family truth, WorkItems, RequiredInput gates, links, or
  runtime state.

- 2026-06-22 D449: locked Workspace proposal repair action descriptor
  and successor handoff.
  Repair-review lifecycle status remains read-only current-status material and
  never emits retry commands, family facts, application status, successor ids,
  callbacks, provider/runtime actions, or mutation intents. UI may consume
  read-only repair action affordance descriptors, but review-only actions enter
  through Workspace-owned repair-review decision intake, and actual repair,
  retry, replacement, or follow-up work enters the ordinary Workspace
  proposal/admission/application path with Workspace-supplied ids, policy,
  source refs, and family-owned application/outcome handling.

- 2026-06-22 D448: locked Canvas proposal family drilldown query
  descriptor.
  Canvas proposal family drilldown uses graph-visible read-only query
  descriptor material carrying query/view id, complete proposal/application
  coordinates, and bounded page/filter options. Workspace-owned read-model
  projection may consume those descriptors with projected diagnostics,
  repair-review statuses, thin outcome indexes, outcome statuses, and explicit
  outcome facts to emit read-model pages. Query descriptors are not storage,
  mutation, repair, admission, application, command, callback, or generic fact
  reader authority.

- 2026-06-22 D447: locked Python private conformance harness boundary.
  Python may provide a private conformance harness module for fixed
  scenario-specific protocol stimuli over Rust/PyO3 internals. The harness is
  not documented public facade, not exported from `graphrefly.__all__`, and
  must not expose generic raw message construction/sending or public
  `Node.up(msgs)` / `Node.down(msgs)`. Public Python ergonomics such as PULL,
  pause modes, state-empty helpers, decorators, context managers, and
  operators remain separately design-gated.

- 2026-06-22 D446: locked Canvas proposal family host display,
  repair decision intake, and outcome detail supply boundary.
  Host React/runtime descriptor consumption is host-owned and runtime-private.
  Repair-review human decisions are created only through a Workspace-owned
  review-decision intake/recording path with explicit ids, actor/policy/audit
  material, and optional resolves/supersedes refs. Outcome detail fact supply
  stays separate from thin indexes as read-only selector or explicit supplied
  facts, never a generic fact reader or index denormalization path.

- 2026-06-22 D445: locked Canvas proposal family read-model composition
  handoff.
  Canvas consumes Workspace-owned proposal family application read-model and
  descriptor material, not raw issue/audit/status streams for its own
  classification. The read-model projector may compose family diagnostics,
  repair-review lifecycle statuses, thin outcome indexes, and explicitly
  supplied outcome facts into bounded display records. It must validate
  coordinates, preserve thin refs, support bounded drilldown, and remain free
  of application status synthesis, family facts, repair requests/decisions,
  proposal/admission/application ids, runtime actions, callbacks, commands,
  and mutation intents.

- 2026-06-22 D444: locked Workspace proposal repair-review lifecycle
  concrete shape.
  Repair-review lifecycle uses separate decision and status material while
  requests remain immutable handoff facts. Status projection consumes requests,
  review decisions, application statuses, application-recorded material,
  family outcome statuses, and family outcome indexes. Inputs must match full
  request coordinates. Precedence is explicit human terminal decision, explicit
  durable resolved/superseded proof, acknowledged, then open; incomparable
  human decision conflicts fail closed. Absence of diagnostics or repair-needed
  material never resolves a request.

- 2026-06-22 D443: locked Python advanced `Graph.node` option flags.
  Python may expose keyword-only advanced `Graph.node` options that map
  directly to Rust native `NodeOpts` for ctx-level authoring: `partial`,
  `complete_when_deps_complete`, `error_when_deps_error`, and
  `terminal_as_real_input`. These are public advanced authoring controls,
  not raw protocol message APIs, and they must not expose raw
  `Node.up(msgs)`, arbitrary message construction/sending, or Python-only
  protocol aliases. This preserves C-23/C-15/C-17 expressibility while
  respecting D415 and D435.

- 2026-06-22 D442: locked Workspace diagnostic projection pattern.
  Workspace diagnostics remain domain-owned projections for now. Family
  application diagnostics keep their own classification, eligibility,
  coordinate validation, and repair-review lowering boundaries. Shared reuse
  may extract only internal mechanical helpers after repeated domains prove
  identical needs. No public root WorkspaceDiagnostic primitive, Canvas
  diagnostic authority, workspace-intents diagnostic bus, generic
  issue-to-repair lowerer, or root export is added in this slice.

- 2026-06-22 D441: locked Workspace proposal repair-review lifecycle.
  WorkspaceProposalRepairReviewRequest remains immutable human-visible handoff
  material. Current repair-review lifecycle is projected by separate
  Workspace-owned status/view material over repair review requests, durable
  application/outcome/index material, and explicit human review decision
  material. Lifecycle states such as open, acknowledged, resolved, withdrawn,
  and superseded are read-model/status facts only. Resolution or supersession
  requires explicit durable successor material with matching coordinates or
  explicit human review decision material, never absence of diagnostics.

- 2026-06-22 D440: locked Canvas proposal family diagnostic display
  and outcome drilldown boundary.
  Canvas proposal family application display uses pure read-model and
  component descriptor data only. Diagnostic-only read-models from D438/D439
  are valid Canvas display material but must not synthesize application,
  family handoff/completion/evidence/repair shells, family facts, repair
  review requests, or outcome refs. Renderer descriptor projection must
  distinguish malformed/non-data input from valid diagnostic-only display
  via an explicit diagnostic descriptor or mode. Host React/runtime bridges
  may consume descriptors through host-owned components, but descriptors
  remain free of callbacks, commands, runtime/provider/client/credential
  handles, file/network operations, owner APIs, and mutation material.
  Outcome indexes stay thin refs; drilldown uses a separate read-only detail
  projector over explicit supplied facts plus thin refs with bounded
  pagination/filtering and coordinate validation.

- 2026-06-22 D439: locked Workspace proposal family diagnostic
  projection and repair-review handoff.
  Workspace proposal family diagnostics use a Workspace-owned read-only
  projection over existing issue, audit, application status, recorded
  application, family outcome status, and family outcome index material.
  Missing durable proposal/admission diagnostics from D438 stay diagnostic-only
  and cannot produce application status, repair review requests, family outcome,
  or remutation. Repair review requests lower only from durable
  idempotency-conflict or missing-family-material/repair-needed status, outcome,
  or index material with durable proposal/admission/application coordinates.
  Malformed family material remains diagnostic-only unless a later decision
  widens repair-review eligibility. Canvas, root exports, and workspace-intents
  remain preview/navigation surfaces, not diagnostic or repair authority.

- 2026-06-22 D437: locked Workspace proposal family outcome concrete
  API shape.
  Workspace family application outcomes use four family-owned pure record
  helpers for required-input response, WorkItem spawn, WorkItem link, and
  WorkItem domain action. Each helper consumes a generic
  WorkspaceProposalApplicationStatusRecord plus Workspace/family-supplied
  outcome id, sourceRefs, audit, and family-specific result refs, and returns
  recorded/not-recorded preview material with issues; no public generic
  family-outcome recorder is added. Default completion policy is data-only:
  required-input response requires one recorded outcome with
  requiredInputRequestId and responseRef, WorkItem spawn requires one recorded
  outcome with workItemRef, WorkItem link requires one recorded outcome with
  linkRef, and domain action requires one recorded outcome with actionRef
  unless an explicit policy enables multi-step partial completion. Evidence
  horizon is structured Workspace/family-owned material with sourceRefs/audit;
  generic projection cannot close it by query timeout. repair-needed lowers
  only to human-visible repair review/request material, never automatic
  remutation. Family outcome indexing is a pure projected thin-ref index over
  family facts keyed by application/idempotency coordinates, not storage and
  not full fact denormalization.

- 2026-06-22 D434: locked Workspace proposal family outcome owner and
  repair boundary.
  Family application outcomes are recorded only by family-owned
  helpers/projectors for required-input response, WorkItem spawn, WorkItem
  link, and WorkItem domain action. Generic application status records and
  indexes carry only Workspace-supplied application/proposal/admission/
  idempotency coordinates, source/audit/policy/target refs, handoff status,
  and thin family outcome refs. Completion is evaluated by a data-only family
  completion policy over visible family outcome facts. Evidence horizon is
  explicit data that can remain open or close with sourceRefs/audit; a closed
  horizon with missing or unverifiable family facts projects repair-needed
  rather than retrying. Replay re-references exact matches and reports
  idempotency-conflict for same application/idempotency with divergent
  envelope/outcome. Repair-needed may lower to human-visible repair
  proposal/review material, but it never authorizes automatic remutation or
  family fact creation.

- 2026-06-22 D430: locked Workspace proposal family application
  handoff.
  Workspace application uses a generic application attempt/status index plus
  family-owned application facts. Generic application status records carry only
  Workspace-supplied application/proposal/admission/idempotency coordinates,
  target/source/audit/policy refs, and family application refs. Family-specific
  projectors own required-input response, WorkItem spawn/link, and domain-action
  facts, and each family fact must reference the generic applicationId,
  admitted decision, proposal, idempotency material, sourceRefs, and audit.
  Generic projectors may index terminal family outcome refs/statuses such as
  recorded, rejected, blocked, partial, repair-needed, or idempotency-conflict,
  but they never create family facts, mutate WorkItems, satisfy inputs, emit
  link truth, execute runtimes, or act as arbitrary fact emitters. Replays
  re-reference matching prior family facts, surface conflicts as status/issues,
  and leave missing family facts pending or repair-needed rather than
  re-mutating by default. Durable admission material should be recorded before
  family application consumes it.

- 2026-06-21 D429: locked Workspace proposal spine concrete implementation
  shape.
  Workspace proposal implementation uses a generic append-only proposal spine
  plus family-specific application projectors. Durable generic facts are
  WorkspaceProposalRecorded, WorkspaceProposalAdmissionDecision, and
  WorkspaceProposalApplicationStatus, with optional terminal audit material that
  references emitted family-specific facts. Records carry Workspace-supplied
  proposal/intake/idempotency/workspace identity, family/lowering, bounded draft
  material or refs, target refs, actor/capability refs, policy refs,
  projection/source refs, and audit. Admission consumes visible policy,
  capability, duplicate/idempotency, and freshness evidence; malformed,
  unsupported, stale, unknown, duplicate, missing-context, or human-review cases
  fail closed. Application consumes only admitted, issue-free envelope matches;
  generic application records status/refs only, while required-input response,
  WorkItem spawn/link, and domain action truth is emitted only by
  family-specific projectors. Canvas may expose preview DTOs/helpers but does
  not record, admit, apply, mutate WorkItems, satisfy gates, execute runtimes,
  or emit truth facts.

- 2026-06-21 D427: locked Workspace proposal durable spine concrete
  application boundary.
  Workspace proposal hardening uses durable vocabulary centered on
  WorkspaceProposalRecorded, WorkspaceProposalAdmissionDecision, and
  WorkspaceProposalApplicationStatus/ApplicationRecorded status material while
  all mutation remains family-specific. Admission consumes Workspace-supplied
  decision identity, actor/capability refs, policy refs, idempotency/duplicate
  evidence, target/projection freshness evidence, sourceRefs, and audit.
  Malformed, missing-context, unsupported, unknown/stale target, duplicate, or
  missing-policy/capability material fails closed as blocked/rejected/needs-review,
  and no matching policy defaults to needs-review. Application consumes only
  admitted, issue-free envelope matches, may record status plus refs to
  family-specific facts, and is not an arbitrary fact emitter. Raw ready request
  material remains Workspace-owned. The focused Canvas workspace-graph surface
  may expose pure proposal/admission/application DTOs and helpers; workspace
  intents stay intent/preview-only and root Canvas must not become a broad
  mutation/admission API.

- 2026-06-21 D426: locked Canvas host renderer event lowering preview.
  Host renderer events lower through a pure data-only preview boundary that
  consumes a typed renderer event envelope plus optional visible context such
  as projection bundle/refs, target freshness, actor/capability refs, policy
  refs, Workspace-supplied ids, requestedBy, workspaceId, and idempotency
  material.
  Canvas may emit UI navigation, SidePanelActionIntent/lowering, proposal-intake
  preview, blocked, invalid, or unsupported-event status material only. Event
  ports remain the routing authority; payloads are bounded draft/data material
  and cannot override routing, name callbacks, request commands, or carry
  runtime handles. Missing/malformed/non-ready/stale/unsupported/missing-policy
  cases fail closed; registries and UI wiring stay host-owned/runtime-private,
  while proposal admission/application stays Workspace-owned.

- 2026-06-21 D425: locked Workspace proposal spine durable fact boundary.
  Workspace proposal/admission/application uses a generic append-only proposal
  spine plus family-specific application. Proposal recording, admission
  decisions, and application status carry Workspace-supplied identity,
  sourceRefs/audit/idempotency/policy/actor/capability/projection material.
  Missing or unmatched policy defaults to needs-review, and malformed,
  unsupported, stale, unknown, duplicate, or missing-capability material fails
  closed as rejected/blocked/needs-review status material. Application consumes
  only admitted, issue-free envelope matches and lowers through family-specific
  paths such as required-input response, WorkItem spawn/link, or domain action;
  the generic stage is not an arbitrary apply blob. Canvas remains limited to
  focused pure preview/intake helpers and does not generate canonical ids,
  admit, apply, mutate WorkItems, satisfy gates, execute runtimes, or promote UI
  intents into durable truth.

- 2026-06-21 D424: locked graph-visible scheduled readiness.
  Delayed graph-visible work becomes ready through a provider/domain-neutral
  projector over explicit schedule facts and explicit graph-local
  clock/readiness facts. The projector may emit pending, ready, overdue,
  status, issues, audit, and views, but never executes providers, claims work,
  mutates WorkItems, admits proposals, satisfies input gates, or appends domain
  truth. Timer/sleep drivers may only publish visible clock or wake facts and
  are not readiness or execution authority.

- 2026-06-22 D432: refined scheduled readiness v1 public coordinates.
  Schedule facts carry `subjectRefs` only and `readyAtMs` only; `subjectRef`
  and `notBeforeMs` are stale aliases that fail closed as malformed schedule
  material. Domain vocabulary such as retryAtMs or workQueue notBeforeMs may be
  translated at the boundary, but the shared readiness projector has one
  canonical subject and eligibility shape.

- 2026-06-22 D433: locked scheduled readiness v1 domain handoff/negative
  space. Shared readiness emits immutable eligibility/deadline visibility only;
  consumed/materialized/canceled/superseded semantics remain domain-owned facts
  with provenance to schedule/ready material. Overdue does not mean unconsumed
  and does not cancel ready. Shared sanitizer reuse may be internal or
  orchestration-local only; no public root sanitizer or scheduler authority is
  added.

- 2026-06-21 D423: locked Canvas host-registered renderer runtime bridge.
  Host-registered renderer runtime binding is caller-owned and runtime-private.
  Canvas may publish renderer manifest/ref DTOs, render-admission previews,
  serializable props, event port declarations, diagnostics, preview-only
  capability status, and typed event envelopes, but not registry
  implementations, renderer objects, lifecycle/teardown handles, callbacks,
  command buses, runtime permission enforcement, Workspace mutation,
  proposal admission/application, provider/runtime execution, credentials, or
  iframe/worker/postMessage/dynamic-source sandboxing. Generated source
  execution remains a separate future decision.

- 2026-06-21 D422: locked tool-provider graph-visible retry orchestration.
  Retry is a provider-neutral projector over visible input, outcome, policy,
  and clock/readiness facts. Delayed/backoff retry is scheduled/pending
  graph-visible material, and executable retry requests still become ordinary
  ToolProviderAdapterRunRequested facts that pass through D419 admission before
  runtime. Hidden adapter/runtime retry loops and hidden timers remain
  forbidden.

- 2026-06-21 D421: locked Canvas SidePanelActionIntent envelope validation
  status. Malformed or non-data intent envelope material such as metadata fails
  closed as `invalid-intent` with reason material such as `malformed-metadata`.
  Draft-specific malformed material remains `draft-required` /
  `malformed-draft`, target failures remain `invalid-target`, and unsupported
  lowering kinds remain `unsupported-lowering`; invalid envelope material never
  lowers to proposal-ready, admission, application, runtime execution, or
  durable graph truth.

- 2026-06-21 D420: locked Canvas generated component renderer admission
  boundary. Canvas renders generated components through a renderer manifest and
  host-owned renderer registry, not raw pasted/generated source execution in
  the main Canvas package. A render request consumes D417 binding preview
  material and produces render-ready or blocked preview data with serializable
  props, rendererRef, event port declarations, diagnostics, and capability
  policy status. First supported renderer kind is host-registered; iframe,
  worker, dynamic-source, dependency, origin, and postMessage sandboxing remain
  a separate future runtime decision.

- 2026-06-21 D419: locked tool-provider run admission and approval path.
  Tool-provider approval is a graph-visible run-admission gate before adapter
  runtime execution. Candidate ToolProviderAdapterRunRequested facts are
  consumed with ToolProviderAdapterInput and ToolProviderExecutionPolicy
  approval material, and policy-required candidates are not executable until
  admitted. Approval-required work produces a later visible run request with
  sourceRefs to the admission decision; it must not resume a private callback or
  mutate an existing run request. Adapter runtimes may still fail closed if
  approval evidence is absent, but they do not own approval lifecycle, human UI,
  or policy decision state.

- 2026-06-21 D418: locked Workspace proposal intake boundary from
  Canvas previews. Canvas may emit SidePanelActionIntent and pure lowering
  preview material, but canonical proposal facts are created only by a
  Workspace-owned intake boundary consuming a proposal-ready preview plus
  Workspace-supplied ids, actor/capability context, idempotency material,
  visible projection bundle, and policy. Admission and application remain
  separate append-only Workspace stages; Canvas must not generate canonical
  proposal/admission/application ids, mutate WorkItems, satisfy input gates, or
  execute runtime/provider actions.

- 2026-06-21 D417: locked Canvas generated component binding contract.
  Component binding is a slot-addressed render contract over supplied
  projection snapshots. Components read only reviewed slots such as WorkItem
  projection, attention item, projection bundle, recommended action, required
  input, material section, graph-node output projection, and boundary-input
  draft descriptors. Events emit typed data-only intents for UI navigation,
  SidePanelActionIntent, proposal drafts, or boundary-input preview. The
  binding layer may preview props, diagnostics, and lowering status, but must
  not execute code/providers/runtimes, mutate WorkItems, satisfy input gates,
  write graph state, admit, apply, or emit truth facts.

- 2026-06-21 D416: locked async tool-provider adapter runtime boundary.
  Synchronous ToolProviderAdapterBinding remains sync-only. Async providers such
  as HTTP execute through separate Layer C runtime helpers that consume
  graph-visible ToolProviderAdapterInput plus ToolProviderAdapterRunRequested
  facts and publish provider-neutral ExecutorOutcome/status/issues/audit
  material. Runtime-private drivers, AbortControllers, clients, transports,
  credentials, response streams, and cancellation state stay out of graph DATA.
  Retry/repeated execution and approval resume are new visible run requests, not
  hidden adapter loops or callbacks. Large/raw/sensitive response material uses
  D270/D293 summary/ref artifact material.

- 2026-06-21 D415: locked Rust native host binding boundary. TypeScript
  remains a self-contained complete package; Rust is the native shared engine
  and reusable graph-infrastructure library for Python and future non-TS host
  packages; Python owns idiomatic API, typing/decorators/context managers,
  value registry and host-object lifetime, exception mapping, async/runtime
  integration, ecosystem adapters, and vertical recipes. PyO3/native bindings
  may expose opaque graph/node/subscription handles and stable sync graph
  surfaces, but must not revive Impl/facade/port models, copy TS structure, let
  host callbacks bypass the dispatcher, or change protocol semantics.

- 2026-06-22 D431: locked Python host fatal boundary over Rust batch. A
  Python fatal BaseException in a native callback is a host-boundary abort, not
  graph ERROR or SubscriberCallbackError. Rust bindings may tunnel it with a
  core-recognized HostBoundaryAbort escape marker; wave-owner handling resets
  transient wave state and rethrows without emitting protocol messages. Batch
  body rollback remains normal, but once batch commit has begun there is no
  claim of full transactional rollback for already-committed graph effects.

- 2026-06-21 D414: locked Canvas Trusted Data Query pack boundary. The pack
  provides templates, catalog seeds, required-input seeds, acceptance criteria,
  verification recipes, bounded evidence/material projections, and recommended
  action seeds over existing Workspace/WorkItem/evidence/verification surfaces.
  It must not execute SQL, semantic queries, warehouses, provider/MCP/CLI/bash/
  file-edit/URL runtimes, LLM/tool adapters, or create Canvas-private WorkItem,
  verification, relationship, runtime, or fixture truth.

- 2026-06-21 D413: locked Canvas Workspace focused package surfaces.
  Workspace APIs use focused subpaths instead of a broad durable root. Pure
  data/projection contracts live separately from React UI surfaces, and root
  remains private scaffold until public hardening. Workbench, fixtures, demo
  harnesses, IssueBoard scaffolds, dashboard-private policy, fake runtimes,
  storage/router/executor bindings, and mutation/application helpers are not
  public default exports or production fallbacks.

- 2026-06-21 D412: locked Canvas WorkItem projection and Attention policy
  interface. Canvas consumes Workspace logic projection bundles centered on
  WorkItem projection plus optional required-input gates, recommended actions,
  link projections, bounded material sections, and attention reasons. Attention
  groups are configurable projection policy over those reasons and
  actor/workspace preferences; default groups remain seed policies, not closed
  enums, lifecycle states, queue truth, or board lanes. Canvas may render, sort,
  dedupe, and preserve UI preferences, while Workspace logic owns reason
  derivation and durable WorkItem/link/evidence truth.

- 2026-06-21 D411: locked Canvas SidePanelActionIntent lowering preview as the
  concrete boundary between UI intents and Workspace proposal/admission facts.
  The preview boundary may produce UI-local navigation, draft-required,
  confirmation-required, unsupported-lowering, invalid-target, or
  proposal-ready material, and may perform shallow client validation. It must
  not admit, apply, mutate WorkItems, satisfy Required Input, create durable
  relationship truth, execute providers, or invent canonical proposal/admission
  ids when Workspace logic has not supplied them.

- 2026-06-21 D410: locked Canvas SidePanelActionIntent lowering as an open,
  data-only UI intent envelope. Canvas may render forms and produce shallow
  intent/proposal previews, but Workspace logic owns schema semantics,
  actor/capability policy, idempotency, stale refs, duplicate/merge decisions,
  admission, and application. Unknown lowering kinds produce unsupported
  preview/status material and never execute. Attention Dashboard groups remain
  policy-driven projections, while hidden/snoozed/dismissed entries are
  actor/workspace projection preferences unless future Workspace logic locks
  explicit projection facts.

- 2026-06-20 D409: locked Canvas Side Panel Why/Evidence vs Debug boundary.
  Why/Evidence is user-facing, bounded, and action-oriented; Debug is
  deliberate-open diagnostic material. All displayed material must stay
  bounded/ref/redacted/public, while runtime-private provider/client/SDK/
  subprocess/transport/credentials/raw logs/retention internals never enter
  graph DATA or Canvas display.

- 2026-06-20 D408: locked Canvas fixture/demo/Workbench isolation. Main Canvas
  Workspace must never silently consume fake, demo, fixture, mockup, Workbench,
  or dry-run data as production facts. Fixtures live only behind explicit
  labeled test/demo/dev-harness boundaries; empty production data shows
  empty/setup/unresolved state instead of fixture fallback.

- 2026-06-20 D407: locked Canvas Recommended Actions as projection views.
  Side Panel clicks/forms produce action intents that lower into explicit
  proposal/admission/application paths; UI navigation may remain local. Existing
  `WorkspaceActionId` and Workbench policy may seed labels or disabled-reason
  language, but are not durable closed enums or command APIs.

- 2026-06-20 D406: locked Required Input as a graph-visible Workspace/WorkItem
  input gate with request, response proposal, admission/application, and
  satisfied or rejected status facts. Missing-input gates may be satisfied by
  admitted responses, while retention-gap, stale, mismatched, and request
  admission failures remain distinct and cannot be repaired by ordinary input
  responses.

- 2026-06-20 D405: locked Canvas Side Panel as a user-facing input/console
  surface whose drafts and action intents lower into graph-visible
  proposal/admission/application paths. LLM helpers may classify or fill drafts
  but cannot create, mutate, admit, apply, bypass policy, connect runtime
  providers, or select fake fixtures for the main workspace.

- 2026-06-20 D404: locked Canvas Side Panel information priority as a sticky
  Selection Card plus one WorkItem Details Card with policy-ordered/collapsed
  sections. Required input, primary action, blockers, duplicate/merge
  confirmation, relationship conflicts, and blocking policy/admission reasons
  may auto-expand; Why/Evidence, links, artifacts, recent activity,
  policy/admission, and Debug default collapsed unless needed or deliberately
  opened.

- 2026-06-20 D403: locked Workspace link type catalog/policy as the layer that
  maps open `WorkItemLink.linkKind` strings to display, direction, constraints,
  collapse defaults, and projection effects. Only blocker/waiting, duplicate or
  merge confirmation, relationship review, dangling refs, conflicts, or
  unauthorized/unsupported links affect attention by default; navigation,
  context, and provenance links stay in Side Panel or Topology Lens context.

- 2026-06-20 D402: locked durable WorkItem relationship truth as explicit
  WorkItem link facts plus a derived `WorkItemLink` projection. Parent-child,
  blocks, related, duplicate, and spawned-from are distinct semantics governed
  by a workspace link type catalog/policy, not metadata-only fields or Canvas
  topology edges. Canvas Side Panel, Attention Dashboard, All WorkItems, and
  Topology Lens consume link projections but do not own link mutation.

- 2026-06-20 D401: locked Canvas Workspace WorkItem creation as
  `WorkItemSpawnProposed` followed by explicit spawn admission/application
  before `WorkItemCreated`. Manual Side Panel intake, LLM-assisted
  classification, policy/helper follow-up, and linked/child creation may
  propose, but must not directly create or mutate WorkItems. Top-level create
  uses no fake parent WorkItem; relationship truth waits for an explicit
  reviewed link vocabulary.

- 2026-06-20 D400: locked Canvas Workspace's default surface as a configurable
  Attention Dashboard projection. `Needs me`, `Review`, `Waiting`, and `Recent`
  are default groups, not lifecycle states, queue truth, fixed board lanes, or
  a closed enum. `All WorkItems` remains secondary, and Topology Lens remains an
  overlay rather than a default page.

- 2026-06-19 D399: locked Canvas Workspace Side Panel as a sticky Selection
  Card plus one consolidated WorkItem Details Card with collapsible sections.
  Section kinds are rendering slots, not fixed panel positions; required input
  and blockers may auto-expand, evidence/context/policy/recent/debug default
  collapsed unless preference or attention policy expands them. Debug remains
  deliberate and isolated.

- 2026-06-19 D398: locked Canvas Workspace WorkItem type customization as a
  workspace-level type catalog and policy profile over `WorkItemDraft.kind` and
  `customFields`. `Task`, `Spike`, and `Review` are default seeds, not a closed
  enum; runtime/status taxonomies such as missing-input, retention-gap, stale,
  mismatched, and policy-denied remain attention/actionability reasons rather
  than default user-facing WorkItem types.

- 2026-06-19 D397: locked WorkItem spawn proposal as canonical create proposal.
  `WorkItemSpawnProposed` covers top-level manual creation, LLM-assisted intake,
  linked/child creation, and policy/helper-generated follow-up work. Existing
  `WorkItemDomainActionProposal` spawn actions remain actions over an existing
  WorkItem and may lower into spawn proposals after admission; Canvas must not
  introduce a private create proposal API or mutate WorkItems directly.

- 2026-06-17 D390: locked Canvas WorkspaceGraph topology projection surface.
  WorkspaceGraph topology projection is a pure Canvas product-layer selector
  over WorkspaceGraph facts. Its durable surface may extend
  `@graphrefly/canvas/workspace-graph` with renderer-independent
  WorkspaceTopology node/edge/model types and `deriveWorkspaceTopology`.
  These nodes/edges are issue/work-control projection data, not GraphReFly
  runtime nodes, substrate edges, execution status, renderer layout, storage,
  routing, executor behavior, or WorkItem mutation.

- 2026-06-17 D389: locked ToolProviderAdapterRuntime retention evidence horizon.
  Runtime-private proof evidence such as adapter-input tombstones and
  execution high-water records may be bounded by an explicit `retentionEvidence`
  horizon using the same D80 policy vocabulary and graph-owned reader path.
  Evidence trimming fails closed: later requests that cannot be proven fresh
  emit visible retention-gap status/issues/audit and must not execute bindings.

- 2026-06-17 D388: locked Canvas scope focused subpath public symbol list.
  First durable `@graphrefly/canvas/scope`-style surface exports the focused
  scope/navigation contract, snapshot/resolution data, pure acceptance helpers,
  pure transition/reconcile helpers, and only a migrated durable bundle adapter.
  Current root scaffold bundle and WorkspaceGraph/UI/React/storage/router/
  mutation symbols remain private or non-durable until separately reviewed.

- 2026-06-17 D386: locked Canvas scope bundle adapter input boundary.
  Durable Canvas scope bundle adapters use distinct inputs for workspace
  validation, immediate requested scope, and persistent snapshot candidates.
  Mixed requested/snapshot paths require explicit precedence or mode, not
  hidden last-writer wins.

- 2026-06-17 D387: locked ToolProviderAdapterRuntime retention concrete API shape.
  Runtime retention reuses D80 `CapacityPolicy` / `RetentionPolicy` vocabulary
  over explicit runtime-private indexes (`adapterInputs`, `runRequests`,
  `executions`, `runStatuses`, `runIssues`). Score callbacks see only bounded
  public lifecycle entry shapes; Node-valued `maxSize` is graph-declared, and
  execution retention-gap safety uses `adapterInputId` plus monotonic attempt.

- 2026-06-17 D382: locked Canvas scope bundle adapter output contract.
  Durable Canvas scope bundle adapters expose `CanvasScopeResolution` as the
  canonical output and a separate accepted/current scope convenience node.
  Pending/conflict do not accept a new scope, synthesize defaults, or silently
  clear/replace prior accepted scope.

- 2026-06-17 D381: locked Canvas scope snapshot conflict payload.
  `CanvasScopeResolution` conflict payload is explanatory data over the
  conflicting snapshot key with reason, candidate count, bounded candidate
  summaries/refs, and optional status/issues. Complete snapshots remain source
  facts; conflict material carries no callbacks, hidden winner, route, storage,
  hydration, React/UI, or tie-breaker ownership.

- 2026-06-17 D380: locked Canvas persistent scope snapshot revision semantics.
  Snapshot revision v0 is `revision:{kind:'sequence', value:string}` where
  value is a canonical non-negative decimal integer string comparable only
  within the same normalized snapshot key. Actor/provenance explain authorship
  but do not break ties or define ordering.

- 2026-06-17 D379: locked Canvas persistent scope snapshot fields.
  Persistent Canvas scope snapshot v0 is a graph-visible current-snapshot fact
  with normalized `canvas-view`/`canvas-session` owner key, workspace validation
  context, scope payload, revision material, optional actor attribution, and
  optional provenance/source refs. It does not carry route, storage, history,
  executor, React binding, viewport, or mutation ownership.

- 2026-06-17 D378: locked Canvas scope resolution result shape.
  `CanvasScopeResolution` is a mutually exclusive tagged union for pending,
  resolved, unresolved, and conflict. Pending/conflict do not imply a default
  scope, and accepted unresolved scopes carry primary unresolved plus optional
  secondary status material.

- 2026-06-17 D377: locked Canvas scope primary unresolved priority.
  `CanvasScopeModel` primary unresolved is chosen by the stage that blocks
  faithful scope/return restoration. Snapshot pending/conflict stay outside
  the model; secondary diagnostics belong in `CanvasScopeResolution` or
  adjacent status material.

- 2026-06-17 D376: locked Canvas scope unresolved cardinality.
  `CanvasScopeModel` carries at most one deterministic primary unresolved
  reference. Multiple diagnostics, secondary missing refs, conflicts, pending
  restore, and issue arrays belong in `CanvasScopeResolution` or adjacent
  status nodes.

- 2026-06-17 D375: locked Canvas scope serialized tag spelling.
  Durable Canvas scope serialized tags use lowercase ASCII kebab-case strings.
  TypeScript symbols may use PascalCase/camelCase, but persisted facts and
  discriminants use kebab-case, with `workspace-mismatch` added when D374 lands
  in the focused scope subpath.

- 2026-06-17 D374: locked Canvas scope workspace mismatch semantics.
  Canvas scope restore/return treats `workspaceId` mismatch as explicit
  unresolved/status material, not automatic cross-workspace navigation. Route,
  loading, access, and workspace ownership stay in caller-owned product command
  paths.

- 2026-06-17 D373: locked Canvas scope unresolved action intent boundary.
  Canvas scope unresolved action intents are data-only affordances, not mutation
  hooks or callbacks. Repair intents may map to caller-owned graph-visible
  command/proposal facts, while relink/restore/remove/request-access execute
  only through separate visible product/domain command paths.

- 2026-06-17 D372: locked Canvas scope restore resolution status.
  Durable Canvas scope restore exposes explicit resolution status for pending
  restore, accepted resolved scope, accepted-but-unresolved references, and
  snapshot conflict. Conflict blocks applying a new current scope; pending and
  unresolved states never fallback to defaults.

- 2026-06-17 D371: locked ToolProviderAdapterRuntime retention policy.
  Tool-provider runtime retention reuses the D284 library retention model as an
  explicit Layer C runtime-index policy. Default retention remains unbounded
  until dispose; opt-in v0 bounds are count-capacity only, trim runtime-private
  indexes without deleting graph facts, and surface trimming/retention gaps as
  visible status/audit/DataIssue material rather than hidden re-execution.

- 2026-06-17 D370: locked Canvas scope pure model and bundle adapter split.
  The focused Canvas scope API splits durable pure model/transition functions
  from a narrow GraphReFly bundle adapter. The adapter may wire state/derived
  nodes and boundary setters, but must not own storage, executor routing,
  WorkItem/WorkspaceGraph mutation, React bindings, or hidden runtime side
  channels.

- 2026-06-17 D369: locked Canvas scope tagged vocabulary.
  Canvas scope durable API uses explicit tagged semantic vocabulary for scope,
  selection, unresolved target, reason, action intent, and return-context
  states. Exact string spellings get one final pre-subpath naming pass; after
  export, renaming/removing tags requires migration/design review.

- 2026-06-17 D368: locked Canvas scope/navigation public export surface.
  Durable Canvas scope/navigation APIs live in a focused
  `@graphrefly/canvas/scope`-style subpath. Root exports may remain private
  scaffold until package-surface review; React/UI bindings, storage, executor
  routing, WorkspaceGraph ownership, and WorkItem mutation stay outside the
  scope subpath.

- 2026-06-17 D367: locked Canvas persistent scope snapshot conflict policy.
  Multiple persistent Canvas scope snapshots for the same view/session use
  graph-visible revision/provenance. Comparable highest revision wins, exact
  duplicates are idempotent, and missing/incomparable/tied-different revisions
  emit explicit conflict material instead of hidden adapter-order selection.

- 2026-06-17 D366: locked Canvas persistent scope selection fact shape.
  Persistent Canvas scope selection v0 is a current snapshot fact keyed by
  `canvasViewId`/`canvasSessionId`, not a required navigation event ledger.
  Future navigation audit/history may be an explicit ledger that derives or
  updates snapshots, but v0 does not require or hide one.

- 2026-06-17 D365: locked Canvas return context depth.
  Canvas return context v0 is a single immediate return frame, not a stack or
  navigation ledger. Return restores that exact frame after reference
  validation; missing or mismatched targets produce explicit unresolved state
  and never skip to older frames or defaults.

- 2026-06-17 D364: locked persistent Canvas scope selection identity.
  Persistent WorkGraph/WorkspaceGraph toggle state is keyed by explicit
  `canvasViewId`/`canvasSessionId`, with optional `actorId` attribution.
  `workspaceId` is validation/domain context, not UI selection ownership, so
  multiple Canvas views over the same workspace may hold different persistent
  scopes.

- 2026-06-17 D363: locked Canvas scope navigation API hardening.
  Canvas scope navigation is a product-layer selection/navigation surface over
  ordinary GraphReFly topology and WorkspaceGraph projections. Durable API
  shape splits pure scope data/transitions from the GraphReFly bundle adapter.
  Scope, selection, missing-target, workspace-mismatch, and return-context
  states are explicit tagged data, never fake ids or silent first-target
  fallback. Persistent WorkGraph/WorkspaceGraph toggle is graph-visible Canvas
  product state over `CanvasScopeModel`; ephemeral viewport affordances may
  stay local.

- 2026-06-17 D362: locked the tool provider adapter runtime public text
  and retry attempt boundary. Provider-returned text may become graph-visible
  only as adapter-declared public material in bounded fields such as
  `DataIssue.message`, `ExecutorOutcome` summaries, canceled reasons, small
  metadata strings, or D270 artifact summaries. Raw stdout/stderr, stack
  traces, provider raw responses, large diffs/file contents, binary/media, and
  sensitive material use D270 summary/ref artifact envelopes with D293
  size/redaction evidence. Runtime-thrown/rejected error messages remain
  private and are normalized to issue codes/types. Retry attempt identity is
  execution lifecycle material, not `ToolProviderAdapterInput` identity; real
  retries or repeated unchanged-input executions require explicit graph-visible
  run/attempt request facts.

- 2026-06-17 D361: locked the tool provider adapter runtime boundary.
  Ready `ToolProviderAdapterInput` facts remain graph-visible data-only
  execution inputs; runtime-private `ToolProviderAdapterBinding` objects may
  hold clients, credentials, subprocess access, MCP transports, Composio/OAuth
  state, SDK objects, and environment handles, but those bindings are never
  graph DATA, never serialized policy/input material, and never imported by
  WorkItem core. Adapter runtimes subscribe to ready inputs, invoke exactly the
  matching binding outside WorkItem and policy projectors, and publish only
  provider-neutral `ExecutorOutcome` plus visible status, DataIssue, usage,
  artifact/material refs, and audit facts. Hidden fallback or route/profile
  selection remains forbidden; fallback requires a new visible `ExecutorRoute`.

- 2026-06-17 D359: locked basic agent tools as optional Layer C executor/tool
  providers, not WorkItem core or protocol primitives. Local builtin tools
  (document/file read, file edit/apply-patch, bash, URL/date/weather/calculator)
  plus MCP, CLI, and Composio providers execute only through accepted
  AgentRequest facts and explicit ExecutorRoute/Profile selection, return
  provider-neutral ExecutorOutcome, and keep clients/secrets/transports in
  runtime-private bindings. Prompt/UI/diagnostic/audit views are derived by
  explicit outcome-view projector nodes under D270/D293 size/redaction policy;
  large logs, stacks, raw provider responses, diffs, and sensitive material use
  summary/ref artifact envelopes and are not automatically inlined into LM
  context.

- 2026-06-16 D358: locked WorkItem failure-to-repair ticket policy as an
  optional replaceable solution helper, not a generic core default.
  Core WorkItemEffectPlan interpretation remains conservative: required
  failure, blocked prerequisite, timeout, stale input, or unverifiable evidence
  emits visible plan status/result, DataIssue, source refs, and audit only. A
  solution/helper policy may consume those facts plus explicit retry/exhaustion
  and policy facts to emit ordinary WorkItemDomainActionProposal facts such as
  spawn-child, spawn-proposed, patch, or require-review, with dedupe, source
  refs, priority/deadline/capacity hints, and bounded child creation. Those
  proposals still pass through admission, capability guard, and apply policy;
  any LLM replan remains an ordinary later EffectRun/executor path.

- 2026-06-16 D356: locked VerificationPlan's Canvas/userland boundary.
  VerificationPlan remains the minimal reusable WorkItem authoring and
  verification contract; Canvas/product/user land owns authoring UX, templates,
  LLM plan generation, checklist and scorecard catalogs, concrete
  command/test/format/PR/GitHub/CI adapters, provider prompts, human-review
  screens, and product-specific verification policies. Canvas may emit
  graph-visible `VerificationPlanChanged` or `WorkItemEffectPlanProposed`
  facts, but must not become hidden truth owner for WorkItem verification
  state. Scorecard-style facts may start as Canvas/product recipes returning
  ordinary DataIssue/DataResult, ExecutorOutcome, WorkItemEvidenceRecorded, or
  EffectRunResult material; promotion into a reusable solution waits for a
  concrete non-Canvas consumer.

- 2026-06-16 D355: locked WorkItemEffectPlan v0 identity/fact/lowering
  contract with a deliberately minimal plan-domain coordinate model:
  `workItemId`, `planId`, `executionInputRevision`, and `memberId`. v0 does
  not add separate `proposalId`, `admissionId`, or `planAdmissionId`; request
  ids, effectRun ids, status/result ids, and `idempotencyKey` stay execution or
  record identities, not plan join keys. `WorkItemEffectRequested` gains
  optional top-level `executionInputRevision`, `planId`, and `planMemberId` so
  plan-aware lowerers can join evidence/results without parsing metadata.
  Admission emits an immutable normalized admitted plan snapshot; eligible
  member lowering emits ordinary effect requests exactly once per
  workItem/plan/revision/member coordinate. v0 join policy is intentionally
  small: default all-required plus optional evidence-only; quorum/any/weighted
  joins are deferred until a concrete consumer proves the need.

- 2026-06-16 D354: locked WorkItemEffectPlan as the default WorkItem
  execution-plan shape for LLM- or policy-proposed serial, parallel, and
  fan-out/fan-in effect DAGs. Dynamic branch count is represented by bounded
  graph-visible plan/member facts; fixed WorkItem topology validates proposals,
  admits or rejects them, lowers eligible members to ordinary
  WorkItemEffectRequested facts, and joins later evidence/results/status by
  plan/member/effect/request ids. Human gates, repair, retry, stale-input
  handling, and capacity constraints are orthogonal policies or facts over the
  plan DAG, not topology modes. The plan layer must not claim queues, dispatch
  executors, mutate WorkItems, own worker registries, create/delete graph nodes
  per member, or treat queue/executor completion as domain truth.

- 2026-06-16 D343: locked WorkItem authoring and verification validation
  status taxonomy. Authoring/AC/verification-plan/scheduling-policy/lowerer
  validation problems are graph-visible DataIssue/status/audit facts, not
  protocol ERROR, hidden exceptions, silent no-ops, or best-effort execution.
  v0 covers malformed draft, missing required fields, invalid patch, duplicate
  ids, dangling refs, cyclic dependencies, unsupported modes/effect kinds,
  oversized inline data, policy mismatch/missing policy, stale revision/input,
  blocked prerequisites, verification unplanned, manual review required,
  duplicate suppression, ambiguous/partial coverage, unverifiable output,
  unauthorized author/target, and invalid schedule. Constructors throw only for
  programmer-invalid static helper configuration; runtime data stays visible
  and recoverable.

- 2026-06-16 D342: locked AcceptanceCriteria and VerificationPlan v0 data
  shapes. AcceptanceCriterion carries stable criterionId, statement, optional
  required flag, source refs, and metadata. VerificationPlan carries plan
  identity/revision material and VerificationStep values. VerificationStep
  carries stable stepId, optional title/description, verifiesCriteriaIds, mode
  (auto/manual/hybrid), optional effectKind/subkind, goal/input material for
  WorkItemEffectRequested lowering, context refs, requirements/capacity hints,
  dependsOnStepIds, policy/source refs, and metadata. These are authoring and
  policy data, not callbacks, prompts, bindings, queue truth, or mutations.
  Missing/duplicate/dangling/cyclic/unsupported/oversized/policy-incompatible
  material emits visible issue/status/audit.

- 2026-06-16 D341: locked verification evidence/result mapping.
  Verification outcomes return evidence-first: EffectRunResult, executor
  outcomes, or terminal workQueue records map first to WorkItemEvidenceRecorded
  with verification step/AC/revision/source refs. A separate
  verification-result mapper consumes evidence plus current WorkItem projection,
  verification plan, AC, executionInputRevision, prior results, and explicit
  mapping policy to emit VerificationResultRecorded, WorkItemDomainActionProposal
  facts, status, issues, and audit. VerificationResultRecorded is interpreted
  domain verification for AC/step/revision coordinates; it is not raw executor
  output and does not mutate lifecycle unless later admitted/applied. Stale,
  missing-policy, ambiguous, partial, failed, manual-review, duplicate,
  malformed, mismatched, or unverifiable outcomes emit visible issue/status/audit.

- 2026-06-16 D340: locked VerificationPlan-to-WorkItemEffectRequested
  lowering. VerificationPlanChanged facts and initial verification plans in
  WorkItemCreated are authoring data and do not execute by themselves. The
  verification-request lowerer consumes current WorkItem projection, AC,
  verification plan/steps, executionInputRevision, dependency state, policy,
  prior evidence/results, and optional queue/executor availability, then emits
  WorkItemEffectRequested facts with effectKind `"verification"` or narrower
  subkind, stable ids/idempotency, revision/source refs, step/AC refs, policy
  refs, limits, context refs, and audit refs. Missing/manual/blocked/duplicate/
  stale cases emit visible status/issues/audit rather than silently running or
  closing work. Spawned WorkItems use the same path after accepted child facts
  create their own projection/revision.

- 2026-06-16 D339: locked WorkItem authoring event vocabulary v0.
  WorkItemCreated records accepted WorkItemDraft initial state; WorkItemPatched
  records generic PatchSpec-style draft/projection changes; AcceptanceCriteriaChanged
  and VerificationPlanChanged are first-class facts because they drive
  verification and stale execution-input behavior. Helper request/proposal
  facts may carry WorkItemDraft, but accepted domain state derives only from
  recorded WorkItem facts emitted through apply policy. Revision advancement is
  projection/status output, not a user-authored event. Product-specific fields
  use WorkItemPatched/custom fields plus explicit execution-relevance policy
  rather than public per-field event sprawl.

- 2026-06-16 D338: locked WorkItem revision and execution-input identity.
  WorkItem projections expose at least `authoringRevision` and
  `executionInputRevision`, derived from append-only WorkItem facts. Revisions
  are graph-visible projection data, not protocol versions, global clocks,
  hidden counters, or executor/workQueue state. `authoringRevision` advances on
  accepted authoring changes; `executionInputRevision` advances on
  execution-relevant changes such as detail/detail refs, acceptance criteria,
  verification steps/plans, and policy-declared execution-relevant dependency
  or source facts. Product metadata/custom fields stale execution only when
  explicit policy marks them execution-relevant. Execution-producing facts must
  carry revision coordinates or source refs; lowerers compare against current
  projections and emit visible stale issue/status/audit plus policy outcome.

- 2026-06-16 D337: locked the WorkItem scheduling recipe package surface.
  Scheduling vocabulary and recipes live under a solution-focused WorkItem
  subpath such as `@graphrefly/ts/solutions/work-item/scheduling`, not in
  workQueue core, executor core, messageBus, eventFlow, or the root export.
  The surface may export WorkItemPriorityAssessment, WorkItemPlacementDecision,
  WorkItemScheduleDecision, WorkItemDispatchIntent, lowerer bundles, status,
  issues, audit, and optional default policy helpers. Power users may replace
  helpers with their own policy/projector nodes emitting the same facts. The
  recipe must not own queue admission/claim, executor dispatch, domain
  mutation, WorkItem event application, private timers, worker registries, or
  product-specific workflow engines.

- 2026-06-16 D336: locked WorkItem scheduling lowerers and stale-input
  policy. Lowerers are explicit graph-visible projector nodes consuming D335
  policy facts plus current WorkItem projections, revision/source refs,
  dependency state, queue/executor availability, and lowerer policies.
  Priority assessments remain advisory; placement decisions lower to domain
  action proposals; schedule decisions lower to WorkItemEffectRequested facts,
  workQueue schedule/submit commands, or status/audit; dispatch intents lower
  to WorkItemEffectRequested or executor/request proposals through existing
  lowerers. Lowerers validate refs, policy, target kind, timing, requirements,
  capacity, lifecycle, and dependencies. Stale execution inputs emit visible
  issue/status/audit and follow explicit stale policy such as cancel,
  reschedule, requeue, replacement intent, or review.

- 2026-06-16 D335: locked the WorkItem scheduling policy output vocabulary.
  Replaceable scheduling policies emit narrow policy facts such as
  WorkItemPriorityAssessment, WorkItemPlacementDecision,
  WorkItemScheduleDecision, and WorkItemDispatchIntent. These facts carry
  workItem id, revision/source refs, policy/source refs, reason/audit,
  priority/rank, placement/target, and scheduling material such as notBefore,
  deadline, requirements, and capacity hints. They are not WorkItemEvents and
  do not mutate WorkItems. Lowerers/recipes consume them plus current WorkItem
  projections to emit domain action proposals, WorkItemEffectRequested facts,
  workQueue submit commands, or executor/request proposals. Execution-producing
  outputs must be revision/source-ref aware so pre-execution edits can stale,
  cancel, reschedule, requeue, or require review visibly.

- 2026-06-16 D334: locked WorkItem prioritization, next-work selection,
  placement, dispatch preparation, and scheduling as replaceable graph-visible
  policy/projector nodes over WorkItem projections, metadata/properties,
  evidence, AC/verification plans, deadlines, placement lanes, dependency
  state, queue/executor availability, capacity, and explicit policy facts.
  These policies emit visible decisions/proposals/effect requests/queue
  commands through existing lowerers and recipes. They must not mutate
  WorkItems, bypass apply policy or workQueue admission, claim imperatively,
  dispatch ExecutorBindings, fabricate ExecutorOutcome, or hide schedulers.

- 2026-06-16 D333: locked the WorkItem authoring data surface. Human/API
  creation, human edits, LLM spawn proposals, and LLM patch proposals share a
  WorkItemDraft payload carrying summary, detail/detail refs, acceptance
  criteria, verification steps/plans, and ordinary product fields as explicit
  message/event data. LLM output remains proposal material. Human and LLM
  authors may edit draft-owned fields for a WorkItem only while the relevant
  revision has not yet been admitted/claimed/used as execution input; later
  edits become new revisions or explicit patches that trigger visible
  re-verification/reschedule/cancel/requeue/review policy. Verification steps
  are authoring data that may derive WorkItemEffectRequested facts, not hidden
  execution commands.

- 2026-06-14 D269: locked explicit `PULL({pullId, params?})` as the
  protocol demand message. `RESUME` returns to pause-lock release only and must
  not demand pull nodes or carry pull params. The closed message set is now 11
  types with no new tier: `PULL` lives in tier 1 control/demand and remains
  `ctx.up`-only. Pull params are holder-visible demand payload for pullable
  snapshots, retained views, and messaging subscription/catalog pulls; they are
  not DATA-up and not a second downstream snapshot channel. If a PULL is owed
  while the holder is not settle-ready, later separate PULL params overwrite the
  owed params (latest owed params wins); same-wave diamond duplicates remain
  first-delivery/idempotent. `R-msg-closed-set`, `R-tier`, `R-ctx-up`, `R-pull`,
  `R-up-routing`, diamond routing, deferred self-demand, and the
  C-16/C-18/C-25/C-26 conformance line reset to draft/todo until TS/Rust/Py
  implement the PULL-shaped protocol.

- 2026-06-14 D272: locked the PULL holder implementation/API shape. PULL
  params are exposed only to the pullId-holder execution as read-only holder
  context (`ctx.pull` / equivalent `PullDemand` context), never as DATA-up and
  never as a second snapshot channel. The pull quiet latch is semantically
  separate from the external PAUSE/RESUME lockset: model it as
  `pullQuiet`/`owedPull`/`activePull` plus external `pauseLockset`; `RESUME`
  cannot release demand state or install pull context. No `ctx.pull()` command,
  node-reference demand method, compatibility `RESUME` demand shim, or hidden
  cache read is added.

- 2026-06-15 D276: locked retained/pullable projection pull-id naming. Retained
  is the semantic category; concrete output nodes keep concrete names such as
  `snapshot` or `available`. Public pull ids are named after the output node
  they drive: `snapshotPullId` for `snapshot`, `availablePullId` for
  `available`, and similarly `rangePullId`/`pagePullId` if those become
  pullable outputs. `messageBus.catalog()` and `deadLetter()` expose
  `snapshot` + `snapshotPullId`; subscriptions expose `available` +
  `availablePullId`. D121 collection view naming should migrate pre-1.0 from
  bare `pullId` to `snapshotPullId` without changing delta/snapshot semantics.

- 2026-06-15 D278: locked the PULL service split required by retained views.
  PULL guarantees a serviceable holder invocation with `ctx.pull`/`PullDemand`,
  even when retained state has not changed since the prior demand; downstream
  DATA remains ordinary holder/helper policy. Plain snapshot helpers may stay
  silent on no-change pulls, while parameterized retained views may emit pages
  or snapshots from params plus retained state/cursor. This keeps params out of
  DATA-up, preserves `RESUME` as pause-only, and lets messaging
  `catalog()`/`deadLetter()` snapshots and subscription `available` answer
  `limit`/cursor/filter pulls without imperative reads.

- 2026-06-15 D279: locked the final messageBus v0 public API shape. The core
  exposes `commands`, `messages`, `status`, and `issues`; `errors`, public
  `runtime`, public `topicLog`, bus-level `cursor`, top-level `topics`,
  `dynamicHub` aliases, and compatibility facades are retired. `catalog()`,
  `deadLetter()`, `topic(topic)`, and `subscription(...)` are on-demand
  projections. `topic(topic)` filters retained messages without creating a
  topic or dynamic graph node. Subscription `available` uses
  `availablePullId` with page-shaping params only; cursor movement remains
  `ack` or `seek`. Job queue semantics stay above messaging in
  orchestration/adapters.

- 2026-06-15 D282: locked messageBus topicPolicy defaults. `publish` to an
  unknown topic is strict by default and emits `DataIssue(code:"unknown-topic")`
  without creating a topic or retained message; `publish` to a closed topic
  emits `closed-topic` and does not reopen it. `ensure-topic`/`ensureTopic` is
  the canonical graph-visible creation path. `topic(topic)` remains a projection
  only. Explicit opt-in auto-create policy may exist, but it must emit the same
  visible topic-created/catalog/status facts and obey validation/bounds; it is
  not dynamic topology or a `dynamicHub` facade.

- 2026-06-15 D284: locked messageBus retention/dedupe policy reuse. Retention
  is a structure-owned adapter over the retained topic-log backend, reusing the
  existing library policy model: static policy values become constant config,
  Node-valued policy values become declared deps of the bus runtime/apply path,
  and all visible mutations flow through messageBus status/issues/messages and
  subscription cursor state. v0 supports count capacity and age expiry via the
  shared capacity/deadline vocabulary; trims remove oldest topic messages,
  advance `headSeq`, never rewrite/reuse `seq`, and put affected subscriptions
  into D266 retention-gap until explicit `seek`. Byte-size retention is deferred
  until a shared size-capacity policy exists. Dedupe is command-admission
  policy over `commandId` and optionally `topic+key`, never payload equality.

- 2026-06-15 D285: locked messageBus pullable projection params/page shapes.
  Projection pulls use explicit replayable coordinates, not opaque page tokens:
  shared params may carry `limit`; catalog snapshot params use `afterTopic` and
  `includeClosed` over topic-string ordering; deadLetter snapshot params use
  `afterEntrySeq` plus optional `topic`/`code`; subscription `available` params
  use `afterSeq` only as page continuation. Omitted `available.afterSeq` starts
  at `cursor.nextSeq`; provided `afterSeq` starts after that seq but never moves
  the subscription cursor. Pages return `hasMore` plus the next coordinate
  (`nextAfterTopic`/`nextAfterEntrySeq`/`nextAfterSeq`). Byte-budget page params
  are deferred until a shared size-capacity policy exists.

- 2026-06-15 D287: locked messageBus status fact taxonomy. `status` is a
  DATA-level accepted-operation / observable-state stream, separate from
  `issues`; malformed commands, unknown/closed topics, invalid cursors,
  retention gaps, policy rejections, duplicate-command errors, and clock/policy
  failures emit `DataIssue`, not status. v0 status kinds are closed:
  `topic-created`, `topic-closed`, `published`, `subscription-opened`, `acked`,
  `seeked`, `subscription-closed`, `retention-trimmed`, and `command-deduped`.
  Status facts carry stable topic/subscription/seq/cursor coordinates and do not
  authorize job queue or workflow behavior.

- 2026-06-15 D290: locked jobQueue as a separate application-infrastructure
  subpath between messaging and orchestration. `messageBus` remains the retained
  topic-log plus independent subscription-cursor substrate and does not grow job
  lifecycle, worker ownership, lease, retry, delay, schedule, heartbeat, or
  completion semantics. `jobQueue` depends on messaging plus shared
  DataIssue/status/policy/resilience helpers, owns job state/attempt/lease/retry
  and worker facts, and may be consumed by orchestration. `messageBus ack`
  means durable ingestion into jobQueue-visible facts, not job completion.

- 2026-06-15 D294: renamed the standalone queue layer from `jobQueue` to
  `workQueue`, superseding D290's public name while preserving its boundary.
  `workQueue` is the generic application-infrastructure queue above
  `messageBus`; it owns work records, claim/lease/visibility timeout,
  retry/delay/schedule, heartbeat/renewal, complete/fail/cancel, dead-letter,
  status, and issues. `workItemQueue` may exist only as an orchestration or
  solution composition over `workQueue`; `jobDispatch` is rejected as executor
  dispatch terminology, not durable queue lifecycle.

- 2026-06-15 D299: locked workQueue public core and first command/record
  vocabulary. The core exposes `commands`, `records`, `status`, and `issues`;
  `records` is the append-only lifecycle ledger and source of truth for derived
  state. `available()`, `work(workId)`, and `deadLetter()` are on-demand
  projections with output-named pull ids and no mutation. Commands are `submit`,
  `claim`, `renew-lease`, `release`, `complete`, `fail`, `cancel`, and
  `schedule`; record families include admission, scheduling, claim/lease,
  release, attempt outcome, retry, completion, cancellation, and dead-letter.
  `submit` becomes accepted work only after bound messageBus ingestion emits a
  `work-admitted` record; messageBus `ack` remains ingestion/cursor progress,
  not work completion.

- 2026-06-15 D301: locked workQueue derived state and transition semantics.
  State is derived from `records` plus explicit policy and clock/deadline facts,
  not a mutable authoritative map. Common derived states are `scheduled`,
  `ready`, `leased`, `retry-wait`, `completed`, `canceled`, and `dead-lettered`;
  only `ready` work is claimable. `claim` starts a monotonic attempt and creates
  a lease; `renew-lease`/`release`/`complete`/`fail` require the current active
  lease/attempt; stale lease commands emit `DataIssue`. Failure emits
  `attempt-failed` then either `retry-scheduled` or `work-dead-lettered` via
  shared retry policy. Visibility timeout is visible lease-expiration material
  from graph-local clock/deadline inputs, never a hidden timer or wall-clock peek
  inside `available()`.

- 2026-06-15 D307: locked the workQueue admission boundary over messageBus.
  Each consumed retained message must produce exactly one durable
  workQueue-visible admission outcome before the messageBus subscription cursor
  may advance: `work-admitted` for accepted work, or `work-rejected` /
  `admission-rejected` plus `DataIssue` for deterministic non-admission such as
  malformed payload, schema/policy rejection, duplicate rejection, or size
  policy failure. Transient/retryable ingestion failures do not ack and leave the
  cursor unchanged. `messageBus ack` for workQueue ingestion means durable
  admission outcome only, never work completion.

- 2026-06-15 D310: locked workQueue messageBus binding and submit shape.
  `workQueue` requires an explicit binding with `bus`, `topic`, stable
  `subscriptionId`, and optional `from`; `queueId` may derive deterministic
  default names, but all derived names must be stable, describe-visible, and
  user-overridable. Topic lifecycle remains messageBus-owned through
  `ensure-topic`, `close-topic`, `topicPolicy`, catalog/status, and `DataIssue`.
  `submit` helper sugar publishes to the bound messageBus topic only; it does not
  append records, admit work, claim work, or advance cursors directly. Admission
  policy emits only `work-admitted` or `work-rejected` / `admission-rejected`
  outcomes and cannot smuggle claim/lease/worker/orchestration behavior.

- 2026-06-15 D311: locked workQueue work identity, dedupe, and idempotency.
  The default `workId` is replay-stable and derived from `queueId + topic + seq`,
  while `workId`, `idempotencyKey`, or a domain work key in submit/admission
  payloads participate in duplicate recognition only under explicit
  `WorkQueueDedupePolicy`. Payload equality, random ids, wall-clock time,
  subscription order, object identity, and process-local counters are rejected as
  dedupe bases. `messageBus.commandId` dedupe remains publish-command dedupe and
  does not replace workQueue admission dedupe. Duplicate admission never emits a
  second `work-admitted`; it produces either `admission-deduped` status or
  `work-rejected` / `admission-rejected` plus `DataIssue(code:"duplicate-work")`,
  both durable enough to allow ingestion ack.

- 2026-06-15 D312: locked workQueue `available()` and claim ordering.
  `available()` is a read-only, possibly stale candidate projection and never
  reserves, claims, mutates queue state, acks, seeks, completes, fails, or
  cancels work. Reservation is created only by accepted `claim` commands that
  emit `work-claimed` records. Claims may target explicit `workId`s or request
  next/batch candidates under explicit claim policy; current derived state at
  claim time decides success. Concurrent/stale losing claims emit visible
  `DataIssue`/status such as `not-ready`, `already-leased`, `stale-candidate`,
  or `policy-rejected`. v0 ordering defaults to FIFO by stable admission order;
  priority/deadline/affinity/custom ordering require explicit records/policy
  facts.

- 2026-06-15 D313: locked replaceable claim policy and capacity fit. Claim
  selection is a graph-visible policy/projector over ready candidates, worker
  facts, active leases, size/capacity evidence, queue policy, and graph-local
  clock/deadline facts. Core may define generic work metadata such as priority,
  tags, requirements, cost/size evidence, `notBeforeMs`, and `deadlineMs`, plus
  worker facts such as capabilities, current usage, active leases, and capacity
  policy, but does not hardcode the matching matrix. D291 bounded-flow/rate-limit
  and D293 size-capacity vocabulary may back reusable recipes, including
  token-like units, but token bucket is optional recipe/helper material, not the
  core claim model or a hidden scheduler.

- 2026-06-15 D314: locked workQueue lease expiration materialization. Lease
  expiration is a first-class visible `lease-expired` record derived only from
  explicit graph-local clock/deadline facts such as `nowMs`, `clockRef`, and
  `leaseExpiresAtMs`; it is never a hidden timer, wall-clock read, read-side
  mutation, or projection-only ownership change. Pull/read projections may show
  expired-eligible candidates and evidence but cannot append records. Expiration
  records are materialized only by mutation-bearing inputs such as
  `expire-leases`, `claim` reclaiming expired work, or stale lifecycle commands,
  and are idempotent per active work/lease/attempt. Once materialized, the old
  lease cannot complete/fail/renew/release; policy visibly moves the work to
  ready, retry, or dead-letter state through records/status.

- 2026-06-15 D315: locked workQueue retry and dead-letter disposition. `fail`
  is a worker attempt outcome, not authority to choose retry or terminal queue
  state. An accepted `fail` emits `attempt-failed` plus exactly one visible
  disposition in the same mutation-bearing evaluation: `retry-scheduled` or
  `work-dead-lettered`. `retry-scheduled` carries failed-attempt refs,
  `retryAtMs`/`delayMs`, retry policy refs, and reason codes, but does not create
  the next attempt; only a later accepted `claim` does. Retry/backoff reuse the
  shared `RetryPolicy`/`BackoffPolicy`/retry-status vocabulary rather than a
  queue-specific retry engine. If no durable disposition can be computed, `fail`
  is rejected with visible issue/status instead of emitting a half-transition.
  `deadLetter()` is a read-only workQueue projection and cannot republish,
  recover, claim, ack, or mutate terminal work.

- 2026-06-15 D316: locked workQueue completion evidence and terminal boundary.
  `complete` is successful completion of the queue lease/attempt, not authority
  to mutate domain state or publish execution results. An accepted `complete`
  requires the current active lease/attempt and emits `attempt-completed` plus
  `work-completed` in the same mutation-bearing evaluation. Completion evidence
  may carry small inline values only under explicit size/redaction policy; large
  or sensitive outputs use D270 artifact/ref/summary envelopes and D293
  size-capacity evidence. `work-completed` is terminal for the queue item.
  workQueue completion must not append `WorkItemEvent`s, apply domain actions,
  emit `ExecutorOutcome`, ack messageBus cursors, publish to topics, or dispatch
  follow-up workers; domain result handling is a separate projector/composition
  over `work-completed` evidence.

- 2026-06-15 D317: locked workQueue lease renewal and voluntary release.
  `renew-lease` and `release` are explicit lifecycle commands over the current
  active lease/attempt, not hidden heartbeats or worker-registry mutations.
  Accepted renewal emits `lease-renewed` and may extend only the current
  ownership window; it cannot change work identity, attempt, worker, payload,
  claim policy, retry disposition, completion evidence, or domain state, and it
  cannot resurrect expired/released/terminal work. If clock/deadline facts show
  expiration, renewal may materialize `lease-expired` under D314 and emits
  stale/expired issue/status. Accepted release emits `work-released`, ends worker
  ownership without `attempt-completed`/`attempt-failed`/retry/terminal records,
  and returns work to ready by default unless explicit release policy schedules
  it later. Capacity and availability remain derived from visible records and
  worker/capacity facts, never a private mutable worker registry.

- 2026-06-15 D318: locked workQueue scheduling and delayed eligibility.
  `schedule` records delayed eligibility for nonterminal work as visible
  `work-scheduled` material, including fixed-time `scheduleAtMs`/`runAtMs`
  intent, queue eligibility `notBeforeMs`, optional `deadlineMs`, reason,
  policy refs, and source/audit refs. This supports BullMQ-style delayed jobs,
  but no hidden timer heap or private delayed queue is authoritative. Scheduled
  work becomes claim-eligible only when explicit graph-local clock/deadline
  facts make `notBeforeMs` eligible and claim policy admits it; `available()`
  may show scheduled/soon-eligible/overdue candidates but cannot mutate state.
  Manual `work-scheduled` stays separate from D315 `retry-scheduled`; conflicts
  use visible policy-defined effective time and issues/status. `scheduleAtMs` is
  user-facing fixed-time meaning, while `notBeforeMs` is queue eligibility, so
  delay, calendar, jitter, window, or timezone normalization can be explicit
  policy translation instead of a hidden scheduler.

- 2026-06-15 D319: locked workQueue cancellation terminal boundary. `cancel`
  is a terminal queue lifecycle command for nonterminal work; accepted cancel
  emits `work-canceled` with stable work/command/clock/reason/policy/source/audit
  coordinates and optional active lease/attempt refs. If work is leased, cancel
  invalidates that lease/attempt for queue purposes, so later renew/release/
  complete/fail/lease-expire commands become stale/canceled issues. Cancel is
  not success, failure, retry, release, or dead-letter; it does not emit
  attempt outcome, retry, completion, release, or lease-expiration records. It
  does not delete history, rewind/ack messageBus cursors, publish messages,
  dispatch workers, mutate WorkItems, or pretend to abort external execution.
  Cooperative/best-effort external cancellation remains a separate graph-visible
  adapter/executor/domain flow under D275 and can be correlated back to
  `work-canceled`.

- 2026-06-15 D320: locked workQueue pull projections and page params.
  `available()`, `work(workId)`, and `deadLetter()` are pull/read-only snapshots
  with output-named pull ids such as `availablePullId`, `workSnapshotPullId`,
  and `deadLetterSnapshotPullId`. `available()` returns claim candidates only by
  default, never reserves or mutates, and list pages use explicit coordinates
  such as `limit`, `afterWorkId`/`afterAdmissionSeq`, `workerId`, policy/capacity
  refs, priority/tag filters, clock refs, and `includeIssues`. Pages return
  items, `nextAfter*`, `hasMore`, `asOfRecordSeq`/high-water, policy refs, and
  issues/status. Non-claimable scheduled/leased/terminal work appears only under
  explicit inspection filters and must be labeled non-claimable. `work(workId)`
  returns current derived state plus lifecycle refs and bounded history without
  refreshing/renewing/expiring/recovering. `deadLetter()` pages over
  `work-dead-lettered` records, not messageBus dead-letter entries. Projection
  coordinates are explicit, not opaque page tokens; later commands re-evaluate
  current state because snapshots are not reservations.

- 2026-06-15 D321: locked `WorkQueueCommand` public union shape. Commands are
  provider-neutral DATA facts: a discriminated union with shared envelope fields
  (`kind`, `commandId`, inferred-or-explicit `queueId`, optional
  `idempotencyKey`, correlation/causation refs, source/policy/actor/audit refs,
  and clock material) plus kind-specific coordinates. v0 kinds are `submit`,
  `claim`, `renew-lease`, `release`, `complete`, `fail`, `cancel`, `schedule`,
  and `expire-leases`. `submit` is admission intent but helpers still publish to
  messageBus; `claim` carries worker and selection/capacity/lease policy
  material; lease lifecycle commands carry `workId`/`leaseId`/`attempt`/
  `workerId`; `schedule` carries fixed-time and eligibility fields; and
  `expire-leases` only materializes D314 `lease-expired` records. Commands never
  carry live node/worker/executor/provider handles, callbacks, promises,
  messageBus cursors, registries, or runtime-private objects; malformed/stale/
  duplicate/terminal commands emit DataIssue/status, not protocol ERROR.

- 2026-06-15 D322: locked `WorkQueueRecord` common envelope and record-family
  fields. Records are append-only ordered DATA facts with shared envelope fields
  such as `kind`, `recordSeq`, `queueId`, optional `workId`,
  command/idempotency/correlation/causation refs, source/policy/actor/audit/
  issue refs, and graph-local time material. `recordSeq` is queue-local
  projection high-water/pagination coordinate, not messageBus seq/cursor,
  attempt, or command id. Family fields cover admission/rejection, scheduling,
  claim/lease, release/expiration, attempt completion/failure, retry,
  completion, cancel, dead-letter, dedupe/status material. Records are facts,
  never commands or projection cursor state; current maps/pages/capacity
  summaries are derived from records plus explicit policy/clock facts.
  Corrections/recovery are new records/status facts, never in-place edits or
  deletion.

- 2026-06-15 D323: locked workQueue status and `DataIssue` taxonomy. `status`
  and `issues` are explanatory DATA facts over command/admission/projection/
  maintenance outcomes; lifecycle truth remains in `WorkQueueRecord`.
  `WorkQueueStatus` uses small outcome categories such as command accepted/
  rejected, admission accepted/rejected/retryable, projection ready/partial/
  stale, maintenance applied/noop, and policy warning. Status may reference
  queue/work/command/record/source/policy/audit/clock material, but it never
  authorizes mutation, reserves work, advances messageBus cursors, creates
  leases, completes attempts, or replaces required records. workQueue extends
  shared `DataIssue` with common queue codes such as malformed command, missing
  coordinate, unknown/terminal work, stale candidate, not ready, already leased,
  stale/expired lease, attempt/worker mismatch, duplicate command,
  idempotency conflict, policy/capacity/capability rejection, clock issues,
  schedule conflict, retry/disposition issues, admission rejection, transient
  admission failure, projection stale, retention gap source, stale source
  cursor, and unauthorized. Queue validation/stale/policy/projection problems
  remain DATA-level issues/status, not protocol ERROR.

- 2026-06-15 D324: locked workQueue public factory and TS/Rust implementation
  target. `workQueue` is an independent application-infrastructure surface
  layered above messageBus and below orchestration/patterns/solutions. TS uses
  `@graphrefly/ts/work-queue`; Rust uses a corresponding self-contained
  `work_queue` module. The public shape is a free graph-authoring helper such
  as `workQueue<T>(graph, options)` returning `commands`, `records`, `status`,
  `issues`, helper methods (`submit`, `claim`, `renewLease`, `release`,
  `complete`, `fail`, `cancel`, `schedule`, `expireLeases`), and pull
  projections (`available()`, `work(workId)`, `deadLetter()`). It is not a
  `Graph` method, runtime object, reducer owner, worker registry, scheduler, or
  compatibility facade. Helpers only publish graph-visible command facts or
  messageBus publish facts; `submit` remains messageBus-backed and accepted
  work appears only after D307 admission records. workQueue may reuse shared
  retry/backoff/token-bucket/capacity/rate-limit/circuit-breaker/deadline/
  artifact/audit policy vocabulary through explicit options/facts, but it must
  not depend on orchestration-owned WorkItem/effectRun/AgentRequest/
  ExecutorOutcome/ProcessBundle registries. Implementation order: messageBus
  PULL/subscription/cursor first, workQueue facts/reducer/projections second,
  orchestration/WorkItem recipes over workQueue third.

- 2026-06-15 D325: locked messageBus-to-workQueue implementation handoff and
  dependency-order gate. Stage 1 implements messageBus first: retire
  `dynamicHub` public surface with no alias/facade, reshape messageBus to
  D279/D282/D284/D285/D276, use explicit `PULL({pullId, params?})` instead of
  overloaded `RESUME`, keep catalog/deadLetter/topic/subscription views
  on-demand, and move subscription cursors only through explicit ack/seek/close
  command facts. Stage 2 implements independent TS `@graphrefly/ts/work-queue`
  and Rust `work_queue` over messageBus subscription admission, covering
  D299-D323 command/record/status/issue facts, durable admission/ack boundary,
  identity/dedupe, claim/lease lifecycle, retry/dead-letter, completion,
  cancel, scheduling, projections, records, and status/issues. Stage 3 adds
  orchestration/WorkItem/effectRun recipes over workQueue, with no workQueue
  dependency on WorkItem/effectRun/AgentRequest/ExecutorOutcome/ProcessBundle
  registries. TS/Rust acceptance is behavioral: dynamicHub absent, messageBus
  PULL/cursor/projection behavior correct, workQueue lifecycle/projections
  correct, and cross-runtime checks use conformance scenarios rather than
  symbol-set parity.

- 2026-06-15 D332: locked workQueue admission ack wiring. Durable admission
  outcome records come first; a graph-visible `admissionAckCommands` node
  derives messageBus `ack` command facts from accepted or deterministic
  rejected admission records and attaches to the bound messageBus command stream
  through package-internal command-source/sink wiring. Acyclic sources may attach
  as internal command sources; the workQueue admission ack path uses a
  boundary-deferred command sink when direct composition would feed back into the
  same messageBus command stream. `submit` only publishes to the bound topic and
  never acks, appends records, or moves cursors. messageBus keeps the D279 public
  surface; no queue-aware public ack/admit API is added.

---

## L0 — Identity

| ID | Lock |
|---|---|
| L0.1 | **GraphReFly is a reactive universal reduction layer.** Problem class: high fan-in/out → information reduction → push. Current focus segments: agentic memory + agent harness, but substrate is **NOT** LLM-limited. Performance (DX + production) is a **first-class constraint** — never traded away for LLM-only use cases. |
| L0.2 | Coverage stance = "**not just**" (not "is not"): not just workflow engine / stream processor / message bus / RPC framework / reactive UI runtime / LLM SDK / ETL / vector DB. May serve a subset of each role as a narrow-waist substrate; does not replace their full feature set. Segment-specific frameworks can be built *on top of* GraphReFly. |
| L0.3 | Mental anchor = **graph-first**. Topology is the shared cognition anchor for humans + LLMs. `describe()` is a **first-class output**, not a debug aid. → L4 API must expose graph shape as the primary surface (not hidden in closures). |
| L0.4 | Moats (one line each, no marketing): vs **LangGraph** = auto-push + smaller shared-state unit (not supervisor grabbing global state); vs **Temporal/Restate** = smaller, more agile, LLM-creatable + human-explainable, not a black box; vs **Mem0/LangMem** = provenance + forgetting mechanisms (not just retrieve top-k); vs **SolidJS/Vue signals** = universal glue, sync/async/asyncIter all taken over; vs **Kafka Streams/Flink** = reactive local processing + tiered information, not just record+push; vs **Excel** = push + minimal lib size, fits where Excel can't go (telemetry / async / connectors). |
| L0.5 | **No pre-1.0 wedge.** Horizontal narrow-waist story (OVERTURNS R11 memory+harness wedge). Pre-1.0 must cover the minimal credible path across multiple segments. → priority cannot "cut a segment via the wedge"; must find cross-cutting features serving ≥2 segments. |
| L0.6 | Success (3yr): **(b) primary + (c) aspirational**. (b) = direct developer tool, Astro/Next.js-grade DX — this is the pre-1.0 deliverable. (c) = LSP/MCP-style protocol with multiple independent impls — **aspirational only, NOT a pre-1.0 deliverable**. The L2 protocol spec exists for OUR OWN discipline (anti-drift, anti-ad-hoc), not to invite reimplementation. |
| L0.7 sacred | 4 non-negotiables: (1) topology declarative/serializable/inspectable; (2) wave protocol is a public spec; (3) wave protocol implementation is **sync**; (4) **all fn go through dispatcher / FactoryRegistry**. |

### Forced constraints (L0 → lower layers)

| ID | Constraint | Lands |
|---|---|---|
| F-PERF | Every abstraction layer carries a nanosecond-level budget estimate; violators don't lock | L2/L3/L4/L5 bench |
| F-PROTO-SPEC | Wave protocol has public spec doc + TLA+ + property tests; no "implementation defines behavior" | L2 |
| F-SYNC-CORE | `dispatcher.invoke` is always sync void (R9); async/remote via callback; LocalSync pool mandatory | L3 |
| F-DISPATCH-ALL | No "inline fn bypasses dispatcher"; `node((ctx)=>…)` also goes through LocalSync pool (R8) | L3/L4 |
| F-GRAPH-FIRST-API | User's first line constructs graph topology, not factory registration nor auto-tracked plain fn | L4 |
| F-NO-WEDGE-CUT | Pre-1.0 may not cut cross-cutting features citing a wedge; every primitive serves ≥2 segments | L4/L6 |
| F-NO-IMPL-DEFINED | No "implementation defines what happens"; either spec-locked or listed in spec's "intentionally implementation-defined" | L2 |
| F-NO-LLM-ONLY | Any primitive meaningful only to LLM workflows is cut or redesigned universal | L4 |

---

## L1 — Vocabulary

| ID | Lock |
|---|---|
| L1.1 | L4 verb **closed set = 8**: `node` · `graph` · `batch` · `state` (core) + `producer` · `derived` · `effect` · `mount` (sugar). `state` added at L4-Q1. Operators are NOT verbs (L1.5). |
| L1.2 | Naming anchor = engineering: `node / derived / graph / batch`. TS camelCase / Rust snake_case / Py snake_case / spec PascalCase types + ALL_CAPS protocol words. |
| L1.3 | **Node ↔ Graph responsibility split.** Node = thinnest (holds fn handle + deps + wave state machine; **zero inspection cruft**). Graph = all convenience + inspection (register/name/find/describe/observe/explain/profile/snapshot/mount/batch/operators). `g.*` sugars desugar to `dispatcher.register` + Node + auto-register into graph inspection index. Bare `node()` works at substrate level but loses inspection/naming/find/describe. |
| L1.4 | Graph is optional convenience, not mandatory container. Multi-graph natural. |
| L1.5 | Operators (map/filter/scan/merge/switchMap/debounce/throttle/distinctUntilChanged/withLatestFrom/bufferTime/take/reduce/tap) are **`node` sugar (not necessarily `derived` sugar)**; spec does NOT record operator semantics; `describe()` shows their real factory name (not a pile of "derived"). |
| L1.6 | `dispatcher` and `handle` are L4 first-class concepts (nameable/referenceable/inspectable) — but **value types**, not verbs. |
| L1.7 | Catalog dissolved: `dispatcher.register(fn, {tags, runtime, …})` + `d.list({tag})` reactive filter view. No `catalog` keyword. |
| L1.8 | fn body uses `ctx` (substrate level; sugar level differs, see L4-Q2). |
| L1.9 | **`node(deps, h, opts?)` — deps always first argument** (graph mental model: think deps first, then relation). `name` in opts + auto-name from factory-tag + sequence when omitted. |
| L1.10 | Sugar = **thin** over node. Behavioral diffs via node options + fn-body behavior, not distinct types. Spec only covers `Node` + wave protocol; 4 extensions are L4 syntactic sugar. |
| L1.11 | `ctx.up(msgs)` / `ctx.down(msgs)`; **one `msgs` array = one Wave**; msgs may mix tiers (`[["DATA",v],["COMPLETE"]]` legal). ERROR/COMPLETE are tiers not methods. Old `actions.emit / node.up / node.down / forward / backward` all dropped from fn surface. |
| L1.12 | up/down is the unified substrate-boundary naming (L4 ctx, L3 node↔handle/dispatcher↔fn, L2 spec all use up/down). No "internal up/down, external forward/backward" translation layer. |
| L1.12.A | **Handle = pure data `(pool_id, handle_id)`, NO method.** node ≠ handle. node has up/down methods (external-world boundary); handle is a dispatcher table index → serializable/snapshottable/wire-transferable. |
| L1.13 | proceed/rollback absorbed into message tiers: proceed=`[["DATA",v]]`, rollback=`[["ERROR",e]]`, invalidate=`[["INVALIDATE"]]`, terminal-success=`[["DATA",v],["COMPLETE"]]`. Not separate API methods. |

---

## L2 — Protocol

| ID | Lock |
|---|---|
| L2.A | **7 tiers / 11 closed message types** (D34/D269): 0 START; 1 PAUSE/RESUME/PULL; 2 DIRTY; 3 DATA/RESOLVED; 4 INVALIDATE; 5 COMPLETE/ERROR; 6 TEARDOWN. Adding a tier or message type is constitutional. |
| L2.B | Wave boundary: outside batch = one `ctx.down(msgs)` call; inside batch = accumulate to commit. |
| L2.C | PAUSE/RESUME = `[["PAUSE", lock_id]]` / `[["RESUME", lock_id]]`; **lockset/refcount** (all locks must RESUME to truly resume); lock_id caller-generated; same-id repeat PAUSE idempotent; RESUME unknown id = no-op. |
| L2.D / D' | In-process message = **tuple** (debug-friendly, NOT for serialization size). Wire = **protobuf** (when compact needed). The two representations are **decoupled**; conversion at wire-bridge boundary. |
| L2.E | batch = **declarative default** (success→commit / throw→rollback) + `bctx.rollback()` explicit escape hatch; **commit always implicit** (eliminates "forgot to commit" class). 3-lang aligned: TS callback / Py `with batch():` / Rust `Drop`. |
| L2.F | cross-runtime = **per-runtime local dispatcher + wire bridge**; DIRTY crosses wire at same priority as DATA (R12); mesh/service-discovery is the USER's infra concern (bring your own zookeeper/consul). |
| L2.G | push-on-subscribe is part of the protocol. |
| L2.H | Formalization depth = **γ** (markdown spec + TLA+ model + cross-impl property tests). |
| L2-Q8 | diamond/fan-in coalesce: spec writes only **observable behavior** ("D recomputes exactly once after all changed deps settle in same wave"); mechanism (dirtyMask) is impl freedom; TLA+ models the mechanism. |
| L2-Q9 | **SUPERSEDED by D49.** Every value occurrence remains DATA; RESOLVED means undirty-only. Dedup is opt-in at the operator layer; the substrate has no equals substitution or `NodeOptions.equals`. |
| L2-Q10 | SENTINEL = protocol concept ("absence-of-DATA" must be decidable); concrete sentinel value is **per-language representation** (TS `undefined` / Rust `Option::None` / Py sentinel), same semantics. |
| L2-Q11 | terminal-is-forever default; `resubscribable: true` opt-in. |
| L2-Q12 | SENTINEL state push-on-subscribe pushes only `[START]`; dirty state pushes `[START, DIRTY]`. |
| L2-Q13 | `messageTier` classification = **compile-time const table**, not runtime config. |
| L2-Q14 | message type attributes (tier/wireCrossing/metaPassthrough) = compile-time const table; **custom message type extension CUT** (L2.A closed set; adding a tier = spec change, rare/constitutional). |
| L2-Q15 | `onMessage`/`onSubscribe` = **substrate-fixed protocol behavior, NOT replaceable**. Observe via inspector (read-only); inject logic by adding a node; new tier via spec change. (Cuts user-defined protocol stacks — F-NO-IMPL-DEFINED.) |

---

## L3 — Substrate / Kernel

| ID | Lock |
|---|---|
| L3-Q1 | pool 1.0 essentials = **LocalSync + LocalAsync**; dispatcher structure keeps a **pluggable pool trait** (WorkerPool/RemotePool added with L2.F wire bridge maturity). |
| L3-Q2 | dispatcher = explicit first-class; pool attached to dispatcher; graph bound to a dispatcher (default = process-global). |
| L3-Q3 | Node self-contains wave state machine (handle_ref · deps · dep_records · dirty_mask · pending_count · cache · status · subscribers · _inside_run_wave · pause_lockset). "Thin" = no inspection cruft, NOT no wave state. |
| **L3.C** | **graph = concurrency domain = single thread** (D22), not the bound of causal influence. Causal influence may cross graphs through the async wire bridge as delayed consistency. Compute parallelism uses pool callbacks; true parallelism uses multi-graph + wire bridge. Rust drops the old actor core; Py drops per-subgraph locking. Rewire is intra-graph only. Consequence 1 (accepted): disjoint waves in one graph do not parallelize. Consequence 2 (accepted): `setDeps/addDep/removeDep` has no inter-graph form. |
| L3-Q5 | ctx lifecycle per-pool: LocalSync uses node-stable ctx (reset fields, zero alloc); async pools use per-invocation ctx (survives await/boundary). |
| L3-Q6 | `ctx.state` = per-node private cross-wave state (implicit OK — node-private, not shared). Shared memory = explicit node + dep (graph-first). Operators' state/cleanup hide in their graph-layer impl. |
| L3-Q7 | **parity = behavioral conformance (replaces structural `Impl`)** + property mirror. Operators/sugar/inspection are L4 per-language, never in parity. New substrate behavior is spec-driven. **`cross-track-ledger.md` retires** ("Impl widening" concept disappears). Parity surface shrinks to: wave protocol behavior + dispatcher contract + handle format. |
| L3-Q8 | snapshot = topology + cache + factory-name refs; restore re-resolves by name via dispatcher registry; incremental via DS-14 changeset; anonymous inline fn (no name) marked `local-only` (can't restore cross-process — honestly labeled). |
| L3-Q9 | clock: monotonic = **graph-local counter** (folded into graph; in-domain wave ordering); wall = system call; **no global clock singleton**. (Rewrites CLAUDE.md "Time utility rule".) |
| L3-Q10 | Only global singleton = default dispatcher (overridable by explicit dispatcher); all other defaults = graph/dispatcher opts. |
| L3-Q11 | All operational config (limits/policy/inspector/versioning/codec/hashFn) = graph/dispatcher opts with defaults; **no global config singleton; freeze mechanism gone**. |

---

## L4 — User API

| ID | Lock |
|---|---|
| L4-Q1 | `state` = 8th verb; `state.set(v)` = `node.down([["DATA",v]])` sugar (root emits DATA downstream); node has external up/down methods. |
| L4-Q2 | **sugar→ctx-fn conversion strictly in graph layer; dispatcher/node only accept `(ctx)=>void`.** All convenience fn forms (return-value, spread values, value-level operator) wrap to ctx-fn at register time. → fuels L3-Q7 (per-language sugar abstracted away before register, never in parity). Levels: `node`/`producer` = ctx-level; `derived`/`effect`/operator = value-level (graph-layer wrapped). |
| L4-Q3 | operator fn = value-level (does not touch protocol); `node/derived/producer/effect` boundary: derived/effect value-level, node/producer ctx-level. |
| L4-Q4 | `graph(opts?)` default global dispatcher, `{dispatcher, name}` optional; `g.mount(subgraph, {at})` (mount has no deps, exempt from deps-first). |
| L4-Q5 | cleanup = `ctx.onDeactivation(fn)` (external resource release) + `ctx.onInvalidate(fn)` (INVALIDATE flush). **2 hooks** (cut onRerun [0 real callsites] + onResubscribableReset [1 callsite → absorbed by ctx.state]). return freed for sugar mapping. |
| L4-Q6 | `ctx.state` default **fresh-lifecycle wipe**; `ctx.state.persist(boolean?)` to keep across lifecycle. (restore ≠ fresh-lifecycle — see Flag 1.) |
| L4-Q7 | **SUPERSEDED by D48** — all operators ship in the main `@graphrefly/ts` package as free-standing tree-shakable factories (`sideEffects:false`); no `@graphrefly/<lang>-operators` subpackage (ESM tree-shaking obviates the split). *Original lock:* operator ship tiered: core set in main pkg; time-based + higher-order in `@graphrefly/<lang>-operators` subpackage. |
| L4-Q8 | inspection = **describe (incl. explain mode) + observe + profile** (3 first-class); renderers (pretty/mermaid/d2) are pure functions over describe, not methods. |
| L4-Q9 | dispatcher/handle power-user API: `d.register(fn,{tags,runtime,pool})→Handle`; `d.list({tag})` = catalog; `g.node(deps,h)`; `d.registerPool(kind,adapter)`. |
| L4-Q10 | error: fn `throw` → graph-layer catch → `[["ERROR",e]]` down (node/producer ctx-level write ERROR directly; value-level throw caught by graph layer). cancellation: default no-cancel; `{switch:true}` opt-in switchMap semantics + AbortSignal via ctx. |
| L4-Q11 | error = `unknown` (`Node<T>` single generic; no `Node<T,E>` — type-combo explosion impractical, cross-lang `Box<dyn Error>`/`Exception` are top types). |
| L4-Q12 | `Node<T>` single generic; `ctx.state` S=unknown default; deep type inference is per-language impl detail. |
| L4-Q13 | TS generics / Rust trait-based (`Node`/`Dispatcher`/`Pool` traits; handle = `(PoolId,HandleId)` newtype) / Py `Protocol` typing + **no `async def` in public API**. |

### ctx final shape

```ts
type Wave = Message[]
type Ctx<TDeps> = {
  up(msgs: Wave, towardDep?: number): void                // upstream control/demand; START is not up-going
  upNext(msgs: Wave, towardDep?: number): void            // committed-boundary deferred upstream control/demand
  down(msgs: Wave): void                                 // downstream emit (DATA/ERROR/COMPLETE/...)
  waveData: readonly (readonly (readonly unknown[])[])[] // sole raw dep-value input (D77)
  terminal: readonly unknown[]                          // separate COMPLETE/ERROR metadata
  state: { get(): S|undefined; set(v: S): void; persist(on?: boolean): void }  // per-node private
  pull?: PullDemand                                      // holder-visible PULL context
  rewireNext: RewireNext                                 // committed-boundary deferred self-rewire
  track?(depIndex: number): unknown                      // dynamicNode-only derived read
  onDeactivation(fn: () => void): void                   // external resource release
  onInvalidate(fn: () => void): void                     // INVALIDATE flush
  environment(): EnvironmentDrivers                      // graph-owned source/adapter boundary
}
```

### Strawman hello world

```ts
import { graph } from "@graphrefly/ts"
const g = graph()                                        // default global dispatcher

const count = g.state(0)                                 // root mutable; count.set(5) = node.down sugar
const doubled = g.derived([count], (n) => n * 2)         // value-level, return → DATA
g.effect([doubled], (n) => console.log(n))               // value-level sink, return cleanup fn → onDeactivation
const evens = g.filter([count], (n) => n % 2 === 0)      // operator = node sugar, value-level fn

g.describe(); g.observe("doubled")                       // inspection on graph
count.set(5)
```

---

## L5 — Engineering

| ID | Lock |
|---|---|
| L5-Q1 | bench suite = **informational** (NOT CI gate). F-PERF is a design discipline; bench validates, does not hard-gate. |
| L5-Q2 | parity = **language-agnostic scenario spec + per-runtime adapter** + property-test mirror (fast-check↔proptest↔hypothesis). New scenario/property added to conformance suite, each runtime runs green. No symbol-set coordination. |
| L5-Q3 | substrate 1.0 includes **streaming describe/observe** (so viz can be built); viz UI itself is a dev-tool, may be post-1.0. (founding vision: live topology + per-node cache values.) |

---

## L6 — Distribution

| ID | Lock |
|---|---|
| L6-Q1 | **per-language independent complete packages** (`@graphrefly/ts` · `@graphrefly/rust` · `@graphrefly/py`, each = substrate + sugar + operators) + coarse-grained wire bridge. NO cross-language peer-deps. Drops the retired old-main presentation/substrate N-API split and its actor/fine-grained-bridge machinery. Cross-language = wire bridge, not an in-process substrate swap. |
| L6-Q2 | naming: keep `@graphrefly/` namespace and brand "GraphReFly"; operators ship as free-standing tree-shakable factories in each language package (D48), not a separate operator package. |
| L6-Q3 | Design lock: wire = protobuf schema-codegen from one canonical `.proto`; in-process tuple ↔ protobuf conversion occurs at the wire-bridge boundary. **B2 remains open:** current runtime helpers are behavior/vector-aligned handwritten validators/encoders, so the schema-codegen single-source promise is not yet complete. |
| L6-Q4 | adoption path: `npm i @graphrefly/ts` → `graph()` → 10-line hello world → operators → producer/connector → wire-bridge dispatch heavy node to Rust runtime. Zero-config default global dispatcher + LocalSync pool. |

---

## Flag resolutions (found during the roll-up, pre-design-review)

| Flag | Resolution |
|---|---|
| **1 🔴 restore vs fresh-lifecycle wipe** | restore ≠ fresh lifecycle. snapshot serializes ALL ctx.state (persist-flag irrelevant to snapshot); restore restores ALL (state-preserving, "restored" status not "fresh"); wipe only on fresh-lifecycle transition. **Must be written into spec.** CLOSE-with-rule. |
| **2 F-NO-WEDGE-CUT verify** | All 8 verbs serve ≥2 segments (node/graph/batch/derived=all; state=UI/harness/memory; producer=stream/DE/UI; effect=UI/harness/DE; mount=harness/memory/multi-agent). CLOSED. |
| **3 effect maps onDeactivation only** | Accepted limit, doc it. effect = React-useEffect form (return cleanup = deactivation only); INVALIDATE cleanup → upgrade to node/producer. CLOSED. |
| **4 PAUSE/RESUME/PULL via ctx.up** | ctx.up carries the R-ctx-up control/demand set; PAUSE/RESUME update the pause lockset and PULL routes demand by pullId. START is handshake-only and not up-going. CLOSED. |
| **5 equals custom passing (operator value-level)** | **SUPERSEDED by D49.** The substrate has no equals option; dedup is explicit operator-layer composition such as `distinctUntilChanged`. CLOSED. |

## config singleton dissolution (17 items)

`GraphReFlyConfig` singleton + freeze-on-first-read mechanism **fully dissolved** into 4 destinations:
- **A. compile-time const** — message type attrs (tier/wireCrossing/metaPassthrough), tier lookups; custom message type extension CUT.
- **B. substrate-fixed (unreplaceable)** — onMessage (dispatch), onSubscribe (push-on-subscribe handshake).
- **C. graph/dispatcher/constructor opts** — codec; node runtime versioning default/policy and hashFn via graph/constructor opts per D109 (V0 default, V1 cid/prev, V2/V3 still deferred); inspection/runtime policies explicitly owned by current graph/dispatcher APIs. D37 uses precise in-wave re-entry detection (no `maxFnRerunDepth`), and D49 removes substrate equals policy.
- **D. gone** — `_frozen` + freeze mechanism; isolated `new GraphReFlyConfig` for test (test isolation = `new graph()`).

Trade-off accepted: cuts user-defined protocol stacks (onMessage/onSubscribe/registerMessageType custom). To observe → inspector (read-only); to inject logic → add a node; new tier → spec change.

---

## Delta map vs existing TS/Rust codebases (for post-design-review implementation)

| Area | Today | Clean-slate |
|---|---|---|
| Rust concurrency | retired old-main per-Core actor thread + sync channel | `!Send` single-thread core + multi-instance + wire bridge (drops 12× actor.run overhead + the old libuv deadlock class) |
| Py concurrency | per-subgraph RLock + per-node cache_lock | single-thread core + multi-instance |
| Concurrency unit | subgraph | **graph** (= single-thread concurrency domain; causal influence may cross it) |
| Parity | structural `Impl` interface (symbol set) + cross-track-ledger + per-symbol D-number | **behavioral conformance suite** + property mirror; cross-track-ledger retires |
| Packaging | retired old-main pure-ts substrate + Rust/N-API native + presentation package with substrate peer-deps | per-language independent complete packages + coarse wire bridge |
| TS↔Rust | retired old-main TS presentation on a fine-grained Rust/N-API substrate (never functional) | each language self-contained; cross-language = coarse wire bridge (dispatch heavy node) |
| fn signature | `(data, actions, ctx) => NodeFnCleanup\|void` | `(ctx) => void` (ctx = up/down/waveData/terminal/state); sugar return mapped in graph layer |
| cleanup | `return NodeFnCleanup` (4 hooks: onRerun/onDeactivation/onInvalidate/onResubscribableReset) | `ctx.onDeactivation` + `ctx.onInvalidate` (2 hooks) |
| config | `GraphReFlyConfig` singleton + freeze-on-first-read | dissolved (const + substrate-fixed + graph/dispatcher opts) |
| clock | global `clock.ts` singleton (monotonicNs/wallClockNs) | graph-local monotonic + system wall-call; no global singleton |
| messageTier | runtime registry (registerMessageType, custom types) | compile-time const table; custom types cut |
| onMessage/onSubscribe | replaceable singleton hooks | substrate-fixed, unreplaceable |
| handle | napi tsfn handle (Rust-side) | first-class pure-data `(pool_id, handle_id)` + dispatcher table |
| naming exploration | — | forward/backward considered then reverted to ctx.up/ctx.down |

---

## Design-review results (2026-05-27, Q5–Q9 lens) — ALL DR RESOLVED

design-review examined 5 load-bearing decisions (L3.C / L3-Q7+L6-Q1 / L1.1+L4-Q2-Q3 / L2.A+L1.11 / config dissolution). The foundation was judged sound; all 6 residuals settled (user: "go with the recommendations"):

| ID | Decision (LOCKED) |
|---|---|
| **DR-1** | §5.11 **amend** (do NOT wrap ctx with emit/error methods): ctx-level (`node`/`producer`) is a **protocol-facing power surface that intentionally exposes tier**; value-level (`derived`/`effect`/operator) is the §5.11-compliant primary. Rationale: the one-wave-many-tier atomicity of `ctx.down([["DATA",v],["COMPLETE"]])` (terminal-with-final-value) cannot be expressed by emit/error methods. §5.11 is amended to "protocol internals never appear in the **value-level primary** API; ctx-level is an explicit power surface". |
| **DR-2** | parity = **A+C** (behavioral conformance + a lightweight protocol IDL). L6-Q3's single `.proto` **doubles as** the wire format + the protocol-contract IDL; each language codegens the interface skeleton (a light structural guarantee, single-source not cross-diff) + behavioral conformance verifies behavior. Buys back "interface shape consistency" at zero extra cost. |
| **DR-3** | async-result-arriving-at-paused-node = **enters the pause buffer + replays on RESUME** (consistent with how PAUSE buffers DATA; lock_id scope = the node-level pause_lockset). |
| **DR-4** | graph responsibility overload (causal+concurrency+inspection+dispatcher, 4-in-1) = **do NOT introduce a separate `domain` concept yet (narrow-waist first); record the escape hatch**: if an inspection-boundary vs concurrency-boundary conflict genuinely arises, introduce `domain` (one domain holds multiple graphs; same-domain cross-graph is still single-thread but can be explicitly grouped for parallelism). |
| **DR-5** | conformance hard scenarios + the spec-amendment list (below), which must be filled in before implementation. |
| **DR-6** | dispatcher opts bag **grouped structure** `{ limits, observability, policy }`, finalized at implementation time. |

### spec-amendment list (clean-slate deviations from the existing spec — all intentional, must be explicitly amended — F-NO-IMPL-DEFINED)

- §5.10 → clock graph-local (deviates from the central `clock.ts`)
- §5.11 → ctx-level intentionally exposes tier (DR-1)
- §6.1 → Py drops per-subgraph locks
- §7.1 → node runtime versioning moves to graph/constructor opts; no global config singleton (config dissolution, D109)
- §new → ctx.up is **control-tier only** (DIRTY/PAUSE/RESUME/INVALIDATE/TEARDOWN); DATA/RESOLVED/COMPLETE/ERROR are down-only
- §new → restore ≠ fresh-lifecycle wipe (Flag 1)
- §new → async-result-at-paused-node (DR-3)

### conformance suite must-include hard scenarios (otherwise behavioral parity is a blank check)

cross-graph diamond (L2.F mixed-locality survival proof) · async-result-at-paused-node (DR-3) · INVALIDATE×ctx.state×onInvalidate · mixed sync/async diamond (PoC exists) · PAUSE lockset multi-source.

**Foundation verdict: sound.** L3.C / L3-Q7 / config dissolution / L6-Q1 all shed real historical baggage (actor model / D080-D206 / config-freeze timing). Cleared to enter the clean-slate implementation sequence.

Next step: design the clean-slate documentation system (see the session continuation below) → then `/dev-dispatch` the clean-slate implementation.

---

## Implementation Log

- 2026-06-10 D161 locked the unified reactive collection storage/restore API
  layering for B87. The durable path is four explicit layers: passive
  load/fold helpers read storage frames and return `CollectionRestoreState` or
  an explicit empty state; synchronous `restoreReactive*` helpers seed
  collection backends and may optionally register graph/name nodes;
  graph-bound `persistReactiveCollection` sidecars observe existing
  delta/snapshot facts and expose ready/status/error/`persistence.cursor` DATA
  facts plus flush/dispose controls; `openPersistentReactive*` wrappers compose
  those layers for auto load/save ergonomics. Snapshot storage is the required
  durable baseline, change logs are optional, snapshot cadence is adapter
  policy, frames are strict JSON v1 by default, corrupt data fails honestly,
  v1 assumes one writer per storage prefix, and storage still never owns graph
  restore, hydration, WAL replay-as-restore, or hidden graph mutation.
- 2026-06-09 D160 locked reactive data-structure persistence/checkpoint
  contract without a spec-amend. Reactive collection backends remain the
  single live materialized owner; full collection contents must not be
  mirrored into `ctx.state`, which is limited to runtime bookkeeping such as
  cursors/dedupe/progress/policy state. Graph checkpoint may capture
  collection backend state only through an explicit collection-owned
  checkpoint contributor/factory-owned backend-state hook that serializes at
  checkpoint time and seeds the backend at restore time; snapshot node cache is
  not authoritative. Durable persistence is a separate data-structure
  adapter over collection delta/snapshot facts, typically snapshot plus
  append-log/change-log, with ready/status/error/cursor DATA facts. Storage
  remains passive and owns no graph restore/hydration/WAL replay-as-restore or
  hidden graph mutation. KG/semantic-memory surfaces must build on this
  data-structure-backed durability path rather than storing semantic state as a
  large `ctx.state` blob.
- 2026-06-09 D158 locked semantic memory layering without a spec-amend.
  Passive storage memory remains under storage only. Reusable semantic memory
  vocabulary, knowledge-graph reducers, vector/retrieval/ranking patterns, and
  retention/consolidation command vocabulary may live under patterns when they
  expose ordinary graph nodes, declared deps, and graph-visible facts. Agentic
  memory, reflection loops, prompt assembly, LLM extraction/summarization, and
  harness/data-agent integrations live under solutions or adapters. No semantic
  memory surface owns storage restore/hydration, hidden schedulers,
  GraphSpec/Actor/factoryTag runtime ownership, or protocol semantics.
- 2026-06-09 D156/D157 locked the two B85/B86 closeouts without a
  spec-amend. D156 makes TS ProcessBundle effect runners visible
  outcome-command adapter bundles: they consume `process.effectRequests` plus
  explicit outcome fact nodes, project `effect.result` / `effect.failure` /
  `effect.cancel` / `effect.timeout` command facts through a declared
  `runner.commands` node, and wire that node back into `process.command` as a
  real graph edge. They do not own process state, raw async handlers, private
  retry timers/maps, hidden subscriptions, restore/hydration, or a workflow
  engine; EnvironmentDrivers/session/wireBridge helpers may feed outcomes at
  the boundary. D157 makes `remoteResponder.responseCommands -> bridge.command`
  attachment graph-owned and releasable: responder release first detaches its
  command source by rewiring `bridge.command` to the remaining attached sources,
  then releases the responder topology group through the existing quiescent
  graph-owned release path. Detach/release must be idempotent and rollback-safe
  and must not emit protocol messages, add a second topology store, use a hidden
  EventEmitter, or publish bridge commands imperatively.
- 2026-06-09 D155 locked the narrow remoteResponder/workerDerived
  implementation shape: responders consume inbound-only wireBridge request facts
  and publish responses only through a declared `responseCommands ->
  bridge/command` graph edge; remoteCall projections ignore stale/unknown
  responses unless pending and do not buffer unknown responses for future calls.
  Worker backend customization remains a graph/dispatcher-owned capability with
  owned input plus static compute only; completion goes through a helper-owned
  opaque one-shot settlement capability installed after graph-local fencing, not
  public `job.complete`/`job.error` mutation methods or a scheduler submit API.
- 2026-06-09 TS D154/D147/D148 retained product slice: locked ProcessBundle
  cursor vocabulary as `D154` and added `@graphrefly/ts` coverage that
  `process.cursor` is the process-owned command-attempt high-water position, not
  a consumer/read pagination offset; embedded status/audit/error/event/effect
  cursors remain provenance positions. Added TS `remoteCall` and
  `remoteResponder` helpers over the existing D134/D140/D141 `wireBridge` facts:
  calls send `RemoteCallRequest` DATA payloads through bridge command facts and
  expose graph-visible responses/results/status/errors/timeouts; responders
  consume guarded inbound request envelopes, invoke first-slice sync handlers,
  and route `RemoteCallResponse` DATA facts through a declared
  `responseCommands -> bridge/command` edge. Added TS `workerDerived` as the
  D148 backend-required helper: graph-thread `prepare` reads deps and returns an
  owned input, the backend receives a cold job only after completion fencing is
  installed, and stale completions are ignored. No protocol tier/message/ctx
  semantic change, conformance scenario, remote ordinary dep, same-wave RPC,
  public WorkerPool submit API, fake worker backend, hidden process state,
  storage restore/hydration, or structural parity requirement was added. The D146
  effect-runner helper remains deferred because the exact TS result/failure/
  cancel/timeout command-fact vocabulary is not yet locked beyond the broad D146
  ownership rule.
- 2026-06-09 TS/Rust D153 mount-changed topology-event slice: added
  `mount-changed` / `MountChanged` to the existing read-only topology egress and
  forwarded mounted child graph topology events through parent
  `observeTopology` / `observe_topology` using mount-aware `::` path/deps
  prefixes. The event is emitted only from the existing graph mount mutation
  point (`path=<mount path>`, `factory=mount`, `deps=[]`), and forwarded child
  events retain their kind/factory while using the parent graph topology clock.
  Forwarders are installed only while the parent has topology observers and are
  released when the last parent topology observer unsubscribes, preserving the
  D145 zero-observer cost goal. This is still read-only inspection/lifecycle
  egress: no graph node, DATA fact, protocol spec/tier/message/ctx semantic
  change, second registry, hidden EventEmitter/process manager/GraphSpec owner,
  dynamic topic node mutation, or structural parity requirement was added.
- 2026-06-09 Rust D147 remote dispatcher helper slice: added
  `remote_call` / `remote_call_with_options` and `remote_responder` /
  `remote_responder_handler` in `graphrefly-rs` on top of the existing
  D134/D140/D141 `wire_bridge` facts. `remote_call` sends
  `RemoteCallRequest` DATA payloads through the bridge command path and exposes
  graph-visible responses/results/status/errors/timeouts nodes; local timeout is
  a local status/error fact. `remote_responder` consumes guarded inbound request
  facts, invokes first-slice sync handlers, and routes `RemoteCallResponse`
  DATA facts back through a declared `responseCommands -> bridge/command` edge.
  Responders ignore non-owned operations by default so multiple responders can
  share one bridge; full-owner responders can opt into unknown-operation DATA
  error responses. Handler errors become graph-visible DATA error responses.
  `request_id` remains logical call correlation while `seq`/`cursor`/
  `ack_for_seq` remain transport metadata, and stale responses are ignored
  unless their `request_id` is still pending. QA follow-up tightened call
  projection so Status responses are non-terminal, same-batch request/response
  ordering does not drop valid results, unknown timeouts do not consume
  unrelated pending calls, and Nack/Exhausted bridge failures clear pending
  state with request correlation where available. No protocol spec, tier/message/ctx
  semantic change, conformance behavior, remote ordinary deps, distributed
  same-wave semantics, public WorkerPool submit API, hidden EventEmitter/process
  manager/GraphSpec owner, or structural parity requirement was added.
- 2026-06-09 TS/Rust D152 explicit topology/release group surface: added
  `Graph.topologyGroup()` in `@graphrefly/ts` and
  `Graph::topology_group(_opts)` in `graphrefly-rs` as graph-owned handles over
  ordinary graph-registered child nodes. Groups can create/add graph nodes and
  release them through the existing quiescent atomic graph release path; released
  ids are retired and disappear from `find`/`describe`/`profile`/`checkpoint`
  only after commit. The first concrete consumer is the graph-bound light
  reactive view delta/snapshot pair in TS and Rust data structures. Helper-local
  group membership is only a release memo; the graph registry remains the source
  of truth. No hidden second registry/EventEmitter, public `Node.dispose`,
  protocol terminal/control synthesis, dynamicHub topology mutation, unknown-key
  auto-create/delete, tier/message/ctx semantic change, spec/conformance change,
  or structural parity requirement was added.
- 2026-06-09 TS/Rust D153 node-released topology lifecycle slice: added the
  smallest D145 follow-up on top of the existing read-only topology egress in
  both `@graphrefly/ts` and `graphrefly-rs`. Successful graph-owned quiescent
  release now emits `node-released` / `NodeReleased` topology events carrying
  final known path, factory, deps, and graph-local seq after the release commits;
  released nodes disappear from `find`/`describe`/`checkpoint` only on success.
  Failed non-quiescent/downstream-dependent release emits no topology event and
  leaves the registry/checkpoint-visible topology intact for retry. Cleanup
  failures after commit do not roll back topology: committed releases emit
  `node-released` / `NodeReleased`, then rethrow/report the cleanup fault. This is still
  inspection/lifecycle egress only: no DATA facts, protocol messages,
  COMPLETE/ERROR/TEARDOWN synthesis, second node registry, hidden EventEmitter,
  process manager, GraphSpec runtime owner, release-group registry,
  `mount-changed`, mounted-child forwarding, dynamic topic topology mutation,
  tier/message/ctx semantic change, conformance change, or structural parity
  requirement was added.
- 2026-06-08 TS/Rust D151 idempotency vocabulary closeout: implemented
  B79 as contract/vocabulary alignment only across CQRS and wireBridge. CQRS
  keeps its own command/event id membership windows and graph-visible dedupe
  facts; wireBridge keeps its own ordered seq/cursor receipt state and
  ack/nack correlation facts now use `ackForSeq` / `ack_for_seq`. The
  `idempotencyKey` / `idempotency_key` bridge field remains metadata unless a
  later reviewed surface explicitly owns key-based duplicate recognition.
  Added TS/Rust tests for unchanged CQRS bounded/unbounded semantics, ordered
  bridge duplicate/out-of-order/cursor behavior, ack/nack correlation, and
  idempotencyKey not becoming an implicit key-store. No generic public
  dedupe/idempotency reducer, dynamic Node-valued CQRS policy, key-store/replay
  engine, storage-owned restore, hidden Map/EventEmitter source of truth,
  protocol/tier/message/ctx semantics, conformance change, or structural parity
  requirement was added.
- 2026-06-08 TS/Rust D145 topology-events first slice: added read-only topology
  lifecycle egress over the existing Graph registry in both `@graphrefly/ts` and
  `graphrefly-rs`. TS exposes `Graph.observeTopology(path?)`; Rust exposes
  `Graph::observe_topology()` / `observe_topology_path()`. This slice emits only
  `node-registered` / `NodeRegistered` and `deps-changed` / `DepsChanged` events
  from graph registration and successful rewire mutation points. Event deps match
  describe-visible live deps/edges, topology observation does not activate cold
  nodes, and protocol `observe()` remains separate. No spec/conformance change,
  no new tier/message/ctx semantics, no second node registry, no hidden
  EventEmitter/process manager/GraphSpec owner/factoryTag, no release groups, and
  no dynamic topic node lifecycle were added. QA hardened the egress by making
  nested topology events FIFO, isolating observer failures from committed graph
  mutations, respecting same-delivery unsubscribe, keeping Rust zero-observer
  checks O(1), and moving deps-changed emission until added-dep subscriptions are
  restored. Parent-observer forwarding of already-mounted child graph topology
  events stays deferred with the mount-changed lifecycle slice.
- 2026-06-08 TS B63 D133 first slice: added `webSocketSession` under
  `@graphrefly/ts/adapters` as a graph-visible SessionBundle with command, inbound,
  lifecycle, status, errors, and attempts nodes. `start`/`send`/`close` convenience
  helpers publish command facts only; session state is driven by the command node and
  graph-local `EnvironmentDrivers` callbacks. QA hardened the slice by requiring the
  live `LocalWebSocketDriver.connectSession` / `WebSocketSessionHandle` capability for
  same-connection outbound sends while leaving one-shot `toWebSocket` on `send`,
  suppressing late send callbacks after close, cleaning up remote closes, avoiding
  duplicate manual starts during retry waits, and treating normal code `1000` close as
  lifecycle rather than retry/error. Reconnect uses bounded `RetryPolicy` /
  `BackoffPolicy` scheduling at the adapter boundary and surfaces attempts/status/errors.
  No protocol, tier, message, ctx.up/down, or conformance behavior changed.
- 2026-06-08 TS B63 D134 first slice: added `wireBridge` under
  `@graphrefly/ts/adapters` as a transport-free, graph-visible bridge bundle with
  command, outbound envelope, inbound envelope, events, ack, nack, status, errors,
  cursor, and attempts nodes. Envelopes carry per-session monotonic seq/cursor,
  idempotency key, attempt, and request metadata; bounded ack timeout/retry reuses
  `RetryPolicy` / `BackoffPolicy` vocabulary and emits retry/exhaustion facts through
  the bundle. `start`/`send`/`ack`/`nack`/`close` helpers publish command facts only.
  `start`/`data`/`close` are ack-tracked; `ack`/`nack` are receipt envelopes and are
  not recursively ack-tracked. Remote receipt is represented only by later inbound
  envelope facts; remote failures remain DATA envelopes (`type: "error"`) on the
  bridge error node, not local protocol ERROR. QA hardened the slice by enforcing
  session-scoped inbound envelopes, finite default ack timeout, real backoff-delayed
  retransmit, late/unknown ack/nack handling, required `ackForSeq`, malformed inbound
  metadata rejection, monotonic safe seq/cursor metadata, close pending-status reset,
  remote error status projection, malformed command-fact rejection, and guarded
  inbound terminal misuse so raw protocol ERROR/COMPLETE cannot poison later inbound
  facts. No protocol, tier, message, ctx.up/down, remote dispatcher, or conformance
  behavior changed.
- 2026-06-08 TS B63 D135 first slice: added `dynamicHub`, `fromHubTopic`, and
  `toHubTopic` under `@graphrefly/ts/messaging` as a facts-dynamic,
  topology-static hub bundle. The bundle exposes fixed command, events, status,
  errors, and optional dead-letter nodes; topic keys remain DATA facts, static
  projections/command helpers create visible graph edges only, and convenience
  create/delete/publish/subscribe/close helpers publish command DATA facts
  without mutating hidden hub state. Unknown-topic behavior is explicit and
  defaults to graph-visible errors, with drop, dead-letter, and create-as-fact
  policies covered by tests. QA hardened the slice by retaining the fixed events
  reducer through graph-owned lifecycle so command facts do not collapse before
  external subscription, persisting JSON-friendly hub runtime state across
  deactivation/checkpoint, rolling back failed `toHubTopic` wiring, and adding
  explicit `maxTopics` / `maxTopicLength` bounds whose violations become
  graph-visible hub error facts. No runtime topic node creation/removal, fake
  topology event, hidden EventEmitter island, protocol, tier, message,
  ctx.up/down, or conformance behavior changed.
- 2026-06-08 TS B63 CQRS first slice: added `cqrs`,
  `cqrsCommandHandler`, and `cqrsProjection` under `@graphrefly/ts/cqrs`
  as a graph-visible CQRS foundation. The bundle exposes command, runtime,
  events, status, errors, audit, and cursor nodes; command convenience
  dispatch publishes command DATA facts only, and handlers run inside the
  dispatched runtime node. Event append is ordered and validates the whole
  handler result before commit, so command failures do not partially commit
  events. Projection helpers derive from declared event deps and route reducer
  throws to graph-visible projection error facts instead of protocol ERROR.
  Runtime state is JSON-friendly `ctx.state.persist(true)` for checkpoint
  capture. No `CqrsGraph` subclass, guard/policy/factoryTag/domainMeta public
  semantics, hidden EventEmitter/subscribe island, process manager,
  storage-owned restore, protocol, tier, message, ctx.up/down, or conformance
  behavior changed. Rust close ledger: CQRS is Rust-relevant and not yet
  present in `graphrefly-rs`; future CSP-10 should re-derive a Rust-native
  facts-first CQRS surface without structural symbol parity.
- 2026-06-08 TS B63 optional runtime-driver closeout: added `nodeProcessDriver` under
  `@graphrefly/ts/sources/node` as a Node-only `LocalProcessDriver` for
  `EnvironmentDrivers.withProcess(...)`. It backs driver-based `fromProcess`/`runProcess` and
  graph-visible `toProcess` bundles through `child_process.spawn`, ignores stdin for the no-input
  command shape, bounds stdout/stderr aggregation with `maxBufferBytes`, keeps process async work at
  the driver boundary, and leaves the universal sources barrel browser-safe. No protocol, tier,
  message, ctx.up/down, or conformance behavior changed.
- 2026-06-08 Rust B72 optional runtime-driver closeout: added feature-gated concrete
  `TokioHttpDriver` and `TokioWebSocketDriver` alongside the existing `TokioProcessDriver`.
  The drivers implement the existing graph-owned `LocalHttpDriver`/`LocalWebSocketDriver`
  capability traits for `EnvironmentDrivers`; HTTP uses `reqwest`, WebSocket uses
  `tokio-tungstenite` for connect streams plus one-shot outbound send. Default crate features
  stay dependency-light, async remains confined to driver callbacks, and the D132
  graph-visible adapter/message-bus/resilience API shape is unchanged. No protocol, tier,
  message, ctx.up/down, or conformance behavior changed.
- 2026-06-08 Rust B72 WorkerPool v0 slice: added feature-gated `worker_derived`
  behind `tokio-worker`. The helper runs kickoff on the graph thread, prepares an
  owned `Send` input from normal ctx dep reads, runs only that input through Tokio
  `spawn_blocking`, and returns DATA/ERROR through graph-local `DeferredCtx` as a
  fresh later wave. `Ctx`, `Node`, `Rc` graph state, erased graph values, and live
  topology do not cross the worker boundary; remote workers and broad scheduler
  controls stay deferred. No protocol, tier, message, ctx.up/down, or conformance
  behavior changed.
- 2026-06-08 Rust B72 WorkerPool v0 QA: tightened `worker_derived` so completion
  captures an explicit Tokio runtime handle, missing runtime emits graph-visible
  ERROR, worker panic joins route to ERROR, superseded completions are dropped by
  an invocation fence, and dep COMPLETE no longer terminal-seals an in-flight
  worker result. Dispatcher-owned generic WorkerPool infrastructure remains a
  B1 follow-up rather than a hidden API expansion in this slice.
- 2026-06-08 Rust B72 WorkerPool backend closeout: closed the B1/D138 follow-up by
  moving owned compute submission behind a feature-gated dispatcher-owned internal
  WorkerPool backend. `worker_derived` remains the only public helper; no
  GraphOptions/DispatcherOptions scheduler shape, public worker trait, remote
  worker, EnvironmentDrivers task mixing, protocol, or conformance change was
  added. Missing backend/runtime, stale completion, panic/error, dep terminal with
  pending result, and describe-visible topology are covered by focused tests.
- 2026-06-08 Rust B72 WorkerPool backend QA: made worker submission cold until the
  graph-local waiter starts, so compute cannot begin before the `DeferredCtx`
  completion path/cancel hook exists; moved the invocation fence to the start of
  every `worker_derived` invocation, so prepare-none or immediate ERROR waves
  suppress older in-flight completions. Added regressions for local-waiter
  scheduling failure and no-submit stale completion.
- 2026-06-08 Rust B72/D140 wire bridge foundation: added `wire_bridge` under
  `graphrefly::adapters::bridge` as a transport-free, graph-visible bridge bundle with
  command, outbound, inbound, events, acks, nacks, status, errors, cursor, and attempts
  nodes. Envelopes carry session id, ordered seq/cursor, idempotency key, attempt/max
  attempts, ack-for-seq, timestamp, and request id metadata. Command helpers publish
  command DATA facts only; outbound commands create ordered envelope facts. Inbound
  receipt is guarded so raw local protocol ERROR/COMPLETE becomes a bridge error fact
  and does not terminalize the inbound/events/status nodes; remote error/close are
  inbound DATA envelope facts, not local pending/diamond terminal settlement. Optional
  ack-timeout retry uses graph-owned `LocalAsyncDriver::sleep` and emits timeout,
  retry, exhausted, attempt, status, and error facts. No protocol, tier, message,
  ctx.up/down, remote ordinary deps, public scheduler controls, transport/auth/discovery,
  remote execution bridge helper, or conformance behavior changed.
- 2026-06-08 TS/Rust D141 wire bridge payload closeout: locked and implemented tagged
  envelope payload variants for data, error/nack, status, and close facts. TS
  `WireBridgePayload<T>` and Rust `WireBridgePayload<T>` now make control payloads
  explicit instead of casting or dropping them through the data type parameter.
  Envelope construction/inbound validation reject missing or mismatched payload kinds;
  remote ERROR/COMPLETE remain bridge DATA facts, not local protocol terminals. No
  protocol, tier, message, ctx.up/down, WorkerPool, EnvironmentDrivers, transport,
  or conformance behavior changed.
- 2026-06-08 Rust B77/D135 dynamic hub foundation: added `dynamic_hub` /
  `dynamic_hub_with_options`, fixed command/events/status/errors/optional-dead-letter
  bundle nodes, static `from_hub_topic` projections, and static `to_hub_topic`
  command helpers under `graphrefly::messaging`. Topic create/delete/publish/subscribe/close
  are DATA facts with seq/cursor/timestamp metadata; unknown-topic policy is explicit
  (drop, default graph-visible error, dead-letter, create-as-fact); helper methods
  publish command DATA facts only. Describe-visible tests cover fixed nodes and real
  source->helper->command plus events->projection/status/error/dead-letter edges. No
  runtime topic node creation/removal, hidden EventEmitter/process manager/GraphSpec owner,
  protocol, tier, message, ctx.up/down, WorkerPool, EnvironmentDrivers, or conformance
  behavior changed. QA fixed a retained-reducer edge case by adding crate-internal
  graph-owned retain for the fixed events node, so helper commands published before
  external observation are still reduced into hub facts rather than collapsing to
  the command node's latest cache. QA also routes panicking metadata clocks to
  graph-visible hub DATA error facts without committing create-as-fact topic
  mutation, and fixes `to_hub_topic` command forwarding to close over the actual
  rewired dep arity.
- 2026-06-08 TS B63 CQRS QA: fixed the auto-applicable review findings without a
  new D# or spec-amend. CQRS public fact nodes and projection nodes now use
  graph-owned retain roots so command/event/status/error/audit/cursor/projection
  facts remain graph-visible even when dispatch precedes external observation.
  Projection reducers now commit and emit each successful event prefix before a
  later event in the same batch can throw. Handler/reducer catches rethrow
  GraphReFly protocol/runtime invariant errors such as R-reentrancy/R-rewire
  instead of downgrading them into CQRS application DATA errors. Valid command ids
  are consumed on first processing after parse, so retrying a failed valid command
  id becomes duplicate-command rather than rerunning the handler. The long-lived
  dedupe retention/index policy remains a future design-review/backlog question;
  this QA did not lock public retention/window semantics.
- 2026-06-08 TS/Rust D142 CQRS dedupe implementation: locked and landed static
  bounded command/event id dedupe windows with exact/unbounded default. TS
  `@graphrefly/ts/cqrs` now exposes `CqrsDedupePolicy` / `CqrsDedupeWindow`;
  bounded cursor facts expose retained/evicted id counts and evicted ids are no
  longer duplicate-recognized. Rust `graphrefly-rs` now has a Rust-native `cqrs`
  module and crate exports for `cqrs`, `cqrs_with_options`,
  `cqrs_command_handler`, `cqrs_projection`, graph-visible command/runtime/events/
  status/errors/audit/cursor/projection nodes, and matching D142 dedupe policy.
  Rust CQRS runtime state is stored as JSON `ctx.state` for checkpoint-friendly
  dedupe counters/windows. Dynamic Node-valued policies and generic dedupe
  engines remain deferred. No protocol, tier, message, ctx.up/down, terminal,
  storage-owned restore, or conformance behavior changed.
- 2026-06-08 TS/Rust CQRS QA hardening: timestamp provider failures now become
  graph-visible CQRS `clock-threw`/`ClockThrew` error/status/audit facts without
  committing events; Rust rejects empty command id/type as `MalformedCommand`
  before dedupe insertion; TS and Rust CQRS catch boundaries rethrow D22 /
  R-graph-domain violations instead of downgrading them into handler/projection
  facts. No protocol, restore, storage, tier, message, or ctx.up/down semantics
  changed.
- 2026-06-08 D149/D150 CQRS design-review closeout: locked CQRS bundle/projection
  lifecycle as retain-root release only, and locked CQRS checkpoint/export honesty.
  CQRS release/dispose may only release helper-owned graph retain roots; it must
  not delete topology, synthesize protocol terminal/control messages, clear
  caches/state/facts, cancel external subscriptions, or become a permission
  system. CQRS only promises its internal cursor/dedupe runtime state is
  graph-owned and JSON/checkpoint-friendly; arbitrary command/event/projection
  payloads remain ordinary graph values under the graph checkpoint contract.
  Durable CQRS export remains a passive fact sink/projection or future reviewed
  codec/helper, not CQRS-owned storage restore/hydration.
- 2026-06-08 D151/B79 idempotency vocabulary closeout: approved the shared
  vocabulary/contract option across CQRS dedupe and wireBridge idempotency.
  No public generic dedupe/idempotency reducer engine is added. CQRS id windows
  remain membership-based duplicate recognition; wireBridge receipt remains
  ordered seq/cursor with ack/nack correlation by `ackForSeq`; `idempotencyKey`
  is correlation/idempotency metadata unless a surface explicitly owns key-based
  recognition. Future public reducer bundles, dynamic Node-valued policies, or
  key-store/replay engines require another design review and must expose
  accepted/duplicate/error/cursor/status as ordinary graph facts.
- 2026-06-09 D152 dynamic topology node lifecycle: approved explicit
  graph-owned topology/release groups as the only path for dynamic topic/view/
  router surfaces to create or release real graph nodes. Unknown data keys,
  publish commands, rule updates, and hub facts must not silently mutate graph
  topology. Helper-local maps may memoize/look up child groups, but the existing
  graph registry remains the sole source of truth. Release is D122/D124-style:
  quiescent-only, atomic, ids retired, no protocol terminal/control synthesis.
  D135 facts-dynamic/topology-static hubs remain the default dynamic messaging
  shape; true node lifecycle is opt-in and layered on D145 topology events.
- 2026-06-09 TS B63 passive messaging vocabulary slice: rehomed the old root
  `src/utils/messaging/message.ts` data-only contract into `@graphrefly/ts/messaging`.
  The clean-slate subpath now exports `JsonSchema`, `TopicMessage`, the seven
  well-known topic constants, `STANDARD_TOPICS`, and `StandardTopic`. This is
  passive D125/D132 application-infrastructure vocabulary only: no
  `TopicGraph`/subscription/messagingHub class port, no old GraphSpec/factoryTag/
  Actor owner, no hidden EventEmitter, no topology lifecycle, no protocol or
  conformance change, and no `utils`/`base`/`compat`/`presets` barrel resurrection.
- 2026-06-09 TS B64 examples migration batch 1: migrated
  `examples/compat/{zustand,jotai,nanostores}` and
  `examples/framework/{react,vue,solid,svelte}` to consume only `@graphrefly/ts`
  and `@graphrefly/ts/adapters`. Compat examples now wrap caller-owned graph
  nodes with `zustandStore`, `jotaiAtom`, and `nanoAtom`; framework examples use
  tiny example-local React/Vue/Solid hook glue or the Svelte readable/writable
  store adapters. No package API, `@graphrefly/ts/compat/*` subpath, framework
  hook export, old Graph-owned Zustand `create`, Jotai `atom(read)`, Nanostores
  `computed`, protocol, storage restore, or dynamic topology behavior was added.
  Follow-up B64 slices can migrate spending-alerts and NestJS/order-flow against
  existing public surfaces; AI/harness/refine-loop/inbox-reducer and memory
  knowledgeGraph remain deferred/design-gated. Reactive-layout is now locked by
  D181 as a `@graphrefly/ts/solutions/reactive-layout` rehome; fromRaf remains a
  browser source, not reactive-layout ownership.
- 2026-06-09 B64/B65 direction update: pause further examples migration until
  retained functionality surfaces settle. Examples are later acceptance/cleanup,
  not drivers for new public API or old-root preservation. Root
  `@graphrefly/graphrefly` should be deprecated directly once retained surface
  migration and the known memo:Re consumer path allow it; do not invest in a
  long-lived transition shell just to preserve pre-1.0 compatibility.
- 2026-06-11 TS B65 root package retirement: removed active
  `@graphrefly/graphrefly` implementation ownership from the TS repo. The
  legacy root `src/` tree, root build/test configs, and old layer-boundary
  ratchet are gone; root `package.json` is private/deprecated and no longer
  builds, tests, exports, releases, or peers on `@graphrefly/pure-ts`. CI/docs
  gates now target `@graphrefly/ts` directly. This is not a transition shell
  and does not revive `base`/`utils`/`compat`/`presets`, Actor, guard,
  factoryTag, GraphSpec, Impl/facade, or storage-owned restore surfaces. B66
  remains blocked by live legacy consumers of `@graphrefly/pure-ts` or the
  deleted root surface in CLI, parity-tests, RN/Hermes fixture, evals,
  demos/examples/docs, and package-local pure-ts configs.
- 2026-06-09 TS B63 D158 semantic-memory passive vocabulary slice: added
  `@graphrefly/ts/patterns` vocabulary/types/validators/helpers for
  `MemoryFragment`, `MemoryQuery`, collection/retrieval vocabulary,
  admission scoring, cosine similarity, tenant sharding, and passive fragment
  validation/query filtering. This is horizontal D158 pattern support only:
  no knowledgeGraph/vector/retrieval graph bundle, retention/consolidation
  command surface, agentic-memory solution, Graph subclass/factoryTag/domainMeta
  owner, hidden keepalive/subscription/scheduler/EventEmitter, storage
  restore/hydration/WAL replay-as-restore, examples migration, protocol change,
  or conformance change was added. KG/retrieval/vector/retention/consolidation
  graph patterns and agentic-memory solutions remain design-review gated.
- 2026-06-09 Rust B84 D136 ProcessBundle first slice: added `graphrefly-rs`
  `process::ProcessBundle` as a Rust-native facts-plus-reducer bundle with
  graph-visible command, state, events, audit, effect_request, status, error,
  and cursor nodes. Reducers run inside the graph-owned runtime node; state is
  emitted as a visible fact; Rust `TState` is serde JSON-roundtripped for the
  runtime ledger so reducer state is checkpoint-friendly and not shared by
  shallow `Clone` aliasing. Convenience dispatch only publishes ordinary command
  DATA facts. `process.cursor` is D154 process-owned high-water after a command
  attempt closes, not a consumer/read cursor. No process/saga DSL, effect
  runner, hidden processManager/EventEmitter, private timers/maps, hidden
  subscriptions, storage restore/hydration, protocol change, remote ordinary
  dep, or structural TS parity was added.
  QA hardening rejects malformed persisted runtime ledger fields rather than
  normalizing them into cursor/dedupe rewind.
- 2026-06-09 Rust B84 D156 ProcessEffectRunner closeout: added
  `graphrefly-rs` `process_effect_runner` / `ProcessEffectRunnerBundle` as a
  Rust-native visible outcome-command adapter over `ProcessBundle`. The runner
  mirrors `process.effect_request` into requests, consumes explicit outcome fact
  nodes, projects `effect.result` / `effect.failure` / `effect.cancel` /
  `effect.timeout` command facts, and wires `runner.commands` into
  `process.command` through declared command-source fan-in. Release is
  idempotent and rollback-safe: it preflights helper topology quiescence,
  detaches before graph-owned release, releases the private runtime plus visible
  helper nodes, and does not replay cached commands if release is retried after
  a live-subscriber failure. Tests cover result reducer delivery, visible
  edges, malformed/contradictory outcome DATA errors/status, counters, all four
  command payloads, multiple runner fan-in, idempotent release, retry/no-replay,
  and post-release topology cleanup. No process/saga DSL, async handler runtime,
  private in-flight authority maps/timers, EnvironmentDriver/session/wireBridge
  integration, hidden subscriptions/EventEmitter/processManager, storage
  restore/hydration, protocol tier/message/ctx change, remote ordinary dep, or
  structural TS parity was added. B84 is resolved.

## Design Lock Log

- 2026-06-23 D484: locked TypeScript NestJS native provider bridge and
  timezone-aware cron semantics. Every public high-level Nest binding
  decorator must have an official GraphReFly consumer, grouped by Nest phase
  rather than one provider per decorator: boundary interceptor, guard bridge,
  exception/filter bridge, cron scheduler bridge, and lifecycle bridge. These
  providers live only in the focused NestJS adapter/native surface, read method
  binding metadata for the current class/handler, and must not scan the
  container by default, create graphs, rewrite routes, create a shadow router,
  hide an event bus, or resurrect compat/nestjs. Boundary factories define
  graph-visible envelope nodes and payload types; binding decorators own
  bindingId, host-to-payload transformers, requestId overrides, ordering, mode,
  and reply/error lowering. GraphFilter is generic filter binding metadata,
  GraphError is exception-oriented sugar, default filter handling is handle with
  observe opt-in, and HTTP business failures lower from DATA payloads such as
  `{status,body}` or `HttpDataIssue` extending shared DataIssue. Protocol ERROR
  from a reply node is graph/reply pipeline failure and lowers through
  binding-over-provider `protocolError(errorPayload, host)` transformers with a
  safe 500 fallback. GraphCron may use a GraphReFly Nest scheduler provider
  instead of `@nestjs/schedule`; fromCron/GraphCron support IANA timezone
  strings via runtime Intl support, require no Node 26 floor or bundled tz
  database, and default DST semantics are skip nonexistent wall-clock minutes
  and fire repeated wall-clock minutes at most once.
- 2026-06-23 D478: locked NestJS decorator/provider ergonomics as concrete
  bindings over existing graph boundary primitives and reply nodes, not a
  shadow router or graph factory. Route decorators such as GraphReq and
  GraphHttpReply attach bindingId at the Nest binding layer; the graph nodes
  remain ordinary inspectable graph topology. The base NestBoundaryEnvelope is
  `{bindingId,version,payload,requestId?}` so lifecycle/cron/non-request ingress
  do not fake request ids, while reply egress requires requestId to match a
  host-private pending handle. Binding registries are app/module scoped only;
  per-request state is a request context/pending handle, never a request-scoped
  binding registry or default request-scoped graph. Stable adapter diagnostic
  callbacks are not part of the public high-level design; graph-visible
  audit/status/issues are user graph composition and inspection stays through
  graph.describe/graph.observe or explicit effect/log sink nodes. Envelope v1
  means the NestBoundaryEnvelope schema only; v1 is the only accepted default
  until a later explicit version/migration decision.
- 2026-06-09 D153: closed D145-D148 follow-up API polish without a
  spec-amend. Mount/release topology lifecycle may add `node-released` and
  `mount-changed` read-only topology events plus optional quiescent
  release/topology group handles over already registered node ids; release
  commits atomically before nodes disappear from describe/find/profile/checkpoint,
  and mounted-child forwarding belongs to the mount-changed slice. Process
  orchestration proceeds bundle-first: implement D136 ProcessBundle before DSLs,
  then keep DSLs as compilers and effect runners as visible fact adapters.
  Remote dispatcher helpers proceed as `remoteCall` + `remoteResponder` over
  wireBridge facts: operation names are application facts, `requestId` is logical
  call correlation, bridge `seq`/`cursor`/`ackForSeq` remain transport metadata,
  timeout is local status/error unless explicit cancel is sent, and first-slice
  handlers are sync graph-dispatched functions. WorkerPool customization remains
  helper-first via graph/dispatcher-owned backend capabilities selected by helper
  or construction options; no public imperative submit API is added.
- 2026-06-08 D145-D148: locked the next topology/process/remote-worker
  design gates without a spec-amend. D145 keeps topology events as read-only
  graph lifecycle egress over the existing graph registry; optional
  release/topology groups are labels/handles over already registered nodes, not
  a second registry, and release remains quiescent-only. D146 makes process/saga
  DSLs authoring layers that compile to D136 ProcessBundles, while effect
  runners consume effect-request facts and publish visible result/failure facts
  without owning state, timers, or restore. D147 makes remote dispatcher helpers
  wire-bridge request/response facts with local/remote waves separated by the
  bridge boundary. D148 keeps public WorkerPool customization helper-first via
  graph/dispatcher-owned backend capabilities, not imperative submit APIs.
- 2026-06-08 D142: locked CQRS command/event id dedupe as application-infra
  policy shared by TS and Rust. Default is exact/unbounded. Static bounded
  command/event windows may be configured independently; eviction is insertion
  order, and evicted ids are no longer duplicate-recognized. Dedupe state remains
  graph-owned, JSON/checkpoint friendly, and visible through CQRS cursor/status
  facts where supported. Dynamic Node-valued policy and generic public dedupe
  engines stay deferred.
- 2026-06-08 D149: locked CQRS bundle/projection lifecycle as application-infra
  retain-root release only. TS/Rust may expose runtime-idiomatic release/Drop
  surfaces, but release does not own graph topology, protocol terminal/control
  messages, cache/state clearing, external subscriptions, process cancellation,
  or command/query permission.
- 2026-06-08 D150: locked CQRS checkpoint/export honesty. CQRS internal
  cursor/dedupe runtime state is graph-owned and JSON/checkpoint-friendly; CQRS
  public payload facts remain ordinary graph values, and durable export stays
  passive or separately reviewed.
- 2026-06-08 D151: locked idempotency/dedupe sharing as vocabulary/contract
  only, not a public generic engine. CQRS owns membership-window dedupe,
  wireBridge owns ordered seq/cursor receipt and `ackForSeq` correlation, and
  any future shared reducer/key-store must be separately reviewed with graph-
  visible facts and declared deps.
- 2026-06-09 D152: locked true dynamic topic/view/router node lifecycle behind
  explicit graph-owned topology/release groups. Unknown data keys or hub facts
  cannot create/delete nodes; child node groups are ordinary graph-registered
  topology, helper maps are non-authoritative memo indexes, and release keeps
  D122/D124 quiescent-only atomic disappearance with no protocol message synthesis.
- 2026-06-08 D141: locked wire bridge envelope payload shape as a tagged
  payload sum type/union. Data, error/nack, status, and close payloads are
  explicit bridge fact variants; ack correlation stays metadata; no `AnyValue`,
  `Ctx`, `Node`, functions, live topology, or mutable graph state crosses the bridge.
- 2026-06-08 D140: locked remote worker and cross-graph worker execution as a wire-bridge
  request/response pattern, not a Dispatcher WorkerPool backend and not an ordinary remote dep.
  Local requests and remote results are bridge facts; remote receipt starts a new graph wave, and
  any local result projection returns only as a later fresh local wave.
- 2026-06-08 D139: locked future public/custom WorkerPool scheduler API direction. The public
  graph API remains helper-first; custom scheduling is an installed dispatcher/graph-owned backend
  capability, cancellation correctness is stale-completion fencing with optional cooperative
  runtime cancellation, and remote worker execution stays on the D134 wire-bridge line.
- 2026-06-08 D138: locked WorkerPool v0 as graph-helper-first. The helper prepares
  owned worker input on the graph thread, submits only Send/static compute work to a
  dispatcher-owned WorkerPool, and returns completion through `DeferredCtx` as a later new
  wave. `Ctx`, `Node`, graph state, and original-wave pending accounting do not cross the
  worker boundary.
- 2026-06-08 D137: locked the worker/pool taxonomy. Environment task/runtime drivers stay in
  graph-owned EnvironmentDrivers and return through visible adapter/session bundles; dispatcher
  WorkerPool is the graph-internal compute lane for node functions while `dispatcher.invoke` stays
  sync void; cross-graph remote deps/functions stay on the explicit wire-bridge line.
- 2026-06-08 D133-D136: locked the next L6 application/adapter design gates without a
  spec-amend. Bidirectional transports use SessionBundle command/inbound/lifecycle/status/error
  ports; wire bridges are explicit bridge bundles with per-session ordered ack envelopes and remote
  dispatcher calls deferred as request/response facts; dynamic hubs are facts-dynamic and
  topology-static; process/saga orchestration starts from visible command/event/state/audit/effect
  facts rather than an imperative workflow engine.
- 2026-06-26 D542: locked Python C-1 bridge child adapter attachment and
  deterministic diamond harness shape. Python protobuf inbound decoded material
  and ack-timeout facts attach privately through native declared bridge sources,
  public Python remains bytes/status/issues/timeouts/release only, release uses
  child ownership with cascade and rollback, and the future full C-1 diamond
  harness uses explicit deterministic host transport pump steps over canonical
  protobuf bytes rather than hidden schedulers or in-process shortcuts.
- 2026-07-24 D648/D649, B111.1-B111.4: landed the TypeScript-first keyed
  externally authoritative rate-limit surface. D649 supersedes D648's
  unbounded live replay wording with an exact retained-completion horizon and
  orders bounded adapter intake before host quota work. The adapter exposes
  authority-request, outcome, status, error, and cursor projections while its
  composed gate uses one activation-safe correlation-fact lane, so cached-input
  activation cannot lose a synchronous outcome. Strict request identity covers
  the complete request and is representable for every accepted request;
  mismatched callbacks settle the original request fail-closed, admission and
  denial ids bind request plus outcome coordinates, ordinary
  deactivate/resubscribe preserves retained correlation, and delivery errors
  cannot be swallowed by a host callback. Governed effects depend only on
  composed admissions. The former in-memory helper is now
  localFixedWindowRateLimitBundle and explicitly non-authoritative. Focused
  D649 adversarial tests are 24/24; the full TypeScript suite is 117 files and
  1856 passing tests with one live-host test skipped by design; lint,
  raw-async, typecheck, ESM/CJS/DTS build, export smoke, diff-check, and
  dashboard consistency are green. B111 stays open for B111.5 algorithm
  semantics, remaining B111.6 algorithm/restart/multi-instance evidence, and
  B111.7 examples/release notes; CSP-12 stays impl.
- 2026-07-26 D650, B111.5 design lock: preserved the D648/D649 graph-visible
  authority boundary and locked three optional synchronous pure host-side
  reference transition families. Fixed-window-v1 uses epoch-aligned half-open
  windows; sliding-window-v1 uses an exact, canonically coalesced, strictly
  ordered successful-consumption ledger with policy-declared maxEntries capped
  at 4096; token-bucket-v1 uses integer rational refill with persisted
  remainder and no authoritative floating-point accumulation. Strict versioned
  policy/state bind exact key, policy/algorithm revision, and authority scope;
  time is one externally observed safe-integer epoch millisecond; malformed,
  stale, regressed, overflowing, or bounded-state-invalid material fails
  closed. Durable authority processing is receipt-first and atomically persists
  next state plus outcome receipt; identical replay never re-reads time or
  advances state, and revision changes never silently reset or migrate quota.
  The evaluators are not Graph nodes, admission authority, clocks, stores,
  transaction managers, registries, or effect executors. B111.5 implementation
  and gates landed later that day; D651 subsequently rehomed their public
  ownership before B111.6. B111 remains open for B111.6 evidence and B111.7
  examples/release notes; CSP-12 remains impl.
- 2026-07-26 D651, B111 focused-surface lock: superseded D650 only where it
  retained keyed rate limiting on the broad orchestration subpath. The complete
  public keyed rate-limit domain moves to one independently importable
  `@graphrefly/ts/rate-limit` application-infrastructure subpath: strict
  request/outcome/identity and admission contracts, the correlation bundle,
  all three reference-transition families, and the explicitly
  non-authoritative local fixed-window bundle. The orchestration barrel retains
  no compatibility export and the package root remains unchanged.
  `attachKeyedRateLimitAuthority`, `KeyedRateLimitAuthority`, and
  adapter-specific lifecycle/status/error/cursor contracts remain under
  adapters and preserve host-private clock, store, transaction, receipt,
  callback, cancellation, and runtime ownership. This is neither a patterns
  recipe nor a vertical solution kit and introduces no registry, persistence
  API, concrete store, Graph evaluator node, protocol/parity claim, or product
  adoption. The rehome landed later that day as a physical move with no
  compatibility re-export: package root and graph topology remained unchanged,
  adapters retained host-private authority ownership, and focused/full
  test, lint, typecheck, ESM/CJS/DTS, complete negative export-smoke, diff, and
  dashboard gates passed. B111 remains open for B111.6/B111.7 and CSP-12
  remains impl/gap=true.
- 2026-07-27 B111.6 deterministic lifecycle/authority evaluation landed
  without a new architectural lock. A test-only strict canonical serialized
  atomic-host image models D650 receipt-first replay/conflict, exact state plus
  allowed-or-denied outcome-receipt commit, explicit state-revision linkage,
  complete image coherence, and fail-closed revision/currentness. Fresh
  Graph/adapter instances and image rehydration preserve fixed-window state,
  ordered/coalesced exact sliding ledgers, and token-bucket rational remainder;
  two independent Graph/adapters sharing the controlled authority preserve
  capacity under both transaction orders for all three algorithms. Existing
  describe/observe/profile expose only declared Graph topology, and a custom
  KeyedRateLimitAuthority works without reference evaluators or a registry.
  This evidence deliberately does not certify a real store, fsync,
  crash-mid-commit recovery, parallel-process isolation, or protected-effect
  exactly-once. B111 remains open only for B111.7 examples/release notes;
  CSP-12 remains impl/gap=true.
- 2026-07-27 B111.7 package-local documentation and release closeout landed
  without a new architectural lock. The TypeScript package README, structured
  JSDoc, 641-page generated API reference, minor Changeset, and runnable
  workspace-typechecked example document `@graphrefly/ts/rate-limit` as the
  sole focused public domain import while authority capability/attachment stay
  under adapters and package root/orchestration remain unchanged. The example
  exercises authority/request-id receipt namespaces, identical replay before
  policy/state/time/evaluation, changed-material conflict, exact policy/state
  ordering, externally supplied `observedAtMs`, atomic next-state plus outcome
  receipt modeling, externally authoritative adapter delivery, admission-only
  protected effects, all three D650 evaluators, and a custom authority without
  a reference evaluator or registry. Documentation separates durable quota
  receipts, bounded live-gate retention, and application-owned protected-effect
  receipts; the local fixed-window helper stays non-authoritative. B111.6
  remains deterministic serialized contract-model evidence rather than real
  database, fsync/crash, parallel-process isolation, or protected-effect
  exactly-once certification. Final evidence is green: example typecheck/run,
  83 focused assertions, 119 TypeScript test files with 1903 passing and one
  intentional live-host skip, lint/raw-async/typecheck, API generation check,
  ESM/CJS/DTS plus positive/negative export smoke (with an 8192 MB Node heap
  after the desktop default DTS-worker heap proved insufficient), diff-check,
  and two independent adversarial reviews. No runtime/export-map/tsup-entry/
  Graph-topology/protocol/spec/conformance/cross-language change was added.
  B111 and CSP-12 are done; CSP-12 has `gap=false`.

- 2026-07-27 B112.6.3 D655 protection execution landed in graphrefly-ts
  commit `3c2121c3`. One package-private synchronous wrapper serves
  source-ingress, tool-ingress, and model-egress over bounded canonical
  strict-JSON subjects. Policy implementations return only `allowed` or
  `blocked`; the wrapper owns material-free canonical receipt refs/digests and
  converts thrown or malformed implementations into deterministic blocked
  failure receipts without retaining the raw subject or error. Allowed
  receipts and both blocked provenance forms are byte-reconstructable.
  Blocked model candidates publish no output or tool intents and retain exactly
  one fixed-id candidate-digest evidence ref plus exactly one policy-block or
  protection-failure issue whose classification must match the canonical
  receipt. Two adversarial QA passes found and closed classification swapping,
  candidate metadata leakage, and forged allowed-receipt bypasses. Focused
  model execution is 11/11; the full TypeScript suite is 121 files with 1925
  passing and one intentional live-host skip; lint/biome/raw-async/test
  typecheck, ESM/CJS/DTS and package-export smoke, and diff checks are green.
  B112 remains open because no concrete frozen local detection policy/profile
  has yet been selected; therefore no OpenAI or other provider binding, network
  invocation, final task freeze, worktree/host runner, observation/scorecard
  persistence, public export, Graph topology, protocol/conformance,
  cross-language parity, Demo, or web surface entered this slice.

- 2026-07-27 D656 locks B112's first concrete protection profile as the
  package-private synchronous `exact-private-needle-v1`. The host supplies
  1..16 unique explicit protected needles through a private credential or
  protection capability; no ambient environment discovery occurs. Each needle
  is 16..4096 UTF-16 code units, canonical protection subjects are limited to
  262144 bytes before inspection, and exact case-sensitive substring matching
  covers every strict-JSON string value and object key. The profile has no
  normalization, regex, entropy or field-name semantics, hidden I/O, model
  call, registry, timer, retry, store, or Graph authority. It returns only
  `allowed`/`blocked` into the D655 wrapper and never persists needle or match
  material. Construction and policy-coordinate mismatch fail closed; policy
  revision changes bind algorithm/bounds and credential-capability revision.
  The receipt proves only that this known-needle profile ran, not unknown
  secret, PII, or general exfiltration detection.

- 2026-07-27 B112.6.4 implemented D656 in graphrefly-ts commit `79902a5a`.
  The package-private executor copies protected needles only from validated own
  data descriptors, rejects custom array prototypes, freezes its private copy,
  and exposes only profile plus policy/capability coordinates and the closed
  inspection method. D655 now bounds every canonical protection subject to
  262144 bytes before invoking any policy. Regression tests cover key and
  string-value matches, case sensitivity, no normalization, all three stages,
  zero/duplicate/short/long/over-count/malformed capabilities, getter and
  custom-array-method non-execution, material-free results, policy mismatch,
  and pre-inspection byte rejection. Two independent QA passes found and closed
  the custom-array method-dispatch leak and a missing test-typecheck include.
  Focused 17/17, full 122-file/1931-pass with one intentional live-host skip,
  lint/biome/raw-async/test typecheck, ESM/CJS/DTS/export smoke, private-export
  scan, and diff checks are green. B112 remains open for the first focused
  OpenAI binding and invocation, final task freeze, worktree/host runner,
  observations/scorecards, and later presentation. No other provider,
  provider registry, public export, Graph topology, protocol/conformance,
  cross-language, Demo, or web surface entered this slice.

- 2026-07-27 D657 locks B112's first provider integration as one
  package-private OpenAI Responses binding over the D652 one-turn semantic
  port. The binding is fixed to `POST https://api.openai.com/v1/responses`
  and the first smoke coordinates `gpt-5.6-sol` as an honestly
  alias-disclosed model with explicit medium reasoning, provider-reported
  usage, omitted sampling controls, strict structured output and host
  function tools, disabled parallel tool calls, and stateless
  `store/background/stream=false` plus truncation disabled. One focused
  factory receives an explicit bearer credential and constructs both the
  model-turn port and the D656 exact-private-needle executor from that same
  credential. An OpenAI-specific host transport receives canonical bounded
  request bytes and the host AbortSignal, returns at most 1048576 response
  bytes, and owns no SDK defaults, retry, fallback, timeout, queue, limiter,
  persistence, base-url discovery, or provider registry. Structured input and
  prior protected tool results use one canonical stateless user envelope;
  no native continuation or provider session is retained. Private schema
  lowering supports only the all-required closed structural subset and D653
  remains the final local semantic validator. Transient reasoning is ignored;
  a response must yield exactly one structured assistant output or function
  calls, never both. Provider and protection failures are sanitized and
  distinct, raw request/response/error/reasoning/credential material is never
  evidence or Graph DATA, and blocked candidates use D655 digest provenance.
  This approved implementation slice is mock-transport-only and makes no
  remote call. Live smoke remains separately gated by final task/worktree/host
  runner freeze, an explicit credential capability, and a remote-call budget.

- 2026-07-27 B112.6.5 implemented D657 in graphrefly-ts commit `3b8115f3`.
  The package-private focused factory constructs both the D652 model-turn port
  and D656 exact-private-needle executor from one explicit bearer capability.
  It sends one canonical stateless Responses request through an
  OpenAI-specific host-injected byte transport, protects both the nested user
  envelope and canonical outer body, and fixes the first binding to the
  alias-disclosed `gpt-5.6-sol` profile with medium reasoning, strict structured
  output and function schemas, disabled parallel tool calls, and
  provider-reported usage. Response handling rejects duplicate JSON keys,
  malformed UTF-8/JSON, model/status mismatch, refusals, ambiguous message/tool
  results, unsupported items, oversized bytes, and schema-invalid output;
  reasoning is ignored, D653 remains the final semantic validator, D655 owns
  blocked-candidate provenance, and over-budget usage/byte evidence is
  sanitized before outcome validation. Both independent adversarial QA passes
  closed all findings. Focused regressions, full 123-file/1943-pass with one
  intentional live-host skip, lint/biome/raw-async/test typecheck,
  ESM/CJS/DTS/export smoke, private-export/source-boundary scans, and diff
  checks passed. B112 remains open for final task/commit freeze,
  worktree/protection execution, host agent/tool runner, an explicitly
  credentialed and budgeted live invocation, observations/scorecards, later
  focused providers, and presentation. No real network call, SDK dependency,
  ambient environment lookup, configurable base URL, retry/fallback/timeout,
  public export, Graph topology, protocol/conformance, cross-language, Demo,
  web, or durable store entered this slice.

- 2026-07-28 the user approved B112's final five-task identity, order, and
  smoke-task preregistration under D639. The three historical pre-fix tasks
  are: (1, first smoke) canonical managed-compute admission ref at commit
  `a396eda3249b90e32de0f4c69f5380960adf3002` / Git tree
  `665f5ea2993087a54762d2bfac987efd68872666`; (2) malformed orphan
  remoteCall isolation at commit
  `62a3c4031402c5f810c239f97c79f36bcd85fe02` / Git tree
  `fc486aa93ce7b3e22c844eaedf4ea6bdd4830ca2`; and (3) closed wave
  message directions at commit
  `22c54fa393bc1c85bbbe29e7994b886ac7e3fc2f` / Git tree
  `8fa9fe95802a23e7974fb8f3eba60dae08a16074`. The two held-out overlays
  are: (4) local fixed-window exact-boundary rollover and (5) recursive
  mounted-graph `Graph.find` lookup, both based on committed graphrefly-ts
  commit `3b8115f37c8675b8970b24ada3aa351b772e5144` / Git tree
  `74f94a624b627aeb62ff0f1ea191bc5c62b13e78`. Mutation material,
  expected patches, and hidden verifier fixtures remain operator-private.
  These Git tree object IDs are provenance anchors, not the manifest's
  canonical `sha256:` tree digests. This approval freezes task identity,
  order, and smoke selection only; it is not yet a canonical task catalog,
  qualified manifest, runner, credential, remote call, or observation.
  B112 remains open for a separately approved history-free single-baseline
  materializer, canonical digests and exact task/profile material, verifier
  calibration, host runner, live-call capability/budget, observations, and
  scorecards.

- 2026-07-28 D658 locks B112's package-private history-free single-baseline
  repository materializer. A host supplies an exact source-repository
  capability, a private allocator/cleanup capability, and optional
  operator-private exact-replacement overlay bytes. The materializer verifies
  the lowercase 40-hex commit and preregistered tree object with replacement
  objects and ambient Git configuration disabled, then reads only the committed
  object graph through fixed batched `ls-tree -z` and `cat-file --batch`
  plumbing. It accepts bounded portable regular-file trees only: `100644` and
  `100755`, at most 4096 entries, 64 MiB total, 4 MiB per file, 512 path bytes,
  and 255 bytes per component; symlinks, gitlinks, special paths/files,
  case-fold collisions, filters, archives, ordinary worktrees, filesystem
  copies, fuzzy patches, generic shell, and per-file process loops are rejected.
  Canonical evidence hashes strict canonical JSON over byte-sorted path, mode,
  byte length, and exact content digest records with no text normalization.
  Version-one overlays replace 1..16 exact existing regular files, bind base
  mode/content plus replacement length/content digest, and remain private; they
  cannot add, delete, rename, change mode, or expose mutation material,
  expected patches, source paths, hidden verifier material, or raw errors.

  Materialization occurs in host-owned `0700` staging, applies any overlay
  before a destination repository exists, and builds a new deterministic
  parentless repository through fixed Git plumbing with an empty template and
  no signing, hooks, remotes, reflogs, alternates, replacements, grafts,
  shallow state, or shared object store. Success requires exactly one
  zero-parent commit, clean status, no unreachable objects, and an exact full
  filesystem-to-canonical-manifest match including absence of ignored extras.
  Historical actor digests equal their original tree digest; held-out overlay
  actor digests differ. The actor receives only a sealed runtime-private
  workspace capability and bounded path-free evidence. Cleanup requires the
  exact allocator ownership token, never follows symlinks or uses a broad
  target, receives at most one immediate attempt, and surfaces failure as
  non-evaluable. D658 claims repository-local reproducibility and source-history
  isolation only, not same-UID filesystem/process/network containment or a
  hostile-code security sandbox. This slice owns no actor/tool commands,
  dependency install, verifier execution, model loop, provider call,
  timeout/retry/scheduler, artifact persistence, public export, Graph topology,
  protocol/conformance, cross-language, Demo, or web surface.

- 2026-07-28 D658 implementation completed in graphrefly-ts commit `94fedd48`.
  The package-private eval materializer now performs exact batched Git-object
  export, canonical byte/tree and private-overlay validation, synchronous
  request/overlay provenance snapshots, POSIX-host-qualified `0700` staging,
  deterministic parentless repository construction, exact ref/object/filesystem
  closure checks, sealed workspace handoff, and ownership-token cleanup.
  Adversarial QA closed source/workspace overlap, lazy-fetch, accessor and
  symbol-key material, oversized sparse arrays, mutable request/overlay TOCTOU,
  no-op overlays, special permission bits, dangling objects, cancellation, and
  cleanup edge cases. Focused tests passed 16/16; the full package passed 124
  files and 1948 tests with one intentional live-host skip; lint, raw-async,
  test typecheck, ESM/CJS/DTS build, package-export smoke, diff, and dashboard
  gates passed. A disposable probe of commit
  `3b8115f37c8675b8970b24ada3aa351b772e5144` and tree
  `74f94a624b627aeb62ff0f1ea191bc5c62b13e78` reproduced the exact Git tree in
  one zero-parent commit with canonical digest
  `sha256:9c6f13dc17a09e4f467d8e1a6a9a124b36505e0e3f12fe9eece822b85e0450a2`,
  1685 entries, 20,957,126 bytes, and 28 bounded Git processes, then cleaned
  successfully. B112 remains open for exact task/profile qualification,
  verifier calibration, the separately designed actor/tool host runner,
  explicit live-call credential/budget, observations, and scorecards. No actor
  command, dependency install, verifier/provider execution, persistence,
  public/runtime export, Graph topology, protocol/conformance, cross-language,
  Demo, or web work entered this implementation slice.

- 2026-07-28 D659 locks the package-private B112 actor/tool and verifier host
  execution boundary. It accepts only frozen qualified campaign/task
  coordinates, exact operator-private tool/command/verifier profiles, one D658
  sealed workspace, one D652 model-turn port, the frozen protection executor,
  and an explicit host cancellation signal. Actor tools are closed to bounded
  regular-file read, literal search, digest-bound exact text replacement,
  bounded workspace diff, and preregistered `commandRef` execution. A
  `commandRef` resolves to fixed executable/argv/cwd/sanitized environment and
  bounded streams; the actor never supplies shell, executable, argv, cwd,
  environment, network/credential/container authority, verifier commands,
  hidden fixtures, expected patches, special-file operations, or out-of-tree
  paths. This is trusted-repository reproducibility, not OS containment.

  The host performs explicit sequential one-turn calls and ordered tool
  execution with pre-dispatch budget checks, digest-bound protected canonical
  results, no parallel intents, and no hidden retry/fallback/provider switch,
  timer, scheduler, queue, or autonomous continuation. After final actor output
  it applies the exact diff-policy gate, then invokes a disjoint host-private
  verifier whose commands, fixtures, expected material, and evidence cannot be
  discovered or satisfied by actor claims. All D639 verifier calibration cases
  remain required. Failures remain distinct bounded non-evaluable outcomes.
  The first implementation is deterministic fake-model plus local calibration
  only and persists no raw or hidden material. Live OpenAI invocation,
  credentials, remote budget, observations/scorecards, public/runtime exports,
  Graph topology, protocol/conformance, cross-language, Demo, and web remain
  separately unapproved.

- 2026-07-28 D659 implementation landed in graphrefly-ts commit `289aa4ce`.
  The package-private deterministic host binds frozen task, profile, material,
  protection, and verifier coordinates to one sealed D658 workspace; drives
  explicit sequential D652 turns over the closed read, literal-search,
  digest-bound-replace, bounded-diff, and preregistered-command tool surface;
  and admits only fixed no-shell commands with sanitized environment and
  bounded streams. Conservative result bounds are checked before dispatch and
  exact canonical bytes after execution. Every next-turn tool-result batch is
  protected by a runtime-constructed D656 executor, duplicate tool-call refs
  fail closed, cancellation terminates the command process group, and cleanup
  must return the exact conforming success result.

  The host snapshots the complete trusted repository closure, normalizes and
  checks the Git index, admits only the exact writable-file diff and modes, and
  binds the final canonical workspace-state digest into disjoint
  `target-verification` evidence with exact task, verifier-profile, fixture,
  and harness coordinates. This is deterministic trusted-repository evidence,
  not hostile same-UID race, process-session, network, or OS sandbox
  containment. The D639 calibration runner executes every required
  known-good, plausible-wrong, missing-evidence, tamper, and out-of-policy case
  sequentially through one hidden-fixture capability and fails closed on
  incomplete, duplicate, mismatched, cancelled, or misclassified evidence.

  Focused D656/D659/empirical tests passed 38/38; the full package tests, lint,
  raw-async and test typecheck, ESM/CJS/DTS build, package-export smoke,
  forbidden-capability scan, diff check, and three independent read-only QA
  passes are green. B112 remains open and CSP-11 remains `impl` with
  `gap=true` pending exact five-task/profile qualification, explicit live-call
  credential and budget approval, the first OpenAI smoke observation, and
  empirical observation/scorecard persistence. No live provider call,
  credential, durable persistence, public/runtime export, Graph topology,
  protocol/conformance, cross-language, Demo, or web work entered D659.

- 2026-07-28 D660 preserves D657 as the first implemented focused binding and
  leaves its direct OpenAI contract unchanged, while selecting OpenRouter as
  the second package-private focused binding and the gateway for B112's first
  credentialed empirical evaluation. Exact five-task offline materialization,
  verifier calibration, and qualification remain provider-independent and may
  proceed without credentials or cost. No live smoke or campaign may begin
  until both the focused OpenRouter binding and exact five-task qualification
  are green.

  The first live route is fixed to OpenRouter shared capacity, exact model
  `openai/gpt-5.6-sol`, and downstream provider OpenAI, with no BYOK, fallback,
  alternate model, plugin, or hidden routing. D660 supersedes D659 only where
  D659 names direct OpenAI as the first live smoke; D659's closed host, actor
  tool, budget, workspace, protection, and verifier semantics remain
  unchanged. This lock authorizes no live call, ambient credential, generic
  OpenAI-compatible adapter, provider registry, public/runtime export, Graph
  topology, protocol/conformance change, cross-language parity, Demo, or web
  surface.

- 2026-07-28 D661 closes the OpenRouter shared-capacity admission fork found
  during D660 implementation review. OpenRouter currently offers no
  per-request BYOK-off control and automatically prioritizes matching BYOK
  credentials. Before dispatch, the focused binding therefore requires one
  closed frozen host-attested qualification bound to the same credential
  ref/revision and one dedicated workspace ref/revision, with capacity mode
  `openrouter-shared-only`, `qualified=true`, and `byokCredentialCount=0`.
  The trusted campaign host obtains this through an out-of-band read-only
  workspace check; the binding owns no management client/API call, ambient
  credential discovery, workspace mutation, durable qualification store, or
  automatic refresh.

  After response, closed versioned router metadata must independently prove
  the exact requested `openai/gpt-5.6-sol` model, direct first-attempt
  downstream OpenAI route, `is_byok=false`, exactly one selected endpoint,
  and no contradictory routing or material pipeline stage. Optional attempts,
  when present, must contain exactly the successful OpenAI/model/200 attempt.
  Missing metadata, cached replay without metadata, additive unreviewed
  fields, fallback, alternate model, BYOK, plugin/pipeline, or contradictory
  route material is bounded non-evaluable. External workspace drift between
  qualification and dispatch is not prevented or certified. This remains
  private eval-infrastructure evidence, not model correctness authority, and
  changes none of D659's host/tool/verifier semantics or D660's pre-live gate.

- 2026-07-28 D660-D661 implementation landed in graphrefly-ts commit
  `b88ca6e4`. One package-private focused OpenRouter Responses binding
  implements the unchanged D652 provider-neutral turn port over a
  host-injected byte transport. It fixes the route to OpenRouter shared
  capacity, exact model `openai/gpt-5.6-sol`, and downstream OpenAI; requires
  the closed same-credential dedicated-workspace zero-BYOK qualification
  before construction; and accepts only closed direct first-attempt
  non-BYOK router metadata after response.

  Deterministic provider-safe wire-name lowering preserves exact internal
  tool/output references, the D656 same-token protection capability covers
  the canonical request and raw model egress including response id, and
  bounded `error_type`/status decoding keeps provider failures distinct
  without retaining raw bodies or thrown values. Three independent
  adversarial QA passes found and closed shared-capacity admission,
  response-id protection, error classification, optional-attempt closure,
  dotted tool-ref lowering, unknown route-field, and prior-tool-result
  wire-name defects; every final review reported no findings.

  Focused tests passed 25/25. Full package tests passed 126 files and 1983
  tests with one intentional live-host skip; biome/lint, raw-async and test
  typecheck, ESM/CJS/DTS build, package-export smoke, private-source/public-
  export/topology scans, and diff checks passed. B112 remains open and
  CSP-11 remains `impl` with `gap=true` pending exact five-task/profile
  offline qualification, explicit OpenRouter credential and budget approval,
  the first live smoke, and empirical observation/scorecard persistence. No
  live network call, credential, ambient environment lookup, SDK/client,
  management API, generic adapter/registry, retry/fallback, durable
  persistence, public/runtime export, Graph topology, protocol/conformance,
  cross-language, Demo, or web work entered this slice.
D662 locked 2026-07-28: `@graphrefly/reactive-layout-node-canvas` is owned and released by the standalone
`graphrefly/graphrefly-reactive-layout-node-canvas` repository, not by `graphrefly-react` or
`@graphrefly/ts`. The package keeps only the concrete optional-peer `canvas` loader/injection seam; neutral
measurement capabilities and layout algorithms remain in `@graphrefly/ts`. The React repository must remove
the child implementation and release ownership after the standalone repository is green, with no mirror,
compatibility facade, dual publication, protocol change, graph change, or new layout behavior.

- 2026-07-28 D663 locks a separately sequenced reusable public model-turn
  adapter boundary below solutions. Provider mechanics proven by B112 may be
  extracted into one zero-dependency focused
  `@graphrefly/ts/adapters/model-turn` subpath with strict bounded
  provider-neutral single-turn request/outcome contracts and focused OpenAI
  Responses plus OpenRouter Responses factories. The package root and
  existing `@graphrefly/ts/adapters` aggregate remain unchanged.

  The reusable adapter owns only one explicit request/response translation,
  supported tool and structured-output lowering, bounded provider decoding,
  provider-scoped usage/error/routing evidence, host-measured latency through
  an explicit monotonic-measurement capability, propagation of a caller-owned
  `AbortSignal`, explicit credential capability, and standards-based or
  injected bounded transport. It owns no agent/tool loop, tool execution,
  later turn, retry/fallback/provider selection, registry, ambient
  credentials, cancellation policy/controller, scheduler/queue, WorkItem or
  AgenticMemory lifecycle,
  admission/application, verifier, correctness, persistence, durable receipt,
  scorecard, or eval pass/fail. Provider material remains evidence, never
  application or evaluation authority.

  B112's `Empirical*` manifest, campaign, task, trial, qualification, budget,
  protection, evidence, and closed-host contracts remain private wrappers;
  they are not renamed or exported as a generic harness API. Additional
  provider factories require focused review rather than a compatible-base-URL
  adapter or registry. D663 is architecture approval only. After B112's first
  successful live OpenRouter smoke, B115 still requires a separate exact
  public-contract design review and authority lock; implementation and
  export-map work require a later separate user approval. No export-map,
  runtime, Graph topology, protocol/spec/conformance, cross-language, Demo,
  or web change entered this decision.

- 2026-07-28 B112 exact five-task offline qualification completed. The
  package-private orchestrator seam landed in graphrefly-ts commit
  `1bf1aadd`; its six committed tests are deterministic contract-model
  evidence and do not stand in for the real qualification.

  The separately executed operator-private gate used D658 to materialize the
  exact ordered three historical pre-fix snapshots and two held-out overlays.
  It bound exact task, WorkItem, acceptance, workspace, allowed-command and
  verifier-profile coordinates and ran all twelve D639 calibration actions
  for each task. Known-good exact artifacts passed; target-defect and
  plausible-wrong artifacts failed; actor claims could not satisfy the
  verifier; command, out-of-policy, test/verifier-tamper and workspace
  isolation gates were observed; and missing, unreliable and non-executable
  evidence remained non-evaluable.

  All five observations qualified with zero issues. The task-catalog digest
  is
  `sha256:193276dc1675cfcbb515b7f8e63800ff774fdfa64f25b3841abe9f0749171b38`,
  the qualification-report digest is
  `sha256:15b83027dd00f1d5809f80509bc2362a5b3121423d207d0e301ef7aa15b39b92`,
  and the frozen offline-manifest digest is
  `sha256:101bae005a589bd2b886822f1bd66c3efd26b2f5ab90c2451ffe5abe8974d188`.
  Two independent post-fix reviews reported no remaining findings. The
  ignored private bundle is published as one fail-closed atomic generation
  with 0600 files; overlay bytes, expected material, credentials, raw errors
  and provider/runtime objects are absent.

  This is operator-private offline task/profile/materializer/verifier
  qualification only, not model-efficacy evidence or a live provider call.
  Its manifest retains pending credential/pricing coordinates and is not
  dispatch authority. B112 remains open, and CSP-11 remains `impl` with
  `gap=true`, pending an explicit OpenRouter credential and same-credential
  dedicated-workspace zero-BYOK qualification, explicit pricing/budget
  approval, the first live smoke, and empirical observation/scorecard
  persistence. No public/runtime export, Graph topology,
  protocol/conformance, cross-language, Demo or web work entered this slice.

- 2026-07-28 B112 package-private scripted model-turn replay hardening
  completed in graphrefly-ts commit `1e8b54da`. The former one-pair
  deterministic fake is now one provider-neutral strict semantic replay
  adapter: construction prevalidates a dense ordered request/outcome script
  against the frozen manifest, qualification report and explicit credential
  capability; invocation requires the exact canonical request digest for the
  current step; misses and cancellation fail closed without consuming the
  step; and every permitted attempt consumes the frozen agent-run request
  budget. Successful-call observations are immutable and carry both the
  actual attempt index and script index, so rejected or aborted attempts
  remain detectable without retaining raw provider material. Sparse scripts,
  over-budget scripts, credential substitution, unexpected requests,
  cancellation, exhaustion and stable attempt-budget closure are covered.

  This is test-only deterministic semantic fixture evidence for the D652
  port and D659 host control flow. A scripted completed outcome retains
  D653's simulated `usage.requests=1` solely to exercise validators and
  accounting branches; it is not a provider request, trial observation,
  campaign scorecard or model-efficacy result. Provider HTTP mapping remains
  a separate injected byte-transport fixture layer. The adapter owns no
  network, timer, retry, fallback, filesystem, store, credential lookup or
  empirical-artifact persistence. It remains below `src/__tests__`; no
  package export, subpath, package-root/adapters aggregate, runtime behavior
  or Graph topology changed. The lint boundary now explicitly excludes only
  the already gitignored operator-private B112 artifact directory.

  Two adversarial QA reviewers found and closed invisible rejected-attempt
  accounting, sparse-script acceptance, an unreachable credential branch
  and unbounded invocation attempts; both final reviews reported no
  findings. Focused semantic and OpenAI/OpenRouter wire tests passed 37/37;
  the final full package run passed 127 files and 1989 tests with one
  intentional live-host skip; lint/biome, raw-async, example and test
  typecheck, ESM/CJS/DTS build, package-export smoke and diff checks passed.
  The local DTS worker required `NODE_OPTIONS=--max-old-space-size=8192`
  after the default Node worker heap exhausted; no type or export failure
  occurred.

  B112 remains open and CSP-11 remains `impl` with `gap=true`. The remaining
  gates are unchanged: explicit OpenRouter credential plus same-credential
  dedicated-workspace zero-BYOK qualification, explicit pricing/budget
  approval, the first live smoke, and empirical observation/scorecard
  persistence. No live provider call, public adapter implementation,
  Another Hello adoption, durable store, Rust/Python work, real-model
  campaign, Demo or UI entered this slice.

- 2026-07-29 D669 supersedes D660-D661 only where they made
  `openai/gpt-5.6-sol` through downstream OpenAI the globally fixed
  OpenRouter route. OpenRouter shared capacity remains the gateway for
  B112's first credentialed smoke, but each smoke, calibration, or
  confirmatory trial block now selects one exact package-private frozen
  route qualification bound to its `EmpiricalModelConfigurationV1` and
  digest. That qualification pins the requested model, identity kind,
  downstream provider, endpoint/adapter revisions, supported capabilities,
  sampling/reasoning/output/tool settings, usage/pricing revisions,
  same-credential dedicated-workspace zero-BYOK qualification, and closed
  route-evidence revision.

  The focused binding must derive request model, downstream-provider
  constraints, and supported settings only from the frozen qualified
  material. Matched cold/warm arms share identical configuration and route
  digests; a different model/provider is a separate preregistered trial
  block. Ambient environment selection, arbitrary base URLs, fallback,
  alternate-model routing, BYOK, plugins, and material pipelines remain
  forbidden. A model change under the same supported OpenRouter wire
  contract requires a new frozen profile and qualification revision, not
  necessarily a new binding revision; changed request lowering, response
  parsing, or supported wire semantics requires a binding revision. Exact
  post-response route mismatch remains bounded non-evaluable. Smoke remains
  infrastructure evidence and makes no efficacy claim.

  D652-D653 and D659 host, budget, protection, verifier, and authority
  boundaries remain unchanged. D669 authorizes the architecture only:
  TypeScript route-qualification implementation, the exact first route
  profile, credential use, pricing/budget approval, remote invocation, and
  observation/scorecard persistence remain separately gated. B112 remains
  open and CSP-11 remains `impl` with `gap=true`; no public adapter,
  provider registry, live call, Graph topology, protocol/conformance,
  cross-language, Demo, or web work is authorized by this lock.

- 2026-07-29 B112 D669 package-private pre-live smoke boundary completed in
  graphrefly-ts commits `8b78d666` and `f885c670`. The implementation adds
  a strict operator-supplied route qualification bound to the frozen campaign,
  manifest, trial block, exact `openai/gpt-5.6-sol` model configuration,
  downstream OpenAI route, same credential binding, dedicated workspace,
  zero-BYOK attestation, official pricing revision, explicit spend
  approval, and no-reset key limit. The binding continues to receive only
  an explicit credential capability; only the outer package-private
  operator reads `OPENROUTER_API_KEY`, constructs the capability, creates
  the standards-based fetch transport, and applies the qualified latency
  timeout. No credential material is committed or persisted.

  The focused byte transport performs at most one fixed-endpoint POST per
  invocation, accepts the caller AbortSignal, rejects redirects, bounds
  request and streamed response bytes, and contains no retry, fallback,
  provider switch, timer, scheduler, queue, SDK or management API client.
  The paid-request admission gate reserves against the actual materialized
  wire-body bytes and only literal `true` authorizes dispatch. The
  one-task/one-cold-block runner never auto-runs warm, calibration or
  confirmatory work and turns budget exhaustion, in-flight transport
  failure, and known post-attempt usage overruns into sanitized
  non-evaluable evidence.

  Strict versioned `empirical-trial-block-observation.v1` and
  `empirical-campaign-scorecard.v1` projections bind manifest, task, route,
  pricing, budget, verifier, usage, host-byte, latency and cost
  coordinates. Determinism means identical frozen observation bytes
  aggregate to identical canonical scorecard bytes; it does not claim a
  model rerun is reproducible. The scorecard always carries the smoke
  no-efficacy-claim boundary. Raw provider bodies, stdout/stderr, secrets,
  hidden verifier material, expected patches and environment material are
  excluded. Validated artifacts are protected, written 0600 beneath the
  existing ignored operator-private root, fsynced in a 0700 staging
  directory, and published by one atomic directory rename; no database or
  network store was added.

  The mandatory injected no-network dry run covers semantic model-turn
  mapping, closed host turns, bounded tool intent/result, verifier,
  canonical observation and scorecard, and atomic private persistence. It
  also proves actual-wire-byte admission, request/step/cost exhaustion,
  unexpected request rejection, literal-true admission, no retry/fallback,
  secret-sentinel absence, transport-failure persistence, known-usage
  overrun persistence, and collision/path/protection failure behavior.
  Simulated `usage.requests=1` remains contract evidence only and is not
  live empirical evidence.

  Final validation passed 130 test files and 2019 tests with two intentional
  live skips; lint/biome, raw-async, example and eval/test typecheck,
  ESM/CJS/DTS build with the package-export smoke, topology/source scans,
  `git diff --check`, and the authority dashboard consistency check all
  passed. Two independent read-only reviewers closed route/credential/wire
  admission, response cancellation, secret protection, atomic visibility,
  actual-cost, failure-observation, timeout, and evidence-cardinality
  findings. No package root, adapters aggregate, public subpath, tsup
  entry, Graph topology, protocol/spec/conformance, Rust/Python, Another
  Hello, real store, real-model campaign, Demo, UI or web surface changed.

  The final QA follow-up additionally keeps a sanitized non-evaluable
  model-turn result after the outer deadline aborts an in-flight request, so
  the persisted block retains the attempted request, step, protection and
  budget evidence instead of rebuilding zero-count evidence. Successful
  outcomes are still rejected after cancellation. Strict validation now
  requires protection-receipt cardinality for every attempted step and
  accepted-route cardinality for known-usage budget overruns while still
  permitting an unavailable transport attempt to have no provider route
  evidence.

  No provider/network call occurred. B112 remains open and CSP-11 remains
  `impl` with `gap=true`. Before the first charged smoke, an operator must
  still supply the dedicated-workspace same-key read-only zero-BYOK
  qualification, freeze non-placeholder live approval coordinates, place
  the credential only in the local shell environment, and receive explicit
  user approval for the hard spend cap. The proposed first-block cap is
  four requests, eight steps, 65,536 wire bytes per request, 100,000
  aggregate input tokens, 8,192 aggregate output tokens, 60,000 ms, and
  750,000 microusd model spend under the frozen $5/M input and $30/M output
  price; OpenRouter's credit-purchase fee is outside that model-usage cap.

- 2026-07-29 B112 first approved OpenRouter operator invocation produced a
  sanitized, atomic, operator-private non-evaluable generation before byte
  transport. The live-approved block was bound to exact model
  `openai/gpt-5.6-sol`, downstream OpenAI, the official 2026-07-29 pricing
  revision, same-key dedicated GraphReFly workspace qualification,
  `byokCredentialCount=0`, no-reset USD 0.75 key limit, and the user-approved
  four-request / eight-step / 750,000-microusd cap. The persisted observation
  and scorecard make no efficacy claim and report one attempted cold block,
  one step, `requests=0`, no provider usage, no provider route evidence,
  verifier not run, and issue `openrouter-measurement-invalid`.

  Root cause was the outer package-private CLI passing fractional
  `performance.now()` values to the binding's safe-integer monotonic
  measurement contract. Therefore no HTTP/provider request occurred and the
  persisted 99,585 microusd is conservative pre-dispatch reservation, not
  actual spend. The CLI now floors the monotonic reading and a focused
  regression binds the outer operator seam to non-negative safe-integer
  milliseconds. Final QA also separated live approval from provider evidence:
  the zero-request observation and scorecard now use
  `live-approved-no-provider-evidence`, set `empiricalLiveEvidence=false`,
  and carry `costBasis=conservative-reservation` plus the reserved input and
  output token counts into the standalone scorecard. The original
  semantically-invalid private generation was retained under an explicitly
  superseded directory name; the corrected generation was atomically
  republished at the original generation coordinate without another model
  attempt or network call. No automatic retry was performed. A replacement
  live block requires a new explicit approval and generation coordinate.

  The generation remains 0600 under the existing 0700 gitignored private
  ownership root. Its generation digest is
  `sha256:0a94b608adcb1c1d6d9eda0e9e01b9c7b2fde8fdad20160f198bbfbb555503b5`;
  observation digest
  `sha256:6364af4a1471ac1a2044836bddb8cad09b9212addf6a2ca522d08809f3ceb76f`;
  and scorecard digest
  `sha256:ee4e656d82dcda939302cffb7169165773acebdaa2850287f4d10e615bab0a0f`.
  B112 remains open and CSP-11 remains `impl` with `gap=true`. No public D663
  adapter, real campaign, Another Hello, store, Rust/Python, Demo, UI, web,
  Graph topology, protocol, spec, or conformance surface entered this slice.

- 2026-07-29 the explicitly approved B112 replacement smoke v2 executed
  exactly one first-task / one-attempted-block OpenRouter HTTP request after
  the monotonic-measurement fix, with no retry, fallback, parallel call or
  automatic continuation. The operator-private atomic generation is
  `non-evaluable`: one request, one step, 3,533 host input bytes, zero host
  output bytes, 827 ms latency, no provider token usage, no accepted route
  evidence, verifier not run, and issues `model-turn-non-evaluable` plus
  `openrouter-request-rejected`. The persisted 99,585 microusd remains the
  conservative reservation for 7,629 input and 2,048 output tokens, not
  measured provider spend.

  A same-session read-only check of the dedicated GraphReFly `Local Eval 2`
  key showed the no-reset USD 0.75 limit unchanged, total/today/week/month
  usage `$0.0000`, key-limit usage `$0 / $0.75`, zero activity requests and
  token volume, and no generation or upstream-request log entry. Thus the
  local transport truthfully records one attempted HTTP request while the
  OpenRouter control plane records no admitted transaction and no charge.
  The bounded evidence deliberately discarded the provider body and did not
  retain the exact HTTP status or canonical error type, so the specific
  rejection cause cannot be recovered or claimed from v2.

  A package-private offline follow-up adds only allowlisted rejection
  diagnostics to the existing issue-code evidence: bounded HTTP status,
  recognized OpenRouter canonical `error_type`, and recognized Responses
  `error.code`. Unknown values become `unrecognized`; raw message, body,
  headers, credential and arbitrary provider strings remain excluded. This
  does not add a public schema, export, logger, retry path or persistence
  owner, and it cannot retroactively diagnose v2. Per D669, the changed
  response parsing and canonical outcome bytes advance the frozen binding
  coordinate from `graphrefly-openrouter-responses-wire.v2` to
  `graphrefly-openrouter-responses-wire.v3`; any future route qualification
  must pin that new revision. A fixture places a credential sentinel in the
  untrusted `error_type` position and proves it is not reflected into the
  outcome. Any diagnostic v3 provider attempt requires a new explicit user
  approval and generation coordinate.

  The v2 generation digest is
  `sha256:1f52d22e4bd233ccfbfbd3df6b67c98701fd8c4f2262d3b6baba054ea8fd1e49`;
  observation digest
  `sha256:7d80f07b28acaf37b6c5c1093ec43ba92ba12bfc2fede3112aaec1af7bfe9a14`;
  and scorecard digest
  `sha256:233093c2682922556ad4ea476d7d7fdcd4fba5341fd89db706483bdce3bdd890`.
  The scorecard still carries `efficacyClaim=none`. B112 remains open and
  CSP-11 remains `impl` with `gap=true`; no public D663 adapter, real
  campaign, Another Hello, store, Rust/Python, Demo, UI, web, Graph topology,
  protocol, spec or conformance surface entered this slice.

- 2026-07-29 D670 and graphrefly-ts commit `9dfe51f0` completed the
  package-private B112 empirical evidence v2 action-attribution slice. The
  closed D659 host now derives delivered-memory identity from the validated
  initial structured request and emits a bounded action trace that binds the
  initial request, exact per-turn request, unique digested tool-call
  reference, closed tool ref, protected intent/result digests and delivered
  memory-context record digest. Observation v2 persists ordered turn-request
  digests plus sanitized one-to-one tool-result bindings; validators require
  turn zero to equal the initial request, exact ordinal binding, unique tool
  calls, nondecreasing action steps and the shared 256-action host ceiling.
  The same-baseline/different-route/workspace-change
  `prior_failure_route_avoided` field remains diagnostic and outside the
  D626-D627 family gate.

  Reflection no longer copies actor-controlled final summaries. Its relevant
  memory is task-agnostic host-observed failure, bounded prior action route
  and generic inspect-contract-correct-validate guidance; a correction-bearing
  cold summary is proven absent from the warm context. The scripted no-network
  matched block validates the exact selected record digest before emitting
  its correction. It produced one verifier-passing relevant warm run while
  all four controls failed, demonstrating contract wiring only. Because no
  explicit actor-produced cognition attribution exists,
  `warm_decision_trace_includes_memory=false`, `familyPassed=false`, and the
  scorecard retains `efficacyClaim=none`.

  The v2 observation, scorecard and generation contracts are intentionally
  incompatible with historical v1 bytes and expose no v1 aliases or
  compatibility shims. Atomic 0600/0700 private persistence regression tests
  prove a non-empty historical v1 generation remains byte- and mode-identical
  across a colliding v2 failure and an adjacent successful v2 generation.
  Tamper cases cover duplicated result bindings, substituted first turns,
  reversed action steps, unequal workspace baselines, secret sentinels and
  partial persistence failure. Focused closed-host tests passed 31/31; the
  full package passed 130 files and 2,033 tests with four intentional skips;
  lint/typecheck/raw-async, ESM/CJS/DTS build and export smoke, privacy,
  topology, diff and dashboard gates passed. Two independent final QA
  reviewers reported no remaining actionable findings.

  This slice made no provider or network call and does not replace or
  reinterpret the existing v22 matched live observation. B112 remains open
  and CSP-11 remains `impl` with `gap=true`: a real larger matched campaign
  and explicit actor attribution/efficacy boundary remain future separately
  approved work. No public D663 adapter, package export, provider registry,
  retry/fallback/parallel call, real store, Graph topology, protocol/spec/
  conformance, Rust/Python, Another Hello, Demo, UI or web work entered D670.

- 2026-07-29 the explicitly approved B112 v22 first-task matched live smoke
  completed one uninterrupted block through the package-private D669
  OpenRouter route. Immediately before dispatch, the operator changed only
  the dedicated enabled `Local Eval 2` total no-reset key limit from USD 8.00
  to USD 8.25, re-observed all 64 GraphReFly workspace BYOK providers as
  unconfigured, and froze an incremental USD 4.70 hard cap. The exact route
  remained `openai/gpt-5.6-sol` through downstream OpenAI shared capacity,
  with no BYOK, fallback, alternate model, plugin, retry, parallel request or
  background continuation. The v22 approval bit was relocked immediately
  after the one operator execution.

  The live block completed the failed cold run plus all five fresh serial
  warm arms: relevant-applied, proposal-only, admission-rejected,
  irrelevant-applied and wrong-scope-applied. All 48 requests and 48 steps
  were accepted under one monotonic ledger, with 647,318 input tokens, 4,006
  output tokens, 651,324 total tokens, 2,522,366 host input bytes, 14,124 host
  output bytes, 155,061 ms aggregate latency and 4,147,524 microusd measured
  provider cost. No admission rejection, budget exhaustion, provider/network
  rejection or non-evaluable arm occurred.

  The independent verifier failed cold and every warm arm with
  `target-artifact-mismatch`. The relevant record was genuinely proposed,
  admitted, retrieved and applied; its trace included memory and recorded
  prior-failure-route avoidance, but the resulting workspace still failed.
  Proposal-only and all three secondary controls also failed. The primary
  relevant-applied versus proposal-only comparison is therefore
  `concordant-fail` with risk difference zero; all three secondary comparisons
  are also `concordant-fail`. This is a complete matched smoke result showing
  no observed benefit on the first task, not evidence that memory helped or
  harmed generally. The scorecard retains `efficacyClaim=none` and
  `smoke-integration-no-efficacy-claim`; no calibration or confirmatory
  campaign followed automatically.

  The sanitized atomic private generation is canonical strict JSON beneath a
  0700 gitignored root with 0600 files. Its generation digest is
  `sha256:4392ca9e98091225470f152e72120d0c868747b1f072e9223117b6586ad5a07c`,
  observation digest is
  `sha256:16f389190a56217e1247e954e4ebd276731a3f7bcef4d9c5fd6fd91e720f2038`,
  and scorecard digest is
  `sha256:36246548e62b5d2875d2a2b5a06a3b74613cd288ff4e90db0b86c9017b5e2763`.
  Digest, canonical-byte, permission and credential/raw/private-material
  absence scans passed. This completes the requested first-task live smoke,
  observation, scorecard and persistence slice. B112 remains open and CSP-11
  remains `impl` with `gap=true` for any separately preregistered exploratory
  calibration or confirmatory campaign and later presentation work. No
  public D663 adapter, Another Hello, durable store, Rust/Python parity,
  Demo/UI/web, Graph topology, protocol, spec or conformance surface entered
  this slice.

- 2026-07-29 B112 pre-live matched-block slice completed in graphrefly-ts
  commit `13b641e8`. The package-private runner now treats a verified failed
  cold first-task run as D639 rerun-eligible and executes the exact five fresh
  serial warm arms in frozen order: relevant-applied, proposal-only,
  admission-rejected, irrelevant-applied and wrong-scope-applied. One binding,
  route digest and monotonic request/input/output/cost/latency ledger span all
  six runs; only the frozen per-run request/step counter resets. Fresh warm
  factories can supply only D658 materializations, so they cannot replace the
  cold verifier, task profile, qualification report or manifest authority.
  No retry, fallback, provider switch, parallel call or background work was
  added.

  The provisional private `empirical-trial-block-observation.v1` and
  `empirical-campaign-scorecard.v1` now represent the complete D639 five-arm
  smoke shape. Lifecycle conformance binds every stage predicate and selected
  record digest through proposal, admission, application and graph-visible
  retrieval. The scorecard records the primary relevant-applied versus
  proposal-only contrast plus the three required secondary paired contrasts,
  while retaining `efficacyClaim=none` and the smoke-only claim boundary.
  Budget exhaustion and warm materialization failure persist bounded
  incomplete evidence with all charged cold/provider accounting; atomic 0600
  sanitized private generation persistence remains the only durable owner.

  A proposed cross-invocation checkpoint/resume path was rejected and removed:
  it is the architecture fork already excluded by the D659 flow and could
  replay a charged but not-yet-checkpointed arm. No new D-number was created.
  The mandatory injected-transport no-network dry-run covers cold plus all
  five arms, global versus per-run bounds, unexpected requests, no
  retry/fallback, secret-sentinel exclusion, canonical scorecard aggregation,
  persistence failure and atomicity. Final full TS gates passed 130 test files
  and 2,033 tests with four intentional skips, plus lint/raw-async/typecheck,
  ESM/CJS/DTS build and package-export smoke. Both independent final read-only
  reviews reported no P0/P1 findings.

  The operator re-observed the dedicated GraphReFly OpenRouter workspace:
  all 64 BYOK providers were unconfigured and `Local Eval 2` remained an
  USD 8.00 no-reset total key with approximately USD 3.52 used and USD 4.48
  remaining. Official OpenRouter endpoint data was refrozen at the
  under-272k-input conservative OpenAI ceiling of USD 6.25/M cache-write input
  and USD 30/M output; the request-price tier is now checked before dispatch.
  Exact-five offline qualification remained 5/5 with task-catalog digest
  `sha256:14eed1802f6e3d0e782a5b77c7c0b1ebbaa17f7e80b79288759b7ae8f02beddc`,
  qualification-report digest
  `sha256:aaf169a305e6152cd6b56e8891fbc89cef7d9687868b94d354328921196ff3ca`
  and manifest digest
  `sha256:23ab8c739bf9c8519d92aeca7e3687098ca801701e9ac4ce7281fec9c18e8bd8`.
  The ignored v22 operator input remains fail-closed and unapproved. No v22
  provider call occurred. B112 remains open and CSP-11 remains `impl` with
  `gap=true` pending an exact incremental spend approval and a key limit that
  can cover one uninterrupted matched block.

- 2026-07-29 the package-private D669 OpenRouter lowering was revised without
  changing the D659 host loop. TS commit `38dfda24` adds the already-validated
  D652 `stepIndex` plus the effective frozen turn limit to the stateless user
  envelope, where the limit is the minimum of model, agent-run and qualified
  route step/request ceilings and the request schema's 256-turn
  representability bound. An out-of-route step fails before admission or
  transport. The actual final turn lowers `tool_choice=none`; a provider tool
  call that violates that request still passes through D656 raw-egress
  protection, provider-usage normalization and sanitized route-evidence
  construction before becoming non-evaluable. Prompt/system envelopes moved
  to v2 and the D669 wire binding moved to
  `graphrefly-openrouter-responses-wire.v7`.

  Adversarial review found and fixed two pre-dispatch defects: qualified route
  caps were initially absent from the final-turn calculation, and the first
  final-tool rejection path bypassed raw protection, over-budget usage
  normalization and route evidence. Regression coverage now includes stricter
  route caps, pre-transport step rejection, enforced final no-tool lowering,
  forbidden final tool calls, credential-sentinel blocking, over-budget token
  normalization and the complete bad-loop observation/scorecard/private
  persistence path. Both independent final read-only reviews reported no
  P0/P1/P2 findings. Mandatory injected no-network preflight passed 74/74;
  the full suite passed 2,032 tests with four intentional skips, plus lint,
  raw-async/typecheck, ESM/CJS/DTS build/export, topology, diff and dashboard
  gates.

  Fresh exact-five qualification remained 5/5 with task-catalog digest
  `sha256:14eed1802f6e3d0e782a5b77c7c0b1ebbaa17f7e80b79288759b7ae8f02beddc`,
  qualification-report digest
  `sha256:7df3111ea064fb628e93b2556e08e40d7ba38d51d5de9e7a425e71c9bf320816`
  and manifest digest
  `sha256:924ec9a49af80bf66912c2b51c622f0c68a4dc07d14619fd31ef4cc42f5273f9`.
  The operator re-observed the dedicated `Local Eval 2` key at approximately
  USD 1.96 used of the approved no-reset USD 3.00 total limit and all 64 BYOK
  providers unconfigured, then froze v19 at one first-task/cold block, eight
  serial requests/steps and a USD 1.00 hard cap.

  V19 completed seven accepted direct OpenAI shared-capacity requests. The
  eighth request, which would have been the enforced final-output turn, was
  rejected before transport because its conservative one-token-per-canonical-
  byte reservation produced a 1,169,047-microusd prospective block total,
  above the 1,000,000-microusd v19 cap. The seven charged requests used 81,983
  input tokens, 541 output tokens, 82,524 total tokens, 319,794 host input
  bytes, 2,174 host output bytes and 26,436 ms, for 526,460 microusd provider
  cost. The sanitized generation is non-evaluable with verifier not run,
  `efficacyClaim=none`, generation digest
  `sha256:72c2304a84e71b9cdc9d1aff03c16baca6956ec5332ea6bd99c239e79e43e568`,
  observation digest
  `sha256:208af264236ddce03ec707f505e94dbfea0dadd00ef32177aec737e1a6d3659a`
  and scorecard digest
  `sha256:482cb837dea4ac9b85fd38ae82aa2919a64ec301139ef1269473aaf429530edb`.
  The three files are 0600 under the ignored private root.

  Post-v19 the OpenRouter control plane reports approximately USD 2.49 used
  (82.954083% of USD 3.00), leaving about USD 0.51. A verifier-complete
  replacement cannot fit both the existing conservative 1.2-million-microusd
  final-turn reservation and that remaining key limit. No retry, fallback,
  parallel call, continuation/resume, key-limit increase or further charged
  block was performed. Completing a v20 replacement requires new user
  authority to raise `Local Eval 2` above USD 3.00; B112 therefore remains
  open and CSP-11 remains `impl` with `gap=true`. No public D663 adapter, real
  campaign, Another Hello, database/store, Rust/Python, Demo/UI/web, Graph
  topology, protocol, spec or conformance surface entered this continuation.

- 2026-07-29 the user raised the dedicated `Local Eval 2` no-reset total key
  limit from USD 3.00 to USD 8.00 and approved a USD 2.00 hard cap for one
  replacement first-task smoke. The earlier reservation failures were
  GraphReFly pre-transport admission decisions, not OpenRouter limits:
  `canonical-byte-upper-bound-reservation.v2` reserves one possible input
  token per canonical request byte and combines that with frozen output,
  request, step, latency and cost ceilings before each network call. The
  binding and transport cannot change the OpenRouter account limit.

  A proposed checkpoint/resume shortcut was reviewed against D659. The
  current host deliberately supplies each protected tool result only to the
  next explicit model turn, retains raw actor/provider material only in
  bounded memory, always cleans the D658 workspace after an outcome and
  persists only sanitized observation/scorecard evidence. Consequently no
  sufficient continuation state exists after a block. Adding workspace/tool
  transcript checkpoint ownership, restoration semantics and budget-ledger
  continuation would change the locked eval flow and private-material
  boundary; it was not introduced under this smoke continuation.

  The operator updated only gitignored private coordinates, re-observed all
  64 OpenRouter workspace BYOK providers as unconfigured, regenerated the
  exact-five qualification and reran the 74-test mandatory no-network slice.
  One initial v20 invocation failed before any provider request because the
  route's newly approved USD 2.00 cap exceeded the still-frozen USD 1.20
  campaign/task ceiling. The private manifest was aligned to USD 2.00,
  requalified 5/5 and validated through the actual operator-input module
  before dispatch.

  V20 then completed five accepted direct OpenAI shared-capacity requests
  before request six was rejected pre-transport because its 124,618-byte
  wire request exceeded the frozen 106,496-byte canonical request ceiling.
  Provider usage for those five accepted requests was 54,602 input tokens,
  376 output tokens, 349,217 microusd and 17,650 ms. The sanitized v20
  generation remained non-evaluable with verifier not run; generation digest
  `sha256:e1ab5e5678ac745b0abe5ddc1fc64e86cbe39c8c27763640f101bb60135571c5`,
  observation digest
  `sha256:21804db0ece74f705d8908e03ac9155293ef732e9cd4e7aa0f97aa7b36408534`
  and scorecard digest
  `sha256:ccc0557bdb81e13daeaeec3a96fc188da22b57169df3f09c496dbd9e4093cfac`.

  V21 retained the USD 2.00 hard cap while raising only the private route
  request/input admission coordinates to 262,144 canonical bytes and 400,000
  aggregate input tokens, within the committed one-megabyte D652 request
  codec bound. Cost remained the ultimate pre-transport ceiling. Fresh
  exact-five qualification remained 5/5 with task-catalog digest
  `sha256:14eed1802f6e3d0e782a5b77c7c0b1ebbaa17f7e80b79288759b7ae8f02beddc`,
  qualification-report digest
  `sha256:93c838f062f3a104250ccdcee0d771b825cf9e95e574134dfaf3c95f3d9f2007`
  and manifest digest
  `sha256:b39dc20840db70feb9b83210350ed26fae2948ba781a5fa4ea4d604dbe9803de`.

  V21 completed all eight serial provider turns with no admission rejection,
  direct downstream OpenAI shared-capacity route evidence for every accepted
  response, final structured actor output and an executed disjoint closed
  verifier. Provider usage was 107,487 input tokens, 615 output tokens,
  108,102 total tokens, 418,811 host input bytes, 2,357 host output bytes,
  45,497 ms and 685,646 microusd. The verifier honestly failed the submitted
  artifact with `target-artifact-mismatch`; the preregistered cold-failed
  policy therefore produced an `incomplete` scorecard and did not run warm
  arms. This is a verifier-complete infrastructure smoke, not an efficacy
  success or an AgenticMemory claim. The generation digest is
  `sha256:24f83eddff1ce7694e5a28fbf5d5f86cf0b79796174d9b5c38d5196c51a33d68`,
  observation digest
  `sha256:22287b7a3d441a0573282fb748650a88bcf9afc49789170bfd9de8311843207a`
  and scorecard digest
  `sha256:9e04b3d40480f3785659fd5ad81e081561bb283d40c1530c3ef7f2ea4715c198`.
  All three files parse canonically, remain 0600 under the ignored private
  root and contain no credential or raw-material markers; the scorecard keeps
  `empiricalLiveEvidence=true` and `efficacyClaim=none`.

  OpenRouter's key page still displayed its earlier USD 2.4886 total after
  v20/v21, so final budget reporting uses the more conservative known ledger:
  at least USD 3.5235 cumulative including the provider-reported v20 and v21
  costs, leaving at most approximately USD 4.4765 under the USD 8.00 key
  limit. No further provider call, retry, fallback, parallel work,
  calibration or confirmatory campaign followed. B112 remains open for the
  broader efficacy program and CSP-11 remains `impl` with `gap=true`. No
  public D663 adapter, Another Hello, database/store, Rust/Python, Demo/UI/web,
  Graph topology, protocol, spec or conformance surface entered this slice.

- 2026-07-29 the user-approved continuation toward a complete first-task smoke
  produced two further sanitized live generations and exposed the remaining
  boundary as actor-turn semantics rather than provider, route, credential or
  byte transport failure. V17 raised the frozen agent-run and route request
  ceilings from four to eight, aligned the static task-model/campaign request
  coverage at 48 for the cold plus five warm-arm manifest invariant, and
  retained one first-task / one-cold-block execution with no retry, fallback,
  parallel call or campaign continuation. The exact-five qualification
  remained 5/5 with qualification-report digest
  `sha256:0d115c535bf05726b08c64745cc5e95330464c3177768d8bd8a7371e2b3c0407`
  and manifest digest
  `sha256:3f9d5e60e7cf35e2e25096892a9fd61bf56a05a2b1186408d9981d0db9d35bb5`.

  V17 completed five accepted direct OpenAI requests before the sixth request
  was rejected pre-transport solely by the bounded input-token reservation:
  prospective 156,155 tokens exceeded the 150,000-token route ceiling while
  prospective cost 993,979 microusd remained below the 1,200,000-microusd
  cap. Provider usage for the five accepted requests was 54,817 input tokens,
  375 output tokens and 352,936 microusd. The generation digest is
  `sha256:6ec683346f2835dcf62165eb0d72c707990d53f9ac64cc0196099f3aeb6de20c`,
  observation digest
  `sha256:b36dc39e3520098b18df54fbdf1cf4491763426ccd52670ba2186ea965cf23d4`,
  and scorecard digest
  `sha256:18fb14fd2a0171ca6bd6596a00f38507becc732f4392b04160579bf726f8c149`.

  V18 minimally raised only the aggregate input-token ceiling to 200,000.
  Its exact-five qualification again remained 5/5 with report digest
  `sha256:e7c0064a80e5817b5f3f314354383af8d7135642108561b4ae92269cc8b99827`
  and manifest digest
  `sha256:30db2e5c18548aaab21ba8bb6a2f8f6dd4d9380b28026379d2cee62614dc1967`.
  Mandatory injected no-network preflight passed 69/69 tests before each live
  dispatch. All eight v18 requests passed admission, were accepted by
  OpenRouter, proved the exact direct OpenAI shared-capacity route, and
  produced eight protection receipts; the bounded admission diagnostic was
  null. Provider usage was 107,560 input tokens, 658 output tokens,
  689,952 microusd and 24,948 ms.

  Every v18 provider outcome nevertheless ended in `tool_calls`; no structured
  final output was returned by the eighth frozen turn, so the host correctly
  emitted `agent-step-budget-exhausted` and did not invoke the verifier. The
  generation digest is
  `sha256:30e674dd7e9317e58277ede4ae3c1c7a339d949799788bf38b958f4941432ea3`,
  observation digest
  `sha256:c7619fed56946f72f9b1d2b113656a64baf540d8de4bddd2ec8540d1649f5c2f`,
  and scorecard digest
  `sha256:7787b81bd9675dbf4acf3b7b1d95daeecad4543f3228222358e90404830c8678`.
  Files remain 0600 under the 0700 ignored private root and both scorecards
  retain `efficacyClaim=none`.

  Read-only control-plane observation after v18 showed approximately USD 1.96
  used of the user-approved no-reset USD 3.00 total key limit. More turns are
  not an unbounded continuation option: D659 explicitly locks each protected
  tool result to only the next explicit model turn, while the focused binding
  is stateless. Adding a cumulative tool transcript, step-aware continuation
  prompt or provider conversation state would change the locked actor-turn
  flow and request lowering rather than fix a budget or transport bug. Per the
  user's architecture-fork stop condition, no such change, new D-number or
  further charged block was made autonomously. B112 remains open and CSP-11
  remains `impl` with `gap=true`; the live transport, credential, zero-BYOK,
  route, accounting and private persistence slices are proven, but a
  verifier-complete smoke and any efficacy claim remain absent. No public
  D663 adapter, real campaign, Another Hello, store, Rust/Python, Demo, UI,
  web, Graph topology, protocol, spec or conformance surface entered this
  continuation.

- 2026-07-29 the explicitly approved diagnostic replacement smoke v3
  executed exactly one first-task / one-attempted-block OpenRouter HTTP
  request under the unchanged USD 0.75 hard cap, with no retry, fallback,
  parallel call or automatic continuation. Before dispatch, the private
  exact-five qualification was regenerated against
  `graphrefly-openrouter-responses-wire.v3`: all five observations remained
  qualified, the qualification-report digest became
  `sha256:d18144b5a8f6d2e7de15e67a362d3abec63e1c805707602b539b886131838874`,
  and the frozen manifest digest became
  `sha256:1c8450a66e10ea4d1cbdf61494984e596d68bf68a5ac58efe380acbdf4a7d79e`.
  The live route used qualification revision
  `b112-openrouter-first-task-live-route.2026-07-29.v2` and approval revision
  `b112-replacement-smoke-budget-approval.2026-07-29.v3`.

  The sanitized atomic generation is again `non-evaluable`: one request,
  one step, 3,533 host input bytes, zero host output bytes, 352 ms latency,
  no provider token usage, no accepted route evidence, verifier not run,
  and issues `model-turn-non-evaluable`, `openrouter-http-status:404` and
  `openrouter-request-rejected`. The response carried no recognized
  canonical `error_type` or Responses `error.code`, so the evidence narrows
  the failure to HTTP 404 but does not justify claiming model-not-found,
  endpoint-not-found or a specific Responses compatibility cause. The
  persisted 99,585 microusd remains the conservative reservation for 7,629
  input and 2,048 output tokens, not measured provider spend.

  Immediately before dispatch, a fresh read-only control-plane check showed
  the complete GraphReFly BYOK provider list unconfigured and `Local Eval 2`
  at zero usage, Last Used `Never`, and zero of its no-reset USD 0.75 limit.
  After the attempt, the key still showed `$0.000`, Last Used `Never` and 0%
  of USD 0.75, while the key-filtered OpenRouter upstream-request log
  remained empty. Thus the local transport records one rejected HTTP request
  while the OpenRouter control plane records no admitted transaction and no
  charge. This out-of-band UI observation is narrative operator evidence,
  not a sanitized control-plane attestation hash-bound into the v3 generation,
  and it does not claim independent reconstruction or protection against
  later workspace drift. Approval was immediately relocked; no subsequent
  request was made.

  The v3 generation digest is
  `sha256:9164866cf8ef6dbb35b2e451d97b7044865c04fdb8238c0b37e463d6bf5a6ff2`;
  observation digest
  `sha256:c3712aed6886936634b535998f8f870178beae49f5b8eaa213ead1fddc4960a1`;
  and scorecard digest
  `sha256:dcb8ec22dac9937e58ef34e2bd92dadfea0f09ad9bb2529913789cd92aac6de2`.
  Files remain 0600 under the 0700 gitignored private root, credential and
  forbidden-material scans are empty, and the scorecard still carries
  `efficacyClaim=none`. B112 remains open and CSP-11 remains `impl` with
  `gap=true`. Any further provider diagnostic requires a new explicit
  approval and generation coordinate; no public D663 adapter, real campaign,
  Another Hello, store, Rust/Python, Demo, UI, web, Graph topology, protocol,
  spec or conformance surface entered this slice.

- 2026-07-29 the explicitly approved B112 replacement smoke sequence reached
  the live OpenRouter shared-capacity route and separated provider/network
  success from two independent local host bounds. The v15 block completed
  three accepted `openai/gpt-5.6-sol` requests through downstream OpenAI with
  no BYOK, fallback, alternate model, plugin or parallel call. Provider usage
  was 27,538 input tokens, 235 output tokens and 177,142 microusd. A fourth
  model turn was rejected before byte transport by the monotonic smoke
  admission gate, so the atomic observation was bounded non-evaluable and
  the verifier did not run. No provider or office-network rejection occurred.

  TS commit `d59b6ba1` then added a package-private, non-persisted admission
  diagnostic that reports only a fixed seven-reason allowlist plus bounded
  request/step/byte/token/cost integers. It preserves the prior admission
  predicates and control flow and excludes the diagnostic from the trial
  observation, campaign scorecard and all three atomic private generation
  files. It does not expose credential, environment, provider body, hidden
  verifier material or raw stdout/stderr and changes no package root,
  adapters aggregate, subpath, tsup entry or public D663 surface. Full QA
  passed 130 test files and 2,027 tests with four intentional skips, lint,
  raw-async and typecheck gates, ESM/CJS/DTS build and export smoke, topology,
  privacy, diff and dashboard gates; two independent static reviews reported
  no findings.

  For the explicitly approved v16 block, the operator changed only the
  dedicated `Local Eval 2` control-plane total limit to USD 3.00 with no
  reset, re-observed all 64 workspace BYOK providers as unconfigured, and
  froze a 950,000-microusd per-block hard cap. The regenerated exact-five
  qualification remained 5/5 with zero issues; its task-catalog digest was
  `sha256:14eed1802f6e3d0e782a5b77c7c0b1ebbaa17f7e80b79288759b7ae8f02beddc`,
  qualification-report digest
  `sha256:9d0795bc41523757bd8df895f4081e7a123f9e6da0649637fe6f1ef546b2ad64`,
  and live manifest digest
  `sha256:5e5cf200fc7c6c654fae4d4289ddb98b8ab4f23e7d974b6ce684b7d77507916c`.
  The injected-transport, closed-host, verifier, observation/scorecard and
  atomic-persistence preflight passed 69/69 focused tests before dispatch.

  V16 then executed exactly one first-task / one-attempted-block run. All four
  allowed requests were accepted by OpenRouter, routed to OpenAI and charged
  as provider usage; the admission diagnostic was null. Every response ended
  in `tool_calls`, however, so no structured final output was produced before
  the frozen D652 host `agentRun.maxRequests=4` boundary. The persisted result
  is therefore `non-evaluable` with issue `agent-step-budget-exhausted`,
  verifier not run, four requests/four steps, 53,695 input tokens, 288 output
  tokens, 208,946 host input bytes, 1,253 host output bytes, 15,230 ms latency
  and 343,317 microusd provider cost. The generation digest is
  `sha256:583c7f679f13e4c3fa081aa4c75a9cd8fe4aa40d75a609af47373fc1ccaad738`,
  observation digest
  `sha256:668e68ab300c222d281c4f1e87e75846f05b4ba105035074a7196c4c9692765b`,
  and scorecard digest
  `sha256:914409992ca42e87c5831f2d86dc1e8bdf5fc5dbbd0045a6a0580f66d763df78`.
  Files remain 0600 beneath the 0700 gitignored private root and the scorecard
  retains `efficacyClaim=none`.

  This proves the byte transport, credential, zero-BYOK, exact route, provider
  accounting, sanitized observation/scorecard and atomic private persistence
  slices under live execution, but it is not an AgenticMemory efficacy result.
  Raising the model-turn count would change the frozen D652 host budget and
  the user-declared eval flow, so it was not done autonomously; no additional
  provider request or automatic replacement block followed v16. B112 remains
  open and CSP-11 remains `impl` with `gap=true`. No public D663 adapter, real
  campaign, Another Hello, store, Rust/Python, Demo, UI, web, Graph topology,
  protocol, spec or conformance surface entered this slice.

- 2026-07-30 the user-approved B112 D669 model-profile change completed in
  graphrefly-ts commit `1148c53e` without changing the eval structure. The
  package-private OpenRouter Responses binding now derives frozen reasoning
  effort and supports an exact `z-ai/glm-5.2` high profile pinned to downstream
  `decart/fp4` / Decart shared capacity. Binding revision
  `graphrefly-openrouter-responses-wire.v8` sends `require_parameters=true`,
  omits the unsupported `parallel_tool_calls` parameter, and retains one
  request per invocation with no BYOK, retry, fallback, alternate model,
  plugin, transform, parallel provider call or SDK/client dependency. The
  smoke runner fail-closes before transport unless the complete profile tuple
  matches GLM high, the exact downstream provider, official endpoint pricing
  source/revision and frozen USD 0.60/M input plus USD 1.25/M output rates;
  the historical GPT-5.6 Sol medium tuple remains separately exact.

  The operator-private exact-five qualification was regenerated for GLM high:
  five of five tasks qualified with zero issues, task-catalog digest
  `sha256:14eed1802f6e3d0e782a5b77c7c0b1ebbaa17f7e80b79288759b7ae8f02beddc`,
  qualification-report digest
  `sha256:a8530e6e7585b45b59c37803fcb56f70e225dc2c238fe5757d77d6cb0640c487`,
  and frozen manifest digest
  `sha256:5f1e4051b73f2c58c23782f8e9594cce787a61b3d8c9337182500763fe3975bc`.
  The complete no-network matched-block dry run exercised the failed cold run,
  all five fresh warm arms, eight injected provider turns, the closed host and
  verifier, empirical observation/scorecard v2, and 0600 atomic private
  persistence. Provider/rate substitution and GLM medium effort both fail
  before transport. Two independent QA reviews found and closed the exact
  pricing/downstream and exact reasoning-effort gaps, then reported no
  remaining findings. Final gates passed 130 test files and 2,036 tests with
  four intentional skips, lint/typecheck/raw-async, 8192 MiB
  ESM/CJS/DTS/export build, public topology, privacy, diff and dashboard
  checks.

  No GLM provider request or charge occurred in this slice. The ignored
  operator input remains non-dispatchable pending a fresh same-credential
  `Local Eval 2` zero-BYOK/shared-capacity observation, exact GLM budget
  approval and new live generation coordinates. The scripted positive
  comparison remains contract evidence only: live efficacy is not established
  and any smoke scorecard must retain `efficacyClaim=none`. B112 remains open
  and CSP-11 remains `impl` with `gap=true`; no public D663 adapter, real
  campaign, Another Hello, database/store, Rust/Python, Demo, UI, web, Graph
  topology, protocol, spec or conformance surface entered this slice.

- 2026-07-30 D672 locks B112's next GLM-5.2 route as the exact OpenRouter
  DeepInfra fp4 profile at the frozen official USD 0.75/M input and USD 2.40/M
  output pricing. Before a matched block, one operator-private first-turn
  capability probe may send `tool_choice=required` plus
  `parallel_tool_calls=false` with one request, no retry/fallback/parallel call
  and a USD 0.02 hard cap. Because OpenRouter's published DeepInfra parameter
  list does not claim `parallel_tool_calls`, rejection or any result other than
  exactly one native tool intent fails closed before the matched block. Probe
  output is mechanical integration evidence only and never empirical/efficacy
  evidence. After probe success and fresh same-credential zero-BYOK
  qualification, only the already-approved first-task matched block may run
  under USD 1.00 and D671 same-route retry; D659 flow, tools, verifier, baseline
  and D626-D627 efficacy criteria stay unchanged. No public
  adapter/registry/export, Graph/protocol/conformance, cross-language, Demo, UI
  or store surface is introduced.

- 2026-07-30 the user-approved B112 GLM-5.2 high v1 operator sequence
  configured the dedicated GraphReFly `Local Eval 2` key to a no-reset USD
  18.00 total limit and froze a USD 1.00 matched-block hard cap. A fresh
  out-of-band read-only qualification observed all 64 OpenRouter BYOK
  provider entries unconfigured, `byokCredentialCount=0`, and the same
  credential/workspace revision used by the live input. The regenerated
  exact-five qualification remained 5/5 with zero issues: task-catalog digest
  `sha256:14eed1802f6e3d0e782a5b77c7c0b1ebbaa17f7e80b79288759b7ae8f02beddc`,
  qualification-report digest
  `sha256:4a060c2bb4f57b8a1adc17fe94bffc206d97213619de2fb76e598f4ff471e059`,
  and frozen live-manifest digest
  `sha256:27669339be0167973d8ec416d3feb853c364e68aa882990ef56396741aabb676`.
  The injected byte-transport, closed-host, bounded tool, verifier,
  observation/scorecard and atomic-private-persistence preflight passed 68/68
  focused no-network tests. An initial v1 operator attempt failed before
  transport on a stale credential-binding revision and produced no generation;
  the coordinate was corrected and the unused route, budget and generation
  approvals were advanced to v2 before dispatch.

  V2 executed exactly one first-task / one-attempted-block request with no
  retry, fallback, alternate model or parallel call. The local byte transport
  reached OpenRouter and received HTTP 404 after 316 ms, but produced no model
  bytes, provider-scoped usage, accepted route evidence or verifier run. The
  sanitized observation is bounded `non-evaluable` with issues
  `model-turn-non-evaluable`, `openrouter-http-status:404`, and
  `openrouter-request-rejected`; its 3,186-microusd value is a conservative
  pre-dispatch reservation for 4,776 input plus 256 output tokens, not measured
  provider spend. OpenRouter's key-filtered Generations and Upstream Requests
  views contained no GLM/Decart transaction, and the key detail remained
  exactly USD 7.6710 total usage, USD 4.1475 today, Last Used 16 hours ago and
  USD 18.00 no-reset limit after the attempt. This is narrative operator
  evidence that the router rejected the request before upstream admission and
  did not charge it; it is not a hash-bound management attestation and makes no
  claim against later workspace drift.

  Official OpenRouter documentation presents Chat Completions as the standard
  model endpoint, while the separately documented Responses API remains beta.
  Together with the absent upstream transaction, the narrow current inference
  is that the exact GLM-5.2/Decart profile is not accepted through the existing
  Responses wire route. The raw 404 body was not persisted and the evidence
  does not establish a more specific router cause. Under D669, changing request
  lowering or response parsing requires a new binding revision; a second live
  request was therefore not made under the one-block approval.

  The atomic 0600 private generation digest is
  `sha256:c8462c4ecd28760e11556fde0a7246ff019cb7e1ea6216d9aaead89ffd5ec37d`;
  observation digest
  `sha256:b02158be7982cb3e1e8a4878afb13db4dada9355e4d8be717ab823d649b2b56d`;
  and scorecard digest
  `sha256:2410ad3bf54769d6f7229bdfb45c68715883d7b9d59af31516d07a2f232fe21e`.
  Approval was immediately relocked. The scorecard retains
  `efficacyClaim=none`; B112 remains open and CSP-11 remains `impl` with
  `gap=true` pending a separately approved package-private Chat Completions
  binding revision and replacement matched block. No public D663 adapter,
  larger/confirmatory campaign, Another Hello, database/store, Rust/Python,
  Demo, UI, web, Graph topology, protocol, spec or conformance surface entered
  this slice.

- 2026-07-30 graphrefly-ts commit `2ce51d7d` completed the package-private
  D669 repair for the GLM-5.2 high route without changing the D652 semantic
  model-turn port, D659 closed host, verifier, observation/scorecard or
  persistence structure. The exact GLM/Decart profile now uses OpenRouter Chat
  Completions endpoint revision `openrouter-chat-completions-2026-07-30.v1`,
  adapter revision `graphrefly-openrouter-chat-completions-turn.v1` and binding
  revision `graphrefly-openrouter-chat-completions-wire.v9`. The historical
  GPT-5.6 Sol/OpenAI route remains on its separately exact Responses v8
  profile; arbitrary endpoints and generic OpenAI-compatible provider
  registration remain rejected.

  The Chat binding lowers the same protected canonical user envelope into one
  system plus one user message, preserves the exact frozen model, provider,
  high-reasoning, tool and strict structured-output coordinates, and accepts
  only one bounded non-streaming response with direct one-attempt,
  non-BYOK route evidence. It adds no SDK/client dependency, retry, fallback,
  alternate model, timer, scheduler, queue or parallel provider call.
  Credential lookup remains outside the binding in the operator runner. The
  shared fetch byte transport allowlists only the exact Responses and Chat
  endpoints and retains redirect rejection, caller cancellation and bounded
  response bytes.

  OpenRouter's official accounting defines reasoning tokens as a subset of
  completion tokens. The new Chat parser therefore records
  `outputTokens=completion_tokens`, strictly bounds an optional
  `completion_tokens_details.reasoning_tokens`, rejects reasoning greater than
  completion, and rejects any
  `total_tokens != prompt_tokens + completion_tokens` response. This prevents
  both hidden-usage acceptance and reasoning-token double counting before
  observation or scorecard construction.

  The final operator-private exact-five qualification remained 5/5 with zero
  issues: task-catalog digest
  `sha256:14eed1802f6e3d0e782a5b77c7c0b1ebbaa17f7e80b79288759b7ae8f02beddc`,
  qualification-report digest
  `sha256:8aff5c0ba8c716cfd6899930fa148313290c89fa73f33080fb875c3f7f7f83d9`,
  and frozen manifest digest
  `sha256:859bf644c15f387ea0f7ae2a1d942c7bd123df8044e6dc74fb63326204d757d7`.
  The no-network matched dry run exercised Chat request/response fixtures,
  closed host turns, bounded tools, verifier, action trace, observation,
  deterministic scorecard and atomic 0600 private persistence. It also proved
  request/step/cost bad-loop bounds, unexpected-request rejection, no
  retry/fallback, credential-sentinel exclusion and atomic persistence
  failure handling. Simulated usage remains contract evidence only.

  Final QA passed 130 test files and 2,039 tests with four intentional skips,
  lint/typecheck/raw-async, 8192 MiB ESM/CJS/DTS/export build, package topology,
  timer/retry/fallback, privacy, 0600 mode, diff and dashboard gates. Two
  independent final static reviews reported no findings; one intermediate
  usage-accounting concern was corrected against OpenRouter's official
  definition and independently re-reviewed.

  The v3 operator input remains approval-locked and no second GLM provider
  request or charge occurred. The prior one-block approval was consumed by the
  v2 router rejection, so v3 requires a fresh same-credential zero-BYOK
  observation and a new explicit one-block approval before dispatch. A smoke
  still cannot establish AgenticMemory efficacy and must retain
  `efficacyClaim=none`. B112 remains open and CSP-11 remains `impl` with
  `gap=true`; no public D663 adapter, real campaign, Another Hello,
  database/store, Rust/Python, Demo, UI, web, Graph topology, protocol, spec or
  conformance surface entered this slice.

- 2026-07-30 the explicitly approved B112 GLM-5.2 high Chat v9 replacement
  v3 performed one and only one first-task matched-block attempt. Immediately
  before dispatch, the operator re-observed the dedicated `Local Eval 2` key
  at USD 18.00 total with no reset, approximately USD 7.67 used and more than
  the USD 1.00 block cap remaining. OpenRouter's expanded BYOK list contained
  65 providers, all unconfigured, so the fresh shared-capacity observation
  remained `qualified=true`, `capacityMode=openrouter-shared-only` and
  `byokCredentialCount=0`; it does not claim protection against later
  workspace drift. The regenerated exact-five qualification remained 5/5
  with zero issues: task-catalog digest
  `sha256:14eed1802f6e3d0e782a5b77c7c0b1ebbaa17f7e80b79288759b7ae8f02beddc`,
  qualification-report digest
  `sha256:603790d9a598e06f5fe4f893cfed692f388a57d133f0d0df2fff12d1f0601bda`,
  and frozen manifest digest
  `sha256:6e5668425427a81facb8a350e94fea2586d21160d610a981160b7941fa7ae335`.

  V3 reached OpenRouter through the exact Chat endpoint but again received
  HTTP 404 before any generation or upstream request. The atomic 0600
  observation is bounded `non-evaluable` with issues
  `model-turn-non-evaluable`, `openrouter-http-status:404` and
  `openrouter-request-rejected`; verifier and warm branches did not run.
  It records one request/step, 3,790 host-input bytes, zero host-output bytes,
  491 ms latency, and a 3,209-microusd conservative reservation for 4,814
  input plus 256 output tokens. Provider token usage and provider cost remain
  null. The generation digest is
  `sha256:b06b5849e6044ffa1da2f146597c62f3a58f6d2eb5b11d08de1a0abafc261c24`,
  observation digest
  `sha256:fa6afd89806347b50ca898549c1a0c69d3279e9cba28ceb74106e0fd0b93f168`,
  and scorecard digest
  `sha256:7b4e02ff0e5a82a52247a5520c6a1c3a4fe17a85488ff7f56a2671ff4b16c2c7`.

  The key's last-used time and approximately USD 7.67 usage remained
  unchanged after the request, and no GLM generation appeared in the
  workspace logs. Official endpoint metadata still listed healthy
  `z-ai/glm-5.2` Decart `decart/fp4` capacity with the frozen pricing and
  required parameters. The remaining control-plane mismatch is that the
  guardrail currently assigned to `Local Eval 2` is an Only-Allow policy for
  the Z.ai provider and GLM 5.2 model, while D669 and the request require the
  distinct Decart provider exclusively. This is the narrow leading inference
  for the router-level 404; the sanitized evidence does not contain the raw
  body and therefore does not claim a confirmed provider error string.

  No second request, retry, fallback or parallel call followed. The used v3
  coordinate was advanced to an approval-locked v4 private input. Resolving
  the external guardrail conflict requires an explicit choice between
  broadening the shared guardrail (which also affects another key) or assigning
  a dedicated Decart-only GLM guardrail to `Local Eval 2`; it was not changed
  autonomously. The scorecard retains `efficacyClaim=none`, B112 remains open,
  and CSP-11 remains `impl` with `gap=true`. No public D663 adapter, larger
  campaign, Another Hello, database/store, Rust/Python, Demo, UI, web, Graph
  topology, protocol, spec or conformance surface entered this slice.

- 2026-07-30 D672 implementation landed in graphrefly-ts commit `55c7ce87`
  as a package-private, non-persisted DeepInfra fp4 mechanical capability
  probe plus exact matched-block admission gates. The prior Decart route
  profile remains separately named and priced; only the exact DeepInfra
  profile receives `parallel_tool_calls=false`. The probe is restricted to
  the preregistered first cold task, a non-final step-zero request, one
  admitted request, USD 0.02, `tool_choice=required`, no retry, fallback or
  parallel call, and `efficacyClaim=none`. Post-load validation and credential
  failures clean the materialized workspace before returning.

  The operator assigned the dedicated `Local Eval 2` key to an Only-Allow
  GLM 5.2 / DeepInfra guardrail, retained its USD 18.00 no-reset total limit,
  and re-observed 65 BYOK providers all unconfigured. The regenerated
  exact-five qualification remained 5/5 with zero issues: task-catalog digest
  `sha256:14eed1802f6e3d0e782a5b77c7c0b1ebbaa17f7e80b79288759b7ae8f02beddc`,
  qualification-report digest
  `sha256:1c7e2113daaffffd5fda0c7ff75932ee2a11bf9da6834f60945d8a00ebec5136`,
  and frozen manifest digest
  `sha256:61aa31385f1b67d8f42464939a7bc7b9a44a092ad8a3f9c43489ec1ec7cfca54`.

  The explicitly approved live mechanical probe sent exactly one request and
  returned bounded `capable=false`, `status=non-evaluable`, requests=1,
  provider cost null, and issue codes `openrouter-http-status:404` plus
  `openrouter-request-rejected`. No matched block, verifier, observation,
  scorecard, persistence, retry, fallback or second provider request followed.
  This is consistent with OpenRouter's official DeepInfra endpoint metadata
  not declaring `parallel_tool_calls` while the exact D672 probe requires that
  parameter and `require_parameters=true`; it is route-capability rejection,
  not AgenticMemory efficacy evidence.

  Final QA passed 130 test files and 2,048 tests with four intentional skips,
  focused DeepInfra/Decart route tests, lint/typecheck/raw-async, the 8192 MiB
  ESM/CJS/DTS/export build, package topology, credential/private-material,
  retry/fallback/parallel, diff and dashboard gates. Two independent final
  reviews reported no remaining code blocker. B112 remains open and CSP-11
  remains `impl` with `gap=true`; progressing the matched block now requires
  a new explicit architecture choice because exact-one nonparallel tool-call
  proof is unavailable on this published route. No public D663 adapter,
  efficacy campaign, Another Hello, database/store, Rust/Python, Demo, UI,
  web, Graph topology, protocol, spec or conformance surface entered this
  slice.

- 2026-07-30 D673 supersedes D672 only for the exact DeepInfra request
  lowering. The package-private OpenRouter Chat Completions wire revision
  omits `parallel_tool_calls`, because the endpoint advertises `tools`,
  `tool_choice` and `reasoning_effort` but not that parameter, while
  `require_parameters=true` remains fail-closed. This does not assert that
  DeepInfra produces only one tool call. On every non-final turn, the
  unchanged semantic validator and D659 host admit exactly one valid native
  tool intent before execution; zero, direct-output, multiple, malformed or
  unqualified outcomes are non-evaluable and execute no tool. The approved
  USD 0.02 one-request probe may be rerun with no retry/fallback/parallel
  request; only probe success plus fresh D661 zero-BYOK qualification admits
  the unchanged USD 1.00 first-task matched block. Eval structure, route,
  budgets, D671 retry, verifier, persistence and D626-D627 efficacy criteria
  remain unchanged. No public D663 adapter, registry/export, Graph,
  protocol/spec/conformance, cross-language, Demo, UI or store surface is
  introduced.

- 2026-07-30 D673 implementation landed in graphrefly-ts commit `24f35fc2`.
  OpenRouter Chat wire v15 omits the unsupported DeepInfra
  `parallel_tool_calls` parameter while retaining `require_parameters=true`,
  exact model/provider routing, response-side exactly-one tool-intent
  validation and pre-tool fail-closed behavior. Exact-five offline
  qualification remained 5/5 with zero issues: task-catalog digest
  `sha256:7ed25de6186ee31394b21115950278caf3b425e585018250addda33b139c19dc`,
  qualification-report digest
  `sha256:7763f4b4ec096828cd7705a0d03ca0718de9c173e537114df48fd677d3ae62d5`,
  and frozen manifest digest
  `sha256:1844fc56c4e5f3795bea6b1dbb4833862cf8cc8bf21824042f60bed9b93daebd`.
  Fresh official metadata still reported healthy DeepInfra fp4 at USD
  0.75/M input and USD 2.40/M output with tools, tool_choice and
  reasoning_effort but not parallel_tool_calls. Fresh control-plane checks
  retained the dedicated Local Eval 2 DeepInfra-only guardrail, USD 18.00
  no-reset total key limit and 65/65 BYOK providers unconfigured.

  The approved one-request capability probe succeeded with
  `capable=true`, exactly one native tool intent, zero issues and
  856 microusd provider cost. It remained non-persisted
  mechanical-capability evidence with `efficacyClaim=none`. The subsequently
  approved first-task matched block then executed the cold host for six
  serial requests/steps with no retry wait, fallback or parallel request.
  Its first five turns each produced one accepted read-file action; turn six
  was bounded `non-evaluable` as
  `openrouter-invalid-unsupported-response`, before verifier or warm-arm
  execution. The provider-usage total was 148,309 input tokens, 668 output
  tokens, 59,550 microusd and 23,608 ms. This is integration failure
  evidence, not negative AgenticMemory efficacy evidence.

  Atomic 0600 private persistence succeeded with generation digest
  `sha256:4844899cbad57192676c4fa53cb70f9a7f3f33b0e1750cfc22a60e7a87358f25`,
  observation digest
  `sha256:701c35dbe767de5b42fe9e1066c96e62b2ca6b3a347a5bb40c852097213e866d`,
  and scorecard digest
  `sha256:a737c87404e82848afdbd4febc1879ce6972ea1cd8effe4f84f14977dc6ab343`.
  Final gates passed 2,048 package tests with four intentional skips, focused
  85/85 transport/host/evidence tests, lint/typecheck/raw-async, ESM/CJS/DTS
  build/export, boundary/privacy scans, diff and dashboard checks. Two
  independent QA reviewers found no semantic blocker after one formatting
  fix. B112 remains open and CSP-11 remains `impl` with `gap=true`; no efficacy
  claim is available because the cold run never reached the verifier and no
  warm arm was attempted. A replacement matched block would require separate
  approval after choosing whether to keep strict response-side rejection,
  change the route/model, or separately design a different sequentialization
  boundary. No public D663 adapter, real larger campaign, Another Hello,
  database/store, Rust/Python, Demo, UI, web, Graph topology, protocol, spec or
  conformance surface entered this slice.

- 2026-07-31 graphrefly-ts commit `d2064065` added package-private, bounded
  OpenRouter Chat response diagnostics for the D673/B112 integration-failure
  boundary. The existing `openrouter-invalid-unsupported-response` umbrella
  remains the stable failure class; one fixed allowlisted subtype now
  distinguishes invalid envelope/usage/choice/message/finish shape,
  final/non-final turn-contract conflict, zero/multiple/malformed tool calls,
  unknown tool name, invalid call id/arguments, and post-parse validation
  failure. The subtype flows through the existing bounded `issueCodes` seam
  into sanitized observation, scorecard and atomic 0600 private persistence;
  no raw provider body, tool-call material, credential, stdout/stderr, hidden
  verifier material or expected patch is retained.

  Validated provider usage and cost remain attached when a later response
  check fails, and multiple tool calls are classified before individual call
  parsing so malformed later calls cannot mask the cardinality failure. The
  taxonomy is Chat-only and does not change the Responses endpoint, eval
  structure, retry/fallback/parallel policy, verifier, budgets, efficacy
  criteria, schemas or public exports. Injected-byte integration evidence
  proved one request, non-evaluable classification, canonical
  observation/scorecard propagation, sanitized atomic persistence and secret
  sentinel absence without a network call.

  Final QA passed 130 test files and 2,049 tests with four intentional skips,
  focused binding/persistence tests, lint/typecheck/raw-async, the 8192 MiB
  ESM/CJS/DTS/export build, package topology, privacy/risk scans, diff and
  dashboard gates. Independent final review reported no finding. B112 remains
  open and CSP-11 remains `impl` with `gap=true`; this diagnostics slice makes
  the next provider rejection attributable but is not an efficacy claim and
  did not execute another paid request. No public D663 adapter, new campaign,
  Another Hello, database/store, Rust/Python, Demo, UI, web, Graph topology,
  protocol, spec or conformance surface entered this slice.

- 2026-07-31 the explicitly approved B112 DeepInfra GLM-5.2 high replacement
  generation `b112-glm-5.2-deepinfra-live-smoke-2026-07-31-v1` ran under the
  unchanged USD 1.00 hard cap after a fresh read-only D661 control-plane
  recheck. The exact `B112 GLM 5.2 DeepInfra` guardrail still allowed only
  DeepInfra plus GLM 5.2, all 65 BYOK providers remained unconfigured, and
  Local Eval 2 retained its USD 18.00 no-reset total limit with conservatively
  recorded remaining capacity of 10,249,958 microusd. The same frozen
  credential ref/revision was used; no credential material entered output or
  persistence, and no post-observation workspace-drift prevention is claimed.

  The cold host made four serial requests/steps with no retry wait, fallback,
  alternate route, parallel or background call. The first three responses
  each produced one admitted `read-file` action. On step index 3 the route
  returned multiple native tool calls; the unchanged exactly-one gate rejected
  the turn before executing either call and persisted
  `openrouter-response-tool-call-count-multiple` beneath the stable
  `openrouter-invalid-unsupported-response` umbrella. The result was bounded
  `non-evaluable`, with four requests, three executed actions, 87,701 input
  tokens, 729 output tokens, 88,430 total tokens, 50,856 microusd provider
  cost and 17,469 ms aggregate latency. The verifier did not run, no warm arm
  was attempted, `familyPassed` remained null and `efficacyClaim` remained
  `none`. This proves working network/provider integration and identifies an
  exact sequential-tool contract failure; it is neither negative nor positive
  AgenticMemory efficacy evidence.

  Atomic sanitized 0600 persistence succeeded with generation digest
  `sha256:6941ce99c6e160cc5556fbce5dab4b3716e6cf22ea5b1a7c5f934fe7abd3e6f1`,
  observation digest
  `sha256:24cccbb092c896c39d30239c6fc3410a5a56fc5a2d3a7c8784c87f4f0431156f`,
  and scorecard digest
  `sha256:3cffd39f5ba98e9898937579cc9e857decba267812a42e4b873ad778fcf95550`.
  Permission, forbidden-material, workspace-cleanup, generation-ownership and
  repository-status checks passed. B112 remains open and CSP-11 remains
  `impl` with `gap=true`; another paid replacement or any change to the
  sequential host invariant requires a separate explicit choice and approval.
  No public D663 adapter, efficacy campaign, Another Hello, database/store,
  Rust/Python, Demo, UI, web, Graph topology, protocol, spec or conformance
  surface entered this slice.

- 2026-07-31 D674 supersedes D673's response-side exactly-one narrowing for
  the exact B112 DeepInfra GLM-5.2 Chat route. The package-private Chat
  binding restores D652's bounded one-or-more semantic outcome: one through
  64 native tool calls may be admitted only when the complete batch has
  unique ids, declared tool names, strict bounded arguments, route/usage
  evidence and D656 protection evidence. Zero, direct non-final output,
  malformed, duplicate, unknown, invalid, unqualified, byte-overflow or
  token-overflow responses remain bounded non-evaluable.

  D659 remains the execution authority. It rejects 17 or more intents before
  action one, then applies existing action/result budgets and executes an
  admitted batch of at most 16 in provider-declared order, serially, before
  one explicit next model turn. This ordered execution is intentionally not
  transactional: a later intent failure does not undo an already-completed
  earlier tool action. Multiple calls in one response are not multiple HTTP
  requests and do not authorize parallel provider calls, hidden scheduling,
  retry, fallback, alternate routing or provider switching. The mechanical
  capability probe now requires any nonempty bounded valid list and remains
  non-empirical contract evidence only.

  Fresh same-credential D661 zero-BYOK qualification and the approved USD
  1.00 first-task matched-block cap remain mandatory. Observation,
  scorecard, persistence, privacy, verifier and D626-D627 efficacy boundaries
  are unchanged. No public D663 adapter, package export, provider registry,
  WorkItem lifecycle change, Graph topology, protocol/spec/conformance,
  cross-language runtime, Demo, UI or store is introduced; production-path
  WorkItem dogfooding remains a separate future integration slice.

- 2026-07-31 D674 implementation advanced only the package-private OpenRouter
  Chat binding to `graphrefly-openrouter-chat-completions-wire.v16`, restored
  bounded multiple-intent admission, and added focused boundary evidence for
  64/65 binding intents plus D659's 17-intent pre-execution rejection, ordinary
  multi-intent ordered serial state visibility, and non-transactional
  later-action failure. The
  exact package root, adapters aggregate, export map and build-entry topology
  remain unchanged.

  After the frozen five-task qualification was regenerated for the revised
  binding, one non-persisted live mechanical probe completed with one request,
  one admitted tool intent and 952 microusd provider-reported cost. The
  separately approved first-task matched block then ran once as private
  generation `b112-glm-5.2-deepinfra-live-smoke-2026-07-31-v2`. The cold arm
  completed three ordered `read-file` actions across its first three turns;
  turn four was sanitized as `openrouter-response-usage-invalid` under the
  stable `openrouter-invalid-unsupported-response` umbrella. The block stopped
  fail-closed before another action, verifier execution or any warm arm. It
  made four serial requests/steps, recorded 35,691 ms aggregate latency and a
  124,037 microusd conservative reservation, but persisted no provider token
  or actual-cost claim because the final usage envelope was invalid.

  Atomic private 0600 persistence succeeded with generation digest
  `sha256:4ff50d7c001396ec832acf72e937b9651e8f8e4fdea150e2c6601ba9b7965c96`,
  observation digest
  `sha256:4a36b5111dfd67cd0b2619d5349b657273708cf9238fe011aa8dcc66bcf4f742`,
  and scorecard digest
  `sha256:a75e7421ceb2a686ba758a7b30d24b3e1563bb27626274e7845fb572a6d8a9ab`.
  Raw provider response, credential material, hidden verifier material and
  workspace contents were not persisted. The result is integration evidence
  only: `status=non-evaluable`, `familyPassed=null` and
  `efficacyClaim=none`; it does not show positive or negative AgenticMemory
  efficacy. B112 remains open and CSP-11 remains `impl` with `gap=true`.
  Another paid replacement requires a fresh explicit approval; production-path
  `WorkItemEffectPlan -> EffectRun -> AgentRequest` dogfooding remains a
  separate slice, and CSP-8 product/Canvas dogfooding still waits for
  graphrefly-canvas.
