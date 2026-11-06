# Kernel reference interpreter

Non-normative slices for [graphrefly:B143](../../plan/backlog.jsonl). It writes the kernel
from [DS-17](../../sessions/active/SESSION-kernel-module-classification.md) as a small deterministic
program, so the classification can be checked by running it instead of by reading prose. It does not
define current protocol behavior; [spec/rules.jsonl](../../spec/rules.jsonl) does.

```bash
npm run test:reference
```

## Files

| File | Contents |
|---|---|
| [kernel.mjs](kernel.mjs) | The kernel. Pure node functions take an invocation view and return `{ down, state }`; every delivery to a sink is appended to `graph.trace` |
| [sugar.mjs](sugar.mjs) | `derived`, `map`, `filter`, `reduce` as ordinary node functions. First-run gating lives here, not in the kernel |
| [kernel.test.mjs](kernel.test.mjs) | One trace test per implemented behavior |

The graph exposes `state`, `node`, `subscribe(sinkId, id, callback?)`, `unsubscribe`, `set`, `complete`,
`error`, `batch`, `get` (retained value plus `pending`), `inspect`, `trace` and `reports` (failures with no
caller, P10).

## Covered in this slice

- K1 tier normalization; K2 waves, DIRTY prepass, leading DIRTY, kernel RESOLVED, batch as one wave
  with every occurrence kept, DATA/RESOLVED exclusivity.
- K3 START snapshot with the retained value; idempotent subscription.
- K4 invocation view (`data` occurrences this wave, `resolved`, `terminal`, latest received `value`),
  private state; a throw becomes ERROR (P10).
- K5 terminal policy as auto or manual per kind (DS-17 O6); ended output cannot be acquired (P5).
- K7 activation and release; computed nodes clear on last release, plain state keeps its value.
- K8 (second slice, 2026-11-06): a request that arrives while the kernel is busy waits and runs
  afterwards in arrival order. This covers a node function or sink callback that reaches the graph
  through a captured reference: `set`, `batch` (one later wave), `subscribe`, `unsubscribe`. A
  function writing its own upstream is rejected, and the throw becomes its ERROR. A failing sink or a
  failing queued request goes to `reports`.
- DS-17 O3 as decided on 2026-11-06: batch delivers no DIRTY before commit. A read during the body
  or during a wave returns the retained value with `pending: true`. A body declared `async` is refused
  before any of it runs. A plain body that returns a promise commits its synchronous part, and a
  report says that writes after its first await are separate waves.

Mutations checked on 2026-11-06: removing the batch-wide DIRTY prepass fails four tests; removing the
kernel RESOLVED fails two; running requests immediately instead of queueing fails three; never
reporting pending during a wave or during a batch fails one each. The unsubscribe-during-a-wave test
still passes without the queue, because delivery already uses the subscriber list as it was when
publication began (K3).

## Not covered yet

Each of these is left out rather than approximated:

- K6 INVALIDATE; K9 control routing and declared control pairs; cleanup hooks and
  lifetime-bound ctx revocation (K7); START snapshots of an unsettled node.
- P9 async: work that finishes later as a new wave.
- Modules: pause, demand, replay, checkpoint, rewire, restart owners.
- Replaying C-28 to C-39.

## Observations so far

- Batch publishes nothing before commit, so a throwing body has nothing to undo. Rollback cost in the
  draft rules came from batch announcing DIRTY before commit, which R-two-phase@2 permits; the user
  dropped that on 2026-11-06 (DS-17 O3).
- Writing another node from inside a wave would, if run at once, add DIRTY to a cone after parts of
  it settled: a fan-in could run twice in one wave, and whether it saw the write would depend on
  execution order. Queueing gives the same two waves in either order (see the K8/P7 test).
- A sink that writes its own source on every wave never drains. The kernel does not guard this (P8);
  a module or the host must.
- Async batch bodies (user discussion 2026-11-06): committing only the part before the first await
  splits writes the user meant to apply together, and observers see the half state; holding the batch
  open until the promise settles would freeze or interleave every other input for network time, and
  JS cannot tell which batch a later write belongs to. Refusing an `async` function before it runs is
  the only option that applies nothing by surprise. The first slice of this choice discarded the
  staged part but could not stop writes after the await, which then applied alone; the test now waits
  past the await. Recognizing `async` relies on native async functions; code compiled to generators
  falls into the promise-returning case.
- Delivery order across sinks follows settlement order, not subscription order: in a batch, a node
  that depends only on the first input settles before one that waits for a second input.
- Routing a DATA+RESOLVED output array to the producing node's ERROR is this interpreter's choice;
  DS-17 does not settle it yet.
