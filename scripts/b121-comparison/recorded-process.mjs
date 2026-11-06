/** Trusted subprocess boundary. Claims are exclusive; failures are receipts, never retries. */
import { spawn } from "node:child_process";
import {
	mkdirSync,
	openSync,
	writeFileSync,
	fsyncSync,
	closeSync,
	readFileSync,
	existsSync,
} from "node:fs";
import { resolve } from "node:path";
import { digest } from "./frozen-compiler.mjs";

export function durableWrite(path, value) {
	const fd = openSync(path, "wx", 0o600);
	try {
		writeFileSync(fd, value);
		fsyncSync(fd);
	} finally {
		closeSync(fd);
	}
}
export function claimProcess(directory, metadata) {
	mkdirSync(directory, { mode: 0o700 });
	durableWrite(
		resolve(directory, "started.json"),
		JSON.stringify(metadata, null, 2) + "\n",
	);
}
export function readProcessReceipt(directory) {
	const started = readFileSync(resolve(directory, "started.json"));
	if (!existsSync(resolve(directory, "completion.json")))
		return {
			status: "incomplete-process-receipt",
			startedSHA256: digest(started),
			retryAllowed: false,
		};
	const receipt = JSON.parse(
		readFileSync(resolve(directory, "completion.json"), "utf8"),
	);
	if (
		receipt.startedSHA256 !== digest(started) ||
		receipt.stdoutSHA256 !==
			digest(readFileSync(resolve(directory, "stdout.txt"))) ||
		receipt.stderrSHA256 !==
			digest(readFileSync(resolve(directory, "stderr.txt")))
	)
		throw Error("process receipt drift");
	return receipt;
}
/** directory has already been claimed and its inputs saved by the trusted caller. */
export async function runRecordedProcess({
	directory,
	args,
	timeoutMs = 60000,
	maxOutputBytes = 4 * 1024 * 1024,
}) {
	if (
		!Number.isSafeInteger(timeoutMs) ||
		timeoutMs < 1 ||
		timeoutMs > 60000 ||
		!Number.isSafeInteger(maxOutputBytes) ||
		maxOutputBytes < 1 ||
		maxOutputBytes > 4 * 1024 * 1024
	)
		throw Error("invalid subprocess bounds");
	const started = readFileSync(resolve(directory, "started.json"));
	// Claim execution independently, including concurrent callers reusing an already prepared directory.
	durableWrite(
		resolve(directory, "launched.json"),
		JSON.stringify({
			args,
			executable: process.execPath,
			startedSHA256: digest(started),
		}) + "\n",
	);
	let stdout = Buffer.alloc(0),
		stderr = Buffer.alloc(0),
		timedOut = false,
		outputExceeded = false,
		error = null;
	const child = spawn(process.execPath, args, {
		env: {},
		stdio: ["ignore", "pipe", "pipe"],
	});
	const timer = setTimeout(() => {
		timedOut = true;
		child.kill("SIGKILL");
	}, timeoutMs);
	function capture(kind, chunk) {
		const current = kind === "stdout" ? stdout : stderr;
		const cap = kind === "stdout" ? maxOutputBytes : 65536;
		if (current.length + chunk.length > cap) {
			outputExceeded = true;
			child.kill("SIGKILL");
		}
		const next = Buffer.concat([
			current,
			chunk.subarray(0, Math.max(0, cap - current.length)),
		]);
		if (kind === "stdout") stdout = next;
		else stderr = next;
	}
	child.stdout.on("data", (chunk) => capture("stdout", chunk));
	child.stderr.on("data", (chunk) => capture("stderr", chunk));
	child.on("error", (e) => {
		error = String(e.message);
	});
	const { exitCode, signal } = await new Promise((resolve) =>
		child.on("close", (exitCode, signal) => resolve({ exitCode, signal })),
	);
	clearTimeout(timer);
	const receipt = {
		kind: "recorded-process",
		startedSHA256: digest(started),
		exitCode,
		signal,
		timedOut,
		outputExceeded,
		error,
		stdoutSHA256: digest(stdout),
		stderrSHA256: digest(stderr),
		status:
			!error && exitCode === 0 && !signal && !timedOut && !outputExceeded
				? "completed"
				: "harness-failure",
		retryAllowed: false,
	};
	durableWrite(resolve(directory, "stdout.txt"), stdout);
	durableWrite(resolve(directory, "stderr.txt"), stderr);
	durableWrite(
		resolve(directory, "completion.json"),
		JSON.stringify(receipt, null, 2) + "\n",
	);
	return {
		...receipt,
		stdout: stdout.toString("utf8"),
		stderr: stderr.toString("utf8"),
		directory: resolve(directory),
	};
}
