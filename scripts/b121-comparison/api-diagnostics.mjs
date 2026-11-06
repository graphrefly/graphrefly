/** Offline attribution only. Never loads a key, contacts a provider, or changes an attempt. */
export function diagnoseAttempt(rows) {
	const sessions = [];
	let current = null,
		estimate = null;
	for (const { event } of rows) {
		const { type, data } = event;
		if (type === "started") {
			current = {
				id: data.slot.id,
				arm: data.slot.arm,
				requests: 0,
				estimatedInputTokens: 0,
				actualInputTokens: 0,
				cumulativeHistoryBytes: 0,
				stops: [],
				failure: null,
			};
			sessions.push(current);
			estimate = null;
		}
		if (!current) continue;
		if (type === "estimate-response") estimate = data.inputTokens;
		if (type === "generation-dispatch") {
			current.requests++;
			current.estimatedInputTokens += estimate ?? 0;
			current.cumulativeHistoryBytes += Buffer.byteLength(
				JSON.stringify(data.payload.messages.slice(2)),
				"utf8",
			);
		}
		if (type === "generation-response")
			current.actualInputTokens += data.body?.usage?.prompt_tokens ?? 0;
		if (type === "budget-stop")
			current.stops.push({
				reason: data.reason ?? "input-estimate-exceeds-remaining",
				contextTokens: data.contextTokens ?? null,
				maxOutputTokens: data.maxOutputTokens ?? null,
				actualInputTokens: data.usage.inputTokens,
				estimatedNextInputTokens: data.estimatedNextInputTokens ?? data.count,
				remainingInputTokens:
					data.remainingInputTokens ??
					(data.reason === "request-context-estimate-exceeds-provider-window"
						? null
						: 48000 - data.usage.inputTokens),
				hypotheticalNextActualInputTokens: null,
			});
		if (type === "finished") {
			current.failure = data.fatal;
			current.submittedAnswers = Object.values(data.controller?.answers ?? {})
				.flatMap(Object.values)
				.filter((a) => a.status === "submitted").length;
			current.entryStatus = data.entryStatus;
			current.estimateToActualRatio = current.actualInputTokens
				? current.estimatedInputTokens / current.actualInputTokens
				: null;
			current = null;
		}
	}
	return {
		kind: "B121-offline-harness-diagnostics",
		sessions,
		limitations: [
			"Byte counts describe serialized history, not token counts.",
			"Estimate ratios describe executed requests only; the actual cost of a blocked request is unknown.",
			"A successful transport does not establish library usability.",
		],
	};
}
