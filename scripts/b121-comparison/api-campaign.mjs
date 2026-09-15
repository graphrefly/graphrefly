/** One-shot trusted entry point; deliberately no auto-running CLI or credential discovery. */

import { createHash } from "node:crypto";
import {
	closeSync,
	fsyncSync,
	mkdirSync,
	openSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reviewEntry } from "./api-entry-review.mjs";
import { runSession } from "./api-runner.mjs";
import {
	createOpenRouterTransport,
	qualifyProvider,
} from "./api-transport.mjs";
import { createSession, gradeSealed, hash } from "./session.mjs";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const base = join(root, "sessions/active/b121-comparison-design-v1");
const sha = (x) => createHash("sha256").update(x).digest("hex");
const insist = (v, m) => {
	if (!v) throw new Error(m);
};
export function verifyFrozen(manifest, bundle) {
	for (const b of manifest.bindings)
		insist(
			sha(readFileSync(join(root, b.path))) === b.sha256,
			`binding drift: ${b.path}`,
		);
	insist(
		sha(JSON.stringify(bundle, null, 2) + "\n") === manifest.bundleSHA,
		"bundle drift",
	);
	insist(
		bundle.slots.length === 12 && manifest.sessions.length === 12,
		"12 slots required",
	);
	for (let i = 0; i < 12; i++) {
		const { slot, files, entryFiles } = bundle.slots[i],
			expected = manifest.sessions[i];
		insist(
			hash(slot) ===
				hash(
					Object.fromEntries(
						Object.entries(expected).filter(
							([k]) => !["packetHash", "entryHash"].includes(k),
						),
					),
				),
			"slot drift",
		);
		insist(
			hash(files) === expected.packetHash &&
				hash(entryFiles) === expected.entryHash,
			"participant map drift",
		);
	}
}
/** Fixed manifest-hash claim directory prevents process restart/replay. Never delete a claim to retry.
 * External approval is trusted human input, not inferred from manifest readiness or file existence.
 */
export async function runCampaign({ approval, apiKey }) {
	const bytes = readFileSync(join(base, "agent-api/manifest.json")),
		manifestSHA = sha(bytes),
		manifest = JSON.parse(bytes);
	const bundle = JSON.parse(
		readFileSync(join(base, "agent-api/bundle.json"), "utf8"),
	);
	insist(approval?.manifestSHA === manifestSHA, "approval manifest mismatch");
	verifyFrozen(manifest, bundle);
	const transport = createOpenRouterTransport({
		apiKey,
		approval,
		manifestSHA,
		journal: (event) => journal(event),
	});
	// Parent is created only on an explicitly authorized call; exact child is exclusive and persistent.
	const parent = join(base, "agent-api/runs");
	mkdirSync(parent, { recursive: true, mode: 0o700 });
	const dir = join(parent, manifestSHA);
	mkdirSync(dir, { mode: 0o700 });
	const fd = openSync(join(dir, "journal.jsonl"), "wx", 0o600);
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
	};
	const results = [];
	let qualification = null,
		failure = null;
	try {
		journal({ type: "claim", data: { manifestSHA, approval } });
		qualification = await qualifyProvider({ transport, journal });
		journal({ type: "qualification", data: qualification });
		for (const p of bundle.slots) {
			const result = await runSession({ ...p, transport, journal });
			results.push(result);
			if (result.fatal) {
				failure = result.fatal;
				break;
			}
		}
	} catch (error) {
		failure = error.message;
		journal({
			type: "campaign-failed",
			data: { message: failure, envelope: error.envelope ?? null },
		});
	} finally {
		const goldens = JSON.parse(
			readFileSync(join(base, "revision-2/goldens.json"), "utf8"),
		);
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
				const empty = createSession({ sessionId: slot.id, files: {} });
				empty.sealA();
				s = empty.finish();
			}
			return {
				slot,
				status: actual ? (actual.fatal ? "failed" : "retained") : "unrun",
				A: gradeSealed(s.seal, goldens.A, s.seal.hash),
				B: gradeSealed(s.sealB, goldens.B, s.sealB.hash),
				entry: actual
					? entryResult(actual, entryFiles)
					: {
							status: slot.arm === "P" ? "not-applicable" : "unrun",
							accepted: false,
						},
				freeTextReview: "unscored: two blinded human reviewers unavailable",
			};
		});
		try {
			journal({
				type: "campaign-finished",
				data: {
					manifestSHA,
					qualificationPassed: !!qualification,
					results: rows,
					failure,
					transport: transport.snapshot(),
					participantSessionsStarted: results.length,
					denominator: 1344,
					retryAllowed: false,
					b121Complete: false,
				},
			});
		} finally {
			closeSync(fd);
		}
	}
	return { directory: dir, manifestSHA, failure, completed: results.length };
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
	const bundle = JSON.parse(
		readFileSync(join(base, "agent-api/bundle.json"), "utf8"),
	);
	verifyFrozen(manifest, bundle);
	insist(
		resolve(directory) === join(base, "agent-api/runs", manifestSHA),
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
			row.index === index &&
				row.previous === previous &&
				hash(event) === claimed,
			"review journal integrity mismatch",
		);
		previous = claimed;
	});
	insist(
		lines[0]?.event.type === "claim" &&
			lines[0].event.data.manifestSHA === manifestSHA &&
			lines.at(-1)?.event.type === "campaign-finished",
		"completed campaign journal required",
	);
	const entries = [];
	for (const [sessionId, review] of Object.entries(reviews)) {
		const subject = bundle.slots.find((p) => p.slot.id === sessionId);
		const matches = lines.filter(
			(r) => r.event.type === "finished" && r.event.data.slot.id === sessionId,
		);
		insist(
			subject &&
				matches.length === 1 &&
				hash(matches[0].event.data.slot) === hash(subject.slot),
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
