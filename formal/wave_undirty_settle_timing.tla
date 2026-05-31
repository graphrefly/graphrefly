------------------- MODULE wave_undirty_settle_timing -------------------
(***************************************************************************
GraphReFly -- timing of substrate-synthesized undirty RESOLVED (D64 / B39).

An undirty RESOLVED balances a previously broadcast DIRTY after an absorbed
terminal or INVALIDATE dirty-clear. It must use the normal delivery gates:
default mode may deliver immediately, resumeAll buffers while paused, and an
open batch defers until commit.
 ***************************************************************************)
EXTENDS TLC

CONSTANTS Mode, BatchInitiallyOpen

VARIABLES triggered, delivered, buffered, batchQueued, paused, batchOpen

vars == <<triggered, delivered, buffered, batchQueued, paused, batchOpen>>

TypeOK ==
  /\ Mode \in {"true","resumeAll"}
  /\ BatchInitiallyOpen \in BOOLEAN
  /\ triggered \in BOOLEAN
  /\ delivered \in BOOLEAN
  /\ buffered \in BOOLEAN
  /\ batchQueued \in BOOLEAN
  /\ paused \in BOOLEAN
  /\ batchOpen \in BOOLEAN

Init ==
  /\ triggered = FALSE
  /\ delivered = FALSE
  /\ buffered = FALSE
  /\ batchQueued = FALSE
  /\ paused = (Mode = "resumeAll")
  /\ batchOpen = BatchInitiallyOpen

TriggerUndirtyResolved ==
  /\ ~triggered
  /\ triggered' = TRUE
  /\ IF batchOpen
       THEN /\ batchQueued' = TRUE
            /\ UNCHANGED <<delivered, buffered>>
       ELSE IF Mode = "resumeAll" /\ paused
         THEN /\ buffered' = TRUE
              /\ UNCHANGED <<delivered, batchQueued>>
         ELSE /\ delivered' = TRUE
              /\ UNCHANGED <<buffered, batchQueued>>
  /\ UNCHANGED <<paused, batchOpen>>

CommitBatch ==
  /\ batchOpen
  /\ batchOpen' = FALSE
  /\ IF batchQueued
       THEN IF Mode = "resumeAll" /\ paused
         THEN /\ buffered' = TRUE
              /\ delivered' = delivered
         ELSE /\ delivered' = TRUE
              /\ buffered' = buffered
       ELSE /\ UNCHANGED <<delivered, buffered>>
  /\ batchQueued' = FALSE
  /\ UNCHANGED <<triggered, paused>>

Resume ==
  /\ paused
  /\ paused' = FALSE
  /\ IF buffered
       THEN /\ delivered' = TRUE
            /\ buffered' = FALSE
       ELSE /\ UNCHANGED <<delivered, buffered>>
  /\ UNCHANGED <<triggered, batchQueued, batchOpen>>

Next == TriggerUndirtyResolved \/ CommitBatch \/ Resume \/ UNCHANGED vars
Spec == Init /\ [][Next]_vars

NoDeliverWhileBatchOpen == batchOpen => ~delivered
NoDeliverWhileResumeAllPaused == (Mode = "resumeAll" /\ paused) => ~delivered
ReadyImpliesDelivered == (triggered /\ ~batchOpen /\ ~(Mode = "resumeAll" /\ paused)) => delivered
=============================================================================
