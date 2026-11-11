# Checkpoint 模块接纳提案

2026-11-10，graphrefly:B140。状态：**用户 2026-11-10 逐题定完（Q1–Q8）**，Q6 没有按建议，选了现在就去掉版本号。第 4 节已按这些决定做完（graphrefly:D802）。这是非规范性文档：它不改规则、场景或模型，也不授权任何
runtime 仓库的实现工作。用户定下各题之后，根仓库再写决定，改 `spec/rules.jsonl`、`spec/conformance.jsonl` 和
`formal/`。各 runtime 的实现由它们在自己的 `plan/work.jsonl` 里接纳。跨图 bridge（各 runtime 的阶段 6）已按用户的决定暂缓，
另开会话讨论，不在本文范围内。

本文的起因：用户在 graphrefly-py 的会话里问 R-checkpoint 为什么还没接纳、还差什么，那个会话列出了缺口，用户回复
"交给根仓库起草"。

输入：[R-checkpoint@1](../../spec/rules.jsonl) 和它要替代的草案（R-restore@1/@2、R-snapshot@1/@2、R-input-receipts@1、
R-resource-reattach@1）；[D797](../../decisions/decisions.jsonl)、D798、D799、D800、D784；
[B140](../../plan/backlog.jsonl) 的 Checkpoint/encoding 一条；[C-24、C-38、C-39](../../spec/conformance.jsonl)；
[formal/module_checkpoint.tla](../../formal/module_checkpoint.tla)；
[reference/modules/checkpoint.mjs](../../reference/modules/checkpoint.mjs) 和它的测试；
[HANDOFF-B140-runtime-owners.md](HANDOFF-B140-runtime-owners.md)；
[PROPOSAL-B140-kernel-rule-revision.md](PROPOSAL-B140-kernel-rule-revision.md) 第 3、9.9 节。

## 1. 现状

**规则。** 现在没有一条生效的 checkpoint 规则。R-checkpoint@1 只有 `introduced_by: D797`，没有 `activated_by`。它要替代的
六个修订也都是草案，一个都没有激活过：

| 修订 | 来自 | 内容 |
|---|---|---|
| R-snapshot@1 | D25、D51、D82、D83、D160 | 快照存拓扑、factory 引用、缓存、终止状态和全部 ctx.state；存储层和编码不归协议 |
| R-restore@1 | DR-5、D57、D82、D83、D117、D160 | 恢复保留状态，不重算、不触发新 lifecycle 的清理钩子，late subscriber 直接拿恢复的缓存 |
| R-snapshot@2 | D796 | 每类逻辑事实存一次，包括 receipts、replay、revision、namespace 水位 |
| R-restore@2 | D796 | 在安全边界装入，经由受信的 factory/recipe 重建物理身份和资源 |
| R-input-receipts@1 | D796 | 每条连接各自的接收记录，含 quiet-PULL 输入 |
| R-resource-reattach@1 | D796 | 经由"factory/registered reattach seam"重建资源 |

**场景。** 有三个场景提到这些规则：

- C-24 覆盖 R-snapshot 和 R-restore，三个 runtime 都标了 `pass`。这些标记写在 D784 之前，验证的是 D83/D117 下的旧行为。
  其中两条和 R-checkpoint 冲突："不因恢复触发新的清理钩子"，对应新规则的"每次激活都跑 setup"；"恢复的拓扑激活不重算"，
  对应新规则的"输入变了就跑一次"。
- C-38（D797 版）覆盖 R-checkpoint 和 R-history，三个 runtime 都是 `todo`。
- C-39 覆盖 R-checkpoint 和 R-revision，R-revision 已被用户暂缓。

**证据**（都是候选证据，不是 runtime 证据）：

- `formal/module_checkpoint.tla`：2026-11-10 跑绿，9 步 608,960 个状态；`module_checkpoint.cfg` 上 6 个变异，每个都会让某条不变式失败。
- `reference/modules/checkpoint.test.mjs`：39 个测试，本文写作时重跑全部通过；另有 5 个变异，每个都会让至少一个测试失败。
- D799 的理由明确写着：两个消费者（B139 flagship、photo-scenes 的 operation tree）都没用到这些接口，证据只来自模块测试。

