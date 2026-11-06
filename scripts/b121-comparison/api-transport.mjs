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
	MAX_GENERATION_CALLS,
	maximumCost,
	ROUTE,
	readFailedGenerationUsage,
	readUsage,
	validateUsage,
} from "./api-provider.mjs";
import { CONFIG, MAX_OUTPUT_PER_REQUEST, TOOL, validateResponse } from "./api-runner.mjs";
import { ENTRY_TOOL } from "./api-tool.mjs";
import { hash } from "./session.mjs";
import {
	createB121TransportControl,
	createB121QualificationControl,
} from "../../../graphrefly-ts/packages/ts/evals/b121/transport-control.mjs";

// Diagnostic metadata only. Never serialize arbitrary messages, stacks, URLs or sockets.
const DIAGNOSTIC_CODES = new Set([
	"ECONNRESET",
	"ECONNREFUSED",
	"ECONNABORTED",
	"ETIMEDOUT",
	"ENOTFOUND",
	"EAI_AGAIN",
	"EPIPE",
	"ENETUNREACH",
	"EHOSTUNREACH",
	"ABORT_ERR",
	"UND_ERR_CONNECT_TIMEOUT",
	"UND_ERR_HEADERS_TIMEOUT",
	"UND_ERR_BODY_TIMEOUT",
	"UND_ERR_SOCKET",
	"UND_ERR_ABORTED",
	"UND_ERR_CLOSED",
	"UND_ERR_DESTROYED",
	"CERT_HAS_EXPIRED",
	"DEPTH_ZERO_SELF_SIGNED_CERT",
	"ERR_TLS_CERT_ALTNAME_INVALID",
	"UNABLE_TO_VERIFY_LEAF_SIGNATURE",
	"ERR_SSL_WRONG_VERSION_NUMBER",
]);
const DIAGNOSTIC_NAMES = new Set([
	"Error",
	"TypeError",
	"SyntaxError",
	"AggregateError",
	"AbortError",
	"TimeoutError",
]);
function ownData(value, key) {
	if (value === null || (typeof value !== "object" && typeof value !== "function"))
		return undefined;
	try {
		return Object.getOwnPropertyDescriptor(value, key)?.value;
	} catch {
		return undefined;
	}
}
export function transportErrorChain(error) {
	const entries = [],
		seen = new Set();
	function visit(value, parent, relation, depth) {
		if (!value || typeof value !== "object" || seen.has(value) || entries.length >= 8 || depth > 4)
			return;
		seen.add(value);
		let name = ownData(value, "name");
		if (name === undefined) {
			try {
				name = ownData(Object.getPrototypeOf(value), "name");
			} catch {}
		}
		const code = ownData(value, "code"),
			index = entries.length;
		entries.push({
			parent,
			relation,
			name: DIAGNOSTIC_NAMES.has(name) ? name : null,
			code: DIAGNOSTIC_CODES.has(code) ? code : null,
		});
		visit(ownData(value, "cause"), index, "cause", depth + 1);
		const errors = ownData(value, "errors");
		if (Array.isArray(errors))
			for (let i = 0; i < Math.min(ownData(errors, "length") ?? 0, 8); i++)
				visit(ownData(errors, String(i)), index, "aggregate", depth + 1);
	}
	// Diagnostics must not replace the original failure, even for hostile/revoked objects.
	try {
		visit(error, null, "root", 0);
	} catch {}
	return entries;
}

