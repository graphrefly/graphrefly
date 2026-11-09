# 协议面的内核与模块分类

DS-17，用户于 2026-11-05 开启。对应工作项：[graphrefly:B141](../../plan/backlog.jsonl)。
状态：**分类已定。** 用户 2026-11-05 至 11-09 逐项审阅，O1–O15 全部决定（O10 另作单独决定），每条规则的去向见用户
2026-11-09 接受的 [B140 修订提案](PROPOSAL-B140-kernel-rule-revision.md)。B141 同日结项。非规范性文档：不激活、不修订、
不退役任何规则，不改动任何 formal 模型或 conformance 场景，也不授权任何实现。
[graphrefly:B140](../../plan/backlog.jsonl) 已按提案在原处修订，2026-11-09 从暂缓改为 planned。

## 为什么要做

D796 的 50 条草案规则平均每条约 700 字符，大多数都会提到好几个其他特性：整套规则里，"terminal" 出现
38 次，"pause" 28 次，"batch" 27 次，"PULL" 21 次。每往所有节点上加一个特性，就得写清它和其他每个
特性怎么交互。D49 已经示范过一次出路：它把值相等判断从内核挪到可选算子，RESOLVED 从此只剩一个清楚的
含义。本 session 对每个特性做同样的检验：

> 这个特性能不能做成图里的一个节点或算子，而不是每个节点的一个选项或行为？
> 如果不能，最小的*通用*内核钩子是什么，才能让它变成节点？

输入材料：[spec/rules.jsonl](../../spec/rules.jsonl) 里的 D796 草案行；TS 基线里的 `NodeOptions`
（`graphrefly-ts` 的 `packages/ts/src/node/types.ts`，HEAD `dafc5ae`）；
[B139 旗舰简报](../archive/SESSION-b139-causal-flagship-brief-v1.md)；D49；D790/D791；DS-15/DS-16。
以下内容都没有执行验证，只是对这些来源的阅读和判断。

## 原则

每个内核子句都应当能从下面某一条推出来。推不出来的子句就是特例：要么删掉，要么移到模块，要么论证它
值得成为一条新原则。

| # | Principle |
|---|---|
| P1 | A node has a fixed, ordered list of declared dependencies inside one single-threaded graph. Topology is data that can be described. |
| P2 | Every DATA is an occurrence. The kernel delivers every DATA a node emits to each subscriber unchanged and in order, and never merges, drops, reorders or replaces DATA on a node's behalf. Transforming, filtering and combining (map, filter, zip, merge) are what a node's own function does. (D49) |
| P3 | DIRTY means "this may change in this wave". Only a source about to emit DATA, or a node one of whose dependencies announced DIRTY, announces it. Each announced DIRTY is settled exactly once, by DATA or RESOLVED. A node runs at most once per wave, after every dependency that announced DIRTY has settled. |
| P4 | A node's output is only what its function emits, plus the one RESOLVED the kernel adds to settle a DIRTY it announced and left unanswered. |
| P5 | COMPLETE and ERROR end a node's output for good. Nothing follows them. (Reference kernel, user's decision 2026-11-08: an ended node can still be subscribed, depended on and added by rewire or replace; its START snapshot carries its terminal, and it never runs again. TS refuses these, R-terminal R2.2.7.b.) |
| P6 | Lifetimes nest. A node is active while something needs it; activation acquires dependencies, deactivation releases them, and every ctx and cleanup belongs to exactly one lifetime. |
| P7 | Delivery inside a graph has one total order. Requests made while a wave is being delivered wait until it finishes. A running function is never reentered. |
| P8 | The kernel does nothing on its own: no retry, deduplication, buffering, timing, demand or persistence. Each of those is a node. |
| P9 | Work that finishes later enters as a new wave from where it started. The kernel does not pair results across waves. |
| P10 | A function's throw becomes that node's ERROR. Any other failure goes to its caller or the host reporter, never into an unrelated node's messages. |
| P11 | Control is data on a declared edge. A controller changes a plain state that its target declares as a dependency; the kernel carries it like any DATA, so ordering (P7), batch, diamonds and lifetimes need no extra rule for control. No control message travels up the graph at run time. Added 2026-11-06 with the user, after pause and demand were built this way without a kernel change; the reason is that each control type sharing one upward channel would need rules against every other feature and every other control type. |

## 内核

下表 31 条内核规则合并成 11 个概念。草案规则是按讨论的历史拆分的，不是按概念拆分的；合并之后，整个
内核一次就能读完。第三列列出的子句，只是因为某个模块目前长在每个节点里才存在；模块移出去，它们也跟着
移出去。

| Concern | D796 rows | Clauses that leave with a module |
|---|---|---|
| K1 Messages and tiers | R-msg-format, R-tier | PAUSE/RESUME/PULL meaning moves to their modules (see open decision O2) |
| K2 Wave and settlement | R-wave-boundary, R-dirty-before-data, R-two-phase, R-diamond, R-resolved-undirty, R-terminal-settles-dirty, R-same-wave-merge, R-undirty-settle-timing, R-output-ownership | The node-local publication FIFO and cursor (resumeAll); obsolete-compensation discard when publication is delayed (pause hold); batch rollback compensation and staging rejection are gone, because batch delivers nothing before commit (O3). The mixed-time caveat in R-diamond stays: it is P9. |
| K3 Subscription and initial snapshot | R-push-subscribe, R-subscription-ownership, R-initial | Replay history in the START array and quiet START-only subscription move behind hook H2; "initial does not start a source while default PAUSE gates it" leaves with pause |
| K4 Invocation and ctx | R-fn-contract, R-ctx-wave-data, R-ctx-state, R-reentrancy | ctx.pull (demand module); persist retention and checkpoint capture (hook H4) |
| K5 Terminals | R-terminal, R-deps-terminal | Resubscribable fresh execution, pause locks surviving reset, resumeAll discard, rewire before retirement. The 3×3 complete/error policy can shrink to auto or manual per kind (O6). |
| K6 Invalidation | R-invalidate-idempotent | The resumeAll acceptance/publication split; paused INVALIDATE supersession (pause module) |
| K7 Lifetime and cleanup | R-ctx-lifetime, R-cleanup-hooks, R-rom-ram | resumeAll's silent adoption of a state value on close; checkpoint restore wording (hook H4) |
| K8 Out-of-wave request order | R-observer-boundary | Topology-request queueing leaves with surgical rewire (O4) |
| K9 Upstream control routing | R-ctx-up, R-up-at-source, R-up-routing | PULL consumption, RESUME lock release and PAUSE acquisition become what the matching module node does; frozen broadcast lists exist mainly because topology can change mid-delivery (O4). 2026-11-08 (user): upward INVALIDATE (R-up-at-source) decided away; TS's production code never sends it. **2026-11-09 (user): K9 decided away as a whole, with R-ctx-up, R-up-routing and R-up-routing-diamond.** TS's production code sends only PULL upward (`ctx.upNext`), and pause, demand and restart all run on declared control pairs (P11), so the kernel has no `ctx.up` |
| K10 Node interface and status | R-node-iface, R-status-enum | Output execution stays as the middle level of node ⊇ execution ⊇ lifetime (O7); the per-rule wording about old requests collapses into "a request dies with the innermost scope it was made in" |
| K11 Failure routing | R-operation-failure | — |

