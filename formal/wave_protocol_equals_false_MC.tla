---------- MODULE wave_protocol_equals_false_MC ----------
(*****************************************************************************
Package 3 equality-variance exercise MC (added 2026-04-23 batch 6, F).

Purpose: make the `EqualsAbsorbs[n] = FALSE` axis load-bearing. Batch 3
Package 3 shipped the `EqualsAbsorbs: NodeIds -> BOOLEAN` constant that
parameterizes `Emit` / `BatchEmitMulti` / `SinkNestedEmit` / `DeliverSettle`
equality checks — `FALSE` models a node with `equals: () => false` where
every emit produces DATA (never RESOLVED), even when the value is
byte-identical to the cached one. No existing MC flipped this axis: the
default `EqualsAbsorbsMC == [n \in NodeIds |-> TRUE]` meant the
absorbs-FALSE code path in `Emit` / `BatchEmitMulti` / `SinkNestedEmit`
was entirely unexercised.

Interaction of interest: `EqualsFaithful` (#5) counts settlements against
`perSourceEmitCount[s]` — with `EqualsAbsorbs[A] = FALSE`, every Emit
produces DATA (no RESOLVED), so each emit appends one DATA to `trace[A]`
and the invariant still holds by a different semantic path. Cache
advances on every emit (because `isEq` is forced FALSE), which means the
`replayBuffer` fills faster and `VersionPerChange` counts every emit as
a version bump. `DiamondConvergence` bounds still hold (one settlement
per source emit).

Topology: minimal 2-node chain A → B (matches `replay_MC`). Small value
alphabet {0, 1} so even with `EqualsAbsorbs[A] = FALSE` the state space
stays tight.

This MC is the regression guard for the `equals: () => false` code path:
a future refactor that drops the `EqualsAbsorbs[n]` check (e.g. always
running the equality comparison unconditionally) would produce RESOLVED
where DATA is required — tripping `EqualsFaithful` with a concrete
counter-example trace here.

State-space bounds: 2 nodes, 2 values, MaxEmits = 3.
*****************************************************************************)

EXTENDS wave_protocol

NodeIdsMC     == {"A", "B"}
SourceIdsMC   == {"A"}
SinkIdsMC     == {"A", "B"}
EdgesMC       == {<<"A", "B">>}
ValuesMC      == {0, 1}
DefaultInitMC == 0
MaxEmitsMC    == 3

BatchSeqsMC   == { <<0, 0>>, <<1, 1>> }

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

\* Package 3 axis: keep replayBuffer off here so this MC is a clean probe
\* of the equals-variance path alone. A combined equals-false × replayBuffer
\* cross-axis MC is tracked as a follow-on if a §32-class interaction
\* surfaces; this MC isolates the equals-FALSE structural effect.
ReplayBufferSizeMC == [n \in NodeIdsMC |-> 0]

\* Package 3 axis ON for the source. Every Emit / BatchEmitMulti at A now
\* produces DATA (never RESOLVED) — same-value repeats no longer absorb.
\* B keeps default TRUE so the derived side exercises the default path.
EqualsAbsorbsMC == [n \in NodeIdsMC |-> IF n = "A" THEN FALSE ELSE TRUE]

MetaCompanionsMC == [n \in NodeIdsMC |-> {}]
MaxTeardownsMC   == 0

InvalidateOriginatorsMC == {}
MaxInvalidatesMC        == 0
==============================================================================
