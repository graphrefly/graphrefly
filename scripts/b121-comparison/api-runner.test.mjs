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
	validateResponse,
	validateUsage,
} from "./api-runner.mjs";
import {
	createOpenRouterTransport,
	transportErrorChain,
	CONNECTION_POLICY,
	nonPersistentRequestOptions,
	QUALIFICATION_READS,
	QUALIFICATION_SUBMISSIONS,
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
			completion_tokens_details: { reasoning_tokens: 0 },
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
									requests: requests,
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
			sent.push(structuredClone(payload));
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
	assert.equal(m.price.studyMaximum, 5.5728);
	assert.equal(maximumCost(576000, 96000), 0.288);
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
				prompt_tokens: 1000001,
				total_tokens: 1000021,
				cost: maximumCost(1000001, 20),
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
	const { result } = await run(fake([[{ op: "list" }]], (x) => x, 600000));
	assert.equal(result.turns, 1);
	assert.equal(result.counts, 2);
	assert.equal(result.usage.inputTokens, 600000);
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
		[4096, 3904],
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
test("independent entry has fresh context and no comparison seals", async () => {
	const f = fake([
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
	const { result, journal } = await run(f, g, { mode: "entry", files: {} });
	assert.equal(result.fatal, null);
	assert.equal(result.entryStatus, "submitted");
	assert.equal(result.operations, 2);
	assert.equal(result.controller, null);
	assert.equal(result.experiment, "entry");
	assert.ok(journal.every((x) => !["seal-A", "seal-B"].includes(x.type)));
	assert.equal(f.sent[0].messages.length, 3);
	assert.ok(!JSON.stringify(f.sent[0].messages).includes("A/common.json"));
	assert.equal(result.usage.inputTokens, 200);
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
	maxGenerationCalls: 1444,
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
				journal: () => {},
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
		journal: () => {},
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
	assert.equal(seen[0].opts.headers.connection, "close");
	assert.equal(seen[0].opts.headers.authorization, "Bearer fake");
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
			journal: () => {},
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
		journal: () => {},
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
		journal: () => {},
		apiKey: "fake",
		approval,
		manifestSHA: "test",
		fetchImpl: async () => {
			n++;
			return http(
				JSON.stringify(
					body(null, [{ op: "list" }], n, ROUTE.contextTokens - 512, 512),
				),
			);
		},
	});
	const p = payload();
	for (
		let i = 0;
		i < Math.floor(CEILING_USD / maximumCost(ROUTE.contextTokens, 512));
		i++
	) {
		await t.estimate(p);
		await t.create(p, options());
	}
	await t.estimate(p);
	await assert.rejects(t.create(p, options()), /ceiling/);
	assert.equal(
		n,
		Math.floor(CEILING_USD / maximumCost(ROUTE.contextTokens, 512)),
	);
});
test("two fresh qualifications use only synthetic material", async () => {
	const f = fake([
		[{ op: "read", path: "probe.json" }],
		QUALIFICATION_SUBMISSIONS[0],
		QUALIFICATION_READS[1],
		QUALIFICATION_SUBMISSIONS[1],
	]);
	assert.equal(
		(await qualifyProvider({ transport: f, journal: () => {} })).qualified,
		true,
	);
	assert.equal(f.sent.length, 4);
	assert.deepEqual(
		f.sent.map((p) => p.messages.length),
		[2, 4, 2, 4],
	);
	assert.ok(!JSON.stringify(f.sent[2]).includes("6f128b"));
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
		journal: () => {},
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
				prompt_tokens: 1000001,
				total_tokens: 1000021,
				cost: maximumCost(1000001, 20),
			},
		})),
	);
	assert.match(result.fatal, /token budget/);
	assert.equal(result.operations, 0);
	assert.equal(result.usage.inputTokens, 1000001);
	assert.equal(result.costUSD, maximumCost(1000001, 20));
	assert.equal(result.pendingReservation, null);
});

const recoveryApproval = {
	...approval,
	retries: { capacity: 3, availability: 1 },
};
function recovering(responses, extra = {}) {
	const seen = [],
		waits = [],
		events = [];
	const t = createOpenRouterTransport({
		apiKey: "fake",
		approval: recoveryApproval,
		manifestSHA: "test",
		journal: (e) => events.push(e),
		sleepImpl: async (ms) => {
			waits.push(ms);
		},
		fetchImpl: async (_url, opts) => {
			seen.push(opts.body);
			const next = responses.shift();
			if (next instanceof Error) throw next;
			if (typeof next === "function") return next(opts);
			return next ?? http(JSON.stringify(body(null, [{ op: "list" }])));
		},
		...extra,
	});
	return { t, seen, waits, events };
}
const busyResponse = (
	status = 429,
	retryAfter = "1",
	value = { error: { code: status } },
) => {
	const r = http(JSON.stringify(value), status);
	if (retryAfter !== null) r.headers.set("retry-after", retryAfter);
	return r;
};
test("CSP11 recovery replays identical payload, separates failure evidence and retains unknown billing", async () => {
	const f = recovering([
		busyResponse(),
		busyResponse(503),
		busyResponse(),
		busyResponse(),
	]);
	const p = payload();
	await f.t.estimate(p);
	const result = await f.t.create(p, options());
	assert.deepEqual(f.waits, [60000, 60000, 120000, 240000]);
	assert.equal(new Set(f.seen).size, 1);
	assert.equal(result.attempts.length, 4);
	assert.equal(f.t.snapshot().generationCalls, 5);
	assert.ok(
		Math.abs(
			f.t.snapshot().reservedUSD -
				(4 * maximumCost(ROUTE.contextTokens, 512) + maximumCost(100, 20)),
		) < 1e-9,
	);
	assert.equal(
		f.events.filter((e) => e.type === "provider-attempt-failed").length,
		4,
	);
});
test("recovery exhaustion and over-limit Retry-After stop without shortening waits", async () => {
	for (const [responses, n, waits] of [
		[
			[busyResponse(), busyResponse(), busyResponse(), busyResponse()],
			4,
			[60000, 120000, 240000],
		],
		[[busyResponse(503), busyResponse(503)], 2, [60000]],
		[[busyResponse(429, "241")], 1, []],
	]) {
		const f = recovering(responses);
		const p = payload();
		await f.t.estimate(p);
		await assert.rejects(f.t.create(p, options()));
		assert.equal(f.seen.length, n);
		assert.deepEqual(f.waits, waits);
		assert.equal(f.t.snapshot().stopped, true);
	}
});
test("terminal HTTP, malformed JSON, reported usage and invalid successful output never retry", async () => {
	for (const r of [
		busyResponse(401),
		busyResponse(500, null),
		http("bad", 200),
		busyResponse(429, "1", { error: { code: 429 }, usage: { cost: 0 } }),
		http(JSON.stringify({ ...body(null, []), model: "other" })),
	]) {
		const f = recovering([r]);
		const p = payload();
		await f.t.estimate(p);
		await assert.rejects(f.t.create(p, options()));
		assert.equal(f.seen.length, 1);
		assert.deepEqual(f.waits, []);
	}
});
test("conditional 500 and network failures use availability budget", async () => {
	for (const response of [
		busyResponse(500, "90"),
		new TypeError("fetch failed"),
	]) {
		const f = recovering([response]);
		const p = payload();
		await f.t.estimate(p);
		await f.t.create(p, options());
		assert.deepEqual(f.waits, [response instanceof Error ? 60000 : 90000]);
	}
});
test("attempt timeout after partial body can recover; external abort cannot", async () => {
	const stalled = () => {
		const r = new Response(
			new ReadableStream({
				start(c) {
					c.enqueue(new TextEncoder().encode('{"id":"partial"'));
				},
			}),
		);
		Object.defineProperty(r, "url", { value: ROUTE.endpoint });
		return r;
	};
	const f = recovering([stalled], { attemptTimeoutMs: 5 });
	const p = payload();
	await f.t.estimate(p);
	const out = await f.t.create(p, options());
	assert.equal(f.seen.length, 2);
	assert.equal(out.attempts[0].envelope.rawBody, '{"id":"partial"');
	assert.equal(
		out.attempts[0].transportDiagnostics.abortSource,
		"attempt-timeout",
	);
	assert.equal(
		out.attempts[0].transportDiagnostics.phase,
		"reading-response-body",
	);
	assert.equal(out.attempts[0].transportDiagnostics.httpStatus, 200);
	assert.equal(out.attempts[0].transportDiagnostics.attemptTimeoutFired, true);
	const abort = new AbortController();
	const g = recovering([busyResponse()], {
		sleepImpl: async () => abort.abort(),
	});
	await g.t.estimate(p);
	await assert.rejects(g.t.create(p, { signal: abort.signal }));
	assert.equal(g.seen.length, 1);
});
test("journal failure stops before retry and no spend on first journal failure", async () => {
	for (const type of [
		"provider-attempt-request",
		"provider-attempt-failed",
		"provider-retry-wait",
	]) {
		const f = recovering([busyResponse()], {
			journal: (e) => {
				if (e.type === type) throw new Error("disk failure");
			},
		});
		const p = payload();
		await f.t.estimate(p);
		await assert.rejects(f.t.create(p, options()), /disk failure/);
		assert.equal(f.seen.length, type === "provider-attempt-request" ? 0 : 1);
		assert.equal(f.waits.length, 0);
	}
});
test("recovery runs through real session controller without replaying a broker operation", async () => {
	const f = recovering([
		busyResponse(),
		http(JSON.stringify(body(null, submits(p, "A"), 1))),
		http(JSON.stringify(body(null, submits(p, "B"), 2))),
	]);
	const events = [];
	const result = await runSession({
		...p,
		transport: f.t,
		journal: (e) => events.push(e),
	});
	assert.equal(result.fatal, null);
	assert.equal(f.seen.length, 3);
	assert.equal(f.seen[0], f.seen[1]);
	assert.ok(f.seen[2].includes('"role":"tool"'));
});

