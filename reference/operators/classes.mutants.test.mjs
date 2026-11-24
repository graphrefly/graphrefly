// The situations every operator meets, each against every active operator of the set: a table
// of generated mutants where the *.mutants.test.mjs files beside this one hold hand-written ones.
// Three reviews in a row found the same situations untraced for one operator after another, each
// fixed for the operators a review happened to name; this file asks for them by class.
//
//   restored             a restored operator ignores what changed while the graph was saved
//   restored, completed  it ignores a change that came with an input's COMPLETE while saved
//   restored, errored    it stays as it was when an input ended with ERROR while saved
//                        (O-common: a checkpoint saves progress; R-checkpoint: a changed dependency
//                        is given as changed, an end as an end)
//   completed            an operator activated on an input that has completed does not run on what
//                        its inputs hold (O-common: at activation it runs on its inputs' snapshots)
//   errored              activated on an input that has ended with ERROR, it does not end with that
//                        ERROR (O-common: an input's ERROR ends the operator; O-sample, O-takeUntil,
//                        O-buffer use)
//   several values       activated on an input that holds several values, it reads only the last
//   complete, then error an operator with several inputs completes when an earlier-declared input's
//   error, then complete COMPLETE and a later one's ERROR share a run, or the other way round
//                        (O-common: also when another input completes in that wave)
//   two errors           it sends the later-declared input's ERROR when two inputs end with ERROR
//   two errors at activation   in one run, or had both ended with one before it activated (O-common:
//                        where a contract says nothing, inputs are taken in declared order)
//
// A cell that passes shows that the situation is traced for that operator, with one way of getting
// it wrong. It does not show that every sentence that applies in the situation is held: the
// hand-written mutants are for that, and a review of 2026-11-21 still found 61 of 89 new ones
// unnoticed after the first five classes were in place.
//
// Each mutant is the operator's function with a few lines put before its body. A canonical trace
// must then give something else at a sink of a node of that operator. The classes on two terminals
// apply to the operators with several inputs: not to race, which selects by declared order whatever
// the terminal, nor to concat, which depends on one source at a time; their own sentences have
// their own mutants; nor to the higher-order operators, whose inners are attached after the
// activation. `several values` leaves out sample, derived, switchMap, debounce and
// auditTime, which read an input's latest value and so do the same with or without the earlier
// ones.
//
// An operator built with the default ERROR policy is never run for an input's ERROR, so its
// mutants give it the manual policy and send the first ERROR in declared order themselves, as
// the default does (reference/kernel/kernel.mjs, K5). `control` is that change alone: no trace
// may notice it at any node, nor may the runner fail on one, or a mutant built on it would be
// noticed for the policy and not for its class.

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
  { module: "notifier", ops: ["sample"], head: "function sampleFn(ctx) {\n", inputs: 2, latest: true },
  { module: "notifier", ops: ["takeUntil"], head: "function takeUntilFn(ctx) {\n", inputs: 2 },
  { module: "notifier", ops: ["buffer"], head: "function bufferFn(ctx) {\n", inputs: 2 },
  { module: "notifier", ops: ["bufferCount"], head: `  if (!positiveInteger(n)) throw new RangeError("bufferCount: n must be a positive integer");\n  return (ctx) => {\n`, auto: manual(`bufferCountFn({ n }), { terminal: { complete: "manual" }, recipe:`, `bufferCountFn({ n }), { terminal: { complete: "manual", error: "manual" }, recipe:`) },
  { module: "combine", ops: ["merge"], head: "function mergeFn(ctx) {\n", inputs: 2, auto: manual(`mergeFn, recipe("merge"));`, `mergeFn, { terminal: { error: "manual" }, ...recipe("merge") });`) },
  { module: "combine", ops: ["withLatestFrom"], head: "function withLatestFromFn(ctx) {\n", inputs: 2, auto: manual(`{ terminal: { complete: "manual" }, ...recipe("withLatestFrom") }`, `{ terminal: { complete: "manual", error: "manual" }, ...recipe("withLatestFrom") }`) },
  { module: "combine", ops: ["zip"], head: "function zipFn(ctx) {\n", inputs: 2 },
  { module: "combine", ops: ["concat"], head: "  const sources = [...config.sources]; // its own copy: the recipe's list is the definition's to keep\n  return (ctx) => {\n", auto: manual(`{ terminal: { complete: "manual" }, ...recipe("concat", { sources }) }`, `{ terminal: { complete: "manual", error: "manual" }, ...recipe("concat", { sources }) }`) },
  { module: "combine", ops: ["race"], head: "function raceFn(ctx) {\n" },
  { module: "state", ops: ["derived"], head: "const derivedFn = (f) => (ctx) => {\n", inputs: 2, latest: true, auto: manual(`recipe !== undefined ? { recipe: { ref: "operators.derived", config: { f: recipe } } } : {});`, `{ terminal: { error: "manual" }, ...(recipe !== undefined ? { recipe: { ref: "operators.derived", config: { f: recipe } } } : {}) });`) },
  { module: "gate", ops: ["valve"], head: "function valveFn(ctx) {\n", inputs: 2 },
  { module: "gate", ops: ["pause"], head: "export function pausableFn(ctx) {\n", inputs: 2 },
  { module: "higher-order", ops: ["switchMap"], head: "  return (ctx) => {\n", latest: true },
  { module: "higher-order", ops: ["mergeMap", "concatMap", "exhaustMap"], head: "  return (ctx) => {\n" },
  { module: "time", ops: ["debounce"], head: "      ctx.down(data(candidate));\n    });\n  };\n  const fn = (ctx) => {\n", latest: true },
  { module: "time", ops: ["throttle"], head: `  checked("throttle", ms);\n  const fn = (ctx) => {\n` },
  { module: "time", ops: ["auditTime"], head: "    ctx.down(data(candidate));\n  });\n  const fn = (ctx) => {\n", latest: true },
  { module: "time", ops: ["delay"], head: `    if (item.complete) ctx.down([["COMPLETE"]]);\n  });\n  const fn = (ctx) => {\n` },
  { module: "time", ops: ["bufferTime"], head: `  checked("bufferTime", ms);\n  const fn = (ctx) => {\n` },
  { module: "time", ops: ["timeout"], head: `    start(ctx, timers, ms, () => ctx.down([["ERROR", "timeout"]]));\n  };\n  const fn = (ctx) => {\n` },
];

