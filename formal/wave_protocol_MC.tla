------------------------ MODULE wave_protocol_MC ------------------------
(***************************************************************************
Model-checking entry point for `wave_protocol.tla`.

TLC's .cfg format can't express `<<p, c>>`-tuple set literals directly, so
we keep the model-specific constants (topology, alphabet, bounds) here as
operators and refer to them from `wave_protocol.cfg` via `CONSTANT _ <- _`.

Topology — 4-node diamond:
    A (source, sink)
    ├→ B (derived, identity of A)
    ├→ C (derived, identity of A)
    D (derived, shadows B; depends on {B, C}, sink)

State-space bounds: Values = {0, 1, 2}; MaxEmits = 3. ~6K distinct states,
~1 second runtime. Probed up to MaxEmits = 4 (26K states) during authoring
— raise locally for deeper confidence.
 ***************************************************************************)

EXTENDS wave_protocol

NodeIdsMC     == {"A", "B", "C", "D"}
SourceIdsMC   == {"A"}
SinkIdsMC     == {"A", "D"}
EdgesMC       == {<<"A", "B">>, <<"A", "C">>, <<"B", "D">>, <<"C", "D">>}
ValuesMC      == {0, 1, 2}
DefaultInitMC == 0
MaxEmitsMC    == 3

\* Batch-emit sequences for BatchEmitMulti — two-value coalesced batches
\* covering distinct-value and same-value cases. Bounded tightly: longer
\* sequences multiply the state space, so two canonical examples suffice
\* for invariant verification of the Bug 2 fix.
BatchSeqsMC   == { <<1, 2>>, <<0, 0>>, <<1, 1>> }

\* Clean handshake model (item 3's substrate fix would land here). D has two
\* parents so its SubscribeSink uses the clean shape. Both `StartHandshakeValid`
\* and the new `MultiDepHandshakeClean` invariants pass under this model.
GapAwareActivationMC == FALSE

\* Sink-callback nested-emit is disabled in the default model (keeps state
\* space tight). Exercised by `wave_protocol_gap_MC` + `wave_protocol_nested_MC`
\* variants.
SinkNestedEmitsMC == {}
MaxNestedEmitsMC  == 0

\* §2.6 PAUSE/RESUME + resubscribable axes (added 2026-04-23) — disabled in
\* the default model. `LockIdsMC = {}` makes the `Pause(src, lockId)` and
\* `Resume(src, lockId)` quantifiers vacuously empty, so no new transitions
\* fire and the default state space is unchanged. `Pausable` all "off"
\* AND `ResubscribableNodes = {}` double-belts-and-braces. Exercised by
\* `wave_protocol_pause_MC`, `wave_protocol_bufferall_MC`, and
\* `wave_protocol_resubscribe_MC` variants.
LockIdsMC             == {}
PausableMC            == [n \in NodeIdsMC |-> "off"]
ResubscribableNodesMC == {}
MaxPauseActionsMC     == 0

\* §1.4 `up()` upstream axis (added 2026-04-23) — disabled in the default
\* model. `UpOriginatorsMC = {}` makes the `UpPause(c, l)` / `UpResume(c, l)`
\* quantifiers vacuously empty, so no upstream-flow transitions fire and the
\* default state space is unchanged. Exercised by `wave_protocol_up_MC`.
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
