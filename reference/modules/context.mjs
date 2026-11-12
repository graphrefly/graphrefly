// A module may project invocation input, but must preserve its read lifetime.
// Values already copied by an author remain ordinary data.
export function withDependencies(ctx, values) {
  const check = () => { void ctx.deps; };
  const deps = values.map((value) => Object.defineProperties({}, Object.fromEntries(
    Object.keys(value).map((key) => [key, { enumerable: true, get() { check(); return value[key]; } }]),
  )));
  return Object.create(ctx, { deps: { get() { check(); return deps; } } });
}
