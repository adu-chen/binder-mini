---
文档编号：   CORE-X-P-18
文档状态：   R
负责模块：   CORE,WS,SYS
文档职责：   Workspace 关闭切换门禁 Issue Trace
上游约束：   CORE-C-P-01、CORE-X-P-12、WS-M-D-01、SYS-C-T-01
直接承接：   Phase 8-E 实现
使用边界：   限定关闭/切换 Workspace 的 dirty/pending 门禁，不处理搜索索引
变更要求：   范围变化必须先更新本 Issue Trace
---

# Workspace 关闭切换门禁 Issue Trace

## 1. Issue

执行 `Phase 8：Workspace 硬范围` 的关闭/切换 Workspace dirty/pending 门禁。

本 Issue 将 `REQ-WS-009` 对应候选规则升级为正式技术规则，并在前端工作流中阻止不安全的关闭和切换。

## Allowed Files

- docs/30_plans/R-CORE-X-P-18_WorkspaceCloseSwitchGuardIssueTrace.md
- docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md
- docs/20_design/R-SYS-C-T-02_需求规则映射矩阵.md
- docs/00_core/A-CORE-C-R-01_ADUS.md
- src/services/workspaceService.ts
- src/machines/workspaceMachine.ts
- src/App.tsx
- tests/workspaceService.test.ts
- tests/governance.phase2.test.ts
- "docs/20_design/A-SYS-C-T-01_\347\263\273\347\273\237\346\212\200\346\234\257\350\256\276\350\256\241\344\270\216\350\247\204\345\210\231\346\272\220.md"
- "docs/20_design/R-SYS-C-T-02_\351\234\200\346\261\202\350\247\204\345\210\231\346\230\240\345\260\204\347\237\251\351\230\265.md"

## Forbidden Files

- package.json
- package-lock.json
- src-tauri/src/lib.rs
- src/services/agentService.ts
- src/services/diffService.ts
- src/services/editorService.ts

## Expected Behavior

1. 当前编辑器 dirty 时，关闭或切换 Workspace 被阻止。
2. 存在 pending diff 时，关闭或切换 Workspace 被阻止。
3. 无 dirty editor 且无 pending diff 时，允许关闭 Workspace。
4. 切换 Workspace 在打开系统选择框前先执行门禁。
5. 治理生成、治理审计、TypeScript 检查和单测通过。

## Validation Commands

- npm run governance:generate
- npm run governance:audit -- --issue docs/30_plans/R-CORE-X-P-18_WorkspaceCloseSwitchGuardIssueTrace.md
- npm run check:ts
- npm run test

## 2. 不做范围

1. 不实现保存确认弹窗。
2. 不实现 pending diff 批量处理 UI。
3. 不实现后端关闭 Workspace 命令。
4. 不实现搜索索引。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，锁定 Workspace 关闭切换门禁实现范围 |
