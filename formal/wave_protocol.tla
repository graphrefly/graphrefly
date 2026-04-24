-------------------------- MODULE wave_protocol --------------------------
(***************************************************************************
GraphReFly wave protocol — formal specification.

Corresponds to:
  - GRAPHREFLY-SPEC.md §1 (message protocol), §7 (versioning)
  - graphrefly-ts/src/__tests__/properties/_invariants.ts (fast-check)
  - archive/docs/SESSION-rigor-infrastructure-plan.md § "Project 3"

Each INVARIANT below has a counterpart in the fast-check harness; TLC
counter-examples translate directly into new fast-check properties.

Scope: the core wave protocol only — nodes with cache/status/version,
ordered per-edge message queues, DIRTY-then-settlement propagation with
equals substitution and bitmask-based diamond protection.

Out of scope: operators, sugar constructors, sources, patterns layer,
persistence. Those compose on top of this core.

----------------------------------------------------------------------------
MODEL SIMPLIFICATIONS (intentional):

1. All nodes start with an initial cache value; we model the
   "steady-state running" protocol between subscribe events. Subscribe
   handshakes are captured separately via `handshake[sid]` — populated
   by the `SubscribeSink(sid)` action — so fast-check invariant 7
   (`start-handshake`) has a TLC counterpart without mixing handshake
   sequences into the regular `trace[n]` emission log.

2. `fn` is modeled by the `Compute(c, cch)` operator in this module.
   The default definition covers a 4-node diamond (B, C identities of A;
   D shadows B). The concrete shape doesn't affect the invariants — they
   hold for any deterministic fn. Redefine the operator for other
   topologies.

3. Equality is `=` on the small `Values` alphabet. The substrate uses
   Object.is, which agrees with `=` on numeric/string/symbol values.

4. Message delivery is per-edge FIFO. Multiple outbound edges from one
   node enqueue the same message to each child atomically; TLC then
   enumerates all delivery interleavings across edges.

5. Tier ordering is enforced globally (§1.3 invariant 7). DIRTY is
   tier 1 (immediate) and must drain system-wide before any tier-3
   message (DATA/RESOLVED) is delivered; tier-3 must drain before any
   tier-4 message (COMPLETE/ERROR). Without this ordering, TLC would
   find "diamond glitches" that are artifacts of the interleaving
   model, not real substrate behaviour.
 ***************************************************************************)

EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS
    NodeIds,              \* Set of all node ids (strings)
    SourceIds,            \* Manual sources that can Emit independently
    Edges,                \* Set of <<parent, child>> pairs encoding topology
    Values,               \* Payload alphabet, e.g. {0, 1}
    DefaultInitial,       \* Initial cached value assigned to every node (must be in Values)
    SinkIds,              \* NodeIds with external observers (record to trace)
    MaxEmits,             \* Bound on source emits consumed
    BatchSeqs,            \* Set of sequences representing multi-emit batches (Bug 2 model)
    GapAwareActivation,   \* BOOLEAN — TRUE: derived-multi handshake synthesizes the
                          \*   gap-aware shape matching the substrate (docs/optimizations.md
                          \*   "Multi-dep push-on-subscribe ordering"). FALSE: the ideal
                          \*   clean shape. The new MultiDepHandshakeClean invariant fails
                          \*   under TRUE — exactly the bug we want TLC to find.
    SinkNestedEmits,      \* Set of <<observer, target, value>> triples. Activates the
                          \*   `SinkNestedEmit` action, modeling a sink callback that runs
                          \*   batch(() => target.emit(value)) inside its own callback.
                          \*   Empty set = feature disabled (matches the original model).
    MaxNestedEmits,       \* Bound on SinkNestedEmit firings (prevents unbounded fanout).
    LockIds,              \* Pause-lock identifiers. Opaque to the protocol; tier-2
                          \*   [PAUSE, lockId] / [RESUME, lockId] messages reference these.
                          \*   Empty set disables the pause axis — matches the baseline
                          \*   MC where PAUSE/RESUME are not modeled.
    Pausable,             \* NodeId -> {"off", "on", "resumeAll"}. Mirrors the runtime
                          \*   `pausable` option (§2.6). "off" → ignore PAUSE/RESUME, no
                          \*   lock tracking. "on" → track locks. "resumeAll" → track locks
                          \*   AND capture outgoing tier-3/4 emissions into pauseBuffer
                          \*   while any lock is held; drain on final-lock RESUME.
    ResubscribableNodes,  \* SUBSET NodeIds. Nodes that clear lifecycle state
                          \*   (pauseLocks, pauseBuffer, dirtyMask, cache for derived,
                          \*   handshake, trace, activated) when the `Resubscribe` action
                          \*   fires on a terminated instance. Matches `resubscribable: true`.
    MaxPauseActions,      \* Bound on Pause + Resume + Resubscribe firings (keeps the
                          \*   state space finite — a single Pause/Resume pair can repeat
                          \*   indefinitely without this guard).
    UpOriginators,        \* SUBSET NodeIds. Nodes that can originate upstream
                          \*   tier-1/2/5 messages via the §1.4 `up()` action. In the
                          \*   runtime, this is any sink that can call `leaf.up([...])`
                          \*   on a subscription — modeled here at the node level since
                          \*   per-sink actors are out of scope. Empty set disables the
                          \*   up-axis — matches legacy MCs where `up()` is not modeled.
    MaxUpActions,         \* Bound on UpPause + UpResume firings (otherwise a
                          \*   single UpPause/UpResume pair could repeat without
                          \*   bound). Keeps the state space finite. UpInvalidate
                          \*   / UpTeardown originators are future work — when
                          \*   added they'll share this counter and likewise be
                          \*   covered by `UpQueuesCarryControlPlane`'s tier set.
    ReplayBufferSize,     \* NodeIds -> Nat. Mirrors spec §2.5 `replayBuffer`.
                          \*   0 = disabled (default all existing MCs). > 0
                          \*   caps a per-node ring of last N DATA values
                          \*   appended by the `Emit` action (other emission
                          \*   actions deferred as Package 3 extension).
                          \*   Added 2026-04-23 batch 3 Package 3.
    EqualsAbsorbs,        \* NodeIds -> BOOLEAN. Mirrors spec §2.5 `equals`
                          \*   variance. TRUE (default) = normal strict
                          \*   equality suppresses same-value emits as
                          \*   RESOLVED. FALSE = `equals: () => false` —
                          \*   every Emit produces DATA regardless of value
                          \*   sameness. Added 2026-04-23 batch 3 Package 3.
    AutoCompleteOnDepsComplete, \* NodeIds -> BOOLEAN. Mirrors spec §2.5
                                 \*   `completeWhenDepsComplete`. When TRUE
                                 \*   (default), `DeliverTerminal` with a
                                 \*   COMPLETE message transitions c to
                                 \*   "terminated" and forwards. When FALSE,
                                 \*   the COMPLETE is ABSORBED at c (consumed
                                 \*   but not forwarded) — c stays live to
                                 \*   emit recovery values (rescue/catchError
                                 \*   semantic). Added 2026-04-23 batch 3
                                 \*   Package 5.
    AutoErrorOnDepsError, \* NodeIds -> BOOLEAN. Mirrors spec §2.5
                           \*   `errorWhenDepsError`. Same shape as
                           \*   `AutoCompleteOnDepsComplete` but for ERROR.
    MetaCompanions,       \* NodeIds -> SUBSET NodeIds. Parent → its meta
                          \*   children (spec §2.3). Default `[n |-> {}]` in
                          \*   existing MCs → axis disabled. When non-empty,
                          \*   `Teardown(parent)` fans out to each meta
                          \*   child, recording parent's pre-reset cache and
                          \*   status to `teardownWitness[child]`. Added
                          \*   2026-04-23 batch 3 Package 7.
    MaxTeardowns,         \* Bound on `Teardown` firings — keeps state space
                          \*   finite when the axis is enabled.
    InvalidateOriginators, \* SUBSET NodeIds. Nodes that can originate an
                           \*   `Invalidate(n)` action. Empty set disables the
                           \*   axis — default for all existing MCs. Added
                           \*   2026-04-23 batch 3 Package 6.
    MaxInvalidates,       \* Bound on `Invalidate` firings — keeps state space
                           \*   finite when the axis is enabled.
    ResetOnTeardownNodes, \* SUBSET NodeIds. Mirrors per-node `resetOnTeardown`
                          \*   (spec §2.5). When a node in this set is
                          \*   resubscribed after a terminal, its cache is
                          \*   CLEARED to `DefaultInitial`. When NOT in this
                          \*   set, the cache is PRESERVED across the terminal
                          \*   boundary (spec default `false`). Added 2026-04-23
                          \*   as Package 4 of the rigor iterator — existing MCs
                          \*   default to (NodeIds \ SourceIds) to preserve
                          \*   the prior "reset all derived" behavior so the
                          \*   shipped invariants remain green.
    ExtraSinks            \* NodeId -> Nat. For every sink node `n`, ExtraSinks[n]
                          \*   counts how many ADDITIONAL external subscribers observe
                          \*   `n` beyond the "primary sink" whose trace lives in
                          \*   `trace[n]`. Each extra sink `i` has its own trace in
                          \*   `extraSinkTrace[n][i]` populated lazily via the
                          \*   `DeliverToExtraSink(n, i)` action — the iterative-
                          \*   delivery analogue of the runtime's `_deliverToSinks`
                          \*   loop (node.ts L2248). Default 0 for all existing MCs
                          \*   (single-sink semantics preserved). New `wave_protocol_
                          \*   multisink_MC` sets `ExtraSinks[B] = 1` so one shared
                          \*   node carries two observers — the minimal topology for
                          \*   surfacing COMPOSITION-GUIDE §32-class peer-read bugs
                          \*   via SinkNestedEmit firing mid-iteration.

ASSUME SourceIds \subseteq NodeIds
ASSUME SinkIds \subseteq NodeIds
ASSUME Edges \subseteq (NodeIds \X NodeIds)
ASSUME DefaultInitial \in Values
ASSUME GapAwareActivation \in BOOLEAN
ASSUME SinkNestedEmits \subseteq (NodeIds \X NodeIds \X Values)
ASSUME MaxNestedEmits \in Nat
ASSUME Pausable \in [NodeIds -> {"off", "on", "resumeAll"}]
ASSUME ResubscribableNodes \subseteq NodeIds
ASSUME MaxPauseActions \in Nat
ASSUME UpOriginators \subseteq NodeIds
ASSUME MaxUpActions \in Nat
ASSUME ExtraSinks \in [NodeIds -> Nat]
ASSUME ResetOnTeardownNodes \subseteq NodeIds
ASSUME InvalidateOriginators \subseteq NodeIds
ASSUME MaxInvalidates \in Nat
ASSUME AutoCompleteOnDepsComplete \in [NodeIds -> BOOLEAN]
ASSUME AutoErrorOnDepsError \in [NodeIds -> BOOLEAN]
ASSUME ReplayBufferSize \in [NodeIds -> Nat]
ASSUME EqualsAbsorbs \in [NodeIds -> BOOLEAN]
ASSUME MetaCompanions \in [NodeIds -> SUBSET NodeIds]
ASSUME MaxTeardowns \in Nat

Parents(n) == {p \in NodeIds : <<p, n>> \in Edges}

InitialCache == [n \in NodeIds |-> DefaultInitial]

