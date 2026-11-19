# 根仓库账本清理提案

2026-11-18，Fable。状态：**Q5、Q3、Q4 已定并执行；Q2、Q6 复核后不动账本，它们落到的 Q11 工具已实现；Q1 待用户决定**。索引里的会话编号是 DS-21。这是非规范性文档：除了用户逐题批准的 Q5 会话归档、Q3 的七个转换和 Q4 的 backlog 搬迁，没有搬动、删除或
改写任何账本、规则或场景。决定在决定账本里（Q3 是 graphrefly:D810，Q4 是 graphrefly:D811），不在本文；本文不授权其余的
清理动作。

起因：用户在 DS-20 复审之后问，账本、rules 和 conformance 是不是太大、留了很多过时的东西；随后指出仓库已有 archive
目录。本文记下测量、一次试跑，和按 archive 目录统一去处的方案。它和
[DS-20 复审提案](PROPOSAL-DS20-operator-review-reconciliation.md)是两件事，只在第 6 节有一处依赖。

**读了什么。** 根仓库 e0b4383 上的 `decisions/decisions.jsonl`、`spec/rules.jsonl`、`spec/conformance.jsonl`、
`plan/backlog.jsonl`、`plan/phases.jsonl`、`sessions/sessions.jsonl`、`authority/` 下的解析和检查代码、
`guide/docs.jsonl` 和 `guide/contribute.jsonl` 里关于 archive 的条目、
[PROPOSAL-B140-kernel-rule-revision.md](PROPOSAL-B140-kernel-rule-revision.md) 第 9.2 节。

**没读什么。** 没有逐条读 461 条旧决定的正文，只按字段统计。写第一版时没有读各会话文件的正文；2026-11-18 定 Q5 时补读了一部分，见 Q5。
没有看各 package 仓库的账本。

**标注约定。** *已验证* = 我跑过脚本或试跑，脚本和输出在 [root-ledger-cleanup-probes](root-ledger-cleanup-probes/)；
*推断* = 从字段或文字读出，没有运行过；*初步* = 我的第一判断，需要用户逐项定。

---

## 1. 结论

体积大多是该保留的历史，问题在于有些过时的记录看起来仍是现行的。

1. **archive 目录可以作为"移出阅读路径"的唯一去处。** 文稿直接搬；账本行搬进去时要登记，因为别的记录按编号引用它们。
   试跑证明现有检查接受这种做法（第 4 节）。
2. **最大的一块是旧决定。** 461 条没有 concern 的旧决定占 `decisions.jsonl` 的九成以上。其中 322 条没有被任何现行内容
   引用，搬走后主账本从 1.25MB 降到 0.38MB。但"没被引用"不等于"不再管事"，每一批要用户定归类。
3. **规则和场景里悬着的东西多数在等模块激活。** 6 个旧场景和 5 行旧草案规则的去向早已定好，卡在 pause、demand、
   history 模块还是草案。把模块激活做完，比单独清理它们更对症。
4. **7 行旧草案规则没有去向。** 其中 3 行已被现行的 R-graph-surface@2 覆盖或推翻，1 行与现行设计冲突。

我要更正此前在对话里的一个说法：我说过 407 条旧决定里"不少描述的是已经退役的设计"。按 `layer` 字段统计，461 条里 321 条
是 L6（解决方案层），内核各层加起来约 80 条。所以多数旧决定不是退役的内核设计，而是归属和现行性没有定过的方案层决定。

---

## 2. 现状（已验证）

用 [ledger-staleness.py](root-ledger-cleanup-probes/ledger-staleness.py) 量的，输出在
[ledger-staleness.out.txt](root-ledger-cleanup-probes/ledger-staleness.out.txt)。

| 账本 | 大小 | 构成 |
|---|---|---|
| `decisions/decisions.jsonl` | 1.25MB，486 条 | 25 条带准入元数据；461 条是 5–8 月写的旧记录，没有 concern，其中 54 条已被取代 |
| `plan/backlog.jsonl` | 432KB，140 行 | 22 行在办（81KB）；26 行 deferred；92 行已结（319KB），其中 43 行仍被现行的东西提到；17 行用严格工作契约。（原来写"118 行已结、31 行被提到"，把 deferred 算了进去，2026-11-18 改正，见 Q4） |
| `spec/rules.jsonl` | 205KB，157 行 | 19 条公开规则（41KB）；121 行已被取代或退役（148KB）；17 行开放草案 |
| `spec/conformance.jsonl` | 89KB，42 个场景 | 35 个覆盖现行或草案规则；7 个不覆盖；`note` 字段约 24KB |
| `sessions/sessions.jsonl` | 20 个会话 | 14 个 active，6 个 archived |
| `plan/phases.jsonl` | 114KB，21 行 | 18 行 done |

旧决定的分布：459 条挂在 DS-1 的 `locks` 上；按 `layer` 是 L6 321 条、L3 33 条、L1.5 23 条、L4 10 条，其余零散。

旧决定被谁引用（一条可以被多处引用）：

| 引用方 | 引用到的旧决定数 |
|---|---|
| 已被取代或退役的规则行（`introduced_by`、转换的 `by`） | 57 |
| 公开或草案规则 | 15 |
| 现行的、带准入元数据的决定正文 | 52 |
| 在办的 backlog 行 | 82 |
| skill、guide、formal | 26 |
| 以上都不引用 | 322 条，约 870KB |

---

## 3. 哪些是过时的，哪些只是历史

**只是历史，留着没有害处，但挡路。** 被取代的规则修订、已结的 backlog 行、已被取代的决定。它们的状态是明确的，问题只在
读的人要绕过它们。

