# SESSION - Sandbox Engineering and AgentENV Runtime Research

**Status:** active research / architecture discussion, non-locking  
**Opened:** 2026-08-16  
**Trigger:** The user encountered claims about Kimi K3's AgentENV sandbox
engineering and asked whether this class of sandbox infrastructure would help
GraphReFly Canvas, whether AgentENV should replace E2B or another runtime, and
whether sandbox engineering is valuable before choosing a concrete provider.  
**Scope:** Research and architecture discussion only. This session records the
verified technology snapshot, layer boundaries, current product judgment, and
future evidence gates. It does not adopt AgentENV, replace E2B or Podman, create
a D#, change the GraphReFly protocol, add a public API or provider registry,
authorize implementation or infrastructure spend, or alter the Canvas roadmap
or current cursor.

---

## 1. Question and Current Answer

The discussion separated two questions that are easy to conflate:

1. Is sandbox engineering a valuable capability for GraphReFly Canvas?
2. Should Canvas now operate AgentENV or another self-hosted sandbox fleet?

The current non-binding answer is:

> Sandbox engineering is valuable and likely necessary for a product that runs
> user- or agent-authored code, but a self-operated AgentENV-class fleet is not
> yet justified by the current workload evidence.

Canvas already has concrete managed and local sandbox directions in its
historical execution work. The useful near-term investment is to preserve and
strengthen exact admission, isolation, bounded input/output, cancellation,
cleanup, reconciliation, and evidence contracts. It is not to choose a new
provider or build a KVM fleet before product load demonstrates the need.

## 2. Research Evidence Snapshot

The detailed source-verified report is retained in the Canvas research output:

- `~/src/graphrefly-canvas/_bmad-output/planning-artifacts/research/technical-kimi-k3-agentenv-sandbox-engineering-research-2026-08-09.md`

That report is evidence, not decision authority. Its external-technology
snapshot is dated 2026-08-09.

Verified premises from that snapshot:

- AgentENV is a real MIT-licensed project in the KVCache.ai organization,
  developed with Moonshot AI and described as powering agentic-RL workloads for
  Kimi K3.
- The runtime is primarily Rust with Go gateway and scheduler services. It uses
  one Firecracker microVM per sandbox, OCI images, OverlayBD, Linux ublk,
  copy-on-write state, memory/filesystem snapshots, pause/resume, and fork.
- The Kimi K3 technical report records 51,219,741 sandbox creations across
  1,505,678 images in the reported training/evaluation context. K3 used multiple
  sandbox runtimes, so these numbers do not establish that AgentENV exclusively
  ran every workload. They are not user counts or simultaneous concurrency.
- AgentENV exposes an E2B-shaped HTTP API and can reuse portions of the E2B
  Python and TypeScript SDK path, but its compatibility matrix documents
  missing or different authentication, tenancy, volume, logging, metrics,
  template, snapshot, network, and lifecycle semantics.
- The public multi-node shape is gateway, scheduler, and privileged runtime
  nodes with `/dev/kvm`. The system supports Kubernetes deployment, host-local
  caches, shared or S3-compatible snapshot storage, and runtime placement.
- At the research cutoff, built-in authorization and first-class tenant scoping
  were not production-ready. Data-plane routing and internal control traffic
  required an external trusted-network, authentication, workload-identity, and
  transport-security boundary.
- The project was young and its public source exposed operational gaps such as
  control-plane availability limitations, create-versus-routing races,
  incomplete logs/metrics, API/documentation drift, and forked-state identity
  concerns.
- Python is an ordinary OCI workload, not an AgentENV-specific code-interpreter
  product. A controlled browser can be assembled in an image, but browser
  policy, credentials, downloads, state reset, and interaction governance are
  upper-layer responsibilities.

Primary external references:

- AgentENV: <https://github.com/kvcache-ai/AgentENV>
- AgentENV documentation: <https://kvcache-ai.github.io/AgentENV/latest/>
- Kimi K3 technical report: <https://arxiv.org/abs/2607.24653>
- AgentENV E2B compatibility tracking:
  <https://github.com/kvcache-ai/AgentENV/issues/5>
- AgentENV multi-tenancy tracking:
  <https://github.com/kvcache-ai/AgentENV/issues/10>
- AgentENV fork identity/entropy tracking:
  <https://github.com/kvcache-ai/AgentENV/issues/33>
