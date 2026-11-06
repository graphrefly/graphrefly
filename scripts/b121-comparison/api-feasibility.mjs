import { LIMITS } from "./api-limits.mjs";
/** Offline synthetic control-flow audit. Never contacts a provider or discovers a key. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareBundle } from "./api-prepare.mjs";
import { estimateInput, maximumCost, ROUTE } from "./api-provider.mjs";
import { runSession, TOOL } from "./api-runner.mjs";
import { ENTRY_TOOL } from "./api-tool.mjs";
import { hash, verifyAudit } from "./session.mjs";
import { createSourceAccess } from "./source-access.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const chunk = (items, size) =>
	Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
		items.slice(i * size, (i + 1) * size),
	);
/** Offline author-selected navigation probe, not instructions supplied to the model. */
export function targetedGraphChunks(subject) {
	const task = JSON.parse(subject.entryFiles["entry/task.json"]);
	const index = task.sourceIndex.findIndex(
		(s) => s.path === "packages/ts/src/graph/graph.ts",
	);
	if (index < 0) throw new Error("Graph source missing from frozen task");
	const prefix = `entry/source${index}/`;
	const paths = Object.keys(subject.entryFiles)
		.filter((p) => p.startsWith(prefix))
		.sort(
			(a, b) =>
				Number(a.match(/chunk(\d+)/)[1]) - Number(b.match(/chunk(\d+)/)[1]),
		);
	const lines = paths.flatMap((p) =>
		subject.entryFiles[p]
			.split("\n")
			.slice(1)
			.map((l) => l.replace(/^\d+: /, "")),
	);
	const text = lines.join("\n");
	if (
		createHash("sha256").update(text).digest("hex") !==
		task.sourceIndex[index].sha256
	)
		throw new Error("Frozen Graph source hash mismatch");
	const ts = createRequire(resolve(root, "../graphrefly-ts/package.json"))(
		"typescript",
	);
	const source = ts.createSourceFile(
		"graph.ts",
		text,
		ts.ScriptTarget.Latest,
		true,
	);
	if (source.parseDiagnostics.length)
		throw new Error("Frozen Graph source parse failed");
	const graph = source.statements.find(
		(n) => ts.isClassDeclaration(n) && n.name?.text === "Graph",
	);
	if (!graph) throw new Error("Graph class missing");
	const ranges = [
		{
			symbol: "Graph declaration",
			start:
				source.getLineAndCharacterOfPosition(graph.getStart(source)).line + 1,
			end:
				source.getLineAndCharacterOfPosition(graph.getStart(source)).line + 1,
		},
	];
	if (subject.slot.role === "maintainer")
		for (const name of ["describe", "_describe"]) {
			const member = graph.members.find(
				(n) => ts.isMethodDeclaration(n) && n.name.getText(source) === name,
			);
			if (!member) throw new Error(`Graph method missing: ${name}`);
			ranges.push({
				symbol: name,
				start:
					source.getLineAndCharacterOfPosition(member.getStart(source)).line +
					1,
				end: source.getLineAndCharacterOfPosition(member.end).line + 1,
			});
		}
	const selected = paths.filter((p) => {
		const c = Number(p.match(/chunk(\d+)/)[1]);
		return ranges.some((r) => r.start <= c * 80 + 80 && r.end >= c * 80 + 1);
	});
	return {
		source: task.sourceIndex[index].path,
		sourceSHA: task.sourceIndex[index].sha256,
		ranges,
		paths: selected,
		assumption:
			"Author-selected Graph header and complete describe implementations; not proof a model can discover these or that the task is semantically solved.",
	};
}
const read = (path) => ({ op: "read", path });
export function syntheticPlan(
	subject,
	expansion = "task-focused",
	materialMode = "required-packet",
) {
	if (
		![
			"task-focused",
			"all-source",
			"targeted-graph",
			"indexed-targeted",
			"search-guided",
		].includes(expansion)
	)
		throw new Error("Unknown expansion");
	if (!["required-packet", "expanded-relations"].includes(materialMode))
		throw new Error("Unknown material mode");
	const entry = subject.slot.experiment === "entry";
	const batches = entry ? [] : [[read("orientation.json")]];
	for (const phase of entry ? [] : ["A", "B"]) {
		batches.push([
			read(`${phase}/common.json`),
			...(materialMode === "expanded-relations"
				? [read(`${phase}/relations.json`)]
				: []),
			...subject.slot.cases.map((id) => read(`${phase}/${id}.json`)),
		]);
		batches.push(
			subject.slot.cases.map((scenario) => {
				const packet = JSON.parse(
					subject.files[`${phase}/common.json`].content,
				);
				const scenarioPacket = JSON.parse(
					subject.files[`${phase}/${scenario}.json`].content,
				);
				return {
					op: "submit",
					phase,
					scenario,
					fields: Object.fromEntries(
						Object.entries(packet.answerVocabulary).map(([name, values]) => [
							name,
							{ value: values[0], citations: [scenarioPacket.facts[0].id] },
						]),
					),
					explanation: "Synthetic layout probe; correctness is not evaluated.",
				};
			}),
		);
	}
	if (entry && expansion === "search-guided") {
		const queries = {
			user: [
				["spendingAlertsFor", "examples/spending-alerts/causal-entry.ts"],
				[
					"mountSpendingView",
					"examples/spending-alerts/causal-view-binding.ts",
				],
			],
			framework: [
				[
					"assertCausalCapabilities",
					"packages/ts/src/solutions/causal-occurrence/capabilities.ts",
				],
			],
			maintainer: [
				[
					"composeSpendingHost",
					"examples/spending-alerts/causal-focused-host.ts",
				],
				["hostGuard", "examples/spending-alerts/causal-focused-host.ts"],
				["runEndReady", "examples/spending-alerts/causal-focused-host.ts"],
				["describe(", "packages/ts/src/graph/graph.ts"],
			],
		}[subject.slot.role];
		const access = createSourceAccess(subject.entryFiles);
		const searches = queries.map(([query, pathPrefix]) => ({
			op: "search",
			query,
			pathPrefix,
			caseSensitive: true,
			offset: 0,
			limit: 3,
		}));
		const ranges = new Map();
		for (const search of searches) {
			const found = access.request(search);
			if (!found.matches.length)
				throw Error("Offline search probe found no matching symbol");
			for (const hit of found.matches) {
				const request = {
					op: "read",
					path: hit.path,
					startLine: Math.max(1, hit.line - 5),
					endLine: hit.line + 24,
				};
				ranges.set(JSON.stringify(request), request);
			}
		}
		return [
			[read("entry/task.json")],
			searches,
			[...ranges.values()],
			[
				{
					op: "submit",
					snippet: "export {};",
					explanation:
						"Synthetic search/range serialization only; no code correctness claim.",
					concepts: { read: [], required: [], firstExpansion: null },
				},
			],
		];
	}
	if (entry) {
		batches.push([read("entry/task.json")]);
		const sources = Object.keys(subject.entryFiles).filter((p) =>
			p.startsWith("entry/source"),
		);
		const focus = {
			user: [0, 1, 2, 3, 4],
			framework: [7, 8],
			maintainer: [0, 5, 8],
		}[subject.slot.role];
		const selected =
			expansion !== "all-source"
				? sources.filter((path) =>
						focus.includes(Number(path.match(/source(\d+)\//)[1])),
					)
				: sources;
		const targeted =
			["targeted-graph", "indexed-targeted"].includes(expansion) &&
			subject.slot.role !== "user"
				? targetedGraphChunks(subject)
				: null;
		const graphIndex = JSON.parse(
			subject.entryFiles["entry/task.json"],
		).sourceIndex.findIndex((s) => s.path === "packages/ts/src/graph/graph.ts");
		const boundedSelection = targeted
			? selected.filter(
					(p) =>
						!p.startsWith(`entry/source${graphIndex}/`) ||
						targeted.paths.includes(p),
				)
			: selected;
		if (expansion === "indexed-targeted") {
			const task = JSON.parse(subject.entryFiles["entry/task.json"]);
			const selectedSources = [
				...new Set(
					boundedSelection.map((p) => Number(p.match(/source(\d+)/)[1])),
				),
			];
			batches.push(
				selectedSources.map((n) => ({
					op: "search",
					query: "export",
					pathPrefix: task.sourceIndex[n].path,
					caseSensitive: true,
					offset: 0,
					limit: 5,
				})),
			);
		}
		batches.push(
			...chunk(boundedSelection, 16).map((paths) => paths.map(read)),
		);
		batches.push([
			{
				op: "submit",
				snippet:
					"// Synthetic serialization probe only; not an entry solution.\nexport {};",
				explanation:
					"Synthetic entry envelope; no compilation, correctness or usability claim.",
				concepts: { read: [], required: [], firstExpansion: null },
			},
		]);
	}
	return entry
		? batches.map((batch) =>
				batch.map((request) => {
					const match = request.path?.match(
						/^entry\/source(\d+)\/chunk(\d+)\.txt$/,
					);
					if (!match) return request;
					const task = JSON.parse(subject.entryFiles["entry/task.json"]);
					return {
						op: "read",
						path: task.sourceIndex[Number(match[1])].path,
						startLine: Number(match[2]) * 80 + 1,
						endLine: Number(match[2]) * 80 + 80,
					};
				}),
			)
		: batches;
}

export async function auditSlot(
	subject,
	expansion = "task-focused",
	materialMode = "required-packet",
) {
	const plan = syntheticPlan(subject, expansion, materialMode),
		requests = [],
		events = [];
	let next = 0;
	const result = await runSession({
		...subject,
		mode: subject.slot.experiment === "entry" ? "entry" : "comparison",
		files: subject.files ?? {},
		now: () => 0,
		journal: (event) => events.push(event),
		transport: {
			estimate: async (payload) => {
				const estimate = estimateInput(payload);
				requests.push({
					ordinal: requests.length + 1,
					requestHash: hash(payload),
					messageCount: payload.messages.length,
					serializedInputBytes: Buffer.byteLength(
						JSON.stringify({
							messages: payload.messages,
							tools: payload.tools,
						}),
					),
					estimatedInputTokens: estimate.inputTokens,
					maxOutputTokens: payload.max_tokens,
					dispatched: false,
				});
				return estimate;
			},
			create: async (payload) => {
				if (!plan[next])
					throw new Error("Synthetic plan exhausted unexpectedly");
				const ordinal = ++next;
				const message = {
					role: "assistant",
					content: null,
					tool_calls: [
						{
							type: "function",
							id: `synthetic-call-${ordinal}`,
							function: {
								name: "broker",
								arguments: JSON.stringify({ requests: plan[ordinal - 1] }),
							},
						},
					],
				};
				const input = estimateInput(payload).inputTokens;
				const output =
					Math.ceil(Buffer.byteLength(JSON.stringify(message), "utf8") / 3) +
					64;
				Object.assign(requests.at(-1), {
					dispatched: true,
					syntheticOutputEstimate: output,
				});
				return {
					body: {
						id: `synthetic-response-${ordinal}`,
						model: ROUTE.model,
						provider: ROUTE.provider,
						usage: {
							prompt_tokens: input,
							completion_tokens: output,
							total_tokens: input + output,
							cost: maximumCost(input, output),
							prompt_tokens_details: { cached_tokens: 0 },
							completion_tokens_details: { reasoning_tokens: 0 },
						},
						choices: [{ finish_reason: "tool_calls", message }],
					},
				};
			},
		},
	});
	const entry = subject.slot.experiment === "entry";
	const answers = entry
		? null
		: ["A", "B"].map(
				(phase) =>
					Object.values(result.controller.answers[phase]).filter(
						(answer) => answer.status === "submitted",
					).length,
			);
	return {
		slot: subject.slot,
		experiment: entry ? "entry" : "comparison",
		expansion: entry ? expansion : null,
		materialMode: entry ? null : materialMode,
		packetHash: hash(subject.files ?? {}),
		entryHash: hash(subject.entryFiles),
		targetedNavigation:
			entry &&
			["targeted-graph", "indexed-targeted"].includes(expansion) &&
			subject.slot.role !== "user"
				? targetedGraphChunks(subject)
				: null,
		plannedBatches: plan,
		plannedOperations: plan.flat().length,
		plannedCalls: plan.length,
		consumedBatches: next,
		requests,
		answers,
		entryStatus: result.entryStatus,
		complete: entry
			? result.entryStatus === "submitted"
			: answers.every((n) => n === 8),
		estimatedUsage: result.usage,
		actualProviderCostUSD: 0,
		syntheticPriceProjectionUSD: result.costUSD,
		fatal: result.fatal,
		budgetStops: events
			.filter((e) => e.type === "budget-stop")
			.map((e) => e.data),
		seals: events
			.filter((e) => ["seal-A", "seal-B"].includes(e.type))
			.map((e) => e.type),
		controllerAuditValid: result.controller
			? verifyAudit(result.controller.audit)
			: null,
		journalHash: hash(events),
	};
}
export async function auditFeasibility(bundle = prepareBundle()) {
	const runs = [];
	for (const materialMode of ["required-packet", "expanded-relations"])
		for (const subject of bundle.slots)
			runs.push(await auditSlot(subject, "task-focused", materialMode));
	for (const expansion of [
		"task-focused",
		"all-source",
		"targeted-graph",
		"indexed-targeted",
		"search-guided",
	])
		for (const subject of bundle.entrySlots)
			runs.push(await auditSlot(subject, expansion));
	return {
		kind: "B121-offline-budget-feasibility-v9",
		providerCalls: 0,
		actualCostUSD: 0,
		limits: LIMITS,
		bundleHash: hash(bundle),
		toolHash: hash(TOOL),
		entryToolHash: hash(ENTRY_TOOL),
		sourceHashes: Object.fromEntries(
			[
				"api-feasibility.mjs",
				"source-navigation.mjs",
				"source-access.mjs",
				"api-runner.mjs",
				"api-tool.mjs",
				"api-provider.mjs",
				"api-limits.mjs",
				"api-prepare.mjs",
				"session.mjs",
			].map((p) => [
				p,
				hash(readFileSync(resolve(root, "scripts/b121-comparison", p), "utf8")),
			]),
		),
		inputEstimateMethod: estimateInput({ messages: [], tools: [] }).method,
		outputEstimateMethod:
			"UTF-8 serialized synthetic assistant message bytes / 3 + 64; not model tokenization",
		completedRuns: runs.filter((r) => r.complete).length,
		summary: [
			...["required-packet", "expanded-relations"].map((materialMode) => ({
				experiment: "comparison",
				materialMode,
			})),
			...[
				"task-focused",
				"all-source",
				"targeted-graph",
				"indexed-targeted",
				"search-guided",
			].map((expansion) => ({
				experiment: "entry",
				expansion,
			})),
		].map((variant) => {
			const group = runs.filter((run) =>
				Object.entries(variant).every(([key, value]) => run[key] === value),
			);
			return {
				...variant,
				sessions: group.length,
				completed: group.filter((run) => run.complete).length,
			};
		}),
		totalRuns: runs.length,
		limitations: [
			"Search-guided is an author-selected symbol-query probe. The real broker finds match lines and the plan reads bounded neighborhoods before a placeholder submission. It proves retrieval and serialization only, not model discovery, complete method coverage, a sufficient solution, or code correctness.",
			"Indexed-targeted now searches exported declarations (first 5 matching lines per selected file) before the same source ranges; this is a bounded search probe, not the old whole-index read. Selections remain author-planned: this measures navigation overhead, not independent model discovery. All navigational content is source-derived, without role-specific recommendations.",
			"Targeted-graph is an author-selected offline navigation probe. All role-relevant non-Graph source remains; only Graph reads narrow to its declaration and (for maintainers) complete describe/_describe methods using the frozen source AST. This proves a possible serialization path only, not independent model discovery, code correctness, sufficient evidence or usability. Literal search and line-range reads are available to participants; role-specific targeted source selections remain outside participant materials.",
			"Required-packet mode reads mandatory common and eight case files only. Expanded-relations also reads the optional relation file per phase; its cost must not be treated as mandatory.",
			"Synthetic transport feeds size-based estimates to the real runner as simulated usage; no real tokenizer or provider usage is asserted.",
			"Each comparison and independent entry session has fresh messages and its own configured limits. Comparison preserves A/B cumulative history and phase seals; entry has no comparison controller, prerequisite answers or inherited messages. Unconsumed planned batches are retained after a stop, not forced through larger caps.",
			"Task-focused entry reads role-relevant complete source files (user: compose/input/resource/preset/view; framework: capabilities/graph; maintainer: compose/host/graph) and submits a placeholder. This source selection is an audit assumption, not a proven necessary or sufficient minimum. All-source variant reads all allowed source chunks.",
			"Chosen answer values and citations are syntactically valid placeholders, not graded participant evidence. No comprehension, answer correctness, provider adherence or usability result follows.",
			"A failed heuristic forecast is evidence about this harness admission policy, not proof that actual model tokenization cannot fit. A successful forecast would not guarantee live completion.",
		],
		runs,
	};
}
if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const report = await auditFeasibility();
	writeFileSync(
		resolve(
			root,
			"sessions/active/b121-comparison-design-v1/agent-api/feasibility.json",
		),
		`${JSON.stringify(report, null, 2)}\n`,
	);
	console.log(
		JSON.stringify({
			completedRuns: report.completedRuns,
			totalRuns: report.totalRuns,
			providerCalls: 0,
		}),
	);
}
