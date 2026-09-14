/** Runs the real campaign entry point in a temporary repository with a fake HTTP transport. */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const base = "sessions/active/b121-comparison-design-v1";
const digest = (x) => createHash("sha256").update(x).digest("hex");
for (const qualificationFails of [true, false])
	test(`real campaign: ${qualificationFails ? "qualification failure" : "first participant fatal"}, fixed denominator and exclusive restart`, async () => {
		const dir = mkdtempSync(join(tmpdir(), "b121-offline-campaign-"));
		const oldFetch = globalThis.fetch;
		let countCalls = 0,
			creates = 0;
		const wire = [];
		try {
			const bytes = readFileSync(join(root, base, "agent-api/manifest.json"));
			const manifest = JSON.parse(bytes);
			const manifestSHA = digest(bytes);
			const paths = [
				...manifest.bindings.map((x) => x.path),
				`${base}/agent-api/manifest.json`,
				`${base}/agent-api/bundle.json`,
			];
			for (const path of paths) {
				mkdirSync(dirname(join(dir, path)), { recursive: true });
				copyFileSync(join(root, path), join(dir, path));
			}
			globalThis.fetch = async (url, options) => {
				const payload = JSON.parse(options.body);
				wire.push({ url, payload });
				let b;
				if (url.endsWith("/input_tokens")) {
					countCalls++;
					b = { object: "response.input_tokens", input_tokens: 100 };
				} else {
					creates++;
					b = {
						id: `response_fake_${creates}`,
						model: "gpt-6-astra",
						store: false,
						status: qualificationFails ? "incomplete" : "completed",
						service_tier: "default",
						reasoning: { effort: "medium" },
						tools: payload.tools,
						parallel_tool_calls: false,
						usage: {
							input_tokens: 100,
							output_tokens: 20,
							total_tokens: 120,
							input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
							output_tokens_details: { reasoning_tokens: 1 },
						},
						output: [
							{
								type: "function_call",
								name: "broker",
								call_id: `call_fake_${creates}`,
								arguments: JSON.stringify({
									requests: JSON.stringify([
										{
											op: "read",
											path: creates <= 2 ? "probe.json" : "../../oracle.json",
										},
									]),
								}),
							},
						],
					};
				}
				return {
					ok: true,
					status: 200,
					headers: new Headers({ "x-request-id": `req_fake_${wire.length}` }),
					text: async () => JSON.stringify(b),
				};
			};
			const { runCampaign } = await import(
				pathToFileURL(join(dir, "scripts/b121-comparison/api-campaign.mjs"))
			);
			const approval = {
				manifestSHA,
				action: "B121-agent-api-one-shot",
				acceptAliasLimitation: true,
				countEndpointPriceUSD: 0,
				countPriceEvidence: "FAKE OFFLINE TEST ONLY",
				expiresAt: "2099-01-01",
				maxGenerationCalls: 962,
				maxCountCalls: 962,
				maxUSD: 12.11,
				retries: 0,
			};
			const result = await runCampaign({
				approval,
				apiKey: "FAKE-OFFLINE-KEY",
			});
			assert.ok(result.failure);
			assert.equal(creates, qualificationFails ? 1 : 3);
			assert.equal(countCalls, creates);
			const journal = readFileSync(
				join(result.directory, "journal.jsonl"),
				"utf8",
			)
				.trim()
				.split("\n")
				.map(JSON.parse);
			const end = journal.at(-1).event.data;
			assert.equal(end.denominator, 1344);
			assert.equal(end.participantSessionsStarted, qualificationFails ? 0 : 1);
			assert.equal(
				end.results.filter((x) => x.status === "unrun").length,
				qualificationFails ? 12 : 11,
			);
			assert.equal(
				end.results.reduce(
					(n, r) => n + r.A.totals.denominator + r.B.totals.denominator,
					0,
				),
				1344,
			);
			const before = wire.length;
			await assert.rejects(
				runCampaign({ approval, apiKey: "FAKE-OFFLINE-KEY" }),
				/EEXIST/,
			);
			assert.equal(wire.length, before);
			assert.ok(
				wire.every(
					(w) =>
						w.payload.tools.length === 1 &&
						w.payload.tools[0].name === "broker" &&
						!w.payload.conversation &&
						!w.payload.previous_response_id,
				),
			);
		} finally {
			globalThis.fetch = oldFetch;
			rmSync(dir, { recursive: true, force: true });
		}
	});
