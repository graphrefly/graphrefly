----------------------- MODULE wave_pull_routing -----------------------
(***************************************************************************
GraphReFly -- PULL-routed demand routing (R-up-routing, R-pull, D269).

A DEMAND is a PULL carrying pullId plus optional params, issued by a downstream
node WITHOUT a reference to the target (a reference would be the .cache
anti-pattern). _up routes it DEMAND-IF-PULL-HOLDER-ELSE-FORWARD-UP: a node
HOLDING the pullId fires and does NOT forward further up; a non-holder FORWARDS
the PULL up its declared deps to find the holder; a depless source that does
not hold it DROPS (terminus). The pullId disambiguates siblings (two pull
sources up one branch). Params do not affect routing and are modeled in
wave_pull.tla.

Topology (fixed; the F/H sibling case from the design session):
    F(holds PF)   H(holds PH)     F,H = pull sources (depless leaves)
         \         /
          \       /
            G                     G = non-pull intermediate; deps {F,H}
            |
            D                     D = demander; deps {G}; injects PULL(Target)

Target = the demanded pullId (CONSTANT; "PF" -> holder F, "PH" -> holder H).

This module models the ROUTING (R-up-routing); the per-node DELIVERY semantics
(quiet / absorb-DIRTY / fire-once / re-quiet, NoWedgeWhileQuiet /
OneDeliveryPerDemand) stay in wave_pull.tla and are unchanged by D59.

Status: active (C-16 routing facets ts:pass + D59 impl landed 2026-05-31; both invariants
  mutation-verified). NOTE: this models a strict TREE; a broadcast routed PULL over a DIAMOND
  (holder reachable via 2+ paths) invokes the holder once per path in the impl -- harmless today
  (the 2nd is silent → net 1 delivery) but unmodeled here; see backlog B47.
Configs: wave_pull_routing.cfg (Target="PF"), wave_pull_routing_sib.cfg (Target="PH").
 ***************************************************************************)
EXTENDS Naturals, FiniteSets, TLC

CONSTANT Target   \* the demanded pullId: "PF" or "PH"

Nodes   == {"D","G","F","H"}
PullIds == {"PF","PH"}
NONE    == "NONE"

\* declared deps (upstream edges): n -> set of its deps
Deps  == [ D |-> {"G"}, G |-> {"F","H"}, F |-> {}, H |-> {} ]
\* the pullId each node self-holds as its quiet/demand lock (NONE = not a pull node)
Holds == [ D |-> NONE, G |-> NONE, F |-> "PF", H |-> "PH" ]

Holder == IF Target = "PF" THEN "F" ELSE "H"

VARIABLES
  inflight,   \* [Nodes -> SUBSET PullIds] : PULL(pullId) pulses queued AT each node
  fired,      \* SUBSET Nodes : nodes that released-and-fired for the demand
  dropped     \* Nat : forwarded RESUMEs that hit a depless terminus unheld

vars == <<inflight, fired, dropped>>

TypeOK ==
  /\ inflight \in [Nodes -> SUBSET PullIds]
  /\ fired \in SUBSET Nodes
  /\ dropped \in Nat

Init ==
  /\ inflight = [n \in Nodes |-> IF n = "D" THEN {Target} ELSE {}]
  /\ fired = {}
  /\ dropped = 0

\* Process one queued PULL(t) at node n: DEMAND-IF-PULL-HOLDER-ELSE-FORWARD-UP.
Step(n, t) ==
  /\ t \in inflight[n]
  /\ IF Holds[n] = t
       \* HOLDER: release + FIRE, consume; do NOT forward further up (stops here).
       THEN /\ fired'    = fired \cup {n}
            /\ inflight' = [inflight EXCEPT ![n] = @ \ {t}]
            /\ dropped'  = dropped
       ELSE IF Deps[n] # {}
         \* non-holder WITH deps: FORWARD up to every dep, consume own copy.
         THEN /\ inflight' = [ m \in Nodes |->
                                IF m \in Deps[n] THEN inflight[m] \cup {t}
                                ELSE IF m = n     THEN inflight[n] \ {t}
                                ELSE inflight[m] ]
              /\ fired'   = fired
              /\ dropped' = dropped
         \* non-holder depless SOURCE: DROP at the terminus.
         ELSE /\ inflight' = [inflight EXCEPT ![n] = @ \ {t}]
              /\ dropped'  = dropped + 1
              /\ fired'    = fired

Quiescent   == \A n \in Nodes : inflight[n] = {}
Terminating == Quiescent /\ UNCHANGED vars   \* stutter at quiescence (no spurious deadlock)

Next == (\E n \in Nodes, t \in PullIds : Step(n, t)) \/ Terminating
Spec == Init /\ [][Next]_vars

\* ── Invariants ──
\* DisambiguatesSiblings: ONLY a node holding the demanded pullId ever fires -- a
\* sibling pull node (different pullId) never mis-fires for this demand.
\* [Mutation: a non-holder that FIRES instead of forwarding -> this trips.]
DisambiguatesSiblings == \A n \in fired : Holds[n] = Target
\* OneDeliveryRouted: unique pullIds => at most one holder fires per demand.
OneDeliveryRouted == Cardinality(fired) <= 1
\* RoutedPullReachesHolder: once routing settles (no PULL in flight), the
\* demanded pullId's HOLDER has fired -- the PULL reached it up the declared cone
\* WITHOUT a node reference. [Mutation: a holder that drops/forwards-without-firing,
\* or an intermediate that fails to forward -> Holder never fires -> this trips.]
RoutedPullReachesHolder == Quiescent => (Holder \in fired)
=============================================================================
