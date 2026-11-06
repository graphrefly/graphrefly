import assert from "node:assert/strict";
import test from "node:test";
import { auditMaterialCoverage } from "./material-coverage.mjs";
test("audits explicit material without expanding missing or restricted dependencies", () => {
	const files = {
		"example/README.md":
			"[entry](entry.ts) [missing](absent.md) [oracle](../fixtures/oracle.ts)",
		"example/entry.ts":
			'import {x} from "../lib/x.js"; export * from "../lib/absent.js"; import("../fixtures/oracle.js");',
		"lib/x.ts": "export const x=1;",
	};
	const before = JSON.stringify(files);
	const a = auditMaterialCoverage({
		files,
		entrypoints: ["example/README.md", "missing.md"],
	});
	assert.equal(JSON.stringify(files), before);
	assert.equal(a.executionReady, false);
	assert.deepEqual(
		a.references.map((x) => x.status),
		["included", "missing", "restricted", "included", "missing", "restricted"],
	);
	assert.equal(a.entrypoints[1].status, "missing");
	assert.equal(a.files.length, 3);
	assert.deepEqual(
		a,
		auditMaterialCoverage({
			files,
			entrypoints: ["example/README.md", "missing.md"],
		}),
	);
});
test("covers type imports, package imports, computed references, escape and ambiguous resolution", () => {
	const a = auditMaterialCoverage({
		files: {
			"a.ts":
				'type T=import("./b.js").T; import("pkg"); require(variable); export * from "../outside.js";',
			"b.ts": "export type T=1;",
			"b.js": "export const b=1;",
			"README.md":
				"[escape](%2e%2e/secret) [site](https://example.com) [ref][x]\n[x]: missing.md",
		},
	});
	assert.ok(a.references.some((x) => x.status === "ambiguous"));
	assert.ok(a.references.some((x) => x.status === "external"));
	assert.equal(
		a.references.filter((x) => x.status === "outside-root").length,
		2,
	);
	assert.ok(a.manualReview.some((x) => x.reason === "nonliteral reference"));
	assert.ok(a.references.some((x) => x.ref === "missing.md"));
	assert.throws(
		() => auditMaterialCoverage({ files: { "../escape.ts": "" } }),
		/invalid material/,
	);
});
test("included oracle/test files are surfaced and never considered executable readiness", () => {
	const a = auditMaterialCoverage({
		files: { "tests/answer.test.ts": "export const answer=42" },
		entrypoints: ["tests/answer.test.ts"],
	});
	assert.equal(a.files[0].restricted, true);
	assert.equal(a.entrypoints[0].status, "restricted");
	assert.equal(a.executionReady, false);
});

test("decoded absolute links, import equals and reference directives remain visible", () => {
	const a = auditMaterialCoverage({
		files: {
			"docs/a.md": "[x](%2Fsecret.md)",
			"docs/secret.md": "not root",
			"a.ts":
				'/// <reference path="./missing.d.ts" />\n/// <reference types="node" />\nimport X = require("./missing.cjs");',
		},
	});
	assert.equal(
		a.references.find((x) => x.ref === "%2Fsecret.md").status,
		"outside-root",
	);
	assert.equal(
		a.references.find((x) => x.ref === "./missing.cjs").status,
		"missing",
	);
	assert.equal(
		a.references.find((x) => x.ref === "./missing.d.ts").status,
		"missing",
	);
	assert.equal(a.references.find((x) => x.ref === "node").status, "external");
});
