# Operator contracts

The root's one set of operator contracts and their canonical traces (graphrefly:D813). They are not
protocol rules: operators are sugar over the kernel, and nothing here enters the public protocol
projection. A contract may cite a kernel or module rule; no rule cites a contract. A language package
owns its API spelling, which operators it ships, its own guarantees and tests, and its results against
the traces.

```bash
npm run operators:current -- --drafts            # every contract, by family
npm run operators:current -- time --drafts --traces
npm run operators:current -- --review            # missing traces, open questions
```

In force since 2026-11-20: the `common` reading and the families `notifier` (sample, takeUntil, buffer,
bufferCount), `transform` (map, filter, tap), `accumulate` (scan, reduce), `compare`
(distinctUntilChanged, pairwise), `select` (take, skip, takeWhile, first, last), `combine` (merge,
withLatestFrom, zip, concat, race) and `state` (derived); since 2026-11-23 the family `gate` (valve,
pause); since 2026-11-24 the families `higher-order` (switchMap, mergeMap, concatMap, exhaustMap), `time`
(debounce, throttle, auditTime, delay, bufferTime, timeout), `recover` (catchError, retry, repeat) and `async` (latestAsync). Every other contract is a draft until its
family is activated. A draft is the maintainer's selection in
[DS-20](../sessions/active/SESSION-operator-walkthrough.md), as revised by Q1 to Q3 of its
[independent review](../sessions/active/PROPOSAL-DS20-operator-review-reconciliation.md), written in
contract form. It is not in force. No runtime result is claimed against any contract, active or
draft: an active contract's traces pass on the reference kernel, which is not a runtime.

## Files

| File | Holds |
|---|---|
| [contracts.jsonl](contracts.jsonl) | One row per contract revision |
| [traces.jsonl](traces.jsonl) | The canonical traces; each exists once, here |
| [../authority/operators.mjs](../authority/operators.mjs) | The derived view and the link checks, run by `npm run authority:check` |
| [../reference/operators/traces.test.mjs](../reference/operators/traces.test.mjs) | Runs the traces on the reference kernel, for the operators the reference has; the clock of an `advance` step is [clock.mjs](../reference/operators/clock.mjs) |
| [../reference/operators/](../reference/operators/) | Operators written from their contracts over the reference kernel, each with its recipe, so that their traces are run and not only read: [notifier.mjs](../reference/operators/notifier.mjs), [transform.mjs](../reference/operators/transform.mjs), [accumulate.mjs](../reference/operators/accumulate.mjs), [compare.mjs](../reference/operators/compare.mjs), [select.mjs](../reference/operators/select.mjs), [combine.mjs](../reference/operators/combine.mjs), [state.mjs](../reference/operators/state.mjs), [gate.mjs](../reference/operators/gate.mjs), [higher-order.mjs](../reference/operators/higher-order.mjs), [time.mjs](../reference/operators/time.mjs), [recover.mjs](../reference/operators/recover.mjs) and [async.mjs](../reference/operators/async.mjs). Each has a `*.mutants.test.mjs` beside it: edits of the module, each naming the contract sentence it breaks, and each of which a trace must notice. [classes.mutants.test.mjs](../reference/operators/classes.mutants.test.mjs) asks the same by class, for the situations operators meet whatever they do: a restore after an input changed or ended, activation on an input that has completed, ended with ERROR or holds several values, and, for the operators with several inputs that have no rule of their own for it, two terminals in one wave or before activation. A class that passes shows the situation is traced for each operator, not that every sentence is held in it |

## A contract

```text
{ id: "O-<name>", revision, family, operator,
  use,                                   the ordinary use, first
  traces: [OT-#],                        traces of the ordinary use
  exceptions: [{ topic, statement, traces: [OT-#] }],
  cites: [R-<rule id>],
  open: [question],                      what the selection leaves undecided
  rationale?,
  introduced_by: [D#], activated_by?: [D#],
  transition?: { kind: "revise"|"replace"|"retire", by: D#, to?: { id, revision } } }
```

The topics are `same-wave`, `completion`, `invalidation` and `recovery`. A topic a contract does not
list has no exception: `O-common` says how the kernel rules are read for every operator, and the other
contracts state what differs from it. A contract may repeat a point of `O-common` that the walkthrough
makes of that operator by name, as tap's throw.

Lifecycle is derived, as a rule's is: a revision with `activated_by` and no `transition` is active;
one with neither is a draft. The first content needs no decision of its own (D813), so a family is
activated by adding `activated_by: ["D813"]` to its contracts at the maintainer's go-ahead, which the
owning work item records, and by listing them in `ACTIVE` in
[../authority/operators.test.mjs](../authority/operators.test.mjs). The gate holds an active contract
to what a draft may lack: it links a trace, every exception links its own, each of those traces is at
`messages` detail, nothing is `open`, every rule it cites is current, and the `common` family is
active with it. The reference run holds the rest: a trace of an active contract that is skipped
there, or listed as a known difference, fails `npm run test:reference`.

