---
文档编号：   AG-M-D-01
文档状态：   A
负责模块：   AG
文档职责：   Agent 功能主控需求
上游约束：   CORE-C-P-01、CORE-C-D-01、CORE-X-P-12
直接承接：   AG-M-T-01、SYS-C-T-02
使用边界：   定义 Agent 功能需求颗粒度，不直接定义代码规则
变更要求：   需求 ID 或需求边界变化必须同步技术设计和映射矩阵
---

# Agent 功能主控

## 1. 需求层 ID 规则

需求描述层使用 `REQ-AG-*` 标识 Agent 产品需求。`REQ-AG-*` 不是技术规则 ID，不直接作为代码实现的 `@GOV` 映射目标。

代码实现必须映射到技术设计文档已注册规则；技术规则再通过 `SYS-C-T-02` 映射回本需求文档。

## 2. 功能定义

Agent 是 Binder Mini 的 AI 对话运行时，负责接收用户消息、调度 AI Provider 生成响应、执行 Workspace 工具调用，并通过 Diff Review 路由内容编辑请求。

Agent 需求必须满足以下原则：

1. Agent 只能在当前 Workspace 边界内执行文件操作工具。
2. 内容编辑必须经过 Diff Review，不得直接写入文件。
3. Provider 配置是 Agent 请求的前提，缺失或无效时必须阻断发送。
4. 工具执行必须可审计，输入边界和执行结果必须记录。
5. InputReference 是只读上下文，不触发文件写入或结构操作。

## 3. 需求清单

| 需求 ID | 名称 | 需求描述 | 验收口径 |
|---------|------|----------|----------|
| REQ-AG-001 | Provider 配置 | 用户可以配置 AI Provider 类型、模型和 API key。 | Provider 配置完整（类型、模型、key 已设置）时方可发送消息；配置缺失时返回明确错误。 |
| REQ-AG-002 | 消息发送与流式响应 | 用户可以向 Agent 发送对话消息，Agent 以流式方式返回响应。 | 消息成功提交后响应开始流式展示；流式中断或 Provider 错误时 UI 可识别失败状态。 |
| REQ-AG-003 | 只读工具 | Agent 可在 Workspace 边界内调用只读工具读取文件、列举目录、搜索文件。 | read_file、list_files、search_files 的工具结果在同一对话轮次内返回；路径越界时工具拒绝执行。 |
| REQ-AG-004 | 内容编辑工具 | Agent 的文档内容编辑必须生成 PendingDiff，不得直接写入目标文件。 | 内容编辑工具调用结果必须出现在 Diff Review 链路，不出现在直接写入路径。 |
| REQ-AG-005 | 工具执行记录 | 每次工具调用必须记录工具名称、输入边界、执行状态和结果摘要。 | 工具执行记录在对话消息流中可见；成功/失败状态可区分；错误原因可读。 |
| REQ-AG-006 | InputReference | 用户可以向 Agent 请求附加 Workspace 文件或内容作为只读上下文引用。 | InputReference 只注入 Provider 请求上下文；不触发文件写入、移动或 diff 接受。 |
| REQ-AG-007 | Prompt Runtime | Agent 请求必须包含当前操作上下文（Workspace、active file），并过滤模型不应接触的敏感字段。 | Provider payload 中不含 API key；只有 allowedTools 中的工具可被模型调用；请求内容可调试审计。 |

## 4. 非功能要求

1. Agent 状态机必须覆盖 idle、Provider 校验、发送、流式响应、工具调用和错误恢复路径。
2. Provider 错误、网络中断和超时必须可被 UI 区分，不得停在假执行状态。
3. API key 不得出现在日志、调试输出或 UI 中。
4. 工具调用结果不得伪装成 user message 注入对话历史。
5. Agent 在同一 Workspace 会话内的工具调用边界必须随 Workspace 状态变化而重置。

## 5. 明确不做（当前阶段）

1. 多 Provider 并发请求。
2. Agent 会话的跨 Workspace 历史持久化。
3. 自定义工具注册或插件扩展。
4. Agent 主动发起操作（必须由用户消息触发）。

## 6. 与 binder-core 的颗粒度差异

binder-core 已具备真实 SSE Provider、tool_calls 协议、多配置 Provider、Prompt Runtime 和 Input References 等完整实现。本项目不直接搬运代码，而是按 Binder Mini 规则体系重新拆分：

