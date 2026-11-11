# Python 内核独立提案

2026-11-10，DS-19。状态：**用户 2026-11-10 接受。** 第 5 节的五个问题都取第一个选项（默认），第 4 节的记录同日作为
[graphrefly:D800](../../decisions/decisions.jsonl) 写入，理由末尾补了一句接受说明，"µs"改写成英文单词。非规范性文档：
它不改任何协议规则，也不授权任何仓库的实现工作；实现由各 runtime 仓库在自己的 `plan/work.jsonl` 里接纳。

输入：[D415](../../decisions/decisions.jsonl)（现行，锁定）、D32、D24、D22、D431；D797–D799 的内核规则集和参考内核
[reference/kernel/](../../reference/kernel/README.md)；本文的测量 [python-kernel-benchmark/](python-kernel-benchmark/README.md)。

## 1. 现在的划分和它的来由

D415（2026-06-21）定下：TypeScript 自成一体；Rust 是 Python 和以后其他非 TS 语言共用的原生引擎；Python 只写外壳，
"不实现单独的 Python wave 内核"。当时的理由是内核又大又复杂，在 Python 里再写一份代价高，而 Rust 已经有一份。
这条决定把 D32（每种语言一个自成一体的完整包，语言之间不互相依赖）在 Python 上收窄了。

现状（graphrefly-py `467e529`，graphrefly-rs `cf02fc9`）：Python 外壳约 4.9k 行，下面是 4.1k 行的 PyO3 绑定
`graphrefly-bindings-py`，再下面是 6.2 万行的 Rust 库。Python 开发要有 Rust 工具链和 maturin，发布时检出
`graphrefly-rs@main`。

## 2. 什么变了

1. **内核小了。** D797 之后参考内核是 828 行 JS，加上 sugar 935 行。翻译成 Python 的版本和它逐条行为一致（见第 3 节）。
2. **Python 的迁移被 Rust 卡住。** 按 D415，D797 的内核改动全部落在 Rust 里，Python 只能等 Rust 迁移完再改外壳；
   B140 交接时给三个仓库的并行提示词在 Python 这里不成立。
3. **为 FFI 边界攒下的决定越来越多。** D431（fatal `BaseException` 穿过原生 batch commit）、D436（之后外壳作废）、
   D447/D475（conformance 走私有原生 helper）、D480（异步完成回到图线程的队列）、D521（PyO3 私有类承载 bridge）、
   D557（外壳资源栈）。纯 Python 内核里，这些问题大多不存在，或者变成普通的 Python 代码。

## 3. 测量

细节和复现命令在 [python-kernel-benchmark/README.md](python-kernel-benchmark/README.md)。要点：

- 参考内核的 Python 移植、加了快速路径的调优版和它的 mypyc 编译版，在 8,000 个随机场景上和 JS 参考内核逐条一致。
- 节点函数是 `x + 1` 时，调优版每次节点运行 2.3–2.5 µs，Rust 绑定走公开外壳 0.9–1.0 µs，直接调用 `_native` 0.5–0.65 µs：
  纯 Python 慢约 2.5 倍。
- 节点函数里有约 1 µs 计算时，差距缩到 1.8–2 倍。差距大体是每次节点运行固定多出约 1.5 µs，节点函数做 10 µs 的事时约为 1.1 倍。
- 建图并订阅时纯 Python 反而快 1.5–2 倍：Rust 那边每建一个节点都要跨一次 FFI。
- Rust 外壳约 40% 的时间花在 Python 包装代码上（0.88 对 0.54 µs）。
- 吞吐上限：Rust 外壳每秒约 110 万次节点运行，调优版 Python 约 43 万次。

限制：两边协议版本不同（Rust 绑定还在 D797 之前）；只测了同步 wave；mypyc 版没有加类型，几乎没有提速。

结论：性能不支持也不否定 D415。纯 Python 慢的是一个固定的、每次节点运行约 1.5 µs 的开销；对用 Python 写业务节点函数的
用户，这个开销通常被节点函数本身的耗时盖住。只有"简单算子 + 高频流"的场景会实际感到 2.5 倍的差距。