**看起来现行、其实没有定过的。**

- **旧决定。** 解析器把"locked 且未被取代"的都算作现行候选，所以 407 条旧决定在现行集合里，报告里只有一个数
  `unclassifiedDecisions: 407`。decision-guard 明确要求读 D797–D808 的内核规则而不是退役的设计，但搜索账本时它们照样会被
  找到。
- **7 个不覆盖任何现行或草案规则的场景，都标 `required`。** 整个文件里带 `pass` 标记的场景恰好就是这 7 个里的 6 个加上
  C-27；其余全是 `todo`。也就是说现有的通过记录全部属于旧行为。
- **旧草案规则。** 17 行开放草案里，5 行属于 D797 的模块规则（R-pause、R-demand、R-history、R-restart、R-revision），是正常
  的待激活状态。其余 12 行来自 D797 之前。

**这些场景和草案并没有被忘掉。** B140 提案 9.2 节已经定了去向（推断，来自那份提案的文字）：

| 场景 | 9.2 节定的去向 |
|---|---|
| C-2 | 由 C-30 接替，等 pause 模块激活 |
| C-5 | 改写为 pause 模块的场景 |
| C-9、C-10 | 退役（暂停模式改成位置） |
| C-13 | (a)(b) 由 C-30 接替，(c) 改写为 pause 模块的场景 |
| C-27 | 由 C-32 接替，等 demand 模块激活 |
| C-1a、C-1c | "不受影响"，`covers` 为空 |

C-1a 和 C-1c 需要单独看一眼：它们的 `note` 引用 D501–D529 一带的决定，而 D803 改写了 bridge 并取代了其中几条。它们现在
是否还对应 R-bridge@2，我没有核对。

---

## 4. 去处：archive 目录

仓库现在有两个 archive 目录，都只放文稿：`archive/`（旧的 GRAPHREFLY-SPEC 和两份旧设计文档）和 `sessions/archive/`
（已结束的会话）。贡献指南已有规则：会话结束后从 `sessions/active` 移到 `sessions/archive`，生命周期记在
`sessions/sessions.jsonl`。已做过的 319 次账本搬迁都是账本到账本，没有一次搬进 archive 目录。

**文稿直接搬。** 会话文件按现有规则走，只改索引里的路径和状态。

**账本行搬进 archive 要登记。** 在 `authority/ledgers.jsonl` 里把目标文件登记成 `historical_only` 的账本，在
`authority/relocations.jsonl` 里给每条记录一行哈希。每行搬迁要写明 `relocation_decision`，所以搬迁本身需要一条决定。

### 试跑（已验证）

[relocation-dry-run.py](root-ledger-cleanup-probes/relocation-dry-run.py) 只在不含 `.git` 的副本里运行。它把"没有被任何
现行内容、也没有被任何规则行引用"的旧决定搬到 `archive/decisions/root-history.jsonl`，登记账本和搬迁行。输出在
[relocation-dry-run.out.txt](root-ledger-cleanup-probes/relocation-dry-run.out.txt)。

| 项 | 结果 |
|---|---|
| 搬走 | 486 条里的 322 条 |
| `decisions/decisions.jsonl` | 从 1,245,648 字节降到 380,905 字节 |
| `archive/decisions/root-history.jsonl` | 865,140 字节 |
| `node authority/check.mjs` | 退出码 0，`unresolvedRefs: 0` |
| `node dashboard/build.mjs --check` | 退出码 0 |
| `unclassifiedDecisions` | 从 407 降到 103 |

**第一次试跑失败过，原因值得记下。** 我起初只保留被现行规则引用的决定，搬走了 335 条，两个检查都以 15 个
`unresolvedRefs` 失败：已被取代的规则行的 `introduced_by` 也必须能在主账本里解析到。会话的 `locks` 和决定的 `supersedes`
指向搬走的记录则没有问题。所以现在的做法是：任何规则行引用的决定都留在主账本。另一条路是改检查，让规则行的引用也能通过
搬迁记录解析，那是工具改动。

**试跑没有证明的两件事。**

- 322 是机械的上限，不是归类结果。搬进历史账本的记录会离开现行集合，这是一次语义声明，要用户按批定。
- backlog 行的搬迁没有试跑。`authority/work-relocations.jsonl` 现在是空的，这个机制在本仓库还没有用过。

---

## 5. 待用户定的问题

### Q1. 旧决定怎样归类和搬迁

每条旧决定归入三类之一：

- (a) 仍在管某个事项：留在主账本，补上 concern 和准入元数据。
- (b) 属于别的 owner：搬到那个 owner 的历史账本。各 package 和 Canvas 的 `root-origin-history.jsonl` 已经存在。
- (c) 不再管任何事项：搬到 `archive/decisions/`。

建议按批做，每批给用户一张表再定，不一次做完：

| 批 | 范围 | 条数 | 初步判断 |
|---|---|---|---|
| 1 | 已被取代的旧决定 | 54 | 最没有争议，状态已经明确。其中被规则行引用的要留在主账本，或先做下面的工具改动 |
| 2 | 内核各层（L1.5、L2、L3、L4 等） | 约 80 | 对照 D797 的 `supersedes`（它列了 30 条）和 B140 提案的规则去向表，多数应是 (c) |
| 3 | L6 方案层 | 321 | 多数应是 (a) 或 (b)，取决于各方案现在归根仓库还是 package。我没有读正文，不做判断 |

要一并定的：

- **是否改检查。** 让规则行对决定的引用可以通过搬迁记录解析。不改的话，被 57 条历史规则行引用的旧决定只能留在主账本。
- **搬迁决定。** 每批搬迁需要一条根决定作为 `relocation_decision`。建议一条决定授权整个清理并写明三类的标准，各批作为它
  之下的工作，不逐批编号。

