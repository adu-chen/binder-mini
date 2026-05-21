---
文档编号：   CORE-X-P-05
文档状态：   R
负责模块：   ED
文档职责：   EditorMVP范围
上游约束：   ADP.md、SYS-C-T-01、CORE-X-P-02
直接承接：   Editor MVP 实现
使用边界：   记录本次代码任务范围，不替代技术设计
变更要求：   Scope 扩展必须追加记录
---

# Editor MVP Issue Trace

## 1. 任务类型

task_type: CODE_CHANGE

## 2. 任务目标

实现 Phase 3 的 Editor MVP：

1. 从 Workspace 文件树点击文件打开内容。
2. md/txt 文件进入 editable 模式。
3. 其他文件进入 readonly 模式。
4. editable 文件可修改并保存回当前文件。
5. 所有读写路径必须受 Workspace 边界约束。

## 3. 静态规则来源

- `BR-ED-STATE-001`
- `BR-ED-PERSIST-001`
- `BR-WS-DATA-001`
- `BR-CORE-GOV-001`
- `X-CONST-001`

## 4. TERM 前置门禁

本任务使用已注册 TERM：

- `Workspace`：`TERM-CORE-001`

新增 `EditorOpenRequest`、`EditorSaveRequest` 为 Editor 技术传输结构，不单独注册 TERM。

## 5. Scope Lock

allowed_files:

- `docs/30_plans/R-CORE-X-P-05_EditorMvpIssueTrace.md` # 本 Issue Trace
- `src/types/editor.ts` # Editor 数据结构扩展
- `src/services/editorService.ts` # Editor 前端服务边界
- `src/App.tsx` # Editor UI 接入
- `src/index.css` # Editor UI 样式
- `src-tauri/src/lib.rs` # Editor Tauri command
- `tests/governance.phase2.test.ts` # 既有规则测试更新
- `tests/editorService.test.ts` # Editor 服务测试
- `docs/00_core/A-CORE-C-R-01_ADUS.md` # 自动生成索引

forbidden_files:

- `ADU.md`
- `ADP.md`
- `CLAUDE.md`
- `docs/00_core/A-CORE-C-P-01_APC.md`
- `docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md`

confirmation: YES

scope_reason: Phase 3 当前剩余步骤为打开文件、区分可编辑/只读模式、保存当前文件，现有 ED/WS 规则足够覆盖。

## Allowed Files

- docs/30_plans/R-CORE-X-P-05_EditorMvpIssueTrace.md
- src/types/editor.ts
- src/services/editorService.ts
- src/App.tsx
- src/index.css
- src-tauri/src/lib.rs
- tests/governance.phase2.test.ts
- tests/editorService.test.ts
- docs/00_core/A-CORE-C-R-01_ADUS.md

## Forbidden Files

- ADU.md
- ADP.md
- CLAUDE.md
- docs/00_core/A-CORE-C-P-01_APC.md
- docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md

## Expected Behavior

Editor MVP 完成后，用户可以点击 Workspace 文件列表中的文件打开内容；md/txt 文件可编辑并保存，其他文件只读打开且不能保存。

## Validation Commands

- npm run governance:generate
- npm run governance:audit -- --issue docs/30_plans/R-CORE-X-P-05_EditorMvpIssueTrace.md
- npm run check:ts
- npm run test
- npm run check:rust
- npm run build

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，记录 Editor MVP Scope Lock |
