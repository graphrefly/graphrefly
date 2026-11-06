# B121 连接生命周期：本地对照与针对性缓解

## 目标与结论

用户要求按顺序排查UND_ERR_SOCKET：检查当前连接、做本地对照、按证据调整、验证有界重试。本次只运行127.0.0.1上的合成HTTP服务与离线测试，没有读取API key、访问provider、付费生成或释放未知预留。

原B121经CSP11共享requestOpenRouter调用Node内置fetch，使用默认连接管理；当前Node v24.18.0、内置Undici7.28.0，没有独立Undici依赖。本地实验支持禁用HTTP/1.1连接持久化可消除“服务端针对已复用连接断开”的合成故障，不证明v10在线故障由该机制引起。

## 对照实验

[脚本](loopback-lab.mjs)使用生产代码的nonPersistentRequestOptions并串行发送POST；每个场景20次。服务端记录实际socket与请求序号，失败均为UND_ERR_SOCKET。

| 场景 | 默认策略 | Connection: close |
|---|---:|---:|
| 正常服务 | 20成功/0失败，1连接 | 20成功/0失败，20连接 |
| 服务端收到同一连接的后续请求时主动断开 | 10成功/10失败 | 20成功/0失败 |
| 服务端不论新旧连接、每逢偶数请求就断开 | 10成功/10失败 | 10成功/10失败 |

[完整证据](results.json)。第二种是受控故障注入，不是抓到了真实空闲超时竞态；第三种是负对照，避免声称关闭复用能修复所有socket错误。实验仅HTTP loopback，不覆盖实际TLS、代理或OpenRouter/Together；本地耗时不用于推断真实延迟。

## 应用的改动

- B121私有api-transport在fetch边界复制request options/headers，覆盖connection为close。保留原body、method、endpoint、Authorization、AbortSignal及redirect策略；所有尝试包括重试均应用。
- 共享CSP11 adapter、全局dispatcher、library API均不变；无需新增依赖。
- CONNECTION_POLICY= http1-connection-close-v1进入candidate manifest contract，并记录到每次尝试与失败诊断。旧冻结运行不得直接重放当前代码。
- 该头表示本请求结束后不保留HTTP/1.1连接。单独B121串行运行的本地测试每次使用独立连接；不声称它能阻止同进程其他调用者预先在全局池中留下的连接被首次选中，也不承诺HTTP/2语义。
- 连接关闭仍不证明失败POST未送达或免费；旧有预算预留、有界重试与停止规则不变。默认新建连接增加握手/延迟，实际成本待单独观测。

## 验证

206项测试全部通过，见[测试日志](tests.log)。新增真实transport注入测试验证原请求和重试都带close，body相同、信号保留、等待仍60秒；原HTTP429、取消、预算拒绝、失败预留等回归继续通过。

本地实验共120次请求，全部loopback；服务端实际连接数验证该策略生效，所有服务监听与连接关闭。审查结论见verification.json。

## 审阅路线与后续边界

1. api-transport.mjs：CONNECTION_POLICY、nonPersistentRequestOptions以及fetch边界接线。
2. candidate-campaign.mjs：策略被明确冻结，不隐含在运行时。
3. [本地结果](results.json)：复用相关故障消失，新连接也会失败的负对照仍失败。

当前累计$5上限未改，最后保守占用$4.710617752。此次没有启动新的live评测或修改v10成绩。未来live需新冻结及费用准入；仅此本地证据不能宣称线上已修复，也不能把v9/v10旧未知费用视为已结算。

## 修复后的运行准备

[next-run-readiness.json](next-run-readiness.json)已核对当前执行摘要、原四题包与材料完全一致，仅新增connection policy进入contract；206测试证据仍匹配。只查询了一次key，未生成答案。

key用量现已包含v10的$0.022220952；累计已报告仍$1.525094152，历史未知预留$3.1855236仍全部保留。累计$5下占用$4.710617752，可用$0.289382248，低于下一次最大预留$0.319488，尚未启动。

供确认的下一步：累计上限$5.50，保留全部旧费用/预留，key上限仍$1.97、不充值/重置；新冻结后仅执行一次完整四题，沿用v9 consumer契约并应用已验证的connection-close策略。可增加保守占用$0.789382248；这不是保证完成。当前key实际剩余$0.467723864，后续执行还受该外部限额约束。此文和准备快照均未修改费用常量或授予执行权限。
