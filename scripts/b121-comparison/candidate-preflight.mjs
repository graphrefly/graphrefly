/** Offline qualification of candidate artifacts. No API calls or participant solutions. */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { digest } from "./frozen-compiler.mjs";
import { openCandidateRound } from "./candidate-entry.mjs";

export async function candidatePreflight(directory, { receiptRoot } = {}) {
	const read = (file) => readFileSync(resolve(directory, file), "utf8");
	const environmentJSON = gunzipSync(
		readFileSync(resolve(directory, "compiler-environment.json.gz")),
	).toString();
	const pins = JSON.parse(read("integration-pins.json"));
	const round = openCandidateRound({
		materialsJSON: read("materials.json"),
		tasksJSON: read("tasks.json"),
		rubricJSON: read("reviewer-rubric.json"),
		environmentJSON,
		pins,
		receiptRoot,
	});
	const probes = {
		"export-structure-only": ["@graphrefly/ts/graph"],
		"report-node-version-metadata": ["@graphrefly/ts/core"],
		"consume-business-results": ["../../packages/ts/src/data/index.js"],
		"display-current-values": [
			"./causal-preset.js",
			"./causal-view-binding.js",
		],
		"compose-two-instances": ["./causal-entry.js", "./causal-view-binding.js"],
		"validate-before-handoff": [
			"../../packages/ts/src/solutions/causal-occurrence/capabilities.js",
		],
		"inspect-with-detached-display": [
			"./causal-entry.js",
			"../../packages/ts/src/graph/graph.js",
		],
	};
	const rows = [];
	for (const taskId of round.taskIds) {
		if (!probes[taskId])
			throw Error("No predeclared module smoke probe for candidate task");
		const snippet = probes[taskId]
			.map(
				(p, i) =>
					`import * as p${i} from ${JSON.stringify(p)}; export type Probe${i} = typeof p${i};`,
			)
			.join("\n");
		const outcome = await round.typecheck(snippet, {
			context: { taskId, stage: "module-probe", binding: round.binding },
		});
		rows.push({
			taskId,
			snippet,
			...outcome.compilation,
			ok: outcome.compilation?.ok ?? false,
			compilerFailure: outcome.compilerFailure,
			compilerReceipt: outcome.receiptDirectory,
			process: outcome.process,
		});
	}
	return {
		kind: "offline-module-smoke-check",
		formalReady: false,
		providerCalls: 0,
		participantSolutions: 0,
		binding: round.binding,
		nodeVersion: process.version,
		compilerVersion: round.compilerVersion,
		environmentBytes: Buffer.byteLength(environmentJSON),
		sourceSHA256: digest(readFileSync(fileURLToPath(import.meta.url))),
		readyForCandidateTypechecking: rows.every((r) => r.ok),
		interpretation:
			"Module import probes only; not participant answers, semantic scoring or runtime behavior verification. All planned tasks retained.",
		rows,
	};
}
if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const directory = process.argv[2];
	if (!directory)
		throw Error("Usage: node candidate-preflight.mjs <candidate-directory>");
	const report = await candidatePreflight(directory);
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	if (!report.readyForCandidateTypechecking) process.exitCode = 1;
}
