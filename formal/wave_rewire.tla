-------------------------- MODULE wave_rewire --------------------------
(***************************************************************************
GraphReFly — intra-graph runtime rewire (replaceDeps / subscribeDep / unsubscribeDep)
(conformance C-8, rule R-rewire, decision D42 / phase CSP-2.5).

Ports the TLA+-verified port-model rewire design (graphrefly-ts
docs/research/wave_protocol_rewire.tla, 2026-05-03; 126k states, 0 violations;
design questions Q1–Q7) into the clean-slate formal dir, and EXTENDS it
(per D42 SD-2) with the two cross-axes the port-model deferred that compose
cleanly with the per-node queue/mask/status machinery:

  - rewire x INVALIDATE : a removed dep's queued messages (incl INVALIDATE) are
                          DRAINED by the internal SetDeps action and never land (NoStaleEdgeMessages).
  - rewire x terminal   : the internal SetDeps action is REJECTED on a terminal `this`
                          (RewireOnlyOnLiveNode); adding a non-resubscribable
                          terminal dep is rejected (guard-enforced).

D42 semantics pinned here (per-node, single-wave-serialized; matches the
port-model abstraction boundary):
  Q1 dirtyMask    : removed-dep bits cleared, added-dep bits start clean.
  Q2 firstRunPassed PRESERVED — rewire never re-arms the first-run gate.
  Q3 pauseLocks / pauseBuffer PRESERVED.
  Q4 prevData     : removed deps discarded, added deps SENTINEL until first DATA.
  Q6 sole-dirty-dep removal auto-settles the wave.
  Q7 compute cache PRESERVED across rewire (R-rom-ram).
  + push-on-subscribe for an added dep with cached DATA (R-push-subscribe).

ABSTRACTION BOUNDARY (NOT modeled here — see README + CSP-2.5 follow-up):
  No downstream fn-fire-emit. Therefore the rewire x equals (R-equals output
  DATA->RESOLVED absorption) and rewire x multi-sink (one node's >=2 downstream
  observers) cross-axes are NOT exercised in this focused model — they require
  the internal SetDeps action integrated into wave_protocol.tla (the design-notes
  deferred follow-up #1). Per D42 SD-2, R-rewire flips active only after that
  integration ALSO lands; this module covers the per-node + INVALIDATE-drain +
  terminal-reject subset.

Status: draft.
 ***************************************************************************)
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS
    Values,         \* payload alphabet
    LockIds,        \* pause lockset domain
    MaxEmits,       \* bound: EmitFromSource + SourceInvalidate firings
    MaxRewires,     \* bound: internal SetDeps firings
    MaxPauses,      \* bound: Pause + Resume firings
    MaxDeliveries,  \* bound: DeliverDirty/Data/Invalidate firings
    MaxTerminals    \* bound: Terminate firings

SENTINEL == "SENTINEL"
ValueOrSentinel == Values \cup {SENTINEL}

\* --- Hardcoded 3-node topology (clean-slate single-file convention) ---
\* A, B sources; C compute (initial deps {A}, rewire candidate universe {A,B}).
NodeIds       == {"A", "B", "C"}
SourceIds     == {"A", "B"}
ComputeIds    == {"C"}
InitialDeps   == [n \in NodeIds |-> IF n = "C" THEN {"A"} ELSE {}]
DepCandidates == [n \in NodeIds |-> IF n = "C" THEN {"A", "B"} ELSE {}]
\* A resubscribable terminal dep may be (re)added; a non-resubscribable terminal
\* dep is rejected (wedge, G1). Model A resubscribable, B not.
Resubscribable == {"A"}

EdgeUniverse == {<<p, c>> \in NodeIds \X NodeIds : p \in DepCandidates[c]}

DirtyMsg      == [type |-> "DIRTY"]
DataMsg(v)    == [type |-> "DATA", val |-> v]
InvalidateMsg == [type |-> "INVALIDATE"]
MessageDomain ==
    [type : {"DIRTY", "INVALIDATE"}]
        \cup [type : {"DATA"}, val : Values]

----------------------------------------------------------------------------
VARIABLES
    deps, cache, status, terminal, firstRunPassed, dirtyMask, prevData,
    queues, pauseLocks, pauseBuffer,
    emitCount, rewireCount, pauseActionCount, deliveryCount, terminalCount,
    ghostPreFirstRun, ghostPrePauseLocks, ghostPrePauseBuffer, ghostPreCache,
    ghostPreTerminal, ghostJustRewired

vars == <<deps, cache, status, terminal, firstRunPassed, dirtyMask, prevData,
          queues, pauseLocks, pauseBuffer,
          emitCount, rewireCount, pauseActionCount, deliveryCount, terminalCount,
          ghostPreFirstRun, ghostPrePauseLocks, ghostPrePauseBuffer, ghostPreCache,
          ghostPreTerminal, ghostJustRewired>>

----------------------------------------------------------------------------
\* Helpers
IsSource(n)   == n \in SourceIds
IsCompute(n)  == n \in ComputeIds
IsPaused(n)   == pauseLocks[n] # {}
IsTerminal(n) == terminal[n] # "none"
DefaultInit   == CHOOSE v \in Values : TRUE

----------------------------------------------------------------------------
Init ==
    /\ deps = InitialDeps
    /\ cache = [n \in NodeIds |-> IF IsSource(n) THEN DefaultInit ELSE SENTINEL]
    /\ status = [n \in NodeIds |-> "settled"]
    /\ terminal = [n \in NodeIds |-> "none"]
    /\ firstRunPassed = [n \in NodeIds |-> IsSource(n)]
    /\ dirtyMask = [n \in NodeIds |-> {}]
    /\ prevData = [n \in NodeIds |-> [d \in NodeIds |-> SENTINEL]]
    /\ queues = [e \in EdgeUniverse |-> <<>>]
    /\ pauseLocks = [n \in NodeIds |-> {}]
    /\ pauseBuffer = [n \in NodeIds |-> <<>>]
    /\ emitCount = 0
    /\ rewireCount = 0
    /\ pauseActionCount = 0
    /\ deliveryCount = 0
    /\ terminalCount = 0
    /\ ghostPreFirstRun = [n \in NodeIds |-> IsSource(n)]
    /\ ghostPrePauseLocks = [n \in NodeIds |-> {}]
    /\ ghostPrePauseBuffer = [n \in NodeIds |-> <<>>]
    /\ ghostPreCache = [n \in NodeIds |-> IF IsSource(n) THEN DefaultInit ELSE SENTINEL]
    /\ ghostPreTerminal = [n \in NodeIds |-> "none"]
    /\ ghostJustRewired = [n \in NodeIds |-> FALSE]

----------------------------------------------------------------------------
\* ACTIONS

\* Source emits DATA — two-phase [DIRTY, DATA(v)] to each active child edge.
EmitFromSource(src, v) ==
    /\ IsSource(src)
    /\ ~IsTerminal(src)
    /\ ~IsPaused(src)
    /\ emitCount < MaxEmits
    /\ cache' = [cache EXCEPT ![src] = v]
    /\ status' = [status EXCEPT ![src] = "settled"]
    /\ queues' = [e \in EdgeUniverse |->
                    IF e[1] = src /\ src \in deps[e[2]]
                    THEN Append(Append(queues[e], DirtyMsg), DataMsg(v))
                    ELSE queues[e]]
    /\ emitCount' = emitCount + 1
    /\ ghostJustRewired' = [n \in NodeIds |-> FALSE]
    /\ UNCHANGED <<deps, terminal, firstRunPassed, dirtyMask, prevData,
                   pauseLocks, pauseBuffer, rewireCount, pauseActionCount,
                   deliveryCount, terminalCount, ghostPreFirstRun,
                   ghostPrePauseLocks, ghostPrePauseBuffer, ghostPreCache,
                   ghostPreTerminal>>

