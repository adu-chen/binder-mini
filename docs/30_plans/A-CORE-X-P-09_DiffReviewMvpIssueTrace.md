---
文档编号：   CORE-X-P-09
文档状态：   R
负责模块：   DE
文档职责：   Diff Review MVP范围
上游约束：   ADP.md、SYS-C-T-01、CORE-X-P-02
直接承接：   Phase 5 Diff Review MVP
使用边界：   记录本次代码任务范围，不替代技术设计
变更要求：   Scope 扩展必须追加记录
---

# Diff Review MVP Issue Trace

## 1. 任务类型

task_type: CODE_CHANGE

## 2. 任务目标

实现 Phase 5 的最小 Diff Review 闭环：

1. `edit_current_editor_document` 只能作用于当前打开的 editable EditorDocument。
2. 编辑工具生成 `PendingDiff`，不得直接写入文件。
3. UI 展示 diff card，包含原文、候选文本、状态和操作。
4. Accept 后才写入当前文件并生成 accepted 终态卡。
5. Reject 后不写文件并生成 rejected 终态卡。
6. 当前文件内容变化导致 pending diff 的 originalText 不匹配时，进入 expired 终态。

参考 `/Users/imatstarbucks/binder-core` 口径：`edit_current_editor_document` 的执行目标由 runtime current editor 决定，不接受模型自报路径；工具结果语义是创建 ReviewChangeState/PendingDiff，不表示 saved_to_disk。

## 3. 静态规则来源

- `BR-DE-STATE-001`
- `BR-DE-PERSIST-001`
- `BR-DE-STATE-002`
- `BR-DE-STATE-003`
- `BR-AG-OBS-001`
- `BR-CORE-GOV-001`

## 4. TERM 前置门禁

本任务使用已注册 TERM：

- `PendingDiff`：`TERM-DE-001`
- `TerminalDiffCard`：`TERM-DE-002`
- `ToolExecution`：`TERM-AG-001`

新增 `EditCurrentEditorDocumentRequest` 为 Diff Review 技术结构，不单独注册 TERM。

## 5. Scope Lock

allowed_files:

- `docs/30_plans/R-CORE-X-P-09_DiffReviewMvpIssueTrace.md` # 本 Issue Trace
- `src/types/diff.ts` # PendingDiff 请求结构扩展
- `src/types/agent.ts` # edit_current_editor_document ToolName 扩展
- `src/services/diffService.ts` # PendingDiff 生命周期服务
- `src/App.tsx` # diff card 和交互接入
- `src/index.css` # diff card 样式
- `tests/diffService.test.ts` # Diff Review 服务测试
- `tests/governance.phase2.test.ts` # 既有治理骨架覆盖更新
- `docs/00_core/A-CORE-C-R-01_ADUS.md` # 自动生成索引

forbidden_files:

- `ADU.md`
- `ADP.md`
- `CLAUDE.md`
- `docs/00_core/A-CORE-C-P-01_APC.md`
- `docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md`

confirmation: YES

scope_reason: Phase 5 当前步骤由已注册 DE-CREATE-DIFF、DE-ACCEPT-DIFF、DE-REJECT-DIFF、DE-EXPIRE-DIFF 链路和 diffMachine 覆盖。

## Allowed Files

- docs/30_plans/R-CORE-X-P-09_DiffReviewMvpIssueTrace.md
- src/types/diff.ts
- src/types/agent.ts
- src/services/diffService.ts
- src/App.tsx
- src/index.css
- tests/diffService.test.ts
- tests/governance.phase2.test.ts
- docs/00_core/A-CORE-C-R-01_ADUS.md

## Forbidden Files

- ADU.md
- ADP.md
- CLAUDE.md
- docs/00_core/A-CORE-C-P-01_APC.md
- docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md

## Expected Behavior

用户可对当前 editable 文档生成 pending diff；只有点击 Accept 后才写入文件；Reject 不改变文件；若原文已变化，pending diff 进入 expired，不能再接受。

## Validation Commands

- npm run governance:generate
- npm run governance:audit -- --issue docs/30_plans/R-CORE-X-P-09_DiffReviewMvpIssueTrace.md
- npm run check:ts
- npm run test
- npm run build

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，记录 Diff Review MVP Scope Lock |
