---
文档编号：   CORE-X-P-03
文档状态：   R
负责模块：   CORE
文档职责：   Phase2范围锁定
上游约束：   ADP.md、SYS-C-T-01、CORE-X-P-02
直接承接：   工程骨架创建
使用边界：   记录本次代码任务范围，不替代开发计划
变更要求：   Scope 扩展必须追加记录
---

# Phase 2 工程骨架 Issue Trace

## 1. 任务类型

task_type: CODE_CHANGE

## 2. 任务目标

创建 Binder Mini 的最小工程骨架，覆盖 React / TypeScript / Tauri / 状态机 / 测试入口，并为首批骨架代码建立 @GOV 映射。

## 3. 静态规则来源

- `docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md`
- `docs/00_core/A-CORE-C-R-01_ADUS.md`

## 4. TERM 前置门禁

本次新增 exported type / interface 均属于已注册 TERM 或技术实现词汇：

- `Workspace`：已注册 `TERM-CORE-001`
- `PendingDiff`：已注册 `TERM-DE-001`
- `TerminalDiffCard`：已注册 `TERM-DE-002`
- `ToolExecution`：已注册 `TERM-AG-001`
- `InputReference`：已注册 `TERM-AG-002`
- machine state/event 类型：技术实现词汇，不注册 TERM

## 5. Scope Lock

allowed_files:

- `package.json` # 补齐工程脚本和依赖声明
- `package-lock.json` # npm 依赖锁文件
- `.gitignore` # 定义 git 忽略规则
- `index.html` # Vite 入口
- `tsconfig.json` # TypeScript 配置
- `tsconfig.node.json` # Vite Node 配置
- `vite.config.ts` # Vite/Vitest 配置
- `src/main.tsx` # React 入口
- `src/App.tsx` # 最小应用骨架
- `src/index.css` # 最小样式
- `src/vite-env.d.ts` # Vite 类型声明
- `src/types/workspace.ts` # Workspace 类型
- `src/types/editor.ts` # Editor 类型
- `src/types/agent.ts` # Agent 类型
- `src/types/diff.ts` # Diff 类型
- `src/machines/workspaceMachine.ts` # workspace 状态机骨架
- `src/machines/editorMachine.ts` # editor 状态机骨架
- `src/machines/agentMachine.ts` # agent 状态机骨架
- `src/machines/diffMachine.ts` # diff 状态机骨架
- `src/services/workspaceService.ts` # workspace 服务边界骨架
- `src/services/editorService.ts` # editor 服务边界骨架
- `src/services/agentService.ts` # agent 服务边界骨架
- `src/services/diffService.ts` # diff 服务边界骨架
- `tests/governance.phase2.test.ts` # 首批规则 covers 骨架
- `src-tauri/Cargo.toml` # Rust 包配置
- `src-tauri/build.rs` # Tauri build 脚本
- `src-tauri/tauri.conf.json` # Tauri 配置
- `src-tauri/icons/icon.png` # Tauri 编译所需占位图标
- `src-tauri/src/main.rs` # Tauri 入口
- `src-tauri/src/lib.rs` # Tauri 命令骨架
- `docs/30_plans/R-CORE-X-P-03_Phase2工程骨架IssueTrace.md` # 本 Issue Trace
- `docs/00_core/A-CORE-C-R-01_ADUS.md` # 自动生成索引

forbidden_files:

- `ADU.md` # 通用治理规则源，本任务不修改
- `ADP.md` # 运行时协议，本任务不修改
- `CLAUDE.md` # AI 会话协议，本任务不修改
- `docs/00_core/A-CORE-C-P-01_APC.md` # APC 已确认，本任务不修改

confirmation: YES

scope_reason: 用户要求继续下一步开发，Phase 2 计划已定义工程骨架和首批 @GOV 接入范围。

## 6. 预期验证

- `npm run governance:generate`
- `npm run governance:audit`
- `npm run check:ts`，若依赖未安装则记录为 blocked/skipped
- `npm run test`，若依赖未安装则记录为 blocked/skipped

## Allowed Files

- package.json
- package-lock.json
- .gitignore
- index.html
- tsconfig.json
- tsconfig.node.json
- vite.config.ts
- src/main.tsx
- src/App.tsx
- src/index.css
- src/vite-env.d.ts
- src/types/workspace.ts
- src/types/editor.ts
- src/types/agent.ts
- src/types/diff.ts
- src/machines/workspaceMachine.ts
- src/machines/editorMachine.ts
- src/machines/agentMachine.ts
- src/machines/diffMachine.ts
- src/services/workspaceService.ts
- src/services/editorService.ts
- src/services/agentService.ts
- src/services/diffService.ts
- tests/governance.phase2.test.ts
- src-tauri/Cargo.toml
- src-tauri/build.rs
- src-tauri/tauri.conf.json
- src-tauri/icons/icon.png
- src-tauri/src/main.rs
- src-tauri/src/lib.rs
- docs/30_plans/R-CORE-X-P-03_Phase2工程骨架IssueTrace.md
- docs/00_core/A-CORE-C-R-01_ADUS.md

## Forbidden Files

- ADU.md
- ADP.md
- CLAUDE.md
- docs/00_core/A-CORE-C-P-01_APC.md

## Expected Behavior

工程骨架创建后，ADUS 能索引首批 @GOV，规则和链路均有代码 owner，测试文件包含首批规则的 covers 注释。

## Validation Commands

- npm run governance:generate
- npm run governance:audit -- --issue docs/30_plans/R-CORE-X-P-03_Phase2工程骨架IssueTrace.md
- npm run check:ts
- npm run test

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，记录 Phase 2 工程骨架 Scope Lock |
