import { createGraphContext } from "../../../graphrefly-ts/packages/ts/evals/b121/graph-runtime.mjs";
import { runCampaignGraph } from "../../../graphrefly-ts/packages/ts/evals/b121/campaign-control.mjs";
import { orchestratorEnvironment } from "./runtime-bindings.mjs";
/** One-shot trusted entry point; deliberately no auto-running CLI or credential discovery. */

import { createHash } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LIMITS } from "./api-limits.mjs";
import { reviewEntry } from "./api-entry-review.mjs";
import { runSession } from "./api-runner.mjs";
import { createOpenRouterTransport, qualifyProvider } from "./api-transport.mjs";
import { createSession, gradeSealed, hash } from "./session.mjs";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const base = join(root, "sessions/active/b121-comparison-design-v1");
const sha = (x) => createHash("sha256").update(x).digest("hex");
const insist = (v, m) => {
	if (!v) throw new Error(m);
};
export function verifyFrozen(manifest, bundle) {
	insist(
		hash(manifest.orchestratorEnvironment) === hash(orchestratorEnvironment),
		"orchestrator environment drift",
	);
	for (const b of manifest.bindings)
		insist(sha(readFileSync(join(root, b.path))) === b.sha256, `binding drift: ${b.path}`);
	insist(sha(JSON.stringify(bundle, null, 2) + "\n") === manifest.bundleSHA, "bundle drift");
	insist(bundle.slots.length === 12 && manifest.sessions.length === 12, "12 slots required");
	for (let i = 0; i < 12; i++) {
		const { slot, files, entryFiles } = bundle.slots[i],
			expected = manifest.sessions[i];
		insist(
			hash(slot) ===
				hash(
					Object.fromEntries(
						Object.entries(expected).filter(([k]) => !["packetHash", "entryHash"].includes(k)),
					),
				),
			"slot drift",
		);
		insist(
			hash(files) === expected.packetHash && hash(entryFiles) === expected.entryHash,
			"participant map drift",
		);
	}
	insist(
		bundle.entrySlots?.length === 6 && manifest.entrySessions?.length === 6,
		"six independent entry slots required",
	);
	const allIds = [...bundle.slots, ...bundle.entrySlots].map((p) => p.slot.id);
	insist(new Set(allIds).size === 18, "experiment session ids must be unique");
	bundle.entrySlots.forEach(({ slot, entryFiles, entryHash }, i) => {
		const { entryHash: expectedHash, ...expectedSlot } = manifest.entrySessions[i];
		insist(
			slot.experiment === "entry" && slot.arm === "G" && hash(slot) === hash(expectedSlot),
			"entry slot drift",
		);
		insist(hash(entryFiles) === entryHash && entryHash === expectedHash, "entry map drift");
	});
}
/** Optional trusted attempt identity permits separately authorized reruns without deleting claims. */
export function attemptDirectoryName(manifestSHA, attemptId) {
	insist(/^[a-f0-9]{64}$/.test(manifestSHA), "invalid manifest hash");
	if (attemptId === undefined) return manifestSHA;
	insist(
		typeof attemptId === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(attemptId),
		"invalid attempt identity",
	);
	return `${manifestSHA}--${attemptId}`;
}
/** Fixed manifest/attempt claim directory prevents process restart/replay. Never delete a claim to retry.
 * External approval is trusted human input, not inferred from manifest readiness or file existence.
 */
