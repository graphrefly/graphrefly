// The independent verifier (brief section 6). It imports no consumer code, only node:crypto:
// its statistics are two-pass (not Welford), its business rules, formatting, canonical
// encoding and digests are written again here from the frozen rules, and it reads the
// candidate's observed values only to compare them. It never reads a graph label as the
// expected answer.

import { createHash } from "node:crypto";

export const VERIFIER_REVISION = "spending-verifier-v1";
export const NUMERIC_DOMAIN = "spending-finite-v1"; // finite amounts; tolerance 1e-10 * max(1, |expected|)

const enc = (v) => Array.isArray(v) ? `[${v.map(enc).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${enc(v[k])}`).join(",")}}`
  : JSON.stringify(v);
const sha = (v) => `sha256:${createHash("sha256").update(typeof v === "string" ? v : enc(v)).digest("hex")}`;
export const encode = enc;
export const digest = sha;

export const occurrenceDigest = (o) => sha({
  schema: "graphrefly/causal-occurrence-contract/v1@contract-v2", revisionDomain: o.revisionDomain,
  occurrenceId: o.occurrenceId, revision: o.revision, value: o.value, sourceRefs: o.sourceRefs,
});
const ref = (o) => ({ revisionDomain: o.revisionDomain, occurrenceId: o.occurrenceId, revision: o.revision, digest: o.digest, sourceRefs: o.sourceRefs });
export const keyOf = (o) => enc(ref(o));

// What the frozen consumer policy says this evaluation must produce.
export function expected(occ, binding) {
  const v = occ.value;
  const xs = v.prefix;
  const n = xs.length;
  const mean = xs.reduce((a, x) => a + x, 0) / n;
  const variance = n >= 2 ? xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1) : 0; // sample
  const std = Math.sqrt(variance);
  const x = v.transaction.amount;
  const zScore = (x - mean) / (std > 0 ? std : Math.max(mean, 1));
  const dailyRatio = x / Math.max(v.profile.dailyAverage, 1);
  const familiar = v.profile.typicalCategories.includes(v.transaction.category);
  const zOver = zScore > v.policy.zThreshold;
  const ratioOver = dailyRatio > v.policy.dailyRatioThreshold;
  const flagged = zOver || ratioOver || !familiar;
  const factors = [];
  if (flagged && zOver) factors.push(`Amount is ${zScore.toFixed(2)}σ above this vendor's historical mean.`);
  if (flagged && ratioOver) factors.push(`Amount is ${dailyRatio.toFixed(1)}× the user's daily average.`);
  if (flagged && !familiar) factors.push("Category is outside the user's typical spend profile.");
  const severity = factors.length >= 3 ? "high" : factors.length === 2 ? "medium" : "low";
  const t = v.transaction;
  const message = flagged
    ? [`Transaction ${t.id} flagged — severity: ${severity}.`, `Vendor: ${t.vendor}  Amount: $${t.amount.toFixed(2)}  Category: ${t.category}`, "Reasoning:", ...factors.map((f) => `  • ${f}`)].join("\n")
    : `Transaction ${t.id} ($${t.amount.toFixed(2)} at ${t.vendor}) — normal.`;
  const request = flagged ? {
    schema: "spending-alerts/request-material/v1", occurrence: ref(occ), effectId: `alert:${v.evaluationRef}`,
    payloadText: `${enc({ transactionId: t.id, vendor: t.vendor, severity, message })}\n`,
    inputDigest: sha({ profileRef: v.profileRef, profile: v.profile, transaction: v.transaction, prefix: v.prefix }),
    policyDigest: sha(v.policy), sourceDigest: binding.sourceDigest, runtimeDigest: binding.runtimeDigest,
    destinationRef: binding.destinationRef, hostEpoch: binding.hostEpoch,
  } : null;
  return { mean, std, zScore, dailyRatio, familiar, zOver, ratioOver, flagged, factors, severity, message, request };
}

const close = (a, e) => Number.isFinite(a) && Math.abs(a - e) <= 1e-10 * Math.max(1, Math.abs(e));

// Compares what the candidate computed for one evaluation with the expected values.
export function verify(observed, exp, policy) {
  if (!observed || observed.score === undefined || observed.message === undefined) return { verdict: "unavailable", mismatches: ["missing"] };
  const m = [];
  if (!close(observed.stats.mean, exp.mean)) m.push("mean");
  if (!close(observed.stats.std, exp.std)) m.push("std");
  if (!close(observed.score.zScore, exp.zScore)) m.push("zScore");
  if (!close(observed.score.dailyRatio, exp.dailyRatio)) m.push("dailyRatio");
  // Strict > on the observed numbers must land on the same side as on the expected ones.
  if ((observed.score.zScore > policy.zThreshold) !== exp.zOver) m.push("zThreshold-side");
  if ((observed.score.dailyRatio > policy.dailyRatioThreshold) !== exp.ratioOver) m.push("ratioThreshold-side");
  if ((observed.score.categoryFamiliarity === "known") !== exp.familiar) m.push("familiarity");
  if (observed.gate.flagged !== exp.flagged) m.push("flagged");
  if (enc(observed.reason.factors) !== enc(exp.factors) || observed.reason.severity !== exp.severity) m.push("reason");
  if (observed.message !== exp.message) m.push("message");
  if (enc(observed.request ?? null) !== enc(exp.request)) m.push("request");
  return { verdict: m.length ? "fail" : "pass", mismatches: m };
}

// A receipt states what was checked: this exact occurrence, its inputs and policy, the code
// and runtime that computed it, the request it proposed (or that it proposed none), and the
// verdict.
export function receipt(occ, observed, verdict, binding) {
  const v = occ.value;
  const requestDigest = observed?.request ? sha(observed.request) : sha({ kind: "no-publish", evaluationRef: v.evaluationRef });
  const body = {
    verifierRevision: VERIFIER_REVISION, occurrence: ref(occ),
    inputDigest: sha({ profileRef: v.profileRef, profile: v.profile, transaction: v.transaction, prefix: v.prefix }),
    policyDigest: sha(v.policy), sourceDigest: binding.sourceDigest, runtimeDigest: binding.runtimeDigest,
    requestDigest, numericDomain: NUMERIC_DOMAIN, verdict,
  };
  return { receiptRef: sha(body), ...body };
}

// D791 conservation, checked from the totals alone.
export const conserved = (t) => t.proposed === t.pendingAdmission + t.rejected + t.admitted
  && t.admitted === t.active + t.succeeded + t.failed + t.cancelled + t.reconcileRequired + t.unknown;
