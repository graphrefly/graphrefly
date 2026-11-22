// Mutants of accumulate.mjs against the canonical traces; mutants.mjs says what a mutant must do.

import { mutantSuite } from "./mutants.mjs";

const SCAN = `  for (const w of ctx.deps[0].waves) if (w.length) ctx.down(w.map((v) => ["DATA", (acc = step(f, acc, v))]));`;
const SCAN_NODE = `return g.node(id, [sourceId], scanFn(f, seed), withRecipe("operators.scan", recipe, seed));`;
const SCAN_SET = `  ctx.state.set({ acc });\n};\n\nconst reduceFn`;
const FOLD = `  for (const v of source.waves.flat()) acc = step(f, acc, v);`;
const END = `  if (source.terminal?.[0] === "COMPLETE") ctx.down([["DATA", acc], ["COMPLETE"]]);`;
const REDUCE_SET = `  ctx.state.set({ acc });\n  if (source.terminal`;
const REDUCE_NODE = `{ terminal: { complete: "manual" }, ...withRecipe("operators.reduce", recipe, seed) }`;

const MUTANTS = [
  // scan
  ["scan sends its seed when it activates", "O-scan use: the seed itself is not sent",
    SCAN, `  if (ctx.state.get() === undefined) ctx.down([["DATA", seed]]);\n${SCAN}`],
  ["scan calls its reducer with the value first", "O-scan use: sends f(accumulator, v)",
    SCAN, `  for (const w of ctx.deps[0].waves) if (w.length) ctx.down(w.map((v) => ["DATA", (acc = step(f, v, acc))]));`],
  ["scan sends only the last intermediate of an array", "O-scan use: each intermediate in the array its input came in",
    SCAN, `  for (const w of ctx.deps[0].waves) if (w.length) { for (const v of w) acc = step(f, acc, v); ctx.down([["DATA", acc]]); }`],
  ["scan sends each intermediate as an array of its own", "O-scan use: each intermediate in the array its input came in",
    SCAN, `  for (const v of ctx.deps[0].waves.flat()) ctx.down([["DATA", (acc = step(f, acc, v))]]);`],
  ["scan merges the arrays of a wave into one", "O-scan use: each intermediate in the array its input came in",
    SCAN, `  { const all = ctx.deps[0].waves.flat(); if (all.length) ctx.down(all.map((v) => ["DATA", (acc = step(f, acc, v))])); }`],
  ["scan starts from its seed at every run", "O-scan use: keeps an accumulator", SCAN_SET, `};\n\nconst reduceFn`],
  ["scan forgets its accumulator at a source INVALIDATE", "O-scan invalidation: keeps the accumulator",
    [[SCAN_NODE, `return g.node(id, [sourceId], scanFn(f, seed), { invalidate: "manual", ...withRecipe("operators.scan", recipe, seed) });`],
      [SCAN, `  if (ctx.deps[0].invalidated) { acc = seed; ctx.down([["INVALIDATE"]]); }\n${SCAN}`]]],
  ["scan keeps its output at a source INVALIDATE", "O-scan invalidation: retracts the output",
    SCAN_NODE, `return g.node(id, [sourceId], scanFn(f, seed), { invalidate: "manual", ...withRecipe("operators.scan", recipe, seed) });`],
  ["scan sends its accumulator again at a source INVALIDATE", "O-scan invalidation: the accumulator is not sent",
    [[SCAN_NODE, `return g.node(id, [sourceId], scanFn(f, seed), { invalidate: "manual", ...withRecipe("operators.scan", recipe, seed) });`],
      [SCAN, `  if (ctx.deps[0].invalidated) ctx.down([["INVALIDATE"]], [["DATA", acc]]);\n  if (ctx.deps[0].invalidated) ctx.down([["DATA", acc]]);\n${SCAN}`]]],
  ["scan keeps its accumulator outside private state", "O-common: progress is private state, which a checkpoint saves",
    [[`const start = (ctx, seed) => (ctx.state.get() ?? { acc: seed }).acc;`, `const kept = new WeakMap();\nconst start = (ctx, seed) => (kept.get(ctx.signal) ?? { acc: seed }).acc;`],
      [SCAN_SET, `  kept.set(ctx.signal, { acc });\n  ctx.state.set({ acc: seed });\n};\n\nconst reduceFn`]]],
  ["scan never completes", "O-common: it completes once every input has ended",
    SCAN_NODE, `return g.node(id, [sourceId], scanFn(f, seed), { terminal: { complete: "manual" }, ...withRecipe("operators.scan", recipe, seed) });`],
  ["a restored scan or reduce loses its seed", "O-scan use: starts at seed; R-checkpoint: a recipe's configuration is saved",
    `return build(callbackOf(at, config.f), config.seed);`, `return build(callbackOf(at, config.f), 0);`],
  ["a restored scan or reduce gets another reducer", "R-checkpoint: a restored node is built from its recipe",
    `return build(callbackOf(at, config.f), config.seed);`, `return build((acc) => acc, config.seed);`],
  // reduce
  ["reduce sends every intermediate", "O-reduce use: sends nothing until its source completes normally",
    FOLD, `  for (const v of source.waves.flat()) ctx.down([["DATA", (acc = step(f, acc, v))]]);`],
  ["reduce calls its reducer with the value first", "O-reduce use: accumulates as scan does", FOLD, `  for (const v of source.waves.flat()) acc = step(f, v, acc);`],
  ["reduce folds only the last value of a wave", "O-reduce use: accumulates as scan does", FOLD, `  for (const v of source.waves.flat().slice(-1)) acc = step(f, acc, v);`],
  ["reduce sends its result and the COMPLETE as two arrays", "O-reduce use: the result and COMPLETE in one array",
    END, `  if (source.terminal?.[0] === "COMPLETE") { ctx.down([["DATA", acc]]); ctx.down([["COMPLETE"]]); }`],
  ["reduce completes without a result", "O-reduce use: then it sends the result", END, `  if (source.terminal?.[0] === "COMPLETE") ctx.down([["COMPLETE"]]);`],
  ["reduce sends nothing but COMPLETE for an empty source", "O-reduce use: an empty source gives the seed",
    END, `  if (source.terminal?.[0] === "COMPLETE") ctx.down(acc === seed ? [["COMPLETE"]] : [["DATA", acc], ["COMPLETE"]]);`],
  ["reduce sends its result at a source ERROR", "O-reduce completion: the pending result is not sent",
    [[REDUCE_NODE, `{ terminal: { complete: "manual", error: "manual" }, ...withRecipe("operators.reduce", recipe, seed) }`],
      [END, `  if (source.terminal) ctx.down([["DATA", acc], source.terminal]);`]]],
  ["reduce ignores a source ERROR", "O-reduce completion: a source ERROR ends reduce with that ERROR",
    REDUCE_NODE, `{ terminal: { complete: "manual", error: "manual" }, ...withRecipe("operators.reduce", recipe, seed) }`],
  ["reduce starts from its seed at every run", "O-reduce invalidation: the accumulator is kept", REDUCE_SET, `  if (source.terminal`],
  ["reduce forgets its accumulator at a source INVALIDATE", "O-reduce invalidation: the accumulator is kept across a source INVALIDATE",
    [[REDUCE_NODE, `{ terminal: { complete: "manual" }, invalidate: "manual", ...withRecipe("operators.reduce", recipe, seed) }`],
      [FOLD, `  if (source.invalidated) acc = seed;\n${FOLD}`]]],
  ["reduce sends its accumulator at a source INVALIDATE", "O-reduce invalidation: neither called nor sent",
    [[REDUCE_NODE, `{ terminal: { complete: "manual" }, invalidate: "manual", ...withRecipe("operators.reduce", recipe, seed) }`],
      [FOLD, `  if (source.invalidated) ctx.down([["DATA", acc]]);\n${FOLD}`]]],
  // found by the second review: inputs no trace had carried
  ["scan restarts from its seed whenever its accumulator is falsy", "O-scan use: keeps an accumulator",
    SCAN, `  if (!acc) acc = seed;\n${SCAN}`],
  ["scan skips an intermediate equal to the one before", "O-scan use: sends f(accumulator, v) for every DATA v",
    SCAN, `  for (const w of ctx.deps[0].waves) if (w.length) ctx.down(w.map((v) => { const before = acc; acc = step(f, acc, v); return before === acc ? null : ["DATA", acc]; }).filter(Boolean));`],
  ["scan calls its reducer at a source INVALIDATE and drops the result", "O-scan invalidation: the reducer is not called",
    [[SCAN_NODE, `return g.node(id, [sourceId], scanFn(f, seed), { invalidate: "manual", ...withRecipe("operators.scan", recipe, seed) });`],
      [SCAN, `  if (ctx.deps[0].invalidated) { f(acc, 0); ctx.down([["INVALIDATE"]]); }\n${SCAN}`]]],
  ["reduce uses its seed whenever its accumulator is falsy", "O-reduce use: accumulates as scan does", FOLD, `  if (!acc) acc = seed;\n${FOLD}`],
  ["reduce sends only the COMPLETE when its result is falsy", "O-reduce use: then it sends the result",
    END, `  if (source.terminal?.[0] === "COMPLETE") ctx.down(acc ? [["DATA", acc], ["COMPLETE"]] : [["COMPLETE"]]);`],
  ["reduce calls its reducer at a source INVALIDATE and drops the result", "O-reduce invalidation: f is not called",
    [[REDUCE_NODE, `{ terminal: { complete: "manual" }, invalidate: "manual", ...withRecipe("operators.reduce", recipe, seed) }`],
      [FOLD, `  if (source.invalidated) f(acc, 0);\n${FOLD}`]]],
  ["reduce keeps its accumulator across activations, outside private state", "O-common: an operator that deactivates without having ended forgets it",
    [[`const reduceFn = (f, seed) => (ctx) => {\n  const [source] = ctx.deps;\n  let acc = start(ctx, seed);`, `let memo;\nconst reduceFn = (f, seed) => (ctx) => {\n  const [source] = ctx.deps;\n  let acc = memo ?? start(ctx, seed);`],
      [REDUCE_SET, `  ctx.state.set({ acc });\n  memo = acc;\n  if (source.terminal`]]],
  ["reduce goes on after its reducer returns no value", "O-reduce use: a result of f that is not a value ends reduce with ERROR in the wave f returned it",
    FOLD, `  for (const v of source.waves.flat()) acc = f(acc, v);`],
  // found by the whole-branch review (2026-11-21); OT-108 and OT-109 hold them
  ["reduce activated on a source that has ended sends its seed", "O-common: at activation an operator runs on its inputs' snapshots; O-reduce use: sends the result when its source completes",
    FOLD, `  for (const v of (ctx.state.get() === undefined && source.terminal ? [] : source.waves.flat())) acc = step(f, acc, v);`],
  ["a restored scan or reduce whose source changed starts again from its seed", "O-common: a checkpoint saves an operator's progress",
    `const start = (ctx, seed) => (ctx.state.get() ?? { acc: seed }).acc;`, `const start = (ctx, seed) => (ctx.seed !== undefined ? { acc: seed } : ctx.state.get() ?? { acc: seed }).acc;`, ["scan", "reduce"]],
  // the review of 2026-11-21: a restored operator whose input changed while saved, activation on an input that has ended, two terminals in one wave
  ["a restored reduce whose source only completed while saved sends its seed", "O-common: a checkpoint saves an operator's progress; O-reduce use: sends the result when its source completes normally",
    [["  if (source.terminal?.[0] === \"COMPLETE\") ctx.down([[\"DATA\", acc], [\"COMPLETE\"]]);", "  if (source.terminal?.[0] === \"COMPLETE\") ctx.down([[\"DATA\", ctx.seed !== undefined && !source.waves.flat().length ? seed : acc], [\"COMPLETE\"]]);"]]],
  // the verification re-run of 2026-11-21: an input that ended while saved, other changes while saved, inputs that hold several values, terminals in other roles, callbacks in the wave of an ERROR
  ["a restored scan whose source changed to two values while saved sends the last intermediate only", "O-scan use: sends f(accumulator, v) for every DATA v; R-checkpoint: a changed dependency is given as changed",
    [["if (w.length) ctx.down(w.map((v) => [\"DATA\", (acc = step(f, acc, v))]));", "if (w.length) { const sent = w.map((v) => [\"DATA\", (acc = step(f, acc, v))]); ctx.down(ctx.seed !== undefined ? sent.slice(-1) : sent); }"]]],
  ["a restored reduce whose source changed and completed while saved does not fold the new value", "O-reduce use: accumulates, and sends the result when its source completes; R-checkpoint: a changed dependency is given as changed",
    [["  for (const v of source.waves.flat()) acc = step(f, acc, v);", "  for (const v of (ctx.seed !== undefined && source.terminal ? [] : source.waves.flat())) acc = step(f, acc, v);"]]],
  ["reduce activated on a completed source that holds two values folds the last only", "O-reduce use: accumulates as scan does; O-common: at activation it runs on its inputs' snapshots",
    [["  for (const v of source.waves.flat()) acc = step(f, acc, v);", "  for (const v of (ctx.state.get() === undefined && source.terminal ? source.waves.flat().slice(-1) : source.waves.flat())) acc = step(f, acc, v);"]]],
  ["reduce folds only the first array of the wave that completes its source", "O-reduce use: accumulates as scan does (every DATA), and sends the result when its source completes",
    [["  for (const v of source.waves.flat()) acc = step(f, acc, v);", "  for (const v of (source.terminal ? source.waves.slice(0, 1) : source.waves).flat()) acc = step(f, acc, v);"]]],
  ["scan sends only the last intermediate of an array that comes with its source's terminal", "O-scan use: sends f(accumulator, v) for every DATA v; O-common: at activation it runs on its inputs' snapshots",
    [["if (w.length) ctx.down(w.map((v) => [\"DATA\", (acc = step(f, acc, v))]));", "if (w.length) { const sent = w.map((v) => [\"DATA\", (acc = step(f, acc, v))]); ctx.down(ctx.deps[0].terminal ? sent.slice(-1) : sent); }"]]],
  ["reduce calls its reducer for the DATA that comes with its source's ERROR, in a wave or in the snapshot it activates on", "O-common: an input's ERROR ends the operator: it does not process that wave's DATA (nor, at activation, what the input holds)",
    [["{ terminal: { complete: \"manual\" }, ...withRecipe(\"operators.reduce\", recipe, seed) }", "{ terminal: { complete: \"manual\", error: \"manual\" }, ...withRecipe(\"operators.reduce\", recipe, seed) }"], ["  if (source.terminal?.[0] === \"COMPLETE\") ctx.down([[\"DATA\", acc], [\"COMPLETE\"]]);", "  if (source.terminal?.[0] === \"COMPLETE\") ctx.down([[\"DATA\", acc], [\"COMPLETE\"]]);\n  if (source.terminal?.[0] === \"ERROR\") ctx.down([source.terminal]);"]]],
  ["scan calls its reducer, and keeps the result, for the DATA that comes with its source's ERROR", "O-common: an input's ERROR ends the operator: it does not process that wave's DATA (nor, at activation, what the input holds)",
    [["withRecipe(\"operators.scan\", recipe, seed));", "{ terminal: { error: \"manual\" }, ...withRecipe(\"operators.scan\", recipe, seed) });"], ["  for (const w of ctx.deps[0].waves) if (w.length) ctx.down(w.map((v) => [\"DATA\", (acc = step(f, acc, v))]));", "  const failed = ctx.deps[0].terminal?.[0] === \"ERROR\";\n  for (const w of ctx.deps[0].waves) if (w.length) { const out = w.map((v) => [\"DATA\", (acc = step(f, acc, v))]); if (!failed) ctx.down(out); }\n  if (failed) ctx.down([ctx.deps[0].terminal]);"]]],
];

mutantSuite({ module: "accumulate", operators: ["scan", "reduce"], mutants: MUTANTS, minTraces: 9 });
