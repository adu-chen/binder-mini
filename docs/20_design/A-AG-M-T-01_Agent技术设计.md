---
文档编号：   AG-M-T-01
文档状态：   A
负责模块：   AG
文档职责：   Agent 技术设计与 Phase 10-12 方案
上游约束：   CORE-C-P-01、AG-M-D-01、SYS-C-T-01、SYS-C-T-02
直接承接：   Phase 10-12 Issue Trace、chatMachine、agentService 实现
使用边界：   定义 Agent 技术方案和规则来源，不写运行时代码
变更要求：   修改 Provider 协议、工具矩阵、状态机或 Prompt Runtime 策略必须同步 SYS-C-T-01 和测试
---

# Agent 技术设计

## 1. 当前实现范围（Phase 4-9 已有）

已实现的 Agent MVP 范围：

| 功能 | 实现状态 | 承接规则 |
|------|----------|----------|
| Provider 配置结构（type、model、apiKeyConfigured） | 已实现 | BR-AG-STATE-001 |
| Provider 校验门控（canSendAgentMessage） | 已实现 | BR-AG-STATE-001 |
| 本地模拟流式响应（非真实 Provider） | 已实现（临时） | BR-AG-STATE-001 |
| read_file / list_files / search_files 只读工具 | 已实现 | BR-AG-OBS-001, BR-AG-DATA-001 |
| ToolExecution 记录结构 | 已实现 | BR-AG-OBS-001 |
| InputReference 只读约束 | 已实现 | BR-AG-DATA-001 |
| AgentMessage 结构（user / assistant / system） | 已实现 | BR-AG-STATE-001 |

当前使用本地模拟流（`createAssistantStreamChunks`），**不调用真实 Provider API**。Phase 10 目标是替换为真实 SSE 流。

## 2. 状态机设计

### 2.1 chatMachine（Phase 10 目标，取代现有 agentMachine）

Agent 对话全链路由 chatMachine 驱动。完整状态机设计见 **AG-M-P-04**，本节摘要核心状态和 Phase 10 迁移要点。

```mermaid
stateDiagram-v2
    [*] --> noWorkspace
    noWorkspace --> ready : WORKSPACE_OPENED
    ready --> noWorkspace : WORKSPACE_CLOSED
    ready --> validatingProvider : SEND_MESSAGE
    validatingProvider --> sending : PROVIDER_VALID
    validatingProvider --> error : PROVIDER_INVALID
    sending --> streaming : STREAM_STARTED
    sending --> cancelling : CANCEL
    sending --> error : FAILED
    streaming --> toolCalling : TOOL_REQUESTED
    streaming --> ready : RESPONSE_DONE
    streaming --> cancelling : CANCEL
    streaming --> error : FAILED
    toolCalling --> streaming : TOOL_FINISHED
    toolCalling --> cancelling : CANCEL
    toolCalling --> error : FAILED
    cancelling --> ready : CANCEL_DONE
    cancelling --> error : ABORT_FAILED
    error --> validatingProvider : RETRY
```

状态语义：

| 状态 | 含义 | 约束 |
|------|------|------|
| `noWorkspace` | 无 Workspace，聊天不可用 | 等待 WORKSPACE_OPENED |
| `ready` | 可接收用户输入 | SEND_MESSAGE |
| `validatingProvider` | 校验 Provider 配置 | Provider 无效时转 error |
| `sending` | 已提交 Provider 请求 | 等待 STREAM_STARTED；可 CANCEL |
| `streaming` | 接收流式 token | 可被 TOOL_REQUESTED 打断；可 CANCEL |
| `toolCalling` | 执行工具调用（10s 超时）| 工具完成后返回 streaming；可 CANCEL |
| `cancelling` | 用户主动取消，等待中止确认 | 等待 CANCEL_DONE |
| `error` | 出错等待恢复 | RETRY 重新进入 validatingProvider |

### 2.2 Phase 10 迁移要求

现有 `agentMachine` 在 Phase 10 时按以下要求迁移为 `chatMachine`：

