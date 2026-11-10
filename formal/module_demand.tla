--------------------------- MODULE module_demand ---------------------------
(***************************************************************************
GraphReFly D797 demand module — the pullable built from kernel nodes meets R-demand.

A candidate model for the D797 draft module rule R-demand, written 2026-11-09
for graphrefly:B140, the second module model after module_pause. It checks that
the composition in reference/modules/demand.mjs, a log node, a quiet holder and
a demand state, behaves as R-demand says a holder does. Status: draft, like the
rule it checks.

Topology: a state S (the input), a demand state Dm, Log = pullLog over [S, Dm]
with manual COMPLETE and auto ERROR, and H = the quiet holder over [Log] with a
sink. A step is either one wave, a host batch that writes S (a write, or
writes, invalidations and a terminal) and makes zero, one or two pulls, or the
sink subscribing or unsubscribing. When the holder is served, the author's
service function either sends one DATA or stays silent; the model chooses.

Two things run side by side on every step:
  - the composition: S's array is prepared and applied as the kernel does; Log
    settles as a kernel node (auto ERROR without running; an INVALIDATE input
    invalidates it and runs its onInvalidate hook; it runs on value input or
    on COMPLETE; a pending node that sends nothing settling gets RESOLVED), and
    H as a quiet node (no pending mark, INVALIDATE at once, everything else as
    a later wave), with pullLog and the holder transcribed from demand.mjs;
    activation runs Log's first run on the snapshots, deactivation drops what
    the computed nodes hold;
  - the rule: a holder written straight from R-demand's text.

Invariants, each mutation-checked (see formal/README.md):
  Serves               the service function is called with the same held arrays
                       and params, step by step
  OutputMatches        H sends the same at once (INVALIDATE) and as a later
                       wave (service output, terminals)
  HeldMatches          Log's queue is the rule's held arrays
  ServeOnlyOnPull      a service happens only in a wave that has a pull
  InactiveHoldsNothing an inactive holder holds nothing and has no value
  EndsWithInput        an active holder has ended exactly when the input has,
                       in the composition and in the rule

Not modeled: a pull made during a wave (R-request-order, kernel_lifetime), a
pausable before the holder, a later subscriber's START, and activation after
the input has ended.
Tokens: "D0","D1","D2" DATA from S, "INV", "COM", "ERR", "V" the service's
DATA, params "p1","p2".
 ***************************************************************************)
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS MaxSteps

IsData(x) == x \in {"D0", "D1", "D2"}
IsTerm(x) == x \in {"COM", "ERR"}
Max(X) == CHOOSE x \in X : \A y \in X : y <= x

SArrays == { <<"D1">>, <<"D2">>, <<"D1", "D2">>, <<"INV">>, <<"COM">>, <<"ERR">>,
             <<"D1", "COM">>, <<"D1", "INV", "D2">>, <<"INV", "D1">> }
Pulls == { <<>>, <<"p1">>, <<"p2">>, <<"p1", "p2">> }

VARIABLE k
vars == <<k>>

\* ---- arrays (as in module_pause) ----
LastInv(a) == LET I == {i \in DOMAIN a : a[i] = "INV"} IN IF I = {} THEN 0 ELSE Max(I)
Prepare(a) ==
  LET c == LastInv(a)
  IN (IF c > 0 THEN << <<"INV">> >> ELSE <<>>) \o (IF c < Len(a) THEN << SubSeq(a, c + 1, Len(a)) >> ELSE <<>>)
