# GraphReFly documentation reorganization proposal

Date: 2026-11-05 (America/Los_Angeles). Author: Codex. Status: **proposed**.
User acceptance: **not yet given**. Owner: `graphrefly:B142`.

This is the inventory and proposal requested by the
[handoff](HANDOFF-codex-docs-reorganization.md). It is work material, not a rule,
decision, implementation approval, or completion receipt. No documentation has
been moved or trashed. No branch has been switched, committed, or pushed.

## 1. Review order and approval boundary

Read sections 2–4 for the common structure, section 5 for the root repository,
then sections 6–10 for the related repositories. Section 11 lists the proposed
move and trash batches. Section 12 separates questions from editorial work.
Section 13 defines acceptance and checks; section 14 records this inventory's evidence.

The requested next approval is for the editorial batches described here, starting
with the root. Stack needs an explicit choice about its existing branch.
Items marked **hold** are excluded from routine editorial approval. Their meaning,
historical status, or loading behavior needs more evidence or a separate choice.
Approval of this proposal will not approve protocol changes, rule activation,
decision-body migration, runtime changes, publishing, commits, or pushes.

The governing sources are [the authority contract](../../authority/README.md),
[the decision locator](../../authority/ledgers.jsonl),
[the work locator](../../authority/work-ledgers.jsonl), and the documentation
policy in [guide/docs.jsonl](../../guide/docs.jsonl). The relevant rationale is
`graphrefly:D563`, `graphrefly:D783`, `graphrefly:D784`, and `graphrefly:D787`.
Personal process follows project-governance and the shared BMAD build/review skills.

## 2. Observed checkout baseline

All observations below are from 2026-11-05. No fetch or branch switch was used.
Counts use `rg --files --hidden` with `.git`, dependency/build directories and
`TRASH` excluded. They count discoverable Markdown, not every ignored/generated
file on disk. The handoff's earlier counts use a different snapshot or scope.

| Repository | Branch | HEAD | Markdown | README / AGENTS bytes | Existing state |
|---|---|---|---:|---:|---|
| graphrefly | main | `4e0eb2015bb8ab30b22a3869229f54de7cc69ed1` | 126 | 2,730 / 9,137 | Modified backlog and session index; untracked handoff and DS-17 |
| graphrefly-ts | main | `88f230fb88b483d0e90c0ef29527b3e4ef0e373c` | 1,116 | 7,404 / 9,237 | Clean |
| graphrefly-canvas | main | `8a834b7141c835b93d047a4cb04ba6a92186ee7e` | 4,739 | 1,798 / 5,897 | Clean |
| graphrefly-stack | codex/backend-continuation | `ca76bf654f2284024bfdbe651de1326ef9c42d36` | 19 | 17,466 / 2,166 | Clean; writes held pending branch agreement |
| graphrefly-rs | main | `b2bd4968fa301cb40a7826a97bb20d25e50384cb` | 19 | 7,727 / 12,049 | Clean |
| graphrefly-py | main | `0d96c4692adadc47f3c40397e32ef81f9abb1d4f` | 92 | 7,143 / 7,213 | Clean |
| graphrefly-react | main | `d316a8840ffeefe148ef700bf6dfdafdc7d3f2f8` | 9 | 3,345 / 1,436 | Clean |
| graphrefly-vue | main | `c9a70f07477aaf86a99203826b635232a5096354` | 7 | 111 / 1,412 | Clean |
| graphrefly-solid | main | `3808369a319affd6956e09a3ca3a1e3f4eb3edaa` | 7 | 115 / 1,416 | Clean |
| graphrefly-svelte | main | `f7e6c93775a42917162057636606b4d0be3086c5` | 7 | 117 / 1,418 | Clean |
| graphrefly-nest | main | `99daec644e49e64f1a75ef368ca8393d1a58ae72` | 7 | 457 / 1,416 | Clean |
| graphrefly-reactive-layout-node-canvas | main | `26fcf625eec38903b43aa89f21e7b142fffb3139` | 7 | 1,012 / 1,457 | Four untracked files listed below |

The root's existing changes are `plan/backlog.jsonl`, `sessions/sessions.jsonl`,
`sessions/active/HANDOFF-codex-docs-reorganization.md`, and
`sessions/active/SESSION-kernel-module-classification.md`. The existing diff
changes B140 and adds B141/B142 and DS-17. None belongs to this inventory.

