------------------ MODULE wave_rewire_deferred_committed ------------------
(***************************************************************************
GraphReFly -- ctx.rewireNext committed-boundary gating (B24).

This is the batch/pause companion to wave_rewire_deferred.tla. C-11 already
proves the self-triggered request is queued while a node fn is running and
drained at a wave boundary. B24 tightens what "boundary" means across two
existing gates:

  - an open batch owns the current settle view until commit;
  - a pause lock keeps a node on a paused view until the final-lock RESUME.

A queued boundary task (dep-set rewireNext or self-triggered upNext demand)
must not apply while either gate is still active. The task drains only after
the current run has ended, any open batch has committed, and pause locks have
fully released. D110 adds rollback fate: if the owning batch rolls back or
fails before commit, queued boundary tasks from that uncommitted cause are
discarded, including cleanup-shaped unsubscribeDep tasks. This model intentionally
does not add a new message/tier/API. It composes D47/R-rewire-deferred with
D67/R-rewire-batch-boundary and D110 rollback fate.
 ***************************************************************************)
EXTENDS TLC

CONSTANTS BatchInitiallyOpen, PauseInitiallyHeld

VARIABLES
    insideRunWave,
    batchOpen,
    batchCommitted,
    batchRolledBack,
    paused,
    queued,
    applied,
    dropped,
    depsShape,
    ghostAppliedDuringRun,
    ghostAppliedBeforeBatchCommit,
    ghostAppliedAfterRollback,
    ghostAppliedWhilePaused

vars == <<insideRunWave, batchOpen, batchCommitted, batchRolledBack, paused,
          queued, applied, dropped, depsShape, ghostAppliedDuringRun,
          ghostAppliedBeforeBatchCommit, ghostAppliedAfterRollback,
          ghostAppliedWhilePaused>>

TypeOK ==
    /\ BatchInitiallyOpen \in BOOLEAN
    /\ PauseInitiallyHeld \in BOOLEAN
    /\ insideRunWave \in BOOLEAN
    /\ batchOpen \in BOOLEAN
    /\ batchCommitted \in BOOLEAN
    /\ batchRolledBack \in BOOLEAN
    /\ paused \in BOOLEAN
    /\ queued \in BOOLEAN
    /\ applied \in BOOLEAN
    /\ dropped \in BOOLEAN
    /\ depsShape \in {"old", "new"}
    /\ ghostAppliedDuringRun \in BOOLEAN
    /\ ghostAppliedBeforeBatchCommit \in BOOLEAN
    /\ ghostAppliedAfterRollback \in BOOLEAN
    /\ ghostAppliedWhilePaused \in BOOLEAN

Init ==
    /\ insideRunWave = TRUE
    /\ batchOpen = BatchInitiallyOpen
    /\ batchCommitted = FALSE
    /\ batchRolledBack = FALSE
    /\ paused = PauseInitiallyHeld
    /\ queued = FALSE
    /\ applied = FALSE
    /\ dropped = FALSE
    /\ depsShape = "old"
    /\ ghostAppliedDuringRun = FALSE
    /\ ghostAppliedBeforeBatchCommit = FALSE
    /\ ghostAppliedAfterRollback = FALSE
    /\ ghostAppliedWhilePaused = FALSE

\* A node fn issues ctx.rewireNext/ctx.upNext during the current run.
\* The request is only queued; topology/demand state is unchanged.
IssueBoundaryTask ==
    /\ insideRunWave
    /\ ~queued
    /\ ~applied
    /\ queued' = TRUE
    /\ UNCHANGED <<insideRunWave, batchOpen, batchCommitted, batchRolledBack,
                   paused, applied, dropped, depsShape, ghostAppliedDuringRun,
                   ghostAppliedBeforeBatchCommit, ghostAppliedAfterRollback,
                   ghostAppliedWhilePaused>>

\* The fn returns. This is necessary but not sufficient for a committed
\* boundary when batch or pause gates are still active.
EndRun ==
    /\ insideRunWave
    /\ insideRunWave' = FALSE
    /\ UNCHANGED <<batchOpen, batchCommitted, batchRolledBack, paused, queued,
                   applied, dropped, depsShape, ghostAppliedDuringRun,
                   ghostAppliedBeforeBatchCommit, ghostAppliedAfterRollback,
                   ghostAppliedWhilePaused>>

