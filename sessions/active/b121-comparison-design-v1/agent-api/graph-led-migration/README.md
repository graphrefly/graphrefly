# B121 Graph 控制迁移

2026-09-18。用户在架构审查后明确要求开始实施；长期架构选择归属 `graphrefly:D795`，本次实施与验证继续挂在 `graphrefly:B121`。这不是新的任务、运行授权或成绩记录。

## 意图与边界

按[已审阅设计](../graph-led-architecture-review.md)把阶段、请求/预算/重试准入、工具操作及运行结束的控制权放入真实 Graph。保留独立编译与评分、冻结模型/任务/材料政策、累计预算和全部历史结果。没有修改 library 公共 API、协议、formal 或 conformance；没有访问真实 provider、API key 或发起付费重跑。

实现工作使用两个已有仓库工作目录：root 拥有策略、记录与独立裁判，TS 的 `packages/ts/evals/b121/` 拥有私有组合。没有修改当前会话的干净 TS worktree，也没有重置或提交任何既有改动。

基线：`/var/folders/1k/6k95mf1117q9_klyvs61pml00000gn/T/b121-graph-migration-j6hec6bu`，保存了两仓库 HEAD、staged/unstaged diff、完整状态及原 untracked 文件摘要。原始审查源码摘要仍在[旧快照](../graph-led-architecture-sources.json)，没有覆盖它。

## 实施顺序与保留项

1. 登记唯一 root 架构锁，沿用 B121 工作，不把一次重跑或预算变动写成 D#。
2. TS 私有运行时加载实际源代码而非未验证的 dist；把源码、控制器、tsx 和锁文件纳入新的执行绑定。orchestrator 环境与被测 compiler/materials 分开。
3. root 会话策略分成 prepare、estimated、responded、proposeBroker、broker、advance；它们在明确的 Graph 依赖上通过 dispatcher 调用。状态对象存于 session state 节点，宿主仅持有执行中的 Promise 与关联回执。
4. transport 图负责费用、预留、单次尝试与恢复；qualification、session 和 campaign 共享调用方提供的同一 Graph。独立调用时拥有自己的 Graph。
5. 持久化分成请求意图、宿主写入、精确确认、执行准入；broker 操作前也确认日志。最终记录确认后才释放完成结果。
6. 原始答案先写盘，再调用独立 compiler/assessment，之后记录判定并推进样本。判断题 A/B 和 entry 仍使用独立会话材料；legacy campaign 的独立汇总/评分也由 Graph 准入的最终保存动作执行。
7. 使用真实依赖删除、异步日志失败、未知费用、最终记录失败和共享 Graph 测试验证控制路径；更新临时测试仓库夹具以装入实际运行时。

保留：原预算策略、响应/工具校验、A/B 阶段隔离、source broker、原始失败、未知费用预留、compiler 子进程和独立评审。迁移没有为模型修改答案或增加修复回合。

## 真实结构与观察

结构证据使用当前 library 的 `graph.topology()`：它读取与 `describe()` 相同的实时节点/依赖，输出不含缓存业务值的结构快照。不是从日志重建的图。可直接查看[合成轨迹](offline-trace.json)及[重现脚本](offline-trace.mjs)：同一 Graph 的资格、transport、session 和 campaign，共 83 个节点、965 条观察；5 次合成回执，真实请求和费用均为0。该轨迹使用内存保存夹具，真实文件保存由 campaign 集成测试验证，不作为模型成绩。审查时发现 `describe()` 会包含运行态缓存；第二个会话开始时缓存既含历史材料又可能含内部循环引用，因此改用已有的纯结构 API，不修改 library。

观察来自具体注册路径的 `graph.observe(path)`，记录 path/tier/seq/消息类型以及可用的关联身份，不记录模型内容。可选观察写入失败不能授权重试、阻塞结算或改变业务结果；必要执行日志的失败仍拒绝执行。

Graph 内业务数据的 occurrence 与协议 wave 区分。复用 CSP11 的 quiet DATA boundary，在没有业务输出时保持分支安静；没有添加 call-site `partial:true`、手工 `RESOLVED` 或业务排序定时器。

## 审阅顺序

1. **控制归属**：TS `session-control.mjs` 的 state → request/input budget → response → broker → phase 节点；root `api-runner.mjs` 的对应策略。
2. **费用与 I/O**：TS `transport-control.mjs`、root `api-transport.mjs`：预留 → 日志确认 → HTTP → 结算 → 重试准入；没有宿主重试循环。
3. **证据与结束**：TS `campaign-control.mjs`、root `candidate-campaign.mjs`：已完成样本不会因后续故障丢失，最终保存失败不返回成功完成；编译与评分继续独立。
4. **反例证明**：root `session-graph.test.mjs`、`transport-graph.test.mjs`、`campaign-graph.test.mjs`，以及真实临时仓库 campaign 集成测试。

## 实施中发现与修复

- 过滤分支初次无输出导致 fan-in 等待：复用已有 quiet DATA boundary，不改底层生命周期语义。
- 异步日志未被等待：请求和最终结果分别增加精确持久化确认；保留慢日志超时反例。
- Graph 内异常令外层只剩初始样本表：异常携带当前 collection 快照，已完成样本保留，当前样本标记中断。
- 观察器误把未设置的 Node.name 当注册路径：改用明确路径，避免每节点重复订阅整图；共享 Graph 测试约束观察数量。
- 实际结算已知但日志失败：保留响应与 reportedUsage，不能把已知费用丢失为0。
- 旧临时仓库夹具缺少真实 Graph 运行时：复制当前控制源与运行时并单独绑定，不修改历史 manifest。
- 结果读取误把最后一条观察事件当评测结尾：按类型识别完成事件，并验证 summary 绑定。恢复时即使已有 campaign-finished，缺少 summary 仍报告最终保存未完成，不能报成功。

## 验证与局限

最终命令与输出见 [verification.json](verification.json)，19 个实施/测试文件摘要见 [sources.json](sources.json)；测试中合成的 provider 回执只证明机制，不是模型能力成绩。

多agent资源不足以启动三名独立审查者。本轮由一个实现子agent对会话/集成做边界审查，主agent另行检查盲点、异常状态与消费者验证；不能声称三个独立盲审。公共 API 未变化，不以重建 dist 代替源码运行验证。运行绑定覆盖实际 Graph 源码、私有控制器、CSP11 顶层 helpers、锁文件与 tsx 的 mjs/json 文件及 Node 版本/平台；不宣称操作系统、全部已安装依赖或 esbuild 原生可执行文件的逐字节复现。

本迁移不宣称 B121 旗舰证明整体完成，也不解决审查中发现的历史协议激活缺口。下一次真实评测必须用新实现生成并核对新 manifest，旧冻结运行不可复用新控制代码；已有用户授权与预算记录继续有效，不因本次文档生成扩张。

## 后续真实开发回归（迁移验证之后）

用户随后要求继续，完成[固定两题真实回归](live-report.md)：2提交，1通过、1相对导入路径失败；18请求、0重试、回执$0.018739188。上文及verification.json的零付费陈述限定于迁移实施/离线验证阶段，不覆盖这次单独绑定的后续运行。
