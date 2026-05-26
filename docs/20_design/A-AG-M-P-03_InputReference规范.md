---
文档编号：   AG-M-P-03
文档状态：   A
负责模块：   AG
文档职责：   InputReference 数据结构、入口规则、Prompt 注入策略和生命周期
上游约束：   CORE-C-P-01、AG-M-D-01、AG-M-T-01、AG-M-P-01、AG-M-P-02、SYS-C-T-01
直接承接：   ChatInput UI、agentService、PromptRuntime L1 注入
使用边界：   定义 InputReference 边界约束和注入规则，不写 UI 组件代码，不表达实现完成度
变更要求：   引用类型、入口规则、注入格式或门禁约束变更时必须同步本文和 AG-M-P-02
---

## 1. 本文职责

InputReference 是用户主动拖拽或粘贴到聊天输入框的结构化内容引用，本文定义其数据结构、入口规则、Prompt 注入格式、生命周期和门禁约束。

## 2. 核心原则

1. InputReference 是结构化内容载体，携带引用标签、内容快照和精确坐标；Agent 根据上下文自行判断引用是编辑对象还是背景参考
2. InputReference 不直接触发文件写入或 diff 接受；若 Agent 将其作为编辑对象，须经 Diff Review 写入
3. InputReference 不声明对 Workspace 文件的写权威
4. 引用内容只注入 system prompt L1 层（见 AG-M-P-02 §3.1），不拼入 user message content
5. Workspace 切换后引用自动失效（不跨 Workspace 保留引用）

## 3. 数据结构

InputReference 为判别联合类型（discriminated union），以 `kind` 为判别字段：

```typescript
type InputReference =
  | {
      id: string;
      kind: "file";
      filePath: string;              // Workspace 相对路径（仅内部使用，不进入 prompt）
      content: string;               // 文件内容快照（创建时拍快照）
      displayName: string;           // UI chip 展示名称（文件名）
      createdAt: number;             // Unix timestamp (ms)
      anchor?: InputReferenceAnchor; // 精确坐标（可选，用于定位引用区域）
    }
  | {
      id: string;
      kind: "text";
      content: string;               // 粘贴的文本内容快照
      displayName: string;           // UI chip 展示名称（内容摘要）
      createdAt: number;
    }
  | {
      id: string;
      kind: "url";
      url: string;                   // 粘贴的 URL 字符串（不抓取正文）
      displayName: string;
      createdAt: number;
    };

interface InputReferenceAnchor {
  blockId?: string;       // TipTap/ProseMirror 块 ID
  nodeId?: string;        // 节点 ID（降级定位）
  startOffset?: number;   // 文本偏移起点
  endOffset?: number;     // 文本偏移终点
  offsetKind?: "character" | "utf16";
}
```

字段说明：
- `kind: "file"` 涵盖 workspace_file 和 editor_content 两类来源
- `filePath`：只用于内部查找和失效检测，不进入 provider prompt
- `content`：内容快照（不是实时读取），创建引用时拍快照
- `displayName`：文件名或粘贴内容摘要，用于 UI chip 显示

## 4. 引用类型与入口

### 4.1 类型定义

| kind | 来源 | UI 入口 | anchor 状态 |
|------|------|------------------------|-------------|
| file（workspace_file）| Workspace 文件树节点拖入 ChatInput | 拖拽文件节点 | null（文件级，无选区坐标）|
| file（editor_content，**已实现**）| ActiveFile 全文内容快照 | 专用"引用 ActiveFile"按钮或拖拽 EditorTab | null（全文快照，无选区坐标）|
| file（editor_content，**设计预留**）| 编辑器内文本选区附加引用 | 框选后通过选区工具栏附加引用 | 有效（blockId + startOffset + endOffset）|
| text | 粘贴的文本内容 | 粘贴（Cmd+V）| null |
| url | 粘贴的单一 http(s) URL | 粘贴（识别为 URL）| null |

