import { runtimeBindings, orchestratorEnvironment } from "./runtime-bindings.mjs";
import { createGraphContext } from "../../../graphrefly-ts/packages/ts/evals/b121/graph-runtime.mjs";
import { runCampaignGraph } from "../../../graphrefly-ts/packages/ts/evals/b121/campaign-control.mjs";
/** Fixed candidate entry campaign. Explicit inputs only; importing never dispatches or reads a key. */
import {
	readFileSync,
	readdirSync,
	mkdirSync,
	openSync,
	writeFileSync,
	fsyncSync,
	closeSync,
	existsSync,
} from "node:fs";
import { resolve, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { digest } from "./frozen-compiler.mjs";
import { durableWrite } from "./recorded-process.mjs";
import { openCandidateRound } from "./candidate-entry.mjs";
import {
	CONFIG,
	ENTRY_INSTRUCTIONS,
	ENTRY_BUDGET_FEEDBACK_POLICY,
	ENTRY_FINALIZATION_POLICY,
	MAX_OUTPUT_PER_REQUEST,
	runSession,
} from "./api-runner.mjs";
import { LIMITS } from "./api-limits.mjs";
import { ENTRY_TOOL } from "./api-tool.mjs";
import { COMPILER_PROCESS_POLICY } from "./compiler-process.mjs";
import { CEILING_USD, MAX_GENERATION_CALLS, ROUTE, maximumCost } from "./api-provider.mjs";
import {
	createOpenRouterTransport,
	qualifyProvider,
	RETRY_POLICY,
	CONNECTION_POLICY,
} from "./api-transport.mjs";
import { hash } from "./session.mjs";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const check = (v, m) => {
	if (!v) throw Error(m);
};
const artifactNames = [
	"materials.json",
	"tasks.json",
	"reviewer-rubric.json",
	"integration-pins.json",
	"compiler-environment.json.gz",
];
function readInputs(directory) {
	const artifacts = Object.fromEntries(
		artifactNames.map((f) => [f, readFileSync(join(directory, f))]),
	);
	return {
		artifacts,
		inputs: {
			materialsJSON: artifacts["materials.json"].toString(),
			tasksJSON: artifacts["tasks.json"].toString(),
			rubricJSON: artifacts["reviewer-rubric.json"].toString(),
			environmentJSON: gunzipSync(artifacts["compiler-environment.json.gz"]).toString(),
			pins: JSON.parse(artifacts["integration-pins.json"]),
		},
	};
}
function codeBindings() {
	const directories = [
		join(root, "scripts/b121-comparison"),
		resolve(root, "../graphrefly-ts/packages/ts/evals/graph-native-rerun-avoidance"),
	];
	return [
		...directories.flatMap((dir) =>
			readdirSync(dir)
				.filter((f) => f.endsWith(".mjs") && !f.endsWith(".test.mjs"))
				.sort()
				.map((f) => ({
					path: relative(root, join(dir, f)),
					sha256: digest(readFileSync(join(dir, f))),
				})),
		),
		...runtimeBindings(),
	];
}
function contract() {
	return {
		orchestratorEnvironment,
		CONFIG,
		ENTRY_INSTRUCTIONS,
		ENTRY_BUDGET_FEEDBACK_POLICY,
		ENTRY_FINALIZATION_POLICY,
		ENTRY_TOOL,
		LIMITS,
		MAX_OUTPUT_PER_REQUEST,
		ROUTE,
		COMPILER_PROCESS_POLICY,
		RETRY_POLICY,
		CONNECTION_POLICY,
	};
}
function policy(denominator) {
	return {
		qualificationCalls: 4,
		replicatesPerTask: 1,
		modelSessionRetries: 0,
		compilerRetries: 0,
		order: "task-array-order",
		denominator,
		stop: "infrastructure/material/compiler failure stops remainder; participant failure remains and proceeds; no replacement",
		scoring:
			"Original rubric, frozen compilation, then trusted independent criterion review; no grader repair turn.",
	};
}
function validateBudget(budget) {
	check(
		budget?.ceilingUSD === CEILING_USD &&
			["reportedUsageUSD", "unresolvedReservationsUSD"].every(
				(k) => Number.isFinite(budget[k]) && budget[k] >= 0,
			) &&
			typeof budget.asOf === "string" &&
			Number.isFinite(Date.parse(budget.asOf)) &&
			/^[a-f0-9]{64}$/.test(budget.receiptSHA256),
		"explicit budget evidence required",
	);
}
/** Preparation has no live effect and grants no authorization. Caller supplies the audited money snapshot. */
export function prepareCandidateManifest({ candidateDirectory, budget, outputRoot }) {
	validateBudget(budget);
	check(
		typeof outputRoot === "string" && outputRoot.length > 0,
		"explicit canonical output root required",
	);
	const { artifacts, inputs } = readInputs(candidateDirectory),
		round = openCandidateRound(inputs);
	const tasks = JSON.parse(inputs.tasksJSON).tasks;
	return {
		schema: "b121-fixed-entry-campaign-v1",
		work: "graphrefly:B121",
		authorization: false,
		outputRoot: resolve(outputRoot),
		interpretation:
			"Predeclared task observations, not an independently authored holdout or statistical success-rate estimate.",
		binding: round.binding,
		artifactSHA256: Object.fromEntries(Object.entries(artifacts).map(([f, b]) => [f, digest(b)])),
		samples: tasks.map((t, i) => {
			const sampleId = `candidate-entry-${String(i + 1).padStart(2, "0")}`;
			return {
				sampleId,
				taskId: t.id,
				role: t.role,
				packetSHA256: hash(round.prepare(t.id, sampleId).entryFiles),
			};
		}),
		contract: contract(),
		codeBindings: codeBindings(),
		budget: structuredClone(budget),
		policy: policy(tasks.length),
	};
}
function verify(manifest, inputs, artifacts, round) {
	check(
		manifest.schema === "b121-fixed-entry-campaign-v1" &&
			manifest.work === "graphrefly:B121" &&
			manifest.authorization === false,
		"candidate manifest schema mismatch",
	);
	validateBudget(manifest.budget);
	check(
		hash(manifest.contract) === hash(contract()) && hash(manifest.binding) === hash(round.binding),
		"candidate contract drift",
	);
	check(hash(manifest.codeBindings) === hash(codeBindings()), "candidate implementation drift");
	check(
		hash(manifest.artifactSHA256) ===
			hash(Object.fromEntries(Object.entries(artifacts).map(([f, b]) => [f, digest(b)]))),
		"candidate artifact drift",
	);
	const expected = prepareCandidateManifestFromLoaded(inputs, round);
	check(
		hash(manifest.samples) === hash(expected) &&
			hash(manifest.policy) === hash(policy(expected.length)),
		"fixed sample/policy mismatch",
	);
}
function prepareCandidateManifestFromLoaded(inputs, round) {
	return JSON.parse(inputs.tasksJSON).tasks.map((t, i) => {
		const sampleId = `candidate-entry-${String(i + 1).padStart(2, "0")}`;
		return {
			sampleId,
			taskId: t.id,
			role: t.role,
			packetSHA256: hash(round.prepare(t.id, sampleId).entryFiles),
		};
	});
}
/** Exact manifest + existing one-shot authorization + shared spend adapter, before any HTTP call. */
export async function runCandidateCampaign({
	candidateDirectory,
	manifest,
	approval,
	apiKey,
	outputRoot,
	fetchImpl = globalThis.fetch,
}) {
	manifest = structuredClone(manifest);
	approval = structuredClone(approval);
	const manifestSHA = hash(manifest),
		{ artifacts, inputs } = readInputs(candidateDirectory);
	const initialRound = openCandidateRound(inputs);
	verify(manifest, inputs, artifacts, initialRound);
	check(
		typeof manifest.outputRoot === "string" &&
			resolve(manifest.outputRoot) === manifest.outputRoot &&
			resolve(outputRoot ?? manifest.outputRoot) === manifest.outputRoot,
		"approved output root mismatch",
	);
	outputRoot = manifest.outputRoot;
	const budgetAge = Date.now() - Date.parse(manifest.budget.asOf);
	check(
		budgetAge >= 0 && budgetAge <= 3600000,
		"current budget snapshot required (one hour maximum)",
	);
	const committed = manifest.budget.reportedUsageUSD + manifest.budget.unresolvedReservationsUSD;
	check(
		approval?.manifestSHA === manifestSHA &&
			approval.priorUsageUSD === committed &&
			approval.sessionIds === undefined &&
			approval.attemptId === undefined,
		"exact candidate campaign approval required",
	);
	check(hash(approval.retries) === hash(RETRY_POLICY), "frozen retry policy required");
	check(
		approval.action === "B121-agent-api-one-shot" &&
			approval.acceptAliasLimitation === true &&
			approval.acceptInputEstimateLimitation === true &&
			Date.parse(approval.expiresAt) > Date.now() &&
			approval.maxGenerationCalls === MAX_GENERATION_CALLS &&
			approval.maxUSD === CEILING_USD &&
			approval.model === ROUTE.model &&
			approval.providerTag === ROUTE.tag &&
			typeof apiKey === "string" &&
			apiKey.length > 0,
		"current candidate approval/route/limits required",
	);
	let journal,
		transport = null;
	mkdirSync(outputRoot, { recursive: true, mode: 0o700 });
	const directory = join(outputRoot, manifestSHA);
	mkdirSync(directory, { mode: 0o700 });
	durableWrite(join(directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
	durableWrite(join(directory, "approval.json"), JSON.stringify(approval, null, 2) + "\n");
	for (const [name, bytes] of Object.entries(artifacts)) durableWrite(join(directory, name), bytes);
	let rows = manifest.samples.map((s) => ({
		...s,
		status: "not-run",
		reason: "not-started",
		assessmentSHA256: null,
	}));
	durableWrite(join(directory, "planned-samples.json"), JSON.stringify(rows, null, 2) + "\n");
	const receiptRoot = join(directory, "compiler");
	mkdirSync(receiptRoot, { mode: 0o700 });
	const round = openCandidateRound({ ...inputs, receiptRoot });
	const fd = openSync(join(directory, "journal.jsonl"), "wx", 0o600);
	let previous = null,
		index = 0;
	journal = (event) => {
		const row = { index: index++, previous, event: structuredClone(event) };
		try {
			previous = hash(row);
		} catch (error) {
			throw new Error(`nonserializable campaign journal event: ${event.type}`, { cause: error });
		}
		writeFileSync(fd, JSON.stringify({ ...row, hash: previous }) + "\n");
		fsyncSync(fd);
	};
	const graphContext = createGraphContext({ name: `b121-${manifestSHA}` });
	let failure = null,
		summary = null;
	function makeSummary(rows, failure) {
		return {
			manifestSHA,
			denominator: rows.length,
			rows,
			failure,
			transport: transport?.snapshot() ?? {
				generationCalls: 0,
				estimates: 0,
				countCalls: 0,
				reservedUSD: 0,
				reportedCostUSD: 0,
				unknownReservedUSD: 0,
				priorUsageUSD: committed,
				stopped: true,
			},
			completedCollection: rows.every((r) => r.status !== "not-run" && r.status !== "interrupted"),
			scoresPending: true,
			retryAllowed: false,
		};
	}

	try {
		journal({
			type: "campaign-claimed",
			data: { manifestSHA, approvalSHA256: hash(approval) },
		});
		const campaign = await runCampaignGraph({
			graphContext,
			name: manifestSHA,
			samples: manifest.samples,
			budgetAdmitted:
				committed + maximumCost(ROUTE.contextTokens, MAX_OUTPUT_PER_REQUEST) <=
				manifest.budget.ceilingUSD,
			journal,
			effects: {
				async qualification() {
					transport = createOpenRouterTransport({
						apiKey,
						approval,
						manifestSHA,
						fetchImpl,
						journal,
						graphContext,
					});
					const result = await qualifyProvider({ transport, journal, graphContext });
					journal({ type: "candidate-qualification", data: result });
					return result;
				},
				async session({ sample }) {
					verify(manifest, inputs, artifacts, round);
					journal({ type: "sample-started", data: { sampleId: sample.sampleId } });
					return runSession({
						...round.prepare(sample.taskId, sample.sampleId),
						mode: "entry",
						transport,
						journal,
						graphContext,
					});
				},
				"result-persistence"({ sample, result }) {
					durableWrite(
						join(directory, `${sample.sampleId}.result.json`),
						JSON.stringify(result, null, 2) + "\n",
					);
					return { sampleId: sample.sampleId, resultSHA256: hash(result) };
				},
				assessment({ sample, result }) {
					return round.assess({
						taskId: sample.taskId,
						sampleId: sample.sampleId,
						result,
						journal,
					});
				},
				"assessment-persistence"({ sample, outcome }) {
					durableWrite(
						join(directory, `${sample.sampleId}.assessment.json`),
						JSON.stringify(outcome, null, 2) + "\n",
					);
					journal({
						type: "sample-finished",
						data: {
							...sample,
							status: outcome.assessment.status,
							assessmentSHA256: outcome.assessmentSHA256,
						},
					});
					return { sampleId: sample.sampleId, assessmentSHA256: outcome.assessmentSHA256 };
				},
				"final-persistence"({ collection }) {
					summary = makeSummary(collection.rows, collection.failure);
					durableWrite(
						join(directory, "graph-topology.json"),
						JSON.stringify(graphContext.graph.topology(), null, 2) + "\n",
					);
					journal({ type: "campaign-finished", data: summary });
					durableWrite(join(directory, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
					return { summarySHA256: hash(summary) };
				},
			},
			classify(result, outcome) {
				return {
					row: { status: outcome.assessment.status, assessmentSHA256: outcome.assessmentSHA256 },
					failure:
						outcome.assessment.compilerFailure ??
						(outcome.assessment.compilation?.materialDiagnostics.length
							? "material-diagnostics"
							: result.fatal && result.failureScope !== "participant"
								? result.fatal
								: null),
				};
			},
		});
		rows = campaign.rows;
		failure = campaign.failure;
	} catch (error) {
		failure = String(error.message);
		if (error.campaignSnapshot) rows = error.campaignSnapshot.rows;
		else for (const row of rows) if (row.status === "not-run") row.reason = failure;
		summary = {
			...makeSummary(rows, failure),
			completedCollection: false,
			persistenceFailure: true,
		};
		// Diagnostic recovery evidence is not a successful campaign summary or a replay grant.
		durableWrite(join(directory, "interruption.json"), JSON.stringify(summary, null, 2) + "\n");
	} finally {
		try {
			await transport?.dispose?.();
			graphContext.dispose();
		} finally {
			closeSync(fd);
		}
	}

	return { directory, summary };
}
/** Read-only crash recovery. Never dispatches or deletes the claim. */
export function readCandidateCampaign(directory) {
	const manifest = JSON.parse(readFileSync(join(directory, "manifest.json")));
	let rows = manifest.samples.map((s) => ({
		...s,
		status: "not-run",
		reason: "no-start-record",
	}));
	let previous = null,
		index = 0,
		finished = null,
		journalTailIncomplete = false;
	const path = join(directory, "journal.jsonl");
	const contents = existsSync(path) ? readFileSync(path, "utf8") : "";
	const lines = contents.split("\n");
	if (contents && !contents.endsWith("\n")) {
		lines.pop();
		journalTailIncomplete = true;
	}
	for (const line of lines.filter(Boolean)) {
		const { hash: expected, ...row } = JSON.parse(line);
		check(
			row.index === index++ && row.previous === previous && hash(row) === expected,
			"campaign journal drift",
		);
		previous = expected;
		if (row.event.type === "campaign-claimed")
			check(
				row.event.data.manifestSHA === hash(manifest) &&
					row.event.data.approvalSHA256 ===
						hash(JSON.parse(readFileSync(join(directory, "approval.json")))),
				"campaign claim drift",
			);
		const target = rows.find((r) => r.sampleId === row.event.data?.sampleId);
		if (row.event.type === "sample-started" && target)
			Object.assign(target, {
				status: "interrupted-or-running",
				reason: "no-finish-record",
			});
		if (row.event.type === "sample-finished" && target) Object.assign(target, row.event.data);
		if (row.event.type === "campaign-finished") finished = row.event.data;
	}
	if (finished) {
		check(finished.manifestSHA === hash(manifest), "completed manifest drift");
		if (!existsSync(join(directory, "summary.json")))
			return {
				...finished,
				completedCollection: false,
				persistenceFailure: true,
				failure: "final-summary-not-persisted",
				journalTailIncomplete,
				retryAllowed: false,
			};
		check(
			hash(finished) === hash(JSON.parse(readFileSync(join(directory, "summary.json")))),
			"summary drift",
		);
		return finished;
	}
	return {
		manifestSHA: hash(manifest),
		denominator: rows.length,
		rows,
		journalTailIncomplete,
		retryAllowed: false,
	};
}
