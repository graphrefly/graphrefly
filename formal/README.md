# GraphReFly formal specification

This directory contains the TLA+ formal specification of the GraphReFly
wave protocol — the message protocol defined in [`GRAPHREFLY-SPEC.md`](../GRAPHREFLY-SPEC.md) § 1.

TLA+ provides **exhaustive model checking** over bounded instances: TLC
enumerates every reachable state sequence of the protocol and verifies
each invariant holds. Counter-examples are concrete traces that show how
an invariant was violated — when one appears, port it to a new
[fast-check property](../../graphrefly-ts/src/__tests__/properties/_invariants.ts)
so the regression is covered in both layers.

## Files

| File | Role |
|---|---|
| [`wave_protocol.tla`](wave_protocol.tla) | The spec itself — state, actions, invariants. Topology-agnostic; defaults to a 4-node diamond via the `Compute` operator. Parametric over `GapAwareActivation` (bool), `SinkNestedEmits` (set of nested-emit triples), `LockIds` (pause lockset domain), `Pausable` (per-node mode), `ResubscribableNodes` (subset), `MaxPauseActions` (bound). |
| [`wave_protocol_MC.tla`](wave_protocol_MC.tla) + [`wave_protocol.cfg`](wave_protocol.cfg) | **Clean model.** `GapAwareActivation = FALSE`, `SinkNestedEmits = {}`, pause axis off (`LockIds = {}`). All invariants hold. |
| [`wave_protocol_gap_MC.tla`](wave_protocol_gap_MC.tla) + [`wave_protocol_gap.cfg`](wave_protocol_gap.cfg) | **Substrate-faithful model for item 3.** `GapAwareActivation = TRUE` — multi-parent derived handshake synthesizes the real substrate's `<START, DIRTY, RESOLVED, DIRTY, DATA>` shape. `MultiDepHandshakeClean` FAILS with counter-example — matches the bug. |
| [`wave_protocol_nested_MC.tla`](wave_protocol_nested_MC.tla) + [`wave_protocol_nested.cfg`](wave_protocol_nested.cfg) | **Nested-drain regression guard for item 2.** `SinkNestedEmits = {<<B, A, 2>>}` models a sink callback running `batch(() => A.emit(2))`. `NestedDrainPeerConsistency` holds — tier ordering prevents §32-class peer-read glitch in the simple 3-node topology. |
| [`wave_protocol_pause_MC.tla`](wave_protocol_pause_MC.tla) + [`wave_protocol_pause.cfg`](wave_protocol_pause.cfg) | **§2.6 PAUSE/RESUME multi-pauser axis (added 2026-04-23).** 3-node linear chain, `Pausable = "on"` everywhere, `LockIds = {10, 11}`, `MaxPauseActions = 3`. Exhaustive coverage of tier-2 PAUSE/RESUME propagation, multi-pauser lockset tracking, and unknown-lockId RESUME swallow at intermediate nodes. All 13 invariants hold. |
| [`wave_protocol_bufferall_MC.tla`](wave_protocol_bufferall_MC.tla) + [`wave_protocol_bufferall.cfg`](wave_protocol_bufferall.cfg) | **§2.6 bufferAll axis (added 2026-04-23).** 3-node linear chain, `Pausable = "resumeAll"` everywhere, `LockIds = {10}`, `MaxPauseActions = 2`. Verifies tier-3 capture into `pauseBuffer` during pause, drain-then-forward ordering on final-lock RESUME, and the new `BufferImpliesLockedAndResumeAll` / `BufferHoldsOnlyDeferredTiers` structural invariants. All 13 invariants hold. |
| [`wave_protocol_resubscribe_MC.tla`](wave_protocol_resubscribe_MC.tla) + [`wave_protocol_resubscribe.cfg`](wave_protocol_resubscribe.cfg) | **§2.6 resubscribable-lifecycle axis (added 2026-04-23).** 2-node chain `A → B`, `ResubscribableNodes = {B}`, pause axis enabled so lock-leak-across-terminal scenarios are exercised. Verifies `TerminalClearsPauseState` (hard-reset clears locks/buffer) and `ResubscribeYieldsCleanState` (post-reset state matches fresh-init). All 13 invariants hold. |

