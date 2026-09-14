import assert from "node:assert/strict";
import test from "node:test";
import { verifyFrozen } from "./api-campaign.mjs";
import { prepareBundle, prepareManifest } from "./api-prepare.mjs";
import {
	CONFIG,
	maximumCost,
	runSession,
	TOOL,
	validateUsage,
} from "./api-runner.mjs";
import { createOpenAITransport, qualifyProvider } from "./api-transport.mjs";
import { hash, verifyAudit } from "./session.mjs";

const bundle = prepareBundle();
const p = bundle.slots.find((x) => x.slot.arm === "P");
const g = bundle.slots.find((x) => x.slot.arm === "G");
const submits = (subject, phase) =>
	subject.slot.cases.map((scenario) => ({
		op: "submit",
		phase,
		scenario,
		fields: Object.fromEntries(
			Object.entries(
				JSON.parse(subject.files[`${phase}/common.json`].content)
					.answerVocabulary,
			).map(([k, v]) => [k, { value: v[0], citations: [] }]),
		),
		explanation: "Synthetic test answer, not participant evidence.",
	}));
function body(_payload, requests, i = 1, count = 100, output = 20) {
	return {
		...CONFIG,
		id: `resp_${i}`,
		status: "completed",
		tools: [TOOL],
		usage: {
			input_tokens: count,
			output_tokens: output,
			total_tokens: count + output,
			input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
			output_tokens_details: { reasoning_tokens: 1 },
		},
		output: [
			{
				type: "function_call",
				name: "broker",
				call_id: `call_${i}`,
				arguments: JSON.stringify({ requests: JSON.stringify(requests) }),
			},
		],
	};
}
function fake(batches, change = (x) => x, count = 100) {
	let i = 0;
	const sent = [];
	return {
		sent,
		count: async (payload) => {
			sent.push(payload);
			return { body: { object: "response.input_tokens", input_tokens: count } };
		},
		create: async (payload) => ({
			body: change(
				body(payload, batches[i] ?? [{ op: "list" }], ++i, count),
				i,
				payload,
			),
		}),
	};
}
async function run(transport, subject = p, extra = {}) {
	const journal = [];
	const result = await runSession({
		...subject,
		transport,
		journal: (x) => journal.push(x),
		...extra,
	});
	return { result, journal };
}

