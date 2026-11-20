# DS-20 operator walkthrough：独立复审与规则对齐提案

2026-11-18，Fable。状态：**用户 2026-11-18 在对话中逐题同意了第 7 节的建议（Q1–Q9），包括 Q1 里延伸到 delay 以外的时间类
operator 的那张表。第 9 节是根决定记录的草稿，第 10 节是 DS-20 的改写草稿，两者都还没有写入或应用。
第 11 节是后来加的：Q10（operator 契约归属）用户已选 (A)，它的决定记录草稿在第 12 节，未写入；Q11 用户也选了 (A)，它是工具
改动，不需要决定记录。** 这是非规范性文档：它不改规则、场景、模型或参考实现，没有写入任何 D#，也不授权任何
runtime 仓库的实现工作。下一步是根仓库把这些选择写成决定，再经 `/spec-amend` 改 `spec/rules.jsonl`、
`spec/conformance.jsonl` 和 `formal/`。

范围：这是根仓库的改动，独立于三个 runtime 正在做的内核迁移。用户的判断是三边的精简会受益于它：恢复、失效和严格模式
各归到一条原则之后，每个 runtime 要实现的特例更少。

复审对象：[DS-20](SESSION-operator-walkthrough.md)（2026-11-18 的快照，未提交）。方法：按
[盲测题单](REVIEW-operator-prediction-exercise.md)分两轮，第一轮只读题单并写下预测，第二轮再读 DS-20、规则和参考实现。

**读了什么。** [spec/rules.jsonl](../../spec/rules.jsonl) 的 R-wave@3、R-invocation@3、R-invalidation@1、R-terminals@1、
R-subscription@3、R-lifetime@2、R-node@2、R-checkpoint@1（已激活）和 R-history@1、R-pause@1、R-restart@1（草案）；
[decisions.jsonl](../../decisions/decisions.jsonl) 的 D798、D799、D802；
[reference/kernel/sugar.mjs](../../reference/kernel/sugar.mjs) 和
[reference/modules](../../reference/modules/) 下的 history、higher-order、pause、checkpoint、restart。
根仓库 head 是 e0b4383。

**没读什么。** 没有核对任何 package runtime（graphrefly-ts、-rs、-py）。distinctUntilChanged、pairwise、scan、buffer、
takeUntil、race、concat、valve、delay 在参考实现里都不存在，所以这些 operator 的行为没有任何运行证据。没有跑
`npm run test:reference`。

**盲测被污染的地方。** 交接消息里带了三处提示，我在第一轮之前已经看到：第 2 题"只有一个还能读到快照"、第 4 题"有多个
合理答案"、第 9 题三种失败的时机。这三处的预测不能算完全盲测。下次只给题单。

**标注约定。** *约定* = 用户在 DS-20 walkthrough 里选的设计，没有 D#，没有规则；*已激活* = 现行公开规则；*草案* = 规则有
`introduced_by` 但没有 `activated_by`；*已验证* = 我自己在参考实现上跑过探针，输出在
[ds20-review-probes](ds20-review-probes/)；*推断* = 我从规则文字推出、没有运行过。

---

## 1. 结论

DS-20 作为设计记录成立，九题里大部分行为可以从规则加一句话定义预测出来。有三类问题需要处理：

1. **两处约定建议改**（用户 2026-11-18 在对话中同意重新考虑）：时间类 operator 恢复后重投快照（Q1），switchMap 在切换
   wave 里先转发旧 inner 的 DATA（Q2）。
2. **五处约定与已激活规则、草案规则或参考实现不一致**（Q4–Q8）。其中三处可以归到 R-checkpoint@1 已经写着的一条原则：
   checkpoint 只存状态，待办写进私有状态，setup 在每次激活时把它重新打开。
3. **题单首段漏了一条前提**：默认策略下任一输入的 INVALIDATE 都撤回节点的输出（R-invalidation@1）。补上之后 merge 和
   mergeMap 的行为可以推出，不需要 operator 级的说明（Q3）。

---

## 2. 第一轮：盲测原答（冻结）

以下是读 DS-20 之前写下的预测，照原样保留，未按第二轮的结果修改。

**1. distinctUntilChanged → pairwise，输入 8, INVALIDATE, 8, 9**
- 预测：distinct 输出 8, INVALIDATE, 8, 9。它的比较基准是"当前值"，被撤回后第二个 8 不算重复，否则源有值而它没值。
- pairwise 记的是"上一次出现"，失效不清除，所以最终订阅者看到 `[8,8]`，然后 `[8,9]`，即 distinct 之后出现一对相等值。
- 失效刚过时新订阅者读不到任何快照，因为 pairwise 还没发过值。
- 另一答案：distinct 记的是"出现过 8"，抑制第二个 8，最终只有 `[8,9]`。
- 缺的前提：distinct 的基准是可撤回的当前值还是历史出现；pairwise 的 prev 是否随失效清空；没发过值的节点是否转发 INVALIDATE。

**2. sum scan 与 history，一个值 v 后失效**
- 预测：scan 的新订阅者读不到快照。它发布的中间结果是从被撤回的值派生的当前值。
- 预测：history 的新订阅者能读到列表，且列表里记有这次失效。它发布的是"发生过哪些 wave"，失效本身是一次发生。
- 由首段推出的部分：scan 的发布值被撤回。
- 首段推不出的部分：scan 内部累加器是否仍含 v（下一个 3 得 v+3 还是 3），以及 history 把失效记成条目而不是清空自己。
  这两条要写进各自的一句话定义。

**3. buffer 与 takeUntil 串联同一信号，同一 wave 内源发 [4,5]、信号发 DATA**
- 预测：buffer 输出 `DATA([4,5])`，触发时冲刷包含本 wave 的载荷。
- 预测：takeUntil 只输出 COMPLETE，同 wave 的 `[4,5]` 不转发，停止信号优先。
- 另一答案：takeUntil 先转发 `DATA([4,5])` 再 COMPLETE；或 buffer 按"until 不含当刻"只冲刷之前的内容，4、5 留到下一批。
- 缺的前提：同一 wave 内数据输入与控制输入没有跨输入顺序，谁先生效需要一条 tie-break，并说明是全局规则还是逐 operator 规则。

**4. merge / mergeMap / race / concat**
- merge 与 mergeMap 预测：晚到的订阅者都能看到 B。当前值来自 B，A 撤回的是一个已被取代的值。
- 另一答案：任一输入失效就让节点失效，两者都读不到。
- 如果两者结果不同，首段推不出来，需要 operator 级的说明。
- 缺的前提：失效按"任一依赖"传播，还是按"当前值的来源"传播。
- race 预测：B 不能赢。选择属于执行进度，不随失效回退；race 转发 INVALIDATE，之后只听 A。
- concat 预测：B 只在 A COMPLETE 之后订阅，失效不是终止，不会推进。

**5. switchMap 同 wave 切换；valve 与 pause**
- 预测：旧 inner 在切换那个 wave 里的 DATA 不可见，只有后继 inner 的输出可见。
- 这与第 3 题是同一个缺口。若规则是"数据先于控制"，旧值会先发出再切换。
- valve 预测：失去控制值后关闭。"开"需要一个在场的值，失去它就失去许可；已发出的值不撤回，关闭期间的数据丢弃。
- pause 预测：锁表变空就恢复，持有的两个数组按原顺序补发，保持为两个数组，不合并。
- 两者方向相反，原则相同：控制事实不在场，它的效果就不在场。
- 缺的前提：补发是两个 wave 还是一个；valve 关闭时是否撤回自己的输出。

**6. reduce(sum, 0) 与 catchError（替换流为空且正常完成）**
- catchError 在前：reduce 看到 4, 5, COMPLETE，输出 `DATA(9)`、COMPLETE。ERROR 只有 catchError 看到。
- catchError 在后：reduce 看到 ERROR，不发 DATA，转发 ERROR；catchError 换成空流，最终只有 COMPLETE，没有 9，也没有种子 0。
- 这题我认为完全可由首段加两个 operator 的常规定义推出。

**7. delay → scan，总数 7，送入 3，冷恢复后静等一个完整 delay**
- 预测（由"fresh"加第 4 题"激活时可见保留值"推出）：激活时源的保留值 3 会重新进入全新的 delay。
- 发出前 capture：订阅时读到快照 7，一个 delay 后出现新的 DATA wave 10。
- 发出后 capture：订阅时读到快照 10，一个 delay 后出现新的 DATA wave 13，即重复计数。如果真是这样，值得重新考虑。
- 另一答案：恢复出的保留值只是快照，不作为一次出现重投。前者永远停在 7（在途的 3 丢失），后者停在 10。
- 缺的前提：冷恢复后的激活是否把保留值当作一次 DATA 出现投给 operator。

**8. latestAsync 报表任务**
- 普通调用，等待中 capture：在途调用丢失，恢复后重新提交 1 次，结果交付 1 次，下游计数 1。
- 普通调用，发布后 capture：取决于第 7 题的前提。若重投，则再提交 1 次、再交付 1 次、计数 2；若不重投，则 0 提交、无新
  wave、计数保持 1。
- 可恢复工厂，等待中 capture：按身份查到已完成，0 次新提交，交付 1 次，计数 1。
- 可恢复工厂，发布后 capture：0 次新提交，不再交付，计数保持 1。
- 假设：结果存在服务端，按任务身份可查，寿命长于恢复；"已发布"标记与发布在同一次 capture 里。
- 与第 7 题的联动：如果恢复不重投，"普通调用、等待中"会 0 提交并永远挂起，除非快照里记了 pending。两题必须共用同一条规则。

