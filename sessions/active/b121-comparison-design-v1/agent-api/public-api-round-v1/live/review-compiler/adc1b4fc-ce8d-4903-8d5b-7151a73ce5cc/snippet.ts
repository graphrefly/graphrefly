import { reachable } from "@graphrefly/ts/graph";
import type { DescribeSnapshot, ReachableResult } from "@graphrefly/ts/graph";

/**
 * Read-only downstream dependency reachability report over a caller-supplied
 * DescribeSnapshot. Delegates all traversal to the public `reachable` helper
 * (direction "downstream", withDetail: true) and returns its actual metadata.
 */
export function downstreamReport(
	snapshot: DescribeSnapshot,
	start: string,
	maxDepth: number,
): { paths: readonly string[]; depths: Readonly<Record<string, number>>; truncated: boolean } {
	const result: ReachableResult = reachable(snapshot, start, "downstream", {
		maxDepth,
		withDetail: true,
	});
	return {
		paths: result.paths,
		depths: result.depths,
		truncated: result.truncated,
	};
}
