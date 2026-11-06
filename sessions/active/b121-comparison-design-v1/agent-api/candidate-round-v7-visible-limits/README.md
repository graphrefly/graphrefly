# B121 v7：本次请求限额可见性

## 本轮完成

**200/200离线测试、4/4模块预检通过；三路独立审查无剩余发现。** v7材料和执行代码已冻结，尚无provider调用或模型成绩。

用户在v6结果后要求继续，本轮在B121既有范围内完成harness修正和离线准备。沿用原有预算分配与终止规则，单独研究限制的可见性；没有新增library API、协议或设计锁，没有新D#。

## 目的 → 输入 → 验收 → 证据

1. **让模型看到本次请求的实际空间。** [反馈定义](/Users/davidchenallio/src/graphrefly/scripts/b121-comparison/api-runner.mjs:41)升级为entry-budget-status-v2；[每次请求](/Users/davidchenallio/src/graphrefly/scripts/b121-comparison/api-runner.mjs:331)提供currentRequest.maxOutputTokens，值直接来自该payload.max_tokens。提示明确区分会话剩余额度和本次输出上限。反馈在estimate前添加；最终阶段重建/重估后的值也一致。
2. **把已存在的字段限制讲清楚。** [共享数字](/Users/davidchenallio/src/graphrefly/scripts/b121-comparison/api-tool.mjs:11)用于tool schema、entry提示、预算反馈和运行器校验：snippet32,000、explanation6,000。实际运行器单位仍为JavaScript string.length的UTF-16 code units；通常字符算1，补充平面字符算2。JSON Schema maxLength按Unicode码点计数，这个既有差异未改；本轮明确披露较严格的运行器限制，不宣称二者对所有Unicode文本语义等价。
3. **使失败原因可直接复核。** [输出观察](/Users/davidchenallio/src/graphrefly/scripts/b121-comparison/api-runner.mjs:435)保留finish_reason与native_finish_reason、实际输出和本次上限；[字段计数](/Users/davidchenallio/src/graphrefly/scripts/b121-comparison/api-runner.mjs:497)在长度校验前保留实际长度、上限及计数单位。日志不触发重试、不剪裁答案、不改变原有接受规则或失败归类；看到native length也不自动推定是哪一层造成无效工具封装。

## 不变的比较条件

[冻结制品](frozen-candidate.json)、[准备记录](preparation.json)：v6五份材料制品逐字节相同，四个sample packet摘要相同，四题16项标准相同。模型/provider、累计输入1M、输出8,000、每请求4,096上限、80操作、80轮、75分钟、4,096提交预留、重试规则和费用政策不变。实际执行代码仅api-runner.mjs和api-tool.mjs改变；测试另外补强。旧运行证据未修改。

这不是解决全部输出分配问题：检索阶段仍可能只有1,802 token，却允许提交；模型仍可能超出字符限制。没有断言可见性一定解决v6失败，也未追加提交机会。若研究阶段/工具或额度分配改变，应作为另一个版本，而不是本轮混合修改。

## 验证

[离线验证](offline/verification.json)、[模块预检](offline/module-preflight.json)、[最终测试日志](offline/tests-final.log)。

- 重建v6显示题关键边界：首次累计输出2,102后，会话剩余5,898，本次max_tokens=1,802；估算时反馈准确显示1,802。原生length、空requests封装照实保留，仍未完成，无补发请求。
- 解释6,000通过、6,001/6,904拒绝；代码32,000通过、32,001拒绝。含补充平面字符的测试确认原UTF-16边界未改。这里仅测试broker接受，不把任意字符串当成编译通过的代码。
- 输入触发最终阶段后重新构造payload，反馈值与实际4,096上限一致；原会话token、调用、时间和费用检查仍生效。
- 估算时深拷贝payload，验证实际dispatch摘要与估算快照一致。独立审查指出旧测试只保留对象引用，可能漏掉“反馈在估算后才加入”的回归；现已修正并全套重跑。
- 反馈始终只保留最新一份，原assistant/tool历史断言及已有失败测试全部通过。

[盲审](offline/blind-review.json)、[边界审查](offline/edges-review.json)、[验证缺口修复复核](offline/verification-review.final.json)。保存此前运行器/工具代码和本次已验证源码，便于区分本轮修改与工作区早已有的改动。

## 后续运行

这是同一组已曝光开发题，不是独立holdout。冻结不是余额检查或执行批准文件。本轮没有费用、没有重跑v6、没有新评分。后续一次四题运行需以此冻结绑定新manifest并核对当前累计费用及未决预留；失败按原规则保留，不追加模型修复或补采到通过。

## 后续单次运行

见[真实运行报告](live-report.md)：2份提交通过，第三题502后重试被费用准入拦住，第四题未运行；未知预留保留。live审查子任务因Codex额度中断，主助手完成静态复核并披露独立性限制。上述离线准备记录不等同于模型成绩。
