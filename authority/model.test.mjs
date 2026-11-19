import assert from "node:assert/strict";
import test from "node:test";
import { buildAuthorityViews } from "./model.mjs";

const decision = (id, extra = {}) => ({ id, status: "locked", supersedes: [], ...extra });
const rule = (id, statement, extra = {}) => ({ id, revision: 1, area: "message", statement, rationale: "", introduced_by: ["D1"], activated_by: ["D1"], ...extra });

test("coverage is derived only from conformance forward covers", () => {
  const views = buildAuthorityViews({
    decisions: [decision("D1")],
    rules: [rule("R-a", "A")],
    conformance: [{ id: "C-1", covers: ["R-a"] }],
  });
  assert.deepEqual(views.currentProtocol.rules[0].conformance, ["C-1"]);
  assert.deepEqual(views.warnings, []);
  assert.equal(views.gateOk, true);
});

test("formal coverage is derived from model and config references", () => {
  const views = buildAuthorityViews({
    decisions: [decision("D1")],
    rules: [rule("R-a", "A"), rule("R-b", "B")],
    conformance: [],
    formalArtifacts: [
      { path: "formal/a.tla", source: "\\* pins R-a\n---- MODULE a ----" },
      { path: "formal/a.cfg", source: "\\* R-a" },
    ],
  });
  assert.deepEqual(views.currentProtocol.rules[0].formal, ["formal/a.cfg", "formal/a.tla"]);
  assert.deepEqual(views.currentProtocol.rules[1].formal, []);
  assert.equal(views.metrics.formalCoveragePending, 1);
});

test("formal artifacts may not reference an unknown rule", () => {
  const views = buildAuthorityViews({
    decisions: [decision("D1")],
    rules: [rule("R-a", "A")],
    conformance: [],
    formalArtifacts: [{ path: "formal/a.tla", source: "\\* pins R-missing" }],
  });
  assert.ok(views.errors.some((error) => error.includes("formal artifact formal/a.tla references unresolved rule R-missing")));
});

test("all current root protocol areas enter the public projection", () => {
  const views = buildAuthorityViews({
    decisions: [decision("D1")],
    rules: [rule("R-message", "message", { area: "message" }), rule("R-principle", "principle", { area: "principle" })],
    conformance: [],
  });
  assert.deepEqual(views.currentProtocol.rules.map((item) => item.id), ["R-message", "R-principle"]);
});

test("draft rules stay out of the public projection and remain an explicit review metric", () => {
  const views = buildAuthorityViews({
    decisions: [decision("D1")],
    rules: [rule("R-active", "active"), rule("R-draft", "draft", { activated_by: undefined })],
    conformance: [],
  });
  assert.deepEqual(views.currentProtocol.rules.map((item) => item.id), ["R-active"]);
  assert.deepEqual(views.currentProtocol.draftRules, ["R-draft@1"]);
  assert.equal(views.metrics.draftProtocolRules, 1);
  assert.ok(views.unresolvedConflicts.some((item) => item.kind === "draft-rule-activation-review"));
});

test("the gate rejects duplicate current statements and supersession cycles", () => {
  const views = buildAuthorityViews({
    decisions: [decision("D1", { supersedes: ["D2"] }), decision("D2", { supersedes: ["D1"] })],
    rules: [rule("R-a", "same"), rule("R-b", "same")],
    conformance: [],
  });
  assert.equal(views.gateOk, false);
  assert.ok(views.errors.some((error) => error.includes("supersession cycle")));
  assert.ok(views.errors.some((error) => error.includes("duplicate exact statement")));
});

test("legacy current set is derived while concern labels remain unresolved instead of guessed", () => {
  const views = buildAuthorityViews({ decisions: [decision("D1")], rules: [], conformance: [] });
  assert.equal(views.currentProductConstitution.state, "derived-current-set-with-unclassified-concerns");
  assert.deepEqual(views.currentProductConstitution.current, ["D1"]);
  assert.deepEqual(views.supersessionGraph.unclassified, ["D1"]);
});

test("execution approvals stay queryable but do not enter the current product constitution", () => {
  const views = buildAuthorityViews({
    decisions: [
      decision("D1", { __authority: { owner: "graphrefly", authority_class: "durable-root" } }),
      decision("D2", { __authority: { owner: "graphrefly", authority_class: "evaluation-execution" } }),
    ],
    rules: [],
    conformance: [],
  });
  assert.deepEqual(views.currentProductConstitution.current, ["D1"]);
  assert.deepEqual(views.supersessionGraph.unclassified, ["D1"]);
});

test("relocated D refs require an explicit locator-derived known-external id", () => {
  const withoutLocator = buildAuthorityViews({ decisions: [decision("D1", { supersedes: ["D9"] })], rules: [], conformance: [] });
  assert.ok(withoutLocator.errors.some((error) => error.includes("supersedes unresolved D9")));
  const withLocator = buildAuthorityViews({
    decisions: [decision("D1", { supersedes: ["D9"] })],
    knownExternalDecisionIds: ["D9"],
    rules: [],
    conformance: [],
  });
  assert.equal(withLocator.gateOk, true);
  assert.deepEqual(withLocator.supersessionGraph.relocatedExternalRefs, [{ from: "D1", to: "D9" }]);
});

