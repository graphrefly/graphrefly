--------------------- MODULE wave_deps_complete ---------------------
(***************************************************************************
GraphReFly — completeWhenDepsComplete: a node auto-COMPLETEs once ALL deps are
TERMINAL (COMPLETE *or* an ABSORBED ERROR — errorWhenDepsError:false), NOT only
when all deps COMPLETE (conformance C-17). Pins R-deps-terminal (B42).

The bug B42 fixes: the prior "all deps Complete" logic (TS _allDepsComplete
`tm != true`, Rust all_deps_complete) treated an absorbed-error dep (terminal,
but ERROR not COMPLETE) as NOT-done, so a node whose errorWhenDepsError:false dep
ERRORed never auto-completed even after every OTHER dep completed — a wedge.

The modeled node has completeWhenDepsComplete = TRUE and ABSORBS errors
(errorWhenDepsError:false), so a dep can terminate as "complete" OR "errored";
both are terminal. The auto-complete fires (nodeComplete := TRUE) atomically with
the LAST dep reaching a terminal state, in EITHER terminal arm — so the order /
which-terminal-lands-last is irrelevant (C-17 cases (a) error-then-complete and
(b) complete-then-error give the same result). This mirrors the impl's two-part
fix: _allDepsComplete counts terminal deps, AND both the COMPLETE and the
absorbed-ERROR receive-arms apply the auto-complete check.

  AllDepsTerminalCompletes — once every dep is terminal, nodeComplete holds.
                             The B42 rule. Mutation: count only "complete"
                             (exclude "errored") in WouldComplete -> a state with
                             an errored dep + all others complete has
                             AllDepsTerminal but ~nodeComplete -> trips.

SCOPE: a dep TERMINAL = COMPLETE | ERROR; TEARDOWN (a destroy-cascade) is out of
scope (B33). The orthogonal DIRTY-release on a terminal is C-15
(wave_terminal_dirty.tla); this module pins only the auto-COMPLETE cascade.

Status: draft (flips active with the C-17 TS + Rust arms green).
Config: wave_deps_complete.cfg.
 ***************************************************************************)
EXTENDS Integers, FiniteSets, TLC

CONSTANTS Deps, MaxSteps

VARIABLES
  depState,      \* [Deps -> {"live","complete","errored"}]
  nodeComplete,  \* BOOLEAN — D has auto-emitted COMPLETE (completeWhenDepsComplete)
  steps

vars == <<depState, nodeComplete, steps>>

Terminal(d)     == depState[d] \in {"complete","errored"}
AllDepsTerminal == \A d \in Deps : Terminal(d)

\* The auto-complete predicate evaluated on a candidate next dep-state: the node's
\* completeWhenDepsComplete (TRUE here) AND every dep terminal. B42: an absorbed
\* "errored" dep COUNTS as terminal. (Mutation point: require all "complete".)
WouldComplete(ds) == \A d \in Deps : ds[d] \in {"complete","errored"}

TypeOK ==
  /\ depState     \in [Deps -> {"live","complete","errored"}]
  /\ nodeComplete \in BOOLEAN
  /\ steps        \in 0..MaxSteps

Init ==
  /\ depState     = [d \in Deps |-> "live"]
  /\ nodeComplete = FALSE
  /\ steps        = 0

\* A live dep COMPLETEs. If this makes every dep terminal, the node auto-completes
\* (the COMPLETE receive-arm's completeWhenDepsComplete && _allDepsComplete check).
DepComplete(d) ==
  /\ steps < MaxSteps
  /\ depState[d] = "live"
  /\ LET ds == [depState EXCEPT ![d] = "complete"]
     IN /\ depState'     = ds
        /\ nodeComplete' = (nodeComplete \/ WouldComplete(ds))
  /\ steps' = steps + 1

\* A live dep ERRORs, ABSORBED by D (errorWhenDepsError:false). B42: an absorbed
\* error is terminal-done and COUNTS toward completion — if it makes every dep
\* terminal, the node auto-completes (the absorbed-ERROR arm MIRRORS the COMPLETE
\* arm's check — this is the receive-arm half of the two-part fix).
DepErrored(d) ==
  /\ steps < MaxSteps
  /\ depState[d] = "live"
  /\ LET ds == [depState EXCEPT ![d] = "errored"]
     IN /\ depState'     = ds
        /\ nodeComplete' = (nodeComplete \/ WouldComplete(ds))
  /\ steps' = steps + 1

Next ==
  \/ \E d \in Deps : DepComplete(d)
  \/ \E d \in Deps : DepErrored(d)

Spec == Init /\ [][Next]_vars

\* ── Invariant ──
\* B42: once every dep is terminal (complete OR absorbed-error), the node has
\* auto-completed. Holds because the LAST terminal transition sets nodeComplete
\* atomically, in EITHER arm (order-independent). The mutation (exclude "errored"
\* from WouldComplete) leaves a node with an errored dep stuck -> trips.
AllDepsTerminalCompletes == AllDepsTerminal => nodeComplete
=============================================================================
