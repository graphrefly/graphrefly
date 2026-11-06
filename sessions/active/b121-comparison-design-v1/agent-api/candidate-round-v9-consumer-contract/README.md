# B121 v9：真实实例调用的编译检查（离线冻结）

## 修复的问题与范围

v8第四题单独编译通过，但手写实例类型把`Node<CausalQuiescence>`写成`Node<Publication>`，无法接收实际compose返回对象。v9在既有编译入口中支持按任务绑定的独立consumer模块；第四题预先登记真实实例调用，参与者可见的consumerContract明确`inspectSpendingInstance(graph, instance)`导出名及真实输入要求。

本次为现有B121 harness验证修复，用户“继续”授权离线实施与准备。未改library公共API、预算或重试，未调用provider，未使用已消耗的v8单次授权。

## 实现与验证链

1. `candidate-entry.mjs`要求任务的可见契约与rubric中的私有probe成对出现。两者通过原有task/rubric摘要绑定；发给参与者的材料仅含契约，不含probe。assessment和review均使用该任务的probe。
2. `compiler-process.mjs`把probe单独保存并绑定摘要，沿原有60秒/512MiB/无重试子进程执行；worker返回摘要必须一致。
3. `frozen-compiler.mjs`在同一冻结源码环境中增加独立consumer文件，不拼接到答案尾部。consumer错误计为compile-failed，而非material-diagnostics。答案本地的ts-nocheck或未闭合注释不会吞掉独立模块。
4. 不带probe的旧输入保持原编译输出形状；旧artifact不可使用新代码摘要冒充原冻结运行。

## 已执行验证

[完整测试](offline/tests.log)：203通过，0失败/跳过。四题模块导入预检通过。

[第四题真实答案离线校准](offline/consumer-calibration.json)：

| 校准 | 预期与实际 |
|---|---|
| v8原答案 | compile-failed，真实Node类型不兼容 |
| 仅纠正该类型的合成对照 | pending-review，编译通过不等于静态评分通过 |
| v8原答案加ts-nocheck | compile-failed，独立consumer仍报告错误 |
| 对照删除要求的导出 | compile-failed |

[校准脚本](offline/qualify.mjs)保留了从第四题读取probe的端到端路径；所有校准是离线证据，不是新的模型答案。原v8回答、编译及3/4评分未改写。

三路独立只读QA完成：blind、edge、verification均无未解决问题。verification指出合成单元测试只覆盖task0，实际第四题的4个校准补充了逐任务选择证据。见[验证摘要](offline/verification.json)。

## 冻结及结论边界

[冻结记录](frozen-candidate.json)绑定33执行文件、5份材料和固定四题。源码材料与编译环境同v8；只有第四题新增可见导出约定和对应私有probe，rubric明确了consumer诊断的编译失败分类。原16项静态标准不变。此条件与v8不完全相同，不能把下一轮成绩变化纯归因于library易用性。

普通TypeScript类型检查不能防止any、断言或模块扩展掩盖语义问题，仍需原有静态源码评审。这里只补第四题已观察到的缺口，其他题不强制函数命名；没有宣称运行时行为已验证。这仍是已曝光开发题，未构造未见holdout。

## 建议审阅路线

- 接入要求：[第四题契约](tasks.json) → [冻结probe](reviewer-rubric.json)。确认没有隐藏函数名约束。
- 实际效果：[4个校准结果](offline/consumer-calibration.json)。原错拒绝、正确对照可编译，失败分类清楚。
- 复现边界：[验证摘要](offline/verification.json) → [冻结记录](frozen-candidate.json)。没有付费运行或新增执行授权。

随后完成[一次live尝试](live-report.md)：第一题网络失败后预算停止，0提交、1中断、3未运行。新增consumer检查未在live答案上触发；离线冻结与校准证据仍保留。
