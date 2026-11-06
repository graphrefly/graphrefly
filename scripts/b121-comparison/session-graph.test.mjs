import test from "node:test";
import assert from "node:assert/strict";
import { runSession } from "./api-runner.mjs";
import { prepareBundle } from "./api-prepare.mjs";
import { ROUTE, maximumCost } from "./api-provider.mjs";
import { createGraphContext } from "../../../graphrefly-ts/packages/ts/evals/b121/graph-runtime.mjs";

const options = {
	slot: { id: "graph-entry-test", arm: "G", role: "ordinary" },
	mode: "entry",
	files: {},
	entryFiles: prepareBundle().entrySlots[0].entryFiles,
};
const answer = {
	op: "submit",
	snippet: "export const x=1;",
	explanation: "synthetic",
	concepts: { read: [], required: [], firstExpansion: null },
};
function transport() {
	let calls = 0;
	return {
		get calls() {
			return calls;
		},
		estimate: async () => ({ kind: "local-input-estimate", inputTokens: 100 }),
		create: async () => {
			calls++;
			return {
				body: {
					id: `r${calls}`,
					model: ROUTE.model,
					provider: ROUTE.provider,
					usage: {
						prompt_tokens: 100,
						completion_tokens: 20,
						total_tokens: 120,
						cost: maximumCost(100, 20),
					},
					choices: [
						{
							finish_reason: "tool_calls",
							message: {
								role: "assistant",
								content: null,
								tool_calls: [
									{
										id: `c${calls}`,
										type: "function",
										function: { name: "broker", arguments: JSON.stringify({ requests: [answer] }) },
									},
								],
							},
						},
					],
				},
			};
		},
	};
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("Graph waits for exact durable generation acknowledgement before any HTTP", async () => {
	const t = transport();
	let release,
		requested = false;
	const promise = runSession({
		...options,
		transport: t,
		journal: (event) => {
			if (event.type === "generation-dispatch") {
				requested = true;
				return new Promise((resolve) => {
					release = resolve;
				});
			}
		},
	});
	for (let i = 0; i < 100 && !requested; i++) await tick();
	assert.equal(requested, true);
	assert.equal(t.calls, 0);
	release();
	const result = await promise;
	assert.equal(result.entryStatus, "submitted");
	assert.equal(t.calls, 1);
});

test("asynchronous write-ahead rejection stops before HTTP", async () => {
	const t = transport();
	await assert.rejects(
		runSession({
			...options,
			transport: t,
			journal: async (event) => {
				if (event.type === "generation-dispatch") throw Error("disk failed before HTTP");
			},
		}),
		/disk failed before HTTP/,
	);
	assert.equal(t.calls, 0);
});

test("session cannot resolve complete before terminal persistence acknowledgement", async () => {
	const t = transport();
	let release,
		reached = false,
		completed = false;
	const promise = runSession({
		...options,
		transport: t,
		journal: (event) => {
			if (event.type === "finished") {
				reached = true;
				return new Promise((resolve) => {
					release = resolve;
				});
			}
		},
	}).then((result) => {
		completed = true;
		return result;
	});
	for (let i = 0; i < 100 && !reached; i++) await tick();
	assert.equal(reached, true);
	assert.equal(completed, false);
	release();
	assert.equal((await promise).entryStatus, "submitted");
});

test("removing the actual Graph input budget edge rejects before any provider work", async () => {
	const graphContext = createGraphContext({ name: "mutation" });
	const original = graphContext.graph.node.bind(graphContext.graph);
	graphContext.graph.node = (deps, fn, opts) =>
		original(opts?.name.endsWith("/input-budget-admission") ? [] : deps, fn, opts);
	const t = transport();
	await assert.rejects(
		runSession({ ...options, graphContext, transport: t, journal: () => {} }),
		/topology dependency drift/,
	);
	assert.equal(t.calls, 0);
	graphContext.dispose();
});

test("Graph describe and observations are real and do not expose participant contents", async () => {
	const events = [];
	const t = transport();
	const result = await runSession({ ...options, transport: t, journal: (e) => events.push(e) });
	assert.equal(result.fatal, null);
	const topology = events.find((e) => e.type === "session-topology").data;
	assert.ok(topology.nodes.some((n) => n.id.endsWith("/input-budget-admission")));
	assert.ok(topology.nodes.some((n) => n.id.endsWith("/persisted-request-admission")));
	const observations = events.filter((e) => e.type === "graph-observation");
	assert.ok(observations.some((e) => e.data.message === "DATA"));
	assert.ok(!JSON.stringify(observations).includes(answer.snippet));
	const seq = observations.map((e) => e.data.seq);
	assert.equal(new Set(seq).size, seq.length);
});
