---
name: graph-animation
description: "Create GraphReFly concept videos with HyperFrames: message arrays, invocation, diamond settlement, batch requests, lifecycle and module composition. Supports a captioned concept-explainer or a silent ambient-hero loop. Verify depicted traces against activated rules before animating."
---

# GraphReFly concept animation

Read the current `authority/README.md` revision contract and affected activated `spec/rules.jsonl`
revisions first. Follow the personal `hyperframes` entrypoint for composition, deterministic motion,
preview and rendering. This skill supplies GraphReFly content guidance, not another renderer workflow.
Historical storyboards and decisions do not override current protocol. Read
`~/.codex/skills/project-governance/references/rules-decisions-work.md` for contract analysis or records.

## Select the explanation

Use the user's named concept and audience. If neither is supplied, ask which behavior to explain:
subscription/lifetime, a chain, diamond settlement, batch, quiet output, demand, or a module composition.
Use concept-explainer mode by default (30–90 seconds, captions and distinct beats). Use ambient-hero
for an explicitly requested silent hero/background/loop (roughly 42 seconds, sparse labels).
Both modes require the same trace validation; hero mode does not skip semantic checks.

When naming a package API, inspect its current exported source and tests. Use a current Codegraph
index where useful; otherwise direct reads/`rg` are sufficient. Do not initialize an index merely
for an animation. Do not claim an implementation behavior from a rule alone.

## Establish a verified trace

Write a small input → delivered arrays → invocation → retained output trace before drawing it.
Use the reference interpreter or the owning runtime's tests to substantiate concrete examples.
Record which result is executed evidence and which is an illustrative schematic.

- Current message names: START, PENDING, DATA, RESOLVED, INVALIDATE, COMPLETE, ERROR; resolve
  R-messages before using the list. Control, demand and teardown are not protocol messages.
- Each submitted array keeps its boundary. PENDING prefixes an appropriate delivered array; it
  is not an author-sent asynchronous “work in progress” signal. Never animate tier sorting.
- START accompanies the subscription snapshot. It does not itself promise a function run.
- Marking the pending cone and delivering arrays are different steps. A normal dependent waits
  for settlement of its required inputs and runs once on the wave's inputs.
- Silence may cause kernel RESOLVED; do not draw a redundant RESOLVED after DATA.
- INVALIDATE removes a retained value under its rule and is delivered separately from DATA.
- A function reads deps only during its supplying setup/invocation. State, signal and late down
  have lifetime semantics. Show cancellation/cleanup as lifetime actions, never extra messages.
- Automatic final COMPLETE follows final invocation arrays. For a quiet node these separate arrays
  share one later wave; do not animate a second downstream invocation just for that postlude.
- Graph queries do not compute. Observe is an actual subscription and may activate; retain holds
  a lifetime. Observe stop stops forwarding immediately, while connection release is queued.
- A dependency edge means declared structure, not that a particular event traversed it.

## Visual language

Default canvas: 1920×1080, background `#0F172A`. Nodes at least 80px, labels 24px; edges 3px
with clear arrows. Use circles for state/computation, a pill for an external producer, a rounded
rectangle for effects, and a hexagon for outside inputs. These are visual roles, not extra kernel
node kinds. Use package sugar names only after verifying that package exports them.

| Element | Color | Meaning |
|---|---|---|
| START | `#94A3B8` | Subscription snapshot envelope |
| PENDING | `#FBBF24` | Kernel notification prefix |
| DATA | `#34D399` | Value occurrence |
| RESOLVED | `#60A5FA` | Settlement without a new value |
| INVALIDATE | `#F59E0B` | Removal of retained value |
| COMPLETE | `#94A3B8` | Output ends normally |
| ERROR | `#F87171` | Output ends with error |
| Batch/lifetime bracket | `#A78BFA` | Annotation, never a message |

Use a shared enclosing outline to show messages in one array, and a separate wave bracket to
show multiple arrays in one wave. Distinguish a pending node highlight from a traveling envelope.
Resting edges are gray. Animate paths/transforms using the current HyperFrames motion contract.
Use 2–4 seconds per explanatory beat and an initial still frame for orientation.

