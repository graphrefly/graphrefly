------------------------ MODULE wave_protocol_pause_MC ------------------------
(***************************************************************************
Model-checking entry point for `wave_protocol.tla` with the §2.6 pause axis
enabled — exhaustive coverage of PAUSE/RESUME lock semantics.

Topology: 3-node linear chain — A (source) → B (derived) → C (derived,
sink). Narrower than the diamond for state-space economy: the pause-axis
invariants are per-node properties, so a linear chain exercises them
without the diamond's combinatorial explosion on PAUSE/RESUME × emit ×
4 edges × 2 lockIds. A 4-node diamond probe with these bounds produced
8M+ distinct states in 10 minutes and still had 1M+ on queue.

What this MC exercises:
  - `Pause(A, lockId)` / `Resume(A, lockId)` — lock-id-keyed set updates at
    every node on the propagation path.
  - Multi-pauser: two distinct lockIds (`l1` / `l2`) so TLC explores the
    "second-pauser-keeps-paused" window — releasing one lock does not
    resume the node while the other is still held.
  - Forward propagation via `DeliverPauseResume` — every node in the
    diamond maintains its own `pauseLocks` set, updated by the consumed
    PAUSE/RESUME from its parent edge.
  - Unknown-lockId RESUME at intermediate nodes — when a RESUME arrives
    with a lockId not in `pauseLocks[c]` (spec §2.6 "`dispose()` on a
    pauser is idempotent"), it's swallowed with no state change and no
    forward.

What this MC deliberately skips (to keep the state space tight):
  - `Pausable[n] = "resumeAll"` — the bufferAll mode is exercised by
    `wave_protocol_bufferall_MC` as a separate axis.
  - `ResubscribableNodes` — resubscribable lifecycle is exercised by
    `wave_protocol_resubscribe_MC`.
  - `BatchSeqs` — pause + batch cross-interactions are a future MC.
  - `SinkNestedEmits` / `GapAwareActivation` — isolated from the pause
    axis for now.

Expected outcome: all invariants hold, including the four new pause-axis
invariants (TerminalClearsPauseState, BufferImpliesLockedAndResumeAll,
BufferHoldsOnlyDeferredTiers, ResubscribeYieldsCleanState — the last is
vacuously true with ResubscribableNodes = {}).
 ***************************************************************************)

EXTENDS wave_protocol

NodeIdsMC     == {"A", "B", "C"}
SourceIdsMC   == {"A"}
SinkIdsMC     == {"A", "C"}
EdgesMC       == {<<"A", "B">>, <<"B", "C">>}
ValuesMC      == {0, 1}                  \* tight alphabet — pause axis matters more than values
DefaultInitMC == 0
MaxEmitsMC    == 1

\* Batches disabled — batch × pause cross-interactions are a future MC axis.
BatchSeqsMC   == {}

\* Gap-aware and nested-emit axes kept in their default clean modes.
GapAwareActivationMC == FALSE
SinkNestedEmitsMC    == {}
MaxNestedEmitsMC     == 0

\* §2.6 pause axis — two lock ids for multi-pauser exploration, all nodes
\* track locks but no bufferAll capture. Bound action firings tightly:
\* MaxPauseActions = 3 lets TLC explore every multi-pauser interleaving
\* (two Pauses + one Resume, or Pause + two Resumes across two locks)
\* without combinatorial explosion. With 2 lockIds, any meaningful
\* multi-pauser scenario fits in 3 actions.
\*
\* LockIds are integers chosen outside the `Values` alphabet so
\* `PayloadDomain == Values \cup {NullPayload} \cup LockIds` stays a
\* homogeneous integer set — TLC requires set members to be comparable
\* by equality; mixing strings with integers confuses its fingerprint.
LockIdsMC             == {10, 11}
PausableMC            == [n \in NodeIdsMC |-> "on"]
ResubscribableNodesMC == {}
MaxPauseActionsMC     == 3

============================================================================
