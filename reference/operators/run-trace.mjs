// Runs a canonical operator trace (operators/traces.jsonl, graphrefly:D813) on the reference
// kernel. Shared by traces.test.mjs, which runs every trace, and the *.mutants.test.mjs files,
// which run a family's traces on edited copies of its module (mutants.mjs). Non-normative.
//
// The runner refuses what it does not know (a callback name, a step, a sink that never
// subscribed) instead of running something else in its place, so a typo in a trace is an error.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { createGraph } from "../kernel/kernel.mjs";
import { higherOrderRecipes, mergeMap, relay, switchMap } from "../modules/higher-order.mjs";
import { capture, restore } from "../modules/checkpoint.mjs";
import * as notifier from "./notifier.mjs";
import * as transform from "./transform.mjs";
import * as accumulate from "./accumulate.mjs";
import * as compare from "./compare.mjs";
import * as select from "./select.mjs";
import * as combine from "./combine.mjs";
import * as state from "./state.mjs";

// The operator modules a trace is run on; a mutant test passes an edited copy of one.
const MODULES = { notifier, transform, accumulate, compare, select, combine, state };

const read = (name) => readFileSync(fileURLToPath(new URL(`../../operators/${name}`, import.meta.url)), "utf8")
  .split("\n").filter(Boolean).map((line) => JSON.parse(line));
export const traces = read("traces.jsonl");
export const contracts = read("contracts.jsonl");

