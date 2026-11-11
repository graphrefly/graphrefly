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
| R-wave | 2 | waves, PENDING, settlement, written order |
| R-subscription | 3 | START (the kernel's alone) and the last-array snapshot, the seed |
| R-invocation | 2 | the function and its ctx |
| R-terminals | 1 | COMPLETE and ERROR, their auto and manual policies |
| R-invalidation | 1 | INVALIDATE and its auto and manual policy |
| R-lifetime | 2 | activation, lifetime, setup and cleanup |
| R-request-order | 2 | requests, batch, set, replace, ctx.rewire |
| R-node | 2 | node, instance and lifetime scopes; definition |
| R-failure | 3 | throws and invalid output |
| R-graph-domain | 3 | one graph, one domain: graphs share no wave, queue or batch (D803) |
| R-no-imperative | 2 | control is data on a declared edge |
| R-node-thin | 2 | (no behavioral scenario: not observable) |
| R-sentinel | 1 | unchanged |
| R-checkpoint | 1 | module: capture and restore (D802; see "Checkpoint after D802") |
| R-graph-surface | 1 | the graph layer: find, describe, observe, retain (D805; see "Review corrections after D806") |
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
