-------------------------- MODULE wave_reentrancy --------------------------
(***************************************************************************
GraphReFly — synchronous feedback-cycle rejection
(conformance C-6, rule R-reentrancy, decision D37 / backlog B10).

Pins R-reentrancy: a node fn that, during its invocation, transitively
re-drives one of its own deps so the SAME compute node's fn would re-enter
before its wave completes is a wave-level protocol ERROR — detected
node-locally via the in-wave flag (_insideRunWave), REJECTED (never queued,
never bounded-then-run). The core neither iterates (option A) nor silently
desyncs the pending counter.

Why a dedicated module (not wave_protocol.tla): the core model is a
message-queue / DAG interleaving whose BalancedWaves / DiamondConvergence
invariants ASSUME an acyclic topology. Re-entrancy is a SYNCHRONOUS
call-stack phenomenon; TLA+ has no call stack, so we model the stack
EXPLICITLY (`stack`) — the faithful mapping of nested _runWave frames.

Topology (C-6 isomorphic), single graph, single thread:
    state S -> derived D (=n+1) -> effect E.  When HasFeedback, E's fn writes
    back to S (s.set), closing the cycle S->D->E->S. Kicked at KickNode.

  HasFeedback=TRUE,  KickNode="E"  -> E runs, drives S->D->E, re-enters E while
                                     inWave[E] is still set -> REJECT at E.
  HasFeedback=FALSE, KickNode="S"  -> forward chain S->D->E quiesces, no reject
                                     (proves the guard does NOT false-positive
                                     on an acyclic graph — scan-style
                                     accumulation via ctx.state is acyclic).

Compute nodes {D, E} carry the in-wave flag (mirror of _insideRunWave); the
state source S relays without a flag (state nodes have no fn / no re-entry
guard — a cycle is only self-sustaining through a compute fn, so the reject
always lands on a compute node).

Load-bearing: remove RunReject (and let RunEnter fire on an inWave compute
node) and the runaway pushes E twice -> NoReentrantCompute fails (the desync
the rule prevents). With the reject, depth never exceeds the topology.

Status: draft (flips active with the CSP-1 reject impl + C-6 green).
 ***************************************************************************)
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS HasFeedback,   \* BOOLEAN — does E feed back into S (cyclic) or not?
          KickNode,      \* the node whose fn is the outermost run (the kick)
          MaxDepth       \* call-stack bound (runaway cap if the reject is removed)

NONE    == "NONE"
Nodes   == {"S", "D", "E"}
Compute == {"D", "E"}     \* carry _insideRunWave; S is a stateless relay source

Downstream(n) ==
    CASE n = "S" -> "D"
      [] n = "D" -> "E"
      [] n = "E" -> IF HasFeedback THEN "S" ELSE NONE
      [] OTHER   -> NONE

VARIABLES
    stack,      \* Seq(Nodes) — synchronous call stack (nested _runWave frames)
    inWave,     \* [Compute -> BOOLEAN] — mirror of _insideRunWave
    next,       \* Nodes \cup {NONE} — node to (try to) run next; NONE = top returns
    errored,    \* BOOLEAN — a re-entry was detected and rejected (the throw)
    cycleNode,  \* Nodes \cup {NONE} — the cycle-closing node the reject fired at
    started,    \* BOOLEAN — the kick has fired
    done        \* BOOLEAN — wave fully resolved (quiesced, or rejected + unwound)

vars == <<stack, inWave, next, errored, cycleNode, started, done>>

Range(s)      == { s[i] : i \in 1..Len(s) }
CountIn(s, x) == Cardinality({ i \in 1..Len(s) : s[i] = x })

TypeOK ==
  /\ stack \in Seq(Nodes)
  /\ inWave \in [Compute -> BOOLEAN]
  /\ next \in Nodes \cup {NONE}
  /\ errored \in BOOLEAN
  /\ cycleNode \in Nodes \cup {NONE}
  /\ started \in BOOLEAN
  /\ done \in BOOLEAN

Init ==
  /\ stack = << >>
  /\ inWave = [n \in Compute |-> FALSE]
  /\ next = NONE
  /\ errored = FALSE
  /\ cycleNode = NONE
  /\ started = FALSE
  /\ done = FALSE

\* The kick: the outermost fn begins (nothing on the stack yet).
Kick ==
  /\ ~started
  /\ ~done
  /\ started' = TRUE
  /\ next' = KickNode
  /\ UNCHANGED <<stack, inWave, errored, cycleNode, done>>

\* Re-entering a compute node that is already mid-wave (inWave) IS a synchronous
\* feedback cycle -> REJECT (the throw, caught by the graph layer -> ERROR).
RunReject ==
  /\ next \in Compute
  /\ inWave[next]
  /\ ~errored
  /\ errored'   = TRUE
  /\ cycleNode' = next
  /\ next'      = NONE
  /\ UNCHANGED <<stack, inWave, started, done>>

\* Enter a node's fn run (push the frame). Compute nodes raise their in-wave flag.
RunEnter ==
  /\ next \in Nodes
  /\ ~errored
  /\ ~(next \in Compute /\ inWave[next])      \* not a re-entry (else RunReject)
  /\ Len(stack) < MaxDepth                     \* runaway cap (if the reject is removed)
  /\ stack' = Append(stack, next)
  /\ inWave' = IF next \in Compute THEN [inWave EXCEPT ![next] = TRUE] ELSE inWave
  /\ next'   = Downstream(next)
  /\ UNCHANGED <<errored, cycleNode, started, done>>

\* The top frame returns (pops). Normal path: next=NONE = deepest fn done.
\* Rejected path: the throw unwinds every frame.
Pop ==
  /\ next = NONE
  /\ started
  /\ Len(stack) > 0
  /\ LET top == stack[Len(stack)] IN
       /\ stack' = SubSeq(stack, 1, Len(stack) - 1)
       /\ inWave' = IF top \in Compute THEN [inWave EXCEPT ![top] = FALSE] ELSE inWave
  /\ UNCHANGED <<next, errored, cycleNode, started, done>>

Finish ==
  /\ started
  /\ next = NONE
  /\ Len(stack) = 0
  /\ ~done
  /\ done' = TRUE
  /\ UNCHANGED <<stack, inWave, next, errored, cycleNode, started>>

Next ==
  \/ Kick
  \/ RunReject
  \/ RunEnter
  \/ Pop
  \/ Finish

Spec == Init /\ [][Next]_vars

----------------------------------------------------------------------------
(*                             INVARIANTS                                 *)

\* CORE (load-bearing): a compute node never runs while already running — no
\* silent re-entrant execution (the _pending desync the reject prevents).
\* Remove RunReject (+ the RunEnter re-entry guard) and a compute node is pushed
\* twice -> this fails.
NoReentrantCompute == \A n \in Compute : CountIn(stack, n) <= 1

\* The in-wave flag mirrors stack membership for compute nodes.
InWaveConsistent == \A n \in Compute : inWave[n] <=> (n \in Range(stack))

\* The stack never runs away (with the reject, depth is bounded by the topology).
StackBounded == Len(stack) <= MaxDepth

\* A detected cycle is rejected deterministically AT a compute node (located),
\* never left to hang or loop. (Cyclic config.)
CycleRejectedAtCompute == (HasFeedback /\ done) => (errored /\ cycleNode \in Compute)

\* The guard does NOT false-positive: an acyclic graph quiesces with no ERROR
\* (scan-style ctx.state accumulation is acyclic — no topological re-entry).
AcyclicNeverErrors == (~HasFeedback /\ done) => ~errored
=============================================================================