test("12 frozen allocations and one-arm maps bind without exposing rubric or other sessions", () => {
	const m = prepareManifest(bundle);
	assert.equal(m.sessions.length, 12);
	assert.equal(m.price.studyMaximum, 12);
	assert.equal(maximumCost(576000, 96000), 12);
	for (const s of bundle.slots) {
		assert.equal(Object.keys(s.files).length, 21);
		assert.equal(JSON.parse(s.files["A/common.json"].content).arm, s.slot.arm);
		assert.equal(
			JSON.parse(s.files["A/common.json"].content).role,
			s.slot.role,
		);
		assert.equal(hash(s.files), s.packetHash);
	}
	assert.equal(
		new Set(
			bundle.slots.map((s) => `${s.slot.role}/${s.slot.arm}/${s.slot.order}`),
		).size,
		12,
	);
	verifyFrozen(m, bundle);
	const bad = structuredClone(bundle);
	bad.slots[0].files["A/C1.json"].content += "x";
	assert.throws(() => verifyFrozen(m, bad), /bundle drift/);
});
test("controller seals all A before B; full repeated context metered and fixed denominators retained", async () => {
	const transport = fake([
		[{ op: "read", path: "A/common.json" }],
		submits(p, "A"),
		[{ op: "read", path: "B/C1.json" }],
		submits(p, "B"),
	]);
	const { result, journal } = await run(transport);
	assert.equal(result.fatal, null);
	assert.equal(result.controller.phase, "closed");
	assert.equal(result.usage.inputTokens, 400);
	assert.equal(result.operations, 18);
	assert.equal(result.controller.calls, 18);
	assert.ok(verifyAudit(result.controller.audit));
	assert.ok(transport.sent[1].input.length > transport.sent[0].input.length);
	assert.ok(JSON.stringify(transport.sent[3]).includes("A/common.json"));
	assert.ok(
		journal.findIndex((x) => x.type === "seal-A") <
			journal.findIndex(
				(x) =>
					x.type === "broker-batch" && x.data.requests[0].path === "B/C1.json",
			),
	);
});
test("fresh session context never inherits another session or hidden canary", async () => {
	const one = fake([submits(p, "A"), submits(p, "B")]);
	await run(one);
	const other = fake([submits(p, "A"), submits(p, "B")]);
	await run(other);
	assert.equal(other.sent[0].input.length, 1);
	assert.ok(!JSON.stringify(other.sent).includes("GOLDEN_SECRET_974"));
	assert.ok(!Object.hasOwn(other.sent[0], "previous_response_id"));
	assert.ok(!Object.hasOwn(other.sent[0], "conversation"));
	assert.deepEqual(other.sent[0].tools, [TOOL]);
});
for (const [name, ops] of [
	["early B", [{ op: "read", path: "B/C1.json" }]],
	["hidden oracle", [{ op: "read", path: "goldens.json" }]],
	["path traversal", [{ op: "read", path: "../../secret.txt" }]],
	["participant seal", [{ op: "sealA" }]],
	["wrong phase", [{ ...submits(p, "A")[0], phase: "B" }]],
	["wrong order", [submits(p, "A")[1]]],
	["entry before seals", [{ op: "read", path: "entry/task.json" }]],
	[
		"B in A completion batch",
		[...submits(p, "A"), { op: "read", path: "B/C1.json" }],
	],
]) {
	test(`${name} fails closed without another provider request`, async () => {
		const { result } = await run(fake([ops]));
		assert.ok(result.fatal);
		assert.equal(result.turns, 1);
		assert.equal(result.controller.phase, "closed");
		assert.equal(result.retryAllowed, false);
	});
}
for (const [name, change] of [
	["missing usage", (b) => ({ ...b, usage: null })],
	[
		"count drift",
		(b) => ({
			...b,
			usage: { ...b.usage, input_tokens: 101, total_tokens: 121 },
		}),
	],
	[
		"extra tool",
		(b) => ({ ...b, output: [...b.output, { type: "web_search_call" }] }),
	],
	["model drift", (b) => ({ ...b, model: "other" })],
	[
		"extra configured tool",
		(b) => ({ ...b, tools: [TOOL, { type: "web_search" }] }),
	],
	["stored context", (b) => ({ ...b, previous_response_id: "old" })],
	["incomplete", (b) => ({ ...b, status: "incomplete" })],
	["wrong reasoning", (b) => ({ ...b, reasoning: { effort: "high" } })],
	[
		"non-assistant output",
		(b) => ({
			...b,
			output: [...b.output, { type: "message", role: "system", content: [] }],
		}),
	],
]) {
	test(`${name} is fatal and retained`, async () => {
		const { result, journal } = await run(fake([[{ op: "list" }]], change));
		assert.ok(result.fatal);
		assert.equal(result.turns, 1);
		assert.ok(journal.some((x) => x.type === "generation-response"));
		assert.equal(result.operations, 0);
	});
}
test("replayed response ID is rejected before second tool dispatch", async () => {
	const { result } = await run(
		fake([[{ op: "list" }], [{ op: "list" }]], (b) => ({ ...b, id: "same" })),
	);
	assert.ok(result.fatal.includes("replayed"));
	assert.equal(result.operations, 1);
});
test("duplicate retained answer is not overwritten", async () => {
	const first = submits(p, "A")[0];
	const { result } = await run(fake([[first], [first]]));
	assert.ok(result.fatal);
	assert.equal(
		Object.values(result.controller.answers.A).filter(
			(a) => a.status === "submitted",
		).length,
		1,
	);
});
test("cumulative input cap blocks a request before generation and preserves eight missing B", async () => {
	const { result } = await run(fake([[{ op: "list" }]], (x) => x, 30000));
	assert.equal(result.turns, 1);
	assert.equal(result.counts, 2);
	assert.equal(result.usage.inputTokens, 30000);
	assert.equal(Object.keys(result.controller.sealB.answers).length, 8);
});
test("output and reasoning accumulate; last max_output_tokens shrinks", async () => {
	const f = fake([[{ op: "list" }]], (b, _i, payload) => {
		const n = payload.max_output_tokens;
		return {
			...b,
			usage: { ...b.usage, output_tokens: n, total_tokens: 100 + n },
		};
	});
	const { result } = await run(f);
	assert.equal(result.usage.outputTokens, 8000);
	assert.deepEqual(
		f.sent.map((x) => x.max_output_tokens),
		[2048, 2048, 2048, 1856],
	);
});
test("timeout aborts no-retry and retains worst-case unknown-charge reservation", async () => {
	let aborted = false;
	const f = fake([]);
	f.create = (_, { signal }) =>
		new Promise(() =>
			signal.addEventListener("abort", () => {
				aborted = true;
			}),
		);
	const { result } = await run(f, p, { requestTimeoutMs: 5 });
	assert.ok(aborted);
	assert.match(result.fatal, /timeout/);
	assert.equal(result.turns, 1);
	assert.ok(result.pendingReservation.costUSD > 0);
});
test("usage detail omissions and impossible cached/write split reject", () => {
	assert.throws(() =>
		validateUsage({ input_tokens: 1, output_tokens: 0, total_tokens: 1 }, 1, 1),
	);
	assert.throws(() =>
		validateUsage(
			{
				input_tokens: 1,
				output_tokens: 0,
				total_tokens: 1,
				input_tokens_details: { cached_tokens: 1, cache_write_tokens: 1 },
				output_tokens_details: { reasoning_tokens: 0 },
			},
			1,
			1,
		),
	);
});
test("entry released only after both seals; single role task and answer share original limits", async () => {
	const f = fake([
		submits(g, "A"),
		submits(g, "B"),
		[{ op: "read", path: "entry/task.json" }],
		[
			{
				op: "submit",
				snippet: "export {};",
				explanation: "synthetic",
				concepts: { read: [], required: [], firstExpansion: null },
			},
		],
	]);
	const { result, journal } = await run(f, g);
	assert.equal(result.fatal, null);
	assert.equal(result.entryStatus, "submitted");
	assert.equal(result.operations, 18);
	assert.ok(
		journal.findIndex((x) => x.type === "seal-B") <
			journal.findIndex(
				(x) => x.type === "broker-batch" && x.data.phase === "entry",
			),
	);
});
const approval = {
	manifestSHA: "test",
	action: "B121-agent-api-one-shot",
	acceptAliasLimitation: true,
	countEndpointPriceUSD: 0,
	countPriceEvidence: "synthetic fixture only",
	expiresAt: "2099-01-01",
	maxGenerationCalls: 962,
	maxCountCalls: 962,
	maxUSD: 12.11,
	retries: 0,
};
test("adapter denies zero grant, unknown count tariff and expired grant before fetch", () => {
	let calls = 0;
	for (const a of [
		{},
		{ ...approval, countEndpointPriceUSD: null },
		{ ...approval, expiresAt: "2000-01-01" },
		{ ...approval, retries: 1 },
	])
		assert.throws(() =>
			createOpenAITransport({
				apiKey: "fake-key",
				approval: a,
				manifestSHA: "test",
				fetchImpl: () => {
					calls++;
				},
			}),
		);
	assert.equal(calls, 0);
});
test("raw adapter has no retries, redirect following or endpoint substitution; raw error retained", async () => {
	const seen = [];
	const transport = createOpenAITransport({
		apiKey: "synthetic",
		approval,
		manifestSHA: "test",
		fetchImpl: async (url, request) => {
			seen.push({ url, request });
			return {
				ok: false,
				status: 429,
				headers: new Headers({ "x-request-id": "req_fake" }),
				text: async () => '{"error":"fake"}',
			};
		},
	});
	const f = fake([]);
	await assert.rejects(
		transport.count(
			f.sent[0] ?? {
				...CONFIG,
				instructions: "x",
				tools: [TOOL],
				tool_choice: { type: "function", name: "broker" },
				input: [],
				max_output_tokens: 512,
			},
			{ signal: new AbortController().signal },
		),
		(e) => e.envelope?.requestId === "req_fake",
	);
	assert.equal(seen.length, 1);
	assert.equal(seen[0].request.redirect, "error");
	assert.equal(seen[0].url, "https://api.openai.com/v1/responses/input_tokens");
});
test("two qualification requests are fresh and use no study material", async () => {
	const f = fake([
		[{ op: "read", path: "probe.json" }],
		[{ op: "read", path: "probe.json" }],
	]);
	const events = [];
	assert.equal(
		(await qualifyProvider({ transport: f, journal: (e) => events.push(e) }))
			.qualified,
		true,
	);
	assert.equal(f.sent.length, 2);
	assert.ok(f.sent.every((r) => r.input.length === 1));
	assert.ok(!JSON.stringify(f.sent[1]).includes("6f128b"));
	assert.ok(!JSON.stringify(f.sent).includes("spending"));
});
test("real adapter boundary retains malformed HTTP and missing-usage raw receipts", async () => {
	const payload = {
		...CONFIG,
		instructions: "x",
		tools: [TOOL],
		tool_choice: { type: "function", name: "broker" },
		input: [],
		max_output_tokens: 512,
	};
	for (const responseText of [
		"<html>bad gateway</html>",
		'{"id":"resp_broken","usage":null}',
	]) {
		let n = 0;
		const transport = createOpenAITransport({
			apiKey: "synthetic",
			approval,
			manifestSHA: "test",
			fetchImpl: async () => ({
				ok: true,
				status: 200,
				headers: new Headers({ "x-request-id": "req_evidence" }),
				text: async () =>
					++n === 1
						? ' {"object":"response.input_tokens","input_tokens":100}'
						: responseText,
			}),
		});
		await transport.count(payload, { signal: new AbortController().signal });
		await assert.rejects(
			transport.create(payload, { signal: new AbortController().signal }),
			(e) =>
				e.envelope?.rawBody === responseText &&
				e.envelope.requestId === "req_evidence",
		);
		assert.ok(transport.snapshot().reservedUSD > 0);
		assert.equal(n, 2);
	}
});
test("slow durable journal cannot accept final answers past deadline", async () => {
	let clock = 0;
	const events = [];
	const result = await runSession({
		...p,
		transport: fake([submits(p, "A"), submits(p, "B")]),
		now: () => clock,
		journal: (e) => {
			events.push(e);
			if (e.type === "broker-request" && e.data.phase === "B") clock = 4500001;
		},
	});
	assert.match(result.fatal, /timeout/);
	assert.equal(
		Object.values(result.controller.answers.B).filter(
			(x) => x.status === "submitted",
		).length,
		0,
	);
});
test("seeded hidden, other-arm and future-phase canaries never enter count or generation requests", async () => {
	const subject = structuredClone(p),
		other = structuredClone(g),
		hidden = { golden: "HIDDEN_CANARY_974" };
	subject.files["A/common.json"].content = subject.files[
		"A/common.json"
	].content.replace("same-facts judgment", "ALLOWED_CANARY_974");
	subject.files["B/C1.json"].content += "FUTURE_CANARY_974";
	other.files["A/C1.json"].content += "OTHER_ARM_CANARY_974";
	const f = fake([
		[{ op: "read", path: "A/common.json" }],
		[{ op: "read", path: "B/C1.json" }],
	]);
	const creates = [];
	const create = f.create;
	f.create = async (payload, opts) => {
		creates.push(payload);
		return create(payload, opts);
	};
	const { result } = await run(f, subject);
	assert.ok(result.fatal);
	const sent = JSON.stringify([...f.sent, ...creates]);
	assert.ok(sent.includes("ALLOWED_CANARY_974"));
	assert.ok(!sent.includes(hidden.golden));
	assert.ok(!sent.includes("OTHER_ARM_CANARY_974"));
	assert.ok(!sent.includes("FUTURE_CANARY_974"));
	assert.ok(other.files["A/C1.json"].content.includes("OTHER_ARM_CANARY_974"));
});
test("adapter reconciles cached/write charges, exact request binding, cost ceiling and campaign-wide replay", async () => {
	const payload = {
		...CONFIG,
		instructions: "x",
		tools: [TOOL],
		tool_choice: { type: "function", name: "broker" },
		input: [],
		max_output_tokens: 512,
	};
	let creates = 0;
	const transport = createOpenAITransport({
		apiKey: "synthetic",
		approval,
		manifestSHA: "test",
		fetchImpl: async (url) => ({
			ok: true,
			status: 200,
			headers: new Headers(),
			text: async () =>
				JSON.stringify(
					url.endsWith("input_tokens")
						? { object: "response.input_tokens", input_tokens: 100 }
						: {
								id: "resp_recorded_shape",
								model: "gpt-6-astra",
								output: [
									{ type: "function_call", call_id: "call_recorded_shape" },
								],
								usage: {
									input_tokens: 100,
									input_tokens_details: {
										cached_tokens: 20,
										cache_write_tokens: 30,
									},
									output_tokens: 40,
									output_tokens_details: { reasoning_tokens: 10 },
									total_tokens: 140,
								},
								fakeCreateOrdinal: ++creates,
							},
				),
		}),
	});
	const options = { signal: new AbortController().signal };
	await transport.count(payload, options);
	await assert.rejects(
		transport.create({ ...payload, input: "changed" }, options),
		/same-request/,
	);
	await transport.create(payload, options);
	assert.ok(Math.abs(transport.snapshot().reservedUSD - 0.002895) < 1e-10);
	await transport.count(payload, options);
	await assert.rejects(
		transport.create(payload, options),
		(e) => /replay/.test(e.message) && !!e.envelope,
	);
	assert.equal(creates, 2);
	let fetched = 0;
	const costly = createOpenAITransport({
		apiKey: "synthetic",
		approval,
		manifestSHA: "test",
		fetchImpl: async () => {
			fetched++;
			return {
				ok: true,
				status: 200,
				headers: new Headers(),
				text: async () =>
					'{"object":"response.input_tokens","input_tokens":2000000}',
			};
		},
	});
	await costly.count(payload, options);
	await assert.rejects(costly.create(payload, options), /ceiling/);
	assert.equal(fetched, 1);
});
test("null count response is retained before controller rejection", async () => {
	const transport = createOpenAITransport({
		apiKey: "synthetic",
		approval,
		manifestSHA: "test",
		fetchImpl: async () => ({
			ok: true,
			status: 200,
			headers: new Headers({ "x-request-id": "req_null" }),
			text: async () => "null",
		}),
	});
	const { result, journal } = await run(transport);
	assert.ok(result.fatal);
	assert.equal(result.turns, 0);
	assert.ok(
		journal.some(
			(x) =>
				x.type === "count-response" &&
				x.data.rawBody === "null" &&
				x.data.requestId === "req_null",
		),
	);
});
