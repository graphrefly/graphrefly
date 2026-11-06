# B121：传输失败诊断粒度修复

## 原问题与本次范围

v9第一题失败只保存fetch failed，没有底层cause/code，事后无法区分连接重置、解析、DNS/TLS或本地超时。用户同意继续补诊断；本次只改B121私有transport日志及离线测试，没有付费调用、重试调整、预留释放或library语义变化。

## 新增字段

每个provider-attempt-failed事件增加transportDiagnostics（版本transport-diagnostics-v1）：

- elapsedMs：单次尝试的单调时钟耗时；attemptTimeoutMs：配置超时。
- phase：before-fetch、awaiting-response-headers、reading-response-body、processing-response或validating-response。它们是代码观测位置，不是底层DNS/TLS时序证明。
- httpStatus：已取得响应头时保存状态码，否则null。429明确记录429，不把fetch失败推断为429。
- abortSource：attempt-timeout、caller或null；attemptTimeoutFired和callerAborted保留两个信号的状态。根据组合信号首先采用的reason辨别来源，不保存reason文本。
- errorChain：root/cause/AggregateError子错误及父索引，最多8项、最深4层；只保留允许的错误类型名称和已知网络错误码，如ECONNRESET、ENOTFOUND、UND_ERR_CONNECT_TIMEOUT。其他值为null。

新字段不复制任意message、stack、URL、headers、地址、socket、请求或取消原因文本。读取自有数据属性而不执行getter，环与异常对象不会替换原失败。原有raw HTTP evidence/error字段保持既有行为；本次不是对整个旧journal做隐私重构。

## 判断边界与复核

记录ECONNRESET可以说明底层报告连接重置，但不说明谁重置；没有底层证据时不归因于Together或OpenRouter。fetch返回响应前失败仍可能涉及不同网络阶段。此修复无法恢复v9已经丢失的信息。

本地主助手进行了范围、边界和验证缺口检查；没有宣称独立QA。用实际transport注入网络故障/HTTP429/取消，验证原重试次数、等待和停止行为；另覆盖响应体超时、普通断流、cause聚合/环/深度/敏感字段/getter/撤销Proxy。

首轮205测试中204通过，一条新增断言误把普通socket断流写作本地超时而失败；修正该测试断言后重新验证，保留首轮记录。运行结果见verification.json与final-tests.log。

## 审阅路线

1. scripts/b121-comparison/api-transport.mjs 的transportErrorChain：白名单与有界错误链。
2. 同文件每次fetch附近的phase更新与provider-attempt-failed新增字段：观测信息不参与recoveryClass计算。
3. scripts/b121-comparison/api-runner.test.mjs：fetch/429/caller取消、超时/普通断流的区分，以及敏感字段排除。

旧v9冻结包及运行证据未改写。当前执行源码摘要已经变化，任何未来live运行都须新冻结；本次没有生成新的执行授权或启动模型。

## 修复后的执行准备核对

[准备快照](next-run-readiness.json)核对205测试绑定的源码摘要及当前全部33执行绑定；相对v9只有api-transport.mjs变化，题目/材料/评分/预算反馈/重试策略均未变。复用原4模块预检及consumer校准，不重复运行无关检查；此准备快照不是可执行授权，未改旧冻结包。

[一次最新key查询](readiness-key-snapshot.json)显示v9已报告的$0.001788708现在已计入key用量；累计已报告仍为$1.5028732，没有新增已知费用，也没有因此释放无ID请求预留。key余额$0.489944816。

现有累计$4.50上限下保守占用$4.3710352，可用$0.1289648，不足一次最大请求$0.319488。此次没有生成调用。

供用户确认的具体后续：累计上限调整为$5（包含全部历史费用及未知预留），外部key上限$1.97、不充值、不重置，重新冻结代码后执行一次完整四题。可增加保守占用$0.6289648，预留下一笔最大请求后剩余$0.3094768；一笔新的最大未知失败仍可能阻止重试，不能保证完成。未确认前不修改费用常量或执行。
