# B140 规则修订提案

DS-17 下一步第 3 条，2026-11-09。对应工作项：[graphrefly:B140](../../plan/backlog.jsonl)（2026-11-09 起 planned）和
[graphrefly:B141](../../plan/backlog.jsonl)。
状态：**用户 2026-11-09 接受。** 第 7 节的四个问题用户同日全部回答，正文已按答案改写。 非规范性文档。`spec/rules.jsonl` 和 `spec/conformance.jsonl`
冻结，本文不改它们，也不激活、修订或退役任何规则；这里只写"修订时打算怎么改"。

输入：[DS-17](SESSION-kernel-module-classification.md) 的原则、分类和 O1–O15；参考内核
[reference/kernel/](../../reference/kernel/README.md)（含 [REPLAY.md](../../reference/kernel/REPLAY.md)）和
[reference/modules/](../../reference/modules/README.md)；TS 基线 `dafc5ae`。下面每条内核规则的写法都来自参考内核
已有测试的行为；没有测试支撑的地方单独标出。

## 1. B140 本身怎么处理

B140 的 outcome 是"激活 D796 草案规则集"。分类之后要激活的东西变了：

- 内核只剩 K1–K8、K10、K11 十个概念（K9 已定为去掉），每个概念一条规则，取代 D796 的 31 条内核草案和它们的前身；
- pause、demand、history、checkpoint、restart、revision 观察这些模块，不再是每个节点的协议；
- `derived` 的门槛、dynamic 读取、equals 去重是 sugar，按 B140 自己的说法属于各语言包。

**用户 2026-11-09 定为在原处修订 B140**（Q1），保留 id、governing_refs 和 B141 前置。outcome 改成"激活 DS-17 的内核规则集，
并给出每条旧规则的去向"。acceptance 里改两条：Rules 一条按第 2–4 节写；Conformance 一条按第 5 节写。
其余几条照旧：Formal、Owner routing、Evidence gaps、Activation and handoff。Checkpoint/encoding 一条
改成写 checkpoint 模块规则时的要求，仍留在 B140 里（没有单独的 checkpoint 工作项可以接收它）。
没有选新开工作项取代它：那样引用 B140 的地方都要改。用户同日接受了整份提案，`plan/backlog.jsonl` 里的 B140 记录随即改写：
outcome 和八条 acceptance 都按本提案写；B140 负责写出内核和模块规则、激活内核规则集，模块规则以后各自作为单独接纳的工作激活。
B141 同日结项，B140 的 status 随即从 deferred 改为 planned（不授权激活或实现）。

## 2. 内核规则：每个概念一条

**命名（Q3）：** 修订后的规则把 DIRTY 叫作 PENDING，RESOLVED 和 settle 不改。下面的新规则正文已经用 PENDING；表里引用旧规则原文和规则 id（如 R-dirty-before-data）时仍是 DIRTY。

版本号写法：一条规则的"下一版"取代它所有已发布的版本。已激活的那一版在新版被明确接纳之前保持激活
（B140 acceptance 第一条）；D796 的 @2 草案从未激活，直接被取代。规则正文用英文，和 `spec/` 一致。

### K1 Messages and classes

> A message is an array whose first element is its type. The types are START, PENDING, DATA, RESOLVED,
> INVALIDATE, COMPLETE and ERROR, and the set is closed. DATA carries one non-SENTINEL payload; ERROR
> carries a non-SENTINEL diagnostic. Every message travels downstream; nothing travels up the graph. Control
> such as pause, demand or restart is not a message type: a controller writes a plain state that its target
> declares as a dependency (P11).

| Old | Change |
|---|---|
| R-msg-format@1, draft @2 | Merged into K1 |
| R-msg-closed-set@1 | Merged into K1. PAUSE, RESUME and PULL leave the set (O2, O8, K9), and so does TEARDOWN (Q4). DS-17 did not classify this rule; the change follows from O2 |
| R-tier@1, draft @2 | Message classes stay as an order (START, PENDING, value, INVALIDATE, terminal), but the kernel no longer sorts an array by them (O13, K2) and batch no longer defers by class (O3, K8). "Tier < 3 dispatches immediately" has nothing left to apply to: class 1 is empty, and PENDING is sent only by the kernel (O11) |
| R-data-payload@1 | Merged into K1 unchanged |
| R-ctx-up@1, draft @2 | Retired (K9, user 2026-11-09) |