### Q2. 旧场景

2026-11-18 复核，换掉了原来的两段。这次读了八个场景的正文、R-bridge@2 的全文、B140 提案 9.2 节和 bridge 模块提案的 Q4、Q5。

42 个场景里有 8 个不覆盖任何现行规则。它们分两类，都不是被遗忘的：

| 场景 | 现状 | 已定的去向 |
|---|---|---|
| C-2 | `covers` 指向三条已被 R-pause@1 草案替换的规则 | 由 C-30 接替（B140 提案 9.2） |
| C-27 | 指向 R-pull 草案和两条已替换的规则 | 由 C-32 接替 |
| C-5 | 指向两条已替换的 pause 规则 | 改写成 pause 模块的场景 |
| C-13 | 指向 R-paused-invalidate | (a)(b) 由 C-30 接替，(c) 改写成 pause 模块的场景 |
| C-9、C-10 | 指向两条已替换的 pause 规则 | 退役：暂停模式改成了位置 |
| C-1a | `covers` 为空。测的是根仓库的 `spec/protocol.proto` 和 `spec/fixtures/protobuf` 的字节往返 | bridge 模块提案 Q5：换新 fixture，ts、rust 重置为 todo |
| C-1c | `covers` 为空。测的是 ack-timeout 进入图的方式 | bridge 模块提案 Q5：不变 |

**前六个**都写明"跟着各自的模块规则激活"，属于 B140。它们的 `pass` 标记是 D797 之前的行为上的声明，按文档政策是遗留声明。
对症的做法仍然是把 pause 和 demand 模块激活做完，不是单独清理。

**C-1a 和 C-1c 是有意不挂规则的。** R-bridge@2 的"Not covered"一句把 envelope 层的确认和重试排除在规则之外；bridge 模块
提案把它列为"Not decided now"。所以它们不过时，这里不建议退役，也不建议硬补一个 `covers`。留着一处不一致：C-1c 是一个
`required` 的根场景，测的却是规则写明不覆盖的行为。envelope 层要不要有根规则，是 bridge 那边没定的题，不是清理能定的。

**建议：这一题没有要清理的东西。** 唯一值得做的是让检查把这 8 个场景列出来（"不覆盖任何现行规则的场景"，作为指标和清单，
不作为失败）。这正是 DS-20 提案 Q11 里已选方向的两个检查之一。2026-11-18 用户批准后已实现：`authority/check.mjs` 的输出里有
`scenariosWithoutCurrentRule`，`npm run rules:current -- --scenarios` 给出每个场景的原因。

顺带看到：deferred 的 backlog 行 B9、B18 的 `ref` 指向 R-pause-modes，那是已被替换的规则。它们属于 Q4 里没有逐行看的
26 行 deferred。

### Q3. 12 行 D797 之前的草案规则

**已定并已执行（2026-11-18）。** 用户看过下面的表之后选择"七条都按建议"，包括需要明确点头的 R-no-raw-async 和 R-clock，
以及草稿后面的三点。入账的是 graphrefly:D810；`spec/rules.jsonl` 里七行各加了 `by: D810` 的转换，没有改任何现行规则的
文字；本提案登记为 DS-21，锁 D810。执行后 `authority/check.mjs`（含 `--workspace`）、`dashboard/build.mjs --check`、
`authority/work-check.mjs` 都以 0 退出，authority 的 40 个测试通过；开放草案 17 行变 10 行，现行规则仍是 19 条。
没有改 guide，没有改任何 runtime 仓库，`dashboard/dashboard.html` 没有重新生成。下面是定之前的分析，原样保留。

2026-11-18 用户选择接着定这一题。下面换掉了原来只根据规则文字写的初步判断：这次对照了 19 条现行规则的全文、D805 和 D807
的正文、B140 提案的去向表、参考实现，以及三个 runtime 仓库和根仓库 guide 里对这些规则编号的引用，并在副本里试跑。

**先例。** D798 激活内核集时没有给这七条去向；D805 和 D807 后来处理了它们的同类。D807 退役 R-sync-core@1 和
R-dispatch-all@1 的理由正好适用："Neither draft was ever activated and neither was given a destination ... Their lasting
content is already in active rules, so neither is revised." 它是一条 `protocol-decision`，`change_kind` 为 clarification，
不改任何现行规则。

**等模块的 5 行，不变。** R-replay-buffer@1、@2 等 history 模块；R-pull@1、@2 等 demand 模块（C-27 还覆盖着 R-pull）；
R-node-revision@1 等 revision observer，用户 2026-11-09 已定暂缓。它们的后继 R-history@1、R-demand@1、R-revision@1 还是
草案，R-history 还要按 DS-20 改写，所以现在不加转换。

**现在可以处理的 7 行。** 没有一条被场景覆盖，没有一条有模型。

