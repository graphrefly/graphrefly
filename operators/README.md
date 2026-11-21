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
withLatestFrom, zip, concat, race) and `state` (derived). Every other contract is a draft until its
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
| [../reference/operators/traces.test.mjs](../reference/operators/traces.test.mjs) | Runs the traces on the reference kernel, for the operators the reference has |
| [../reference/operators/](../reference/operators/) | Operators written from their contracts over the reference kernel, each with its recipe, so that their traces are run and not only read: [notifier.mjs](../reference/operators/notifier.mjs), [transform.mjs](../reference/operators/transform.mjs), [accumulate.mjs](../reference/operators/accumulate.mjs), [compare.mjs](../reference/operators/compare.mjs), [select.mjs](../reference/operators/select.mjs), [combine.mjs](../reference/operators/combine.mjs) and [state.mjs](../reference/operators/state.mjs). Each has a `*.mutants.test.mjs` beside it: edits of the module, each naming the contract sentence it breaks, and each of which a trace must notice |

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

On main three things of an active contract are immutable (graphrefly:D816): its `use` and exception
statements, which traces it and each exception link, and the steps and expectation of every trace an
active contract links. Each changes only through a new revision that a root decision introduces, with
the `transition` from the earlier one; a trace is not edited but succeeded by a new trace the new
revision links. A rationale, a trace's name and basis, and a draft are corrected in place, as is any
row that exists only on an unmerged branch. What the user decides while a family is written is part of
D813's first content and is not numbered: the contract states it and its rationale records it. No gate
holds the immutable things yet; that is graphrefly:B146's.

## A trace

```text
{ id: "OT-<n>", name, basis, detail: "messages"|"occurrences",
  nodes: [{ id, state: [value?] } | { id, op, deps, args? }],
  steps: [request], expect: [[[sink, node, messages]]] }
```

`nodes` are built in order on one graph. `state: []` is a state without a value, and `state: [v]` one
that holds v. `steps` are host
requests, one wave each: `["subscribe", sink, node]`, `["unsubscribe", sink, node]`, `["set", state, value]`, `["invalidate", state]`,
`["complete", state]`, `["error", state, payload]`, `["batch", [requests]]`, `["restore"]`, which
captures the graph, restores it with no subscribers and continues on the restored one, and
`["advance", ms]` on a clock the test owns. The reference runner has no clock yet, so it skips a
trace with an `advance` step. `expect[i]` is what the sinks received during `steps[i]`. A trace
subscribes at least one sink and expects something somewhere, so that it can fail. An expectation
writes `["ERROR"]`, without a payload, for an ERROR that a throw produced: how a thrown value becomes
a payload is each runtime's (R-failure), so only the ERROR is expected. A trace also says that nothing
arrives after its last step. The reference run checks that within one turn of the event loop, which
catches a promise or an immediate timer and not a timer of a few milliseconds.

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
given that value. A higher-order `project` is `follow`, which returns the node its argument names.
The runner knows which options each operator takes and refuses any other key of a node or of its
args.

Three node kinds only shape a trace's input and are not operators of the set. `arrays` sends each
element of its source's value as one array in one wave: a list is that list as DATA, `"INVALIDATE"`
and `"COMPLETE"` are those messages, and `{ "error": payload }` is an ERROR. `empty` completes on
activation without DATA, and `once` sends its `value` as it is activated.

A link is checked against the trace, step by step and one node of the operator at a time. A sink must
subscribe a node of the contract's operator or a node after it. An exception's trace must hold a
step of its topic made while a sink of that same node is subscribed: an `invalidate`, for an invalidation exception, or a `complete` or `error`, for a
completion exception, of a state the operator depends on (for an operator with a projector, also a
node named by a value written to its input); and for a recovery exception a `restore` with such a
sink subscribed before it and again after it. The check reads a node's inputs from the trace as
written, so it does not see an INVALIDATE or a terminal that only an `arrays` helper sends, and it
still counts a source a concat has not reached or an input a race has released; a trace of the
first kind is linked from the ordinary use or from a same-wave exception.

`basis` names where the selection states the trace. A pass on the reference kernel is candidate
evidence that a trace agrees with the kernel rules; it is not a runtime result.

## Not in the set

DS-20 dropped onFirstData, find, elementAt, combine, generic audit, rescue (catchError replaces it) and
settle. history is a module rule (R-history), not an operator contract.
