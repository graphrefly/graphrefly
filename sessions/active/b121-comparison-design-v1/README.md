# B121：分层使用与理解效果比较设计 v1

状态：**待用户审阅，未批准、未执行**。Owner：graphrefly:B121；TS 拥有 consumer、源码适配与包内能力，root 拥有比较方法、oracle、评分和汇总。本稿不改变 B121 proposed 状态，不新增公共 API、registry、协议消息或性能门槛。

## 本次推荐与批准范围

推荐先做一个**隔离的双组、三角色、小样本试验**：Graph 与等价 plain code，分别考察普通用户、框架作者、library 维护者。每个人或 agent 只接触一组；先封存全部预测，再提供验证收据。目标是发现分层入口是否迫使用户理解无关内部概念、是否容易误判代码变化与 effect 权限，而不是用少量样本宣布 Graph 普遍更快或更易理解。

本稿批准后，可一次完成离线准备：材料生成、角色视图、独立评分、答案封存、隔离验证、负对照和可复核 manifest。内部步骤不再逐项请求批准。真实参与者招募、agent/provider 调用及费用仍由随后具体执行 manifest 单独授权；本稿当前授权数量与费用均为零。

spending-alerts 继续作为已选 consumer 的应用组件，不借试验提升为通用 solutions 公共能力。先验证现有私有分层入口的使用体验；结果不能自动证明公共 package design 完成。

## 已有事实及其限度

- 实现入口是 `spendingAlertsFor(graph, defaults).compose(inputs)`；配置阶段不构图，compose 后保留完整依赖和 authority。普通用户的 assessment/publication/coverage/issues/startup 与框架的 identity/execution/retained 能力来自同一实例。
- 分级隐藏的是入口和可见细节，不是删掉依赖、义务或 retained evidence。展示退订不结束运行 lifecycle；错误或不匹配 outcome 不结算义务。
- 已有离线准备 46/46 memory arms，以及真实文件 46/46 arms；真实文件实验记录 30 次 host 请求、26 次实际 handle 调用、6338 字节独立读回。该证据验证实际授权路径，不是用户理解效果试验。
- 以前三角色 agent walkthrough 共用文件系统，不是盲测，不能作为本次样本。当前用户和当前 assistant 已见结论，也不能当作未经提示的受试者。
- 已核实基础 owned 53 节点 + host owned 4 节点 + caller inputs 5 节点 = off 全图 62 节点；23 个归档 Graph arms 的节点 ID 集合精确一致。summary 基础 54 是静态清单推导，本轮没有重新运行该模式。
- 正式 assembly/performance 验收仍未完成；历史 `currentQualified:false` 不变。小样本比较不能取代 D168/D169 的性能门槛。

源码绑定及计数证据见 [premise-audit.json](premise-audit.json)。已有交付见 [owner integration](../../../../graphrefly-ts/docs/design/causal-b121-owner-integration/README.md)、[真实文件收据](../../../../graphrefly-ts/docs/design/causal-host-proof-execution/receipt.json)、[既有 B139 brief](../../archive/SESSION-b139-causal-flagship-brief-v1.md)。

## 比较对象与角色任务

两组使用相同政策事实、输入、源码改动、外部 effect 边界及收据字段。G 组通过真实 Graph 的角色视图与关系投影阅读；P 组通过独立 plain host 的角色入口、函数关系和同等事实阅读。不得故意让 P 组承担 G 组被隐藏的内部细节。

| 角色 | 十分钟入口任务 | 默认披露 | 必要时可展开 | 成功证据 |
|---|---|---|---|---|
| 普通用户 | 根据示例写出组合与展示的使用片段；解释显示退订后运行是否结束 | 五个业务/状态端口、输入和展示生命周期 | 与当前判断有关的证据引用 | 不必手动维护 identity 或调用 authority；能定位未知/待结状态 |
| 框架作者 | 接入同一运行的执行与保留证据，解释实例接错、退订、重新订阅 | 原始 capability 与宿主责任 | authority 的 admission/outcome 关系 | 不复制 registry；不靠结构相同认定实例相同；不将展示订阅数当终态 |
| library 维护者 | 定位同拓扑算法差异并说明影响范围与验证边界 | 源码、精确节点/调用关系、能力实现 | 全部限定材料内的原始证据 | 分清 identity/lifecycle/evidence；不把 digest 当作者认证 |

入口任务只提交片段与解释，不实际执行 effect。离线准备需提供语法/引用可检查的任务 fixture，并验证 P 组有语义等价入口；若做不到，材料判定为尚未准备好，不以不可比较的对照启动试验。

