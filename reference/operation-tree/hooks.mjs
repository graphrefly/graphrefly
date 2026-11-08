// Loaded with --import before the vendored spec. It points `@photo-scenes/operations` at
// packages/operations/src/index.ts under the current directory, which the runner fills with
// the arm under test (the spec's subprocess test resolves the same path itself), and
// `@playwright/test` at the shim.

import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const shim = new URL("./playwright-shim.mjs", import.meta.url).href;

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@photo-scenes/operations") {
      return { url: pathToFileURL(resolve(process.cwd(), "packages/operations/src/index.ts")).href, shortCircuit: true };
    }
    if (specifier === "@playwright/test") return { url: shim, shortCircuit: true };
    return next(specifier, context);
  },
});
