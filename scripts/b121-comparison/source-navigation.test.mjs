import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { prepareBundle } from "./api-prepare.mjs";
import { buildSourceNavigation } from "./source-navigation.mjs";

const digest = (s) => createHash("sha256").update(s).digest("hex");
test("source-only navigation maps full declarations and members across chunk boundaries", () => {
	const content =
		"// function decoy() {}\n" +
		"\n".repeat(76) +
		'export class Sample {\n method() {\n  const hidden = "fake declaration";\n  return hidden;\n }\n}\nexport const value=1;';
	const input = {
		path: "sample.ts",
		content,
		sha256: digest(content),
		prefix: "entry/source0",
	};
	const result = buildSourceNavigation(input);
	assert.deepEqual(result, buildSourceNavigation(input));
	assert.deepEqual(
		result.symbols.map((s) => s.name),
		["Sample", "Sample.method", "value"],
	);
	const method = result.symbols.find((s) => s.name === "Sample.method");
	assert.equal(method.start, 79);
	assert.equal(method.end, 82);
	assert.equal(Math.floor((method.start - 1) / 80), 0);
	assert.equal(Math.floor((method.end - 1) / 80), 1);
	assert.throws(
		() => buildSourceNavigation({ ...input, content: content + "x" }),
		/hash mismatch/,
	);
	const invalid = "export class {";
	assert.throws(
		() =>
			buildSourceNavigation({
				...input,
				content: invalid,
				sha256: digest(invalid),
			}),
		/parse failed/,
	);
});
test("every participant navigation file is reproducible from supplied source only and remains entry-only", () => {
	const bundle = prepareBundle();
	const maps = [];
	for (const subject of bundle.entrySlots) {
		const task = JSON.parse(subject.entryFiles["entry/task.json"]);
		const map = {};
		task.sourceIndex.forEach((item, n) => {
			const content = Array.from({ length: item.chunks }, (_, c) =>
				subject.entryFiles[`entry/source${n}/chunk${c}.txt`]
					.split("\n")
					.slice(1)
					.map((l) => l.replace(/^\d+: /, ""))
					.join("\n"),
			).join("\n");
			const expected = buildSourceNavigation({
				path: item.path,
				content,
				sha256: item.sha256,
				prefix: `entry/source${n}`,
			});
			assert.deepEqual(
				JSON.parse(subject.entryFiles[`entry/navigation/source${n}.json`]),
				expected,
			);
			assert.ok(
				expected.symbols.every(
					(s) =>
						s.start >= 1 && s.end >= s.start && s.end <= expected.lineCount,
				),
			);
			map[`entry/navigation/source${n}.json`] =
				subject.entryFiles[`entry/navigation/source${n}.json`];
		});
		maps.push(map);
	}
	for (const map of maps) assert.deepEqual(map, maps[0]);
	assert.ok(
		bundle.slots.every((s) =>
			Object.keys(s.files).every((p) => !p.startsWith("entry/")),
		),
	);
});
