---
文档编号：   CORE-X-P-19
文档状态：   R
负责模块：   CORE,WS,SYS
文档职责：   Workspace 搜索索引设计 Issue Trace
上游约束：   CORE-C-P-01、CORE-X-P-12、WS-M-D-01、SYS-C-T-01
直接承接：   WS-M-T-01、后续搜索索引实现 Issue Trace
使用边界：   限定 FTS5 搜索索引方案设计，不替换运行时递归搜索
变更要求：   范围变化必须先更新本 Issue Trace
---

# Workspace 搜索索引设计 Issue Trace

## 1. Issue

执行 `Phase 8：Workspace 硬范围` 的搜索索引方案第一步：先设计 FTS5，再替换递归搜索。

本 Issue 只补技术方案和映射状态，不引入 Rust SQLite 依赖，不修改运行时代码。

## Allowed Files

- docs/30_plans/R-CORE-X-P-19_WorkspaceSearchIndexDesignIssueTrace.md
- docs/20_design/R-WS-M-T-01_Workspace搜索索引FTS5方案.md
- docs/20_design/R-SYS-C-T-02_需求规则映射矩阵.md
- "docs/20_design/R-SYS-C-T-02_\351\234\200\346\261\202\350\247\204\345\210\231\346\230\240\345\260\204\347\237\251\351\230\265.md"
- "docs/20_design/R-WS-M-T-01_Workspace\346\220\234\347\264\242\347\264\242\345\274\225FTS5\346\226\271\346\241\210.md"

## Forbidden Files

- package.json
- package-lock.json
- src/**
- src-tauri/**
- tests/**
- docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md
- docs/00_core/A-CORE-C-R-01_ADUS.md

## Expected Behavior

1. FTS5 搜索索引方案明确数据表、重建流程、查询流程和降级策略。
2. 方案明确搜索结果仍必须限制在当前 Workspace 内。
3. 方案明确 `.binder` 内部数据不进入搜索索引。
4. 映射矩阵标记 `REQ-WS-010` 已完成方案设计，正式规则仍待实现时升级。
5. 治理审计通过。

## Validation Commands

- npm run governance:audit -- --issue docs/30_plans/R-CORE-X-P-19_WorkspaceSearchIndexDesignIssueTrace.md

## 2. 不做范围

1. 不添加 `rusqlite` 或其他 SQLite 依赖。
2. 不修改 `search_files` 运行时实现。
3. 不新增正式 RULE 注释块。
4. 不修改测试文件。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，锁定 Workspace FTS5 搜索索引设计范围 |
