# Kernel reference interpreter

Non-normative slices for [graphrefly:B143](../../plan/backlog.jsonl). It writes the kernel
from [DS-17](../../sessions/active/SESSION-kernel-module-classification.md) as a small deterministic
program, so the classification can be checked by running it instead of by reading prose. It does not
define current protocol behavior; [spec/rules.jsonl](../../spec/rules.jsonl) does. It is not package
code either: the TS, Rust and Python runtimes stay the implementations, and accepted traces from here
are meant to become conformance scenarios for them.

```bash
npm run test:reference
```

## Files

| File | Contents |
|---|---|
| [kernel.mjs](kernel.mjs) | The kernel. Every delivery to a sink is appended to `graph.trace` |
| [sugar.mjs](sugar.mjs) | `derived`, `map`, `filter`, `reduce`, `latestAsync` as ordinary node functions. They show that a policy can live outside the kernel; they are not a chosen operator set |
| [kernel.test.mjs](kernel.test.mjs) | One trace test per implemented behavior |

## Surface

The graph: `state(id, initial)`, `node(id, deps, fn, { terminal, quiet })`,
`subscribe(sinkId, id, callback?)`, `unsubscribe`, `set`, `invalidate`, `complete`, `error`, `batch`,
`get(id)` (`active`, `has`, `value`, `ended`), `trace`, and `reports` (failures with no caller, P10).

A node function has the TS baseline's shape, `(ctx) => void` (R-fn-contract, D8):

| ctx member | Meaning | TS baseline |
|---|---|---|
| `deps[i]` | This wave's `data` occurrences, `resolved`, `terminal`, and the latest received `has`/`value` | `waveData`, `terminal`, and the dependency cache sugar reads |
| `state.get()`/`state.set(v)` | Private state of this lifetime | `ctx.state`, without `persist` |
| `down(msgs)` | During the run: this invocation's output. After the run returned: a new wave from this node (P9). After the lifetime closed: dropped | `ctx.down` |
| `signal` | Aborted when the lifetime closes | lifecycle signal (R-ctx-lifetime) |
| `onDeactivation(f)`, `onInvalidate(f)` | Cleanup for this run | same (R-cleanup-hooks) |

The kernel does not know or care whether a late `ctx.down` came from async work.

## Covered so far

- K1 tier normalization; K2 waves, DIRTY prepass, leading DIRTY, kernel RESOLVED, batch as one wave
  with every occurrence kept, DATA/RESOLVED exclusivity.
- K3 START snapshot with the retained value; idempotent subscription. A new node's activation run
  sees its dependencies' snapshots as that run's input.
- K4 invocation view and private state; a throw becomes ERROR (P10).
- K5 terminal policy as auto or manual per kind (DS-17 O6); ended output cannot be acquired (P5).
- K6: `invalidate` on a state, and an invalidated input, clear the retained value down the cone and
  run `onInvalidate` hooks after the value is gone. No DIRTY, no function run. A repeat, or a node
  with no value, is a no-op; an announced node then settles with RESOLVED.
- K7 lifetimes: each activation opens one. Closing it (last release or terminal) aborts `signal`,
  releases dependencies in declaration order, then runs this lifetime's deactivation cleanups in
  registration order; a failing cleanup goes to `reports` and the rest still run. Each run's
  registrations replace the previous run's without calling them. A cleanup registered after close
  runs once at once. Computed nodes clear on last release; plain state keeps its value.
- K8: a request that arrives while the kernel is busy waits and runs afterwards in arrival order: a
  late `ctx.down`, and `set`, `batch`, `subscribe`, `unsubscribe` reached through a captured graph
  reference. A function writing its own upstream is rejected, and the throw becomes its ERROR. A
  failing sink or queued request goes to `reports`.
- O3 as decided on 2026-11-06: batch delivers no DIRTY before commit. A body declared `async` is
  refused before any of it runs; a plain body that returns a promise commits its synchronous part,
  and a report says that writes after its first await are separate waves.
- P9: the invocation that started async work settles its wave at once, so no DIRTY stays open while
  the work runs. Results arrive in arrival order and combine with whatever the other inputs hold then.
