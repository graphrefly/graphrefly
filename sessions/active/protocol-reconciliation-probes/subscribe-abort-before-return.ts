// Diagnostic of the inspected TS baseline, NOT future conformance expectations.
// Run with graphrefly-ts as cwd. Uses private state/boundary injection for observation.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { node } = await import(pathToFileURL(resolve("packages/ts/src/node/node.ts")).href);
const { deferRewire } = await import(pathToFileURL(resolve("packages/ts/src/batch/boundary.ts")).href);

for (const stage of ["initial-callback", "boundary-drain"] as const) {
  const failure = new Error(stage);
  const n = node([], () => {});
  let armed = true;
  let deliveries = 0;
  let off: (() => void) | undefined;
  const sink = (msg: readonly unknown[]) => {
    if (msg[0] === "DATA") deliveries++;
    if (msg[0] !== "START" || !armed) return;
    if (stage === "initial-callback") throw failure;
    deferRewire(n._core, () => { throw failure; });
  };

  assert.throws(() => { off = n.subscribe(sink); }, (error) => error === failure);
  assert.equal(off, undefined);
  assert.equal(n._lifecycle.subscribers.has(sink), true);
  armed = false;
  n.down([["DATA", 30]]);
  assert.equal(deliveries, 1);
  console.log(JSON.stringify({ stage, returnedRelease: false, registrationRetained: true, laterDataDelivered: deliveries }));

  // Recover a release using a separate successful call. The failing call returned none.
  const recoveryOff = n.subscribe(sink);
  recoveryOff();
  assert.equal(n._lifecycle.subscribers.size, 0);
}
