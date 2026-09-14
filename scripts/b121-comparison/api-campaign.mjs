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
import { runSession } from "./api-runner.mjs";
import { createOpenAITransport, qualifyProvider } from "./api-transport.mjs";
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
	const transport = createOpenAITransport({ apiKey, approval, manifestSHA });
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
		const rows = bundle.slots.map(({ slot }) => {
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
				entry: actual?.entryStatus ?? "unrun",
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
