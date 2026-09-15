# B139 consumer brief — brief-v1

日期：2026-09-06。批准与归档状态见 `sessions/sessions.jsonl` 的 DS-14；选择决策见 `graphrefly:D793`。

Artifact：`graphrefly:causal-flagship-design-brief`；schema：`graphrefly/causal-flagship-design-brief/v1`；revision：`brief-v1`。用户在任务 `01a077c7-55e6-7f11-9d4f-e7c51944afb4` 审阅全文及最终选择问题后回复“同意”。这是设计选择批准，不是实现或执行许可。以下保留审阅分析与建议级实施细节；所有明确后置的设计选择仍后置。第 1 节状态表记录审阅时基线，本次完成状态由 B139 owner work 记录。

已选择 `graphrefly-ts/examples/spending-alerts`，把现有“交易 → 异常判断 → 消息”消费路径扩展为一个保留在仓库、普通用户可重复运行的本地告警发布 consumer。第一项证明是：**节点及拓扑相同，算法改动仍可见；后果由独立证据核实；只有精确且当前的 admitted request 能抵达实际 effect。**

这是 retained first-party example consumer，不是第三方生产采用证据。若首个 flagship 必须来自独立产品仓库，应选择下述 Canvas 候选并接受更大的实施边界，而不能给此例改一个名字就宣称独立采用。

## 1. 状态核实与 owner 边界

读取并应用了 project-governance、decision-guard、design-review。约束来自 root D755（有范围的执行真相）、D762（typed DATA occurrence）、D765（保留 consumer、独立比较）、D791（contract-v2）、D792（有限能力与 preset）；Stack D59 继续独立约束其 RefreshSession 场景。

| 记录 | 当前文件状态 | 本轮解释 |
|---|---|---|
| `graphrefly:B120` | complete；contract-v2 | root 定义完成；D791 原始 JSONL 行含换行的 SHA-256 与证据相符 |
| `graphrefly-ts:CAUSAL-OCCURRENCE-TS` | complete；当前 ts-v3 | ts-v2 的 24/72/2160 是真实历史收据；不是当前完整资格 |
| ts-v3 receipt | 26 专项；29 structural + 44 behavioral mutations；2162 全量通过、4 existing skips；lint/build/export/artifact/workspace gates passed | 本轮核对了 6 项当前文件与 3 项历史文件摘要，全部匹配；没有重跑测试并声称重新验收 |
| `graphrefly:B139` | planned | 消费 contract-v2 + ts-v3，等待明确选择与批准 brief |
| `CAUSAL-COMPOSITION-DESIGN-TS` | proposed | 待本 brief 批准后才细化 package composition |
| `graphrefly:B121` / CSP-14 | proposed | 不能由 TS arm 或本草案完成 |

ts-v3 比 ts-v2 多出的修复是：新 domain 的首个 pending revision 在容量释放后可晋升；自身 state/result 不一致的 outcome 在占据 lifetime domain 容量前被拒绝。原始 work identity 和 contract 不变。

本轮只读运行 `authority:check:workspace` 通过：无 unresolved reference、dependency cycle 或 work orphan；Canvas append-only legacy revision 警告仍在。root、TS、Stack 工作树初始干净；Canvas 三项已有修改及 `test-graphrefly` 的 package/lockfile 两项修改均保留。

**分类与唯一 owner：**本 brief 是 root B139 的已批准设计 artifact；持久选择单独由 root D793 登记，不构成 execution authorization 或 runtime 验收收据。consumer 代码/本地 host/consumer 测试的唯一 owner 为 `graphrefly-ts`；root 拥有跨项目 brief 和独立 B121 汇总验证。Stack 继续拥有通用 source binding/evidence/consequence review 产品；Canvas 继续拥有其呈现与产品 admission。此处只定义一个精确源码绑定的 bounded proof，不提前实现 Stack 产品或替代其唯一权威。

## 2. 三个真实候选

