# B121 v10：传输诊断与累计$5的单次运行

用户明确批准累计上限$5（包含全部历史费用及未知预留），执行一次完整四题；key上限仍$1.97，不充值/重置。模型、Together路由、重试、会话预算、v9 consumer契约、任务/材料/评分均不变。

[冻结记录](frozen-candidate.json)确认相对v9只有api-provider.mjs的费用常量和api-transport.mjs的诊断记录变化；五份输入artifact及四个任务包完全相同。205测试通过，复用未变化的模块与consumer离线校准，见[验证](offline/verification.json)。

[执行授权](live/execution-approval.json)与[manifest](live/manifest.json)绑定本次新运行，不重放旧授权或修改历史成绩。这仍是曝光开发题，不是未见holdout；静态编译/评分不是运行时行为验证。

[本次运行结果](live-report.md)：第一题42ms内出现UND_ERR_SOCKET，预算不允许重试，0提交、1中断、3未运行。诊断记录生效，尚未证实连接根因。
