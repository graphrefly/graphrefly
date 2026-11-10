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
| R-undirty-settle-timing@1 (active), draft @2 | Leaves the kernel (O11): with kernel-only PENDING nothing waits to settle. Rechecked for the pause module 2026-11-09 with `formal/module_pause.tla`: a pending pausable that holds settles with RESOLVED in its wave, so no balancing RESOLVED is held; nothing to keep |
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

> A node is active while it has a subscriber or a dependent that holds it. A computed node's activation acquires its
> dependencies and runs its function once on their snapshots; its lifetime closes when it deactivates or ends, which releases them, runs
> its cleanups and aborts its signal; deactivation also drops its private state. Each run's cleanup registrations replace the previous run's. Every ctx and cleanup belongs to exactly one lifetime, and a request dies with the innermost
> scope it was made in.

| Old | Change |
|---|---|
| R-ctx-lifetime (draft @1) | Merged. Takes the last clause of C-37 |
| R-cleanup-hooks@1 (active), draft @2 | Merged. A registration after close runs once at once (draft @2) |
| R-rom-ram@1, draft @2 | Merged as "a computed node clears, a state keeps" (K3). Drops resumeAll's silent adoption on close |
| `resetOnTeardown` | No option: there is no TEARDOWN, and K3 says what each kind keeps |

### K8 Request order and topology

> Requests made while a wave is being delivered wait until it ends and then run in request order: host inputs,
> subscribe, unsubscribe, replace, rewire and a batch's commit. A batch body runs at once, records host inputs and topology requests and
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
第二个模型 `formal/kernel_lifetime.tla` 覆盖 R-lifetime、R-request-order（激活与释放、lifetime 和清理函数、旧 ctx、请求队列、
batch（包括在 wave 中打开的）、rewire、replace），21 个不变式，三个请求 130,683 个状态、四个请求 5,005,076 个状态都通过；
28 个变异全部被抓到，每个不变式也单独对着它针对的变异检查过。

建模时发现参考内核有三处 D797 草案文字没写到，用户 2026-11-09 逐条决定都按内核写进规则：
1. 每次运行登记的清理函数替换上一次运行的，被替换的不运行（来自 R-cleanup-hooks@1、@2，合并时丢了）。写进 R-lifetime，C-33 加一步。
2. wave 中调用的 batch 立即运行 body，只有提交作为请求等 wave 结束；batch 返回 body 的返回值。写进 R-request-order，C-29 加一步。
   参考内核的外层 batch 原来不返回 body 的结果（嵌套的返回），这次按 TS 改正并加了测试。
3. 节点结束时立即关闭 lifetime：释放依赖、运行清理函数、中止 signal，保留值、终止消息和订阅者（来自 R-terminal@2，合并时丢了）。
   写进 R-lifetime 和 R-terminals，C-34 加一步。TS 现在等最后一个订阅者离开才释放，记入各 runtime 的实现工作。
D797 第 (2)(3)(5)(7) 点相应补了这几句。