\* Source invalidates — enqueue INVALIDATE to each active child edge, clear own cache.
SourceInvalidate(src) ==
    /\ IsSource(src)
    /\ ~IsTerminal(src)
    /\ ~IsPaused(src)
    /\ emitCount < MaxEmits
    /\ cache[src] # SENTINEL
    /\ cache' = [cache EXCEPT ![src] = SENTINEL]
    /\ queues' = [e \in EdgeUniverse |->
                    IF e[1] = src /\ src \in deps[e[2]]
                    THEN Append(queues[e], InvalidateMsg)
                    ELSE queues[e]]
    /\ emitCount' = emitCount + 1
    /\ ghostJustRewired' = [n \in NodeIds |-> FALSE]
    /\ UNCHANGED <<deps, status, terminal, firstRunPassed, dirtyMask, prevData,
                   pauseLocks, pauseBuffer, rewireCount, pauseActionCount,
                   deliveryCount, terminalCount, ghostPreFirstRun,
                   ghostPrePauseLocks, ghostPrePauseBuffer, ghostPreCache,
                   ghostPreTerminal>>

\* Deliver DIRTY at child c from parent p.
DeliverDirty(p, c) ==
    /\ <<p, c>> \in EdgeUniverse
    /\ p \in deps[c]
    /\ Len(queues[<<p, c>>]) > 0
    /\ Head(queues[<<p, c>>]).type = "DIRTY"
    /\ deliveryCount < MaxDeliveries
    /\ queues' = [queues EXCEPT ![<<p, c>>] = Tail(@)]
    /\ dirtyMask' = [dirtyMask EXCEPT ![c] = @ \cup {p}]
    /\ status' = [status EXCEPT ![c] = "dirty"]
    /\ deliveryCount' = deliveryCount + 1
    /\ ghostJustRewired' = [n \in NodeIds |-> FALSE]
    /\ UNCHANGED <<deps, cache, terminal, firstRunPassed, prevData,
                   pauseLocks, pauseBuffer, emitCount, rewireCount,
                   pauseActionCount, terminalCount, ghostPreFirstRun,
                   ghostPrePauseLocks, ghostPrePauseBuffer, ghostPreCache,
                   ghostPreTerminal>>

