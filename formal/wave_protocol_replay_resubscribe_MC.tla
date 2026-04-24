---------- MODULE wave_protocol_replay_resubscribe_MC ----------
(*****************************************************************************
Combined Package 3 replay-ring × §2.6 resubscribable-lifecycle exercise MC
(added 2026-04-23 batch 6, G).

Purpose: make the batch-6-G extension of `ResubscribeYieldsCleanState`
(#13) load-bearing. The base `wave_protocol_resubscribe_MC` has
`ReplayBufferSize = 0` everywhere, so `replaySnapshot[B]` is always
`<<>>` and the new post-resubscribe check (`replaySnapshot[sid] = <<>>`)
is vacuously satisfied. This MC cross-cuts the two axes so the check
fires on non-trivial pre-resubscribe state.

Flow that exercises the invariant meaningfully:
  1. Emit(A, v) advances cache[A]; DeliverSettle(A, B) advances cache[B]
     and appends v to `replayBuffer[B]` (ring size 1, drop-oldest).
  2. SubscribeSink(B) captures `replaySnapshot[B]` = <<v>> and extends
     the handshake with DATA(v).
  3. Terminate the A→B chain (via Terminate or natural DeliverTerminal).
  4. Resubscribe(B) clears `replaySnapshot[B]` alongside the other
     lifecycle resets.
  5. At any state where `resubscribeCount > 0` AND `~activated[B]`, the
     invariant checks `replaySnapshot[B] = <<>>` — dropping the batch-6
     clear from the `Resubscribe` action trips TLC here.

Reverting the `/\ replaySnapshot' = [replaySnapshot EXCEPT ![sid] = <<>>]`
line in `Resubscribe` produces a concrete counter-example at state ~8
(any state immediately post-Resubscribe after a non-empty snapshot).

Topology: minimal 2-node chain A → B (matches `resubscribe_MC`).
State-space bounds: 2 nodes, 2 values, MaxEmits = 2, ReplayBufferSize[B] = 1.
*****************************************************************************)

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

\* Pause axis disabled so the state space stays tight — this MC probes
\* the replay × resubscribe cross-axis, not pause-lock leak. Pause-leak
\* coverage stays in `wave_protocol_resubscribe_MC`.
LockIdsMC             == {}
PausableMC            == [n \in NodeIdsMC |-> "off"]
ResubscribableNodesMC == {"B"}
MaxPauseActionsMC     == 2   \* bounds Resubscribe firings

UpOriginatorsMC   == {}
MaxUpActionsMC    == 0

ExtraSinksMC      == [n \in NodeIdsMC |-> 0]

\* B resets cache on resubscribe (matches the default "reset all derived"
\* semantic). This is orthogonal to replaySnapshot clearing — both must
\* happen independently.
ResetOnTeardownNodesMC == NodeIdsMC \ SourceIdsMC

AutoCompleteOnDepsCompleteMC == [n \in NodeIdsMC |-> TRUE]
AutoErrorOnDepsErrorMC       == [n \in NodeIdsMC |-> TRUE]

\* Package 3 axis ON at B: ring size 1 — minimal size that still exercises
\* the consumption path. `DeliverSettle(A, B)` populates `replayBuffer[B]`
\* per batch 3 QA round 2 ("Item 1 full threading"); the next
\* `SubscribeSink(B)` would capture the non-empty snapshot.
ReplayBufferSizeMC == [n \in NodeIdsMC |-> IF n = "B" THEN 1 ELSE 0]
EqualsAbsorbsMC    == [n \in NodeIdsMC |-> TRUE]

MetaCompanionsMC == [n \in NodeIdsMC |-> {}]
MaxTeardownsMC   == 0

InvalidateOriginatorsMC == {}
MaxInvalidatesMC        == 0
==============================================================================
