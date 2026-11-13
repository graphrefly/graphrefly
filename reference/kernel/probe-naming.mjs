// C-49: validate the shared inventory and, when supplied, actual runtime outputs.
// node reference/kernel/probe-naming.mjs [--ts out.json --rust out.json --py out.json]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createGraph } from "./kernel.mjs";
import { wireEdgeGroupIn } from "../modules/bridge.mjs";

export const namingFixture = JSON.parse(readFileSync(new URL("../../spec/fixtures/node-naming.v1.json", import.meta.url)));

export function checkNamingFixture(fixture) {
  assert.equal(fixture.schema, "graphrefly/node-naming@1");
  assert.equal(fixture.error, "name must not contain '::'");
  assert.equal(fixture.boundaryError, "name must not start or end with ':'");
  for (const [name, { runtimes }] of Object.entries(fixture.modules)) {
    assert.deepEqual(Object.keys(runtimes).sort(), ["py", "rust", "ts"], name);
    const shared = new Map();
    for (const [runtime, entry] of Object.entries(runtimes)) {
      if (entry === null) continue;
      assert.deepEqual(entry.ids, [...new Set(entry.ids)].sort(), `${name}/${runtime}: full unique sorted inventory`);
      for (const id of entry.ids) {
        const segments = id.split("/");
        for (const segment of segments) assert.match(segment, /^[a-z][a-zA-Z0-9]*$/, `${name}/${runtime}: ${id}`);
        const words = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(" ");
        // These fixtures contain fixed role paths, not arbitrary caller keys.
        if (segments.length > 1 && segments[segments.length - 2] !== "edges") {
          const prefix = new Set(words(segments[segments.length - 2]));
          const suffix = words(segments.at(-1));
          assert.ok(!suffix.some((w) => prefix.has(w)), `${name}/${runtime}: repeated role in ${id}`);
        }
      }
      assert.deepEqual([...new Set(Object.values(entry.roles))].sort(), entry.ids, `${name}/${runtime}: each node has a role`);
      for (const [role, id] of Object.entries(entry.roles)) {
        if (shared.has(role)) assert.equal(id, shared.get(role), `${name}: ${role} must agree across owners`);
        else shared.set(role, id);
      }
    }
  }
}

export function checkRuntimeNames(runtime, actual, fixture = namingFixture) {
  const expected = Object.fromEntries(Object.entries(fixture.modules).map(([name, module]) => [name, module.runtimes[runtime]]));
  assert.deepEqual(actual, expected, `${runtime}: full live module inventories`);
}

function main() {
  checkNamingFixture(namingFixture);
  const g = createGraph();
  g.state("frames");
  const bridge = wireEdgeGroupIn(g, "bridge", { group: "g", frames: "frames", edges: ["x", "issues"] });
  const actual = {
    ids: g.describe().slice(1).map(({ id }) => id).sort(),
    roles: { gate: bridge.gate, edgeX: bridge.inbound.x, edgeIssues: bridge.inbound.issues, issues: bridge.issues },
  };
  for (const entry of Object.values(namingFixture.modules.edgeGroupIn.runtimes)) assert.deepEqual(actual, entry);
  assert.throws(() => g.state("a::b"), { message: namingFixture.error });
  const checked = ["reference"];
  const args = process.argv.slice(2);
  assert.equal(args.length % 2, 0, "runtime arguments are --owner output.json pairs");
  for (let i = 0; i < args.length; i += 2) {
    const runtime = args[i].replace(/^--/, "");
    assert.ok(["ts", "rust", "py"].includes(runtime));
    checkRuntimeNames(runtime, JSON.parse(readFileSync(args[i + 1])));
    checked.push(runtime);
  }
  console.log(JSON.stringify({ checked, edgeGroupIn: actual }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
