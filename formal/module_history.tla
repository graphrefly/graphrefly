--------------------------- MODULE module_history ---------------------------
(***************************************************************************
GraphReFly D797 history module — the history node meets R-history.

A candidate model for the D797 draft module rule R-history, written 2026-11-09
(revised the same day for the array shape)
for graphrefly:B140, the third module model. It checks that the node built by
reference/modules/history.mjs behaves as R-history says. Status: draft, like
the rule it checks.

Topology: a computed source X, kept active by a sink of its own, and the
history node H over X with N = 2 and a sink that subscribes and unsubscribes.
X sends, per wave, one entry of a menu of array sequences (several arrays, an
array with two values, values with a terminal, INVALIDATE and values, RESOLVED
alone or before values); its retained values are the DATA of its last array
that had any (R-subscription). H uses the default auto policies.

H's list holds waves: each entry is one wave's ctx.deps[0].waves, the source's
arrays in that wave that carried DATA, each as its DATA payloads; N counts
waves (the user's decision, 2026-11-09). The first version of this model, with a flat list, found that the
draft text sent one list per source array while history.mjs sent one per wave;
the user chose one per wave.

Two things run side by side on every step:
  - the composition: H settles as a kernel node (auto ERROR without running;
    an INVALIDATE input is the function's input under H's manual INVALIDATE
    policy: it empties the list and sends INVALIDATE, then takes what came after it; auto COMPLETE after the run), with its
    function transcribed from history.mjs; activation runs it once on X's
    snapshot, deactivation drops its value and private state;
  - the rule: a history written straight from R-history's text, which walks
    the wave's arrays one at a time into the wave's entry and sends once at
    the end of the wave.

Invariants (see formal/README.md):
  Refines        H sends what R-history's node sends, step by step
  ListMatches    H's private list is the rule's list
  ValueIsList    while H has a value, it is its list
  InactiveEmpty  an inactive H has no value and no list
Tokens: "a","b" DATA, "INV", "COM", "ERR", "RES"; H's DATA carries its list,
a sequence of waves, each a sequence of arrays, each a sequence of values.
 ***************************************************************************)
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS MaxSteps

N == 2
IsData(x) == x \in {"a", "b"}
IsTerm(x) == x \in {"COM", "ERR"}

\* What X may send in one wave: a sequence of arrays, already valid.
Menu == { << <<"a">> >>, << <<"a">>, <<"b">> >>, << <<"a", "b">> >>, << <<"b">>, <<"a", "b">> >>,
          << <<"RES">> >>, << <<"RES">>, <<"b">> >>, << <<"INV">> >>, << <<"INV">>, <<"b">> >>,
          << <<"a">>, <<"COM">> >>, << <<"a", "COM">> >>, << <<"ERR">> >> }

VARIABLE k
vars == <<k>>

DataOf(f) == SelectSeq(f, IsData)
HasTerm(fs, t) == \E i \in DOMAIN fs : \E j \in DOMAIN fs[i] : fs[i][j] = t
RECURSIVE LastInvFrame(_, _)
LastInvFrame(fs, i) == IF i = 0 THEN 0 ELSE IF fs[i] = <<"INV">> THEN i ELSE LastInvFrame(fs, i - 1)
After(fs) == SubSeq(fs, LastInvFrame(fs, Len(fs)) + 1, Len(fs))
LastN(s) == IF Len(s) <= N THEN s ELSE SubSeq(s, Len(s) - N + 1, Len(s))
\* What a dependent reads as ctx.deps[0].waves: per array with a value, its DATA payloads.
HasValue(f) == \E j \in DOMAIN f : IsData(f[j]) \/ f[j] = "RES"
Waves(fs) == LET vs == SelectSeq(fs, HasValue) IN [i \in DOMAIN vs |-> DataOf(vs[i])]

\* X applies what it sends: retained values are the DATA of its last array with any;
\* an INVALIDATE without a value is not sent.
RECURSIVE ApplyX(_, _, _)
ApplyX(x, fs, out) ==
  IF fs = <<>> THEN [x |-> x, out |-> out]
  ELSE LET f == Head(fs)
       IN IF f = <<"INV">>
          THEN IF x.vals # <<>> THEN ApplyX([x EXCEPT !.vals = <<>>], Tail(fs), Append(out, f))
               ELSE ApplyX(x, Tail(fs), out)
          ELSE ApplyX([x EXCEPT !.vals = IF DataOf(f) # <<>> THEN DataOf(f) ELSE @,
                                !.ended = \E j \in DOMAIN f : IsTerm(f[j])],
                      Tail(fs), Append(out, f))

\* ---- the composition: H runs historyRecipe ----
\* One invocation: what came after the last INVALIDATE, all arrays at once;
\* wave = ctx.deps[0].waves.filter((w) => w.length); list = [...list, wave].slice(-n).
CompWave(h, fs) ==
  LET err  == HasTerm(fs, "ERR")                    \* auto ERROR: no run
      inv  == LastInvFrame(fs, Len(fs)) > 0
      lead == ~err /\ inv /\ h.has
      \* manual INVALIDATE (2026-11-09): the function empties the list itself and sends
      \* INVALIDATE, which the kernel drops if H holds no value
      l0   == IF ~err /\ inv THEN <<>> ELSE h.list
      added == SelectSeq(Waves(After(fs)), LAMBDA w : w # <<>>)
      list == LastN(Append(l0, added))
      sends == ~err /\ added # <<>>
      done == err \/ HasTerm(fs, "COM")             \* auto COMPLETE after the run
      out  == (IF lead THEN << <<"INV">> >> ELSE <<>>)
              \o (IF sends THEN << <<"L">> >> ELSE <<>>)
              \o (IF done THEN << <<IF err THEN "ERR" ELSE "COM">> >> ELSE <<>>)
      lists == IF sends THEN <<list>> ELSE <<>>
  IN [h |-> [h EXCEPT !.list = IF sends THEN list ELSE l0, !.has = (@ /\ ~lead) \/ sends,
                      !.val = IF sends THEN list ELSE IF lead THEN <<>> ELSE @, !.ended = done],
      out |-> out, lists |-> lists]

\* ---- the rule: R-history, from its text ----
\* The wave's entry: each array carrying DATA, in order, as its DATA payloads;
\* an array without DATA is left out.
RECURSIVE SpecArrays(_, _)
SpecArrays(e, fs) ==
  IF fs = <<>> THEN e
  ELSE LET d == DataOf(Head(fs))
       IN SpecArrays(IF d = <<>> THEN e ELSE Append(e, d), Tail(fs))
SpecWave(sp, fs) ==
  LET err  == HasTerm(fs, "ERR")       \* the source's terminal ends the node (auto ERROR: no run)
      inv  == LastInvFrame(fs, Len(fs)) > 0
      lead == ~err /\ inv /\ sp.has     \* an INVALIDATE clears the node's value and the list
      l0   == IF inv THEN <<>> ELSE sp.list
      e    == IF err THEN <<>> ELSE SpecArrays(<<>>, After(fs))
      \* A wave without DATA is not an entry; one with DATA sends the new list once,
      \* and the list keeps the last N waves.
      r    == IF e = <<>> THEN [list |-> l0, lists |-> <<>>]
              ELSE [list |-> LastN(Append(l0, e)), lists |-> <<LastN(Append(l0, e))>>]
      done == err \/ HasTerm(fs, "COM")
      out  == (IF lead THEN << <<"INV">> >> ELSE <<>>)
              \o [i \in DOMAIN r.lists |-> <<"L">>]
              \o (IF done THEN << <<IF err THEN "ERR" ELSE "COM">> >> ELSE <<>>)
  IN [sp |-> [sp EXCEPT !.list = r.list, !.has = (@ /\ ~lead) \/ r.lists # <<>>, !.ended = done],
      out |-> out, lists |-> r.lists]

Init ==
  k = [x |-> [vals |-> << "a" >>, ended |-> FALSE], active |-> FALSE,
       h |-> [list |-> <<>>, has |-> FALSE, val |-> <<>>, ended |-> FALSE],
       sp |-> [list |-> <<>>, has |-> FALSE, ended |-> FALSE],
       out |-> <<>>, lists |-> <<>>, spOut |-> <<>>, spLists |-> <<>>, steps |-> 0]

Step(s) == [s EXCEPT !.steps = @ + 1, !.out = <<>>, !.lists = <<>>, !.spOut = <<>>, !.spLists = <<>>]

\* X sends one menu entry as a wave.
Wave ==
  /\ ~k.x.ended
  /\ \E m \in Menu :
       LET xr == ApplyX(k.x, m, <<>>)
           live == k.active /\ ~k.h.ended
           c == CompWave(k.h, xr.out)
           w == SpecWave(k.sp, xr.out)
       IN k' = [Step(k) EXCEPT !.x = xr.x,
                   !.h = IF live THEN c.h ELSE @, !.sp = IF live THEN w.sp ELSE @,
                   !.out = IF live THEN c.out ELSE <<>>, !.lists = IF live THEN c.lists ELSE <<>>,
                   !.spOut = IF live THEN w.out ELSE <<>>, !.spLists = IF live THEN w.lists ELSE <<>>]

\* Activation: H's first run gets X's snapshot, its last array's values, as one array.
\* The rule: the list starts with the source's snapshot.
Subscribe ==
  /\ ~k.active /\ ~k.x.ended
  /\ LET snap == IF k.x.vals # <<>> THEN << k.x.vals >> ELSE <<>>
         h0 == [list |-> <<>>, has |-> FALSE, val |-> <<>>, ended |-> FALSE]
         c == CompWave(h0, snap)
         w == SpecWave([list |-> <<>>, has |-> FALSE, ended |-> FALSE], snap)
     IN k' = [Step(k) EXCEPT !.active = TRUE, !.h = c.h, !.sp = w.sp, !.lists = c.lists, !.spLists = w.lists]

\* Deactivation drops H's value and private state.
Unsubscribe ==
  /\ k.active /\ ~k.h.ended
  /\ k' = [Step(k) EXCEPT !.active = FALSE,
              !.h = [list |-> <<>>, has |-> FALSE, val |-> <<>>, ended |-> FALSE],
              !.sp = [list |-> <<>>, has |-> FALSE, ended |-> FALSE]]

Next == k.steps < MaxSteps /\ (Wave \/ Subscribe \/ Unsubscribe)

Spec == Init /\ [][Next]_vars

\* ---- invariants ----
Refines == k.out = k.spOut /\ k.lists = k.spLists
ListMatches == ~k.active \/ k.h.list = k.sp.list
ValueIsList == k.h.has => k.h.val = k.h.list
InactiveEmpty == ~k.active => (~k.h.has /\ k.h.list = <<>>)
=============================================================================