1. `idle` 状态拆分为 `noWorkspace`（无 Workspace）和 `ready`（有 Workspace）。
2. 新增 `cancelling` 状态，CANCEL 在 sending/streaming/toolCalling 任一阶段均有效。
3. 新增 WORKSPACE_OPENED / WORKSPACE_CLOSED 事件，与 workspaceMachine 联动。
4. error 状态携带错误类型：`provider_error` / `network_error` / `tool_error` / `timeout`。
5. streaming 不得在 toolCalling 完成前宣告 RESPONSE_DONE。
6. Context 扩展为完整 ChatMachineContext（见 AG-M-P-04 §5）。

## 3. 数据结构

### 3.1 ProviderConfig（已有）

```ts
interface ProviderConfig {
  provider: "openai" | "anthropic" | "deepseek";
  model: string;
  apiKeyConfigured: boolean;  // key 只在后端持有，前端不可见
}
```

约束：API key 不得出现在前端结构、日志或 Provider payload 的调试输出中。

### 3.2 AgentMessage（已有，Phase 10 扩展）

```ts
interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  streamStatus?: "streaming" | "complete" | "failed";
  // Phase 10 新增：
  toolCalls?: ToolCall[];       // 模型返回的 tool_call 列表
  toolResults?: ToolResult[];   // 本轮工具结果，同轮回流
}
```

### 3.3 ToolExecution（已有，Phase 11 扩展）

```ts
interface ToolExecution {
  id: string;
  toolName: ToolName;
  inputBoundary: string;        // 工具输入边界描述
  status: "pending" | "running" | "succeeded" | "failed";
  resultSummary?: string;
  errorMessage?: string;
  // Phase 11 新增：
  workspaceRoot: string;        // 显式记录执行边界
  callId?: string;              // 对应模型 tool_call 的 call_id
}
```

### 3.4 ToolName（Phase 11 扩展）

当前：`"read_file" | "list_files" | "search_files" | "edit_current_editor_document"`

Phase 11 新增候选：`"create_file" | "create_folder" | "rename_file" | "move_file" | "delete_file" | "update_file" | "web_search"`

所有写操作工具（create/rename/move/delete/edit/update）必须先在 DE-M-T-01 确认 Diff Review 路由协议后，才能进入工具矩阵。内容编辑工具（`edit_current_editor_document`、`update_file`）使用 `originalText + newText` 字符精确替换接口，不再使用全量 proposedText。

### 3.5 InputReference（已有，Phase 12 重构为判别联合类型）

```ts
type InputReference =
  | { id: string; kind: "file"; filePath: string; content: string; displayName: string; createdAt: number; anchor?: DocumentAnchorTarget }
  | { id: string; kind: "text"; content: string; displayName: string; createdAt: number }
  | { id: string; kind: "url"; url: string; displayName: string; createdAt: number };

interface DocumentAnchorTarget {
  blockId?: string;       // TipTap/ProseMirror 块 ID
  nodeId?: string;        // 节点 ID（降级定位）
  startOffset?: number;   // 文本偏移起点
  endOffset?: number;     // 文本偏移终点
  offsetKind?: "character" | "utf16";
}
```

约束：
- `kind` 为判别字段（discriminant），不使用 `type` 或 `mode`
- `kind: "file"` 涵盖 workspace_file 和 editor_content 两类来源
- InputReference 是结构化内容载体，不声明写权威；是否触发 Diff Review 由 Agent 根据上下文判断
- `filePath` 只用于内部查找和失效检测，不进入 provider prompt

### 3.6 PromptRuntime（Phase 12 新增候选）

```ts
interface PromptRuntime {
  workspaceRoot: string;
  activeFilePath?: string;
  allowedTools: ToolName[];           // 过滤后传给 Provider 的工具列表
  inputReferences: InputReference[];  // 只读上下文注入
  // 禁止字段：apiKey、userId、内部系统路径
}
```

## 4. Provider SSE 协议（Phase 10）

### 4.1 请求协议

后端 Tauri command `send_chat_message` 接收：

```
workspaceRoot: string
provider: ProviderConfig (不含 API key 明文)
messages: AgentMessage[]
tools: ToolDefinition[]  // 来自 allowedTools 过滤结果
```

