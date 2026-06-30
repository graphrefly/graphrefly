# GraphReFly Website

This is the shared public shell for GraphReFly developer docs.

## Ownership

- `graphrefly` owns the public shell, curated developer docs, selected public reference/guarantee views, and dashboard-adjacent maintainer links.
- `graphrefly-ts`, `graphrefly-py`, and `graphrefly-rs` own their API references, demos, examples, package-local docs generation, and package-specific release notes.
- Generated language API docs are linked or delegated from this shell. They are not copied into this repo.

## Commands

```bash
npm run website:build
```

The build is dependency-free. It copies `website/src`, `website/public`, and the generated dashboard artifacts into `website/dist`.

Run the internal dashboard gate after changing jsonl or guide records:

```bash
npm run dashboard:check
```