模块的第一个模型 `formal/module_pause.tla`：把 `reference/modules/pause.mjs` 的两节点 pausable 放在内核的结算语义上，
和按 R-pause 原文写的 pausable 逐 wave 比较输出，4 个不变式，四个 wave 2,543 个状态、六个 wave 23,306 个状态都通过；
12 个变异全部被抓到。写模型时发现 pause 模块的一个 bug：未暂停时 `[DATA 5, COMPLETE]` 只发出 COMPLETE，DATA 丢了，
ERROR 也一样。已修正（两个节点改用 manual 终止策略，终止跟在同一数组的值后面），加了测试，C-30 加了一步。
R-undirty-settle-timing 对 pause 的复查也由这个模型完成：暂停中的 pausable 每个 wave 都用 RESOLVED 结算，不会扣住。
第二个模块模型 `formal/module_demand.tla`：`reference/modules/demand.mjs` 的 pullable 对照 R-demand 原文，6 个不变式，
五步 12,103 个状态、七步 90,769 个状态都通过；12 个变异全部被抓到；没有发现 demand 模块的 bug。
第三个模块模型 `formal/module_history.tla`：`reference/modules/history.mjs` 对照 R-history 原文。第一版发现草案文字是
源的每个数组发一次列表，模块是每个 wave 发一次（只在计算源一个 wave 发多个数组时不同）。用户选了每个 wave 一次，
并把列表改成 wave 的列表：每项是一个带 DATA 的 wave 的 `ctx.deps[0].waves`（保留 wave 内数组的分隔），n 数 wave 数，
RESOLVED 数组不记。规则文字、模块、测试和模型都按此改了；八步 651 个状态通过，12 个变异全部被抓到。和 TS 的不同：
TS 的 ring 只存值、数的是值，迟到的订阅者收到 n 个单独的 DATA；这里是一个 DATA，值是 wave 的列表。
第四个模块模型 `formal/module_checkpoint.tla` 之前，先拿恢复后的图和原图对比，发现恢复后没跑过的节点没有清理登记
（清理是运行登记的闭包，存不进 checkpoint）：history 恢复后 INVALIDATE 清不掉旧值，定时器 source 恢复后不再 tick；
另外依赖只结束时快照被重复追加。另开会话调研了各系统的做法后，用户选了 A2：上次运行登记过清理的节点在恢复后第一次激活时
跑一次，只给变了的依赖；只结束的依赖只带终止；订阅前的 INVALIDATE 看不到，宿主应先订阅再写上游；R-invocation 加了
"一次运行可能不带新输入"。R-checkpoint、R-invocation、D797、C-38 和模块都按此改了；模型七步 88,981 个状态、九步
304,480 个状态通过，6 个变异全部被抓到。和 TS 的不同：TS 恢复后不跑函数，这些清理也就丢了。
第五个模块模型 `formal/module_restart.tla`：写之前按 R-restart 原文对模块做了探测，发现三处：调过 restart() 后，owner
重新激活时把快照里的旧请求又执行一次；延迟重试等待时外部 restart 开了新 attempt，旧重试仍会再换掉 inner；重试等待时
上游结束，重试照样在结束的上游上起新 inner，owner 以 COMPLETE 而不是 ERROR 结束。前两处用户决定：请求只服务一次
（激活时 restart state 的当前值算已服务），重试属于失败的那次 attempt、别的 attempt 开始后作废；R-restart 补了这两句。
第三处是模块违反现有规则的 bug，已修。模型七步 4,638 个状态、十步 25,974 个状态通过，11 个变异全部被抓到。R-restart 原来没有 conformance 场景，新增 C-43 覆盖它。

不在本提案里：formal 模型（TLA+）的更新、各语言 runtime 的实现、O10（L0.5 和 F-NO-WEDGE-CUT）。它们分别属于
B140 的 Formal、Owner routing 两条和一个单独的决定。

## 9. 激活准备（2026-11-09）

五个模块模型都写完之后，用户选了先做激活准备：把旧规则的 transition、C-1 到 C-27、旧的 TLA+ 模型逐一对照 D797，
找出激活之前还要定的事。这一节只是计划，`spec/` 和 `formal/` 都还没动。

### 9.1 Transition 演练

用一个 scratch 脚本把第 8 节的映射作为 transition 加到 `spec/rules.jsonl` 的副本上，再用 `authority/model.mjs`
算出公开规则集：每条旧规则的每个版本都 replace 到它的新规则，或者 retire；内核那 10 条新规则加上 R-no-imperative@2、
R-node-thin@2 加 `activated_by`。两种做法都没有错误：

| | 激活后的公开规则 | 留下的旧规则 |
|---|---|---|
| 只激活内核 | 16 条 | R-sentinel、R-graph-domain，以及 **R-async-paused@1、R-paused-invalidate@1** |
| 内核加 R-pause 一起激活 | 15 条 | R-sentinel、R-graph-domain |

只激活内核时，R-async-paused 和 R-paused-invalidate 还是公开的，它们讲的是 PAUSE 消息和 pausable 模式，
而 R-messages 已经把 PAUSE 移出了消息集合，公开规则集里会自相矛盾。第 3 节给 R-async-paused 两个去处（暂停部分去 pause 模块、
延迟结果的义务退役），而 transition 只能有一个去处。

激活后没有 conformance 的公开规则：R-node@1、R-node-thin@2、R-no-imperative@2；没有 formal 的：这三条加 R-sentinel@1。
R-first-run-gate@1（现在是公开的）和 R-dynamic-node@1 去 sugar，演练里给的是 retire。

### 9.2 C-1 到 C-27

