/** Each compilation is a separately recorded bounded process, with no automatic retry. */
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { digest } from "./frozen-compiler.mjs";
import {
	claimProcess,
	durableWrite,
	runRecordedProcess,
} from "./recorded-process.mjs";
export const COMPILER_PROCESS_POLICY = Object.freeze({
	timeoutMs: 60000,
	heapMiB: 512,
	maxOutputBytes: 4194304,
	retries: 0,
});

export async function compileInProcess({
	environmentJSON,
	expectedSHA256,
	snippet,
	consumerProbe = null,
	directory,
	context = null,
	beforeLaunch = () => {},
}) {
	if (
		digest(environmentJSON) !== expectedSHA256 ||
		typeof snippet !== "string" ||
		snippet.length > 32000 ||
		(consumerProbe !== null &&
			(typeof consumerProbe !== "string" ||
				!consumerProbe.trim() ||
				consumerProbe.length > 16000))
	)
		throw Error("invalid frozen compilation request");
	const worker = fileURLToPath(
		new URL("./compiler-worker.mjs", import.meta.url),
	);
	claimProcess(directory, {
		kind: "frozen-typecheck",
		environmentSHA256: expectedSHA256,
		snippetSHA256: digest(snippet),
		...(consumerProbe === null
			? {}
			: { consumerProbeSHA256: digest(consumerProbe) }),
		context,
		policy: COMPILER_PROCESS_POLICY,
		nodeVersion: process.version,
		executableSHA256: digest(readFileSync(process.execPath)),
		workerSHA256: digest(readFileSync(worker)),
	});
	durableWrite(
		resolve(directory, "environment.json.gz"),
		gzipSync(environmentJSON),
	);
	durableWrite(resolve(directory, "snippet.ts"), snippet);
	if (consumerProbe !== null)
		durableWrite(resolve(directory, "consumer-probe.ts"), consumerProbe);
	beforeLaunch({
		receiptDirectory: resolve(directory),
		context,
		environmentSHA256: expectedSHA256,
		snippetSHA256: digest(snippet),
		...(consumerProbe === null
			? {}
			: { consumerProbeSHA256: digest(consumerProbe) }),
	});
	const processResult = await runRecordedProcess({
		directory,
		args: [
			`--max-old-space-size=${COMPILER_PROCESS_POLICY.heapMiB}`,
			worker,
			resolve(directory, "environment.json.gz"),
			expectedSHA256,
			resolve(directory, "snippet.ts"),
			...(consumerProbe === null
				? []
				: [resolve(directory, "consumer-probe.ts")]),
		],
		timeoutMs: COMPILER_PROCESS_POLICY.timeoutMs,
		maxOutputBytes: COMPILER_PROCESS_POLICY.maxOutputBytes,
	});
	let compilation = null,
		compilerFailure = null;
	if (processResult.status !== "completed")
		compilerFailure = "compiler subprocess failed";
	else {
		try {
			compilation = JSON.parse(processResult.stdout);
			if (
				compilation.environmentSHA256 !== expectedSHA256 ||
				compilation.snippetSHA256 !== digest(snippet) ||
				(consumerProbe === null
					? Object.hasOwn(compilation, "consumerProbeSHA256")
					: compilation.consumerProbeSHA256 !== digest(consumerProbe)) ||
				typeof compilation.ok !== "boolean" ||
				!Array.isArray(compilation.diagnostics) ||
				!Array.isArray(compilation.materialDiagnostics)
			)
				throw Error("compiler result binding/schema mismatch");
		} catch (error) {
			compilation = null;
			compilerFailure = String(error.message);
		}
	}
	const outcome = {
		compilation,
		compilerFailure,
		receiptDirectory: resolve(directory),
		process: {
			exitCode: processResult.exitCode,
			signal: processResult.signal,
			timedOut: processResult.timedOut,
			outputExceeded: processResult.outputExceeded,
			retryAllowed: false,
		},
	};
	durableWrite(
		resolve(directory, "outcome.json"),
		JSON.stringify(outcome, null, 2) + "\n",
	);
	return outcome;
}
