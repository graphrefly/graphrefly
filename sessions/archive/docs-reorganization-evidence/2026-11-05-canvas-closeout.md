# B142 Canvas maintenance and closeout

Date: 2026-11-05 (America/Los_Angeles). Owner: `graphrefly:B142`.
Status: verified closeout within the user-approved writable scope.

## Current authorization

The user authorized the remaining Canvas lint-validator repair and skill deduplication,
then B142 closeout, while preserving protocol and execution state and keeping Stack
read-only. This follows the original editorial delivery and its retained failed attempts.
The accepted closeout scope covers the eleven writable repositories; Stack remains an
explicit read-only exception rather than a claim that its README was shortened.
No new durable decision or execution-approval schema is introduced.

## Implementation plan and KEEP boundary

- Preserve all Canvas execution-state values; preserve roadmap/slice and decision bytes, root rule/model/conformance
  bodies, canonical .agents skill bytes, historical receipts and every other work row.
- Repair the local validator by reading the existing root work federation. The cursor's
  superseded CT-1 identity remains a locator; the roadmap retains the canonical work body.
  Keep local-v0 acceptance, D718/D769/D770, next-action and proof checks.
- Retain native skill discovery files and exact frontmatter in .claude/.agent. Forward
  bodies to .agents and link supporting resources. Keep OpenCode's distinct command aliases.
  Archive every original duplicate in TRASH with a hash and log entry before replacement.
- Register offline tooling tests and skill checks in the normal Canvas test/lint commands.
  Regeneration must refuse unarchived original bodies or copied resources.
- Run full Canvas tests/lint/types/build/dashboard, root authority/work/public-docs gates,
  reference checks and preservation checks before changing B142 completion.

| Input/state | Required observable outcome | Verification |
|---|---|---|
| Existing unchanged cursor and canonical CT-1 roadmap | Validation passes without mutation | Real fixture plus state digest |
| Missing work, replacement, acceptance or D770 boundary; premature activation | Validation fails | Negative tooling fixtures |
| Native discovery entry and old resource path | Same metadata and maintained resource bytes | Discovery/resource fixtures and all installed paths |
| Canonical metadata/resource edit | Check detects stale entry; sync updates adapters only | Regeneration fixture and idempotence |
| Reinstalled original or unknown resource | Fail before overwriting any original | Refusal/preservation fixtures |
| Duplicate copy moved | Retained bytes and mode match manifest; log line exists | Per-file archival check |

## Qualification sources and limits

Official documentation consulted on 2026-11-05:
[Claude skills](https://code.claude.com/docs/en/skills),
[OpenCode skills](https://opencode.ai/docs/skills/), and
[Antigravity skills](https://antigravity.google/docs/skills).
These describe native SKILL.md metadata and on-demand supporting content; OpenCode
and current Antigravity also discover .agents/skills directly. The adapters keep real
discovery files rather than relying on symlinked discovery directories.
Qualification is local discovery-contract, metadata, file/resource access and regeneration
verification. No LLM invocation, provider call or paid tool test is performed or claimed.

## Verification and completion

Canvas's final `pnpm test`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run build`
and `pnpm run dashboard:check` all passed (exit 0). Tests include 23 tooling cases,
Canvas 1310/1310, Workbench 6/6 and control-plane 271/271; live suites excluded by
the existing default command are not claimed. Root `authority:check`, `work:check`,
`test:authority` (40/40), dashboard --check, `docs:public:check` and
`authority:check:workspace` all passed again after archival.

[Exact gate results and log hashes](2026-11-05-canvas-closeout-gates.json),
[all 3454 original-file trash moves](2026-11-05-skill-trash-moves.json),
[15 unchanged bound history moves](2026-11-05-session-archive-moves.json) and the
[per-file Canvas trash log](../../../../graphrefly-canvas/TRASH-FILES.md) are the
retained receipts. No original file was deleted outright.

Actual qualification checked 174 real native discovery entries, 732 support links,
3280 resource leaf paths, all original archive hashes/modes and all trash-log rows.
All 1832 pre-existing canonical skill/OpenCode files retain their baseline hashes.
Regeneration is idempotent; edited bodies/metadata and unarchived reinstalled copies
are rejected rather than overwritten. Official-contract/file/resource qualification
is complete locally; live agent/model invocation is neither required nor claimed.

Independent reviews covered validator authority, resource/preservation edge cases
and verification gaps. They found the two issues in Review repairs; both are fixed,
covered by negative tests, and were rechecked with no remaining finding.

Other writable repositories retain the earlier verified runtime source/HEAD pairing;
this follow-up changes no sibling runtime. Stack remains byte-for-byte unchanged.
DS-17 changed in parallel and was never written by this task. All other foreign
work/session rows and root rule/model/conformance/decision bodies match the new
baseline. No branch switches, staged changes, commit, push or publication occurred.

## Suggested review order

1. [Validator](../../../../graphrefly-canvas/scripts/check-program-state.mjs) and
   [negative cases](../../../../graphrefly-canvas/scripts/check-program-state.test.mjs):
   canonical CT-1 versus historical locator, independent D718 gate and cursor proof.
2. [Forwarder maintenance](../../../../graphrefly-canvas/scripts/skill-forwarders.mjs)
   and [preservation fixtures](../../../../graphrefly-canvas/scripts/skill-forwarders.test.mjs):
   discovery metadata, shared resources, safe regeneration and refusal paths.
3. [Skill maintenance guide](../../../../graphrefly-canvas/docs/development.md#installed-skills)
   and the hash/log manifests above: exact ownership and recovery path.

B142 may close only for the eleven writable repositories under the current user
instruction. Stack is excluded from writes, not represented as reorganized.
Historical DS-1/B7 and unrelated protocol work remain outside B142's cleanup scope.
Canvas program/horizon/batch/proof/next values are unchanged by this documentation
and tooling work; B142 completion grants no product execution authority.

## Review repairs

Independent review found and the implementation repairs two issues: CT-1 remains
proposed pending the independent D718 successor review even after local-v0 closure;
and a generated marker alone is insufficient to overwrite a locally edited adapter.
The generator now verifies the complete generated shape and a discovery-metadata
checksum before regeneration. Counterexamples cover closed local-v0 plus planned/
in-progress/complete CT-1, appended instructions and locally edited metadata.

The first full lint reached Biome after the validator repair and exposed one
pre-existing long-array formatting error in program-state.json. The repair only
folds that array; all parsed state values and ordering are checked equal to the
saved original. No lifecycle, cursor, next action, approval, status or timestamp
value changes. This corrects the plan's initially stronger byte-preservation goal
for that one file; it does not weaken execution-state preservation.

## State-format receipt

Original state SHA-256: `7cec4db483f4fd3539b1ca1fb2f7224536e3d7580352ff55324303497aa2903a`.
Formatted state SHA-256: `75ef634091a22327bb783794f28332adc52e10967ff78f2a41c1b239c50ab4a2`.
The parsed objects are exactly equal, including array order and all lifecycle,
approval, timestamp, cursor and next-action fields. Only the long array layout changed.
