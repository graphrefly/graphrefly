// B139 acceptance matrix S1–S8 (brief section 5) on the reference kernel. Every scenario runs
// on both arms, the graph arm and the plain arm, against the same independent verifier and a
// real local inbox file.

import test from "node:test";
import assert from "node:assert/strict";
import * as realFs from "node:fs/promises";
import { setImmediate as tick } from "node:timers/promises";
import { begin, complete, currentFor, expectedInbox, grantAll, occurrence, open, verifyAll } from "./harness.mjs";
import { implementationReport, load, patchDigest } from "./runner.mjs";
import * as V from "./verifier.mjs";

const ARMS = ["graph", "plain"];
const VENDOR_STATS = "flagship/consumer/vendor-stats.mjs";
// S1: the sample standard deviation "optimized" into the population one (brief section 3).
const POPULATION = { path: VENDOR_STATS, from: "Math.sqrt(m2 / (count - 1))", to: "Math.sqrt(m2 / count)" };
// S2: the same sample semantics, the Welford update rewritten algebraically.
const ALGEBRAIC = { path: VENDOR_STATS, from: "m2 = m2 + delta * (x - mean);", to: "m2 = m2 + (delta * delta * (count - 1)) / count;" };

// The brief's input pack: one vendor, known category, amounts 100 then 200, dailyAverage 100.
const pack = (opts = {}) => [occurrence({ revision: 1, amounts: [100], ...opts }), occurrence({ revision: 2, amounts: [100, 200], ...opts })];
const key = V.keyOf;
const lines = (text) => text.split(/(?<=\n)/).filter(Boolean).sort();
const writes = (run) => run.app.journal.filter((j) => j.op === "write").length;

