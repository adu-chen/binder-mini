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
5. InputReference 是结构化内容载体，传递引用标签、内容快照和精确坐标（blockId、lineRange、textOffset）；Agent 根据引用类型和坐标语义自行判断是将引用作为编辑对象还是背景参考；内容写入必须经由 Diff Review，结构操作仍经由 WS 工具链。

## 3. 需求清单

| 需求 ID | 名称 | 需求描述 | 验收口径 |
|---------|------|----------|----------|
| REQ-AG-001 | Provider 配置 | 用户可以配置 AI Provider 类型、模型和 API key；支持 Anthropic（claude-*）、OpenAI（gpt-*）、DeepSeek（deepseek-*）三个供应商。 | Provider 配置完整（类型、模型、key 已设置）时方可发送消息；配置缺失时返回明确错误；三个供应商均可在配置界面选择并切换。 |
| REQ-AG-002 | 消息发送与流式响应 | 用户可以向 Agent 发送对话消息，Agent 以流式方式返回响应。 | 消息成功提交后响应开始流式展示；流式中断或 Provider 错误时 UI 可识别失败状态。 |
| REQ-AG-003 | 只读与检索工具 | Agent 可在 Workspace 边界内调用只读工具读取文件、列举目录、搜索文件；并可调用互联网搜索工具检索外部信息。 | read_file、list_files、search_files、web_search 的工具结果在同一对话轮次内返回；Workspace 工具路径越界时拒绝执行；web_search 不受 Workspace 边界约束。 |
| REQ-AG-004 | 内容编辑工具 | Agent 对已打开文件（edit_current_editor_document）或未打开文件（update_file）的内容编辑必须生成 PendingDiff，不得直接写入目标文件。 | 内容编辑工具调用结果必须出现在 Diff Review 链路；目标文件内容在 PendingDiff 被接受前不得变化。 |
| REQ-AG-004-B | 结构操作工具 | Agent 可在 Workspace 内执行文件结构操作：创建文件（create_file，支持必填 content 参数直接写入文件内容，写盘不经 Diff Review）、创建目录（create_folder）、重命名（rename_file）、移动（move_file）、删除（delete_file）。 | 结构操作不经过 Diff Review，直接执行磁盘操作；PathConflict 检查前置（create/rename/move 时）；操作成功后文件树刷新；越界或冲突时返回明确错误，不产生磁盘副作用。 |
| REQ-AG-005 | 工具执行记录 | 每次工具调用必须记录工具名称、输入边界、执行状态和结果摘要。 | 工具执行记录在对话消息流中可见；成功/失败状态可区分；错误原因可读。 |
| REQ-AG-006 | InputReference | 用户可通过拖拽或选区操作将 Workspace 文件、编辑器内容片段或文本作为引用附加到 Agent 请求；引用作为结构化内容载体传递，包含引用标签、内容快照和精确坐标（blockId、lineRange、textOffset）。 | 引用内容以结构化 XML 块注入 Provider payload；Agent 自行判断引用是编辑对象还是参考上下文；若作为编辑对象则通过 Diff Review 执行；引用不直接触发文件写入；消息发送成功后清空，Workspace 切换后失效。 |
| REQ-AG-007 | Prompt Runtime | Agent 请求必须包含当前操作上下文（Workspace、active file），并过滤模型不应接触的敏感字段。 | Provider payload 中不含 API key；只有 allowedTools 中的工具可被模型调用；请求内容可调试审计。 |
| REQ-AG-008 | 取消流式响应 | 用户可在消息发送、SSE 流式响应或工具调用执行的任意阶段主动取消本次请求。 | 取消后 chatMachine 回到 ready 状态，输入区恢复可发送；已生成的部分流内容在 UI 中保留展示；不追加完整轮次到历史；工具调用若未完成则中止并标记 cancelled。 |
| REQ-AG-009 | Chat 状态机 | Agent 对话链路必须由 chatMachine 状态机驱动，覆盖会话生命周期、Provider 校验、发送、流式、工具调用、取消和错误恢复全链路。 | chatMachine 明确声明所有合法状态和转移事件；不存在无状态机驱动的中间状态；状态转移可通过 XState devtools 审计。 |
| REQ-AG-010 | 聊天历史持久化 | 聊天记录持久化于 workspace.db，应用重新打开时读取并显示当前 Workspace 的历史消息；提供清空历史功能。 | 应用重启后历史消息按时间顺序展示；历史中关联的 diff 卡片只显示终态，不显示可执行 pending 操作按钮；清空历史需二次确认，执行后当前 Workspace 聊天记录从 DB 删除。 |
| REQ-AG-011 | 历史 diff 卡片展示 | 历史对话中出现的 diff 卡片只展示终态结果标记（accepted/rejected/expired/error）和来源信息，不渲染接受/拒绝操作按钮。 | 历史 diff 卡片不可执行；终态标记清晰可区分；来源工具信息（sourceToolId、filePath）可在卡片中查看；不触发 Diff Review 链路。 |

