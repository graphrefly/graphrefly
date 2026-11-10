// Runtime mutations of the graph arm (brief section 6). Each mutant edits the bytes the
// runner loads, never the checkout. It must load and run, and a business, authorization or
// conservation assertion of its scenario must then fail; a load error or a timeout would
// not count. Every scenario first passes on the unmutated arm, and the effect scenario
// shows a real request reaching the host and producing one write.

import test from "node:test";
import assert from "node:assert/strict";
import * as realFs from "node:fs/promises";
import { setImmediate as tick } from "node:timers/promises";
import { begin, complete, currentFor, expectedInbox, grantAll, occurrence, open, verifyAll } from "./harness.mjs";
import * as V from "./verifier.mjs";

const APP = "flagship/consumer/graph-app.mjs";
const HOST = "flagship/consumer/inbox-host.mjs";
const POPULATION = { path: "flagship/consumer/vendor-stats.mjs", from: "Math.sqrt(m2 / (count - 1))", to: "Math.sqrt(m2 / count)" };
const pack = (opts = {}) => [occurrence({ revision: 1, amounts: [100], ...opts }), occurrence({ revision: 2, amounts: [100, 200], ...opts })];
const writes = (run) => run.app.journal.filter((j) => j.op === "write").length;
const graph = (edits, opts = {}) => open({ arm: "graph", edits, ...opts });