**9. 三种失败（时机已被提示）**
- 替换成无法重建的匿名回调：在替换调用时同步失败，原节点继续工作，图不变。关闭 checkpoint 的图上同样的替换成功。
- 必需值不是 JSON：在 capture 时失败，不产出部分快照，运行中的图不受影响。
- 目标环境缺工厂：在 restore 时失败，错误指明缺哪个工厂，不留下半恢复的图，快照本身仍可在别处使用。
- "之后可观察到什么"是我自己的预测：三者都应是原子失败。

---

## 3. 第二轮：逐题核对

| 题 | 盲测结果 | DS-20 约定 | 证据 |
|---|---|---|---|
| 1 | 命中 | `[8,8]`，`[8,9]` | 仅约定；参考实现没有这两个 operator |
| 2 | 方向命中（有提示）；细节错 | history 保留列表，scan 撤回输出 | R-history@1 草案和参考模块相反：清空列表（已验证 P5） |
| 3 | 命中 | buffer 发 `[4,5]`，takeUntil 只发 COMPLETE | 仅约定 |
| 4 | merge、mergeMap 未命中；race、concat 命中 | 任一输入失效都撤回输出 | merge、mergeMap 已验证（P1a、P2）；race、concat 无实现 |
| 5 | switchMap 未命中；valve、pause 命中 | 旧 inner 的 DATA 先转发再切换 | switchMap、pause 已验证（P3、P4）；valve 无实现 |
| 6 | 命中 | `[DATA(9), COMPLETE]`；仅 COMPLETE | 推断：由 R-terminals@1 推出，未运行 |
| 7 | 命中约定 | 10 和 13 | 已激活的 R-checkpoint@1 给出 7 和 10（已验证 P6：输入未变时函数不运行） |
| 8 | 四格中三格命中 | 普通调用发布后恢复：不重跑 | 参考实现在等待中无法 capture（已验证 P7） |
| 9 | 命中（有提示） | 创建或替换时拒绝 | R-checkpoint@1 和参考实现在 restore 才失败（已验证 P8） |

每处不一致的最小反例和归类：

**第 2 题，history 不记录失效。** 我以为列表会记下这次失效，实际 R-history@1 规定没有 DATA 的 wave 不成条目。最小反例：
v、INVALIDATE 之后，按约定 history 读到 `[[["v"]]]`，源读不到值，读者会把 v 当成最新值。归类：一句话定义要写明；是否改
用默认策略见 Q6。

**第 4 题，merge 和 mergeMap。** 我按"当前值的来源"预测，实际是任一输入失效都撤回。最小反例：A 发 a1，B 发 b1，A 失效，
晚到的订阅者收到 `[START]`。归类：可由 R-invalidation@1 的默认策略推出，题单首段漏了这条前提，不需要新的选择。DS-20 的
失效表里缺 merge、race、concat 三行，可以直接按规则补上（Q3）。

**第 5 题，switchMap。** 我按 takeUntil 的同一逻辑预测"新选择优先"，实际约定是先转发旧 inner 的 DATA。最小反例见 Q2。
归类：维护者选择，建议重新考虑。

**第 7 题，约定与已激活规则不同。** 我的主预测命中了约定（10 和 13），但已激活的 R-checkpoint@1 给出的是我的"另一答案"
（7 和 10）：输入未变时函数不运行，在途工作丢失。DS-20 自己也写了"R-checkpoint@1 的一般规则本身不实现 fresh temporal
recovery"。归类：约定与规则冲突，建议改约定（Q1）。

**第 8 题，普通调用发布后恢复。** 我沿第 7 题的逻辑预测"重跑、计数 2"，约定是"不重跑、计数 1"。这个不一致正是第 7 题和
第 8 题之间的不一致：同一份 DS-20 里，delay 把未变的保存输入当作新出现，latestAsync 不当。最小反例：`delay(100)` 和
`latestAsync(x => sleep(100).then(() => x))` 恢复前等价，发布后 capture 再恢复，一个得 13，一个得 10。

---

## 4. 改变时序再预测

第 4 题改成 merge 此前没有订阅者：同样是 A 发值、B 发值、A 失效，然后第一个订阅者到来。

- 读完规则后的预测：能读到 B。依据是 R-lifetime@2，激活时函数在各依赖的快照上运行一次，A 没有快照，B 有。
- 已验证（P1b）：`first <- m: [START, DATA("b1")]`。有订阅者时（P1a）是 `late <- m: [START]`。
- 含义：merge 的快照是"它最后发出的数组"，不是"各输入里最新的值"。用户 2026-11-18 同意把这句写进定义（Q3）。

---

## 5. 三类结论

**能从共同原则推出的**

- 第 6 题全部，不需要按位置写规则。
- pairwise 的 prev、scan 的累加器在失效后保留：R-invalidation@1 "keeps its private state"。
- merge 和 mergeMap 的撤回：R-invalidation@1 的默认策略，两者结果相同。
- race 和 concat：选择和当前源属于执行进度，不随失效回退。
- valve 关闭、pause 释放：控制事实不在场，效果就不在场。两题我都盲测命中。

**需要写进 operator 一句话定义的**

- distinctUntilChanged：比较基准是"当前保留的输出"。默认策略会保留私有状态里的基准，所以这是手动策略，推不出来。DS-20 表里
  的 "last emitted value" 有歧义，可以读成"历史上最后发出的值"。
- history：如果保留 DS-20 的约定，它是唯一一个源失效后不撤回输出的 operator，而且列表不标记撤回。
- buffer 的冲刷包含本 wave 的源 DATA；takeUntil 的停止信号先于同 wave 的源 DATA。DS-20 自己已说明没有全局规则能解释。
- pause 释放的形态：一个 wave，保留数组边界。
- merge 的快照是它最后发出的数组。

**建议重新考虑的**

- 时间类 operator 恢复后重投快照（Q1）。
- switchMap 在切换 wave 里先转发旧 inner 的 DATA（Q2）。

---

## 6. 规则：约定与现行规则的不一致

下面的英文措辞都是**草案**，只为让第 7 节的选择具体可读。它们不是规则，修订要走 `/spec-amend`。

| # | 约定（DS-20） | 现行规则或实现 | 规则状态 | 判定 |
|---|---|---|---|---|
| a | 时间类 operator 恢复后把依赖快照当新出现重投 | R-checkpoint@1："its recipe function runs once if a dependency no longer holds what the node had received, and otherwise does not run" | 已激活（D802） | 约定与规则冲突 |
| b | 普通 latestAsync 等待中 capture，恢复后重新启动 | R-checkpoint@1："Work in flight at capture is lost: it is neither resumed nor re-issued"；D802 把它列为用户确认过的限制 | 已激活 | 约定与规则冲突；采纳约定需要部分取代 D802 的这条限制 |
| c | 待重试项恢复后等满延时 | R-restart@1："a restored owner whose inner had ended … renews it at its first activation" | 草案 | 约定与草案冲突 |
| d | history 在源失效后保留可读列表 | R-history@1："an INVALIDATE from the source clears the node's value and the list" | 草案 | 约定与草案冲突；也推翻 D802 理由里"恢复的 history 在失效后留着旧条目是缺陷"的说法 |
| e | 无法重建的定义在创建或替换时被拒 | R-checkpoint@1："is local-only, and restoring it fails"；参考实现 capture 时写出 `local: true` | 已激活 | 约定与规则冲突 |
| f | checkpoint 是建图时的开关，关闭的图拒绝 capture，恢复专用记录按开关分配 | R-checkpoint@1："keeps no record of its own: capture(g) saves an ordinary graph"；R-node@2："the kernel stores it and never reads it" | 已激活（D799、D802） | 约定与规则冲突 |

**一条已有的原则可以收拢 a、b、c。** R-checkpoint@1 已经写着："At a restored node's first activation its setup runs, as
at every activation, so what it opened outside the graph is opened again"，并且私有状态会被保存。所以待办可以是状态：
节点把待办记在私有状态里，setup 在恢复后的首次激活读到它并重新打开，计时从头开始。已验证
（[history-auto-and-setup-reopen](ds20-review-probes/history-auto-and-setup-reopen.mjs)）：恢复后输入未变，函数没有运行，
setup 运行并读到了保存的队列 `[3]`。

按这条原则：

- a：delay 的队列留在私有状态，setup 重新计时，不重投快照。发出前和发出后 capture 都得 10，多个在途项也不丢。
- b：latestAsync 把"等待中"记成 JSON 标记，setup 看到标记就启动任务。"发布后不重跑"由已激活的"输入未变则函数不运行"
  直接给出，不需要新规则。
- c：失败次数已经在私有状态里，setup 为同一次尝试重新计满延时。

R-checkpoint 需要改的只有一句。草案措辞：

> Late output in flight at capture is lost, and checkpoint neither resumes nor re-issues it. Work a node must not lose is
> part of its private state: the node records what is pending there, as JSON, and its setup opens it again at the
> restored node's first activation, as at every activation. Elapsed time is not kept, so a reopened timer runs its full
> duration.

R-restart@1 草案的对应一句，草案措辞：

> A restored owner whose inner had ended was waiting for a retry: its setup starts that retry's delay again in full, for
> the same attempt and without counting another failure, and the usual checks apply when it fires.

**d 的草案措辞（若选 Q6 的推荐）。** history 改用默认策略，R-history@1 的那一句变成：

