#!/usr/bin/env node
// GraphReFly internal dashboard generator.
// jsonl (single source of truth) -> data model -> consistency check -> dashboard.html
// UI is a PLACEHOLDER shell; styling/interaction is a separate /frontend-design pass.
// Run: node dashboard/build.mjs        (writes dashboard/dashboard.html)
//      node dashboard/build.mjs --check (report only; non-zero exit on broken links)

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

function loadJsonl(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l, i) => {
      try {
        return JSON.parse(l);
      } catch (e) {
        throw new Error(`${rel}:${i + 1} invalid JSON: ${e.message}`);
      }
    });
}

const model = {
  decisions: loadJsonl("decisions/decisions.jsonl"),
  phases: loadJsonl("plan/phases.jsonl"),
  backlog: loadJsonl("plan/backlog.jsonl"),
  antipatterns: loadJsonl("plan/antipatterns.jsonl"),
  rules: loadJsonl("spec/rules.jsonl"),
  conformance: loadJsonl("spec/conformance.jsonl"),
  flowcharts: loadJsonl("spec/flowcharts.jsonl"),
  sessions: loadJsonl("sessions/sessions.jsonl"),
  guide: loadJsonl("guide/guide.jsonl"),
};

function dogfoodRef(kind, id, metadata) {
  return metadata === undefined ? { kind, id } : { kind, id, metadata };
}

