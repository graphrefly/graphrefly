---
name: dev-dispatch
description: Carry out authorized GraphReFly root protocol, formal, documentation or tooling work with owner-specific acceptance and gates; route runtime implementation to its package.
---

# Root dispatch

Read `AGENTS.md`, `authority/README.md`, and
`~/.codex/skills/project-governance/references/rules-decisions-work.md`.
Use [bmad-build](../bmad-build/SKILL.md) within the requested slice. Preserve existing staged,
unstaged and untracked changes. The current directory does not decide ownership.

Resolve work through `authority/work-ledgers.jsonl` and reuse its identity, scope and acceptance.
Read the affected current rules for behavior, the relevant decision chain for rationale/constraints,
and work for delivery/evidence. Do not reconstruct missing normative clauses from tasks or old D# text.
Surface unresolved semantic choices; continue independent authorized work while awaiting a decision.

Protocol changes follow [spec-amend](../spec-amend/SKILL.md) before runtime implementation. Root-owned
rules, formal models, conformance definitions, shared guides/site and authority tooling stay here.
Route package implementation to its repository and local dispatch/QA skills; retain exact root rule
and decision references without copying their bodies. Approval of a design alone is not runtime,
external-run or spend authorization.

Verify according to the changed surface:

- Rules/formal/scenarios: affected TLC and behavioral checks with exact model, command and source refs.
- JSONL: `node dashboard/build.mjs --check`.
- Owner-ledger changes: `npm run authority:check:workspace`.
- Authority resolver changes: its regression tests and relevant root package checks.
- Skills/docs-only changes: frontmatter, routing/reference and diff checks; no invented runtime tests.

Use [qa](../qa/SKILL.md) for one integrated review and the shared checkpoint preview for handoff.
Update only the owning work whose acceptance actually passed. Test success or task completion does
not activate a rule, settle an open design choice, or authorize a later action. Keep rule reconciliation,
decision rationale/approval and work/evidence distinct in the handoff.
