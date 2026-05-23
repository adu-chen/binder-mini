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

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-23 | v1.0 | 初始版本，定义 Agent 功能需求颗粒度和 REQ-AG-* ID |