On main an active contract is held by graphrefly:D816. Immutable are its `use`; its exceptions, each
with its topic and statement; the links it and its exceptions have to traces, none of which is
removed or moved to another exception; and the `nodes`, `steps` and `expect` of every trace an active
contract links. Each changes only through a new revision that a root decision introduces, with the
`transition` from the earlier one. A linked trace is not edited: a new trace succeeds it, and it
stays in the ledger with a `succeeded_by` that names the new one and a `succeeded_under` that names
the decision, linked only by revisions that have a transition and no longer run. The decision names every active contract that links it: one whose
statements change gets its new revision, and one whose statements do not keeps its revision and has
its link moved to the successor in place. `npm run authority:check` holds this against what main
held where the checkout left it (`authority/immutable.mjs`), and reports when it compared nothing.
What releases a held row names a new decision, a locked row that the same change adds to the root's
ledger: the `transition` an active contract gains, and the `succeeded_under` of a trace an active
contract links, whose successor is a new trace. A transition an activated contract has, and a
succeeded trace, stay as they are (graphrefly:B152). So a decision and the rows it changes land
together.

A new trace, and a new link from an active contract or one of its exceptions to a new trace or to
one already in the ledger, are added in place, as a scenario is added for a rule, when the contract's
statements already give what the trace shows; a new trace's `basis` says when it was added and what
it holds that no trace held, and the owning work item's note records a link added to a trace already
there. A rationale, a trace's name
and basis, and a draft are corrected in place, as is any row that exists only on an unmerged branch;
the owning work item's note records each such correction of an active contract or a linked trace
with its date.

What the user decides while a family is written is part of D813's first content and is not numbered,
for as long as the contract that states it is not yet active on main: the contract states it, its
rationale records that the user decided it and when, and the owning work item's note records the
user's words. A sentence that no such decision, DS-20 or a cited rule gives is listed as `open` and
keeps its contract a draft. Once a contract is active on main, a decision that changes its statements
is a revision, also when it is made while another family is written. A contract may state for every
language what graphrefly:D797 (9) left to each language as sugar, as `O-derived` does, without
superseding it.

## A trace

```text
{ id: "OT-<n>", name, basis, detail: "messages"|"occurrences",
  nodes: [{ id, state: [value?] } | { id, op, deps, args? }],
  steps: [request], expect: [[[sink, node, messages]]],
  succeeded_by?: "OT-<n>", succeeded_under?: "D<n>" }
```

`nodes` are built in order on one graph. `state: []` is a state without a value, and `state: [v]` one
that holds v. `steps` are host
requests. A write, a terminal or a batch starts one wave, and a callback that writes a state, as
`into` does, starts further ones within the step; a subscription delivers a snapshot, and a restore
delivers nothing: `["subscribe", sink, node]`, `["unsubscribe", sink, node]`, `["set", state, value]`, `["invalidate", state]`,
`["complete", state]`, `["error", state, payload]`, `["batch", [requests]]`, `["restore"]`, which
captures the graph, restores it with no subscribers and continues on the restored one,
`["replace", node, deps]`, which gives an operator node of the trace a new instance of the same
operator and args over those dependencies (R-request-order), and
`["advance", ms]`. `["advance", ms]` moves a clock the test owns forward by ms, a positive integer. No other step takes
time. A timer fires when the clock reaches its due time, each firing a wave of its own (O-common),
and a timer started by a firing is due from that firing's time, so one advance over several periods
fires each. Which of two timers due at the same instant fires first is not part of an expectation:
the reference runs a trace both ways. A restore leaves the captured graph's timers behind: none of
them fires afterwards (R-checkpoint). A trace says nothing of timers still running after its last
step. `["resolve", node, input, value]` and `["reject", node, input, error]` settle a job the test owns: the oldest unsettled
job that the latestAsync `node` started for `input`. Its result reaches the graph within the step, as a
wave of its own. A job that was aborted can still be settled, as one that ignores cancellation is. A
restore leaves the captured graph's jobs behind: they can still be settled, and nothing arrives for
them. `expect[i]` is what the sinks received during `steps[i]`, compared receiver by receiver: what one
sink received from one node is in order, and which sink received first within the step is not part of
the expectation, since no contract gives it and R-wave says only that a node's arrays go to one
subscriber and then the next. A trace
subscribes at least one sink and expects something somewhere, so that it can fail. An expectation
writes `["ERROR"]`, without a payload, for an ERROR that a throw produced, and then matches any
payload. The traces were written while how a thrown value became a payload was each runtime's;
since graphrefly:D824 R-failure gives it, and an expectation may name the payload. A trace also says that nothing
arrives after its last step. The reference run checks that within one turn of the event loop, which
catches a promise or an immediate timer and not a timer of a few milliseconds.

