# B121 v6 四题运行结果

## 结果

**2/4通过冻结编译及静态评分；2/4未形成有效提交。** 四题各一次，无补采、无模型修复请求、无答案修改。四题全部启动并结束，不能把collection完成当作任务全部成功。

| 任务 | 生成轮数 | read/search | 累计输入token | 结果 |
|---|---:|---:|---:|---|
| display-current-values | 21 | 41/0 | 779,434 | 工具返回空对象，未完成 |
| compose-two-instances | 22 | 45/0 | 886,592 | 编译与4项标准通过 |
| validate-before-handoff | 22 | 44/0 | 884,893 | 编译与3项标准通过 |
| inspect-with-detached-display | 26 | 33/0 | 901,051 | 解释超过字符上限，未完成 |

[最终四样本表](live/review-verified-summary.json)、[逐会话观察](live/session-observations.json)、[manifest](live/manifest.json)。原始campaign summary仍为采样时的pending-review/incomplete，独立评审结果另存。未执行参与者代码。

## 两类失败的证据与含义

### 显示题：检索阶段输出用尽且工具封装无效

最后一次请求仍处于retrieve-or-submit，输出上限1,802 token。响应HTTP200、normalized finish_reason=tool_calls，但native_finish_reason=length，completion_tokens恰好1,802。唯一broker调用参数为`{}`，缺少必需的requests数组；content为空，没有可挽救的提交代码。

当时会话剩余5,898输出token，其中4,096被留给未来提交，因此当前请求只分到1,802。其余阈值尚未触发最终阶段；无效工具封装按冻结规则立即结束，剩余预留没有机会使用。[独立审计](live/failure-audit.json)保留准确请求、响应、journal行和阈值计算。

这暴露了预留策略的限制：它保留未来额度，却不保证当前仍可提交的请求有足够输出空间。原始响应无法证明模型当时尝试哪一种操作，也无法确认空对象由模型、provider或归一化的哪一层产生。不能把当前`failureScope=participant`当作“纯模型原因”，也不能断言调高额度就会成功。这不是1M上下文窗口耗尽，末次实际prompt只有66,269 token。

### 检查题：明确的字段长度违规

模型在submit-only阶段返回一个submit。snippet长4,557字符，低于32,000上限；explanation长6,904字符，比6,000上限超出904。实际输出3,229/4,096 token，native及normalized结束原因都是tool_calls，非输出token截断。

6,000限制存在于每次请求的工具schema；系统正文没有再重复数字。`strict:true`并没有保证这次响应符合maxLength，控制器仍按原规则拒绝。[独立审计](live/failure04-audit.json)保留字段计数和schema证据。原始参数留在journal中，没有截短、补救、编译或给这份无效提交打语义分。

因此本轮没有有效检查题答案，不能据此声称新增“精确实例/完整图/缺失证据”标准已获模型验证。不是因为library行为失败才拒绝。

## 两份通过答案

[组合题评审](live/candidate-entry-02.review-verified.json)与[交接题评审](live/candidate-entry-03.review-verified.json)由独立源码审查给出，核对rubric source hashes，再通过既有review入口重新编译原始snippet。没有新增标准或修补答案。

组合题有一处评分范围之外的解释错误：声称跨实例复用input Node会触发distinct-node检查；实际检查只比较单实例内部六个Nodes。代码使用题设给定的两套独立inputs/resources，符合本轮四项标准。保留[解释错误记录](live/sample02-caveats.json)，不把通过写成答案毫无错误。

## 费用、冻结和执行边界

用户在v6冻结报告及“一次四题”建议后回复“继续”，执行授权绑定本次manifest，累计上限仍$4，包含全部历史已报告费用和未决预留。

[账目](live/billing.json)：95次生成调用（4次资格+91次任务），无provider失败，无传输重试，无实质新增未知预留。约1e-16美元浮点残差原样记录。

- 本轮$0.128730972，与key增量对齐。
- 累计已报告$1.324848196；未知预留约$1.9126272，未释放。
- 保守占用$3.237475396，$4下保守剩余$0.762524604。
- 外部key上限仍$1.97，剩余$0.66796982，未改额度。

运行前脚本错误比较了v5/v6的完整sample行，包括预期会变化的packet摘要，在dispatch之前停止。修正为核对固定样本身份及v6冻结制品后才启动；没有影响已冻结runner、材料或评分。[本地事件](live/pre-dispatch-incident.json)与失败日志保留。

[运行验证](live/verification.json)、[最终摘要核验](live/completion-verification.json)：journal完整哈希链、制品、33个执行代码绑定及每次预算反馈均验证；复用此前197项通过的测试证据，本轮没有声称重跑测试。准备阶段4/4模块、11个校准样例及三路审查证据仍有效。校准结果不是这次模型成绩。

## 审阅路线与下一步依据

1. 先看[两类失败原始证据](live/failure-audit.json)和[字段长度审计](live/failure04-audit.json)，区分输出资源限制、模型遵守schema和library使用行为。
2. 再看[冻结标准](reviewer-rubric.json)与两份评审，区分“七项标准通过”和没有有效提交的其余九项。
3. 最后核对[执行边界](live/execution-approval.json)、[费用](live/billing.json)及[最终四样本表](live/review-verified-summary.json)。

本轮是已曝光任务派生的开发回归。与v5相比，文档、提示和评分同时变化，且每题只有一个样本，2/4与4/4不能当成library退化或某改动的因果结论。

后续若研究检索与提交输出预算分配，或把已存在的字段上限更清楚地呈现给模型，应先作为新的harness版本做离线设计和反例检查；本轮不放宽限制、不修答案、不补跑。旧失败照实保留。本次运行到此结束。
