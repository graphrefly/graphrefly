--------------------------- MODULE module_pause ---------------------------
(***************************************************************************
GraphReFly D797 pause module — the one-node pausable meets R-pause.

A candidate model for the D797 draft module rule R-pause, written 2026-11-09 for
graphrefly:B140. It checks that the composition in reference/modules/pause.mjs,
one kernel node and a lock state, behaves as R-pause says a pausable does.
Status: draft, like the rule it checks. Until 2026-11-09 the pausable took two
nodes, a log before a release node, because a function could not see an
INVALIDATE; that version was retired the same day, when INVALIDATE got a manual
policy (R-invalidation) and the pausable became one node.

Topology: a state S (the input), a lock state L, P = pausableFn over [S, L]
with manual COMPLETE, ERROR and INVALIDATE, and a sink on P. Each wave is one
host input: an array written to S (a write, or a batch of writes,
invalidations and a terminal), a new lock set written to L, or both in one
batch. The function is deterministic, so the only choice is the input.

Two things run side by side on every wave:
  - the composition: S's array is prepared and applied as the kernel does it
    (split at its last INVALIDATE, INVALIDATE effective only with a value); P
    settles as a kernel node does: every array S sends and L's write mark it
    pending (an INVALIDATE array included); what came before an INVALIDATE on
    its input is gone and the function sees that one arrived; the function
    runs on value input, on a terminal or on an INVALIDATE (all manual); its
    output is applied in order, an INVALIDATE dropped while P has no value;
    a pending P that sends nothing settling gets RESOLVED. The function is
    pausableFn transcribed from pause.mjs;
  - the rule: a pausable written straight from R-pause's text, holding arrays
    while a lock is held, passing INVALIDATE and terminals at once, releasing
    every held array in one wave on the last unlock, and forwarding everything
    unchanged while unlocked; an INVALIDATE it passes is dropped while it has
    no value, and every arrival or lock write is a wave through it, settled by
    RESOLVED when nothing else settles it (R-invalidation, R-wave).

A function sees each dependency's DATA arrays and its terminal separately
(R-invocation), so whether a terminal shared an array with the last DATA is
not visible to it; outputs are compared with a trailing terminal moved into an
array of its own (Norm).

Invariants, each mutation-checked (see formal/README.md):
  Refines            P sends what R-pause's pausable sends, wave by wave
  HeldMatches        P's held arrays (its private state) are the rule's
  NoValueWhilePaused P sends no DATA while a lock is held
  EndsWithInput      P has ended exactly when S has

Not modeled: lifetimes (the locks are a plain state, so they outlive the
pausable by R-subscription), a source that reads the lock state, several
pausables on one lock state (one write to L is one wave by R-wave), and
placement before a node (that node receives P's output). The PENDING prefix
is the kernel's, one per marking array, so outputs are compared without it.
Tokens: "D0","D1","D2" DATA, "INV", "COM", "ERR", "RES".
 ***************************************************************************)
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS MaxWaves

Locks == {"a", "b"}
IsData(x) == x \in {"D0", "D1", "D2"}
IsTerm(x) == x \in {"COM", "ERR"}
Max(X) == CHOOSE x \in X : \A y \in X : y <= x

\* What a host batch can write to S as one array.
SArrays == { <<"D1">>, <<"D2">>, <<"D1", "D2">>, <<"INV">>, <<"COM">>, <<"ERR">>,
             <<"D1", "COM">>, <<"D2", "ERR">>, <<"D1", "INV", "D2">>, <<"INV", "D1">>,
             <<"INV", "COM">>, <<"INV", "ERR">> }

VARIABLE k
vars == <<k>>

\* ---- arrays ----
LastInv(a) == LET I == {i \in DOMAIN a : a[i] = "INV"} IN IF I = {} THEN 0 ELSE Max(I)
\* The kernel splits an array at its last INVALIDATE; what came before it is gone.
Prepare(a) ==
  LET c == LastInv(a)
  IN (IF c > 0 THEN << <<"INV">> >> ELSE <<>>) \o (IF c < Len(a) THEN << SubSeq(a, c + 1, Len(a)) >> ELSE <<>>)
DataOf(f) == SelectSeq(f, IsData)
TermOf(f) == LET T == {f[i] : i \in {j \in DOMAIN f : IsTerm(f[j])}} IN IF T = {} THEN "" ELSE CHOOSE t \in T : TRUE
HasData(fs)   == \E i \in DOMAIN fs : DataOf(fs[i]) # <<>>
IsInvFrame(f) == f = <<"INV">>
RECURSIVE LastInvFrame(_, _)
LastInvFrame(fs, i) == IF i = 0 THEN 0 ELSE IF IsInvFrame(fs[i]) THEN i ELSE LastInvFrame(fs, i - 1)
After(fs) == LET c == LastInvFrame(fs, Len(fs)) IN SubSeq(fs, c + 1, Len(fs))
FsTerm(fs) == LET T == {TermOf(fs[i]) : i \in DOMAIN fs} \ {""} IN IF T = {} THEN "" ELSE CHOOSE t \in T : TRUE
Waves(fs) == SelectSeq([i \in DOMAIN fs |-> DataOf(fs[i])], LAMBDA x : x # <<>>)
Settling(fs) == \E i \in DOMAIN fs : \E j \in DOMAIN fs[i] : fs[i][j] \in {"D0", "D1", "D2", "RES", "INV", "COM", "ERR"}

\* S applies its prepared array: an INVALIDATE without a value is dropped.
RECURSIVE ApplyS(_, _, _)
ApplyS(s, fs, out) ==
  IF fs = <<>> THEN [s |-> s, out |-> out]
  ELSE LET f == Head(fs)
       IN IF IsInvFrame(f)
          THEN IF s.has THEN ApplyS([s EXCEPT !.has = FALSE], Tail(fs), Append(out, f))
               ELSE ApplyS(s, Tail(fs), out)
          ELSE ApplyS([s EXCEPT !.has = s.has \/ DataOf(f) # <<>>, !.ended = TermOf(f) # ""],
                      Tail(fs), Append(out, f))

\* The kernel applies a node's output in order (apply): an INVALIDATE is dropped
\* while the node has no value; nothing goes out after a terminal.
RECURSIVE ApplyOut(_, _, _)
ApplyOut(n, fs, out) ==
  IF fs = <<>> \/ n.ended THEN [n |-> n, out |-> out]
  ELSE LET f == Head(fs)
       IN IF IsInvFrame(f)
          THEN IF n.has THEN ApplyOut([n EXCEPT !.has = FALSE], Tail(fs), Append(out, f))
               ELSE ApplyOut(n, Tail(fs), out)
          ELSE ApplyOut([n EXCEPT !.has = @ \/ DataOf(f) # <<>>, !.ended = TermOf(f) # ""],
                        Tail(fs), Append(out, f))

\* ---- the composition: P = pausableFn ----
\* The function's output for its held arrays, the input's terminal in the last one.
Release(held, end) ==
  IF held = <<>> THEN (IF end # "" THEN << <<end>> >> ELSE <<>>)
  ELSE IF end # "" THEN [held EXCEPT ![Len(held)] = @ \o <<end>>] ELSE held

\* P settles on S's arrays fs and L's write (lw); paused: L's value after the wave.
SettleP(p, fs, lw, paused) ==
  LET pending == fs # <<>> \/ lw                 \* every array S sends marks P (K2)
      inv  == LastInvFrame(fs, Len(fs)) > 0      \* ctx.deps[0].invalidated
      rest == After(fs)                          \* what came before the INVALIDATE is gone
      end  == FsTerm(rest)                       \* ctx.deps[0].terminal
      runs == Waves(rest) # <<>> \/ lw \/ end # "" \/ inv
      \* pausableFn
      held0 == IF inv THEN <<>> ELSE p.state
      invOut == IF inv THEN << <<"INV">> >> ELSE <<>>
      held == held0 \o Waves(rest)
      st   == IF paused THEN (IF end # "" THEN <<>> ELSE held) ELSE <<>>
      fnOut == invOut \o (IF paused THEN (IF end # "" THEN << <<end>> >> ELSE <<>>)
                          ELSE Release(held, end))
      ap   == ApplyOut(p, IF runs THEN fnOut ELSE <<>>, <<>>)
      frames == ap.out
  IN [p |-> [ap.n EXCEPT !.state = IF runs THEN st ELSE p.state],
      frames |-> IF pending /\ ~Settling(frames) THEN Append(frames, <<"RES">>) ELSE frames]

\* ---- the rule: R-pause's pausable, from its text ----
\* fs: S's arrays this wave; lw: a lock write; paused: a lock is held after the wave.
SpecWave(sp, fs, lw, paused) ==
  LET inv  == LastInvFrame(fs, Len(fs)) > 0
      lead == inv /\ sp.has                       \* INVALIDATE passes at once (dropped without a value)...
      held0 == IF inv THEN <<>> ELSE sp.held      \* ...and discards what was held before it
      rest == After(fs)
      arr  == SelectSeq(rest, LAMBDA f : DataOf(f) # <<>> \/ TermOf(f) # "")
      end  == FsTerm(rest)
      out  == IF paused
              THEN IF end # "" THEN << <<end>> >> ELSE <<>>   \* a terminal passes, discarding
              ELSE held0 \o arr                                \* release, then forward unchanged
      held == IF paused /\ end = "" THEN held0 \o Waves(rest) ELSE <<>>
      frames == (IF lead THEN << <<"INV">> >> ELSE <<>>) \o out
      pending == fs # <<>> \/ lw                  \* each arrival and each lock write is a wave through P
  IN [sp |-> [sp EXCEPT !.held = held, !.has = (sp.has /\ ~lead) \/ HasData(out), !.ended = end # ""],
      frames |-> IF pending /\ ~Settling(frames) THEN Append(frames, <<"RES">>) ELSE frames]

\* A trailing terminal moved into an array of its own.
NormFrame(f) == IF f # <<>> /\ IsTerm(f[Len(f)]) /\ Len(f) > 1
                THEN << SubSeq(f, 1, Len(f) - 1), <<f[Len(f)]>> >> ELSE <<f>>
RECURSIVE Norm(_)
Norm(fs) == IF fs = <<>> THEN <<>> ELSE NormFrame(Head(fs)) \o Norm(Tail(fs))

\* ---- waves ----
\* After the first activation: S holds D0; P, unpaused, sent D0 and holds nothing.
Init ==
  k = [s |-> [has |-> TRUE, ended |-> FALSE], locks |-> {},
       p |-> [has |-> TRUE, state |-> <<>>, ended |-> FALSE],
       sp |-> [held |-> <<>>, has |-> TRUE, ended |-> FALSE],
       pOut |-> <<>>, spOut |-> <<>>, waves |-> 0]

Wave(sa, nl) ==
  LET sr == IF sa = <<>> THEN [s |-> k.s, out |-> <<>>] ELSE ApplyS(k.s, Prepare(sa), <<>>)
      fs == sr.out
      lw == nl # k.locks
      paused == nl # {}
      pr == IF k.p.ended \/ (fs = <<>> /\ ~lw) THEN [p |-> k.p, frames |-> <<>>]
            ELSE SettleP(k.p, fs, lw, paused)
      sw == IF k.sp.ended \/ (fs = <<>> /\ ~lw) THEN [sp |-> k.sp, frames |-> <<>>]
            ELSE SpecWave(k.sp, fs, lw, paused)
  IN k' = [k EXCEPT !.s = sr.s, !.locks = nl, !.p = pr.p, !.sp = sw.sp,
                    !.pOut = pr.frames, !.spOut = sw.frames, !.waves = @ + 1]

Next ==
  /\ k.waves < MaxWaves
  /\ \E sa \in (IF k.s.ended THEN {<<>>} ELSE SArrays \cup {<<>>}), nl \in SUBSET Locks :
       (sa # <<>> \/ nl # k.locks) /\ Wave(sa, nl)

Spec == Init /\ [][Next]_vars

\* ---- invariants ----
Refines == Norm(k.pOut) = Norm(k.spOut)
HeldMatches == k.p.ended \/ k.p.state = k.sp.held
NoValueWhilePaused == k.locks # {} => ~HasData(k.pOut)
EndsWithInput == k.p.ended <=> k.s.ended
=============================================================================
