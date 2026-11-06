/**
 * Read-only inspection of one composed spending instance inside its owning Graph.
 *
 * Virtual file: examples/spending-alerts/__b121_entry_validation__.ts
 *
 * This module only reads. It never invokes transport, closes the instance, emits
 * facts or changes topology. It does not reimplement instance creation: the
 * `instance` argument is the actual return value of
 * `spendingAlertsFor(graph, defaults).compose(inputs)`.
 */
import type { Graph } from "../../packages/ts/src/graph/graph.js";
import type { DescribeSnapshot } from "../../packages/ts/src/graph/describe.js";
import type { Node } from "../../packages/ts/src/node/node.js";
import type { StartupFact } from "../../packages/ts/src/graph/construction-scope.js";
import type {
	CausalEffectOutcome,
	CausalQuiescence,
	CommittedEffectsView,
} from "../../packages/ts/src/solutions/causal-occurrence/contracts.js";
import type { Publication } from "./causal-publication.js";
import type { SpendingAlertsView } from "./causal-preset.js";

/**
 * The exact shape produced by `spendingAlertsFor(graph, defaults).compose(inputs)`
 * (see causal-entry.ts:70-74 and causal-focused-host.ts:113-121).
 *
 * `view` and `capabilities` are the original handles; `inspect()` is the host's
 * private read-only diagnostics closure (causal-focused-host.ts:558-576).
 */
export interface ComposedSpendingInstance {
	readonly consume: Readonly<{
		readonly view: SpendingAlertsView;
		readonly capabilities: {
			readonly retained: Readonly<{
				readonly retainedQuiescence: Node<CausalQuiescence>;
			}>;
		};
	}>;
	readonly view: SpendingAlertsView;
	readonly capabilities: {
		readonly retained: Readonly<{
			readonly retainedQuiescence: Node<CausalQuiescence>;
		}>;
	};
	readonly owner: Readonly<{
		readonly instance: string;
		readonly phase: "owned" | "starting" | "started" | "faulted";
		readonly startup: Node<StartupFact>;
	}>;
	readonly runEndReady: Node<boolean>;
	readonly inspect: () => HostInspection;
}

/** One retained request/admission/outcome record (causal-focused-host.ts:47-51, 571-574). */
export interface HostRecord {
	readonly request: Readonly<{
		readonly requestRef: { readonly kind: string; readonly id: string };
		readonly body: Readonly<{
			readonly occurrence: {
				readonly revisionDomain: string;
				readonly occurrenceId: string;
				readonly revision: number;
				readonly digest: string;
			};
			readonly payloadDigest: string;
			readonly sourceDigest: string;
			readonly runtimeDigest: string;
			readonly hostEpoch: number;
			readonly compositionEpoch: number;
		}>;
	}>;
	readonly admission: Readonly<{
		readonly admissionRef: { readonly kind: string; readonly id: string };
		readonly state: "admitted" | "rejected";
	}>;
	readonly outcome?: CausalEffectOutcome;
}

/** The host's own read-only diagnostics snapshot (causal-focused-host.ts:558-576). */
export interface HostInspection {
	readonly fault?: string;
	readonly dispatchStopped: boolean;
	readonly resourceMode: string;
	readonly normalEndReady: boolean;
	readonly writes: number;
	readonly inFlight: number;
	readonly scheduled: boolean;
	readonly delivering: boolean;
	readonly notifications: number;
	readonly maxFrameBytes: number;
	readonly records: readonly HostRecord[];
}

/**
 * Readiness of the target instance's host, kept distinct from termination.
 *
 * `startupState` is the startup fact's own state (construction-scope.ts:18-24);
 * `started` only means the instance started, not that it was authorized, that it
 * succeeded, or that the run terminated (README.md:139).
 *
 * `normalEndReady` is a current readiness condition, not proof of lifecycle
 * termination or resource release (README.md:144, causal-focused-host.ts:563-564).
 */
export interface HostReadiness {
	readonly startupState: StartupFact["state"] | "unavailable";
	readonly phase: "owned" | "starting" | "started" | "faulted";
	readonly normalEndReady: boolean;
	readonly runEndReady: boolean;
	readonly inFlight: number;
	readonly writes: number;
	readonly dispatchStopped: boolean;
	readonly fault?: string;
}

