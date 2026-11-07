// The focused local inbox host (brief section 4), the one real effect boundary. Both arms
// hand it what their release step lets through; it never recomputes business rules, reads
// no latest global value and never retries. It appends one JSON line per admitted request
// to a local file and reports each outcome as DataResult DATA through `report`.
//
// Exactly once: a record per proposal digest. The same admission again is a replay and
// does nothing; a different admission for a recorded proposal is refused and not written.
//
// Outcomes:
//   succeeded  the whole payload was written (bytesWritten equals its length)
//   failed     a known no-write: the destination could not be opened
//   cancelled  refused before any write (integrity, capacity)
//   unknown    the write started and its result is not known complete (short, threw)
//
// `fs` is the node:fs/promises surface the host uses (open, then handle.write and close);
// tests pass a faulty one to reach the unknown outcomes. The host has no mutation switches.

import * as nodeFs from "node:fs/promises";
import { hash, ok, issue, MAX_PAYLOAD_BYTES } from "./business.mjs";

export function inboxHost({ binding, path, report, fs = nodeFs, records: maxRecords = 64 }) {
  const records = new Map(); // proposalDigest -> { admissionRef, state }
  const inFlight = new Set();
  const journal = []; // every call the host made at its boundary, for the verifier

  function settle(effect, state, result) {
    const outcome = {
      occurrence: effect.proposal.occurrence, effectId: effect.proposal.effectId,
      requestDigest: effect.proposal.requestDigest, proposalDigest: effect.proposal.proposalDigest,
      admissionRef: effect.admissionRef, state, result,
    };
    records.get(effect.proposal.proposalDigest).state = state;
    report(outcome);
  }

  async function write(effect, bytes) {
    let handle;
    try {
      journal.push({ op: "open", path });
      handle = await fs.open(path, "a");
    } catch (e) {
      return settle(effect, "failed", issue("destination-unavailable", e.code ?? String(e)));
    }
    try {
      journal.push({ op: "write", bytes: bytes.length });
      const { bytesWritten } = await handle.write(bytes);
      if (bytesWritten === bytes.length) settle(effect, "succeeded", ok({ bytesWritten }));
      else settle(effect, "unknown", issue("short-write", `${bytesWritten} of ${bytes.length} bytes`));
    } catch (e) {
      settle(effect, "unknown", issue("write-interrupted", e.code ?? String(e)));
    } finally {
      await handle.close().catch(() => {});
    }
  }

  return {
    journal,
    // One admitted effect: { proposal, admissionRef, request }.
    accept(effect) {
      const { proposal, admissionRef, request } = effect;
      const known = records.get(proposal.proposalDigest);
      if (known) {
        if (known.admissionRef !== admissionRef) journal.push({ op: "refuse", code: "admission-conflict", proposalDigest: proposal.proposalDigest });
        return; // the same admission again is an exact replay
      }
      if (records.size >= maxRecords) {
        journal.push({ op: "refuse", code: "record-capacity", proposalDigest: proposal.proposalDigest });
        return;
      }
      records.set(proposal.proposalDigest, { admissionRef, state: "active" });
      const bytes = Buffer.from(request?.payloadText ?? "", "utf8");
      if (hash(request) !== proposal.requestDigest || request.destinationRef !== binding.destinationRef || request.hostEpoch !== binding.hostEpoch) {
        return settle(effect, "cancelled", issue("binding-mismatch", "request does not match its proposal or this host"));
      }
      if (bytes.length > MAX_PAYLOAD_BYTES) return settle(effect, "cancelled", issue("payload-capacity", `${bytes.length} bytes`));
      const p = write(effect, bytes);
      inFlight.add(p);
      p.finally(() => inFlight.delete(p));
    },
    async idle() { while (inFlight.size) await Promise.all([...inFlight]); },
  };
}
