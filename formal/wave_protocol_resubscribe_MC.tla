------------------------ MODULE wave_protocol_resubscribe_MC ------------------------
(***************************************************************************
Model-checking entry point for `wave_protocol.tla` with the resubscribable
lifecycle axis enabled.

Topology: 2-node chain — A (source) → B (derived, sink, RESUBSCRIBABLE).
Minimal shape that exercises:
  - A terminal propagating from source (A) to sink (B) via COMPLETE.
  - B's terminal-reset via the `Resubscribe(B)` action.
  - A fresh `SubscribeSink(B)` cycle after reset.
  - `ResubscribeYieldsCleanState` invariant asserting the post-reset
    state-level cleanliness (no leftover pauseLocks, pauseBuffer,
    dirtyMask, handshake, trace).

What this MC exercises:
  - The terminal → resubscribe → subscribe loop. `SubscribeSink(B)` fires
    initially (activated := TRUE), A emits or terminates, DeliverDirty /
    DeliverSettle / DeliverTerminal propagate, B becomes terminated.
    Then `Resubscribe(B)` resets B, and `SubscribeSink(B)` can fire again.
  - Pause interaction with resubscribe: if B was paused via a propagated
    [PAUSE, l] before A terminated, the lockset would leak into the next
    lifecycle without `Resubscribe` clearing it — exactly the leak spec
    §2.6 "Teardown" warns about. TLC explores interleavings where a PAUSE
    is in flight when A terminates, verifying the lock clears correctly
    via the Terminate / DeliverTerminal / Resubscribe paths.

What this MC deliberately skips:
  - bufferAll — B's Pausable is "on", not "resumeAll". BufferAll +
    resubscribe cross-interactions are a future MC axis.
  - Diamond fan-in — 2-node chain is enough to exercise the reset.
  - Batches / nested emits / gap-aware.

Expected outcome: all invariants hold — crucially, `ResubscribeYieldsCleanState`
is actively checked at every state where B has been resubscribed but not yet
re-subscribed.
 ***************************************************************************)

EXTENDS wave_protocol

NodeIdsMC     == {"A", "B"}
SourceIdsMC   == {"A"}
SinkIdsMC     == {"A", "B"}
EdgesMC       == {<<"A", "B">>}
ValuesMC      == {0, 1}
DefaultInitMC == 0
MaxEmitsMC    == 2

BatchSeqsMC          == {}
GapAwareActivationMC == FALSE
SinkNestedEmitsMC    == {}
MaxNestedEmitsMC     == 0

\* §2.6 pause axis enabled to exercise lock-leak-across-resubscribe scenarios.
\* Single lock id — multi-pauser axis is in `wave_protocol_pause_MC`.
\*
\* LockIds are integers chosen outside `Values` so `PayloadDomain` stays
\* integer-homogeneous for TLC fingerprinting (see pause_MC comment).
LockIdsMC             == {10}
PausableMC            == [n \in NodeIdsMC |-> "on"]
ResubscribableNodesMC == {"B"}
MaxPauseActionsMC     == 3

============================================================================