function createDogfoodPayload() {
  const now = 1_000;
  const providerId = "dashboard-fake-provider";
  const policyId = "dashboard-bounded-policy";
  const effectKind = "dashboard-dogfood-tool";
  const selectedWorkItemId = "wi-board-query";
  const workItems = [
    {
      kind: "work-item",
      workItemId: "wi-csp8-spine",
      label: "CSP-8 evidence spine",
      summary: "Effect request, agent request, adapter input, run result, evidence mapping.",
      lane: "complete",
      progress: 100,
      x: 120,
      y: 80,
      sourceRefs: [dogfoodRef("csp-8-dashboard", "wi-csp8-spine")],
    },
    {
      kind: "work-item",
      workItemId: "wi-provider-success",
      label: "Provider-neutral success",
      summary: "Fake bounded provider result becomes ExecutorOutcome and WorkItem evidence.",
      lane: "complete",
      progress: 100,
      x: 360,
      y: 110,
      sourceRefs: [dogfoodRef("csp-8-dashboard", "wi-provider-success")],
    },
    {
      kind: "work-item",
      workItemId: "wi-policy-failure",
      label: "Policy issue path",
      summary: "Failure carries bounded DataIssue/audit, with no raw provider payload.",
      lane: "blocked",
      progress: 52,
      x: 600,
      y: 90,
      sourceRefs: [dogfoodRef("csp-8-dashboard", "wi-policy-failure")],
    },
    {
      kind: "work-item",
      workItemId: "wi-human-approval",
      label: "Approval blocked run",
      summary: "Blocked tool run exposes needs and audit without mutating WorkItems.",
      lane: "blocked",
      progress: 38,
      x: 520,
      y: 260,
      sourceRefs: [dogfoodRef("csp-8-dashboard", "wi-human-approval")],
    },
    {
      kind: "work-item",
      workItemId: "wi-board-query",
      label: "Dashboard board query",
      summary: "Ready adapter input waits for a visible run request from the UI.",
      lane: "running",
      progress: 64,
      x: 285,
      y: 300,
      sourceRefs: [dogfoodRef("csp-8-dashboard", "wi-board-query")],
    },
    {
      kind: "work-item",
      workItemId: "wi-domain-action",
      label: "Domain action proposal",
      summary: "User proposal and approval are graph-visible WorkItem action facts.",
      lane: "queued",
      progress: 22,
      x: 90,
      y: 260,
      sourceRefs: [dogfoodRef("csp-8-dashboard", "wi-domain-action")],
    },
  ];
  const dependencies = [
    ["wi-csp8-spine", "wi-provider-success", "feeds"],
    ["wi-csp8-spine", "wi-policy-failure", "shares policy"],
    ["wi-provider-success", "wi-board-query", "unblocks UI"],
    ["wi-policy-failure", "wi-human-approval", "requires review"],
    ["wi-board-query", "wi-domain-action", "drives action"],
    ["wi-human-approval", "wi-domain-action", "needs approval"],
  ].map(([fromWorkItemId, toWorkItemId, label]) => ({
    kind: "work-item-dependency",
    fromWorkItemId,
    toWorkItemId,
    label,
  }));
  const effectItems = workItems.slice(1, 5);
  const effectRequests = effectItems.map((item) => ({
    kind: "work-item-effect-requested",
    requestId: `${item.workItemId}:effect-request`,
    workItemId: item.workItemId,
    effectRunId: `${item.workItemId}:effect-run`,
    effectKind,
    executionInputRevision: 1,
    planId: "dashboard-evidence-plan",
    planMemberId: "tool-member",
    agentRunId: `${item.workItemId}:agent-run`,
    goal: { kind: effectKind, summary: item.summary },
    sourceRefs: [dogfoodRef("work-item", item.workItemId)],
  }));
  const agentRequests = effectRequests.map((request) => ({
    kind: "issued",
    requestId: `${request.workItemId}:tool-request`,
    operationId: `${request.workItemId}:tool-op`,
    effectRunId: request.effectRunId,
    agentRunId: request.agentRunId,
    requestKind: "executor",
    required: true,
    input: {
      inputId: `${request.workItemId}:tool-input`,
      inputKind: "tool-call",
      dataMode: "inline",
      value: {
        kind: "tool-call",
        toolName: request.workItemId === "wi-policy-failure" ? "file.edit/apply-patch" : "file.read",
        operation: request.workItemId === "wi-policy-failure" ? "apply-patch" : "read",
        arguments: { path: "bounded-fixture.md" },
      },
      subjectRefs: [dogfoodRef("work-item", request.workItemId)],
    },
    sourceRefs: [dogfoodRef("work-item-effect-requested", request.requestId)],
  }));
  const executorProfiles = [
    {
      kind: "executor-profile",
      executorId: providerId,
      profileId: "dashboard-local-builtin-profile",
      providerId,
      inputKinds: ["tool-call"],
      toolNames: ["file.read", "file.edit/apply-patch"],
      policyRefs: [dogfoodRef("tool-provider-execution-policy", policyId)],
      sourceRefs: [dogfoodRef("tool-provider-catalog", "dashboard-local-builtin")],
    },
  ];
  const executorRoutes = agentRequests.map((request) => ({
    kind: "executor-route",
    routeId: `${request.requestId}:route`,
    requestId: request.requestId,
    operationId: request.operationId,
    inputId: request.input.inputId,
    inputKind: "tool-call",
    executorId: providerId,
    profileId: executorProfiles[0].profileId,
    policyRefs: [dogfoodRef("tool-provider-execution-policy", policyId)],
    sourceRefs: [
      dogfoodRef("agent-request", request.requestId),
      dogfoodRef("executor-profile", executorProfiles[0].profileId),
    ],
  }));
  const adapterInputs = agentRequests.map((request) => ({
    kind: "tool-provider-adapter-input",
    adapterInputId: `${request.requestId}:adapter-input`,
    requestId: request.requestId,
    operationId: request.operationId,
    providerId,
    status: "ready",
    input: request.input,
    routeId: `${request.requestId}:route`,
    profileId: executorProfiles[0].profileId,
    policyRefs: [dogfoodRef("tool-provider-execution-policy", policyId)],
    sourceRefs: [
      dogfoodRef("agent-request", request.requestId),
      dogfoodRef("executor-route", `${request.requestId}:route`),
      dogfoodRef("executor-profile", executorProfiles[0].profileId),
      dogfoodRef("tool-provider-execution-policy", policyId),
    ],
  }));
  const seededRunInputs = adapterInputs.filter((input) => !input.requestId.includes("wi-board-query"));
  const runRequests = seededRunInputs.map((input) => ({
    kind: "tool-provider-adapter-run-requested",
    runId: `${input.requestId}:seed-run:1`,
    adapterInputId: input.adapterInputId,
    requestId: input.requestId,
    operationId: input.operationId,
    attempt: 1,
    reason: "initial",
    requestedAtMs: now + 5,
    sourceRefs: [dogfoodRef("seed", input.adapterInputId)],
  }));
  const outcomes = runRequests.map((request) => {
    const workItemId = request.requestId.replace(":tool-request", "");
    if (workItemId === "wi-policy-failure") {
      return {
        kind: "failure",
        outcomeId: `${request.runId}:outcome`,
        requestId: request.requestId,
        operationId: request.operationId,
        occurredAtMs: now + 6,
        error: {
          kind: "issue",
          code: "fake-policy-denied",
          message: "Fake policy denied write expansion; bounded public issue only.",
          severity: "error",
          subjectId: workItemId,
        },
        retryable: false,
        evidenceRefs: [dogfoodRef("work-item", workItemId), dogfoodRef("tool-provider-adapter-run", request.runId)],
        metadata: { runId: request.runId, publicSummary: "policy-denied" },
      };
    }
    if (workItemId === "wi-human-approval") {
      return {
        kind: "blocked",
        outcomeId: `${request.runId}:outcome`,
        requestId: request.requestId,
        operationId: request.operationId,
        occurredAtMs: now + 6,
        needs: [{ kind: "approval", message: "Human approval required before patch." }],
        evidenceRefs: [dogfoodRef("work-item", workItemId), dogfoodRef("tool-provider-adapter-run", request.runId)],
        metadata: { runId: request.runId, publicSummary: "approval-needed" },
      };
    }
    return {
      kind: "result",
      outcomeId: `${request.runId}:outcome`,
      requestId: request.requestId,
      operationId: request.operationId,
      occurredAtMs: now + 6,
      result: {
        kind: "tool-output",
        summary: "Fake bounded provider-neutral result.",
        value: { ok: true, bounded: true, requestId: request.requestId },
        refs: [dogfoodRef("artifact", `${request.requestId}:bounded-summary`)],
        metadata: { resultKind: "bounded-dashboard-fixture" },
      },
      usage: { latencyMs: 7 },
      evidenceRefs: [dogfoodRef("work-item", workItemId), dogfoodRef("tool-provider-adapter-run", request.runId)],
      metadata: { runId: request.runId, publicSummary: "success" },
    };
  });
  const resultStatus = (kind) => (kind === "result" ? "completed" : kind === "failure" ? "failed" : kind);
  const effectResults = outcomes.map((outcome) => {
    const workItemId = outcome.requestId.replace(":tool-request", "");
    return {
      kind: "effect-run-result",
      resultId: `${workItemId}:effect-run:${outcome.outcomeId}:result`,
      effectRunId: `${workItemId}:effect-run`,
      status: resultStatus(outcome.kind),
      operationId: outcome.operationId,
      subjectRefs: [dogfoodRef("work-item", workItemId)],
      sourceRefs: [
        dogfoodRef("executor-outcome", outcome.outcomeId),
        dogfoodRef("agent-request", outcome.requestId),
        dogfoodRef("tool-provider-adapter-run", outcome.metadata.runId),
      ],
      issues: outcome.error ? [outcome.error] : undefined,
      auditRefs: [`${outcome.metadata.runId}:audit:finished`],
      completedAtMs: outcome.occurredAtMs,
      metadata: { outcomeId: outcome.outcomeId, requestStatus: resultStatus(outcome.kind) },
      output: outcome.result,
      error: outcome.error,
      needs: outcome.needs,
    };
  });
  const evidence = effectResults.map((result) => ({
    kind: "work-item-evidence-recorded",
    evidenceId: `${result.effectRunId}:evidence`,
    workItemId: result.subjectRefs[0].id,
    effectRunId: result.effectRunId,
    status: result.status,
    output: result.output,
    error: result.error,
    needs: result.needs,
    sourceRefs: result.sourceRefs,
    summary: result.output?.summary ?? result.error?.message ?? result.needs?.[0]?.message,
  }));
  const issues = outcomes
    .filter((outcome) => outcome.error)
    .map((outcome) => ({ ...outcome.error, sourceRefs: [dogfoodRef("executor-outcome", outcome.outcomeId)] }));
  const audit = [
    ...runRequests.map((request) => ({
      kind: "agent-runtime-audit",
      id: `${request.runId}:audit:requested`,
      event: "tool-provider-adapter-runtime-run-requested",
      subjectId: request.requestId,
      sourceRefs: [dogfoodRef("tool-provider-adapter-run", request.runId)],
      metadata: { runId: request.runId, attempt: request.attempt },
    })),
    ...outcomes.map((outcome) => ({
      kind: "agent-runtime-audit",
      id: `${outcome.metadata.runId}:audit:finished`,
      event: "tool-provider-adapter-runtime-finished",
      subjectId: outcome.requestId,
      issueCode: outcome.error?.code,
      sourceRefs: [dogfoodRef("executor-outcome", outcome.outcomeId)],
      metadata: { runId: outcome.metadata.runId, outcomeId: outcome.outcomeId },
    })),
  ];
  const actionProposal = {
    kind: "work-item-domain-action-proposal",
    proposalId: "wi-domain-action:seed-review-proposal",
    workItemId: "wi-domain-action",
    actionKind: "require-review",
    state: "admitted",
    reason: "Seeded graph-visible dashboard review action",
    sourceRefs: [dogfoodRef("seed", "wi-domain-action:seed-review-proposal")],
    metadata: { bounded: true },
  };
  return {
    title: "CSP-8 GraphReFly internal dashboard dogfood",
    note: "dashboard-private fixture facts; no public Canvas API/runtime owner",
    providerId,
    selectedWorkItemId,
    facts: [
      ...workItems,
      ...dependencies,
      { kind: "canvas-selection", workItemId: selectedWorkItemId },
      {
        kind: "tool-provider-catalog",
        providerId,
        catalogId: "dashboard-local-builtin",
        toolNames: ["file.read", "file.edit/apply-patch"],
        profileIds: [executorProfiles[0].profileId],
        policyRefs: [dogfoodRef("tool-provider-execution-policy", policyId)],
      },
      {
        kind: "tool-provider-execution-policy",
        policyId,
        providerId,
        scope: { profileIds: [executorProfiles[0].profileId], toolNames: ["file.read", "file.edit/apply-patch"] },
        sizeCapacity: { maxInlineChars: 220, maxMetadataStringChars: 80, overflow: "artifact-ref" },
        timeout: { timeoutMs: 2_000 },
        redaction: { mode: "summary-ref", evidence: "D293-size-redaction" },
        filesystem: { cwd: "dashboard-fixture", pathPolicy: "fixture-relative-only", allowedPaths: ["bounded-fixture.md"] },
        approval: { requiredFor: ["file.edit/apply-patch"], mode: "explicit-visible-policy" },
        artifacts: { mode: "D270-summary-ref", allowInlineBinary: false },
        network: { allowed: false },
      },
      { kind: "work-item-effect-mapping-policy", policyId: "dashboard-evidence-policy", effectKinds: [effectKind], evidence: { behavior: "record" } },
      ...effectRequests,
      ...agentRequests,
      ...executorProfiles,
      ...executorRoutes,
      ...adapterInputs,
      ...runRequests,
      ...outcomes,
      ...effectResults,
      ...evidence,
      ...issues,
      ...audit,
      actionProposal,
      {
        kind: "work-item-domain-action-admission",
        admissionId: `${actionProposal.proposalId}:admission`,
        proposalId: actionProposal.proposalId,
        workItemId: actionProposal.workItemId,
        state: "admitted",
        sourceRefs: [dogfoodRef("work-item-domain-action-proposal", actionProposal.proposalId)],
      },
    ],
  };
}

