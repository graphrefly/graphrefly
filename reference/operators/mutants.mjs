// One family's mutants against the canonical traces. Each mutant is one edit, or a few, of the
// family module's text, loaded from a temporary copy (the operator modules import nothing), never
// from the checkout. It must load, and at least one of the family's traces must then run to its
// end and give something other than its expectation. A mutant that fails to load, or that makes
// the runner itself throw, does not count as noticed: only a sink that received something else
// does. A mutant no trace notices means a contract sentence without a trace that holds it, so each
// names the sentence it breaks. Only traces that pass on the unmutated modules are used: one that
// already fails, as a known difference of another operator in it, could not tell a mutant apart.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { differing, passes, traces, unrunnable } from "./run-trace.mjs";

// mutants: [what the mutant does, the contract sentence it breaks, text to find (once), replacement],
// or, for a mutant that needs several edits, a list of [text, replacement] pairs in place of the last
// two. A mutant of code that several operators share names them in a fifth place, and then each of
// them must be noticed in its own right: a sink of a node of that operator, or of the state its
// callback records into, received something else. A trace that merely holds the operator while
// another one differs does not count.
export function mutantSuite({ module, operators, mutants, minTraces }) {
  const source = readFileSync(fileURLToPath(new URL(`./${module}.mjs`, import.meta.url)), "utf8");
  const own = new Set(operators);
  const family = traces.filter((trace) => trace.nodes.some((n) => own.has(n.op)) && !unrunnable(trace));
  const dir = mkdtempSync(join(tmpdir(), `${module}-mutants-`));
  test.after(() => rmSync(dir, { recursive: true, force: true }));

  const usable = Promise.all(family.map(async (trace) => ((await passes(trace)) ? trace : null))).then((found) => found.filter(Boolean));

  test(`there are enough ${module} traces that pass on the modules as written`, async () => {
    const ids = (await usable).map((trace) => trace.id);
    assert.ok(ids.length >= minTraces, `${ids.length} traces: ${ids.join(", ")}`);
  });

  mutants.forEach(([name, sentence, from, to, each = []], i) => {
    test(`${name} (${sentence})`, async () => {
      const edits = Array.isArray(from) ? from : [[from, to]];
      let edited = source;
      for (const [text, replacement] of edits) {
        assert.equal(source.split(text).length - 1, 1, `the text to edit occurs exactly once in ${module}.mjs`);
        edited = edited.replace(text, replacement);
      }
      const file = join(dir, `mutant-${i}.mjs`);
      writeFileSync(file, edited);
      const mutant = await import(pathToFileURL(file).href); // a mutant that does not load fails here
      const noticed = new Map(); // trace id -> the nodes that differed
      const broke = [];
      for (const trace of await usable) {
        try { const nodes = await differing(trace, { [module]: mutant }); if (nodes.size) noticed.set(trace.id, nodes); } catch (error) { broke.push(`${trace.id}: ${error.message}`); }
      }
      assert.ok(noticed.size > 0, `no canonical trace notices this mutant${broke.length ? `; the runner threw on ${broke.join("; ")}` : ""}`);
      const shows = (id, nodes, operator) => traces.find((trace) => trace.id === id).nodes.some((n) => n.op === operator && (nodes.has(n.id) || nodes.has(n.args?.into)));
      for (const operator of each) assert.ok([...noticed].some(([id, nodes]) => shows(id, nodes, operator)), `no sink of a ${operator} notices this mutant; noticed in ${[...noticed.keys()].join(", ")}`);
    });
  });
}
