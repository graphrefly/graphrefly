/* GraphReFly · Control — client renderer (classic script, file:// safe).
   build.mjs emits a semantic skeleton (#topbar #gauges #tabs #view-* #footer);
   this PROGRESSIVELY ENHANCES those named containers. build.mjs owns DATA. */
(function () {
  "use strict";
  var payload = JSON.parse(document.getElementById("payload").textContent);
  var M = payload.model, G = payload.gaps, C = payload.counts;
  var gapTotal = Object.keys(G).reduce(function (n, k) { return n + G[k].length; }, 0);
  var $ = function (id) { return document.getElementById(id); };
  var dogfoodFacts = (payload.dogfood && payload.dogfood.facts ? payload.dogfood.facts : []).slice();
  var DOGFOOD_STATUSES = ["all", "ready", "running", "completed", "failed", "blocked", "timeout", "canceled", "none"];

  // ---- tiny DOM helper ----
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") e.className = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] === true) e.setAttribute(k, "");
      else if (attrs[k] != null && attrs[k] !== false) e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function escAttr(s) { return esc(s).replace(/"/g, "&quot;"); }
  function safeLane(lane) {
    return lane === "queued" || lane === "running" || lane === "blocked" || lane === "complete" ? lane : "queued";
  }
  function fill(node, kids) { node.innerHTML = ""; kids.forEach(function (c) { node.appendChild(c); }); }
  function sectionH(title, sub) { return h("div", { class: "section-h" }, [title, sub ? h("span", { class: "sub" }, [sub]) : null]); }

  // ===== TOPBAR =====
  (function () {
    var bar = $("topbar");
    bar.removeAttribute("aria-busy");
    fill(bar, [
      h("div", { class: "brand" }, [
        h("div", { class: "word", html: "GRAPH<b>RE</b>FLY" }),
        h("div", { class: "tag" }, ["clean-slate // control"]),
      ]),
      h("div", { class: "spacer" }),
      h("div", { class: "gate" }, [h("span", { class: "dot" }), payload.gateOk ? "gate · pass" : "gate · " + payload.broken.length + " broken"]),
      h("div", { class: "built", html: "built<b>" + new Date(payload.builtAt).toISOString().replace("T", " ").slice(0, 19) + "Z</b>" }),
    ]);
    updateStickyTopbarHeight();
    window.addEventListener("resize", updateStickyTopbarHeight);
    if (window.ResizeObserver) new ResizeObserver(updateStickyTopbarHeight).observe(bar);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateStickyTopbarHeight);
  })();

  // ===== GAUGES =====
  (function () {
    function ticks(on, total) {
      var row = h("div", { class: "ticks" }), n = Math.min(total, 12);
      for (var i = 0; i < n; i++) row.appendChild(h("i", { class: i < Math.round((on / total) * n) ? "on" : "" }));
      return row;
    }
    function gauge(num, lbl, alert, on, total) {
      return h("div", { class: "gauge" + (alert ? " alert" : "") }, [
        h("div", { class: "num" }, [String(num)]), h("div", { class: "lbl" }, [lbl]), total ? ticks(on, total) : null,
      ]);
    }
    var doneP = M.phases.filter(function (p) { return p.status === "done"; }).length;
    var passC = M.conformance.filter(function (c) { return Object.values(c.runtimes || {}).every(function (v) { return v === "pass"; }); }).length;
    var g = $("gauges");
    fill(g, [
      gauge(C.phases, "phases", false, doneP, C.phases),
      gauge(C.decisions, "decisions locked", false),
      gauge(C.rules, "protocol rules", false),
      gauge(C.conformance, "conformance", false, passC, C.conformance),
      gauge(C.backlog, "backlog", false),
      gauge(gapTotal, "open gaps", true, 0, 0),
    ]);
    Array.prototype.forEach.call(g.children, function (c, i) { c.style.animationDelay = i * 60 + "ms"; });
  })();

  // ===== TABS =====
  var TABS = [
    { id: "dashboard", label: "Dashboard" },
    { id: "dogfood", label: "Workbench" },
    { id: "gaps", label: "Gaps", cnt: gapTotal },
    { id: "structure", label: "Structure" },
    { id: "search", label: "Search" },
  ];
  (function () {
    var nav = $("tabs");
    TABS.forEach(function (t) {
      var btn = h("button", { class: "tab", id: "tab-" + t.id, role: "tab", "aria-controls": "view-" + t.id,
        "aria-selected": t.id === "dashboard" ? "true" : "false", onclick: function () { select(t.id); } },
        [t.label, t.cnt != null ? h("span", { class: "cnt" }, ["(" + t.cnt + ")"]) : null]);
      nav.appendChild(btn);
    });
  })();
  function select(id) {
    TABS.forEach(function (t) {
      $("tab-" + t.id).setAttribute("aria-selected", t.id === id ? "true" : "false");
      $("view-" + t.id).classList.toggle("active", t.id === id);
    });
    if (id === "search") $("view-search").querySelector("input").focus();
  }

  // ===== DASHBOARD =====
  (function () {
    var v = $("view-dashboard");
    var doneP = M.phases.filter(function (p) { return p.status === "done"; }).length;
    var phaseCard = h("div", { class: "card" }, [h("h3", {}, ["implementation phases", h("span", { class: "big" }, [doneP + "/" + C.phases])])]);
    var rows = h("div", { class: "phase-row" });
    M.phases.forEach(function (p) {
      rows.appendChild(h("div", { class: "phase" }, [
        h("span", { class: "id" }, [p.id]),
        h("div", { class: "meta" }, [h("div", { class: "ttl", title: p.title }, [p.title]),
          h("div", { class: "deps" }, [p.deps && p.deps.length ? "← " + p.deps.join(", ") : "root"])]),
        h("span", { class: "st st-" + p.status }, [p.status]),
      ]));
    });
    phaseCard.appendChild(rows);
    var decCard = h("div", { class: "card" }, [h("h3", {}, ["decisions", h("span", { class: "big" }, [String(C.decisions)])])]);
    M.decisions.slice(-9).reverse().forEach(function (d) {
      decCard.appendChild(h("div", { class: "rec" }, [
        h("span", { class: "rid" + (d.id.indexOf("DR") === 0 ? " dr" : "") }, [d.id]),
        h("div", { class: "rbody" }, [h("div", { class: "rlayer" }, [d.layer]),
          h("div", { class: "rd" }, [d.decision.length > 130 ? d.decision.slice(0, 130) + "…" : d.decision])]),
      ]));
    });
    fill(v, [sectionH("Mission status", "clean-slate · DS-1"), h("div", { class: "grid cols" }, [phaseCard, decCard])]);
  })();

  // ===== DOGFOOD (CSP-8 reactive jira / messaging-hub board) =====
  function dogfoodFactsByKind(kind) {
    return dogfoodFacts.filter(function (fact) { return fact.kind === kind; });
  }
  function dogfoodRecords(kind) {
    return dogfoodFacts.filter(function (fact) { return fact.kind === kind || fact.factKind === kind; });
  }
  function dogfoodFactId(fact) {
    if (!fact) return "";
    return fact.workItemId || fact.planId || fact.requestId || fact.routeId || fact.profileId || fact.policyId ||
      fact.adapterInputId || fact.runId || fact.outcomeId || fact.resultId || fact.evidenceId ||
      fact.materialId || fact.proposalId || fact.approvalId || fact.admissionId || fact.applicationId || fact.statusId || fact.id || "";
  }
  function dogfoodRefsText(refs) {
    return (refs || []).map(function (ref) { return ref.kind + ":" + ref.id; }).join("  ");
  }
  function dogfoodCommandIdFrom(fact) {
    if (!fact) return "";
    if (fact.commandId) return fact.commandId;
    if (fact.metadata && fact.metadata.commandId) return fact.metadata.commandId;
    for (var i = 0; i < (fact.sourceRefs || []).length; i += 1) {
      if (fact.sourceRefs[i].kind === "dashboard-command") return fact.sourceRefs[i].id;
    }
    return "";
  }
  function dogfoodRefMatches(ref, ids, kinds) {
    if (!ref || !ids || !ids.length) return false;
    var idMatch = ids.some(function (id) { return ref.id === id || String(ref.id || "").indexOf(id + ":") === 0; });
    var kindMatch = !kinds || !kinds.length || kinds.indexOf(ref.kind) >= 0;
    return idMatch && kindMatch;
  }
  function dogfoodFactTouches(fact, ids, kinds) {
    if (!fact) return false;
    if (dogfoodRefMatches({ kind: "subject", id: fact.subjectId }, ids, kinds)) return true;
    if (dogfoodRefMatches({ kind: "work-item", id: fact.workItemId }, ids, kinds)) return true;
    if (dogfoodRefMatches({ kind: "request", id: fact.requestId }, ids, kinds)) return true;
    if (dogfoodRefMatches({ kind: "run", id: fact.runId }, ids, kinds)) return true;
    if ((fact.sourceRefs || []).some(function (ref) { return dogfoodRefMatches(ref, ids, kinds); })) return true;
    if ((fact.evidenceRefs || []).some(function (ref) { return dogfoodRefMatches(ref, ids, kinds); })) return true;
    var c = fact.metadata && fact.metadata.coordinate;
    return !!(c && [c.workItemId, c.requestId, c.adapterInputId, c.runId, c.outcomeId, c.subjectId].some(function (id) {
      return id && ids.some(function (needle) { return id === needle || String(id).indexOf(needle + ":") === 0; });
    }));
  }
  function dogfoodSelectedId() {
    var selections = dogfoodFactsByKind("dogfood-selection");
    return (selections[selections.length - 1] || {}).workItemId || payload.dogfood.selectedWorkItemId;
  }
  function dogfoodCurrentLaneFilter() {
    var filters = dogfoodFactsByKind("dogfood-lane-filter");
    var lane = (filters[filters.length - 1] || {}).lane || "all";
    return lane === "all" || lane === "queued" || lane === "running" || lane === "blocked" || lane === "complete" ? lane : "all";
  }
  function dogfoodCurrentStatusFilter() {
    var filters = dogfoodFactsByKind("dogfood-status-filter");
    var status = (filters[filters.length - 1] || {}).status || "all";
    return DOGFOOD_STATUSES.indexOf(status) >= 0 ? status : "all";
  }
  function dogfoodWorkItemFromRefs(refs) {
    for (var i = 0; i < (refs || []).length; i += 1) {
      if (refs[i].kind === "work-item") return refs[i].id;
    }
  }
  function dogfoodResultStatus(kind) {
    if (kind === "result") return "completed";
    if (kind === "failure") return "failed";
    return kind || "pending";
  }
  function updateStickyTopbarHeight() {
    var bar = $("topbar");
    if (!bar) return;
    document.documentElement.style.setProperty("--topbar-h", Math.ceil(bar.getBoundingClientRect().height) + "px");
  }
  function deriveDogfoodView() {
    var workItems = dogfoodFactsByKind("work-item");
    var deps = dogfoodFactsByKind("work-item-dependency");
    var effectPlanFacts = dogfoodFactsByKind("work-item-effect-plan");
    var effectRequests = dogfoodFactsByKind("work-item-effect-requested");
    var agentRequests = dogfoodFactsByKind("issued");
    var routes = dogfoodFactsByKind("executor-route");
    var profiles = dogfoodRecords("executor-profile");
    var policies = dogfoodFactsByKind("tool-provider-execution-policy");
    var adapterInputs = dogfoodFactsByKind("tool-provider-adapter-input");
    var requestAdmissions = dogfoodFactsByKind("tool-provider-request-admission");
    var runRequests = dogfoodFactsByKind("tool-provider-adapter-run-requested");
    var runStatuses = dogfoodFactsByKind("tool-provider-adapter-run-status");
    var runtimeStatuses = dogfoodFactsByKind("tool-provider-adapter-runtime-status");
    var retentionEvidence = dogfoodFactsByKind("tool-provider-retention-evidence");
    var materialRefs = dogfoodFactsByKind("tool-provider-material-ref");
    var outcomes = dogfoodFacts.filter(function (f) { return f.kind === "result" || f.kind === "failure" || f.kind === "blocked" || f.kind === "timeout" || f.kind === "canceled"; });
    var effectResults = dogfoodFactsByKind("effect-run-result");
    var evidence = dogfoodFactsByKind("work-item-evidence-recorded");
    var issues = dogfoodFacts.filter(function (f) { return f.kind === "issue"; });
    var audit = dogfoodFactsByKind("agent-runtime-audit");
    var actionApprovals = dogfoodFactsByKind("work-item-domain-action-approval");
    var actions = dogfoodFacts.filter(function (f) {
      return f.kind === "work-item-domain-action-proposal" || f.kind === "work-item-domain-action-approval" ||
        f.kind === "work-item-domain-action-admission" || f.kind === "work-item-domain-action-application";
    });
    var evidenceByWorkItem = {};
    evidence.forEach(function (item) { (evidenceByWorkItem[item.workItemId] = evidenceByWorkItem[item.workItemId] || []).push(item); });
    var issueBySubject = {};
    issues.forEach(function (item) { if (item.subjectId) (issueBySubject[item.subjectId] = issueBySubject[item.subjectId] || []).push(item); });
    var actionsByWorkItem = {};
    actions.forEach(function (item) { if (item.workItemId) (actionsByWorkItem[item.workItemId] = actionsByWorkItem[item.workItemId] || []).push(item); });
    var outcomeByRun = {};
    outcomes.forEach(function (item) { if (item.metadata && item.metadata.runId) outcomeByRun[item.metadata.runId] = item; });
    var byId = {};
    dogfoodFacts.forEach(function (fact) {
      var id = dogfoodFactId(fact);
      if (id) byId[(fact.kind || fact.factKind) + ":" + id] = fact;
      if (fact.factKind && id) byId[fact.factKind + ":" + id] = fact;
    });
    var inputByWorkItem = {};
    adapterInputs.forEach(function (input) {
      var id = dogfoodWorkItemFromRefs((input.input && input.input.subjectRefs) || input.sourceRefs);
      if (id) inputByWorkItem[id] = input;
    });
    function statusFor(workItemId) {
      var request = effectRequests.filter(function (r) { return r.workItemId === workItemId; }).slice(-1)[0];
      if (!request) return "none";
      var input = inputByWorkItem[workItemId];
      var latestRun = input ? runRequests.filter(function (r) { return r.adapterInputId === input.adapterInputId; }).slice(-1)[0] : null;
      var outcome = latestRun ? outcomeByRun[latestRun.runId] : null;
      if (!latestRun && input && input.status === "ready") return "ready";
      if (!outcome && latestRun) return "running";
      return dogfoodResultStatus(outcome && outcome.kind);
    }
    function laneFor(item, status) {
      if (status === "completed") return "complete";
      if (status === "failed" || status === "blocked") return "blocked";
      if (status === "ready" || status === "running") return "running";
      return item.lane;
    }
    var nodes = workItems.map(function (item) {
      var status = statusFor(item.workItemId);
      var ev = evidenceByWorkItem[item.workItemId] || [];
      var lane = safeLane(laneFor(item, status));
      return {
        id: item.workItemId,
        label: item.label,
        summary: item.summary,
        lane: lane,
        progress: status === "completed" ? 100 : Math.min(98, item.progress + ev.length * 8),
        effectStatus: status,
        evidenceCount: ev.length,
        issueCount: (issueBySubject[item.workItemId] || []).length,
        actionCount: (actionsByWorkItem[item.workItemId] || []).length,
        x: item.x,
        y: item.y,
      };
    });
    var nodeById = Object.fromEntries(nodes.map(function (n) { return [n.id, n]; }));
    var edges = deps.map(function (edge) {
      return {
        from: edge.fromWorkItemId,
        to: edge.toWorkItemId,
        label: edge.label,
        blocked: (nodeById[edge.toWorkItemId] || {}).lane === "blocked",
      };
    });
    var effectPlans = effectRequests.map(function (request) {
      var input = inputByWorkItem[request.workItemId];
      var latestRun = input ? runRequests.filter(function (r) { return r.adapterInputId === input.adapterInputId; }).slice(-1)[0] : null;
      var plan = effectPlanFacts.filter(function (item) { return item.planId === request.planId; })[0];
      return {
        workItemId: request.workItemId,
        planId: request.planId || "unplanned",
        plan: plan,
        request: request,
        effectRunId: request.effectRunId,
        requestId: request.requestId,
        runId: latestRun && latestRun.runId,
        attempt: latestRun && latestRun.attempt,
        status: statusFor(request.workItemId),
        summary: (request.goal && request.goal.summary) || request.effectKind,
      };
    });
    var toolRuns = runRequests.map(function (request) {
      var outcome = outcomeByRun[request.runId];
      var input = adapterInputs.filter(function (item) { return item.adapterInputId === request.adapterInputId; })[0];
      return {
        runId: request.runId,
        workItemId: input && dogfoodWorkItemFromRefs(input.input && input.input.subjectRefs),
        requestId: request.requestId,
        status: outcome ? dogfoodResultStatus(outcome.kind) : "requested",
        attempt: request.attempt,
        outcomeId: outcome && outcome.outcomeId,
        issueCount: outcome && outcome.error ? 1 : 0,
      };
    });
    var selectedWorkItemId = dogfoodSelectedId();
    function selectedBundleFor(id) {
      var item = workItems.filter(function (fact) { return fact.workItemId === id; })[0];
      var plan = effectPlanFacts.filter(function (fact) { return fact.workItemId === id; }).slice(-1)[0];
      var request = effectRequests.filter(function (fact) { return fact.workItemId === id; }).slice(-1)[0];
      var agentRequest = request ? agentRequests.filter(function (fact) { return fact.effectRunId === request.effectRunId || fact.requestId === id + ":tool-request"; }).slice(-1)[0] : null;
      var route = agentRequest ? routes.filter(function (fact) { return fact.requestId === agentRequest.requestId; }).slice(-1)[0] : null;
      var profile = route ? profiles.filter(function (fact) { return fact.profileId === route.profileId; }).slice(-1)[0] : null;
      var policy = route && route.policyRefs && route.policyRefs.length ? policies.filter(function (fact) { return fact.policyId === route.policyRefs[0].id; }).slice(-1)[0] : null;
      var adapterInput = inputByWorkItem[id];
      var admission = agentRequest ? requestAdmissions.filter(function (fact) { return fact.requestId === agentRequest.requestId; }).slice(-1)[0] : null;
      var selectedAdmissions = requestAdmissions.filter(function (fact) {
        return dogfoodFactTouches(fact, [id, id + ":tool-request", adapterInput && adapterInput.adapterInputId].filter(Boolean));
      });
      var runs = adapterInput ? runRequests.filter(function (fact) { return fact.adapterInputId === adapterInput.adapterInputId; }) : [];
      var latestRun = runs.slice(-1)[0];
      var runStatus = latestRun ? runStatuses.filter(function (fact) { return fact.runId === latestRun.runId; }).slice(-1)[0] : null;
      var runtimeStatus = latestRun ? runtimeStatuses.filter(function (fact) {
        return dogfoodFactTouches(fact, [id, latestRun.runId, adapterInput && adapterInput.adapterInputId].filter(Boolean));
      }).slice(-1)[0] : null;
      var outcome = latestRun ? outcomeByRun[latestRun.runId] : null;
      var effectResult = outcome ? effectResults.filter(function (fact) { return fact.metadata && fact.metadata.outcomeId === outcome.outcomeId; }).slice(-1)[0] : null;
      var selectedEvidence = evidence.filter(function (fact) { return fact.workItemId === id; });
      var selectedIssues = issues.filter(function (fact) {
        return dogfoodFactTouches(fact, [id, id + ":tool-request", adapterInput && adapterInput.adapterInputId, latestRun && latestRun.runId].filter(Boolean));
      });
      var selectedAudit = audit.filter(function (fact) {
        return dogfoodFactTouches(fact, [id, id + ":tool-request", adapterInput && adapterInput.adapterInputId, latestRun && latestRun.runId].filter(Boolean)) ||
          (fact.metadata && fact.metadata.runId && latestRun && fact.metadata.runId === latestRun.runId);
      });
      var selectedRetentionEvidence = retentionEvidence.filter(function (fact) {
        return dogfoodFactTouches(fact, [id, adapterInput && adapterInput.adapterInputId, latestRun && latestRun.runId].filter(Boolean));
      });
      var selectedMaterialRefs = materialRefs.filter(function (fact) {
        return dogfoodFactTouches(fact, [id, outcome && outcome.outcomeId, latestRun && latestRun.runId].filter(Boolean));
      });
      var selectedActions = actions.filter(function (fact) { return fact.workItemId === id; });
      var chain = [
        ["WorkItem", item],
        ["Effect plan", plan],
        ["Effect request", request],
        ["Agent request", agentRequest],
        ["Route", route],
        ["Profile", profile],
        ["Policy", policy],
        ["Adapter input", adapterInput],
        ["Run request", latestRun],
        ["Run status", runStatus],
        ["Runtime status", runtimeStatus],
        ["Retention evidence", selectedRetentionEvidence.slice(-1)[0]],
        ["Outcome", outcome],
        ["Material ref", selectedMaterialRefs.slice(-1)[0]],
        ["Effect result", effectResult],
        ["Evidence", selectedEvidence.slice(-1)[0]],
        ["Action", selectedActions.slice(-1)[0]],
      ];
      return {
        item: item,
        plan: plan,
        request: request,
        agentRequest: agentRequest,
        route: route,
        profile: profile,
        policy: policy,
        adapterInput: adapterInput,
        admission: admission,
        admissions: selectedAdmissions,
        runs: runs,
        latestRun: latestRun,
        runStatus: runStatus,
        runtimeStatus: runtimeStatus,
        outcome: outcome,
        effectResult: effectResult,
        evidence: selectedEvidence,
        retentionEvidence: selectedRetentionEvidence,
        materialRefs: selectedMaterialRefs,
        issues: selectedIssues,
        audit: selectedAudit,
        actions: selectedActions,
        chain: chain,
      };
    }
    var selected = nodeById[selectedWorkItemId] || nodes[0];
    return {
      selectedWorkItemId: selectedWorkItemId,
      nodes: nodes,
      edges: edges,
      effectPlans: effectPlans,
      toolRuns: toolRuns,
      evidence: evidence,
      issues: issues,
      audit: audit,
      actions: actions,
      selected: selected,
      selectedBundle: selected ? selectedBundleFor(selected.id) : null,
      counters: {
        workItems: nodes.length,
        dependencies: edges.length,
        readyInputs: adapterInputs.filter(function (input) {
          return input.status === "ready" && !runRequests.some(function (run) { return run.adapterInputId === input.adapterInputId; });
        }).length,
        outcomes: outcomes.length,
        evidence: evidence.length,
        issues: issues.length,
        runtimeStatus: runtimeStatuses.length,
        retentionEvidence: retentionEvidence.length,
        facts: dogfoodFacts.length,
      },
    };
  }
  function dogfoodAppend(facts) {
    dogfoodFacts = dogfoodFacts.concat(facts);
    renderDogfood();
  }
  function dogfoodAppendFilter(kind, value) {
    var current = kind === "lane" ? dogfoodCurrentLaneFilter() : dogfoodCurrentStatusFilter();
    if (current === value) return;
    dogfoodAppend([{
      kind: kind === "lane" ? "dogfood-lane-filter" : "dogfood-status-filter",
      lane: kind === "lane" ? value : undefined,
      status: kind === "status" ? value : undefined,
      sourceRefs: [{ kind: "dashboard-command", id: "filter-" + kind + ":" + value }],
      metadata: { visibleUiFact: true, bounded: true, coordinate: { filterKind: kind, value: value } },
    }]);
  }
  function dogfoodActionState(view, bundle, selectionVisible) {
    if (!selectionVisible || !view.selected) {
      return { canRun: false, canPropose: false, canApprove: false, runLabel: "Run fake effect", reason: "No visible WorkItem selected." };
    }
    var input = bundle && bundle.adapterInput;
    var runCount = bundle && bundle.runs ? bundle.runs.length : 0;
    var latestProposal = (bundle && bundle.actions || []).filter(function (item) {
      return item.kind === "work-item-domain-action-proposal";
    }).slice(-1)[0];
    var latestAdmission = latestProposal && (bundle.actions || []).some(function (item) {
      return item.kind === "work-item-domain-action-admission" && item.proposalId === latestProposal.proposalId;
    });
    var admissionOk = !bundle.admission || bundle.admission.state === "admitted";
    var retentionGap = !!(bundle.runtimeStatus && bundle.runtimeStatus.status === "retention-gap") ||
      (bundle.issues || []).some(function (issue) { return (issue.issueCode || issue.code) === "retention-gap"; });
    var canRun = !!(input && input.status === "ready" && admissionOk && !retentionGap);
    var runReason = canRun ? "Actions append visible facts; projector facts re-derive from the ledger." :
      retentionGap ? "Retention-gap proof exists for this coordinate; fake runtime fails closed." :
        !admissionOk ? "Request admission is not admitted for this coordinate." :
          "No ready adapter input for the selected WorkItem.";
    return {
      canRun: canRun,
      canPropose: true,
      canApprove: !!(latestProposal && !latestAdmission),
      runLabel: runCount > 0 ? "Retry visible run" : "Run fake effect",
      reason: runReason,
      approveReason: latestProposal ? (latestAdmission ? "Latest proposal is already admitted." : "Latest proposal can be approved.") : "No proposal is waiting for approval.",
    };
  }
  function dogfoodProjectOutcomeFacts(selected, input, outcome, commandRef) {
    var resultStatus = dogfoodResultStatus(outcome.kind);
    var runId = outcome.metadata && outcome.metadata.runId;
    var resultId = selected.id + ":effect-run:" + outcome.outcomeId + ":manual-projector-result";
    var effectResult = {
      kind: "effect-run-result",
      resultId: resultId,
      effectRunId: selected.id + ":effect-run",
      status: resultStatus,
      operationId: input.operationId,
      subjectRefs: [{ kind: "work-item", id: selected.id }],
      sourceRefs: [commandRef, { kind: "executor-outcome", id: outcome.outcomeId }, { kind: "agent-request", id: input.requestId }, { kind: "tool-provider-adapter-run", id: runId }],
      auditRefs: [runId + ":audit:finished"],
      completedAtMs: outcome.occurredAtMs,
      metadata: {
        commandId: commandRef.id,
        projectorId: "dashboard-private-effect-result-projector",
        outcomeId: outcome.outcomeId,
        requestStatus: resultStatus,
        bounded: true,
        coordinate: { workItemId: selected.id, runId: runId, outcomeId: outcome.outcomeId, attempt: outcome.attempt },
      },
      output: outcome.result,
      error: outcome.error,
      needs: outcome.needs,
    };
    return [
      effectResult,
      {
        kind: "work-item-evidence-recorded",
        evidenceId: selected.id + ":manual-evidence:" + outcome.attempt,
        workItemId: selected.id,
        effectRunId: effectResult.effectRunId,
        status: resultStatus,
        output: outcome.result,
        error: outcome.error,
        needs: outcome.needs,
        sourceRefs: effectResult.sourceRefs,
        summary: (outcome.result && outcome.result.summary) || (outcome.error && outcome.error.message) || (outcome.needs && outcome.needs[0] && outcome.needs[0].message),
        metadata: {
          commandId: commandRef.id,
          projectorId: "dashboard-private-work-item-evidence-projector",
          bounded: true,
          evidenceKind: "manual-dashboard-run",
          resultId: resultId,
          coordinate: { workItemId: selected.id, effectRunId: effectResult.effectRunId, resultId: resultId },
        },
      },
    ];
  }
  function dogfoodProjectApprovalFacts(selected, proposal, approval, commandRef) {
    return [
      {
        kind: "work-item-domain-action-admission",
        admissionId: proposal.proposalId + ":admission",
        proposalId: proposal.proposalId,
        workItemId: selected.id,
        state: "admitted",
        sourceRefs: [commandRef, { kind: "work-item-domain-action-approval", id: approval.approvalId }, { kind: "work-item-domain-action-proposal", id: proposal.proposalId }],
        metadata: { commandId: commandRef.id, projectorId: "dashboard-private-domain-action-projector", bounded: true, coordinate: { workItemId: selected.id, proposalId: proposal.proposalId } },
      },
      {
        kind: "work-item-domain-action-application",
        applicationId: proposal.proposalId + ":application",
        proposalId: proposal.proposalId,
        workItemId: selected.id,
        state: "applied",
        sourceRefs: [commandRef, { kind: "work-item-domain-action-admission", id: proposal.proposalId + ":admission" }],
        metadata: { commandId: commandRef.id, projectorId: "dashboard-private-domain-action-projector", bounded: true, coordinate: { workItemId: selected.id, proposalId: proposal.proposalId } },
      },
    ];
  }
  function dogfoodRunSelected(view) {
    var selected = view.selected;
    if (!selected) return;
    var input = dogfoodFactsByKind("tool-provider-adapter-input").filter(function (item) {
      return dogfoodWorkItemFromRefs(item.input && item.input.subjectRefs) === selected.id && item.status === "ready";
    }).slice(-1)[0];
    if (!input) return;
    var attempt = dogfoodFactsByKind("tool-provider-adapter-run-requested").filter(function (run) {
      return run.adapterInputId === input.adapterInputId;
    }).reduce(function (max, run) { return Math.max(max, Number(run.attempt) || 0); }, 0) + 1;
    var runId = selected.id + ":dashboard-run:" + attempt;
    var outcomeId = runId + ":outcome";
    var route = dogfoodFactsByKind("executor-route").filter(function (item) { return item.routeId === input.routeId; }).slice(-1)[0];
    var priorOutcome = dogfoodFacts.filter(function (item) {
      return (item.kind === "result" || item.kind === "failure" || item.kind === "blocked" || item.kind === "timeout" || item.kind === "canceled") &&
        item.requestId === input.requestId;
    }).slice(-1)[0];
    var commandRef = { kind: "dashboard-command", id: "run-effect:" + selected.id + ":" + attempt };
    var commandMeta = {
      commandId: commandRef.id,
      visibleUiFact: true,
      command: "run-or-retry-visible-effect",
      bounded: true,
      coordinate: { workItemId: selected.id, adapterInputId: input.adapterInputId, attempt: attempt },
    };
    var command = {
      kind: "dashboard-command/run-effect-requested",
      commandId: commandRef.id,
      workItemId: selected.id,
      adapterInputId: input.adapterInputId,
      attempt: attempt,
      sourceRefs: [{ kind: "dogfood-selection", id: selected.id }],
      metadata: commandMeta,
    };
    var runRequest = {
      kind: "tool-provider-adapter-run-requested",
      runId: runId,
      adapterInputId: input.adapterInputId,
      requestId: input.requestId,
      operationId: input.operationId,
      routeId: input.routeId,
      providerId: input.providerId,
      executorId: route && route.executorId,
      profileId: input.profileId,
      attempt: attempt,
      reason: attempt === 1 ? "manual" : "retry",
      retryOfOutcomeId: attempt > 1 && priorOutcome ? priorOutcome.outcomeId : undefined,
      policyRefs: input.policyRefs,
      requestedAtMs: 1_200 + attempt,
      sourceRefs: [commandRef, { kind: "tool-provider-adapter-input", id: input.adapterInputId }],
      metadata: {
        commandId: commandRef.id,
        command: "run-selected-effect",
        workItemId: selected.id,
        attemptCoordinate: input.adapterInputId + "#" + attempt,
        bounded: true,
        coordinate: { adapterInputId: input.adapterInputId, runId: runId, attempt: attempt },
      },
    };
    var outcome = {
      kind: "result",
      outcomeId: outcomeId,
      requestId: input.requestId,
      operationId: input.operationId,
      routeId: input.routeId,
      executorId: route && route.executorId,
      profileId: input.profileId,
      attempt: attempt,
      inputId: input.input && input.input.inputId,
      inputKind: input.input && input.input.inputKind,
      occurredAtMs: 1_210 + attempt,
      result: {
        kind: "tool-output",
        summary: "Dashboard query returned bounded WorkItem/effect/evidence summary.",
        value: { ok: true, bounded: true, requestId: input.requestId },
        refs: [{ kind: "artifact", id: input.requestId + ":bounded-summary" }],
        metadata: { resultKind: "bounded-dashboard-action" },
      },
      sourceRefs: [commandRef, { kind: "tool-provider-adapter-run-requested", id: runId }],
      evidenceRefs: [{ kind: "work-item", id: selected.id }, { kind: "tool-provider-adapter-run", id: runId }],
      usage: { latencyMs: 7 },
      metadata: {
        commandId: commandRef.id,
        runId: runId,
        publicSummary: "success",
        bounded: true,
        coordinate: { adapterInputId: input.adapterInputId, runId: runId, attempt: attempt },
      },
    };
    var runStatus = {
      kind: "tool-provider-adapter-run-status",
      statusId: runId + ":status",
      runId: runId,
      adapterInputId: input.adapterInputId,
      requestId: input.requestId,
      operationId: input.operationId,
      status: "completed",
      attempt: attempt,
      outcomeId: outcomeId,
      sourceRefs: [{ kind: "tool-provider-adapter-run-requested", id: runId }, { kind: "executor-outcome", id: outcomeId }],
      metadata: {
        commandId: commandRef.id,
        bounded: true,
        runId: runId,
        attempt: attempt,
        coordinate: { adapterInputId: input.adapterInputId, runId: runId, attempt: attempt },
      },
    };
    var materialRef = {
      kind: "tool-provider-material-ref",
      materialId: input.requestId + ":manual-bounded-summary:" + attempt,
      requestId: input.requestId,
      outcomeId: outcomeId,
      materialKind: "D270-summary-ref",
      inlineState: "summary-only",
      sourceRefs: [{ kind: "executor-outcome", id: outcomeId }],
      metadata: {
        commandId: commandRef.id,
        bounded: true,
        maxInlineChars: 220,
        redaction: "D293-size-redaction",
        coordinate: { runId: runId, outcomeId: outcomeId },
      },
    };
    dogfoodAppend([
      command,
      runRequest,
      { kind: "agent-runtime-audit", id: runId + ":audit:requested", event: "tool-provider-adapter-runtime-run-requested", subjectId: input.requestId, sourceRefs: [commandRef, { kind: "tool-provider-adapter-run-requested", id: runId }], metadata: { commandId: commandRef.id, runId: runId, attempt: attempt, bounded: true, coordinate: { adapterInputId: input.adapterInputId, runId: runId, attempt: attempt } } },
      runStatus,
      outcome,
      materialRef,
      { kind: "agent-runtime-audit", id: runId + ":audit:finished", event: "tool-provider-adapter-runtime-finished", subjectId: input.requestId, sourceRefs: [commandRef, { kind: "executor-outcome", id: outcomeId }], metadata: { commandId: commandRef.id, runId: runId, outcomeId: outcomeId, bounded: true, coordinate: { runId: runId, outcomeId: outcomeId, attempt: attempt } } },
    ].concat(dogfoodProjectOutcomeFacts(selected, input, outcome, commandRef)));
  }
  function dogfoodProposeSelected(view) {
    var selected = view.selected;
    if (!selected) return;
    var proposalSeq = dogfoodFacts.filter(function (item) {
      return item.kind === "work-item-domain-action-proposal" && item.workItemId === selected.id;
    }).length + 1;
    var proposalId = selected.id + ":dashboard-review-proposal:" + proposalSeq;
    var commandRef = { kind: "dashboard-command", id: "propose-action:" + selected.id + ":" + proposalSeq };
    dogfoodAppend([{
      kind: "dashboard-command/propose-domain-action",
      commandId: commandRef.id,
      workItemId: selected.id,
      sourceRefs: [{ kind: "dogfood-selection", id: selected.id }],
      metadata: { commandId: commandRef.id, visibleUiFact: true, bounded: true, coordinate: { workItemId: selected.id, proposalSeq: proposalSeq } },
    }, {
      kind: "work-item-domain-action-proposal",
      proposalId: proposalId,
      workItemId: selected.id,
      actionKind: "require-review",
      state: "proposed",
      reason: "Dashboard user requested visible review action",
      sourceRefs: [commandRef],
      metadata: { commandId: commandRef.id, command: "propose-review", bounded: true, coordinate: { workItemId: selected.id, proposalId: proposalId } },
    }]);
  }
  function dogfoodApproveSelected(view) {
    var selected = view.selected;
    if (!selected) return;
    var proposal = dogfoodFacts.filter(function (item) {
      return item.kind === "work-item-domain-action-proposal" && item.workItemId === selected.id;
    }).slice(-1)[0];
    if (!proposal) return;
    var already = dogfoodFacts.some(function (item) {
      return (item.kind === "work-item-domain-action-admission" || item.kind === "work-item-domain-action-approval") &&
        item.proposalId === proposal.proposalId;
    });
    if (already) return;
    var commandRef = { kind: "dashboard-command", id: "approve-action:" + proposal.proposalId };
    var approval = {
      kind: "work-item-domain-action-approval",
      approvalId: proposal.proposalId + ":approval",
      proposalId: proposal.proposalId,
      workItemId: selected.id,
      state: "approved",
      sourceRefs: [commandRef, { kind: "work-item-domain-action-proposal", id: proposal.proposalId }],
      metadata: { commandId: commandRef.id, bounded: true, coordinate: { workItemId: selected.id, proposalId: proposal.proposalId } },
    };
    dogfoodAppend([
      {
        kind: "dashboard-command/approve-domain-action",
        commandId: commandRef.id,
        workItemId: selected.id,
        proposalId: proposal.proposalId,
        sourceRefs: [{ kind: "work-item-domain-action-proposal", id: proposal.proposalId }],
        metadata: { commandId: commandRef.id, visibleUiFact: true, bounded: true, coordinate: { workItemId: selected.id, proposalId: proposal.proposalId } },
      },
      approval,
      { kind: "agent-runtime-audit", id: proposal.proposalId + ":audit:approved", event: "work-item-domain-action-approved", subjectId: selected.id, sourceRefs: [commandRef], metadata: { commandId: commandRef.id, proposalId: proposal.proposalId, bounded: true, coordinate: { workItemId: selected.id, proposalId: proposal.proposalId } } },
    ].concat(dogfoodProjectApprovalFacts(selected, proposal, approval, commandRef)));
  }
  function dogfoodMetric(label, value) {
    return h("div", { class: "df-metric" }, [h("strong", {}, [String(value)]), h("span", {}, [label])]);
  }
  function dogfoodBadge(tone, label) {
    return h("span", { class: "df-badge " + tone }, [label]);
  }
  function dogfoodNodeMatchesFilters(node) {
    var laneFilter = dogfoodCurrentLaneFilter();
    var statusFilter = dogfoodCurrentStatusFilter();
    if (!node) return false;
    if (laneFilter !== "all" && node.lane !== laneFilter) return false;
    if (statusFilter !== "all" && node.effectStatus !== statusFilter) return false;
    return true;
  }
  function dogfoodBoard(view) {
    var laneFilter = dogfoodCurrentLaneFilter();
    var statusFilter = dogfoodCurrentStatusFilter();
    var shown = view.nodes.filter(dogfoodNodeMatchesFilters);
    if (!shown.length) return h("div", { class: "df-board df-board-empty" }, [
      h("p", {}, ["No WorkItems match lane ", h("strong", {}, [laneFilter]), " and status ", h("strong", {}, [statusFilter]), "."]),
    ]);
    var shownIds = new Set(shown.map(function (node) { return node.id; }));
    var nodeById = Object.fromEntries(view.nodes.map(function (node) { return [node.id, node]; }));
    var edgeSvg = view.edges.filter(function (edge) { return shownIds.has(edge.from) && shownIds.has(edge.to); }).map(function (edge) {
      var from = nodeById[edge.from], to = nodeById[edge.to];
      var mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2 - 9;
      return '<g class="df-edge ' + (edge.blocked ? "blocked" : "") + '"><line x1="' + (from.x + 42) + '" y1="' + from.y + '" x2="' + (to.x - 42) + '" y2="' + to.y + '"></line><text x="' + mx + '" y="' + my + '">' + esc(edge.label) + "</text></g>";
    }).join("");
    var nodeSvg = shown.map(function (node) {
      return '<g class="df-node ' + safeLane(node.lane) + (view.selectedWorkItemId === node.id ? " selected" : "") + '" data-id="' + escAttr(node.id) + '" transform="translate(' + node.x + " " + node.y + ')" tabindex="0" role="button" aria-label="Select ' + escAttr(node.label) + '"><rect x="-74" y="-39" width="148" height="78" rx="8"></rect><text class="df-node-label" x="0" y="-11">' + esc(node.label) + '</text><text class="df-node-status" x="0" y="12">' + esc(node.effectStatus) + " / " + node.progress + '%</text><circle cx="58" cy="-25" r="8"></circle><text class="df-node-count" x="58" y="-21">' + node.evidenceCount + "</text></g>";
    }).join("");
    var board = h("div", { class: "df-board" }, [
      h("div", { class: "df-board-note" }, ["Scroll horizontally on narrow screens to inspect the full dependency board."]),
      h("div", { class: "df-board-canvas", html: '<svg viewBox="0 0 760 420" role="img" aria-label="CSP-8 WorkItem dependency board"><defs><marker id="df-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z"></path></marker></defs><g class="df-edges">' + edgeSvg + '</g><g class="df-nodes">' + nodeSvg + "</g></svg>" }),
    ]);
    Array.prototype.forEach.call(board.querySelectorAll(".df-node"), function (node) {
      function selectNode() {
        var selectedId = node.getAttribute("data-id");
        dogfoodAppend([{
          kind: "dogfood-selection",
          workItemId: selectedId,
          sourceRefs: [{ kind: "dashboard-command", id: "select-work-item:" + selectedId }],
          metadata: { visibleUiFact: true, bounded: true, coordinate: { workItemId: selectedId } },
        }]);
      }
      node.addEventListener("click", selectNode);
      node.addEventListener("keydown", function (event) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectNode(); } });
    });
    return board;
  }
  function dogfoodRows(title, rows, emptyText, render) {
    var section = h("section", { class: "df-section" }, [h("h3", {}, [title])]);
    if (!rows.length) section.appendChild(h("p", { class: "df-empty" }, [emptyText]));
    rows.forEach(function (row) { section.appendChild(render(row)); });
    return section;
  }
  function dogfoodMiniFact(label, fact) {
    var id = dogfoodFactId(fact);
    var refs = dogfoodRefsText(fact && (fact.sourceRefs || fact.evidenceRefs || fact.policyRefs));
    return h("div", { class: "df-mini-fact" + (fact ? "" : " missing") }, [
      h("span", {}, [label]),
      h("strong", { title: id || "missing" }, [id || "missing"]),
      refs ? h("code", { title: refs }, [refs]) : null,
    ]);
  }
  function dogfoodJsonFact(title, fact, emptyText) {
    return h("details", { class: "df-json", open: !!fact }, [
      h("summary", {}, [title, fact ? h("code", {}, [dogfoodFactId(fact)]) : h("span", {}, ["missing"])]),
      fact ? h("pre", {}, [JSON.stringify(fact, null, 2)]) : h("p", { class: "df-empty" }, [emptyText || "No graph-visible fact is currently attached."]),
    ]);
  }
  function dogfoodChain(bundle) {
    var chain = h("div", { class: "df-chain" });
    (bundle && bundle.chain || []).forEach(function (step, index) {
      chain.appendChild(h("div", { class: "df-chain-step" + (step[1] ? "" : " missing") }, [
        h("span", {}, [String(index + 1).padStart(2, "0")]),
        h("strong", {}, [step[0]]),
        h("code", { title: dogfoodRefsText(step[1] && (step[1].sourceRefs || step[1].policyRefs || step[1].evidenceRefs)) }, [dogfoodFactId(step[1]) || "missing"]),
      ]));
    });
    return chain;
  }
  function dogfoodRoutePolicyCards(bundle) {
    if (!bundle) return h("p", { class: "df-empty" }, ["No route/profile/policy chain selected."]);
    var policy = bundle.policy || {};
    var cards = [
      ["Route", bundle.route && bundle.route.profileId, bundle.route && dogfoodRefsText(bundle.route.sourceRefs)],
      ["Profile", bundle.profile && (bundle.profile.capabilities && bundle.profile.capabilities.toolNames || []).join(", "), bundle.profile && dogfoodRefsText(bundle.profile.policyRefs)],
      ["Policy", policy.policyId, [
        policy.size || policy.sizeCapacity ? "size" : "",
        policy.timeout ? "timeout" : "",
        policy.redaction ? "redaction" : "",
        policy.cwdPath || policy["cwd-path"] ? "cwd-path" : "",
        policy.approval ? "approval" : "",
        policy.artifact ? "artifact" : "",
        policy.network ? "network" : "",
      ].filter(Boolean).join(" / ")],
      ["Input", bundle.adapterInput && bundle.adapterInput.adapterInputId, bundle.adapterInput && dogfoodRefsText(bundle.adapterInput.sourceRefs)],
      ["Evidence", bundle.evidence && bundle.evidence.length ? bundle.evidence.length + " item(s)" : "none", bundle.evidence && bundle.evidence.slice(-1)[0] && dogfoodRefsText(bundle.evidence.slice(-1)[0].sourceRefs)],
    ];
    return h("div", { class: "df-policy-chain" }, cards.map(function (card) {
      return h("div", { class: "df-policy-card" }, [
        h("span", {}, [card[0]]),
        h("strong", { title: card[1] || "missing" }, [card[1] || "missing"]),
        h("code", { title: card[2] || "" }, [card[2] || "sourceRefs: none"]),
      ]);
    }));
  }
  function dogfoodScopedSummary(title, rows, emptyText) {
    return dogfoodRows(title, rows, emptyText, function (item) {
      var label = item.code || item.event || item.status || item.kind;
      var body = item.message || item.issueCode || dogfoodRefsText(item.sourceRefs) || dogfoodFactId(item);
      return h("div", { class: "df-row" }, [h("div", {}, [h("strong", {}, [label]), h("span", {}, [body])]), dogfoodBadge(item.severity || item.status || "recorded", item.severity || item.status || "recorded")]);
    });
  }
  function dogfoodInspector(view) {
    var recent = dogfoodFacts.slice(-14).reverse();
    var commandRefs = {};
    dogfoodFacts.forEach(function (fact) {
      var commandId = dogfoodCommandIdFrom(fact);
      if (commandId) {
        commandRefs[commandId] = commandRefs[commandId] || {};
        var commandKind = fact.kind || fact.factKind || "unknown";
        commandRefs[commandId][commandKind] = (commandRefs[commandId][commandKind] || 0) + 1;
        return;
      }
      (fact.sourceRefs || []).forEach(function (ref) {
        if (ref.kind === "dashboard-command") {
          var key = ref.id;
          commandRefs[key] = commandRefs[key] || {};
          var kind = fact.kind || fact.factKind || "unknown";
          commandRefs[key][kind] = (commandRefs[key][kind] || 0) + 1;
        }
      });
    });
    var diffs = Object.keys(commandRefs).slice(-5).reverse().map(function (key) {
      return h("div", { class: "df-row" }, [
        h("div", {}, [h("strong", {}, [key]), h("span", {}, [Object.keys(commandRefs[key]).map(function (kind) { return "+" + commandRefs[key][kind] + " " + kind; }).join("  ")])]),
      ]);
    });
    return h("details", { class: "df-ledger", open: true }, [
      h("summary", {}, ["Fact inspector / ledger diff (" + dogfoodFacts.length + " facts)"]),
      h("div", { class: "df-inspector" }, [
        h("section", {}, [
          h("h3", {}, ["Recent facts"]),
          h("div", { class: "df-ledger-list" }, recent.map(function (fact) {
            return h("div", { class: "df-ledger-item" }, [
              h("strong", {}, [fact.kind || fact.factKind || "unknown"]),
              h("code", {}, [dogfoodFactId(fact) || "no-id"]),
              h("span", {}, [dogfoodRefsText(fact.sourceRefs) || "sourceRefs: none"]),
              h("span", {}, [fact.issueCode || fact.code || "issueCode: none"]),
              h("code", {}, [fact.metadata && fact.metadata.coordinate ? JSON.stringify(fact.metadata.coordinate) : "coordinate: none"]),
            ]);
          })),
        ]),
        h("section", {}, [
          h("h3", {}, ["Command-derived diff"]),
          diffs.length ? h("div", { class: "df-section" }, diffs) : h("p", { class: "df-empty" }, ["No dashboard command has appended derived facts yet."]),
          h("pre", {}, [JSON.stringify({
            selectedWorkItemId: view.selectedWorkItemId,
            laneFilter: dogfoodCurrentLaneFilter(),
            statusFilter: dogfoodCurrentStatusFilter(),
            sourceRefDiscipline: "recent facts expose sourceRefs; raw provider material is summary/ref only",
          }, null, 2)]),
        ]),
      ]),
    ]);
  }
  function renderDogfood() {
    var v = $("view-dogfood");
    if (!v) return;
    var view = deriveDogfoodView();
    var selected = view.selected;
    var bundle = view.selectedBundle;
    var laneFilter = dogfoodCurrentLaneFilter();
    var statusFilter = dogfoodCurrentStatusFilter();
    var selectionVisible = dogfoodNodeMatchesFilters(selected);
    if (!selectionVisible) {
      selected = null;
      bundle = null;
    }
    var selectedEvidence = bundle ? bundle.evidence : [];
    var selectedIssues = bundle ? bundle.issues : [];
    var selectedAudit = bundle ? bundle.audit : [];
    var selectedActions = bundle ? bundle.actions : [];
    var actionState = dogfoodActionState(view, bundle, selectionVisible);
    var filters = h("div", { class: "df-filters" });
    var laneOptions = dogfoodFactsByKind("dogfood-filter-option").filter(function (item) { return item.filterKind === "lane"; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    var statusOptions = dogfoodFactsByKind("dogfood-filter-option").filter(function (item) { return item.filterKind === "status"; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    if (!laneOptions.length) laneOptions = ["all", "queued", "running", "blocked", "complete"].map(function (lane, order) { return { value: lane, label: lane, order: order }; });
    if (!statusOptions.length) statusOptions = DOGFOOD_STATUSES.map(function (status, order) { return { value: status, label: status, order: order }; });
    laneOptions.forEach(function (option) {
      var lane = option.value;
      filters.appendChild(h("button", {
        class: "df-filter" + (laneFilter === lane ? " active" : ""),
        "aria-pressed": laneFilter === lane ? "true" : "false",
        disabled: laneFilter === lane,
        onclick: function () { dogfoodAppendFilter("lane", lane); },
      }, [option.label || lane]));
    });
    statusOptions.forEach(function (option) {
      var status = option.value;
      filters.appendChild(h("button", {
        class: "df-filter status" + (statusFilter === status ? " active" : ""),
        "aria-pressed": statusFilter === status ? "true" : "false",
        disabled: statusFilter === status,
        onclick: function () { dogfoodAppendFilter("status", status); },
      }, [option.label || status]));
    });
    var actions = h("div", { class: "df-actions", role: "group", "aria-label": "Graph-visible Workbench actions" }, [
      h("button", { disabled: !actionState.canRun, title: actionState.reason, onclick: function () { if (actionState.canRun) dogfoodRunSelected({ selected: selected }); } }, [actionState.runLabel]),
      h("button", { class: "secondary", disabled: !actionState.canPropose, title: actionState.reason, onclick: function () { if (actionState.canPropose) dogfoodProposeSelected({ selected: selected }); } }, ["Propose review"]),
      h("button", { class: "secondary", disabled: !actionState.canApprove, title: actionState.approveReason, onclick: function () { if (actionState.canApprove) dogfoodApproveSelected({ selected: selected }); } }, ["Approve proposal"]),
      h("span", { class: "df-action-hint" }, [actionState.canApprove ? actionState.approveReason : actionState.reason]),
    ]);
    var metrics = h("div", { class: "df-metrics" }, [
      dogfoodMetric("WorkItems", view.counters.workItems),
      dogfoodMetric("Deps", view.counters.dependencies),
      dogfoodMetric("Ready inputs", view.counters.readyInputs),
      dogfoodMetric("Outcomes", view.counters.outcomes),
      dogfoodMetric("Evidence", view.counters.evidence),
      dogfoodMetric("Issues", view.counters.issues),
      dogfoodMetric("Retention", view.counters.retentionEvidence),
      dogfoodMetric("Facts", view.counters.facts),
    ]);
    var rail = h("aside", { class: "df-rail" }, [
      dogfoodRows("Global Issues", view.issues.slice(-8).reverse(), "No global issues in the ledger.", function (issue) {
        return h("div", { class: "df-row issue" }, [h("div", {}, [h("strong", {}, [issue.code]), h("span", {}, [issue.message || issue.subjectId || dogfoodRefsText(issue.sourceRefs)])]), dogfoodBadge(issue.severity || "info", issue.severity || "info")]);
      }),
      dogfoodRows("Global Audit", view.audit.slice(-8).reverse(), "No global audit entries.", function (audit) {
        return h("div", { class: "df-row" }, [h("div", {}, [h("strong", {}, [audit.event]), h("span", {}, [audit.subjectId || audit.id])])]);
      }),
      dogfoodRows("Tool Runs", view.toolRuns.slice(-8).reverse(), "No adapter run status yet.", function (run) {
        return h("div", { class: "df-row" }, [h("div", {}, [h("strong", {}, [run.workItemId || "unknown"]), h("span", {}, [run.runId])]), dogfoodBadge(run.status, run.status)]);
      }),
    ]);
    var detail = h("aside", { class: "df-detail" }, selected ? [
      h("div", { class: "df-detail-head" }, [h("span", { class: "df-status-dot " + safeLane(selected.lane) }), h("div", {}, [h("p", { class: "df-eyebrow" }, [selected.lane]), h("h2", {}, [selected.label])])]),
      h("p", { class: "df-summary" }, [selected.summary]),
      h("section", { class: "df-section" }, [h("h3", {}, ["Execution Chain"]), bundle ? dogfoodChain(bundle) : h("p", { class: "df-empty" }, ["No selected execution chain."])]),
      h("section", { class: "df-section" }, [h("h3", {}, ["Route / Policy / Evidence"]), dogfoodRoutePolicyCards(bundle)]),
      dogfoodJsonFact("WorkItem", bundle && bundle.item),
      dogfoodJsonFact("Effect Plan", bundle && bundle.plan, "This WorkItem has no effect plan fact."),
      dogfoodJsonFact("Effect Request", bundle && bundle.request, "No WorkItemEffectRequested fact for this selection."),
      dogfoodJsonFact("Agent Request", bundle && bundle.agentRequest, "No issued AgentRequest fact for this selection."),
      dogfoodJsonFact("Executor Route", bundle && bundle.route, "No ExecutorRoute fact; routing remains visible as missing."),
      dogfoodJsonFact("Executor Profile", bundle && bundle.profile, "No ExecutorProfile fact selected by the route."),
      dogfoodJsonFact("Tool Provider Policy", bundle && bundle.policy, "No ToolProviderExecutionPolicy fact selected by the route."),
      dogfoodJsonFact("Adapter Input", bundle && bundle.adapterInput, "No ready ToolProviderAdapterInput fact."),
      dogfoodJsonFact("Request Admission", bundle && bundle.admission, "No request admission fact for this selection."),
      dogfoodRows("Request Admission Taxonomy", bundle.admissions || [], "No request admission taxonomy facts touch this selection.", function (item) {
        return h("div", { class: "df-row" }, [h("div", {}, [h("strong", {}, [item.state || "unknown"]), h("span", {}, [item.issueCode || item.requestId])]), dogfoodBadge(item.state || "recorded", item.state || "recorded")]);
      }),
      dogfoodJsonFact("Run Request", bundle && bundle.latestRun, "No run request yet; click Run fake effect to append one."),
      dogfoodJsonFact("Run Status", bundle && bundle.runStatus, "No run-scoped status fact yet."),
      dogfoodJsonFact("Runtime Status", bundle && bundle.runtimeStatus, "No runtime-maintenance status fact touches this selection."),
      dogfoodJsonFact("Outcome", bundle && bundle.outcome, "No ExecutorOutcome fact yet."),
      dogfoodRows("Retention Evidence", bundle.retentionEvidence || [], "No bounded retention evidence touches this selection.", function (item) {
        return h("div", { class: "df-row" }, [h("div", {}, [h("strong", {}, [item.evidenceKind]), h("span", {}, [item.adapterInputId])]), dogfoodBadge(item.issueCode || "recorded", item.issueCode || "recorded")]);
      }),
      dogfoodRows("Material Refs", bundle.materialRefs || [], "No D270 material ref touches this selection.", function (item) {
        return h("div", { class: "df-row" }, [h("div", {}, [h("strong", {}, [item.materialKind]), h("span", {}, [item.materialId])]), dogfoodBadge(item.inlineState || "ref", item.inlineState || "ref")]);
      }),
      dogfoodJsonFact("Effect Result", bundle && bundle.effectResult, "No EffectRunResult projection yet."),
      dogfoodRows("Evidence", selectedEvidence, "No evidence recorded yet.", function (item) {
        return h("div", { class: "df-row" }, [h("div", {}, [h("strong", {}, [item.status]), h("span", {}, [item.summary || item.evidenceId])]), h("code", {}, [item.evidenceId])]);
      }),
      dogfoodRows("Domain Actions", selectedActions, "No graph-visible action proposal for this WorkItem.", function (item) {
        return h("div", { class: "df-row" }, [h("div", {}, [h("strong", {}, [item.actionKind || item.kind]), h("span", {}, [item.proposalId || item.admissionId || item.applicationId])]), dogfoodBadge(item.state || "recorded", item.state || "recorded")]);
      }),
      dogfoodScopedSummary("Selected Issues", selectedIssues, "No selected WorkItem issue."),
      dogfoodScopedSummary("Selected Audit", selectedAudit.slice(-8).reverse(), "No audit entries for this selection."),
    ] : [h("p", { class: "df-empty" }, ["No visible WorkItem is selected for the active lane/status filters. Select a visible node or clear the filters before running an action."])]);
    var ledger = dogfoodInspector(view);
    fill(v, [
      sectionH("CSP-8 Workbench", "reactive jira / messaging-hub · dashboard-private facts"),
      h("div", { class: "df-hero" }, [
        h("div", {}, [h("p", { class: "df-eyebrow" }, ["canonical target"]), h("h2", {}, [payload.dogfood.title]), h("p", {}, [payload.dogfood.note])]),
        actions,
      ]),
      metrics,
      filters,
      h("div", { class: "df-grid" }, [dogfoodBoard(view), rail, detail]),
      ledger,
    ]);
  }
  renderDogfood();

  // ===== GAPS =====
  (function () {
    var v = $("view-gaps");
    var labels = { designPhases: "phases in design", openDecisions: "open decisions", deferredBacklog: "deferred backlog", uncoveredRules: "rules w/o conformance", todoConformance: "conformance todo" };
    var tiles = h("div", { class: "gaptiles" });
    Object.keys(labels).forEach(function (k) {
      var ids = G[k] || [];
      tiles.appendChild(h("div", { class: "gaptile" + (ids.length === 0 ? " zero" : "") }, [
        h("div", { class: "gn" }, [String(ids.length)]), h("div", { class: "gl" }, [labels[k]]), h("div", { class: "gids" }, [ids.join("  ")]),
      ]));
    });
    var consist = h("div", { class: "grid cols", style: "margin-top:1.4rem" }, [
      payload.broken.length
        ? h("div", { class: "alert-panel broken" }, [h("b", {}, ["⚠ " + payload.broken.length + " broken links"]), h("ul", {}, payload.broken.map(function (b) { return h("li", {}, ["· " + b]); }))])
        : h("div", { class: "alert-panel ok" }, [h("b", {}, ["✓ consistency gate clean — no broken cross-references"])]),
      h("div", { class: "alert-panel orphan" }, [h("b", {}, [payload.orphans.length + " orphans (informational)"]),
        h("ul", {}, (payload.orphans.length ? payload.orphans : ["none"]).map(function (o) { return h("li", {}, ["· " + o]); }))]),
    ]);
    fill(v, [sectionH("Open gaps", gapTotal + " items across 5 categories"), tiles, consist]);
  })();

  // ===== STRUCTURE (conformance matrix + collapsible pan/zoom flowcharts) =====
  (function () {
    var v = $("view-structure");
    var tbl = h("table", { class: "matrix" }, [h("tr", {}, [h("th", {}, ["scenario"]), h("th", {}, ["covers"]), h("th", {}, ["ts"]), h("th", {}, ["rust"]), h("th", {}, ["py"]), h("th", {}, ["status"])])]);
    M.conformance.forEach(function (c) {
      function rt(st) { return h("td", {}, [h("span", { class: "rt " + st }, [h("span", { class: "d" }), h("span", {}, [st])])]); }
      tbl.appendChild(h("tr", {}, [h("td", { class: "cid" }, [c.id]), h("td", { class: "cn" }, [c.name]),
        rt((c.runtimes || {}).ts || "todo"), rt((c.runtimes || {}).rust || "todo"), rt((c.runtimes || {}).py || "todo"), h("td", {}, [c.status])]));
    });

    var list = h("div", { class: "flowlist" });
    M.flowcharts.forEach(function (fc, i) {
      var mm = h("div", { class: "mermaid", "data-src": fc.mermaid });
      var stage = h("div", { class: "flow-stage" }, [mm]);
      var controls = h("div", { class: "flow-controls" }, [
        h("button", { class: "fb", title: "zoom out", "aria-label": "zoom out" }, ["−"]),
        h("button", { class: "fb", title: "reset", "aria-label": "reset" }, ["⊙"]),
        h("button", { class: "fb", title: "zoom in", "aria-label": "zoom in" }, ["+"]),
        h("span", { class: "flow-hint" }, ["scroll = zoom · drag = pan · dbl-click = reset"]),
      ]);
      var body = h("div", { class: "flow-body", hidden: true }, [controls, stage]);
      var head = h("button", { class: "flow-head", "aria-expanded": "false" }, [
        h("span", { class: "chev" }, ["▸"]),
        h("span", { class: "flow-title" }, [fc.title]),
        h("span", { class: "flow-explains" }, [(fc.explains || []).join(" · ")]),
        h("span", { class: "flow-kind" }, [fc.area || ""]),
      ]);
      var item = h("div", { class: "flow" }, [head, body]);
      var rendered = false, pz = null;
      head.addEventListener("click", function () {
        var open = body.hasAttribute("hidden");
        if (open) body.removeAttribute("hidden"); else body.setAttribute("hidden", "");
        head.setAttribute("aria-expanded", open ? "true" : "false");
        item.classList.toggle("open", open);
        if (open && !rendered) { rendered = true; renderFlow(mm, fc.mermaid, i, function () { pz = makePanZoom(stage); }); }
      });
      var cbtns = controls.querySelectorAll(".fb");
      cbtns[0].addEventListener("click", function () { pz && pz.zoomBy(1 / 1.25); });
      cbtns[1].addEventListener("click", function () { pz && pz.reset(); });
      cbtns[2].addEventListener("click", function () { pz && pz.zoomBy(1.25); });
      list.appendChild(item);
    });

    fill(v, [
      sectionH("Conformance coverage", "behavioral parity (D24) · per-runtime"), tbl,
      sectionH("Flowcharts", M.flowcharts.length + " diagrams · collapsible · scroll-zoom / drag-pan"), list,
    ]);
  })();

  // ===== SEARCH =====
  (function () {
    var v = $("view-search");
    var idx = [];
    Object.keys(M).forEach(function (type) {
      M[type].forEach(function (r) {
        var text = [r.id, r.title, r.question, r.decision, r.statement, r.rationale, r.name, r.pattern, r.instead, r.note, r.layer, (r.covers || []).join(" "), (r.locks || []).join(" ")].filter(Boolean).join("  ");
        idx.push({ type: type, id: r.id || "—", text: text });
      });
    });
    var types = Object.keys(M);
    var activeType = null; // null = all types
    var input = h("input", { type: "text", placeholder: "filter by keyword — D# · phase · rule · conformance · session…", spellcheck: "false" });
    var count = h("span", { class: "hint" });
    var chips = h("div", { class: "filterbar" });
    var results = h("div", { id: "sresults" });
    function mkChip(label, type) {
      var c = h("button", { class: "fchip", onclick: function () { activeType = activeType === type ? null : type; run(); } },
        [label, type != null ? h("span", { class: "fc" }, ["(" + M[type].length + ")"]) : null]);
      c._type = type == null ? null : type;
      return c;
    }
    chips.appendChild(mkChip("all", null));
    types.forEach(function (t) { chips.appendChild(mkChip(t, t)); });
    function run() {
      Array.prototype.forEach.call(chips.children, function (c) { c.classList.toggle("active", c._type === activeType); });
      var q = input.value.trim().toLowerCase();
      var hits = idx.filter(function (r) {
        if (activeType && r.type !== activeType) return false;
        if (q && r.text.toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
      count.textContent = hits.length + " / " + idx.length + (activeType ? " · " + activeType : "") + (q ? " · “" + input.value.trim() + "”" : "");
      results.innerHTML = "";
      if (!hits.length) { results.appendChild(h("div", { class: "empty" }, ["no records match this filter"])); return; }
      hits.forEach(function (r) {
        var snippet = r.text;
        if (q) {
          var i = snippet.toLowerCase().indexOf(q), start = Math.max(0, i - 30);
          snippet = (start > 0 ? "…" : "") + snippet.slice(start, i + q.length + 100);
          snippet = esc(snippet).replace(new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>");
        } else { snippet = esc(snippet.slice(0, 150)); }
        results.appendChild(h("div", { class: "sresult" }, [h("span", { class: "chip" }, [r.type]), h("span", { class: "sid" }, [r.id]), h("span", { class: "stext", html: snippet })]));
      });
    }
    input.addEventListener("input", run);
    fill(v, [sectionH("Search", "all jsonl records · filter by type or keyword"), h("div", { class: "searchbar" }, [input, count]), chips, results]);
    run();
  })();

  // ===== FOOTER =====
  $("footer").innerHTML = "GraphReFly · clean-slate internal control panel · generated by <b>dashboard/build.mjs</b> from jsonl single-source · " + C.decisions + " decisions · " + C.phases + " phases · " + M.sessions.length + " session(s)";

  // ---- mermaid (lazy per-flowchart, demos/shared theme) ----
  var mermaidReady = false;
  function ensureMermaid() {
    if (mermaidReady || typeof window.mermaid === "undefined") return mermaidReady;
    window.mermaid.initialize({
      startOnLoad: false, theme: "base", securityLevel: "loose",
      fontFamily: '"Sora", system-ui, sans-serif',
      themeVariables: {
        background: "#f4f7f9", primaryColor: "#ffffff", primaryBorderColor: "rgba(7,18,30,0.22)",
        primaryTextColor: "#07121e", lineColor: "#9bc400", secondaryColor: "#eceff2",
        tertiaryColor: "#f4f7f9", nodeBorder: "rgba(7,18,30,0.22)", clusterBkg: "#eceff2",
        clusterBorder: "rgba(7,18,30,0.22)", edgeLabelBackground: "#ffffff",
      },
    });
    mermaidReady = true;
    return true;
  }
  function renderFlow(node, src, i, done) {
    if (!ensureMermaid()) { node.outerHTML = '<pre class="mermaid-src">' + esc(src) + "</pre>"; return; }
    try {
      window.mermaid.render("mmr-" + i, src).then(function (r) { node.innerHTML = r.svg; if (done) done(); })
        .catch(function () { node.outerHTML = '<pre class="mermaid-src">' + esc(src) + "</pre>"; });
    } catch (e) { node.outerHTML = '<pre class="mermaid-src">' + esc(src) + "</pre>"; }
  }

  // ---- pan/zoom (adapted from demos/reactive-layout/src/lib/pan-zoom.ts) ----
  function makePanZoom(stage) {
    var scale = 1, tx = 0, ty = 0, drag = false, lx = 0, ly = 0;
    function apply() {
      var svg = stage.querySelector("svg"); if (!svg) return;
      svg.style.transformOrigin = "0 0";
      svg.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
    }
    function zoomAt(factor, mx, my) {
      tx = mx - (mx - tx) * factor; ty = my - (my - ty) * factor;
      scale = Math.max(0.2, Math.min(8, scale * factor)); apply();
    }
    stage.addEventListener("wheel", function (e) { e.preventDefault(); var r = stage.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    stage.addEventListener("pointerdown", function (e) { if (e.button !== 0) return; drag = true; lx = e.clientX; ly = e.clientY; stage.setPointerCapture(e.pointerId); stage.classList.add("grabbing"); });
    stage.addEventListener("pointermove", function (e) { if (!drag) return; tx += e.clientX - lx; ty += e.clientY - ly; lx = e.clientX; ly = e.clientY; apply(); });
    function up(e) { if (!drag) return; drag = false; try { stage.releasePointerCapture(e.pointerId); } catch (_) {} stage.classList.remove("grabbing"); }
    stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
    stage.addEventListener("dblclick", function () { scale = 1; tx = 0; ty = 0; apply(); });
    return { zoomBy: function (f) { var r = stage.getBoundingClientRect(); zoomAt(f, r.width / 2, r.height / 2); }, reset: function () { scale = 1; tx = 0; ty = 0; apply(); } };
  }
})();
