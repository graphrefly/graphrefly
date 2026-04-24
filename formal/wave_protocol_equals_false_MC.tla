---------- MODULE wave_protocol_equals_false_MC ----------
(*****************************************************************************
Package 3 equality-variance exercise MC (added 2026-04-23 batch 6, F).

Purpose: make the empty-`EqualsPairs[n]` axis load-bearing (the `equals:
() => false` case). Shipped originally in batch 3 Package 3 as the
boolean `EqualsAbsorbs: NodeIds -> BOOLEAN` constant (FALSE = never
absorb); batch 9 E generalized to `EqualsPairs: NodeIds -> SUBSET (Values
\X Values)` where `{}` is the equivalent of the legacy `FALSE`. Batch 6
F added this MC because no prior MC exercised the absorbs-FALSE code
path — the default identity-diagonal relation left the never-absorb
branches in `Emit` / `BatchEmitMulti` / `SinkNestedEmit` / `DeliverSettle`
entirely unexercised.

Interaction of interest: `EqualsFaithful` (#5) counts settlements against
`perSourceEmitCount[s]` — with `EqualsPairs[A] = {}`, every Emit
produces DATA (no RESOLVED), so each emit appends one DATA to `trace[A]`
and the invariant still holds by a different semantic path. Cache
advances on every emit (because `IsAbsorbed` is forced FALSE), which
means the `replayBuffer` fills faster and `VersionPerChange` counts
every emit as a version bump. `DiamondConvergence` bounds still hold
(one settlement per source emit).

Topology: minimal 2-node chain A → B (matches `replay_MC`). Small value
alphabet {0, 1} so even with `EqualsPairs[A] = {}` the state space stays
tight.

This MC is the regression guard for the `equals: () => false` code path:
a future refactor that drops the `IsAbsorbed` threading (e.g. reverts
to raw `=` at any of the four emission sites) would produce RESOLVED
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
EqualsPairsMC == [n \in NodeIdsMC |-> IF n = "A" THEN {} ELSE {<<v, v>> : v \in ValuesMC}]

MetaCompanionsMC == [n \in NodeIdsMC |-> {}]
MaxTeardownsMC   == 0

InvalidateOriginatorsMC == {}
MaxInvalidatesMC        == 0
==============================================================================
