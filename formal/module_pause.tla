--------------------------- MODULE module_pause ---------------------------
(***************************************************************************
GraphReFly D797 pause module — the pausable built from kernel nodes meets R-pause.

A candidate model for the D797 draft module rule R-pause, written 2026-11-09 for
graphrefly:B140. It checks that the composition in reference/modules/pause.mjs,
two ordinary kernel nodes and a lock state, behaves as R-pause says a pausable
does. Status: draft, like the rule it checks.

Topology: a state S (the input), a lock state L, G = pauseLog over [S, L] and
P = release over [G, L], both with manual COMPLETE and ERROR, and a sink on P.
Each wave is one host input: an array written to S (a write, or a batch of
writes, invalidations and a terminal), a new lock set written to L, or both in
one batch. Both functions are deterministic, so the only choice is the input.

Two things run side by side on every wave:
  - the composition: S's array is prepared and applied as the kernel does it
    (split at its last INVALIDATE, INVALIDATE effective only with a value); G
    and P settle as kernel nodes do (an INVALIDATE input invalidates the node
    without running its function and runs its onInvalidate hook; the function
    runs on value input or, under manual policy, on a terminal; a pending node
    that sends nothing settling gets RESOLVED), with the functions pauseLog and
    releaseLog transcribed from pause.mjs;
  - the rule: a pausable written straight from R-pause's text, holding arrays
    while a lock is held, passing INVALIDATE and terminals at once, releasing
    every held array in one wave on the last unlock, and forwarding everything
    unchanged while unlocked.

A function sees each dependency's DATA arrays and its terminal separately
(R-invocation), so whether a terminal shared an array with the last DATA is
not visible to it; outputs are compared with a trailing terminal moved into an
array of its own (Norm).

Invariants, each mutation-checked (see formal/README.md):
  Refines            P sends what R-pause's pausable sends, wave by wave
  HeldMatches        G's held queue is the rule's held arrays
  NoValueWhilePaused P sends no DATA while a lock is held
  EndsWithInput      P has ended exactly when S has

Not modeled: lifetimes (the locks are a plain state, so they outlive the
pausable by R-subscription), a source that reads the lock state, several
pausables on one lock state (one write to L is one wave by R-wave), and
placement before a node (that node receives P's output).
Tokens: "D0","D1","D2" DATA, "INV", "COM", "ERR", "RES", and "Q" for G's DATA,
whose payload, the queue, is G's value.
 ***************************************************************************)
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS MaxWaves

Locks == {"a", "b"}
IsData(x) == x \in {"D0", "D1", "D2"}
IsTerm(x) == x \in {"COM", "ERR"}
Range(s) == {s[i] : i \in DOMAIN s}
Max(X) == CHOOSE x \in X : \A y \in X : y <= x

\* What a host batch can write to S as one array.
SArrays == { <<"D1">>, <<"D2">>, <<"D1", "D2">>, <<"INV">>, <<"COM">>, <<"ERR">>,
             <<"D1", "COM">>, <<"D2", "ERR">>, <<"D1", "INV", "D2">>, <<"INV", "D1">> }

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
Settling(fs) == \E i \in DOMAIN fs : \E j \in DOMAIN fs[i] : fs[i][j] \in {"D0", "D1", "D2", "Q", "RES", "INV", "COM", "ERR"}

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

\* ---- the composition: G = pauseLog, P = releaseLog ----
\* G settles on S's arrays fs and on L's write (lw). Returns G's new state and frames.
SettleG(g, fs, lw, paused) ==
  LET pending == HasData(fs) \/ lw
      inv  == LastInvFrame(fs, Len(fs)) > 0
      lead == inv /\ g.has
      g1   == IF lead THEN [g EXCEPT !.has = FALSE, !.val = <<>>, !.state = <<>>] ELSE g  \* onInvalidate
      rest == After(fs)
      arrived == SelectSeq([i \in DOMAIN rest |-> DataOf(rest[i])], LAMBDA x : x # <<>>)
      end  == FsTerm(rest)
      runs == arrived # <<>> \/ lw \/ end # ""
      queue == g1.state \o arrived
      \* pauseLog's output, as one array of tokens ("Q" carries the queue)
      out  == IF ~runs THEN <<>>
              ELSE IF paused
                   THEN IF end # "" THEN <<end>> ELSE IF arrived # <<>> THEN <<"Q">> ELSE <<>>
                   ELSE (IF queue # <<>> THEN <<"Q">> ELSE <<>>) \o (IF end # "" THEN <<end>> ELSE <<>>)
      st   == IF ~runs THEN g1.state ELSE IF paused /\ end = "" THEN queue ELSE <<>>
      g2   == [g1 EXCEPT !.state = st,
                         !.has = @ \/ "Q" \in Range(out),
                         !.val = IF "Q" \in Range(out) THEN queue ELSE @,
                         !.ended = end # "" /\ runs]
      frames == (IF lead THEN << <<"INV">> >> ELSE <<>>) \o (IF out # <<>> THEN <<out>> ELSE <<>>)
  IN [g |-> g2, frames |-> IF pending /\ ~Settling(frames) THEN Append(frames, <<"RES">>) ELSE frames,
      pending |-> pending]

\* P settles on G's frames and L's write.
SettleP(p, g, gfs, gpend, lw, paused) ==
  LET pending == gpend \/ lw
      inv  == LastInvFrame(gfs, Len(gfs)) > 0
      lead == inv /\ p.has
      p1   == IF lead THEN [p EXCEPT !.has = FALSE] ELSE p
      rest == After(gfs)
      logData == \E i \in DOMAIN rest : "Q" \in Range(rest[i])
      end  == FsTerm(rest)
      runs == logData \/ (\E i \in DOMAIN rest : "RES" \in Range(rest[i])) \/ lw \/ end # ""
      arrays0 == IF runs /\ ~paused /\ logData THEN g.val ELSE <<>>
      arrays  == IF runs /\ end # ""
                 THEN IF arrays0 # <<>> THEN [arrays0 EXCEPT ![Len(arrays0)] = @ \o <<end>>]
                      ELSE << <<end>> >>
                 ELSE arrays0
      out  == IF paused /\ end = "" THEN <<>> ELSE arrays
      p2   == [p1 EXCEPT !.has = @ \/ HasData(out), !.ended = end # "" /\ runs]
      frames == (IF lead THEN << <<"INV">> >> ELSE <<>>) \o out
  IN [p |-> p2, frames |-> IF pending /\ ~Settling(frames) THEN Append(frames, <<"RES">>) ELSE frames]

\* ---- the rule: R-pause's pausable, from its text ----
\* fs: S's arrays this wave; lw: a lock write; paused: a lock is held after the wave.
SpecWave(sp, fs, lw, paused) ==
  LET inv  == LastInvFrame(fs, Len(fs)) > 0
      lead == inv /\ sp.has                       \* INVALIDATE passes at once...
      held0 == IF inv THEN <<>> ELSE sp.held      \* ...and discards what was held before it
      rest == After(fs)
      arr  == SelectSeq(rest, LAMBDA f : DataOf(f) # <<>> \/ TermOf(f) # "")
      end  == FsTerm(rest)
      out  == IF paused
              THEN IF end # "" THEN << <<end>> >> ELSE <<>>   \* a terminal passes, discarding
              ELSE held0 \o arr                                \* release, then forward unchanged
      held == IF paused /\ end = "" THEN held0 \o SelectSeq([i \in DOMAIN rest |-> DataOf(rest[i])], LAMBDA x : x # <<>>)
              ELSE <<>>
      frames == (IF lead THEN << <<"INV">> >> ELSE <<>>) \o out
      pending == HasData(fs) \/ lw                \* each write is a wave through P
  IN [sp |-> [sp EXCEPT !.held = held, !.has = (sp.has /\ ~lead) \/ HasData(out), !.ended = end # ""],
      frames |-> IF pending /\ ~Settling(frames) THEN Append(frames, <<"RES">>) ELSE frames]

\* A trailing terminal moved into an array of its own.
NormFrame(f) == IF f # <<>> /\ IsTerm(f[Len(f)]) /\ Len(f) > 1
                THEN << SubSeq(f, 1, Len(f) - 1), <<f[Len(f)]>> >> ELSE <<f>>
RECURSIVE Norm(_)
Norm(fs) == IF fs = <<>> THEN <<>> ELSE NormFrame(Head(fs)) \o Norm(Tail(fs))

\* ---- waves ----
\* After the first activation: S holds D0; G published the queue <<D0>>; P sent D0.
Init ==
  k = [s |-> [has |-> TRUE, ended |-> FALSE], locks |-> {},
       g |-> [has |-> TRUE, val |-> << <<"D0">> >>, state |-> <<>>, ended |-> FALSE],
       p |-> [has |-> TRUE, ended |-> FALSE],
       sp |-> [held |-> <<>>, has |-> TRUE, ended |-> FALSE],
       pOut |-> <<>>, spOut |-> <<>>, waves |-> 0]

Wave(sa, nl) ==
  LET sr == IF sa = <<>> THEN [s |-> k.s, out |-> <<>>] ELSE ApplyS(k.s, Prepare(sa), <<>>)
      fs == sr.out
      lw == nl # k.locks
      paused == nl # {}
      gr == IF k.g.ended THEN [g |-> k.g, frames |-> <<>>, pending |-> FALSE] ELSE SettleG(k.g, fs, lw, paused)
      pr == IF k.p.ended \/ (gr.frames = <<>> /\ ~lw) THEN [p |-> k.p, frames |-> <<>>]
            ELSE SettleP(k.p, gr.g, gr.frames, gr.pending, lw, paused)
      sw == IF k.sp.ended THEN [sp |-> k.sp, frames |-> <<>>] ELSE SpecWave(k.sp, fs, lw, paused)
  IN k' = [k EXCEPT !.s = sr.s, !.locks = nl, !.g = gr.g, !.p = pr.p, !.sp = sw.sp,
                    !.pOut = pr.frames, !.spOut = sw.frames, !.waves = @ + 1]

Next ==
  /\ k.waves < MaxWaves
  /\ \E sa \in (IF k.s.ended THEN {<<>>} ELSE SArrays \cup {<<>>}), nl \in SUBSET Locks :
       (sa # <<>> \/ nl # k.locks) /\ Wave(sa, nl)

Spec == Init /\ [][Next]_vars

\* ---- invariants ----
Refines == Norm(k.pOut) = Norm(k.spOut)
HeldMatches == k.g.ended \/ k.g.state = k.sp.held
NoValueWhilePaused == k.locks # {} => ~HasData(k.pOut)
EndsWithInput == k.p.ended <=> k.s.ended
=============================================================================
