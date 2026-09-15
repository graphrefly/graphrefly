/** Qwen route-specific accounting. Shared mechanics live with the CSP11 adapter owner. */
import {
	auditProviderReportedCost,
	parseOpenRouterUsage,
} from "../../../graphrefly-ts/packages/ts/evals/graph-native-rerun-avoidance/openrouter-transport.mjs";

export const ROUTE = Object.freeze({
	model: "qwen/qwen3.8-flash",
	provider: "Makora",
	tag: "makora/fp4",
	endpoint: "https://openrouter.ai/api/v1/chat/completions",
	contextTokens: 262144,
	inputPerMillion: 0.15,
	outputPerMillion: 0.47,
	cacheReadPerMillion: 0.016,
	source: "https://openrouter.ai/api/v1/models/qwen/qwen3.8-flash/endpoints",
});
export const CEILING_USD = 0.2;
export const maximumCost = (input, output) =>
	(input * ROUTE.inputPerMillion + output * ROUTE.outputPerMillion) / 1e6;
export function validateUsage(body, maxInput, maxOutput) {
	const used = parseOpenRouterUsage(body);
	const audited = auditProviderReportedCost(body, {
		inputMicrousdPerMillionTokens: 150000,
		cacheReadMicrousdPerMillionTokens: 16000,
		outputMicrousdPerMillionTokens: 470000,
	});
	if (
		used.input > maxInput ||
		used.output > maxOutput ||
		used.input > ROUTE.contextTokens
	)
		throw new Error(
			"reported usage exceeded admitted token budget; stop, do not accept output",
		);
	const reasoning = body.usage.completion_tokens_details?.reasoning_tokens;
	if (
		reasoning !== undefined &&
		(!Number.isSafeInteger(reasoning) ||
			reasoning < 0 ||
			reasoning > used.output)
	)
		throw new Error("invalid reasoning usage");
	return {
		inputTokens: used.input,
		outputTokens: used.output,
		costUSD: body.usage.cost,
		audited,
	};
}
/** This is a conservative byte-based forecast, NOT an exact provider tokenizer or billing bound.
 * Monetary reservation independently uses the route's full context limit, not this estimate.
 */
export function estimateInput(payload) {
	return {
		kind: "local-input-estimate",
		inputTokens:
			Buffer.byteLength(
				JSON.stringify({ messages: payload.messages, tools: payload.tools }),
				"utf8",
			) + 2048,
		method:
			"UTF-8 serialized messages/tools bytes + 2048 formatting allowance; actual provider usage authoritative",
	};
}