test("current rules are grouped into parts by area", () => {
  const views = buildAuthorityViews({
    decisions: [decision("D1")],
    rules: [
      rule("R-wave", "wave", { area: "wave" }),
      rule("R-surface", "surface", { area: "graph" }),
      rule("R-bridge", "bridge", { area: "module" }),
      rule("R-clean", "clean", { area: "principle" }),
      rule("R-history", "history", { area: "module", activated_by: undefined }),
    ],
    conformance: [],
  });
  assert.deepEqual(views.currentProtocol.rules.map((item) => [item.id, item.part]), [
    ["R-wave", "kernel"],
    ["R-surface", "graph"],
    ["R-bridge", "module"],
    ["R-clean", "principle"],
  ]);
  assert.deepEqual(views.currentProtocol.parts, {
    kernel: ["R-wave@1"],
    graph: ["R-surface@1"],
    module: ["R-bridge@1"],
    principle: ["R-clean@1"],
  });
});

test("a scenario's level is the highest part among the current and draft rules it covers", () => {
  const views = buildAuthorityViews({
    decisions: [decision("D1")],
    rules: [
      rule("R-wave", "wave", { area: "wave" }),
      rule("R-clean", "clean", { area: "principle" }),
      rule("R-surface", "surface", { area: "graph" }),
      rule("R-bridge", "bridge", { area: "module" }),
      rule("R-history", "history", { area: "module", activated_by: undefined }),
      rule("R-old", "old", { area: "control", transition: { kind: "retire", by: "D1" } }),
    ],
    conformance: [
      { id: "C-1", covers: ["R-wave", "R-clean"] },
      { id: "C-2", covers: ["R-wave", "R-surface"] },
      { id: "C-3", covers: ["R-wave", "R-history"] },
      { id: "C-4", covers: ["R-history", "R-old"] },
      { id: "C-5", covers: ["R-old"] },
      { id: "C-6", covers: [] },
    ],
  });
  assert.deepEqual(views.currentProtocol.scenarioLevels, {
    kernel: ["C-1"],
    graph: ["C-2"],
    module: ["C-3", "C-4"],
    none: ["C-5", "C-6"],
  });
  assert.deepEqual(views.currentProtocol.scenariosWithoutCurrentRule, [
    { id: "C-4", draft: ["R-history"], notCurrent: ["R-old"] },
    { id: "C-5", draft: [], notCurrent: ["R-old"] },
    { id: "C-6", draft: [], notCurrent: [] },
  ]);
  assert.equal(views.metrics.scenariosWithoutCurrentRule, 3);
  assert.equal(views.gateOk, true);
});

test("a current rule that cites a rule of a higher part is listed, not refused", () => {
  const views = buildAuthorityViews({
    decisions: [decision("D1")],
    rules: [
      rule("R-domain", "Consistency across graphs is the bridge module's (R-bridge).", { area: "runtime" }),
      rule("R-surface", "observe subscribes as R-domain allows; rendering is R-render's.", { area: "graph" }),
      rule("R-bridge", "A bridge carries edges between graphs (R-domain, R-surface).", { area: "module" }),
      rule("R-render", "A renderer reads describe (R-surface).", { area: "module", activated_by: undefined }),
    ],
    conformance: [],
  });
  assert.deepEqual(views.currentProtocol.upwardCitations, [
    { from: "R-domain@1", part: "kernel", cites: "R-bridge", citedPart: "module" },
    { from: "R-surface@1", part: "graph", cites: "R-render", citedPart: "module" },
  ]);
  assert.equal(views.metrics.upwardRuleCitations, 2);
  assert.equal(views.gateOk, true);
});

test("a partially superseded decision still governs the concerns its successor does not list", () => {
  const root = { __authority: { owner: "graphrefly", authority_class: "durable-root" } };
  const views = buildAuthorityViews({
    decisions: [
      decision("D1", { ...root, concerns: ["a", "b"] }),
      decision("D2", { ...root, concerns: ["a", "c"], change_kind: "partial-supersession", supersedes: ["D1"] }),
      decision("D3", { ...root, concerns: ["d"] }),
      decision("D4", { ...root, concerns: ["d"], change_kind: "partial-supersession", supersedes: ["D3"] }),
      decision("D5", { ...root, concerns: ["e", "f"] }),
      decision("D6", { ...root, concerns: ["e"], change_kind: "full-supersession", supersedes: ["D5"] }),
      decision("D7", { ...root, concerns: ["g", "h"] }),
      decision("D8", { ...root, concerns: ["g"], supersedes: ["D7"] }),
      decision("D9", { ...root, concerns: ["i", "j", "k"] }),
      decision("D10", { ...root, concerns: ["i"], change_kind: "partial-supersession", supersedes: ["D9"] }),
      decision("D11", { ...root, concerns: ["j"], change_kind: "partial-supersession", supersedes: ["D9"] }),
    ],
    rules: [],
    conformance: [],
  });
  const constitution = views.currentProductConstitution;
  // D3 keeps nothing, D5 is replaced in full, and D7's successor does not say it is partial.
  assert.deepEqual(constitution.current, ["D1", "D2", "D4", "D6", "D8", "D9", "D10", "D11"]);
  assert.deepEqual(constitution.governors, { b: ["D1"], a: ["D2"], c: ["D2"], d: ["D4"], e: ["D6"], g: ["D8"], k: ["D9"], i: ["D10"], j: ["D11"] });
  assert.deepEqual(constitution.partiallySuperseded, [
    { id: "D1", by: ["D2"], governs: ["b"] },
    { id: "D9", by: ["D10", "D11"], governs: ["k"] },
  ]);
  assert.deepEqual(constitution.ambiguous, []);
  assert.equal(views.gateOk, true);
});
