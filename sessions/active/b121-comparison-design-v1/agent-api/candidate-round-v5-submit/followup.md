# B121 v5 后续：把复盘反馈到文档

## 范围与归属

用户在v5结果后要求继续。本轮是B121既有工作下的源码核对、文档修正及离线证据，不是新协议、API设计或执行授权记录。TS包拥有示例README，root保留本轮复盘证据。没有新D#、没有更改工作完成状态、没有provider调用。

现有实现已具备精确实例关联路径：`causal-graded-demo.ts`通过每个实例实际publication.authorityId定位节点，并关联该实例host保留的request/admission/outcome；`spendingAlertsFor`转交应用准备好的输入和resource，不通过名称复制或重绑资源。因此证据支持先澄清使用路径，没有证明需要新增library接口。保留graphrefly:D792的既有受众/能力边界；未改变协议规则。

## 已修改与验证

唯一产品材料改动：[TS示例README](/Users/davidchenallio/src/graphrefly-ts/examples/spending-alerts/README.md)。

1. **资源身份**：明确名称不创建独立输入、资源或授权；immutable defaults不是共享运行实例。
2. **共享图检查**：给定原始app和owning Graph，保留完整describe结果，从app自身publication精确取得authorityId；publication尚不可用时保留缺失，不按后缀选另一实例。
3. **证据边界**：host结果会进入图内publication；保留request关联，区分非原子观察、host readiness和实际终止。

局部三种审查视角直接完成，未声称独立代理审查。核对缺失publication、同图多个实例、默认配置复用及host/graph观察时间差；没有新增协议/运行时行为。静态文档未新增措辞断言测试，也未重跑整个TS运行时测试套件。

[验证证据](followup-evidence/verification.json)：新片段由v5冻结TS编译器检查通过；现有完整离线demo执行通过，A在B成功后仍pending=1，A/B各写1次；12个本地文件链接和2个页内锚点有效，git diff --check通过。v5五份材料和33个代码绑定摘要保持不变。保存修改前后README、脚本、demo结果及编译子进程收据；历史运行和评分未修改。

## 评测覆盖缺口：下一版的开发候选，不是本轮追改

以下是根据已看过答案发现的测试设计候选，因此即使换题面也不能自动称为未见holdout。尚未制作新题、冻结评分或付费运行。

| 覆盖目的 | 输入/情境 | 建议在新版本预先规定的可观察结果 |
|---|---|---|
| 精确实例关联 | 同图A/B均有authority节点；B不是首次匹配项 | B报告使用B的实际证据ID和host记录；改变节点枚举顺序不改变归属 |
| 完整结构输出 | 图中同时有展示、生命周期、保留证据和其他实例 | 检查结果保留完整owning graph的nodes/edges；汇总统计可附加但不能替代 |
| 证据尚未发布 | 指定实例尚无publication，但另一实例已发布 | 返回明确缺失，不借用另一实例；缺失不等于未提交或成功 |
| 配置与资源分离 | 两次compose复用immutable defaults，给定各自输入与resource | 只更改声明的局部选项；不把name宣称为资源或授权隔离机制 |
| 多处结果观察 | host有outcome，图中也可见对应publication | 精确关联request，解释二者非原子、可能暂不同步，不宣称只有host可见结果 |

原4/4只适用于冻结的原标准。新增标准需在下一版本运行前冻结，所有失败保留，不能重试直到通过。正式泛化评估仍需单独准备未参与调试的新任务和材料访问边界。

## 下一步边界

文档更新已落地，但“是否改善模型表现”仍未验证。下一项有价值的工作是按上述覆盖缺口准备新的开发任务与确定性检查，再冻结执行；继续重复旧四题本身无法弥补评分盲点。本文不是运行授权或新成绩。
