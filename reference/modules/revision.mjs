// Revision evidence (DS-17 O9, R-node-revision) as an observer over the reference kernel.
// Non-normative.
//
// The user decided on 2026-11-08 that revision evidence is an observer module, not kernel
// state. This one counts, per observed node, what the node committed, from what an
// ordinary subscriber receives (H5, observe.mjs):
//   revision       advances once per committed DATA, RESOLVED, INVALIDATE, COMPLETE or ERROR;
//   valueRevision  is the revision of the latest DATA or INVALIDATE: the last change to, or
//                  removal of, the retained value.
// The START array is installation, not an event, so subscribing, restore and a late
// subscriber advance nothing. PENDING is the kernel's notification, not output. An equal
// DATA is an occurrence and counts. An INVALIDATE that removed nothing is never delivered
// (K6), so it cannot count.
//
// Like observe(), the observer is a real subscriber: it activates a cold node and keeps it
// active, so its positions never reset on a disconnect while it runs. Its positions live in
// the observer, not in the graph. capture() gives them as JSON, and a new observer started
// with { from } goes on from them, so saving them next to a checkpoint and restoring both
// keeps them unchanged.
//
// An optional hash(values) describes the node's current retained values (K3), or their
// absence as hash(null). It is computed when read, so it always agrees with the snapshot.
// Which canonical encoding a hash uses is open (graphrefly:B140 Checkpoint/encoding).
//
// A position never wraps: an array that would take revision past Number.MAX_SAFE_INTEGER
// is refused whole, the positions stay as they were, and the throw goes to the host
// reporter like any failing sink (P10).

import { observe } from "./observe.mjs";

const COUNTED = new Set(["DATA", "RESOLVED", "INVALIDATE", "COMPLETE", "ERROR"]);
const VALUE = new Set(["DATA", "INVALIDATE"]);

const isPosition = (x) => Number.isSafeInteger(x) && x >= 0;

function startingPosition(id, saved) {
  if (saved === undefined) return { revision: 0, valueRevision: 0 };
  const { revision, valueRevision } = saved;
  if (!isPosition(revision) || !isPosition(valueRevision) || valueRevision > revision) {
    throw new RangeError(`revision: invalid saved position for ${id}`);
  }
  return { revision, valueRevision };
}

export function revisionObserver(g, ids, { hash, from = {} } = {}) {
  const positions = new Map(ids.map((id) => [id, startingPosition(id, from[id])]));
  const stop = observe(g, ids, ({ id, msgs }) => {
    if (msgs[0][0] === "START") return;
    const counted = msgs.filter((m) => COUNTED.has(m[0]));
    const p = positions.get(id);
    if (p.revision > Number.MAX_SAFE_INTEGER - counted.length) {
      throw new RangeError(`revision: ${id} would pass Number.MAX_SAFE_INTEGER`);
    }
    for (const m of counted) {
      p.revision += 1;
      if (VALUE.has(m[0])) p.valueRevision = p.revision;
    }
  });
  return {
    get(id) {
      const { revision, valueRevision } = positions.get(id);
      if (!hash) return { revision, valueRevision };
      const s = g.get(id);
      return { revision, valueRevision, hash: hash(s.has ? s.values : null) };
    },
    capture() {
      return Object.fromEntries([...positions].map(([id, p]) => [id, { ...p }]));
    },
    stop,
  };
}