### K2 Wave and settlement

> A wave starts from one host input, a batch commit, or a later `ctx.down` (P9), and runs to completion before
> the next request (P7). Each `ctx.down` call is one array; a node's arrays reach each subscriber in order, after
> its function returned. PENDING is sent only by the kernel, as the prefix of each array that carries DATA or
> RESOLVED; a node's own PENDING is rejected. Each PENDING is settled exactly once, by DATA, RESOLVED, INVALIDATE or a terminal;
> a node that announced PENDING and sent nothing gets one RESOLVED from the kernel. A node runs at most once per
> wave, after every dependency that announced PENDING has settled. The kernel delivers every DATA unchanged and in
> order and never merges, drops, substitutes or reorders it. An array keeps its written order: a terminal is
> last, DATA and RESOLVED do not share an array, and an array is split at its last INVALIDATE, dropping what came
> before it. A quiet node consumes its input wave without announcing PENDING and publishes later as a new wave.

| Old | Change |
|---|---|
| R-wave-boundary@1 (active), draft @2 | Merged into K2. Matches @2 and TS: each `ctx.down` is its own array |
| R-dirty-before-data@1 (active), draft @2 | Merged. Drops "including after an earlier standalone DIRTY" (O11) |
| R-two-phase@1 (active), draft @2 | Merged. Drops "batch may announce DIRTY before its later commit" (O3) |
| R-diamond@1 (active), draft @2 | Merged unchanged in meaning; the mixed-time caveat is P9 |
| R-resolved-undirty@1 (active), draft @2 | Merged. Drops the deferred-result author's settlement duty (O11): no PENDING outlives its wave |
| R-terminal-settles-dirty@1 (active), draft @2 | Merged |
| R-same-wave-merge@1, draft @2 | Merged as "a node runs at most once per wave"; arrays from several dependencies are kept apart, not merged (O13) |
| R-output-ownership (draft @1) | Only its non-notification parts merge into K2 (O11) |
| R-undirty-settle-timing@1 (active), draft @2 | Leaves the kernel (O11): with kernel-only PENDING nothing waits to settle. Still to be rechecked for the pause module, where resumeAll can hold a balancing RESOLVED (O11); not done yet |
| R-equals@1 | Nothing to do: it already carries a replace transition to R-resolved-undirty@1 by D49, so it is not current. (The first draft of this proposal wrongly called it still activated; corrected 2026-11-09.) Dedup is sugar |
| H6 quiet boundary (part of R-pull) | Joins K2 as its last sentence. Kept in the kernel because the flagship needs it (DS-17) |

### K3 Subscription and snapshot

> A subscription's first array is START followed by the node's snapshot: the DATA values of its last array that
> had any, then its terminal if it has ended. A new dependent sees the snapshot as one input array. A computed node
> clears its values on INVALIDATE and on deactivation; a state keeps its values until INVALIDATE. A node may be
> given at construction an optional seed of values, terminal and private state, which it holds as if it had sent
> them; its first activation runs its function as usual.

| Old | Change |
|---|---|
| R-push-subscribe@1 (active), draft @2 | Merged. Changed by the user 2026-11-08: the snapshot is the last array, not the last value |
| R-subscription-ownership (draft @1) | Merged |
| R-initial@1, draft @2 | Merged. Drops "initial does not start a source while default PAUSE gates it" (pause module) |
| R-replay-buffer@1, draft @2 | Leaves the kernel: history across arrays is the history module (user 2026-11-08), no kernel option |
| H4 seed | New in K3. Only checkpoint uses it |

### K4 Invocation and ctx

