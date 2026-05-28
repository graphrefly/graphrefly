-------------------------- MODULE wave_async --------------------------
(***************************************************************************
GraphReFly — mixed sync/async diamond (conformance C-4).

Pins R-diamond + R-graph-domain + R-two-phase + R-first-run-gate for the case
where one diamond leg is SYNC (LocalSync) and the other is ASYNC (LocalAsync
pool). Topology (single graph):

    A
    ├→ B (sync   — settles immediately on DATA)
    ├→ C (async  — DATA dispatches to a pool; a separate Resolve step settles)
    B → D
    C → D

The async leg adds a `cPending` phase between C receiving DATA and C emitting
DATA to D — modeling the LocalAsync pool callback. The pool result re-enters
the wave on the graph's single thread (R-graph-domain). D must join EXACTLY
ONCE after BOTH legs settle — the late async leg must not let D fire early on
B alone, nor twice.

Single-wave-serialized (bounds state space); covers the async-specific failure
modes: D firing before the async leg resolves, D double-firing, cross-leg
incoherent join.

Status: draft (flips active with the LocalAsync pool impl, CSP-1).
 ***************************************************************************)
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS Values, MaxEmits

NONE  == -1
Nodes == {"A", "B", "C", "D"}
AB == <<"A", "B">>
AC == <<"A", "C">>
BD == <<"B", "D">>
CD == <<"C", "D">>
Edges == {AB, AC, BD, CD}
Legs  == {"B", "C"}

VARIABLES cache, nstatus, q, dDirty, dVal, dSettled, fired, emits,
          joinWitness, cPending, cPendingVal
vars == <<cache, nstatus, q, dDirty, dVal, dSettled, fired, emits,
          joinWitness, cPending, cPendingVal>>

MsgT      == [t : {"DIRTY", "DATA"}, v : Values \cup {NONE}]
Mk(tt, vv) == [t |-> tt, v |-> vv]

AnyDirty == \E e \in Edges : \E i \in 1..Len(q[e]) : q[e][i].t = "DIRTY"

TypeOK ==
  /\ cache    \in [Nodes -> Values \cup {NONE}]
  /\ nstatus  \in [Nodes -> {"idle", "dirty", "settled", "pending"}]
  /\ q        \in [Edges -> Seq(MsgT)]
  /\ dDirty   \in [Legs -> BOOLEAN]
  /\ dVal     \in [Legs -> Values \cup {NONE}]
  /\ dSettled \in [Legs -> BOOLEAN]
  /\ fired    \in 0..MaxEmits
  /\ emits    \in 0..MaxEmits
  /\ joinWitness \in (Values \cup {NONE}) \X (Values \cup {NONE})
  /\ cPending  \in BOOLEAN
  /\ cPendingVal \in Values \cup {NONE}

Init ==
  /\ cache    = [n \in Nodes |-> NONE]
  /\ nstatus  = [n \in Nodes |-> "idle"]
  /\ q        = [e \in Edges |-> << >>]
  /\ dDirty   = [l \in Legs |-> FALSE]
  /\ dVal     = [l \in Legs |-> NONE]
  /\ dSettled = [l \in Legs |-> FALSE]
  /\ fired    = 0
  /\ emits    = 0
  /\ joinWitness = <<NONE, NONE>>
  /\ cPending    = FALSE
  /\ cPendingVal = NONE

Quiesced ==
  /\ \A e \in Edges : q[e] = << >>
  /\ \A l \in Legs : ~dDirty[l] /\ ~dSettled[l]
  /\ ~cPending

EmitA(v) ==
  /\ emits < MaxEmits
  /\ Quiesced
  /\ cache'   = [cache EXCEPT !["A"] = v]
  /\ nstatus' = [nstatus EXCEPT !["A"] = "settled"]
  /\ q' = [q EXCEPT ![AB] = <<Mk("DIRTY", NONE), Mk("DATA", v)>>,
                    ![AC] = <<Mk("DIRTY", NONE), Mk("DATA", v)>>]
  /\ emits'   = emits + 1
  /\ UNCHANGED <<dDirty, dVal, dSettled, fired, joinWitness, cPending, cPendingVal>>

RelayDirty(inEdge, node, outEdge) ==
  /\ Len(q[inEdge]) > 0
  /\ Head(q[inEdge]).t = "DIRTY"
  /\ q' = [q EXCEPT ![inEdge] = Tail(q[inEdge]),
                    ![outEdge] = Append(q[outEdge], Mk("DIRTY", NONE))]
  /\ nstatus' = [nstatus EXCEPT ![node] = "dirty"]
  /\ UNCHANGED <<cache, dDirty, dVal, dSettled, fired, emits, joinWitness,
                 cPending, cPendingVal>>

