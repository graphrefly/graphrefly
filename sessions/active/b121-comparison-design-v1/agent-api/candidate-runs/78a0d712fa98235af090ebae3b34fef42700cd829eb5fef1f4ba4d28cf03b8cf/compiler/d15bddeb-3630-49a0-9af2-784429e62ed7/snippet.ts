import type { DataIssue, DataResult } from "@graphrefly/ts/core";

/**
 * Passive collection of DATA-level payload facts (D184).
 *
 * This helper only reads the supplied payloads. It performs no subscription,
 * transport, retry or graph mutation, and it never invents an error value.
 */
export function collectBusinessResults<T>(
	results: readonly DataResult<T>[],
): { values: readonly T[]; issues: readonly DataIssue[] } {
	const values: T[] = [];
	const issues: DataIssue[] = [];

	for (const result of results) {
		if (result.kind === "ok") {
			// Retain the value from every ok result, even when it carries issues.
			values.push(result.value);
			if (result.issues !== undefined) {
				for (const issue of result.issues) issues.push(issue);
			}
		} else {
			// Primary error first, then that result's additional issues.
			issues.push(result.error);
			if (result.issues !== undefined) {
				for (const issue of result.issues) issues.push(issue);
			}
		}
	}

	return { values, issues };
}
