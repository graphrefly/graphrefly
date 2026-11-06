# B121 v6：评分覆盖开发候选

## 本轮完成什么

**四题、16项标准已准备并冻结；4/4模块预检通过，11/11校准代码可编译，两个独立静态判断均与2个正例/9个反例的预设分类一致。** 三路独立审查均无剩余发现。没有provider调用、模型提交或新增费用。

本轮沿用B121的文档指导下使用接口任务。用户在v5复盘与文档修正后要求继续；这里落实覆盖缺口，不改旧标准、不追改旧4/4、不增加新协议或API。root拥有开发评测制品。没有新D#、没有宣布B121整体完成。

## 目的 → 材料 → 评分 → 验证

1. **任务意图**：[tasks.json](tasks.json)。保留显示、组合、交接、检查四个角色；显示与交接题不变。组合题明确名称不替代输入/resource准备；检查题明确同图多实例、完整结构返回、publication尚未出现、host及保留证据输出、结果关联与非原子观察。纠正组合题原先“要解释”与“只提交代码”的冲突。
2. **评分边界**：[reviewer-rubric.json](reviewer-rubric.json)。组合新增name-resource-boundary；检查加强完整图及host-boundary-evidence，新增精确目标、缺失publication和结果关联三项。字段名/等价返回形状均可；有publication和无publication分别评分，避免条件范围歧义。仍是冻结编译+可信源码审查，不声称执行答案或自动判定运行时行为。
3. **制品冻结**：[frozen-candidate.json](frozen-candidate.json)。98份参与者材料中只更新上轮已修正的README；其余97份不变。TS编译器、声明依赖及选项不变，重新绑定新README和材料摘要。模型、provider、runner预留提交策略、硬预算、重试规则和33个执行代码绑定保持v5版本。
4. **离线证据**：[qualification.json](offline/qualification.json)、[calibration-summary.json](offline/calibration-summary.json)。四个packet都能访问本题，但不能读取评分、编译器、校准答案或预设判定。校准制品未加入materials。每份校准代码只在冻结编译子进程内做类型检查，没有执行。

## 校准覆盖

| 案例 | 有意构造的情况 | 盲审结果 |
|---|---|---|
| C01 | 精确目标、完整图、host/保留证据、正确解释 | 通过 |
| C02 | 全图首个suffix匹配替代目标 | 拒绝：精确目标、缺失publication |
| C03 | 只返回nodes/edges数量 | 拒绝：完整图 |
| C04 | target publication缺失时借用另一实例 | 拒绝：缺失publication |
| C05 | 声称物理结果只能在host出现 | 拒绝：结果关联 |
| C06 | 从publication缺失推断未提交/可重放 | 拒绝：缺失publication、未知结果 |
| C07 | 正确组合及名称/资源解释 | 通过 |
| C08 | 错误解释声称名称生成/授权资源 | 拒绝：名称/资源边界 |
| C09 | 读取但不返回retained quiescence | 拒绝：host/保留证据输出 |
| C10 | 读取但不返回host记录/readiness | 拒绝：host/保留证据输出 |
| C11 | 解释正确但代码注释仍声称名称生成资源 | 拒绝：名称/资源边界 |

所有反例均可编译，因此分类不是依赖类型错误。两个评审未读calibration-expected.json，分别按任务、标准和冻结源码判断，再由准备脚本核对判定与预设结果。这是对这些具体样例的静态评分校准，不是通用自动语义评分器或运行时反例执行。

[盲审](offline/blind-review.final.json)、[边界审查](offline/edges-review.final.json)、[验证缺口审查](offline/verification-review.final.json)均绑定最终制品摘要。

## 发现与修复历史

独立审查指出：任务要求返回的host/retained quiescence没写进标准；正向组合样例沿用了v5答案中的错误注释；缺失publication规则有重叠；组合题输出措辞矛盾。均在冻结前修正。旧错误注释保留为C11，不能因为正文解释正确就忽略代码注释的错误声明。

首次修注释漏掉跨行字符串，评审识别后按准确原串修正；首次边界验证误把broker抛错当成ok:false，修正的是检查脚本而非harness。旧校准材料、初始评审和中间预检收据均保留，见[准备历史](offline/preparation-history.json)。最后一次qualification及带final的评审才对应最终冻结。

## 结论的限度与后续执行

这些任务、标准与校准样例均由观察过旧答案的作者准备，是开发覆盖版本，不是独立未见holdout。新README、提示和标准同时变化；将来v6的结果不能与v5简单比较后宣称某一改动导致提升。v5原始材料、运行代码摘要及4/4静态成绩保持不变。

本轮未运行模型，没有新的易用性成绩，也没有执行模型代码。离线冻结不是费用余额快照或live授权文件。后续若运行，应先核对累计$4内历史费用与未知预留，绑定此冻结制品到新的单次campaign manifest，四题各一次，失败保留；不能补采到通过。正式泛化评测仍需要未参与调试的新任务与独立访问边界。

## 后续单次运行

用户随后授权的四题运行已结束，见[真实运行报告](live-report.md)：2/4通过、2/4无效提交。上面的校准/冻结记录属于运行前准备，不代表实际模型成绩。
