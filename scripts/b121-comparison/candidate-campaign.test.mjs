import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import { digest } from "./frozen-compiler.mjs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	prepareCandidateManifest,
	runCandidateCampaign,
	readCandidateCampaign,
} from "./candidate-campaign.mjs";
import { hash } from "./session.mjs";
import { CEILING_USD, ROUTE, MAX_GENERATION_CALLS, maximumCost } from "./api-provider.mjs";
import { RETRY_POLICY, QUALIFICATION_READS, QUALIFICATION_SUBMISSIONS } from "./api-transport.mjs";

const candidateDirectory = fileURLToPath(
	new URL(
		"../../sessions/active/b121-comparison-design-v1/agent-api/candidate-round-v2/",
		import.meta.url,
	),
);
const budget = (reportedUsageUSD = 0, unresolvedReservationsUSD = 0) => ({
	ceilingUSD: CEILING_USD,
	reportedUsageUSD,
	unresolvedReservationsUSD,
	asOf: new Date().toISOString(),
	receiptSHA256: "a".repeat(64),
});
const approval = (manifest) => ({
	manifestSHA: hash(manifest),
	action: "B121-agent-api-one-shot",
	acceptAliasLimitation: true,
	acceptInputEstimateLimitation: true,
	model: ROUTE.model,
	providerTag: ROUTE.tag,
	expiresAt: new Date(Date.now() + 3600000).toISOString(),
	maxGenerationCalls: MAX_GENERATION_CALLS,
	maxUSD: CEILING_USD,
	retries: RETRY_POLICY,
	priorUsageUSD: manifest.budget.reportedUsageUSD + manifest.budget.unresolvedReservationsUSD,
});
const submit = {
	op: "submit",
	snippet: "export const synthetic = 1;",
	explanation: "Synthetic transport test; not a participant answer.",
	concepts: { read: [], required: [], firstExpansion: null },
};
function fake(mode = "success") {
	let count = 0;
	const payloads = [];
	return {
		get count() {
			return count;
		},
		payloads,
		fetchImpl: async (url, options) => {
			const payload = JSON.parse(options.body);
			payloads.push(payload);
			count++;
			const qualifications = [
				QUALIFICATION_READS[0],
				QUALIFICATION_SUBMISSIONS[0],
				QUALIFICATION_READS[1],
				QUALIFICATION_SUBMISSIONS[1],
			];
			let requests = count <= 4 ? qualifications[count - 1] : [submit];
			if (mode === "participant" && count === 5)
				requests = [{ op: "read", path: "reviewer-rubric.json" }];
			if (mode === "material" && count === 5)
				requests = [
					{ ...submit, snippet: 'import "./causal-graded-demo.js";' },
					{ op: "read", path: "reviewer-rubric.json" },
				];
			const body = {
				id: `offline-${count}`,
				model: ROUTE.model,
				provider: mode === "route" && count === 5 ? "WrongProvider" : ROUTE.provider,
				usage: {
					prompt_tokens: 100,
					completion_tokens: 20,
					total_tokens: 120,
					cost: maximumCost(100, 20),
				},
				choices: [
					{
						finish_reason: mode === "qualification" ? "length" : "tool_calls",
						message: {
							role: "assistant",
							content: null,
							tool_calls: [
								{
									type: "function",
									id: `call-${count}`,
									function: {
										name: "broker",
										arguments: JSON.stringify({ requests }),
									},
								},
							],
						},
					},
				],
			};
			const response = new Response(JSON.stringify(body), { status: 200 });
			Object.defineProperty(response, "url", { value: url });
			return response;
		},
	};
}
async function fixture(fn, b = budget(), brokenCompiler = false) {
	const outputRoot = mkdtempSync(join(tmpdir(), "b121-fixed-campaign-"));
	try {
		let materialDirectory = candidateDirectory;
		if (brokenCompiler) {
			materialDirectory = join(outputRoot, "broken");
			mkdirSync(materialDirectory);
			for (const name of [
				"materials.json",
				"tasks.json",
				"reviewer-rubric.json",
				"integration-pins.json",
				"compiler-environment.json.gz",
			])
				copyFileSync(join(candidateDirectory, name), join(materialDirectory, name));
			const env = JSON.parse(
				gunzipSync(readFileSync(join(materialDirectory, "compiler-environment.json.gz"))),
			);
			env.compilerJS = 'throw Error("synthetic compiler failure");';
			const bytes = JSON.stringify(env);
			writeFileSync(join(materialDirectory, "compiler-environment.json.gz"), gzipSync(bytes));
			const pins = JSON.parse(readFileSync(join(materialDirectory, "integration-pins.json")));
			pins.environmentSHA256 = digest(bytes);
			writeFileSync(join(materialDirectory, "integration-pins.json"), JSON.stringify(pins));
		}
		const manifest = prepareCandidateManifest({
			candidateDirectory: materialDirectory,
			budget: b,
			outputRoot,
		});
		await fn({
			outputRoot,
			manifest,
			approval: approval(manifest),
			candidateDirectory: materialDirectory,
			apiKey: "FAKE-OFFLINE-KEY",
		});
	} finally {
		rmSync(outputRoot, { recursive: true, force: true });
	}
}
test("three frozen tasks retain denominator three and reject forged denominator before calls", async () => {
	await fixture(async (input) => {
		const local = join(input.outputRoot, "three");
		mkdirSync(local);
		for (const name of ["materials.json", "compiler-environment.json.gz"])
			copyFileSync(join(candidateDirectory, name), join(local, name));
		const tasks = JSON.parse(readFileSync(join(candidateDirectory, "tasks.json")));
		tasks.tasks = tasks.tasks.slice(0, 3);
		const taskJSON = JSON.stringify(tasks);
		const rubric = JSON.parse(readFileSync(join(candidateDirectory, "reviewer-rubric.json")));
		rubric.tasks = rubric.tasks.filter((r) => tasks.tasks.some((t) => t.id === r.id));
		rubric.taskSHA256 = digest(taskJSON);
		const rubricJSON = JSON.stringify(rubric);
		const pins = JSON.parse(readFileSync(join(candidateDirectory, "integration-pins.json")));
		Object.assign(pins, { taskSHA256: digest(taskJSON), rubricSHA256: digest(rubricJSON) });
		writeFileSync(join(local, "tasks.json"), taskJSON);
		writeFileSync(join(local, "reviewer-rubric.json"), rubricJSON);
		writeFileSync(join(local, "integration-pins.json"), JSON.stringify(pins));
		const manifest = prepareCandidateManifest({
			candidateDirectory: local,
			outputRoot: input.outputRoot,
			budget: budget(),
		});
		assert.equal(manifest.policy.denominator, 3);
		const wire = fake();
		const forged = structuredClone(manifest);
		forged.policy.denominator = 4;
		await assert.rejects(
			() =>
				runCandidateCampaign({
					...input,
					candidateDirectory: local,
					manifest: forged,
					approval: approval(forged),
					fetchImpl: wire.fetchImpl,
				}),
			/fixed sample\/policy mismatch/,
		);
		assert.equal(wire.count, 0);
		const { summary } = await runCandidateCampaign({
			...input,
			candidateDirectory: local,
			manifest,
			approval: approval(manifest),
			fetchImpl: wire.fetchImpl,
		});
		assert.equal(wire.count, 7);
		assert.equal(summary.denominator, 3);
		assert.equal(summary.rows.length, 3);
		assert.equal(summary.completedCollection, true);
	});
});
test("budget admission uses reported usage PLUS unresolved reservations before even qualification", async () => {
	await fixture(
		async (input) => {
			const wire = fake();
			const { directory, summary } = await runCandidateCampaign({
				...input,
				fetchImpl: wire.fetchImpl,
			});
			assert.equal(wire.count, 0);
			assert.equal(summary.failure, "budget-not-admitted");
			assert.equal(summary.denominator, 4);
			assert(
				summary.rows.every((r) => r.status === "not-run" && r.reason === "budget-not-admitted"),
			);
			assert.deepEqual(readCandidateCampaign(directory), summary);
			await assert.rejects(
				() => runCandidateCampaign({ ...input, fetchImpl: wire.fetchImpl }),
				/EEXIST/,
			);
			assert.equal(wire.count, 0);
		},
		budget(CEILING_USD - 1.201425412, 0.9541632),
	);
});
test("four fixed sessions run once, remain pending independent review, and preserve full evidence", async () => {
	await fixture(async (input) => {
		const wire = fake();
		const { directory, summary } = await runCandidateCampaign({
			...input,
			fetchImpl: wire.fetchImpl,
		});
		assert.equal(wire.count, 8);
		assert.equal(summary.failure, null);
		assert.equal(summary.denominator, 4);
		assert.equal(summary.completedCollection, true);
		assert(summary.rows.every((r) => r.status === "pending-review"));
		assert(summary.scoresPending);
		for (const row of summary.rows) {
			const data = JSON.parse(readFileSync(join(directory, `${row.sampleId}.assessment.json`)));
			assert.equal(data.assessment.kind, "candidate-session");
			assert.equal(data.assessment.taskId, row.taskId);
			assert.equal(hash(data.assessment), row.assessmentSHA256);
		}
		for (const payload of wire.payloads.slice(4)) {
			assert.equal(payload.messages.length, 3);
			assert.equal(JSON.parse(payload.messages.at(-1).content).kind, "controller_budget_status");
			assert(!JSON.stringify(payload.messages).includes("Synthetic channel"));
		}
		assert.deepEqual(readCandidateCampaign(directory), summary);
	});
});
for (const mode of ["participant", "route", "qualification"])
	test(`${mode} failure keeps original sample table with no replacement`, async () => {
		await fixture(async (input) => {
			const wire = fake(mode);
			const { summary } = await runCandidateCampaign({
				...input,
				fetchImpl: wire.fetchImpl,
			});
			assert.equal(summary.rows.length, 4);
			assert.equal(summary.denominator, 4);
			if (mode === "participant") {
				assert.equal(wire.count, 8);
				assert.equal(summary.rows[0].status, "incomplete");
				assert.equal(summary.rows.filter((r) => r.status === "pending-review").length, 3);
			} else if (mode === "route") {
				assert.equal(wire.count, 5);
				assert.equal(summary.rows.filter((r) => r.status === "not-run").length, 3);
				assert(summary.failure);
			} else {
				assert.equal(wire.count, 1);
				assert(summary.rows.every((r) => r.status === "not-run"));
				assert(summary.failure);
			}
		});
	});
