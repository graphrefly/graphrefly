const links = [...document.querySelectorAll(".nav a")];
const normalizePath = (value) => value.replace(/\/index\.html$/, "/");
const path = normalizePath(window.location.pathname);

for (const link of links) {
  const href = normalizePath(new URL(link.href).pathname);
  if (href === path || (href !== "/" && path.startsWith(href))) {
    link.setAttribute("aria-current", "page");
  }
}

const flowRoot = document.querySelector("[data-causal-flow]");

if (flowRoot) {
  const requestedSkin = new URLSearchParams(window.location.search).get("flow");
  const flowSkin = ["relay", "orbit", "field"].includes(requestedSkin) ? requestedSkin : "relay";
  document.body.dataset.flowSkin = flowSkin;

  const overlay = flowRoot.querySelector(".causal-flow");
  const map = flowRoot.querySelector(".causal-flow-map");
  const rail = flowRoot.querySelector("[data-causal-rail]");
  const progress = flowRoot.querySelector("[data-causal-progress]");
  const branchLayer = flowRoot.querySelector("[data-causal-branches]");
  const branchProgressLayer = flowRoot.querySelector("[data-causal-branch-progress]");
  const maskLayer = flowRoot.querySelector("[data-causal-masks]");
  const nodeLayer = flowRoot.querySelector("[data-causal-nodes]");
  const spark = flowRoot.querySelector("[data-causal-spark]");
  const protocolMessages = [...flowRoot.querySelectorAll("[data-protocol-message]")];
  const diamondMessages = [...flowRoot.querySelectorAll("[data-diamond-message]")];
  const sections = [...flowRoot.querySelectorAll("[data-flow-label]")];
  const svgNamespace = "http://www.w3.org/2000/svg";
  let flowAnimations = [];

  const stepPath = (from, to, move = true, boundaryY = to.boundaryY) => {
    const middleY = Number.isFinite(boundaryY) ? boundaryY : (from.y + to.y) / 2;
    return `${move ? `M ${from.x} ${from.y}` : ""} V ${middleY} H ${to.x} V ${to.y}`;
  };

  const makeNode = ({ label, detail = "", x, y, kind = "main", section }) => {
    const node = document.createElement("div");
    node.className = `causal-node causal-node-${kind}`;
    if (section?.classList.contains("home-problem")) node.classList.add("causal-node-on-dark");
    node.style.setProperty("--flow-x", `${x}px`);
    node.style.setProperty("--flow-y", `${y}px`);
    const depth = kind === "branch" ? 15 : kind === "protocol" ? 20 : 28 + (nodeLayer.children.length % 3) * 5;
    node.style.setProperty("--flow-depth", `${depth}px`);

    const core = document.createElement("i");
    core.setAttribute("aria-hidden", "true");
    const copy = document.createElement("span");
    const title = document.createElement("b");
    title.textContent = label;
    copy.append(title);
    if (detail) {
      const description = document.createElement("small");
      description.textContent = detail;
      copy.append(description);
    }
    node.append(core, copy);
    nodeLayer.append(node);
    return node;
  };

  const layoutFlow = () => {
    if (window.matchMedia("(max-width: 1023px)").matches) return;
    const rootBox = flowRoot.getBoundingClientRect();
    const width = rootBox.width;
    const height = flowRoot.scrollHeight;
    const mainPoints = [];
    const branchEdges = [];
    let protocolStartPoint;
    let protocolEndPoint;
    let diamondStartPoint;
    let diamondBranchPoint;
    let diamondJoinPoint;
    let diamondBranchPoints = [];
    nodeLayer.replaceChildren();
    branchLayer.replaceChildren();
    branchProgressLayer.replaceChildren();
    maskLayer.replaceChildren();
    for (const animation of flowAnimations) animation.cancel();
    flowAnimations = [];

    for (const section of sections) {
      const box = section.getBoundingClientRect();
      const contentBox = section.querySelector(".flow-section-content")?.getBoundingClientRect() || box;
      const top = box.top - rootBox.top;
      const contentLeft = contentBox.left - rootBox.left;
      const contentRight = contentBox.right - rootBox.left;
      const contentWidth = contentRight - contentLeft;
      const mainNodeHalf = 154;
      const sideX = {
        left: contentLeft + mainNodeHalf,
        right: contentRight - mainNodeHalf,
      };
      const side = section.dataset.flowSide === "right" ? "right" : "left";
      const opposite = side === "left" ? "right" : "left";
      const explicitX = Number.parseFloat(section.dataset.flowX || "");
      const sectionX = Number.isFinite(explicitX)
        ? contentLeft + contentWidth * Math.min(0.86, Math.max(0.14, explicitX))
        : sideX[side];
      const oppositeX = Number.isFinite(explicitX)
        ? contentLeft + contentWidth * (1 - Math.min(0.86, Math.max(0.14, explicitX)))
        : sideX[opposite];

      if (section.dataset.flowPattern === "diamond") {
        const entry = { x: sectionX, y: top + 92, boundaryY: top };
        const branchY = top + 206;
        const join = { x: oppositeX, y: top + 318, timelineDelay: 220 };
        const labels = (section.dataset.flowBranches || "branch A|branch B|branch C").split("|");
        const branchPoints = labels.map((label, index) => ({
          label,
          x: contentLeft + contentWidth * (0.38 + index * 0.13),
          y: branchY,
          timelineDelay: 70,
        }));

        entry.nodes = [makeNode({ label: section.dataset.flowLabel, detail: section.dataset.flowDetail, ...entry, section })];
        const branchNodes = branchPoints.map((branch) => makeNode({ ...branch, kind: "branch" }));
        branchPoints[1].nodes = branchNodes;
        join.nodes = [makeNode({ label: "JOIN ONCE", detail: "Order total after changed paths settle", ...join, kind: "join" })];
        for (const [index, branch] of branchPoints.entries()) {
          branchEdges.push({ pathData: stepPath(entry, branch, true, null), type: "dirty", index });
          branchEdges.push({ pathData: stepPath(branch, join, true, null), type: "data", index });
        }
        mainPoints.push(entry, branchPoints[1], join);
        diamondStartPoint = entry;
        diamondBranchPoint = branchPoints[1];
        diamondJoinPoint = join;
        diamondBranchPoints = branchPoints;
        continue;
      }

      const ratio = Number.parseFloat(section.dataset.flowY || "0.5");
      const nodeY = Number.parseFloat(section.dataset.flowNodeY || "92");
      const point = {
        x: sectionX,
        y: section.classList.contains("focus-hero")
          ? top + box.height * Math.min(0.82, Math.max(0.18, ratio))
          : top + Math.min(box.height * 0.34, Math.max(76, nodeY)),
        boundaryY: top,
      };
      point.nodes = [makeNode({
        label: section.dataset.flowLabel,
        detail: section.dataset.flowDetail,
        ...point,
        section,
      })];
      mainPoints.push(point);

      if (section.id === "causal-walkthrough") {
        const producer = {
          x: contentLeft + Math.min(510, contentWidth * 0.44),
          y: point.y,
          boundaryY: point.y,
          timelineDelay: 70,
        };
        const derived = {
          x: contentRight - Math.min(250, contentWidth * 0.22),
          y: point.y,
          boundaryY: point.y,
          timelineDelay: 220,
        };
        producer.nodes = [makeNode({ label: "PRODUCER", detail: "upstream node", ...producer, kind: "protocol" })];
        derived.nodes = [makeNode({ label: "DERIVED", detail: "subscriber node", ...derived, kind: "protocol" })];
        mainPoints.push(producer, derived);
        protocolStartPoint = producer;
        protocolEndPoint = derived;
      }
    }

    const pathData = mainPoints.reduce((value, point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      return `${value}${stepPath(mainPoints[index - 1], point, false)}`;
    }, "");

    overlay.style.height = `${height}px`;
    map.setAttribute("viewBox", `0 0 ${width} ${height}`);
    rail.setAttribute("d", pathData);
    progress.setAttribute("d", pathData);
    spark.style.offsetPath = `path("${pathData}")`;
    const renderedPathLength = Math.max(1, progress.getTotalLength());
    progress.style.setProperty("--main-path-length", `${renderedPathLength}px`);
    progress.style.strokeDasharray = `0 ${renderedPathLength}`;
    progress.style.strokeDashoffset = "0";

    for (const edge of branchEdges) {
      const path = document.createElementNS(svgNamespace, "path");
      path.setAttribute("d", edge.pathData);
      path.setAttribute("pathLength", "1");
      branchLayer.append(path);
    }

    const pointDistances = [0];
    for (let index = 1; index < mainPoints.length; index += 1) {
      const from = mainPoints[index - 1];
      const to = mainPoints[index];
      const middleY = Number.isFinite(to.boundaryY) ? to.boundaryY : (from.y + to.y) / 2;
      pointDistances.push(pointDistances[index - 1]
        + Math.abs(from.y - middleY)
        + Math.abs(from.x - to.x)
        + Math.abs(to.y - middleY));
    }
    const totalPathLength = Math.max(1, pointDistances.at(-1));
    const documentRootTop = window.scrollY + rootBox.top;
    const scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    let previousTimelineOffset = 0;
    for (const [index, point] of mainPoints.entries()) {
      point.pathOffset = pointDistances[index] / totalPathLength;
      const desiredOffset = (documentRootTop + point.y - window.innerHeight * 0.52 + (point.timelineDelay || 0)) / scrollRange;
      point.timelineOffset = Math.min(0.985, Math.max(index === 0 ? 0.01 : previousTimelineOffset + 0.002, desiredOffset));
      previousTimelineOffset = point.timelineOffset;
      for (const node of point.nodes || []) {
        const arrival = point.timelineOffset * 100;
        node.style.setProperty("--node-arrival-start", `${Math.max(0, arrival - 0.16)}%`);
        node.style.setProperty(
          "--node-arrival-end",
          `${Math.min(100, point === diamondJoinPoint ? arrival : arrival + 0.16)}%`,
        );
      }
    }

    if (protocolStartPoint && protocolEndPoint && protocolMessages.length) {
      const protocolPath = `M ${protocolStartPoint.x + 66} ${protocolStartPoint.y} H ${protocolEndPoint.x - 66}`;
      const sequenceStart = protocolStartPoint.timelineOffset;
      const sequenceEnd = protocolEndPoint.timelineOffset;
      const sequenceStep = (sequenceEnd - sequenceStart) / protocolMessages.length;
      for (const [index, message] of protocolMessages.entries()) {
        message.style.offsetPath = `path("${protocolPath}")`;
        message.style.setProperty("--message-range-start", `${(sequenceStart + sequenceStep * index) * 100}%`);
        message.style.setProperty("--message-range-end", `${(sequenceStart + sequenceStep * (index + 1)) * 100}%`);
      }
    }

    const makeMask = (pathData, start, end) => {
      const path = document.createElementNS(svgNamespace, "path");
      path.setAttribute("d", pathData);
      path.setAttribute("pathLength", "1");
      path.style.setProperty("--gap-range-start", `${start * 100}%`);
      path.style.setProperty("--gap-range-end", `${end * 100}%`);
      maskLayer.append(path);
    };

    const hiddenIntervals = [];
    if (protocolStartPoint && protocolEndPoint) {
      hiddenIntervals.push([protocolStartPoint.timelineOffset, protocolEndPoint.timelineOffset]);
      makeMask(
        `M ${protocolStartPoint.x} ${protocolStartPoint.y} H ${protocolEndPoint.x}`,
        protocolStartPoint.timelineOffset,
        protocolEndPoint.timelineOffset,
      );
    }

    if (diamondStartPoint && diamondBranchPoint && diamondJoinPoint && diamondBranchPoints.length === 3) {
      hiddenIntervals.push([diamondStartPoint.timelineOffset, diamondJoinPoint.timelineOffset]);
      const diamondMainPath = `${stepPath(diamondStartPoint, diamondBranchPoint, true, null)}${stepPath(diamondBranchPoint, diamondJoinPoint, false, null)}`;
      makeMask(diamondMainPath, diamondStartPoint.timelineOffset, diamondJoinPoint.timelineOffset);

      const sequenceStart = diamondStartPoint.timelineOffset;
      const sequenceEnd = diamondJoinPoint.timelineOffset;
      const sequenceDuration = sequenceEnd - sequenceStart;
      const dirtyOutStart = sequenceStart;
      const dirtyOutEnd = sequenceStart + sequenceDuration * 0.22;
      const dirtyInStart = dirtyOutEnd;
      const dirtyInEnd = sequenceStart + sequenceDuration * 0.44;
      const dataOutStart = dirtyInEnd;
      const dataOutEnd = sequenceStart + sequenceDuration * 0.66;
      const dataInWindow = sequenceEnd - dataOutEnd;
      const dataInDuration = dataInWindow * 0.62;
      const dataInDelay = (dataInWindow - dataInDuration) / 2;
      const dataInStarts = [dataOutEnd, dataOutEnd + dataInDelay, dataOutEnd + dataInDelay * 2];

      for (const node of diamondBranchPoint.nodes || []) {
        node.style.setProperty("--node-arrival-start", `${Math.max(0, dirtyOutEnd * 100 - 0.16)}%`);
        node.style.setProperty("--node-arrival-end", `${dirtyOutEnd * 100}%`);
      }

      for (const [index, branch] of diamondBranchPoints.entries()) {
        const outPath = stepPath(diamondStartPoint, branch, true, null);
        const inPath = stepPath(branch, diamondJoinPoint, true, null);
        const phases = [
          { type: "dirty", leg: "out", pathData: outPath, start: dirtyOutStart, end: dirtyOutEnd },
          { type: "dirty", leg: "in", pathData: inPath, start: dirtyInStart, end: dirtyInEnd },
          { type: "data", leg: "out", pathData: outPath, start: dataOutStart, end: dataOutEnd },
          { type: "data", leg: "in", pathData: inPath, start: dataInStarts[index], end: dataInStarts[index] + dataInDuration },
        ];

        for (const phase of phases) {
          const message = diamondMessages.find((item) => item.dataset.messageType === phase.type
            && item.dataset.messageLeg === phase.leg
            && Number(item.dataset.messageIndex) === index);
          if (message) {
            message.style.offsetPath = `path("${phase.pathData}")`;
            message.style.setProperty("--message-range-start", `${phase.start * 100}%`);
            message.style.setProperty("--message-range-end", `${phase.end * 100}%`);
          }

          const path = document.createElementNS(svgNamespace, "path");
          path.setAttribute("d", phase.pathData);
          path.dataset.messageType = phase.type;
          path.dataset.messageLeg = phase.leg;
          path.dataset.messageIndex = `${index}`;
          path.style.setProperty("--branch-range-start", `${phase.start * 100}%`);
          path.style.setProperty("--branch-range-end", `${phase.end * 100}%`);
          branchProgressLayer.append(path);
          const branchPathLength = Math.max(1, path.getTotalLength());
          path.style.setProperty("--branch-path-length", `${branchPathLength}px`);
          path.style.strokeDasharray = `0 ${branchPathLength}`;
          path.style.strokeDashoffset = "0";
        }
      }
    }

    for (const [index, [start, end]] of hiddenIntervals.entries()) {
      spark.style.setProperty(`--spark-hide-${index + 1}-start`, `${start * 100}%`);
      spark.style.setProperty(`--spark-hide-${index + 1}-end`, `${end * 100}%`);
    }

    if (typeof ScrollTimeline === "function") {
      flowRoot.classList.add("has-scripted-flow");
      const scrollTimeline = new ScrollTimeline({ source: document.documentElement, axis: "block" });
      const sparkKeyframes = [
        { offset: 0, offsetDistance: "0%" },
        ...mainPoints.map((point) => ({ offset: point.timelineOffset, offsetDistance: `${point.pathOffset * 100}%` })),
        { offset: 1, offsetDistance: "100%" },
      ];
      const sparkVisibilityKeyframes = [{ offset: 0, opacity: 1 }];
      const progressKeyframes = [
        { offset: 0, strokeDasharray: `0 ${renderedPathLength}` },
        ...mainPoints.map((point) => {
          const travelled = renderedPathLength * point.pathOffset;
          return {
            offset: point.timelineOffset,
            strokeDasharray: `${travelled} ${Math.max(0, renderedPathLength - travelled)}`,
          };
        }),
        { offset: 1, strokeDasharray: `${renderedPathLength} 0` },
      ];
      for (const [start, end] of hiddenIntervals.sort((a, b) => a[0] - b[0])) {
        sparkVisibilityKeyframes.push(
          { offset: Math.max(0, start - 0.0001), opacity: 1 },
          { offset: start, opacity: 0 },
          { offset: end, opacity: 0 },
          { offset: Math.min(1, end + 0.0001), opacity: 1 },
        );
      }
      sparkVisibilityKeyframes.push({ offset: 1, opacity: 1 });
      flowAnimations = [
        spark.animate(sparkKeyframes, { duration: 1, fill: "both", timeline: scrollTimeline }),
        spark.animate(sparkVisibilityKeyframes, { duration: 1, fill: "both", timeline: scrollTimeline }),
        progress.animate(progressKeyframes, { duration: 1, fill: "both", timeline: scrollTimeline }),
      ];
    } else {
      flowRoot.classList.remove("has-scripted-flow");
    }
  };

  const flowResize = new ResizeObserver(layoutFlow);
  flowResize.observe(flowRoot);
  document.fonts?.ready.then(layoutFlow);
  layoutFlow();
}