for (const arm of ARMS) {
  // ---- S1 -----------------------------------------------------------------
  test(`S1 [${arm}]: a same-topology semantic error is visible, found by the verifier, and writes nothing`, async () => {
    const occs = pack({ zThreshold: 0.8 });
    const base = await open({ arm });
    const baseVerdicts = await complete(base, occs);
    assert.deepEqual(baseVerdicts.map((v) => v.verdict), ["pass", "pass"]);
    assert.equal(base.app.proposals().length, 0, "sample std: z = 0.707 is under 0.8");

    const cand = await open({ arm, edits: [POPULATION] });
    const verdicts = await complete(cand, occs);
    assert.equal(verdicts[0].verdict, "pass");
    assert.equal(verdicts[1].verdict, "fail");
    assert.deepEqual(verdicts[1].mismatches.filter((m) => ["std", "zScore", "flagged"].includes(m)), ["std", "zScore", "flagged"]);
    assert.equal(cand.app.proposals().length, 1, "the candidate proposes an alert and the operator granted it");
    assert.equal(cand.app.admissions().get(key(occs[1])).code, "verification-failed");
    assert.equal(await cand.inbox(), "");
    assert.equal(writes(cand), 0);
    assert.ok(V.conserved(cand.app.ledger().totals));

    const report = implementationReport(base.loaded, cand.loaded);
    assert.equal(report.sourceDigestChanged, true);
    assert.deepEqual(report.changedFiles, [VENDOR_STATS]);
    if (arm === "graph") {
      assert.deepEqual(report.changedNodes, ["vendorStats"]);
      assert.deepEqual(cand.app.topology, base.app.topology, "topology is the same");
    }
  });

  // ---- S2 -----------------------------------------------------------------
  test(`S2 [${arm}]: an equivalent rewrite is marked changed, verified equal, and writes once`, async () => {
    const occs = pack({ zThreshold: 0.7 });
    const base = await open({ arm });
    await complete(base, occs);
    const cand = await open({ arm, edits: [ALGEBRAIC] });
    const verdicts = await complete(cand, occs);
    assert.deepEqual(verdicts.map((v) => v.verdict), ["pass", "pass"]);
    assert.deepEqual(implementationReport(base.loaded, cand.loaded).changedFiles, [VENDOR_STATS]);
    assert.equal(writes(cand), 1);
    assert.equal(await cand.inbox(), expectedInbox(verdicts, [key(occs[1])]).join(""), "read back equals the expected payload");
    assert.equal(await cand.inbox(), await base.inbox(), "same payload as the base");
    assert.equal(cand.app.ledger().totals.succeeded, 1);
    assert.ok(cand.app.runEnd().ready);
  });

  test(`S2 [${arm}]: strict > at the threshold: z exactly 1 against 1 is not flagged`, async () => {
    const occs = [1, 2, 3].map((_, i) => occurrence({ revision: i + 1, amounts: [1, 2, 3].slice(0, i + 1), zThreshold: 1 }));
    const run = await open({ arm });
    const verdicts = await complete(run, occs);
    assert.equal(verdicts[2].exp.zScore, 1);
    assert.deepEqual(verdicts.map((v) => v.verdict), ["pass", "pass", "pass"]);
    assert.equal(run.app.proposals().length, 0);
  });

  // ---- S3 -----------------------------------------------------------------
  // Two vendors with their own policies and statistics. Borrowing A's statistics or policy for
  // B would flag B2 (z = 6.4 with A's statistics; A's threshold 0.7 is under B2's z = 0.707).
  const twoVendors = () => [
    occurrence({ vendor: "coffee", revision: 1, amounts: [100], zThreshold: 0.7 }),
    occurrence({ vendor: "coffee", revision: 2, amounts: [100, 200], zThreshold: 0.7, dailyAverage: 101 }),
    occurrence({ vendor: "tea", revision: 1, amounts: [300], zThreshold: 0.9 }),
    occurrence({ vendor: "tea", revision: 2, amounts: [300, 600], zThreshold: 0.9, dailyAverage: 202 }),
  ];
  const settled = (run) => [...run.app.terminals().values()].map((t) => `${t.key.match(/"occurrenceId":"([^"]+)"/)[1]}:${t.assessment}:${t.publication}`).sort();

  test(`S3 [${arm}]: batched, split and reordered arrivals give the same keyed results`, async () => {
    const [a1, a2, b1, b2] = twoVendors();
    const results = [];
    for (const [arrivals, split] of [[[a1, a2, b1, b2], false], [[a1, b1, a2, b2], true], [[b2, a2, b1, a1], false]]) {
      const run = await open({ arm });
      begin(run, arrivals, { split });
      const verdicts = verifyAll(run, arrivals);
      assert.deepEqual(verdicts.map((v) => v.verdict), ["pass", "pass", "pass", "pass"]);
      grantAll(run);
      await run.app.drain();
      assert.deepEqual(run.app.proposals().map((p) => p.key), [key(a2)], "only A2 is flagged");
      assert.equal(await run.inbox(), expectedInbox(verdicts, [key(a2)]).join(""));
      assert.ok(V.conserved(run.app.ledger().totals));
      assert.ok(run.app.runEnd().ready);
      results.push(settled(run));
    }
    assert.deepEqual(results[0], ["coffee-1:normal:no-publish", "coffee-2:flagged:succeeded", "tea-1:normal:no-publish", "tea-2:normal:no-publish"]);
    assert.deepEqual(results[1], results[0]);
    assert.deepEqual(results[2], results[0]);
  });

  test(`S3 [${arm}]: outcomes that return in reverse order settle exactly their own effects`, async () => {
    const occs = twoVendors().map((o) => occurrence({ ...fromOcc(o), zThreshold: 0.7 }));
    const gated = gatedFs();
    const run = await open({ arm, fs: gated.fs });
    begin(run, occs);
    verifyAll(run, occs);
    grantAll(run);
    await until(() => gated.gates.length === 2);
    const gate = (id) => gated.gates.find((r) => r.text.includes(`"${id}:`));
    gate("tea-2")(); // tea-2 completes first
    await until(() => run.app.ledger().totals.succeeded === 1);
    assert.equal(run.app.ledger().entries.find((e) => e.key === key(occs[3])).outcome, "succeeded");
    assert.equal(run.app.ledger().entries.find((e) => e.key === key(occs[1])).outcome, null);
    gate("coffee-2")();
    await run.app.drain();
    assert.equal(run.app.ledger().totals.succeeded, 2);
    assert.deepEqual(run.app.ledger().issues, []);
    assert.ok(V.conserved(run.app.ledger().totals));
  });

  test(`S3 [${arm}]: a required branch that never ends keeps its occurrence open`, async () => {
    const edit = arm === "graph"
      ? { path: "flagship/consumer/graph-app.mjs", from: "each((r) => ({ reason: b.reasonFactors(r.occ.value, r.score, r.gate) }))", to: "each(() => null)" }
      : { path: "flagship/consumer/plain-app.mjs", from: "      evaluate(key, next);\n", to: "" };
    const occs = pack({ zThreshold: 0.7 });
    const run = await open({ arm, edits: [edit] });
    await complete(run, occs);
    assert.equal(run.app.terminals().size, 0, "no terminal without the explanation branch");
    assert.equal(run.app.proposals().length, 0);
    assert.equal(await run.inbox(), "");
    assert.deepEqual(run.app.runEnd().reasons, ["open-occurrence"]);
    // A rejection ends the publication branch, and the occurrence still waits for its explanation.
    run.push("current", [{ ...currentFor(occs[1]), policyRef: "policy-coffee-revoked" }]);
    assert.equal(run.app.terminals().size, 0);
  });

  // ---- S4 -----------------------------------------------------------------
  test(`S4 [${arm}]: a receipt or grant bound to a different occurrence, request or host releases nothing`, async () => {
    const occs = pack({ zThreshold: 0.7 });
    const receiptTampers = {
      revisionDomain: (r) => ({ ...r, occurrence: { ...r.occurrence, revisionDomain: "vendor:tea" } }),
      occurrenceId: (r) => ({ ...r, occurrence: { ...r.occurrence, occurrenceId: "coffee-9" } }),
      revision: (r) => ({ ...r, occurrence: { ...r.occurrence, revision: 3 } }),
      digest: (r) => ({ ...r, occurrence: { ...r.occurrence, digest: V.digest("other") } }),
      sourceRefs: (r) => ({ ...r, occurrence: { ...r.occurrence, sourceRefs: [{ kind: "evaluation", id: "other" }] } }),
      requestDigest: (r) => ({ ...r, requestDigest: V.digest("other") }),
    };
    for (const [field, tamper] of Object.entries(receiptTampers)) {
      const run = await open({ arm });
      await complete(run, occs, { verify: { tamper } });
      assert.equal(run.app.admissions().get(key(occs[1])).code, "verification-pending", `receipt ${field}`);
      assert.equal(writes(run), 0, `receipt ${field}`);
      assert.equal(run.app.ledger().totals.pendingAdmission, 1);
    }
    const grantTampers = {
      occurrence: (g) => ({ ...g, occurrence: { ...g.occurrence, revision: 1 } }),
      requestDigest: (g) => ({ ...g, requestDigest: V.digest("other") }),
      destinationRef: (g) => ({ ...g, destinationRef: "inbox:elsewhere" }),
      hostEpoch: (g) => ({ ...g, hostEpoch: "host-0" }),
    };
    for (const [field, tamper] of Object.entries(grantTampers)) {
      const run = await open({ arm });
      await complete(run, occs, { grant: { tamper } });
      assert.equal(run.app.admissions().get(key(occs[1])).code, "grant-pending", `grant ${field}`);
      assert.equal(writes(run), 0, `grant ${field}`);
    }
  });

  test(`S4 [${arm}]: an occurrence whose digest does not match is refused and changes nothing`, async () => {
    const [o1] = pack();
    const run = await open({ arm });
    begin(run, [{ ...o1, digest: V.digest("forged") }]);
    assert.deepEqual(run.app.issues().map((i) => i.code), ["malformed-digest"]);
    assert.equal(run.app.business().size, 0);
    assert.equal(run.app.admissions().size, 0);
  });

  test(`S4 [${arm}]: r3 before r2 is a visible gap that only the real r2 fills`, async () => {
    const o = (revision, amounts) => occurrence({ revision, amounts, zThreshold: 0.7 });
    const [r1, r2, r3] = [o(1, [100]), o(2, [100, 200]), o(3, [100, 200, 400])];
    const run = await open({ arm });
    begin(run, [r1, r3], { facts: [currentFor(r3)] });
    assert.deepEqual(run.app.gaps().map((g) => [g.missingRevision, g.held]), [[2, [3]]]);
    assert.ok(run.app.runEnd().reasons.includes("revision-gap"));
    assert.equal(run.app.business().has(key(r3)), false, "r3 is held, not evaluated");
    run.push("evaluations", [{ ...r2, digest: V.digest("forged") }]);
    assert.deepEqual(run.app.gaps().map((g) => g.missingRevision), [2], "a forged r2 does not fill the gap");
    run.push("evaluations", [r2]);
    assert.deepEqual(run.app.gaps(), []);
    const verdicts = verifyAll(run, [r1, r2, r3]);
    grantAll(run);
    await run.app.drain();
    // Released in revision order; the two writes run concurrently, so the file's line order is not promised.
    assert.deepEqual(run.app.released().map((r) => r.key), [key(r1), key(r2), key(r3)]);
    assert.deepEqual(lines(await run.inbox()), expectedInbox(verdicts, [key(r2), key(r3)]).sort());
    assert.ok(run.app.runEnd().ready);
  });

  test(`S4 [${arm}]: a watermark short of the revision keeps it pending until it reaches it`, async () => {
    const occs = pack({ zThreshold: 0.7 });
    const run = await open({ arm });
    await complete(run, occs, { facts: [currentFor(occs[1], 1)] });
    assert.equal(run.app.admissions().get(key(occs[1])).code, "currentness-pending");
    assert.equal(writes(run), 0);
    run.push("current", [currentFor(occs[1], 2)]);
    await run.app.drain();
    assert.equal(writes(run), 1);
  });

  test(`S4 [${arm}]: after the policy is revoked, a late receipt and grant admit nothing`, async () => {
    const occs = pack({ zThreshold: 0.7 });
    const run = await open({ arm });
    begin(run, occs);
    run.push("current", [{ ...currentFor(occs[1]), policyRef: "policy-coffee-revoked" }]);
    verifyAll(run, occs);
    grantAll(run);
    await run.app.drain();
    assert.equal(run.app.admissions().get(key(occs[1])).code, "not-current");
    assert.equal(writes(run), 0);
    assert.equal(run.app.ledger().totals.rejected, 1);
    if (arm === "graph") {
      // The quiet lifecycle port sent only the release of r1; nothing for r2, and never RESOLVED.
      const arrays = run.app.events.release.filter((m) => m[0][0] !== "START");
      assert.deepEqual(run.app.released().map((r) => r.key), [key(occs[0])]);
      assert.ok(arrays.every((m) => m.length === 2 && m[0][0] === "PENDING" && m[1][0] === "DATA"));
    }
  });

  // ---- S5 -----------------------------------------------------------------
  test(`S5 [${arm}]: an exact replay of every input adds no count and no write`, async () => {
    const occs = pack({ zThreshold: 0.7 });
    const run = await open({ arm });
    await complete(run, occs);
    const before = run.app.ledger().totals;
    const outcome = await lastOutcome(run);
    for (const [lane, values] of [...run.inputs]) run.push(lane, values);
    run.push("outcomes", [outcome]);
    await run.app.drain();
    assert.deepEqual(run.app.ledger().totals, before);
    assert.equal(writes(run), 1);
    assert.equal((await run.inbox()).split("\n").filter(Boolean).length, 1);
    assert.ok(run.app.issues().some((i) => i.code === "exact-replay"));
    assert.deepEqual(run.app.ledger().issues, []);
  });

  test(`S5 [${arm}]: the same occurrence id with another payload conflicts and does not replace the first`, async () => {
    const occs = pack({ zThreshold: 0.7 });
    const run = await open({ arm });
    await complete(run, occs);
    const first = run.app.business().get(key(occs[1]));
    const other = occurrence({ revision: 2, amounts: [100, 250], zThreshold: 0.7 });
    run.push("evaluations", [other]);
    assert.ok(run.app.issues().some((i) => i.code === "replay-conflict"));
    assert.equal(run.app.business().has(key(other)), false);
    assert.deepEqual(run.app.business().get(key(occs[1])), first);
    assert.equal(writes(run), 1);
  });

  test(`S5 [${arm}]: an analysis replay of an old run in a new host epoch never writes`, async () => {
    const occs = pack({ zThreshold: 0.7 });
    const old = await open({ arm });
    await complete(old, occs);
    const replay = await open({ arm, hostEpoch: "host-2" });
    for (const [lane, values] of old.inputs) replay.push(lane, values);
    await replay.app.drain();
    assert.equal(writes(replay), 0);
    assert.equal(await replay.inbox(), "");
    // The request names its host epoch, so the old receipt verified another request.
    assert.equal(replay.app.admissions().get(key(occs[1])).code, "verification-pending");
  });

  // ---- S6 -----------------------------------------------------------------
  test(`S6 [${arm}]: success, known failure and unknown are separate, and conservation holds`, async () => {
    const occs = pack({ zThreshold: 0.7 });
    const cases = [
      { name: "success", open: {}, state: "succeeded", inbox: (t) => t.length > 1, ready: true },
      { name: "known failure", open: { destination: "missing" }, state: "failed", inbox: (t) => t === null, ready: true },
      { name: "short write", open: { fs: faultyFs("short") }, state: "unknown", inbox: (t) => t.length === 1, ready: false },
      { name: "interrupted write", open: { fs: faultyFs("throw") }, state: "unknown", inbox: (t) => t === "", ready: false },
    ];
    for (const c of cases) {
      const run = await open({ arm, ...c.open });
      await complete(run, occs);
      const entry = run.app.ledger().entries.find((e) => e.key === key(occs[1]));
      assert.equal(entry.outcome, c.state, c.name);
      assert.ok(c.inbox(await run.inbox()), `${c.name}: inbox`);
      assert.equal(run.app.runEnd().ready, c.ready, c.name);
      assert.ok(V.conserved(run.app.ledger().totals), c.name);
    }
  });

  test(`S6 [${arm}]: a missing outcome stays active, and a wrong one does not settle it`, async () => {
    const occs = pack({ zThreshold: 0.7 });
    const gated = gatedFs();
    const run = await open({ arm, fs: gated.fs });
    begin(run, occs);
    verifyAll(run, occs);
    grantAll(run);
    await until(() => gated.gates.length === 1);
    assert.equal(run.app.ledger().totals.active, 1);
    assert.deepEqual(run.app.runEnd().reasons, ["open-occurrence", "active-effect"]);
    const p = run.app.proposals()[0].proposal;
    const forged = { occurrence: p.occurrence, effectId: p.effectId, requestDigest: p.requestDigest, proposalDigest: p.proposalDigest, admissionRef: V.digest("other admission"), state: "succeeded", result: { kind: "ok", value: {} } };
    run.push("outcomes", [forged]);
    assert.equal(run.app.ledger().totals.active, 1, "the wrong outcome settles nothing");
    assert.deepEqual(run.app.ledger().issues.map((i) => i.code), ["outcome-mismatch"]);
    gated.gates[0]();
    await run.app.drain();
    assert.equal(run.app.ledger().totals.succeeded, 1);
    assert.ok(V.conserved(run.app.ledger().totals));
  });

  // ---- S7 -----------------------------------------------------------------
  test(`S7 [${arm}]: without a current receipt for this code the effect is blocked`, async () => {
    const occs = pack({ zThreshold: 0.7 });
    const missing = await open({ arm });
    await complete(missing, occs, { verify: { send: false } });
    assert.equal(missing.app.admissions().get(key(occs[1])).code, "verification-pending");
    assert.equal(missing.app.coverage().entries[1].verification, "unavailable");
    assert.equal(writes(missing), 0);

    const other = await load({ arm, edits: [ALGEBRAIC] });
    const stale = await open({ arm });
    await complete(stale, occs, { verify: { tamper: (r) => ({ ...r, sourceDigest: other.sourceDigest }) } });
    assert.equal(stale.app.admissions().get(key(occs[1])).code, "verification-pending");
    assert.equal(stale.app.coverage().entries[1].verification, "stale");
    assert.equal(stale.app.coverage().complete, false);
    assert.equal(writes(stale), 0);
  });

  test(`S7 [${arm}]: missing provenance only makes the attribution unknown`, async () => {
    const base = await load({ arm });
    const attributed = { ...ALGEBRAIC, provenance: { actor: "agent:task-17", patchDigest: patchDigest(ALGEBRAIC) } };
    const withP = await load({ arm, edits: [attributed] });
    const withoutP = await load({ arm, edits: [ALGEBRAIC] });
    assert.deepEqual(implementationReport(base, withP).attribution, [{ path: VENDOR_STATS, actor: "agent:task-17" }]);
    assert.deepEqual(implementationReport(base, withoutP).attribution, [{ path: VENDOR_STATS, actor: "unknown" }]);
    const forged = { ...ALGEBRAIC, provenance: { actor: "agent:task-17", patchDigest: V.digest("another patch") } };
    assert.deepEqual(implementationReport(base, await load({ arm, edits: [forged] })).attribution, [{ path: VENDOR_STATS, actor: "unknown" }]);
    assert.equal(withP.sourceDigest, withoutP.sourceDigest, "provenance is not part of what runs");
    const run = await open({ arm, edits: [ALGEBRAIC] });
    await complete(run, pack({ zThreshold: 0.7 }));
    assert.equal(writes(run), 1);
  });

  test(`S7 [${arm}]: an exhausted or disabled audit record degrades coverage, not authorization`, async () => {
    const occs = pack({ zThreshold: 0.7 });
    const outcomes = [];
    for (const evidence of [64, 1, 0]) {
      const run = await open({ arm, limits: { evidence } });
      await complete(run, occs);
      const c = run.app.coverage();
      assert.equal(c.retentionGap, 2 - Math.min(evidence, 2));
      assert.equal(c.complete, evidence >= 2);
      outcomes.push([writes(run), await run.inbox()]);
    }
    assert.deepEqual(outcomes[1], outcomes[0]);
    assert.deepEqual(outcomes[2], outcomes[0]);
  });

  test(`S7 [${arm}]: when currentness can no longer be kept, the occurrence fails closed`, async () => {
    const occs = pack({ zThreshold: 0.7 });
    const run = await open({ arm, limits: { occurrences: 1 } });
    await complete(run, occs);
    assert.ok(run.app.issues().some((i) => i.code === "capacity" && i.revision === 2));
    assert.equal(run.app.proposals().length, 0);
    assert.equal(writes(run), 0);
  });

  // ---- S8 -----------------------------------------------------------------
  test(`S8 [${arm}]: a plain normal transaction publishes nothing`, async () => {
    const [o1] = pack();
    const run = await open({ arm });
    const verdicts = await complete(run, [o1]);
    assert.deepEqual(verdicts.map((v) => v.verdict), ["pass"]);
    assert.equal(run.app.proposals().length, 0);
    assert.equal(await run.inbox(), "");
    assert.equal(run.app.terminals().get(key(o1)).publication, "no-publish");
    assert.ok(run.app.runEnd().ready);
  });

  test(`S8 [${arm}]: a title change outside the closure is shown and changes nothing that runs`, async () => {
    const occs = pack({ zThreshold: 0.7 });
    const title = { path: "flagship/cli.mjs", from: 'const TITLE = "spending-alerts flagship (reference kernel)";', to: 'const TITLE = "Spending alerts";' };
    const base = await open({ arm });
    await complete(base, occs);
    const cand = await open({ arm, edits: [title] });
    await complete(cand, occs);
    const report = implementationReport(base.loaded, cand.loaded);
    assert.equal(report.sourceDigestChanged, false);
    assert.deepEqual(report.changedFiles, []);
    assert.deepEqual(report.outsideClosure, ["flagship/cli.mjs"]);
    assert.equal(await cand.inbox(), await base.inbox());
    assert.deepEqual(cand.app.proposals().map((p) => p.proposal), base.app.proposals().map((p) => p.proposal));
  });
}

