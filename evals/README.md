# GraphReFly Evals — Language-Agnostic Artifacts

This directory holds eval artifacts shared across all GraphReFly implementations
(`graphrefly-ts`, future `graphrefly-py`). Everything here is **data and prose**, not code.

Runtime eval harnesses live in each implementation repo (e.g. `graphrefly-ts/evals/`).

## Structure

```
evals/
├── schema/          JSON Schemas for task definitions, results, and rubrics
├── corpus/          Eval task corpora (NL prompts, seeded bugs, etc.)
├── templates/       System prompt templates for LLM treatments
│   └── judge-prompts/   LLM-as-judge prompt templates
└── rubrics/         Scoring rubric definitions (assertion sets with weights)
```

## Adding a new eval task

1. Pick the corpus file matching your eval layer (L0: `contrastive-tasks.json`, L1: `nl-to-spec.json`, etc.)
2. Add a task object conforming to `schema/task.schema.json`
3. Run `pnpm eval` in the implementation repo to verify the new task passes schema validation

## Eval layers

| Layer | What it measures | Corpus file |
|-------|-----------------|-------------|
| L0 | Graph > Functions (contrastive A/B) | `contrastive-tasks.json`, `contrastive-bugs.json` |
| L1 | LLM-DX (zero-shot composition) | `nl-to-spec.json`, `nl-mod.json` |
| L2 | Dev-DX (onboarding, errors) | Lives in implementation repo (`dev-dx/`) |
| L3 | End-User UX (comprehension, trust) | `user-study-protocol.md` (manual) |

## Rubric format

Each rubric is a JSON array of assertions:

```json
[
  { "id": "validity", "claim": "The output is valid JSON conforming to GraphSpec schema", "weight": 2 },
  { "id": "runnable", "claim": "graphFromSpec(output) executes without error", "weight": 3 }
]
```

Weights determine relative importance when computing aggregate scores.
