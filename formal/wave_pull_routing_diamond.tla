------------------- MODULE wave_pull_routing_diamond -------------------
(***************************************************************************
GraphReFly -- routed PULL demand over a diamond (D63 / B47, revised by D269).

Topology:

          G1
        /    \
      D       SNAP(holds P)
        \    /
          G2

D broadcasts PULL(P). Both G1 and G2 may forward the same demand to SNAP.
The rule pinned here: a pullId-holder fires at most once per routed control wave.
Duplicate same-wave arrivals are consumed silently.
 ***************************************************************************)
EXTENDS Naturals, FiniteSets, TLC

Nodes == {"D","G1","G2","SNAP"}
PullIds == {"P"}
NONE == "NONE"

Deps == [D |-> {"G1","G2"}, G1 |-> {"SNAP"}, G2 |-> {"SNAP"}, SNAP |-> {}]
Holds == [D |-> NONE, G1 |-> NONE, G2 |-> NONE, SNAP |-> "P"]

VARIABLES inflight, fired, fireCount, dropped

vars == <<inflight, fired, fireCount, dropped>>

TypeOK ==
  /\ inflight \in [Nodes -> SUBSET PullIds]
  /\ fired \in SUBSET Nodes
  /\ fireCount \in [Nodes -> Nat]
  /\ dropped \in Nat

Init ==
  /\ inflight = [n \in Nodes |-> IF n = "D" THEN {"P"} ELSE {}]
  /\ fired = {}
  /\ fireCount = [n \in Nodes |-> 0]
  /\ dropped = 0

Step(n, t) ==
  /\ t \in inflight[n]
  /\ IF Holds[n] = t
       THEN /\ inflight' = [inflight EXCEPT ![n] = @ \ {t}]
            /\ fired' = fired \cup {n}
            /\ fireCount' =
                 IF n \in fired THEN fireCount
                 ELSE [fireCount EXCEPT ![n] = @ + 1]
            /\ dropped' = dropped
       ELSE IF Deps[n] # {}
         THEN /\ inflight' = [m \in Nodes |->
                                IF m \in Deps[n] THEN inflight[m] \cup {t}
                                ELSE IF m = n THEN inflight[n] \ {t}
                                ELSE inflight[m]]
              /\ UNCHANGED <<fired, fireCount, dropped>>
         ELSE /\ inflight' = [inflight EXCEPT ![n] = @ \ {t}]
              /\ dropped' = dropped + 1
              /\ UNCHANGED <<fired, fireCount>>

Quiescent == \A n \in Nodes : inflight[n] = {}
Next == (\E n \in Nodes, t \in PullIds : Step(n, t)) \/ (Quiescent /\ UNCHANGED vars)
Spec == Init /\ [][Next]_vars

DemandHolderFiresOnce == fireCount["SNAP"] <= 1
OnlyHolderFires == \A n \in Nodes : fireCount[n] > 0 => Holds[n] = "P"
DemandReachesHolder == Quiescent => "SNAP" \in fired
=============================================================================
