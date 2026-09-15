/** Trusted offline entry review. Never expose this compiler/reviewer API to participants. */
import { createHash } from "node:crypto";
import { createEntryAcceptance, validateEntrySnippet } from "./entry-tasks.mjs";
import { hash } from "./session.mjs";

const sha = (value) => createHash("sha256").update(value).digest("hex");
const insist = (condition, message) => {
	if (!condition) throw new Error(message);
};
const roleTasks = {
	user: "ordinary",
	framework: "framework",
	maintainer: "maintainer",
};

/** review is a trusted assessment, bound to the exact participant submission, not model self-scoring.
 * Omit it to retain compilation with pending-review status; pending never implies acceptance.
 * Hashes bind records but are not authentication. The campaign must verify the frozen bundle first.
 */
export function reviewEntry({ result, entryFiles, tsRoot, review }) {
	insist(
		result?.slot && ["G", "P"].includes(result.slot.arm),
		"valid study slot required",
	);
	if (result.slot.arm === "P") {
		insist(
			!result.entryAnswer &&
				!review &&
				Object.keys(entryFiles ?? {}).length === 0,
			"plain arm must not contain entry material, submission or review",
		);
		return { scope: "Graph-only", status: "not-applicable", accepted: false };
	}
	insist(Object.hasOwn(roleTasks, result.slot.role), "unknown entry role");
	insist(
		result.controller?.sessionId === result.slot.id,
		"entry session binding mismatch",
	);
	const acceptance = createEntryAcceptance({
		controller: { snapshot: () => result.controller },
		tsRoot,
	});
	const released = acceptance.releaseTasks(); // Reuses both sealed-answer and close-audit proof checks.
	const task = released.tasks.find((t) => t.id === roleTasks[result.slot.role]);
	const frozen = JSON.parse(entryFiles?.["entry/task.json"] ?? "null");
	insist(
		frozen?.id === task.id && frozen.prompt === task.prompt,
		"entry role/task binding mismatch",
	);
	insist(
		Array.isArray(frozen.sourceIndex) &&
			hash(frozen.sourceIndex.map(({ path, sha256 }) => ({ path, sha256 }))) ===
				hash(task.sourceBindings),
		"entry source binding drift",
	);
	const common = {
		scope: "Graph-only",
		taskId: task.id,
		comparisonProof: released.comparisonProof,
		accepted: false,
		basis:
			"static typecheck plus trusted reviewer assessment; not runtime verification",
	};
	if (!result.entryAnswer) {
		insist(!review, "cannot review a missing entry submission");
		return { ...common, status: "missing" };
	}
	const { snippet, explanation } = result.entryAnswer;
	insist(
		typeof snippet === "string" &&
			snippet.trim() &&
			snippet.length <= 32000 &&
			typeof explanation === "string" &&
			explanation.length <= 6000,
		"bounded entry submission required",
	);
	const binding = {
		sessionId: result.slot.id,
		taskId: task.id,
		snippetHash: sha(snippet),
		explanationHash: sha(explanation),
		entryFilesHash: hash(entryFiles),
	};
	if (!review)
		return {
			...common,
			binding,
			compilation: validateEntrySnippet(tsRoot, snippet),
			review: null,
			status: "pending-review",
		};
	insist(
		review.binding && hash(review.binding) === hash(binding),
		"trusted review submission binding mismatch",
	);
	const graded = acceptance.grade({ taskId: task.id, snippet, review });
	return {
		...graded,
		binding,
		status: graded.accepted ? "accepted" : "rejected",
	};
}