- E2B infrastructure architecture:
  <https://github.com/e2b-dev/infra/blob/main/docs/ARCHITECTURE.md>
- Firecracker: <https://github.com/firecracker-microvm/firecracker>

## 3. The Layering That Must Remain Explicit

The phrase "sandbox" covers several different owners:

```text
GraphReFly substrate and solution composition
  -> admitted request, causal execution facts, outcome and evidence vocabulary

Canvas Host / product control plane
  -> identity, product authorization, execution admission, immutable code and
     artifact coordinates, runtime-profile choice, presentation, audit and
     cleanup reconciliation

execution-family adapter
  -> exact provider mapping for allocate, upload, fixed execution, cancel,
     destroy, inspect and bounded evidence projection

sandbox platform
  -> VM/container/isolate lifecycle, image/template materialization, command and
     filesystem data plane, network policy, scheduling and fleet telemetry

isolation substrate
  -> Firecracker/KVM, gVisor, Kata, Linux namespaces or another containment
     boundary
```

These layers are related but not interchangeable. A stronger microVM boundary
does not supply product authorization, tenant ownership, admission, credential
mediation, durable product state, audit, idempotency, or cleanup proof. An
E2B-compatible API does not prove E2B-equivalent security or lifecycle
semantics.

GraphReFly should continue to own provider-neutral admitted-execution facts and
deterministic lifecycle composition. A product host owns concrete policy and
provider integration. Provider clients, API keys, access tokens, sandbox IDs,
node bindings, proxy URLs, PTYs, process handles, snapshot paths, and storage
credentials remain outside Graph DATA and public Canvas material.

## 4. Why Sandbox Engineering Is Worth Building

Canvas permits or anticipates agent- and user-authored executable work. That
makes the following capabilities part of the product safety and evidence model,
not optional infrastructure polish:

1. A fresh, explicitly identified execution attempt with a bounded containment
   boundary.
2. Immutable and revision-pinned code, runner, base environment, input,
   resource, output, filesystem, network, and cleanup policies.
3. Default denial of ambient host access, credentials, datasource access,
   inbound services, and external network.
4. Exact correlation among authorization, admission, run, attempt, environment,
   manifest, cancellation, outcome, and cleanup.
5. Bounded and redacted movement of inputs, stdout, stderr, results, artifacts,
   usage, issues, and evidence.
6. Explicit timeout, cancellation, fencing, terminal destruction, and
   zero-residue verification.
7. A fail-closed `unverifiable` posture when provider or host failure prevents
   destruction from being proved.
8. Separation of ephemeral compute state from accepted code revisions, durable
   product state, results, presentation, grants, credentials, and audit.
9. Reproducible runtime certification and adversarial tests for escape,
   cross-run residue, egress, cancellation races, late output, response loss,
   and host/process restart.
10. Fleet-level observability that never substitutes telemetry for authoritative
    execution, permission, provenance, or product truth.

These guarantees remain useful whether the concrete runtime is hosted E2B,
local rootless Podman, a future Firecracker family, or another separately
reviewed implementation.

## 5. Why a Self-Operated AgentENV-Class Fleet Is Deferred

Operating AgentENV would make the product operator responsible for more than a
runtime SDK:

- KVM-capable Linux nodes and privileged runtime deployment;
- host-kernel, Firecracker, network-namespace and block-I/O hardening;
- gateway, scheduler, service discovery and routing availability;
- image conversion, provenance, vulnerability response and cache behavior;
- snapshot/object-store confidentiality, durability, retention and deletion;
- workload identity, mTLS, tenant fencing, quotas and per-operation
  authorization around a platform that did not yet provide those guarantees;
- capacity planning, bin packing, node draining, migration and incident
  response;
- exact cleanup ledgers and reconciliation after client, gateway, scheduler,
  node, storage or response loss.

That operational surface can be justified, but only by evidence that its
snapshot/fork/density economics materially improve the product. It is not
justified merely because the code is open source or because its HTTP surface
resembles E2B.

## 6. Evidence That Would Reopen the Provider Question

A later design review may reconsider a self-hosted Firecracker execution family
when one or more of these conditions are measured rather than forecast:

- sustained sandbox concurrency makes hosted execution cost or capacity a
  material product constraint;
- thousands or more daily evaluation/rollout environments repeatedly pay the
  same setup cost;
