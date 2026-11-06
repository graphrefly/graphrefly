# B121 v7 单次运行：两份通过，费用准入停止

## 结果与审查方式

**2/4通过冻结编译与原静态标准，1/4执行中断，1/4未运行。** 全部分母保留；无补跑或答案修改。

| 任务 | 生成轮数 | read/search | 已报告累计输入token | 结果 |
|---|---:|---:|---:|---|
| display-current-values | 24 | 44/3 | 900,621 | 编译及3项标准通过 |
| compose-two-instances | 22 | 43/0 | 866,233 | 编译及4项标准通过 |
| validate-before-handoff | 2 | 1/0 | 2,035 | 第二次请求502，重试前费用准入停止 |
| inspect-with-detached-display | 0 | 0/0 | — | campaign已停止，未运行 |

[最终样本表](live/review-verified-summary.json)、[运行观察](live/session-observations.json)。输入token仅为有用量回执的部分，不推定502请求实际消耗为零。

原计划独立审查两份答案及停止账目，三个子任务均在产出判定前遭遇Codex使用额度中断。用户要求继续后，由主助手直接逐项核对冻结源码和rubric，并通过既有review入口重编译原始代码；这次不声称独立live审查。此前v7代码的独立三路离线QA仍是另一份有效证据。[中断说明](live/review-interruption.json)、[显示评审](live/candidate-entry-01.review-verified.json)、[组合评审](live/candidate-entry-02.review-verified.json)。未执行参与者代码。

## 当前限额可见性的观察

所有实际请求的currentRequest.maxOutputTokens都与payload.max_tokens一致，反馈保留原字段限制及单位，见[输出诊断](live/output-diagnostics.json)。

- 显示题在预设submit-only阶段提交：snippet3,535、explanation4,099 UTF-16单位。
- 组合题在submit-only阶段提交：snippet2,621、explanation4,402 UTF-16单位。
- 两份有效提交均在原字段上限以内。显示题本次没有再出现v6的空工具封装，但单个样本不能证明原因就是新反馈；本轮还包含网络重试。
- 检查题未运行，因此本轮没有验证v6那次解释过长问题是否减少。不能把“没运行”算成没有问题。

题目、材料、评分与v6逐字节相同；输出分配、预算、provider和重试规则均未改变。仍为已曝光开发题，不是未见holdout，不是library泛化成功率。

## 为什么停：两笔未知费用预留

[停止审计](live/stop-audit.json)与[账目](live/billing.json)：

1. 显示题出现一次`fetch failed`，没有响应或generation ID；保留$0.317622预留。按原availability策略等待60秒，同一请求重试成功，未替换样本。
2. 交接题第二次请求收到Together HTTP502，返回generation ID但没有费用用量；保留$0.3191928预留。
3. 此时累计保守占用$3.94176466，$4下仅余$0.05823534。重试需再预留$0.3191928，合计将达$4.26095746，因此在等待/HTTP重试前拒绝。并非生成调用次数达到上限。
4. campaign停止，检查题保留not-run。中断后用户“继续，刚刚断了”只用于恢复评分和报告，没有重启campaign。

这两笔新增未知预留共$0.6368148，**不是已确认收费**。Key仍有$0.600495356，余额并未用完；当前阻挡是累计授权下保守预留规则。

对本次502的generation ID做了一次只读费用查询，返回[HTTP404](live/generation-lookup.json)。404不能证明免费/未发生，因此没有释放任何预留。无ID的fetch失败也不能靠相邻请求或aggregate余额差来逐笔结算。

## 费用总账

- 本轮53次生成HTTP尝试：4次资格、49次任务尝试（47个有效响应、2个失败），其中包含一次按原策略完成的传输重试。
- 本轮已报告$0.067474464，与key用量增量一致。
- 历史加本轮累计已报告$1.39232266；全部未知预留$2.549442。
- 保守占用$3.94176466；保守余量$0.05823534。
- 外部key上限仍$1.97，余额约$0.600495356。没有改上限或买额度。
- 本轮两次key GET加一次generation GET，均不生成模型答案。billing.json写于generation查询之前，其metadataRequests=2只含两次key查询；stop-audit.json记录最终总数3。

## 审阅路线与结论边界

1. **有效答案**：看两份评审及[四样本表](live/review-verified-summary.json)，分开2通过、1中断、1未运行。代码编译和静态源码判定不等于运行时证明。
2. **harness输入**：看[诊断记录](live/output-diagnostics.json)，每次可见上限对应实际请求；没有为了答案追加额度或改验收。
3. **费用阻挡**：看[原始失败摘要与数学核对](live/stop-audit.json)、[费用查询](live/generation-lookup.json)。不要把保留预留写成实际烧掉的钱，也不要把404写成免费收据。

[验证](live/verification.json)、[最终核验](live/completion-verification.json)：完整journal哈希链、五份材料与33个执行代码摘要已核对。复用此前200测试及模块预检，没有声称本轮重跑。代码、任务和评分未改变，旧v6失败保留。

当前按原费用规则不能继续批准生成请求。下一步应先核对未决费用或审定新的费用预留方案；不能把“key还有余额”当作释放旧预留或重跑缺失样本的依据。本轮到此结束。

后续完成[8笔未决费用逐笔核对](reconciliation/README.md)：两笔有ID请求再次返回404，六笔无ID；用量未变化，释放$0。仅3次只读查询，无生成或补跑。
