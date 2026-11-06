import { copyGraphRuntime } from "./test-fixtures/graph-runtime.mjs";
import { CEILING_USD } from "./api-provider.mjs";
import { QUALIFICATION_READS, QUALIFICATION_SUBMISSIONS } from "./api-transport.mjs";
/** Runs the real campaign entry point in a temporary repository with a fake HTTP transport. */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const base = "sessions/active/b121-comparison-design-v1";
const digest = (x) => createHash("sha256").update(x).digest("hex");
for (const mode of ["qualification", "participant", "route"])
	test(`real campaign: ${mode} failure scope, fixed denominator and exclusive restart`, async () => {
		const qualificationFails = mode === "qualification";
		const globalFailure = mode !== "participant";
		const temp = mkdtempSync(join(tmpdir(), "b121-offline-campaign-"));
		const dir = join(temp, "graphrefly");
		mkdirSync(dir);
		const oldFetch = globalThis.fetch;
		let countCalls = 0,
			creates = 0;
		const wire = [];
		try {
			const bytes = readFileSync(join(root, base, "agent-api/manifest.json"));
			const manifest = JSON.parse(bytes);

			const paths = [
				...manifest.bindings.map((x) => x.path),
				`${base}/agent-api/manifest.json`,
				`${base}/agent-api/bundle.json`,
			];
			for (const path of paths) {
				mkdirSync(dirname(join(dir, path)), { recursive: true });
				copyFileSync(join(root, path), join(dir, path));
			}
			copyGraphRuntime(dir, manifest);
			// Bind this synthetic fixture to its copied current code; retain original run evidence.
			for (const binding of manifest.bindings)
				binding.sha256 = digest(readFileSync(join(dir, binding.path)));
			const fixtureBytes = JSON.stringify(manifest);
			writeFileSync(join(dir, base, "agent-api/manifest.json"), fixtureBytes);
			const manifestSHA = digest(fixtureBytes);
			globalThis.fetch = async (url, options) => {
				const payload = JSON.parse(options.body);
				wire.push({ url, payload });
				creates++;
				const b = {
					id: `response_fake_${creates}`,
					model: "deepseek/deepseek-v4.1-flash",
					provider: mode === "route" && creates > 4 ? "WrongProvider" : "Together",
					usage: {
						prompt_tokens: 100,
						completion_tokens: 20,
						total_tokens: 120,
						cost: 0.000054,
					},
					choices: [
						{
							finish_reason: qualificationFails ? "length" : "tool_calls",
							message: {
								role: "assistant",
								content: null,
								tool_calls: [
									{
										type: "function",
										id: `call_fake_${creates}`,
										function: {
											name: "broker",
											arguments: JSON.stringify({
												requests:
													creates === 2
														? QUALIFICATION_SUBMISSIONS[0]
														: creates === 4
															? QUALIFICATION_SUBMISSIONS[1]
															: creates === 3
																? QUALIFICATION_READS[1]
																: [
																		{
																			op: "read",
																			path: creates <= 4 ? "probe.json" : "../../oracle.json",
																		},
																	],
											}),
										},
									},
								],
							},
						},
					],
				};
				const response = new Response(JSON.stringify(b), {
					status: 200,
					headers: { "x-request-id": `req_${creates}` },
				});
				Object.defineProperty(response, "url", { value: url });
				return response;
			};
			const { runCampaign } = await import(
				pathToFileURL(join(dir, "scripts/b121-comparison/api-campaign.mjs"))
			);
			const approval = {
				manifestSHA,
				action: "B121-agent-api-one-shot",
				acceptAliasLimitation: true,
				acceptInputEstimateLimitation: true,
				model: "deepseek/deepseek-v4.1-flash",
				providerTag: "together",
				expiresAt: "2099-01-01",
				maxGenerationCalls: 1444,
				maxUSD: CEILING_USD,
				retries: 0,
			};
			const result = await runCampaign({
				approval,
				apiKey: "FAKE-OFFLINE-KEY",
			});
			assert.equal(!!result.failure, globalFailure);
			assert.equal(creates, qualificationFails ? 1 : mode === "route" ? 5 : 22);
			assert.equal(countCalls, 0);
			const journal = readFileSync(join(result.directory, "journal.jsonl"), "utf8")
				.trim()
				.split("\n")
				.map(JSON.parse);
			const end = journal.findLast((r) => r.event.type === "campaign-finished").event.data;
			assert.equal(end.denominator, 1344);
			assert.equal(
				end.participantSessionsStarted,
				qualificationFails ? 0 : mode === "route" ? 1 : 12,
			);
			assert.equal(
				end.results.filter((x) => x.status === "unrun").length,
				qualificationFails ? 12 : mode === "route" ? 11 : 0,
			);
			assert.equal(
				end.results.reduce((n, r) => n + r.A.totals.denominator + r.B.totals.denominator, 0),
				1344,
			);
			if (mode === "participant") {
				const participantWire = wire.slice(4, 16);
				assert.equal(
					new Set(participantWire.map((w) => JSON.parse(w.payload.messages[1].content).sessionId))
						.size,
					12,
				);
				assert.ok(participantWire.every((w) => w.payload.messages.length === 2));
				const summary = JSON.parse(readFileSync(join(result.directory, "summary.json")));
				assert.equal(summary.participantFailures.length, 12);
				assert.equal(summary.submittedAnswers, 0);
				assert.equal(summary.entrySessionsStarted, 6);
				assert.equal(summary.entryFailures.length, 6);
				assert.ok(
					wire
						.slice(16)
						.every(
							(w) =>
								w.payload.messages.length === 3 &&
								JSON.parse(w.payload.messages[1].content).experiment === "entry",
						),
				);
			}
			const before = wire.length;
			await assert.rejects(runCampaign({ approval, apiKey: "FAKE-OFFLINE-KEY" }), /EEXIST/);
			assert.equal(wire.length, before);
			if (mode === "participant") {
				for (const sessionIds of [[], ["unknown"], ["a", "b"], "a"])
					await assert.rejects(
						runCampaign({
							approval: { ...approval, attemptId: "bad-selection", sessionIds },
							apiKey: "FAKE-OFFLINE-KEY",
						}),
						/exactly one known session/,
					);
				assert.equal(wire.length, before);
				const bundle = JSON.parse(readFileSync(join(dir, base, "agent-api/bundle.json")));
				const id = bundle.entrySlots[0].slot.id;
				creates = 0;
				const selected = await runCampaign({
					approval: {
						...approval,
						attemptId: "single-entry",
						sessionIds: [id],
					},
					apiKey: "FAKE-OFFLINE-KEY",
				});
				assert.equal(creates, 5);
				const summary = JSON.parse(readFileSync(join(selected.directory, "summary.json")));
				assert.equal(summary.executionMode, "single-task-development");
				assert.deepEqual(summary.scheduledSessionIds, [id]);
				assert.equal(summary.participantSessionsStarted, 0);
				assert.equal(summary.entrySessionsStarted, 1);
				assert.equal(summary.entrySessionsUnrun, 0);
				assert.equal(summary.entrySessionsNotSelected, 5);
				const rows = readFileSync(join(selected.directory, "journal.jsonl"), "utf8")
					.trim()
					.split("\n")
					.map(JSON.parse)
					.findLast((r) => r.event.type === "campaign-finished").event.data;
				assert.ok(rows.results.every((x) => x.status === "not-selected"));
				assert.equal(rows.entryResults.filter((x) => x.status === "not-selected").length, 5);
				creates = 0;
				const cmpId = bundle.slots[0].slot.id;
				const cmp = await runCampaign({
					approval: {
						...approval,
						attemptId: "single-comparison",
						sessionIds: [cmpId],
					},
					apiKey: "FAKE-OFFLINE-KEY",
				});
				assert.equal(creates, 5);
				const cmpSummary = JSON.parse(readFileSync(join(cmp.directory, "summary.json")));
				assert.equal(cmpSummary.participantSessionsStarted, 1);
				assert.equal(cmpSummary.participantSessionsNotSelected, 11);
				assert.equal(cmpSummary.entrySessionsStarted, 0);
				assert.equal(cmpSummary.entrySessionsNotSelected, 6);
				const cmpEnd = readFileSync(join(cmp.directory, "journal.jsonl"), "utf8")
					.trim()
					.split("\n")
					.map(JSON.parse)
					.findLast((r) => r.event.type === "campaign-finished").event.data;
				assert.equal(cmpEnd.results.filter((x) => x.status === "not-selected").length, 11);
				assert.ok(cmpEnd.entryResults.every((x) => x.status === "not-selected"));
			}

			if (qualificationFails) {
				for (const attemptId of ["../escape", "", null, "/tmp/x"])
					await assert.rejects(
						runCampaign({
							approval: { ...approval, attemptId },
							apiKey: "FAKE-OFFLINE-KEY",
						}),
						/invalid attempt identity/,
					);
				assert.equal(wire.length, before);
				const retryApproval = { ...approval, attemptId: "authorized-retry-1" };
				const retry = await runCampaign({
					approval: retryApproval,
					apiKey: "FAKE-OFFLINE-KEY",
				});
				assert.notEqual(retry.directory, result.directory);
				assert.equal(wire.length, before + 1);
				await assert.rejects(
					runCampaign({ approval: retryApproval, apiKey: "FAKE-OFFLINE-KEY" }),
					/EEXIST/,
				);
				assert.equal(wire.length, before + 1);
			}

			assert.ok(
				wire.every(
					(w) =>
						w.payload.tools.length === 1 &&
						w.payload.tools[0].function.name === "broker" &&
						!w.payload.conversation &&
						!w.payload.previous_response_id,
				),
			);
		} finally {
			globalThis.fetch = oldFetch;
			rmSync(temp, { recursive: true, force: true });
		}
	});
