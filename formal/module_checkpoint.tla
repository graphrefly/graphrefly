-------------------------- MODULE module_checkpoint --------------------------
(***************************************************************************
GraphReFly D797 checkpoint module — a restored node goes on as the original.

A candidate model for the D797 draft module rule R-checkpoint, written
2026-11-09 for graphrefly:B140, the fourth module model. It checks that a node
restored by reference/modules/checkpoint.mjs, once subscribed, behaves as the
original node would. Status: R-checkpoint is active since D802 (2026-11-10).

Topology: states A and B, and a computed node P over [A, B] built from a recipe,
with a sink, under the default auto policies. The recipe keeps the last N input
values it received, as <<dependency, value>> pairs, in private state and sends
them as its value; a run that brings no new array sends nothing and changes
nothing (R-invocation). Two choices are made at Init. Setup: P has a setup
that opens an outside resource and returns the cleanup that closes it; no
checkpoint can hold a resource or a cleanup, and the setup runs at every
activation, a restored one's included (K7, decided by the user 2026-11-10;
from 2026-11-09 to 2026-11-10 A2 instead ran a restored P whose last run had
registered a cleanup). Manual: P has the manual INVALIDATE policy
(R-invalidation, 2026-11-09), so an INVALIDATE is its function's input, which
empties the private state and sends INVALIDATE (dropped if P holds no value);
under auto the kernel invalidates P and its private state stays. Until
2026-11-09 Hook was an onInvalidate cleanup that emptied the private state.

The host's steps are a write to A or B, a write to both in one batch, an
INVALIDATE of A or B, and a COMPLETE of A or B. There are three phases:
  - orig:   the original graph, P subscribed, takes the host's steps live;
  - window: after one capture and restore; the restored P has no subscriber,
            and the host's steps reach only the states;
  - post:   after the restored P's first subscription; both graphs take the
            same host steps live.
The reference is the original P with the window's steps given to it as one
live wave at the moment of that subscription, holding what changed since it
last received: each dependency whose value changed brings its value, one whose
end alone changed brings its end. That is what R-checkpoint says the restored
node may see ("only the values and terminals then are compared"): an INVALIDATE
in the window, a write repeated or written back there, are not seen, which is
why the rule asks a host that must not lose them to subscribe before writing.
The live original would see them; this model does not compare with it. The restored
P goes through the module: a kernel seed, the setup the kernel runs at the
activation, and a wrapper that runs the recipe once at the first activation if
an input changed, with only the changed inputs.

Extended for D802 (2026-11-10): before capture the original P may be replaced once, by
an instance with another recipe ("r2", which keeps only its last value), another setup or no
recipe at all; and at Init P was made either after both dependencies or before B, as when a
replace pointed it at a node made later. Capture takes the current instance's recipe and
setup; restore refuses a P without a recipe and builds each node after its dependencies.

Invariants (see formal/README.md):
  StateMatches    after the subscription, the restored P holds the reference's
                  value, private state and terminal
  ResourceMatches ... and holds an open resource exactly when the reference does
  OutMatches      on each later step both send the same thing
  NoNeedlessRun   the restored recipe runs at activation only if an input
                  changed
  RestoreBuilds   restore never builds a node before one of its dependencies
  LocalOnlyRefused  a P whose instance has no recipe is never restored
  RestoredAsInstance  the restored P has the captured instance's recipe and setup
 ***************************************************************************)
EXTENDS Integers, Sequences, TLC

CONSTANTS MaxSteps

Deps == <<"A", "B">>
Vals == {1, 2}
N == 2
NoVal == 0

VARIABLE k
vars == <<k>>

LastN(s, m) == IF Len(s) <= m THEN s ELSE SubSeq(s, Len(s) - m + 1, Len(s))
AllEnded(ds) == ds["A"].e /\ ds["B"].e

