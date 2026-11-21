import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOperatorViews, loadOperatorLedgers } from "./operators.mjs";
import { operatorViews } from "./current-operators.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// The contracts in force. Activating a family adds its coordinates here, and nowhere else in this file.
const ACTIVE = ["O-common@1", "O-sample@1", "O-takeUntil@1", "O-buffer@1", "O-bufferCount@1", "O-map@1", "O-filter@1", "O-tap@1", "O-scan@1", "O-reduce@1",
  "O-distinctUntilChanged@1", "O-pairwise@1", "O-take@1", "O-skip@1", "O-takeWhile@1", "O-first@1", "O-last@1",
  "O-merge@1", "O-withLatestFrom@1", "O-zip@1", "O-concat@1", "O-race@1", "O-derived@1"];

const S = ["START"];
const trace = (over = {}) => ({
  id: "OT-1", name: "n", basis: "b", detail: "messages",
  nodes: [{ id: "s", state: [] }, { id: "m", op: "map", deps: ["s"] }],
  steps: [["subscribe", "k", "m"], ["invalidate", "s"]], expect: [[["k", "m", [S]]], []], ...over,
});
const contract = (over = {}) => ({ id: "O-map", revision: 1, family: "transform", operator: "map", use: "u", traces: [], exceptions: [{ topic: "invalidation", statement: "s", traces: ["OT-1"] }], cites: ["R-wave"], open: [], introduced_by: ["D813"], ...over });
const common = (over = {}) => ({ id: "O-common", revision: 1, family: "common", use: "u", traces: [], exceptions: [], cites: ["R-wave"], open: [], introduced_by: ["D813"], ...over });
const views = (contracts, traces = [trace()], more = {}) => buildOperatorViews({ contracts, traces, currentRuleIds: ["R-wave"], draftRuleIds: ["R-pause"], decisionIds: ["D1", "D813", "D900"], operatorDecisionIds: ["D813", "D900"], ...more });
const fails = (result, pattern) => assert.ok(result.errors.some((error) => pattern.test(error)), `expected ${pattern} in ${JSON.stringify(result.errors)}`);

test("the root's operator contract set passes its checks, and exactly the listed contracts are in force", () => {
  const result = operatorViews(root);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.active.map((row) => row.coordinate).sort(), [...ACTIVE].sort());
  assert.ok(result.active.length + result.drafts.length > 30);
  assert.deepEqual(result.review.unlinkedTraces, []);
});

test("the contract files hold no R-* id, the rule ledger names no contract, and a missing file is not an empty set", () => {
  const { contracts, traces } = loadOperatorLedgers(root);
  for (const row of [...contracts, ...traces]) assert.ok(!/^R-/.test(row.id), row.id);
  fails(views([contract()], [trace()], { rules: [{ id: "R-wave", revision: 3, statement: "as O-map says" }] }), /no rule cites an operator contract/);
  assert.deepEqual(views([contract()], [trace()], { rules: [{ id: "R-wave", revision: 2, statement: "as O-map says", transition: { kind: "revise", by: "D900" } }] }).errors, [], "a replaced revision is history");
  const copy = mkdtempSync(join(tmpdir(), "operators-"));
  try {
    cpSync(join(root, "operators"), join(copy, "operators"), { recursive: true });
    assert.equal(loadOperatorLedgers(copy).contracts.length, contracts.length);
    rmSync(join(copy, "operators", "contracts.jsonl"));
    assert.throws(() => loadOperatorLedgers(copy), /contracts\.jsonl is missing/);
  } finally { rmSync(copy, { recursive: true, force: true }); }
});

