-------------------- MODULE wave_protocol_multisink_batch_MC --------------------
(*****************************************************************************
§2.4 multi-sink iteration × batch-emit cross-axis (added 2026-04-23, batch 3).

Purpose: TLC-verify that invariant #18 `MultiSinkIterationCoherent` is LOAD-
BEARING on the `BatchEmitMulti` path — the companion MC `wave_protocol_
multisink_MC` has `BatchSeqs = {}` so the multi-emit-in-batch path never
fires, and the pre-fix "stamp-all-with-final-cache" bug is unreachable.

Topology: 2-node chain A → B with BOTH A and B carrying an extra external
subscriber.
  A (source, sink, ExtraSinks[A] = 1)
  └→ B (derived, sink, ExtraSinks[B] = 1)

`BatchSeqs = { <<1, 0>> }` — one canonical two-emit batch with distinct
values (post-batch cache = 0; intermediate cache = 1). Under the pre-fix
stamping (all items with `finalCacheVal`), the DATA(1) at position 1 of the
bundle would carry `snap[A] = 0` while `msg.value = 1` — tripping #18.
Under the fixed per-item stamping, the DATA(1) carries `snap[A] = 1` =
`msg.value`.

Probed during authoring: ~1.8K distinct states, <1s runtime. All 18
invariants hold under the shipped fix.

Verification note: to confirm the fix is load-bearing, temporarily revert
`BuildBatchPendingItems` to `EnqueuePendingExtraSeq(..., bundle, cacheAfter)`
and re-run this MC — TLC should counter-example `MultiSinkIterationCoherent`
within 2 steps.
*****************************************************************************)

EXTENDS wave_protocol

NodeIdsMC     == {"A", "B"}
SourceIdsMC   == {"A"}
SinkIdsMC     == {"A", "B"}
EdgesMC       == {<<"A", "B">>}
ValuesMC      == {0, 1}
DefaultInitMC == 0
MaxEmitsMC    == 2

\* Two-emit batch with distinct values — the minimum that exercises the
\* BatchEmitMulti per-item snapshot path. Start cache[A] = 0; first emit
\* DATA(1) sets cache to 1; second emit DATA(0) sets cache back to 0. Per-
\* item snapshots MUST therefore stamp (0) then (1) for the dirties, and
\* (1) then (0) for the settles — not (0)/(0)/(0)/(0) as the buggy version.
BatchSeqsMC   == { <<1, 0>> }

GapAwareActivationMC == FALSE

\* Sink-nested-emit disabled — isolate the BatchEmitMulti × ExtraSinks axis.
SinkNestedEmitsMC == {}
MaxNestedEmitsMC  == 0

\* Pause axis disabled.
LockIdsMC             == {}
PausableMC            == [n \in NodeIdsMC |-> "off"]
ResubscribableNodesMC == {}
MaxPauseActionsMC     == 0

\* §1.4 up-axis disabled.
UpOriginatorsMC   == {}
MaxUpActionsMC    == 0

\* Both A (the source) and B (the derived) carry an extra subscriber. The
\* A-side is what exercises the BatchEmitMulti per-item snapshot path.
ExtraSinksMC      == [n \in NodeIdsMC |-> 1]

\* Package 4 default: preserve existing "reset all derived" semantics.
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
==============================================================================
