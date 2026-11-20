---------------------------- MODULE module_restart ----------------------------
(***************************************************************************
GraphReFly D797 restart module — the restartable owner meets R-restart.

A candidate model for the D797 draft module rule R-restart, written 2026-11-09
for graphrefly:B140, the fifth module model. It checks that the owner built by
reference/modules/restart.mjs behaves as R-restart says. Status: draft, like
the rule it checks. Revised 2026-11-18 for graphrefly:D812: a checkpoint
round trip is a step, and a restored owner that was waiting for a retry starts
that retry's delay again instead of renewing its inner. Revised 2026-11-19 after
the independent QA of that work: the two sides no longer share the test for "a
retry was waiting", the rule's owner keeps its own record across the restore,
and a restored inner may send at its first activation, which the first D812
model could not reach and where the module then renewed the inner at once and
counted the failure as well. Revised after the third QA: a superseded retry's
timer may still be armed while a later retry waits (stale), and fires into
nothing.

Topology: an upstream U, the inner I at the owner's fixed path over U, the
restart state, and the owner O over [I, restart state] with manual terminals
and a sink that subscribes and unsubscribes. The policy has Rounds rounds and a
retry policy of MaxAttempts attempts per round; Delay (chosen at Init) says
whether a retry waits for a timer or is made at the end of the wave. A step is
one of: the sink subscribing or unsubscribing; the inner sending a value,
COMPLETE, ERROR, or a value and COMPLETE in one array; U ending (the inner, over
U alone, ends with it); a restart request (a write to the restart state); a
pending retry's timer firing; and a capture and restore of the active graph,
which keeps the private state and the inner as they are, holds no timer and
has no subscriber, followed by the restored owner's first activation, at which
a live inner may send, since its input may have changed meanwhile.

Two things run side by side on every step:
  - the composition: the owner's function transcribed from restart.mjs, with
    its private state (round, failures, the last request served, a count of
    the attempts this lifetime asked for, whether the last attempt's retry
    waits for a timer), its lifetime's signal (a deactivation
    drops the timer), the cleanup its setup returns, which renews an ended
    inner (an onDeactivation registration until 2026-11-10), and the
    kernel's replace at the end of the wave;
  - the rule: an owner written from R-restart's text, which counts completions
    and errors per round, numbers every attempt and lifetime, and drops a
    retry whose lifetime or attempt is no longer current.
The first probes of this module found three gaps, all fixed before this model:
an old request restarted the fresh inner at the owner's next activation; a
pending retry replaced the attempt an outside request had started; and a
retry fired after U had ended, starting an inner over an ended upstream.

Invariants (see formal/README.md):
  Refines        O sends what the rule's owner sends, and starts as many inners
  CountsMatch    O's round and failures are the rule's
  PendingMatches O has a live retry exactly when the rule has one
  RecordMatches  O's private state records a waiting retry exactly when the
                 rule's owner has one
  TerminalOnlyWhenFinal  O sends a terminal only when no restart is possible
 ***************************************************************************)
EXTENDS Integers, Sequences, TLC

CONSTANTS MaxSteps, Rounds, MaxAttempts

NoSt == [round |-> 0, failures |-> 0, seen |-> -1, attempt |-> -1, waiting |-> FALSE]
NoTimer == [tok |-> -1, end |-> ""]
NoPend == [att |-> -1, life |-> -1, end |-> ""]

VARIABLE k
vars == <<k>>

Term(end) == IF end # "" THEN <<end>> ELSE <<>>
\* The rule's retry is live while its lifetime and attempt are still the current ones.
SpecPending(p) == p.pend # NoPend /\ p.pend.att = p.att /\ p.pend.life = p.life

