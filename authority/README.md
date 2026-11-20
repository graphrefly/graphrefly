# Authority resolver

`model.mjs` is the shared generated-view resolver required by D783 and D784. Canonical
records remain in their owner ledgers; this directory contains no copied decision or rule
text.

`ledgers.jsonl` is the owner/class locator map. `federation.mjs` loads required root ledgers,
optionally verifies sibling ledgers in a complete workspace, and resolves identities as
`origin:id`. `relocations.jsonl` contains only old/new locator and SHA-256 integrity metadata
for physically moved history; it never copies a decision body.

Relocation does not change origin. A root-authored `graphrefly:D#` moved to Canvas or a language
package remains `graphrefly:D#` in that owner's `root-origin-history.jsonl`; a newly authored local
record instead uses the owner's namespace in its normal ledger, such as `graphrefly-canvas:D#` or
`graphrefly-ts:D#`. Historical owner repair therefore cannot silently change identity.

The same root origin may have several historical ledgers because owner is part of the ledger
coordinate: `(origin, owner, authority_class)`. A historical ledger is relocation-only and never an
admission surface for new records.

The resolver builds the decision supersession graph, derives scenario coverage only from
`spec/conformance.jsonl.covers`, derives formal coverage from exact `R-*` references in
`formal/*.tla` and `formal/*.cfg`, generates the fail-closed current protocol projection, and
keeps legacy decisions without owner/class/concern coordinates explicitly unresolved. Draft
rule revisions remain outside the current projection and are reported as an activation-review
metric; passing implementation tests never silently grant normative status.

## Protocol revision contract

Rule rows use:

```text
{ id, revision, area, statement, rationale,
  introduced_by:[D#], activated_by?:[D#],
  transition?:{ kind:"revise"|"replace"|"retire", by:D#, to?:{id,revision} } }
```

Lifecycle is derived. A public rule is the sole activated revision with no forward
transition. Draft, retired, predecessor, dangling, cyclic, duplicate and ambiguous revisions
do not enter the public projection. Any statement, rule-boundary or legal-trace change still
requires `/spec-amend`. On main an activated revision's statement or a locked decision's text
changes only through a new one; graphrefly:D815 says which rows are corrected in place (a draft, a
scenario row, a transition added to a predecessor, a guide record, a row that exists only on an
unmerged branch). No gate checks any of it: an edit of an active revision's statement or of a locked decision's
text passes every check (graphrefly:B146).

The protocol's parts are derived from a rule's `area`, not stored: `module`, `graph` and `principle`
each name a part and every other area is the kernel. `npm run rules:current` (optionally one part,
`--drafts`, `--scenarios`, `--json`) prints the current rules by part, so nobody has to pick them out
of the revision history. A scenario's level is the highest part among the current and draft rules it
covers, which makes the kernel scenarios a definite list. The gate also lists, without failing, the
scenarios that cover no current rule and the current rules that cite a rule of a higher part (kernel
and principle, then graph, then module); both lists are for review.

`covers_by`, `superseded_by`, current flags and public flags are not canonical reverse truth.
Existing runtime status fields remain legacy claims until commit-bound evidence receipts are
designed; the resolver labels them unverified and never uses them to select public rules.

The authority gate rejects the former rule-level `status`, `since` and `covers_by` fields. They
cannot be reintroduced as a compatibility path.

Run `npm run authority:check` and `npm run test:authority`. In a workspace containing every
sibling repository, also run `npm run authority:check:workspace`.

## Post-migration decision admission

`ledgers.jsonl.admission_after` grandfathers immutable history and activates the future-record
gate. Every later record must carry canonical forward metadata: non-empty stable `concerns`,
`decision_kind`, `change_kind`, `protocol_impact`, and explicit `completion.complete_when` plus
`completion.historical_when`. Execution approvals, evaluation methods and implementation receipts
are rejected outside the evaluation/execution class. Owner-local records must declare no protocol
impact. A semantic protocol decision is root-only and must name its `/spec-amend`, conformance and
formal obligations before admission. Partial/full supersession must name its predecessors; other
change kinds may not smuggle in a supersession edge.

