---
文档编号：   CORE-X-P-12
文档状态：   A
负责模块：   CORE
文档职责：   binder-core 需求颗粒度对齐计划（权威版）
上游约束：   CORE-C-P-01、CORE-C-D-01、SYS-C-T-01、SYS-C-T-02、CORE-X-P-02
直接承接：   Phase 10-14 Issue Trace、技术设计补全、实现阶段重排
使用边界：   定义颗粒度补齐路线，不替代技术设计规则来源
变更要求：   计划项进入实现前必须先补对应技术设计规则、状态机、接口协议和测试方案
---

# 颗粒度对齐计划

## 1. 背景

当前 Binder Mini 已完成治理可运行 MVP（Phase 1-9 前四步）：

1. Workspace 打开、递归文件树、最近 Workspace、创建/重命名/移动/删除、关闭切换门禁、FTS5 搜索。
2. md/txt 多标签编辑、dirty 保护、TipTap/Markdown 运行时。
3. Agent Provider 配置、模拟流响应、只读工具（read_file/list_files/search_files）。
4. 当前编辑器文件的 PendingDiff、接受、拒绝、失效。
5. GitHub 开源发布基础材料。

已完成文档补齐（文档状态更新至 2026-05-23）：

- AG-M-D-01：Agent 功能主控（新建 A 状态）
- DE-M-D-01：Diff Review 功能主控（新建 A 状态）
- AG-M-T-01：Agent 技术设计（新建 A 状态，覆盖 Phase 10-12 方案）
- DE-M-T-01：Diff Review 技术设计（新建 A 状态，覆盖 Phase 13 方案）
- SYS-C-T-02：需求规则映射矩阵（升级为 A 状态，补全 AG/DE 映射）
- SYS-C-T-01：注册 AG/DE/ED 候选规则到 §9-11

## 2. 对齐原则

1. binder-core 文档作为需求和颗粒度参考，不直接成为 Binder Mini 的代码规则来源。
2. Binder Mini 的代码规则仍必须先进入本项目技术设计文档，再进入实现。
3. 每个新增功能链必须先补齐：
   - 功能描述文档（需求层 REQ-*）
   - 技术设计规则（RULE/CHAIN/CONSTRAINT/TERM）
   - 状态机或状态流
   - 验收标准和测试方案
   - Issue Trace Scope Lock
4. 候选规则（CAND-*）必须在进入实现阶段前升级为正式规则注册到 SYS-C-T-01。

## 3. 当前差异归档

| 模块 | 当前状态 | 目标颗粒度 | 差异判断 |
|------|----------|-----------|----------|
| WS | 递归文件树、最近 Workspace、创建/重命名/移动/删除、关闭切换、FTS5 搜索 | 对齐完成 | 已满足 |
| ED | 多标签、dirty、TipTap/Markdown 运行时 | BlockId、DiffDecoration（依赖 Phase 13-A） | 待补 Phase 9-E/F |
| AG | Provider 配置校验、模拟流、只读工具 | 真实 SSE、写操作工具、Prompt Runtime、InputReference | 待补 Phase 10-12 |
| DE | 当前文件 PendingDiff、accept/reject/expire | sourceToolId、mounted/preapplied、持久化、批量操作 | 待补 Phase 13 |
| VAL | 服务单测 + 治理审计 | 集成测试、非法路径矩阵、场景测试 | 部分不足 |
| OSS | README/LICENSE/CI | 示例 workspace、截图、发布包检查 | 部分不足 |

## 4. 后续阶段计划

### Phase 9 剩余：Editor BlockId 与 DiffDecoration

**前置门禁**：DE-M-T-01 Phase 13-A 数据结构完成。

实施顺序：

1. 升级 ED-CAND-DATA-002 为正式规则 `BR-ED-DATA-001`（BlockId 由 Editor Runtime 生成或校验）。
2. 实现 BlockId 生成（workspace.db 映射表方案）。
3. 升级 ED-CAND-STATE-004 为正式规则 `BR-ED-STATE-005`（DiffDecoration 只消费已验证 anchor）。
4. 实现 DiffDecoration 绿审态骨架。

关键门禁：BlockId 不由模型输出直接决定执行位置；无验证 anchor 时不渲染伪高亮。

### Phase 10：Agent Provider 真实主链

**前置文档**：AG-M-T-01 §3-4 已完成。

实施顺序：

1. 升级 AG-CAND-DATA-003 为正式规则（API key 安全存储）。
2. 升级 AG-CAND-STATE-002 为正式规则（SSE 流错误终止）。
3. 后端 `send_chat_message` Tauri command 实现（Rust SSE 客户端）。
4. `chat-stream-event` 前端事件协议对接。
5. 取消 / 错误 / 超时恢复路径。
6. agentMachine 扩展 cancelling 状态。

关键门禁：API key 不出现在前端；流中断必须在 UI 显示明确失败状态。

### Phase 11：Agent 工具矩阵扩展

**前置文档**：AG-M-T-01 §5 + WS 对应结构操作规则已在 SYS-C-T-01 注册。

