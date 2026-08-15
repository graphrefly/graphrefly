# SESSION - Prime Agent, pi, and Graph-Native Durable Harness Research

**Status:** active research / architecture discussion; D772/D785/D786 locked
**Opened:** 2026-08-11  
**Trigger:** The user saw Prime Agent's rapid adoption and asked why it was
successful, how its relationship to pi maps onto GraphReFly, and whether its
persistent context plus runtime-managed lifecycle resembles GraphReFly's
WorkItem/EffectRun direction. Later multi-agent and systems-engineering posts
prompted follow-up reviews of context isolation, candidate search, cost
attribution, evaluator-driven reliability and verified work reuse.
**Scope:** Product and architecture research. This session records verified
premises, layer mappings, current gaps, sequencing, and candidate host/runtime
shapes. D772 locks the task-centric proposal/commitment boundary and the
combined current context contract. D785 separates resource evidence, replaceable
cost policy and optimization authority. D786 separates verified-result
substitution from advisory insight reuse. None amends protocol behavior, approves
a public API, authorizes implementation, or makes an efficacy claim.

---

## 1. External Research Signals

Prime Agent presents itself as an open-source coding and research agent for
general and long-running work. Its public materials emphasize two abstractions:

- an RLM programming model in which context is treated as variables and a
  persistent Python/IPython environment can search, filter, transform, and
  delegate portions of context;
- a continual harness that can retain supplemental prompts, memories, skill
  descriptions, and reusable subagent specifications as durable state.

Its product runtime adds daemon-backed continuity, worker and kernel processes,
reattachable sessions, persistent goals, heartbeats, schedules, bounded
autonomous mode, retained subagents, direct agent messaging, session history,
and rollbackable harness refinement. Prime Agent explicitly acknowledges that
it is built on pi.

pi's public positioning is different but complementary: a minimal agent harness
that developers adapt through TypeScript extensions, tools, commands, providers,
UI hooks, prompt templates, skills, packages, RPC, and SDK embedding. Its
sessions are tree-structured, and extensions can customize compaction, inject or
filter context, implement retrieval, and add long-term memory.

The relevant signal for GraphReFly is not popularity by itself. It is that two
clear product promises have become legible to developers:

1. pi: a small harness developers can reshape into their own agent workflow;
2. Prime Agent: an opinionated long-running agent whose working state and
   lifecycle survive a terminal or chat session.

External sources:

- Prime Agent repository and overview:
  <https://github.com/PrimeIntellect-ai/prime-agent>
- Prime Agent documentation index:
  <https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/docs/index.md>
- Prime Agent architecture:
  <https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/docs/architecture.md>
- Prime Intellect RLM overview and early ablations:
  <https://www.primeintellect.ai/blog/rlm>
- Continual Harness paper:
  <https://arxiv.org/abs/2605.09998>
- pi product and extension positioning:
  <https://pi.dev/>

## 2. Layer Mapping: Prime, pi, and GraphReFly

The discussion rejected a one-to-one equation between pi and the GraphReFly
substrate. They occupy different layers:

```text
GraphReFly sync graph substrate
  -> WorkItem / EffectRun / AgentRequest / context / evidence solutions
  -> future graph-native developer agent host or SDK
  -> optional opinionated long-running agent product

pi minimal agent harness and SDK
  -> Prime Agent opinionated continual/RLM product runtime
```

GraphReFly's wave protocol, graph, node, dispatcher, and reactive reductions are
lower and more domain-neutral than pi. pi is closer to the future developer
agent host/SDK that could be built on GraphReFly. Prime Agent is closer to an
opinionated product above that host.

The comparison "Prime uses Python while GraphReFly uses WorkItem" also mixes
layers:

- Prime's persistent Python environment is a programmable control and context
  surface plus an effect boundary.
- GraphReFly's WorkItem is durable domain/work truth.
- GraphReFly's EffectRun and AgentRequest are execution and request lineage.
- A future GraphReFly host would own process lifecycle, provider/tool bindings,
  checkpointing, credentials, and recovery.

