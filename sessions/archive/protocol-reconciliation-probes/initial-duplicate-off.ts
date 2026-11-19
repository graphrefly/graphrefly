// Diagnostic for the inspected baseline, not an assertion of the proposed protocol.
// Run with graphrefly-ts as cwd; source is imported from that checkout.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { node } = await import(pathToFileURL(resolve("packages/ts/src/node/node.ts")).href);
const events: string[] = [];
let nested = false;
let fnCalls = 0;
const n = node([], (ctx: { down(msgs: readonly unknown[]): void }) => {
  fnCalls++;
  events.push("fn");
  ctx.down([["DATA", 10]]);
});
function callback(msg: readonly unknown[]) {
  events.push(String(msg[0]));
  if (msg[0] === "START" && !nested) {
    nested = true;
    const aliasOff = n.subscribe(callback);
    events.push("alias:off");
    aliasOff();
  }
}
const outerOff = n.subscribe(callback);
assert.equal(events.filter((v) => v === "START").length, 2);
assert.equal(fnCalls, 2);
assert.ok(events.lastIndexOf("fn") > events.indexOf("alias:off"));
console.log(JSON.stringify({ fnCalls, events }));
outerOff();
