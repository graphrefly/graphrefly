function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderHomeShowcase(example) {
  const branchY = [82, 190, 298];
  const branches = example.branches
    .map((branch, index) => {
      const y = branchY[index];
      return `<g class="focus-branch focus-branch-${index + 1}" transform="translate(390 ${y})">
        <rect x="-76" y="-27" width="152" height="54" rx="8" />
        <text class="focus-node-title" y="-3">${escapeHtml(branch.label)}</text>
        <text class="focus-node-detail" y="15">${escapeHtml(branch.detail)}</text>
      </g>`;
    })
    .join("");
  const edges = branchY
    .map((y, index) => `<path class="focus-edge focus-edge-${index + 1}" pathLength="1" d="M170 190 H242 V${y} H314" /><path class="focus-edge focus-edge-${index + 1}" pathLength="1" d="M466 ${y} H538 V190 H610" />`)
    .join("");
  const mobileBranches = example.branches
    .map((branch) => `<span><b>${escapeHtml(branch.label)}</b><small>${escapeHtml(branch.detail)}</small></span>`)
    .join("");
  const diagramLabel = escapeHtml(example.diagram.aria_label);
  return `<figure class="focus-showcase" aria-labelledby="focus-showcase-title focus-showcase-caption">
    <div class="focus-showcase-top"><span id="focus-showcase-title">${escapeHtml(example.diagram.heading)}</span><span>GraphReFly</span></div>
    <svg viewBox="0 0 780 380" role="img" aria-label="${diagramLabel}">
      <g class="focus-edges">${edges}</g>
      <g class="focus-source" transform="translate(108 190)">
        <rect x="-62" y="-34" width="124" height="68" rx="10" />
        <text>${escapeHtml(example.source_label)}</text>
      </g>
      ${branches}
      <g class="focus-result" transform="translate(676 190)">
        <rect x="-64" y="-38" width="128" height="76" rx="10" />
        <text>${escapeHtml(example.result_label)}</text>
        <path d="m-13 14 8 8 18-22" />
      </g>
    </svg>
    <ol class="focus-mobile-flow" aria-label="${diagramLabel}">
      <li><span>1</span><div><b>${escapeHtml(example.source_label)}</b><small>${escapeHtml(example.diagram.source_detail)}</small></div></li>
      <li><span>2</span><div class="focus-mobile-branches">${mobileBranches}</div></li>
      <li><span>3</span><div><b>${escapeHtml(example.result_label)}</b><small>${escapeHtml(example.diagram.result_detail)}</small></div></li>
    </ol>
    <figcaption id="focus-showcase-caption"><strong>${escapeHtml(example.diagram.caption_lead)}</strong> ${escapeHtml(example.diagram.caption_body)}</figcaption>
  </figure>`;
}
