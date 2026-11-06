import assert from "node:assert/strict";
import test from "node:test";
import {
	auditFeasibility,
	syntheticPlan,
	targetedGraphChunks,
} from "./api-feasibility.mjs";
import { prepareBundle } from "./api-prepare.mjs";
import { LIMITS } from "./api-limits.mjs";

const bundle = prepareBundle();
test("complete synthetic plans retain orientation, all cases, both phase boundaries without entry work", () => {
	for (const subject of bundle.slots) {
		const plan = syntheticPlan(subject, "all-source", "expanded-relations");
		assert.ok(
			syntheticPlan(subject)
				.flat()
				.every((request) => !request.path?.endsWith("/relations.json")),
		);
		assert.deepEqual(plan[0], [{ op: "read", path: "orientation.json" }]);
		for (const [phase, readIndex, submitIndex] of [
			["A", 1, 2],
			["B", 3, 4],
		]) {
			assert.deepEqual(
				plan[readIndex].map((r) => r.path),
				[
					`${phase}/common.json`,
					`${phase}/relations.json`,
					...subject.slot.cases.map((c) => `${phase}/${c}.json`),
				],
			);
			assert.deepEqual(
				plan[submitIndex].map((r) => r.scenario),
				subject.slot.cases,
			);
			assert.ok(plan[submitIndex].every((r) => r.phase === phase));
		}
		assert.ok(plan.every((batch) => batch.length > 0 && batch.length <= 16));
		assert.ok(plan.flat().length <= LIMITS.calls);
		assert.equal(plan.length, 5);
		assert.ok(plan.flat().every((r) => !r.path?.startsWith("entry/")));
	}
});
test("real bounded runner audits all allocations without networking, cap bypass or fabricated small token counts", async () => {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = () => {
		throw new Error("Offline audit attempted network access");
	};
	try {
		const report = await auditFeasibility(bundle);
		assert.equal(report.providerCalls, 0);
		assert.equal(report.actualCostUSD, 0);
		assert.equal(report.runs.length, 54);
		for (const materialMode of ["required-packet", "expanded-relations"])
			assert.deepEqual(
				report.runs
					.filter((r) => r.materialMode === materialMode)
					.map((r) => r.slot.id),
				bundle.slots.map((s) => s.slot.id),
			);
		for (const expansion of [
			"task-focused",
			"all-source",
			"targeted-graph",
			"indexed-targeted",
			"search-guided",
		])
			assert.deepEqual(
				report.runs
					.filter((r) => r.expansion === expansion)
					.map((r) => r.slot.id),
				bundle.entrySlots.map((s) => s.slot.id),
			);
		for (const run of report.runs) {
			assert.equal(run.fatal, null, `${run.slot.id}: ${run.fatal}`);
			assert.equal(
				run.controllerAuditValid,
				run.experiment === "entry" ? null : true,
			);
			assert.equal(
				run.requests[0].messageCount,
				run.experiment === "entry" ? 3 : 2,
			);
			assert.ok(run.requests[0].estimatedInputTokens > 100);
			for (let i = 1; i < run.requests.length; i++)
				assert.ok(
					run.requests[i].messageCount > run.requests[i - 1].messageCount,
				);
			assert.equal(
				run.estimatedUsage.inputTokens,
				run.requests
					.filter((r) => r.dispatched)
					.reduce((sum, r) => sum + r.estimatedInputTokens, 0),
			);
			assert.equal(
				run.estimatedUsage.outputTokens,
				run.requests
					.filter((r) => r.dispatched)
					.reduce((sum, r) => sum + r.syntheticOutputEstimate, 0),
			);
			assert.ok(run.estimatedUsage.inputTokens <= LIMITS.inputTokens);
			assert.ok(run.estimatedUsage.outputTokens <= LIMITS.outputTokens);
			if (run.complete) {
				if (run.experiment === "comparison") {
					assert.deepEqual(run.answers, [8, 8]);
					assert.deepEqual(run.seals, ["seal-A", "seal-B"]);
				} else {
					assert.equal(run.answers, null);
					assert.deepEqual(run.seals, []);
					assert.equal(run.entryStatus, "submitted");
				}
			} else {
				assert.ok(run.budgetStops.length > 0);
				assert.ok(run.consumedBatches < run.plannedCalls);
			}
		}
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("independent entry plans start with task and retain all source assumptions and planned work", () => {
	assert.equal(bundle.entrySlots.length, 6);
	for (const subject of bundle.entrySlots) {
		const full = syntheticPlan(subject, "all-source");
		const focused = syntheticPlan(subject, "task-focused");
		assert.deepEqual(full[0], [{ op: "read", path: "entry/task.json" }]);
		assert.ok(
			full.flat().every((r) => r.op === "submit" || typeof r.path === "string"),
		);
		assert.equal(
			full.flat().filter((r) => r.startLine !== undefined).length,
			Object.keys(subject.entryFiles).filter((p) =>
				p.startsWith("entry/source"),
			).length,
		);
		assert.ok(focused.flat().length < full.flat().length);
		assert.equal(full.at(-1)[0].op, "submit");
		assert.ok(full.every((batch) => batch.length > 0 && batch.length <= 16));
		assert.ok(full.flat().length <= LIMITS.calls);
	}
});

test("targeted Graph navigation retains full method spans and all other focused source", () => {
	for (const subject of bundle.entrySlots.filter(
		(s) => s.slot.role !== "user",
	)) {
		const selected = targetedGraphChunks(subject);
		assert.ok(selected.paths.length > 0);
		for (const r of selected.ranges)
			for (
				let c = Math.floor((r.start - 1) / 80);
				c <= Math.floor((r.end - 1) / 80);
				c++
			)
				assert.ok(selected.paths.some((p) => p.endsWith(`/chunk${c}.txt`)));
		const graphPrefix = selected.source;
		const paths = (expansion) =>
			syntheticPlan(subject, expansion)
				.flat()
				.filter((r) => r.op === "read")
				.map((r) => r.path);
		assert.deepEqual(
			paths("targeted-graph").filter((p) => !p.startsWith(graphPrefix)),
			paths("task-focused").filter((p) => !p.startsWith(graphPrefix)),
		);
		assert.ok(paths("targeted-graph").length < paths("task-focused").length);
	}
});

test("targeted navigation rejects drift instead of reusing stale source locations", () => {
	const subject = structuredClone(
		bundle.entrySlots.find((s) => s.slot.role === "maintainer"),
	);
	const selected = targetedGraphChunks(subject);
	subject.entryFiles[selected.paths[0]] += "\n9999: // drift";
	assert.throws(() => targetedGraphChunks(subject), /source hash mismatch/);
});

test("indexed trajectory pays for navigation before reading identical targeted source", () => {
	for (const subject of bundle.entrySlots) {
		const plain = syntheticPlan(subject, "targeted-graph");
		const indexed = syntheticPlan(subject, "indexed-targeted");
		const nav = indexed[1];
		assert.ok(nav.length > 0 && nav.every((r) => r.op === "search"));
		assert.deepEqual([indexed[0], ...indexed.slice(2)], plain);
		assert.ok(nav.every((r) => r.limit === 5 && r.query === "export"));
	}
});