## 2. 要决定的问题

每题先给建议和理由，再列其他做法。

### Q1. B140 的 Checkpoint/encoding 一条：第一版排除，还是等？

**用户决定（2026-11-10）：** 两个都按建议。第一版排除 revision 和哈希，留给 R-revision；另外三项在 R-checkpoint 的文字里写明答案；B140 的这一条就地改写。checkpoint 的格式和版本标记归各包；规则层面，恢复 v1 checkpoint 要明确报错，转换工具由各包自己决定。

B140 这一条要求在 checkpoint 规则里写出五项。逐项看，在 D797 的形状下，三项已经有答案或者不再存在，只有一项真的
依赖暂缓的 R-revision：

| 项 | 现在的答案 |
|---|---|
| revision 和当前快照哈希的编码 | 依赖 R-revision（暂缓）。R-revision 自己写了：位置存为 JSON、**放在 checkpoint 旁边**，由新的观察器读入，不写进 checkpoint。 |
| previous-CID 迁移 | 不再存在。R-revision 的哈希在读取时由当前保留的值算出，没有存下来的 CID，也就没有需要迁移的前一个 CID。D109 的 V1 `cid/prev` 是 TS 包内的历史（由 D783 迁到 graphrefly-ts，根仓库由 D796 取代），见 Q6。 |
| 紧凑的 receipts | R-checkpoint 已经写了：每个依赖存它最后一个数组的值和终止状态，作为 seed 的 note。quiet-PULL 输入随 PULL 退役。 |
| replay 的容量和序列 | 由 R-history 回答：history 的列表是它的私有状态，n 在它的 recipe 配置里，没有单独的序列号。 |
| namespace 连续性 | 不适用于内核：id 由宿主给出，内核从不分配也不删除 id；模块内部的 id（如 switchMap/mergeMap 的 `id/inner/k`）由它们的私有状态决定，会一起恢复。恢复后的新图用同样的 id。观察序列属于 R-revision。 |

**建议：第一版明确排除 revision 和哈希，把它们留给 R-revision 激活时一起处理；另外三项在新的 R-checkpoint 文字里写明已有的答案。**
B140 的这一条经用户同意后就地改写，说明哪些已经回答、哪些随 R-revision 处理。
理由：排除的部分不改变 capture 和 restore 的行为。R-revision 本来就规定位置放在 checkpoint 外面，所以以后加上它，不需要改
checkpoint 的格式。等下去则会让 checkpoint 无限期地被一个没有消费者的模块卡住。

还有一个附带问题，B140 没有列出：checkpoint 文档本身的格式（字段布局、版本标记）要不要跨 runtime 一致。现在 TS 和 Rust
用的是同一个形状，版本标记都是 `"graphrefly.checkpoint.v1"`；Python 直接返回 Rust 的结果（见第 3 节）。但没有哪条规则或场景
要求一个 runtime 存的 checkpoint 能被另一个恢复，这个形状是按 intent-parity 对齐出来的。新规则改了内容：要加每个依赖的接收记录和
lifetime 依赖；`lifecycle.hasCalledFnOnce` 由 seed 取代，`status` 改为推导。所以无论怎么选，都要换一个新的版本标记。

**建议：第一版不要求跨 runtime 一致，格式和版本标记归各包，已存的 v1 checkpoint 怎么处理也归各包。** 规则只要求值、私有状态
和 recipe 配置是 JSON。R-snapshot@1 已经把编码和存储放在协议之外，跨 runtime 的协作现在只走 wire bridge（D800）。
对 v1，规则层面的最低要求是诚实地拒绝：v1 里没有接收记录，用依赖存下的值去补，在依赖被 replace 过的情况下会补错。
一个包要提供单向的转换工具，那是它自己的事。
另一种做法是在 `spec/` 里定一份 checkpoint 的 JSON schema，让三个 runtime 互相恢复。这是一个新的跨 runtime 接口，应该等到有了
它自己的消费者再做。

