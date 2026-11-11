# D797 迁移独立维护者审核（Codex）

日期：2026-11-11（America/Los_Angeles）。范围：根协议 + TS / Rust / Python 三个迁移分支。只读审核；不改代码、规则、决定、工作记录，不提交、不推送、不切分支。唯一交付文件是本报告。没有读取 `REVIEW-D797-migration-*` 的其他报告，也没有用上一轮设计审核作为本轮发现来源。

证据标签：**实测**＝本次执行测试或最小探针；**静态确认**＝本次读源码、diff、规则或搜索；**建议/待定**＝尚未实施或需语义选择。已知问题先独立核验，没有直接照抄为 finding。采用共享 BMAD 的 blind、edge-case、verification-gap 三个只读子审查视角，主审核复核并定级；这不表示任何人完成了逐行穷尽证明。

审查路径缩写：`root`=`/Users/davidchenallio/src/graphrefly`；`ts`=`/Users/davidchenallio/src/graphrefly-ts`；`rs`=`/Users/davidchenallio/src/graphrefly-rs`；`py`=`/Users/davidchenallio/src/graphrefly-py`。下文表格中的仓库相对路径均相对于这四个绝对根目录；关键 finding 提供可点击绝对链接。

## 1. 结论

**TS：不建议按当前 head 合并。** 阻塞不止三条冻结 digest：已实测 later `ctx.down` 插入正在交付的波、旧 ctx 修改新 lifetime 的私有状态、quiet 旧输出越过 replace、queued rewire 失败误变节点 ERROR。quiet 多数组还被拆成多个后续波。应先修 F1–F4、F7，处理 F9 的规则冲突，并完成 F10–F13 中 TS 的证据/API 缺口。lint、选定测试类型检查、ESM/CJS/DTS 构建都通过，不能抵消这些行为缺陷。

**Rust：不建议按当前 head 合并。** 默认测试 505、全特性 521 均通过，但两个 queued replace 可提交出环；有保存值、无 private state 的 computed checkpoint 在缺 received 时仍被恢复并重跑函数。先修 F5、F8，完成 definition 的契约缺项和 F9 的规则处理。默认域 reporter、每线程共享调度、process/CQRS 的不可 checkpoint 类型另列为明确选择，不能混同这两个确定 bug。Python binding 删除应按既定合并顺序执行，不把它当前暂存本身判成新内核错误。

**Python：不建议按当前 head 合并。** 纯 Python 打包已验证成功，231 tests 通过、2 个可选运行时测试跳过，ruff/mypy/docs checks 通过；但 replace/rewire 排队可形成环、checkpoint 引用 live 可变对象、回滚后 definition 元数据漂移、queued batch 对已结束 state 执行 updater 却不报告拒绝。先修 F5、F6、F11、F14，并处理 F9。纯 Python 方向和 facade 分层可以保留；没有依据要求回到 Rust binding。

**root：本轮不提出规则或账本修改。** 审核基线的公开规则为 D798 激活、D799/D801 修订的内核及 D802 的 checkpoint，共 15 条；pause/demand/history/restart/revision 仍未激活。root-only authority gate、40 个 resolver 测试、dashboard check 通过；workspace authority/work gates 因三个迁移 work 孤立失败。该孤立状态已在三份 work 的 note 中明确记录，属于尚未完成的集成交付，不是无授权实施的证据。不能把本报告或测试绿灯写成合并批准。

### 审核快照

| 仓库 | 审核 HEAD | 比较基线 `origin/main` | 分支范围 |
|---|---|---|---|
| root | `07631d81a6ae52f17db4c39ca1956f6a9c577b62` | main | 当前激活规则、场景、handoff、D797–D802 |
| ts | `ee2595eccf5d960dbddf4cb39154d08dbf6cc599` | `cadf3ca66ba7898aa3cf6a46859c79a451091805` | 27 commits；340 files，+19,812 / −19,925 |
| rs | `c6dba4eaef7292389a7dabf1bf7b16d8a59fe608` | `cf02fc97070e32560c0b4b22481418c8163d6e80` | 8 commits；72 files，+9,708 / −12,125 |
| py | `fb583d07db19ab743e72a90cb9b95de9d642ea8d` | `467e5290f2000e39d688fcbf8f5e38c62466d77c` | 9 commits；120 files，+8,373 / −10,784 |

三个 runtime 的 HEAD 均与本地 `origin/d797-kernel-migration` 一致，开始时 status 为空。没有 fetch：遵守联网只用于构建工具的限制，所以不声明远端服务器当前仍是这些值。Python 本地 main 与 origin/main 不同；本次严格使用要求中的 origin/main，没有偷换基线。

root 开始时仅有未跟踪 `sessions/active/PROPOSAL-B140-bridge-module.md`。审核中出现并发 bridge 模型/实现/测试及规则、决定、handoff 等 staged 修改；它们不属于本审核操作。未读取其他审核报告，未改动或回滚这些并发工作。本报告的 root 依据限定于上述审核基线，不声称覆盖后来 staged 的 bridge 修订；最终状态详见附录。

### 原则与当前依据

规则以 `authority/README.md:28` 的 activation/transition contract 为准。主要定位：`spec/rules.jsonl:123` R-wave@2、`:126` R-subscription@3、`:128` R-invocation@2、`:129` R-terminals@1、`:130` R-invalidation@1、`:132` R-lifetime@2、`:134` R-request-order@2、`:136` R-node@2、`:139` R-failure@3、`:145` R-checkpoint@1。D797 不是代替这些当前文字的另一份规则。

已读两份 B140 提案、runtime-owner handoff（含 Checkpoint after D802）、root D797–D802，以及要求列出的全部本地 durable/execution 决定。参考代码只用于理解/辨别共因；3000 个随机对照也不算规范符合性证明。bridge 新模型本身未审。

## 2. 必须修（按后果排序）

P1＝合并前应解决的行为/证据阻塞；P2＝明确的契约、验证或维护交付缺口。`patch` 表示现有规则已确定修法；`bad_spec` 表示必须先调和规则/实现，不能自动改规则；本轮所有条目都只提出修复，没有实施。

### F1 · P1 · TS 的 later ctx.down 插入正在交付的另一波

**位置：** [node-context-runtime.ts:59](/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/node/node-context-runtime.ts:59)，[node-output-runtime.ts:54](/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/node/node-output-runtime.ts:54)。**依据：** R-wave@2、R-request-order@2。**分类：** patch；实测。

保存无依赖 computed source 的 ctx，在 state `t` 第一个 sink 中调用它的 `down(DATA)`，第二个 sink 也记录日志。实际 `t:first → source → t:second`；应是 `t:first → t:second → source`。函数已经返回后的输出是新请求，必须等当前波完整交付；当前代码只 `enterWave/_down/exitWave`，嵌套深度没有提供排队语义。后果是跨波交错和可达的中间状态观察。

**改法：** 区分当前 invocation 内暂存输出与返回后的输出；后者进入统一 FIFO，并在执行时验证原 lifetime。不要以重新增加 wave depth 代替 request。加入两个源、两个 sink、fan-in 的顺序回归。附录 P1 为本次实际探针。

### F2 · P1 · TS 旧 ctx 可以写入新 lifetime 的 private state

**位置：** [node-context-runtime.ts:122](/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/node/node-context-runtime.ts:122)。**依据：** R-lifetime@2、R-invocation@2 的 lifetime 私有状态范围。**分类：** patch；实测。

第一次 subscribe 保存 old ctx，unsubscribe，再 subscribe 打开新 lifetime。`old.signal.aborted` 已为 true，但 `old.state.set('stale')` 后，新 ctx 的 `state.get()` 变成 `'stale'`。getter/setter 直接访问 node 当前 `_privateState`，没有捕获 lifetime 身份。

**改法：** accessor 绑定原 lifetime 存储和身份，关闭后不能读写下一 lifetime；cleanup 仍可读取它自己那份尚未释放的 state。Python `_kernel/ctx.py:102` 的 identity 检查、Rust `ctx.rs` 的 `open()` 可供比较，不必另造兼容接口。附录 P1。

### F3 · P1 · TS quiet 排队输出穿过 replace，污染新实例

**位置：** [node-context-runtime.ts:136](/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/node/node-context-runtime.ts:136)。**依据：** R-lifetime@2、R-node@2。**分类：** patch；实测。

上游首个 sink 先排 `replace(q)`；同波旧 quiet q 随后运行并排 DATA100。实际 q 的 sink 收到新实例 `START`，随后旧实例 `DATA100`，最后新实例 `DATA999`。deferred task 仅看 `_released`，没有原 signal，故 replace 后旧工作仍被应用。