## 4. 决定草案

建议编号 D800（以写入时 ledger 的下一个编号为准）。正文用英文，和 ledger 一致：

```json
{
  "id": "D800",
  "layer": "L6 / host-language runtime ownership",
  "date": "2026-11-10",
  "question": "Now that the D797 kernel is small and a pure-Python kernel has been measured, should the Python package keep running on the Rust native engine (D415), or own its kernel as TypeScript does?",
  "decision": "Return Python to D32: graphrefly-py implements the GraphReFly kernel, its sugar and its host integration in Python, as a self-contained package with no build-time or runtime dependency on graphrefly-rs. The Python D797 migration writes that kernel directly against the current rules; it does not first migrate the PyO3 path. Python keeps its idiomatic public facade (typing, decorators, context managers, exception taxonomy, async runners, ecosystem adapters) where the rules allow, and its owner reviews the Python-local decisions written for the native boundary. Rust stays a self-contained Rust package. Its Python binding crate, graphrefly-bindings-py, gets no new work: the Rust D797 migration need not keep it compiling, and until the Python kernel replaces it, Python builds and releases against the last graphrefly-rs commit that builds it, pinned in the Python repository. The crate is removed once the Python kernel passes the kernel conformance scenarios and the Python package no longer imports graphrefly._native. Cross-runtime collaboration stays the coarse wire bridge. No host language gets the Rust engine by default: a future non-TS host chooses its kernel in its own decision, and a shared Rust core is an option where host callbacks are not the dominant cost or where embedding or mobile targets need native code. Python has no performance parity requirement with Rust.",
  "rationale": "D415 traded D32 self-containment for not writing a second wave core when the kernel was large. D797 reduced the kernel to ten concepts and a 935-line reference, and a line-by-line Python port matched the reference on 8,000 random scenarios. Measured on Python 3.14.2, a tuned pure-Python kernel costs about 1.5 µs more per node run than the PyO3 binding (about 2.5 times slower with trivial node functions, 1.8 to 2 times with about 1 µs of work, and 1.5 to 2 times faster at graph construction); for Python node functions doing real work the difference is small, and about 40 percent of the binding's own cost is Python wrapper code. Against that, the binding makes Python development need a Rust toolchain and a sibling checkout, blocks every Python protocol migration on Rust, and has required a series of boundary-only decisions (D431, D436, D447, D480, D521, D557). The trade no longer favors the shared engine for Python. Simple high-frequency operator pipelines lose throughput; a Python host that needs it can still adopt a native core under its own later decision.",
  "supersedes": ["D415", "D431"],
  "status": "locked",
  "session": "DS-19",
  "concerns": ["runtime.host-language-ownership", "runtime.native-engine-scope", "runtime.python-kernel"],
  "decision_kind": "durable-architecture",
  "change_kind": "full-supersession",
  "protocol_impact": "none",
  "completion": {
    "complete_when": "graphrefly-py passes the D797 kernel conformance scenarios on its own Python kernel with source-bound evidence, builds and releases without graphrefly-rs, graphrefly-bindings-py is removed from graphrefly-rs, and the root, Python and Rust entry documents describe the split.",
    "historical_when": "A later root decision changes which package owns a host language's kernel."
  }
}
```

D431 一并取代：它规定的是 Rust 原生 batch 里 fatal 怎么穿出来，绑定退役后没有对象。它保护的语义（fatal `BaseException`
传给调用方，不变成图的 ERROR）已经由 Python 自己的 D428/D436 写着，纯 Python 内核只要不捕获 `BaseException` 就满足。

## 5. 要用户回答的问题

每题第一个选项是建议的默认；上面的草案按默认写。

- **Q1 绑定 crate 怎么处理？** (a) 不再改，Python 内核通过内核场景、Python 包不再导入 `_native` 后删除；
  (b) 保留为可选加速器。不建议 (b)：同一个包背后两份实现，就是 D24 退役的结构性对等，而且 conformance 要跑两遍。
