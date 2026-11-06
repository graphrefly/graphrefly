/**
 * B121 entry validation: compose two independent spending instances in one Graph.
 *
 * Virtual file: examples/spending-alerts/__b121_entry_validation__.ts
 * Relative .js specifiers resolve to the provided .ts sources. Not executed here.
 */
import type { Graph } from "../../packages/ts/src/graph/graph.js";
import { spendingAlertsFor } from "./causal-entry.js";
import type { SpendingCreationInputs } from "./causal-entry.js";
import { mountSpendingView, type SpendingViewObservation } from "./causal-view-binding.js";

/** One shared, immutable set of defaults for both instances. */
export const sharedSpendingDefaults = Object.freeze({
	name: "alerts",
	diagnostics: "off",
} as const);

export interface ComposedSpendingInstance {
	/** The original composed instance (owner, guard, source, runEndReady, built, inspect, consume). */
	readonly instance: ReturnType<ReturnType<typeof spendingAlertsFor>["compose"]>;
	/** Ends observation only; run ownership stays with the application. */
	readonly detachDisplay: () => void;
}

export interface ComposedSpendingPair {
	readonly first: ComposedSpendingInstance;
	readonly second: ComposedSpendingInstance;
}

/**
 * Creates both instances from the two independently prepared inputs, using the
 * shared defaults, enabling summary diagnostics only for the second instance,
 * and connecting each instance's own view to its own render callback.
 */
export function composeTwoSpendingInstances(
	graph: Graph,
	firstInputs: SpendingCreationInputs,
	secondInputs: SpendingCreationInputs,
	renderFirst: (observation: SpendingViewObservation) => void,
	renderSecond: (observation: SpendingViewObservation) => void,
): ComposedSpendingPair {
	// Configuration binds the immutable defaults; it allocates no graph nodes.
	const preset = spendingAlertsFor(graph, sharedSpendingDefaults);

	// Each compose creates a complete runtime from its own prepared inputs and
	// its own resource binding. Distinct names; summary diagnostics only for B.
	const first = preset.compose(firstInputs, { name: "alerts-a" });
	const second = preset.compose(secondInputs, { name: "alerts-b", diagnostics: "summary" });

	// Each display observes only its own original view; the returned function
	// stops observation and does not close the instance or release its resource.
	const detachFirst = mountSpendingView(first.view, renderFirst);
	const detachSecond = mountSpendingView(second.view, renderSecond);

	return Object.freeze({
		first: Object.freeze({ instance: first, detachDisplay: detachFirst }),
		second: Object.freeze({ instance: second, detachDisplay: detachSecond }),
	});
}
