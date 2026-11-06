import assert from "node:assert/strict";
import test from "node:test";
import { runCampaignGraph } from "../../../graphrefly-ts/packages/ts/evals/b121/campaign-control.mjs";
import { createGraphContext } from "../../../graphrefly-ts/packages/ts/evals/b121/graph-runtime.mjs";
const tick = () => new Promise((resolve) => setImmediate(resolve));
const samples = [{ sampleId: "a" }, { sampleId: "b" }];
const classify = () => ({ row: { status: "done" } });
const effects = () => ({
	qualification: async () => ({ qualified: true }),
	session: async ({ sample }) => ({ sampleId: sample.sampleId }),
	"result-persistence": async () => {},
	"final-persistence": async () => {},
});

test("campaign completion requires final persistence acknowledgement", async () => {
	let release,
		finalCollection,
		completed = false;
	const gate = new Promise((resolve) => {
		release = resolve;
	});
	const run = runCampaignGraph({
		name: "final-ack",
		samples,
		classify,
		journal: () => {},
		effects: {
			...effects(),
			"final-persistence": async ({ collection }) => {
				finalCollection = collection;
				await gate;
			},
		},
	}).then((value) => {
		completed = true;
		return value;
	});
	await tick();
	assert.equal(completed, false);
	assert.deepEqual(
		finalCollection.rows.map((row) => row.status),
		["done", "done"],
	);
	release();
	assert.deepEqual(
		(await run).rows.map((row) => row.status),
		["done", "done"],
	);
});

test("campaign write-ahead Promise must settle before qualification executes", async () => {
	let release,
		calls = 0;
	const gate = new Promise((resolve) => {
		release = resolve;
	});
	const run = runCampaignGraph({
		name: "write-ack",
		samples: [],
		classify,
		effects: {
			...effects(),
			qualification: async () => {
				calls++;
				return { qualified: true };
			},
		},
		journal: (event) =>
			event.type === "campaign-effect-admitted" &&
			event.data.kind === "qualification"
				? gate
				: undefined,
	});
	await tick();
	assert.equal(calls, 0);
	release();
	await run;
	assert.equal(calls, 1);
});

test("campaign asynchronous write-ahead failure refuses the effect and retains an error snapshot", async () => {
	let calls = 0;
	await assert.rejects(
		runCampaignGraph({
			name: "write-failure",
			samples,
			classify,
			effects: {
				...effects(),
				qualification: () => {
					calls++;
				},
			},
			journal: async (event) => {
				if (event.type === "campaign-effect-admitted")
					throw Error("durable write failed");
			},
		}),
		(error) =>
			error.message === "durable write failed" &&
			error.campaignSnapshot.rows.every((row) => row.status === "not-run"),
	);
	assert.equal(calls, 0);
});

test("later campaign write failure preserves earlier completed sample and interrupted active sample", async () => {
	await assert.rejects(
		runCampaignGraph({
			name: "late-write-failure",
			samples,
			classify,
			effects: effects(),
			journal: async (event) => {
				if (
					event.type === "campaign-effect-admitted" &&
					event.data.kind === "session" &&
					event.data.index === 1
				)
					throw Error("late durable failure");
			},
		}),
		(error) =>
			error.message === "late durable failure" &&
			error.campaignSnapshot.rows[0].status === "done" &&
			error.campaignSnapshot.rows[1].status === "interrupted",
	);
});

test("campaign final evidence failure cannot return successful completion", async () => {
	await assert.rejects(
		runCampaignGraph({
			name: "final-failure",
			samples,
			classify,
			journal: () => {},
			effects: {
				...effects(),
				"final-persistence": async () => {
					throw Error("summary failed");
				},
			},
		}),
		(error) =>
			error.message === "summary failed" &&
			error.campaignSnapshot.rows.every((row) => row.status === "done"),
	);
});

test("missing actual campaign dependency refuses startup before any external effect", () => {
	const context = createGraphContext(),
		node = context.graph.node.bind(context.graph);
	let calls = 0;
	context.graph.node = (deps, fn, options) =>
		node(
			options?.name.endsWith("/qualification-execution-admission") ? [] : deps,
			fn,
			options,
		);
	assert.throws(
		() =>
			runCampaignGraph({
				graphContext: context,
				name: "missing-edge",
				samples,
				classify,
				journal: () => {},
				effects: {
					...effects(),
					qualification: () => {
						calls++;
					},
				},
			}),
		/required campaign control dependency missing/,
	);
	assert.equal(calls, 0);
	context.dispose();
});

test("optional campaign observations cannot change collection or final persistence", async () => {
	let persisted = 0;
	const result = await runCampaignGraph({
		name: "diagnostic-failure",
		samples,
		classify,
		effects: {
			...effects(),
			"final-persistence": () => {
				persisted++;
			},
		},
		journal: (event) => {
			if (event.type === "graph-observation") throw Error("diagnostic only");
		},
	});
	assert.equal(result.failure, null);
	assert.equal(persisted, 1);
	assert.equal(result.rows.length, 2);
});
