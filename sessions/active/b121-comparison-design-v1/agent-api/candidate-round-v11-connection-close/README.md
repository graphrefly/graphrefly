# B121 v11：连接关闭策略的单次开发运行

用户确认累计$5.50，包括全部旧费用与未知预留，执行一次固定四题。key限额$1.97，不充值/重置。v9/v10五份材料、四题包、consumer契约和原16静态标准保持一致。

本次启用B121私有http1-connection-close-v1，每次尝试含重试都要求连接完成后关闭。它已通过120个loopback请求的对照，但没有证实远端故障根因。模型/provider/session预算/有界重试不变。

[206测试及复用资格证据](offline/verification.json)、[冻结](frozen-candidate.json)、[本次授权](live/execution-approval.json)、[manifest](live/manifest.json)。原v10结果不改写，不补失败题；曝光开发题不声称未见holdout。

[单次运行已完成](live-report.md)：4提交、4通过，第四题真实consumer检查通过。93请求无传输失败/重试；本轮费用$0.128393412、无新未知预留。仍是曝光开发题，不是正式holdout结果。

[离线检索复盘与下一步](followup.md)：四题重复读取源码行不足1%，单次最大输入约6.5万–6.9万；三题由累计预算预留触发提交。列出library改进假设和新任务准备顺序，不追加生成或改变旧评分。
