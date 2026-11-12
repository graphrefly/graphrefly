---
name: decision-guard
description: "GraphReFly clean-slate decision-consistency check. Resolves the federated owner ledgers plus the user's locked values/principles and recurring decision-process patterns. Use BEFORE answering consistency, scope, choice, or regression questions."
---

## Rules / decisions / work

Read `~/.codex/skills/project-governance/references/rules-decisions-work.md` before contract
analysis or record changes in this workflow. Resolve the current rules before using decision history
to explain them. Follow relevant refinements and supersessions; classify report misreadings,
historical drift, missing rules, and new choices separately. A locked D# or completed work item is
not a substitute for a current rule.

# decision-guard — recall and apply locked decisions, values, invariants (clean-slate)

Load and apply the personal `$project-governance` skill at
`~/.codex/skills/project-governance/SKILL.md` before classifying or appending any decision, work,
execution authorization, attempt, incident, receipt or evidence record. It supplies the cross-project
classification floor; this skill and the federated GraphReFly authorities still decide the unique
project owner and semantic consistency.

**Purpose.** Conversations lose context-window state quickly. This is the canonical recall
surface for the **clean-slate** redesign: invoke BEFORE answering decision questions to anchor
against the user's locked positions and prevent silent drift — especially when a chat proposes
a scope expansion mid-implementation, presents A/B/C as a fork, uses "completeness" to justify
expanding a locked slice, or builds on a premise that may be stale.

> Resolve authority by owner and current activation, not by a decision number's length.
> Old port narratives and retired contracts are history unless current rules explicitly retain them.

## Sources (resolve current rules first, then relevant rationale)

| Source | Role |
|---|---|
| `~/src/graphrefly/authority/ledgers.jsonl` + `authority/federation.mjs` | Owner/class locator and origin-qualified resolver. Run `npm --prefix ~/src/graphrefly run authority:check:workspace` when sibling ledgers matter. |
| `~/src/graphrefly/authority/README.md` + the resolved current `spec/rules.jsonl` revisions | Current protocol; distinguish activated revisions from drafts and history. |
| Governing owner ledger | Root durable `~/src/graphrefly/decisions/decisions.jsonl`, root eval/execution `decisions/execution.jsonl`, or the Canvas/Stack/package-local ledger selected by concern ownership. |
| `~/src/graphrefly/sessions/active/SESSION-clean-slate-redesign.md` (DS-1) | Full design narrative + 8 forced constraints + spec-amendment list + conformance hard scenarios. |
| `~/src/graphrefly/plan/antipatterns.jsonl` | Lessons / anti-patterns to flag against. |
| `~/src/graphrefly/spec/rules.jsonl` | Protocol rules — for "does the spec already pin this?". |
| Memory `feedback_*` files | The user's durable values/principles (below). |

## Locked values (durable — cite by name)

1. **No backward compat** (pre-1.0): structurally cleaner option, no legacy shims. `feedback_no_backward_compat`.
2. **Explicit reactive dependencies**: shared module state is an explicit node and dependency. Host state writes and lifetime `ctx.down` remain legal under current R-request-order/R-invocation; historical `ctx.up` guidance is not a current API contract.
3. **Single source of truth**: one canonical per concern; index points, never duplicates. `feedback_single_source_of_truth`.
4. **No autonomous decisions** (hard rule): surface unresolved semantic choices; do not silently redefine them. Carry out already-authorized repairs without a new approval per file. `feedback_no_autonomous_decisions`.
5. **No implement without approval**: decisions locked ≠ implementation approved. `feedback_no_implement_without_approval`.
6. **Verify premise before greenfield**: design tables lag code — inspect symbols + check landed markers before a 9Q; stale premise = HALT. `feedback_verify_premise_before_greenfield`.
7. **Latest versions + context7** for current API docs. `feedback_latest_versions_context7`.
8. **Long-command observation discipline** (run-logged + DONE sentinel; no tail; no sleep-poll) and **subagent bg hygiene** (sync-verify or teardown before return). `feedback_long_command_observation`, `feedback_subagent_bg_hygiene`.

## Clean-slate floor (never violate)

Read the activated kernel rules, currently the D797–D808 revisions, rather than applying
retired dispatcher, pool, tier or control-message designs as requirements:

