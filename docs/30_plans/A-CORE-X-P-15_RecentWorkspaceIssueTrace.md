---
文档编号：   CORE-X-P-15
文档状态：   A
负责模块：   CORE,WS,SYS
文档职责：   最近 Workspace 记录 Issue Trace
上游约束：   CORE-C-P-01、CORE-X-P-12、WS-M-D-01、SYS-C-T-01
直接承接：   Phase 8-B 实现
使用边界：   限定最近 Workspace 用户级元数据，不处理文件结构写操作、搜索索引或关闭切换
变更要求：   范围变化必须先更新本 Issue Trace
---

# 最近 Workspace 记录 Issue Trace

## 1. Issue

执行 `Phase 8：Workspace 硬范围` 的最近 Workspace 记录。

本 Issue 将 `REQ-WS-004` 对应候选规则升级为正式技术规则，并实现最近 Workspace 的保存与读取。

## Allowed Files

- docs/30_plans/A-CORE-X-P-15_RecentWorkspaceIssueTrace.md
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

1. 成功打开 Workspace 后记录最近 Workspace。
2. 最近 Workspace 存储在用户级 app data，不写入 Workspace 内容目录。
3. 最近 Workspace 列表去重、按最近打开时间倒序排列，并限制数量。
4. 前端可读取并展示最近 Workspace。
5. 治理生成、治理审计、TypeScript 检查、单测和 Rust 检查通过。

## Validation Commands

- npm run governance:generate
- npm run governance:audit -- --issue docs/30_plans/A-CORE-X-P-15_RecentWorkspaceIssueTrace.md
- npm run check:ts
- npm run test
- npm run check:rust
- cd src-tauri && cargo test

## 2. 不做范围

1. 不实现点击最近 Workspace 直接打开。
2. 不实现最近 Workspace 删除或置顶。
3. 不实现搜索索引持久化。
4. 不实现创建、移动、重命名、删除命令。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，锁定最近 Workspace 实现范围 |
| 2026-05-22 | v1.1 | 文档状态由 R 更正为 A（符合 ADU.md §6.3 Issue Trace 状态规则） |
