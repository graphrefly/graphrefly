// D808 shared behavioral probe. Run: node reference/kernel/probe-rereview.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGraph } from "./kernel.mjs";
import { observe } from "../modules/observe.mjs";
import { capture, restore } from "../modules/checkpoint.mjs";

const fixture = JSON.parse(readFileSync(new URL("../../spec/fixtures/d797-rereview.v1.json", import.meta.url)));
const values = (msgs) => msgs.filter(([type]) => type === "DATA").map(([, value]) => value);
const result = {};
{
  const g = createGraph();
  g.state("s", 0);
  g.node("q", ["s"], (ctx) => { if (ctx.deps[0].terminal) ctx.down([["DATA", 99]]); }, { quiet: true });
  const seen = [];
  g.node("d", ["q"], (ctx) => seen.push({ waves: ctx.deps[0].waves, terminal: ctx.deps[0].terminal?.[0] }), { terminal: { complete: "manual" } });
  g.subscribe("hold", "d");
  seen.length = 0;
  g.complete("s");
  result.quietTerminal = { runs: seen.length, ...seen[0] };
}
{
  const g = createGraph();
  g.state("s", 0);
  g.node("n", ["s"], (ctx) => {
    if (ctx.deps[0].value === 1) { ctx.down([["DATA", 1]]); ctx.down([["DATA", 2]]); }
  });
  const observed = [], subscribed = [];
  const stop = observe(g, ["n"], ({ msgs }) => {
    if (values(msgs).length) { observed.push(...values(msgs)); stop(); }
  });
  g.subscribe("sink", "n", (msgs) => {
    if (values(msgs).length) { subscribed.push(...values(msgs)); g.unsubscribe("sink", "n"); }
  });
  g.set("s", 1);
  result.observeStop = observed;
  result.subscribeStop = subscribed;
}
{
  const g = createGraph();
  let ctx;
  g.node("n", [], (c) => { ctx = c; });
  let arrays = 0;
  g.subscribe("hold", "n", () => { arrays++; });
  arrays = 0;
  ctx.down([]);
  result.emptyDown = { arrays };
  g.state("s", 0);
  const emitted = [];
  g.subscribe("values", "n", (msgs) => emitted.push(...values(msgs)));
  assert.throws(() => g.batch(() => {
    g.set("s", () => { throw new Error("failed updater"); });
    ctx.down([["DATA", 42]]);
  }), /failed updater/);
  result.lateAfterCommitFailure = emitted;
}
{
  const g = createGraph();
  g.state("ledger", 0);
  g.node("n", [], () => {}, { setup: (ctx) => {
    ctx.state.set(42);
    return () => g.set("ledger", ctx.state.get());
  } });
  g.subscribe("hold", "n");
  const written = [];
  g.subscribe("values", "ledger", (msgs) => written.push(...values(msgs)));
  written.length = 0;
  g.replace("n", [], () => {});
  result.replaceCleanup = written;
}
{
  const reports = [];
  const g = createGraph({ report: (r) => reports.push(r) });
  g.state("trigger", 0); g.state("a", 0); g.state("b", 0);
  let updaterRuns = 0;
  g.subscribe("requester", "trigger", (msgs) => {
    if (!values(msgs).includes(1)) return;
    g.complete("a");
    g.batch(() => {
      g.set("b", () => { updaterRuns++; return 1; });
      g.set("a", () => { updaterRuns++; return 1; });
    });
  });
  g.set("trigger", 1);
  result.endedBatch = { updaterRuns, otherValue: g.get("b").value, reports: reports.length };
}
{
  const g = createGraph();
  g.node("n", [], () => {}, { recipe: { ref: "absent" } });
  try { restore(capture(g), {}); } catch (e) { result.checkpointMissingRecipe = e.message; }
}
assert.deepEqual(result, fixture.probeExpected);
console.log(JSON.stringify(result, null, 2));
