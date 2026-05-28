/* GraphReFly · Control — client renderer (classic script, file:// safe).
   build.mjs emits a semantic skeleton (#topbar #gauges #tabs #view-* #footer);
   this PROGRESSIVELY ENHANCES those named containers. build.mjs owns DATA. */
(function () {
  "use strict";
  var payload = JSON.parse(document.getElementById("payload").textContent);
  var M = payload.model, G = payload.gaps, C = payload.counts;
  var gapTotal = Object.keys(G).reduce(function (n, k) { return n + G[k].length; }, 0);
  var $ = function (id) { return document.getElementById(id); };

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
