--------------------- MODULE kernel_repeated_dependency ---------------------
(***************************************************************************
GraphReFly kernel — a dependency given more than once, across the exchange
of a node's dependency list.

A focused model for graphrefly:D821 (R-request-order@5), written 2026-11-23.
It checks one mechanism and nothing else of the rule: when a node's
dependency list is exchanged for another, each place of the new list has a
connection of its own, and the k-th place a dependency has in the new list
keeps the k-th connection held to it.

One node X over a list of dependencies, each a state that holds a value. A
connection is one subscription of X at a dependency, with the record of what
X last received on it. The model keeps both sides: conn is X's side, the
connection at each place; subs is each dependency's side, the connections it
delivers to.

Steps. Exchange(new): X's list becomes new, as the kernel does it: the
connections held to each dependency queue up in the order of their places,
the new list is walked from its first place, a place takes the head of its
dependency's queue or, when that is empty, a new connection that brings the
dependency's value; what is left in the queues is released. A rewire and a
replace share this exchange (a replace then gives every place a new record,
which this model does not tell apart, every record being current). Write(d):
d takes another value and delivers it to its connections.

kthOK is the model's own check of each exchange, stated by counting
occurrences and not by the queue.

Invariants:
  OnePerPlace     no connection serves two places
  BothSidesAgree  each dependency delivers to exactly the connections X
                  holds to it: none lost, none left behind
  RecordsCurrent  at every place X's record is its dependency's value
  KthKeepsKth     every exchange kept the k-th connection held to a
                  dependency at that dependency's k-th place, and gave the
                  places beyond them connections never held before
 ***************************************************************************)
EXTENDS Integers, Sequences, FiniteSets

CONSTANTS Deps, MaxLen, MaxExchanges

VARIABLES deps,       \* X's dependency list, a sequence over Deps
          conn,       \* the connection at each place
          subs,       \* per dependency, the connections it delivers to
          rec,        \* per connection, the value X last received on it
          val,        \* per dependency, its value
          next,       \* the next unused connection
          exchanges,
          kthOK
vars == <<deps, conn, subs, rec, val, next, exchanges, kthOK>>

Lists == UNION {[1..n -> Deps] : n \in 0..MaxLen}
Range(s) == {s[i] : i \in 1..Len(s)}
Places(l, d) == {j \in 1..Len(l) : l[j] = d}

\* How many of the first i places of l name d, and the place of d's k-th occurrence (0 for none).
Count(l, d, i) == Cardinality({j \in 1..i : l[j] = d})
PlaceOf(l, d, k) ==
  IF \E j \in Places(l, d) : Count(l, d, j) = k
  THEN CHOOSE j \in Places(l, d) : Count(l, d, j) = k
  ELSE 0

\* The connections held to d, in the order of their places, from place i on.
RECURSIVE Held(_, _)
Held(d, i) ==
  IF i > Len(deps) THEN << >>
  ELSE (IF deps[i] = d THEN <<conn[i]>> ELSE << >>) \o Held(d, i + 1)

\* The connections for places i.. of new: the head of the dependency's queue, or a new one.
RECURSIVE Walk(_, _, _, _)
Walk(new, i, queues, fresh) ==
  IF i > Len(new) THEN << >>
  ELSE LET d == new[i]
       IN IF queues[d] # << >>
          THEN <<Head(queues[d])>> \o Walk(new, i + 1, [queues EXCEPT ![d] = Tail(@)], fresh)
          ELSE <<fresh>> \o Walk(new, i + 1, queues, fresh + 1)

\* Stated by occurrence: the k-th place of d keeps the k-th connection held to d, and a place
\* beyond those gets a connection that was not held.
KthKept(old, oldc, new, c) ==
  \A d \in Deps : \A k \in 1..MaxLen :
    LET po == PlaceOf(old, d, k)
        pn == PlaceOf(new, d, k)
    IN /\ (po # 0 /\ pn # 0) => c[pn] = oldc[po]
       /\ (po = 0 /\ pn # 0) => c[pn] \notin Range(oldc)

Exchange(new) ==
  /\ exchanges < MaxExchanges /\ new # deps
  /\ exchanges' = exchanges + 1
  /\ LET queues == [d \in Deps |-> Held(d, 1)]
         c == Walk(new, 1, queues, next)
     IN /\ deps' = new /\ conn' = c
        /\ subs' = [d \in Deps |-> (subs[d] \ {x \in Range(queues[d]) : x \notin Range(c)})
                                     \cup {c[j] : j \in {p \in Places(new, d) : c[p] >= next}}]
        /\ rec' = [x \in Range(c) |-> IF x \in DOMAIN rec THEN rec[x]
                                      ELSE val[new[CHOOSE j \in 1..Len(c) : c[j] = x]]]
        /\ next' = next + Cardinality(Range(c) \ Range(conn))
        /\ kthOK' = (kthOK /\ KthKept(deps, conn, new, c))
  /\ UNCHANGED val

Write(d) ==
  /\ val' = [val EXCEPT ![d] = 1 - @]
  /\ rec' = [x \in DOMAIN rec |-> IF x \in subs[d] THEN val'[d] ELSE rec[x]]
  /\ UNCHANGED <<deps, conn, subs, next, exchanges, kthOK>>

Init ==
  /\ deps = << >> /\ conn = << >>
  /\ subs = [d \in Deps |-> {}]
  /\ rec = [x \in {} |-> 0]
  /\ val = [d \in Deps |-> 0]
  /\ next = 1 /\ exchanges = 0 /\ kthOK = TRUE

Next == (\E new \in Lists : Exchange(new)) \/ (\E d \in Deps : Write(d))

Spec == Init /\ [][Next]_vars

OnePerPlace == Cardinality(Range(conn)) = Len(conn)
BothSidesAgree == \A d \in Deps : subs[d] = {conn[i] : i \in Places(deps, d)}
RecordsCurrent == \A i \in 1..Len(deps) : rec[conn[i]] = val[deps[i]]
KthKeepsKth == kthOK
=============================================================================