test("non-JSON HTTP gateway failures preserve raw evidence and recover by status", async () => {
	for (const r of [http("<html>gateway down</html>", 502), http("", 429)]) {
		const f = recovering([r]);
		const p = payload();
		await f.t.estimate(p);
		const out = await f.t.create(p, options());
		assert.equal(f.seen.length, 2);
		assert.equal(out.attempts[0].envelope.httpStatus, r.status);
		assert.ok(out.attempts[0].envelope.rawBodyBase64 !== null);
	}
});
test("expiry while waiting and concurrent dispatch cannot create another request", async () => {
	const grant = { ...recoveryApproval };
	let release;
	const f = recovering([busyResponse()], {
		approval: grant,
		sleepImpl: () =>
			new Promise((r) => {
				release = r;
			}),
	});
	const p = payload();
	await f.t.estimate(p);
	const active = f.t.create(p, options());
	while (!release) await new Promise((r) => setImmediate(r));
	await assert.rejects(f.t.estimate(p), /stopped|expired/);
	await assert.rejects(f.t.create(p, options()), /stopped|expired/);
	const originalNow = Date.now;
	try {
		Date.now = () => Date.parse("2100-01-01");
		release();
		await assert.rejects(active, /expired/);
	} finally {
		Date.now = originalNow;
	}
	assert.equal(f.seen.length, 1);
});

test("mid-body socket disconnect recovers but streamed byte-limit violations do not", async () => {
	for (const tooLarge of [false, true]) {
		let reads = 0;
		const r = new Response(
			new ReadableStream({
				pull(c) {
					if (reads++ === 0)
						c.enqueue(new TextEncoder().encode('{"id":"partial"'));
					else if (tooLarge) {
						c.enqueue(new Uint8Array(2 * 1024 * 1024));
						c.close();
					} else c.error(new TypeError("terminated: socket closed"));
				},
			}),
		);
		Object.defineProperty(r, "url", { value: ROUTE.endpoint });
		const f = recovering([r]);
		const p = payload();
		await f.t.estimate(p);
		if (tooLarge) {
			await assert.rejects(f.t.create(p, options()));
			assert.equal(f.seen.length, 1);
		} else {
			const out = await f.t.create(p, options());
			assert.equal(f.seen.length, 2);
			assert.equal(out.attempts[0].envelope.rawBody, '{"id":"partial"');
			assert.equal(out.attempts[0].transportDiagnostics.abortSource, null);
			assert.equal(
				out.attempts[0].transportDiagnostics.phase,
				"reading-response-body",
			);
			assert.equal(out.attempts[0].transportDiagnostics.httpStatus, 200);
			assert.equal(
				out.attempts[0].transportDiagnostics.attemptTimeoutFired,
				false,
			);
			assert.deepEqual(f.waits, [60000]);
		}
	}
});

test("qualifications recover independently and preserve two fresh conversations", async () => {
	const f = recovering([
		busyResponse(),
		http(JSON.stringify(body(null, [{ op: "read", path: "probe.json" }], 1))),
		http(JSON.stringify(body(null, QUALIFICATION_SUBMISSIONS[0], 2))),
		http(JSON.stringify(body(null, QUALIFICATION_READS[1], 3))),
		http(JSON.stringify(body(null, QUALIFICATION_SUBMISSIONS[1], 4))),
	]);
	const result = await qualifyProvider({ transport: f.t, journal: () => {} });
	assert.equal(result.qualified, true);
	assert.equal(f.seen.length, 5);
	assert.equal(f.seen[0], f.seen[1]);
	assert.equal(JSON.parse(f.seen[3]).messages.length, 2);
	assert.ok(!f.seen[3].includes("6f128b"));
});
test("remaining money can stop recovery before any wait or extra dispatch", async () => {
	const funded =
		Math.floor(CEILING_USD / maximumCost(ROUTE.contextTokens, 512)) - 1;
	const f = recovering([
		...Array.from({ length: funded }, (_, i) =>
			http(
				JSON.stringify(
					body(null, [{ op: "list" }], i, ROUTE.contextTokens - 512, 512),
				),
			),
		),
		busyResponse(),
	]);
	const p = payload();
	for (let i = 0; i < funded; i++) {
		await f.t.estimate(p);
		await f.t.create(p, options());
	}
	await f.t.estimate(p);
	await assert.rejects(f.t.create(p, options()), /ceiling before retry/);
	assert.equal(f.seen.length, funded + 1);
	assert.deepEqual(f.waits, []);
});

