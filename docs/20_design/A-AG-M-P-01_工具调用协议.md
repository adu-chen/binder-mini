---
文档编号：   AG-M-P-01
文档状态：   A
负责模块：   AG
文档职责：   Agent 工具调用协议与工具矩阵
上游约束：   CORE-C-P-01、AG-M-D-01、AG-M-T-01、SYS-C-T-01
直接承接：   agentService、ToolExecution 实现、Phase 10-12 Issue Trace
使用边界：   定义工具分类、调用协议、边界约束和结果回流，不写运行时代码
变更要求：   工具增删、输入输出变更、执行路由变更时必须同步本文和 SYS-C-T-01
---

## 1. 本文职责

本文定义 Agent 可调用的工具矩阵、每个工具的输入输出边界、执行路由（直接执行 vs diff 路由 vs 冲突确认），以及工具结果回流协议。

## 2. 工具分类

| 类别 | 工具 | 特征 |
|------|------|------|
| 只读工具 | read_file、list_files、search_files | 不改变 Workspace 内容 |
| 结构工具 | create_file、create_folder、rename_file、move_file、delete_file | 改变文件树结构（Phase 11）|
| 内容写工具 | edit_current_editor_document、update_file | 改变文件内容，必须先生成 PendingDiff |

## 3. 工具矩阵

| 工具 | 输入 | 输出 | 执行方式 | 实现阶段 | 风险等级 |
|------|------|------|----------|----------|----------|
| read_file | workspacePath、filePath | 文件内容 | 直接执行 | Phase 9（已有）| 低 |
| list_files | workspacePath、dirPath? | 文件/目录列表 | 直接执行 | Phase 9（已有）| 低 |
| search_files | workspacePath、query | 搜索结果列表 | 直接执行 | Phase 9（已有）| 低 |
| create_file | workspacePath、filePath、content? | 创建结果 | 直接执行 | Phase 11 | 中 |
| create_folder | workspacePath、folderPath | 创建结果 | 直接执行 | Phase 11 | 中 |
| rename_file | workspacePath、oldPath、newPath | 重命名结果 / PathConflict | 冲突返回确认态 | Phase 11 | 中 |
| move_file | workspacePath、fromPath、toPath | 移动结果 / PathConflict | 冲突返回确认态 | Phase 11 | 中 |
| delete_file | workspacePath、filePath | 删除结果 | 识别到明确删除意图后直接执行 | Phase 11 | 高 |
| edit_current_editor_document | proposedText、summary | PendingDiff 创建结果 | 走 Diff Review 链路 | Phase 9（已有）| 中 |
| update_file | workspacePath、filePath、proposedText、summary | PendingDiff 创建结果 | 走 Diff Review 链路；不得用于已打开文档 | Phase 11 | 中 |

## 4. 执行协议

### 4.1 通用前置校验

所有工具执行前必须满足：
1. workspaceMachine 处于 active 状态
2. 工具目标路径位于当前 workspaceRoot 内（边界校验）
3. 输入参数结构完整

边界校验失败时，工具必须返回结构化拒绝结果，不产生任何副作用。

### 4.2 内容写工具协议

edit_current_editor_document 和 update_file 必须满足（承接 AG-M-T-01 §5 候选规则 AG-CAND-DATA-002）：
1. 不直接写磁盘
2. 必须先生成 PendingDiff（经 DE 模块路由）
3. PendingDiff 由用户接受后才能写入文件

**edit_current_editor_document 特殊约束**：
- 执行目标以当前编辑器 active 文件为权威（由运行时注入，模型不得自报路径）
- 模型可提供：proposedText（完整替换内容）、summary（人类可读描述）
- 模型不得提供：filePath、blockId、offset 等定位字段（这些由运行时解析）

**update_file 使用限制**：
- 只能用于当前未打开的 Workspace 文件
- 不得用于 active editor 文档、dirty 文档、已打开但非 active 的文档

### 4.3 删除工具协议

delete_file 必须满足：
1. 识别到用户明确删除意图后可直接执行（不要求二次 diff 确认）
2. 执行前仍需通过 workspace active 和路径边界校验
3. 执行结果必须包含可审计字段（目标路径、时间戳）

### 4.4 结构冲突确认协议

rename_file、move_file 遇到目标路径已存在时：
1. 先返回 PathConflict（含原始参数），不直接覆盖
2. 进入确认态，由用户选择覆盖、改名或取消
3. 未确认前不得落盘

## 5. 工具结果回流

所有工具执行完成后，必须返回结构化结果，格式：

```typescript
interface ToolResult {
  tool: ToolName;
  callId: string;      // 关联 ToolExecution.id
  ok: boolean;
  summary: string;     // 人类可读摘要
  data?: unknown;      // 结构化数据载荷
}
```

工具结果作为 tool_result 事件注入当前对话轮次（AG-M-T-01 §3.4 SSE 协议），不作为 user message 注入对话历史。

binder-mini 的 SSE 协议基于 Tauri 事件（chat-stream-event），工具结果通过同一事件通道回流，不使用 HTTP SSE。

## 6. 工具边界约束矩阵

| 约束场景 | 受约束工具 | 约束来源 | 处理 |
|----------|------------|----------|------|
| 路径越界 | 所有工具 | X-CONST-001 | 返回 PathConflict / 拒绝 |
| Workspace 未 active | 所有工具 | BR-WS-STATE-001 | 拒绝，返回"无活跃 Workspace"错误 |
| 内容编辑不经 Diff | edit_current_editor_document、update_file | BR-DE-STATE-001 | 阻断，必须路由到 DE 创建 PendingDiff |
| update_file 用于已打开文档 | update_file | AG-M-T-01 §4.2 | 返回结构化 blocked result |
| 路径冲突未确认 | rename_file、move_file | BR-WS-DATA-004 | 返回 PathConflict 确认态 |
| 无明确删除意图 | delete_file | AG-M-T-01 §4.3 | 拒绝，要求用户明确意图 |

## 7. 与其他模块的关系

| 对接模块 | 关系 |
|----------|------|
| WS | 结构工具通过 Workspace command 执行；路径边界由 WS 校验 |
| DE | 内容写工具输出 PendingDiff，不直接写盘 |
| ED | edit_current_editor_document 的执行目标由 ED 的 active 文件提供 |
| agentMachine | 工具调用状态通过 toolCalling 状态管理；结果通过 SSE tool_result 事件回流 |

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-23 | v1.0 | 初始版本，定义 binder-mini 工具调用协议和矩阵（参考 binder-core AG-M-P-01 适配本项目架构）|
