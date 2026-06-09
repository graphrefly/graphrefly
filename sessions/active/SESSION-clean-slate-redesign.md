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

- 2026-06-09 D158 locked semantic memory layering without a spec-amend.
  Passive storage memory remains under storage only. Reusable semantic memory
  vocabulary, knowledge-graph reducers, vector/retrieval/ranking patterns, and
  retention/consolidation command vocabulary may live under patterns when they
  expose ordinary graph nodes, declared deps, and graph-visible facts. Agentic
  memory, reflection loops, prompt assembly, LLM extraction/summarization, and
  harness/data-agent integrations live under solutions or adapters. No semantic
  memory surface owns storage restore/hydration, hidden schedulers,
  GraphSpec/Actor/factoryTag runtime ownership, or protocol semantics.
- 2026-06-09 D156/D157 locked the two B85/B86 closeouts without a
  spec-amend. D156 makes TS ProcessBundle effect runners visible
  outcome-command adapter bundles: they consume `process.effectRequests` plus
  explicit outcome fact nodes, project `effect.result` / `effect.failure` /
  `effect.cancel` / `effect.timeout` command facts through a declared
  `runner.commands` node, and wire that node back into `process.command` as a
  real graph edge. They do not own process state, raw async handlers, private
  retry timers/maps, hidden subscriptions, restore/hydration, or a workflow
  engine; EnvironmentDrivers/session/wireBridge helpers may feed outcomes at
  the boundary. D157 makes `remoteResponder.responseCommands -> bridge.command`
  attachment graph-owned and releasable: responder release first detaches its
  command source by rewiring `bridge.command` to the remaining attached sources,
  then releases the responder topology group through the existing quiescent
  graph-owned release path. Detach/release must be idempotent and rollback-safe
  and must not emit protocol messages, add a second topology store, use a hidden
  EventEmitter, or publish bridge commands imperatively.
- 2026-06-09 D155 locked the narrow remoteResponder/workerDerived
  implementation shape: responders consume inbound-only wireBridge request facts
  and publish responses only through a declared `responseCommands ->
  bridge/command` graph edge; remoteCall projections ignore stale/unknown
  responses unless pending and do not buffer unknown responses for future calls.
  Worker backend customization remains a graph/dispatcher-owned capability with
  owned input plus static compute only; completion goes through a helper-owned
  opaque one-shot settlement capability installed after graph-local fencing, not
  public `job.complete`/`job.error` mutation methods or a scheduler submit API.
- 2026-06-09 TS D154/D147/D148 retained product slice: locked ProcessBundle
  cursor vocabulary as `D154` and added `@graphrefly/ts` coverage that
  `process.cursor` is the process-owned command-attempt high-water position, not
  a consumer/read pagination offset; embedded status/audit/error/event/effect
  cursors remain provenance positions. Added TS `remoteCall` and
  `remoteResponder` helpers over the existing D134/D140/D141 `wireBridge` facts:
  calls send `RemoteCallRequest` DATA payloads through bridge command facts and
  expose graph-visible responses/results/status/errors/timeouts; responders
  consume guarded inbound request envelopes, invoke first-slice sync handlers,
  and route `RemoteCallResponse` DATA facts through a declared
  `responseCommands -> bridge/command` edge. Added TS `workerDerived` as the
  D148 backend-required helper: graph-thread `prepare` reads deps and returns an
  owned input, the backend receives a cold job only after completion fencing is
  installed, and stale completions are ignored. No protocol tier/message/ctx
  semantic change, conformance scenario, remote ordinary dep, same-wave RPC,
  public WorkerPool submit API, fake worker backend, hidden process state,
  storage restore/hydration, or structural parity requirement was added. The D146
  effect-runner helper remains deferred because the exact TS result/failure/
  cancel/timeout command-fact vocabulary is not yet locked beyond the broad D146
  ownership rule.