| 规则 | 建议 | 留下来的内容在哪里 | 丢掉的内容 |
|---|---|---|---|
| R-edges-derived@1 | replace，指向 R-graph-surface@2 | "deps are the current dependencies, a ctx.rewire's included"；"Edges are derived from dependencies, never a separately maintained topology truth" | mount 层级（D805 退役了 R-mount）；自动发现未注册的依赖；"每条边背后都有真实订阅"，现在 describe 不激活任何节点，这句已不成立 |
| R-inspection-set@1 | replace，指向 R-graph-surface@2 | 图层的方法是 find、describe、observe、retain | profile 方法和 explain 模式；D805 定为 package 模块 |
| R-meta-presentation@1 | retire | D805 第 (5) 点：标注归 package；describe 只给 `{ id, kind, deps, quiet }` | "静态标注放进 describe"与现行规则相反。"owner/access 标注不是授权"这一句仍由决定 D620 记着，不在任何现行规则里 |
| R-no-polling@1 | replace，指向 R-no-imperative@2 | "Coordination flows through messages along declared dependencies"；setTimeout 加 set 不是触发方式 | "周期行为是一个发消息的 timer source"，这是组合指导，不是可测的协议行为 |
| R-data-not-peek@1 | retire | 初值随 START 之后的快照到达（R-subscription@3）；函数通过 `ctx.deps` 读输入（R-invocation@3） | "节点不读依赖的 `.cache`"。见下面的说明 |
| R-no-raw-async@1 | retire。**需要用户明确点头** | 值层 sugar 不写消息（R-primary-api-clean@2）；函数返回后的 `ctx.down` 是后一个 wave（R-wave@3）并属于它的 lifetime（R-lifetime@2） | "异步只能出现在 source 和 pool/runner 层"。pool/runner 层已被 D807 退役。见下面的说明 |
| R-clock@1 | retire。**需要用户明确点头** | 无 | "图内单调计数器"没有任何 runtime 或参考模块实现过。见下面的说明 |

**三条要说明的。**

- **R-no-raw-async 不是死草案。** graphrefly-ts 把它当现行纪律执行：`scripts/check-no-raw-async.ts` 接在 `pnpm lint` 里，
  `setTimeout` 只允许出现在白名单文件；TS 仓库里有 10 个文件引用它，其中两个是 skill。根仓库的公开 guide 有两条记录引用它。另一边，参考
  实现在节点函数里直接用 `setTimeout`（`reference/modules/restart.mjs`）和 Promise（`reference/kernel/sugar.mjs` 的
  latestAsync），graphrefly-rs 的 `ctx.rs` 注释写的是"async lives in the fn body"。所以三边对它的理解已经不一样。
  按现行规则，异步的边界已经由结构决定：值层函数拿不到 `ctx.down`，只有 ctx 层节点能在函数返回后输出，而且受 lifetime 约束。
  草案在这之外多说的，是 package 的源码里哪些文件可以出现原始异步调用，这和 D807 判为"implementation, not protocol"的是
  同一类。建议退役，TS 把这条 lint 留作自己的纪律。另一个选择是不动它，另开设计题决定根协议要不要限制异步出现的位置。
- **R-clock。** TS 自己的注释写着"Graph-local clock = follow-up (D26)"，TTL 用的是可注入的 `Date.now`；参考实现里没有时钟。
  D805 定了 observe 没有序号，D797 把 revision 计数放进了观察者，所以内核里没有因果计数器是已经定过的。DS-20 的时间类算子
  （"保留待办，重置计时"）没有依赖任何时钟规则。建议退役；时间怎样进入图，等算子契约集（DS-20 提案 Q10）需要时再定。
- **R-data-not-peek 退役后留下的一处空白。** 没有现行规则禁止函数通过图去读别的节点。参考的 restart 模块就这样做
  （`kernel.get(d).ended`，因为延迟的重试触发时 `ctx.deps` 已经不可读）。这不是清理能定的；如果用户想要这条约束，它是一道
  新的设计题。

**试跑。** [draft-rule-transitions-dry-run.py](root-ledger-cleanup-probes/draft-rule-transitions-dry-run.py) 在副本里给七行
加了转换，追加一条占位决定。[结果](root-ledger-cleanup-probes/draft-rule-transitions-dry-run.out.txt)：`authority/check.mjs`、
`dashboard/build.mjs --check`、`authority/work-check.mjs` 都以 0 退出，authority 的 40 个测试通过；开放草案从 17 行降到
10 行（5 行等模块，5 行是 D797 的模块规则）；现行规则仍是 19 条，`ambiguousCurrentGovernors` 仍是 4。

**决定记录草稿。** 已作为 graphrefly:D810 入账，入账时填了编号、日期、`session`（DS-21）和用户的原话；以账本为准。照 D807 的写法。