**改法：** 在排队时捕获 instance/lifetime，执行时检查；与 F1 使用同一条 late-output 路径。既测 unsubscribe/reactivate，也测 replace；不是只加 `_released` 判断。附录 P1。

### F4 · P1 · TS queued rewire 失败被改造成节点 ERROR

**位置：** [node-rewire-runtime.ts:29](/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/node/node-rewire-runtime.ts:29)。**依据：** R-failure@3。**分类：** patch；实测。

a、b 都已激活且保存 ctx；一个 batch 里请求 `a.rewire([b])`、`b.rewire([a])`。第二个请求执行时正确发现环，但 catch 调 `_down(ERROR)`。实际 a、b 都变成 errored，`Graph.report` 调用 0 次。请求失败发生于函数已经返回之后，不是该节点函数抛错。

**改法：** 保留执行时 cycle 检查，将异常交给 request 的 caller/reporter 边界，不发协议 ERROR。第一个合法请求可保留，第二个失败不得改变其节点实例或终止整条链。附录 P2。

### F5 · P1 · Python replace/rewire、Rust replace 在排队后不重新检查拓扑

**位置：** [Python graph.py:607](/Users/davidchenallio/src/graphrefly-py/src/graphrefly/_kernel/graph.py:607)、[graph.py:679](/Users/davidchenallio/src/graphrefly-py/src/graphrefly/_kernel/graph.py:679)；[Rust node.rs:4573](/Users/davidchenallio/src/graphrefly-rs/crates/graphrefly/src/node.rs:4573)。**依据：** R-request-order@2 明确拒绝 current/declared dependencies 的环。**分类：** patch；两种语言实测。

初始 a、b 无依赖，batch 内先 `replace(a,[b])` 再 `replace(b,[a])`。调用时分别合法，执行时第二个已非法，仍提交为 a↔b，未报告失败。Python 对两个已激活节点的 `ctx.rewire` 也复现同一结果。Rust rewire 执行时会重验，缺陷限 replace；TS replace 也有执行时检查，不能笼统说三边都有此 bug。

**改法：** 每个 topology request 在实际提交前，基于前序请求已提交的拓扑重验；先验证，再关闭旧 lifetime/修改 edges。失败送 reporter。除两节点环，再覆盖 declared/current 混合回边。附录 P3/P4。

### F6 · P1 · Python checkpoint 不是隔离的边界快照

**位置：** [\_checkpoint.py:70](/Users/davidchenallio/src/graphrefly-py/src/graphrefly/_checkpoint.py:70)、[:143](/Users/davidchenallio/src/graphrefly-py/src/graphrefly/_checkpoint.py:143)。**依据：** R-checkpoint@1 保存一个 wave boundary 的 values/private state。**分类：** patch；实测。

`_json` 已执行 dumps/loads 验证，最后却返回原对象。counter 节点 capture 时 saved.values=[1]、saved.state.count=1；下一次普通 set 让私有 dict 原地加一后，原 checkpoint 的 count 自行变成 2，但 values 仍 [1]。恢复输入已不对应同一个边界。recipe config、嵌套 DATA 也具有同源别名风险。

**改法：** 用已验证的 JSON 解码结果作为独立快照，统一隔离 values、private state、inputs、recipe、ERROR payload；restore 也应隔离输入对象。补 capture 后继续运行、修改 checkpoint 不反向修改 live graph 的测试。附录 P3。

### F7 · P1 · TS 一次 quiet invocation 的多个数组变成多个 wave

**位置：** [node-context-runtime.ts:133](/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/node/node-context-runtime.ts:133)。**依据：** R-wave@2、C-44 的 quiet 函数输出作为后续一波，数组边界仍保留。**分类：** patch；TS/Python 实测。

quiet fn 连续两次 `ctx.down([DATA])`，其单一下游在一次上游 set 后运行 2 次；Python 相同输入为 1 次。当前每次 down 排一个独立任务，改变 fan-in/occurrence 的处理次数。每个 down 是独立数组，并不意味着同一同步 invocation 的每个数组都是独立 wave。

**改法：** 按 invocation 收集输出数组，用一个带 lifetime 的后续波发送，保留数组的先后和分隔。与 F3 同一实现入口，但需要独立断言，不能只补 signal 就算完成。附录 P2。

### F8 · P1 · Rust 接受丢失 received 的有值 checkpoint，并额外运行函数

**位置：** [checkpoint.rs:1387](/Users/davidchenallio/src/graphrefly-rs/crates/graphrefly/src/checkpoint.rs:1387)。**依据：** R-checkpoint@1、C-38：缺少接收记录的旧/残缺格式必须拒绝，不能由依赖补出。**分类：** patch；实测。

合法 active map 节点 p 无 private state，checkpoint 有 values=[1]、received=Some([...])。仅删除 received，restore 仍 Ok；原依赖未改变，首次 subscribe 却让 recipe fn 运行一次。本次另比对合法 inactive p：其 values=[]、received=None；因此反例不是把合法 inactive 格式误判成错误。

拒绝条件目前只有 `!deps.is_empty() && private_state.is_some() && received.is_none()`，漏掉有值但没有 private state 的普通 map，也不能完整表达无依赖的已激活 source。

**改法：** 格式显式区分“无 lifetime/无保存内容”与“保存的 lifetime/未消费 seed”；后者无论是否设置 private state 都必须有完整接收记录（零依赖为 []）。对 open + retained values + 无 received 的组合 fail closed。附录 P4。

### F9 · P1 · 三边与参考共同跳过 terminal-only 的最后一次 auto COMPLETE invocation

**位置：** [TS node-input-runtime.ts:203](/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/node/node-input-runtime.ts:203)、[Rust node.rs:3407](/Users/davidchenallio/src/graphrefly-rs/crates/graphrefly/src/node.rs:3407)、[Python graph.py:969](/Users/davidchenallio/src/graphrefly-py/src/graphrefly/_kernel/graph.py:969)；规范 [rules.jsonl:129](/Users/davidchenallio/src/graphrefly/spec/rules.jsonl:129)。**分类：** bad_spec（规则/共同实现冲突）；三边实测、参考静态确认。

s 初值 1，raw computed n 的函数计数。subscribe 后计数 1；`s.complete()` 后 n 已 completed，计数仍 1。规则却写 auto COMPLETE 在 “the run that sees the last terminal” 之后完成。C-17 的文字也这么写。三边都只把 manual terminal 纳入 runs 条件；参考 `kernel.mjs:529` 同样跳过。参考相同不构成规则豁免。

**推荐：** 按当前明文，最后一个 terminal 到达时调用 raw fn 一次，再自动 COMPLETE；value-level sugar 可自行不重算。若真实意图是 auto terminal 从不给函数，就必须先走 root spec-amend，把“最后一次 run”改清楚，更新 C-17/model/runtime 证据。本轮不代替用户选择，也不把此问题伪装成三边不一致。

### F10 · P1 · TS 冻结证据已漂移，当前默认测试仍失败

**位置：** [root-eval-topology.test.ts:1305](/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/__tests__/solutions-agentic-memory-work-item-root-eval-topology.test.ts:1305)、[D686 test:183](/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/__tests__/work-item-execution-project-fit.d686.test.ts:183)、[D687 test:184](/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/__tests__/work-item-execution-default.d687.test.ts:184)。**依据：** 各 frozen qualification 的源码/证据绑定，D174 的 phase checks 要求。**分类：** patch（证据迁移）；实测 + diff。

全量测试 2662 passed / 4 failed / 4 skipped；其中 3 个 digest 不匹配分别属于 D159、D686、D687。第四个是 5 秒超时，单测复跑 990ms 通过，未列为确定产品 bug。D686 `graph-arm-harness.ts` 与 D687 `manual-arm.ts`/`harness.ts`/`evidence.ts` 的冻结输入确已随迁移改动；不是仅未知环境造成的 hash 变化。

**改法：** 不直接替换预期 hash。保留原 qualification 的完整源码与原 digest 到历史位置；把迁移后的可运行评测作为新源码绑定的资格结果，或明确撤下“当前资格”声明。默认测试应验证历史字节未变与当前行为，各有准确名字。已有 historical integrity 检查可复用，避免两个历史事实混用一套路径。

### F11 · P2 · Python replacement 回滚后 definition callback/setup 漂移

**位置：** [\_facade.py:1804](/Users/davidchenallio/src/graphrefly-py/src/graphrefly/_facade.py:1804)、[:1814](/Users/davidchenallio/src/graphrefly-py/src/graphrefly/_facade.py:1814)。**依据：** R-request-order@2 的 body throw 丢弃 topology requests，R-node@2 的 current definition。**分类：** patch；实测。

batch body 调 `g.replace(n,[],new)` 后抛错，kernel 没执行 replacement，但 facade 已立即更新 `_callbacks[node_id]`；`g.definition(n).callback is new` 为 true，实际运行仍 old。排队失败也有同类双真相风险。

