import assert from "node:assert/strict";
import test from "node:test";
import { createGraphContext } from "../../../graphrefly-ts/packages/ts/evals/b121/graph-runtime.mjs";
import { CONFIG, TOOL } from "./api-runner.mjs";
import {
	CEILING_USD,
	MAX_GENERATION_CALLS,
	maximumCost,
	ROUTE,
} from "./api-provider.mjs";
import {
	createOpenRouterTransport,
	qualifyProvider,
	QUALIFICATION_READS,
	QUALIFICATION_SUBMISSIONS,
	RETRY_POLICY,
} from "./api-transport.mjs";

const approval = {
	manifestSHA: "graph-test",
	action: "B121-agent-api-one-shot",
	acceptAliasLimitation: true,
	acceptInputEstimateLimitation: true,
	expiresAt: "2099-01-01",
	maxGenerationCalls: MAX_GENERATION_CALLS,
	maxUSD: CEILING_USD,
	retries: RETRY_POLICY,
	model: ROUTE.model,
	providerTag: ROUTE.tag,
};
const payload = () => ({
	...structuredClone(CONFIG),
	tools: [TOOL],
	tool_choice: { type: "function", function: { name: "broker" } },
	messages: [{ role: "user", content: "PRIVATE_MATERIAL" }],
	max_tokens: 512,
});
const success = () => ({
	id: "response1",
	model: ROUTE.model,
	provider: ROUTE.provider,
	usage: {
		prompt_tokens: 10,
		completion_tokens: 10,
		total_tokens: 20,
		cost: maximumCost(10, 10),
		completion_tokens_details: { reasoning_tokens: 0 },
	},
	choices: [
		{
			finish_reason: "tool_calls",
			message: {
				role: "assistant",
				content: null,
				tool_calls: [
					{
						type: "function",
						id: "tool1",
						function: {
							name: "broker",
							arguments: JSON.stringify({ requests: [{ op: "list" }] }),
						},
					},
				],
			},
		},
	],
});
function response(body = success(), status = 200) {
	const result = new Response(JSON.stringify(body), { status });
	Object.defineProperty(result, "url", { value: ROUTE.endpoint });
	return result;
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
function transport(extra = {}) {
	return createOpenRouterTransport({
		apiKey: "FAKE_PRIVATE_KEY",
		approval,
		manifestSHA: "graph-test",
		journal: () => {},
		sleepImpl: async () => {},
		fetchImpl: async () => response(),
		...extra,
	});
}

test("all provider calls require a write-ahead journal even when retries are disabled", () => {
	assert.throws(
		() =>
			transport({ approval: { ...approval, retries: 0 }, journal: undefined }),
		/durable provider journal/,
	);
});

test("exact write-ahead acknowledgement gates HTTP; optional observation failure has no authority", async () => {
	const graphContext = createGraphContext({ name: "shared-campaign" }),
		observations = [];
	let release,
		fetches = 0;
	const gate = new Promise((resolve) => {
		release = resolve;
	});
	const t = transport({
		graphContext,
		fetchImpl: async () => {
			fetches++;
			return response();
		},
		journal: (event) => {
			if (event.type === "graph-observation") {
				observations.push(event);
				throw Error("optional diagnostic unavailable");
			}
			if (event.type === "provider-attempt-request") return gate;
		},
	});
	assert.equal(t.graph, graphContext.graph);
	await t.estimate(payload());
	const pending = t.create(payload());
	await tick();
	assert.equal(fetches, 0);
	assert.equal(t.snapshot().generationCalls, 0);
	release();
	await pending;
	assert.equal(fetches, 1);
	assert.equal(t.snapshot().generationCalls, 1);
	assert.ok(
		observations.some((event) => event.data.path.endsWith("/budget-admission")),
	);
	assert.ok(
		observations.some((event) =>
			event.data.path.endsWith("/exact-http-admission"),
		),
	);
	assert.ok(
		observations.every((event) => !JSON.stringify(event).includes("PRIVATE")),
	);
	assert.ok(
		t.graph
			.describe()
			.edges.some(
				(edge) =>
					edge.to.endsWith("/write-ahead-request") &&
					edge.from.endsWith("/budget-admission"),
			),
	);
	await t.dispose();
	graphContext.dispose();
});

test("asynchronous write-ahead failure rejects before any HTTP or reserve", async () => {
	let fetches = 0;
	const t = transport({
		fetchImpl: async () => {
			fetches++;
			return response();
		},
		journal: async (event) => {
			if (event.type === "provider-attempt-request")
				throw Error("durable write rejected");
		},
	});
	await t.estimate(payload());
	await assert.rejects(t.create(payload()), /durable write rejected/);
	assert.equal(fetches, 0);
	assert.equal(t.snapshot().reservedUSD, 0);
	assert.equal(t.snapshot().stopped, true);
	await t.dispose();
});

test("real dependency deletion rejects transport construction before any provider effect", () => {
	for (const suffix of [
		"/budget-admission",
		"/write-ahead-request",
		"/exact-http-admission",
		"/retry-admission",
		"/retry-write-ahead",
		"/exact-delay-admission",
	]) {
		const context = createGraphContext(),
			derived = context.graph.derived.bind(context.graph);
		context.graph.derived = (deps, fn, options) =>
			derived(options?.name.endsWith(suffix) ? [] : deps, fn, options);
		let fetches = 0;
		assert.throws(
			() =>
				transport({
					graphContext: context,
					fetchImpl: async () => {
						fetches++;
						return response();
					},
				}),
			/required control dependency missing/,
		);
		assert.equal(fetches, 0);
		context.dispose();
	}
});

test("unknown failure reserve survives exactly one Graph-admitted retry and settlement", async () => {
	let fetches = 0,
		waits = 0;
	const events = [];
	const t = transport({
		journal: (event) => events.push(event),
		sleepImpl: async () => {
			waits++;
		},
		fetchImpl: async () => {
			fetches++;
			if (fetches === 1) throw new TypeError("fetch failed");
			return response();
		},
	});
	await t.estimate(payload());
	const result = await t.create(payload());
	assert.equal(fetches, 2);
	assert.equal(waits, 1);
	assert.equal(result.attempts.length, 1);
	assert.equal(result.attempts[0].recoveryClass, "availability");
	assert.ok(
		Math.abs(
			t.snapshot().unknownReservedUSD - maximumCost(ROUTE.contextTokens, 512),
		) < 1e-9,
	);
	assert.equal(
		events.filter((event) => event.type === "provider-attempt-request").length,
		2,
	);
	assert.equal(
		events.filter((event) => event.type === "provider-retry-wait").length,
		1,
	);
	await t.dispose();
});

test("settlement persistence failure retains actual charges and stops without replay", async () => {
	let fetches = 0;
	const t = transport({
		fetchImpl: async () => {
			fetches++;
			return response();
		},
		journal: async (event) => {
			if (event.type === "provider-attempt-response")
				throw Error("settlement unavailable");
		},
	});
	await t.estimate(payload());
	await assert.rejects(
		t.create(payload()),
		(error) =>
			error.message === "settlement unavailable" &&
			error.envelope?.body.id === "response1" &&
			error.reportedUsage?.costUSD === maximumCost(10, 10),
	);
	assert.equal(fetches, 1);
	assert.equal(t.snapshot().reportedCostUSD, maximumCost(10, 10));
	assert.equal(t.snapshot().stopped, true);
	await t.dispose();
});

test("qualification generation depends on its real Graph request edge", async () => {
	const context = createGraphContext(),
		derived = context.graph.derived.bind(context.graph);
	context.graph.derived = (deps, fn, options) =>
		derived(
			options?.name.endsWith("/generation-admission") ? [] : deps,
			fn,
			options,
		);
	let calls = 0;
	await assert.rejects(
		qualifyProvider({
			graphContext: context,
			journal: () => {},
			transport: {
				estimate: async () => {
					calls++;
					return { inputTokens: 1 };
				},
				create: async () => {
					calls++;
					return {};
				},
			},
		}),
		/required control dependency missing/,
	);
	assert.equal(calls, 0);
	context.dispose();
});

test("real transport and qualification compose into one graph without repeated whole-graph observers", async () => {
	const context = createGraphContext(),
		observations = [];
	let calls = 0;
	const journal = (event) => {
		if (event.type === "graph-observation") observations.push(event);
	};
	const t = transport({
		graphContext: context,
		journal,
		fetchImpl: async () => {
			const index = calls++,
				body = success();
			body.id = `qualification-${index}`;
			const call = body.choices[0].message.tool_calls[0];
			call.id = `qualification-tool-${index}`;
			call.function.arguments = JSON.stringify({
				requests:
					index % 2 === 0
						? QUALIFICATION_READS[Math.floor(index / 2)]
						: QUALIFICATION_SUBMISSIONS[Math.floor(index / 2)],
			});
			return response(body);
		},
	});
	const out = await qualifyProvider({
		transport: t,
		journal,
		graphContext: context,
	});
	assert.equal(out.qualified, true);
	assert.equal(calls, 4);
	assert.ok(
		observations.length > 0 && observations.length < 1000,
		`unexpected observation amplification: ${observations.length}`,
	);
	const paths = context.graph.describe().nodes.map((node) => node.id);
	assert.ok(paths.some((path) => path.startsWith("provider/")));
	assert.ok(paths.some((path) => path.startsWith("qualification/")));
	await t.dispose();
	context.dispose();
});