| 候选、仓库与唯一代码 owner | 业务动作、输入/政策事实 | 已有执行边界与能力 | 缺口与取舍 |
|---|---|---|---|
| **Spending alerts**；`graphrefly-ts/examples/spending-alerts`；owner `graphrefly-ts` | 对交易计算异常并给出解释。交易序列、商家统计、用户日均与常见类别；z-score/daily-ratio 阈值和消息模板 | 实际 `@graphrefly/ts` workspace 依赖；7 个具名节点；交易向 vendorStats 与 anomalyScore 分流，随后三路汇入 anomalyScore；命令行订阅并输出消息，describe 路径解释 | 无 admitted notification host、exact occurrence binding、source-change evidence 或独立 verifier。阈值/justifier 尚是构造闭包。业务易理解、计算可独立核对；需要明确补齐而非把 console 日志算成授权证明。**推荐** |
| **Canvas local-v0 WorkGraph 查询**；`graphrefly-canvas/apps/{canvas-control-plane,workbench-acceptance}`；owner `graphrefly-canvas` | 对指定 revision 的 WorkGraph 执行问题/查询并呈现结果。tenant/workspace、accepted revision、bundle digest、session generation、query fingerprint、authentication/authorization | 已有执行 gateway、PostgreSQL query port、D667 runtime、结果记录及 provenance、UI；私有连接/运行时在 host 边界 | 最强的现有实际 host 路径；但精确因果、源码变化绑定与独立同验收对照尚未形成。当前 roadmap 仍要求 CS-198 手动验收，不能把旧 CS-197 自动化证据当产品完成。身份/数据库/容器/UI使首个证明扩大，不推荐作为最小第一步 |
| **现有独立 Stack test consumer**；`test-graphrefly`；代码 owner 为该 consumer 仓库，Stack 只拥有评审工具 | 数值 source → scaled/branch → merged，以及 label/offset/report；比例与偏移为当前代码常量 | 真 Git 历史、独立 package/lockfile、blueprint 命令；实际依赖声明仍是 `@graphrefly/ts ^0.3.0` | 是真实保留测试 consumer，但当前只是数字计算，不是 RefreshSession；没有 token/session/store effect 或业务政策 authority。升级并加入完整业务会接近新建场景，优先用作简单负对照背景 |

**为何不直接选 RefreshSession 或 order-reprice：**Stack D59/SC12 锁定的是 RefreshSession 设计和 source-bound 证明路径；当前所核对的独立 consumer 源码没有该业务。`STACK-SOURCE-BOUND` 为 planned，后续 manifest/review 为 deferred；B23 runtime linkage 又依赖 CSP-14。不能让 B139 等 B23 再让 B23 等 B139。选择 spending-alerts 不替换 Stack D59；order-reprice 也没有因曾被举例而被选中。

root eval 的实际 admitted executor 是可复用的工程先例，但 D765 已明确它仍是 package-private evaluation infrastructure；本轮不把它包装成新的 adoption 证据，也不启动 efficacy restart。

## 3. 推荐 consumer 的具体承诺

### 用户要回答的四个问题

1. 这次人工或 agent 提交具体改了哪个节点的哪段实现？绑定是精确还是缺失？
2. 哪些告警、原因、严重程度和发布请求可能因此变化？哪些只是结构可达？
3. 在哪一组输入、政策、代码和 runtime revision 下，哪些后果确实不变？
4. 当前候选是否可以向指定本地告警输出执行一次写入？还缺哪项事实或授权？

### 冻结的 managed business verb

**对一项交易评估异常，并在允许时发布一条本地告警。**

业务范围包含统计计算、判定、解释、发布政策、admission 和 exact outcome accounting。外部 noun owner 保有交易与用户档案；graph 使用有摘要的输入快照或有范围的 refs。不会对银行卡、真实交易、远程通知或账户进行操作。

首个 effect 建议为向用户指定的本地 inbox 文件追加一条结构化告警记录，文件变化由 graph 外 verifier 直接读取核实。它是未来需要实际执行的本地 filesystem effect，不是 spy 代替的“发送成功”。最终 host 采用何种文件记录格式和如何消费 admission，是后续 consumer/package 设计的明确选项；本轮没有创建该 host。