Reactive-layout has untracked `AGENTS.md` and the three `SKILL.md` files under
`.agents/skills/{bmad-build,bmad-checkpoint-preview,bmad-qa}/`. Leave all four
unchanged. The handoff's count of two uncommitted files is no longer current.

The root AGENTS and Rust AGENTS still mention a `clean-slate` checkout. Git reports
`main` for both. An entrypoint may describe the clean-slate design without asserting
a branch name that the checkout does not have.

Sibling release/review worktrees and `graphrefly_github` are outside the handoff's
repository list. They were not added to this task.

## 3. Entrypoint shape

Each README will contain a short purpose paragraph, a path table, links answering
“where things stand,” local start instructions, and a command table. It will link
to package examples or guides rather than repeat their bodies. Existing short
READMEs need useful links, not further shortening. There is no word-count gate.

Each AGENTS will link to its README, documentation map, governing authority, and
local workflow entrypoints. It will retain essential routing and authorization
pointers. Detailed policy, API examples, status narratives, and command commentary
will live with their owners. CLAUDE/GEMINI entrypoints will forward to AGENTS where
those files exist. Do not introduce extra agent entrypoints merely for symmetry.

Each repository will have one category map at `docs/README.md`. Existing maps in
TS and Stack will be extended. Python's `docs/index.md` remains its package landing
guide; it will link the map rather than become a second map. The root map is an
internal navigation page, not a new Markdown authority or public website route.

## 4. Documentation map and maintenance boundary

Every map uses these eight categories and questions. A category with no local
record says so and links the upstream owner; it does not create a placeholder
ledger or infer approval.

| Category | Question | Root entrypoint | Maintenance boundary |
|---|---|---|---|
| Rules | What applies now? | `authority/README.md` → current projection from `spec/rules.jsonl`; project process through `guide/docs.jsonl` and the existing skills | Current activated contract; no copied decision/session prose |
| Draft rules | What is proposed but inactive? | Draft revisions in `spec/rules.jsonl`, reached through the resolver/dashboard; DS-17 only as design input | Do not equate discussion acceptance, implementation, or passing tests with activation |
| Decisions | Why was a choice made? | `authority/ledgers.jsonl` → unique owner/class ledger | Preserve origin, rationale and supersession; no body copies |
| Work | What is being done, in what order? | `authority/work-ledgers.jsonl`, `plan/phases.jsonl`, `plan/backlog.jsonl` | Owner-local state and acceptance; a cursor does not dispatch work |
| Evidence | What was actually checked? | Owning work's `evidence_refs`; indexed sessions, conformance/formal artifacts and dated receipts | Commands, results, revision and limits; no permission or acceptance inferred |
| Design / guides | How is this understood or used? | `guide/guide.jsonl`, `sessions/sessions.jsonl`, `authority/README.md` | Explain and link; distinguish design drafts from current rules |
| Archive | What did earlier material say? | `sessions/archive/`, `archive/`, and the session index | Move intact apart from paths; retain identities and evidence bindings |
| Reference | What external or legacy material informs us? | Research sessions and B7's legacy prose sources | Reference is not executable authority or the current contract |

The map will link to existing sources, not paste their contents. Shared process
text already owned by a personal skill remains there. Root contributor guidance
that currently lives only in AGENTS can move, without changed obligations, into
internal records in `guide/contribute.jsonl`, registered by `guide/guide.jsonl`.
That set is currently a **stub**; it must not be presented as finished guidance.
New root shared guidance stays JSONL under D563.

For new editorial notes, use absolute dates and explicit `proposed`, `accepted`,
`deferred`, or `superseded` wording with the acceptance basis when available.
Keep existing schema enums such as `locked`, `active`, `done`, and `archived`.
This is not a schema/status migration. Unknown historical acceptance stays unknown.

## 5. Root repository — first batch

### Current entrypoints and concrete findings

[README](../../README.md) locates authority and the website, but has no direct
work/status entry. [AGENTS](../../AGENTS.md) mixes a useful index with protocol
summaries, process policy, branch assertions and tooling detail. There is no
`docs/README.md`. `guide/docs.jsonl` already owns the documentation policy.

The session index contains 17 rows: 16 `active`, one `archived`. The active
directory contains 17 Markdown files, including the unindexed handoff, and two
artifact directories. DS-1 is 597,446 bytes / 8,544 lines. Size alone does not
establish whether a session is finished.

