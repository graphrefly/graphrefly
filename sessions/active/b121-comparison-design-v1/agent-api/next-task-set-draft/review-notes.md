# 离线接线、独立审查与校准

2026-09-18。归属原B121，本次仅本地准备与验证；provider调用0，费用0，不修改library。

## 独立审查

`new_task_rubric_review`在未参与旧调优的独立上下文中审查冻结源码及新任务。属同模型家族的独立上下文审查，不是独立真人/机构，也不能证明训练数据未见。其四项发现已在reviewer-rubric.json修正；原reviewer-rubric-draft.json保留历史。

- 接受graph.topology()和已有topologyFromDescribe(graph.describe())两种等价路径，避免过窄评分。
- 明确要求解释实现/结果/许可边界，不能以“没有说错”代替作答；证据改用README。
- 要求使用真正导入的库输入类型，不能仅凭结构兼容判定已正确发现API。
- CID相等不构成碰撞无关的payload相等证明；哈希可配置。

复核确认四项已解决。随后独立审查10份作者校准代码，确认4正例、3语义反例和3缺导出反例分类。结构语义反例同时违反structural-api及full-structure；业务语义反例同时违反result-branches及preserve-order-identity。fixtures中的violatedCriterion仅为目标缺陷，非穷尽失败清单；完整静态判定见review-calibration-results.json。

`denominator_edge_review`独立检查campaign总数修改，无新增发现：空任务/重复ID仍被拒，样本增删/重排仍绑定冻结任务，伪造denominator仍在请求前拒绝，授权仍绑定完整manifest。第三个验证审查任务创建遇到agent thread limit，因此由主助手完成验证缺口检查，不声称三路独立QA。

## 运行证据

- `node --test scripts/b121-comparison/*.test.mjs`：207通过，0失败/跳过。新增三样本完整合成campaign及伪造denominator在零请求前拒绝测试；旧四题测试保留。
- `calibrate.mjs`：现有candidatePreflight三题3/3通过。10个案例通过实际broker合成响应→提交→assessment→consumer编译路径，未接触provider，未执行提交代码。
- `review-calibration.mjs`：原review入口复编译10份，4接受、3静态拒绝、3consumer编译拒绝。正反例是Codex作者校准材料，不能当模型结果。
- 每个participant packet只来自原材料和公开任务约定，未包含评分文件、consumer模块或校准答案；检查覆盖文件名和特定probe文本，不把这个有限检查称为全信息流证明。
- 新manifest固定三样本，资格请求仍为四次，模型/provider、预算策略、重试和连接策略沿用。费用仅引用v11结束快照，启动前必须刷新；本记录没有释放任何预留。

## 能证明与不能证明

consumer模块能拒绝缺导出和不兼容调用。结构类型仍允许额外字段，类型兼容也不能证明引用保留、无副作用或语义正确，因此三份能编译的反例必须经静态审查拒绝。没有新增运行时行为证明，也没有把这些任务称为独立作者的holdout。

审核顺序：任务/当前rubric → 校准结果 → manifest样本与policy → 测试日志。新增题目扩大TS接口覆盖，不直接对比旧四题成功率。
