---
name: qa
description: Review GraphReFly root protocol consistency, formal and conformance evidence, documentation and authority tooling. Apply fixes only in an authorized implementation or QA-and-fix scope.
---

# Root QA

Read `AGENTS.md`, `authority/README.md`, and
`~/.codex/skills/project-governance/references/rules-decisions-work.md`.
Use `~/.codex/skills/bmad-build/references/qa.md` for one integrated review, retaining the root
domain checks here. A review-only invocation stays read-only, including authority records.

Recover the requested acceptance and baseline. Inspect affected current rules, rationale revisions,
work records and exact implementation/verification evidence. Keep them separate in the findings.

- **Rules:** correctness, scope completeness, concision, duplicates, contradictory obligations and
  missing cross-axis behavior. Test one input/state against all relevant rules. Check revision and
  activation explicitly; decisions and work cannot fill an unstated normative clause.
- **Decisions:** relevant refinement/supersession chain and surviving constraints. Do not treat
  obsolete examples as current APIs or conceal a material choice inside an editorial cleanup.
- **Work/evidence:** acceptance, exact source/command/result, missing cases and stale progress.
  A deferred task cannot waive a rule. Shared runtime behavior may still violate the specification;
  green formal checks prove only the actual model and checked invariants.

Classify report errors, historical drift, rule defects, implementation deviations and ergonomics before
triaging repairs. Keep unresolved semantics explicit. Use [design-review](../design-review/SKILL.md)
for material choices, [spec-amend](../spec-amend/SKILL.md) for approved protocol revisions, and the
package's dispatch/QA for runtime repairs. Do not mint decisions for attempts, findings or receipts.

Run only relevant verification: dashboard consistency after JSONL edits, workspace authority checks
after owner-ledger edits, resolver regression tests after resolver changes, affected TLC/scenario
checks for protocol/model changes, and format/link/routing checks for skills-only edits. Legacy
conformance pass fields and passing link gates do not prove current semantic correctness.

Report remaining rule issues, decision questions, and delivery/verification work separately with
verified file/line references. Finish with [bmad-checkpoint-preview](../bmad-checkpoint-preview/SKILL.md):
build-handoff for ordinary delivery, user-paced interaction for an explicit walkthrough.