### Q2. R-resource-reattach：退役、改写，还是留作草案？

**用户决定（2026-11-10）：** 按建议，用 `replace` 迁到 R-checkpoint@1，并删掉 R-checkpoint 理由里"resource reattach is not yet specified"那半句。

它的内容在 D797 下已经分别有了去处：

- 恢复后重建资源：R-checkpoint 写了 setup 在每次激活时都跑，恢复后的第一次激活也一样，所以节点在图外打开的东西会再打开一次（R-lifetime@2）。
- "不做多余的函数运行，不重放捕获的 DATA"：R-checkpoint 写了函数只在输入变了时跑一次，不变就不跑；恢复不发送任何东西。
- "第一次挂接前，输入变了就用最新的快照"：同上，变了就跑一次。
- "挂起的 reattach 属于它的计算注册，换函数会取消它"：D799 之后 setup 属于实例，replace 换实例时一起换。
- "外部 I/O 不因恢复一个 buffer 而继续"：R-checkpoint 写了 capture 时正在进行的工作会丢掉。

**建议：用 `replace` 迁到 R-checkpoint@1，并删掉 R-checkpoint 理由里"resource reattach is not yet specified"这半句。**
理由：按 D798 的惯例，概念并进另一条规则时用 replace，概念消失时才用 retire。这里资源重建这个概念还在，只是由 setup 承担。
B140 提案第 3 节的表里写着"R-resource-reattach stays a draft, not yet specified"，那是 2026-11-09 的状态，早于 setup 取代
每次运行注册的清理（2026-11-10）。
其他做法：retire（理由写"由 setup 取代"），效果一样，只是迁移图上少一条边；或者继续留作草案，那它会一直是一条没有去处的规则，
违反 B140 的"每条规则都有唯一的去处"。

### Q3. 迁移关系怎么写

**用户决定（2026-11-10）：** 按建议。六个修订都用 `replace` 迁到 R-checkpoint@1；C-24 退役，由 C-38 接替；D160 的集合条款随替换一起去掉。

**建议：和 D798 一样，都用 `replace`，`by` 是激活 checkpoint 的那个决定，`to` 是 R-checkpoint@1：**

- R-snapshot@1、R-snapshot@2
- R-restore@1、R-restore@2
- R-input-receipts@1
- R-resource-reattach@1（按 Q2）

D798 也给从未激活过的 D796 @2 草案装了 transition（例如 R-msg-format@2、R-pull 的去处），所以这样做和先例一致。
R-replay-buffer@1/@2 不在这里，它们等 R-history 激活时迁走。R-node-revision@1 等 R-revision。

激活的同时，C-24 退役，由 C-38 接替，像 C-8 由 C-35 接替那样。C-24 里三个 runtime 的 `pass` 是旧行为的证据，不能带到新场景上。

替换会带走 R-snapshot@1 和 R-restore@1 里关于集合的一条（D160）：集合的 `backendState` 是权威，快照和辅助缓存是派生的。
R-checkpoint 里没有对应的话。在 D797 下，集合就是普通节点，后端就是它的私有状态，按 recipe 恢复，所以不需要专门的条款。
TS 和 Rust 现在把集合内容放在单独的 `backendState` 字段里，按新规则它会变成私有状态，或者成为包自己的扩展。
**请确认这一条可以随替换一起去掉。**

### Q4. C-38 只接纳 checkpoint 过不了：怎么办

**用户决定（2026-11-10）：** 按建议拆开。C-38 只留内核图上的条款；新增 history 往返场景和模块图往返场景，各等对应模块激活；switchMap 和 mergeMap 的往返交给各包自己测。

C-38 的 `covers` 有 R-history，输入里还有 pausable、demand holder、restart owner、switchMap、mergeMap，这些不是草案模块就是
sugar（D797 把 switchMap、mergeMap 归为 sugar）。

**建议：拆。**

