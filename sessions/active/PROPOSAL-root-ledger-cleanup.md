# 根仓库账本清理提案

2026-11-18，Fable。状态：**待用户逐题决定（第 5 节 Q1–Q6）**。这是非规范性文档：它没有搬动、删除或改写任何账本、规则、
场景或会话，不锁定任何决定，也不授权任何清理动作。

起因：用户在 DS-20 复审之后问，账本、rules 和 conformance 是不是太大、留了很多过时的东西；随后指出仓库已有 archive
目录。本文记下测量、一次试跑，和按 archive 目录统一去处的方案。它和
[DS-20 复审提案](PROPOSAL-DS20-operator-review-reconciliation.md)是两件事，只在第 6 节有一处依赖。

**读了什么。** 根仓库 e0b4383 上的 `decisions/decisions.jsonl`、`spec/rules.jsonl`、`spec/conformance.jsonl`、
`plan/backlog.jsonl`、`plan/phases.jsonl`、`sessions/sessions.jsonl`、`authority/` 下的解析和检查代码、
`guide/docs.jsonl` 和 `guide/contribute.jsonl` 里关于 archive 的条目、
[PROPOSAL-B140-kernel-rule-revision.md](PROPOSAL-B140-kernel-rule-revision.md) 第 9.2 节。

**没读什么。** 没有逐条读 461 条旧决定的正文，只按字段统计。没有读各会话文件的正文，会话的判断只来自索引里的 `note`。
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
| `plan/backlog.jsonl` | 432KB，140 行 | 22 行在办（81KB）；118 行已结（355KB），其中 31 行仍被在办的行按编号提到；17 行用严格工作契约 |
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

建议不单独清理 C-2、C-5、C-9、C-10、C-13、C-27，而是把 pause 和 demand 模块的激活做完，按 9.2 节已定的去向处理。
在那之前可以做的一件小事：让检查列出"不覆盖任何现行或草案规则的场景"（DS-20 提案的 Q11 已包含这个检查），这样它们是
可见的待办，而不是看起来在生效的 `required` 场景。

C-1a、C-1c：对照 R-bridge@2 看一遍，给它们补上 `covers`，或者退役。

### Q3. 12 行 D797 之前的草案规则

| 规则 | 初步判断 | 依据 |
|---|---|---|
| R-replay-buffer@1、@2 | 等 history 模块激活时加转换 | B140 提案：去向是 history 模块 |
| R-pull@1、@2 | 等 demand 模块激活时加转换 | B140 提案：去向是 demand 模块和 K2 |
| R-node-revision@1 | 等 revision observer；用户 2026-11-09 已决定暂缓 | B140 提案 |
| R-edges-derived@1 | 加转换，指向 R-graph-surface@2 | 现行规则已写"Edges are derived from dependencies, never a separately maintained topology truth" |
| R-inspection-set@1 | 退役 | 它规定 describe、observe、profile 三个方法；现行规则是 find、describe、observe、retain，profiling 归 package 模块 |
| R-meta-presentation@1 | 退役或改写 | 它把静态标注放进 describe；现行规则写 describe 只给 `{ id, kind, deps, quiet }`，标注从节点读 |
| R-no-raw-async@1 | 退役或改写 | 它禁止反应层里的 Promise，并提到 pool/runner 层；DS-20 约定 latestAsync 的回调可以返回 Promise，pool 设计已退役 |
| R-clock@1 | 需要用户定 | 现行公开规则里没有任何一条提到时钟 |
| R-no-polling@1 | 激活，或并入 R-no-imperative@2 | 与现行原则一致 |
| R-data-not-peek@1 | 改写或退役 | 它说节点不读依赖的 `.cache`；现在函数通过 `ctx.deps` 读依赖，初值随 START 的快照到达 |

给从未激活的草案加退役或替换的转换，不改变公开协议，但转换要写 `by`，所以需要一条决定。

### Q4. backlog 已结的行