## Concept-explainer patterns

### Diamond

Draw A → B/C → D. First highlight the pending cone, then show B/C input settlement and outputs,
then D's one invocation after its inputs settle. A filter branch can illustrate RESOLVED. Give
quiet branches a distinct later wave: a structural diamond alone does not promise one total run
across different waves. Caption the verified input rather than an unconditional topology claim.

### Batch

Show `batch(() => ...)` as a purple bracket. During its body, accumulate host writes at sources;
no notification or output is delivered yet. At commit, show the one coherent host-input wave.
Show queued body requests afterwards in body order. Late `ctx.down` is such a request, not a
staged host write. If teaching failure, distinguish body throw (discard all) from commit/updater
failure (no staged writes; ordinary body requests still drain). Never caption “batch defers DATA,
not notification.”

### Lifetime and invocation

A subscription/retain activates a cold node, setup runs once, then the function reads its input.
A later invocation has a new dependency-read view. Last release or terminal closes the lifetime;
show signal abort and cleanup, with late output from that closed lifetime dropped. Replacement
keeps node identity but closes the old instance and installs a new one. Cleanup may read the old
private state and perform authorized writeback; do not depict cleanup as protocol output.

### Module composition

Use ordinary declared nodes for demand, status, event logs and shared state. Async completion
submits a later output wave. A request feedback arrow must be visually distinct from dependency
edges: a DAG can schedule a later request back to a state, but cannot contain a dependency cycle.
Checkpoint restores cold; show the host explicitly retaining the desired root before work resumes.

## Ambient-hero storyboard (~42 seconds)

Treat these eight stages as a layout template; derive concrete traces from the current contract.
Keep labels to four words or fewer, use reduced saturation, and ensure the site's headline remains
legible over the busiest frame. Do not embed unverified public method signatures.

1. **Connection, 6s.** Two nodes, subscription START snapshot, one PENDING/DATA envelope and one
   invocation. End with a lifetime release annotation. Do not use a completed node as an open source
   in the next stage without visibly starting a fresh scenario.
2. **Diamond, 5s.** Grow to A/B/C/D, highlight the cone, settle both branches, invoke D once.
3. **One invocation, 5s.** Zoom into D: deps → fn → down. Show private state beside it and a
   lifetime signal ring; dim the deps window when the invocation returns. No invented kernel
   version counters, guard port or upward control channel.
4. **Composition, 5s.** State plus external source feed a derived computation and effect. Show
   a single verified batch if both source updates must reach the dependent in one wave.
5. **Graph, 8s.** Describe reveals structure; observe highlights actual delivered arrays and its
   subscription; a batch bracket holds writes until commit. Derive edges from dependencies.
   Mount/name/factory metadata belongs to package diagnostic functions, not Graph.inspect.
6. **Module data, 6s.** Show a declared events node and independent cursor/status consumers with
   explicit state dependencies. The animation must distinguish retained snapshots from new events.
7. **Feedback, 5s.** A DAG feeds an effect; a dashed request arrow queues a later state write.
   A separate memory node stores data through a declared edge. Optional `?` nodes suggest composition.
8. **Seam, 2s.** Fade decorative roles and return to the opening positions. Treat the reset as a
   visual transition, not an impossible resurrection of a terminal node.

## Author, verify and render

Follow the installed HyperFrames entrypoint and referenced CLI/motion skills; do not copy a stale
runtime template here. Make the timeline seekable, with no animation-driven wall-clock timers.
Verify initial, middle, terminal and seam frames with the current preview/capture tools.

Before handoff:

- Trace matches current arrays, wave boundaries, invocation and lifetime rules.
- No retired control/teardown messages, implicit shared state or dependency cycles.
- Every named API exists in the selected package; diagnostic functions are called as functions.
- No assertion that an edge proves occurrence or causality.
- Captions/labels are readable; ambient mode preserves headline contrast and a smooth seam.
- Required lint/validation/render commands passed; report the actual files and any unrun checks.

Provide the rendered artifact and a short source-backed explanation of the depicted behavior.
Animation completion does not mark protocol work or conformance complete.
