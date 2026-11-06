import { copyGraphRuntime, orchestratorEnvironment } from "./test-fixtures/graph-runtime.mjs";
/** Exercise durable campaign output independently of provider transport internals. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const hash = (value) =>
	createHash("sha256")
		.update(typeof value === "string" ? value : JSON.stringify(value))
		.digest("hex");
for (const outcome of ["qualification-failed", "fatal", "incomplete", "completed"]) {
	test(`campaign durable summary: ${outcome}`, async () => {
		const workspace = mkdtempSync(join(tmpdir(), "b121-summary-"));
		const temp = join(workspace, "graphrefly");
		const scripts = join(temp, "scripts/b121-comparison");
		const base = join(temp, "sessions/active/b121-comparison-design-v1");
		mkdirSync(scripts, { recursive: true });
		mkdirSync(join(base, "agent-api"), { recursive: true });
		mkdirSync(join(base, "revision-2"));
		const put = (name, source) => writeFileSync(join(scripts, name), source);
		put(
			"api-limits.mjs",
			"export const LIMITS={calls:80,inputTokens:1000000,outputTokens:8000,elapsedMs:4500000};",
		);
		try {
			copyFileSync(
				new URL("./api-campaign.mjs", import.meta.url),
				join(scripts, "api-campaign.mjs"),
			);
			put(
				"session.mjs",
				`import {createHash} from 'node:crypto'; export const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'); export function createSession(){return {sealA(){},finish(){return {seal:{hash:'a'},sealB:{hash:'b'}}}}} export const gradeSealed=()=>({totals:{denominator:56}});`,
			);
			put(
				"api-entry-review.mjs",
				`export const reviewEntry=()=>({accepted:false,status:'pending'});`,
			);
			put(
				"api-runner.mjs",
				`export async function runSession({slot}) { const answers=Object.fromEntries(Array.from({length:8},(_,i)=>['C'+i,{status:${JSON.stringify(outcome === "completed" ? "submitted" : "budget-exhausted")}}])); return {slot,controller:{answers:{A:answers,B:answers},seal:{hash:'a'},sealB:{hash:'b'}},entryStatus:${JSON.stringify(outcome === "completed" ? "submitted" : "missing")},fatal:${JSON.stringify(outcome === "fatal" ? "output truncated" : null)}}; }`,
			);
			put(
				"api-transport.mjs",
				`import assert from 'node:assert/strict'; import {readFileSync} from 'node:fs'; import {join} from 'node:path';
    export function createOpenRouterTransport({manifestSHA,approval}) { return {snapshot:()=>({generationCalls:1,reportedCostUSD:0.001,reservedUSD:0.011,unknownReservedUSD:0.01}),manifestSHA,approval}; }
    export async function qualifyProvider({transport,journal}) {
     const dir=join(${JSON.stringify(base)},'agent-api/runs',transport.manifestSHA);
     assert.equal(JSON.parse(readFileSync(join(dir,'approval.json'))).manifestSHA,transport.manifestSHA);
     assert.ok(JSON.parse(readFileSync(join(dir,'manifest.json'))).sessions);
     assert.ok(JSON.parse(readFileSync(join(dir,'bundle.json'))).slots);
     journal({type:'provider-attempt-failed',data:{envelope:{status:200,body:{choices:[{finish_reason:'length',message:{reasoning:'DO-NOT-COPY'}}],usage:{completion_tokens:2048}}}}});
     ${outcome === "qualification-failed" ? "throw new Error('qualification truncated');" : "return {passed:true};"}
    }`,
			);
			const slots = Array.from({ length: 12 }, (_, i) => ({
				slot: { id: `agent-${i}`, arm: i % 2 ? "P" : "G" },
				files: {},
				entryFiles: {},
			}));
			const entrySlots = slots
				.filter((p) => p.slot.arm === "G")
				.map((p) => ({
					slot: { ...p.slot, id: p.slot.id + "-entry", experiment: "entry" },
					entryFiles: {},
					entryHash: hash({}),
				}));
			const bundle = JSON.stringify({ slots, entrySlots }, null, 2) + "\n";
			const manifest =
				JSON.stringify(
					{
						bindings: [],
						orchestratorEnvironment,
						entrySessions: entrySlots.map(({ slot, entryHash }) => ({
							...slot,
							entryHash,
						})),
						bundleSHA: hash(bundle),
						sessions: slots.map(({ slot, files, entryFiles }) => ({
							...slot,
							packetHash: hash(files),
							entryHash: hash(entryFiles),
						})),
					},
					null,
					2,
				) + "\n";
			writeFileSync(join(base, "agent-api/bundle.json"), bundle);
			writeFileSync(join(base, "agent-api/manifest.json"), manifest);
			writeFileSync(join(base, "revision-2/goldens.json"), JSON.stringify({ A: {}, B: {} }));
			const approval = { manifestSHA: hash(manifest) };
			copyGraphRuntime(temp);
			const { runCampaign } = await import(pathToFileURL(join(scripts, "api-campaign.mjs")));
			const result = await runCampaign({ approval, apiKey: "FAKE" });
			const raw = readFileSync(join(result.directory, "summary.json"), "utf8"),
				summary = JSON.parse(raw);
			const started = outcome === "qualification-failed" ? 0 : outcome === "fatal" ? 1 : 12;
			assert.equal(result.started, started);
			assert.equal(summary.participantSessionsStarted, started);
			assert.equal(result.completed, outcome === "completed" ? 12 : 0);
			assert.equal(summary.participantSessionsCompleted, result.completed);
			assert.equal(summary.submittedAnswers, outcome === "completed" ? 192 : 0);
			assert.equal(summary.entrySessionsStarted, started === 12 ? 6 : 0);
			assert.equal(summary.submittedEntries, outcome === "completed" ? 6 : 0);
			assert.equal(summary.providerReportedCostUSD, 0.001);
			assert.equal(summary.unknownReservedUSD, 0.01);
			assert.equal(summary.lastResponse.finishReason, "length");
			assert.equal(summary.lastResponse.usage.completion_tokens, 2048);
			assert.ok(!raw.includes("DO-NOT-COPY"));
			assert.ok(raw.length < 2500);
			const journal = readFileSync(join(result.directory, "journal.jsonl"), "utf8")
				.trim()
				.split("\n")
				.map(JSON.parse);
			const finished = journal.findLast((r) => r.event.type === "campaign-finished");
			assert.equal(summary.journalHead, finished.hash);
			assert.equal(finished.event.data.results.length, 12);
			assert.equal(readFileSync(join(result.directory, "manifest.json"), "utf8"), manifest);
			await assert.rejects(runCampaign({ approval, apiKey: "FAKE" }), /EEXIST/);
		} finally {
			rmSync(workspace, { recursive: true, force: true });
		}
	});
}
