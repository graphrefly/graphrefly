import { copyGraphRuntime } from "./test-fixtures/graph-runtime.mjs";
import { CEILING_USD } from "./api-provider.mjs";
/** Actual campaign consumer plus offline review; all HTTP responses are synthetic. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { QUALIFICATION_READS, QUALIFICATION_SUBMISSIONS } from "./api-transport.mjs";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const base = "sessions/active/b121-comparison-design-v1/agent-api";
function fixture() {
	const temp = mkdtempSync(join(tmpdir(), "b121-entry-consumer-")),
		dir = join(temp, "graphrefly");
	const bytes = readFileSync(join(root, base, "manifest.json")),
		manifest = JSON.parse(bytes);
	for (const path of [
		...manifest.bindings.map((b) => b.path),
		`${base}/manifest.json`,
		`${base}/bundle.json`,
	]) {
		mkdirSync(dirname(join(dir, path)), { recursive: true });
		copyFileSync(join(root, path), join(dir, path));
	}
	copyGraphRuntime(dir, manifest);
	// Synthetic fixtures bind the copied current code, without rewriting historical artifacts.
	for (const binding of manifest.bindings)
		binding.sha256 = createHash("sha256")
			.update(readFileSync(join(dir, binding.path)))
			.digest("hex");
	const fixtureBytes = JSON.stringify(manifest);
	writeFileSync(join(dir, base, "manifest.json"), fixtureBytes);
	const manifestSHA = createHash("sha256").update(fixtureBytes).digest("hex");
	return {
		temp,
		dir,
		manifest,
		manifestSHA,
		bundle: JSON.parse(readFileSync(join(dir, base, "bundle.json"))),
		approval: {
			manifestSHA,
			action: "B121-agent-api-one-shot",
			acceptAliasLimitation: true,
			acceptInputEstimateLimitation: true,
			expiresAt: "2099-01-01",
			maxGenerationCalls: 1444,
			maxUSD: CEILING_USD,
			retries: 0,
			model: "deepseek/deepseek-v4.1-flash",
			providerTag: "together",
		},
	};
}
function submits(subject, phase) {
	return subject.slot.cases.map((scenario) => ({
		op: "submit",
		phase,
		scenario,
		fields: Object.fromEntries(
			Object.entries(
				JSON.parse(subject.files[`${phase}/common.json`].content).answerVocabulary,
			).map(([k, v]) => [k, { value: v[0], citations: [] }]),
		),
		explanation: "synthetic fixture",
	}));
}
for (const valid of [true, false])
	test(`real campaign entry compilation ${valid ? "passes" : "fails"} and offline review persists without HTTP`, async () => {
		const f = fixture(),
			oldFetch = globalThis.fetch;
		let calls = 0;
		try {
			const subject = f.bundle.entrySlots[0];
			assert.equal(subject.slot.arm, "G");
			const batches = [
				[{ op: "read", path: "probe.json" }],
				QUALIFICATION_SUBMISSIONS[0],
				QUALIFICATION_READS[1],
				QUALIFICATION_SUBMISSIONS[1],
				...f.bundle.slots.flatMap((p) => [submits(p, "A"), submits(p, "B")]),
				[
					{
						op: "submit",
						snippet: valid ? "export const value:number=1;" : 'export const value:number="wrong";',
						explanation: "synthetic fixture",
						concepts: { read: [], required: [], firstExpansion: null },
					},
				],
			];
			globalThis.fetch = async (url) => {
				const requests = batches[calls] ?? [{ op: "read", path: "../../forbidden" }];
				calls++;
				const body = {
					id: `fixture_${calls}`,
					model: "deepseek/deepseek-v4.1-flash",
					provider: "Together",
					usage: {
						prompt_tokens: 100,
						completion_tokens: 20,
						total_tokens: 120,
						cost: 0.000054,
					},
					choices: [
						{
							finish_reason: "tool_calls",
							message: {
								role: "assistant",
								content: null,
								tool_calls: [
									{
										type: "function",
										id: `tool_${calls}`,
										function: {
											name: "broker",
											arguments: JSON.stringify({
												requests: requests,
											}),
										},
									},
								],
							},
						},
					],
				};
				const r = new Response(JSON.stringify(body), {
					headers: { "x-request-id": `fixture_${calls}` },
				});
				Object.defineProperty(r, "url", { value: url });
				return r;
			};
			const { runCampaign, reviewCampaignEntries } = await import(
				pathToFileURL(join(f.dir, "scripts/b121-comparison/api-campaign.mjs"))
			);
			if (valid) f.approval.attemptId = "separate-offline-attempt";
			const result = await runCampaign({
				approval: f.approval,
				apiKey: "OFFLINE-FAKE",
			});
			assert.equal(calls, 34);
			const logs = readFileSync(join(result.directory, "journal.jsonl"), "utf8")
				.trim()
				.split("\n")
				.map(JSON.parse);
			const row = logs.findLast((r) => r.event.type === "campaign-finished").event.data
				.entryResults[0];
			assert.equal(row.entry.status, "pending-review");
			assert.equal(row.entry.accepted, false);
			assert.equal(row.entry.compilation.ok, valid);
			assert.ok(row.entry.compilation.diagnostics);
			assert.equal(
				logs.findLast((r) => r.event.type === "campaign-finished").event.data.denominator,
				1344,
			);
			const review = {
				binding: row.entry.binding,
				reviewerId: "synthetic-trusted-review",
				checks: Object.fromEntries(
					[
						"prepared-input-compose",
						"actual-five-port-observation",
						"observation-cleanup-only",
					].map((k) => [
						k,
						{
							passed: false,
							evidence: "Fixture snippet does not implement task.",
						},
					]),
				),
			};
			const saved = reviewCampaignEntries({
				directory: result.directory,
				reviews: { [subject.slot.id]: review },
			});
			assert.equal(saved.entries[0].result.status, "rejected");
			assert.equal(saved.providerCalls, 0);
			assert.equal(calls, 34);
			assert.equal(JSON.parse(readFileSync(saved.path)).entries[0].result.accepted, false);
			assert.throws(
				() =>
					reviewCampaignEntries({
						directory: result.directory,
						reviews: { [subject.slot.id]: review },
					}),
				/EEXIST/,
			);
			assert.throws(
				() =>
					reviewCampaignEntries({
						directory: result.directory,
						reviews: {
							[subject.slot.id]: {
								...review,
								binding: { ...review.binding, snippetHash: "other" },
							},
						},
					}),
				/binding/,
			);
			// An intact journal from one authorized attempt cannot be moved to another claim.
			const swapped = join(dirname(result.directory), `${f.manifestSHA}--swapped`);
			mkdirSync(swapped);
			writeFileSync(
				join(swapped, "approval.json"),
				JSON.stringify({ ...f.approval, attemptId: "swapped" }),
			);
			copyFileSync(join(result.directory, "journal.jsonl"), join(swapped, "journal.jsonl"));
			assert.throws(
				() =>
					reviewCampaignEntries({
						directory: swapped,
						reviews: { [subject.slot.id]: review },
					}),
				/completed campaign journal required/,
			);
			logs[1].event.type = "tampered";
			writeFileSync(
				join(result.directory, "journal.jsonl"),
				logs.map(JSON.stringify).join("\n") + "\n",
			);
			assert.throws(
				() =>
					reviewCampaignEntries({
						directory: result.directory,
						reviews: { [subject.slot.id]: review },
					}),
				/integrity/,
			);
			assert.equal(calls, 34);
		} finally {
			globalThis.fetch = oldFetch;
			rmSync(f.temp, { recursive: true, force: true });
		}
	});
test("entry source drift refuses actual campaign before any HTTP", async () => {
	const f = fixture(),
		oldFetch = globalThis.fetch;
	let calls = 0;
	try {
		const path = join(f.temp, "graphrefly-ts/examples/spending-alerts/causal-entry.ts");
		writeFileSync(path, readFileSync(path, "utf8") + "\n// drift\n");
		globalThis.fetch = async () => {
			calls++;
			throw new Error("must not fetch");
		};
		const { runCampaign } = await import(
			pathToFileURL(join(f.dir, "scripts/b121-comparison/api-campaign.mjs"))
		);
		await assert.rejects(
			runCampaign({ approval: f.approval, apiKey: "OFFLINE-FAKE" }),
			/binding drift/,
		);
		assert.equal(calls, 0);
	} finally {
		globalThis.fetch = oldFetch;
		rmSync(f.temp, { recursive: true, force: true });
	}
});
