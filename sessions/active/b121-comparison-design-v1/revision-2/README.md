# B121 离线材料 revision 2

本批落实用户批准的两项方法修正：C3 检验外部 verification 尚未到达；Graph 分层入口使用任务与 Graph/plain 同事实判断比较分开。旧 design/preparation 收据保留为历史证据。本目录是 root B121 的准备证据，不创建新的 library 语义决定，也不完成 B121。

## 审阅路径

1. **判断材料**：`material.json` 包含 8 个场景、37 个原子事实、2 个算术修改；A 先封存，B 才开放。两臂事实相同，关系视图不同。Graph 是 62 个节点、101 条边、13 个展示单元；plain 是 68 个源码定义、175 条静态可能调用/引用边、7 组。后者不是运行轨迹，外部 writer/listener 实现不在其源码清单内。
2. **证据与答案**：`bindings.json` 提供逐事实来源说明；`source-index.json` 固定输入文件摘要，`source-edits.json` 固定归档里的真实源码修改。`verify-study-v2.mjs` 在 root 独立核对实际观察、精确有理数结果、目标 occurrence 和内容摘要，不调用候选库的业务或授权函数。`goldens.json`/`decisions.json` 只给评审与评分器，绝不能放进参与者文件映射。
3. **渐进披露**：`entry-tasks.mjs` 在 A/B 都封存之后才提供三个 Graph 使用任务：普通使用者 compose/观察，框架作者原能力引用，维护者完整图及 host 边界。它们使用已有 consumer 私有入口，并非新增公共 solutions API。类型检查只证明示例可编译；语义仍需可信评审，真人/agent 使用成功尚无证据。
4. **验证**：`study-v2.test.mjs` 校验实际材料、摘要、封存评分与 14 个证据破坏反例；`entry-tasks.test.mjs` 校验阶段门禁、真实类型检查、错误入口和评审条件。合计比较工具测试 34 项通过。

## 八个场景的边界

| 场景 | 具体问题 |
|---|---|
| C1 | 相同拓扑下改用总体方差；给定输入结果改变，未提供当前 guard，不能执行。|
| C2 | 相同拓扑下等价算术改写；A 无 guard，B 有精确首次 transport 的 guard；等价仅覆盖给定输入。|
| C3 | revision 1 已完成、revision 2 缺授权；A 不推测原因，B 才确认外部 verification 未送达。|
| C4 | 当前 policy digest 与目标不同，无当前 guard。|
| C5 | 已成功 effect 的相同 replay 不产生第二次执行。|
| C6 | unknown physical outcome 在展示退订/重订后保留，host 停止 dispatch；图局部 quiescence 不等于 host 已结束。|
| C7 | verification 不可用，assessment 仍可产生，不能执行。|
| C8 | 正常负对照：首次 transport 前有精确 guard，尚无 transport 调用。|

`lifecycleEnded` 问的是材料能否证明结束；未提供 end receipt 不证明实例实际仍存活。作者问题同样限定于材料未提供认证 provenance。uncertainty 使用公开的优先顺序，防止多个合理未知被单答案评分误判。B 的独立核对可能针对同一冻结时刻，并不一概代表后来的运行状态。

## QA 修复与证据范围

独立语义复核修复了 C3 A 原因泄漏、授权必要/充分条件、C4 引用集、最终材料摘要，以及 C1/C2 未知原因和评分优先级。独立边界复核发现请求与 admission 彼此一致仍可能接错目标；现已校验目标 evaluation、occurrence、input/policy/effect 以及 payload/request/proposal 摘要，并验证 C2 自己的输入。另补 C2 事前空记录、C6 dispatchStopped/retained 记录、C7 assessment 存在性检查。

第三个独立 verification-gap 任务受 agent thread limit 限制未能启动；主 agent 单独检查了入口门禁和类型检查测试，不能把该部分称为独立 QA。可信 controller/reviewer 可伪造输入是明确的信任边界，不是进程隔离证明。编译器读取本地源码，不能直接开放给未隔离参与者。类型检查不执行 snippet，也不证明它运行安全。

本批只重用原 46 个物理执行 arm 和先前 6 个绑定的 memory arm，新增 consumer/provider/participant/real inbox 执行为 0。34 个工具测试包括合成答案，不是人或 agent 的比较成绩。library 源码未改；先前 2712 passed/4 skipped 与 build 结果仅作为原批历史结果，不声称本轮重跑全库。全库 lint 原有归档诊断问题仍未修复；本批 TS exporter 的 Biome 检查通过。

## 尚待执行条件

离线材料可审阅不等于正式 study 已可执行。参与者进程必须只能取得批准的 A/B 文件映射，不能访问评审答案、共享源码或其他工具；当前共享 Codex 环境未证明这种隔离。具体参与者、provider/model 固定版本、价格/预算与同意也尚未落实。`executionReady=false`，B121 保持 proposed，原性能未通过的状态不变。

下一步是针对一个具体参与者执行环境完成隔离验证及可审阅的执行清单，然后才考虑正式比较。此前没有任何 provider/live/spend 自动授权。

## 复核命令

在 TS 仓库：`node scripts/export-spending-comparison-facts.mjs`（仅被动提取，输出摘要应稳定）。

在 root：`node scripts/b121-comparison/study-v2.mjs`；`node --test scripts/b121-comparison/*.test.mjs`。前者核对 source/capture/archive 摘要并重建材料；后者应拒绝提前取 B、错误目标、过早清除 unknown 和不存在的 imperative view API。