Python and WorkItem are therefore not substitutes. The closest comparison is
Prime's session/goal lifecycle versus GraphReFly's WorkItem/EffectRun facts, and
Prime's Python/tool control surface versus a future GraphReFly host's admitted
context, tool, graph-revision, and executor capabilities.

## 3. Why Prime Agent and pi Are Legible Products

The discussion identified several success factors:

- **Immediate concrete value:** install a CLI and obtain a working coding or
  research agent, rather than first learning a general reactive model.
- **A clear long-task promise:** detach, reattach, resume, retain goals, and keep
  background work alive.
- **Programmability:** the model can manipulate context and invoke subagents
  through familiar code, while developers can extend the harness.
- **A narrow primary audience:** developers already understand files, shell,
  sessions, providers, and extensions.
- **A visible product surface:** TUI/CLI behavior demonstrates the architecture
  immediately.
- **Small-core positioning:** pi explicitly prefers primitives and extensions
  over baking every workflow into the core.

GraphReFly currently has a deeper inspectability and fact-governance thesis, but
its immediate user outcome is less obvious. This is not evidence that pi's
substrate is universally more effective; it is evidence that pi and Prime have
compressed their value into a usable, demonstrable developer experience.

## 4. Durable Long-Running Work Is a GraphReFly Goal

Prime's recoverable long-task lifecycle is not merely an external feature to
copy. It validates a goal GraphReFly already intends to serve.

The important distinction is the unit of durability:

- Prime is primarily session-centric: conversation, kernel, worker identity,
  goals, and retained subagents persist.
- GraphReFly is intended to be fact-centric: WorkItem truth, EffectRun lineage,
  AgentRequest facts, outcomes, evidence, policy coordinates, and checkpoints
  persist.

A GraphReFly recovery should ideally restore the same verifiable work process
without requiring the same model process or cognitive worker to survive. This
supports replay, executor replacement, audit, and fail-closed recovery.

The future durable host belongs above the WorkItem solution. WorkItem must not
own a daemon, scheduler, provider, credential, executor, or hidden lifecycle
loop. The expected layering is:

```text
GraphReFly substrate
  -> WorkItem + context + tool-provider + AgenticMemory compositions
  -> opinionated host/runtime
       - checkpoint and committed-fact storage
       - process and daemon lifecycle
       - provider and tool bindings
       - scheduling and recovery
       - explicit policy profiles
  -> developer-built agent products
```

Durable semantics and checkpoint boundaries should remain a current concern so
that ongoing CSP-11 work does not depend on irrecoverable hidden state. A full
daemon/session product should follow a stable empirical checkpoint rather than
prematurely freezing host APIs.

## 5. Dynamic Context Allocation Within an EffectRun

The conversation refined the desired context model:

```text
accepted outcome/evidence
  -> next bounded ContextRequest or context-kind AgentRequest proposal
  -> admission and exact request/operation/revision/budget correlation
  -> ready, pending, or issue ContextContribution facts
  -> bounded ContextFrame or context ref
  -> later request in the same EffectRun
```

A new EffectPlan is needed only when causal work decomposition changes. Merely
querying A, then using A's result to slice B, should be expressible as sequential
requests inside one EffectRun.

Verified TypeScript premise as of 2026-08-11:

- the generic AgentRequest ledger can index multiple requests by effectRunId;
- request satisfaction correlates context contributions by requestId and
  operationId and rejects stale, duplicate, and wrong-kind material;
- the current public `workItemExecutionRecipe` explicitly emits at most one
  deterministic AgentRequest tuple for each EffectRun;
- no landed WorkItem recipe realizes the complete D772 generic context kernel
  and unified ContextContribution lifecycle.

The architecture therefore permits the direction, but the current WorkItem
recipe does not provide it. B117 records the design gap.

This does not require mutable topology. Query, filter, slice, rank, reduce,
budget, source, and revision coordinates are dynamic DATA. A stable context-hub
topology processes those requests. Only a genuinely new context-processing
algorithm or executable graph that is not present in the accepted topology
would require a WorkGraph/GraphRevision proposal followed by separate host
review and immutable revision acceptance.

