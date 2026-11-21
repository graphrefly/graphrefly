// Mutants of state.mjs against the canonical traces; mutants.mjs says what a mutant must do.

import { mutantSuite } from "./mutants.mjs";

const HAS = `  if (!ctx.deps.every((d) => d.has)) return;\n`;
const FRESH = `  if (!ctx.deps.some((d) => d.waves.some((w) => w.length))) return;\n`;
const SEND = `  ctx.down([["DATA", f(...ctx.deps.map((d) => d.value))]]);`;
const NODE = `recipe !== undefined ? { recipe: { ref: "operators.derived", config: { f: recipe } } } : {});`;
const policy = (text) => `{ ${text}, ...(recipe !== undefined ? { recipe: { ref: "operators.derived", config: { f: recipe } } } : {}) });`;

const MUTANTS = [
  ["derived computes before every dependency has a value", "O-derived use: it runs once every dependency has a value", HAS, ``],
  ["derived sends again in a run that brought no DATA", "O-derived use: one result per run in which a dependency delivered DATA", FRESH, ``],
  ["derived sends one result for every DATA of a wave", "O-derived use: it reads values, not occurrences",
    SEND, `  ctx.down(ctx.deps.flatMap((d, i) => d.waves.flat().map((v) => ["DATA", f(...ctx.deps.map((x, j) => (j === i ? v : x.value)))])));`],
  ["derived gives f the values in reverse", "O-derived use: computes f from the latest value of every dependency", SEND, `  ctx.down([["DATA", f(...ctx.deps.map((d) => d.value).reverse())]]);`],
  ["derived sends the values and not f's result", "O-derived use: computes f … and sends the result", SEND, `  ctx.down([["DATA", ctx.deps[0].value]]);`],
  ["derived keeps its output at a dependency's INVALIDATE", "O-derived invalidation: retracts the output", NODE, policy(`invalidate: "manual"`)],
  ["derived never completes", "O-common: it completes once every input has ended", NODE, policy(`terminal: { complete: "manual" }`)],
  ["derived ignores a dependency's ERROR", "O-common: an input's ERROR ends the operator", NODE, policy(`terminal: { error: "manual" }`)],
  ["derived swallows a throw from f", "O-common: a throw from a callback is the operator's ERROR",
    SEND, `  let result; try { result = f(...ctx.deps.map((d) => d.value)); } catch { return; }\n  ctx.down([["DATA", result]]);`],
  ["a restored derived gets another function", "R-checkpoint: a restored node is built from its recipe", `derivedFn(callbackOf(at, config?.f))`, `derivedFn(() => 0)`],
  // found by the fourth review
  ["derived takes a dependency that holds a falsy value for one without a value", "O-derived use: it runs once every dependency has a value", HAS, `  if (!ctx.deps.every((d) => d.value)) return;\n`],
  ["derived sends nothing for a result that is not a value", "O-common: a callback's result that the operator must send and that is not a value is its ERROR",
    SEND, `  const result = f(...ctx.deps.map((d) => d.value));\n  if (result !== undefined) ctx.down([["DATA", result]]);`],
  ["derived drops a result that is falsy", "O-derived use: computes f … and sends the result", SEND, `  const result = f(...ctx.deps.map((d) => d.value));\n  if (result) ctx.down([["DATA", result]]);`],
  ["derived skips a result equal to its last", "O-derived use: one result per run in which a dependency delivered DATA",
    SEND, `  const result = f(...ctx.deps.map((d) => d.value));\n  if (JSON.stringify(result) === ctx.state.get()) return;\n  ctx.state.set(JSON.stringify(result));\n  ctx.down([["DATA", result]]);`],
  ["derived flattens a value that is a list into f's arguments", "O-derived use: computes f from the latest value of every dependency", SEND, `  ctx.down([["DATA", f(...[].concat(...ctx.deps.map((d) => d.value)))]]);`],
  ["derived gives f its first two dependencies", "O-derived use: the latest value of every dependency", SEND, `  ctx.down([["DATA", f(...ctx.deps.slice(0, 2).map((d) => d.value))]]);`],
  ["derived ignores its first dependency's ERROR", "O-common: an input's ERROR ends the operator",
    [[NODE, policy(`terminal: { error: "manual" }`)], [SEND, `  const failed = ctx.deps.slice(1).find((d) => d.terminal?.[0] === "ERROR");\n  if (failed) { ctx.down([failed.terminal]); return; }\n${SEND}`]]],
  // found by the whole-branch review (2026-11-21); OT-110 holds them
  ["derived does not compute in a wave in which a dependency ends", "O-derived use: a dependency that has ended keeps its value", HAS, `${HAS}  if (ctx.deps.some((d) => d.terminal)) return;\n`],
  ["derived does not compute again at a later activation", "O-common: at its next activation an operator runs on its inputs' snapshots as at its first",
    `const derivedFn = (f) => (ctx) => {\n${HAS}`, `let ran = new Set();\nconst derivedFn = (f) => (ctx) => {\n${HAS}  const fresh = ctx.state.get() === undefined;\n  ctx.state.set(true);\n  if (fresh && ran.has(f)) return;\n  ran.add(f);\n`],
  ["derived stops computing once it has seen a dependency end", "O-derived use: a dependency that has ended keeps its value",
    `const derivedFn = (f) => (ctx) => {\n`, `const derivedFn = (f) => (ctx) => {\n  const over = ctx.state.get()?.over ?? false;\n  ctx.state.set({ over: over || ctx.deps.some((d) => d.terminal) });\n  if (over) return;\n`],
];

mutantSuite({ module: "state", operators: ["derived"], mutants: MUTANTS, minTraces: 7 });
