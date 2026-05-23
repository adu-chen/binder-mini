---
文档编号：   CORE-X-P-07
文档状态：   A
负责模块：   AG
文档职责：   Agent只读工具范围
上游约束：   ADP.md、SYS-C-T-01、CORE-X-P-02
直接承接：   read_file/list_files/search_files 实现
使用边界：   记录本次代码任务范围，不替代技术设计
变更要求：   Scope 扩展必须追加记录
---

# Agent Read Tools Issue Trace

## 1. 任务类型

task_type: CODE_CHANGE

## 2. 任务目标

实现 Phase 4 的只读工具最小闭环：

1. `read_file`：读取 Workspace 内指定文件内容。
2. `list_files`：列出 Workspace 内指定目录的首层文件/目录。
3. `search_files`：在 Workspace 内搜索文本内容并返回命中摘要。
4. 每次工具执行必须生成 `ToolExecution` 记录。
5. 所有工具路径必须受 Workspace 边界约束。

参考 `/Users/imatstarbucks/binder-core` 口径：三者均为只读工具，不改变 Workspace 内容。

## 3. 静态规则来源

- `BR-AG-OBS-001`
- `BR-AG-DATA-001`
- `BR-WS-DATA-001`
- `BR-CORE-GOV-001`
- `X-CONST-001`

## 4. TERM 前置门禁

本任务使用已注册 TERM：

- `Workspace`：`TERM-CORE-001`
- `ToolExecution`：`TERM-AG-001`

新增 `ToolName`、`SearchResult`、`ToolExecutionResult` 为 Agent 工具技术结构，不单独注册 TERM。

## 5. Scope Lock

allowed_files:

- `docs/30_plans/A-CORE-X-P-07_AgentReadToolsIssueTrace.md` # 本 Issue Trace
- `src/types/agent.ts` # 工具类型扩展
- `src/services/agentService.ts` # 只读工具服务
- `src/App.tsx` # Agent 工具 UI 接入
- `src/index.css` # Agent 工具 UI 样式
- `src-tauri/src/lib.rs` # 只读工具 Tauri command
- `tests/agentService.test.ts` # Agent 工具测试
- `tests/governance.phase2.test.ts` # 既有覆盖更新
- `docs/00_core/A-CORE-C-R-01_ADUS.md` # 自动生成索引

forbidden_files:

- `ADU.md`
- `ADP.md`
- `CLAUDE.md`
- `docs/00_core/A-CORE-C-P-01_APC.md`
- `docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md`

confirmation: YES

scope_reason: Phase 4 当前步骤为 read_file/list_files/search_files，只读工具可由现有 AG/WS 规则覆盖。

## Allowed Files

- docs/30_plans/A-CORE-X-P-07_AgentReadToolsIssueTrace.md
- src/types/agent.ts
- src/services/agentService.ts
- src/App.tsx
- src/index.css
- src-tauri/src/lib.rs
- tests/agentService.test.ts
- tests/governance.phase2.test.ts
- docs/00_core/A-CORE-C-R-01_ADUS.md

## Forbidden Files

- ADU.md
- ADP.md
- CLAUDE.md
- docs/00_core/A-CORE-C-P-01_APC.md
- docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md

## Expected Behavior

Agent 面板可以对当前 Workspace 执行只读文件读取、目录列出和文本搜索；越界路径由后端拒绝，执行结果进入 ToolExecution 列表。

## Validation Commands

- npm run governance:generate
- npm run governance:audit -- --issue docs/30_plans/A-CORE-X-P-07_AgentReadToolsIssueTrace.md
- npm run check:ts
- npm run test
- npm run check:rust
- npm run build

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，记录 Agent 只读工具 Scope Lock |
| 2026-05-22 | v1.1 | 文档状态由 R 更正为 A（符合 ADU.md §6.3 Issue Trace 状态规则） |