> A node's function is `(ctx) => void`. For each dependency, ctx gives its id, the arrays it delivered to this
> invocation with their boundaries, its terminal if any, and its latest value; plus private state for the current
> lifetime, `down`, an abort signal and cleanup registration. A running function is never reentered. A write from
> a function to one of its own upstream nodes throws; any other request it makes waits until the wave ends (K8).

| Old | Change |
|---|---|
| R-fn-contract@1, draft @2 | Merged. `deps[i].id` is new (added with `rewire`) |
| R-ctx-wave-data@1, draft @2 | Merged. No INVALIDATE absence marker inside an array (O13) |
| R-ctx-state@1 (active), draft @2 | Merged. Drops persist retention and checkpoint capture (checkpoint module reads private state at a wave boundary) |
| R-reentrancy@1 (active), draft @2 | Merged |
| R-first-run-gate@1 (active), draft @2 | Leaves the kernel as sugar. The reference `derived` checks on every run (user 2026-11-08); there is no `partial` option |
| R-dynamic-node@1, draft @2 | Leaves the kernel as sugar |

### K5 Terminals

> COMPLETE and ERROR end a node's output for good. Each kind has an auto or manual policy. Auto ERROR ends the node
> with a dependency's ERROR without running its function; auto COMPLETE follows a run once every dependency has
> ended, for a node with at least one dependency. Manual gives the terminal to the function as input. An ended node
> can still be subscribed, depended on, and added by rewire or replace; its snapshot carries its terminal, it never
> runs again, a host input to it is refused, and a rewire of it is refused. There is no resubscription: restart is a
> module that replaces an inner node.

| Old | Change |
|---|---|
| R-terminal@1 (active), draft @2 | Merged. Two changes: 2×2 policy (O6); P5 relaxed (user 2026-11-08), so R2.2.7.b's refusal of a subscription to an ended node goes. Resubscribable fresh execution goes too (O7) |
| R-deps-terminal@1 (active), draft @2 | Merged. K5 also applies to snapshot terminals at a lifetime's first run |
| R-teardown-terminal-relay@1 (active), R-teardown-complete@1 | Retired with TEARDOWN (Q4, user 2026-11-09). A lifetime ends at the last unsubscribe (K7); a host that wants downstream bridges to settle calls `complete` on the source |

### K6 Invalidation

> INVALIDATE removes a node's retained values and its dependents' records of them, runs the node's onInvalidate
> hooks, runs no function, and is forwarded down the cone once. It carries no PENDING. Only the host or a node's own
> output sends it; nothing sends it upstream.

| Old | Change |
|---|---|
| R-invalidate-idempotent@1 (active), draft @2 | Merged. Drops the resumeAll acceptance and publication split and paused supersession (pause module; user 2026-11-06: INVALIDATE goes out at once and discards what was held before it) |
| R-up-at-source@1, draft @2 | Retired (user 2026-11-08) |
| R-paused-invalidate@1 (active), draft @2 | Leaves with pause |

### K7 Lifetime and cleanup

> A node is active while it has a subscriber or an active dependent. A computed node's activation acquires its
> dependencies and runs its function once on their snapshots; deactivation releases them, runs its cleanups, aborts its signal and drops
> its private state. Every ctx and cleanup belongs to exactly one lifetime, and a request dies with the innermost
> scope it was made in.

| Old | Change |
|---|---|
| R-ctx-lifetime (draft @1) | Merged. Takes the last clause of C-37 |
| R-cleanup-hooks@1 (active), draft @2 | Merged. A registration after close runs once at once (draft @2) |
| R-rom-ram@1, draft @2 | Merged as "a computed node clears, a state keeps" (K3). Drops resumeAll's silent adoption on close |
| `resetOnTeardown` | No option: there is no TEARDOWN, and K3 says what each kind keeps |

### K8 Request order and topology

