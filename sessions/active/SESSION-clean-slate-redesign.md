# SESSION — Clean-Slate Redesign (L0–L6 full-stack greenfield)

**Status:** 🌱 DESIGN LOCKED (L0–L6) — implementation proceeds through the CSP sequencer
**Opened:** 2026-05-27
**Trigger:** User-initiated greenfield redesign on a NEW branch. Explicit terms: *no backward compat · no scope limit · all best practices · top-down design*. Follows the handle-dispatch substrate session (R1–R12) and the user's hypothesis that handle-dispatch can "resolve TS↔Rust parity altogether."
**Method:** Top-down 6-layer design (L0 Identity → L6 Distribution). Each layer fully locked before descending; **lower layers may not overturn upper layers**. Each lock may carry ≤1 hard constraint downward (recorded as `F-*` forced constraints). Forcing-question Q&A driven; every answer reformulated into a locked statement and confirmed.

**Relationship to prior work:**
- SUPERSEDES the incremental implementation-plan for the purposes of a clean-slate branch (does NOT delete the existing repo's plan; this is a parallel greenfield target).
- Builds directly on `SESSION-handle-dispatch-substrate.md` R8/R9/R10/R11/R12 (uniform handle table · callback-IS-wave · FactoryRegistry-as-primitive · DIRTY-as-consistency-primitive).
- **Resolves the parity hypothesis** at L3-Q7: parity moves from *structural* (`Impl` symbol set) to *behavioral* (protocol conformance). `docs/cross-track-ledger.md` retires.
- R11's pre-1.0 wedge (memory+harness) is **overturned** at L0.5 → horizontal narrow-waist, no wedge.

---

## How to read this doc

Each layer has a lockdown table. `F-*` = forced constraint propagated downward. `🔴` = open risk that was routed through `/design-review` or later backlog/design records. Strawman code is illustrative, not normative — the normative content is the lock tables plus the D# log.

This began as a pure design artifact, but the active implementation state now lives in the jsonl sources: `decisions/decisions.jsonl`, `plan/phases.jsonl`, `plan/backlog.jsonl`, `spec/rules.jsonl`, and `spec/conformance.jsonl`. Treat this markdown as narrative context; the structured records are the current sequencer.

---

## L0 — Identity

| ID | Lock |
|---|---|
| L0.1 | **GraphReFly is a reactive universal reduction layer.** Problem class: high fan-in/out → information reduction → push. Current focus segments: agentic memory + agent harness, but substrate is **NOT** LLM-limited. Performance (DX + production) is a **first-class constraint** — never traded away for LLM-only use cases. |
| L0.2 | Coverage stance = "**not just**" (not "is not"): not just workflow engine / stream processor / message bus / RPC framework / reactive UI runtime / LLM SDK / ETL / vector DB. May serve a subset of each role as a narrow-waist substrate; does not replace their full feature set. Segment-specific frameworks can be built *on top of* GraphReFly. |
| L0.3 | Mental anchor = **graph-first**. Topology is the shared cognition anchor for humans + LLMs. `describe()` is a **first-class output**, not a debug aid. → L4 API must expose graph shape as the primary surface (not hidden in closures). |
| L0.4 | Moats (one line each, no marketing): vs **LangGraph** = auto-push + smaller shared-state unit (not supervisor grabbing global state); vs **Temporal/Restate** = smaller, more agile, LLM-creatable + human-explainable, not a black box; vs **Mem0/LangMem** = provenance + forgetting mechanisms (not just retrieve top-k); vs **SolidJS/Vue signals** = universal glue, sync/async/asyncIter all taken over; vs **Kafka Streams/Flink** = reactive local processing + tiered information, not just record+push; vs **Excel** = push + minimal lib size, fits where Excel can't go (telemetry / async / connectors). |
| L0.5 | **No pre-1.0 wedge.** Horizontal narrow-waist story (OVERTURNS R11 memory+harness wedge). Pre-1.0 must cover the minimal credible path across multiple segments. → priority cannot "cut a segment via the wedge"; must find cross-cutting features serving ≥2 segments. |
| L0.6 | Success (3yr): **(b) primary + (c) aspirational**. (b) = direct developer tool, Astro/Next.js-grade DX — this is the pre-1.0 deliverable. (c) = LSP/MCP-style protocol with multiple independent impls — **aspirational only, NOT a pre-1.0 deliverable**. The L2 protocol spec exists for OUR OWN discipline (anti-drift, anti-ad-hoc), not to invite reimplementation. |
| L0.7 sacred | 4 non-negotiables: (1) topology declarative/serializable/inspectable; (2) wave protocol is a public spec; (3) wave protocol implementation is **sync**; (4) **all fn go through dispatcher / FactoryRegistry**. |

### Forced constraints (L0 → lower layers)

| ID | Constraint | Lands |
|---|---|---|
| F-PERF | Every abstraction layer carries a nanosecond-level budget estimate; violators don't lock | L2/L3/L4/L5 bench |
| F-PROTO-SPEC | Wave protocol has public spec doc + TLA+ + property tests; no "implementation defines behavior" | L2 |
| F-SYNC-CORE | `dispatcher.invoke` is always sync void (R9); async/remote via callback; LocalSync pool mandatory | L3 |
| F-DISPATCH-ALL | No "inline fn bypasses dispatcher"; `node((ctx)=>…)` also goes through LocalSync pool (R8) | L3/L4 |
| F-GRAPH-FIRST-API | User's first line constructs graph topology, not factory registration nor auto-tracked plain fn | L4 |
| F-NO-WEDGE-CUT | Pre-1.0 may not cut cross-cutting features citing a wedge; every primitive serves ≥2 segments | L4/L6 |
| F-NO-IMPL-DEFINED | No "implementation defines what happens"; either spec-locked or listed in spec's "intentionally implementation-defined" | L2 |
| F-NO-LLM-ONLY | Any primitive meaningful only to LLM workflows is cut or redesigned universal | L4 |

---

## L1 — Vocabulary

| ID | Lock |
|---|---|
| L1.1 | L4 verb **closed set = 8**: `node` · `graph` · `batch` · `state` (core) + `producer` · `derived` · `effect` · `mount` (sugar). `state` added at L4-Q1. Operators are NOT verbs (L1.5). |
| L1.2 | Naming anchor = engineering: `node / derived / graph / batch`. TS camelCase / Rust snake_case / Py snake_case / spec PascalCase types + ALL_CAPS protocol words. |
| L1.3 | **Node ↔ Graph responsibility split.** Node = thinnest (holds fn handle + deps + wave state machine; **zero inspection cruft**). Graph = all convenience + inspection (register/name/find/describe/observe/explain/profile/snapshot/mount/batch/operators). `g.*` sugars desugar to `dispatcher.register` + Node + auto-register into graph inspection index. Bare `node()` works at substrate level but loses inspection/naming/find/describe. |
| L1.4 | Graph is optional convenience, not mandatory container. Multi-graph natural. |
| L1.5 | Operators (map/filter/scan/merge/switchMap/debounce/throttle/distinctUntilChanged/withLatestFrom/bufferTime/take/reduce/tap) are **`node` sugar (not necessarily `derived` sugar)**; spec does NOT record operator semantics; `describe()` shows their real factory name (not a pile of "derived"). |
| L1.6 | `dispatcher` and `handle` are L4 first-class concepts (nameable/referenceable/inspectable) — but **value types**, not verbs. |
| L1.7 | Catalog dissolved: `dispatcher.register(fn, {tags, runtime, …})` + `d.list({tag})` reactive filter view. No `catalog` keyword. |
| L1.8 | fn body uses `ctx` (substrate level; sugar level differs, see L4-Q2). |
| L1.9 | **`node(deps, h, opts?)` — deps always first argument** (graph mental model: think deps first, then relation). `name` in opts + auto-name from factory-tag + sequence when omitted. |
| L1.10 | Sugar = **thin** over node. Behavioral diffs via node options + fn-body behavior, not distinct types. Spec only covers `Node` + wave protocol; 4 extensions are L4 syntactic sugar. |
| L1.11 | `ctx.up(msgs)` / `ctx.down(msgs)`; **one `msgs` array = one Wave**; msgs may mix tiers (`[["DATA",v],["COMPLETE"]]` legal). ERROR/COMPLETE are tiers not methods. Old `actions.emit / node.up / node.down / forward / backward` all dropped from fn surface. |
| L1.12 | up/down is the unified substrate-boundary naming (L4 ctx, L3 node↔handle/dispatcher↔fn, L2 spec all use up/down). No "internal up/down, external forward/backward" translation layer. |
| L1.12.A | **Handle = pure data `(pool_id, handle_id)`, NO method.** node ≠ handle. node has up/down methods (external-world boundary); handle is a dispatcher table index → serializable/snapshottable/wire-transferable. |
| L1.13 | proceed/rollback absorbed into message tiers: proceed=`[["DATA",v]]`, rollback=`[["ERROR",e]]`, invalidate=`[["INVALIDATE"]]`, terminal-success=`[["DATA",v],["COMPLETE"]]`. Not separate API methods. |

---

## L2 — Protocol

| ID | Lock |
|---|---|
| L2.A | **9 tiers**: value-settle = DIRTY/DATA/RESOLVED/INVALIDATE; terminal = COMPLETE/ERROR/TEARDOWN; control = **PAUSE/RESUME (tier-0, orthogonal to value flow)**. Closed set. |
| L2.B | Wave boundary: outside batch = one `ctx.down(msgs)` call; inside batch = accumulate to commit. |
| L2.C | PAUSE/RESUME = `[["PAUSE", lock_id]]` / `[["RESUME", lock_id]]`; **lockset/refcount** (all locks must RESUME to truly resume); lock_id caller-generated; same-id repeat PAUSE idempotent; RESUME unknown id = no-op. |
| L2.D / D' | In-process message = **tuple** (debug-friendly, NOT for serialization size). Wire = **protobuf** (when compact needed). The two representations are **decoupled**; conversion at wire-bridge boundary. |
| L2.E | batch = **declarative default** (success→commit / throw→rollback) + `bctx.rollback()` explicit escape hatch; **commit always implicit** (eliminates "forgot to commit" class). 3-lang aligned: TS callback / Py `with batch():` / Rust `Drop`. |
| L2.F | cross-runtime = **per-runtime local dispatcher + wire bridge**; DIRTY crosses wire at same priority as DATA (R12); mesh/service-discovery is the USER's infra concern (bring your own zookeeper/consul). |
| L2.G | push-on-subscribe is part of the protocol. |
| L2.H | Formalization depth = **γ** (markdown spec + TLA+ model + cross-impl property tests). |
| L2-Q8 | diamond/fan-in coalesce: spec writes only **observable behavior** ("D recomputes exactly once after all changed deps settle in same wave"); mechanism (dirtyMask) is impl freedom; TLA+ models the mechanism. |
| L2-Q9 | equals default substitution (hit→RESOLVED / miss→DATA); custom equals is L4 opts. **equals substitution fires ONLY when wave has exactly 1 DATA** — 0 DATA irrelevant, ≥2 DATA does not engage (multi-DATA has no skip-fn benefit, all pass as DATA). |
| L2-Q10 | SENTINEL = protocol concept ("absence-of-DATA" must be decidable); concrete sentinel value is **per-language representation** (TS `undefined` / Rust `Option::None` / Py sentinel), same semantics. |
| L2-Q11 | terminal-is-forever default; `resubscribable: true` opt-in. |
| L2-Q12 | SENTINEL state push-on-subscribe pushes only `[START]`; dirty state pushes `[START, DIRTY]`. |
| L2-Q13 | `messageTier` classification = **compile-time const table**, not runtime config. |
| L2-Q14 | message type attributes (tier/wireCrossing/metaPassthrough) = compile-time const table; **custom message type extension CUT** (L2.A closed set; adding a tier = spec change, rare/constitutional). |
| L2-Q15 | `onMessage`/`onSubscribe` = **substrate-fixed protocol behavior, NOT replaceable**. Observe via inspector (read-only); inject logic by adding a node; new tier via spec change. (Cuts user-defined protocol stacks — F-NO-IMPL-DEFINED.) |

---

## L3 — Substrate / Kernel

| ID | Lock |
|---|---|
| L3-Q1 | pool 1.0 essentials = **LocalSync + LocalAsync**; dispatcher structure keeps a **pluggable pool trait** (WorkerPool/RemotePool added with L2.F wire bridge maturity). |
| L3-Q2 | dispatcher = explicit first-class; pool attached to dispatcher; graph bound to a dispatcher (default = process-global). |
| L3-Q3 | Node self-contains wave state machine (handle_ref · deps · dep_records · dirty_mask · pending_count · cache · status · subscribers · _inside_run_wave · pause_lockset). "Thin" = no inspection cruft, NOT no wave state. |
| **L3.C** | **graph = causal domain = concurrency domain = single thread.** Compute parallelism via pool callback (wave-state mutation always serializes back to graph's single thread); true parallelism via multi-graph + wire bridge. **Rust drops actor model (D221/D222) → `!Send` single-thread core; Py drops per-subgraph RLock → single-thread core + multi-instance.** rewire only intra-graph; inter-graph only wire bridge. Consequence 1 (accepted): disjoint waves in same graph don't parallelize (→ use separate graphs). Consequence 2 (accepted): rewire scope = single graph; `setDeps/addDep/removeDep` has no inter-graph form. |
| L3-Q5 | ctx lifecycle per-pool: LocalSync uses node-stable ctx (reset fields, zero alloc); async pools use per-invocation ctx (survives await/boundary). |
| L3-Q6 | `ctx.state` = per-node private cross-wave state (implicit OK — node-private, not shared). Shared memory = explicit node + dep (graph-first). Operators' state/cleanup hide in their graph-layer impl. |
| L3-Q7 | **parity = behavioral conformance (replaces structural `Impl`)** + property mirror. Operators/sugar/inspection are L4 per-language, never in parity. New substrate behavior is spec-driven. **`cross-track-ledger.md` retires** ("Impl widening" concept disappears). Parity surface shrinks to: wave protocol behavior + dispatcher contract + handle format. |
| L3-Q8 | snapshot = topology + cache + factory-name refs; restore re-resolves by name via dispatcher registry; incremental via DS-14 changeset; anonymous inline fn (no name) marked `local-only` (can't restore cross-process — honestly labeled). |
| L3-Q9 | clock: monotonic = **graph-local counter** (folded into graph; causal-domain ordering); wall = system call; **no global clock singleton**. (Rewrites CLAUDE.md "Time utility rule".) |
| L3-Q10 | Only global singleton = default dispatcher (overridable by explicit dispatcher); all other defaults = graph/dispatcher opts. |
| L3-Q11 | All operational config (limits/policy/inspector/versioning/codec/hashFn) = graph/dispatcher opts with defaults; **no global config singleton; freeze mechanism gone**. |

---

## L4 — User API

| ID | Lock |
|---|---|
| L4-Q1 | `state` = 8th verb; `state.set(v)` = `node.down([["DATA",v]])` sugar (root emits DATA downstream); node has external up/down methods. |
| L4-Q2 | **sugar→ctx-fn conversion strictly in graph layer; dispatcher/node only accept `(ctx)=>void`.** All convenience fn forms (return-value, spread values, value-level operator) wrap to ctx-fn at register time. → fuels L3-Q7 (per-language sugar abstracted away before register, never in parity). Levels: `node`/`producer` = ctx-level; `derived`/`effect`/operator = value-level (graph-layer wrapped). |
| L4-Q3 | operator fn = value-level (does not touch protocol); `node/derived/producer/effect` boundary: derived/effect value-level, node/producer ctx-level. |
| L4-Q4 | `graph(opts?)` default global dispatcher, `{dispatcher, name}` optional; `g.mount(subgraph, {at})` (mount has no deps, exempt from deps-first). |
| L4-Q5 | cleanup = `ctx.onDeactivation(fn)` (external resource release) + `ctx.onInvalidate(fn)` (INVALIDATE flush). **2 hooks** (cut onRerun [0 real callsites] + onResubscribableReset [1 callsite → absorbed by ctx.state]). return freed for sugar mapping. |
| L4-Q6 | `ctx.state` default **fresh-lifecycle wipe**; `ctx.state.persist(boolean?)` to keep across lifecycle. (restore ≠ fresh-lifecycle — see Flag 1.) |
| L4-Q7 | **SUPERSEDED by D48** — all operators ship in the main `@graphrefly/ts` package as free-standing tree-shakable factories (`sideEffects:false`); no `@graphrefly/<lang>-operators` subpackage (ESM tree-shaking obviates the split). *Original lock:* operator ship tiered: core set in main pkg; time-based + higher-order in `@graphrefly/<lang>-operators` subpackage. |
| L4-Q8 | inspection = **describe (incl. explain mode) + observe + profile** (3 first-class); renderers (pretty/mermaid/d2) are pure functions over describe, not methods. |
| L4-Q9 | dispatcher/handle power-user API: `d.register(fn,{tags,runtime,pool})→Handle`; `d.list({tag})` = catalog; `g.node(deps,h)`; `d.registerPool(kind,adapter)`. |
| L4-Q10 | error: fn `throw` → graph-layer catch → `[["ERROR",e]]` down (node/producer ctx-level write ERROR directly; value-level throw caught by graph layer). cancellation: default no-cancel; `{switch:true}` opt-in switchMap semantics + AbortSignal via ctx. |
| L4-Q11 | error = `unknown` (`Node<T>` single generic; no `Node<T,E>` — type-combo explosion impractical, cross-lang `Box<dyn Error>`/`Exception` are top types). |
| L4-Q12 | `Node<T>` single generic; `ctx.state` S=unknown default; deep type inference is per-language impl detail. |
| L4-Q13 | TS generics / Rust trait-based (`Node`/`Dispatcher`/`Pool` traits; handle = `(PoolId,HandleId)` newtype) / Py `Protocol` typing + **no `async def` in public API**. |

### ctx final shape

```ts
type Wave = Message[]
type Ctx<TDeps> = {
  up(msgs: Wave): void                                   // upstream inject (PAUSE/RESUME/invalidate-request)
  down(msgs: Wave): void                                 // downstream emit (DATA/ERROR/COMPLETE/...)
  depRecords: DepRecord<TDeps>[]                         // latest/tier/prevData per dep
  state: { get(): S|undefined; set(v: S): void; persist(on?: boolean): void }  // per-node private
  onDeactivation(fn: () => void): void                   // external resource release
  onInvalidate(fn: () => void): void                     // INVALIDATE flush
}
```

### Strawman hello world

```ts
import { graph } from "@graphrefly/ts"
const g = graph()                                        // default global dispatcher

const count = g.state(0)                                 // root mutable; count.set(5) = node.down sugar
const doubled = g.derived([count], (n) => n * 2)         // value-level, return → DATA
g.effect([doubled], (n) => console.log(n))               // value-level sink, return cleanup fn → onDeactivation
const evens = g.filter([count], (n) => n % 2 === 0)      // operator = node sugar, value-level fn

g.describe(); g.observe("doubled")                       // inspection on graph
count.set(5)
```

---

## L5 — Engineering

| ID | Lock |
|---|---|
| L5-Q1 | bench suite = **informational** (NOT CI gate). F-PERF is a design discipline; bench validates, does not hard-gate. |
| L5-Q2 | parity = **language-agnostic scenario spec + per-runtime adapter** + property-test mirror (fast-check↔proptest↔hypothesis). New scenario/property added to conformance suite, each runtime runs green. No symbol-set coordination. |
| L5-Q3 | substrate 1.0 includes **streaming describe/observe** (so viz can be built); viz UI itself is a dev-tool, may be post-1.0. (founding vision: live topology + per-node cache values.) |

---

## L6 — Distribution

| ID | Lock |
|---|---|
| L6-Q1 | **per-language independent complete packages** (`@graphrefly/ts` · `@graphrefly/rust` · `@graphrefly/py`, each = substrate + sugar + operators) + coarse-grained wire bridge. NO cross-language peer-deps. **Drops D080/D206 entirely** (no presentation-peer-deps-substrate, no sync-vs-async drop-in, no overrides redirect, no Option-B anxiety) + drops the 9.5× concurrency-machinery tax (actor model + fine-grained napi). Trade-off: gives up the (never-functional) "TS code transparently enjoys Rust substrate" fantasy; cross-language = wire bridge, not in-process napi swap. |
| L6-Q2 | naming: keep `@graphrefly/` namespace, per-language subpackages; brand "GraphReFly" unchanged; operator subpkg `@graphrefly/<lang>-operators`. |
| L6-Q3 | wire = protobuf schema-codegen (single `.proto`, per-language codegen); in-process tuple ↔ protobuf at wire-bridge boundary; **implementation deferred** (with cross-runtime, post-1.0). Design-time lock: wire = schema-codegen, not ad-hoc JSON. |
| L6-Q4 | adoption path: `npm i @graphrefly/ts` → `graph()` → 10-line hello world → operators → producer/connector → wire-bridge dispatch heavy node to Rust runtime. Zero-config default global dispatcher + LocalSync pool. |

---

## Flag resolutions (found during the roll-up, pre-design-review)

| Flag | Resolution |
|---|---|
| **1 🔴 restore vs fresh-lifecycle wipe** | restore ≠ fresh lifecycle. snapshot serializes ALL ctx.state (persist-flag irrelevant to snapshot); restore restores ALL (state-preserving, "restored" status not "fresh"); wipe only on fresh-lifecycle transition. **Must be written into spec.** CLOSE-with-rule. |
| **2 F-NO-WEDGE-CUT verify** | All 8 verbs serve ≥2 segments (node/graph/batch/derived=all; state=UI/harness/memory; producer=stream/DE/UI; effect=UI/harness/DE; mount=harness/memory/multi-agent). CLOSED. |
| **3 effect maps onDeactivation only** | Accepted limit, doc it. effect = React-useEffect form (return cleanup = deactivation only); INVALIDATE cleanup → upgrade to node/producer. CLOSED. |
| **4 PAUSE/RESUME via ctx.up** | ctx.up carries control tier; upstream node updates `pause_lockset` (L3-Q3). CLOSED. |
| **5 equals custom passing (operator value-level)** | equals via opts (`g.map(deps,fn,{equals})`), not fn param; value-level fn only transforms. CLOSED. |

## config singleton dissolution (17 items)

`GraphReFlyConfig` singleton + freeze-on-first-read mechanism **fully dissolved** into 4 destinations:
- **A. compile-time const** — message type attrs (tier/wireCrossing/metaPassthrough), tier lookups; custom message type extension CUT.
- **B. substrate-fixed (unreplaceable)** — onMessage (dispatch), onSubscribe (push-on-subscribe handshake).
- **C. graph/dispatcher/constructor opts** — codec; node runtime versioning default/policy and hashFn via graph/constructor opts per D109 (V0 default, V1 cid/prev, V2/V3 still deferred); inspectorEnabled, globalInspector (→ dispatcher hook), rigorRecorder (→ dispatcher test-only hook), maxFnRerunDepth (100), maxBatchDrainIterations (1000), pauseBufferMax (10_000), equalsThrowPolicy.
- **D. gone** — `_frozen` + freeze mechanism; isolated `new GraphReFlyConfig` for test (test isolation = `new graph()`).

Trade-off accepted: cuts user-defined protocol stacks (onMessage/onSubscribe/registerMessageType custom). To observe → inspector (read-only); to inject logic → add a node; new tier → spec change.

---

## Delta map vs existing TS/Rust codebases (for post-design-review implementation)

| Area | Today | Clean-slate |
|---|---|---|
| Rust concurrency | actor model (D221/D222, per-Core actor thread + sync channel) | `!Send` single-thread core + multi-instance + wire bridge (drops 12× actor.run overhead + D292 libuv deadlock class) |
| Py concurrency | per-subgraph RLock + per-node cache_lock | single-thread core + multi-instance |
| Concurrency unit | subgraph | **graph** (= causal domain) |
| Parity | structural `Impl` interface (symbol set) + cross-track-ledger + per-symbol D-number | **behavioral conformance suite** + property mirror; cross-track-ledger retires |
| Packaging | pure-ts (substrate) + native (rust, napi) + graphrefly (presentation, peer-deps substrate) — D080/D206 | per-language independent complete packages + coarse wire bridge |
| TS↔Rust | TS presentation on Rust substrate via napi (fine-grained, never functional per D206) | each language self-contained; cross-language = coarse wire bridge (dispatch heavy node) |
| fn signature | `(data, actions, ctx) => NodeFnCleanup\|void` | `(ctx) => void` (ctx = up/down/depRecords/state); sugar return mapped in graph layer |
| cleanup | `return NodeFnCleanup` (4 hooks: onRerun/onDeactivation/onInvalidate/onResubscribableReset) | `ctx.onDeactivation` + `ctx.onInvalidate` (2 hooks) |
| config | `GraphReFlyConfig` singleton + freeze-on-first-read | dissolved (const + substrate-fixed + graph/dispatcher opts) |
| clock | global `clock.ts` singleton (monotonicNs/wallClockNs) | graph-local monotonic + system wall-call; no global singleton |
| messageTier | runtime registry (registerMessageType, custom types) | compile-time const table; custom types cut |
| onMessage/onSubscribe | replaceable singleton hooks | substrate-fixed, unreplaceable |
| handle | napi tsfn handle (Rust-side) | first-class pure-data `(pool_id, handle_id)` + dispatcher table |
| naming exploration | — | forward/backward considered then reverted to ctx.up/ctx.down |

---

## Design-review results (2026-05-27, Q5–Q9 lens) — ALL DR RESOLVED

design-review examined 5 load-bearing decisions (L3.C / L3-Q7+L6-Q1 / L1.1+L4-Q2-Q3 / L2.A+L1.11 / config dissolution). The foundation was judged sound; all 6 residuals settled (user: "go with the recommendations"):

| ID | Decision (LOCKED) |
|---|---|
| **DR-1** | §5.11 **amend** (do NOT wrap ctx with emit/error methods): ctx-level (`node`/`producer`) is a **protocol-facing power surface that intentionally exposes tier**; value-level (`derived`/`effect`/operator) is the §5.11-compliant primary. Rationale: the one-wave-many-tier atomicity of `ctx.down([["DATA",v],["COMPLETE"]])` (terminal-with-final-value) cannot be expressed by emit/error methods. §5.11 is amended to "protocol internals never appear in the **value-level primary** API; ctx-level is an explicit power surface". |
| **DR-2** | parity = **A+C** (behavioral conformance + a lightweight protocol IDL). L6-Q3's single `.proto` **doubles as** the wire format + the protocol-contract IDL; each language codegens the interface skeleton (a light structural guarantee, single-source not cross-diff) + behavioral conformance verifies behavior. Buys back "interface shape consistency" at zero extra cost. |
| **DR-3** | async-result-arriving-at-paused-node = **enters the pause buffer + replays on RESUME** (consistent with how PAUSE buffers DATA; lock_id scope = the node-level pause_lockset). |
| **DR-4** | graph responsibility overload (causal+concurrency+inspection+dispatcher, 4-in-1) = **do NOT introduce a separate `domain` concept yet (narrow-waist first); record the escape hatch**: if an inspection-boundary vs concurrency-boundary conflict genuinely arises, introduce `domain` (one domain holds multiple graphs; same-domain cross-graph is still single-thread but can be explicitly grouped for parallelism). |
| **DR-5** | conformance hard scenarios + the spec-amendment list (below), which must be filled in before implementation. |
| **DR-6** | dispatcher opts bag **grouped structure** `{ limits, observability, policy }`, finalized at implementation time. |

### spec-amendment list (clean-slate deviations from the existing spec — all intentional, must be explicitly amended — F-NO-IMPL-DEFINED)

- §5.10 → clock graph-local (deviates from the central `clock.ts`)
- §5.11 → ctx-level intentionally exposes tier (DR-1)
- §6.1 → Py drops per-subgraph locks
- §7.1 → node runtime versioning moves to graph/constructor opts; no global config singleton (config dissolution, D109)
- §new → ctx.up is **control-tier only** (DIRTY/PAUSE/RESUME/INVALIDATE/TEARDOWN); DATA/RESOLVED/COMPLETE/ERROR are down-only
- §new → restore ≠ fresh-lifecycle wipe (Flag 1)
- §new → async-result-at-paused-node (DR-3)

### conformance suite must-include hard scenarios (otherwise behavioral parity is a blank check)

cross-graph diamond (L2.F mixed-locality survival proof) · async-result-at-paused-node (DR-3) · INVALIDATE×ctx.state×onInvalidate · mixed sync/async diamond (PoC exists) · PAUSE lockset multi-source.

**Foundation verdict: sound.** L3.C / L3-Q7 / config dissolution / L6-Q1 all shed real historical baggage (actor model / D080-D206 / config-freeze timing). Cleared to enter the clean-slate implementation sequence.

Next step: design the clean-slate documentation system (see the session continuation below) → then `/dev-dispatch` the clean-slate implementation.

---

## Implementation Log

- 2026-06-08 TS B63 D133 first slice: added `webSocketSession` under
  `@graphrefly/ts/adapters` as a graph-visible SessionBundle with command, inbound,
  lifecycle, status, errors, and attempts nodes. `start`/`send`/`close` convenience
  helpers publish command facts only; session state is driven by the command node and
  graph-local `EnvironmentDrivers` callbacks. QA hardened the slice by requiring the
  live `LocalWebSocketDriver.connectSession` / `WebSocketSessionHandle` capability for
  same-connection outbound sends while leaving one-shot `toWebSocket` on `send`,
  suppressing late send callbacks after close, cleaning up remote closes, avoiding
  duplicate manual starts during retry waits, and treating normal code `1000` close as
  lifecycle rather than retry/error. Reconnect uses bounded `RetryPolicy` /
  `BackoffPolicy` scheduling at the adapter boundary and surfaces attempts/status/errors.
  No protocol, tier, message, ctx.up/down, or conformance behavior changed.
- 2026-06-08 TS B63 D134 first slice: added `wireBridge` under
  `@graphrefly/ts/adapters` as a transport-free, graph-visible bridge bundle with
  command, outbound envelope, inbound envelope, events, ack, nack, status, errors,
  cursor, and attempts nodes. Envelopes carry per-session monotonic seq/cursor,
  idempotency key, attempt, and request metadata; bounded ack timeout/retry reuses
  `RetryPolicy` / `BackoffPolicy` vocabulary and emits retry/exhaustion facts through
  the bundle. `start`/`send`/`ack`/`nack`/`close` helpers publish command facts only.
  `start`/`data`/`close` are ack-tracked; `ack`/`nack` are receipt envelopes and are
  not recursively ack-tracked. Remote receipt is represented only by later inbound
  envelope facts; remote failures remain DATA envelopes (`type: "error"`) on the
  bridge error node, not local protocol ERROR. QA hardened the slice by enforcing
  session-scoped inbound envelopes, finite default ack timeout, real backoff-delayed
  retransmit, late/unknown ack/nack handling, required `ackForSeq`, malformed inbound
  metadata rejection, monotonic safe seq/cursor metadata, close pending-status reset,
  remote error status projection, malformed command-fact rejection, and guarded
  inbound terminal misuse so raw protocol ERROR/COMPLETE cannot poison later inbound
  facts. No protocol, tier, message, ctx.up/down, remote dispatcher, or conformance
  behavior changed.
- 2026-06-08 TS B63 D135 first slice: added `dynamicHub`, `fromHubTopic`, and
  `toHubTopic` under `@graphrefly/ts/messaging` as a facts-dynamic,
  topology-static hub bundle. The bundle exposes fixed command, events, status,
  errors, and optional dead-letter nodes; topic keys remain DATA facts, static
  projections/command helpers create visible graph edges only, and convenience
  create/delete/publish/subscribe/close helpers publish command DATA facts
  without mutating hidden hub state. Unknown-topic behavior is explicit and
  defaults to graph-visible errors, with drop, dead-letter, and create-as-fact
  policies covered by tests. QA hardened the slice by retaining the fixed events
  reducer through graph-owned lifecycle so command facts do not collapse before
  external subscription, persisting JSON-friendly hub runtime state across
  deactivation/checkpoint, rolling back failed `toHubTopic` wiring, and adding
  explicit `maxTopics` / `maxTopicLength` bounds whose violations become
  graph-visible hub error facts. No runtime topic node creation/removal, fake
  topology event, hidden EventEmitter island, protocol, tier, message,
  ctx.up/down, or conformance behavior changed.
- 2026-06-08 TS B63 optional runtime-driver closeout: added `nodeProcessDriver` under
  `@graphrefly/ts/sources/node` as a Node-only `LocalProcessDriver` for
  `EnvironmentDrivers.withProcess(...)`. It backs driver-based `fromProcess`/`runProcess` and
  graph-visible `toProcess` bundles through `child_process.spawn`, ignores stdin for the no-input
  command shape, bounds stdout/stderr aggregation with `maxBufferBytes`, keeps process async work at
  the driver boundary, and leaves the universal sources barrel browser-safe. No protocol, tier,
  message, ctx.up/down, or conformance behavior changed.
- 2026-06-08 Rust B72 optional runtime-driver closeout: added feature-gated concrete
  `TokioHttpDriver` and `TokioWebSocketDriver` alongside the existing `TokioProcessDriver`.
  The drivers implement the existing graph-owned `LocalHttpDriver`/`LocalWebSocketDriver`
  capability traits for `EnvironmentDrivers`; HTTP uses `reqwest`, WebSocket uses
  `tokio-tungstenite` for connect streams plus one-shot outbound send. Default crate features
  stay dependency-light, async remains confined to driver callbacks, and the D132
  graph-visible adapter/message-bus/resilience API shape is unchanged. No protocol, tier,
  message, ctx.up/down, or conformance behavior changed.
- 2026-06-08 Rust B72 WorkerPool v0 slice: added feature-gated `worker_derived`
  behind `tokio-worker`. The helper runs kickoff on the graph thread, prepares an
  owned `Send` input from normal ctx dep reads, runs only that input through Tokio
  `spawn_blocking`, and returns DATA/ERROR through graph-local `DeferredCtx` as a
  fresh later wave. `Ctx`, `Node`, `Rc` graph state, erased graph values, and live
  topology do not cross the worker boundary; remote workers and broad scheduler
  controls stay deferred. No protocol, tier, message, ctx.up/down, or conformance
  behavior changed.
- 2026-06-08 Rust B72 WorkerPool v0 QA: tightened `worker_derived` so completion
  captures an explicit Tokio runtime handle, missing runtime emits graph-visible
  ERROR, worker panic joins route to ERROR, superseded completions are dropped by
  an invocation fence, and dep COMPLETE no longer terminal-seals an in-flight
  worker result. Dispatcher-owned generic WorkerPool infrastructure remains a
  B1 follow-up rather than a hidden API expansion in this slice.
- 2026-06-08 Rust B72 WorkerPool backend closeout: closed the B1/D138 follow-up by
  moving owned compute submission behind a feature-gated dispatcher-owned internal
  WorkerPool backend. `worker_derived` remains the only public helper; no
  GraphOptions/DispatcherOptions scheduler shape, public worker trait, remote
  worker, EnvironmentDrivers task mixing, protocol, or conformance change was
  added. Missing backend/runtime, stale completion, panic/error, dep terminal with
  pending result, and describe-visible topology are covered by focused tests.
- 2026-06-08 Rust B72 WorkerPool backend QA: made worker submission cold until the
  graph-local waiter starts, so compute cannot begin before the `DeferredCtx`
  completion path/cancel hook exists; moved the invocation fence to the start of
  every `worker_derived` invocation, so prepare-none or immediate ERROR waves
  suppress older in-flight completions. Added regressions for local-waiter
  scheduling failure and no-submit stale completion.
- 2026-06-08 Rust B72/D140 wire bridge foundation: added `wire_bridge` under
  `graphrefly::adapters::bridge` as a transport-free, graph-visible bridge bundle with
  command, outbound, inbound, events, acks, nacks, status, errors, cursor, and attempts
  nodes. Envelopes carry session id, ordered seq/cursor, idempotency key, attempt/max
  attempts, ack-for-seq, timestamp, and request id metadata. Command helpers publish
  command DATA facts only; outbound commands create ordered envelope facts. Inbound
  receipt is guarded so raw local protocol ERROR/COMPLETE becomes a bridge error fact
  and does not terminalize the inbound/events/status nodes; remote error/close are
  inbound DATA envelope facts, not local pending/diamond terminal settlement. Optional
  ack-timeout retry uses graph-owned `LocalAsyncDriver::sleep` and emits timeout,
  retry, exhausted, attempt, status, and error facts. No protocol, tier, message,
  ctx.up/down, remote ordinary deps, public scheduler controls, transport/auth/discovery,
  remote execution bridge helper, or conformance behavior changed.
- 2026-06-08 TS/Rust D141 wire bridge payload closeout: locked and implemented tagged
  envelope payload variants for data, error/nack, status, and close facts. TS
  `WireBridgePayload<T>` and Rust `WireBridgePayload<T>` now make control payloads
  explicit instead of casting or dropping them through the data type parameter.
  Envelope construction/inbound validation reject missing or mismatched payload kinds;
  remote ERROR/COMPLETE remain bridge DATA facts, not local protocol terminals. No
  protocol, tier, message, ctx.up/down, WorkerPool, EnvironmentDrivers, transport,
  or conformance behavior changed.

## Design Lock Log

- 2026-06-08 D141: locked wire bridge envelope payload shape as a tagged
  payload sum type/union. Data, error/nack, status, and close payloads are
  explicit bridge fact variants; ack correlation stays metadata; no `AnyValue`,
  `Ctx`, `Node`, functions, live topology, or mutable graph state crosses the bridge.
- 2026-06-08 D140: locked remote worker and cross-graph worker execution as a wire-bridge
  request/response pattern, not a Dispatcher WorkerPool backend and not an ordinary remote dep.
  Local requests and remote results are bridge facts; remote receipt starts a new graph wave, and
  any local result projection returns only as a later fresh local wave.
- 2026-06-08 D139: locked future public/custom WorkerPool scheduler API direction. The public
  graph API remains helper-first; custom scheduling is an installed dispatcher/graph-owned backend
  capability, cancellation correctness is stale-completion fencing with optional cooperative
  runtime cancellation, and remote worker execution stays on the D134 wire-bridge line.
- 2026-06-08 D138: locked WorkerPool v0 as graph-helper-first. The helper prepares
  owned worker input on the graph thread, submits only Send/static compute work to a
  dispatcher-owned WorkerPool, and returns completion through `DeferredCtx` as a later new
  wave. `Ctx`, `Node`, graph state, and original-wave pending accounting do not cross the
  worker boundary.
- 2026-06-08 D137: locked the worker/pool taxonomy. Environment task/runtime drivers stay in
  graph-owned EnvironmentDrivers and return through visible adapter/session bundles; dispatcher
  WorkerPool is the graph-internal compute lane for node functions while `dispatcher.invoke` stays
  sync void; cross-graph remote deps/functions stay on the explicit wire-bridge line.
- 2026-06-08 D133-D136: locked the next L6 application/adapter design gates without a
  spec-amend. Bidirectional transports use SessionBundle command/inbound/lifecycle/status/error
  ports; wire bridges are explicit bridge bundles with per-session ordered ack envelopes and remote
  dispatcher calls deferred as request/response facts; dynamic hubs are facts-dynamic and
  topology-static; process/saga orchestration starts from visible command/event/state/audit/effect
  facts rather than an imperative workflow engine.
