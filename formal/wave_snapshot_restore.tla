---------------------- MODULE wave_snapshot_restore ----------------------
(***************************************************************************
GraphReFly -- snapshot / hydration / restore lifecycle (D83 / C-24).

This focused model separates the async loading/decode phase from the sync graph
restore commit. Storage bytes, WAL frames, codecs, and content addressing are
binding-layer concerns; the protocol property here is the graph lifecycle:

  * async hydration does not partially mutate the graph or make it ready;
  * a successful named-factory restore commits the checkpointed cache, ctx.state,
    and topology together;
  * a late subscriber after restore observes the restored cache directly, without
    treating restored dependency activation as a fresh-lifecycle recompute;
  * restore is not a fresh lifecycle wipe;
  * local-only / missing factory refs fail honestly.
 ***************************************************************************)
EXTENDS Naturals, TLC

Cases == {"namedAvailable", "localOnly", "missingFactory"}
Stages == {"idle", "loading", "committed", "failed"}

EmptyCache == "EMPTY_CACHE"
SnapshotCache == "SNAPSHOT_CACHE"
EmptyState == "EMPTY_STATE"
SnapshotState == "SNAPSHOT_STATE"
EmptyTopology == "EMPTY_TOPOLOGY"
SnapshotTopology == "SNAPSHOT_TOPOLOGY"

VARIABLES mode, stage, cache, ctxState, topology, ready, restored, failed, freshWipe,
          commitCount, lateSubscribed, lateSubscribeValue, recomputedOnSubscribe

vars == <<mode, stage, cache, ctxState, topology, ready, restored, failed, freshWipe,
          commitCount, lateSubscribed, lateSubscribeValue, recomputedOnSubscribe>>

TypeOK ==
  /\ mode \in Cases \cup {"none"}
  /\ stage \in Stages
  /\ cache \in {EmptyCache, SnapshotCache}
  /\ ctxState \in {EmptyState, SnapshotState}
  /\ topology \in {EmptyTopology, SnapshotTopology}
  /\ ready \in BOOLEAN
  /\ restored \in BOOLEAN
  /\ failed \in BOOLEAN
  /\ freshWipe \in BOOLEAN
  /\ commitCount \in 0..1
  /\ lateSubscribed \in BOOLEAN
  /\ lateSubscribeValue \in {EmptyCache, SnapshotCache}
  /\ recomputedOnSubscribe \in BOOLEAN

Init ==
  /\ mode = "none"
  /\ stage = "idle"
  /\ cache = EmptyCache
  /\ ctxState = EmptyState
  /\ topology = EmptyTopology
  /\ ready = FALSE
  /\ restored = FALSE
  /\ failed = FALSE
  /\ freshWipe = FALSE
  /\ commitCount = 0
  /\ lateSubscribed = FALSE
  /\ lateSubscribeValue = EmptyCache
  /\ recomputedOnSubscribe = FALSE

BeginLoad(m) ==
  /\ stage = "idle"
  /\ m \in Cases
  /\ mode' = m
  /\ stage' = "loading"
  /\ ready' = FALSE
  /\ restored' = FALSE
  /\ failed' = FALSE
  /\ freshWipe' = FALSE
  /\ lateSubscribed' = FALSE
  /\ lateSubscribeValue' = EmptyCache
  /\ recomputedOnSubscribe' = FALSE
  /\ UNCHANGED <<cache, ctxState, topology, commitCount>>

CommitNamedRestore ==
  /\ stage = "loading"
  /\ mode = "namedAvailable"
  /\ stage' = "committed"
  /\ cache' = SnapshotCache
  /\ ctxState' = SnapshotState
  /\ topology' = SnapshotTopology
  /\ ready' = TRUE
  /\ restored' = TRUE
  /\ failed' = FALSE
  /\ freshWipe' = FALSE
  /\ commitCount' = commitCount + 1
  /\ UNCHANGED <<mode, lateSubscribed, lateSubscribeValue, recomputedOnSubscribe>>

FailUnrestorable ==
  /\ stage = "loading"
  /\ mode \in {"localOnly", "missingFactory"}
  /\ stage' = "failed"
  /\ ready' = FALSE
  /\ restored' = FALSE
  /\ failed' = TRUE
  /\ freshWipe' = FALSE
  /\ UNCHANGED <<mode, cache, ctxState, topology, commitCount, lateSubscribed,
                lateSubscribeValue, recomputedOnSubscribe>>

LateSubscribeRestored ==
  /\ stage = "committed"
  /\ ready
  /\ restored
  /\ ~lateSubscribed
  /\ lateSubscribed' = TRUE
  /\ lateSubscribeValue' = cache
  /\ recomputedOnSubscribe' = FALSE
  /\ UNCHANGED <<mode, stage, cache, ctxState, topology, ready, restored, failed,
                freshWipe, commitCount>>

Next ==
  \/ \E m \in Cases : BeginLoad(m)
  \/ CommitNamedRestore
  \/ FailUnrestorable
  \/ LateSubscribeRestored
  \/ UNCHANGED vars

Spec == Init /\ [][Next]_vars

AsyncLoadDoesNotMutateGraph ==
  stage = "loading" =>
    /\ cache = EmptyCache
    /\ ctxState = EmptyState
    /\ topology = EmptyTopology
    /\ ~ready
    /\ ~restored

ReadyOnlyAfterCommit ==
  ready => /\ stage = "committed" /\ restored /\ commitCount = 1

RestorePreservesCheckpoint ==
  restored =>
    /\ cache = SnapshotCache
    /\ ctxState = SnapshotState
    /\ topology = SnapshotTopology

RestoreIsNotFreshLifecycle ==
  restored => ~freshWipe

RestoredLateSubscribeUsesRestoredCache ==
  lateSubscribed =>
    /\ lateSubscribeValue = SnapshotCache
    /\ ~recomputedOnSubscribe
    /\ cache = SnapshotCache

LocalOnlyOrMissingRejects ==
  /\ mode \in {"localOnly", "missingFactory"}
  /\ stage \in {"failed", "committed"}
  =>
    /\ failed
    /\ ~restored
    /\ ~ready
    /\ cache = EmptyCache
    /\ ctxState = EmptyState
    /\ topology = EmptyTopology

SingleRestoreCommit ==
  commitCount <= 1
=============================================================================