记录完成时间、首次被迫展开的位置、为完成任务必须操作的内部概念数、错误类型和引用。概念按冻结字典计数（例如 occurrence、admission、retained evidence 各一个），并区分“阅读到”与“必须正确操作”。可选探索不算被迫负担。入口简短但依赖丢失仍判失败。

## 八个场景与两个源码 diff

参与者材料中只出现两个源码 diff：sample→population 的不等价评分改动，以及保持 sample 语义的等价改写。其余场景变化只来自输入、政策、时序或宿主结果。场景使用中性编号，不以 mutant/reject/pass 等名称泄露答案。

| 场景 | 参与者需要判断的变化 | 隔离 oracle 所判断的要点 | 证据准备状态 |
|---|---|---|---|
| C1 | 节点 ID/拓扑不变，评分实现改动；阈值附近输入 | 实现确已变；独立结果不等价；不能凭拓扑或旧收据放行 | 已有真实 runtime 评分 mutation；需去答案化材料 |
| C2 | 同拓扑的等价算法改写 | 实现变、限定事实下后果不变；等价证据不证明作者身份 | 已有等价 mutation；需限定 claim 的输入/政策范围 |
| C3 | 多输入 fan-out/fan-in，两批 revision 交错，其中一条政策分支尚未完成 | 不得混合 revision 或把部分分支当作完整支持 | 已有交错案例；**还需 memory 暂停点捕获**，不能从终态倒装出观察 |
| C4 | receipt/currentness 与本次 occurrence 不一致 | 证据可能真实但已不适用于当前 occurrence，不能放行 | 已有 stale-current 案例 |
| C5 | 已确认的同一 effect 被 replay | 区分历史成功和本次新增执行；不能再次产生 effect | 已有 replay 与独立读回证据 |
| C6 | host 短写，随后展示退订并重新订阅 | 有部分外部结果但义务未知/待结；订阅变化不补齐 outcome | 短写已有；**退订组合需 memory 捕获**，没有本组合真实 I/O 的新证明 |
| C7 | 缺少本次 verifier 证据，作者 provenance 也缺失 | “现在可执行？”否；“谁改？”未知；两种缺失不可互相替代 | 已有缺 verifier 案例；provenance 缺失按原始事实呈现 |
| C8 | 无实现修改且全部必要事实有效的普通输入 | 允许正确的正常路径；防止全部回答拒绝/未知获取高分 | 已有 baseline |

本表是审阅者答案说明，**不得进入参与者文件系统或材料**。错误 admission/outcome、缺失分支、缺失 terminal report 等完整功能负对照仍由已有 23 场景证明；八题不声称穷尽该矩阵，也不再加入第三个源码 diff。

C1/C2 的源码与精确执行 binding 由 TS 提供，golden 由 root 独立计算并固定；禁用 candidate authority、评分函数和 admission helper 生成 goldens。独立 verifier 的源码依赖检查、已知正负样例和损坏证据拒绝测试均是准备 gate。

## 材料、公平性与隔离

保留 B139 的上限：八场景、两个源码 diff、至多 20 个业务/边界展示单元、至多 40 条关键事实。分组投影必须列出成员 ID、内部边与跨组边，并能追溯完整 62 节点 snapshot；“20 展示单元”绝不声称 runtime 只有 20 节点。P 组对应真实函数/调用边，不伪造为 Graph 节点。

事实预算分为最多 8 条共享事实及每场景最多 4 条特有事实（8+8×4=40）；每条必须是一个可判断命题。源码 digest、检索定位符单列为引用元数据，不能把额外政策命题塞进元数据或一个 JSON 巨块规避上限。若充分事实装不下，离线材料 gate 失败并回报设计冲突；不删掉影响授权的事实。准备交付必须附逐条 G/P 对照和字节/行数清单。

所有角色都能在同样的检索预算内展开同组材料；各角色默认视图不同，但关键事实、diff、原始收据的信息权利一致。G/P 等价映射由独立检查审查，不能只凭生成器自己输出“相等”。无法等价的事实标为阻断项。

隔离要求：参与者只挂载冻结的只读材料包与可写答案目录；无仓库、历史聊天、oracle、测试期望、原始实验 verdict、网络和非必要工具访问。隐藏 oracle 仅由评分进程持有。必须用答案 canary 和路径/检索负测证明无法读取。共享 cwd 加文字 allowlist 不算隔离；现成 subagent 继承上下文也不算。当前机制若无法满足，就停在离线准备，不以另一种弱隔离替代。

材料生成不能导入含 verdict 的 README、mutation 名称、预先高亮的错误点或最终状态标签。有效性所需的原始事实应保留；例如缺 verifier 本来就是任务事实，不能为了盲测伪造存在。