test("manifest, subset/retry authorization, and budget-coordinate tampering are rejected before calls", async () => {
	await fixture(async (input) => {
		const wire = fake();
		for (const patch of [
			{ sessionIds: ["candidate-entry-01"] },
			{ attemptId: "again" },
			{ priorUsageUSD: 0.1 },
		])
			await assert.rejects(
				() =>
					runCandidateCampaign({
						...input,
						approval: { ...input.approval, ...patch },
						fetchImpl: wire.fetchImpl,
					}),
				/exact candidate/,
			);
		const changed = structuredClone(input.manifest);
		changed.samples.pop();
		await assert.rejects(
			() =>
				runCandidateCampaign({
					...input,
					manifest: changed,
					approval: approval(changed),
					fetchImpl: wire.fetchImpl,
				}),
			/sample\/policy mismatch/,
		);
		const drift = structuredClone(input.manifest);
		drift.codeBindings[0].sha256 = "b".repeat(64);
		await assert.rejects(
			() =>
				runCandidateCampaign({
					...input,
					manifest: drift,
					approval: approval(drift),
					fetchImpl: wire.fetchImpl,
				}),
			/implementation drift/,
		);
		assert.equal(wire.count, 0);
		await assert.rejects(
			() =>
				runCandidateCampaign({
					...input,
					outputRoot: join(input.outputRoot, "alternate"),
					fetchImpl: wire.fetchImpl,
				}),
			/output root mismatch/,
		);
		assert.equal(wire.count, 0);
	});
});
for (const committed of [CEILING_USD, CEILING_USD + 0.01])
	test(`fully exhausted budget ${committed} still records all four unrun samples`, async () => {
		await fixture(async (input) => {
			const wire = fake();
			const { summary } = await runCandidateCampaign({
				...input,
				fetchImpl: wire.fetchImpl,
			});
			assert.equal(wire.count, 0);
			assert.equal(summary.failure, "budget-not-admitted");
			assert(summary.rows.every((r) => r.status === "not-run"));
		}, budget(committed));
	});