> Requests made while a wave is being delivered wait until it ends and then run in request order: host inputs,
> subscribe, unsubscribe, replace, rewire and batch. A batch body records host inputs and topology requests and
> delivers nothing; its commit is one wave, and its topology requests run after that wave in request order. A
> throwing body commits nothing; an async function body is refused before it runs, and a body that returns a promise
> commits its synchronous part while the host reporter is told. A nested batch joins the outer one. `replace(id, deps, fn)` closes
> the node's instance and starts a new one under the same id and subscribers. `rewire(id, deps, fn)` keeps the
> instance, its values, private state and subscribers: kept dependencies keep their records, removed ones are
> released, and added ones are acquired and their snapshots given to the function as one input wave.

| Old | Change |
|---|---|
| R-observer-boundary (draft @1) | Merged |
| R-rewire@1 (active), draft @2 | Merged as `rewire`. Changes: an ended dependency may be added (P5); a request from a function is queued (decision 3 of the C-8 replay) |
| R-rewire-batch-boundary@1 (active), draft @2 | Merged. Every topology request in a body waits for the commit, not only when the node has batch output (C-22) |
| R-rewire-deferred@1, R-rewire-deferred-committed-boundary@1, R-rewire-async-live-edge@1 (active), drafts @2 | Retired: rewire runs only between waves, so no dependency record is in flight when the shape changes (O4) |
| `replace` | New. Needed by restart (O7) |

### K10 Node interface and status

> A node has a stable id, a kind (state or node), its declared dependencies and its function. Its status is a
> projection, not stored: cache is empty, stale or ready; output is open, completed or errored; lifecycle is
> inactive, active or closing. The graph can describe its topology as data.

| Old | Change |
|---|---|
| R-node-iface@1, draft @2 | Merged. Execution is no longer a layer: node ⊇ lifetime (O7) |
| R-status-enum@1, draft @2 | Merged as draft @2's projection (user 2026-11-06). TS's settled and resolved have no counterpart |
| R-node-thin@1 | Revised: drop `pause_lockset` from the node's state. DS-17 did not classify this rule |

### K11 Failure routing

> A function's throw becomes that node's ERROR. An invalid output array throws from `ctx.down`. Any other failure
> goes to its caller or to the host reporter, never into an unrelated node's messages.

| Old | Change |
|---|---|
| R-operation-failure (draft @1) | Merged. The host reporter is a callback, not a stored history |

## 3. 模块和 sugar

这些规则离开每个节点的协议。模块的契约放进 `spec/rules.jsonl`，单独一个 area（Q2）。
两个限制让内核仍然能单独读：模块规则可以引用内核规则，内核规则不引用模块（现在已经成立，所有模块都没改内核）；
内核规则集先激活，模块规则以后一个模块一个模块地激活。sugar 留在各语言包。

| Old | Goes to | Status in the reference |
|---|---|---|
| R-pause-lockset, R-pause-modes, R-async-paused (pause clauses), R-paused-invalidate | pause module | Built; C-30, C-31, C-36 pause clauses replayed. Modes became placement (user 2026-11-06) |
| R-async-paused (the deferred-result duty) | Retired | No PENDING spans time (P9, O11) |
| R-pull | demand module (holder on a control pair) and K2 (quiet) | Built; C-32 demand clauses replayed |
| R-up-routing, R-up-routing-diamond | Retired (K9) | — |
| R-replay-buffer | history module | Built |
| R-restore, R-snapshot, R-input-receipts, R-resource-reattach | checkpoint module | Built for recipes, values, terminals and private state; C-38 replayed (6 clauses). Namespaces and native resources not built |
| R-node-revision | revision observer (O9) | Built 2026-11-09 (R-revision, C-39) |
| R-first-run-gate, R-dynamic-node, and dedup (R-equals is already replaced, D49) | sugar, per language | `derived` built; dynamic and dedup not built |
| restart (O7) | restart module | Built; C-34 replayed |

## 4. DS-17 没有归类、但受这些决定影响的规则

