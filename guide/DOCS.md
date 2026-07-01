# Docs Guide

GraphReFly uses one canonical source for each documentation concern.

## Authority Records

- `spec/rules.jsonl` is the protocol rule authority.
- `spec/conformance.jsonl` is the behavioral parity authority.
- `decisions/decisions.jsonl` is the architectural decision authority.
- `plan/phases.jsonl` and `plan/backlog.jsonl` are the sequencer and deferred-work authority.
- `guide/guide.jsonl` is the guide registry; guide families should use guide-local JSONL record sets by default.
- `dashboard/dashboard.html` is generated from those records and is the internal authority/control view, not a second source.

Legacy prose such as `GRAPHREFLY-SPEC.md` and `COMPOSITION-GUIDE*.md` remains migration material until clean content is represented in structured records.

## Website Ownership

The shared public website lives in this repo under `website/`. `graphrefly.dev` is the curated external developer docs site, not the full internal dashboard. Public pages should render user-facing views from selected records:

- Learn/getting-started.
- Core concepts.
- Composition patterns.
- Examples and recipes.
- Package entry points.
- Curated reference/guarantees.

Internal/maintainer views stay in the generated dashboard and raw repo records:

- Full D-numbered decision log.
- Full protocol rules and conformance coverage.
- Backlog, phases, sessions, gaps, orphans, and project-control state.
- Dashboard search and status gates.

Language package docs remain package-local:

- `/ts/` delegates to `graphrefly-ts` for TypeScript API docs, examples, demos, and package release material.
- `/py/` delegates to `graphrefly-py` for Python MkDocs and mkdocstrings output.
- `/rust/` delegates to `graphrefly-rs` for rustdoc, examples, crate docs, and package release material.

Do not copy generated TypeScript, Python, or Rust API docs into this repo. Do not hand-maintain mirrors of language package APIs in the shared site. Link or delegate instead.

### Public Build Report

The website build writes `website/dist/_meta/public-content-report.json` as a deploy-inspection artifact. It summarizes rendered public pages, their source JSONL when applicable, package-owned outbound links, provenance anchors, and the no-public-dashboard-link policy. It is generated metadata, not a new authority source or primary public route.

Run `npm run docs:public:check` before publishing public docs changes. It builds the website, runs the internal dashboard consistency gate separately, scans rendered public links, rejects public dashboard/status links, and validates the public build report.

## JSONL Docs

New shared docs content should default to JSONL records with stable ids, audience/publicness metadata, summaries, body fields, source refs, and links to governing rules, decisions, conformance scenarios, or examples when applicable.

Use `guide/guide.jsonl` as the registry. Use guide-local record sets such as `guide/learn.jsonl`, `guide/concepts.jsonl`, `guide/composition.jsonl`, `guide/examples.jsonl`, `guide/testing.jsonl`, and `guide/contribute.jsonl` for the content the website renders. Long-form markdown is migration/reference material unless a future decision explicitly makes it canonical for a concern.

### Public Guide Record Shape

Public guide records use this shape:

```json
{
  "id": "composition.tiny-graph",
  "title": "Tiny Graph",
  "area": "composition",
  "kind": "walkthrough",
  "audience": ["developer"],
  "publicness": "public",
  "status": "active",
  "owner": "graphrefly",
  "canonical_repo": "graphrefly",
  "route": "/composition",
  "public_summary": "One public-facing summary.",
  "public_sections": [
    { "heading": "Build", "body": ["Short public paragraphs."], "bullets": ["Optional public bullets."] }
  ],
  "refs": {
    "decisions": ["D563"],
    "rules": ["R-push-subscribe"],
    "conformance": [],
    "sources": ["COMPOSITION-GUIDE.md"]
  },
  "package_refs": [
    { "package": "ts", "label": "@graphrefly/ts docs", "href": "/ts/" }
  ],
  "render_policy": {
    "primary": true,
    "render_refs": "provenance-only",
    "api_docs": "delegate"
  }
}
```

`publicness` is an enum: `public`, `maintainer-link`, `internal`, or `archive-source`. Primary public routes render only `public` records. `refs` are provenance and may be shown as compact source anchors; public pages must not render raw decision, rule, conformance, backlog, session, or dashboard text as their main content. `package_refs` may link to language-local docs or runnable examples but must not copy generated API references, package release material, or demo bodies into this repo.

### Public Reference Records

`guide/reference.jsonl` is the curated public guarantee layer for `/reference`. It is for terse developer-facing commitments such as predictable joins, honest missing input, package-local API ownership, and behavior-level cross-language consistency. It is not a public dashboard, a raw protocol browser, a conformance matrix, or a generated package API mirror.

Reference records use the public guide shape with these stricter constraints:

- `area` is `reference`, `kind` is `guarantee`, and `route` is `/reference`.
- `audience` includes `developer`; `publicness` is `public`; `status` is `active`.
- `owner` and `canonical_repo` are `graphrefly`.
- `render_policy.primary` is `true`, `render_policy.render_refs` is `provenance-only`, and `render_policy.api_docs` is `delegate`.
- `package_refs` delegate only to `/ts/`, `/py/`, and `/rust/`.
- `refs` may cite decisions, rules, and conformance scenarios only as provenance anchors. Do not paste raw rule, decision, conformance, backlog, session, dashboard, or legacy markdown text into public fields.
- Public prose should lead with developer outcomes. Internal protocol terms may appear in provenance or package-local docs, not as public headlines.

### Public Package Entry Records

`guide/packages.jsonl` is the shared site package directory for `/packages`, `/ts`, `/py`, and `/rust`. It records where package-owned docs live and what each package owns. It is not a generated API reference, package demo mirror, release-note mirror, or install/reference body.

Package entry records use this stricter shape:

- `area` is `packages`, `kind` is `package-entry`, and `package` is `ts`, `py`, or `rust`.
- `route` is the matching public package route: `/ts`, `/py`, or `/rust`.
- `canonical_repo` is the language package repo (`graphrefly-ts`, `graphrefly-py`, or `graphrefly-rs`).
- `entry_links` point to package-owned docs/repo surfaces. They may be shown as outbound links, not copied into the shared site.
- `refs.decisions` cites `D32` and `D563`; refs remain compact provenance anchors only.
- `render_policy.api_docs` and `render_policy.package_docs` are both `delegate`.
- Public prose should describe ownership and next-step links only. Do not include code snippets, generated API bodies, symbol tables, demos, release notes, or package-local examples.

## Migration Rules

- Re-home only clean authority content into the shared site.
- Use old `graphrefly-ts/website` assets and components as visual or tooling reference only.
- Reject stale pre-clean-slate content, retired root-package material, structural parity narratives, old port-ledger material, and package-specific API pages.
- Any future change that makes the shared site authoritative for package APIs, package demos, generated references, package releases, or deploy ownership needs a new decision before implementation.
