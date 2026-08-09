---
SESSION: csp11-d702-offline-qualification
DATE: 2026-08-09
TOPIC: D702 package-private stale-result mutation-first recovery offline qualification.
REPO: graphrefly (language-neutral authority)
STATUS: ACTIVE EVIDENCE SLICE. D702 remains owned by DS-1; this focused record exists so the
  authority index and dashboard can bind the implementation evidence without duplicating the
  clean-slate design narrative.
SUPERSEDES: none
RELATED:
  - sessions/active/SESSION-clean-slate-redesign.md
  - decisions/decisions.jsonl#D702
---

# CSP-11 D702 offline qualification

D702 authorizes only an offline, package-private and provider-neutral mutation-first recovery
qualification after one D695 stale-result batch is rejected before side effects. It does not
authorize credentials, provider/network calls, charged execution, a live replacement, efficacy
claims, public exports, Graph/protocol changes, cross-language work, stores, Demo, UI or web work.

Implementation evidence and final gate results remain recorded in DS-1; this file is a focused
authority-index slice, not a second design authority.

## 2026-08-09 qualified implementation evidence

- The package-private closed host now issues at most one host-authored mutation-first recovery
  capsule after an exact D695 stale-result rejection. The capsule is same-process branded and binds
  exact canonical rejection-receipt, rejected-request, retained-result and material-free workspace
  snapshot bytes; digests remain evidence rather than equality authority.
- Both Chat and Responses wire fixtures lower the provider-neutral first-tool requirement to their
  endpoint-correct named `tool_choice` shapes. The host independently enforces that the first
  accepted intent is `replaceExact`, rejects any later second mutation before side effects, and
  preserves D674 ordering for the safe `replaceExact -> workspaceDiff -> runCommand` path.
- The offline qualification covers the historical-shaped path plus two independent non-D690
  generic fixtures, wrong-first and repeated-stale negative cases, request/capsule replay and
  substitution, accessors, canonical collision buckets, state drift before/retry/after model
  invocation, zero retained results, bounds, privacy and atomic persistence failure paths.
- Focused D702 tests passed 5/5; combined D695+D702 tests passed 12/12; the empirical boundary suite
  passed 29/29; the full `@graphrefly/ts` suite passed 142 files and 2195 tests with four existing
  skips; lint, TypeScript typecheck, package build/export checks, Biome and `git diff --check`
  passed. The first full-suite attempt had one unrelated D658 filesystem test exceed the default
  five-second timeout by 18 ms; it passed alone in 2289 ms and the second full suite passed.
- Static export/topology, raw-async, timer/retry/fallback, credential/raw-provider/private-material
  and residue scans found no D702 public surface or operator artifact residue. No credential,
  provider/network call or charged execution occurred.

`causalAttribution=undetermined` and `efficacyClaim=none` remain fixed. B112 remains open and
CSP-11 remains `impl` with `gap=true`; any charged replacement still requires a new exact decision
and explicit approval.