API key 由后端 Rust 从安全存储读取，不经前端传递。

### 4.2 流式事件协议（`chat-stream-event`）

```
type: "token" | "tool_call" | "tool_result" | "done" | "error"
payload:
  token:       { content: string }
  tool_call:   { callId: string; toolName: ToolName; arguments: object }
  tool_result: { callId: string; result: string; isError: boolean }
  done:        { finishReason: "stop" | "tool_calls" | "max_tokens" }
  error:       { code: string; message: string }
```

### 4.3 工具结果回流约束

工具结果必须在同一对话轮次内以 `tool_result` 事件返回，不得以 user message 形式注入对话历史。

## 5. 工具矩阵（Phase 11）

### 5.1 只读工具（当前已有）

| 工具 | 边界约束 | 结果类型 |
|------|----------|----------|
| read_file | Workspace 边界内路径 | 文件文本内容摘要 |
| list_files | Workspace 边界内目录 | FileNode 列表 |
| search_files | Workspace 边界内搜索 | SearchResult 列表 |

### 5.2 写操作工具（Phase 11 候选，需先完成 DE-M-T-01）

| 工具 | Diff Review 路由 | 前置门禁 |
|------|-----------------|----------|
| edit_current_editor_document | 必须生成 PendingDiff | 已打开文件 |
| update_file | 必须生成 PendingDiff | 未打开文件链路 |
| create_file | 直接创建（content 参数必填，写入初始内容，不经 Diff Review）| PathConflict 检查 |
| create_folder | 直接创建 | PathConflict 检查 |
| rename_file | 结构操作 + PathConflict | 无 pending diff 影响 |
| move_file | 结构操作 + PathConflict | 无 pending diff 影响 |
| delete_file | 需明确删除意图 | 无 pending diff 影响 |

写操作工具进入实现前，必须先在 WS-M-T 和 DE-M-T-01 中注册对应规则，不得在 AG 层绕过 Diff Review 直接写文件。

## 6. Prompt Runtime（Phase 12）

### 6.1 组装约束

1. Provider-visible prompt 必须由后端 Rust 组装，不在前端明文拼接发送。
2. `allowedTools` 由 PromptRuntime 场景动态决定（依据当前 Workspace 状态和操作上下文），不由模型自行扩展，不是按 Provider 类型全局静态配置。
3. InputReference 内容只注入 system prompt L1 层（XML 块格式，见 AG-M-P-03），不替代 user message。
4. 历史裁剪时不得把工具结果注入成 user message；工具结果以 provider-native `role=tool` + `tool_call_id` 结构保留在同一轮次。
5. 禁止字段（API key、内部绝对路径、用户身份）必须在后端组装时被过滤。

### 6.2 Forbidden Provider Fields

模型不得接触以下字段：

- API key 或任何 Bearer token 原文
- 应用内部文件系统绝对路径（仅传 Workspace 相对路径）
- 用户身份标识符（若未来引入）

### 6.3 工具超时约束

单次工具调用（toolCalling 状态）超时为 **10 秒**。超时后：

1. 工具进入 `error` 终态，callId 关联的 ToolExecution 状态更新为 `failed`（reason: timeout）。
2. chatMachine 发出 FAILED 事件，转入 `error` 状态。
3. SSE 流不主动中断（等待 Provider 端自行结束或超时），chatMachine 已在 error 状态。

### 6.4 tool_result 注入协议

工具结果必须以 provider-native 结构回流同一对话轮次：

- **OpenAI**：`{ role: "tool", tool_call_id: callId, content: result }`
- **Anthropic**：content block `{ type: "tool_result", tool_use_id: callId, content: result }`

Provider Adapter 负责将统一内部 ToolResult 格式转换为各 Provider 原生格式，不得将工具结果伪装为新的 user message 注入历史。

## 7. 候选规则（Phase 10-12 进入实现前升级为正式规则）

