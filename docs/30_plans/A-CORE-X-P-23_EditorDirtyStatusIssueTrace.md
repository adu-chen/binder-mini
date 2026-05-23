---
文档编号：   CORE-X-P-23
文档状态：   A
负责模块：   CORE,ED,SYS
文档职责：   Editor dirty 保护与状态栏 Issue Trace
上游约束：   CORE-C-P-01、CORE-X-P-12、ED-M-D-01、ED-M-T-01、SYS-C-T-01、SYS-C-T-02
直接承接：   Phase 9-C 实现
使用边界：   限定 dirty 标签关闭保护和 active tab 状态栏，不实现 TipTap、Markdown 转换、BlockId 或 DiffDecoration
变更要求：   范围变化必须先更新本 Issue Trace
---

# Editor dirty 保护与状态栏 Issue Trace

## 1. Issue

执行 `Phase 9：Editor 颗粒度对齐` 的第二项：dirty 标记、关闭保护、状态栏。

本轮将 `ED-CAND-STATE-003` 和 `ED-CAND-STATE-005` 升级为正式规则，并在多标签 Editor 上实现最小关闭保护和状态栏。

## Allowed Files

- docs/30_plans/A-CORE-X-P-23_EditorDirtyStatusIssueTrace.md
- docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md
- docs/20_design/R-SYS-C-T-02_需求规则映射矩阵.md
- docs/20_design/R-ED-M-T-01_Editor技术架构.md
- docs/00_core/A-CORE-C-R-01_ADUS.md
- src/App.tsx
- src/index.css
- src/services/editorService.ts
- tests/editorService.test.ts
- tests/governance.phase2.test.ts
- "docs/20_design/A-SYS-C-T-01_\347\263\273\347\273\237\346\212\200\346\234\257\350\256\276\350\256\241\344\270\216\350\247\204\345\210\231\346\272\220.md"
- "docs/20_design/R-SYS-C-T-02_\351\234\200\346\261\202\350\247\204\345\210\231\346\230\240\345\260\204\347\237\251\351\230\265.md"
- "docs/20_design/R-ED-M-T-01_Editor\346\212\200\346\234\257\346\236\266\346\236\204.md"

## Forbidden Files

- src-tauri/**
- package.json
- package-lock.json
- docs/10_requirements/**

## Expected Behavior

1. dirty tab 在未确认时不能关闭。
2. 非 dirty tab 可以直接关闭。
3. 关闭 active tab 后，Editor 激活剩余邻近 tab；无剩余 tab 时 activeTabId 为 null。
4. 状态栏显示 active tab 文件、dirty/readonly/saved 状态和基础统计。
5. 治理生成、治理审计、TypeScript 检查和前端单测通过。

## Validation Commands

- npm run governance:generate
- npm run governance:audit -- --issue docs/30_plans/A-CORE-X-P-23_EditorDirtyStatusIssueTrace.md
- npm run check:ts
- npm run test

## 2. 不做范围

1. 不实现自定义 modal。
2. 不引入 TipTap 依赖。
3. 不实现 Markdown 转换。
4. 不实现 BlockId / Anchor。
5. 不实现 DiffDecoration。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，锁定 Editor dirty 保护与状态栏实现范围 |
| 2026-05-22 | v1.1 | 文档状态由 R 更正为 A（符合 ADU.md §6.3 Issue Trace 状态规则） |