## 4. 非功能要求

1. Agent 对话链路必须由 chatMachine 状态机驱动，不得有游离于状态机之外的中间状态。
2. Provider 错误、网络中断和超时（单次工具调用超时 10 秒）必须可被 UI 区分，不得停在假执行状态；超时后工具进入 error 状态，chatMachine 回 ready。
3. API key 不得出现在日志、调试输出或 UI 中；MVP 阶段存储在 localStorage，Keychain 作为后续安全增强。
4. 工具调用结果必须以 provider-native `role=tool` + `tool_call_id` 结构回流同一对话轮次，不得伪装成 user message 注入历史。
5. allowedTools 采用场景动态过滤，由 PromptRuntime 根据当前 Workspace 和操作上下文决定，不是全局静态配置。
6. Agent 在同一 Workspace 会话内的工具调用边界必须随 Workspace 状态变化而重置。

## 5. 明确不做（当前阶段）

1. 多 Provider 并发请求。
2. 自定义工具注册或插件扩展。
3. Agent 主动发起操作（必须由用户消息触发）。

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
name: 只读与检索工具
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
req_id: REQ-AG-004-B
name: 结构操作工具
module: AG
chains: AG-TOOL-CALL, WS-FILE-MANAGE
priority: P1
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
status: active
-->

<!-- REQ
req_id: REQ-AG-007
name: Prompt Runtime
module: AG
chains: AG-SEND-MESSAGE
priority: P1
status: active
-->

<!-- REQ
req_id: REQ-AG-008
name: 取消流式响应
module: AG
chains: AG-SEND-MESSAGE
priority: P1
status: active
-->

<!-- REQ
req_id: REQ-AG-009
name: Chat 状态机
module: AG
chains: AG-SEND-MESSAGE, AG-TOOL-CALL
priority: P0
status: active
-->

<!-- REQ
req_id: REQ-AG-010
name: 聊天历史持久化
module: AG
chains: AG-SEND-MESSAGE
priority: P1
status: active
-->

<!-- REQ
req_id: REQ-AG-011
name: 历史 diff 卡片展示
module: AG
chains: AG-SEND-MESSAGE, DE-ACCEPT-DIFF
priority: P1
status: active
-->

## 8. 功能流程表

### REQ-AG-001 Provider 配置校验流程（AG-PROVIDER-VALIDATE-FLOW）

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | User | Provider 配置（类型、模型、API key）| 提交 Provider 配置 | 配置数据 | S02 | — |
| S02 | AG | 配置数据 | 校验配置完整性（类型/模型/key 均非空）| 校验结果 | S03（完整）| ERR-01（配置不完整 → 返回明确错误提示）|
| S03 | AG | API key | 安全存储 API key（不暴露前端）| 存储确认 | S04 | ERR-02（存储失败）|
| S04 | AG | Provider 配置（不含 key）| 更新 chatMachine Provider 状态 | ready+valid 状态 | DONE | — |