test("a well-formed draft passes; each broken link or shape is an error", () => {
  assert.deepEqual(views([contract()]).errors, []);
  fails(views([contract({ id: "R-map" })]), /never R-\*/);
  fails(views([contract({ exceptions: [{ topic: "invalidation", statement: "s", traces: ["OT-9"] }] })]), /trace OT-9 does not exist/);
  fails(views([contract({ operator: "filter" })]), /trace OT-1 has no filter node/);
  fails(views([contract({ exceptions: [{ topic: "ordering", statement: "s", traces: [] }] })]), /topic ordering/);
  fails(views([contract({ exceptions: [{ topic: "invalidation", statement: "a", traces: [] }, { topic: "invalidation", statement: "b", traces: [] }] })]), /one exception per topic/);
  fails(views([contract({ cites: ["R-gone"] })]), /cites R-gone/);
  fails(views([contract({ introduced_by: ["D7"] })]), /decision D7 does not resolve/);
  fails(views([contract({ introduced_by: ["D1"] })]), /decision D1 is not a decision on operator contracts/);
  fails(views([contract({ use: "" })]), /ordinary use is required/);
  fails(views([contract(), contract()]), /duplicate revision/);
  fails(views([contract(), contract({ revision: 2 })]), /more than one open contract/);
  fails(views([contract(), contract({ id: "O-map2" })]), /operator map has more than one open contract/);
});

test("a list that is missing or of another type is an error, not an empty list", () => {
  for (const key of ["traces", "exceptions", "cites", "open", "introduced_by"]) {
    const { [key]: _, ...without } = contract();
    fails(views([without]), new RegExp(`${key} is a list`));
  }
  fails(views([contract({ open: "a question" })]), /open is a list/);
  fails(views([contract({ exceptions: { invalidation: "s" } })]), /exceptions is a list/);
  fails(views([contract({ exceptions: [{ topic: "invalidation", statement: "s" }] })]), /invalidation traces is a list/);
  fails(views([common(), contract({ activated_by: "D813" })]), /activated_by is a list/);
});