**改法：** definition 元数据与 kernel instance 同一次提交；最好从真实 instance/wrapper 恢复 callback/setup，不维护独立提前更新的字典。测试 rollback 后 definition、执行 callback、recipe、setup 全部仍一致。附录 P3。

### F12 · P2 · definition/seed 接口尚未兑现同一套内核概念

**位置：** [TS NodeDefinition:144](/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/node/types.ts:144)、[Rust NodeDefinition:4180](/Users/davidchenallio/src/graphrefly-rs/crates/graphrefly/src/node.rs:4180)、[TS seed lifecycle:42](/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/node/node-lifecycle-runtime.ts:42)。**依据：** R-node@2、R-invocation@2、D799；静态确认。**分类：** patch（明文缺项）及待明确的公开层映射。

TS definition 仅 deps/fn/setup/recipe，缺 policies；Rust 只 `has_function: bool`，读不到当前 function；Python 有完整字段但有 F11。另 TS NodeSeed 专门是 `{received,ran}`，内核 activation 直接解释 checkpoint 并比较 JSON，ctx 没有 opaque seed note；Python private kernel 有通用 seed/note，Rust 有 `Ctx::seed`。不能宣称三边都已实现同一套 definition/seed 合约。

**改法：** definition 至少同样给 declared deps、当前 fn、setup、recipe、三策略/quiet；Rust 可以提供 cloneable callable handle，不能因没函数重载就退化成 bool。TS 把 checkpoint 接收记录解释移到 checkpoint wrapper，内核只储存/交付 opaque note；核实 raw/public facade 哪一层暴露 seed，文档明确，不为了统一而复制整套 package API。

### F13 · P2 · TS 消息拒绝测试与 cleanup mutant 存在假阳性

**位置：** [phase1-messages.test.ts:135](/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/__tests__/d797-kernel.phase1-messages.test.ts:135)、[qualify-spending-publication.mjs:127](/Users/davidchenallio/src/graphrefly-ts/scripts/qualify-spending-publication.mjs:127)。**依据：** C-42、D175 和 qualification 的实际故障覆盖。**分类：** patch；静态确认（mutant 未执行）。

`a.down(attempt).toThrow()` 在 State 已无 down 后，仅靠 TypeError 就通过，不证明闭集校验；测试类型检查 tsconfig 只包含选定文件，也没有发现此旧调用。cleanup mutant 注入已删除 `ctx.onDeactivation`，可能只因无效 API 导致节点 ERROR 和后续 AssertionError，而非实际执行“清空 authority map”的反例。

**改法：** 删除不存在的 host down 拒绝测试，以公开 API absence/type 测试和真正 ctx.down 拒绝用例接替；把 mutant 写成合法 setup-return-cleanup，并证明删除动作发生后目标断言失败。保留各测试独立证明的义务，不用覆盖率代替行为。

### F14 · P2 · Python queued batch 对已结束 state 执行 updater，拒绝被静默吞掉

**位置：** [graph.py:1141](/Users/davidchenallio/src/graphrefly-py/src/graphrefly/_kernel/graph.py:1141)。**依据：** R-terminals@1 host input to ended node refused；R-request-order@2 的执行顺序；R-failure@3 的无 caller 失败报告。**分类：** patch；实测。

t 的第一 sink 排 `complete(s)`，第二 sink 排含 `set(s, updater)` 的 batch。commit 时 s 已结束，代码仍 `_resolve` updater，实际 updater 收到 1 并运行，s 保持 COMPLETE，report=[]。普通 set 请求的执行时检查没有覆盖 batch commit。

**改法：** commit 在求 updater 前按当前状态验证全部目标，已结束 state 的 host input 走明确拒绝/report；不提交部分写入，仍按 D799 保留 body 的 topology requests。关闭 lifetime 的 staged output 则属于 drop，不能与 ended host input 混为一类。附录 P3。

### F15 · P2 · 当前公开文档仍教授退役协议

**位置与证据：** `ts/docs/README.md:13` 仍链接当前 RxJS 指南，而 `docs/coming-from-rxjs.md:71` 教 DIRTY 两阶段；`ts/website/src/content/docs/recipes/from-callbag-recharge.md:107`、`:154` 讲 DIRTY/TEARDOWN；`comparisons/jotai.md:28`、`:115` 讲 TEARDOWN；`rs/crates/graphrefly/src/node.rs:4513` 仍写非 resubscribable terminal 不能 subscribe；`py/docs/docs.jsonl:7` 仍指定 `uv run maturin develop --release`。静态确认，分类 patch。

**改法：** 当前指南与 API 注释按 D797/D800 改写，生成文档从 source/docstring 重建。历史 frozen 源码保留原字节并 archive，不能用全局字符串替换“修”历史证据。自动 docs:gen:check 通过只说明生成物与错误源文一致。

## 3. 三边一致性

“相同”指已读的实现和测试覆盖，不代表穷尽所有输入。API 名字以语言命名规范为限；当前审核要求中的统一目标优先，包内既有差异要显式报出。

| 概念/API | TypeScript | Rust | Python | 统一结论与方案 |
|---|---|---|---|---|
| 消息集合 | 七类型，ctx.down 校验 | enum 闭集；down runtime 拒绝 kernel-only | private tuple；public Message dataclass | 主路径一致；保留 Rust 静态不可表示的差异；修 F13 |
| host 输入 | StateNode.set/invalidate/complete/error | State<T> 同四个 | State 同四个 | 普通节点无公开 down、Graph 无 host input；内部分支另见 §4 |
| set 的函数形式 | value 或 fn；Object.is 同值不写；无值 undefined | Into<StateWrite<T>>；from_fn 返回 None 不写 | value 或 callable；is 同对象不写；无值 SENTINEL | Rust 显式 wrapper 是类型重叠所需；不要加 update 别名；测试 batch 执行时值，修 F14 |
| subscribe | 每数组一次，activate 后 START+snapshot | 同；Fn(&[Message]) | 同；tuple[Message,...] | 同步 source 激活的多值须一个数组；C-41 主路径有实断言 |
| wave | FIFO、数组暂存；late/quiet 漏洞 F1/F3/F7 | core + boundary queue | Graph 内 queue | 统一一个已绑定 lifetime 的后续波请求；数组与波不能混为一物 |
| auto/manual 策略 | 平铺 complete/error/invalidate | NodeOpts 相同概念 | Graph.node 平铺同名 | 值域一致；terminal-only auto COMPLETE 的 F9 必须统一裁定 |
| ctx terminal/invalidated | 实际是 `terminal[i]` / `invalidated[i]` | `terminal(i)` / `invalidated(i)` | `terminal(i)` / `invalidated(i)` | 审核要求的“全是方法”不属实；TS work Phase3 明写数组形状。建议统一方法，属包 API 对齐，不虚报违反根数组协议 |
| INVALIDATE | auto 清值/不跑 fn；manual 输入 | 同 | 同 | 主路径一致；无值时无效是已接受设计，勿报旧 onInvalidate 消失为 bug |
| lifetime/setup | signal + setup cleanup；旧 state accessor 有漏洞 | CleanupCtx 读 closing state | closure cleanup + identity | Rust cleanup 参数与 GC 语言 closure 是合理语言映射；关闭旧 scope 不能污染新 scope |
| 请求队列/batch | module boundary + shared default dispatcher | wave/queue/batch 每线程 | queue/staging 在 Graph 实例 | 同线程图隔离目前不一致；按 bridge 暂缓记录，不默许成最终协议 |
| replace | Graph.replace；执行时校验 | Node.replace；只入队前校验 | Graph.replace；只入队前校验 | 建议统一主入口 Graph.replace(handle,...)，低层 Node 可保留真正必要入口；先修 cycle，不以别名补一致性 |
| rewire | ctx.rewire；internal _rewire(fn,declare) 仍在 | ctx/DeferredCtx.rewire；fan_in helper | ctx.rewire | 公共含义一致，内部 bridge/test 后门须收拢；执行时错误走 reporter |
| definition | deps/fn/setup/recipe，无 policies | deps/has_function/setup/recipe/policies | facade 完整但 metadata 漂移 | F11/F12；一份 instance 真相 |
| status | cache/output/lifecycle 派生 | 三 enum 派生 | NodeStatus 派生 | 保留语言表示差异；不要再保存历史 status 字段 |
| reporter | Graph report；默认不记录 | GraphOptions.report；默认域无 reporter | Graph(report=...)；默认 logging | callback 可一致；默认诊断行为目前不同，建议公开 Graph 默认至少诊断，bare core 明确 caller/配置责任 |
| seed note | checkpoint 专用 received/ran，ctx 不暴露通用 note | Ctx::seed，opaque note | private kernel ctx.seed；facade未同样暴露 | TS checkpoint 逻辑侵入 kernel；按 F12 收敛；公开层选择要明确 |
| checkpoint | v2 format；recipe registry；backendState 扩展 | v2 format；descriptor registry；collection backend→privateState | `graphrefly-py/checkpoint@1`；recipe registry | 编码/tag允许各包不同；tag不是 revision evidence。都不应保存节点版本证据；修 F6/F8 |
| emit sugar | raw down 明确数组，组合器 oneArrayPerRun 等 | 连续 emit 合一个数组，down 切断 | emit(*values) 一次一数组 | Rust 合并是允许的 sugar，但无语言必要。推荐三个公开 emit 一次调用一数组，另以 iterable/varargs 表多值；保留与否需包 API 决定 |
| Graph.find | 返回自身句柄，state 为 StateNode | GraphNode.as_state::<T>() | 返回 Node/State 自身 | 已落地；Rust泛型收窄必要 |
| Graph.observe | 图层观察 | 图层 observe | GraphEvent(path,messages,seq)，不激活 | 可以保留，不能把观察序号当 protocol revision；observer异常交 reporter |

