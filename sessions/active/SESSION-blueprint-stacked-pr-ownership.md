---
SESSION: blueprint-stacked-pr-ownership
DATE: 2026-06-24
UPDATED: 2026-09-06
TOPIC: Discussion-capture (NOT a decision session). Captures the June 2026 research/discussion
  thread about combining GraphReFly's read-only blueprint with Graphite-style stacked PRs/diffs and
  an ownership-control layer built from ABAC-style node guards plus source-diff checks. Oak was
  researched as an agent-native VCS/storage substrate but explicitly deprioritized in favor of
  Graphite/stacked-diff integration because stacked PRs map more directly to GraphReFly's current
  blueprint / ownership / verification direction.
REPO: graphrefly (language-neutral authority)
STATUS: DISCUSSION CAPTURE ONLY. No D-number minted, no spec amended, no code implemented. Any
  public API, new primitive, ownership policy artifact, Graphite adapter, or guard semantics change
  requires design-review -> explicit user approval -> decision/spec flow as applicable.
SUPERSEDES: none
RELATED:
  - ../graphrefly-ts/packages/ts/src/graph/blueprint.ts
  - ../graphrefly-ts/docs/roadmap.md
  - ../graphrefly-ts/docs/implementation-plan.md
  - sessions/active/SESSION-clean-slate-redesign.md
  - sessions/active/SESSION-ontology-agent-observability-research.md
  - ../graphrefly-stack/docs/decisions/decisions.jsonl (D54-D59)
  - ../graphrefly-stack/docs/product/contracts.jsonl (C60-C64)
  - ../graphrefly-stack/docs/product/scenario.jsonl (SC12)
  - ../graphrefly-stack/docs/plan/phases.jsonl (STACK-SOURCE-BOUND through STACK-GROUNDED-HANDOFF)
---

## CONTEXT

The thread began with research into Graphite's "stacked PRs" / "stacked diffs" model, then expanded
into how GraphReFly's blueprint, ownership boundaries, and node guards could cooperate with stacked
review flows.

The key external distinction:

- **Graphite / stacked PR tools** manage the review and branch mechanics: branch stack creation,
  PR dependencies, restacking/rebasing, review UI, and merge order.
- **GraphReFly** should manage the semantic layer: blueprint-backed affected nodes/subgraphs,
  ownership claims, allowed patch scopes, required checks, causal impact, and reviewer evidence.
- **Oak** is relevant as a possible future VCS/workspace backend, but it solves a lower-level
  storage/worktree problem. It should not be prioritized over stacked-diff integration for the
  current GraphReFly product direction.

This session intentionally records a product/design direction, not a locked architecture.

## PART 1: TERMINOLOGY

The English terms discussed:

- **stacked PRs** / **stacked pull requests**: dependent pull requests reviewed and merged in order.
- **stacked diffs** / **stacked changes**: the lower-level change-review framing used by tools and
  systems that treat each change as a separate review unit.
- **patch stack** / **review stack**: broader historical terms, common around Mercurial/Sapling,
  Gerrit, StGit, and related flows.

Important correction: Graphite is not primarily an automatic "split my giant PR safely" engine.
The useful workflow is to split intentionally before or during implementation, then let Graphite
manage the stack mechanics. Auto-splitting a finished mega-diff may be a future advisor feature, but
it is much harder and should not be the first product shape.

## PART 2: CURRENT BLUEPRINT BOUNDARY

Current `GraphBlueprint` is not a stack plan and not an ownership artifact.

The current TypeScript blueprint slice explicitly says a blueprint is read-only audit/collaboration
evidence over `graph.topology()`, and is not an authoring spec, checkpoint, restore input, hash owner,
or collaboration ownership artifact.

Current shape:

```ts
interface GraphBlueprint {
  readonly version: typeof GRAPH_BLUEPRINT_VERSION;
  readonly topology: NormalizedGraphTopologySnapshot;
  readonly diagnostics?: GraphBlueprintDiagnostics;
  readonly provenance?: GraphBlueprintProvenance;
  readonly hash?: GraphBlueprintHash;
}
```

The topology carries normalized nodes, edges, and optional subgraphs. It does not carry a `stack`
field. The earlier JSON example with `"stack": [...]` was only a hypothetical planner output and
should be renamed to avoid confusion.

Preferred naming:

- **GraphBlueprint**: read-only topology/audit evidence.
- **ChangePlan** or **StackPlan**: task-specific planning artifact that references a blueprint hash.
- **WorkUnit**: one planned change unit, usually mapping to one stacked diff/PR.
- **OwnershipPolicy** or **OwnershipClaims**: authority artifact for who may edit what.
- **VerificationPlan**: required checks/evidence for a WorkUnit.

## PART 3: STACKED PR INTEGRATION MODEL

The prioritized integration shape:

```text
User/agent task
  -> GraphReFly reads current blueprint
  -> GraphReFly emits ChangePlan / WorkUnits
  -> each WorkUnit maps to one stacked diff / PR
  -> agent works within the active WorkUnit boundary
  -> GraphReFly checks diff scope + causal/verification evidence
  -> Graphite manages stack submit/restack/review/merge mechanics
```

Boundary:

- Graphite owns branch/PR stack mechanics.
- GitHub or the forge owns review UI.
- GraphReFly owns semantic planning, ownership, affected-node evidence, and check routing.
- The agent works inside the currently active WorkUnit.

The best first product is not "auto split a user's large PR." It is:

```text
Before the agent writes, split the task into causal/ownership-aware WorkUnits.
```

This aligns better with GraphReFly's blueprint model and avoids trying to reconstruct intent from a
finished diff.

## PART 4: PROPOSED CHANGEPLAN SHAPE

The earlier `"stack"` key should be avoided in GraphReFly-owned artifacts because it sounds like
GraphBlueprint topology. Prefer `units`.

Illustrative shape only:

```json
{
  "kind": "graphrefly.changePlan.v0",
  "baseBlueprintHash": "bp_abc123",
  "units": [
    {
      "id": "auth-schema",
      "title": "Add refresh token schema",
      "claims": ["node:auth.token-store", "sourceRange:src/auth/schema.ts"],
      "allowedFiles": ["src/auth/schema.ts", "src/__tests__/auth/schema.test.ts"],
      "dependsOn": [],
      "checks": ["auth:schema", "blueprint:hash"]
    },
    {
      "id": "refresh-runtime",
      "title": "Wire refresh runtime graph",
      "claims": ["subgraph:auth.refresh"],
      "allowedFiles": ["src/auth/refresh.ts", "src/graph/auth.ts"],
      "dependsOn": ["auth-schema"],
      "checks": ["auth:runtime", "explainPath:refresh"]
    }
  ]
}
```

This artifact is outside the blueprint. It references `baseBlueprintHash` so checks can detect when
the plan was generated against stale topology.

## PART 5: OWNERSHIP CONTROL VIA GUARDS + DIFF CHECKS

> Historical premise notice (D620): the per-node Actor/guard ABAC premise below is superseded for
> clean-slate GraphReFly. Product authorization is an explicit operation-specific graph boundary over
> bounded request, external outcome and current fence facts. This notice does not redesign or approve
> the separate stacked-diff product concept.

The user's observation was that every node can have guards, and guards can express ABAC. This is a
strong fit for runtime ownership enforcement, but it is not sufficient by itself for source-code
ownership.

Split the ownership system into layers:

```text
Blueprint = address book / lookup index
OwnershipPolicy = authority
Node guards = runtime enforcement points
Diff checker = source-code enforcement point
Stacked PR = delivery/review vehicle
Lease provider = distributed coordination mechanism, if needed
```

Runtime ABAC can answer:

- Can this actor emit to this state node?
- Can this actor rewire this graph/component?
- Can this actor trigger this effect?
- Can this WorkUnit mutate this owned runtime resource?
- Is the actor's lease still valid?

Example attributes:

```json
{
  "subject": {
    "actorId": "agent-17",
    "kind": "agent",
    "role": "implementation-agent",
    "workUnitId": "refresh-runtime"
  },
  "resource": {
    "graphId": "auth",
    "nodeId": "auth.refresh.status",
    "owner": "team-auth",
    "safety": "normal"
  },
  "action": "write",
  "context": {
    "branch": "agent/refresh-runtime",
    "baseBlueprintHash": "bp_abc123",
    "leaseToken": "lease_123"
  }
}
```

Source-code edits still need a diff checker because an agent changing files through shell/editor
happens outside the running graph. The diff checker maps changed files/ranges back to blueprint
claims and WorkUnit allowed scopes.

Conclusion from the discussion:

```text
Use ABAC node guards as enforcement machinery, not as the entire ownership system.
```

## PART 6: CLI/MCP POSITION

The thread also revisited CLI vs MCP.

Current preferred shape:

- CLI first, with strict `--json` outputs.
- MCP as an optional projection later, if agent clients benefit from discoverable typed tools.
- One shared core operation layer should back both surfaces.

Potential CLI surface:

```bash
graphrefly stack plan "add refresh token support" --json
graphrefly stack start auth-schema
graphrefly stack check --unit auth-schema --json
graphrefly stack pr-body --unit auth-schema
graphrefly stack submit --via graphite
```

Potential MCP tools later:

```text
stack_plan(task)
stack_start(unitId)
stack_check_diff(unitId)
stack_explain_violation(path)
stack_pr_body(unitId)
```

This follows the existing roadmap direction where the library removed a bundled MCP server from
scope, while CLI/surface operations remain useful for humans, CI, and shell-capable agents.

## PART 7: MINIMUM VIABLE PRODUCT

Smallest useful MVP:

1. Generate a `ChangePlan` from a task plus current `GraphBlueprint`.
2. Represent each WorkUnit with `claims`, `allowedFiles`, `dependsOn`, and `checks`.
3. Implement `graphrefly stack check --json` against the current git diff.
4. Emit a PR body section with affected blueprint nodes, required checks, and base blueprint hash.
5. Later add a Graphite adapter for branch creation/submission/restack metadata.

Not MVP:

- Automatic safe splitting of an arbitrary finished mega-PR.
- Replacing Git/Graphite with a new VCS.
- Distributed lease provider.
- Full ABAC policy language.
- Bundled MCP server.

## PART 8: OPEN QUESTIONS

1. **Artifact naming:** `ChangePlan` vs `StackPlan`. Current lean: `ChangePlan` for GraphReFly-owned
   semantic plan; Graphite owns "stack" terminology.
2. **Resource granularity:** should claims address `node`, `subgraph`, `sourceRange`, `file`, or
   `wire-connected component` first?
3. **Ownership authority:** where does the first `OwnershipPolicy` live: repo file, generated temp
   artifact, PR body metadata, or graph meta projection?
4. **Guard surface:** which runtime operations are guardable in v0: state emit only, rewire, effect
   trigger, or all graph mutations?
5. **Diff mapping:** how robust must sourceRange mapping be in the first version? File-level
   `allowedFiles` may be enough for the MVP; source ranges can follow.
6. **Graphite integration:** call Graphite CLI directly, consume Graphite MCP, or produce metadata
   only and let the user/agent call Graphite?
7. **Causal conflict UX:** how should a human understand "this WorkUnit violates a downstream causal
   invariant" in a PR review?

## PART 9: RESEARCH SOURCES

External sources consulted during the thread:

- Graphite stacked PRs: https://graphite.com/blog/stacked-prs
- Graphite stacked diffs guide: https://graphite.com/guides/stacked-diffs
- Graphite review best practices: https://graphite.com/docs/best-practices-for-reviewing-stacks
- Graphite evaluating stacking tools: https://graphite.com/docs/evaluating-tools
- Graphite CI optimizer: https://graphite.com/docs/stacking-and-ci
- Graphite GT MCP: https://graphite.com/docs/gt-mcp
- Sapling source control overview: https://engineering.fb.com/2022/11/15/open-source/sapling-source-control-scalable/
- ReviewStack / stacking resources: https://www.stacking.dev/
- Oak: https://oak.space/ and https://oak.space/docs
- re_gent: https://github.com/regent-vcs/re_gent
- GitButler stacked branches: https://docs.gitbutler.com/features/branch-management/stacked-branches
- Jujutsu docs: https://docs.jj-vcs.dev/latest/

## PART 10: RELATED LOCAL CONTEXT

- `../graphrefly-ts/packages/ts/src/graph/blueprint.ts`: current GraphBlueprint boundary and schema.
- `../graphrefly-ts/docs/roadmap.md` Wave 2: "Shared Blueprint" positioning and CLI/MCP history.
- `../graphrefly-ts/docs/implementation-plan.md` Phases 14-16: changesets/diff, eval, CLI/launch wave.
- `sessions/active/SESSION-clean-slate-redesign.md`: current clean-slate authority.
- `../graphrefly-ts/archive/docs/SESSION-reactive-linear-and-git.md`: prior discussion on
  causal-dimension collaboration, ownership lifecycle, blueprint as lookup index, static fission,
  and wire-aware reachability prerequisite.

## PART 11: 2026-09-06 ARCHIFY / CODEGRAPH RESEARCH CONTINUATION

### Classification and authority boundary