| 处理 | 场景 |
|---|---|
| 退役 | C-7（K9、TEARDOWN）、C-9、C-10（暂停模式改成位置）、C-18（K9）、C-19（O11）、C-20（TEARDOWN）、C-25（O3、O4、K9） |
| 由新场景接替 | C-2→C-30、C-8→C-35、C-14→C-33、C-21→C-37、C-22→C-29、C-24→C-38、C-27→C-32 |
| 改写 | C-1、C-3、C-6、C-15、C-17（内核）；C-5（pause 模块） |
| 拆分 | C-4、C-11、C-12、C-16、C-23、C-26：内核部分改写或由新场景接替，sugar 部分留给各语言包，路由部分退役 |
| 部分接替 | C-13：(a)(b) 由 C-30 接替，(c) 改写为 pause 模块的场景 |
| 不受影响 | C-1a、C-1b、C-1c（`covers` 为空），但 C-1b 的 wire 帧里有 DIRTY |

27 条里 18 条在内核激活时变；C-2、C-5、C-9、C-10、C-13、C-24、C-27 跟着各自的模块规则激活；C-16、C-26 两边都有。
接替时新场景少了几条：C-35 缺 C-8 的三条（新加的依赖还没有值、拒绝成环、rewire 成零个依赖），C-29 缺嵌套 batch，
C-33 只查 onDeactivation（C-14 还查 onInvalidate 每次运行替换），C-32 缺"没有新输入的 pull 用自己的 params"；
没有内核场景检查 R-wave 的 quiet 节点和内核补的 RESOLVED；没有 pause 场景检查几个 pausable 共用一个锁状态。

### 9.3 旧的 TLA+ 模型

没有一个能原样保留：

| 处理 | 模型 |
|---|---|
| 退役（D797 点名的） | wave_protocol_up_MC、wave_up_source、wave_pull_routing（含 _sib）、wave_pull_routing_diamond、wave_teardown_terminal、wave_protocol_meta_teardown_MC、wave_undirty_settle_timing、wave_rewire_deferred、wave_rewire_deferred_committed、wave_rewire_async_ctx |
| 退役（规则退役或去了模块） | wave_async、wave_async_paused（含各 cfg）、wave_paused_invalidate、pause/bufferall/resubscribe/replay_resubscribe/gap/q14 MC、wave_rewire_emit、wave_protocol_multisink（两个） |
| 由新模型覆盖 | wave_protocol_MC、invalidate 两个 MC、wave_terminal_dirty → kernel_wave；nested MC、wave_rewire、wave_rewire_batch → kernel_lifetime；wave_pull → module_demand；replay MC → module_history |
| 需要改范围 | wave_xgraph（R-graph-domain 还公开、还引用它，但它依赖的"DIRTY 先过 wire"没了）；wave_reentrancy（并入 kernel_lifetime）；wave_deps_complete、rescue MC（并入 kernel_wave 的 manual 策略）；wave_ctx_wave_data；wave_snapshot_restore（它的 RestoredLateSubscribeUsesRestoredCache 和 A2 冲突） |

`wave_protocol.tla` 本身建议退役而不是更新：要改的几乎是每个 action，改完就是 kernel_wave。它的 17 个 MC 都 EXTENDS 它，一起退役。
研究时在 kernel_wave 的副本里让 terminal 不再结算依赖的 pending，NoWedge 在 153 个状态后失败，说明 kernel_wave 确实覆盖了
wave_terminal_dirty（auto 策略下）。

新模型没有覆盖、旧模型查过的性质，按重要性：跨图 diamond（C-1）；内核的 manual 终止策略；函数写自己的上游时抛错；
一个节点有几个订阅者（R-wave 的顺序）；订阅时 START 数组的形状；内核 wave 里的 quiet 节点；checkpoint 的拒绝；
带值的 diamond 里的迟到 `ctx.down`；rewire 的正向路径（新依赖的快照、rewire 后的迟到输出）；pause 的几种变体；ctx 的编码；
R-revision（暂缓）。

formal/README 有两处过时：提到的 `wave_protocol_custom_equals_MC`、`wave_protocol_equals_false_MC` 不存在；
`wave_protocol_q14_MC` 不在文件表里。

### 9.4 激活前要定的事