### 场景实际核对

| 场景 | TS 实际测试 | Rust 实际测试 | Python 实际测试 | 证明范围与遗漏 |
|---|---|---|---|---|
| C-41 | `d797-kernel.phase2-waves.test.ts:292` | `kernel_conformance.rs:508` | `test_kernel_waves.py:483` | 三边验证 last DATA array、RESOLVED 不替换、INVALIDATE、batch、多值、state 保留；不是跨 lifetime 旧 ctx 的验证 |
| C-42 | `phase1-messages.test.ts:59` | `kernel_conformance.rs:113` | `test_kernel_messages.py:94`；facade `test_facade.py:296` | 主路径真有拒绝断言；TS host.down 小节为 F13；Rust闭集可用编译形状证明 |
| C-38 | `checkpoint.d802.test.ts:156` | `kernel_conformance.rs:2654` | `test_kernel_checkpoint.py:116`；public facade `test_facade.py:740` | 静默 restore、输入改变、setup、replace/rewire、boundary/nonJSON 拒绝有覆盖；缺 F6 live alias 与 F8 无privateState但缺received |
| C-35 / C-29 | phase5 requests | kernel_conformance requests | kernel requests | 直接自环/已存在路径、batch rollback 有测；缺多个排队 topology requests 组合后才成环，以及 facade metadata rollback |
| C-44 | quiet/terminals/manual invalidate | 同 | 同 | 测 later down 在波外，不能抓 F1 在另一个波 sink 内调用；单 quiet 输出抓不到 F7 |

root `spec/conformance.jsonl:8` 的 C-5 仍是旧 PAUSE/RESUME required/pass，D798 明确把旧模块场景留到模块激活时处理。应在投影中清楚标历史/不适用新 kernel，不能拿旧 pass 作本次证据；不是本轮重开 pause 模块的理由。C-1a、C-1c 的 Python todo 已核实；没有恢复 wire 资格。

## 4. 删除和 archive 清单

以下是具体建议，不是本轮已执行操作。范围外的删除不应假装是本次 bug 修复。

| 文件/符号 | 建议与理由 |
|---|---|
| `ts/packages/ts/src/__tests__/d797-kernel.phase1-messages.test.ts:135` 的 host node.down 小节 | 删除，用真实公共边界测试接替，避免 TypeError 假阳性 |
| `ts/packages/ts/src/__tests__/helpers/owned-rewire.ts:12` 的 rewireOwnedNode/addOwnedNodeDep/removeOwnedNodeDep/injectOwnedNodeInput | 逐调用方改公开 replace 或 setup ctx.rewire 后删；当前直接 `_rewire(...,{declare:true})` 改被测对象，能绕过正在验的请求语义 |
| `ts/packages/ts/src/__tests__/helpers/as-state.ts` | 不应机械删：它检查 instanceof 后收窄，可抓错类型；若 bundle 本来保证 State，应修公开输入类型后再移除辅助层 |
| `ts/packages/ts/src/adapters/bridge.ts:157`、`bridge-wire-edge-group.ts:22` 的 host `_rewire` | 暂缓期遗留；bridge 切片完成时用显式输入/生命周期 rewire 接替，不把它包装成 public兼容 API |
| `ts/packages/ts/src/adapters/bridge-wire-edge-group.ts:700` 的 `releaseCohorts._down` | 暂缓期内部写入口；将 release 从 ctx 或 State 的合法路径发出，不能直接绕过 lifetime/request |
| `ts/packages/ts/src/graph/restore.ts:874` 内部 `_rewire` | 新图恢复 bootstrap 应收敛为 construction seed/lifetime deps；此处不是 live host兼容，需与 bridge 后门分开迁移 |
| `ts/.../node-runtime-host.ts` 中允许 fn-swap/declare 的通用 `_rewire` 形状 | 在上面调用方迁走后收窄；别保留“内部随意改定义”作为第二个 replace |
| `ts/packages/ts/evals/work-item-execution-project-fit` / `work-item-execution-default` 的旧冻结源及资格 JSON | 完整冻结到 archive/history，当前迁移版本另有身份；不要重写旧 digest 伪造历史稳定 |
| `ts/packages/ts/evals/graph-native-rerun-avoidance` 的 D159 旧资格 | 区分历史 receipt 与 current qualification；已有 history 检查仍保留，不 blanket 删除整个 eval |
| `ts/scripts/qualify-spending-publication.mjs:134` 的 onDeactivation mutant | 删除旧注入实现，以合法 setup cleanup mutant 替代 |
| `ts/.../local-untrusted-js-runner.mjs` tracked bundle | 交付时从现源码重建；若保留旧版本做历史资格，放明确历史位置并绑定旧 digest |
| `ts/docs/coming-from-rxjs.md`、website recipes/from-callbag-recharge.md、comparisons/jotai.md 等当前旧协议段落 | 改当前指南，别把有用比较整篇删除；source 注释同步改后生成 API docs |
| `ts/docs/design/causal-*-optimization/comparison/source/**` 等冻结副本 | 作为完整历史实验搬 archive 并修索引；不要用 lint或新协议改它们原字节，也不与当前源码共同声称 current |
| `rs/crates/graphrefly-bindings-py/` | Python新内核合并且不再进口_native后删；单 `src/lib.rs` 实测 4,121 行，另有 Cargo.toml/tests；D800 已有方向，无需维护新兼容层 |
| `rs/AGENTS.md:4`、`docs/architecture.md:20`、`Cargo.toml:7` | 当前 native ownership/active workspace 文字立即改准确；保留“等待Python合并再删”的状态说明即可 |
| `rs/release-plz.toml:23` binding override | 随 binding 删除一起删，别留给不存在 workspace package 的发布配置 |
| `rs/node.rs:4513` 旧 resubscribable panic rustdoc | 删除旧承诺，改 ended snapshot subscribe 语义 |
| `rs/decisions/decisions.jsonl` D7 的 rewire_next_*、D1(7) 旧 checkpoint 暂态 | 用后续决定/状态视图明确被 D8/D5 接替；保留历史正文，不重复在现行 API 文档教授 |
| `py/docs/docs.jsonl:7` maturin verification | 换 uv build + wheel安装/import验证；D6 同步修“uv sync editable install”与 package=false 的矛盾 |
| `py/src/graphrefly/_facade.py` 的独立 `_callbacks` definition 真相 | 随 F11 取消重复可变来源；不能只补一个 rollback 分支留下 queued-failure 漏洞 |
| root 已完成的 B140 activation/checkpoint 提案、handoff | B140/modules尚未全收尾，不主张现在整批 archive；在工作完成时逐份迁移，保留唯一历史入口 |
| root C-5 等旧模块场景 pass/harness | 在生成视图标历史资格；随各模块激活改写/接替，不能静默当成当前内核测试 |

搜索覆盖代码、测试、类型/导出、README、AGENTS、docs、website、examples、runner/fixtures；明确排除了其他审核报告和博客正文。对 DIRTY/TEARDOWN/PAUSE/RESUME/PULL/pullId/upNext/onDeactivation/onInvalidate/persist/resubscribable/replayBuffer/rewireNext/replaceDeps/ctxState/_native/PyO3/maturin 等做了搜索。`up`、普通 persist/paused 英文、负向闭集测试、历史证据命中不是自动缺陷。Rust proto 的 PENDING rename 和桥接“两阶段”测试属于本次明确暂缓边界，不冒充新模型通过。

## 5. 精简建议

### 5.1 优先把 TS 三条输出路径收为一个 request 实现

