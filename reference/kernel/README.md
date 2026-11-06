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
| [replay.test.mjs](replay.test.mjs), [REPLAY.md](REPLAY.md) | The kernel-applicable clauses of C-28 to C-39, and where every other clause belongs |

## Surface

The graph: `createGraph({ report })` takes an optional host reporter. Then `state(id, initial)`, `node(id, deps, fn, { terminal, quiet })`,
`subscribe(sinkId, id, callback?)`, `unsubscribe`, `set`, `invalidate`, `complete`, `error`, `batch`,
`get(id)` (`active`, `has`, `value`, `ended`) and `trace`.

A node function has the TS baseline's shape, `(ctx) => void` (R-fn-contract, D8):

| ctx member | Meaning |
|---|---|
| `deps[i].waves` | The value arrays dependency `i` delivered to this invocation, each its DATA payloads in order; a RESOLVED array is `[]`; no arrays is `[]` |
| `deps[i].terminal` | Its COMPLETE/ERROR this invocation, or `null` |
| `deps[i].has`, `deps[i].value` | The latest value received from it |
| `state.get()`/`state.set(v)` | Private state of this lifetime |
| `down(msgs)` | During the run: one array of this invocation's output; each call is its own array (R-wave-boundary). After the run returned: a new wave from this node (P9). After the lifetime closed: dropped. DIRTY is not accepted: only the kernel sends it (O11) |
| `signal` | Aborted when the lifetime closes |
| `onDeactivation(f)`, `onInvalidate(f)` | Cleanup for this run (R-cleanup-hooks) |

An array keeps the order its author wrote (DS-17 O13): a terminal must be last, DATA and RESOLVED
cannot share one, and an array is split at its last INVALIDATE, dropping what came before it:
`[1, INV, 2, 3]` is published as `[INV]` then `[2, 3]`.

### Differences from the TS baseline (`dafc5ae`)

Audited on 2026-11-06 against `packages/ts/src/node/node-context-runtime.ts` and its callers, after
two differences turned out to be unstated (a run's `ctx.down` calls were merged into one array, and
`deps[i].data` flattened the array boundaries; both now follow TS and R-wave-boundary@2). Two more
found in the audit were the interpreter's own and now follow TS on the user's decision: a late
registration while the lifetime is open is accepted, and `onInvalidate` hooks are not consumed.

| Here | TS | Source of the difference |
|---|---|---|
| `deps[i].waves` | `ctx.waveData[i]`, which also carries an INVALIDATE absence marker inside an array | O13: INVALIDATE never shares an array with a value, so no marker is needed |
| `deps[i].terminal` is the message or `null` | `ctx.terminal[i]` is `false`, `true` (COMPLETE) or the ERROR payload | Interpreter shape, same information |
| `deps[i].has`/`value` are public | The dependency cache sugar reads sits behind a symbol (`CTX_DEP_CACHE`) | Interpreter shape |
| Arrays keep written order | Every `_down` array is sorted by tier | O13 |
| A dependent runs once on all arrays a dependency sent in the wave; they reach each subscriber after the function returned, all arrays to one subscriber, then the next | Each `_down` call is delivered to all subscribers at once, while the function runs | Delivering after the run comes from P9; one delivery per subscriber keeps a dependent from settling between two arrays of the same dependency |
| `signal` | No signal on ctx | R-fn-contract@2 and R-ctx-lifetime (draft) |
| A registration after close runs once at once | Ignored | R-cleanup-hooks@2 (draft) |
| No `up`, `upNext`, `rewireNext`, `pull`, `environment`, `track`, `persist` | Present | Not covered yet (K9, modules) |

The kernel does not know or care whether a late `ctx.down` came from async work.

## Covered so far

- K1 the closed message set, in written order with the O13 split at INVALIDATE; K2 waves, DIRTY
  prepass, one leading DIRTY per value array, kernel RESOLVED, separate arrays per `ctx.down` call,
  batch as one accumulated array per node with every occurrence kept, DATA/RESOLVED exclusivity.
- K3 START snapshot with the retained value; idempotent subscription. A new node's activation run
  sees its dependencies' snapshots as that run's input.
- K4 invocation view and private state; a throw becomes ERROR (P10).
- K5 terminal policy as auto or manual per kind (DS-17 O6); ended output cannot be acquired (P5).
- K6: `invalidate` on a state, and an invalidated input, clear the retained value down the cone and
  run `onInvalidate` hooks after the value is gone. No DIRTY, no function run for the INVALIDATE. A
  repeat, or a node with no value, is a no-op; an announced node then settles with RESOLVED. What an
  input sent before its INVALIDATE in the wave is dropped; what it or another input sent after is
  ordinary input, and the function runs for it after the invalidation (and its hooks) took effect.
