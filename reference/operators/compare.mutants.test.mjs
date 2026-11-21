// Mutants of compare.mjs against the canonical traces; mutants.mjs says what a mutant must do.

import { mutantSuite } from "./mutants.mjs";

const SAME = `      if (last.length && equal(last[0], v)) continue;`;
const CLEAR = `    last = [];\n    ctx.down([["INVALIDATE"]]);`;
const D_LOOP = `  for (const w of source.waves) {\n    const kept = [];`;
const D_SEND = `    if (kept.length) ctx.down(kept.map((v) => ["DATA", v]));`;
const D_NODE = `{ invalidate: "manual", ...(carried && { recipe: { ref: "operators.distinctUntilChanged", config: carried } }) }`;
const PAIR = `      if (prev.length) pairs.push([prev[0], v]);\n      prev = [v];`;
const P_SEND = `    if (pairs.length) ctx.down(pairs.map((pair) => ["DATA", pair]));`;
const P_NODE = `return g.node(id, [sourceId], pairwiseFn, { recipe: { ref: "operators.pairwise", config: null } });`;
const P_HEAD = `function pairwiseFn(ctx) {\n  let prev = ctx.state.get()?.prev ?? [];`;
const P_SET = `  ctx.state.set({ prev });\n}`;

const MUTANTS = [
  // distinctUntilChanged
  ["distinctUntilChanged sends every DATA", "O-distinctUntilChanged use: only when it differs from the last DATA it sent", SAME, ``],
  ["distinctUntilChanged does not let the first DATA pass", "O-distinctUntilChanged use: the first DATA passes",
    SAME, `      if (!last.length) { last = [v]; continue; }\n      if (equal(last[0], v)) continue;`],
  ["distinctUntilChanged gives its equality the candidate first", "O-distinctUntilChanged use: equal(last sent, candidate)",
    SAME, `      if (last.length && equal(v, last[0])) continue;`],
  ["distinctUntilChanged compares against the last DATA it read, sent or not", "O-distinctUntilChanged use: differs from the last DATA it sent",
    SAME, `      if (last.length && equal(last[0], v)) { last = [v]; continue; }`],
  ["distinctUntilChanged merges the arrays of a wave into one", "O-distinctUntilChanged use: each in the array it came in",
    D_LOOP, `  for (const w of [source.waves.flat()]) {\n    const kept = [];`],
  ["distinctUntilChanged sends each DATA as an array of its own", "O-distinctUntilChanged use: each in the array it came in",
    D_SEND, `    for (const v of kept) ctx.down([["DATA", v]]);`],
  ["distinctUntilChanged keeps what it compares against at a source INVALIDATE", "O-distinctUntilChanged invalidation: clears what is compared against",
    CLEAR, `    ctx.down([["INVALIDATE"]]);`],
  ["distinctUntilChanged does not retract at a source INVALIDATE", "O-distinctUntilChanged invalidation: retracts the output", CLEAR, `    last = [];`],
  ["distinctUntilChanged has the default INVALIDATE policy", "O-distinctUntilChanged invalidation: clears what is compared against",
    D_NODE, `{ ...(carried && { recipe: { ref: "operators.distinctUntilChanged", config: carried } }) }`],
  ["distinctUntilChanged keeps what it compares against only for the run", "O-distinctUntilChanged use: the last DATA it sent",
    `  ctx.state.set({ last });`, `  ctx.state.set({ last: [] });`],
  ["a restored distinctUntilChanged loses its equality", "R-checkpoint: a restored node is built from its recipe",
    `return distinctFn(config.equal === null ? Object.is : callbackOf(at, config.equal));`, `return distinctFn(Object.is);`],
  // pairwise
  ["pairwise sends [current, previous]", "O-pairwise use: sends [previous, current]", PAIR, `      if (prev.length) pairs.push([v, prev[0]]);\n      prev = [v];`],
  ["pairwise pairs the first DATA with itself", "O-pairwise use: from the second on", PAIR, `      pairs.push([prev[0] ?? v, v]);\n      prev = [v];`],
  ["pairwise makes pairs that do not overlap", "O-pairwise use: for every DATA from the second on", PAIR, `      if (prev.length) pairs.push([prev[0], v]);\n      prev = prev.length ? [] : [v];`],
  ["pairwise pairs only within an array", "O-pairwise use: a pair may span two arrays or two waves",
    `  for (const w of ctx.deps[0].waves) {\n    const pairs = [];`, `  for (const w of ctx.deps[0].waves) {\n    prev = [];\n    const pairs = [];`],
  ["pairwise sends each pair as an array of its own", "O-pairwise use: goes out in the array of its second value", P_SEND, `    for (const pair of pairs) ctx.down([["DATA", pair]]);`],
  ["pairwise merges the arrays of a wave into one", "O-pairwise use: goes out in the array of its second value",
    `  for (const w of ctx.deps[0].waves) {\n    const pairs = [];`, `  for (const w of [ctx.deps[0].waves.flat()]) {\n    const pairs = [];`],
  ["pairwise forgets its previous value at a source INVALIDATE", "O-pairwise invalidation: keeps the previous value",
    [[P_NODE, `return g.node(id, [sourceId], pairwiseFn, { invalidate: "manual", recipe: { ref: "operators.pairwise", config: null } });`],
      [P_HEAD, `${P_HEAD}\n  if (ctx.deps[0].invalidated) { prev = []; ctx.down([["INVALIDATE"]]); }`]]],
  ["pairwise keeps its output at a source INVALIDATE", "O-pairwise invalidation: retracts the output",
    P_NODE, `return g.node(id, [sourceId], pairwiseFn, { invalidate: "manual", recipe: { ref: "operators.pairwise", config: null } });`],
  ["pairwise keeps its previous value only for the run", "O-pairwise use: a pair may span two waves", P_SET, `  ctx.state.set({ prev: [] });\n}`],
  ["pairwise keeps its previous value across activations, outside private state", "O-pairwise use: the first DATA an activation reads only becomes the previous one",
    [[P_HEAD, `let kept = [];\nfunction pairwiseFn(ctx) {\n  let prev = ctx.state.get()?.prev ?? kept;`], [P_SET, `  ctx.state.set({ prev });\n  kept = prev;\n}`]]],
  // found by the third review: inputs no trace had carried
  ["distinctUntilChanged treats a falsy last value as none", "O-distinctUntilChanged use: differs from the last DATA it sent", SAME, `      if (last[0] && equal(last[0], v)) continue;`],
  ["distinctUntilChanged asks its equality about the first DATA", "O-distinctUntilChanged use: the first DATA passes", SAME, `      if (equal(last[0], v)) continue;`],
  ["distinctUntilChanged ignores its source's ERROR", "O-common: an input's ERROR ends the operator",
    D_NODE, `{ invalidate: "manual", terminal: { error: "manual" }, ...(carried && { recipe: { ref: "operators.distinctUntilChanged", config: carried } }) }`],
  ["distinctUntilChanged never completes", "O-common: it completes once every input has ended",
    D_NODE, `{ invalidate: "manual", terminal: { complete: "manual" }, ...(carried && { recipe: { ref: "operators.distinctUntilChanged", config: carried } }) }`],
  ["distinctUntilChanged swallows a throw from its equality", "O-common: a throw from a callback is the operator's ERROR",
    SAME, `      if (last.length) { let same = false; try { same = equal(last[0], v); } catch { same = false; } if (same) continue; }`],
  ["distinctUntilChanged keeps what it compares against across activations, outside private state", "O-common: an operator that deactivates without having ended forgets it",
    [[`const distinctFn = (equal) => (ctx) => {\n  const [source] = ctx.deps;\n  let last = ctx.state.get()?.last ?? [];`, `let memo = [];\nconst distinctFn = (equal) => (ctx) => {\n  const [source] = ctx.deps;\n  let last = ctx.state.get()?.last ?? memo;`],
      [`  ctx.state.set({ last });`, `  ctx.state.set({ last });\n  memo = last;`]]],
  ["a restored distinctUntilChanged clears what it compares against when its source holds no value", "O-distinctUntilChanged recovery: keeps what it compares against together with its output",
    `  if (source.invalidated) {\n    last = [];`, `  if (ctx.seed !== undefined && !source.has) last = [];\n  if (source.invalidated) {\n    last = [];`],
  ["pairwise treats a falsy previous value as none", "O-pairwise use: for every DATA from the second on", PAIR, `      if (prev[0]) pairs.push([prev[0], v]);\n      prev = [v];`],
  ["pairwise flattens a value that is a list into its pair", "O-pairwise use: sends [previous, current]", PAIR, `      if (prev.length) pairs.push([].concat(prev[0], v));\n      prev = [v];`],
  ["pairwise ignores its source's ERROR", "O-common: an input's ERROR ends the operator", P_NODE, `return g.node(id, [sourceId], pairwiseFn, { terminal: { error: "manual" }, recipe: { ref: "operators.pairwise", config: null } });`],
  ["a restored pairwise forgets its previous value", "O-pairwise use: a restored one, whose previous value is saved", P_HEAD, `function pairwiseFn(ctx) {\n  let prev = ctx.seed !== undefined ? [] : ctx.state.get()?.prev ?? [];`],
  // found by the whole-branch review (2026-11-21); OT-109 holds them
  ["distinctUntilChanged does not ask its equality about identical values", "O-distinctUntilChanged use: two values are the same when equal(last sent, candidate) holds",
    SAME, `      if (last.length && (last[0] === v || equal(last[0], v))) continue;`],
  ["pairwise takes only the last value of the snapshot it activates on", "O-pairwise use: [previous, current] for every DATA from the second on",
    `function pairwiseFn(ctx) {\n`, `function pairwiseFn(ctx) {\n  if (ctx.state.get() === undefined) { ctx.state.set({ prev: ctx.deps[0].waves.flat().slice(-1) }); return; }\n`],
];

mutantSuite({ module: "compare", operators: ["distinctUntilChanged", "pairwise"], mutants: MUTANTS, minTraces: 6 });
