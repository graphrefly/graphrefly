# Spending-alerts flagship on the reference kernel

Non-normative. This directory runs the B139 acceptance matrix, S1 to S8 in the
[brief](../../sessions/archive/SESSION-b139-causal-flagship-brief-v1.md) section 5, against the DS-17
[reference kernel](../kernel/README.md). The question it answers for DS-17 is whether the flagship's
occurrence identity, currentness, admission, keyed joins, business terminals, conservation and
coverage really are DATA over the kernel, with no new kernel rule (D791). Added 2026-11-07.

The answer is yes. The only kernel addition was a read-only `describe()` (P1), which S1 uses to
compare topologies.

This is not the B139 consumer. That consumer is owned by `graphrefly-ts`
(`examples/spending-alerts`). It is not B121 either, and it is not a human or agent experiment.

```bash
npm run test:reference       # includes flagship.test.mjs and mutants.test.mjs
node reference/flagship/cli.mjs
```

## Files

| File | Role |
|---|---|
| [consumer/vendor-stats.mjs](consumer/vendor-stats.mjs) | Welford with sample std, the brief's algorithm. The S1 and S2 edits change this file |
| [consumer/business.mjs](consumer/business.mjs) | Business rules and passive formats shared by both arms: score, gate, reasons, message, request, proposal, digests |
| [consumer/graph-app.mjs](consumer/graph-app.mjs) | The graph arm: 18 nodes on the kernel |
| [consumer/plain-app.mjs](consumer/plain-app.mjs) | The plain arm: the same coordination as hand-written tables, with no GraphReFly import |
| [consumer/inbox-host.mjs](consumer/inbox-host.mjs) | The focused host. It appends to a real local file and reports a DataResult outcome |
| [runner.mjs](runner.mjs) | Loads an arm from exact bytes in a fresh directory, applying source edits there; the checkout is never touched. It also builds the source-change report |
| [verifier.mjs](verifier.mjs) | The independent oracle. It imports only `node:crypto`, uses two-pass statistics and rebuilds the rules, formats and digests on its own |
| [harness.mjs](harness.mjs) | Input builders and scenario steps: current facts and arrivals, then receipts, then grants, then drain |
| [flagship.test.mjs](flagship.test.mjs) | S1–S8, each run on both arms (44 tests) |
| [mutants.test.mjs](mutants.test.mjs) | Runtime mutations of the graph arm (brief section 6) |
| [cli.mjs](cli.mjs) | A demo outside the executing closure. S8 edits its title |

## The graph

```text
evaluations ─► occurrences ─┬─► vendorStats ─┐
                            ├────────────────┴─► anomalyScore ─► thresholdGate ─┬─► reasonFactors ─► alertMessage
                            │                                                   └────────── requests ◄─┘
current, receipts, local ───┴──────────────────────────────────────► admission ◄── requests
admission ─► release (quiet, H6) ─► inbox host ─► outcomes
requests, admission, outcomes ─► ledger          thresholdGate, alertMessage, ledger ─► terminals
occurrences, requests, receipts ─► evidence      occurrences, terminals, ledger ─► runEnd
```

| Node | What it decides |
|---|---|
| `occurrences` | Validates and digest-checks each occurrence. Per revision domain it accepts only `highWater+1`; a later revision is held as a visible gap. An exact replay is quiet; a different occurrence at an accepted revision is a conflict. Bounded: past the bound an occurrence is refused, so it fails closed |
| `vendorStats` … `alertMessage` | The TS pipeline's rules, one row per occurrence key. `anomalyScore` joins by exact key |
| `requests` | Joins the gate with the message by key. A flagged evaluation gets an exact request body, which binds occurrence, input, policy, code, runtime, destination and host epoch, plus a proposal |
| `admission` | Decides once per occurrence. The occurrence is current when the current fact names its policy and the watermark has reached its revision. A flagged evaluation also needs exactly one matching receipt with verdict pass, and exactly one grant that matches and is in force and within budget. Currentness is checked again at effect admission. A missing fact waits; it never counts as yes |
| `release` | The quiet lifecycle port. Each admission goes out once, as a later wave in its own array. Nothing is sent for pending, rejected or replayed paths |
| `ledger` | D791 conservation. An outcome settles only its exact admitted proposal, request and admission. A wrong outcome is an issue; a repeat adds nothing |
| `terminals` | Keyed fan-in of the declared branches: assessment, explanation and publication, as in TS (D791). Absence never counts as an end |
| `evidence` | Coverage per occurrence: input, code binding and verification (included, stale or unavailable). The record is bounded; past the bound it is a retention gap. Admission never reads it |
| `runEnd` | Normal-end readiness: no gap, every occurrence ended, no active or unknown effect |

