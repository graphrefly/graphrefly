-------------------------- MODULE wave_xgraph --------------------------
(***************************************************************************
GraphReFly — cross-graph diamond (conformance C-1).

Pins R-diamond + R-graph-domain + R-two-phase for the cross-RUNTIME case
(L2.F). Topology: a diamond split across TWO causal domains (graphs) joined
by a wire bridge —

    A (g1)
    ├─wire→ B (g2)
    ├─wire→ C (g2)
    B ─wire→ D (g1)
    C ─wire→ D (g1)

The wire bridge is modeled as per-edge FIFO queues (a DIRTY enqueued before a
DATA is delivered before it — DIRTY crosses the wire AT DATA PRIORITY, R12, so
the wire never reorders the two phases). Two-phase is the global gate: no DATA
moves anywhere while any DIRTY is in flight. Together they are the L2.F survival
proof — the diamond stays glitch-free despite the domain split, and D joins
EXACTLY ONCE on a coherent (same-wave) pair.

This module is intentionally single-wave-serialized (a new A-emit waits for the
prior wave to fully quiesce) — that bounds the state space while still catching
the cross-graph-specific failure modes: D double-firing, D firing on a partial
pair, and DATA arriving at D ahead of DIRTY.

Out of scope (covered by wave_protocol.tla): cross-wave glitch interleaving,
equals substitution, PAUSE, INVALIDATE, terminal lifecycle.

Status: draft (flips active with the wire-bridge impl, backlog B2).
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

VARIABLES cache, nstatus, q, dDirty, dVal, dSettled, fired, emits, joinWitness
vars == <<cache, nstatus, q, dDirty, dVal, dSettled, fired, emits, joinWitness>>

MsgT      == [t : {"DIRTY", "DATA"}, v : Values \cup {NONE}]
Mk(tt, vv) == [t |-> tt, v |-> vv]

AnyDirty == \E e \in Edges : \E i \in 1..Len(q[e]) : q[e][i].t = "DIRTY"

TypeOK ==
  /\ cache    \in [Nodes -> Values \cup {NONE}]
  /\ nstatus  \in [Nodes -> {"idle", "dirty", "settled"}]
  /\ q        \in [Edges -> Seq(MsgT)]
  /\ dDirty   \in [Legs -> BOOLEAN]
  /\ dVal     \in [Legs -> Values \cup {NONE}]
  /\ dSettled \in [Legs -> BOOLEAN]
  /\ fired    \in 0..MaxEmits
  /\ emits    \in 0..MaxEmits
  /\ joinWitness \in (Values \cup {NONE}) \X (Values \cup {NONE})

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

Quiesced ==
  /\ \A e \in Edges : q[e] = << >>
  /\ \A l \in Legs : ~dDirty[l] /\ ~dSettled[l]

\* A starts a new wave: enqueue DIRTY then DATA(v) to B and C (FIFO order).
EmitA(v) ==
  /\ emits < MaxEmits
  /\ Quiesced
  /\ cache'   = [cache EXCEPT !["A"] = v]
  /\ nstatus' = [nstatus EXCEPT !["A"] = "settled"]
  /\ q' = [q EXCEPT ![AB] = <<Mk("DIRTY", NONE), Mk("DATA", v)>>,
                    ![AC] = <<Mk("DIRTY", NONE), Mk("DATA", v)>>]
  /\ emits'   = emits + 1
  /\ UNCHANGED <<dDirty, dVal, dSettled, fired, joinWitness>>

\* B/C relay DIRTY across the wire toward D immediately (phase 1).
RelayDirty(inEdge, node, outEdge) ==
  /\ Len(q[inEdge]) > 0
  /\ Head(q[inEdge]).t = "DIRTY"
  /\ q' = [q EXCEPT ![inEdge] = Tail(q[inEdge]),
                    ![outEdge] = Append(q[outEdge], Mk("DIRTY", NONE))]
  /\ nstatus' = [nstatus EXCEPT ![node] = "dirty"]
  /\ UNCHANGED <<cache, dDirty, dVal, dSettled, fired, emits, joinWitness>>

