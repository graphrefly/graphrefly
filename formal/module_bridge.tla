---------------------------- MODULE module_bridge ----------------------------
(***************************************************************************
GraphReFly bridge module: one wire edge group meets R-bridge@2.

Written 2026-11-11 for graphrefly:B140 (stage 6), after the user decided the
bridge model (sessions/active/PROPOSAL-B140-bridge-module.md). It checks the
group of reference/modules/bridge.mjs: a cause is one sender wave, one frame per
cause, causes numbered from 1 in a session, a gate that drops causes at or below
the last one taken, releases a cause past the next one and reports the gap, and
starts the count again for a new session, whose first cause carries every
edge's snapshot, with an INVALIDATE ahead of it for an edge without a value.

Abstraction. The kernel's waves are atomic steps: a sender wave changes a
non-empty set of edges that have not ended (a value, an INVALIDATE that clears
it, or a COMPLETE), and the outbound node, a fan-in, runs once on it. A release
is one receiver wave unless the SplitRelease mutation applies each edge as its
own wave. A frame's entry for an edge says whether it carries an INVALIDATE, a
DATA (with the value after it) and a COMPLETE. An inbound edge that has ended
takes nothing more: its entries are skipped and the rest of the frame released,
and a skipped entry not ending in COMPLETE is reported as a divergence
(R-bridge@2, 2026-11-11). ERROR is the same as COMPLETE here; malformed frames
and refusals are pinned by the reference tests. The transport is a sequence that may, under Faults, deliver
a late copy of a frame (a duplicate, or an older cause after newer ones) or lose
one; a restart opens a new session on a new connection, so no frame of the old
session arrives after it (an assumption R-bridge leaves to the transport).

RoundTrip models C-1's return leg: the sender is g2, whose waves are its
releases of g1's single-edge group, so every sender wave sets both edges to the
same new version of A. The first hop carries one edge and is the one-hop model
with a single edge; its grouping is trivial.

Mutant names one mutation, or "none" (see formal/README.md).
Extended on 2026-11-11 with COMPLETE for D804 (R-bridge@2).

Invariants:
  ViewIsSenderState  without a gap since the session's first cause, the
                     receiver's view is a state the sender had after a wave
  OneWavePerCause    no receiver wave ends with a cause partly applied
  AtMostOnce         no cause of a session is released twice
  InOrder            a session's causes are released in increasing order
  EventsMatch        at quiescence without loss, each edge released, or skipped
                     because its inbound node had ended, exactly the values its
                     sender edge sent in this session
  QuiescentAgreement at quiescence without loss, the receiver's values and
                     ended edges are the sender's, also after a restart
  NoFalseDivergence  an ended edge's repeated snapshot is never reported (the
                     sender's edges, once ended, stay ended)
  GapReported        a session whose released causes skip a number was reported
  SameVersion        (RoundTrip) without a gap, both legs hold the same version
 ***************************************************************************)
EXTENDS Naturals, Sequences, FiniteSets

CONSTANTS Edges, Vals, NoVal, Done, MaxWaves, MaxSessions, MaxChan, Faults, RoundTrip, Mutant

ASSUME NoVal \notin Vals /\ Done \notin Vals \cup {NoVal} /\ Edges # {} /\ Vals # {}

Val == Vals \cup {NoVal}
Ord == CHOOSE s \in [1..Cardinality(Edges) -> Edges] : \A i, j \in DOMAIN s : i # j => s[i] # s[j]
InOrd(S) == SelectSeq(Ord, LAMBDA e : e \in S)
V0 == CHOOSE v \in Vals : TRUE

VARIABLES
  sval,     \* sender: each edge's value
  send,     \* sender: the edges that have ended
  rend,     \* receiver: the inbound edges that have ended
  diverged, \* divergences reported
  skipEv,   \* values skipped per session and edge, at an inbound edge that had ended
  lostEver, \* a frame was lost in some session
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

vars == <<sval, send, rend, diverged, skipEv, lostEver, ssess, scnt, waves, chan, rsess, rlast, rview, rq, rlog, sstates,
          sentEv, rEv, lost, gapSince, gapIssues>>

\* e: the edges carried; v: each value after the frame; inv, dat, fin: whether an edge's entry
\* carries an INVALIDATE, a DATA, a COMPLETE; d: a late copy.
Frame(s, c, E, v, inv, dat, fin, dup) ==
  [s |-> s, c |-> c, e |-> E, v |-> v, inv |-> inv, dat |-> dat, fin |-> fin, d |-> dup]

\* A session's first cause: every edge's snapshot, an INVALIDATE ahead of it for an edge without a
\* value (one that has ended included), its COMPLETE for an edge that has ended.
FirstInv(v) == [e \in Edges |-> v[e] = NoVal /\
                  CASE Mutant = "NoFirstInvalidate" -> FALSE
                    [] Mutant = "InvalidateOnlyWithoutSnapshot" -> ~send[e]
                    [] OTHER -> TRUE]
