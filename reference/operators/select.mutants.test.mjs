// Mutants of select.mjs against the canonical traces; mutants.mjs says what a mutant must do.

import { mutantSuite } from "./mutants.mjs";

const END = `    if (ended) { arrays.push([...out, ["COMPLETE"]]); break; }`;
const STOP = `      ended = visit(ctx, v, out);\n      if (ended) break;`;
const ERR = `  if (!ended && source.terminal?.[0] === "ERROR") { ctx.down([source.terminal]); return; }`;
const SEND = `  for (const array of arrays) ctx.down(array);`;
const HEAD = `const ending = (visit) => (ctx) => {\n  const [source] = ctx.deps;`;
const STOPS = `const stops = { terminal: { error: "manual" } };`;
const SEEN = `    const seen = (ctx.state.get()?.seen ?? 0) + 1;\n    ctx.state.set({ seen });`;
const ZERO = `  return (ctx) => (n === 0 ? ctx.down([["COMPLETE"]]) : counting(ctx)); // take(0) completes whatever its source holds`;
const TAKE_NODE = `{ ...stops, recipe: { ref: "operators.take", config: { n } } }`;
const SLICE = `      const kept = w.slice(Math.max(0, n - seen)); // an array left empty is not sent`;
const SKIP_NODE = `{ recipe: { ref: "operators.skip", config: { n } } }`;
const SKIP_HEAD = `    let seen = ctx.state.get()?.seen ?? 0;\n    for (const w of ctx.deps[0].waves) {`;
const WHILE = `  if (!p(v)) return true;\n  out.push(["DATA", v]);\n  return false;`;
const FIRST = `  if (!p(v)) return false;\n  out.push(["DATA", v]);\n  return true;`;
const CAND = `  for (const v of source.waves.flat()) if (p(v)) candidate = [v];`;
const L_END = `  if (source.terminal?.[0] === "COMPLETE") ctx.down([...candidate.map((v) => ["DATA", v]), ["COMPLETE"]]);`;
const L_NODE = `{ terminal: { complete: "manual" }, ...carried }`;
const L_HEAD = `  let candidate = ctx.state.get()?.candidate ?? [];`;