没有通过政策的交易产生正常业务结果和零 publish proposal。失败、pending、unknown 与 succeeded 必须分别可见；不能把“没看到告警”当成已成功处理。

### 先冻结输入与语义，才比较版本

- 同一 vendor 的有序交易历史；显式注明统计**包含当前交易**，与现有实现一致。此例不宣称使用仅过去历史做风险判定。
- 每次运行的 profile、thresholds、统计公式政策、justifier 实现及发布目的地都有 exact revision/digest；业务政策从可见 DATA/明确绑定的声明进入，而不是 host 隐式默认。
- 金额使用受限有限数值；固定顺序、舍入规则和数值误差准则。改变商家之间的交错不能串 key；改变同一商家的交易顺序不是语义等价的 replay。
- 第一个具体 input pack：同商家、已知类别、金额依次 100、200；dailyAverage=100；zThreshold=0.8；dailyRatioThreshold=5。只有 z-score 分支应决定第二条的变化。

### 同拓扑算法修改

`vendorStats` 当前使用 Welford 累积，再取 sample std：`sqrt(m2 / (count - 1))`。设 agent 将分母“优化”为 `count`；节点身份、deps、graph 名称和输出类型保持不变。

第二条交易在旧实现中 mean=150、sample std≈70.710678、z≈0.707107，正常；修改后 std=50、z=1，告警。dailyRatio=2、categoryFamiliarity=known、交易身份保持不变。

由于现有 `VendorStats.std` 明确约定 sample standard deviation，这个 patch 是**违反冻结 consumer 政策的反例**，不是本 brief 批准的业务语义修改。独立 verifier 必须发现它；该 candidate 的 publish effect 不得执行。未来如用户真要 population 语义，须另外批准政策变化并产生新证据，不能由 agent 的 commit 或好看的图替代。

配套正例使用保留 sample 语义的等价实现修改，例如 Welford 的 `m2 + delta * (x - newMean)` 改为代数形式 `m2 + delta² * oldCount / newCount`。只在预先冻结的数值域/容差内声明等价；阈值决策、reason、severity、request payload 必须完全相同。正确候选仍显示“实现已变”，并通过独立当前证据显示受测后果不变。

## 4. graph 如何显示，如何真的控制 effect

现有真实边（以代码 deps 为准，文件顶部示意图不是权威）：

```text
txFeed ─→ vendorStats ─┐
txFeed ────────────────┼→ anomalyScore → thresholdGate → reasonFactors → alertMessage
userProfile ──────────┘
```

建议的业务边界，名称仅是责任草图，**不是公共 API**：

```text
交易/档案/统计政策/阈值事实 → 精确当前 occurrence → 现有统计与解释链
                                              ↓
                          同 key 的计算/解释/发布政策终态汇合
                                              ↓
                     精确告警 proposal + 当前独立 verifier receipt
                                              ↓
                    admission（含当前本地操作 grant 和 exact binding）
                                              ↓
                      admitted request → focused inbox host → exact outcome
                                              ↓
                         conservation / retained evidence / quiescence
```

后置 conservation 事实记录 host outcome，但 admission 前必须已有该 effect 的合法归属与容量/accounting 依据。不得先执行再补登记；也不得以执行后的 retained quiescence 为执行前提形成死锁。可选审计完整性与正确性必要的当前性/记账内存是两回事。

呈现至少保留五种互不替代的判断：

| 判断 | 所需证据 |
|---|---|
| 实现已变 | exact base/candidate source binding + 文件/绑定函数及其被覆盖 helper 的 digest 差异；topology diff 为空也必须出现 |
| 可能影响 | 真实 deps 的可达切片；这是待验证范围 |
| 本次观察到变化 | exact occurrence、请求/结果与 base/candidate run 的关联证据 |
| 在声明范围内验证不变 | 独立 verifier 对候选当前 closure 与同一输入/政策域的肯定证据 |
| 不知道/证据不完整 | 绑定缺失、依赖未覆盖、证据过期、redacted、sampled、retention-gap 等明确状态 |

