/**
 * Display adapter for an already-created SpendingAlertsView.
 *
 * It renders the CURRENT available business values and explicitly names the ports
 * that have no usable value. It creates no runtime, no input facts and no
 * capabilities: the view is supplied by the caller and is only observed.
 *
 * The returned function ends observation only (unmount). Run ownership, retained
 * obligations and lifecycle stay with the application.
 */
import type { Node } from "../../packages/ts/src/node/node.js";
import type { SpendingAlertsView } from "./causal-preset.js";

type ValueOf<N> = N extends Node<infer T> ? T : never;

/** Latest value per port; NOT an atomic multi-port snapshot and not independent evidence. */
export type SpendingViewValues = {
	readonly [K in keyof SpendingAlertsView]?: ValueOf<SpendingAlertsView[K]>;
};

export interface SpendingViewObservation {
	readonly values: SpendingViewValues;
	/** Ports with no current usable value (never delivered, INVALIDATE or ERROR). */
	readonly unavailable: readonly (keyof SpendingAlertsView)[];
}

/** The five business ports of the view, in display order. */
const ports = ["assessment", "publication", "coverage", "issues", "startup"] as const;

export interface SpendingDisplayOptions {
	/** Optional label for a port that has no usable value. */
	readonly unavailableLabel?: (port: keyof SpendingAlertsView) => string;
}

/**
 * Mount the display over an existing view.
 *
 * @param view - The already-created view (original identity; never rebuilt here).
 * @param render - Called with the current values plus the explicit unavailable list.
 * @param options - Presentation-only options.
 * @returns A cleanup function that ends observation (unmount).
 */
export function mountSpendingDisplay(
	view: SpendingAlertsView,
	render: (observation: SpendingViewObservation) => void,
	options: SpendingDisplayOptions = {},
): () => void {
	const label = options.unavailableLabel ?? ((port: keyof SpendingAlertsView) => `unavailable: ${port}`);
	const values: Record<string, unknown> = {};
	const stops: (() => void)[] = [];
	let mounting = true;
	let closed = false;

	const publish = () => {
		const unavailable = ports.filter((port) => !Object.hasOwn(values, port));
		render(
			Object.freeze({
				values: Object.freeze({ ...values }) as SpendingViewValues,
				unavailable: Object.freeze(unavailable),
			}),
		);
	};

	/** Ends observation only; the running instance keeps its outstanding obligations. */
	const stop = () => {
		if (closed) return;
		closed = true;
		for (const unsubscribe of stops.splice(0).reverse()) unsubscribe();
	};

	try {
		for (const port of ports) {
			stops.push(
				view[port].subscribe((message) => {
					if (closed) return;
					if (message[0] === "DATA") values[port] = message[1];
					else if (message[0] === "INVALIDATE" || message[0] === "ERROR") delete values[port];
					else return; // START / DIRTY / RESOLVED / COMPLETE / TEARDOWN: no new usable value
					if (!mounting) publish();
				}),
			);
		}
		mounting = false;
		publish();
		return stop;
	} catch (error) {
		stop();
		throw error;
	}
}

/** Render the observation as display text, naming every port without a usable value. */
export function formatSpendingDisplay(
	observation: SpendingViewObservation,
	options: SpendingDisplayOptions = {},
): string {
	const label = options.unavailableLabel ?? ((port: keyof SpendingAlertsView) => `unavailable: ${port}`);
	const { values, unavailable } = observation;
	const lines: string[] = [];

	lines.push(
		values.startup === undefined
			? label("startup")
			: `startup: ${values.startup.state} (started; not proof of authorization, success or run completion)`,
	);

	lines.push(
		values.assessment === undefined
			? label("assessment")
			: values.assessment.valid
				? `assessment: ${
						values.assessment.rows
							.map(({ value }) =>
								`${value.evaluationRef}: ${value.flagged ? "condition met (evidence and permission still required)" : "condition not met (not proof verification finished)"}`,
							)
							.join("; ") || "frame present, no rows yet"
					}`
				: "assessment: invalid fact",
	);

	lines.push(
		values.publication === undefined
			? label("publication")
			: `publication: ${
					values.publication.rows
						.map((row) => `${row.proposal.effectId}: ${row.recorded}`)
						.join("; ") || "frame present, no rows yet (not proof of success)"
				}`,
	);

	lines.push(
		values.coverage === undefined ? label("coverage") : `coverage: ${JSON.stringify(values.coverage)}`,
	);
	lines.push(values.issues === undefined ? label("issues") : `issues: ${JSON.stringify(values.issues)}`);

	lines.push(`no current value: ${unavailable.map((port) => label(port)).join(", ") || "none"}`);
	return lines.join("\n");
}