### REQ-AG-002 消息发送与流式响应流程（AG-SEND-MESSAGE-FLOW）

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | User | 消息文本 + 可选 InputReference | 触发"发送"操作 | 发送请求 | S02 | — |
| S02 | AG | chatMachine 状态 | 检查 Provider 配置有效 + 非 sending 状态 | 门禁结果 | S03（通过）| ERR-01（Provider 无效）/ ERR-02（正在发送）|
| S03 | AG | 消息 + PromptRuntime 上下文 | 组装 Provider payload（system prompt、history、tools）| Provider payload | S04 | ERR-03（payload 组装失败）|
| S04 | SYS | Provider payload | 调用 Tauri `send_chat_message` command → SSE 连接 | SSE 流开始 | S05 | ERR-04（网络错误 → ERR 状态）|
| S05 | AG | SSE token 事件 | 逐 token 渲染流式响应 | 流式文本更新 | S06（tool_call）/ S08（done）/ ERR-05（error）| — |
| S06 | AG | tool_call 事件 | 解析工具调用请求 | ToolExecution | S07 | ERR-06（未知工具/越界）|
| S07 | AG | ToolExecution | 执行工具（→ AG-TOOL-CALL-FLOW）| tool_result | S05（继续流）| ERR-07（工具执行失败）|
| S08 | AG | done 事件 | 结束流（chatMachine → ready）| 完成状态 | DONE | — |

### REQ-AG-003 只读与检索工具流程（AG-READ-TOOL-FLOW）

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | AG | tool_call（read_file / list_files / search_files / web_search）| 接收工具调用，判断工具类型 | 工具名称 + 参数 | S02a（WS 工具）/ S02b（web_search）| — |
| S02a | AG | 目标路径参数 | 校验路径在 workspaceRoot 内 | 路径校验结果 | S03（合法）| ERR-01（越界 → 工具拒绝，返回错误结果）|
| S02b | AG | 搜索查询参数 | 验证查询参数非空（不做 WS 边界校验）| 参数校验 | S03b | ERR-01b（参数为空 → 拒绝）|
| S03 | SYS | 合法路径 | 执行文件读取 / 目录列举 / FTS5 全文搜索 | 读取结果 | S04 | ERR-02（文件不存在 / 读取权限不足）|
| S03b | SYS | 搜索查询 | 调用互联网搜索接口，返回结果摘要 | 搜索结果 | S04 | ERR-02b（网络不可用 / 搜索接口错误）|
| S04 | AG | 工具执行结果 | 封装为 tool_result，注入当前对话轮次（不作为 user message）| 工具结果上下文 | DONE（继续 SSE 流）| — |

### REQ-AG-004 内容编辑工具流程

内容编辑工具有两条路径，均路由 Diff Review：
- **edit_current_editor_document**（已打开文件）：通过 ED 获取 active 文件 originalText 快照，创建 PendingDiff
- **update_file**（未打开文件）：通过磁盘读取文件内容作为 originalText，直接创建 PendingDiff（不经 ED）

以下流程描述 edit_current_editor_document 路径（AG-EDIT-TOOL-FLOW）；update_file 路径见 DE-CREATE-DIFF-CLOSED-FLOW。

#### AG-EDIT-TOOL-FLOW

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | AG | tool_call（edit_current_editor_document）| 接收内容编辑工具调用 | 工具参数（proposedText、summary）| S02 | — |
| S02 | AG | ED active 文件状态 | 获取当前编辑器活跃文件路径和内容（originalText 快照）| filePath + originalText | S03 | ERR-01（无 active 文件 → 工具拒绝）|
| S03 | DE | filePath + originalText + proposedText + summary + sourceToolId | 创建 PendingDiff | PendingDiff | S04 | ERR-02（DE 创建失败）|
| S04 | AG | PendingDiff 创建成功 | 返回 tool_result（diff 已提交审查）| tool_result | DONE（继续 SSE 流）| — |

### REQ-AG-004-B 结构操作工具流程（AG-STRUCTURAL-TOOL-FLOW）

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | AG | 结构操作工具调用（create_file / create_folder / rename_file / move_file / delete_file）| 接收工具调用，解析操作类型和路径参数 | 操作参数 | S02 | — |
| S02 | WS | 目标路径 | WS 边界校验（目标路径在 workspaceRoot 内）| 路径校验结果 | S03（合法）| ERR-01（越界 → 工具拒绝）|
| S03 | WS | 操作类型 + 路径 | PathConflict 检查（create/rename/move：目标不得已存在；rename/move/delete：源须存在）| 检查结果 | S04（通过）| ERR-02（PathConflict → 返回冲突结果，不执行磁盘操作）|
| S04 | SYS | 路径 + 操作类型 | 执行文件系统结构操作（磁盘写入）| 操作结果 | S05 | ERR-03（磁盘操作失败 → 返回错误结果）|
| S05 | WS | — | 文件树刷新（重新扫描受影响目录）| FileNode 树更新 | S06 | — |
| S06 | AG | 操作成功 | 封装 tool_result（操作已完成 + 新路径信息），注入对话轮次 | tool_result | DONE（继续 SSE 流）| — |

