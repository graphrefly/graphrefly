# DS-20 operator walkthrough：独立复审与规则对齐提案

2026-11-18，Fable。状态：**用户 2026-11-18 在对话中逐题同意了第 7 节的建议（Q1–Q9），包括 Q1 里延伸到 delay 以外的时间类
operator 的那张表。** 这是非规范性文档：它不改规则、场景、模型或参考实现，没有写入任何 D#，也不授权任何
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

缺的证据：没有任何 package runtime 的结果；参考实现里没有的 operator 没有运行证据；第 6 题只是推断。

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