当前普通 later down、quiet deferred down、内部直接 `_down` 各带一部分检查，F1/F3/F7 正是分叉遗漏。建议核心只保留同步 invocation 的输出收集和一个 `publishLater(lifetime, arrays)`；后者统一排队、取消和 reporting。不是把所有同步输出都变异步。

规模：`node-context-runtime.ts:59–74`、`:133–150` 两套路径约 35 行，另有调用方 glue；预计净删除几十行，主要收益是少两套不一致时序。风险：quiet 激活 snapshot、batch staged output、auto terminal 的顺序需回归。

### 5.2 TS checkpoint 从 kernel 中退出为模块 wrapper

`node-lifecycle-runtime.ts:42` 直接识别 `{received,ran}`，`sameAsReceived:71` 在内核比较 canonical JSON。按 D799，kernel 只存 opaque recipe/note，checkpoint wrapper 才解释接收记录。Python `_checkpoint.py` 的 wrap/gate 边界更接近这个职责划分，Rust已有opaque note。

预计移出/删除内核约 60–120 行 checkpoint专用条件和比较（设计估算，不是已验证 diff）；模块层未必净减少同量代码。风险是首次 activation/setup/terminal-only 输入的语义，必须以 C-38 和 F6/F8 的反例验。

### 5.3 集合统一成 command state → computed reducer → views

TS backendState 扩展、Rust capture-time 把独立 store 投影成 privateState 都没有统一运行时所有权。建议集合 API 写 command state，computed 拥有 backend/private state，views 只派生；需要跨消费者 detach 保留时，bundle 明确持有 reducer，或用独立 durable state，不恢复 ctx.state.persist。

能删 collection-specific capture/restore stitching 和大量 bind/disposer 特例，但本轮没有设计实现，不能诚实给出净 LOC 保证。候选规模是 TS 四类集合恢复扩展、Rust checkpoint backend/helper 分支中的数百行；需先做一种集合验证再估全量。风险：mutation 返回值、批处理原子性、关闭后再打开的保值、命令 retained replay。

### 5.4 删除 native binding，而非继续做跨语言 facade 抽象

D800 后删除 Rust binding 是最确定的大减量：单 lib.rs 已测 4,121 行。Python 保持纯 Python kernel + facade + async adapters，不把新的 Python API 再包到 Rust。删除时机见 §6，避免 main 上旧 Python仍需依赖时断链。

### 5.5 测试构造应使用真实公开路径

`helpers/owned-rewire.ts` 约 70 行加其调用方可去掉；保留最小核心白盒 harness 以发送原始数组，但不要把产品对象改成另一个图后仍声称验证原来的 bundle。下游 tests 应通过真正 State 输入、Graph.replace、setup所持 ctx 驱动。

同时把冻结评测与当前行为测试分开，减少每次改内核都迁移历史快照/重算hash。此建议不等于删除所有相似场景：三边 conformance 的重复是必要交叉证明；同一仓库重复测试也只有在断言义务完全相同后才删。

### 5.6 Rust/Python 不用照抄 TS 的架构体积

实测文件行数（含注释/内联测试，不可直接比较性能）：TS node目录16文件 3,338行 + batch386 + ctx310；Rust node.rs 6,425行（含大量 unit tests）、ctx436、batch540、lifetime117、report59、request20；Python private kernel 5文件1,648行、checkpoint363、facade3,031。

Rust重点是收拢 core/config/state/borrow访问和同步/DeferredCtx的重复检查，不以拆文件数量冒充精简；Python重点是移除重复facade元数据和重复guard/临时view分配。不能因Rust行数多就要求换用不安全代码、共享锁或删掉泛型/错误边界。

### 5.7 Python性能：优化可测开销，保留安全语义

本次同一进程、100节点链、1000次set、best-of-5：public facade **3.54 µs/node**，直接 kernel **2.25 µs/node**。这是当前机器上的微基准；未重新构建旧Rust facade，不能把原报告的0.88µs当本次公平对照，也不能把3.7倍全部归因于facade包装。

cProfile（2000次set）主要 self time：`_settle` 0.227s、facade derived.run 0.204s、`_gate` 0.190s、`_deliver` 0.169s、`_receive` 0.155s、`_invoke` 0.146s、`Dep.waves` 0.140s、`Ctx.deps` 0.137s；`inspect.isawaitable` 与guard也有可见成本。

明显且不改规则的优化候选：

- `_gate` 不为判断 fresh 就构造每个 dep 的多层 DATA 数组，可读已有 frame/bit信息或缓存一次投影视图。
- 每 invocation 的 Dep view、values list、lambda包装尽量只创建一次；不要复用跨 lifetime ctx造成F2那种错误。
- derived.run→`_guarded(lambda)`→`_guard_fn` 的异常转换统一在一处；仍保留 GraphCallbackError taxonomy、BaseException poison和awaitable拒绝。
- 之后再量chain/fan/batch/real callback分布，不拿微基准收益预先当通过；不能跳过波、合并DATA、丢掉防护去换数字。

## 6. 待定事项逐项建议

### 三边共同

1. **同线程多个 Graph 共享什么：** 推荐 Graph 独立 queue/wave/batch/reporter，只共享无语义可变状态的执行器基础设施。跨图通过显式 bridge delay/cause-group batch。Rust D8已诚实记录每线程共享偏离，TS默认dispatcher也有共享；Python按Graph分开。bridge模型暂缓时保留可复现边界说明，不在本轮暗改，也不声称已满足独立domain。若最终选择线程级domain，必须修改root规则并三边统一，而不是让Python单独一套。

2. **集合 backend 直接写：** 推荐command-driven computed，见§5.3。TS backendState是D178明确包扩展；Rust D9明确说只统一checkpoint布局、运行时仍外部store。不是“字段改名就完成私有状态迁移”。先设计生命周期与同步返回语义，再授权实施。

### TS

3. **D159/D686/D687 digest：** F10；本次独立复现。恢复历史证据完整性，当前版本重新绑定资格，不直接改expected digest。

4. **managed compute admission sink取消：** 原 `publishes admitted lifecycle before a reentrant pre-allocation cancellation` 测试已删除；源码 `managed-untrusted-js-compute.ts:761–774` admission后立即execute，State.set发布遇波会排队。新测试应明确sink取消何时排队、allocation是否已开始、fence/cleanup如何完成，不能复原已不成立的“sink先于分配”假设。`runAsync:608` 同步启动work，`:1003`有assertCurrent。此处是验证缺口，未发现实证的未授权远程执行，未进行provider/live调用。

5. **admission→执行间最终currentness：** 保留现有assertCurrent，加入此窗口中授权/identity/readiness改变的本地mock测试；当前一开始stale或uploading/running中dispose的测试不覆盖它。不要把一次admission结果永久当授权。

6. **message bus只由publish终止：** `messaging/index.ts:128–151`明确只传播dep0 terminal，attached source结束不关bus。建议保留：一个producer退出不应关闭共享bus；公开docs与测试需明确publish端终止才结束，不能只留注释。Rust目前结构不同，统一概念为owner ingress的结束，而非随任意attached source结束。

7. **八个ledger变单lifetime：** D177确实已作本地决定，不报擅自变更。实测eventFlow解除最后订阅后再订阅，`[recordSeq,event.id]`为 `[[1,a],[2,b],[1,b],[2,c]]`，seq重用并重放retained b。建议按ledger用途决定：per-activation UI计算可保留；跨UI detach的去重、幂等、审计cursor应改明确bundle owner状态。不能仅凭“没有旧决定保证”就省略公开行为说明。

8. **D649 ledger改State：** 保留跨lifetime关联去重的需求；但`keyed-rate-limit.ts:553–578`把ledger藏在闭包、无声明依赖、原地改`ledger.cache`，与“nothing subscribes”注释不相符，因为Graph.find可拿到该命名State。建议明确owner并通过受控state transition写入；若用户订阅该State，必须有一致的可观察契约。此处已静态确认，不冒称已跑具体rate-limit反例。

9. **spending delivery-failed：** observer抛错被隔离是R-failure所需，不能恢复异常穿透。现有`causal-focused-host-failures.test.ts:93`已验证该变化；`causal-focused-host.ts:181–187` catch还覆盖frame构造/canonicalization/set拒绝，不能说整个分支永远不可达。缩小并重命名异常分类，给仍可达失败真实用例；删除只为旧observer传播存在的断言。

10. **内部_rewire/_down和test helpers：** 见§4；bridge部分列为明确暂缓，不新建兼容公共入口。restore bootstrap与live host绕路分开。`asState`是有检查的测试收窄，不等同shim。

11. **qualify-spending-publication的onDeactivation：** F13；合法setup cleanup mutant替代，并确认真正执行目标破坏。

