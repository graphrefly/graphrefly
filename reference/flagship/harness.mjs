// Scenario harness for the flagship tests: builds inputs as their external owners would,
// opens a run of one arm against a real local inbox file, and plays the steps of one
// scenario. The step order follows TS spending-proof-scenarios: current facts and
// arrivals, then the verifier's receipts, then the operator's grants, then the host drains.

import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load } from "./runner.mjs";
import * as V from "./verifier.mjs";

// ---- Inputs ----------------------------------------------------------------

// One evaluation occurrence: vendor `vendor`, revision `revision` in domain `vendor:<vendor>`,
// the vendor's ordered amounts with the current one last.
export function occurrence({
  vendor = "coffee", revision = 1, amounts, category = "coffee", id = `${vendor}-${revision}`,
  dailyAverage = 100, typicalCategories = ["coffee", "tea"], profileRef = `profile-${id}`,
  zThreshold = 0.8, dailyRatioThreshold = 5, policyRef = `policy-${vendor}`,
}) {
  const amount = amounts.at(-1);
  const value = {
    evaluationRef: id,
    transaction: { id: `${id}:tx${amounts.length}`, vendor, category, amount },
    prefix: amounts,
    profileRef, profile: { dailyAverage, typicalCategories },
    policyRef, policy: { zThreshold, dailyRatioThreshold },
  };
  const o = { revisionDomain: `vendor:${vendor}`, occurrenceId: id, revision, sourceRefs: [{ kind: "evaluation", id }], value };
  return { ...o, digest: V.occurrenceDigest(o) };
}

// The current fact for an occurrence's domain: its policy, current through `watermark`.
export const currentFor = (occ, watermark = occ.revision) =>
  ({ revisionDomain: occ.revisionDomain, policyRef: occ.value.policyRef, policyDigest: V.digest(occ.value.policy), watermark });

// ---- A run -----------------------------------------------------------------

export async function open({ arm, edits = [], limits, hostEpoch = "host-1", fs, destination = "ready" } = {}) {
  const loaded = await load({ arm, edits });
  const dir = await mkdtemp(join(tmpdir(), "flagship-inbox-"));
  const inboxPath = destination === "missing" ? join(dir, "missing", "inbox.jsonl") : join(dir, "inbox.jsonl");
  if (destination !== "missing") await writeFile(inboxPath, "");
  const binding = {
    sourceDigest: loaded.sourceDigest, runtimeDigest: loaded.runtimeDigest, destinationRef: "inbox:local",
    hostEpoch, verifierRevision: V.VERIFIER_REVISION, numericDomain: V.NUMERIC_DOMAIN,
  };
  const app = loaded.createApp({ binding, inboxPath, fs, limits });
  const inputs = []; // every input this run received, in order (an analysis replay reads it)
  return {
    app, binding, loaded, inboxPath, inputs,
    push(lane, values) { inputs.push([lane, values]); app.pushMany(lane, values); },
    inbox: () => readFile(inboxPath, "utf8").catch(() => null),
  };
}

// Current facts and arrivals. `split` sends each occurrence alone instead of in one batch.
export function begin(run, occs, { facts = latestFacts(occs), split = false } = {}) {
  if (facts.length) run.push("current", facts);
  if (split) for (const o of occs) run.push("evaluations", [o]);
  else run.push("evaluations", occs);
}
function latestFacts(occs) {
  const byDomain = new Map();
  for (const o of occs) if ((byDomain.get(o.revisionDomain)?.revision ?? 0) < o.revision) byDomain.set(o.revisionDomain, o);
  return [...byDomain.values()].map((o) => currentFor(o));
}

// The verifier checks what the candidate computed for each occurrence and sends receipts.
export function verifyAll(run, occs, { send = true, tamper = (r) => r } = {}) {
  const observed = run.app.business();
  const results = occs.map((occ) => {
    const got = observed.get(V.keyOf(occ));
    const exp = V.expected(occ, run.binding);
    const { verdict, mismatches } = V.verify(got, exp, occ.value.policy);
    return { occ, exp, verdict, mismatches, receipt: tamper(V.receipt(occ, got, verdict, run.binding)) };
  });
  if (send) run.push("receipts", results.map((r) => r.receipt));
  return results;
}

// The local operator grants one write for each proposal the candidate made.
export function grantAll(run, { tick = 1, stop = false, maxWrites = 1, validThrough = 100, revoked = false, only, tamper = (g) => g } = {}) {
  const grants = run.app.proposals()
    .filter((p) => !only || only(p))
    .map((p) => tamper({
      grantRef: `grant:${p.proposal.effectId}`, operation: "append-alert", occurrence: p.proposal.occurrence,
      requestDigest: p.proposal.requestDigest, destinationRef: run.binding.destinationRef, hostEpoch: run.binding.hostEpoch,
      validFrom: 0, validThrough, maxWrites, revoked,
    }));
  run.push("local", [{ tick, stop, grants }]);
  return grants;
}

export async function complete(run, occs, opts = {}) {
  begin(run, occs, opts);
  const verdicts = verifyAll(run, occs, opts.verify);
  grantAll(run, opts.grant);
  await run.app.drain();
  return verdicts;
}

// The payloads the verifier expects in the inbox, for the occurrences that should write.
export const expectedInbox = (verdicts, keys) =>
  verdicts.filter((v) => v.exp.request && keys.includes(V.keyOf(v.occ))).map((v) => v.exp.request.payloadText);
