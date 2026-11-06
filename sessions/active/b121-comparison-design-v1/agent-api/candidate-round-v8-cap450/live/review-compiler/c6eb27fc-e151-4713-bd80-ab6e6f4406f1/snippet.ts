/**
 * B121 entry validation: validate-before-handoff for a FullCausalCapability.
 *
 * Consumer-private source imports, not published package subpaths. The caller
 * supplies the Graph, the FullCausalCapability, the expected CausalBinding and
 * the recipient callback; this module creates none of them.
 */
import type { Graph } from "../../packages/ts/src/graph/graph.js";
import {
	assertCausalCapabilities,
	type CausalBinding,
	type ExecutionCapability,
	type FullCausalCapability,
	type IdentityCapability,
	type RetainedEvidenceCapability,
} from "../../packages/ts/src/solutions/causal-occurrence/capabilities.js";

/** The three graded levels, delivered as the original issued handles. */
export interface CausalRecipient<T> {
	readonly identity: IdentityCapability<T>;
	readonly execution: ExecutionCapability<T>;
	readonly retained: RetainedEvidenceCapability<T>;
}

/**
 * Validate first, then hand off. `assertCausalCapabilities` is the only
 * admission gate: it rejects a structural copy (no WeakMap issuance record),
 * a capability issued by a different Graph, and a binding/epoch mismatch, and
 * it re-checks the lower-handle identity relationships. The recipient is
 * therefore never called on an invalid capability.
 */
export function handoffCausalCapabilities<T>(
	graph: Graph,
	capabilities: FullCausalCapability<T>,
	expected: CausalBinding,
	recipient: (levels: CausalRecipient<T>) => void,
): void {
	assertCausalCapabilities(graph, capabilities, expected);

	// Deliver the original references, not copies: identity is preserved because
	// execution.identity === identity and retained.execution === execution.
	const levels: CausalRecipient<T> = Object.freeze({
		identity: capabilities.identity,
		execution: capabilities.execution,
		retained: capabilities.retained,
	});

	recipient(levels);
}

/**
 * Possession of the execution level does not authorize an arbitrary I/O call.
 * ExecutionCapability exposes only Node handles (terminals, conservation,
 * causalQuiescence) plus the identity subset; it has no write/transport method.
 * The offline host performs the only write, and only after its own guard checks
 * admission, verification receipt, local grant, epochs and inbox readiness.
 */
export function executionLevelGrantsIo(): false {
	return false;
}