### REQ-AG-005 工具执行记录（P1）

每次工具调用（read/list/search/web_search/edit/structural）开始时创建 ToolExecution 记录（工具名、输入边界、callId）；执行完成后更新状态（success/failed）和结果摘要；记录作为对话消息流的一部分在 UI 中可见。

### REQ-AG-006 InputReference（P1）

用户可通过拖拽（Workspace 文件节点或 Editor Tab 拖入输入框）或在编辑器中选区后附加引用。引用支持 4 种类型：`workspace_file`、`editor_content`（含选区坐标）、`plain_text`、`url`。

引用作为结构化内容载体传递，包含：
- **referenceTag**：引用来源标签（文件名、引用类型）
- **contentSnapshot**：引用时刻的内容快照
- **精确坐标**：`blockId`（TipTap 节点 ID）、`lineRange`（行号范围）、`textOffset`（字符偏移）——三者根据引用类型提供，可部分为空

Agent 根据引用类型和坐标信息自行判断引用语义：
- `editor_content` 类型且包含坐标 → 优先视为精准编辑目标，通过 Diff Review 执行定点修改
- `workspace_file` 类型 → 通常视为参考上下文（Agent 也可决定将其作为编辑对象调用 update_file）
- `plain_text` / `url` → 作为背景参考

`url` 类型注意：系统只传递 URL 字符串，不发起 fetch 请求，不获取页面内容；模型如需读取页面内容，须自行调用 web_search 工具；模型不得声称已读取页面内容。

引用内容以 XML 块格式注入 Provider payload L1 层，不拼入 user message；引用本身不直接触发文件写入；消息发送成功后清空，Workspace 切换后失效，发送失败则保留。

### REQ-AG-007 Prompt Runtime（P1）

Provider payload 在后端（Rust/SYS 层）组装，system prompt 按 L0（系统基线+Workspace 上下文）→ L1（InputReference XML）→ L2（历史片段）→ L3（当前用户消息）四层结构组装；allowedTools 由 PromptRuntime 场景动态决定，不向模型暴露未授权工具；API key、Workspace 绝对路径等禁止字段在后端组装时过滤，不进入 payload；组装结果可通过调试接口审计。

### REQ-AG-008 取消流式响应（P1）

AG-CANCEL-FLOW：

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | User | — | 触发取消操作（Sending/Streaming/ToolCalling 任一阶段）| 取消请求 | S02 | — |
| S02 | AG | chatMachine 当前状态 | chatMachine 发出 CANCEL 事件 → 进入 cancelling 状态 | cancelling 状态 | S03 | — |
| S03 | SYS | SSE 连接 / 工具执行 | 中止 SSE 流 / 中止工具执行 | 中断确认 | S04 | ERR-01（中止超时 → 强制回 ready）|
| S04 | AG | 已生成的部分响应内容 | 保留已生成的部分流内容在 UI 中展示（不追加完整轮次历史）| 部分内容展示 | S05 | — |
| S05 | AG | — | chatMachine → ready 状态，输入区恢复可发送 | ready 状态 | DONE | — |

### 工具矩阵（全工具枚举）

| 工具名 | 类型 | 经过 Diff Review | PathConflict 检查 | WS 边界约束 | 说明 |
|--------|------|-----------------|-------------------|------------|------|
| read_file | 只读 | 否 | 否 | 是 | 读取 Workspace 内文件内容 |
| list_files | 只读 | 否 | 否 | 是 | 列举 Workspace 内目录结构 |
| search_files | 只读 | 否 | 否 | 是 | FTS5 全文搜索 Workspace 文件 |
| web_search | 互联网检索 | 否 | 否 | 否 | 调用互联网搜索，不受 WS 边界约束 |
| edit_current_editor_document | 内容写入 | 是 | 否 | 是 | 已打开文件编辑，生成 PendingDiff |
| update_file | 内容写入 | 是 | 否 | 是 | 未打开文件编辑，生成 PendingDiff |
| create_file | 结构操作 | 否 | 是 | 是 | 创建新文件，支持必填 content 参数直接写盘（新文件无 originalText，不经 Diff Review）|
| create_folder | 结构操作 | 否 | 是 | 是 | 创建目录 |
| rename_file | 结构操作 | 否 | 是 | 是 | 重命名文件或目录 |
| move_file | 结构操作 | 否 | 是 | 是 | 移动文件或目录 |
| delete_file | 结构操作 | 否 | 否（明确意图）| 是 | 删除文件或目录 |

