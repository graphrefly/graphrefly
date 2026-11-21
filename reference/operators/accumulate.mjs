// scan and reduce over the reference kernel, written from their contracts
// (operators/contracts.jsonl, O-scan, O-reduce; graphrefly:D813). Non-normative.
//
// The accumulator is private state, { acc }, so the default INVALIDATE policy already does what
// both contracts say: the output is retracted, the accumulator is kept, and the reducer is not
// called (R-invalidation). It lasts for one activation (R-lifetime) and a checkpoint saves it
// (R-checkpoint). The seed is required (the user, 2026-11-20): an absent seed could not be told
// from an accumulator not yet started, and reduce sends it for an empty source.
//
// scan has the default terminal policies. reduce has manual COMPLETE: its one output is the
// result with the COMPLETE, in one array.
//
// Each takes a reducer, given as a function. With `recipe`, a recipe { ref, config } that builds
// the reducer, the node carries its own recipe, which holds the seed, and a checkpoint can restore
// it; accumulateRecipes goes in the restore's registry. This file imports nothing, so
// accumulate.mutants.test.mjs can load edited copies of it.

const start = (ctx, seed) => (ctx.state.get() ?? { acc: seed }).acc;
// A reducer's result is the next accumulator, so it must be a value: one that is not ends the
// operator with ERROR in that wave, in reduce as in scan, which would have had to send it
// (the user, 2026-11-20). The reducer returns a new accumulator and does not change the one it
// was given: nothing here copies an accumulator or a seed (the user, the same day).
const step = (f, acc, v) => {
  const next = f(acc, v);
  if (next === undefined) throw new TypeError("the reducer returned no value");
  return next;
};

// Each intermediate goes out in the array its input came in; the seed itself is not sent.
const scanFn = (f, seed) => (ctx) => {
  let acc = start(ctx, seed);
  for (const w of ctx.deps[0].waves) if (w.length) ctx.down(w.map((v) => ["DATA", (acc = step(f, acc, v))]));
  ctx.state.set({ acc });
};

const reduceFn = (f, seed) => (ctx) => {
  const [source] = ctx.deps;
  let acc = start(ctx, seed);
  for (const v of source.waves.flat()) acc = step(f, acc, v);
  ctx.state.set({ acc });
  if (source.terminal?.[0] === "COMPLETE") ctx.down([["DATA", acc], ["COMPLETE"]]);
};

const seeded = (name, seed, f) => {
  if (seed === undefined) throw new TypeError(`${name}: a seed is required`);
  if (f !== undefined && typeof f !== "function") throw new TypeError(`${name}: its reducer is a function`);
};
// A callback's recipe is { ref, config } with a registered ref, and its factory gives a function
// alone. A recipe without a ref is refused when the operator is built; whether its config is JSON
// and its ref is registered is found at capture and at restore (R-checkpoint).
const callbackRecipe = (name, recipe) => {
  if (recipe !== undefined && (recipe === null || typeof recipe.ref !== "string" || !recipe.ref)) throw new TypeError(`${name}: a callback's recipe is { ref, config } with a non-empty ref`);
  return recipe;
};
const callbackOf = (at, recipe) => {
  const made = at.make(callbackRecipe("recipe", recipe ?? null).ref, recipe.config);
  if (made.setup) throw new TypeError("a callback's recipe gives a function alone, without a setup");
  return made.fn;
};
const withRecipe = (ref, recipe, seed) => (recipe !== undefined ? { recipe: { ref, config: { f: recipe, seed } } } : {});

export function scan(g, id, sourceId, f, seed, { recipe } = {}) {
  seeded(`scan ${id}`, seed, f ?? null);
  callbackRecipe(`scan ${id}`, recipe);
  return g.node(id, [sourceId], scanFn(f, seed), withRecipe("operators.scan", recipe, seed));
}

export function reduce(g, id, sourceId, f, seed, { recipe } = {}) {
  seeded(`reduce ${id}`, seed, f ?? null);
  callbackRecipe(`reduce ${id}`, recipe);
  return g.node(id, [sourceId], reduceFn(f, seed), { terminal: { complete: "manual" }, ...withRecipe("operators.reduce", recipe, seed) });
}

const fromRecipe = (name, build) => (config, at) => {
  seeded(name, config?.seed);
  return build(callbackOf(at, config.f), config.seed);
};
export const accumulateRecipes = Object.freeze({
  "operators.scan": fromRecipe("scan", scanFn),
  "operators.reduce": fromRecipe("reduce", reduceFn),
});
