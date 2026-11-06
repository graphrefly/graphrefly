# B121 provider limits / rerun outcome — 2026-09-16

## Outcome
Implementation verified; live study remains incomplete. Stop reason is insufficient conservative dispatch budget under the standing cumulative USD2 grant. No library-usability conclusion or B121 completion follows.

## Provider and local limits
Together route deepseek/deepseek-v4.1-flash names deepseek-v4.1-flash-20260910 weights. Published combined request context1048576; max completion943718; max prompt null means no separate published cap, not unlimited. Route locked, fallbacks off, reasoning disabled. No smaller provider context limit was observed. Metadata snapshot is retained in v8/provider-metadata.json.

API cumulative input was raised from48000 to200000 (v8), then1000000 (v9/v10). This is repeated input across turns, distinct from a single request's context. Local output remains8000/session and4096/request,80 operations,75 minutes. Input estimation is a byte-based heuristic, not an exact tokenizer. Source retrieval remains frozen-map-only. Empty-result source prefixes are recoverable, unsafe paths denied. No product library files or scoring rubric changed.

## Live attempts (no cherry-picking across runs)
| Attempt | Comparison complete | Entry submitted | Reported USD | Stop / limitation |
|---|---:|---:|---:|---|
| v8, 837c281f… |11/12,185/192 answers|0/6|0.164522484|200k cumulative caps; unmatched search prefixes fatal|
| v9, a47fc6f9… |2/12,32/192 answers|0/6|0.021276156|503 retry recovered; later finish_reason=error stopped campaign|
| v10, ec081c7e…--authorized-r1 |9/12,161/192 answers|0/6;4 started|0.193837428|3 comparison model format/value failures;3 entry1M cumulative stops; fourth entry cost gate;2 unrun|

V10 entry participants expanded source reading rather than submitting a solution. Inputs for the three budget-stopped entries were949773,951158,970939 tokens; these count repeated history. No code was submitted, so neither compilation nor trusted semantic acceptance can be claimed. Increasing the context-window setting would not fix this distinction.

## Final accounting
At2026-09-16T07:21:59.681Z, current key usageUSD0.775756572 + retired keyUSD0.022818016 = cumulative confirmedUSD0.798574588. V10 key delta exactly matches provider-reportedUSD0.193837428.

Unresolved reservations retained: prior503USD0.3151872 + two v10 fetch failuresUSD0.638976 =USD0.9541632. These are conservative reservations, NOT confirmed charges. Combined committed amountUSD1.752737788 leavesUSD0.247262212, below the next full-context request reservationUSD0.319488. Do not describe this as USD2 actually spent. Do not discard unresolved reservations merely by starting a new attempt. V10 carried prior unresolved reservation explicitly in approval.json.

## Verification and review trail
152/152 offline tests passed in /tmp/b121-v10-final-tests.log. All54 synthetic feasibility paths complete; this proves possible serialization, not live model success. V10 journal1867 records and frozen bindings verified; key bill reconciled. Independent blind/edge/verification reviews completed; repaired attempt evidence association so an intact journal cannot be moved between two attempts sharing a manifest. Distinct trusted attempt identities allow authorized retries without deleting anti-replay claims.

Concern walkthrough:
1. Budget separation: scripts/b121-comparison/api-limits.mjs:3 and api-runner.mjs:296 distinguish per-session cumulative input from provider combined request context; api-provider.mjs validates reported combined tokens.
2. Retrieval correction: source-access.mjs:129 returns recoverable unmatched-prefix feedback without adding source access.
3. Attempt evidence: api-campaign.mjs:85 enforces safe exclusive attempt naming; offline review at420 binds full claim approval to the attempt record.

No commit, push, protocol/authority decision, or runtime-library modification was made. Future execution remains covered by the user's standing grant but cannot proceed under the current conservative dispatch budget; resolving uncertain billing or a separate budget change would change that condition. Before another live run, address entry cumulative budgeting/source-reading behavior using retained evidence; do not repeat a full campaign unchanged hoping for a better score.
