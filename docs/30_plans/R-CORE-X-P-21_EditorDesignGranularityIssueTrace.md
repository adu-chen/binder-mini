---
文档编号：   CORE-X-P-21
文档状态：   R
负责模块：   CORE,ED,SYS
文档职责：   Editor 颗粒度补齐 Issue Trace
上游约束：   CORE-C-P-01、CORE-X-P-12、binder-core/A-ED-M-D-01、binder-core/A-ED-M-T-01
直接承接：   ED-M-D-01、ED-M-T-01、SYS-C-T-02
使用边界：   限定 Phase 9-A Editor 需求与技术设计补齐，不进入 TipTap 运行时代码实现
变更要求：   范围变化必须先更新本 Issue Trace
---

# Editor 颗粒度补齐 Issue Trace

## 1. Issue

执行 `CORE-X-P-12` 的 `Phase 9：Editor 颗粒度对齐` 第一段：补齐 Editor 多标签、dirty、TipTap/Markdown、BlockId 和 DiffDecoration 的需求与技术设计。

本 Issue 只建立下一轮实现的规则来源，不写运行时代码。

## Allowed Files

- docs/30_plans/R-CORE-X-P-21_EditorDesignGranularityIssueTrace.md
- docs/10_requirements/A-ED-M-D-01_Editor功能主控.md
- docs/20_design/R-ED-M-T-01_Editor技术架构.md
- docs/20_design/R-SYS-C-T-02_需求规则映射矩阵.md
- docs/00_core/A-CORE-C-R-01_ADUS.md
- "docs/10_requirements/A-ED-M-D-01_Editor\345\212\237\350\203\275\344\270\273\346\216\247.md"
- "docs/20_design/R-ED-M-T-01_Editor\346\212\200\346\234\257\346\236\266\346\236\204.md"
- "docs/20_design/R-SYS-C-T-02_\351\234\200\346\261\202\350\247\204\345\210\231\346\230\240\345\260\204\347\237\251\351\230\265.md"

## Forbidden Files

- src/**
- src-tauri/**
- tests/**
- package.json
- package-lock.json

## 2. 决策

1. Phase 9 的第一步先补文档规则来源；TipTap、BlockId、DiffDecoration 运行时实现必须另开 Issue Trace。
2. Editor 需求描述层使用 `REQ-ED-*`，不直接作为代码 `@GOV` 规则目标。
3. 现有 `BR-ED-STATE-001` 和 `BR-ED-PERSIST-001` 继续覆盖 md/txt 打开与保存 MVP。
4. 多标签、dirty 关闭保护、Markdown 转换、BlockId、DiffDecoration 暂列为候选技术规则，待实现前升级为正式 RULE 并补测试覆盖。
5. BlockId 只能由 Editor Runtime 生成或校验，模型输出不得成为执行权威。

## Expected Behavior

1. 新增 Editor 功能主控需求文档，覆盖 Phase 9 颗粒度。
2. 新增 Editor 技术架构草稿，定义多标签状态、TipTap/Markdown、BlockId、DiffDecoration 设计边界。
3. 映射矩阵新增 Editor 需求与已注册规则 / 候选规则追踪。
4. 治理生成与治理审计通过。

## Validation Commands

- npm run governance:generate
- npm run governance:audit -- --issue docs/30_plans/R-CORE-X-P-21_EditorDesignGranularityIssueTrace.md

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，锁定 Phase 9-A Editor 设计颗粒度补齐范围 |
