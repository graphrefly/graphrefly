------------------------ MODULE kernel_quiet_error ------------------------
(***************************************************************************
R-wave@3 / R-terminals@1: a batch invalidates and errors A while updating B.
Quiet Q(A) previously retained 1 or nothing; D(Q,B) emits their sum when both
have values. The immediate INVALIDATE precedes B's settlement; ERROR is a
later lifetime-bound request. Auto ERROR forces invalidation for either
INVALIDATE policy. This isolates the four QA2 cases, not arbitrary topology.
***************************************************************************)
EXTENDS Naturals, Sequences, TLC
CONSTANTS DelayInvalidate, IgnoreManual
VARIABLE s
vars == <<s>>
Init == \E retained \in BOOLEAN, manual \in BOOLEAN :
  s = [retained |-> retained, manual |-> manual, phase |-> "input",
       has |-> retained, live |-> TRUE, data |-> <<>>, inv |-> 0, errors |-> 0]
Quiet == /\ s.phase = "input"
         /\ s' = [s EXCEPT !.phase = "sibling",
                    !.has = IF DelayInvalidate \/ (IgnoreManual /\ s.manual)
                            THEN s.has ELSE FALSE,
                    !.inv = IF s.retained /\ ~DelayInvalidate /\ ~(IgnoreManual /\ s.manual)
                            THEN 1 ELSE 0]
Sibling == /\ s.phase = "sibling"
           /\ s' = [s EXCEPT !.phase = "later", !.data = IF s.has THEN <<3>> ELSE <<>>]
Close == /\ s.phase = "later" /\ s.live
         /\ s' = [s EXCEPT !.live = FALSE]
Error == /\ s.phase = "later"
         /\ s' = [s EXCEPT !.phase = "done",
                    !.errors = IF s.live THEN 1 ELSE 0,
                    !.has = IF s.live THEN FALSE ELSE s.has,
                    !.inv = IF DelayInvalidate /\ s.live /\ s.retained THEN 1 ELSE s.inv]
Next == Quiet \/ Sibling \/ Close \/ Error
Spec == Init /\ [][Next]_vars
NoStaleData == s.data = <<>>
ImmediateInvalidation == s.phase # "input" => s.inv = IF s.retained THEN 1 ELSE 0
ClosedErrorDropped == ~s.live => s.errors = 0
=============================================================================