/**
 * The publication-derived authority lookup. When the target has no publication
 * yet, `authorityId` and `authority` are `undefined` (unavailable) even if some
 * other instance in the same Graph has published (README.md:113-123).
 */
export interface AuthorityLookup {
	readonly authorityId: string | undefined;
	readonly authority: Node<unknown> | undefined;
}

/**
 * A publication row joined to the exact retained host record that shares its
 * request reference (causal-graded-demo.ts:207-238).
 */
export interface CorrelatedRow {
	readonly requestRef: { readonly kind: string; readonly id: string };
	readonly recorded: string;
	readonly hostOutcomeState: CausalEffectOutcome["state"] | undefined;
	readonly hostRecord: HostRecord | undefined;
}

/**
 * The complete read-only inspection result. `graph` is the whole owning Graph
 * snapshot (nodes and edges), never a count or a filtered subgraph
 * (README.md:109-123).
 */
export interface SpendingInstanceInspection {
	readonly graph: DescribeSnapshot;
	readonly host: HostInspection;
	readonly readiness: HostReadiness;
	readonly publication: Publication | undefined;
	readonly retainedQuiescence: CausalQuiescence | undefined;
	readonly authority: AuthorityLookup;
	readonly correlatedRows: readonly CorrelatedRow[];
}

function sameRef(
	a: { readonly kind: string; readonly id: string } | undefined,
	b: { readonly kind: string; readonly id: string } | undefined,
): boolean {
	return a !== undefined && b !== undefined && a.kind === b.kind && a.id === b.id;
}

/**
 * Read-only inspection of one composed spending instance in a shared Graph.
 *
 * The target is located through its own handles (`instance.view`,
 * `instance.capabilities`, `instance.inspect()`), never by scanning the Graph for
 * a node whose name ends in `/causal/authority` (README.md:118-120).
 */
export function inspectSpendingInstance(
	graph: Graph,
	instance: ComposedSpendingInstance,
): SpendingInstanceInspection {
	// 1. Complete owning Graph snapshot: nodes AND edges, no explain-path filter.
	const graphSnapshot: DescribeSnapshot = graph.describe();

	// 2. Target host records and readiness, from the instance's own diagnostics.
	const host: HostInspection = instance.inspect();

	// 3. Current publication of THIS instance (undefined until it publishes).
	const publication: Publication | undefined = instance.view.publication.cache;

	// 4. Retained quiescence of THIS instance.
	const retainedQuiescence: CausalQuiescence | undefined =
		instance.capabilities.retained.retainedQuiescence.cache;

	// 5. Authority lookup derived from the target's own publication only.
	//    No publication => unavailable, even when another instance published.
	const authorityId: string | undefined = publication?.authorityId;
	const authority: Node<unknown> | undefined =
		authorityId === undefined ? undefined : graph.find(authorityId);

	// 6. Correlate graph-held publication rows with host records by exact request ref.
	const correlatedRows: CorrelatedRow[] = (publication?.rows ?? []).map((row) => {
		const requestRef = row.proposal.requestRef;
		const hostRecord = host.records.find((record) =>
			sameRef(record.request.requestRef, requestRef),
		);
		return Object.freeze({
			requestRef,
			recorded: row.recorded,
			hostOutcomeState: hostRecord?.outcome?.state,
			hostRecord,
		});
	});

	const startupState: StartupFact["state"] | "unavailable" =
		instance.owner.startup.cache?.state ?? "unavailable";

	const readiness: HostReadiness = Object.freeze({
		startupState,
		phase: instance.owner.phase,
		normalEndReady: host.normalEndReady,
		runEndReady: instance.runEndReady.cache === true,
		inFlight: host.inFlight,
		writes: host.writes,
		dispatchStopped: host.dispatchStopped,
		...(host.fault === undefined ? {} : { fault: host.fault }),
	});

	return Object.freeze({
		graph: graphSnapshot,
		host,
		readiness,
		publication,
		retainedQuiescence,
		authority: Object.freeze({ authorityId, authority }),
		correlatedRows: Object.freeze(correlatedRows),
	});
}
