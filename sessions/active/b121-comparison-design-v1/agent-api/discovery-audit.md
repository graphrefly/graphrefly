# B121 文档／源码可发现性审计

2026-09-17。只读审计，不是新的参与者成绩；对应 [已确认评测方法](evaluation-method.md)。本文属于现有 B121 复盘证据，不批准或实施 TS API 改动。

## 核对对象与范围

对比实际 TS checkout 与最后试运行冻结材料。TS HEAD：`dafc5ae57d446a59a7388214c31bd7a6e73d1519`；以下另附内容摘要，HEAD 不能替代未提交内容的绑定。9个冻结源码与当前实际文件逐项摘要相同，因此以下源代码观察没有混入新实现版本。README 未在旧材料内；这里只证明当前 README 的内容，未证明它在每个历史运行时都完全相同。

## 已验证发现

| 发现 | 证据 | 能推出什么／不能推出什么 |
|---|---|---|
| 已有按角色的阅读路径 | TS `examples/spending-alerts/README.md:48`起，分别链接 ordinary panel、demo/creation/role examples、host/construction | 不能说 library 完全没有文档导航。旧材料包未提供 README，旧结果不能代表按正常 README 路径的使用体验 |
| 原 user 题实际包含应用集成职责 | `scripts/b121-comparison/entry-tasks.mjs:25`要求 compose + 五端口观察；README:52把显示与构造分开 | 原题并非非法，但角色标签应解释为“准备好输入后的应用集成”，不能泛化为纯显示组件负担 |
| 旧包不是闭合的正常文档入口 | 原9文件含 causal-audience.examples.ts，但没有README、causal-ordinary-panel.ts、causal-graded-demo.ts、construction.ts、contracts.ts | 正常 README 链接路径在旧包内走不全；需要明确材料政策，而不是按模型每次找不到的文件临时扩容 |
| 已有观察清理说明 | causal-view-binding.ts的注释说明返回函数仅停止观察；README:77以后解释detach及运行责任 | v10未提交代码不能证明清理语义本身含糊，仍需独立任务验证理解 |
| 已有能力身份说明与示例 | capabilities.ts:66写明复制／cast不等于issued capability；audience示例调用assertCausalCapabilities并返回execution | 不能把“缺少原引用说明”认定为已证实问题。示例没有覆盖旧题要求的全部返回项，但这不自动构成接口缺陷 |
| 旗舰是consumer-private示例 | README:42明确不是published package subpaths；公共入口提案有撤回提示 | 不能用这组结果评价整包安装／公共导出易用性，也不据此恢复已撤回公共入口设计 |

## 对 library 的处理结论

当前优先修正**评测条件与解释范围**。这轮没有足够证据支持改公共API、削弱capability校验、修改生命周期或增加包装器。

仍值得验证的产品假设：角色导航在真实入口是否容易被找到；用户是否理解“输入已准备好”以及观察与应用所有权的边界。现有README已经解释这些概念，下一轮应让参与者实际接触正常材料后再观察，不预设文档一定有错。

不要在原试运行包补入README后覆写旧包。采用正常文档材料属于新的评测条件；与旧源码包得分的差别不能全部归给library改进。

## 后续任务设计

见 [下一轮设计草案](next-round-draft.md)。这是供开发与审阅的设计，不是已冻结保留集。原判断题、代码集成题和新显示组件题分别报告；不通过改角色或拆题缩小原分母。

## 被检查文件内容摘要

- `README.md`: `848192ce04f7393f4539b869d9add965773cb3bf51cf8f466a05c965b1050842`
- `examples/spending-alerts/README.md`: `f154720ef10c937a73ef923ef3f58e647d6ec336e9199f0305d9d1324b97170f`
- `examples/spending-alerts/causal-ordinary-panel.ts`: `6f6db61a5d29a697b65bc73b1325e61b8644640c0bc4b78a2227ca14ac136383`
- `examples/spending-alerts/causal-audience.examples.ts`: `7f692090cc3a0e734edc2da63cd8e51860b12c37e0e8f3b5e4fcaccf1aa84d36`
- `examples/spending-alerts/causal-entry.ts`: `3d802f8b01c27519dbcc7b0ed77ed151bc8fa4fd2e0337b7535879e3dbf9b792`
- `examples/spending-alerts/causal-view-binding.ts`: `3a8722abf4ed783b8caa794ccb16a1d4fdfdbe26d999160805da746a62427409`
- `packages/ts/src/solutions/causal-occurrence/capabilities.ts`: `606b352953fdb54f7ddc076662fc1fc8b88bed2841fdfe07bdf0b85224879fc7`