/** Keep generation identity separate from HTTP tracing; conflicts remain explicit. */
export function responseIdentity(body, headers = {}) {
	const valid = (v) => typeof v === "string" && v.trim().length > 0;
	const entries =
		typeof headers?.entries === "function" ? [...headers.entries()] : Object.entries(headers ?? {});
	const values = (names) =>
		entries
			.filter(([k, v]) => names.includes(k.toLowerCase()) && valid(v))
			.flatMap(([, v]) =>
				v
					.split(",")
					.map((id) => id.trim())
					.filter(valid),
			);
	const generationIds = [
		...new Set([...(valid(body?.id) ? [body.id] : []), ...values(["x-generation-id"])]),
	];
	const requestIds = [...new Set(values(["x-request-id", "request-id"]))];
	return {
		generationId: generationIds.length === 1 ? generationIds[0] : null,
		requestId: requestIds.length === 1 ? requestIds[0] : null,
		generationIds,
		requestIds,
		identityConflict: generationIds.length > 1 || requestIds.length > 1,
	};
}

export const RETRY_POLICY = Object.freeze({
	capacity: OPENROUTER_MAX_CAPACITY_RETRIES,
	availability: OPENROUTER_MAX_AVAILABILITY_RETRIES,
});
// B121-only HTTP/1.1 persistence policy. This mitigates stale reused sockets;
// it does not make a failed POST safe to replay or prove the remote cost is zero.
export const CONNECTION_POLICY = "http1-connection-close-v1";
export function nonPersistentRequestOptions(options) {
	const headers = new Headers(options.headers);
	headers.set("connection", "close");
	return { ...options, headers: Object.fromEntries(headers.entries()) };
}
export const MAX_CREATE_MS =
	(RETRY_POLICY.capacity + RETRY_POLICY.availability) * (60000 + OPENROUTER_MAX_RETRY_DELAY_MS) +
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
	graphContext,
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
		approval.maxGenerationCalls === MAX_GENERATION_CALLS &&
			approval.maxUSD === CEILING_USD &&
			(approval.retries === 0 || hash(approval.retries) === hash(RETRY_POLICY)) &&
			approval.model === ROUTE.model &&
			approval.providerTag === ROUTE.tag,
		"approval limits/route mismatch",
	);
	insist(typeof apiKey === "string" && apiKey.length > 0, "explicit key required");
	const recoveryEnabled = approval.retries !== 0;
	insist(typeof journal === "function", "durable provider journal required");
	insist(
		Number.isSafeInteger(attemptTimeoutMs) && attemptTimeoutMs > 0 && attemptTimeoutMs <= 60000,
		"attempt timeout bound",
	);
	const priorUsageUSD = approval.priorUsageUSD ?? 0;
	insist(
		Number.isFinite(priorUsageUSD) && priorUsageUSD >= 0 && priorUsageUSD < approval.maxUSD,
		"prior usage bounds",
	);

	const envelopeOf = (r) => ({
		httpStatus: r.status,
		...responseIdentity(r.json, r.headers),
		rawBody: r.bodyText,
		rawBodyBase64: r.bytes ? Buffer.from(r.bytes).toString("base64") : null,
		body: r.json,
		headers: r.headers,
		url: r.url,
	});
	const initialState = {
		phase: "idle",
		revision: 0,
		generationCalls: 0,
		estimates: 0,
		reservedUSD: 0,
		reportedCostUSD: 0,
		pending: null,
		stopped: false,
		responseIds: new Set(),
		callIds: new Set(),
		reply: null,
	};
	function finish(s, error, value) {
		const recording = s.phase === "record";
		s.phase = "idle";
		if (error) {
			if (recording) {
				error.envelope ??= s.record?.data?.envelope ?? null;
				error.reportedUsage ??= s.reportedUsage;
			}
			s.stopped = true;
			error.envelope ??= s.attempts?.at(-1)?.envelope ?? null;
			error.attempts = s.attempts ?? [];
		}
		s.reply = { commandId: s.commandId, error, value };
		return s;
	}
	function validateRequest(payload) {
		insist(
			[TOOL, ENTRY_TOOL].some(
				(tool) =>
					hash({ ...payload, messages: [], max_tokens: 0 }) ===
					hash({
						...CONFIG,
						tools: [tool],
						tool_choice: { type: "function", function: { name: "broker" } },
						messages: [],
						max_tokens: 0,
					}),
			),
			"request config mismatch",
		);
		insist(
			Array.isArray(payload.messages) &&
				Number.isSafeInteger(payload.max_tokens) &&
				payload.max_tokens > 0 &&
				payload.max_tokens <= MAX_OUTPUT_PER_REQUEST,
			"request bounds",
		);
	}
	function budget(s, suffix = "") {
		s.signal?.throwIfAborted();
		insist(Date.parse(approval.expiresAt) > Date.now(), "approval expired");
		insist(
			s.generationCalls < approval.maxGenerationCalls &&
				priorUsageUSD + s.reservedUSD + s.reserve <= approval.maxUSD,
			`provider cost/call ceiling${suffix}`,
		);
	}
	function admit(s) {
		budget(s);
		return {
			kind: "attempt",
			commandId: s.commandId,
			revision: s.revision,
			requestHash: hash(s.request),
			attempt: s.attempts.length + 1,
			reserveUSD: s.reserve,
			record: {
				type: "provider-attempt-request",
				data: {
					requestHash: hash(s.request),
					attempt: s.attempts.length + 1,
					reserveUSD: s.reserve,
					connectionPolicy: CONNECTION_POLICY,
				},
			},
		};
	}
	function recover(s) {
		const { recoveryClass, waitMs } = s.attempts.at(-1);
		if (!recoveryEnabled || !recoveryClass || waitMs === null || s.signal?.aborted) throw s.failed;
		insist(Date.now() + waitMs < Date.parse(approval.expiresAt), "approval expires before retry");
		budget(s, " before retry");
		return {
			kind: "retry",
			commandId: s.commandId,
			revision: s.revision,
			recoveryClass,
			waitMs,
			record: {
				type: "provider-retry-wait",
				data: { recoveryClass, waitMs, requestHash: hash(s.request) },
			},
		};
	}
	// Only a single already-admitted HTTP effect. No retry, billing, or next-request policy here.
	async function executeAttempt(action) {
		const abort = new AbortController(),
			timeoutReason = new Error("provider attempt timeout");
		const signal = action.signal;
		const attemptSignal = signal ? AbortSignal.any([signal, abort.signal]) : abort.signal;
		const started = performance.now();
		let phase = "before-fetch",
			receivedStatus = null,
			networkError,
			envelope,
			failed;
		const timer = setTimeout(() => abort.abort(timeoutReason), attemptTimeoutMs);
		try {
			attemptSignal.throwIfAborted();
			const receipt = await requestOpenRouter({
				endpoint: ROUTE.endpoint,
				apiKey,
				body: action.request,
				signal: attemptSignal,
				maxResponseBytes: 2 * 1024 * 1024,
				fetchImpl: async (endpoint, options) => {
					phase = "awaiting-response-headers";
					try {
						const response = await fetchImpl(endpoint, nonPersistentRequestOptions(options));
						receivedStatus = response.status;
						phase = "reading-response-body";
						return response;
					} catch (error) {
						networkError = error;
						throw error;
					}
				},
			});
			envelope = envelopeOf(receipt);
			phase = "validating-response";
			attemptSignal.throwIfAborted();
		} catch (error) {
			failed = error;
			if (error.receipt && !error.bodyReadFailed) phase = "processing-response";
			envelope ??= error.receipt ? envelopeOf(error.receipt) : null;
		} finally {
			clearTimeout(timer);
		}
		return {
			envelope,
			failed,
			networkFailure: networkError !== undefined && failed === networkError,
			timedOut: abort.signal.aborted,
			diagnostics: {
				version: "transport-diagnostics-v1",
				connectionPolicy: CONNECTION_POLICY,
				elapsedMs: Math.max(0, Math.round(performance.now() - started)),
				attemptTimeoutMs,
				phase,
				httpStatus: Number.isInteger(receivedStatus) ? receivedStatus : null,
				abortSource: !attemptSignal.aborted
					? null
					: attemptSignal.reason === timeoutReason
						? "attempt-timeout"
						: "caller",
				attemptTimeoutFired: abort.signal.aborted,
				callerAborted: signal?.aborted ?? false,
			},
		};
	}
	// Called exclusively by the settlement Graph node. Reported charges settle even invalid output.
	function settle(s, outcome) {
		const envelope = outcome.envelope;
		let failed = outcome.failed,
			reportedUsage;
		if (!failed)
			try {
				const body = envelope.body;
				insist(
					ROUTE.acceptedModels.includes(body.model) && body.provider === ROUTE.provider,
					"provider model/route mismatch",
				);
				insist(!s.responseIds.has(body.id), "campaign response/tool replay");
				if (
					Array.isArray(body.choices) &&
					body.choices.some((choice) => choice?.finish_reason === "error")
				) {
					const failure = new Error(
						"provider generation failed (finish_reason=error); retryability unknown",
					);
					failure.failureKind = "provider-generation-error";
					try {
						insist(typeof body.id === "string" && body.id.length > 0, "missing response identity");
						reportedUsage = readFailedGenerationUsage(body);
						s.reservedUSD -= s.reserve - reportedUsage.costUSD;
						s.reportedCostUSD += reportedUsage.costUSD;
						s.responseIds.add(body.id);
						insist(
							reportedUsage.costUSD <= s.reserve + 0.000001,
							"reported cost exceeds reservation",
						);
						insist(
							reportedUsage.inputTokens + reportedUsage.outputTokens <= ROUTE.contextTokens &&
								reportedUsage.outputTokens <= s.request.max_tokens,
							"failed generation exceeded admitted token bounds",
						);
						insist(
							(body.usage.completion_tokens_details?.reasoning_tokens ?? 0) === 0,
							"disabled reasoning was not honored",
						);
					} catch (billingError) {
						failure.billingError = billingError.message;
					}
					throw failure;
				}
				reportedUsage = readUsage(body);
				s.reservedUSD -= s.reserve - reportedUsage.costUSD;
				s.reportedCostUSD += reportedUsage.costUSD;
				insist(reportedUsage.costUSD <= s.reserve + 0.000001, "reported cost exceeds reservation");
				validateUsage(body, ROUTE.contextTokens, s.request.max_tokens);
				insist(
					(body.usage.completion_tokens_details?.reasoning_tokens ?? 0) === 0,
					"disabled reasoning was not honored",
				);
				validateResponse(body);
				const call = body.choices[0].message.tool_calls[0];
				insist(
					!s.responseIds.has(body.id) && !s.callIds.has(call.id),
					"campaign response/tool replay",
				);
				const used = validateUsage(body, ROUTE.contextTokens, s.request.max_tokens);
				insist(used.costUSD <= s.reserve + 0.000001, "reported cost exceeds reservation");
				s.responseIds.add(body.id);
				s.callIds.add(call.id);
				s.record = { type: "provider-attempt-response", data: { envelope, costUSD: used.costUSD } };
				s.reportedUsage = reportedUsage;
				s.result = { ...envelope, attempts: s.attempts };
				s.failed = null;
				s.phase = "record";
				return s;
			} catch (error) {
				failed = error;
			}
		const receipt = failed.receipt;
		const retryAfter = parseRetryAfterMs(receipt?.headers?.["retry-after"] ?? null, Date.now());
		const retryAfterMs =
			retryAfter.kind === "valid"
				? retryAfter.delayMs
				: retryAfter.kind === "valid-over-limit"
					? OPENROUTER_MAX_RETRY_DELAY_MS + 1
					: 0;
		const root =
			receipt?.json && typeof receipt.json === "object" && !Array.isArray(receipt.json)
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
			: receipt?.status >= 200 && receipt.status < 300 && failed.bodyReadFailed === true
				? "availability"
				: !envelope && (outcome.timedOut || outcome.networkFailure)
					? "availability"
					: null;
		const waitMs = recoveryClass
			? recoveryDelay({
					recoveryClass,
					capacityRetryOrdinal: s.ordinals.capacity,
					availabilityRetryOrdinal: s.ordinals.availability,
					retryAfterMs,
				})
			: null;
		const record = {
			envelope,
			transportDiagnostics: { ...outcome.diagnostics, errorChain: transportErrorChain(failed) },
			error: failed.message,
			failureKind: failed.failureKind ?? null,
			billingError: failed.billingError ?? null,
			recoveryClass,
			waitMs,
			reservedUSD: s.reserve,
			billing: reportedUsage ? "provider-reported" : "unknown-reservation-retained",
			reportedUsage: reportedUsage ?? null,
		};
		s.reportedUsage = reportedUsage;
		s.attempts.push(record);
		failed.envelope = envelope;
		failed.reportedUsage = reportedUsage;
		s.failed = failed;
		s.record = { type: "provider-attempt-failed", data: record };
		s.phase = "record";
		return s;
	}
	function reduce(previous, fact) {
		const command = fact.type === "estimate" || fact.type === "create";
		if (!command && (fact.commandId !== previous.commandId || fact.revision !== previous.revision))
			return previous;
		const s = { ...previous, reply: null };
		try {
			if (command) {
				insist(
					s.phase === "idle" && !s.stopped && Date.parse(approval.expiresAt) > Date.now(),
					"transport stopped or approval expired",
				);
				if (fact.type === "estimate") {
					validateRequest(fact.payload);
					const result = estimateInput(fact.payload);
					s.pending = { hash: hash(fact.payload), estimate: result.inputTokens };
					s.estimates++;
					s.reply = { commandId: fact.commandId, value: result };
					return s;
				}
				insist(s.pending?.hash === hash(fact.payload), "same-request estimate required");
				s.pending = null;
				s.commandId = fact.commandId;
				s.request = structuredClone(fact.payload);
				s.signal = fact.signal;
				s.result = null;
				s.record = null;
				s.reportedUsage = undefined;
				s.failed = null;
				s.attempts = [];
				s.ordinals = { capacity: 0, availability: 0 };
				s.reserve = maximumCost(ROUTE.contextTokens, s.request.max_tokens);
				s.revision++;
				s.phase = "admit";
				return s;
			}
			s.revision++;
			if (fact.type === "fault") return finish(s, fact.error);
			if (fact.type === "admitted") {
				insist(
					s.phase === "admit" && fact.result.requestHash === hash(s.request),
					"attempt admission mismatch",
				);
				// Recheck after asynchronous persistence: an expired grant cannot become HTTP permission.
				budget(s);
				// Durable write-ahead acknowledgement precedes reserve and the HTTP admission.
				s.generationCalls++;
				s.reservedUSD += s.reserve;
				s.admission = fact.result;
				s.phase = "http";
			} else if (fact.type === "outcome") {
				insist(s.phase === "http", "outcome without admitted request");
				s.responseIds = new Set(s.responseIds);
				s.callIds = new Set(s.callIds);
				s.attempts = [...s.attempts];
				settle(s, fact.result);
			} else if (fact.type === "recorded") {
				insist(s.phase === "record", "settlement acknowledgement mismatch");
				if (s.failed) s.phase = "recover";
				else return finish(s, null, s.result);
			} else if (fact.type === "wait-admitted") {
				insist(s.phase === "recover", "retry admission mismatch");
				insist(
					Date.now() + fact.result.waitMs < Date.parse(approval.expiresAt),
					"approval expires before retry",
				);
				budget(s, " before retry");
				s.delay = fact.result;
				s.phase = "wait";
			} else if (fact.type === "waited") {
				insist(s.phase === "wait", "delay acknowledgement mismatch");
				s.signal?.throwIfAborted();
				s.ordinals = {
					...s.ordinals,
					[s.delay.recoveryClass]: s.ordinals[s.delay.recoveryClass] + 1,
				};
				s.phase = "admit";
			} else throw new Error("unknown transport fact");
			return s;
		} catch (error) {
			if (command) return { ...previous, reply: { commandId: fact.commandId, error } };
			return finish(s, error);
		}
	}
	const control = createB121TransportControl({
		graphContext,
		initialState,
		reduce,
		admit,
		recover,
		persist: (event) => journal?.({ type: event.type, data: structuredClone(event.data) }),
		observe: journal,
		executeAttempt,
		executeDelay: (action) => sleepImpl(action.admission.waitMs, action.signal),
	});
	return Object.freeze({
		maxCreateMs: recoveryEnabled ? MAX_CREATE_MS : 60000,
		graphContext: control.graphContext,
		graph: control.graph,
		estimate: (payload) => control.command("estimate", { payload }),
		create: (payload, { signal } = {}) => control.command("create", { payload, signal }),
		dispose: () => control.dispose(),
		snapshot: () => {
			const s = control.snapshot();
			return {
				generationCalls: s.generationCalls,
				estimates: s.estimates,
				countCalls: 0,
				reservedUSD: s.reservedUSD,
				reportedCostUSD: s.reportedCostUSD,
				unknownReservedUSD: Math.max(0, s.reservedUSD - s.reportedCostUSD),
				priorUsageUSD,
				stopped: s.stopped,
			};
		},
	});
}
export const QUALIFICATION_PROMPTS = Object.freeze([
	"Synthetic channel qualification, not a participant session. Marker: B121-PROBE-ONLY-6f128b.",
	"Fresh synthetic channel qualification. You have no prior conversation.",
]);
export const QUALIFICATION_SUBMISSIONS = Object.freeze([
	[
		{
			op: "submit",
			phase: "A",
			scenario: "C1",
			fields: Object.fromEntries(
				[
					"author",
					"consequence",
					"effectNow",
					"implementationChanged",
					"lifecycleEnded",
					"topologyChanged",
					"uncertainty",
				].map((key) => [key, { value: "unknown", citations: ["synthetic-fact-1"] }]),
			),
			explanation: "Synthetic qualification only.",
		},
	],
	[
		{
			op: "submit",
			snippet: "export const value: number = 1;",
			explanation: "Synthetic entry qualification only.",
			concepts: { read: [], required: [], firstExpansion: null },
		},
	],
]);
export const QUALIFICATION_READS = [
	[{ op: "read", path: "probe.json" }],
	[
		{ op: "read", path: "entry/task.json" },
		{
			op: "search",
			query: "value",
			pathPrefix: "",
			caseSensitive: true,
			offset: 0,
			limit: 2,
		},
		{ op: "read", path: "probe.ts", startLine: 1, endLine: 1 },
	],
];
export async function qualifyProvider({
	transport,
	journal,
	graphContext = transport.graphContext,
}) {
	const messagesFor = (conversation) => [
		{
			role: "system",
			content:
				"Synthetic channel calibration, not study evidence. Use exactly one broker call per response. requests must be an array of operation objects. The user message specifies the exact initial requests. The tool result specifies the exact synthetic submission to return. Do not add commentary or extra fields.",
		},
		{
			role: "user",
			content:
				QUALIFICATION_PROMPTS[conversation] +
				" Initial requests: " +
				JSON.stringify(QUALIFICATION_READS[conversation]),
		},
	];
	const initialState = {
		revision: 0,
		conversation: 0,
		turn: 0,
		messages: messagesFor(0),
		receipts: [],
		identities: new Set(),
		phase: "unstarted",
		terminal: false,
	};
	function reduce(previous, fact) {
		if (fact.type !== "start" && fact.revision !== previous.revision) return previous;
		const s = { ...previous, revision: previous.revision + 1 };
		try {
			if (fact.type === "start") {
				insist(s.phase === "unstarted", "qualification start replay");
				s.phase = "estimate";
			} else if (fact.type === "failed") throw fact.error;
			else if (fact.type === "estimated") {
				insist(s.phase === "estimate", "qualification estimate mismatch");
				insist(fact.value.estimate.inputTokens <= 4096, "qualification estimate limit");
				s.signal = fact.value.signal;
				s.phase = "generate";
			} else if (fact.type === "generated") {
				insist(s.phase === "generate", "qualification generation mismatch");
				const response = fact.value;
				validateUsage(response.body, 4096, s.turn === 0 ? 512 : 2048);
				validateResponse(response.body);
				insist(
					(response.body.usage.completion_tokens_details?.reasoning_tokens ?? 0) === 0,
					"disabled reasoning was not honored",
				);
				const message = response.body.choices[0].message,
					call = message.tool_calls[0];
				const args = JSON.parse(call.function.arguments);
				const expected =
					s.turn === 0
						? QUALIFICATION_READS[s.conversation]
						: QUALIFICATION_SUBMISSIONS[s.conversation];
				insist(
					Object.keys(args).length === 1 &&
						Array.isArray(args.requests) &&
						hash(args.requests) === hash(expected),
					"qualification operation mismatch",
				);
				insist(
					!s.identities.has(response.body.id) && !s.identities.has(call.id),
					"qualification replay",
				);
				if (s.conversation === 1)
					insist(
						!JSON.stringify(response.body.choices).includes("B121-PROBE-ONLY-6f128b"),
						"qualification replay/context canary",
					);
				s.identities = new Set([...s.identities, response.body.id, call.id]);
				s.receipts = [...s.receipts, response];
				if (s.turn === 0) {
					s.messages = [
						...s.messages,
						structuredClone(message),
						{
							role: "tool",
							tool_call_id: call.id,
							content: JSON.stringify({
								ok: true,
								synthetic: true,
								nextRequests: QUALIFICATION_SUBMISSIONS[s.conversation],
							}),
						},
					];
					s.turn = 1;
					s.phase = "estimate";
				} else if (s.conversation === 0) {
					s.conversation = 1;
					s.turn = 0;
					s.messages = messagesFor(1);
					s.phase = "estimate";
				} else {
					s.terminal = true;
					s.phase = "terminal";
				}
			} else throw new Error("unknown qualification fact");
		} catch (error) {
			s.terminal = true;
			s.phase = "terminal";
			s.error = error;
		}
		return s;
	}
	function admission(s) {
		if (s.phase !== "estimate" && s.phase !== "generate") return null;
		return {
			kind: s.phase === "estimate" ? "estimate" : "generation",
			revision: s.revision,
			signal: s.signal,
			payload: {
				...structuredClone(CONFIG),
				tools: [structuredClone(s.conversation === 1 ? ENTRY_TOOL : TOOL)],
				tool_choice: { type: "function", function: { name: "broker" } },
				messages: structuredClone(s.messages),
				max_tokens: s.turn === 0 ? 512 : 2048,
			},
		};
	}
	const control = createB121QualificationControl({
		graphContext,
		initialState,
		reduce,
		admission,
		observe: journal,
		executeEstimate: async (action) => {
			const signal = AbortSignal.timeout(transport.maxCreateMs ?? 60000);
			await journal({ type: "qualification-estimate-request", data: action.payload });
			const estimate = await transport.estimate(action.payload, { signal });
			await journal({ type: "qualification-estimate", data: estimate });
			return { estimate, signal };
		},
		executeGeneration: async (action) => {
			await journal({ type: "qualification-generation-request", data: action.payload });
			const response = await transport.create(action.payload, { signal: action.signal });
			await journal({ type: "qualification-generation-response", data: response });
			return response;
		},
	});
	const receipts = await control.result;
	return {
		qualified: true,
		receipts,
		scope:
			"two fresh two-turn synthetic read-to-submission conversations; seven-field and entry search/range/submission envelopes, reasoning setting and history verified; no model-quality or immutable-weight proof",
	};
}