## 6. Skills, Graphs, and Runtime Capability Expansion

GraphReFly intentionally does not need to make "skill" a core primitive. A
recurring capability may be represented as an inspectable graph or immutable
graph revision and exposed to an EffectRun as an admitted tool, verification
step, or executor route.

Verified TypeScript premise as of 2026-08-11:

- `toolProviderExecutionRecipe` accepts both static ToolProviderCatalog values
  and graph-visible dynamic tool-provider catalog Node inputs;
- actual executable provider bindings remain runtime-private and are attached
  at construction.

Consequently, WorkItem or agent DATA may dynamically discover or propose a
catalog, capability, route, or graph revision, but it must not install arbitrary
code, gain credentials, mutate accepted topology, or widen executable authority
by itself.

The missing product shape is a packaged capability hub and revision workflow:

```text
CapabilityRequest / GraphRevisionProposal
  -> catalog and current revision lookup
  -> narrow admission and compatibility policy
  -> already host-authorized immutable graph/tool binding
  -> EffectRun / AgentRequest
```

Genuinely new code, topology, provider binding, credential, or permission must
be accepted by the host as a new immutable revision before it becomes
executable. B118 records this design gap.

## 7. Opinionated Host Policy Profiles

An opinionated host should be able to offer useful defaults without creating a
universal policy engine or a global mutable config object.

The preferred future shape is a named profile factory that produces separate,
replaceable graph-visible policy nodes or bundles:

```text
opinionated host profile factory
  -> WorkItem plan policy Node
  -> request admission policy Node
  -> context assembly policy Node
  -> AgenticMemory admission and exact-use inputs
  -> capability admission and routing policy Nodes
```

Each solution consumes only the narrow policy family it owns. The host profile
does not become authority for external permissions, memory use, provider
outcomes, executable bindings, credentials, or WorkItem truth changes.

Verified asymmetry as of 2026-08-11:

- AgenticMemory admission already accepts a
  `Node<AgenticMemoryRecordAdmissionPolicy>`, and its policy-source projection is
  graph-visible.
- `workItemExecutionRecipe` currently accepts a static
  WorkItemEffectPlanPolicy and internally emits one mechanical AgentRequest
  admission.

A later design review must decide per stage whether public recipes should
accept policy nodes/bundles or whether an opinionated host should compose the
lower-level producers directly. B119 records this cross-solution design gap.

## 8. Retained Child Sessions Are Deferred

Prime's retained child session includes more than causal parent-child identity:
it may retain a private conversation, kernel state, worker identity, and the
ability for the parent to message the same specialist later.

GraphReFly currently has a more task-centric model: WorkItem, EffectRun, child
AgentRequest, outcome, and evidence lineage. This is sufficient for causal
tracking and executor replacement but does not recreate the same cognitive
worker.

The discussion deliberately deferred an `AgentSessionRef` or equivalent host
surface. It should be reconsidered only if a real consumer demonstrates either
material efficacy improvement or a low-cost provider/session reuse opportunity.
Otherwise it adds recovery, privacy, eviction, and provider-coupling costs
without strengthening WorkItem truth.

## 9. Project Fit and Simple-Task Bypass

Project fit has three distinct levels:

1. **Adoption fit:** a developer or architect decides whether a project benefits
   from fan-in/out, continual updates, provenance, verification, recovery,
   retry, or multiple authorities. GraphReFly cannot reliably infer the future
   shape of an entire project.
2. **Per-task execution shape:** an opinionated host may use explicit,
   graph-visible policy to route a simple task to a minimal EffectRun/request
   path and a governed task to the full durable WorkItem lifecycle.
3. **Complete plain-TypeScript bypass:** the application may explicitly choose
   this outside GraphReFly. GraphReFly should not silently bypass its own graph,
   because doing so changes inspectability and evidence semantics.

