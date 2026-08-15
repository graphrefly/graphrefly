# Federated Sequencer Consolidation

**Session:** DS-12  
**Status:** active  
**Lock:** D787

## Objective

Give every work item one sequencer owner and one owner-local canonical body while retaining a generated, fail-closed global dependency view. Root, runtime, Canvas and Stack may name cross-repository prerequisites, but they do not copy, reorder or complete another owner's work.

## Locked boundaries

- Roadmap order, lifecycle, derived readiness, cursor, execution approval and completion evidence are separate authorities.
- Cross-repository prerequisites use origin-qualified work refs and exact artifact/schema/revision requirements.
- Integration completion belongs to one consumer/integration owner; producers only complete their outputs.
- Missing or stale repositories and evidence are unavailable or stale, never inferred complete or blocked.
- The dashboard projection is read-only and grants no implementation, provider, charged-action or cross-repository write authority.
- This session changes no wave protocol.

## Approved migration scope

Batch 1: lock D787; add the work-ledger locator, relocation contract, strict-v1 validator, regression tests and read-only authority/dashboard gate integration.

Approved Batch 2 micro-batch (2026-08-14): split only `graphrefly-stack:B25` and `graphrefly-canvas:CT-7`. B25 retains the Stack-owned content-addressed mapping-contract producer; CT-7 is the sole Canvas consumer/integration milestone. Add the bounded Canvas roadmap adapter needed to resolve that exact qualified artifact edge. No other work record, cursor, program-state, backlog item, migration batch or roadmap implementation is authorized.

Approved full CT migration (2026-08-15): migrate Canvas CT-1 through CT-6 together rather than as separate micro-batches; supersede the duplicate CT-1 candidate body and root B4 placeholder; split B120/B122 root contracts and B121/B123 root aggregates from the new TypeScript-owned `CAUSAL-OCCURRENCE-TS` and `DURABLE-SQLITE-VERTICAL` slices; and expose exact CSP-14/CSP-15 artifacts to Canvas. The current Canvas cursor remains on the local-v0/CS-198 manual-acceptance path. This approval changes no decision, protocol, implementation status or execution authority and does not authorize any CT, causal-runtime or durable-runtime implementation.

Approved consolidation completion (2026-08-15): the user's “migrate all, not micro-batches” approval also closes the directly connected deferred ownership tail. B124 now owns only the root distributed-durability contract; B126 owns root aggregate verification; CSP-16 owns the cross-project aggregate outcome. TypeScript owns `POSTGRES-DURABILITY`, `WORKQUEUE-DURABLE-AUTHORITY`, `OTEL-EGRESS-ADAPTER` and `AGENT-SKILLS-LOWERING`; root B125/B127/B128 remain historical superseded locators. Stack B23/B24/B25 are strict producer records with exact causal, durable and Canvas-mapping artifacts; Canvas CT-2/CT-6/CT-7 are their sole consumer-owned integrations. CT-6 is limited to the SQLite/generic durable evidence actually produced before CSP-16. QA also locks that local prerequisites cannot be bypassed by entering `in-progress`, optional sibling refs remain unavailable rather than broken, Markdown acceptance projection retains every recognized acceptance field, reverse supersession is generated, and strict rows may coexist with unmigrated owner-local rows through the registered ledger adapter. The Canvas cursor still points to `d668-local-code-workbench-browser-journey`; CS-198 remains its completion/acceptance trace, not a second cursor identity.

Stack `STACK-SOURCE-BOUND` through `STACK-GROUNDED-HANDOFF` are strict owner-local phases; only `STACK-SOURCE-BOUND` is a ready-but-not-authorized Stack candidate. Rust and Python expose registered empty `plan/work.jsonl` ledgers, meaning “no owner-local slice is currently declared” rather than “the checked-out repo is unavailable.” Empty ledgers create no task and no execution authority.

## Design review

- **Q5 abstraction:** a separate work locator is narrower than overloading decision federation and avoids a central work-body copy.
- **Q6 longevity:** stable identity, unique owner, revision-bound evidence and fail-closed availability are the durable invariants; owner-local implementation detail stays local.
- **Q7 simplicity:** adapters normalize current owner schemas into a read-only projection; generated fields never write back.
- **Q8 alternatives:** root-central sequencing duplicates local work; fully independent sequencing hides the critical path; adding work rows to the decision locator mixes authority families; a separate federated work locator is selected.
- **Q9 recommendation:** owner-local sequencers plus a generated global work graph, with legacy adapters during migration and strict-v1 admission for canonical interoperable records.