## The 13 TLC invariants

Invariants #1–#7 correspond 1-1 to [fast-check properties](../../graphrefly-ts/src/__tests__/properties/_invariants.ts). Fast-check invariants 8 and 9 (`throw-recovery-consistency` and `subscribe-unsubscribe-reentry`) concern JS-level exception handling and multiple-subscriber registration, not protocol-observable. Invariants #8 `MultiDepHandshakeClean` and #9 `NestedDrainPeerConsistency` are TLA+-side extensions added 2026-04-23 to model item 3's activation-sequence gap and item 2's nested-drain class. Invariants #10–#13 are the §2.6 PAUSE/RESUME + resubscribable-lifecycle extensions added 2026-04-23 alongside fast-check invariants #10–#12 (the TLA+ side adds `BufferHoldsOnlyDeferredTiers` as a cheap structural fourth not mirrored in fast-check — it's subsumed by the three fast-check pause properties).

| # | TLA+ name | Status | Description |
|---|---|---|---|
| 1 | `NoDataWithoutDirty` | clean ✓ / gap ✓ / nested ✓ / pause ✓ / bufferall ✓ / resub ✓ | Every DATA/RESOLVED at a sink is preceded by an unmatched DIRTY. |
| 2 | `BalancedWaves` | clean ✓ / gap ✓ / nested ✓ / pause ✓ / bufferall ✓ / resub ✓ | When all queues AND all pauseBuffers drain, DIRTY count = settlement count at every pre-terminal sink. **Weakened 2026-04-23**: precondition now `AllQueuesEmpty /\ AllBuffersEmpty` (upstream buffers can hold a downstream's owed settlement); terminated sinks are excluded because §2.6 hard-resets discard in-flight DATA. In legacy MCs (pause axis off) buffers are always empty, so the precondition reduces to the original. |
| 3 | `TerminalAbsorbing` | clean ✓ / gap ✓ / nested ✓ / pause ✓ / bufferall ✓ / resub ✓ | After COMPLETE/ERROR, no further DIRTY/DATA/RESOLVED. |
| 4 | `DiamondConvergence` | clean ✓ / gap ✓ / nested ✓ / pause ✓ / bufferall ✓ / resub ✓ | Fan-in settlements bounded by source emits — no 2× per dep edge. Now counts buffered settlements too (via the extended `SettlementCount` helper). |
| 5 | `EqualsFaithful` | clean ✓ / gap ✓ / **n/a** (nested) / pause ✓ / bufferall ✓ / resub ✓ | Every source emit yields exactly one settlement (observed in trace OR parked in pauseBuffer). **Single-source-implicit**: its reference to the global `emitCount` makes it break on multi-source topologies. Excluded from the nested MC (which has two sources). Tracked as I4 in `docs/optimizations.md` — generalize with a per-source emit counter. **Terminated sources excluded 2026-04-23** because §2.6 hard-resets discard buffered settlements. |
| 6 | `VersionPerChange` | clean ✓ / gap ✓ / nested ✓ / pause ✓ / bufferall ✓ / resub ✓ | Source `version` = count of DATA in its trace + count of DATA in its pauseBuffer (pre-terminal only). |
| 7 | `StartHandshakeValid` | clean ✓ / gap ✓ / nested ✓ / pause ✓ / bufferall ✓ / resub ✓ | `handshake[sid]` matches one of: source `<START,DATA>`, single-parent derived `<START,DIRTY,DATA>`, multi-parent derived (clean `<START,DIRTY,DATA>` OR gap-aware `<START,DIRTY,RESOLVED,DIRTY,DATA>`), terminated `<START,COMPLETE>`. **Loosened 2026-04-23** to accept the gap-aware shape, matching fast-check invariant #7. |
| 8 | `MultiDepHandshakeClean` | clean ✓ / **gap ✗** / nested ✓ / pause ✓ / bufferall ✓ / resub ✓ | No RESOLVED between first DIRTY and DATA in a multi-parent derived's handshake. Fails under `GapAwareActivation = TRUE` — TLA+-side mirror of fast-check #10. Counter-example: any multi-parent derived subscribe in 2 steps. |
| 9 | `NestedDrainPeerConsistency` | clean ✓ / gap ✓ / nested ✓ / pause ✓ / bufferall ✓ / resub ✓ | After all queues AND buffers AND locks drain, every multi-parent derived's recorded DATA matches `Compute(n, finalCache)`. Mirror of fast-check #11 — regression guard against any relaxation of tier ordering in `DeliverSettle`. |
| 10 | `TerminalClearsPauseState` | clean ✓ / gap ✓ / nested ✓ / pause ✓ / bufferall ✓ / resub ✓ | Non-resubscribable terminated nodes MUST have empty `pauseLocks` and `pauseBuffer`. Catches the lock-leak-across-terminal class the spec §2.6 "Teardown" warning targets. |
| 11 | `BufferImpliesLockedAndResumeAll` | clean ✓ / gap ✓ / nested ✓ / pause ✓ / bufferall ✓ / resub ✓ | `pauseBuffer[n] ≠ <<>>` implies `pauseLocks[n] ≠ {}` AND `Pausable[n] = "resumeAll"`. Structural invariant — catches buffer leaks into wrong modes or survival past final-lock release. |
| 12 | `BufferHoldsOnlyDeferredTiers` | clean ✓ / gap ✓ / nested ✓ / pause ✓ / bufferall ✓ / resub ✓ | Every message in `pauseBuffer[n]` has `type ∈ {DATA, RESOLVED, COMPLETE, ERROR}` (tier 3/4 only). Catches accidental capture of control-plane messages (DIRTY, PAUSE, RESUME, TEARDOWN) into the buffer. |
| 13 | `ResubscribeYieldsCleanState` | clean ✓ / gap ✓ / nested ✓ / pause ✓ / bufferall ✓ / resub ✓ | Post-`Resubscribe` state matches fresh-init: `pauseLocks = {}`, `pauseBuffer = <<>>`, `dirtyMask = {}`, `handshake = <<>>`, `trace = <<>>`. Exercised actively only by `wave_protocol_resubscribe_MC` (other MCs have `ResubscribableNodes = {}` → vacuous). |

## Running TLC

### One-shot (CLI, matches the authoring workflow)

```bash
# Requires the TLA+ Toolbox installed — ships tla2tools.jar:
TLA_JAR="/Applications/TLA+ Toolbox.app/Contents/Eclipse/tla2tools.jar"

cd ~/src/graphrefly/formal

# Clean model — all invariants must hold.
java -XX:+UseParallelGC -cp "$TLA_JAR" tlc2.TLC \
    -config wave_protocol.cfg wave_protocol_MC

# Substrate-faithful (item 3) — MultiDepHandshakeClean MUST fail.
# Flipping this green is the TLA+-side gate for the substrate fix.
java -XX:+UseParallelGC -cp "$TLA_JAR" tlc2.TLC \
    -config wave_protocol_gap.cfg wave_protocol_gap_MC

# Nested-drain regression guard (item 2) — all invariants must hold.
java -XX:+UseParallelGC -cp "$TLA_JAR" tlc2.TLC \
    -config wave_protocol_nested.cfg wave_protocol_nested_MC

# §2.6 PAUSE/RESUME axes (added 2026-04-23) — all invariants must hold.
java -XX:+UseParallelGC -cp "$TLA_JAR" tlc2.TLC \
    -config wave_protocol_pause.cfg wave_protocol_pause_MC
java -XX:+UseParallelGC -cp "$TLA_JAR" tlc2.TLC \
    -config wave_protocol_bufferall.cfg wave_protocol_bufferall_MC
java -XX:+UseParallelGC -cp "$TLA_JAR" tlc2.TLC \
    -config wave_protocol_resubscribe.cfg wave_protocol_resubscribe_MC
```

Expected output (success):

```
Model checking completed. No error has been found.
  Estimates of the probability that TLC did not check all reachable states
  calculated (optimistic):  val = …(very small)…
NNNN states generated, NNNN distinct states found, 0 states left on queue.
```

Approximate state-space sizes (2026-04-23):

| MC | Distinct states | Runtime |
|----|-----------------|---------|
| `wave_protocol_MC` (clean) | ~77K | ~5s |
| `wave_protocol_gap_MC` (expected fail) | ~10 (counter-example found immediately) | <1s |
| `wave_protocol_nested_MC` | ~125K | ~6s |
| `wave_protocol_pause_MC` | ~23K | ~1s |
| `wave_protocol_bufferall_MC` | ~11K | ~1s |
| `wave_protocol_resubscribe_MC` | ~13K | ~1s |

The pause-axis MCs use smaller topologies (3-node chain, 2-node chain for resubscribe) because pause invariants are per-node, and combinatorial interleavings of Pause/Resume × emit × edges × multiple lockIds blow up the state space on the 4-node diamond (a probe with `MaxPauseActions = 4` on the diamond exceeded 8M distinct states in 10 minutes and still had 1M+ on queue). Topology coverage of the pause invariants is orthogonal to pause-axis coverage.

### In the TLA+ Toolbox GUI

1. Open `wave_protocol.tla` in the Toolbox.
2. `File` → `Open Spec` → point at this directory.
3. `TLC Model Checker` → `New Model` → point at `wave_protocol.cfg`.
4. Run. Counter-examples appear as clickable trace states.

### Deeper probes

Edit `wave_protocol_MC.tla`:

```tla
ValuesMC      == {0, 1, 2, 3}   \* larger alphabet
MaxEmitsMC    == 4              \* longer emit sequences
```

State space grows roughly as `|Values|^MaxEmits × topology` — keep it
under ~1M states for sub-minute runs. Probed up to `MaxEmits = 4` +
`|Values| = 3` (~26K distinct states) during authoring; all invariants
hold.

## Scope — what the spec covers and what it doesn't

**Covered:**
- Message protocol (START, DIRTY, DATA, RESOLVED, COMPLETE, ERROR, PAUSE, RESUME)
- Per-node cache, status, version, dirtyMask
- Per-edge FIFO message queues with tier-ordered delivery
- Equals-substitution at the source and at derived recomputes
- Diamond fan-in with bitmask-style dep tracking
- Terminal propagation
- Subscribe handshake per sink (§2.2) — source, derived, and terminated variants
- **§2.6 PAUSE/RESUME lock semantics (added 2026-04-23)** — `pauseLocks` as a per-node set keyed by opaque `lockId`, tier-2 propagation via `DeliverPauseResume`, unknown-lockId RESUME swallowing, `Pausable ∈ {"off", "on", "resumeAll"}` per-node modes.
- **§2.6 bufferAll mode (added 2026-04-23)** — `pauseBuffer` capture of outgoing tier-3/4 during pause, atomic drain-then-forward on final-lock RESUME, tier-1/2/5 synchronous dispatch while paused.
- **§2.6 resubscribable lifecycle (added 2026-04-23)** — `Resubscribe(sid)` action clears lifecycle-owned state so a new subscribe on a resubscribable terminated node starts fresh.

**Not covered (out of scope by design — compose on top):**
- Operators (`map`, `filter`, `switchMap`, …)
- Sugar constructors, sources, patterns layer
- Persistence, versioning-V1, content-addressed cids
- INVALIDATE / RESET propagation (tracked as a future MC axis)
- Meta companion TEARDOWN fan-out (§2.3, future MC axis)
- Mount / unmount topology (future MC axis)
- Nested batch drain interleavings (partial coverage via `BatchEmitMulti`; deeper nested-batch modeling deferred)

**Batch coalescing is now modeled** via the `BatchEmitMulti(src, vs)`
action (added 2026-04-17 alongside the Bug 2 fix in `graphrefly-ts`).
A batch of K emits to the same source enqueues ONE coalesced bundle per
child edge: `<<K DIRTYs, K DATA/RESOLVED>>` (tier-sorted, equals-checked
per-emit against the running cache). `DeliverDirty` / `DeliverSettle`
consume the same-tier prefix atomically, matching the runtime's
"one sink() call per tier group, fn runs once" post-Bug-1-fix behaviour.
TLC verifies the 7 invariants hold under this model at 3 batched emits
over a 3-value alphabet — 77K distinct states, no counter-examples.

**PAUSE/RESUME + resubscribable lifecycle is now modeled** via the
`Pause` / `Resume` / `DeliverPauseResume` / `Resubscribe` actions (added
2026-04-23). Each node carries `pauseLocks` (SUBSET LockIds) and
`pauseBuffer` (Seq of messages). The bufferAll mode diverts outgoing
tier-3 settlements from `Emit` / `BatchEmitMulti` / `SinkNestedEmit` /
`DeliverSettle` into the buffer when `Pausable[n] = "resumeAll"` and
`pauseLocks[n] # {}`. On final-lock RESUME, the buffer drains atomically
to child queues BEFORE the RESUME forwards — per-edge FIFO then
guarantees downstream sinks observe buffered settlements strictly before
the RESUME. `Terminate` / `DeliverTerminal` hard-reset pauseLocks and
pauseBuffer per §2.6 "Teardown". `Resubscribe` clears lifecycle-owned
state so a new subscribe on a resubscribable terminated node cannot
inherit a stale lock. Four new invariants (#10–#13) encode the §2.6
structural contracts; three corresponding fast-check properties
(#10 `pause-multi-pauser`, #11 `buffer-all-replay-ordering`,
#12 `resubscribe-clears-pause-state`) mirror the observable behaviour.

## Modeling simplifications worth knowing

1. **Tier ordering is enforced globally.** Per GRAPHREFLY-SPEC § 1.3
   invariant 7, DIRTY (tier 1) is immediate and DATA/RESOLVED (tier 3)
   is deferred. The spec enforces this with `NoDirtyAnywhere` guards on
   `DeliverSettle`, and `NoSettleAnywhere` guards on `DeliverTerminal`.
   Without these guards TLC finds "glitches" that are artifacts of the
   interleaving model, not real runtime behaviour.

2. **`trace[n]` records self-emissions, not incoming messages.** This
   matches what an external `subscribe(n, cb)` observer would see in
   the runtime — the fast-check harness does the same.

3. **Batch semantics are not modeled.** The fast-check harness already
   surfaces a Tier-B finding for multi-emit batches at the fan-in
   (K + 1 settlements instead of ≤ K); see
   [graphrefly-ts/docs/optimizations.md](../../graphrefly-ts/docs/optimizations.md)
   for the investigation hint. Adding batch-frame modeling to this
   spec is a future step if that finding evolves.

## When an invariant fails

TLC prints a minimal counter-example trace. Example skeleton:

```
Error: Invariant DiamondConvergence is violated.
Error: The behavior up to this point is:
State 1: <Initial predicate>
  /\ cache = [A |-> 0, ..., D |-> 0]
  /\ ...
State 2: <Emit line NN>
  /\ ...
State 3: ...
```

To port the counter-example to fast-check:

1. Identify the offending sequence of `Emit` / `DeliverDirty` /
   `DeliverSettle` actions.
2. Encode the same sequence as a fast-check `Event[]` in
   [`graphrefly-ts/src/__tests__/properties/_invariants.ts`](../../graphrefly-ts/src/__tests__/properties/_invariants.ts).
3. Wrap it in a new invariant (or tighten an existing one) that would
   trip on the same property violation.
4. Run the fast-check suite. It should fail in the same way.
5. Fix the substrate. Both TLC and fast-check should go green.

## Adding a new invariant

1. Add the operator to `wave_protocol.tla` under the invariants block.
2. Reference it in the `INVARIANTS` list in `wave_protocol.cfg`.
3. Add the fast-check mirror to
   [`_invariants.ts`](../../graphrefly-ts/src/__tests__/properties/_invariants.ts)
   — keep the catalog indices aligned so the two checkers evolve
   together.

## References

- [`../GRAPHREFLY-SPEC.md`](../GRAPHREFLY-SPEC.md) — the prose spec.
- [`graphrefly-ts/src/__tests__/properties/`](../../graphrefly-ts/src/__tests__/properties/) — the fast-check harness.
- `graphrefly-ts/archive/docs/SESSION-rigor-infrastructure-plan.md` §
  "Project 3" — strategic motivation for this spec.
- [Leslie Lamport's TLA+ home page](https://lamport.azurewebsites.net/tla/tla.html) — language reference.
