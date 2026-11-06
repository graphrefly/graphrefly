# B121：原预算内预留提交的开发回归

## 结果与范围

**4/4提交，4/4通过冻结编译及原有12项静态评分标准。** 四题各运行一次，没有重跑模型或修补答案。第三、四题在预设的submit-only阶段提交；第一、二题自行提前提交。材料、题目、rubric、编译器、模型、provider及硬限额均与v4一致。

这是已曝光四题的开发回归，formalReady=false。编译和源码审查不是运行时验证，单次结果不能证明提升全部由本轮策略造成，也不是library通用成功率。保留v2/v3的0/4和v4的1/4。

| 任务 | 生成轮数 | read/search | 累计输入token | 提交阶段 | 最终静态评审 |
|---|---:|---:|---:|---|---|
| display-current-values | 6 | 9/0 | 78,622 | 自行提交 | 3项通过 |
| compose-two-instances | 11 | 23/0 | 263,276 | 自行提交 | 3项通过 |
| validate-before-handoff | 22 | 44/0 | 878,494 | submit-only | 3项通过 |
| inspect-with-detached-display | 23 | 43/1 | 909,533 | submit-only | 3项通过 |

[最终四样本评审](live/review-verified-summary.json)、[逐会话证据](live/session-observations.json)、[实际最终提交请求](live/final-submission-requests.json)。原始campaign summary仍为pending-review，评审单独保存。

## 唯一实验改动

用户在v4结果和预留提交建议后回复“那继续”，授权本次固定四题开发回归，沿用累计$4（含历史费用与未决预留）。

- 检索保留4,096输出token；当剩余检索输出额度≤1,024时提前进入submit-only，避免派发只有1～4token的无用请求。
- 剩余操作≤16时切换；单批最多16项，因而至少留下一个提交操作。最后一次生成机会同样切换。
- 剩余输入≤当前请求估计的两倍+65,536时切换，并重建、重新估算最终请求。这是提前切换的启发式，不保证最终请求一定能准入。
- submit-only仅接受一个submit；继续检索或无效提交终止该参与者，不补发修复请求。原有累计输入1M、输出8,000、80操作、80生成轮、75分钟以及费用检查全部继续执行。
- 五份材料制品与v4逐字节相同。没有library运行时修改，没有压缩原始证据或注入答案。

## 审阅路线：目的 → 实现 → 风险 → 验证

1. **在原预算内留下提交机会。** [策略定义](/Users/davidchenallio/src/graphrefly/scripts/b121-comparison/api-runner.mjs:47)明确预留和阈值；[阶段切换](/Users/davidchenallio/src/graphrefly/scripts/b121-comparison/api-runner.mjs:293)调整单次输出；[终止规则](/Users/davidchenallio/src/graphrefly/scripts/b121-comparison/api-runner.mjs:440)拒绝最终阶段继续检索。输入估计仍是启发式，最终请求仍可能被硬限额拒绝。
2. **冻结比较边界与保留失败。** [会话绑定](/Users/davidchenallio/src/graphrefly/scripts/b121-comparison/candidate-entry.mjs:125)及[campaign绑定](/Users/davidchenallio/src/graphrefly/scripts/b121-comparison/candidate-campaign.mjs:93)将策略纳入摘要。[manifest](live/manifest.json)绑定完整材料及执行代码；不替换失败样本。
3. **验证与原样评分。** [测试入口](/Users/davidchenallio/src/graphrefly/scripts/b121-comparison/api-runner.test.mjs:1609)、[验证收据](live/verification.json)：197/197通过，三路独立审查发现并修复接近输出预留线的小请求边界，八种边界组合通过。所有实际dispatch反馈、journal哈希链、代码和材料摘要通过回读验证。可直接查看最终提交请求，观察第三/四题分别在余193,206/160,687输入token时切换，没有追加额度。

## 静态审查保留的局限

独立审查按冻结规则评分，不因看见答案而补充条件或修复答案：

- 组合题解释把名称和独立输入/资源隔离混在一起；实际上独立输入及资源由题设预先提供，代码符合此前提。
- 检查题读取完整graph.describe()，返回结构统计而非完整快照；原标准要求检查完整图，没有要求原样返回快照。以后若要检查输出完整性，应在新版本预先明确。
- 检查题“只有host才能观察物理结果”的说法过宽，因为结果也传播进图中保留证据。
- 检查题按后缀定位authority，在多个实例共用图时可能选到另一实例。本轮host记录仍来自给定实例，原有host/unknown结论通过；这仍是值得后续覆盖的真实局限。

因此4/4并不等于答案无缺陷。后续可研究实例作用域检查入口/示例、澄清名称与资源身份的文档，再以新的预先冻结任务验证；本轮不直接改变library API或追改评分。

## 离线复核脚本事件

初次离线review脚本给了不存在的receiptRoot，子目录claim在编译进程启动前失败；四份初始review均记录harness-failure。原campaign内编译已正常通过。修正父目录后，用完全相同的答案/编译器/rubric做单独离线复核，四份均通过。没有模型调用或答案修改。

[事件记录](live/review-setup-incident.json)、[初次失败汇总](live/review-summary.json)、[复核汇总](live/review-verified-summary.json)同时保留。这是本轮编排失误，不能抹掉，也不应归因于模型或library。

## 费用

[账目](live/billing.json)：66次生成调用（4次资格+62次任务），无provider失败，无传输重试，无实质新增未知预留。transport保留约1.5e-16美元浮点残差，原记录未改写。

- 本轮响应报告$0.0933252；key快照用量增量$0.061414872暂未对齐，采用较高的响应累计，不推定差额原因。
- 累计报告费用$1.196117224；未知预留仍约$1.9126272。
- 保守累计占用$3.108744424；累计$4下保守剩余$0.891255576。
- 外部key上限仍$1.97，快照剩余$0.82861112；没有改key额度或释放历史未知预留。

本轮到此结束，不自动启动下一版本或正式评测。