DataOf(f) == SelectSeq(f, IsData)
TermOf(f) == LET T == {f[i] : i \in {j \in DOMAIN f : IsTerm(f[j])}} IN IF T = {} THEN "" ELSE CHOOSE t \in T : TRUE
HasData(fs) == \E i \in DOMAIN fs : DataOf(fs[i]) # <<>>
RECURSIVE LastInvFrame(_, _)
LastInvFrame(fs, i) == IF i = 0 THEN 0 ELSE IF fs[i] = <<"INV">> THEN i ELSE LastInvFrame(fs, i - 1)
After(fs) == SubSeq(fs, LastInvFrame(fs, Len(fs)) + 1, Len(fs))
FsTerm(fs) == LET T == {TermOf(fs[i]) : i \in DOMAIN fs} \ {""} IN IF T = {} THEN "" ELSE CHOOSE t \in T : TRUE
Arrived(fs) == SelectSeq([i \in DOMAIN fs |-> DataOf(fs[i])], LAMBDA x : x # <<>>)

RECURSIVE ApplyS(_, _, _)
ApplyS(s, fs, out) ==
  IF fs = <<>> THEN [s |-> s, out |-> out]
  ELSE LET f == Head(fs)
       IN IF f = <<"INV">>
          THEN IF s.has THEN ApplyS([s EXCEPT !.has = FALSE], Tail(fs), Append(out, f))
               ELSE ApplyS(s, Tail(fs), out)
          ELSE ApplyS([s EXCEPT !.has = s.has \/ DataOf(f) # <<>>,
                                !.val = IF DataOf(f) # <<>> THEN DataOf(f)[Len(DataOf(f))] ELSE @,
                                !.ended = TermOf(f) # ""], Tail(fs), Append(out, f))

NoServe == [queue |-> <<>>, params |-> "none"]

\* ---- the composition: Log = pullLog, H = the quiet holder ----
\* fs: S's arrays; reqs: the pulls' sequence numbers and params, in order; v: the
\* service's choice. Returns the new Log and H, what H sends at once and later, and
\* the service call, if any.
WaveComp(lg, h, fs, reqs, v) ==
  LET depErr  == FsTerm(fs) = "ERR"                   \* auto ERROR: Log does not run
      inv     == LastInvFrame(fs, Len(fs)) > 0
      lead    == ~depErr /\ inv /\ lg.has
      q0      == IF lead THEN <<>> ELSE lg.queue      \* onInvalidate empties the queue
      rest    == After(fs)
      arrived == Arrived(rest)
      endC    == FsTerm(rest) = "COM"
      runs    == ~depErr /\ (arrived # <<>> \/ reqs # <<>> \/ endC)
      fresh   == SelectSeq(reqs, LAMBDA r : r[1] > lg.seen)
      queue   == q0 \o arrived
      serve   == runs /\ ~endC /\ fresh # <<>>
      \* Log's output this wave: "INV", "Q" (holding), "S" (service record), "COM", "ERR"
      lout    == IF depErr THEN <<"ERR">>
                 ELSE (IF lead THEN <<"INV">> ELSE <<>>)
                      \o (IF ~runs THEN <<>> ELSE IF endC THEN <<"COM">>
                          ELSE IF serve THEN <<"S">> ELSE IF arrived # <<>> THEN <<"Q">> ELSE <<>>)
      lg1 == [lg EXCEPT !.queue = IF ~runs THEN q0 ELSE IF serve \/ endC THEN <<>> ELSE queue,
                        !.seen  = IF serve THEN fresh[Len(fresh)][1] ELSE @,
                        !.has   = (@ /\ ~lead) \/ \E i \in DOMAIN lout : lout[i] \in {"Q", "S"},
                        !.ended = depErr \/ endC]
      \* H (quiet): INVALIDATE now if it has a value; a service record runs the service;
      \* a terminal ends it as a later wave (auto policies).
      hlead == "INV" \in {lout[i] : i \in DOMAIN lout} /\ h.has
      sent  == serve /\ v = "V"
      hterm == IF depErr THEN "ERR" ELSE IF endC THEN "COM" ELSE ""
      later == (IF sent THEN <<"V">> ELSE <<>>) \o (IF hterm # "" THEN <<hterm>> ELSE <<>>)
      h1 == [h EXCEPT !.has = (@ /\ ~hlead) \/ sent, !.ended = hterm # ""]
  IN [lg |-> lg1, h |-> h1, now |-> IF hlead THEN <<"INV">> ELSE <<>>, later |-> later,
      call |-> IF serve THEN [queue |-> queue, params |-> fresh[Len(fresh)][2]] ELSE NoServe]

\* ---- the rule: R-demand's holder, from its text ----
WaveSpec(sp, fs, pulls, v) ==
  LET inv  == LastInvFrame(fs, Len(fs)) > 0
      lead == inv /\ sp.has                         \* INVALIDATE reaches subscribers at once
      held0 == IF inv THEN <<>> ELSE sp.held        \* and discards what was held
      rest == After(fs)
      end  == FsTerm(fs)                            \* the input's terminal ends the holder
      held == held0 \o Arrived(rest)
      serve == end = "" /\ pulls # <<>>             \* served once, with the latest params
      sent == serve /\ v = "V"
  IN [sp |-> [sp EXCEPT !.held = IF serve \/ end # "" THEN <<>> ELSE held,
                        !.has = (@ /\ ~lead) \/ sent, !.ended = end # ""],
      now |-> IF lead THEN <<"INV">> ELSE <<>>,
      later |-> (IF sent THEN <<"V">> ELSE <<>>) \o (IF end # "" THEN <<end>> ELSE <<>>),
      call |-> IF serve THEN [queue |-> held, params |-> pulls[Len(pulls)]] ELSE NoServe]

Init ==
  k = [s |-> [has |-> TRUE, val |-> "D0", ended |-> FALSE], seq |-> 0, active |-> FALSE,
       lg |-> [queue |-> <<>>, seen |-> 0, has |-> FALSE, ended |-> FALSE],
       h  |-> [has |-> FALSE, ended |-> FALSE],
       sp |-> [held |-> <<>>, has |-> FALSE, ended |-> FALSE],
       now |-> <<>>, later |-> <<>>, spNow |-> <<>>, spLater |-> <<>>,
       call |-> NoServe, spCall |-> NoServe, pulled |-> FALSE, lastParams |-> "none", steps |-> 0]

Quiet(s) == [s EXCEPT !.now = <<>>, !.later = <<>>, !.spNow = <<>>, !.spLater = <<>>,
                      !.call = NoServe, !.spCall = NoServe, !.pulled = FALSE, !.steps = @ + 1]

\* A host batch: an array for S (or none) and pulls. An ended S refuses input.
Wave ==
  \E sa \in (IF k.s.ended THEN {<<>>} ELSE SArrays \cup {<<>>}), pulls \in Pulls, v \in {"V", "none"} :
    /\ sa # <<>> \/ pulls # <<>>
    /\ LET sr   == IF sa = <<>> THEN [s |-> k.s, out |-> <<>>] ELSE ApplyS(k.s, Prepare(sa), <<>>)
           reqs == [i \in DOMAIN pulls |-> <<k.seq + i, pulls[i]>>]
           live == k.active /\ ~k.lg.ended
           c    == WaveComp(k.lg, k.h, sr.out, reqs, v)
           w    == WaveSpec(k.sp, sr.out, pulls, v)
       IN k' = [Quiet(k) EXCEPT !.s = sr.s, !.seq = k.seq + Len(pulls), !.pulled = pulls # <<>>,
                                !.lastParams = IF pulls # <<>> THEN pulls[Len(pulls)] ELSE @,
                                !.lg = IF live THEN c.lg ELSE @, !.h = IF live THEN c.h ELSE @,
                                !.now = IF live THEN c.now ELSE <<>>, !.later = IF live THEN c.later ELSE <<>>,
                                !.call = IF live THEN c.call ELSE NoServe,
                                !.sp = IF live THEN w.sp ELSE @,
                                !.spNow = IF live THEN w.now ELSE <<>>, !.spLater = IF live THEN w.later ELSE <<>>,
                                !.spCall = IF live THEN w.call ELSE NoServe]

\* Activation: Log's first run gets the snapshots as input, S's value and Dm's last
\* pull, and starts with that pull recorded as seen, so it is not served; H's first run
\* follows. The rule: the holder holds the input's snapshot and serves only later pulls.
Subscribe ==
  /\ ~k.active /\ ~k.s.ended
  /\ \E v \in {"V", "none"} :
       LET snap == IF k.s.has THEN << <<k.s.val>> >> ELSE <<>>
           dm   == IF k.seq > 0 THEN << <<k.seq, k.lastParams>> >> ELSE <<>>
           lg0  == [queue |-> <<>>, seen |-> k.seq, has |-> FALSE, ended |-> FALSE]
           c    == WaveComp(lg0, [has |-> FALSE, ended |-> FALSE], snap, dm, v)
       IN k' = [Quiet(k) EXCEPT !.active = TRUE, !.lg = c.lg, !.h = c.h, !.call = c.call,
                   !.sp = [held |-> IF k.s.has THEN << <<k.s.val>> >> ELSE <<>>, has |-> FALSE, ended |-> FALSE]]

\* Deactivation drops what Log and H hold.
Unsubscribe ==
  /\ k.active /\ ~k.lg.ended
  /\ k' = [Quiet(k) EXCEPT !.active = FALSE,
              !.lg = [queue |-> <<>>, seen |-> 0, has |-> FALSE, ended |-> FALSE],
              !.h = [has |-> FALSE, ended |-> FALSE],
              !.sp = [held |-> <<>>, has |-> FALSE, ended |-> FALSE]]

Next == k.steps < MaxSteps /\ (Wave \/ Subscribe \/ Unsubscribe)

Spec == Init /\ [][Next]_vars

\* ---- invariants ----
Serves == k.call = k.spCall
OutputMatches == k.now = k.spNow /\ k.later = k.spLater
HeldMatches == ~k.active \/ k.lg.ended \/ k.lg.queue = k.sp.held
ServeOnlyOnPull == k.call # NoServe => k.pulled
InactiveHoldsNothing == ~k.active => (k.lg.queue = <<>> /\ ~k.lg.has /\ ~k.h.has)
EndsWithInput == k.active => (k.lg.ended = k.s.ended /\ k.h.ended = k.s.ended /\ k.sp.ended = k.s.ended)
=============================================================================
