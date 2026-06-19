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
  const effectKind = "dashboard-workbench-tool";
  const selectedWorkItemId = "wi-board-query";
  const profileFor = (workItemId) => (workItemId === "wi-policy-failure" || workItemId === "wi-human-approval"
    ? "dashboard-local-builtin-patch-profile"
    : "dashboard-local-builtin-read-profile");
  const operationFor = (workItemId) => (workItemId === "wi-policy-failure" || workItemId === "wi-human-approval"
    ? "apply-patch"
    : "read");
  const toolNameFor = (workItemId) => (operationFor(workItemId) === "apply-patch" ? "file.edit/apply-patch" : "file.read");
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
      statusFacts: ["completed"],
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
      statusFacts: ["completed"],
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
      statusFacts: ["failed", "policy-denied"],
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
      statusFacts: ["blocked", "needs-approval"],
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
      statusFacts: ["ready", "awaiting-run"],
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
      statusFacts: ["queued", "action-visible"],
      sourceRefs: [dogfoodRef("csp-8-dashboard", "wi-domain-action")],
    },
    {
      kind: "work-item",
      workItemId: "wi-boundary-taxonomy",
      label: "Boundary taxonomy",
      summary: "Missing input, stale/mismatched request, and retention gap remain distinct visible facts.",
      lane: "blocked",
      progress: 44,
      x: 690,
      y: 330,
      statusFacts: ["blocked", "taxonomy-visible"],
      sourceRefs: [dogfoodRef("csp-8-dashboard", "wi-boundary-taxonomy")],
    },
  ];
  const dependencies = [
    ["wi-csp8-spine", "wi-provider-success", "feeds"],
    ["wi-csp8-spine", "wi-policy-failure", "shares policy"],
    ["wi-provider-success", "wi-board-query", "unblocks UI"],
    ["wi-policy-failure", "wi-human-approval", "requires review"],
    ["wi-board-query", "wi-domain-action", "drives action"],
    ["wi-human-approval", "wi-domain-action", "needs approval"],
    ["wi-policy-failure", "wi-boundary-taxonomy", "separates gaps"],
  ].map(([fromWorkItemId, toWorkItemId, label]) => ({
    kind: "work-item-dependency",
    fromWorkItemId,
    toWorkItemId,
    label,
    sourceRefs: [dogfoodRef("work-item", fromWorkItemId), dogfoodRef("work-item", toWorkItemId)],
  }));
  const effectItems = workItems.slice(1);
  const effectPlans = effectItems.map((item) => ({
    kind: "work-item-effect-plan",
    planId: `${item.workItemId}:dashboard-plan`,
    workItemId: item.workItemId,
    effectKind,
    executionInputRevision: 1,
    terminalKey: `${item.workItemId}:dashboard-plan:rev1`,
    requiredMemberIds: ["tool-member"],
    members: [
      {
        planMemberId: "tool-member",
        requestKind: "executor",
        inputKind: "tool-call",
        required: true,
        operation: operationFor(item.workItemId),
      },
    ],
    sourceRefs: [dogfoodRef("work-item", item.workItemId)],
    metadata: { bounded: true, displayKind: "dashboard-private-effect-plan" },
  }));
  const effectRequests = effectItems.map((item) => ({
    kind: "work-item-effect-requested",
    requestId: `${item.workItemId}:effect-request`,
    workItemId: item.workItemId,
    effectRunId: `${item.workItemId}:effect-run`,
    effectKind,
    executionInputRevision: 1,
    planId: `${item.workItemId}:dashboard-plan`,
    planMemberId: "tool-member",
    agentRunId: `${item.workItemId}:agent-run`,
    goal: { kind: effectKind, summary: item.summary },
    sourceRefs: [dogfoodRef("work-item-effect-plan", `${item.workItemId}:dashboard-plan`)],
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
          toolName: toolNameFor(request.workItemId),
          operation: operationFor(request.workItemId),
          arguments: { path: "bounded-fixture.md", boundedFixture: true },
        },
        subjectRefs: [dogfoodRef("work-item", request.workItemId)],
      },
    sourceRefs: [dogfoodRef("work-item-effect-requested", request.requestId)],
  }));
  const executorProfiles = [
    {
      kind: "executor-profile",
      profileKind: "tool-provider",
      executorId: providerId,
      profileId: "dashboard-local-builtin-read-profile",
      providerId,
      acceptedInputKinds: ["tool-call"],
      capabilities: { toolNames: ["file.read"], operations: ["read"] },
      policyRefs: [dogfoodRef("tool-provider-execution-policy", policyId)],
      sourceRefs: [dogfoodRef("tool-provider-catalog", "dashboard-local-builtin")],
      metadata: { bounded: true, coordinate: { providerId, profileId: "dashboard-local-builtin-read-profile" } },
    },
    {
      kind: "executor-profile",
      profileKind: "tool-provider",
      executorId: providerId,
      profileId: "dashboard-local-builtin-patch-profile",
      providerId,
      acceptedInputKinds: ["tool-call"],
      capabilities: { toolNames: ["file.edit/apply-patch"], operations: ["apply-patch"], approvalRequired: true },
      policyRefs: [dogfoodRef("tool-provider-execution-policy", policyId)],
      sourceRefs: [dogfoodRef("tool-provider-catalog", "dashboard-local-builtin")],
      metadata: { bounded: true, coordinate: { providerId, profileId: "dashboard-local-builtin-patch-profile" } },
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
    profileId: profileFor(request.workItemId),
    policyRefs: [dogfoodRef("tool-provider-execution-policy", policyId)],
    sourceRefs: [
      dogfoodRef("agent-request", request.requestId),
      dogfoodRef("executor-profile", profileFor(request.workItemId)),
      dogfoodRef("tool-provider-execution-policy", policyId),
    ],
    metadata: {
      bounded: true,
      coordinate: {
        requestId: request.requestId,
        routeId: `${request.requestId}:route`,
        profileId: profileFor(request.workItemId),
      },
    },
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
    routeRef: dogfoodRef("executor-route", `${request.requestId}:route`),
    profileId: profileFor(request.workItemId),
    profileRef: dogfoodRef("executor-profile", profileFor(request.workItemId)),
    policyRefs: [dogfoodRef("tool-provider-execution-policy", policyId)],
    sourceRefs: [
      dogfoodRef("agent-request", request.requestId),
      dogfoodRef("executor-route", `${request.requestId}:route`),
      dogfoodRef("executor-profile", profileFor(request.workItemId)),
      dogfoodRef("tool-provider-execution-policy", policyId),
    ],
    metadata: {
      bounded: true,
      coordinate: {
        adapterInputId: `${request.requestId}:adapter-input`,
        routeId: `${request.requestId}:route`,
        profileId: profileFor(request.workItemId),
      },
    },
  }));
  const requestAdmissions = agentRequests.map((request) => ({
    kind: "tool-provider-request-admission",
    admissionId: `${request.requestId}:admission`,
    requestId: request.requestId,
    adapterInputId: `${request.requestId}:adapter-input`,
    state: "admitted",
    sourceRefs: [dogfoodRef("agent-request", request.requestId), dogfoodRef("executor-route", `${request.requestId}:route`)],
    metadata: {
      requestAdmission: true,
      bounded: true,
      coordinate: {
        requestId: request.requestId,
        adapterInputId: `${request.requestId}:adapter-input`,
        admissionState: "admitted",
      },
    },
  }));
  const taxonomyAdmissions = [
    {
      kind: "tool-provider-request-admission",
      admissionId: "wi-boundary-taxonomy:stale-demo-request:admission",
      requestId: "wi-boundary-taxonomy:stale-demo-request",
      adapterInputId: "wi-boundary-taxonomy:stale-demo-adapter-input",
      state: "stale-request",
      issueCode: "stale-request",
      sourceRefs: [dogfoodRef("dashboard-taxonomy-scenario", "stale-request")],
      metadata: {
        requestAdmission: true,
        bounded: true,
        coordinate: {
          requestId: "wi-boundary-taxonomy:stale-demo-request",
          adapterInputId: "wi-boundary-taxonomy:stale-demo-adapter-input",
          admissionState: "stale-request",
        },
      },
    },
    {
      kind: "tool-provider-request-admission",
      admissionId: "wi-boundary-taxonomy:mismatched-demo-request:admission",
      requestId: "wi-boundary-taxonomy:mismatched-demo-request",
      adapterInputId: "wi-boundary-taxonomy:mismatched-demo-adapter-input",
      state: "mismatched-request",
      issueCode: "mismatched-request",
      sourceRefs: [dogfoodRef("dashboard-taxonomy-scenario", "mismatched-request")],
      metadata: {
        requestAdmission: true,
        bounded: true,
        coordinate: {
          requestId: "wi-boundary-taxonomy:mismatched-demo-request",
          adapterInputId: "wi-boundary-taxonomy:mismatched-demo-adapter-input",
          admissionState: "mismatched-request",
        },
      },
    },
  ];
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
    sourceRefs: [dogfoodRef("tool-provider-adapter-input", input.adapterInputId)],
    policyRefs: input.policyRefs,
    metadata: {
      attemptCoordinate: `${input.adapterInputId}#1`,
      bounded: true,
      coordinate: { adapterInputId: input.adapterInputId, runId: `${input.requestId}:seed-run:1`, attempt: 1 },
    },
  }));
  const outcomes = runRequests.map((request) => {
    const workItemId = request.requestId.replace(":tool-request", "");
    const input = adapterInputs.find((item) => item.adapterInputId === request.adapterInputId);
    const route = executorRoutes.find((item) => item.routeId === input?.routeId);
    const baseOutcome = {
      routeId: input?.routeId,
      executorId: route?.executorId,
      profileId: input?.profileId,
      attempt: request.attempt,
      inputId: input?.input?.inputId,
      inputKind: input?.input?.inputKind,
    };
    if (workItemId === "wi-policy-failure") {
      return {
        kind: "failure",
        outcomeId: `${request.runId}:outcome`,
        requestId: request.requestId,
        operationId: request.operationId,
        ...baseOutcome,
        occurredAtMs: now + 6,
        error: {
          kind: "issue",
          code: "policy-denied",
          message: "Fake policy denied write expansion; bounded public issue only.",
          severity: "error",
          subjectId: workItemId,
        },
        retryable: false,
        sourceRefs: [dogfoodRef("tool-provider-adapter-run-requested", request.runId)],
        evidenceRefs: [dogfoodRef("work-item", workItemId), dogfoodRef("tool-provider-adapter-run", request.runId)],
        metadata: {
          runId: request.runId,
          publicSummary: "policy-denied",
          bounded: true,
          coordinate: { adapterInputId: request.adapterInputId, runId: request.runId, attempt: request.attempt },
        },
      };
    }
    if (workItemId === "wi-human-approval") {
      return {
        kind: "blocked",
        outcomeId: `${request.runId}:outcome`,
        requestId: request.requestId,
        operationId: request.operationId,
        ...baseOutcome,
        occurredAtMs: now + 6,
        needs: [{ kind: "approval", message: "Human approval required before patch." }],
        sourceRefs: [dogfoodRef("tool-provider-adapter-run-requested", request.runId)],
        evidenceRefs: [dogfoodRef("work-item", workItemId), dogfoodRef("tool-provider-adapter-run", request.runId)],
        metadata: {
          runId: request.runId,
          publicSummary: "approval-needed",
          bounded: true,
          coordinate: { adapterInputId: request.adapterInputId, runId: request.runId, attempt: request.attempt },
        },
      };
    }
    if (workItemId === "wi-boundary-taxonomy") {
      return {
        kind: "blocked",
        outcomeId: `${request.runId}:outcome`,
        requestId: request.requestId,
        operationId: request.operationId,
        ...baseOutcome,
        occurredAtMs: now + 6,
        needs: [{ kind: "retention-gap", message: "Execution proof horizon closed; fail closed instead of hidden replay." }],
        sourceRefs: [dogfoodRef("tool-provider-adapter-run-requested", request.runId)],
        evidenceRefs: [dogfoodRef("work-item", workItemId), dogfoodRef("tool-provider-adapter-run", request.runId)],
        metadata: {
          runId: request.runId,
          publicSummary: "retention-gap",
          gapKind: "retention-evidence-horizon-closed",
          bounded: true,
          coordinate: { adapterInputId: request.adapterInputId, runId: request.runId, attempt: request.attempt },
        },
      };
    }
    return {
      kind: "result",
      outcomeId: `${request.runId}:outcome`,
      requestId: request.requestId,
      operationId: request.operationId,
      ...baseOutcome,
      occurredAtMs: now + 6,
      result: {
        kind: "tool-output",
        summary: "Fake bounded provider-neutral result.",
        value: { ok: true, bounded: true, requestId: request.requestId },
        refs: [dogfoodRef("artifact", `${request.requestId}:bounded-summary`)],
        metadata: { resultKind: "bounded-dashboard-fixture" },
      },
      usage: { latencyMs: 7 },
      sourceRefs: [dogfoodRef("tool-provider-adapter-run-requested", request.runId)],
      evidenceRefs: [dogfoodRef("work-item", workItemId), dogfoodRef("tool-provider-adapter-run", request.runId)],
      metadata: {
        runId: request.runId,
        publicSummary: "success",
        bounded: true,
        coordinate: { adapterInputId: request.adapterInputId, runId: request.runId, attempt: request.attempt },
      },
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
      metadata: {
        outcomeId: outcome.outcomeId,
        requestStatus: resultStatus(outcome.kind),
        bounded: true,
        coordinate: { runId: outcome.metadata.runId, attempt: outcome.attempt, outcomeId: outcome.outcomeId },
      },
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
    metadata: {
      bounded: true,
      evidenceKind: "work-item-effect-result",
      coordinate: { workItemId: result.subjectRefs[0].id, effectRunId: result.effectRunId, resultId: result.resultId },
    },
  }));
  const runStatuses = runRequests.map((request) => {
    const outcome = outcomes.find((item) => item.metadata.runId === request.runId);
    return {
      kind: "tool-provider-adapter-run-status",
      statusId: `${request.runId}:status`,
      runId: request.runId,
      adapterInputId: request.adapterInputId,
      attempt: request.attempt,
      status: outcome ? resultStatus(outcome.kind) : "requested",
      issueCode: outcome?.error?.code,
      sourceRefs: [dogfoodRef("tool-provider-adapter-run-requested", request.runId), dogfoodRef("executor-outcome", outcome?.outcomeId ?? "pending")],
      metadata: {
        bounded: true,
        runId: request.runId,
        attempt: request.attempt,
        coordinate: { adapterInputId: request.adapterInputId, runId: request.runId, attempt: request.attempt },
      },
    };
  });
  const retentionEvidence = seededRunInputs.map((input, index) => {
    const run = runRequests.find((request) => request.adapterInputId === input.adapterInputId);
    return {
      kind: "tool-provider-retention-evidence",
      evidenceId: `${input.adapterInputId}:retention-proof`,
      adapterInputId: input.adapterInputId,
      sequence: index + 1,
      occurredAtMs: now + 7 + index,
      evidenceKind: input.requestId.includes("wi-boundary-taxonomy") ? "retention-evidence-horizon-closed" : "execution-high-water",
      attemptHighWater: run?.attempt ?? 0,
      sourceRefs: run ? [dogfoodRef("tool-provider-adapter-run-requested", run.runId)] : [dogfoodRef("tool-provider-adapter-input", input.adapterInputId)],
      issueCode: input.requestId.includes("wi-boundary-taxonomy") ? "retention-gap" : undefined,
      metadata: {
        bounded: true,
        coordinate: {
          adapterInputId: input.adapterInputId,
          runId: run?.runId,
          attemptHighWater: run?.attempt ?? 0,
          evidenceKind: input.requestId.includes("wi-boundary-taxonomy") ? "retention-evidence-horizon-closed" : "execution-high-water",
        },
      },
    };
  });
  const retentionGapEvidenceId = "wi-boundary-taxonomy:tool-request:adapter-input:retention-proof";
  const runtimeStatuses = [
    {
      kind: "tool-provider-adapter-runtime-status",
      statusId: "dashboard-runtime:retention-evidence-horizon",
      providerId,
      status: "retention-gap",
      issueCode: "retention-gap",
      sourceRefs: [
        dogfoodRef("tool-provider-retention-evidence", retentionGapEvidenceId),
        dogfoodRef("tool-provider-adapter-run-status", "wi-boundary-taxonomy:tool-request:seed-run:1:status"),
      ],
      metadata: {
        bounded: true,
        gapKind: "retention-evidence-horizon-closed",
        coordinate: {
          diagnosticKind: "retention-gap",
          adapterInputId: "wi-boundary-taxonomy:tool-request:adapter-input",
          attemptHighWater: 1,
        },
      },
    },
  ];
  const materialRefs = outcomes.map((outcome) => ({
    kind: "tool-provider-material-ref",
    materialId: `${outcome.requestId}:bounded-summary`,
    requestId: outcome.requestId,
    outcomeId: outcome.outcomeId,
    materialKind: "D270-summary-ref",
    inlineState: "summary-only",
    sourceRefs: [dogfoodRef("executor-outcome", outcome.outcomeId)],
    metadata: {
      bounded: true,
      maxInlineChars: 220,
      redaction: "D293-size-redaction",
      coordinate: { runId: outcome.metadata.runId, outcomeId: outcome.outcomeId },
    },
  }));
  const boundaryIssues = [
    {
      kind: "issue",
      code: "approval-needed",
      message: "Approval-required patch route is blocked until an explicit visible approval fact exists.",
      severity: "warning",
      subjectId: "wi-human-approval",
      sourceRefs: [dogfoodRef("executor-outcome", "wi-human-approval:tool-request:seed-run:1:outcome")],
      issueCode: "approval-needed",
      metadata: {
        taxonomy: "approval-needed",
        bounded: true,
        coordinate: { workItemId: "wi-human-approval", runId: "wi-human-approval:tool-request:seed-run:1" },
      },
    },
    {
      kind: "issue",
      code: "missing-input",
      message: "Adapter input absent in a separate request coordinate: repairable missing input, not retention evidence.",
      severity: "warning",
      subjectId: "wi-boundary-taxonomy:missing-input-demo",
      sourceRefs: [dogfoodRef("dashboard-taxonomy-scenario", "missing-input")],
      issueCode: "missing-input",
      metadata: { taxonomy: "missing-input", gapKind: null, bounded: true, coordinate: { subjectId: "wi-boundary-taxonomy:missing-input-demo" } },
    },
    {
      kind: "issue",
      code: "stale-request",
      message: "Stale request stays request admission material; it is not retention evidence.",
      severity: "warning",
      subjectId: "wi-boundary-taxonomy",
      sourceRefs: [dogfoodRef("tool-provider-request-admission", "wi-boundary-taxonomy:stale-demo-request:admission")],
      issueCode: "stale-request",
      metadata: { taxonomy: "request-admission", admissionState: "stale-request", bounded: true, coordinate: { requestId: "wi-boundary-taxonomy:stale-demo-request" } },
    },
    {
      kind: "issue",
      code: "mismatched-request",
      message: "Request identity mismatch is a separate admission-shape issue, not a retention-gap substitute.",
      severity: "warning",
      subjectId: "wi-boundary-taxonomy:mismatched-request-demo",
      sourceRefs: [dogfoodRef("tool-provider-request-admission", "wi-boundary-taxonomy:mismatched-demo-request:admission")],
      issueCode: "mismatched-request",
      metadata: { taxonomy: "request-admission", admissionState: "mismatched-request", bounded: true, coordinate: { subjectId: "wi-boundary-taxonomy:mismatched-request-demo" } },
    },
    {
      kind: "issue",
      code: "retention-gap",
      message: "Retention evidence horizon closed; provider execution fails closed.",
      severity: "error",
      subjectId: "wi-boundary-taxonomy",
      sourceRefs: [
        dogfoodRef("tool-provider-retention-evidence", retentionGapEvidenceId),
        dogfoodRef("tool-provider-adapter-run-status", "wi-boundary-taxonomy:tool-request:seed-run:1:status"),
      ],
      issueCode: "retention-gap",
      metadata: {
        taxonomy: "retention-gap",
        gapKind: "retention-evidence-horizon-closed",
        bounded: true,
        coordinate: { adapterInputId: "wi-boundary-taxonomy:tool-request:adapter-input", attemptHighWater: 1 },
      },
    },
  ];
  const issues = outcomes
    .filter((outcome) => outcome.error)
    .map((outcome) => ({
      ...outcome.error,
      issueCode: outcome.error.code,
      sourceRefs: [dogfoodRef("executor-outcome", outcome.outcomeId)],
      metadata: {
        bounded: true,
        coordinate: {
          subjectId: outcome.error.subjectId,
          runId: outcome.metadata.runId,
          outcomeId: outcome.outcomeId,
          issueCode: outcome.error.code,
        },
      },
    }))
    .concat(boundaryIssues);
  const audit = [
    ...runRequests.map((request) => ({
      kind: "agent-runtime-audit",
      id: `${request.runId}:audit:requested`,
      event: "tool-provider-adapter-runtime-run-requested",
      subjectId: request.requestId,
      sourceRefs: [dogfoodRef("tool-provider-adapter-run", request.runId)],
      metadata: {
        runId: request.runId,
        attempt: request.attempt,
        bounded: true,
        coordinate: { adapterInputId: request.adapterInputId, runId: request.runId, attempt: request.attempt },
      },
    })),
    ...outcomes.map((outcome) => ({
      kind: "agent-runtime-audit",
      id: `${outcome.metadata.runId}:audit:finished`,
      event: "tool-provider-adapter-runtime-finished",
      subjectId: outcome.requestId,
      issueCode: outcome.error?.code,
      sourceRefs: [dogfoodRef("executor-outcome", outcome.outcomeId)],
      metadata: {
        runId: outcome.metadata.runId,
        outcomeId: outcome.outcomeId,
        bounded: true,
        coordinate: { runId: outcome.metadata.runId, outcomeId: outcome.outcomeId, attempt: outcome.attempt },
      },
    })),
    {
      kind: "agent-runtime-audit",
      id: "wi-boundary-taxonomy:audit:retention-gap",
      event: "tool-provider-adapter-runtime-retention-gap",
      subjectId: "wi-boundary-taxonomy",
      issueCode: "retention-gap",
      sourceRefs: [dogfoodRef("tool-provider-retention-evidence", retentionGapEvidenceId), dogfoodRef("issue", "retention-gap")],
      metadata: {
        gapKind: "retention-evidence-horizon-closed",
        bounded: true,
        coordinate: { adapterInputId: "wi-boundary-taxonomy:tool-request:adapter-input", attemptHighWater: 1 },
      },
    },
  ];
  const actionProposal = {
    kind: "work-item-domain-action-proposal",
    proposalId: "wi-domain-action:seed-review-proposal",
    workItemId: "wi-domain-action",
    actionKind: "require-review",
    state: "admitted",
    reason: "Seeded graph-visible dashboard review action",
    sourceRefs: [dogfoodRef("seed", "wi-domain-action:seed-review-proposal")],
    metadata: { bounded: true, coordinate: { workItemId: "wi-domain-action", proposalId: "wi-domain-action:seed-review-proposal" } },
  };
  const initialWorkbenchCommandRef = dogfoodRef("workbench-command", "workbench:init");
  const initialWorkbenchGeneratedFacts = [
    {
      kind: "workbench-selection",
      workItemId: selectedWorkItemId,
      sourceRefs: [initialWorkbenchCommandRef],
      metadata: { commandId: "workbench:init", visibleUiFact: true, bounded: true, coordinate: { workItemId: selectedWorkItemId } },
    },
    {
      kind: "workbench-lane-filter",
      lane: "all",
      sourceRefs: [initialWorkbenchCommandRef],
      metadata: { commandId: "workbench:init", visibleUiFact: true, bounded: true, coordinate: { filterKind: "lane", value: "all" } },
    },
    {
      kind: "workbench-status-filter",
      status: "all",
      sourceRefs: [initialWorkbenchCommandRef],
      metadata: { commandId: "workbench:init", visibleUiFact: true, bounded: true, coordinate: { filterKind: "status", value: "all" } },
    },
    {
      kind: "workbench-scope",
      scope: "selected",
      sourceRefs: [initialWorkbenchCommandRef],
      metadata: { commandId: "workbench:init", visibleUiFact: true, bounded: true, coordinate: { filterKind: "scope", value: "selected" } },
    },
  ];
  const initialWorkbenchGeneratedRefs = [
    dogfoodRef("workbench-selection", selectedWorkItemId),
    dogfoodRef("workbench-lane-filter", "all"),
    dogfoodRef("workbench-status-filter", "all"),
    dogfoodRef("workbench-scope", "selected"),
  ];
  const initialWorkbenchFacts = [
    {
      kind: "workbench-command",
      commandId: "workbench:init",
      commandKind: "initial-view-projection",
      state: "applied",
      workItemId: selectedWorkItemId,
      sourceRefs: [dogfoodRef("dashboard-view", "initial-load")],
      metadata: { visibleUiFact: true, bounded: true, coordinate: { workItemId: selectedWorkItemId } },
    },
    ...initialWorkbenchGeneratedFacts,
    {
      kind: "workbench-command-result",
      resultId: "workbench:init:result",
      commandId: "workbench:init",
      status: "applied",
      generatedRefs: initialWorkbenchGeneratedRefs,
      sourceRefs: [initialWorkbenchCommandRef],
      metadata: { bounded: true, coordinate: { commandId: "workbench:init", generatedCount: initialWorkbenchGeneratedRefs.length } },
    },
    {
      kind: "workbench-projector-run",
      projectorRunId: "workbench:init:projector-run",
      projectorId: "dashboard-private-workbench-projector",
      commandId: "workbench:init",
      status: "completed",
      inputRefs: [dogfoodRef("workbench-command-result", "workbench:init:result")],
      outputRefs: [dogfoodRef("workbench-view-projection", "workbench:init:projection")],
      sourceRefs: [dogfoodRef("workbench-command-result", "workbench:init:result")],
      metadata: { bounded: true, coordinate: { commandId: "workbench:init", projectorId: "dashboard-private-workbench-projector" } },
    },
    {
      kind: "workbench-view-projection",
      projectionId: "workbench:init:projection",
      projectionKind: "workbench-shell",
      selectedWorkItemId,
      scope: "selected",
      factsCount: 1 + initialWorkbenchGeneratedRefs.length + 3 + initialWorkbenchGeneratedRefs.length + 2,
      sourceRefs: [dogfoodRef("workbench-projector-run", "workbench:init:projector-run")],
      metadata: { bounded: true, coordinate: { selectedWorkItemId, scope: "selected" } },
    },
    ...initialWorkbenchGeneratedRefs.map((ref, index) => ({
      kind: "workbench-provenance-edge",
      edgeId: `workbench:init:edge:${index + 1}`,
      fromRef: initialWorkbenchCommandRef,
      toRef: ref,
      relation: "generated",
      commandId: "workbench:init",
      sourceRefs: [initialWorkbenchCommandRef],
      metadata: { bounded: true, coordinate: { commandId: "workbench:init", relation: "generated", ordinal: index + 1 } },
    })),
    {
      kind: "workbench-provenance-edge",
      edgeId: "workbench:init:edge:projector-run",
      fromRef: initialWorkbenchCommandRef,
      toRef: dogfoodRef("workbench-projector-run", "workbench:init:projector-run"),
      relation: "projected",
      commandId: "workbench:init",
      projectorRunId: "workbench:init:projector-run",
      sourceRefs: [initialWorkbenchCommandRef],
      metadata: { bounded: true, coordinate: { commandId: "workbench:init", projectorRunId: "workbench:init:projector-run" } },
    },
    {
      kind: "workbench-provenance-edge",
      edgeId: "workbench:init:edge:view-projection",
      fromRef: dogfoodRef("workbench-projector-run", "workbench:init:projector-run"),
      toRef: dogfoodRef("workbench-view-projection", "workbench:init:projection"),
      relation: "updates-ui-projection",
      commandId: "workbench:init",
      projectorRunId: "workbench:init:projector-run",
      sourceRefs: [dogfoodRef("workbench-projector-run", "workbench:init:projector-run")],
      metadata: { bounded: true, coordinate: { commandId: "workbench:init", projectionId: "workbench:init:projection" } },
    },
  ];
  return {
    title: "CSP-8 GraphReFly internal Workbench",
    note: "dashboard-private fixture facts; no public Canvas API, durable WorkspaceGraph owner, or provider runtime",
    providerId,
    selectedWorkItemId,
    facts: [
      ...workItems,
      ...dependencies,
      ...["all", "queued", "running", "blocked", "complete"].map((lane, order) => ({
        kind: "workbench-filter-option",
        filterKind: "lane",
        value: lane,
        label: lane,
        order,
        sourceRefs: [dogfoodRef("dashboard-private-view-model", "lane-filter-options")],
        metadata: { graphVisibleOption: true, bounded: true },
      })),
      ...["all", "ready", "running", "completed", "failed", "blocked", "timeout", "canceled", "none"].map((status, order) => ({
        kind: "workbench-filter-option",
        filterKind: "status",
        value: status,
        label: status,
        order,
        sourceRefs: [dogfoodRef("dashboard-private-view-model", "status-filter-options")],
        metadata: { graphVisibleOption: true, bounded: true },
      })),
      ...["selected", "global"].map((scope, order) => ({
        kind: "workbench-filter-option",
        filterKind: "scope",
        value: scope,
        label: scope,
        order,
        sourceRefs: [dogfoodRef("dashboard-private-view-model", "scope-filter-options")],
        metadata: { graphVisibleOption: true, bounded: true },
      })),
      ...initialWorkbenchFacts,
      {
        kind: "tool-provider-catalog",
        providerId,
        catalogId: "dashboard-local-builtin",
        toolNames: ["file.read", "file.edit/apply-patch"],
        profileIds: executorProfiles.map((profile) => profile.profileId),
        policyRefs: [dogfoodRef("tool-provider-execution-policy", policyId)],
        sourceRefs: [dogfoodRef("csp-8-dashboard", "provider-catalog")],
      },
      {
        kind: "tool-provider-execution-policy",
        policyId,
        providerId,
        profileIds: executorProfiles.map((profile) => profile.profileId),
        toolNames: ["file.read", "file.edit/apply-patch"],
        operations: ["read", "apply-patch"],
        scope: { profileIds: executorProfiles.map((profile) => profile.profileId), toolNames: ["file.read", "file.edit/apply-patch"] },
        sizeCapacity: { maxInlineChars: 220, maxMetadataStringChars: 80, overflow: "artifact-ref" },
        timeout: { timeoutMs: 2_000 },
        redaction: { mode: "summary-ref", evidence: "D293-size-redaction" },
        filesystem: { cwd: "dashboard-fixture", pathPolicy: "fixture-relative-only", allowedPaths: ["bounded-fixture.md"] },
        approval: { requiredFor: ["file.edit/apply-patch"], mode: "explicit-visible-policy" },
        artifacts: { mode: "D270-summary-ref", allowInlineBinary: false },
        network: { allowed: false },
        sourceRefs: [dogfoodRef("csp-8-decision", "D360"), dogfoodRef("csp-8-decision", "D293"), dogfoodRef("csp-8-decision", "D270")],
        metadata: { bounded: true, coordinate: { providerId, policyId } },
      },
      { kind: "work-item-effect-mapping-policy", policyId: "dashboard-evidence-policy", effectKinds: [effectKind], evidence: { behavior: "record" } },
      ...effectPlans,
      ...effectRequests,
      ...agentRequests,
      ...executorProfiles,
      ...executorRoutes,
      ...adapterInputs,
      ...requestAdmissions,
      ...taxonomyAdmissions,
      ...runRequests,
      ...runStatuses,
      ...runtimeStatuses,
      ...retentionEvidence,
      ...outcomes,
      ...materialRefs,
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
        metadata: { bounded: true, coordinate: { workItemId: actionProposal.workItemId, proposalId: actionProposal.proposalId } },
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
  '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27%3E%3Crect width=%2716%27 height=%2716%27 rx=%272%27 fill=%27%23050e1a%27/%3E%3Cpath d=%27M3 8h10M8 3v10%27 stroke=%27%23c8ff00%27 stroke-width=%272%27/%3E%3C/svg%3E">',
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