\* Successful batch commit closes the uncommitted view. Rollback is deliberately
\* a separate action: D110 says an uncommitted task inherits rollback fate.
CommitBatch ==
    /\ batchOpen
    /\ ~batchRolledBack
    /\ batchOpen' = FALSE
    /\ batchCommitted' = TRUE
    /\ UNCHANGED <<insideRunWave, batchRolledBack, paused, queued, applied,
                   dropped, depsShape, ghostAppliedDuringRun,
                   ghostAppliedBeforeBatchCommit, ghostAppliedAfterRollback,
                   ghostAppliedWhilePaused>>

\* Batch rollback closes the uncommitted view but discards any queued boundary
\* task caused by that uncommitted batch. DIRTY balancing RESOLVED is modeled by
\* the ordinary batch rule, not as topology/demand application here.
RollbackBatch ==
    /\ batchOpen
    /\ ~batchCommitted
    /\ batchOpen' = FALSE
    /\ batchRolledBack' = TRUE
    /\ queued' = FALSE
    /\ dropped' = queued \/ dropped
    /\ UNCHANGED <<insideRunWave, batchCommitted, paused, applied, depsShape,
                   ghostAppliedDuringRun, ghostAppliedBeforeBatchCommit,
                   ghostAppliedAfterRollback, ghostAppliedWhilePaused>>

\* Final-lock RESUME releases the paused view.
ResumeFinalLock ==
    /\ paused
    /\ paused' = FALSE
    /\ UNCHANGED <<insideRunWave, batchOpen, batchCommitted, batchRolledBack,
                   queued, applied, dropped, depsShape, ghostAppliedDuringRun,
                   ghostAppliedBeforeBatchCommit, ghostAppliedAfterRollback,
                   ghostAppliedWhilePaused>>

\* The only legal drain point: after the run, after any initially-open batch
\* committed, and after any initially-held pause lock has released.
DrainBoundaryTask ==
    /\ queued
    /\ ~applied
    /\ ~insideRunWave
    /\ ~batchOpen
    /\ (~BatchInitiallyOpen \/ batchCommitted)
    /\ ~batchRolledBack
    /\ ~dropped
    /\ ~paused
    /\ depsShape' = "new"
    /\ applied' = TRUE
    /\ queued' = FALSE
    /\ ghostAppliedDuringRun' =
          ghostAppliedDuringRun \/ insideRunWave
    /\ ghostAppliedBeforeBatchCommit' =
          ghostAppliedBeforeBatchCommit \/
          (BatchInitiallyOpen /\ ~batchCommitted)
    /\ ghostAppliedAfterRollback' =
          ghostAppliedAfterRollback \/ batchRolledBack
    /\ ghostAppliedWhilePaused' =
          ghostAppliedWhilePaused \/ paused
    /\ UNCHANGED <<insideRunWave, batchOpen, batchCommitted, batchRolledBack, paused,
                   dropped>>

Next ==
    \/ IssueBoundaryTask
    \/ EndRun
    \/ CommitBatch
    \/ RollbackBatch
    \/ ResumeFinalLock
    \/ DrainBoundaryTask
    \/ UNCHANGED vars

Spec == Init /\ [][Next]_vars

\* Load-bearing: allow DrainBoundaryTask while insideRunWave and this trips.
NoDrainDuringRun ==
    ghostAppliedDuringRun = FALSE

\* Load-bearing: drop the batchOpen/batchCommitted guard from DrainBoundaryTask
\* and TLC reaches an applied state before commit.
NoDrainBeforeBatchCommit ==
    ghostAppliedBeforeBatchCommit = FALSE

\* Load-bearing: drop the batchRolledBack/dropped guard from DrainBoundaryTask
\* and TLC reaches an applied state after rollback.
NoDrainAfterRollback ==
    ghostAppliedAfterRollback = FALSE

\* Load-bearing: drop the paused guard from DrainBoundaryTask and this trips.
NoDrainWhilePaused ==
    ghostAppliedWhilePaused = FALSE

\* The observable topology/demand transition cannot happen on an uncommitted or
\* paused view.
AppliedOnlyOnCommittedView ==
    applied =>
      /\ ~insideRunWave
      /\ ~batchOpen
      /\ (~BatchInitiallyOpen \/ batchCommitted)
      /\ ~batchRolledBack
      /\ ~dropped
      /\ ~paused

\* D110: a rolled-back boundary task is not a delayed cleanup/topology effect.
DroppedTaskDoesNotMutate ==
    dropped => ~applied /\ depsShape = "old"

\* The ready state is not a liveness proof, but it prevents a stale queued task
\* from being considered applied before all gates have opened.
OldShapeUntilReady ==
    (insideRunWave \/ batchOpen \/ paused \/ batchRolledBack \/ dropped) => depsShape = "old"
=============================================================================
