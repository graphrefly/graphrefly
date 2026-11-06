# B121 v8：累计费用上限 $4.50 的单次开发运行

用户明确同意将累计费用上限从$4提高到$4.50，并执行一次完整四题。全部历史预留继续计入；外部key上限保持$1.97、不重置、不充值。

唯一执行代码改动：`scripts/b121-comparison/api-provider.mjs` 的 CEILING_USD 4 → 4.5。五份材料/题目/评分/编译环境/pins与v7字节一致；会话输入输出预算、工具、模型、provider、重试策略均相同。旧v7不改写、不恢复。

200测试通过、4模块预检通过；审查是本地主助手完成，不声称独立QA。见[验证](offline/verification.json)、[冻结](frozen-candidate.json)、[执行授权](live/execution-approval.json)、[单次结果](live-report.md)。这是已曝光开发题，不是未见正式holdout。