1. 两条 PAUSE 规则。**已定（用户，2026-11-09）：先指向，后激活。** 内核激活时 R-async-paused、R-paused-invalidate
   （各版本）replace 到 R-pause@1，R-pause 本身不激活，留到它自己激活。演练：公开规则 14 条，无错误。authority model 只要求
   transition 的目标存在，不要求已激活，所以两条旧规则离开公开集，R-pause 仍是草案；每条规则只有一个去处，R-async-paused
   的延迟结果义务在 transition 的理由里说明退役。其他做法：一起激活（违反"模块各自激活"，pause 场景的剩余工作要提前）、
   retire（同样没有 pause 规则，还丢了来龙去脉）、保留（公开规则自相矛盾）。在 R-pause 激活之前公开规则里没有 pause，
   和 demand、history、checkpoint 一样。
2. R-first-run-gate、R-dynamic-node。**已定（用户，2026-11-09）：retire**，理由写"sugar，归各语言包（D797 (9)）"；
   场景里关于 first-run gate 和 dynamicNode 的子句留在各包自己的测试里。不改写成根上的 sugar 规则（违反 D797 (9)），
   也不保留（R-first-run-gate 要求等所有依赖，和 R-lifetime 的"激活时在快照上运行一次"冲突）。
3. 旧模型。**已定（用户，2026-11-09）：退役的模型在激活时删掉**，git 历史保留，formal/README 记下每个旧模型的去向和接替者。
   authority 按 `formal/` 顶层文件里出现的规则 id 算 formal 覆盖，留在原处会把已经失效的模型算成覆盖。五个要改范围的模型
   （wave_xgraph、wave_reentrancy、wave_deps_complete 和 rescue MC、wave_ctx_wave_data、wave_snapshot_restore）在新模型写好前保留，
   作为移植的参照。"退役 wave_protocol 是否完成 D797 的 update 义务"用户早已定过（B140：现有模型在激活时退役或改范围，
   就是这项义务的读法）；激活时在 D797 里补一句 wave_protocol 由 kernel_wave、kernel_lifetime 取代。
4. 激活前要补的覆盖。**已定（用户，2026-11-09）：内核部分都补完再激活。** 场景：C-35 补 C-8 的三条（拒绝成环等第 5 件），
   C-29 补嵌套 batch，C-33 补 onInvalidate 每次运行替换，新增内核 quiet 节点和内核补 RESOLVED 的场景，R-no-imperative 加进 C-42，
   R-node 的 status 推导加一步；R-node-thin 行为上测不出，不给场景，写明原因。模型：kernel_wave 加 manual 终止策略（并入
   wave_deps_complete 和 rescue MC）和 D 的第二个 sink；kernel_lifetime 加函数写自己上游时抛错（并入 wave_reentrancy）。
   模块的缺口（C-32 的 params、pause 共用锁状态、C-5、C-13(c)）随各模块激活再补。
   **进展（2026-11-09）：** 场景都已补（C-29、C-33 含 R-node、C-35、C-42、新增 C-44），各自写成参考内核的测试。kernel_wave
   加了 D 的 manual 策略，随即发现两处内核问题：只有 terminal 的 wave 里 manual fan-in 每个 terminal 跑一次（只有带值的数组
   标记 pending）；auto COMPLETE 的 postlude 单独发出时又标记一次 cone。用户决定带 terminal 的数组和值一样标记 cone、带 PENDING
   前缀，auto 和 manual 一样，INVALIDATE 不带；postlude 和运行的输出一起发出。R-wave、内核、测试、C-36、C-44 都已改，19 个变异
   全部被抓到。kernel_lifetime 本来就把函数写自己上游当作排队的请求（CallbackRequest），只补了说明。多订阅者：两个模型都把
   发给所有订阅者当作一步，加第二个 sink 查不出东西；每个订阅者先收完整个数组的顺序由 C-34 和内核测试固定。
5. 规则文字的缺口。(a) rewire 和 replace 的拒绝（state 节点、重复依赖、自依赖或成环；rewire 已结束的节点，排队的 rewire
   执行时节点已结束也拒绝并告诉宿主）、(b) 新依赖都没有快照时 rewire 不跑函数、(c) INVALIDATE 保留 private state、由
   onInvalidate hook 决定是否清掉：建议照参考内核写进 R-request-order 和 R-invalidation。(d) 函数写自己的上游。
   **已定（用户，2026-11-09）：允许**，当作普通请求，等 wave 结束后执行，在下一个 wave 里触发自己；函数仍不会被重入。
   D797 草案和参考内核原来让它抛错，比 TS（R-reentrancy@1 只禁止同步重入）和 D796 的 R-reentrancy@2（允许已完成 wave 的
   反馈循环，由组合者负责终止）都严格，没有找到用户决定过的记录。这样依赖 holder 的节点可以在函数里 pull（分页），内核少一个
   特例；代价是每次运行都无条件写上游的函数会让 wave 一直跑下去，由组合者负责终止。R-invocation 去掉抛错那句，参考内核去掉
   `wrote its upstream` 检查；第 4 件里 kernel_lifetime 要加的改为"写上游在下一个 wave 生效、不重入"。
