/** Offline only. Freeze bounded participant maps, prompts and execution proposal. */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CEILING_USD, maximumCost, ROUTE } from "./api-provider.mjs";
import { CONFIG, INSTRUCTIONS, TOOL } from "./api-runner.mjs";
import { QUALIFICATION_PROMPTS } from "./api-transport.mjs";
import { createEntryAcceptance } from "./entry-tasks.mjs";
import { CONCEPTS, HUMAN_RUBRIC } from "./materials.mjs";
import { createSession, hash, LIMITS } from "./session.mjs";

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
				Object.fromEntries(
					facts.flatMap((f) => f.refs).map((id) => [id, evidence[id]]),
				);
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
					fields:
						"exactly the seven names in answerVocabulary, each {value,citations:[fact IDs]}",
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
					"Select dictionary concepts you read and those you had to manipulate correctly. Record first needed source expansion path/line or null; self-report, subject to unperformed human review. Read source chunks using entry/sourceN/chunkM.txt; N and M are zero-based.",
			});
			entry.sources.forEach((s, n) => {
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
	return {
		kind: "B121-agent-api-frozen-bundle-v1",
		slots,
		config: CONFIG,
		tool: TOOL,
		instructions: INSTRUCTIONS,
		qualificationPrompts: QUALIFICATION_PROMPTS,
		rubric: HUMAN_RUBRIC,
		concepts: CONCEPTS,
	};
}
export function prepareManifest(bundle) {
	const paths = [
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
		"scripts/b121-comparison/api-provider.mjs",
		"scripts/b121-comparison/api-entry-review.mjs",
		"scripts/b121-comparison/materials.mjs",
		"../graphrefly-ts/packages/ts/evals/graph-native-rerun-avoidance/openrouter-transport.mjs",
		"scripts/b121-comparison/api-transport.mjs",
		"scripts/b121-comparison/api-prepare.mjs",
		"scripts/b121-comparison/api-campaign.mjs",
	];
	return {
		kind: "B121-agent-api-execution-proposal-v1",
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
				"Route metadata names 20260826 weights, but request/returned alias cannot independently prove immutable hosting.",
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
		limits: {
			perSession: LIMITS,
			totalStudyInputTokens: 576000,
			totalStudyOutputTokens: 96000,
			qualification: {
				freshRequests: 2,
				inputTokens: 8192,
				outputTokens: 1024,
			},
			generationCalls: 962,
			countCalls: 0,
			retries: 0,
			concurrency: 1,
			maxRequestMs: 60000,
			maxOutputPerRequest: 2048,
			noResume: true,
			anyFatalStopsCampaign: true,
		},
		price: {
			currency: "USD",
			standardInputPerMillion: ROUTE.inputPerMillion,
			cachedInputPerMillion: ROUTE.cacheReadPerMillion,
			outputPerMillion: ROUTE.outputPerMillion,
			studyMaximum: maximumCost(576000, 96000),
			qualificationMaximum: maximumCost(8192, 1024),
			proposedTotalCeiling: CEILING_USD,
			singleRequestReservation:
				"Full published Makora context (262144 input tokens) plus requested output; no cache discount assumed",
			inputPreflight:
				"Local UTF-8 bytes + 2048 formatting allowance is a forecast, not exact tokenization. Actual reported input must fit the remaining 48000-token session allowance before answers are accepted. Overrun stops campaign; charged overrun remains visible.",
			basis:
				"Service-only USD; taxes/top-up fees excluded. Hard local dispatch reservation depends on published route context/rates and honest complete provider billing; provider internals cannot be enforced locally.",
			source: ROUTE.source,
		},
		conditionsBeforeAnyCall: [
			"Explicit one-shot grant bound to manifest SHA, Qwen/Makora route, USD 0.20, 962 maximum generation calls, expiry, zero retries",
			"Accept model alias and local input estimate limitations; no automatic provider/model replacement",
			"Confirm route metadata/price evidence remains current before approval; if changed, regenerate manifest",
			"Explicit private credential injection; preparation never discovers keys",
		],
		qualificationBeforeParticipants: [
			"Two fresh synthetic requests; <=4096 reported input and 512 output each; exact requested broker operation; returned model/provider, complete usage and pricing audit",
			"Any mismatch, malformed response, overrun, timeout or billing uncertainty stops entire campaign; no substitutions or retries",
			"Only one custom broker; all history is explicit messages; no server-side conversation, repository tool or hidden grading data",
		],
		privacy: {
			transmitted:
				"Assigned role/arm materials, own session messages, and assigned Graph entry chunks after A/B closure go to OpenRouter and Makora; credential remains in HTTP header",
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
				"6 G sessions receive assigned role task after their A/B seals; same cumulative budget. Static compilation then bound trusted criterion review; pending review never accepted. No P entry score.",
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
if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const out = join(root, base, "agent-api");
	mkdirSync(out, { recursive: true });
	const bundle = prepareBundle();
	writeFileSync(
		join(out, "bundle.json"),
		JSON.stringify(bundle, null, 2) + "\n",
	);
	writeFileSync(
		join(out, "manifest.json"),
		JSON.stringify(prepareManifest(bundle), null, 2) + "\n",
	);
	console.log(
		"Offline bundle and disabled manifest prepared; zero provider calls.",
	);
}
