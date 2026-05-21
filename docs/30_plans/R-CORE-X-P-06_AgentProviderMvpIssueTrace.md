---
文档编号：   CORE-X-P-06
文档状态：   R
负责模块：   AG
文档职责：   AgentProviderMVP范围
上游约束：   ADP.md、SYS-C-T-01、CORE-X-P-02
直接承接：   Agent 与 Provider MVP 实现
使用边界：   记录本次代码任务范围，不替代技术设计
变更要求：   Scope 扩展必须追加记录
---

# Agent Provider MVP Issue Trace

## 1. 任务类型

task_type: CODE_CHANGE

## 2. 任务目标

实现 Phase 4 的最小可验证 Agent 与 Provider MVP：

1. 用户可以在右侧 Agent 面板配置 Provider、Model、API Key 是否已配置。
2. Provider 缺失或无效时，消息发送被阻断。
3. 用户可以输入消息并提交到本地消息流。
4. 提交消息时创建 ToolExecution 记录，作为后续 read_file/list_files/search_files 接入点。
5. InputReference 仍保持只读语义。

真实 AI Provider 流式请求和真实工具执行不在本次 Scope 内，需后续补接口协议和 Provider 调用规则。

## 3. 静态规则来源

- `BR-AG-STATE-001`
- `BR-AG-OBS-001`
- `BR-AG-DATA-001`
- `BR-CORE-GOV-001`
- `X-CONST-001`

## 4. TERM 前置门禁

本任务使用已注册 TERM：

- `ToolExecution`：`TERM-AG-001`
- `InputReference`：`TERM-AG-002`

新增 `AgentMessage` 为 Agent 消息技术结构，不单独注册 TERM。

## 5. Scope Lock

allowed_files:

- `docs/30_plans/R-CORE-X-P-06_AgentProviderMvpIssueTrace.md` # 本 Issue Trace
- `src/types/agent.ts` # Agent 数据结构扩展
- `src/services/agentService.ts` # Agent 服务逻辑
- `src/App.tsx` # Agent UI 接入
- `src/index.css` # Agent UI 样式
- `tests/governance.phase2.test.ts` # 既有规则测试更新
- `tests/agentService.test.ts` # Agent 服务测试
- `docs/00_core/A-CORE-C-R-01_ADUS.md` # 自动生成索引

forbidden_files:

- `ADU.md`
- `ADP.md`
- `CLAUDE.md`
- `docs/00_core/A-CORE-C-P-01_APC.md`
- `docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md`
- `src-tauri/src/lib.rs` # 本次不接真实后端 Provider 请求

confirmation: YES

scope_reason: Phase 4 当前先实现 Provider 配置、消息输入和 ToolExecution 记录，现有 AG 规则足够覆盖。

## Allowed Files

- docs/30_plans/R-CORE-X-P-06_AgentProviderMvpIssueTrace.md
- src/types/agent.ts
- src/services/agentService.ts
- src/App.tsx
- src/index.css
- tests/governance.phase2.test.ts
- tests/agentService.test.ts
- docs/00_core/A-CORE-C-R-01_ADUS.md

## Forbidden Files

- ADU.md
- ADP.md
- CLAUDE.md
- docs/00_core/A-CORE-C-P-01_APC.md
- docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md
- src-tauri/src/lib.rs

## Expected Behavior

Agent Provider MVP 完成后，Provider 配置有效时用户消息进入本地消息流，并创建 ToolExecution 记录；Provider 无效时发送被阻断。

## Validation Commands

- npm run governance:generate
- npm run governance:audit -- --issue docs/30_plans/R-CORE-X-P-06_AgentProviderMvpIssueTrace.md
- npm run check:ts
- npm run test
- npm run check:rust
- npm run build

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，记录 Agent Provider MVP Scope Lock |