export async function runCampaign({ approval, apiKey }) {
	const bytes = readFileSync(join(base, "agent-api/manifest.json")),
		manifestSHA = sha(bytes),
		manifest = JSON.parse(bytes);
	const bundleBytes = readFileSync(join(base, "agent-api/bundle.json"));
	const bundle = JSON.parse(bundleBytes);
	insist(approval?.manifestSHA === manifestSHA, "approval manifest mismatch");
	verifyFrozen(manifest, bundle);
	const allIds = [...bundle.slots, ...bundle.entrySlots].map((p) => p.slot.id);
	const selection = approval.sessionIds;
	insist(
		selection === undefined ||
			(Array.isArray(selection) && selection.length === 1 && allIds.includes(selection[0])),
		"development selection must contain exactly one known session",
	);
	const selected = (id) => selection === undefined || selection.includes(id);
	const comparisonSlots = bundle.slots.filter((p) => selected(p.slot.id));
	const entrySlots = bundle.entrySlots.filter((p) => selected(p.slot.id));
	const executionMode = selection === undefined ? "legacy-campaign" : "single-task-development";
	const graphContext = createGraphContext({ name: `b121-${manifestSHA}` });
	const transport = createOpenRouterTransport({
		graphContext,
		apiKey,
		approval,
		manifestSHA,
		journal: (event) => journal(event),
	});
	// Parent is created only on an explicitly authorized call; exact child is exclusive and persistent.
	const parent = join(base, "agent-api/runs");
	mkdirSync(parent, { recursive: true, mode: 0o700 });
	const dir = join(parent, attemptDirectoryName(manifestSHA, approval.attemptId));
	mkdirSync(dir, { mode: 0o700 });
	const persist = (name, value) => {
		const artifact = openSync(join(dir, name), "wx", 0o600);
		try {
			writeFileSync(artifact, value);
			fsyncSync(artifact);
		} finally {
			closeSync(artifact);
		}
	};
	// Freeze exact execution inputs before the first provider effect, including failed qualification.
	persist("manifest.json", bytes);
	persist("bundle.json", bundleBytes);
	persist("approval.json", JSON.stringify(approval, null, 2) + "\n");
	const fd = openSync(join(dir, "journal.jsonl"), "wx", 0o600);
	let lastResponse = null;
	const startedAt = new Date().toISOString();
	let previous = null,
		index = 0;
	const journal = (event) => {
		const row = {
			index: index++,
			previous,
			at: new Date().toISOString(),
			event,
		};
		previous = hash(row);
		writeFileSync(fd, JSON.stringify({ ...row, hash: previous }) + "\n");
		fsyncSync(fd);
		// Keep only diagnostic metadata in the summary; full scoring evidence stays in the journal.
		const envelope =
			event.data?.envelope ??
			(["generation-response", "qualification-generation-response"].includes(event.type)
				? event.data
				: null);
		if (envelope) {
			const body = envelope.body ?? envelope.json;
			lastResponse = {
				status: envelope.httpStatus ?? envelope.status ?? null,
				finishReason: body?.choices?.[0]?.finish_reason ?? null,
				usage: body?.usage
					? {
							prompt_tokens: body.usage.prompt_tokens ?? null,
							completion_tokens: body.usage.completion_tokens ?? null,
							total_tokens: body.usage.total_tokens ?? null,
							reasoning_tokens: body.usage.completion_tokens_details?.reasoning_tokens ?? null,
							cost: body.usage.cost ?? null,
						}
					: null,
			};
		}
	};
	const results = [],
		entryResults = [];
	let qualification = null,
		failure = null,
		started = 0,
		entriesStarted = 0,
		summary = null;
	function persistCollection(collection) {
		qualification = collection.qualification;
		failure = collection.failure;
		started = collection.rows.filter(
			(r) => r.mode === "comparison" && r.status !== "not-run",
		).length;
		entriesStarted = collection.rows.filter(
			(r) => r.mode === "entry" && r.status !== "not-run",
		).length;

		const goldens = JSON.parse(readFileSync(join(base, "revision-2/goldens.json"), "utf8"));
		const entryResult = (actual, entryFiles) => {
			try {
				return reviewEntry({
					result: actual,
					entryFiles,
					tsRoot: resolve(root, "../graphrefly-ts"),
				});
			} catch (error) {
				return {
					status: "validation-failed",
					accepted: false,
					error: error.message,
				};
			}
		};
		const rows = bundle.slots.map(({ slot, entryFiles }) => {
			const actual = results.find((r) => r.slot.id === slot.id);
			let s = actual?.controller;
			if (!s) {
				const empty = createSession({
					sessionId: slot.id,
					files: {},
					limits: LIMITS,
				});
				empty.sealA();
				s = empty.finish();
			}
			return {
				slot,
				status: !selected(slot.id)
					? "not-selected"
					: actual
						? actual.fatal
							? "failed"
							: "retained"
						: "unrun",
				A: gradeSealed(s.seal, goldens.A, s.seal.hash),
				B: gradeSealed(s.sealB, goldens.B, s.sealB.hash),
				entry: {
					status: slot.arm === "P" ? "not-applicable" : "separate-experiment",
					accepted: false,
				},
				freeTextReview: "unscored: two blinded human reviewers unavailable",
			};
		});
		const entryRows = bundle.entrySlots.map(({ slot, entryFiles }) => {
			const actual = entryResults.find((r) => r.slot.id === slot.id);
			return {
				slot,
				experiment: "entry",
				status: !selected(slot.id)
					? "not-selected"
					: actual
						? actual.fatal
							? "failed"
							: "retained"
						: "unrun",
				entry: actual
					? entryResult(actual, entryFiles)
					: {
							status: selected(slot.id) ? "unrun" : "not-selected",
							accepted: false,
						},
				usage: actual?.usage ?? null,
				failure: actual?.fatal ?? null,
			};
		});
		const submittedCount = (result) =>
			["A", "B"].reduce(
				(n, phase) =>
					n +
					Object.values(result.controller.answers[phase]).filter(
						(answer) => answer.status === "submitted",
					).length,
				0,
			);
		const completed = results.filter(
			(result) => !result.fatal && submittedCount(result) === 16,
		).length;
		const submittedAnswers = results.reduce(
			(total, result) =>
				total +
				["A", "B"].reduce(
					(n, phase) =>
						n +
						Object.values(result.controller.answers[phase]).filter(
							(answer) => answer.status === "submitted",
						).length,
					0,
				),
			0,
		);
		const stats = transport.snapshot();
		summary = {
			kind: "B121-agent-api-attempt-summary",
			executionMode,
			scheduledSessionIds: allIds.filter(selected),
			scoreInterpretation:
				"Development evidence only; no formal study or cross-attempt pooled score.",
			manifestSHA,
			startedAt,
			finishedAt: new Date().toISOString(),
			qualificationPassed: !!qualification,
			participantSessionsStarted: started,
			participantSessionsCompleted: completed,
			participantSessionsUnrun: comparisonSlots.length - started,
			participantSessionsNotSelected: bundle.slots.length - comparisonSlots.length,
			submittedAnswers,
			participantFailures: results
				.filter((r) => r.failureScope === "participant")
				.map((r) => ({ sessionId: r.slot.id, message: r.fatal })),
			entrySessionsStarted: entriesStarted,
			entrySessionsUnrun: entrySlots.length - entriesStarted,
			entrySessionsNotSelected: bundle.entrySlots.length - entrySlots.length,
			entrySessionsCompleted: entryResults.filter((r) => !r.fatal && r.entryStatus === "submitted")
				.length,
			entryFailures: entryResults
				.filter((r) => r.fatal)
				.map((r) => ({
					sessionId: r.slot.id,
					message: r.fatal,
					failureScope: r.failureScope,
				})),
			submittedEntries: entryResults.filter((result) => result.entryStatus === "submitted").length,
			generationCalls: stats.generationCalls,
			providerReportedCostUSD: stats.reportedCostUSD ?? null,
			priorUsageUSD: approval.priorUsageUSD ?? 0,
			reservedUSD: stats.reservedUSD,
			unknownReservedUSD: stats.unknownReservedUSD ?? null,
			failure,
			lastResponse,
			denominator: 1344,
			b121Complete: false,
		};
		journal({ type: "campaign-topology", data: graphContext.graph.topology() });
		journal({
			type: "campaign-finished",
			data: {
				executionMode,
				scheduledSessionIds: allIds.filter(selected),
				manifestSHA,
				qualificationPassed: !!qualification,
				results: rows,
				entryResults: entryRows,
				entrySessionsStarted: entriesStarted,
				failure,
				transport: transport.snapshot(),
				participantSessionsStarted: started,
				participantSessionsCompleted: completed,
				denominator: 1344,
				retryAllowed: false,
				b121Complete: false,
			},
		});
		persist("summary.json", JSON.stringify({ ...summary, journalHead: previous }, null, 2) + "\n");
		return { summaryHash: hash(summary) };
	}

	try {
		journal({ type: "claim", data: { manifestSHA, approval } });
		const campaign = await runCampaignGraph({
			graphContext,
			name: manifestSHA,
			journal,
			samples: [
				...comparisonSlots.map((p) => ({ sampleId: p.slot.id, mode: "comparison" })),
				...entrySlots.map((p) => ({ sampleId: p.slot.id, mode: "entry" })),
			],
			effects: {
				async qualification() {
					const value = await qualifyProvider({ transport, journal, graphContext });
					journal({ type: "qualification", data: value });
					return value;
				},
				async session({ sample }) {
					const p = (sample.mode === "entry" ? entrySlots : comparisonSlots).find(
						(p) => p.slot.id === sample.sampleId,
					);
					return runSession({
						...p,
						mode: sample.mode,
						files: sample.mode === "entry" ? {} : p.files,
						transport,
						journal,
						graphContext,
					});
				},
				"final-persistence"({ collection }) {
					return persistCollection(collection);
				},
				"result-persistence"({ result, sample }) {
					journal({
						type: "campaign-result-retained",
						data: { sampleId: sample.sampleId, result },
					});
					(sample.mode === "entry" ? entryResults : results).push(result);
					return { resultHash: hash(result) };
				},
			},
			classify(result) {
				return {
					row: { status: "retained" },
					failure: result.fatal && result.failureScope !== "participant" ? result.fatal : null,
				};
			},
		});
		qualification = campaign.qualification;
		failure = campaign.failure;
		started = campaign.rows.filter((r) => r.mode === "comparison" && r.status !== "not-run").length;
		entriesStarted = campaign.rows.filter(
			(r) => r.mode === "entry" && r.status !== "not-run",
		).length;
	} catch (error) {
		if (error.campaignSnapshot) {
			started = error.campaignSnapshot.rows.filter(
				(r) => r.mode === "comparison" && r.status !== "not-run",
			).length;
			entriesStarted = error.campaignSnapshot.rows.filter(
				(r) => r.mode === "entry" && r.status !== "not-run",
			).length;
		}
		failure = error.message;
		journal({
			type: "campaign-failed",
			data: { message: failure, envelope: error.envelope ?? null },
		});
	} finally {
		try {
			await transport.dispose?.();
			graphContext.dispose();
		} finally {
			closeSync(fd);
		}
	}

	return {
		directory: dir,
		manifestSHA,
		failure,
		started,
		completed: summary?.participantSessionsCompleted ?? 0,
	};
}

