# B121：固定四样本调度已接通，费用准入未通过

2026-09-17（本地日期），继续既有B121评测准备。本次完成实际campaign入口与离线验证。**0次模型生成；2次只读费用查询。** 原题目、材料、rubric、编译快照、模型设置和累计$2上限未变。未声明B121或正式评测完成。

## 审阅顺序

1. **冻结与一次性执行**：[candidate-campaign.mjs](../../../../../../scripts/b121-comparison/candidate-campaign.mjs) 的 `prepareCandidateManifest` / `runCandidateCampaign`。[manifest](manifest.json)绑定材料、四个固定样本及顺序、提示／工具／限制、评分依据、原重试策略、实际实现文件摘要（包含CSP11共享adapter目录）和绝对输出根目录。原有one-shot授权须精确匹配manifest、路由、限制、费用坐标及有效期；不接受挑选子集或attemptId重跑。输出目录也在授权摘要内，不能换一个输出根目录绕过领取。没有自动CLI、密钥发现或自动授权；准备manifest不会发起生成。
2. **费用保护与完整分母**：沿用 `createOpenRouterTransport` 和四请求 `qualifyProvider`；不复制另一套供应商计费／恢复逻辑。已报告费用加未决预留纳入priorUsage。准入失败、甚至费用达到／超过上限，都可保存四行not-run；在这一步不会构造可调用transport或发出资格请求。费用快照须在一小时内。通过准入后才运行资格检查和顺序独立会话。
3. **原始失败不被修补覆盖**：[candidate-entry.mjs](../../../../../../scripts/b121-comparison/candidate-entry.mjs)新增共享 `assess`，离线replay和真实session共用冻结编译及绑定逻辑，记录类别分别为offline-candidate-replay / candidate-session。先持久化原始模型结果，再启动隔离编译。参与者失败保留并继续下一个既定样本；供应商、编译器、材料失败停止余下调度。材料诊断单独检查，不能被同时出现的参与者错误遮住。没有model-session重试、补采成功样本或按成绩修答案。编译成功仍是pending-review，不能当作rubric通过。
4. **崩溃读取与验证**：哈希链journal、独占领取、原始result、assessment与summary均持久化。`readCandidateCampaign`只读恢复；缺少finish的样本为interrupted-or-running，剩余样本保留；末行写了一半时保留完整前缀，不能据此重新dispatch。summary须与journal最终记录一致。证据完整性依赖可信存储与调用方；哈希不是数字签名。[真实入口测试](../../../../../../scripts/b121-comparison/candidate-campaign.test.mjs)使用fake HTTP穿过共享transport、资格检查、session和真实编译子进程，没有mock掉这些消费者。

## 测试与评审

- 全套 `node --test scripts/b121-comparison/*.test.mjs`：**184/184通过**。新增11项campaign测试覆盖四样本成功收集、参与者失败、供应商失败、资格失败、预算准入、额度达到／超过上限、manifest／授权漂移、改变输出根目录、编译失败、材料失败与父进程恢复。
- 最后强化恢复测试，额外确认summary篡改拒绝、末行不完整保留前缀；该测试单独再次通过，没有改被测代码。
- 三路独立只读评审指出并已修复：同授权换输出根目录能再dispatch；耗尽预算过早被adapter拒绝导致没有四行结果；材料错误被参与者fatal状态遮住。真实campaign故障测试验证只发生4次synthetic资格调用加1次synthetic样本调用，然后保留3个未运行项。
- 编译子进程原生崩溃的精确根因仍未证实；沿用[上轮隔离和失败保全](../process-boundary/README.md)，不以重复成功声称修复V8。

## 本轮费用核对

[账目审计](budget-audit.json)逐一定位三个未决预留的旧journal事件和请求预留值。这里纠正先前遗漏：503响应正文没有id、envelope.requestId为空，**但原HTTP头中有X-Generation-Id**。此次已按该id查询[逐笔记录](503-generation-receipt.json)，返回404；找不到记录不等于明确的$0结算。两次网络失败仍没有生成／请求ID。

[核对结论](budget-reconciliation.json)：

| 项目 | USD |
|---|---:|
| 当前key已报告用量 | 0.775756572 |
| 旧key已报告用量 | 0.022818016 |
| 已报告用量合计 | **0.798574588** |
| 503未决预留 | 0.3151872 |
| 两次网络失败未决预留 | 0.638976 |
| 未决预留合计 | **0.9541632** |
| $2上限下保守可用额 | **0.247262212** |
| 原transport下一次最大输出请求的预留 | **0.319488** |

没有释放预留，也没有把未知预留称作实际收费。[准入记录](preflight-admission.json)保留四个预定样本全部not-run，明确liveCampaignStarted=false、authorizationCreated=false；它是准备证据，不伪造一轮真实运行或人的授权。

## 当前边界

实际调度代码已接通；启动真实采样仍被现有费用边界挡住。需要可靠结算证据解决预留，或用户明确调整累计额度，才能重新完成费用准入。不能把再次“继续”解释成自动把$2提高，或把404当成零费用凭据。后续真正启动须重核费用快照，绑定届时的完整manifest与现有执行授权范围；不能直接使用过期快照。

四题各一个会话只提供预设任务上的观察；作者已看过先前试运行，这些题仍不是独立作者出的无污染保留集。实际模型答案与可信逐项评分尚不存在，没有新的library易用性成绩。