// Each scenario throws an AssertionError when its acceptance fails.
const scenarios = {
  async effect(edits) {
    const occs = pack({ zThreshold: 0.7 });
    const run = await graph(edits);
    const verdicts = await complete(run, occs);
    assert.equal(writes(run), 1);
    assert.equal(await run.inbox(), expectedInbox(verdicts, [V.keyOf(occs[1])]).join(""));
    assert.equal(run.app.ledger().totals.succeeded, 1);
    assert.ok(V.conserved(run.app.ledger().totals));
  },
  async noReceipt(edits) {
    const run = await graph(edits);
    await complete(run, pack({ zThreshold: 0.7 }), { verify: { send: false } });
    assert.equal(writes(run), 0);
  },
  async receiptForAnotherRequest(edits) {
    const run = await graph(edits);
    await complete(run, pack({ zThreshold: 0.7 }), { verify: { tamper: (r) => ({ ...r, requestDigest: V.digest("other") }) } });
    assert.equal(writes(run), 0);
  },
  async receiptForOtherCode(edits) {
    const run = await graph(edits);
    await complete(run, pack({ zThreshold: 0.7 }), { verify: { tamper: (r) => ({ ...r, sourceDigest: V.digest("other code") }) } });
    assert.equal(writes(run), 0);
  },
  async failedVerification(edits) {
    const run = await graph([...edits, POPULATION]);
    await complete(run, pack({ zThreshold: 0.8 }));
    assert.equal(writes(run), 0);
  },
  async noGrant(edits) {
    const run = await graph(edits);
    await complete(run, pack({ zThreshold: 0.7 }), { grant: { only: () => false } });
    assert.equal(writes(run), 0);
  },
  async revokedPolicy(edits) {
    const occs = pack({ zThreshold: 0.7 });
    const run = await graph(edits);
    begin(run, occs);
    run.push("current", [{ ...currentFor(occs[1]), policyRef: "policy-coffee-revoked" }]);
    verifyAll(run, occs);
    grantAll(run);
    await run.app.drain();
    assert.equal(writes(run), 0);
    const arrays = run.app.events.release.filter((m) => m[0][0] !== "START");
    assert.ok(arrays.every((m) => m.length === 2 && m[0][0] === "PENDING" && m[1][0] === "DATA"), "the quiet port sent only releases");
  },
  async shortWatermark(edits) {
    const occs = pack({ zThreshold: 0.7 });
    const run = await graph(edits);
    await complete(run, occs, { facts: [currentFor(occs[1], 1)] });
    assert.equal(writes(run), 0);
  },
  async revisionGap(edits) {
    const r1 = occurrence({ revision: 1, amounts: [100], zThreshold: 0.7 });
    const r3 = occurrence({ revision: 3, amounts: [100, 200, 400], zThreshold: 0.7 });
    const run = await graph(edits);
    await complete(run, [r1, r3], { facts: [currentFor(r3)] });
    assert.equal(writes(run), 0);
  },
  async twoVendorsInOneArray(edits) {
    const occs = [
      occurrence({ vendor: "coffee", revision: 1, amounts: [100], zThreshold: 0.7 }),
      occurrence({ vendor: "coffee", revision: 2, amounts: [100, 200], zThreshold: 0.7 }),
      occurrence({ vendor: "tea", revision: 1, amounts: [300], zThreshold: 0.9 }),
      occurrence({ vendor: "tea", revision: 2, amounts: [300, 600], zThreshold: 0.9, dailyAverage: 202 }),
    ];
    const run = await graph(edits);
    const verdicts = await complete(run, occs);
    assert.deepEqual(verdicts.map((v) => v.verdict), ["pass", "pass", "pass", "pass"]);
  },
  async wrongOutcome(edits) {
    const gates = [];
    const fs = { async open(p, f) { const h = await realFs.open(p, f); return { write: async (buf) => { await new Promise((r) => gates.push(r)); return h.write(buf); }, close: () => h.close() }; } };
    const occs = pack({ zThreshold: 0.7 });
    const run = await graph(edits, { fs });
    begin(run, occs);
    verifyAll(run, occs);
    grantAll(run);
    for (let i = 0; i < 1000 && !gates.length; i++) await tick();
    const p = run.app.proposals()[0].proposal;
    run.push("outcomes", [{ occurrence: p.occurrence, effectId: p.effectId, requestDigest: p.requestDigest, proposalDigest: p.proposalDigest, admissionRef: V.digest("other admission"), state: "succeeded", result: { kind: "ok", value: {} } }]);
    try { assert.equal(run.app.ledger().totals.active, 1, "a wrong outcome settles nothing"); }
    finally { gates.forEach((r) => r()); await run.app.drain(); }
  },
  async missingBranchRejected(edits) {
    const occs = pack({ zThreshold: 0.7 });
    const noExplanation = { path: APP, from: "each((r) => ({ reason: b.reasonFactors(r.occ.value, r.score, r.gate) }))", to: "each(() => null)" };
    const run = await graph([...edits, noExplanation]);
    begin(run, occs);
    run.push("current", [{ ...currentFor(occs[1]), policyRef: "policy-coffee-revoked" }]);
    assert.equal(run.app.terminals().size, 0, "no terminal while a declared branch is missing");
  },
  async shortWrite(edits) {
    const fs = { async open(p, f) { const h = await realFs.open(p, f); return { write: (buf) => h.write(buf.subarray(0, 1)), close: () => h.close() }; } };
    const run = await graph(edits, { fs });
    await complete(run, pack({ zThreshold: 0.7 }));
    assert.equal(run.app.ledger().totals.unknown, 1, "a short write is not known complete");
    assert.equal(run.app.runEnd().ready, false);
  },
  async knownFailure(edits) {
    const run = await graph(edits, { destination: "missing" });
    await complete(run, pack({ zThreshold: 0.7 }));
    assert.equal(run.app.ledger().totals.failed, 1);
    assert.ok(V.conserved(run.app.ledger().totals));
  },
};