test("known HTTP status wins over interrupted error body", async () => {
	for (const status of [401, 429]) {
		const broken = () => {
			let reads = 0;
			const r = new Response(
				new ReadableStream({
					pull(c) {
						if (reads++ === 0) c.enqueue(new TextEncoder().encode('{"error":'));
						else c.error(new TypeError("socket closed"));
					},
				}),
				{ status },
			);
			Object.defineProperty(r, "url", { value: ROUTE.endpoint });
			return r;
		};
		const f = recovering([broken(), broken()]);
		const p = payload();
		await f.t.estimate(p);
		if (status === 401) {
			await assert.rejects(f.t.create(p, options()));
			assert.equal(f.seen.length, 1);
			assert.deepEqual(f.waits, []);
		} else {
			await f.t.create(p, options());
			assert.equal(f.seen.length, 3);
			assert.deepEqual(f.waits, [60000, 120000]);
		}
	}
});

test("charged truncated response stops but reconciles actual spend and session usage", async () => {
	const response = body(null, [], 1, 4506, 2048);
	response.choices[0].finish_reason = "length";
	const f = recovering([http(JSON.stringify(response))]);
	const events = [];
	const result = await runSession({
		...p,
		transport: f.t,
		journal: (e) => events.push(e),
	});
	assert.match(result.fatal, /incomplete/);
	assert.equal(result.usage.inputTokens, 4506);
	assert.equal(result.usage.outputTokens, 2048);
	assert.equal(result.pendingReservation, null);
	assert.equal(f.t.snapshot().reportedCostUSD, response.usage.cost);
	assert.ok(f.t.snapshot().unknownReservedUSD < 1e-10);
	assert.deepEqual(f.waits, []);
});
test("prior cumulative key spend blocks unaffordable dispatch before network", async () => {
	const f = recovering([], {
		approval: { ...recoveryApproval, priorUsageUSD: CEILING_USD - 0.01 },
	});
	const p = payload();
	await f.t.estimate(p);
	await assert.rejects(f.t.create(p, options()), /ceiling/);
	assert.equal(f.seen.length, 0);
});
test("qualification refuses a provider that ignores disabled reasoning", async () => {
	const b = body(null, [{ op: "read", path: "probe.json" }], 1);
	b.usage.completion_tokens_details.reasoning_tokens = 5;
	const f = recovering([http(JSON.stringify(b))]);
	await assert.rejects(
		qualifyProvider({ transport: f.t, journal: () => {} }),
		/reasoning/,
	);
	assert.equal(f.seen.length, 1);
});
test("qualification rejects read-to-submit shape mismatch before participants", async () => {
	const f = recovering([
		http(JSON.stringify(body(null, [{ op: "read", path: "probe.json" }], 1))),
		http(JSON.stringify(body(null, [{ op: "list" }], 2))),
	]);
	await assert.rejects(
		qualifyProvider({ transport: f.t, journal: () => {} }),
		/operation mismatch/,
	);
	assert.equal(f.seen.length, 2);
});

test("participant reasoning drift and audited output overrun retain charges before stopping", async () => {
	for (const kind of ["reasoning", "overrun"]) {
		const b = body(
			null,
			[{ op: "list" }],
			1,
			500,
			kind === "overrun" ? 4097 : 100,
		);
		if (kind === "reasoning")
			b.usage.completion_tokens_details.reasoning_tokens = 5;
		const f = recovering([http(JSON.stringify(b))]);
		const result = await runSession({
			...p,
			transport: f.t,
			journal: () => {},
		});
		assert.match(result.fatal, kind === "reasoning" ? /reasoning/ : /budget/);
		assert.equal(result.usage.outputTokens, b.usage.completion_tokens);
		assert.equal(result.costUSD, b.usage.cost);
		assert.equal(f.t.snapshot().reportedCostUSD, b.usage.cost);
		assert.equal(f.seen.length, 1);
		assert.deepEqual(f.waits, []);
	}
});
test("qualification provider consumes real tool history with exact call pairing", async () => {
	let n = 0;
	const histories = [];
	const f = recovering([], {
		fetchImpl: async (_url, opts) => {
			const sent = JSON.parse(opts.body);
			histories.push(sent.messages);
			let requests = QUALIFICATION_READS[histories.length < 3 ? 0 : 1];
			if (sent.messages.length === 4) {
				const assistant = sent.messages[2],
					tool = sent.messages[3];
				assert.equal(tool.role, "tool");
				assert.equal(tool.tool_call_id, assistant.tool_calls[0].id);
				requests = JSON.parse(tool.content).nextRequests;
				assert.deepEqual(
					requests,
					QUALIFICATION_SUBMISSIONS[histories.length < 3 ? 0 : 1],
				);
			}
			return http(JSON.stringify(body(null, requests, ++n)));
		},
	});
	await qualifyProvider({ transport: f.t, journal: () => {} });
	assert.deepEqual(
		histories.map((x) => x.length),
		[2, 4, 2, 4],
	);
	assert.ok(!JSON.stringify(histories[2]).includes("6f128b"));
});

test("latest DeepSeek route accepts only published aliases and audited Together pricing", () => {
	const b = body(null, [{ op: "list" }]);
	b.model = "deepseek/deepseek-v4.1-flash-20260910";
	validateResponse(b);
	assert.throws(
		() => validateResponse({ ...b, model: "deepseek/deepseek-v4-flash-0731" }),
		/route/,
	);
	assert.equal(validateUsage(b, 500, 512).costUSD, 0.000054);
	const bad = structuredClone(b);
	bad.usage.cost = 0.0000244;
	assert.throws(() => validateUsage(bad, 500, 512), /pricing/);
	assert.equal(CONFIG.seed, undefined);
	assert.deepEqual(CONFIG.provider.only, ["together"]);
});

test("malformed model operation retains unanswered items as missing, not budget exhaustion", async () => {
	const { result } = await run(
		fake([[{ tool: "read_file", path: "README.md" }]]),
	);
	assert.equal(result.fatal, "invalid broker operation schema");
	for (const phase of Object.values(result.controller.answers))
		for (const answer of Object.values(phase))
			assert.equal(answer.status, "missing");
	assert.ok(result.costUSD > 0);
});

test("participant errors are isolated while transport and persistence failures remain global", async () => {
	const local = await run(fake([[{ tool: "read_file", path: "README.md" }]]));
	assert.equal(local.result.failureScope, "participant");
	const network = await run({
		...fake([]),
		create: async () => {
			throw new Error("socket failure");
		},
	});
	assert.equal(network.result.failureScope, "campaign");
	const replay = await run(
		fake([[{ op: "list" }], [{ op: "list" }]], (b) => ({ ...b, id: "same" })),
	);
	assert.equal(replay.result.failureScope, "campaign");
	await assert.rejects(
		runSession({
			...p,
			transport: fake([]),
			journal: () => {
				throw new Error("disk full");
			},
		}),
		/disk full/,
	);
});

