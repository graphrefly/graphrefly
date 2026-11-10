--------------------------- MODULE module_demand ---------------------------
(***************************************************************************
GraphReFly D797 demand module — the one-node pullable meets R-demand.

A candidate model for the D797 draft module rule R-demand, written 2026-11-09
for graphrefly:B140, the second module model after module_pause. It checks that
the composition in reference/modules/demand.mjs, one quiet holder and a demand
state, behaves as R-demand says a holder does. Status: draft, like the rule it
checks. Until 2026-11-09 the pullable took two nodes, a log that published its
queue as a value so that the holder learned of every INVALIDATE; that version
was retired the same day, when INVALIDATE got a manual policy (R-invalidation)
and the holder became one node.

Topology: a state S (the input), a demand state Dm, and H = the holder over
[S, Dm], quiet, with manual COMPLETE and INVALIDATE and auto ERROR, with a
sink. A step is either one wave, a host batch that writes S (a write, or
writes, invalidations and a terminal) and makes zero, one or two pulls, or the
sink subscribing or unsubscribing. When the holder is served, the author's
service function either sends one DATA or stays silent; the model chooses.

Two things run side by side on every step:
  - the composition: S's array is prepared and applied as the kernel does; H
    settles as a quiet kernel node: a dependency ERROR ends it without running
    its function (auto), and otherwise what came before an INVALIDATE on its
    input is gone and the function sees that one arrived; the function runs on
    value input (a pull is a DATA on Dm), on COMPLETE or on an INVALIDATE (both
    manual); nothing goes out in the wave, not even PENDING, and everything it
    sends goes out as a later wave, applied in order, an INVALIDATE dropped
    while H has no value. The function is the holder transcribed from
    demand.mjs, with `seen` set at a lifetime's first run from Dm's current
    value; activation runs that first run on the snapshots, deactivation drops
    H's private state and value;
  - the rule: a holder written straight from R-demand's text.

Invariants, each mutation-checked (see formal/README.md):
  Serves               the service function is called with the same held arrays
                       and params, step by step
  OutputMatches        H sends nothing in the wave, and the same as the rule as
                       a later wave (INVALIDATE, service output, terminals)
  HeldMatches          H's queue is the rule's held arrays
  ServeOnlyOnPull      a service happens only in a wave that has a pull
  InactiveHoldsNothing an inactive holder holds nothing and has no value
  EndsWithInput        an active holder has ended exactly when the input has,
                       in the composition and in the rule

Not modeled: a pull made during a wave (R-request-order, kernel_lifetime), a
pausable before the holder, a later subscriber's START, activation after
the input has ended. The first version of this one-node model found that an
INVALIDATE followed by an ERROR in one array was lost: under auto ERROR the
kernel ended the holder without applying it, so a later START carried a value
its input had invalidated; the kernel now applies such an INVALIDATE first
(2026-11-09). The PENDING prefix of a later wave is
the kernel's, one per marking array, so outputs are compared without it.
Tokens: "D0","D1","D2" DATA from S, "INV", "COM", "ERR", "V" the service's
DATA, params "p1","p2".
 ***************************************************************************)
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS MaxSteps

IsData(x) == x \in {"D0", "D1", "D2", "V"}
IsTerm(x) == x \in {"COM", "ERR"}
Max(X) == CHOOSE x \in X : \A y \in X : y <= x

