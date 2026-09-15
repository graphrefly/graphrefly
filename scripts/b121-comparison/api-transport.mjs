/** Explicit bounded OpenRouter adapter. Imports never perform I/O or credential lookup. */
import { setTimeout as delay } from "node:timers/promises";
import {
	classifyHttpRecovery,
	OPENROUTER_MAX_AVAILABILITY_RETRIES,
	OPENROUTER_MAX_CAPACITY_RETRIES,
	OPENROUTER_MAX_RETRY_DELAY_MS,
	parseRetryAfterMs,
	recoveryDelay,
} from "../../../graphrefly-ts/packages/ts/evals/graph-native-rerun-avoidance/openrouter-recovery.mjs";
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

export const RETRY_POLICY = Object.freeze({
	capacity: OPENROUTER_MAX_CAPACITY_RETRIES,
	availability: OPENROUTER_MAX_AVAILABILITY_RETRIES,
});
export const MAX_CREATE_MS =
	(RETRY_POLICY.capacity + RETRY_POLICY.availability) *
		(60000 + OPENROUTER_MAX_RETRY_DELAY_MS) +
	60000 +
	1000;
const insist = (v, m) => {
	if (!v) throw new Error(m);
};
export function createOpenRouterTransport({
	apiKey,
	approval,
	manifestSHA,
	fetchImpl = globalThis.fetch,
	journal,
	sleepImpl = (ms, signal) => delay(ms, undefined, { signal }),
	attemptTimeoutMs = 60000,
}) {
	approval = structuredClone(approval);
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
			(approval.retries === 0 ||
				hash(approval.retries) === hash(RETRY_POLICY)) &&
			approval.model === ROUTE.model &&
			approval.providerTag === ROUTE.tag,
		"approval limits/route mismatch",
	);
	insist(
		typeof apiKey === "string" && apiKey.length > 0,
		"explicit key required",
	);
	const recoveryEnabled = approval.retries !== 0;
	insist(
		!recoveryEnabled || typeof journal === "function",
		"durable retry journal required",
	);
	insist(
		Number.isSafeInteger(attemptTimeoutMs) &&
			attemptTimeoutMs > 0 &&
			attemptTimeoutMs <= 60000,
		"attempt timeout bound",
	);
	let busy = false;
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
		maxCreateMs: recoveryEnabled ? MAX_CREATE_MS : 60000,
		async estimate(payload) {
			insist(
				!busy && !stopped && Date.parse(approval.expiresAt) > Date.now(),
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
				!busy && !stopped && Date.parse(approval.expiresAt) > Date.now(),
				"transport stopped or approval expired",
			);
			insist(pending?.hash === hash(payload), "same-request estimate required");
			pending = null;
			busy = true;
			const request = structuredClone(payload);
			const attempts = [];
			const ordinals = { capacity: 0, availability: 0 };
			const reserve = maximumCost(ROUTE.contextTokens, request.max_tokens);
			const emit = (type, data) =>
				journal?.({ type, data: structuredClone(data) });
			try {
				for (;;) {
					signal?.throwIfAborted();
					insist(
						Date.parse(approval.expiresAt) > Date.now(),
						"approval expired",
					);
					insist(
						generationCalls < approval.maxGenerationCalls &&
							reservedUSD + reserve <= approval.maxUSD,
						"provider cost/call ceiling",
					);
					const abort = new AbortController();
					const attemptSignal = signal
						? AbortSignal.any([signal, abort.signal])
						: abort.signal;
					const timer = setTimeout(
						() => abort.abort(new Error("provider attempt timeout")),
						attemptTimeoutMs,
					);
					let envelope, networkError, failed;
					try {
						emit("provider-attempt-request", {
							requestHash: hash(request),
							attempt: attempts.length + 1,
							reserveUSD: reserve,
						});
						generationCalls++;
						reservedUSD += reserve;
						const receipt = await requestOpenRouter({
							endpoint: ROUTE.endpoint,
							apiKey,
							body: request,
							signal: attemptSignal,
							maxResponseBytes: 2 * 1024 * 1024,
							fetchImpl: async (...args) => {
								try {
									return await fetchImpl(...args);
								} catch (error) {
									networkError = error;
									throw error;
								}
							},
						});
						envelope = envelopeOf(receipt);
						attemptSignal.throwIfAborted();
						const body = receipt.json;
						validateResponse(body);
						const call = body.choices[0].message.tool_calls[0];
						insist(
							!responseIds.has(body.id) && !callIds.has(call.id),
							"campaign response/tool replay",
						);
						const used = validateUsage(
							body,
							ROUTE.contextTokens,
							request.max_tokens,
						);
						insist(
							used.costUSD <= reserve + 0.000001,
							"reported cost exceeds reservation",
						);
						emit("provider-attempt-response", {
							envelope,
							costUSD: used.costUSD,
						});
						reservedUSD -= reserve - used.costUSD;
						responseIds.add(body.id);
						callIds.add(call.id);
						return { ...envelope, attempts };
					} catch (error) {
						failed = error;
						envelope ??= error.receipt ? envelopeOf(error.receipt) : null;
					} finally {
						clearTimeout(timer);
					}
					const receipt = failed.receipt;
					const retryAfter = parseRetryAfterMs(
						receipt?.headers?.["retry-after"] ?? null,
						Date.now(),
					);
					const retryAfterMs =
						retryAfter.kind === "valid"
							? retryAfter.delayMs
							: retryAfter.kind === "valid-over-limit"
								? OPENROUTER_MAX_RETRY_DELAY_MS + 1
								: 0;
					// HTTP status remains authoritative when its bounded optional error body is not JSON.
					// Route/body-limit faults and successful-response validation faults remain terminal.
					const root =
						receipt?.json &&
						typeof receipt.json === "object" &&
						!Array.isArray(receipt.json)
							? receipt.json
							: {};
					const cleanError =
						receipt &&
						receipt.status >= 400 &&
						receipt.url === ROUTE.endpoint &&
						(failed.cause === undefined ||
							failed.cause instanceof SyntaxError ||
							failed.bodyReadFailed === true) &&
						!["usage", "choices", "id"].some((key) => Object.hasOwn(root, key));
					const recoveryClass = cleanError
						? classifyHttpRecovery(receipt.status, root, retryAfter)
						: receipt?.status >= 200 &&
								receipt.status < 300 &&
								failed.bodyReadFailed === true
							? "availability"
							: !envelope &&
									(abort.signal.aborted ||
										(networkError !== undefined && failed === networkError))
								? "availability"
								: null;
					const waitMs = recoveryClass
						? recoveryDelay({
								recoveryClass,
								capacityRetryOrdinal: ordinals.capacity,
								availabilityRetryOrdinal: ordinals.availability,
								retryAfterMs,
							})
						: null;
					const record = {
						envelope,
						error: failed.message,
						recoveryClass,
						waitMs,
						reservedUSD: reserve,
						billing: "unknown-reservation-retained",
					};
					attempts.push(record);
					// Durable evidence must settle before admitting any further effect.
					emit("provider-attempt-failed", record);
					if (
						!recoveryEnabled ||
						!recoveryClass ||
						waitMs === null ||
						signal?.aborted
					) {
						failed.envelope = envelope;
						throw failed;
					}
					insist(
						Date.now() + waitMs < Date.parse(approval.expiresAt),
						"approval expires before retry",
					);
					insist(
						generationCalls < approval.maxGenerationCalls &&
							reservedUSD + reserve <= approval.maxUSD,
						"provider cost/call ceiling before retry",
					);
					emit("provider-retry-wait", {
						recoveryClass,
						waitMs,
						requestHash: hash(request),
					});
					await sleepImpl(waitMs, signal);
					signal?.throwIfAborted();
					ordinals[recoveryClass]++;
				}
			} catch (error) {
				stopped = true;
				error.envelope ??= attempts.at(-1)?.envelope ?? null;
				error.attempts = attempts;
				throw error;
			} finally {
				busy = false;
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
		const signal = AbortSignal.timeout(transport.maxCreateMs ?? 60000);
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