- 2026-06-09 TS/Rust D153 mount-changed topology-event slice: added
  `mount-changed` / `MountChanged` to the existing read-only topology egress and
  forwarded mounted child graph topology events through parent
  `observeTopology` / `observe_topology` using mount-aware `::` path/deps
  prefixes. The event is emitted only from the existing graph mount mutation
  point (`path=<mount path>`, `factory=mount`, `deps=[]`), and forwarded child
  events retain their kind/factory while using the parent graph topology clock.
  Forwarders are installed only while the parent has topology observers and are
  released when the last parent topology observer unsubscribes, preserving the
  D145 zero-observer cost goal. This is still read-only inspection/lifecycle
  egress: no graph node, DATA fact, protocol spec/tier/message/ctx semantic
  change, second registry, hidden EventEmitter/process manager/GraphSpec owner,
  dynamic topic node mutation, or structural parity requirement was added.
- 2026-06-09 Rust D147 remote dispatcher helper slice: added
  `remote_call` / `remote_call_with_options` and `remote_responder` /
  `remote_responder_handler` in `graphrefly-rs` on top of the existing
  D134/D140/D141 `wire_bridge` facts. `remote_call` sends
  `RemoteCallRequest` DATA payloads through the bridge command path and exposes
  graph-visible responses/results/status/errors/timeouts nodes; local timeout is
  a local status/error fact. `remote_responder` consumes guarded inbound request
  facts, invokes first-slice sync handlers, and routes `RemoteCallResponse`
  DATA facts back through a declared `responseCommands -> bridge/command` edge.
  Responders ignore non-owned operations by default so multiple responders can
  share one bridge; full-owner responders can opt into unknown-operation DATA
  error responses. Handler errors become graph-visible DATA error responses.
  `request_id` remains logical call correlation while `seq`/`cursor`/
  `ack_for_seq` remain transport metadata, and stale responses are ignored
  unless their `request_id` is still pending. QA follow-up tightened call
  projection so Status responses are non-terminal, same-batch request/response
  ordering does not drop valid results, unknown timeouts do not consume
  unrelated pending calls, and Nack/Exhausted bridge failures clear pending
  state with request correlation where available. No protocol spec, tier/message/ctx
  semantic change, conformance behavior, remote ordinary deps, distributed
  same-wave semantics, public WorkerPool submit API, hidden EventEmitter/process
  manager/GraphSpec owner, or structural parity requirement was added.
- 2026-06-09 TS/Rust D152 explicit topology/release group surface: added
  `Graph.topologyGroup()` in `@graphrefly/ts` and
  `Graph::topology_group(_opts)` in `graphrefly-rs` as graph-owned handles over
  ordinary graph-registered child nodes. Groups can create/add graph nodes and
  release them through the existing quiescent atomic graph release path; released
  ids are retired and disappear from `find`/`describe`/`profile`/`checkpoint`
  only after commit. The first concrete consumer is the graph-bound light
  reactive view delta/snapshot pair in TS and Rust data structures. Helper-local
  group membership is only a release memo; the graph registry remains the source
  of truth. No hidden second registry/EventEmitter, public `Node.dispose`,
  protocol terminal/control synthesis, dynamicHub topology mutation, unknown-key
  auto-create/delete, tier/message/ctx semantic change, spec/conformance change,
  or structural parity requirement was added.
- 2026-06-09 TS/Rust D153 node-released topology lifecycle slice: added the
  smallest D145 follow-up on top of the existing read-only topology egress in
  both `@graphrefly/ts` and `graphrefly-rs`. Successful graph-owned quiescent
  release now emits `node-released` / `NodeReleased` topology events carrying
  final known path, factory, deps, and graph-local seq after the release commits;
  released nodes disappear from `find`/`describe`/`checkpoint` only on success.
  Failed non-quiescent/downstream-dependent release emits no topology event and
  leaves the registry/checkpoint-visible topology intact for retry. Cleanup
  failures after commit do not roll back topology: committed releases emit
  `node-released` / `NodeReleased`, then rethrow/report the cleanup fault. This is still
  inspection/lifecycle egress only: no DATA facts, protocol messages,
  COMPLETE/ERROR/TEARDOWN synthesis, second node registry, hidden EventEmitter,
  process manager, GraphSpec runtime owner, release-group registry,
  `mount-changed`, mounted-child forwarding, dynamic topic topology mutation,
  tier/message/ctx semantic change, conformance change, or structural parity
  requirement was added.
