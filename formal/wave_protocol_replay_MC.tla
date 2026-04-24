------------------------ MODULE wave_protocol_replay_MC ------------------------
(*****************************************************************************
Package 3 exercise MC (added 2026-04-23 batch 3 QA round 2, item 2).

Purpose: make `ReplayBufferBounded` (#20) load-bearing. Default MCs have
`ReplayBufferSize = [n |-> 0]` so the ring never fills.

Topology: 2-node chain A → B with A carrying a replay ring of size 2.
  A (source, sink, ReplayBufferSize[A] = 2) — fills ring across emits.
  B (derived identity of A, sink) — downstream sanity.

`BatchSeqs = { <<1, 0>> }` + `MaxEmits = 3` — multiple DATA-producing
emits stress the drop-oldest-on-cap logic. After 3 DATA emits at A, the
ring must still be bounded to 2. The invariant `ReplayBufferBounded`
enforces it.

Equality axis: `EqualsPairs[n]` kept at identity diagonal everywhere in
this MC (the legacy `EqualsAbsorbs[n] = TRUE` behavior) so
RESOLVED-absorbing semantics stay normal. The `equals` variance
dimension is probed separately by `wave_protocol_equals_false_MC` (empty
relation) and `wave_protocol_custom_equals_MC` (non-identity subset,
batch 9 E) — cross-axis replay × equals is a follow-on if needed.

State-space bounds: 2 nodes, 2 values, MaxEmits = 3. Kept tight.
*****************************************************************************)

EXTENDS wave_protocol

NodeIdsMC     == {"A", "B"}
SourceIdsMC   == {"A"}
SinkIdsMC     == {"A", "B"}
EdgesMC       == {<<"A", "B">>}
ValuesMC      == {0, 1}
DefaultInitMC == 0
MaxEmitsMC    == 3

\* Exercise BatchEmitMulti too (item 1 extension added per-batch ring
\* updates).
BatchSeqsMC   == { <<1, 0>> }

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

\* Package 3 axis ON: A carries a replay ring of size 2. Multiple Emit +
\* BatchEmitMulti firings drive the ring through its drop-oldest logic.
ReplayBufferSizeMC == [n \in NodeIdsMC |-> IF n = "A" THEN 2 ELSE 0]
EqualsPairsMC    == [n \in NodeIdsMC |-> {<<v, v>> : v \in ValuesMC}]

MetaCompanionsMC == [n \in NodeIdsMC |-> {}]
MaxTeardownsMC   == 0

InvalidateOriginatorsMC == {}
MaxInvalidatesMC        == 0
==============================================================================
