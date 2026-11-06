/** Offline audit closure. No HTTP, retries, authorization, or reservation release. */
import { CEILING_USD, maximumCost, ROUTE } from "./api-provider.mjs";
import { MAX_OUTPUT_PER_REQUEST } from "./api-runner.mjs";
import { hash } from "./session.mjs";

const check = (v, m) => {
	if (!v) throw Error(m);
};
const money = (v) => Number.isFinite(v) && v >= 0;

/** Close one supplied evidence set. A new lookup must be explicitly invoked by the caller;
 * cached 404s are terminal for this pass. Even a found receipt needs accounting audit:
 * aggregate key usage may already include its cost, so never add/release it here.
 */
export function closeBudgetReconciliation({ audit, lookups, samples }) {
	check(
		money(audit?.reportedUsageUSD) && Array.isArray(audit.reservations),
		"invalid audit",
	);
	check(
		Array.isArray(lookups) &&
			Array.isArray(samples) &&
			samples.length === 4 &&
			new Set(samples.map((s) => s.sampleId)).size === 4 &&
			samples.every(
				(s) => typeof s.sampleId === "string" && s.sampleId.length > 0,
			),
		"fixed samples and lookup evidence required",
	);
	const identities = new Set();
	for (const r of audit.reservations) {
		check(
			typeof r.journal === "string" &&
				Number.isSafeInteger(r.rowIndex) &&
				r.rowIndex >= 0 &&
				/^[a-f0-9]{64}$/.test(r.eventHash) &&
				money(r.request?.reserveUSD),
			"invalid reservation evidence",
		);
		const id = `${r.journal}:${r.rowIndex}`;
		check(!identities.has(id), "duplicate reservation");
		identities.add(id);
	}
	const ids = new Set(
		audit.reservations.map((r) => r.generationId).filter(Boolean),
	);
	const receipts = new Map();
	for (const l of lookups) {
		check(
			ids.has(l.generationId) &&
				!receipts.has(l.generationId) &&
				Number.isFinite(Date.parse(l.checkedAt)) &&
				l.endpoint === "GET /api/v1/generation" &&
				(l.httpStatus === null ||
					(Number.isInteger(l.httpStatus) &&
						l.httpStatus >= 100 &&
						l.httpStatus <= 599)),
			"unbound or duplicate lookup evidence",
		);
		receipts.set(l.generationId, l);
	}
	const reservations = audit.reservations.map((r) => {
		const receipt = receipts.get(r.generationId);
		const found =
			receipt?.httpStatus === 200 &&
			receipt.response?.data?.id === r.generationId &&
			money(receipt.response.data.total_cost);
		return {
			journal: r.journal,
			rowIndex: r.rowIndex,
			eventHash: r.eventHash,
			generationId: r.generationId ?? null,
			retainedUSD: r.request.reserveUSD,
			status: !r.generationId
				? "unresolved-no-generation-id"
				: !receipt
					? "unresolved-not-queried"
					: found
						? "receipt-available-needs-accounting-audit"
						: receipt.httpStatus === 404
							? "unresolved-record-not-found"
							: "unresolved-lookup-failed",
			lookupSHA256: receipt ? hash(receipt) : null,
		};
	});
	const unresolvedReservationsUSD = reservations.reduce(
		(sum, r) => sum + r.retainedUSD,
		0,
	);
	check(
		Math.abs(unresolvedReservationsUSD - audit.unresolvedReservationsUSD) <
			1e-9,
		"reservation total mismatch",
	);
	const committedUSD = audit.reportedUsageUSD + unresolvedReservationsUSD;
	const nextRequestReserveUSD = maximumCost(
		ROUTE.contextTokens,
		MAX_OUTPUT_PER_REQUEST,
	);
	const fitsBudget = committedUSD + nextRequestReserveUSD <= CEILING_USD;
	return {
		work: "graphrefly:B121",
		kind: "offline-budget-reconciliation-closure",
		auditSHA256: hash(audit),
		state: "closed",
		accountingSettled: reservations.length === 0,
		authorization: false,
		generationCalls: 0,
		metadataRequests: 0,
		automaticRetryAllowed: false,
		releasedReservationsUSD: 0,
		reportedUsageUSD: audit.reportedUsageUSD,
		unresolvedReservationsUSD,
		committedUSD,
		ceilingUSD: CEILING_USD,
		conservativeAvailableUSD: CEILING_USD - committedUSD,
		nextRequestReserveUSD,
		fitsBudget,
		nextAction: fitsBudget
			? "fresh-budget-and-exact-campaign-admission-required"
			: "settlement-evidence-or-explicit-budget-change-required",
		reservations,
		denominator: samples.length,
		rows: samples.map((s) => ({
			...s,
			status: "not-run",
			reason: fitsBudget ? "not-dispatched" : "budget-not-admitted",
		})),
	};
}
