------------------------ MODULE wave_rewire_deferred ------------------------
(***************************************************************************
GraphReFly — wave-boundary deferred SELF-rewire (conformance C-11, rule
R-rewire-deferred, decisions D47 + D62).

The cross-axis companion to wave_rewire.tla. wave_rewire.tla models EXTERNAL,
IMMEDIATE rewire applied BETWEEN waves (the caller is outside any fn). This
module models the NEW path D47 adds: a node fn, DURING its own run
(insideRunWave = TRUE), issues ctx.rewireNext(add/remove) requests that are
QUEUED, then DRAINED and applied by the dispatcher at the COMMITTED wave
boundary (insideRunWave = FALSE) as a fresh wave, in per-node FIFO order.

This is the ONLY legal self-triggered rewire. An IMMEDIATE in-fn self-rewire is
the D37 reject (modeled in wave_reentrancy.tla), so it is deliberately NOT an
action here: deps mutate ONLY in DrainOne, which is guarded ~insideRunWave.

Discharges the invariants R-rewire-deferred / C-11 require:

  - DeferredAppliedAtBoundary : deps NEVER mutate while insideRunWave (the
                                deferral itself). Load-bearing: drop the
                                ~insideRunWave guard on DrainOne and it trips.
  - DrainExactlyOnce          : conservation — every enqueued request is either
                                still queued or applied, exactly once (no loss,
                                no duplicate): applied + Len(reqQueue) = reqCount.
                                Load-bearing: Tail-without-apply (loss) or
                                apply-without-Tail (duplicate) and it trips.
  - RemovedDepSilenced        : once a deferred removeDep is applied, the removed
                                dep's edge is DRAINED — a non-dep has no queued
                                messages to OP. The boundary-applied analog of
                                wave_rewire.tla NoStaleEdgeMessages. Load-bearing:
                                drop the edge drain in DrainOne and it trips.
  - NoBoundaryDrainLoop       : a no-net-change request (add-existing /
                                remove-absent) is a no-op and NEVER re-queues, so
                                the drain strictly shrinks reqQueue and
                                terminates. Load-bearing: re-append a no-op for
                                retry and it trips.
  - NoPostTerminalOutput      : D62 — terminal is an output guard, NOT a deferred
                                topology-drain cancellation condition. Requests
                                queued before terminal still drain; messages that
                                later arrive from live deps are absorbed and do
                                not produce downstream output.

ABSTRACTION: a single compute node OP over a small candidate dep set. The fn
body is a black box that may issue rewireNext requests; OP's output / equals /
two-phase mechanics are wave_rewire.tla / wave_rewire_emit.tla's job. Time is
the run/boundary cycle: StartRun -> IssueRewireNext* -> EndRun -> DrainOne*
(-> StartRun ...). Edge messages are abstracted to a per-dep pending count
(presence is all RemovedDepSilenced needs); a dep emits toward OP only while
wired (every edge has a real subscription behind it).

Status: active for the TS arm (D62 revised the terminal facet; C-11 ts:pass on 2026-05-31,
rust/py still todo).
 ***************************************************************************)
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS Deps, MaxRuns, MaxReqs, MaxMsgs, MaxDeliveries

Op == [kind : {"add", "remove"}, dep : Deps]

VARIABLES
    deps,            \* SUBSET Deps — OP's current dep set
    insideRunWave,   \* BOOLEAN — TRUE while OP's fn is running
    terminal,         \* BOOLEAN — OP has emitted COMPLETE/ERROR; output sealed
    reqQueue,        \* Seq(Op) — rewireNext requests issued this run, not yet applied
    edge,            \* [Deps -> Nat] — pending message count on each dep's edge to OP
    runCount, reqCount, applied, deliverCount, outputCount,
    ghostMutatedWhileInside,  \* set TRUE iff deps ever changes while insideRunWave
    ghostRequeuedNoop,        \* set TRUE iff a no-op drain fails to shrink reqQueue
    ghostOutputAfterTerminal  \* set TRUE iff OP outputs after terminal

vars == <<deps, insideRunWave, terminal, reqQueue, edge,
          runCount, reqCount, applied, deliverCount, outputCount,
          ghostMutatedWhileInside, ghostRequeuedNoop, ghostOutputAfterTerminal>>

