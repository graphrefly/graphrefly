---------- MODULE wave_protocol_q14_MC ----------
(*****************************************************************************
Q14 / DS-13.5.A 2026-05-07 — INVALIDATE redesign coverage MC.

Closes the deferred Q14 TLA+ + MC work from the 2026-05-02 INVALIDATE
redesign that landed in TS only (no PY parity, no TLA+). See
graphrefly-ts/docs/implementation-plan.md DS-13.5.A row Q14 for the original
ask:

    "TLA+ + fast-check coverage. Required: `Invalidate` action settles
     wave; new `InvalidateSettlesWave` invariant (counter test for the
     deadlock); `MergeRulesRespected` invariant (DATA wins / RESOLVED wins
     / INVALIDATE coalesces); update `EqualsFaithful` to confirm INVALIDATE
     bypasses substitution; fast-check single-INVALIDATE-settles +
     order-independent-merge properties."

The fast-check half is left for a separate session; this MC closes the
TLA+ half.

Topology — 4-node diamond (mirrors `wave_protocol_invalidate_diamond_MC`):
    A (source, sink, can originate Invalidate AND BatchEmitWithInv)
    ├→ B (derived, identity of A)
    ├→ C (derived, identity of A)
    D (derived, depends on {B, C}, sink, shadows B)

Tier-4 INVALIDATE properties exercised:
  - `InvalidateSettlesWave` (#29): after INVALIDATE cascade quiesces, no
    derived node has unmatched dirty bits. Counter-test: revert the
    `dirtyMask[c]` clear in `DeliverInvalidate` and TLC finds a 2-step
    counter-example at B (or C) under `Invalidate(A)`.
  - `MergeRulesRespected` (#30): no two adjacent INVALIDATEs and no
    `<<DATA|RESOLVED, INVALIDATE>>` adjacent in any queue. The
    `BatchEmitWithInv` action is the substrate — it constructs a single
    merged settle per Q1/Q3/Q9.
  - `InvalidateNotInValueDomain` (#31): structural guard that all
    INVALIDATE messages carry `NullPayload`. Catches future regressions
    that route INV through equals.
  - Pre-existing INVALIDATE invariants (#19, #24, #26) hold under the new
    auto-DIRTY-prefix wave shape.

`BatchInvSeqs` covers Q1 (EMIT before INV; INV before EMIT — DATA wins
either way), Q3 (EMIT-absorb wins), Q9 (two INVs collapse). Five
representative sequences keep the state space tractable.

Bounds: 4 nodes, 2 values, MaxEmits = 2, MaxInvalidates = 4 (allows
batch-coalesced firings to consume 2 INVs each), MaxBatchInvFires
implicit via the global counters.
*****************************************************************************)

EXTENDS wave_protocol

NodeIdsMC     == {"A", "B", "C", "D"}
SourceIdsMC   == {"A"}
SinkIdsMC     == {"A", "D"}
EdgesMC       == {<<"A", "B">>, <<"A", "C">>, <<"B", "D">>, <<"C", "D">>}
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

AutoCompleteOnDepsCompleteMC == [n \in NodeIdsMC |-> TRUE]
AutoErrorOnDepsErrorMC       == [n \in NodeIdsMC |-> TRUE]

ReplayBufferSizeMC == [n \in NodeIdsMC |-> 0]
EqualsPairsMC    == [n \in NodeIdsMC |-> {<<v, v>> : v \in ValuesMC}]

MetaCompanionsMC == [n \in NodeIdsMC |-> {}]
MaxTeardownsMC   == 0

\* Q14 axis ON: A originates both Invalidate(A) AND BatchEmitWithInv(A, ...).
\* The diamond fan-in at D exercises the cascade through both B and C, so
\* `dirtyMask[D]` clearing on the second DeliverInvalidate is load-bearing.
InvalidateOriginatorsMC == {"A"}
MaxInvalidatesMC        == 4

\* Q14 batch-coalesce sequences. Five representative shapes:
\*   Q1a: << EMIT(1), INV >>          → DATA(1) wins
\*   Q1b: << INV, EMIT(1) >>          → DATA(1) wins (order-independent)
\*   Q3:  << EMIT(0), INV >>          → RESOLVED wins (0 absorbs against DefaultInitial)
\*   Q9a: << INV, INV >>              → single INVALIDATE
\*   Q9b: << INV, INV, INV >>         → still single INVALIDATE (>2 collapse)
\*
\* Each sequence consumes its EMITs against `MaxEmits = 2` and INVs against
\* `MaxInvalidates = 4`. With 5 representative shapes plus per-fire bounds,
\* the state space is finite and the merge rules are exhaustively explored.
BatchInvSeqsMC == {
    << [kind |-> "EMIT", value |-> 1], [kind |-> "INV"] >>,
    << [kind |-> "INV"], [kind |-> "EMIT", value |-> 1] >>,
    << [kind |-> "EMIT", value |-> 0], [kind |-> "INV"] >>,
    << [kind |-> "INV"], [kind |-> "INV"] >>,
    << [kind |-> "INV"], [kind |-> "INV"], [kind |-> "INV"] >>
}
==============================================================================