\* Deliver DATA(v) at child c from parent p: prevData[c][p]=v, clear dirty bit,
\* settle if mask empty, open the first-run gate when all deps non-SENTINEL.
DeliverData(p, c) ==
    /\ <<p, c>> \in EdgeUniverse
    /\ p \in deps[c]
    /\ Len(queues[<<p, c>>]) > 0
    /\ Head(queues[<<p, c>>]).type = "DATA"
    /\ deliveryCount < MaxDeliveries
    /\ LET v == Head(queues[<<p, c>>]).val
           newMask == dirtyMask[c] \ {p}
           gateNow == IsCompute(c) /\ newMask = {} /\
                        \A d \in deps[c] :
                          (IF d = p THEN v ELSE prevData[c][d]) # SENTINEL
       IN
       /\ queues' = [queues EXCEPT ![<<p, c>>] = Tail(@)]
       /\ prevData' = [prevData EXCEPT ![c][p] = v]
       /\ dirtyMask' = [dirtyMask EXCEPT ![c] = newMask]
       /\ status' = IF newMask = {} THEN [status EXCEPT ![c] = "settled"] ELSE status
       /\ firstRunPassed' = [firstRunPassed EXCEPT ![c] = firstRunPassed[c] \/ gateNow]
       /\ cache' = IF gateNow THEN [cache EXCEPT ![c] = v] ELSE cache
    /\ deliveryCount' = deliveryCount + 1
    /\ ghostJustRewired' = [n \in NodeIds |-> FALSE]
    /\ UNCHANGED <<deps, terminal, pauseLocks, pauseBuffer, emitCount,
                   rewireCount, pauseActionCount, terminalCount,
                   ghostPreFirstRun, ghostPrePauseLocks, ghostPrePauseBuffer,
                   ghostPreCache, ghostPreTerminal>>

