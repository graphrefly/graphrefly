-------------------------- MODULE kernel_seed_cycle --------------------------
(***************************************************************************
GraphReFly kernel — the cycle check of a replace and a rewire, over the three
lists a node can hold: its declared dependencies, those of its current
lifetime, and those a seed gives its first lifetime.

A focused model for graphrefly:D822 (R-request-order@6), written 2026-11-23,
and the same day for graphrefly:D826 (R-request-order@7), which adds a node's
creation. It checks one thing and nothing else of the rule: a replace, a
rewire or a creation is refused for a dependency that depends on the node
through any of the three lists, so that no node ever depends on itself,
whatever is created, activated, deactivated, captured or restored afterwards.

Computed nodes only; a dependency on a state closes no cycle and is left
out, so an empty list stands for a node over states.

Steps. Create(n, deps, hasSeed, sd): a node that does not exist yet is made
over deps, which exist, with or without a seed; a seed's list sd may name
any node, made or not, n itself included, and the creation is refused when a
dependency of either list is n or depends on n, which only a seed that named
n before it existed can bring about. Rewire(n, deps): an active node changes
its current list. Replace(n, deps): a new instance, with deps as its declared
and current list and no seed. Deactivate(n): the lifetime closes and the current list goes back to
the declared one. CaptureRestore: every node is inactive again; a node whose
lifetime's list differed from its declared one holds that list as a seed, and
a node that already held a seed keeps it. Activate(n): an inactive node's
first activation starts on its seed's list, which the seed then no longer
holds; a seed that names a node not made yet cannot start.

The check reads CheckEdges and the invariants read AllEdges and the current
lists; the two are written separately so that a check that reads less is
caught.

Invariants:
  Acyclic      no node depends on itself through any of its three lists
  RunsAcyclic  no node depends on itself through the lists nodes run on
 ***************************************************************************)
EXTENDS Integers, FiniteSets

CONSTANT Nodes

VARIABLES exists,     \* per node, whether it has been made
          declared,   \* per node, its declared dependencies
          current,    \* per node, the dependencies it is on: the declared ones when inactive
          seeded,     \* per node, whether it holds a seed with a first lifetime's dependencies
          seed,       \* per node, those dependencies ({} when not seeded)
          active
vars == <<exists, declared, current, seeded, seed, active>>

Made == {m \in Nodes : exists[m]}
Lists(n) == SUBSET (Made \ {n})

\* What the kernel's check follows from a node. A seed's name of a node not made yet counts, and
\* there is nothing to follow from that node until it is made.
CheckEdges(n) == current[n] \cup declared[n] \cup (IF seeded[n] THEN seed[n] ELSE {})

RECURSIVE CheckReaches(_, _, _)
CheckReaches(n, t, k) == k > 0 /\ \E d \in CheckEdges(n) : d = t \/ CheckReaches(d, t, k - 1)

\* A request to put n on deps is refused when a dependency is n or depends on n.
Allowed(n, deps) == \A d \in deps : d # n /\ ~CheckReaches(d, n, Cardinality(Nodes))

Create(n, deps, hasSeed, sd) ==
  /\ ~exists[n] /\ deps \subseteq Made
  /\ (~hasSeed => sd = {})
  /\ Allowed(n, deps \cup sd)
  /\ exists' = [exists EXCEPT ![n] = TRUE]
  /\ declared' = [declared EXCEPT ![n] = deps]
  /\ current' = [current EXCEPT ![n] = deps]
  /\ seeded' = [seeded EXCEPT ![n] = hasSeed]
  /\ seed' = [seed EXCEPT ![n] = sd]
  /\ UNCHANGED active

Rewire(n, deps) ==
  /\ active[n] /\ Allowed(n, deps)
  /\ current' = [current EXCEPT ![n] = deps]
  /\ UNCHANGED <<exists, declared, seeded, seed, active>>

Replace(n, deps) ==
  /\ exists[n] /\ Allowed(n, deps)
  /\ declared' = [declared EXCEPT ![n] = deps]
  /\ current' = [current EXCEPT ![n] = deps]
  /\ seeded' = [seeded EXCEPT ![n] = FALSE]
  /\ seed' = [seed EXCEPT ![n] = {}]
  /\ UNCHANGED <<exists, active>>

Activate(n) ==
  /\ exists[n] /\ ~active[n]
  /\ seeded[n] => seed[n] \subseteq Made
  /\ active' = [active EXCEPT ![n] = TRUE]
  /\ current' = [current EXCEPT ![n] = IF seeded[n] THEN seed[n] ELSE @]
  /\ seeded' = [seeded EXCEPT ![n] = FALSE]
  /\ seed' = [seed EXCEPT ![n] = {}]
  /\ UNCHANGED <<exists, declared>>

Deactivate(n) ==
  /\ active[n]
  /\ active' = [active EXCEPT ![n] = FALSE]
  /\ current' = [current EXCEPT ![n] = declared[n]]
  /\ UNCHANGED <<exists, declared, seeded, seed>>

CaptureRestore ==
  /\ active' = [n \in Nodes |-> FALSE]
  /\ seeded' = [n \in Nodes |-> seeded[n] \/ (active[n] /\ current[n] # declared[n])]
  /\ seed' = [n \in Nodes |-> IF active[n] /\ current[n] # declared[n] THEN current[n] ELSE seed[n]]
  /\ current' = declared
  /\ UNCHANGED <<exists, declared>>

Init ==
  /\ exists = [n \in Nodes |-> FALSE]
  /\ declared = [n \in Nodes |-> {}] /\ current = [n \in Nodes |-> {}]
  /\ seeded = [n \in Nodes |-> FALSE] /\ seed = [n \in Nodes |-> {}]
  /\ active = [n \in Nodes |-> FALSE]

Next ==
  \/ \E n \in Nodes : \E deps \in SUBSET Nodes : \E hasSeed \in BOOLEAN : \E sd \in SUBSET Nodes :
       Create(n, deps, hasSeed, sd)
  \/ \E n \in Nodes : \E deps \in Lists(n) : Rewire(n, deps) \/ Replace(n, deps)
  \/ \E n \in Nodes : Activate(n) \/ Deactivate(n)
  \/ CaptureRestore

Spec == Init /\ [][Next]_vars

\* What the invariants follow, written apart from the check.
AllEdges(n) == declared[n] \cup current[n] \cup (IF seeded[n] THEN seed[n] ELSE {})

RECURSIVE Through(_, _, _, _)
Through(edges, n, t, k) == k > 0 /\ \E d \in edges[n] : d = t \/ Through(edges, d, t, k - 1)

Acyclic == \A n \in Nodes : ~Through([m \in Nodes |-> AllEdges(m)], n, n, Cardinality(Nodes))
RunsAcyclic == \A n \in Nodes : ~Through(current, n, n, Cardinality(Nodes))
=============================================================================
