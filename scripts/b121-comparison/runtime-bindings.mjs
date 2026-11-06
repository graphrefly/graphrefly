/** Freeze the separately owned orchestrator runtime, never expose these files to the participant. */
import { readdirSync, readFileSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
export function runtimeBindings() {
	const ts = resolve(root, "../graphrefly-ts");
	const walk = (dir) =>
		readdirSync(dir, { withFileTypes: true })
			.sort((a, b) => a.name.localeCompare(b.name))
			.flatMap((entry) => {
				if (["__tests__", "__bench__"].includes(entry.name)) return [];
				const path = join(dir, entry.name);
				return entry.isDirectory()
					? walk(path)
					: /\.(ts|mjs|json)$/.test(entry.name) && !entry.name.endsWith(".test.mjs")
						? [path]
						: [];
			});
	const paths = [
		...walk(join(ts, "packages/ts/src")),
		...walk(join(ts, "packages/ts/evals/b121")),
		...readdirSync(join(ts, "packages/ts/evals/graph-native-rerun-avoidance"))
			.filter((f) => /\.(ts|mjs)$/.test(f))
			.map((f) => join(ts, "packages/ts/evals/graph-native-rerun-avoidance", f)),
		join(ts, "pnpm-lock.yaml"),
		join(ts, "node_modules/tsx/package.json"),
		...walk(join(ts, "node_modules/tsx/dist")),
	];
	return [...new Set(paths)]
		.sort()
		.map((path) => ({
			path: relative(root, path),
			sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
		}));
}
export const orchestratorEnvironment = Object.freeze({
	node: process.version,
	architecture: process.arch,
	platform: process.platform,
});
