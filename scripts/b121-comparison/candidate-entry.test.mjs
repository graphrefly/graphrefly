import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { digest, openFrozenCompiler } from "./frozen-compiler.mjs";
import { openCandidateRound } from "./candidate-entry.mjs";
import { ROUTE } from "./api-provider.mjs";
import { maximumCost } from "./api-runner.mjs";
import { createSourceAccess } from "./source-access.mjs";
import { hash } from "./session.mjs";
import { candidatePreflight } from "./candidate-preflight.mjs";
import { fileURLToPath } from "node:url";

const dir = new URL(
	"../../sessions/active/b121-comparison-design-v1/agent-api/candidate-round/",
	import.meta.url,
);
const read = (name) => readFileSync(new URL(name, dir), "utf8");
const environmentJSON = gunzipSync(
	readFileSync(new URL("compiler-environment.json.gz", dir)),
).toString();
const inputs = {
	materialsJSON: read("materials.json"),
	tasksJSON: read("tasks.json"),
	rubricJSON: read("reviewer-rubric.json"),
	environmentJSON,
	pins: JSON.parse(read("integration-pins.json")),
};
const compiler = openFrozenCompiler(
	environmentJSON,
	inputs.pins.environmentSHA256,
);
const round = openCandidateRound(inputs);
function response(requests, i = 1) {
	return {
		id: `offline-${i}`,
		model: ROUTE.model,
		provider: ROUTE.provider,
		usage: {
			prompt_tokens: 100,
			completion_tokens: 20,
			total_tokens: 120,
			cost: maximumCost(100, 20),
			prompt_tokens_details: { cached_tokens: 0 },
			completion_tokens_details: { reasoning_tokens: 0 },
		},
		choices: [
			{
				finish_reason: "tool_calls",
				message: {
					role: "assistant",
					content: null,
					tool_calls: [
						{
							id: `call-${i}`,
							type: "function",
							function: {
								name: "broker",
								arguments: JSON.stringify({ requests }),
							},
						},
					],
				},
			},
		],
	};
}
const submit = (snippet) => ({
	op: "submit",
	snippet,
	explanation: "Synthetic harness test, not a task solution.",
	concepts: { read: [], required: [], firstExpansion: null },
});
async function replay(
	taskId = round.taskIds[0],
	snippet = "export const x: number = 1;",
) {
	const events = [];
	const result = await round.replay({
		taskId,
		sampleId: "offline-test",
		journal: (e) => events.push(e),
		responses: [
			response([{ op: "read", path: "entry/task.json" }]),
			response([{ op: "read", path: "examples/spending-alerts/README.md" }], 2),
			response([submit(snippet)], 3),
		],
	});
	return { ...result, events };
}
function reviewFor(assessmentSHA256, taskId) {
	const criteria = JSON.parse(inputs.rubricJSON).tasks.find(
		(t) => t.id === taskId,
	).criteria;
	return {
		assessmentSHA256,
		reviewerId: "synthetic-review-test",
		criteria: Object.fromEntries(
			criteria.map((c) => [
				c.id,
				{
					pass: true,
					evidence: "Test-only verdict; not a real rubric judgment.",
				},
			]),
		),
	};
}

