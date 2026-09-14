# B121：离线隔离验证与执行清单

本批在已批准的离线准备范围内继续，唯一 owner 为 root B121。新增固定合成客户端的跨进程验证，不执行真实参与者、模型或 consumer；不改变 library、公共 API、wave protocol 或性能预算。

## 本次结果与审阅路径

1. `scripts/b121-comparison/isolation.mjs` 使用已有本地 Podman/Python 镜像，按完整镜像 ID 固定，禁止 pull。容器无宿主目录挂载、无网络、只读、无新增权限，以 UID 65534 运行。只通过 stdin/stdout 连接现有 broker。代码是固定探针，不能作为生产 participant runner；其中请求 controller 封存的 probe 标记仅用于测试编排。
2. `probe-receipt.json` 保存 28 项实际跨进程检查和封存 audit：宿主 canary/仓库/oracle/socket 路径不存在，A 可读、B 提前不可读、shell/越界路径不可用、覆盖答案被拒绝、封存后 B 可读、耗尽预算后 B 未完成题按固定分母保留。无网络证据为容器无 IPv4 route，且到文档专用地址的连接失败。不是内核安全审计或全部网络协议证明。
3. `isolation.test.mjs` 检查探针集合完整性，删掉任意项、false、额外字段或非布尔值都会失败。实际移除只读参数的容器负对照也被拒绝，已确认它不能靠普通目录权限产生假通过。
4. `execution-draft.json` 绑定原材料、预分配的 12 human +12 agent slots 和现有 token/time 上限；授权仍为零。provider 渠道、不可变版本、报价、参与者和同意等未定字段保持 null，不能把这份草案拿来 dispatch。

## QA 修复与边界

两个独立评审覆盖 blind/edge 与 verification-gap；第三个独立 cleanup 专项任务因 agent thread limit 未启动，主 agent 单独检查。修复了四类假通过：只读判定改成写 /tmp 必须 EROFS；路径缺失不能以 PermissionError 代替；探针必须精确齐全；清理必须返回成功且 container exists 明确返回不存在。正例与负例都只清理本次 UUID 命名的容器，未触及其他容器或镜像。

此前 macOS sandbox 探针失败不再重复。新路线复用已有 Podman VM 和本地 manylinux Python 镜像；amd64 镜像在 arm64 VM 上运行，本批不测性能。一次初稿文件写入被自动审批钩子以环境变量访问风险拦截，未执行；随后去掉该检查。本批没有读取环境变量内容；`--unsetenv-all` 是启动配置，不能称为已验证的环境 canary。

已具备的是**固定合成客户端的宿主路径/网络及 broker 阶段隔离证据**，不是正式参与者环境资格。当前 Codex 共享任务依旧不能被当作盲测样本。容器内有 Python/基础工具，broker 不提供 shell；不声称容器里根本没有 shell。provider 自带工具、旧上下文、版本和计费均未验证。源码/材料更新或实际 adapter 改变后必须重新绑定相关证据。

## 下一步与执行边界

选择具体执行渠道后，才有依据冻结 adapter、模型版本和费用或真人安排；不继续堆叠模拟参与者来替代真实证据。执行清单还须落实真实入口的独立上下文、仅批准工具、累计用量计量，以及人工 rubric 的双评阅流程。本次未准备或授权付费调用。

复核：在 root 运行 `node scripts/b121-comparison/isolation.mjs`（需要已存在的指定本地镜像；不联网下载）；`node --test scripts/b121-comparison/isolation.test.mjs`。前者输出 28 项通过及 executionReady=false。只读负对照通过导出的 `qualifyIsolation({negativeControl:'writable-root'})` 调用，预期拒绝而非生成成功收据。
