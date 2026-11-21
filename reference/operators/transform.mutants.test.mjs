// Mutants of transform.mjs against the canonical traces; mutants.mjs says what a mutant must do.

import { mutantSuite } from "./mutants.mjs";

const BUILT = (name, key) => "return g.node(id, [sourceId], " + name + "Fn(callable(`" + name + " ${id}`, " + key + ")), ";
const NODE = (name, key) => `${BUILT(name, key)}withRecipe("operators.${name}", "${key}", recipe));`;
const POLICY = (name, key, policy) => `${BUILT(name, key)}{ ${policy}, ...withRecipe("operators.${name}", "${key}", recipe) });`;
const MAP = `for (const w of ctx.deps[0].waves) if (w.length) ctx.down(w.map((v) => ["DATA", f(v)]));`;
const KEPT = `    const kept = w.filter((v) => p(v));\n    if (kept.length) ctx.down(kept.map((v) => ["DATA", v]));`;
const TAP = `    for (const v of w) f(v);\n    ctx.down(w.map((v) => ["DATA", v]));`;

const MUTANTS = [
  // map
  ["map sends the value without calling f", "O-map use: sends f(v)", MAP, `for (const w of ctx.deps[0].waves) if (w.length) ctx.down(w.map((v) => ["DATA", v]));`],
  ["map merges the arrays of a wave into one", "O-map use: one output array for each input array",
    MAP, `{ const all = ctx.deps[0].waves.flat(); if (all.length) ctx.down(all.map((v) => ["DATA", f(v)])); }`],
  ["map sends an array's values in reverse", "O-map use: in order", MAP, `for (const w of ctx.deps[0].waves) if (w.length) ctx.down([...w].reverse().map((v) => ["DATA", f(v)]));`],
  ["map sends only the last value of an array", "O-map use: for every DATA", MAP, `for (const w of ctx.deps[0].waves) if (w.length) ctx.down([["DATA", f(w[w.length - 1])]]);`],
  ["map skips a value whose callback throws", "O-common: a throw from a callback is the operator's ERROR",
    MAP, `for (const w of ctx.deps[0].waves) { const out = w.flatMap((v) => { try { return [["DATA", f(v)]]; } catch { return []; } }); if (out.length) ctx.down(out); }`],
  ["map keeps its output at a source INVALIDATE", "O-common: an input's effective INVALIDATE retracts the retained output", NODE("map", "f"), POLICY("map", "f", `invalidate: "manual"`)],
  ["map never completes", "O-common: it completes once every input has ended", NODE("map", "f"), POLICY("map", "f", `terminal: { complete: "manual" }`)],
  ["map sends a wave's DATA before its source's ERROR", "O-common: an input's ERROR ends the operator",
    [[NODE("map", "f"), POLICY("map", "f", `terminal: { error: "manual" }`)],
      [MAP, `for (const w of ctx.deps[0].waves) if (w.length) ctx.down(w.map((v) => ["DATA", f(v)]));\n  if (ctx.deps[0].terminal?.[0] === "ERROR") ctx.down([ctx.deps[0].terminal]);`]]],
  ["map's recipe builds another function", "R-checkpoint: a restored node is built from its recipe",
    `"operators.map": (config, at) => mapFn(callbackOf(at, config?.f)),`, `"operators.map": () => mapFn((v) => v),`],
  // filter
  ["filter sends every value", "O-filter use: sends the DATA for which p holds", KEPT, `    const kept = w;\n    if (kept.length) ctx.down(kept.map((v) => ["DATA", v]));`],
  ["filter sends the values for which p does not hold", "O-filter use: sends the DATA for which p holds", KEPT, `    const kept = w.filter((v) => !p(v));\n    if (kept.length) ctx.down(kept.map((v) => ["DATA", v]));`],
  // Not a mutant here: a filter that calls ctx.down with no message for an array left empty. The
  // reference kernel sends nothing for it, so no sink could tell it from the module as written.
  ["filter sends only the first value that passes in an array", "O-filter use: each in the array it came in", KEPT, `    const kept = w.filter((v) => p(v)).slice(0, 1);\n    if (kept.length) ctx.down(kept.map((v) => ["DATA", v]));`],
  ["filter merges the arrays of a wave into one", "O-filter use: each in the array it came in",
    `  for (const w of ctx.deps[0].waves) {\n${KEPT}\n  }`, `  { const w = ctx.deps[0].waves.flat();\n${KEPT}\n  }`],
  ["filter drops a value whose callback throws", "O-common: a throw from a callback is the operator's ERROR",
    KEPT, `    const kept = w.filter((v) => { try { return p(v); } catch { return false; } });\n    if (kept.length) ctx.down(kept.map((v) => ["DATA", v]));`],
  ["filter keeps its output at a source INVALIDATE", "O-common: an input's effective INVALIDATE retracts the retained output", NODE("filter", "p"), POLICY("filter", "p", `invalidate: "manual"`)],
  ["filter's recipe builds another predicate", "R-checkpoint: a restored node is built from its recipe",
    `"operators.filter": (config, at) => filterFn(callbackOf(at, config?.p)),`, `"operators.filter": () => filterFn(() => true),`],
  // tap
  ["tap does not call f", "O-tap use: calls f(v) for every DATA", TAP, `    ctx.down(w.map((v) => ["DATA", v]));`],
  ["tap calls f once for an array", "O-tap use: for every DATA", TAP, `    f(w[0]);\n    ctx.down(w.map((v) => ["DATA", v]));`],
  ["tap calls f in reverse", "O-tap use: in order", TAP, `    for (const v of [...w].reverse()) f(v);\n    ctx.down(w.map((v) => ["DATA", v]));`],
  ["tap sends what f returns", "O-tap use: ignores what f returns, and sends the source's arrays unchanged", TAP, `    ctx.down(w.map((v) => ["DATA", f(v)]));`],
  ["tap swallows a throw from f", "O-tap use: a throw from f ends the branch with ERROR", TAP, `    for (const v of w) { try { f(v); } catch { /* swallowed */ } }\n    ctx.down(w.map((v) => ["DATA", v]));`],
  ["tap merges the arrays of a wave into one", "O-tap use: sends the source's arrays unchanged",
    `  for (const w of ctx.deps[0].waves) {\n    if (!w.length) continue;\n${TAP}\n  }`, `  { const w = ctx.deps[0].waves.flat();\n    if (!w.length) return;\n${TAP}\n  }`],
  ["tap calls f for a source INVALIDATE", "O-tap use: f is called for DATA alone",
    [[NODE("tap", "f"), POLICY("tap", "f", `invalidate: "manual"`)],
      [`  for (const w of ctx.deps[0].waves) {\n    if (!w.length) continue;`, `  if (ctx.deps[0].invalidated) { f("invalidated"); ctx.down([["INVALIDATE"]]); }\n  for (const w of ctx.deps[0].waves) {\n    if (!w.length) continue;`]]],
  ["tap calls f for its source's COMPLETE", "O-tap use: f is called for DATA alone",
    [[NODE("tap", "f"), POLICY("tap", "f", `terminal: { complete: "manual" }`)],
      [`  for (const w of ctx.deps[0].waves) {\n    if (!w.length) continue;`, `  if (ctx.deps[0].terminal) { f("ended"); ctx.down([ctx.deps[0].terminal]); }\n  for (const w of ctx.deps[0].waves) {\n    if (!w.length) continue;`]]],
  ["tap's recipe builds another callback", "R-checkpoint: a restored node is built from its recipe",
    `"operators.tap": (config, at) => tapFn(callbackOf(at, config?.f)),`, `"operators.tap": () => tapFn(() => {}),`],
  // found by the second review: inputs no trace had carried
  ["map drops a falsy result", "O-map use: sends f(v) for every DATA v",
    MAP, `for (const w of ctx.deps[0].waves) if (w.length) ctx.down(w.map((v) => ["DATA", f(v)]).filter((m) => m[1]));`],
  ["map skips a result equal to its last", "O-map use: sends f(v) for every DATA v",
    MAP, `for (const w of ctx.deps[0].waves) if (w.length) { const out = w.map((v) => f(v)).filter((x) => x !== ctx.state.get()?.last); if (out.length) { ctx.state.set({ last: out[out.length - 1] }); ctx.down(out.map((x) => ["DATA", x])); } }`],
  ["filter stops at the first array it leaves empty", "O-filter use: an array left with no DATA is not sent",
    KEPT, `    const kept = w.filter((v) => p(v));\n    if (!kept.length) return;\n    ctx.down(kept.map((v) => ["DATA", v]));`],
  ["filter completes at its source's ERROR", "O-common: an input's ERROR ends the operator with that ERROR",
    [[NODE("filter", "p"), POLICY("filter", "p", `terminal: { complete: "manual", error: "manual" }`)],
      [`  for (const w of ctx.deps[0].waves) {\n${KEPT}\n  }`, `  for (const w of ctx.deps[0].waves) {\n${KEPT}\n  }\n  if (ctx.deps[0].terminal) ctx.down([["COMPLETE"]]);`]]],
  ["filter puts its source's COMPLETE in its last DATA array", "O-common: after DATA it would have sent anyway the COMPLETE is an array of its own",
    [[NODE("filter", "p"), POLICY("filter", "p", `terminal: { complete: "manual" }`)],
      [`  for (const w of ctx.deps[0].waves) {\n${KEPT}\n  }`, `  const all = ctx.deps[0].waves.flat().filter((v) => p(v)).map((v) => ["DATA", v]);\n  if (ctx.deps[0].terminal) all.push(ctx.deps[0].terminal);\n  if (all.length) ctx.down(all);`]]],
  ["tap calls f for the DATA of its source's ERROR wave", "O-tap use: DATA that tap does not send is not given to f",
    [[NODE("tap", "f"), POLICY("tap", "f", `terminal: { error: "manual" }`)],
      [`  for (const w of ctx.deps[0].waves) {\n    if (!w.length) continue;`, `  if (ctx.deps[0].terminal?.[0] === "ERROR") { for (const v of ctx.deps[0].waves.flat()) f(v); ctx.down([ctx.deps[0].terminal]); return; }\n  for (const w of ctx.deps[0].waves) {\n    if (!w.length) continue;`]]],
  ["tap sends only the values for which f returns something truthy", "O-tap use: what f returns is not read",
    TAP, `    const kept = w.filter((v) => f(v));\n    if (kept.length) ctx.down(kept.map((v) => ["DATA", v]));`],
  ["tap puts its source's COMPLETE in its last DATA array", "O-common: after DATA it would have sent anyway the COMPLETE is an array of its own",
    [[NODE("tap", "f"), POLICY("tap", "f", `terminal: { complete: "manual" }`)],
      [`  for (const w of ctx.deps[0].waves) {\n    if (!w.length) continue;\n${TAP}\n  }`, `  const all = ctx.deps[0].waves.flat();\n  for (const v of all) f(v);\n  const out = all.map((v) => ["DATA", v]);\n  if (ctx.deps[0].terminal) out.push(ctx.deps[0].terminal);\n  if (out.length) ctx.down(out);`]]],
];

mutantSuite({ module: "transform", operators: ["map", "filter", "tap"], mutants: MUTANTS, minTraces: 7 });