test("frozen compiler resolves TS/Node declarations, detects type errors and rejects tampering", () => {
	assert.equal(compiler.compile("export const x: number = 1;").ok, true);
	assert.equal(compiler.compile('export const x: number = "bad";').ok, false);
	assert.equal(compiler.compile("   ").ok, false);
	assert.equal(
		compiler.compile(
			'import { readFileSync } from "node:fs"; export const x: typeof readFileSync = readFileSync;',
		).ok,
		true,
	);
	assert.throws(
		() =>
			openFrozenCompiler(environmentJSON + " ", inputs.pins.environmentSHA256),
		/digest mismatch/,
	);
});
test("compiler never resolves an existing external disk file and never executes a snippet", () => {
	const folder = mkdtempSync(join(tmpdir(), "b121-isolation-"));
	try {
		const path = join(folder, "secret.ts");
		writeFileSync(path, "export const secret = 1;");
		const snippet = `import {secret} from ${JSON.stringify(path)}; export const x = secret;`;
		const before = compiler.compile(snippet);
		rmSync(path);
		assert.deepEqual(compiler.compile(snippet), before);
		assert.equal(before.ok, false);
		assert(before.diagnostics.some((d) => d.code === 2307));
		assert.equal(
			compiler.compile('throw new Error("must not execute"); export {};').ok,
			true,
		);
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
});
test("frozen source compilation identifies supplied material dependency faults separately", () => {
	const result = compiler.compile(
		'import type { SpendingAlertsView } from "./causal-preset.js"; export type View = SpendingAlertsView;',
	);
	assert.equal(result.ok, false);
	assert(
		result.materialDiagnostics.some(
			(d) => d.path.endsWith("/pipeline.ts") && d.code === 2307,
		),
	);
});
test("all candidate IDs bind their prompt/role; broker excludes rubric/compiler and older tasks", async () => {
	for (const task of JSON.parse(inputs.tasksJSON).tasks) {
		const prepared = round.prepare(task.id, "sample");
		const broker = createSourceAccess(prepared.entryFiles);
		const metadata = JSON.parse(
			broker.request({ op: "read", path: "entry/task.json" }).content,
		);
		assert.equal(metadata.task, task.prompt);
		assert.equal(prepared.slot.role, task.role);
		assert.throws(() =>
			broker.request({ op: "read", path: "reviewer-rubric.json" }),
		);
		assert.throws(() =>
			broker.request({ op: "read", path: "compiler-environment.json.gz" }),
		);
		const { assessment, events } = await replay(task.id);
		assert.equal(assessment.status, "pending-review");
		assert.equal(assessment.providerCalls, 0);
		assert.equal(assessment.result.fatal, null);
		assert.equal(events.at(-1).type, "candidate-assessment");
	}
	assert.throws(() => round.prepare("ordinary", "sample"), /unknown task/);
});
test("review requires all criteria and bound submission; ambiguity stays pending", async () => {
	const { assessment, assessmentSHA256 } = await replay();
	const review = reviewFor(assessmentSHA256, assessment.taskId);
	assert.equal(
		(await round.review({ assessment, assessmentSHA256, review })).accepted,
		true,
	);
	const first = Object.keys(review.criteria)[0];
	review.criteria[first].pass = null;
	assert.equal(
		(await round.review({ assessment, assessmentSHA256, review })).status,
		"pending-rubric-review",
	);
	delete review.criteria[first];
	await assert.rejects(
		() => round.review({ assessment, assessmentSHA256, review }),
		/criterion set/,
	);
	const altered = structuredClone(assessment);
	altered.result.entryAnswer.snippet = 'export const x: number = "bad";';
	const newHash = hash(altered);
	await assert.rejects(
		() =>
			round.review({
				assessment: altered,
				assessmentSHA256: newHash,
				review: reviewFor(newHash, altered.taskId),
			}),
		/compilation mismatch/,
	);
	altered.result.slot.role = "ordinary";
	const roleHash = hash(altered);
	await assert.rejects(
		() =>
			round.review({
				assessment: altered,
				assessmentSHA256: roleHash,
				review: reviewFor(roleHash, altered.taskId),
			}),
		/task\/role mismatch/,
	);
});
test("failed/missing/material-error submissions remain in evidence and cannot pass review", async () => {
	for (const snippet of [
		"",
		'export const x: number = "bad";',
		'import type { SpendingAlertsView } from "./causal-preset.js"; export type View = SpendingAlertsView;',
	]) {
		const { assessment, assessmentSHA256 } = await replay(
			round.taskIds[0],
			snippet,
		);
		assert.equal(
			(
				await round.review({
					assessment,
					assessmentSHA256,
					review: reviewFor(assessmentSHA256, assessment.taskId),
				})
			).accepted,
			false,
		);
		assert(assessment.result.entryAnswer);
		if (snippet.includes("SpendingAlertsView"))
			assert.equal(assessment.status, "material-diagnostics");
	}
	const { assessment, assessmentSHA256 } = await round.replay({
		taskId: round.taskIds[0],
		sampleId: "missing",
		responses: [response([{ op: "list" }])],
		journal: () => {},
	});
	assert.equal(assessment.status, "incomplete");
	assert(assessment.result.fatal);
	assert.equal(
		(
			await round.review({
				assessment,
				assessmentSHA256,
				review: reviewFor(assessmentSHA256, assessment.taskId),
			})
		).accepted,
		false,
	);
});
test("artifact drift is rejected before replay", () => {
	assert.throws(
		() => openCandidateRound({ ...inputs, tasksJSON: inputs.tasksJSON + " " }),
		/taskSHA256 mismatch/,
	);
	const rubric = JSON.parse(inputs.rubricJSON);
	rubric.taskSHA256 = "wrong";
	const rubricJSON = JSON.stringify(rubric);
	assert.throws(
		() =>
			openCandidateRound({
				...inputs,
				rubricJSON,
				pins: { ...inputs.pins, rubricSHA256: digest(rubricJSON) },
			}),
		/cross-artifact/,
	);
});
test("submission retained before a later denied read never becomes a successful session", async () => {
	const { assessment, assessmentSHA256 } = await round.replay({
		taskId: round.taskIds[0],
		sampleId: "partial",
		journal: () => {},
		responses: [
			response([
				submit("export {};"),
				{ op: "read", path: "reviewer-rubric.json" },
			]),
		],
	});
	assert.equal(assessment.compilation.ok, true);
	assert(assessment.result.fatal);
	assert.equal(assessment.status, "incomplete");
	assert.equal(
		(
			await round.review({
				assessment,
				assessmentSHA256,
				review: reviewFor(assessmentSHA256, assessment.taskId),
			})
		).accepted,
		false,
	);
});
test("v2 source package aliases close all four module probes without changing tasks or rubric", async () => {
	const v2 = new URL("../candidate-round-v2/", dir);
	const report = await candidatePreflight(fileURLToPath(v2));
	assert.equal(report.readyForCandidateTypechecking, true);
	assert.equal(report.rows.length, 4);
	assert(report.rows.every((r) => r.ok && r.diagnostics.length === 0));
	assert.equal(report.providerCalls, 0);
	assert.equal(report.participantSolutions, 0);
	assert.equal(report.formalReady, false);
	const readV2 = (name) => JSON.parse(readFileSync(new URL(name, v2), "utf8"));
	const originalTasks = JSON.parse(inputs.tasksJSON),
		nextTasks = readV2("tasks.json");
	delete originalTasks.materialSHA256;
	delete nextTasks.materialSHA256;
	assert.deepEqual(nextTasks, originalTasks);
	const originalRubric = JSON.parse(inputs.rubricJSON),
		nextRubric = readV2("reviewer-rubric.json");
	delete originalRubric.taskSHA256;
	delete nextRubric.taskSHA256;
	assert.deepEqual(nextRubric, originalRubric);
	const oldFiles = JSON.parse(inputs.materialsJSON).files,
		newFiles = readV2("materials.json").files;
	for (const [path, text] of Object.entries(oldFiles))
		assert.equal(newFiles[path], text);
});
test("real compiler initialization failure retains submission and durable sample linkage without retry", async () => {
	const root = mkdtempSync(join(tmpdir(), "b121-worker-failure-"));
	try {
		const env = JSON.parse(environmentJSON);
		env.compilerJS = 'throw new Error("synthetic compiler startup failure");';
		const brokenJSON = JSON.stringify(env);
		const broken = openCandidateRound({
			...inputs,
			environmentJSON: brokenJSON,
			pins: { ...inputs.pins, environmentSHA256: digest(brokenJSON) },
			receiptRoot: root,
		});
		const events = [];
		const { assessment, assessmentSHA256 } = await broken.replay({
			taskId: broken.taskIds[0],
			sampleId: "retained",
			responses: [response([submit("export {};")])],
			journal: (e) => events.push(e),
		});
		assert.equal(assessment.status, "harness-failure");
		assert.equal(assessment.compilation, null);
		assert(assessment.compilerFailure);
		assert.equal(assessment.result.entryAnswer.snippet, "export {};");
		const receipt = JSON.parse(
			readFileSync(join(assessment.compilerReceipt, "completion.json"), "utf8"),
		);
		assert.equal(receipt.exitCode, 1);
		assert.equal(receipt.retryAllowed, false);
		const started = JSON.parse(
			readFileSync(join(assessment.compilerReceipt, "started.json"), "utf8"),
		);
		assert.equal(started.context.sampleId, "retained");
		assert.equal(started.context.taskId, broken.taskIds[0]);
		assert.equal(started.context.stage, "entry");
		const retainedIndex = events.findIndex(
			(e) => e.type === "candidate-submission-retained",
		);
		const startedIndex = events.findIndex(
			(e) => e.type === "candidate-compiler-started",
		);
		assert(retainedIndex >= 0 && startedIndex > retainedIndex);
		assert.equal(
			events.filter((e) => e.type === "candidate-compiler-started").length,
			1,
		);
		assert.equal(
			(
				await broken.review({
					assessment,
					assessmentSHA256,
					review: reviewFor(assessmentSHA256, assessment.taskId),
				})
			).accepted,
			false,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
test("preflight retains all task rows when compiler receipt storage is unavailable", async () => {
	const root = mkdtempSync(join(tmpdir(), "b121-receipt-missing-"));
	rmSync(root, { recursive: true, force: true });
	const report = await candidatePreflight(
		fileURLToPath(new URL("../candidate-round-v2/", dir)),
		{ receiptRoot: root },
	);
	assert.equal(report.rows.length, 4);
	assert.equal(report.readyForCandidateTypechecking, false);
	assert(
		report.rows.every((r) => !r.ok && r.compilerFailure.includes("ENOENT")),
	);
});

function consumerInputs(
	probe = 'import { accept } from "./__b121_entry_validation__.js"; accept(42);',
) {
	const tasks = JSON.parse(inputs.tasksJSON),
		rubric = JSON.parse(inputs.rubricJSON);
	tasks.tasks[0].consumerContract =
		"Export accept(value: number); checked from a separate consumer module.";
	rubric.tasks[0].consumerProbe = probe;
	const tasksJSON = JSON.stringify(tasks);
	rubric.taskSHA256 = digest(tasksJSON);
	const rubricJSON = JSON.stringify(rubric);
	return {
		...inputs,
		tasksJSON,
		rubricJSON,
		pins: {
			...inputs.pins,
			taskSHA256: digest(tasksJSON),
			rubricSHA256: digest(rubricJSON),
		},
	};
}

test("separate consumer file catches wrong parameter, missing export and snippet-local suppression", () => {
	const probe =
		'import { accept } from "./__b121_entry_validation__.js"; accept(42);';
	for (const snippet of [
		"export function accept(x: string) {}",
		"// @ts-nocheck\nexport function accept(x: string) {}",
		"export const other = 1;",
	]) {
		assert.equal(compiler.compile(snippet).ok, true);
		const result = compiler.compile(snippet, probe);
		assert.equal(result.ok, false);
		assert.equal(result.materialDiagnostics.length, 0);
		assert.equal(result.consumerProbeSHA256, digest(probe));
		assert.ok(
			result.diagnostics.some((d) =>
				d.path.endsWith("__b121_consumer_probe__.ts"),
			),
		);
	}
	assert.equal(
		compiler.compile("export function accept(x: number) {}", probe).ok,
		true,
	);
	assert.throws(
		() => compiler.compile("export {}", ""),
		/bounded consumer probe/,
	);
});

test("consumer contract is disclosed, probe private and task-bound; assess and review both enforce it", async () => {
	const ci = consumerInputs(),
		cr = openCandidateRound(ci),
		taskId = cr.taskIds[0];
	const prepared = cr.prepare(taskId, "consumer-test");
	const packet = JSON.parse(prepared.entryFiles["entry/task.json"]);
	assert.match(packet.consumerContract, /Export accept/);
	assert.ok(!JSON.stringify(prepared.entryFiles).includes("accept(42)"));
	for (const [snippet, expected] of [
		["export function accept(x: string) {}", "compile-failed"],
		["export function accept(x: number) {}", "pending-review"],
	]) {
		const outcome = await cr.replay({
			taskId,
			sampleId: "consumer-test",
			responses: [response([submit(snippet)])],
			journal: () => {},
		});
		assert.equal(outcome.assessment.status, expected);
		assert.equal(
			outcome.assessment.compilation.consumerProbeSHA256,
			digest(JSON.parse(ci.rubricJSON).tasks[0].consumerProbe),
		);
		const reviewed = await cr.review({
			...outcome,
			review: reviewFor(outcome.assessmentSHA256, taskId),
		});
		assert.equal(reviewed.accepted, expected === "pending-review");
		if (expected === "compile-failed") {
			const forged = structuredClone(outcome.assessment);
			forged.compilation.ok = true;
			await assert.rejects(
				cr.review({
					assessment: forged,
					assessmentSHA256: hash(forged),
					review: reviewFor(hash(forged), taskId),
				}),
				/cached compilation mismatch/,
			);
		}
	}
	const changed = consumerInputs(
		'import { accept } from "./__b121_entry_validation__.js"; accept("changed");',
	);
	assert.notDeepEqual(openCandidateRound(changed).binding, cr.binding);
});

test("consumer probe requires a participant-visible contract before opening a round", () => {
	const ci = consumerInputs();
	const tasks = JSON.parse(ci.tasksJSON),
		rubric = JSON.parse(ci.rubricJSON);
	delete tasks.tasks[0].consumerContract;
	ci.tasksJSON = JSON.stringify(tasks);
	ci.pins.taskSHA256 = digest(ci.tasksJSON);
	rubric.taskSHA256 = ci.pins.taskSHA256;
	ci.rubricJSON = JSON.stringify(rubric);
	ci.pins.rubricSHA256 = digest(ci.rubricJSON);
	assert.throws(() => openCandidateRound(ci), /probe\/contract pair/);
});
