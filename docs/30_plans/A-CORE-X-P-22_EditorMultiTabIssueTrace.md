---
文档编号：   CORE-X-P-22
文档状态：   R
负责模块：   CORE,ED,SYS
文档职责：   Editor 多标签实现 Issue Trace
上游约束：   CORE-C-P-01、CORE-X-P-12、ED-M-D-01、ED-M-T-01、SYS-C-T-01、SYS-C-T-02
直接承接：   Phase 9-B 实现
使用边界：   限定 Editor 多标签数据结构和 active tab 接入，不实现 TipTap、BlockId、DiffDecoration 或 dirty 关闭确认 UI
变更要求：   范围变化必须先更新本 Issue Trace
---

# Editor 多标签实现 Issue Trace

## 1. Issue

执行 `Phase 9：Editor 颗粒度对齐` 的第一项：多标签数据结构和 editorMachine per tab 等价状态接入。

本轮将 `ED-CAND-STATE-002` 升级为正式规则并实现最小多标签能力；dirty 关闭保护、TipTap/Markdown、BlockId、DiffDecoration 后续单独实现。

## Allowed Files

- docs/30_plans/R-CORE-X-P-22_EditorMultiTabIssueTrace.md
- docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md
- docs/20_design/R-SYS-C-T-02_需求规则映射矩阵.md
- docs/20_design/R-ED-M-T-01_Editor技术架构.md
- docs/00_core/A-CORE-C-R-01_ADUS.md
- src/App.tsx
- src/index.css
- src/types/editor.ts
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

1. Editor 有显式 `EditorSession` / `EditorTab` 数据结构。
2. 打开同一 Workspace 文件会复用已有 tab 并激活，不重复打开。
3. 打开不同文件会保留多个 tab，各自保留内容、mode、dirty 和状态。
4. 编辑和保存只作用于 active tab。
5. Workspace 关闭/切换 guard 检查全部 editor tabs 是否存在 dirty。
6. 治理生成、治理审计、TypeScript 检查和前端单测通过。

## Validation Commands

- npm run governance:generate
- npm run governance:audit -- --issue docs/30_plans/R-CORE-X-P-22_EditorMultiTabIssueTrace.md
- npm run check:ts
- npm run test

## 2. 不做范围

1. 不引入 TipTap 依赖。
2. 不实现 dirty 关闭确认弹窗。
3. 不实现 BlockId / Anchor。
4. 不实现 DiffDecoration。
5. 不修改 Rust/Tauri command。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，锁定 Editor 多标签实现范围 |
