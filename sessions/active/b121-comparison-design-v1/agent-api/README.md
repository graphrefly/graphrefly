# B121 独立 API runner：离线交付与待审执行提案

本批承接 `HANDOFF-agent-api.md`：用户选择独立 API runner，真人比较暂缓。owner 是 root `graphrefly:B121`。这是既有工作的工具、准备证据及执行提案；不新增产品决策，不改变 protocol/公共 API/原评分语义，不完成 B121。所有真实 participant/provider/计数端点调用与费用授权仍为零。

## 审阅路线：意图 → 行为 → 风险 → 验证

### 1. 执行范围与费用

入口是本目录 `manifest.json`。12 个既有 agent slots 保留原 role × arm × O1/O2 分配，每格 2 个；每个 slot 是独立请求上下文。所有槽位（包括失败和未启动者）都保留在 1,344 个结构化字段的固定分母中。六个 G 槽位在各自 A/B 封存后只做对应角色的 Graph entry task，不把 P 的无对应入口记成失败。

每 session 累计 48,000 输入 /8,000 输出 token、80 个 broker 操作、75 分钟；最多 80 次生成请求，单次最多 2,048 输出 token 和 60 秒。工具批次最多 16 操作，但逐操作计入 80 上限。输出包含推理与不可见格式 token，不能把 8,000 当成可见答案字数预算；达到上限即保留未完成。重复上下文、工具响应、配置与 schema 都由计数端点参与计数，不用字符数猜测。既有材料拆成共同事实、逐题文件、独立关系文件，内容没有重写答案或补充事实。

提议使用 **OpenAI direct / gpt-6-astra / medium reasoning / Standard**。官方模型页现已列出这个 API ID，但只有同名、无日期的 snapshot；没有可独立固定的权重版本，也未验证此账户可访问。只接受返回同名 model、相同 reasoning/tools/store/tier 配置；逐请求保留 ID、UTC 时间、原始 body、usage 与请求 SHA。相同返回字符串仍不能证明底层权重从未改变。这里没有替换模型。

