# 协议面的内核与模块分类

DS-17，用户于 2026-11-05 开启。对应工作项：[graphrefly:B141](../../plan/backlog.jsonl)。
状态：**Claude 写的第一稿，用户尚未审阅。** 非规范性文档：不激活、不修订、不退役任何规则，不改动任何
formal 模型或 conformance 场景，也不授权任何实现。
[graphrefly:B140](../../plan/backlog.jsonl)（激活 D796 草案）暂缓，等本分类定下来再说。

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
| P5 | COMPLETE and ERROR end a node's output for good. Nothing follows them. |
| P6 | Lifetimes nest. A node is active while something needs it; activation acquires dependencies, deactivation releases them, and every ctx and cleanup belongs to exactly one lifetime. |
| P7 | Delivery inside a graph has one total order. Requests made while a wave is being delivered wait until it finishes. A running function is never reentered. |
| P8 | The kernel does nothing on its own: no retry, deduplication, buffering, timing, demand or persistence. Each of those is a node. |
| P9 | Work that finishes later enters as a new wave from where it started. The kernel does not pair results across waves. |
| P10 | A function's throw becomes that node's ERROR. Any other failure goes to its caller or the host reporter, never into an unrelated node's messages. |

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
| K9 Upstream control routing | R-ctx-up, R-up-at-source, R-up-routing | PULL consumption, RESUME lock release and PAUSE acquisition become what the matching module node does; frozen broadcast lists exist mainly because topology can change mid-delivery (O4) |
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
| Demand (PULL) | R-pull (demand parts), R-up-routing-diamond | A holder node that reacts to PULL arriving on the upstream channel, keeps only the latest unserved demand, and serves it as an ordinary invocation. | K9 for routing, H6 for quietness, H2 for START-only subscription |
| Replay | R-replay-buffer | A history node that keeps the last N published DATA and supplies them to new subscribers. | Hook H2 |
| Checkpoint and restore | R-restore, R-snapshot, R-input-receipts, R-resource-reattach | Graph-level save and rebuild: construct nodes from recipes and seed them. | Hook H4. Scope is open decision O5. |
| Revision evidence | R-node-revision | An observer that counts committed outputs per node, plus the optional hash. | Hook H5 (already exists as observe/inspection). D791 flagship revisions are DATA-level, not node revisions. |
| Rewire | R-rewire, R-rewire-deferred, R-rewire-deferred-committed-boundary, R-rewire-async-live-edge, R-rewire-batch-boundary | Graph-level "replace node": tear the old instance down, build a new one with new dependencies, seed its cache. | Hook H4. Whether in-flight records must survive a rewire is O4. |
| Value sugar policies | R-first-run-gate, R-dynamic-node | "Wait until every dependency has a value" and "read only some dependencies" are checks inside the sugar's function, not kernel gates. | Nothing |

## NodeOptions

| Field | Class | Note |
|---|---|---|
| `initial` | Kernel (K3) | Seeds the retained value |
| `partial` | Sugar | First-run completeness is a sugar policy |
| `terminalAsRealInput`, `completeWhenDepsComplete`, `errorWhenDepsError` | Kernel (K5), simplified | Three booleans become auto or manual per kind; ignore is manual with no action (O6) |
| `resubscribable` | Open (O7) | Either kernel execution restart under the same node identity, or removed in favor of restartable owner nodes |
| `resetOnTeardown` | Kernel (K7), candidate to remove | One rule should say what each node kind keeps on deactivation |
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
| H1 | Control reaches its target in one of two declared ways: (1) a keyed upward message along declared connections, handled by the node that declares the key and forwarded by the others; (2) a declared control pair, where the controller calls its target outside the message channel. Either way the relation is declared, so describe can draw it as a control edge. | Pause, demand, restart | K9 routes PULL by pullId today; (2) is the user's 2026-11-05 relaxation (O8) |
| H2 | Subscription snapshot provider: what a new subscriber gets in its START array (default: the retained value) | Replay, demand | **L2-Q15** makes onSubscribe non-replaceable (O1) |
| H3 | Invocation gate: defer a node's function call while keeping its latest input | Default pause on sources | Only if O8 keeps it |
| H4 | Construction-time seed: retained value, private state and first-call history | Checkpoint, rewire, persist | Must stay quiescent-only unless O5 says otherwise |
| H5 | Committed-output observation | Revision, evidence, replay | Exists (observe/inspection) |
| H6 | Quiet boundary: consume an input wave without forwarding DIRTY; publish later as a new wave | Flagship lifecycle port, demand | Today folded into R-pull; separating it is new wording, not new behavior |

