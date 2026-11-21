// distinctUntilChanged and pairwise over the reference kernel, written from their contracts
// (operators/contracts.jsonl, O-distinctUntilChanged, O-pairwise; graphrefly:D813). Non-normative.
//
// Both keep one value in private state: the last DATA sent, or the previous DATA read. It lasts
// for one activation (R-lifetime) and a checkpoint saves it (R-checkpoint).
//
// distinctUntilChanged has the manual INVALIDATE policy (R-invalidation): a source INVALIDATE
// retracts the output and also clears what is compared against, which the auto policy, keeping
// private state, would not. pairwise has the default policies: its previous value is kept across
// an INVALIDATE, as the auto policy keeps it.
//
// distinctUntilChanged takes an optional equality, equal(last sent, candidate), given as a function.
// Without one it uses Object.is and always carries a recipe; with one it carries a recipe when it
// is given one for the callback, and is local-only otherwise. compareRecipes goes in a restore's
// registry. This file imports nothing, so compare.mutants.test.mjs can load edited copies of it.

// Each DATA that differs from the last one sent goes out in the array it came in; an array left
// with none is not sent.
const distinctFn = (equal) => (ctx) => {
  const [source] = ctx.deps;
  let last = ctx.state.get()?.last ?? [];
  if (source.invalidated) {
    last = [];
    ctx.down([["INVALIDATE"]]);
  }
  for (const w of source.waves) {
    const kept = [];
    for (const v of w) {
      if (last.length && equal(last[0], v)) continue;
      kept.push(v);
      last = [v];
    }
    if (kept.length) ctx.down(kept.map((v) => ["DATA", v]));
  }
  ctx.state.set({ last });
};

// A pair goes out in the array of its second value; the first value read only becomes the previous one.
function pairwiseFn(ctx) {
  let prev = ctx.state.get()?.prev ?? [];
  for (const w of ctx.deps[0].waves) {
    const pairs = [];
    for (const v of w) {
      if (prev.length) pairs.push([prev[0], v]);
      prev = [v];
    }
    if (pairs.length) ctx.down(pairs.map((pair) => ["DATA", pair]));
  }
  ctx.state.set({ prev });
}

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

export function distinctUntilChanged(g, id, sourceId, { equal, recipe } = {}) {
  callbackRecipe(`distinctUntilChanged ${id}`, recipe);
  if (equal != null && typeof equal !== "function") throw new TypeError(`distinctUntilChanged ${id}: its equality is a function, or none`);
  if (equal == null && recipe !== undefined) throw new TypeError(`distinctUntilChanged ${id}: a recipe is for an equality, and none was given`);
  const carried = equal == null ? { equal: null } : recipe !== undefined ? { equal: recipe } : null;
  return g.node(id, [sourceId], distinctFn(equal ?? Object.is), { invalidate: "manual", ...(carried && { recipe: { ref: "operators.distinctUntilChanged", config: carried } }) });
}

export function pairwise(g, id, sourceId) {
  return g.node(id, [sourceId], pairwiseFn, { recipe: { ref: "operators.pairwise", config: null } });
}

export const compareRecipes = Object.freeze({
  // A saved configuration says which it was: equal is null, or a callback's recipe. One that says
  // neither, as a checkpoint edited by hand, is refused, not read as no equality.
  "operators.distinctUntilChanged": (config, at) => {
    if (!config || !Object.hasOwn(config, "equal")) throw new TypeError("distinctUntilChanged: its recipe says neither an equality nor that there is none");
    return distinctFn(config.equal === null ? Object.is : callbackOf(at, config.equal));
  },
  "operators.pairwise": () => pairwiseFn,
});
