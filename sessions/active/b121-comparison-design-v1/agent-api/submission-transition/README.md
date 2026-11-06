# B121：主动进入提交阶段与类型入口文档

2026-09-18。用户要求继续处理两题失败的复盘。分类为既有B121的离线修复与证据；harness由graphrefly拥有，包入口说明由graphrefly-ts拥有。不修改产品语义或预算，不创建新D#/工作编号。

## 已落实

1. **harness：prepare_submit。** 在entry检索阶段，参与者可单独调用`{"requests":[{"op":"prepare_submit"}]}`，消耗一项操作及本次正常token/call额度，进入既有submit-only阶段。下一请求可使用预留输出，但仍必须通过累计输入、输出、操作数、时间、费用和上下文准入。转换不可逆；下一响应只接受一项submit。不能批量带检索或答案字段，不能重复转换，不能在无效最终输出后获得修复轮。
2. **原直接submit仍接受。** 它只使用当前请求额度，不解锁预留。新操作提供主动选择，不保证模型一定使用，亦不消除任何输出截断可能性。ENTRY_FINALIZATION_POLICY升级为entry-reserved-submit-v2，schema和instructions都会进入下次manifest摘要。
3. **TS包文档。** packages/ts/README.md的Common Imports与任务入口表增加`@graphrefly/ts/data`，说明DataResult/DataIssue的现有导出和被动事实边界。package.json已有该子路径；不为旧错误答案在core增加重导出，不加入题目解答。旧冻结材料不变；这个README目前也不在旧98文件材料中，不能声称已经改善旧材料的可发现性。

## 验证与限制

- 全套211测试通过，0失败/跳过。新增4项：1243额度下请求转换后下一响应得到4096；混合批次/多余字段在应用操作前拒绝；重复转换/再次检索拒绝；转换后仍可被输入准入拦住。
- 原直接提交、自动submit-only、无修复、比较模式和费用回归保持通过。两个修改模块通过node --check；格式化仅样式修改。
- 独立上下文denominator_edge_review检查操作计数、不可逆阶段、所有预算边界和比较模式隔离，无发现。另一个独立验证任务因agent thread limit不可用，由主助手完成其余检查，不称三路独立QA。
- 文档对照真实package exports与src/data声明检查；仅文档变化，无新增库运行时行为，无需为文案创建测试。
- [测试日志](tests.log)、[本次增量](changes.patch)、[摘要与验证](verification.json)。没有provider生成、没有用户答案修补，没有修改历史run或评分。

下一次评测必须另行冻结新harness。已暴露版本题只能作开发回归，不能拿修复后的结果覆盖此前invalid tool envelope。若评价文档变化，应预先确定将package README/export map纳入材料的统一规则，而不是只给某题指出正确import。

审阅顺序：先看api-runner的阶段转换和准入，再看api-tool公开操作，最后看TS README的入口说明与验证。此处不创建新live授权或自动重跑。
