import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
	compileInProcess,
	COMPILER_PROCESS_POLICY,
} from "./compiler-process.mjs";
/** Offline candidate integration. No credentials, network transport, or live campaign dispatch. */
import { digest, relativePath } from "./frozen-compiler.mjs";
import {
	CONFIG,
	ENTRY_INSTRUCTIONS,
	ENTRY_BUDGET_FEEDBACK_POLICY,
	ENTRY_FINALIZATION_POLICY,
	runSession,
} from "./api-runner.mjs";
import { ENTRY_TOOL } from "./api-tool.mjs";
import { LIMITS } from "./api-limits.mjs";
import { CONCEPTS } from "./materials.mjs";
import { hash } from "./session.mjs";

const check = (v, m) => {
	if (!v) throw Error(m);
};
const unique = (values) => new Set(values).size === values.length;

/** Pins are trusted caller input, never inferred from the submitted artifact itself. */
export function openCandidateRound({
	materialsJSON,
	tasksJSON,
	rubricJSON,
	environmentJSON,
	pins,
	receiptRoot,
}) {
	const texts = {
		materialSHA256: materialsJSON,
		taskSHA256: tasksJSON,
		rubricSHA256: rubricJSON,
		environmentSHA256: environmentJSON,
	};
	for (const [key, text] of Object.entries(texts))
		check(digest(text) === pins?.[key], `${key} mismatch`);
	const materials = JSON.parse(materialsJSON),
		tasks = JSON.parse(tasksJSON),
		rubric = JSON.parse(rubricJSON);
	const compiler = JSON.parse(environmentJSON);
	check(
		compiler.schema === "b121-frozen-compiler-v1" &&
			compiler.nodeVersion === process.version,
		"compiler schema/runtime mismatch",
	);
	const receipts = receiptRoot ?? mkdtempSync(join(tmpdir(), "b121-compiler-"));
	const typecheck = async (snippet, options = {}) => {
		const directory = join(receipts, randomUUID());
		try {
			return await compileInProcess({
				environmentJSON,
				expectedSHA256: pins.environmentSHA256,
				snippet,
				consumerProbe: options.consumerProbe ?? null,
				directory,
				context: options.context ?? null,
				beforeLaunch: options.beforeLaunch,
			});
		} catch (error) {
			return {
				compilation: null,
				compilerFailure: String(error.message),
				receiptDirectory: directory,
				process: null,
			};
		}
	};
	check(
		tasks.materialSHA256 === pins.materialSHA256 &&
			compiler.materialSHA256 === pins.materialSHA256 &&
			rubric.taskSHA256 === pins.taskSHA256,
		"candidate cross-artifact binding mismatch",
	);
	check(
		compiler.snippetLocation === tasks.snippetLocation &&
			relativePath(tasks.snippetLocation),
		"candidate snippet location mismatch",
	);
	check(
		materials.entrypoint === tasks.entrypoint &&
			Object.hasOwn(materials.files, tasks.entrypoint),
		"candidate entrypoint unavailable",
	);
	check(
		tasks.tasks.length > 0 && unique(tasks.tasks.map((t) => t.id)),
		"duplicate/empty tasks",
	);
	check(
		unique(rubric.tasks.map((t) => t.id)) &&
			rubric.tasks.length === tasks.tasks.length,
		"rubric task set mismatch",
	);
	for (const task of tasks.tasks) {
		check(
			typeof task.id === "string" &&
				typeof task.role === "string" &&
				typeof task.prompt === "string",
			"invalid task",
		);
		const r = rubric.tasks.find((r) => r.id === task.id);
		check(
			r?.criteria.length > 0 && unique(r.criteria.map((c) => c.id)),
			"missing/duplicate rubric criteria",
		);
		check(
			(r.consumerProbe === undefined && task.consumerContract === undefined) ||
				(typeof r.consumerProbe === "string" &&
					r.consumerProbe.trim().length > 0 &&
					r.consumerProbe.length <= 16000 &&
					typeof task.consumerContract === "string" &&
					task.consumerContract.trim().length > 0),
			"consumer probe/contract pair required",
		);
		for (const c of r.criteria)
			check(
				typeof materials.files[c.evidencePath] === "string" &&
					digest(materials.files[c.evidencePath]) === c.evidenceSHA256,
				"rubric evidence mismatch",
			);
	}
	const binding = {
		...Object.fromEntries(Object.keys(texts).map((k) => [k, pins[k]])),
		runnerContractSHA256: hash({
			CONFIG,
			ENTRY_INSTRUCTIONS,
			ENTRY_BUDGET_FEEDBACK_POLICY,
			ENTRY_FINALIZATION_POLICY,
			ENTRY_TOOL,
			LIMITS,
			COMPILER_PROCESS_POLICY,
		}),
	};
	const sourceFiles = {},
		sourceIndex = [];
	for (const [path, text] of Object.entries(materials.files)) {
		check(
			relativePath(path) && typeof text === "string",
			"invalid source material",
		);
		const lines = text.split("\n"),
			n = sourceIndex.length;
		const chunks = Math.ceil(lines.length / 80);
		sourceIndex.push({ path, sha256: digest(text), chunks });
		for (let c = 0; c < chunks; c++)
			sourceFiles[`entry/source${n}/chunk${c}.txt`] = [
				path,
				...lines
					.slice(c * 80, (c + 1) * 80)
					.map((line, i) => `${c * 80 + i + 1}: ${line}`),
			].join("\n");
	}
	function prepare(taskId, sampleId) {
		const task = tasks.tasks.find((t) => t.id === taskId);
		check(
			task &&
				typeof sampleId === "string" &&
				/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(sampleId),
			"unknown task or invalid sample",
		);
		return {
			slot: { id: sampleId, arm: "G", role: task.role },
			entryFiles: {
				...sourceFiles,
				"entry/task.json": JSON.stringify({
					taskId,
					instructions: tasks.instructions,
					task: task.prompt,
					...(task.consumerContract === undefined
						? {}
						: { consumerContract: task.consumerContract }),
					role: task.role,
					entrypoint: tasks.entrypoint,
					snippetLocation: tasks.snippetLocation,
					packageAliases: materials.packageAliases ?? {},
					concepts: CONCEPTS,
					sourceIndex,
				}),
			},
		};
	}
	async function assess({
		taskId,
		sampleId,
		result,
		journal,
		kind = "candidate-session",
	}) {
		const prepared = prepare(taskId, sampleId);
		check(
			["candidate-session", "offline-candidate-replay"].includes(kind) &&
				result.experiment === "entry" &&
				hash(result.slot) === hash(prepared.slot),
			"candidate result binding mismatch",
		);
		journal({
			type: "candidate-submission-retained",
			data: structuredClone({ binding, taskId, sampleId, result }),
		});
		let compilation = null,
			compilerFailure = null,
			compilerReceipt = null;
		if (result.entryAnswer) {
			try {
				const outcome = await typecheck(result.entryAnswer.snippet, {
					context: { taskId, sampleId, stage: "entry", binding },
					consumerProbe: rubric.tasks.find((t) => t.id === taskId)
						.consumerProbe,
					beforeLaunch: (data) =>
						journal({ type: "candidate-compiler-started", data }),
				});
				({ compilation, compilerFailure } = outcome);
				compilerReceipt = outcome.receiptDirectory;
			} catch (error) {
				compilerFailure = String(error.message);
			}
		}
		const assessment = {
			kind,
			formalReady: false,
			providerCalls: kind === "offline-candidate-replay" ? 0 : null,
			binding,
			taskId,
			sampleId,
			packetSHA256: hash(prepared.entryFiles),
			result,
			compilation,
			compilerFailure,
			compilerReceipt,
			status: compilerFailure
				? "harness-failure"
				: result.fatal || !result.entryAnswer
					? "incomplete"
					: compilation.materialDiagnostics.length
						? "material-diagnostics"
						: compilation.ok
							? "pending-review"
							: "compile-failed",
		};
		const output = structuredClone(assessment);
		journal({ type: "candidate-assessment", data: output });
		return { assessment: output, assessmentSHA256: hash(output) };
	}

	return {
		binding: structuredClone(binding),
		taskIds: tasks.tasks.map((t) => t.id),
		prepare,
		assess,
		compilerVersion: compiler.compilerVersion,
		// Trusted offline qualification only; never exposed as a participant broker operation.
		typecheck,
		/** Replays complete API response bodies through the real controller, then frozen typechecks.
		 * All counters/costs in result are replay data, never actual provider spend or participant evidence.
		 */
		async replay({ taskId, sampleId, responses, journal }) {
			const prepared = prepare(taskId, sampleId);
			check(
				Array.isArray(responses) &&
					responses.length > 0 &&
					typeof journal === "function",
				"responses/journal required",
			);
			const queue = structuredClone(responses);
			let i = 0;
			const result = await runSession({
				...prepared,
				mode: "entry",
				journal,
				transport: {
					estimate: async () => ({
						kind: "local-input-estimate",
						inputTokens: queue[i]?.usage?.prompt_tokens ?? 0,
					}),
					create: async () => {
						check(i < queue.length, "offline replay exhausted");
						return { body: queue[i++] };
					},
				},
			});
			return assess({
				taskId,
				sampleId,
				result,
				journal,
				kind: "offline-candidate-replay",
			});
		},
		/** Reviewers receive this API outside the participant broker. No correction/repair turn. */
		async review({ assessment, assessmentSHA256, review }) {
			check(
				hash(assessment) === assessmentSHA256 &&
					review?.assessmentSHA256 === assessmentSHA256,
				"assessment digest mismatch",
			);
			check(
				hash(assessment.binding) === hash(binding) &&
					["offline-candidate-replay", "candidate-session"].includes(
						assessment.kind,
					),
				"assessment binding mismatch",
			);
			const prepared = prepare(assessment.taskId, assessment.sampleId);
			check(
				assessment.packetSHA256 === hash(prepared.entryFiles) &&
					hash(assessment.result.slot) === hash(prepared.slot),
				"assessment task/role mismatch",
			);
			check(
				typeof review.reviewerId === "string" && review.reviewerId.trim(),
				"trusted reviewer identity required",
			);
			const criteria = rubric.tasks.find(
				(t) => t.id === assessment.taskId,
			).criteria;
			check(
				review.criteria &&
					Object.keys(review.criteria).sort().join() ===
						criteria
							.map((c) => c.id)
							.sort()
							.join(),
				"exact criterion set required",
			);
			for (const c of criteria) {
				const item = review.criteria[c.id];
				check(
					item &&
						(typeof item.pass === "boolean" || item.pass === null) &&
						typeof item.evidence === "string" &&
						item.evidence.trim(),
					"criterion verdict/evidence required",
				);
			}
			// Recompute the compiler verdict, never trust an editable cached ok flag.
			const result = assessment.result;
			if (assessment.compilerFailure)
				return {
					assessmentSHA256,
					accepted: false,
					status: "harness-failure",
					formalReady: false,
					compilerReceipt: assessment.compilerReceipt,
				};
			const outcome = result.entryAnswer
				? await typecheck(result.entryAnswer.snippet, {
						consumerProbe: rubric.tasks.find((t) => t.id === assessment.taskId)
							.consumerProbe,
						context: {
							taskId: assessment.taskId,
							sampleId: assessment.sampleId,
							stage: "review",
							assessmentSHA256,
							binding,
						},
					})
				: null;
			if (outcome?.compilerFailure)
				return {
					assessmentSHA256,
					accepted: false,
					status: "harness-failure",
					formalReady: false,
					compilerReceipt: outcome.receiptDirectory,
				};
			const compiled = outcome?.compilation ?? null;
			check(
				hash(compiled) === hash(assessment.compilation),
				"cached compilation mismatch",
			);
			const ambiguous = Object.values(review.criteria).some(
				(c) => c.pass === null,
			);
			const eligible =
				!result.fatal &&
				result.entryStatus === "submitted" &&
				compiled?.ok === true &&
				!assessment.compilerFailure;
			return {
				assessmentSHA256,
				binding: structuredClone(binding),
				taskId: assessment.taskId,
				sampleId: assessment.sampleId,
				formalReady: false,
				providerCalls: 0,
				accepted:
					!ambiguous &&
					eligible &&
					Object.values(review.criteria).every((c) => c.pass === true),
				status: ambiguous
					? "pending-rubric-review"
					: !eligible
						? assessment.status
						: Object.values(review.criteria).every((c) => c.pass)
							? assessment.kind === "offline-candidate-replay"
								? "accepted-offline-replay"
								: "accepted-candidate-session"
							: "criteria-failed",
				compilerReceipt: outcome?.receiptDirectory ?? null,
				review: structuredClone(review),
			};
		},
	};
}