[官方价格](https://developers.openai.com/api/docs/pricing)为每百万 token 输入 $10、缓存读取 $1、缓存写入 $12.50、输出 $50。全部生成输入按较高的 $12.50 预留：576k ×12.50/M +96k ×50/M = **$12.00**。两次资格请求总计不超过 4,096 输入 /1,024 输出，另预留 **$0.1024**，向上取整后的服务费用上限 **$12.11**（税费不包含）。缓存写入不是加在普通输入上的第二笔输入费；实际 receipt 分别计算三类输入。

**尚未建立计数端点的免费依据。** 官方 [计数指南](https://developers.openai.com/api/docs/guides/token-counting)说明精确计数能力，但所查官方页面没有明确该端点独立收费。manifest 不填写“免费”，adapter 也不会在这个条件未落实时调用任何端点。若官方或账户账单资料证明免费，提案最多为 962 次计数 +962 次生成请求；若有费用，应先修订报价与 manifest，不把未核实费用塞进 $12.11。账户资格、上述版本限制的接受、明确到期时间及本 manifest SHA 的一次执行批准仍待落实。

### 2. 材料与封存边界

`api-prepare.mjs` 从未修改的 revision-2 材料建立 `bundle.json`，冻结每个 slot 的文件映射、源码 chunk、角色说明、输出格式、唯一 broker schema、资格 prompt、原 rubric 与概念字典。bundle 是**可信控制器输入**，含各臂和评审 rubric，绝不能整份发给模型。

`api-runner.mjs` 只向 transport 传递该 session 的请求 JSON。首请求不含其他 session、旧聊天、conversation 或 previous_response_id；后续仅重传本 session 的原始输出与 broker 响应，包括其 reasoning items。唯一工具为自定义 broker；没有 shell、浏览、文件搜索、MCP 或 effect 执行。全部八个 A 提交后，controller 才封存并在下一轮开放 B。参与者不能 seal、改写答案、提前读 B，或在完成 A 的同一工具批次读取 B。

Graph entry 仅在 A/B 关闭后开放冻结的对应任务与按 80 行编号的源码 chunk。提交仅保存 TypeScript 文本、解释、阅读/必须操作的概念以及首次必要展开位置；不会执行代码、打开 inbox 或把 compiler 交给参与者。既有静态 compiler/reviewer 流程可在收集后离线使用；本批没有 entry 使用成功证据。

### 3. 失败、重复与可信范围

`api-campaign.mjs` 是唯一完整执行入口，须显式传入批准与私有凭证；没有自动 CLI、环境变量/key 查询或默认运行。它核对 manifest、bundle 和实现 SHA，然后独占创建本 manifest SHA 的持久 claim 目录。重复启动在任何 HTTP 前失败；失败后不得删 claim 重跑。两个全新、无 study 材料的资格请求先验证实际响应形状；任一资格失败不启动 participant。

`api-transport.mjs` 使用固定 HTTPS 地址、禁止 redirect、没有 SDK 自动重试或 fallback。每次生成前必须收到相同请求的精确计数并预留最高输出费用。任何异常/超时/缺 usage/计数差异/额外工具/版本漂移/跨 session 响应或工具 ID 重放都停止整批。未知结算保留最大预留，不假定 abort 可取消服务端生成费用。成功计量才按实际使用调整预留；异常 raw body、HTTP 状态、request ID 能取得多少就保留多少。日志逐条 fsync，失败目录仍占用，不能恢复或自动补样本。

这是显式 API 请求及返回配置的隔离检查，**不是** provider 内部上下文、秘密系统提示或模型权重的独立证明。旧容器 synthetic 收据只保留原有适用范围，不能给新 adapter 自动授予资格。模型可能有训练期知识；不会宣称白纸模型。实际上传包括选中事实、自己会话及封存后需要读取的私有 TS 源码片段。

[数据文档](https://developers.openai.com/api/docs/guides/your-data)说明默认 abuse-monitoring 日志通常保留至多 30 天并有例外。`store=false` 不能宣称零留存，本账户 ZDR 状态未核实。

### 4. 评分、检查与证据限制

结构化评分仍用冻结的 `gradeSealed` 和原 goldens：值与所需事实引用均正确才计分；错误放行、错误结束、无根据确定性分别保留，不能平均掉。自由文本采用既有冻结 rubric，但目前没有两名盲评真人；解释与概念报告保留为 **unscored**，不以单模型自评顶替，也不输出已验证的概念负担结论。

`api-runner.test.mjs` 覆盖错误阶段、未来材料、越界路径、实际植入的 canary、缺 usage、缓存费、重复上下文、输入/输出上限、计数差异、timeout、最终提交超时、跨请求重放与原始错误响应。`api-campaign.test.mjs` 在临时仓库复制真正的 campaign 入口，用替代 HTTP 验证资格失败、首个 participant 故障后整批停止、固定分母和重复启动在 fetch 前拒绝。测试中的响应和批准均为明确的离线 fixture，不是实际 agent 样本。

本批三条独立 QA 视角已收集：blind 检查发现原始异常收据丢失；edge 检查发现跨 session 重放及最终批次超时；verification-gap 检查促成真正 campaign 消费端、真实植入 canary 和 adapter 计费测试，并补 JSON null 计数响应的保留。均在授权的离线范围修复。最终命令与计数见 `receipt.json`，未重跑 TS 全库/性能或旧容器探针。

## 后续一次审阅的内容

请围绕同一 manifest 审阅 Astra 的无日期版本限制、medium 配置、12 个 slots、两个前置资格请求、固定材料/代码 SHA、$12.11 生成服务费上限、禁重试与私有材料上传边界。计数端点免费依据尚未取得，故当前 `executionReady=false`；不会为了验证该条件而先发未经授权的调用。执行批准与模型/API 资格都不是本文件自动产生的状态。

agent-only 的 n=2/格只能产生本 consumer、本模型配置的描述性结果；真人比较、双评审文本/概念结论、正式性能及 B121 的其他验收条件继续未完成。
