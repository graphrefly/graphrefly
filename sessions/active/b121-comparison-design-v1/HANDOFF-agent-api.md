# B121 交接：独立 API runner 的 agent 比较

交接日期：2026-09-14。用户因当前 chat 太长，明确要求把进度与待办转到新 chat。请从本文件恢复，不要把最早 B139 consumer 选择请求误当成当前任务，不要重新讨论架构 A/B/C。

## 用户最新选择与授权

用户原话：“那算了，我现在还没有这么多真人朋友去帮忙做这些测试，还是直接独立API runner做Agent 比较吧。同时这个chat已经很大了，可不可以把我们的进度和要做的写到下一个chat？”

因此：选择独立 API runner 的 agent 比较；真人比较暂缓，不招募、不联系他人。agent 结果不能替代真人可用性证据。旧草案的 12 human slots 为未执行提案，不是本轮待招募任务。

已批准可连续完成离线准备、隔离验证、诊断工具修复和 QA，内部步骤不要反复让用户说“继续”。用户要求记得 commit，保留既有未提交修改。选择执行渠道不等于批准任意 provider、模型或费用；具体 manifest 尚无版本/报价/费用上限，providerCalls/participantRuns/spend 仍为零。先把具体可审阅方案及必要离线工具做完，再一次性请求实际执行批准。不得让 project-governance 变成每个可逆步骤都要批准的借口。

## 仓库与当前提交

- root authority：`/Users/davidchenallio/src/graphrefly`，main，交接前 HEAD `981f9d4`（synthetic container/broker isolation）。
- TS owner：`/Users/davidchenallio/src/graphrefly-ts`，main，HEAD `84cab48f`（被动 facts 和 plain 关系提取）。
- root `2413313`：8-case judgment packets 与独立 Graph entry tasks。
- 更早 root `dd3176a`、TS `4bdb616a`：比较工具与 6 个 memory capture arms。
- root design `f049b99`。旧 README 中“待批准”是历史草稿，不覆盖后来用户批准及 revision-2。

若新任务在 TS worktree 中启动，先核实真实 HEAD；root 仍使用上述绝对路径。主要下一步工作归 root B121，TS consumer 保持只读，除非证据表明有已授权的必要修补。不要自动重新创建/同步已有 archive 或重跑性能矩阵。

两仓库都有大量其他未提交工作。root 包括 AGENTS.md、CLAUDE.md、decisions、B139 backlog 行、blueprint session 等；TS 包括 16 个 instructions/skills 文件和约 2081 个既有 untracked artifacts。上批用 baseline 哈希验证 2092 个既有文件未变。不要 `git add .`、reset、stash 或替换这些文件。B121 backlog 若需更新，按 HEAD 构造 B121 单行 cached patch，保留 B139 行未暂存。

## 先读的权威与证据

1. root `CLAUDE.md`、`AGENTS.md`；当前 TS `AGENTS.md`。
2. personal `~/.codex/skills/project-governance/SKILL.md`、BMAD build/QA；项目 decision-guard。实际 API/model 工作使用 OpenAI Docs 和当前官方来源，不能把本地 Codex 模型别名当作可用 API 模型。
3. root `plan/backlog.jsonl` B121；相关 TS work：CAUSAL-OCCURRENCE-TS、CAUSAL-COMPOSITION-DESIGN-TS、CAUSAL-HOST-PROOF-PREPARATION-TS、CAUSAL-PRESET-ASSEMBLY-TS。B121 仍 proposed。
4. root `sessions/active/b121-comparison-design-v1/revision-2/{README.md,readiness.json,review.json}`。
5. root `sessions/active/b121-comparison-design-v1/isolation/{README.md,qualification.json,execution-draft.json,probe-receipt.json}`。
6. 原 design `sessions/active/b121-comparison-design-v1/README.md` 只结合 revision-2 方法修正阅读。旧 readiness/manifest 摘要绑定，不能覆盖历史文件。

## 核心产品目标与已决定的边界

“graph is the system that runs”：同节点身份、同拓扑下的实现变化仍需可见；谁改的需要 provenance；后果不变需要独立证据。小 kernel → 有限语义能力 → 易用 preset；identity/lifecycle/retained evidence 分清职责而非多个松散 authority。

