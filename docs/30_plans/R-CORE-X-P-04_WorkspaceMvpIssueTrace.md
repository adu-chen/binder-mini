---
文档编号：   CORE-X-P-04
文档状态：   R
负责模块：   WS
文档职责：   WorkspaceMVP范围
上游约束：   ADP.md、SYS-C-T-01、CORE-X-P-02
直接承接：   Workspace MVP 实现
使用边界：   记录本次代码任务范围，不替代技术设计
变更要求：   Scope 扩展必须追加记录
---

# Workspace MVP Issue Trace

## 1. 任务类型

task_type: CODE_CHANGE

## 2. 任务目标

实现 Workspace MVP 的最小可运行链路：

1. 前端可以请求选择本地目录。
2. Tauri 后端返回 Workspace 信息和首层文件树。
3. 前端展示 Workspace 名称、路径和文件列表。
4. 路径处理必须保持在 Workspace 边界内。

## 3. 静态规则来源

- `BR-WS-STATE-001`
- `BR-WS-DATA-001`
- `BR-SYS-GOV-001`
- `BR-CORE-GOV-001`
- `X-CONST-001`

## 4. TERM 前置门禁

本任务使用已注册 TERM：

- `Workspace`：`TERM-CORE-001`

新增 `WorkspaceEntry`、`WorkspaceSnapshot`、`WorkspaceOpenResult` 为 Workspace 功能分支/传输结构，不单独注册 TERM。

## 5. Scope Lock

allowed_files:

- `docs/30_plans/R-CORE-X-P-04_WorkspaceMvpIssueTrace.md` # 本 Issue Trace
- `src/types/workspace.ts` # Workspace 数据结构扩展
- `src/services/workspaceService.ts` # Workspace 前端服务边界
- `src/App.tsx` # 最小 Workspace UI 接入
- `src/index.css` # Workspace UI 样式
- `src-tauri/Cargo.toml` # Tauri dialog 插件依赖
- `src-tauri/src/lib.rs` # Workspace Tauri command
- `tests/governance.phase2.test.ts` # 既有规则测试更新
- `tests/workspaceService.test.ts` # Workspace 服务测试
- `docs/00_core/A-CORE-C-R-01_ADUS.md` # 自动生成索引

forbidden_files:

- `ADU.md` # 通用治理规则源，本任务不修改
- `ADP.md` # 运行时协议，本任务不修改
- `CLAUDE.md` # AI 会话协议，本任务不修改
- `docs/00_core/A-CORE-C-P-01_APC.md` # APC 本任务不修改
- `docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md` # 当前规则足够，本任务不扩展规则

confirmation: YES

scope_reason: Phase 3 第一段只实现 Workspace 打开和文件树读取，现有 WS 规则足够覆盖。

## Allowed Files

- docs/30_plans/R-CORE-X-P-04_WorkspaceMvpIssueTrace.md
- src/types/workspace.ts
- src/services/workspaceService.ts
- src/App.tsx
- src/index.css
- src-tauri/Cargo.toml
- src-tauri/src/lib.rs
- tests/governance.phase2.test.ts
- tests/workspaceService.test.ts
- docs/00_core/A-CORE-C-R-01_ADUS.md

## Forbidden Files

- ADU.md
- ADP.md
- CLAUDE.md
- docs/00_core/A-CORE-C-P-01_APC.md
- docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md

## Expected Behavior

Workspace MVP 完成后，前端可以通过 Tauri command 打开目录并展示首层文件树；Workspace 路径边界判断和文件树排序由测试覆盖。

## Validation Commands

- npm run governance:generate
- npm run governance:audit -- --issue docs/30_plans/R-CORE-X-P-04_WorkspaceMvpIssueTrace.md
- npm run check:ts
- npm run test
- npm run check:rust
- npm run build

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，记录 Workspace MVP Scope Lock |