All **69 top-level D# headings numbered D683 or later in DS-1** have an existing
`graphrefly:D#` record through the federated ledger locator. For example, D683 is
in root execution history, D685 is in TS root-origin history, and D783 is in the
root durable ledger. This verifies identity coverage, not word-for-word equality
or semantic equivalence. Do not “extract” them into new duplicate decision rows.

The legacy `GRAPHREFLY-SPEC.md` and five `COMPOSITION-GUIDE*.md` files still exist.
B7 explicitly holds their content migration. They cannot be declared migrated
because the new entrypoints are clearer.

### Proposed changes and AGENTS destinations

| Existing material | Destination or action |
|---|---|
| README authority/website/dashboard descriptions | Short path table linking the existing owners; command table |
| Missing current work entry | Links to work locator/backlog/generated view; link B141, deferred B140 and B142 without copying their mutable state into README |
| AGENTS “What changed” and protocol floor summaries | Replace with links to resolved current rules and qualified decision history; no new protocol summary body |
| AGENTS documentation-system table | Category map in `docs/README.md`; policy remains in `guide/docs.jsonl` |
| AGENTS rules/decisions/work explanation and workflow boundaries | Existing personal governance reference and root workflow skills; root-only contributor instructions in internal `guide/contribute.jsonl` records |
| AGENTS authority/admission mechanics | `authority/README.md` and owner locators; keep only short links in AGENTS |
| TLC/Rust shell detail | Internal contributor guidance, linked to the owning runtime's development instructions |
| DS-1 narrative and repeated D# discussion | Retain at its existing path for this batch, with its historical-design role explained by the map; ledger remains the decision owner |
| B7 legacy prose | Retain at current paths, listed as migration/reference material; no extraction, rewrite or archive-before-migration |

Do not create a hand-maintained “current rules” Markdown replacement. The
resolver-generated current projection is the contract entry. D796 drafts remain
inactive; B140/B141 and their sessions are not edited.

### Archive candidates, not assertions of completion

Propose moving the four dated CSP-11 evidence sessions DS-5 through DS-8 from
`sessions/active/` to the same basenames under `sessions/archive/`. Their contents
record historical qualification/live attempts, including unsuccessful outcomes.
Archive would mean “historical record,” not “the attempted outcome succeeded.”
Before applying, verify every inbound reference and hash-bound receipt. If a path
is inside an immutable evidence envelope, retain that envelope and defer the move
unless an existing approved relocation mechanism can preserve its binding.

DS-1 stays because it contains more than ledger duplicates and remains a widely
linked design source. DS-2/3/4/9/10/11/12/13 stay pending owner review of unresolved
questions. DS-12's short migration narrative alone does not prove all consolidation
work is closed. DS-14 is already archived and has hash-bound evidence: leave it alone.
DS-15/16/17, their index rows and probes are protected parallel work.

## 6. TypeScript

Current entries are README, AGENTS, CLAUDE, GEMINI, `llms.txt`, and `docs/README.md`.
The existing map correctly identifies historical documents but leaves them in the
active docs tree. Of the 1,116 Markdown files, 714 are under `website`, 215 under
`docs`, and 82 under `archive`. Do not treat all files in `docs/design` as disposable.
Several design records are explicitly referenced by `docs/docs.jsonl`.

The category map will use these owners:

| Category | Entry and boundary |
|---|---|
| Rules | Root activated protocol; local documentation policy in `docs/docs.jsonl`; package API docs explain TS use |
| Draft rules | Root inactive revisions; local design proposals remain designs, not active rules |
| Decisions | Local `decisions/decisions.jsonl`; root-origin history reached through the root locator |
| Work | Local `plan/work.jsonl`; root work locator for foreign dependencies |
| Evidence | Exact receipts linked from local work and docs-policy records; retained qualification/design directories |
| Design / guides | `docs/docs.jsonl`, package examples, `coming-from-rxjs.md`, `benchmark.md`, JSDoc/API generation |
| Archive | Existing `archive/`; proposed `archive/docs/pre-clean-slate/` for confirmed old planning material |
| Reference | Retained old docs/site sources, explicitly distinguished from package API ownership |

Move README's extended examples/import catalog to package-local usage guidance
under `docs/` and link it. Leave exported APIs and example behavior unchanged.
AGENTS' protocol floor links upstream; its local docs policy links `docs/docs.jsonl`;
workflow details link the existing skills and `authority/README.md`. Package setup
and check explanations move to a local development guide. CLAUDE/GEMINI remain
forwarders. Reduce `llms.txt` to a package description and canonical navigation
links instead of a second list of rules, ownership and current package claims.