WorkItem count is not itself a project-fit test. One WorkItem may contain many
EffectRuns and AgentRequests. A separate WorkItem is justified by an independent
ownership, acceptance, revision, status, or recovery boundary, not merely by a
large context or repeated model calls.

## 10. Evaluation and Model-Harness Learning

The discussion separated evaluation rigor from empirical reach:

- GraphReFly's current eval governance is stronger in matched-arm identity,
  same-input comparison, negative controls, provenance faults, non-evaluable
  accounting, bounded claims, and explicit verifier authority.
- Prime's public work is stronger in visible end-to-end product demonstrations,
  long-context environments, harness ablations, and empirical breadth.
- GraphReFly still needs broader external validity; internal and package-private
  qualification is not by itself proof of durable-work or memory efficacy.

CSP-11 is a prerequisite for later model-harness co-training because it can
produce frozen tasks, verifiers, accepted/rejected trajectories, context and
tool ablations, and reward-hacking controls. It is not itself model training.

The tentative learning sequence is:

1. freeze model weights and compare prompts, graph revisions, context policy,
   capability routing, and recovery behavior;
2. after the harness contract stabilizes and enough verifier-qualified
   trajectories exist, consider SFT; LoRA is one delivery method for SFT rather
   than a separate learning objective;
3. consider preference optimization or RL/RFT only after the verifier is robust
   enough for long-horizon context allocation and tool-selection rewards.

Programmable-context experiments, erroneous-memory negative controls, and
long-task comparisons should belong to a later adaptive-harness research cluster
with model-harness learning. Prime may be one reference arm, not the benchmark
or standard the GraphReFly roadmap is organized around.

## 11. Product Direction and Positioning

The nearer product direction is closer to pi than to a direct Prime clone:

> Give developers primitives and an opinionated SDK for building resumable,
> inspectable, and verifiable agent runtimes.

An eventual Prime-like daemon/session product may become a reference host or
flagship application, but it should not be confused with the GraphReFly
substrate or WorkItem core.

The current website title, "The graph you see is the system that runs," is a
strong architecture promise about inspectability. It does not yet fully state
the user's outcome. A deferred copy candidate has been recorded under B106 and
must not be published before the capability is evidenced:

> Long-running work stays resumable, inspectable, and verifiable—because the
> graph you see is the system that runs.

## 12. Working Sequence

This session records the following current working sequence, not an
implementation approval:

1. close the current CSP-11 checkpoint without broadening it into product work;
2. complete CSP-14's B120 causal/evidence contract and B121 retained flagship;
3. complete CSP-15's first generic durable runtime and SQLite crash vertical;
4. trigger B117 only if a retained consumer then needs adaptive multi-request
   context inside one EffectRun;
5. when the Data Agent wedge is explicitly active, qualify B133 as an app-private
   multi-candidate recipe and let it produce real evidence for B131/B132 without
   making those generic contracts part of the first causal/evidence lens;
6. trigger B118 only after repeated consumer demand, then B119 after B117/B118;
7. accumulate verifier-qualified real workload trajectories before any
   adaptive-harness training work.

## 13. Governing Existing Decisions

This discussion is constrained by existing locks rather than replacing them:

- D189: WorkItem effects are graph-visible request projections, not imperative
  runners.
- D772/D202: context assembly is generic, uses one unified ContextContribution
  lifecycle, and lets models or other producers propose later bounded context
  without acquiring admission authority.
- D207: WorkItem, EffectRun, and AgentRequest have separate flows/ledgers.
- D218/D221: runtime helpers are composition scaffolds; mechanical defaults and
  semantic/external authority have different boundaries.
- D234: policies remain narrow graph-visible families, not one policy engine.
- D283/D359: focused exports and optional tool-provider recipes must not create
  ambient registries or move runtime bindings into WorkItem.
- D571/D572/D583: WorkItem and AgenticMemory remain independent, proposal and
  admission are explicit, and memory policy sourcing is AgenticMemory-owned.
- D640/D643: exact memory use requires current external authorization and fails
  closed.
- D683/D687: project-fit and focused WorkItem recipe evidence have bounded
  authority.
