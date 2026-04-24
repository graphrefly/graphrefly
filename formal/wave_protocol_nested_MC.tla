----------------------- MODULE wave_protocol_nested_MC -----------------------
(***************************************************************************
Model-checking entry point for `wave_protocol.tla` with **sink-callback
nested emit** enabled — exercises the action class behind
COMPOSITION-GUIDE §32 "Nested-drain state-mirror pattern" and
docs/optimizations.md "Nested-drain wave-ordering."

Topology: 3-node diamond fit for the nested-drain repro.
    A (source)
    B (source, also a sink/observer via SinkNestedEmits)
    T = derived([A, B])

`SinkNestedEmits = {<<B, A, 2>>}`: when the observer B has received a DATA,
the action `SinkNestedEmit(B, A, 2)` is enabled and fires a nested wave on
A. Models the callback pattern `effect([B], ([b]) => batch(() => A.emit(2)))`.

Expected outcome: `NestedDrainPeerConsistency` still holds because the
substrate's tier ordering (DIRTY drains before any DATA fires, enforced by
`NoDirtyAnywhere` on `DeliverSettle`) prevents T from recomputing with a
stale peer. TLC exhaustively explores every interleaving of the nested
emission with the outer-wave delivery and confirms no counter-example. If a
future substrate change (e.g. an `_emit` defer that bypasses tier ordering)
introduces the §32 bug, this invariant trips.

This MC is the **regression guard** for simple-topology nested drains.
Compound-topology repros (switchMap-shaped dep re-wire) require operator-
level modeling and live as a separate deferred extension.
 ***************************************************************************)

EXTENDS wave_protocol

\* 3-node topology: T has two independent sources A and B.
\*   T = Compute over [A, B]. Per wave_protocol.Compute, only "D" has a
\*   meaningful override; we name T as "D" to inherit that override.
\*   D (= T) is defined to shadow B — a concrete fn matching the §32 setup
\*   where a peer-read glitch would manifest as D emitting with a stale B.
NodeIdsMC     == {"A", "B", "D"}
SourceIdsMC   == {"A", "B"}
SinkIdsMC     == {"B", "D"}
EdgesMC       == {<<"A", "D">>, <<"B", "D">>}
ValuesMC      == {0, 1, 2}
DefaultInitMC == 0
MaxEmitsMC    == 3

\* Batch-emit stays disabled here — the nested-emit action is what we want
\* TLC to explore. Leave `BatchSeqs` non-empty with minimal content so the
\* `BatchEmitMulti` action still has a way to fire (the invariants should
\* hold under both batched and unbatched emit paths).
BatchSeqsMC   == { <<1>>, <<0, 0>> }

\* Keep GapAwareActivation FALSE so this MC isolates the nested-drain axis
\* from the multi-dep handshake axis. The two can be combined in a third MC
\* if cross-interaction becomes a concern.
GapAwareActivationMC == FALSE

\* Sink-callback nested-emit enabled: observer B, target A, value 2.
\* One triple gives TLC a concrete action to fire; the interesting
\* exploration is which DeliverDirty / DeliverSettle step happens between
\* B's outer wave and A's nested wave at D's dep queues.
SinkNestedEmitsMC == { <<"B", "A", 2>> }
MaxNestedEmitsMC  == 2

\* Pause axis disabled — orthogonal to the nested-drain axis this MC
\* isolates. Combining axes is a future cross-axis MC.
LockIdsMC             == {}
PausableMC            == [n \in NodeIdsMC |-> "off"]
ResubscribableNodesMC == {}
MaxPauseActionsMC     == 0


\* §1.4 up() axis disabled — orthogonal to this MC's axis.
UpOriginatorsMC   == {}
MaxUpActionsMC    == 0

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
============================================================================