## 两阶段流程与样本预算（均为提案）

建议 12 名人类参与者和 12 个全新 agent sessions，分别按下表配置。两类群体单独分析；agent sessions 不是 12 个独立人类，也不能证明跨模型泛化。

| 每一类群体 | G 组 | P 组 | 合计 |
|---|---:|---:|---:|
| 普通用户 | 2 | 2 | 4 |
| 框架作者 | 2 | 2 | 4 |
| library 维护者 | 2 | 2 | 4 |
| 合计 | 6 | 6 | 12 |

每格两人分别使用 O1=C1,C4,C2,C7,C3,C8,C5,C6 与 O2=O1 逆序。招募先按冻结的角色经验问卷入组，再用预登记 seed 分配 arm/order；人类熟悉 GraphReFly 的程度记录并按组报告。不得看表现后换组或补样本。agent 使用相同模型版本、推理与工具配置，仅任务角色说明不同。

流程：10 分钟导览 → 10 分钟角色入口任务 → A 阶段八题各最多 4 分钟 → 封存全部八题答案及 hash → B 阶段八题各最多 2 分钟 → 5 分钟反馈；共 73 分钟，75 分钟上限。不能在 A 阶段任何题完成后提前展示该题收据，否则会给后续题泄题。

A 每题回答：直接实现变化、可能后果、独立支持的不变项、未知项、现在 effect 能否执行，以及“若补齐哪些证据才可执行”。引用事实 ID。B 才提供 verifier 和真实 outcome，回答其能证明什么、不能证明什么、是否还存在义务。预测结果与当前执行授权是两个字段；不能把“预计将通过验证”当作当前 admission。

agent 建议固定 `gpt-6-astra`，执行前必须记录可复核的实际版本/返回标识、推理配置与完整工具定义；仅模型别名不足以宣称不可变。每 session 最多累计 48,000 input tokens（含工具返回和重复上下文）、8,000 output tokens、80 次工具调用、75 分钟。预算耗尽按未完成保留；无自动重试。版本不能固定时明确其复核限度，并在执行 manifest 审阅时解决，不能悄悄替换模型。

本稿不包含 provider dispatch 或收费授权。离线准备最终列出 12 个 sessions 的具体配置、总 token 上限、报价来源、总费用上限及一次性执行范围；人类名单/同意/时间也在执行前落实。

## 评分及结果解释

评分单独保留以下维度，禁止用平均分补偿安全错误：

1. 错误允许 effect 的次数；错误宣称 lifecycle 已结束的次数。
2. 无证据宣称后果不变、作者确定的次数；漏判应允许的正常路径次数。
3. 五类判断的正确率与有效事实引用率。每个判断拆为可检查命题；结论和适用引用都正确才得分。
4. unknown 校准：只在事实确实不足时得分。全部答 unknown 或全部拒绝无法获得正常路径及已知变化的分数。
5. 时间、完成率、强制概念负担与首次展开位置。超时/空白按未完成计入固定分母，不能删除失败者。

自由文本由不知道 arm 的两名评阅者按冻结 rubric 独立归类，分歧及裁决理由保留；引用与结构化字段可由 deterministic scorer 检查。不得用单个 LLM 自评作为真值。准备阶段通过人工校准例句检查可用性；看到参与者结果后更改 rubric 必须保留旧分数并注明该批不再属于预登记结果。

输出每个 role×arm 的逐人结果和描述统计，人类/agent 分开；每格 n=2，不进行显著性或总体优越性宣传。建议把“无关键安全错误、各角色的有证据正确率未低于 P、普通用户没有被迫操作 identity/authority 内部概念”作为下一轮推广的必要观察条件，**不是 B121 新的通过门槛**。满足也只支持本 consumer 的有限试验；不满足则报告具体误解/入口缺口，不能称全部失败或自动要求架构重做。

两个 arm 同时改变了图表示、源码组织和使用入口，无法把收益唯一归因于图形或渐进披露。若必须识别单一因素，需要后续额外对照设计，本批不展开。

## 既有验收的对应关系

| 目标 | 本批已有 / 将提供 | 不可外推 |
|---|---|---|
| 可组合性、单 authority、原 capability | 既有实现和测试；角色入口任务核查使用理解 | 用户完成任务不取代运行不变量测试 |
| 分级隐藏入口 | 三角色默认入口、强制概念数、展开轨迹 | 不声称隐藏代表移除生命周期或依赖 |
| diagnostics off/summary | 两种诊断设置与三角色是不同轴 | 六种展示组合不是六套独立 assurance runtime |
| 53/54 owned manifest | 已解释 53+4+5=62；summary 静态多一节点 | 不自动关闭完整 assembly manifest、性能或所有 lifecycle 验收 |
| source change / provenance / consequence | 两 diff、未知校准、独立证据解释 | digest 不证明谁改；限定输入等价不证明所有输入等价 |
| actual effect admission | 既有真实 runtime mutations、独立文件读回与 replay | 参与者的“允许”只是答案，不是实际执行 grant |
| B121 整体 | 提供比较准备与有限认知证据 | 不自动 complete；公共入口、正式性能等剩余条件保留 |

