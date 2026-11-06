/** Eval broker contract v2. Only shapes are exposed; evidence and vocabulary stay in packets. */
import { CONCEPTS, QUESTIONS } from "./materials.mjs";
import { SCENARIOS } from "./session.mjs";

const object = (properties) => ({
	type: "object",
	properties,
	required: Object.keys(properties),
	additionalProperties: false,
});
const string = { type: "string" };
const strings = { type: "array", items: string };
const field = object({ value: string, citations: strings });
export const TOOL = Object.freeze({
	type: "function",
	function: {
		name: "broker",
		strict: true,
		description:
			"Operate on the supplied study files. requests is an array of operation objects. Follow the session instructions for the initial read. Use op, not tool or action. Read visible packets for allowed answer values. Only the controller opens phases and seals answers.",
		parameters: object({
			requests: {
				type: "array",
				minItems: 1,
				maxItems: 16,
				items: {
					anyOf: [
						object({ op: { type: "string", enum: ["list"] } }),
						object({ op: { type: "string", enum: ["read"] }, path: string }),
						object({
							op: { type: "string", enum: ["submit"] },
							phase: { type: "string", enum: ["A", "B"] },
							scenario: { type: "string", enum: SCENARIOS },
							fields: object(
								Object.fromEntries(QUESTIONS.A.map((k) => [k, field])),
							),
							explanation: { type: "string", maxLength: 6000 },
						}),
						object({
							op: { type: "string", enum: ["submit"] },
							snippet: { type: "string", maxLength: 32000 },
							explanation: { type: "string", maxLength: 6000 },
							concepts: object({
								read: {
									type: "array",
									items: { type: "string", enum: CONCEPTS },
								},
								required: {
									type: "array",
									items: { type: "string", enum: CONCEPTS },
								},
								firstExpansion: { type: ["string", "null"] },
							}),
						}),
					],
				},
			},
		}),
	},
});
/** Entry tools expose only task metadata and bounded retrieval from the frozen source map. */
const integer = (minimum, maximum) => ({ type: "integer", minimum, maximum });
export const ENTRY_TOOL = {
	type: "function",
	function: {
		name: "broker",
		strict: true,
		description:
			"Read entry/task.json first. Search frozen sources with literal text (rg -F semantics), then read original paths and 1-based inclusive line ranges. Search is line-based, ordered by path then line; offset paginates matches. Empty pathPrefix searches all supplied sources. Search snippets may be truncated; use read for full lines. Read with path alone for the first bounded page. Optional startLine/endLine (or null defaults) select a range; the controller caps all results at 80 lines and 12000 bytes. Continue at nextLine. Recoverable argument errors return ok:false; correct them within the same session budgets. No shell, filesystem or external MCP access. Submit code with broker.",
		parameters: object({
			requests: {
				type: "array",
				minItems: 1,
				maxItems: 16,
				items: {
					anyOf: [
						object({ op: { type: "string", enum: ["list"] } }),
						object({
							op: { type: "string", enum: ["read"] },
							path: string,
						}),
						object({
							op: { type: "string", enum: ["read"] },
							path: string,
							startLine: { anyOf: [integer(1, 2147483647), { type: "null" }] },
							endLine: { anyOf: [integer(1, 2147483647), { type: "null" }] },
						}),
						...["startLine", "endLine"].map((bound) =>
							object({
								op: { type: "string", enum: ["read"] },
								path: string,
								[bound]: { anyOf: [integer(1, 2147483647), { type: "null" }] },
							}),
						),
						object({
							op: { type: "string", enum: ["search"] },
							query: { type: "string", minLength: 1, maxLength: 200 },
							pathPrefix: string,
							caseSensitive: { type: "boolean" },
							offset: integer(0, 2147483647),
							limit: integer(1, 20),
						}),
						TOOL.function.parameters.properties.requests.items.anyOf[3],
					],
				},
			},
		}),
	},
};
export class ParticipantOutputError extends Error {
	constructor(message) {
		super(message);
		this.name = "ParticipantOutputError";
	}
}
export const requireParticipant = (condition, message) => {
	if (!condition) throw new ParticipantOutputError(message);
};
export function parseBrokerArguments(text) {
	let args;
	try {
		args = JSON.parse(text);
	} catch {
		throw new ParticipantOutputError("invalid tool JSON");
	}
	requireParticipant(
		args &&
			typeof args === "object" &&
			!Array.isArray(args) &&
			Object.keys(args).length === 1 &&
			Array.isArray(args.requests),
		"invalid tool envelope",
	);
	requireParticipant(
		args.requests.length > 0 && args.requests.length <= 16,
		"tool operation budget",
	);
	requireParticipant(
		args.requests.every(
			(request) =>
				request && typeof request === "object" && !Array.isArray(request),
		),
		"invalid broker operation object",
	);
	return args.requests;
}
