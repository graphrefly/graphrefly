------------------------ MODULE wave_rewire_deferred ------------------------
(***************************************************************************
GraphReFly — wave-boundary deferred SELF-rewire (conformance C-11, rule
R-rewire-deferred, decision D47).

The cross-axis companion to wave_rewire.tla. wave_rewire.tla models EXTERNAL,
IMMEDIATE rewire applied BETWEEN waves (the caller is outside any fn). This
module models the NEW path D47 adds: a node fn, DURING its own run
(insideRunWave = TRUE), issues ctx.rewireNext(add/remove) requests that are
QUEUED, then DRAINED and applied by the dispatcher at the COMMITTED wave
boundary (insideRunWave = FALSE) as a fresh wave, in per-node FIFO order.

This is the ONLY legal self-triggered rewire. An IMMEDIATE in-fn self-rewire is
the D37 reject (modeled in wave_reentrancy.tla), so it is deliberately NOT an
action here: deps mutate ONLY in DrainOne, which is guarded ~insideRunWave.

Discharges the four invariants R-rewire-deferred / C-11 require before
R-rewire-deferred flips active (D47 SD-2):

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

ABSTRACTION: a single compute node OP over a small candidate dep set. The fn
body is a black box that may issue rewireNext requests; OP's output / equals /
two-phase mechanics are wave_rewire.tla / wave_rewire_emit.tla's job. Time is
the run/boundary cycle: StartRun -> IssueRewireNext* -> EndRun -> DrainOne*
(-> StartRun ...). Edge messages are abstracted to a per-dep pending count
(presence is all RemovedDepSilenced needs); a dep emits toward OP only while
wired (every edge has a real subscription behind it).

Status: draft (gates R-rewire-deferred active with C-11 TS green, D47 SD-2).
 ***************************************************************************)
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS Deps, MaxRuns, MaxReqs, MaxMsgs, MaxDeliveries

Op == [kind : {"add", "remove"}, dep : Deps]

VARIABLES
    deps,            \* SUBSET Deps — OP's current dep set
    insideRunWave,   \* BOOLEAN — TRUE while OP's fn is running
    reqQueue,        \* Seq(Op) — rewireNext requests issued this run, not yet applied
    edge,            \* [Deps -> Nat] — pending message count on each dep's edge to OP
    runCount, reqCount, applied, deliverCount,
    ghostMutatedWhileInside,  \* set TRUE iff deps ever changes while insideRunWave
    ghostRequeuedNoop         \* set TRUE iff a no-op drain fails to shrink reqQueue

vars == <<deps, insideRunWave, reqQueue, edge,
          runCount, reqCount, applied, deliverCount,
          ghostMutatedWhileInside, ghostRequeuedNoop>>

----------------------------------------------------------------------------
TypeOK ==
    /\ deps \in SUBSET Deps
    /\ insideRunWave \in BOOLEAN
    /\ \A i \in DOMAIN reqQueue : reqQueue[i] \in Op
    /\ edge \in [Deps -> 0..MaxMsgs]
    /\ runCount \in 0..MaxRuns
    /\ reqCount \in 0..MaxReqs
    /\ applied \in 0..MaxReqs
    /\ deliverCount \in 0..MaxDeliveries
    /\ ghostMutatedWhileInside \in BOOLEAN
    /\ ghostRequeuedNoop \in BOOLEAN

Init ==
    /\ deps = {}
    /\ insideRunWave = FALSE
    /\ reqQueue = <<>>
    /\ edge = [d \in Deps |-> 0]
    /\ runCount = 0
    /\ reqCount = 0
    /\ applied = 0
    /\ deliverCount = 0
    /\ ghostMutatedWhileInside = FALSE
    /\ ghostRequeuedNoop = FALSE

----------------------------------------------------------------------------
\* A fresh wave begins: OP's fn runs. Boundary discipline — only when the prior
\* run's requests have all been drained (reqQueue empty).
StartRun ==
    /\ ~insideRunWave
    /\ reqQueue = <<>>
    /\ runCount < MaxRuns
    /\ insideRunWave' = TRUE
    /\ runCount' = runCount + 1
    /\ UNCHANGED <<deps, reqQueue, edge, reqCount, applied, deliverCount,
                   ghostMutatedWhileInside, ghostRequeuedNoop>>

\* During the run, the fn requests a self-rewire. QUEUED, not applied — deps are
\* UNCHANGED here. This is the deferral.
IssueRewireNext(op) ==
    /\ insideRunWave
    /\ reqCount < MaxReqs
    /\ reqQueue' = Append(reqQueue, op)
    /\ reqCount' = reqCount + 1
    /\ UNCHANGED <<deps, insideRunWave, edge, runCount, applied, deliverCount,
                   ghostMutatedWhileInside, ghostRequeuedNoop>>

\* The fn returns; the wave settles. This is the committed boundary.
EndRun ==
    /\ insideRunWave
    /\ insideRunWave' = FALSE
    /\ UNCHANGED <<deps, reqQueue, edge, runCount, reqCount, applied, deliverCount,
                   ghostMutatedWhileInside, ghostRequeuedNoop>>

\* The dispatcher drains ONE queued request at the boundary (insideRunWave FALSE),
\* in FIFO order, and applies it. A removed dep's edge is DRAINED. A no-net-change
\* op is a no-op (deps unchanged) and never re-queues. deps mutate ONLY here.
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
    /\ UNCHANGED <<insideRunWave, runCount, reqCount, deliverCount>>

\* A wired dep produces a message toward OP (every edge has a real subscription).
EmitFromDep(d) ==
    /\ d \in deps
    /\ edge[d] < MaxMsgs
    /\ edge' = [edge EXCEPT ![d] = @ + 1]
    /\ UNCHANGED <<deps, insideRunWave, reqQueue, runCount, reqCount, applied,
                   deliverCount, ghostMutatedWhileInside, ghostRequeuedNoop>>

\* OP consumes one queued edge message. edge[d] > 0 only holds for a live dep
\* (EmitFromDep guards d \in deps; removal drains), so OP never consumes a
\* removed dep's message.
DeliverToOP(d) ==
    /\ edge[d] > 0
    /\ deliverCount < MaxDeliveries
    /\ edge' = [edge EXCEPT ![d] = @ - 1]
    /\ deliverCount' = deliverCount + 1
    /\ UNCHANGED <<deps, insideRunWave, reqQueue, runCount, reqCount, applied,
                   ghostMutatedWhileInside, ghostRequeuedNoop>>

----------------------------------------------------------------------------
Next ==
    \/ StartRun
    \/ \E op \in Op : IssueRewireNext(op)
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
=============================================================================