| Rule | Why it is affected | Proposed |
|---|---|---|
| R-no-imperative@1 | Says "all coordination uses ctx.up signals". There is no ctx.up now, and a controller calls its target on a declared pair (O8) | Revise: coordination goes through message flow and declared control edges; undeclared imperative triggers stay forbidden |
| R-graph-lifecycle@1, draft @2 | @1's `graph.signal([[PAUSE, lockId]])` needs a PAUSE message | Draft @2 already withdraws `graph.signal`; take @2 |
| R-sentinel@1 (active) | The reference kernel marks absence with `has`, not a sentinel value | Keep: it is about absence being decidable, which still holds; the value stays per language |

The graph-layer and principle rules are unaffected: R-graph-role, R-edges-derived, R-mount, R-describe, R-observe,
R-inspection-set, R-meta-presentation, R-profile, R-clock, R-dispatch-all, R-sync-core, R-handle, R-graph-domain,
R-no-polling, R-no-raw-async, R-data-not-peek, R-primary-api-clean.

## 5. Conformance 场景

按 [REPLAY.md](../../reference/kernel/REPLAY.md) 的逐条结果。

| Scenario | Proposed |
|---|---|
| C-28 | Revise: keep its 6 kernel clauses; drop the standalone-DIRTY prefixes (O11), callback batch rejection (O12), early-DIRTY observer requests and rollback (O3) |
| C-29 | Rewritten as the D797 batch scenario (section 8); its D796 rollback clauses are decided away (O3, O11) |
| C-30, C-31, C-36 | Split: kernel clauses stay; pause clauses move to the pause module's scenarios; C-36's resumeAll INVALIDATE hold changes (decided 2026-11-06) |
| C-32 | Demand module; the routed diamond clause is retired with K9 |
| C-33 | Keep the 5 kernel clauses; public `node.down` and native listener failure are not modeled |
| C-34 | Revise: old registrations detached; next execution becomes the restart module (O7) |
| C-35 | Sugar (first-run gate) and K8 (rewire) |
| C-37 | Rewritten around its last clause, under K7 (section 8); the routing clauses are retired with K9 |
| C-38 | Checkpoint module |
| C-39 | Revision observer (not built) |
| C-8 (activated R-rewire) | Revise for `rewire`: ended dependency accepted, function request queued; the five replay decisions |
| C-22 (activated R-rewire-batch-boundary) | Revise: every topology request in a body waits for the commit |

Every trace in the reference tests can become a scenario. That conversion is the per-runtime owners' work
(B140 Owner routing), not this proposal's.

## 6. 和 TS 基线的差异

这些都是规则修订时要明说的改变，不是参考实现的偶然差异。详细出处在内核和模块的 README。

| Area | Here | TS (`dafc5ae`) |
|---|---|---|
| Upward channel | None | `ctx.up` / `ctx.upNext`; production code sends only PULL |
| PENDING | Named PENDING; sent by the kernel only | Named DIRTY; a node may send it |
| Array order | Written order, split at INVALIDATE | Sorted by tier |
| Batch | Nothing before commit; topology requests wait | DIRTY before commit, rollback compensation |
| Snapshot | Last array | Last value, or `replayBuffer` |
| Ended node | Subscribable and depended on | Subscription throws; rewire refuses it |
| Terminal policy | Auto or manual per kind | Three booleans |
| Restart | Owner module with `replace` | `resubscribable`, `repeat` |
| Rewire | Only between waves | Also mid-wave, with in-flight records |
| `derived` gate | Every run | First run only (`partial`) |
| Combinators | One array per input array or per run | One array per value in merge, withLatestFrom, zip |
| Sink | One array per call | One message per call with metadata |
| Status | Projection | Seven stored values |
| TEARDOWN | None; the last unsubscribe ends a lifetime | A message type, forwarded downstream, with a synthesized COMPLETE before it |

## 7. 用户的决定（2026-11-09）