test("non-string entry paths are participant failures without lookup coercion", async () => {
	for (const path of [["entry/task.json"], { toString: null }, null, 1]) {
		const result = await run(fake([[{ op: "read", path }]]), g, {
			mode: "entry",
			files: {},
		});
		assert.equal(result.result.failureScope, "participant");
		assert.equal(result.result.fatal, "entry path unavailable");
		assert.equal(result.result.entryAnswer, null);
		assert.equal(result.result.controller, null);
	}
});

test("frozen proposal declares participant isolation and retains global-stop boundaries", () => {
	const manifest = prepareManifest(prepareBundle());
	assert.equal(manifest.kind, "B121-agent-api-execution-proposal-v11-graph");
	assert.equal(manifest.executionReady, false);
	assert.equal(manifest.limits.participantFailureStopsCampaign, false);
	assert.equal(manifest.limits.campaignFailureStopsCampaign, true);
	assert.ok(manifest.limits.campaignFailureScopes.includes("accounting"));
	assert.equal(manifest.authorization.providerCalls, 0);
});

test("Graph comparison ends at B and standalone entry cannot access comparison files", async () => {
	const comparison = await run(fake([submits(g, "A"), submits(g, "B")]), g);
	assert.equal(comparison.result.turns, 2);
	assert.equal(comparison.result.entryStatus, "separate-experiment");
	assert.equal(comparison.result.entryAnswer, null);
	for (const path of ["orientation.json", "A/common.json", "B/C1.json"]) {
		const entry = await run(fake([[{ op: "read", path }]]), g, {
			mode: "entry",
			files: {},
		});
		assert.equal(entry.result.failureScope, "participant");
		assert.equal(entry.result.fatal, "entry path unavailable");
		assert.equal(entry.result.controller, null);
	}
});

test("entry receives a new configured cumulative budget after a near-limit comparison", async () => {
	const comparison = await run(
		fake([submits(g, "A"), submits(g, "B")], (x) => x, 450000),
		g,
	);
	assert.equal(comparison.result.usage.inputTokens, 900000);
	assert.equal(comparison.result.fatal, null);
	for (const phase of ["A", "B"])
		assert.equal(
			Object.values(comparison.result.controller.answers[phase]).filter(
				(x) => x.status === "submitted",
			).length,
			8,
		);
	const entry = await run(
		fake(
			[
				[{ op: "read", path: "entry/task.json" }],
				[
					{
						op: "submit",
						snippet: "export {};",
						explanation: "synthetic",
						concepts: { read: [], required: [], firstExpansion: null },
					},
				],
			],
			(x) => x,
			450000,
		),
		g,
		{ mode: "entry", files: {} },
	);
	assert.equal(entry.result.usage.inputTokens, 900000);
	assert.equal(entry.result.entryStatus, "submitted");
	assert.equal(entry.result.fatal, null);
});

test("task metadata is available only to entry and does not count as implementation source inspection", async () => {
	const path = "entry/task.json";
	const entry = await run(
		fake([
			[{ op: "read", path }],
			[
				{
					op: "submit",
					snippet: "export {};",
					explanation: "synthetic",
					concepts: { read: [], required: [], firstExpansion: null },
				},
			],
		]),
		g,
		{ mode: "entry", files: {} },
	);
	assert.equal(entry.result.fatal, null);
	assert.equal(entry.result.entryTiming.firstSourceRead, null);
	const comparison = await run(fake([[{ op: "read", path }]]), g);
	assert.equal(comparison.result.failureScope, "participant");
	assert.equal(comparison.result.fatal, "path unavailable");
});

test("entry searches real frozen symbols, reads matched lines, then submits through the actual runner", async () => {
	const query = {
		op: "search",
		query: "spendingAlertsFor",
		pathPrefix: "examples/spending-alerts/causal-entry.ts",
		caseSensitive: true,
		offset: 0,
		limit: 5,
	};
	const f = fake([
		[query],
		[
			{
				op: "read",
				path: "examples/spending-alerts/causal-entry.ts",
				startLine: 1,
				endLine: 78,
			},
		],
		[
			{
				op: "submit",
				snippet: "export {};",
				explanation: "synthetic retrieval only",
				concepts: { read: [], required: [], firstExpansion: null },
			},
		],
	]);
	const { result, journal } = await run(f, g, { mode: "entry", files: {} });
	assert.equal(result.fatal, null);
	assert.equal(result.entryStatus, "submitted");
	const batches = journal.filter((x) => x.type === "broker-batch");
	assert.ok(batches[0].data.results[0].matches.length > 0);
	assert.equal(batches[1].data.results[0].startLine, 1);
	assert.equal(batches[1].data.results[0].endLine, 78);
	assert.equal(result.entryTiming.firstSourceRead.operation, "search");
	assert.ok(
		f.sent[0].tools[0].function.parameters.properties.requests.items.anyOf.some(
			(s) => s.properties.op.enum.includes("search"),
		),
	);
	assert.ok(
		!f.sent[0].tools[0].function.description.includes("orientation.json"),
	);
	assert.equal(
		(await run(fake([[query]]), g)).result.failureScope,
		"participant",
	);
});

test("null and non-object operations stay participant-local in both experiments", async () => {
	for (const mode of ["entry", "comparison"])
		for (const request of [null, 3, "read", []]) {
			const { result } = await run(
				fake([[request]]),
				g,
				mode === "entry" ? { mode, files: {} } : {},
			);
			assert.equal(result.failureScope, "participant");
			assert.equal(result.fatal, "invalid broker operation object");
		}
});

test("recoverable retrieval feedback is returned in paired history and corrected within original budgets", async () => {
	const path = "examples/spending-alerts/causal-entry.ts";
	const f = fake([
		[{ op: "read", path, startLine: 0, endLine: 3 }],
		[{ op: "read", path }],
		[
			{
				op: "submit",
				snippet: "export {};",
				explanation: "synthetic",
				concepts: { read: [], required: [], firstExpansion: null },
			},
		],
	]);
	const { result, journal } = await run(f, g, { mode: "entry", files: {} });
	assert.equal(result.fatal, null);
	assert.equal(result.entryStatus, "submitted");
	assert.equal(result.usage.inputTokens, 300);
	const error = JSON.parse(f.sent[1].messages[3].content)[0];
	assert.equal(error.ok, false);
	assert.equal(error.error.recoverable, true);
	assert.equal(
		f.sent[1].messages[3].tool_call_id,
		f.sent[1].messages[2].tool_calls[0].id,
	);
	assert.equal(journal.filter((x) => x.type === "broker-batch").length, 3);
	assert.equal(result.entryTiming.firstSourceRead.path, path);
});
test("repeated recoverable retrieval errors reach reserved final stage without extra attempts", async () => {
	const bad = {
		op: "read",
		path: "examples/spending-alerts/causal-entry.ts",
		startLine: 0,
		endLine: 2,
	};
	const f = fake(Array.from({ length: 81 }, () => [bad]));
	const { result, journal } = await run(f, g, { mode: "entry", files: {} });
	assert.match(result.fatal, /submit-only/);
	assert.equal(result.failureScope, "participant");
	assert.equal(result.entryAnswer, null);
	assert.equal(f.sent.length, 65);
	assert.equal(journal.filter((x) => x.type === "broker-batch").length, 64);
	assert.equal(result.usage.inputTokens, 6500);
});
test("recoverable and successful reads share a batch; denied paths still stop the session", async () => {
	const path = "examples/spending-alerts/causal-entry.ts";
	const f = fake([
		[
			{ op: "read", path, startLine: 0, endLine: 2 },
			{ op: "read", path },
		],
		[{ op: "read", path: "../../goldens.json", startLine: 0, endLine: 2 }],
	]);
	const { result, journal } = await run(f, g, { mode: "entry", files: {} });
	assert.equal(result.failureScope, "participant");
	assert.equal(result.fatal, "entry path unavailable");
	const batch = journal.find((x) => x.type === "broker-batch");
	assert.equal(batch.data.results[0].ok, false);
	assert.equal(batch.data.results[1].ok, true);
	assert.equal(f.sent.length, 2);
});

