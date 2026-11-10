--------------------------- MODULE kernel_wave ---------------------------
(***************************************************************************
GraphReFly D797 kernel — waves, settlement, terminals and invalidation.

A candidate model for the D797 draft rules R-wave, R-messages, R-invalidation,
R-terminals, R-subscription (retained values) and R-failure (a rejected output
array becomes the node's ERROR). Written 2026-11-09 for graphrefly:B140; the
older wave_protocol models verify the currently active rules and are retired or
rescoped at activation. Status: draft, like the rules it checks.

Topology: a state S and a diamond S -> B, S -> C, B,C -> D. B and C have the
default auto COMPLETE and auto ERROR policy; D's two policies are chosen at Init,
so every combination of auto and manual is checked (added 2026-11-09 for the
activation plan, taking over wave_deps_complete and wave_protocol_rescue_MC). Each wave starts from one host input
to S. A computed node that runs chooses its output from a menu that includes
invalid arrays (PENDING in node output, DATA with RESOLVED, a terminal not
last); the kernel rejects them, which ends the node with ERROR. Nodes settle in
any order the dependencies allow, so every interleaving is checked, not only
the reference kernel's depth-first one.

The step semantics follow reference/kernel/kernel.mjs: a wave marks the cone of
a source that sends a value or a terminal pending first; a node settles once every dependency
that marked it has settled, on all the arrays it received; an auto ERROR ends it
without running its function; an INVALIDATE on an input invalidates the node
without running its function for it; the kernel adds one RESOLVED to a pending
node that sent nothing settling, and prefixes PENDING to each array carrying
DATA or RESOLVED; an ended node releases its dependencies.

Invariants, each mutation-checked (see formal/README.md):
  RunOnce               a node's function runs at most once per wave (R-wave)
  SettleOnce            a pending mark is settled at most once (R-wave)
  FanInAfterSettle      a node never settles while a dependency is pending
  NoWedge               a wave ends with nothing pending and nothing unread
  PendingPrefix         PENDING is exactly the first message of each array
                        carrying DATA, RESOLVED or a terminal (R-wave, R-messages)
  InvalidateAlone       INVALIDATE travels as an array of its own (R-wave)
  NoDataWithResolved    DATA and RESOLVED never share an array (R-wave)
  TerminalLastAndFinal  a terminal is last and nothing follows it (R-terminals)
  InvalidateEffective   INVALIDATE is sent only by a node that held a value
                        (R-invalidation)
  RetainedMatchesSent   a node's retained values are the DATA of its last array
                        with DATA, absent after a later INVALIDATE
                        (R-subscription)
  AutoErrorNoRun        an auto ERROR ends a node without running it
                        (R-terminals)
  AutoTerminals         between waves, a node all of whose dependencies have
                        ended has ended under auto COMPLETE, and one with an
                        errored dependency has ended under auto ERROR; an
                        errored dependency counts as ended (R-terminals)
  ManualEndsByFunction  under a manual policy D ends with that kind only by its
                        function's output, or with ERROR by a rejected output
                        (R-terminals, R-failure)
  ManualSeesTerminal    under a manual policy D's function runs in every wave in
                        which a dependency's terminal of that kind reaches it
                        while D is open, unless an auto ERROR ends D first
                        (R-terminals)

Out of scope here: lifetimes, request order, batch and topology requests
(R-lifetime, R-request-order), quiet nodes and async output.
Message encoding: "D1","D2" are DATA 1 and 2, "RES" RESOLVED, "INV" INVALIDATE,
"COM" COMPLETE, "ERR" ERROR, "PEN" PENDING.
 ***************************************************************************)
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS MaxWaves

Nodes    == {"S", "B", "C", "D"}
Computed == {"B", "C", "D"}
Deps == [n \in Nodes |->
          CASE n = "S" -> {}
            [] n = "B" -> {"S"}
            [] n = "C" -> {"S"}
            [] n = "D" -> {"B", "C"}]

\* What a running node may send. Each element is a sequence of ctx.down arrays.
Menu(n) ==
  CASE n = "B" -> { <<>>,
                    << <<"D1">> >>,
                    << <<"D1">>, <<"D2">> >>,
                    << <<"D1", "INV", "D2">> >>,
                    << <<"INV">> >>,
                    << <<"D2", "COM">> >>,
                    << <<"ERR">> >>,
                    << <<"PEN", "D1">> >>,
                    << <<"D1", "RES">> >>,
                    << <<"COM", "D1">> >>,
                    << <<"COM">>, <<"D1">> >> }
    [] n = "C" -> { <<>>, << <<"D2">> >>, << <<"ERR">> >> }
    [] n = "D" -> { <<>>, << <<"D1">> >>, << <<"D1", "D2">> >>, << <<"INV">> >>,
                    << <<"D2", "COM">> >>, << <<"ERR">> >> }


\* Host inputs to S: set 1, set 2, a batch of two sets (one array), invalidate,
\* complete, error.
HostInputs == { << <<"D1">> >>, << <<"D2">> >>, << <<"D1", "D2">> >>,
                << <<"INV">> >>, << <<"COM">> >>, << <<"ERR">> >> }

VARIABLE k
vars == <<k>>

\* Terminal policies (R-terminals): B and C auto, D as chosen at Init.
Policies == [complete : {"auto", "manual"}, error : {"auto", "manual"}]
Auto == [complete |-> "auto", error |-> "auto"]
PolS(s, n) == IF n = "D" THEN s.pol ELSE Auto
Kind(t) == IF t = "COM" THEN "complete" ELSE "error"

\* ---- message helpers ----
IsData(x)   == x \in {"D1", "D2"}
IsValue(x)  == IsData(x) \/ x = "RES"
IsTerm(x)   == x \in {"COM", "ERR"}
IsTermX(x)  == x \in {"COM", "ERR"}
ManualTerm(s, n, x) == IsTermX(x) /\ PolS(s, n)[Kind(x)] = "manual"
Settles(x)  == IsValue(x) \/ IsTerm(x) \/ x = "INV"
Range(s)    == {s[i] : i \in DOMAIN s}
Max(S)      == CHOOSE x \in S : \A y \in S : y <= x
HasValueArr(a) == \E i \in DOMAIN a : IsValue(a[i])
HasValueAny(fs) == \E i \in DOMAIN fs : HasValueArr(fs[i])
\* An array that marks the sender's cone pending and gets PENDING: one carrying DATA,
\* RESOLVED or a terminal (R-wave, decided by the user 2026-11-09).
HasMarkArr(a) == \E i \in DOMAIN a : IsValue(a[i]) \/ IsTerm(a[i])
HasMarkAny(fs) == \E i \in DOMAIN fs : HasMarkArr(fs[i])
AnySettles(fs)  == \E i \in DOMAIN fs : \E j \in DOMAIN fs[i] : Settles(fs[i][j])
HasTerminal(fs) == \E i \in DOMAIN fs : \E j \in DOMAIN fs[i] : IsTerm(fs[i][j])
DataVals(a) == LET d == SelectSeq(a, IsData)
               IN [i \in 1..Len(d) |-> IF d[i] = "D1" THEN 1 ELSE 2]
LastInv(a)  == LET I == {i \in DOMAIN a : a[i] = "INV"} IN IF I = {} THEN 0 ELSE Max(I)

\* ---- one submitted array: checked, then split at its last INVALIDATE ----
ValidArr(a) ==
  /\ "PEN" \notin Range(a)
  /\ \A i \in DOMAIN a : IsTerm(a[i]) => i = Len(a)
  /\ LET c == LastInv(a)
     IN ~((\E i \in (c + 1)..Len(a) : IsData(a[i])) /\ (\E i \in (c + 1)..Len(a) : a[i] = "RES"))
ValidOut(raw) == \A i \in DOMAIN raw : ValidArr(raw[i])

Prepare(a) ==
  LET c == LastInv(a)
  IN (IF c > 0 THEN << <<"INV">> >> ELSE <<>>)
     \o (IF c < Len(a) THEN << SubSeq(a, c + 1, Len(a)) >> ELSE <<>>)
RECURSIVE PrepAll(_)
PrepAll(raw) == IF raw = <<>> THEN <<>> ELSE Prepare(Head(raw)) \o PrepAll(Tail(raw))

\* ---- apply: what the node holds; an ineffective INVALIDATE is dropped ----
ApplyFrame(st, f) ==
  IF st.ended # "no" THEN st
  ELSE IF f = <<"INV">>
       THEN IF st.has THEN [st EXCEPT !.has = FALSE, !.vals = <<>>, !.out = @ \o <<f>>] ELSE st
       ELSE LET dv == DataVals(f)
                t  == IF IsTerm(f[Len(f)]) THEN f[Len(f)] ELSE "no"
            IN [st EXCEPT !.has   = @ \/ dv # <<>>,
                          !.vals  = IF dv # <<>> THEN dv ELSE @,
                          !.ended = IF t # "no" THEN t ELSE @,
                          !.out   = @ \o <<f>>]
RECURSIVE ApplyAll(_, _)
ApplyAll(st, fs) == IF fs = <<>> THEN st ELSE ApplyAll(ApplyFrame(st, Head(fs)), Tail(fs))

\* ---- marking a cone pending ----
RECURSIVE MarkPending(_, _), MarkSet(_, _, _)
MarkPending(s, n) ==
  MarkSet(s, n, {m \in Nodes : n \in Deps[m] /\ s.ended[m] = "no"})
MarkSet(s, n, ms) ==
  IF ms = {} THEN s
  ELSE LET m  == CHOOSE x \in ms : TRUE
           s1 == [s EXCEPT !.pendDeps[m] = @ \cup {n}]
           s2 == IF ~s.pend[m] THEN MarkPending([s1 EXCEPT !.pend[m] = TRUE], m) ELSE s1
       IN MarkSet(s2, n, ms \ {m})

\* ---- deliver arrays already applied to n ----
Deliver(s, n, fr) ==
  LET f1 == IF s.pend[n] /\ ~AnySettles(fr) THEN fr \o << <<"RES">> >> ELSE fr
  IN IF f1 = <<>> THEN s
     ELSE
       LET s1   == IF HasMarkAny(f1) /\ ~s.pend[n]
                   THEN MarkPending([s EXCEPT !.pend[n] = TRUE], n) ELSE s
           out  == [i \in DOMAIN f1 |-> IF HasMarkArr(f1[i]) THEN <<"PEN">> \o f1[i] ELSE f1[i]]
           subs == {m \in Nodes : n \in Deps[m] /\ s1.ended[m] = "no"}
       IN [s1 EXCEPT
             !.pend[n]    = FALSE,
             !.settles[n] = @ + (IF s1.pend[n] THEN 1 ELSE 0),
             !.hist[n]    = @ \o out,
             !.inbox    = [m \in Nodes |-> IF m \in subs
                                           THEN [s1.inbox[m] EXCEPT ![n] = @ \o f1]
                                           ELSE s1.inbox[m]],
             !.pendDeps = [m \in Nodes |-> IF m \in subs /\ AnySettles(f1)
                                           THEN s1.pendDeps[m] \ {n} ELSE s1.pendDeps[m]],
             !.depEnded = [m \in Nodes |-> IF m \in subs /\ HasTerminal(f1)
                                           THEN s1.depEnded[m] \cup {n} ELSE s1.depEnded[m]],
             !.dTermIn  = @ \/ ("D" \in subs /\ \E i \in DOMAIN f1 : \E j \in DOMAIN f1[i] : ManualTerm(s1, "D", f1[i][j]))]

\* ---- a node's output: checked (a rejection is its ERROR), applied, delivered ----
Emit(s, n, raw) ==
  LET fs == IF ValidOut(raw) THEN PrepAll(raw) ELSE << <<"ERR">> >>
      st == ApplyAll([has |-> s.has[n], vals |-> s.vals[n], ended |-> s.ended[n], out |-> <<>>], fs)
  IN Deliver([s EXCEPT !.has[n] = st.has, !.vals[n] = st.vals, !.ended[n] = st.ended], n, st.out)

\* ---- state ----
Init == \E p \in Policies :
  k = [ phase    |-> "idle",
        waves    |-> 0,
        has      |-> [n \in Nodes |-> TRUE],
        vals     |-> [n \in Nodes |-> <<1>>],
        ended    |-> [n \in Nodes |-> "no"],
        pend     |-> [n \in Nodes |-> FALSE],
        pendDeps |-> [n \in Nodes |-> {}],
        inbox    |-> [n \in Nodes |-> [d \in Deps[n] |-> <<>>]],
        depEnded |-> [n \in Nodes |-> {}],
        runs     |-> [n \in Nodes |-> 0],
        settles  |-> [n \in Nodes |-> 0],
        hist     |-> [n \in Nodes |-> <<>>],
        early    |-> FALSE,
        errRan   |-> FALSE,
        pol      |-> p,
        dEnd     |-> "none",      \* how D ended: "fn", "rejected" or "kernel"
        dTermIn  |-> FALSE,       \* this wave a terminal of a manual kind reached open D
        missed   |-> FALSE ]

\* A host input to S starts a wave; an input to an ended S is refused (no wave).
HostInput ==
  /\ k.phase = "idle"
  /\ k.waves < MaxWaves
  /\ k.ended["S"] = "no"
  /\ \E h \in HostInputs :
       k' = Emit([k EXCEPT !.phase = "wave", !.waves = @ + 1], "S", h)

\* No "m has not ended" clause: an ended node has released its dependencies, so nothing
\* reaches its inbox (mutation-checked: adding the clause changes nothing).
Ready(m) ==
  /\ k.pendDeps[m] = {}
  /\ \E d \in Deps[m] : k.inbox[m][d] # <<>>

AfterLastInv(fs) ==
  LET I == {i \in DOMAIN fs : fs[i] = <<"INV">>}
  IN IF I = {} THEN fs ELSE SubSeq(fs, Max(I) + 1, Len(fs))

\* Settle m on everything it received this wave.
Finish(s, m, lead, runs, raw) ==
  LET fs  == IF ~runs THEN <<>> ELSE IF ValidOut(raw) THEN PrepAll(raw) ELSE << <<"ERR">> >>
      st0 == [has |-> s.has[m], vals |-> s.vals[m], ended |-> s.ended[m], out |-> <<>>]
      st1 == IF lead THEN ApplyFrame(st0, <<"INV">>) ELSE st0
      st0f == ApplyAll(st1, fs)
      \* Auto COMPLETE: the postlude goes out in the same delivery as the run's output.
      post == s.depEnded[m] = Deps[m] /\ ~HasTerminal(fs) /\ PolS(s, m).complete = "auto"
      st  == IF post THEN ApplyFrame(st0f, <<"COM">>) ELSE st0f
      s1  == [s EXCEPT !.inbox[m] = [d \in Deps[m] |-> <<>>],
                       !.runs[m]  = @ + (IF runs THEN 1 ELSE 0),
                       !.has[m]   = st.has, !.vals[m] = st.vals, !.ended[m] = st.ended]
      how  == IF post /\ st0f.ended = "no" THEN "kernel" ELSE IF ~ValidOut(raw) THEN "rejected" ELSE "fn"
      s1a == IF m = "D" /\ s.ended[m] = "no" /\ st.ended # "no" THEN [s1 EXCEPT !.dEnd = how] ELSE s1
  IN Deliver(s1a, m, st.out)

Settle(m) ==
  /\ k.phase = "wave"
  /\ Ready(m)
  /\ LET early  == \E d \in Deps[m] : k.pend[d]
         k0     == [k EXCEPT !.early = @ \/ early]
         depErr == \E d \in Deps[m] : \E i \in DOMAIN k.inbox[m][d] : "ERR" \in Range(k.inbox[m][d][i])
     IN IF depErr /\ PolS(k, m).error = "auto"   \* auto ERROR: end with it, without running the function
        THEN k' = Emit([k0 EXCEPT !.inbox[m] = [d \in Deps[m] |-> <<>>],
                                  !.dEnd = IF m = "D" THEN "kernel" ELSE @], m, << <<"ERR">> >>)
        ELSE
          LET trimmed == [d \in Deps[m] |-> AfterLastInv(k.inbox[m][d])]
              lead    == \E d \in Deps[m] : trimmed[d] # k.inbox[m][d]
              runs    == \E d \in Deps[m] : \E i \in DOMAIN trimmed[d] :
                           \E j \in DOMAIN trimmed[d][i] :
                             IsValue(trimmed[d][i][j]) \/ ManualTerm(k, m, trimmed[d][i][j])
              k1      == [k0 EXCEPT !.errRan = @ \/ (depErr /\ runs /\ PolS(k, m).error = "auto")]
          IN IF runs
             THEN \E raw \in Menu(m) : k' = Finish(k1, m, lead, TRUE, raw)
             ELSE k' = Finish(k1, m, lead, FALSE, <<>>)