for (const mode of ["compiler", "material"])
	test(`${mode} failure stops remaining samples even alongside a participant fatal`, async () => {
		await fixture(
			async (input) => {
				const wire = fake(mode);
				const { directory, summary } = await runCandidateCampaign({
					...input,
					fetchImpl: wire.fetchImpl,
				});
				assert.equal(wire.count, 5);
				assert.equal(summary.denominator, 4);
				assert.equal(summary.rows.filter((r) => r.status === "not-run").length, 3);
				assert(summary.failure);
				const { assessment } = JSON.parse(
					readFileSync(join(directory, "candidate-entry-01.assessment.json")),
				);
				assert(assessment.result.entryAnswer);
				assert(assessment.compilerReceipt);
				if (mode === "compiler") assert(assessment.compilerFailure);
				else {
					assert(assessment.result.fatal);
					assert(assessment.compilation.materialDiagnostics.length);
					assert.equal(summary.failure, "material-diagnostics");
				}
			},
			budget(),
			mode === "compiler",
		);
	});
test("recovery retains interrupted sample without dispatch and detects journal/summary drift", async () => {
	await fixture(async (input) => {
		const wire = fake("route");
		const { directory } = await runCandidateCampaign({
			...input,
			fetchImpl: wire.fetchImpl,
		});
		const path = join(directory, "journal.jsonl");
		const lines = readFileSync(path, "utf8").trim().split("\n");
		const cut = lines.findIndex((l) => JSON.parse(l).event.type === "sample-started");
		assert(cut >= 0);
		const summaryPath = join(directory, "summary.json");
		const changedSummary = JSON.parse(readFileSync(summaryPath));
		changedSummary.denominator = 3;
		writeFileSync(summaryPath, JSON.stringify(changedSummary));
		assert.throws(() => readCandidateCampaign(directory), /summary drift/);
		rmSync(join(directory, "summary.json"));
		const missingSummary = readCandidateCampaign(directory);
		assert.equal(missingSummary.completedCollection, false);
		assert.equal(missingSummary.persistenceFailure, true);
		assert.equal(missingSummary.failure, "final-summary-not-persisted");
		assert.equal(missingSummary.retryAllowed, false);
		writeFileSync(path, lines.slice(0, cut + 1).join("\n") + "\n");
		const recovered = readCandidateCampaign(directory);
		assert.equal(recovered.rows[0].status, "interrupted-or-running");
		assert.equal(recovered.rows.filter((r) => r.status === "not-run").length, 3);
		assert.equal(recovered.retryAllowed, false);
		writeFileSync(path, readFileSync(path, "utf8") + '{"index":');
		const partial = readCandidateCampaign(directory);
		assert.equal(partial.journalTailIncomplete, true);
		assert.equal(partial.rows[0].status, "interrupted-or-running");
		writeFileSync(path, readFileSync(path, "utf8").replace("sample-started", "sample-invalid"));
		assert.throws(() => readCandidateCampaign(directory), /journal drift/);
	});
});