// The callbacks a trace names (operators/README.md), built from a node's args:
// { f | p | equal, into?, invalidates?, returns?, throwsOn?, nothingOn? }. `into` writes the last value
// each call is given (for a reducer or an equality, the incoming value; for a derived, its last
// dependency's) to that state, so a sink of the state shows the calls; `invalidates` asks the
// graph to invalidate that state at each call, a request that waits for the wave to end;
// `returns` replaces what the callback returns; `throwsOn` makes it throw, before the call is
// recorded, and `nothingOn` makes it return no value, when it is given that value. The same args are the callback's recipe
// configuration, so a restore builds it again over the restored graph.
const named = {
  double: (v) => v * 2,
  even: (v) => v % 2 === 0,
  small: (v) => v < 3,
  atMost: (previous, current) => current <= previous, // an equality that tells its two arguments apart
  sum: (acc, v) => acc + v,
  append: (acc, v) => [...acc, v],
  tuple: (...vs) => vs,
  record: () => "not read",
  always: () => true, // an equality for which every two values are the same
};
// What each kind of node may hold in its args, beside the options every callback takes. A key
// that is not listed for the node's operator is an error, so a misspelt or misplaced option is
// not ignored; so is any key of a node but id, state, op, deps and args.
const CALLBACK = ["into", "invalidates", "returns", "throwsOn", "nothingOn"];
const ARGS = {
  map: ["f", ...CALLBACK], tap: ["f", ...CALLBACK], derived: ["f", ...CALLBACK], filter: ["p", ...CALLBACK], takeWhile: ["p", ...CALLBACK],
  first: ["p", ...CALLBACK], last: ["p", ...CALLBACK], distinctUntilChanged: ["equal", ...CALLBACK], scan: ["f", "seed", ...CALLBACK], reduce: ["f", "seed", ...CALLBACK],
  take: ["n"], skip: ["n"], bufferCount: ["n"], once: ["value"], switchMap: ["project"], mergeMap: ["project"],
};
const checkNode = (node) => {
  for (const key of Object.keys(node)) if (!["id", "state", "op", "deps", "args"].includes(key)) throw new Error(`the runner does not know the key ${key} of node ${node.id}`);
  if (node.state && node.args) throw new Error(`state ${node.id} takes no args`);
  const allowed = ARGS[node.op] ?? [];
  for (const key of Object.keys(node.args ?? {})) if (!allowed.includes(key)) throw new Error(`the runner does not know the option ${key} of ${node.op} ${node.id}`);
};
function callback(args, g) {
  const name = args.f ?? args.p ?? args.equal;
  if (!Object.hasOwn(named, name)) throw new Error(`the runner has no callback named ${name}`);
  const base = named[name];
  return (...given) => {
    const value = given[given.length - 1];
    if ("throwsOn" in args && isDeepStrictEqual(value, args.throwsOn)) throw new Error("boom");
    if ("into" in args) g.set(args.into, value);
    if ("invalidates" in args) g.invalidate(args.invalidates);
    if ("nothingOn" in args && isDeepStrictEqual(value, args.nothingOn)) return undefined;
    return "returns" in args ? args.returns : base(...given);
  };
}
const callbackRecipe = (args) => ({ ref: "trace.callback", config: Object.fromEntries(Object.entries(args).filter(([key]) => key !== "seed")) });
const project = (args) => {
  if (args?.project !== "follow") throw new Error(`the runner has no projector named ${args?.project}`);
  return (v) => ({ deps: [v], fn: relay });
};
const builders = (mods) => ({
  derived: (g, n) => mods.state.derived(g, n.id, n.deps, callback(n.args, g), { recipe: callbackRecipe(n.args) }),
  merge: (g, n) => mods.combine.merge(g, n.id, n.deps),
  withLatestFrom: (g, n) => mods.combine.withLatestFrom(g, n.id, n.deps[0], n.deps.slice(1)),
  zip: (g, n) => mods.combine.zip(g, n.id, n.deps),
  concat: (g, n) => mods.combine.concat(g, n.id, n.deps),
  race: (g, n) => mods.combine.race(g, n.id, n.deps),
  switchMap: (g, n) => switchMap(g, n.id, n.deps[0], project(n.args)),
  mergeMap: (g, n) => mergeMap(g, n.id, n.deps[0], project(n.args)),
  map: (g, n) => mods.transform.map(g, n.id, n.deps[0], callback(n.args, g), { recipe: callbackRecipe(n.args) }),
  filter: (g, n) => mods.transform.filter(g, n.id, n.deps[0], callback(n.args, g), { recipe: callbackRecipe(n.args) }),
  tap: (g, n) => mods.transform.tap(g, n.id, n.deps[0], callback(n.args, g), { recipe: callbackRecipe(n.args) }),
  scan: (g, n) => mods.accumulate.scan(g, n.id, n.deps[0], callback(n.args, g), n.args.seed, { recipe: callbackRecipe(n.args) }),
  reduce: (g, n) => mods.accumulate.reduce(g, n.id, n.deps[0], callback(n.args, g), n.args.seed, { recipe: callbackRecipe(n.args) }),
  sample: (g, n) => mods.notifier.sample(g, n.id, n.deps[0], n.deps[1]),
  takeUntil: (g, n) => mods.notifier.takeUntil(g, n.id, n.deps[0], n.deps[1]),
  buffer: (g, n) => mods.notifier.buffer(g, n.id, n.deps[0], n.deps[1]),
  bufferCount: (g, n) => mods.notifier.bufferCount(g, n.id, n.deps[0], n.args.n),
  distinctUntilChanged: (g, n) => mods.compare.distinctUntilChanged(g, n.id, n.deps[0], n.args ? { equal: callback(n.args, g), recipe: callbackRecipe(n.args) } : {}),
  pairwise: (g, n) => mods.compare.pairwise(g, n.id, n.deps[0]),
  take: (g, n) => mods.select.take(g, n.id, n.deps[0], n.args.n),
  skip: (g, n) => mods.select.skip(g, n.id, n.deps[0], n.args.n),
  takeWhile: (g, n) => mods.select.takeWhile(g, n.id, n.deps[0], callback(n.args, g), { recipe: callbackRecipe(n.args) }),
  first: (g, n) => mods.select.first(g, n.id, n.deps[0], n.args ? { p: callback(n.args, g), recipe: callbackRecipe(n.args) } : {}),
  last: (g, n) => mods.select.last(g, n.id, n.deps[0], n.args ? { p: callback(n.args, g), recipe: callbackRecipe(n.args) } : {}),
  // Helpers that only shape a trace's input. They carry recipes so a trace can hold them across a
  // restore step.
  arrays: (g, n) => g.node(n.id, n.deps, arraysFn, { recipe: { ref: "trace.arrays", config: null } }),
  empty: (g, n) => g.node(n.id, [], emptyFn, { recipe: { ref: "trace.empty", config: null } }),
  once: (g, n) => g.node(n.id, [], onceFn(n.args), { recipe: { ref: "trace.once", config: n.args } }),
});
// arrays: each element of its source's value is one array it sends, in one run: a list is that
// list as DATA, "INVALIDATE" and "COMPLETE" are those messages, and { error } is an ERROR.
const arraysFn = (ctx) => {
  for (const value of ctx.deps[0].waves.flat()) {
    for (const array of value) {
      if (Array.isArray(array)) ctx.down(array.map((v) => ["DATA", v]));
      else if (array === "INVALIDATE" || array === "COMPLETE") ctx.down([[array]]);
      else if (array && Object.hasOwn(array, "error")) ctx.down([["ERROR", array.error]]);
      else throw new Error(`the arrays helper cannot send ${JSON.stringify(array)}`);
    }
  }
};
const emptyFn = (ctx) => ctx.down([["COMPLETE"]]);
const onceFn = ({ value }) => (ctx) => ctx.down([["DATA", value]]); // sends as it is activated
const helperRecipes = { "trace.arrays": () => arraysFn, "trace.empty": () => emptyFn, "trace.once": onceFn, "trace.callback": (config, at) => callback(config, at.g) };

const STEPS = new Set(["subscribe", "unsubscribe", "set", "invalidate", "complete", "error", "batch", "restore"]);
const flat = (steps) => steps.flatMap((step) => (step[0] === "batch" ? [step, ...flat(step[1])] : [step]));

// Why a trace cannot be run here, or null. A trace that cannot be run is skipped by name; it is
// never passed.
export function unrunnable(trace) {
  const known = builders(MODULES);
  const missing = [...new Set(trace.nodes.map((n) => n.op).filter((op) => op && !known[op]))];
  if (missing.length) return `the reference has no ${missing.join(", ")}`;
  const steps = [...new Set(flat(trace.steps).map((step) => step[0]).filter((kind) => !STEPS.has(kind)))];
  return steps.length ? `the runner has no ${steps.join(", ")} step` : null;
}

