const R = new URL("../../../reference", import.meta.url).href;
const { createGraph, format } = await import(`${R}/kernel/kernel.mjs`);
const { merge, map, latestAsync } = await import(`${R}/kernel/sugar.mjs`);
const { switchMap, mergeMap, relay } = await import(`${R}/modules/higher-order.mjs`);
const { pausable } = await import(`${R}/modules/pause.mjs`);
const { history, historyRecipes } = await import(`${R}/modules/history.mjs`);
const { capture, restore } = await import(`${R}/modules/checkpoint.mjs`);

const during = (g, body) => { const s = g.trace.length; body(); return g.trace.slice(s).map(format); };
const show = (title, lines) => console.log(`\n## ${title}\n` + (Array.isArray(lines) ? lines.join("\n") : lines));
const attempt = (f) => { try { return f(); } catch (e) { return `THROWS: ${e.message}`; } };

// P1 merge, active
{
  const g = createGraph(); g.state("a"); g.state("b"); g.node("m", ["a", "b"], merge());
  g.subscribe("s", "m"); g.set("a", "a1"); g.set("b", "b1");
  show("P1a merge active: invalidate A", during(g, () => g.invalidate("a")));
  show("P1a merge active: late subscriber", during(g, () => g.subscribe("late", "m")));
}
// P1 merge, cold
{
  const g = createGraph(); g.state("a"); g.state("b"); g.node("m", ["a", "b"], merge());
  g.set("a", "a1"); g.set("b", "b1"); g.invalidate("a");
  show("P1b merge cold: first subscriber after the same history", during(g, () => g.subscribe("first", "m")));
}
// P1c merge active, B invalidates instead (value came from B)
{
  const g = createGraph(); g.state("a"); g.state("b"); g.node("m", ["a", "b"], merge());
  g.subscribe("s", "m"); g.set("b", "b1"); g.set("a", "a1"); g.invalidate("b");
  show("P1c merge active: last value from A, B invalidates; late subscriber", during(g, () => g.subscribe("late", "m")));
}
// P2 mergeMap with two attached inners following A and B
{
  const g = createGraph(); g.state("a"); g.state("b"); g.state("src");
  mergeMap(g, "mm", "src", (v) => ({ deps: [v], fn: relay }));
  g.subscribe("s", "mm"); g.set("src", "a"); g.set("src", "b");
  g.set("a", "a1"); g.set("b", "b1");
  show("P2 mergeMap: invalidate inner A's source", during(g, () => g.invalidate("a")));
  show("P2 mergeMap: late subscriber", during(g, () => g.subscribe("late", "mm")));
}
// P3 switchMap: old inner DATA in the switching wave
{
  const g = createGraph(); g.state("x"); g.state("y", "y0"); g.state("src");
  switchMap(g, "sw", "src", (v) => ({ deps: [v], fn: relay }));
  g.subscribe("s", "sw"); g.set("src", "x");
  show("P3 switchMap: one wave with old inner DATA and outer successor", during(g, () => g.batch(() => { g.set("x", "x-late"); g.set("src", "y"); })).filter((l) => l.startsWith("s <-")));
  show("P3b switchMap: outer first in batch order", (() => { const h = createGraph(); h.state("x"); h.state("y", "y0"); h.state("src");
    switchMap(h, "sw", "src", (v) => ({ deps: [v], fn: relay })); h.subscribe("s", "sw"); h.set("src", "x");
    return during(h, () => h.batch(() => { h.set("src", "y"); h.set("x", "x-late"); })).filter((l) => l.startsWith("s <-")); })());
}
// P4 pause: lock list invalidated while holding two arrays
{
  const g = createGraph(); g.state("in");
  const p = pausable(g, "p", "in");
  g.subscribe("s", "p"); g.set("in", 0);
  const l1 = p.pause("L1"); p.pause("L2");
  g.set("in", 1); g.batch(() => { g.set("in", 2); g.set("in", 3); });
  show("P4 pause: invalidate whole lock list (two locks, two held arrays)", during(g, () => g.invalidate(p.locksId)).filter((l) => l.startsWith("s <-")));
  show("P4 pause: locks state after", JSON.stringify(g.get(p.locksId)));
}
// P5 history: one value then invalidation
{
  const g = createGraph(); g.state("src"); history(g, "h", "src", 3);
  g.subscribe("s", "h"); g.set("src", "v");
  show("P5 history: invalidate source", during(g, () => g.invalidate("src")).filter((l) => l.startsWith("s <-")));
  show("P5 history: late subscriber", during(g, () => g.subscribe("late", "h")));
}
// P6 restore: unchanged input, does a restored computed node run again?
{
  let runs = 0;
  const reg = { counted: () => (ctx) => { runs += 1; for (const w of ctx.deps[0].waves) if (w.length) ctx.down(w.map((v) => ["DATA", v])); } };
  const g = createGraph(); g.state("src"); g.node("d", ["src"], reg.counted(), { recipe: { ref: "counted", config: null } });
  g.subscribe("s", "d"); g.set("src", 3);
  const cp = capture(g); const before = runs;
  const g2 = restore(cp, reg);
  show("P6 restore: subscribe with unchanged source", during(g2, () => g2.subscribe("s", "d")));
  show("P6 restore: function runs after restore", String(runs - before));
}
// P7 reference latestAsync pending at capture
{
  const g = createGraph(); g.state("src");
  g.node("job", ["src"], latestAsync(() => new Promise(() => {})), { recipe: { ref: "job", config: null } });
  g.subscribe("s", "job"); g.set("src", "A");
  show("P7 capture while reference latestAsync is waiting", attempt(() => (capture(g), "captured")));
}
// P8 local-only node: when does the reference fail?
{
  const g = createGraph(); g.state("src"); g.node("c", ["src"], map((x) => x));
  g.subscribe("s", "c"); g.set("src", 1);
  const cp = attempt(() => capture(g));
  show("P8 capture with a local-only callback", typeof cp === "string" ? cp : "captured; node entry = " + JSON.stringify(cp.nodes.find((n) => n.id === "c")));
  if (typeof cp !== "string") show("P8 restore of that checkpoint", attempt(() => (restore(cp, {}), "restored")));
}