\* The recipe's run on the new input values (a sequence of <<dep, value>>). The instance's
\* recipe (n.rec) chooses the function: "r1" keeps the last N values, "r2" only the last
\* one; "none" is an instance replaced without a recipe, running r1's function (D802).
Keep(n) == IF n.rec = "r2" THEN 1 ELSE N
Run(n, new) ==
  IF new = <<>> THEN n
  ELSE LET st == LastN(n.st \o new, Keep(n))
       IN [n EXCEPT !.st = st, !.has = TRUE, !.val = st]

\* One host step as a live wave to an active node n. ds2 is the states after it.
Live(n, step, ds2) ==
  IF n.ended THEN [n |-> n, out |-> <<>>]
  ELSE IF step.kind = "inv"
  THEN IF k.manual
       THEN [n |-> [n EXCEPT !.has = FALSE, !.val = <<>>, !.st = <<>>, !.inp = ds2],
             out |-> IF n.has THEN <<"INV">> ELSE <<>>]
       ELSE IF ~n.has THEN [n |-> [n EXCEPT !.inp = ds2], out |-> <<>>]
       ELSE [n |-> [n EXCEPT !.has = FALSE, !.val = <<>>, !.inp = ds2], out |-> <<"INV">>]
  ELSE IF step.kind = "com"
  \* auto COMPLETE: the function does not run on an end alone; P ends with its last input,
  \* and its lifetime closes, which runs the setup's cleanup.
  THEN IF AllEnded(ds2) THEN [n |-> [n EXCEPT !.ended = TRUE, !.res = FALSE, !.inp = ds2], out |-> <<"COM">>]
       ELSE [n |-> [n EXCEPT !.inp = ds2], out |-> <<>>]
  ELSE LET n1 == Run(n, step.new) IN [n |-> [n1 EXCEPT !.inp = ds2], out |-> << <<"D", n1.val>> >>]

