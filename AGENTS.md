# GraphReFly agent entrypoint

Start with [README](README.md) and the [documentation map](docs/README.md).
This repository owns language-neutral protocol and cross-project authority.
Package and product bodies stay with their uniquely located owners.

## Read the owning source

- Current protocol and draft separation: [revision contract](authority/README.md#protocol-revision-contract)
  and [rule revisions](spec/rules.jsonl).
- Decisions and admission: [authority contract](authority/README.md),
  [ledger locator](authority/ledgers.jsonl).
- Work and execution scope: [work locator](authority/work-ledgers.jsonl),
  [phases](plan/phases.jsonl), [backlog](plan/backlog.jsonl).
- Documentation policy: [guide/docs.jsonl](guide/docs.jsonl).
- Contributor constraints, migration boundaries and shell notes:
  [guide/contribute.jsonl](guide/contribute.jsonl).
- Design history: [session index](sessions/sessions.jsonl). History does not
  replace the current activated rules or dispatch work.

Before authority/work changes or execution, spend, retry and stalled-work
classification, follow [personal project governance](/Users/davidchenallio/.codex/skills/project-governance/SKILL.md)
including its [rules/decisions/work separation](/Users/davidchenallio/.codex/skills/project-governance/references/rules-decisions-work.md).

## Workflow routing

| Concern | Maintained entrypoint |
|---|---|
| Contract and decision consistency | [decision-guard](.agents/skills/decision-guard/SKILL.md) |
| Protocol amendment | [spec-amend](.agents/skills/spec-amend/SKILL.md) |
| Behavioral evidence | [conformance](.agents/skills/conformance/SKILL.md) |
| Design / implementation / QA | [design-review](.agents/skills/design-review/SKILL.md), [dev-dispatch](.agents/skills/dev-dispatch/SKILL.md), [qa](.agents/skills/qa/SKILL.md) |
| Authority/work views | [dashboard](.agents/skills/dashboard/SKILL.md) |
| Research / protocol teaching | [research](.agents/skills/research/SKILL.md), [graph-animation](.agents/skills/graph-animation/SKILL.md) |
| Shared build / human review | [bmad-build](.agents/skills/bmad-build/SKILL.md), [bmad-checkpoint-preview](.agents/skills/bmad-checkpoint-preview/SKILL.md) |

Use the shared build workflow within the authorized local work. Human review uses
build-handoff mode after verification; explicit checkpoint or `--practice` requests
use interactive mode. Local authorities and gates still govern completion.
[Commands](README.md#start-locally) are listed in README. CLAUDE and package shared
workflow entries forward here or to the maintained skills; do not copy their bodies.