const MUTANTS = [
  // what take, takeWhile and first share
  ["the COMPLETE of an operator that ends itself is an array of its own", "O-take use: completes in the array of the nth; O-first use: completes in the same array; O-takeWhile use: in the array it was sending then",
    END, `    if (ended) { if (out.length) arrays.push(out); arrays.push([["COMPLETE"]]); break; }`, ["take", "takeWhile", "first"]],
  ["an operator that ends itself goes on reading the array it ended in", "O-take use: what its source sends after the nth is not sent; O-takeWhile, O-first use: p is not called again",
    STOP, `      ended = visit(ctx, v, out) || ended;`, ["take", "takeWhile", "first"]],
  ["an ERROR that follows the ending DATA in the wave ends the operator", "O-take, O-takeWhile, O-first same-wave: an ERROR that follows that DATA in the same wave is not sent", ERR, `  if (source.terminal?.[0] === "ERROR") { ctx.down([source.terminal]); return; }`, ["take", "takeWhile", "first"]],
  ["a source ERROR is sent after that wave's DATA", "O-common: an input's ERROR ends the operator without that wave's DATA, unless its contract says it ends itself first", `${ERR}\n${SEND}`, `${SEND}\n  if (!ended && source.terminal?.[0] === "ERROR") ctx.down([source.terminal]);`, ["take", "takeWhile"]],
  ["a source ERROR is ignored", "O-common: an input's ERROR ends the operator", `${ERR}\n`, ``, ["take", "takeWhile", "first"]],
  ["progress is touched at a source INVALIDATE: a count is added or a predicate is called", "O-take invalidation: only DATA is counted; O-takeWhile, O-first invalidation: calls no predicate",
    [[STOPS, `const stops = { terminal: { error: "manual" }, invalidate: "manual" };`], [HEAD, `${HEAD}\n  if (source.invalidated) { visit(ctx, 0, []); ctx.down([["INVALIDATE"]]); }`]], undefined, ["take", "takeWhile", "first"]],
  ["take, takeWhile and first keep their output at a source INVALIDATE", "O-take, O-takeWhile invalidation: retracts the retained output", STOPS, `const stops = { terminal: { error: "manual" }, invalidate: "manual" };`, ["take", "takeWhile"]],
  // take
  ["take sends one DATA too many", "O-take use: sends the first n DATA", `    return seen >= n;`, `    return seen > n;`],
  ["take(0) waits for a DATA", "O-take use: take(0) completes on activation and reads nothing", ZERO, `  return counting;`],
  ["take forgets its count at a source INVALIDATE", "O-take invalidation: leaves the count already seen",
    [[TAKE_NODE, `{ ...stops, invalidate: "manual", recipe: { ref: "operators.take", config: { n } } }`],
      [ZERO, `  return (ctx) => { if (ctx.deps[0].invalidated) { ctx.state.set({ seen: 0 }); ctx.down([["INVALIDATE"]]); } return n === 0 ? ctx.down([["COMPLETE"]]) : counting(ctx); };`]]],
  ["take keeps its count outside private state", "O-common: progress is private state, which lasts for one activation and which a checkpoint saves",
    [[`  const counting = ending((ctx, v, out) => {`, `  let memo = 0;\n  const counting = ending((ctx, v, out) => {`], [SEEN, `    const seen = (memo += 1);`]]],
  ["a restored take gets another n", "R-checkpoint: a restored node is built from its recipe", `"operators.take": (config) => takeFn(config ?? {}),`, `"operators.take": () => takeFn({ n: 1 }),`],
  // skip
  ["skip drops one DATA too many", "O-skip use: drops the first n DATA", SLICE, `      const kept = w.slice(Math.max(0, n + 1 - seen));`],
  ["skip drops one DATA too few", "O-skip use: drops the first n DATA", SLICE, `      const kept = w.slice(Math.max(0, n - 1 - seen));`],
  ["skip counts arrays, not DATA", "O-skip invalidation: only DATA is counted", `      seen = Math.min(n, seen + w.length);`, `      seen = Math.min(n, seen + 1);`],
  ["skip merges the arrays of a wave into one", "O-skip use: each in the array it came in", SKIP_HEAD, `    let seen = ctx.state.get()?.seen ?? 0;\n    for (const w of [ctx.deps[0].waves.flat()]) {`],
  ["skip forgets its count at a source INVALIDATE", "O-skip invalidation: leaves the count already seen",
    [[SKIP_NODE, `{ invalidate: "manual", recipe: { ref: "operators.skip", config: { n } } }`],
      [SKIP_HEAD, `    let seen = ctx.state.get()?.seen ?? 0;\n    if (ctx.deps[0].invalidated) { seen = 0; ctx.down([["INVALIDATE"]]); }\n    for (const w of ctx.deps[0].waves) {`]]],
  ["skip keeps its output at a source INVALIDATE", "O-skip invalidation: retracts the retained output", SKIP_NODE, `{ invalidate: "manual", recipe: { ref: "operators.skip", config: { n } } }`],
  ["skip keeps its count only for the run", "O-skip use: drops the first n DATA", `    ctx.state.set({ seen });\n  };\n};`, `    ctx.state.set({ seen: 0 });\n  };\n};`],
  ["skip keeps its count across activations, outside private state", "O-common: an operator that deactivates without having ended forgets it",
    [[`  count("skip", n);\n  return (ctx) => {`, `  count("skip", n);\n  let memo = 0;\n  return (ctx) => {`], [SKIP_HEAD, `    let seen = ctx.state.get()?.seen ?? memo;\n    for (const w of ctx.deps[0].waves) {`],
      [`    ctx.state.set({ seen });\n  };\n};`, `    ctx.state.set({ seen });\n    memo = seen;\n  };\n};`]]],
  ["a restored skip gets another n", "R-checkpoint: a restored node is built from its recipe", `"operators.skip": (config) => skipFn(config ?? {}),`, `"operators.skip": () => skipFn({ n: 0 }),`],
  // takeWhile
  ["takeWhile sends the DATA for which its predicate fails", "O-takeWhile use: without sending that one", WHILE, `  if (!p(v)) { out.push(["DATA", v]); return true; }\n  out.push(["DATA", v]);\n  return false;`],
  ["takeWhile drops that DATA and goes on", "O-takeWhile use: completes at the first DATA for which it does not", WHILE, `  if (!p(v)) return false;\n  out.push(["DATA", v]);\n  return false;`],
  ["takeWhile completes at the first DATA for which its predicate holds", "O-takeWhile use: sends DATA while p holds", WHILE, `  if (p(v)) return true;\n  out.push(["DATA", v]);\n  return false;`],
  ["a restored takeWhile gets another predicate", "R-checkpoint: a restored node is built from its recipe", `takeWhileFn(callbackOf(at, config?.p))`, `takeWhileFn(() => true)`],
  // first
  ["first sends every match and never ends itself", "O-first use: completes in the same array", FIRST, `  if (!p(v)) return false;\n  out.push(["DATA", v]);\n  return false;`],
  ["first sends what it passes over on the way to the match", "O-first use: the first for which p holds", FIRST, `  out.push(["DATA", v]);\n  return Boolean(p(v));`],
  ["first ends at the first DATA whatever its predicate says", "O-first use: the first for which p holds", FIRST, `  out.push(["DATA", v]);\n  return true;`],
  ["a restored first loses its predicate", "R-checkpoint: a restored node is built from its recipe", `firstFn(predicateOf("first", config, at))`, `firstFn(any)`],
  // last
  ["last keeps the first match", "O-last use: the last for which p held", CAND, `  for (const v of source.waves.flat()) if (p(v) && !candidate.length) candidate = [v];`],
  ["last ignores its predicate", "O-last use: the last for which p held", CAND, `  for (const v of source.waves.flat()) candidate = [v];`],
  ["last sends each candidate as it comes", "O-last use: with COMPLETE in one array when its source completes", CAND, `  for (const v of source.waves.flat()) if (p(v)) { candidate = [v]; ctx.down([["DATA", v]]); }`],
  ["last sends its DATA and the COMPLETE as two arrays", "O-last use: with COMPLETE in one array",
    L_END, `  if (source.terminal?.[0] === "COMPLETE") { if (candidate.length) ctx.down([["DATA", candidate[0]]]); ctx.down([["COMPLETE"]]); }`],
  ["last completes without its DATA", "O-last use: sends the last DATA", L_END, `  if (source.terminal?.[0] === "COMPLETE") ctx.down([["COMPLETE"]]);`],
  ["last sends its candidate at a source ERROR", "O-last completion: the candidate is not sent",
    [[L_NODE, `{ terminal: { complete: "manual", error: "manual" }, ...carried }`],
      [L_END, `  if (source.terminal) ctx.down([...candidate.map((v) => ["DATA", v]), source.terminal]);`]]],
  ["last forgets its candidate at a source INVALIDATE", "O-last invalidation: the candidate is kept across a source INVALIDATE",
    [[L_NODE, `{ terminal: { complete: "manual" }, invalidate: "manual", ...carried }`],
      [L_HEAD, `  let candidate = source.invalidated ? [] : ctx.state.get()?.candidate ?? [];`]]],
  ["last keeps its candidate only for the run", "O-last use: the last DATA", `  ctx.state.set({ candidate });`, `  ctx.state.set({ candidate: [] });`],
  ["a restored last loses its predicate", "R-checkpoint: a restored node is built from its recipe", `lastFn(predicateOf("last", config, at))`, `lastFn(any)`],
  // found by the third review: inputs no trace had carried
  ["first and last without a predicate take only truthy DATA", "O-first use: sends the first DATA; O-last use: sends the last DATA", `const any = () => true;`, `const any = (v) => v;`, ["first", "last"]],
  ["an operator that has ended goes on over the arrays after the one it ended in", "O-take use: what its source sends after the nth is not sent; O-takeWhile, O-first use: p is not called again",
    END, `    if (ended) arrays.push([...out, ["COMPLETE"]]);\n    else if (out.length) arrays.push(out);\n    continue;`, ["takeWhile", "first"]],
  ["takeWhile puts its COMPLETE in an array it had already sent", "O-takeWhile use: or alone when that array holds nothing yet",
    END, `    if (ended) { if (out.length || !arrays.length) arrays.push([...out, ["COMPLETE"]]); else arrays[arrays.length - 1].push(["COMPLETE"]); break; }`],
  ["take and takeWhile send a wave's arrays as one", "O-take use: completes in the array of the nth; O-takeWhile use: in the array takeWhile was sending then",
    SEND, `  if (arrays.length) ctx.down(arrays.flat());`, ["take", "takeWhile"]],
  ["take counts only DATA that differs from the one before", "O-take use: sends the first n DATA",
    SEEN, `    const before = ctx.state.get();\n    const seen = (before?.seen ?? 0) + (before && before.last === v ? 0 : 1);\n    ctx.state.set({ seen, last: v });`],
  ["take(0) takes a DATA its source holds", "O-take use: take(0) completes on activation, whatever its source holds",
    ZERO, `  return (ctx) => (n === 0 && !ctx.deps[0].waves.length ? ctx.down([["COMPLETE"]]) : counting(ctx));`],
  ["skip ignores its source's ERROR", "O-common: an input's ERROR ends the operator", SKIP_NODE, `{ terminal: { error: "manual" }, recipe: { ref: "operators.skip", config: { n } } }`],
  ["skip counts a source INVALIDATE as a DATA", "O-skip invalidation: only DATA is counted",
    [[SKIP_NODE, `{ invalidate: "manual", recipe: { ref: "operators.skip", config: { n } } }`],
      [SKIP_HEAD, `    let seen = ctx.state.get()?.seen ?? 0;\n    if (ctx.deps[0].invalidated) { seen = Math.min(n, seen + 1); ctx.down([["INVALIDATE"]]); }\n    for (const w of ctx.deps[0].waves) {`]]],
  ["last calls its predicate only when its source completes", "O-last use: p is called for every DATA last is given, as it comes",
    [[CAND, `  const all = [...(ctx.state.get()?.all ?? []), ...source.waves.flat()];\n  if (source.terminal?.[0] === "COMPLETE") for (const v of all) if (p(v)) candidate = [v];`], [`  ctx.state.set({ candidate });`, `  ctx.state.set({ candidate, all });`]]],
  ["last ignores DATA that comes in the wave of the COMPLETE", "O-last use: sends the last DATA", CAND, `  if (!source.terminal) for (const v of source.waves.flat()) if (p(v)) candidate = [v];`],
  ["last drops a candidate that is falsy", "O-last use: sends the last DATA", L_END, `  if (source.terminal?.[0] === "COMPLETE") ctx.down([...candidate.filter(Boolean).map((v) => ["DATA", v]), ["COMPLETE"]]);`],
  ["last keeps its candidate in a closure, not in private state", "O-common: progress is private state, which lasts for one activation and which a checkpoint saves",
    [[`const lastFn = (p) => (ctx) => {`, `const lastFn = (p) => { let memo = []; return (ctx) => {`], [L_HEAD, `  let candidate = memo;`],
      [`  ctx.state.set({ candidate });`, `  memo = candidate;\n  ctx.state.set({ candidate: [] });`], [`${L_END}\n};`, `${L_END}\n}; };`]]],
  ["a restored first without a predicate matches nothing", "R-checkpoint: a restored node is built from its recipe",
    `firstFn(predicateOf("first", config, at))`, `firstFn(config?.p === null ? () => false : predicateOf("first", config, at))`],
  // found by the whole-branch review (2026-11-21); OT-108 holds them
  ["a restored skip whose source changed starts counting again", "O-common: a checkpoint saves an operator's progress",
    `    let seen = ctx.state.get()?.seen ?? 0;`, `    let seen = ctx.seed !== undefined ? 0 : ctx.state.get()?.seen ?? 0;`],
  ["a restored last whose source changed forgets its candidate", "O-common: a checkpoint saves an operator's progress",
    L_HEAD, `  let candidate = ctx.seed !== undefined ? [] : ctx.state.get()?.candidate ?? [];`],
  // the review of 2026-11-21: a restored operator whose input changed while saved, activation on an input that has ended, two terminals in one wave
  ["a restored take whose source changed while saved starts counting again", "O-common: a checkpoint saves an operator's progress",
    [["    const seen = (ctx.state.get()?.seen ?? 0) + 1;", "    const seen = (ctx.seed !== undefined ? 0 : ctx.state.get()?.seen ?? 0) + 1;"]]],
  ["a restored takeWhile whose source changed while saved does not read the new value", "O-takeWhile use: completes at the first DATA for which p does not hold; R-checkpoint: a restored node is given a changed dependency as changed",
    [["const takeWhileFn = (p) => ending((ctx, v, out) => {\n  if (!p(v)) return true;", "const takeWhileFn = (p) => ending((ctx, v, out) => {\n  if (ctx.seed !== undefined) return false;\n  if (!p(v)) return true;"]]],
  ["a restored first whose source changed while saved does not read the new value", "O-first use: sends the first for which p holds; R-checkpoint: a restored node is given a changed dependency as changed",
    [["const firstFn = (p) => ending((ctx, v, out) => {\n  if (!p(v)) return false;", "const firstFn = (p) => ending((ctx, v, out) => {\n  if (ctx.seed !== undefined || !p(v)) return false;"]]],
  ["a restored last ignores a source value that changed while saved", "O-last use: p is called for every DATA last is given; R-checkpoint: a restored node is given a changed dependency as changed",
    [["  for (const v of source.waves.flat()) if (p(v)) candidate = [v];", "  for (const v of (ctx.seed !== undefined ? [] : source.waves.flat())) if (p(v)) candidate = [v];"]]],
  ["last activated on a source that has completed sends nothing", "O-last use: sends the last DATA with COMPLETE in one array when its source completes normally; O-common: at activation an operator runs on its inputs' snapshots",
    [["  let candidate = ctx.state.get()?.candidate ?? [];", "  const fresh = ctx.state.get() === undefined;\n  let candidate = ctx.state.get()?.candidate ?? [];"], ["  if (source.terminal?.[0] === \"COMPLETE\") ctx.down([...candidate.map(", "  if (!fresh && source.terminal?.[0] === \"COMPLETE\") ctx.down([...candidate.map("]]],
];

mutantSuite({ module: "select", operators: ["take", "skip", "takeWhile", "first", "last"], mutants: MUTANTS, minTraces: 9 });