const OCCURRENCES = new Set(["DATA", "INVALIDATE", "COMPLETE", "ERROR"]);
function occurrences(entries) {
  const groups = new Map();
  for (const [to, from, msgs] of entries) {
    const kept = msgs.filter((m) => OCCURRENCES.has(m[0]));
    if (!kept.length) continue;
    const key = `${to}\u0000${from}`;
    if (!groups.has(key)) groups.set(key, [to, from, []]);
    groups.get(key)[2].push(...kept);
  }
  return [...groups.values()];
}

// An expectation writes ["ERROR"] without a payload for an ERROR that a throw produced: how a
// thrown value becomes a payload is each runtime's (R-failure), so only the ERROR is expected.
export function matches(got, expect) {
  const loose = (steps, pattern) => steps.map((step, i) => step.map((entry, j) => [entry[0], entry[1], entry[2].map((m, k) => {
    const wanted = pattern[i]?.[j]?.[2]?.[k];
    return m[0] === "ERROR" && Array.isArray(wanted) && wanted.length === 1 && wanted[0] === "ERROR" ? ["ERROR"] : m;
  })]));
  return isDeepStrictEqual(loose(got, expect), expect);
}

// What the sinks received during each step, at the trace's detail, and the graph it ended on. A
// restore step captures the graph and goes on with the restored one, which has no subscribers;
// only nodes built with a recipe can be captured, so a trace with a kernel-sugar node cannot take
// the step. `late()` is what any sink received after the last step returned.
export function runTraceOn(trace, edited = {}) {
  const mods = { ...MODULES, ...edited };
  const build = builders(mods);
  const registry = { ...mods.notifier.notifierRecipes, ...mods.transform.transformRecipes, ...mods.accumulate.accumulateRecipes, ...mods.compare.compareRecipes, ...mods.select.selectRecipes, ...mods.combine.combineRecipes, ...mods.state.stateRecipes, ...higherOrderRecipes, ...helperRecipes };
  let g = createGraph();
  const sinks = new Set();
  const request = (step) => {
    const [kind, a, b] = step;
    if (kind === "subscribe") { g.subscribe(a, b); sinks.add(`${a}\u0000${b}`); }
    else if (kind === "unsubscribe") {
      if (!sinks.delete(`${a}\u0000${b}`)) throw new Error(`the trace unsubscribes ${a} from ${b}, which it never subscribed`);
      g.unsubscribe(a, b);
    } else if (kind === "set") g.set(a, b);
    else if (kind === "invalidate") g.invalidate(a);
    else if (kind === "complete") g.complete(a);
    else if (kind === "error") g.error(a, b);
    else if (kind === "batch") g.batch(() => a.forEach((inner) => request(inner)));
    else throw new Error(`the reference runner has no ${kind} step`);
  };
  for (const n of trace.nodes) {
    checkNode(n);
    if (n.state) { if (n.state.length) g.state(n.id, n.state[0]); else g.state(n.id); } else build[n.op](g, n);
  }
  const got = trace.steps.map((step) => {
    if (step[0] === "restore") { g = restore(JSON.parse(JSON.stringify(capture(g))), registry); sinks.clear(); return []; }
    const start = g.trace.length;
    request(step);
    const entries = g.trace.slice(start).map((entry) => [entry.to, entry.from, entry.msgs]);
    return trace.detail === "occurrences" ? occurrences(entries) : entries;
  });
  const end = g.trace.length;
  const last = g;
  return { got, late: () => last.trace.slice(end).map((entry) => [entry.to, entry.from, entry.msgs]) };
}
export const runTrace = (trace, edited) => runTraceOn(trace, edited).got;

// A trace passes when every step matches and nothing more arrives within one turn of the event
// loop after the last step, which catches a promise or an immediate timer the run started; a
// timer of a few milliseconds is past this check, and wants a clock the runner owns.
export async function passes(trace, edited) {
  return (await differing(trace, edited)).size === 0;
}

// The nodes whose sinks received something other than the trace expects: in a step that does not
// match, every node with an entry the other side lacks; and every node that sent late. Empty when
// the trace passes.
export async function differing(trace, edited) {
  const { got, late } = runTraceOn(trace, edited);
  const nodes = new Set();
  got.forEach((step, i) => {
    if (matches([step], [trace.expect[i]])) return;
    const want = trace.expect[i].map((entry) => JSON.stringify(entry));
    const have = step.map((entry) => JSON.stringify(entry));
    const before = nodes.size;
    for (const entry of step) if (!want.includes(JSON.stringify(entry))) nodes.add(entry[1]);
    for (const entry of trace.expect[i]) if (!have.includes(JSON.stringify(entry))) nodes.add(entry[1]);
    // The same entries in another number or order: every node of the step is in doubt.
    if (nodes.size === before) for (const entry of [...step, ...trace.expect[i]]) nodes.add(entry[1]);
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (const entry of late()) nodes.add(entry[1]);
  return nodes;
}
