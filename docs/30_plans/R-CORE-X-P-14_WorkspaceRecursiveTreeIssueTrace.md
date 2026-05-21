---
文档编号：   CORE-X-P-14
文档状态：   R
负责模块：   CORE,WS,SYS
文档职责：   Workspace 递归文件树与初始化 Issue Trace
上游约束：   CORE-C-P-01、CORE-X-P-12、WS-M-D-01、SYS-C-T-01
直接承接：   Phase 8-A 实现
使用边界：   限定 Workspace 初始化和递归文件树，不处理最近 workspace、搜索索引或文件结构写操作
变更要求：   范围变化必须先更新本 Issue Trace
---

# Workspace 递归文件树与初始化 Issue Trace

## 1. Issue

执行 `CORE-X-P-12` 的 `Phase 8-A：递归文件树与 workspace 初始化`。

本 Issue 将 `REQ-WS-003` 和 `REQ-WS-005` 对应的候选规则升级为正式技术规则，并完成最小代码实现。

## Allowed Files

- docs/30_plans/R-CORE-X-P-14_WorkspaceRecursiveTreeIssueTrace.md
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

1. 打开 Workspace 时先初始化 `.binder/workspace.db`，成功后才返回 active snapshot。
2. Workspace snapshot 返回递归文件树，目录节点包含 children。
3. 文件树和搜索不暴露 `.binder` 内部数据。
4. 前端可以递归展示目录树，并保持文件打开行为不变。
5. 治理生成、治理审计、TypeScript 检查、单测和 Rust 检查通过。

## Validation Commands

- npm run governance:generate
- npm run governance:audit -- --issue docs/30_plans/R-CORE-X-P-14_WorkspaceRecursiveTreeIssueTrace.md
- npm run check:ts
- npm run test
- npm run check:rust

## 2. 不做范围

1. 不实现最近 Workspace 列表。
2. 不实现搜索索引持久化。
3. 不实现创建、移动、重命名、删除命令。
4. 不实现关闭或切换 Workspace 状态保护。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，锁定 Phase 8-A 实现范围 |