6. 跨图。**已定（用户，2026-11-09）：一致性交给 bridge 的按 cause 成组放行。** R-graph-domain 的"two-phase wire gate"
   在 D797 下不成立（PENDING 只作为值数组的前缀，不先行）；C-1b 里 bridge 本来就等同一个 cause 的所有边到齐才放行，
   放行作为对面图里的一次 host batch，跨图 diamond 就只汇合一次。激活时：R-graph-domain 改成这句；`spec/protocol.proto`
   的 MSG_DIRTY 改名 MSG_PENDING，TEARDOWN、PAUSE、RESUME、PULL 的编号标为 reserved，删去 Tier 和 Direction；
   WIRE_EDGE_KIND_DIRTY 改名为 PENDING，说明它是 bridge 协议的预告帧，不是图消息；wave_xgraph 退役，C-1 按成组放行改写，
   bridge 模块写出来时再给它新模型。代价是 wire 不兼容，各语言 bridge 跟着改（和 PENDING 改名一起归各 runtime owner）。
7. 场景的处理。**已定（用户，2026-11-09）：** 改写或拆分后保留的场景保留编号、改写正文、三种 runtime 都重置为 `todo`
   （旧 pass 对的是旧文本），拆出去的 sugar 部分从根场景删去、归各语言包；退役和被接替的场景删掉这些行，和旧模型一样，
   git 历史保留，接替关系记在 9.2 和 D797 里。不新加 `retired` 状态。TS 测试里引用这些编号的地方由 TS owner 改。
8. **已定（用户，2026-11-09）：** (a) 关闭 O10：没有能力因为"旗舰用不着"被丢掉，旗舰不需要的都做成了模块（参考实现、测试、
   TLA+ 模型、场景齐全），去掉的只有 K9 和 TEARDOWN，各有用户的理由；参考实现服务两个无关的领域（B139 旗舰 S1–S8，
   photo-scenes operation tree 的 27 个测试原样通过）；"first kernel"只在 O4 出现，当天已改。D797 补一句，不改规则。
   (b) Evidence gaps 在补完覆盖之后做，不卡激活，B140 结束前完成。(c) 激活用一条新决定 D798（接纳 D797 内核集并激活）
   作为 `activated_by` 和 `transition.by`，像 D794 那样。

### 9.5 接下来的顺序

1. 规则文字：5a–5c 照内核写进 R-request-order 和 R-invalidation；5d 从 R-invocation 去掉抛错，参考内核去掉
   `wrote its upstream` 检查并补测试；R-graph-domain 写一个 D797 的 @2 草案（第 6 件）。
2. 补内核覆盖（第 4 件）：场景和模型，各自跑参考内核、TLC 和变异检查。
3. Evidence gaps（第 8b 件）。
4. 激活（等用户批准 D798）：加 transition 和 `activated_by`；删退役的模型和场景；改写保留的 C-1 到 C-27 并重置为 todo；
   改 `spec/protocol.proto`；D797 补 wave_protocol 的接替说明。

### 9.6 独立审查之后（2026-11-09）

用户请一个 Fable 会话和 Codex 各自从头审查 D797（报告不在仓库里；Fable 的在会话 scratchpad，Codex 的贴在对话里）。
两份独立地指向同几处根源：INVALIDATE 只在有值时生效、只靠 hook 通知（逼出 pause、demand 的双节点和 A2 的一部分）；
每次运行替换清理登记加上没有新输入也运行（latestAsync 的 abort 丢失、A2 和"在途工作不重发"冲突）；控制 state 不是唯一权威
（锁集合在闭包里，命令被存成会重放的 state）；replace 把实例层带了回来。Codex 的 7 个反例都已复现。

已修，与设计无关：restart 不再因为几个依赖里有一个已结束就拒绝重试，只在新 inner 一启动就会结束时不重启（每个依赖都已结束，
或有依赖以 ERROR 结束，R-restart 改了这句）；checkpoint 比较依赖的整个最后数组而不只是最后一个值（R-checkpoint 补了说明）。
checkpoint 在函数被 replace 换掉后仍用旧 recipe（C6）要等身份那一条一起定。

