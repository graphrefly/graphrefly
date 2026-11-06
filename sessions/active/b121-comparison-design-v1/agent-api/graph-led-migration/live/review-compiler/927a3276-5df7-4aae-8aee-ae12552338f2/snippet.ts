import type { NodeVersion } from "@graphrefly/ts/core";

/**
 * Report variants required by the consumer contract.
 *
 * `disabled` mirrors an absent (undefined) library version.
 * `counter` mirrors the V0 library version (level 0).
 * `content` mirrors the V1 library version (level 1), preserving the
 * supplied counter, cid and prev exactly as the library reports them.
 */
export type VersionReport =
	| { kind: "disabled" }
	| { kind: "counter"; counter: number }
	| { kind: "content"; counter: number; cid: string; prev: string | null };

/**
 * Summarize actual library NodeVersion values, one report per input, in order.
 *
 * The library union is discriminated by `level` (0 = V0, 1 = V1); see
 * packages/ts/src/node/versioning.ts lines 27-39. `undefined` means versioning
 * is disabled (createNodeVersion returns undefined when the resolved policy is
 * not enabled, versioning.ts lines 113-117).
 *
 * No hashing, node comparison or identifier manufacture happens here: every
 * counter, cid and prev is copied verbatim from the supplied version, so
 * counter 0 and prev null survive unchanged.
 */
export function summarizeVersions(
	versions: readonly (NodeVersion | undefined)[],
): VersionReport[] {
	return versions.map((version): VersionReport => {
		if (version === undefined) {
			return { kind: "disabled" };
		}
		if (version.level === 0) {
			return { kind: "counter", counter: version.counter };
		}
		return {
			kind: "content",
			counter: version.counter,
			cid: version.cid,
			prev: version.prev,
		};
	});
}