> The list is the node's private state and the node has the auto INVALIDATE policy (R-invalidation): an INVALIDATE from
> the source removes the node's value and keeps the list, so the next wave with DATA sends the list with its earlier
> entries; deactivation drops it, and a checkpoint saves it.

**e 的草案措辞（若选 Q7 的推荐）。**

> A computed node whose instance carries no recipe, because it was built or replaced without one, is local-only: capture
> is refused and names the node. A recipe whose factory the restoring registry lacks fails at restore, which names the
> node and the reference before any graph is returned.

---

## 7. 决定：待用户定的问题

每题给出选项、建议和代价。用户 2026-11-18 在对话里的答复照原话记在题下。这些答复还没有写成 D#。

### Q1. 时间类 operator 恢复后怎么处理待办

- (A) 约定：队列和候选丢弃，把依赖快照当新出现重投。
- (B) 保留待办，重置计时，不重投快照。**建议。**

最小反例：`source → delay → scan(sum)` 在空闲时 capture，没有任何在途项。按 (A)，每恢复一次，总数就多加一次最后的值；
空闲是最常见的 capture 时机。按 (B)，空闲 capture 再恢复不改变任何值。

用户："都同意"（对"值得重新考虑的"两项）。我在对话里只对 delay 给了具体做法。把它延伸到其它时间类 operator 是我的
推断，所以单独问了一次：

| operator | 恢复后保留 | 恢复后重置 |
|---|---|---|
| delay | 待发队列（含排队的 INVALIDATE 和正常 COMPLETE） | 每项的计时，从头计满 |
| debounce | 候选 | 安静间隔，从头计满 |
| auditTime | 候选 | 窗口，从头计满 |
| bufferTime | 已收集的载荷 | 窗口，从激活重新开始 |
| throttle | 无待办 | 抑制期丢弃；不把快照当作新出现重新放行 |
| timeout | 无待办 | 期限，从激活重新开始 |

用户："按建议定"（对这张表）。

### Q2. switchMap 在切换 wave 里旧 inner 的 DATA

- (A) 约定：先转发旧 inner 的 DATA，再应用新选择。参考模块现在是这样（已验证 P3）。
- (B) 新选择优先，旧 inner 在切换 wave 里的 DATA 不转发。**建议。** 只影响 switchMap；mergeMap、concatMap 的 inner 不被
  取代，继续先转发。

最小反例：`viewA = derived(tab, data)`，`switchMap(tab, t => t === "a" ? viewA : viewB)`。tab 从 a 变成 b 的那个 wave 里
viewA 也会重算。按 (A)，下游先收到一帧"用 tab=b 算出的 viewA"，再收到 viewB。takeUntil 和 valve 在同样的冲突里都让控制方
优先；(A) 还让"switchMap 等于每个 inner 接一个 takeUntil(下一个 outer)"这个等式不成立。

用户："都同意"（重新考虑）。

子问题：旧 inner 在切换 wave 里的 ERROR。建议同样不转发，与 latestAsync "抑制过期的成功和错误"一致。

用户："同意"（对"不转发"）。这个子问题只在 (B) 下存在，所以我把它读作 (B) 连同 ERROR 不转发一并同意。

### Q3. merge 的定义和失效表的三行

建议在 merge 的一句话定义里写"它的快照是它最后发出的数组"，并在 DS-20 的失效表里补 merge、race、concat 三行。这三行
由 R-invalidation@1 推出，不是新选择：

- merge：任一输入的有效 INVALIDATE 撤回输出，即使输出来自另一个输入。
- race：选定之后只有胜者还是依赖，只有它的失效撤回输出；选择不回退。胜者在 race 激活之前就已失效的话，它没有快照，
  别的输入可以赢。
- concat：当前源的失效撤回输出；只有当前源的 COMPLETE 才订阅下一个。

用户："好"（对 merge 的那一句）。

### Q4. 普通 latestAsync 等待中 capture，恢复后是否重新启动

- (A) 现行规则：在途丢失，恢复后节点一直等新输入。
- (B) 约定：恢复后重新启动，可恢复工厂按任务身份查找。**建议**，实现方式按第 6 节：等待中记成私有状态里的 JSON 标记，
  setup 重开。

代价：R-checkpoint 改一句（第 6 节的草案措辞），并部分取代 D802 里用户确认过的"work in flight at capture is lost"。
"在途丢失"对没有记录待办的节点仍然成立。

用户："同意"。

附带的实现事实：参考实现的 latestAsync 把 AbortController 放在私有状态里，所以这个节点一旦收到过输入就无法 capture
（已验证 P7）。它是生命周期资源，不该在那里。sugar.mjs 自己写明它不是选定的 operator 集。

### Q5. 待重试项恢复后是立即重建还是等满延时

- (A) R-restart@1 草案和参考模块：首次激活时立即重建 inner。
- (B) 约定：为同一次尝试等满延时，不多计一次失败。**建议。**

理由：恢复会保留失败次数，(A) 等于一次没有退避的重试。进程反复崩溃重启时，这正好绕过了退避。R-restart@1 还是草案，
改动成本最低。停用再激活的路径不变：那时私有状态已丢弃，按新 inner 开始。

用户："同意"。

### Q6. history 在源失效后

- (A) R-history@1 草案和参考模块：清空列表，撤回输出。
- (B) 约定：保留列表，输出仍可读。history 成为唯一一个源失效后不撤回输出的 operator。
- (C) 默认策略：撤回输出，列表留在私有状态，下一个 DATA 发布完整列表。**建议。**

(C) 的理由：history 就是"按 wave 拼列表的 scan"，不再是例外，也不需要手动策略；`history(n)` 和用 scan 拼出的同样列表
在失效后行为相同。已验证（探针 U）：v、INVALIDATE、w 之后发出 `[[["v"]],[["w"]]]`。(B) 和 (C) 还都消除一个现有的差异：
恢复后的 history 看不到订阅前的失效（R-checkpoint@1 接受的限制），列表本来就不清空的话，恢复前后行为一致。

(C) 的代价：失效之后、下一个 DATA 之前，新订阅者读不到列表。如果这段空档里必须可读，选 (B)，并把它写成唯一的具名
例外，同时写明列表不标记撤回。

(B) 和 (C) 都推翻了 D802 理由里"a restored history kept stale entries after an INVALIDATE"是缺陷的说法，记录决定时
要写明是有意为之。

用户："同意"（(C)）。

### Q7. 无法重建的定义在什么时候被拒

- (A) 现行规则：capture 写出 local 标记，restore 时失败。
- (B) capture 时拒绝并指明节点。不需要开关。**建议作为基线。**
- (C) 约定：开启 checkpoint 的图在创建或替换时拒绝。**建议作为 (B) 之上的可选严格模式。**

(B) 的理由：capture 现在明知节点无法重建，仍写出一个注定不能恢复的快照（已验证 P8），而它对非 JSON 值是当场拒绝的。
(C) 多出的好处是替换被拒后图仍可 capture，代价是图要声明意图。(C) 里内核只检查 recipe 是否存在，配置内容仍由 capture
校验，R-node@2 的"内核不读 recipe"只需加一句存在性检查。

用户："同意"（(B) 为基线，(C) 为可选严格模式）。

### Q8. checkpoint 开关的范围

- (A) 约定：建图时的开关，默认关；关闭的图拒绝 capture；恢复专用记录按开关分配。
- (B) 开关只是 Q7 (C) 的严格模式；任何图都可以 capture；不按开关分配记录。**建议。**

理由：DS-20 自己写了省下的内存和速度没有测过。采纳 Q1 和 Q4 之后，待办是普通私有状态，几乎没有只为恢复而存的记录。
D799 把 checkpoint 改成"不保留自己的记录"，是因为那份独立记录造成过三个缺陷（批量回滚丢 recipe、restart 重建的 inner
跳过运行、替换后 setup 与 recipe 不一致）。按 (B)，开关只决定什么时候发现问题，不改变图的行为；DS-20 的探针"两个等价
的 sum scan 在开和关下输出相同"自动成立。

用户："同意"（(B)）。

### Q9. 严格模式下，wave 中途动态 inner 被拒时怎样呈现

只在 Q7 选了 (C) 时需要。DS-20 写了动态构造的 inner 也要校验，没写拒绝怎样呈现。

- (A) 按 R-failure 当作发出请求的那个函数抛出，该分支 ERROR，与"project 抛出则分支 ERROR"一致。**建议。**
- (B) 向 host 抛出，图不变。

注意：replace 在 wave 中是排队到 wave 结束才执行的请求。要让拒绝落在发出请求的函数里，校验必须在请求发出时同步做。

用户："同意"（(A)）。

---

## 8. 工作：候选项

这些是候选，不是已接纳的工作，也没有新建任何 D# 或 backlog 条目。根决定写成之后，由各自的 owner 接纳。

