/** Read-only retrieval over frozen participant sources. No filesystem, shell, network or oracle. */
import { createHash } from "node:crypto";
import { requireParticipant } from "./api-tool.mjs";

const exact = (value, keys) =>
	value &&
	typeof value === "object" &&
	!Array.isArray(value) &&
	Object.keys(value).sort().join() === [...keys].sort().join();
const check = requireParticipant;
class RetrievalArgumentError extends Error {}
const argument = (condition, message) => {
	if (!condition) throw new RetrievalArgumentError(message);
};
const sha = (text) => createHash("sha256").update(text).digest("hex");
export const SOURCE_LIMITS = Object.freeze({
	readLines: 80,
	resultBytes: 12000,
	matches: 20,
	queryChars: 200,
	snippetChars: 300,
});
export function createSourceAccess(entryFiles) {
	const task = JSON.parse(entryFiles["entry/task.json"]);
	const sources = new Map();
	for (const [n, item] of task.sourceIndex.entries()) {
		if (
			sources.has(item.path) ||
			typeof item.path !== "string" ||
			item.path.startsWith("/") ||
			item.path.split("/").includes("..")
		)
			throw Error("Invalid frozen source path");
		// Storage chunks are internal; participants address original source paths and lines.
		const lines = [];
		for (let c = 0; c < item.chunks; c++) {
			const content = entryFiles[`entry/source${n}/chunk${c}.txt`];
			if (typeof content !== "string")
				throw Error("Missing frozen source chunk");
			const [header, ...part] = content.split("\n");
			if (header !== item.path) throw Error("Frozen source header mismatch");
			for (const text of part) {
				const prefix = `${lines.length + 1}: `;
				if (!text.startsWith(prefix))
					throw Error("Frozen source line mismatch");
				lines.push(text.slice(prefix.length));
			}
		}
		if (sha(lines.join("\n")) !== item.sha256)
			throw Error("Frozen source hash mismatch");
		sources.set(item.path, { lines, sha256: item.sha256 });
	}
	const paths = [...sources.keys()].sort();
	const execute = (raw) => {
		check(
			raw && typeof raw === "object" && !Array.isArray(raw),
			"invalid source operation",
		);
		if (raw.op === "list") {
			check(exact(raw, ["op"]), "invalid source list");
			return { ok: true, paths: ["entry/task.json", ...paths] };
		}
		if (raw.op === "read") {
			check(
				typeof raw.path === "string" &&
					(raw.path === "entry/task.json" || sources.has(raw.path)),
				"entry path unavailable",
			);
			argument(
				exact(raw, ["op", "path"]) ||
					exact(raw, ["op", "path", "startLine"]) ||
					exact(raw, ["op", "path", "endLine"]) ||
					exact(raw, ["op", "path", "startLine", "endLine"]),
				"Use read with path and optional startLine and/or endLine. Line numbers are 1-based; null selects defaults.",
			);
			if (raw.path === "entry/task.json") {
				argument(
					raw.startLine == null && raw.endLine == null,
					"Task metadata is read without a line range; omit range fields or set both to null.",
				);
				return { ok: true, content: entryFiles[raw.path] };
			}
			const { lines, sha256 } = sources.get(raw.path);
			const startLine = raw.startLine ?? 1;
			const requestedEnd = raw.endLine ?? lines.length;
			argument(
				Number.isSafeInteger(startLine) &&
					Number.isSafeInteger(requestedEnd) &&
					startLine >= 1 &&
					requestedEnd >= startLine &&
					startLine <= lines.length,
				`Invalid line range. This file has ${lines.length} lines. Use 1-based startLine <= endLine, or read with path only.`,
			);
			const result = {
				ok: true,
				path: raw.path,
				sha256,
				totalLines: lines.length,
				startLine,
				endLine: startLine - 1,
				lines: [],
				nextLine: null,
			};
			const requestedLimit = Math.min(requestedEnd, lines.length);
			const end = Math.min(
				requestedLimit,
				startLine + SOURCE_LIMITS.readLines - 1,
			);
			for (let line = startLine; line <= end; line++) {
				const item = { line, text: lines[line - 1] };
				const candidate = {
					...result,
					lines: [...result.lines, item],
					endLine: line,
					nextLine: line < requestedLimit ? line + 1 : null,
				};
				if (
					Buffer.byteLength(JSON.stringify(candidate)) >
					SOURCE_LIMITS.resultBytes
				)
					break;
				Object.assign(result, candidate);
			}
			argument(
				result.lines.length > 0,
				"source line exceeds result byte limit",
			);
			return result;
		}
		check(raw.op === "search", "invalid source operation");
		check(
			typeof raw.pathPrefix === "string" &&
				!raw.pathPrefix.startsWith("/") &&
				!raw.pathPrefix.includes("\\") &&
				!raw.pathPrefix.split("/").includes(".."),
			"entry path unavailable",
		);
		argument(
			raw.pathPrefix === "" || paths.some((p) => p.startsWith(raw.pathPrefix)),
			"No frozen source matches this pathPrefix. Use list for available paths or an empty pathPrefix to search all supplied sources.",
		);
		argument(
			raw.op === "search" &&
				exact(raw, [
					"op",
					"query",
					"pathPrefix",
					"caseSensitive",
					"offset",
					"limit",
				]),
			"invalid source search",
		);
		argument(
			typeof raw.query === "string" &&
				raw.query.length > 0 &&
				raw.query.length <= SOURCE_LIMITS.queryChars &&
				!/[\r\n]/.test(raw.query),
			"invalid search query",
		);

		argument(
			typeof raw.caseSensitive === "boolean" &&
				Number.isSafeInteger(raw.offset) &&
				raw.offset >= 0 &&
				Number.isSafeInteger(raw.limit) &&
				raw.limit >= 1 &&
				raw.limit <= SOURCE_LIMITS.matches,
			"invalid search pagination",
		);
		const needle = raw.caseSensitive ? raw.query : raw.query.toLowerCase();
		const hits = [];
		for (const path of paths.filter((p) => p.startsWith(raw.pathPrefix))) {
			const { lines } = sources.get(path);
			lines.forEach((text, i) => {
				const at = (raw.caseSensitive ? text : text.toLowerCase()).indexOf(
					needle,
				);
				if (at < 0) return;
				const start = Math.max(0, at - 80);
				const snippet = text.slice(start, start + SOURCE_LIMITS.snippetChars);
				hits.push({
					path,
					line: i + 1,
					text: snippet,
					textTruncated: start > 0 || start + snippet.length < text.length,
				});
			});
		}
		argument(
			raw.offset <= hits.length,
			`Search offset outside results; totalMatches=${hits.length}. Restart with offset 0.`,
		);
		const result = {
			ok: true,
			query: raw.query,
			totalMatches: hits.length,
			matches: [],
			nextOffset: null,
		};
		for (const hit of hits.slice(raw.offset, raw.offset + raw.limit)) {
			const count = result.matches.length + 1;
			const candidate = {
				...result,
				matches: [...result.matches, hit],
				nextOffset:
					raw.offset + count < hits.length ? raw.offset + count : null,
			};
			if (
				Buffer.byteLength(JSON.stringify(candidate)) > SOURCE_LIMITS.resultBytes
			)
				break;
			Object.assign(result, candidate);
		}
		return result;
	};
	return {
		request(raw) {
			try {
				return execute(raw);
			} catch (error) {
				if (!(error instanceof RetrievalArgumentError)) throw error;
				return {
					ok: false,
					error: {
						code: "invalid_retrieval_arguments",
						message: error.message,
						recoverable: true,
					},
					limits: SOURCE_LIMITS,
				};
			}
		},
	};
}
