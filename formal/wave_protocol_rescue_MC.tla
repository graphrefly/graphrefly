----------------------- MODULE wave_protocol_rescue_MC -----------------------
(*****************************************************************************
Package 5 exercise MC (added 2026-04-23 batch 3 QA round 2, item 2).

Purpose: make invariant coverage for `AutoCompleteOnDepsComplete` = FALSE
load-bearing. In default MCs all nodes have `AutoCompleteOnDepsComplete = TRUE`
so the rescue / catchError branch of `DeliverTerminal` is never taken and
the D1 rescue-recompute path is unreachable.

Topology: 2-node chain A → B.
  A (source, sink)
  └→ B (derived identity of A, sink, rescue node — gated OFF for COMPLETE).

Flow: A.Emit(1), A.Terminate. B receives COMPLETE from A. With
`AutoCompleteOnDepsComplete[B] = FALSE`, B absorbs the COMPLETE and clears
p=A from its dirtyMask. Since A was B's only dep, newMask = {} triggers
the D1 rescue recompute — B emits its recovery value (Compute(B, cache) =
cache[A]'s current value) via DATA or RESOLVED. B stays "settled" across
the terminal boundary.

State-space bounds: 2 nodes, 2 values, MaxEmits = 2 — keeps exploration
tight. Probed during authoring. All invariants hold under the shipped
Package 5 + D1 fix.

Verification note: reverting the D1 recompute path in DeliverTerminal
(restoring the original "absorb only, no recompute" ELSE branch) leaves
B stuck dirty after COMPLETE absorption — `BalancedWaves` trips (DIRTY
count > settlement count at B).
*****************************************************************************)

EXTENDS wave_protocol

NodeIdsMC     == {"A", "B"}
SourceIdsMC   == {"A"}
SinkIdsMC     == {"A", "B"}
EdgesMC       == {<<"A", "B">>}
ValuesMC      == {0, 1}
DefaultInitMC == 0
MaxEmitsMC    == 2

BatchSeqsMC   == {}

GapAwareActivationMC == FALSE

SinkNestedEmitsMC == {}
MaxNestedEmitsMC  == 0

LockIdsMC             == {}
PausableMC            == [n \in NodeIdsMC |-> "off"]
ResubscribableNodesMC == {}
MaxPauseActionsMC     == 0

UpOriginatorsMC   == {}
MaxUpActionsMC    == 0

ExtraSinksMC      == [n \in NodeIdsMC |-> 0]

ResetOnTeardownNodesMC == NodeIdsMC \ SourceIdsMC

\* Package 5 axis ON for B: rescue / catchError semantic — absorb parent's
\* COMPLETE/ERROR instead of cascading. Exercises the D1 rescue recompute.
AutoCompleteOnDepsCompleteMC == [n \in NodeIdsMC |-> IF n = "B" THEN FALSE ELSE TRUE]
AutoErrorOnDepsErrorMC       == [n \in NodeIdsMC |-> IF n = "B" THEN FALSE ELSE TRUE]

ReplayBufferSizeMC == [n \in NodeIdsMC |-> 0]
EqualsPairsMC    == [n \in NodeIdsMC |-> {<<v, v>> : v \in ValuesMC}]

MetaCompanionsMC == [n \in NodeIdsMC |-> {}]
MaxTeardownsMC   == 0

InvalidateOriginatorsMC == {}
MaxInvalidatesMC        == 0
==============================================================================