## Q5–Q9 设计审查

### Q5：抽象与层级

这是 root 的 consumer 验收方法，不是 library 新的观测 primitive。材料投影是纯展示，保留原始关系和证据引用。spending-alerts 的领域政策仍在应用层，不因名称位于 solutions 而获得通用性。角色切片取自现有入口（`graphrefly-ts/examples/spending-alerts/causal-entry.ts`），不创建新的 authority。

### Q6：长期风险与不变量

INVARIANT：先封存全部 A 才能读取 B；oracle 不出现在参与者可访问路径；材料绑定同一源码与政策版本；退订不结算义务；G/P 事实等价。源码升级后只重建受影响材料并重新绑定，旧答案不能沿用为当前证据。维护成本集中在一个有限 fixture 与 rubric，不给 runtime 增加计时、缓存或 registry。

### Q7：简化、响应式与可解释性

展示从当前 snapshot、输入和收据纯投影得到，不提供 imperative effect 按钮。最小关系是 arrivals 与 current/policy → assessment/authority → publication/host boundary。聚合视图必须能展开精确节点和跨组边，防止漂亮但与运行无关的图。现有构造关系见 `causal-preset.ts:30`、`causal-focused-host.ts:28` 和 `solutions/causal-occurrence/construction.ts:22`（均 TS 仓库）。参与者答案是离线记录，不反馈驱动 Graph。

### Q8：备选方法

- **复用 walkthrough**：`existing agents → questions → summary`。优点是便宜、可快速找文档问题；缺点是已知答案、共享环境、无法支持公平比较。先例是本项目已完成的三角色 walkthrough，不将它当实验。
- **隔离双组试验**：`frozen facts → G/P packets → sealed A → B → independent scoring`。优点是边界可复核、控制提示、覆盖三角色；缺点是隔离与材料需准备、小样本只支持局部判断。本次推荐；实现不借用 runtime primitive。
- **多因素大样本试验**：`graph view × entry layering × role × implementation`。优点是可分辨各因素收益、提高统计能力；缺点是需要更多样本、对照和预算，当前不是必要前提。这些是研究方法选择，不是重开此前架构 A/B/C。

### Q9：推荐与覆盖

| 审查项 | 双组试验覆盖 | 剩余处理 |
|---|---|---|
| Q5 owner/层级与应用特异性 | 是 | 不新增 public solution |
| Q6 隔离、先预测后收据 | 有条件 | 离线 canary/封存 gate 通过才具备执行资格 |
| Q7 原图可解释性与依赖保留 | 有条件 | 精确成员/边映射 gate；不删依赖来缩图 |
| Q8 公平与低成本 | 部分 | 24 sessions、单 consumer；分别报告人类/agent |
| 泛化与单因素因果归因 | 否 | 明确接受小试验限度，不据此宣称全局收益 |
| 正式性能与公共 API 收口 | 否 | 保持已有 sequencer 状态，不混入本批 |

推荐双组试验，因为它能直接验证用户提出的分级隐藏与可理解性，又不往 library 增加运行负担。最大剩余风险是材料隔离不可用及样本外泛化不足；前者是准备阻断项，后者是结论边界。

## 一次批准后的完整离线交付

1. 固定八题、两 diff、事实清单、源码 binding 和两组等价映射；补 C3/C6 memory 暂停点，保留新旧证据边界。
2. 完成三个角色的入口材料、最多 20 单元投影与原始边追溯；提供独立 verifier/golden、评分 rubric 和校准样例。
3. 完成答案封存、隔离 canary、信息泄露与损坏证据负测；离线测试不得携带真实 inbox/provider 能力。
4. 独立 QA 检查 fairness、评分、隔离和角色依赖；按所改代码运行必要离线 gates。若无新 library 代码，不为方案准备重复全量性能矩阵。
5. 提交可复核包、hash manifest、QA、差距表和具体执行申请；一次汇报准备结果。任何新公共 API 或语义改变回到设计审阅，不在工具修补中偷偷实现。

本次仅提交审阅稿和静态前提核查。对本稿的批准不覆盖真实实验、provider/spend 或 B121 关闭。
