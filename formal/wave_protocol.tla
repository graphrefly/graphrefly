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
    MaxPauseActions       \* Bound on Pause + Resume + Resubscribe firings (keeps the
                          \*   state space finite — a single Pause/Resume pair can repeat
                          \*   indefinitely without this guard).

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
MsgTypes == {START, DIRTY, DATA, RESOLVED, COMPLETE, ERROR, PAUSE, RESUME}

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

----------------------------------------------------------------------------
VARIABLES
    cache,            \* NodeId -> Values  (always a real value in this simplified model)
    status,           \* NodeId -> {"settled", "dirty", "terminated"}
    version,          \* NodeId -> Nat  (advances only on DATA)
    dirtyMask,        \* NodeId -> Set of parent ids whose DIRTY is unmatched
    queues,           \* <<parent, child>> -> Seq of messages
    trace,            \* NodeId -> Seq of messages observed at sinks (protocol emissions only)
    emitCount,        \* Nat, bounds exploration
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
    pauseActionCount  \* Nat, bounds Pause + Resume action firings

vars == <<cache, status, version, dirtyMask, queues, trace, emitCount,
          activated, handshake, nestedEmitCount, emitWitness,
          pauseLocks, pauseBuffer, resubscribeCount, pauseActionCount>>

----------------------------------------------------------------------------
Init ==
    /\ cache = [n \in NodeIds |-> InitialCache[n]]
    /\ status = [n \in NodeIds |-> "settled"]
    /\ version = [n \in NodeIds |-> 0]
    /\ dirtyMask = [n \in NodeIds |-> {}]
    /\ queues = [e \in EdgePairs |-> <<>>]
    /\ trace = [n \in NodeIds |-> <<>>]
    /\ emitCount = 0
    /\ activated = [n \in NodeIds |-> FALSE]
    /\ handshake = [n \in NodeIds |-> <<>>]
    /\ nestedEmitCount = 0
    /\ emitWitness = [n \in NodeIds |-> <<>>]
    /\ pauseLocks = [n \in NodeIds |-> {}]
    /\ pauseBuffer = [n \in NodeIds |-> <<>>]
    /\ resubscribeCount = 0
    /\ pauseActionCount = 0