1. 先完成 Provider 配置和模拟流响应（已有 MVP）。
2. 补充真实 Provider SSE 协议。
3. 扩展工具矩阵（含写操作工具路由 Diff Review）。
4. 补充 Prompt Runtime 和 InputReference 正式实现。

## 7. 需求标注块

<!-- REQ
req_id: REQ-AG-001
name: Provider 配置
module: AG
chains: AG-SEND-MESSAGE
priority: P0
status: active
-->

<!-- REQ
req_id: REQ-AG-002
name: 消息发送与流式响应
module: AG
chains: AG-SEND-MESSAGE
priority: P0
status: active
-->

<!-- REQ
req_id: REQ-AG-003
name: 只读工具
module: AG
chains: AG-TOOL-CALL
priority: P0
status: active
-->

<!-- REQ
req_id: REQ-AG-004
name: 内容编辑工具
module: AG
chains: AG-TOOL-CALL, DE-CREATE-DIFF
priority: P0
status: active
-->

<!-- REQ
req_id: REQ-AG-005
name: 工具执行记录
module: AG
chains: AG-TOOL-CALL
priority: P1
status: active
-->

<!-- REQ
req_id: REQ-AG-006
name: InputReference
module: AG
chains: AG-SEND-MESSAGE, AG-TOOL-CALL
priority: P1
status: active (Phase 12前置)
-->

<!-- REQ
req_id: REQ-AG-007
name: Prompt Runtime
module: AG
chains: AG-SEND-MESSAGE
priority: P1
status: active (Phase 10-12前置)
-->

## 8. 功能流程表

### REQ-AG-001 Provider 配置校验流程（AG-PROVIDER-VALIDATE-FLOW）

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | User | Provider 配置（类型、模型、API key）| 提交 Provider 配置 | 配置数据 | S02 | — |
| S02 | AG | 配置数据 | 校验配置完整性（类型/模型/key 均非空）| 校验结果 | S03（完整）| ERR-01（配置不完整 → 返回明确错误提示）|
| S03 | AG | API key | 安全存储 API key（不暴露前端）| 存储确认 | S04 | ERR-02（存储失败）|
| S04 | AG | Provider 配置（不含 key）| 更新 agentMachine Provider 状态 | idle+valid 状态 | DONE | — |

### REQ-AG-002 消息发送与流式响应流程（AG-SEND-MESSAGE-FLOW）

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | User | 消息文本 + 可选 InputReference | 触发"发送"操作 | 发送请求 | S02 | — |
| S02 | AG | agentMachine 状态 | 检查 Provider 配置有效 + 非 sending 状态 | 门禁结果 | S03（通过）| ERR-01（Provider 无效）/ ERR-02（正在发送）|
| S03 | AG | 消息 + PromptRuntime 上下文 | 组装 Provider payload（system prompt、history、tools）| Provider payload | S04 | ERR-03（payload 组装失败）|
| S04 | SYS | Provider payload | 调用 Tauri `send_chat_message` command → SSE 连接 | SSE 流开始 | S05 | ERR-04（网络错误 → ERR 状态）|
| S05 | AG | SSE token 事件 | 逐 token 渲染流式响应 | 流式文本更新 | S06（tool_call）/ S08（done）/ ERR-05（error）| — |
| S06 | AG | tool_call 事件 | 解析工具调用请求 | ToolExecution | S07 | ERR-06（未知工具/越界）|
| S07 | AG | ToolExecution | 执行工具（→ AG-TOOL-CALL-FLOW）| tool_result | S05（继续流）| ERR-07（工具执行失败）|
| S08 | AG | done 事件 | 结束流（agentMachine → idle）| 完成状态 | DONE | — |

### REQ-AG-003 只读工具流程（AG-READ-TOOL-FLOW）

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | AG | tool_call（read_file / list_files / search_files）| 接收只读工具调用 | 工具名称 + 参数 | S02 | — |
| S02 | AG | 目标路径参数 | 校验路径在 workspaceRoot 内 | 路径校验结果 | S03（合法）| ERR-01（越界 → 工具拒绝，返回错误结果）|
| S03 | SYS | 合法路径 | 执行文件读取 / 目录列举 / 全文搜索 | 读取结果 | S04 | ERR-02（文件不存在 / 读取权限不足）|
| S04 | AG | 读取结果 | 封装为 tool_result 事件，注入当前对话轮次（不作为 user message）| 工具结果上下文 | DONE（继续 SSE 流）| — |

