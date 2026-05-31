----------------------- MODULE wave_pull -----------------------
(***************************************************************************
GraphReFly — pull-mode node (NodeOptions.pull:true), conformance C-16, R-pull (D55).

A pull node is QUIET by default (self-holds its per-node demand lock). While
quiet it ABSORBS an upstream dep change WITHOUT relaying a downstream DIRTY —
the WEDGE FIX: a quiet node that relayed phase-1 DIRTY but coalesced the
phase-2 settle would strand the downstream's two-phase pending — and tracks the
change per its ORTHOGONAL pausable Mode:
  Mode = "true"      -> coalesce to the LATEST value (one DATA per demand)
  Mode = "resumeAll" -> buffer the BACKLOG (drain all on demand)

A DEMAND is a RESUME of the demand lock (NO new message type — R-msg-closed-set
intact). The node un-quiets, emits a DIRTY-before-DATA wave (so the downstream
dirty is balanced — modeled by the dirtyOwed transient that MUST clear before
re-quiet), delivers ONCE, then RE-QUIETS (1:1). A demand with no intervening
change delivers NOTHING (silent).

The SELF-triggered-demand DEFERRAL (a consumer fn demanding a dep it also reads
-> queued to the committed wave boundary, never synchronous re-entry / D37) is
the R-rewire-deferred (D47) boundary mechanism, already modeled + TLC-green in
wave_rewire_deferred.tla (DeferredAppliedAtBoundary). This module models the
pull-node DELIVERY semantics (absorb / one-per-demand / re-quiet / mode), not
the deferral.

Status: draft (flips active with the C-16 conformance + the pull:true impl).
Configs: wave_pull.cfg (Mode="true"), wave_pull_resumeall.cfg (Mode="resumeAll").
 ***************************************************************************)
EXTENDS Integers, Sequences, TLC

CONSTANTS Values, MaxChange, Mode

VARIABLES
  quiet,        \* BOOLEAN — pull node holds its demand lock (quiet by default)
  depDirty,     \* BOOLEAN — a dep DIRTY (phase 1) is in flight, settle not yet seen
  latest,       \* Values \cup {NONE} — latest tracked dep value (true mode)
  backlog,      \* Seq(Values) — values accumulated since last demand (resumeAll)
  owed,         \* BOOLEAN — a change is pending delivery (true mode)
  dirtyOwed,    \* BOOLEAN — a downstream DIRTY was broadcast, not yet balanced (WEDGE if it persists while quiet)
  delivered,    \* Seq(Values) — observable downstream DATA trace
  changes,      \* Nat — dep changes settled (bound)
  demands,      \* Nat — demands issued (RESUME pulses)
  deliveries    \* Nat — delivery events produced

vars == <<quiet, depDirty, latest, backlog, owed, dirtyOwed, delivered, changes, demands, deliveries>>
NONE == -1

