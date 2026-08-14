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
