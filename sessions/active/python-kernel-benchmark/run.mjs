import { createGraph } from "../../../reference/kernel/kernel.mjs";
import { readFileSync } from "node:fs";
const sumOf = (ctx) => ctx.deps.reduce((a, d) => a + (d.has ? d.value : 0), 0);
const FNS = {
  sum: (ctx) => { if (ctx.deps.every((d) => d.has)) ctx.down([["DATA", sumOf(ctx)]]); },
  sumv: (ctx) => { ctx.down([["DATA", sumOf(ctx)]]); },
  waves: (ctx) => { ctx.down([["DATA", ctx.deps.reduce((a, d) => a + d.waves.flat().length + (d.terminal ? 100 : 0) + (d.invalidated ? 1000 : 0), 0)]]); },
  even: (ctx) => { const s = sumOf(ctx); if (s % 2 === 0) ctx.down([["DATA", s]]); },
  throw: (ctx) => { const s = sumOf(ctx); if (s > 7) throw new Error("big"); ctx.down([["DATA", s]]); },
  twice: (ctx) => { const s = sumOf(ctx); ctx.down([["DATA", s]]); ctx.down([["DATA", s + 1]]); },
  inv: (ctx) => { const s = sumOf(ctx); if (s % 3 === 0) ctx.down([["INVALIDATE"]]); else ctx.down([["DATA", s]]); },
};
const out = [];
for (const sc of JSON.parse(readFileSync(0, "utf8"))) {
  const g = createGraph({ report: (e) => g.trace.push({ report: e.source }) });
  for (const n of sc.nodes) {
    if (n.kind === "state") g.state(n.id, n.initial ?? undefined);
    else g.node(n.id, n.deps, FNS[n.fn], n.opts);
  }
  const run = (op) => {
    try {
      const [k, a, b] = op;
      if (k === "subscribe") g.subscribe(a, b);
      else if (k === "unsubscribe") g.unsubscribe(a, b);
      else if (k === "set") g.set(a, b);
      else if (k === "setfn") g.set(a, (p) => (p ?? 0) + b);
      else if (k === "invalidate") g.invalidate(a);
      else if (k === "complete") g.complete(a);
      else if (k === "error") g.error(a, b);
      else if (k === "batch") g.batch(() => a.forEach(run));
    } catch (e) { g.trace.push({ thrown: e.message }); }
  };
  sc.ops.forEach(run);
  out.push(g.trace.map((t) => t.msgs ? { to: t.to, from: t.from, msgs: t.msgs } : t));
}
console.log(JSON.stringify(out));