实施顺序：

1. 升级 AG-CAND-DATA-002 为正式规则（工具结果同轮回流）。
2. 统一 ToolResult 结构（callId 关联）。
3. 只读工具结果回流当前聊天轮次（工具结果以 tool_result 事件返回，不作为 user message）。
4. 写操作工具（create_file / create_folder / rename_file / move_file / delete_file）经 WS 层路由。
5. update_file 未打开文件 diff proposal（经 DE 层路由）。

关键门禁：写操作工具必须走 Diff Review；结构冲突必须返回 PathConflict；删除只在明确删除意图下执行。

### Phase 12：Prompt Runtime 与 InputReference

**前置文档**：AG-M-T-01 §6 已完成。

实施顺序：

1. 升级 AG-CAND-STATE-003 为正式规则（allowedTools 过滤）。
2. 升级 AG-CAND-DATA-004 为正式规则（InputReference 只注入上下文）。
3. PromptRuntime 数据结构实现。
4. allowedTools 过滤生效（后端组装 Provider payload）。
5. InputReference 标签模型与 UI 入口。
6. 粘贴 / 拖拽引用入口。
7. forbidden provider fields 阻断。

关键门禁：引用不得生成执行目标权威；provider payload 禁止字段必须在后端组装时过滤。

### Phase 13：Diff Review v2

**前置文档**：DE-M-T-01 已完成。

实施顺序：

1. **Phase 13-A**：升级 DE-CAND-DATA-001 为正式规则，扩展 PendingDiff 数据结构（sourceToolId、baseRevision、createdAt）。
2. **Phase 13-B**：升级 DE-CAND-STATE-005 为正式规则，引入 mounted_pending / preapplied 状态。
3. **Phase 13-C**：升级 DE-CAND-STATE-004 为正式规则，升级 diffMachine 状态机。
4. **Phase 13-D**：升级 DE-CAND-PERSIST-002 / DE-CAND-STATE-006 为正式规则，实现持久化协议。
5. **Phase 13-E**：已打开文件 vs 未打开文件分链路（update_file 依赖 Phase 11）。
6. **Phase 13-F**：批量 accept/reject（依赖 Phase 13-E）。

关键门禁：accept 前必须校验 originalText；preapplied → reject 必须回滚编辑器缓冲区；终态不可逆。

### Phase 14：验证矩阵与发布收敛

实施顺序：

1. 扩展测试矩阵文档。
2. Workspace command 集成测试。
3. Agent stream/tool mixed 结算测试。
4. Diff opened/unopened 生命周期测试。
5. InputReference 非法路径测试。
6. Prompt Runtime allowedTools / forbidden fields 测试。
7. CI 分层脚本。
8. 示例 workspace 和截图。
9. 发布包检查。

完成标准：本地 `check:all` 通过；GitHub Actions 通过；核心非法路径均有覆盖；README 限制说明与真实实现一致。

## 5. 优先级与执行顺序

```
第一优先级（当前可直接进入）：
  Phase 13-A  → 扩展 PendingDiff 数据结构（设计已完成，进入 Issue Trace 即可）
  Phase 10    → 真实 Agent Provider SSE（设计已完成）

第二优先级（依赖第一优先级）：
  Phase 9-E/F → BlockId + DiffDecoration（依赖 Phase 13-A）
  Phase 11    → 工具矩阵扩展（依赖 Phase 10 SSE 协议稳定）
  Phase 13-B/C → 状态机升级（依赖 Phase 13-A）

第三优先级（依赖第二优先级）：
  Phase 12    → Prompt Runtime（依赖 Phase 10/11 稳定）
  Phase 13-D  → 持久化（依赖 Phase 13-B/C）
  Phase 13-E/F → 分链路和批量操作（依赖 Phase 11 + Phase 13-D）
  Phase 14    → 完整验证矩阵和发布（依赖全部功能稳定）
```

## 6. 下一个建议任务

当前文档补齐已完成。下一步进入 Phase 13-A 的 Issue Trace：

**Phase 13-A：PendingDiff 数据结构扩展**

Scope 建议：

- 升级 `DE-CAND-DATA-001` 为正式规则 `BR-DE-DATA-001` 并注册到 `SYS-C-T-01`。
- 扩展 `src/types/diff.ts` 中 `PendingDiff` 数据结构。
- 扩展 `diffService.ts` 中 `createPendingDiffFromCurrentEditor` 携带 `sourceToolId`。
- 补充 `diffService.test.ts` 中的可溯源断言。
- 刷新 ADUS 并通过 audit。

完成后进入 Phase 10 Issue Trace（真实 Provider SSE）。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-23 | v2.0 | 升级为 A 状态；反映 Phase 8-9 前四步已完成、AG/DE 文档已补齐；重新定义 Phase 9 剩余项前置门禁；明确 Phase 10-14 执行顺序和当前优先级 |
| 2026-05-22 | v1.0 | 初始版本（R 状态），基于 binder-core 需求颗粒度差异补齐后续开发计划 |
