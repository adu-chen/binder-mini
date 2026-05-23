---
文档编号：   CORE-X-P-25
文档状态：   A
负责模块：   CORE,ED,SYS
文档职责：   Editor Markdown 读取与保存转换 Issue Trace
上游约束：   CORE-C-P-01、CORE-X-P-12、ED-M-D-01、ED-M-T-01、ED-M-T-02、SYS-C-T-01、SYS-C-T-02
直接承接：   Phase 9-D 实现
使用边界：   限定 `.md` TipTap/Markdown 读取、编辑和保存转换；`.txt` 保持 textarea；不实现 BlockId 或 DiffDecoration
变更要求：   范围变化必须先更新本 Issue Trace
---

# Editor Markdown 运行时 Issue Trace

## 1. Issue

执行 `Phase 9：Editor 颗粒度对齐` 的第四项：Markdown 读取与保存转换。

本轮将 `ED-CAND-DATA-001` 升级为正式规则 `BR-ED-PERSIST-002`，并为 `.md` 文件接入 TipTap/Markdown 运行时；`.txt` 继续使用纯文本 textarea，避免扩大回归面。

## Allowed Files

- docs/30_plans/A-CORE-X-P-25_EditorMarkdownRuntimeIssueTrace.md
- docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md
- docs/20_design/R-SYS-C-T-02_需求规则映射矩阵.md
- docs/20_design/R-ED-M-T-01_Editor技术架构.md
- docs/00_core/A-CORE-C-R-01_ADUS.md
- package.json
- package-lock.json
- src/App.tsx
- src/index.css
- src/components/
- src/components/MarkdownEditor.tsx
- src/services/editorService.ts
- tests/editorService.test.ts
- tests/governance.phase2.test.ts
- "docs/20_design/A-SYS-C-T-01_\347\263\273\347\273\237\346\212\200\346\234\257\350\256\276\350\256\241\344\270\216\350\247\204\345\210\231\346\272\220.md"
- "docs/20_design/R-SYS-C-T-02_\351\234\200\346\261\202\350\247\204\345\210\231\346\230\240\345\260\204\347\237\251\351\230\265.md"
- "docs/20_design/R-ED-M-T-01_Editor\346\212\200\346\234\257\346\236\266\346\236\204.md"

## Forbidden Files

- src-tauri/**
- docs/10_requirements/**

## Expected Behavior

1. `.md` 文件使用 TipTap + `tiptap-markdown` 编辑，逻辑状态仍保存 Markdown 文本。
2. `.txt` 文件继续使用 textarea，读写主流程不受 TipTap 影响。
3. Markdown 转换失败时必须展示错误并阻断保存，不能覆盖磁盘内容。
4. 保存成功后 active tab 内容与磁盘内容一致，并回到 saved 状态。
5. 治理生成、治理审计、TypeScript 检查和前端单测通过。

## Validation Commands

- npm run governance:generate
- npm run governance:audit -- --issue docs/30_plans/A-CORE-X-P-25_EditorMarkdownRuntimeIssueTrace.md
- npm run check:ts
- npm run test

## 2. 不做范围

1. 不实现 BlockId / DocumentAnchor。
2. 不实现 DiffDecoration 绿审态。
3. 不把 `.txt` 迁移到 TipTap。
4. 不把 BlockId 写入 Markdown 源文。
5. 不自研完整 Markdown parser / serializer。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，锁定 Editor Markdown 运行时实现范围 |
| 2026-05-22 | v1.1 | 文档状态由 R 更正为 A（符合 ADU.md §6.3 Issue Trace 状态规则） |
