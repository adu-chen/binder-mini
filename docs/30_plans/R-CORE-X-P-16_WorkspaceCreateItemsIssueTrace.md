---
文档编号：   CORE-X-P-16
文档状态：   R
负责模块：   CORE,WS,SYS
文档职责：   Workspace 创建文件与目录 Issue Trace
上游约束：   CORE-C-P-01、CORE-X-P-12、WS-M-D-01、SYS-C-T-01
直接承接：   Phase 8-C 实现
使用边界：   限定 create_file/create_folder 与 PATH_CONFLICT，不处理 rename/move/delete
变更要求：   范围变化必须先更新本 Issue Trace
---

# Workspace 创建文件与目录 Issue Trace

## 1. Issue

执行 `Phase 8：Workspace 硬范围` 的 `create_file / create_folder`。

创建操作天然涉及目标存在冲突，因此本 Issue 同步升级 `PATH_CONFLICT` 规则，但不实现覆盖确认。

## Allowed Files

- docs/30_plans/R-CORE-X-P-16_WorkspaceCreateItemsIssueTrace.md
- docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md
- docs/20_design/R-SYS-C-T-02_需求规则映射矩阵.md
- docs/00_core/A-CORE-C-R-01_ADUS.md
- src/types/workspace.ts
- src/services/workspaceService.ts
- src/App.tsx
- src/index.css
- tests/workspaceService.test.ts
- tests/governance.phase2.test.ts
- src-tauri/src/lib.rs
- "docs/20_design/A-SYS-C-T-01_\347\263\273\347\273\237\346\212\200\346\234\257\350\256\276\350\256\241\344\270\216\350\247\204\345\210\231\346\272\220.md"
- "docs/20_design/R-SYS-C-T-02_\351\234\200\346\261\202\350\247\204\345\210\231\346\230\240\345\260\204\347\237\251\351\230\265.md"

## Forbidden Files

- package.json
- package-lock.json
- src/services/agentService.ts
- src/services/diffService.ts
- src/services/editorService.ts

## Expected Behavior

1. 用户可以在当前 Workspace 内创建文件或目录。
2. 创建目标必须受 Workspace 边界守卫约束。
3. 目标已存在时返回 `PATH_CONFLICT`，不覆盖既有文件或目录。
4. 创建成功后刷新递归文件树。
5. 治理生成、治理审计、TypeScript 检查、单测和 Rust 检查通过。

## Validation Commands

- npm run governance:generate
- npm run governance:audit -- --issue docs/30_plans/R-CORE-X-P-16_WorkspaceCreateItemsIssueTrace.md
- npm run check:ts
- npm run test
- npm run check:rust
- cd src-tauri && cargo test

## 2. 不做范围

1. 不实现覆盖确认。
2. 不实现 rename/move/delete。
3. 不实现创建后自动打开文件。
4. 不实现 Agent 写工具矩阵升级。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，锁定 Workspace 创建文件与目录实现范围 |
