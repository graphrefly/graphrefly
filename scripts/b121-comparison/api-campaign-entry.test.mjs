/** Actual campaign consumer plus offline review; all HTTP responses are synthetic. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

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
	symlinkSync(
		resolve(root, "../graphrefly-ts/node_modules"),
		join(temp, "graphrefly-ts/node_modules"),
	);
	copyFileSync(
		resolve(root, "../graphrefly-ts/package.json"),
		join(temp, "graphrefly-ts/package.json"),
	);
	const manifestSHA = createHash("sha256").update(bytes).digest("hex");
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
			maxGenerationCalls: 962,
			maxUSD: 0.2,
			retries: 0,
			model: "qwen/qwen3.8-flash",
			providerTag: "makora/fp4",
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
				JSON.parse(subject.files[`${phase}/common.json`].content)
					.answerVocabulary,
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
			const subject = f.bundle.slots[0];
			assert.equal(subject.slot.arm, "G");
			const batches = [
				[{ op: "read", path: "probe.json" }],
				[{ op: "read", path: "probe.json" }],
				submits(subject, "A"),
				submits(subject, "B"),
				[
					{
						op: "submit",
						snippet: valid
							? "export const value:number=1;"
							: 'export const value:number="wrong";',
						explanation: "synthetic fixture",
						concepts: { read: [], required: [], firstExpansion: null },
					},
				],
			];
			globalThis.fetch = async (url) => {
				const requests = batches[calls] ?? [
					{ op: "read", path: "../../forbidden" },
				];
				calls++;
				const body = {
					id: `fixture_${calls}`,
					model: "qwen/qwen3.8-flash",
					provider: "Makora",
					usage: {
						prompt_tokens: 100,
						completion_tokens: 20,
						total_tokens: 120,
						cost: 0.0000244,
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
												requests: JSON.stringify(requests),
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
			const result = await runCampaign({
				approval: f.approval,
				apiKey: "OFFLINE-FAKE",
			});
			assert.equal(calls, 6);
			const logs = readFileSync(join(result.directory, "journal.jsonl"), "utf8")
				.trim()
				.split("\n")
				.map(JSON.parse);
			const row = logs.at(-1).event.data.results[0];
			assert.equal(row.entry.status, "pending-review");
			assert.equal(row.entry.accepted, false);
			assert.equal(row.entry.compilation.ok, valid);
			assert.ok(row.entry.compilation.diagnostics);
			assert.equal(logs.at(-1).event.data.denominator, 1344);
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
			assert.equal(calls, 6);
			assert.equal(
				JSON.parse(readFileSync(saved.path)).entries[0].result.accepted,
				false,
			);
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
			assert.equal(calls, 6);
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
		const path = join(
			f.temp,
			"graphrefly-ts/examples/spending-alerts/causal-entry.ts",
		);
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
