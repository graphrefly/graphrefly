// Baseline diagnostic only: no reattach implementation and no network/timers.
// Uses the real adapter with a controlled in-memory driver.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const load = (p: string) => import(pathToFileURL(resolve(p)).href);
const { graph } = await load("packages/ts/src/graph/graph.ts");
const { EnvironmentDrivers } = await load("packages/ts/src/graph/environment.ts");
const { webSocketSession } = await load("packages/ts/src/adapters/environment-websocket-session.ts");

function observe(secondInvocation: boolean) {
  let connects = 0, canceled = 0, sends = 0;
  let event: ((e: unknown) => void) | undefined;
  const g = graph({ environment: new EnvironmentDrivers({ websocket: {
    connectSession(_request: unknown, callback: (e: unknown) => void) {
      connects++;
      event = callback;
      return {
        send(_message: unknown, callback: (r: unknown) => void) {
          sends++;
          callback({ ok: true, value: { sent: true } });
          return () => {};
        },
        close() {},
        cancel() { canceled++; },
      };
    },
  } }) });
  const bundle = webSocketSession(g, { url: "ws://controlled.invalid/no-network" }, { name: "session" });
  const node = g.find("session/events");
  const off = node.subscribe(() => {});
  bundle.start();
  event?.({ kind: "event", event: { kind: "open" } });
  const hooksAfterStart = node._hooks.onDeactivation.length;
  if (secondInvocation) bundle.send("controlled");
  const hooksBeforeOff = node._hooks.onDeactivation.length;
  off();
  const canceledByOff = canceled;
  assert.equal(connects, 1);
  assert.equal(hooksAfterStart, 1);
  assert.equal(hooksBeforeOff, secondInvocation ? 0 : 1);
  assert.equal(canceledByOff, secondInvocation ? 0 : 1);
  assert.equal(sends, secondInvocation ? 1 : 0);
  assert.equal(node._lifecycle.activated, false);
  console.log(JSON.stringify({ secondInvocation, connects, sends, hooksAfterStart,
    hooksBeforeOff, canceledByOff, inactiveAfterOff: !node._lifecycle.activated }));
  // No real resources exist. The surviving fake callback is not invoked after close.
  event = undefined;
}
observe(false);
observe(true);
console.log("DONE 2 baseline observations; proposed reattach path is not implemented or tested");