A trace builds a well-formed graph, so it cannot show what is refused when an operator is built: an
input given twice, a missing seed, an n that is not a count, a concat source that does not exist. A
contract's sentences of that kind are outside the canonical traces, and a runtime's results against
the traces say nothing of them. Each package holds them with its own tests, as the reference does in
the `*.test.mjs` files beside its modules.

`detail` says what an expectation fixes. `messages` is every array a sink received, as it received it,
with the kernel's START, PENDING and RESOLVED. `occurrences` is, for each sink and node, the DATA,
INVALIDATE and terminals of the step in order, without array boundaries; a pair that received none of
them is left out. A trace written from the walkthrough alone starts at `occurrences`, so that it
states the selection and not a guess at framing; it is rewritten at `messages` before its contract
is activated.

Named callbacks: `double` (v * 2), `even`, `small` (v < 3), `sum` ((acc, v) => acc + v), `append`
((acc, v) => the list acc with v added, which tells the reducer's two arguments apart), `atMost`
((previous, current) => current <= previous, an equality that tells its two arguments apart), `always`
(an equality for which every two values are the same), `tuple` (the values it is given, as a list)
and `record`, which returns a value the operator must not read. A node names its callback under `f`,
`p` or `equal`. Beside it: `into` writes the last value each call is given (for a reducer or an
equality the incoming value, for a derived its last dependency's) to that state, so that a sink of
the state shows the calls; `invalidates` asks the graph to invalidate that state at each call, a
request that waits for the wave to end; `returns` replaces what the callback returns; `throwsOn`
makes it throw, before the call is recorded, and `nothingOn` makes it return no value, when it is
given that value. A higher-order `project` is `follow`, which returns the node its argument names; it takes `throwsOn`
and `into` as a callback does, and `capacity` is a mergeMap's. With `returnsOn`, [value, result], it returns that
result as it is, which is no node, when it is given that value, after the call is recorded. A catchError's `handler` is `follow` too: it returns the
node its `to` names, whatever the error; `into` writes the error it is called with to that state, and
`throwsOn` makes it throw when it is called with that error, after that call is recorded; `returnsOn`, [error, result],
makes it return that result as it is, which is no node, when it is called with that error. A retry or a repeat names its inner under
`of`, { op, args }, one operator of the set that is a single node, over the dependencies the retry or
repeat is given; the inner is the node `<id>/inner`, which a sink may subscribe. A retry takes the
policy's `maxAttempts`, `initialMs`, `factor` and `maxMs`, and a repeat its `rounds` and a policy under
`retry`. A latestAsync's `f` is `job`, which returns a promise the test settles: `into` writes each input
a job is started for to that state, `aborts` each input whose job's signal was aborted, and `throwsOn`
makes f throw in place of starting a job. As the inner of a retry or a repeat its jobs are those of
`<id>/inner`.
The runner knows which options each operator takes and refuses any other key of a node or of its
args.

Three node kinds only shape a trace's input and are not operators of the set. `arrays` sends each
element of its source's value as one array in one wave: a list is that list as DATA, `"INVALIDATE"`
and `"COMPLETE"` are those messages, and `{ "error": payload }` is an ERROR. It does so for the
value its source holds when it is activated as for each later one. `empty` completes on activation
without DATA, and `once` sends its `value` at each activation.

A link is checked against the trace, step by step and one node of the operator at a time. A sink must
subscribe a node of the contract's operator or a node after it. An exception's trace must hold a
step of its topic made while a sink of that same node is subscribed: an `invalidate`, for an invalidation exception, or a `complete` or `error`, for a
completion exception, of a state the operator depends on (for an operator with a projector, also a
node named by a value written to its input); and for a recovery exception a `restore` with such a
sink subscribed before it and again after it. The check reads a node's inputs from the trace as
written, so it does not see an INVALIDATE or a terminal that only an `arrays` helper sends, and it
still counts a source a concat has not reached or an input a race has released; what a `replace`
step makes a node depend on counts as its input from the start of the trace. A trace of the
first kind is linked from the ordinary use or from a same-wave exception.

`basis` names where the selection states the trace. A pass on the reference kernel is candidate
evidence that a trace agrees with the kernel rules; it is not a runtime result.

### Running the traces in a package

A package's runner can be written from this section (graphrefly:B150). The reference's,
`reference/operators/run-trace.mjs`, is one such runner and no part of the format. A node's `op` is
the contract's operator; the package maps it to its own spelling and shape (graphrefly:D813). A sink
is a name: one name may subscribe several nodes, and an expectation's entry names both.

What each node takes. `deps` are in this order, and `args` holds these and no other key:

| `op` | `deps` | `args` |
|---|---|---|
| map, tap | the source | `f` |
| filter, takeWhile | the source | `p` |
| first, last | the source | `p`, or no args |
| distinctUntilChanged | the source | `equal`, or no args |
| scan, reduce | the source | `f`, `seed` |
| pairwise | the source | none |
| take, skip, bufferCount | the source | `n` |
| sample, takeUntil, buffer | the source, the notifier | none |
| valve | the source, the control | none |
| pause | the source, the lock state | none |
| withLatestFrom | the source, then the others, one at least | none |
| merge, zip, concat, race | the inputs in declared order, one at least | none |
| derived | the inputs in declared order, one at least | `f` |
| switchMap, concatMap, exhaustMap | the outer | `project` |
| mergeMap | the outer | `project`, `capacity` or none |
| debounce, throttle, auditTime, delay, bufferTime, timeout | the source | `ms` |
| latestAsync | the source | `f` |
| catchError | the source | `handler`, `to` |
| retry | the inner's dependencies, one at least | `of`, and of `maxAttempts`, `initialMs`, `factor`, `maxMs` those given |
| repeat | the inner's dependencies, one at least | `of`, `rounds`, `retry` or none |
| arrays | the source | none |
| empty, once | none | once: `value` |

Beside `f`, `p`, `equal`, `project` and `handler` a node takes the options given above for that
callback. A callback made to throw throws an error of the runner's own.

What a runner gives the operators of a trace:

- A clock it owns. For the time operators, and for a retry's or a repeat's delay, no time passes
  but by an `advance` step: no timer fires otherwise, and none reads another time. How the operators
  come by their timers is the package's: timers they are given, or the host's own put under the
  runner's clock, as a test framework's fake timers do.
- Jobs it owns. A latestAsync's `f` starts a job that only a `resolve` or a `reject` step settles.
  The jobs are kept in the order they were started, each under its node.
- A registry for a `restore` step. The graph is captured, restored into a new one and run on from
  there, so every callback and helper of a trace can be built again from its name and its options.
  What a runner does with the captured graph is its own: nothing it sends afterwards is compared.

A runner refuses a trace it cannot take as written, and a refused trace is no pass: a key of a node
other than `id`, `state`, `op`, `deps` and `args`; an option its operator does not take; a number of
dependencies its operator does not take; a callback name it does not know; an `unsubscribe` of a
sink the trace did not subscribe; a batch that holds an `advance`, a `restore`, a `resolve` or a
`reject`; a `replace` of a node that is not an operator node of the trace; and a `resolve` or a
`reject` for a job that was not started or is already settled.

A trace passes when every step's expectation is met, receiver by receiver, a payload-less `ERROR`
matching any payload, and nothing arrives after the last step, as far as the package's language can
see. Which of two timers due at the same instant fires first is the package's. A trace that was
succeeded is not run.

A package's report holds one result for each trace of the ledger that was not succeeded: pass, fail,
or not run with one of three reasons. The reasons are that the package does not ship an operator of
the trace, that its language cannot carry a value of the trace, and that its runtime cannot take a
step of the trace. Anything else is a fail. No request of a trace is refused on the reference: a
package that refuses one to its caller has not taken that step, and the trace is a fail, not a
trace not run. Whether a package ships an operator is said once for
the operator and not for each trace: the report lists the contracts' operators the package ships.
A trace all of whose operators it ships is run, the other two reasons apart, and one that gives an
operator what the package's does not take is a fail. An operator of the package that has a
contract's name and is not listed is named in the report as not the contract's. A report names the
root commit whose traces were read and the package's own revision. It is the package's and is kept
there: the root keeps none and claims no runtime result. Its file and its place are the package's
to choose.

## A review round

A review round of the operator contracts is done when fewer than 5% of at least 80 valid mutants,
written without sight of the traces, pass every canonical trace. A round by a writer who reads the
traces collects traces; its rate is not a condition.

## Not in the set

DS-20 dropped onFirstData, find, elementAt, combine, generic audit, rescue (catchError replaces it) and
settle. history is a module rule (R-history), not an operator contract.

A contract speaks of an operator over inputs that stay the instances it was activated on, unless it
says otherwise. When the host replaces an input by a new instance of the same id (R-request-order),
the kernel keeps nothing of the old instance, its terminal included, and tells the function in its
next run (graphrefly:D819). zip is the one operator of the set that records an input's COMPLETE, and
O-zip says what it does then (graphrefly:D820). No other operator records an input's terminal; what
the others keep of a replaced input is not stated.