\* B/C relay DATA only once no DIRTY is in flight anywhere (phase 2 / two-phase).
RelayData(inEdge, node, outEdge) ==
  /\ Len(q[inEdge]) > 0
  /\ Head(q[inEdge]).t = "DATA"
  /\ ~AnyDirty
  /\ LET v == Head(q[inEdge]).v IN
       /\ cache'   = [cache EXCEPT ![node] = v]
       /\ nstatus' = [nstatus EXCEPT ![node] = "settled"]
       /\ q' = [q EXCEPT ![inEdge] = Tail(q[inEdge]),
                         ![outEdge] = Append(q[outEdge], Mk("DATA", v))]
  /\ UNCHANGED <<dDirty, dVal, dSettled, fired, emits, joinWitness>>

\* D receives DIRTY on a leg (phase 1) — marks that dep dirty.
DRecvDirty(leg, inEdge) ==
  /\ Len(q[inEdge]) > 0
  /\ Head(q[inEdge]).t = "DIRTY"
  /\ q' = [q EXCEPT ![inEdge] = Tail(q[inEdge])]
  /\ dDirty' = [dDirty EXCEPT ![leg] = TRUE]
  /\ nstatus' = [nstatus EXCEPT !["D"] = "dirty"]
  /\ UNCHANGED <<cache, dVal, dSettled, fired, emits, joinWitness>>

\* D receives DATA on a leg (phase 2). The leg MUST already be dirty
\* (DIRTY-before-DATA at D) — guaranteed because DATA only flows when no DIRTY
\* is in flight, i.e. after this leg's DIRTY was consumed.
DRecvData(leg, inEdge) ==
  /\ Len(q[inEdge]) > 0
  /\ Head(q[inEdge]).t = "DATA"
  /\ ~AnyDirty
  /\ dDirty[leg]
  /\ ~dSettled[leg]
  /\ dSettled' = [dSettled EXCEPT ![leg] = TRUE]
  /\ dVal'     = [dVal EXCEPT ![leg] = Head(q[inEdge]).v]
  /\ q' = [q EXCEPT ![inEdge] = Tail(q[inEdge])]
  /\ UNCHANGED <<cache, nstatus, dDirty, fired, emits, joinWitness>>

\* D fires exactly once both legs have settled: join, record witness, reset.
DFire ==
  /\ dSettled["B"] /\ dSettled["C"]
  /\ cache'   = [cache EXCEPT !["D"] = dVal["B"]]
  /\ nstatus' = [nstatus EXCEPT !["D"] = "settled"]
  /\ fired'   = fired + 1
  /\ joinWitness' = <<dVal["B"], dVal["C"]>>
  /\ dDirty'   = [l \in Legs |-> FALSE]
  /\ dSettled' = [l \in Legs |-> FALSE]
  /\ dVal'     = [l \in Legs |-> NONE]
  /\ UNCHANGED <<q, emits>>

Next ==
  \/ \E v \in Values : EmitA(v)
  \/ RelayDirty(AB, "B", BD)
  \/ RelayDirty(AC, "C", CD)
  \/ RelayData(AB, "B", BD)
  \/ RelayData(AC, "C", CD)
  \/ DRecvDirty("B", BD)
  \/ DRecvDirty("C", CD)
  \/ DRecvData("B", BD)
  \/ DRecvData("C", CD)
  \/ DFire

Spec == Init /\ [][Next]_vars

\* ── Invariants ──
\* D never fires more times than A has emitted — joins ONCE per wave (no glitch
\* double-fire). At quiescence fired = emits.
NoGlitchDoubleFire == fired <= emits
\* When D joins, both legs carry the same wave's value — glitch-free survival
\* across the wire (a partial/cross-leg join would diverge the pair).
DJoinCoherent == joinWitness[1] = joinWitness[2]
\* A leg is never settled (DATA received) before it was dirtied — DIRTY crosses
\* the wire ahead of DATA (two-phase preserved across domains).
DirtyBeforeDataAtD == \A l \in Legs : dSettled[l] => dDirty[l]
=============================================================================
