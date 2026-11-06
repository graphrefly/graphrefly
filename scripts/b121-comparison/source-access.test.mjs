import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createSourceAccess, SOURCE_LIMITS } from "./source-access.mjs";

function fixture(items) {
	const files = {
		"goldens.json": "HIDDEN_ORACLE",
		"entry/navigation/source0.json": "HIDDEN_INDEX",
	};
	const sourceIndex = Object.entries(items).map(([path, content], n) => {
		const lines = content.split("\n");
		for (let i = 0; i < lines.length; i += 80)
			files[`entry/source${n}/chunk${i / 80}.txt`] =
				path +
				"\n" +
				lines
					.slice(i, i + 80)
					.map((l, k) => `${i + k + 1}: ${l}`)
					.join("\n");
		return {
			path,
			sha256: createHash("sha256").update(content).digest("hex"),
			chunks: Math.ceil(lines.length / 80),
		};
	});
	files["entry/task.json"] = JSON.stringify({ sourceIndex });
	return files;
}
const search = (extra = {}) => ({
	op: "search",
	query: "needle",
	pathPrefix: "",
	caseSensitive: true,
	offset: 0,
	limit: 2,
	...extra,
});
test("literal search paginates deterministically and does not expose other frozen entries", () => {
	const a = createSourceAccess(
		fixture({
			"z.ts": "needle\nNeedle",
			"a.ts": "x needle\nneedle\n.[*] literal",
		}),
	);
	const first = a.request(search());
	assert.deepEqual(
		first.matches.map((m) => [m.path, m.line]),
		[
			["a.ts", 1],
			["a.ts", 2],
		],
	);
	assert.equal(first.totalMatches, 3);
	assert.equal(first.nextOffset, 2);
	const second = a.request(search({ offset: 2 }));
	assert.deepEqual(
		second.matches.map((m) => [m.path, m.line]),
		[["z.ts", 1]],
	);
	assert.equal(second.nextOffset, null);
	assert.equal(a.request(search({ caseSensitive: false })).totalMatches, 4);
	assert.equal(a.request(search({ query: ".[*]" })).totalMatches, 1);
	assert.equal(a.request(search({ query: "HIDDEN" })).totalMatches, 0);
	assert.deepEqual(a.request({ op: "list" }).paths, [
		"entry/task.json",
		"a.ts",
		"z.ts",
	]);
	for (const path of [
		"goldens.json",
		"entry/navigation/source0.json",
		"entry/source0/chunk0.txt",
		"../../a.ts",
		"/a.ts",
		["a.ts"],
		null,
		"__proto__",
	])
		assert.throws(() => a.request({ op: "read", path }), /unavailable/);
});
test("source range preserves exact line numbers, Unicode and EOF; pagination remains bounded", () => {
	const a = createSourceAccess(
		fixture({
			"a.ts": Array.from(
				{ length: 100 },
				(_, i) => `${i} 中文 ${"x".repeat(210)}`,
			).join("\n"),
		}),
	);
	const first = a.request({
		op: "read",
		path: "a.ts",
		startLine: 1,
		endLine: 80,
	});
	assert.ok(
		Buffer.byteLength(JSON.stringify(first)) <= SOURCE_LIMITS.resultBytes,
	);
	assert.ok(first.nextLine > 1 && first.nextLine <= 80);
	const next = a.request({
		op: "read",
		path: "a.ts",
		startLine: first.nextLine,
		endLine: 80,
	});
	assert.equal(next.lines[0].line, first.endLine + 1);
	const eof = a.request({
		op: "read",
		path: "a.ts",
		startLine: 100,
		endLine: 110,
	});
	assert.equal(eof.endLine, 100);
	assert.equal(eof.nextLine, null);
	assert.ok(eof.lines[0].text.includes("中文"));
	for (const [startLine, endLine] of [
		[0, 1],
		[2, 1],
		[101, 101],
		[1.5, 3],
		[NaN, 3],
		[1, Infinity],
	])
		assert.equal(
			a.request({ op: "read", path: "a.ts", startLine, endLine }).error
				.recoverable,
			true,
		);
});
test("search rejects invalid requests, bounds long snippets and permits empty results", () => {
	const a = createSourceAccess(
		fixture({ "a.ts": "x".repeat(20000) + "needle" + "y".repeat(20000) }),
	);
	const found = a.request(search());
	assert.equal(found.matches[0].textTruncated, true);
	assert.ok(found.matches[0].text.includes("needle"));
	assert.ok(Buffer.byteLength(JSON.stringify(found)) < 12000);
	assert.equal(
		a.request({ op: "read", path: "a.ts", startLine: 1, endLine: 1 }).error
			.recoverable,
		true,
	);
	assert.equal(a.request(search({ query: "missing" })).nextOffset, null);
	for (const extra of [
		{ query: "" },
		{ query: "x".repeat(201) },
		{ query: "a\nb" },
		{ offset: -1 },
		{ offset: 2 },
		{ offset: 0.5 },
		{ limit: 21 },
		{ limit: 0 },
		{ caseSensitive: "false" },
		{ extra: true },
	])
		assert.equal(a.request(search(extra)).error.recoverable, true);
	assert.throws(() => a.request(search({ pathPrefix: "../" })), /unavailable/);
});
test("frozen hash and line drift are controller errors rather than silent reindexing", () => {
	const f = fixture({ "a.ts": "line1\nline2" });
	f["entry/source0/chunk0.txt"] += "x";
	assert.throws(() => createSourceAccess(f), /hash mismatch/);
	const g = fixture({ "a.ts": "line1\nline2" });
	g["entry/source0/chunk0.txt"] = g["entry/source0/chunk0.txt"].replace(
		"2:",
		"9:",
	);
	assert.throws(() => createSourceAccess(g), /line mismatch/);
});