The first proposed historical move batch is the exact list in section 11.
Keep `docs/design/`, `docs/research/`, `ADAPTER-CONTRACT.md`, and current TS
guides in place until each owning reference is checked. Update only path metadata
in docs-policy records where a move requires it. No decision-body changes.
Leave all website content and generated API bodies alone, except verified broken
links affected by an approved move. Preserve `TRASH-FILES.md` history.

## 7. Canvas

Current entries are README, AGENTS and a CLAUDE forwarder. There is no category
map. README still calls Trusted Data Query the first wedge and describes major
UI work as future scaffold work. AGENTS and `plan/product-roadmap.md` describe a
later runtime-inspection direction. This is a **stale README finding**, not a
request to select a different roadmap. README should link the owning roadmap
and cursor instead of maintaining another product-state narrative.

| Category | Entry and boundary |
|---|---|
| Rules | Existing Canvas owner decisions and the root protocol boundary; do not promote `docs/design-lock.md` history into a new rules ledger |
| Draft rules | Proposals identified in the roadmap/design material; a design-needed item grants no implementation approval |
| Decisions | `decisions/decisions.jsonl`; root-origin history through the root locator |
| Work | `plan/product-roadmap.md`, `plan/program-state.json`, `plan/slices.jsonl` with their distinct roles |
| Evidence | Slice evidence, deployment records and existing implementation-history documents |
| Design / guides | `docs/plan.md`, `docs/design-lock.md`, topology documentation and owning package guides |
| Archive | Retained implementation/design history; no automatic archive of a mixed current/history document |
| Reference | `_bmad` source material and installed third-party skills; not product authority |

AGENTS' product narrative/status becomes links to roadmap/cursor. Its architectural
floor becomes qualified owner references and short boundary routing. Preserve
D769/D770 confidentiality and public-surface constraints by linking their owners;
do not expose private topology while producing documentation. Contributor/check
details can live in local development guidance. Retain `docs/design-lock.md`
unchanged: it explicitly calls itself history/application material and contains
both old locks and results. Extracting a new current policy requires owner review.

Skills dominate the file count: `.agents` has 1,535 Markdown files, `.claude`
1,519, `.agent` 1,517, and `.opencode` 86. Hashing **all regular files**, not only
Markdown, found:

| Compared with `.agents/skills` | Same relative path and SHA-256 | Different bytes at shared paths | Extra files only in `.agents/skills` |
|---|---:|---:|---:|
| `.claude/skills` | 1,728 | 0 | 18 |
| `.agent/skills` | 1,726 | 0 | 20 |

Propose `.agents/skills` as the maintained copy. Keep tool-specific `SKILL.md`
discovery entries as forwarders. Move the original duplicated bodies/support
files into dated TRASH storage before replacing entry files. Preserve relative
resource resolution against the maintained skill, not the forwarding directory.
Keep unique files in `.agents`. Do not discard `.opencode/commands`: they are
tool entrypoints, not proven byte-identical duplicates. Convert only verified
duplicate bodies to dispatch links.

**Hold:** the loader/regeneration behavior must be checked for each agent before
applying the skills batch. The hash result proves duplicate bytes, not that every
loader follows a forwarding SKILL or resolves its references correctly. Root-style
forwarders are the proposed mechanism, not a claim that Canvas compatibility is
already verified. Keep `_bmad` and `_bmad-output` source/design artifacts intact.

## 8. Stack — read-only until branch agreement

Stack already has a useful AGENTS index and `docs/README.md` pointing to
`docs/sources.jsonl`. README is 17,466 bytes and mixes install/usage, historical
flagship evidence, live provider instructions, product direction, and architecture.

| Category | Entry and boundary |
|---|---|
| Rules | `docs/product/scope.jsonl`, `docs/product/contracts.jsonl`, source-map ownership |
| Draft rules | Proposed product/contract material in the existing records; no promotion from plan state |
| Decisions | `docs/decisions/decisions.jsonl` |
| Work | `docs/plan/phases.jsonl`, `docs/plan/backlog.jsonl` |
| Evidence | `docs/evidence/milestones.jsonl`, requirements and retained `evidence/` artifacts |
| Design / guides | Extend the existing docs map; link a local usage guide for the long CLI/setup material |
| Archive | Dated historical flagship prose, only after matching its record/evidence owner |
| Reference | Historical cases and provider instructions, clearly scoped and never auto-executed |