const mutants = [
  { name: "admission→host: the host takes requests instead of releases", scenario: "noReceipt",
    edits: [{ path: APP, from: 'g.subscribe("inbox-host", "release", (msgs) => {\n    for (const [type, v] of msgs) if (type === "DATA" && v.effect) host.accept(v.effect);',
      to: 'g.subscribe("inbox-host", "requests", (msgs) => {\n    for (const [type, v] of msgs) if (type === "DATA" && v.proposal) host.accept({ proposal: v.proposal, admissionRef: "none", request: v.request });' }] },
  { name: "proposal→admission: a receipt for another request is accepted", scenario: "receiptForAnotherRequest",
    edits: [{ path: APP, from: "&& x.requestDigest === p.requestDigest && x.inputDigest", to: "&& x.inputDigest" }] },
  { name: "source binding: a receipt for other code is accepted", scenario: "receiptForOtherCode",
    edits: [{ path: APP, from: "&& x.policyDigest === r.request.policyDigest && x.sourceDigest === binding.sourceDigest", to: "&& x.policyDigest === r.request.policyDigest" }] },
  { name: "verifier label: the verdict is not read", scenario: "failedVerification",
    edits: [{ path: APP, from: 'if (receipts[0].verdict !== "pass") return rejected("verification-failed");', to: "" }] },
  { name: "grant: a missing grant counts as yes", scenario: "noGrant",
    edits: [{ path: APP, from: 'if (!grants.length) return pending("grant-pending");', to: 'if (!grants.length) return { ...base, state: "admitted", code: "admitted", final: true, effect: { proposal: p, admissionRef: "none", request: r.request } };' }] },
  { name: "currentness→release: the policy is not compared", scenario: "revokedPolicy",
    edits: [{ path: APP, from: 'if (f.policyRef !== v.policyRef || f.policyDigest !== b.policyDigest(v)) return rejected("not-current");', to: "" }] },
  { name: "currentness→release: the watermark is not compared", scenario: "shortWatermark",
    edits: [{ path: APP, from: "if (!f || f.watermark < occ.revision)", to: "if (!f)" }] },
  { name: "order: a skipped revision is accepted", scenario: "revisionGap",
    edits: [{ path: APP, from: "if (o.revision > d.high + 1) d.held.set(o.revision, o);", to: "if (false) d.held.set(o.revision, o);" }] },
  { name: "keyed join: anomalyScore takes vendorStats' latest value", scenario: "twoVendorsInOneArray",
    edits: [{ path: APP, from: 'join((o, s) => ({ score: b.anomalyScore(o.occ.value, s.stats) }))',
      to: '(ctx) => { const latest = ctx.deps[1].value; for (const r of rows(ctx.deps[0])) if (r.kind === "accepted") ctx.down([["DATA", { key: r.key, occ: r.occ, score: b.anomalyScore(r.occ.value, latest.stats) }]]); }' }] },
  { name: "outcome association: the admission is not compared", scenario: "wrongOutcome",
    edits: [{ path: APP, from: 'const exact = e && e.admission === "admitted" && e.admissionRef === o.admissionRef', to: 'const exact = e && e.admission === "admitted"' }] },
  { name: "effect accounting: a settled effect is not counted", scenario: "effect",
    edits: [{ path: APP, from: 'else { t[st === "reconcile-required" ? "reconcileRequired" : st] += 1; publication = st; }', to: "else { publication = st; }" }] },
  { name: "DataResult: a known failure becomes protocol ERROR", scenario: "knownFailure",
    edits: [{ path: APP, from: 'report: (o) => g.set("outcomes", o)', to: 'report: (o) => (o.state === "failed" ? g.error("outcomes", o.result.error) : g.set("outcomes", o))' }] },
  { name: "lifecycle port: release is not quiet", scenario: "revokedPolicy",
    edits: [{ path: APP, from: "  }, { quiet: true });", to: "  });" }] },
  { name: "terminal fan-in: the explanation branch is not awaited", scenario: "missingBranchRejected",
    edits: [{ path: APP, from: "|| !s.explanation.has(key)) continue;", to: ") continue;" }] },
  { name: "host: a short write counts as success", scenario: "shortWrite",
    edits: [{ path: HOST, from: "if (bytesWritten === bytes.length) settle", to: "if (bytesWritten >= 0) settle" }] },
];

for (const name of new Set(mutants.map((m) => m.scenario))) {
  test(`baseline passes: ${name}`, () => scenarios[name]([]));
}

for (const m of mutants) {
  test(`mutant ${m.expect === "survives" ? "survives" : "killed"}: ${m.name} (${m.scenario})`, async () => {
    let failure = null;
    try { await scenarios[m.scenario](m.edits); } catch (e) { failure = e; }
    if (m.expect === "survives") { assert.equal(failure, null); return; }
    assert.ok(failure, "the mutant passed its scenario");
    assert.ok(failure instanceof assert.AssertionError, `failed by ${failure?.name}: ${failure?.message}, not by an acceptance assertion`);
  });
}