- 2026-06-08 TS/Rust D151 idempotency vocabulary closeout: implemented
  B79 as contract/vocabulary alignment only across CQRS and wireBridge. CQRS
  keeps its own command/event id membership windows and graph-visible dedupe
  facts; wireBridge keeps its own ordered seq/cursor receipt state and
  ack/nack correlation facts now use `ackForSeq` / `ack_for_seq`. The
  `idempotencyKey` / `idempotency_key` bridge field remains metadata unless a
  later reviewed surface explicitly owns key-based duplicate recognition.
  Added TS/Rust tests for unchanged CQRS bounded/unbounded semantics, ordered
  bridge duplicate/out-of-order/cursor behavior, ack/nack correlation, and
  idempotencyKey not becoming an implicit key-store. No generic public
  dedupe/idempotency reducer, dynamic Node-valued CQRS policy, key-store/replay
  engine, storage-owned restore, hidden Map/EventEmitter source of truth,
  protocol/tier/message/ctx semantics, conformance change, or structural parity
  requirement was added.
- 2026-06-08 TS/Rust D145 topology-events first slice: added read-only topology
  lifecycle egress over the existing Graph registry in both `@graphrefly/ts` and
  `graphrefly-rs`. TS exposes `Graph.observeTopology(path?)`; Rust exposes
  `Graph::observe_topology()` / `observe_topology_path()`. This slice emits only
  `node-registered` / `NodeRegistered` and `deps-changed` / `DepsChanged` events
  from graph registration and successful rewire mutation points. Event deps match
  describe-visible live deps/edges, topology observation does not activate cold
  nodes, and protocol `observe()` remains separate. No spec/conformance change,
  no new tier/message/ctx semantics, no second node registry, no hidden
  EventEmitter/process manager/GraphSpec owner/factoryTag, no release groups, and
  no dynamic topic node lifecycle were added. QA hardened the egress by making
  nested topology events FIFO, isolating observer failures from committed graph
  mutations, respecting same-delivery unsubscribe, keeping Rust zero-observer
  checks O(1), and moving deps-changed emission until added-dep subscriptions are
  restored. Parent-observer forwarding of already-mounted child graph topology
  events stays deferred with the mount-changed lifecycle slice.
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
- 2026-06-08 TS B63 CQRS first slice: added `cqrs`,
  `cqrsCommandHandler`, and `cqrsProjection` under `@graphrefly/ts/cqrs`
  as a graph-visible CQRS foundation. The bundle exposes command, runtime,
  events, status, errors, audit, and cursor nodes; command convenience
  dispatch publishes command DATA facts only, and handlers run inside the
  dispatched runtime node. Event append is ordered and validates the whole
  handler result before commit, so command failures do not partially commit
  events. Projection helpers derive from declared event deps and route reducer
  throws to graph-visible projection error facts instead of protocol ERROR.
  Runtime state is JSON-friendly `ctx.state.persist(true)` for checkpoint
  capture. No `CqrsGraph` subclass, guard/policy/factoryTag/domainMeta public
  semantics, hidden EventEmitter/subscribe island, process manager,
  storage-owned restore, protocol, tier, message, ctx.up/down, or conformance
  behavior changed. Rust close ledger: CQRS is Rust-relevant and not yet
  present in `graphrefly-rs`; future CSP-10 should re-derive a Rust-native
  facts-first CQRS surface without structural symbol parity.
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
- 2026-06-08 Rust B77/D135 dynamic hub foundation: added `dynamic_hub` /
  `dynamic_hub_with_options`, fixed command/events/status/errors/optional-dead-letter
  bundle nodes, static `from_hub_topic` projections, and static `to_hub_topic`
  command helpers under `graphrefly::messaging`. Topic create/delete/publish/subscribe/close
  are DATA facts with seq/cursor/timestamp metadata; unknown-topic policy is explicit
  (drop, default graph-visible error, dead-letter, create-as-fact); helper methods
  publish command DATA facts only. Describe-visible tests cover fixed nodes and real
  source->helper->command plus events->projection/status/error/dead-letter edges. No
  runtime topic node creation/removal, hidden EventEmitter/process manager/GraphSpec owner,
  protocol, tier, message, ctx.up/down, WorkerPool, EnvironmentDrivers, or conformance
  behavior changed. QA fixed a retained-reducer edge case by adding crate-internal
  graph-owned retain for the fixed events node, so helper commands published before
  external observation are still reduced into hub facts rather than collapsing to
  the command node's latest cache. QA also routes panicking metadata clocks to
  graph-visible hub DATA error facts without committing create-as-fact topic
  mutation, and fixes `to_hub_topic` command forwarding to close over the actual
  rewired dep arity.
