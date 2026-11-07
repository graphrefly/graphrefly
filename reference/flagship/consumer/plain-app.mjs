// The plain-code arm (brief section 6): the same business rules, host and grants as the
// graph arm, with the coordination written by hand as tables and one reconcile pass per
// input. It imports nothing from GraphReFly. It answers the same questions through the same
// methods, so every scenario runs on both arms against the same verifier.

import { vendorStats } from "./vendor-stats.mjs";
import * as b from "./business.mjs";
import { inboxHost } from "./inbox-host.mjs";

const OUTCOME_STATES = ["succeeded", "failed", "cancelled", "reconcile-required", "unknown"];

export function createApp({ binding, inboxPath, fs, limits: given = {} }) {
  const limits = { occurrences: 64, evidence: 64, receipts: 64, records: 64, ...given };
  const domains = new Map(); // revisionDomain -> { high, digests, held }
  let size = 0;
  const accepted = new Map(); // key -> occurrence, in acceptance order
  const business = new Map(); // key -> { occ, stats, score, gate, reason, message, request, proposal }
  const issues = [];
  const facts = new Map();
  const receipts = [];
  let local = { tick: 0, stop: false, grants: [] };
  const status = new Map(); // key -> admission decision
  const grantUse = new Map();
  const released = [];
  const outcomes = new Map(); // proposalDigest -> outcome
  const ledgerIssues = [];
  const evidence = new Map();
  let retentionGap = 0;
  const pendingOutcomes = [];

  const host = inboxHost({
    binding, path: inboxPath, fs, records: limits.records,
    report: (o) => { if (reconciling) pendingOutcomes.push(o); else apply("outcomes", [o]); },
  });
  let reconciling = false;

  function acceptOccurrence(o) {
    const bad = b.malformed(o);
    const note = (code) => issues.push({ kind: "issue", code, revisionDomain: o?.revisionDomain, occurrenceId: o?.occurrenceId, revision: o?.revision });
    if (bad) return note(`malformed-${bad}`);
    const d = domains.get(o.revisionDomain) ?? { high: 0, digests: new Map(), held: new Map() };
    domains.set(o.revisionDomain, d);
    const known = d.digests.get(o.revision) ?? d.held.get(o.revision)?.digest;
    if (known) return note(known === o.digest ? "exact-replay" : "replay-conflict");
    if (size >= limits.occurrences) return note("capacity");
    size += 1;
    if (o.revision > d.high + 1) { d.held.set(o.revision, o); return; }
    for (let next = o; next; next = d.held.get(d.high + 1)) {
      d.held.delete(next.revision);
      d.high = next.revision;
      d.digests.set(next.revision, next.digest);
      const key = b.keyOf(next);
      accepted.set(key, next);
      evaluate(key, next);
      if (evidence.size < limits.evidence) evidence.set(key, next);
      else retentionGap += 1;
    }
  }

  function evaluate(key, occ) {
    const v = occ.value;
    const stats = vendorStats(v.prefix);
    const score = b.anomalyScore(v, stats);
    const gate = b.thresholdGate(v, score);
    const reason = b.reasonFactors(v, score, gate);
    const message = b.alertMessage(v, reason);
    const request = gate.flagged ? b.requestBody(occ, reason, message, binding) : null;
    business.set(key, { occ, stats, score, gate, reason, message, request, proposal: request && b.proposalOf(request) });
  }

  function decide(key, occ) {
    const v = occ.value;
    const base = { key, occurrence: b.refOf(occ) };
    const f = facts.get(occ.revisionDomain);
    if (!f || f.watermark < occ.revision) return { ...base, state: "pending", code: "currentness-pending" };
    if (f.policyRef !== v.policyRef || f.policyDigest !== b.policyDigest(v)) return { ...base, state: "rejected", code: "not-current", final: true };
    const r = business.get(key);
    if (!r) return { ...base, state: "pending", code: "business-pending" };
    if (!r.request) return { ...base, state: "admitted", code: "no-publish", final: true, effect: null };
    const p = r.proposal;
    const mine = receipts.filter((x) => b.canonical(x.occurrence) === key && x.requestDigest === p.requestDigest
      && x.inputDigest === r.request.inputDigest && x.policyDigest === r.request.policyDigest
      && x.sourceDigest === binding.sourceDigest && x.runtimeDigest === binding.runtimeDigest
      && x.verifierRevision === binding.verifierRevision && x.numericDomain === binding.numericDomain);
    if (!mine.length) return { ...base, state: "pending", code: "verification-pending" };
    if (new Set(mine.map(b.canonical)).size > 1) return { ...base, state: "pending", code: "verification-conflict" };
    if (mine[0].verdict !== "pass") return { ...base, state: "rejected", code: "verification-failed", final: true };
    const grants = local.grants.filter((gr) => b.canonical(gr.occurrence) === key && gr.requestDigest === p.requestDigest
      && gr.destinationRef === binding.destinationRef && gr.hostEpoch === binding.hostEpoch);
    if (!grants.length) return { ...base, state: "pending", code: "grant-pending" };
    if (new Set(grants.map(b.canonical)).size > 1) return { ...base, state: "pending", code: "grant-conflict" };
    const gr = grants[0];
    if (local.tick < gr.validFrom) return { ...base, state: "pending", code: "grant-not-yet-valid" };
    if (gr.revoked || local.stop || local.tick > gr.validThrough) return { ...base, state: "rejected", code: "grant-not-in-force", final: true };
    const used = grantUse.get(gr.grantRef) ?? 0;
    if (used >= gr.maxWrites) return { ...base, state: "rejected", code: "write-budget", final: true };
    grantUse.set(gr.grantRef, used + 1);
    const admissionRef = b.admissionRefOf(p, mine[0].receiptRef, gr.grantRef, binding.hostEpoch);
    return { ...base, state: "admitted", code: "admitted", final: true, effect: { proposal: p, admissionRef, request: r.request } };
  }

  function settleOutcome(o) {
    const e = [...business.entries()].find(([, r]) => r.proposal?.proposalDigest === o.proposalDigest);
    const a = e && status.get(e[0]);
    const exact = e && a?.state === "admitted" && a.effect?.admissionRef === o.admissionRef
      && e[1].proposal.requestDigest === o.requestDigest && e[1].proposal.effectId === o.effectId
      && b.canonical(o.occurrence) === e[0];
    if (!exact) return ledgerIssues.push({ code: "outcome-mismatch", proposalDigest: o.proposalDigest });
    if (!OUTCOME_STATES.includes(o.state) || (o.state === "succeeded") !== (o.result?.kind === "ok")) {
      return ledgerIssues.push({ code: "outcome-malformed", proposalDigest: o.proposalDigest });
    }
    const first = outcomes.get(o.proposalDigest);
    if (first) {
      if (b.canonical(first) !== b.canonical(o)) ledgerIssues.push({ code: "outcome-conflict", proposalDigest: o.proposalDigest });
      return;
    }
    outcomes.set(o.proposalDigest, o);
  }

  // One input, then one pass over everything it can change.
  function apply(laneId, values) {
    for (const v of values) {
      if (laneId === "evaluations") acceptOccurrence(v);
      else if (laneId === "current") {
        const old = facts.get(v.revisionDomain);
        if (!old || v.watermark >= old.watermark) facts.set(v.revisionDomain, v);
      } else if (laneId === "receipts") { if (receipts.length < limits.receipts) receipts.push(v); }
      else if (laneId === "local") local = v;
      else if (laneId === "outcomes") settleOutcome(v);
    }
    reconcile();
  }

  function reconcile() {
    reconciling = true;
    const toHost = [];
    for (const [key, occ] of accepted) {
      const prev = status.get(key);
      if (prev?.final) continue;
      const next = decide(key, occ);
      if (prev?.code === next.code) continue;
      status.set(key, next);
      if (next.state === "admitted") { released.push({ key, occurrence: next.occurrence, effect: next.effect }); if (next.effect) toHost.push(next.effect); }
    }
    for (const effect of toHost) host.accept(effect);
    reconciling = false;
    // An outcome the host reported synchronously (a refusal) is applied after this pass.
    const late = pendingOutcomes.splice(0);
    if (late.length) apply("outcomes", late);
  }

  function ledger() {
    const t = { proposed: 0, pendingAdmission: 0, rejected: 0, admitted: 0, active: 0, succeeded: 0, failed: 0, cancelled: 0, reconcileRequired: 0, unknown: 0 };
    const entries = [];
    for (const [key, a] of status) {
      const r = business.get(key);
      const o = r?.proposal ? outcomes.get(r.proposal.proposalDigest) : undefined;
      let publication = null;
      if (!r?.proposal) publication = a.state === "admitted" ? "no-publish" : a.state === "rejected" ? "rejected" : null;
      else {
        t.proposed += 1;
        if (a.state === "rejected") { t.rejected += 1; publication = "rejected"; }
        else if (a.state !== "admitted") t.pendingAdmission += 1;
        else {
          t.admitted += 1;
          if (!o) t.active += 1;
          else { t[o.state === "reconcile-required" ? "reconcileRequired" : o.state] += 1; publication = o.state; }
        }
      }
      entries.push({ key, admission: a.state, code: a.code, publication, outcome: o?.state ?? null });
    }
    return { totals: t, entries, issues: [...ledgerIssues] };
  }

  function terminals() {
    const out = new Map();
    for (const e of ledger().entries) {
      if (!e.publication || !business.has(e.key)) continue;
      out.set(e.key, { key: e.key, assessment: business.get(e.key).gate.flagged ? "flagged" : "normal", publication: e.publication });
    }
    return out;
  }

  return {
    arm: "plain",
    journal: host.journal,
    push(laneId, value) { apply(laneId, [value]); },
    pushMany(laneId, values) { apply(laneId, values); },
    async drain() { await host.idle(); },
    business() {
      return new Map([...business].map(([k, r]) => [k, { occ: r.occ, stats: r.stats, score: r.score, gate: r.gate, reason: r.reason, message: r.message, request: r.request }]));
    },
    proposals: () => [...business].filter(([, r]) => r.proposal).map(([key, r]) => ({ key, proposal: r.proposal, request: r.request })),
    admissions: () => new Map(status),
    released: () => [...released],
    ledger,
    terminals,
    coverage() {
      const entries = [...evidence].map(([key, occ]) => {
        const r = business.get(key);
        const digest = r?.proposal ? r.proposal.requestDigest : b.noPublishDigest(occ.value);
        const mine = receipts.filter((x) => b.canonical(x.occurrence) === key);
        const fits = (x) => x.requestDigest === digest && x.inputDigest === b.inputDigest(occ.value)
          && x.policyDigest === b.policyDigest(occ.value) && x.sourceDigest === binding.sourceDigest
          && x.runtimeDigest === binding.runtimeDigest;
        return { key, input: "included", codeBinding: "included", verification: !mine.length ? "unavailable" : mine.some(fits) ? "included" : "stale" };
      });
      return { entries, retentionGap, complete: retentionGap === 0 && entries.every((e) => e.verification === "included") };
    },
    runEnd() {
      const t = ledger().totals;
      const ended = terminals();
      const reasons = [];
      if ([...domains.values()].some((d) => d.held.size)) reasons.push("revision-gap");
      if ([...accepted.keys()].some((k) => !ended.has(k))) reasons.push("open-occurrence");
      if (t.active) reasons.push("active-effect");
      if (t.unknown || t.reconcileRequired) reasons.push("unresolved-outcome");
      return { ready: reasons.length === 0, reasons };
    },
    issues: () => [...issues, ...ledgerIssues],
    gaps: () => [...domains].filter(([, d]) => d.held.size).map(([revisionDomain, d]) => ({ kind: "gap", revisionDomain, missingRevision: d.high + 1, held: [...d.held.keys()].sort((x, y) => x - y) })),
  };
}
