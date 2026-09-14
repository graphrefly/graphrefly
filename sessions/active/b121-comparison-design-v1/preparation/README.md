# B121 离线准备结果：工具已验证，试验尚未就绪

本批按用户在设计 commit `f049b99` 后的“继续”推进离线准备。没有 participant/provider/live/spend 授权，B121 仍 proposed。原设计稿保持历史原文，本报告记录实现发现，不把设计改动自动锁定。

## 可复核的交付

- session 工具实现严格文件清单、A/B 分离、先封存八题 A（缺失/超时仍入分母）后开放 B、不能覆盖答案、hash 审计、独立评分和 80 次调用上限。Token/时间需要可信外部 meter；未注入 meter 时明确报告未执行该预算。
- materials 工具实现三角色任务、独立人类/agent 的平衡分配、40 条事实预算、同事实 G/P 映射、泄露检查、独立有理数计算与 source/checkpoint 约束。合成测试跑通材料→提交→封存→评分，但不是实际参与者答案或完整盲测资格。
- 精确图投影覆盖 62 节点、101 边，默认 13 个展示单元；完整成员与跨组边可追溯。投影去掉缓存值/状态，不伪造更小 runtime。
- TS 新增六个内存观察 arms。C2 使用实际加载的等价源码改写，在 writer-entry、调用 transport 前捕获；C3 暂停的是外部 verification 输入；C6 短写后展示退订/重订阅保持实际 authority 集合与 unknown effect，host 不能正常结束。
- 原真实文件 archive 的八个所选案例×两组，共 16 个成员只读逐字节/字段校验。没有新的真实 I/O。

`candidate-materials.json` 是 **12 条事实的结构/引用试组**，不是给参与者的完整材料。它保留缺入口等 gate，不附造出来的答案，不可送入正式试验。`allocation.json` 是预登记草案，不是招募或调用清单。`readiness.json` 的 `executionReady` 和 `qualifiedPacket` 均为 false。

## 尚未达到原设计，具体原因与推荐修订

| 项目 | 事实 | 推荐处理 |
|---|---|---|
| C3 内部分支描述 | 同步分支在波次中完成；新证据只证明外部 verification 未到。不能把它说成缺失内部业务分支 | 八题中明确采用外部 verification 等待；内部缺失分支仍用已有 runtime mutation 功能资格证明，不纳入第三个 source diff |
| plain 分层入口 | 实际 plain host 是 constructor/feed/observe/observations，没有同等三级 capability 入口 | 先明确比较目标：推荐把现有 Graph 的分级入口作为使用验收，把 G/P 比较限定于同事实下的判断能力。若必须比较两组入口负担，应另做并验证 plain 私有分层适配，不能用未实现的示例充数 |
| 事实与答案 | 原设计同时要求八题全源码/政策/收据与最多 40 原子命题。已有原始数据更丰富；目前没有可独立确认“完整且不超限”的压缩材料 | 保留预算与失败 gate；在上述两项方法范围确定后再完成逐条材料与 goldens。不能把大 JSON 或源码说明藏进引用元数据绕过预算 |
| 隔离 | broker 路径/阶段 canary 通过，不代表当前 Codex 共享环境隔离。尝试的 macOS sandbox 本地 Node 限读探针退出 -6；未采用 allow-default 当隔离证据 | 后续执行只能使用仅暴露此 broker 的独立参与者环境，并验证环境无额外工具/上下文；不把本批开发子任务算成盲测 |
| 具体执行 | 模型实际版本、报价、真实参与者与 consent 尚未具备 | 保持 0 次授权、0 费用；不能生成看似可执行的批准申请 |

C2 的原始“只有 post-write 收据”问题已在本批修复，**不再是待用户决定项**。其 B 观察点涉及第一次 physical transport 的资格，不能解释成再次 admission/replay 的许可。

需要用户审阅的实质变化是上表前两项。推荐一次修订方法范围，不改变 library；之后继续同一批材料准备。其余缺口不能靠反复跑性能测试解决。本批没有改正式性能门槛或声称性能合格。

## QA 与实际检查

两名独立 reviewer 分别执行 blind/edge 视角；第三个独立 review dispatch 被工具以 agent thread limit 拒绝，因此 verification-gap 视角在本地单独进行，不宣称三方独立。

已修复：材料/答案/评分 schema 不一致；relations 可把 B 数据夹带到 A；缺单个 deps 可绕过完整边检查；稀疏数组/getter 绕过规范化；本地检查发现 JSON 会把 Map/Set 变空对象，已改为保留集合内容并加入消费证据回归。

实际运行：

- `node --test scripts/b121-comparison/*.test.mjs`：24 通过，0 skipped。包括生成器→broker→封存→独立 grader、篡改/缺失/全部 unknown、A/B 泄漏、边/依赖不一致及 C6 集合内容回归。
- `node scripts/b121-comparison/prepare.mjs`：只读 preflight 完成，五类未就绪项明确保留。
- `node dashboard/build.mjs --check`：通过。
- TS 直接 capture：6 arms 通过。全量 TS：2712 passed / 4 skipped；build 通过。
- TS full lint 未通过：1343 errors，包含现有归档诊断文件问题；本批 scoped Biome 通过，现有示例 typecheck 通过。没有为了 gate 修改旧归档或无关工作区文件。

不能由上述测试推出真实参与者更容易理解、Graph 比 plain 更快，或 B121 已完成。

## 审阅顺序

1. 先看本报告的两项方法差距及 [readiness.json](readiness.json)。
2. 查看 [projection.json](projection.json) 的完整成员/边，确认默认缩图并未删除运行关系。
3. 查看 [TS 观察说明](../../../../../graphrefly-ts/docs/design/causal-comparison-preparation/README.md)，特别是局部 quiescence 与宿主结束边界。
4. 工具入口：[prepare.mjs](../../../../scripts/b121-comparison/prepare.mjs)、[session.mjs](../../../../scripts/b121-comparison/session.mjs)、[materials.mjs](../../../../scripts/b121-comparison/materials.mjs)。
