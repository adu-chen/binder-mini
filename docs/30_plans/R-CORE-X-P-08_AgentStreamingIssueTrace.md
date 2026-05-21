---
文档编号：   CORE-X-P-08
文档状态：   R
负责模块：   AG
文档职责：   Agent流式响应范围
上游约束：   ADP.md、SYS-C-T-01、CORE-X-P-02
直接承接：   Agent Provider MVP 流式响应
使用边界：   记录本次代码任务范围，不替代技术设计
变更要求：   Scope 扩展必须追加记录
---

# Agent Streaming Issue Trace

## 1. 任务类型

task_type: CODE_CHANGE

## 2. 任务目标

实现 Phase 4 的流式响应最小闭环：

1. 用户消息通过 Provider 配置门禁后进入发送流程。
2. Agent 创建 assistant 占位消息并按 chunk 追加内容。
3. 流式过程中 UI 展示 streaming 状态并阻止重复发送。
4. 响应完成后 assistant 消息进入 complete 状态。
5. 本阶段不引入真实 Provider 网络请求；真实 provider adapter/API key 持久化留给后续规则设计。

参考 `/Users/imatstarbucks/binder-core` 口径：消息发送应进入流式事件消费；Provider adapter 只转换 wire shape，不改变运行时事实。

## 3. 静态规则来源

- `BR-AG-STATE-001`
- `BR-AG-OBS-001`
- `BR-AG-DATA-001`
- `BR-SYS-GOV-001`
- `BR-CORE-GOV-001`

## 4. TERM 前置门禁

本任务使用已注册 TERM：

- `ToolExecution`：`TERM-AG-001`
- `InputReference`：`TERM-AG-002`

新增 `AgentStreamRequest`、`AgentStreamChunk` 为 Agent 消息流技术结构，不单独注册 TERM。

## 5. Scope Lock

allowed_files:

- `docs/30_plans/R-CORE-X-P-08_AgentStreamingIssueTrace.md` # 本 Issue Trace
- `src/types/agent.ts` # 流式消息类型扩展
- `src/services/agentService.ts` # 流式响应服务
- `src/App.tsx` # Agent 流式 UI 接入
- `src/index.css` # Agent 流式 UI 样式
- `tests/agentService.test.ts` # Agent 流式测试
- `docs/00_core/A-CORE-C-R-01_ADUS.md` # 自动生成索引
- `vite.config.ts` # 本地 Tauri dev server 固定端口配置

forbidden_files:

- `ADU.md`
- `ADP.md`
- `CLAUDE.md`
- `docs/00_core/A-CORE-C-P-01_APC.md`
- `docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md`

confirmation: YES

scope_reason: Phase 4 当前步骤为 Agent 消息流式响应，可由现有 AG-SEND-MESSAGE 规则和 agentMachine streaming 状态覆盖。

## Allowed Files

- docs/30_plans/R-CORE-X-P-08_AgentStreamingIssueTrace.md
- src/types/agent.ts
- src/services/agentService.ts
- src/App.tsx
- src/index.css
- tests/agentService.test.ts
- docs/00_core/A-CORE-C-R-01_ADUS.md
- vite.config.ts

## Forbidden Files

- ADU.md
- ADP.md
- CLAUDE.md
- docs/00_core/A-CORE-C-P-01_APC.md
- docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md

## Expected Behavior

Agent 发送消息后，assistant 消息按 chunk 逐步显示；发送中不能重复发送；完成后消息状态为 complete。本阶段不向真实 Provider 发起网络请求。

## Validation Commands

- npm run governance:generate
- npm run governance:audit -- --issue docs/30_plans/R-CORE-X-P-08_AgentStreamingIssueTrace.md
- npm run check:ts
- npm run test
- npm run build

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，记录 Agent 流式响应 Scope Lock |