EndWave ==
  /\ k.phase = "wave"
  /\ ~\E m \in Computed : Ready(m)
  /\ k' = [k EXCEPT !.phase = "idle", !.runs = [n \in Nodes |-> 0], !.settles = [n \in Nodes |-> 0],
             !.missed = @ \/ (k.dTermIn /\ k.runs["D"] = 0 /\ k.dEnd # "kernel"), !.dTermIn = FALSE]

Next == HostInput \/ (\E m \in Computed : Settle(m)) \/ EndWave
Spec == Init /\ [][Next]_vars

\* ---- invariants ----
RunOnce          == \A n \in Nodes : k.runs[n] <= 1
SettleOnce       == \A n \in Nodes : k.settles[n] <= 1
FanInAfterSettle == ~k.early
AutoErrorNoRun   == ~k.errRan

NoWedge ==
  k.phase = "idle" =>
    \A n \in Nodes : ~k.pend[n] /\ k.pendDeps[n] = {} /\ \A d \in Deps[n] : k.inbox[n][d] = <<>>

Sent(n) == k.hist[n]

PendingPrefix ==
  \A n \in Nodes : \A i \in DOMAIN Sent(n) :
    LET a == Sent(n)[i]
    IN /\ a # <<>>
       /\ (a[1] = "PEN") <=> HasMarkArr(a)
       /\ \A j \in DOMAIN a : j > 1 => a[j] # "PEN"

InvalidateAlone ==
  \A n \in Nodes : \A i \in DOMAIN Sent(n) : "INV" \in Range(Sent(n)[i]) => Sent(n)[i] = <<"INV">>

NoDataWithResolved ==
  \A n \in Nodes : \A i \in DOMAIN Sent(n) :
    ~((\E j \in DOMAIN Sent(n)[i] : IsData(Sent(n)[i][j])) /\ "RES" \in Range(Sent(n)[i]))

TerminalLastAndFinal ==
  \A n \in Nodes : \A i \in DOMAIN Sent(n) : \A j \in DOMAIN Sent(n)[i] :
    IsTerm(Sent(n)[i][j]) => (j = Len(Sent(n)[i]) /\ i = Len(Sent(n)))

\* The last array before i that changed what n holds (DATA or INVALIDATE); 0 if none.
LastChange(n, i) ==
  LET I == {j \in 1..(i - 1) : Sent(n)[j] = <<"INV">> \/ DataVals(Sent(n)[j]) # <<>>}
  IN IF I = {} THEN 0 ELSE Max(I)

InvalidateEffective ==
  \A n \in Nodes : \A i \in DOMAIN Sent(n) :
    Sent(n)[i] = <<"INV">> =>
      LET j == LastChange(n, i) IN j = 0 \/ Sent(n)[j] # <<"INV">>

RetainedMatchesSent ==
  \A n \in Nodes :
    LET j == LastChange(n, Len(Sent(n)) + 1)
    IN IF j = 0 THEN k.has[n] /\ k.vals[n] = <<1>>
       ELSE IF Sent(n)[j] = <<"INV">> THEN ~k.has[n]
       ELSE k.has[n] /\ k.vals[n] = DataVals(Sent(n)[j])

AutoTerminals ==
  k.phase = "idle" =>
    \A m \in Computed :
      /\ ((\A d \in Deps[m] : k.ended[d] # "no") /\ PolS(k, m).complete = "auto") => k.ended[m] # "no"
      /\ ((\E d \in Deps[m] : k.ended[d] = "ERR") /\ PolS(k, m).error = "auto") => k.ended[m] # "no"

ManualEndsByFunction ==
  /\ (k.ended["D"] = "COM" /\ k.pol.complete = "manual") => k.dEnd = "fn"
  /\ (k.ended["D"] = "ERR" /\ k.pol.error = "manual") => k.dEnd \in {"fn", "rejected"}

ManualSeesTerminal == ~k.missed
=============================================================================