test("a trace must be well formed, use only contract operators and helpers, and be able to fail", () => {
  fails(views([contract()], [trace({ id: "T-1" })]), /a trace id is OT-<number>/);
  fails(views([contract()], [trace({ expect: [[["k", "m", [S]]]] })]), /one expectation for each step/);
  fails(views([contract()], [trace({ expect: [[["k", "m"]], []] })]), /a list of \[sink, node, messages\]/);
  fails(views([contract()], [trace({ nodes: [{ id: "m", op: "map", deps: ["nope"] }] })]), /depends on unknown nope/);
  fails(views([contract()], [trace({ nodes: [{ id: "s", state: [] }, { id: "m", op: "map", deps: ["s"] }, { id: "x", op: "mapp", deps: ["s"] }] })]), /node x is a mapp, which is neither a contract's operator nor a trace helper/);
  assert.deepEqual(views([contract()], [trace({ nodes: [{ id: "s", state: [] }, { id: "o", op: "arrays", deps: ["s"] }, { id: "m", op: "map", deps: ["o"] }] })]).errors, [], "a helper node is allowed");
  fails(views([contract()], [trace({ steps: [["set", "s", 1], ["invalidate", "s"]], expect: [[], []] })]), /subscribes no sink or expects nothing/);
  fails(views([contract()], [trace({ expect: [[], []] })]), /subscribes no sink or expects nothing/);
  fails(views([contract()], [trace({ nodes: [{ id: "s", state: [1, 2] }, { id: "m", op: "map", deps: ["s"] }] })]), /state s holds at most one value/);
  const helperOnly = trace({ nodes: [{ id: "s", state: [] }, { id: "o", op: "arrays", deps: ["s"] }, { id: "m", op: "map", deps: ["o"] }], steps: [["subscribe", "k", "o"], ["invalidate", "s"]], expect: [[["k", "o", [S]]], []] });
  fails(views([contract()], [helperOnly]), /trace OT-1 subscribes no sink to its map or to a node after it/);
  const after = trace({ nodes: [{ id: "s", state: [] }, { id: "m", op: "map", deps: ["s"] }, { id: "o", op: "arrays", deps: ["m"] }], steps: [["subscribe", "k", "o"], ["invalidate", "s"]], expect: [[["k", "o", [S]]], []] });
  assert.deepEqual(views([contract()], [after]).errors, [], "a sink after the operator shows it");
  const inner = (op, args) => trace({ nodes: [{ id: "A", state: [1] }, { id: "s", state: [] }, { id: "m", op, deps: ["s"], ...(args && { args }) }], steps: [["subscribe", "k", "m"], ["set", "s", ["A"]], ["invalidate", "A"]], expect: [[["k", "m", [S]]], [], []] });
  assert.deepEqual(views([contract({ id: "O-switchMap", operator: "switchMap" })], [inner("switchMap", { project: "follow" })]).errors, [], "for an operator with a projector, a node named by a value written to its input is an input");
  fails(views([contract()], [inner("map")]), /no invalidate step on an input of its map/);
  fails(views([contract({ id: "O-arrays", operator: "arrays" })], [helperOnly]), /arrays is a trace helper, not an operator of the set/);
});

test("a trace linked from an exception must hold a step of that topic", () => {
  const steps = (last) => ({ steps: [["subscribe", "k", "m"], last], expect: [[["k", "m", [S]]], []] });
  const linked = (topic, last) => views([contract({ exceptions: [{ topic, statement: "s", traces: ["OT-1"] }] })], [trace(steps(last))]);
  fails(linked("invalidation", ["set", "s", 1]), /no invalidate step on an input of its map while a sink shows it, so it cannot show the invalidation exception/);
  fails(linked("recovery", ["set", "s", 1]), /no restore step/);
  fails(linked("completion", ["set", "s", 1]), /no complete or error step on an input of its map/);
  // In order: the step must come while a sink of the operator is subscribed, and a restore between two such subscriptions.
  const ordered = (topic, list) => views([contract({ exceptions: [{ topic, statement: "s", traces: ["OT-1"] }] })], [trace({ steps: list, expect: list.map((step) => (step[0] === "subscribe" ? [["k", "m", [S]]] : [])) })]);
  fails(ordered("invalidation", [["invalidate", "s"], ["subscribe", "k", "m"]]), /no invalidate step on an input of its map while a sink shows it/);
  fails(ordered("invalidation", [["subscribe", "k", "m"], ["unsubscribe", "k", "m"], ["invalidate", "s"]]), /while a sink shows it/);
  fails(ordered("recovery", [["restore"], ["subscribe", "k", "m"]]), /no restore step while a sink shows it/);
  fails(ordered("recovery", [["subscribe", "k", "m"], ["restore"]]), /no restore step while a sink shows it/);
  assert.deepEqual(ordered("recovery", [["subscribe", "k", "m"], ["restore"], ["subscribe", "k", "m"]]).errors, []);
  // Per node: the step and the sink must be of the same node of the operator.
  const twoMaps = (list) => trace({ nodes: [{ id: "s", state: [] }, { id: "s2", state: [] }, { id: "m", op: "map", deps: ["s"] }, { id: "m2", op: "map", deps: ["s2"] }], steps: list, expect: list.map((step) => (step[0] === "subscribe" ? [["k", step[2], [S]]] : [])) });
  const perNode = (topic, list) => views([contract({ exceptions: [{ topic, statement: "s", traces: ["OT-1"] }] })], [twoMaps(list)]);
  fails(perNode("invalidation", [["subscribe", "k", "m2"], ["invalidate", "s"]]), /no invalidate step on an input of its map while a sink shows it/);
  assert.deepEqual(perNode("invalidation", [["subscribe", "k", "m2"], ["invalidate", "s2"]]).errors, []);
  fails(perNode("recovery", [["subscribe", "k", "m"], ["restore"], ["subscribe", "k", "m2"]]), /no restore step while a sink shows it/);
  fails(views([contract()], [trace({ steps: [["subscribe", "k", "m"], ["batch", [["invalidate", "s"], ["restore"]]]] })]), /a restore is a step of its own/);
  const elsewhere = { nodes: [{ id: "s", state: [] }, { id: "other", state: [1] }, { id: "o", op: "arrays", deps: ["s"] }, { id: "m", op: "map", deps: ["o"] }] };
  const on = (topic, last) => views([contract({ exceptions: [{ topic, statement: "s", traces: ["OT-1"] }] })], [trace({ ...elsewhere, ...steps(last) })]);
  fails(on("invalidation", ["invalidate", "other"]), /no invalidate step on an input of its map/);
  assert.deepEqual(on("invalidation", ["invalidate", "s"]).errors, [], "an input however far up counts");
  assert.deepEqual(linked("completion", ["batch", [["set", "s", 1], ["error", "s", "boom"]]]).errors, [], "a step inside a batch counts");
  fails(linked("recovery", ["restore"]), /no restore step while a sink shows it/);
  assert.deepEqual(linked("same-wave", ["set", "s", 1]).errors, [], "same-wave needs no particular step");
});

test("a revised contract leaves one open revision, and its transition must name a revision that exists", () => {
  const result = views([contract({ transition: { kind: "revise", by: "D900", to: { id: "O-map", revision: 2 } } }), contract({ revision: 2 })]);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.drafts.map((row) => row.coordinate), ["O-map@2"]);
  fails(views([contract({ transition: { kind: "revise", by: "D900", to: { id: "O-map", revision: 7 } } })]), /names a revision that does not exist/);
  fails(views([contract({ transition: { kind: "retire", by: "D1" } })]), /transition decision D1 is not a decision on operator contracts/);
  assert.ok(!views([contract({ transition: { kind: "retire", by: "D900" } })]).errors.some((error) => /transition/.test(error)), "a retirement names no successor");
});

