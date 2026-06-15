----------------------- MODULE wave_pull -----------------------
(***************************************************************************
GraphReFly — pull-mode node (NodeOptions.pullId), conformance C-16/C-26,
R-pull (D55, revised by D269/D278).

A pull node is QUIET by default (self-holds its per-node demand lock). While
quiet it ABSORBS an upstream dep change WITHOUT relaying a downstream DIRTY —
the WEDGE FIX: a quiet node that relayed phase-1 DIRTY but coalesced the
phase-2 settle would strand the downstream's two-phase pending — and tracks the
change per its ORTHOGONAL pausable Mode:
  Mode = "true"      -> coalesce to the LATEST value (one DATA per demand)
  Mode = "resumeAll" -> buffer the BACKLOG (drain all on demand)

A DEMAND is an explicit PULL({pullId, params?}) control/demand message. RESUME
is pause-lock release only and does not demand the pull node. PULL un-quiets the
node when the holder is settle-ready and invokes the pull holder with the params
payload. Downstream output is holder/helper policy: a pending change emits a
DIRTY-before-DATA wave (so the downstream dirty is balanced — modeled by the
dirtyOwed transient that MUST clear before re-quiet), while a no-change
parameterized retained view MAY emit one params-driven output before re-quiet.
A plain snapshot helper may still be silent on no-change demand, but the holder
invocation is not suppressed. If PULL arrives while a dep DIRTY is in flight, it
becomes an owed demand; later separate PULLs before service overwrite the owed
params (latest owed params wins) and still produce at most one holder invocation.

The SELF-triggered-demand DEFERRAL (a consumer fn demanding a dep it also reads
-> queued to the committed wave boundary, never synchronous re-entry / D37) is
the R-rewire-deferred (D47) boundary mechanism, already modeled + TLC-green in
wave_rewire_deferred.tla (DeferredAppliedAtBoundary). This module models the
pull-holder service semantics (absorb / holder invocation / optional output /
re-quiet / mode), not the deferral.

Status: draft (flips active with the C-16/C-26/C-27 conformance arms).
Configs: wave_pull.cfg (Mode="true"), wave_pull_resumeall.cfg (Mode="resumeAll").
 ***************************************************************************)
EXTENDS Integers, Sequences, TLC

CONSTANTS Values, Params, MaxChange, Mode

VARIABLES
  quiet,        \* BOOLEAN — pull node holds its demand lock (quiet by default)
  depDirty,     \* BOOLEAN — a dep DIRTY (phase 1) is in flight, settle not yet seen
  latest,       \* Values \cup {NONE} — latest tracked dep value (true mode)
  backlog,      \* Seq(Values) — values accumulated since last demand (resumeAll)
  owed,         \* BOOLEAN — a change is pending delivery (true mode)
  dirtyOwed,    \* BOOLEAN — a downstream DIRTY was broadcast, not yet balanced (WEDGE if it persists while quiet)
  delivered,    \* Seq(Values) — observable downstream DATA trace
  changes,      \* Nat — dep changes settled (bound)
  demands,      \* Nat — demands issued (PULL pulses)
  resumes,      \* Nat — RESUME pulses observed on the same token (pause-only)
  requestedParams, \* Seq(Params) — params carried by PULL
  receivedParams,  \* Seq(Params) — params delivered to the pull holder
  expectedParams,  \* Seq(Params) — holder deliveries after owed-PULL coalescing
  owedPull,     \* BOOLEAN — a PULL arrived while the holder was not settle-ready
  owedParam,    \* Params \cup {NO_PARAM} — latest params for the owed PULL
  deliveries,   \* Nat — change delivery events produced
  paramDeliveries, \* Nat — no-change params-policy output events produced
  outputProduced \* BOOLEAN — current service path already emitted downstream output

vars == <<quiet, depDirty, latest, backlog, owed, dirtyOwed, delivered, changes,
          demands, resumes, requestedParams, receivedParams, expectedParams,
          owedPull, owedParam, deliveries, paramDeliveries, outputProduced>>
NONE == -1
NO_PARAM == "NO_PARAM"