约束：allowedTools 由 PromptRuntime 场景动态决定，不向模型暴露全部工具；未实现工具绝不进入 allowedTools。

### REQ-AG-010 聊天历史持久化（AG-CHAT-PERSIST）

聊天记录按 Workspace 存储于 workspace.db 的 `chat_messages` 表，每条记录关联 workspaceId 和时间戳。应用打开 Workspace 时读取并按时序展示历史消息，包括用户消息、assistant 响应和工具执行记录。历史中出现的 Diff 卡片只展示终态（见 REQ-AG-011）。

用户可通过"清空聊天历史"操作删除当前 Workspace 全部聊天记录；执行前弹窗二次确认；执行后 DB 中对应 workspaceId 的消息记录全部删除，UI 清空展示区。聊天历史不跨 Workspace 共享；切换 Workspace 时历史列表随上下文切换。

### REQ-AG-011 历史 diff 卡片展示规则

历史对话中的 Diff 卡片展示约束：

1. 只展示终态卡片（accepted/rejected/expired/error）——历史中不会出现可执行的 pending 按钮。
2. 卡片展示：终态状态标记 + 目标文件路径（filePath）+ 来源工具信息（sourceToolId）。
3. 历史加载时，若 DB 中有 pending 状态记录（Workspace 正常关闭时应已全部转 expired；若因 crash 残留），按 REQ-DE-010 流程恢复或转 expired 后再展示。
4. 历史 Diff 卡片不触发 Diff Review 链路；接受/拒绝按钮不渲染。

### REQ-AG-009 Chat 状态机（P0）

chatMachine 覆盖 Agent 对话会话全链路，必须包含以下状态：

| 状态 | 语义 |
|------|------|
| `noWorkspace` | 无 Workspace，聊天功能不可用 |
| `ready` | Workspace 已打开，可接收用户输入 |
| `validatingProvider` | 校验 Provider 配置 |
| `sending` | Provider 请求已提交，等待 SSE 流开始 |
| `streaming` | 接收流式响应 token |
| `toolCalling` | 执行工具调用 |
| `cancelling` | 用户主动取消，等待流/工具中止 |
| `error` | Provider 错误 / 网络错误 / 超时错误 |

状态转移事件：`WORKSPACE_OPENED`、`WORKSPACE_CLOSED`、`SEND_MESSAGE`、`PROVIDER_VALID`、`PROVIDER_INVALID`、`STREAM_STARTED`、`TOKEN_RECEIVED`、`TOOL_REQUESTED`、`TOOL_FINISHED`、`RESPONSE_DONE`、`CANCEL`、`CANCEL_DONE`、`FAILED`、`RETRY`。

## 9. 已决策约束

以下问题已决策，作为设计约束固化到实现中。

| 类别 | 决策 |
|------|------|
| **API key 存储** | MVP 阶段：`localStorage["binder-ai-configs"]` 存储 Provider 配置（含 key）。Keychain（系统级安全存储）作为后续安全增强，不作为 MVP 主链。workspace.db 不保存 API key。对齐 binder-core MVP 决策。 |
| **allowedTools 过滤粒度** | 场景动态过滤：allowedTools 由 PromptRuntime 根据当前 Workspace 状态和操作上下文决定，不是按 Provider 类型全局静态配置。对齐 binder-core 目标设计方向；Phase 12 开始实现。 |
| **工具调用超时** | 单次工具调用超时 10 秒。超时后工具进入 `error` 终态，chatMachine 回 ready，SSE 流不中断（工具结果以 error 类型回流）。 |
| **取消流式响应** | 新增 REQ-AG-008，chatMachine 引入 `cancelling` 状态；取消后已生成的部分流内容在 UI 保留，不追加完整轮次历史。 |
| **tool_result 注入位置** | provider-native `role=tool` + `tool_call_id` 结构，回流到同一对话轮次（不作为 user message）。Provider Adapter 负责将统一内部格式转换为各 Provider 原生格式（OpenAI vs Anthropic content block）。对齐 binder-core BR-AG-PROMPT-003。 |

