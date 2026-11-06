# B142 Canvas validation follow-up

Date: 2026-11-05. Owner: `graphrefly:B142`.

The [initial evidence](2026-11-05-canvas.md) remains unchanged, including the
failing full lint attempt and later passing test/typecheck/build checks.

## Existing validator drift

A bounded diagnostic changed only the obsolete global-sequencer field/path check
to the existing federatedWorkLocatorRef value, without editing program-state.
`node scripts/check-program-state.mjs` then still failed at the candidate status:
`canvas-executable-truth-baseline-v1` is now a superseded locator, while the
validator hardcodes the former design-needed candidate body. It also expects the
Data Agent candidate to have its old eligible-after-current-candidate status,
where the existing record now says planned. The root workspace authority gate
accepts the federated records, but the local validator still encodes the old
sequencing layout.

A pointer-only patch does not repair that ownership/schema drift. The diagnostic
edit was removed byte-for-byte; check-program-state.mjs and program-state.json
both match the pre-task HEAD. No state, status, cursor, order or validation rule
is changed as part of this documentation batch. A complete validator repair must
preserve the existing owner/cursor versus roadmap distinction; this task does not
silently select that implementation under an editorial approval.

## Verification wording clarification

The initial report's focused Biome command included the changed Markdown paths
and the test as arguments. Biome processed one supported file, the TypeScript
test; Markdown was checked separately by local reference/editorial review.
This is not a claim that Biome parsed the Markdown bodies.

## Final state

Canvas tests, typecheck, build, dashboard and the changed test's Biome check pass.
Full lint remains failed at the unchanged legacy program-state validator.
The initial failure, bounded diagnostic and restoration are one work history;
no replacement decision or completion claim is created.
