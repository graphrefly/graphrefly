/** Trusted offline preparation and typechecking. Never executes participant code.
 * A digest must come from the trusted caller; a self-reported hash is not authorization.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, posix, resolve } from "node:path";
import { runInNewContext } from "node:vm";

export const digest = (text) => createHash("sha256").update(text).digest("hex");
const check = (v, message) => {
	if (!v) throw Error(message);
};
const ROOT = "/b121-frozen";
export const relativePath = (p) =>
	typeof p === "string" &&
	p.length > 0 &&
	!p.includes("\\") &&
	!p.includes("\0") &&
	!p.startsWith("/") &&
	p.split("/").every((s) => s && s !== "." && s !== "..");

/** Capture installed trusted tooling once. The later compiler has no disk fallback. */
export function captureCompiler({ tsRoot, materialsJSON, snippetLocation }) {
	const materials = JSON.parse(materialsJSON);
	check(
		relativePath(snippetLocation) && snippetLocation.endsWith(".ts"),
		"invalid snippet path",
	);
	const require = createRequire(resolve(tsRoot, "package.json"));
	const compilerPath = require.resolve("typescript");
	const nodePackage = require.resolve("@types/node/package.json");
	const undiciPackage = createRequire(nodePackage).resolve(
		"undici-types/package.json",
	);
	const files = Object.create(null);
	for (const [path, content] of Object.entries(materials.files)) {
		check(
			relativePath(path) &&
				!path.startsWith("node_modules/") &&
				typeof content === "string",
			"invalid material path/content",
		);
		files[`${ROOT}/${path}`] = content;
	}
	check(
		!Object.hasOwn(files, `${ROOT}/${snippetLocation}`),
		"snippet shadows frozen source",
	);
	const paths = {};
	for (const [name, target] of Object.entries(materials.packageAliases ?? {})) {
		check(
			/^@[a-z0-9-]+\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(name) &&
				relativePath(target) &&
				Object.hasOwn(materials.files, target),
			"invalid frozen package alias",
		);
		paths[name] = [target];
	}
	function collect(directory, virtual) {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			check(!entry.isSymbolicLink(), "toolchain symlink is not captured");
			if (entry.isDirectory())
				collect(join(directory, entry.name), `${virtual}/${entry.name}`);
			else if (entry.name.endsWith(".d.ts") || entry.name === "package.json")
				files[`${virtual}/${entry.name}`] = readFileSync(
					join(directory, entry.name),
					"utf8",
				);
		}
	}
	collect(dirname(compilerPath), `${ROOT}/node_modules/typescript/lib`);
	collect(dirname(nodePackage), `${ROOT}/node_modules/@types/node`);
	collect(dirname(undiciPackage), `${ROOT}/node_modules/undici-types`);
	return JSON.stringify({
		schema: "b121-frozen-compiler-v1",
		nodeVersion: process.version,
		materialSHA256: digest(materialsJSON),
		snippetLocation,
		compilerVersion: require("typescript").version,
		compilerJS: readFileSync(compilerPath, "utf8"),
		options: {
			target: "ES2022",
			module: "ES2022",
			moduleResolution: "Bundler",
			strict: true,
			skipLibCheck: true,
			esModuleInterop: true,
			noEmit: true,
			types: ["node"],
			...(Object.keys(paths).length ? { baseUrl: ".", paths } : {}),
		},
		files,
	});
}