- D689: successful-experience transfer requires evidence, leakage controls, and
  strict admission/use gates.
- D718: accepted topology is stable while high-cardinality workload and model
  proposals flow as DATA; model output cannot mutate accepted topology or grant
  execution authority.
- D785: resource observations, replaceable cost-model policy and optimization
  authority remain separate; automatic optimization is not promised.
- D786: verified-result substitution and reusable-insight context are distinct
  reuse classes with separate compatibility and use admission.

## 14. Non-Goals Captured by This Session

- No Python or arbitrary code execution is added to the GraphReFly core.
- No `skill` primitive, `AgentSessionRef`, daemon API, or universal HostProfile
  is approved.
- No model output may install executable capability, grant permission, mutate
  accepted topology, establish verification truth, or directly mutate WorkItem
  or AgenticMemory truth.
- No aggressive generic memory admission default is approved. A future named
  local-developer profile may be explicit, while generic authority absence
  remains fail-closed.
- No Prime-specific benchmark is added to the near-term roadmap.
- No protocol, tier, message, ctx.up/down, formal, conformance, or cross-language
  change is proposed.

## 15. Open Questions

1. What is the smallest durable fact/checkpoint image that can recover a pending
   WorkItem -> EffectRun -> AgentRequest without preserving a model process?
2. Should B117 extend the focused WorkItem execution recipe or compose a
   separate adaptive request producer over lower-level AgentRequest facts?
3. Which context query/filter/slice/reduce vocabulary is sufficiently general
   without becoming an unbounded programming language?
4. What host acceptance artifact identifies an immutable executable graph
   revision, its bindings, permissions, and compatibility coordinates?
5. Should the first opinionated host live in `@graphrefly/ts`, a focused sibling
   package, or a separate product/reference-host repository?
6. Which mechanical criteria can select a minimal task path automatically, and
   which project-fit or semantic choices must remain explicit?
7. What evidence threshold would justify retained agent sessions rather than
   replaceable task-centric executors?
8. When does CSP-11 provide enough stable, diverse trajectory data to justify
   SFT or later RL/RFT experiments without training against a moving harness?
9. Which resource dimensions and default cost-policy outputs are useful across
   two real consumers without pretending provider units or user priorities are
   universally comparable?
10. Which compatibility coordinates are exact, equivalence-classed or irrelevant
    for the first Data Agent verified-result family?

## 16. Related Canonical Records

- `sessions/active/SESSION-clean-slate-redesign.md`
- `plan/backlog.jsonl`: B106, B112, B116-B119, B131-B133
- `decisions/decisions.jsonl`: D189, D202, D207, D218, D221,
  D234, D283, D359, D571, D572, D583, D640, D643, D683, D687,
  D689, D718, D772, D785, D786
- `../graphrefly-ts/packages/ts/src/solutions/work-item/execution.ts`
- `../graphrefly-ts/packages/ts/src/executors/tool-provider.ts`
- `../graphrefly-ts/packages/ts/src/solutions/agentic-memory/admission-policy-source.ts`

## 17. D772 — Open Proposal, Explicit Commitment

D772 consolidates and supersedes D194-D195 as the single current context
authority. It retains the reusable generic context kernel and makes D195's
ready/pending/issue `ContextContribution` lifecycle authoritative, removing the
ambiguous reading that retrieval requests are a sibling public response API.

The model, a human, a policy producer, or another executor may propose the next
bounded `ContextRequest` or `AgentRequest` within an `EffectRun` after admitted
evidence or outcomes arrive. A changed causal decomposition may instead produce
a proposed `EffectPlan` or `WorkItem`. Proposal latitude includes responsibility,
scope, limits, priority, rationale, expected result and budget posture; it grants
no execution, mutation, capability, verification or external-effect authority.
Only graph-visible narrow admission and owning domain authorities may commit the
proposal and return correlated accepted truth.