| 候选 | owner | 依赖 | 验收 |
|---|---|---|---|
| 根决定：记录 Q1–Q9 的选择，写明对 D802 限制的部分取代 | 根 | 用户批准记录的写法 | 决定进 `decisions/decisions.jsonl`，`authority:check` 通过 |
| R-checkpoint@2：在途工作一句（Q4）、local-only 在 capture 被拒（Q7）、严格模式（Q7、Q8、Q9） | 根，`/spec-amend` | 根决定 | 规则修订、C-38 更新、`module_checkpoint.tla` 覆盖 capture 拒绝和 setup 重开 |
| R-history@1 草案改写（Q6） | 根 | 根决定 | 草案、`reference/modules/history.mjs`、`module_history.tla`、C-45 一致 |
| R-restart@1 草案改写（Q5） | 根 | 根决定 | 草案、`reference/modules/restart.mjs`、`module_restart.tla`、C-43 和 C-46 一致 |
| 参考实现：switchMap 新选择优先（Q2），capture 拒绝 local-only（Q7），latestAsync 的私有状态改成 JSON（Q4） | 根 | 对应规则 | `npm run test:reference` 通过，新增每条行为的测试 |
| DS-20 更新：恢复方向里时间类一条（Q1）、高阶同 wave 一条（Q2）、失效表补三行（Q3）、history 一行（Q6）、recipe 和开关两节（Q7、Q8） | 根，DS-20 的作者 | 用户决定 | DS-20 与决定一致 |
| operator 一句话定义：第 5 节"需要写进一句话定义的"各条 | 各 package | 文档方向（DS-20 已约定） | 每条有一个共享场景链接 |
| 各 runtime 的行为核对 | 各 package | 上面各项 | `/conformance`，带源码绑定的证据 |
| operator 契约集：文件、记录形状、解析器视图和链接检查；把 DS-20 选定的 operator 和 Q1–Q3 写成契约和规范轨迹（Q10） | 根 | 第 12 节的决定写入 | 契约集存在并被检查；各 package 的 operator 文档链接到它；B140 验收文字改写 |
| 按部分生成现行规则视图，场景级别由 `covers` 派生；引用方向和场景覆盖两个检查（Q11） | 根，authority 和 dashboard 工具 | 用户批准实现 | 视图进入生成的 authority 报告；两个检查报出 R-graph-domain 引用 R-bridge 和七个无覆盖场景，各有处置 |

缺的证据：没有任何 package runtime 的结果；参考实现里没有的 operator 没有运行证据；第 6 题只是推断。

---

## 9. 根决定记录草稿（已作为 graphrefly:D812 入账）

**已入账（2026-11-18）。** 用户对本节末尾的五点答"都按建议"。入账的是 graphrefly:D812，以账本为准；和下面草稿的差别
只有编号、第 (5) 点加了一句"恢复出的图不默认开启这个选项"，以及正文里记了五点已确认。DS-20 的 `locks` 是 D812 和 D813。

第 5 点选的是 (iii)，所以先改了账本解析器（提交 fef41f9）：被部分取代的决定，对后继没有列出的事项仍然现行。**我在第 5 点
里写的"对今天的账本只有一处效果"不完整，那是只看根仓库量的。** 带上五个兄弟仓库之后，另有 13 条 package 自己的决定因为
同样的规则留在现行集合里（ts 10 条、py 2 条、rs 1 条），跨仓库的现行集合从 693 条变成 708 条。它们都是被自己仓库里的
部分取代留下了剩余事项，规则对它们的处理和对 D806、D807 一样；`authority/check.mjs --workspace` 的输出现在列出这 15 条。
如果某一条其实是后继换了事项名、已经整个接管，那要由它的 owner 把后继改写成全部取代。

入账后的派生视图：D802 不再现行；D808 仍然现行，管它剩下的四个事项；`protocol.checkpoint-recovery` 由 D812 管，D808 在
这个事项里没有被改的选择仍然有效，D812 的 `spec_amend` 写明了这一点；没有事项失去归属；`ambiguousCurrentGovernors` 仍是 4。

**随后做完的（2026-11-18，工作项 graphrefly:B145）。** 规则文字经用户确认后写入并激活（R-checkpoint@2、R-node@3；
R-history@1、R-restart@1 原地改写，仍是草案）；场景 C-38、C-43、C-45、C-46 改写，新增 C-50；三个模型通过 TLC，变异记在
`formal/README.md`；参考实现六处改完，500 个测试通过；DS-20 正文按第 10 节改了九处。用户另外确认了 restore 点名缺失
recipe 的引用，这改了共用 fixture 的一条期望，记在 D812 的理由里。给三个 runtime owner 的说明在
[HANDOFF-D812-runtime-owners.md](HANDOFF-D812-runtime-owners.md)。B145 留在 in-progress：这些改动还没有经过独立 QA。

用户 2026-11-18 要求起草。下面是 Q4–Q9 的一条根协议决定的草稿，**没有写入 `decisions/decisions.jsonl`**，`D-next` 是
占位。写入、给 DS-20 的 `locks` 加上它、再走 `/spec-amend`，都要等用户看过草稿之后。

**2026-11-18 复核（用户："回到 DS-20"）。** 草稿在现在的账本上重新核对过，有三处变化：

- **编号。** D810、D811 已被清理提案用掉，这两条入账时会是 D812 和 D813。
- **草稿漏了 D808。** 第 (4) 点把 local-only 节点的拒绝从 restore 挪到 capture。D808 第 (5) 点写着"JSON refusal precedes
  local-only restore refusal"，C-38 写着"a JSON local-only capture still fails at restore"，三个 runtime 共用的
  `spec/fixtures/d797-rereview.v1.json` 里有这条拒绝的原因文字。原草稿只取代 D802，没有提这三处。下面的 JSON 已改：
  `supersedes` 加上 D808，concern 加上 D808 管着的 `protocol.checkpoint-recovery`，第 (4) 点写明顺序不变（JSON 拒绝在前）
  和旧 checkpoint 仍在 restore 失败，`spec_amend` 和场景义务补上 fixture 和 C-38 那一句。
- **这引出第 5 点，见本节末尾。**

试跑在带五个兄弟仓库的副本里重做过：两条记录以 D812、D813 追加，三个检查带和不带 `--workspace` 都以 0 退出。

**分类。** 持久决定；语义性的协议决定；唯一 owner 是根账本（`graphrefly` / `durable-root`）。一条记录，不是六条：它们是
同一次复审对同一组模块规则的对齐，D799 和 D802 也各自把几项选择合在一条里。

**试跑。** 把这条记录以 `D810` 追加到仓库的一份临时副本，并把 DS-20 的 `locks` 设成 `["D810"]`，`node authority/check.mjs`
和 `node dashboard/build.mjs --check` 都以 0 退出。`ambiguousCurrentGovernors` 仍是 4，和现在一样：`protocol.snapshot-recovery`
原本由 D797、D799、D802 并列，D802 被取代后换成这条记录，仍是三条并列。试跑只检查了记录的形状和取代关系，没有检查规则
修订本身。

