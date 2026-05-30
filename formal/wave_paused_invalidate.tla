--------------------- MODULE wave_paused_invalidate ---------------------
(***************************************************************************
GraphReFly — INVALIDATE arriving at a PAUSED compute node (conformance C-13).

Pins R-paused-invalidate (D50) — the INVALIDATE x PAUSE precedence, the
INVALIDATE-side analogue of D44 (which pinned async x PAUSE).

A compute node N (deps > 0) is paused in the default ("true") mode. While
paused, dep value-changes are COALESCED (the fn is skipped and fires once on
final-lock RESUME with the latest dep values — R-pause-modes). The new rule
resolves what an INVALIDATE from a dep does to that coalesced recompute:

  (Q1) it is PROPAGATED downstream immediately (consistent with immediate
       DIRTY; not modelled here — it is unchanged from the current behaviour),
  (Q2) it SUPERSEDES that dep's buffered paused dep-wave: clear the dep to
       SENTINEL and drop its pending change, then RE-DERIVE whether a recompute
       is still pending from whether ANY dep still carries a buffered change
       (ATTRIBUTED cancellation). N recomputes on RESUME only if some dep still
       has a live buffered change; otherwise the recompute is CANCELLED (N has
       already settled to SENTINEL via its own INVALIDATE). A later DATA on the
       same dep re-arms the buffer:
         [DATA(v1), INVALIDATE, DATA(v2)]  ->  N recomputes with v2 on RESUME.

This prevents a spurious recompute against a now-SENTINEL dep — a redundant
undirty RESOLVED for a SENTINEL-guarding fn, and a spurious terminal ERROR for
a non-guarding fn (whose `.unwrap()` panics -> [[ERROR,e]] via D30).

Multi-dep attribution: an INVALIDATE on dep d1 does NOT cancel a recompute that
dep d2's buffered change still warrants (no lost update).

Status: draft (flips active with the C-13 TS + Rust arms green).
Config: wave_paused_invalidate.cfg.
 ***************************************************************************)
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS Deps, Values, LockIds, MaxSteps

VARIABLES
  locks,            \* SUBSET LockIds — held pause locks; paused iff locks # {}
  depVal,           \* [Deps -> Values \cup {NONE}] — N's latest view of each dep
  changed,          \* [Deps -> BOOLEAN] — a buffered value-change pending this pause
  pendingRecompute, \* BOOLEAN — the impl flag (paused_dep_wave_occurred)
  badRecompute,     \* BOOLEAN — sticky: a recompute ever fired with ALL deps SENTINEL
  steps

vars == <<locks, depVal, changed, pendingRecompute, badRecompute, steps>>
NONE == -1

Paused    == locks # {}
AnyChange == \E d \in Deps : changed[d]

TypeOK ==
  /\ locks            \in SUBSET LockIds
  /\ depVal           \in [Deps -> Values \cup {NONE}]
  /\ changed          \in [Deps -> BOOLEAN]
  /\ pendingRecompute \in BOOLEAN
  /\ badRecompute     \in BOOLEAN
  /\ steps            \in 0..MaxSteps

Init ==
  /\ locks            = {}
  /\ depVal           = [d \in Deps |-> NONE]
  /\ changed          = [d \in Deps |-> FALSE]
  /\ pendingRecompute = FALSE
  /\ badRecompute     = FALSE
  /\ steps            = 0

Pause(l) ==
  /\ steps < MaxSteps
  /\ locks' = locks \cup {l}                 \* same-id PAUSE is idempotent (Set)
  /\ steps' = steps + 1
  /\ UNCHANGED <<depVal, changed, pendingRecompute, badRecompute>>

\* A dep delivers DATA while N is paused -> buffer the new value + mark a pending
\* change (coalesce; do not recompute while paused). Also re-arms after an
\* INVALIDATE (the [DATA, INVALIDATE, DATA2] case).
DepData(d, v) ==
  /\ steps < MaxSteps
  /\ Paused
  /\ depVal'           = [depVal  EXCEPT ![d] = v]
  /\ changed'          = [changed EXCEPT ![d] = TRUE]
  /\ pendingRecompute' = TRUE
  /\ steps'            = steps + 1
  /\ UNCHANGED <<locks, badRecompute>>

\* A dep delivers INVALIDATE while N is paused. D50/Q2: SUPERSEDE that dep's
\* buffered change — clear depVal[d] -> SENTINEL and changed[d], then RE-DERIVE
\* pendingRecompute from whether ANY dep still has a buffered change (attributed
\* cancellation). (Q1 immediate downstream propagation is unchanged, not modelled.)
DepInvalidate(d) ==
  /\ steps < MaxSteps
  /\ Paused
  /\ changed'          = [changed EXCEPT ![d] = FALSE]
  /\ depVal'           = [depVal  EXCEPT ![d] = NONE]
  /\ pendingRecompute' = (\E e \in Deps : changed'[e])
  /\ steps'            = steps + 1
  /\ UNCHANGED <<locks, badRecompute>>

ResumeUnknown(l) ==
  /\ l \notin locks
  /\ UNCHANGED vars

\* Release a lock. On final-lock release (lockset empties), if a recompute is
\* pending fire it ONCE with the latest dep snapshot and consume the changes;
\* record whether that recompute saw an ALL-SENTINEL dep set (the bug symptom).
Resume(l) ==
  /\ steps < MaxSteps
  /\ l \in locks
  /\ LET remaining == locks \ {l} IN
       /\ locks' = remaining
       /\ IF remaining = {} /\ pendingRecompute
            THEN /\ changed'          = [d \in Deps |-> FALSE]
                 /\ pendingRecompute' = FALSE
                 /\ badRecompute'     = badRecompute \/ (\A d \in Deps : depVal[d] = NONE)
            ELSE /\ UNCHANGED <<changed, pendingRecompute, badRecompute>>
  /\ steps' = steps + 1
  /\ UNCHANGED <<depVal>>

Next ==
  \/ \E l \in LockIds : Pause(l)
  \/ \E d \in Deps, v \in Values : DepData(d, v)
  \/ \E d \in Deps : DepInvalidate(d)
  \/ \E l \in LockIds : Resume(l)
  \/ \E l \in LockIds : ResumeUnknown(l)

Spec == Init /\ [][Next]_vars

\* ── Invariants ──

\* D50 core: a buffered change always has a LIVE (non-SENTINEL) value — an
\* INVALIDATE supersedes the buffered change (clears BOTH atomically). Catches the
\* CSP-5 bug where INVALIDATE clears the dep's value but leaves the pending change
\* (paused_dep_wave_occurred) set -> a resume recompute against a SENTINEL dep.
ChangedImpliesLive == \A d \in Deps : changed[d] => depVal[d] # NONE

\* Attributed cancellation: the impl flag stays in sync with whether ANY dep has a
\* pending buffered change (so a sole-dep INVALIDATE cancels, a surviving dep does
\* not). pendingRecompute <=> some dep changed.
PendingReflectsChanges == pendingRecompute = AnyChange

\* Observable consequence (PausedInvalidateCancelsBufferedWave +
\* SurvivingDepStillRecomputes): N never recomputes on RESUME against an
\* all-SENTINEL dep set. By ChangedImpliesLive + PendingReflectsChanges a fired
\* recompute always has >= 1 live dep value driving it.
NoAllSentinelRecompute == ~badRecompute
=============================================================================