// The lines put before a function's body: a head ends where the body starts, before the function
// reads ctx.deps, so that a class which gives the run other inputs is not a mutant of nothing. A
// lifetime has one signal, so the first run of a
// lifetime is the one that finds its signal unseen.
const FIRST = "  const firstRun = !(globalThis.__operatorLifetimes ??= new WeakSet()).has(ctx.signal);\n  globalThis.__operatorLifetimes.add(ctx.signal);\n";
const ERRORS = `  const failed = ctx.deps.filter((d) => d.terminal?.[0] === "ERROR");\n`;
const AS_DEFAULT = "  if (failed.length) { ctx.down([failed[0].terminal]); return; }\n";
const COMPLETED = `(d) => d.terminal?.[0] === "COMPLETE"`;
const ERRORED = `(d) => d.terminal?.[0] === "ERROR"`;
// the run sees only the last value of each input
const LAST_ONLY = "ctx = Object.create(ctx, { deps: { value: ctx.deps.map((d) => ({ id: d.id, waves: d.waves.map((w) => w.slice(-1)), terminal: d.terminal, invalidated: d.invalidated, has: d.has, value: d.value })) } });";
const CLASSES = {
  restored: { says: "ignores what changed while the graph was saved", lines: "  if (ctx.seed !== undefined) return;\n" },
  "restored, completed": { says: "ignores a change that came with an input's COMPLETE while the graph was saved", lines: `  if (ctx.seed !== undefined && ctx.deps.some(${COMPLETED})) return;\n` },
  "restored, errored": { says: "stays as it was when an input ended with ERROR while the graph was saved", lines: `${ERRORS}  if (ctx.seed !== undefined && failed.length) return;\n`, policy: true },
  completed: { says: "activated on an input that has completed does not run on what its inputs hold", lines: `${FIRST}  if (firstRun && ctx.deps.some(${COMPLETED})) return;\n` },
  errored: { says: "activated on an input that has ended with ERROR does not end with that ERROR", lines: `${FIRST}${ERRORS}  if (firstRun && failed.length) return;\n`, policy: true },
  "several values": { says: "activated on an input that holds several values reads only the last", lines: `${FIRST}  if (firstRun) ${LAST_ONLY}\n`, occurrences: true },
  "complete, then error": { says: "completes when an earlier-declared input's COMPLETE and a later one's ERROR share a run", lines: `${ERRORS}  if (ctx.deps.some((d, i) => d.terminal?.[0] === "COMPLETE" && ctx.deps.slice(i + 1).some(${ERRORED}))) { ctx.down([["COMPLETE"]]); return; }\n`, policy: true, several: true },
  "error, then complete": { says: "completes when an earlier-declared input's ERROR and a later one's COMPLETE share a run", lines: `${ERRORS}  if (ctx.deps.some((d, i) => d.terminal?.[0] === "ERROR" && ctx.deps.slice(i + 1).some(${COMPLETED}))) { ctx.down([["COMPLETE"]]); return; }\n`, policy: true, several: true },
  "two errors": { says: "sends the later-declared input's ERROR when two inputs end with ERROR in one run", lines: `${ERRORS}  if (failed.length > 1) { ctx.down([failed[failed.length - 1].terminal]); return; }\n`, policy: true, several: true },
  "two errors at activation": { says: "activated on two inputs that have ended with ERROR sends the later-declared one's", lines: `${FIRST}${ERRORS}  if (firstRun && failed.length > 1) { ctx.down([failed[failed.length - 1].terminal]); return; }\n`, policy: true, several: true },
};
const applies = (kind, entry) => !(kind.several && !entry.inputs) && !(kind.occurrences && entry.latest);

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

