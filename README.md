# GraphReFly

> Reactive graph protocol for human + LLM co-operation.

This repo is the **canonical home** for the GraphReFly protocol specification. Language-specific implementations live in their own repos:

| Repo | Language | Package |
|------|----------|---------|
| [graphrefly-ts](https://github.com/graphrefly/graphrefly-ts) | TypeScript | `@graphrefly/graphrefly-ts` |
| [graphrefly-py](https://github.com/graphrefly/graphrefly-py) | Python | `graphrefly` |

## Specification

- **[`GRAPHREFLY-SPEC.md`](./GRAPHREFLY-SPEC.md)** — Full behavior spec: messages, `node`, `Graph`, invariants, design principles.

The spec defines **behavior** — what implementations must do. Language-specific ergonomics (syntax, concurrency model, type encoding) are implementation choices.

### Key design principles (§5)

- Control flows through the graph, not around it
- No polling — reactive propagation only
- No imperative triggers — all coordination via reactive signals
- No raw async primitives in the reactive layer
- Central timer and messageTier utilities
- Phase 4+ APIs speak developer language, not protocol internals

## For implementers

Implementation repos pull the spec via their `sync-docs` scripts:

```bash
# In graphrefly-ts/website or graphrefly-py/website:
pnpm sync-docs          # copies spec + local docs into Astro site
pnpm sync-docs --check  # CI dry-run — exit 1 if stale
```

When updating the spec, coordinate changes across implementations:
1. Update `GRAPHREFLY-SPEC.md` here (with a version note per §8).
2. Open PRs in both `graphrefly-ts` and `graphrefly-py` to implement any behavioral changes.
3. Run `sync-docs` in each repo to pick up the new spec text.
