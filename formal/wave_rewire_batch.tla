------------------------ MODULE wave_rewire_batch ------------------------
(***************************************************************************
GraphReFly -- batch commit precedes rewire application (D67 / B19).

If a rewire is requested while an outer batch has an uncommitted settle slice,
the request is accepted but applied only after the batch commits. The pending
wave commits against the pre-rewire shape.
 ***************************************************************************)
EXTENDS TLC

VARIABLES batchOpen, pendingOldShape, rewireQueued, depsShape, committedOldShape, appliedRewire

vars == <<batchOpen, pendingOldShape, rewireQueued, depsShape, committedOldShape, appliedRewire>>

TypeOK ==
  /\ batchOpen \in BOOLEAN
  /\ pendingOldShape \in BOOLEAN
  /\ rewireQueued \in BOOLEAN
  /\ depsShape \in {"old","new"}
  /\ committedOldShape \in BOOLEAN
  /\ appliedRewire \in BOOLEAN

Init ==
  /\ batchOpen = TRUE
  /\ pendingOldShape = FALSE
  /\ rewireQueued = FALSE
  /\ depsShape = "old"
  /\ committedOldShape = FALSE
  /\ appliedRewire = FALSE

EmitIntoBatch ==
  /\ batchOpen
  /\ ~pendingOldShape
  /\ pendingOldShape' = TRUE
  /\ UNCHANGED <<batchOpen, rewireQueued, depsShape, committedOldShape, appliedRewire>>

RequestRewire ==
  /\ batchOpen
  /\ ~rewireQueued
  /\ rewireQueued' = TRUE
  /\ UNCHANGED <<batchOpen, pendingOldShape, depsShape, committedOldShape, appliedRewire>>

CommitBatch ==
  /\ batchOpen
  /\ batchOpen' = FALSE
  /\ committedOldShape' = pendingOldShape
  /\ pendingOldShape' = FALSE
  /\ UNCHANGED <<rewireQueued, depsShape, appliedRewire>>

ApplyRewire ==
  /\ ~batchOpen
  /\ rewireQueued
  /\ ~appliedRewire
  /\ depsShape' = "new"
  /\ appliedRewire' = TRUE
  /\ rewireQueued' = FALSE
  /\ UNCHANGED <<batchOpen, pendingOldShape, committedOldShape>>

Next == EmitIntoBatch \/ RequestRewire \/ CommitBatch \/ ApplyRewire \/ UNCHANGED vars
Spec == Init /\ [][Next]_vars

NoRewireOnUncommittedView == batchOpen => depsShape = "old" /\ ~appliedRewire
CommitPrecedesRewire == appliedRewire => ~batchOpen /\ (committedOldShape \/ ~pendingOldShape)
OldPendingNeverCommitsAgainstNewShape == committedOldShape => depsShape = "old" \/ appliedRewire
=============================================================================