test("the table holds every operator with an active contract, and no cell goes missing unseen", () => {
  const active = contracts.filter((row) => !row.transition && row.activated_by?.length && row.operator).map((row) => row.operator).sort();
  assert.deepEqual(OPERATORS.flatMap((entry) => entry.ops).sort(), active);
  // An entry that lost its `inputs` or gained a `latest` would drop cells without a failure, so
  // which operators the narrower classes apply to, and how many cells there are, is written here.
  assert.deepEqual(OPERATORS.filter((entry) => entry.inputs).flatMap((entry) => entry.ops), ["sample", "takeUntil", "buffer", "merge", "withLatestFrom", "zip", "derived", "valve", "pause"]);
  assert.deepEqual(OPERATORS.filter((entry) => entry.latest).flatMap((entry) => entry.ops), ["sample", "derived", "switchMap", "debounce", "auditTime"]);
  const cells = Object.values(CLASSES).flatMap((kind) => OPERATORS.filter((entry) => applies(kind, entry)));
  assert.equal(cells.length, 5 * 30 + 25 + 4 * 9);
});

for (const entry of OPERATORS.filter((item) => item.auto)) {
  test(`control: ${entry.ops.join(", ")} with the manual ERROR policy and the default's ERROR sent by hand gives what every trace expects`, async () => {
    const mutant = await load(entry.module, [entry.auto, [entry.head, `${entry.head}${ERRORS}${AS_DEFAULT}`]]);
    // The whole trace, at every node, and a trace the runner cannot finish counts against it:
    // `noticed` looks for a witness and so passes over both.
    const differs = [];
    for (const trace of await usable) {
      if (!trace.nodes.some((n) => entry.ops.includes(n.op))) continue;
      if ((await differing(trace, { [entry.module]: mutant })).size) differs.push(trace.id);
    }
    assert.deepEqual(differs, []);
  });
}

for (const [name, kind] of Object.entries(CLASSES)) {
  for (const entry of OPERATORS) {
    if (!applies(kind, entry)) continue;
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