```json
{
  "id": "D-next-3",
  "layer": "L0-L4 / drafts written before D797",
  "date": "入账时填",
  "question": "What happens to the seven draft rules written before D797 that were never activated and were given no destination when D798, D805 and D807 settled their siblings: R-edges-derived@1, R-inspection-set@1, R-meta-presentation@1, R-no-polling@1, R-data-not-peek@1, R-no-raw-async@1 and R-clock@1?",
  "decision": "Give each a transition, as the user decided on <date>; no active rule changes. (1) R-edges-derived@1 and R-inspection-set@1 are replaced by R-graph-surface@2, which already says that deps are the current dependencies, a rewire's included, that edges are derived from dependencies and never a separately maintained topology truth, and that the graph layer's methods are find, describe, observe and retain. What the drafts add (the mount hierarchy, discovery of unregistered dependencies, a profile method and an explain mode) is package-owned under D805. (2) R-meta-presentation@1 is retired: D805 made annotations package-owned and describe gives exactly { id, kind, deps, quiet }. That owner and access metadata is never authorization stays decided by D620. (3) R-no-polling@1 is replaced by R-no-imperative@2: coordination flows through messages along declared dependencies, and a timer plus a set is not a trigger. That periodic behavior is a timer source is composition guidance. (4) R-data-not-peek@1 is retired: an initial value arrives as the snapshot after START (R-subscription@3) and a function reads its inputs through ctx.deps (R-invocation@3). This decides nothing about a read a function makes through the graph. (5) R-no-raw-async@1 is retired: value-level sugar writes no message (R-primary-api-clean@2), and a ctx-level node's output after its function returned is a later wave (R-wave@3) that belongs to its lifetime (R-lifetime@2). In which source files a package lets raw async primitives appear is the package's; the pool and runner layer the draft names was retired by D807. (6) R-clock@1 is retired: no runtime and no reference module has a graph-local counter, observe carries no sequence number (D805) and revision counters are an observer's (D797). How time enters a graph has no root rule until a consumer needs one.",
  "rationale": "None of the seven was ever activated and none is covered by a scenario or a model, yet each still reads as a rule: graphrefly-ts's agent skills and source comments cite six of them as current, graphrefly-rs cites R-no-raw-async with the opposite meaning, and the public guide cites R-no-raw-async. D807 retired R-sync-core@1 and R-dispatch-all@1 on the same ground: a draft whose lasting content is already in active rules is not revised, and what it adds beyond them is implementation. Dry run of 2026-11-18 in a copy: the authority, dashboard and work checks pass, open drafts go from 17 to 10, and the 19 current rules are unchanged.",
  "supersedes": [],
  "status": "locked",
  "session": "见下面第 1 点",
  "concerns": ["protocol.pre-kernel-draft-rules"],
  "decision_kind": "protocol-decision",
  "change_kind": "clarification",
  "protocol_impact": "semantic",
  "spec_amend": "spec/rules.jsonl: transitions by this decision. Replace: R-edges-derived@1 and R-inspection-set@1 to R-graph-surface@2; R-no-polling@1 to R-no-imperative@2. Retire: R-meta-presentation@1, R-data-not-peek@1, R-no-raw-async@1, R-clock@1. No active rule changes.",
  "conformance_obligations": ["None: no scenario covers any of the seven."],
  "formal_obligations": ["None: no model encodes any of the seven."],
  "completion": {
    "complete_when": "The seven drafts carry their transitions and the root's checks pass.",
    "historical_when": "A later root protocol decision supersedes these choices."
  }
}
```

草稿里当时等用户看的三点（都已按建议定）：

1. **`session` 字段。** D805 到 D809 都写 DS-17。这次的讨论发生在本提案里，它不是索引里的会话。建议把本提案登记为
   DS-21（DS-19 就是指向一份 PROPOSAL 文件的会话），决定的 `session` 写 DS-21。
2. **新的 concern 名** `protocol.pre-kernel-draft-rules`。用新名是为了不和 D808 现在管着的 `protocol.graph-surface` 争
   同一个 concern。
3. **`protocol_impact` 写 semantic。** 照 D807；它不改任何现行规则，但 D807 也是这样标的。

**不在这一步里的后续。**

- **runtime 仓库的引用归各自的 owner。** TS：`dev-dispatch` 和 `design-review` 两个 skill、`check-no-raw-async.ts` 的说明、
  `graph/` 下几个文件的注释。Rust：`ctx.rs` 第 358 行的注释。根仓库只通知，不改。
- **公开 guide 的规则引用整体过时，范围比这七条大。** 15 条 active 的 guide 记录引用了已经不是现行的规则，引用最多的是
  R-dirty-before-data、R-two-phase、R-diamond（各 5 条记录），都是 D798 换掉的；R-no-raw-async 只占其中 2 条。两个检查都
  不核对 guide 的 `refs.rules`。这是单独的一项工作，候选项见第 8 节。

### Q4. backlog 已结的行

**已定并已执行（2026-11-18）。** 用户看过下面的分析之后选择"按 (A)，补检查"。

- **决定：** graphrefly:D811 入账，DS-21 锁 D810 和 D811。
- **搬迁：** 92 行已结的行逐字节搬到 `archive/plan/backlog-history.jsonl`，`plan/backlog.jsonl` 剩 48 行、114KB；
  `work-ledgers.jsonl` 登记了历史账本，`work-relocations.jsonl` 有 92 条登记。
- **检查代码：** `authority/work-federation.mjs` 现在拒绝历史工作账本里没有搬迁登记的记录，加了一个测试（先写测试，看它
  失败，再改代码）。
- **文档：** `docs/README.md`、`dashboard/README.md`、`authority/README.md` 各加了指向；三处指向 B141、B142 的 Markdown
  链接改成了历史文件。
- **验证：** authority、work、dashboard 三个检查各带和不带 `--workspace` 都以 0 退出；authority 的 41 个测试通过；派生的
  工作图和搬之前逐行相同（544 条记录、187 条边）；在真实仓库里往历史文件加一行，检查报错并退出 1，随后已还原。
- **没有做：** `dashboard/dashboard.html` 没有重新生成。写着"B142 in the root backlog"的十几个指针文件没有改，根 backlog
  现在是两个文件，这句话仍然成立。

下面是定之前的分析，原样保留。

2026-11-18 用户选择接着定这一题。下面换掉了原来的两行选项：这次读了工作账本的搬迁代码，重新数了行，查了谁还提到已结的行，
并在带着五个兄弟仓库的副本里试跑了两种范围。

**先改正数字。** 原来写的"118 行已结"把 26 行 deferred 也算了进去。deferred 的行在等触发条件，dashboard 单独列它们，不是
已结。改正后：

| | 行数 | 字节 |
|---|---|---|
| 全部 | 140 | 432KB |
| 已结：resolved 63、done 20、superseded 5、complete 4 | 92 | 319KB |
| 留下：open 14、proposed 6、in-progress 2、deferred 26 | 48 | 114KB |

92 行已结的行里，43 行还被现行的东西提到（在办或 deferred 的 backlog 行、没做完的 phase、带入账元数据的决定、guide、
skill、检查代码、active 会话的索引行、兄弟仓库），49 行没有被这些提到。原来写的 87 和 31 作废。

