// The situations every operator meets, each against every active operator of the set: a table
// of generated mutants where the *.mutants.test.mjs files beside this one hold hand-written ones.
// Three reviews in a row found the same situations untraced for one operator after another, each
// fixed for the operators a review happened to name; this file asks for them by class.
//
//   restored      a restored operator ignores what changed while the graph was saved (O-common: a
//                 checkpoint saves progress; R-checkpoint: a changed dependency is given as changed)
//   completed     an operator activated on an input that has completed does not run on what its
//                 inputs hold (O-common: at activation it runs on its inputs' snapshots)
//   errored       an operator activated on an input that has ended with ERROR stays open (O-common:
//                 an input's ERROR ends the operator; O-sample, O-takeUntil, O-buffer use)
//   complete+error  an operator with several inputs completes when one input's COMPLETE and
//                 another's ERROR share a run (O-common: also when another input completes in that wave)
//   two errors    it sends the later-declared input's ERROR when two inputs end with ERROR in one
//                 run (O-common: where a contract says nothing, inputs are taken in declared order)
//
// Each mutant is the operator's function with a few lines put before its body. A canonical trace
// must then give something else at a sink of a node of that operator. The last two classes do
// not apply to race, which selects by declared order whatever the terminal, nor to concat, which
// depends on one source at a time; their own sentences have their own mutants.
//
// An operator built with the default ERROR policy is never run for an input's ERROR, so its
// mutants give it the manual policy and send the first ERROR in declared order themselves, as
// the default does (reference/kernel/kernel.mjs, K5). `control` is that change alone: no trace
// may notice it, or a mutant built on it would be noticed for the policy and not for its class.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { contracts, differing, passes, traces, unrunnable } from "./run-trace.mjs";

const manual = (from, to) => [from, to]; // the node's options, with the manual ERROR policy
const OPERATORS = [
  { module: "transform", ops: ["map"], head: "const mapFn = (f) => (ctx) => {\n", auto: manual(`withRecipe("operators.map", "f", recipe));`, `{ terminal: { error: "manual" }, ...withRecipe("operators.map", "f", recipe) });`) },
  { module: "transform", ops: ["filter"], head: "const filterFn = (p) => (ctx) => {\n", auto: manual(`withRecipe("operators.filter", "p", recipe));`, `{ terminal: { error: "manual" }, ...withRecipe("operators.filter", "p", recipe) });`) },
  { module: "transform", ops: ["tap"], head: "const tapFn = (f) => (ctx) => {\n", auto: manual(`withRecipe("operators.tap", "f", recipe));`, `{ terminal: { error: "manual" }, ...withRecipe("operators.tap", "f", recipe) });`) },
  { module: "accumulate", ops: ["scan"], head: "const scanFn = (f, seed) => (ctx) => {\n", auto: manual(`withRecipe("operators.scan", recipe, seed));`, `{ terminal: { error: "manual" }, ...withRecipe("operators.scan", recipe, seed) });`) },
  { module: "accumulate", ops: ["reduce"], head: "const reduceFn = (f, seed) => (ctx) => {\n", auto: manual(`{ terminal: { complete: "manual" }, ...withRecipe("operators.reduce", recipe, seed) }`, `{ terminal: { complete: "manual", error: "manual" }, ...withRecipe("operators.reduce", recipe, seed) }`) },
  { module: "compare", ops: ["distinctUntilChanged"], head: "const distinctFn = (equal) => (ctx) => {\n", auto: manual(`{ invalidate: "manual", ...(carried && {`, `{ invalidate: "manual", terminal: { error: "manual" }, ...(carried && {`) },
  { module: "compare", ops: ["pairwise"], head: "function pairwiseFn(ctx) {\n", auto: manual(`pairwiseFn, { recipe: {`, `pairwiseFn, { terminal: { error: "manual" }, recipe: {`) },
  { module: "select", ops: ["take", "takeWhile", "first"], head: "const ending = (visit) => (ctx) => {\n" },
  { module: "select", ops: ["skip"], head: `  count("skip", n);\n  return (ctx) => {\n`, auto: manual(`skipFn({ n }), { recipe: {`, `skipFn({ n }), { terminal: { error: "manual" }, recipe: {`) },
  { module: "select", ops: ["last"], head: "const lastFn = (p) => (ctx) => {\n", auto: manual(`lastFn(p ?? any), { terminal: { complete: "manual" }, ...carried });`, `lastFn(p ?? any), { terminal: { complete: "manual", error: "manual" }, ...carried });`) },
  { module: "notifier", ops: ["sample"], head: "function sampleFn(ctx) {\n", inputs: 2 },
  { module: "notifier", ops: ["takeUntil"], head: "function takeUntilFn(ctx) {\n", inputs: 2 },
  { module: "notifier", ops: ["buffer"], head: "function bufferFn(ctx) {\n", inputs: 2 },
  { module: "notifier", ops: ["bufferCount"], head: "  return (ctx) => {\n    const [source] = ctx.deps;\n", auto: manual(`bufferCountFn({ n }), { terminal: { complete: "manual" }, recipe:`, `bufferCountFn({ n }), { terminal: { complete: "manual", error: "manual" }, recipe:`) },
  { module: "combine", ops: ["merge"], head: "function mergeFn(ctx) {\n", inputs: 2, auto: manual(`mergeFn, recipe("merge"));`, `mergeFn, { terminal: { error: "manual" }, ...recipe("merge") });`) },
  { module: "combine", ops: ["withLatestFrom"], head: "function withLatestFromFn(ctx) {\n", inputs: 2, auto: manual(`{ terminal: { complete: "manual" }, ...recipe("withLatestFrom") }`, `{ terminal: { complete: "manual", error: "manual" }, ...recipe("withLatestFrom") }`) },
  { module: "combine", ops: ["zip"], head: "function zipFn(ctx) {\n", inputs: 2 },
  { module: "combine", ops: ["concat"], head: "  return (ctx) => {\n    const [current] = ctx.deps;\n", auto: manual(`{ terminal: { complete: "manual" }, ...recipe("concat", { sources }) }`, `{ terminal: { complete: "manual", error: "manual" }, ...recipe("concat", { sources }) }`) },
  { module: "combine", ops: ["race"], head: "function raceFn(ctx) {\n" },
  { module: "state", ops: ["derived"], head: "const derivedFn = (f) => (ctx) => {\n", inputs: 2, auto: manual(`recipe !== undefined ? { recipe: { ref: "operators.derived", config: { f: recipe } } } : {});`, `{ terminal: { error: "manual" }, ...(recipe !== undefined ? { recipe: { ref: "operators.derived", config: { f: recipe } } } : {}) });`) },
];

