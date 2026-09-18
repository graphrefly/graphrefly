For A→B, B→A, B→C: depth1 returns [B], {B:1}, true; depth0 returns [], {}, true; missing returns [], {}, false. Origin A is excluded even on cycles. The flag is conservative: with only A↔B and depth1 it is still true because boundary B has adjacency, though A was already seen. This is a snapshot relationship report, not proof of execution. Source: packages/ts/src/graph/diagnostics.ts (reachable).

Source line references: packages/ts/src/graph/diagnostics.ts:215–266 (reachable implementation and conservative truncation).