展示退订不结算义务；运行实例掌握整个 lifecycle。local quiescence、normalEndReady 和实际 lifecycle end 不可混同。不要加跨波次编码缓存/新 registry，不新增公共 API、协议变更，不重开性能优化。本轮比较本身不改变原正式性能未合格状态，也不证明分层公共 package design 全部完成。

选定真实 consumer 是 TS examples/spending-alerts 的应用组件，不是新通用 spending-alerts public solution。原 library/host 运行逻辑已完成大量验收，此次主要缺理解/分层入口的使用证据。

## 已完成的比较材料

- revision-2 使用 **judgment-only-v2**：Graph/plain 同事实判断；Graph 三角色 entry 使用任务单独放在 A/B 全部封存之后，避免预先训练偏差。不要再要求 plain 伪造一个不存在的分层 factory。
- 8 场景、37 个事实、2 个 arithmetic code diffs。每参与者只接触一臂；先封存全部 A，再开放 B。
- C1：同拓扑 sample→population，给定输入结果不同；无当前 guard 不能执行。
- C2：同拓扑等价算术替换，A 无 guard，B 在首次 transport 入口前有精确 guard；仅给定输入等价，不是全程序等价。
- C3：revision 1 完成，revision 2 外部 verification 未到；A 只知授权未建立，B 才揭示外部原因。不是内部同步 graph 分支暂停。
- C4：当前 policy mismatch。C5：成功 effect exact replay 不再执行。
- C6：unknown physical outcome 在显示 detach/reattach 后保留；host dispatch stopped，图局部 quiescence 可已满足，不能宣称整个运行结束。
- C7：缺 verifier，assessment 仍可产生。C8：正常首次 transport guard 正对照。
- author unknown / lifecycle not-established 都指“材料中未提供相应证据”，不宣称世界上不存在作者或结束事实。
- uncertainty 有公开优先规则，避免多个支持的未知答案被单一 golden 误判。
- Graph 62 nodes /101 edges /13 展示单元；plain 68 source definitions /175 静态可能调用或函数引用 edges /7 组。plain 不是 observed runtime topology；注入 writer/listener 实现不在 inventory。
- 真实旧物理证明 46 arms、30 host requests、26 physical handle calls、6338 readback bytes；此次无新物理 consumer 执行。另重用先前 6 个绑定 memory arms（C2/C3/C6 × Graph/plain）。

## 代码入口

root `scripts/b121-comparison/`：
- `study-v2.mjs`：核对源码/归档/捕获摘要，生成事实、关系、goldens、inventory。
- `verify-study-v2.mjs`：独立数值和观察检查，绑定目标 evaluation/occurrence/input/policy/effect；独立重算 payload/request/proposal SHA。不能只验证 request 与 admission 彼此相等。
- `source-edits.py`、`verify_catalog.py`：实际 archive/source binding。
- `session.mjs`：trusted controller + participant broker，仅 list/read/submit；A/B sealing、固定分母、80 calls 与外部累计 token/time meter。**内存 broker 自身不建立隔离**。
- `entry-tasks.mjs`：Graph-only 三层真实 source snippets，A/B closed 才 release；实际 TS compiler 静态检查，不执行 snippet。trusted 人工 review 仍必要，不把合成 reviewer 当使用成绩。
- `isolation.mjs` + `isolation-probe.py`：固定 synthetic IPC probe，不是生产 provider adapter。探针专用 ready-for-controller-seal 标记只作固定编排，绝不能开放为参与者自行 seal 的工具。

TS `scripts/export-spending-comparison-facts.mjs`：被动提取 23 schedules，独立 plain source closure。输出 `docs/design/causal-comparison-preparation/passive-facts.json`，确定性 SHA `0c0c52227b0fe17a5cbe1427ca6bae35d722bd2c046893c4e0bf327ddd37480a`。不运行 consumer。

## 最新隔离证明与不能宣称的内容

本机已有 Podman VM，docker 命令实际是 podman wrapper。不要启动/停止他人容器、拉取新镜像或重跑失败的 macOS sandbox 探针。

