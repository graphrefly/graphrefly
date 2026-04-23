----------------------- MODULE wave_protocol_bufferall_MC -----------------------
(***************************************************************************
Model-checking entry point for `wave_protocol.tla` with bufferAll mode
enabled — `Pausable[n] = "resumeAll"` for every node.

Topology: 3-node linear chain — A (source) → B (derived) → C (derived, sink).
Narrower than the diamond for state-space economy; bufferAll semantics are
edge-local, so the linear topology exercises the capture-and-drain path
without the diamond's combinatorial explosion.

What this MC exercises:
  - bufferAll capture: while A holds a pause lock, its outgoing tier-3
    settlements (DATA/RESOLVED) are captured into `pauseBuffer[A]` instead
    of being enqueued to <<A, B>>. DIRTY still flows immediately (tier-1
    is always synchronous).
  - On final-lock `Resume(A, l)`: `pauseBuffer[A]` is drained to <<A, B>>
    in arrival order, then the [RESUME, l] message is enqueued. Per-edge
    FIFO guarantees B sees the buffered settlements BEFORE the RESUME.
  - Transitive bufferAll: B and C also have Pausable = "resumeAll". When
    PAUSE propagates via DeliverPauseResume to B, B's lockSet becomes
    non-empty, and B's own outgoing settlements (from recomputes) get
    captured into `pauseBuffer[B]` until B receives the final RESUME.
  - `BufferImpliesLockedAndResumeAll` catches any regression where a
    pausable="on" or "off" node accidentally buffers.
  - `BufferHoldsOnlyDeferredTiers` catches any regression where DIRTY or
    PAUSE/RESUME leaks into the buffer (should dispatch synchronously).

What this MC deliberately skips:
  - Multi-pauser — single lock id keeps focus on replay ordering.
  - Diamond fan-in — unrelated to bufferAll; would multiply states.
  - Batches / nested emits / gap-aware / resubscribe — orthogonal axes.

Expected outcome: all invariants hold, including the four new pause-axis
invariants.
 ***************************************************************************)

EXTENDS wave_protocol

\* Linear 3-node chain. Override `Compute` inherited from `wave_protocol`:
\* the default only specializes B/C/D to 4-node diamond shapes — here we
\* want B and C to be simple identity derives so the state space stays
\* small. We accept the inherited Compute (C is not in the default clause,
\* so it falls to OTHER → cch["C"], which for a settled derived gets
\* overwritten by DeliverSettle's explicit recompute — effectively
\* identity via the bitmask-clean path). B's default is cch["A"] —
\* identity. Good.
NodeIdsMC     == {"A", "B", "C"}
SourceIdsMC   == {"A"}
SinkIdsMC     == {"A", "C"}
EdgesMC       == {<<"A", "B">>, <<"B", "C">>}
ValuesMC      == {0, 1}
DefaultInitMC == 0
MaxEmitsMC    == 2

BatchSeqsMC          == {}
GapAwareActivationMC == FALSE
SinkNestedEmitsMC    == {}
MaxNestedEmitsMC     == 0

\* bufferAll on every node — the whole chain participates in capture +
\* drain. Single lock id keeps the state space tight; multi-pauser is
\* exercised by `wave_protocol_pause_MC`.
\*
\* LockIds are integers chosen outside `Values` so `PayloadDomain` stays
\* integer-homogeneous for TLC fingerprinting (see pause_MC comment).
LockIdsMC             == {10}
PausableMC            == [n \in NodeIdsMC |-> "resumeAll"]
ResubscribableNodesMC == {}
MaxPauseActionsMC     == 2

============================================================================
