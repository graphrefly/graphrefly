/** Offline structural audit of an explicit material map. Never expands the map or reads disk/network. */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { posix } from "node:path";
const ts = createRequire(
	new URL("../../../graphrefly-ts/package.json", import.meta.url),
)("typescript");
const digest = (text) => createHash("sha256").update(text).digest("hex");
const safe = (path) =>
	typeof path === "string" &&
	path.length > 0 &&
	!path.includes("\\") &&
	!path.includes("\0") &&
	!posix.isAbsolute(path) &&
	path !== ".." &&
	!path.startsWith("../") &&
	posix.normalize(path) === path;
const restricted = (path) =>
	/(^|\/)(?:docs\/design|sessions|tests?|__tests__|fixtures?)(\/|$)|(?:^|[\/._-])(?:oracle|goldens?|rubric|answers?)(?:[\/._-]|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/.test(
		path,
	);

export function auditMaterialCoverage({ files, entrypoints = [] }) {
	if (!files || typeof files !== "object" || Array.isArray(files))
		throw Error("explicit material map required");
	const paths = Object.keys(files).sort();
	for (const p of paths)
		if (!safe(p) || typeof files[p] !== "string")
			throw Error("invalid material path/content");
	if (!Array.isArray(entrypoints) || entrypoints.some((p) => !safe(p)))
		throw Error("invalid entrypoints");
	const references = [],
		manualReview = [];
	function add(from, ref, kind, line) {
		if (typeof ref !== "string" || !ref) {
			manualReview.push({ from, line, reason: "nonliteral reference" });
			return;
		}
		let target;
		try {
			target = decodeURIComponent(ref.split("#")[0].split("?")[0]);
		} catch {
			manualReview.push({ from, line, reason: "malformed reference encoding" });
			return;
		}
		if (!target) return; // In-document anchors are outside this structural path check.
		if (
			/^[a-z][a-z\d+.-]*:/i.test(target) ||
			target.startsWith("//") ||
			(kind === "import" && !target.startsWith(".") && !target.startsWith("/"))
		) {
			references.push({
				from,
				ref,
				kind,
				line,
				status: "external",
				resolved: null,
			});
			return;
		}
		const absolute = posix.isAbsolute(target);
		target = posix.normalize(posix.join(posix.dirname(from), target));
		if (absolute || !safe(target)) {
			references.push({
				from,
				ref,
				kind,
				line,
				status: "outside-root",
				resolved: null,
			});
			return;
		}
		let candidates = [target];
		if (kind === "import") {
			if (/\.js$/.test(target))
				candidates = [
					target.slice(0, -3) + ".ts",
					target.slice(0, -3) + ".tsx",
					target,
				];
			else if (!posix.extname(target))
				candidates = [
					target,
					target + ".ts",
					target + ".tsx",
					target + "/index.ts",
				];
		}
		const matches = candidates.filter((p) => Object.hasOwn(files, p));
		const status = restricted(target)
			? "restricted"
			: matches.length > 1
				? "ambiguous"
				: matches.length === 1
					? "included"
					: "missing";
		references.push({
			from,
			ref,
			kind,
			line,
			status,
			resolved: matches.length === 1 ? matches[0] : null,
			candidates,
		});
	}
	for (const from of paths) {
		const content = files[from];
		if (/\.[cm]?[jt]sx?$/.test(from)) {
			const source = ts.createSourceFile(
				from,
				content,
				ts.ScriptTarget.Latest,
				true,
			);
			if (source.parseDiagnostics.length)
				manualReview.push({ from, reason: "source parse diagnostics" });
			for (const ref of source.referencedFiles)
				add(
					from,
					ref.fileName,
					"reference-path",
					source.getLineAndCharacterOfPosition(ref.pos).line + 1,
				);
			for (const ref of [
				...source.typeReferenceDirectives,
				...source.libReferenceDirectives,
			])
				references.push({
					from,
					ref: ref.fileName,
					kind: "type-or-lib-reference",
					line: source.getLineAndCharacterOfPosition(ref.pos).line + 1,
					status: "external",
					resolved: null,
				});
			function visit(node) {
				const line =
					source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
				if (
					(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
					node.moduleSpecifier
				)
					add(
						from,
						ts.isStringLiteral(node.moduleSpecifier)
							? node.moduleSpecifier.text
							: null,
						"import",
						line,
					);
				else if (
					ts.isImportEqualsDeclaration(node) &&
					ts.isExternalModuleReference(node.moduleReference)
				)
					add(
						from,
						node.moduleReference.expression &&
							ts.isStringLiteral(node.moduleReference.expression)
							? node.moduleReference.expression.text
							: null,
						"import",
						line,
					);
				else if (ts.isImportTypeNode(node))
					add(
						from,
						ts.isLiteralTypeNode(node.argument) &&
							ts.isStringLiteral(node.argument.literal)
							? node.argument.literal.text
							: null,
						"import",
						line,
					);
				else if (
					ts.isCallExpression(node) &&
					(node.expression.kind === ts.SyntaxKind.ImportKeyword ||
						(ts.isIdentifier(node.expression) &&
							node.expression.text === "require"))
				)
					add(
						from,
						node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])
							? node.arguments[0].text
							: null,
						"import",
						line,
					);
				ts.forEachChild(node, visit);
			}
			visit(source);
		} else if (/\.md$/.test(from)) {
			// Explicitly limited Markdown syntax; this audit never certifies semantic completeness.
			for (const m of content.matchAll(
				/\]\(<?([^\s)>]+)>?(?:\s+"[^"]*")?\)|^\s*\[[^\]]+\]:\s*<?([^\s>]+)>?/gm,
			))
				add(
					from,
					m[1] ?? m[2],
					"link",
					content.slice(0, m.index).split("\n").length,
				);
			if (/<a\s|\]\[|\[[^\]\n]+\](?![:(])/i.test(content))
				manualReview.push({
					from,
					reason:
						"Markdown HTML, reference or shortcut links need manual review",
				});
		} else manualReview.push({ from, reason: "unparsed file type" });
	}
	return {
		kind: "B121-material-coverage-audit",
		providerCalls: 0,
		executionReady: false,
		files: paths.map((path) => ({
			path,
			sha256: digest(files[path]),
			bytes: Buffer.byteLength(files[path]),
			lines: files[path].split("\n").length,
			restricted: restricted(path),
		})),
		entrypoints: entrypoints.map((path) => ({
			path,
			status: Object.hasOwn(files, path)
				? restricted(path)
					? "restricted"
					: "included"
				: "missing",
		})),
		references,
		manualReview,
		limitations: [
			"Structural local path audit only; not TypeScript module resolution, link-anchor validation, answer-leak detection or proof that tasks are answerable.",
			"External packages and computed imports need review. No reference causes a file to be added. Files with innocuous names can still contain hidden answers; human material review is required.",
			"Restrictions are screening signals, not an isolation/security boundary. No runnable material bundle or formal freeze is produced.",
		],
	};
}