```json
{
 "id": "D-next",
 "layer": "L4 / module recovery and invalidation after the DS-20 review",
 "date": "2026-11-18",
 "question": "Where the operator walkthrough's agreed recovery and invalidation choices differ from R-checkpoint@1 and the draft history and restart rules, which side changes?",
 "decision": "Six choices, each the user's, made on 2026-11-18 on the independent review of DS-20 (sessions/active/PROPOSAL-DS20-operator-review-reconciliation.md, Q4-Q9). (1) Pending work is state. A node that must not lose pending work across a checkpoint records it in its private state, as JSON, and its setup opens it again at the restored node's first activation, as at every activation; elapsed time is not kept, so a reopened timer runs its full duration. Checkpoint itself still neither resumes nor re-issues late output in flight at capture, and a node that recorded nothing still loses it. So an ordinary latestAsync whose job was pending at capture starts a fresh job for its unchanged input, a resumable factory looks its job up by the saved identity, and a result already published is not run again, which the unchanged-input rule already gives. (2) A restored restart owner whose inner had ended starts that retry's delay again in full, for the same attempt and without counting another failure, instead of renewing the inner at its first activation. Deactivation is unchanged: it drops the private state and the next activation starts a fresh inner. (3) History has the auto INVALIDATE policy: a source INVALIDATE removes its value and keeps the list, and the next wave with DATA sends the list with its earlier entries. (4) Capture refuses a graph that holds a local-only computed node and names the node; the JSON refusals still come first. This moves the refusal that D808 (5) and C-38 place at restore: the shared reason text in spec/fixtures/d797-rereview.v1.json is unchanged and becomes a capture reason. A checkpoint that already holds a local-only node, as one written before this decision, still fails at restore, as does a recipe whose factory the restoring registry lacks, which names the node and the reference before any graph is returned. (5) A graph may be created to require a recipe on every computed instance. Node and replace then refuse an instance without one when the request is made, and the current instance and its subscribers stay as they are; the kernel checks only that a recipe is present and still never reads it. This is the whole checkpoint option, off by default: every graph can be captured, and no record is kept or dropped by it. (6) Under that option a refusal raised while a function is running is that function's throw (R-failure), so a projected inner without a recipe ends its operator's branch with ERROR. The check is made when the request is made, not when a queued replace runs.",
 "rationale": "The review compared DS-20's agreed choices with the rules and ran probes on the reference kernel (sessions/active/ds20-review-probes/). Three of the differences fall under one sentence R-checkpoint@1 already has, that a restored node's setup runs and opens again what it opened outside the graph: a probe showed a restored node with an unchanged input not running its function while its setup read the saved private state. Under it a delay, a pending job and a pending retry are the same case, keep what is pending and restart how long, and a restore at idle changes no value; DS-20's earlier choice for time operators, to present the saved dependency snapshot again, added the last value once per restore. This narrows the limit D802 accepted, work in flight at capture is lost, to work a node did not record. Renewing a restored inner at once keeps the failure count and skips the backoff, which a process that crashes and restarts repeatedly needs most. History kept or cleared its list by a manual policy; under the auto policy it is a scan over waves and needs none, and a restored history, which cannot see an INVALIDATE before its first subscription, behaves as a live one. D802's rationale called a restored history keeping entries after an INVALIDATE a defect; keeping them is now intended, as buffer, pairwise and scan keep what they have seen. Capture already refuses values that are not JSON, yet wrote a checkpoint for a node it knew could not be restored. D808 placed that refusal at restore because R-checkpoint@1 did, and fixed only its order after the JSON refusals; the order carries over with both refusals at capture. The walkthrough's switch also refused capture on a graph without it and allotted recovery records by it; its savings were unmeasured, pending work is ordinary private state under (1), and D799 removed checkpoint's own record after three defects, so the option only decides when a missing recipe is found. Stated risk: none of this has runtime evidence, and the reference has no delay or valve and a latestAsync that holds an AbortController in private state.",
 "supersedes": [
  "D802",
  "D808"
 ],
 "status": "locked",
 "session": "DS-20",
 "concerns": [
  "protocol.snapshot-recovery",
  "protocol.checkpoint-recovery",
  "protocol.history-invalidation",
  "protocol.restart-recovery"
 ],
 "decision_kind": "protocol-decision",
 "change_kind": "partial-supersession",
 "protocol_impact": "semantic",
 "spec_amend": "spec/rules.jsonl: R-checkpoint@1 gets a revise transition to R-checkpoint@2, introduced and activated by this decision: the in-flight sentence becomes (1), and a local-only node is refused at capture (4). R-node@2 gets a revise transition to R-node@3 for the optional recipe requirement (5), and R-request-order@3 and R-failure@3 are checked for the refusal at request time (6) and revised only if their text does not already give it. R-history@1 and R-restart@1, still drafts, are rewritten in place for (3) and (2), gain this decision in introduced_by and stay drafts. spec/fixtures/d797-rereview.v1.json: checkpointReasons.localOnly becomes a capture reason, text unchanged. D802's other choices stand, and so do D808's: of D808 only the place of the local-only refusal in its (5) changes.",
 "conformance_obligations": [
  "C-38: a node that recorded pending work in private state has it opened again by its setup after restore with its function not run on an unchanged input; a node that recorded nothing loses it; capture refuses a local-only node and names it, after the JSON refusals; this replaces C-38's sentence that a JSON local-only capture still fails at restore.",
  "C-45: history keeps its list across a source INVALIDATE, live and after a checkpoint round trip, and sends it whole on the next DATA.",
  "C-43 and C-46: a restored restart owner with an ended inner waits the retry delay in full, counts no further failure, and still makes no hopeless attempt.",
  "A new scenario for the recipe requirement: node and replace refuse an instance without a recipe and leave the current one; a refusal inside a running function ends that node with ERROR; a graph without the option accepts the same requests and can be captured when every node has a recipe.",
  "Every runtime's result for these scenarios starts todo."
 ],
 "formal_obligations": [
  "module_checkpoint.tla: capture is refused while a local-only node exists, and a restored node's setup reopens recorded pending work without a function run; invariants and mutations for both; rerun its configs.",
  "module_history.tla: a source INVALIDATE keeps the list; module_restart.tla: a restored pending retry is re-armed, not renewed; rerun their configs with a mutation each.",
  "The recipe requirement is a deterministic check at request time; state why kernel_lifetime needs no new step, or add the refused replace."
 ],
 "completion": {
  "complete_when": "R-checkpoint@2 and R-node@3 are active, the history and restart drafts and the reference modules match (1)-(6), the listed scenarios and models are updated and pass, and DS-20 is rewritten to match.",
  "historical_when": "A later root protocol decision supersedes the pending-work, history-invalidation, restart-recovery or recipe-requirement contract."
 }
}
```

**写入前需要你看的五点。** 每点后面是我的建议。

1. **`supersedes: ["D802"]`。** 账本的准入规则要求部分取代写明前任。写上之后 D802 不再算现行决定，尽管它的大部分选择
   仍然有效；记录的 `spec_amend` 里写了 "D802's other choices stand"。D803、D804、D808 用的是同样的做法。另一种写法是
   `change_kind: "extension"` 且不写 `supersedes`，但那样就没有记下"在途丢失"这条限制被收窄了。**建议：照草稿，写明取代。**
2. **两个新的 concern 名。** `protocol.history-invalidation` 和 `protocol.restart-recovery` 是我起的，账本里没有。history
   和 restart 两条草案规则现在挂在 D797 的宽泛 concern 下。不想加新名的话，可以只留 `protocol.snapshot-recovery`。
   **建议：保留两个新名。** 它们各只有这一条决定管，不增加并列。
3. **草案规则原地改写。** `spec_amend` 写的是 R-history@1 和 R-restart@1 原地改写并保持草案。先例是 D802 在激活前原地
   改写了 R-checkpoint@1。如果你要它们各出一个 @2，这句要改。**建议：原地改写，并把这条决定加进两行的
   `introduced_by`。** 草案从未公开过；出 @2 会再多两行历史草案，清理提案的 Q3 刚处理过这类行。
4. **没有写进记录的一个细节。** DS-20 约定"恢复出的图默认开启 checkpoint"。开关收窄之后，这句对应的是"恢复出的图是否
   默认要求 recipe"。提案的 Q7、Q8 没有问过这一点，所以记录里没写，`restore` 的图选项仍由 host 传入。
   **建议：不默认开启，由 host 传入。** 恢复出的图里每个节点本来就有 recipe；之后加进去的 local-only 节点会在下一次
   capture 被拒绝并点名，这是每个图都有的基线，不需要为恢复出的图另设默认。这和 DS-20 原来约定的"默认开启"不同，
   所以要你点头。
5. **怎样写对 D808 的取代。** 模型现在把任何被取代过的决定整个排除在现行集合之外，不管是部分还是全部
   （`authority/model.mjs` 的 `currentCandidates`）。D808 管着五个事项，这条草稿只改其中 checkpoint 的一句话。
   D783 写的是"partial supersession must remain explicitly unresolved rather than being inferred"。三种写法，在副本里量过：

   | 写法 | 没有现行决定管的事项 | 说明 |
   |---|---|---|
   | (i) `supersedes` 写 D802 和 D808，模型不动 | 6 个（现在是 2 个） | 取代关系是真的，但 D808 的 invocation-scope、request-order、quiet-terminal、graph-surface 四个事项在派生视图里没人管了 |
   | (ii) `supersedes` 只写 D802，D808 的那句话只在正文里说明 | 2 个，不变 | 派生视图不变，但取代关系漏了一条边 |
   | (iii) 先改模型：被部分取代的决定，对后继没有列出的事项仍然现行；然后照 (i) 写 | 0 个 | 现有的 2 个也一起修好：D806、D807 被 D808 部分取代后，它们的两个事项现在没人管 |

   (iii) 对今天的账本只有一处效果：那 2 个事项重新有了归属，现行决定从 428 条变 430 条，`ambiguousCurrentGovernors`
   仍是 4，`unclassifiedDecisions` 仍是 407。它只用记录里已有的字段（双方的 `concerns` 和后继的 `change_kind`）。
   **建议 (iii)。** 它是对账本解析器的实现改动，要你批准；它改的是 D783 所说的"派生的现行视图"怎样算，我认为应该
   作为这条根决定之外单独的一小步先做，带测试。如果你不想现在动模型，退而选 (ii)。

## 10. DS-20 的改写草稿（已于 2026-11-18 应用）

用户批准修订计划后，下表九处都已写进 DS-20 正文，每处注明了修订日期和最初约定的内容。下面是当时的草稿，原样保留。

Q1–Q3 是 operator 语义，这里不为它们起草 D#。理由：DS-20 里其余几十项 operator 选择都处在同一状态（约定，没有 D#），
D797 (9) 把 sugar 留给各语言，DS-20 自己写了共享场景记录的归属是另一个决定。只给其中三项编号会让它们和其余选择的地位
不一致。它们作为 DS-20 约定的修订记在 DS-20 里，等 operator 契约的归属定了再一起入账。Q1 依赖的机制（待办是私有状态，
setup 重开）已经在上面那条根决定的 (1) 里。

下面是 DS-20 各处的替换文字草稿，**没有应用到 DS-20**。DS-20 是 walkthrough 的记录，由它的作者或用户决定怎样改。

