/** Explicit one-shot OpenRouter adapter. Imports never perform I/O or credential lookup. */
import { requestOpenRouter } from "../../../graphrefly-ts/packages/ts/evals/graph-native-rerun-avoidance/openrouter-transport.mjs";
import {
	CEILING_USD,
	estimateInput,
	maximumCost,
	ROUTE,
	validateUsage,
} from "./api-provider.mjs";
import { CONFIG, TOOL, validateResponse } from "./api-runner.mjs";
import { hash } from "./session.mjs";

const insist = (v, m) => {
	if (!v) throw new Error(m);
};
export function createOpenRouterTransport({
	apiKey,
	approval,
	manifestSHA,
	fetchImpl = globalThis.fetch,
}) {
	insist(
		approval?.manifestSHA === manifestSHA &&
			approval.action === "B121-agent-api-one-shot" &&
			approval.acceptAliasLimitation === true &&
			approval.acceptInputEstimateLimitation === true &&
			Date.parse(approval.expiresAt) > Date.now(),
		"exact current approval and estimate/version limitations required",
	);
	insist(
		approval.maxGenerationCalls === 962 &&
			approval.maxUSD === CEILING_USD &&
			approval.retries === 0 &&
			approval.model === ROUTE.model &&
			approval.providerTag === ROUTE.tag,
		"approval limits/route mismatch",
	);
	insist(
		typeof apiKey === "string" && apiKey.length > 0,
		"explicit key required",
	);
	let generationCalls = 0,
		estimates = 0,
		reservedUSD = 0,
		pending = null,
		stopped = false;
	const responseIds = new Set(),
		callIds = new Set();
	const envelopeOf = (r) => ({
		httpStatus: r.status,
		requestId: r.headers?.["x-request-id"] ?? null,
		rawBody: r.bodyText,
		rawBodyBase64: r.bytes ? Buffer.from(r.bytes).toString("base64") : null,
		body: r.json,
		headers: r.headers,
		url: r.url,
	});
	return Object.freeze({
		async estimate(payload) {
			insist(
				!stopped && Date.parse(approval.expiresAt) > Date.now(),
				"transport stopped or approval expired",
			);
			insist(
				hash({ ...payload, messages: [], max_tokens: 0 }) ===
					hash({
						...CONFIG,
						tools: [TOOL],
						tool_choice: { type: "function", function: { name: "broker" } },
						messages: [],
						max_tokens: 0,
					}),
				"request config mismatch",
			);
			insist(
				Array.isArray(payload.messages) &&
					Number.isSafeInteger(payload.max_tokens) &&
					payload.max_tokens > 0 &&
					payload.max_tokens <= 2048,
				"request bounds",
			);
			const result = estimateInput(payload);
			pending = { hash: hash(payload), estimate: result.inputTokens };
			estimates++;
			return result;
		},
		async create(payload, { signal }) {
			insist(
				!stopped && Date.parse(approval.expiresAt) > Date.now(),
				"transport stopped or approval expired",
			);
			insist(pending?.hash === hash(payload), "same-request estimate required");
			pending = null;
			// Reserve full published context input plus output. Unknown outcome retains all reservation.
			const reserve = maximumCost(ROUTE.contextTokens, payload.max_tokens);
			insist(
				generationCalls < approval.maxGenerationCalls &&
					reservedUSD + reserve <= approval.maxUSD,
				"provider cost/call ceiling",
			);
			generationCalls++;
			reservedUSD += reserve;
			let envelope;
			try {
				const receipt = await requestOpenRouter({
					endpoint: ROUTE.endpoint,
					apiKey,
					body: payload,
					signal,
					maxResponseBytes: 2 * 1024 * 1024,
					fetchImpl,
				});
				envelope = envelopeOf(receipt);
				insist(
					receipt.status >= 200 && receipt.status < 300,
					`provider HTTP ${receipt.status}; no retry`,
				);
				const body = receipt.json;
				validateResponse(body);
				const call = body.choices[0].message.tool_calls[0];
				insist(
					!responseIds.has(body.id) && !callIds.has(call.id),
					"campaign response/tool replay",
				);
				responseIds.add(body.id);
				callIds.add(call.id);
				const used = validateUsage(
					body,
					ROUTE.contextTokens,
					payload.max_tokens,
				);
				insist(
					used.costUSD <= reserve + 0.000001,
					"reported cost exceeds reservation",
				);
				reservedUSD -= reserve - used.costUSD;
				return envelope;
			} catch (error) {
				stopped = true;
				error.envelope =
					envelope ?? (error.receipt ? envelopeOf(error.receipt) : null);
				throw error;
			}
		},
		snapshot: () => ({
			generationCalls,
			estimates,
			countCalls: 0,
			reservedUSD,
			stopped,
		}),
	});
}
export const QUALIFICATION_PROMPTS = Object.freeze([
	'Synthetic channel qualification, not a participant session. Call broker with requests equal to [{"op":"read","path":"probe.json"}]. Marker: B121-PROBE-ONLY-6f128b.',
	'Fresh synthetic channel qualification. You have no prior conversation. Call broker with requests equal to [{"op":"read","path":"probe.json"}].',
]);
export async function qualifyProvider({ transport, journal }) {
	const receipts = [];
	for (const prompt of QUALIFICATION_PROMPTS) {
		const payload = {
			...structuredClone(CONFIG),
			tools: [structuredClone(TOOL)],
			tool_choice: { type: "function", function: { name: "broker" } },
			messages: [
				{
					role: "system",
					content: "Use only the broker function requested by the user.",
				},
				{ role: "user", content: prompt },
			],
			max_tokens: 512,
		};
		const signal = AbortSignal.timeout(60000);
		journal({ type: "qualification-estimate-request", data: payload });
		const estimate = await transport.estimate(payload, { signal });
		journal({ type: "qualification-estimate", data: estimate });
		insist(estimate.inputTokens <= 4096, "qualification estimate limit");
		journal({ type: "qualification-generation-request", data: payload });
		const response = await transport.create(payload, { signal });
		journal({ type: "qualification-generation-response", data: response });
		validateUsage(response.body, 4096, 512);
		validateResponse(response.body);
		const args = JSON.parse(
			response.body.choices[0].message.tool_calls[0].function.arguments,
		);
		insist(
			Object.keys(args).length === 1 &&
				typeof args.requests === "string" &&
				hash(JSON.parse(args.requests)) ===
					hash([{ op: "read", path: "probe.json" }]),
			"qualification operation mismatch",
		);
		if (receipts.length)
			insist(
				response.body.id !== receipts[0].body.id &&
					!JSON.stringify(response.body.choices).includes(
						"B121-PROBE-ONLY-6f128b",
					),
				"qualification replay/context canary",
			);
		receipts.push(response);
	}
	return {
		qualified: true,
		receipts,
		scope:
			"fresh outbound Chat messages and reported model/provider; not proof of immutable weights or provider-internal memory",
	};
}
