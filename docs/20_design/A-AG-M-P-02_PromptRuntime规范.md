---
文档编号：   AG-M-P-02
文档状态：   A
负责模块：   AG
文档职责：   Prompt Runtime 数据结构规范、system prompt 组装规则和安全约束
上游约束：   CORE-C-P-01、AG-M-D-01、AG-M-T-01、AG-M-P-01、SYS-C-T-01
直接承接：   Tauri send_chat_message command、Phase 12 Issue Trace
使用边界：   定义 Prompt Runtime 组装规则和安全边界，不写 Rust/TS 实现代码
变更要求：   system prompt 结构、allowedTools 规则或 forbidden fields 变更时必须同步本文
---

# AG-M-P-02 — PromptRuntime 规范

## 1. 本文职责

本文定义 Provider payload 的组装规则，包括 system prompt 四层结构、allowedTools 过滤策略、InputReference 注入位置和 forbidden fields 阻断清单。

## 2. PromptRuntime 数据结构

（承接 AG-M-T-01 §3.6，本文只做组装规则声明）

```typescript
interface PromptRuntime {
  systemPrompt: string;       // 组装好的 system prompt（纯文本）
  allowedTools: ToolName[];   // 暴露给模型的工具列表
  workspaceContext: {
    workspaceRoot: string;                      // 仅用于 system prompt，不暴露给模型
    activeFilePath?: string;                    // 当前 Editor 活跃文件路径（相对路径）
    activeFileMode?: "editable" | "readonly";   // 当前活跃文件编辑模式（M-01）
    activeFileDirty?: boolean;                  // 是否有未保存的用户编辑（M-01）
    pendingDiffCount?: number;                  // 当前活跃文件待审 PendingDiff 数量（M-01）
    documentStructure?: string;                 // 仅 .md 文件：标题层级摘要（≤1500字符，每次请求刷新）（M-05）
  };
  inputReferences?: InputReference[];  // 用户引用（Phase 12）
  historySlice?: AgentMessage[];       // 裁剪后的对话历史
}
```

PromptRuntime 在后端（Rust Tauri command）组装，不在前端构造 provider payload。

## 3. System Prompt 四层结构

system prompt 按以下顺序组装（L0→L3）：

### L0：系统基础层

L0 在每次请求时组装，包含以下四组信息：

**① 基础指令与工作区**

- 固定系统指令（模型角色定义）
- Workspace 上下文（workspaceName，不暴露完整系统路径）
- 当前活跃文件路径（activeFilePath，若有）

**② Editor 状态（每次请求从 editorMachine 读取，客观事实）**

- `activeFileMode`：`editable` 或 `readonly`——模型据此判断是否可发起编辑工具调用
- `activeFileDirty`：当前文件是否有未保存的用户编辑——模型据此感知 LogicalState 与 DiskState 的差异
- `pendingDiffCount`：当前文件待审 PendingDiff 数量——模型据此感知是否已有待处理建议

**③ 文档结构摘要（仅 .md 活跃文件，每次请求刷新）**

当 activeFilePath 为 `.md` 文件时，注入当前 LogicalState 的标题层级结构（不注入正文内容）：

```xml
<document_structure file="{activeFilePath}">
  <heading level="1">第一章：背景</heading>
  <heading level="2">1.1 项目起源</heading>
  <heading level="2">1.2 当前问题</heading>
  <heading level="1">第二章：方案</heading>
</document_structure>
```

约束：
- 字符上限 1500；超出时只保留标题层级，去除细节
- 不注入正文文本（正文需模型显式调用 `read_file` 获取）
- 当前版本**不注入 blockId**（依赖 BlockId 稳定性策略 ED-CAND-DATA-002，待独立 Issue 决策后启用）
- 非 .md 文件不注入此块（避免对代码文件、纯文本等无意义注入）

**④ 工具使用系统约束声明**

告知模型系统层的硬性边界（描述系统约束事实，不做意图分类或判断）：

- `edit_current_editor_document` 将替换当前活跃文件的**全部**内容；`activeFileMode` 为 `readonly` 时不可用
- `edit_document_block` 的 blockId 必须来自本 system prompt 注入的 `<document_structure>` 块，不得自报；blockId 未启用时此工具不进入 allowedTools
- `update_file` 只能操作当前未在 Editor 中打开的文件
- 当不确定用户是否意图修改文件时，优先通过对话确认，再发起写工具调用

示例组装结果：

```
You are a coding assistant for the Binder workspace editor.
Current workspace: {workspaceName}
Active file: design.md [editable] [dirty] [2 pending diffs]

<document_structure file="design.md">
  <heading level="1">系统设计</heading>
  <heading level="2">状态模型</heading>
  <heading level="2">数据结构</heading>
</document_structure>

Tool constraints:
- edit_current_editor_document replaces the entire active file. Unavailable when file is readonly.
- edit_document_block requires blockId from <document_structure> above; unavailable when blockId not enabled.
- update_file: only for files not currently open in the editor.
- When uncertain about user's edit intent, confirm via conversation before calling write tools.
```

### L1：InputReference 上下文层（Phase 12，可选）

当用户请求中包含 InputReference 时，在 L0 之后注入只读引用内容：

```xml
<input_references readonly="true">
<reference kind="file" name="notes.md">
<![CDATA[
{文件内容快照，按 §6 截断规则处理}
]]>
</reference>
</input_references>
```