“谁改的”另列 provenance：Git author/committer 是仓库声明；agent attribution 需要精确 task/attempt、生成或应用 patch 的证据、操作者及 patch digest 的关联。缺少这些只显示 attribution unknown，不能从 commit 文案或算法风格猜 agent。源码 digest 证明字节关系，不证明作者身份；provenance 也不证明行为正确。

源码绑定第一版只覆盖该固定 consumer 的确切源码/构造点/helper/锁文件/runtime closure。行号变化、binding ambiguous、dirty overlay 未封存和实现未覆盖均不自动推断成功。不开发通用符号解析器，不依赖 node id 或 function.toString 充当实现摘要；局部显示不能声称整个仓库“未变”。

**实际 effect 的必要条件：**proposal payload 与 occurrence/effect/request refs 精确一致；occurrence 已 admit、current、连续无 gap；所有声明的必要 branch terminal 同 key；候选 code/runtime/input/policy/request digest 与 verifier receipt 一致且 verdict 允许；本地 action grant 的 owner、目的地、数量上限、有效期与 replay 范围当前；effect admission 精确且尚未消费。任意缺失均不得调用写入边界。

host 只消费 admitted request，不重新算业务阈值、不从最新全局值补字段、不擅自重试；host outcome 携带完全相关的 request/admission/occurrence refs。已知执行失败使用 D184 `DataResult`/`DataIssue` DATA；错误关联 outcome 不结清在途 effect。报告的 pass 或用户同意这份设计均不产生实际执行 grant。

## 5. 最小验收矩阵

以下是后续实现必须满足的验收定义，不是本轮已通过的测试。

| 场景 | 操作 | 必须可观察的结果 |
|---|---|---|
| S1 同拓扑语义错误 | 上述 n−1 → n；冻结 sample 政策和输入 | topology 同构、vendorStats 实现变化可见；第二笔分数/告警差异由独立 verifier 找出；candidate inbox 写入 0 |
| S2 同拓扑等价正例 | sample 语义代数改写 | 实现仍标记 changed；受测数值域内统计符合独立公式，离散后果/请求完全相同；有效 grant 下实际一次写入，读回 payload 相符 |
| S3 fan-out/fan-in | A/B 两个 vendor 的独立 occurrence，profile/policy 修订；分批、交错和反序抵达 branch/admission/outcome | 不把 A 的统计、B 的 policy 或旧 revision 的 terminal 借作当前输入；必要 branch 未齐保持 pending；每个最终 request 精确关联，终态不丢不重 |
| S4 wrong/stale/缺口 | 分别改 occurrence domain/id/revision/digest/sourceRefs，admission request/effect refs；先送 r3 再补 r2，或 policy 撤销后送旧 admission | 无错因/过期/跳号 release；相应 pending/issue/gap 可见；连续证据真正补齐并仍当前才可能 release，不能删 gap“修复” |
| S5 replay | 重放同 occurrence/proposal/admission/outcome；同 ID 换 payload；analysis replay 读旧 artifacts | 完全重放不新增计数/写入；冲突不覆盖首个事实；analysis replay 永不写入。复核旧历史不等于给新执行授权 |
| S6 outcome 与未知 | 正确请求得到成功、已知写入失败、缺失 outcome、错误 admission outcome | succeeded/failed/active 或有据的 unknown 分开；错误 outcome 不 settle；不能从无日志推成功；守恒方程成立 |
| S7 evidence/coverage | 删除 verifier receipt；换旧 source digest；删除 actor provenance；审计容量耗尽 | 缺 verifier 阻断该候选 effect；缺 provenance 只阻断 actor 归因（除非另外批准政策要求）；retained coverage 诚实变差。必要 currentness 丢失则 fail closed，审计开关不能放宽授权 |
| S8 简单负对照 | 已知类别、单交易、无异常；以及只改命令行标题/排版而不改 managed payload | 无新增发布；managed 后果经同 verifier 不变。记录 graph 设置/证据仪式的额外成本，允许 plain 更简单；范围外标题变化仍作为源码 diff 可见，不伪装为全仓库不变 |

