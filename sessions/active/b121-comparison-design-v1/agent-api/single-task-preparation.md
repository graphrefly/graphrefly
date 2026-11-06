# B121 单任务开发调度与材料检查：离线验证

2026-09-17。实现范围来自用户对[下一轮准备](next-round-draft.md)的“继续”授权。沿用project-governance、BMAD build/QA与既有B121工作；不新增工作编号、评分标准或支出授权。基线位于`/tmp/b121-single-task-baseline`，保留此前所有dirty修改。

## 调度入口

`runCampaign({approval,apiKey})`仍验证冻结的manifest、bundle与既有费用／重试授权。可选`approval.sessionIds`必须恰好包含一个既有comparison或entry的session ID；空列表、重复／多个、未知ID或错误类型在调用provider前被拒绝。选择写入原有approval与journal claim，不是由参与模型决定。

存在选择时报告`executionMode: single-task-development`与明确的`scheduledSessionIds`。只执行该任务；其余17组记录为`not-selected`。被选中但因资格／基础设施失败未运行的组仍为`unrun`；两类数量分开。所有18槽位仍出现在结束journal，评分分母未重定义，明确不能将选择性开发执行当正式比较结果或跨尝试拼接成绩。

资格检查仍保留：单任务不等于一次API调用。实际consumer离线测试使用假HTTP，证明4次资格请求后只进入1个目标任务。开发选中entry不会先跑12组comparison；选中comparison也不会继续entry。原exclusive claim、失败持久化与离线代码评分沿用；没有新增自动重跑循环。省略选择仍兼容原整套开发执行，**不代表正式轮可以启动**。

## 材料检查入口

`auditMaterialCoverage({files,entrypoints})`只接受显式路径到内容的映射，输出文件摘要、字节／行数、入口与引用状态：included、missing、restricted、external、outside-root或ambiguous。检查TS import/export、动态literal import、require、import-equals、类型导入、三斜线引用和常见Markdown链接。

不会自动读取引用文件或扩容材料，也不会产出可运行包。fixtures、oracle、测试、golden、内部设计记录等路径只作为审查信号；名字普通的文件仍可能泄漏答案。完整TS模块解析、所有Markdown语法、锚点验证和内容泄漏审查不在自动保证范围内。报告始终`executionReady:false`，不能凭“没有missing”开启正式测试。

对旧冻结9源码的实际检查见[报告](material-coverage-report.json)：README入口缺失，19处included、48处missing、3处external引用。仅在审计用映射加入当前README后，23处included、52处missing、1处restricted、3处external。**这是引用出现次数，不是唯一文件数**；未改旧bundle或为参与者加入README，也不据此断言任务不可答。报告绑定冻结bundle及审计器摘要。

## 验证与审查

- `node --test scripts/b121-comparison/*.test.mjs`：156/156通过；全部HTTP响应为合成测试数据，没有付费provider调用。
- 三个独立只读审查角度完成。修复了URL编码绝对路径误判、import-equals与三斜线依赖遗漏；补上实际comparison单任务调度验证。未发现新的调度／费用边界缺陷。
- `api-prepare.mjs`重新生成当前未启用proposal的源码绑定；没有改动历史run。当前proposal不是正式评测冻结产物。
- 原始任务、rubric、library源码、已留存答案／收据不变。未调用真实模型，也未释放未知费用预留。

## 审阅路径与下一步

先看`api-campaign.mjs`的选择验证与两段任务循环，再看summary／journal如何保留未选择与未运行。随后看`material-coverage.mjs`的只读输入边界及分类；对应实际消费者测试在`api-campaign.test.mjs`，材料边界测试在`material-coverage.test.mjs`。

正式材料仍需按同一规则构建并审查，正式保留题和隐藏rubric、样本数、资源与费用状态仍未就绪。现在具备离线准备工具；不把工具通过误报为library或参与模型通过。
