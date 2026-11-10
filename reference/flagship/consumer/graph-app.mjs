// The graph arm of the B139 spending-alerts flagship on the reference kernel. Non-normative.
//
// Every coordination step is a node with declared edges, and every fact is DATA (D791):
// occurrence identity, currentness, admission, release, conservation, terminals and
// coverage. The kernel is used as it is: no kernel change, no PAUSE/RESUME/PULL, no up
// channel. The one protocol feature beyond DATA, batch and private state is the quiet node
// (H6) at `release`, the lifecycle port that must stay silent on every path that releases
// nothing.
//
//   evaluations ─► occurrences ─┬─► vendorStats ─┐
//                               ├────────────────┴─► anomalyScore ─► thresholdGate ─┬─► reasonFactors ─► alertMessage
//                               │                                                   └──────────┬─────────────┘
//                               │                                                           requests
//   current, receipts, local ───┴──────────────────────────────────────────────► admission ◄──┘
//                                                                                    │
//                                                     release (quiet) ─► inbox host ─┤
//   outcomes ◄── host reports ─────────────────────────────────────────► ledger ◄────┘
//   terminals ◄─ thresholdGate, alertMessage, ledger      evidence ◄─ occurrences, requests, receipts
//   runEnd ◄──── occurrences, terminals, ledger

import { createGraph } from "../../kernel/kernel.mjs";
import { observe } from "../../modules/observe.mjs";
import { vendorStats } from "./vendor-stats.mjs";
import * as b from "./business.mjs";
import { inboxHost } from "./inbox-host.mjs";

// The source files the business nodes' functions come from (brief section 4, source binding).
// Every other node's function is in this file.
export const sources = {
  vendorStats: "flagship/consumer/vendor-stats.mjs",
  anomalyScore: "flagship/consumer/business.mjs",
  thresholdGate: "flagship/consumer/business.mjs",
  reasonFactors: "flagship/consumer/business.mjs",
  alertMessage: "flagship/consumer/business.mjs",
  requests: "flagship/consumer/business.mjs",
};

const rows = (d) => d.waves.flat();
const OUTCOME_STATES = ["succeeded", "failed", "cancelled", "reconcile-required", "unknown"];

