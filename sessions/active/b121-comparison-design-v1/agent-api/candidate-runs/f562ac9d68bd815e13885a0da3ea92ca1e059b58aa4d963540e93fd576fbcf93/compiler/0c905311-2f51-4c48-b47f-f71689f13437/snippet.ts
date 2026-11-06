/**
 * B121 entry validation: compose two independent spending-alert instances in one Graph.
 *
 * Virtual file: examples/spending-alerts/__b121_entry_validation__.ts
 * Relative .js specifiers resolve to the provided .ts sources.
 *
 * The caller supplies the Graph and two independently prepared SpendingCreationInputs
 * values (each with its own input Nodes and its own prepared SpendingResource).
 * This function only composes; it never creates inputs, resources or transports.
 */
import type { Graph } from "../../packages/ts/src/graph/graph.js";
import {
	spendingAlertsFor,
	type SpendingCreationInputs,
	type SpendingDefaults,
} from "./causal-entry.js";
import { mountSpendingView, type SpendingViewObservation } from "./causal-view-binding.js";

export interface ComposedSpendingInstance {
	/** The original composed instance (owner, inspect, runEndReady, built, ...). */
	readonly app: ReturnType<ReturnType<typeof spendingAlertsFor>["compose"]>;
	/** The original five-port view object handed to the display component. */
	readonly view: ReturnType<ReturnType<typeof spendingAlertsFor>["compose"]>["view"];
	/** Ends observation only; run ownership stays with the application. */
	readonly detach: () => void;
}

export interface TwoInstanceComposition {
	readonly first: ComposedSpendingInstance;
	readonly second: ComposedSpendingInstance;
}

/**
 * Creates both instances from one shared immutable defaults object.
 *
 * - Distinct names: "alerts-a" / "alerts-b" (per-compose overrides).
 * - Summary diagnostics enabled only for the second instance.
 * - Each instance is connected to its own render callback.
 * - Returns the two instances and their display cleanup functions.
 */
export function composeTwoSpendingInstances(
	graph: Graph,
	firstInputs: SpendingCreationInputs,
	secondInputs: SpendingCreationInputs,
	renderFirst: (observation: SpendingViewObservation) => void,
	renderSecond: (observation: SpendingViewObservation) => void,
): TwoInstanceComposition {
	// One shared set of immutable defaults; configuration allocates no graph nodes.
	const defaults: SpendingDefaults = Object.freeze({
		name: "alerts-a",
		diagnostics: "off",
	});
	const preset = spendingAlertsFor(graph, defaults);

	// First instance: inherits the shared defaults (name "alerts-a", diagnostics off).
	const firstApp = preset.compose(firstInputs);

	// Second instance: distinct name, summary diagnostics only here.
	const secondApp = preset.compose(secondInputs, {
		name: "alerts-b",
		diagnostics: "summary",
	});

	// Each instance is bound to its own render callback through its own original view.
	const detachFirst = mountSpendingView(firstApp.view, renderFirst);
	const detachSecond = mountSpendingView(secondApp.view, renderSecond);

	return Object.freeze({
		first: Object.freeze({ app: firstApp, view: firstApp.view, detach: detachFirst }),
		second: Object.freeze({ app: secondApp, view: secondApp.view, detach: detachSecond }),
	});
}