- 2026-06-08 TS B63 CQRS QA: fixed the auto-applicable review findings without a
  new D# or spec-amend. CQRS public fact nodes and projection nodes now use
  graph-owned retain roots so command/event/status/error/audit/cursor/projection
  facts remain graph-visible even when dispatch precedes external observation.
  Projection reducers now commit and emit each successful event prefix before a
  later event in the same batch can throw. Handler/reducer catches rethrow
  GraphReFly protocol/runtime invariant errors such as R-reentrancy/R-rewire
  instead of downgrading them into CQRS application DATA errors. Valid command ids
  are consumed on first processing after parse, so retrying a failed valid command
  id becomes duplicate-command rather than rerunning the handler. The long-lived
  dedupe retention/index policy remains a future design-review/backlog question;
  this QA did not lock public retention/window semantics.
- 2026-06-08 TS/Rust D142 CQRS dedupe implementation: locked and landed static
  bounded command/event id dedupe windows with exact/unbounded default. TS
  `@graphrefly/ts/cqrs` now exposes `CqrsDedupePolicy` / `CqrsDedupeWindow`;
  bounded cursor facts expose retained/evicted id counts and evicted ids are no
  longer duplicate-recognized. Rust `graphrefly-rs` now has a Rust-native `cqrs`
  module and crate exports for `cqrs`, `cqrs_with_options`,
  `cqrs_command_handler`, `cqrs_projection`, graph-visible command/runtime/events/
  status/errors/audit/cursor/projection nodes, and matching D142 dedupe policy.
  Rust CQRS runtime state is stored as JSON `ctx.state` for checkpoint-friendly
  dedupe counters/windows. Dynamic Node-valued policies and generic dedupe
  engines remain deferred. No protocol, tier, message, ctx.up/down, terminal,
  storage-owned restore, or conformance behavior changed.
- 2026-06-08 TS/Rust CQRS QA hardening: timestamp provider failures now become
  graph-visible CQRS `clock-threw`/`ClockThrew` error/status/audit facts without
  committing events; Rust rejects empty command id/type as `MalformedCommand`
  before dedupe insertion; TS and Rust CQRS catch boundaries rethrow D22 /
  R-graph-domain violations instead of downgrading them into handler/projection
  facts. No protocol, restore, storage, tier, message, or ctx.up/down semantics
  changed.
- 2026-06-08 D149/D150 CQRS design-review closeout: locked CQRS bundle/projection
  lifecycle as retain-root release only, and locked CQRS checkpoint/export honesty.
  CQRS release/dispose may only release helper-owned graph retain roots; it must
  not delete topology, synthesize protocol terminal/control messages, clear
  caches/state/facts, cancel external subscriptions, or become a permission
  system. CQRS only promises its internal cursor/dedupe runtime state is
  graph-owned and JSON/checkpoint-friendly; arbitrary command/event/projection
  payloads remain ordinary graph values under the graph checkpoint contract.
  Durable CQRS export remains a passive fact sink/projection or future reviewed
  codec/helper, not CQRS-owned storage restore/hydration.
- 2026-06-08 D151/B79 idempotency vocabulary closeout: approved the shared
  vocabulary/contract option across CQRS dedupe and wireBridge idempotency.
  No public generic dedupe/idempotency reducer engine is added. CQRS id windows
  remain membership-based duplicate recognition; wireBridge receipt remains
  ordered seq/cursor with ack/nack correlation by `ackForSeq`; `idempotencyKey`
  is correlation/idempotency metadata unless a surface explicitly owns key-based
  recognition. Future public reducer bundles, dynamic Node-valued policies, or
  key-store/replay engines require another design review and must expose
  accepted/duplicate/error/cursor/status as ordinary graph facts.
