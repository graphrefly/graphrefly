---------------------------- MODULE module_bridge ----------------------------
(***************************************************************************
GraphReFly bridge module: one wire edge group meets R-bridge@1.

Written 2026-11-11 for graphrefly:B140 (stage 6), after the user decided the
bridge model (sessions/active/PROPOSAL-B140-bridge-module.md). It checks the
group of reference/modules/bridge.mjs: a cause is one sender wave, one frame per
cause, causes numbered from 1 in a session, a gate that drops causes at or below
the last one taken, releases a cause past the next one and reports the gap, and
starts the count again for a new session, whose first cause carries every
edge's snapshot and an INVALIDATE for an edge without one.

Abstraction. The kernel's waves are atomic steps: a sender wave changes a
non-empty set of edges (a value, or an INVALIDATE that clears it), and the
outbound node, a fan-in, runs once on it. A release is one receiver wave unless
the SplitRelease mutation applies each edge as its own wave. Only DATA and
INVALIDATE are modeled; terminals, malformed frames and refusals are pinned by
the reference tests. The transport is a sequence that may, under Faults, deliver
a late copy of a frame (a duplicate, or an older cause after newer ones) or lose
one; a restart opens a new session on a new connection, so no frame of the old
session arrives after it (an assumption R-bridge leaves to the transport).

RoundTrip models C-1's return leg: the sender is g2, whose waves are its
releases of g1's single-edge group, so every sender wave sets both edges to the
same new version of A. The first hop carries one edge and is the one-hop model
with a single edge; its grouping is trivial.

Mutant names one mutation, or "none" (see formal/README.md).

Invariants:
  ViewIsSenderState  without a gap since the session's first cause, the
                     receiver's view is a state the sender had after a wave
  OneWavePerCause    no receiver wave ends with a cause partly applied
  AtMostOnce         no cause of a session is released twice
  InOrder            a session's causes are released in increasing order
  EventsMatch        at quiescence without loss, each edge released exactly the
                     values its sender edge sent in this session
  QuiescentAgreement at quiescence without loss, the receiver's view is the
                     sender's state, also after a restart
  GapReported        a session whose released causes skip a number was reported
  SameVersion        (RoundTrip) without a gap, both legs hold the same version
 ***************************************************************************)
EXTENDS Naturals, Sequences, FiniteSets

CONSTANTS Edges, Vals, NoVal, MaxWaves, MaxSessions, MaxChan, Faults, RoundTrip, Mutant

ASSUME NoVal \notin Vals /\ Edges # {} /\ Vals # {}

Val == Vals \cup {NoVal}
Ord == CHOOSE s \in [1..Cardinality(Edges) -> Edges] : \A i, j \in DOMAIN s : i # j => s[i] # s[j]
InOrd(S) == SelectSeq(Ord, LAMBDA e : e \in S)
V0 == CHOOSE v \in Vals : TRUE

VARIABLES
  sval,     \* sender: each edge's value
  ssess,    \* sender's current session
  scnt,     \* causes numbered so far in this session
  waves,    \* sender waves so far
  chan,     \* frames in transit
  rsess, rlast, rview,
  rq,       \* SplitRelease only: edges of a released cause not yet applied
  rlog,     \* released <<session, cause>>, in order
  sstates,  \* every sender state after a wave (history)
  sentEv,   \* values sent per edge in this session's frames
  rEv,      \* values released per session and edge
  lost,     \* a frame of the current session was lost
  gapSince, \* a cause was released past a gap since the session's first cause
  gapIssues \* sessions for which the receiver reported a gap

vars == <<sval, ssess, scnt, waves, chan, rsess, rlast, rview, rq, rlog, sstates,
          sentEv, rEv, lost, gapSince, gapIssues>>

Frame(s, c, E, v, dup) == [s |-> s, c |-> c, e |-> E, v |-> v, d |-> dup]