成功复用本地 image ID `0c1b0dc4d863c5c9873aa4e92c2bf8e6e8db24b572f28a09d534d8f5fb6eeae3`，Python `/opt/python/cp311-cp311/bin/python` 3.11.10；amd64 镜像在 arm64 VM，非性能测试。参数 pull=never、network=none、read-only、read-only-tmpfs=false、cap-drop=all、no-new-privileges、UID65534、128MiB、32pids、25s timeout、unsetenv-all，无 host mount。仅 stdin/stdout 与可信 broker 通信。

28 项跨进程检查通过；实际移除 read-only 的负对照被拒绝；容器 UUID 清理后 exists 返回不存在。测试要求精确完整的 28 keys 且全 true；只读必须 /tmp write 返回 EROFS，PermissionError 不算 hidden path 缺失。两个独立 QA 修复上述假通过及 cleanup 忽略失败。

这仅证明固定 synthetic client 的宿主路径/网络与 broker 边界。没有验证真实 provider context、额外工具、模型版本或计费。容器有 Python/基础工具，不能说里面无 shell。网络证据是 IPv4 无路由且 TEST-NET 连接失败，不是全协议/内核安全审计。环境变量 canary 测试被 PreToolUse 误匹配/安全钩子阻止后已去掉，不读取或打印 env；unsetenv-all 是配置，不是该项验证证据。

## 已运行 checks 与未完成项

- comparison 工具 34 tests passed；后续 isolation + session 12 tests passed（有重叠，不能加成46）。
- revision-2 有14个实际数据破坏 probes；isolation另有28 process assertions、只读 runtime negative。
- TS exporter deterministic/作用域 Biome passed。
- root dashboard check / authority workspace check 通过，保留既有 orphan/legacy warnings。
- 旧全库 2712 passed /4 skipped、build pass 只是历史结果；全库 lint 原有1343个归档诊断问题未修复，本轮没重跑或归零。
- zero human/agent participant runs、zero provider calls/spend、zero新增 inbox effect；B121 不complete。

## 新任务要一次推进的内容

1. 根据本次渠道选择修订**新的**执行清单/准备记录：agent-only 继续，human deferred；不要改已绑定的旧 execution-draft/readiness。角色×arm 两人，共12个fresh sessions；O1/O2 allocation 已存在。
2. 核实实际 API provider/model 可用的官方文档、精确版本/返回标识、reasoning 和工具配置、usage 语义、价格与累计最大成本。旧 proposal 的 gpt-6-astra 是未验证 alias，绝不猜它在 API 可用，不悄悄用其他模型完成试验。若需替换/无法固定，给出一个具体建议与复核限制。
3. 设计并在已批准离线范围内准备独立 runner：fresh request context、只给该角色该臂的A/B材料、唯一 broker tool、可信控制器封存、无仓库/历史chat/goldens访问、bounded loop、及时累计所有重复上下文/tool tokens、80calls/48k input/8k output/75min per session、no auto retry。总拟预算576k input/96k output；这不是已授予费用。
4. offline fake transport/泄露canary/错误phase/超时/缺usage/恢复或重放失败路径应 fail closed；不要把 fake transport 成绩当真实 agent 成绩。实际 adapter 要做真实上下文/工具资格核对；该过程若需 provider调用也算待批准的数量/费用。
5. 冻结 actual prompts、role instructions、输出schema、引用评分、自由文本的双评审或明确不足、after-A/B Graph entry步骤及概念负担记录。不要无限追加工具取代真实观察；无法获得的human泛化保持缺口。
6. 一次提交可审阅的 provider/model/config/材料SHA/样本数/token+cost ceiling/retry=0/隐私与隔离边界 manifest，请用户批准确切实际执行。此前不发模型请求、不读key值、不开展live/spend。
7. 实际授权后才运行、保留全部成功/失败/timeout/usage/seals/raw provider IDs，独立评分和逐role×arm结果。不得改rubric适配成绩；agent-only不足以自动完成B121或证明真人体验。

## 新任务启动方式

先读本交接和引用收据，简短确认恢复到正确位置，然后直接完成上述准备。不要要求用户重述历史，不要重新选consumer、重验整个性能矩阵或重新发明材料/registry。未确定的重要执行选择集中为一个可审阅方案；内部修补、离线检查、commit 不需要一轮一个批准。
