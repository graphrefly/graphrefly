# graphrefly — clean-slate agent context (lang-neutral authority)

> **Branch `clean-slate`.** This repo is the **language-neutral authority** for the
> greenfield redesign: protocol spec, decisions, sequencer, design sessions, guides.
> Per-language implementations live in sibling repos `graphrefly-{ts,rust,py}` (each a
> self-contained package — substrate + sugar + operators; no cross-language peer-deps,
> D32). **This is a single-source index — it points, it does not duplicate.**

## What changed vs the old `main` (read first)

Clean-slate (no backward compat). Big deltas locked in **DS-1** (`sessions/active/SESSION-clean-slate-redesign.md`):
- **graph = single-thread causal domain** (D22) — Rust drops actor model, Py drops subgraph locks; rewire intra-graph only.
- **behavioral parity replaces structural `Impl`** (D24) — cross-track-ledger retires; parity = conformance scenarios + property mirror.
- **per-language independent packages** (D32) — drops D080/D206 (substrate/presentation napi split).
- **config singleton dissolved** (D26); clock graph-local; messageTier compile-time const.
- **ctx.up/down(msgs)** fn surface (D8); handle = pure data (D7); 9 tiers + PAUSE/RESUME (D9).
- **docs = jsonl + generated dashboard** (decision 2/3) — see below.

## Documentation system (jsonl source of truth + generated dashboard)

All structured records are **jsonl** (single source of truth). Prose stays markdown but each
has a jsonl index row. The **dashboard** (`dashboard/`) renders everything into one searchable
HTML view (progress / structure / gaps). Schema contract: `dashboard/README.md`.

| Concern | File | Skill that writes it |
|---|---|---|
| **Decisions (why)** — unified D# log | `decisions/decisions.jsonl` | `/decision-guard` (read) · locked via `/design-review` → `/dev-dispatch` |
| **Sequencer (what next)** — single canonical | `plan/phases.jsonl` | `/dev-dispatch` |
| **Backlog + deferred** | `plan/backlog.jsonl` | any |
| **Anti-patterns (lessons)** | `plan/antipatterns.jsonl` | `/qa` |
| **Protocol rules (the constitution)** | `spec/rules.jsonl` (+ `PROTOCOL.md` prose intro, `protocol.proto` IDL — pending CSP-0) | `/spec-amend` |
| **Conformance (parity)** | `spec/conformance.jsonl` | `/conformance` |
| **Flowcharts (teaching)** | `spec/flowcharts.jsonl` (structural ones auto-gen in dashboard) | `/spec-amend` |
| **Design sessions** | `sessions/sessions.jsonl` + `sessions/active/*.md` → `sessions/archive/*.md` | any |
| **Guides (prose)** | `guide/guide.jsonl` + `COMPOSITION.md`/`DOCS.md`/`TEST.md`/`CONTRIBUTE.md` (pending migrate) | any |
| **Formal** | `formal/*.tla` (+ MC) | `/spec-amend` |

> Legacy prose docs (`GRAPHREFLY-SPEC.md`, `COMPOSITION-GUIDE*.md`) are the **old main** content,
> kept for migration into the jsonl system (backlog `B7`). Do not treat as clean-slate authority.

## Workflow rules (clean-slate)

- **spec-first** (F-NO-IMPL-DEFINED): any protocol change → `spec/rules.jsonl` + `formal/*.tla` + `spec/conformance.jsonl` **before** code (`/spec-amend`).
- **decision-first**: any architectural lock → `decisions/decisions.jsonl` D# before code.
- **single canonical per concern**: one sequencer (`plan/phases.jsonl`), one decision log (`decisions/`). No splitting.
- **archive = move, not mark**: resolved/superseded sessions move `active/` → `archive/`; status in jsonl, not prose tags.
- **dashboard check on commit**: `node dashboard/build.mjs --check` (non-zero on broken links/orphans).

## Run

```
node dashboard/build.mjs           # build dashboard.html + consistency report
node dashboard/build.mjs --check   # CI gate: broken links/orphans
```

Canonical design record: `sessions/active/SESSION-clean-slate-redesign.md` (DS-1).
