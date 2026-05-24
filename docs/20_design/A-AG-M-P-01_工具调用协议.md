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
| 网络检索工具 | web_search | 调用外部搜索 API，不受 Workspace 边界约束（Phase 11）|
| 结构工具 | create_file、create_folder、rename_file、move_file、delete_file | 改变文件树结构（Phase 11）|
| 内容写工具 | edit_current_editor_document、edit_document_block、update_file | 改变文件内容，必须先生成 PendingDiff |

## 3. 工具矩阵

| 工具 | 输入 | 输出 | 执行方式 | 实现阶段 | 风险等级 |
|------|------|------|----------|----------|----------|
| read_file | workspacePath、filePath | 文件内容 | 直接执行 | Phase 9（已有）| 低 |
| list_files | workspacePath、dirPath? | 文件/目录列表 | 直接执行 | Phase 9（已有）| 低 |
| search_files | workspacePath、query | 搜索结果列表 | 直接执行 | Phase 9（已有）| 低 |
| web_search | query | 搜索结果列表（title、url、snippet）| 直接执行；不受 Workspace 边界约束；调用 DuckDuckGo/免费搜索 API（无需 key）| Phase 11 | 低 |
| create_file | workspacePath、filePath、content | 创建结果 | 直接执行 | Phase 11 | 中 |
| create_folder | workspacePath、folderPath | 创建结果 | 直接执行 | Phase 11 | 中 |
| rename_file | workspacePath、oldPath、newPath | 重命名结果 / PathConflict | 冲突返回确认态 | Phase 11 | 中 |
| move_file | workspacePath、fromPath、toPath | 移动结果 / PathConflict | 冲突返回确认态 | Phase 11 | 中 |
| delete_file | workspacePath、filePath | 删除结果 | 识别到明确删除意图后直接执行 | Phase 11 | 高 |
| edit_current_editor_document | proposedText、summary | PendingDiff 创建结果 | 走 Diff Review 链路；全量替换活跃文件内容 | Phase 9（已有）| 中 |
| edit_document_block | blockId（来自 system prompt）、proposedContent、summary | PendingDiff 创建结果（块级）| 走 Diff Review 链路；blockId 由 Editor Runtime 注入，Rust 层校验有效性 | Phase 13-B（BlockId 稳定性策略就绪后）| 中 |
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
1. 工具调用参数中必须包含 `confirm: true` 字段，表示模型已识别明确删除意图；缺少 `confirm: true` 时拒绝执行，返回结构化错误
2. 执行前仍需通过 workspace active 和路径边界校验
3. 执行结果必须包含可审计字段（目标路径、时间戳）

### 4.4 结构冲突确认协议

rename_file、move_file 遇到目标路径已存在时：
1. 先返回 PathConflict（含原始参数），不直接覆盖
2. 进入确认态，由用户选择覆盖、改名或取消
3. 未确认前不得落盘

### 4.5 并行工具调用顺序化协议

模型可能在同一轮次 SSE 响应中返回多个 tool_use block（Claude / GPT-4o 均支持）。binder-mini 采用**顺序化队列**策略：

1. 后端在 SSE 流结束时收集本轮全部 tool_use block，写入 `pendingToolExecutions` 队列，按返回顺序排列。
2. chatMachine 进入 toolCalling 后从队列头取 `activeToolExecution` 执行，TOOL_FINISHED 后结算并取下一条，直到队列空。
3. 同一轮次内工具调用**不并行执行**；每次只有一个 activeToolExecution 处于执行中。
4. 部分失败处理：某条工具执行失败（FAILED）时，chatMachine 转 error 状态，队列中剩余工具不执行；用户 RETRY 后整轮重发。
5. 前端日志和 UI 工具执行记录须标注当前工具在队列中的位置（如"工具 2/3"），便于用户理解执行进度。

**不支持场景**：binder-mini 不支持模型请求的工具并行执行（如 tool_use 内含 parallel=true 语义字段）；收到此类请求时忽略并行标记，仍走顺序队列。

### 4.6 edit_document_block 协议

`edit_document_block` 为块级精确编辑工具，与 `edit_current_editor_document`（全量替换）并存，适用于当前活跃 `.md` 文件的指定段落局部修改：

1. **blockId 来源约束**：blockId 必须来自 L0 system prompt 注入的 `<document_structure>` 块，禁止模型自报 blockId
2. **结构刷新时机**：每次 SEND_MESSAGE 前，后端从 editorMachine 读取当前 LogicalState 重新生成文档结构并注入 L0，确保 blockId 与当前文档状态对齐
3. **有效性校验**：Rust 执行层在工具执行前校验 blockId 是否存在于当前文档；blockId 不存在时返回结构化错误，不静默 fallback 为全量替换
4. **proposedContent 语义**：目标块的完整替换内容（块级局部替换，不影响其他块）
5. **Diff Review 路由**：执行后生成块级 PendingDiff，走标准 Diff Review 链路（effectivePath 由 Editor 状态决定）

