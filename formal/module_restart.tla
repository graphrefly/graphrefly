---------------------------- MODULE module_restart ----------------------------
(***************************************************************************
GraphReFly D797 restart module — the restartable owner meets R-restart.

A candidate model for the D797 draft module rule R-restart, written 2026-11-09
for graphrefly:B140, the fifth module model. It checks that the owner built by
reference/modules/restart.mjs behaves as R-restart says. Status: draft, like
the rule it checks.

Topology: an upstream U, the inner I at the owner's fixed path over U, the
restart state, and the owner O over [I, restart state] with manual terminals
and a sink that subscribes and unsubscribes. The policy has Rounds rounds and a
retry policy of MaxAttempts attempts per round; Delay (chosen at Init) says
whether a retry waits for a timer or is made at the end of the wave. A step is
one of: the sink subscribing or unsubscribing; the inner sending a value,
COMPLETE, ERROR, or a value and COMPLETE in one array; U ending (the inner, over
U alone, ends with it); a restart request (a write to the restart state); and a
pending retry's timer firing.

Two things run side by side on every step:
  - the composition: the owner's function transcribed from restart.mjs, with
    its private state (round, failures, the last request served, a count of
    the attempts this lifetime asked for), its lifetime's signal (a deactivation
    drops the timer), the onDeactivation that renews an ended inner, and the
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
  TerminalOnlyWhenFinal  O sends a terminal only when no restart is possible
 ***************************************************************************)
EXTENDS Integers, Sequences, TLC

CONSTANTS MaxSteps, Rounds, MaxAttempts

NoSt == [round |-> 0, failures |-> 0, seen |-> -1, attempt |-> -1]
NoTimer == [tok |-> -1, end |-> ""]
NoPend == [att |-> -1, life |-> -1, end |-> ""]

VARIABLE k
vars == <<k>>

Term(end) == IF end # "" THEN <<end>> ELSE <<>>
\* The rule's retry is live while its lifetime and attempt are still the current ones.
SpecPending(p) == p.pend # NoPend /\ p.pend.att = p.att /\ p.pend.life = p.life

\* ---- the composition: the owner's function from restart.mjs ----
OwnerRun(s, vals, end) ==
  LET st0 == IF s.st = NoSt THEN [round |-> 1, failures |-> 0, seen |-> s.req, attempt |-> 0] ELSE s.st
      fwd == IF vals THEN <<"v">> ELSE <<>>
      rs  == ~s.up                                            \* no restart once U has ended
      a0  == rs /\ s.req # st0.seen                           \* an outside request, served once
      st1 == [st0 EXCEPT !.seen = s.req]
      ra  == rs /\ ~a0 /\ end = "COM" /\ st1.round < Rounds
      st2 == IF ra THEN [st1 EXCEPT !.round = @ + 1, !.failures = 0] ELSE st1
      ea  == rs /\ ~a0 /\ ~ra /\ end = "ERR" /\ st2.failures + 1 < MaxAttempts   \* retryDelayMs
      st3 == IF ea THEN [st2 EXCEPT !.failures = @ + 1] ELSE st2
      again == a0 \/ ra \/ ea
      st4 == IF again THEN [st3 EXCEPT !.attempt = @ + 1] ELSE st3
  IN IF ~again THEN [s EXCEPT !.st = st4, !.out = fwd \o Term(end), !.oend = end]
     ELSE IF ea /\ s.delay THEN [s EXCEPT !.st = st4, !.out = fwd, !.timer = [tok |-> st4.attempt, end |-> end]]
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
         req |-> 0, st |-> NoSt, timer |-> NoTimer, out |-> <<>>, starts |-> 0,
         sp |-> [life |-> 0, att |-> 0, comps |-> 0, errs |-> 0, served |-> 0, pend |-> NoPend, ended |-> ""],
         sout |-> <<>>, sstarts |-> 0, steps |-> 0]

Step(s) == [s EXCEPT !.steps = @ + 1, !.out = <<>>, !.starts = 0, !.sout = <<>>, !.sstarts = 0]

\* Both sides take one owner run.
Both(s, vals, end) ==
  LET c == OwnerRun(s, vals, end)
      r == SpecRun(s.sp, s, vals, end)
  IN [c EXCEPT !.sp = r.p, !.sout = r.out, !.sstarts = IF r.start THEN 1 ELSE 0]

Live(s) == s.active /\ s.oend = ""

Subscribe ==
  /\ ~k.active
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
          ELSE [Step(k) EXCEPT !.active = FALSE, !.st = NoSt, !.timer = NoTimer, !.inner = "fresh",
                               !.sp.pend = NoPend]

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
               ELSE IF k.up THEN [s0 EXCEPT !.out = <<k.timer.end>>, !.oend = k.timer.end]
               ELSE [s0 EXCEPT !.inner = "live", !.starts = 1]
         s2 == [s1 EXCEPT !.sp.pend = NoPend]
     IN k' = IF ~spCur THEN s2
             ELSE IF k.up THEN [s2 EXCEPT !.sp.ended = p.end, !.sout = <<p.end>>]
             ELSE [s2 EXCEPT !.sp.att = @ + 1, !.sstarts = 1]

Next == k.steps < MaxSteps /\ (Subscribe \/ Unsubscribe \/ InnerSends \/ UpEnds \/ Request \/ TimerFires)

Spec == Init /\ [][Next]_vars

\* ---- invariants ----
Refines == k.out = k.sout /\ k.starts = k.sstarts /\ k.oend = k.sp.ended
CountsMatch == k.st # NoSt => (k.st.round = k.sp.comps + 1 /\ k.st.failures = k.sp.errs)
PendingMatches == (k.timer # NoTimer /\ k.timer.tok = k.st.attempt) <=> SpecPending(k.sp)
TerminalOnlyWhenFinal == \A i \in DOMAIN k.out : k.out[i] \in {"COM", "ERR"} =>
  \/ k.up
  \/ k.out[i] = "COM" /\ k.st.round = Rounds
  \/ k.out[i] = "ERR" /\ k.st.failures + 1 >= MaxAttempts
=============================================================================