**机制。** `authority/work-federation.mjs` 支持把工作记录搬到另一个登记过的账本：在 `work-ledgers.jsonl` 登记
`archive/plan/backlog-history.jsonl`，标 `historical_only`；每行在 `work-relocations.jsonl` 留一条，带新旧两个 sha256 和
一条决定的编号。和决定账本不同的一点：搬走的记录仍在联合索引里，所以别处按编号的引用照样能解析，包括兄弟仓库的
prerequisite。这个机制在本仓库还没用过，`work-relocations.jsonl` 现在是空的。

**试跑。** [backlog-relocation-dry-run.py](root-ledger-cleanup-probes/backlog-relocation-dry-run.py)，
[结果](root-ledger-cleanup-probes/backlog-relocation-dry-run.out.txt)。副本旁边链接了 ts、rs、py、canvas、stack 五个仓库，
所以 `--workspace` 的检查读到了它们的工作账本。

| | (A) 搬全部 92 行 | (B) 只搬没被提到的 49 行 |
|---|---|---|
| `plan/backlog.jsonl` 之后 | 48 行，114KB | 91 行，284KB |
| authority、work、dashboard 三个检查，各带和不带 `--workspace` | 都以 0 退出 | 都以 0 退出 |
| authority 的 40 个测试 | 通过 | 通过 |
| 派生的工作图（就绪、依赖边、关键路径等；544 条记录、187 条边） | 和搬之前相同 | 和搬之前相同 |

在 (A) 的副本里做了三个反向测试：

- 改掉搬走的一行里的一个字节：检查报 integrity mismatch，退出 1。
- 从历史文件里删掉 B120：检查报四处 prerequisite 找不到 graphrefly:B120，退出 1，其中一处来自 graphrefly-ts。
- **往历史文件里加一行新记录：检查没有报，退出 0。** 决定账本的 `historical_only` 会拒绝没有搬迁登记的记录
  （`authority/README.md`），工作账本的 `historical_only` 目前只影响所有者检查。也就是说，历史文件现在不是靠检查保证
  不可写的。

**建议：(A)，并补上那个检查。** 原来建议 (B) 是因为机制没验证过。试跑说明两种范围在检查和派生结果上没有差别，而 (A) 之后
`plan/backlog.jsonl` 只剩在办和等触发的 48 行，读它的人和 skill 看到的就是现在的工作。(B) 留下的 43 行只是因为还被提到，
而提到它们的引用在 (A) 里同样能解析。

**做 (A) 需要的三样东西，都要用户同意。**

1. **一条根决定。** 搬迁登记的 `migration_ref` 必须是一条能解析的决定。草稿在下面。
2. **检查代码的一处改动。** `work-federation.mjs`：`historical_only` 的工作账本里，每条记录都必须有搬迁登记；加一个测试。
   这是实现改动，按"No implement without approval"单独列出。不做的话 (A) 也能过检查，只是历史文件没有保护。
3. **文档里的指向。** `docs/README.md` 的 Archive 一行加上历史文件；`dashboard/README.md` 描述 backlog 的一节说明已结的行
   在哪里。dashboard 上 backlog 的计数会从 140 变成 48，它只显示计数，联合工作视图不变。

**决定记录草稿。** 已作为 graphrefly:D811 入账，入账时填了编号、日期和用户的原话；以账本为准。

```json
{
  "id": "D-next-4",
  "layer": "planning / root backlog history",
  "date": "入账时填",
  "question": "Where do closed rows of the root backlog live, so that plan/backlog.jsonl shows the work that is open or waiting without losing any record?",
  "decision": "Closed rows of plan/backlog.jsonl (state or status resolved, done, superseded or complete) move byte for byte to archive/plan/backlog-history.jsonl, a root-owned backlog ledger registered as historical_only in authority/work-ledgers.jsonl, as the user decided on <date>. Each moved row has one line in authority/work-relocations.jsonl that names this decision. A moved row keeps its identity, owner and body, stays in the federated work index, and still resolves as a prerequisite or a superseded target from any owner. Open, proposed, in-progress and deferred rows stay in plan/backlog.jsonl. A row that closes later may be moved in a later batch under this decision; a moved row is never edited, and reopening work is a new row. The history ledger accepts only relocated rows.",
  "rationale": "On 2026-11-18 the root backlog held 140 rows and 432KB, of which 92 rows and 319KB were closed, so a reader looking for current work read mostly finished work. D787 already provides the relocation contract for work records; it had not been used. Dry run of 2026-11-18 in a copy beside the five sibling repositories: the authority, work and dashboard checks pass with and without --workspace, and the derived work graph (544 records, 187 dependency edges, readiness and critical path) is unchanged. The same dry run found that a historical_only work ledger accepted a new unrelocated row, which the check now refuses.",
  "supersedes": [],
  "status": "locked",
  "session": "DS-21",
  "concerns": ["planning.root-backlog-history"],
  "decision_kind": "durable-architecture",
  "change_kind": "extension",
  "protocol_impact": "none",
  "completion": {
    "complete_when": "The closed rows are in the history ledger with their relocation lines, the check refuses an unrelocated row there, and the root's checks pass with and without --workspace.",
    "historical_when": "A later root decision supersedes where closed root backlog rows live."
  }
}
```

草稿里当时等用户看的三点（都已按建议定）：

1. **写成 extension，不取代 D787。** D787 定了工作记录可以带登记搬迁；这条只是第一次用它，并定了根 backlog 的历史文件
   在哪里。
2. **"以后结掉的行可以在后续批次里按这条决定搬"。** 这样以后不用每搬一批都入一条决定。如果用户希望每批都单独批准，
   删掉这一句。