// ---- Helpers ----------------------------------------------------------------

function fromOcc(o) {
  const v = o.value;
  return { vendor: v.transaction.vendor, revision: o.revision, amounts: v.prefix, dailyAverage: v.profile.dailyAverage };
}

async function until(cond) {
  for (let i = 0; i < 1000 && !cond(); i++) await tick();
  assert.ok(cond(), "condition not reached");
}

// A file system whose writes wait until the test opens each one's gate.
function gatedFs() {
  const gates = [];
  return {
    gates,
    fs: {
      async open(path, flags) {
        const h = await realFs.open(path, flags);
        return { write: async (buf) => { await new Promise((r) => gates.push(Object.assign(r, { text: buf.toString() }))); return h.write(buf); }, close: () => h.close() };
      },
    },
  };
}

// A file system whose write is short (writes one byte) or throws.
function faultyFs(kind) {
  return {
    async open(path, flags) {
      const h = await realFs.open(path, flags);
      return {
        write: async (buf) => {
          if (kind === "short") return h.write(buf.subarray(0, 1));
          throw Object.assign(new Error("I/O error"), { code: "EIO" });
        },
        close: () => h.close(),
      };
    },
  };
}

// The outcome the host reported for the run's one effect, rebuilt from the ledger's view.
async function lastOutcome(run) {
  const p = run.app.proposals()[0].proposal;
  const a = run.app.admissions().get(p.occurrence && V.encode(p.occurrence));
  return { occurrence: p.occurrence, effectId: p.effectId, requestDigest: p.requestDigest, proposalDigest: p.proposalDigest, admissionRef: a.effect.admissionRef, state: "succeeded", result: { kind: "ok", value: { bytesWritten: Buffer.byteLength(run.app.proposals()[0].request.payloadText) } } };
}