- **C-38 只留内核图上的条款**：状态 a、recipe 节点 p、没有 recipe 的节点、带依赖的已结束节点、带 setup 的定时器源；恢复不跑函数，
  第一次订阅拿到保存的值；第一次订阅前 a 变了，p 跑一次；wave 内和 batch body 内 capture 被拒绝，非 JSON 值被拒绝，缺 recipe 和
  local-only 节点恢复失败；replace 和 `ctx.rewire` 之后的恢复；按依赖顺序重建；第一次订阅前的 INVALIDATE 看不到。`covers` 改成
  R-checkpoint、R-subscription、R-terminals、R-lifetime、R-request-order。
- **history 的往返**移到一个新场景，`covers` 是 R-checkpoint 和 R-history，等 R-history 激活。
- **模块图的往返**（pausable、demand holder、restart owner）移到另一个新场景，等各自的模块激活。三个模块可以合在一个场景里，
  条款按模块分开写，哪个模块先激活，哪条先生效。
- **switchMap 和 mergeMap 的往返**不再放进根场景：它们是 sugar，各包自己测。它们在内核层面检查的是 lifetime 内 rewire 之后的依赖能否恢复，
  这一条留在 C-38 里，用普通节点的 `ctx.rewire` 测。

理由：用户定过"模块规则各自单独激活"。拆开之后 checkpoint 不用等任何别的模块，而每个模块激活时，它和 checkpoint 一起用的情况仍然有场景要求。
其他做法：checkpoint 和 history 一起接纳（history 的模型 `module_history.tla` 已经跑过，规则短），C-38 只拿掉模块图的部分。
这样少一个场景，但两个模块绑在一起，history 也要同时进入各 runtime 的切片。

### Q5. 模型要不要补

**用户决定（2026-11-10）：** 按建议补模型：加 replace 步骤和"依赖后建"的初始选择，加新的不变式和变异。

D799 之后的规则文字里有两条，`module_checkpoint.tla` 没有覆盖，参考实现的测试覆盖了：

- 恢复时每个节点建在它声明的依赖之后（一个节点被 replace 到一个后来才建的依赖上，D799 之前恢复会出错）；
- recipe 和 setup 跟着实例走（replace 之后恢复出来的是替换后的实例的 recipe 和 setup）。

**建议：补。** 在模型的 orig 阶段加一个 replace 步骤，可以换函数和 setup，也可以换成没有 recipe；再加一个初始选择，让 P 的
一个依赖在 P 之后才建。新的不变式：恢复出来的 P 跑的是替换后实例的 recipe 和 setup；没有 recipe 时恢复失败；任何建造顺序下都能恢复。
再加两三个变异（replace 保留旧 recipe、按 checkpoint 顺序建造、seed note 交给每次运行），参考测试里已经有对应的变异，可以照着做。
理由：B140 的 formal 一条要求证据和模型的实际内容对应。这两条是 D799 加上去的，正是两次复审找到缺陷的地方，只靠测试覆盖是规则文字和模型之间的缺口。
其他做法：不补，在 `formal/README.md` 里写明这两条没有建模，由参考测试覆盖。

### Q6. 接纳之后，每个 runtime 要改什么

**用户决定（2026-11-10）：** 现在就去掉，没有按建议。checkpoint 里不再有版本号，恢复也不再校验版本号；TS 和 Rust 删掉 checkpoint 里的 `version` 字段和对应的恢复校验。本文的理解是：这只管 checkpoint。节点上的版本元数据本身（D109 的 V0/V1）留不留，是包内的事（D109 已是 TS 包内的历史），在根仓库，它的去处仍然是暂缓的 R-revision。R-checkpoint 的文字要写明：checkpoint 不保存 revision 或版本证据。

见第 3 节。这里只有一个问题需要决定：**D109 的版本号（TS 的 V0 计数和 V1 `cid/prev`，Rust 在 B68 做的那份）怎么办。**