## 10. 跨模块交互声明

| 方向 | 触发场景 | 数据边界 | 约束 |
|------|----------|----------|------|
| AG → WS | 只读工具调用（read_file、list_files、search_files）| workspaceRoot + filePath → 文件内容/目录列表/搜索结果 | 路径必须在 workspaceRoot 内；WS 未 active 时工具拒绝执行 |
| AG → WS | 结构操作工具调用（create_file / create_folder / rename_file / move_file / delete_file）| workspaceRoot + 操作类型 + 路径参数 → 文件系统操作结果 | 路径边界校验和 PathConflict 检查必须通过；AG 不得绕过 WS 层直接操作文件系统 |
| AG → DE | 内容编辑工具调用（edit_current_editor_document / update_file）| proposedText + originalText + sourceToolId → PendingDiff | AG 只能请求 DE 创建 diff，不得直接写文件 |
| AG → ED | 获取当前编辑器活跃文件上下文 | active filePath + originalText 快照 | 只读读取；不直接修改 ED 状态 |
| AG → SYS | web_search 工具调用 | 搜索查询参数 → 互联网搜索结果摘要 | 不受 WS 边界约束；网络不可用时返回工具 error result |
| AG → DB | 聊天消息持久化 | 每轮 AgentMessage → workspace.db chat_messages 表 | 按 workspaceId 分区；不跨 Workspace 共享；Workspace 切换时读取对应分区 |
| WS → AG | Workspace 关闭时通知 AG | workspaceMachine → Closing | AG 必须终止当前 SSE 流；工具调用边界随 WS 状态重置 |

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-23 | v1.0 | 初始版本，定义 Agent 功能需求颗粒度和 REQ-AG-* ID |
| 2026-05-23 | v1.1 | 新增 §7 需求标注块、§8 功能流程表、§9 问题暴露清单、§10 跨模块交互声明（G1 合规修复）|
| 2026-05-23 | v1.2 | 新增 REQ-AG-008（取消流式响应）、REQ-AG-009（Chat 状态机）；§4 非功能要求补充 chatMachine 强制、10s 超时、场景动态 allowedTools、provider-native tool_result；§8 同步补全新 REQ 标注块；§9 将所有 NEEDS_HUMAN_DECISION 替换为已决策约束（对齐 binder-core）|
| 2026-05-23 | v1.3 | §10 跨模块交互 WS→AG 触发条件 idle→Closing（对齐 workspaceMachine PascalCase 状态） |
| 2026-05-23 | v1.3 | REQ-AG-001 明确枚举三个供应商（Anthropic/OpenAI/DeepSeek）；REQ-AG-003 更名为"只读与检索工具"，新增 web_search；新增 REQ-AG-004-B（结构操作工具：create/rename/move/delete）；REQ-AG-006 重写——移除"只读"限定，描述为结构化内容载体（referenceTag+contentSnapshot+精确坐标），Agent 自行判断编辑对象或参考上下文；§5 删除"Agent 会话跨 Workspace 历史持久化"不做项；新增 REQ-AG-010（聊天历史持久化）、REQ-AG-011（历史 diff 卡片终态展示）；§8 新增工具矩阵全枚举表；§10 补充结构操作、web_search、聊天持久化跨模块交互 |
| 2026-05-23 | v1.4 | REQ-AG-003 标注块 name 修正为"只读与检索工具"；flow 表三处 agentMachine→chatMachine（PROVIDER-VALIDATE-FLOW S04、SEND-MESSAGE-FLOW S02/S08）；REQ-AG-004 前增双路径声明（edit_current_editor_document vs update_file）；REQ-AG-004-B create_file 补充必填 content 参数说明；工具矩阵 create_file 备注修正；REQ-AG-006 url 类型补充系统不 fetch 约束；REQ-AG-006/007 标注块 status 字段移除括号附注（统一为纯 active）|
