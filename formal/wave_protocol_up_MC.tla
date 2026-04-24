------------------------- MODULE wave_protocol_up_MC -------------------------
(*****************************************************************************
§1.4 `up()` upstream-direction axis (added 2026-04-23).

Topology: 2-node chain A → B.
  A (source, sink)
  └→ B (derived identity of A, sink)

UpOriginators = {B}: the sink at B can originate upstream PAUSE/RESUME
against its parent A via `up()`. Pausable is "on" everywhere so A tracks
locks; UpPause propagates to pauseLocks[A] via `DeliverUp(B, A)`.

State-space bounds: tiny (2 nodes, 2 values, MaxEmits = 2, MaxUpActions = 2,
LockIds = {10}). Purpose is structural coverage of the new up-axis actions
(UpPause, UpResume, DeliverUp), not deep combinatorial exploration — the
pause-axis interleaving proof already landed in `wave_protocol_pause_MC`.

What this MC buys: the three new up-axis invariants (UpQueuesCarryControlPlane,
UpPauseOriginatorBound, PausableOffStructural) are exercised with non-vacuous
upstream traffic, and the existing 13 invariants keep holding when upstream
PAUSE/RESUME compose with the downstream-origin model.
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

\* LockIds are integers chosen outside `Values` so `PayloadDomain` stays
\* integer-homogeneous for TLC fingerprinting (see pause_MC comment).
LockIdsMC             == {10}
PausableMC            == [n \in NodeIdsMC |-> "on"]
ResubscribableNodesMC == {}
MaxPauseActionsMC     == 2

\* §1.4 up-axis enabled — B originates upstream PAUSE/RESUME.
UpOriginatorsMC   == {"B"}
MaxUpActionsMC    == 2


\* §2.4 multi-sink iteration axis disabled — single-sink semantics preserved.
ExtraSinksMC      == [n \in NodeIdsMC |-> 0]

\* Package 4 (2026-04-23): preserve existing "reset all derived" semantics
\* — sources keep cache, derived clear. Flip to `{}` for a preserve-all MC.
ResetOnTeardownNodesMC == NodeIdsMC \ SourceIdsMC

\* Package 6 (2026-04-23): INVALIDATE axis disabled in existing MCs.
InvalidateOriginatorsMC == {}
MaxInvalidatesMC        == 0

\* Package 5 (2026-04-23): auto-terminal gating — all nodes default TRUE
\* so existing MCs preserve prior "any dep terminal cascades" behavior.
AutoCompleteOnDepsCompleteMC == [n \in NodeIdsMC |-> TRUE]
AutoErrorOnDepsErrorMC       == [n \in NodeIdsMC |-> TRUE]

\* Package 3 (2026-04-23): replayBuffer + equals variance axes disabled
\* by default in existing MCs. ReplayBufferSize = 0 and EqualsAbsorbs = TRUE
\* preserve prior behavior exactly.
ReplayBufferSizeMC == [n \in NodeIdsMC |-> 0]
EqualsAbsorbsMC    == [n \in NodeIdsMC |-> TRUE]

\* Package 7 (2026-04-23): meta companion TEARDOWN axis disabled in existing MCs.
MetaCompanionsMC == [n \in NodeIdsMC |-> {}]
MaxTeardownsMC   == 0
==============================================================================
