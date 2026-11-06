/** Runs only the trusted pinned compiler; submitted TypeScript is parsed, never executed. */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { openFrozenCompiler } from "./frozen-compiler.mjs";
const [environmentPath, expectedSHA256, snippetPath, consumerProbePath] =
	process.argv.slice(2);
const compiler = openFrozenCompiler(
	gunzipSync(readFileSync(environmentPath)).toString(),
	expectedSHA256,
);
const result = compiler.compile(
	readFileSync(snippetPath, "utf8"),
	consumerProbePath ? readFileSync(consumerProbePath, "utf8") : null,
);
process.stdout.write(JSON.stringify(result) + "\n");
