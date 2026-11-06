# Handoff to Codex: reorganize GraphReFly documentation to the photo-scenes standard

Written by Claude on 2026-11-05 at the user's request. Work item: [graphrefly:B142](../../plan/backlog.jsonl).
This is a task brief, not a rule or decision. Records you write are in English; you may talk to the
user in Chinese.

## Goal

Make the GraphReFly documentation as easy to enter and maintain as
[photo-scenes](../../../photo-scenes/README.md): a reader (person or agent) should find what applies
now, why, what is being done and what was actually checked, in a few clicks, without reading history.
Apply it to the root repository first, then the related repositories listed below.

## Read first

1. The standard, in `~/src/photo-scenes`: [AGENTS.md](../../../photo-scenes/AGENTS.md),
   [README.md](../../../photo-scenes/README.md), [docs/README.md](../../../photo-scenes/docs/README.md),
   the "Language", "Document ownership and review" and "Delivery workflow" sections of
   [docs/rules/project.md](../../../photo-scenes/docs/rules/project.md), and
   [TRASH-FILES.md](../../../photo-scenes/TRASH-FILES.md). Its commit "Slim the README into a short
   entry point" (2026-11-03) shows the intended README shape.
2. `~/.codex/skills/project-governance/SKILL.md` and its `references/rules-decisions-work.md`.
3. GraphReFly's [AGENTS.md](../../AGENTS.md), [README.md](../../README.md) and
   [authority/README.md](../../authority/README.md).

## The standard, as it applies here

- **Short entrypoints.** The root README answers "where things are" (a path table) and "where things
  stand" (links to the current status, rules and work), then how to start and a command table.
  AGENTS.md is an entrypoint that links; it does not hold policy prose that belongs in a rule,
  decision, guide or skill.
- **A documentation map.** One page with a table: category, the question it answers, current
  entrypoint, maintenance boundary. Categories: Rules, Draft rules, Decisions, Work, Evidence,
  Design/guides, Archive, Reference. Each concern has one canonical body; everything else links to it.
- **Rules read on their own.** A reader must not reconstruct current behavior from decisions or work.
- **Status words are explicit.** proposed / accepted / deferred / superseded, with absolute dates and
  who accepted. Nothing becomes accepted because it was written down or because a check passed.
- **Evidence is separate and dated.** Commands, results and limits; evidence is neither permission
  nor a decision.
- **Archive is a move, not a mark.** Historical material is moved unchanged apart from link paths.
- **Nothing is deleted outright.** Disposable files go to `TRASH/` (or the macOS Trash for large
  generated copies) with one line each in `TRASH-FILES.md`: what, from where, when, why, what replaces it.
- **Plain writing.** One idea per sentence, name the thing, avoid stacked nouns and chains of
  qualifiers. Prefer "D796 rules are drafts; none is active" over "concern-scoped draft revision set
  without conflating admission and completion".

## What stays as it is

- GraphReFly keeps its structured authority: `spec/rules.jsonl`, `spec/conformance.jsonl`,
  `decisions/*.jsonl`, `authority/*`, `plan/*.jsonl`, `formal/`, the dashboard and the public website.
  photo-scenes adopted GraphReFly's categories and chose plain Markdown for its own size; do not convert
  GraphReFly back to Markdown. Improve how these records are entered, mapped and explained instead.
- No change to protocol meaning: no rule statement, activation, decision body, conformance scenario or
  formal model edits. Decision and rule history is append-only; fix only link paths.
- Do not touch work that runs in parallel: the B140/B141 rows in `plan/backlog.jsonl`, DS-15, DS-16,
  `sessions/active/protocol-reconciliation-probes/`, and the kernel/module classification session that
  Claude is writing (it will appear in `sessions/active/` and `sessions/sessions.jsonl` as DS-17).
  When you edit a shared JSONL file, re-read it right before writing and change only your own rows.
- Do not switch branches, commit or push without the user's word. Leave other people's uncommitted
  changes alone and report them.

## Repositories and known hotspots

Measured by Claude on 2026-11-05; recheck before acting.

| Repository | Notes |
|---|---|
| `graphrefly` (root, first) | AGENTS.md is 9 KB and mixes entry links with policy. 17 files in `sessions/active/`, including the 980 KB DS-16 and the multi-thousand-line DS-1, whose later sections hold decision bodies (D683 onward) that belong in the decision ledger. Legacy prose `GRAPHREFLY-SPEC.md` and `COMPOSITION-GUIDE*.md` await migration (B7). README has no "where things stand". |
| `graphrefly-ts` | 1,137 Markdown files; most are `website/src` (leave the site content alone apart from broken links), `docs/design` (171), `archive/`. Has `GEMINI.md`, `llms.txt`, `TRASH-FILES.md` already. |
| `graphrefly-canvas` | About 4,700 Markdown files, almost all three copies of the same skills (`.agents/skills`, `.claude/skills`, `.agent/skills`) plus `.opencode/commands`. Propose one maintained copy with forwarders, as root GraphReFly does. |
| `graphrefly-stack` | Checked out on `codex/backend-continuation`, not `main`. Do not switch; report and work on what is checked out only if the user agrees. |
| `graphrefly-rs`, `graphrefly-py` | AGENTS.md 12 KB and 7 KB. Check entrypoints, docs map and links. |
| `graphrefly-react`, `-vue`, `-solid`, `-svelte`, `-nest`, `graphrefly-reactive-layout-node-canvas` | Small. Check only that README/AGENTS point to the right owners. reactive-layout has 2 uncommitted files. |

## How to proceed

1. **Inventory and proposal (read-only).** For each repository: current entrypoints, the documentation
   map you would write, files to move to archive or trash, duplicated bodies, broken links, and AGENTS
   prose to relocate (with its destination). Write it as one proposal in
   `sessions/active/SESSION-docs-reorganization.md`, indexed in `sessions/sessions.jsonl`, and stop for
   the user's approval. Mark anything that would change meaning as a question, not a change.
2. **Apply, one repository at a time,** in the order above, after approval. Keep each repository's
   change reviewable on its own.
3. **Check.** In the root run `npm run authority:check`, `npm run work:check`, `npm run test:authority`,
   `node dashboard/build.mjs --check` and `npm run docs:public:check`; in other repositories run their
   own documented checks and a link check. Record the commands and results as evidence linked from B142.
4. **Hand back** with a short list per repository: what moved, what was trashed, what is still open.

## Done when

- Each repository has a short README, a short AGENTS.md and one documentation map, all linking to the
  canonical bodies.
- No duplicated canonical body remains without a forwarder or a recorded reason.
- Every moved or trashed file is logged; no file was deleted outright.
- All gates above pass, and the evidence says which ones ran.
