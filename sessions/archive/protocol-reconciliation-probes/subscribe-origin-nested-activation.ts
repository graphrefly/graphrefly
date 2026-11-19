// QA-16 current baseline diagnostics, NOT proposed origin admission/scheduling tests.
// Run from graphrefly-ts. All nodes still use their ordinary dispatcher path.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { Graph } = await import(pathToFileURL(resolve("packages/ts/src/graph/graph.ts")).href);

for (const origin of ["observer", "raw-fn"] as const) {
  const g = new Graph(), source = g.state(0);
  const events: string[] = [];
  let offX: (() => void) | undefined;
  const x = g.producer((ctx: any) => { events.push("X:fn"); ctx.down([["DATA", 7]]); });
  const acquire = () => {
    events.push(`${origin}:enter`);
    offX = x.subscribe((msg: readonly unknown[]) => { events.push(`X:${msg[0]}`); });
    events.push(`${origin}:exit`);
  };
  let offOrigin: () => void;
  if (origin === "observer") {
    offOrigin = source.subscribe((msg: readonly unknown[]) => { if (msg[0] === "DATA") acquire(); });
  } else {
    const n = g.node([source], () => { acquire(); });
    offOrigin = n.subscribe(() => {});
  }
  assert.ok(events.indexOf("X:fn") > events.indexOf(`${origin}:enter`));
  assert.ok(events.indexOf("X:fn") < events.indexOf(`${origin}:exit`));
  console.log(JSON.stringify({ origin, events }));
  offOrigin();
  offX?.();
}
