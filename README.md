# GraphReFly

> The reactive graph protocol authority for clean-slate GraphReFly.

This repo is the **language-neutral authority** for GraphReFly: protocol rules, root/cross-project decisions, conformance scenarios, formal models, guides, and generated authority views. D783 routes Canvas, Stack, package-local, execution and receipt authority to owner/class ledgers as those migration batches are approved. Language-specific implementations live in their own repos:

| Repo | Language | Package |
|------|----------|---------|
| [graphrefly-ts](https://github.com/graphrefly/graphrefly-ts) | TypeScript | `@graphrefly/ts` |
| [graphrefly-py](https://github.com/graphrefly/graphrefly-py) | Python | `graphrefly` |
| [graphrefly-rs](https://github.com/graphrefly/graphrefly-rs) | Rust | `graphrefly` crates |

## Authority

- **[`spec/rules.jsonl`](./spec/rules.jsonl)** — append-only protocol rule revisions.
- **[`spec/conformance.jsonl`](./spec/conformance.jsonl)** — forward behavioral conformance scenarios.
- **[`formal/`](./formal/)** — TLA+ models.
- **[`decisions/decisions.jsonl`](./decisions/decisions.jsonl)** — root decisions plus legacy rows awaiting approved D783 relocation.
- **[`decisions/execution.jsonl`](./decisions/execution.jsonl)** — root-owned evaluation/execution history, hidden from the default product constitution.
- **[`authority/`](./authority/)** — generated-view resolver and fail-closed authority gates; no copied authority text.
- **[`guide/guide.jsonl`](./guide/guide.jsonl)** — guide index.
- **[`dashboard/`](./dashboard/)** — generated searchable view over the authority records.

Legacy prose docs such as `GRAPHREFLY-SPEC.md` and `COMPOSITION-GUIDE*.md` are retained as migration material. Treat the structured records above as canonical.

## Website

The shared website shell lives in [`website/`](./website/). `graphrefly.dev` is the curated external developer docs site: learn, concepts, composition, examples, package entry points, selected public reference/guarantees, and the D784-generated current protocol specification at `/protocol/` plus `/protocol/spec.json`.

The generated dashboard remains the internal authority/control view over decisions, full rules, conformance, backlog, phases, sessions, and gaps.

Package API docs, examples, demos, and release material remain owned by the language repos and are linked through https://ts.graphrefly.dev/, https://py.graphrefly.dev/, and https://rs.graphrefly.dev/.

```bash
npm run website:build
npm run authority:check
npm run authority:check:workspace
npm run test:authority
npm run dashboard:check
npm run docs:public:check
```

## Dashboard

```bash
node dashboard/build.mjs
node dashboard/build.mjs --check
```