- Declared acyclic dependencies; structural reachability does not establish runtime occurrence.
- Synchronous wave settlement; async work uses ordinary lifetime-bound late output.
- Message arrays preserve boundaries; kernel notification/settlement is distinct from author output.
- Dependencies are read only during the supplying invocation's setup/function execution.
- Graph reads/observation/holds use find, describe, observe, retain; diagnostics are module functions.
- Shared module state is a declared node/dependency; no hidden graph-global mutable owner.
- Protocol behavior is specified before implementation, with executable conformance and bounded models.

Flag a proposed protocol change without its owner decision and activated rule revision. Do not
resurrect dispatcher-only invocation, async-pool exclusivity, `ctx.up`, or retired control messages.

## Decision-process patterns (apply in order)

1. **Locate current rules and governing rationale.** Resolve the affected rules using the current-protocol projection and activation/transition contract in `authority/README.md`; missing activation is a finding, not permission to infer it. **Identify the governing origin-qualified D#.** Resolve through `authority/ledgers.jsonl`, then search the unique owner ledger. Bare historical refs resolve in their ledger origin; new cross-repo refs must use `origin:D#`. Mid-implementation scope expansion = anti-pattern unless promoted to a NEW owner-local record.
2. **Reconcile the spec.** Check the affected current rules together for duplication, contradiction, missing obligations and cross-axis behavior. Use decision revisions to recover rationale, not to supply hidden normative clauses. A clear rule/code deviation is an implementation finding; ambiguity or conflicting obligations requires explicit resolution before dependent changes. Historical D# examples may be obsolete even when their rationale survives.
3. **Verify premise (value 6).** Has the symbol/surface already landed? In a repository with a live
   `.codegraph` index, call `codegraph_explore` first for the exact source, callers/dependents, tests,
   export boundary, and blast radius. Treat its source as already read and query again only for uncovered
   paths. Use direct `rg`/Read for authority jsonl, docs, configs, git diff, untracked files, and
   stale/unindexed files; never initialize an index autonomously.
4. **Apply values + floor.** Especially: explicitly approved semantics, explicit dependencies, single source of truth, and the current synchronous kernel contract.
5. **Verdict:** cite current rule/revision and relevant qualified D#; distinguish `consistent`, `report misreading`, `stale history/work metadata`, `rule gap/conflict`, `implementation deviation`, `out-of-scope`, and `needs new decision`. Keep unverified claims explicit.
6. **Routing:**
   - New fork, no governing D# → present options + recommend, **do NOT lock** → that's `/design-review` → user approval → append `decisions.jsonl`.
   - Changes protocol behavior → `/spec-amend` (spec-first).
   - Cross-runtime parity concern → `/conformance` (behavioral scenario, not structural diff).

## Common decision shapes

- **A/B/C (fix shape):** default = the option that **structurally extends an existing pattern** beats per-site workarounds.
- **Completeness vs discipline:** if a proposal closes a real semantic gap → formalize as a NEW D# (don't continue under the original D's banner). If speculative scope expansion → revert.
- **Orthogonal sub-decisions:** before locking two "orthogonal" sub-decisions, sketch ONE input exercising BOTH — confirm orthogonality survives the example (antipatterns.jsonl; the 30-second check that catches coupling at design-time).

## Scope boundaries

Read-mostly. Loads decisions + values + patterns; produces **decision + reasoning + relay-ready text**.
Does NOT run gates, apply fixes, or author scenarios — those are `/dev-dispatch` / `/qa` / `/conformance`
after a decision locks. Invoke when the question is "what should I decide?", not "what should I do?".

## Update protocol

When a new durable D# locks (after user approval), verify that it represents a material semantic,
architectural, product, safety or authority-boundary decision and select the unique owner. Attempts,
incidents, receipts, reruns, provider/model changes and spend grants are not D# records. Use the
project's approved non-decision mapping when one exists; while `graphrefly:B137` remains proposed, do
not invent its schema or use a new execution D# as a substitute. Append a durable decision only to its
owner ledger; use qualified cross-repo refs and never copy the record body upstream.
Update a root session lock only for a root-owned decision. Run
`npm --prefix ~/src/graphrefly run authority:check:workspace` and
`node ~/src/graphrefly/dashboard/build.mjs --check`.
Record recurring anti-patterns through the owning authorized work. Update personal memory only when
the user explicitly requests it; this skill does not authorize memory writes.

Admission reminder: an approved new record uses the normal owner ledger and must satisfy
~/src/graphrefly/authority/README.md; historical-only ledgers are relocation destinations.