注：InputReference 只注入只读上下文，不声明执行权威（详见 AG-M-P-03）。

### L2：消息历史层

当前对话轮次之前的历史消息（AssistantMessage + ToolExecution 摘要），按 §5 历史裁剪规则处理。

### L3：当前用户消息

用户本轮输入的自然语言消息。InputReference 不拼入用户消息 content（独立注入 L1）。

## 4. allowedTools 过滤规则

### 4.1 已注册工具全集

Phase 10-11 范围内实现的工具：`read_file`、`list_files`、`search_files`（只读工具，已有）、`edit_current_editor_document`（已有）、`create_file`、`create_folder`、`rename_file`、`move_file`、`delete_file`、`update_file`（Phase 11）。

### 4.2 过滤策略（场景动态）

allowedTools 采用**场景动态过滤**策略，在后端组装 PromptRuntime 时根据当前 Workspace 状态和操作上下文决定（对齐 binder-core，REQ-AG-007）：

决策依据（Phase 12 实现，Phase 10-11 暂用默认集）：

| 场景 | allowedTools 规则 |
|------|-----------------|
| 默认（有活跃 Workspace）| 所有已实现工具 |
| 只读 Workspace（未来）| 仅 read_file、list_files、search_files |
| 无活跃文件 | 排除 edit_current_editor_document |
| 未实现的工具 | 绝不进入 allowedTools，无论场景如何 |

过滤不变量：
- allowedTools 只在后端确定，前端不干预工具可见性
- 模型不可调用未在 allowedTools 中的工具（Rust guard 校验 tool call name）
- Phase 10-11 阶段未实现场景动态时，以"所有已实现工具"为默认集

### 4.3 Provider Payload 中的工具暴露

```typescript
// Provider payload 中只包含 allowedTools 中的工具定义
{
  model: "...",
  system: systemPrompt,
  messages: [...],
  tools: allowedTools.map(name => toolDefinitions[name])
}
```

Provider 实际收到的 tools 必须严格等于 allowedTools 指定的工具定义，不多不少。

## 5. 历史裁剪规则

### 5.1 裁剪策略

当前采用简单策略（Phase 10-12 范围）：
- 保留最近 N 条消息（N 为可配置参数，默认建议 20 条）
- ToolExecution 结果超过字符限制时裁剪内容部分，保留 summary

### 5.2 裁剪不变量

1. 当前轮次用户消息永远不被裁剪
2. 裁剪只从历史头部删除，不从中间抽取
3. tool_call 和对应的 tool_result 必须成对保留，不能只保留一个

### 5.3 文件切换上下文标记

当用户在会话中切换活跃文件时（editorMachine 触发 `ACTIVE_FILE_CHANGED` 事件通知 chatMachine），chatMachine 在 `messages` 中追加一条合成系统消息：

```
[Context: Active file switched from {oldPath} to {newPath}]
```

此合成消息：
- `role` 设为 `"system"`，参与 N 条裁剪计算（不额外占用配额）
- 帮助模型感知会话焦点切换，对切换前文件上下文自然降权
- 不执行任何摘要或内容压缩，不修改其他历史消息

## 6. InputReference 内容截断规则

| 项目 | 规则 |
|------|------|
| 单条文件引用 | 最大 8000 字符（Phase 12 可调整）|
| 全部引用合计 | 最大 20000 字符 |
| 超出部分 | 追加"[内容已截断]"，保留原始 size 字段统计 |

## 7. Forbidden Provider Fields

以下字段绝不能出现在发给 Provider 的 payload 中：

| 禁止字段 | 原因 |
|----------|------|
| apiKey / api_key | API key 安全红线，只在后端 Keychain/安全存储中使用 |
| blockId | 执行定位字段，不暴露给模型 |
| startOffset / endOffset | 执行定位字段，不暴露给模型 |
| filePath（工具执行权威字段）| 路径绑定由 Rust guard 校验，不由模型自报 |
| workspaceRoot（完整路径）| 暴露系统路径，改用 workspaceName |
| InternalAnchor 内容 | 内部定位协议，不可见于 provider |

Rust guard 必须在组装 payload 时扫描并移除上述字段（如果模型 tool call arguments 中出现），不得静默忽略。

## 8. 安全约束摘要

1. API key 只在 Rust 层读取和使用，不传入前端，不出现在 provider payload
2. allowedTools 只在后端确定，前端不能绕过
3. InputReference 内容只注入 system prompt L1 层，不拼入 user message content
4. 模型生成的 tool call arguments 中如果包含禁止字段，Rust guard 必须阻断并返回 blocked result
5. Provider payload 必须可以通过调试接口完整审计（不含 apiKey）

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-23 | v1.0 | 初始版本，定义 binder-mini Prompt Runtime 四层结构、allowedTools 策略和 forbidden fields 清单 |
| 2026-05-23 | v1.1 | §4 allowedTools 过滤策略从全局白名单改为场景动态（对齐 binder-core REQ-AG-007）；补充场景决策表和过滤不变量 |
| 2026-05-24 | v1.2 | §2 workspaceContext 扩展（activeFileMode/activeFileDirty/pendingDiffCount/documentStructure）；§3 L0 层重构为四组信息（基础指令、Editor 状态注入、.md 文档结构摘要、工具系统约束声明）；§5.3 新增文件切换上下文标记协议（ACTIVE_FILE_CHANGED 合成系统消息） |
