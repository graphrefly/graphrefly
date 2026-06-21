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
| L2.A | **9 tiers**: value-settle = DIRTY/DATA/RESOLVED/INVALIDATE; terminal = COMPLETE/ERROR/TEARDOWN; control = **PAUSE/RESUME (tier-0, orthogonal to value flow)**. Closed set. |
| L2.B | Wave boundary: outside batch = one `ctx.down(msgs)` call; inside batch = accumulate to commit. |
| L2.C | PAUSE/RESUME = `[["PAUSE", lock_id]]` / `[["RESUME", lock_id]]`; **lockset/refcount** (all locks must RESUME to truly resume); lock_id caller-generated; same-id repeat PAUSE idempotent; RESUME unknown id = no-op. |
| L2.D / D' | In-process message = **tuple** (debug-friendly, NOT for serialization size). Wire = **protobuf** (when compact needed). The two representations are **decoupled**; conversion at wire-bridge boundary. |
| L2.E | batch = **declarative default** (success→commit / throw→rollback) + `bctx.rollback()` explicit escape hatch; **commit always implicit** (eliminates "forgot to commit" class). 3-lang aligned: TS callback / Py `with batch():` / Rust `Drop`. |
| L2.F | cross-runtime = **per-runtime local dispatcher + wire bridge**; DIRTY crosses wire at same priority as DATA (R12); mesh/service-discovery is the USER's infra concern (bring your own zookeeper/consul). |
| L2.G | push-on-subscribe is part of the protocol. |
| L2.H | Formalization depth = **γ** (markdown spec + TLA+ model + cross-impl property tests). |
| L2-Q8 | diamond/fan-in coalesce: spec writes only **observable behavior** ("D recomputes exactly once after all changed deps settle in same wave"); mechanism (dirtyMask) is impl freedom; TLA+ models the mechanism. |
| L2-Q9 | equals default substitution (hit→RESOLVED / miss→DATA); custom equals is L4 opts. **equals substitution fires ONLY when wave has exactly 1 DATA** — 0 DATA irrelevant, ≥2 DATA does not engage (multi-DATA has no skip-fn benefit, all pass as DATA). |
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
| **L3.C** | **graph = causal domain = concurrency domain = single thread.** Compute parallelism via pool callback (wave-state mutation always serializes back to graph's single thread); true parallelism via multi-graph + wire bridge. **Rust drops actor model (D221/D222) → `!Send` single-thread core; Py drops per-subgraph RLock → single-thread core + multi-instance.** rewire only intra-graph; inter-graph only wire bridge. Consequence 1 (accepted): disjoint waves in same graph don't parallelize (→ use separate graphs). Consequence 2 (accepted): rewire scope = single graph; `setDeps/addDep/removeDep` has no inter-graph form. |
| L3-Q5 | ctx lifecycle per-pool: LocalSync uses node-stable ctx (reset fields, zero alloc); async pools use per-invocation ctx (survives await/boundary). |
| L3-Q6 | `ctx.state` = per-node private cross-wave state (implicit OK — node-private, not shared). Shared memory = explicit node + dep (graph-first). Operators' state/cleanup hide in their graph-layer impl. |
| L3-Q7 | **parity = behavioral conformance (replaces structural `Impl`)** + property mirror. Operators/sugar/inspection are L4 per-language, never in parity. New substrate behavior is spec-driven. **`cross-track-ledger.md` retires** ("Impl widening" concept disappears). Parity surface shrinks to: wave protocol behavior + dispatcher contract + handle format. |
| L3-Q8 | snapshot = topology + cache + factory-name refs; restore re-resolves by name via dispatcher registry; incremental via DS-14 changeset; anonymous inline fn (no name) marked `local-only` (can't restore cross-process — honestly labeled). |
| L3-Q9 | clock: monotonic = **graph-local counter** (folded into graph; causal-domain ordering); wall = system call; **no global clock singleton**. (Rewrites CLAUDE.md "Time utility rule".) |
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
  up(msgs: Wave): void                                   // upstream inject (PAUSE/RESUME/invalidate-request)
  down(msgs: Wave): void                                 // downstream emit (DATA/ERROR/COMPLETE/...)
  depRecords: DepRecord<TDeps>[]                         // latest/tier/prevData per dep
  state: { get(): S|undefined; set(v: S): void; persist(on?: boolean): void }  // per-node private
  onDeactivation(fn: () => void): void                   // external resource release
  onInvalidate(fn: () => void): void                     // INVALIDATE flush
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
| L6-Q1 | **per-language independent complete packages** (`@graphrefly/ts` · `@graphrefly/rust` · `@graphrefly/py`, each = substrate + sugar + operators) + coarse-grained wire bridge. NO cross-language peer-deps. **Drops D080/D206 entirely** (no presentation-peer-deps-substrate, no sync-vs-async drop-in, no overrides redirect, no Option-B anxiety) + drops the 9.5× concurrency-machinery tax (actor model + fine-grained napi). Trade-off: gives up the (never-functional) "TS code transparently enjoys Rust substrate" fantasy; cross-language = wire bridge, not in-process napi swap. |
| L6-Q2 | naming: keep `@graphrefly/` namespace, per-language subpackages; brand "GraphReFly" unchanged; operator subpkg `@graphrefly/<lang>-operators`. |
| L6-Q3 | wire = protobuf schema-codegen (single `.proto`, per-language codegen); in-process tuple ↔ protobuf at wire-bridge boundary; **implementation deferred** (with cross-runtime, post-1.0). Design-time lock: wire = schema-codegen, not ad-hoc JSON. |
| L6-Q4 | adoption path: `npm i @graphrefly/ts` → `graph()` → 10-line hello world → operators → producer/connector → wire-bridge dispatch heavy node to Rust runtime. Zero-config default global dispatcher + LocalSync pool. |

---

## Flag resolutions (found during the roll-up, pre-design-review)

| Flag | Resolution |
|---|---|
| **1 🔴 restore vs fresh-lifecycle wipe** | restore ≠ fresh lifecycle. snapshot serializes ALL ctx.state (persist-flag irrelevant to snapshot); restore restores ALL (state-preserving, "restored" status not "fresh"); wipe only on fresh-lifecycle transition. **Must be written into spec.** CLOSE-with-rule. |
| **2 F-NO-WEDGE-CUT verify** | All 8 verbs serve ≥2 segments (node/graph/batch/derived=all; state=UI/harness/memory; producer=stream/DE/UI; effect=UI/harness/DE; mount=harness/memory/multi-agent). CLOSED. |
| **3 effect maps onDeactivation only** | Accepted limit, doc it. effect = React-useEffect form (return cleanup = deactivation only); INVALIDATE cleanup → upgrade to node/producer. CLOSED. |
| **4 PAUSE/RESUME via ctx.up** | ctx.up carries control tier; upstream node updates `pause_lockset` (L3-Q3). CLOSED. |
| **5 equals custom passing (operator value-level)** | equals via opts (`g.map(deps,fn,{equals})`), not fn param; value-level fn only transforms. CLOSED. |

## config singleton dissolution (17 items)

`GraphReFlyConfig` singleton + freeze-on-first-read mechanism **fully dissolved** into 4 destinations:
- **A. compile-time const** — message type attrs (tier/wireCrossing/metaPassthrough), tier lookups; custom message type extension CUT.
- **B. substrate-fixed (unreplaceable)** — onMessage (dispatch), onSubscribe (push-on-subscribe handshake).
- **C. graph/dispatcher/constructor opts** — codec; node runtime versioning default/policy and hashFn via graph/constructor opts per D109 (V0 default, V1 cid/prev, V2/V3 still deferred); inspectorEnabled, globalInspector (→ dispatcher hook), rigorRecorder (→ dispatcher test-only hook), maxFnRerunDepth (100), maxBatchDrainIterations (1000), pauseBufferMax (10_000), equalsThrowPolicy.
- **D. gone** — `_frozen` + freeze mechanism; isolated `new GraphReFlyConfig` for test (test isolation = `new graph()`).

Trade-off accepted: cuts user-defined protocol stacks (onMessage/onSubscribe/registerMessageType custom). To observe → inspector (read-only); to inject logic → add a node; new tier → spec change.

---

## Delta map vs existing TS/Rust codebases (for post-design-review implementation)

| Area | Today | Clean-slate |
|---|---|---|
| Rust concurrency | actor model (D221/D222, per-Core actor thread + sync channel) | `!Send` single-thread core + multi-instance + wire bridge (drops 12× actor.run overhead + D292 libuv deadlock class) |
| Py concurrency | per-subgraph RLock + per-node cache_lock | single-thread core + multi-instance |
| Concurrency unit | subgraph | **graph** (= causal domain) |
| Parity | structural `Impl` interface (symbol set) + cross-track-ledger + per-symbol D-number | **behavioral conformance suite** + property mirror; cross-track-ledger retires |
| Packaging | pure-ts (substrate) + native (rust, napi) + graphrefly (presentation, peer-deps substrate) — D080/D206 | per-language independent complete packages + coarse wire bridge |
| TS↔Rust | TS presentation on Rust substrate via napi (fine-grained, never functional per D206) | each language self-contained; cross-language = coarse wire bridge (dispatch heavy node) |
| fn signature | `(data, actions, ctx) => NodeFnCleanup\|void` | `(ctx) => void` (ctx = up/down/depRecords/state); sugar return mapped in graph layer |
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
