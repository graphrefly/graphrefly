# B121：编译进程失败保全与执行草案

2026-09-17，继续既有 B121 授权范围内的评测器准备；不是新的产品决定、正式成绩或追加支出授权。此次 **0 次模型生成，1 次只读 key 用量查询**。没有改 library 或旧运行记录。

## 定位与处理

[两份原始崩溃报告的最小摘录](crash-evidence.json)均显示 `SIGSEGV`，栈顶为 V8 的 `ClearStaleLeftTrimmedPointerVisitor::VisitRootPointers`，后续进入垃圾回收标记过程。这定位了本地原生运行时的失败位置；不足以证明准确触发原因、V8 缺陷或重复初始化的因果关系。

本次不再依赖“再跑几次没崩就认为修好”。编译器在独立 Node 子进程加载，父进程先保留模型提交、任务／样本／阶段／材料摘要和记录路径。子进程限时60秒，V8堆512MiB、stdout 4MiB、stderr 64KiB；V8堆限制不是总RSS上限。编译器仅解析／检查提交，不执行提交代码；这也不是OS安全沙箱。

编译进程异常退出、被信号终止、超时或输出超限均记录为 harness failure，没有编译器或模型自动重跑。父进程中断留下缺少 completion 的记录时，读取结果为 `incomplete-process-receipt`：保留运行中／中断的不确定性，禁止自动重放，不伪造已结束。进程完成记录和输入／输出摘要可以离线校验。目录或写盘失败会保留任务失败状态，但不能声称失败的磁盘写入已经持久化。

## 审阅顺序

1. [候选入口](../../../../../../scripts/b121-comparison/candidate-entry.mjs)：构造时只读编译环境元数据，真实编译走子进程。entry先写保全事件再启动；review重算也关联原assessment，返回编译记录路径。历史harness失败不会经review重算追认成功。
2. [编译边界](../../../../../../scripts/b121-comparison/compiler-process.mjs) → [固定worker](../../../../../../scripts/b121-comparison/compiler-worker.mjs)：快照、snippet和元数据在启动前保存；子进程不继承API key等环境变量。返回值校验环境／snippet摘要，失败不会混成参与者类型错误。
3. [进程记录](../../../../../../scripts/b121-comparison/recorded-process.mjs)：准备与启动双重独占、有界输出、硬超时、退出／信号记录，以及不完整记录的保守恢复读取。
4. [真实进程故障测试](../../../../../../scripts/b121-comparison/recorded-process.test.mjs)与[候选消费者测试](../../../../../../scripts/b121-comparison/candidate-entry.test.mjs)：覆盖信号、139退出码、超时、超量、重复启动、父进程缺少完成记录、真实编译器初始化异常和不可写记录目录。

三路独立只读评审后补齐：启动前关联sample；成功review也返回receipt；写盘／目录错误保留四个preflight行。另强化事件顺序断言，防止缺失事件的 `findIndex=-1` 假通过。

## 真实检查结果

- 全套 `node --test scripts/b121-comparison/*.test.mjs`：**173/173通过**。其中6项真实进程边界测试，候选消费者共11项。最后仅加强一处测试断言后，针对真实编译器初始化故障的测试再次通过。
- 使用独立进程的[四项模块预检](preflight.json)：**4/4通过**。每项都有持久化的子进程输入、stdout、stderr、completion和outcome，路径记在报告中。这是模块导入检查，不是题目解答或模型通过率。
- 旧版未隔离的预检及两次崩溃记录保留，没有覆盖旧报告；此次也不宣称原生崩溃根因已修复。

## 四样本执行草案与费用边界

[执行草案](execution-plan.draft.json)列明现有4题各1个独立会话、固定顺序、完整分母、材料／工具／代码摘要、模型配置、原有transport重试策略和停止规则。四个样本均为 `not-run`。**它是prepared-not-executable草案，不是实际可启动manifest或授权。** 单样本观察不能外推统计成功率，题目作者暴露情况照旧披露。

[当前key查询](key-usage.json)显示已用 $0.775756572，与上次相同。加旧key $0.022818016，已报告总用量为 **$0.798574588**。仍有 **$0.9541632 未决预留**；此次查询没有提供逐次失败请求的结算凭据，不能仅凭总用量不变释放它们。

因此在既有 $2 累计上限内，保守可用额 **$0.247262212**；真实transport当前下一次请求的保守预留为 **$0.319488**（沿用 `maximumCost(contextTokens,maxOutput)` 实现），费用准入失败。没有调用chat/completions、没有消耗新生成费用，也没有把实际支出说成已经达到$2。

正式候选campaign的固定样本调度／独占claim接线、最终manifest及费用预留核对仍未完成。不能从此草案直接调用provider，也不能把编译器容错补齐当作正式评测已完成。