- 2026-06-09 D152 dynamic topology node lifecycle: approved explicit
  graph-owned topology/release groups as the only path for dynamic topic/view/
  router surfaces to create or release real graph nodes. Unknown data keys,
  publish commands, rule updates, and hub facts must not silently mutate graph
  topology. Helper-local maps may memoize/look up child groups, but the existing
  graph registry remains the sole source of truth. Release is D122/D124-style:
  quiescent-only, atomic, ids retired, no protocol terminal/control synthesis.
  D135 facts-dynamic/topology-static hubs remain the default dynamic messaging
  shape; true node lifecycle is opt-in and layered on D145 topology events.
- 2026-06-09 TS B63 passive messaging vocabulary slice: rehomed the old root
  `src/utils/messaging/message.ts` data-only contract into `@graphrefly/ts/messaging`.
  The clean-slate subpath now exports `JsonSchema`, `TopicMessage`, the seven
  well-known topic constants, `STANDARD_TOPICS`, and `StandardTopic`. This is
  passive D125/D132 application-infrastructure vocabulary only: no
  `TopicGraph`/subscription/messagingHub class port, no old GraphSpec/factoryTag/
  Actor owner, no hidden EventEmitter, no topology lifecycle, no protocol or
  conformance change, and no `utils`/`base`/`compat`/`presets` barrel resurrection.
- 2026-06-09 TS B64 examples migration batch 1: migrated
  `examples/compat/{zustand,jotai,nanostores}` and
  `examples/framework/{react,vue,solid,svelte}` to consume only `@graphrefly/ts`
  and `@graphrefly/ts/adapters`. Compat examples now wrap caller-owned graph
  nodes with `zustandStore`, `jotaiAtom`, and `nanoAtom`; framework examples use
  tiny example-local React/Vue/Solid hook glue or the Svelte readable/writable
  store adapters. No package API, `@graphrefly/ts/compat/*` subpath, framework
  hook export, old Graph-owned Zustand `create`, Jotai `atom(read)`, Nanostores
  `computed`, protocol, storage restore, or dynamic topology behavior was added.
  Follow-up B64 slices can migrate spending-alerts and NestJS/order-flow against
  existing public surfaces; AI/harness/refine-loop/inbox-reducer, memory
  knowledgeGraph, and reactive-layout/fromRaf remain deferred/design-gated.
- 2026-06-09 B64/B65 direction update: pause further examples migration until
  retained functionality surfaces settle. Examples are later acceptance/cleanup,
  not drivers for new public API or old-root preservation. Root
  `@graphrefly/graphrefly` should be deprecated directly once retained surface
  migration and the known memo:Re consumer path allow it; do not invest in a
  long-lived transition shell just to preserve pre-1.0 compatibility.
- 2026-06-09 Rust B84 D136 ProcessBundle first slice: added `graphrefly-rs`
  `process::ProcessBundle` as a Rust-native facts-plus-reducer bundle with
  graph-visible command, state, events, audit, effect_request, status, error,
  and cursor nodes. Reducers run inside the graph-owned runtime node; state is
  emitted as a visible fact; Rust `TState` is serde JSON-roundtripped for the
  runtime ledger so reducer state is checkpoint-friendly and not shared by
  shallow `Clone` aliasing. Convenience dispatch only publishes ordinary command
  DATA facts. `process.cursor` is D154 process-owned high-water after a command
  attempt closes, not a consumer/read cursor. No process/saga DSL, effect
  runner, hidden processManager/EventEmitter, private timers/maps, hidden
  subscriptions, storage restore/hydration, protocol change, remote ordinary
  dep, or structural TS parity was added.
  QA hardening rejects malformed persisted runtime ledger fields rather than
  normalizing them into cursor/dedupe rewind.
- 2026-06-09 Rust B84 D156 ProcessEffectRunner closeout: added
  `graphrefly-rs` `process_effect_runner` / `ProcessEffectRunnerBundle` as a
  Rust-native visible outcome-command adapter over `ProcessBundle`. The runner
  mirrors `process.effect_request` into requests, consumes explicit outcome fact
  nodes, projects `effect.result` / `effect.failure` / `effect.cancel` /
  `effect.timeout` command facts, and wires `runner.commands` into
  `process.command` through declared command-source fan-in. Release is
  idempotent and rollback-safe: it preflights helper topology quiescence,
  detaches before graph-owned release, releases the private runtime plus visible
  helper nodes, and does not replay cached commands if release is retried after
  a live-subscriber failure. Tests cover result reducer delivery, visible
  edges, malformed/contradictory outcome DATA errors/status, counters, all four
  command payloads, multiple runner fan-in, idempotent release, retry/no-replay,
  and post-release topology cleanup. No process/saga DSL, async handler runtime,
  private in-flight authority maps/timers, EnvironmentDriver/session/wireBridge
  integration, hidden subscriptions/EventEmitter/processManager, storage
  restore/hydration, protocol tier/message/ctx change, remote ordinary dep, or
  structural TS parity was added. B84 is resolved.