test("HTTP200 error-finish keeps explicit zero billing distinct from upstream costs and never retries", async () => {
	const b = body(null, [{ op: "list" }], 1, 10755, 2);
	b.choices[0].finish_reason = "error";
	b.choices[0].message.content = null;
	b.choices[0].message.tool_calls = [];
	b.usage.cost = 0;
	b.usage.cost_details = { upstream_inference_cost: 0.0032289 };
	const f = recovering([http(JSON.stringify(b))]);
	const { result, journal } = await run(f.t);
	assert.match(result.fatal, /provider generation failed/);
	assert.equal(result.failureScope, "campaign");
	assert.equal(result.usage.inputTokens, 10755);
	assert.equal(result.usage.outputTokens, 2);
	assert.equal(result.costUSD, 0);
	assert.equal(f.t.snapshot().reportedCostUSD, 0);
	assert.equal(f.t.snapshot().unknownReservedUSD, 0);
	assert.equal(f.seen.length, 1);
	assert.deepEqual(f.waits, []);
	assert.equal(journal.filter((x) => x.type === "broker-request").length, 0);
	assert.equal(
		f.events.find((x) => x.type === "provider-attempt-failed").data.envelope
			.body.usage.cost_details.upstream_inference_cost,
		0.0032289,
	);
});
test("error-finish absent or malformed billing retains reservation without masking generation error", async () => {
	for (const cost of [undefined, -1, "0"]) {
		const b = body(null, [{ op: "list" }]);
		b.choices[0].finish_reason = "error";
		b.usage.cost = cost;
		const f = recovering([http(JSON.stringify(b))]);
		const { result } = await run(f.t);
		assert.match(result.fatal, /provider generation failed/);
		assert.ok(f.t.snapshot().unknownReservedUSD > 0);
		assert.equal(f.t.snapshot().reportedCostUSD, 0);
		assert.equal(f.seen.length, 1);
		assert.deepEqual(f.waits, []);
	}
});
test("error-finish positive billing is retained, including overrun, with no output accepted", async () => {
	const b = body(null, [{ op: "list" }]);
	b.choices[0].finish_reason = "error";
	b.usage.cost = 0.4;
	const f = recovering([http(JSON.stringify(b))]);
	const { result } = await run(f.t);
	assert.match(result.fatal, /provider generation failed/);
	assert.equal(result.costUSD, 0.4);
	assert.equal(f.t.snapshot().reportedCostUSD, 0.4);
	assert.equal(f.seen.length, 1);
	assert.deepEqual(f.waits, []);
});
test("success pricing and route validation are not relaxed by error-response accounting", async () => {
	for (const change of [
		(b) => {
			b.usage.cost = 0;
		},
		(b) => {
			b.choices[0].finish_reason = "error";
			b.provider = "other";
			b.usage.cost = 0;
		},
	]) {
		const b = body(null, [{ op: "list" }]);
		change(b);
		const f = recovering([http(JSON.stringify(b))]);
		const { result } = await run(f.t);
		assert.match(result.fatal, /pricing audit|route mismatch/);
		assert.ok(f.t.snapshot().unknownReservedUSD > 0);
		assert.deepEqual(f.waits, []);
	}
});

test("combined provider window is checked independently of cumulative input", async () => {
	assert.doesNotThrow(() =>
		validateUsage(
			body(null, [], 1, ROUTE.contextTokens - 20, 20),
			ROUTE.contextTokens,
			20,
		),
	);
	assert.throws(
		() =>
			validateUsage(
				body(null, [], 1, ROUTE.contextTokens - 19, 20),
				ROUTE.contextTokens,
				20,
			),
		/reported usage exceeded/,
	);
	const transport = fake([], (x) => x, ROUTE.contextTokens);
	let creates = 0;
	transport.create = async () => {
		creates++;
		throw Error("must not dispatch");
	};
	const { journal } = await run(transport);
	assert.equal(creates, 0);
	assert.ok(
		journal.some(
			(e) =>
				e.type === "budget-stop" &&
				e.data.reason === "request-context-estimate-exceeds-provider-window",
		),
	);
});

test("503 header-only identity survives real transport failure journal without releasing reservation", async () => {
	const events = [];
	const t = createOpenRouterTransport({
		apiKey: "fake",
		approval,
		manifestSHA: "test",
		journal: (e) => events.push(e),
		fetchImpl: async () => {
			const r = new Response(
				JSON.stringify({ error: { message: "unavailable" } }),
				{
					status: 503,
					headers: {
						"X-Generation-Id": "gen-header",
						"Request-Id": "req-header",
					},
				},
			);
			Object.defineProperty(r, "url", { value: ROUTE.endpoint });
			return r;
		},
	});
	const { result } = await run(t);
	assert.ok(result.fatal);
	const e = events.find((e) => e.type === "provider-attempt-failed").data;
	assert.equal(e.envelope.generationId, "gen-header");
	assert.equal(e.envelope.requestId, "req-header");
	assert.equal(e.envelope.body.id, undefined);
	assert.equal(e.billing, "unknown-reservation-retained");
	assert.ok(t.snapshot().unknownReservedUSD > 0);
});

test("response identity handles casing, Headers, conflicts, and empty malformed IDs", async () => {
	const { responseIdentity } = await import("./api-transport.mjs");
	assert.equal(
		responseIdentity(null, { "X-Generation-ID": "gen-a" }).generationId,
		"gen-a",
	);
	assert.equal(
		responseIdentity(
			{ id: "gen-a" },
			new Headers({ "x-generation-id": "gen-a" }),
		).identityConflict,
		false,
	);
	const conflict = responseIdentity(
		{ id: "gen-a" },
		{ "x-generation-id": "gen-b", "request-id": "r1", "X-Request-ID": "r2" },
	);
	assert.equal(conflict.generationId, null);
	assert.equal(conflict.requestId, null);
	assert.equal(conflict.identityConflict, true);
	assert.deepEqual(conflict.generationIds, ["gen-a", "gen-b"]);
	assert.equal(
		responseIdentity({ id: 42 }, { "x-generation-id": "  " }).generationId,
		null,
	);
	assert.equal(responseIdentity(null, null).requestId, null);
});

