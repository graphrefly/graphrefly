import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	claimProcess,
	runRecordedProcess,
	readProcessReceipt,
} from "./recorded-process.mjs";

async function withProcess(code, options, check) {
	const root = mkdtempSync(join(tmpdir(), "b121-process-test-")),
		directory = join(root, "attempt");
	try {
		claimProcess(directory, {
			sampleId: "synthetic",
			snippet: "retained before child launch",
		});
		const result = await runRecordedProcess({
			directory,
			args: ["-e", code],
			...options,
		});
		await check(result, directory);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}
test("successful child has durable inputs/output receipt and cannot be relaunched", async () => {
	await withProcess(
		'process.stdout.write("ok")',
		{},
		async (result, directory) => {
			assert.equal(result.status, "completed");
			assert.equal(result.stdout, "ok");
			assert.equal(readProcessReceipt(directory).exitCode, 0);
			await assert.rejects(
				() =>
					runRecordedProcess({ directory, args: ["-e", "process.exit(0)"] }),
				/EEXIST/,
			);
			writeFileSync(join(directory, "stdout.txt"), "changed");
			assert.throws(() => readProcessReceipt(directory), /drift/);
		},
	);
});
test("child signal is harness failure with original sample retained and no retry", async () => {
	await withProcess(
		'process.kill(process.pid,"SIGKILL")',
		{},
		(result, directory) => {
			assert.equal(result.signal, "SIGKILL");
			assert.equal(result.status, "harness-failure");
			assert.equal(result.retryAllowed, false);
			assert.equal(readProcessReceipt(directory).signal, "SIGKILL");
			assert.equal(
				JSON.parse(readFileSync(join(directory, "started.json"))).sampleId,
				"synthetic",
			);
		},
	);
});
test("nonzero exit and bounded stderr are preserved", async () => {
	await withProcess(
		'process.stderr.write("synthetic failure"); process.exitCode=139',
		{},
		(result) => {
			assert.equal(result.exitCode, 139);
			assert.equal(result.stderr, "synthetic failure");
			assert.equal(result.status, "harness-failure");
		},
	);
});
test("hung child is killed at declared timeout without holding the controller indefinitely", async () => {
	await withProcess(
		"setInterval(()=>{},1000)",
		{ timeoutMs: 100 },
		(result) => {
			assert.equal(result.timedOut, true);
			assert.equal(result.signal, "SIGKILL");
			assert.equal(result.status, "harness-failure");
		},
	);
});
test("oversized child output is capped, killed and cannot masquerade as success", async () => {
	await withProcess(
		'process.stdout.write("x".repeat(100000))',
		{ maxOutputBytes: 1000 },
		(result) => {
			assert.equal(result.outputExceeded, true);
			assert.equal(Buffer.byteLength(result.stdout), 1000);
			assert.equal(result.status, "harness-failure");
		},
	);
});
test("missing completion after parent interruption stays unresolved and retains exclusive claim", () => {
	const root = mkdtempSync(join(tmpdir(), "b121-interrupted-")),
		directory = join(root, "attempt");
	try {
		claimProcess(directory, { sampleId: "interrupted" });
		assert.equal(
			readProcessReceipt(directory).status,
			"incomplete-process-receipt",
		);
		assert.throws(() => claimProcess(directory, {}), /EEXIST/);
		assert.equal(readProcessReceipt(directory).retryAllowed, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