This is a dated, non-locking research continuation prompted by a user-provided comparison of
Archify, CodeGraph, GraphReFly, and GraphReFly Stack. It records external landscape evidence and
questions for later discussion. It does not amend the historical proposals in Parts 1-8 and does
not create a decision, work item, execution authorization, implementation claim, or phase change.

Current Stack product truth remains in its owner-local records:

- `graphrefly-stack:D54-D59` define Stack as the read-only-by-default linkage and projection layer,
  with source, topology, policy, test, verifier, runtime, and Canvas truth retained by their owners.
- `graphrefly-stack:C60-C64` define SourceAnchor / ResolutionResult / GraphSourceBinding,
  EvidenceManifest, ConsequenceProjection, orthogonal review state, and optimistic overlap guidance.
- `graphrefly-stack:SC12` is the retained RefreshSession source-to-consequence flagship.
- The approved order remains `STACK-SOURCE-BOUND` -> `STACK-EVIDENCE-MANIFEST` ->
  `STACK-CONSEQUENCE-REVIEW` -> `STACK-GROUNDED-HANDOFF`.

The Stack working tree may contain implementation or evidence under active development. This
research capture neither validates nor supersedes that work; canonical phase and milestone records
remain the only completion authority.

### Topic, trigger, and angle

- **Topic:** what GraphReFly and Stack should learn from agent-oriented code graphs and validated
  architecture-diagram systems.
- **Trigger:** the Archify/CodeGraph comparison supplied by the user, followed by a current landscape
  and repository-authority check.
- **Angle:** whether source discovery, evidence linkage, consequence review, or visual presentation
  is the durable differentiator for Stack.

### Updated conclusion

The useful system boundary is:

```text
source-intelligence provider discovers candidate code relationships
  -> Stack binds exact source revision to GraphReFly executable identity
  -> owner-linked evidence establishes provenance, freshness, and coverage
  -> deterministic consequence projection separates direct, structural, verified-unchanged, and unknown
  -> renderer or LLM explains the already-established result
```

Source graph construction and polished architecture rendering are becoming commodity capabilities.
Stack's differentiated opportunity is not another general parser or diagram editor; it is the
revision-bound correspondence and review consequence between ordinary source changes and executable
GraphReFly identity.

### External landscape findings

