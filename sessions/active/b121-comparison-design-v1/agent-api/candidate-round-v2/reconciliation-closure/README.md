# B121：身份提取修复与费用核对收尾

本次执行依据：当前任务用户“好的，你修，然后继续”，沿用累计 $2 边界。归类为 B121 既有工作下的修复、执行与证据；没有新建决策、改变协议、提高额度或改写旧实验。

## 审阅顺序

1. **错误身份**：`scripts/b121-comparison/api-transport.mjs:32` 的 `responseIdentity` 分开提取正文 id／X-Generation-Id 与 X-Request-Id／Request-Id。重复头由 Fetch 合并后仍拆出候选，冲突时单一 ID 为 null，完整候选及原始响应保留。不会改变模型回答校验、重试类别或费用预留规则。
2. **核对收尾**：`scripts/b121-comparison/budget-closure.mjs:15` 的 `closeBudgetReconciliation` 是显式传入证据的离线函数。404、无 ID、查询错误及待核账记录分别保留；本次核对可关闭，账目未知仍存在。函数不查询、不重试、不释放预留、不授权运行。找到匹配费用记录也需要核账，避免同一费用与 key 汇总重复计入。
3. **实际入口**：[新 manifest](manifest.json)绑定修复后33份实现源码，沿用五份候选材料和固定四样本。[准入记录](admission.json)来自 `runCandidateCampaign` 实际入口及 `readCandidateCampaign` 读回校验，四行均为 not-run / budget-not-admitted。此次仅执行预算准入，未加载生成密钥，fetch 防护确认零 HTTP 尝试；没有付费采样。独占领取已消费，不能重用这份 manifest 再调度。
4. **验证**：[verification.json](verification.json)：全套192项通过、0跳过；79份历史运行文件及五份候选材料摘要未变。三路独立评审已完成；修复了重复同名响应头隐藏身份冲突的问题。旧测试在临时副本中重绑当前代码，保留正式历史 manifest；源码漂移保护测试仍通过。

## 输入与观察

| 输入 | 结果 | 验证 |
|---|---|---|
| 503 正文没有 ID、响应头有生成及请求 ID | 失败 journal 保留两种身份，未知预留不变 | 实际 transport 回归 |
| 重复头包含两个不同生成 ID | identityConflict=true，单一 generationId=null，原头保留 | Fetch → transport → journal 回归 |
| 404／无生成 ID／查询失败 | 各自未知原因，关闭核对且保留预留 | closure 测试与本次证据 |
| 200 匹配零费用记录 | 待核账，不能自动释放 | closure 测试 |
| 重复证据、未绑定查询、预留总额不一致 | 拒绝 | closure 测试 |
| 预算不足或已耗尽 | 全部四个计划样本留在分母内，未调度 | closure／campaign 测试与实际准入 |

## 本次核对

仅新增一次只读 key 查询，结果见 [key-usage.json](key-usage.json)。复用已有逐笔404回执，没有无意义地重复轮询。费用汇总及证据绑定见 [budget-audit.json](budget-audit.json) 与 [closure.json](closure.json)。

- 已报告费用：$0.798574588；未决预留：$0.9541632。
- $2 上限下保守可用：$0.247262212；下一最大输出请求须预留：$0.319488。
- 本次释放 $0；新增模型生成0次；四样本未运行。

本次核对已结束，费用并未全部结清。后续真实采样需要可核账的结算证据，或用户明确调整累计额度，并使用新鲜快照重新准入。不能把“closed”解释成结算成功、评测完成或自动重试许可。

## 实现边界

核对函数接受可信调用方提供的审计数据；结构与摘要绑定不替代原始 journal 校验或供应商收据认证。它实现保守收尾，不是完整自动财务结算系统。本次没有 library 核心改动、没有新增模型答案，也没有新的易用性成绩。
