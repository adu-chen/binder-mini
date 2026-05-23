---
文档编号：   AG-M-P-03
文档状态：   A
负责模块：   AG
文档职责：   InputReference 数据结构、入口规则、Prompt 注入策略和生命周期
上游约束：   CORE-C-P-01、AG-M-D-01、AG-M-T-01、AG-M-P-01、AG-M-P-02、SYS-C-T-01
直接承接：   ChatInput UI、agentService、Phase 12 Issue Trace
使用边界：   定义 InputReference 边界约束和注入规则，不写 UI 组件代码
变更要求：   引用类型、入口规则、注入格式或门禁约束变更时必须同步本文和 AG-M-P-02
---

## 1. 本文职责

InputReference 是用户主动拖拽或粘贴到聊天输入框的只读上下文引用，本文定义其数据结构、入口规则、Prompt 注入格式、生命周期和门禁约束。

## 2. 核心原则

1. InputReference 是只读上下文，不是执行目标
2. InputReference 不触发文件写入、移动或 diff 接受
3. InputReference 不声明对 Workspace 文件的写权威
4. 引用内容只注入 system prompt L1 层（见 AG-M-P-02 §3.1），不拼入 user message content
5. Workspace 切换后引用自动失效（不跨 Workspace 保留引用）

## 3. 数据结构

```typescript
interface InputReference {
  id: string;
  type: "workspace_file" | "editor_content" | "plain_text" | "url";
  filePath?: string;      // workspace_file / editor_content 的相对路径（仅内部使用）
  content: string;        // 文本内容快照（注入时按截断规则处理）
  displayName: string;    // UI chip 展示名称
  createdAt: number;      // Unix timestamp (ms)
}
```

字段说明：
- `filePath`：只用于内部查找和失效检测，不进入 provider prompt
- `content`：内容快照（不是实时读取），创建引用时拍快照
- `displayName`：文件名或粘贴内容摘要，用于 UI chip 显示

## 4. 引用类型与入口

### 4.1 类型定义

| 类型 | 来源 | UI 入口（Phase 12 范围）|
|------|------|------------------------|
| workspace_file | Workspace 文件树节点或 Editor 标签拖入 ChatInput | 拖拽文件节点、拖拽 Editor Tab |
| editor_content | 当前 Editor active 文件快照 | 专用"引用当前文件"按钮（Phase 12）|
| plain_text | 粘贴的文本内容 | 粘贴（Cmd+V）|
| url | 粘贴的单一 http(s) URL | 粘贴（识别为 URL）|

**当前阶段（Phase 12）不支持**：
- 编辑器内文本选区拖入（editor_selection，未实现）
- 非文本文件（PDF、图片等，拒绝并提示）
- 联网抓取 URL 内容（url 类型只传 URL 字符串，不抓取正文）

### 4.2 支持的文件扩展名（workspace_file 拖拽）

首版支持：`.md`、`.txt`、`.json`、`.csv`、`.html`

不支持：PDF、DOCX、XLSX、图片、音频、视频等二进制文件（拒绝时提示不支持，不静默丢弃）

### 4.3 粘贴规则

- 粘贴整段单一 http(s) URL → 生成 url 类型引用
- 粘贴其他文本（含混合内容、多行文本）→ 生成 plain_text 类型引用
- 不因文本长短不同而差异对待（短文本也生成引用，不落入无结构正文）

## 5. Prompt 注入格式

InputReference 以 XML 块注入 system prompt L1 层（承接 AG-M-P-02 §3.1）：

```xml
<input_references readonly="true">
<reference type="workspace_file" name="notes.md">
<![CDATA[
{截断后的文件内容}
]]>
</reference>

<reference type="plain_text" name="粘贴文本">
<![CDATA[
{截断后的文本内容}
]]>
</reference>

<reference type="url" name="链接">
https://example.com
</reference>
</input_references>
```

门禁规则：
- `filePath`、工作区绝对路径、内容 hash 不进入 XML 块
- URL 类型不抓取正文（只传 URL 字符串）
- `<input_references>` 块之后紧跟门禁声明："以下引用仅供参考，编辑目标仍为当前 Workspace 文件基线"

## 6. 内容截断规则

（承接 AG-M-P-02 §6）

| 项 | 规则 |
|---|---|
| 单条 workspace_file / plain_text | 最大 8000 字符 |
| 全部引用合计 | 最大 20000 字符 |
| 超出时 | 追加"[内容已截断]"，displayName 和 size 保留原始值 |
| url | 不截断（只传 URL 字符串，无正文）|

## 7. 门禁约束

| 约束 | 规则 |
|------|------|
| 只读上下文 | InputReference 不声明写权威，不触发工具调用 |
| 不拼入 user message | 引用内容只在 system prompt L1 层注入（AG-M-P-02 §3.1），不拼入 user 的自然语言消息 |
| filePath 不作工具参数 | `filePath` 不得当作 read_file / update_file 的 `file_path` 参数 |
| content 不作执行锚点 | `content` 快照不得用于生成 diff 的 originalText 或工具定位锚点 |
| Workspace 切换后失效 | workspaceMachine → Closing 时清空所有当前引用，不恢复到下一个 Workspace |
| 发送成功后清空 | 消息发送成功后清空输入区引用列表；发送失败则保留以便重试 |

## 8. 生命周期

```
用户操作（拖拽/粘贴）
→ Reference Creation：验证类型、读取内容快照、生成 InputReference
→ UI 展示 chip（displayName）
→ 用户发送消息
→ Reference Prompt Gate：注入 system prompt L1，过滤 filePath 等内部字段
→ Provider 请求发出
→ 发送成功 → 清空引用列表
→ 发送失败 → 保留引用列表（供重试）

[Workspace 切换时]
→ 清空所有引用（不跨 Workspace 保留）
```

## 9. 与其他文档的关系

| 文档 | 关系 |
|------|------|
| AG-M-P-02 PromptRuntime | 定义引用注入的 L1 层位置和截断规则（上游）|
| AG-M-P-01 工具调用协议 | InputReference 不影响工具矩阵和工具参数（平行）|
| AG-M-T-01 Agent 技术设计 | InputReference 数据结构定义来源（上游）|
| DE-M-P-01 DiffStore | InputReference 不进入 pending_diffs（明确隔离）|

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-23 | v1.0 | 初始版本，定义 binder-mini InputReference 数据结构、入口规则、注入格式和门禁约束 |
