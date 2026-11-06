/**
 * B121 entry validation: compose two independent spending instances in one Graph.
 *
 * The caller supplies the Graph and two independently prepared
 * SpendingCreationInputs values (each with its own input Nodes and its own
 * prepared resource). This module only composes; it never prepares inputs,
 * opens resources or invokes a transport.
 */
import type { Graph } from "../../packages/ts/src/graph/graph.js";
import { spendingAlertsFor, type SpendingCreationInputs } from "./causal-entry.js";
import { mountSpendingView, type SpendingViewObservation } from "./causal-view-binding.js";

export interface ComposedSpendingInstance {
	readonly name: string;
	/** The original composed instance; keep it with the owning Graph. */
	readonly app: ReturnType<ReturnType<typeof spendingAlertsFor>["compose"]>;
	/** Ends observation only; run ownership stays with the application. */
	readonly detach: () => void;
}

export interface TwoInstanceComposition {
	readonly first: ComposedSpendingInstance;
	readonly second: ComposedSpendingInstance;
}

/**
 * Compose two independent instances from one shared immutable default set.
 *
 * - `defaults` is bound once by `spendingAlertsFor`; both composes inherit it.
 * - Each instance gets its own name override, its own prepared inputs and its
 *   own resource binding; nothing is cloned or rebound here.
 * - Only the second instance enables summary diagnostics.
 * - Each instance is connected to its own render callback through the
 *   original `.view` object.
 */
export function composeTwoSpendingInstances(
	graph: Graph,
	firstInputs: SpendingCreationInputs,
	secondInputs: SpendingCreationInputs,
	renderFirst: (observation: SpendingViewObservation) => void,
	renderSecond: (observation: SpendingViewObservation) => void,
): TwoInstanceComposition {
	// One shared set of immutable defaults; configuration allocates no nodes.
	const preset = spendingAlertsFor(graph, { name: "alerts", diagnostics: "off" });

	// First instance: distinct name, its own inputs/resource, diagnostics off.
	const firstApp = preset.compose(firstInputs, { name: "alerts-a" });

	// Second instance: distinct name, its own inputs/resource, summary diagnostics.
	const secondApp = preset.compose(secondInputs, {
		name: "alerts-b",
		diagnostics: "summary",
	});

	// Each display observes only its own original view object.
	const detachFirst = mountSpendingView(firstApp.view, renderFirst);
	const detachSecond = mountSpendingView(secondApp.view, renderSecond);

	return Object.freeze({
		first: Object.freeze({ name: "alerts-a", app: firstApp, detach: detachFirst }),
		second: Object.freeze({ name: "alerts-b", app: secondApp, detach: detachSecond }),
	});
}
