---------------------- MODULE wave_rewire_async_ctx ----------------------
(***************************************************************************
GraphReFly -- async late ctx uses live deps after rewire (D66 / B17).
Pins R-rewire-async-live-edge; the rule statement remains in spec/rules.jsonl.

N starts async work while deps={A}; before the callback emits, N is rewired to
deps={B}. The late ctx emission routes through the live dep set, not a hidden
invocation-time snapshot.
 ***************************************************************************)
EXTENDS Naturals, FiniteSets, TLC

DepsDomain == {"A","B"}

VARIABLES deps, captured, rewired, lateEmitted, sent

vars == <<deps, captured, rewired, lateEmitted, sent>>

TypeOK ==
  /\ deps \in SUBSET DepsDomain
  /\ captured \in BOOLEAN
  /\ rewired \in BOOLEAN
  /\ lateEmitted \in BOOLEAN
  /\ sent \in [DepsDomain -> Nat]

Init ==
  /\ deps = {"A"}
  /\ captured = FALSE
  /\ rewired = FALSE
  /\ lateEmitted = FALSE
  /\ sent = [d \in DepsDomain |-> 0]

InvokeAsync ==
  /\ ~captured
  /\ captured' = TRUE
  /\ UNCHANGED <<deps, rewired, lateEmitted, sent>>

RewireToB ==
  /\ captured
  /\ ~lateEmitted
  /\ ~rewired
  /\ deps' = {"B"}
  /\ rewired' = TRUE
  /\ UNCHANGED <<captured, lateEmitted, sent>>

LateCtxEmit ==
  /\ captured
  /\ ~lateEmitted
  /\ lateEmitted' = TRUE
  /\ sent' = [d \in DepsDomain |-> IF d \in deps THEN sent[d] + 1 ELSE sent[d]]
  /\ UNCHANGED <<deps, captured, rewired>>

Next == InvokeAsync \/ RewireToB \/ LateCtxEmit \/ UNCHANGED vars
Spec == Init /\ [][Next]_vars

LateAfterRewireUsesLiveDeps ==
  (lateEmitted /\ rewired) => sent["A"] = 0 /\ sent["B"] = 1

NoHiddenSnapshotEdge ==
  lateEmitted => \A d \in DepsDomain : d \notin deps => sent[d] = 0
=============================================================================
