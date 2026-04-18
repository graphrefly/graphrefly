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
| [`wave_protocol.tla`](wave_protocol.tla) | The spec itself — state, actions, invariants. Topology-agnostic; defaults to a 4-node diamond via the `Compute` operator. |
| [`wave_protocol_MC.tla`](wave_protocol_MC.tla) | Model-checking entry point. Pins concrete topology / alphabet / bounds (TLC `.cfg` can't express tuple-literal sets). |
| [`wave_protocol.cfg`](wave_protocol.cfg) | TLC config — names the spec, the constant substitutions, and the invariants to check. |

## The 7 TLC invariants

Each corresponds 1-1 to a [fast-check property](../../graphrefly-ts/src/__tests__/properties/_invariants.ts). Fast-check invariants 8 and 9 (`throw-recovery-consistency` and `subscribe-unsubscribe-reentry`) are intentionally not modeled here — they concern JS-level exception handling and multiple-subscriber registration, which aren't protocol-observable in this spec.

| # | TLA+ name | Description |
|---|---|---|
| 1 | `NoDataWithoutDirty` | Every DATA/RESOLVED at a sink is preceded by an unmatched DIRTY. |
| 2 | `BalancedWaves` | When all queues drain, DIRTY count = settlement count at every sink. |
| 3 | `TerminalAbsorbing` | After COMPLETE/ERROR, no further DIRTY/DATA/RESOLVED. |
| 4 | `DiamondConvergence` | Fan-in settlements bounded by source emits — no 2× per dep edge. |
| 5 | `EqualsFaithful` | Every source emit yields exactly one settlement (never silent). |
| 6 | `VersionPerChange` | Source `version` = count of DATA in its self-observed trace. |
| 7 | `StartHandshakeValid` | After a `SubscribeSink` action, `handshake[sid]` is `[[START],[DATA]]` (source), `[[START],[DIRTY],[DATA]]` (derived), or `[[START],[COMPLETE]]` (terminated). |

## Running TLC

### One-shot (CLI, matches the authoring workflow)

```bash
# Requires the TLA+ Toolbox installed — ships tla2tools.jar:
TLA_JAR="/Applications/TLA+ Toolbox.app/Contents/Eclipse/tla2tools.jar"

cd ~/src/graphrefly/formal
java -XX:+UseParallelGC -cp "$TLA_JAR" tlc2.TLC \
    -config wave_protocol.cfg wave_protocol_MC
```

Expected output (success):

```
Model checking completed. No error has been found.
  Estimates of the probability that TLC did not check all reachable states
  calculated (optimistic):  val = …(very small)…
NNNN states generated, NNNN distinct states found, 0 states left on queue.
```

Default model runs in ~4 seconds and explores ~77K distinct states (3 emits
over a 3-value alphabet on a 4-node diamond, with subscribe-handshake
actions per sink **and** per-source batch-coalesced multi-emit actions via
the `BatchEmitMulti` action + `BatchSeqs` constant).

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
- Message protocol (START, DIRTY, DATA, RESOLVED, COMPLETE, ERROR)
- Per-node cache, status, version, dirtyMask
- Per-edge FIFO message queues with tier-ordered delivery
- Equals-substitution at the source and at derived recomputes
- Diamond fan-in with bitmask-style dep tracking
- Terminal propagation
- Subscribe handshake per sink (§2.2) — source, derived, and terminated variants

**Not covered (out of scope by design — compose on top):**
- Operators (`map`, `filter`, `switchMap`, …)
- Sugar constructors, sources, patterns layer
- Persistence, versioning-V1, content-addressed cids

**Batch coalescing is now modeled** via the `BatchEmitMulti(src, vs)`
action (added 2026-04-17 alongside the Bug 2 fix in `graphrefly-ts`).
A batch of K emits to the same source enqueues ONE coalesced bundle per
child edge: `<<K DIRTYs, K DATA/RESOLVED>>` (tier-sorted, equals-checked
per-emit against the running cache). `DeliverDirty` / `DeliverSettle`
consume the same-tier prefix atomically, matching the runtime's
"one sink() call per tier group, fn runs once" post-Bug-1-fix behaviour.
TLC verifies the 7 invariants hold under this model at 3 batched emits
over a 3-value alphabet — 77K distinct states, no counter-examples.

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