3. **新的 concern 名** `planning.root-backlog-history`。

**没有纳入的。** 26 行 deferred 里有没有其实已经不会再做的，这次没有看；那是逐行的判断，不是搬迁。

### Q5. 会话

**已定并已执行（2026-11-18）。** 用户看过下面的表之后选择"三个都归档"。DS-12、DS-15、DS-16 的正文和
`protocol-reconciliation-probes/` 已搬到 `sessions/archive/`，索引三行改了 `status`、`path` 和 `note`，DS-16 的旧路径留了
指针，DS-16 正文改了 3 处探针路径，其余逐字节不变。搬动后三个检查和 `test:authority` 通过；B142 任务简报里那一处旧路径
按建议没有改。`dashboard/dashboard.html` 是生成物，没有重新生成。其余 11 个会话没有动。下面是定之前的分析，原样保留。

2026-11-18 用户选择先定这一题。下面的判断换掉了原来只根据索引 `note` 写的那一版：这次读了 DS-12、DS-15 的正文、DS-16 的
开头和目录、五个研究会话的章节标题、B140 的验收条目和 B140 提案 9.7 节，并在副本里试跑了一次归档。

**原来漏看的一条现行政策。** `docs/README.md` 写着："Mixed research/design sessions stay in place until their open
questions are reviewed." 五个研究会话各有一节 Open Questions，都没有复查过。所以它们"算不算已结束"不需要用户另外定：按现行
政策它们留在原处，除非用户想现在复查那些问题，或者改这条政策。它们合计 67KB，没有任何 skill 默认读它们。

| 会话 | 建议 | 依据 |
|---|---|---|
| DS-15 | 归档 | 不锁定任何决定。它的每一条都已在 B140 提案 9.7 节对到现在的规则、测试和场景上（2026-11-10）。只有索引按路径引用它 |
| DS-16 | 归档，旧路径留一个指针文件 | 它锁的 D796 已被 D797 部分取代；D796 引入的 50 行规则草案里 47 行已有转换。正文开头的状态说明（2026-11-10）写的是"this session's state as it closed"。D796 的 `spec_amend` 字段写着它的旧路径，锁定的决定不改写，所以旧路径留指针 |
| DS-12 | 归档 | 它批准的迁移范围都在 2026-08-14 和 08-15，正文此后没有改过，没有未决问题一节。D787 仍是现行决定，归档不改变它；DS-14 就是在 D793 仍然现行时归档的 |
| DS-3、DS-4、DS-10、DS-11、DS-13 | 留在原处 | 上面那条政策 |
| DS-1 | 留在原处 | `docs/README.md` 写明它留在现有路径；decision-guard 按路径读它 |
| DS-2、DS-9 | 留在原处 | 各锁着产品方向的决定，各有未复查的 Open Questions |
| DS-17 | 留在原处 | `docs/README.md` 把它列为草案规则的设计输入；模块规则还没有激活 |
| DS-19、DS-20 | 留在原处 | 正在进行 |

**DS-15、DS-16 还连着的两处。** 归档不切断它们，但用户应当知道：

- B140 仍是 in-progress，它的 note 写着"DS-15/DS-16 remain its input"。它按编号引用，编号经索引解析，搬动之后仍然能找到。
- D796 的 50 行草案里还有 3 行没有转换：R-replay-buffer@2、R-pull@2、R-node-revision@1。它们在等 demand 和 revision
  模块（Q3）。到时候要读的讨论在 DS-16 里，归档后路径变了，内容不变。

如果用户认为这两处意味着它们还没结束，另一个选择是等 B140 关闭再归档 DS-15 和 DS-16，现在只归档 DS-12。

**试跑。** [session-archive-dry-run.py](root-ledger-cleanup-probes/session-archive-dry-run.py) 在不含 `.git` 的副本里搬了
DS-12、DS-15、DS-16 的正文和 `protocol-reconciliation-probes/`（36 个文件，只有 DS-16 用它），改了索引的 `status` 和
`path`，在 DS-16 的旧路径留了指针。[结果](root-ledger-cleanup-probes/session-archive-dry-run.out.txt)：

- `authority/check.mjs`、`dashboard/build.mjs --check`、`authority/work-check.mjs` 都以 0 退出。
- 这三个检查都不解析会话的 `path`，也不解析 Markdown 链接，所以它们通过不说明链接没断。脚本自己查了两者：新增 4 处不能
  解析的引用，全部是写成文字的 `sessions/active/protocol-reconciliation-probes/...`，3 处在 DS-16 正文里的命令行，1 处在
  B142 的任务简报里。

**做法，照 B142 在 2026-11-05 的先例。** 正文逐字节搬动；索引行改 `status` 和 `path`，`note` 里加归档日期和用户的批准；
只有不改写的记录还指着的旧路径才留指针。对那 4 处：`docs/README.md` 允许搬动时改路径（"move intact apart from paths"），
建议改 DS-16 正文里的 3 处路径，B142 的任务简报不动，它描述的是 2026-11-05 的目录。

这一步不用搬迁登记机制，不需要 `relocation_decision`，所以不依赖 Q1 的根决定。它不改变任何决定、规则或工作项的状态。
B142 那次另写了一份带 sha256 的搬动清单；这次只有四项，建议由 Git 的重命名记录和索引的 `note` 承担，不另建文件。

**顺带看到的，不属于这一题。** `sessions/active/` 里 B142 留下的指针文件（`SESSION-docs-reorganization.md`、
`docs-reorganization-evidence/` 下的十几个）是当时有意留的，`docs/README.md` 还链接着它们，不动。
DS-17 正文有一个链接指向已经不存在的 `formal/wave_protocol.tla`。