// The lines put before a function's body. A lifetime has one signal, so the first run of a
// lifetime is the one that finds its signal unseen.
const FIRST = "  const firstRun = !(globalThis.__operatorLifetimes ??= new WeakSet()).has(ctx.signal);\n  globalThis.__operatorLifetimes.add(ctx.signal);\n";
const ERRORS = `  const failed = ctx.deps.filter((d) => d.terminal?.[0] === "ERROR");\n`;
const AS_DEFAULT = "  if (failed.length) { ctx.down([failed[0].terminal]); return; }\n";
const CLASSES = {
  restored: { says: "ignores what changed while the graph was saved", lines: "  if (ctx.seed !== undefined) return;\n" },
  completed: { says: "activated on an input that has completed does not run on what its inputs hold", lines: `${FIRST}  if (firstRun && ctx.deps.some((d) => d.terminal?.[0] === "COMPLETE")) return;\n` },
  errored: { says: "activated on an input that has ended with ERROR stays open", lines: `${FIRST}${ERRORS}  if (firstRun && failed.length) return;\n`, policy: true },
  "complete+error": { says: "completes when one input's COMPLETE and another's ERROR share a run", lines: `${ERRORS}  if (failed.length && ctx.deps.some((d) => d.terminal?.[0] === "COMPLETE")) { ctx.down([["COMPLETE"]]); return; }\n`, policy: true, several: true },
  "two errors": { says: "sends the later-declared input's ERROR when two inputs end with ERROR in one run", lines: `${ERRORS}  if (failed.length > 1) { ctx.down([failed[failed.length - 1].terminal]); return; }\n`, policy: true, several: true },
};

const dir = mkdtempSync(join(tmpdir(), "classes-mutants-"));
test.after(() => rmSync(dir, { recursive: true, force: true }));
const sources = new Map();
const source = (module) => sources.get(module) ?? sources.set(module, readFileSync(fileURLToPath(new URL(`./${module}.mjs`, import.meta.url)), "utf8")).get(module);
let made = 0;
async function load(module, edits) {
  let edited = source(module);
  for (const [from, to] of edits) {
    assert.equal(source(module).split(from).length - 1, 1, `the text to edit occurs exactly once in ${module}.mjs: ${from}`);
    edited = edited.replace(from, () => to);
  }
  const file = join(dir, `${module}-${made++}.mjs`);
  writeFileSync(file, edited);
  return import(pathToFileURL(file).href);
}
const usable = Promise.all(traces.filter((trace) => !unrunnable(trace)).map(async (trace) => ((await passes(trace)) ? trace : null))).then((found) => found.filter(Boolean));
// The traces that give something else, each with the nodes of `ops` it gives it at.
async function noticed(module, mutant, ops) {
  const found = new Map();
  for (const trace of await usable) {
    if (!trace.nodes.some((n) => ops.includes(n.op))) continue;
    let nodes;
    try { nodes = await differing(trace, { [module]: mutant }); } catch { continue; } // a runner throw is not a sink that received something else
    const own = trace.nodes.filter((n) => ops.includes(n.op) && (nodes.has(n.id) || nodes.has(n.args?.into)));
    if (own.length) found.set(trace.id, own);
  }
  return found;
}

test("the table holds every operator with an active contract", () => {
  const active = contracts.filter((row) => !row.transition && row.activated_by?.length && row.operator).map((row) => row.operator).sort();
  assert.deepEqual(OPERATORS.flatMap((entry) => entry.ops).sort(), active);
});

for (const entry of OPERATORS.filter((item) => item.auto)) {
  test(`control: ${entry.ops.join(", ")} with the manual ERROR policy and the default's ERROR sent by hand gives what every trace expects`, async () => {
    const mutant = await load(entry.module, [entry.auto, [entry.head, `${entry.head}${ERRORS}${AS_DEFAULT}`]]);
    assert.deepEqual([...(await noticed(entry.module, mutant, entry.ops)).keys()], []);
  });
}

for (const [name, kind] of Object.entries(CLASSES)) {
  for (const entry of OPERATORS) {
    if (kind.several && !entry.inputs) continue;
    test(`${name}: ${entry.ops.join(", ")} ${kind.says}`, async () => {
      const body = `${entry.head}${kind.lines}${kind.policy && entry.auto ? AS_DEFAULT : ""}`;
      const mutant = await load(entry.module, [...(kind.policy && entry.auto ? [entry.auto] : []), [entry.head, body]]);
      const found = await noticed(entry.module, mutant, entry.ops);
      for (const operator of entry.ops) {
        const at = [...found].filter(([, nodes]) => nodes.some((n) => n.op === operator)).map(([id]) => id);
        assert.ok(at.length > 0, `no canonical trace notices this at a sink of a ${operator}`);
      }
    });
  }
}