| 候选规则 ID | 候选链路 | 来源需求 | 规则意图 |
|-------------|----------|----------|----------|
| AG-CAND-STATE-002 | AG-SEND-MESSAGE | REQ-AG-002 | 真实 Provider SSE 流必须在错误时终止并向 UI 返回可识别失败状态。 |
| AG-CAND-DATA-002 | AG-TOOL-CALL | REQ-AG-003 | 工具结果必须在同一对话轮次内以 tool_result 形式回流，不得注入为 user message。 |
| AG-CAND-DATA-003 | AG-SEND-MESSAGE | REQ-AG-007 | Provider API key 不得在前端持有、传递或出现在日志中；由后端安全存储读取。 |
| AG-CAND-STATE-003 | AG-SEND-MESSAGE | REQ-AG-007 | Agent 只能向 Provider 暴露 allowedTools 中的工具，不得暴露全部已注册工具。 |
| AG-CAND-DATA-004 | AG-TOOL-CALL | REQ-AG-006 | InputReference 只注入 Provider 请求上下文，不触发任何文件副作用。 |

## 8. 已注册正式规则引用

| 规则 ID | 主链路 | 规则意图 |
|---------|--------|----------|
| BR-AG-STATE-001 | AG-SEND-MESSAGE | Provider 缺失或无效时不得发起 AI 请求。 |
| BR-AG-OBS-001 | AG-TOOL-CALL | 工具执行必须记录名称、输入边界、状态和错误。 |
| BR-AG-DATA-001 | AG-TOOL-CALL | InputReference 是只读上下文，不触发文件写入或 diff 接受。 |

## 9. 验收标准

Phase 10 完成标准：

1. 真实 Provider SSE 流可建立、接收 token、处理 tool_call 和检测错误。
2. 流中断或 Provider 返回错误时 UI 显示明确失败状态。
3. API key 不出现在前端代码、日志或 Store 中（localStorage 存储方案下，key 不经前端组装直接传给 Provider）。
4. chatMachine 状态转移覆盖 noWorkspace / ready / validatingProvider / sending / streaming / toolCalling / cancelling / error 全路径（迁移自 agentMachine）。
5. 工具调用 10s 超时后 chatMachine 进入 error 状态，UI 展示明确超时提示。
6. 取消操作（cancelling 路径）可在 sending / streaming / toolCalling 任一阶段触发，完成后 chatMachine 回 ready。

Phase 11 完成标准：

1. 写操作工具结果经由 Diff Review 路由，不直接写文件。
2. 工具结果以 provider-native `role=tool` + `tool_call_id` 结构在同一轮次内回流，不作为 user message 注入。
3. 结构冲突（PathConflict）在工具层返回，不静默覆盖。

Phase 12 完成标准：

1. allowedTools 场景动态过滤生效，模型不能调用未授权工具。
2. Prompt 组装在后端完成，前端只传最小必要参数。
3. InputReference 注入不影响文件状态。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-23 | v1.0 | 初始版本，定义 Agent Phase 10-12 技术方案、状态机、数据结构、协议和候选规则 |
| 2026-05-23 | v1.1 | §2 agentMachine 升级为 chatMachine 设计（完整状态机见 AG-M-P-04）；§6 补充 allowedTools 场景动态决策、工具超时 10s 约束、tool_result provider-native 协议；§9 Phase 10 验收标准补充 chatMachine 迁移要求和取消路径验证 |
| 2026-05-23 | v1.2 | §3.5 InputReference 重构为判别联合类型（kind: file|text|url），补充 DocumentAnchorTarget 精确坐标结构，移除旧 mode:"readonly" 字段；§5.2 create_file 说明改为 content 必填不经 Diff Review |
| 2026-05-24 | v1.3 | §2.1 状态图 cancelling→error 事件名从 FAILED 修正为 ABORT_FAILED（与 AG-M-P-04 §2/§4 对齐） |
| 2026-05-24 | v1.4 | §3.4 ToolName 新增 Phase 13-B 候选 edit_document_block（依赖 BlockId 稳定性策略和 L0 文档结构注入机制）|
| 2026-05-24 | v1.5 | 精确编辑架构对齐（D-02）：§3.4 ToolName 移除 edit_document_block 候选（定位能力折叠进 edit_current_editor_document anchor 字段，不作为独立工具存在）；内容编辑工具说明改为 originalText+newText 字符精确替换接口 |
