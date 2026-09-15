import assert from "node:assert/strict";
import test from "node:test";
import { verifyFrozen } from "./api-campaign.mjs";
import { prepareBundle, prepareManifest } from "./api-prepare.mjs";
import { CEILING_USD, ROUTE } from "./api-provider.mjs";
import {
	CONFIG,
	maximumCost,
	runSession,
	TOOL,
	validateUsage,
} from "./api-runner.mjs";
import {
	createOpenRouterTransport,
	qualifyProvider,
} from "./api-transport.mjs";
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
		id: `resp_${i}`,
		model: ROUTE.model,
		provider: ROUTE.provider,
		usage: {
			prompt_tokens: count,
			completion_tokens: output,
			total_tokens: count + output,
			cost: maximumCost(count, output),
			prompt_tokens_details: { cached_tokens: 0 },
			completion_tokens_details: { reasoning_tokens: 1 },
		},
		choices: [
			{
				finish_reason: "tool_calls",
				message: {
					role: "assistant",
					content: null,
					reasoning_details: [
						{ type: "reasoning.text", text: "synthetic reasoning" },
					],
					tool_calls: [
						{
							type: "function",
							id: `call_${i}`,
							function: {
								name: "broker",
								arguments: JSON.stringify({
									requests: JSON.stringify(requests),
								}),
							},
						},
					],
				},
			},
		],
	};
}
function fake(batches, change = (x) => x, count = 100) {
	let i = 0;
	const sent = [];
	return {
		sent,
		estimate: async (payload) => {
			sent.push(payload);
			return { kind: "local-input-estimate", inputTokens: count };
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
	assert.equal(m.price.studyMaximum, 0.13152);
	assert.equal(maximumCost(576000, 96000), 0.13152);
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
	assert.ok(
		transport.sent[1].messages.length > transport.sent[0].messages.length,
	);
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
	assert.equal(other.sent[0].messages.length, 2);
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
		"input over budget",
		(b) => ({
			...b,
			usage: {
				...b.usage,
				prompt_tokens: 48001,
				total_tokens: 48021,
				cost: maximumCost(48001, 20),
			},
		}),
	],
	["model drift", (b) => ({ ...b, model: "other" })],
	["provider drift", (b) => ({ ...b, provider: "other" })],
	[
		"extra tool",
		(b) => {
			b.choices[0].message.tool_calls.push(b.choices[0].message.tool_calls[0]);
			return b;
		},
	],
	[
		"incomplete",
		(b) => {
			b.choices[0].finish_reason = "length";
			return b;
		},
	],
	[
		"non-assistant",
		(b) => {
			b.choices[0].message.role = "system";
			return b;
		},
	],
])
	test(`${name} is fatal and retained`, async () => {
		const { result, journal } = await run(fake([[{ op: "list" }]], change));
		assert.ok(result.fatal);
		assert.equal(result.turns, 1);
		assert.equal(result.operations, 0);
		assert.ok(journal.some((x) => x.type === "generation-response"));
	});
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
test("output and reasoning accumulate; last max_tokens shrinks", async () => {
	const f = fake([[{ op: "list" }]], (b, _i, payload) => {
		const n = payload.max_tokens;
		return {
			...b,
			usage: {
				...b.usage,
				completion_tokens: n,
				total_tokens: 100 + n,
				cost: maximumCost(100, n),
			},
		};
	});
	const { result } = await run(f);
	assert.equal(result.usage.outputTokens, 8000);
	assert.deepEqual(
		f.sent.map((x) => x.max_tokens),
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
test("inconsistent total and impossible cache reject", () => {
	const b = body(null, []);
	b.usage.total_tokens = 999;
	assert.throws(() => validateUsage(b, 100, 20));
	b.usage.total_tokens = 120;
	b.usage.prompt_tokens_details.cached_tokens = 101;
	assert.throws(() => validateUsage(b, 100, 20));
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
const approval = {
	manifestSHA: "test",
	action: "B121-agent-api-one-shot",
	acceptAliasLimitation: true,
	acceptInputEstimateLimitation: true,
	expiresAt: "2099-01-01",
	maxGenerationCalls: 962,
	maxUSD: CEILING_USD,
	retries: 0,
	model: ROUTE.model,
	providerTag: ROUTE.tag,
};
const payload = () => ({
	...structuredClone(CONFIG),
	tools: [TOOL],
	tool_choice: { type: "function", function: { name: "broker" } },
	messages: [{ role: "user", content: "probe" }],
	max_tokens: 512,
});
const options = () => ({ signal: new AbortController().signal });
const http = (text, status = 200) => {
	const r = new Response(text, {
		status,
		headers: { "x-request-id": "req_fixture" },
	});
	Object.defineProperty(r, "url", { value: ROUTE.endpoint });
	return r;
};
test("OpenRouter transport rejects invalid authorization before fetch", () => {
	let calls = 0;
	for (const a of [
		{},
		{ ...approval, expiresAt: "2000-01-01" },
		{ ...approval, retries: 1 },
		{ ...approval, providerTag: "other" },
		{ ...approval, acceptInputEstimateLimitation: false },
	])
		assert.throws(() =>
			createOpenRouterTransport({
				apiKey: "fake",
				approval: a,
				manifestSHA: "test",
				fetchImpl: () => calls++,
			}),
		);
	assert.equal(calls, 0);
});
test("OpenRouter uses one Chat request, local estimate only, preserves reasoning and exact config", async () => {
	const seen = [];
	const t = createOpenRouterTransport({
		apiKey: "fake",
		approval,
		manifestSHA: "test",
		fetchImpl: async (url, opts) => {
			seen.push({ url, opts });
			return http(JSON.stringify(body(null, [{ op: "list" }])));
		},
	});
	const p = payload();
	const e = await t.estimate(p);
	assert.equal(seen.length, 0);
	assert.equal(e.kind, "local-input-estimate");
	await assert.rejects(
		t.create({ ...p, messages: [] }, options()),
		/same-request/,
	);
	const out = await t.create(p, options());
	assert.equal(
		out.body.choices[0].message.reasoning_details[0].text,
		"synthetic reasoning",
	);
	assert.equal(seen.length, 1);
	assert.equal(seen[0].url, ROUTE.endpoint);
	assert.equal(seen[0].opts.redirect, "error");
	assert.equal(t.snapshot().countCalls, 0);
	assert.ok(Math.abs(t.snapshot().reservedUSD - maximumCost(100, 20)) < 1e-10);
});
test("HTTP errors, malformed bodies and missing usage retain raw evidence with reservation; no retries", async () => {
	for (const [raw, status] of [
		['{"error":"busy"}', 429],
		["<html>bad</html>", 200],
		[JSON.stringify({ ...body(null, []), usage: null }), 200],
	]) {
		let n = 0;
		const t = createOpenRouterTransport({
			apiKey: "fake",
			approval,
			manifestSHA: "test",
			fetchImpl: async () => {
				n++;
				return http(raw, status);
			},
		});
		const p = payload();
		await t.estimate(p);
		await assert.rejects(
			t.create(p, options()),
			(e) => e.envelope?.rawBody === raw,
		);
		assert.equal(n, 1);
		assert.ok(
			t.snapshot().reservedUSD >= maximumCost(ROUTE.contextTokens, 512),
		);
		await assert.rejects(t.estimate(p), /stopped/);
		assert.equal(n, 1);
	}
});
test("transport rejects campaign replay and retains full-context reservation on unknown outcome", async () => {
	const t = createOpenRouterTransport({
		apiKey: "fake",
		approval,
		manifestSHA: "test",
		fetchImpl: async () => http(JSON.stringify(body(null, [{ op: "list" }]))),
	});
	const p = payload();
	await t.estimate(p);
	await t.create(p, options());
	await t.estimate(p);
	await assert.rejects(t.create(p, options()), /replay/);
	assert.ok(t.snapshot().reservedUSD > maximumCost(ROUTE.contextTokens, 512));
});
test("full route context is reserved even for tiny estimates; cost ceiling blocks before fetch", async () => {
	let n = 0;
	const t = createOpenRouterTransport({
		apiKey: "fake",
		approval,
		manifestSHA: "test",
		fetchImpl: async () => {
			n++;
			return http(
				JSON.stringify(
					body(null, [{ op: "list" }], n, ROUTE.contextTokens, 512),
				),
			);
		},
	});
	const p = payload();
	for (let i = 0; i < 5; i++) {
		await t.estimate(p);
		await t.create(p, options());
	}
	await t.estimate(p);
	await assert.rejects(t.create(p, options()), /ceiling/);
	assert.equal(n, 5);
});
test("two fresh qualifications use only synthetic material", async () => {
	const f = fake([
		[{ op: "read", path: "probe.json" }],
		[{ op: "read", path: "probe.json" }],
	]);
	assert.equal(
		(await qualifyProvider({ transport: f, journal: () => {} })).qualified,
		true,
	);
	assert.equal(f.sent.length, 2);
	assert.ok(f.sent.every((p) => p.messages.length === 2));
	assert.ok(!JSON.stringify(f.sent[1]).includes("6f128b"));
});
test("assistant reasoning is replayed verbatim only within its own session", async () => {
	const f = fake([submits(p, "A"), submits(p, "B")]);
	await run(f);
	assert.deepEqual(f.sent[1].messages[2].reasoning_details, [
		{ type: "reasoning.text", text: "synthetic reasoning" },
	]);
	assert.equal(f.sent[1].messages[3].role, "tool");
});
test("stream deadline retains headers and partial raw body after bounded abort settlement", async () => {
	const t = createOpenRouterTransport({
		apiKey: "fake",
		approval,
		manifestSHA: "test",
		fetchImpl: async () => {
			const r = new Response(
				new ReadableStream({
					start(c) {
						c.enqueue(new TextEncoder().encode('{"id":"partial"'));
					},
				}),
				{ headers: { "x-request-id": "receipt-known" } },
			);
			Object.defineProperty(r, "url", { value: ROUTE.endpoint });
			return r;
		},
	});
	const { result, journal } = await run(t, p, { requestTimeoutMs: 30 });
	assert.match(result.fatal, /timeout/);
	assert.equal(result.operations, 0);
	const evidence = journal.find((e) => e.type === "failed").data.envelope;
	assert.equal(evidence.requestId, "receipt-known");
	assert.equal(evidence.rawBody, '{"id":"partial"');
	assert.ok(t.snapshot().reservedUSD > 0);
});
test("reported input overrun retains actual charged usage but admits no answer", async () => {
	const { result } = await run(
		fake([[{ op: "list" }]], (b) => ({
			...b,
			usage: {
				...b.usage,
				prompt_tokens: 48001,
				total_tokens: 48021,
				cost: maximumCost(48001, 20),
			},
		})),
	);
	assert.match(result.fatal, /token budget/);
	assert.equal(result.operations, 0);
	assert.equal(result.usage.inputTokens, 48001);
	assert.equal(result.costUSD, maximumCost(48001, 20));
	assert.equal(result.pendingReservation, null);
});