Propose splitting README's long command walkthrough into `docs/usage.md` and
linking existing product/contracts/evidence records for the rest. Retain examples
and evidence; do not replace history with a newly claimed success. Keep AGENTS'
short routing; make CLAUDE a forwarder if it repeats scope. Any README prose not
represented by an owner record stays as labelled explanation or history rather
than becoming a new decision.

**Hold:** apply no Stack writes unless the user agrees to use the existing
`codex/backend-continuation` checkout. No branch switch or new worktree is proposed.

## 9. Rust and Python

### Rust

Existing README/AGENTS, `docs/architecture.md`, `docs/development.md`,
`docs/docs.jsonl`, crate `CLEAN-SLATE.md`, rustdoc and package site provide the
material needed. Add only the navigation map and relocate entrypoint detail.

| Category | Entry and boundary |
|---|---|
| Rules | Root current protocol; Rust contributor requirements in `docs/development.md`; docs policy in `docs/docs.jsonl` |
| Draft rules | Root drafts; do not treat historical crate status as activation |
| Decisions | Local ledger and locator-owned root-origin history |
| Work | Local `plan/work.jsonl`, root locator and foreign dependencies; do not invent a local cursor |
| Evidence | Work receipts, crate conformance mapping and actual command results, with legacy claims labelled |
| Design / guides | Existing architecture/development guides and rustdoc |
| Archive | Git history for already-retired port material; no new deletion or recreation of old archives |
| Reference | Historical port context, clearly labelled and linked only when needed |

Move Rust-only contributor constraints from AGENTS' “Rust-specific floor” into
`docs/development.md`, preserving their obligations. Replace repeated protocol
floor text with upstream links. Fold layout explanation into the existing
`docs/architecture.md`; keep status with its owning work or crate map. Link the
shared workflow skills instead of repeating their prose. No archive/trash candidate
is established by this inventory.

AGENTS currently points to `~/src/graphrefly/docs`, which does not exist at this
baseline. Shared public records are under root `guide/` and `website/`. This is a
broken plain-text pointer, despite the Markdown-link scan reporting no missing
files. A future root `docs/README.md` would be navigation, not the shared public
record owner.

### Python

Existing README/AGENTS, `docs/index.md`, `quickstart.md`, `api.md`, `release.md`,
`docs/docs.jsonl`, docstrings and the package site provide the source material.

| Category | Entry and boundary |
|---|---|
| Rules | Root protocol; Python public API/host-boundary guidance and `docs/docs.jsonl` |
| Draft rules | Root inactive revisions; local proposals are not implemented facade contracts |
| Decisions | Python ledger and located root-origin history |
| Work | `plan/work.jsonl` and root work locator; leave empty work surfaces empty |
| Evidence | Owning work receipts and executed Python/native/docs checks |
| Design / guides | Existing `docs/index.md`, quickstart/API/release guides and docstrings |
| Archive | Existing release/history material; no move candidate established |
| Reference | Rust native foundation links and historical context, without copying Rust authority |

Reduce README to entry links and setup. Reuse existing quickstart/API docs for
its long examples. Move AGENTS' Python facade/lifetime/message explanation to
the existing API/development guidance, preserving scope and wording unless an
already owning API source provides the body. Do not resolve facade/protocol drift
editorially or publish D796 draft behavior as the current Python API. Preserve the
instruction not to migrate skills. Generated API pages remain generated.

## 10. Small repositories

For these repositories, the handoff authorizes an owner/entrypoint check, not
framework API redesign or broad historical migration. Each gets a small category
map and useful README links. “No local record found” is explicit where applicable.

