# GraphReFly Website

This is the shared public shell for GraphReFly developer docs.

## Ownership

- `graphrefly` owns the public shell, curated developer docs, selected public reference/guarantee views, and the shared public visual system.
- `graphrefly-ts`, `graphrefly-py`, and `graphrefly-rs` own their API references, demos, examples, package-local docs generation, and package-specific release notes.
- Generated language API docs are linked or delegated from this shell. They are not copied into this repo.
- Internal dashboard/status artifacts stay outside the public website build and are not linked from public pages.

## Visual System

`website/src/styles/tokens.css` carries the migrated old GraphReFly website tokens: the lime-forward palette, navy preview surfaces, magenta accent, Big Shoulders Display headings, Sora body text, JetBrains Mono labels, and legacy demo aliases. Keep future public-site, package-docs, and demo-shell skin work aligned to these tokens before adding page-local colors or typography.

Reusable visual material means pure skin: tokens, static CSS patterns, renderer-owned HTML structure, and DOM-only presentation helpers. TS demo runtime modules, reactive-layout chapter builders, counters, package API helpers, and anything that imports `@graphrefly/ts` stay package-local. Do not create a shared docs-ui/demo-skin package until there is a real non-demo consumer and an approved dependency boundary.

## Commands

```bash
npm run website:build
npm run docs:public:check
```

The build is dependency-free. It copies only `website/public`, `website/src/styles`, and `website/src/scripts` into `website/dist`; every public HTML page is rendered directly at its final path from structured records. Home and Why read public copy from `guide/site.jsonl`. The homepage animation remains renderer-owned HTML/SVG in `website/scripts/home-showcase.mjs`, driven by the shared CSS and vanilla JavaScript. There is no React dependency and no intermediate `dist/routes` tree.

The shared document shell in `website/scripts/build.mjs` owns the repeated page frame: document metadata, favicon and stylesheet links, primary header/navigation, footer, and `site.js`. Page renderers provide only their `<main>` content. The shared site does not publish `/rs/`; Rust links go directly to the language-owned site at `rs.graphrefly.dev`.

`npm run docs:public:check` runs the website build, rendered public-link scan, public dashboard/status isolation checks, and public content report validation. The dashboard consistency gate is intentionally separate so the public-site checker remains focused on the artifact it accepts.

Run the internal dashboard gate after changing jsonl or guide records:

```bash
npm run dashboard:check
```

## Publish Flow

GitHub Pages publishes only the checked public artifact:

1. `npm run dashboard:check`
2. `npm run docs:public:check`
3. upload `website/dist`
4. deploy with GitHub Pages

The workflow lives at `.github/workflows/pages.yml`. It intentionally does not install package dependencies because the public website build is dependency-free and this repo currently has no npm lockfile. `website/public/CNAME` contains `graphrefly.dev` so the Pages artifact includes `dist/CNAME`; changing live DNS records is a separate manual operation and is not part of this repository slice.

The public gate must stay strict: no dashboard/status routes, no dashboard links, no internal route links, no package API mirrors, and no generated language reference copies in `website/dist`.
Its source-mapping report is written to the ignored `website/.generated/` check workspace, never to the deployed Pages artifact.
