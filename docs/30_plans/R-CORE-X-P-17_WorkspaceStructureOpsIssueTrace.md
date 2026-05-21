---
文档编号：   CORE-X-P-17
文档状态：   R
负责模块：   CORE,WS,SYS
文档职责：   Workspace 重命名移动删除 Issue Trace
上游约束：   CORE-C-P-01、CORE-X-P-12、WS-M-D-01、SYS-C-T-01
直接承接：   Phase 8-D 实现
使用边界：   限定 rename_item/move_item/delete_item，不处理关闭切换门禁或搜索索引
变更要求：   范围变化必须先更新本 Issue Trace
---

# Workspace 重命名移动删除 Issue Trace

## 1. Issue

执行 `Phase 8：Workspace 硬范围` 的 `rename_item / move_item / delete_item`。

本 Issue 复用已注册的 `BR-WS-DATA-003` 和 `BR-WS-DATA-004`，完成结构操作命令、基础 UI 和测试覆盖。

## Allowed Files

- docs/30_plans/R-CORE-X-P-17_WorkspaceStructureOpsIssueTrace.md
- docs/20_design/R-SYS-C-T-02_需求规则映射矩阵.md
- docs/00_core/A-CORE-C-R-01_ADUS.md
- src/types/workspace.ts
- src/services/workspaceService.ts
- src/App.tsx
- src/index.css
- tests/workspaceService.test.ts
- tests/governance.phase2.test.ts
- src-tauri/src/lib.rs
- "docs/20_design/R-SYS-C-T-02_\351\234\200\346\261\202\350\247\204\345\210\231\346\230\240\345\260\204\347\237\251\351\230\265.md"

## Forbidden Files

- package.json
- package-lock.json
- docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md
- src/services/agentService.ts
- src/services/diffService.ts
- src/services/editorService.ts

## Expected Behavior

1. 用户可以在当前 Workspace 内重命名、移动、删除文件或目录。
2. source 和 target 必须受 Workspace 边界守卫约束。
3. move/rename 目标已存在时返回 `PATH_CONFLICT`，不覆盖既有文件或目录。
4. 结构操作不得指向 `.binder` 内部数据。
5. 操作成功后刷新递归文件树。
6. 治理生成、治理审计、TypeScript 检查、单测和 Rust 检查通过。

## Validation Commands

- npm run governance:generate
- npm run governance:audit -- --issue docs/30_plans/R-CORE-X-P-17_WorkspaceStructureOpsIssueTrace.md
- npm run check:ts
- npm run test
- npm run check:rust
- cd src-tauri && cargo test

## 2. 不做范围

1. 不实现 dirty editor 或 pending diff 删除/移动门禁。
2. 不实现撤销、回收站或删除确认弹窗。
3. 不实现 Agent 写工具矩阵升级。
4. 不实现搜索索引刷新策略。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，锁定 Workspace 结构操作实现范围 |