----------------------------------------------------------------------------
TypeOK ==
    /\ deps \in SUBSET Deps
    /\ insideRunWave \in BOOLEAN
    /\ terminal \in BOOLEAN
    /\ \A i \in DOMAIN reqQueue : reqQueue[i] \in Op
    /\ edge \in [Deps -> 0..MaxMsgs]
    /\ runCount \in 0..MaxRuns
    /\ reqCount \in 0..MaxReqs
    /\ applied \in 0..MaxReqs
    /\ deliverCount \in 0..MaxDeliveries
    /\ outputCount \in 0..MaxDeliveries
    /\ ghostMutatedWhileInside \in BOOLEAN
    /\ ghostRequeuedNoop \in BOOLEAN
    /\ ghostOutputAfterTerminal \in BOOLEAN

Init ==
    /\ deps = {}
    /\ insideRunWave = FALSE
    /\ terminal = FALSE
    /\ reqQueue = <<>>
    /\ edge = [d \in Deps |-> 0]
    /\ runCount = 0
    /\ reqCount = 0
    /\ applied = 0
    /\ deliverCount = 0
    /\ outputCount = 0
    /\ ghostMutatedWhileInside = FALSE
    /\ ghostRequeuedNoop = FALSE
    /\ ghostOutputAfterTerminal = FALSE

----------------------------------------------------------------------------
\* A fresh wave begins: OP's fn runs. Boundary discipline — only when the prior
\* run's requests have all been drained (reqQueue empty).
StartRun ==
    /\ ~insideRunWave
    /\ ~terminal
    /\ reqQueue = <<>>
    /\ runCount < MaxRuns
    /\ insideRunWave' = TRUE
    /\ runCount' = runCount + 1
    /\ UNCHANGED <<deps, terminal, reqQueue, edge, reqCount, applied,
                   deliverCount, outputCount, ghostMutatedWhileInside,
                   ghostRequeuedNoop, ghostOutputAfterTerminal>>

\* During the run, the fn requests a self-rewire. QUEUED, not applied — deps are
\* UNCHANGED here. This is the deferral.
IssueRewireNext(op) ==
    /\ insideRunWave
    /\ reqCount < MaxReqs
    /\ reqQueue' = Append(reqQueue, op)
    /\ reqCount' = reqCount + 1
    /\ UNCHANGED <<deps, insideRunWave, terminal, edge, runCount, applied,
                   deliverCount, outputCount, ghostMutatedWhileInside,
                   ghostRequeuedNoop, ghostOutputAfterTerminal>>

\* OP emits COMPLETE/ERROR during its run. D62: this seals OP's output, but it
\* does NOT cancel reqQueue; queued rewireNext requests still drain at boundary.
GoTerminal ==
    /\ insideRunWave
    /\ ~terminal
    /\ terminal' = TRUE
    /\ UNCHANGED <<deps, insideRunWave, reqQueue, edge, runCount, reqCount,
                   applied, deliverCount, outputCount, ghostMutatedWhileInside,
                   ghostRequeuedNoop, ghostOutputAfterTerminal>>

\* The fn returns; the wave settles. This is the committed boundary.
EndRun ==
    /\ insideRunWave
    /\ insideRunWave' = FALSE
    /\ UNCHANGED <<deps, terminal, reqQueue, edge, runCount, reqCount, applied,
                   deliverCount, outputCount, ghostMutatedWhileInside,
                   ghostRequeuedNoop, ghostOutputAfterTerminal>>