replay 首轮承诺限于一个受测 host 生命周期和所保留的 exact admission 记录。跨进程 crash、写入成功但 outcome 丢失后的 exactly-once/durable recovery 不在此首证据范围；不自动重发，保留未决状态，后续由 durable owner 设计。不能将仅内存去重宣传为跨崩溃保证。

固定语义下比较只允许同 vendor 顺序保持的到达排列；涉及同 vendor revision 缺口时按 D791 quiet/currentness 处理，不能用排序助手掩盖真正的异常。

## 6. 独立 verifier、plain 对照与人/agent 证据

### Deterministic verifier

建议 root 拥有 acceptance oracle、冻结 manifest 与最终汇总；consumer owner 输出候选实现和运行 artifacts，不能自行把 report 的 pass 作为 B121 完成。verifier 是独立实现：不 import consumer 的计算、admission、join、conservation、证据分类或 preset helper；只共享被审阅的被动输入格式。不得读取 graph 的“passed/unchanged”标签充当预期答案。

统计 oracle 采用离线两遍均值/样本方差，与 Welford 独立；由冻结规则重建 threshold/reason/severity/请求 payload。状态 oracle 从外部输入序列、授权事实与真实 boundary journal 重建允许的请求集合、关联和守恒；直接核对 inbox 文件前后内容。使用显式逻辑时间与预定义到达 schedule，不靠 sleep 得出 currentness。

候选静态/预执行 verifier receipt 绑定待执行 artifact closure、input pack、policy、verifier revision、expected request digest 和数值域。post-execution verifier 再核对实际调用/输出，不能把预检查等同于已执行成功。runner 必须证明加载的是候选绑定字节，并包含 lock/runtime/transitive helper；不能只 hash 一个文件却跑另一个 build。

初次限定：两个 vendor、有限交易 pack、固定金额/阈值边界、r1/r2/r3 arrival schedules；数值容差建议 `1e-10 * max(1, abs(expected))`，离散判定与请求 payload 必须精确相同，含恰在 threshold 上的严格 `>` 控制。后续批准验收前冻结完整域；结论只覆盖该域，非全输入程序等价。

### 等价 plain-code arm

同 repo revision/input/policy、同业务算法版本、同本地 host 协议和 grant、同故障序列、同 verifier、同 retained evidence 目标。plain 自行用显式函数、状态表与事件处理完成 occurrence/admission/记账，不能 import GraphReFly 的协调 helper，不能删除 replay/失败处理换取短代码。

报告可变协调结构、transition branches、直接修改文件/符号、需触及的共享状态、fault coverage、运行时间/内存与证据准备成本；LOC 只辅助。正/负控制都报告；若 plain 更短更清楚或两臂同样复杂照实写。对照冻结先于看结果，不能看到某臂失败后悄悄放宽标准。

### Human/agent packet

固定 packet 建议最多 8 个场景、20 个业务/边界节点、40 条关键事实和 2 个 source diff，提供可展开 exact refs，但两类参与者获得相同内容和检索预算。完整底层 artifact 不因此被裁掉；更大图采用公开的投影规则而非按答案挑片段。

packet 包含：base/candidate source diff、exact source binding、真实 topology、输入与政策、部分运行事实及 coverage、provenance 的声明层级、统一问题表。参与者先预测 direct change / possible consequence / unchanged / unknown / effect eligibility，并逐项引用证据。

hidden answer artifact、完整 held-out 结果和评分 oracle 不进入 packet、agent 工作目录或提前可搜索路径。先封存答案再评分；另一个阶段才给 verifier receipt 测试“能否正确解释已核实证据”，避免把直接抄答案当后果预测。Graph/plain 各自与同一真值比较，human/agent 在每臂获得相同信息；可做交叉顺序或独立分组，记录学习效应。评分包括错误放行、漏报影响、无根据的不变声明、unknown 校准、事实引用与耗时。

本轮只定义证据包，没有开展人/agent 实验。后续 executor 数量、模型/工具与预算必须事先固定；不从当前对话推断新的 provider/spend 许可，不声称 ownership testing 或一般认知收益。

### 真实 runtime mutation 的通过条件

对临时独立候选字节修改真实依赖与分支，并运行同一个 consumer 和实际本地 inbox host：

