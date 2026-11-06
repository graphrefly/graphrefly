/**
 * B121 entry validation adapter (display-component role).
 *
 * Renders the CURRENT available business values of an already-created
 * SpendingAlertsView and explicitly names the ports that have no usable value.
 * It creates no running instance, no input facts and no new business state: it
 * only observes the original view's ports and returns a cleanup function.
 *
 * Relative imports are written from examples/spending-alerts/.
 */
import type { Node } from "../../packages/ts/src/node/node.js";
import type { SpendingAlertsView } from "./causal-preset.js";

/** Value carried by a view port (the port is a Node<T>). */
type ValueOf<N> = N extends Node<infer T> ? T : never;

/** The five business ports of the view, in display order. */
export const SPENDING_VIEW_PORTS = [
	"assessment",
	"publication",
	"coverage",
	"issues",
	"startup",
] as const satisfies readonly (keyof SpendingAlertsView)[];

export type SpendingViewPort = (typeof SPENDING_VIEW_PORTS)[number];

/** Latest value per port; a port is absent when it has no current usable value. */
export type SpendingViewValues = {
	readonly [K in SpendingViewPort]?: ValueOf<SpendingAlertsView[K]>;
};

/**
 * One render payload. `values` holds the latest value per port and `unavailable`
 * names every port without a current usable value. This is NOT an atomic
 * multi-port snapshot and NOT independent evidence.
 */
export interface SpendingViewObservation {
	readonly values: SpendingViewValues;
	readonly unavailable: readonly SpendingViewPort[];
}

/** Render callback supplied by the caller (framework/panel). */
export type SpendingViewRender = (observation: SpendingViewObservation) => void;

/**
 * Mount the display over an ALREADY-CREATED view.
 *
 * - Subscribes to each port of the original view (no new nodes, no new facts).
 * - Renders the current available values plus the explicit `unavailable` list.
 * - Returns a cleanup function that ends observation only; the running instance
 *   and its outstanding obligations stay with the application.
 */
export function mountSpendingAlertsDisplay(
	view: SpendingAlertsView,
	render: SpendingViewRender,
): () => void {
	const values: Partial<Record<SpendingViewPort, unknown>> = {};
	const stops: Array<() => void> = [];
	let mounting = true;
	let closed = false;

	const publish = (): void => {
		const unavailable = SPENDING_VIEW_PORTS.filter(
			(port) => !Object.hasOwn(values, port),
		);
		render(
			Object.freeze({
				values: Object.freeze({ ...values }) as SpendingViewValues,
				unavailable: Object.freeze(unavailable),
			}),
		);
	};

	const stop = (): void => {
		if (closed) return;
		closed = true;
		// Unsubscribe in reverse order; each unsubscribe is idempotent.
		for (const unsubscribe of stops.splice(0).reverse()) unsubscribe();
	};

	try {
		for (const port of SPENDING_VIEW_PORTS) {
			stops.push(
				view[port].subscribe((message) => {
					if (closed) return;
					if (message[0] === "DATA") {
						values[port] = message[1];
					} else if (message[0] === "INVALIDATE" || message[0] === "ERROR") {
						// No current usable fact on this port: drop the stale value instead of
						// keeping the old displayed one.
						delete values[port];
					} else {
						// START / DIRTY / RESOLVED / COMPLETE / TEARDOWN: no new usable value.
						return;
					}
					if (!mounting) publish();
				}),
			);
		}
		mounting = false;
		// Initial render: current values + explicit unavailable ports.
		publish();
		return stop;
	} catch (error) {
		// Partial wiring must not leak subscriptions.
		stop();
		throw error;
	}
}

/**
 * Convenience adapter for a text panel: renders the observation as lines and
 * returns the same cleanup function.
 */
export function mountSpendingAlertsTextDisplay(
	view: SpendingAlertsView,
	show: (text: string) => void,
): () => void {
	return mountSpendingAlertsDisplay(view, (observation) =>
		show(formatSpendingViewObservation(observation)),
	);
}

/** Human-readable rendering of one observation (values + unavailable ports). */
export function formatSpendingViewObservation(
	observation: SpendingViewObservation,
): string {
	const { values, unavailable } = observation;
	const lines: string[] = [];

	lines.push(
		values.startup
			? `startup: ${values.startup.state} (started; not proof of authorization, success or run completion)`
			: "startup: no current fact",
	);

	if (values.assessment) {
		const rows = values.assessment.valid
			? values.assessment.rows
					.map(
						({ value }) =>
							`${value.evaluationRef}: ${value.flagged ? "condition met (evidence and permission still required)" : "condition not met (not proof verification finished)"}`,
					)
					.join("; ") || "assessment frame present, no rows yet"
			: "assessment fact invalid";
		lines.push(`assessment: ${rows}`);
	} else {
		lines.push("assessment: no current fact");
	}

	if (values.publication) {
		const rows =
			values.publication.rows
				.map((row) => `${row.proposal.effectId}: ${row.recorded}`)
				.join("; ") || "publication frame present, no rows yet (not proof of success)";
		lines.push(`publication: ${rows}`);
	} else {
		lines.push("publication: no current fact");
	}

	lines.push(
		values.coverage
			? `coverage: ${JSON.stringify(values.coverage)}`
			: "coverage: no current fact",
	);
	lines.push(
		values.issues
			? `issues: ${JSON.stringify(values.issues)}`
			: "issues: no current fact",
	);

	lines.push(
		`unavailable ports: ${unavailable.length > 0 ? unavailable.join(", ") : "none"}`,
	);

	return lines.join("\n");
}
