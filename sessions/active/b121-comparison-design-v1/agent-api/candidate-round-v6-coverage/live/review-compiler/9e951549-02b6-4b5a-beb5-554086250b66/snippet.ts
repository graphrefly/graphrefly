/**
 * B121 entry validation: hand a validated FullCausalCapability to a recipient.
 *
 * The recipient is invoked only when the supplied capability is the exact issued
 * object for this Graph and this expected CausalBinding. A structural copy, a
 * capability issued for another Graph, or one issued under a different binding
 * (contract / implementationRevision / scope / epoch) is refused before any
 * delivery, so no level is ever handed out from an unverified handle.
 *
 * The three levels are delivered as the original frozen handles, preserving the
 * identity relationships established at issuance:
 *   full.execution.identity === full.identity
 *   full.retained.execution === full.execution
 * (see packages/ts/src/solutions/causal-occurrence/capabilities.ts:88-89 and
 *  createCausalCapabilities at :122-146).
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

/** The three graded levels, delivered together and never re-wrapped. */
export interface CausalCapabilityRecipient<T> {
	readonly identity: IdentityCapability<T>;
	readonly execution: ExecutionCapability<T>;
	readonly retained: RetainedEvidenceCapability<T>;
}

export type CausalCapabilityRecipientCallback<T> = (
	levels: CausalCapabilityRecipient<T>,
) => void;

/**
 * Validate the supplied capability against the owning Graph and the expected
 * binding, then deliver its three levels to the recipient.
 *
 * Throws (and never calls the recipient) when the capability is not an issued
 * object, belongs to a different Graph, or was issued under a different binding.
 */
export function handoffCausalCapabilities<T>(
	graph: Graph,
	capabilities: FullCausalCapability<T>,
	expected: CausalBinding,
	recipient: CausalCapabilityRecipientCallback<T>,
): void {
	// Exact issued-object + Graph + binding + lineage validation. A structural
	// copy or a copied lower handle fails here (capabilities.ts:66-90).
	assertCausalCapabilities(graph, capabilities, expected);

	// Deliver the original handles; do not rebuild or re-freeze the levels.
	const levels: CausalCapabilityRecipient<T> = Object.freeze({
		identity: capabilities.identity,
		execution: capabilities.execution,
		retained: capabilities.retained,
	});

	// Re-assert the original identity relationships before delivery so a caller
	// cannot observe a broken lineage even if a handle was tampered with.
	if (
		levels.execution.identity !== levels.identity ||
		levels.retained.execution !== levels.execution
	) {
		throw new TypeError("causal capability lower handle mismatch");
	}

	recipient(levels);
}
