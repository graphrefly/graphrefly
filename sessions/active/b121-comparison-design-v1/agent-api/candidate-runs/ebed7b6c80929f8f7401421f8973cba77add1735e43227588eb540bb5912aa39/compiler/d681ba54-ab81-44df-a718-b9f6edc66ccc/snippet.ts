/**
 * Display adapter for an already-created SpendingAlertsView.
 *
 * Renders the current available business values and explicitly names the ports
 * that have no usable value. Returns a cleanup function that ends observation
 * only; it does not stop, complete or release the running instance.
 *
 * Relative imports resolve to the provided .ts sources.
 */
import type { SpendingAlertsView } from "./causal-preset.js";
import {
	mountSpendingView,
	type SpendingViewObservation,
} from "./causal-view-binding.js";

/** The five business ports the view exposes, in display order. */
export const DISPLAY_PORTS = [
	"assessment",
	"publication",
	"coverage",
	"issues",
	"startup",
] as const;

export interface SpendingDisplay {
	/** Latest value per port; a port is absent when it has no current usable value. */
	readonly values: SpendingViewObservation["values"];
	/** Ports with no current usable value; the old displayed value must not be kept. */
	readonly unavailable: readonly (keyof SpendingAlertsView)[];
}

/**
 * Render one observation. `values` holds only ports that currently have a
 * usable value; `unavailable` names the rest explicitly, so a missing port is
 * never silently rendered as a stale value.
 */
export function formatSpendingDisplay(observation: SpendingViewObservation): string {
	const { values, unavailable } = observation;
	const lines: string[] = [];
	for (const port of DISPLAY_PORTS) {
		if (Object.hasOwn(values, port)) {
			lines.push(`${port}: ${JSON.stringify(values[port])}`);
		} else {
			lines.push(`${port}: unavailable`);
		}
	}
	lines.push(`unavailable ports: ${unavailable.join(", ") || "none"}`);
	return lines.join("\n");
}

/**
 * Mount the display over an existing view. The caller supplies the view and the
 * render callback; this adapter creates no instance and supplies no business
 * input facts. The returned function ends observation only.
 */
export function mountSpendingDisplay(
	view: SpendingAlertsView,
	render: (display: SpendingDisplay) => void,
): () => void {
	return mountSpendingView(view, (observation) => {
		render({
			values: observation.values,
			unavailable: observation.unavailable,
		});
	});
}