| DS-20 位置 | 现在 | 草稿 |
|---|---|---|
| Agreed recovery direction，第 2 条 | Restore time operators as newly created on activation, with fresh windows/deadlines and current dependency snapshots. Pending timer candidates, old delay queues and elapsed time are discarded. | Time operators keep what is pending and restart how long. A delay queue (with its queued INVALIDATE and normal COMPLETE), a debounce or auditTime candidate and bufferTime's collected payloads are private state; setup starts each timer, quiet interval or window again in full on activation. Elapsed time, throttle's suppression deadline and timeout's deadline are not kept. A saved dependency snapshot is not a new occurrence, so a restore at idle changes no value. |
| Restore prediction exercise: delay feeding a sum scan | Predicted sums after that wave are 12 and 14 respectively. | Predicted sums are 12 and 12: in trace A the saved queue delivers 2 once after a full delay, in trace B nothing is pending and nothing is delivered. The "Application choices" paragraph on event identity then applies to genuine duplicate occurrences, not to restore. |
| Keep switchMap, mergeMap, concatMap, exhaustMap | First forward existing inner DATA and free slots from ended inners. | mergeMap, concatMap and exhaustMap first forward existing inner DATA and free slots from ended inners. switchMap applies the new selection first: DATA and ERROR that the superseded inner delivers in the switching wave are not forwarded. An outer value that projects to the definition already attached supersedes nothing. |
| Applying the method to same-wave ordering | forward it before applying the new selection, agreed | the new selection wins, as takeUntil's notifier wins over same-wave source DATA and latestAsync suppresses stale results; revised 2026-11-18 after the independent review |
| Keep merge and withLatestFrom | Merge preserves arrays with dependency order as the same-wave tie-breaker. | 加一句：Its snapshot is the last array it sent, not the latest value among its inputs. |
| Agreed invalidation behavior，表 | 没有 merge、race、concat | merge: any input's effective INVALIDATE retracts the output, also when another input supplied it (R-invalidation). race: after selection only the winner is a dependency, so only its INVALIDATE retracts the output, and the selection stands. concat: the current source's INVALIDATE retracts the output; only its COMPLETE subscribes the next source. |
| Agreed invalidation behavior，history 行 | Preserve the grouped history and its readable list. … This changes the existing R-history@1 draft and reference module. | Retract the output and keep the list (auto policy); the next DATA sends the list with its earlier entries. Express a new segment with switchMap. No resetOnInvalidate flag. |
| Agreed checkpoint option | 默认关的建图开关；关闭的图拒绝 capture；按开关分配恢复专用记录 | The option only requires a recipe on every computed instance, off by default. Every graph can be captured; no record is kept or dropped by the option, so two equivalent graphs behave alike with it on or off. |
| Agreed recipe contract | 开启 checkpoint 的图在创建或替换时校验 | Capture refuses a local-only node and names it, on any graph. With the recipe requirement, node and replace refuse an instance without a recipe at request time; inside a running function the refusal is that function's throw. Capture still validates configuration and saved values; restore still reports a missing factory. |

---

## 11. 规则和场景按部分分家（Q10、Q11 已选）

用户 2026-11-18 问：`spec/rules.jsonl` 和 `spec/conformance.jsonl` 按不同部分分家，有什么建议。我把"部分"理解成内核、图、
模块、operator。这一节记下测量和两道题。用户对 Q10、Q11 都选了 (A)。它和 Q1–Q3 的关系：Q1–Q3 的归属取决于 Q10。

### 现状

用 [ledger-parts.py](ds20-review-probes/ledger-parts.py) 在根仓库 e0b4383 的两个账本上量的，输出在
[ledger-parts.out.txt](ds20-review-probes/ledger-parts.out.txt)。"部分"取自规则的 `area`：`module`、`graph`、`principle`
各成一部分，其余（message、wave、node、lifecycle、runtime、control、protocol）算内核。

| 事实 | 数字 |
|---|---|
| 规则账本的构成 | 157 行：现行公开 19 条（约 41KB），开放草案 17 行、15 个 id（约 20KB），已被取代或退役 121 行（约 148KB，占 72%） |
| 现行规则按部分 | 内核 13，图 2，模块 2，原则 2 |
| 修订链是否跨部分 | 121 行里 28 行退役，75 行的后继在同一部分，18 行的后继在另一部分 |
| 向上引用 | 一处：R-graph-domain（`area` 是 runtime）引用模块规则 R-bridge。五条草案模块规则只引用内核规则 |
| 场景按覆盖的最高部分 | 42 个：内核 22，图 1，模块 12，不覆盖任何现行或草案规则 7 |
| 不覆盖任何现行或草案规则的场景 | C-2、C-5、C-9、C-10、C-13 只指向已被取代的旧 pause 规则；C-1a、C-1c 的 `covers` 为空。七个都标 `required` |
| 读这两个文件的工具 | `authority/check.mjs` 和 `dashboard/build.mjs`，各一处 |

关于那七个场景：D798 写了被替换规则上的旧场景"退役、被接替或重写，跟随模块激活的除外"，R-pause@1 还是草案，所以五个旧
pause 场景可能是有意留着的。我没有核对每一个的去向。现在没有任何检查会把它们列出来。

### Q10. operator 契约归谁、放在哪里

operator 的选择（DS-20 的几十项，加上本提案的 Q1–Q3）现在只在 walkthrough 记录里，没有 D#，没有规则，也没有共享场景。

- (A) 根仓库拥有一份独立的 operator 契约和它的规范轨迹，物理上与协议规则分开，用自己的编号，不是 R-*。它可以引用内核和
  模块规则，规则不引用它。package 拥有 API 拼写、提供哪些 operator、实现相关的测试和证据。**建议。**
- (B) 放进 `spec/rules.jsonl`，作为一个新的 `area`。
- (C) 三个 package 各在自己的账本里记。
- (D) 维持现状，只留在 DS-20。

理由：

- (B) 把 sugar 升格成协议。D797 (9) 写了 sugar 留给各语言；治理参考也写了不要因为影响易用性就把 sugar 策略提成跨 runtime
  的规则。
- (C) 违反单一来源。DS-20 定的是本该三边相同的行为，各记一份迟早不一致；让某一个 package 当基准又等于由实现定义行为。
- (D) 让这些选择停在"约定"，各 runtime 没有可以对照的东西。Q1–Q3 也就没有地方入账。

用户："按 (A) 定"。

选 (A) 需要一并定的事。下面是草案建议，用户同意的是 (A) 本身，这张表没有逐行确认：

| 事项 | 草案建议 |
|---|---|
| 与 D797 (9) 的关系 | D797 (9) 把 combinator 的数组规则列为各语言的 sugar，DS-20 的表已经在规定这些。起草第 12 节时我的判断是"延伸"而不是取代，理由见那里的第 1 点 |
| 决定的类别 | 根账本的一条持久决定，`protocol_impact: "none"`：它不改任何协议规则 |
| 记录的形状 | 沿用规则的修订契约（id、revision、statement、introduced_by、activated_by、transition），这样同一个解析器可以给出"现行 operator 契约"，但文件和编号空间独立，不进入协议的公开投影 |
| 一条契约的内容 | DS-20 约定的文档方向：先写常规用法，再按主题写可观察的例外（失效、正常完成、恢复、同 wave），每个主题链接到一条规范轨迹 |
| 证据 | 规范轨迹在根仓库只有一份；各 runtime 的结果和实现相关的保证留在 package |
| B140 的验收文字 | 其中"operator/sugar/inspection checks stay package-local"要随决定改写 |
| 入账范围 | DS-20 的整套 operator 选择连同 Q1–Q3 一次入账，不逐项编号 |

### Q11. 内核、图、模块怎样分

- (A) 账本不拆，分家做在派生上：按 `area` 生成各部分的现行规则视图，场景的级别由它覆盖的规则派生，加两个检查。**建议。**
- (B) 物理拆成每部分一个文件。

理由：

- 规则账本只追加，生命周期靠派生。拆文件要先决定 121 行历史各归哪边，18 条修订链会跨文件。
- 读的人的实际困难是 72% 的行是历史，不是各部分混在一起。按部分生成现行规则的视图直接解决它；`authority/model.mjs`
  已经在派生现行协议投影。
- 场景的级别可以由 `covers` 派生：只覆盖内核规则的是内核场景。这样"通过内核场景"有确定的清单，D800 让 Python 以此为
  门槛。
- 场景没有修订链，以后真要拆成每层一个文件，只改两处读取。建议等派生级别用过一轮、确实有不便再拆。

(A) 要加的两个检查：

1. 引用方向：模块规则只引用内核和图的规则，内核规则不引用模块规则。它现在会报出 R-graph-domain 引用 R-bridge 这一处，由
   用户判断是例外还是要改。
2. 场景覆盖：列出不覆盖任何现行或草案规则的场景。它现在会列出上面那七个。

两个检查都是工具改动，不改任何规则。

用户："按 (A) 定"。这是维持账本现状加工具改动，没有语义、归属或权限边界的变化，所以不为它起草 D#；它作为候选工作记在
第 8 节的表里。

**已实现（2026-11-18，用户："实现 Q11 工具"）。** 都是派生，不改任何规则或场景：

- `authority/model.mjs` 给每条现行规则派生 `part`，给每个场景派生级别，并列出两份清单；三个新测试。
- `npm run rules:current`（`authority/current-rules.mjs`）按部分打印现行规则，可选一个部分、`--drafts`、`--scenarios`、
  `--json`。`--scenarios kernel` 给出内核场景的确定清单，现在是 22 个。
- `authority/check.mjs` 的输出多了 `protocol parts` 一段和两个指标。两份清单只供复查，不让检查失败。
- 现在的结果：不覆盖任何现行规则的场景 8 个（上面的七个，加只覆盖草案 R-pull 的 C-27）；向上引用 1 处，
  R-graph-domain@3 引用 R-bridge，是例外还是要改仍由用户判断。
- 和上面写法的一处差别：principle 不单独成一级，覆盖 principle 规则的场景算内核级；引用方向上 principle 和内核同级。

### 顺序

先定 Q10，因为它挡着 DS-20 整套 operator 选择入账。Q11 的视图和检查可以随后做，与 Q10 互不依赖。

账本里过时内容的清理是另一件事，见 [根仓库账本清理提案](PROPOSAL-root-ledger-cleanup.md)。

---

## 12. operator 契约归属的决定记录草稿（已作为 graphrefly:D813 入账）

