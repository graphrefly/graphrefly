const R = new URL("../../../reference", import.meta.url).href;
const { createGraph, format } = await import(`${R}/kernel/kernel.mjs`);
const { historyRecipe } = await import(`${R}/modules/history.mjs`);
const { capture, restore } = await import(`${R}/modules/checkpoint.mjs`);
const during = (g, body) => { const s = g.trace.length; body(); return g.trace.slice(s).map(format); };
const show = (t, l) => console.log(`\n## ${t}\n` + (Array.isArray(l) ? l.join("\n") : l));

// U: the same history function under the kernel's default (auto) INVALIDATE policy
{
  const g = createGraph(); g.state("src");
  g.node("h", ["src"], historyRecipe({ n: 3 }));
  g.subscribe("s", "h"); g.set("src", "v");
  show("U history(auto): invalidate source", during(g, () => g.invalidate("src")).filter((l) => l.startsWith("s <-")));
  show("U history(auto): late subscriber in the gap", during(g, () => g.subscribe("late", "h")));
  show("U history(auto): next DATA", during(g, () => g.set("src", "w")).filter((l) => l.startsWith("s <-")));
}
// Pending work as private state, reopened by setup on a restored node whose input is unchanged
{
  const log = [];
  const delayLike = () => ({
    setup: (ctx) => { const q = ctx.state.get() ?? []; if (q.length) log.push(`setup re-arms ${JSON.stringify(q)}`); },
    fn: (ctx) => { const vs = ctx.deps[0].waves.flat(); if (vs.length) { ctx.state.set([...(ctx.state.get() ?? []), ...vs]); log.push(`fn queued ${JSON.stringify(vs)}`); } },
  });
  const reg = { delayLike };
  const g = createGraph(); g.state("src");
  const built = delayLike();
  g.node("d", ["src"], built.fn, { setup: built.setup, recipe: { ref: "delayLike", config: null } });
  g.subscribe("s", "d"); g.set("src", 3);
  const cp = capture(g); log.length = 0;
  const g2 = restore(cp, reg); g2.subscribe("s", "d");
  show("restored node, unchanged input: what ran", log.length ? log : "nothing");
}