test("duplicate generation headers remain conflicting through Fetch and the failure journal", async () => {
	const events = [];
	const t = createOpenRouterTransport({
		apiKey: "fake",
		approval,
		manifestSHA: "test",
		journal: (e) => events.push(e),
		fetchImpl: async () => {
			const headers = new Headers();
			headers.append("X-Generation-Id", "gen-a");
			headers.append("X-Generation-Id", "gen-b");
			const r = new Response("{}", { status: 503, headers });
			Object.defineProperty(r, "url", { value: ROUTE.endpoint });
			return r;
		},
	});
	await run(t);
	const e = events.find((e) => e.type === "provider-attempt-failed").data
		.envelope;
	assert.equal(e.generationId, null);
	assert.equal(e.identityConflict, true);
	assert.deepEqual(e.generationIds, ["gen-a", "gen-b"]);
	assert.equal(e.headers["x-generation-id"], "gen-a, gen-b");
});

test("entry feedback reflects charged session usage and one latest status without changing tool evidence", async () => {
	const f = fake([
		[{ op: "read", path: "entry/task.json" }],
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
	const { result, journal } = await run(f, g, {
		mode: "entry",
		files: {},
		now: () => 0,
	});
	assert.equal(result.entryStatus, "submitted");
	const statuses = f.sent.map((p) => JSON.parse(p.messages.at(-1).content));
	assert.deepEqual(
		statuses.map((s) => s.used.inputTokens),
		[0, 100, 200],
	);
	assert.deepEqual(
		statuses.map((s) => s.remaining.inputTokens),
		[1000000, 999900, 999800],
	);
	assert.deepEqual(
		statuses.map((s) => s.used.outputTokens),
		[0, 20, 40],
	);
	assert.deepEqual(
		statuses.map((s) => s.remaining.operations),
		[80, 79, 78],
	);
	assert.deepEqual(
		statuses.map((s) => s.remaining.generationCalls),
		[80, 79, 78],
	);
	assert.ok(statuses.every((s) => s.sessionId === g.slot.id));
	const responses = journal
		.filter((e) => e.type === "generation-response")
		.map((e) => e.data.body);
	const batches = journal
		.filter((e) => e.type === "broker-batch")
		.map((e) => e.data.results);
	assert.deepEqual(
		f.sent.map((p) => p.messages.length),
		[3, 5, 7],
	);
	for (let i = 1; i < f.sent.length; i++) {
		const message = responses[i - 1].choices[0].message;
		assert.deepEqual(f.sent[i].messages.slice(0, -1), [
			...f.sent[i - 1].messages.slice(0, -1),
			message,
			{
				role: "tool",
				tool_call_id: message.tool_calls[0].id,
				content: JSON.stringify(batches[i - 1]),
			},
		]);
	}

	for (const payload of f.sent) {
		assert.equal(
			payload.messages.filter(
				(m) =>
					m.role === "user" &&
					m.content.includes('"kind":"controller_budget_status"'),
			).length,
			1,
		);
		const resultMessages = payload.messages.filter((m) => m.role === "tool");
		assert.ok(
			resultMessages.every((m) => Array.isArray(JSON.parse(m.content))),
		);
	}
	assert.deepEqual(
		journal.filter((e) => e.type === "entry-budget-status").map((e) => e.data),
		statuses,
	);
	assert.equal(result.usage.inputTokens, 300);
	const independent = fake([
		[
			{
				op: "submit",
				snippet: "export {};",
				explanation: "synthetic",
				concepts: { read: [], required: [], firstExpansion: null },
			},
		],
	]);
	await run(independent, g, { mode: "entry", files: {}, now: () => 0 });
	assert.equal(
		JSON.parse(independent.sent[0].messages.at(-1).content).used.inputTokens,
		0,
	);
});

test("entry feedback is included in admission estimates and never earns an extra generation", async () => {
	const sent = [];
	let creates = 0;
	const transport = {
		estimate: async (p) => {
			sent.push(p);
			return { kind: "local-input-estimate", inputTokens: 1000001 };
		},
		create: async () => {
			creates++;
			throw Error("must not dispatch");
		},
	};
	const { result, journal } = await run(transport, g, {
		mode: "entry",
		files: {},
		now: () => 0,
	});
	assert.equal(
		JSON.parse(sent[0].messages.at(-1).content).remaining.inputTokens,
		1000000,
	);
	assert.equal(creates, 0);
	assert.equal(result.entryStatus, "missing");
	assert.equal(
		journal.find((e) => e.type === "budget-stop").data.reason,
		"input-estimate-exceeds-remaining",
	);
});

test("input projection switches to one final submission within original budget and re-estimates it", async () => {
	const submit = {
		op: "submit",
		snippet: "export {};",
		explanation: "synthetic",
		concepts: { read: [], required: [], firstExpansion: null },
	};
	const f = fake(
		[
			[{ op: "read", path: "entry/task.json" }],
			[{ op: "read", path: "entry/task.json" }],
			[submit],
		],
		(x) => x,
		300000,
	);
	const { result, journal } = await run(f, g, {
		mode: "entry",
		files: {},
		now: () => 0,
	});
	assert.equal(result.entryStatus, "submitted");
	assert.equal(result.turns, 3);
	assert.equal(result.usage.inputTokens, 900000);
	assert.deepEqual(
		f.sent.map((p) => JSON.parse(p.messages.at(-1).content).stage),
		[
			"retrieve-or-submit",
			"retrieve-or-submit",
			"retrieve-or-submit",
			"submit-only",
		],
	);
	const dispatched = journal.filter((e) => e.type === "generation-dispatch");
	assert.equal(dispatched.length, 3);
	assert.equal(
		JSON.parse(dispatched.at(-1).data.payload.messages.at(-1).content).stage,
		"submit-only",
	);
	assert.equal(dispatched.at(-1).data.requestHash, hash(f.sent.at(-1)));
	assert.equal(
		journal.filter((e) => e.type === "entry-finalization").length,
		1,
	);
});

test("retrieval reserves output for final call; further retrieval at final stage is a terminal participant failure", async () => {
	for (const used of [2880, 3900, 3903, 3904]) {
		for (const comply of [true, false]) {
			const submit = {
				op: "submit",
				snippet: "export {};",
				explanation: "synthetic",
				concepts: { read: [], required: [], firstExpansion: null },
			};
			const f = fake(
				[
					[{ op: "read", path: "entry/task.json" }],
					[comply ? submit : { op: "read", path: "entry/task.json" }],
				],
				(b, i) =>
					i === 1
						? {
								...b,
								usage: {
									...b.usage,
									completion_tokens: used,
									total_tokens: used + 100,
									cost: maximumCost(100, used),
								},
							}
						: b,
			);
			const { result } = await run(f, g, {
				mode: "entry",
				files: {},
				now: () => 0,
			});
			assert.equal(f.sent[0].max_tokens, 3904);
			assert.equal(f.sent[1].max_tokens, 4096);
			assert.equal(f.sent.length, 2);
			assert.equal(
				JSON.parse(f.sent[1].messages.at(-1).content).stage,
				"submit-only",
			);
			assert.equal(result.entryStatus, comply ? "submitted" : "missing");
			if (!comply) {
				assert.match(result.fatal, /submit-only/);
				assert.equal(result.failureScope, "participant");
				assert.equal(result.operations, 1);
			}
		}
	}
});

test("final stage still stops before HTTP if exact final estimate cannot fit", async () => {
	let estimates = 0,
		creates = 0;
	const t = {
		estimate: async () => ({
			kind: "local-input-estimate",
			inputTokens: ++estimates === 1 ? 500000 : 1000001,
		}),
		create: async () => {
			creates++;
			throw Error("no call");
		},
	};
	const { result, journal } = await run(t, g, {
		mode: "entry",
		files: {},
		now: () => 0,
	});
	assert.equal(estimates, 2);
	assert.equal(creates, 0);
	assert.equal(result.entryStatus, "missing");
	assert.equal(
		journal.filter((e) => e.type === "entry-finalization").length,
		1,
	);
	assert.equal(
		journal.find((e) => e.type === "budget-stop").data.reason,
		"input-estimate-exceeds-remaining",
	);
});

test("current request cap is visible before estimation; native length stop is retained without repair", async () => {
	const f = fake(
		[[{ op: "read", path: "entry/task.json" }], [{ op: "list" }]],
		(b, i, p) => {
			const output = i === 1 ? 2102 : p.max_tokens;
			b.usage.completion_tokens = output;
			b.usage.total_tokens = 100 + output;
			b.usage.cost = maximumCost(100, output);
			if (i === 2) {
				b.choices[0].native_finish_reason = "length";
				b.choices[0].message.tool_calls[0].function.arguments = "{}";
			}
			return b;
		},
	);
	const { result, journal } = await run(f, g, {
		mode: "entry",
		files: {},
		now: () => 0,
	});
	assert.equal(f.sent.length, 2);
	assert.deepEqual(
		f.sent.map((p) => p.max_tokens),
		[3904, 1802],
	);
	assert.deepEqual(
		f.sent.map(
			(p) =>
				JSON.parse(p.messages.at(-1).content).currentRequest.maxOutputTokens,
		),
		[3904, 1802],
	);
	assert.equal(
		JSON.parse(f.sent[1].messages.at(-1).content).remaining.outputTokens,
		5898,
	);
	assert.equal(result.fatal, "invalid tool envelope");
	assert.equal(result.entryAnswer, null);
	assert.equal(result.usage.outputTokens, 3904);
	const observations = journal.filter(
		(e) => e.type === "entry-output-observation",
	);
	assert.deepEqual(observations.at(-1).data, {
		finishReason: "tool_calls",
		nativeFinishReason: "length",
		reportedOutputTokens: 1802,
		requestMaxOutputTokens: 1802,
		reachedOutputLimit: true,
	});
	assert.equal(observations[0].data.nativeFinishReason, null);
	const dispatches = journal.filter((e) => e.type === "generation-dispatch");
	assert.equal(dispatches.length, 2);
	for (let i = 0; i < dispatches.length; i++)
		assert.equal(hash(f.sent[i]), dispatches[i].data.requestHash);
});

test("field limit numbers match schema and feedback; runtime enforces unchanged UTF-16 boundaries", async () => {
	for (const [field, text, accepted] of [
		["explanation", "x".repeat(6000), true],
		["explanation", "x".repeat(6001), false],
		["explanation", "x".repeat(6904), false],
		["explanation", "😀".repeat(3000), true],
		["explanation", "😀".repeat(3001), false],
		["snippet", "x".repeat(32000), true],
		["snippet", "x".repeat(32001), false],
	]) {
		const request = {
			op: "submit",
			snippet: "export {};",
			explanation: "synthetic",
			concepts: { read: [], required: [], firstExpansion: null },
			[field]: text,
		};
		const f = fake([[request]]);
		const { result, journal } = await run(f, g, {
			mode: "entry",
			files: {},
			now: () => 0,
		});
		assert.equal(f.sent.length, 1);
		const payload = f.sent[0],
			feedback = JSON.parse(payload.messages.at(-1).content);
		const submit =
			payload.tools[0].function.parameters.properties.requests.items.anyOf.find(
				(s) => s.properties.op.enum.includes("submit"),
			);
		for (const key of ["snippet", "explanation"])
			assert.equal(
				feedback.answerLimits[key],
				submit.properties[key].maxLength,
			);
		assert.equal(feedback.answerLimits.snippet, 32000);
		assert.equal(feedback.answerLimits.explanation, 6000);
		assert.match(feedback.answerLimits.unit, /UTF-16/);
		assert.equal(result.entryStatus, accepted ? "submitted" : "missing");
		if (!accepted) assert.equal(result.fatal, "bounded entry answer required");
		assert.equal(
			journal.find((e) => e.type === "entry-answer-lengths").data.lengths[
				field
			],
			text.length,
		);
	}
});

test("rebuilt final request reports its actual output cap in admitted payload", async () => {
	const f = fake(
		[
			[{ op: "read", path: "entry/task.json" }],
			[{ op: "read", path: "entry/task.json" }],
			[
				{
					op: "submit",
					snippet: "export {};",
					explanation: "synthetic",
					concepts: { read: [], required: [], firstExpansion: null },
				},
			],
		],
		(x) => x,
		300000,
	);
	const { result, journal } = await run(f, g, {
		mode: "entry",
		files: {},
		now: () => 0,
	});
	assert.equal(result.entryStatus, "submitted");
	for (const p of f.sent)
		assert.equal(
			JSON.parse(p.messages.at(-1).content).currentRequest.maxOutputTokens,
			p.max_tokens,
		);
	const final = journal.filter((e) => e.type === "generation-dispatch").at(-1)
		.data.payload;
	assert.equal(final.max_tokens, 4096);
	assert.equal(JSON.parse(final.messages.at(-1).content).stage, "submit-only");
	assert.equal(result.turns, 3);
});

test("transport diagnostics distinguish fetch failure, HTTP429 and caller abort without changing retries", async () => {
	const error = new TypeError("fetch failed", {
		cause: Object.assign(new Error("secret socket URL"), {
			code: "ECONNRESET",
			address: "private-host",
		}),
	});
	const f = recovering([error]);
	const p = payload();
	await f.t.estimate(p);
	const out = await f.t.create(p, options());
	const d = out.attempts[0].transportDiagnostics;
	assert.equal(d.phase, "awaiting-response-headers");
	assert.equal(d.httpStatus, null);
	assert.equal(d.abortSource, null);
	assert.equal(d.errorChain[1].code, "ECONNRESET");
	assert.ok(d.elapsedMs >= 0);
	assert.equal(d.attemptTimeoutMs, 60000);
	assert.equal(JSON.stringify(d).includes("secret"), false);
	assert.equal(JSON.stringify(d).includes("private-host"), false);
	assert.equal(f.seen.length, 2);
	assert.deepEqual(f.waits, [60000]);
	const h = recovering([busyResponse()]);
	await h.t.estimate(p);
	const hr = await h.t.create(p, options());
	assert.equal(hr.attempts[0].transportDiagnostics.httpStatus, 429);
	assert.equal(
		hr.attempts[0].transportDiagnostics.phase,
		"processing-response",
	);
	const abort = new AbortController();
	const c = recovering([
		() => {
			abort.abort(new Error("private cancellation"));
			throw abort.signal.reason;
		},
	]);
	await c.t.estimate(p);
	await assert.rejects(c.t.create(p, { signal: abort.signal }));
	const cd = c.events.find((e) => e.type === "provider-attempt-failed").data
		.transportDiagnostics;
	assert.equal(cd.abortSource, "caller");
	assert.equal(cd.attemptTimeoutFired, false);
	assert.equal(c.seen.length, 1);
	assert.equal(c.waits.length, 0);
	assert.equal(JSON.stringify(cd).includes("private cancellation"), false);
});

test("diagnostic error chains are bounded, allowlisted, cycle-safe and do not invoke accessors", () => {
	const secret = "sk-secret-sentinel";
	const socket = Object.assign(new Error(secret), {
		code: "UND_ERR_SOCKET",
		stack: secret,
	});
	const aggregate = new AggregateError(
		[socket, Object.assign(new Error(secret), { code: secret })],
		secret,
	);
	const outer = new TypeError("fetch failed", { cause: aggregate });
	socket.cause = outer;
	const chain = transportErrorChain(outer);
	assert.equal(chain.length, 4);
	assert.equal(chain[2].code, "UND_ERR_SOCKET");
	assert.equal(chain[3].code, null);
	assert.equal(JSON.stringify(chain).includes(secret), false);
	const hostile = {};
	for (const key of ["code", "name", "cause", "errors"])
		Object.defineProperty(hostile, key, {
			get() {
				throw Error("getter executed");
			},
		});
	assert.doesNotThrow(() => transportErrorChain(hostile));
	let deep = new Error();
	for (let i = 0; i < 100; i++) deep = new Error("secret", { cause: deep });
	assert.equal(transportErrorChain(deep).length, 5);
	assert.ok(
		transportErrorChain(
			new AggregateError(
				Array.from({ length: 100 }, () => new Error()),
				"secret",
			),
		).length <= 8,
	);
	const revoked = Proxy.revocable([], {});
	revoked.revoke();
	assert.doesNotThrow(() => transportErrorChain({ errors: revoked.proxy }));
});

test("B121 disables HTTP persistence on original and retry attempts without changing body or abort signal", async () => {
	const captured = [];
	const f = recovering([], {
		fetchImpl: async (_url, opts) => {
			captured.push(opts);
			if (captured.length === 1)
				throw Object.assign(new TypeError("fetch failed"), {
					cause: Object.assign(new Error(), { code: "UND_ERR_SOCKET" }),
				});
			return http(JSON.stringify(body(null, [{ op: "list" }])));
		},
	});
	const p = payload();
	await f.t.estimate(p);
	const result = await f.t.create(p, options());
	assert.equal(captured.length, 2);
	assert.equal(captured[0].body, captured[1].body);
	for (const opts of captured) {
		assert.equal(opts.headers.connection, "close");
		assert.equal(opts.headers.authorization, "Bearer fake");
		assert.ok(opts.signal instanceof AbortSignal);
		assert.equal(opts.method, "POST");
		assert.equal(opts.redirect, "error");
	}
	assert.deepEqual(f.waits, [60000]);
	assert.equal(
		result.attempts[0].transportDiagnostics.connectionPolicy,
		CONNECTION_POLICY,
	);
	assert.ok(
		f.events
			.filter((e) => e.type === "provider-attempt-request")
			.every((e) => e.data.connectionPolicy === CONNECTION_POLICY),
	);
	const input = {
		headers: new Headers({
			Connection: "keep-alive",
			authorization: "test-only",
		}),
		body: "original",
		signal: new AbortController().signal,
	};
	const changed = nonPersistentRequestOptions(input);
	assert.equal(input.headers.get("connection"), "keep-alive");
	assert.equal(changed.headers.connection, "close");
	assert.equal(changed.signal, input.signal);
	assert.equal(changed.body, input.body);
});

test("participant can spend one operation to unlock the reserved submission response", async () => {
	const submit = {
		op: "submit",
		snippet: "export {};",
		explanation: "synthetic",
		concepts: { read: [], required: [], firstExpansion: null },
	};
	const f = fake(
		[
			[{ op: "read", path: "entry/task.json" }],
			[{ op: "prepare_submit" }],
			[submit],
		],
		(b, i) =>
			i === 1
				? {
						...b,
						usage: {
							...b.usage,
							completion_tokens: 2661,
							total_tokens: 2761,
							cost: maximumCost(100, 2661),
						},
					}
				: b,
	);
	const { result, journal } = await run(f, g, {
		mode: "entry",
		files: {},
		now: () => 0,
	});
	assert.equal(result.entryStatus, "submitted");
	assert.equal(result.operations, 3);
	assert.equal(result.turns, 3);
	assert.equal(f.sent[1].max_tokens, 1243);
	assert.equal(f.sent[2].max_tokens, 4096);
	assert.equal(
		JSON.parse(f.sent[2].messages.at(-1).content).stage,
		"submit-only",
	);
	assert.equal(
		journal.filter((e) => e.type === "entry-finalization").length,
		1,
	);
	assert.equal(
		journal.find((e) => e.type === "entry-finalization").data.reason,
		"participant-request",
	);
	assert.equal(result.usage.outputTokens, 2701);
});

test("prepare_submit rejects batched work or answer fields before applying operations", async () => {
	for (const requests of [
		[{ op: "prepare_submit" }, { op: "list" }],
		[{ op: "prepare_submit", snippet: "export {};" }],
	]) {
		const f = fake([requests]);
		const { result, journal } = await run(f, g, {
			mode: "entry",
			files: {},
			now: () => 0,
		});
		assert.match(result.fatal, /prepare_submit must/);
		assert.equal(result.operations, 0);
		assert.equal(
			journal.filter((e) => e.type === "entry-finalization").length,
			0,
		);
	}
});

test("participant submission transition cannot be repeated or used to retrieve again", async () => {
	for (const next of [{ op: "prepare_submit" }, { op: "list" }]) {
		const f = fake([[{ op: "prepare_submit" }], [next]]);
		const { result } = await run(f, g, {
			mode: "entry",
			files: {},
			now: () => 0,
		});
		assert.match(result.fatal, /submit-only/);
		assert.equal(result.operations, 1);
		assert.equal(result.turns, 2);
	}
});

test("participant submission transition cannot bypass subsequent input admission", async () => {
	const f = fake([[{ op: "prepare_submit" }]]);
	let estimates = 0;
	const transport = {
		...f,
		estimate: async (p) => {
			estimates++;
			return {
				kind: "local-input-estimate",
				inputTokens: estimates === 1 ? 100 : 1000001,
			};
		},
	};
	const { result, journal } = await run(transport, g, {
		mode: "entry",
		files: {},
		now: () => 0,
	});
	assert.equal(result.turns, 1);
	assert.equal(result.operations, 1);
	assert.equal(result.entryStatus, "missing");
	assert.equal(
		journal.filter((e) => e.type === "generation-dispatch").length,
		1,
	);
	assert.equal(
		journal.find((e) => e.type === "budget-stop").data.reason,
		"input-estimate-exceeds-remaining",
	);
});