**实现状态说明**：
- `editor_content via 按钮/EditorTab 拖拽`：**已实现**；产生全文快照，anchor 为 null；Agent 视为文件级背景参考
- `editor_content via 文本选区`：**设计预留，当前未实现**；`InputReferenceAnchor` 字段预留，前端 ChatInput 尚无选区捕获入口；实现后 anchor 携带精确 blockId/startOffset/endOffset，Agent 可视为精准编辑目标
- 无有效 anchor 的 `editor_content` 引用，Agent 应视为文件级背景参考，不应自动推断为精准编辑对象

**不支持场景**：
- 非文本文件（PDF、图片等，拒绝并提示不支持）
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
<input_references>

<!-- workspace_file 或 editor_content（无选区 anchor）：文件级引用 -->
<reference kind="file" name="notes.md">
<![CDATA[
{截断后的文件内容}
]]>
</reference>

<!-- editor_content（有选区 anchor）：携带精确位置坐标 -->
<!-- block-id：TipTap 块 ID；start-offset/end-offset：块内纯文本字符偏移 -->
<reference kind="file" name="design.md" block-id="uuid-a1b2" start-offset="12" end-offset="47">
<![CDATA[
{选区内容片段}
]]>
</reference>

<!-- plain_text：粘贴文本 -->
<reference kind="text" name="粘贴文本">
<![CDATA[
{截断后的文本内容}
]]>
</reference>

<!-- url：只传 URL 字符串，不抓取正文 -->
<reference kind="url" name="链接">
https://example.com
</reference>

</input_references>
```

门禁规则：
- `filePath`、工作区绝对路径、内容 hash 不进入 XML 块
- URL 类型不抓取正文（只传 URL 字符串）
- `anchor` 字段（block-id、start-offset、end-offset）**仅在 anchor 有效时注入**；无选区 anchor 的引用不注入位置属性
- 携带有效 anchor 的 `editor_content` 引用，模型可将 `block-id` 作为 `edit_current_editor_document.startBlockId` 参数，`start-offset` 作为 `startOffset` 参数，辅助精确定位
- `<input_references>` 块之后紧跟门禁声明："以上引用仅供参考；内容快照不得直接用作 originalText 或工具定位锚点；编辑仍须经 Diff Review 执行"

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
| 不直接触发写操作 | InputReference 不声明写权威；Agent 判断引用是编辑对象时须经 Diff Review，不由引用直接触发 |
| 不拼入 user message | 引用内容只在 system prompt L1 层注入（AG-M-P-02 §3.1），不拼入 user 的自然语言消息 |
| filePath 不作工具参数 | `filePath` 不得当作 read_file / update_file 的 `file_path` 参数 |
| content 不作执行锚点 | `content` 快照不得直接用于生成 diff 的 originalText 或工具定位锚点；anchor 携带的 blockId/offset 可作为 startBlockId/startOffset 辅助参数，但 originalText 仍必须来自 LogicalStateSnapshot（已打开文件）或 read_file（未打开文件）|
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
| 2026-05-23 | v1.1 | §1/§2 调整"只读上下文"表述为结构化内容载体，Agent 自行判断是否触发 Diff Review；§3 数据结构改为判别联合类型（kind: file|text|url），补充精确坐标；§4.1 类型表改用 kind 字段；§5 XML 格式 type 属性改为 kind，去除 readonly 属性；§7 门禁约束对齐新语义 |
| 2026-05-24 | v1.2 | 审计修复：DocumentAnchorTarget 更名为 InputReferenceAnchor 并纳入术语注册；editor_content 入口改用 ActiveFile / EditorTab 术语 |
| 2026-05-25 | v1.3 | 治理修复：移除阶段性范围描述，改为入口和不支持场景清单；明确本文不表达实现完成度 |
| 2026-05-26 | v1.4 | §4.1 类型表补充 anchor 状态列；区分 editor_content 已实现（按钮/TabDrag，全文快照，anchor=null）和设计预留（文本选区，anchor 有效）两种入口；明确无 anchor 时 Agent 视为文件级背景参考；§5 prompt 注入格式新增带 anchor 的 editor_content 示例（block-id/start-offset/end-offset 属性）；明确 anchor 仅在有效时注入，可作为 startBlockId/startOffset 辅助参数；§7 门禁约束更新 anchor 辅助参数例外说明 |