export function createApp({ binding, inboxPath, fs, limits: given = {} }) {
  const limits = { occurrences: 64, evidence: 64, receipts: 64, records: 64, ...given };
  const failures = [];
  const g = createGraph({ report: (e) => failures.push(e) });
  const lane = (id) => g.state(id);
  const node = (id, deps, fn, opts) => g.node(id, deps, fn, opts);

  // One output row per input row that has a key.
  const each = (f) => (ctx) => {
    for (const r of rows(ctx.deps[0])) {
      if (r.key === undefined) continue;
      const out = f(r);
      if (out) ctx.down([["DATA", { key: r.key, occ: r.occ, ...out }]]);
    }
  };
  // Same-key join (D791): each dependency's rows are held by occurrence key, and a key goes
  // out once every dependency has delivered it. Nothing is taken from another key or from a
  // dependency's latest value.
  const join = (f) => (ctx) => {
    const held = ctx.state.get() ?? ctx.deps.map(() => new Map());
    const touched = new Set();
    ctx.deps.forEach((d, i) => {
      for (const r of rows(d)) if (r.key !== undefined) { held[i].set(r.key, r); touched.add(r.key); }
    });
    for (const key of touched) {
      if (!held.every((h) => h.has(key))) continue;
      const parts = held.map((h) => h.get(key));
      held.forEach((h) => h.delete(key));
      ctx.down([["DATA", { key, occ: parts[0].occ, ...f(...parts) }]]);
    }
    ctx.state.set(held);
  };

  // ---- Inputs: plain state nodes the host writes ---------------------------
  for (const id of ["evaluations", "current", "receipts", "local", "outcomes"]) lane(id);

  // ---- Identity and order (D791) --------------------------------------------
  // Per revision domain, a revision is accepted only as highWater+1; a later one is held as
  // a visible gap until the missing revisions arrive. Replays are quiet; a different
  // occurrence at an accepted revision is a conflict and changes nothing. Held and accepted
  // occurrences together are bounded; past the bound an occurrence is refused (fail closed).
  node("occurrences", ["evaluations"], (ctx) => {
    const s = ctx.state.get() ?? { domains: new Map(), size: 0 };
    const issue = (code, o) => ctx.down([["DATA", { kind: "issue", code, revisionDomain: o?.revisionDomain, occurrenceId: o?.occurrenceId, revision: o?.revision }]]);
    for (const o of rows(ctx.deps[0])) {
      const bad = b.malformed(o);
      if (bad) { issue(`malformed-${bad}`, o); continue; }
      const d = s.domains.get(o.revisionDomain) ?? { high: 0, digests: new Map(), held: new Map() };
      s.domains.set(o.revisionDomain, d);
      const known = d.digests.get(o.revision) ?? d.held.get(o.revision)?.digest;
      if (known) { issue(known === o.digest ? "exact-replay" : "replay-conflict", o); continue; }
      if (s.size >= limits.occurrences) { issue("capacity", o); continue; }
      s.size += 1;
      if (o.revision > d.high + 1) d.held.set(o.revision, o);
      else {
        for (let next = o; next; next = d.held.get(d.high + 1)) {
          d.held.delete(next.revision);
          d.high = next.revision;
          d.digests.set(next.revision, next.digest);
          ctx.down([["DATA", { kind: "accepted", key: b.keyOf(next), occ: next }]]);
        }
      }
      ctx.down([["DATA", { kind: "gap", revisionDomain: o.revisionDomain, missingRevision: d.held.size ? d.high + 1 : null, held: [...d.held.keys()].sort((x, y) => x - y) }]]);
    }
    ctx.state.set(s);
  });

  // ---- Business chain (TS pipeline.ts) --------------------------------------
  node("vendorStats", ["occurrences"], each((r) => ({ stats: vendorStats(r.occ.value.prefix) })));
  node("anomalyScore", ["occurrences", "vendorStats"], join((o, s) => ({ score: b.anomalyScore(o.occ.value, s.stats) })));
  node("thresholdGate", ["anomalyScore"], each((r) => ({ score: r.score, gate: b.thresholdGate(r.occ.value, r.score) })));
  node("reasonFactors", ["thresholdGate"], each((r) => ({ reason: b.reasonFactors(r.occ.value, r.score, r.gate) })));
  node("alertMessage", ["reasonFactors"], each((r) => ({ reason: r.reason, message: b.alertMessage(r.occ.value, r.reason) })));
  node("requests", ["thresholdGate", "alertMessage"], join((t, m) => {
    if (!t.gate.flagged) return { flagged: false, request: null, proposal: null };
    const request = b.requestBody(t.occ, m.reason, m.message, binding);
    return { flagged: true, request, proposal: b.proposalOf(request) };
  }));

  // ---- Admission (brief section 4) ------------------------------------------
  // Per occurrence, decided once. The occurrence is current when its domain's current fact
  // names the same policy and its watermark has reached the revision. A flagged evaluation
  // also needs exactly one receipt bound to this exact occurrence, input, policy, code,
  // runtime and request, with verdict pass, and exactly one grant for this occurrence,
  // request, destination and host epoch that is in force and within its write budget.
  // Currentness is checked again when the effect is admitted, so a revoked policy stops a
  // late admission. A missing fact keeps the occurrence pending; it never counts as yes.
  node("admission", ["occurrences", "requests", "current", "receipts", "local"], (ctx) => {
    const s = ctx.state.get() ?? {
      occ: new Map(), req: new Map(), facts: new Map(), receipts: [],
      local: { tick: 0, stop: false, grants: [] }, status: new Map(), grantUse: new Map(),
    };
    const [occD, reqD, curD, recD, locD] = ctx.deps;
    for (const r of rows(occD)) if (r.kind === "accepted") s.occ.set(r.key, r.occ);
    for (const r of rows(reqD)) s.req.set(r.key, r);
    for (const f of rows(curD)) {
      const old = s.facts.get(f.revisionDomain);
      if (!old || f.watermark >= old.watermark) s.facts.set(f.revisionDomain, f); // a watermark never moves back
    }
    for (const rc of rows(recD)) if (s.receipts.length < limits.receipts) s.receipts.push(rc);
    for (const l of rows(locD)) s.local = l;

    const decide = (key, occ) => {
      const v = occ.value;
      const base = { key, occurrence: b.refOf(occ) };
      const pending = (code) => ({ ...base, state: "pending", code });
      const rejected = (code) => ({ ...base, state: "rejected", code, final: true });
      const f = s.facts.get(occ.revisionDomain);
      if (!f || f.watermark < occ.revision) return pending("currentness-pending");
      if (f.policyRef !== v.policyRef || f.policyDigest !== b.policyDigest(v)) return rejected("not-current");
      const r = s.req.get(key);
      if (!r) return pending("business-pending");
      if (!r.request) return { ...base, state: "admitted", code: "no-publish", final: true, effect: null };
      const p = r.proposal;
      const receipts = s.receipts.filter((x) => b.canonical(x.occurrence) === key
        && x.requestDigest === p.requestDigest && x.inputDigest === r.request.inputDigest
        && x.policyDigest === r.request.policyDigest && x.sourceDigest === binding.sourceDigest
        && x.runtimeDigest === binding.runtimeDigest && x.verifierRevision === binding.verifierRevision
        && x.numericDomain === binding.numericDomain);
      if (!receipts.length) return pending("verification-pending");
      if (new Set(receipts.map(b.canonical)).size > 1) return pending("verification-conflict");
      if (receipts[0].verdict !== "pass") return rejected("verification-failed");
      const grants = s.local.grants.filter((gr) => b.canonical(gr.occurrence) === key
        && gr.requestDigest === p.requestDigest && gr.destinationRef === binding.destinationRef
        && gr.hostEpoch === binding.hostEpoch);
      if (!grants.length) return pending("grant-pending");
      if (new Set(grants.map(b.canonical)).size > 1) return pending("grant-conflict");
      const gr = grants[0];
      if (s.local.tick < gr.validFrom) return pending("grant-not-yet-valid");
      if (gr.revoked || s.local.stop || s.local.tick > gr.validThrough) return rejected("grant-not-in-force");
      const used = s.grantUse.get(gr.grantRef) ?? 0;
      if (used >= gr.maxWrites) return rejected("write-budget");
      s.grantUse.set(gr.grantRef, used + 1);
      const admissionRef = b.admissionRefOf(p, receipts[0].receiptRef, gr.grantRef, binding.hostEpoch);
      return { ...base, state: "admitted", code: "admitted", final: true, effect: { proposal: p, admissionRef, request: r.request } };
    };
    for (const [key, occ] of s.occ) {
      const prev = s.status.get(key);
      if (prev?.final) continue;
      const next = decide(key, occ);
      if (prev?.code === next.code) continue;
      s.status.set(key, next);
      ctx.down([["DATA", next]]);
    }
    ctx.state.set(s);
  });

  // ---- Release: the quiet lifecycle port (D791, H6) -------------------------
  // An admission goes out in its own array, as a later wave. Admission decides each
  // occurrence once, so each goes out once. Pending, rejected and replayed paths send
  // nothing here: no PENDING, DATA or RESOLVED.
  node("release", ["admission"], (ctx) => {
    for (const r of rows(ctx.deps[0])) {
      if (r.state === "admitted") ctx.down([["DATA", { key: r.key, occurrence: r.occurrence, effect: r.effect }]]);
    }
  }, { quiet: true });

  // ---- Conservation (D791) --------------------------------------------------
  // proposed = pendingAdmission + rejected + admitted
  // admitted = active + succeeded + failed + cancelled + reconcileRequired + unknown
  // An outcome settles an effect only if it names that exact admitted proposal, request and
  // admission. A wrong one is an issue and settles nothing; a repeat adds nothing; a
  // different second outcome does not replace the first.
  node("ledger", ["requests", "admission", "outcomes"], (ctx) => {
    const s = ctx.state.get() ?? { entries: new Map(), issues: [] };
    const entry = (key) => s.entries.get(key) ?? s.entries.set(key, { key, proposal: null, admission: "pending", code: null, admissionRef: null, outcome: null }).get(key);
    const [reqD, admD, outD] = ctx.deps;
    for (const r of rows(reqD)) entry(r.key).proposal = r.proposal;
    for (const a of rows(admD)) Object.assign(entry(a.key), { admission: a.state, code: a.code, admissionRef: a.effect?.admissionRef ?? null });
    for (const o of rows(outD)) {
      const e = [...s.entries.values()].find((x) => x.proposal && x.proposal.proposalDigest === o.proposalDigest);
      const exact = e && e.admission === "admitted" && e.admissionRef === o.admissionRef
        && e.proposal.requestDigest === o.requestDigest && e.proposal.effectId === o.effectId
        && b.canonical(o.occurrence) === e.key;
      if (!exact) { s.issues.push({ code: "outcome-mismatch", proposalDigest: o.proposalDigest }); continue; }
      if (!OUTCOME_STATES.includes(o.state) || (o.state === "succeeded") !== (o.result?.kind === "ok")) {
        s.issues.push({ code: "outcome-malformed", proposalDigest: o.proposalDigest });
        continue;
      }
      if (e.outcome) {
        if (b.canonical(e.outcome) !== b.canonical(o)) s.issues.push({ code: "outcome-conflict", proposalDigest: o.proposalDigest });
        continue;
      }
      e.outcome = o;
    }
    ctx.state.set(s);
    ctx.down([["DATA", ledgerSnapshot(s)]]);
  });

  // ---- Business terminals: keyed fan-in of the declared branches (D791) -----
  // A key ends once its assessment, its explanation and its publication have all ended.
  // Absence never counts as an end.
  node("terminals", ["thresholdGate", "alertMessage", "ledger"], (ctx) => {
    const s = ctx.state.get() ?? { assessment: new Map(), explanation: new Set(), publication: new Map(), done: new Set() };
    const [gateD, msgD, ledD] = ctx.deps;
    for (const r of rows(gateD)) s.assessment.set(r.key, r.gate.flagged ? "flagged" : "normal");
    for (const r of rows(msgD)) s.explanation.add(r.key);
    for (const l of rows(ledD)) for (const e of l.entries) if (e.publication) s.publication.set(e.key, e.publication);
    for (const [key, publication] of s.publication) {
      if (s.done.has(key) || !s.assessment.has(key) || !s.explanation.has(key)) continue;
      s.done.add(key);
      ctx.down([["DATA", { key, assessment: s.assessment.get(key), publication }]]);
    }
    ctx.state.set(s);
  });

  // ---- Retained evidence and coverage (D790) --------------------------------
  // Bounded: past `limits.evidence` occurrences the record is a retention gap and coverage is
  // not complete. Coverage is reported only; admission does not read it.
  node("evidence", ["occurrences", "requests", "receipts"], (ctx) => {
    const s = ctx.state.get() ?? { entries: new Map(), digests: new Map(), receipts: [], retentionGap: 0 };
    const [occD, reqD, recD] = ctx.deps;
    for (const r of rows(occD)) {
      if (r.kind !== "accepted") continue;
      if (s.entries.size < limits.evidence) s.entries.set(r.key, { key: r.key, input: b.inputDigest(r.occ.value), evaluation: r.occ.value });
      else s.retentionGap += 1;
    }
    for (const r of rows(reqD)) s.digests.set(r.key, r.proposal ? r.proposal.requestDigest : b.noPublishDigest(r.occ.value));
    for (const rc of rows(recD)) if (s.receipts.length < limits.receipts) s.receipts.push(rc);
    const entries = [...s.entries.values()].map((e) => {
      const mine = s.receipts.filter((x) => b.canonical(x.occurrence) === e.key);
      const fits = (x) => x.requestDigest === s.digests.get(e.key) && x.inputDigest === e.input
        && x.policyDigest === b.policyDigest(e.evaluation) && x.sourceDigest === binding.sourceDigest
        && x.runtimeDigest === binding.runtimeDigest;
      const verification = !mine.length ? "unavailable" : mine.some(fits) ? "included" : "stale";
      return { key: e.key, input: "included", codeBinding: "included", verification };
    });
    ctx.state.set(s);
    ctx.down([["DATA", {
      entries, retentionGap: s.retentionGap,
      complete: s.retentionGap === 0 && entries.every((e) => e.verification === "included"),
    }]]);
  });

  // ---- Normal end readiness (quiescence) ------------------------------------
  node("runEnd", ["occurrences", "terminals", "ledger"], (ctx) => {
    const s = ctx.state.get() ?? { accepted: new Set(), held: new Map(), ended: new Set(), totals: null };
    const [occD, termD, ledD] = ctx.deps;
    for (const r of rows(occD)) {
      if (r.kind === "accepted") s.accepted.add(r.key);
      if (r.kind === "gap") s.held.set(r.revisionDomain, r.held.length);
    }
    for (const r of rows(termD)) s.ended.add(r.key);
    for (const l of rows(ledD)) s.totals = l.totals;
    const t = s.totals;
    const reasons = [];
    if ([...s.held.values()].some((n) => n > 0)) reasons.push("revision-gap");
    if ([...s.accepted].some((k) => !s.ended.has(k))) reasons.push("open-occurrence");
    if (t && t.active) reasons.push("active-effect");
    if (t && (t.unknown || t.reconcileRequired)) reasons.push("unresolved-outcome");
    ctx.state.set(s);
    ctx.down([["DATA", { ready: reasons.length === 0, reasons }]]);
  });

  // ---- The host and the observers --------------------------------------------
  const host = inboxHost({ binding, path: inboxPath, fs, records: limits.records, report: (o) => g.set("outcomes", o) });
  g.subscribe("inbox-host", "release", (msgs) => {
    for (const [type, v] of msgs) if (type === "DATA" && v.effect) host.accept(v.effect);
  });
  const observed = ["occurrences", "vendorStats", "anomalyScore", "thresholdGate", "reasonFactors", "alertMessage",
    "requests", "admission", "release", "ledger", "terminals", "evidence", "runEnd"];
  const events = Object.fromEntries(observed.map((id) => [id, []]));
  observe(g, observed, ({ id, msgs }) => events[id].push(msgs));
  const data = (id) => events[id].filter((m) => m[0][0] !== "START").flatMap((m) => m.filter((x) => x[0] === "DATA").map((x) => x[1]));
  const byKey = (id) => new Map(data(id).filter((r) => r.key !== undefined).map((r) => [r.key, r]));
  const last = (id) => data(id).at(-1) ?? null;

  return {
    arm: "graph",
    topology: g.describe(),
    events,
    failures,
    journal: host.journal,
    push(laneId, value) { g.set(laneId, value); },
    pushMany(laneId, values) { g.batch(() => { for (const v of values) g.set(laneId, v); }); },
    async drain() { await host.idle(); },
    business() {
      const out = new Map();
      for (const [key, r] of byKey("vendorStats")) out.set(key, { occ: r.occ, stats: r.stats });
      for (const [id, field] of [["anomalyScore", "score"], ["thresholdGate", "gate"], ["reasonFactors", "reason"], ["alertMessage", "message"]]) {
        for (const [key, r] of byKey(id)) if (out.has(key)) out.get(key)[field] = r[field];
      }
      for (const [key, r] of byKey("requests")) if (out.has(key)) out.get(key).request = r.request;
      return out;
    },
    proposals: () => [...byKey("requests").values()].filter((r) => r.proposal).map((r) => ({ key: r.key, proposal: r.proposal, request: r.request })),
    admissions: () => byKey("admission"),
    released: () => data("release"),
    ledger: () => last("ledger"),
    terminals: () => byKey("terminals"),
    coverage: () => last("evidence"),
    runEnd: () => last("runEnd"),
    issues: () => [...data("occurrences").filter((r) => r.kind === "issue"), ...(last("ledger")?.issues ?? [])],
    gaps: () => {
      const held = new Map();
      for (const r of data("occurrences")) if (r.kind === "gap") held.set(r.revisionDomain, r);
      return [...held.values()].filter((r) => r.held.length);
    },
  };
}

function ledgerSnapshot(s) {
  const t = { proposed: 0, pendingAdmission: 0, rejected: 0, admitted: 0, active: 0, succeeded: 0, failed: 0, cancelled: 0, reconcileRequired: 0, unknown: 0 };
  const entries = [];
  for (const e of s.entries.values()) {
    let publication = null;
    if (!e.proposal) publication = e.admission === "admitted" ? "no-publish" : e.admission === "rejected" ? "rejected" : null;
    else {
      t.proposed += 1;
      if (e.admission === "rejected") { t.rejected += 1; publication = "rejected"; }
      else if (e.admission !== "admitted") t.pendingAdmission += 1;
      else {
        t.admitted += 1;
        const st = e.outcome?.state;
        if (!st) t.active += 1;
        else { t[st === "reconcile-required" ? "reconcileRequired" : st] += 1; publication = st; }
      }
    }
    entries.push({ key: e.key, admission: e.admission, code: e.code, publication, outcome: e.outcome?.state ?? null });
  }
  return { totals: t, entries, issues: [...s.issues] };
}
