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
    MaxNestedEmits        \* Bound on SinkNestedEmit firings (prevents unbounded fanout).

ASSUME SourceIds \subseteq NodeIds
ASSUME SinkIds \subseteq NodeIds
ASSUME Edges \subseteq (NodeIds \X NodeIds)
ASSUME DefaultInitial \in Values
ASSUME GapAwareActivation \in BOOLEAN
ASSUME SinkNestedEmits \subseteq (NodeIds \X NodeIds \X Values)
ASSUME MaxNestedEmits \in Nat

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
MsgTypes == {START, DIRTY, DATA, RESOLVED, COMPLETE, ERROR}

\* A message: type + always-present payload. For tuples that have no
\* semantic payload (DIRTY, RESOLVED, COMPLETE, ERROR) we use the
\* integer sentinel `NullPayload = -1`, which is outside `Values` so
\* equality is homogeneous for TLC's hashing.
NullPayload == -1
PayloadDomain == Values \cup {NullPayload}

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
    emitWitness       \* NodeId -> Seq of <<value, [p \in Parents(n) |-> cache[p]]>>

vars == <<cache, status, version, dirtyMask, queues, trace, emitCount,
          activated, handshake, nestedEmitCount, emitWitness>>

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

----------------------------------------------------------------------------
(* A source emits a value. Per equals-substitution at the source:
   - if v = cache[src]: enqueue [DIRTY, RESOLVED], no cache/version change
   - else:              enqueue [DIRTY, DATA(v)], cache' := v, version' += 1
   The source itself observes its own emission if it's a sink.
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
       IN
       /\ queues' = EnqueueSeqOutFrom(queues, src, pair)
       /\ trace'  = RecordSeqAtSinkIfAny(trace, src, pair)
       /\ cache'   = IF equalToCache THEN cache
                                     ELSE [cache EXCEPT ![src] = v]
       /\ version' = IF equalToCache THEN version
                                     ELSE [version EXCEPT ![src] = @ + 1]
       /\ UNCHANGED <<status, dirtyMask, activated, handshake,
                      nestedEmitCount, emitWitness>>
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
           bundle == DirtySeqOf(Len(vs)) \o settles
       IN
       /\ queues' = EnqueueSeqOutFrom(queues, src, bundle)
       /\ trace'  = RecordSeqAtSinkIfAny(trace, src, bundle)
       /\ cache'  = [cache EXCEPT ![src] = finalCacheVal]
       /\ version' = [version EXCEPT ![src] = @ + dataCount]
       /\ UNCHANGED <<status, dirtyMask, activated, handshake,
                      nestedEmitCount, emitWitness>>
       /\ emitCount' = emitCount + Len(vs)

(* A source terminates. Enqueues COMPLETE to every child and transitions
   to "terminated" — the source refuses further Emit actions thereafter.
*)
Terminate(src) ==
    /\ src \in SourceIds
    /\ status[src] = "settled"
    /\ LET m == Msg(COMPLETE, NullPayload) IN
       /\ queues' = EnqueueOutFrom(queues, src, m)
       /\ trace'  = RecordAtSinkIfAny(trace, src, m)
       /\ status' = [status EXCEPT ![src] = "terminated"]
       /\ UNCHANGED <<cache, version, dirtyMask, emitCount, activated, handshake,
                      nestedEmitCount, emitWitness>>

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
                      nestedEmitCount, emitWitness>>

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
                 /\ emitWitness' = emitWitness
                 /\ UNCHANGED <<cache, status, version>>
            ELSE LET newCache  == Compute(c, cache)
                     sameAsOld == newCache = cache[c]
                     settleMsg == IF sameAsOld THEN Msg(RESOLVED, NullPayload)
                                               ELSE Msg(DATA, newCache)
                     \* Record a ghost witness when a multi-parent derived emits DATA:
                     \* the value it chose, plus the parents' cache values at the
                     \* moment of recompute. Used by NestedDrainPeerConsistency.
                     witness == [value |-> newCache,
                                 parents |-> [pp \in Parents(c) |-> cache[pp]]]
                     isMultiParentDataEmit ==
                         ~sameAsOld /\ Cardinality(Parents(c)) >= 2
                 IN
                 /\ queues' = EnqueueOutFrom(qs0, c, settleMsg)
                 /\ trace'  = RecordAtSinkIfAny(trace, c, settleMsg)
                 /\ cache'  = IF sameAsOld THEN cache
                                            ELSE [cache EXCEPT ![c] = newCache]
                 /\ version' = IF sameAsOld THEN version
                                             ELSE [version EXCEPT ![c] = @ + 1]
                 /\ status' = [status EXCEPT ![c] = "settled"]
                 /\ emitWitness' = IF isMultiParentDataEmit
                                     THEN [emitWitness EXCEPT ![c] = Append(@, witness)]
                                     ELSE emitWitness
       /\ UNCHANGED <<emitCount, activated, handshake, nestedEmitCount>>

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
       /\ UNCHANGED <<cache, version, dirtyMask, emitCount, activated, handshake,
                      nestedEmitCount, emitWitness>>

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
                         nestedEmitCount, emitWitness>>

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
       IN
       /\ queues' = EnqueueSeqOutFrom(queues, target, pair)
       /\ trace'  = RecordSeqAtSinkIfAny(trace, target, pair)
       /\ cache'   = IF equalToCache THEN cache
                                     ELSE [cache EXCEPT ![target] = v]
       /\ version' = IF equalToCache THEN version
                                     ELSE [version EXCEPT ![target] = @ + 1]
       /\ UNCHANGED <<status, dirtyMask, activated, handshake, emitWitness>>
       /\ emitCount' = emitCount + 1
       /\ nestedEmitCount' = nestedEmitCount + 1

Next ==
    \/ \E src \in SourceIds, v \in Values : Emit(src, v)
    \/ \E src \in SourceIds, vs \in BatchSeqs : BatchEmitMulti(src, vs)
    \/ \E src \in SourceIds : Terminate(src)
    \/ \E sid \in SinkIds : SubscribeSink(sid)
    \/ \E triple \in SinkNestedEmits :
         SinkNestedEmit(triple[1], triple[2], triple[3])
    \/ \E e \in EdgePairs :
        \/ DeliverDirty(e[1], e[2])
        \/ DeliverSettle(e[1], e[2])
        \/ DeliverTerminal(e[1], e[2])

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
\*     flight via a downstream queue. For model-checking simplicity we
\*     assert: at states where all queues drain to empty, every sink's
\*     DIRTY count equals (DATA+RESOLVED) count.
AllQueuesEmpty == \A e \in EdgePairs : queues[e] = <<>>

BalancedWaves ==
    AllQueuesEmpty =>
        \A n \in SinkIds :
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
EqualsFaithful ==
    \A s \in (SourceIds \cap SinkIds) :
        Cardinality({i \in 1..Len(trace[s]) :
                       trace[s][i].type \in {DATA, RESOLVED}})
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
    AllQueuesEmpty =>
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
        version[s] =
            Cardinality({i \in 1..Len(trace[s]) : trace[s][i].type = DATA})

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

============================================================================