HasChange == (Mode = "true" /\ owed) \/ (Mode = "resumeAll" /\ backlog # << >>)

TypeOK ==
  /\ quiet      \in BOOLEAN
  /\ depDirty   \in BOOLEAN
  /\ latest     \in Values \cup {NONE}
  /\ backlog    \in Seq(Values)
  /\ owed       \in BOOLEAN
  /\ dirtyOwed  \in BOOLEAN
  /\ delivered  \in Seq(Values)
  /\ changes    \in 0..MaxChange
  /\ demands    \in 0..MaxChange
  /\ deliveries \in 0..MaxChange

Init ==
  /\ quiet = TRUE
  /\ depDirty = FALSE
  /\ latest = NONE
  /\ backlog = << >>
  /\ owed = FALSE
  /\ dirtyOwed = FALSE
  /\ delivered = << >>
  /\ changes = 0
  /\ demands = 0
  /\ deliveries = 0

\* Phase 1 of a dep change while the pull node is QUIET: the dep goes DIRTY. The
\* node ABSORBS it — does NOT relay a downstream DIRTY (dirtyOwed stays FALSE).
\* This is the wedge fix. [Mutation point: setting dirtyOwed'=TRUE here = the
\* relay-while-quiet bug -> NoWedgeWhileQuiet trips.]
DepDirtyPhase ==
  /\ quiet
  /\ ~depDirty
  /\ changes < MaxChange
  /\ depDirty' = TRUE
  /\ UNCHANGED <<quiet, latest, backlog, owed, dirtyOwed, delivered, changes, demands, deliveries>>

\* Phase 2: the dep settles with v. The quiet node coalesces (true) / buffers
\* (resumeAll) it and emits NO downstream settle — still no wedge.
DepSettle(v) ==
  /\ quiet
  /\ depDirty
  /\ depDirty' = FALSE
  /\ latest' = v
  /\ changes' = changes + 1
  /\ IF Mode = "resumeAll"
       THEN /\ backlog' = Append(backlog, v) /\ owed' = owed
       ELSE /\ owed' = TRUE /\ backlog' = backlog
  /\ UNCHANGED <<quiet, dirtyOwed, delivered, demands, deliveries>>

\* A DEMAND arrives (RESUME of the demand lock) once the node is settle-ready
\* (no dep DIRTY in flight, semantic (e)): un-quiet to service it.
DemandResume ==
  /\ quiet
  /\ ~depDirty
  /\ demands < MaxChange
  /\ quiet' = FALSE
  /\ demands' = demands + 1
  /\ UNCHANGED <<depDirty, latest, backlog, owed, dirtyOwed, delivered, changes, deliveries>>

\* Demand wave phase 1: emit DIRTY downstream (only when there IS a change to
\* deliver). dirtyOwed marks the unbalanced downstream DIRTY.
DemandDeliverDirty ==
  /\ ~quiet
  /\ HasChange
  /\ ~dirtyOwed
  /\ dirtyOwed' = TRUE
  /\ UNCHANGED <<quiet, depDirty, latest, backlog, owed, delivered, changes, demands, deliveries>>

\* Demand wave phase 2: deliver ONCE (true -> latest as one DATA; resumeAll ->
\* drain the backlog), balancing the DIRTY (dirtyOwed -> FALSE) and consuming
\* the change.
DemandDeliverData ==
  /\ ~quiet
  /\ dirtyOwed
  /\ dirtyOwed' = FALSE
  /\ deliveries' = deliveries + 1
  /\ IF Mode = "resumeAll"
       THEN /\ delivered' = delivered \o backlog /\ backlog' = << >> /\ owed' = owed
       ELSE /\ delivered' = Append(delivered, latest) /\ owed' = FALSE /\ backlog' = backlog
  /\ UNCHANGED <<quiet, depDirty, latest, changes, demands>>

\* RE-QUIET: re-acquire the demand lock once the demand is fully serviced —
\* balanced (no dirtyOwed) and nothing left to deliver (delivered, or a silent
\* no-change demand). 1:1 — one demand = at most one delivery, then quiet again.
ReQuiet ==
  /\ ~quiet
  /\ ~dirtyOwed
  /\ ~HasChange
  /\ quiet' = TRUE
  /\ UNCHANGED <<depDirty, latest, backlog, owed, dirtyOwed, delivered, changes, demands, deliveries>>

Next ==
  \/ DepDirtyPhase
  \/ \E v \in Values : DepSettle(v)
  \/ DemandResume
  \/ DemandDeliverDirty
  \/ DemandDeliverData
  \/ ReQuiet

Spec == Init /\ [][Next]_vars

\* ── Invariants ──
\* WEDGE FIX (the probe P0b finding): while quiet, the pull node never holds an
\* unbalanced downstream DIRTY — it ABSORBS the dep DIRTY rather than relaying it,
\* and re-quiets only after the demand wave's own DIRTY is balanced by its DATA.
\* A regression that relays DIRTY while quiet, or re-quiets before balancing, trips.
NoWedgeWhileQuiet == quiet => ~dirtyOwed
\* 1:1 — never more delivery events than demands; a delivery happens ONLY via a
\* demand (no spontaneous downstream push from a dep change while quiet).
OneDeliveryPerDemand == deliveries <= demands
\* true mode 1:1: each delivering demand emits EXACTLY one DATA.
TrueModeOnePerDelivery == Mode = "true" => Len(delivered) = deliveries
\* resumeAll: no change lost or duplicated across the quiet boundary — everything
\* delivered or still buffered accounts for every settled change.
NoChangeLost == Mode = "resumeAll" => Len(delivered) + Len(backlog) = changes
=============================================================================
