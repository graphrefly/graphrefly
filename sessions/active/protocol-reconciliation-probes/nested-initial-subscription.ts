// Diagnostic for the inspected baseline, not an assertion of the proposed protocol.
// Run with graphrefly-ts as cwd; source is imported from that checkout.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { node } = await import(pathToFileURL(resolve("packages/ts/src/node/node.ts")).href);
const events: string[] = [];
let calls = 0;
const n = node([], (ctx: { down(msgs: readonly unknown[]): void }) => {
  calls++;
  events.push("fn");
  ctx.down([["DATA", 10]]);
});
let offB: (() => void) | undefined;
const offA = n.subscribe((msg: readonly unknown[]) => {
  events.push(`A:${msg[0]}`);
  if (msg[0] === "START") {
    events.push("A:initial-enter");
    offB = n.subscribe((other: readonly unknown[]) => events.push(`B:${other[0]}`));
    events.push("A:initial-exit");
  }
});
assert.equal(calls, 1);
assert.ok(events.indexOf("fn") < events.indexOf("A:initial-exit"));
assert.equal(events.filter((v) => v === "A:DATA").length, 2);
console.log(JSON.stringify({ calls, events }));
offA();
offB?.();
