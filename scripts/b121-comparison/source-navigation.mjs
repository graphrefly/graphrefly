/** Deterministic source-only navigation. No task, role, answer, rubric or model inputs. */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const ts = createRequire(
	new URL("../../../graphrefly-ts/package.json", import.meta.url),
)("typescript");
export function buildSourceNavigation({ path, content, sha256, prefix }) {
	if (createHash("sha256").update(content).digest("hex") !== sha256)
		throw new Error("navigation source hash mismatch");
	const source = ts.createSourceFile(
		path,
		content,
		ts.ScriptTarget.Latest,
		true,
	);
	if (source.parseDiagnostics.length)
		throw new Error("navigation source parse failed");
	const symbols = [];
	function add(node, name, kind) {
		symbols.push({
			name,
			kind,
			start:
				source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
			end:
				source.getLineAndCharacterOfPosition(
					Math.max(node.getStart(source), node.end - 1),
				).line + 1,
		});
	}
	for (const node of source.statements) {
		if (ts.isVariableStatement(node)) {
			for (const declaration of node.declarationList.declarations)
				add(declaration, declaration.name.getText(source), "variable");
		} else if (
			node.name &&
			(ts.isFunctionDeclaration(node) ||
				ts.isClassDeclaration(node) ||
				ts.isInterfaceDeclaration(node) ||
				ts.isTypeAliasDeclaration(node) ||
				ts.isEnumDeclaration(node))
		) {
			const name = node.name.getText(source);
			add(node, name, ts.SyntaxKind[node.kind]);
			if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node))
				for (const member of node.members) {
					if (member.name)
						add(
							member,
							`${name}.${member.name.getText(source)}`,
							ts.SyntaxKind[member.kind],
						);
					else if (ts.isConstructorDeclaration(member))
						add(member, `${name}.constructor`, "Constructor");
				}
		}
	}
	return {
		format: "b121-source-navigation-v1",
		source: path,
		sha256,
		chunkPath: `${prefix}/chunk{N}.txt`,
		chunkLines: 80,
		lineCount: content.split("\n").length,
		instructions:
			"Source-derived declaration locations only. Lines are 1-based; N=floor((line-1)/80). Read every intersecting chunk for a complete declaration/body. Reading only the start chunk gives a header, not the full body. Nested declarations inside function bodies are not indexed. No index entry establishes correctness or authority.",
		symbols,
	};
}