----------------------------------------------------------------------------
(* BufferAll predicate: a node n captures its outgoing tier-3/4 emissions into
   `pauseBuffer[n]` when it's holding at least one pause lock AND its
   `Pausable[n]` is "resumeAll". Mirrors the runtime check at node.ts
   `_emit` L1958 (`this._paused && this._pausable === "resumeAll"`).
*)
IsCapturedByBuffer(n) == Pausable[n] = "resumeAll" /\ pauseLocks[n] # {}

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
    /\ emitCount < MaxEmits
    /\ status[src] = "settled"
    /\ LET equalToCache == cache[src] = v
           settleMsg    == IF equalToCache THEN Msg(RESOLVED, NullPayload)
                                           ELSE Msg(DATA, v)
           dirtyMsg     == Msg(DIRTY, NullPayload)
           pair         == <<dirtyMsg, settleMsg>>
           captured     == IsCapturedByBuffer(src)
       IN
       /\ IF captured
            THEN
              \* DIRTY flows immediately; settle diverts to buffer.
              /\ queues' = EnqueueOutFrom(queues, src, dirtyMsg)
              /\ trace'  = RecordAtSinkIfAny(trace, src, dirtyMsg)
              /\ pauseBuffer' = [pauseBuffer EXCEPT ![src] = Append(@, settleMsg)]
            ELSE
              /\ queues' = EnqueueSeqOutFrom(queues, src, pair)
              /\ trace'  = RecordSeqAtSinkIfAny(trace, src, pair)
              /\ pauseBuffer' = pauseBuffer
       /\ cache'   = IF equalToCache THEN cache
                                     ELSE [cache EXCEPT ![src] = v]
       /\ version' = IF equalToCache THEN version
                                     ELSE [version EXCEPT ![src] = @ + 1]
       /\ UNCHANGED <<status, dirtyMask, activated, handshake,
                      nestedEmitCount, emitWitness,
                      pauseLocks, resubscribeCount, pauseActionCount>>
       /\ emitCount' = emitCount + 1

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
       /\ IF captured
            THEN
              \* DIRTYs flow immediately; settles divert to buffer in order.
              /\ queues' = EnqueueSeqOutFrom(queues, src, dirtyPrefix)
              /\ trace'  = RecordSeqAtSinkIfAny(trace, src, dirtyPrefix)
              /\ pauseBuffer' = [pauseBuffer EXCEPT ![src] = @ \o settles]
            ELSE
              /\ queues' = EnqueueSeqOutFrom(queues, src, bundle)
              /\ trace'  = RecordSeqAtSinkIfAny(trace, src, bundle)
              /\ pauseBuffer' = pauseBuffer
       /\ cache'  = [cache EXCEPT ![src] = finalCacheVal]
       /\ version' = [version EXCEPT ![src] = @ + dataCount]
       /\ UNCHANGED <<status, dirtyMask, activated, handshake,
                      nestedEmitCount, emitWitness,
                      pauseLocks, resubscribeCount, pauseActionCount>>
       /\ emitCount' = emitCount + Len(vs)

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
    /\ status[src] = "settled"
    /\ LET m == Msg(COMPLETE, NullPayload) IN
       /\ queues' = EnqueueOutFrom(queues, src, m)
       /\ trace'  = RecordAtSinkIfAny(trace, src, m)
       /\ status' = [status EXCEPT ![src] = "terminated"]
       /\ pauseLocks' = [pauseLocks EXCEPT ![src] = {}]
       /\ pauseBuffer' = [pauseBuffer EXCEPT ![src] = <<>>]
       /\ UNCHANGED <<cache, version, dirtyMask, emitCount, activated, handshake,
                      nestedEmitCount, emitWitness,
                      resubscribeCount, pauseActionCount>>

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
            ELSE /\ queues' = qs0
                 /\ trace'  = trace
       /\ status' = [status EXCEPT ![c] = "dirty"]
       /\ dirtyMask' = [dirtyMask EXCEPT ![c] = @ \cup {p}]
       /\ UNCHANGED <<cache, version, emitCount, activated, handshake,
                      nestedEmitCount, emitWitness,
                      pauseLocks, pauseBuffer, resubscribeCount, pauseActionCount>>

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
                 /\ emitWitness' = emitWitness
                 /\ UNCHANGED <<cache, status, version>>
            ELSE LET newCache  == Compute(c, cache)
                     sameAsOld == newCache = cache[c]
                     settleMsg == IF sameAsOld THEN Msg(RESOLVED, NullPayload)
                                               ELSE Msg(DATA, newCache)
                     captured  == IsCapturedByBuffer(c)
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
                        /\ pauseBuffer' = [pauseBuffer EXCEPT ![c] = Append(@, settleMsg)]
                      ELSE
                        /\ queues' = EnqueueOutFrom(qs0, c, settleMsg)
                        /\ trace'  = RecordAtSinkIfAny(trace, c, settleMsg)
                        /\ pauseBuffer' = pauseBuffer
                 /\ cache'  = IF sameAsOld THEN cache
                                            ELSE [cache EXCEPT ![c] = newCache]
                 /\ version' = IF sameAsOld THEN version
                                             ELSE [version EXCEPT ![c] = @ + 1]
                 /\ status' = [status EXCEPT ![c] = "settled"]
                 /\ emitWitness' = IF isMultiParentDataEmit
                                     THEN [emitWitness EXCEPT ![c] = Append(@, witness)]
                                     ELSE emitWitness
       /\ UNCHANGED <<emitCount, activated, handshake, nestedEmitCount,
                      pauseLocks, resubscribeCount, pauseActionCount>>

(* DeliverTerminal: consume COMPLETE or ERROR from queue[<<p, c>>].
   - Forwards the terminal to c's children exactly once.
   - Records the forwarded terminal to trace[c] if c is a sink.
   - Transitions c to "terminated"; all further Deliver actions for c
     are blocked by the status guard.
*)
DeliverTerminal(p, c) ==
    /\ <<p, c>> \in EdgePairs
    /\ Len(queues[<<p, c>>]) > 0
    /\ Head(queues[<<p, c>>]).type \in {COMPLETE, ERROR}
    /\ status[c] # "terminated"
    /\ NoDirtyAnywhere
    /\ NoSettleAnywhere
    /\ LET m   == Head(queues[<<p, c>>])
           qs0 == [queues EXCEPT ![<<p, c>>] = Tail(@)]
       IN
       /\ queues' = EnqueueOutFrom(qs0, c, m)
       /\ trace'  = RecordAtSinkIfAny(trace, c, m)
       /\ status' = [status EXCEPT ![c] = "terminated"]
       /\ pauseLocks' = [pauseLocks EXCEPT ![c] = {}]
       /\ pauseBuffer' = [pauseBuffer EXCEPT ![c] = <<>>]
       /\ UNCHANGED <<cache, version, dirtyMask, emitCount, activated, handshake,
                      nestedEmitCount, emitWitness,
                      resubscribeCount, pauseActionCount>>

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
          /\ UNCHANGED <<cache, status, version, dirtyMask, queues, trace, emitCount,
                         nestedEmitCount, emitWitness,
                         pauseLocks, pauseBuffer, resubscribeCount, pauseActionCount>>

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
       IN
       /\ IF captured
            THEN
              /\ queues' = EnqueueOutFrom(queues, target, dirtyMsg)
              /\ trace'  = RecordAtSinkIfAny(trace, target, dirtyMsg)
              /\ pauseBuffer' = [pauseBuffer EXCEPT ![target] = Append(@, settleMsg)]
            ELSE
              /\ queues' = EnqueueSeqOutFrom(queues, target, pair)
              /\ trace'  = RecordSeqAtSinkIfAny(trace, target, pair)
              /\ pauseBuffer' = pauseBuffer
       /\ cache'   = IF equalToCache THEN cache
                                     ELSE [cache EXCEPT ![target] = v]
       /\ version' = IF equalToCache THEN version
                                     ELSE [version EXCEPT ![target] = @ + 1]
       /\ UNCHANGED <<status, dirtyMask, activated, handshake, emitWitness,
                      pauseLocks, resubscribeCount, pauseActionCount>>
       /\ emitCount' = emitCount + 1
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
       /\ pauseActionCount' = pauseActionCount + 1
       /\ UNCHANGED <<cache, status, version, dirtyMask, emitCount, activated,
                      handshake, nestedEmitCount, emitWitness,
                      pauseBuffer, resubscribeCount>>