- environment initialization dominates user-visible or evaluation latency;
- branching search, RL rollouts, or benchmark campaigns need one-to-many fork
  from an exact prepared checkpoint;
- enterprise deployment requires customer-controlled or fully self-hosted
  execution;
- a private cluster demonstrates meaningfully better P50/P95/P99 startup,
  throughput, density, cost, and failure behavior under representative Canvas
  workloads;
- the operator can prove authentication, tenant isolation, egress control,
  cancellation, destruction, reconciliation, observability and node hardening
  at least as strongly as the accepted alternative.

The evaluation must include cold and warm caches, representative image sizes,
concurrent creation, node loss, scheduler restart, gateway response loss,
snapshot corruption, cross-run residue canaries, network-policy bypass, and
cleanup uncertainty. Provider self-reported best-case latency is not enough.

## 7. Candidate Future Shape, Not a Commitment

If those gates are eventually satisfied, the honest shape would be a separately
named, host-private Firecracker execution family. It would not masquerade as an
E2B backend, inherit E2B or Podman certification, appear in a generic public
provider registry, or introduce automatic fallback.

The first possible experiment would be narrower than AgentENV's full feature
set:

- single-tenant private network;
- immutable template/snapshot coordinate, never a mutable alias;
- one fresh VM per admitted attempt;
- deny-all egress and no credential/datasource authority;
- fixed runner and bounded file/command paths;
- exact cancellation fence, kill, delete and durable cleanup ledger;
- no pause, resume, live adoption, cross-attempt reuse or fork;
- independent readiness and containment certification;
- no Canvas browser exposure of provider handles or internal topology.

Using AgentENV's pause/resume/fork strengths would require a separate lifecycle
and security review because those operations change identity, retention,
credential, replay, cleanup and product-state assumptions.

## 8. Authority and Repository Boundaries

This root session is a cross-project research index only.

- The GraphReFly root remains authority for language-neutral protocol and
  cross-project boundaries. This session changes neither.
- A future concrete Canvas runtime family, product authorization/lifecycle
  contract, focused DTO, roadmap item or implementation decision belongs to the
  Canvas-local decision and work authority identified by the federated owner
  map.
- A reusable language-package executor contract belongs to its language-package
  owner unless it changes the language-neutral protocol.
- Actual workload/runtime truth, domain/host truth, Canvas Host product truth,
  inert definitions/refs, and presentation material remain distinct truth
  classes under `graphrefly:D769`.
- Canvas-internal graphs and topology remain confidential under
  `graphrefly:D770`; a sandbox, provider SDK or browser payload must not receive
  that internal material.
- The detailed Canvas research document remains supporting evidence. It does
  not authorize implementation, modify the program cursor, or supersede an
  owner-local decision.

## 9. Non-Goals and Guardrails

- No decision is made to adopt, reject permanently, fork or modify AgentENV.
- No decision is made to replace E2B, Podman or another existing runtime.
- No provider, cluster, credential, budget, benchmark campaign or deployment is
  approved.
- No generic `SandboxProvider`, backend selector, common volume, common
  snapshot, common endpoint or provider-equivalence ontology is introduced.
- Template, image, snapshot, pause/resume, fork, backup and volume semantics
  must not be flattened across providers.
- Provider events and telemetry are evidence inputs, not permission,
  provenance, execution outcome, cleanup or product-state authority.
- No Graph message, tier, dispatcher behavior, DATA rule, conformance scenario,
  formal model, package API, Canvas public surface, roadmap item or current
  cursor changes through this session.
- Further external claims must be reverified against a pinned release or commit
  because the AgentENV project and documentation were changing rapidly at the
  research cutoff.

## 10. Open Questions

1. Which actual Canvas workloads, if any, need memory-plus-filesystem snapshot
   or fork rather than immutable template startup?
2. What concurrency, startup-latency and monthly-cost threshold would justify
   ownership of a KVM fleet?
3. Can provider-neutral lifecycle/evidence composition stay narrow while each
   execution family retains honest environment, storage, endpoint and cleanup
   semantics?
4. What independent certification would be required before a self-hosted
   runtime could process sensitive or multi-tenant Canvas workloads?
5. Should large evaluation and RL fleets remain an external workload consumer
   of GraphReFly execution facts rather than a Canvas product capability?
6. Which cleanup and cross-run residue tests should be common evidence
   obligations even when their provider mechanisms differ?