// ---- consistency checks (fixes P4 stale-premise + P6 link-rot) ----
const decIds = new Set(model.decisions.map((d) => d.id));
const sessIds = new Set(model.sessions.map((s) => s.id));
const ruleIds = new Set(model.rules.map((r) => r.id));
const broken = [];
const orphans = [];

for (const s of model.sessions)
  for (const d of s.locks ?? [])
    if (!decIds.has(d)) broken.push(`session ${s.id} locks missing decision ${d}`);
for (const p of model.phases)
  for (const ds of p.sessions ?? [])
    if (!sessIds.has(ds)) broken.push(`phase ${p.id} refs missing session ${ds}`);
const legacyRefs = [];
for (const d of model.decisions)
  for (const sup of d.supersedes ?? []) {
    if (decIds.has(sup)) continue;
    // 3-digit D### (e.g. D080/D196/D206/D221) are legacy decisions from the old
    // main-branch log that clean-slate supersedes — external refs, not broken links.
    if (/^D\d{3}$/.test(sup) || /^R\d+$/.test(sup)) legacyRefs.push(`${d.id} supersedes legacy ${sup}`);
    else broken.push(`decision ${d.id} supersedes unknown ${sup}`);
  }
for (const c of model.conformance)
  for (const r of c.covers ?? [])
    if (!ruleIds.has(r)) broken.push(`conformance ${c.id} covers missing rule ${r}`);