\* ---- the composition: the owner's function from restart.mjs ----
OwnerRun(s, vals, end) ==
  LET st0 == IF s.st = NoSt THEN [round |-> 1, failures |-> 0, seen |-> s.req, attempt |-> 0, waiting |-> FALSE] ELSE s.st
      fwd == IF vals THEN <<"v">> ELSE <<>>
      rs  == ~s.up                                            \* no restart once U has ended
      a0  == rs /\ s.req # st0.seen                           \* an outside request, served once
      st1 == [st0 EXCEPT !.seen = s.req]
      ra  == rs /\ ~a0 /\ end = "COM" /\ st1.round < Rounds
      st2 == IF ra THEN [st1 EXCEPT !.round = @ + 1, !.failures = 0] ELSE st1
      ea  == rs /\ ~a0 /\ ~ra /\ end = "ERR" /\ st2.failures + 1 < MaxAttempts   \* retryDelayMs
      st3 == IF ea THEN [st2 EXCEPT !.failures = @ + 1] ELSE st2
      again == a0 \/ ra \/ ea
      \* a new attempt: the record says whether its replace waits for a timer
      st4 == IF again THEN [st3 EXCEPT !.attempt = @ + 1, !.waiting = ea /\ s.delay] ELSE st3
  IN IF ~again THEN [s EXCEPT !.st = st4, !.out = fwd \o Term(end), !.oend = end]
     \* a timer still armed here is an earlier attempt's, superseded by a request: it stays armed
     ELSE IF ea /\ s.delay THEN [s EXCEPT !.st = st4, !.out = fwd, !.timer = [tok |-> st4.attempt, end |-> end],
                                          !.stale = @ \/ s.timer # NoTimer]
     ELSE [s EXCEPT !.st = st4, !.out = fwd, !.inner = "live", !.starts = @ + 1]

\* ---- the rule: R-restart, from its text ----
\* The inner may complete Rounds times in all; an ERROR is retried while the round's
\* attempts last; a request starts an attempt counting toward neither and is served once.
SpecRun(p, s, vals, end) ==
  LET fwd == IF vals THEN <<"v">> ELSE <<>>
      fresh == s.req # p.served
      p1 == [p EXCEPT !.served = s.req]
      can == ~s.up
  IN IF can /\ fresh THEN [p |-> [p1 EXCEPT !.att = @ + 1], out |-> fwd, start |-> TRUE]
     ELSE IF can /\ end = "COM" /\ p1.comps + 1 < Rounds
       THEN [p |-> [p1 EXCEPT !.comps = @ + 1, !.errs = 0, !.att = @ + 1], out |-> fwd, start |-> TRUE]
     ELSE IF can /\ end = "ERR" /\ p1.errs + 1 < MaxAttempts
       THEN IF s.delay
            THEN [p |-> [p1 EXCEPT !.errs = @ + 1, !.pend = [att |-> p1.att, life |-> p1.life, end |-> end]],
                  out |-> fwd, start |-> FALSE]
            ELSE [p |-> [p1 EXCEPT !.errs = @ + 1, !.att = @ + 1], out |-> fwd, start |-> TRUE]
     ELSE [p |-> [p1 EXCEPT !.ended = end], out |-> fwd \o Term(end), start |-> FALSE]

Init ==
  \E delay \in BOOLEAN :
    k = [delay |-> delay, up |-> FALSE, inner |-> "fresh", active |-> FALSE, oend |-> "",
         req |-> 0, st |-> NoSt, timer |-> NoTimer, stale |-> FALSE, out |-> <<>>, starts |-> 0, seed |-> FALSE,
         sp |-> [life |-> 0, att |-> 0, comps |-> 0, errs |-> 0, served |-> 0, pend |-> NoPend, saved |-> NoPend, ended |-> ""],
         sout |-> <<>>, sstarts |-> 0, steps |-> 0]

Step(s) == [s EXCEPT !.steps = @ + 1, !.out = <<>>, !.starts = 0, !.sout = <<>>, !.sstarts = 0]

\* Both sides take one owner run.
Both(s, vals, end) ==
  LET c == OwnerRun(s, vals, end)
      r == SpecRun(s.sp, s, vals, end)
  IN [c EXCEPT !.sp = r.p, !.sout = r.out, !.sstarts = IF r.start THEN 1 ELSE 0]

Live(s) == s.active /\ s.oend = ""

Subscribe ==
  /\ ~k.active /\ ~k.seed
  /\ LET s0 == [Step(k) EXCEPT !.active = TRUE]
     IN IF k.oend # "" THEN k' = s0               \* an ended owner: its snapshot only
        ELSE LET s1 == [s0 EXCEPT !.sp.life = @ + 1, !.sp.att = @ + 1, !.sp.comps = 0, !.sp.errs = 0,
                                   !.sp.served = k.req, !.sp.pend = NoPend]
                 \* The rule: each activation starts a fresh inner, which over an ended U ends
                 \* at once with its value (P5).
                 r == IF k.up THEN SpecRun(s1.sp, s1, TRUE, "COM") ELSE [p |-> s1.sp, out |-> <<>>]
                 \* The composition: the inner it finds. An ended one that was not renewed
                 \* gives the owner its ended snapshot; otherwise a fresh one starts.
                 c == IF k.inner \in {"COM", "ERR"} THEN OwnerRun(s1, FALSE, k.inner)
                      ELSE IF k.up THEN [OwnerRun([s1 EXCEPT !.inner = "COM"], TRUE, "COM") EXCEPT !.starts = @ + 1]
                      ELSE [OwnerRun([s1 EXCEPT !.inner = "live"], FALSE, "") EXCEPT !.starts = @ + 1]
             IN k' = [c EXCEPT !.sp = r.p, !.sout = r.out, !.sstarts = 1]

\* The owner's lifetime closes: private state and timer go; an ended inner is renewed,
\* a live one deactivates; either way the next activation starts a fresh inner.
Unsubscribe ==
  /\ k.active
  /\ k' = IF k.oend # "" THEN [Step(k) EXCEPT !.active = FALSE]
          ELSE [Step(k) EXCEPT !.active = FALSE, !.st = NoSt, !.timer = NoTimer, !.stale = FALSE, !.inner = "fresh",
                               !.sp.pend = NoPend]

\* A checkpoint round trip (R-checkpoint): capture at a wave boundary and restore. The
\* restored graph has no subscriber. What is state comes back on both sides: the owner's
\* private state and the inner's state in the composition, and in the rule the owner's
\* counts and its record of the retry it had waiting (sp.saved). No checkpoint holds a
\* timer, so neither side has a live retry until the restored owner's first activation,
\* and until then nothing runs.
Restore ==
  /\ k.active /\ ~k.seed
  /\ k' = [Step(k) EXCEPT !.active = FALSE, !.seed = TRUE, !.timer = NoTimer, !.stale = FALSE,
                           !.sp.saved = IF SpecPending(k.sp) THEN k.sp.pend ELSE NoPend, !.sp.pend = NoPend]