## Design Lock Log

- 2026-06-09 D153: closed D145-D148 follow-up API polish without a
  spec-amend. Mount/release topology lifecycle may add `node-released` and
  `mount-changed` read-only topology events plus optional quiescent
  release/topology group handles over already registered node ids; release
  commits atomically before nodes disappear from describe/find/profile/checkpoint,
  and mounted-child forwarding belongs to the mount-changed slice. Process
  orchestration proceeds bundle-first: implement D136 ProcessBundle before DSLs,
  then keep DSLs as compilers and effect runners as visible fact adapters.
  Remote dispatcher helpers proceed as `remoteCall` + `remoteResponder` over
  wireBridge facts: operation names are application facts, `requestId` is logical
  call correlation, bridge `seq`/`cursor`/`ackForSeq` remain transport metadata,
  timeout is local status/error unless explicit cancel is sent, and first-slice
  handlers are sync graph-dispatched functions. WorkerPool customization remains
  helper-first via graph/dispatcher-owned backend capabilities selected by helper
  or construction options; no public imperative submit API is added.
- 2026-06-08 D145-D148: locked the next topology/process/remote-worker
  design gates without a spec-amend. D145 keeps topology events as read-only
  graph lifecycle egress over the existing graph registry; optional
  release/topology groups are labels/handles over already registered nodes, not
  a second registry, and release remains quiescent-only. D146 makes process/saga
  DSLs authoring layers that compile to D136 ProcessBundles, while effect
  runners consume effect-request facts and publish visible result/failure facts
  without owning state, timers, or restore. D147 makes remote dispatcher helpers
  wire-bridge request/response facts with local/remote waves separated by the
  bridge boundary. D148 keeps public WorkerPool customization helper-first via
  graph/dispatcher-owned backend capabilities, not imperative submit APIs.
- 2026-06-08 D142: locked CQRS command/event id dedupe as application-infra
  policy shared by TS and Rust. Default is exact/unbounded. Static bounded
  command/event windows may be configured independently; eviction is insertion
  order, and evicted ids are no longer duplicate-recognized. Dedupe state remains
  graph-owned, JSON/checkpoint friendly, and visible through CQRS cursor/status
  facts where supported. Dynamic Node-valued policy and generic public dedupe
  engines stay deferred.
- 2026-06-08 D149: locked CQRS bundle/projection lifecycle as application-infra
  retain-root release only. TS/Rust may expose runtime-idiomatic release/Drop
  surfaces, but release does not own graph topology, protocol terminal/control
  messages, cache/state clearing, external subscriptions, process cancellation,
  or command/query permission.
- 2026-06-08 D150: locked CQRS checkpoint/export honesty. CQRS internal
  cursor/dedupe runtime state is graph-owned and JSON/checkpoint-friendly; CQRS
  public payload facts remain ordinary graph values, and durable export stays
  passive or separately reviewed.
- 2026-06-08 D151: locked idempotency/dedupe sharing as vocabulary/contract
  only, not a public generic engine. CQRS owns membership-window dedupe,
  wireBridge owns ordered seq/cursor receipt and `ackForSeq` correlation, and
  any future shared reducer/key-store must be separately reviewed with graph-
  visible facts and declared deps.
- 2026-06-09 D152: locked true dynamic topic/view/router node lifecycle behind
  explicit graph-owned topology/release groups. Unknown data keys or hub facts
  cannot create/delete nodes; child node groups are ordinary graph-registered
  topology, helper maps are non-authoritative memo indexes, and release keeps
  D122/D124 quiescent-only atomic disappearance with no protocol message synthesis.
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
