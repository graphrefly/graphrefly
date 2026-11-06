import assert from "node:assert/strict";
import test from "node:test";
import {
	ENTRY_TOOL,
	ParticipantOutputError,
	parseBrokerArguments,
	TOOL,
} from "./api-tool.mjs";

// Independent validator for the JSON Schema keywords emitted by this tool contract.
function accepts(schema, value) {
	if (schema.anyOf) return schema.anyOf.some((s) => accepts(s, value));
	const types = Array.isArray(schema.type) ? schema.type : [schema.type];
	const type =
		value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
	if (
		!(
			types.includes(type) ||
			(types.includes("integer") && Number.isInteger(value))
		)
	)
		return false;
	if (
		type === "number" &&
		((schema.minimum !== undefined && value < schema.minimum) ||
			(schema.maximum !== undefined && value > schema.maximum))
	)
		return false;
	if (schema.enum && !schema.enum.includes(value)) return false;
	if (
		type === "string" &&
		schema.maxLength !== undefined &&
		[...value].length > schema.maxLength
	)
		return false;
	if (type === "object")
		return (
			schema.required.every((k) => Object.hasOwn(value, k)) &&
			Object.keys(value).every(
				(k) =>
					Object.hasOwn(schema.properties, k) &&
					accepts(schema.properties[k], value[k]),
			)
		);
	if (type === "array")
		return (
			(schema.minItems === undefined || value.length >= schema.minItems) &&
			(schema.maxItems === undefined || value.length <= schema.maxItems) &&
			value.every((v) => accepts(schema.items, v))
		);
	return true;
}
test("serialized broker schema constrains nested operations without exposing future evidence", () => {
	const schema = JSON.parse(JSON.stringify(TOOL)).function.parameters;
	const fields = Object.fromEntries(
		[
			"implementationChanged",
			"topologyChanged",
			"consequence",
			"uncertainty",
			"effectNow",
			"lifecycleEnded",
			"author",
		].map((k) => [k, { value: "unknown", citations: [] }]),
	);
	const good = [
		{ op: "list" },
		{ op: "read", path: "orientation.json" },
		{ op: "submit", phase: "A", scenario: "C1", fields, explanation: "x" },
		{
			op: "submit",
			snippet: "",
			explanation: "x",
			concepts: { read: [], required: [], firstExpansion: null },
		},
	];
	assert.ok(accepts(schema, { requests: good }));
	for (const requests of [
		JSON.stringify(good),
		[],
		[{ tool: "read_file", path: "README.md" }],
		[{ op: "read", path: 3 }],
		[{ op: "list", path: "x" }],
		[{ ...good[2], phase: "entry" }],
		[{ ...good[2], fields: {} }],
		[
			{
				...good[3],
				concepts: {
					read: ["unknown-concept"],
					required: [],
					firstExpansion: null,
				},
			},
		],
		Array(17).fill(good[0]),
	])
		assert.equal(accepts(schema, { requests }), false);
	assert.deepEqual(
		parseBrokerArguments(JSON.stringify({ requests: good })),
		good,
	);
	for (const value of [
		"{",
		"null",
		"[]",
		JSON.stringify({ requests: JSON.stringify(good) }),
		JSON.stringify({ requests: good, extra: true }),
	])
		assert.throws(() => parseBrokerArguments(value), ParticipantOutputError);
});

test("entry tool schema exposes bounded retrieval but no comparison submission", () => {
	const schema = ENTRY_TOOL.function.parameters;
	const requests = [
		{ op: "read", path: "entry/task.json" },
		{ op: "read", path: "x.ts", startLine: 1, endLine: 30 },
		{
			op: "search",
			query: "value",
			pathPrefix: "",
			caseSensitive: true,
			offset: 0,
			limit: 5,
		},
	];
	assert.ok(accepts(schema, { requests }));
	for (const r of [
		{ ...requests[2], limit: 21 },
		{ ...requests[2], offset: 0.5 },
		{ ...requests[1], startLine: 0 },
		{ op: "read", path: 7 },
	])
		assert.equal(accepts(schema, { requests: [r] }), false);
});

test("entry schema permits independent bounds and defaults", () => {
	for (const request of [
		{ op: "read", path: "a.ts" },
		{ op: "read", path: "a.ts", startLine: 81 },
		{ op: "read", path: "a.ts", endLine: 20 },
		{ op: "read", path: "a.ts", startLine: null, endLine: null },
	])
		assert.ok(accepts(ENTRY_TOOL.function.parameters, { requests: [request] }));
});
