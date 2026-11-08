# The photo-scenes operation tree on the reference kernel

Non-normative. A second comparison example after the [flagship](../flagship/README.md), added
2026-11-08. The plain arm is real code: photo-scenes' `packages/operations`, written and reviewed
(a plan review and three rounds of code QA by Codex) independently of GraphReFly. The graph arm
has the same API, built on the DS-17 [reference kernel](../kernel/README.md). Both run
photo-scenes' own spec, `operations.spec.ts` (27 tests), unchanged.

The question is not lines or milliseconds. Most of the plain arm's QA bugs came from its
hand-written scheduling: `frames`, `defer`, `deferInChange`, `flush`, `drain`. Can the kernel's
waves and K8 queueing provide that scheduling instead? Wherever they cannot, that is a DS-17
finding.

The photo-scenes repository is not changed. Nothing here touches `spec/`.

```bash
npm run test:reference   # includes spec.test.mjs and mutants.test.mjs (about 45 s)
```

## Files

| File | Role |
|---|---|
| [vendor/operations/index.ts](vendor/operations/index.ts) | The plain arm: photo-scenes `packages/operations/src/index.ts` at commit `a331d71` (unchanged since `2cb9b89`) |
| [vendor/operations.spec.ts](vendor/operations.spec.ts) | The acceptance: photo-scenes `apps/web/src/testing/operations.spec.ts` at the same commit |
| [vendor/history/](vendor/history/) | The package before each QA round was fixed: `132889d` (first version), `007843d`, `420d546` |
| [graph-operations.mjs](graph-operations.mjs) | The graph arm |
| [run-spec.mjs](run-spec.mjs) | Runs the spec against one arm in a fresh directory, applying source edits there; checks every vendored file's sha256 first |
| [hooks.mjs](hooks.mjs), [playwright-shim.mjs](playwright-shim.mjs) | Let the spec run as it is: `@photo-scenes/operations` resolves to the arm under test, and `@playwright/test` to node:test plus the seven matchers the spec uses |
| [spec.test.mjs](spec.test.mjs) | Both arms pass all 27 tests; the graph arm's topology from `describe()` |
| [mutants.test.mjs](mutants.test.mjs) | Mutants of both arms, and the history versions |

Vendored bytes are copied with `git show <commit>:<path>` and never edited. Their digests are in
`VENDOR` in `run-spec.mjs`, and a mismatch fails the run. Node 24 runs the TypeScript with
`--experimental-transform-types`. The spec's `@ts-expect-error` lines are compile-time only and
need `tsc`, which this repository does not have, so they are not checked here. The runtime half of
that test (a task root and a task with children are refused) still runs.

## The graph

```text
commands ─► runs ─► runs:app ─► runs:app/session ─► runs:app/session/place     (top-down)
runs:<holder> + flags:<children> ─► flags:<slot>                                (bottom-up)
runs, runs:app, … ─► effects ─► host
```

| Node | What it holds or decides |
|---|---|
| `commands` | A state node. Each start, cancel, op.cancel, "body returned" and "run settled" is one write, so one wave |
| `runs:<container>` | For its child slots: revision; runs (alive, or dead and holding locks until they settle); waiting starts. It applies preempt, drop and queue with sibling locks, and admits the queue again on every change. It reads its own run from its holder over the declared edge. A new generation, or none, kills its children's runs and refuses their waiting starts in the same wave. A start deeper down makes the child container on the way run. `runs` (no path) holds the root |
| `flags:<slot>` | `isRunning` from the holder's runs; `isBusy` from that and the children's flags |
| `effects` | This wave's effects: aborts (deeper containers first), refused starts, body entries |
| host | Bodies, AbortControllers, the promises handed to `wait`, start promises, observers, and the order in which they run |

A tree with C containers and S slots has 3 + C + S nodes. The tree in the spec's "photo-scene
races" test has 3 containers and 8 slots, so 14 nodes.

A run is data, not a kernel lifetime. A run's id is `<path>#<revision>`. Its cancellation is
an `alive: false` in its holder's runs node, and the host aborts its AbortController. K7's
`ctx.signal` belongs to a node's activation, and nodes here activate once.

**Why the host runs callbacks after the wave.** K8 queues a request made during a wave, so a
`cancel()` made in a sink would return before it took effect. The spec requires the opposite: a
cancel made inside a callback has aborted its signal by the time it returns (QA Q8). So the
effects sink only collects, and the host runs bodies, listeners and observers once the wave is
over. When a callback makes a change, that change's aborts run before it returns. Its other
callbacks join the one queue, so a chain of bodies runs one after another (QA Q9). This is
plain's two kinds of frame, but kept in the host: about 25 lines (`drain` and `change`) against
plain's 45 for `batch`/`defer`/`deferInChange`/`flush`.

## Results