FirstDat(v) == [e \in Edges |-> v[e] # NoVal]
FirstEdges(v) == {e \in Edges : FirstInv(v)[e] \/ FirstDat(v)[e] \/ send[e]}
First(s, v) == Frame(s, 1, FirstEdges(v), v, FirstInv(v), FirstDat(v), send, FALSE)
Count(E, dat) == [e \in Edges |-> IF e \in E /\ dat[e] THEN 1 ELSE 0]
Plus(a, b) == [e \in Edges |-> a[e] + b[e]]
Zero == [e \in Edges |-> 0]

Init ==
  /\ sval = [e \in Edges |-> V0]
  /\ send = [e \in Edges |-> FALSE]
  /\ rend = [e \in Edges |-> FALSE]
  /\ diverged = 0
  /\ skipEv = [s \in 1..MaxSessions |-> Zero]
  /\ lostEver = FALSE
  /\ ssess = 1
  /\ IF Mutant = "NoFirstCause"
       THEN scnt = 0 /\ chan = << >> /\ sentEv = Zero
       ELSE scnt = 1 /\ chan = << First(1, [e \in Edges |-> V0]) >>
            /\ sentEv = Count(Edges, FirstDat([e \in Edges |-> V0]))
  /\ waves = 0
  /\ rsess = 0 /\ rlast = 0 /\ rview = [e \in Edges |-> NoVal] /\ rq = << >>
  /\ rlog = << >>
  /\ sstates = {sval}
  /\ rEv = [s \in 1..MaxSessions |-> Zero]
  /\ lost = FALSE /\ gapSince = FALSE /\ gapIssues = {}

\* One sender wave: the edges in S change: a value, an INVALIDATE of a value (NoVal) or a COMPLETE.
SenderWave ==
  /\ waves < MaxWaves
  /\ \E S \in SUBSET {e \in Edges : ~send[e]} \ {{}} : \E op \in [S -> Val \cup {Done}] :
       /\ \A e \in S : op[e] = NoVal => sval[e] # NoVal
       /\ RoundTrip => S = Edges /\ \E w \in Vals : \A e \in S : op[e] = w
       /\ LET v == [e \in Edges |-> IF e \in S /\ op[e] # Done THEN op[e] ELSE sval[e]]
              inv == [e \in Edges |-> e \in S /\ op[e] = NoVal]
              dat == [e \in Edges |-> e \in S /\ op[e] \in Vals]
              fin == [e \in Edges |-> e \in S /\ op[e] = Done]
              one == IF Mutant = "ResendUnchanged" THEN {e \in Edges : ~send[e]} ELSE S
              datR == IF Mutant = "ResendUnchanged" THEN [e \in Edges |-> dat[e] \/ (e \in one /\ e \notin S /\ v[e] # NoVal)] ELSE dat
              frames == IF Mutant = "CausePerEdge"
                          THEN [i \in 1..Len(InOrd(S)) |-> Frame(ssess, scnt + i, {InOrd(S)[i]}, v, inv, dat, fin, FALSE)]
                          ELSE << Frame(ssess, scnt + 1, one, v, inv, datR, fin, FALSE) >>
          IN /\ Len(chan) + Len(frames) <= MaxChan
             /\ sval' = v
             /\ send' = [e \in Edges |-> send[e] \/ fin[e]]
             /\ sstates' = sstates \cup {v}
             /\ scnt' = scnt + Len(frames)
             /\ chan' = chan \o frames
             /\ sentEv' = Plus(sentEv, Count(S, dat))
  /\ waves' = waves + 1
  /\ UNCHANGED <<ssess, rsess, rlast, rview, rq, rlog, rEv, lost, gapSince, gapIssues, rend, diverged, skipEv, lostEver>>

\* The outbound node's lifetime closes and a new one opens: a new session on a new connection.
Restart ==
  /\ ssess < MaxSessions
  /\ ssess' = ssess + 1
  /\ IF Mutant = "NoFirstCause"
       THEN scnt' = 0 /\ chan' = << >> /\ sentEv' = Zero
       ELSE scnt' = 1 /\ chan' = << First(ssess + 1, sval) >>
            /\ sentEv' = Count(Edges, FirstDat(sval))
  /\ lost' = FALSE
  /\ UNCHANGED <<sval, send, rend, diverged, skipEv, lostEver, waves, rsess, rlast, rview, rq, rlog, sstates, rEv, gapSince, gapIssues>>

\* A late copy of the frame at the head: a duplicate, arriving after the frames sent since.
Duplicate ==
  /\ Faults /\ chan # << >> /\ Len(chan) < MaxChan
  /\ chan' = chan \o << [Head(chan) EXCEPT !.d = TRUE] >>
  /\ UNCHANGED <<send, rend, diverged, skipEv, lostEver, sval, ssess, scnt, waves, rsess, rlast, rview, rq, rlog, sstates, sentEv, rEv, lost, gapSince, gapIssues>>

Lose ==
  /\ Faults /\ chan # << >>
  /\ chan' = Tail(chan)
  /\ lost' = (lost \/ ~Head(chan).d)
  /\ lostEver' = (lostEver \/ ~Head(chan).d)
  /\ UNCHANGED <<send, rend, diverged, skipEv, sval, ssess, scnt, waves, rsess, rlast, rview, rq, rlog, sstates, sentEv, rEv, gapSince, gapIssues>>

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
         skip == {e \in f.e : rend[e]}
         kept == f.e \ skip
         refused == Mutant = "RefuseEnded" /\ skip # {}
         report == {e \in skip : Mutant = "ReportEverySkip" \/ ~f.fin[e]}
         changes(e) == f.inv[e] \/ f.dat[e]
     IN /\ chan' = Tail(chan)
        /\ rsess' = f.s
        /\ IF take /\ refused
             THEN /\ rlast' = f.c
                  /\ UNCHANGED <<rlog, gapIssues, gapSince, rEv, rview, rq, rend, diverged, skipEv>>
           ELSE IF take
             THEN /\ rlast' = f.c
                  /\ rlog' = Append(rlog, <<f.s, f.c>>)
                  /\ gapIssues' = IF gap /\ Mutant # "NoGapReport" THEN gapIssues \cup {f.s} ELSE gapIssues
                  /\ gapSince' = IF f.c = 1 THEN FALSE ELSE (gapSince \/ gap)
                  /\ rEv' = [rEv EXCEPT ![f.s] = Plus(@, Count(kept, f.dat))]
                  /\ rend' = [e \in Edges |-> rend[e] \/ (e \in kept /\ f.fin[e])]
                  /\ diverged' = diverged + Cardinality(report)
                  /\ skipEv' = [skipEv EXCEPT ![f.s] = Plus(@, Count(skip, f.dat))]
                  /\ LET ch == {e \in kept : changes(e)} IN
                     IF Mutant = "SplitRelease"
                       THEN /\ rq' = [i \in 1..Len(InOrd(ch)) |-> <<InOrd(ch)[i], f.v[InOrd(ch)[i]]>>]
                            /\ UNCHANGED rview
                       ELSE /\ rview' = [e \in Edges |-> IF e \in ch THEN f.v[e] ELSE rview[e]]
                            /\ UNCHANGED rq
             ELSE /\ rlast' = last
                  /\ UNCHANGED <<rlog, gapIssues, gapSince, rEv, rview, rq, rend, diverged, skipEv>>
  /\ UNCHANGED <<sval, send, ssess, scnt, waves, sstates, sentEv, lost, lostEver>>

\* SplitRelease only: one edge of the cause, as its own receiver wave.
ApplyOne ==
  /\ rq # << >>
  /\ rview' = [rview EXCEPT ![Head(rq)[1]] = Head(rq)[2]]
  /\ rq' = Tail(rq)
  /\ UNCHANGED <<send, rend, diverged, skipEv, lostEver, sval, ssess, scnt, waves, chan, rsess, rlast, rlog, sstates, sentEv, rEv, lost, gapSince, gapIssues>>

Next == SenderWave \/ Restart \/ Duplicate \/ Lose \/ Deliver \/ ApplyOne

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------
Quiescent == chan = << >> /\ rq = << >>
Released(s) == {rlog[i][2] : i \in {j \in DOMAIN rlog : rlog[j][1] = s}}
NoneYet == [e \in Edges |-> NoVal]

TypeOK ==
  /\ sval \in [Edges -> Val] /\ rview \in [Edges -> Val]
  /\ ssess \in 1..MaxSessions /\ rsess \in 0..MaxSessions
  /\ send \in [Edges -> BOOLEAN] /\ rend \in [Edges -> BOOLEAN] /\ diverged \in Nat

\* An edge that ended on the receiver after a loss may hold less than the sender had (see
\* QuiescentAgreement); every other edge is compared.
Comparable(e) == ~rend[e] \/ ~lostEver
ViewIsSenderState == ~gapSince =>
  \E st \in sstates \cup {NoneYet} : \A e \in Edges : Comparable(e) => rview[e] = st[e]

OneWavePerCause == rq = << >>

AtMostOnce == \A i, j \in DOMAIN rlog : i # j => rlog[i] # rlog[j]

InOrder == \A i, j \in DOMAIN rlog :
             i < j /\ rlog[i][1] = rlog[j][1] => rlog[i][2] < rlog[j][2]

EventsMatch == Quiescent /\ ~lost => Plus(rEv[ssess], skipEv[ssess]) = sentEv

\* An edge that ended on the receiver takes nothing more, so a value lost before its COMPLETE in an
\* earlier session stays lost; every other edge agrees.
QuiescentAgreement == Quiescent /\ ~lost =>
  /\ rend = send
  /\ \A e \in Edges : Comparable(e) => rview[e] = sval[e]

NoFalseDivergence == diverged = 0

GapReported == \A s \in 1..MaxSessions :
                 (\E c \in Released(s) : \E k \in 1..c : k \notin Released(s)) => s \in gapIssues

SameVersion == RoundTrip /\ ~gapSince => \A e1, e2 \in Edges : rview[e1] = rview[e2]
=============================================================================
