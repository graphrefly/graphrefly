------------------------ MODULE kernel_batch_output ------------------------
(***************************************************************************
D808 / R-request-order@3, R-wave@3, R-lifetime: distinguish a throwing body,
a failed commit, a quiet invocation's staged arrays, and a late ctx.down
request. The body stages host writes and quiet DATA + auto COMPLETE, and asks
for a late DATA request. Its lifetime may close before execution. An ended
host target is represented by commit failure before updater evaluation.
Every body/commit outcome and lifetime state is explored. Mutation switches
bind late output to the commit or split the quiet postlude into another wave.
No claim about arbitrary topology or scheduler interleavings: those remain in
kernel_lifetime/kernel_wave. This model isolates the formerly missing axis.
***************************************************************************)
EXTENDS Naturals, Sequences, TLC
CONSTANTS BindLateToCommit, SplitQuiet
VARIABLE k
vars == <<k>>
Init == \E result \in {"ok", "bodyThrow", "commitFail"}, live \in BOOLEAN :
  k = [result |-> result, live |-> live, phase |-> "body", queue |-> <<>>,
       hostWrites |-> 0, updaterCalls |-> 0, quietWaves |-> <<>>, late |-> <<>>]
BodyEnd == /\ k.phase = "body"
           /\ k' = IF k.result = "bodyThrow" THEN [k EXCEPT !.phase = "done"]
                   ELSE [k EXCEPT !.phase = "drain", !.queue = <<"commit", "late">>]
Commit == /\ k.phase = "drain" /\ Head(k.queue) = "commit"
          /\ k' = [k EXCEPT !.queue = Tail(@),
                     !.hostWrites = IF k.result = "ok" THEN 2 ELSE 0,
                     !.updaterCalls = IF k.result = "ok" THEN 1 ELSE 0,
                     !.quietWaves = IF k.result # "ok" \/ ~k.live THEN <<>>
                       ELSE IF SplitQuiet THEN << << <<"DATA99">> >>, << <<"COMPLETE">> >> >>
                       ELSE << << <<"DATA99">>, <<"COMPLETE">> >> >>]
Late == /\ k.phase = "drain" /\ Head(k.queue) = "late"
        /\ k' = [k EXCEPT !.queue = Tail(@), !.phase = "done",
                   !.late = IF k.live /\ (~BindLateToCommit \/ k.result = "ok")
                            THEN <<42>> ELSE <<>>]
Next == BodyEnd \/ Commit \/ Late
Spec == Init /\ [][Next]_vars
BodyThrowNothing == k.result = "bodyThrow" =>
  k.hostWrites = 0 /\ k.updaterCalls = 0 /\ k.quietWaves = <<>> /\ k.late = <<>>
FailedCommitNothing == k.result = "commitFail" =>
  k.hostWrites = 0 /\ k.updaterCalls = 0 /\ k.quietWaves = <<>>
LateIndependent == k.phase = "done" /\ k.result # "bodyThrow" /\ k.live => k.late = <<42>>
ClosedOutputDropped == ~k.live => k.late = <<>> /\ k.quietWaves = <<>>
QuietTerminalTogether == Len(k.quietWaves) <= 1 /\
  (k.quietWaves # <<>> => k.quietWaves[1] = << <<"DATA99">>, <<"COMPLETE">> >>)
=============================================================================
