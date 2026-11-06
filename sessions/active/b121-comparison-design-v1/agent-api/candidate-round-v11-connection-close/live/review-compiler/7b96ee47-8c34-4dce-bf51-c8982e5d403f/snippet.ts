/**
 * B121 entry validation: validate an issued FullCausalCapability before handing its
 * three levels to a recipient. Consumer-private source imports, not package subpaths.
 */
import type { Graph } from "../../packages/ts/src/graph/graph.js";
import {
	assertCausalCapabilities,
	type CausalBinding,
	type FullCausalCapability,
} from "../../packages/ts/src/solutions/causal-occurrence/capabilities.js";

/** The three graded levels a recipient may consume, in their original identity order. */
export interface CausalCapabilityRecipient<T> {
	readonly identity: FullCausalCapability<T>["identity"];
	readonly execution: FullCausalCapability<T>["execution"];
	readonly retained: FullCausalCapability<T>["retained"];
}

/**
 * Validate the supplied capability against the owning Graph and the expected binding,
 * then deliver the three levels. The recipient is never called when validation fails:
 * a structural copy, a capability from another Graph, or a binding/epoch mismatch all
 * throw before any delivery. The delivered handles are the original issued objects, so
 * `execution.identity === identity` and `retained.execution === execution` still hold.
 */
export function handoffCausalCapabilities<T>(
	graph: Graph,
	capability: FullCausalCapability<T>,
	expected: CausalBinding,
	recipient: (levels: CausalCapabilityRecipient<T>) => void,
): void {
	// Throws TypeError on: unissued/structural copy, wrong Graph, wrong level,
	// binding contract/revision/scope/epoch mismatch, or broken lower-handle lineage.
	assertCausalCapabilities(graph, capability, expected);

	// Original references only; no re-wrapping, cloning or re-registration.
	const levels: CausalCapabilityRecipient<T> = Object.freeze({
		identity: capability.identity,
		execution: capability.execution,
		retained: capability.retained,
	});

	recipient(levels);
}