12. **runner镜像：** checked-in runner bundle静态确认仍含DIRTY/TEARDOWN/onDeactivation；普通package build会重建它（不能说build不会更新）。image是单独`build-local-untrusted-js-runner-image.mjs`流程。此次未inspect本机/registry镜像，不能断言具体image digest已过期；交付时重建并核对不可变digest，再做本地契约资格。旧镜像只可作为原历史证据保留。

### Rust

13. **默认域失败丢弃：** D6与`report.rs:28`都明确无reporter则drop，bare Node没有Graph可配report。建议公开产品入口以Graph为默认，bare kernel显式接受reporter/domain或提供默认diagnostic；不要恢复线程全局set_host_reporter。此为维护者选择，当前实现符合本地D6。

14. **连续emit并数组：** `ctx.rs:186`有明确sugar说明，D797允许language sugar，所以不是raw down违约。若目标是最大API一致，推荐每次emit一个数组，emit_all/varargs才多值；无Rust语言限制要求合并。修改前检查of/from_iter/activation snapshot，不能让初始多值只剩最后一值。

15. **process/CQRS不能checkpoint：** runtime state已有JSON转换（process.rs:1913、cqrs.rs:814），但输出/请求仍有领域struct，checkpoint any_to_json无法泛型自动Serde所有AnyValue。规则要求拒绝非JSON，拒绝本身应保留。要让这些bundle可恢复，应提供显式JSON representation/recipe与codec边界，不unsafe猜类型、不偷偷丢字段；在此之前公开标local-only/非可恢复。没有必要为这点阻塞所有普通kernel图checkpoint。

16. **删除Python binding：** 按D800，先合并纯Python cut-over，再删Rust binding与release-plz override；但AGENTS/architecture当前所有权文字现在就可准确表述“已退出workspace、待删除”，不用等。不要把binding不能编译当Rust新内核失败，本次cargo gate按实际workspace运行。

### Python

17. **uv build：** 本次已补齐：sdist和universal wheel都构建成功，新venv安装成功，`python -I`证明import来自site-packages，无_native，State/find/derived/subscription/set真实运行。仅测本机Python3.14.2；未验证整个3.12/3.13矩阵。

18. **约3.7倍变慢：** 见§5.7，当前facade3.54、kernel2.25µs/node；瓶颈包含纯Python传播与view/guard分配。推荐先优化可见重复工作，不为旧Rust数字推翻D800，也不承诺未经实现的加速幅度。

19. **丢Subscription不自动unsubscribe：** D4明确，建议保留显式unsubscribe/context manager/Graph.close，符合资源所有权可解释性；文档给短例子与Graph.close回归，不保留__del__兼容行为。

20. **describe形状变化：** D4明确拓扑数据，推荐保留id/name、kind、current deps、quiet的共同最小概念；有值时附value是包扩展。不要维持旧native DTO别名；definition与describe的declared/current deps差异必须清楚。

21. **Graph(report=...) / find：** 保留，find已返回真正State，wheel smoke已验证；report默认logging与TS/Rust默认drop应显式统一选择。不要增加Graph级host set来方便restore后写值。

22. **Graph.observe：** 保留图层诊断，不属于kernel inspection state；事件序号只用于本地观察，不冒充R-revision。不激活节点，异常隔离；对真实消费者有价值，不因内核变薄就删除。

23. **wire facade撤下：** D5明确，并且C-1a/C-1c已重置todo。建议保持撤下到bridge新模型获准，不复活native桥壳。公开release notes明确本版不支持wire；以后按新模型新增，不做旧wire别名。

### 本地决定逐条处置

| 仓库/决定 | 判断 |
|---|---|
| TS D172 | 保留quiet/request-state/删除retired surfaces方向；quiet实现按F1/F3/F7修，phase暂态句以后转历史 |
| TS D175 | 保留State-only host与单set、array sink；其分阶段实施时间表作为历史，不是永久产品条款 |
| TS D176 | 保留activate-before-snapshot和激活多值分组，已有测试；不能用它证明quiet多个down可拆波 |
| TS D177 | 不删决定；八ledger后果应明确，按§6.7逐项判断持久范围；D649外部State实现需清理 |
| TS D178 | 保留recipe/新格式/旧格式拒绝；backendState扩展建议最终取消；note/runtime versioning不等于checkpoint版本证据 |
| TS D173 → D174 | 执行历史保留，后者替代逐阶段等待；不转成durable规则，也不当本次merge授权；checks失败按F10记录 |
| Rust D1 | 保留退役映射；(7) checkpoint临时限制已由D5替代，(8) host rewire callsite处理由D8接替 |
| Rust D3 | 保留StateWrite语言映射；fn wrapper有真实Rust类型理由 |
| Rust D5 | 保留checkpoint接纳和阶段顺序作为历史；F8补齐其实际承诺 |
| Rust D6 | report归graph正确；bare domain drop建议重议，panic payload压成string是语言表示需文档说明 |
| Rust D7 | setup/CleanupCtx保留；rewire_next_*措辞按D8标历史，不能再教旧API |
| Rust D8 | FIFO/ctx.rewire方向保留；NodeDefinition bool缺fn按F12改；跨graph线程域只是记录偏离，留待root决定 |
| Rust D9 | JSON/privateState布局方向保留；collection运行时外部store仍是待清理，不把布局改完当语义完成；补F8 |
| Rust D2 → D4 | execution历史保留，后者替代阶段门；不能授权本审核改代码或merge |
| Python D1 → D3 | 同为execution历史；最初逐阶段批准条款已替代，不重复要求用户确认审核步骤 |
| Python D2 | 保留纯Python private kernel、Exception/BaseException分界；核心测试与public facade测试不能互相替代 |
| Python D4 | 保留无shim facade、显式Subscription ownership；F11说明definition当前未兑现，不能删合约迁就bug |
| Python D5 | 保留临时wire撤下；完成条件仍是以后恢复，不应现在标complete |
| Python D6 | 保留hatchling/universal wheel；修“uv sync editable install”与pyproject package=false事实矛盾，补本次构建证据 |
| Python D7 | 保留find own-handle，已测；无须第二套narrow方法 |

## 7. 要用户决定的问题

这些是本报告提出的具体选择，不是等待回答才能完成本轮审核，也没有写入新决定。

1. **terminal-only auto COMPLETE是否必须跑raw fn？** 推荐遵守当前文字，最后terminal触发一次；若选择不跑，应先root spec-amend明确，并更新场景。F9不能只靠“三边都这样”关闭。
2. **同线程多个Graph的domain边界？** 推荐独立queue/wave/batch，通过bridge显式连接；继续在已有bridge讨论中决定，不新开第二份规则。
3. **八个ledger的长期语义？** 推荐涉及幂等/游标/审计的由bundle明确持有；纯activation缓存可重置。以eventFlow seq重用与retained replay的实际例子逐项选，不恢复persist选项。
4. **API一致性的目标严格到哪层？** 推荐raw kernel概念统一：terminal(i)/invalidated(i)、完整definition、opaque seed note；StateWrite包装与snake_case等语言差异保留，emit合并不作为必需差异。
5. **历史资格怎样交付？** 推荐旧frozen source+receipt保持完整历史，新迁移资格另绑定source；禁止直接换expected hash。runner/image也使用同一source/digest原则。
6. **集合要不要现在重做？** 推荐先修内核P1，再单独授权一种command-driven集合试点；本次不夹带整套集合重写。若暂留扩展，明确其范围与不可恢复对象，不把它升格为根规则。

## 8. 附录：执行证据、复现与限制

### 8.1 执行命令与结果

所有长测试通过已有 `rs/scripts/run-logged.sh` 运行，使用 `/tmp/d797-codex-*.log` 作为临时测试输出，按其 DONE sentinel 和exit判断完成。构建产物在`/tmp`或既有gitignored target/cache；没有写入测试源码。只有Python构建允许工具下载，未发送仓库内容到外部服务、未调用provider/live评测。