for (const fc of model.flowcharts)
  for (const e of fc.explains ?? [])
    if (!ruleIds.has(e) && !decIds.has(e)) broken.push(`flowchart ${fc.id} explains unknown ${e}`);

const referencedDecisions = new Set([
  ...model.sessions.flatMap((s) => s.locks ?? []),
]);
for (const d of model.decisions)
  if (!referencedDecisions.has(d.id)) orphans.push(`decision ${d.id} referenced by no session`);

// ---- gaps ----
const gaps = {
  designPhases: model.phases.filter((p) => p.gap || p.status === "design").map((p) => p.id),
  openDecisions: model.decisions.filter((d) => d.status === "open").map((d) => d.id),
  deferredBacklog: model.backlog.filter((b) => b.state === "deferred").map((b) => b.id),
  uncoveredRules: model.rules
    .filter((r) => !(r.covers_by?.length) && !model.conformance.some((c) => c.covers?.includes(r.id)))
    .map((r) => r.id),
  todoConformance: model.conformance
    .filter((c) => Object.values(c.runtimes ?? {}).some((v) => v === "todo"))
    .map((c) => c.id),
};

// ---- report ----
const counts = Object.fromEntries(Object.entries(model).map(([k, v]) => [k, v.length]));
console.log("=== GraphReFly dashboard build ===");
console.log("counts:", counts);
console.log("gaps:", Object.fromEntries(Object.entries(gaps).map(([k, v]) => [k, v.length])));
if (broken.length) console.error("BROKEN LINKS:\n  " + broken.join("\n  "));
if (orphans.length) console.warn("orphans:\n  " + orphans.join("\n  "));
if (legacyRefs.length) console.log("legacy external refs (ok):\n  " + legacyRefs.join("\n  "));

