---------- MODULE wave_protocol_custom_equals_MC ----------
(*****************************************************************************
§2.5 custom `equals` fn exercise MC (added 2026-04-24 batch 9, E).

Purpose: exercise a NON-TRIVIAL `EqualsPairs[n]` — neither identity
diagonal (default absorb-same-value) nor empty (absorb-nothing). The
relation models a custom `equals: (prev, next) => prev === next ||
(prev === 0 && next === 1) || (prev === 1 && next === 0)` fn at A: the
values 0 and 1 are interchangeable; 2 is distinct. Pre-batch-9 the
`EqualsAbsorbs` boolean axis could NOT express this — you got all-absorb
or never-absorb, nothing in between. The `EqualsPairs: NodeIds ->
SUBSET (Values \X Values)` generalization unlocks arbitrary relations.

Coverage this MC makes load-bearing:
  - `Emit` absorption of `0 -> 1` and `1 -> 0` as RESOLVED (cache frozen)
    — exercising a code path that pre-batch-9 would only fire under
    byte-identical inputs.
  - `BatchEmitMulti` absorption of a <<0, 1>> bundle step: first `0` is
    a strict-absorb, second `1` is a custom-absorb because running cache
    is 0. Exercises `BuildSettleSeq` / `FinalCache` / `CountDataEmits`
    calling into `IsAbsorbed` with non-identity arguments — pre-batch-9
    these helpers used raw `=` which would have forced DATA here.
  - `DeliverSettle` at B: even though B uses default identity relation,
    B's `newCache = Compute(B, cache)` input is cache[A]; when A's cache
    oscillates between 0 and 1 AND 2, B's recompute sees genuine cache
    changes at the `cache[A] = 2` step but the `0 -> 1` A-side absorbs
    never propagate downstream at all (they're RESOLVED at A), so B's
    DATA rate tracks the NON-absorbed A emits.
  - `EqualsFaithful` (#5) still holds under custom absorption:
    settlement count at A equals `perSourceEmitCount[A]` regardless of
    the mix of RESOLVED (absorbed) vs DATA (not absorbed). A regression
    that dropped the `EqualsPairs` check in any emission site would
    skew the count one direction or the other and trip the invariant.

Topology: 2-node chain A → B, matching `replay_MC` / `equals_false_MC`
shape.

Values: {0, 1, 2} — three-element alphabet is the minimum that lets the
absorption relation be non-trivial (not identity, not empty, not
universal). Adding a fourth value would inflate state space without
adding semantic coverage.

State-space bounds: 2 nodes, 3 values, MaxEmits = 3. BatchSeqs include
cross-absorbing pairs <<0, 1>> and <<1, 0>> so `BatchEmitMulti`'s
running-cache absorption threading is exercised.
*****************************************************************************)

EXTENDS wave_protocol

NodeIdsMC     == {"A", "B"}
SourceIdsMC   == {"A"}
SinkIdsMC     == {"A", "B"}
EdgesMC       == {<<"A", "B">>}
ValuesMC      == {0, 1, 2}
DefaultInitMC == 0
MaxEmitsMC    == 3

BatchSeqsMC   == { <<0, 1>>, <<1, 0>>, <<2, 0>> }

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

\* Batch 9 (2026-04-24, E): custom equality at A — 0 and 1 absorb each
\* other; 2 is strictly distinct. B keeps the default identity diagonal so
\* downstream absorption is orthogonal to the custom A-side variance.
EqualsPairsMC == [n \in NodeIdsMC |->
                    IF n = "A"
                      THEN {<<v, v>> : v \in ValuesMC}
                             \cup {<<0, 1>>, <<1, 0>>}
                      ELSE {<<v, v>> : v \in ValuesMC}]

MetaCompanionsMC == [n \in NodeIdsMC |-> {}]
MaxTeardownsMC   == 0

InvalidateOriginatorsMC == {}
MaxInvalidatesMC        == 0
==============================================================================
