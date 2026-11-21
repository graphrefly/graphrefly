// map, filter and tap over the reference kernel, written from their contracts
// (operators/contracts.jsonl, O-map, O-filter, O-tap; graphrefly:D813). Non-normative.
//
// Each is one node with the default policies, so what their contracts leave to O-common is what
// the kernel does: an INVALIDATE retracts the output, an ERROR ends the node without that wave's
// DATA, and the node completes when its source has, the COMPLETE an array of its own (which the
// reference kernel does and no kernel rule states of a node that is not quiet: graphrefly:B148).
// A throw from the callback is the node's ERROR, and the kernel then sends nothing else of that
// run (R-failure).
//
// Each takes a callback, given as a function. With `recipe`, a recipe { ref, config } that builds
// the callback, the node carries its own recipe and a checkpoint can restore it; transformRecipes
// goes in the restore's registry beside the callback's own factory. Without it the node is
// local-only (R-checkpoint). This file imports nothing, so transform.mutants.test.mjs can load
// edited copies of it.

const mapFn = (f) => (ctx) => {
  for (const w of ctx.deps[0].waves) if (w.length) ctx.down(w.map((v) => ["DATA", f(v)]));
};

// An array left with no DATA is not sent.
const filterFn = (p) => (ctx) => {
  for (const w of ctx.deps[0].waves) {
    const kept = w.filter((v) => p(v));
    if (kept.length) ctx.down(kept.map((v) => ["DATA", v]));
  }
};

// f is called once for each DATA tap is given, in order, and what it returns is not read. Tap is
// not given the DATA of the wave of its source's ERROR, so f is not called for it (the user,
// 2026-11-20).
const tapFn = (f) => (ctx) => {
  for (const w of ctx.deps[0].waves) {
    if (!w.length) continue;
    for (const v of w) f(v);
    ctx.down(w.map((v) => ["DATA", v]));
  }
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
const withRecipe = (ref, key, recipe) => (callbackRecipe(ref, recipe) !== undefined ? { recipe: { ref, config: { [key]: recipe } } } : {});
const callable = (name, f) => {
  if (typeof f !== "function") throw new TypeError(`${name}: its callback is a function`);
  return f;
};

export function map(g, id, sourceId, f, { recipe } = {}) {
  return g.node(id, [sourceId], mapFn(callable(`map ${id}`, f)), withRecipe("operators.map", "f", recipe));
}

export function filter(g, id, sourceId, p, { recipe } = {}) {
  return g.node(id, [sourceId], filterFn(callable(`filter ${id}`, p)), withRecipe("operators.filter", "p", recipe));
}

export function tap(g, id, sourceId, f, { recipe } = {}) {
  return g.node(id, [sourceId], tapFn(callable(`tap ${id}`, f)), withRecipe("operators.tap", "f", recipe));
}

export const transformRecipes = Object.freeze({
  "operators.map": (config, at) => mapFn(callbackOf(at, config?.f)),
  "operators.filter": (config, at) => filterFn(callbackOf(at, config?.p)),
  "operators.tap": (config, at) => tapFn(callbackOf(at, config?.f)),
});