**已入账（2026-11-18）。** 用户对本节末尾的三点答"都按建议"。入账的是 graphrefly:D813，内容和下面的草稿相同，只换了
编号。契约文件、记录形状和解析器的改动是这条决定之下的工作，还没有开始。

Q10 选 (A) 之后起草。**没有写入 `decisions/decisions.jsonl`**，`D-next-2` 是占位。

**分类。** 持久决定；归属和权限边界的决定，不改任何协议规则，所以 `protocol_impact` 是 `none`，不需要 `/spec-amend`；唯一
owner 是根账本。

**试跑。** 把第 9 节和这一节的两条记录以 `D810`、`D811` 追加到仓库的一份临时副本，并把 DS-20 的 `locks` 设成两者，
`node authority/check.mjs` 和 `node dashboard/build.mjs --check` 都以 0 退出，`ambiguousCurrentGovernors` 仍是 4。
2026-11-18 复核时在现在的账本上以 D812、D813 重做，结果相同；这条草稿的内容没有变。

```json
{
 "id": "D-next-2",
 "layer": "Authority / shared operator contracts",
 "date": "2026-11-18",
 "question": "Who owns the observable behavior of the shared operators, and where is it recorded, given that operators are sugar outside the protocol rules?",
 "decision": "The root repository owns one set of operator contracts and their canonical traces, kept apart from the protocol rules: its own files and its own ids, never R-*, and outside the public protocol projection. A contract may cite kernel and module rules; no rule cites a contract. Each contract gives the ordinary use first and then the observable exceptions by topic (invalidation, normal completion, recovery, same-wave input), each linked to one canonical input and expected trace that exists once, at the root. A language package owns its API spelling, which operators it ships, its implementation-specific guarantees and tests, and its own results against the traces. The first content is the operator set the maintainer selected in DS-20, as revised by Q1-Q3 of sessions/active/PROPOSAL-DS20-operator-review-reconciliation.md, written as contracts that start as drafts and are activated family by family; none is numbered as a decision of its own. The protocol rules are unchanged, and operators stay outside them.",
 "rationale": "The user's choice of 2026-11-18 (the proposal's Q10, option A). DS-20 selected several dozen operator behaviors that should be the same in every runtime, and they existed only in a walkthrough record: no runtime had anything to check against, and the three revisions the independent review led to had nowhere to be recorded. Putting them in spec/rules.jsonl would make sugar a protocol obligation, which D797 (9) decided against and which the governance reference warns against. Recording them in each package's ledger would keep three copies of one choice, and taking one package as the baseline would let an implementation define the behavior. D797 (9) already states a shared combinator array rule in a root decision while leaving sugar to each language, so a root record of agreed operator behavior that is not a protocol rule extends that position rather than reversing it: what stays per language is the implementation and its API. The file layout, record shape and resolver change are work under this decision, not part of it.",
 "supersedes": [],
 "status": "locked",
 "session": "DS-20",
 "concerns": [
  "operators.contract-ownership"
 ],
 "decision_kind": "durable-architecture",
 "change_kind": "extension",
 "protocol_impact": "none",
 "completion": {
  "complete_when": "The operator contract set exists at the root with its resolver view and link checks, DS-20's selected operators and the Q1-Q3 revisions are written as contracts with their canonical traces, each package's operator documentation links to them, and B140's acceptance text on package-local operator checks is rewritten to match.",
  "historical_when": "A later root decision moves operator contracts into the protocol rules or to the packages."
 }
}
```

**写入前需要你看的三点。** 三点我的建议都是照草稿。

1. **`change_kind: "extension"`，不取代 D797。** D797 (9) 自己就在一条根决定里写了 combinator 的数组规则，同时说 sugar 留给
   各语言。所以"根仓库记下约定的 operator 行为，但它不是协议规则"是在延伸这个立场：留给各语言的是实现和 API。另一种写法
   是部分取代 D797，那会让 D797 这条内核的基础决定不再算现行，我认为不值得。如果你读 D797 (9) 的意思是"operator 的行为
   本身也由各语言定"，那就应该写成部分取代。
2. **记录只定边界，不定文件布局。** 文件名、记录形状、解析器怎样改，草稿里写的是"属于这条决定之下的工作"。第 11 节那张
   草案建议表里的"沿用规则的修订契约"等几行因此没有进入决定。
3. **新的 concern 名** `operators.contract-ownership` 是我起的，账本里没有。

---

## 13. D812 的规则文字（用户已确认，已写入并激活）

（2026-11-19 注：本节的“新文”是 11-18 写入时的文字。之后两轮独立 QA 原地更正过，现行文字以 `spec/rules.jsonl` 为准，更正见本节末尾。下面“`spec/rules.jsonl` 没有动”说的是写这一节当时的状态。）

2026-11-18，按修订计划的第 2 步写。下面只是文字，`spec/rules.jsonl` 没有动。用户确认之后，R-checkpoint@2 和 R-node@3 先以
草案写入（`introduced_by: ["D812"]`，不激活），R-history@1 和 R-restart@1 原地改写；模型和参考实现通过之后再激活。

每条只列改动的句子，其余句子不变。

### R-checkpoint@1 → @2，改四句

**1. 没有 recipe 的节点，在 capture 被拒绝。**

- 原文：A computed node whose instance carries no recipe, because it was built or replaced without one, is local-only, and
  restoring it fails, as does a missing recipe.
- 新文：A computed node whose instance carries no recipe, because it was built or replaced without one, is local-only:
  capture is refused and names the node. A graph created to require recipes (R-node) refuses such an instance when it is
  made, so its capture never meets one.

**2. 两种拒绝同时成立时报哪一个。**

- 原文：Values, terminal payloads, private state and recipe configurations must be JSON; otherwise capture is refused.
- 新文：Values, terminal payloads, private state and recipe configurations must be JSON; otherwise capture is refused, and
  a local-only node that also holds one that is not JSON is refused for that.

**3. 在途的工作。**

- 原文：Work in flight at capture is lost: it is neither resumed nor re-issued.
- 新文：Late output in flight at capture is lost, and checkpoint neither resumes nor re-issues it. Work a node must not
  lose is part of its private state: the node records what is pending there, as JSON, and its setup opens it again at
  the restored node's first activation, as at every activation. Elapsed time is not kept, so a reopened timer runs its
  full duration.

**4. restore 时仍然失败的情况。**

- 原文：A checkpoint that lacks what this rule saves, such as one written to an earlier format, is refused at restore
  rather than completed from its dependencies' saved values.
- 新文：A checkpoint that lacks what this rule saves, such as one written to an earlier format, is refused at restore
  rather than completed from its dependencies' saved values, as is one that holds a local-only node or names a recipe the
  registry lacks; restore names the node, and for a missing recipe its reference, and returns no graph.

### R-node@2 → @3，在一句后面加四句

- 原文：A recipe is an opaque description of how the instance was built, such as a checkpoint's { ref, config }; the
  kernel stores it and never reads it.
- 新文：原句不变，后面接：A graph may be created to require a recipe on every computed instance. Creating a computed
  node or replacing one without a recipe is then refused when it is asked for, and a refused replace leaves the current
  instance and its subscribers as they are (R-request-order); asked for by a running function, the refusal is that
  function's throw (R-failure). The kernel checks only that a recipe is present. The requirement is off unless the graph
  was created with it.

R-node 是内核规则，所以新文字不引用 R-checkpoint；Q11 的引用方向检查不会多报一处。

### R-history@1，原地改一句、加一句

- 原文：The list is the node's private state: the node has the manual INVALIDATE policy, so an INVALIDATE from the source
  clears the node's value and the list, deactivation drops it, and a checkpoint saves it.
- 新文：The list is the node's private state, and the node has the auto INVALIDATE policy (R-invalidation): an INVALIDATE
  from the source removes the node's value and keeps the list, so the next wave with DATA sends the list with its
  earlier entries; deactivation drops the list, and a checkpoint saves it. Arrays that came before an INVALIDATE in the
  same wave are not part of that wave's entry.

### R-restart@1，原地改一句

- 原文：When the owner deactivates without having ended, an ended inner is renewed, and a pending retry's timer is cleared;
  a restored owner whose inner had ended, which was waiting for a retry no checkpoint holds, renews it at its first
  activation in the same way.
- 新文：When the owner deactivates without having ended, an ended inner is renewed, and a pending retry's timer is
  cleared. A restored owner whose inner had ended was waiting for a retry (R-checkpoint): at its first activation its
  setup starts that retry's delay again in full, for the same attempt and without counting another failure, and when
  the delay ends the retry is made or dropped as any delayed retry is.

### 不改的两条

D812 要求核对 R-request-order@3 和 R-failure@3，文字已经覆盖就不改。核对结果是不改：

- R-failure@3 已写："A throw from a node's function becomes that node's ERROR"，以及其他失败"goes to its caller"。
- 参考内核的 `replace` 在调用时就同步检查并抛出（不是计算节点、依赖重复、成环），排队执行时只再查一次成环。所以
  R-request-order@3 里的"replace is refused for ..."本来就是请求时的拒绝，新加的 recipe 要求和它们同一时刻。
  （2026-11-19 第二次 QA：这条推理不成立。R-request-order@3 没有写 replace 的拒绝在什么时刻，参考实现在排队的
  replace 执行时还会再查一次成环。“请求时拒绝”和“被拒的 replace 留下什么”只由 R-node@3 规定。）

### 写这些文字时核对过的事实

