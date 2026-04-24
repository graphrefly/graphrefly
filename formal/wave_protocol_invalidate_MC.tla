---------------------- MODULE wave_protocol_invalidate_MC ----------------------
(*****************************************************************************
Package 6 exercise MC (added 2026-04-23 batch 3 QA round 2, item 2).

Purpose: make `CleanupWitnessInValueDomain` (#19) load-bearing. Default
MCs have `InvalidateOriginators = {}` so `Invalidate` / `DeliverInvalidate`
never fire and the cleanup-witness-pre-reset contract is unexercised.

Topology: 3-node chain A → B → C (next-batch extension 2026-04-23).
  A (source, sink, can originate Invalidate)
  └→ B (derived identity of A, sink)
      └→ C (derived identity of B per Compute("C", ...), sink)

Flow: A.Emit(1) advances cache[A]. Invalidate(A) records cache[A] = 1 to
`cleanupWitness[A]`, resets cache[A] = 0, enqueues INVALIDATE to B.
DeliverInvalidate(A, B) consumes INVALIDATE, records cache[B], resets
cache[B], enqueues INVALIDATE to C (full cascade). DeliverInvalidate(B, C)
consumes, records cache[C], resets cache[C] — full subgraph reset.

The invariant `CleanupWitnessInValueDomain` verifies every entry is in
`Values` (not a post-reset sentinel) at every hop of the cascade.
Additionally, the tier-1 ordering guard `NoInvalidateAnywhere` on
`DeliverSettle` ensures INVALIDATE drains before any DATA/RESOLVED
propagation (tier-1 precedence per spec §1.4).

State-space bounds: 3 nodes, 2 values, MaxEmits = 1, MaxInvalidates = 1.
*****************************************************************************)

EXTENDS wave_protocol

NodeIdsMC     == {"A", "B", "C"}
SourceIdsMC   == {"A"}
SinkIdsMC     == {"A", "B", "C"}
EdgesMC       == {<<"A", "B">>, <<"B", "C">>}
ValuesMC      == {0, 1}
DefaultInitMC == 0
MaxEmitsMC    == 1

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

AutoCompleteOnDepsCompleteMC == [n \in NodeIdsMC |-> TRUE]
AutoErrorOnDepsErrorMC       == [n \in NodeIdsMC |-> TRUE]

ReplayBufferSizeMC == [n \in NodeIdsMC |-> 0]
EqualsPairsMC    == [n \in NodeIdsMC |-> {<<v, v>> : v \in ValuesMC}]

MetaCompanionsMC == [n \in NodeIdsMC |-> {}]
MaxTeardownsMC   == 0

\* Package 6 axis ON: A can originate Invalidate; propagates one hop to B
\* via DeliverInvalidate.
InvalidateOriginatorsMC == {"A"}
MaxInvalidatesMC        == 1
==============================================================================