\* What a restored inner does at its first activation. One that had ended stays ended. A
\* live one over a U that ended meanwhile ends with it; otherwise its input may have changed
\* since the capture, so it may run and send a value, COMPLETE, ERROR or a value and
\* COMPLETE, or it sends nothing.
RestoredInnerSends(s) ==
  IF s.inner # "live" THEN {<<FALSE, "">>}
  ELSE IF s.up THEN {<<FALSE, "COM">>}
  ELSE {<<FALSE, "">>, <<TRUE, "">>, <<FALSE, "COM">>, <<FALSE, "ERR">>, <<TRUE, "COM">>}

\* The restored owner's first activation. The inner is activated first, then the owner's
\* setup runs, then its function if the inner sent anything. A request already in the
\* restart state counts as served.
\*   - the rule (D812, 2026-11-18): a retry that was waiting at the capture is state. Its
\*     delay starts again for the same attempt, in the new lifetime, and no failure is
\*     counted for it. The rule's owner reads this from its own record, sp.pend.
\*   - the composition: the setup re-arms the timer when the saved private state says a
\*     retry was waiting (st.waiting), with the saved attempt number. It does not ask
\*     whether the inner is ended: an inner that fails only at this activation is ended
\*     by the time the setup runs, and its failure is the function's to count.
SubscribeRestored ==
  /\ ~k.active /\ k.seed
  /\ LET s0 == [Step(k) EXCEPT !.active = TRUE, !.seed = FALSE]
     IN IF k.oend # "" THEN k' = s0               \* an ended owner: its snapshot only
        \* `other`: the function also runs when another input of the owner changed since the
        \* capture (an upstream, or the restart state), with nothing from the inner. That run
        \* changes nothing on either side, and the re-arm must not depend on it (second QA,
        \* 2026-11-19: without it a waiting owner's function never ran here, so a re-arm made
        \* only when the function does not run stayed green).
        ELSE \E m \in RestoredInnerSends(k), other \in BOOLEAN :
          LET ran == m # <<FALSE, "">> \/ other
              s1 == [s0 EXCEPT !.st.seen = k.req, !.sp.life = @ + 1, !.sp.served = k.req,
                               !.inner = IF m[2] = "" THEN k.inner ELSE m[2]]
              held == k.sp.saved # NoPend
              p1 == [s1.sp EXCEPT !.saved = NoPend,
                                  !.pend = IF held THEN [att |-> s1.sp.att, life |-> s1.sp.life, end |-> k.sp.saved.end] ELSE NoPend]
              r == IF ran THEN SpecRun(p1, s1, m[1], m[2]) ELSE [p |-> p1, out |-> <<>>, start |-> FALSE]
              c0 == IF s1.st.waiting THEN [s1 EXCEPT !.timer = [tok |-> s1.st.attempt, end |-> k.inner]] ELSE s1
              c == IF ran THEN OwnerRun(c0, m[1], m[2]) ELSE c0
          IN k' = [c EXCEPT !.sp = r.p, !.sout = r.out, !.sstarts = IF r.start THEN 1 ELSE 0]