- H6: `{ quiet: true }` records its own dirty inputs but does not pass DIRTY on, so its dependents do
  not wait for it. Everything it outputs, including an invalidation or an inherited ERROR, is a later
  wave from it. Silence needs no RESOLVED.

Mutations checked on 2026-11-06 after the simplification pass, each failing at least one test: no
batch-wide DIRTY prepass; no kernel RESOLVED; requests run immediately; a quiet node forwarding DIRTY,
or publishing its output, invalidation or ERROR in the current wave; INVALIDATE always effective; an
invalidated input running the function; closed-lifetime output not dropped; cleanups accumulating
across runs; own cleanups before dependency release; an async batch body accepted; `ctx.down` after
return lost; `ctx.down` during the run treated as a later wave. The unsubscribe-during-a-wave test
passes even without the queue, because delivery already uses the subscriber list as it was when
publication began (K3).

## Simplification pass (2026-11-06)

The user asked that anything not discussed before and absent from earlier implementations be
questioned and, if kept, listed. Removed in this pass:

- `ctx.later()`, the return value `{ down, state }` and the `activation` flag: one output path,
  `ctx.down`, as in the TS baseline.
- The `pending` flag on reads, with the state behind it (a wave flag, a per-wave set of settled nodes,
  a staged-cone search). Whether a node is about to change is node status, K10, to be done against the
  TS `Status` set.
- Two per-dependency records merged into one; the per-wave list of touched nodes, the lifetime
  counter and `inspect` with its `invocations` and `dropped` counters. Tests count invocations
  themselves.

Kept although not discussed before, with the reason:

| Kept | Why |
|---|---|
| `ctx.deps[i]` as one record instead of TS's `waveData`/`terminal`/dependency cache | Same information; the shape is the interpreter's, not a proposal |
| Refusing `onDeactivation`/`onInvalidate` after the run returned while the lifetime is still open | The draft only says what happens after close; without a rule, a late registration in a live lifetime would attach to a run that may already be replaced |
| An invalidated input wins over DATA from another input in the same wave; the function does not run | Needed to decide something; the draft does not say |
| A DATA+RESOLVED output array becomes the producer's ERROR | Same; DS-17 does not settle the routing |
| `reports` | The draft's host reporter (R-operation-failure) |
| Sink ids and `trace` | Test instrumentation, not kernel behavior |

## Not covered yet

Each of these is left out rather than approximated:

- K9 control routing and declared control pairs; K10 node interface and status; START snapshots of an
  unsettled node.
- Upward INVALIDATE (R-up-at-source); INVALIDATE before a node's first invocation (R-first-run-gate).
- Modules: pause, demand (the PULL holder built on H6, with its START-only subscription), replay,
  checkpoint, rewire, restart owners.
- Replaying C-28 to C-39.

## Observations so far

- No DIRTY spans time. Batch announces only at commit (O3), and async work cannot hold a wave open:
  the starting wave settles now and the result is a fresh wave with its own DIRTY. R-async-paused@2
  says a raw deferred-result author "must eventually send DATA, RESOLVED or terminal"; under this
  model the author owes the protocol nothing.
- Writing another node from inside a wave would, if run at once, add DIRTY to a cone after parts of
  it settled: a fan-in could run twice in one wave, and whether it saw the write would depend on
  execution order. Queueing gives the same two waves in either order (see the K8/P7 test).
- INVALIDATE needs no DIRTY to stay glitch-free in a diamond, because the second arrival at the fan-in
  finds no value and is a no-op.
- `latestAsync` shows that switch-style cancellation needs no kernel help: private state holds the
  previous request's controller, and a cleanup hook covers close.
- A sink that writes its own source on every wave never drains. The kernel does not guard this (P8);
  a module or the host must.
- Async batch bodies (user discussion 2026-11-06): committing only the part before the first await
  splits writes the user meant to apply together; holding the batch open until the promise settles
  would freeze or interleave every other input for network time. Refusing an `async` function before
  it runs is the only option that applies nothing by surprise. Recognizing `async` relies on native
  async functions; code compiled to generators falls into the promise-returning case.
- Delivery order across sinks follows settlement order, not subscription order: in a batch, a node
  that depends only on the first input settles before one that waits for a second input.