1. 移除 proposal→admission、currentness→release、必要 terminal→join 或 admission→host 的真实边。
2. 放宽 exact request/cause match；用 latest 替代 keyed join；去掉 replay consumption 或 effect accounting；让错误 outcome settle。
3. 去掉 source/receipt binding、把 verifier label 当 authority，或把 known failure 转成 protocol ERROR。

每个 mutant 绑定实际改动位置、加载文件 hash、执行场景与被违反断言。必须有未经修改的正常 baseline，且能观察有效请求确实进入 host 并产生一次输出。mutation kill 是可见业务/授权/守恒断言失败；编译失败、load error、超时、空运行或只变 describe 不计成功。

结构构造检查与行为检查分别保留；必要时只隔离 construction guard 以验证剩余真实路径，不能关闭 business guard 来编造结果。若独立 host 防线拒绝了非法调用，报告具体哪个边界拒绝以及真实 attempted calls；不能声称已造成实际错误写入。若移除某条边后所有验收仍通过，诚实记 surviving/冗余防线，审查该边是否 load-bearing，不能用快照断言补一个“kill”。

本地 host 是受测真实 consumer 边界，spy/journal 只观察它。生产工厂不加入 mutation 开关，checkout 不被 runner 改写。ts-v3 的 73 项只证明 package arm，不能代替此处新的 consumer-host mutations。

## 7. 能力分层比较与未决项

| 路线 | brief 级取舍 |
|---|---|
| A 完整 contract-v2 bundle 直接装配 | 最大化复用已资格化内核，最少内部重构；但应用需接许多 lanes，当前 bundle 只输出 released/currentness/terminals/conservation/coverage/quiescence/issues，不能把它当已存在的任意 effect runner。保留作后续 package design 的基准 |
| B 小 kernel → 有限语义能力 → 一个 consumer preset | 推荐方向。identity/currentness/admitted release 为底座；keyed lifecycle/terminal fan-in/conservation/causal quiescence 构成执行闭包；retained evidence/有界 retention/retained quiescence 增加可声明证明。higher layer 关闭所有 lower prerequisites；diagnostics 正交。ordinary consumer 只选受支持组合 |
| C 每个 consumer 自己拼授权和审计 | plain 对照的自然形状；可解释、低依赖；作为 library 推荐会重复实现最危险的关联/重放/容量不变量，不推荐 |

这不是本轮选定 B 的具体 API。完整层级的旗舰实例需要完整必要闭包；simple negative control 可显示较轻采用的成本差异，不能用降 assurance 配置继续声称完整 retained proof。具体 factory/port/type 名称、局部覆盖矩阵与性能预算归 `CAUSAL-COMPOSITION-DESIGN-TS`。

**已有：**具名可执行图与 structural describe；实际统计与解释 consumer；contract-v2 和 ts-v3 package-private arm；Canvas/Root eval 的 focused host 工程先例。

**需要后续实现：**consumer 政策事实与 exact occurrence 接入；consumer 绑定的 admitted host；独立 verifier 与等价 plain arm；固定源码 binding/加载字节证明；provenance manifest；source→node→evidence 的报告投影；consumer runtime mutations；retained 可重复运行命令及 evidence packet。通用 Stack resolver/Canvas UI 不为此添加虚假前置依赖。

**本轮已批准的取舍：**first-party retained spending-alerts 为第一旗舰；本地告警 inbox 写入为第一实际 effect，并保留上述 bounded replay/nonclaim；sample→population 为拒绝反例，等价 sample 改写为正例。批准不改变后续实现和执行的独立边界。

**后续尚未解决但不在本轮展开：**精确 framework ports/preset 类型；构造时 graph/revision/capability 失败原子性；admitted request 到 host 的一次消费机制与 grant 表达；长期 provenance 信任链；跨进程 crash 恢复；更多 consumer 与完整 Stack/Canvas 产品整合。后三项不偷渡成首个证明的完成条件。

## 8. Q5–Q9 architect review