| # | Question | Decision |
|---|---|---|
| Q1 | Revise B140 in place, or supersede it with a new item? | Revise in place (section 1) |
| Q2 | Where do module contracts live: as module rules in `spec/rules.jsonl` with their own area, or in non-normative module docs until a runtime owner needs them? | In `spec/`, in their own area. Module rules may cite kernel rules, not the reverse; the kernel set is activated first, each module later on its own. Sugar stays per language |
| Q3 | Rename DIRTY to PENDING in the same revision (O15)? | Yes, in this revision. Every kernel rule that names DIRTY is rewritten anyway (22 rules, 53 mentions; 67 in conformance), the meaning narrowed with O11, and the packages are before 1.0. Only this name: RESOLVED and settle stay. The packages and the reference kernel rename after activation, each by its owner |
| Q4 | TEARDOWN: the reference kernel never sends it. Keep TEARDOWN as the graph-destroy message (R-teardown-complete, R-teardown-terminal-relay), or retire it in favor of "the last unsubscribe ends a lifetime"? | Retire it. TS's production code never originates TEARDOWN (it only forwards it, and `firstValueFrom` rejects on it; four test files send it), and R-graph-lifecycle@2 already withdraws `graph.destroy()`'s broadcast. Lost: forcing downstream lifetimes to end while they still have subscribers; the host owns those subscriptions and can end them. Graph disposal stays with R-graph-lifecycle@2, outside this revision |

## 8. 已写进 spec 的草案（2026-11-09）

用户解冻 `spec/` 后，第 2 节的规则作为 D797 引入的草案行加进了 `spec/rules.jsonl`，没有 `activated_by`，也没有给旧规则加
transition。原因：一条规则一旦带了 transition 就离开当前规则集，而 B140 要求新版被明确接纳之前旧版保持有效，所以 transition
等到激活那一步一起加。加完之后当前规则集仍是 23 条，草案从 94 条变成 106 条。

| Concept | Rule id | Replaces at activation |
|---|---|---|
| K1 | R-messages@1 | R-msg-format, R-msg-closed-set, R-tier, R-data-payload; retires R-ctx-up |
| K2 | R-wave@1 | R-wave-boundary, R-dirty-before-data, R-two-phase, R-diamond, R-resolved-undirty, R-terminal-settles-dirty, R-same-wave-merge, R-output-ownership; retires R-undirty-settle-timing |
| K3 | R-subscription@1 | R-push-subscribe, R-subscription-ownership, R-initial |
| K4 | R-invocation@1 | R-fn-contract, R-ctx-wave-data, R-ctx-state, R-reentrancy |
| K5 | R-terminals@1 | R-terminal, R-deps-terminal; retires R-teardown-complete, R-teardown-terminal-relay |
| K6 | R-invalidation@1 | R-invalidate-idempotent; retires R-up-at-source |
| K7 | R-lifetime@1 | R-ctx-lifetime, R-cleanup-hooks, R-rom-ram |
| K8 | R-request-order@1 | R-observer-boundary, R-rewire, R-rewire-batch-boundary; retires R-rewire-deferred, R-rewire-deferred-committed-boundary, R-rewire-async-live-edge |
| K10 | R-node@1 | R-node-iface, R-status-enum |
| K11 | R-failure@1 | R-operation-failure |
| — | R-no-imperative@2, R-node-thin@2 | Revise their @1 (section 4) |

新规则用了新的 id（按概念命名），没有沿用某条旧规则的 id：一个概念合并了好几条旧规则，用其中任何一条的旧名都只说出一部分。
R-up-routing、R-up-routing-diamond 随 K9 退役；R-graph-lifecycle@1 早已有到 @2 的 transition（D794）；R-equals@1 早已有到
R-resolved-undirty@1 的 transition（D49），第一稿说它"仍被 D15 激活"是错的，已改正。**模块规则（2026-11-09）。** 第 3 节的模块各写成一条 D797 草案，`area` 是新值 `module`，正文只引用内核规则：

