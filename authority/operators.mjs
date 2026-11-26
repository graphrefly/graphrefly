// The operator contract set of graphrefly:D813: operators/contracts.jsonl and operators/traces.jsonl.
// It is kept apart from the protocol rules. Its ids are O-* and OT-*, never R-*, nothing here enters
// the public protocol projection, and model.mjs does not read these files. A contract may cite a rule;
// no rule cites a contract. Lifecycle is derived as a rule's is: a contract revision is active when it
// has activated_by and no transition, and a draft when it has neither.
//
// The gate holds links and shape. That a trace is run and passes is held where the traces are run:
// reference/operators/traces.test.mjs fails when a trace of an active contract is skipped or is a
// known difference. What is immutable on an active contract on main is graphrefly:D816's to say, and
// immutable.mjs holds it against main. A trace that was succeeded keeps its row with `succeeded_by`
// and, under `succeeded_under`, the decision of the succession:
// only a revision that has a transition links it, it is not reported as unlinked, and it is not run.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadJsonl } from "./model.mjs";

export const TOPICS = Object.freeze(["same-wave", "completion", "invalidation", "recovery"]);
export const TRACE_DETAILS = Object.freeze(["messages", "occurrences"]);
// Nodes a trace may use that are not operators of the set: they only shape the input.
export const TRACE_HELPERS = Object.freeze(["arrays", "empty", "once"]);
// A step a trace must hold to show an exception of the topic. same-wave has none: several inputs
// can meet in one wave without a batch, as a node and what it is derived from do.
const TOPIC_STEPS = Object.freeze({ invalidation: ["invalidate"], recovery: ["restore"], completion: ["complete", "error"] });

const CONTRACT_ID = /^O-[A-Za-z][A-Za-z0-9]*$/;
const TRACE_ID = /^OT-[1-9][0-9]*$/;
const list = (value) => (Array.isArray(value) ? value : []);
const text = (value) => typeof value === "string" && value.trim().length > 0;
const flatSteps = (steps) => list(steps).flatMap((step) => (list(step)[0] === "batch" ? [step, ...flatSteps(step[1])] : [step]));

export function loadOperatorLedgers(root) {
  const files = { contracts: join(root, "operators", "contracts.jsonl"), traces: join(root, "operators", "traces.jsonl") };
  for (const file of Object.values(files)) if (!existsSync(file)) throw new Error(`operator contract set: ${file} is missing`);
  return { contracts: loadJsonl(files.contracts), traces: loadJsonl(files.traces) };
}