- (A) 118 行全部搬到 `archive/plan/`，用 `work-relocations.jsonl` 登记。
- (B) 只搬没有被在办的行提到的 87 行，其余 31 行留着。**建议先做 (B)**，因为机制没用过，范围小的那批风险低。

两种都要先在副本里试跑一次。140 行里只有 17 行用严格工作契约，其余 123 行是旧格式，搬迁工具是否接受旧格式我没有验证。

### Q5. 会话

14 个 active 会话的初步判断，只根据索引里的 `note`：

| 会话 | 初步判断 |
|---|---|
| DS-15、DS-16 | 候选归档。它们是 D796 那一轮的协议对齐，D797 已取代 D796 |
| DS-12 | 候选归档。它定义的迁移已获批准，是否做完要看 B 系列的状态 |
| DS-3、DS-4、DS-10、DS-11、DS-13 | 不锁定任何决定的研究会话。现有规则说的是"已解决或被取代"才归档，它们算不算，需要用户定 |
| DS-1 | 保留。459 条旧决定挂在它上面，decision-guard 把它列为来源 |
| DS-2、DS-9 | 保留，各锁着一条产品方向的决定 |
| DS-17、DS-19、DS-20 | 保留，正在进行 |

### Q6. 规则账本的历史行

建议不搬。理由和 DS-20 提案的 Q11 相同：121 行里 18 行的后继在另一个部分，生命周期又是从转换关系派生的；按部分生成现行
规则的视图就能解决阅读问题。用户对 Q11 已选了这个方向，这里只是确认清理不涉及它。

---

## 6. 顺序和依赖

1. **Q5 的会话归档。** 最小，只改索引和文件位置。
2. **Q3 里不依赖模块的 7 行草案规则。** 一条决定，加转换。
3. **Q4 (B)。** 先试跑。
4. **模块激活。** 它解决 Q2 的 6 个场景和 Q3 的 5 行草案。这里依赖 DS-20 提案：R-history 和 R-restart 两条草案要先按那里
   的根决定改写，再激活。
5. **Q1 的旧决定，分三批。** 工作量最大，放最后，每批由用户定。

## 7. 没有纳入的

- **根目录的五份 `COMPOSITION-GUIDE*.md`。** 我在对话里说过它们可以进 archive。核对后撤回：guide 的几个 JSONL、
  `docs/README.md`、backlog 和 dashboard 都在引用它们，最近一次修改是 2026-11-11，它们是在用的材料。
- **`conformance.jsonl` 的 `note` 字段和各 runtime 的状态标记。** `note` 里是历史叙述，占文件的四分之一多；状态标记按文档
  策略是"遗留声明，等证据回执迁移"。它们的处理属于那项迁移，不在这里重复；我没有核对那项迁移现在记在哪个工作项下。
- **不在 Git 里的大目录。** `formal/states` 4.7GB、`sessions/active/b121-comparison-design-v1` 902MB，都被 `.gitignore`
  排除，只占本地磁盘。

## 8. 工作：候选项

都是候选，没有新建任何 D# 或 backlog 条目。

| 候选 | 依赖 | 验收 |
|---|---|---|
| 一条根决定：清理的范围、三类标准、archive 下的布局、搬迁用它作 `relocation_decision` | 用户对 Q1–Q5 的答复 | 决定入账，`authority:check` 通过 |
| 会话归档（Q5） | 用户逐个确认 | 文件在 `sessions/archive/`，索引的路径和状态一致，文档检查通过 |
| 7 行旧草案规则加转换（Q3） | 根决定 | 开放草案只剩模块规则和等模块的 5 行 |
| backlog 已结行搬迁（Q4） | 副本试跑通过 | `work:check` 通过，在办的行的引用都能解析 |
| 旧决定分三批归类和搬迁（Q1） | 根决定；每批用户确认 | 每批之后两个检查通过，`unclassifiedDecisions` 逐批下降 |
| 是否让规则行的引用通过搬迁记录解析（Q1） | 用户决定 | 若做：被历史规则行引用的旧决定也可以搬 |
