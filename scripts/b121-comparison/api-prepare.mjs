import { runtimeBindings, orchestratorEnvironment } from "./runtime-bindings.mjs";
import { LIMITS } from "./api-limits.mjs";
import { ENTRY_TOOL } from "./api-tool.mjs";
/** Offline only. Freeze bounded participant maps, prompts and execution proposal. */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CEILING_USD, MAX_GENERATION_CALLS, maximumCost, ROUTE } from "./api-provider.mjs";
import {
	CONFIG,
	ENTRY_INSTRUCTIONS,
	INSTRUCTIONS,
	MAX_OUTPUT_PER_REQUEST,
	TOOL,
} from "./api-runner.mjs";
import {
	MAX_CREATE_MS,
	QUALIFICATION_PROMPTS,
	QUALIFICATION_READS,
	RETRY_POLICY,
} from "./api-transport.mjs";
import { createEntryAcceptance } from "./entry-tasks.mjs";
import { CONCEPTS, HUMAN_RUBRIC } from "./materials.mjs";
import { createSession, hash } from "./session.mjs";
import { buildSourceNavigation } from "./source-navigation.mjs";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const base = "sessions/active/b121-comparison-design-v1";
export const sha = (x) => createHash("sha256").update(x).digest("hex");
const read = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
export function prepareBundle() {
	const material = read(`${base}/revision-2/material.json`),
		allocation = read(`${base}/revision-2/allocation.json`).agent;
	const proof = createSession({
		sessionId: "offline-entry-source-freeze",
		files: {},
	});
	proof.sealA();
	proof.finish();
	const entry = createEntryAcceptance({
		controller: proof,
		tsRoot: resolve(root, "../graphrefly-ts"),
	}).releaseTasks();
	const slots = allocation.map((slot) => {
		const files = {};
		for (const phase of ["A", "B"]) {
			const p = material.packets[slot.arm][slot.role][phase];
			const { cases, relations, evidence, ...common } = p;
			const forFacts = (facts) =>
				Object.fromEntries(facts.flatMap((f) => f.refs).map((id) => [id, evidence[id]]));
			files[`${phase}/common.json`] = {
				phase,
				content: JSON.stringify({
					...common,
					evidence: forFacts(common.commonFacts),
				}),
			};
			files[`${phase}/relations.json`] = {
				phase,
				content: JSON.stringify(relations),
			};
			for (const c of cases)
				files[`${phase}/${c.id}.json`] = {
					phase,
					content: JSON.stringify({ ...c, evidence: forFacts(c.facts) }),
				};
		}
		files["orientation.json"] = {
			phase: "A",
			content: JSON.stringify({
				role: slot.role,
				arm: slot.arm,
				order: slot.cases,
				instructions: INSTRUCTIONS,
				limits: LIMITS,
				read: "Read A/common.json, all eight A/Cn.json files; relations are available separately. After controller seal, read B/common.json and all eight B/Cn.json files. You may batch up to 16 operations in one broker call. Every operation counts.",
				submit: {
					op: "submit",
					phase: "A or B",
					scenario: "assigned next Cn",
					fields: "exactly the seven names in answerVocabulary, each {value,citations:[fact IDs]}",
					explanation:
						"Explain consequences, supported invariants, unknowns and missing execution evidence; B also scope and remaining obligations. Max 6000 characters.",
				},
			}),
		};
		const entryFiles = {};
		if (slot.arm === "G") {
			const task = entry.tasks.find(
				(x) =>
					x.id ===
					{
						user: "ordinary",
						framework: "framework",
						maintainer: "maintainer",
					}[slot.role],
			);
			entryFiles["entry/task.json"] = JSON.stringify({
				id: task.id,
				prompt: task.prompt,
				limits: LIMITS,
				sourceIndex: entry.sources.map((s) => ({
					path: s.path,
					sha256: s.sha256,
					chunks: Math.ceil(s.content.split("\n").length / 80),
				})),
				submission: {
					op: "submit",
					snippet: "TypeScript, max 32000 characters",
					explanation: "Source lines and reasoning, max 6000 characters",
					concepts: { read: CONCEPTS, required: [], firstExpansion: null },
				},
				conceptInstructions:
					"Select dictionary concepts you read and those you had to manipulate correctly. Record first needed source expansion path/line or null; self-report, subject to unperformed human review. Search literal text, then read original source paths with optional startLine/endLine (1-based inclusive, null defaults). Path alone reads the first page. Results cap at 80 lines/12000 bytes; continue using nextLine. Recoverable argument errors consume the unchanged session budgets.",
			});
			entry.sources.forEach((s, n) => {
				entryFiles[`entry/navigation/source${n}.json`] = JSON.stringify(
					buildSourceNavigation({ ...s, prefix: `entry/source${n}` }),
				);
				const lines = s.content.split("\n");
				for (let i = 0; i < lines.length; i += 80)
					entryFiles[`entry/source${n}/chunk${i / 80}.txt`] =
						`${s.path}\n` +
						lines
							.slice(i, i + 80)
							.map((l, k) => `${i + k + 1}: ${l}`)
							.join("\n");
			});
		}
		return {
			slot,
			files,
			entryFiles,
			packetHash: hash(files),
			entryHash: hash(entryFiles),
		};
	});
	const entrySlots = slots
		.filter(({ slot }) => slot.arm === "G")
		.map(({ slot, entryFiles, entryHash }) => ({
			slot: { ...slot, id: `${slot.id}-entry`, experiment: "entry" },
			entryFiles,
			entryHash,
		}));
	return {
		kind: "B121-agent-api-frozen-bundle-v4",
		slots,
		entrySlots,
		config: CONFIG,
		tool: TOOL,
		entryTool: ENTRY_TOOL,
		qualificationInitialRequests: QUALIFICATION_READS,
		instructions: INSTRUCTIONS,
		entryInstructions: ENTRY_INSTRUCTIONS,
		qualificationPrompts: QUALIFICATION_PROMPTS,
		rubric: HUMAN_RUBRIC,
		concepts: CONCEPTS,
	};
}
export function prepareManifest(bundle) {
	const paths = [
		"scripts/b121-comparison/runtime-bindings.mjs",
		...runtimeBindings().map((binding) => binding.path),
		`${base}/agent-api/provider-review.json`,
		`${base}/revision-2/material.json`,
		`${base}/revision-2/allocation.json`,
		`${base}/revision-2/goldens.json`,
		`${base}/revision-2/readiness.json`,
		`${base}/isolation/qualification.json`,
		`${base}/isolation/probe-receipt.json`,
		"scripts/b121-comparison/session.mjs",
		"scripts/b121-comparison/entry-tasks.mjs",
		"scripts/b121-comparison/api-runner.mjs",
		"scripts/b121-comparison/api-tool.mjs",
		"scripts/b121-comparison/api-provider.mjs",
		"scripts/b121-comparison/api-limits.mjs",
		"scripts/b121-comparison/api-entry-review.mjs",
		"scripts/b121-comparison/materials.mjs",
		"../graphrefly-ts/packages/ts/evals/graph-native-rerun-avoidance/openrouter-transport.mjs",
		"scripts/b121-comparison/api-transport.mjs",
		"../graphrefly-ts/packages/ts/evals/graph-native-rerun-avoidance/openrouter-recovery.mjs",
		"scripts/b121-comparison/api-prepare.mjs",
		"scripts/b121-comparison/source-navigation.mjs",
		"scripts/b121-comparison/source-access.mjs",
		"scripts/b121-comparison/api-campaign.mjs",
	];
	return {
		kind: "B121-agent-api-execution-proposal-v11-graph",
		orchestratorEnvironment,
		owner: "graphrefly:B121",
		date: "2026-09-14",
		executionReady: false,
		authorization: {
			providerCalls: 0,
			participantSessions: 0,
			spendUSD: 0,
			retries: 0,
		},
		human: "deferred; no recruitment",
		provider: {
			name: "OpenRouter",
			...ROUTE,
			config: CONFIG,
			immutableRevision: null,
			accountAccess: "unverified; no inference calls made",
			versionLimit:
				"Route metadata names 20260910 weights, but request/returned alias cannot independently prove immutable hosting.",
		},
		bindings: [
			...new Set([
				...paths,
				...bundle.slots
					.filter((p) => p.slot.arm === "G")
					.flatMap((p) =>
						JSON.parse(p.entryFiles["entry/task.json"]).sourceIndex.map(
							(s) => "../graphrefly-ts/" + s.path,
						),
					),
			]),
		].map((path) => ({
			path,
			sha256: sha(readFileSync(join(root, path))),
		})),
		bundleSHA: sha(JSON.stringify(bundle, null, 2) + "\n"),
		sessions: bundle.slots.map(({ slot, packetHash, entryHash }) => ({
			...slot,
			packetHash,
			entryHash,
		})),
		entrySessions: bundle.entrySlots.map(({ slot, entryHash }) => ({
			...slot,
			entryHash,
		})),
		limits: {
			perSession: LIMITS,
			perEntrySession: LIMITS,
			comparisonSessions: 12,
			entrySessions: 6,
			comparisonInputTokens: 12 * LIMITS.inputTokens,
			comparisonOutputTokens: 12 * LIMITS.outputTokens,
			entryInputTokens: 6 * LIMITS.inputTokens,
			entryOutputTokens: 6 * LIMITS.outputTokens,
			totalStudyInputTokens: 18 * LIMITS.inputTokens,
			totalStudyOutputTokens: 18 * LIMITS.outputTokens,
			qualification: {
				freshConversations: 2,
				freshRequests: 4,
				inputTokens: 16384,
				outputTokens: 5120,
			},
			generationCalls: MAX_GENERATION_CALLS,
			countCalls: 0,
			retries: RETRY_POLICY,
			maxCreateMs: MAX_CREATE_MS,
			concurrency: 1,
			maxRequestMs: 60000,
			maxOutputPerRequest: MAX_OUTPUT_PER_REQUEST,
			noResume: true,
			participantFailureStopsCampaign: false,
			campaignFailureStopsCampaign: true,
			campaignFailureScopes: [
				"qualification",
				"transport",
				"route-identity",
				"accounting",
				"spend",
				"persistence",
				"token-overrun",
			],
		},
		price: {
			currency: "USD",
			standardInputPerMillion: ROUTE.inputPerMillion,
			cachedInputPerMillion: ROUTE.cacheReadPerMillion,
			outputPerMillion: ROUTE.outputPerMillion,
			comparisonMaximum: maximumCost(12 * LIMITS.inputTokens, 12 * LIMITS.outputTokens),
			entryMaximum: maximumCost(6 * LIMITS.inputTokens, 6 * LIMITS.outputTokens),
			studyMaximum: maximumCost(18 * LIMITS.inputTokens, 18 * LIMITS.outputTokens),
			qualificationMaximum: maximumCost(16384, 5120),
			proposedTotalCeiling: CEILING_USD,
			ceilingRelationship:
				"Session token maxima are theoretical and do not authorize their summed cost. The cumulative USD2 ceiling includes prior spending and retries and can stop before every session reaches its token limit.",
			singleRequestReservation:
				"Full published Together context (1048576 input tokens) plus requested output; no cache discount assumed",
			inputPreflight:
				"Local UTF-8 bytes / 3 + 256 formatting allowance is an unqualified heuristic transferred from another model, not exact tokenization or an upper bound. Actual reported input must fit the remaining configured cumulative input-token allowance before answers are accepted. Overrun stops campaign; charged overrun remains visible.",
			basis:
				"Service-only USD; taxes/top-up fees excluded. Hard local dispatch reservation depends on published route context/rates and honest complete provider billing; provider internals cannot be enforced locally.",
			source: ROUTE.source,
		},
		conditionsBeforeAnyCall: [
			"Explicit one-shot grant bound to manifest SHA, DeepSeek V4.1 Flash/Together route, proposed USD 2.00 (requires separate spend approval), 1444 maximum generation calls, expiry, explicit CSP11 retry policy (capacity 3; availability 1); retries consume the same call/money ceilings",
			"Accept model alias and local input estimate limitations; no automatic provider/model replacement",
			"Confirm route metadata/price evidence remains current before approval; if changed, regenerate manifest",
			"Explicit private credential injection; preparation never discovers keys",
		],
		qualificationBeforeParticipants: [
			"Two fresh two-turn synthetic conversations; comparison read then seven-field submission; entry task/search/range then entry submission; <=4096 input per call, 512 read or2048 submit output; reasoning disabled; exact broker operation, route, usage and pricing audit",
			"Entry retrieval parameter errors return recoverable tool feedback within unchanged budgets; denied paths, malformed envelopes/submissions and other invalid broker operations stop only that participant, with missing answers retained and no correction/retry. Qualification, transport, route/identity, accounting, persistence failures and overruns stop the campaign. CSP11 infrastructure recovery is bounded; unknown failed billing retains the full reservation. No substitutions or session resume.",
			"HTTP200 error-finish responses remain terminal with unknown retryability. Their valid reported charge is retained separately from upstream compute cost; absent/invalid usage retains the conservative reservation. Successful response pricing validation remains unchanged. Only one custom broker; all history is explicit messages; no server-side conversation, repository tool or hidden grading data",
		],
		privacy: {
			transmitted:
				"Assigned role/arm comparison materials and own comparison messages go to OpenRouter and Together; separate fresh entry conversations transmit only assigned Graph entry tasks/search excerpts/source ranges and their own messages, never A/B materials or history. Credential remains in HTTP header",
			retention:
				"No ZDR entitlement or no-retention guarantee asserted. OpenRouter and selected provider policies apply; no fabricated store=false promise.",
			isolation:
				"Controller-owned file allowlist and fresh message arrays; not provider-internal memory isolation or immutable weights proof",
			source: "https://openrouter.ai/docs/guides/privacy/provider-logging",
		},
		analysis: {
			method: "judgment-only-v2",
			denominator:
				"12 assigned slots x 8 cases x 7 fields x 2 phases, including failed/unrun slots",
			entry:
				"6 independent G entry sessions run after the 12 comparison slots, with fresh context and their own 1000000 input / 8000 output token, 80 operation, 75 minute limits. Entry slots receive only assigned task and bounded search/source-range results, regardless of comparison completion. Entry results are reported separately and never enter the 1344 comparison denominator. Static compilation then bound trusted criterion review; pending review never accepted. No P entry score.",
			structured:
				"Existing frozen gradeSealed; value and required fact citations both required. Separate safety counts and role/arm rows.",
			freeText:
				"Frozen HUMAN_RUBRIC; two blinded human reviewers unavailable. Preserve explanations and concepts unscored. No agent self-score replaces them.",
			limitations: [
				"agent-only single-model small sample; not human evidence",
				"fixed caps may prevent full completion; never increase limits after exposure",
				"no immutable model version proof or provider-internal isolation proof",
				"no B121 completion or formal performance claim",
			],
		},
	};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const out = join(root, base, "agent-api");
	mkdirSync(out, { recursive: true });
	const bundle = prepareBundle();
	writeFileSync(join(out, "bundle.json"), JSON.stringify(bundle, null, 2) + "\n");
	writeFileSync(
		join(out, "manifest.json"),
		JSON.stringify(prepareManifest(bundle), null, 2) + "\n",
	);
	console.log("Offline bundle and disabled manifest prepared; zero provider calls.");
}