| Repository | Current entrypoints | Proposed map owners and changes | Archive / trash |
|---|---|---|---|
| React | README; AGENTS redirects to a substantive CLAUDE; `docs/plan.md`; `plan/slices.jsonl` | Rules/drafts: root and TS adapter owners. Decisions: root locator, no new React ledger. Work/evidence: existing slices and referenced checks. Design: local plan and API guide. Reference/archive: existing history only. Move CLAUDE-only explanation into the local guide/map and make CLAUDE forward to AGENTS. Keep React-owned hooks/reference UI scoped locally. Replace the generic `https://github.com/` README link with the verified owner repository link. | No candidate established |
| Vue | One-sentence README; short AGENTS | Rules/drafts/decisions: root + TS adapter owners. Work/evidence: existing package checks; no local sequencer found. Design: local source/API entry and package metadata. Archive/reference: no separate local body found. Add setup/command/owner links without copying TS rules. | None |
| Solid | One-sentence README; short AGENTS | Same categories as Vue, with Solid-owned package/source paths and checks. Do not assume a Vue contract or shared local work ledger. | None |
| Svelte | One-sentence README; short AGENTS | Same categories as Vue, with Svelte-owned package/source paths and checks. Keep framework-specific ownership explicit. | None |
| Nest | Short README with four package entrypoints; short AGENTS | Rules/drafts/decisions: root protocol/TS boundary plus existing package documentation. Work/evidence: local checks, no sequencer found. Design: structural/native/microservices/websockets package entries. Archive/reference: no separate local body found. Preserve host-handle privacy; link the owning API rather than copy its contract. | None |
| reactive-layout-node-canvas | README with an example; untracked AGENTS and three shared-skill wrappers | Rules/drafts/decisions: root protocol and TS measurement capability. Work/evidence: package checks, no sequencer found. Design: local provider usage and package entries. Reference: package-origin history already in README. Archive: no candidate. Add README/map links without editing the four pre-existing untracked files. | None |

The React AGENTS → CLAUDE route is not a missing-file error. It reverses the
intended single maintained agent entrypoint. The other small repos repeat the
personal workflow prose; shorten that to direct skill links without removing the
adoption or authorization boundary.

## 11. Move, trash, duplicate and link inventory

All actions here are proposals; none has run. For every approved archive move,
record source, destination, date, reason, replacement link and before/after digest
in this session's dated execution evidence. Permit only required relative-path
rewrites. Check inbound references, structured path fields and immutable receipts
before moving. A stale-looking filename alone is not permission to discard it.

### Proposed root archive batch

| From `sessions/active/` | To `sessions/archive/` | Reason / remaining check |
|---|---|---|
| `SESSION-csp11-d702-offline-qualification.md` | Same basename | Historical DS-5 evidence; verify inbound and bound-receipt paths |
| `SESSION-csp11-d703-pre-live-qualification.md` | Same basename | Historical DS-6 attempts/approval context; preserve all limits |
| `SESSION-csp11-d721-provider-capable-pre-live.md` | Same basename | Historical DS-7 no-network qualification; no efficacy implication |
| `SESSION-csp11-d722-d725-graph-native-live-evidence.md` | Same basename | Historical DS-8 failure/measurement evidence; preserve unsuccessful results |

### Proposed TS archive batch

Move each exact path below under `archive/docs/pre-clean-slate/`, preserving its
basename/subtree. The existing docs map already identifies these as historical.
Validate inbound refs and retain a short forwarder only when an old entry path must
remain discoverable; the history body must live once.

```text
docs/implementation-plan.md
docs/implementation-plan-DS-13.5/
docs/implementation-plan-13.6-locks-draft.md
docs/implementation-plan-13.6-flowcharts.md
docs/implementation-plan-13.6-prep-inventory.md
docs/implementation-plan-13.6-canonical-spec.md
docs/audit-plan.md
docs/batch-review/
docs/roadmap.md
docs/optimizations.md
docs/cross-track-ledger.md
docs/rust-port-decisions.md
docs/rust-port-quality-strategy.md
docs/test-guidance.md
```

Keep `docs/demo-and-test-strategy.md`, `ADAPTER-CONTRACT.md`, design/research
directories and any hash-bound evidence outside this batch pending content/owner
review. The website remains outside the cleanup batch.

### Proposed Canvas trash batch

Only the proven duplicate regular files at matching relative paths under
`.claude/skills` and `.agent/skills` are candidates. Preserve originals under
`TRASH/docs-reorganization-2026-11-05/{claude,agent}/skills/` before replacement;
add one `TRASH-FILES.md` line per moved file, with source, date, reason and the
`.agents/skills` replacement. Recheck hashes immediately before moving.
Do not add a file to trash just because its neighbor was duplicated.

Forwarding entry files keep their required metadata and identify the maintained
skill and resource root. Asset/support-file relocation waits for loader and
reference checks described in section 7. `.opencode` conversion is held until its
individual commands are matched; there is no approved wholesale command deletion.

No disposable-file candidate was established in root, TS, Stack, Rust, Python or
the six small repositories. New TRASH logs should be created only when a real
trash move happens. Existing TS trash entries are retained unchanged; do not
invent missing historical dates or receipts.

### Link findings and limits