test("a draft may lack traces, hold open questions and cite a draft rule; an active contract may not", () => {
  const loose = { exceptions: [{ topic: "invalidation", statement: "s", traces: [] }], open: ["q"], cites: ["R-pause"] };
  const draft = views([contract(loose)]);
  assert.deepEqual(draft.errors, []);
  assert.deepEqual(draft.review.draftExceptionsWithoutTrace, ["O-map@1 invalidation"]);
  assert.deepEqual(draft.review.draftsWithoutAnyTrace, ["O-map@1"]);
  assert.deepEqual(draft.review.openQuestions, [{ contract: "O-map@1", question: "q" }]);
  assert.deepEqual(draft.review.draftsCitingDraftRules, ["O-map@1 cites R-pause"]);
  assert.deepEqual(draft.review.unlinkedTraces, ["OT-1"]);
  const on = { activated_by: ["D813"], traces: ["OT-1"] };
  const active = views([common(on), contract({ ...loose, ...on })]);
  fails(active, /invalidation has no canonical trace/);
  fails(active, /has open questions/);
  fails(active, /cites R-pause, which is not a current rule/);
  fails(views([common(on), contract({ exceptions: [], ...on, traces: [] })]), /active contract O-map@1: has no canonical trace/);
  fails(views([common({ ...on, traces: [] }), contract(on)]), /active contract O-common@1: has no canonical trace/);
  fails(views([common(on), contract(on)], [trace({ detail: "occurrences", expect: [[], [["k", "m", [["INVALIDATE"]]]]] })]), /trace OT-1 is not at message detail/);
  fails(views([common(on), contract({ activated_by: ["D1"] })]), /activating decision D1 is not a decision on operator contracts/);
  fails(views([common(), contract(on)]), /O-common@1 is a draft while O-map@1 is active/);
  const complete = views([common(on), contract(on)]);
  assert.deepEqual(complete.errors, []);
  assert.deepEqual(complete.active.map((row) => row.coordinate), ["O-common@1", "O-map@1"]);
});