## S1–S8

| Scenario | What the tests show (both arms) |
|---|---|
| S1 | The brief's pack (100, then 200; zThreshold 0.8) with the sample→population edit. The topology from `describe()` is identical. The report names `vendor-stats.mjs` and the node `vendorStats`. The verifier fails the second evaluation (std, z, flagged). The operator granted the candidate's proposal, yet admission rejects it on the verdict, and the inbox stays empty |
| S2 | The algebraic Welford rewrite is reported as changed and verified equal, and writes once. The read-back equals the expected payload and the base's payload. Strict `>` control: z exactly 1 against threshold 1 is not flagged |
| S3 | Two vendors with their own policies and statistics, delivered three ways: one batch, one at a time, and reversed in one array (gaps filled within it). All three give the same keyed terminals, and borrowing would have flagged B2. Outcomes returning in reverse order settle exactly their own effects. A missing explanation branch keeps the occurrence open, even after its publication is rejected |
| S4 | A receipt bound to another domain, id, revision, digest, sourceRefs or request releases nothing; so does a grant for another occurrence, request, destination or host epoch. A forged occurrence digest is refused. r3 before r2 is a visible gap that a forged r2 does not fill; the real r2 releases r2 and then r3. A short watermark waits. A late admission after revocation is rejected. The quiet port carries only `[DIRTY, DATA]` releases, never RESOLVED |
| S5 | Replaying every input and the outcome adds no count and no write. The same id with another payload conflicts and does not replace the first. Feeding an old run into a new host epoch never writes, because the old receipt verified a request that names the old epoch |
| S6 | Each kept separate, with conservation holding in every case: succeeded; failed (known: the destination does not exist, nothing written); unknown (a short write or an interrupted write); active (no outcome yet). A forged outcome with the wrong admission settles nothing |
| S7 | A missing receipt blocks the effect and shows `unavailable`. A receipt for other code is `stale` and blocks. Missing or forged provenance makes the attribution `unknown` without changing the writes. A full or disabled audit record gives a retention gap with the same writes. When the occurrence bound is exhausted, the occurrence fails closed |
| S8 | A normal transaction publishes nothing and ends normally. A title change in `cli.mjs` appears as a change outside the closure: the source digest, proposals and inbox are unchanged |

Runtime mutations of the graph arm. Each one loads and runs. It is killed by a business,
authorization or conservation assertion, never by a load error, and its scenario first passes
unmutated.

| Edge or rule removed | Killed by |
|---|---|
| admission→host (the host reads requests) | the effect proceeds without a receipt |
| exact request in the receipt match | a receipt for another request |
| source binding in the receipt match | a receipt for other code |
| verdict | S1's failed verification |
| grant required | no grant |
| currentness: policy, or watermark | revoked policy; short watermark |
| revision order | a skipped revision |
| keyed join (latest vendorStats instead) | two vendors in one array |
| outcome association | a forged outcome |
| effect accounting | conservation |
| DataResult (known failure as protocol ERROR) | the failed count |
| quiet release | the port sends DIRTY and RESOLVED |
| explanation branch in terminal fan-in | a rejected occurrence with no explanation |
| host: short write counted as success | unknown expected |