## 消息类别

类别一共七个，就是现在的七个 tier。之前说"控制 → DIRTY → 值 → INVALIDATE → 终止"时漏掉了首尾的 START 和
TEARDOWN。每个类别的内核行为如下；行为来自 R-tier@1 的"tier < 3 立即派发，tier ≥ 3 在 batch 里延后"，以及
各条 settlement 规则。模块消息只能加入一个已有类别，继承它的全部内核行为。

| Class | Built-in types | Kernel behavior | Module types that join it |
|---|---|---|---|
| 0 handshake | START | Only at the head of a subscription's initialization array | None expected |
| 1 control | PAUSE, RESUME, PULL | Dispatched immediately, not deferred by batch; neither opens nor settles a DIRTY; travels upward along declared connections (or between a declared control pair); a non-handling node forwards it, a source drops it | PAUSE(key, lock), RESUME(key, lock), PULL(key, params), and the restart request of O7 all belong here |
| 2 notification | DIRTY | Dispatched immediately; opens one dirty membership per connection | None: a new notification kind would be a new class |
| 3 value | DATA, RESOLVED | Deferred inside batch; settles a membership; DATA is an occurrence | None |
| 4 invalidation | INVALIDATE | Deferred inside batch; removes the retained value; settles a membership | None |
| 5 terminal | COMPLETE, ERROR | Deferred; settles a membership; ends output for good | None |
| 6 teardown | TEARDOWN | Last; ends the lifetime | None |

所以 PAUSE、RESUME、PULL 都在类别 1，区别只在"谁处理、处理时做什么"，这些属于模块：pausable 节点处理
PAUSE/RESUME，holder 处理 PULL，处理之后 holder 的结果是一个新 wave 里的类别 3 消息（经过 H6 安静边界）。
如果 pause 改用声明过的控制对（O8），PAUSE/RESUME 甚至不必作为消息出现，只作为可观察的状态变化出现。
实际上能加入的只有类别 1；其余类别都直接参与 settlement，新增成员就等于改协议。

用户 2026-11-06 同意了 2026-11-05 关于 tier 只选类别、owner 节点重启、声明控制对的三条回复。

## 旗舰需要什么

根据 B139 简报和 D790/D791：需要 K1–K8、K10、K11，用于保留证据的钩子 H5，以及用于安静生命周期端口的
钩子 H6。旗舰的 occurrence 身份、revision domain、currentness、按 key 汇合、业务终态和 effect 结果，
全部是带类型的 DATA（D791 写明不改协议），所以它们依赖 P2，但不需要新的内核规则。旗舰不需要 pause、
resumeAll、demand 服务、replay buffer、checkpoint 或 restore（崩溃恢复不在它的范围内）、surgical
rewire、resubscription 和 dynamic 节点。简报也不要求 batch；batch 仍留在内核，是因为 UI 那类"多次写入
保持一致"的场景依赖它。

## 需要用户决定的问题

