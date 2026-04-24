---------- MODULE wave_protocol_invalidate_diamond_MC ----------
(*****************************************************************************
Package 6 diamond exercise MC (added 2026-04-23 batch 5, B).

Purpose: make `CleanupWitnessNonTrivial` (#24) load-bearing. The existing
`wave_protocol_invalidate_MC` is a 3-node chain (A → B → C) where every
`DeliverInvalidate` fires exactly once per node — the pre-reset witness
guard is vacuous because no node ever receives a second INVALIDATE. The
diamond topology is where the batch-4 QA deferred bug actually surfaces:
the fan-in node D receives INVALIDATE from BOTH of its parents (via B
and via C), so without the new guard the second delivery would append
the already-reset sentinel to `cleanupWitness[D]`.

Topology — 4-node diamond (mirrors `wave_protocol_MC`):
    A (source, sink, can originate Invalidate)
    ├→ B (derived, identity of A)
    ├→ C (derived, identity of A)
    D (derived, depends on {B, C}, sink)

Flow: Emit(A, v) advances cache[A] and cascades DATA/RESOLVED through
B and C to D so `cache[D]` becomes non-default. Then `Invalidate(A)`:
  1. Records cache[A] to cleanupWitness[A] (non-default), resets cache[A].
  2. Enqueues INVALIDATE to B and C.
  3. `DeliverInvalidate(A, B)` records cache[B] (non-default), resets,
     enqueues INV to D.
  4. `DeliverInvalidate(A, C)` records cache[C] (non-default), resets,
     enqueues INV to D.
  5. `DeliverInvalidate(B, D)` records cache[D] (non-default), resets.
  6. `DeliverInvalidate(C, D)` — cache[D] is NOW DefaultInitial (reset
     by step 5). Batch-5 guard: skip the witness append. Without the
     guard, this step would record DefaultInitial as a second entry at
     cleanupWitness[D] and `CleanupWitnessNonTrivial` would fail.

State-space bounds: 4 nodes, 2 values, MaxEmits = 1, MaxInvalidates = 1.
Tight enough to exhaustively enumerate the B-before-C / C-before-B
interleavings plus every `DeliverSettle` vs `DeliverInvalidate` ordering.
*****************************************************************************)

EXTENDS wave_protocol

NodeIdsMC     == {"A", "B", "C", "D"}
SourceIdsMC   == {"A"}
SinkIdsMC     == {"A", "D"}
EdgesMC       == {<<"A", "B">>, <<"A", "C">>, <<"B", "D">>, <<"C", "D">>}
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
EqualsAbsorbsMC    == [n \in NodeIdsMC |-> TRUE]

MetaCompanionsMC == [n \in NodeIdsMC |-> {}]
MaxTeardownsMC   == 0

\* Package 6 axis ON: A can originate Invalidate. Cascade fans out through
\* B and C to D; the SECOND delivery at D is where the batch-5 guard
\* becomes load-bearing.
InvalidateOriginatorsMC == {"A"}
MaxInvalidatesMC        == 1
==============================================================================