\* Compute(c, cch) — what node c would settle to given current cache map.
\* Hardcoded for the default 4-node diamond model:
\*   B, C    are identity of A
\*   D       shadows B (ignoring C's value) — keeps state space small while
\*           structurally exercising diamond fan-in and the dirtyMask bitmask.
\* For other topologies, redefine this operator or factor it into a module.
Compute(c, cch) ==
    CASE c = "B" -> cch["A"]
      [] c = "C" -> cch["A"]
      [] c = "D" -> cch["B"]
      [] OTHER   -> cch[c]

\* Children[n] = nodes that declare n as a parent
Children(n) == {c \in NodeIds : n \in Parents(c)}

\* Message type tags
START    == "START"
DIRTY    == "DIRTY"
DATA     == "DATA"
RESOLVED == "RESOLVED"
COMPLETE == "COMPLETE"
ERROR    == "ERROR"
PAUSE    == "PAUSE"       \* tier-2, carries lockId payload (§2.6)
RESUME   == "RESUME"      \* tier-2, carries lockId payload (§2.6)
INVALIDATE == "INVALIDATE" \* tier-1 (§1.4 — cache-reset broadcast). Added
                           \* 2026-04-23 batch 3 Package 6; modeled as a
                           \* source-side action with cleanup-witness ghost,
                           \* no queue propagation yet (propagation is a
                           \* future axis — see "Invalidate" action below).
TEARDOWN == "TEARDOWN"     \* tier-5 (§2.3 — meta companion fan-out). Added
                           \* 2026-04-23 batch 3 Package 7; modeled as a
                           \* parent-side action with meta-TEARDOWN-witness
                           \* ghost — verifies meta children observe TEARDOWN
                           \* with parent's PRE-reset cache/status.
MsgTypes == {START, DIRTY, DATA, RESOLVED, COMPLETE, ERROR, PAUSE, RESUME, INVALIDATE, TEARDOWN}

\* A message: type + always-present payload. Tuples that have no
\* semantic payload (DIRTY, RESOLVED, COMPLETE, ERROR, START) use the
\* integer sentinel `NullPayload = -1`, which is outside `Values` so
\* equality is homogeneous for TLC's hashing. Tier-2 PAUSE/RESUME carry
\* a `lockId \in LockIds` payload (§2.6 — "bare [[PAUSE]] is a protocol
\* violation"); the payload domain is widened accordingly.
NullPayload == -1
PayloadDomain == Values \cup {NullPayload} \cup LockIds

Msg(type, v) == [type |-> type, value |-> v]

\* Every directed parent -> child edge in the topology.
EdgePairs == Edges

\* Helper: build a new queue map that appends `msg` to every edge out of `src`.
EnqueueOutFrom(qs, src, msg) ==
    [e \in EdgePairs |->
        IF e[1] = src THEN Append(qs[e], msg) ELSE qs[e]]

\* Same, appending a sequence of messages in order.
EnqueueSeqOutFrom(qs, src, msgs) ==
    [e \in EdgePairs |->
        IF e[1] = src THEN qs[e] \o msgs ELSE qs[e]]

\* Append msg to sink's trace if n is a sink.
RecordAtSinkIfAny(t, n, msg) ==
    IF n \in SinkIds THEN [t EXCEPT ![n] = Append(@, msg)] ELSE t

RecordSeqAtSinkIfAny(t, n, msgs) ==
    IF n \in SinkIds THEN [t EXCEPT ![n] = @ \o msgs] ELSE t

\* --- §2.4 multi-sink iteration helpers (added 2026-04-23) ---
\*
\* Each emission action that writes to `trace[n]` also enqueues the same
\* payload to each extra sink's pending queue. The payload is tagged with
\* the full cache snapshot at enqueue time so the multi-sink ordering
\* invariant can check that cache didn't drift between enqueue and the
\* eventual `DeliverToExtraSink` dequeue. In single-sink MCs (`ExtraSinks`
\* = 0 everywhere) these helpers are no-ops and add no state.
PendingItem(msg, cch) == [msg |-> msg, snap |-> cch]

EnqueuePendingExtra(ped, n, msg, cch) ==
    IF n \in SinkIds /\ ExtraSinks[n] > 0
      THEN [ped EXCEPT ![n] = [i \in 1..ExtraSinks[n] |->
                                  Append(ped[n][i], PendingItem(msg, cch))]]
      ELSE ped

EnqueuePendingExtraSeq(ped, n, msgs, cch) ==
    IF n \in SinkIds /\ ExtraSinks[n] > 0
      THEN [ped EXCEPT ![n] = [i \in 1..ExtraSinks[n] |->
                                  ped[n][i] \o
                                  [j \in 1..Len(msgs) |-> PendingItem(msgs[j], cch)]]]
      ELSE ped

\* Per-item variant (added 2026-04-23, Package 2 fix). Takes a sequence of
\* pre-built PendingItem records — each already stamped with its OWN cache-at-
\* emit-time snapshot. Used by `BatchEmitMulti` so intermediate DATAs in a
\* K-emit batch don't all carry the batch-final cache (the prior bug: every
\* item got `cacheAfter = finalCacheVal` regardless of its own emit order).
EnqueuePendingExtraItems(ped, n, items) ==
    IF n \in SinkIds /\ ExtraSinks[n] > 0
      THEN [ped EXCEPT ![n] = [i \in 1..ExtraSinks[n] |-> ped[n][i] \o items]]
      ELSE ped

\* Build per-item PendingItem records for a BatchEmitMulti bundle at src.
\* DIRTYs (tier-1) all stamp the pre-batch cache — tier-1 doesn't advance
\* cache. Settles each stamp the cache AFTER their own emit (running state).
RECURSIVE BuildSettleItemsRec(_, _, _, _)
BuildSettleItemsRec(vs, curCacheVal, initialCacheMap, src) ==
    IF Len(vs) = 0 THEN <<>>
    ELSE LET v == Head(vs)
             isEq == v = curCacheVal
             newCacheVal == IF isEq THEN curCacheVal ELSE v
             sMsg == IF isEq THEN Msg(RESOLVED, NullPayload) ELSE Msg(DATA, v)
             snapAfter == IF isEq THEN initialCacheMap
                                   ELSE [initialCacheMap EXCEPT ![src] = newCacheVal]
         IN <<PendingItem(sMsg, snapAfter)>> \o
              BuildSettleItemsRec(Tail(vs), newCacheVal, snapAfter, src)

BuildBatchPendingItems(vs, initialCacheMap, src) ==
    LET k == Len(vs)
        dirtyItems == [j \in 1..k |-> PendingItem(Msg(DIRTY, NullPayload), initialCacheMap)]
        settleItems == BuildSettleItemsRec(vs, initialCacheMap[src], initialCacheMap, src)
    IN dirtyItems \o settleItems

\* --- §2.5 replayBuffer helper (added 2026-04-23 batch 3 Package 3) ---
\* Append `v` to the ring at node `n`, bounded by `ReplayBufferSize[n]`.
\* Oldest value drops when at cap. When size is 0, the buffer is disabled —
\* no update. Called from `Emit` on DATA emissions.
AppendToReplayBuffer(rb, n, v) ==
    IF ReplayBufferSize[n] = 0
      THEN rb
      ELSE IF Len(rb[n]) < ReplayBufferSize[n]
             THEN [rb EXCEPT ![n] = Append(@, v)]
             ELSE [rb EXCEPT ![n] = Append(Tail(@), v)]

----------------------------------------------------------------------------
VARIABLES
    cache,            \* NodeId -> Values  (always a real value in this simplified model)
    status,           \* NodeId -> {"settled", "dirty", "terminated"}
    version,          \* NodeId -> Nat  (advances only on DATA)
    dirtyMask,        \* NodeId -> Set of parent ids whose DIRTY is unmatched
    queues,           \* <<parent, child>> -> Seq of messages
    trace,            \* NodeId -> Seq of messages observed at sinks (protocol emissions only)
    emitCount,        \* Nat, bounds exploration (global across all sources)
    \* Per-source emit counter (added 2026-04-23 as I4 fix). Generalizes
    \* `EqualsFaithful` from single-source-implicit to multi-source-sound.
    \* Incremented by `Emit(src, v)`, `BatchEmitMulti(src, vs)`,
    \* `SinkNestedEmit(observer, target, v)` — always at the emitting source's
    \* slot. Parallel to `emitCount` (which stays the global bound).
    perSourceEmitCount, \* NodeIds -> Nat
    activated,        \* NodeId -> BOOLEAN (has a subscriber attached to this sink?)
    handshake,        \* NodeId -> Seq of messages delivered during the subscribe handshake
    nestedEmitCount,  \* Nat, bounds SinkNestedEmit action firings
    \* Ghost variable for NestedDrainPeerConsistency (item 2). Each entry records a
    \* DATA emitted by a multi-dep derived together with the cache values of its
    \* parents AT THE MOMENT the DATA was computed. A glitch is a recorded tuple
    \* whose parent values don't match the final settled cache — i.e. the fn fired
    \* with stale peer data because another parent's DATA wave was still in flight.
    emitWitness,      \* NodeId -> Seq of <<value, [p \in Parents(n) |-> cache[p]]>>
    \* --- §2.6 PAUSE/RESUME + resubscribable-lifecycle state (added 2026-04-23) ---
    \* Mirror of the runtime's `_pauseLocks` / `_pauseBuffer` per-node state. The
    \* substrate derives `_paused` from `_pauseLocks.size > 0`; we mirror that by
    \* using `pauseLocks[n] # {}` as the paused predicate rather than a separate
    \* variable — multi-pauser correctness holds by construction.
    pauseLocks,       \* NodeId -> SUBSET LockIds
    pauseBuffer,      \* NodeId -> Seq of messages captured while paused + "resumeAll"
    resubscribeCount, \* Nat, bounds Resubscribe action firings
    pauseActionCount, \* Nat, bounds Pause + Resume action firings
    \* --- §1.4 `up()` upstream direction state (added 2026-04-23) ---
    \* Per-edge queues for upstream-flowing messages. The child originates a
    \* tier-1/2/5 message (INVALIDATE / PAUSE / RESUME / TEARDOWN) via `up()`;
    \* `DeliverUp(c, p)` at the parent's end consumes and applies it — PAUSE/
    \* RESUME integrates with the existing `pauseLocks[p]` model, so upstream
    \* and downstream pause origins compose. Spec §1.4 says directions are
    \* conventions, not enforced constraints; tier-3/4 downstream-only content
    \* is modeled by disabling the action for those types at origin.
    upQueues,         \* <<child, parent>> -> Seq of messages (reverse of `queues`)
    upActionCount,    \* Nat, bounds UpPause/UpResume/UpInvalidate/UpTeardown firings
    \* --- §2.4 multi-sink iteration state (added 2026-04-23) ---
    \* Every emission action that writes to `trace[n]` ALSO enqueues the same
    \* payload to each extra sink's pendingExtraDelivery[n][i] — but the
    \* actual delivery to extra sinks is deferred to a separate action
    \* `DeliverToExtraSink(n, i)`, modeling the runtime's `_deliverToSinks`
    \* iteration (node.ts L2248). The gap between "delivered to primary" and
    \* "delivered to sink i" is the window where COMPOSITION-GUIDE §32 peer-
    \* read bugs manifest: `SinkNestedEmit` fires mid-iteration, advances a
    \* remote cache, and a stale pending payload is later delivered to a
    \* later sink whose callback reads the now-divergent cache.
    \*
    \* Each pending item is a record <<msg, cacheSnapAtEnqueue>> — the `msg`
    \* is what the sink will observe, `cacheSnapAtEnqueue` is the full-cache
    \* map at enqueue time. If cache has moved between enqueue and dequeue
    \* for a DATA payload, the multi-sink ordering invariant trips.
    extraSinkTrace,          \* [NodeId -> [1..ExtraSinks[n] -> Seq(Message)]]
    pendingExtraDelivery,    \* [NodeId -> [1..ExtraSinks[n] -> Seq(Record)]]
    \* --- §1.4 INVALIDATE + cleanup witness (added 2026-04-23, batch 3 Package 6) ---
    \* Each `Invalidate(n)` firing appends the current `cache[n]` to the
    \* witness. The invariant `CleanupWitnessInValueDomain` verifies every
    \* witness entry holds a valid Value — structural guard that the cleanup
    \* hook observed a real cached state (not the post-reset sentinel).
    invalidateCount,         \* Nat — bounds Invalidate action firings
    cleanupWitness,          \* NodeIds -> Seq(Values)
    \* --- §2.5 replayBuffer (added 2026-04-23, batch 3 Package 3) ---
    \* Per-node ring buffer of last N DATA values. Appended by `Emit` only
    \* in this MVP (BatchEmitMulti / DeliverSettle / SinkNestedEmit deferred).
    \* Bounded by `ReplayBufferSize[n]`; oldest dropped when at cap.
    replayBuffer,            \* NodeIds -> Seq(Values)
    \* --- §2.3 meta companion TEARDOWN (added 2026-04-23, batch 3 Package 7) ---
    \* `teardownCount` bounds `Teardown` firings. `teardownWitness[child]`
    \* records, for each meta child, the parent's cache[parent] and
    \* status[parent] at the moment TEARDOWN fanned out — the invariant
    \* `MetaTeardownObservedPreReset` verifies no child saw a post-reset
    \* parent (status = "terminated" or a sentinel cache).
    teardownCount,           \* Nat
    teardownWitness          \* NodeIds -> Seq([cache: Values, status: ...])

vars == <<cache, status, version, dirtyMask, queues, trace, emitCount,
          perSourceEmitCount,
          activated, handshake, nestedEmitCount, emitWitness,
          pauseLocks, pauseBuffer, resubscribeCount, pauseActionCount,
          upQueues, upActionCount,
          extraSinkTrace, pendingExtraDelivery,
          invalidateCount, cleanupWitness,
          replayBuffer,
          teardownCount, teardownWitness>>

----------------------------------------------------------------------------
Init ==
    /\ cache = [n \in NodeIds |-> InitialCache[n]]
    /\ status = [n \in NodeIds |-> "settled"]
    /\ version = [n \in NodeIds |-> 0]
    /\ dirtyMask = [n \in NodeIds |-> {}]
    /\ queues = [e \in EdgePairs |-> <<>>]
    /\ trace = [n \in NodeIds |-> <<>>]
    /\ emitCount = 0
    /\ perSourceEmitCount = [n \in NodeIds |-> 0]
    /\ activated = [n \in NodeIds |-> FALSE]
    /\ handshake = [n \in NodeIds |-> <<>>]
    /\ nestedEmitCount = 0
    /\ emitWitness = [n \in NodeIds |-> <<>>]
    /\ pauseLocks = [n \in NodeIds |-> {}]
    /\ pauseBuffer = [n \in NodeIds |-> <<>>]
    /\ resubscribeCount = 0
    /\ pauseActionCount = 0
    /\ upQueues = [e \in EdgePairs |-> <<>>]
    /\ upActionCount = 0
    /\ extraSinkTrace = [n \in NodeIds |-> [i \in 1..ExtraSinks[n] |-> <<>>]]
    /\ pendingExtraDelivery = [n \in NodeIds |-> [i \in 1..ExtraSinks[n] |-> <<>>]]
    /\ invalidateCount = 0
    /\ cleanupWitness = [n \in NodeIds |-> <<>>]
    /\ replayBuffer = [n \in NodeIds |-> <<>>]
    /\ teardownCount = 0
    /\ teardownWitness = [n \in NodeIds |-> <<>>]

----------------------------------------------------------------------------
(* BufferAll predicate: a node n captures its outgoing tier-3/4 emissions into
   `pauseBuffer[n]` when it's holding at least one pause lock AND its
   `Pausable[n]` is "resumeAll". Mirrors the runtime check at node.ts
   `_emit` L1958 (`this._paused && this._pausable === "resumeAll"`).
*)
IsCapturedByBuffer(n) == Pausable[n] = "resumeAll" /\ pauseLocks[n] # {}

(* --- §2.4 multi-sink iteration gate (added 2026-04-23 batch 3 Package 2) ---

`AllExtraPendingEmpty` models the runtime's atomic `_deliverToSinks`
iteration: while iteration is in progress (any node has non-empty
`pendingExtraDelivery`), no other emission-like action can fire.

Gated (waits for drain): Emit, BatchEmitMulti, Terminate, DeliverDirty,
DeliverSettle, DeliverTerminal, Pause, Resume, DeliverPauseResume,
DeliverUp (because its bufferAll-drain branches also enqueue to
pendingExtraDelivery).

Exempt (may fire mid-iteration):
  - `DeliverToExtraSink` — the drain action itself.
  - `SinkNestedEmit` — models the runtime's nested-emit-from-sink-callback
    window (COMPOSITION-GUIDE §32). Firing it mid-iteration is the whole
    point.
  - `Invalidate`, `Teardown` — witness-only ghost actions; no queue /
    pending writes so they can't disturb the iteration contract.
  - `UpPause`, `UpResume` — write only to `upQueues`; no pending writes.
  - `SubscribeSink`, `Resubscribe` — write handshake / lifecycle state;
    no pending writes at the emitting-node slot.

Under this gate, the deferred `MultiSinkIterationDriftClean` (#21) would
surface COMPOSITION-GUIDE §32 peer-read bugs: the only way a pending
DATA's `msg.value` can disagree with the current `cache[n]` is if a
`SinkNestedEmit` fired mid-iteration and advanced cache at that node.
(The drift form is not shipped today — see #21 docblock below for why.)

Vacuous in all MCs with `ExtraSinks = [n |-> 0]` (pending always empty →
gate is tautology). Exercised by the multisink / multisink_batch MCs.
*)
AllExtraPendingEmpty ==
    \A n \in NodeIds : \A i \in 1..ExtraSinks[n] :
        pendingExtraDelivery[n][i] = <<>>

(* A source emits a value. Per equals-substitution at the source:
   - if v = cache[src]: settle msg is RESOLVED, no cache/version change
   - else:              settle msg is DATA(v), cache' := v, version' += 1

   Ordinary (not bufferAll-captured) path: enqueue [DIRTY, settle] to every
   child edge and record to trace[src] if src is a sink.

   BufferAll path (`IsCapturedByBuffer(src)`): DIRTY is tier-1 (immediate)
   and still flows to children + trace; the settle message is captured into
   `pauseBuffer[src]` instead. Mirrors §2.6 "tier 0–2 and tier 5 continue
   to dispatch synchronously while paused."
*)
Emit(src, v) ==
    /\ src \in SourceIds
    /\ AllExtraPendingEmpty
    /\ emitCount < MaxEmits
    /\ status[src] = "settled"
    \* Package 3 (2026-04-23): equality is gated by `EqualsAbsorbs[src]`.
    \* TRUE (default) = strict equality, same-value emits become RESOLVED.
    \* FALSE = `equals: () => false` — every emit produces DATA (v != cur
    \* always holds, so settleMsg is DATA). Cache still advances to v (but
    \* since v might equal cur, cache may not numerically change).
    /\ LET equalToCache == EqualsAbsorbs[src] /\ cache[src] = v
           settleMsg    == IF equalToCache THEN Msg(RESOLVED, NullPayload)
                                           ELSE Msg(DATA, v)
           dirtyMsg     == Msg(DIRTY, NullPayload)
           pair         == <<dirtyMsg, settleMsg>>
           captured     == IsCapturedByBuffer(src)
       IN
       /\ LET cacheAfter == IF equalToCache THEN cache
                                              ELSE [cache EXCEPT ![src] = v]
          IN
          /\ IF captured
               THEN
                 \* DIRTY flows immediately; settle diverts to buffer.
                 /\ queues' = EnqueueOutFrom(queues, src, dirtyMsg)
                 /\ trace'  = RecordAtSinkIfAny(trace, src, dirtyMsg)
                 /\ pendingExtraDelivery' =
                      EnqueuePendingExtra(pendingExtraDelivery, src, dirtyMsg, cacheAfter)
                 /\ pauseBuffer' = [pauseBuffer EXCEPT ![src] = Append(@, settleMsg)]
               ELSE
                 /\ queues' = EnqueueSeqOutFrom(queues, src, pair)
                 /\ trace'  = RecordSeqAtSinkIfAny(trace, src, pair)
                 /\ pendingExtraDelivery' =
                      EnqueuePendingExtraSeq(pendingExtraDelivery, src, pair, cacheAfter)
                 /\ pauseBuffer' = pauseBuffer
          /\ cache'   = cacheAfter
          /\ version' = IF equalToCache THEN version
                                        ELSE [version EXCEPT ![src] = @ + 1]
          \* Package 3: append to ring on DATA emits (equalToCache = FALSE).
          \* On RESOLVED emits (no cache change), ring is untouched.
          /\ replayBuffer' = IF equalToCache THEN replayBuffer
                                              ELSE AppendToReplayBuffer(replayBuffer, src, v)
          /\ UNCHANGED <<status, dirtyMask, activated, handshake,
                         nestedEmitCount, emitWitness,
                         pauseLocks, resubscribeCount, pauseActionCount,
                         upQueues, upActionCount, extraSinkTrace,
                      invalidateCount, cleanupWitness,
                      teardownCount, teardownWitness>>
          /\ emitCount' = emitCount + 1
          /\ perSourceEmitCount' = [perSourceEmitCount EXCEPT ![src] = @ + 1]

(* BatchEmitMulti(src, vs): atomic multi-emit inside a user `batch()` scope.
   Models Bug 2 fix — K consecutive `.emit()` calls to `src` coalesce into
   ONE downstream bundle per child edge of the form `<<K DIRTYs, K DATAs>>`
   (tier-sorted). The bundle is delivered via one sink call per tier group;
   with the multi-message `DeliverDirty` / `DeliverSettle` above, the
   fan-in node sees all K DATAs from one parent atomically and its `fn`
   runs exactly once per wave — resolving the K+1 over-fire.

   Each value in `vs` is compared against the running cache and produces
   DATA or RESOLVED accordingly; `dataCount` tracks value-changing emits
   for version counting and `emitCount` bounding.
*)
RECURSIVE BuildSettleSeq(_, _)
BuildSettleSeq(vs, curCache) ==
    IF Len(vs) = 0
      THEN <<>>
      ELSE LET v == Head(vs)
               isEqual == v = curCache
               settleMsg == IF isEqual THEN Msg(RESOLVED, NullPayload)
                                       ELSE Msg(DATA, v)
               newCache == IF isEqual THEN curCache ELSE v
           IN <<settleMsg>> \o BuildSettleSeq(Tail(vs), newCache)

RECURSIVE FinalCache(_, _)
FinalCache(vs, curCache) ==
    IF Len(vs) = 0 THEN curCache
    ELSE LET v == Head(vs)
             isEqual == v = curCache
             newCache == IF isEqual THEN curCache ELSE v
         IN FinalCache(Tail(vs), newCache)

RECURSIVE CountDataEmits(_, _)
CountDataEmits(vs, curCache) ==
    IF Len(vs) = 0 THEN 0
    ELSE LET v == Head(vs)
             isEqual == v = curCache
             newCache == IF isEqual THEN curCache ELSE v
         IN (IF isEqual THEN 0 ELSE 1) + CountDataEmits(Tail(vs), newCache)

DirtySeqOf(k) == [i \in 1..k |-> Msg(DIRTY, NullPayload)]

BatchEmitMulti(src, vs) ==
    /\ src \in SourceIds
    /\ AllExtraPendingEmpty
    /\ vs # <<>>
    /\ status[src] = "settled"
    /\ emitCount + Len(vs) <= MaxEmits
    /\ LET settles == BuildSettleSeq(vs, cache[src])
           dataCount == CountDataEmits(vs, cache[src])
           finalCacheVal == FinalCache(vs, cache[src])
           dirtyPrefix == DirtySeqOf(Len(vs))
           bundle == dirtyPrefix \o settles
           captured == IsCapturedByBuffer(src)
       IN
       /\ LET cacheAfter == [cache EXCEPT ![src] = finalCacheVal]
          IN
          /\ IF captured
               THEN
                 \* DIRTYs flow immediately; settles divert to buffer in order.
                 \* DIRTYs stamp pre-batch cache (tier-1 doesn't advance cache).
                 /\ queues' = EnqueueSeqOutFrom(queues, src, dirtyPrefix)
                 /\ trace'  = RecordSeqAtSinkIfAny(trace, src, dirtyPrefix)
                 /\ pendingExtraDelivery' =
                      EnqueuePendingExtraSeq(pendingExtraDelivery, src, dirtyPrefix, cache)
                 /\ pauseBuffer' = [pauseBuffer EXCEPT ![src] = @ \o settles]
               ELSE
                 \* Per-item snapshots: DIRTYs stamp pre-batch cache, each
                 \* settle stamps cache-after-its-own-emit. Package 2 fix:
                 \* previously every item was stamped with the BATCH-FINAL
                 \* cacheAfter, so intermediate DATAs falsely carried the
                 \* final value — vacuous without the stricter invariant but
                 \* a false-positive source once it landed.
                 /\ queues' = EnqueueSeqOutFrom(queues, src, bundle)
                 /\ trace'  = RecordSeqAtSinkIfAny(trace, src, bundle)
                 /\ pendingExtraDelivery' =
                      EnqueuePendingExtraItems(pendingExtraDelivery, src,
                          BuildBatchPendingItems(vs, cache, src))
                 /\ pauseBuffer' = pauseBuffer
          /\ cache'  = cacheAfter
          /\ version' = [version EXCEPT ![src] = @ + dataCount]
          /\ UNCHANGED <<status, dirtyMask, activated, handshake,
                         nestedEmitCount, emitWitness,
                         pauseLocks, resubscribeCount, pauseActionCount,
                         upQueues, upActionCount, extraSinkTrace,
                      invalidateCount, cleanupWitness,
                      replayBuffer,
                      teardownCount, teardownWitness>>
          /\ emitCount' = emitCount + Len(vs)
          /\ perSourceEmitCount' = [perSourceEmitCount EXCEPT ![src] = @ + Len(vs)]

(* A source terminates. Enqueues COMPLETE to every child and transitions
   to "terminated" — the source refuses further Emit actions thereafter.

   Per §2.6 "Teardown": terminal state hard-resets the node's pause lockset
   and bufferAll buffer. Buffered in-flight DATA is NOT drained — terminal
   is a hard reset, NOT a graceful flush. This clears leaks across the
   terminal boundary (catches the lock-leak class the spec explicitly
   warns about).
*)
Terminate(src) ==
    /\ src \in SourceIds
    /\ AllExtraPendingEmpty
    /\ status[src] = "settled"
    /\ LET m == Msg(COMPLETE, NullPayload) IN
       /\ queues' = EnqueueOutFrom(queues, src, m)
       /\ trace'  = RecordAtSinkIfAny(trace, src, m)
       /\ pendingExtraDelivery' =
            EnqueuePendingExtra(pendingExtraDelivery, src, m, cache)
       /\ status' = [status EXCEPT ![src] = "terminated"]
       /\ pauseLocks' = [pauseLocks EXCEPT ![src] = {}]
       /\ pauseBuffer' = [pauseBuffer EXCEPT ![src] = <<>>]
       \* §2.6 hard-reset: clear upQueues TO this node — a terminated
       \* parent can't consume upstream PAUSE/RESUME anyway (DeliverUp
       \* guards on `status[p] # "terminated"`), so leaving them in
       \* flight would strand messages indefinitely.
       /\ upQueues' = [e \in EdgePairs |->
                          IF e[1] = src THEN <<>> ELSE upQueues[e]]
       /\ UNCHANGED <<cache, version, dirtyMask, emitCount, perSourceEmitCount, activated, handshake,
                      nestedEmitCount, emitWitness,
                      resubscribeCount, pauseActionCount,
                      upActionCount, extraSinkTrace,
                      invalidateCount, cleanupWitness,
                      replayBuffer,
                      teardownCount, teardownWitness>>

----------------------------------------------------------------------------
\* Tier-drain predicates enforcing §1.3 invariant 7 message ordering.
\* DIRTY (tier 1) must drain globally before any tier-3 message delivers;
\* tier-3 (DATA/RESOLVED) must drain before any tier-4 (COMPLETE/ERROR).
NoDirtyAnywhere ==
    \A e \in EdgePairs :
        \A i \in 1..Len(queues[e]) :
            queues[e][i].type # DIRTY

NoSettleAnywhere ==
    \A e \in EdgePairs :
        \A i \in 1..Len(queues[e]) :
            queues[e][i].type \notin {DATA, RESOLVED}

\* Same-tier prefix helpers — a `Deliver*` action consumes ALL consecutive
\* same-tier messages from a queue's head atomically, matching the runtime
\* semantic where one `sink()` call delivers one tier group's messages in
\* a single callback iteration (Bug 1 fix: fn runs once per sink call, not
\* once per message; Bug 2 fix: multi-emit-in-batch coalesces to one
\* bundle per edge).
IsSettlementMsg(m) == m.type \in {DATA, RESOLVED}
IsDirtyMsg(m) == m.type = DIRTY

Tier3PrefixLen(q) ==
    IF Len(q) = 0 \/ ~IsSettlementMsg(q[1]) THEN 0
    ELSE CHOOSE k \in 1..Len(q) :
            /\ \A i \in 1..k : IsSettlementMsg(q[i])
            /\ (k = Len(q) \/ ~IsSettlementMsg(q[k + 1]))

Tier1DirtyPrefixLen(q) ==
    IF Len(q) = 0 \/ ~IsDirtyMsg(q[1]) THEN 0
    ELSE CHOOSE k \in 1..Len(q) :
            /\ \A i \in 1..k : IsDirtyMsg(q[i])
            /\ (k = Len(q) \/ ~IsDirtyMsg(q[k + 1]))

----------------------------------------------------------------------------
(* DeliverDirty: consume the entire DIRTY prefix at head of queue[<<p, c>>]
   as one atomic delivery — matches the runtime where one sink() call
   delivers multi-DIRTY bundles in a single iteration.

   - All K DIRTYs in the prefix mark `dep[p].dirty = true` (idempotent
     via _depDirtied's early-return on already-dirty, §1.3 invariant 5).
   - If c transitions from "settled" to "dirty" (first dep-dirty this
     wave), forward ONE DIRTY to c's children and record one self-emit
     on trace[c]. Subsequent DIRTYs in the prefix — whether from the
     same bundle or a no-op repeat — do NOT produce additional outgoing
     DIRTYs.
*)
DeliverDirty(p, c) ==
    /\ <<p, c>> \in EdgePairs
    /\ AllExtraPendingEmpty
    /\ Len(queues[<<p, c>>]) > 0
    /\ IsDirtyMsg(Head(queues[<<p, c>>]))
    /\ status[c] # "terminated"
    /\ LET q == queues[<<p, c>>]
           k == Tier1DirtyPrefixLen(q)
           qs0 == [queues EXCEPT ![<<p, c>>] = SubSeq(q, k + 1, Len(q))]
           firstDirtyThisWave == status[c] # "dirty"
           dirtyMsg == Msg(DIRTY, NullPayload)
       IN
       /\ IF firstDirtyThisWave
            THEN /\ queues' = EnqueueOutFrom(qs0, c, dirtyMsg)
                 /\ trace'  = RecordAtSinkIfAny(trace, c, dirtyMsg)
                 /\ pendingExtraDelivery' =
                      EnqueuePendingExtra(pendingExtraDelivery, c, dirtyMsg, cache)
            ELSE /\ queues' = qs0
                 /\ trace'  = trace
                 /\ pendingExtraDelivery' = pendingExtraDelivery
       /\ status' = [status EXCEPT ![c] = "dirty"]
       /\ dirtyMask' = [dirtyMask EXCEPT ![c] = @ \cup {p}]
       /\ UNCHANGED <<cache, version, emitCount, perSourceEmitCount, activated, handshake,
                      nestedEmitCount, emitWitness,
                      pauseLocks, pauseBuffer, resubscribeCount, pauseActionCount,
                      upQueues, upActionCount, extraSinkTrace,
                      invalidateCount, cleanupWitness,
                      replayBuffer,
                      teardownCount, teardownWitness>>

(* DeliverSettle: consume the entire tier-3 (DATA/RESOLVED) prefix at head
   of queue[<<p, c>>] as one atomic delivery — matches the runtime after
   Bug 1 + Bug 2 fixes: one sink() call delivers a multi-message bundle,
   `fn` runs **once** at the end (not once per message).

   - Removes p from dirtyMask[c] (all K settlements in the prefix mark
     this dep as done for the current wave — whether 1 DATA, 1 RESOLVED,
     or K DATAs from a batch-coalesced bundle).
   - If all deps now settled AND c was "dirty", recompute ONCE:
       * newCache = Compute(c, cache). Uses the LAST cached value of each
         parent — which reflects the batch's final value per-parent,
         matching the runtime's `dataBatch.at(-1)` semantic.
       * If newCache = cache[c], emit RESOLVED.
       * Else cache[c] := newCache, version++, emit DATA(newCache).
     Recorded to trace[c] as a single self-emission.
   - If not all deps settled yet, just update mask and wait for more.
*)
DeliverSettle(p, c) ==
    /\ <<p, c>> \in EdgePairs
    /\ AllExtraPendingEmpty
    /\ Len(queues[<<p, c>>]) > 0
    /\ IsSettlementMsg(Head(queues[<<p, c>>]))
    /\ status[c] # "terminated"
    /\ NoDirtyAnywhere
    /\ LET q == queues[<<p, c>>]
           k == Tier3PrefixLen(q)
           qs0 == [queues EXCEPT ![<<p, c>>] = SubSeq(q, k + 1, Len(q))]
           newMask == dirtyMask[c] \ {p}
           allSettled == newMask = {} /\ status[c] = "dirty"
       IN
       /\ dirtyMask' = [dirtyMask EXCEPT ![c] = newMask]
       /\ IF ~allSettled
            THEN /\ queues' = qs0
                 /\ trace'  = trace
                 /\ pauseBuffer' = pauseBuffer
                 /\ pendingExtraDelivery' = pendingExtraDelivery
                 /\ emitWitness' = emitWitness
                 /\ UNCHANGED <<cache, status, version,
                      invalidateCount, cleanupWitness,
                      replayBuffer,
                      teardownCount, teardownWitness>>
            ELSE LET newCache  == Compute(c, cache)
                     sameAsOld == newCache = cache[c]
                     settleMsg == IF sameAsOld THEN Msg(RESOLVED, NullPayload)
                                               ELSE Msg(DATA, newCache)
                     captured  == IsCapturedByBuffer(c)
                     cacheAfter == IF sameAsOld THEN cache
                                                 ELSE [cache EXCEPT ![c] = newCache]
                     \* Record a ghost witness when a multi-parent derived emits DATA:
                     \* the value it chose, plus the parents' cache values at the
                     \* moment of recompute. Used by NestedDrainPeerConsistency.
                     witness == [value |-> newCache,
                                 parents |-> [pp \in Parents(c) |-> cache[pp]]]
                     isMultiParentDataEmit ==
                         ~sameAsOld /\ Cardinality(Parents(c)) >= 2
                 IN
                 /\ IF captured
                      THEN
                        \* Cache/status/version still advance — matches the runtime
                        \* where `_updateState` runs BEFORE the bufferAll check.
                        \* Only the downstream delivery diverts to pauseBuffer[c].
                        /\ queues' = qs0
                        /\ trace'  = trace
                        /\ pendingExtraDelivery' = pendingExtraDelivery
                        /\ pauseBuffer' = [pauseBuffer EXCEPT ![c] = Append(@, settleMsg)]
                      ELSE
                        /\ queues' = EnqueueOutFrom(qs0, c, settleMsg)
                        /\ trace'  = RecordAtSinkIfAny(trace, c, settleMsg)
                        /\ pendingExtraDelivery' =
                             EnqueuePendingExtra(pendingExtraDelivery, c, settleMsg, cacheAfter)
                        /\ pauseBuffer' = pauseBuffer
                 /\ cache'  = cacheAfter
                 /\ version' = IF sameAsOld THEN version
                                             ELSE [version EXCEPT ![c] = @ + 1]
                 /\ status' = [status EXCEPT ![c] = "settled"]
                 /\ emitWitness' = IF isMultiParentDataEmit
                                     THEN [emitWitness EXCEPT ![c] = Append(@, witness)]
                                     ELSE emitWitness
       /\ UNCHANGED <<emitCount, perSourceEmitCount, activated, handshake, nestedEmitCount,
                      pauseLocks, resubscribeCount, pauseActionCount,
                      upQueues, upActionCount, extraSinkTrace,
                      invalidateCount, cleanupWitness,
                      replayBuffer,
                      teardownCount, teardownWitness>>

(* DeliverTerminal: consume COMPLETE or ERROR from queue[<<p, c>>].
   - Forwards the terminal to c's children exactly once.
   - Records the forwarded terminal to trace[c] if c is a sink.
   - Transitions c to "terminated"; all further Deliver actions for c
     are blocked by the status guard.
*)
DeliverTerminal(p, c) ==
    /\ <<p, c>> \in EdgePairs
    /\ AllExtraPendingEmpty
    /\ Len(queues[<<p, c>>]) > 0
    /\ Head(queues[<<p, c>>]).type \in {COMPLETE, ERROR}
    /\ status[c] # "terminated"
    /\ NoDirtyAnywhere
    /\ NoSettleAnywhere
    /\ LET m   == Head(queues[<<p, c>>])
           qs0 == [queues EXCEPT ![<<p, c>>] = Tail(@)]
           \* Package 5 (2026-04-23) per-node auto-terminal gating. When the
           \* gate is FALSE for this message type, the terminal is ABSORBED
           \* at c (consumed, not forwarded, no status transition). Rescue /
           \* catchError operator semantic: c stays live to emit recovery
           \* values downstream.
           gate == IF m.type = COMPLETE
                     THEN AutoCompleteOnDepsComplete[c]
                     ELSE AutoErrorOnDepsError[c]
           newMask == dirtyMask[c] \ {p}
           \* D1 fix (2026-04-23 QA): when absorb branch clears the last
           \* dirty dep, we must recompute and settle — same shape as
           \* DeliverSettle's allSettled branch. Without this, the node
           \* sits in "dirty" with empty mask but never re-emits, which
           \* misses the rescue/catchError "emit recovery value on dep
           \* terminal" semantic.
           rescueRecompute == ~gate /\ newMask = {} /\ status[c] = "dirty"
           rNewCache == Compute(c, cache)
           rSameAsOld == rNewCache = cache[c]
           rSettleMsg == IF rSameAsOld THEN Msg(RESOLVED, NullPayload)
                                       ELSE Msg(DATA, rNewCache)
           rCaptured == IsCapturedByBuffer(c)
           rCacheAfter == IF rSameAsOld THEN cache
                                         ELSE [cache EXCEPT ![c] = rNewCache]
       IN
       /\ IF gate
            THEN
              \* Default auto-terminal path: forward + transition + cleanup.
              /\ queues' = EnqueueOutFrom(qs0, c, m)
              /\ trace'  = RecordAtSinkIfAny(trace, c, m)
              /\ pendingExtraDelivery' =
                   EnqueuePendingExtra(pendingExtraDelivery, c, m, cache)
              /\ status' = [status EXCEPT ![c] = "terminated"]
              /\ pauseLocks' = [pauseLocks EXCEPT ![c] = {}]
              /\ pauseBuffer' = [pauseBuffer EXCEPT ![c] = <<>>]
              /\ cache' = cache
              /\ version' = version
              \* Clear upQueues TO the now-terminated node (same reasoning
              \* as `Terminate(src)`): DeliverUp gates on
              \* `status[p] # "terminated"`, so stranded messages would
              \* compound state forever.
              /\ upQueues' = [e \in EdgePairs |->
                                 IF e[1] = c THEN <<>> ELSE upQueues[e]]
            ELSE IF rescueRecompute
                   THEN
                     \* D1 rescue path: mask fully cleared by this dep's
                     \* terminal absorption → recompute + settle (mirroring
                     \* DeliverSettle all-settled branch).
                     /\ IF rCaptured
                          THEN
                            /\ queues' = qs0
                            /\ trace'  = trace
                            /\ pendingExtraDelivery' = pendingExtraDelivery
                            /\ pauseBuffer' =
                                 [pauseBuffer EXCEPT ![c] = Append(@, rSettleMsg)]
                          ELSE
                            /\ queues' = EnqueueOutFrom(qs0, c, rSettleMsg)
                            /\ trace'  = RecordAtSinkIfAny(trace, c, rSettleMsg)
                            /\ pendingExtraDelivery' =
                                 EnqueuePendingExtra(pendingExtraDelivery, c,
                                                      rSettleMsg, rCacheAfter)
                            /\ pauseBuffer' = pauseBuffer
                     /\ cache' = rCacheAfter
                     /\ version' = IF rSameAsOld THEN version
                                                  ELSE [version EXCEPT ![c] = @ + 1]
                     /\ status' = [status EXCEPT ![c] = "settled"]
                     /\ pauseLocks' = pauseLocks
                     /\ upQueues' = upQueues
                   ELSE
                     \* Gated-off rescue path: absorb the terminal, stay live.
                     \* dirtyMask is cleared for p (dep-terminal counts as dep-
                     \* settlement for rescue's purposes — runtime parallel is
                     \* `_dirtyDepCount` decrementing on terminal receipt).
                     /\ queues' = qs0
                     /\ trace'  = trace
                     /\ pendingExtraDelivery' = pendingExtraDelivery
                     /\ status' = status
                     /\ pauseLocks' = pauseLocks
                     /\ pauseBuffer' = pauseBuffer
                     /\ upQueues' = upQueues
                     /\ cache' = cache
                     /\ version' = version
       /\ dirtyMask' = IF gate THEN dirtyMask
                                ELSE [dirtyMask EXCEPT ![c] = newMask]
       /\ UNCHANGED <<emitCount, perSourceEmitCount, activated, handshake,
                      nestedEmitCount, emitWitness,
                      resubscribeCount, pauseActionCount,
                      upActionCount, extraSinkTrace,
                      invalidateCount, cleanupWitness,
                      replayBuffer,
                      teardownCount, teardownWitness>>

----------------------------------------------------------------------------
(* SubscribeSink(sid): fires once per sink. Synthesizes the handshake
   sequence delivered to a brand-new subscriber, per GRAPHREFLY-SPEC §2.2
   and the `start-handshake` fast-check invariant:

   - **Source** (no parents): `[[START]], [[DATA, cached]]` — cached value
     pushed directly, no DIRTY.
   - **Derived** (has parents, non-terminated): `[[START]], [[DIRTY]],
     [[DATA, computed]]` — compute node has no cache at subscribe time
     until deps push, emits DIRTY first, then computes and delivers DATA.
   - **Terminated** node: `[[START]], [[COMPLETE]]` — terminal nodes
     replay their terminal to the new subscriber (§1.3.4 does NOT forbid
     the terminal replay on subscribe; it forbids further DIRTY/DATA
     after terminal).

   `handshake[sid]` is a ghost variable — it's separate from `trace[sid]`
   so protocol invariants (DIRTY-before-DATA balance, etc.) don't need to
   special-case the handshake's §2.2 exemption.
*)
SubscribeSink(sid) ==
    /\ sid \in SinkIds
    /\ ~activated[sid]
    /\ LET isSource == Parents(sid) = {}
           isTerminated == status[sid] = "terminated"
           isMultiParent == Cardinality(Parents(sid)) >= 2
           startMsg == Msg(START, NullPayload)
           \* Multi-parent derived activation under GapAwareActivation:
           \* _activate subscribes deps sequentially, each push-on-subscribe
           \* fires as its own wave. The first dep's settle opens a DIRTY at
           \* the derived's downstream without any other dep settled yet →
           \* first-run gate emits RESOLVED to balance the DIRTY. The second
           \* dep's push-on-subscribe then fires another DIRTY, which produces
           \* the real DATA after both deps settle. Net shape:
           \* [[START], [DIRTY], [RESOLVED], [DIRTY], [DATA, cached]]. See
           \* docs/optimizations.md "Multi-dep push-on-subscribe ordering" and
           \* fast-check invariant #7 (derived-multi branch) for the substrate
           \* observation that motivated this modeling.
           gapAwareMultiSeq ==
               <<startMsg, Msg(DIRTY, NullPayload), Msg(RESOLVED, NullPayload),
                 Msg(DIRTY, NullPayload), Msg(DATA, cache[sid])>>
           cleanSeq ==
               <<startMsg, Msg(DIRTY, NullPayload), Msg(DATA, cache[sid])>>
           handshakeSeq ==
               CASE isTerminated ->
                      <<startMsg, Msg(COMPLETE, NullPayload)>>
                 [] isSource ->
                      <<startMsg, Msg(DATA, cache[sid])>>
                 [] isMultiParent /\ GapAwareActivation ->
                      gapAwareMultiSeq
                 [] OTHER ->
                      cleanSeq
       IN /\ handshake' = [handshake EXCEPT ![sid] = @ \o handshakeSeq]
          /\ activated' = [activated EXCEPT ![sid] = TRUE]
          /\ UNCHANGED <<cache, status, version, dirtyMask, queues, trace, emitCount, perSourceEmitCount,
                         nestedEmitCount, emitWitness,
                         pauseLocks, pauseBuffer, resubscribeCount, pauseActionCount,
                         upQueues, upActionCount,
                         extraSinkTrace, pendingExtraDelivery,
                      invalidateCount, cleanupWitness,
                      replayBuffer,
                      teardownCount, teardownWitness>>

(* SinkNestedEmit(observer, target, v): models a sink callback that runs
   batch(() => target.emit(v)) inside its own callback. Enabled only when:
     - the triple is in the user-supplied `SinkNestedEmits` set;
     - `observer` has already received a DATA in its trace (the callback is
       firing BECAUSE that DATA arrived);
     - target is a live source (not terminated) and the emitCount bound
       allows one more wave.
   The action enqueues `[[DIRTY], [DATA, v]]` to all of target's outbound
   edges (standard emit semantics), then bumps `nestedEmitCount`. TLC then
   explores how this nested bundle interleaves with the already-in-flight
   outer-wave deliveries — the exact timing window where the §32 bug lives.
*)
ObserverHasReceivedData(observer) ==
    \E i \in 1..Len(trace[observer]) : trace[observer][i].type = DATA

SinkNestedEmit(observer, target, v) ==
    /\ <<observer, target, v>> \in SinkNestedEmits
    /\ target \in SourceIds
    /\ status[target] = "settled"
    /\ emitCount < MaxEmits
    /\ nestedEmitCount < MaxNestedEmits
    /\ ObserverHasReceivedData(observer)
    /\ LET equalToCache == cache[target] = v
           settleMsg    == IF equalToCache THEN Msg(RESOLVED, NullPayload)
                                           ELSE Msg(DATA, v)
           dirtyMsg     == Msg(DIRTY, NullPayload)
           pair         == <<dirtyMsg, settleMsg>>
           captured     == IsCapturedByBuffer(target)
           cacheAfter   == IF equalToCache THEN cache
                                            ELSE [cache EXCEPT ![target] = v]
       IN
       /\ IF captured
            THEN
              /\ queues' = EnqueueOutFrom(queues, target, dirtyMsg)
              /\ trace'  = RecordAtSinkIfAny(trace, target, dirtyMsg)
              /\ pendingExtraDelivery' =
                   EnqueuePendingExtra(pendingExtraDelivery, target, dirtyMsg, cacheAfter)
              /\ pauseBuffer' = [pauseBuffer EXCEPT ![target] = Append(@, settleMsg)]
            ELSE
              /\ queues' = EnqueueSeqOutFrom(queues, target, pair)
              /\ trace'  = RecordSeqAtSinkIfAny(trace, target, pair)
              /\ pendingExtraDelivery' =
                   EnqueuePendingExtraSeq(pendingExtraDelivery, target, pair, cacheAfter)
              /\ pauseBuffer' = pauseBuffer
       /\ cache'   = cacheAfter
       /\ version' = IF equalToCache THEN version
                                     ELSE [version EXCEPT ![target] = @ + 1]
       /\ UNCHANGED <<status, dirtyMask, activated, handshake, emitWitness,
                      pauseLocks, resubscribeCount, pauseActionCount,
                      upQueues, upActionCount, extraSinkTrace,
                      invalidateCount, cleanupWitness,
                      replayBuffer,
                      teardownCount, teardownWitness>>
       /\ emitCount' = emitCount + 1
       /\ perSourceEmitCount' = [perSourceEmitCount EXCEPT ![target] = @ + 1]
       /\ nestedEmitCount' = nestedEmitCount + 1

----------------------------------------------------------------------------
(*                §2.6 PAUSE/RESUME + resubscribable-lifecycle actions       *)
(*                                                                            *)
(* Pause(src, lockId) — originate a tier-2 PAUSE at a source. Adds lockId to *)
(*   pauseLocks[src] (if Pausable[src] # "off"), enqueues [PAUSE, lockId] to *)
(*   every outbound edge, records to trace[src] if it's a sink.              *)
(*                                                                            *)
(* Resume(src, lockId) — originate a tier-2 RESUME at a source. Must target  *)
(*   a lockId currently held (unknown-lockId resumes are modeled at the      *)
(*   `DeliverPauseResume` layer where forwarded RESUMEs can reach nodes      *)
(*   that never received the matching PAUSE). On final-lock release with    *)
(*   Pausable[src] = "resumeAll", `pauseBuffer[src]` drains to child queues *)
(*   AND trace BEFORE the [RESUME, lockId] is enqueued — per-edge FIFO      *)
(*   then guarantees buffered settlements arrive at descendants strictly    *)
(*   before the RESUME.                                                     *)
(*                                                                            *)
(* DeliverPauseResume(p, c) — consume a tier-2 head from queue[<<p,c>>]. On *)
(*   PAUSE: idempotently add lockId to pauseLocks[c]; forward PAUSE to      *)
(*   children. On RESUME with known lockId: remove, possibly drain buffer,  *)
(*   forward. On RESUME with unknown lockId: swallow (remove from queue,    *)
(*   no state change, no forward) — matches §2.6 "Unknown-lockId RESUME is  *)
(*   a no-op, so `dispose()` on a pauser is idempotent."                    *)
(*                                                                            *)
(* Resubscribe(sid) — re-activate a terminated resubscribable sink. Clears   *)
(*   lifecycle state (pauseLocks, pauseBuffer, dirtyMask, handshake, trace, *)
(*   activated, cache-for-derived, status) so a subsequent SubscribeSink    *)
(*   can fire fresh. Enforces §2.6 "Resubscribable nodes also clear the     *)
(*   lock set on resubscribe so a new lifecycle cannot inherit a lock from  *)
(*   a prior one."                                                          *)
(******************************************************************************)

Pause(src, lockId) ==
    /\ src \in SourceIds
    /\ AllExtraPendingEmpty
    /\ lockId \in LockIds
    /\ status[src] # "terminated"
    /\ pauseActionCount < MaxPauseActions
    /\ lockId \notin pauseLocks[src]  \* disallow redundant re-pause of same lockId
    /\ LET msg == Msg(PAUSE, lockId) IN
       /\ pauseLocks' =
            IF Pausable[src] # "off"
              THEN [pauseLocks EXCEPT ![src] = @ \cup {lockId}]
              ELSE pauseLocks
       /\ queues' = EnqueueOutFrom(queues, src, msg)
       /\ trace'  = RecordAtSinkIfAny(trace, src, msg)
       /\ pendingExtraDelivery' =
            EnqueuePendingExtra(pendingExtraDelivery, src, msg, cache)
       /\ pauseActionCount' = pauseActionCount + 1
       /\ UNCHANGED <<cache, status, version, dirtyMask, emitCount, perSourceEmitCount, activated,
                      handshake, nestedEmitCount, emitWitness,
                      pauseBuffer, resubscribeCount,
                      upQueues, upActionCount, extraSinkTrace,
                      invalidateCount, cleanupWitness,
                      replayBuffer,
                      teardownCount, teardownWitness>>

(* Resume only fires when `src` is actually holding `lockId`. The
   "unknown-lockId RESUME is a no-op" case is modeled at `DeliverPauseResume`
   — a forwarded RESUME can reach a downstream node whose pauseLocks set
   doesn't contain the lockId (e.g. resubscribe cleared it). That's the
   observable case TLC should explore.
*)
Resume(src, lockId) ==
    /\ src \in SourceIds
    /\ AllExtraPendingEmpty
    /\ lockId \in LockIds
    /\ status[src] # "terminated"
    /\ pauseActionCount < MaxPauseActions
    /\ lockId \in pauseLocks[src]
    /\ LET msg == Msg(RESUME, lockId)
           newLocks == pauseLocks[src] \ {lockId}
           drainBuf == pauseBuffer[src]
           fullDrain == newLocks = {} /\ Pausable[src] = "resumeAll"
       IN
       /\ pauseLocks' = [pauseLocks EXCEPT ![src] = newLocks]
       /\ IF fullDrain
            THEN
              /\ pauseBuffer' = [pauseBuffer EXCEPT ![src] = <<>>]
              /\ queues' = LET qd == EnqueueSeqOutFrom(queues, src, drainBuf)
                           IN EnqueueOutFrom(qd, src, msg)
              /\ trace'  = LET td == RecordSeqAtSinkIfAny(trace, src, drainBuf)
                           IN RecordAtSinkIfAny(td, src, msg)
              /\ pendingExtraDelivery' =
                   LET ped1 == EnqueuePendingExtraSeq(pendingExtraDelivery, src, drainBuf, cache)
                   IN EnqueuePendingExtra(ped1, src, msg, cache)
            ELSE
              /\ pauseBuffer' = pauseBuffer
              /\ queues' = EnqueueOutFrom(queues, src, msg)
              /\ trace'  = RecordAtSinkIfAny(trace, src, msg)
              /\ pendingExtraDelivery' =
                   EnqueuePendingExtra(pendingExtraDelivery, src, msg, cache)
       /\ pauseActionCount' = pauseActionCount + 1
       /\ UNCHANGED <<cache, status, version, dirtyMask, emitCount, perSourceEmitCount, activated,
                      handshake, nestedEmitCount, emitWitness,
                      resubscribeCount,
                      upQueues, upActionCount, extraSinkTrace,
                      invalidateCount, cleanupWitness,
                      replayBuffer,
                      teardownCount, teardownWitness>>

DeliverPauseResume(p, c) ==
    /\ <<p, c>> \in EdgePairs
    /\ AllExtraPendingEmpty
    /\ Len(queues[<<p, c>>]) > 0
    /\ Head(queues[<<p, c>>]).type \in {PAUSE, RESUME}
    /\ status[c] # "terminated"
    /\ LET m == Head(queues[<<p, c>>])
           qs0 == [queues EXCEPT ![<<p, c>>] = Tail(@)]
           isPause == m.type = PAUSE
           lockId == m.value
           hasLock == lockId \in pauseLocks[c]
           newLocks == pauseLocks[c] \ {lockId}
           drainBuf == pauseBuffer[c]
           fullDrain == hasLock /\ newLocks = {} /\ Pausable[c] = "resumeAll"
       IN
       /\ IF Pausable[c] = "off"
            THEN
              \* No lock tracking at c; just forward tier-2 onwards.
              /\ pauseLocks' = pauseLocks
              /\ pauseBuffer' = pauseBuffer
              /\ queues' = EnqueueOutFrom(qs0, c, m)
              /\ trace'  = RecordAtSinkIfAny(trace, c, m)
              /\ pendingExtraDelivery' =
                   EnqueuePendingExtra(pendingExtraDelivery, c, m, cache)
            ELSE IF isPause
              THEN
                /\ pauseLocks' = [pauseLocks EXCEPT ![c] = @ \cup {lockId}]
                /\ pauseBuffer' = pauseBuffer
                /\ queues' = EnqueueOutFrom(qs0, c, m)
                /\ trace'  = RecordAtSinkIfAny(trace, c, m)
                /\ pendingExtraDelivery' =
                     EnqueuePendingExtra(pendingExtraDelivery, c, m, cache)
              ELSE
                \* RESUME branch
                IF ~hasLock
                  THEN
                    \* Unknown lockId at c — swallow: consume from queue, no
                    \* state change, no forward. Propagation stops here.
                    /\ pauseLocks' = pauseLocks
                    /\ pauseBuffer' = pauseBuffer
                    /\ queues' = qs0
                    /\ trace'  = trace
                    /\ pendingExtraDelivery' = pendingExtraDelivery
                  ELSE IF fullDrain
                    THEN
                      /\ pauseLocks' = [pauseLocks EXCEPT ![c] = newLocks]
                      /\ pauseBuffer' = [pauseBuffer EXCEPT ![c] = <<>>]
                      /\ queues' = LET qd == EnqueueSeqOutFrom(qs0, c, drainBuf)
                                   IN EnqueueOutFrom(qd, c, m)
                      /\ trace'  = LET td == RecordSeqAtSinkIfAny(trace, c, drainBuf)
                                   IN RecordAtSinkIfAny(td, c, m)
                      /\ pendingExtraDelivery' =
                           LET ped1 == EnqueuePendingExtraSeq(pendingExtraDelivery, c, drainBuf, cache)
                           IN EnqueuePendingExtra(ped1, c, m, cache)
                    ELSE
                      /\ pauseLocks' = [pauseLocks EXCEPT ![c] = newLocks]
                      /\ pauseBuffer' = pauseBuffer
                      /\ queues' = EnqueueOutFrom(qs0, c, m)
                      /\ trace'  = RecordAtSinkIfAny(trace, c, m)
                      /\ pendingExtraDelivery' =
                           EnqueuePendingExtra(pendingExtraDelivery, c, m, cache)
       /\ UNCHANGED <<cache, status, version, dirtyMask, emitCount, perSourceEmitCount, activated,
                      handshake, nestedEmitCount, emitWitness,
                      resubscribeCount, pauseActionCount,
                      upQueues, upActionCount, extraSinkTrace,
                      invalidateCount, cleanupWitness,
                      replayBuffer,
                      teardownCount, teardownWitness>>

Resubscribe(sid) ==
    /\ sid \in ResubscribableNodes
    /\ status[sid] = "terminated"
    /\ resubscribeCount < MaxPauseActions
    /\ LET isSource == Parents(sid) = {}
       IN
       /\ pauseLocks' = [pauseLocks EXCEPT ![sid] = {}]
       /\ pauseBuffer' = [pauseBuffer EXCEPT ![sid] = <<>>]
       /\ dirtyMask' = [dirtyMask EXCEPT ![sid] = {}]
       \* Cache reset is gated on `ResetOnTeardownNodes` per spec §2.5. Sources
       \* always preserve (no dep-driven recompute to re-populate). Derived
       \* nodes clear to DefaultInitial when in `ResetOnTeardownNodes` (matches
       \* `resetOnTeardown: true`); otherwise preserve the last computed value
       \* across the terminal boundary.
       /\ cache' = IF isSource \/ sid \notin ResetOnTeardownNodes
                     THEN cache
                     ELSE [cache EXCEPT ![sid] = DefaultInitial]
       /\ status' = [status EXCEPT ![sid] = "settled"]
       /\ handshake' = [handshake EXCEPT ![sid] = <<>>]
       /\ trace'    = [trace EXCEPT ![sid] = <<>>]
       /\ extraSinkTrace' = [extraSinkTrace EXCEPT ![sid] =
                                [i \in 1..ExtraSinks[sid] |-> <<>>]]
       /\ pendingExtraDelivery' = [pendingExtraDelivery EXCEPT ![sid] =
                                      [i \in 1..ExtraSinks[sid] |-> <<>>]]
       \* Clear upQueues for every edge whose child is `sid` — a stale
       \* upstream PAUSE/RESUME enqueued by the pre-terminate lifecycle
       \* MUST NOT fire against a fresh resubscribed instance. Mirrors
       \* the pauseLocks/pauseBuffer reset above per §2.6 "Resubscribable
       \* nodes also clear the lock set on resubscribe so a new lifecycle
       \* cannot inherit a lock from a prior one" — upstream in-flight
       \* tier-2 is semantically equivalent lifecycle-owned state.
       /\ upQueues' = [e \in EdgePairs |->
                          IF e[2] = sid THEN <<>> ELSE upQueues[e]]
       /\ activated' = [activated EXCEPT ![sid] = FALSE]
       /\ resubscribeCount' = resubscribeCount + 1
       \* A4 (QA 2026-04-23): a new lifecycle must NOT inherit cleanup /
       \* teardown witnesses or ring-buffer contents from the prior one.
       \* Clear per-sid slots to match the pauseLocks/pauseBuffer/handshake/
       \* trace reset semantics above.
       /\ cleanupWitness' = [cleanupWitness EXCEPT ![sid] = <<>>]
       /\ teardownWitness' = [teardownWitness EXCEPT ![sid] = <<>>]
       /\ replayBuffer' = [replayBuffer EXCEPT ![sid] = <<>>]
       /\ UNCHANGED <<version, queues, emitCount, perSourceEmitCount,
                      nestedEmitCount, emitWitness,
                      pauseActionCount, upActionCount,
                      invalidateCount,
                      teardownCount>>

----------------------------------------------------------------------------
(*              §1.4 `up()` upstream-direction actions (added 2026-04-23)    *)
(*                                                                            *)
(* Spec §1.4: messages flow in two directions. `up()` carries the tier-1/2/5 *)
(* control-plane set (INVALIDATE / PAUSE / RESUME / TEARDOWN) from a         *)
(* subscriber back toward its parent. Tier-3/4 (DATA/RESOLVED/COMPLETE/     *)
(* ERROR) are downstream-only per the spec; attempting to send one upstream *)
(* is not modeled (runtime throws; TLA+-side the action isn't defined).     *)
(*                                                                            *)
(* Per-edge semantics: `upQueues[<<child, parent>>]` is the FIFO queue of    *)
(* upstream-flowing messages from `child` to `parent`. When a node n \in     *)
(* UpOriginators originates an `up()` action, the message enqueues to every *)
(* `<<n, p>>` where p is a parent of n. `DeliverUp(c, p)` at the parent's   *)
(* end consumes and applies the message — PAUSE/RESUME integrate with       *)
(* `pauseLocks[p]` via the same semantics as the downstream variant (same   *)
(* spec §2.6 lockset tracking). INVALIDATE and TEARDOWN currently apply at  *)
(* the parent without further propagation — full tree-wide INVALIDATE/     *)
(* TEARDOWN propagation is out of scope for this axis (tracked separately). *)
(*                                                                            *)
(* Scope note for diamond topologies: when `n` has multiple parents (e.g. D *)
(* in the 4-node diamond has parents B and C), `up()` from a sink at D     *)
(* enqueues to BOTH `<<D, B>>` and `<<D, C>>`. Whether deeper propagation  *)
(* back to A happens is up to the parent's own `up()` forwarding — which   *)
(* the protocol does not mandate. This matches the spec's "conventions,    *)
(* not enforced constraints" framing.                                       *)
(******************************************************************************)

EnqueueUpFrom(uqs, child, msg) ==
    [e \in EdgePairs |->
        IF e[2] = child THEN Append(uqs[e], msg) ELSE uqs[e]]

UpPause(child, lockId) ==
    /\ child \in UpOriginators
    /\ lockId \in LockIds
    /\ upActionCount < MaxUpActions
    /\ Parents(child) # {}
    /\ LET msg == Msg(PAUSE, lockId) IN
       /\ upQueues' = EnqueueUpFrom(upQueues, child, msg)
       /\ upActionCount' = upActionCount + 1
       /\ UNCHANGED <<cache, status, version, dirtyMask, queues, trace, emitCount, perSourceEmitCount,
                      activated, handshake, nestedEmitCount, emitWitness,
                      pauseLocks, pauseBuffer, resubscribeCount, pauseActionCount,
                      extraSinkTrace, pendingExtraDelivery,
                      invalidateCount, cleanupWitness,
                      replayBuffer,
                      teardownCount, teardownWitness>>

UpResume(child, lockId) ==
    /\ child \in UpOriginators
    /\ lockId \in LockIds
    /\ upActionCount < MaxUpActions
    /\ Parents(child) # {}
    /\ LET msg == Msg(RESUME, lockId) IN
       /\ upQueues' = EnqueueUpFrom(upQueues, child, msg)
       /\ upActionCount' = upActionCount + 1
       /\ UNCHANGED <<cache, status, version, dirtyMask, queues, trace, emitCount, perSourceEmitCount,
                      activated, handshake, nestedEmitCount, emitWitness,
                      pauseLocks, pauseBuffer, resubscribeCount, pauseActionCount,
                      extraSinkTrace, pendingExtraDelivery,
                      invalidateCount, cleanupWitness,
                      replayBuffer,
                      teardownCount, teardownWitness>>

(* DeliverUp(p, c) — consume an upstream message at parent p coming from
   child c. First positional is parent, second is child — matches the
   dispatch convention of sibling actions (`DeliverDirty(p, c)`,
   `DeliverSettle(p, c)`, etc.) called via `\E e \in EdgePairs :
   DeliverUp(e[1], e[2])` where `EdgePairs` uses `<<parent, child>>`
   pairs. On PAUSE: idempotently add lockId to pauseLocks[p] when
   Pausable[p] # "off". On RESUME: if lockId is held, remove it; on
   final-lock release in "resumeAll" mode, drain `pauseBuffer[p]` and
   forward a downstream RESUME via `queues` so descendants unwind their
   locks too. Unknown-lockId RESUME is a no-op (consume from upQueues;
   per §2.6 idempotent-dispose).

   Note: we do NOT re-forward upstream to p's own parents here. That's
   the node implementation's choice in the runtime (a node MAY forward
   tier-2 up through its own subscription); modeling that recursion is
   outside the current axis scope and would compose with the existing
   downstream-origin PAUSE model at p.
*)
DeliverUp(p, c) ==
    /\ <<p, c>> \in EdgePairs
    /\ AllExtraPendingEmpty
    /\ Len(upQueues[<<p, c>>]) > 0
    /\ status[p] # "terminated"
    /\ LET m == Head(upQueues[<<p, c>>])
           uqs0 == [upQueues EXCEPT ![<<p, c>>] = Tail(@)]
           isPause == m.type = PAUSE
           lockId == m.value
           hasLock == lockId \in pauseLocks[p]
           newLocks == pauseLocks[p] \ {lockId}
           drainBuf == pauseBuffer[p]
           fullDrain == hasLock /\ newLocks = {} /\ Pausable[p] = "resumeAll"
       IN
       /\ IF Pausable[p] = "off"
            THEN
              \* No lock tracking at p; tier-2 is absorbed (not re-forwarded
              \* upstream). Matches the §2.6 off-semantic.
              /\ pauseLocks' = pauseLocks
              /\ pauseBuffer' = pauseBuffer
              /\ queues' = queues
              /\ trace' = trace
              /\ pendingExtraDelivery' = pendingExtraDelivery
              /\ upQueues' = uqs0
            ELSE IF isPause
              THEN
                /\ pauseLocks' = [pauseLocks EXCEPT ![p] = @ \cup {lockId}]
                /\ pauseBuffer' = pauseBuffer
                /\ queues' = queues
                /\ trace' = trace
                /\ pendingExtraDelivery' = pendingExtraDelivery
                /\ upQueues' = uqs0
              ELSE
                \* RESUME branch — symmetric with DeliverPauseResume's RESUME.
                IF ~hasLock
                  THEN
                    \* Unknown lockId at p — consume from upQueue, no state change.
                    /\ pauseLocks' = pauseLocks
                    /\ pauseBuffer' = pauseBuffer
                    /\ queues' = queues
                    /\ trace' = trace
                    /\ pendingExtraDelivery' = pendingExtraDelivery
                    /\ upQueues' = uqs0
                  ELSE IF fullDrain
                    THEN
                      \* Final-lock RESUME at p with bufferAll: drain p's buffered
                      \* tier-3 messages downstream, then a downstream RESUME so
                      \* descendants release their locks.
                      /\ pauseLocks' = [pauseLocks EXCEPT ![p] = newLocks]
                      /\ pauseBuffer' = [pauseBuffer EXCEPT ![p] = <<>>]
                      /\ queues' = LET qd == EnqueueSeqOutFrom(queues, p, drainBuf)
                                   IN EnqueueOutFrom(qd, p, m)
                      /\ trace'  = LET td == RecordSeqAtSinkIfAny(trace, p, drainBuf)
                                   IN RecordAtSinkIfAny(td, p, m)
                      /\ pendingExtraDelivery' =
                           LET ped1 == EnqueuePendingExtraSeq(pendingExtraDelivery, p, drainBuf, cache)
                           IN EnqueuePendingExtra(ped1, p, m, cache)
                      /\ upQueues' = uqs0
                    ELSE
                      \* Partial release (multi-pauser): just drop this lockId;
                      \* still forward a downstream RESUME so descendants can
                      \* decrement their own locksets.
                      /\ pauseLocks' = [pauseLocks EXCEPT ![p] = newLocks]
                      /\ pauseBuffer' = pauseBuffer
                      /\ queues' = EnqueueOutFrom(queues, p, m)
                      /\ trace'  = RecordAtSinkIfAny(trace, p, m)
                      /\ pendingExtraDelivery' =
                           EnqueuePendingExtra(pendingExtraDelivery, p, m, cache)
                      /\ upQueues' = uqs0
       /\ UNCHANGED <<cache, status, version, dirtyMask, emitCount, perSourceEmitCount, activated,
                      handshake, nestedEmitCount, emitWitness,
                      resubscribeCount, pauseActionCount, upActionCount,
                      extraSinkTrace,
                      invalidateCount, cleanupWitness,
                      replayBuffer,
                      teardownCount, teardownWitness>>

----------------------------------------------------------------------------
(*              §2.4 multi-sink iteration actions (added 2026-04-23)          *)
(*                                                                            *)
(* `DeliverToExtraSink(n, i)` models one step of the runtime's              *)
(* `_deliverToSinks` iteration (node.ts L2248): the primary trace has       *)
(* already been appended atomically by whichever emission action fired,    *)
(* and each extra sink's pending queue holds the same payload plus a      *)
(* cache snapshot at enqueue time. This action pops one payload for one  *)
(* extra sink and appends it to that sink's trace.                         *)
(*                                                                            *)
(* The "mid-iteration" window that COMPOSITION-GUIDE §32 peer-read bugs   *)
(* live in is precisely the state where some extra sink has a non-empty  *)
(* pending queue. `SinkNestedEmit` remains enabled; when it fires during *)
(* this window and advances the cache at the same node, subsequent      *)
(* DeliverToExtraSink calls for that node observe a DATA payload whose   *)
(* `value` disagrees with the current `cache[n]` — the invariant        *)
(* `MultiSinkIterationCoherent` traps that disagreement.                 *)
(*                                                                            *)
(* When `ExtraSinks[n] = 0` (all existing MCs), pendingExtraDelivery[n] *)
(* is always empty so this action is vacuously disabled and adds zero   *)
(* state to the existing MC state spaces.                               *)
(******************************************************************************)

DeliverToExtraSink(n, i) ==
    /\ n \in SinkIds
    /\ i \in 1..ExtraSinks[n]
    /\ Len(pendingExtraDelivery[n][i]) > 0
    /\ LET item == Head(pendingExtraDelivery[n][i])
           msg == item.msg
       IN
       /\ pendingExtraDelivery' = [pendingExtraDelivery EXCEPT ![n][i] = Tail(@)]
       /\ extraSinkTrace' = [extraSinkTrace EXCEPT ![n][i] = Append(@, msg)]
       /\ UNCHANGED <<cache, status, version, dirtyMask, queues, trace, emitCount, perSourceEmitCount,
                      activated, handshake, nestedEmitCount, emitWitness,
                      pauseLocks, pauseBuffer, resubscribeCount, pauseActionCount,
                      upQueues, upActionCount,
                      invalidateCount, cleanupWitness,
                      replayBuffer,
                      teardownCount, teardownWitness>>

----------------------------------------------------------------------------
(*            §1.4 INVALIDATE + cleanup-witness action                      *)
(*                                                                            *)
(* `Invalidate(n)` models a user-originated `graph.signal([[INVALIDATE]])`   *)
(* or an operator-originated cache-bust at node n. The cleanup-hook         *)
(* side-effect is represented by appending the PRE-invalidate `cache[n]`    *)
(* to `cleanupWitness[n]` — the witness lets the invariant check that       *)
(* every recorded snapshot is in the valid `Values` domain (structural      *)
(* guarantee that the cleanup hook observed a real cached state, not the   *)
(* post-reset sentinel).                                                    *)
(*                                                                            *)
(* MVP modeling decision (2026-04-23 batch 3 Package 6): this action does  *)
(* NOT propagate INVALIDATE through `queues` and does NOT reset `cache`.   *)
(* Propagation would require a downstream `DeliverInvalidate` action and a *)
(* tier-ordering guard similar to `NoDirtyAnywhere`; cache reset would    *)
(* disturb `EqualsFaithful` / `VersionPerChange` by rolling cache to     *)
(* DefaultInitial mid-stream. Both are future axes — see the optimizations*)
(* "Remaining rigor-infra coverage gaps" index. This MVP ships the axis's *)
(* hook-firing side-effect semantic only, which is the bug class: cleanup *)
(* hook must fire BEFORE cache reset — guaranteed here by construction.   *)
(******************************************************************************)
Invalidate(n) ==
    /\ n \in InvalidateOriginators
    /\ invalidateCount < MaxInvalidates
    /\ status[n] # "terminated"
    /\ cleanupWitness' = [cleanupWitness EXCEPT ![n] = Append(@, cache[n])]
    /\ invalidateCount' = invalidateCount + 1
    /\ UNCHANGED <<cache, status, version, dirtyMask, queues, trace, emitCount,
                   perSourceEmitCount, activated, handshake, nestedEmitCount,
                   emitWitness, pauseLocks, pauseBuffer, resubscribeCount,
                   pauseActionCount, upQueues, upActionCount,
                   extraSinkTrace, pendingExtraDelivery,
                      replayBuffer,
                      teardownCount, teardownWitness>>

----------------------------------------------------------------------------
(*            §2.3 meta companion TEARDOWN action (Package 7)               *)
(*                                                                            *)
(* `Teardown(parent)` models the top-of-`_emit` fan-out of TEARDOWN to a    *)
(* parent's meta children BEFORE the parent's own state-transition walk.   *)
(* The witness captures parent's cache + status AT FAN-OUT — which must   *)
(* be the PRE-reset values (parent still "settled"/"dirty", cache in     *)
(* Values). The invariant `MetaTeardownObservedPreReset` verifies this.  *)
(*                                                                            *)
(* MVP modeling decision: this action does NOT perform the parent's own   *)
(* state transition (cache reset, status→"terminated"). Adding that would  *)
(* disturb `EqualsFaithful` / `VersionPerChange` etc. by rolling cache    *)
(* without a Compute step. The witness-only model captures the ordering  *)
(* contract — the bug class this invariant catches is: meta child observes *)
(* parent post-reset because fan-out was reordered. Full state-transition  *)
(* is tracked as future work.                                              *)
(******************************************************************************)
Teardown(parent) ==
    /\ parent \in NodeIds
    /\ MetaCompanions[parent] # {}
    /\ teardownCount < MaxTeardowns
    /\ status[parent] # "terminated"
    /\ teardownWitness' =
           [child \in NodeIds |->
               IF child \in MetaCompanions[parent]
                 THEN Append(teardownWitness[child],
                              [cache |-> cache[parent], status |-> status[parent]])
                 ELSE teardownWitness[child]]
    /\ teardownCount' = teardownCount + 1
    /\ UNCHANGED <<cache, status, version, dirtyMask, queues, trace, emitCount,
                   perSourceEmitCount, activated, handshake, nestedEmitCount,
                   emitWitness, pauseLocks, pauseBuffer, resubscribeCount,
                   pauseActionCount, upQueues, upActionCount,
                   extraSinkTrace, pendingExtraDelivery,
                   invalidateCount, cleanupWitness, replayBuffer>>

Next ==
    \/ \E src \in SourceIds, v \in Values : Emit(src, v)
    \/ \E src \in SourceIds, vs \in BatchSeqs : BatchEmitMulti(src, vs)
    \/ \E src \in SourceIds : Terminate(src)
    \/ \E sid \in SinkIds : SubscribeSink(sid)
    \/ \E triple \in SinkNestedEmits :
         SinkNestedEmit(triple[1], triple[2], triple[3])
    \/ \E src \in SourceIds, lockId \in LockIds : Pause(src, lockId)
    \/ \E src \in SourceIds, lockId \in LockIds : Resume(src, lockId)
    \/ \E sid \in ResubscribableNodes : Resubscribe(sid)
    \/ \E child \in UpOriginators, lockId \in LockIds : UpPause(child, lockId)
    \/ \E child \in UpOriginators, lockId \in LockIds : UpResume(child, lockId)
    \/ \E n \in SinkIds : \E i \in 1..ExtraSinks[n] : DeliverToExtraSink(n, i)
    \/ \E n \in InvalidateOriginators : Invalidate(n)
    \/ \E parent \in NodeIds : Teardown(parent)
    \/ \E e \in EdgePairs :
        \/ DeliverDirty(e[1], e[2])
        \/ DeliverSettle(e[1], e[2])
        \/ DeliverTerminal(e[1], e[2])
        \/ DeliverPauseResume(e[1], e[2])
        \/ DeliverUp(e[1], e[2])

Spec == Init /\ [][Next]_vars

----------------------------------------------------------------------------
(*                             INVARIANTS                                 *)
(*                                                                        *)
(* Each maps 1-1 to an invariant in the fast-check harness. Violations    *)
(* produce TLC counter-example traces; port them into new fast-check      *)
(* properties to keep the regression covered in both layers.              *)
(**************************************************************************)

\* #1: In the observed trace at any sink, every DATA/RESOLVED is preceded
\*     by an unmatched DIRTY. Equivalent to: running (DIRTY − settlement)
\*     count never goes negative.
NoDataWithoutDirty ==
    \A n \in SinkIds :
        LET T == trace[n] IN
        \A i \in 1..Len(T) :
            LET prefix == SubSeq(T, 1, i)
                dirtyCount == Cardinality({j \in 1..Len(prefix) : prefix[j].type = DIRTY})
                settleCount == Cardinality({j \in 1..Len(prefix) :
                                              prefix[j].type \in {DATA, RESOLVED}})
            IN settleCount <= dirtyCount

\* #2: At every reachable state, every DIRTY in the trace that has arrived
\*     must have a corresponding settlement in the trace OR still be in
\*     flight via a downstream queue OR parked in a pauseBuffer (bufferAll
\*     mode holds settlements across the pause window). For model-checking
\*     simplicity we assert: at states where all queues drain to empty,
\*     every sink's DIRTY count equals (trace-DATA + trace-RESOLVED
\*     + pauseBuffer-DATA + pauseBuffer-RESOLVED). Buffered settlements
\*     count toward balance because they're "owed" — they will emerge on
\*     the next final-lock RESUME. In legacy MCs (Pausable = [n |-> "off"])
\*     pauseBuffer is always empty, so the buffered-count term is 0 and the
\*     invariant reduces to the original shape.
AllQueuesEmpty == \A e \in EdgePairs : queues[e] = <<>>
AllBuffersEmpty == \A n \in NodeIds : pauseBuffer[n] = <<>>
AllLocksEmpty == \A n \in NodeIds : pauseLocks[n] = {}

BalancedWaves ==
    (AllQueuesEmpty /\ AllBuffersEmpty) =>
        \A n \in SinkIds :
            \* Terminated nodes are excluded: §2.6 "Teardown" discards
            \* `pauseBuffer` on terminal without draining, which strands DIRTYs
            \* in trace whose buffered settlements never emerged. This is
            \* sanctioned hard-reset behaviour, not a protocol bug. Pre-terminal
            \* balance is unaffected and still checked.
            \*
            \* The `AllBuffersEmpty` precondition handles a subtler case: a
            \* DIRTY forwarded from paused upstream U through a settled
            \* intermediate I to a downstream sink D. I settles (cache
            \* advances), but D's matching settlement is in `pauseBuffer[U]`
            \* upstream — not in `pauseBuffer[D]`. Per-sink buffer counting
            \* misses this cross-node owed-settlement. Restricting to full-
            \* graph quiesced states (queues AND buffers empty) sidesteps
            \* the cross-node accounting without losing coverage of the
            \* invariant's intent.
            status[n] # "terminated" =>
                Cardinality({i \in 1..Len(trace[n]) : trace[n][i].type = DIRTY}) =
                Cardinality({i \in 1..Len(trace[n]) :
                                trace[n][i].type \in {DATA, RESOLVED}})

\* #3: After the first COMPLETE or ERROR in a sink's trace, no further
\*     DIRTY / DATA / RESOLVED messages appear.
TerminalAbsorbing ==
    \A n \in SinkIds :
        LET T == trace[n]
            terminalPositions == {i \in 1..Len(T) : T[i].type \in {COMPLETE, ERROR}}
        IN
        terminalPositions # {} =>
            LET firstTerminal == CHOOSE i \in terminalPositions :
                                   \A j \in terminalPositions : i <= j
            IN \A k \in (firstTerminal+1)..Len(T) :
                 T[k].type \notin {DIRTY, DATA, RESOLVED}

\* #4: In a diamond (node with >= 2 parents all reachable from one source),
\*     settlements at the fan-in node are bounded by the number of source
\*     emits consumed so far. The fast-check harness bounds this per wave;
\*     the TLA+ model bounds cumulatively since `emitCount` is our wave
\*     counter. Captures the "no 2× per dep edge" property.
SettlementCount(n) ==
    Cardinality({i \in 1..Len(trace[n]) :
                   trace[n][i].type \in {DATA, RESOLVED}})
  + Cardinality({i \in 1..Len(pauseBuffer[n]) :
                   pauseBuffer[n][i].type \in {DATA, RESOLVED}})

FanInNodes == {n \in NodeIds : Cardinality(Parents(n)) >= 2}

\* Known scope limitation from fast-check probe (2026-04-17):
\* multi-emit batches over-fire by +1 at the fan-in. TLA+ doesn't model
\* batch boundaries (each Emit is its own wave in this spec), so we expect
\* the tighter bound `SettlementCount(n) <= emitCount` to hold.
DiamondConvergence ==
    \A n \in (FanInNodes \cap SinkIds) :
        SettlementCount(n) <= emitCount

\* #5: Every source emit produces exactly one settlement observed at the
\*     source itself (when the source is a sink). If the source is not a
\*     sink the invariant is vacuous here; fast-check has the companion
\*     sink-side coverage.
\*
\*     Settlements deferred by bufferAll mode count here too — they've
\*     logically happened (cache advanced, version bumped) but are parked
\*     in pauseBuffer until the final-lock RESUME drains them. Without this
\*     term the invariant would trip mid-pause window.
\*
\*     I4 fix (2026-04-23): previously compared `trace[s]` against the global
\*     `emitCount` — sound for single-source topologies but broken for multi-
\*     source (the nested MC has two sources A and B; A's trace records only
\*     A's emits while `emitCount` aggregates both). `perSourceEmitCount[s]`
\*     — incremented by Emit/BatchEmitMulti/SinkNestedEmit at the emitting
\*     source's slot — is the per-source counter this invariant needs.
EqualsFaithful ==
    \A s \in (SourceIds \cap SinkIds) :
        \* Terminated sources excluded: §2.6 "Teardown" discards pauseBuffer
        \* without draining, so dropped settlements can't be accounted for in
        \* either trace or buffer. Same reasoning as BalancedWaves.
        status[s] # "terminated" =>
            Cardinality({i \in 1..Len(trace[s]) :
                           trace[s][i].type \in {DATA, RESOLVED}})
          + Cardinality({i \in 1..Len(pauseBuffer[s]) :
                           pauseBuffer[s][i].type \in {DATA, RESOLVED}})
            = perSourceEmitCount[s]

\* #7: START handshake well-formedness. For every activated sink,
\* `handshake[sid]` matches one of the valid shapes per §2.2:
\*   - source (no parents, not terminated): [[START], [DATA, cached]]
\*   - single-parent derived (not terminated): [[START], [DIRTY], [DATA, computed]]
\*   - multi-parent derived (not terminated):
\*       clean:      [[START], [DIRTY], [DATA, computed]]           (ideal)
\*       gap-aware:  [[START], [DIRTY], [RESOLVED], [DIRTY], [DATA]] (substrate today)
\*   - terminated: [[START], [COMPLETE]]
\*
\* This invariant is loosened vs. the original: the multi-parent derived
\* case accepts both handshake shapes. The tight distinction between the two
\* lives in `MultiDepHandshakeClean` below — that invariant fails under
\* GapAwareActivation = TRUE, matching fast-check invariant #10.
StartHandshakeValid ==
    \A sid \in SinkIds :
        activated[sid] =>
            LET H == handshake[sid]
                isSource == Parents(sid) = {}
                isMultiParent == Cardinality(Parents(sid)) >= 2
                Content(msgs) == [i \in 1..Len(msgs) |-> msgs[i].type]
                MatchesShape(shape) ==
                    Len(H) = Len(shape)
                    /\ \A i \in 1..Len(shape) : H[i].type = shape[i]
            IN
            /\ Len(H) >= 1
            /\ H[1].type = START
            /\ (\E i \in 1..Len(H) : H[i].type \in {COMPLETE, ERROR}) =>
                 /\ Len(H) = 2
                 /\ H[2].type \in {COMPLETE, ERROR}
            /\ (~\E i \in 1..Len(H) : H[i].type \in {COMPLETE, ERROR}) =>
                 IF isSource
                   THEN MatchesShape(<<START, DATA>>)
                   ELSE IF isMultiParent
                          THEN \/ MatchesShape(<<START, DIRTY, DATA>>)
                               \/ MatchesShape(<<START, DIRTY, RESOLVED, DIRTY, DATA>>)
                          ELSE MatchesShape(<<START, DIRTY, DATA>>)

\* #8 — MultiDepHandshakeClean (OPEN, ahead of substrate fix).
\* For any activated multi-parent derived sink whose handshake completed
\* WITHOUT a terminal, the handshake must NOT contain a RESOLVED. Equivalently:
\* the handshake must be the clean `[[START], [DIRTY], [DATA]]` shape.
\*
\* This invariant FAILS under GapAwareActivation = TRUE — the counter-example
\* is any multi-parent derived sink's synthesized gap-aware handshake. It
\* PASSES under GapAwareActivation = FALSE (the ideal model where the
\* substrate has been fixed to synthesize one combined initial wave).
\*
\* Ties to fast-check invariant #10 and docs/optimizations.md "Multi-dep
\* push-on-subscribe ordering." Flipping this green is the TLA+-side gate
\* for item 3's substrate fix; paired with the fast-check suite it forms an
\* exhaustive-plus-randomized verification.
MultiDepHandshakeClean ==
    \A sid \in SinkIds :
        activated[sid] =>
            LET H == handshake[sid]
                isMultiParent == Cardinality(Parents(sid)) >= 2
                hasTerminal == \E i \in 1..Len(H) :
                                 H[i].type \in {COMPLETE, ERROR}
            IN
            (isMultiParent /\ ~hasTerminal) =>
                ~\E i \in 1..Len(H) : H[i].type = RESOLVED

\* #9 — NestedDrainPeerConsistency. Every DATA recorded by a multi-parent
\* derived must reflect peer cache values that are consistent with the
\* eventual settled state — specifically, once all queues have drained, every
\* witness in `emitWitness[n]` must have `witness.value = Compute(n, stable)`
\* where `stable` is the fixed-point cache. The COMPOSITION-GUIDE §32 bug —
\* if it were reproducible in the model — would manifest as a witness
\* recording `value = Compute(n, staleCache)` where staleCache has a peer
\* value that differs from the final cache.
\*
\* Modeling note: in the current state, DeliverSettle uses the FINAL cache
\* at the moment of firing, not any prior wave's value. Because DeliverSettle
\* is gated by `NoDirtyAnywhere` (tier ordering) and only fires when all
\* dirty deps have delivered, the invariant holds by construction — there is
\* no state where a derived recomputes with peer DIRTY still pending.
\*
\* Under SinkNestedEmits (non-empty), the action adds MORE interleavings via
\* nested-wave source emissions, but still cannot violate the tier ordering
\* (DIRTY drains before any DATA fires). The invariant therefore serves as a
\* regression guard: any future substrate change that relaxes tier ordering
\* or removes the `NoDirtyAnywhere` guard on `DeliverSettle` will trip this.
\*
\* Ties to fast-check invariant #11 and COMPOSITION-GUIDE §32.
NestedDrainPeerConsistency ==
    (AllQueuesEmpty /\ AllBuffersEmpty /\ AllLocksEmpty) =>
        \A n \in NodeIds :
            Cardinality(Parents(n)) >= 2 =>
                \A i \in 1..Len(emitWitness[n]) :
                    LET w == emitWitness[n][i]
                    IN w.parents = [pp \in Parents(n) |-> cache[pp]]
                       => w.value = Compute(n, cache)

\* #6: A source's `version` equals the count of DATA tuples in its own
\*     trace, because a source that is also a sink records every
\*     self-emission (DIRTY + DATA or DIRTY + RESOLVED) to its own trace.
\*     The mirror property doesn't apply to derived nodes here: a sink
\*     records INCOMING messages from parents, which is a different count
\*     than the node's own cache-change events. Derived-side version
\*     tracking is covered by fast-check invariant #6; the TLA+ check is
\*     restricted to the source-observed form.
VersionPerChange ==
    \A s \in (SourceIds \cap SinkIds) :
        \* Terminated sources excluded for the same reason as EqualsFaithful:
        \* buffer drop on terminal can strand value-changing emits (version
        \* bumped at Emit time, DATA discarded with the buffer).
        status[s] # "terminated" =>
            version[s] =
                Cardinality({i \in 1..Len(trace[s]) : trace[s][i].type = DATA})
              + Cardinality({i \in 1..Len(pauseBuffer[s]) :
                                pauseBuffer[s][i].type = DATA})

\* #10 — TerminalClearsPauseState (§2.6 Teardown).
\* After a node reaches terminal status, and the node is NOT in the
\* resubscribable set, its pauseLocks and pauseBuffer MUST be empty.
\* Enforces the spec's explicit hard-reset contract: "On TEARDOWN or
\* deactivation, the buffer and lock set are discarded." Catches lock-leak
\* regressions across the terminal boundary (the spec §2.6 "Teardown" warning).
TerminalClearsPauseState ==
    \A n \in NodeIds :
        (status[n] = "terminated" /\ n \notin ResubscribableNodes) =>
            (pauseLocks[n] = {} /\ pauseBuffer[n] = <<>>)

\* #11 — BufferImpliesLockedAndResumeAll (§2.6 bufferAll).
\* pauseBuffer[n] can only be non-empty if:
\*   (a) n is holding at least one pause lock (pauseLocks[n] # {}), AND
\*   (b) n's Pausable mode is "resumeAll".
\* Catches: buffer leaks into nodes with pausable="on" or "off"; buffered
\* messages surviving final-lock release (the drain step failing to clear
\* the buffer). Combined with TerminalClearsPauseState, guarantees the
\* buffer only exists in its sanctioned window.
BufferImpliesLockedAndResumeAll ==
    \A n \in NodeIds :
        pauseBuffer[n] # <<>> =>
            (pauseLocks[n] # {} /\ Pausable[n] = "resumeAll")

\* #12 — BufferHoldsOnlyDeferredTiers (§2.6 bufferAll).
\* Only tier-3 (DATA, RESOLVED) payloads accumulate in pauseBuffer while a
\* node is paused. Tier 0–2 (START, DIRTY, INVALIDATE, PAUSE, RESUME), tier
\* 4 (COMPLETE, ERROR), and tier 5 (TEARDOWN) dispatch synchronously even
\* while paused — the spec carves them out so end-of-stream signals and
\* control-plane messages cannot be stranded by a leaked pause lock.
\* Catches: accidental capture of control-plane OR stream-lifecycle messages
\* into the buffer, which would strand downstream subscribers without the
\* ability to observe flow control OR to know the stream has ended.
BufferHoldsOnlyDeferredTiers ==
    \A n \in NodeIds :
        \A i \in 1..Len(pauseBuffer[n]) :
            pauseBuffer[n][i].type \in {DATA, RESOLVED}

\* #13 — ResubscribeYieldsCleanState (§2.6 Teardown → Resubscribable).
\* For every resubscribable sink that has been terminal-reset via Resubscribe
\* (status is back to "settled" and activated is FALSE — the window between
\* Resubscribe and the next SubscribeSink), the lifecycle-owned state must
\* match fresh-init: no leftover locks, no leftover buffer, no leftover dirty
\* mask, no leftover handshake, no leftover trace. This is the protocol-level
\* statement of "observationally indistinguishable from a fresh node." If this
\* invariant holds, a subsequent SubscribeSink on `sid` lands in a known-good
\* initial state regardless of what happened in prior lifecycles.
ResubscribeYieldsCleanState ==
    \A sid \in ResubscribableNodes :
        (status[sid] = "settled" /\ ~activated[sid] /\ resubscribeCount > 0) =>
            /\ pauseLocks[sid] = {}
            /\ pauseBuffer[sid] = <<>>
            /\ dirtyMask[sid] = {}
            /\ handshake[sid] = <<>>
            /\ trace[sid] = <<>>
            \* Upstream in-flight tier-2 from the prior lifecycle is also
            \* lifecycle-owned state and must not leak across resubscribe.
            \* Checks every <<p, sid>> edge (where sid is the child-end,
            \* i.e. the resubscribed node's in-flight upstream messages).
            /\ \A e \in EdgePairs : e[2] = sid => upQueues[e] = <<>>
            \* Multi-sink per-extra-sink lifecycle state must also reset —
            \* the `Resubscribe` action clears these but a future refactor
            \* dropping the reset would silently regress coverage. Empty
            \* over the (possibly empty) range 1..ExtraSinks[sid].
            /\ \A i \in 1..ExtraSinks[sid] :
                    extraSinkTrace[sid][i] = <<>>
                 /\ pendingExtraDelivery[sid][i] = <<>>

\* #14 — UpQueuesCarryControlPlane (§1.4 up() direction).
\* Spec §1.4: `up()` carries tier-1 (DIRTY, INVALIDATE), tier-2 (PAUSE /
\* RESUME), and tier-5 (TEARDOWN) only. Tier-3 (DATA / RESOLVED) and
\* tier-4 (COMPLETE / ERROR) are downstream-only; the runtime throws on
\* `up()` of those tiers at `_validateUpTiers`. Structural invariant:
\* `upQueues` never holds a tier-3/4 message.
\*
\* The allowed set is widened beyond what the current originators (only
\* `UpPause` / `UpResume`) actually emit, so future `UpInvalidate` /
\* `UpTeardown` additions (foreseen in the `MaxUpActions` docstring's
\* roadmap) won't spuriously trip this invariant. Today trivially true
\* by construction — no originator emits anything outside the set.
UpQueuesCarryControlPlane ==
    \A e \in EdgePairs :
        \A i \in 1..Len(upQueues[e]) :
            upQueues[e][i].type \in {DIRTY, PAUSE, RESUME}
            \* Per §1.4 INVALIDATE is tier-1 and TEARDOWN is tier-5; both
            \* are up-carriable per the spec. We'd include them here as
            \* `{DIRTY, PAUSE, RESUME, INVALIDATE, TEARDOWN}` except that
            \* MsgTypes (line ~128) is a closed set and adding unmodeled
            \* message types just to satisfy a future check noises up the
            \* payload-domain type. When the Invalidate / Teardown originators
            \* land, extend both `MsgTypes` and this set in one pass.

\* #15 — UpPauseOriginatorBound (§1.4 + §2.6).
\* Protocol sanity: `pauseLocks[n]` cannot be non-empty without some pause
\* origination event — either downstream (`Pause` action, counted in
\* `pauseActionCount`) or upstream (`UpPause` action, counted in
\* `upActionCount`). Rules out "lock appears from nowhere" regressions.
UpPauseOriginatorBound ==
    \A n \in NodeIds :
        pauseLocks[n] # {} =>
            pauseActionCount + upActionCount > 0

\* #16 — PausableOffStructural (§2.6 pausable: false).
\* When a node declares `Pausable[n] = "off"`, the protocol explicitly opts
\* out of lock tracking: the node MUST NOT accumulate pauseLocks and MUST NOT
\* divert outgoing settlements into a pauseBuffer. Runtime precedent: the
\* `fromTimer`-class source uses `pausable: false` because its flow control
\* is upstream of any downstream-originated PAUSE — stranding its ticks in a
\* buffer would silently break periodic work.
\*
\* Structural regression guard: if a future refactor accidentally routed
\* `Pause()` → `pauseLocks[src]` even when `Pausable[src] = "off"`, or
\* redirected `Emit()` → `pauseBuffer` while `Pausable[src] = "off"` but some
\* aggregate pause flag was on, this invariant trips. Trivially true by
\* construction today (see `Pause()` action's `Pausable[src] # "off"` guard
\* and `IsCapturedByBuffer(n)`'s `Pausable[n] = "resumeAll"` gate), but
\* invaluable as a lock-down on that contract.
PausableOffStructural ==
    \A n \in NodeIds :
        Pausable[n] = "off" =>
            (pauseLocks[n] = {} /\ pauseBuffer[n] = <<>>)

\* #17 — MultiSinkTracesConverge (§2.4 multi-sink iteration — full drain).
\*
\* When all queues drain AND all extra-sink pending queues drain, the primary
\* sink's trace at n must equal every extra sink's trace at n. Both saw the
\* same sequence of messages because every emission action atomically
\* enqueues the same payload to both the primary and each extra sink.
\*
\* This is strictly weaker than `MultiSinkIterationCoherent` (which catches
\* mid-iteration cache inconsistencies), but it's a good end-state sanity
\* check: if a future refactor decoupled the primary-trace append from the
\* extra-sink enqueue (e.g. dropped extra sinks on some message-type paths),
\* this invariant would trip at drain.
MultiSinkTracesConverge ==
    (AllQueuesEmpty /\ AllBuffersEmpty
        /\ \A n \in SinkIds : \A i \in 1..ExtraSinks[n] :
             pendingExtraDelivery[n][i] = <<>>) =>
        \A n \in SinkIds :
            \A i \in 1..ExtraSinks[n] :
                extraSinkTrace[n][i] = trace[n]

\* #18 — MultiSinkIterationCoherent (§2.4 multi-sink iteration, structural form).
\*
\* Every DATA payload parked in `pendingExtraDelivery[n][i]` must carry a
\* snapshot whose cache-at-n matches the DATA's own value. This is the
\* per-item faithfulness contract: when a DATA is enqueued for an extra
\* sink, the runtime has already advanced `cache[n] = v`, so the snapshot
\* must reflect that advancement at the emitting-source's slot.
\*
\* Package 2 bug this catches: `BatchEmitMulti(src, vs)` previously stamped
\* every item in the K-emit bundle with `finalCacheVal` — so intermediate
\* DATAs in a `<<1, 2>>` batch would falsely carry snap[src] = 2 while
\* msg.value = 1. Invariant trips with a concrete counter-example pending
\* queue.
\*
\* This is the STRUCTURAL form — it verifies enqueue-time faithfulness. A
\* stricter DRIFT form (compare `msg.value` against CURRENT `cache[n]` at
\* delivery) would catch COMPOSITION-GUIDE §32-class peer-read bugs where a
\* nested emit advances cache between enqueue and dequeue. That drift form
\* requires gating emission actions on `AllExtraPendingEmpty` so only
\* `SinkNestedEmit` populates pending mid-iteration — tracked as the still-
\* deferred portion of this work in docs/optimizations.md.
MultiSinkIterationCoherent ==
    \A n \in SinkIds :
        \A i \in 1..ExtraSinks[n] :
            \A j \in 1..Len(pendingExtraDelivery[n][i]) :
                LET item == pendingExtraDelivery[n][i][j] IN
                item.msg.type = DATA => item.snap[n] = item.msg.value

\* #19 — CleanupWitnessInValueDomain (§1.4 INVALIDATE, added 2026-04-23 batch 3
\* Package 6).
\*
\* Every entry in `cleanupWitness[n]` holds a value in `Values` — i.e., the
\* cleanup hook observed a REAL cached state, not the post-reset sentinel
\* (SENTINEL values are outside `Values` in this model since `cache` is typed
\* `[NodeIds -> Values]`). Tautological at write time by construction of the
\* `Invalidate(n)` action (it appends `cache[n]` before any reset) — but this
\* invariant is the regression guard: a future variant of `Invalidate` that
\* reorders the reset BEFORE the witness write would trip it immediately.
\* Vacuous when `InvalidateOriginators = {}` (all existing MCs default).
CleanupWitnessInValueDomain ==
    \A n \in NodeIds :
        \A k \in 1..Len(cleanupWitness[n]) :
            cleanupWitness[n][k] \in Values

\* #20 — ReplayBufferBounded (§2.5 replayBuffer, added 2026-04-23 batch 3
\* Package 3). Structural bound: `replayBuffer[n]` never exceeds
\* `ReplayBufferSize[n]` — the ring's drop-oldest-on-cap logic is enforced.
\* Vacuous when `ReplayBufferSize[n] = 0` (all existing MCs default).
ReplayBufferBounded ==
    \A n \in NodeIds : Len(replayBuffer[n]) <= ReplayBufferSize[n]

\* #21 — MultiSinkIterationDriftClean (§2.4 drift form) — DEFERRED.
\*
\* The gate helper `AllExtraPendingEmpty` ships; the stricter drift
\* invariant (`item.msg.value = cache[n]` for every pending DATA) does NOT
\* ship because it false-positives on `BatchEmitMulti`'s atomic K-emit
\* cache advance: the TLA+ model enqueues K pending items in one atomic
\* step but cache ends at the FINAL value, so intermediate DATA items
\* appear to "drift" even without §32 nested-emit interference.
\*
\* Clean fix requires refactoring `BatchEmitMulti` into K separate step
\* actions (each enqueuing one item, advancing cache one step) — substantial
\* restructuring that loses the atomicity-simplification currently used to
\* keep state space tractable. Tracked in docs/optimizations.md as the
\* remaining deferred portion of Package 2.
\*
\* What ships: the emission-action gate. Under it, the runtime's atomic
\* iteration semantic is modeled structurally — other emission actions
\* serialize with the extra-sink drain. The regression catcher for the
\* §32 bug at the multi-sink primitive layer remains the existing
\* `MultiSinkIterationCoherent` (#18, per-item faithfulness).

\* #22 — MetaTeardownObservedPreReset (§2.3 meta companion, added 2026-04-23
\* batch 3 Package 7).
\*
\* Every witness entry records what a meta child saw when TEARDOWN fanned
\* out: parent's cache + status at that moment. Both must be pre-reset —
\* cache in `Values` domain (not a sentinel), status in {"settled","dirty"}
\* (never "terminated"). Tautological at write time by construction of the
\* `Teardown(parent)` action (it guards `status[parent] # "terminated"`
\* before recording, and cache is always in Values by `TypeOK`) — but this
\* invariant is the regression guard: a future refactor that reorders the
\* parent's own state transition BEFORE the meta fan-out would trip it
\* immediately. Vacuous when `MetaCompanions = [n |-> {}]` (all existing
\* MCs default).
MetaTeardownObservedPreReset ==
    \A child \in NodeIds :
        \A k \in 1..Len(teardownWitness[child]) :
            LET w == teardownWitness[child][k] IN
            /\ w.cache \in Values
            /\ w.status \in {"settled", "dirty"}

----------------------------------------------------------------------------
(* Type invariant — guards against syntactic drift during model changes. *)
TypeOK ==
    /\ cache \in [NodeIds -> Values]
    /\ status \in [NodeIds -> {"settled", "dirty", "terminated"}]
    /\ version \in [NodeIds -> Nat]
    /\ dirtyMask \in [NodeIds -> SUBSET NodeIds]
    /\ queues \in [EdgePairs -> Seq([type: MsgTypes, value: PayloadDomain])]
    /\ trace \in [NodeIds -> Seq([type: MsgTypes, value: PayloadDomain])]
    /\ emitCount \in Nat
    /\ perSourceEmitCount \in [NodeIds -> Nat]
    /\ activated \in [NodeIds -> BOOLEAN]
    /\ handshake \in [NodeIds -> Seq([type: MsgTypes, value: PayloadDomain])]
    /\ nestedEmitCount \in Nat
    \* emitWitness is a ghost sequence of structured records; we keep its type
    \* check loose because the inner `parents` map is defined over Parents(n),
    \* a per-node subset of NodeIds — encoding that precisely in TLC's type
    \* system costs more than it buys in catching drift.
    /\ \A n \in NodeIds : emitWitness[n] \in Seq([value: PayloadDomain,
                                                    parents: [Parents(n) -> PayloadDomain]])
    /\ pauseLocks \in [NodeIds -> SUBSET LockIds]
    /\ pauseBuffer \in [NodeIds -> Seq([type: MsgTypes, value: PayloadDomain])]
    /\ resubscribeCount \in Nat
    /\ pauseActionCount \in Nat
    /\ upQueues \in [EdgePairs -> Seq([type: MsgTypes, value: PayloadDomain])]
    /\ upActionCount \in Nat
    \* extraSinkTrace / pendingExtraDelivery are loose-typed like emitWitness:
    \* the inner index range `1..ExtraSinks[n]` varies per node, and TLC's
    \* type system doesn't benefit from encoding it precisely — catches drift
    \* structurally via `DeliverToExtraSink`'s action guards instead.
    /\ \A n \in NodeIds : extraSinkTrace[n] \in
            [1..ExtraSinks[n] -> Seq([type: MsgTypes, value: PayloadDomain])]
    /\ \A n \in NodeIds : pendingExtraDelivery[n] \in
            [1..ExtraSinks[n] -> Seq([msg: [type: MsgTypes, value: PayloadDomain],
                                       snap: [NodeIds -> Values]])]
    /\ invalidateCount \in Nat
    /\ cleanupWitness \in [NodeIds -> Seq(Values)]
    /\ replayBuffer \in [NodeIds -> Seq(Values)]
    /\ teardownCount \in Nat
    /\ teardownWitness \in [NodeIds ->
            Seq([cache: Values, status: {"settled", "dirty", "terminated"}])]

============================================================================
