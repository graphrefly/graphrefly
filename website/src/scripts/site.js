const links = [...document.querySelectorAll(".nav a")];
const normalizePath = (value) => value.replace(/\/index\.html$/, "/");
const path = normalizePath(window.location.pathname);

for (const link of links) {
  const href = normalizePath(new URL(link.href).pathname);
  if (href === path || (href !== "/" && path.startsWith(href))) {
    link.setAttribute("aria-current", "page");
  }
}

const legacyShowcase = document.querySelector("[data-legacy-showcase]");
if (legacyShowcase) {
  const seekButtons = [...legacyShowcase.querySelectorAll("[data-ms]")];
  const seekShowcase = (ms) => {
    const animations = legacyShowcase.getAnimations
      ? legacyShowcase.getAnimations({ subtree: true })
      : document.getAnimations();
    for (const animation of animations) {
      try {
        animation.currentTime = ms;
      } catch {
        // Some browser-created animations may be read-only while initializing.
      }
    }
  };

  for (const button of seekButtons) {
    button.addEventListener("click", () => {
      const ms = Number.parseInt(button.dataset.ms, 10);
      if (Number.isFinite(ms)) seekShowcase(ms);
    });
  }
}

const showcase = document.querySelector("[data-protocol-showcase]");
if (showcase) {
  const buttons = [...showcase.querySelectorAll("[data-stage]")];
  const panels = [...showcase.querySelectorAll("[data-stage-panel]")];
  const stageViews = [...showcase.querySelectorAll("[data-stage-view]")];
  const stageCount = Math.max(buttons.length, panels.length, 1);
  let activeStage = 0;
  let timer = null;

  const setStage = (nextStage) => {
    activeStage = (nextStage + stageCount) % stageCount;
    for (const button of buttons) {
      const selected = Number(button.dataset.stage) === activeStage;
      button.setAttribute("aria-selected", selected ? "true" : "false");
    }
    for (const panel of panels) {
      panel.classList.toggle("is-active", Number(panel.dataset.stagePanel) === activeStage);
    }
    for (const view of stageViews) {
      view.dataset.stageView = String(activeStage);
    }
  };

  const startTimer = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer = window.setInterval(() => setStage(activeStage + 1), 6800);
  };

  const resetTimer = () => {
    if (timer != null) window.clearInterval(timer);
    timer = null;
    startTimer();
  };

  for (const button of buttons) {
    button.addEventListener("click", () => {
      setStage(Number(button.dataset.stage));
      resetTimer();
    });
  }

  setStage(0);
  startTimer();
}

const diagnosisRows = [...document.querySelectorAll(".diagnosis-row")];
if (diagnosisRows.length > 0) {
  const revealRow = (row) => row.classList.add("is-visible");
  revealRow(diagnosisRows[0]);

  if ("IntersectionObserver" in window) {
    const rowObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) revealRow(entry.target);
        }
      },
      { threshold: 0.38 },
    );
    for (const row of diagnosisRows) rowObserver.observe(row);
  } else {
    for (const row of diagnosisRows) revealRow(row);
  }
}

const requirementPanel = document.querySelector("[data-requirement-panel]");
if (requirementPanel) {
  const details = {
    bounded: {
      label: "Bounded steps",
      title: "Keep probabilistic work inside limited nodes.",
      body: "A model call, classifier, planner, or generator can be represented as one bounded step with explicit inputs, outputs, status, and downstream effects.",
    },
    verification: {
      label: "Verification",
      title: "Surround model-backed steps with checks.",
      body: "Verification nodes, review material, and deterministic checks can sit around a probabilistic step as ordinary graph-visible work.",
    },
    fallback: {
      label: "Fallbacks",
      title: "Recover without hiding the failure.",
      body: "Retries, fallback paths, and review gates can be modeled beside the step that failed, keeping uncertainty local instead of ambient.",
    },
    cost: {
      label: "Cost attribution",
      title: "Make token usage part of the causal picture.",
      body: "Token usage, latency, decisions, outputs, retries, and verification results can be reported around the node that caused them, making cost controllable.",
    },
  };
  const buttons = [...requirementPanel.querySelectorAll("[data-requirement]")];
  const label = document.getElementById("requirement-label");
  const title = document.getElementById("requirement-title");
  const body = document.getElementById("requirement-body");

  for (const button of buttons) {
    button.addEventListener("click", () => {
      const detail = details[button.dataset.requirement];
      if (!detail) return;
      for (const item of buttons) item.classList.remove("is-active");
      button.classList.add("is-active");
      if (label) label.textContent = detail.label;
      if (title) title.textContent = detail.title;
      if (body) body.textContent = detail.body;
    });
  }
}
