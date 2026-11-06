import assert from "node:assert/strict";
import test from "node:test";
import { diagnoseAttempt } from "./api-diagnostics.mjs";

const row = (type, data) => ({ event: { type, data } });
test("offline diagnosis distinguishes forecast stop from actual exhaustion and ignores qualification", () => {
	const result = diagnoseAttempt([
		row("qualification-generation-response", {
			body: { usage: { prompt_tokens: 500 } },
		}),
		row("started", { slot: { id: "a", arm: "G" } }),
		row("estimate-response", { inputTokens: 2000 }),
		row("generation-dispatch", {
			payload: { messages: [{}, {}, { content: "history" }] },
		}),
		row("generation-response", { body: { usage: { prompt_tokens: 1000 } } }),
		row("budget-stop", { count: 48000, usage: { inputTokens: 1000 } }),
		row("finished", {
			fatal: null,
			entryStatus: "missing",
			controller: {
				answers: {
					A: { C1: { status: "submitted" } },
					B: { C1: { status: "budget-exhausted" } },
				},
			},
		}),
		row("started", { slot: { id: "b", arm: "P" } }),
		row("finished", {
			fatal: "invalid broker operation schema",
			entryStatus: "not-applicable",
			controller: { answers: { A: {}, B: {} } },
		}),
	]);
	assert.equal(result.sessions[0].actualInputTokens, 1000);
	assert.equal(result.sessions[0].estimateToActualRatio, 2);
	assert.equal(result.sessions[0].stops[0].remainingInputTokens, 47000);
	assert.equal(
		result.sessions[0].stops[0].hypotheticalNextActualInputTokens,
		null,
	);
	assert.equal(result.sessions[0].submittedAnswers, 1);
	assert.equal(result.sessions[1].failure, "invalid broker operation schema");
	assert.equal(result.sessions[1].actualInputTokens, 0);
	assert.equal(result.sessions[1].estimateToActualRatio, null);
});

test("entry context stop remains distinct from cumulative input exhaustion", () => {
	const result = diagnoseAttempt([
		row("started", { slot: { id: "entry", arm: "G" } }),
		row("budget-stop", {
			reason: "request-context-estimate-exceeds-provider-window",
			contextTokens: 1048576,
			maxOutputTokens: 4096,
			estimatedNextInputTokens: 1048576,
			usage: { inputTokens: 0 },
		}),
		row("finished", { controller: null, entryStatus: "missing", fatal: null }),
	]);
	assert.equal(
		result.sessions[0].stops[0].reason,
		"request-context-estimate-exceeds-provider-window",
	);
	assert.equal(result.sessions[0].stops[0].remainingInputTokens, null);
	assert.equal(result.sessions[0].stops[0].contextTokens, 1048576);
	assert.equal(result.sessions[0].submittedAnswers, 0);
});
