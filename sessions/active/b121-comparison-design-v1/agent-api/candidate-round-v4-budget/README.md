# B121：动态预算反馈开发回归

## 本轮唯一实验改动

用户在上一轮结果和动态预算反馈建议后要求“继续”。沿用累计$4（包含历史费用及全部未决预留）执行一个新版本的固定四题开发回归。只有harness的输入发生变化：每次entry请求附带最新累计用量及剩余输入、输出、操作、生成次数与时间额度；解释历史和缓存输入仍按每次请求累计计量。

材料、文档、题目、评分规则、编译器、模型/供应商、硬限额和传输重试策略均不变。五份材料制品与v3字节一致，见[preparation.json](preparation.json)。反馈不包含答案，不保留过去的反馈消息，不压缩原始assistant/tool证据，不增加收尾请求。余额不足仍在发请求前停止。

这是已见题的开发回归；不冒充未见题正式评测，也不覆盖v2/v3的0/4结果。

## 结果

**1/4通过原有静态标准，3/4未提交。** 显示适配题使用既有`mountSpendingView`，没有新增library接口或由Codex修补参与者答案。

| 任务 | 轮数 | read/search | 累计输入token | 结果 |
|---|---:|---:|---:|---|
| display-current-values | 25 | 17/29 | 516,627 | 编译及三项标准通过 |
| compose-two-instances | 28 | 37/0 | 977,326 | 预算停止，未提交 |
| validate-before-handoff | 24 | 49/0 | 985,805 | 预算停止，未提交 |
| inspect-with-detached-display | 23 | 46/3 | 927,793 | 预算停止，未提交 |

显示适配题的独立只读代码审查依据冻结源码，判定current-values、missing-values、observation-lifetime全部通过。通过既有review入口重新编译并绑定准确assessment摘要：[评审输入](live/candidate-entry-01.review-input.json)、[评审结果](live/candidate-entry-01.review.json)。没有执行参与者代码，没有声称运行时行为已验证。

[四样本总表](live/review-summary.json)保留完整分母。原campaign summary仍保留采样时的pending-review，最终评审为单独证据，不回写原始结果。

## 能观察到的范围

显示题在累计516,627输入token后提交，相较前两轮未提交，这是一个正向观察。但仅一次每题、同一组已见任务、且含网络波动，不能确认改进全由预算反馈造成，也不能外推为library普遍更易用。

后三题的最后一次**成功响应所对应请求**可见剩余输入分别82,489、90,319和143,491 token，之后仍选择继续检索，下一轮准入被拒绝。详见[last-successful-request-feedback.json](live/last-successful-request-feedback.json)。不要把journal中预算拒绝前生成的最后状态当成模型已看到的状态；未dispatch的反馈没有到达模型。

本轮证据说明可见余量本身尚不足以让全部任务提交。下一项若研究预留提交机会，必须提前定义为独立策略和新版本，并保持总预算；本轮没有暗中追加最后一轮。这里不自动开始下一次试验。

## 费用与故障

[账目](live/billing.json)：105次生成尝试（4次资格、100次任务调用、1次网络失败后的额外传输尝试）。网络失败没有HTTP或生成ID，按原策略等待60秒并重试原请求。

- 响应报告本轮费用$0.109387848；查询时key用量增量$0.064183308，暂未对齐。使用较高的已报告累计来源，不推定差额原因。
- 累计已报告费用$1.102792024；全部未知预留$1.9126272，其中本轮新增$0.319488。
- 累计保守占用$3.015419224；$4下保守余量$0.984580776。外部key当时另有$0.935230532可用。
- 运行前key快照已经与v3响应累计对齐，但这不构成两笔v3无响应请求的逐笔结算，旧预留仍保留。
- 本轮2次只读key查询，没有修改外部key上限、没有释放未知预留。

## 审阅顺序

1. **模型输入和预算边界**：[api-runner.mjs:39](/Users/davidchenallio/src/graphrefly/scripts/b121-comparison/api-runner.mjs:39)声明版本和反馈含义；[api-runner.mjs:290](/Users/davidchenallio/src/graphrefly/scripts/b121-comparison/api-runner.mjs:290)在estimate之前添加最新状态，所以这段文字本身也参与计量。比较实验的输入不变。
2. **冻结与隔离**：candidate-entry和candidate-campaign将反馈policy加入contract摘要。独立会话从0开始；原assistant/tool消息、reasoning字段和tool-call配对完整保留。预算反馈只属于当前会话。
3. **证据与验证**：[verification.json](live/verification.json)、[逐会话观察](live/session-observations.json)及[manifest](live/manifest.json)。全套194/194通过；独立三路代码审查没有剩余实现问题。审查指出第三轮完整历史断言不足，补强为准确历史+assistant+tool的逐条比对后，受影响2项测试再次通过。不是增加token或改评分来修测试。
4. **评审与局限**：只对实际提交的1份代码按原3条rubric评分，另外3份没有代码可评。编译通过不是运行时证明；四题结果不是正式泛化成功率。此前失败、题目曝光和网络故障全部保留。