**Surviving defenses, found and kept on purpose.** Removing the host's exactly-once record changes
no acceptance result: admission decides each occurrence once, so the host never receives an
admission twice. The record stays as the boundary's own defense, as in TS. A third layer, a
"released" set inside `release`, also survived and was removed for the same reason.

## Kernel features the flagship used

- Used: `state`, `node`, `ctx.state`, several `ctx.down` arrays per run, `ctx.deps[i].waves`, `batch`
  (several arrivals or facts in one array), the quiet node (H6), subscription and `observe` (H5),
  and host writes from a sink, which become later waves (K8).
- The quiet node is load-bearing: the "quiet release" mutant is killed. A non-quiet release sends
  DIRTY and then RESOLVED on every path that releases nothing, which D791 forbids at the lifecycle
  port.
- Not used: INVALIDATE, PAUSE/RESUME/PULL, the pause and demand modules, `onInvalidate` or
  `onDeactivation`, async node work, COMPLETE, and terminals other than the one mutant.
- Kernel addition: `describe()` (P1).

## Differences from TS and from the brief

| Here | TS `dafc5ae` | Why |
|---|---|---|
| Welford with sample std; the pack 100/200 with zThreshold 0.8; the edit changes the std denominator | Exact BigInt moments, the pack [1,2,3], and an edit to `exactZScore` | The brief fixes this algorithm, pack and edit; TS qualified with others |
| The verifier uses floating-point two-pass statistics within `1e-10·max(1,\|e\|)` | Exact rational arithmetic with binary64 rounding | The brief's "two-pass mean / sample variance" with its tolerance |
| No limit on writes in flight; a grant's `maxWrites` bounds the writes | One write in flight; a second admission is cancelled | The brief asks only for a count bound. Consequence: two writes may finish in either order, so the tests compare file lines as a set and check order at `release` |
| No final guard at dispatch | The host re-checks facts before writing | The release reaches the host in the wave right after admission, and no host input can come in between (K8). TS dispatches from a microtask after the graph |
| One host, shared by both arms | A separate plain host | The host is the effect boundary, not coordination |
| One current fact per domain: `{ policyRef, policyDigest, watermark }`. A different policy rejects the occurrence | The fact also names the occurrence; there is a `superseded` state | Every occurrence id here has one revision, so nothing is superseded |
| `runEnd` does not need a stop fact | `runEndReady` needs `stop` | Nothing here keeps running after the inputs |
| Per-node source binding at file granularity (`sources` in graph-app) | A literal label marked "not attested" | S1 asks which node's implementation changed |
| Provenance is `{ actor, patchDigest }` on an edit; it counts only for that exact patch | No provenance shape | S7 needs a provenance to delete |
| The terminal fan-in node is `terminals`, and its third branch is `publication` | `branchTerminals`, with `requiredBranches: ["assessment", "explanation", "publication-policy"]` | Names only; the branches and the rule are the same |

## New things

Each was reviewed against the minimality rule and kept because a scenario needs it.

- Kernel `describe()` (structure only).
- The runner's copy-and-edit loading. TS does the same through an esbuild plugin.
- `sources` (node → file) and the edit's `provenance`.
- `evidence`'s retention bound, and `limits.occurrences` failing closed (S7).

## Cost (S8)

| | Graph arm | Plain arm |
|---|---|---|
| Code lines (non-comment) | 286 | 204 |
| Coordination structure | 18 declared nodes, 1 of them quiet | about 14 tables and one reconcile pass |

The plain arm is shorter here. There is no timing row: one run takes a few milliseconds, mostly
loading and the file write, and runtime is not the question here.

Mutations were run on the graph arm only. The plain arm's rules could be mutated the same way: each
one is a check in its reconcile pass. That was not done, so this comparison does not show which
arm's tests catch more. The [operation-tree comparison](../operation-tree/README.md) mutates both
arms.

## Not claimed

The tests cover one host lifetime only: there is no crash recovery or durable exactly-once
guarantee. The tests show nothing about human or agent understanding, and nothing beyond the
finite inputs used. Arms load from copied bytes, not from a bundle of the checkout.