| Rule id | Replaces at its own activation |
|---|---|
| R-pause@1 | R-pause-lockset, R-pause-modes, the pause clauses of R-async-paused, R-paused-invalidate |
| R-demand@1 | R-pull |
| R-history@1 | R-replay-buffer |
| R-checkpoint@1 | R-restore, R-snapshot, R-input-receipts; R-resource-reattach stays a draft, not yet specified |
| R-restart@1 | Nothing: it is new. Resubscription, which it takes the place of, already goes with R-terminals |
| R-revision@1 | R-node-revision. **Held** (user, 2026-11-09): no consumer yet; not put forward for activation until incremental checkpoints or an agent inspection tool needs it |

revision 观察器（O9）随后补上（[revision.mjs](../../reference/modules/revision.mjs)），规则是 R-revision，C-39 也改写为 D797 版。retry 策略的公式是库的词汇（D130/D132），
不进规则，R-restart 只说"由 retry 策略决定是否、隔多久重试"。switchMap、mergeMap 按 D797 属于 sugar。
场景 C-30（pause）、C-31（state 跨 close 保值、terminal 封存、锁比 pausable 活得长）、C-32（demand）、C-38（checkpoint 和 history）
就地改写为 D797 版。核对时改正了两处说法：terminal 之后排队的写入是被丢弃并交给宿主 reporter，不是抛错；
恢复时私有状态是节点自己拿回来的，订阅者收不到。C-32 里"一个 batch 里两次 pull 只服务一次、用最新的 params"用临时测试跑过。

**Conformance（2026-11-09）。** `spec/conformance.jsonl` 没有版本或 transition 机制，所以按同一个理由分三类处理：

- C-1 到 C-27 不动：它们验证的是当前生效的规则（三种 runtime 都标了 pass），改了就不再对应当前规则；激活时随旧规则的 transition 一起改或退役。
- D796 的内核草案场景就地改写为 D797 版（`ref` 改成 D797，`covers` 指向新规则 id，旧文本在 git 历史里）。它们从未被验证过。
  C-28 改为完整数组、内核加 PENDING 前缀和写入顺序；C-29 改为 batch 在 commit 前不投递、拓扑请求在 commit 之后（C-22 的后继）；
  C-33 改为旧 lifetime 的 ctx 作废、清理函数的失败相互隔离；C-34 改为终止扇出和获取已结束节点；C-35 改为 rewire 保留实例（C-8 的后继）；
  C-36 只保留内核条款；C-37 改为 lifetime 关闭让旧工作作废（原来最后一条）。原来"退役 C-29、C-37"的打算因此不需要了，也就不用给场景发明一个 retired 状态。
- 新增 C-40（已结束节点可以订阅、可以被依赖）、C-41（快照是最后一个带 DATA 的数组）、C-42（消息集合封闭，没有向上的通道）。

C-30、C-31、C-32、C-38、C-39 主要属于模块，留到写模块规则时再改（C-31 里属于内核的三条也在那时拆出来）。
每个新场景的预期都对照参考内核核对过；没有现成测试的几条（C-37 rewire 后迟到输出仍发出、C-40、C-41、C-42 的未捕获拒绝）
用临时测试跑过，并据此改正了两处：宿主的 invalidate 只能用于 state 节点（R-invalidation、R-wave 的写法随之改正），
只把 ERROR 设为 manual 的节点在依赖全部结束后仍会 auto COMPLETE。

**Formal（2026-11-09）。** 用户选了另写新模型：旧模型验证的是当前生效的规则，激活时再退役或缩小，现在不改。
D797 formal 义务里"更新 wave_protocol"因此理解为：现在写 D797 的新模型，激活时处理旧模型；D797 本身不改。
第一个模型 `formal/kernel_wave.tla` 覆盖 R-wave、R-messages、R-invalidation、R-terminals、R-subscription、R-failure，
12 个不变式，两个 wave 58,287 个状态、三个 wave 5,949,762 个状态都通过；13 个变异全部被抓到，一个多余条件按等价删掉。
R-lifetime、R-request-order 留给第二个模型。

不在本提案里：formal 模型（TLA+）的更新、各语言 runtime 的实现、O10（L0.5 和 F-NO-WEDGE-CUT）。它们分别属于
B140 的 Formal、Owner routing 两条和一个单独的决定。