\* A session's first cause: every edge's snapshot, an INVALIDATE for an edge without one.
FirstEdges(v) == IF Mutant = "NoFirstInvalidate" THEN {e \in Edges : v[e] # NoVal} ELSE Edges
Count(E, v) == [e \in Edges |-> IF e \in E /\ v[e] # NoVal THEN 1 ELSE 0]
Plus(a, b) == [e \in Edges |-> a[e] + b[e]]
Zero == [e \in Edges |-> 0]

Init ==
  /\ sval = [e \in Edges |-> V0]
  /\ ssess = 1
  /\ IF Mutant = "NoFirstCause"
       THEN scnt = 0 /\ chan = << >> /\ sentEv = Zero
       ELSE scnt = 1 /\ chan = << Frame(1, 1, FirstEdges(sval), sval, FALSE) >>
            /\ sentEv = Count(FirstEdges(sval), sval)
  /\ waves = 0
  /\ rsess = 0 /\ rlast = 0 /\ rview = [e \in Edges |-> NoVal] /\ rq = << >>
  /\ rlog = << >>
  /\ sstates = {sval}
  /\ rEv = [s \in 1..MaxSessions |-> Zero]
  /\ lost = FALSE /\ gapSince = FALSE /\ gapIssues = {}

\* One sender wave: the edges in S change (NoVal is an INVALIDATE of a value).
SenderWave ==
  /\ waves < MaxWaves
  /\ \E S \in SUBSET Edges \ {{}} : \E nv \in [S -> Val] :
       /\ \A e \in S : nv[e] = NoVal => sval[e] # NoVal
       /\ RoundTrip => S = Edges /\ \E w \in Vals : \A e \in S : nv[e] = w
       /\ LET v == [e \in Edges |-> IF e \in S THEN nv[e] ELSE sval[e]]
              one == IF Mutant = "ResendUnchanged" THEN Edges ELSE S
              frames == IF Mutant = "CausePerEdge"
                          THEN [i \in 1..Len(InOrd(S)) |-> Frame(ssess, scnt + i, {InOrd(S)[i]}, v, FALSE)]
                          ELSE << Frame(ssess, scnt + 1, one, v, FALSE) >>
          IN /\ Len(chan) + Len(frames) <= MaxChan
             /\ sval' = v
             /\ sstates' = sstates \cup {v}
             /\ scnt' = scnt + Len(frames)
             /\ chan' = chan \o frames
             /\ sentEv' = Plus(sentEv, Count(S, v))
  /\ waves' = waves + 1
  /\ UNCHANGED <<ssess, rsess, rlast, rview, rq, rlog, rEv, lost, gapSince, gapIssues>>

\* The outbound node's lifetime closes and a new one opens: a new session on a new connection.
Restart ==
  /\ ssess < MaxSessions
  /\ ssess' = ssess + 1
  /\ IF Mutant = "NoFirstCause"
       THEN scnt' = 0 /\ chan' = << >> /\ sentEv' = Zero
       ELSE scnt' = 1 /\ chan' = << Frame(ssess + 1, 1, FirstEdges(sval), sval, FALSE) >>
            /\ sentEv' = Count(FirstEdges(sval), sval)
  /\ lost' = FALSE
  /\ UNCHANGED <<sval, waves, rsess, rlast, rview, rq, rlog, sstates, rEv, gapSince, gapIssues>>

\* A late copy of the frame at the head: a duplicate, arriving after the frames sent since.
Duplicate ==
  /\ Faults /\ chan # << >> /\ Len(chan) < MaxChan
  /\ chan' = chan \o << [Head(chan) EXCEPT !.d = TRUE] >>
  /\ UNCHANGED <<sval, ssess, scnt, waves, rsess, rlast, rview, rq, rlog, sstates, sentEv, rEv, lost, gapSince, gapIssues>>

Lose ==
  /\ Faults /\ chan # << >>
  /\ chan' = Tail(chan)
  /\ lost' = (lost \/ ~Head(chan).d)
  /\ UNCHANGED <<sval, ssess, scnt, waves, rsess, rlast, rview, rq, rlog, sstates, sentEv, rEv, gapSince, gapIssues>>

\* One receiver wave: the frame at the head reaches the gate.
Deliver ==
  /\ chan # << >> /\ rq = << >>
  /\ LET f == Head(chan)
         newSession == f.s # rsess
         last == IF newSession /\ Mutant # "KeepCountOnNewSession" THEN 0 ELSE rlast
         take == CASE Mutant = "NoStaleCheck" -> TRUE
                   [] Mutant = "AnyOtherNumber" -> f.c # last
                   [] OTHER -> f.c > last
         gap == f.c > last + 1
     IN /\ chan' = Tail(chan)
        /\ rsess' = f.s
        /\ IF take
             THEN /\ rlast' = f.c
                  /\ rlog' = Append(rlog, <<f.s, f.c>>)
                  /\ gapIssues' = IF gap /\ Mutant # "NoGapReport" THEN gapIssues \cup {f.s} ELSE gapIssues
                  /\ gapSince' = IF f.c = 1 THEN FALSE ELSE (gapSince \/ gap)
                  /\ rEv' = [rEv EXCEPT ![f.s] = Plus(@, Count(f.e, f.v))]
                  /\ IF Mutant = "SplitRelease"
                       THEN /\ rq' = [i \in 1..Len(InOrd(f.e)) |-> <<InOrd(f.e)[i], f.v[InOrd(f.e)[i]]>>]
                            /\ UNCHANGED rview
                       ELSE /\ rview' = [e \in Edges |-> IF e \in f.e THEN f.v[e] ELSE rview[e]]
                            /\ UNCHANGED rq
             ELSE /\ rlast' = last
                  /\ UNCHANGED <<rlog, gapIssues, gapSince, rEv, rview, rq>>
  /\ UNCHANGED <<sval, ssess, scnt, waves, sstates, sentEv, lost>>

\* SplitRelease only: one edge of the cause, as its own receiver wave.
ApplyOne ==
  /\ rq # << >>
  /\ rview' = [rview EXCEPT ![Head(rq)[1]] = Head(rq)[2]]
  /\ rq' = Tail(rq)
  /\ UNCHANGED <<sval, ssess, scnt, waves, chan, rsess, rlast, rlog, sstates, sentEv, rEv, lost, gapSince, gapIssues>>

Next == SenderWave \/ Restart \/ Duplicate \/ Lose \/ Deliver \/ ApplyOne

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------
Quiescent == chan = << >> /\ rq = << >>
Released(s) == {rlog[i][2] : i \in {j \in DOMAIN rlog : rlog[j][1] = s}}
NoneYet == [e \in Edges |-> NoVal]

TypeOK ==
  /\ sval \in [Edges -> Val] /\ rview \in [Edges -> Val]
  /\ ssess \in 1..MaxSessions /\ rsess \in 0..MaxSessions

ViewIsSenderState == ~gapSince => rview \in sstates \cup {NoneYet}

OneWavePerCause == rq = << >>

AtMostOnce == \A i, j \in DOMAIN rlog : i # j => rlog[i] # rlog[j]

InOrder == \A i, j \in DOMAIN rlog :
             i < j /\ rlog[i][1] = rlog[j][1] => rlog[i][2] < rlog[j][2]

EventsMatch == Quiescent /\ ~lost => rEv[ssess] = sentEv

QuiescentAgreement == Quiescent /\ ~lost => rview = sval

GapReported == \A s \in 1..MaxSessions :
                 (\E c \in Released(s) : \E k \in 1..c : k \notin Released(s)) => s \in gapIssues

SameVersion == RoundTrip /\ ~gapSince => \A e1, e2 \in Edges : rview[e1] = rview[e2]
=============================================================================
