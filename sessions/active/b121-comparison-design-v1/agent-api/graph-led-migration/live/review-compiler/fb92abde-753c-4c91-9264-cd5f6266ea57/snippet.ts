import type { DataIssue, DataResult } from "../../../packages/ts/src/data/index.js";

export interface CollectedBusinessResults<T> {
	readonly values: readonly T[];
	readonly issues: readonly DataIssue[];
}

/**
 * Collect the business payload facts carried by a readonly array of DATA-level
 * results, preserving input order, object identity and duplicates.
 *
 * - Every `ok` result contributes its `value`, even when it also carries issues.
 * - Every `error` result contributes its primary `error` first, then that
 *   result's additional `issues` (if present).
 * - Every `ok` result contributes its additional `issues` (if present).
 *
 * This is a pure payload projection: it does not mutate the inputs, does not
 * invent an error value, and performs no subscription, transport or graph
 * mutation. A DATA-level `error` payload (or `retryable: true` on an issue) is
 * an ordinary payload fact, not a protocol ERROR, not a run terminator and not
 * an authorization to retry.
 */
export function collectBusinessResults<T>(
	results: readonly DataResult<T>[],
): CollectedBusinessResults<T> {
	const values: T[] = [];
	const issues: DataIssue[] = [];

	for (const result of results) {
		if (result.kind === "ok") {
			values.push(result.value);
			if (result.issues !== undefined) {
				for (const issue of result.issues) issues.push(issue);
			}
		} else {
			issues.push(result.error);
			if (result.issues !== undefined) {
				for (const issue of result.issues) issues.push(issue);
			}
		}
	}

	return { values, issues };
}
