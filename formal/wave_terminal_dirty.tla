--------------------- MODULE wave_terminal_dirty ---------------------
(***************************************************************************
GraphReFly — a dep's TERMINAL (COMPLETE/ERROR) releases its in-wave DIRTY
contribution (conformance C-15). Pins R-terminal-settles-dirty (B35).

A join node D over `Deps`. Each dep moves through:

  clean --DIRTY--> dirty --DATA/RESOLVED--> settled
                         \--COMPLETE/ERROR--> terminal   (ABSORBED: D stays live,
                                                           e.g. completeWhenDepsComplete:false
                                                           / errorWhenDepsError:false)
  clean ----------------COMPLETE/ERROR-----> terminal
  settled --------------COMPLETE/ERROR-----> terminal

`pending` counts the deps with an OUTSTANDING DIRTY contribution (went DIRTY in
phase 1, not yet released in phase 2). The settle-class events {DATA, RESOLVED,
INVALIDATE, COMPLETE, ERROR} each release a dirtied dep's contribution. The bug
this pins: the COMPLETE/ERROR arms did NOT release it (only DATA/RESOLVED/
INVALIDATE did), so a DIRTY-then-terminal-without-a-value dep stranded
`pending > 0` -> D never settled and the DIRTY it broadcast wedged downstream
(the deadlock R-invalidate-idempotent already prevents for INVALIDATE).

The NEW rule (R-terminal-settles-dirty / DepTerminal below): a terminal at a
DIRTY dep decrements `pending`, exactly like DepData. Only the ABSORBED-terminal
case is modelled (D stays live); the auto-cascade cases make D itself terminal,
where `pending` is moot.

  PendingCountsDirty — `pending` always equals #{dirty deps} (the exactly-one-
                       settle invariant). A terminal that fails to release leaves
                       pending > #dirty.
  NoWedge            — D never owes a settle (emittedDirty) with pending>0 while
                       NO dep is still dirty (nothing left to release it).

Mutation: drop the `pending - 1` in DepTerminal's dirty case -> both trip
(a dirty-then-terminal dep strands pending, and DepData can't reach it).

Status: draft (flips active with the C-15 TS + Rust arms green).
Config: wave_terminal_dirty.cfg.
 ***************************************************************************)
EXTENDS Integers, FiniteSets, TLC

CONSTANTS Deps, MaxSteps

VARIABLES
  depState,      \* [Deps -> {"clean","dirty","settled","terminal"}]
  pending,       \* Nat — count of deps with an outstanding DIRTY contribution
  emittedDirty,  \* BOOLEAN — D broadcast DIRTY this wave (owes a settle)
  settled,       \* BOOLEAN — D has settled this wave (fn DATA or undirty RESOLVED)
  steps

vars == <<depState, pending, emittedDirty, settled, steps>>

DirtyDeps == {d \in Deps : depState[d] = "dirty"}

TypeOK ==
  /\ depState     \in [Deps -> {"clean","dirty","settled","terminal"}]
  /\ pending      \in 0..Cardinality(Deps)
  /\ emittedDirty \in BOOLEAN
  /\ settled      \in BOOLEAN
  /\ steps        \in 0..MaxSteps

Init ==
  /\ depState     = [d \in Deps |-> "clean"]
  /\ pending      = 0
  /\ emittedDirty = FALSE
  /\ settled      = FALSE
  /\ steps        = 0

\* phase 1: a clean dep dirties -> contributes to pending; D broadcasts DIRTY once
\* and (re-)opens the wave (a new change owes a fresh settle).
DepDirty(d) ==
  /\ steps < MaxSteps
  /\ depState[d] = "clean"
  /\ depState'     = [depState EXCEPT ![d] = "dirty"]
  /\ pending'      = pending + 1
  /\ emittedDirty' = TRUE
  /\ settled'      = FALSE
  /\ steps'        = steps + 1

\* phase 2: a dirty dep settles with DATA/RESOLVED -> releases its contribution.
DepData(d) ==
  /\ steps < MaxSteps
  /\ depState[d] = "dirty"
  /\ depState' = [depState EXCEPT ![d] = "settled"]
  /\ pending'  = pending - 1
  /\ steps'    = steps + 1
  /\ UNCHANGED <<emittedDirty, settled>>

\* phase 2: a dep TERMINATES (COMPLETE/ERROR), ABSORBED by D (D stays live). The
\* NEW rule (R-terminal-settles-dirty): release its outstanding DIRTY contribution
\* IFF it was dirty — exactly like DepData. A clean/settled dep terminating does
\* not touch `pending` (it carried no outstanding dirty).
DepTerminal(d) ==
  /\ steps < MaxSteps
  /\ depState[d] # "terminal"
  /\ depState' = [depState EXCEPT ![d] = "terminal"]
  /\ pending'  = IF depState[d] = "dirty" THEN pending - 1 ELSE pending
  /\ steps'    = steps + 1
  /\ UNCHANGED <<emittedDirty, settled>>

\* D settles once every dirtied dep has released (pending = 0) and D owed a settle
\* (it had broadcast DIRTY). Models the fn recompute -> DATA, or the substrate-
\* synthesized undirty RESOLVED (R-resolved-undirty) that balances the DIRTY.
NodeSettle ==
  /\ steps < MaxSteps
  /\ pending = 0
  /\ emittedDirty
  /\ settled'      = TRUE
  /\ emittedDirty' = FALSE
  /\ steps'        = steps + 1
  /\ UNCHANGED <<depState, pending>>

Next ==
  \/ \E d \in Deps : DepDirty(d)
  \/ \E d \in Deps : DepData(d)
  \/ \E d \in Deps : DepTerminal(d)
  \/ NodeSettle

Spec == Init /\ [][Next]_vars

\* ── Invariants ──

\* Core (the exactly-one-settle invariant): `pending` counts EXACTLY the dirty
\* deps. A terminal at a dirty dep that fails to release leaves pending > #dirty.
PendingCountsDirty == pending = Cardinality(DirtyDeps)

\* Observable consequence: D never owes a settle (emittedDirty) while pending > 0
\* but NO dep is still dirty — i.e. pending is STRANDED with nothing left to
\* release it (the wedge). Implied by PendingCountsDirty; asserted separately as
\* the user-facing deadlock symptom.
NoWedge == ~(emittedDirty /\ pending > 0 /\ DirtyDeps = {})
=============================================================================