\* What changed since a node last received: values (with their arrays) and ends.
ValChanged(ds, inp, d) == ds[d].v # inp[d].v
EndChanged(ds, inp, d) == ds[d].e # inp[d].e
NewValues(ds, inp) ==
  SelectSeq(<< <<"A", ds["A"].v>>, <<"B", ds["B"].v>> >>,
            LAMBDA p : ValChanged(ds, inp, p[1]) /\ p[2] # NoVal)
Changed(ds, inp) == \E i \in 1..2 : ValChanged(ds, inp, Deps[i]) \/ EndChanged(ds, inp, Deps[i])

\* The reference: the original P gets the window's net change as one live wave: a
\* write from each state whose value differs from what P last received, in declaration
\* order, and the ends; an end alone does not run P (auto COMPLETE).
RefWrites(ds, inp) ==
  LET w(d) == IF ds[d].v # inp[d].v /\ ds[d].v # NoVal THEN << <<d, ds[d].v>> >> ELSE <<>>
  IN w("A") \o w("B")
RefWave(o, ds) ==
  IF o.ended THEN o
  ELSE LET new == RefWrites(ds, o.inp)
           o1  == IF new # <<>> THEN Run(o, new) ELSE o
       IN [o1 EXCEPT !.ended = AllEnded(ds), !.res = @ /\ ~AllEnded(ds), !.inp = ds]

\* The restored P's first activation through the module. An ended P has no lifetime, so no
\* setup; otherwise the kernel runs the setup, then the wrapper, which runs the recipe only
\* if an input changed; a P that ends at once closes its lifetime again. The recipe and the
\* setup are the captured instance's (cp.rec, cp.setup).
Activate(cp, ds) ==
  LET setup == cp.setup
      seed == [st |-> cp.st, has |-> cp.has, val |-> cp.val, ended |-> cp.ended, res |-> FALSE, inp |-> ds, rec |-> cp.rec]
      new  == NewValues(ds, cp.inp)
      run  == ~cp.ended /\ Changed(ds, cp.inp)
      n0   == IF ~cp.ended /\ setup THEN [seed EXCEPT !.res = TRUE] ELSE seed
      n1   == IF run THEN Run(n0, new) ELSE n0
      end  == cp.ended \/ AllEnded(ds)
  IN [n |-> [n1 EXCEPT !.ended = end, !.res = @ /\ ~end], ran |-> run]

Steps ==
  { [kind |-> "set", new |-> << <<d, v>> >>, d |-> d] : d \in {"A", "B"}, v \in Vals } \cup
  { [kind |-> "set", new |-> << <<"A", va>>, <<"B", vb>> >>, d |-> "AB"] : va \in Vals, vb \in Vals } \cup
  { [kind |-> "inv", new |-> <<>>, d |-> d] : d \in {"A", "B"} } \cup
  { [kind |-> "com", new |-> <<>>, d |-> d] : d \in {"A", "B"} }

Allowed(step, ds) ==
  CASE step.kind = "set" -> \A i \in DOMAIN step.new : ~ds[step.new[i][1]].e
    [] step.kind = "inv" -> ds[step.d].v # NoVal /\ ~ds[step.d].e
    [] step.kind = "com" -> ~ds[step.d].e

Apply(step, ds) ==
  CASE step.kind = "set" -> [d \in {"A", "B"} |->
                               IF \E i \in DOMAIN step.new : step.new[i][1] = d
                               THEN [ds[d] EXCEPT !.v = (CHOOSE p \in {step.new[i] : i \in DOMAIN step.new} : p[1] = d)[2]]
                               ELSE ds[d]]
    [] step.kind = "inv" -> [ds EXCEPT ![step.d].v = NoVal]
    [] step.kind = "com" -> [ds EXCEPT ![step.d].e = TRUE]

D0 == [d \in {"A", "B"} |-> [v |-> 1, e |-> FALSE]]
Empty == [st |-> <<>>, has |-> FALSE, val |-> <<>>, ended |-> FALSE, res |-> FALSE, inp |-> D0, rec |-> "r1"]

\* Creation order (D802). P depends on A and B. Either both were made before P, or P was
\* replaced onto B, which was made after it; restore builds each node after its declared
\* dependencies and otherwise in creation order (R-checkpoint).
NodeDeps(x) == IF x = "P" THEN {"A", "B"} ELSE {}
Creation(order) == IF order = "deps-first" THEN <<"A", "B", "P">> ELSE <<"A", "P", "B">>
RemoveAt(s, i) == SubSeq(s, 1, i - 1) \o SubSeq(s, i + 1, Len(s))
RECURSIVE BuildFrom(_, _)
BuildFrom(rem, built) ==
  IF rem = <<>> THEN <<>>
  ELSE LET i == CHOOSE i \in DOMAIN rem :
                  /\ NodeDeps(rem[i]) \subseteq built
                  /\ \A j \in 1..(i - 1) : ~(NodeDeps(rem[j]) \subseteq built)
       IN <<rem[i]>> \o BuildFrom(RemoveAt(rem, i), built \cup {rem[i]})
BuildOrder(order) == BuildFrom(Creation(order), {})
Builds(seq) == \A i \in DOMAIN seq : NodeDeps(seq[i]) \subseteq {seq[j] : j \in 1..(i - 1)}

\* The values a new instance's first run gets: each dependency's snapshot.
SnapVals(ds) == SelectSeq(<< <<"A", ds["A"].v>>, <<"B", ds["B"].v>> >>, LAMBDA p : p[2] # NoVal)

Init ==
  \E setup \in BOOLEAN, manual \in BOOLEAN, order \in {"deps-first", "dep-later"} :
    k = [setup |-> setup, manual |-> manual, phase |-> "orig", ds |-> D0,
         order |-> order, replaced |-> FALSE, first |-> [rec |-> "r1", setup |-> setup],
         \* the original's activation: its setup, then its first run
         o |-> Run([Empty EXCEPT !.res = setup], << <<"A", 1>>, <<"B", 1>> >>),
         cp |-> [st |-> <<>>, has |-> FALSE, val |-> <<>>, ended |-> FALSE, inp |-> D0, rec |-> "r1", setup |-> FALSE],
         r |-> Empty, ran |-> FALSE, chg |-> FALSE, oOut |-> <<>>, rOut |-> <<>>, steps |-> 0]

Step(s) == [s EXCEPT !.steps = @ + 1, !.oOut = <<>>, !.rOut = <<>>]

Host ==
  \E step \in Steps :
    /\ k.phase \in {"orig", "window", "post"}
    /\ Allowed(step, k.ds)
    /\ LET ds2 == Apply(step, k.ds)
           o == Live(k.o, step, ds2)
           r == Live(k.r, step, ds2)
       IN k' = [Step(k) EXCEPT !.ds = ds2,
                  !.o = IF k.phase = "window" THEN @ ELSE o.n,
                  !.oOut = IF k.phase = "window" THEN <<>> ELSE o.out,
                  !.r = IF k.phase = "post" THEN r.n ELSE @,
                  !.rOut = IF k.phase = "post" THEN r.out ELSE <<>>]

\* A replace of the original P, once, before capture (D802): a new instance under the same id
\* with its own recipe (or none) and setup. The old lifetime closes, so its resource and private
\* state go; the new instance's setup runs and its first run gets the dependencies' snapshots.
Replace ==
  /\ k.phase = "orig" /\ ~k.replaced /\ ~k.o.ended
  /\ \E rec \in {"r1", "r2", "none"}, setup \in BOOLEAN :
       LET fresh == [st |-> <<>>, has |-> FALSE, val |-> <<>>, ended |-> FALSE, res |-> setup,
                     inp |-> k.ds, rec |-> rec]
           n1    == Run(fresh, SnapVals(k.ds))
           end   == AllEnded(k.ds)
       IN k' = [Step(k) EXCEPT !.o = [n1 EXCEPT !.ended = end, !.res = @ /\ ~end],
                  !.setup = setup, !.replaced = TRUE]