export function openFrozenCompiler(environmentJSON, expectedSHA256) {
	check(
		typeof expectedSHA256 === "string" &&
			digest(environmentJSON) === expectedSHA256,
		"compiler snapshot digest mismatch",
	);
	const env = JSON.parse(environmentJSON);
	check(
		env.schema === "b121-frozen-compiler-v1" &&
			env.nodeVersion === process.version,
		"compiler schema/runtime mismatch",
	);
	check(relativePath(env.snippetLocation), "invalid frozen snippet path");
	const module = { exports: {} };
	// This is the pinned trusted compiler, not submitted code. vm is not an OS sandbox.
	runInNewContext(
		env.compilerJS,
		{ module, exports: module.exports },
		{ timeout: 10000 },
	);
	const ts = module.exports;
	check(ts.version === env.compilerVersion, "compiler version mismatch");
	const converted = ts.convertCompilerOptionsFromJson(env.options, ROOT);
	check(converted.errors.length === 0, "invalid frozen compiler options");
	const options = {
		...converted.options,
		typeRoots: [`${ROOT}/node_modules/@types`],
	};
	const filename = `${ROOT}/${env.snippetLocation}`;
	check(!Object.hasOwn(env.files, filename), "snippet shadows frozen source");
	for (const [path, content] of Object.entries(env.files)) {
		check(
			path.startsWith(`${ROOT}/`) &&
				relativePath(path.slice(ROOT.length + 1)) &&
				typeof content === "string",
			"invalid frozen compiler file",
		);
	}
	return {
		environmentSHA256: expectedSHA256,
		materialSHA256: env.materialSHA256,
		snippetLocation: env.snippetLocation,
		compilerVersion: ts.version,
		compile(snippet, consumerProbe = null) {
			check(
				typeof snippet === "string" && snippet.length <= 32000,
				"bounded snippet required",
			);
			check(
				consumerProbe === null ||
					(typeof consumerProbe === "string" &&
						consumerProbe.trim().length > 0 &&
						consumerProbe.length <= 16000),
				"bounded consumer probe required",
			);
			const probeFilename = posix.join(
				posix.dirname(filename),
				"__b121_consumer_probe__.ts",
			);
			check(
				consumerProbe === null ||
					(!Object.hasOwn(env.files, probeFilename) &&
						probeFilename !== filename),
				"consumer probe path collision",
			);
			const files = {
				...env.files,
				[filename]: snippet,
				...(consumerProbe === null ? {} : { [probeFilename]: consumerProbe }),
			};
			const read = (path) =>
				Object.hasOwn(files, path) ? files[path] : undefined;
			const directories = new Set();
			for (const file of Object.keys(files)) {
				let dir = posix.dirname(file);
				while (dir !== "/") {
					directories.add(dir);
					dir = posix.dirname(dir);
				}
			}
			const host = {
				getSourceFile: (path, languageVersion) =>
					read(path) === undefined
						? undefined
						: ts.createSourceFile(path, read(path), languageVersion),
				getDefaultLibFileName: () =>
					`${ROOT}/node_modules/typescript/lib/lib.es2022.full.d.ts`,
				writeFile: () => {
					throw Error("frozen compiler may not emit");
				},
				getCurrentDirectory: () => ROOT,
				getDirectories: (path) =>
					[...directories]
						.filter((p) => posix.dirname(p) === path)
						.map((p) => posix.basename(p)),
				fileExists: (path) => read(path) !== undefined,
				readFile: read,
				directoryExists: (path) => directories.has(path),
				realpath: (path) => path,
				getCanonicalFileName: (path) => path,
				useCaseSensitiveFileNames: () => true,
				getNewLine: () => "\n",
			};
			const program = ts.createProgram(
				consumerProbe === null ? [filename] : [filename, probeFilename],
				options,
				host,
			);
			const diagnostics = ts.getPreEmitDiagnostics(program).map((d) => ({
				code: d.code,
				category: ts.DiagnosticCategory[d.category],
				path: d.file?.fileName ?? null,
				line:
					d.file && d.start !== undefined
						? d.file.getLineAndCharacterOfPosition(d.start).line + 1
						: null,
				message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
			}));
			return structuredClone({
				environmentSHA256: expectedSHA256,
				snippetSHA256: digest(snippet),
				...(consumerProbe === null
					? {}
					: { consumerProbeSHA256: digest(consumerProbe) }),
				materialDiagnostics: diagnostics.filter(
					(d) =>
						d.path !== filename &&
						(consumerProbe === null || d.path !== probeFilename),
				),
				ok: snippet.trim().length > 0 && diagnostics.length === 0,
				diagnostics,
				checkedFiles: program
					.getSourceFiles()
					.map((f) => f.fileName)
					.sort(),
			});
		},
	};
}
