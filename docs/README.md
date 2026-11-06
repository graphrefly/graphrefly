# Documentation map

This is an internal navigation map. Canonical bodies remain in their structured
records or uniquely owned guides. Start with [the project overview](../README.md).

| Category | Question | Current entrypoint | Maintenance boundary |
|---|---|---|---|
| Rules | What applies now? | [Revision contract](../authority/README.md#protocol-revision-contract), [rule revisions](../spec/rules.jsonl), generated [current protocol](https://graphrefly.dev/protocol/) | Only activated terminal revisions enter the current projection; project documentation policy lives in [guide/docs.jsonl](../guide/docs.jsonl) |
| Draft rules | What remains proposed? | Inactive revisions in [rules](../spec/rules.jsonl), exposed separately by the [resolver/dashboard](../dashboard/README.md); [kernel classification](../sessions/active/SESSION-kernel-module-classification.md) is design input | Discussion acceptance and checks do not activate a revision; follow the owning work for next steps |
| Decisions | Why this choice? | [Owner/class locator](../authority/ledgers.jsonl), [admission contract](../authority/README.md#post-migration-decision-admission) | One origin-qualified body per owner; distinguish durable rationale from execution history |
| Work | What is being done, in which order? | [Work locator](../authority/work-ledgers.jsonl), [phases](../plan/phases.jsonl), [backlog](../plan/backlog.jsonl) | Work state, prerequisites and execution authorization remain distinct |
| Evidence | What was actually checked? | Owning work's evidence references; [indexed sessions](../sessions/sessions.jsonl), [conformance](../spec/conformance.jsonl), [formal artifacts](../formal/) | Dated results and source-bound receipts establish only their checked scope; they grant no approval |
| Design / guides | How do I understand or maintain it? | [Guide registry](../guide/guide.jsonl), [contributor records](../guide/contribute.jsonl), [session index](../sessions/sessions.jsonl) | Root shared guidance is JSONL; design drafts and teaching material do not define hidden rules |
| Archive | What did earlier records say? | [Archived sessions](../sessions/archive/), [older archive](../archive/), indexed by [sessions](../sessions/sessions.jsonl) | Historical bodies move intact apart from paths; archive is not a success or renewed authorization |
| Reference | What can inform further work? | Research in the [session index](../sessions/sessions.jsonl); [legacy spec](../GRAPHREFLY-SPEC.md) and [composition guide](../COMPOSITION-GUIDE.md), pending B7 in [backlog](../plan/backlog.jsonl) | Legacy/external material is not current protocol authority |

## Owners and updates

[Documentation policy](../guide/docs.jsonl) owns the shared/public/package boundary.
The public site teaches developers; the dashboard remains the internal control
view. Package API references, examples, demos and release notes stay package-owned.

Use [the authority contract](../authority/README.md) for admission, revision and
relocation mechanics, and [the workflow entrypoint](../AGENTS.md#workflow-routing)
for design, amendments, implementation and review. Personal classification and
execution boundaries stay in the linked governance skill, not this map.

DS-1 remains a design-history source at [its existing path](../sessions/active/SESSION-clean-slate-redesign.md).
Its D# discussions have corresponding ledger records; retaining their context does
not make the session a competing decision ledger. Mixed research/design sessions
stay in place until their open questions are reviewed. B7 still owns migration of
legacy prose. Neither clearer navigation nor a link check completes that work.

## Documentation reorganization

B142 owns this effort. The [approved proposal](../sessions/active/SESSION-docs-reorganization.md)
records the inventory; [execution evidence](../sessions/active/docs-reorganization-evidence/2026-11-05-root.md)
records the user's 2026-11-05 approval, actual moves, checks and limits. Stack is
read-only by that approval. Other active protocol reviews retain their own work
and are not part of this editorial batch.

[B142 closeout](../sessions/archive/docs-reorganization-evidence/2026-11-05-canvas-closeout.md) records current completion and scope; the [initial delivery snapshot](../sessions/archive/docs-reorganization-evidence/2026-11-05-summary.md) preserves the earlier open items and per-repository trail.
