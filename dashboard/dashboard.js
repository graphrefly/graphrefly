/* GraphReFly · Control — client renderer (classic script, file:// safe).
   build.mjs emits a semantic skeleton (#topbar #gauges #tabs #view-* #footer);
   this PROGRESSIVELY ENHANCES those named containers. build.mjs owns DATA. */
(function () {
  "use strict";
  var payload = JSON.parse(document.getElementById("payload").textContent);
  var M = payload.model, G = payload.gaps, C = payload.counts, A = payload.authority;
  var gapTotal = Object.keys(G).reduce(function (n, k) { return n + G[k].length; }, 0);
  var $ = function (id) { return document.getElementById(id); };
  var dogfoodFacts = (payload.dogfood && payload.dogfood.facts ? payload.dogfood.facts : []).slice();
  var DOGFOOD_STATUSES = ["all", "ready", "running", "completed", "failed", "blocked", "timeout", "canceled", "none"];
  var WORKBENCH_SNAPSHOT_KEY = "graphrefly.dashboard.workbench.session.v1";
  var WORKBENCH_SESSION_FACT_KINDS = [
    "workbench-selection",
    "workbench-lane-filter",
    "workbench-status-filter",
    "workbench-scope",
    "workbench-inspector-filter",
    "workbench-active-projection-index",
  ];

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
    { id: "authority", label: "Authority", cnt: A.unresolvedConflicts.length },
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

  // ===== AUTHORITY (D783 / D784 generated views) =====
  (function () {
    var v = $("view-authority");
    var F = A.federation || { ledgers: [], qualified_ids: [], relocations: [], unverified_relocations: [] };
    var CP = F.current_product || { complete: false, current_qualified_ids: [], current_by_owner: {}, historical_qualified_ids: [] };
    var metricTiles = h("div", { class: "gaptiles" });
    [
      [A.metrics.currentProtocolRules, "current protocol rules"],
      [A.metrics.draftProtocolRules, "draft protocol rules omitted"],
      [A.metrics.unresolvedRefs, "unresolved refs"],
      [A.metrics.supersessionCycles, "supersession cycles"],
      [A.metrics.exactDuplicateCurrentRuleStatements, "duplicate current rules"],
      [A.metrics.activeUncoveredRules, "current rules without scenarios"],
      [A.metrics.unclassifiedDecisions, "current root decisions awaiting concern"],
      [CP.current_qualified_ids.length, "current product decisions across owners"],
      [F.relocations.length, "relocated historical records"],
      [F.unverified_relocations.length, "external bodies not verified in root-only build"],
    ].forEach(function (metric) {
      metricTiles.appendChild(h("div", { class: "gaptile" + (metric[0] === 0 ? " zero" : "") }, [
        h("div", { class: "gn" }, [String(metric[0])]),
        h("div", { class: "gl" }, [metric[1]]),
      ]));
    });

    var protocol = h("table", { class: "matrix" }, [h("tr", {}, [
      h("th", {}, ["rule"]), h("th", {}, ["area"]), h("th", {}, ["decisions"]), h("th", {}, ["scenarios"]),
    ])]);
    A.currentProtocol.rules.forEach(function (rule) {
      protocol.appendChild(h("tr", {}, [
        h("td", { class: "cid" }, [rule.id]),
        h("td", {}, [rule.area]),
        h("td", {}, [rule.decisions.join(", ") || "—"]),
        h("td", {}, [rule.conformance.join(", ") || "pending"]),
      ]));
    });

    var state = h("div", { class: "grid cols", style: "margin-top:1.4rem" }, [
      h("div", { class: "alert-panel " + (CP.complete ? "ok" : "orphan") }, [
        h("b", {}, ["Product constitution · " + A.currentProductConstitution.state]),
        h("p", {}, [CP.complete
          ? CP.current_qualified_ids.length + " current non-superseded durable decision(s) derived across owner ledgers; " + A.metrics.unclassifiedDecisions + " current root concern label(s) remain legacy-unclassified."
          : "Root-only projection is incomplete while owner bodies are unavailable; run dashboard:workspace."]),
      ]),
      h("div", { class: "alert-panel " + (A.gateOk ? "ok" : "broken") }, [
        h("b", {}, [A.gateOk ? "✓ authority gate clean" : "⚠ authority gate failed"]),
        h("p", {}, [A.supersessionGraph.edges.length + " supersession edge(s) · reverse edges generated · no hand-maintained superseded-by"]),
      ]),
      h("div", { class: "alert-panel " + (A.metrics.draftProtocolRules ? "orphan" : "ok") }, [
        h("b", {}, [A.metrics.draftProtocolRules ? "Protocol activation review incomplete" : "✓ no draft protocol revisions"]),
        h("p", {}, [A.metrics.draftProtocolRules
          ? A.metrics.draftProtocolRules + " draft rule revision(s) are omitted from the current/public projection; their text is not silently promoted by implementation evidence."
          : "Every terminal protocol revision has explicit activation provenance."]),
      ]),
      h("div", { class: "alert-panel " + (F.unverified_relocations.length ? "orphan" : "ok") }, [
        h("b", {}, [F.unverified_relocations.length ? "Workspace verification required" : "✓ relocation bodies verified"]),
        h("p", {}, [F.unverified_relocations.length
          ? F.unverified_relocations.length + " external relocation body/bodies are locator-resolved but not hash-verified by this root-only build; run authority:check:workspace."
          : "Every relocation body loaded by this build matches its canonical locator hash."]),
      ]),
    ]);
    var ownership = h("table", { class: "matrix" }, [h("tr", {}, [
      h("th", {}, ["origin"]), h("th", {}, ["owner"]), h("th", {}, ["class"]), h("th", {}, ["canonical ledger"]), h("th", {}, ["state"]), h("th", {}, ["records"]),
    ])]);
    F.ledgers.forEach(function (ledger) {
      ownership.appendChild(h("tr", {}, [
        h("td", { class: "cid" }, [ledger.origin]),
        h("td", {}, [ledger.owner]),
        h("td", {}, [ledger.authority_class]),
        h("td", {}, [ledger.path]),
        h("td", {}, [ledger.state]),
        h("td", {}, [ledger.records == null ? "—" : String(ledger.records)]),
      ]));
    });
    var currentOwners = h("table", { class: "matrix" }, [h("tr", {}, [
      h("th", {}, ["owner"]), h("th", {}, ["current"]), h("th", {}, ["governing identities"]),
    ])]);
    Object.keys(CP.current_by_owner).sort().forEach(function (owner) {
      var ids = CP.current_by_owner[owner];
      currentOwners.appendChild(h("tr", {}, [
        h("td", {}, [owner]),
        h("td", {}, [String(ids.length)]),
        h("td", {}, [ids.slice(0, 12).join(", ") + (ids.length > 12 ? " …" : "")]),
      ]));
    });
    fill(v, [
      sectionH("Generated authority", "D783 ownership · D784 current protocol · fail closed"),
      metricTiles,
      state,
      sectionH("Authority ownership map", F.qualified_ids.length + " decision identities loaded in this build"),
      ownership,
      sectionH("Current product constitution by owner", CP.complete ? "complete workspace-derived terminal set" : "incomplete root-only projection"),
      currentOwners,
      sectionH("Current protocol constitution", A.currentProtocol.projection),
      protocol,
    ]);
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
    if (fact.kind === "workbench-scope") return fact.scope || "";
    if (fact.kind === "workbench-lane-filter") return fact.lane || "";
    if (fact.kind === "workbench-status-filter") return fact.status || "";
    if (fact.kind === "workbench-filter-option") return fact.filterKind && fact.value ? fact.filterKind + ":" + fact.value : "";
    if (fact.kind === "workbench-inspector-filter") return fact.filterKind && fact.value ? fact.filterKind + ":" + fact.value : "";
    if (fact.kind === "workbench-operation-policy") return fact.policyId || fact.commandKind || "";
    if (fact.kind === "workbench-triage-projection") return fact.projectionId || "";
    if (fact.kind === "workbench-triage-item") return fact.triageItemId || "";
    if (fact.kind === "workbench-active-projection-index") return fact.indexId || "";
    if (fact.kind === "workbench-session-snapshot" || fact.kind === "workbench-session-restore") return fact.snapshotId || fact.restoreId || "";
    if (fact.kind === "workbench-missing-input-request") return fact.requestId || "";
    if (fact.kind === "workbench-corrected-input-request") return fact.requestId || "";
    if (fact.kind === "workbench-request-superseded") return fact.supersededId || "";
    if (fact.kind === "workbench-retention-gap-inspection") return fact.inspectionId || "";
    if (fact.kind === "workbench-policy-denied-ack") return fact.ackId || "";
    return fact.commandId || fact.projectorRunId || fact.projectionId || fact.edgeId ||
      fact.workItemId || fact.planId || fact.requestId || fact.routeId || fact.profileId || fact.policyId ||
      fact.adapterInputId || fact.runId || fact.outcomeId || fact.resultId || fact.evidenceId ||
      fact.materialId || fact.proposalId || fact.approvalId || fact.reviewId || fact.admissionId || fact.applicationId || fact.statusId || fact.id || "";
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
  function workbenchScopedLedgerFacts(scope, selected, bundle) {
    if (scope === "global") return dogfoodFacts;
    var controlKinds = [
      "workbench-selection",
      "workbench-lane-filter",
      "workbench-status-filter",
      "workbench-scope",
      "workbench-filter-option",
      "workbench-inspector-filter",
      "workbench-operation-policy",
      "workbench-triage-projection",
      "workbench-triage-item",
      "workbench-active-projection-index",
      "workbench-session-snapshot",
      "workbench-session-restore",
      "workbench-missing-input-request",
      "workbench-corrected-input-request",
      "workbench-request-superseded",
      "workbench-retention-gap-inspection",
      "workbench-policy-denied-ack",
    ];
    if (!selected || !bundle) {
      return dogfoodFacts.filter(function (fact) { return controlKinds.indexOf(fact.kind) >= 0; });
    }
    var ids = [
      selected.id,
      selected.id + ":tool-request",
      bundle.request && bundle.request.requestId,
      bundle.agentRequest && bundle.agentRequest.requestId,
      bundle.adapterInput && bundle.adapterInput.adapterInputId,
      bundle.outcome && bundle.outcome.outcomeId,
      bundle.effectResult && bundle.effectResult.resultId,
    ];
    (bundle.runs || []).forEach(function (run) { ids.push(run.runId); });
    (bundle.actions || []).forEach(function (action) { ids.push(action.proposalId, action.approvalId, action.admissionId, action.applicationId, action.reviewId); });
    ids = ids.filter(Boolean);
    var commandIds = {};
    var scoped = dogfoodFacts.filter(function (fact) {
      if (controlKinds.indexOf(fact.kind) >= 0) return true;
      if (fact.kind === "workbench-command" && fact.workItemId === selected.id) return true;
      return dogfoodFactTouches(fact, ids);
    });
    scoped.forEach(function (fact) {
      var commandId = dogfoodCommandIdFrom(fact);
      if (commandId) commandIds[commandId] = true;
      if (fact.kind === "workbench-command" && fact.workItemId === selected.id) commandIds[fact.commandId] = true;
    });
    return dogfoodFacts.filter(function (fact) {
      if (scoped.indexOf(fact) >= 0) return true;
      var commandId = dogfoodCommandIdFrom(fact);
      if (commandId && commandIds[commandId]) return true;
      if (fact.kind === "workbench-provenance-edge" && commandIds[fact.commandId]) return true;
      return false;
    });
  }
  function dogfoodSelectedId() {
    var selections = dogfoodFactsByKind("workbench-selection");
    return (selections[selections.length - 1] || {}).workItemId || payload.dogfood.selectedWorkItemId;
  }
  function dogfoodCurrentLaneFilter() {
    var filters = dogfoodFactsByKind("workbench-lane-filter");
    var lane = (filters[filters.length - 1] || {}).lane || "all";
    return lane === "all" || lane === "queued" || lane === "running" || lane === "blocked" || lane === "complete" ? lane : "all";
  }
  function dogfoodCurrentStatusFilter() {
    var filters = dogfoodFactsByKind("workbench-status-filter");
    var status = (filters[filters.length - 1] || {}).status || "all";
    return DOGFOOD_STATUSES.indexOf(status) >= 0 ? status : "all";
  }
  function workbenchCurrentScope() {
    var scopes = dogfoodFactsByKind("workbench-scope");
    var scope = (scopes[scopes.length - 1] || {}).scope || "selected";
    return scope === "global" ? "global" : "selected";
  }
  function workbenchInspectorFilters() {
    var filters = {
      kind: "all",
      sourceRef: "all",
      issueCode: "all",
      coordinate: "all",
    };
    dogfoodFactsByKind("workbench-inspector-filter").forEach(function (fact) {
      if (fact.filterKind && Object.prototype.hasOwnProperty.call(filters, fact.filterKind)) {
        filters[fact.filterKind] = fact.value || "all";
      }
    });
    return filters;
  }
  function workbenchFactRef(fact) {
    var id = dogfoodFactId(fact);
    return id ? { kind: fact.kind || fact.factKind || "unknown", id: id } : null;
  }
  function workbenchSourceRefKey(ref) {
    return ref && ref.kind && ref.id ? ref.kind + ":" + ref.id : "";
  }
  function workbenchFactSourceKeys(fact) {
    var keys = [];
    ["sourceRefs", "evidenceRefs", "policyRefs", "materialRefs"].forEach(function (field) {
      (fact[field] || []).forEach(function (ref) {
        var key = workbenchSourceRefKey(ref);
        if (key && keys.indexOf(key) < 0) keys.push(key);
      });
    });
    return keys;
  }
  function workbenchCoordinateKeys(fact) {
    var c = fact && fact.metadata && fact.metadata.coordinate;
    return c && typeof c === "object" ? Object.keys(c).filter(function (key) { return c[key] != null; }) : [];
  }
  function workbenchCommandRef(commandId) {
    return { kind: "workbench-command", id: commandId };
  }
  function workbenchPolicies() {
    return dogfoodFactsByKind("workbench-operation-policy");
  }
  function workbenchPolicyFor(commandKind) {
    return workbenchPolicies().filter(function (policy) { return policy.commandKind === commandKind; }).slice(-1)[0] || null;
  }
  function workbenchPolicyRef(commandKind) {
    var policy = workbenchPolicyFor(commandKind);
    return policy ? { kind: "workbench-operation-policy", id: policy.policyId } : null;
  }
  function workbenchPolicyReason(commandKind, fallback) {
    var policy = workbenchPolicyFor(commandKind);
    return policy && policy.disabledReasonTemplate || fallback;
  }
  function workbenchPolicyGeneratedKinds(commandKind) {
    var policy = workbenchPolicyFor(commandKind);
    return policy && Array.isArray(policy.generatedFactKinds) ? policy.generatedFactKinds : [];
  }
  function workbenchPolicyAllowsGeneratedKind(commandKind, factKind) {
    var kinds = workbenchPolicyGeneratedKinds(commandKind);
    return kinds.indexOf(factKind) >= 0 ||
      (kinds.indexOf("executor-outcome") >= 0 && ["result", "failure", "blocked", "timeout", "canceled"].indexOf(factKind) >= 0);
  }
  function workbenchPolicyUnauthorizedGeneratedKinds(commandKind, facts) {
    var policy = workbenchPolicyFor(commandKind);
    if (!policy) return ["missing-policy"];
    return Array.from(new Set((facts || []).map(function (fact) { return fact.kind || fact.factKind || "unknown"; }).filter(function (kind) {
      return !workbenchPolicyAllowsGeneratedKind(commandKind, kind);
    })));
  }
  function workbenchValidWorkItemId(candidate, fallback) {
    var ids = dogfoodFactsByKind("work-item").map(function (item) { return item.workItemId; });
    if (ids.indexOf(candidate) >= 0) return candidate;
    if (ids.indexOf(fallback) >= 0) return fallback;
    return ids[0] || "";
  }
  function workbenchIdempotencyKey(policy, commandKind, workItemId, params) {
    var p = params || {};
    var template = policy && policy.idempotencyKey || "commandKind+targetRef";
    var fields = template.split("+").map(function (field) {
      if (field === "commandKind") return commandKind;
      if (field === "workItemId") return workItemId || "none";
      if (field === "targetRef") return p.triageItemId || p.proposalId || p.adapterInputId || p.snapshotId || workItemId || "none";
      if (field === "filterKind") return p.filterKind || (commandKind.indexOf("lane") >= 0 ? "lane" : commandKind.indexOf("status") >= 0 ? "status" : "filter");
      if (field === "value") return p.value || "default";
      if (field === "scope") return p.scope || "selected";
      if (field === "proposalSeq") return p.proposalSeq || "default";
      if (field === "actionKind") return p.actionKind || "default";
      if (field === "proposalId") return p.proposalId || "none";
      if (field === "adapterInputId") return p.adapterInputId || "none";
      if (field === "attempt") return p.attempt || "none";
      if (field === "issueId") return p.issueId || p.triageItemId || p.issueCode || "none";
      if (field === "requestId") return p.requestId || p.triageItemId || "none";
      if (field === "snapshotId") return p.snapshotId || "local";
      if (p[field] != null) return p[field];
      return field;
    });
    return fields.join("|");
  }
  function workbenchCommand(commandKind, workItemId, targetRefs, params) {
    var seq = dogfoodFactsByKind("workbench-command").length + 1;
    var commandId = "workbench:" + commandKind + ":" + seq;
    var policy = workbenchPolicyFor(commandKind);
    var idempotencyKey = workbenchIdempotencyKey(policy, commandKind, workItemId, params);
    return {
      kind: "workbench-command",
      commandId: commandId,
      commandKind: commandKind,
      policyId: policy && policy.policyId,
      workItemId: workItemId,
      targetRefs: targetRefs || [],
      params: params || {},
      idempotencyKey: idempotencyKey,
      issuedAtMs: 1_500 + seq,
      sourceRefs: targetRefs || [],
      metadata: {
        commandId: commandId,
        policyId: policy && policy.policyId,
        idempotencyKey: idempotencyKey,
        dashboardPrivate: true,
        visibleUiFact: true,
        bounded: true,
        coordinate: { commandId: commandId, workItemId: workItemId },
      },
    };
  }
  function workbenchProvenanceEdges(command, generatedFacts, projectorRunId, projectionId) {
    var commandRef = workbenchCommandRef(command.commandId);
    var edges = generatedFacts.map(function (fact, index) {
      var toRef = workbenchFactRef(fact);
      return {
        kind: "workbench-provenance-edge",
        edgeId: command.commandId + ":edge:" + (index + 1),
        fromRef: commandRef,
        toRef: toRef || { kind: fact.kind || "unknown", id: "no-id" },
        relation: "generated",
        commandId: command.commandId,
        issueCode: fact.issueCode || fact.code,
        sourceRefs: [commandRef],
        metadata: {
          bounded: true,
          coordinate: { commandId: command.commandId, relation: "generated", ordinal: index + 1 },
        },
      };
    });
    if (projectorRunId && projectionId) {
      edges.push({
        kind: "workbench-provenance-edge",
        edgeId: command.commandId + ":edge:projector-run",
        fromRef: commandRef,
        toRef: { kind: "workbench-projector-run", id: projectorRunId },
        relation: "projected",
        commandId: command.commandId,
        projectorRunId: projectorRunId,
        sourceRefs: [commandRef],
        metadata: { bounded: true, coordinate: { commandId: command.commandId, projectorRunId: projectorRunId } },
      }, {
        kind: "workbench-provenance-edge",
        edgeId: command.commandId + ":edge:view-projection",
        fromRef: { kind: "workbench-projector-run", id: projectorRunId },
        toRef: { kind: "workbench-view-projection", id: projectionId },
        relation: "updates-ui-projection",
        commandId: command.commandId,
        projectorRunId: projectorRunId,
        sourceRefs: [{ kind: "workbench-projector-run", id: projectorRunId }],
        metadata: { bounded: true, coordinate: { commandId: command.commandId, projectionId: projectionId } },
      });
    }
    return edges;
  }
  function workbenchProjectedTriageFacts(command, pendingGeneratedFacts) {
    var commandRef = workbenchCommandRef(command.commandId);
    var view = deriveDogfoodView(dogfoodFacts.concat([command], pendingGeneratedFacts || []));
    var projectionId = command.commandId + ":triage-projection";
    var items = (view.triageItems || []).map(function (item, index) {
      return {
        kind: "workbench-triage-item",
        triageItemId: command.commandId + ":triage-item:" + (index + 1),
        workItemId: item.workItemId,
        category: item.category,
        severity: item.severity,
        actionability: item.actionability,
        recommendedCommandKinds: item.recommendedCommandKinds,
        disabledReason: item.disabledReason,
        sourceRefs: [commandRef].concat(item.sourceRefs || []).slice(0, 8),
        policyRefs: item.policyRefs || [],
        metadata: {
          commandId: command.commandId,
          projectorId: "dashboard-private-triage-projector",
          dashboardPrivate: true,
          visibleUiFact: true,
          bounded: true,
          coordinate: { workItemId: item.workItemId, category: item.category, ordinal: index + 1 },
        },
      };
    });
    return [{
      kind: "workbench-triage-projection",
      projectionId: projectionId,
      projectionKind: "workbench-triage",
      itemRefs: items.map(function (item) { return { kind: "workbench-triage-item", id: item.triageItemId }; }),
      policyRefs: workbenchPolicies().map(function (policy) { return { kind: "workbench-operation-policy", id: policy.policyId }; }),
      sourceRefs: [commandRef],
      metadata: {
        commandId: command.commandId,
        projectorId: "dashboard-private-triage-projector",
        dashboardPrivate: true,
        visibleFactsOnly: true,
        bounded: true,
        coordinate: { commandId: command.commandId, itemCount: items.length },
      },
    }].concat(items);
  }
  function workbenchAppendCommand(command, generatedFacts, summary, projectorId, resultStatus) {
    generatedFacts = generatedFacts || [];
    generatedFacts = generatedFacts.concat(workbenchProjectedTriageFacts(command, generatedFacts));
    var nextSelection = generatedFacts.filter(function (fact) { return fact.kind === "workbench-selection"; }).slice(-1)[0];
    var nextScope = generatedFacts.filter(function (fact) { return fact.kind === "workbench-scope"; }).slice(-1)[0];
    var nextLane = generatedFacts.filter(function (fact) { return fact.kind === "workbench-lane-filter"; }).slice(-1)[0];
    var nextStatus = generatedFacts.filter(function (fact) { return fact.kind === "workbench-status-filter"; }).slice(-1)[0];
    var resultId = command.commandId + ":result";
    var projectorRunId = command.commandId + ":projector-run";
    var projectionId = command.commandId + ":view-projection";
    var activeIndex = {
      kind: "workbench-active-projection-index",
      indexId: command.commandId + ":active-projection-index",
      activeProjectionId: projectionId,
      commandId: command.commandId,
      selectedWorkItemId: nextSelection ? nextSelection.workItemId : dogfoodSelectedId(),
      scope: nextScope ? nextScope.scope : workbenchCurrentScope(),
      lane: nextLane ? nextLane.lane : dogfoodCurrentLaneFilter(),
      status: nextStatus ? nextStatus.status : dogfoodCurrentStatusFilter(),
      sourceRefs: [workbenchCommandRef(command.commandId)],
      metadata: {
        dashboardPrivate: true,
        visibleUiFact: true,
        bounded: true,
        coordinate: { commandId: command.commandId, projectionId: projectionId },
      },
    };
    var visibleGeneratedFacts = generatedFacts.concat(activeIndex);
    var generatedRefs = visibleGeneratedFacts.map(workbenchFactRef).filter(Boolean);
    var commandResult = {
      kind: "workbench-command-result",
      resultId: resultId,
      commandId: command.commandId,
      status: resultStatus || (generatedFacts.length ? "appended" : "no-op"),
      generatedRefs: generatedRefs,
      summary: summary,
      issueRefs: generatedRefs.filter(function (ref) { return ref.kind === "issue"; }),
      materialRefs: generatedRefs.filter(function (ref) { return ref.kind === "tool-provider-material-ref"; }),
      policyRefs: command.policyId ? [{ kind: "workbench-operation-policy", id: command.policyId }] : [],
      sourceRefs: [workbenchCommandRef(command.commandId)],
      metadata: {
        bounded: true,
        policyId: command.policyId,
        idempotencyKey: command.idempotencyKey,
        coordinate: { commandId: command.commandId, generatedCount: generatedRefs.length },
      },
    };
    var projectorRun = {
      kind: "workbench-projector-run",
      projectorRunId: projectorRunId,
      projectorId: projectorId || "dashboard-private-workbench-projector",
      commandId: command.commandId,
      status: "completed",
      inputRefs: [workbenchCommandRef(command.commandId), { kind: "workbench-command-result", id: resultId }].concat(command.policyId ? [{ kind: "workbench-operation-policy", id: command.policyId }] : []),
      outputRefs: [{ kind: "workbench-view-projection", id: projectionId }, { kind: "workbench-active-projection-index", id: activeIndex.indexId }],
      sourceRefs: [{ kind: "workbench-command-result", id: resultId }],
      metadata: {
        bounded: true,
        visibleFactsOnly: true,
        coordinate: { commandId: command.commandId, projectorId: projectorId || "dashboard-private-workbench-projector" },
      },
    };
    var provenanceEdges = workbenchProvenanceEdges(command, visibleGeneratedFacts, projectorRunId, projectionId);
    var viewProjection = {
      kind: "workbench-view-projection",
      projectionId: projectionId,
      projectionKind: "workbench-view",
      selectedWorkItemId: nextSelection ? nextSelection.workItemId : dogfoodSelectedId(),
      scope: nextScope ? nextScope.scope : workbenchCurrentScope(),
      lane: nextLane ? nextLane.lane : dogfoodCurrentLaneFilter(),
      status: nextStatus ? nextStatus.status : dogfoodCurrentStatusFilter(),
      factsCount: dogfoodFacts.length + 1 + visibleGeneratedFacts.length + 3 + provenanceEdges.length,
      inputRefs: generatedRefs.slice(0, 16),
      sourceRefs: [{ kind: "workbench-projector-run", id: projectorRunId }],
      metadata: {
        dashboardPrivate: true,
        bounded: true,
        coordinate: { commandId: command.commandId, projectionId: projectionId },
      },
    };
    dogfoodAppend([command].concat(
      visibleGeneratedFacts,
      [commandResult, projectorRun, viewProjection],
      provenanceEdges,
    ));
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
  function deriveDogfoodView(factsOverride) {
    var viewFacts = factsOverride || dogfoodFacts;
    function factsByKind(kind) {
      return viewFacts.filter(function (fact) { return fact.kind === kind; });
    }
    function records(kind) {
      return viewFacts.filter(function (fact) { return fact.kind === kind || fact.factKind === kind; });
    }
    var workItems = factsByKind("work-item");
    var deps = factsByKind("work-item-dependency");
    var effectPlanFacts = factsByKind("work-item-effect-plan");
    var effectRequests = factsByKind("work-item-effect-requested");
    var agentRequests = factsByKind("issued");
    var routes = factsByKind("executor-route");
    var profiles = records("executor-profile");
    var policies = factsByKind("tool-provider-execution-policy");
    var adapterInputs = factsByKind("tool-provider-adapter-input");
    var requestAdmissions = factsByKind("tool-provider-request-admission");
    var runRequests = factsByKind("tool-provider-adapter-run-requested");
    var runStatuses = factsByKind("tool-provider-adapter-run-status");
    var runtimeStatuses = factsByKind("tool-provider-adapter-runtime-status");
    var retentionEvidence = factsByKind("tool-provider-retention-evidence");
    var materialRefs = factsByKind("tool-provider-material-ref");
    var outcomes = viewFacts.filter(function (f) { return f.kind === "result" || f.kind === "failure" || f.kind === "blocked" || f.kind === "timeout" || f.kind === "canceled"; });
    var effectResults = factsByKind("effect-run-result");
    var evidence = factsByKind("work-item-evidence-recorded");
    var issues = viewFacts.filter(function (f) { return f.kind === "issue"; });
    var audit = factsByKind("agent-runtime-audit");
    var actions = viewFacts.filter(function (f) {
      return f.kind === "work-item-domain-action-proposal" || f.kind === "work-item-domain-action-approval" ||
        f.kind === "work-item-domain-action-admission" || f.kind === "work-item-domain-action-application" ||
        f.kind === "work-item-domain-action-rejection" || f.kind === "work-item-domain-action-cancellation";
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
    viewFacts.forEach(function (fact) {
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
    function inferWorkItemId(fact) {
      var c = fact && fact.metadata && fact.metadata.coordinate || {};
      var ids = [fact && fact.workItemId, fact && fact.subjectId, c.workItemId, c.subjectId, c.requestId, c.adapterInputId, c.runId].filter(Boolean);
      for (var i = 0; i < ids.length; i += 1) {
        if (nodeById[ids[i]]) return ids[i];
        var prefix = String(ids[i]).split(":").slice(0, 2).join(":");
        if (nodeById[prefix]) return prefix;
        for (var j = 0; j < nodes.length; j += 1) {
          if (String(ids[i]).indexOf(nodes[j].id + ":") === 0) return nodes[j].id;
        }
      }
      return selectedWorkItemId;
    }
    function hasIssue(workItemId, code) {
      return issues.some(function (issue) {
        return (issue.issueCode || issue.code) === code && dogfoodFactTouches(issue, [workItemId, workItemId + ":tool-request"]);
      });
    }
    function readyInputFor(workItemId) {
      var input = inputByWorkItem[workItemId];
      if (!input || input.status !== "ready") return false;
      return !hasIssue(workItemId, "retention-gap") && !hasIssue(workItemId, "policy-denied");
    }
    function triageCategory(code, fact) {
      if (code === "policy-denied") return "policy-denied";
      if (code === "approval-needed") return "approval-needed";
      if (code === "retention-gap") return "retention-gap";
      if (code === "missing-input") return "missing-input";
      if (code === "stale-request") return "stale-request";
      if (code === "mismatched-request") return "mismatched-request";
      if (code === "failed" || code === "timeout" || code === "canceled") return code;
      if (fact && (fact.kind === "failure" || fact.kind === "timeout" || fact.kind === "canceled")) return dogfoodResultStatus(fact.kind);
      return "inspect";
    }
    function triageRecommendation(category, workItemId) {
      function withPolicy(actionability, commands, fallbackReason) {
        var policies = commands.map(workbenchPolicyFor).filter(Boolean);
        return {
          actionability: actionability,
          commands: commands.filter(function (commandKind) { return !!workbenchPolicyFor(commandKind); }),
          reason: policies[0] && policies[0].disabledReasonTemplate || fallbackReason,
        };
      }
      if (category === "policy-denied") return withPolicy("acknowledge", ["acknowledge-policy-denied"], "Policy-denied is inspect/acknowledge only; approval cannot bypass policy.");
      if (category === "approval-needed") return withPolicy("review", ["approve-domain-action", "reject-domain-action", "cancel-domain-action"], "A non-terminal proposal can be approved, rejected, or canceled.");
      if (category === "retention-gap") return withPolicy("inspect-only", ["inspect-retention-gap"], "Retention-gap proof fails closed; retry repair is disabled.");
      if (category === "missing-input") return withPolicy("request-input", ["request-missing-input"], "Request corrected input; do not substitute missing input for retention evidence.");
      if (category === "stale-request") return withPolicy("mark-superseded", ["mark-stale-superseded"], "Stale admission can be marked superseded as dashboard-private session material.");
      if (category === "mismatched-request") return withPolicy("request-corrected-input", ["request-corrected-input"], "Request corrected input and inspect the mismatch; do not treat it as retention evidence.");
      if (category === "failed" || category === "timeout" || category === "canceled") {
        return readyInputFor(workItemId)
          ? withPolicy("retry-ready", ["run-visible-effect"], "Retry is bounded and visible because ready input exists and no retention-gap is present.")
          : { actionability: "inspect-only", commands: [], reason: "Retry is disabled until ready input exists and retention-gap is absent." };
      }
      return { actionability: "inspect-only", commands: [], reason: "Inspect the visible fact chain." };
    }
    function severityFor(category, fact) {
      if (category === "retention-gap" || category === "policy-denied" || category === "failed" || category === "timeout") return "error";
      return fact && fact.severity || "warning";
    }
    var triageSourceFacts = [];
    issues.forEach(function (issue) { triageSourceFacts.push({ code: issue.issueCode || issue.code, fact: issue }); });
    requestAdmissions.forEach(function (admission) {
      if (admission.state === "stale-request" || admission.state === "mismatched-request") {
        triageSourceFacts.push({ code: admission.state, fact: admission });
      }
    });
    var latestOutcomeByRequest = {};
    outcomes.forEach(function (outcome) {
      latestOutcomeByRequest[outcome.requestId || dogfoodFactId(outcome)] = outcome;
    });
    Object.keys(latestOutcomeByRequest).forEach(function (key) {
      var outcome = latestOutcomeByRequest[key];
      var status = dogfoodResultStatus(outcome.kind);
      if (status === "failed" || status === "timeout" || status === "canceled") triageSourceFacts.push({ code: status, fact: outcome });
    });
    var triageItems = [];
    var seenTriage = {};
    triageSourceFacts.forEach(function (entry) {
      var category = triageCategory(entry.code, entry.fact);
      var workItemId = inferWorkItemId(entry.fact);
      var factId = dogfoodFactId(entry.fact) || category;
      var key = workItemId + "|" + category;
      if (seenTriage[key]) {
        seenTriage[key].sourceRefs = seenTriage[key].sourceRefs.concat([workbenchFactRef(entry.fact)].filter(Boolean));
        return;
      }
      var rec = triageRecommendation(category, workItemId);
      var policyRefs = rec.commands.map(workbenchPolicyRef).filter(Boolean);
      triageItems.push({
        kind: "workbench-triage-item",
        triageItemId: "triage:" + workItemId + ":" + category + ":" + triageItems.length,
        workItemId: workItemId,
        category: category,
        severity: severityFor(category, entry.fact),
        actionability: rec.actionability,
        recommendedCommandKinds: rec.commands,
        disabledReason: rec.reason,
        sourceRefs: [workbenchFactRef(entry.fact)].filter(Boolean),
        policyRefs: policyRefs,
        metadata: {
          dashboardPrivate: true,
          visibleUiFact: true,
          bounded: true,
          coordinate: { workItemId: workItemId, category: category, sourceFactId: factId },
        },
      });
      seenTriage[key] = triageItems[triageItems.length - 1];
    });
    triageItems.sort(function (a, b) {
      var severityRank = { error: 0, warning: 1, info: 2 };
      var actionRank = { "retry-ready": 0, review: 1, "request-input": 2, "request-corrected-input": 3, "mark-superseded": 4, acknowledge: 5, "inspect-only": 6 };
      return (severityRank[a.severity] || 3) - (severityRank[b.severity] || 3) ||
        (actionRank[a.actionability] || 9) - (actionRank[b.actionability] || 9) ||
        a.category.localeCompare(b.category);
    });
    var triageProjection = {
      kind: "workbench-triage-projection",
      projectionId: "workbench-triage:" + viewFacts.length,
      projectionKind: "workbench-triage",
      itemRefs: triageItems.map(function (item) { return { kind: "workbench-triage-item", id: item.triageItemId }; }),
      policyRefs: workbenchPolicies().map(function (policy) { return { kind: "workbench-operation-policy", id: policy.policyId }; }),
      sourceRefs: [{ kind: "dashboard-private-view-model", id: "triage-projection" }],
      metadata: {
        dashboardPrivate: true,
        visibleFactsOnly: true,
        bounded: true,
        coordinate: { items: triageItems.length, facts: viewFacts.length },
      },
    };
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
      operationPolicies: workbenchPolicies(),
      triageProjection: triageProjection,
      triageItems: triageItems,
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
        triage: triageItems.length,
        facts: viewFacts.length,
      },
    };
  }
  function dogfoodAppend(facts) {
    dogfoodFacts = dogfoodFacts.concat(facts);
    renderDogfood();
  }
  function dogfoodAppendFilter(kind, value) {
    var current = kind === "lane" ? dogfoodCurrentLaneFilter() : dogfoodCurrentStatusFilter();
    var command = workbenchCommand("set-" + kind + "-filter", dogfoodSelectedId(), [{ kind: "workbench-filter", id: kind }], { value: value });
    if (current === value) {
      workbenchAppendCommand(command, [], kind + " filter already equals " + value + ".", "dashboard-private-filter-projector", "no-op");
      return;
    }
    var generatedFacts = [{
      kind: kind === "lane" ? "workbench-lane-filter" : "workbench-status-filter",
      lane: kind === "lane" ? value : undefined,
      status: kind === "status" ? value : undefined,
      sourceRefs: [workbenchCommandRef(command.commandId)],
      metadata: { commandId: command.commandId, visibleUiFact: true, bounded: true, coordinate: { filterKind: kind, value: value } },
    }];
    var unauthorized = workbenchPolicyUnauthorizedGeneratedKinds(command.commandKind, generatedFacts);
    if (unauthorized.length) {
      workbenchAppendCommand(command, [], "WorkbenchOperationPolicy does not authorize generated fact kinds: " + unauthorized.join(", ") + ".", "dashboard-private-filter-projector", "denied");
      return;
    }
    workbenchAppendCommand(command, generatedFacts, "Updated " + kind + " filter from a visible Workbench command.", "dashboard-private-filter-projector");
  }
  function workbenchAppendScope(value) {
    var current = workbenchCurrentScope();
    var command = workbenchCommand("set-scope", dogfoodSelectedId(), [{ kind: "workbench-scope", id: value }], { scope: value });
    if (current === value) {
      workbenchAppendCommand(command, [], "Scope already equals " + value + ".", "dashboard-private-scope-projector", "no-op");
      return;
    }
    var generatedFacts = [{
      kind: "workbench-scope",
      scope: value,
      sourceRefs: [workbenchCommandRef(command.commandId)],
      metadata: { commandId: command.commandId, visibleUiFact: true, bounded: true, coordinate: { filterKind: "scope", value: value } },
    }];
    var unauthorized = workbenchPolicyUnauthorizedGeneratedKinds(command.commandKind, generatedFacts);
    if (unauthorized.length) {
      workbenchAppendCommand(command, [], "WorkbenchOperationPolicy does not authorize generated fact kinds: " + unauthorized.join(", ") + ".", "dashboard-private-scope-projector", "denied");
      return;
    }
    workbenchAppendCommand(command, generatedFacts, "Updated Workbench scope from a visible command.", "dashboard-private-scope-projector");
  }
  function workbenchAppendInspectorFilter(filterKind, value) {
    var filters = workbenchInspectorFilters();
    var command = workbenchCommand("set-inspector-filter", dogfoodSelectedId(), [{ kind: "workbench-inspector-filter", id: filterKind }], { filterKind: filterKind, value: value });
    if (filters[filterKind] === value) {
      workbenchAppendCommand(command, [], "Inspector filter already equals " + value + ".", "dashboard-private-inspector-filter-projector", "no-op");
      return;
    }
    var generatedFacts = [{
      kind: "workbench-inspector-filter",
      filterKind: filterKind,
      value: value,
      sourceRefs: [workbenchCommandRef(command.commandId)],
      metadata: { commandId: command.commandId, visibleUiFact: true, bounded: true, coordinate: { filterKind: filterKind, value: value } },
    }];
    var unauthorized = workbenchPolicyUnauthorizedGeneratedKinds(command.commandKind, generatedFacts);
    if (unauthorized.length) {
      workbenchAppendCommand(command, [], "WorkbenchOperationPolicy does not authorize generated fact kinds: " + unauthorized.join(", ") + ".", "dashboard-private-inspector-filter-projector", "denied");
      return;
    }
    workbenchAppendCommand(command, generatedFacts, "Updated fact inspector filter from graph-visible options.", "dashboard-private-inspector-filter-projector");
  }
  function dogfoodActionState(view, bundle, selectionVisible) {
    var selectedId = view && view.selected && view.selected.id;
    var selectedTriage = selectedId ? (view.triageItems || []).filter(function (item) { return item.workItemId === selectedId; }) : [];
    var topTriage = selectedTriage[0];
    if (!selectionVisible || !view.selected) {
      return {
        canRun: false,
        canPropose: false,
        canApprove: false,
        canReject: false,
        canCancel: false,
        runLabel: "Run fake effect",
        runReason: "No visible WorkItem selected.",
        proposeReason: "No visible WorkItem selected.",
        approveReason: "No proposal is selected.",
        rejectReason: "No proposal is selected.",
        cancelReason: "No proposal is selected.",
        recommended: selectedTriage,
      };
    }
    var input = bundle && bundle.adapterInput;
    var runCount = bundle && bundle.runs ? bundle.runs.length : 0;
    var latestProposal = (bundle && bundle.actions || []).filter(function (item) {
      return item.kind === "work-item-domain-action-proposal";
    }).slice(-1)[0];
    var proposalFacts = latestProposal ? (bundle.actions || []).filter(function (item) {
      return item.proposalId === latestProposal.proposalId;
    }) : [];
    var approved = proposalFacts.some(function (item) { return item.kind === "work-item-domain-action-approval"; });
    var rejected = proposalFacts.some(function (item) { return item.kind === "work-item-domain-action-rejection"; });
    var canceled = proposalFacts.some(function (item) { return item.kind === "work-item-domain-action-cancellation"; });
    var applied = proposalFacts.some(function (item) {
      return item.kind === "work-item-domain-action-application" && item.state === "applied";
    });
    var admissionOk = !bundle.admission || bundle.admission.state === "admitted";
    var retentionGap = !!(bundle.runtimeStatus && bundle.runtimeStatus.status === "retention-gap") ||
      (bundle.issues || []).some(function (issue) { return (issue.issueCode || issue.code) === "retention-gap"; });
    var policyDenied = selectedTriage.some(function (item) { return item.category === "policy-denied"; }) ||
      (bundle.issues || []).some(function (issue) { return (issue.issueCode || issue.code) === "policy-denied"; });
    var retryReady = selectedTriage.some(function (item) { return item.actionability === "retry-ready"; });
    var hasRunPolicy = !!workbenchPolicyFor("run-visible-effect");
    var hasProposePolicy = !!workbenchPolicyFor("propose-domain-action");
    var hasApprovePolicy = !!workbenchPolicyFor("approve-domain-action");
    var hasRejectPolicy = !!workbenchPolicyFor("reject-domain-action");
    var hasCancelPolicy = !!workbenchPolicyFor("cancel-domain-action");
    var canRun = !!(hasRunPolicy && input && input.status === "ready" && admissionOk && !retentionGap && !policyDenied && (retryReady || !selectedTriage.length || selectedTriage.every(function (item) {
      return ["approval-needed", "missing-input", "stale-request", "mismatched-request", "policy-denied", "retention-gap"].indexOf(item.category) < 0;
    })));
    var runReason = canRun ? "Actions append visible facts; projector facts re-derive from the ledger." :
      !hasRunPolicy ? "No dashboard-private operation policy is visible for run-visible-effect." :
      retentionGap ? workbenchPolicyReason("run-visible-effect", "Retention-gap proof exists for this coordinate; fake runtime fails closed.") :
        policyDenied ? "Policy-denied is inspect/acknowledge only; retry and approval bypass stay disabled." :
          topTriage ? topTriage.disabledReason :
        !admissionOk ? "Request admission is not admitted for this coordinate." :
          "No ready adapter input for the selected WorkItem.";
    var actionableProposal = !!(latestProposal && !approved && !rejected && !canceled && !applied);
    return {
      canRun: canRun,
      canPropose: hasProposePolicy && !policyDenied,
      canApprove: hasApprovePolicy && actionableProposal && !policyDenied,
      canReject: hasRejectPolicy && actionableProposal,
      canCancel: hasCancelPolicy && actionableProposal,
      runLabel: runCount > 0 ? "Retry visible run" : "Run fake effect",
      runReason: runReason,
      proposeReason: !hasProposePolicy ? "No dashboard-private operation policy is visible for propose-domain-action." :
        policyDenied ? workbenchPolicyReason("propose-domain-action", "Policy-denied is inspect/acknowledge only; proposing approval work would bypass policy.") : "Append a graph-visible WorkItemDomainActionProposal fact.",
      approveReason: policyDenied ? "Policy-denied cannot be bypassed by UI approval." :
        !hasApprovePolicy ? "No dashboard-private operation policy is visible for approve-domain-action." :
        actionableProposal ? workbenchPolicyReason("approve-domain-action", "Latest proposal can be approved and projected to application facts.") :
          latestProposal ? "Latest proposal already has a terminal review fact." : "No proposal is waiting for approval.",
      rejectReason: !hasRejectPolicy ? "No dashboard-private operation policy is visible for reject-domain-action." :
        actionableProposal ? workbenchPolicyReason("reject-domain-action", "Latest proposal can be rejected by a visible review fact.") :
        latestProposal ? "Latest proposal already has a terminal review fact." : "No proposal is waiting for rejection.",
      cancelReason: !hasCancelPolicy ? "No dashboard-private operation policy is visible for cancel-domain-action." :
        actionableProposal ? workbenchPolicyReason("cancel-domain-action", "Latest proposal can be canceled by a visible command fact.") :
        latestProposal ? "Latest proposal already has a terminal review fact." : "No proposal is waiting for cancellation.",
      recommended: selectedTriage,
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
  function dogfoodProjectApprovalFacts(selected, proposal, approval, commandRef, existingAdmission) {
    var admissionId = (existingAdmission && existingAdmission.admissionId) || proposal.proposalId + ":admission";
    var facts = [];
    if (!existingAdmission) {
      facts.push({
        kind: "work-item-domain-action-admission",
        admissionId: admissionId,
        proposalId: proposal.proposalId,
        workItemId: selected.id,
        state: "admitted",
        sourceRefs: [commandRef, { kind: "work-item-domain-action-approval", id: approval.approvalId }, { kind: "work-item-domain-action-proposal", id: proposal.proposalId }],
        metadata: { commandId: commandRef.id, projectorId: "dashboard-private-domain-action-projector", bounded: true, coordinate: { workItemId: selected.id, proposalId: proposal.proposalId } },
      });
    }
    facts.push({
        kind: "work-item-domain-action-application",
        applicationId: proposal.proposalId + ":application",
        proposalId: proposal.proposalId,
        workItemId: selected.id,
        state: "applied",
        sourceRefs: [commandRef, { kind: "work-item-domain-action-admission", id: admissionId }],
        metadata: { commandId: commandRef.id, projectorId: "dashboard-private-domain-action-projector", bounded: true, coordinate: { workItemId: selected.id, proposalId: proposal.proposalId } },
    });
    return facts;
  }
  function dogfoodRunSelected(view) {
    var selected = view.selected;
    if (!selected) {
      var missingCommand = workbenchCommand("approve-domain-action", dogfoodSelectedId(), [{ kind: "work-item-domain-action-proposal", id: "missing" }], {});
      workbenchAppendCommand(missingCommand, [], "No visible WorkItem is selected for approval.", "dashboard-private-domain-action-projector", "no-op");
      return;
    }
    var currentView = deriveDogfoodView();
    var currentBundle = currentView.selectedBundle;
    var actionState = dogfoodActionState(currentView, currentBundle, true);
    var input = dogfoodFactsByKind("tool-provider-adapter-input").filter(function (item) {
      return dogfoodWorkItemFromRefs(item.input && item.input.subjectRefs) === selected.id && item.status === "ready";
    }).slice(-1)[0];
    if (!input || !actionState.canRun) {
      var deniedCommand = workbenchCommand("run-visible-effect", selected.id, input ? [{ kind: "tool-provider-adapter-input", id: input.adapterInputId }] : [{ kind: "work-item", id: selected.id }], input ? { adapterInputId: input.adapterInputId } : {});
      workbenchAppendCommand(deniedCommand, [], actionState.runReason || "No ready visible adapter input for this WorkItem.", "dashboard-private-operation-policy-projector", "denied");
      return;
    }
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
    var command = workbenchCommand("run-visible-effect", selected.id, [
      { kind: "workbench-selection", id: selected.id },
      { kind: "tool-provider-adapter-input", id: input.adapterInputId },
    ], { adapterInputId: input.adapterInputId, attempt: attempt, retry: attempt > 1 });
    var commandRef = workbenchCommandRef(command.commandId);
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
    var generatedFacts = [
      runRequest,
      { kind: "agent-runtime-audit", id: runId + ":audit:requested", event: "tool-provider-adapter-runtime-run-requested", subjectId: input.requestId, sourceRefs: [commandRef, { kind: "tool-provider-adapter-run-requested", id: runId }], metadata: { commandId: commandRef.id, runId: runId, attempt: attempt, bounded: true, coordinate: { adapterInputId: input.adapterInputId, runId: runId, attempt: attempt } } },
      runStatus,
      outcome,
      materialRef,
      { kind: "agent-runtime-audit", id: runId + ":audit:finished", event: "tool-provider-adapter-runtime-finished", subjectId: input.requestId, sourceRefs: [commandRef, { kind: "executor-outcome", id: outcomeId }], metadata: { commandId: commandRef.id, runId: runId, outcomeId: outcomeId, bounded: true, coordinate: { runId: runId, outcomeId: outcomeId, attempt: attempt } } },
    ].concat(dogfoodProjectOutcomeFacts(selected, input, outcome, commandRef));
    var unauthorized = workbenchPolicyUnauthorizedGeneratedKinds(command.commandKind, generatedFacts);
    if (unauthorized.length) {
      workbenchAppendCommand(command, [], "WorkbenchOperationPolicy does not authorize generated fact kinds: " + unauthorized.join(", ") + ".", "dashboard-private-run-projector", "denied");
      return;
    }
    workbenchAppendCommand(command, generatedFacts, "Appended fake bounded run attempt " + attempt + " and projected evidence.", "dashboard-private-run-projector");
  }
  function dogfoodProposeSelected(view) {
    var selected = view.selected;
    if (!selected) return;
    var currentView = deriveDogfoodView();
    var currentBundle = selected && currentView.selected && currentView.selected.id === selected.id ? currentView.selectedBundle :
      (selected ? currentView.nodes.filter(function (node) { return node.id === selected.id; }).slice(-1)[0] : null);
    var actionState = dogfoodActionState({ selected: { id: selected.id }, triageItems: currentView.triageItems || [] }, currentBundle || { issues: [] }, true);
    if (!actionState.canPropose) {
      var deniedCommand = workbenchCommand("propose-domain-action", selected.id, [{ kind: "work-item", id: selected.id }], { actionKind: "require-review" });
      workbenchAppendCommand(deniedCommand, [], actionState.proposeReason, "dashboard-private-domain-action-projector", "denied");
      return;
    }
    var proposalSeq = dogfoodFacts.filter(function (item) {
      return item.kind === "work-item-domain-action-proposal" && item.workItemId === selected.id;
    }).length + 1;
    var proposalId = selected.id + ":dashboard-review-proposal:" + proposalSeq;
    var command = workbenchCommand("propose-domain-action", selected.id, [{ kind: "work-item", id: selected.id }], { actionKind: "require-review", proposalSeq: proposalSeq });
    var commandRef = workbenchCommandRef(command.commandId);
    var generatedFacts = [{
      kind: "work-item-domain-action-proposal",
      proposalId: proposalId,
      workItemId: selected.id,
      actionKind: "require-review",
      state: "proposed",
      reason: "Dashboard user requested visible review action",
      sourceRefs: [commandRef],
      metadata: { commandId: commandRef.id, command: "propose-review", bounded: true, coordinate: { workItemId: selected.id, proposalId: proposalId } },
    }];
    var unauthorized = workbenchPolicyUnauthorizedGeneratedKinds(command.commandKind, generatedFacts);
    if (unauthorized.length) {
      workbenchAppendCommand(command, [], "WorkbenchOperationPolicy does not authorize generated fact kinds: " + unauthorized.join(", ") + ".", "dashboard-private-domain-action-projector", "denied");
      return;
    }
    workbenchAppendCommand(command, generatedFacts, "Appended visible WorkItem domain action proposal.", "dashboard-private-domain-action-projector");
  }
  function dogfoodApproveSelected(view) {
    var selected = view.selected;
    if (!selected) return;
    var currentView = deriveDogfoodView();
    var selectedBundle = currentView.selected && currentView.selected.id === selected.id ? currentView.selectedBundle : null;
    var actionState = dogfoodActionState({ selected: { id: selected.id }, triageItems: currentView.triageItems || [] }, selectedBundle || { actions: [], issues: [] }, true);
    if (!actionState.canApprove) {
      var deniedCommand = workbenchCommand("approve-domain-action", selected.id, [{ kind: "work-item", id: selected.id }], {});
      workbenchAppendCommand(deniedCommand, [], actionState.approveReason, "dashboard-private-domain-action-projector", actionState.approveReason.indexOf("No proposal") >= 0 ? "no-op" : "denied");
      return;
    }
    var proposal = dogfoodFacts.filter(function (item) {
      return item.kind === "work-item-domain-action-proposal" && item.workItemId === selected.id;
    }).slice(-1)[0];
    if (!proposal) {
      var noProposalCommand = workbenchCommand("approve-domain-action", selected.id, [{ kind: "work-item-domain-action-proposal", id: "missing" }], {});
      workbenchAppendCommand(noProposalCommand, [], "No proposal is waiting for approval.", "dashboard-private-domain-action-projector", "no-op");
      return;
    }
    var existingAdmission = dogfoodFacts.filter(function (item) {
      return item.kind === "work-item-domain-action-admission" && item.proposalId === proposal.proposalId;
    }).slice(-1)[0];
    var already = dogfoodFacts.some(function (item) {
      return (item.kind === "work-item-domain-action-approval" ||
        item.kind === "work-item-domain-action-rejection" ||
        item.kind === "work-item-domain-action-cancellation" ||
        item.kind === "work-item-domain-action-application") &&
        item.proposalId === proposal.proposalId;
    });
    if (already) {
      var alreadyCommand = workbenchCommand("approve-domain-action", selected.id, [{ kind: "work-item-domain-action-proposal", id: proposal.proposalId }], { proposalId: proposal.proposalId });
      workbenchAppendCommand(alreadyCommand, [], "Proposal already has a terminal review/application fact.", "dashboard-private-domain-action-projector", "no-op");
      return;
    }
    var command = workbenchCommand("approve-domain-action", selected.id, [{ kind: "work-item-domain-action-proposal", id: proposal.proposalId }], { proposalId: proposal.proposalId });
    var commandRef = workbenchCommandRef(command.commandId);
    var approval = {
      kind: "work-item-domain-action-approval",
      approvalId: proposal.proposalId + ":approval",
      proposalId: proposal.proposalId,
      workItemId: selected.id,
      state: "approved",
      sourceRefs: [commandRef, { kind: "work-item-domain-action-proposal", id: proposal.proposalId }],
      metadata: { commandId: commandRef.id, bounded: true, coordinate: { workItemId: selected.id, proposalId: proposal.proposalId } },
    };
    var generatedFacts = [
      approval,
      { kind: "agent-runtime-audit", id: proposal.proposalId + ":audit:approved", event: "work-item-domain-action-approved", subjectId: selected.id, sourceRefs: [commandRef], metadata: { commandId: commandRef.id, proposalId: proposal.proposalId, bounded: true, coordinate: { workItemId: selected.id, proposalId: proposal.proposalId } } },
    ].concat(dogfoodProjectApprovalFacts(selected, proposal, approval, commandRef, existingAdmission));
    var unauthorized = workbenchPolicyUnauthorizedGeneratedKinds(command.commandKind, generatedFacts);
    if (unauthorized.length) {
      workbenchAppendCommand(command, [], "WorkbenchOperationPolicy does not authorize generated fact kinds: " + unauthorized.join(", ") + ".", "dashboard-private-domain-action-projector", "denied");
      return;
    }
    workbenchAppendCommand(command, generatedFacts, "Approved proposal and projected domain action application.", "dashboard-private-domain-action-projector");
  }
  function dogfoodReviewSelected(view, reviewKind) {
    var selected = view.selected;
    if (!selected) {
      var missingCommand = workbenchCommand(reviewKind + "-domain-action", dogfoodSelectedId(), [{ kind: "work-item-domain-action-proposal", id: "missing" }], {});
      workbenchAppendCommand(missingCommand, [], "No visible WorkItem is selected for " + reviewKind + ".", "dashboard-private-domain-action-projector", "no-op");
      return;
    }
    var proposal = dogfoodFacts.filter(function (item) {
      return item.kind === "work-item-domain-action-proposal" && item.workItemId === selected.id;
    }).slice(-1)[0];
    if (!proposal) {
      var noProposalCommand = workbenchCommand(reviewKind + "-domain-action", selected.id, [{ kind: "work-item-domain-action-proposal", id: "missing" }], {});
      workbenchAppendCommand(noProposalCommand, [], "No proposal is waiting for " + reviewKind + ".", "dashboard-private-domain-action-projector", "no-op");
      return;
    }
    var terminal = dogfoodFacts.some(function (item) {
      return item.proposalId === proposal.proposalId && (
        item.kind === "work-item-domain-action-approval" ||
        item.kind === "work-item-domain-action-rejection" ||
        item.kind === "work-item-domain-action-cancellation" ||
        item.kind === "work-item-domain-action-application"
      );
    });
    if (terminal) {
      var terminalCommand = workbenchCommand(reviewKind + "-domain-action", selected.id, [{ kind: "work-item-domain-action-proposal", id: proposal.proposalId }], { proposalId: proposal.proposalId });
      workbenchAppendCommand(terminalCommand, [], "Proposal already has a terminal review/application fact.", "dashboard-private-domain-action-projector", "no-op");
      return;
    }
    var command = workbenchCommand(reviewKind + "-domain-action", selected.id, [{ kind: "work-item-domain-action-proposal", id: proposal.proposalId }], { proposalId: proposal.proposalId });
    var commandRef = workbenchCommandRef(command.commandId);
    var factKind = reviewKind === "reject" ? "work-item-domain-action-rejection" : "work-item-domain-action-cancellation";
    var reviewFact = {
      kind: factKind,
      reviewId: proposal.proposalId + ":" + reviewKind,
      proposalId: proposal.proposalId,
      workItemId: selected.id,
      state: reviewKind === "reject" ? "rejected" : "canceled",
      reason: reviewKind === "reject" ? "Dashboard reviewer rejected the proposed action." : "Dashboard user canceled the pending action proposal.",
      sourceRefs: [commandRef, { kind: "work-item-domain-action-proposal", id: proposal.proposalId }],
      metadata: { commandId: command.commandId, bounded: true, coordinate: { workItemId: selected.id, proposalId: proposal.proposalId } },
    };
    var generatedFacts = [
      reviewFact,
      { kind: "agent-runtime-audit", id: proposal.proposalId + ":audit:" + reviewKind, event: "work-item-domain-action-" + reviewFact.state, subjectId: selected.id, sourceRefs: [commandRef, { kind: factKind, id: reviewFact.reviewId }], metadata: { commandId: command.commandId, proposalId: proposal.proposalId, bounded: true, coordinate: { workItemId: selected.id, proposalId: proposal.proposalId } } },
    ];
    var unauthorized = workbenchPolicyUnauthorizedGeneratedKinds(command.commandKind, generatedFacts);
    if (unauthorized.length) {
      workbenchAppendCommand(command, [], "WorkbenchOperationPolicy does not authorize generated fact kinds: " + unauthorized.join(", ") + ".", "dashboard-private-domain-action-projector", "denied");
      return;
    }
    workbenchAppendCommand(command, generatedFacts, reviewKind === "reject" ? "Rejected proposal by visible review fact." : "Canceled proposal by visible command fact.", "dashboard-private-domain-action-projector");
  }
  function workbenchSelectWorkItem(workItemId, sourceRef, summary) {
    var current = dogfoodSelectedId();
    var command = workbenchCommand("select-work-item", workItemId, [sourceRef || { kind: "work-item", id: workItemId }], {});
    if (current === workItemId) {
      workbenchAppendCommand(command, [], "Selection already points at " + workItemId + ".", "dashboard-private-selection-projector", "no-op");
      return;
    }
    var generatedFacts = [{
      kind: "workbench-selection",
      workItemId: workItemId,
      sourceRefs: [workbenchCommandRef(command.commandId), sourceRef || { kind: "work-item", id: workItemId }],
      metadata: { commandId: command.commandId, visibleUiFact: true, bounded: true, coordinate: { workItemId: workItemId } },
    }];
    var unauthorized = workbenchPolicyUnauthorizedGeneratedKinds(command.commandKind, generatedFacts);
    if (unauthorized.length) {
      workbenchAppendCommand(command, [], "WorkbenchOperationPolicy does not authorize generated fact kinds: " + unauthorized.join(", ") + ".", "dashboard-private-selection-projector", "denied");
      return;
    }
    workbenchAppendCommand(command, generatedFacts, summary || "Selected WorkItem from a visible Workbench command.", "dashboard-private-selection-projector");
  }
  function workbenchTriageAction(item, commandKind) {
    if (!item) return;
    var sourceRef = { kind: "workbench-triage-item", id: item.triageItemId };
    var command = workbenchCommand(commandKind, item.workItemId, [sourceRef].concat(item.sourceRefs || []), {
      triageItemId: item.triageItemId,
      issueCode: item.category,
      actionability: item.actionability,
    });
    var policy = workbenchPolicyFor(commandKind);
    if (!policy || (item.recommendedCommandKinds || []).indexOf(commandKind) < 0) {
      workbenchAppendCommand(command, [], "No visible WorkbenchOperationPolicy authorizes " + commandKind + " for " + item.category + ".", "dashboard-private-triage-projector", "denied");
      return;
    }
    var commandRef = workbenchCommandRef(command.commandId);
    var already = dogfoodFacts.some(function (fact) {
      return fact.kind === "workbench-policy-denied-ack" && commandKind === "acknowledge-policy-denied" && fact.triageItemId === item.triageItemId ||
        fact.kind === "workbench-retention-gap-inspection" && commandKind === "inspect-retention-gap" && fact.triageItemId === item.triageItemId ||
        fact.kind === "workbench-missing-input-request" && commandKind === "request-missing-input" && fact.triageItemId === item.triageItemId ||
        fact.kind === "workbench-corrected-input-request" && commandKind === "request-corrected-input" && fact.triageItemId === item.triageItemId ||
        fact.kind === "workbench-request-superseded" && commandKind === "mark-stale-superseded" && fact.triageItemId === item.triageItemId;
    });
    if (already) {
      workbenchAppendCommand(command, [], "Triage action already recorded for " + item.category + ".", "dashboard-private-triage-projector", "no-op");
      return;
    }
    var fact;
    var event;
    if (commandKind === "acknowledge-policy-denied") {
      fact = { kind: "workbench-policy-denied-ack", ackId: item.triageItemId + ":ack", triageItemId: item.triageItemId, workItemId: item.workItemId, issueCode: item.category, sourceRefs: [commandRef, sourceRef], metadata: { commandId: command.commandId, dashboardPrivate: true, bounded: true, coordinate: { workItemId: item.workItemId, triageItemId: item.triageItemId } } };
      event = "workbench-policy-denied-acknowledged";
    } else if (commandKind === "request-missing-input" || commandKind === "request-corrected-input") {
      var corrected = commandKind === "request-corrected-input";
      fact = { kind: corrected ? "workbench-corrected-input-request" : "workbench-missing-input-request", requestId: item.triageItemId + (corrected ? ":corrected-input-request" : ":input-request"), triageItemId: item.triageItemId, workItemId: item.workItemId, issueCode: item.category, mode: corrected ? "request-corrected-input" : "request-input", sourceRefs: [commandRef, sourceRef], metadata: { commandId: command.commandId, dashboardPrivate: true, bounded: true, coordinate: { workItemId: item.workItemId, triageItemId: item.triageItemId, issueCode: item.category } } };
      event = corrected ? "workbench-corrected-input-requested" : "workbench-missing-input-requested";
    } else if (commandKind === "mark-stale-superseded") {
      fact = { kind: "workbench-request-superseded", supersededId: item.triageItemId + ":superseded", triageItemId: item.triageItemId, workItemId: item.workItemId, issueCode: item.category, state: "superseded", sourceRefs: [commandRef, sourceRef], metadata: { commandId: command.commandId, dashboardPrivate: true, bounded: true, coordinate: { workItemId: item.workItemId, triageItemId: item.triageItemId } } };
      event = "workbench-request-marked-superseded";
    } else {
      fact = { kind: "workbench-retention-gap-inspection", inspectionId: item.triageItemId + ":inspection", triageItemId: item.triageItemId, workItemId: item.workItemId, issueCode: item.category, mode: "inspect-only-fail-closed", sourceRefs: [commandRef, sourceRef], metadata: { commandId: command.commandId, dashboardPrivate: true, bounded: true, coordinate: { workItemId: item.workItemId, triageItemId: item.triageItemId } } };
      event = "workbench-retention-gap-inspected";
    }
    if (!workbenchPolicyAllowsGeneratedKind(commandKind, fact.kind) || !workbenchPolicyAllowsGeneratedKind(commandKind, "agent-runtime-audit")) {
      workbenchAppendCommand(command, [], "WorkbenchOperationPolicy generatedFactKinds does not authorize " + fact.kind + ".", "dashboard-private-triage-projector", "denied");
      return;
    }
    workbenchAppendCommand(command, [
      fact,
      { kind: "agent-runtime-audit", id: item.triageItemId + ":audit:" + commandKind, event: event, subjectId: item.workItemId, issueCode: item.category, sourceRefs: [commandRef, workbenchFactRef(fact)], metadata: { commandId: command.commandId, dashboardPrivate: true, bounded: true, coordinate: { workItemId: item.workItemId, triageItemId: item.triageItemId } } },
    ], "Recorded bounded triage action: " + commandKind + ".", "dashboard-private-triage-projector");
  }
  function workbenchSaveSnapshot() {
    var snapshotFacts = dogfoodFacts.filter(function (fact) { return WORKBENCH_SESSION_FACT_KINDS.indexOf(fact.kind) >= 0; }).slice(-60);
    var snapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      selectedWorkItemId: dogfoodSelectedId(),
      scope: workbenchCurrentScope(),
      lane: dogfoodCurrentLaneFilter(),
      status: dogfoodCurrentStatusFilter(),
      inspectorFilters: workbenchInspectorFilters(),
      facts: snapshotFacts,
      boundary: "dashboard-private-ui-session-only",
    };
    try {
      localStorage.setItem(WORKBENCH_SNAPSHOT_KEY, JSON.stringify(snapshot));
      var command = workbenchCommand("save-session-snapshot", dogfoodSelectedId(), [{ kind: "workbench-session-snapshot", id: "local" }], { snapshotId: "local" });
      var commandRef = workbenchCommandRef(command.commandId);
      var generatedFacts = [{
        kind: "workbench-session-snapshot",
        snapshotId: command.commandId + ":snapshot",
        factCount: snapshotFacts.length,
        boundary: snapshot.boundary,
        sourceRefs: [commandRef],
        metadata: { commandId: command.commandId, dashboardPrivate: true, bounded: true, coordinate: { factCount: snapshotFacts.length, boundary: snapshot.boundary } },
      }];
      var unauthorized = workbenchPolicyUnauthorizedGeneratedKinds(command.commandKind, generatedFacts);
      if (unauthorized.length) {
        workbenchAppendCommand(command, [], "WorkbenchOperationPolicy does not authorize generated fact kinds: " + unauthorized.join(", ") + ".", "dashboard-private-session-snapshot-projector", "denied");
        return;
      }
      workbenchAppendCommand(command, generatedFacts, "Saved bounded dashboard-private UI/session snapshot; no provider, retry, or Graph restore.", "dashboard-private-session-snapshot-projector");
    } catch (error) {
      var failCommand = workbenchCommand("save-session-snapshot", dogfoodSelectedId(), [{ kind: "workbench-session-snapshot", id: "local" }], { snapshotId: "local" });
      workbenchAppendCommand(failCommand, [], "Snapshot save failed in localStorage; no Graph/provider action was attempted.", "dashboard-private-session-snapshot-projector", "denied");
    }
  }
  function workbenchScalarRestoreFacts(snapshot, commandRef, commandId) {
    var inspector = snapshot.inspectorFilters && typeof snapshot.inspectorFilters === "object" ? snapshot.inspectorFilters : {};
    var selectedId = workbenchValidWorkItemId(typeof snapshot.selectedWorkItemId === "string" ? snapshot.selectedWorkItemId.slice(0, 120) : "", dogfoodSelectedId());
    var lane = ["all", "queued", "running", "blocked", "complete"].indexOf(snapshot.lane) >= 0 ? snapshot.lane : "all";
    var status = DOGFOOD_STATUSES.indexOf(snapshot.status) >= 0 ? snapshot.status : "all";
    var scope = snapshot.scope === "global" ? "global" : "selected";
    var base = [
      { kind: "workbench-selection", workItemId: selectedId, metadata: { coordinate: { workItemId: selectedId } } },
      { kind: "workbench-lane-filter", lane: lane, metadata: { coordinate: { filterKind: "lane", value: lane } } },
      { kind: "workbench-status-filter", status: status, metadata: { coordinate: { filterKind: "status", value: status } } },
      { kind: "workbench-scope", scope: scope, metadata: { coordinate: { filterKind: "scope", value: scope } } },
    ];
    ["kind", "sourceRef", "issueCode", "coordinate"].forEach(function (filterKind) {
      var value = typeof inspector[filterKind] === "string" ? inspector[filterKind].slice(0, 160) : "all";
      base.push({ kind: "workbench-inspector-filter", filterKind: filterKind, value: value, metadata: { coordinate: { filterKind: filterKind, value: value } } });
    });
    return base.map(function (fact) {
      fact.sourceRefs = [commandRef];
      fact.metadata = Object.assign({}, fact.metadata, { commandId: commandId, restoredFromSnapshot: true, dashboardPrivate: true, bounded: true });
      return fact;
    });
  }
  function workbenchSanitizeSnapshotFact(fact, commandRef, commandId) {
    if (!fact || typeof fact !== "object" || WORKBENCH_SESSION_FACT_KINDS.indexOf(fact.kind) < 0) return null;
    var out = { kind: fact.kind, sourceRefs: [commandRef], metadata: { commandId: commandId, restoredFromSnapshot: true, dashboardPrivate: true, bounded: true } };
    if (fact.kind === "workbench-selection") out.workItemId = workbenchValidWorkItemId(typeof fact.workItemId === "string" ? fact.workItemId.slice(0, 120) : "", dogfoodSelectedId());
    else if (fact.kind === "workbench-lane-filter") out.lane = ["all", "queued", "running", "blocked", "complete"].indexOf(fact.lane) >= 0 ? fact.lane : "all";
    else if (fact.kind === "workbench-status-filter") out.status = DOGFOOD_STATUSES.indexOf(fact.status) >= 0 ? fact.status : "all";
    else if (fact.kind === "workbench-scope") out.scope = fact.scope === "global" ? "global" : "selected";
    else if (fact.kind === "workbench-inspector-filter") {
      out.filterKind = ["kind", "sourceRef", "issueCode", "coordinate"].indexOf(fact.filterKind) >= 0 ? fact.filterKind : "kind";
      out.value = typeof fact.value === "string" ? fact.value.slice(0, 160) : "all";
    } else if (fact.kind === "workbench-active-projection-index") {
      out.indexId = commandId + ":restored-active-projection-index";
      out.activeProjectionId = typeof fact.activeProjectionId === "string" ? fact.activeProjectionId.slice(0, 160) : commandId + ":view-projection";
      out.selectedWorkItemId = workbenchValidWorkItemId(typeof fact.selectedWorkItemId === "string" ? fact.selectedWorkItemId.slice(0, 120) : "", dogfoodSelectedId());
      out.scope = fact.scope === "global" ? "global" : "selected";
    } else if (fact.kind === "workbench-session-snapshot") {
      out.snapshotId = commandId + ":restored-snapshot-marker";
      out.factCount = Math.max(0, Math.min(80, Number(fact.factCount) || 0));
      out.boundary = "dashboard-private-ui-session-only";
    } else if (fact.kind === "workbench-session-restore") {
      out.restoreId = commandId + ":restored-restore-marker";
      out.restoredFactCount = Math.max(0, Math.min(80, Number(fact.restoredFactCount) || 0));
      out.boundary = "dashboard-private-ui-session-only";
    } else if (fact.kind === "workbench-missing-input-request" || fact.kind === "workbench-corrected-input-request") {
      out.requestId = commandId + ":" + fact.kind;
      out.triageItemId = typeof fact.triageItemId === "string" ? fact.triageItemId.slice(0, 160) : "";
      out.workItemId = typeof fact.workItemId === "string" ? fact.workItemId.slice(0, 120) : "";
      out.issueCode = fact.kind === "workbench-corrected-input-request" ? "mismatched-request" : "missing-input";
      out.mode = fact.kind === "workbench-corrected-input-request" ? "request-corrected-input" : "request-input";
    } else if (fact.kind === "workbench-request-superseded") {
      out.supersededId = commandId + ":request-superseded";
      out.triageItemId = typeof fact.triageItemId === "string" ? fact.triageItemId.slice(0, 160) : "";
      out.workItemId = typeof fact.workItemId === "string" ? fact.workItemId.slice(0, 120) : "";
      out.issueCode = "stale-request";
      out.state = "superseded";
    } else if (fact.kind === "workbench-retention-gap-inspection") {
      out.inspectionId = commandId + ":retention-gap-inspection";
      out.triageItemId = typeof fact.triageItemId === "string" ? fact.triageItemId.slice(0, 160) : "";
      out.workItemId = typeof fact.workItemId === "string" ? fact.workItemId.slice(0, 120) : "";
      out.issueCode = "retention-gap";
      out.mode = "inspect-only-fail-closed";
    } else if (fact.kind === "workbench-policy-denied-ack") {
      out.ackId = commandId + ":policy-denied-ack";
      out.triageItemId = typeof fact.triageItemId === "string" ? fact.triageItemId.slice(0, 160) : "";
      out.workItemId = typeof fact.workItemId === "string" ? fact.workItemId.slice(0, 120) : "";
      out.issueCode = "policy-denied";
    }
    out.metadata.coordinate = Object.keys(out).filter(function (key) { return key !== "metadata" && key !== "sourceRefs" && key !== "kind"; }).reduce(function (coord, key) {
      coord[key] = out[key];
      return coord;
    }, {});
    return out;
  }
  function workbenchRestoreSnapshot() {
    var raw;
    try { raw = localStorage.getItem(WORKBENCH_SNAPSHOT_KEY); } catch (error) { raw = null; }
    var command = workbenchCommand("restore-session-snapshot", dogfoodSelectedId(), [{ kind: "workbench-session-snapshot", id: "local" }], { snapshotId: "local" });
    if (!raw) {
      workbenchAppendCommand(command, [], "No bounded Workbench session snapshot is available.", "dashboard-private-session-snapshot-projector", "no-op");
      return;
    }
    var snapshot;
    try { snapshot = JSON.parse(raw); } catch (error) { snapshot = null; }
    if (!snapshot || snapshot.boundary !== "dashboard-private-ui-session-only") {
      workbenchAppendCommand(command, [], "Snapshot boundary marker missing; restore rejected without side effects.", "dashboard-private-session-snapshot-projector", "denied");
      return;
    }
    if (!Array.isArray(snapshot.facts)) {
      workbenchAppendCommand(command, [], "Snapshot fact list is malformed; restore rejected without side effects.", "dashboard-private-session-snapshot-projector", "denied");
      return;
    }
    var commandRef = workbenchCommandRef(command.commandId);
    var restoredFacts = workbenchScalarRestoreFacts(snapshot, commandRef, command.commandId).concat(
      snapshot.facts.slice(-80).map(function (fact) {
        return workbenchSanitizeSnapshotFact(fact, commandRef, command.commandId);
      }).filter(Boolean),
    ).slice(-96);
    var generatedFacts = restoredFacts.concat({
      kind: "workbench-session-restore",
      restoreId: command.commandId + ":restore",
      restoredFactCount: restoredFacts.length,
      boundary: snapshot.boundary,
      sourceRefs: [commandRef],
      metadata: { commandId: command.commandId, dashboardPrivate: true, bounded: true, coordinate: { restoredFactCount: restoredFacts.length, boundary: snapshot.boundary } },
    });
    var unauthorized = workbenchPolicyUnauthorizedGeneratedKinds(command.commandKind, generatedFacts);
    if (unauthorized.length) {
      workbenchAppendCommand(command, [], "WorkbenchOperationPolicy does not authorize generated fact kinds: " + unauthorized.join(", ") + ".", "dashboard-private-session-snapshot-projector", "denied");
      return;
    }
    workbenchAppendCommand(command, generatedFacts, "Restored only bounded dashboard-private UI/session facts; no provider, retry, retention repair, or Graph hydration.", "dashboard-private-session-snapshot-projector");
  }
  function dogfoodMetric(label, value) {
    return h("div", { class: "df-metric" }, [h("strong", {}, [String(value)]), h("span", {}, [label])]);
  }
  function dogfoodBadge(tone, label) {
    return h("span", { class: "df-badge " + tone }, [label]);
  }
  function workbenchTriageCounts(items) {
    var counts = {};
    (items || []).forEach(function (item) {
      var key = item.category + " / " + item.severity + " / " + item.actionability;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.keys(counts).sort().map(function (key) { return { key: key, count: counts[key] }; });
  }
  function workbenchCommandLabel(commandKind) {
    return {
      "run-visible-effect": "retry",
      "approve-domain-action": "approve",
      "reject-domain-action": "reject",
      "cancel-domain-action": "cancel",
      "request-missing-input": "request input",
      "request-corrected-input": "request corrected",
      "mark-stale-superseded": "mark superseded",
      "inspect-retention-gap": "inspect gap",
      "acknowledge-policy-denied": "acknowledge",
    }[commandKind] || commandKind;
  }
  function workbenchTriageInbox(items, title, emptyText) {
    return dogfoodRows(title, items || [], emptyText, function (item) {
      return h("button", {
        class: "df-triage-item",
        onclick: function () { workbenchSelectWorkItem(item.workItemId, { kind: "workbench-triage-item", id: item.triageItemId }, "Selected WorkItem from triage inbox."); },
        title: item.disabledReason,
      }, [
        h("span", { class: "df-triage-main" }, [h("strong", {}, [item.category]), h("code", {}, [item.workItemId])]),
        h("span", { class: "df-triage-meta" }, [item.severity + " · " + item.actionability]),
        h("span", { class: "df-triage-reason" }, [item.disabledReason]),
      ]);
    });
  }
  function workbenchRecommendedActions(items, actionState) {
    var rows = [];
    (items || []).slice(0, 6).forEach(function (item) {
      var commands = item.recommendedCommandKinds && item.recommendedCommandKinds.length ? item.recommendedCommandKinds : [];
      rows.push(h("div", { class: "df-recommendation" }, [
        h("div", {}, [h("strong", {}, [item.category]), h("span", {}, [item.disabledReason])]),
        h("div", { class: "df-recommendation-actions" }, commands.length ? commands.map(function (commandKind) {
          var enabled = commandKind === "run-visible-effect" ? actionState.canRun :
            commandKind === "approve-domain-action" ? actionState.canApprove :
              commandKind === "reject-domain-action" ? actionState.canReject :
                commandKind === "cancel-domain-action" ? actionState.canCancel : true;
          var reason = commandKind === "run-visible-effect" ? actionState.runReason :
            commandKind === "approve-domain-action" ? actionState.approveReason :
              commandKind === "reject-domain-action" ? actionState.rejectReason :
                commandKind === "cancel-domain-action" ? actionState.cancelReason : item.disabledReason;
          return h("button", {
            disabled: !enabled,
            title: enabled ? item.disabledReason : reason,
            onclick: function () {
              if (commandKind === "run-visible-effect" && actionState.canRun) dogfoodRunSelected({ selected: { id: item.workItemId } });
              else if (commandKind === "approve-domain-action" && actionState.canApprove) dogfoodApproveSelected({ selected: { id: item.workItemId } });
              else if (commandKind === "reject-domain-action" && actionState.canReject) dogfoodReviewSelected({ selected: { id: item.workItemId } }, "reject");
              else if (commandKind === "cancel-domain-action" && actionState.canCancel) dogfoodReviewSelected({ selected: { id: item.workItemId } }, "cancel");
              else if (commandKind === "acknowledge-policy-denied") workbenchTriageAction(item, commandKind);
              else if (commandKind === "request-missing-input") workbenchTriageAction(item, commandKind);
              else if (commandKind === "request-corrected-input") workbenchTriageAction(item, commandKind);
              else if (commandKind === "mark-stale-superseded") workbenchTriageAction(item, commandKind);
              else if (commandKind === "inspect-retention-gap") workbenchTriageAction(item, commandKind);
            },
          }, [workbenchCommandLabel(commandKind)]);
        }) : [h("span", { class: "df-empty-inline" }, ["inspect only"])]),
      ]));
    });
    if (!rows.length) rows.push(h("p", { class: "df-empty" }, ["No triage recommendation touches this WorkItem."]));
    return h("section", { class: "df-section" }, [h("h3", {}, ["Recommended Bounded Actions"])].concat(rows));
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
    var groups = workbenchTriageCounts(view.triageItems);
    var groupStrip = h("div", { class: "df-triage-groups" }, groups.length ? groups.map(function (group) {
      return h("button", {
        class: "df-triage-chip",
        onclick: function () {
          var first = (view.triageItems || []).filter(function (item) {
            return [item.category, item.severity, item.actionability].join(" / ") === group.key;
          })[0];
          if (first) workbenchSelectWorkItem(first.workItemId, { kind: "workbench-triage-item", id: first.triageItemId }, "Selected first WorkItem in triage group.");
        },
      }, [h("strong", {}, [String(group.count)]), h("span", {}, [group.key])]);
    }) : [h("span", { class: "df-empty-inline" }, ["No triage items in the current projection."])]);
    if (!shown.length) return h("div", { class: "df-board df-board-empty" }, [
      groupStrip,
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
      groupStrip,
      h("div", { class: "df-board-note" }, ["Scroll horizontally on narrow screens to inspect the full dependency board."]),
      h("div", { class: "df-board-canvas", html: '<svg viewBox="0 0 760 420" role="img" aria-label="CSP-8 WorkItem dependency board"><defs><marker id="df-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z"></path></marker></defs><g class="df-edges">' + edgeSvg + '</g><g class="df-nodes">' + nodeSvg + "</g></svg>" }),
    ]);
    Array.prototype.forEach.call(board.querySelectorAll(".df-node"), function (node) {
      function selectNode() {
        var selectedId = node.getAttribute("data-id");
        workbenchSelectWorkItem(selectedId, { kind: "work-item", id: selectedId }, "Selected WorkItem from the queue board.");
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
  function workbenchWorkspace(label, sub, body) {
    return h("section", { class: "df-workspace" }, [
      h("div", { class: "df-workspace-head" }, [
        h("span", {}, [label]),
        sub ? h("code", {}, [sub]) : null,
      ]),
    ].concat(body));
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
    return h("details", { class: "df-json" }, [
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
        policy.sizeCapacity ? "size-capacity" : "",
        policy.timeout ? "timeout" : "",
        policy.redaction ? "redaction" : "",
        policy.filesystem ? "filesystem" : "",
        policy.approval ? "approval" : "",
        policy.artifacts ? "artifacts" : "",
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
  function dogfoodInspector(view, ledgerFacts, scope) {
    var filters = workbenchInspectorFilters();
    var factsForInspector = ledgerFacts || dogfoodFacts;
    var kinds = Array.from(new Set(factsForInspector.map(function (fact) { return fact.kind || fact.factKind || "unknown"; }))).sort();
    var issueCodes = Array.from(new Set(factsForInspector.map(function (fact) { return fact.issueCode || fact.code; }).filter(Boolean))).sort();
    var sourceRefs = Array.from(new Set(factsForInspector.flatMap(workbenchFactSourceKeys))).sort().slice(0, 80);
    var coordinateKeys = Array.from(new Set(factsForInspector.flatMap(workbenchCoordinateKeys))).sort();
    function optionList(values) {
      return ["all"].concat(values);
    }
    function selector(label, filterKind, values) {
      var sel = h("select", { onchange: function () { workbenchAppendInspectorFilter(filterKind, sel.value); }, "aria-label": label }, optionList(values).map(function (value) {
        return h("option", { value: value, selected: filters[filterKind] === value }, [value]);
      }));
      return h("label", { class: "df-ledger-filter" }, [h("span", {}, [label]), sel]);
    }
    var filteredFacts = factsForInspector.filter(function (fact) {
      if (filters.kind !== "all" && (fact.kind || fact.factKind || "unknown") !== filters.kind) return false;
      if (filters.issueCode !== "all" && (fact.issueCode || fact.code || "") !== filters.issueCode) return false;
      if (filters.sourceRef !== "all" && workbenchFactSourceKeys(fact).indexOf(filters.sourceRef) < 0) return false;
      if (filters.coordinate !== "all" && workbenchCoordinateKeys(fact).indexOf(filters.coordinate) < 0) return false;
      return true;
    });
    var recent = filteredFacts.slice(-24).reverse();
    var commandRefs = {};
    factsForInspector.forEach(function (fact) {
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
    factsForInspector.filter(function (fact) { return fact.kind === "workbench-command-result"; }).forEach(function (result) {
      commandRefs[result.commandId] = commandRefs[result.commandId] || {};
      (result.generatedRefs || []).forEach(function (ref) {
        var kind = "generated:" + ref.kind;
        commandRefs[result.commandId][kind] = (commandRefs[result.commandId][kind] || 0) + 1;
      });
    });
    var diffs = Object.keys(commandRefs).slice(-8).reverse().map(function (key) {
      return h("div", { class: "df-row" }, [
        h("div", {}, [h("strong", {}, [key]), h("span", {}, [Object.keys(commandRefs[key]).map(function (kind) { return "+" + commandRefs[key][kind] + " " + kind; }).join("  ")])]),
      ]);
    });
    var traceRows = factsForInspector.filter(function (fact) { return fact.kind === "workbench-provenance-edge"; }).slice(-8).reverse();
    return h("details", { class: "df-ledger", open: true }, [
      h("summary", {}, ["Workbench Ledger · " + scope + " fact inspector / ledger diff (" + factsForInspector.length + " scoped / " + dogfoodFacts.length + " total)"]),
      h("div", { class: "df-inspector" }, [
        h("section", {}, [
          h("h3", {}, ["Recent facts"]),
          h("div", { class: "df-ledger-filters" }, [
            selector("kind", "kind", kinds),
            selector("sourceRef", "sourceRef", sourceRefs),
            selector("issueCode", "issueCode", issueCodes),
            selector("coordinate", "coordinate", coordinateKeys),
          ]),
          recent.length ? h("div", { class: "df-ledger-list" }, recent.map(function (fact) {
            return h("div", { class: "df-ledger-item" }, [
              h("strong", {}, [fact.kind || fact.factKind || "unknown"]),
              h("code", {}, [dogfoodFactId(fact) || "no-id"]),
              h("span", {}, [dogfoodRefsText(fact.sourceRefs) || "sourceRefs: none"]),
              h("span", {}, [fact.summary || fact.status || fact.issueCode || fact.code || "status: none"]),
              h("code", {}, [fact.metadata && fact.metadata.coordinate ? JSON.stringify(fact.metadata.coordinate) : "coordinate: none"]),
            ]);
          })) : h("p", { class: "df-empty" }, ["No facts match the current inspector filters."]),
        ]),
        h("section", {}, [
          h("h3", {}, ["Command-derived diff"]),
          diffs.length ? h("div", { class: "df-section" }, diffs) : h("p", { class: "df-empty" }, ["No dashboard command has appended derived facts yet."]),
          dogfoodRows("Provenance trace", traceRows, "No provenance edges have been appended yet.", function (edge) {
            return h("div", { class: "df-row" }, [
              h("div", {}, [h("strong", {}, [edge.relation]), h("span", {}, [workbenchSourceRefKey(edge.fromRef) + " → " + workbenchSourceRefKey(edge.toRef)])]),
              dogfoodBadge(edge.issueCode || "trace", edge.issueCode || "trace"),
            ]);
          }),
          h("pre", {}, [JSON.stringify({
            selectedWorkItemId: view.selectedWorkItemId,
            scope: workbenchCurrentScope(),
            laneFilter: dogfoodCurrentLaneFilter(),
            statusFilter: dogfoodCurrentStatusFilter(),
            inspectorFilters: filters,
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
    var scope = workbenchCurrentScope();
    var selectionVisible = dogfoodNodeMatchesFilters(selected);
    if (!selectionVisible) {
      selected = null;
      bundle = null;
    }
    var selectedEvidence = bundle ? bundle.evidence : [];
    var selectedIssues = bundle ? bundle.issues : [];
    var selectedAudit = bundle ? bundle.audit : [];
    var selectedActions = bundle ? bundle.actions : [];
    var selectedToolRuns = selected ? view.toolRuns.filter(function (run) { return run.workItemId === selected.id; }) : [];
    var selectedTriage = selected ? view.triageItems.filter(function (item) { return item.workItemId === selected.id; }) : [];
    var scopedIssues = scope === "selected" ? selectedIssues : view.issues;
    var scopedAudit = scope === "selected" ? selectedAudit : view.audit;
    var scopedRuns = scope === "selected" ? selectedToolRuns : view.toolRuns;
    var scopedTriage = scope === "selected" ? selectedTriage : view.triageItems;
    var actionReviews = selectedActions.filter(function (item) {
      return item.kind === "work-item-domain-action-proposal";
    }).map(function (proposal) {
      var related = selectedActions.filter(function (item) { return item.proposalId === proposal.proposalId; });
      var state = related.some(function (item) { return item.kind === "work-item-domain-action-application" && item.state === "applied"; }) ? "applied" :
        related.some(function (item) { return item.kind === "work-item-domain-action-rejection"; }) ? "rejected" :
          related.some(function (item) { return item.kind === "work-item-domain-action-cancellation"; }) ? "canceled" :
            related.some(function (item) { return item.kind === "work-item-domain-action-approval"; }) ? "approved" :
              related.some(function (item) { return item.kind === "work-item-domain-action-admission"; }) ? "pending" :
                proposal.state || "proposed";
      return { proposal: proposal, state: state, relatedCount: related.length };
    });
    var actionState = dogfoodActionState(view, bundle, selectionVisible);
    var filters = h("div", { class: "df-filters" });
    var laneOptions = dogfoodFactsByKind("workbench-filter-option").filter(function (item) { return item.filterKind === "lane"; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    var statusOptions = dogfoodFactsByKind("workbench-filter-option").filter(function (item) { return item.filterKind === "status"; })
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
    dogfoodFactsByKind("workbench-filter-option").filter(function (item) { return item.filterKind === "scope"; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); })
      .forEach(function (option) {
        var value = option.value;
        filters.appendChild(h("button", {
          class: "df-filter scope" + (scope === value ? " active" : ""),
          "aria-pressed": scope === value ? "true" : "false",
          disabled: scope === value,
          onclick: function () { workbenchAppendScope(value); },
        }, ["scope: " + (option.label || value)]));
      });
    function actionHint(label, enabled, reason) {
      return h("span", { class: enabled ? "ok" : "blocked" }, [label + ": " + reason]);
    }
    var actions = h("div", { class: "df-actions", role: "group", "aria-label": "Graph-visible Workbench actions" }, [
      h("button", { disabled: !actionState.canRun, title: actionState.runReason, onclick: function () { if (actionState.canRun) dogfoodRunSelected({ selected: selected }); } }, [actionState.runLabel]),
      h("button", { class: "secondary", disabled: !actionState.canPropose, title: actionState.proposeReason, onclick: function () { if (actionState.canPropose) dogfoodProposeSelected({ selected: selected }); } }, ["Propose review"]),
      h("button", { class: "secondary", disabled: !actionState.canApprove, title: actionState.approveReason, onclick: function () { if (actionState.canApprove) dogfoodApproveSelected({ selected: selected }); } }, ["Approve"]),
      h("button", { class: "secondary", disabled: !actionState.canReject, title: actionState.rejectReason, onclick: function () { if (actionState.canReject) dogfoodReviewSelected({ selected: selected }, "reject"); } }, ["Reject"]),
      h("button", { class: "secondary", disabled: !actionState.canCancel, title: actionState.cancelReason, onclick: function () { if (actionState.canCancel) dogfoodReviewSelected({ selected: selected }, "cancel"); } }, ["Cancel"]),
      h("button", { class: "secondary", title: "Save bounded dashboard-private UI/session facts only.", onclick: workbenchSaveSnapshot }, ["Save snapshot"]),
      h("button", { class: "secondary", title: "Restore only bounded dashboard-private UI/session facts; no provider or Graph restore.", onclick: workbenchRestoreSnapshot }, ["Restore snapshot"]),
      h("div", { class: "df-action-hint", "aria-live": "polite" }, [
        actionHint("run", actionState.canRun, actionState.runReason),
        actionHint("propose", actionState.canPropose, actionState.proposeReason),
        actionHint("approve", actionState.canApprove, actionState.approveReason),
        actionHint("reject", actionState.canReject, actionState.rejectReason),
        actionHint("cancel", actionState.canCancel, actionState.cancelReason),
      ]),
    ]);
    var metrics = h("div", { class: "df-metrics" }, [
      dogfoodMetric("WorkItems", view.counters.workItems),
      dogfoodMetric("Deps", view.counters.dependencies),
      dogfoodMetric("Ready inputs", view.counters.readyInputs),
      dogfoodMetric("Outcomes", view.counters.outcomes),
      dogfoodMetric("Evidence", view.counters.evidence),
      dogfoodMetric("Issues", view.counters.issues),
      dogfoodMetric("Retention", view.counters.retentionEvidence),
      dogfoodMetric("Triage", view.counters.triage),
      dogfoodMetric("Facts", view.counters.facts),
    ]);
    var rail = h("aside", { class: "df-rail" }, [
      workbenchTriageInbox((scopedTriage || []).slice(0, 12), (scope === "selected" ? "Selected" : "Global") + " Triage Inbox", "No triage items in this scope."),
      dogfoodRows((scope === "selected" ? "Selected" : "Global") + " Issues", scopedIssues.slice(-8).reverse(), "No issues in this scope.", function (issue) {
        return h("div", { class: "df-row issue" }, [h("div", {}, [h("strong", {}, [issue.code]), h("span", {}, [issue.message || issue.subjectId || dogfoodRefsText(issue.sourceRefs)])]), dogfoodBadge(issue.severity || "info", issue.severity || "info")]);
      }),
      dogfoodRows((scope === "selected" ? "Selected" : "Global") + " Audit", scopedAudit.slice(-8).reverse(), "No audit entries in this scope.", function (audit) {
        return h("div", { class: "df-row" }, [h("div", {}, [h("strong", {}, [audit.event]), h("span", {}, [audit.subjectId || audit.id])])]);
      }),
      dogfoodRows((scope === "selected" ? "Selected" : "Global") + " Tool Runs", scopedRuns.slice(-8).reverse(), "No adapter run status in this scope.", function (run) {
        return h("div", { class: "df-row" }, [h("div", {}, [h("strong", {}, [run.workItemId || "unknown"]), h("span", {}, [run.runId])]), dogfoodBadge(run.status, run.status)]);
      }),
    ]);
    var detail = h("aside", { class: "df-detail" }, selected ? [
      h("div", { class: "df-detail-head" }, [h("span", { class: "df-status-dot " + safeLane(selected.lane) }), h("div", {}, [h("p", { class: "df-eyebrow" }, [selected.lane]), h("h2", {}, [selected.label])])]),
      h("p", { class: "df-summary" }, [selected.summary]),
      workbenchRecommendedActions(selectedTriage, actionState),
      h("section", { class: "df-section" }, [h("h3", {}, ["Execution Chain"]), bundle ? dogfoodChain(bundle) : h("p", { class: "df-empty" }, ["No selected execution chain."])]),
      h("section", { class: "df-section" }, [h("h3", {}, ["Route / Policy / Evidence"]), dogfoodRoutePolicyCards(bundle)]),
      dogfoodRows("Attempt History", bundle.runs || [], "No visible attempts yet.", function (run) {
        var status = view.toolRuns.filter(function (item) { return item.runId === run.runId; }).slice(-1)[0];
        return h("div", { class: "df-row" }, [h("div", {}, [h("strong", {}, ["attempt " + run.attempt]), h("span", {}, [run.runId])]), dogfoodBadge(status && status.status || "requested", status && status.status || "requested")]);
      }),
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
        return h("div", { class: "df-row" }, [h("div", {}, [h("strong", {}, [item.actionKind || item.kind]), h("span", {}, [item.proposalId || item.admissionId || item.applicationId || item.reviewId])]), dogfoodBadge(item.state || "recorded", item.state || "recorded")]);
      }),
      dogfoodRows("Action Review", actionReviews, "No action review state has been derived for this WorkItem.", function (item) {
        return h("div", { class: "df-row" }, [
          h("div", {}, [h("strong", {}, [item.state]), h("span", {}, [item.proposal.proposalId + " · " + item.relatedCount + " visible fact(s)"])]),
          dogfoodBadge(item.state, item.state),
        ]);
      }),
      dogfoodScopedSummary("Selected Issues", selectedIssues, "No selected WorkItem issue."),
      dogfoodScopedSummary("Selected Audit", selectedAudit.slice(-8).reverse(), "No audit entries for this selection."),
    ] : [h("p", { class: "df-empty" }, ["No visible WorkItem is selected for the active lane/status filters. Select a visible node or clear the filters before running an action."])]);
    var ledgerFacts = workbenchScopedLedgerFacts(scope, selected, bundle).concat([view.triageProjection], scopedTriage);
    var ledger = dogfoodInspector(view, ledgerFacts, scope);
    fill(v, [
      sectionH("CSP-8 Workbench", "reactive jira / messaging-hub · dashboard-private facts"),
      h("div", { class: "df-hero" }, [
        h("div", {}, [h("p", { class: "df-eyebrow" }, ["canonical target"]), h("h2", {}, [payload.dogfood.title]), h("p", {}, [payload.dogfood.note])]),
        actions,
      ]),
      metrics,
      filters,
      h("div", { class: "df-grid" }, [
        workbenchWorkspace("Queue", laneFilter + " / " + statusFilter, [dogfoodBoard(view)]),
        workbenchWorkspace("Execution", selected ? selected.id : "hidden selection", [detail]),
        workbenchWorkspace("Ledger", scope, [rail, ledger]),
      ]),
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