**Q5 — 抽象是否正确？**建议边界为一个 consumer verb 加受限 focused host。统计、阈值、关联与发布 policy 属于 graph/solution；文件写入机制在 adapter。source/provenance/report 是证据投影，不是新 verb 或 wave 字段。当前 bundle lanes 的确存在，但不自动解决 host enforcement。暂不把告警字段抽成公共 API；以后 capability 是否可通用于查询、session 等第二场景由 package review 验证。依据：[pipeline.ts:163](/Users/davidchenallio/src/graphrefly-ts/examples/spending-alerts/pipeline.ts:163)、[causal-occurrence.ts:155](/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/solutions/causal-occurrence.ts:155)。

**Q6 — 长期形状与隐含不变量？**INVARIANT：加载字节等于绑定字节；身份≠实现版本≠作者；same-key join；同 vendor 顺序明确；判定容差不漂移；host 只能消费当前 exact admitted request；不可把可选审计与必要 retention 混在一起。主要维护成本是 oracle 独立性、closure/provenance 覆盖和受支持组合；ts-v3 domain lifetime bound 与 retention-gap 不能因 demo 长跑而绕过。吞吐/内存需后续量测，当前不报虚构预算。依据：[qualification README:31](/Users/davidchenallio/src/graphrefly-ts/packages/ts/qualification/causal-occurrence/README.md:31)。

**Q7 — 可否更简单、响应式、可解释？**保留现有三源 join 与解释链，只让决定业务的 policy/verification/admission 真正成为依赖；动态交易/occurrence 留在有界 DATA，不每次加节点。关闭报告不改变授权与业务结果。首交付静态 HTML/CLI 可钻取报告足够，无需 Canvas。现有 index 根据文本含 flagged 选择展示，是演示逻辑，不能升级为执行授权；preset 不能藏一套 emit/latest/queue 协调。依据：[pipeline.ts:197](/Users/davidchenallio/src/graphrefly-ts/examples/spending-alerts/pipeline.ts:197)、[index.ts:30](/Users/davidchenallio/src/graphrefly-ts/examples/spending-alerts/index.ts:30)。

**Q8 — 替代方案？**A 直接完整 bundle：`consumer facts → qualified bundle → focused host`，资格复用强、低重构；应用接线重且 host 缺口仍须设计。B 有限能力 + consumer preset：`consumer facts → supported closure → focused host`，paved path 小、可分层验收；实现未有且兼容矩阵有成本。C 全手写协调：`events → keyed tables/branches → host`，简单案例成本可能最低；复杂场景把准入/关联维护负担交给每个用户。A 为现有先例，C 为公平对照，B 为待下一轮具体审阅的方向。

**Q9 — 推荐与覆盖检查。**推荐 spending-alerts consumer + B 的方向，保留 A 为设计基线、C 为同 oracle 对照。它有真实算法、可重复的边界反例、已保留的依赖消费路径，且无需激活 Canvas 或 provider。以下“覆盖”是 brief 已规定验收，不是代码已通过。

| Q5–Q8 concern | 覆盖 | 残余风险/处置 |
|---|---|---|
| 清楚的业务与外部边界 | 是 | 首个 effect 限本地文件，明确非真实金融/通知系统 |
| source 变化可见与 actor 归因分离 | 是，bounded binding | 通用 resolver、可信身份链后续；缺失即 unknown |
| 独立 unchanged/eligibility 证据 | 是，受测域 | 非任意输入程序等价；禁止共享 oracle 实现 |
| 响应式真实授权依赖 | 验收已定义，实现未有 | 必须通过 consumer host mutations 才可宣称 can |
| ordinary-use 简洁与完整闭包 | 部分 | package design 比较 A/B 后审阅；尚未锁定 API |
| 有界成本、生命周期及 replay | 部分 | ts-v3 限制保留；跨崩溃语义另案，不做首轮保证 |
| 公平替代方案与负例 | 是 | 不预设 Graph 更短或用户更快 |
| 独立生产采用 | 否 | 明示 first-party retained example；若这是首要门槛，改选 Canvas |

