-------------------------- MODULE wave_rewire_emit --------------------------
(***************************************************************************
GraphReFly — rewire × multi-sink (conformance C-8, rule R-rewire,
decision D42 SD-2 / backlog B14).

The cross-axis companion to wave_rewire.tla. wave_rewire.tla models the per-node
DEP side (Q1–Q7 + INVALIDATE-drain + terminal-reject) but deliberately OMITS C's
downstream fn-fire-emit. This module supplies exactly that omitted DOWNSTREAM
dimension and composes it with rewire, to discharge the cross-axis D42 SD-2
requires before R-rewire flips active:

  - rewire × multi-sink: C fans every settle out to ALL downstream sinks
                         IDENTICALLY; a rewire (upstream-only) never desyncs the
                         sink streams. Witness: MultiSinkConsistent.

Cache integrity across rewire is also witnessed: C's cache always equals the
last DATA it emitted, and a rewire PRESERVES that cache (Q7, proved in
wave_rewire.tla). Witnesses: CacheMatchesLastData, RewirePreservesCacheEmit.

ABSTRACTION: rewire is modeled on the EMIT side only — it PRESERVES cache and
never touches the sink streams (the dep-side mechanics are wave_rewire.tla's job).
A post-rewire Emit may produce ANY output value (deps changed). Per D49 every
value-occurrence emits DATA — there is no value-equality substitution. Together
with wave_rewire.tla's cache-preservation (Q7) this covers the cross-axis.

Status: draft (with wave_rewire.tla, completes the D42 SD-2 formal gate).
 ***************************************************************************)
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS Sinks, Values, MaxEmits, MaxRewires, MaxDeliveries

SENTINEL == "SENTINEL"
ValueOrSentinel == Values \cup {SENTINEL}

DataMsg(v)  == [type |-> "DATA", val |-> v]
ResolvedMsg == [type |-> "RESOLVED"]
DownMsg     == ([type : {"DATA"}, val : Values]) \cup ([type : {"RESOLVED"}])

VARIABLES
    cache,        \* C's output cache
    sinkQueue,    \* [Sinks -> Seq(DownMsg)] — C's outgoing slice per sink
    observed,     \* [Sinks -> Seq(DownMsg)] — what each sink has drained
    emitCount, rewireCount, delivCount,
    ghostPreCache, ghostJustRewired

vars == <<cache, sinkQueue, observed, emitCount, rewireCount, delivCount,
          ghostPreCache, ghostJustRewired>>

RECURSIVE LastDataVal(_)
LastDataVal(seq) ==
    IF seq = <<>> THEN SENTINEL
    ELSE IF seq[Len(seq)].type = "DATA" THEN seq[Len(seq)].val
    ELSE LastDataVal(SubSeq(seq, 1, Len(seq) - 1))

TypeOK ==
    /\ cache \in ValueOrSentinel
    /\ \A k \in Sinks : \A i \in DOMAIN sinkQueue[k] : sinkQueue[k][i] \in DownMsg
    /\ \A k \in Sinks : \A i \in DOMAIN observed[k] : observed[k][i] \in DownMsg
    /\ ghostPreCache \in ValueOrSentinel
    /\ ghostJustRewired \in BOOLEAN

Init ==
    /\ cache = SENTINEL
    /\ sinkQueue = [k \in Sinks |-> <<>>]
    /\ observed = [k \in Sinks |-> <<>>]
    /\ emitCount = 0
    /\ rewireCount = 0
    /\ delivCount = 0
    /\ ghostPreCache = SENTINEL
    /\ ghostJustRewired = FALSE

\* C settles with output `out`. Per D49 every value-occurrence emits DATA —
\* there is no value-equality substitution to RESOLVED. The settle fans out
\* to EVERY sink IDENTICALLY (multi-sink atomic broadcast).
Emit(out) ==
    /\ emitCount < MaxEmits
    /\ LET msg == DataMsg(out)
       IN
       /\ cache' = out
       /\ sinkQueue' = [k \in Sinks |-> Append(sinkQueue[k], msg)]
    /\ emitCount' = emitCount + 1
    /\ ghostJustRewired' = FALSE
    /\ UNCHANGED <<observed, rewireCount, delivCount, ghostPreCache>>

\* A sink drains one message into its observed trace.
DeliverToSink(k) ==
    /\ Len(sinkQueue[k]) > 0
    /\ delivCount < MaxDeliveries
    /\ observed' = [observed EXCEPT ![k] = Append(@, Head(sinkQueue[k]))]
    /\ sinkQueue' = [sinkQueue EXCEPT ![k] = Tail(@)]
    /\ delivCount' = delivCount + 1
    /\ ghostJustRewired' = FALSE
    /\ UNCHANGED <<cache, emitCount, rewireCount, ghostPreCache>>

\* Rewire (upstream-only): PRESERVES cache, never touches the sink streams. The
\* deps changed, so a later Emit may produce any value, but cache stays intact
\* across the rewire (Q7). Load-bearing: corrupt cache here and
\* CacheMatchesLastData / RewirePreservesCacheEmit trip.
Rewire ==
    /\ rewireCount < MaxRewires
    /\ cache' = cache
    /\ rewireCount' = rewireCount + 1
    /\ ghostPreCache' = cache
    /\ ghostJustRewired' = TRUE
    /\ UNCHANGED <<sinkQueue, observed, emitCount, delivCount>>

Next ==
    \/ \E out \in Values : Emit(out)
    \/ \E k \in Sinks : DeliverToSink(k)
    \/ Rewire

Spec == Init /\ [][Next]_vars

----------------------------------------------------------------------------
(*                             INVARIANTS                                 *)

\* rewire × multi-sink: every sink observes the SAME full stream (drained ++ queued).
\* Load-bearing: make Emit append to one sink only and this trips.
MultiSinkConsistent ==
    \A k1, k2 \in Sinks : observed[k1] \o sinkQueue[k1] = observed[k2] \o sinkQueue[k2]

\* cache always equals the last DATA in the emitted stream, and a rewire never
\* corrupts it. Ties cache integrity to the emit stream across rewire.
\* Load-bearing: corrupt cache in Rewire.
CacheMatchesLastData ==
    \A k \in Sinks : cache = LastDataVal(observed[k] \o sinkQueue[k])

\* Q7 on the emit side: rewire preserves cache.
RewirePreservesCacheEmit ==
    ghostJustRewired => cache = ghostPreCache
=============================================================================