- K7 lifetimes: each activation opens one. Closing it (last release or terminal) aborts `signal`,
  releases dependencies in declaration order, then runs this lifetime's deactivation cleanups in
  registration order; a failing cleanup goes to the host reporter and the rest still run. Each run's
  registrations replace the previous run's without calling them. A registration after the run
  returned joins the current run's registrations, as in TS; one after close runs once at once
  (R-cleanup-hooks@2). `onInvalidate` hooks stay registered after they run, as in TS, so a later
  effective INVALIDATE without a rerun runs them again. Computed nodes clear on last release; plain state keeps its value.
- K8: a request that arrives while the kernel is busy waits and runs afterwards in arrival order: a
  late `ctx.down`, and `set`, `batch`, `subscribe`, `unsubscribe` reached through a captured graph
  reference. A function writing its own upstream is rejected, and the throw becomes its ERROR. A
  failing sink or queued request goes to the host reporter. Without a reporter the kernel keeps no
  failure history (R-operation-failure); a reporter that throws is ignored.
- O3 as decided on 2026-11-06: batch delivers no DIRTY before commit. Inside a batch body a node's
  late `ctx.down` is staged with host inputs; a submission that would mix DATA and RESOLVED for one
  node is rejected and earlier staging kept; staged output of a lifetime that closed is dropped. A body declared `async` is
  refused before any of it runs; a plain body that returns a promise commits its synchronous part,
  and a report says that writes after its first await are separate waves.
- P9: the invocation that started async work settles its wave at once, so no DIRTY stays open while
  the work runs. Results arrive in arrival order and combine with whatever the other inputs hold then.
- H6: `{ quiet: true }` records its own dirty inputs but does not pass DIRTY on, so its dependents do
  not wait for it. Everything it outputs, including an invalidation or an inherited ERROR, is a later
  wave from it; the arrays of one settlement go out together in that wave. Silence needs no RESOLVED.

Mutations checked on 2026-11-06 for O13 and array boundaries, each failing at least one test: no
split at INVALIDATE; tier sort restored; a run's `ctx.down` calls merged; `waves` flattened; a
dependency's arrays delivered to a dependent one by one; the invalidation applied after the run;
a terminal allowed anywhere; a dependent keeping what came before an INVALIDATE; resumeAll merging
its held arrays. After aligning hooks with TS: invalidate hooks consumed after running; a late
registration rejected; a late registration ignored.

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
| `ctx.deps[i]` as one record instead of TS's `waveData`/`terminal`/dependency cache | Same information, including the per-array boundaries since 2026-11-06; the shape is the interpreter's, not a proposal |
| An invalidated input and DATA from another input in one wave: the node invalidates, then its function runs | Changed 2026-11-06 with O13; it was "the function does not run". This matches TS, which invalidates and then runs |
| An invalid output array (DATA with RESOLVED, a terminal not last) throws from `ctx.down`; uncaught, the throw is the producer's ERROR | DS-17 does not settle the routing. Before 2026-11-06 a DATA+RESOLVED array was turned into ERROR without throwing |
| The host reporter as an optional `report` callback | The draft's host reporter (R-operation-failure). It was a growing array until 2026-11-06, which kept the failure history the rule says the kernel must not keep by default |
| Ignoring a reporter that throws | Its failure has nowhere else to go, and throwing would break the wave it reports on |
| Sink ids and `trace` | Test instrumentation, not kernel behavior |

## Not covered yet

Each of these is left out rather than approximated:

- K9 control routing and declared control pairs; K10 node interface and status; START snapshots of an
  unsettled node.
- Upward INVALIDATE (R-up-at-source); INVALIDATE before a node's first invocation (R-first-run-gate).
- Modules: replay, checkpoint, rewire, restart owners. Pause and demand are in
  [../modules/](../modules/README.md).

## Observations so far

- First replay of C-28 to C-39 (REPLAY.md): no kernel clause failed; two batch bugs were found and
  fixed. The two disagreements with the draft became DS-17 O11 (DIRTY is sent by the kernel only,
  which retires C-29) and O12 (batch from a callback stays allowed, no extra rule).

- No DIRTY spans time. Batch announces only at commit (O3), node output cannot contain DIRTY (O11),
  and async work cannot hold a wave open:
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