\* Deliver INVALIDATE at child c from parent p (lifecycle-continue, C-3):
\* dep's prevData -> SENTINEL, clear dirty bit, clear c's cache. Does NOT
\* re-arm the first-run gate (firstRunPassed UNCHANGED).
DeliverInvalidate(p, c) ==
    /\ <<p, c>> \in EdgeUniverse
    /\ p \in deps[c]
    /\ Len(queues[<<p, c>>]) > 0
    /\ Head(queues[<<p, c>>]).type = "INVALIDATE"
    /\ deliveryCount < MaxDeliveries
    /\ queues' = [queues EXCEPT ![<<p, c>>] = Tail(@)]
    /\ prevData' = [prevData EXCEPT ![c][p] = SENTINEL]
    /\ dirtyMask' = [dirtyMask EXCEPT ![c] = @ \ {p}]
    /\ cache' = IF IsCompute(c) THEN [cache EXCEPT ![c] = SENTINEL] ELSE cache
    /\ status' = [status EXCEPT ![c] = "settled"]
    /\ deliveryCount' = deliveryCount + 1
    /\ ghostJustRewired' = [n \in NodeIds |-> FALSE]
    /\ UNCHANGED <<deps, terminal, firstRunPassed, pauseLocks, pauseBuffer,
                   emitCount, rewireCount, pauseActionCount, terminalCount,
                   ghostPreFirstRun, ghostPrePauseLocks, ghostPrePauseBuffer,
                   ghostPreCache, ghostPreTerminal>>

\* A node goes terminal (COMPLETE/ERROR via dep-cascade R-deps-terminal, or
\* TEARDOWN — graph-owned). Abstracted: any node may reach a terminal state;
\* the rewire-reject rule only cares THAT `this` is terminal, not how.
Terminate(src, k) ==
    /\ ~IsTerminal(src)
    /\ k \in {"completed", "errored"}
    /\ terminalCount < MaxTerminals
    /\ terminal' = [terminal EXCEPT ![src] = k]
    /\ terminalCount' = terminalCount + 1
    /\ ghostJustRewired' = [n \in NodeIds |-> FALSE]
    /\ UNCHANGED <<deps, cache, status, firstRunPassed, dirtyMask, prevData,
                   queues, pauseLocks, pauseBuffer, emitCount, rewireCount,
                   pauseActionCount, deliveryCount, ghostPreFirstRun,
                   ghostPrePauseLocks, ghostPrePauseBuffer, ghostPreCache,
                   ghostPreTerminal>>

\* Pause node n with lockId l.
Pause(n, l) ==
    /\ pauseActionCount < MaxPauses
    /\ l \notin pauseLocks[n]
    /\ pauseLocks' = [pauseLocks EXCEPT ![n] = @ \cup {l}]
    /\ pauseActionCount' = pauseActionCount + 1
    /\ ghostJustRewired' = [n2 \in NodeIds |-> FALSE]
    /\ UNCHANGED <<deps, cache, status, terminal, firstRunPassed, dirtyMask,
                   prevData, queues, pauseBuffer, emitCount, rewireCount,
                   deliveryCount, terminalCount, ghostPreFirstRun,
                   ghostPrePauseLocks, ghostPrePauseBuffer, ghostPreCache,
                   ghostPreTerminal>>

\* Resume node n with lockId l; drain pauseBuffer on final-lock release.
Resume(n, l) ==
    /\ pauseActionCount < MaxPauses
    /\ l \in pauseLocks[n]
    /\ LET newLocks == pauseLocks[n] \ {l}
           willDrain == newLocks = {}
       IN
       /\ pauseLocks' = [pauseLocks EXCEPT ![n] = newLocks]
       /\ IF willDrain
            THEN /\ queues' = [e \in EdgeUniverse |->
                                 IF e[1] = n /\ n \in deps[e[2]]
                                 THEN queues[e] \o pauseBuffer[n]
                                 ELSE queues[e]]
                 /\ pauseBuffer' = [pauseBuffer EXCEPT ![n] = <<>>]
            ELSE /\ queues' = queues
                 /\ pauseBuffer' = pauseBuffer
    /\ pauseActionCount' = pauseActionCount + 1
    /\ ghostJustRewired' = [n2 \in NodeIds |-> FALSE]
    /\ UNCHANGED <<deps, cache, status, terminal, firstRunPassed, dirtyMask,
                   prevData, emitCount, rewireCount, deliveryCount,
                   terminalCount, ghostPreFirstRun, ghostPrePauseLocks,
                   ghostPrePauseBuffer, ghostPreCache, ghostPreTerminal>>

