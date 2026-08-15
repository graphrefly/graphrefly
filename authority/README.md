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
requires `/spec-amend`.

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
can be checked mechanically. `work-federation.mjs` derives the workspace work graph and validates the strict
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