A local Markdown target scan covered 45 entrypoint/map/nearby guide files across
all 12 repositories and checked 53 explicit local link targets: **zero missing
files**. It skipped fenced code, external URLs, web-root routes and anchors.
It did not validate thousands of website/archive pages, inline-code path mentions,
URL availability, Markdown heading slugs, or agent-loader behavior.

Separate pointer review found the nonexistent root `docs` pointer in Rust AGENTS,
React's generic GitHub link, and many backtick-only paths that are not clickable.
Convert current navigation to working links. Preserve historical path mentions
unless an actual move requires a path correction. Proposed new paths in this
document are code text until created; they are not evidence of existing files.

## 12. Open questions and retained duplication

1. **Stack branch:** the user must agree before writes on the checked-out
   `codex/backend-continuation` branch. Recommendation: keep it read-only until
   that agreement, while proceeding with approved batches elsewhere.
2. **DS-1:** retain the original narrative and its current path in the first
   batch. Corresponding decision identities already exist. Removing sections or
   splitting the file would require a separate section-level comparison and
   review of its unresolved discussion; a second ledger extraction is unnecessary.
3. **Legacy rule/guide migration:** B7 still owns extraction and reconciliation.
   Recommendation: link and label the legacy sources now; do not claim independent
   rule readability has been repaired by this editorial task.
4. **Canvas historical locks and stale product claims:** use existing owner
   references for entrypoints. If two owner records conflict, report their exact
   references; do not choose a new product direction or promote old prose into rules.
5. **Skill loading:** byte identity supports deduplication, but does not establish
   forwarding compatibility. Qualify each entry mechanism before its approved move;
   retain an explicit exception where tooling needs a packaged resource copy.

Retained overlap has a recorded reason: DS-1 and mixed design-history files retain
discussion context; TS/Python sites contain generated or migration material; Canvas
tool support copies remain until loading is qualified. None is treated as a second
canonical decision/rule body. Do not change a rule, decision, scenario, formal model,
or historical acceptance merely to satisfy a deduplication count.

## 13. Application order and acceptance

After approval: root → TS → Canvas → Stack if branch agreement is given → Rust →
Python → React → Vue → Solid → Svelte → Nest → reactive-layout. Stop at a material
semantic/ownership ambiguity; continue independent approved editorial work.
Keep each repository's diff and dated evidence separately reviewable within B142.

| Given / when | Required result | Verification |
|---|---|---|
| A reader starts at README or AGENTS | They reach rules, drafts, decisions, work and evidence through the one map without reading a session history | Follow actual file links in each edited entrypoint; inspect category ownership |
| A draft and an activated rule both exist | The map routes them separately without changing activation or stating drafts as current | Compare rule/decision/formal/conformance bytes and resolver output against baseline |
| A document moves | Body survives, path refs resolve, original is accounted for and evidence hashes remain valid | Move manifest, body comparison allowing path-only changes, inbound-ref scan and local gates |
| A duplicate skill body is replaced | Each agent still discovers the entry and resolves the maintained skill's resources | Forwarder/reference review and tool-specific qualification; retain exception if unavailable |
| Parallel work changes a shared JSONL | Only this task's row changes; latest foreign rows survive | Re-read immediately before writes; compare parsed foreign rows and protected file hashes |
| A gate fails | Exact command, failure and pre-existing/new classification are recorded | Preserve failed output; repair only an authorized editorial defect |

Required root checks after its approved batch:

```sh
npm run authority:check
npm run work:check
npm run test:authority
node dashboard/build.mjs --check
npm run docs:public:check
```

Also use `npm run authority:check:workspace` when owner ledgers/path refs are affected.
No authority-body migration is part of the proposed editorial batch.

| Repository | Existing local gates to run after its edits |
|---|---|
| TS | `pnpm test`, `pnpm run lint`, `pnpm run build`; docs-policy generation checks including `pnpm run docs:gen:check` and `pnpm run docs:gen:missing` as required by the affected docs slice |
| Canvas | `pnpm test`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run build`, `pnpm run dashboard:check`; loader/resource checks for the skill batch |
| Stack, only if agreed | `pnpm docs:check`, `pnpm check`; inspect local live-test configuration before running so no provider/spend action is dispatched |
| Rust | `mise exec -- cargo test -p graphrefly-rs`, `mise exec -- cargo build -p graphrefly-rs`, `mise exec -- cargo clippy -p graphrefly-rs --all-targets`, `mise exec -- cargo fmt --all --check`; documented rustdoc/site checks if their sources change |
| Python | The `py-docs.verification` commands in `docs/docs.jsonl`: dev/docs sync, native extension build, pytest, ruff, mypy, API-doc check, site generation check/build; Rust binding gate if the native foundation is affected |
| React | `pnpm test`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run build`, `pnpm run dashboard:check` |
| Vue / Solid / Svelte / Nest / reactive-layout | Each repository's `pnpm test`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run build` |

