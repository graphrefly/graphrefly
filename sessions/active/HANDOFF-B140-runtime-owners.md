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
| R-graph-domain | 2 | one graph, one domain; the bridge's grouped release |
| R-no-imperative | 2 | control is data on a declared edge |
| R-node-thin | 2 | (no behavioral scenario: not observable) |
| R-sentinel | 1 | unchanged |
| R-checkpoint | 1 | module: capture and restore (D802; see "Checkpoint after D802") |

R-checkpoint, a module rule, is active since graphrefly:D802 (2026-11-10). The other module rules
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
   the retired numbers, drops Tier and Direction and renames `WIRE_EDGE_KIND_DIRTY` to `PENDING`,
   so old and new bridge peers do not interoperate.
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

## What each runtime must show (acceptance)

Every kernel scenario starts `todo` in every runtime. An owner qualifies a scenario by running a
harness of its own against the scenario's text and reporting the runtime, the test command, the
result and the source commit. Under graphrefly:D784 a changed `runtimes` flag alone is not evidence;
until its evidence-receipt ledger exists, report the evidence with the work item and leave the
flag to the root integration step. Reference-kernel tests are candidate traces, not runtime evidence.

Kernel scenarios on the public rules: C-1, C-3, C-4, C-6, C-11, C-12, C-15, C-16, C-17, C-23, C-26,
C-28, C-29, C-33, C-34, C-35, C-36, C-37, C-40, C-41, C-42, C-44, and the wire scenario C-1b (its
frames now say PENDING). C-1a and C-1c are unaffected.

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
