-------------------- MODULE wave_protocol_meta_teardown_MC --------------------
(*****************************************************************************
Package 7 exercise MC (added 2026-04-23 batch 3 QA round 2, item 2).

Purpose: make invariant coverage for `MetaCompanions` load-bearing. Default
MCs have `MetaCompanions = [n |-> {}]`, so `Teardown` is disabled and the
§2.3 meta-observes-TEARDOWN-pre-reset contract is unchecked.

Topology: 3-node chain A → B plus one meta companion M for A; B has its
own meta companion N (next-batch extension 2026-04-23 for DAG cascade).
  A (source, sink) — the parent being torn down
  └→ B (derived identity of A, sink)
  M (meta child of A, sink) — observes A's cache + status at TEARDOWN.
  N (meta child of B, sink) — observes B's cache + status at TEARDOWN
    cascade via `DeliverTeardown(A, B)`.

`MetaCompanions[A] = {M}`, `MetaCompanions[B] = {N}`. Flow: A.Emit(1)
advances cache[A] and eventually cache[B] via DeliverSettle(A, B).
Teardown(A) records witness at M with A's pre-reset state, transitions
A to "terminated", AND enqueues TEARDOWN to B via <<A, B>> queue.
DeliverTeardown(A, B) then consumes the TEARDOWN, records witness at N
with B's pre-reset state, and transitions B to "terminated".

The invariant `MetaTeardownObservedPreReset` verifies that BOTH M and N
observe their respective parent PRE-reset (status in {"settled","dirty"},
cache in `Values`). This exercises the full §2.3 cascade, not just the
one-hop origin.

State-space bounds: 4 nodes (A, B, M, N), 2 values, MaxEmits = 1,
MaxTeardowns = 1 — kept tight.

Verification note: reordering `DeliverTeardown(p, c)` to transition c's
status BEFORE recording the witness at c's meta children trips
`MetaTeardownObservedPreReset` immediately.
*****************************************************************************)

EXTENDS wave_protocol

\* M exists as a node but is NOT a DAG child of A — it's a meta companion.
\* The protocol primitives treat M like any other node (it has no parents,
\* no children in Edges), but `MetaCompanions[A] = {M}` wires it as a
\* meta observer.
NodeIdsMC     == {"A", "B", "M", "N"}
SourceIdsMC   == {"A"}
SinkIdsMC     == {"A", "B", "M", "N"}
EdgesMC       == {<<"A", "B">>}
ValuesMC      == {0, 1}
DefaultInitMC == 0
MaxEmitsMC    == 1

BatchSeqsMC   == {}

GapAwareActivationMC == FALSE

SinkNestedEmitsMC == {}
MaxNestedEmitsMC  == 0

LockIdsMC             == {}
PausableMC            == [n \in NodeIdsMC |-> "off"]
ResubscribableNodesMC == {}
MaxPauseActionsMC     == 0

UpOriginatorsMC   == {}
MaxUpActionsMC    == 0

ExtraSinksMC      == [n \in NodeIdsMC |-> 0]

ResetOnTeardownNodesMC == NodeIdsMC \ SourceIdsMC

AutoCompleteOnDepsCompleteMC == [n \in NodeIdsMC |-> TRUE]
AutoErrorOnDepsErrorMC       == [n \in NodeIdsMC |-> TRUE]

ReplayBufferSizeMC == [n \in NodeIdsMC |-> 0]
EqualsAbsorbsMC    == [n \in NodeIdsMC |-> TRUE]

\* Package 7 axis ON: M is A's meta companion. `Teardown(A)` records
\* witness at M with A's PRE-reset cache + status, then transitions A to
\* "terminated".
\* Next-batch D extension: A → M + B → N. TEARDOWN cascade from A to B
\* via `DeliverTeardown` exercises BOTH meta witnesses.
MetaCompanionsMC == [n \in NodeIdsMC |->
                        IF n = "A" THEN {"M"}
                        ELSE IF n = "B" THEN {"N"}
                        ELSE {}]
MaxTeardownsMC   == 1

InvalidateOriginatorsMC == {}
MaxInvalidatesMC        == 0
==============================================================================