// currentRuleIds and draftRuleIds are rule ids (R-wave), as buildAuthorityViews derives them.
// decisionIds are the root ledger's decision ids; operatorDecisionIds are those among them that
// govern operator contracts (a concern under `operators.`), and default to all of them.
export function buildOperatorViews({ contracts, traces, rules = [], currentRuleIds = [], draftRuleIds = [], decisionIds = [], operatorDecisionIds = decisionIds }) {
  const errors = [];
  const current = new Set(currentRuleIds);
  const draft = new Set(draftRuleIds);
  const decisions = new Set(decisionIds);
  const governing = new Set(operatorDecisionIds);
  const decision = (at, id, role) => {
    if (!decisions.has(id)) errors.push(`${at}: ${role} ${id} does not resolve`);
    else if (!governing.has(id)) errors.push(`${at}: ${role} ${id} is not a decision on operator contracts`);
  };
  const coordinate = (row) => `${row.id}@${row.revision}`;
  const open = contracts.filter((row) => !row.transition); // revisions without a transition
  const operators = new Set(open.map((row) => row.operator).filter(text));

  const traceById = new Map();
  for (const trace of traces) {
    const at = `trace ${trace.id}`;
    if (!TRACE_ID.test(trace.id ?? "")) errors.push(`${at}: a trace id is OT-<number>`);
    if (traceById.has(trace.id)) errors.push(`${at}: duplicate id`);
    traceById.set(trace.id, trace);
    if (!text(trace.name) || !text(trace.basis)) errors.push(`${at}: name and basis are required`);
    if (trace.succeeded_by !== undefined && (trace.succeeded_by === trace.id || !traces.some((other) => other.id === trace.succeeded_by))) errors.push(`${at}: succeeded_by names ${trace.succeeded_by}, which is not another trace of the ledger`);
    // A succession names its decision, as a transition does; immutable.mjs asks that it is a locked
    // row the same change adds.
    if (trace.succeeded_by !== undefined && trace.succeeded_under === undefined) errors.push(`${at}: a succeeded trace names the decision of its succession under succeeded_under`);
    else if (trace.succeeded_by !== undefined) decision(at, trace.succeeded_under, "succession decision");
    else if (trace.succeeded_under !== undefined) errors.push(`${at}: succeeded_under without succeeded_by`);
    if (!TRACE_DETAILS.includes(trace.detail)) errors.push(`${at}: detail is one of ${TRACE_DETAILS.join(", ")}`);
    const ids = list(trace.nodes).map((node) => node.id);
    if (!ids.length || new Set(ids).size !== ids.length) errors.push(`${at}: nodes need distinct ids`);
    for (const node of list(trace.nodes)) {
      if (Array.isArray(node.state) === text(node.op)) errors.push(`${at}: node ${node.id} is either a state or an operator`);
      if (list(node.state).length > 1) errors.push(`${at}: state ${node.id} holds at most one value`);
      if (text(node.op) && !operators.has(node.op) && !TRACE_HELPERS.includes(node.op)) errors.push(`${at}: node ${node.id} is a ${node.op}, which is neither a contract's operator nor a trace helper`);
      for (const dep of list(node.deps)) if (!ids.includes(dep)) errors.push(`${at}: node ${node.id} depends on unknown ${dep}`);
    }
    if (!Array.isArray(trace.steps) || !Array.isArray(trace.expect) || !trace.steps.length || trace.steps.length !== trace.expect.length) {
      errors.push(`${at}: one expectation for each step`);
    }
    const received = list(trace.expect).flat();
    if (list(trace.expect).some((step) => !Array.isArray(step)) || received.some((entry) => !Array.isArray(entry) || entry.length !== 3 || !Array.isArray(entry[2]) || !entry[2].length)) {
      errors.push(`${at}: an expectation is a list of [sink, node, messages]`);
    }
    if (list(trace.steps).some((step) => list(step)[0] === "batch" && flatSteps(step[1]).some((inner) => inner[0] === "restore"))) errors.push(`${at}: a restore is a step of its own, not part of a batch`);
    // A replace gives an operator node of the trace a new instance over nodes of the trace.
    for (const [kind, id, deps] of flatSteps(trace.steps)) {
      if (kind !== "replace") continue;
      if (!list(trace.nodes).some((node) => node.id === id && text(node.op))) errors.push(`${at}: a replace step names ${id}, which is not an operator node of the trace`);
      if (!Array.isArray(deps) || deps.some((dep) => !ids.includes(dep))) errors.push(`${at}: the replace of ${id} names a dependency the trace does not have`);
    }
    // A trace that subscribes nothing, or expects nothing anywhere, would pass on any implementation.
    if (!flatSteps(trace.steps).some((step) => step[0] === "subscribe") || !received.length) errors.push(`${at}: subscribes no sink or expects nothing`);
  }
  const stepsOf = (trace) => new Set(flatSteps(trace.steps).map((step) => step[0]));
  // The nodes of an operator in a trace, and everything they depend on, however far.
  const nodesOf = (trace, operator) => list(trace.nodes).filter((node) => node.op === operator).map((node) => node.id);
  // A higher-order operator reaches a node through a value that names it: a state's first value, or
  // one a step writes to a state it already reaches. Those nodes count as its inputs too.
  const named = (value, ids, found = []) => {
    if (typeof value === "string" && ids.has(value)) found.push(value);
    else if (Array.isArray(value)) for (const item of value) named(item, ids, found);
    return found;
  };
  const reach = (trace, ids) => {
    const byId = new Map(list(trace.nodes).map((node) => [node.id, node]));
    // Only an operator that takes a projector reaches nodes by name.
    const all = ids.some((id) => byId.get(id)?.args?.project) ? new Set(byId.keys()) : new Set();
    const seenIds = new Set();
    const walk = (id) => {
      if (seenIds.has(id)) return;
      seenIds.add(id);
      for (const dep of list(byId.get(id)?.deps)) walk(dep);
      for (const other of named(list(byId.get(id)?.state), all)) walk(other);
    };
    ids.forEach(walk);
    for (let grew = true; grew;) {
      grew = false;
      for (const step of flatSteps(trace.steps)) {
        // What a replace makes a reached node depend on is reached too.
        if (step[0] === "replace" && seenIds.has(step[1])) for (const dep of list(step[2])) if (!seenIds.has(dep)) { walk(dep); grew = true; }
        if (step[0] !== "set" || !seenIds.has(step[1])) continue;
        for (const other of named(step[2], all)) if (!seenIds.has(other)) { walk(other); grew = true; }
      }
    }
    return seenIds;
  };

  const seen = new Set();
  for (const row of contracts) {
    const at = `contract ${row.id}@${row.revision}`;
    if (!CONTRACT_ID.test(row.id ?? "")) errors.push(`${at}: a contract id is O-<name>, never R-*`);
    if (!Number.isInteger(row.revision) || row.revision < 1) errors.push(`${at}: revision is a positive integer`);
    if (seen.has(at)) errors.push(`${at}: duplicate revision`);
    seen.add(at);
    // A missing or mistyped list would read as an empty one and pass every check below.
    for (const key of ["traces", "exceptions", "cites", "open", "introduced_by"]) if (!Array.isArray(row[key])) errors.push(`${at}: ${key} is a list`);
    if (row.activated_by !== undefined && !Array.isArray(row.activated_by)) errors.push(`${at}: activated_by is a list`);
    if (!text(row.family)) errors.push(`${at}: family is required`);
    if (row.family === "common" ? row.operator !== undefined : !text(row.operator)) errors.push(`${at}: operator is required, except in the common family`);
    if (TRACE_HELPERS.includes(row.operator)) errors.push(`${at}: ${row.operator} is a trace helper, not an operator of the set`);
    if (!text(row.use)) errors.push(`${at}: the ordinary use is required`);
    const topics = list(row.exceptions).map((item) => item.topic);
    if (new Set(topics).size !== topics.length) errors.push(`${at}: one exception per topic`);
    const link = (id, topic) => {
      const trace = traceById.get(id);
      if (!trace) { errors.push(`${at}: trace ${id} does not exist`); return; }
      if (trace.succeeded_by !== undefined && !row.transition) errors.push(`${at}: trace ${id} was succeeded by ${trace.succeeded_by}; only a revision that has a transition links it`);
      const own = row.operator ? nodesOf(trace, row.operator) : [];
      const steps = flatSteps(trace.steps);
      if (row.operator && !own.length) errors.push(`${at}: trace ${id} has no ${row.operator} node`);
      // A trace shows an operator only through a sink of it, or of a node that depends on it.
      else if (row.operator && !steps.some((step) => step[0] === "subscribe" && own.some((node) => reach(trace, [step[2]]).has(node)))) errors.push(`${at}: trace ${id} subscribes no sink to its ${row.operator} or to a node after it`);
      if (!TOPIC_STEPS[topic]) return;
      const kinds = TOPIC_STEPS[topic];
      // An invalidate, complete or error must be of something the operator depends on, made while a
      // sink of the operator, or of a node after it, is subscribed. A restore is of the whole
      // graph: it counts when such a sink was subscribed before it and one is again after it.
      // One node of the operator at a time: the step and the sink must be of the same node.
      const showsFor = (mine) => {
        const within = mine !== null && topic !== "recovery" ? reach(trace, [mine]) : null;
        const sinkOf = (node) => mine === null || reach(trace, [node]).has(mine);
        const live = new Set();
        let restored = false;
        let shown = false;
        for (const [kind, a, b] of steps) {
          if (kind === "subscribe" && sinkOf(b)) { live.add(`${a}\u0000${b}`); if (restored) shown = true; }
          else if (kind === "unsubscribe") live.delete(`${a}\u0000${b}`);
          else if (kind === "restore") { restored = restored || (topic === "recovery" && live.size > 0); live.clear(); }
          else if (topic !== "recovery" && kinds.includes(kind) && live.size > 0 && (!within || within.has(a))) shown = true;
        }
        return shown;
      };
      if (!(row.operator ? own : [null]).some(showsFor)) {
        errors.push(`${at}: trace ${id} has no ${kinds.join(" or ")} step${row.operator && topic !== "recovery" ? ` on an input of its ${row.operator}` : ""} while a sink shows it, so it cannot show the ${topic} exception`);
      }
    };
    for (const id of list(row.traces)) link(id, null);
    for (const item of list(row.exceptions)) {
      if (!TOPICS.includes(item.topic)) errors.push(`${at}: topic ${item.topic} is not one of ${TOPICS.join(", ")}`);
      if (!text(item.statement)) errors.push(`${at}: ${item.topic} has no statement`);
      if (!Array.isArray(item.traces)) errors.push(`${at}: ${item.topic} traces is a list`);
      for (const id of list(item.traces)) link(id, item.topic);
    }
    for (const id of list(row.cites)) if (!current.has(id) && !draft.has(id)) errors.push(`${at}: cites ${id}, which is neither a current nor a draft rule`);
    if (!list(row.introduced_by).length) errors.push(`${at}: introduced_by is required`);
    for (const id of list(row.introduced_by)) decision(at, id, "decision");
    for (const id of list(row.activated_by)) decision(at, id, "activating decision");
    if (row.transition) {
      if (!["revise", "replace", "retire"].includes(row.transition.kind)) errors.push(`${at}: transition kind ${row.transition.kind}`);
      decision(at, row.transition.by, "transition decision");
      const to = row.transition.to;
      if (row.transition.kind !== "retire" && !contracts.some((other) => to && other.id === to.id && other.revision === to.revision)) errors.push(`${at}: its transition names a revision that does not exist`);
    }
  }

  for (const key of ["id", "operator"]) {
    const groups = Map.groupBy(open.filter((row) => row[key] !== undefined), (row) => row[key]);
    for (const [value, rows] of groups) if (rows.length > 1) errors.push(`${key} ${value} has more than one open contract: ${rows.map(coordinate).join(", ")}`);
  }

  const isActive = (row) => list(row.activated_by).length > 0;
  const active = open.filter(isActive);
  const drafts = open.filter((row) => !isActive(row));
  const linksOf = (row) => [...list(row.traces), ...list(row.exceptions).flatMap((item) => list(item.traces))];
  // An active contract is complete: it has a trace, every exception has its own, each at message
  // detail, nothing is open, and it stands on current rules and on an active common reading.
  for (const row of active) {
    const at = `active contract ${coordinate(row)}`;
    if (!linksOf(row).length) errors.push(`${at}: has no canonical trace`);
    for (const item of list(row.exceptions)) if (!list(item.traces).length) errors.push(`${at}: ${item.topic} has no canonical trace`);
    for (const id of new Set(linksOf(row))) if (traceById.get(id) && traceById.get(id).detail !== "messages") errors.push(`${at}: trace ${id} is not at message detail`);
    if (list(row.open).length) errors.push(`${at}: has open questions`);
    for (const id of list(row.cites)) if (!current.has(id)) errors.push(`${at}: cites ${id}, which is not a current rule`);
  }
  if (active.length) for (const row of drafts.filter((item) => item.family === "common")) errors.push(`${coordinate(row)} is a draft while ${coordinate(active[0])} is active: every contract is read with the common family`);

  // No rule cites a contract (D813). Only rule revisions without a transition are read.
  const names = new Set([...contracts.map((row) => row.id), ...traces.map((trace) => trace.id)]);
  for (const rule of rules.filter((row) => !row.transition)) {
    for (const token of String(rule.statement ?? "").match(/\bOT?-[A-Za-z0-9]+/g) ?? []) {
      if (names.has(token)) errors.push(`rule ${rule.id}@${rule.revision} cites ${token}: no rule cites an operator contract`);
    }
  }

  const linked = new Set(open.flatMap(linksOf));
  const view = (row) => ({
    id: row.id, revision: row.revision, coordinate: coordinate(row), family: row.family, operator: row.operator ?? null,
    lifecycle: isActive(row) ? "active" : "draft",
    use: row.use, traces: list(row.traces), exceptions: list(row.exceptions).map((item) => ({ ...item, traces: list(item.traces) })), cites: list(row.cites), open: list(row.open),
    decisions: [...list(row.introduced_by), ...list(row.activated_by)],
  });
  const families = [...new Set(open.map((row) => row.family))];
  return {
    errors,
    families,
    active: active.map(view),
    drafts: drafts.map(view),
    traces,
    // For review; none of these fails the gate while the contract is a draft.
    review: {
      draftExceptionsWithoutTrace: drafts.flatMap((row) => list(row.exceptions).filter((item) => !list(item.traces).length).map((item) => `${coordinate(row)} ${item.topic}`)),
      draftsWithoutAnyTrace: drafts.filter((row) => row.operator && !linksOf(row).length).map(coordinate),
      openQuestions: open.flatMap((row) => list(row.open).map((question) => ({ contract: coordinate(row), question }))),
      draftsCitingDraftRules: drafts.flatMap((row) => list(row.cites).filter((id) => !current.has(id)).map((id) => `${coordinate(row)} cites ${id}`)),
      unlinkedTraces: traces.filter((trace) => trace.succeeded_by === undefined && !linked.has(trace.id)).map((trace) => trace.id),
    },
    metrics: { families: families.length, active: active.length, drafts: drafts.length, traces: traces.length },
  };
}
