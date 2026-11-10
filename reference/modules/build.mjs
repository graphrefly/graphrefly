// Builds a module's nodes on a kernel graph, or through a checkpoint bundle (checkpoint.mjs
// `recipes`) so that they can be restored. Non-normative. Added 2026-11-10 (F6, the user's choice:
// every module's graph can be captured and restored).
//
// A module describes each node it makes as a recipe { ref, config, factory }: `factory(config,
// { g, id })` returns the function or { fn, setup }, and `ref` is the name under which the module
// exports that factory in its recipes object, for the registry a restore is given. On a kernel
// graph the factory is called here; through a bundle the bundle calls it from the registry, so
// only `ref` and the JSON `config` are saved. A module that builds or replaces nodes from a
// function does it through builder(g) too, with the g its factory was given.

export const isBundle = (g) => typeof g?.capture === "function";

export function builder(g) {
  const bundle = isBundle(g) ? g : null;
  const kernel = bundle ? bundle.g : g;
  const made = (recipe, id) => {
    const built = recipe.factory(recipe.config ?? null, { g, id });
    return typeof built === "function" ? { fn: built } : built;
  };
  return {
    kernel,
    restorable: Boolean(bundle),
    exists(id) { return kernel.describe().some((n) => n.id === id); },
    state(id, initial) { return bundle ? bundle.state(id, initial) : kernel.state(id, initial); },
    node(id, deps, recipe, opts) {
      if (bundle) return bundle.node(id, deps, recipe.ref, recipe.config ?? null, opts);
      const { fn, setup } = made(recipe, id);
      return kernel.node(id, deps, fn, { ...opts, ...(setup && { setup }) });
    },
    // A new instance from a recipe; the node keeps its opts and setup (R-node).
    replace(id, deps, recipe) {
      if (bundle) return bundle.replace(id, deps, recipe.ref, recipe.config ?? null);
      kernel.replace(id, deps, made(recipe, id).fn);
      return id;
    },
    // What another recipe builds, by reference through a bundle or as given on a kernel graph.
    use(ref, config, given) { return bundle ? bundle.make(ref, config).fn : given; },
  };
}