- **capture 的检查顺序。** 参考实现按创建顺序逐个节点处理，每个节点先查 JSON、再看有没有 recipe
  （`reference/modules/checkpoint.mjs` 的 `capture`）。第 2 句只规定同一个节点上两种拒绝的先后，这是 D808 已经定的；
  不同节点之间先报哪个，现行规则没有规定，这里也没有加。
- **history 同一个 wave 里的失效。** [history-auto-same-wave.mjs](ds20-review-probes/history-auto-same-wave.mjs)
  （[输出](ds20-review-probes/history-auto-same-wave.out.txt)）：源在一个 wave 里发 `[a]`、INVALIDATE、`[b]`，auto 策略下
  history 先发 INVALIDATE，再发带 `[["b"]]` 这一条的列表，`[a]` 不在里面。这是 R-invalidation 的"what came before the
  INVALIDATE on that input is gone"的直接结果，所以加的那一句只是把它写明。失效之后晚到的订阅者只收到 START，下一次 DATA
  带着此前的条目一起发。
- **restore 已经接受图选项。** `restore(checkpoint, registry, graphOptions)`，所以"恢复出的图由 host 传入选项"不需要改
  签名。
- **待重试的状态能从私有状态推出。** 在 wave 边界上，owner 没结束而 inner 已结束，只可能是在等一次有延时的重试：零延时
  的 replace 在 wave 结束前已经执行。失败次数和尝试编号都在私有状态里，所以 setup 能为同一次尝试重新计时。
  **2026-11-19 更正：这条推理是错的。** 它只在 capture 的那一刻成立。恢复之后，inner 先于 owner 的 setup 被激活，
  所以 inner 如果在首次激活时才失败，setup 看到的同样是"owner 没结束而 inner 已结束"，却没有任何重试在等。参考实现
  按这条推理写，结果恢复后立刻失败或重复计数。现在 owner 把"有重试在等"明确记在私有状态里，setup 只读这个记录。

### 2026-11-19 独立 QA 之后的更正（用户已确认，"都按建议"）

两位独立审查者复查了 D812 的全部改动，找出 24 项问题。修复分两批：先修不涉及规则文字的缺陷，再把下列措辞给用户
确认后写入。R-checkpoint@2、R-node@3 和 D812 都是原地更正（分支未推送，三边还没有人按它们实现），各自的 rationale
里记了日期和原因。

| 位置 | 更正 |
|---|---|
| R-node@3 | "有 recipe"定义为"给了 recipe，不管是什么"；函数里遇到拒绝是这次请求的失败，没有处理才是函数的抛出；"Its status"改成"A node's status" |
| R-checkpoint@2 | 恢复出的图由 host 在 restore 时重新要求 recipe；给了 recipe 但没有引用名，capture 按 missing recipe 拒绝；带 bridge 的图不能 capture；全图的 JSON 拒绝都排在缺 recipe 的拒绝之前 |
| R-history@1（草案） | 一个 wave 里 DATA 之后是 INVALIDATE、其后没有数组：不算一条，也不发列表 |
| R-restart@1（草案） | 等待中的重试是 owner 私有状态里的记录；没有记录的恢复不重新计时 |
| D812 | (2) 的条件、(4) 的顺序、(5) 里"每个图都能被 capture"、(6) 里"抛出"四处 |
| C-38、C-43、C-46、C-50 | 跟随上面各条；C-50 加了处理拒绝的 operator、bridge 和 restore 时的要求 |
| DS-20、交接说明 | 第 36 行和"每个图都能被 capture"；交接说明的第 1、3、6 项 |

参考实现和模型的修复见 `reference/modules/README.md` 和 `formal/README.md` 里 2026-11-19 的段落。

同日晚些时候，用户要求对照“定下的”和“现在的”，并指出为兼容旧行为做的退让和没有讨论过的新增。四处已撤回（用户："都按建议"、"都撤掉"）：

| 位置 | 撤回 |
|---|---|
| R-checkpoint@2、D812 (4)、C-38 | 上表“全图的 JSON 拒绝都排在缺 recipe 的拒绝之前”撤回。它唯一的理由是 D812 之前被拒绝的 capture 不改变报错原因。现在只有一种顺序：按创建顺序，第一个存不下来的节点；同一个节点内仍然先报不是 JSON |
| 参考实现的 latestAsync | 只留一个形式，函数加 setup。单独的函数不记录在途任务，恢复后不重新发起，不符合 D812 (1) |
| R-node@3、内核的 `build`、C-50 | “构造多个节点的请求失败时一个不留”这句和内核的 `build` 请求撤回。它是内核里唯一能删除节点的途径，只为写错调用后能重试。模块的构造是一串请求，每个请求各自成立，被拒绝之前建好的节点留着 |
| R-bridge@3 | 撤回，R-bridge 保持第 2 版。它只是为了让 R-checkpoint@2 不引用模块规则。现在没有规则点名 bridge：R-checkpoint@2 说的是“模块不带 recipe 构造的节点”，“带 bridge 的图不能 capture”记在 D812 (5) |

2026-11-19，第三次独立复核之后，用户确认（“都按建议”）的六处文字，都不改变运行时的行为：

| 位置 | 改动 |
|---|---|
| D812 (5)、交接说明第 1、3 项 | “带 bridge 的图不能 capture”改成有条件的：持有模块不带 recipe 构造的节点的图不能 capture，参考实现的 bridge 是其中之一。R-bridge@2 不覆盖 bridge 节点的 checkpoint，所以各运行时的 bridge 图能否 capture 不是跨运行时的保证 |
| R-node@3 | “没有处理就是函数的抛出”改成对抛出和返回失败两种运行时都成立的说法 |
| R-checkpoint@2、C-38 | 恢复出的图的创建顺序可能和原图不同，对它的 capture 按它自己的顺序点名；C-38 不再说“拓扑描述相同” |
| D812 开头 | 2026-11-18 的六个选择是用户的；2026-11-19 原地更正的条款是用户成批接受的 Claude 的建议 |
| 交接说明第 4 项 | latestAsync 只有 D812 (1) 的那一句，没有规则或场景点名它，契约随 D813 的算子契约给出 |
| R-checkpoint@2 三处措辞 | “引用名是非空字符串”单独成句；“不能丢失它”写明是 INVALIDATE；运行的输入补上“依赖现在不持有值” |

同一天用户另外确认：参考内核接受布尔值或缺失的 ERROR 负载不对（R-messages），已改为拒绝；这是参考实现回到已有规则，不属于 D812。

### 参考实现现在和新文字不符的地方（第 5 步要改的）

（2026-11-19 注：以下各项是写这一节时的状态，现在都已在参考实现里改完。）

- capture 遇到无 recipe 的节点时写出 `local: true`，不拒绝。
- restore 遇到注册表里没有的 recipe 时只点名节点，不点名引用。
- history 用 manual 策略并清空列表。
- restart 的 setup 对恢复出的、inner 已结束的 owner 直接 renew，不重新计时。
- 内核没有"要求 recipe"的图选项。
- latestAsync 把 AbortController 放在私有状态里，capture 会因为不是 JSON 而拒绝。

---

## 附录：探针

脚本和输出在 [ds20-review-probes](ds20-review-probes/)，在根仓库 e0b4383 上运行，命令是
`node sessions/active/ds20-review-probes/<name>.mjs`。

[operators-and-restore.mjs](ds20-review-probes/operators-and-restore.mjs)，
输出 [operators-and-restore.out.txt](ds20-review-probes/operators-and-restore.out.txt)：

| 探针 | 输入 | 输出 |
|---|---|---|
| P1a | merge 有订阅者；A 发 a1，B 发 b1，A 失效；晚到的订阅者 | `late <- m: [START]` |
| P1b | 同样的历史，merge 此前没有订阅者 | `first <- m: [START, DATA("b1")]` |
| P1c | 最后的值来自 A，B 失效 | `late <- m: [START]` |
| P2 | mergeMap 两个已接上的 inner，A 的源失效 | `late <- mm: [START]` |
| P3 | switchMap：同一 wave 里旧 inner 发 DATA、outer 选后继 | 先 `DATA("x-late")`，再 `DATA("y0")`；两种批内顺序相同 |
| P4 | pause 持有两把锁、两个数组，整个锁表被失效 | 一个 wave 发出 `[DATA(1)]` 和 `[DATA(2), DATA(3)]` |
| P5 | history：一个值后源失效 | 发出 INVALIDATE，晚到的订阅者收到 `[START]` |
| P6 | 恢复后订阅，源未变 | 函数运行 0 次，订阅者读到保存的值 |
| P7 | 参考 latestAsync 等待中 capture | 抛出 `not restorable: job: its private state is not JSON` |
| P8 | 含无 recipe 回调的图 | capture 成功并写出 `"local": true`；restore 抛出 `local-only, built or replaced without a recipe` |

[history-auto-and-setup-reopen.mjs](ds20-review-probes/history-auto-and-setup-reopen.mjs)，
输出 [history-auto-and-setup-reopen.out.txt](ds20-review-probes/history-auto-and-setup-reopen.out.txt)：

| 探针 | 输入 | 输出 |
|---|---|---|
| U | 同一个 history 函数用默认 INVALIDATE 策略；v，INVALIDATE，w | 失效时发出 INVALIDATE；空档里晚到的订阅者收到 `[START]`；w 之后发出 `[[["v"]],[["w"]]]` |
| setup 重开 | 节点把待办记在私有状态；capture，restore，订阅，源未变 | 只有 `setup re-arms [3]`，函数没有运行 |