**激活条件**：BlockId 稳定性策略（ED-CAND-DATA-002）升级为正式规则后方可激活；未激活前不进入 allowedTools，system prompt 中的约束声明同步注明"当前不可用"。

## 5. 工具结果回流

所有工具执行完成后，必须返回结构化结果，格式：

```typescript
interface ToolResult {
  tool: ToolName;
  callId: string;      // 关联 ToolExecution.id
  ok: boolean;
  summary: string;     // 人类可读摘要
  data?: ToolResultData; // 结构化数据载荷（按工具类别定义）
}

// 只读工具 data 结构
interface ReadFileData    { content: string; lineCount: number; encoding: string; }
interface ListFilesData   { entries: { name: string; type: "file" | "dir" }[]; }
interface SearchFilesData { results: { path: string; snippet: string; score: number }[]; }

// 结构工具 data 结构（create_file / create_folder / rename_file / move_file / delete_file）
interface StructureToolData {
  affectedPath: string;
  newPath?: string;           // rename_file / move_file 时有效
  conflictDetected: boolean;  // 遇到 PathConflict 时为 true
}

// 内容写工具 data 结构（edit_current_editor_document / edit_document_block / update_file）
interface ContentWriteData {
  diffId: string;                        // 生成的 PendingDiff ID
  status: "preapplied" | "pending";     // 已打开文件→preapplied；未打开→pending
  filePath: string;                      // 目标文件 Workspace 相对路径
}
// 注：diffId 当前仅供会话层信息展示；对应操作工具（取消/查询 diff）待后续实现
// 模型不得在工具调用参数中引用 diffId，Rust guard 扫描并移除

type ToolResultData = ReadFileData | ListFilesData | SearchFilesData | StructureToolData | ContentWriteData;
```

工具结果作为 tool_result 事件注入当前对话轮次（AG-M-T-01 §3.4 SSE 协议），不作为 user message 注入对话历史。

binder-mini 的 SSE 协议基于 Tauri 事件（chat-stream-event），工具结果通过同一事件通道回流，不使用 HTTP SSE。

## 6. 工具边界约束矩阵

| 约束场景 | 受约束工具 | 约束来源 | 处理 |
|----------|------------|----------|------|
| 路径越界 | 所有工具 | X-CONST-001 | 返回 PathConflict / 拒绝 |
| Workspace 未 active | 所有工具 | BR-WS-STATE-001 | 拒绝，返回"无活跃 Workspace"错误 |
| 内容编辑不经 Diff | edit_current_editor_document、edit_document_block、update_file | BR-DE-STATE-001 | 阻断，必须路由到 DE 创建 PendingDiff |
| update_file 用于已打开文档 | update_file | AG-M-T-01 §4.2 | 返回结构化 blocked result |
| edit_document_block 在 BlockId 未激活时调用 | edit_document_block | AG-M-P-01 §4.6 | 不进入 allowedTools；调用则返回 blocked result |
| edit_document_block blockId 无效 | edit_document_block | AG-M-P-01 §4.6 | 返回结构化错误，不 fallback 为全量替换 |
| 路径冲突未确认 | rename_file、move_file | BR-WS-DATA-004 | 返回 PathConflict 确认态 |
| 缺少 confirm:true | delete_file | AG-M-T-01 §4.3 | 拒绝，返回结构化错误要求提供确认参数 |

## 7. 与其他模块的关系

| 对接模块 | 关系 |
|----------|------|
| WS | 结构工具通过 Workspace command 执行；路径边界由 WS 校验 |
| DE | 内容写工具输出 PendingDiff，不直接写盘 |
| ED | edit_current_editor_document 的执行目标由 ED 的 active 文件提供 |
| chatMachine | 工具调用状态通过 toolCalling 状态管理；结果通过 SSE tool_result 事件回流 |

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-23 | v1.0 | 初始版本，定义 binder-mini 工具调用协议和矩阵（参考 binder-core AG-M-P-01 适配本项目架构）|
| 2026-05-23 | v1.1 | §2/§3 新增 web_search 工具（DuckDuckGo/免费 API，无需 key）；§4.3 delete_file 明确删除意图改为 confirm:true 参数；§7 agentMachine → chatMachine；create_file content 参数改为必填 |
| 2026-05-24 | v1.2 | §4.5 新增并行工具调用顺序化协议：多工具调用进入 pendingToolExecutions 队列，按返回顺序依次执行，不并行；部分失败转 error 不继续；UI 标注队列进度 |
| 2026-05-24 | v1.3 | §2/§3 新增 edit_document_block（块级编辑工具，Phase 13-B，BlockId 稳定性策略就绪后激活）；§4.6 新增 edit_document_block 协议（blockId 来源约束、Rust 校验、激活条件）；§5 ToolResult data 从 unknown 改为结构化类型（ReadFileData / ListFilesData / SearchFilesData / StructureToolData / ContentWriteData，含 diffId 信息展示注记）；§6 边界约束矩阵补充 edit_document_block 相关行 |
