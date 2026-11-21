// derived over the reference kernel, written from its contract (operators/contracts.jsonl,
// O-derived; graphrefly:D813). Non-normative.
//
// One node with the default policies and no private state: it reads the latest value the kernel
// holds of each dependency (R-invocation). A dependency's INVALIDATE retracts the output and
// leaves that dependency without a value, so nothing is computed until it has one again; a
// dependency that has ended keeps its value (R-terminals).
//
// It takes a function, given as one. With `recipe`, a recipe { ref, config } that builds the
// function, the node carries its own recipe and a checkpoint can restore it; stateRecipes goes in
// the restore's registry. This file imports nothing, so state.mutants.test.mjs can load edited
// copies of it.

// One result per run in which a dependency delivered DATA, once every dependency has a value.
const derivedFn = (f) => (ctx) => {
  if (!ctx.deps.every((d) => d.has)) return;
  if (!ctx.deps.some((d) => d.waves.some((w) => w.length))) return;
  ctx.down([["DATA", f(...ctx.deps.map((d) => d.value))]]);
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

export function derived(g, id, depIds, f, { recipe } = {}) {
  callbackRecipe(`derived ${id}`, recipe);
  if (!Array.isArray(depIds) || !depIds.length) throw new RangeError(`derived ${id}: at least one dependency`);
  if (new Set(depIds).size !== depIds.length) throw new RangeError(`derived ${id}: its dependencies are distinct nodes`);
  if (typeof f !== "function") throw new TypeError(`derived ${id}: f is a function`);
  return g.node(id, depIds, derivedFn(f), recipe !== undefined ? { recipe: { ref: "operators.derived", config: { f: recipe } } } : {});
}

export const stateRecipes = Object.freeze({
  "operators.derived": (config, at) => derivedFn(callbackOf(at, config?.f)),
});