\* THE REWIRE ACTION (replaceDeps; subscribeDep/unsubscribeDep are special cases).
\* The TLA action name remains SetDeps for model continuity.
\* Rejects (D42): terminal `this`; adding a non-resubscribable terminal dep.
\* (self-dep / cycle are precluded by DepCandidates in this topology.)
SetDeps(n, newDeps) ==
    /\ rewireCount < MaxRewires
    /\ IsCompute(n)
    /\ ~IsTerminal(n)                                        \* reject: terminal this
    /\ newDeps \subseteq DepCandidates[n]
    /\ \A d \in (newDeps \ deps[n]) :                        \* reject: add non-resub terminal dep
         ~(IsTerminal(d) /\ d \notin Resubscribable)
    /\ LET removed == deps[n] \ newDeps
           added   == newDeps \ deps[n]
           clearedMask == dirtyMask[n] \ removed
           newPrevDataN ==
             [d \in NodeIds |->
                IF d \in removed THEN SENTINEL
                ELSE IF d \in added THEN SENTINEL
                ELSE prevData[n][d]]
           drainedQueues ==
             [e \in EdgeUniverse |->
                IF e[2] = n /\ e[1] \in removed THEN <<>> ELSE queues[e]]
           pushOnSubscribeQueues ==
             [e \in EdgeUniverse |->
                IF e[2] = n /\ e[1] \in added /\ cache[e[1]] # SENTINEL
                THEN drainedQueues[e] \o << DirtyMsg, DataMsg(cache[e[1]]) >>
                ELSE drainedQueues[e]]
       IN
       /\ deps' = [deps EXCEPT ![n] = newDeps]
       /\ dirtyMask' = [dirtyMask EXCEPT ![n] = clearedMask]
       /\ prevData' = [prevData EXCEPT ![n] = newPrevDataN]
       /\ queues' = pushOnSubscribeQueues
       /\ firstRunPassed' = firstRunPassed                   \* Q2 PRESERVE
       /\ pauseLocks' = pauseLocks                           \* Q3 PRESERVE
       /\ pauseBuffer' = pauseBuffer                         \* Q3 PRESERVE
       /\ cache' = cache                                     \* Q7 PRESERVE
       /\ terminal' = terminal
       /\ status' = IF clearedMask = {} /\ status[n] = "dirty"
                       THEN [status EXCEPT ![n] = "settled"]  \* Q6 auto-settle
                       ELSE status
       /\ rewireCount' = rewireCount + 1
       /\ ghostPreFirstRun' = [ghostPreFirstRun EXCEPT ![n] = firstRunPassed[n]]
       /\ ghostPrePauseLocks' = [ghostPrePauseLocks EXCEPT ![n] = pauseLocks[n]]
       /\ ghostPrePauseBuffer' = [ghostPrePauseBuffer EXCEPT ![n] = pauseBuffer[n]]
       /\ ghostPreCache' = [ghostPreCache EXCEPT ![n] = cache[n]]
       /\ ghostPreTerminal' = [ghostPreTerminal EXCEPT ![n] = terminal[n]]
       /\ ghostJustRewired' = [n2 \in NodeIds |-> n2 = n]
    /\ UNCHANGED <<emitCount, pauseActionCount, deliveryCount, terminalCount>>

----------------------------------------------------------------------------
Next ==
    \/ \E src \in SourceIds, v \in Values : EmitFromSource(src, v)
    \/ \E src \in SourceIds : SourceInvalidate(src)
    \/ \E p \in NodeIds, c \in NodeIds : DeliverDirty(p, c)
    \/ \E p \in NodeIds, c \in NodeIds : DeliverData(p, c)
    \/ \E p \in NodeIds, c \in NodeIds : DeliverInvalidate(p, c)
    \/ \E nd \in NodeIds, k \in {"completed", "errored"} : Terminate(nd, k)
    \/ \E n \in NodeIds, l \in LockIds : Pause(n, l)
    \/ \E n \in NodeIds, l \in LockIds : Resume(n, l)
    \/ \E n \in ComputeIds : \E newDeps \in SUBSET DepCandidates[n] : SetDeps(n, newDeps)

