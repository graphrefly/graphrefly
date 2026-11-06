/** Copy the real private controller and runtime into synthetic repositories; never rewrite historical manifests. */
import { copyFileSync, mkdirSync, existsSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runtimeBindings, orchestratorEnvironment } from "../runtime-bindings.mjs";
const root = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
export { orchestratorEnvironment };
export function copyGraphRuntime(dir, manifest) {
	const bindings = runtimeBindings();
	for (const binding of bindings) {
		if (binding.path.includes("/node_modules/")) continue;
		const target = join(dir, binding.path);
		mkdirSync(dirname(target), { recursive: true });
		copyFileSync(join(root, binding.path), target);
	}
	const ts = resolve(dir, "../graphrefly-ts");
	mkdirSync(ts, { recursive: true });
	if (!existsSync(join(ts, "node_modules")))
		symlinkSync(resolve(root, "../graphrefly-ts/node_modules"), join(ts, "node_modules"));
	copyFileSync(resolve(root, "../graphrefly-ts/package.json"), join(ts, "package.json"));
	copyFileSync(
		join(root, "scripts/b121-comparison/runtime-bindings.mjs"),
		join(dir, "scripts/b121-comparison/runtime-bindings.mjs"),
	);
	if (manifest) {
		manifest.orchestratorEnvironment = orchestratorEnvironment;
		manifest.bindings.push(...bindings);
	}
}
