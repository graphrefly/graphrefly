# B121 v8 单次结果：4题完成，3通过、1失败

## 结果

| 任务 | 生成轮数 | 单独编译 | 原标准静态评分 |
|---|---:|---|---|
| 显示当前值 | 24 | 通过 | 通过 |
| 组合两个实例 | 14 | 通过 | 通过 |
| 验证后交接 | 24 | 通过 | 通过 |
| 卸载显示后的检查 | 25 | 通过 | 失败：真实实例的输入类型不兼容 |

[最终四样本表](live/review-verified-summary.json)。四题全部提交，无中断、无未运行，没有模型补答或答案修订。主助手逐项核对冻结源码并通过既有review入口重编译；不声称独立审查或运行时行为证明。这些仍是已曝光开发题，3/4不是library泛化易用性成绩。

## 第四题发现了什么

答案手写的`ComposedSpendingInstance`将`capabilities.retained.retainedQuiescence`声明为`SpendingAlertsView["publication"]`，即`Node<Publication>`；实际library返回`Node<CausalQuiescence>`。答案本身用类型断言读取，因此单独编译未暴露传参问题。

在原冻结编译环境中追加一个仅做类型检查的调用：将真实`spendingAlertsFor(...).compose(...)`返回类型传给答案的`inspectSpendingInstance`，得到TS2345。两种Node类型不兼容，真实目标实例不能作为函数参数传入。

[补充接入诊断](live/consumer-probe.json)和[原标准评审](live/candidate-entry-04.review-verified.json)分开保存。原编译“通过”没有被改写；`host-boundary-evidence`判失败，因为原题已明确要求接收真实实例并返回其retained quiescence。其余5条静态逻辑满足。补充probe用于确认既有要求下的缺陷，不作为新增评分标准，也未用于修改答案。没有执行参与者代码。

## 对后续改进的意义

- **模型答案问题**：自行重写library返回类型写错，不能归因于provider或网络。
- **harness验证缺口**：单独编译答案不足以验证真实调用兼容性。后续版本应在运行前登记consumer调用类型检查，避免靠人工偶然发现；旧答案及成绩不回写。
- **library候选改进**：评估是否需要更容易导入的实例类型或文档中的类型推导示例，减少手写返回结构。现有ReturnType可以表达真实类型，本次尚不能证明必须新增公共API；不据一次失败直接改library。

## 费用与授权

本次91个生成HTTP请求：4个资格请求＋87个任务请求，无provider失败、无重试、无新增未知预留。2个key GET与1个provider价格GET另计3次只读元数据请求。

- 本轮已报告费用：$0.108761832，与key用量差一致。
- 累计已报告费用：$1.501084492。
- 历史未知预留：$2.549442，释放$0。
- 保守总占用：$4.050526492；$4.50下余$0.449473508。
- 外部key剩余约$0.491733524，上限仍$1.97。

[费用账目](live/billing.json)、[执行授权](live/execution-approval.json)、[manifest](live/manifest.json)。用户本次批准的一次运行已完成，不自动开始下一轮。

## 审阅与验证路线

1. **唯一代码变化**：root `scripts/b121-comparison/api-provider.mjs`的累计费用上限，所有调用者使用同一常量；历史费用和未知预留都仍计入准入。
2. **失败证据**：[第四题评审](live/candidate-entry-04.review-verified.json) → [真实调用类型诊断](live/consumer-probe.json)，区分单独编译与真实接入。
3. **可复核记录**：[200测试与4模块预检](offline/verification.json)、[journal及33代码绑定核验](live/verification.json)、[最终摘要](live/review-verified-summary.json)。保留全部四份原回答、源码引用和编译回执。
