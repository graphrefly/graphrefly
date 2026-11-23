----------------------- MODULE kernel_replaced_input -----------------------
(***************************************************************************
GraphReFly kernel and checkpoint — a function is told once that a dependency
was replaced, also across a capture and a restore.

A focused model for graphrefly:B148's eleventh point, written 2026-11-22. It
checks one mechanism of R-invocation and R-checkpoint and nothing else of
either: the kernel marks a dependent's input when its dependency gets a new
instance while the dependent stays active; the dependent's function reads the
mark in its next run, which clears it; a capture saves a mark not yet read,
and the restored node's first activation runs the function for it.

Topology: a computed node A that can be replaced, a state B, and Z over
[A, B] with a sink and the manual COMPLETE policy. Z's function keeps in
private state which of its inputs have completed, as a zip does, drops its
count of an input it is told was replaced, and ends once both are counted.

Steps. Live: A's current instance completes; B completes; B sends a value
(a run of Z that brings no terminal); A is replaced by an instance that holds
nothing (Z does not run), holds a value (Z runs at once) or has ended (Z runs
on its snapshot and terminal). Capture and restore, in one step: Z's private
state and its unread mark are saved, with what A and B held, and the restored
Z has no subscriber. In that window A and B may complete; a replace there is
out of scope, since a restored node that was not activated yet is not active
(R-checkpoint compares only values and ends then). The first subscription
runs Z once if an end changed or the saved mark is set, with only what
changed, and tells it of the mark.

owed is the model's own record of the truth: A was replaced since Z's
function last ran. The mechanism (mark, the saved mark) is checked against it.

Invariants:
  ToldAsOwed      each run of Z is told of a replacement exactly when one
                  happened since its last run
  CountIsCurrent  outside the time a telling is owed, Z counts A as completed
                  only if A's current instance has completed
  EndsOnCurrent   Z ends only when A's current instance and B have completed
 ***************************************************************************)
EXTENDS Integers

CONSTANTS MaxReplaces, MaxCaptures

VARIABLES aEnded,      \* A's current instance has completed
          bEnded,
          done,        \* Z's private state: [a, b], which inputs it counts as completed
          zEnded,
          mark,        \* the kernel's: A was replaced and Z's function has not run since
          owed,        \* the truth of the same
          phase,       \* "live" | "window" (restored, Z not subscribed yet)
          saved,       \* what the checkpoint holds of Z's inputs: [mark, a, b]
          replaces, captures,
          toldOK, endOK
vars == <<aEnded, bEnded, done, zEnded, mark, owed, phase, saved, replaces, captures, toldOK, endOK>>

NoSave == [mark |-> FALSE, a |-> FALSE, b |-> FALSE]

\* One run of Z's function: sawA and sawB say whether this run brings that input's COMPLETE,
\* told whether it is told that A was replaced.
Run(sawA, sawB, told) ==
  LET d == [a |-> (done.a /\ ~told) \/ sawA, b |-> done.b \/ sawB]
  IN /\ done' = d
     /\ zEnded' = (d.a /\ d.b)
     /\ toldOK' = (toldOK /\ (told = owed))
     /\ endOK' = (endOK /\ ((d.a /\ d.b) => (aEnded' /\ bEnded')))
     /\ mark' = FALSE
     /\ owed' = FALSE

Quiet == UNCHANGED <<done, zEnded, toldOK, endOK>>
Live == phase = "live" /\ ~zEnded

CompleteA ==
  /\ Live /\ ~aEnded
  /\ aEnded' = TRUE /\ UNCHANGED <<bEnded, phase, saved, replaces, captures>>
  /\ Run(TRUE, FALSE, mark)

CompleteB ==
  /\ Live /\ ~bEnded
  /\ bEnded' = TRUE /\ UNCHANGED <<aEnded, phase, saved, replaces, captures>>
  /\ Run(FALSE, TRUE, mark)

ValueB ==
  /\ Live /\ ~bEnded
  /\ UNCHANGED <<aEnded, bEnded, phase, saved, replaces, captures>>
  /\ Run(FALSE, FALSE, mark)

\* kind: "empty" (the new instance holds nothing), "value" or "ended".
ReplaceA(kind) ==
  /\ Live /\ replaces < MaxReplaces
  /\ replaces' = replaces + 1
  /\ aEnded' = (kind = "ended")
  /\ UNCHANGED <<bEnded, phase, saved, captures>>
  /\ IF kind = "empty"
     THEN mark' = TRUE /\ owed' = TRUE /\ Quiet
     ELSE /\ toldOK' = toldOK       \* the mark is set and read in the same request: told = owed = TRUE
          /\ LET d == [a |-> (kind = "ended"), b |-> done.b]
             IN /\ done' = d
                /\ zEnded' = (d.a /\ d.b)
                /\ endOK' = (endOK /\ ((d.a /\ d.b) => (aEnded' /\ bEnded)))
          /\ mark' = FALSE /\ owed' = FALSE

\* Capture at a wave boundary and restore into a new graph, where nothing is marked yet.
CaptureRestore ==
  /\ Live /\ captures < MaxCaptures
  /\ captures' = captures + 1
  /\ saved' = [mark |-> mark, a |-> aEnded, b |-> bEnded]
  /\ phase' = "window"
  /\ mark' = FALSE
  /\ UNCHANGED <<aEnded, bEnded, owed, replaces>> /\ Quiet

WindowCompleteA ==
  /\ phase = "window" /\ ~aEnded
  /\ aEnded' = TRUE /\ UNCHANGED <<bEnded, mark, owed, phase, saved, replaces, captures>> /\ Quiet

WindowCompleteB ==
  /\ phase = "window" /\ ~bEnded
  /\ bEnded' = TRUE /\ UNCHANGED <<aEnded, mark, owed, phase, saved, replaces, captures>> /\ Quiet

\* The restored Z's first activation: the function runs once if an end changed or a replacement
\* was saved as not told, with only what changed.
Subscribe ==
  /\ phase = "window"
  /\ phase' = "live" /\ saved' = NoSave
  /\ UNCHANGED <<aEnded, bEnded, replaces, captures>>
  /\ LET sawA == aEnded /\ ~saved.a
         sawB == bEnded /\ ~saved.b
     IN IF sawA \/ sawB \/ saved.mark
        THEN Run(sawA, sawB, saved.mark)
        ELSE UNCHANGED <<mark, owed>> /\ Quiet

Init ==
  /\ aEnded = FALSE /\ bEnded = FALSE
  /\ done = [a |-> FALSE, b |-> FALSE] /\ zEnded = FALSE
  /\ mark = FALSE /\ owed = FALSE
  /\ phase = "live" /\ saved = NoSave
  /\ replaces = 0 /\ captures = 0
  /\ toldOK = TRUE /\ endOK = TRUE

Next ==
  \/ CompleteA \/ CompleteB \/ ValueB
  \/ \E kind \in {"empty", "value", "ended"} : ReplaceA(kind)
  \/ CaptureRestore \/ WindowCompleteA \/ WindowCompleteB \/ Subscribe

Spec == Init /\ [][Next]_vars

ToldAsOwed == toldOK
CountIsCurrent == (phase = "live" /\ done.a /\ ~owed) => aEnded
EndsOnCurrent == endOK
=============================================================================
