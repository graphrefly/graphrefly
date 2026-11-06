/**
 * B121 entry validation: display adapter for an already-created SpendingAlertsView.
 *
 * Renders the current available business values and explicitly names ports that have
 * no usable value. Returns a cleanup function that ends observation only.
 *
 * It does NOT create a running instance, does NOT supply business input facts, and
 * does NOT own run lifecycle. The caller supplies the view and the render callback.
 */
import type { SpendingAlertsView } from "./causal-preset.js";
import {
	mountSpendingView,
	type SpendingViewObservation,
} from "./causal-view-binding.js";

/** The five business ports exposed by the view, in display order. */
export const DISPLAY_PORTS = [
	"assessment",
	"publication",
	"coverage",
	"issues",
	"startup",
] as const satisfies readonly (keyof SpendingAlertsView)[];

/** One rendered line per port: either the current value or an explicit "unavailable". */
export interface SpendingDisplayLine {
	readonly port: keyof SpendingAlertsView;
	readonly available: boolean;
	readonly text: string;
}

/**
 * Turn one observation into display lines. `unavailable` is authoritative: a port
 * listed there has no current usable fact, so no stale value is shown for it.
 */
export function toDisplayLines(
	observation: SpendingViewObservation,
): readonly SpendingDisplayLine[] {
	const { values, unavailable } = observation;
	const missing = new Set<keyof SpendingAlertsView>(unavailable);
	return DISPLAY_PORTS.map((port) => {
		const value = values[port];
		const available = !missing.has(port) && value !== undefined;
		return Object.freeze({
			port,
			available,
			text: available
				? `${port}: ${JSON.stringify(value)}`
				: `${port}: unavailable (no current usable value)`,
		});
	});
}

/**
 * Mount the display for an existing view. Returns a cleanup function for unmounting.
 * Cleanup stops observation only; it does not stop, cancel or complete the run.
 */
export function mountSpendingDisplay(
	view: SpendingAlertsView,
	render: (lines: readonly SpendingDisplayLine[]) => void,
): () => void {
	return mountSpendingView(view, (observation) => {
		render(toDisplayLines(observation));
	});
}