A supersession edge does not always retire its target. A full supersession, and any edge from a record
that does not say it is partial, as every record before admission metadata, leaves the predecessor
historical. A `partial-supersession` takes over only the concerns its successor lists: the predecessor
stays current for its other concerns and is listed as partially superseded. A predecessor left with
no concern is historical. Two limits follow from working by whole concerns, and the resolver does not
judge either. Inside one concern nothing is partial: when the successor lists the predecessor's only
concern, the predecessor is historical even if the successor says some of its choices stand
(graphrefly:D812 and D802), and those choices are read through the successor's `supersedes` edge.
The same holds for one concern among several: D812 lists `protocol.checkpoint-recovery`, so D808 is
shown as governing its four other concerns and not that one, though D812 says D808's choice there
stands but for the place of one refusal. The view is by concern; what still binds is in the
successor's text. And a
partial successor that lists none of its predecessor's concerns takes nothing from it; the check
prints such pairs as `partialSuccessorsTakingNothing`, for review, and whether the predecessor should
have kept everything is its owner's call. A third limit is the reverse case: a predecessor that lists
no concerns at all, as every record before admission metadata, has nothing to keep, so a partial
successor retires it whole, and the printed list leaves these pairs out (53 at the root and 78 in the
workspace on 2026-11-19; at the root, the legacy records D789, D796, D797 and D803 replaced, and in
the workspace also those replaced in the sibling ledgers, most of them by graphrefly-py's D2, D4, D5
and D8). A `superseded_by`
field that names a successor, which only old records carry, counts as a whole supersession in both
resolvers; null or an empty list names none. A value that is present and not a reference (an empty
string, a number) is an error the federation reports, and the two then differ on the
record, which the comparison below also reports.

`model.mjs` reads only the dashboard's records, so a successor in another ledger is outside it: a
root record superseded only by a record relocated to its owner's ledger (D237 and D238, by
graphrefly:D647 in the TS ledger) was current in the model and historical in the federation until
the second QA of the D812 work found it on 2026-11-19. The federation now gives the model those
edges (`externalSuperseders`), and the check and the dashboard pass them on. With `--workspace` both
resolvers call such a record historical. Without it the other ledgers are not read, so both call it
current: a root-only run cannot know of a successor whose body lives in a sibling checkout.

The check and the dashboard build compare the two resolvers on every run (`resolverDisagreements`,
since the third QA of the D812 work, 2026-11-19): a dashboard record that one calls current and the
other does not is an error, which `gates.test.mjs` pins by running both gates, with and without
`--workspace`, over copies in which one resolver and then the other loses a current decision (until
the fifth QA, 2026-11-20, over a copy whose comparison always disagreed, which pinned that a gate
reports and not what it compares; the test takes about ten seconds). It compares current or not, and not which concerns a record still governs,
so a partial supersession only one resolver knows of is not seen; and both resolvers share the
helper that decides what a partial successor takes. Until then only a small fixture held them together, and a model that was
not given the outside successors, or was given every outside reference as one, passed every gate.

Ledgers marked `historical_only` accept no unlocated record: every body must match a relocation
locator. This makes the history files immutable destinations rather than alternate authoring
surfaces.

## Federated work authority

D787 applies the same single-body ownership discipline to sequencing without mixing work records
into decision ledgers. `work-ledgers.jsonl` is a locator for owner-local planning surfaces and their
read-only adapters; it contains no copied work body. `work-relocations.jsonl` preserves only a
qualified identity, canonical locator, owner and SHA-256 when a later approved batch moves a work
record. A relocation marker also binds the former owner, former adapter and body digest plus its
origin-qualified migration decision; supported moves are JSONL-to-JSONL so old-body duplication
can be checked mechanically. A work ledger marked `historical_only` accepts only relocated records, as a
historical decision ledger does; the root backlog's closed rows live in one (graphrefly:D811). `work-federation.mjs` derives the workspace work graph and validates the strict
`graphrefly-work-v1` contract.

Strict interoperable records use one origin-qualified identity and canonical owner, one of the
closed lifecycle states `proposed`, `planned`, `in-progress`, `complete`, `superseded`, `deferred`
or `cancelled`, qualified prerequisites, acceptance criteria and full-commit- or SHA-256-bound
completion evidence. Cross-origin prerequisites also name the exact artifact, schema and revision;
an in-progress implementation requires a separately resolved execution approval. `ready`, readiness reasons, dependents, aggregate status and
critical-path position are generated and are rejected if persisted. Exact outcome-text matches
across owners are review warnings rather than automatic ownership decisions; duplicate qualified
identities and duplicate versioned artifact producers fail the gate. Integration milestones name
their own canonical owner as `integration_owner`; producers expose versioned artifacts and the
consumer alone completes the integration.

Strict active implementation and integration work with no prerequisite, dependent or cursor anchor
fails as orphaned; roadmap, program and backlog roots may remain independent. The legacy adapters make current root, Canvas and Stack surfaces visible without declaring them
migrated; rows explicitly marked `work_contract:"graphrefly-work-v1"` use strict validation inside
those owner-local files without forcing an all-file schema rewrite. A legacy owner schema that reserves
`status` may expose the canonical lifecycle as `canonical_status`; any compatibility `deps` array must
mechanically match the structured canonical prerequisites. Their remaining missing evidence coordinates and prose-only dependencies are diagnostics, not
fabricated truth. Missing optional sibling ledgers remain `unavailable`; they are never inferred
complete or blocked. Run `npm run work:check:workspace` for the complete checkout view. The result
includes derived readiness, dependents, per-owner candidates and a cursor-anchored critical-path
candidate. All are a read-only planning projection and grant no implementation, provider,
charged-action or cross-repository write authority.
