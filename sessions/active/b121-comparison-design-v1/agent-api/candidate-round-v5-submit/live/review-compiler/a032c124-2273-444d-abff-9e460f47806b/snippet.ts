/**
 * Read-only inspection of a composed spending instance whose display has been
 * detached while a prior request still has an unknown physical outcome.
 *
 * Virtual file: examples/spending-alerts/__b121_entry_validation__.ts
 *
 * This module only READS. It never calls transport, never closes the resource,
 * never rewires topology, and never injects a request/outcome. It is a pure
 * projection over (a) the owning Graph's structural snapshot and (b) the
 * instance's own retained host records.
 */
import type { Graph } from "../../packages/ts/src/graph/graph.js";
import type { DescribeSnapshot } from "../../packages/ts/src/graph/describe.js";
import type {
	CausalEffectOutcome,
	CausalEffectOutcomeState,
	CausalQuiescence,
	CommittedEffectsView,
} from "../../packages/ts/src/solutions/causal-occurrence/contracts.js";
import type { Publication } from "./causal-publication.js";

/** The exact shape returned by the host's own `inspect()` (causal-focused-host.ts:558-576). */
export interface SpendingHostInspection {
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
		readonly request: { readonly body: { readonly occurrence: unknown; readonly payloadDigest: string } };
		readonly admission: { readonly admissionRef: unknown };
		readonly outcome?: CausalEffectOutcome;
	}>[];
}

/** The read-only surface this inspector is allowed to touch. */
export interface SpendingInspectionInputs {
	/** The owning Graph (maintainerExample(graph) -> graph.describe(), causal-audience.examples.ts:27-29). */
	readonly graph: Graph;
	/** The instance's own host diagnostics; the application keeps this handle (causal-graded-demo.ts:65). */
	readonly inspect: () => SpendingHostInspection;
	/** The original five-port view; only `.publication` is read here. */
	readonly view: { readonly publication: { readonly cache?: Publication } };
	/** Optional retained quiescence port (retained.retainedQuiescence, capabilities.ts:33-37). */
	readonly retainedQuiescence?: { readonly cache?: CausalQuiescence };
}

/**
 * Outcome states that are NOT a settled physical result. `unknown` and
 * `reconcile-required` are explicitly excluded from normal-end readiness
 * (causal-focused-host.ts:530-535) and stop further dispatch (line 224).
 */
const UNSETTLED: readonly CausalEffectOutcomeState[] = ["unknown", "reconcile-required"];

/**
 * Read-only inspection. Returns a frozen, plain-data report. No side effects:
 * no `down()`, no `close()`, no `claim()`, no topology mutation.
 */
export function inspectDetachedSpending(inputs: SpendingInspectionInputs) {
	const { graph, inspect, view, retainedQuiescence } = inputs;

	// 1. Full graph structure: every node id, factory, live deps and edges.
	//    describe() reads LIVE deps, so a rewire would show up here (graph.ts:565-618).
	const described: DescribeSnapshot = graph.describe();

	// 2. Host-side retained evidence. This is the ONLY place a physical outcome
	//    can be observed; the graph alone cannot report it.
	const host = inspect();

	// 3. The passive publication view, if the instance ever published one.
	const publication: Publication | undefined = view.publication.cache;

	// 4. Retained quiescence, if the caller kept the retained capability.
	const quiescence: CausalQuiescence | undefined = retainedQuiescence?.cache;

	const records = host.records.map((record) => {
		const state = record.outcome?.state;
		return Object.freeze({
			occurrence: record.request.body.occurrence,
			requestDigest: record.request.body.payloadDigest,
			admissionRef: record.admission.admissionRef,
			outcomeState: state,
			/** true when this exact request has no settled physical result yet. */
			unsettled: state === undefined || UNSETTLED.includes(state),
		});
	});

	const unsettledRecords = records.filter((r) => r.unsettled);

	// Graph conditions (structure + retained causal evidence) vs host end-readiness.
	const graphConditions = Object.freeze({
		name: described.name,
		nodeCount: described.nodes.length,
		edgeCount: described.edges.length,
		/** The authority node that owns the committed-effects view (causal-graded-demo.ts:226,273). */
		authorityNode: described.nodes.find((n) => n.id.endsWith("/causal/authority"))?.id,
		/** Retained causal quiescence: lifecycle + retainedEvidence + no pending work. */
		quiescence: quiescence
			? Object.freeze({
					lifecycle: quiescence.lifecycle,
					retainedEvidence: quiescence.retainedEvidence,
					pendingOccurrences: quiescence.pendingOccurrenceRefs.length,
					pendingEffects: quiescence.pendingEffectIds.length,
				})
			: undefined,
	});

	const hostConditions = Object.freeze({
		fault: host.fault,
		dispatchStopped: host.dispatchStopped,
		inFlight: host.inFlight,
		scheduled: host.scheduled,
		delivering: host.delivering,
		writes: host.writes,
		resourceMode: host.resourceMode,
		/** Host's own readiness flag; NOT proof of lifecycle termination or release. */
		normalEndReady: host.normalEndReady,
	});

	return Object.freeze({
		graph: graphConditions,
		host: hostConditions,
		publication: publication
			? Object.freeze({
					authorityId: publication.authorityId,
					rows: publication.rows.map((row) =>
						Object.freeze({
							effectId: row.proposal.effectId,
							requestRef: row.proposal.requestRef,
							recorded: row.recorded,
						}),
					),
				})
			: undefined,
		records,
		unsettledRecords,
		/**
		 * A conservative, read-only summary. `settled` is true only when every
		 * retained record has a non-unknown outcome AND the host reports readiness.
		 * It is deliberately NOT a claim that the run terminated or the resource
		 * was released.
		 */
		summary: Object.freeze({
			recordCount: records.length,
			unsettledCount: unsettledRecords.length,
			settled: unsettledRecords.length === 0 && host.normalEndReady,
			/** The display being detached is irrelevant to these numbers. */
			displayDetached: true,
		}),
	});
}

export type SpendingInspectionReport = ReturnType<typeof inspectDetachedSpending>;

/**
 * Read-only helper: does the graph still carry the retained causal evidence
 * needed to distinguish "graph is quiet" from "host is end-ready"?
 * It reads only; it never activates a node or emits DATA.
 */
export function retainedEvidencePresent(
	graph: Graph,
	quiescence: CausalQuiescence | undefined,
): boolean {
	const described = graph.describe();
	const hasAuthority = described.nodes.some((n) => n.id.endsWith("/causal/authority"));
	return hasAuthority && quiescence !== undefined && quiescence.retainedEvidence;
}

/**
 * Read-only helper: project the committed-effects view into per-effect outcome
 * states. `CommittedEffectsView` is passive retained data, never execution
 * permission (contracts.ts:200-215).
 */
export function outcomeStates(view: CommittedEffectsView) {
	return Object.freeze(
		view.effects.map((effect) =>
			Object.freeze({
				effectId: effect.proposal.effectId,
				admissionState: effect.admission?.state,
				outcomeState: effect.outcome?.state,
				unsettled:
					effect.outcome === undefined ||
					UNSETTLED.includes(effect.outcome.state),
			}),
		),
	);
}