\* B is SYNC: settles immediately on DATA and forwards to D.
RelayDataSync(inEdge, node, outEdge) ==
  /\ Len(q[inEdge]) > 0
  /\ Head(q[inEdge]).t = "DATA"
  /\ ~AnyDirty
  /\ LET v == Head(q[inEdge]).v IN
       /\ cache'   = [cache EXCEPT ![node] = v]
       /\ nstatus' = [nstatus EXCEPT ![node] = "settled"]
       /\ q' = [q EXCEPT ![inEdge] = Tail(q[inEdge]),
                         ![outEdge] = Append(q[outEdge], Mk("DATA", v))]
  /\ UNCHANGED <<dDirty, dVal, dSettled, fired, emits, joinWitness,
                 cPending, cPendingVal>>

\* C is ASYNC: receiving DATA dispatches to the pool (status pending); it does
\* NOT forward to D yet.
DispatchAsyncC ==
  /\ Len(q[AC]) > 0
  /\ Head(q[AC]).t = "DATA"
  /\ ~AnyDirty
  /\ ~cPending
  /\ cPending'    = TRUE
  /\ cPendingVal' = Head(q[AC]).v
  /\ nstatus'     = [nstatus EXCEPT !["C"] = "pending"]
  /\ q'           = [q EXCEPT ![AC] = Tail(q[AC])]
  /\ UNCHANGED <<cache, dDirty, dVal, dSettled, fired, emits, joinWitness>>

\* The pool callback resolves: C settles and forwards DATA to D (re-enters the
\* wave on the graph thread).
ResolveAsyncC ==
  /\ cPending
  /\ cache'    = [cache EXCEPT !["C"] = cPendingVal]
  /\ nstatus'  = [nstatus EXCEPT !["C"] = "settled"]
  /\ q'        = [q EXCEPT ![CD] = Append(q[CD], Mk("DATA", cPendingVal))]
  /\ cPending' = FALSE
  /\ cPendingVal' = NONE
  /\ UNCHANGED <<dDirty, dVal, dSettled, fired, emits, joinWitness>>

DRecvDirty(leg, inEdge) ==
  /\ Len(q[inEdge]) > 0
  /\ Head(q[inEdge]).t = "DIRTY"
  /\ q' = [q EXCEPT ![inEdge] = Tail(q[inEdge])]
  /\ dDirty' = [dDirty EXCEPT ![leg] = TRUE]
  /\ nstatus' = [nstatus EXCEPT !["D"] = "dirty"]
  /\ UNCHANGED <<cache, dVal, dSettled, fired, emits, joinWitness, cPending, cPendingVal>>

DRecvData(leg, inEdge) ==
  /\ Len(q[inEdge]) > 0
  /\ Head(q[inEdge]).t = "DATA"
  /\ ~AnyDirty
  /\ dDirty[leg]
  /\ ~dSettled[leg]
  /\ dSettled' = [dSettled EXCEPT ![leg] = TRUE]
  /\ dVal'     = [dVal EXCEPT ![leg] = Head(q[inEdge]).v]
  /\ q' = [q EXCEPT ![inEdge] = Tail(q[inEdge])]
  /\ UNCHANGED <<cache, nstatus, dDirty, fired, emits, joinWitness, cPending, cPendingVal>>

DFire ==
  /\ dSettled["B"] /\ dSettled["C"]
  /\ cache'   = [cache EXCEPT !["D"] = dVal["B"]]
  /\ nstatus' = [nstatus EXCEPT !["D"] = "settled"]
  /\ fired'   = fired + 1
  /\ joinWitness' = <<dVal["B"], dVal["C"]>>
  /\ dDirty'   = [l \in Legs |-> FALSE]
  /\ dSettled' = [l \in Legs |-> FALSE]
  /\ dVal'     = [l \in Legs |-> NONE]
  /\ UNCHANGED <<q, emits, cPending, cPendingVal>>

Next ==
  \/ \E v \in Values : EmitA(v)
  \/ RelayDirty(AB, "B", BD)
  \/ RelayDirty(AC, "C", CD)
  \/ RelayDataSync(AB, "B", BD)
  \/ DispatchAsyncC
  \/ ResolveAsyncC
  \/ DRecvDirty("B", BD)
  \/ DRecvDirty("C", CD)
  \/ DRecvData("B", BD)
  \/ DRecvData("C", CD)
  \/ DFire

Spec == Init /\ [][Next]_vars

\* ── Invariants ──
\* D joins once per wave despite the async leg settling later (no double-fire).
NoGlitchDoubleFire == fired <= emits
\* Sync and async legs join a coherent same-wave pair.
DJoinCoherent == joinWitness[1] = joinWitness[2]
\* DIRTY precedes DATA at D (two-phase preserved with an async leg).
DirtyBeforeDataAtD == \A l \in Legs : dSettled[l] => dDirty[l]
\* C cannot be simultaneously pending and settled — the async dispatch/resolve
\* phases are exclusive (D never joins a still-pending async leg).
AsyncLegExclusive == cPending => ~dSettled["C"]
=============================================================================