D109 在根仓库已被 D796 取代，原文由 D783 迁到 graphrefly-ts，属于 TS 包内的历史。D797 给它的根仓库去处是 R-revision，
也就是一个观察器，不是节点状态，位置放在 checkpoint 旁边，哈希在读取时算出。R-revision 暂缓。

**建议：根仓库的规则不管版本号；版本号是不是写进 checkpoint，由各包自己定；但它不能改变恢复的结果。** 也就是说，不能因为版本号
校验不过而拒绝一个 R-checkpoint 接受的恢复，也不能因为版本号让一个节点多跑或少跑。R-revision 激活时再决定各包要不要改用观察器。
理由：这样不需要现在就动 TS 和 Rust 里跟 checkpoint 无关的版本号代码，同时守住了 conformance 的边界。
其他做法：现在就去掉（概念上最小，但会提前改掉一个用户可见的 TS API，而它的替代 R-revision 还没定）；或者等 R-revision 激活再说
（那 Rust 的 B68 恢复校验会一直是一个未定义的拒绝来源）。

### Q7. 规则已经接受的限制，请再确认一次

**用户决定（2026-11-10）：** 八条全部确认，写进激活决定。

R-checkpoint@1 的文字里接受了下面这些限制。前三条是那个会话列出的，后面几条也在规则里，一并列出：

1. **第一次订阅前的 INVALIDATE 看不到。** 恢复出来的节点在第一次激活前收不到 wave，激活时只比较值和终止状态。所以 INVALIDATE
   之后又写了值，看起来就是那次写入；写了一个值又写回原值，看起来什么都没发生。宿主如果不能丢掉它们，要先订阅再写上游。
2. **capture 时正在进行的工作会丢掉**，既不继续，也不重新发出：一个待发的定时器、一个等着重试的 restart（restart 的 owner 恢复后会换掉已结束的 inner，不会卡住）、一个进行中的异步请求。
3. **值、私有状态和 recipe 配置必须是 JSON**，不是 JSON 时 capture 被拒绝。
4. 只能在 wave 边界 capture：wave 里或 batch body 里 capture 被拒绝，而不是等待。
5. 没有 recipe 的计算节点是 local-only，恢复它会失败；缺少 recipe 的恢复也会失败。函数体从不保存。
6. 没有 lifetime 的计算节点存为什么都没有，恢复后第一次激活时从头算。
7. 已结束的节点恢复为已结束，但不带私有状态（D799：结束时丢掉私有状态）。
8. 恢复出来的图没有订阅者；setup 会在恢复后的第一次激活时重新打开外部资源，但定时器剩余的时间之类的进度不会保留。

### Q8. 接纳的依据

**用户决定（2026-11-10）：** 接纳，依据和风险都按下面写进激活决定。

**事实：** 两个消费者都没有用到 D799 加的接口（recipe、definition、seed note），证据全部来自参考模块的测试、6 个模型变异和 5 个测试变异。
R-revision 正是因为"没有消费者"而被暂缓的（用户，2026-11-09）。

**建议：仍然接纳，依据写成下面三条，并写明它和 R-revision 的区别：**

1. **checkpoint 已经是三个 runtime 公开的行为。** TS、Rust、Python 都实现了 capture/restore，C-24 三个都标了 pass，但现在没有一条
   生效的规则约束它们。不接纳，各 runtime 的内核迁移就没有依据可循，只能各自保留旧的 D83/D117 行为，而旧行为恰好有 D797 审查找到的两个缺陷：
   恢复的定时器源再也不触发；history 在 INVALIDATE 之后留着旧条目。R-revision 不一样，它在 runtime 里没有现成的使用者。
2. **Python 的切片要它。** 按 D800，Python 要按新规则重写 checkpoint，用户已经选择在它的切片里做，前提是根仓库先接纳。
3. **形式化和参考证据**：上面的模型和测试，加上 Q5 补的模型。这些只是候选证据，runtime 证据仍按 D784 由各 owner 报告。

