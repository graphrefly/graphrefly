---
name: spec-amend
description: "Spec-first protocol amendment flow for the clean-slate GraphReFly redesign. Use BEFORE changing any wave-protocol behavior (message arrays, wave settlement, batch requests, subscription snapshots, invocation and lifetime contracts). Enforces F-NO-IMPL-DEFINED: amend spec/rules.jsonl + formal/*.tla + spec/conformance.jsonl FIRST, then implement in each language package. Triggers: 'amend the spec', 'change the protocol', 'change the message set', 'spec change', 'new wave rule', 'this changes protocol behavior'. Not for purely package-local sugar/operator/inspection changes that preserve protocol behavior."
---

## Rules / decisions / work

Read `~/.codex/skills/project-governance/references/rules-decisions-work.md` before contract
analysis or record changes in this workflow. Produce a coherent, concise current protocol that an
agent can use without reconstructing decisions or work history. Check adjacent rules and cross-axis
traces, retain rationale in decisions, and track model/scenario/runtime delivery in work. Preserve
revision history and explicit activation.

You are executing **spec-amend** for the clean-slate GraphReFly redesign.

**Authority repo:** `~/src/graphrefly` (clean-slate branch) holds the language-neutral spec.
Per-language packages (`graphrefly-{ts,rust,py}`) implement it; they NEVER define protocol behavior.

## Iron rule (F-NO-IMPL-DEFINED, decision D14/D19)

Protocol behavior is **spec-first**. No "implementation defines what happens." Order is fixed:

1. **Resolve the current contract and material choice.** Read `authority/README.md`, the affected
   current rule revisions, and the relevant decision chain. Separate editorial reconciliation from
   changes to legal traces. Obtain approval for unresolved semantic/architectural choices; preserve
   approval already given for the same concrete change. Record new material rationale in the unique
   root decision ledger before code, with its required admission metadata. Do not mint decisions for
   test runs, work status changes or every wording repair.
2. **Amend the normative surface before implementation.** Use the rule revision/transition contract
   in `authority/README.md` (`revise`/`replace`/`retire`, explicit activation). Preserve published history;
   reconcile the affected current rules into concise, nonduplicative, consistent statements. Rules
   must express the complete behavior without requiring a reader to reconstruct D# or work history.
   Use root-context decision references and forward conformance `covers` edges; no reverse `covers_by`.
3. **Align verification.** For semantic changes, amend `formal/*.tla` plus MC configs and
   `spec/conformance.jsonl` scenarios before runtime code. Include discriminating and cross-axis traces;
   run the relevant TLC checks. For editorial-only changes, explain why legal traces are unchanged
   and check affected references; do not manufacture a semantic delta or claim unrun verification.
4. **Track delivery as work.** Keep runtime repairs, remaining verification and acceptance under the
   existing owning work record. Run dashboard consistency checks after JSONL changes and workspace
   authority checks after owner-ledger changes. Then implement the authorized per-runtime slice via
   `/dev-dispatch`. Exact test/commit evidence belongs with work; legacy runtime flags are not an
   activation mechanism or a substitute for the separately approved evidence-receipt design.

## Closed-set guardrails (do not bypass)

- Resolve the closed message set from the activated R-messages revision. Adding a message
  or changing its legal arrays requires an explicit root semantic decision and this flow.
- Kernel notification, settlement and subscription behavior are fixed by current rules; ordinary
  node functions cannot inject START, PENDING or RESOLVED, or replace protocol delivery hooks.
- Resolve R-wave/R-invalidation before touching silence, equality, or invalidation. Resolve
  R-invocation/R-lifetime/R-request-order for ctx reads, late output and body/commit failures.
- Control/demand is explicit module data and dependencies. Resolve R-checkpoint for cold restore;
  the host decides what to retain after restoration.
- A field or option living in sugar does not exempt an actual protocol behavior change from this flow.

## Code-intelligence routing

Use a current Codegraph index when it helps trace the affected symbols; use direct file reads or
`rg` for simpler lookups, unavailable tools, or stale/unindexed files. Reuse source already read.
Do not initialize an index merely to satisfy this workflow. Validate through the affected executable
checks and required gates; an index is context, not correctness evidence.

## Output

A spec-amendment plan: which rule(s) change, the TLA+ invariant delta, the conformance scenario(s) added, the D# (new or referenced), and the per-language implementation order. Obtain approval for an unresolved closed-set change before writing TLA+/code; do not re-request approval already given for the same concrete change.

After the spec data lands and `--check` is clean, hand off to `/dev-dispatch` per language package and `/conformance` to drive the scenarios green.
