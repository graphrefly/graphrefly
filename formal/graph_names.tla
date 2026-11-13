---------------------------- MODULE graph_names ----------------------------
(***************************************************************************
D809 / R-naming: finite local-name admission and one mounted child. Names are
strings here, rather than opaque node atoms: accepting a local :: makes an
ordinary id indistinguishable from an address. This models addressing only;
module vocabulary/casing and runtime-specific inventories are executable probes.
***************************************************************************)
EXTENDS Naturals, Sequences, FiniteSets, TLC
CONSTANTS AllowReserved, AllowBoundary
VARIABLES nodes, mounts
vars == <<nodes, mounts>>
Names == {"a", "b", "a::b", "a:", ":b", "a:b"}
Graphs == {"root", "child"}
Cuts(s) == {i \in 1..(Len(s)-1) : SubSeq(s, i, i+1) = "::"}
Boundary(s) == SubSeq(s, 1, 1) = ":" \/ SubSeq(s, Len(s), Len(s)) = ":"
Local(s) == Cuts(s) = {} /\ ~Boundary(s)
Admitted(s) == (Cuts(s) = {} \/ AllowReserved) /\ (~Boundary(s) \/ AllowBoundary)
Init == /\ nodes = {} /\ mounts = {}
AddNode == \E g \in Graphs, n \in Names :
             /\ Admitted(n)
             /\ nodes' = nodes \cup {<<g, n>>}
             /\ UNCHANGED mounts
Mount == \E p \in Names :
           /\ Admitted(p)
           /\ mounts' = mounts \cup {p}
           /\ UNCHANGED nodes
Next == AddNode \/ Mount
Spec == Init /\ [][Next]_vars
Addresses == {<<"root", n[2], n[2]>> : n \in {x \in nodes : x[1] = "root"}}
             \cup {<<"child", n[2], p \o "::" \o n[2]>> :
                       n \in {x \in nodes : x[1] = "child"}, p \in mounts}
Find(s) == IF Cuts(s) = {} THEN <<"root", s>> ELSE
             LET cut == CHOOSE i \in Cuts(s) : \A j \in Cuts(s) : i <= j
                 path == SubSeq(s, 1, cut-1)
                 id == SubSeq(s, cut+2, Len(s))
             IN IF path \in mounts /\ Local(id) THEN <<"child", id>> ELSE <<"missing", s>>
LocalAdmission == /\ \A n \in nodes : Local(n[2])
                  /\ \A p \in mounts : Local(p)
RoundTrip == \A a \in Addresses : Find(a[3]) = <<a[1], a[2]>>
UniqueAddresses == \A a,b \in Addresses : a[3] = b[3] => <<a[1], a[2]>> = <<b[1], b[2]>>
=============================================================================
