---
文档编号：   CORE-X-P-24
文档状态：   A
负责模块：   CORE,ED,SYS
文档职责：   Editor TipTap/Markdown 选型 Issue Trace
上游约束：   CORE-C-P-01、CORE-X-P-12、ED-M-D-01、ED-M-T-01、binder-core/A-ED-M-D-01、binder-core/A-ED-M-T-01
直接承接：   ED-M-T-02、ED-M-T-01、SYS-C-T-02
使用边界：   限定 TipTap/Markdown 技术选型确认，不安装依赖、不改运行时代码
变更要求：   范围变化必须先更新本 Issue Trace
---

# Editor TipTap/Markdown 选型 Issue Trace

## 1. Issue

执行 `Phase 9：Editor 颗粒度对齐` 的第三项：TipTap/Markdown 技术选型确认。

本轮只确认技术栈、转换边界和后续实现门禁；依赖安装、组件替换和 Markdown 读写转换在下一步单独实施。

## Allowed Files

- docs/30_plans/A-CORE-X-P-24_EditorTipTapMarkdownSelectionIssueTrace.md
- docs/20_design/R-ED-M-T-02_TipTapMarkdown选型方案.md
- docs/20_design/R-ED-M-T-01_Editor技术架构.md
- docs/20_design/R-SYS-C-T-02_需求规则映射矩阵.md
- docs/00_core/A-CORE-C-R-01_ADUS.md
- "docs/20_design/R-ED-M-T-02_TipTapMarkdown\351\200\211\345\236\213\346\226\271\346\241\210.md"
- "docs/20_design/R-ED-M-T-01_Editor\346\212\200\346\234\257\346\236\266\346\236\204.md"
- "docs/20_design/R-SYS-C-T-02_\351\234\200\346\261\202\350\247\204\345\210\231\346\230\240\345\260\204\347\237\251\351\230\265.md"

## Forbidden Files

- src/**
- src-tauri/**
- tests/**
- package.json
- package-lock.json
- docs/10_requirements/**

## Expected Behavior

1. TipTap/Markdown 选型方案明确依赖候选、适用文件类型、转换边界和失败策略。
2. Editor 技术架构引用选型方案，避免实现前依赖决策不清。
3. 映射矩阵标记 `REQ-ED-006` 已完成技术选型，正式规则仍待实现前升级。
4. 治理生成与治理审计通过。

## Validation Commands

- npm run governance:generate
- npm run governance:audit -- --issue docs/30_plans/A-CORE-X-P-24_EditorTipTapMarkdownSelectionIssueTrace.md

## 2. 不做范围

1. 不安装 `@tiptap/*` 或 `tiptap-markdown`。
2. 不替换 textarea Editor。
3. 不实现 Markdown 解析或序列化代码。
4. 不升级 `ED-CAND-DATA-001` 为正式 RULE。
5. 不实现 BlockId 或 DiffDecoration。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，锁定 TipTap/Markdown 选型确认范围 |
| 2026-05-22 | v1.1 | 文档状态由 R 更正为 A（符合 ADU.md §6.3 Issue Trace 状态规则） |
