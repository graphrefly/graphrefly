// Current baseline diagnostics for QA-13, not proposed lifecycle conformance.
// Run with graphrefly-ts as cwd. Private fields are inspected only for evidence.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { Graph } = await import(pathToFileURL(resolve("packages/ts/src/graph/graph.ts")).href);

{
  const g = new Graph(), source = g.state(0);
  const failure = new Error("throw after last unsubscribe");
  let off: () => void = () => {};
  const effect = g.effect([source], (value: unknown) => {
    if (value === 1) { off(); throw failure; }
  });
  off = effect.subscribe(() => {});
  source.set(1);
  assert.equal(effect._lifecycle.activated, false);
  assert.equal(effect._value.terminal, failure);
  assert.equal(effect.status, "errored");
  console.log(JSON.stringify({ case: "retired-effect-throw", active: false, status: effect.status, terminalIsFailure: true }));
}

{
  const g = new Graph(), source = g.state(0);
  let calls = 0, cleanups = 0;
  let off: () => void = () => {};
  const n = g.node([source], (ctx: any) => {
    calls++;
    if (calls === 2) ctx.down([["DATA", 1]]);
    ctx.onDeactivation(() => { cleanups++; });
  });
  off = n.subscribe((msg: readonly unknown[]) => { if (msg[0] === "DATA") off(); });
  source.set(1);
  assert.equal(n._lifecycle.activated, false);
  assert.equal(cleanups, 0);
  assert.equal(n._hooks.onDeactivation.length, 1);
  console.log(JSON.stringify({ case: "clear-before-reregister", calls, cleanups, inactiveHookCount: n._hooks.onDeactivation.length }));
  // The callback holds no real resource. Remove the diagnostic-only stranded hook.
  n._hooks.onDeactivation.length = 0;
}