| 工作目录/命令 | 本次结果 |
|---|---|
| 四仓库 `git status --porcelain=v1 --untracked-files=all`、`rev-parse`、`diff --stat/--name-status`、`rev-list --count origin/main..origin/d797-kernel-migration` | 快照如§1；结束复核另见§8.4 |
| root `npm run authority:check` | exit0；15 current rules |
| root `npm run authority:check:workspace` | exit1；三个D797 work orphan，非规则解析失败 |
| root `npm run work:check:workspace` | exit1；相同三个orphan |
| root `npm run test:authority` | 40/40通过 |
| root `node dashboard/build.mjs --check` | exit0；警告与未验证状态仍存在，不等于完成B140 |
| ts `pnpm test` | 167 files：163通过、3失败、1跳过；2670 tests：2662通过、4失败、4跳过，114.91s |
| ts focused `vitest ...root-eval-topology.test.ts -t 'runs five ordered replicates'` | 1通过、88被名字过滤；该case990ms；不把过滤当永久skip |
| ts `pnpm --filter @graphrefly/ts test:typecheck` | exit0；仅tsconfig.tests指定范围，不是所有测试类型检查 |
| ts `pnpm run lint` | exit0；33 warnings、34 infos，无自动修复；raw-async与example typechecks通过 |
| ts package `node --max-old-space-size=6144 ../../node_modules/tsup/dist/cli-default.js --out-dir /tmp/d797-codex-ts-dist` | ESM/CJS/DTS成功；未运行会覆盖tracked runner的普通build前置脚本 |
| ts `/tmp`构建输出的ESM与CJS import smoke | 两格式derived值3，State.set存在、State.down undefined |
| ts `pnpm run docs:gen:check` | exit0，643 API pages |
| rs `cargo test --offline --locked -p graphrefly-rs` | 505 passed，0 failed，0 ignored；21个result段含0 doc tests |
| rs `cargo test --offline --locked -p graphrefly-rs --all-features` | 521 passed，0 failed，0 ignored；102s含等待/构建 |
| rs `cargo clippy --offline --locked -p graphrefly-rs --all-targets` | exit0 |
| rs `cargo fmt --all --check` | exit0 |
| rs `RUSTDOCFLAGS='-D warnings' cargo doc --offline --locked -p graphrefly-rs --all-features --no-deps` | exit0 |
| rs `CARGO_NET_OFFLINE=true python3 scripts/generate-rustdoc-comments.py --check-stale` | exit0；missing-doc gate 与 active-source stale-phrase scan 均 clean |
| py `.venv/bin/python -m pytest -q -p no:cacheprovider` | 231 passed、2 skipped（trio/anyio真实运行时可选依赖未安装） |
| py `.venv/bin/ruff check .` | exit0 |
| py `.venv/bin/mypy src` | exit0，11 source files |
| py `.venv/bin/python scripts/check_api_docs.py` | exit0，55 exports |
| py website `pnpm docs:gen:check` | exit0，55 API pages |
| py `uv build --out-dir /tmp/d797-codex-py-dist` | sdist + graphrefly-0.23.0-py3-none-any.whl 成功 |
| py `uv venv /tmp/d797-codex-wheel-venv --python .venv/bin/python` + `uv pip install --python ... --no-deps ...whl` | 成功；isolated `python -I` import来自site-packages，native=None；State/find/subscription/derived/set smoke通过 |
| py `PYTHONPATH=src .venv/bin/python scripts/diff_reference.py --count 3000` | 3000 scenarios，32042 trace entries，0 mismatch；仅相对参考，不能抵消F9共同缺陷 |
| inline Python timeit/cProfile | §5.7结果；没有生成profile文件，没有重测旧native版本 |
| inline TS/Python + rustc stdin probes | P1–P4；细节如下，未写测试文件 |

未执行会改tracked bundle的`pnpm run build`完整链、镜像构建/推送、完整package export qualification脚本、release/publish、外部服务或付费评测。tsup+import smoke不等于完整发布资格。未跑大型TLC或全部formal mutation；本次主要审核runtime迁移，formal通过本身也不能证明runtime符合。没有为凑覆盖重复所有绿灯。


### 8.2 最小行为探针

以下按问题归组，整理为可重复执行的片段；不要求写入仓库测试文件。输出是本轮实际执行的要点，不把代码阅读标成实测。Rust rlib 的文件名属于本次构建产物；其他构建环境应选同一审核 head 的对应 rlib。

**P1 — TS lifetime 与输出顺序。** 工作目录为 ts；使用现有 `tsx`，不联网：

```sh
node --import tsx --input-type=module <<'JS'
import {graph} from './packages/ts/src/graph/graph.ts';
const g=graph();
const contexts=[];
const n=g.node([],c=>{contexts.push(c);c.state.set('fresh')});
const off=n.subscribe(()=>{}); off(); n.subscribe(()=>{});
contexts[0].state.set('stale');
console.log('stale state',contexts[0].signal.aborted,contexts[1].state.get());
let kept;
const s=g.node([],c=>{kept=c}); s.subscribe(()=>{});
const t=g.state(0); const log=[];
t.subscribe(ms=>{if(ms.some(m=>m[0]==='DATA'&&m[1]===1)){
  log.push('t:first');kept.down([['DATA',7]])
}});
t.subscribe(ms=>{if(ms.some(m=>m[0]==='DATA'&&m[1]===1))log.push('t:second')});
s.subscribe(ms=>{if(ms.some(m=>m[0]==='DATA'))log.push('source')});
t.set(1); console.log('late output ordering',log);
let q; const a=g.state(0);
a.subscribe(ms=>{if(ms.some(m=>m[0]==='DATA'&&m[1]===1))
  g.replace(q,[],c=>c.down([['DATA',999]]))
});
q=g.node([a],c=>c.down([['DATA',100]]),{quiet:true});
const out=[];q.subscribe(ms=>out.push(ms));out.length=0;a.set(1);
console.log('quiet stale',out);
JS
```

观察：`stale state true stale`；顺序 `t:first, source, t:second`；quiet 输出为新 START 后出现 DATA100，再出现 DATA999。分别对应 F2、F1、F3。

**P2 — TS request 失败、quiet 多数组、最后 terminal。** 同一工作目录与运行方式：

```sh
node --import tsx --input-type=module <<'JS'
import {graph} from './packages/ts/src/graph/graph.ts';
const reports=[];const g=graph({report:r=>reports.push(r)});let ca,cb;
const a=g.node([],c=>{ca=c;c.down([['DATA',1]])});
const b=g.node([],c=>{cb=c;c.down([['DATA',2]])});
a.subscribe(()=>{});b.subscribe(()=>{});
g.batch(()=>{ca.rewire([b]);cb.rewire([a])});
console.log('rewire route',a.status.output,b.status.output,reports.length);
const h=graph();const s=h.state(0);
const q=h.node([s],c=>{c.down([['DATA',1]]);c.down([['DATA',2]])},{quiet:true});
let runs=0;h.node([q],()=>{runs++}).subscribe(()=>{});runs=0;s.set(1);
console.log('quiet runs',runs);
const i=graph();const src=i.state(1);let count=0;
i.node([src],()=>{count++}).subscribe(()=>{});src.complete();
console.log('complete runs',count);
JS
```

观察：`rewire route errored errored 0`；`quiet runs 2`；`complete runs 1`。F4/F7/F9；最后一项是规则冲突，不因为三边共同出现就自动决定如何改。

**P3 — Python topology、快照别名、definition 回滚、ended batch。** 工作目录 py；private kernel 的探针与公开 facade 的探针明确分开：

```sh
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=src .venv/bin/python - <<'PYPROBE'
from graphrefly._kernel import Graph, DATA
from graphrefly._checkpoint import capture, recipe
reports=[];g=Graph(report=reports.append)
g.node('a',[],lambda c:None);g.node('b',[],lambda c:None)
g.batch(lambda:(g.replace('a',['b'],lambda c:None),
                g.replace('b',['a'],lambda c:None)))
print('replace cycle',g.describe(),reports)
g=Graph();g.state('s',0)
def f(c):
    if c.state is None:c.state={'count':0}
    c.state['count']+=1;c.down([(DATA,c.state['count'])])
g.node('n',['s'],f,recipe=recipe('counter'));g.subscribe('sink','n',lambda a:None)
cp=capture(g);print('snapshot before',cp)
g.set('s',1);print('snapshot after',cp)
from graphrefly import Graph as FGraph
g=FGraph();old=lambda c:None;new=lambda c:None;n=g.node([],old)
def body():
    g.replace(n,[],new)
    raise ValueError('rollback')
try:g.batch(body)
except ValueError:pass
print('rollback callback is new',g.definition(n).callback is new)
reports=[];runs=[];g=Graph(report=reports.append);g.state('t',0);g.state('s',1)
def first(ms):
    if (DATA,1) in ms:g.complete('s')
def second(ms):
    if (DATA,1) in ms:g.batch(lambda:g.set('s',lambda x:(runs.append(x),x+1)[1]))
g.subscribe('first','t',first);g.subscribe('second','t',second);g.set('t',1)
print('ended batch updater calls',runs,'reports',reports,'s',g.get('s'))
g=Graph();held={}
g.node('a',[],lambda c:held.update(a=c));g.node('b',[],lambda c:held.update(b=c))
g.subscribe('aout','a');g.subscribe('bout','b')
g.batch(lambda:(held['a'].rewire(['b']),held['b'].rewire(['a'])))
print('rewire cycle',g.describe())
PYPROBE
```