### REQ-AG-004 内容编辑工具流程（AG-EDIT-TOOL-FLOW）

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | AG | tool_call（edit_current_editor_document）| 接收内容编辑工具调用 | 工具参数（proposedText、summary）| S02 | — |
| S02 | AG | ED active 文件状态 | 获取当前编辑器活跃文件路径和内容（originalText 快照）| filePath + originalText | S03 | ERR-01（无 active 文件 → 工具拒绝）|
| S03 | DE | filePath + originalText + proposedText + summary + sourceToolId | 创建 PendingDiff | PendingDiff | S04 | ERR-02（DE 创建失败）|
| S04 | AG | PendingDiff 创建成功 | 返回 tool_result（diff 已提交审查）| tool_result | DONE（继续 SSE 流）| — |

### REQ-AG-005 工具执行记录（P1）

每次工具调用（read/list/search/edit）开始时创建 ToolExecution 记录（工具名、输入边界、callId）；执行完成后更新状态（success/failed）和结果摘要；记录作为对话消息流的一部分在 UI 中可见。

### REQ-AG-006 InputReference（P1）

用户可通过 UI 入口（拖拽、@mention）添加 Workspace 文件引用；引用在 Provider payload 组装阶段以只读上下文注入（system/context 层），不触发工具调用或文件修改；Workspace 切换后引用自动失效。

### REQ-AG-007 Prompt Runtime（P1）

Provider payload 在后端（Rust/SYS 层）组装，system prompt 包含 Workspace 上下文和当前操作上下文；allowedTools 过滤器在组装时应用，禁止 provider 配置中的 forbidden fields 出现在 payload 中；组装结果可通过调试接口审计。

## 9. 问题暴露清单

| 类型 | 问题 | 说明 |
|------|------|------|
| NEEDS_HUMAN_DECISION | API key 存储位置 | 当前候选方案：(a) Rust Keychain（系统级安全存储，跨会话）；(b) 加密 localStorage（前端持久化但安全性弱）；(c) 会话内存（最安全但重启丢失）。需要人类明确决策。 |
| NEEDS_HUMAN_DECISION | allowedTools 过滤粒度 | 是按 Provider 类型全局配置（如 claude 允许所有工具），还是按 Workspace 场景动态过滤（如只读模式禁用写工具）？影响 Phase 12 Prompt Runtime 实现。 |
| NEEDS_HUMAN_DECISION | 工具调用超时边界 | 单次工具调用（尤其是 search_files）的超时时间尚未决定。超时后是中断 SSE 流还是返回部分结果？ |
| REQ_GAP | 取消正在进行的流式响应 | REQ-AG-002 未明确定义用户取消中途的流式响应的行为和最终状态。agentMachine 需要 cancelling 状态但需求层未声明。 |
| DESIGN_RISK | tool_result 注入对话轮次 | 只读工具结果作为 tool_result 事件注入当前对话轮次（不作为 user message），但具体注入位置（history 中还是 context 层）影响 Provider 对话结构合规性（不同 Provider 对 tool_call/tool_result 的要求不同）。 |

## 10. 跨模块交互声明

| 方向 | 触发场景 | 数据边界 | 约束 |
|------|----------|----------|------|
| AG → WS | 只读工具调用（read_file、list_files、search_files）| workspaceRoot + filePath → 文件内容/目录列表/搜索结果 | 路径必须在 workspaceRoot 内；WS 未 active 时工具拒绝执行 |
| AG → DE | 内容编辑工具调用（edit_current_editor_document）| proposedText + originalText + sourceToolId → PendingDiff | AG 只能请求 DE 创建 diff，不得直接写文件 |
| AG → ED | 获取当前编辑器活跃文件上下文 | active filePath + originalText 快照 | 只读读取；不直接修改 ED 状态 |
| WS → AG | Workspace 关闭时通知 AG | workspaceMachine → idle | AG 必须终止当前 SSE 流；工具调用边界随 WS 状态重置 |

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-23 | v1.0 | 初始版本，定义 Agent 功能需求颗粒度和 REQ-AG-* ID |
| 2026-05-23 | v1.1 | 新增 §7 需求标注块、§8 功能流程表、§9 问题暴露清单、§10 跨模块交互声明（G1 合规修复）|
