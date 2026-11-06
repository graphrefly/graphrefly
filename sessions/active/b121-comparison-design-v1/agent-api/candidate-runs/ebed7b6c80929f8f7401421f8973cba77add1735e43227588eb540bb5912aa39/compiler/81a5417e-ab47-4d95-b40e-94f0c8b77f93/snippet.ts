/**
 * B121 entry validation: hand a validated FullCausalCapability to a recipient.
 *
 * Virtual file: examples/spending-alerts/__b121_entry_validation__.ts
 * Relative .js specifiers resolve to the provided .ts sources.
 *
 * The Graph, the FullCausalCapability value, the expected CausalBinding and the
 * recipient callback are all supplied by the caller. This function creates no
 * Graph, no capability, no resource and no I/O; it only validates and forwards
 * the original issued handles.
 */
import type { Graph } from "../../packages/ts/src/graph/graph.js";
import {
	assertCausalCapabilities,
	type CausalBinding,
	type FullCausalCapability,
} from "../../packages/ts/src/solutions/causal-occurrence/capabilities.js";

/** The three graded levels, delivered as the original issued objects. */
export interface CausalCapabilityRecipient<T> {
	readonly identity: FullCausalCapability<T>["identity"];
	readonly execution: FullCausalCapability<T>["execution"];
	readonly retained: FullCausalCapability<T>["retained"];
}

/**
 * Validate the supplied capability against the owning Graph and the expected
 * binding, then deliver the three levels. The recipient is never called when
 * validation fails: a structural copy, a capability from another Graph, or a
 * capability issued under a different binding/epoch all throw before delivery.
 */
export function handoffCausalCapabilities<T>(
	graph: Graph,
	capabilities: FullCausalCapability<T>,
	expected: CausalBinding,
	recipient: (levels: CausalCapabilityRecipient<T>) => void,
): void {
	// Exact issued-object, Graph, binding and lineage validation. Throws TypeError
	// for a structural copy (not in the issued WeakMap), a different Graph, a
	// mismatched contract/revision/scope/epoch, or a broken lower-handle lineage.
	assertCausalCapabilities(graph, capabilities, expected);

	// Deliver the original handles, preserving the identity relationships:
	// execution.identity === identity and retained.execution === execution.
	// No clone, spread, cast or re-creation of the capability objects.
	const levels: CausalCapabilityRecipient<T> = Object.freeze({
		identity: capabilities.identity,
		execution: capabilities.execution,
		retained: capabilities.retained,
	});

	recipient(levels);
}
