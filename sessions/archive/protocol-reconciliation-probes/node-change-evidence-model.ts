// Bounded INFORMATION model, not GraphReFly implementation/conformance.
// Scope: one output lifetime; applied DATA/RESOLVED/effective INVALIDATE/terminal,
// with current DIRTY readiness retained. No lifecycle reset, rewire, PAUSE buffer,
// initialization ordering, or actual raw invocation is modeled.
import assert from "node:assert/strict";
type Event = "DATA1" | "DATA2" | "RESOLVED" | "INVALIDATE" | "DIRTY" | "COMPLETE" | "ERROR";
const alphabet: Event[] = ["DATA1", "DATA2", "RESOLVED", "INVALIDATE", "DIRTY", "COMPLETE", "ERROR"];
const baseline = 7;
function check(initialHasData: boolean, events: Event[]) {
  let hasData = initialHasData;
  let cache: number | undefined = hasData ? 1 : undefined;
  let dirty = false;
  let terminal: "COMPLETE" | "ERROR" | undefined;
  let progress = baseline, lastValueAt = 4;
  const applied: Event[] = [];
  for (const event of events) {
    if (terminal !== undefined) continue;
    if (event === "DIRTY") { dirty = true; continue; }
    if (event === "INVALIDATE" && !hasData) continue;
    progress++;
    applied.push(event);
    dirty = false;
    if (event === "DATA1" || event === "DATA2") {
      hasData = true;
      cache = event === "DATA1" ? 1 : 2;
      lastValueAt = progress;
    } else if (event === "INVALIDATE") {
      hasData = false;
      cache = undefined;
      lastValueAt = progress;
    } else if (event === "COMPLETE" || event === "ERROR") terminal = event;
  }
  // Independent reference: retain the full effective output history, then query it.
  const lastValueEvent = applied.findLast(e => e.startsWith("DATA") || e === "INVALIDATE");
  const expectedKind = lastValueEvent === undefined ? "none"
    : lastValueEvent === "INVALIDATE" ? "invalidate" : "data";
  const inferredKind = lastValueAt <= baseline ? "none" : hasData ? "data" : "invalidate";
  assert.equal(inferredKind, expectedKind, JSON.stringify({ initialHasData, events }));
  assert.equal(progress > baseline, applied.length > 0);
  return { cache, hasData, dirty, terminal, progress, lastValueAt, inferredKind };
}
let cases = 0;
function visit(events: Event[]) {
  check(false, events); check(true, events); cases += 2;
  if (events.length === 5) return;
  for (const event of alphabet) visit([...events, event]);
}
visit([]);
const dataThenResolved = check(true, ["DATA1", "RESOLVED"]);
const onlyResolved = check(true, ["RESOLVED", "RESOLVED"]);
assert.equal(dataThenResolved.cache, onlyResolved.cache);
assert.equal(dataThenResolved.progress, onlyResolved.progress);
assert.equal(dataThenResolved.hasData, onlyResolved.hasData);
assert.notEqual(dataThenResolved.inferredKind, onlyResolved.inferredKind);
console.log(JSON.stringify({ totalAppliedProgressAndCurrentCacheInsufficient: true,
  dataThenResolved, onlyResolved }));
console.log(`DONE ${cases} bounded histories; identifies value-kind/advancement only, NOT raw invocation or lifecycle correctness`);