const whyRoot = document.querySelector("[data-why-flow]");

if (whyRoot) {
  const indexLinks = [...whyRoot.querySelectorAll(".why-index a")];
  const records = [...whyRoot.querySelectorAll(".why-record")];
  const linkById = new Map(indexLinks.map((link) => [link.getAttribute("href")?.slice(1), link]));
  const whyIndex = whyRoot.querySelector(".why-index");
  const visibleRecords = new Set();

  const setActiveArgument = (record) => {
    const activeLink = linkById.get(record.id);
    if (!activeLink) return;
    for (const link of indexLinks) link.removeAttribute("aria-current");
    activeLink.setAttribute("aria-current", "true");
    const position = Math.max(0, indexLinks.indexOf(activeLink));
    whyIndex.style.setProperty("--why-progress", `${position / Math.max(1, indexLinks.length - 1)}`);
  };

  const whyObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) visibleRecords.add(entry.target);
      else visibleRecords.delete(entry.target);
    }
    const anchor = window.innerHeight * 0.26;
    const visible = [...visibleRecords]
      .map((record) => ({ record, top: record.getBoundingClientRect().top }))
      .sort((a, b) => {
        const aPassed = a.top <= anchor;
        const bPassed = b.top <= anchor;
        if (aPassed !== bPassed) return aPassed ? -1 : 1;
        return aPassed ? b.top - a.top : a.top - b.top;
      })[0];
    if (visible) setActiveArgument(visible.record);
  }, { rootMargin: "-22% 0px -58%", threshold: [0, 0.2, 0.55] });

  for (const record of records) whyObserver.observe(record);
}
