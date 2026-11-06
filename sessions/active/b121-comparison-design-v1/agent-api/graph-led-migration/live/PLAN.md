# Graph 控制器首次真实开发回归

2026-09-18，graphrefly:B121。当前用户在迁移交付后说“好的，继续”，结合本会话已授权的修改、重跑及预算持续授权，执行一次固定两题开发回归。记录属于执行授权/尝试证据，不新增D#或工作身份。

- 任务顺序：report-node-version-metadata、consume-business-results；每题一个独立会话，不以通过补采。
- 材料、任务正文、rubric、consumer和编译器：逐字节复用 next-task-set-continuation 的5件冻结产物。此前错误答案不作为本轮输入。
- 条件变化：已通过离线验证的 Graph 控制器和 prepare_submit。此前新增的package README未加入本轮材料，不能据此检验文档改进效果。
- Provider：DeepSeek v4.1 Flash / Together，保留现有alias限制、限额、预留、重试与未知费用规则。当前累计上限11美元，外部key限额1.97美元不变。
- 结果：原始答案先落盘，冻结compiler/consumer编译；之后按原6项标准静态复核。未提交不虚构代码分数；基础设施中断保留未运行项；没有答案修复回合。
- 历史独立保留；本轮是已曝光题开发回归，不能称为holdout、统计成功率或library泛化证明。

## 启动前证据

两次只读metadata核对。初次preflight调用未创建caller-owned receiptRoot，留下preflight.json的ENOENT记录，无生成；创建绝对路径的目录后，两题预检通过，见preflight-qualified.json。未改动harness或冻结材料来处理此调用错误。

## 证据入口

manifest.json 与 execution-approval.json 精确绑定；freeze-verification.json核对历史材料和样本；outcome.json指向只追加的campaign目录。费用、静态复核和运行收尾记录在本目录。
