/**
 * Composes two independent spending-alert instances in one shared Graph.
 *
 * The caller supplies the Graph and two independently prepared
 * SpendingCreationInputs values (each with its own input Nodes and its own
 * prepared SpendingResource). This function only selects per-instance
 * configuration and connects each instance's own view to its own render
 * callback. It opens no resource, invents no input facts and invokes no
 * transport directly.
 */
import type { Graph } from "../../packages/ts/src/graph/graph.js";
import { spendingAlertsFor, type SpendingCreationInputs } from "./causal-entry.js";
import { mountSpendingView, type SpendingViewObservation } from "./causal-view-binding.js";

export interface ComposedSpendingInstance {
	/** The original composed instance: owner, guard, source, runEndReady, built, inspect. */
	readonly app: ReturnType<ReturnType<typeof spendingAlertsFor>["compose"]>;
	/** Ends observation of this instance's view only; run ownership stays with the application. */
	readonly detach: () => void;
}

export interface ComposedSpendingPair {
	readonly first: ComposedSpendingInstance;
	readonly second: ComposedSpendingInstance;
}

/**
 * Creates both instances with distinct names from one shared immutable default
 * set, enabling summary diagnostics only for the second instance, and connects
 * each instance to its own render callback.
 */
export function composeTwoSpendingInstances(
	graph: Graph,
	firstInputs: SpendingCreationInputs,
	secondInputs: SpendingCreationInputs,
	renderFirst: (observation: SpendingViewObservation) => void,
	renderSecond: (observation: SpendingViewObservation) => void,
): ComposedSpendingPair {
	// One shared, immutable default set. Configuration allocates no graph nodes;
	// each compose() below creates its own complete runtime.
	const preset = spendingAlertsFor(graph, { name: "alerts-a", diagnostics: "off" });

	// Distinct names; summary diagnostics only for the second instance.
	const first = preset.compose(firstInputs, { name: "alerts-a" });
	const second = preset.compose(secondInputs, { name: "alerts-b", diagnostics: "summary" });

	// Each instance is connected to its own render callback through its own view.
	const detachFirst = mountSpendingView(first.view, renderFirst);
	const detachSecond = mountSpendingView(second.view, renderSecond);

	return Object.freeze({
		first: Object.freeze({ app: first, detach: detachFirst }),
		second: Object.freeze({ app: second, detach: detachSecond }),
	});
}