\* Capture at a wave boundary: P's values, private state, terminal and received inputs, with
\* the recipe and setup of its current instance. Restore then builds the new graph: a P whose
\* instance has no recipe is local-only and the restore fails ("local"); a build order that
\* puts P before a dependency cannot build it ("broken").
Capture ==
  /\ k.phase = "orig"
  /\ k' = [Step(k) EXCEPT
             !.phase = IF k.o.rec = "none" THEN "local"
                       ELSE IF ~Builds(BuildOrder(k.order)) THEN "broken" ELSE "window",
             !.cp = [st |-> k.o.st, has |-> k.o.has, val |-> k.o.val, ended |-> k.o.ended,
                     inp |-> k.o.inp, rec |-> k.o.rec, setup |-> k.setup]]

Subscribe ==
  /\ k.phase = "window"
  /\ LET a == Activate(k.cp, k.ds)
     IN k' = [Step(k) EXCEPT !.phase = "post", !.r = a.n, !.ran = a.ran,
               !.chg = Changed(k.ds, k.cp.inp), !.o = RefWave(k.o, k.ds)]

Next == k.steps < MaxSteps /\ (Host \/ Replace \/ Capture \/ Subscribe)

Spec == Init /\ [][Next]_vars

\* ---- invariants ----
StateMatches == k.phase = "post" =>
  /\ k.r.st = k.o.st /\ k.r.has = k.o.has /\ k.r.val = k.o.val /\ k.r.ended = k.o.ended
ResourceMatches == k.phase = "post" => k.r.res = k.o.res
OutMatches == k.phase = "post" => k.rOut = k.oOut
NoNeedlessRun == k.phase = "post" /\ k.ran => k.chg
\* D802: restore builds each node after its dependencies, refuses a local-only P, and gives
\* the restored P the captured instance's recipe and setup.
RestoreBuilds      == k.phase # "broken"
LocalOnlyRefused   == k.phase \in {"window", "post"} => k.o.rec # "none"
RestoredAsInstance == k.phase \in {"window", "post"} => k.cp.rec = k.o.rec /\ k.cp.setup = k.setup
=============================================================================
