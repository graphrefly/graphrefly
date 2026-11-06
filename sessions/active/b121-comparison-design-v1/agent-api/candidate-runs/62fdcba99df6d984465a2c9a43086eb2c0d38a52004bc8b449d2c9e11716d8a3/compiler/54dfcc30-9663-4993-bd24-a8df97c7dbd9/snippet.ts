/**
 * B121 entry validation adapter (virtual file).
 *
 * Renders the CURRENT available business values of an already-created
 * SpendingAlertsView and explicitly names the ports that have no usable value.
 * It creates no running instance, no input facts and no new business state: it
 * only observes the original view object it is handed and returns a cleanup
 * function that ends that observation.
 */
import type { SpendingAlertsView } from "./causal-preset.js";
import {
	mountSpendingView,
	type SpendingViewObservation,
	type SpendingViewValues,
} from "./causal-view-binding.js";

/** The five business ports of the view, in display order. */
export const SPENDING_VIEW_PORTS = [
	"assessment",
	"publication",
	"coverage",
	"issues",
	"startup",
] as const satisfies readonly (keyof SpendingAlertsView)[];

export type SpendingViewPort = (typeof SPENDING_VIEW_PORTS)[number];

/** One rendered line: either a current value or an explicit "no usable value". */
export interface SpendingPortLine {
	readonly port: SpendingViewPort;
	readonly available: boolean;
	/** Present only when `available`; the latest value observed on that port. */
	readonly value?: SpendingViewValues[SpendingViewPort];
}

/** What the display shows for one observation. */
export interface SpendingDisplay {
	readonly lines: readonly SpendingPortLine[];
	/** Ports with no current usable fact, in display order. */
	readonly unavailable: readonly SpendingViewPort[];
}

/**
 * Pure projection of one observation into display rows. No I/O, no runtime
 * creation, no retention of the previous frame: a port that is absent from
 * `observation.values` is reported as unavailable rather than as its old value.
 */
export function toSpendingDisplay(observation: SpendingViewObservation): SpendingDisplay {
	const lines: SpendingPortLine[] = SPENDING_VIEW_PORTS.map((port) => {
		if (Object.hasOwn(observation.values, port)) {
			return { port, available: true, value: observation.values[port] };
		}
		return { port, available: false };
	});
	return Object.freeze({
		lines: Object.freeze(lines),
		unavailable: Object.freeze(
			SPENDING_VIEW_PORTS.filter((port) => !Object.hasOwn(observation.values, port)),
		),
	});
}

/**
 * Mount the display on an already-created view.
 *
 * @param view   the original `SpendingAlertsView` supplied by the caller; it is
 *               observed, never rebuilt, cloned or re-created here.
 * @param render called with the current display on mount and after every
 *               value change; it receives only current values plus the explicit
 *               unavailable list.
 * @returns      the cleanup function for unmounting: it ends observation of the
 *               view and is idempotent. It does not stop, close or release the
 *               running instance, which stays owned by the application.
 */
export function mountSpendingAlertsDisplay(
	view: SpendingAlertsView,
	render: (display: SpendingDisplay) => void,
): () => void {
	return mountSpendingView(view, (observation) => render(toSpendingDisplay(observation)));
}

/**
 * Convenience text renderer for hosts that display a single string. It shows
 * every port, marking the ones without a usable value, and never claims that a
 * missing value means the run ended.
 */
export function formatSpendingDisplay(display: SpendingDisplay): string {
	return display.lines
		.map((line) =>
			line.available
				? `${line.port}: ${JSON.stringify(line.value)}`
				: `${line.port}: unavailable (no current usable value)`,
		)
		.join("\n");
}