if (checkOnly) {
  if (broken.length) process.exit(1);
  process.exit(0);
}

// ---- emit shell: data payload + link to dashboard.css / dashboard.js ----
// build.mjs owns the DATA; dashboard.css + dashboard.js own the PRESENTATION
// (authored via /frontend-design). The shell only embeds the payload + links them.
const payload = {
  builtAt: new Date().toISOString(),
  counts,
  gaps,
  broken,
  orphans,
  legacyRefs,
  gateOk: broken.length === 0,
  model,
  dogfood: createDogfoodPayload(),
};
// Semantic skeleton: header / gauges / nav / main(view sections) / footer are all
// real elements in the HTML; dashboard.js fills (progressively enhances) the named
// containers rather than wiping one #app blob. Tab panels exist pre-JS.
// Cache-bust stamp — appended to css/js URLs so a rebuild always defeats a
// stale browser cache (the "new HTML + old cached JS" failure class).
const stamp = Date.now().toString(36);
const head = [
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  "<title>GraphReFly · Control</title>",
  `<link rel="stylesheet" href="./dashboard.css?v=${stamp}">`,
].join("\n  ");

const viewSections = ["dashboard", "dogfood", "gaps", "structure", "search"]
  .map(
    (id, i) =>
      `    <section class="view${i === 0 ? " active" : ""}" id="view-${id}" role="tabpanel" aria-labelledby="tab-${id}"></section>`,
  )
  .join("\n");

const shell = [
  `<header class="topbar" id="topbar" aria-busy="true">Loading control panel…</header>`,
  `  <section class="gauges" id="gauges"></section>`,
  `  <nav class="tabs" id="tabs" role="tablist"></nav>`,
  `  <main class="views" id="views">`,
  viewSections,
  `  </main>`,
  `  <footer id="footer"></footer>`,
].join("\n  ");

const html = `<!doctype html>
<html lang="en">
<head>
  ${head}
</head>
<body data-gate="${broken.length === 0 ? "pass" : "fail"}">
  <script type="application/json" id="payload">${JSON.stringify(payload)}</script>
  ${shell}
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <script src="./dashboard.js?v=${stamp}"></script>
</body>
</html>`;
writeFileSync(join(ROOT, "dashboard", "dashboard.html"), html);
console.log("wrote dashboard/dashboard.html");
