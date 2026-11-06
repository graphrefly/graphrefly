import { CEILING_USD } from "./api-provider.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { closeBudgetReconciliation } from "./budget-closure.mjs";
const audit = {
	reportedUsageUSD: CEILING_USD - 1.2,
	unresolvedReservationsUSD: 0.95,
	reservations: [
		{
			journal: "run/journal.jsonl",
			rowIndex: 1,
			eventHash: "a".repeat(64),
			generationId: "gen-1",
			request: { reserveUSD: 0.31 },
		},
		{
			journal: "run/journal.jsonl",
			rowIndex: 2,
			eventHash: "b".repeat(64),
			generationId: null,
			request: { reserveUSD: 0.64 },
		},
	],
};
const samples = [1, 2, 3, 4].map((i) => ({
	sampleId: `sample-${i}`,
	taskId: `task-${i}`,
}));
const lookup = {
	generationId: "gen-1",
	checkedAt: "2026-09-18T03:07:47Z",
	endpoint: "GET /api/v1/generation",
	httpStatus: 404,
	response: { error: { code: 404 } },
};
const close = (patch = {}) =>
	closeBudgetReconciliation({ audit, samples, lookups: [lookup], ...patch });
test("404 and missing IDs close audit pass while retaining every reservation and planned sample", () => {
	const r = close();
	assert.equal(r.state, "closed");
	assert.equal(r.accountingSettled, false);
	assert.equal(r.unresolvedReservationsUSD, 0.95);
	assert.equal(r.releasedReservationsUSD, 0);
	assert.equal(r.fitsBudget, false);
	assert.equal(r.automaticRetryAllowed, false);
	assert.equal(r.metadataRequests, 0);
	assert.equal(r.generationCalls, 0);
	assert.deepEqual(
		r.reservations.map((x) => x.status),
		["unresolved-record-not-found", "unresolved-no-generation-id"],
	);
	assert.equal(r.denominator, 4);
	assert.ok(
		r.rows.every(
			(x) => x.status === "not-run" && x.reason === "budget-not-admitted",
		),
	);
	assert.deepEqual(close(), r);
});
test("even matching zero-cost receipt requires accounting audit; wrong IDs and malformed costs never settle", () => {
	for (const [data, status] of [
		[
			{ id: "gen-1", total_cost: 0 },
			"receipt-available-needs-accounting-audit",
		],
		[{ id: "other", total_cost: 0 }, "unresolved-lookup-failed"],
		[{ id: "gen-1", total_cost: -1 }, "unresolved-lookup-failed"],
	]) {
		const r = close({
			lookups: [{ ...lookup, httpStatus: 200, response: { data } }],
		});
		assert.equal(r.reservations[0].status, status);
		assert.equal(r.releasedReservationsUSD, 0);
		assert.equal(r.fitsBudget, false);
	}
});
test("network error, HTTP errors and no lookup remain distinct bounded outcomes", () => {
	for (const httpStatus of [null, 429, 503])
		assert.equal(
			close({ lookups: [{ ...lookup, httpStatus }] }).reservations[0].status,
			"unresolved-lookup-failed",
		);
	assert.equal(
		close({ lookups: [] }).reservations[0].status,
		"unresolved-not-queried",
	);
});
test("reject duplicate/unbound receipts, reservation duplicates, bad totals, and altered sample count", () => {
	assert.throws(() => close({ lookups: [lookup, lookup] }), /duplicate/);
	assert.throws(
		() => close({ lookups: [{ ...lookup, generationId: "other" }] }),
		/unbound/,
	);
	assert.throws(
		() =>
			close({
				audit: {
					...audit,
					reservations: [audit.reservations[0], audit.reservations[0]],
				},
			}),
		/duplicate/,
	);
	assert.throws(
		() => close({ audit: { ...audit, unresolvedReservationsUSD: 0 } }),
		/total/,
	);
	assert.throws(
		() => close({ audit: { ...audit, reportedUsageUSD: NaN } }),
		/audit/,
	);
	assert.throws(() => close({ samples: samples.slice(1) }), /samples/);
});
test("budget availability is never authorization and exhausted budgets keep all four rows", () => {
	const free = close({
		audit: {
			...audit,
			reportedUsageUSD: 0,
			reservations: [],
			unresolvedReservationsUSD: 0,
		},
		lookups: [],
	});
	assert.equal(free.fitsBudget, true);
	assert.equal(free.authorization, false);
	assert.ok(free.rows.every((x) => x.reason === "not-dispatched"));
	const exhausted = close({
		audit: { ...audit, reportedUsageUSD: CEILING_USD },
	});
	assert.equal(exhausted.fitsBudget, false);
	assert.equal(exhausted.rows.length, 4);
});
