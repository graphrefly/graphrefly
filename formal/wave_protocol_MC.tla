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

============================================================================
