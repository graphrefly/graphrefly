# GraphReFly

> The reactive graph protocol authority for clean-slate GraphReFly.

This repo is the **language-neutral authority** for GraphReFly: protocol rules, decisions, conformance scenarios, formal models, guides, and the generated dashboard. Language-specific implementations live in their own repos:

| Repo | Language | Package |
|------|----------|---------|
| [graphrefly-ts](https://github.com/graphrefly/graphrefly-ts) | TypeScript | `@graphrefly/ts` |
| [graphrefly-py](https://github.com/graphrefly/graphrefly-py) | Python | `graphrefly` |
| [graphrefly-rs](https://github.com/graphrefly/graphrefly-rs) | Rust | `graphrefly` crates |

## Authority

- **[`spec/rules.jsonl`](./spec/rules.jsonl)** — protocol rules.
- **[`spec/conformance.jsonl`](./spec/conformance.jsonl)** — behavioral parity scenarios.
- **[`formal/`](./formal/)** — TLA+ models.
- **[`decisions/decisions.jsonl`](./decisions/decisions.jsonl)** — D-numbered decision log.
- **[`guide/guide.jsonl`](./guide/guide.jsonl)** — guide index.
- **[`dashboard/`](./dashboard/)** — generated searchable view over the authority records.

Legacy prose docs such as `GRAPHREFLY-SPEC.md` and `COMPOSITION-GUIDE*.md` are retained as migration material. Treat the structured records above as canonical.

## Website

The shared website shell lives in [`website/`](./website/). `graphrefly.dev` is the curated external developer docs site: learn, concepts, composition, examples, package entry points, and selected public reference/guarantees.

The generated dashboard remains the internal authority/control view over decisions, full rules, conformance, backlog, phases, sessions, and gaps.

Package API docs, examples, demos, and release material remain owned by the language repos and are linked or delegated under `/ts/`, `/py/`, and `/rs/`.

```bash
npm run website:build
npm run dashboard:check
npm run docs:public:check
```

## Dashboard

```bash
node dashboard/build.mjs
node dashboard/build.mjs --check
```