| # | Question | Default suggested here |
|---|---|---|
| O1 | Allow a spec-defined snapshot hook (H2) despite L2-Q15? | Yes, declarative only: it returns DATA to put in START, no message handling |
| O2 | How do PAUSE/RESUME/PULL leave the kernel? User direction 2026-11-05: control goes through the message channel or through a declared control pair (O8); undeclared imperative control is not allowed. Option (b): modules declare message types that join an existing tier class and inherit its kernel behavior (direction, settlement, batch and terminal handling), plus a few spec-defined attributes (what a non-handling node does, whether it notifies downstream, wire crossing). Within a class, built-in types already sort by submission order (DATA and RESOLVED never share an array; PAUSE, RESUME and PULL keep their order), so module types need no sub-order. A type that needs a position between classes, or behavior no class has, is a new class and therefore a protocol amendment. This narrows L2-Q14 rather than reopening it. | (b), class only, no sub-order until a real case needs one |
| O3 | Keep batch rollback (L2.E)? **Decided by the user 2026-11-06:** batch delivers no DIRTY before commit. The body only records host inputs; commit announces DIRTY to the whole cone, then publishes. The kernel may mark pending nodes internally during the body (R-two-phase@2 already separates internal notification from delivery), so a read can report pending. A throwing or asynchronous body commits nothing, so rollback stays and has nothing to undo: no compensating RESOLVED, no staging rejection. When the draft rules are revisited, drop "Batch may announce DIRTY before its later commit" from R-two-phase@2 and recheck R-rewire-batch-boundary. | Resolved: no DIRTY before commit |
| O4 | Is surgical rewire (surviving in-flight records) needed, or is graph-level replace enough? | Replace is enough for the first kernel |
| O5 | When can a running graph be captured? Fully idle moments may never come, but every wave boundary is settled (single thread, synchronous waves, no batch open). Capture there: retained values, private state, and pending async work as data. Once pause, demand and replay are nodes, their buffers are ordinary private state. Native resources reattach through factories; an external call that was in flight is re-issued or recorded as unknown, never resumed. | Wave-boundary capture; no kernel-level pending-FIFO or receipt capture |
| O6 | Terminal policy: auto or manual for each of COMPLETE and ERROR (2×2) instead of 3×3? Auto: complete when all deps complete, propagate ERROR. Manual: the terminal is function input and the node ends only when its function says so. TS option sites (line-window count at `dafc5ae`, tests excluded): 275 ignore/ignore (long-lived hubs in adapters, cqrs, solutions), 43 input, 4 manual COMPLETE with auto ERROR (including `causalOccurrenceAuthority`), the rest the default. | 2×2; ignore is manual with no action |
| O7 | How does restart work without the flaws of today's `repeat` (downstream observation stops at the wrapper; a downstream cannot recover an upstream that already sent a terminal)? Kernel option: a terminal ends the current execution and resubscribable starts a new one under the same identity. Module option, which the user prefers if it avoids those flaws: one restartable owner node faces downstream permanently and never forwards a protocol terminal while it may still restart; whatever may terminate and be restarted lives inside it as owned inner nodes, registered at a stable path under the owner so describe and observe(path) continue across attempts (describe already discovers inners under synthetic ids, D51). Inner nodes subscribe to long-lived upstream nodes outside the owner with ordinary subscriptions, so nothing upstream needs to be resubscribable. Recoverable endings are typed DATA (D184 DataResult/DataIssue), as D790 already requires for long-lived hubs; protocol COMPLETE/ERROR stay final. Retry is the owner's policy (attempts, backoff), and a restart request reaches the owner by H1. | Module option, pending a check that every current resubscribable use fits it |
| O8 | Pausable nodes are designed in advance, and pause must be directed: with pausable1/2/3 in the graph, a controller reaches pausable2 alone. User direction 2026-11-05: a declared control pair (resumable to pausable) may be controlled outside the message channel, because the original objection to imperative control was that observers could not see the topology, and a declared pair can be drawn as a control edge. Conditions to keep it visible and ordered: the pair is declared at construction; a call made during a wave applies at the wave boundary (P7), like observer-origin requests; every pause state change is observable through inspection. A source that must stop working handles pause itself and starts or stops in its own function. Is hook H3 then unnecessary, and can keyed ctx.up for pause be dropped in favor of pairs? | No H3; pairs for pause, keyed ctx.up kept only where a pair is impractical |
| O9 | Revision/valueRevision as kernel evidence or as an observer module? Checkpoint needs them only for partial restore; a whole-graph restore from a wave-boundary capture (O5) needs no comparison, and a live external source is compared by its own DATA-level version (as in D791). The checkpoint module can install the observer at graph creation. | Observer module |
| O10 | Saying "not required for the first kernel" conflicts with L0.5 and F-NO-WEDGE-CUT. Revisit them? | Yes, as a separate decision |

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
3. 然后根据结果恢复、修订或取代 B140。
