-------------------------- MODULE wave_up_source --------------------------
(***************************************************************************
GraphReFly — upstream control at a depless source
(conformance C-7, rule R-up-at-source, decision D38 / backlog B11).

Pins what a DEPLESS source does when a control message reaches it via the
upstream direction (ctx.up, R-ctx-up). The source is the TERMINUS of upstream
forwarding; it self-ACTS only on a message with a coherent round-trip:

  INVALIDATE  -> HONOR the invalidate-request: clear cache to SENTINEL, fire
                 onInvalidate, broadcast INVALIDATE downstream (= self
                 _invalidate). The down-cascade clears the downstream cone.
  DIRTY       -> DROP (no-op): a source has no downstream-driven recompute;
                 self-dirty would wedge downstream awaiting a settle.
  TEARDOWN    -> DROP (no-op): source lifecycle is source/graph-owned.

Dep-bearing intermediates only FORWARD upstream control (no self-action); the
source is the single actor and the down-cascade is the effect — so this focused
model collapses the chain to {source S -> derived D} and exercises the terminus.
`upKind` ranges over all three upstream-allowed non-pause control kinds in one
run (Init picks each). D620 removes the archived, unimplemented per-node guard
opt-out; C-7 pins the unconditional clean-slate terminus behavior modeled here.

Status: draft (flips active with the CSP-1/CSP-2 up-at-source impl + C-7 green).
 ***************************************************************************)
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS UpMsgs,    \* set of upstream control kinds to exercise
          InitVal    \* S's initial cached value

SENTINEL == "SENTINEL"
NONE     == "NONE"

VARIABLES
    upKind,        \* the control kind D sends upstream (chosen at Init)
    sCache,        \* S's cache (InitVal or SENTINEL)
    sStatus,       \* "settled" | "sentinel" | "terminated"
    dCache,        \* D's cached view
    dInvalidated,  \* D observed a down-cascade INVALIDATE
    sOnInvalidate, \* count: S's onInvalidate hook fired (0/1)
    up,            \* upstream message in flight toward S, or NONE
    down,          \* down-cascade message emitted by S, or NONE
    started, done

vars == <<upKind, sCache, sStatus, dCache, dInvalidated, sOnInvalidate,
          up, down, started, done>>

TypeOK ==
  /\ upKind \in UpMsgs
  /\ sCache \in {InitVal, SENTINEL}
  /\ sStatus \in {"settled", "sentinel", "terminated"}
  /\ dCache \in {InitVal, SENTINEL}
  /\ dInvalidated \in BOOLEAN
  /\ sOnInvalidate \in 0..1
  /\ up \in UpMsgs \cup {NONE}
  /\ down \in {"INVALIDATE", NONE}
  /\ started \in BOOLEAN
  /\ done \in BOOLEAN

Init ==
  /\ upKind \in UpMsgs          \* TLC explores every kind
  /\ sCache = InitVal
  /\ sStatus = "settled"
  /\ dCache = InitVal
  /\ dInvalidated = FALSE
  /\ sOnInvalidate = 0
  /\ up = NONE
  /\ down = NONE
  /\ started = FALSE
  /\ done = FALSE

\* D originates ctx.up([upKind]); intermediates forward only, so it arrives at
\* the terminus S as `up`.
Originate ==
  /\ ~started
  /\ started' = TRUE
  /\ up' = upKind
  /\ UNCHANGED <<upKind, sCache, sStatus, dCache, dInvalidated, sOnInvalidate, down, done>>

\* Terminus rule (R-up-at-source), INVALIDATE branch: honor the request.
AtSourceInvalidate ==
  /\ up = "INVALIDATE"
  /\ sCache'        = SENTINEL
  /\ sStatus'       = "sentinel"
  /\ sOnInvalidate' = 1
  /\ down'          = "INVALIDATE"
  /\ up'            = NONE
  /\ UNCHANGED <<upKind, dCache, dInvalidated, started, done>>

\* Terminus rule, DIRTY / TEARDOWN branch: drop (no self-action, no down-cascade).
AtSourceDrop ==
  /\ up \in {"DIRTY", "TEARDOWN"}
  /\ up' = NONE
  /\ UNCHANGED <<upKind, sCache, sStatus, dCache, dInvalidated, sOnInvalidate, down, started, done>>

\* The honored INVALIDATE cascades down and clears the downstream cone (D).
DownInvalidate ==
  /\ down = "INVALIDATE"
  /\ dCache'       = SENTINEL
  /\ dInvalidated' = TRUE
  /\ down'         = NONE
  /\ UNCHANGED <<upKind, sCache, sStatus, sOnInvalidate, up, started, done>>

Finish ==
  /\ started
  /\ up = NONE
  /\ down = NONE
  /\ ~done
  /\ done' = TRUE
  /\ UNCHANGED <<upKind, sCache, sStatus, dCache, dInvalidated, sOnInvalidate, up, down, started>>

Next ==
  \/ Originate
  \/ AtSourceInvalidate
  \/ AtSourceDrop
  \/ DownInvalidate
  \/ Finish

Spec == Init /\ [][Next]_vars

----------------------------------------------------------------------------
(*                             INVARIANTS                                 *)

\* INVALIDATE-up is HONORED: source cleared + onInvalidate fired + down-cascade clears D.
InvalidateHonored ==
  (upKind = "INVALIDATE" /\ done) =>
     (sCache = SENTINEL /\ sStatus = "sentinel" /\ sOnInvalidate = 1
        /\ dInvalidated /\ dCache = SENTINEL)

\* DIRTY-up is DROPPED: source untouched, no down-effect (no wedge).
DirtyDropped ==
  (upKind = "DIRTY" /\ done) =>
     (sCache = InitVal /\ sStatus = "settled" /\ sOnInvalidate = 0
        /\ ~dInvalidated /\ dCache = InitVal)

\* TEARDOWN-up is DROPPED: source not terminated, no down-effect.
TeardownDropped ==
  (upKind = "TEARDOWN" /\ done) =>
     (sStatus = "settled" /\ ~dInvalidated /\ dCache = InitVal)

\* A dropped kind never produces a down-cascade (load-bearing: make AtSourceDrop
\* emit `down` and this trips).
DropNoDownCascade ==
  (upKind \in {"DIRTY", "TEARDOWN"}) => (down = NONE /\ ~dInvalidated)
=============================================================================