依据里还要写明它的风险：新的行为（输入变了跑一次、setup 重开资源、seed note）没有经过真实消费者的检验。如果 photo-scenes 或 flagship
以后用到 checkpoint，发现问题，就按普通的 spec-amend 修订。
其他做法：像 R-revision 一样暂缓，直到有消费者。那各 runtime 迁移内核时，checkpoint 要么停在旧行为，要么先删掉。

## 3. 接纳之后各 runtime 的变化

根据对 TS `cadf3ca6`、Rust `cf02fc9`、Python `467e529` 的只读调查。调查做了抽查核对，但没有跑任何 runtime 的测试，
所以下面的内容是起点，不是证据。差异的写法和交接文档一样：只写合约层面看得到的变化，怎么实现由各 owner 决定。
这些变化依赖内核迁移的阶段 4（setup）和阶段 5（replace、`ctx.rewire`、definition），所以 checkpoint 排在那两个阶段之后。

### 三个 runtime 都要改的

1. **只在 wave 边界 capture。** 现在 TS 和 Rust 只逐个检查节点：状态是 `pending` 或 `dirty` 就拒绝
   （TS `graph/graph-support.ts:19`，Rust `checkpoint.rs:1648`）。没有检查是否在 wave 里，也没有检查 batch body 是否开着，
   而 batch body 里还没提交的写入不会让节点变成 pending。要改成明确的检查。
2. **恢复出来的图没有订阅者，第一次激活前收不到 wave。** Rust 对存为 `activated` 的节点在恢复时立刻重新订阅依赖
   （`node.rs:2469-2492`），之后依赖一变它就重算（`checkpoint.rs:1695-1765` 的测试，41 变成 42）。按新规则，这个重算要推迟到第一次激活。
3. **第一次激活时，输入变了就跑一次。** TS 在第一次激活时，用依赖当时的缓存作为它的 prev，并忽略第一次推送
   （`node/node-lifecycle-runtime.ts:7-17`），所以第一次订阅前依赖的变化永远看不到，节点一直保留恢复的值。
   新规则要把每个依赖的接收记录存进 checkpoint（两边现在都没有存），激活时和依赖当时的状态比较，有变化就只带着变化的输入跑一次。
   一次什么都不发的运行保留保存的值。
4. **setup 在恢复后的第一次激活时运行。** 现在两边的恢复都不跑函数，也不重开清理。Rust 恢复时清空 `on_deactivation` 和
   `on_invalidate`（`node.rs:2484`）。TS 的无依赖 producer 只在 `!hasCalledFnOnce` 时跑（`node-lifecycle-runtime.ts:14`），
   所以一个已经跑过的定时器源恢复后不会再触发。按内核阶段 4 改成 setup 之后，这一条自然成立。
5. **recipe 属于实例。** 两边现在都把 `restore: {ref, config}` 记在节点上（TS `graph/graph-support.ts:74-84`）。
   按 D799，recipe 和 setup 一起属于实例：replace 时一起给出，没有 recipe 的 replace 让节点变成 local-only，
   `definition(id)` 能读到它。factory 调用时拿到 `(config, { g, id, make })`。
6. **按依赖顺序重建，存 lifetime 依赖。** 一个节点建在它声明的依赖之后。`ctx.rewire` 改过依赖的节点，存的是它当前 lifetime 的依赖。
7. **已结束的节点。** 恢复为已结束，带着依赖，不带私有状态。Rust 现在拒绝 capture 以 ERROR 结束的节点（`checkpoint.rs:1056-1063`），
   因为拿不到 ERROR 的负载；新规则要保存它，负载必须是 JSON。
8. **格式。** 按 Q1，换一个新的版本标记，v1 的处理归各包。`status` 和 `lifecycle` 改为推导或由 seed 取代。

### TS

- 上面八条。
- 集合的 `backendState`：按 Q3 的确认，改为私有状态或包自己的扩展。
- 版本号：按 Q6 的决定，从 checkpoint 去掉 `version` 字段，删掉恢复时的版本校验（`node/versioning.ts:165-196` 校验形状，对 V1 重算 cid；`graph/restore.ts:774-777`）。节点上的 V0/V1 元数据留不留，由 TS owner 按它包内的 D109 决定。
- 内建 factory（`state`、`map`、`take`、`timer` 和集合辅助，`restore.ts:634`）改成新的 recipe 形状。`timer` 现在从 `config.ms` 重建，
  按新规则改由它的 setup 开定时器。