1. **Code graphs are moving into agent and pull-request workflows.** CodeGraph exposes callers,
   impact, related tests, stale documentation, and PR context, while GitNexus combines a local graph,
   MCP, skills, and hooks that enrich ordinary agent navigation. This validates a provider seam, not
   Stack ownership of a universal language index.
   Sources: [CodeGraph](https://github.com/codegraph-ai/CodeGraph),
   [GitNexus](https://github.com/abhigyanpatwari/GitNexus).

2. **Context efficiency is real but does not establish completeness.** The 2026 Codebase-Memory
   evaluation reports roughly ten times fewer tokens and 2.1 times fewer tool calls across 31
   repositories, while answer quality remained below a file-exploration agent. Discovery coverage
   and factual authority therefore need to stay explicit.
   Source: [Codebase-Memory](https://arxiv.org/abs/2603.27277).

3. **Architecture-as-code and agent-authored diagrams have strong community pull.** Archify uses
   typed authored IR plus deterministic validation; LikeC4 generates multiple views from a single
   architecture model. Both improve communication, but neither makes an authored relationship into
   executable or runtime truth.
   Sources: [Archify](https://github.com/tt-a1i/archify),
   [LikeC4](https://github.com/likec4/likec4).

4. **Precise and heuristic source intelligence are separating.** Sourcegraph distinguishes
   search-based navigation from compiler-backed SCIP indexes and recommends CI-produced indexes for
   complex builds. A first Stack source-binding proof should therefore measure resolver disposition
   and coverage rather than assuming one parser is authoritative.
   Sources: [Sourcegraph code navigation](https://sourcegraph.com/docs/code-navigation),
   [precise SCIP navigation](https://sourcegraph.com/docs/code-navigation/precise-code-navigation).

5. **Revision-bound provenance already has established external vocabulary.** SLSA describes
   provenance in terms of exact revisions, expected issuers, predicates, and separately owned review,
   test, and scan attestations. EvidenceManifest can learn from this ref-first model without turning
   Stack into a supply-chain security authority.
   Sources: [SLSA build provenance](https://github.com/slsa-framework/slsa/blob/main/spec/build-provenance.md),
   [SLSA source attestations](https://slsa.dev/spec/v1.2-rc1/source-requirements).

6. **Agent adoption increases the need for review context.** Anthropic's 2026 analysis covers about
   400,000 coding-agent sessions, while an industrial study of AI code review reports diff-only
   context blindness and demand for repository-wide context. These are demand signals for grounded
   review, not proof that any code graph supplies complete impact truth.
   Sources: [Claude Code usage research](https://www.anthropic.com/research/claude-code-expertise),
   [industrial AI code-review study](https://www.sciencedirect.com/science/article/abs/pii/S016412122600302X).

### Corrections to the initial comparison

1. A cross-language GraphReFly conformance matrix should not be proposed as a new P0 artifact.
   `spec/conformance.jsonl` already owns the machine-readable scenario-to-rule and per-runtime status
   matrix. The remaining opportunity is a generated, revision-aware evidence view joining existing
   owner records; it must not become a second canonical matrix.

2. A broad "Protocol Evidence Graph" is too easy to turn into another authority. The safer shape is
   a derived evidence index over rule, decision, formal, conformance, implementation/test, release,
   and Stack binding refs. Root-owned protocol evidence and Stack-owned source bindings retain their
   separate owners.

3. Visualization belongs after exact selection. Root backlog `graphrefly:B134` already frames
   progressive topology navigation as deterministic projection over authoritative Blueprint,
   describe, and retained-evidence coordinates, with structural reach kept distinct from causal
   occurrence. Archify-style presentation can consume that output but must not define it.

4. At the time of the research, existing Stack repository review already paired each Git revision
   with a real GraphBlueprint and structural/code delta. The missing product distinction was the
   finer changed-symbol -> exact node binding and its coverage-aware consequence projection, which is
   precisely the boundary later locked by D55-D59 and C60-C64.

### Competitive interpretation for Stack

| System | Strongest capability | Boundary relevant to Stack |
|---|---|---|
| GitNexus / CodeGraph | source discovery, callers, impact candidates, agent context | optional resolver/discovery provider; cannot establish GraphReFly identity or runtime causality |
| Sourcegraph / SCIP | compiler-precise, revisionable symbol navigation | candidate authoritative resolver input when supported; index availability and version stay explicit |
| Archify | typed, validated, reviewable communication artifact | downstream renderer only; authored reach is not consequence evidence |
| LikeC4 / Structurizr | one architecture model projected into scoped views | useful view discipline; separate authored model can still drift from executable topology |
| CodeQL / SLSA | deterministic query/attestation and CI integration | useful provenance, version, issuer, and fail-closed patterns; different product authority |
| GraphReFly Stack | exact linkage between source, executable GraphBlueprint identity, owner evidence, and review projection | differentiation remains unproven until the retained SC12 vertical supplies accepted evidence |

### Plan alignment

| Finding | Existing owner-local route | Current research disposition |
|---|---|---|
| revision-bound source anchor and symbol-to-node binding | `graphrefly-stack:STACK-SOURCE-BOUND`, C60 | aligned; no new work item |
| decision/policy/test/verifier freshness refs | `graphrefly-stack:STACK-EVIDENCE-MANIFEST`, C61 | aligned and deferred behind Source-Bound |
| direct/downstream/verified-unchanged/unknown consequence | `graphrefly-stack:STACK-CONSEQUENCE-REVIEW`, C62-C64 | aligned and deferred behind EvidenceManifest |
| progressive topology and causal navigation | `graphrefly:B134` | root-owned proposed work; do not duplicate in Stack |
| runtime occurrence evidence | root causal-occurrence and CSP-14 work | upstream-owned enrichment; not a Source-Bound prerequisite |
| cross-machine signed attestation | no current Stack tranche | revisit only when a real hosted/external issuer requires it |

### Deferred recommendations and discussion questions

The research suggests, but does not approve, the following later discussion topics:

- whether the first resolver evaluation should compare explicit metadata, TypeScript compiler/SCIP,
  and CodeGraph/tree-sitter against the same exact/moved/changed/ambiguous/deleted/dynamic-wrapper
  fixture;
- whether protocol evidence should surface primarily as a root-generated dashboard view or through a
  Stack EvidenceManifest consumer while preserving separate owners;
- whether the SC12 proof should optimize first for consequence precision or for measured reviewer
  comprehension and correction time;
- which empirical metrics are required before claiming product value: binding precision, unknown
  rate, test-selection precision, false-safe rate, correction time, and no-LLM byte equivalence.

These questions are intentionally left open for the user's later return. They do not change the
current phase, select a provider, authorize implementation, or admit a new backlog record.
