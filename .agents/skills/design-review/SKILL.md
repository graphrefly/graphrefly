---
name: design-review
description: Review GraphReFly language-neutral protocol and cross-project design choices, including historical reconciliation. Route package-only API design to its owner.
---

# Root design review

Read this repository's `AGENTS.md`, the shared
`~/.codex/skills/project-governance/references/rules-decisions-work.md`, and the relevant current
contract through [decision-guard](../decision-guard/SKILL.md). Resolve ownership through
`authority/ledgers.jsonl`; a TypeScript-only API question belongs to the TS package's design review,
while protocol and cross-project choices remain here.

Review the concrete concern through these lenses:

- Is this the right abstraction and owner? Distinguish protocol obligations from sugar policy.
- Are the contract, hidden assumptions, lifecycle and long-term costs explicit?
- Does a minimal composition preserve declared topology, message direction and dispatcher boundaries?
- What viable alternatives exercise the same concrete input/state trace, and what do they trade off?
- Which option is recommended, what remains uncertain, and what evidence would discriminate?

Follow relevant historical revisions, not just the first matching D#. Check interacting rules together.
An existing lock explains the current choice; it does not exempt that choice from a user-requested
reassessment. Separate report misreadings, stale history/work metadata, rule gaps/conflicts,
implementation deviations and ergonomics. Never use implementation agreement to resolve a rule conflict.

Keep review notes under the existing indexed session/review surface: rule references and proposed
wording; maintainer rationale and unresolved decisions; work candidates, owners, acceptance and evidence.
These notes are not additional canonical ledgers. A review-only request does not authorize normative
edits or runtime implementation. Prepare concrete proposals before requesting material decisions.

New material choices require user approval and owner-ledger admission under `authority/README.md`;
do not invent a D# for each finding. Protocol changes go through [spec-amend](../spec-amend/SKILL.md).
Use [bmad-checkpoint-preview](../bmad-checkpoint-preview/SKILL.md) for a requested walkthrough, with
the user's chosen topic order and interactive pacing. Show verified file/line stops and one concrete
trace at a time; record questions without prematurely choosing semantics.
