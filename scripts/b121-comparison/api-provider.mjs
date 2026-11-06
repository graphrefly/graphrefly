/** DeepSeek route-specific accounting. Shared mechanics live with the CSP11 adapter owner. */
import {
	auditProviderReportedCost,
	parseOpenRouterUsage,
	providerReportedCost,
} from "../../../graphrefly-ts/packages/ts/evals/graph-native-rerun-avoidance/openrouter-transport.mjs";

export const ROUTE = Object.freeze({
	model: "deepseek/deepseek-v4.1-flash",
	provider: "Together",
	acceptedModels: Object.freeze([
		"deepseek/deepseek-v4.1-flash",
		"deepseek/deepseek-v4.1-flash-20260910",
	]),
	tag: "together",
	endpoint: "https://openrouter.ai/api/v1/chat/completions",
	contextTokens: 1048576,
	inputPerMillion: 0.3,
	outputPerMillion: 1.2,
	cacheReadPerMillion: 0.006,
	source:
		"https://openrouter.ai/api/v1/models/deepseek/deepseek-v4.1-flash/endpoints",
});
// Proposed local envelope only; external key limit and explicit per-run authorization are separate.
export const CEILING_USD = 11;
export const MAX_GENERATION_CALLS = 1444;
export const maximumCost = (input, output) =>
	(input * ROUTE.inputPerMillion + output * ROUTE.outputPerMillion) / 1e6;
export function readUsage(body) {
	const used = parseOpenRouterUsage(body);
	const audited = auditProviderReportedCost(body, {
		inputMicrousdPerMillionTokens: ROUTE.inputPerMillion * 1e6,
		cacheReadMicrousdPerMillionTokens: ROUTE.cacheReadPerMillion * 1e6,
		outputMicrousdPerMillionTokens: ROUTE.outputPerMillion * 1e6,
	});
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
/** Failed generations may be billed zero despite nonzero upstream compute costs.
 * Validate reported quantities, without pretending successful-token pricing applies.
 * This receipt never authorizes accepting output or retrying a generation.
 */
export function readFailedGenerationUsage(body) {
	const used = parseOpenRouterUsage(body);
	providerReportedCost(body);
	const reasoning = body.usage.completion_tokens_details?.reasoning_tokens;
	if (
		reasoning !== undefined &&
		(!Number.isSafeInteger(reasoning) ||
			reasoning < 0 ||
			reasoning > used.output)
	)
		throw Error("invalid reasoning usage");
	return {
		inputTokens: used.input,
		outputTokens: used.output,
		costUSD: body.usage.cost,
		billingBasis: "failed-generation-provider-reported",
	};
}
export function validateUsage(body, maxInput, maxOutput) {
	const used = readUsage(body);
	if (
		used.inputTokens > maxInput ||
		used.outputTokens > maxOutput ||
		used.inputTokens + used.outputTokens > ROUTE.contextTokens
	)
		throw new Error(
			"reported usage exceeded admitted token budget; stop, do not accept output",
		);
	return used;
}
/** Calibrated forecast only. Actual provider usage and full-context money reservation remain authoritative. */
export function estimateInput(payload) {
	const bytes = Buffer.byteLength(
		JSON.stringify({ messages: payload.messages, tools: payload.tools }),
		"utf8",
	);
	return {
		kind: "local-input-estimate",
		inputTokens: Math.ceil(bytes / 3) + 256,
		method:
			"UTF-8 serialized messages/tools bytes / 3 + 256; heuristic transferred from prior calibration; DeepSeek tokenizer not qualified, not an exact tokenizer or upper bound",
	};
}
