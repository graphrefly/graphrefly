const R = new URL("../../../reference", import.meta.url).href;
const { createGraph, format } = await import(`${R}/kernel/kernel.mjs`);
const { historyRecipe } = await import(`${R}/modules/history.mjs`);
const during = (g, body) => { const s = g.trace.length; body(); return g.trace.slice(s).map(format); };
const g = createGraph(); g.state("t");
// x sends, in one run: [a], INVALIDATE, [b]
g.node("x", ["t"], (ctx) => { const v = ctx.deps[0].waves.flat().at(-1); if (v === undefined) return; if (v === "go") { ctx.down([["DATA", "a"]]); ctx.down([["INVALIDATE"]]); ctx.down([["DATA", "b"]]); } else ctx.down([["DATA", v]]); });
g.node("h", ["x"], historyRecipe({ n: 5 })); // auto INVALIDATE policy
g.subscribe("s", "h");
console.log(during(g, () => g.set("t", "v1")).filter((l) => l.startsWith("s <-")).join("\n"));
console.log("-- one wave: [a], INVALIDATE, [b]");
console.log(during(g, () => g.set("t", "go")).filter((l) => l.startsWith("s <-")).join("\n"));
console.log("-- then a wave ending in INVALIDATE only, and a late subscriber");
const g2 = createGraph(); g2.state("src"); g2.node("h", ["src"], historyRecipe({ n: 5 })); g2.subscribe("s", "h"); g2.set("src", 1); g2.set("src", 2);
g2.invalidate("src");
console.log(during(g2, () => g2.subscribe("late", "h")).join("\n"));
console.log(during(g2, () => g2.set("src", 3)).filter((l) => l.startsWith("s <-") || l.startsWith("late <-")).join("\n"));
