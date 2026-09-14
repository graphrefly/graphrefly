/** Prepared direct OpenAI adapter. Importing this module performs no I/O or key lookup. */
import {
	CONFIG,
	maximumCost,
	TOOL,
	validateResponse,
	validateUsage,
} from "./api-runner.mjs";
import { hash } from "./session.mjs";

const insist = (v, m) => {
	if (!v) throw new Error(m);
};
const clone = (x) => JSON.parse(JSON.stringify(x));
export function createOpenAITransport({
	apiKey,
	approval,
	manifestSHA,
	fetchImpl = globalThis.fetch,
}) {
	insist(
		approval?.manifestSHA === manifestSHA &&
			approval.action === "B121-agent-api-one-shot" &&
			approval.acceptAliasLimitation === true &&
			approval.countEndpointPriceUSD === 0 &&
			typeof approval.countPriceEvidence === "string" &&
			approval.countPriceEvidence.length > 0 &&
			Date.parse(approval.expiresAt) > Date.now(),
		"exact current approval and verified zero count-endpoint tariff required",
	);
	insist(
		approval.maxGenerationCalls === 962 &&
			approval.maxCountCalls === 962 &&
			approval.maxUSD === 12.11 &&
			approval.retries === 0,
		"approval limits mismatch",
	);
	insist(
		typeof apiKey === "string" && apiKey.length > 0,
		"explicit key required; never read from participant input",
	);
	let generationCalls = 0,
		countCalls = 0,
		reservedUSD = 0;
	async function post(path, body, { signal }) {
		insist(Date.parse(approval.expiresAt) > Date.now(), "approval expired");
		// Deliberately no SDK, redirect following, automatic retry, alternate endpoint or model fallback.
		const response = await fetchImpl(`https://api.openai.com/v1/${path}`, {
			method: "POST",
			redirect: "error",
			signal,
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});
		const text = await response.text();
		const envelope = {
			httpStatus: response.status,
			requestId: response.headers.get("x-request-id"),
			rawBody: text,
			body: null,
		};
		try {
			envelope.body = JSON.parse(text);
		} catch {
			const error = new Error("provider non-JSON response; no retry");
			error.envelope = envelope;
			throw error;
		}
		if (!response.ok) {
			const error = new Error(`provider HTTP ${response.status}; no retry`);
			error.envelope = envelope;
			throw error;
		}
		return envelope;
	}
	let pendingCount = null;
	const responseIds = new Set(),
		callIds = new Set();
	return Object.freeze({
		async count(payload, options) {
			insist(++countCalls <= approval.maxCountCalls, "count call ceiling");
			insist(
				hash({ ...payload, input: [], max_output_tokens: 0 }) ===
					hash({
						...CONFIG,
						instructions: payload.instructions,
						tools: [TOOL],
						tool_choice: { type: "function", name: "broker" },
						input: [],
						max_output_tokens: 0,
					}),
				"request config mismatch",
			);
			const {
				model,
				input,
				instructions,
				tools,
				tool_choice,
				parallel_tool_calls,
				reasoning,
				truncation,
			} = payload;
			const result = await post(
				"responses/input_tokens",
				{
					model,
					input,
					instructions,
					tools,
					tool_choice,
					parallel_tool_calls,
					reasoning,
					truncation,
				},
				options,
			);
			pendingCount = { hash: hash(payload), count: result.body?.input_tokens };
			return result;
		},
		async create(payload, options) {
			insist(
				pendingCount?.hash === hash(payload) &&
					Number.isSafeInteger(pendingCount.count) &&
					pendingCount.count > 0,
				"same-request count required",
			);
			const count = pendingCount.count;
			pendingCount = null;
			const reserve = maximumCost(count, payload.max_output_tokens);
			insist(
				++generationCalls <= approval.maxGenerationCalls &&
					reservedUSD + reserve <= approval.maxUSD + 1e-9,
				"provider cost/call ceiling",
			);
			reservedUSD += reserve;
			const result = await post("responses", payload, options);
			// Keep reservation on failures; a timeout/disconnect may have incurred the full amount.
			let used;
			try {
				insist(
					typeof result.body.id === "string" &&
						!responseIds.has(result.body.id),
					"campaign response replay",
				);
				responseIds.add(result.body.id);
				for (const item of result.body.output ?? [])
					if (item.type === "function_call") {
						insist(
							typeof item.call_id === "string" && !callIds.has(item.call_id),
							"campaign call replay",
						);
						callIds.add(item.call_id);
					}
				used = validateUsage(
					result.body.usage,
					count,
					payload.max_output_tokens,
				);
			} catch (error) {
				error.envelope = result;
				throw error;
			}
			reservedUSD -= reserve - used.costUSD;
			return result;
		},
		snapshot: () => ({ generationCalls, countCalls, reservedUSD }),
	});
}

export const QUALIFICATION_PROMPTS = Object.freeze([
	'This is a synthetic channel qualification, not a participant session. Call broker with requests equal to [{"op":"read","path":"probe.json"}]. Marker: B121-PROBE-ONLY-6f128b.',
	'This is a fresh synthetic channel qualification, not a participant session. You have no prior conversation in this request. Call broker with requests equal to [{"op":"read","path":"probe.json"}].',
]);
export async function qualifyProvider({ transport, journal }) {
	const receipts = [];
	for (const prompt of QUALIFICATION_PROMPTS) {
		const payload = {
			...clone(CONFIG),
			instructions: "Use only the broker function requested by the user.",
			tools: [clone(TOOL)],
			tool_choice: { type: "function", name: "broker" },
			input: [{ role: "user", content: prompt }],
			max_output_tokens: 512,
		};
		const signal = AbortSignal.timeout(60000);
		journal({ type: "qualification-count-request", data: payload });
		const count = await transport.count(payload, { signal });
		journal({ type: "qualification-count-response", data: count });
		insist(
			count.body.object === "response.input_tokens" &&
				Number.isSafeInteger(count.body.input_tokens) &&
				count.body.input_tokens > 0 &&
				count.body.input_tokens <= 2048,
			"qualification input limit",
		);
		journal({ type: "qualification-generation-request", data: payload });
		const response = await transport.create(payload, { signal });
		journal({ type: "qualification-generation-response", data: response });
		validateUsage(response.body.usage, count.body.input_tokens, 512);
		validateResponse(response.body);
		const calls = response.body.output.filter(
			(x) => x.type === "function_call",
		);
		insist(
			calls.length === 1 && calls[0].name === "broker",
			"qualification tool mismatch",
		);
		const args = JSON.parse(calls[0].arguments);
		insist(
			hash(JSON.parse(args.requests)) ===
				hash([{ op: "read", path: "probe.json" }]),
			"qualification operation mismatch",
		);
		if (receipts.length)
			insist(
				response.body.id !== receipts[0].body.id &&
					!JSON.stringify(response.body.output).includes(
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
			"outbound fresh JSON and returned configuration; not provider-internal memory or immutable-version proof",
	};
}