\* The dispatcher drains ONE queued request at the boundary (insideRunWave FALSE),
\* in FIFO order, and applies it EVEN IF OP is terminal (D62). A removed dep's
\* edge is DRAINED. A no-net-change op is a no-op (deps unchanged) and never
\* re-queues. deps mutate ONLY here.
DrainOne ==
    /\ ~insideRunWave
    /\ reqQueue # <<>>
    /\ LET op       == Head(reqQueue)
           isAdd    == op.kind = "add"
           netChange == IF isAdd THEN op.dep \notin deps ELSE op.dep \in deps
       IN
       /\ deps' = IF isAdd THEN deps \cup {op.dep} ELSE deps \ {op.dep}
       /\ edge' = IF ~isAdd /\ op.dep \in deps
                     THEN [edge EXCEPT ![op.dep] = 0]   \* drain the removed dep's edge
                     ELSE edge
       /\ reqQueue' = Tail(reqQueue)
       /\ applied' = applied + 1
       /\ ghostMutatedWhileInside' =
              (ghostMutatedWhileInside \/ (insideRunWave /\ deps' # deps))
       /\ ghostRequeuedNoop' =
              (ghostRequeuedNoop \/ (~netChange /\ Len(reqQueue') >= Len(reqQueue)))
    /\ UNCHANGED <<insideRunWave, terminal, runCount, reqCount, deliverCount,
                   outputCount, ghostOutputAfterTerminal>>

\* A wired dep produces a message toward OP (every edge has a real subscription).
EmitFromDep(d) ==
    /\ d \in deps
    /\ edge[d] < MaxMsgs
    /\ edge' = [edge EXCEPT ![d] = @ + 1]
    /\ UNCHANGED <<deps, insideRunWave, terminal, reqQueue, runCount, reqCount,
                   applied, deliverCount, outputCount, ghostMutatedWhileInside,
                   ghostRequeuedNoop, ghostOutputAfterTerminal>>

\* OP consumes one queued edge message. edge[d] > 0 only holds for a live dep
\* (EmitFromDep guards d \in deps; removal drains), so OP never consumes a
\* removed dep's message. If OP is terminal, the message is absorbed and produces
\* NO downstream output (D62 terminal output guard).
DeliverToOP(d) ==
    /\ edge[d] > 0
    /\ deliverCount < MaxDeliveries
    /\ edge' = [edge EXCEPT ![d] = @ - 1]
    /\ deliverCount' = deliverCount + 1
    /\ outputCount' = IF terminal THEN outputCount ELSE outputCount + 1
    /\ ghostOutputAfterTerminal' =
          (ghostOutputAfterTerminal \/ (terminal /\ outputCount' # outputCount))
    /\ UNCHANGED <<deps, insideRunWave, terminal, reqQueue, runCount, reqCount,
                   applied, ghostMutatedWhileInside, ghostRequeuedNoop>>

----------------------------------------------------------------------------
Next ==
    \/ StartRun
    \/ \E op \in Op : IssueRewireNext(op)
    \/ GoTerminal
    \/ EndRun
    \/ DrainOne
    \/ \E d \in Deps : EmitFromDep(d)
    \/ \E d \in Deps : DeliverToOP(d)

Spec == Init /\ [][Next]_vars

----------------------------------------------------------------------------
(*                             INVARIANTS                                 *)

\* The deferral: deps mutate ONLY at the boundary, never while the fn runs.
\* Load-bearing: drop the ~insideRunWave guard on DrainOne and this trips.
DeferredAppliedAtBoundary ==
    ghostMutatedWhileInside = FALSE

\* Conservation: every enqueued request is either still queued or applied,
\* exactly once. Load-bearing: Tail-without-apply (loss) or apply-without-Tail
\* (duplicate) in DrainOne and this trips.
DrainExactlyOnce ==
    applied + Len(reqQueue) = reqCount

\* The boundary-applied analog of NoStaleEdgeMessages: a non-dep has no queued
\* edge messages (a deferred removeDep drained them). Load-bearing: drop the
\* edge drain in DrainOne and this trips.
RemovedDepSilenced ==
    \A d \in Deps : d \notin deps => edge[d] = 0

\* A no-net-change request is a no-op and never re-queues — the drain strictly
\* shrinks reqQueue and terminates. Load-bearing: re-append a no-op in DrainOne
\* and this trips.
NoBoundaryDrainLoop ==
    ghostRequeuedNoop = FALSE

\* D62: terminal seals output, but does not cancel the deferred topology drain.
\* Load-bearing: make DeliverToOP increment outputCount even when terminal and
\* this trips.
NoPostTerminalOutput ==
    ghostOutputAfterTerminal = FALSE
=============================================================================