Executor plurality is execution DATA rather than WorkItem ontology. Exact model,
agent, tool or human identity, request cardinality, handoff, attempt, outcome and
evidence remain recorded, while stable business stages, policy gates,
verification boundaries and causal dependencies remain topology. CSP-14 may
freeze one exact executor configuration for reproducibility, but single-agent
versus multi-agent performance is not part of its required proof axis.

## 18. Systems-Engineering Follow-Up

The follow-up discussion treated the Jeff Dean systems-engineering notes as a
constraint-placement signal rather than evidence that GraphReFly should become
a universal agent harness. GraphReFly should absorb recurring causal execution
complexity that is durable across model generations: explicit requests and
outcomes, attempts, external effects, evidence, evaluation, checkpoint and
recovery semantics. Model-specific reasoning strategy, task decomposition,
context choice and candidate generation remain replaceable producers whose
outputs are proposals rather than hidden runtime authority.

The strongest applicable patterns are:

- provide the correct bounded data at the correct causal point rather than
  attributing every failure to model capability;
- use evaluator-backed candidate exploration without making agent count an
  ontology or proof axis;
- expect individual executors to fail and preserve retries, alternatives,
  verification and recovery as explicit policies and facts;
- expose measurements and user-replaceable cost policy before attempting an
  automatic optimizer;
- reuse prior verified work only through explicit compatibility and exact-use
  admission, while keeping broader lessons advisory.

## 19. D785 — Measurement First, Optimizer Optional

D785 rejects both a hidden harness-owned cost callback and one universal cost
scalar. Context, request, attempt, executor usage, external calls and opt-in
graph profiling become causally attributed resource evidence with exact units,
measurement source, estimated/measured posture, pricing or profile revision,
currentness and evidence refs. A named default cost-model graph may calculate a
multidimensional assessment, and users may replace or compose that graph with
their own policy.

Cost assessment remains separate from budget, route, admission and optimization
authority. A later optimizer, if justified, can only propose through D772 and
the relevant owning policy gates. GraphReFly therefore promises cost visibility
and policy replaceability before it promises automatic cost optimization.

B131 owns the deferred public-contract and evaluation work. It follows B120's
causal/evidence contract and waits for real consumer measurements so CSP-14 and
Canvas's first read-only lens are not delayed by speculative cost ontology.

## 20. D786 — Verified Results and Reusable Insights

D786 defines two semantic reuse classes without freezing their future exported
TypeScript names:

1. verified-result substitution may avoid execution only after a narrow current
   compatibility and exact-use policy admits the immutable prior result and its
   evidence for the new consequence;
2. a reusable insight is provenance-bound advisory material that may enter a
   later context after fresh use admission but cannot establish a result,
   verdict, permission, mutation, route or other authority.

This extends AgenticMemory's admission/exact-use precedent rather than turning
AgenticMemory into a generic result store. Large result bodies may stay in an
external authority behind exact refs. When reuse changes a durable managed
consequence, the compatibility and use decision must be reconstructable under
the claimed assurance. B132 owns the later public-contract and adversarial
qualification work.

## 21. Data Agent Candidate Search and Canvas Projection

The first intended private consumer is Data Agent. When its wedge is explicitly
activated, one admitted agentic request may propose several sibling
`AgentRequestProposal` values through the existing `AgentDecisionContinue.next`
array. Each proposal is admitted and routed separately, potentially to a
different executor or model profile. An app-private candidate-set contract binds
membership, completion policy, evaluator revision and budget; a separately
admitted aggregator proposes a selection over eligible terminal outcomes, and
an independent verifier plus the owning authority decide publication.

This is dynamic DATA over stable fork/admission/aggregate/verify topology, not
hidden agent spawning or runtime topology mutation. B133 owns the private recipe
qualification; B116 remains the only gate for public Data Agent solution
extraction after a second independent scenario.

Canvas sequencing remains read-first. Its initial Coordination/Topology lens
continues to project exact causal and evidence truth. Candidate requests,
attempts, outcomes and aggregation appear only when present in the real runtime
records. Cost and context overlays follow later as derived projections over the
same exact coordinates, and write interactions remain typed proposals to the
owning authority.
