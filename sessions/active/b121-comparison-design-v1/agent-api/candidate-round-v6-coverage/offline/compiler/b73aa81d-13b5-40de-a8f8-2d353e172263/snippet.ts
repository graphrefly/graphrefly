/**
 * B121 entry validation: compose two independent spending instances in one Graph.
 *
 * Virtual file: examples/spending-alerts/__b121_entry_validation__.ts
 * Relative .js specifiers resolve to the provided .ts sources.
 *
 * The caller supplies the Graph and two independently prepared
 * SpendingCreationInputs values (each with its own input Nodes and its own
 * prepared SpendingResource). This function only composes; it does not create
 * inputs, open resources, or invoke a transport.
 */
import type { Graph } from "../../packages/ts/src/graph/graph.js";
import { spendingAlertsFor } from "./causal-entry.js";
import type {
	SpendingCreationInputs,
	SpendingDefaults,
} from "./causal-entry.js";
import { mountSpendingView } from "./causal-view-binding.js";
import type { SpendingViewObservation } from "./causal-view-binding.js";
import type { SpendingAlertsView } from "./causal-preset.js";

export interface ComposedSpendingInstance {
	/** The complete composed host result: consume/view/capabilities, owner, guard, source, runEndReady, built, inspect. */
	readonly app: ReturnType<ReturnType<typeof spendingAlertsFor>["compose"]>;
	/** Ends observation of this instance's view only; run ownership stays with the application. */
	readonly detachDisplay: () => void;
}

export interface ComposedSpendingPair {
	readonly first: ComposedSpendingInstance;
	readonly second: ComposedSpendingInstance;
}

/**
 * Compose two independent instances from one shared, immutable defaults set.
 *
 * - Both instances share the same defaults (name "alerts", diagnostics "off").
 * - Each instance gets a distinct name via per-compose overrides; the caller
 *   supplies independent input Nodes and resource bindings before composition.
 * - Summary diagnostics are enabled only for the second instance.
 * - Each instance is connected to its own render callback through its own view.
 * - Returns both instances plus their display cleanup functions.
 */
export function composeTwoSpendingInstances(
	graph: Graph,
	firstInputs: SpendingCreationInputs,
	secondInputs: SpendingCreationInputs,
	renderFirst: (observation: SpendingViewObservation) => void,
	renderSecond: (observation: SpendingViewObservation) => void,
): ComposedSpendingPair {
	// One shared set of immutable defaults; configuration allocates no graph nodes.
	const defaults: SpendingDefaults = { name: "alerts", diagnostics: "off" };
	const preset = spendingAlertsFor(graph, defaults);

	// First instance: inherits the shared defaults unchanged (diagnostics off).
	const firstApp = preset.compose(firstInputs);

	// Second instance: distinct name, summary diagnostics only here.
	const secondApp = preset.compose(secondInputs, {
		name: "alerts-b",
		diagnostics: "summary",
	});

	// Each display observes only its own original view object.
	const detachFirst = mountSpendingView(
		firstApp.view as SpendingAlertsView,
		renderFirst,
	);
	const detachSecond = mountSpendingView(
		secondApp.view as SpendingAlertsView,
		renderSecond,
	);

	return Object.freeze({
		first: Object.freeze({ app: firstApp, detachDisplay: detachFirst }),
		second: Object.freeze({ app: secondApp, detachDisplay: detachSecond }),
	});
}