- Both arms pass all 27 tests.
- **The history.** Each earlier photo-scenes version fails exactly the QA tests written after it:
  - `132889d`: 11 tests (Q1 ×2, Q2, Q3, Q4, Q5's runtime check, Q7 ×2, recheck-2 Q8, Q9, Q10);
  - `007843d`: 5 tests;
  - `420d546`: 2 tests.

  So the spec catches the real bugs, not just mutants written here.
- **Mutants.** Each one loads and runs all 27 tests, and is killed when at least one fails. A
  test that hangs under a mutant fails by timeout, which counts: the spec awaits the outcome.

| Mutant | Plain | Graph |
|---|---|---|
| sync ignores liveness | killed (5 tests) | killed (same 5) |
| handles from a dead run act on the current run | killed (1) | killed (same) |
| cancellation skips children | killed (6) | killed (same 6) |
| queue behaves like preempt | killed (10) | killed (same 10) |
| a run settles without waiting for its waited promises | killed (1) | killed (same) |
| wait does not reject on abort | killed (1) | killed (same) |
| locks compared across containers (Q6) | killed (1) | no such code: a container's node sees only its children |
| drop ignores cancelled runs still holding the lock (Q4) | killed (1) | killed (same) |
| a body is entered although its run died (Q1) | killed (2) | killed (same 2) |
| Q1: a callback runs while the cancelled subtree is half dead | killed (1) | killed (same): aborts run inside the sink, mid-wave |
| Q2: admission enters a body while draining the queue | killed (4) | no such code: the admission node has no body to call |
| Q3: no admission after a cancel | killed (10, 7 by timeout) | killed (Q3's test only, by timeout) |
| Q5: a task root is accepted | killed (1) | killed (same) |
| Q7: an observer's error escapes | **survives**: plain also catches in `flush`; kept as a redundant defense | killed (4) |
| Q8: a nested change's aborts wait | killed (2) | killed (same 2) |
| Q9: a nested change runs its callbacks at once | killed (2) | killed (3) |
| Q10: no handler and no `reportError`, the error is lost | killed (1) | killed (same) |

## Bug by bug

| Codex's finding | Plain | Graph |
|---|---|---|
| Q1: a start from an abort listener joined a dying container; a body ran after an observer cancelled it | The whole subtree is invalidated before any callback, and a body is entered only if its run is still alive | A change is one wave. The cascade travels over the declared holder edges, `effects` settles after every runs node, and the host acts after the wave. The body's liveness check is host code in both arms |
| Q2: draining admitted a waiter that a body had just cancelled | `drain` calls no outside code; bodies begin as deferred effects | Excluded by structure: admission is a node function, and bodies belong to the host |
| Q3: cancelling a queued blocker left the start behind it waiting | Drain after every change | The container's node admits on every invocation. Code in both arms |
| Q4: drop admitted a start while a cancelled run held the lock | Unsettled runs are kept | The same, as data |
| Q5: a task root type-checked and failed at start | A check when the tree is defined | The same check |
| Q6: no test showed locks are sibling-only | A parent comparison in `conflicts` | Excluded by structure: siblings share one node, and nothing else is visible to it |
| Q7: a throwing observer cost a start its outcome | Caught in `observe` and in `flush` | Caught once, in the host's `drain` |
| Q8: a nested cancel delivered its abort late | Each change gets its own frame for aborts | The host's nested-abort path; K8 is why it cannot be a sink |
| Q9: a chain of bodies overflowed the stack | Other effects join the outermost frame | Bodies join the host queue; each change is its own wave, so the kernel adds no recursion |
| Q10: no test covered the host fallback | `report` | The same `report` |

Three of the ten bug classes cannot be written in the graph arm at all, or are given by the
kernel's wave rules: Q1's half-dead subtree, Q2 and Q6. The other seven need code in both arms.
The eight listed mutations that both arms can express are killed by the same tests in both. In the
QA group the arms differ three times: Q3 (fewer tests fail in the graph arm), Q7 (plain survives)
and Q9 (one more test fails in the graph arm).

## Findings for DS-17

1. **No kernel change and no module.** The arm uses state, node, `ctx.state`,
   `ctx.deps[i].waves`/`value`, subscription and `describe()`. It does not use H6 quiet nodes,
   batch, lifetimes and their signal or cleanups, INVALIDATE, terminals, or the pause and demand
   modules.
2. **A run's lifetime is data, not a node lifetime (K7).** Cancelling or restarting a slot is a new
   revision in its holder's node, and the host aborts the AbortController. This bears on O7: a
   slot's restart is not a node restart.
3. **K8 decides where callbacks may run.** Because requests made during a wave are queued, outside
   code that must change the graph synchronously cannot run in a sink. The host runs it after
   the wave and keeps a small two-path queue (nested aborts now, everything else in order).
4. **Structure excludes three bug classes,** listed above.

## Differences from the plain arm

None that the spec observes. Not observed, and so not checked:

- **Abort order across containers.** Both abort children before their containers. Among task
  runs that die in one wave in different containers, plain follows creation order; the graph
  arm goes from deeper containers to shallower ones. Within one container, plain uses creation
  order and the graph arm uses definition order, then creation order per slot. Matching plain
  exactly needed a per-container sequence number and a tree walk. No spec test told them apart,
  so both were removed under the minimality rule.
- **Containers have no AbortController.** Nothing can observe one: an `Operation` exists only
  for tasks.
- **`graphOf(root)` is an extra export,** used only to read `describe()`.

## Cost

| | Plain | Graph |
|---|---|---|
| Code lines (non-comment) | 480, of which 85 are TypeScript types | 317, with no types: tree 30, container node 103, wiring 38, host 146 |
| Scheduling | `batch`, frames, `defer`, `deferInChange`, `flush`, `drain` | one wave per change, and a host queue of about 25 lines |

There is no timing row: the two arms differ in toolchain (TypeScript transform against plain
JavaScript), and runtime is not the question here.

## New things

Each was reviewed against the minimality rule and kept:

- `hooks.mjs` and `playwright-shim.mjs`: tooling only, needed to run the spec unchanged.
- The vendored copies, as the user chose (2026-11-08).
- The graph arm's `commands`/`runs`/`flags`/`effects` layering: application design, not kernel and
  not a module.
- `graphOf`, so that `describe()` can be read.

## Not claimed

The graph arm was written after the bugs were known, so this does not show that a graph-first
author would have avoided them. It shows two things for each bug class: whether either arm needs
code for it, and whether its mutant is killed. The graph arm is a host-plus-graph design chosen
here. It is not the only possible one, and it is not a GraphReFly API proposal.
