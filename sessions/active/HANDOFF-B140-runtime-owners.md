# Handoff to the runtime owners: the D797 kernel set

Written by Claude on 2026-11-10 for [graphrefly:B140](../../plan/backlog.jsonl)'s owner routing, at
the user's request. This is a brief, not a rule, a decision or a work item. The root repository keeps
only integration and acceptance: each runtime owner (graphrefly-ts, graphrefly-rs, graphrefly-py)
admits its own implementation slice in its own `plan/work.jsonl`, when the user decides, and writes
its own work body there. Nothing here dispatches implementation. Records are in English.

## What is current

The public protocol is the D797 kernel set, activated by
[graphrefly:D798](../../decisions/decisions.jsonl) and revised the same day (2026-11-10) by
graphrefly:D799 and graphrefly:D801 (START is the kernel's alone). Read the rules themselves in
[spec/rules.jsonl](../../spec/rules.jsonl); this list only names them:

| Rule | Revision | Concept |
|---|---|---|
| R-messages | 1 | the closed message set and array shape |
| R-wave | 3 | waves, PENDING, settlement, written order |
| R-subscription | 3 | START (the kernel's alone) and the last-array snapshot, the seed |
| R-invocation | 3 | the function and its ctx |
| R-terminals | 1 | COMPLETE and ERROR, their auto and manual policies |
| R-invalidation | 1 | INVALIDATE and its auto and manual policy |
| R-lifetime | 2 | activation, lifetime, setup and cleanup |
| R-request-order | 3 | requests, batch, set, replace, ctx.rewire |
| R-node | 2 | node, instance and lifetime scopes; definition |
| R-failure | 3 | throws and invalid output |
| R-graph-domain | 3 | one graph, one domain: graphs share no wave, queue or batch (D803) |
| R-no-imperative | 2 | control is data on a declared edge |
| R-node-thin | 2 | (no behavioral scenario: not observable) |
| R-sentinel | 1 | unchanged |
| R-checkpoint | 1 | module: capture and restore (D802; see "Checkpoint after D802") |
| R-graph-surface | 2 | the graph layer: find, describe, observe, retain (D805; see "Review corrections after D806") |
| R-primary-api-clean | 2 | value-level sugar sees values only (D805) |
| R-bridge | 2 | module: the wire edge group, one frame per sender wave (D803, D804; see "Bridge after D803") |

R-checkpoint, a module rule, is active since graphrefly:D802 (2026-11-10), and R-bridge since graphrefly:D803 (2026-11-11). The other module rules
(R-pause, R-demand, R-history, R-restart, R-revision) are drafts. Each activates later as separately
admitted work; R-revision is held until a real consumer exists.

Background and every choice's reason: [D797](../../decisions/decisions.jsonl) and its later sentences,
[D798](../../decisions/decisions.jsonl), D799, and
[the B140 proposal](PROPOSAL-B140-kernel-rule-revision.md) (sections 9.6 to 9.9 are the latest).
A non-normative interpreter of the whole set, with tests, is in
[reference/kernel](../../reference/kernel/README.md) and [reference/modules](../../reference/modules/README.md);
its "Differences from the TS baseline" tables compare it with TS at `dafc5ae`. Use it to read
behavior, not as evidence for a runtime.

## What every runtime changes (contract level)

These are the observable differences from the rules the runtimes implement today. How to implement
them is each owner's.

1. **Messages and wire.** Seven types: START, PENDING, DATA, RESOLVED, INVALIDATE, COMPLETE, ERROR.
   DIRTY is renamed PENDING. TEARDOWN, PAUSE, RESUME and PULL are gone, and so are ctx.up and
   ctx.upNext: nothing travels up the graph. [spec/protocol.proto](../../spec/protocol.proto) reserves
   the retired numbers and drops Tier and Direction. Its per-edge wire-edge frame, renamed PENDING
   by D798, was replaced by one `WireEdgeCause` per cause in D803 (see "Bridge after D803"), so old
   and new bridge peers do not interoperate.
2. **START, PENDING and RESOLVED are the kernel's alone.** Node output with any of them is rejected
   (START since D801: it is sent only at subscribe and at a replace). PENDING
   prefixes every array that carries DATA, RESOLVED, INVALIDATE, COMPLETE or ERROR and marks the
   sender's dependents pending; a pending node that sent nothing gets exactly one RESOLVED.
3. **Arrays.** Each `ctx.down` call is one array, kept in written order: a terminal is last, and an
   array is split at its last INVALIDATE. The snapshot a subscriber or new dependent gets is the
   values of the last array that carried DATA, then the terminal.
4. **Functions and ctx.** `ctx.deps[i]` gives id, this run's arrays, terminal, latest value and,
   under the manual INVALIDATE policy, whether an INVALIDATE arrived. ctx also gives private state,
   `down`, `rewire`, the lifetime signal and, on a seeded instance's first run, the seed's note.
   There is no `onDeactivation` and no `onInvalidate`. A run may bring no new input. A write to the
   node's own upstream is a queued request, never a reentry.
5. **Policies.** COMPLETE, ERROR and INVALIDATE each have an auto or manual policy per node. Under
   auto ERROR, an INVALIDATE before the ERROR in the wave applies first.
6. **Lifetime.** An optional setup runs once per lifetime before the first run and may return the
   lifetime's cleanup; it belongs to the instance. Closing aborts the signal, releases dependencies,
   runs the cleanup and drops private state, also when the node ends. A node that ends closes its
   lifetime at once and holds nothing upstream; an ended node can still be subscribed and depended on.
7. **Requests.** Requests made during a wave wait and run in order. `batch(body)` runs body at once
   and commits its writes as one wave; its commit is a request. `set(id, fn)` computes from the value
   when the write runs; a function that returns its argument writes nothing.
   `replace(id, deps, fn, { setup, recipe })` gives a node a new instance under the same id and
   subscribers. `ctx.rewire(deps)` changes the node's own dependencies for the current lifetime and
   is undone when it closes; there is no graph-level rewire. The cycle check looks through current and
   declared dependencies.
8. **Node.** Three scopes: node (id, subscribers, policies), instance (deps, function, setup, an
   opaque recipe the kernel stores and never reads, values, terminal), lifetime. `definition(id)`
   reads the definition; status is derived.
9. **Sugar, per language.** The first-run gate, dynamic reads and equality dedup are not root rules
   any more; each package decides them.

## TS-specific items (from B140's acceptance and the reference comparisons)

- The TS owner also admits: the grouped-terminal, optional-input and version API migration; the
  tap, withLatestFrom, valve and race mixed-terminal repairs; source and reattach qualification.
- About 15 `ctx.onDeactivation` call sites move to a setup (`source(factory, setup)` already has the
  shape; `effect`'s per-run cleanup needs its latest cleanup kept in private state).
- `ctx.rewireNext` becomes `ctx.rewire`, undone when the lifetime closes (mapOperator then needs no
  per-inner unsubscribe at teardown).
- TS keeps an ended node's dependency subscriptions until its last subscriber leaves, and commits a
  batch called during a wave inside that wave; both change (R-lifetime, R-request-order).
- `graph/worker.ts` sends `[RESOLVED]` where it has nothing to send; under R-wave@2 it returns.
- State `set` gains the function form.

## Python and Rust after D800

Added 2026-11-10. [graphrefly:D800](../../decisions/decisions.jsonl) supersedes D415: graphrefly-py
writes its own Python kernel against these rules instead of waiting for Rust, and needs no
graphrefly-rs build or runtime dependency once it lands. Until then it builds and releases against
graphrefly-rs `cf02fc9`. The Rust migration need not keep `graphrefly-bindings-py` compiling; that
crate is removed once Python no longer imports `graphrefly._native`. Background and measurement:
[PROPOSAL-python-kernel-separation.md](PROPOSAL-python-kernel-separation.md).

## Checkpoint after D802

Added 2026-11-10. graphrefly:D802 activates R-checkpoint@1 and replaces R-snapshot, R-restore,
R-input-receipts and R-resource-reattach with it; the user's item-by-item choices and a per-runtime
comparison are in [PROPOSAL-B140-checkpoint-module-admission.md](PROPOSAL-B140-checkpoint-module-admission.md)
(section 3). It builds on stage 4 (setup) and stage 5 (replace, ctx.rewire, definition), so it comes
after them. What every runtime changes:

1. Capture only at a wave boundary: refuse it inside a wave and inside an open batch body, not only
   when a node is pending.
2. A restored graph has no subscribers, and a restored node receives no waves before its first
   activation (Rust today resubscribes nodes saved as active).
3. Save what each node received from each dependency; at the first activation, run the function once,
   with only the changed dependencies, if one changed, and keep the saved value otherwise (TS today
   never sees the change).
4. The setup runs at the restored first activation, so what it opened outside the graph opens again.
5. The recipe and setup belong to the instance; a replace without a recipe makes the node local-only.
6. Build each node after its declared dependencies; save a ctx.rewire's lifetime dependencies.
7. An ended node comes back ended, with its dependencies, without private state; an ERROR payload is
   saved and must be JSON (Rust today refuses ERROR).
8. No revision or version evidence in a checkpoint: the D109 version field and its restore checks
   leave TS's and Rust's checkpoints (the user's choice). The layout beyond JSON, its version tag and
   what to do with checkpoints already written are each package's; a checkpoint lacking what the rule
   saves is refused at restore. D160's separate `backendState` has no root rule any more: a collection
   is a node whose backend is its private state.

Python writes checkpoint on its own kernel (D800). The checkpoint delta in a runtime's slice is the
owner's to admit, like the kernel stages.

## Bridge after D803

Added 2026-11-11. graphrefly:D803 activates R-bridge@1 and revises R-graph-domain to @3; the user's
item-by-item choices are in [PROPOSAL-B140-bridge-module.md](PROPOSAL-B140-bridge-module.md). It
ends the hold on each runtime's stage 6 (the cross-graph bridge). What every runtime changes:

1. **Graphs on one thread share nothing of a wave.** Each graph has its own wave, request queue and
   batch. A request to graph B made during graph A's wave runs at once if B is idle, and a write to B
   inside A's batch body is B's own request, not part of A's commit (C-47). TS moves its batch and
   boundary queue from module variables to the graph; Rust moves its wave scope, request queue and
   batch frame from `thread_local!` to the graph, retiring graphrefly-rs:D8's recorded deviation.
   Python already does this. A dispatcher's function table and worker pools may stay shared.
2. **A cause is one sender wave, sent as one frame.** The group's outbound node is a fan-in over the
   group's edges with manual COMPLETE, ERROR and INVALIDATE policies; each run in which an edge
   brought input sends one `WireEdgeCause` carrying only those edges, each with an INVALIDATE, its DATA
   arrays and its terminal as the ctx gives them. Its setup names the session, causes count from 1, and
   the first run carries every snapshot and an INVALIDATE for an edge without one. A value or ERROR
   payload that is not bytes is a throw of the outbound node.
3. **Wire.** `WireEdgeCause { group, session, cause, edges: [{ edge_id, arrays: [Wave] }] }` replaces
   `WireEdgeFrame` and `WireEdgeKind`; `WireBridgeDataPayload.edge_cause` is field 3 and field 2 is
   reserved. The fixtures are `wire_edge_cause.v1.jsonl` and the rewritten envelope vectors (C-1a).
   They were written by hand, so a disagreement with a runtime's decoder is reported to the root.
4. **Receiving.** Frames come from a node with no dependencies whose setup opens the receiving end,
   one wave per frame. The gate takes its group's frames, releases a session's causes in order and
   each at most once, drops a cause at or below the last one taken, releases one past a gap and
   reports the gap, starts again for a new session, and refuses whole a frame with an undeclared edge
   or arrays its inbound node could not send. Inbound nodes depend on the gate; an inbound node's
   snapshot is what its edge last brought. Issues are values of the issues node, never terminals.
5. **Removed, with no shim:** per-edge PENDING and DATA frames, one cause in flight, the fresh-cohort
   rules (D560, D561), tombstones (D506), the release drain (D562) and the status node; TS's `_rewire`
   of the bridge's command and inbound nodes and `_down` into the release cohort; Rust's
   `FanInSources` for the bridge's command and inbound. The envelope layer's remote-call and
   ack-timeout lanes take the same shape: received envelopes from a source node, facts as state
   writes, outbound nodes with a transport sink.
6. **Names.** The reference module's `wireEdgeGroupOut`, `wireEdgeGroupIn`, `frameSource` and
   `frameSink` (in [reference/modules/bridge.mjs](../../reference/modules/bridge.mjs)) are the public
   shape, in each language's casing.

7. **Ended inbound edges (D804, R-bridge@2, same day).** An inbound node that has ended takes nothing
   more: in any frame its edge's arrays are skipped and the rest of the frame is released, and the
   skip is an `ended` issue only when those arrays do not end with a terminal. Refusal whole stays for
   an undeclared edge, a kernel-only message, a terminal not last or an array after a terminal in the
   same frame. The first cause's INVALIDATE goes ahead of the snapshot of every edge without a value,
   also one whose snapshot is its terminal alone. Found by graphrefly-py's stage 6.

Python also brings back the wire facades graphrefly-py:D5 withdrew, in this shape, and requalifies
C-1a and C-1c. Each owner admits the stage-6 delta in its own slice.

## Review corrections after D806

Added 2026-11-11, from the two D797 migration reviews (sessions/active/REVIEW-D797-migration-*.md,
not tracked) and the user's answers to their merged questions. graphrefly:D805 is the graph layer
(Q6), graphrefly:D806 the kernel corrections (Q12, F 2.9, F 2.10). What every runtime changes:

1. **Graph layer (R-graph-surface@1).** `find(id)` gives the node or nothing (a state as its state
   handle) and activates nothing. `describe()` gives exactly `{ id, kind, deps, quiet }` per node in
   creation order, deps current: no name, factory, status, value, version, meta, edges or subgraphs
   (values and status are read from the node; mount and topology groups have their own package
   APIs). `observe(ids, sink)` is an ordinary subscriber to those ids, one event `{ id, msgs }` per
   delivered array, START first, no tier, no sequence; it returns the stop. Python removes its
   passive kernel observe hook; TS and Rust move from one event per message to one per array.
   `retain(id)` is a subscriber that ignores what it receives and returns the release. C-48.
2. **Value-level sugar (R-primary-api-clean@2)** sees values only; TS's public tier exports go.
3. **Auto COMPLETE runs the last terminal (D806, Q12).** Under auto COMPLETE the run that sees the
   last dependency's terminal calls the function, also when the terminal is its only input, and the
   node completes after it (R-terminals@1, C-17, unchanged). All three runtimes skipped that run.
4. **Cycle check when a queued replace or rewire runs (D806, F 2.9).** Refused then, the request
   changes nothing and goes to the host reporter as a queued request's failure. C-35.
5. **A quiet node's forwarded INVALIDATE marks its cone (D806, F 2.10).** Clear the quiet node's
   pending mark before delivering the INVALIDATE, so a diamond below settles once. C-16.

## What each runtime must show (acceptance)

Every kernel scenario starts `todo` in every runtime. An owner qualifies a scenario by running a
harness of its own against the scenario's text and reporting the runtime, the test command, the
result and the source commit. Under graphrefly:D784 a changed `runtimes` flag alone is not evidence;
until its evidence-receipt ledger exists, report the evidence with the work item and leave the
flag to the root integration step. Reference-kernel tests are candidate traces, not runtime evidence.

Kernel scenarios on the public rules: C-3, C-4, C-6, C-11, C-12, C-15, C-16, C-17, C-23, C-26,
C-28, C-29, C-33, C-34, C-35, C-36, C-37, C-40, C-41, C-42, C-44, and C-47 (graphs on one thread,
since D803).

Bridge scenarios on the public rules (since D803): C-1 and C-1b (R-bridge), C-1a (new fixtures).
C-1c is unaffected.

Checkpoint scenario on the public rules: C-38, which succeeds C-24 (removed by D802).

Scenarios that also check a draft module rule, and so wait for that module's activation: C-30 and
C-31 (pause), C-32 (demand), C-39 (revision, held), C-43 (restart), C-45 (checkpoint with history),
C-46 (checkpoint with pause, demand and restart; each clause waits for its module), and the older
C-2, C-5, C-9, C-10, C-13 and C-27, which still cover replaced rules and are rewritten when their
module activates.

## What the root does next

When an owner reports evidence, the root records it against the scenario and the work item, and
closes B140's owner routing once each owner has admitted its slice. Module activations are separate
work. Ask the user before admitting anything in a runtime repository; the TS repository is not to be
changed from root sessions without the user's word.

## D808 rereview repair slice (2026-11-12)

The user authorized root and all runtime repairs after the Codex rereview and alignment reply. Root owns the revised rules and models; packages own their existing migration work. Implement invocation-scoped dependency views (old views never revive), one quiet final-output/COMPLETE wave, independent late-output requests across failed commits, graph diagnostics as package functions, and the N1-N11 repairs. Shared diagnostic reasons and normalized probe outputs are in `spec/fixtures/d797-rereview.v1.json`; this fixture is acceptance evidence, not a second rule ledger. Restore stays cold; the host explicitly retains before commands. Runtime branches may be committed and pushed after verification, not merged; root main may be committed locally but its push awaits the user. D687 stays at the true pre-merge head.

Acceptance matrix: expired ctx/view -> shared refusal; replace cleanup -> old state visible, then revoked; ended batch target -> no updater/partial writes plus report; quiet final DATA/COMPLETE -> one dependent run, two arrays; failed commit -> late output survives, quiet staged output does not; throwing body -> all body requests discarded; missing received or non-JSON -> precise refusal; bridge without external subscribers -> no lost commands or reused indices; same normalized probe -> equal outputs in TS/Rust/Python. Keep evidence and commit mapping under the existing migration work and final repair handoff.

### Repair execution and review record

Baselines for this repair, before any edits: root `c8c1b69`, TypeScript `614bdc5f`,
Rust `7f65daf`, Python `8e8d92e`. Each checkout was clean. Root remains on local main;
the three runtime owners remain on `d797-kernel-migration`. No worktree, PR, merge or
release was created. User authorization covers fixes, local commits and verified runtime
branch pushes; root main push is a separate final approval.

This repair does not close B140 or the runtimes' migration work. It does not qualify D687,
activate deferred module rules, or implement the separate module checkpoint coverage plans.
Python's new CHECKPOINT-COVERAGE-PY is actual follow-up work for bridge and host-source
state/recipes, with the migration prerequisite; it is not a placeholder for the orphan gate.
Restore remains cold in all owners. The host explicitly retains the desired roots.

Machine review added these adjacent repairs to the original N1–N11 list:

- Root checkpoint capture/restore shared mutable objects; both boundaries now detach JSON data.
- Root/Python could accept a missing enclosing lifetime or incomplete received record; explicit
  cold-null and per-record validation prevent silently rerunning from incomplete history.
- Root's old ctx could access a replacement lifetime's private state; lifetime identity now
  guards access while permitting cleanup to read the retiring state.
- The common probe disproved the initial assumption that TS already handled every late-output
  batch case. Actual body-issued late output must survive updater failure, not only output
  requested during commit delivery. The rule's rationale was corrected; the approved behavior
  did not change.
- Root observe validated targets one at a time, leaking an activation if a later ID was invalid;
  all targets are now checked before activation and the target list is copied for reliable release.
- Root treated false/zero/empty-string saved lifetimes as cold null; exact null/object validation
  now rejects them. Public factory failures in Python/root now retain a node-qualified prefix,
  including malformed callback results, while the eight common reasons remain unchanged.
- The common probe exposed Rust's retained ctx losing access to private state during cleanup.
- Rust blind review found dynamic IDs that find could resolve but observe/retain could not,
  possible name collisions with dynamic IDs, and public diagnostic metadata deciding whether
  checkpoint values were silently omitted. These are implementation findings under existing
  identity/checkpoint contracts, not new protocol choices. The new Rust dynamic-ID allocator also
  releases claims on dynamic node destruction; named-node retirement policy stays separate.
- Verification compared probe inputs as well as outputs. The original TS/Python ended-target
  probes were weaker than the reference trace. The stronger good-updater-before-ended-target
  trace exposed TS's own queued-batch partial commit, which is repaired alongside Rust N2.
  `probeInputs` now records the exact common traces, including real cleanup ledger writeback.
- Public-doc generation rejected legitimate bridge “session” and sequence “gap” wording.
  Contextual internal-copy checks now accept those protocol terms while still rejecting internal
  work paths/notes/coverage gaps. Route, provenance and visibility checks remain in force.

The repair workflow uses independent blind, edge-case and verification-gap lenses, assigning
reviewers to repositories they did not implement. The exact remaining findings and final runtime
receipts are recorded below when the repair loop closes. No performance claim is made: the host
was concurrently running another project's browser tests, with load above 90 during some gates.

Root evidence through `459412c` (last implementation change `a363089`):

- Complete `test:reference` file set with `node --test --test-concurrency=2`: 467 passed,
  zero failed/skipped (44.84s). The earlier default-concurrency run also passed its then-current
  464 tests (178.99s under concurrent host load); three later review regressions are included in 467.
- `npm run test:authority`: 40 passed. Workspace authority/work: zero errors, cycles or orphans;
  one existing Canvas legacy-coordinate warning remains.
- `npm run dashboard:check` and `npm run docs:public:check`: passed. Public check includes two
  classifier regressions, actual site generation and route/content checks.
- TLC 2.19: invocation 7 distinct states; batch/output 20; wave (MaxWaves=2) 2,580,844;
  lifetime (MaxReq=3, MaxBatches=1) 218,102. All configured invariants passed. Four separate
  mutation configs failed the intended invocation, late-output or quiet-terminal invariant.
  These finite models do not prove arbitrary graph sizes or all host scheduler interleavings.
- `node reference/kernel/probe-rereview.mjs`: all eight normalized outputs match the shared
  fixture. Reference tests are not substituted for any runtime's tests.
- Raw root logs: `/private/tmp/d808-root-checks/`. Independent root blind recheck:
  `/private/tmp/d797-root-blind-final-tests.log` (231 passed).


### Final owner receipts and publication (2026-11-12)

All three runtime branches were pushed normally, without force, to
`origin/d797-kernel-migration` after the independent reviews and final gates. Root main remains
local, awaiting the user's explicitly required final push approval. No PR or merge was made.

| Owner | Final runtime head | Final executed checks |
|---|---|---|
| TypeScript (T) | `95cf6e32c59f9fe7c29d9194ef16f81c52696165` | 2546 passed / 4 existing skips, 175 files passed; build, lint, docs, installed ESM/CJS/DTS and 32 package batch checks passed |
| Rust (S) | `bb96782d8c47eb6659834cf865a6aa2b1ac45f89` | final CI nextest 521/521; parent reran all-features on this exact head: 537 unit/integration +10 doctests passed; fmt/stale/clippy/docs passed |
| Python (P) | `eb963e52d2cc33c625d8cfe45631acd4a7dead36` | 380 passed /2 optional skips; the optional runtimes separately passed 2/2; ruff, mypy, 80-export API check, wheel/sdist and isolated wheel probes passed |
| Root (R) | code through `a363089`, probe input specification `459412c` | 467 reference +40 authority tests; workspace authority/work, dashboard and public docs passed; bounded TLC and negative mutations above |

The final complete TS suite used one worker with its original timeouts. Earlier concurrent runs
exposed and repaired real consumer migration gaps; remaining timing-only failures passed controlled
serial rechecks and then the complete serial suite. No timeout was increased. The final Rust
all-feature log is `/private/tmp/d808-root-checks/rust-final-allfeatures.log`; it supersedes the
older-source all-feature receipt in the per-owner temporary handoff. Final default nextest is
`/private/tmp/d797-fix-rs-final-nextest.log`.

The parent independently executed all four behavior probes after the source froze, including Python
from the newly installed wheel outside its source checkout. Their eight structured outputs are equal
to each other and to `spec/fixtures/d797-rereview.v1.json`; the matching input traces are recorded in
`probeInputs`. Results are `/private/tmp/d808-root-checks/final-{reference,typescript,rust,python}.json`.
The eight checkpoint reason categories also match exactly. Invalid host values used to exercise a
category may differ by type system; this does not add a new protocol number range or JSON schema.

### Finding-to-repair map

| Finding or accepted choice | Owning repair commits | Observable result / final gate |
|---|---|---|
| N1 cleanup state/writeback | T `8b678963`; S follow-up `8298af7` | cleanup writes retiring value 42 into ledger; T/S/P common probe |
| N2 ended queued batch | S `153581e`; T follow-up `4f2fcfca` | all targets checked before any updater, no partial writes, one host report; T/S/P |
| N3 Python bridge | P `0679f1b` | core/events held across external subscription gaps; monotonic events and status high-water; P |
| N4 missing lifetime/received | T `b6725c23`, `d29ffae9`; P `0c2ee53`; S `f54a907`; R `f9a7d97`, `a363089` | explicit cold-null, malformed/missing history refused; T/S/P/R |
| N5 non-JSON local state | P `a21c4c6`; S metadata follow-up `f54a907`; R `f9a7d97` | local-only/diagnostic labels cannot hide invalid state; P/S/R |
| N6 quiet final wave | S `b66b01e`; P `6387e45`; R `f9a7d97` | final DATA and auto COMPLETE are separate arrays in one later wave; all four probes |
| N7 node refusal envelope | T `b6725c23`, `d29ffae9`; S `d08007a`, `bb96782`; P `b58a001`, `68c16c3`, `0cdf095`; R `a363089` | exact common reasons and known-node factory/dependency errors attributed once; T/S/P/R |
| N8 construction-time arity | S `cf0787a` | bad fixed arity fails before constructing/activating the operator; S |
| N9 CI fixture availability | P `c717979`, `08748c7` | pinned canonical protobuf checkout; missing CI fixture fails rather than skips; P |
| N10 immediate observe stop | R `38b80e9`, `ba97f5e` | observer sees DATA1 only; ordinary subscriber still receives DATA2 before release; all probes |
| N11 registered dependency IDs | S `a268b20`, `a4ee3a3`; T `7d40a495` | describe/find/observe/retain/DepView agree; live IDs stable and unique in both allocation orders; T/S |
| Invocation-only dependency reads | T `2da3030e`; S `b66b01e`; P `ab84501`; R `f9a7d97` | old views cannot revive; Rust deferred deps statically unavailable; T/S/P/R |
| Late output independent of failed commit | T `4f2fcfca`; S `b66b01e`; P `0e096e5`; R `f9a7d97` | late DATA42 survives updater failure; throwing body still discards requests; all probes |
| Diagnostic modules / derived edges | T `7d40a495`; S `bca8f10`, `1d405d2` | optional Graph inspection methods removed; consumers migrated; T/S |
| Rust Result batch / one-name aliases | S `d14193d`, `ef5300f`, `cab2e03` | outer Err discards, caught nested Err uses flattened transaction; aliases removed; S |
| Cold restore / actual Python coverage work | T `95cf6e32`; S `134371e`; P `2d8ee7f` | host explicitly retains; real follow-up work keeps checkpoint coverage unclaimed; workspace gates |
| Root skills / public-doc false positive | R `7a0bdfd`, `5150b29` | current guidance; valid bridge sessions/gaps render while internal copy is rejected; R |

Three independent QA lenses are closed for this slice: blind (Python implementer reviewed root/Rust),
edge cases (Rust implementer reviewed TS/root), verification gaps (TS implementer reviewed root/Python/Rust).
Concrete findings were triaged as patches or stale scenario expectations corrected against D808.
All in-scope findings above were repaired and rechecked; no new unresolved intent decision remains.
This is bounded QA, not a claim that all repository behavior is defect-free.

### Named regression checks

These exact test names supplement the repair/commit and final-suite tables above. Documentation-only
commits use the named owner gates, rather than invented behavioral tests.

| Concern | Exact representative regression / executable check |
|---|---|
| N1 | T: `replace cleanup reads and saves the old private state, then revokes it even when it throws (N1)`; S: `kept_state_reads_retiring_lifetime_only_during_cleanup` |
| N2 | S: `queued_batch_refuses_an_ended_target_before_any_updater_or_commit`; T: `keeps quiet final output in one wave, request boundaries, cleanup and exact refusals` (`endedBatch`) |
| N3 | P: `test_bridge_retains_commands_and_event_indices_without_external_subscribers`, `test_bridge_status_ledger_skips_replayed_events_and_catches_up_after_inactive`, `test_bridge_release_drops_internal_retains_and_ack_driver_stops` |
| N4 | T: `a missing recipe and missing lifetime records use the shared reasons (N4/N7)`; P: `test_restore_refuses_truncated_received_records_without_reconstructing_them`; S: `checkpoint_cold_received_null_is_distinct_from_missing_field` |
| N5 | P: `test_local_only_nodes_still_refuse_non_json_at_capture`; S: `diagnostic_metadata_cannot_suppress_checkpoint_values` |
| N6 | P: `test_quiet_final_output_and_auto_complete_are_arrays_of_one_later_wave`; S: `quiet_last_terminal_and_function_output_share_one_later_wave` |
| N7 | T: `uses exact node-level checkpoint refusal reasons`; S: `checkpoint_node_refusals_use_the_shared_reason_table`, `restore_factory_errors_and_missing_dependencies_identify_the_node`; P: `test_restore_attributes_factory_exceptions_without_double_wrapping` |
| N8 | S: `fixed_arity_operators_refuse_before_registering_or_running` |
| N9 | P: `test_ci_refuses_missing_canonical_fixtures` (external skip mutant killed) |
| N10 | R: `D808: observe stop suppresses later arrays immediately; subscribe release remains queued`, `observe validates all targets before acquiring any lifetime` |
| N11 | S: `dependency_ids_are_graph_ids_during_setup_runs_and_rewire`, `dynamic_dependency_ids_support_find_observe_and_retain`, `dynamic_and_named_ids_cannot_collide_in_either_allocation_order`, `generated_id_claims_are_bounded_by_live_arena_nodes` |
| Invocation expiry | T: `saved ctx and dependency views expire permanently, while captured data remains usable`; P: `test_dependency_views_expire_after_their_own_setup_or_function_invocation`; S: `Ctx::defer` compile-fail doctest |
| Late output | S: `late_output_survives_commit_failure_but_not_body_failure`; P: `test_late_output_is_a_body_request_that_survives_commit_failure`; T: shared `lateAfterCommitFailure` plus mutation |
| Diagnostic modules | T: `keeps richer diagnostics in modules, with no Graph aliases`; S: graph-layer suite plus stale API guard |
| Result batch | S: `nested_batch_result_errors_follow_the_outer_body` |
| Snapshot isolation | R: `checkpoint private state and values are detached in both directions`, `checkpoint cold lifetime is exactly null, never a falsey or array value` |
| Docs/work | R: `public copy accepts protocol sessions and sequence gaps`, `public copy continues to reject internal work surfaces`; `authority:check:workspace`, `work:check:workspace`, `dashboard:check`, `docs:public:check`; owner API/docs checks |

### Suggested human review order

Orientation → Walkthrough → Detail Pass → Testing. The highest-impact changes are the intentional
API removals and stricter checkpoint admission; this handoff does not require a separate teach-back.

1. **Wave and lifetime boundaries.** Start with [activated invocation rule](/Users/davidchenallio/src/graphrefly/spec/rules.jsonl:155),
   then [TS batch preflight](/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/batch/batch.ts:135),
   [shared cleanup](/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/node/node-lifecycle-runtime.ts:419),
   and [common executable traces](/Users/davidchenallio/src/graphrefly/reference/kernel/probe-rereview.mjs:1).
   The boundary is concrete: no updater before target validation; cleanup can still read its retiring state.
2. **Identity and diagnostic ownership.** Read [TS stable slot identity](/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/graph/graph.ts:633)
   and [Rust identity allocator](/Users/davidchenallio/src/graphrefly-rs/crates/graphrefly/src/node.rs:2000).
   Diagnostic functions consume graph/node truth; generated IDs cannot be stolen or renamed while live.
   TS reuses existing slots and adds no WeakRef/FinalizationRegistry requirement. Python's constructor
   identity `Graph.name` property is preserved; no inspection/topology API was added there.
3. **Recovery and bridge state.** Follow [Python bridge ownership](/Users/davidchenallio/src/graphrefly-py/src/graphrefly/_wire_facade.py:221),
   [status ledger](/Users/davidchenallio/src/graphrefly-py/src/graphrefly/_wire/envelope.py:316),
   [restore admission](/Users/davidchenallio/src/graphrefly-py/src/graphrefly/_checkpoint.py:300), and
   [Rust helper ownership](/Users/davidchenallio/src/graphrefly-rs/crates/graphrefly/src/checkpoint.rs:1176).
   Internal ownership, rather than public metadata, decides collection checkpoint behavior.
4. **Observe behavior directly.** Run each owner's shared probe against the root fixture. Expect
   one quiet terminal invocation, observe `[1]` versus subscribe `[1,2]`, late/cleanup `[42]`, and
   ended-batch `{updaterRuns:0, otherValue:0, reports:1}`. These are executable public-consumer traces.

Limits retained: D687 qualification is deferred to the actual pre-merge head; no PR, merge or release
was performed. Hermes evidence is bytecode compilation plus Node semantics, not a real VM/device run.
TS's four existing live/unsupported skips and Python's two optional-runtime skips are explicit; Python
optional runtimes were separately exercised. The existing TS Core slot-retention behavior is not a
new heap/performance qualification. Dependency manifests did not change; cargo-deny was unavailable,
so no fresh dependency-advisory audit is claimed. Existing module checkpoint follow-ups remain planned.

### Per-commit measured changes

Counts include tests, docs and generated API pages. Verification key T/S/P/R refers to the final
source-bound gates above covering that commit's resulting behavior, not a claim that every historical
commit separately ran the final suite. This receipt itself is documentation in the final root commit.

| Owner | Commit | Change | Added | Removed | Net | Verification |
|---|---|---|---:|---:|---:|---|
| R | `4839b52b` | spec: activate D808 rereview repairs and discriminating models | 186 | 18 | +168 | R |
| R | `38b80e94` | fix(reference): stop observe forwarding immediately (N10) | 30 | 9 | +21 | R |
| R | `f9a7d971` | fix(reference): enforce D808 invocation and recovery boundaries | 399 | 61 | +338 | R |
| R | `5c541cc6` | spec: reconcile late-output conformance traces with D808 | 5 | 5 | +0 | R |
| R | `7a0bdfd8` | docs(skills): remove retired kernel and animation guidance | 168 | 456 | -288 | R |
| R | `5150b294` | fix(docs): distinguish bridge sessions from internal work copy | 34 | 14 | +20 | R |
| R | `2c39e852` | docs(spec): avoid overstating prior TypeScript late-output coverage | 4 | 4 | +0 | R |
| R | `ba97f5e1` | fix(reference): validate all observe targets before acquiring lifetimes | 17 | 2 | +15 | R |
| R | `a3630894` | fix(reference): reject malformed lifetimes and attribute recipe failures | 38 | 3 | +35 | R |
| R | `459412c0` | test(conformance): pin the inputs of the cross-runtime repair probes | 10 | 0 | +10 | R |
| T | `8b678963` | fix: share lifetime cleanup across replacement and teardown (N1) | 61 | 39 | +22 | T |
| T | `b6725c23` | fix: require saved lifetime records and unify restore refusals (N4 N7) | 127 | 87 | +40 | T |
| T | `2da3030e` | fix!: scope dependency views to their supplying invocation (D808) | 148 | 76 | +72 | T |
| T | `7d40a495` | refactor!: move graph diagnostics into modules and preserve helper ids (D808) | 1471 | 1099 | +372 | T |
| T | `d29ffae9` | fix: classify incomplete records and known-node restore refusals (N4 N7) | 43 | 2 | +41 | T |
| T | `4f2fcfca` | fix: keep late requests independent and preflight batch targets (D808) | 322 | 26 | +296 | T |
| T | `95cf6e32` | docs(plan): record D808 repair evidence and cold restore activation | 2 | 2 | +0 | T |
| S | `153581e3` | fix: refuse ended batch targets before any updater (review N2) | 66 | 1 | +65 | S |
| S | `cf0787ad` | fix: check fixed operator arity before construction (review N8) | 141 | 37 | +104 | S |
| S | `a268b201` | fix!: expose graph ids in dependency views (review N11) | 95 | 38 | +57 | S |
| S | `d08007a3` | fix: unify checkpoint refusal reasons (review N7) | 80 | 25 | +55 | S |
| S | `b66b01ea` | fix!: align invocation scopes and later waves with D808 | 100 | 51 | +49 | S |
| S | `d14193dc` | refactor!: use Result for atomic batch bodies | 395 | 227 | +168 | S |
| S | `8298af79` | fix: expose retiring lifetime state during cleanup | 89 | 15 | +74 | S |
| S | `a4ee3a33` | fix: unify graph lookup and reserve unique live inner ids | 177 | 32 | +145 | S |
| S | `f54a9078` | fix: keep checkpoint authority separate from diagnostic metadata | 167 | 38 | +129 | S |
| S | `ef5300f2` | refactor!: keep one WireEdgeCause type name | 13 | 17 | -4 | S |
| S | `cab2e033` | refactor!: remove redundant operator aliases | 54 | 100 | -46 | S |
| S | `bca8f10e` | refactor!: move optional graph diagnostics to module functions | 392 | 414 | -22 | S |
| S | `e0b82fc2` | test: compare D808 behavior and checkpoint reasons with shared fixture | 321 | 0 | +321 | S |
| S | `134371eb` | docs: record Rust rereview mapping and cold restore activation | 27 | 2 | +25 | S |
| S | `1d405d22` | refactor!: distinguish topology path observation from retired graph API | 6 | 6 | +0 | S |
| S | `bb96782d` | fix: identify nodes in restore factory and dependency refusals | 120 | 32 | +88 | S |
| P | `a21c4c6d` | fix(checkpoint): validate local-only node contents at capture (N5) | 38 | 4 | +34 | P |
| P | `c717979b` | fix(ci): require pinned canonical bridge fixtures (N9) | 28 | 0 | +28 | P |
| P | `b58a0011` | fix(checkpoint): unify node refusal reasons across runtimes (N7) | 80 | 16 | +64 | P |
| P | `0679f1b2` | fix(bridge): retain runtime and index events across subscriptions (N3) | 306 | 32 | +274 | P |
| P | `ab845019` | fix(ctx): expire dependency views with their invocation (D808) | 138 | 39 | +99 | P |
| P | `6387e455` | fix(kernel): publish quiet output and auto complete in one wave (N6) | 22 | 3 | +19 | P |
| P | `0e096e50` | fix(kernel): keep late output independent of batch commit failure (D808) | 42 | 3 | +39 | P |
| P | `da66d7a6` | test: add the shared D808 observable trace probe | 162 | 0 | +162 | P |
| P | `2d8ee7fb` | docs(plan): sequence actual Python checkpoint coverage after migration | 1 | 0 | +1 | P |
| P | `ed468b93` | test(kernel): distinguish D808 late requests from staged host writes | 19 | 8 | +11 | P |
| P | `9a3f7c09` | docs(api): index the public wire event types | 8 | 0 | +8 | P |
| P | `08748c77` | test(ci): reject a skipped canonical-fixture verification | 5 | 2 | +3 | P |
| P | `68c16c33` | fix(checkpoint): use the shared refusal for nested recipe lookups | 14 | 1 | +13 | P |
| P | `0c2ee536` | fix(checkpoint): reject truncated lifetime and received records | 64 | 4 | +60 | P |
| P | `68dac59c` | test: compare cleanup writeback in the shared D808 probe | 7 | 2 | +5 | P |
| P | `bb9f517e` | docs(plan): record source-bound D808 repair verification | 1 | 1 | +0 | P |
| P | `2d482827` | test: preflight every batch target before the first updater | 2 | 2 | +0 | P |
| P | `793a4144` | test: use identical inputs for the shared runtime probes | 35 | 38 | -3 | P |
| P | `0cdf0950` | fix(checkpoint): attribute factory failures to their node | 104 | 8 | +96 | P |
| P | `eb963e52` | docs(plan): record public restore refusal verification | 1 | 1 | +0 | P |

Whole-slice baseline-to-delivery totals (receipt included for root; line counts are not performance measurements):

| Owner | Files | Added | Removed | Net |
|---|---:|---:|---:|---:|
| graphrefly | 32 | 1132 | 563 | +569 |
| graphrefly-ts | 170 | 2169 | 1326 | +843 |
| graphrefly-rs | 38 | 2174 | 966 | +1208 |
| graphrefly-py | 40 | 1030 | 117 | +913 |


## 2026-11-12 QA2 root repair receipt (publication pending)

Authorization: Claude's user-supplied `reply-to-codex-qa2.md` approves Q1–Q7 and shared
runtime CI probes. Root local main commits are authorized; each new origin/main push
requires explicit user approval. Runtime work stays on `d797-kernel-migration`, with no
PR/main merge. This receipt records local root verification; remote CI is not yet evidence.

Baseline `52f413baa58ad2bb13b2dd55a3cfe9e796d32f6e`; verified source `2accac6`.
Source slice: 13 files, +310/-47 (excludes this receipt).

| Concern | Root commits | Behavioral evidence |
|---|---|---|
| Q1 immediate INVALIDATE, deferred lifetime-bound ERROR | `4771691`, test layout `5e209f7` | `QA2: quiet auto ERROR forwards INVALIDATE now` covers auto/manual × retained/empty; `QA2: quiet auto ERROR remains scoped to the lifetime after immediate invalidation`; no stale DATA(3) |
| Q3 complete restore admission | `cfdc1e9`, `cc58d0e`, `2accac6` | `QA2: restore admits the whole checkpoint before any factory side effect` (32 corruptions); mixed declared/lifetime cycle rejection with zero factory calls; valid repeated declared inputs restore 4 then update to 6 |
| Q7 instance ownership documentation | `838c3a2` | Current scope table places setup/recipe under instance; dated history unchanged |

All runtime CIs consume the same immutable fixture commit
`4771691460538cd387197571d930128abdac90a2`, with nine behavior keys including four quiet-error
cases, plus eight checkpoint reasons. Missing fixtures must fail. This is not D687 qualification.

### Root checks and independent review

- Final complete reference suite: **475 passed, 0 failed/skipped**, 43.09 seconds; log
  `/private/tmp/qa2-root-final2-reference.log`. Host load (1/5/15 min) before
  12.298/10.443/10.792, after 14.664/11.338/11.103. Not a performance benchmark.
- Authority suite: **40 passed**, `/private/tmp/qa2-root-full-authority.log`.
  Workspace authority/work, dashboard and public docs checks pass; logs
  `/private/tmp/qa2-root-{workspace-authority,workspace-work,dashboard,public-docs}.log`.
  Existing legacy/coverage diagnostics are not claimed eliminated.
- Shared public probe: nine keys, `/private/tmp/qa2-root-final-probe.json`.
- TLC quiet-error finite model: 24 distinct states, three invariants pass;
  delayed-invalidation and manual-invalidation mutants both violate NoStaleData (exit 12).
  Logs `/private/tmp/qa2-kernel_quiet_error{,_mutant_delay,_mutant_manual}.log`.
  This small discriminating model is not full-topology qualification.
- Runtime regression mutants killed: delayed invalidation, bypassed admission, and separate
  DAG checks instead of their union; `/private/tmp/qa2-root-{q1,admission,union}-mutant.log`.
- Independent blind review found the mixed-topology admission gap; repaired and independently
  reproduced refusal before any factory. Final 51 checkpoint tests pass independently:
  `/private/tmp/d808-qa2-root-checkpoint-final.log`.
- Independent edge review confirms malformed terminals/topology refuse before factories,
  and ordinary/nested factory failures retain node attribution. Runtime verification-gap
  review additionally required Python's eight canonical reasons to be exercised in CI.

### Concern-based build handoff

Orientation → Walkthrough → Detail Pass → Testing. The review focus is observable wave
ordering and complete admission before side effects; no new protocol semantics are activated.

1. **Wave ordering.** [Shared delivery path](/Users/davidchenallio/src/graphrefly/reference/kernel/kernel.mjs:565)
   forwards INVALIDATE immediately and defers only output. [Four-case regression](/Users/davidchenallio/src/graphrefly/reference/kernel/kernel.test.mjs:2068)
   proves the sibling branch never observes DATA(3).
2. **Recovery ownership and topology.** [Whole-input admission](/Users/davidchenallio/src/graphrefly/reference/modules/checkpoint.mjs:159)
   checks required records and the union DAG before construction, then detaches JSON.
   [Mutation table](/Users/davidchenallio/src/graphrefly/reference/modules/checkpoint.test.mjs:861)
   checks zero factory effects. Initial repeated inputs remain legal; explicit rewires must be distinct.
3. **Observe.** Run `node reference/kernel/probe-rereview.mjs`: quietError has four empty
   value arrays; retained cases emit INVALIDATE then ERROR, empty cases RESOLVED then ERROR.
   An invalid checkpoint refuses before factory invocation; explicit cold null remains valid.

Runtime final gates and actual branch CI results are still being collected. Rust checkpoint
policies and TS topology API removals are intentional owner changes documented in their repos.
No root push, runtime CI success, D687 qualification, PR, merge or release is claimed here.
