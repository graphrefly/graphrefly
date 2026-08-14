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