- **Q2 跨图（C-1、C-1b，阶段 6）怎么办？** wire bridge 和 canonical protobuf 现在由 Rust 实现。(a) 在 Python 里重写，
  protobuf 用现成的 Python 库，但必须通过 D497 的 golden vectors；(b) 先不做，Python 暂不声称 C-1/C-1b，等有跨语言的
  使用者再接纳。建议 (a)，因为它们是内核场景；但它是 Python 迁移里最大的一块，可以放在最后。
- **Q3 现有 Python 外壳 API 保留多少？** (a) 保留 `Graph.state/derived/node/effect/subscribe/batch`、`cache()`、异常
  分类和异步 runner 这些公开名字，内部换成 Python 内核，和 D797 冲突的照规则改（如 `on_invalidate`、`on_deactivation`、
  `pause/resume`、`request_pull`）；(b) 按 D797 重新设计公开 API。建议 (a)，改动由 Python 自己的决定记录。
- **Q4 以后其他非 TS 语言默认用什么？** (a) 每种语言单独决定，不设默认（草案的写法）；(b) 仍以 Rust 为默认。
- **Q5 性能要不要定门槛？** (a) 不定（草案的写法）；(b) 定一个上限，例如每次节点运行不超过 3 µs，用本文的基准测。

**过渡期：** Rust 迁移到 D797 后，绑定 crate 很可能编译不过，而 Python 的发布流程检出的是 `graphrefly-rs@main`。所以草案写明
Rust 不必为绑定让路，Python 在自己的内核落地之前，把构建和发布钉在最后一个能编译绑定的 Rust commit（现在是 `cf02fc9`）。

## 自查

草案里有几处是这次对话之前没讨论过的，逐条看过：

- **一并取代 D431**：保留。它只描述原生 batch 的行为，绑定退役后没有对象；它保护的语义 Python 已有。
- **过渡期把 Python 钉在旧 Rust commit**：保留。不写的话，Rust 先迁移会直接弄坏 Python 的发布。
- **新开 DS-19 作为索引**：保留，但可以换成挂在 DS-17 名下；只是给提案一个 session 位置，不带新规则。
- **删掉了**：草案初稿里"Python 保留基准作为回归测量"的义务。这是新加的要求，没有人提过，改成 Q5 里的选项。

## 6. 写入时要一起做的

决定写入 ledger 时（另需用户确认）：

1. `decisions/decisions.jsonl` 追加 D800；跑 `npm run authority:check` 和 `npm run test:authority`。
2. `sessions/sessions.jsonl` 加 DS-19（标题如 "Host-language runtime ownership after the D797 kernel"），locks D800，
   path 指向本文。
3. 交接 [HANDOFF-B140-runtime-owners.md](HANDOFF-B140-runtime-owners.md) 里补一句：Python 的迁移按 D800 写自己的内核。
4. 不改历史：CSP-7 的 note、D415 本身和 Python 的 root-origin-history 记录都不动，由 supersedes 边表达。

各仓库自己做的（由各自会话接纳为工作项）：

- **graphrefly-py：** 在 `plan/work.jsonl` 接纳"按 D797 写 Python 内核"的 implementation-slice；改 AGENTS.md、
  `docs/development.md`、`docs/index.md`、`docs/release.md` 里"Rust 拥有原生引擎、不写 Python wave 内核"的说法；
  `pyproject.toml` 换掉 maturin 构建；内核落地之前，发布流程钉在 `graphrefly-rs@cf02fc9`；复查上面列的 Python
  本地决定，需要时写 `graphrefly-py:D#` 取代。
- **graphrefly-rs：** 按 D797 迁移 Rust 自己的内核，不再顾及 Python 绑定；Python 包不再导入 `_native` 后删除
  `crates/graphrefly-bindings-py`，改 AGENTS.md 和 `docs/architecture.md` 里"Python native foundation"的说法。
