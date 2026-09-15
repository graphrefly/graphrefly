import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { reviewEntry } from "./api-entry-review.mjs";
import { createEntryAcceptance } from "./entry-tasks.mjs";
import { createSession, hash } from "./session.mjs";

const tsRoot = fileURLToPath(
	new URL("../../../graphrefly-ts/", import.meta.url),
);
function fixture() {
	const controller = createSession({
		sessionId: "synthetic-entry-review",
		files: {},
	});
	controller.sealA();
	controller.finish();
	const acceptance = createEntryAcceptance({ controller, tsRoot });
	const packet = acceptance.releaseTasks();
	const task = packet.tasks[0];
	const entryFiles = {
		"entry/task.json": JSON.stringify({
			id: task.id,
			prompt: task.prompt,
			sourceIndex: task.sourceBindings.map((s) => ({ ...s, chunks: 1 })),
		}),
	};
	const result = {
		slot: { id: "synthetic-entry-review", role: "user", arm: "G" },
		controller: controller.snapshot(),
		entryAnswer: {
			snippet: acceptance.referenceSnippets()[0].snippet,
			explanation:
				"Synthetic source-based explanation; not participant evidence.",
		},
	};
	return { result, entryFiles, tsRoot, task };
}
function trustedReview(f, passed = true) {
	const sha = (s) => createHash("sha256").update(s).digest("hex");
	return {
		reviewerId: "synthetic-test-reviewer",
		binding: {
			sessionId: f.result.slot.id,
			taskId: f.task.id,
			snippetHash: sha(f.result.entryAnswer.snippet),
			explanationHash: sha(f.result.entryAnswer.explanation),
			entryFilesHash: hash(f.entryFiles),
		},
		checks: Object.fromEntries(
			f.task.criteria.map((c) => [
				c,
				{ passed, evidence: `Synthetic criterion fixture ${c}` },
			]),
		),
	};
}
test("submitted valid code is compiled but pending trusted review, never accepted", () => {
	const actual = reviewEntry(fixture());
	assert.equal(actual.status, "pending-review");
	assert.equal(actual.compilation.ok, true);
	assert.equal(actual.accepted, false);
	assert.equal(actual.binding.sessionId, "synthetic-entry-review");
});
test("trusted criterion review plus real compilation accepts exact submitted code", () => {
	const f = fixture();
	const actual = reviewEntry({ ...f, review: trustedReview(f) });
	assert.equal(actual.status, "accepted");
	assert.equal(actual.accepted, true);
	assert.equal(actual.compilation.ok, true);
	assert.equal(
		actual.review.binding.explanationHash,
		actual.binding.explanationHash,
	);
});
test("compile failure rejects even when all semantic checks pass; participant code is not run", () => {
	const f = fixture();
	f.result.entryAnswer.snippet =
		'throw new Error("must never execute"); const invalid: number = true;';
	const actual = reviewEntry({ ...f, review: trustedReview(f) });
	assert.equal(actual.status, "rejected");
	assert.equal(actual.accepted, false);
	assert.equal(actual.compilation.ok, false);
	assert.ok(actual.compilation.diagnostics.some((d) => d.code === 2322));
});
test("semantic failure rejects compilable submission", () => {
	const f = fixture();
	const actual = reviewEntry({ ...f, review: trustedReview(f, false) });
	assert.equal(actual.compilation.ok, true);
	assert.equal(actual.status, "rejected");
	assert.equal(actual.accepted, false);
});
test("source drift from frozen participant task is rejected before compiler/reviewer", () => {
	const f = fixture();
	const task = JSON.parse(f.entryFiles["entry/task.json"]);
	task.sourceIndex[0].sha256 = "0".repeat(64);
	f.entryFiles["entry/task.json"] = JSON.stringify(task);
	assert.throws(() => reviewEntry(f), /source binding drift/);
});
test("wrong role/task and session bindings are rejected", () => {
	const f = fixture();
	f.result.slot.role = "framework";
	assert.throws(() => reviewEntry(f), /role\/task binding/);
	f.result.slot.role = "user";
	f.result.slot.id = "another-session";
	assert.throws(() => reviewEntry(f), /session binding/);
});
test("review cannot be reused across altered snippet, explanation, task, session or entry material", () => {
	for (const field of [
		"snippetHash",
		"explanationHash",
		"taskId",
		"sessionId",
		"entryFilesHash",
	]) {
		const f = fixture();
		const review = trustedReview(f);
		review.binding[field] = "other";
		assert.throws(
			() => reviewEntry({ ...f, review }),
			/submission binding mismatch/,
		);
	}
});
test("incomplete trusted criterion assessment is rejected", () => {
	const f = fixture();
	const review = trustedReview(f);
	delete review.checks[f.task.criteria[0]];
	assert.throws(
		() => reviewEntry({ ...f, review }),
		/complete trusted reviewer/,
	);
});
test("unsealed and forged closure proofs cannot release entry review", () => {
	const f = fixture();
	f.result.controller.phase = "A";
	assert.throws(() => reviewEntry(f), /must be closed/);
	f.result.controller.phase = "closed";
	f.result.controller.seal.hash = "tampered";
	assert.throws(() => reviewEntry(f), /seal mismatch/);
});
test("missing Graph submission and plain arm remain distinct and unaccepted", () => {
	const f = fixture();
	f.result.entryAnswer = null;
	assert.equal(reviewEntry(f).status, "missing");
	f.result.slot.arm = "P";
	assert.throws(() => reviewEntry(f), /plain arm/);
	f.entryFiles = {};
	assert.deepEqual(reviewEntry(f), {
		scope: "Graph-only",
		status: "not-applicable",
		accepted: false,
	});
	f.result.entryAnswer = { snippet: "const a=1;", explanation: "" };
	assert.throws(() => reviewEntry(f), /plain arm/);
});
