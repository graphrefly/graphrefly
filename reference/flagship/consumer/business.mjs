// The spending-alerts business rules and passive formats, shared by the graph arm and the
// plain arm (the brief's "same business algorithm version"). No coordination lives here:
// no tables, no ordering, no admission. The verifier does not import this file.

import { createHash } from "node:crypto";

// ---- Passive formats --------------------------------------------------------

// Canonical JSON: object keys sorted, no whitespace.
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}
export const hash = (v) => `sha256:${createHash("sha256").update(typeof v === "string" ? v : canonical(v)).digest("hex")}`;

export const OCCURRENCE_SCHEMA = "graphrefly/causal-occurrence-contract/v1@contract-v2";

// D791: an occurrence is { revisionDomain, occurrenceId, revision, sourceRefs, value, digest }.
// Its exact reference is everything but the value; the digest binds the value.
export const occurrenceDigest = (o) => hash({
  schema: OCCURRENCE_SCHEMA, revisionDomain: o.revisionDomain, occurrenceId: o.occurrenceId,
  revision: o.revision, value: o.value, sourceRefs: o.sourceRefs,
});
export const refOf = (o) => ({
  revisionDomain: o.revisionDomain, occurrenceId: o.occurrenceId, revision: o.revision,
  digest: o.digest, sourceRefs: o.sourceRefs,
});
export const keyOf = (o) => canonical(refOf(o));

// A malformed occurrence names the first rule it breaks; a well-formed one returns null.
export function malformed(o) {
  if (!o || typeof o !== "object") return "not-an-object";
  if (typeof o.revisionDomain !== "string" || !o.revisionDomain) return "revision-domain";
  if (typeof o.occurrenceId !== "string" || !o.occurrenceId) return "occurrence-id";
  if (!Number.isSafeInteger(o.revision) || o.revision < 1) return "revision";
  const refs = o.sourceRefs;
  if (!Array.isArray(refs) || !refs.length) return "source-refs";
  if (new Set(refs.map(canonical)).size !== refs.length) return "source-refs";
  if (o.digest !== occurrenceDigest(o)) return "digest";
  return null;
}

// An evaluation (the occurrence value) carries the vendor's ordered amounts with the current
// transaction last, and the exact profile and policy it is evaluated under.
export const inputDigest = (v) => hash({ profileRef: v.profileRef, profile: v.profile, transaction: v.transaction, prefix: v.prefix });
export const policyDigest = (v) => hash(v.policy);

// ---- Business rules (TS pipeline.ts) ---------------------------------------

export function anomalyScore(evaluation, stats) {
  const { transaction: txn, profile } = evaluation;
  const scale = stats.std > 0 ? stats.std : Math.max(stats.mean, 1);
  return {
    zScore: (txn.amount - stats.mean) / scale,
    dailyRatio: txn.amount / Math.max(profile.dailyAverage, 1),
    categoryFamiliarity: profile.typicalCategories.includes(txn.category) ? "known" : "unknown",
  };
}

export function thresholdGate(evaluation, score) {
  const { zThreshold, dailyRatioThreshold } = evaluation.policy;
  return {
    flagged: score.zScore > zThreshold || score.dailyRatio > dailyRatioThreshold || score.categoryFamiliarity === "unknown",
    threshold: zThreshold,
  };
}

export function reasonFactors(evaluation, score, gate) {
  if (!gate.flagged) return { factors: [], severity: "low" };
  const { zThreshold, dailyRatioThreshold } = evaluation.policy;
  const factors = [];
  if (score.zScore > zThreshold) factors.push(`Amount is ${score.zScore.toFixed(2)}σ above this vendor's historical mean.`);
  if (score.dailyRatio > dailyRatioThreshold) factors.push(`Amount is ${score.dailyRatio.toFixed(1)}× the user's daily average.`);
  if (score.categoryFamiliarity === "unknown") factors.push("Category is outside the user's typical spend profile.");
  return { factors, severity: factors.length >= 3 ? "high" : factors.length === 2 ? "medium" : "low" };
}

export function alertMessage(evaluation, reason) {
  const txn = evaluation.transaction;
  if (!reason.factors.length) return `Transaction ${txn.id} ($${txn.amount.toFixed(2)} at ${txn.vendor}) — normal.`;
  return [
    `Transaction ${txn.id} flagged — severity: ${reason.severity}.`,
    `Vendor: ${txn.vendor}  Amount: $${txn.amount.toFixed(2)}  Category: ${txn.category}`,
    "Reasoning:",
    ...reason.factors.map((f) => `  • ${f}`),
  ].join("\n");
}

// ---- Request and proposal (brief section 4) ---------------------------------

export const REQUEST_SCHEMA = "spending-alerts/request-material/v1";
export const PROPOSAL_SCHEMA = "spending-alerts/effect-proposal/v1";
export const MAX_PAYLOAD_BYTES = 4096;

// The exact request for a flagged evaluation: the payload, and every binding the host and the
// admission check (occurrence, inputs, policy, code, runtime, destination, host epoch).
export function requestBody(occ, reason, message, binding) {
  const v = occ.value;
  return {
    schema: REQUEST_SCHEMA,
    occurrence: refOf(occ),
    effectId: `alert:${v.evaluationRef}`,
    payloadText: `${canonical({ transactionId: v.transaction.id, vendor: v.transaction.vendor, severity: reason.severity, message })}\n`,
    inputDigest: inputDigest(v),
    policyDigest: policyDigest(v),
    sourceDigest: binding.sourceDigest,
    runtimeDigest: binding.runtimeDigest,
    destinationRef: binding.destinationRef,
    hostEpoch: binding.hostEpoch,
  };
}

export function proposalOf(body) {
  const requestDigest = hash(body);
  const p = { occurrence: body.occurrence, effectId: body.effectId, requestDigest };
  return { ...p, proposalDigest: hash({ schema: PROPOSAL_SCHEMA, ...p }) };
}

// What a receipt for a normal (unflagged) evaluation binds in place of a request digest.
export const noPublishDigest = (v) => hash({ kind: "no-publish", evaluationRef: v.evaluationRef });

export const admissionRefOf =(proposal, receiptRef, grantRef, hostEpoch) =>
  hash({ proposalDigest: proposal.proposalDigest, receiptRef, grantRef, hostEpoch });

// D184/D791: an effect outcome's value is a DataResult; a known failure is kind "error" with
// a DataIssue, never a protocol ERROR.
export const ok = (value) => ({ kind: "ok", value });
export const issue = (code, message) => ({ kind: "error", error: { kind: "issue", code, message } });
