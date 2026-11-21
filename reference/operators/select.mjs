// take, skip, takeWhile, first and last over the reference kernel, written from their contracts
// (operators/contracts.jsonl, O-take, O-skip, O-takeWhile, O-first, O-last; graphrefly:D813).
// Non-normative.
//
// take, takeWhile and first end themselves at a DATA. The COMPLETE goes in the array they were
// sending then, and nothing after that DATA is read: not the rest of its array, and not an ERROR
// that follows it, in the same wave or in the snapshot the operator activates on, which reaches a
// branch that has ended (as takeUntil's notifier DATA ends it whatever ERROR the wave carries; the
// user, 2026-11-20). That needs the manual ERROR policy (R-terminals), and it means these three
// read the DATA of a wave that carries an ERROR, predicates included, to see whether they end
// first; in a wave that does not end the operator the ERROR ends it without that wave's DATA, as
// the auto policy would. COMPLETE stays auto: a source that ends first ends them.
//
// skip has the default policies. last has manual COMPLETE: its one output is the last DATA, or the
// last for which its predicate held, with the COMPLETE in one array.
//
// Progress (take's and skip's count, last's candidate) is private state: an INVALIDATE keeps it,
// as the default policy does (R-invalidation), it lasts for one activation (R-lifetime) and a
// checkpoint saves it (R-checkpoint).
//
// takeWhile takes a predicate and first and last an optional one, given as a function; with a
// recipe for it the node carries its own recipe. selectRecipes goes in a restore's registry. This
// file imports nothing, so select.mutants.test.mjs can load edited copies of it.

// visit(ctx, v, out) adds what v sends to `out`, the array being built, and returns true when the
// operator ends at v.
const ending = (visit) => (ctx) => {
  const [source] = ctx.deps;
  const arrays = [];
  let ended = false;
  for (const w of source.waves) {
    const out = [];
    for (const v of w) {
      ended = visit(ctx, v, out);
      if (ended) break;
    }
    if (ended) { arrays.push([...out, ["COMPLETE"]]); break; }
    if (out.length) arrays.push(out);
  }
  if (!ended && source.terminal?.[0] === "ERROR") { ctx.down([source.terminal]); return; }
  for (const array of arrays) ctx.down(array);
};

const takeFn = ({ n }) => {
  count("take", n);
  const counting = ending((ctx, v, out) => {
    const seen = (ctx.state.get()?.seen ?? 0) + 1;
    ctx.state.set({ seen });
    out.push(["DATA", v]);
    return seen >= n;
  });
  return (ctx) => (n === 0 ? ctx.down([["COMPLETE"]]) : counting(ctx)); // take(0) completes whatever its source holds
};

const skipFn = ({ n }) => {
  count("skip", n);
  return (ctx) => {
    let seen = ctx.state.get()?.seen ?? 0;
    for (const w of ctx.deps[0].waves) {
      const kept = w.slice(Math.max(0, n - seen)); // an array left empty is not sent
      seen = Math.min(n, seen + w.length);
      if (kept.length) ctx.down(kept.map((v) => ["DATA", v]));
    }
    ctx.state.set({ seen });
  };
};

const takeWhileFn = (p) => ending((ctx, v, out) => {
  if (!p(v)) return true;
  out.push(["DATA", v]);
  return false;
});

const firstFn = (p) => ending((ctx, v, out) => {
  if (!p(v)) return false;
  out.push(["DATA", v]);
  return true;
});

const lastFn = (p) => (ctx) => {
  const [source] = ctx.deps;
  let candidate = ctx.state.get()?.candidate ?? [];
  for (const v of source.waves.flat()) if (p(v)) candidate = [v];
  ctx.state.set({ candidate });
  if (source.terminal?.[0] === "COMPLETE") ctx.down([...candidate.map((v) => ["DATA", v]), ["COMPLETE"]]);
};

const any = () => true;
const count = (name, n) => {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`${name}: n must be a nonnegative integer`);
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
const stops = { terminal: { error: "manual" } };
// With no predicate (absent or null) the node always carries a recipe, { p: null }; with one, when a
// recipe for it is given.
const optional = (name, id, ref, p, recipe) => {
  callbackRecipe(`${name} ${id}`, recipe);
  if (p != null && typeof p !== "function") throw new TypeError(`${name} ${id}: its predicate is a function, or none`);
  if (p == null && recipe !== undefined) throw new TypeError(`${name} ${id}: a recipe is for a predicate, and none was given`);
  const carried = p == null ? { p: null } : recipe !== undefined ? { p: recipe } : null;
  return carried ? { recipe: { ref, config: carried } } : {};
};
// A saved configuration says which it was: p is null, or a callback's recipe. One that says
// neither, as a checkpoint edited by hand, is refused, not read as no predicate.
const predicateOf = (name, config, at) => {
  if (!config || !Object.hasOwn(config, "p")) throw new TypeError(`${name}: its recipe says neither a predicate nor that there is none`);
  return config.p === null ? any : callbackOf(at, config.p);
};

export function take(g, id, sourceId, n) {
  count(`take ${id}`, n);
  n += 0; // -0 is 0, and JSON could not save it
  return g.node(id, [sourceId], takeFn({ n }), { ...stops, recipe: { ref: "operators.take", config: { n } } });
}

export function skip(g, id, sourceId, n) {
  count(`skip ${id}`, n);
  n += 0; // -0 is 0, and JSON could not save it
  return g.node(id, [sourceId], skipFn({ n }), { recipe: { ref: "operators.skip", config: { n } } });
}

export function takeWhile(g, id, sourceId, p, { recipe } = {}) {
  callbackRecipe(`takeWhile ${id}`, recipe);
  if (typeof p !== "function") throw new TypeError(`takeWhile ${id}: its predicate is a function`);
  return g.node(id, [sourceId], takeWhileFn(p), { ...stops, ...(recipe !== undefined && { recipe: { ref: "operators.takeWhile", config: { p: recipe } } }) });
}

export function first(g, id, sourceId, { p, recipe } = {}) {
  const carried = optional("first", id, "operators.first", p, recipe);
  return g.node(id, [sourceId], firstFn(p ?? any), { ...stops, ...carried });
}

export function last(g, id, sourceId, { p, recipe } = {}) {
  const carried = optional("last", id, "operators.last", p, recipe);
  return g.node(id, [sourceId], lastFn(p ?? any), { terminal: { complete: "manual" }, ...carried });
}

export const selectRecipes = Object.freeze({
  "operators.take": (config) => takeFn(config ?? {}),
  "operators.skip": (config) => skipFn(config ?? {}),
  "operators.takeWhile": (config, at) => takeWhileFn(callbackOf(at, config?.p)),
  "operators.first": (config, at) => firstFn(predicateOf("first", config, at)),
  "operators.last": (config, at) => lastFn(predicateOf("last", config, at)),
});
