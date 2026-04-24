--------------------- MODULE wave_protocol_multisink_MC ---------------------
(*****************************************************************************
§2.4 multi-sink iteration axis (added 2026-04-23).

Topology: 2-node chain A → B.
  A (source, sink)
  └→ B (derived identity of A, sink) — carries the primary sink PLUS one
     extra external subscriber (so two observers total at B).

ExtraSinks[B] = 1. Every emission that writes to `trace[B]` also enqueues
the same payload to `pendingExtraDelivery[B][1]`; the new `DeliverToExtraSink`
action pops pending entries one at a time and appends to `extraSinkTrace[B][1]`.

SinkNestedEmits = { <<A, A, 1>> } — A's own sink callback triggers a nested
batch(() => A.emit(1)). TLC interleaves SinkNestedEmit with Emit / DeliverSettle
/ DeliverToExtraSink; the §32 bug class manifests when a nested emit advances
cache[B] (via A → B propagation) while a DATA payload for B's extra sink is
still pending in `pendingExtraDelivery[B][1]`. `MultiSinkIterationCoherent`
traps that disagreement structurally.

State-space bounds: 2 nodes, 2 values, MaxEmits = 2, MaxNestedEmits = 1 —
keeps the nested-interleaved space tractable while the multi-sink axis is the
freshly-added variable dimension. Probed during authoring for runtime; adjust
MaxEmits / MaxNestedEmits locally for deeper probes.

What this MC buys that nothing else does: TLC enumerates every interleaving of
(a) primary sink delivery, (b) nested-emit-from-primary-callback, and (c)
DeliverToExtraSink — catching §32-class peer-read bugs systematically via
state-space enumeration rather than via a hand-coded counterexample.
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

\* A's sink callback triggers a nested batch(() => A.emit(1)). Because A is
\* itself the source, this models the runtime scenario where a subscriber
\* callback at A re-drives A, whose propagation reaches B and advances cache[B]
\* mid-iteration of B's sinks list. The §32 window.
SinkNestedEmitsMC == { <<"A", "A", 1>> }
MaxNestedEmitsMC  == 1

\* Pause axis disabled — orthogonal to multi-sink.
LockIdsMC             == {}
PausableMC            == [n \in NodeIdsMC |-> "off"]
ResubscribableNodesMC == {}
MaxPauseActionsMC     == 0

\* §1.4 up-axis disabled.
UpOriginatorsMC   == {}
MaxUpActionsMC    == 0

\* §2.4 multi-sink iteration axis enabled — B carries one extra observer
\* beyond the primary sink.
ExtraSinksMC      == [n \in NodeIdsMC |-> IF n = "B" THEN 1 ELSE 0]

==============================================================================
