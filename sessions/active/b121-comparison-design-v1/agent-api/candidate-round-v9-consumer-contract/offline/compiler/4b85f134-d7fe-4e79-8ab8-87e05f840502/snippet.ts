/**
 * Read-only inspection of one composed spending instance inside a shared Graph.
 *
 * Virtual file: examples/spending-alerts/__b121_entry_validation__.ts
 *
 * This module only reads. It never invokes transport, closes the instance,
 * emits facts or changes topology. It does not reimplement instance creation:
 * the caller supplies the already-composed instance (the object returned by
 * `spendingAlertsFor(graph, ...).compose(inputs)`).
 */
import type { Graph } from "../../packages/ts/src/graph/graph.js";
import type { DescribeSnapshot } from "../../packages/ts/src/graph/describe.js";
import type { CausalQuiescence } from "../../packages/ts/src/solutions/causal-occurrence/contracts.js";
import type { Publication } from "./causal-publication.js";
import type { SpendingAlertsView } from "./causal-preset.js";

/**
 * The exact shape produced by `composeSpendingHost` / `spendingAlertsFor`.
 * `inspect()` is the host's own read-only diagnostics (causal-focused-host.ts
 * lines 558-576); `view` and `capabilities` are the original issued handles
 * (causal-preset.ts lines 171-179).
 */
export interface ComposedSpendingInstance {
	readonly inspect: () => {
		readonly fault: string | undefined;
		readonly dispatchStopped: boolean;
		readonly resourceMode: string;
		readonly normalEndReady: boolean;
		readonly writes: number;
		readonly inFlight: number;
		readonly scheduled: boolean;
		readonly delivering: boolean;
		readonly notifications: number;
		readonly maxFrameBytes: number;
		readonly records: readonly Readonly<{
			readonly request: { readonly requestRef: { readonly kind: string; readonly id: string } };
			readonly admission: { readonly admissionRef: { readonly kind: string; readonly id: string } };
			readonly outcome?: { readonly state: string };
		}>[];
	};
	readonly view: SpendingAlertsView;
	readonly capabilities: {
		readonly retained: { readonly retainedQuiescence: SpendingAlertsView["publication"] };
	};
}

/**
 * A publication-derived authority lookup. `unavailable` is a first-class
 * result: it is returned when the target has no publication yet, so no
 * authority id exists to look up (README.md lines 121-123).
 */
export type AuthorityLookup =
	| Readonly<{ available: true; authorityId: string; node: unknown }>
	| Readonly<{ available: false; reason: "no-publication" }>;

export interface SpendingInstanceInspection {
	/** Complete owning Graph snapshot: all nodes and edges, not counts or a subgraph. */
	readonly graph: DescribeSnapshot;
	/** The target instance's own host records and readiness. */
	readonly host: ReturnType<ComposedSpendingInstance["inspect"]>;
	/** Current publication of the target, or undefined when none exists yet. */
	readonly publication: Publication | undefined;
	/** Retained quiescence of the target, or undefined when not yet emitted. */
	readonly retainedQuiescence: CausalQuiescence | undefined;
	/** Authority lookup derived from the target's own current publication. */
	readonly authority: AuthorityLookup;
}

/**
 * Inspect one instance in a shared graph.
 *
 * `graph.describe()` is called with no `explain` filter so the returned
 * snapshot keeps every node and edge (graph.ts lines 564-568; describe.ts
 * lines 50-60). The authority id is taken only from this instance's own
 * publication; a node selected by a name suffix is never substituted
 * (README.md lines 118-123).
 */
export function inspectSpendingInstance(
	graph: Graph,
	instance: ComposedSpendingInstance,
): SpendingInstanceInspection {
	// Complete graph snapshot: no explain-path filter, so nothing is dropped.
	const graphSnapshot = graph.describe();

	// The target's own host records/readiness (causal-focused-host.ts 558-576).
	const host = instance.inspect();

	// Current publication of the target instance (README.md lines 111-115).
	const publication = instance.view.publication.cache as Publication | undefined;

	// Retained quiescence of the target instance (README.md line 112).
	const retainedQuiescence = instance.capabilities.retained.retainedQuiescence
		.cache as CausalQuiescence | undefined;

	// Authority lookup is derived from the target's current publication only.
	// With no publication there is no authority id; leave it unavailable rather
	// than selecting another instance's node (README.md lines 121-123).
	const authority: AuthorityLookup =
		publication === undefined
			? Object.freeze({ available: false as const, reason: "no-publication" as const })
			: Object.freeze({
					available: true as const,
					authorityId: publication.authorityId,
					node: graph.find(publication.authorityId),
				});

	return Object.freeze({
		graph: graphSnapshot,
		host,
		publication,
		retainedQuiescence,
		authority,
	});
}

/**
 * Correlate the two places a physical outcome can appear, using the exact
 * request reference as the join key.
 *
 * The host retains request/admission/outcome records and publishes outcome
 * facts into the graph (README.md lines 125-129); the publication projects
 * graph-held evidence (causal-publication.ts lines 61-80). The demo asserts
 * `publication.rows[0].proposal.requestRef` deep-equals the retained host
 * record's `request.requestRef` (causal-graded-demo.ts lines 210-211) and that
 * `publication.rows[0].recorded` equals the host outcome state (line 230).
 */
export function correlateOutcome(
	publication: Publication | undefined,
	host: ReturnType<ComposedSpendingInstance["inspect"]>,
) {
	if (publication === undefined) return undefined;
	return publication.rows.map((row) => {
		const record = host.records.find(
			(r) =>
				r.request.requestRef.kind === row.proposal.requestRef.kind &&
				r.request.requestRef.id === row.proposal.requestRef.id,
		);
		return Object.freeze({
			requestRef: row.proposal.requestRef,
			occurrence: row.proposal.occurrence,
			publicationRecorded: row.recorded,
			hostOutcome: record?.outcome?.state,
			admissionRef: record?.admission.admissionRef,
		});
	});
}

/**
 * Read-only interpretation of a detached display with an unknown prior
 * physical outcome. It reports what the evidence does and does not establish;
 * it never concludes success, no-submit or safe replay on its own.
 */
export interface DetachedDisplayReading {
	readonly readiness: boolean;
	readonly terminationProven: false;
	readonly successConcluded: false;
	readonly noSubmitConcluded: false;
	readonly safeReplayConcluded: false;
	readonly unknownOutcome: boolean;
	readonly note: string;
}

export function readDetachedDisplay(
	inspection: SpendingInstanceInspection,
): DetachedDisplayReading {
	const outcomeStates = inspection.host.records
		.map((r) => r.outcome?.state)
		.filter((s): s is string => s !== undefined);
	const unknownOutcome = outcomeStates.some(
		(s) => s === "unknown" || s === "reconcile-required",
	);
	return Object.freeze({
		readiness: inspection.host.normalEndReady,
		terminationProven: false as const,
		successConcluded: false as const,
		noSubmitConcluded: false as const,
		safeReplayConcluded: false as const,
		unknownOutcome,
		note:
			"Panel detach stops observation only; the running instance retains outstanding " +
			"obligations (README.md line 143). runEndReady/normalEndReady are current " +
			"readiness conditions, not proof of lifecycle termination or resource release " +
			"(README.md line 144). An unknown or reconciliation-required outcome is not " +
			"success or proof of no submission and prevents normal-end readiness " +
			"(README.md lines 149-150).",
	});
}