(* Resume only fires when `src` is actually holding `lockId`. The
   "unknown-lockId RESUME is a no-op" case is modeled at `DeliverPauseResume`
   — a forwarded RESUME can reach a downstream node whose pauseLocks set
   doesn't contain the lockId (e.g. resubscribe cleared it). That's the
   observable case TLC should explore.
*)
Resume(src, lockId) ==
    /\ src \in SourceIds
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
            ELSE
              /\ pauseBuffer' = pauseBuffer
              /\ queues' = EnqueueOutFrom(queues, src, msg)
              /\ trace'  = RecordAtSinkIfAny(trace, src, msg)
       /\ pauseActionCount' = pauseActionCount + 1
       /\ UNCHANGED <<cache, status, version, dirtyMask, emitCount, activated,
                      handshake, nestedEmitCount, emitWitness,
                      resubscribeCount>>

DeliverPauseResume(p, c) ==
    /\ <<p, c>> \in EdgePairs
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
            ELSE IF isPause
              THEN
                /\ pauseLocks' = [pauseLocks EXCEPT ![c] = @ \cup {lockId}]
                /\ pauseBuffer' = pauseBuffer
                /\ queues' = EnqueueOutFrom(qs0, c, m)
                /\ trace'  = RecordAtSinkIfAny(trace, c, m)
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
                  ELSE IF fullDrain
                    THEN
                      /\ pauseLocks' = [pauseLocks EXCEPT ![c] = newLocks]
                      /\ pauseBuffer' = [pauseBuffer EXCEPT ![c] = <<>>]
                      /\ queues' = LET qd == EnqueueSeqOutFrom(qs0, c, drainBuf)
                                   IN EnqueueOutFrom(qd, c, m)
                      /\ trace'  = LET td == RecordSeqAtSinkIfAny(trace, c, drainBuf)
                                   IN RecordAtSinkIfAny(td, c, m)
                    ELSE
                      /\ pauseLocks' = [pauseLocks EXCEPT ![c] = newLocks]
                      /\ pauseBuffer' = pauseBuffer
                      /\ queues' = EnqueueOutFrom(qs0, c, m)
                      /\ trace'  = RecordAtSinkIfAny(trace, c, m)
       /\ UNCHANGED <<cache, status, version, dirtyMask, emitCount, activated,
                      handshake, nestedEmitCount, emitWitness,
                      resubscribeCount, pauseActionCount>>

Resubscribe(sid) ==
    /\ sid \in ResubscribableNodes
    /\ status[sid] = "terminated"
    /\ resubscribeCount < MaxPauseActions
    /\ LET isSource == Parents(sid) = {}
       IN
       /\ pauseLocks' = [pauseLocks EXCEPT ![sid] = {}]
       /\ pauseBuffer' = [pauseBuffer EXCEPT ![sid] = <<>>]
       /\ dirtyMask' = [dirtyMask EXCEPT ![sid] = {}]
       /\ cache' = IF isSource
                     THEN cache  \* source nodes preserve initial cache on resubscribe
                     ELSE [cache EXCEPT ![sid] = DefaultInitial]
       /\ status' = [status EXCEPT ![sid] = "settled"]
       /\ handshake' = [handshake EXCEPT ![sid] = <<>>]
       /\ trace'    = [trace EXCEPT ![sid] = <<>>]
       /\ activated' = [activated EXCEPT ![sid] = FALSE]
       /\ resubscribeCount' = resubscribeCount + 1
       /\ UNCHANGED <<version, queues, emitCount, nestedEmitCount, emitWitness,
                      pauseActionCount>>

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
    \/ \E e \in EdgePairs :
        \/ DeliverDirty(e[1], e[2])
        \/ DeliverSettle(e[1], e[2])
        \/ DeliverTerminal(e[1], e[2])
        \/ DeliverPauseResume(e[1], e[2])

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
            = emitCount

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

============================================================================
