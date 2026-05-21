---
文档编号：   CORE-X-P-13
文档状态：   R
负责模块：   CORE,WS,SYS
文档职责：   Workspace 颗粒度补齐 Issue Trace
上游约束：   CORE-C-P-01、CORE-X-P-12
直接承接：   WS-M-D-01、SYS-C-T-01、SYS-C-T-02
使用边界：   限定 Phase 7-A 文档补齐范围，不允许进入运行时代码实现
变更要求：   范围变化必须先更新本 Issue Trace
---

# Workspace 颗粒度补齐 Issue Trace

## 1. Issue

执行 `CORE-X-P-12` 的 `Phase 7-A：补 Workspace 功能主控与技术设计`。

本 Issue 只补齐 Workspace 需求颗粒度、需求到技术规则的映射方式和后续实现候选规则，不写运行时代码。

## Allowed Files

- docs/30_plans/R-CORE-X-P-13_WorkspaceDesignGranularityIssueTrace.md
- docs/10_requirements/A-WS-M-D-01_Workspace功能主控.md
- docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md
- docs/20_design/R-SYS-C-T-02_需求规则映射矩阵.md
- docs/00_core/A-CORE-C-R-01_ADUS.md
- "docs/10_requirements/A-WS-M-D-01_Workspace\345\212\237\350\203\275\344\270\273\346\216\247.md"
- "docs/20_design/A-SYS-C-T-01_\347\263\273\347\273\237\346\212\200\346\234\257\350\256\276\350\256\241\344\270\216\350\247\204\345\210\231\346\272\220.md"
- "docs/20_design/R-SYS-C-T-02_\351\234\200\346\261\202\350\247\204\345\210\231\346\230\240\345\260\204\347\237\251\351\230\265.md"

## Forbidden Files

- src/**
- src-tauri/**
- tests/**
- package.json
- package-lock.json

## 3. 决策

1. 需求描述层使用 `REQ-*` 作为需求 ID，不使用技术规则 `RULE` ID。
2. 技术设计层使用 `RULE`、`CHAIN`、`CONSTRAINT`、`TERM` 作为代码规则来源。
3. 已注册技术规则通过映射矩阵承接一个或多个 `REQ-*`。
4. 运行时代码只允许映射到已注册技术规则；需求 ID 是上游来源，不直接替代 `@GOV` 规则映射。
5. 未进入实现和测试的 Workspace 细颗粒度规则先作为候选规则列入技术设计，不登记为 RULE 注释块。

## Expected Behavior

1. Workspace 功能主控文档已新增，并给出稳定需求 ID。
2. 技术设计文档已说明需求到规则的映射约定。
3. 映射矩阵已覆盖当前 Workspace 相关需求与已注册技术规则。
4. 治理生成与治理审计通过。

## Validation Commands

- npm run governance:generate
- npm run governance:audit -- --issue docs/30_plans/R-CORE-X-P-13_WorkspaceDesignGranularityIssueTrace.md

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，锁定 Phase 7-A 文档补齐范围 |