**结论：**与 root D755/D762/D765/D791/D792 一致的 consumer proposal；不回归 Stack D59。用户已确认 consumer 与上述边界；B139 按本冻结 brief 的不可变摘要完成。后续原有 package design work 仍需单独推进并审阅；实现与执行仍分别审批。

## 9. Artifact 与发布边界

当前文件是 root-owned indexed prose 的唯一详细正文，由 DS-14 索引；同目录 `b139-causal-flagship-brief-v1.json` 绑定精确正文、已审阅草案、批准任务与 producer revisions，B139 记录 immutable evidence refs。D793 只登记持久选择并引用本正文；没有注册新 work 或授权 schema。原任务 draft 保留为历史审阅材料，不再作为当前 authority。

未来 consumer artifacts 留在其唯一 owner：base/candidate source manifest、runtime/package closure、输入/政策 pack、Graph/plain 实现与 run receipts、真实 host journal/inbox 前后摘要、mutant reports、只读报告。root 只保留精确 refs、独立 verifier 与 aggregate，不复制 consumer truth。

公开报告只包含合成交易、已审阅源码差异、政策及脱敏证据 refs。原始身份/session/本地路径按声明保留；hash 不自动等于脱敏。隐藏答案在回答封存前不公开，评分后也须另行批准发布。冻结本 brief 不等于发布网站、npm、GitHub 或任何外部材料。

## 10. 核实来源

- [Root B120/B121](/Users/davidchenallio/src/graphrefly/plan/backlog.jsonl:116)，[B139](/Users/davidchenallio/src/graphrefly/plan/backlog.jsonl:135)，[CSP-14](/Users/davidchenallio/src/graphrefly/plan/phases.jsonl:19)。
- [TS owner sequencer](/Users/davidchenallio/src/graphrefly-ts/plan/work.jsonl)，[package composition design](/Users/davidchenallio/src/graphrefly-ts/plan/work.jsonl:61)。
- [ts-v2 历史收据](/Users/davidchenallio/src/graphrefly-ts/packages/ts/qualification/causal-occurrence/ts-v2-receipt.json)，[ts-v3 当前收据](/Users/davidchenallio/src/graphrefly-ts/packages/ts/qualification/causal-occurrence/ts-v3-receipt.json)，[资格边界](/Users/davidchenallio/src/graphrefly-ts/packages/ts/qualification/causal-occurrence/README.md)。
- [Spending consumer package](/Users/davidchenallio/src/graphrefly-ts/examples/spending-alerts/package.json)，[sample std contract](/Users/davidchenallio/src/graphrefly-ts/examples/spending-alerts/pipeline.ts:41)，[算法](/Users/davidchenallio/src/graphrefly-ts/examples/spending-alerts/pipeline.ts:173)。
- [Canvas 当前姿态](/Users/davidchenallio/src/graphrefly-canvas/plan/product-roadmap.md:43)，[真实 query boundary](/Users/davidchenallio/src/graphrefly-canvas/apps/canvas-control-plane/src/local-code-workgraph-execution-gateway.ts:97)。
- [独立 test consumer 当前实现](/Users/davidchenallio/src/test-graphrefly/src/application-graph.ts:3)，[依赖](/Users/davidchenallio/src/test-graphrefly/package.json)。
- [Stack D59](/Users/davidchenallio/src/graphrefly-stack/docs/decisions/decisions.jsonl:59)，[SC12](/Users/davidchenallio/src/graphrefly-stack/docs/product/scenario.jsonl:12)，[owner 顺序](/Users/davidchenallio/src/graphrefly-stack/docs/plan/phases.jsonl:30)，[B23 linkage](/Users/davidchenallio/src/graphrefly-stack/docs/plan/backlog.jsonl:22)。

核实时 HEAD：root `a38b8311faf9a2e13cd18cc3ee89cd62796ed833`；TS `63d58eace38ac782155062284515eeeba68b1df8`；Canvas `e6fdacaa95798fe9480c3e4d9869955571156901`；Stack `3d01b3f68231b0eeabcf22cf672d6a247b2fb3db`；test consumer `371c321272d770d1a6af69f3fa9415f430541b82`。这些是本轮基线，不是未来实现 receipt。