Every edited repository also needs a local link/inbound-reference check. No
package runtime gate is claimed from this inventory alone. Reuse existing commands;
do not add prose-string tests or execute release/provider examples to test navigation.

## 14. Inventory evidence — 2026-11-05

Executed inventory operations:

- Read the handoff, root authority/indexes, every listed repository's entrypoints,
  the relevant local docs policies/guides/scripts and personal workflow references.
- Read the photo-scenes README/AGENTS/map, project language/ownership/delivery
  sections, and trash log. Its README-shape commit is
  `f237ebca36f12f9fc4902c95767fe3faa362904a` (2026-11-03).
- Used `git branch --show-current`, `git rev-parse HEAD`, `git status --porcelain=v1
  --untracked-files=all`, and staged/unstaged diff inspection to capture the baseline.
- Enumerated local files with `rg --files --hidden` and measured Markdown/entrypoints.
- Compared SHA-256 at matching Canvas skill paths; resolved DS-1's late D# headings
  through every available ledger in `authority/ledgers.jsonl`.
- Ran the scoped 45-file / 53-target Markdown link scan described in section 11.
- Captured 139 SHA-256 digests for protected root authority/model/session/probe
  files and the four pre-existing reactive-layout files before writing.

The following checks ran from the root after this proposal was indexed as DS-18.
They are proposal-stage evidence, not B142 completion or permission to apply moves.

| Command | Result | What it establishes / limit |
|---|---|---|
| `npm run authority:check` | Exit 0 | No unresolved refs, supersession/rule cycles or ambiguous current governors; 23 current and 94 draft protocol rules |
| `npm run work:check` | Exit 0 | 159 root work records; no dependency cycles, supersession cycles or work orphans; B142 remains planned |
| `npm run test:authority` | Exit 0 | 40 passed, 0 failed, 0 skipped; resolver/work regression coverage, not runtime conformance |
| `node dashboard/build.mjs --check` | Exit 0 | 18 session rows, no blocking reference errors; informational orphan D792 remains |
| `npm run docs:public:check` | Exit 0 | Local website build and public-content checks passed; no publication occurred |
| `npm run authority:check:workspace` | Exit 0 | 1,023 located decisions; 319 relocations verified, zero unverified; no dependency/supersession cycles or work orphans |
| `git diff --check` | Exit 0 | No whitespace errors in tracked changes; the new proposal was also inspected directly |
| Proposal local-link check | Passed | All seven explicit local targets exist; proposed future paths are not links |

Existing diagnostics remain visible: 424 unclassified historical decisions, three
formal-coverage obligations pending, the D792 session orphan, and 100 root legacy
completed-work records without evidence coordinates. The root-only work view
reports 14 unavailable foreign prerequisite/artifact warnings because sibling
ledgers are registered but not loaded in that mode. Workspace mode loads them and
instead reports Canvas's 88 append-only legacy slice revisions without immutable
row coordinates. These checks do not reconcile or close those historical gaps.

Preservation check: all 12 branches and HEADs are unchanged, no files are staged,
and every sibling repository's Git status matches the initial snapshot. All
existing session-index rows and backlog rows matched the captured baseline before
adding B142's own proposal evidence reference. DS-18 is the only added index row.
Of 139 protected file digests, 138 were unchanged. DS-17's body changed during
the inventory through parallel work; this task made no write to that file. Its
index row remained unchanged. No authority/spec/formal/conformance/probe file in
the protected set changed.

Focused local review checked navigation, proposed source/destination paths,
preservation and approval boundaries, and whether the evidence supports each
claim. No independent reviewer agents were used for this documentation-only
proposal. Skill-loader compatibility, historical acceptance, full site/archive
links and sibling runtime gates remain unverified and explicitly outside this
stage's passing claims.

Task-owned writes are this session, the appended DS-18 index row, and B142's
SHA-256-bound evidence link/note. B142 stays `planned`; no human acceptance is
recorded. Actual archive/trash count: **zero / zero**. The next action is user
review of the proposed editorial batches and the separate Stack branch choice.