R-async-paused 里有一句与 pause 无关的话留在内核：一个稍后才完成的 raw 函数，最终必须自己发出 DATA、
RESOLVED 或终止消息；内核不会替它推断"已完成"（P4、P9）。

**身份种类的数量。** 目前一个节点至少有六种身份：lifetime、output execution、notification interval、
connection、callback registration、pause lock，另外还有 "stable manual-input intent"。把 pause 和 surgical
rewire 变成模块之后，内核保留三层嵌套加一个内部计数：

- **节点**：在拓扑里的稳定身份，describe 和观察都挂在它上面；
- **execution**：被终止消息结束，resubscribable 时可以开始新的一段。如果 O7 选"owner 节点重启"，这一层
  离开内核，协议终止就是永久的，嵌套只剩节点 ⊇ lifetime；
- **lifetime**：被"最后一个订阅者离开"结束；一个 execution 可以跨多个 lifetime（例如 state 断开后再连）；
- 内部的 notification interval。

callback registration 属于 lifetime。原来分散在各条规则里的"旧请求不能漏进新 execution / 新 lifetime"，
可以收成一句：**请求属于它发出时所在的最内层范围，范围结束它就作废。** connection 在每个节点实例里固定
不变，lock 身份归 pause 模块所有。

## 模块

| Module | D796 rows | How it becomes a node | Needs |
|---|---|---|---|
| Pause, resumeAll | R-pause-lockset, R-pause-modes, R-async-paused (pause clauses), R-paused-invalidate | Pausable valve or gate nodes are placed in the graph in advance. Each one is controlled by a declared controller (for example a resumable node), either through keyed ctx.up messages or through a declared control pair (O8). The valve holds DATA in its own FIFO (resumeAll) or keeps only the latest input (default), passes terminals, and releases on the final RESUME. Precedent: callbag-recharge `pipe(source, pausable())`, where `pause()` returns a lock id and `resume(lockId)` emits the latest value. | H1, or a declared control pair. A source that must actually stop working handles pause itself (O8). |
| Quiet release | the "quiet outside service" part of R-pull | A node that consumes its input wave without forwarding DIRTY and publishes a release in a new wave. | Hook H6. **The flagship needs this** (D790's "pull-quiet release" lifecycle port). |
| Demand (PULL) | R-pull (demand parts), R-up-routing-diamond | A holder node that reacts to PULL arriving on the upstream channel, keeps only the latest unserved demand, and serves it as an ordinary invocation. | K9 for routing, H6 for quietness, H2 for START-only subscription. Built 2026-11-06 on a declared control pair with none of these; K9 decided away 2026-11-09 |
| Replay | R-replay-buffer | A history node that keeps the last N published DATA and supplies them to new subscribers. | Hook H2. 2026-11-08 (user): no hook and no kernel option. The START snapshot carries the node's last array (K3); history across waves is `reference/modules/history.mjs`, a node whose value is the list |
| Checkpoint and restore | R-restore, R-snapshot, R-input-receipts, R-resource-reattach | Graph-level save and rebuild: construct nodes from recipes and seed them. | Hook H4. Scope is open decision O5. |
| Revision evidence | R-node-revision | An observer that counts committed outputs per node, plus the optional hash. | Hook H5 (already exists as observe/inspection). D791 flagship revisions are DATA-level, not node revisions. |
| Rewire | R-rewire, R-rewire-deferred, R-rewire-deferred-committed-boundary, R-rewire-async-live-edge, R-rewire-batch-boundary | Graph-level "replace node": tear the old instance down, build a new one with new dependencies, seed its cache. | Hook H4. Whether in-flight records must survive a rewire is O4. 2026-11-08: the reference kernel's `replace` is a kernel request (it rebinds dependents); the seed is added when a case first needs it (user, after the C-8 replay). Same day, after mergeMap on replace: the user asked for surgical `rewire(id, deps, fn)` as a kernel request too; it keeps the instance and runs between waves (K8). No case needs the seed |
| Value sugar policies | R-first-run-gate, R-dynamic-node | "Wait until every dependency has a value" and "read only some dependencies" are checks inside the sugar's function, not kernel gates. 2026-11-08 (user): the reference `derived` checks on every run, not only before the first (TS and R-first-run-gate check only the first) | Nothing |

## NodeOptions

| Field | Class | Note |
|---|---|---|
| `initial` | Kernel (K3) | Seeds the retained value |
| `partial` | Sugar | First-run completeness is a sugar policy |
| `terminalAsRealInput`, `completeWhenDepsComplete`, `errorWhenDepsError` | Kernel (K5), simplified | Three booleans become auto or manual per kind; ignore is manual with no action (O6) |
| `resubscribable` | Removed (O7, resolved 2026-11-08) | Restart is the owner module, which replaces an inner node; no kernel execution restart |
| `resetOnTeardown` | Kernel (K7), candidate to remove | One rule should say what each node kind keeps on deactivation. 2026-11-09 (user): removed with TEARDOWN |
| `pausable` | Module | Valve or gate node |
| `pullId` | Module | Demand holder |
| `replayBuffer` | Module | History node, hook H2 |
| `versioning` | Module | Observer, hook H5 |
| `dynamic` | Sugar | |
| `pool`, `dispatcher` | Binding | The dispatcher is a sacred L0.7 constraint, but the pool is an implementation choice, not a protocol rule |
| `name`, `factory` | Graph layer | Inspection metadata |

## 通用钩子

| Hook | What it is | Used by | Conflict |
|---|---|---|---|
| H1 | Control reaches its target in one of two declared ways: (1) a keyed upward message along declared connections, handled by the node that declares the key and forwarded by the others; (2) a declared control pair, where the controller calls its target outside the message channel. Either way the relation is declared, so describe can draw it as a control edge. | Pause, demand, restart | (2) is the user's 2026-11-05 relaxation (O8). 2026-11-09 (user): (1) dropped with K9; all three use (2) |
| H2 | Subscription snapshot provider: what a new subscriber gets in its START array (default: the retained value) | Replay, demand | **L2-Q15** makes onSubscribe non-replaceable (O1) |
| H3 | Invocation gate: defer a node's function call while keeping its latest input | Default pause on sources | Only if O8 keeps it |
| H4 | Construction-time seed: retained value, private state and first-call history | Checkpoint, rewire, persist | Must stay quiescent-only unless O5 says otherwise. Implemented 2026-11-08 in the reference kernel as an optional `node(..., { seed })` (value, terminal, private state; no first-call history, since there is no first-run gate); its first version also had a P5 exception for a seeded node's first activation, gone when the user relaxed P5 the same day. Only checkpoint needed it; rewire did not (surgical `rewire` instead) |
| H5 | Committed-output observation | Revision, evidence, replay | Exists (observe/inspection). 2026-11-07: the reference kernel needs no hook for it; an ordinary subscriber receives what a node committed, and `reference/modules/observe.mjs` wraps it like TS `Graph.observe` |
| H6 | Quiet boundary: consume an input wave without forwarding DIRTY; publish later as a new wave | Flagship lifecycle port, demand | Today folded into R-pull; separating it is new wording, not new behavior |

## 消息类别

类别一共七个，就是现在的七个 tier。之前说"控制 → DIRTY → 值 → INVALIDATE → 终止"时漏掉了首尾的 START 和
TEARDOWN。每个类别的内核行为如下；行为来自 R-tier@1 的"tier < 3 立即派发，tier ≥ 3 在 batch 里延后"，以及
各条 settlement 规则。模块消息只能加入一个已有类别，继承它的全部内核行为。

| Class | Built-in types | Kernel behavior | Module types that join it |
|---|---|---|---|
| 0 handshake | START | Only at the head of a subscription's initialization array | None expected |
| 1 control | PAUSE, RESUME, PULL | Dispatched immediately, not deferred by batch; neither opens nor settles a DIRTY; travels upward along declared connections (or between a declared control pair); a non-handling node forwards it, a source drops it | PAUSE(key, lock), RESUME(key, lock), PULL(key, params), and the restart request of O7 all belong here. 2026-11-09: with K9 decided away none of them is a kernel message; each is a write to a declared control state |
| 2 notification | DIRTY | Dispatched immediately; opens one dirty membership per connection | None: a new notification kind would be a new class |
| 3 value | DATA, RESOLVED | Deferred inside batch; settles a membership; DATA is an occurrence | None |
| 4 invalidation | INVALIDATE | Deferred inside batch; removes the retained value; settles a membership | None |
| 5 terminal | COMPLETE, ERROR | Deferred; settles a membership; ends output for good | None |
| 6 teardown | TEARDOWN | Last; ends the lifetime | None. 2026-11-09 (user): decided away; the last unsubscribe ends a lifetime |

所以 PAUSE、RESUME、PULL 都在类别 1，区别只在"谁处理、处理时做什么"，这些属于模块：pausable 节点处理
PAUSE/RESUME，holder 处理 PULL，处理之后 holder 的结果是一个新 wave 里的类别 3 消息（经过 H6 安静边界）。
如果 pause 改用声明过的控制对（O8），PAUSE/RESUME 甚至不必作为消息出现，只作为可观察的状态变化出现。
实际上能加入的只有类别 1；其余类别都直接参与 settlement，新增成员就等于改协议。

用户 2026-11-06 同意了 2026-11-05 关于 tier 只选类别、owner 节点重启、声明控制对的三条回复。

## 旗舰需要什么

根据 B139 简报和 D790/D791：需要 K1–K8、K10、K11，用于保留证据的钩子 H5，以及用于安静生命周期端口的
钩子 H6。旗舰的 occurrence 身份、revision domain、currentness、按 key 汇合、业务终态和 effect 结果，
全部是带类型的 DATA（D791 写明不改协议），所以它们依赖 P2，但不需要新的内核规则。2026-11-07 已在参考内核上用 S1–S8 验证，见下一步第 2 条。旗舰不需要 pause、
resumeAll、demand 服务、replay buffer、checkpoint 或 restore（崩溃恢复不在它的范围内）、surgical
rewire、resubscription 和 dynamic 节点。简报也不要求 batch；batch 仍留在内核，是因为 UI 那类"多次写入
保持一致"的场景依赖它。

## 需要用户决定的问题

| # | Question | Default suggested here |
|---|---|---|
| O1 | Allow a spec-defined snapshot hook (H2) despite L2-Q15? | Resolved (user, 2026-11-08): the suggested default. Yes, declarative only: it returns DATA to put in START, no message handling |
| O2 | How do PAUSE/RESUME/PULL leave the kernel? User direction 2026-11-05: control goes through the message channel or through a declared control pair (O8); undeclared imperative control is not allowed. Option (b): modules declare message types that join an existing tier class and inherit its kernel behavior (direction, settlement, batch and terminal handling), plus a few spec-defined attributes (what a non-handling node does, whether it notifies downstream, wire crossing). Within a class, built-in types already sort by submission order (DATA and RESOLVED never share an array; PAUSE, RESUME and PULL keep their order), so module types need no sub-order. A type that needs a position between classes, or behavior no class has, is a new class and therefore a protocol amendment. This narrows L2-Q14 rather than reopening it. | (b), class only, no sub-order until a real case needs one. Narrowed 2026-11-06: pause (O8) and demand both use declared control pairs, decided by the user, so none of PAUSE/RESUME/PULL is a kernel message; only the O7 restart request may still need an upward channel. 2026-11-09: restart uses the control state `${id}.restart`, so no upward channel is left and K9 is decided away |
| O3 | Keep batch rollback (L2.E)? **Decided by the user 2026-11-06:** batch delivers no DIRTY before commit. The body only records host inputs; commit announces DIRTY to the whole cone, then publishes. The kernel may mark pending nodes internally during the body (R-two-phase@2 already separates internal notification from delivery), so a read can report pending. A throwing or asynchronous body commits nothing, so rollback stays and has nothing to undo: no compensating RESOLVED, no staging rejection. When the draft rules are revisited, drop "Batch may announce DIRTY before its later commit" from R-two-phase@2 and recheck R-rewire-batch-boundary. Rechecked 2026-11-08 against the reference kernel (C-22, REPLAY.md): a topology request made in a body (subscribe, unsubscribe, replace, rewire) also waits for the commit, so the body changes nothing before it; the rule's "only when the node has uncommitted batch output" condition is not needed. | Resolved: no DIRTY before commit |
| O4 | Is surgical rewire (surviving in-flight records) needed, or is graph-level replace enough? | Resolved (user, 2026-11-08): the suggested default. Replace is enough for the first kernel. Revised the same day by the user: surgical `rewire` added too, after mergeMap on replace showed its costs; it only runs between waves, so in-flight records never have to survive it |
| O5 | When can a running graph be captured? Fully idle moments may never come, but every wave boundary is settled (single thread, synchronous waves, no batch open). Capture there: retained values, private state, and pending async work as data. Once pause, demand and replay are nodes, their buffers are ordinary private state. Native resources reattach through factories; an external call that was in flight is re-issued or recorded as unknown, never resumed. | Resolved (user, 2026-11-08): the suggested default. Wave-boundary capture; no kernel-level pending-FIFO or receipt capture |
| O6 | Terminal policy: auto or manual for each of COMPLETE and ERROR (2×2) instead of 3×3? Auto: complete when all deps complete, propagate ERROR. Manual: the terminal is function input and the node ends only when its function says so. TS option sites (line-window count at `dafc5ae`, tests excluded): 275 ignore/ignore (long-lived hubs in adapters, cqrs, solutions), 43 input, 4 manual COMPLETE with auto ERROR (including `causalOccurrenceAuthority`), the rest the default. | Resolved (user, 2026-11-08): the suggested default. 2×2; ignore is manual with no action |
| O7 | How does restart work without the flaws of today's `repeat` (downstream observation stops at the wrapper; a downstream cannot recover an upstream that already sent a terminal)? Kernel option: a terminal ends the current execution and resubscribable starts a new one under the same identity. Module option, which the user prefers if it avoids those flaws: one restartable owner node faces downstream permanently and never forwards a protocol terminal while it may still restart; whatever may terminate and be restarted lives inside it as owned inner nodes, registered at a stable path under the owner so describe and observe(path) continue across attempts (describe already discovers inners under synthetic ids, D51). Inner nodes subscribe to long-lived upstream nodes outside the owner with ordinary subscriptions, so nothing upstream needs to be resubscribable. Recoverable endings are typed DATA (D184 DataResult/DataIssue), as D790 already requires for long-lived hubs; protocol COMPLETE/ERROR stay final. Retry is the owner's policy (attempts, backoff), and a restart request reaches the owner by H1. | Resolved (user, 2026-11-08): the suggested default. Module option. Built 2026-11-08 in reference/modules/restart.mjs on a new kernel `replace`; every current TS use fits (no production `resubscribable: true`; `repeat` only in its tests; retry is done by drivers) |
| O8 | Pausable nodes are designed in advance, and pause must be directed: with pausable1/2/3 in the graph, a controller reaches pausable2 alone. User direction 2026-11-05: a declared control pair (resumable to pausable) may be controlled outside the message channel, because the original objection to imperative control was that observers could not see the topology, and a declared pair can be drawn as a control edge. Conditions to keep it visible and ordered: the pair is declared at construction; a call made during a wave applies at the wave boundary (P7), like observer-origin requests; every pause state change is observable through inspection. A source that must stop working handles pause itself and starts or stops in its own function. Is hook H3 then unnecessary, and can keyed ctx.up for pause be dropped in favor of pairs? | No H3; pairs for pause, keyed ctx.up kept only where a pair is impractical. 2026-11-09: no such case was found, and keyed ctx.up went with K9 |
| O9 | Revision/valueRevision as kernel evidence or as an observer module? Checkpoint needs them only for partial restore; a whole-graph restore from a wave-boundary capture (O5) needs no comparison, and a live external source is compared by its own DATA-level version (as in D791). The checkpoint module can install the observer at graph creation. | Resolved (user, 2026-11-08): the suggested default. Observer module |
| O10 | Saying "not required for the first kernel" conflicts with L0.5 and F-NO-WEDGE-CUT. Revisit them? | Resolved (user, 2026-11-08): the suggested default. Yes, as a separate decision |
| O11 | May a node send DIRTY itself, alone, and settle it later? Found in the C-28/C-29 replay. **Decided by the user 2026-11-06:** no. DIRTY is sent by the kernel only, as the prefix of a value array; node output containing DIRTY is rejected. The original reason for standalone DIRTY (announce once, compute or wait, then send DATA without repeated DIRTY) is covered by batch, and async results already get their DIRTY from the DATA they carry. The interval between DIRTY and its settlement should be as short as possible. Kernel developers may change this later. Consequences when the draft is revisited: C-29 is retired; the C-28 per-prefix clauses lose their standalone case; R-dirty-before-data@2 drops "including after an earlier standalone DIRTY"; R-resolved-undirty@2 drops the deferred-result author's settlement duty; R-output-ownership@1 keeps only its non-notification parts; R-undirty-settle-timing@2 leaves the kernel and is rechecked for the pause module, where resumeAll can hold a balancing RESOLVED. | Resolved: kernel-only DIRTY |
| O12 | Reject a public batch opened from an observer, initialization or lifecycle callback before its body runs (C-28)? Found in the replay. **Decided by the user 2026-11-06:** no special clause. Such a batch stages its writes and commits later as one wave, like any other request made during a wave (K8); with no DIRTY before commit there is nothing for it to disturb. | Resolved: allowed, no extra rule |
| O13 | Does the kernel reorder one array by tier (R-tier@1/@2 "ordinary live output is stably normalized by tier"; TS sorts every `_down`)? Found while making resumeAll keep array boundaries: `[1, INV, 2, 3]` became `[1, 2, 3, INV]` and the author's final value 3 became absent. **Decided by the user 2026-11-06:** no tier sort. Messages keep their written order; a terminal must be last; DATA and RESOLVED still cannot share an array; an array is split at its last INVALIDATE, what came before it is dropped, and the INVALIDATE goes out as its own array: `[1, INV, 2, 3]` is published as `[INV]` then `[2, 3]`. So INVALIDATE never shares an array with a value, K6 ("runs no function") has no exception, and the waveData absence marker is not needed. Same day, the reference kernel was brought back to R-wave-boundary@2 and TS: each `ctx.down` call is its own array, and `ctx.deps[i].waves` keeps the per-array boundaries like TS `waveData` (the kernel had merged a run's calls and flattened the view without saying so). | Resolved: in written order, split at INVALIDATE |
| O14 | Should a consumer be able to reach a controller without holding its handle, as TS's `ctx.up([["PULL", { pullId }]])` does? One option was routing only at wiring time (walk the declared dependencies once at construction to find the keyed node). **Decided by the user 2026-11-06:** not needed. Whoever builds the graph, a developer or an agent, already knows the pausable's or holder's id or handle, so anonymity buys nothing. | Resolved: no, the builder passes the handle |
| O15 | Rename the wire message DIRTY to PENDING? In TS and the spec DIRTY means "possibly stale, a settlement is coming", while Vue, alien-signals, Solid and the TC39 proposal use dirty for "definitely stale" and pending/check for "possibly". The user prefers pending (2026-11-07); the reference kernel already calls the flag and the marking step `pending`/`markPending`. The spec is frozen, so the message keeps its name until the draft rules are revisited (R-two-phase, R-tier, K2, every trace). RESOLVED (Elm's `NoChange`) and settle (Promise sense) carry a similar risk and could be reviewed then. | Resolved (user, 2026-11-09): rename in the B140 revision; RESOLVED and settle stay |

## 分类时发现的不一致

均未核实；这里只列出引用位置，不做处理。

- [wave_protocol.tla](../../formal/wave_protocol.tla) 第 2524 行的 `TerminalClearsPauseState` 要求：
  非 resubscribable 的节点终止后，不能持有任何 pause 锁和缓冲。而 R-pause-lockset@2 说，普通关闭或
  终止重置不会释放其他控制者的锁，只有匹配的 RESUME 或 permanent release 才会；R-terminal@2 也说，
  节点自有的锁在合格的重置后依然存在。除非 "permanent release" 涵盖所有非 resubscribable 的终止，
  否则模型和草案是冲突的。B140 已经把 formal 对齐列为待办。
- 2026-11-05 在 TS 基线（`dafc5ae`）上用两个临时探针观察到：fn 里同步写**上游** state 会被拒绝，报
  "synchronous feedback cycle: node fn re-entered its own wave"；而 fn 里写一个**不相关**的 state，会在
  fn 内部同步嵌套跑完一整个 wave，订阅者在 fn 返回前就收到了 DIRTY/DATA。后者和 P7（wave 进行中发出的
  请求要等它结束）不一致；现有规则只为 observer 发出的请求规定了排队。用户 2026-11-05 的方向（请求和数据都走
  message 通道）意味着：fn 只能通过 ctx.down/ctx.up 影响别的节点，在 fn 里调用别的节点的 `set` 应当被拒绝，
  或者统一当作 wave 结束后的 host 输入；选哪种还没定。探针脚本没有保留在仓库里。
  2026-11-06 起参考内核按 K8 处理：写自己的上游仍然拒绝（抛出变成它的 ERROR，和 TS 一样）；写不相关的
  state 排队，在当前 wave 结束后作为 host 输入运行（K8/P7 测试）。**用户 2026-11-08 确认**：排队，不报错；拓扑请求（`replace`、
  `subscribe`）也一样（C-8 回放的第 3 条）。

## 下一步

1. 用户审阅原则、每条规则的归类，以及 O1–O10。
2. 内核定下来后，把它写成带 trace 生成器的可执行参考解释器（另开工作项），并用 C-28 到 C-39 检验：
   每条已接受的 trace，应当能由单独的内核、或内核加模块复现。
   2026-11-06 已开始：[graphrefly:B143](../../plan/backlog.jsonl) 的第一版在
   [reference/kernel/](../../reference/kernel/README.md)，覆盖 K1–K5、K7 的一部分，README 列出了尚未覆盖的部分。
   同日第二版加上 K8（wave 期间到达的请求排队）和 O3 的决定（batch 在 commit 前不投递 DIRTY）。
   第三版加上 P9（异步结果作为新 wave）、K6、K7 的生命周期和 cleanup、H6 安静节点，共 32 个 trace 测试。
   结论之一：DIRTY 只存在于一个同步 wave 之内，异步工作不会让 DIRTY 悬着，R-async-paused@2 里
   "deferred-result author 最终必须发 DATA、RESOLVED 或终止"这一义务在这个模型里不需要了。
   之后做了一轮精简：节点函数改成 TS 基线的 `(ctx) => void`，输出只走 `ctx.down`（去掉了 `later()`、返回值和
   `activation` 标志），读取不再带 `pending`（留给 K10），README 列出了保留下来但之前没讨论过的东西。
   第一次回放 C-28 到 C-39 见 [REPLAY.md](../../reference/kernel/REPLAY.md)：内核负责的条款没有失败；
   发现并修了 batch 的两个 bug；由此产生的两个问题由用户定为 O11（DIRTY 只由内核发出）和 O12（回调里开 batch
   照常允许，不加特殊条款）。
   第一个模块 pause 在 [reference/modules/](../../reference/modules/README.md)：声明的控制对就是一条普通依赖边
   （`${id}.pauseLocks` state 节点），不改内核，不用类别 1 消息，也不用 H1、H3。O8 的问题由此得到回答。
   resumeAll 遇到 INVALIDATE：内核不让函数看到它，它当场传给下游；用户 2026-11-06 定为每个 INVALIDATE 都丢弃
   它之前扣住的值，下游不会收到比已收到的 INVALIDATE 更旧的值。为了察觉每个 INVALIDATE，resumeAll 由两个节点
   组成：`${id}.pauseLog`（值是自上次 INVALIDATE 以来扣住的列表）和 `${id}`（恢复时放出）。
   同日用 pause 模块回放了 C-30、C-31、C-36 里属于 pause 的条款（[pause.replay.test.mjs](../../reference/modules/pause.replay.test.mjs)，
   9 个测试）：全部能复现。C-36 的多输入节点需要几个 pausable 共用一个锁 state（新增 `control` 选项）。
   之后内核改成每次 `ctx.down` 各成一个数组、`deps[i].waves` 保留数组分界（R-wave-boundary@2、TS），并按 O13
   不再按 tier 重排；resumeAll 因此保留扣住的数组分界（`[1]`、`[INV]`、`[2, 3]`、`[4, 5]` 恢复后是 `[2, 3]`、
   `[4, 5]`）。剩下的差异：恢复时所有数组在同一个 wave 里发出，中途的 re-pause 要等这个 wave 结束才生效。
   查 TS 后发现 `latest` 模式是参考实现自己发明的（TS 默认 pause 是被暂停节点的函数暂停期间不运行、恢复时运行一次，
   看到 waveData 里缓冲的全部数组）。用户 2026-11-06 决定去掉 mode：只有一种 pausable，TS 的两种模式变成放置位置
   （放在节点前面＝默认 pause，放在节点后面＝resumeAll）。
   第二个模块 demand（PULL）：用户 2026-11-06 决定也走声明的控制对，`pull(params)` 是 bundle 的方法，写
   `${id}.pullDemand`；holder 是 H6 quiet 节点，平时下游什么都收不到，每次 pull 运行一次。于是 PAUSE、RESUME、
   PULL 都不必进内核，O2 的答案是内核没有类别 1 消息。和 TS 的差异：新订阅照样拿到上次服务的结果（START-only
   要 H2，先不做）。顺带修了内核：quiet 节点一次 settle 发出的多个数组放在同一个稍后 wave 里。
   K10 节点状态：用户 2026-11-06 选了草案 R-status-enum@2 的推导式。`status(id)` 返回 cache（empty/stale/ready）、
   output（open/completed/errored）、lifecycle（inactive/active/closing），不另存状态。因为没有 DIRTY 跨越时间，
   stale 只在 wave 内部看得到。TS 的 settled/resolved 区分在这里没有对应。
   第二轮精简（同日）：去掉 priorHooks（quiet 节点的 INVALIDATE 改为当场传下去，和 TS 一样，因为它不带 DIRTY）、
   K10 的 open 和 closing 两个标记（分别并入 announced、由 lifetime 推导）、wave 结束时的全量重置、running 栈，
   以及激活时重复的输出应用代码。试过但保留：输入的 ended 不能由上游当前状态推导（要用已收到的，R-ctx-wave-data）。
   随后用户决定把 publish 拆成 apply（写节点自己的值、作废、终止）和 deliver（补 RESOLVED、通知、加 DIRTY、交给订阅者），
   对应 TS 的 `_down` 和 `_emitToSubs`；`applied` 参数因此去掉，两个"稍后输出"函数合成一个 `later`。
   2026-11-07：对照 TS 和其他响应式库改名（publish → down，announce → markPending，dirtyDeps → pendingDeps，
   retireInputs → releaseDeps，life → lifetime）；线上消息 DIRTY 是否改名为 PENDING 记为 O15。
   H5 已观察提交的输出：不需要内核钩子，普通订阅者收到的就是节点提交的内容；`observe` 模块按 TS
   `Graph.observe` 的样子包了一层。发现一个以前没列出的 TS 差异：内核的 sink 每次收一个数组，TS 的 sink 每次收一条消息。每次 pause/resume 让下游多收一次 [DIRTY, RESOLVED]，用户接受。TLA+ 的 TerminalClearsPauseState 冲突在模块模型里按
   R-pause-lockset 解决：终止后锁还在控制 state 里。
   旗舰验收（2026-11-07，[reference/flagship/](../../reference/flagship/README.md)）：B139 简报的 S1–S8 全部在
   参考内核上跑通，图和 plain 两臂各 22 个测试，同一个独立 verifier，真实的本地 inbox 文件。occurrence 身份、
   currentness、admission、按 key 汇合、业务终态、守恒和覆盖全是 DATA，D791 的"不改协议"在这个内核上成立。
   内核只加了只读的 `describe()`（P1，S1 要比较拓扑）。用到的：state、node、私有状态、每次运行多个数组、batch、
   H6 quiet 节点、H5 订阅/observe；没用到 INVALIDATE、PAUSE/RESUME/PULL、pause/demand 模块、cleanup 钩子。
   H6 是承重的：把 release 改成非 quiet，变异测试就会失败（会在不放行的路径上发 DIRTY 和 RESOLVED）。
   15 个运行时变异全部被业务/授权/守恒断言抓到；host 的一次性记录是冗余防线（admission 只决定一次），保留。
   和 TS 的差异见该 README：按简报用 Welford、100/200 和分母修改（TS 用精确 BigInt、[1,2,3] 和 `exactZScore`）；
   不限制同时进行的写入、不做派发时的最终检查。
   第二个对比（2026-11-08，[reference/operation-tree/](../../reference/operation-tree/README.md)）：photo-scenes
   的操作树。plain 臂是 photo-scenes 真实的 `packages/operations`（固定在 `a331d71`，原样复制），验收是它自己的
   27 个测试，一字不改；图臂 API 相同，建在参考内核上，两臂都全部通过。photo-scenes 的三个历史版本各自恰好
   挂在之后才加的 QA 测试上。结论：不需要改内核，也不需要模块；run 的生死是数据（holder 节点里的
   `alive`），不是内核 lifetime（K7）；K8 让嵌套的修改不能在 sink 里同步生效，所以回调在 wave 之后由宿主运行，
   宿主保留一个约 25 行的两路队列（plain 的 frames 约 45 行）；Q1 的"半死子树"、Q2 和 Q6 三类 bug 在图臂里
   由结构排除，其余七类两臂都要写代码。没用到 H6、batch、lifetime 和 cleanup。
   restart（2026-11-08，O7 的模块方案，[reference/modules/](../../reference/modules/README.md)）：一个 owner 节点
   一直面对下游，可能结束的部分是固定路径 `${id}/inner` 上的内部节点，每次重启就用内核新加的 `replace` 换一个新实例
   （同一个 id、同样的订阅者），所以 describe 不变，inner 的观察者每次 attempt 开头收到 START。策略在 owner：
   `rounds`（TS repeat 的次数）、库共用的 retry 策略、外部请求走声明的控制 state `${id}.restart`（P11）。
   retry 策略按用户要求改写了 TS 的 `graph/resilience.ts`，没有原样照搬：`retryDelayMs` 一个函数同时回答重不重试、等多久；
   五种 backoff 合成 `{ initialMs, factor, maxMs }` 一种形状（linear 和 fibonacci 没有使用者）；在构造时校验并抛错，
   不再在每次计算时偷偷修正（TS 会把 factor 1.5 截成 1）。和 TS 的差异见 modules README。
   同日用 restart 回放 C-34、用 `replace` 回放 C-8（已激活的 R-rewire），见 [REPLAY.md](../../reference/kernel/REPLAY.md)。
   回放发现 `replace` 漏了"不能接上已结束的依赖"（P5）并已修好，restart 因此在上游结束后不再尝试重启。
   和 C-8、C-34 不一致的五处列在 REPLAY.md 末尾，用户 2026-11-08 全部同意：用 replace，需要时再给它加 H4 种子（surgical 留作以后的性能优化）；允许 replace 已结束的节点；fn 里的请求排队；重启后订阅者保留；扇出期间的请求依赖顺序。规则修订（B140）时 C-8、C-34 要随之改。
   同日按 owner 加 inner 的结构做了 switchMap（当时是单独的模块，现在在 [higher-order.mjs](../../reference/modules/higher-order.mjs)），验证了第 1 处的前提：
   只换一个 inner 的 operator 不用种子也能保住自己的值，因为被 replace 的只是 inner。
   同日又做了 mergeMap（git `75ee4c8`），原以为它是第一个需要种子的场景，结果不需要：
   只用 replace，TS 的 mergeMap 测试都过。代价是一个固定的对外节点、core 的状态放在新 fn 的闭包里带过去并跳过已处理过的快照、
   每次 replace 只加一个 inner（K3 一次激活只留一个值）、source 结束后 replace 不再带上它（P5）。
   种子只能省掉第二项，其余三项只有原地加依赖（surgical）才能省掉。所以到目前为止没有场景需要种子。
   **用户 2026-11-08 决定趁现在还在试验阶段就做 surgical**：内核加了 `rewire(id, deps, fn)`，保留节点实例（值、私有状态、lifetime、订阅者，不发 START），
   留下的依赖保留连接和输入记录（位置可变），去掉的静默释放，新加的先接上、它们的快照作为一次普通输入 wave 交给 fn；只在两个 wave 之间运行（K8），
   所以 R-rewire 那五条规则里大部分情形（依赖的 DIRTY 还在路上时移除、跨 wave 保留记录、batch 结果）在这里不会出现。`ctx.deps[i].id` 一起加上，fn 按 id 读依赖，不用管位置。
   C-8 对 `rewire` 重放：保值、surgical、幂等、无值依赖等待、拒绝已结束的 D 都和 C-8 一致；fn 里的 rewire 照旧排队（决定 3）。
   `replace` 保留，用于 restart 这类需要新实例的场景。mergeMap 改成在 `rewire` 上的一个节点，和 TS 同形，上面四项代价都没了。
   随后按用户要求精简：switchMap 和 mergeMap 合成一个 operator（[higher-order.mjs](../../reference/modules/higher-order.mjs)，和 TS 的 mapOperator 一样），
   两个模块的代码从 74 行变成 57 行（不算注释和空行）；内核里 `replace` 和 `rewire` 共用一个依赖交换函数，replace 现在就是"关掉旧实例 + 像 rewire 那样换依赖 + 像第一次订阅那样启动新实例"。
   同日补上 batch 体里的拓扑请求：`subscribe`、`unsubscribe`、`replace`、`rewire` 在 batch 体里不再立刻执行，而是等 commit 的 wave 跑完再按请求顺序执行
   （K8：wave 期间的请求排到 wave 之后；batch 体就是这个 wave 的一部分），体抛错时和输入一起丢掉。这样 batch 体在 commit 前什么都不改。
   C-22 重放全部一致，只有一处不同：TS 只在节点自己有未提交的 batch 输出时才推迟 rewire，这里一律推迟，因为这里 commit 前不投递任何东西，而拓扑请求会投递。
   发现：restart 需要内核的 `replace`。参考内核原来没有任何改拓扑的手段，而把下游和订阅者接到新实例上只有内核能做；
   DS-17 的 rewire 行只写了 H4（种子），restart 用不到种子，没有加。TS 里没有生产代码用 `resubscribable: true`，
   `repeat` 只在它自己的测试里用，重试是 driver 在图外做、以 DATA 发出事件，所以现有用法都套得进这个模块。
   同日做了 checkpoint 和 restore 模块（[checkpoint.mjs](../../reference/modules/checkpoint.mjs)）。用户选了：只在模块里做，内核不加种子；
   restore 后、第一次订阅前上游变了就重算一次（按 C-38 草案，不跟 TS）。内核只加了两个只读接口：`idle()`（是否在 wave 边界，O5）和 `privateState(id)`（R-snapshot）。
   做法：restore 不运行任何 fn；节点第一次激活时，由一层包装 fn 写回私有状态、发出保存的值（K3：激活时的输出只设置保留值）。
   如果依赖的值和保存时收到的不同，就只把变化的依赖交给真正的 fn，运行一次。
   发现：没有种子时，有两处做不到忠实恢复，都来自 P5（已结束的节点不能再接）：
   已结束的计算节点只能恢复成一个已结束的 state（值和 terminal 一样，但 describe 里没有依赖）；
   一个没结束的节点如果还持有已结束的依赖，capture 直接拒绝。后一处光有种子还不够，还要给恢复出来的节点开一个 P5 例外（TS 就是这样做的）。
   用户先决定留着；随后发现第二处范围更大：默认策略下，多输入节点只要有一个输入结束了，整张图就 capture 不了。
   于是**用户同日决定加种子**：`node()` 多一个可选的 `seed`（值、terminal、私有状态），不传时行为不变。
   带种子的节点在第一次激活前，可以接上已结束的依赖（P5 唯一的例外），只拿它的快照，不运行它。
   这样两处都修好了：已结束的计算节点带着原来的依赖恢复，持有已结束依赖的节点也能恢复。
   模块的包装 fn 只剩比较输入、需要时重算这一步。这是第一个需要种子（H4）的场景，对应决定 1。
   随后用户问能否精简，并从语义统一的角度**决定彻底放宽 P5**：已结束的节点可以被订阅、被依赖，也可以被 rewire/replace 加成依赖，
   它的 START 快照带着最后的值和 terminal，它自己不会再运行。理由是 P5 原文只说"terminal 之后什么都没有"，没有禁止订阅；
   同一张图不再因为订阅时机（依赖结束之前还是之后）给出不同结果；restore 也不再需要例外。
   代价是和 TS（R-terminal R2.2.7.b：订阅已结束的非 resubscribable 节点会抛错）以及 C-8（rewire 拒绝已结束的依赖）不一致，B140 要写明。
   内核随之删掉了 `assertAcquirable`、`seeded` 标志和例外，并在每个 lifetime 的第一次运行时也按 K5 处理快照里的 terminal。
   switchMap 投影到已结束节点不再是 ERROR，而是 inner 发出最后的值后结束；restart 的两处检查保留，理由改写。
   同日做 replay。先查了 TS：`replayBuffer` 只在 occurrence 那两个 solution 里用，普通节点和 operator 都没用。用户决定：
   (1) K3 的快照改成带上节点最后一个（带值的）数组里的全部 DATA（不只最后一个值），数组之间不合并：发过 `[DATA 1]`、`[DATA 2, DATA 3]` 的节点，
   新订阅者拿到 `[START, DATA 2, DATA 3]`，新依赖节点在第一次运行时拿到 `[[2, 3]]`。第一版按"最后一轮"把同一轮的数组合并了，用户当天纠正为以数组为单位；
   (2) 跨 wave 的历史放进模块（[history.mjs](../../reference/modules/history.mjs)），历史节点的值就是最近 N 个 occurrence 组成的列表，
   存在私有状态里，所以 checkpoint 能直接保存。不需要 H2 钩子，也不需要内核的 replay 选项。
   和 TS 的不同：TS 的快照只有最后一个值，晚到的依赖节点每个回放的值各跑一次 fn；这里的种子也从 `value` 改成了 `values`。
   同日和用户定了合并多个依赖的 operator 发哪些数组：取最新状态的（combineLatest / derived）每轮一个数组；逐个处理 occurrence 的（map、filter、merge、withLatestFrom 的主依赖）
   一个输入数组对应一个输出数组；跨依赖配对的（zip）每轮一个数组，装下这一轮配出的所有结果。merge、withLatestFrom、zip 已加进 sugar，例子见 sugar.test.mjs。
   TS 在这三个上都是一个值一个数组。
   同日用户又定了两件事：向上的 INVALIDATE（R-up-at-source）定为去掉，因为 TS 生产代码里从不发送它，ctx.up 只用来送 PULL，而 PULL 已改走 control pair；
   `derived` 的门槛每次运行都检查（TS 和 R-first-run-gate 只在第一次运行前检查，之后缺值的依赖以 SENTINEL 交给 fn）。没有 `partial` 选项：门槛是 sugar，
   需要 `partial: true` 的地方就直接写普通 fn，或者用 merge、zip、withLatestFrom。
   2026-11-09 用户把 K9（向上的控制路由）整个定为去掉：TS 生产代码里向上只发 PULL（`ctx.upNext`），没有地方向上发 PAUSE、RESUME、DIRTY 或 TEARDOWN；
   pause、demand、restart 都已经走声明的 control pair（P11）。内核没有 `ctx.up`。随之去掉的有：匿名路由到 holder（O14 已定不需要）、冻结的广播列表、
   rewire 后保持连接目标、diamond 上每个 holder 只触发一次。B140 提案里 R-ctx-up、R-up-at-source、R-up-routing、R-up-routing-diamond 列为退役；
   C-37 只剩最后一条（lifetime 关闭后旧工作作废），归 K8。
3. 然后根据结果恢复、修订或取代 B140。
   2026-11-09 写了第一稿提案：[PROPOSAL-B140-kernel-rule-revision.md](PROPOSAL-B140-kernel-rule-revision.md)，
   列出每条规则的去向（合入哪个内核概念、移到哪个模块、退役）、conformance 场景的去向、和 TS 的差异，以及 Q1–Q4 四个问题。Q1–Q4 用户同日全部回答，提案正文已按答案改写（新规则正文用 PENDING）。用户同日接受整份提案，B140 记录随即在原处改写（outcome 和 acceptance 按提案）；B141 同日结项，B140 改为 planned。
   同日按 B140 的 Decisions 一条，把用户在 DS-17 做的决定写成 [graphrefly:D797](../../decisions/decisions.jsonl)：部分取代 D796 和受影响的前身决定（D8、D9、D30、D34、D38、D65、D109 等 29 条），并写明 spec、conformance、formal 三方面的义务。
   同日用户解冻 `spec/`：内核规则作为 D797 引入的 12 条草案行写进 `spec/rules.jsonl`（R-messages、R-wave、R-subscription、R-invocation、R-terminals、R-invalidation、R-lifetime、R-request-order、R-node、R-failure，以及 R-no-imperative@2、R-node-thin@2），旧规则的 transition 留到激活时再加，见提案第 8 节。
   随后改了 conformance：C-28、C-29、C-33–C-37 就地改写为 D797 版，新增 C-40–C-42；C-1–C-27 等激活时再改，模块相关的 C-30–C-32、C-38、C-39 等写模块规则时再改。
   接着写了模块规则：R-pause、R-demand、R-history、R-checkpoint、R-restart 五条 D797 草案（`area` 为 `module`），C-30–C-32、C-38 改写为 D797 版；随后补上 revision 观察器（O9，[revision.mjs](../../reference/modules/revision.mjs)，10 个测试，17 个变异全部被发现），规则 R-revision，C-39 改写为 D797 版。
   Q1 用户同日定为在原处修订 B140；backlog 里的记录等提案整体被接受后再改。
   Q2 用户同日定为模块规则放进 `spec/`，单独一个 area；模块规则只能引用内核规则，内核先激活，模块以后逐个激活。
   Q3（即 O15）用户同日定为这次修订里把 DIRTY 改名为 PENDING，只改这一个名字；各语言包和参考内核在激活后各自改。RESOLVED 保持原名（用户同日确认）。
   Q4 用户同日定为去掉 TEARDOWN：TS 生产代码里没有地方主动发出它（只转发），R-graph-lifecycle@2 草案也已经撤掉 `graph.destroy()` 的广播；
   lifetime 在最后一个订阅者离开时结束（K7），想让下游 bridge 有结局就对源调用 `complete`。R-teardown-complete、R-teardown-terminal-relay 和 `resetOnTeardown` 一起去掉。
   参考内核的消息类型随之只剩 K1 的七种，`ctx.down` 拒绝 PAUSE、RESUME、PULL 和 TEARDOWN（新测试）。