test("default and oversized pages remain capped with explicit continuation", () => {
	const a = createSourceAccess(
		fixture({
			"a.ts": Array.from({ length: 200 }, (_, i) => `line ${i + 1}`).join("\n"),
		}),
	);
	for (const raw of [
		{ op: "read", path: "a.ts" },
		{ op: "read", path: "a.ts", startLine: null, endLine: null },
		{ op: "read", path: "a.ts", startLine: 1, endLine: 130 },
	]) {
		const r = a.request(raw);
		assert.equal(r.ok, true);
		assert.equal(r.lines.length, 80);
		assert.equal(r.startLine, 1);
		assert.equal(r.endLine, 80);
		assert.equal(r.nextLine, 81);
	}
	const r = a.request({
		op: "read",
		path: "a.ts",
		startLine: 80,
		endLine: 160,
	});
	assert.equal(r.endLine, 159);
	assert.equal(r.nextLine, 160);
	assert.equal(r.lines.length, 80);
	const last = a.request({
		op: "read",
		path: "a.ts",
		startLine: 160,
		endLine: null,
	});
	assert.equal(last.endLine, 200);
	assert.equal(last.nextLine, null);
});

test("each range bound may be omitted independently for natural page continuation", () => {
	const a = createSourceAccess(
		fixture({
			"a.ts": Array.from({ length: 180 }, (_, i) => `line ${i + 1}`).join("\n"),
		}),
	);
	const first = a.request({ op: "read", path: "a.ts" });
	const next = a.request({
		op: "read",
		path: "a.ts",
		startLine: first.nextLine,
	});
	assert.equal(next.ok, true);
	assert.equal(next.startLine, 81);
	assert.equal(next.endLine, 160);
	assert.equal(next.nextLine, 161);
	const last = a.request({
		op: "read",
		path: "a.ts",
		startLine: next.nextLine,
	});
	assert.equal(last.nextLine, null);
	assert.equal(last.endLine, 180);
	const head = a.request({ op: "read", path: "a.ts", endLine: 3 });
	assert.equal(head.startLine, 1);
	assert.equal(head.endLine, 3);
	assert.equal(head.nextLine, null);
});

test("unmatched search prefix is recoverable and broad retry finds only frozen sources", () => {
	const a = createSourceAccess(
		fixture({ "packages/ts/src/graph/graph.ts": "export class Graph {}" }),
	);
	const bad = a.request(
		search({
			pathPrefix: "packages/ts/src/solutions/causal-occurrence/contracts.ts",
		}),
	);
	assert.equal(bad.ok, false);
	assert.equal(bad.error.recoverable, true);
	assert.match(bad.error.message, /No frozen source/);
	const good = a.request(search({ query: "Graph", pathPrefix: "" }));
	assert.equal(good.ok, true);
	assert.ok(good.totalMatches > 0);
});
