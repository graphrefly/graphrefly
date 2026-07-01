# GraphReFly Website

This is the shared public shell for GraphReFly developer docs.

## Ownership

- `graphrefly` owns the public shell, curated developer docs, selected public reference/guarantee views, and the shared public visual system.
- `graphrefly-ts`, `graphrefly-py`, and `graphrefly-rs` own their API references, demos, examples, package-local docs generation, and package-specific release notes.
- Generated language API docs are linked or delegated from this shell. They are not copied into this repo.
- Internal dashboard/status artifacts stay outside the public website build and are not linked from public pages.

## Visual System

`website/src/styles/tokens.css` carries the migrated old GraphReFly website tokens: the lime-forward palette, navy preview surfaces, magenta accent, Big Shoulders Display headings, Sora body text, JetBrains Mono labels, and legacy demo aliases. Keep future public-site, package-docs, and demo-shell skin work aligned to these tokens before adding page-local colors or typography.

## Commands

```bash
npm run website:build
npm run docs:public:check
```

The build is dependency-free. It copies `website/src` and `website/public` into `website/dist`, renders JSONL-backed public routes, and writes deploy metadata to `website/dist/_meta`.

`npm run docs:public:check` runs the website build, internal dashboard consistency gate, rendered public-link scan, public dashboard/status isolation checks, and public content report validation.

Run the internal dashboard gate after changing jsonl or guide records:

```bash
npm run dashboard:check
```