### Rust

- 上面八条，尤其是第 2 条（恢复时不订阅）和第 7 条（ERROR 结束的节点）。
- 版本号：按 Q6 的决定，从 checkpoint 去掉 `version` 字段，删掉 B68 的恢复校验（`versioning.rs:280-328`：启用版本却没有 version，或者没启用却带了 version，都会报错）。节点上的版本元数据留不留，由 Rust owner 决定。
- 按 D800，Rust 迁移时不必让 `graphrefly-bindings-py` 继续能编译。

### Python

- 现在没有自己的 checkpoint 逻辑：`Graph.checkpoint()` 直接返回原生调用的结果（`_facade.py:2640`），注册表只有 `state`、`map`
  两个内建加上 Python descriptor（`graphrefly-bindings-py/src/lib.rs:3962-3993`），也没有版本号选项。
- 按 D800，Python 在自己的内核上按新规则直接写 checkpoint，用户已选在它的切片里做，前提是根仓库先接纳。
  上面八条对它来说是要写的东西，不是要改的东西。

### 不归规则管、留给各包的

- 无名节点的 `factory#n` id 计数（恢复时从已有的 id 推回，TS `graph/graph.ts:268`，Rust `graph.rs:885`）、
  TS 的合成 id 和已释放 id 的墓碑（D152）：都是包内的命名机制，规则不涉及。
- `meta`、`name`、mount：包内的展示和组织，R-checkpoint 不要求保存。

## 4. 激活之后根仓库要做的

按上面的建议，用户同意之后：

1. 一个新决定（编号以写入时 ledger 的下一个为准），激活 R-checkpoint@1，装上 Q3 的迁移关系，写明 Q1 的排除、Q7 的限制和 Q8 的依据。
2. R-checkpoint@1 在激活前就地改写（它还是草案，D797 的草案都是这样改的）：删掉理由里的"resource reattach not yet specified"，
   写上 Q1 里三项已有的答案，写明 revision 和哈希不在 checkpoint 里。
3. 场景：C-24 退役，C-38 按 Q4 改写，新增两个场景（history 往返、模块图往返），都从 `todo` 开始。C-39 不动，继续等 R-revision。
4. 模型：按 Q5 补 `module_checkpoint.tla`，跑 TLC 和变异，更新 `formal/README.md`。
5. B140：就地改写 Checkpoint/encoding 一条（Q1），在 note 里记下这次激活；在交接文档里加上 checkpoint 一节。
6. 跑 dashboard、authority 和 work 的检查。

## 5. 本文新提出的东西

按用户的要求，下面这些是之前没有讨论过、以前的实现里也没有的。每一项都先看过能不能去掉：

- **checkpoint 文档格式归各包，不跨 runtime（Q1）。** 这不是新加的东西，是把 R-snapshot@1 已有的"编码不归协议"说明白。去掉这一项，就要定一份跨 runtime 的 schema，那才是新东西。
- **已存的 v1 checkpoint 在规则层面诚实地拒绝（Q1）。** 这不是新机制，是现有的"诚实失败"（R-restore@1）用在旧格式上。转换工具留给各包，根仓库不加。
- **D160 的集合条款随替换去掉（Q3）。** 这是删掉东西，不是加；列在这里，是因为它会让 TS 和 Rust 现有的 `backendState` 字段失去根仓库的依据。
- **拆 C-38，新增两个场景（Q4）。** 只是把现有的条款按模块分开，不增加任何要求。一起接纳 history 可以少一个场景。
- ~~"版本号不能改变恢复的结果"（Q6）~~：用户选了直接去掉，这一条不再需要。
- **模型的两处补充（Q5）。** 只是让现有的规则文字有模型覆盖，不加新行为。
