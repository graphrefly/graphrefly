# Handoff to the runtime owners: the operator contracts, their traces, and four rule points (D813, D816, D829, D830)

Written by Claude on 2026-11-25 for [graphrefly:B147](../../plan/backlog.jsonl), graphrefly:B150 and
graphrefly:B151, at the user's request. This is a brief, not a rule, a decision or a work item. Each
runtime owner (graphrefly-ts, graphrefly-rs, graphrefly-py) admits its own slice in its own
`plan/work.jsonl`, when the user decides, and writes its own work body there. Nothing here dispatches
implementation.

Read it after [HANDOFF-B140-runtime-owners.md](HANDOFF-B140-runtime-owners.md),
[HANDOFF-D812-runtime-owners.md](HANDOFF-D812-runtime-owners.md) and
[HANDOFF-B148-runtime-owners.md](HANDOFF-B148-runtime-owners.md). None of them names the operator
contracts, O-zip@2 excepted. For graphrefly-ts and graphrefly-rs the re-port of the kernel from
`reference/kernel` (graphrefly:D817) comes first: the operators sit on it. What each runtime does
today at these points was not looked at.

## What is at the root now

**Thirty-nine operator contracts, all in force (graphrefly:D813).** Read them with
`npm run operators:current`; this table only names them.

| Family | Contracts |
|---|---|
| common | O-common@2, which holds for every operator of the set |
| state | derived |
| transform | map, filter, tap |
| accumulate | scan, reduce |
| compare | distinctUntilChanged, pairwise |
| select | take, skip, takeWhile, first, last |
| combine | merge, withLatestFrom, zip (@2), concat, race |
| notifier | sample, takeUntil, buffer, bufferCount |
| higher-order | switchMap, mergeMap, concatMap, exhaustMap |
| time | debounce, throttle, auditTime, delay, bufferTime, timeout |
| recover | catchError, retry, repeat |
| gate | valve, pause |
| async | latestAsync |

A contract gives the ordinary use first and then its exceptions by topic. Each is the user's
selection in DS-20, follows from a rule it cites, or is a decision the user made while it was written,
which its rationale records.

**708 canonical traces** in `operators/traces.jsonl`, each linked by a contract. `operators/README.md`
gives the format and, under "Running the traces in a package", what a runner needs and what a
package's report holds (graphrefly:B150).

**What stays as it is (graphrefly:D816).** An active contract's use, its exceptions, its links, and
the nodes, steps and expectation of every trace it links change only through a new revision of the
contract, introduced by a root decision. A linked trace is not edited: a new trace succeeds it, and
the old one keeps its row with `succeeded_by` and is no longer run. None is succeeded yet.
`npm run authority:check` holds this against main (graphrefly:B146). So a result recorded for
`OT-<n>` and `O-<name>@<revision>` at a root commit keeps its meaning.

**Three rule revisions (graphrefly:D830):** R-wave@4, R-restart@2 and R-pause@2, each its earlier
revision with one or two sentences added. Read them with `npm run rules:current`.

## What a package owns

Its API spelling, which operators it ships, its implementation, its own tests and its own results
against the traces (graphrefly:D813). The root keeps no runtime result and claims none.

## What a runtime owner now has to do

1. **Run the traces and report.** Write a runner from the README's section; the reference's,
   `reference/operators/run-trace.mjs`, is one such runner and no part of the format. The report has
   one result for each trace: pass, fail, or not run for one of three reasons, and it names the
   operators the package ships, the root commit and the package's revision. It is kept in the
   package. Time passes for the operators only by an `advance` step; how they come by their timers
   is the package's. No package has written a runner from
   that section yet, so that the section is enough alone is not shown: say what it lacks.
2. **Hold what a trace cannot show with the package's own tests.** What a contract says is refused
   when an operator is built is of that kind.
3. **A callback's result that must be a node and is not one ends the operator with ERROR
   (graphrefly:D829, O-common@2).** As when the callback throws: everything that run had sent is
   dropped. It holds for the project of switchMap, mergeMap, concatMap and exhaustMap and for the
   handler of catchError. The ERROR's payload is each runtime's. The reference changed here
   (`definitionOf` in `reference/operators/higher-order.mjs` and `recover.mjs`): a switchMap that
   selected no inner had sent nothing for null or undefined and gone on. OT-705 to OT-709 hold it,
   through the callback option `returnsOn`.
4. **Four points where the rules now say what the reference does (graphrefly:D830).** The reference
   did not change for them.
   - An empty array passed to `ctx.down` is no output: nothing is sent for it and it starts no wave.
   - A restart owner that makes no attempt, because a fresh inner would end at once, ends with its
     inner's terminal: at once, or, for a retry that waited, when its delay has passed. The ERROR is
     the inner's own and not the dependency's.
   - An INVALIDATE of the restart state is no request and retracts nothing; a request made after it
     is served.
   - When a wave both changes a pausable's locks and brings its input's terminal, the locks after
     the wave decide: with none held, it sends what it held and then the terminal.
5. **Link the package's operator documentation to the contracts.** graphrefly:D813 asks it for its
   completion, and it is each owner's to admit.

## What to check against

| Against | Covers |
|---|---|
| the 708 traces, by contract in `npm run operators:current` | every exception of every contract |
| OT-705 to OT-709 | a callback result that is not a node |
| C-60 | the four points of D830; OT-184, OT-589, OT-622 and OT-651 are candidate traces for it |

Every runtime result for these is `todo`. The reference is in `reference/kernel`,
`reference/modules` and `reference/operators` (`npm run test:reference`, 2538 tests). The models for
D830 are `kernel_wave`, `module_restart` and `module_pause`, with their runs in `formal/README.md`.

## What is not here

- R-demand, R-history and R-revision are still drafts. So are five older ones, R-replay-buffer@1 and
  @2, R-pull@1 and @2 and R-node-revision@1, which no transition has retired yet. None is in force.
- Some sentences of the contracts are known to be loose where no behavior is in question;
  graphrefly:B151's note lists them, and each waits for its contract's next revision.
- Which of two timers due at the same instant fires first is the package's.