### Q6. 规则账本的历史行

2026-11-18 复核，补了数字和一次实验。建议不变：**不搬。**

Q3 之后 `spec/rules.jsonl` 是 157 行、206KB：现行 19 行（41KB），开放草案 10 行（15KB），带转换的历史行 128 行
（150KB，占 73%）。所以"历史行占了大头"是事实。

在副本里把 128 行历史行拿到 `archive/spec/` 之后，`authority/check.mjs` 和 `dashboard/build.mjs --check` 都以 1 退出，
13 处引用解析不到：

- 12 处是 Q2 那六个旧场景的 `covers`，指向只剩历史行的规则。
- 1 处是 `formal/wave_ctx_wave_data.tla` 引用 R-data-payload。

除此之外还有三点：

- 读这个文件的有三处代码（`authority/check.mjs`、`dashboard/build.mjs`、`website/scripts/build.mjs`），都只读一个文件。
  搬走之后转换链没有人检查，除非三处都改成读两个文件。
- 96 行历史行带后继，其中 18 行的后继在另一个部分（14 行内核到模块，4 行图层到内核），所以也不能按部分拆。
- 历史行和 backlog 的已结行不一样：现行规则是哪一条，是从转换关系派生出来的，历史行是这个推导的输入。

阅读问题是真的：直接打开文件，前面全是旧规则。它由 DS-20 提案 Q11 已选的方向解决，即按部分生成现行规则的视图。那个工具
**所以 Q2 和 Q6 落到同一件事上：实现 Q11 的视图和两个检查。** 2026-11-18 用户批准后已实现：`npm run rules:current`
按部分打印现行规则（内核 13 条约 18KB，不用再从 206KB 的账本里挑），加 `--drafts` 带上开放草案。

---

## 6. 顺序和依赖

1. **Q5 的会话归档。** 已做。
2. **Q3 里不依赖模块的 7 行草案规则。** 已做（D810）。
3. **Q4。** 已做（D811）。
4. **模块激活。** 它解决 Q2 的 6 个场景和 Q3 的 5 行草案。这里依赖 DS-20 提案：R-history 和 R-restart 两条草案要先按那里
   的根决定改写，再激活。
5. **Q1 的旧决定，分三批。** 工作量最大，放最后，每批由用户定。

## 7. 没有纳入的

- **根目录的五份 `COMPOSITION-GUIDE*.md`。** 我在对话里说过它们可以进 archive。核对后撤回：guide 的几个 JSONL、
  `docs/README.md`、backlog 和 dashboard 都在引用它们，最近一次修改是 2026-11-11，它们是在用的材料。
- **`conformance.jsonl` 的 `note` 字段和各 runtime 的状态标记。** `note` 里是历史叙述，占文件的四分之一多；状态标记按文档
  策略是"遗留声明，等证据回执迁移"。它们的处理属于那项迁移，不在这里重复；我没有核对那项迁移现在记在哪个工作项下。
- **`formal/states`。** 4.7GB，被 `formal/.gitignore` 排除，只占本地磁盘。
- **`sessions/active/b121-comparison-design-v1`。** 我原来写它被 `.gitignore` 排除，这是错的（2026-11-18 改正）：它在 Git
  里，2,155 个文件，工作区 897MB，几乎全部在 `agent-api/` 下。整个仓库的 pack 是 49MB，所以它压缩后不大，
  占的是检出后的磁盘和文件数。它属于 B121（状态 proposed），`scripts/b121-comparison/` 下 11 个文件和 backlog 按路径引用
  它。它是在办工作的证据，不是清理对象；要不要换存放位置是 B121 的事。

## 8. 工作：候选项

都是候选，没有新建任何 D# 或 backlog 条目。

| 候选 | 依赖 | 验收 |
|---|---|---|
| **已做（2026-11-18）。** Q11 的工具：按部分打印现行规则的视图；两个检查（引用方向；不覆盖任何现行规则的场景，现在是 8 个）。Q2 和 Q6 都落在它上面 | 用户批准实现 | 一条命令能按部分给出现行规则；检查的指标里列出那 8 个场景；现有检查和测试通过 |
| 一条根决定：清理的范围、三类标准、archive 下的布局、搬迁用它作 `relocation_decision` | 用户对 Q1–Q4 的答复（Q5 不用搬迁登记，不依赖它） | 决定入账，`authority:check` 通过 |
| 会话归档（Q5） | 用户逐个确认 | 文件在 `sessions/archive/`，索引的路径和状态一致，文档检查通过 |
| 7 行旧草案规则加转换（Q3） | 用户对 Q3 的答复；它自己的一条决定（草稿在 Q3），不依赖清理的根决定 | 开放草案只剩模块规则和等模块的 5 行 |
| guide 记录的 `refs.rules` 对到现行规则，并让检查核对它（Q3 顺带发现） | 用户决定做不做；可能属于 B7 | 15 条记录的规则引用都能解析到现行规则，或写明是历史出处 |
| backlog 已结行搬迁（Q4） | 用户对 Q4 的答复；它自己的一条决定（草稿在 Q4）；检查代码的一处改动 | 带和不带 `--workspace` 的检查都通过，派生的工作图不变，历史文件拒绝没有登记的行 |
| 旧决定分三批归类和搬迁（Q1） | 根决定；每批用户确认 | 每批之后两个检查通过，`unclassifiedDecisions` 逐批下降 |
| 是否让规则行的引用通过搬迁记录解析（Q1） | 用户决定 | 若做：被历史规则行引用的旧决定也可以搬 |
