# B121：Qwen3.8 Flash / OpenRouter 离线执行提案

用户已批准复用 CSP11 的 OpenRouter 传输/用量机制，并补齐既有 Graph entry 验收。owner 仍是 `graphrefly:B121`；本批是实现与准备证据，不新增产品决策，不完成 B121。首次已授权试跑已结束：两次资格请求通过，首位参与者因初始 broker 格式说明缺失而失败；3 次调用共报告 $0.00035325，未读题、未提交答案。详见 `runs/6cf4fdf1f779054d03b73956c1907d156a266f0570715f947e5c02da693eb194/summary.json`。当前 manifest 是补齐工具格式说明后的离线修复版本，尚无新的运行授权。此前 Astra 提案与旧测试收据可由 Git `7c8a1f2` 追溯，不能用于本版本执行。

## 审阅路线

1. **范围与费用**：`manifest.json`。保留既定 12 个 role × G/P × O1/O2 槽位、1,344 个结构化字段分母、两个前置独立资格请求。模型为 `qwen/qwen3.8-flash`，固定 `makora/fp4`；不自动换供应商或模型。每 session 累计目标 48k 输入/8k 输出（含推理），80 broker 操作、75 分钟；单次输出最多 2048、60 秒。没有新增冷启动或提示阶梯指标。
2. **共享机制**：TS owner 的 `packages/ts/evals/graph-native-rerun-avoidance/openrouter-transport.mjs`。CSP11 和 B121 共用有界响应读取、实际费用及 token 核对。CSP11 保留原 Graph 调度/任务/重试/路由；B121 自己构造 Chat messages、broker 与零重试策略。两个消费者都绑定共享代码 SHA；TS 包不反向依赖 root。
3. **试用与评分**：`api-runner.mjs` 与 `api-campaign.mjs`。仍先封存全部 A，再开放 B；G 在 A/B 全部关闭后接收对应角色入口任务。模型只有文件白名单 broker，没有编译器、执行代码或仓库工具。Graph/普通源码证据判断与 Graph-only 使用验收分开报告。
4. **入口验收**：`api-entry-review.mjs`。运行结束自动静态编译提交；没有可信评审时标为 `pending-review`，`accepted=false`。已有逐项评审规则负责语义，评审绑定 session、task、代码、解释及材料摘要。`reviewCampaignEntries({directory,reviews})` 离线核对冻结实现/材料和完整日志链，保存独占的新评审收据，不重新调用模型。原自由文本/概念负担的双盲真人评审仍未执行，不能用入口评审替代。

## 路由与费用依据

2026-09-14 的 OpenRouter [端点资料](https://openrouter.ai/api/v1/models/qwen/qwen3.8-flash/endpoints)保存在 `provider-review.json`。Makora 支持指定函数工具调用，context 262144，输入 $0.15/M、输出 $0.47/M、缓存读取 $0.016/M；Alibaba 所列指定函数支持为 false，因此本提案采用 Makora。

12 个 session 的目标 token 预算按无缓存计算为 **$0.13152**；两次资格请求总计最多 8192 输入/1024 输出，另约 **$0.00171008**。拟定本次模型服务费上限 **$0.20**，包含最后请求的保守预留余量，税费和充值手续费不在模型服务费内。

OpenAI 专用的调用前计数已移除。请求前用完整 messages/tools 的 UTF-8 字节数加 2048 格式余量作**本地预测，不宣称精确 tokenizer 计数**。预计超过剩余输入预算则不生成；实际返回超过剩余预算时停止整批、不接纳该次答案，保留真实费用。为避免预测误差影响费用防线，每次 HTTP 之前按 Makora **整个公布的 context 上限**加请求输出上限预留费用；预算不足就不发请求。成功、完整且核对通过的 usage 才释放差额；未知结算保留全部预留。此机制依赖供应商公布的上下文/价格及完整账单，不能在客户端强制约束服务商内部计费。

`provider.only` 固定路由、`allow_fallbacks=false`、`require_parameters=true`、价格上限均随 manifest 冻结。返回 model/provider、工具形状、usage 或计费异常都会停止。端点资料中的日期名并不能独立证明线上权重不可变；账户可访问性和实际工具兼容性尚未验证。

## 材料、隐私与失败

`bundle.json` 是可信控制器输入，包含多臂材料和评审配置，不能整份发送。每次只发送当前角色/臂已开放材料和其自身历史；保留原 assistant reasoning_details 与匹配的 tool 响应。首次源码读取和 entry 耗时会记录，概念“读过/必须操作”仍是自报，没有冷启动易用性结论。

资料经 OpenRouter 和 Makora 处理；没有声称 ZDR 或 `store=false` 零保留保证。[供应商日志政策说明](https://openrouter.ai/docs/guides/privacy/provider-logging)。模型参与者不能访问私有 key、隐藏答案、其他 session 或 controller compiler。

`runCampaign({approval,apiKey})` 没有自动 CLI 或凭证发现，核对冻结文件后独占创建 manifest SHA 的运行目录。没有恢复、补样本或自动重试；失败/未运行槽位仍在固定分母。异常 HTTP 与可取得的原始响应留在日志，不能假定取消请求免收费。资格请求仅包含 synthetic probe；任何资格失败都不开始正式样本。

## 本批验收与验证

- 既定 A/B 题目、事实、评分与分配保持不变。
- 真实 CSP11 消费端共用响应/账单代码；B121 用同一模块发出 Chat 请求。
- 离线验证覆盖 provider 路由、原始错误证据、超时取消、费用预留、fresh messages、工具回传、封存顺序、固定分母、重复运行拒绝、实际编译及绑定评审。
- 结果见 `openrouter-receipt.json`；旧 `receipt.json` 是上一批 Astra 离线检查历史，不代表本批。
- 原离线准备阶段调用为零；首次真实运行数据见上述 summary。没有有效比较成绩、真人结果或 B121 完成声明。

执行前需要审阅同一份 manifest 的模型/路由、$0.20 上限、材料范围、输入预测与版本限制，再给出带到期时间的单次执行批准。当前 `executionReady=false`。
