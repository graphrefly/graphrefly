const links = [...document.querySelectorAll(".nav a")];
const normalizePath = (value) => value.replace(/\/index\.html$/, "/");
const path = normalizePath(window.location.pathname);

for (const link of links) {
  const href = normalizePath(new URL(link.href).pathname);
  if (href === path || (href !== "/" && path.startsWith(href))) {
    link.setAttribute("aria-current", "page");
  }
}

const showcase = document.querySelector("[data-protocol-showcase]");
if (showcase) {
  const buttons = [...showcase.querySelectorAll("[data-stage]")];
  const panels = [...showcase.querySelectorAll("[data-stage-panel]")];
  let activeStage = 0;
  let timer = null;

  const setStage = (nextStage) => {
    activeStage = (nextStage + panels.length) % panels.length;
    for (const button of buttons) {
      const selected = Number(button.dataset.stage) === activeStage;
      button.setAttribute("aria-selected", selected ? "true" : "false");
    }
    for (const panel of panels) {
      panel.classList.toggle("is-active", Number(panel.dataset.stagePanel) === activeStage);
    }
  };

  const startTimer = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer = window.setInterval(() => setStage(activeStage + 1), 6500);
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

const requirementPanel = document.querySelector("[data-requirement-panel]");
if (requirementPanel) {
  const details = {
    declare: {
      label: "Declare",
      title: "Topology is the first artifact.",
      body: "GraphReFly docs start from nodes, edges, and waves because those are the objects developers need to reason about across every package.",
    },
    push: {
      label: "Push",
      title: "Updates move as waves.",
      body: "The public mental model is push-based: DIRTY prepares the reachable graph, then values settle through declared edges without polling.",
    },
    inspect: {
      label: "Inspect",
      title: "The graph should explain itself.",
      body: "The site keeps topology maps, wave traces, batch boundaries, and composition visible as concepts before asking a reader to choose a language package.",
    },
    delegate: {
      label: "Delegate",
      title: "Exact syntax belongs with the package.",
      body: "The shared site gives the cross-language model. TypeScript, Python, and Rust routes point to package-owned references, demos, and release material.",
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