**根源 1 已定（用户）：INVALIDATE 也用 auto/manual 策略。** manual 下 INVALIDATE 是函数的输入（`ctx.deps[i].invalidated`），
函数自己清掉持有的东西、自己发 INVALIDATE；`onInvalidate` hook 去掉；INVALIDATE 也标记 cone、带 PENDING，R-wave 不再有例外。
pause、demand 各成一个节点，history 自己清列表，A2 只剩 onDeactivation。顺带：一个没有值的 state 被 INVALIDATE 时不再开
wave（来源先 apply 再标记）。代价：demand 的 holder 是 quiet 节点，它自己发的 INVALIDATE 现在是下一个 wave，而不是当前 wave
（R-demand 改了这句；要保持当前 wave 得给内核的 quiet 处理加例外）。和 TS 的不同：TS 有 onInvalidate、INVALIDATE 前没有 DIRTY。

**根源 2 已定（用户，2026-11-10）：清理登记改成每个 lifetime 一次的 setup。** 节点可以有一个 setup（`g.node` 的选项），
在每个 lifetime 里、函数第一次运行之前跑一次，用的是那次运行的 ctx；它发的东西算那次运行的输出，抛错和函数抛错一样结束节点，
返回的函数就是这个 lifetime 的清理。setup 跟着节点走，replace 后保留，和策略一样。`ctx.onDeactivation` 去掉，函数不再登记
任何东西，也就没有"按运行替换"、"每次都要登记"和 A2：恢复的节点在首次激活时照常跑 setup，函数只在输入变了时运行。
latestAsync 原来在一次没有新值的运行之后丢掉 abort（复现过），现在跟着 lifetime 的 signal。和 TS 的不同：TS 的
`source(factory, setup)` 已经是这个形状，但 `ctx.onDeactivation` 在 TS 里约有 15 处调用，搬过去是 TS 实现的工作，不是纯加法。

**根源 3 已定（用户，2026-11-10）：`set` 可以接一个函数。** 先提的是单独的 `update(id, fn)`，同一天用户改成并进 `set`（和 React 的 `setState` 一样）：给的是值就直接写，给的是函数，值由它 在这次写入按请求顺序执行时，用 state 当时的值算出，
所以排在它前面的写入它都看得到；在 batch 里看得到之前暂存的写入，在 commit 时算。fn 原样返回拿到的值（Object.is）就不写，
抛错则这次写入失败，在 batch 里整个 commit 不提交；函数本身要当值写时得包一层。pause 的 handle 不再留锁集合，demand、restart 不再有闭包里的计数器：
pause、resume、pull、restart 都是带函数的 set，控制 state 是唯一的一份，恢复后接得上；默认锁名改成随机 id。没有采用"不保留值的
state"：它能去掉 seen，却去不掉锁集合的影子。和 TS 的不同：TS 的 state set 不接函数，锁集合在节点内部。

**C5a 已定（用户，2026-11-10）：restart 的 owner 也持有 inner 的依赖，排在 inner 前面。** inner 一结束就释放依赖（R-lifetime），
没有别人持有的上游原来每一轮都关掉再重开；现在三轮之间上游只开一次。排在 inner 后面不行：激活时 inner 在第一次运行里就结束，
会在 owner 拿到之前先放开上游。不改内核，R-restart 加了一句，C-43 加了上游开关次数的期望。

**根源 4 已定（用户，2026-11-10）：规则写明三层范围，内核加一个读取。** 节点（id 下：订阅者、策略、setup）、实例（从创建或一次 replace
到下一次 replace：依赖、函数、保留的值、终止）、lifetime（一次激活：ctx、私有状态、signal、清理）。终止结束的是当前实例；只有
replace（请求，不是消息）给节点新实例，它的 sink 会再收到 START。R-node、R-terminals、R-subscription 改了文字，R-node 的
"没有 execution 层"删掉。C6：内核加 `definition(id)`（依赖和当前实例的函数，只读），checkpoint 在定义（不只是依赖）和 recipe
当初建的不同时把节点判为 local-only；只换函数的 replace 或 rewire 不再被当作旧 recipe 恢复。没有做 recipe 层的 replace。

接下来按顺序讨论
模块组合（F6）、函数经闭包发请求（F7），最后是数组快照（F4）。
