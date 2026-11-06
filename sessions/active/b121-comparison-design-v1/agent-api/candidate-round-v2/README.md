# B121 候选 v2：任务接入与冻结编译的离线验证

2026-09-17，归属既有 graphrefly:B121。**没有调用付费模型，没有候选模型答案，没有正式易用性分数。** 本轮完成候选任务、冻结编译和评分记录的离线接线；正式样本表与付费调度仍未冻结。

**后续进展**：[编译子进程保全、四样本执行草案与余额核对](process-boundary/README.md)。当前主入口已使用独立编译子进程，173项测试通过；原生崩溃根因仍未证明修复。下文165项验证与原预检作为此前准备阶段证据保留。

**最新进展**：[固定四样本campaign已接通](campaign-ready/README.md)，184项测试通过。503响应头补查到生成ID，但逐笔查询返回404；全部未决费用预留仍保留，当前费用准入失败，未启动模型采样。

## 审阅顺序

1. **任务与材料绑定**：[candidate-entry.mjs](../../../../../scripts/b121-comparison/candidate-entry.mjs) 校验材料、题目、rubric、编译环境的调用方固定摘要；四种角色直接进入真实 `runSession` 的 entry 模式。`prepare` 只生成参与者包，`replay` 只消费显式离线 API 响应，不接收 key 或网络 transport。模型 broker 只能读取 task 与源码，不能读取 rubric、编译器或评分器。构造回放的成功不代表模型成绩。
2. **可重复的编译输入**：[frozen-compiler.mjs](../../../../../scripts/b121-comparison/frozen-compiler.mjs) 保存源码、TypeScript 5.9.3 编译器 JS、标准库、Node/undici 类型声明、选项和包入口映射。后续类型检查只读取虚拟文件表，没有本地磁盘回退，也不执行提交代码。要求相同 Node v24.18.0；没有打包 Node 二进制，不声称 OS 隔离或跨 Node 版本复现。压缩快照与[固定摘要](integration-pins.json)一起保存；调用方必须信任固定摘要的来源，自报摘要不能证明来源可信。
3. **失败与评分分开**：编译诊断、材料诊断、控制器失败、缺失提交分别保留。逐项评分必须提供 reviewer 身份、完整 criterion 集合、证据和对应 assessment 摘要；评分时重新编译，不能把编辑过的缓存 `ok` 当作证据。`null` criterion 表示歧义待审。先提交再触发致命错误的 session 仍不能通过。静态编译加可信人工审查不等于运行时验证。
4. **实际验证入口**：[candidate-preflight.mjs](../../../../../scripts/b121-comparison/candidate-preflight.mjs) 与[测试](../../../../../scripts/b121-comparison/candidate-entry.test.mjs)。[编译预检](compiler-preflight.json)保留四项模块导入探针及完整依赖列表；它们不实现题目答案。`formalReady` 始终为 false。

## 为什么产生 v2

原 [72 文件版本](../candidate-round/README.md)的编译预检为 **1/4**：三个任务导入的示例类型会到达 `pipeline.ts`，其中 `@graphrefly/ts/core` 和 `/graph` 没有冻结解析入口，产生材料诊断。这不是模型失败，也没有覆盖旧结果。

v2 根据真实 `packages/ts/package.json` 的 exports 和 `tsup.config.ts` 的源码构建入口，绑定这两个包别名，并递归加入所需本地源码。新增 26 文件，合计 **98 文件、981059 内容字节、29137 行**。原 72 文件逐字保留；题目、角色、说明和 rubric 标准完全相同，只更新跨材料摘要。新增文件为公开 core/graph/composition/render/storage 等依赖，没有添加测试、fixture、oracle 或题目答案。映射同时公开在参与者 task metadata 中。

[材料审查](material-review.json)保留选择规则、覆盖报告、原材料摘要，以及用于确认 exports/build entry 的配置原文和摘要。内部设计与 demo fixture/oracle 仍然不提供；这是只读使用材料，不是完整 demo 执行包。结构审查仍将 package specifier 标为 external；实际冻结 TypeScript 模块解析另由本次预检验证，二者没有混称。

候选题作者已接触先前试运行及本轮审阅；仍然不能声称独立作者出题、无污染保留集或独立泛化结果。新增依赖是在任何候选模型调用之前修复材料打包，没有依据模型答案改题或评分。

## 检查结果与保留的异常

- `node --test scripts/b121-comparison/*.test.mjs`：**165/165 通过**，其中新增 9 项验证真实回放、拒绝私有路径、快照篡改、无磁盘回退、不执行 snippet、评分绑定、失败提交与四项 v2 模块探针。
- 三路独立只读评审发现编译器 VM 返回数组不能直接进入严格规范哈希。已在返回边界 `structuredClone`；评分重算回归通过。另补上“编译成功提交之后发生拒绝读取”的真实控制器负测。
- v2 四项模块预检 **4/4 通过**；去掉预检重复创建编译器后，三个独立最终进程均退出 0，报告完全一致。v1 仍按预期退出 1，保留原材料失败。
- **两次早期独立 CLI 进程退出 139，未生成报告。根因未证实。** 后续成功不能证明不会复发；完整尝试清单在 [preflight-attempts.json](preflight-attempts.json)。不把进程崩溃变成参与者错误，不隐瞒重跑。正式运行前仍需处置进程可靠性与崩溃结果的持久化边界。
- 79 个历史 run 文件摘要不变。没有修改 library 源码、旧运行记录或费用预留，没有发出 API 请求。

复查命令（离线、无费用）：

```sh
node scripts/b121-comparison/candidate-preflight.mjs sessions/active/b121-comparison-design-v1/agent-api/candidate-round-v2
```

## 正式执行仍需完成

正式 manifest 需固定样本数、顺序、全部样本分母、预算、重试与进程失败处理，并把此候选接入具有现有费用账本和独占 claim 的实际 campaign。当前 `replay` 不替代这些执行边界；旧 campaign 也不能被当作已支持这四道新题。还需核对旧未知费用预留及剩余额度。此前累计 USD2 边界未变，此次不释放预留、不新增正式运行授权。

## 错误身份与费用核对收尾

见 [reconciliation-closure/README.md](reconciliation-closure/README.md)：身份提取与冲突修复，192项测试通过；实际入口保存四项预算未准入，零模型请求。核对结束但未决预留仍保留。

## 累计 $4 授权后的实际四任务采样

见 [live-cap4/README.md](live-cap4/README.md)：资格通过，四任务均执行但无代码提交；均触及冻结的累计输入预算。费用$0.099486336，与key增量一致。未补跑，原失败保留。