HasChange == (Mode = "true" /\ owed) \/ (Mode = "resumeAll" /\ backlog # << >>)
Prefix(s, n) == IF n = 0 THEN << >> ELSE SubSeq(s, 1, n)
ReplaceLast(s, p) == IF Len(s) = 0 THEN <<p>> ELSE SubSeq(s, 1, Len(s) - 1) \o <<p>>

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
  /\ resumes     \in 0..MaxChange
  /\ requestedParams \in Seq(Params)
  /\ receivedParams  \in Seq(Params)
  /\ expectedParams  \in Seq(Params)
  /\ owedPull   \in BOOLEAN
  /\ owedParam   \in Params \cup {NO_PARAM}
  /\ deliveries \in 0..MaxChange
  /\ paramDeliveries \in 0..MaxChange
  /\ outputProduced \in BOOLEAN

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
  /\ resumes = 0
  /\ requestedParams = << >>
  /\ receivedParams = << >>
  /\ expectedParams = << >>
  /\ owedPull = FALSE
  /\ owedParam = NO_PARAM
  /\ deliveries = 0
  /\ paramDeliveries = 0
  /\ outputProduced = FALSE

\* Phase 1 of a dep change while the pull node is QUIET: the dep goes DIRTY. The
\* node ABSORBS it — does NOT relay a downstream DIRTY (dirtyOwed stays FALSE).
\* This is the wedge fix. [Mutation point: setting dirtyOwed'=TRUE here = the
\* relay-while-quiet bug -> NoWedgeWhileQuiet trips.]
DepDirtyPhase ==
  /\ quiet
  /\ ~depDirty
  /\ changes < MaxChange
  /\ depDirty' = TRUE
  /\ UNCHANGED <<quiet, latest, backlog, owed, dirtyOwed, delivered, changes,
                 demands, resumes, requestedParams, receivedParams,
                 expectedParams, owedPull, owedParam, deliveries,
                 paramDeliveries, outputProduced>>

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
  /\ UNCHANGED <<quiet, dirtyOwed, delivered, demands, resumes,
                 requestedParams, receivedParams, expectedParams, owedPull,
                 owedParam, deliveries, paramDeliveries, outputProduced>>

\* A DEMAND arrives (PULL with params) once the node is settle-ready: deliver
\* params to the holder and un-quiet to service the demand.
DemandPullReady(p) ==
  /\ quiet
  /\ ~depDirty
  /\ ~owedPull
  /\ demands < MaxChange
  /\ quiet' = FALSE
  /\ demands' = demands + 1
  /\ requestedParams' = Append(requestedParams, p)
  /\ receivedParams' = Append(receivedParams, p)
  /\ expectedParams' = Append(expectedParams, p)
  /\ outputProduced' = FALSE
  /\ UNCHANGED <<depDirty, latest, backlog, owed, dirtyOwed, delivered, changes,
                 resumes, owedPull, owedParam, deliveries, paramDeliveries>>

\* A DEMAND arrives while a dep DIRTY is still in flight, or while a prior owed
\* PULL has not yet delivered. The holder cannot fire a second service path yet,
\* so this becomes/updates an owed PULL. Separate later PULLs before delivery
\* overwrite the owed params, keeping exactly one expected holder delivery.
DemandPullOwed(p) ==
  /\ quiet
  /\ (depDirty \/ owedPull)
  /\ demands < MaxChange
  /\ demands' = demands + 1
  /\ requestedParams' = Append(requestedParams, p)
  /\ expectedParams' =
       IF owedPull THEN ReplaceLast(expectedParams, p) ELSE Append(expectedParams, p)
  /\ owedPull' = TRUE
  /\ owedParam' = p
  /\ UNCHANGED <<quiet, depDirty, latest, backlog, owed, dirtyOwed, delivered,
                 changes, resumes, receivedParams, deliveries,
                 paramDeliveries, outputProduced>>

\* Once the dep settles, the latest owed params are delivered to the holder and
\* the normal one-demand service path begins.
OwedDemandReady ==
  /\ quiet
  /\ ~depDirty
  /\ owedPull
  /\ quiet' = FALSE
  /\ receivedParams' = Append(receivedParams, owedParam)
  /\ owedPull' = FALSE
  /\ owedParam' = NO_PARAM
  /\ outputProduced' = FALSE
  /\ UNCHANGED <<depDirty, latest, backlog, owed, dirtyOwed, delivered, changes,
                 demands, resumes, requestedParams, expectedParams, deliveries,
                 paramDeliveries>>

\* RESUME on the same token is pause-lock release only. It does not un-quiet,
\* does not increment demand count, and does not deliver params.
ResumeNoDemand ==
  /\ quiet
  /\ ~depDirty
  /\ resumes < MaxChange
  /\ resumes' = resumes + 1
  /\ UNCHANGED <<quiet, depDirty, latest, backlog, owed, dirtyOwed, delivered,
                 changes, demands, requestedParams, receivedParams,
                 expectedParams, owedPull, owedParam, deliveries,
                 paramDeliveries, outputProduced>>

\* Demand wave phase 1: emit DIRTY downstream (only when there IS a retained
\* change to deliver). dirtyOwed marks the unbalanced downstream DIRTY.
DemandDeliverDirty ==
  /\ ~quiet
  /\ HasChange
  /\ ~dirtyOwed
  /\ dirtyOwed' = TRUE
  /\ UNCHANGED <<quiet, depDirty, latest, backlog, owed, delivered, changes,
                 demands, resumes, requestedParams, receivedParams,
                 expectedParams, owedPull, owedParam, deliveries,
                 paramDeliveries, outputProduced>>

\* Demand wave phase 2: deliver changed retained content ONCE (true -> latest as
\* one DATA; resumeAll -> drain the backlog), balancing the DIRTY
\* (dirtyOwed -> FALSE) and consuming the change.
DemandDeliverData ==
  /\ ~quiet
  /\ dirtyOwed
  /\ dirtyOwed' = FALSE
  /\ deliveries' = deliveries + 1
  /\ outputProduced' = TRUE
  /\ IF Mode = "resumeAll"
       THEN /\ delivered' = delivered \o backlog /\ backlog' = << >> /\ owed' = owed
       ELSE /\ delivered' = Append(delivered, latest) /\ owed' = FALSE /\ backlog' = backlog
  /\ UNCHANGED <<quiet, depDirty, latest, changes, demands, resumes,
                 requestedParams, receivedParams, expectedParams, owedPull,
                 owedParam, paramDeliveries>>

\* A parameterized retained-view helper may answer a no-change PULL from
\* ctx.pull.params + retained state/cursor. This is ordinary downstream output
\* policy, not substrate-forced cached DATA. Plain snapshot helpers can skip this
\* action and re-quiet silently.
ParamPolicyOutputNoChange ==
  /\ ~quiet
  /\ ~dirtyOwed
  /\ ~HasChange
  /\ ~outputProduced
  /\ paramDeliveries < MaxChange
  /\ paramDeliveries' = paramDeliveries + 1
  /\ outputProduced' = TRUE
  /\ UNCHANGED <<quiet, depDirty, latest, backlog, owed, dirtyOwed, delivered,
                 changes, demands, resumes, requestedParams, receivedParams,
                 expectedParams, owedPull, owedParam, deliveries>>

\* RE-QUIET: re-acquire the demand lock once the demand is fully serviced —
\* balanced (no dirtyOwed) and nothing changed left to deliver. A no-change
\* service path may have produced one params-policy output or none.
ReQuiet ==
  /\ ~quiet
  /\ ~dirtyOwed
  /\ ~HasChange
  /\ quiet' = TRUE
  /\ outputProduced' = FALSE
  /\ UNCHANGED <<depDirty, latest, backlog, owed, dirtyOwed, delivered, changes,
                 demands, resumes, requestedParams, receivedParams,
                 expectedParams, owedPull, owedParam, deliveries,
                 paramDeliveries>>

Next ==
  \/ DepDirtyPhase
  \/ \E v \in Values : DepSettle(v)
  \/ \E p \in Params : DemandPullReady(p)
  \/ \E p \in Params : DemandPullOwed(p)
  \/ OwedDemandReady
  \/ ResumeNoDemand
  \/ DemandDeliverDirty
  \/ DemandDeliverData
  \/ ParamPolicyOutputNoChange
  \/ ReQuiet

Spec == Init /\ [][Next]_vars

\* ── Invariants ──
\* WEDGE FIX (the probe P0b finding): while quiet, the pull node never holds an
\* unbalanced downstream DIRTY — it ABSORBS the dep DIRTY rather than relaying it,
\* and re-quiets only after the demand wave's own DIRTY is balanced by its DATA.
\* A regression that relays DIRTY while quiet, or re-quiets before balancing, trips.
NoWedgeWhileQuiet == quiet => ~dirtyOwed
\* 1:1 — never more downstream output events than PULL demands; output happens
\* ONLY through a serviced PULL (no spontaneous downstream push from a dep
\* change while quiet, and no RESUME-driven pull).
OneDeliveryPerDemand == deliveries + paramDeliveries <= demands
\* Holder invocation is the substrate guarantee: each received params payload is
\* exactly one holder service path, even when no dependency changed.
OneHolderInvocationPerDemand == Len(receivedParams) <= demands
\* A holder/helper may emit at most one downstream output per invocation. Plain
\* no-change snapshots can emit zero; params-driven retained views can emit one.
OneDownstreamOutputPerInvocation == deliveries + paramDeliveries <= Len(receivedParams)
\* PULL params delivered to the holder follow the coalesced expected sequence:
\* ready PULLs are delivered as issued; owed PULLs collapse to the latest params.
PullParamsDelivered ==
  /\ Len(receivedParams) <= Len(expectedParams)
  /\ receivedParams = Prefix(expectedParams, Len(receivedParams))
\* While a PULL is owed, there is exactly one not-yet-received expected params
\* payload, and it is the latest owed params.
LatestOwedParamsWins ==
  owedPull => /\ Len(expectedParams) = Len(receivedParams) + 1
              /\ owedParam = expectedParams[Len(expectedParams)]
\* Owed PULL is a quiet pending state only; service begins by clearing it.
NoOwedPullWhileUnquiet == ~quiet => ~owedPull
\* RESUME is pause-only here: observing only RESUME pulses cannot create demand,
\* holder invocation, or downstream delivery.
ResumeDoesNotDemand ==
  (resumes > 0 /\ demands = 0) =>
    (deliveries = 0 /\ paramDeliveries = 0 /\ Len(receivedParams) = 0 /\ quiet)
\* true mode 1:1: each delivering demand emits EXACTLY one DATA.
TrueModeOnePerDelivery == Mode = "true" => Len(delivered) = deliveries
\* resumeAll: no change lost or duplicated across the quiet boundary — everything
\* delivered or still buffered accounts for every settled change.
NoChangeLost == Mode = "resumeAll" => Len(delivered) + Len(backlog) = changes
=============================================================================