Spec == Init /\ [][Next]_vars

----------------------------------------------------------------------------
(*                             INVARIANTS                                 *)

TypeOK ==
    /\ \A n \in NodeIds : deps[n] \subseteq DepCandidates[n]
    /\ \A n \in NodeIds : cache[n] \in ValueOrSentinel
    /\ \A n \in NodeIds : status[n] \in {"settled", "dirty"}
    /\ \A n \in NodeIds : terminal[n] \in {"none", "completed", "errored"}
    /\ \A n \in NodeIds : firstRunPassed[n] \in BOOLEAN
    /\ \A n \in NodeIds : dirtyMask[n] \subseteq NodeIds
    /\ \A n \in NodeIds : pauseLocks[n] \subseteq LockIds
    /\ \A n \in NodeIds : \A d \in NodeIds : prevData[n][d] \in ValueOrSentinel

\* Q1: dirtyMask only contains current deps (removed bits cleared).
RewireDirtyConsistency ==
    \A n \in NodeIds : dirtyMask[n] \subseteq deps[n]

\* Q4: prevData entries for current deps are well-typed.
DepRecordDomainConsistency ==
    \A n \in NodeIds : \A d \in deps[n] : prevData[n][d] \in ValueOrSentinel

\* Q2 (relational): firstRunPassed unchanged by public replaceDeps semantics (internal SetDeps action).
RewirePreservesFirstRun ==
    \A n \in NodeIds : ghostJustRewired[n] => firstRunPassed[n] = ghostPreFirstRun[n]

\* Q3 (relational): pauseLocks / pauseBuffer unchanged by public replaceDeps semantics (internal SetDeps action).
RewirePreservesPauseLocks ==
    \A n \in NodeIds : ghostJustRewired[n] => pauseLocks[n] = ghostPrePauseLocks[n]
RewirePreservesPauseBuffer ==
    \A n \in NodeIds : ghostJustRewired[n] => pauseBuffer[n] = ghostPrePauseBuffer[n]

\* Q7 (relational): compute cache unchanged by public replaceDeps semantics (internal SetDeps action).
RewirePreservesCache ==
    \A n \in NodeIds : ghostJustRewired[n] => cache[n] = ghostPreCache[n]

\* Q6: sole-dirty-dep removal auto-settles the wave.
WaveClosesWhenSoleDirtyDepRemoved ==
    \A n \in NodeIds :
        ghostJustRewired[n] /\ dirtyMask[n] = {} => status[n] = "settled"

\* rewire x INVALIDATE (NEW): a parent that is not a current dep has NO queued
\* messages to the child — the internal SetDeps action drains removed-dep edges (incl INVALIDATE),
\* so nothing is stranded. Load-bearing: drop drainedQueues and this trips.
NoStaleEdgeMessages ==
    \A e \in EdgeUniverse : (e[1] \notin deps[e[2]]) => queues[e] = <<>>

\* rewire x terminal (NEW): the internal SetDeps action never fires on a terminal node. Load-bearing:
\* drop the ~IsTerminal(n) guard and ghostPreTerminal[n] becomes non-"none".
RewireOnlyOnLiveNode ==
    \A n \in NodeIds : ghostJustRewired[n] => ghostPreTerminal[n] = "none"

\* NOTE: "adding a non-resubscribable terminal dep is rejected" is enforced by
\* the internal SetDeps GUARD (\A d \in added : ~(terminal & ~resub)) — TLC never explores
\* such a transition, so it is guard-modeled, not a standing invariant. A kept
\* dep that terminates AFTER being wired is permitted, which is why a naive
\* "no terminal-non-resub dep" invariant would false-positive.

\* Coverage probe — TRUE at rewireCount=0; TLC tripping it confirms the internal SetDeps action is
\* explored (model not vacuous). Comment back in only to re-verify coverage.
\* NoRewireExecuted == rewireCount = 0
=============================================================================