观察：两种 topology 请求都出现 a↔b；checkpoint 的旧 values 保持 [1] 而旧 state.count 变 2；回滚后 callback is new 为 True；已结束目标的 updater 调用为 [1]、report=[]。分别为 F5/F6/F11/F14。公共 facade 的 `_callbacks` 漂移不是 private kernel 拓扑回滚失败。

**P4 — Rust cycle 与 checkpoint。** 工作目录 rs；使用前述 cargo build/test 的现成 rlib；源码通过 stdin，二进制只在 `/tmp`。

```sh
/Users/davidchenallio/.cargo/bin/rustc --edition=2021 --crate-name d797_codex_cycle \
  -L dependency=target/debug/deps \
  --extern graphrefly=target/debug/deps/libgraphrefly-9dc4e4cb1a53dcf1.rlib \
  -o /tmp/d797-codex-cycle - <<'RS'
use graphrefly::{Node,ReplaceOpts};
use std::{rc::Rc,cell::Cell};
fn main(){
 let g=graphrefly::graph();
 let a=g.node::<i32,_>(vec![], |_|{});let b=g.node::<i32,_>(vec![], |_|{});
 g.batch(|_|{
  a.replace(vec![b.erased()], |_|{},ReplaceOpts::default());
  b.replace(vec![a.erased()], |_|{},ReplaceOpts::default());
 });
 println!("{:?}",g.describe());
 let s=Node::<i32>::state(1);let count=Rc::new(Cell::new(0));
 let n={let count=count.clone();Node::<i32>::derived(vec![s.erased()],
  move |_|count.set(count.get()+1))};
 let unsub=n.subscribe(|_|{});s.complete();
 println!("calls {}, output {:?}",count.get(),n.status().output);unsub();
}
RS
/tmp/d797-codex-cycle
```

观察：describe 中两节点相互为依赖；`calls 1`，output completed。cycle 探针由独立只读子审查执行（其临时二进制名为 `/tmp/d797-edge-probe`）；下方 checkpoint 由主审核另外执行并确认 active/inactive 对照：

```sh
/Users/davidchenallio/.cargo/bin/rustc --edition=2021 --crate-name d797_codex_capture \
  -L dependency=target/debug/deps \
  --extern graphrefly=target/debug/deps/libgraphrefly-9dc4e4cb1a53dcf1.rlib \
  -o /tmp/d797-codex-capture - <<'RS'
use graphrefly::*;
use std::{rc::Rc,cell::Cell};
struct Forward(Rc<Cell<usize>>);
impl GraphRestoreDescriptor for Forward {
 fn ref_(&self)->&str {"probe"}
 fn define(&self,ctx:RestoreDefineCtx<'_>)->GraphRestoreResult<RestoreNodeDefinition>{
  let count=self.0.clone();
  Ok(RestoreNodeDefinition{
   factory:"probe".into(),
   kind:RestoreNodeKind::NodeJson(Rc::new(move |c|{
    count.set(count.get()+1);
    if let Some(v)=c.data::<GraphCheckpointJson>(0){c.emit((*v).clone())}
   })),opts:restored_opts(ctx.checkpoint)?
  })
 }
}
fn main(){
 let g=graph();
 let a=g.state_opts(GraphCheckpointJson::from(1),GraphNodeOpts::named("a"));
 let mut opts=GraphNodeOpts::named("p");
 opts.restore=Some(RestoreFactoryMeta::registry_ref("probe"));
 let p=g.node_opts::<GraphCheckpointJson,_>(vec![a.erased()],|c|{
  if let Some(v)=c.data::<GraphCheckpointJson>(0){c.emit((*v).clone())}
 },opts);
 let unsub=p.subscribe(|_|{});let mut cp=g.checkpoint().unwrap();
 for n in &mut cp.nodes {if n.id=="p"{
  println!("active values {:?} received {:?}",n.values,n.received);n.received=None;
 }}
 let count=Rc::new(Cell::new(0));
 let registry=restore_registry([
  GraphRestoreEntry::descriptor(StateRestoreDescriptor),
  GraphRestoreEntry::descriptor(Forward(count.clone()))
 ]);
 let restored=restore_graph(cp,RestoreGraphOptions::new(registry)).unwrap();
 let pn=restored.find("p").unwrap().as_node::<GraphCheckpointJson>();
 let _sub=pn.subscribe(|_|{});
 println!("restored function calls {}",count.get());
 unsub();for n in &g.checkpoint().unwrap().nodes{if n.id=="p"{
  println!("inactive values {:?} received {:?}",n.values,n.received)
 }}
}
RS
/tmp/d797-codex-capture
```

观察：active values 含 1，received=Some；删 received 仍恢复成功，函数调用数 1；合法 inactive 则 values=[]、received=None。补充的 inactive 对照避免把所有 None 一刀切判错。

### 8.3 维护者交接预览与未验证范围

这是一份只读审核的 handoff，没有已经修好的实现，也没有 merge 或发布批准。建议按三个 concern 阅读：

1. **一个请求能否越过 lifetime/波边界？** 从 [TS later output](/Users/davidchenallio/src/graphrefly-ts/packages/ts/src/node/node-context-runtime.ts:59) 看 P1/P2，然后对照 R-request-order/R-lifetime。应观察第二个 t sink 先于 source、replace 后不出现旧 DATA、关闭 ctx 不影响新 state；当前都尚未满足。
2. **检查通过之后，真正提交时还合法吗？** 从 [Python replace](/Users/davidchenallio/src/graphrefly-py/src/graphrefly/_kernel/graph.py:607) 与 [Rust replace](/Users/davidchenallio/src/graphrefly-rs/crates/graphrefly/src/node.rs:4573) 看 P3/P4。应观察第二个成环请求被拒绝/report，而非产生环或 ERROR 传播；还要核对 facade definition 同一提交。
3. **checkpoint 真能固定一个边界吗？** 从 [Python JSON capture](/Users/davidchenallio/src/graphrefly-py/src/graphrefly/_checkpoint.py:70) 与 [Rust received admission](/Users/davidchenallio/src/graphrefly-rs/crates/graphrefly/src/checkpoint.rs:1387) 看 P3/P4。应观察 capture 不再跟着 live dict 变、残缺 active 快照拒绝，合法 inactive 快照仍可恢复。

剩余限制：没有遍历全部可调度交错、所有用户 recipe/集合、所有平台/工具链；Python 只验证本机 3.14.2，没有验证 3.12/3.13；可选 trio/anyio 真运行时两项未跑。没有构建或运行 local-untrusted-js 的完整镜像链；没有重跑付费/外部 qualification，也没有执行 spending mutant。性能只测当前实现和局部 profile，0.88 µs 旧 native 数据来自待审核材料，不能据此宣称本机端到端回归倍率。参考随机对照并非独立 oracle；F9 正说明共同实现可能共同偏离文字。

### 8.4 最终工作区复核

最终四个 HEAD 均仍为 §1 的 SHA；三个 runtime 的 `git status --porcelain=v1 --untracked-files=all` 均为空，与开始相同。没有 commit、push、checkout、reset 或源码编辑；本审核唯一新增仓库文件为本报告。

root 无法声称 status 与开始完全相同：其他并发工作在本轮期间新增/暂存了 bridge 及相邻协议变更。本审核只记录状态，不读入桥接新设计来改变本报告范围，也不替别人撤销修改。最后复核时 HEAD 尚未变，状态如下（除最后一行报告外，均非本审核写入）：

```text
M  decisions/decisions.jsonl
M  formal/README.md
A  formal/module_bridge.cfg
A  formal/module_bridge.tla
A  formal/module_bridge_3.cfg
A  formal/module_bridge_diamond.cfg
M  package.json
M  reference/kernel/kernel.test.mjs
M  reference/modules/README.md
A  reference/modules/bridge.mjs
A  reference/modules/bridge.test.mjs
M  reference/modules/checkpoint.test.mjs
M  sessions/active/HANDOFF-B140-runtime-owners.md
A  sessions/active/PROPOSAL-B140-bridge-module.md
M  spec/conformance.jsonl
M  spec/fixtures/protobuf/README.md
M  spec/fixtures/protobuf/wire_bridge_envelope.v1.jsonl
A  spec/fixtures/protobuf/wire_edge_cause.v1.jsonl
D  spec/fixtures/protobuf/wire_edge_frame.v1.jsonl
M  spec/protocol.proto
M  spec/rules.jsonl
?? sessions/active/REVIEW-D797-migration-codex.md
```

root gates 的通过/失败结果属于它们实际执行时的审核快照，不是对此后 staged bridge 修订的再验收。后续若要以新的 root revision 修三边，应先重新固定该修订的 authority，再逐项关闭本报告问题；不需要把本轮已验证的反例伪装成未发生。