/** Offline trusted review of retained submissions. Does not instantiate a provider transport. */
export function reviewCampaignEntries({
	directory,
	reviews,
	tsRoot = resolve(root, "../graphrefly-ts"),
}) {
	const bytes = readFileSync(join(base, "agent-api/manifest.json"));
	const manifestSHA = sha(bytes),
		manifest = JSON.parse(bytes);
	const bundle = JSON.parse(readFileSync(join(base, "agent-api/bundle.json"), "utf8"));
	verifyFrozen(manifest, bundle);
	const approval = JSON.parse(readFileSync(join(directory, "approval.json")));
	insist(
		resolve(directory) ===
			join(base, "agent-api/runs", attemptDirectoryName(manifestSHA, approval.attemptId)),
		"review run/manifest mismatch",
	);
	insist(
		reviews &&
			typeof reviews === "object" &&
			!Array.isArray(reviews) &&
			Object.keys(reviews).length > 0,
		"explicit trusted reviews required",
	);
	const lines = readFileSync(join(directory, "journal.jsonl"), "utf8")
		.trim()
		.split("\n")
		.map(JSON.parse);
	let previous = null;
	lines.forEach((row, index) => {
		const { hash: claimed, ...event } = row;
		insist(
			row.index === index && row.previous === previous && hash(event) === claimed,
			"review journal integrity mismatch",
		);
		previous = claimed;
	});
	const finished = lines.filter((r) => r.event.type === "campaign-finished");
	insist(existsSync(join(directory, "summary.json")), "completed campaign journal required");
	const summary = JSON.parse(readFileSync(join(directory, "summary.json")));
	insist(
		lines[0]?.event.type === "claim" &&
			lines[0].event.data.manifestSHA === manifestSHA &&
			hash(lines[0].event.data.approval) === hash(approval) &&
			finished.length === 1 &&
			summary.journalHead === finished[0].hash &&
			summary.manifestSHA === manifestSHA &&
			!lines.some((r) => r.event.type === "campaign-failed"),
		"completed campaign journal required",
	);
	const entries = [];
	for (const [sessionId, review] of Object.entries(reviews)) {
		const subject = bundle.entrySlots.find((p) => p.slot.id === sessionId);
		const matches = lines.filter(
			(r) => r.event.type === "finished" && r.event.data.slot.id === sessionId,
		);
		insist(
			subject && matches.length === 1 && hash(matches[0].event.data.slot) === hash(subject.slot),
			"review session not retained exactly once",
		);
		entries.push({
			sessionId,
			result: reviewEntry({
				result: matches[0].event.data,
				entryFiles: subject.entryFiles,
				tsRoot,
				review,
			}),
		});
	}
	const receipt = {
		kind: "B121-offline-entry-review-v1",
		attemptId: approval.attemptId ?? null,
		manifestSHA,
		journalHead: previous,
		entries,
		b121Complete: false,
		providerCalls: 0,
	};
	const path = join(directory, `entry-review-${hash(receipt)}.json`);
	writeFileSync(path, JSON.stringify(receipt, null, 2) + "\n", {
		flag: "wx",
		mode: 0o600,
	});
	return { path, ...receipt };
}