InnerSends ==
  /\ Live(k) /\ k.inner = "live"
  /\ \E m \in {<<TRUE, "">>, <<FALSE, "COM">>, <<FALSE, "ERR">>, <<TRUE, "COM">>} :
       k' = Both([Step(k) EXCEPT !.inner = IF m[2] = "" THEN "live" ELSE m[2]], m[1], m[2])

UpEnds ==
  /\ ~k.up
  /\ IF Live(k) /\ k.inner = "live"
     THEN k' = Both([Step(k) EXCEPT !.up = TRUE, !.inner = "COM"], FALSE, "COM")
     ELSE k' = [Step(k) EXCEPT !.up = TRUE]

Request ==
  /\ k.req < 2
  /\ LET s0 == [Step(k) EXCEPT !.req = @ + 1]
     IN k' = IF Live(s0) THEN Both(s0, FALSE, "") ELSE s0

\* The pending retry's timer: dropped unless its attempt is still the current one; with U
\* ended, no attempt is made and the owner ends with the inner's ERROR.
TimerFires ==
  /\ k.timer # NoTimer
  /\ LET s0 == [Step(k) EXCEPT !.timer = NoTimer]
         cur == k.timer.tok = k.st.attempt
         p == k.sp.pend
         spCur == SpecPending(k.sp)
         s1 == IF ~cur THEN s0
               ELSE IF k.up THEN [s0 EXCEPT !.st.waiting = FALSE, !.out = <<k.timer.end>>, !.oend = k.timer.end]
               ELSE [s0 EXCEPT !.st.waiting = FALSE, !.inner = "live", !.starts = 1]
         s2 == [s1 EXCEPT !.sp.pend = NoPend]
     IN k' = IF ~spCur THEN s2
             ELSE IF k.up THEN [s2 EXCEPT !.sp.ended = p.end, !.sout = <<p.end>>]
             ELSE [s2 EXCEPT !.sp.att = @ + 1, !.sstarts = 1]

\* A superseded retry's timer, still armed while a later retry waits on its own (third QA,
\* 2026-11-19: with one timer in the model, a superseded timer that cleared the record of the
\* retry waiting now could not be reached, and the reference's tests let it through too). It
\* fires into nothing on both sides.
StaleFires ==
  /\ k.stale
  /\ k' = [Step(k) EXCEPT !.stale = FALSE]

Next == k.steps < MaxSteps /\ (Subscribe \/ Unsubscribe \/ InnerSends \/ UpEnds \/ Request \/ TimerFires \/ StaleFires
                                \/ Restore \/ SubscribeRestored)

Spec == Init /\ [][Next]_vars

\* ---- invariants ----
Refines == k.out = k.sout /\ k.starts = k.sstarts /\ k.oend = k.sp.ended
CountsMatch == k.st # NoSt => (k.st.round = k.sp.comps + 1 /\ k.st.failures = k.sp.errs)
PendingMatches == (k.timer # NoTimer /\ k.timer.tok = k.st.attempt) <=> SpecPending(k.sp)
\* The composition's record of a waiting retry is the rule's, at every step: it is what a
\* capture saves, and between a restore and the first activation it is all that is left of
\* the retry on either side.
RecordMatches == (k.st # NoSt /\ k.oend = "") => (k.st.waiting <=> (SpecPending(k.sp) \/ k.sp.saved # NoPend))
TerminalOnlyWhenFinal == \A i \in DOMAIN k.out : k.out[i] \in {"COM", "ERR"} =>
  \/ k.up
  \/ k.out[i] = "COM" /\ k.st.round = Rounds
  \/ k.out[i] = "ERR" /\ k.st.failures + 1 >= MaxAttempts
=============================================================================