SArrays == { <<"D1">>, <<"D2">>, <<"D1", "D2">>, <<"INV">>, <<"COM">>, <<"ERR">>,
             <<"D1", "COM">>, <<"D2", "ERR">>, <<"D1", "INV", "D2">>, <<"INV", "D1">>,
             <<"INV", "COM">>, <<"INV", "ERR">> }
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
RECURSIVE LastInvFrame(_, _)
LastInvFrame(fs, i) == IF i = 0 THEN 0 ELSE IF fs[i] = <<"INV">> THEN i ELSE LastInvFrame(fs, i - 1)
After(fs) == SubSeq(fs, LastInvFrame(fs, Len(fs)) + 1, Len(fs))
FsTerm(fs) == LET T == {TermOf(fs[i]) : i \in DOMAIN fs} \ {""} IN IF T = {} THEN "" ELSE CHOOSE t \in T : TRUE
Waves(fs) == SelectSeq([i \in DOMAIN fs |-> DataOf(fs[i])], LAMBDA x : x # <<>>)

\* S applies its prepared array: an INVALIDATE without a value is dropped; an
\* array with values replaces the retained ones (vals, its START snapshot).
RECURSIVE ApplyS(_, _, _)
ApplyS(s, fs, out) ==
  IF fs = <<>> THEN [s |-> s, out |-> out]
  ELSE LET f == Head(fs)
       IN IF f = <<"INV">>
          THEN IF s.has THEN ApplyS([s EXCEPT !.has = FALSE, !.vals = <<>>], Tail(fs), Append(out, f))
               ELSE ApplyS(s, Tail(fs), out)
          ELSE ApplyS([s EXCEPT !.has = s.has \/ DataOf(f) # <<>>,
                                !.vals = IF DataOf(f) # <<>> THEN DataOf(f) ELSE @,
                                !.ended = TermOf(f) # ""], Tail(fs), Append(out, f))

\* The kernel applies a node's output in order: an INVALIDATE is dropped while
\* the node has no value; nothing goes out after a terminal.
RECURSIVE ApplyOut(_, _, _)
ApplyOut(n, fs, out) ==
  IF fs = <<>> \/ n.ended THEN [n |-> n, out |-> out]
  ELSE LET f == Head(fs)
       IN IF f = <<"INV">>
          THEN IF n.has THEN ApplyOut([n EXCEPT !.has = FALSE], Tail(fs), Append(out, f))
               ELSE ApplyOut(n, Tail(fs), out)
          ELSE ApplyOut([n EXCEPT !.has = @ \/ DataOf(f) # <<>>, !.ended = TermOf(f) # ""],
                        Tail(fs), Append(out, f))

NoServe == [queue |-> <<>>, params |-> "none"]

\* ---- the composition: H = the quiet holder ----
\* fs: S's arrays; reqs: the pulls' sequence numbers and params, in order; v: the
\* service's choice. Returns the new H, what H sends in the wave and as a later
\* wave, and the service call, if any.
WaveComp(h, fs, reqs, v) ==
  LET depErr  == FsTerm(fs) = "ERR"                   \* auto ERROR: H does not run
      inv     == LastInvFrame(fs, Len(fs)) > 0        \* ctx.deps[0].invalidated
      rest    == After(fs)                            \* what came before it is gone
      arrived == Waves(rest)
      endC    == FsTerm(rest) = "COM"                 \* ctx.deps[0].terminal
      runs    == ~depErr /\ (arrived # <<>> \/ reqs # <<>> \/ endC \/ inv)
      \* the holder
      q0      == IF inv THEN <<>> ELSE h.queue
      invOut  == IF inv THEN << <<"INV">> >> ELSE <<>>
      queue   == q0 \o arrived
      fresh   == SelectSeq(reqs, LAMBDA r : r[1] > h.seen)
      serve   == runs /\ ~endC /\ fresh # <<>>
      fnOut   == invOut \o (IF endC THEN << <<"COM">> >>
                            ELSE IF serve /\ v = "V" THEN << <<"V">> >> ELSE <<>>)
      st      == [h EXCEPT !.queue = IF endC \/ serve THEN <<>> ELSE queue,
                           !.seen  = IF serve THEN fresh[Len(fresh)][1] ELSE @]
      \* quiet: all of its output is a later wave; silence needs no RESOLVED
      \* auto ERROR: an INVALIDATE before it still takes effect, sent with it as the later wave
      out     == IF depErr THEN (IF inv THEN << <<"INV">>, <<"ERR">> >> ELSE << <<"ERR">> >>)
                 ELSE IF runs THEN fnOut ELSE <<>>
      ap      == ApplyOut(IF runs THEN st ELSE h, out, <<>>)
  IN [h |-> ap.n, now |-> <<>>, later |-> ap.out,
      call |-> IF serve THEN [queue |-> queue, params |-> fresh[Len(fresh)][2]] ELSE NoServe]

\* ---- the rule: R-demand's holder, from its text ----
WaveSpec(sp, fs, pulls, v) ==
  LET inv  == LastInvFrame(fs, Len(fs)) > 0
      lead == inv /\ sp.has                         \* INVALIDATE goes on as output (dropped without a value)
      held0 == IF inv THEN <<>> ELSE sp.held        \* and discards what was held
      rest == After(fs)
      end  == FsTerm(fs)                            \* the input's terminal ends the holder
      held == held0 \o Waves(rest)
      serve == end = "" /\ pulls # <<>>             \* served once, with the latest params
      sent == serve /\ v = "V"
  IN [sp |-> [sp EXCEPT !.held = IF serve \/ end # "" THEN <<>> ELSE held,
                        !.has = (@ /\ ~lead) \/ sent, !.ended = end # ""],
      \* nothing in the wave; all of it as a later wave
      later |-> (IF lead THEN << <<"INV">> >> ELSE <<>>)
                \o (IF sent THEN << <<"V">> >> ELSE <<>>)
                \o (IF end # "" THEN << <<end>> >> ELSE <<>>),
      call |-> IF serve THEN [queue |-> held, params |-> pulls[Len(pulls)]] ELSE NoServe]

Fresh == [queue |-> <<>>, seen |-> 0, has |-> FALSE, ended |-> FALSE]

Init ==
  k = [s |-> [has |-> TRUE, vals |-> <<"D0">>, ended |-> FALSE], seq |-> 0, active |-> FALSE,
       h  |-> Fresh,
       sp |-> [held |-> <<>>, has |-> FALSE, ended |-> FALSE],
       now |-> <<>>, later |-> <<>>, spLater |-> <<>>,
       call |-> NoServe, spCall |-> NoServe, pulled |-> FALSE, lastParams |-> "none", steps |-> 0]

Quiet(s) == [s EXCEPT !.now = <<>>, !.later = <<>>, !.spLater = <<>>,
                      !.call = NoServe, !.spCall = NoServe, !.pulled = FALSE, !.steps = @ + 1]

\* A host batch: an array for S (or none) and pulls. An ended S refuses input.
Wave ==
  \E sa \in (IF k.s.ended THEN {<<>>} ELSE SArrays \cup {<<>>}), pulls \in Pulls, v \in {"V", "none"} :
    /\ sa # <<>> \/ pulls # <<>>
    /\ LET sr   == IF sa = <<>> THEN [s |-> k.s, out |-> <<>>] ELSE ApplyS(k.s, Prepare(sa), <<>>)
           reqs == [i \in DOMAIN pulls |-> <<k.seq + i, pulls[i]>>]
           live == k.active /\ ~k.h.ended
           c    == WaveComp(k.h, sr.out, reqs, v)
           w    == WaveSpec(k.sp, sr.out, pulls, v)
       IN k' = [Quiet(k) EXCEPT !.s = sr.s, !.seq = k.seq + Len(pulls), !.pulled = pulls # <<>>,
                                !.lastParams = IF pulls # <<>> THEN pulls[Len(pulls)] ELSE @,
                                !.h = IF live THEN c.h ELSE @,
                                !.now = IF live THEN c.now ELSE <<>>, !.later = IF live THEN c.later ELSE <<>>,
                                !.call = IF live THEN c.call ELSE NoServe,
                                !.sp = IF live THEN w.sp ELSE @,
                                !.spLater = IF live THEN w.later ELSE <<>>,
                                !.spCall = IF live THEN w.call ELSE NoServe]

\* Activation: H's first run gets the snapshots as input, S's retained values and
\* Dm's last pull, and starts with that pull recorded as seen, so it is not served;
\* nothing subscribes yet, so its output only sets H's value. The rule: the holder
\* holds the input's snapshot and serves only later pulls.
Subscribe ==
  /\ ~k.active /\ ~k.s.ended
  /\ \E v \in {"V", "none"} :
       LET snap == IF k.s.has THEN << k.s.vals >> ELSE <<>>
           dm   == IF k.seq > 0 THEN << <<k.seq, k.lastParams>> >> ELSE <<>>
           c    == WaveComp([Fresh EXCEPT !.seen = k.seq], snap, dm, v)
       IN k' = [Quiet(k) EXCEPT !.active = TRUE, !.h = c.h, !.call = c.call,
                   !.sp = [held |-> snap, has |-> FALSE, ended |-> FALSE]]

\* Deactivation drops H's private state and value.
Unsubscribe ==
  /\ k.active /\ ~k.h.ended
  /\ k' = [Quiet(k) EXCEPT !.active = FALSE, !.h = Fresh,
              !.sp = [held |-> <<>>, has |-> FALSE, ended |-> FALSE]]

Next == k.steps < MaxSteps /\ (Wave \/ Subscribe \/ Unsubscribe)

Spec == Init /\ [][Next]_vars

\* ---- invariants ----
Serves == k.call = k.spCall
OutputMatches == k.now = <<>> /\ k.later = k.spLater
HeldMatches == ~k.active \/ k.h.ended \/ k.h.queue = k.sp.held
ServeOnlyOnPull == k.call # NoServe => k.pulled
InactiveHoldsNothing == ~k.active => (k.h.queue = <<>> /\ ~k.h.has)
EndsWithInput == k.active => (k.h.ended = k.s.ended /\ k.sp.ended = k.s.ended)
=============================================================================
