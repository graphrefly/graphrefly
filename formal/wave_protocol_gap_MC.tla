------------------------ MODULE wave_protocol_gap_MC ------------------------
(***************************************************************************
Model-checking entry point for `wave_protocol.tla` in **substrate-faithful**
mode — `GapAwareActivation = TRUE`, modeling the real-world multi-parent
derived handshake the runtime synthesizes today.

Under this model:
  - `StartHandshakeValid` still holds (loosened to accept the gap-aware
    shape).
  - `MultiDepHandshakeClean` FAILS — TLC produces a counter-example trace
    showing D's handshake contains a RESOLVED between the first DIRTY and
    the DATA. This counter-example is the TLA+ mirror of fast-check
    invariant #10's failing counterexample `[0, 0]`.
  - `NestedDrainPeerConsistency` still holds (the tier ordering guarantee
    is orthogonal to handshake synthesis).

Flipping `MultiDepHandshakeClean` green in this model is the TLA+-side gate
for the substrate fix tracked under `docs/optimizations.md` "Multi-dep
push-on-subscribe ordering."

Topology: same 4-node diamond as `wave_protocol_MC`.
 ***************************************************************************)

EXTENDS wave_protocol

NodeIdsMC     == {"A", "B", "C", "D"}
SourceIdsMC   == {"A"}
SinkIdsMC     == {"A", "D"}
EdgesMC       == {<<"A", "B">>, <<"A", "C">>, <<"B", "D">>, <<"C", "D">>}
ValuesMC      == {0, 1, 2}
DefaultInitMC == 0
MaxEmitsMC    == 3
BatchSeqsMC   == { <<1, 2>>, <<0, 0>>, <<1, 1>> }

\* The faithful substrate mode: multi-parent derived handshake synthesizes
\* the gap-aware shape `[[START], [DIRTY], [RESOLVED], [DIRTY], [DATA]]`.
GapAwareActivationMC == TRUE

\* Keep nested-emit disabled in this MC — it's a separate axis of variation
\* explored by `wave_protocol_nested_MC`.
SinkNestedEmitsMC == {}
MaxNestedEmitsMC  == 0

\* Pause axis disabled — orthogonal to the gap-aware handshake this MC
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
\* by default in existing MCs. ReplayBufferSize = 0 and EqualsPairs = identity
\* preserve prior behavior exactly.
ReplayBufferSizeMC == [n \in NodeIdsMC |-> 0]
EqualsPairsMC    == [n \in NodeIdsMC |-> {<<v, v>> : v \in ValuesMC}]

\* Package 7 (2026-04-23): meta companion TEARDOWN axis disabled in existing MCs.
MetaCompanionsMC == [n \in NodeIdsMC |-> {}]
MaxTeardownsMC   == 0
============================================================================
