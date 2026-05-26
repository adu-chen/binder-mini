---
文档编号：   CORE-X-P-27
文档状态：   A
负责模块：   CORE
文档职责：   全量开发实施大纲——基于 2026-05-24 冻结基线重新生成，取代 CORE-X-P-02 至 CORE-X-P-26
上游约束：   CORE-C-P-01、CORE-C-D-01、SYS-C-T-01（v3.1）、SYS-C-T-02（v3.9）、SYS-C-UI-01
直接承接：   Phase 1–8 实现 Issue Trace、所有模块代码实现
使用边界：   定义模块实现顺序、关键交付物和规则映射；不写运行时代码；不替代技术设计规则来源
变更要求：   新增 Issue、调整顺序或变更规则映射时必须同步 SYS-C-T-01、SYS-C-T-02 和对应专项文档
---

# 开发实施大纲

> **基准**：`docs/10_requirements` + `docs/20_design` 当前 A 状态文档（2026-05-24 冻结基线）  
> **前提**：不参考旧代码实现（代码断层大、架构已更新）；所有实现必须映射到 `SYS-C-T-01` 已注册规则，不得映射候选规则（`*-CAND-*`）。

---

## 一、架构前提

### 1.1 四大状态机（必须先设计再实现，`BR-SYS-GOV-001`）

| 状态机 | 权威文档 | 状态集 |
|--------|----------|--------|
| `workspaceMachine` | WS-M-P-02 | NoWorkspace / Loading / Active / Closing / Error |
| `editorMachine` | ED-M-P-01 | noWorkspace / idle / loading / editing / dirty / saving / readonly / error |
| `chatMachine` | AG-M-P-04 | noWorkspace / ready / validatingProvider / sending / streaming / toolCalling / cancelling / error |
| `diffMachine`（每个 PendingDiff 一个实例）| DE-M-T-01 §4 | pending / preapplied / accepting / rejecting / accepted / rejected / expired / error |

### 1.2 三态文档模型（`ED-M-T-01`）

- `DiskState`：磁盘文件内容，只有 Cmd+S 或 closed-file accept 才能写入（`BR-DE-STATE-010`）
- `LogicalState`：TipTap 内存缓冲区，diff preapply 立即修改此层
- `DisplayState`：LogicalState + GreenAdditionDecoration overlay 派生，无独立存储（`BR-ED-STATE-005`）

### 1.3 跨模块事件所有权（唯一发送方约束）

| 事件 | 唯一发送方 |
|------|-----------|
| `WORKSPACE_OPENED / WORKSPACE_CLOSED` | workspaceMachine |
| `ACTIVE_FILE_CHANGED` | editorMachine |
| `LOGICAL_STATE_APPEARED` | editorMachine（FILE_LOADED 后按 createdAt 升序，不并行）|
| `ROLLBACK_LOGICAL_STATE` | diffMachine（reject open-file 路径）|

---

## 二、Phase 1 — 基础设施

### 1-A 项目骨架与依赖

**交付物**
- Tauri 2 + React + TypeScript + Rust 前端骨架
- XState v5（前端状态机运行时）
- TipTap 依赖：`@tiptap/react`、`@tiptap/starter-kit`、`@tiptap/extension-placeholder`、`@tiptap/pm`、`tiptap-markdown`
- 后端 Rust：`rusqlite`（bundled + FTS5 feature）
- Tauri IPC 契约文件（前后端共享 Tauri command 签名和 Tauri event 类型）

### 1-B 状态机骨架

**交付物**：四个状态机同步建立骨架（只定义状态、事件、Context 类型，不填充 action/guard）

- `workspaceMachine`：按 WS-M-P-02 §2 状态图
- `editorMachine`：按 ED-M-P-01 §2 状态图
- `chatMachine`：按 AG-M-P-04 §2 状态图（8 状态）
- `diffMachine`：按 DE-M-T-01 §4 状态图（8 状态）

---

## 三、Phase 2 — UI 层

> **权威文档**：所有 UI 细节（布局约束、token、组件层级、状态映射、对话框文案、Diff 卡视觉）见 **SYS-C-UI-01**，本节只列各区交付物清单。  
> **实现策略**：本阶段建立三栏 Shell 骨架和全局 CSS token，各面板组件以空状态/占位符交付；功能数据在后续 Phase 3–6 完成状态机接线后填入。

### 2-A CSS Token 与全局样式

- 全部 CSS 自定义属性写入全局样式（SYS-C-UI-01 §2.1/§2.2）：`--bg-base`、`--bg-panel`、`--bg-elevated`、`--bg-hover`、`--border`、`--text-primary`、`--text-secondary`、`--text-muted`、`--accent`、`--danger`、`--success`、`--warning`
- Diff 专用 token：`--diff-add-bg`、`--diff-del-bg`、`--diff-pending-border`、`--diff-accepted-bg`、`--diff-rejected-bg`、`--diff-expired-bg`、`--diff-error-bg`
- 字体与间距基准（SYS-C-UI-01 §2.3）

### 2-B MainLayout + ResizeHandle

- 三栏 Shell（FileTreePanel | EditorColumn | ChatPanel），全高，无顶部 Titlebar（SYS-C-UI-01 §1.1）
- 左栏/右栏 ResizeHandle，宽度约束（SYS-C-UI-01 §1.2），持久化至 localStorage（`BR-SYS-UI-002`）
- NoWorkspace / Loading / Error 全局布局状态（SYS-C-UI-01 §1.3/§1.4；`BR-SYS-UI-001`）

### 2-C FileTreePanel 骨架

- WorkspaceHeader（目录名 + 关闭按钮）
- SearchPanel（搜索框 + 结果列表占位）
- FileTree（FileTreeNode 递归占位，右键菜单，拖拽到 Chat 创建 InputReference）
- workspaceMachine 状态映射占位（SYS-C-UI-01 §4.1）

### 2-D EditorColumn 骨架

- EditorTabs（dirty 指示 `•`，水平滚动）
- EditorArea（TipTap 实例占位；.md / .txt / readonly 模式；GreenAdditionDecoration 接口占位）
- EditorStatusBar（filePath、保存状态、字数统计）
- 对话框占位：dirty Tab 关闭（SYS-C-UI-01 §6.1）、Cmd+S preapplied（SYS-C-UI-01 §6.2）、Tab 关闭含 preapplied 三选一（SYS-C-UI-01 §6.3）

### 2-E ChatPanel 骨架 + DiffCard

- MessageList（user / assistant / system 气泡；流式渲染占位；工具执行进度占位）
- ChatInput（多行；InputReferenceBar；发送/取消按钮联动 chatMachine 状态；`BR-AG-UI-001`）
- ProviderConfigPanel（齿轮抽屉；apiKeyConfigured 指示）
- DiffCard：pending / preapplied 操作入口（接受/拒绝），`--diff-pending-border`；终态降权 opacity 0.6 无操作入口（`BR-DE-UI-001`）；GreenAdditionDecoration 仅绿增、不渲染红删（`BR-DE-UI-002`；SYS-C-UI-01 §5）
- Workspace 关闭门禁对话框（SYS-C-UI-01 §6.4）

---

## 四、Phase 3 — Workspace 模块

### 3-A workspaceMachine + DB 初始化（`WS-OPEN`）

**规则**：`BR-WS-STATE-001`、`BR-WS-STATE-002`

**Rust 命令**：`open_workspace(workspace_root)` → Loading 序列

1. 确认并创建 `{root}/.binder/` 目录
2. 打开或创建 `{root}/.binder/workspace.db`
3. 读取 `workspace_settings.schema_version`（缺失视为 v0）
4. 按 WS-M-P-01 §5 执行迁移 DDL（只向前，幂等）
5. `CREATE TABLE IF NOT EXISTS pending_diffs / terminal_diff_cards / workspace_settings`（WS-M-P-01 §3.2）
6. FTS5 索引重建（见 Phase 3-D）
7. `loadDiffsFromWorkspace`（加载 pending_diffs 非终态记录）
8. → `LOAD_SUCCEEDED` 或 `LOAD_FAILED(errorMessage)`

**状态机 action**：workspaceMachine `Loading → Active` 时广播 `WORKSPACE_OPENED(workspaceRoot)` → chatMachine、editorMachine

**Recent Workspace 持久化**：存储在 Tauri `app_config_dir()`，不在 workspace 目录内；按最近打开时间去重排序（`BR-WS-PERSIST-001`）

### 3-B Workspace 关闭（`WS-CLOSE`）

**规则**：`BR-WS-STATE-003`

workspaceMachine 进入 `Closing` 后：

1. 检查 editorMachine 是否存在 dirty tab
2. 检查 diffMachine 实例是否存在 preapplied 非终态 PendingDiff
3. 两者均无 → 跳过确认，直接进入清理序列
4. 任一存在 → 展示确认对话框（确认 / 取消）

**清理序列**（`CONFIRM_CLOSE` 后）：

1. 广播 `WORKSPACE_CLOSED` → chatMachine、editorMachine、所有 diffMachine
2. chatMachine：先持久化 messages → `workspace.db.chat_messages`，再清空内存（`BR-AG-PERSIST-001`）
3. editorMachine：清空所有 tabs，reset activeTabId → null
4. diffMachine（每个实例）：非终态 diff 转 expired，写入 workspace.db（`BR-DE-STATE-013`）
5. 等待清理完成 → 关闭 DB 连接 → 发出内部 `CLOSE_DONE` → NoWorkspace

### 3-C 文件树与文件管理（`WS-FILE-MANAGE`）

**规则**：`BR-WS-DATA-001`、`BR-WS-DATA-002`、`BR-WS-DATA-003`、`BR-WS-DATA-004`、`BR-AG-TOOL-001`

**Rust 命令**

| 命令 | 约束 |
|------|------|
| `list_workspace_files(root)` | 递归生成 FileNode 树，排除 `.binder/**` |
| `create_file / create_folder` | Workspace 边界守卫 → PathConflict 检测 |
| `rename_file / move_file` | PathConflict 检测 → 操作成功后刷新文件树 |
| `delete_file(path, confirm: true)` | 缺少 `confirm: true` → 结构拒绝，不执行 |

所有操作路径必须在 workspace_root 内（`BR-WS-DATA-001`、`X-CONST-001`）。结构操作成功后标记 search.db stale。

### 3-D 搜索索引（`WS-SEARCH`）

**规则**：`BR-WS-DATA-005`

**Rust 命令**

- `rebuild_search_index(root)` → 初始化 `.binder/search.db`；事务内清空并重建 `search_index(file_path, file_name, content)`；跳过 `.binder/**` 和二进制文件
- `search_files(root, query)` → FTS5 查询（≤20 条）；stale 时先重建再查询；索引不可用 → 降级递归扫描（可审计状态）

---

## 五、Phase 4 — Editor 模块

### 4-A editorMachine + TipTap 多标签（`ED-OPEN-FILE`）

**规则**：`BR-ED-STATE-001`、`BR-ED-STATE-002`、`BR-ED-PERSIST-003`

**TipTap 实例模型**：每个 EditorTab 独立持有一个 TipTap Editor 实例

| 文件类型 | 实现路径 | 保存路径 |
|----------|----------|----------|
| `.md` | TipTap + `tiptap-markdown` Markdown storage | Markdown 文本 |
| `.txt` | TipTap 纯文本序列化（共用同一实例类型，无 Markdown 转换）| 原纯文本 |
| 其他 | readonly 渲染 | 不保存 |

**editorMachine Context**

```typescript
interface EditorMachineContext {
  tabs: EditorTab[];        // { id, filePath, fileType, dirty }
  activeTabId: string | null;
  errorMessage: string | null;
}
```

**OPEN_FILE 门禁**：`tabs.some(t => t.filePath === filePath)` → 激活既有 Tab，不重新加载（`BR-ED-STATE-002`）

**出站事件**
- `ACTIVE_FILE_CHANGED(oldPath, newPath)` → chatMachine（每次 activeTabId 变化，noWorkspace 时不发）
- `LOGICAL_STATE_APPEARED(filePath)` → 匹配 diffMachine（FILE_LOADED 后，针对 closed-file pending diff，按 createdAt 升序，不并行）

### 4-B Cmd+S 保存（`ED-SAVE-FILE`）

**规则**：`BR-ED-PERSIST-001`、`BR-ED-PERSIST-002`、`BR-ED-PERSIST-003`、`BR-ED-STATE-003`、`BR-ED-STATE-004`

- SAVE 只写当前 active tab 文件（`BR-ED-PERSIST-001`）
- `.md`：Markdown 序列化失败 → 保持 dirty + 展示错误，禁止写磁盘（`BR-ED-PERSIST-002`）
- `.txt`：TipTap textContent → 直接写磁盘
- 若 active file 有 preapplied diff → 展示确认对话框（见 Phase 6-G）

**dirty Tab 关闭门禁**（`BR-ED-STATE-003`）：三选一对话框（保存并关闭 / 放弃并关闭 / 取消）；WORKSPACE_CLOSED 时跳过此确认。

**状态栏**：从 activeTab 派生（filePath、dirty 状态、字数统计），不维护独立事实源（`BR-ED-STATE-004`）

### 4-C BlockIdExtension（`ED-OPEN-FILE`）

**规则**：`BR-ED-DATA-002`

- TipTap appendTransaction 钩子，为 BLOCK_NODE_NAMES（paragraph、heading、blockquote、codeBlock、listItem、tableCell）生成 UUID v4 `data-block-id` 属性
- Session 级别，不持久化到文件内容
- 模型只能从 `document_structure` 注入数据中读取 block-id，不得自行生成

---

## 六、Phase 5 — Agent 模块

### 5-A chatMachine 完整实现（`AG-SEND-MESSAGE`）

**规则**：`BR-AG-STATE-001`、`BR-AG-STATE-002`

**Context**

```typescript
interface ChatMachineContext {
  workspaceRoot: string | null;
  messages: AgentMessage[];
  streamingContent: string;
  pendingToolExecutions: ToolExecution[];
  activeToolExecution: ToolExecution | null;
  inputReferences: InputReference[];
  errorCode: string | null;
  errorMessage: string | null;
}
```

**关键门禁与语义**

| 场景 | 处理 |
|------|------|
| SEND_MESSAGE 门禁 | ready 状态 + Provider 配置完整 + userContent 非空，三者均满足才允许 |
| CANCEL 门禁 | 仅在 sending / streaming / toolCalling 有效 |
| WORKSPACE_CLOSED | sending / streaming / toolCalling → 直接转 noWorkspace（不经 cancelling）|
| ABORT_FAILED | cancelling → error（区分 CANCEL_DONE）|
| RETRY | 截断至最后一条完整 assistant message，partial streaming 内容丢弃 |
| ACTIVE_FILE_CHANGED | ready/sending/streaming/toolCalling/error 均有效；追加合成 system 消息，不触发状态转移 |

### 5-B ProviderConfig 与 API Key 安全

**规则**：`BR-AG-SEC-001`

- `ProviderConfig: { type, model, apiKeyConfigured: boolean }`
- API key MVP：localStorage 只存 key，但 key 原文只在后端持有；前端只感知 `apiKeyConfigured` 布尔值
- Provider payload 由 Rust 组装；apiKey 等 forbidden 字段在后端过滤，不透传给模型

### 5-C SSE 流与 Provider 代理（`AG-SEND-MESSAGE`）

**规则**：`BR-AG-STATE-002`

**Rust 命令**：`chat_stream` → 通过 Tauri events 发出 `chat-stream-event`

| chat-stream-event 类型 | chatMachine 事件 |
|-----------------------|-----------------|
| SSE 连接建立 | `STREAM_STARTED` |
| token | `TOKEN_RECEIVED`（累积 streamingContent）|
| tool_call | `TOOL_REQUESTED` → toolCalling |
| done | `RESPONSE_DONE` |
| 网络/超时/Provider 错误 | `FAILED`（不静默丢弃）|

**取消**：CANCEL → cancelling → Rust abort SSE → `CANCEL_DONE`（正常）或 `ABORT_FAILED`（出错）

### 5-D PromptRuntime（Rust 后端，AG-M-P-02）

**规则**：`BR-AG-STATE-003`

**四层组装**

| 层 | 内容 |
|----|------|
| L0 | Base instructions + workspaceRoot（相对路径）+ Editor state（activeFileMode / activeFileDirty / pendingDiffCount）+ document_structure XML（≤1500 chars，仅 .md，带 block-id 属性）+ tool constraint declarations |
| L1 | InputReference XML（8000 chars/ref，20000 chars 总计；filePath 不进入 prompt）|
| L2 | 历史消息（N=20，tool_call+tool_result 必须作为完整对保留）|
| L3 | 当前用户消息 |

**allowedTools 动态过滤**：根据 workspaceMachine 状态、ActiveFile 状态、Provider 能力动态计算；后端收到未授权 ToolCall → 返回结构化 tool error，不执行（`BR-AG-STATE-003`）

**Forbidden 字段**：apiKey、模型自报的 blockId、workspaceRoot 完整绝对路径

### 5-E 工具调用执行（`AG-TOOL-CALL`）

**规则**：`BR-AG-OBS-001`、`BR-AG-DATA-002`、`BR-AG-DATA-003`、`BR-AG-TOOL-001`

**toolCalling 协议**：顺序执行（不并行）；工具超时 10s → `FAILED`；ToolResult → role=tool 在同一对话轮次内以 chat-stream-event 回流

**11 个工具**

| 工具 | 链路 | 关键约束 |
|------|------|----------|
| `read_file` | WS-FILE-MANAGE | Workspace 边界 |
| `edit_current_editor_document` | DE-CREATE-DIFF（open-file）| originalText+newText 精确替换，找不到 → error（`BR-AG-DATA-003`）|
| `update_file` | DE-CREATE-DIFF（closed-file）| 同上 |
| `create_file` | WS-FILE-MANAGE | PathConflict，Workspace 边界 |
| `create_folder` | WS-FILE-MANAGE | PathConflict，Workspace 边界 |
| `rename_file` | WS-FILE-MANAGE | PathConflict，`BR-AG-TOOL-001` |
| `move_file` | WS-FILE-MANAGE | PathConflict，`BR-AG-TOOL-001` |
| `delete_file` | WS-FILE-MANAGE | `confirm: true` 必须，缺失 → 结构拒绝 |
| `search_files` | WS-SEARCH | FTS5，≤20 条，Workspace 边界 |
| `list_files` | WS-FILE-MANAGE | 递归 FileNode |
| `read_workspace_info` | WS-OPEN | workspaceRoot 信息 |

### 5-F InputReference（`AG-SEND-MESSAGE`）

**规则**：`BR-AG-DATA-001`

- 类型：`kind: "file" | "text" | "url"`，内容在创建时快照
- 入口：拖拽文件树节点 → file；粘贴 URL → url；粘贴其他文本 → text
- 截断：8000 chars/ref，20000 chars 总计；filePath 不进入 prompt
- 生命周期：发送成功后清空；发送失败保留；Workspace 切换时清空

---

## 七、Phase 6 — Diff Review 模块

### 6-A DiffStore 单例与 PendingDiff 类型

**权威类型定义**（DE-M-T-01 §3.1 优先于 DE-M-P-01）

```typescript
interface PendingDiff {
  id: string;                           // UUID v4
  filePath: string;                     // Workspace 相对路径
  originalText: string;                 // 主定位器（精确原文，`BR-AG-DATA-003`）
  newText: string;                      // 替换内容
  summary: string;
  status: PendingDiffStatus;
  effectivePath: "open-file" | "closed-file";
  sourceToolId: string;                 // ToolExecution.id（`BR-DE-DATA-001`）
  baseRevision: string;                 // SHA-256(DiskState bytes)，hex 64 chars
  anchor?: DiffAnchorRef;              // 辅助定位，非主定位器
  appliedRange?: { from: number; to: number };  // preapplied 后 Editor Runtime 写入
  createdAt: number;                    // Unix timestamp
}
```

**规则**：`BR-DE-DATA-001`、`BR-DE-STATE-001`

**DiffStore 核心操作**（DE-M-P-01 §4）：createDiff / acceptDiff / rejectDiff / expireDiff / loadDiffsFromWorkspace / expireAllOnClose

### 6-B Open-file 链路——diff 创建与 preapply（`DE-CREATE-DIFF`）

**规则**：`BR-DE-STATE-001`、`BR-DE-STATE-005`、`BR-AG-DATA-003`

触发工具：`edit_current_editor_document`

1. `createDiff` 写入 DiffStore，`effectivePath = "open-file"`，diffMachine → pending（短暂过渡）
2. 立即触发 `LOGICAL_STATE_APPLIED`：ProseMirror 文本搜索 originalText → 字符精确替换为 newText
   - originalText 找不到 → diff 进入 error terminal，不 fallback
   - 成功 → 记录 `appliedRange: { from, to }`
3. diffMachine → preapplied；editorMachine → dirty

### 6-C GreenAdditionDecoration（`ED-DIFF-RENDER`）

**规则**：`BR-ED-STATE-006`、`BR-ED-STATE-005`

- TipTap Extension，`Decoration.inline(appliedRange.from, appliedRange.to)` 渲染绿色增加高亮
- 只渲染 newText（绿增）；不渲染红删（full diff 视图仅在 chat stream 中显示）
- `syncPendingDiffsWithDocument`（Transaction listener）：`doc.textBetween(from, to) === newText` 不一致 → `EXPIRE_REQUESTED` → expired
- appliedRange 未经验证通过时不渲染

### 6-D Accept Diff（`DE-ACCEPT-DIFF`）

**规则**：`BR-DE-STATE-010`、`BR-DE-STATE-011`、`BR-DE-STATE-004`、`BR-DE-PERSIST-001`

**Open-file 路径**（`BR-DE-STATE-011`）
- 仅移除 GreenAdditionDecoration；LogicalState 不变；DiskState 不触碰，文件保持 dirty
- diffMachine：preapplied → accepting → accepted

**Closed-file 路径**（`BR-DE-STATE-004`）
- 计算当前 DiskState hash，与 baseRevision 比对：不一致 → expired，不执行写入
- 一致 → ProseMirror 文本搜索 originalText → newText 精确替换 → 写入 DiskState
- diffMachine：pending → accepting → accepted

### 6-E Reject Diff（`DE-REJECT-DIFF`）

**规则**：`BR-DE-STATE-002`

**Open-file 路径**
1. contentRevisionAfterApply 校验：用户已编辑 diff 区域 → diff → error terminal（不强制覆盖 LogicalState）
2. 校验通过 → 发出 `ROLLBACK_LOGICAL_STATE(diffId, appliedRange, originalText)` → editorMachine
3. editorMachine `withSuppressedPendingContentSync` 包裹精确回滚（不触发 USER_EDIT），重新计算 isDirty
4. 移除 GreenAdditionDecoration

**Closed-file 路径**：直接 → rejected terminal，不修改任何文件内容

### 6-F Expire Diff——统一失效规则（`DE-EXPIRE-DIFF`）

**规则**：`BR-DE-STATE-003`、`BR-DE-STATE-012`、`BR-DE-STATE-013`

- `BR-DE-STATE-012`：diff 所在区域 LogicalState 任何变化（用户编辑命中区域、新 diff 覆盖、reject 回滚）或 DiskState 被外部写入 → 自动 EXPIRE_REQUESTED
- diff-on-diff：自然覆盖，不返回冲突错误
- `BR-DE-STATE-013`（Workspace 关闭）：`expireAllOnClose` → 所有非终态 diff → expired

### 6-G 复合场景

**Cmd+S 含 preapplied diff**（`BR-DE-PERSIST-001`）
1. 检测 active file 是否有 preapplied diff → 有则展示确认对话框
2. 确认 → 批量 accept（skip-continue 原子性：某 accept 失败跳过，继续其余）→ 全部完成后写 DiskState
3. 取消 → 中止保存

**Tab 关闭含 preapplied diff**（`BR-DE-STATE-014`）：三选一对话框（接受并关闭 / 拒绝并关闭 / 取消关闭）

**Workspace 关闭门禁**（`BR-WS-STATE-003`）：dirty tab 或 preapplied diff 存在时 → 确认对话框（见 Phase 3-B）

### 6-H workspace.db 持久化（`BR-DE-PERSIST-002`、`BR-AG-PERSIST-001`）

**Rust 命令**
- `save_pending_diff / update_diff_status` → 写 `pending_diffs` 表（字段见 WS-M-P-01 §3.2）
- `save_terminal_card` → 写 `terminal_diff_cards` 表
- `load_diffs_from_workspace` → 读非终态记录，重建 diffMachine 实例
- chat_messages 持久化：WORKSPACE_CLOSED 时先落盘再清空内存；WORKSPACE_OPENED 时读取恢复

**重启恢复**（`BR-DE-PERSIST-002`）
- preapplied diff 降级为 pending（重启后 Editor 未加载）
- 用户打开文件后 editorMachine FILE_LOADED → 发出 LOGICAL_STATE_APPEARED → Inherit Flow：
  - baseRevision 一致 → INHERIT_APPLIED（preapply + GreenAdditionDecoration，effectivePath → "open-file"）
  - 不一致 → EXPIRE_REQUESTED → expired

**历史 PendingDiff 在对话恢复后**：仅展示终态卡片，不恢复非终态 diff 执行状态（`BR-AG-PERSIST-001`）

---

## 八、Phase 7 — 跨模块事件接线

### 7-A workspaceMachine → 其他状态机

```
workspaceMachine LOAD_SUCCEEDED
  → 广播 WORKSPACE_OPENED(workspaceRoot)
      → chatMachine: noWorkspace → ready
      → editorMachine: noWorkspace → idle

workspaceMachine 清理序列
  → 广播 WORKSPACE_CLOSED
      → chatMachine: 任意状态 → noWorkspace（先持久化后清空）
      → editorMachine: 任意状态 → noWorkspace
      → 所有 diffMachine: 非终态 → expired
```

### 7-B editorMachine → chatMachine

```
editorMachine activeTabId 变化
  → ACTIVE_FILE_CHANGED(oldPath, newPath)
      → chatMachine 追加合成 system 消息（不触发状态转移）
```

### 7-C editorMachine → diffMachine（Inherit Flow）

```
editorMachine FILE_LOADED(filePath)
  → 对 DiffStore 中 status=pending, effectivePath=closed-file, filePath 匹配的 diff
      按 createdAt 升序逐个发出 LOGICAL_STATE_APPEARED（顺序，不并行）
```

### 7-D diffMachine → editorMachine（Reject Rollback）

```
diffMachine reject open-file path
  → ROLLBACK_LOGICAL_STATE(diffId, appliedRange, originalText)
      → editorMachine withSuppressedPendingContentSync 精确回滚
      → 重新计算 isDirty
```

---

## 九、Phase 8 — 规则覆盖验收

每个实现 Issue 的代码中必须标注 `@GOV` 注释映射到对应已注册规则（`BR-CORE-GOV-001`）。

**高优先级测试矩阵**

| 规则 | 测试重点 |
|------|----------|
| `BR-DE-STATE-010 / 011` | open-file accept 不写磁盘；Cmd+S 才写 |
| `BR-DE-STATE-004` | closed-file accept：hash 不一致 → expired |
| `BR-AG-DATA-003` | originalText 找不到 → error，不 fallback 全量替换 |
| `BR-AG-SEC-001` | API key 原文不出现在前端 |
| `BR-DE-STATE-013` | WS 关闭后 DB 确认所有非终态 → expired |
| `BR-AG-PERSIST-001` | 关闭/重开 WS 对话历史一致，终态卡片恢复 |
| `BR-WS-STATE-003` | dirty/preapplied 时关闭门禁确认对话框 |
| `BR-ED-STATE-006` | 未验证 appliedRange 不渲染 GreenAdditionDecoration |
| `BR-ED-PERSIST-002` | MD 序列化失败保留 dirty，不写盘 |
| `BR-DE-PERSIST-002` | 重启 preapplied → pending → Inherit Flow 正确执行 |
| `BR-AG-STATE-003` | 后端拒绝不在 allowedTools 的 ToolCall |
| `BR-DE-STATE-014` | 含 preapplied 的 Tab 关闭三选一对话框 |
| `BR-WS-DATA-005` | FTS5 降级路径可观测 |

---

## 十、依赖关系与并行可能

```
Phase 1（基础设施）
  ↓
Phase 2（UI：CSS token + 三栏 Shell + 各面板骨架，数据未接线）
  ↓
Phase 3（WS：workspaceMachine + DB + 文件树 + 搜索，FileTreePanel 接线）
  ↓
Phase 4（ED）+ Phase 5（AG）  ←可在 workspaceMachine 骨架完成后并行推进
      ↓
Phase 6（DE：DiffStore + diffMachine + GreenAdditionDecoration + 持久化）
      ↓
Phase 7（跨模块事件接线）
      ↓
Phase 8（规则覆盖验收）
```

**注意**：Phase 6-B（open-file 链路）依赖 Phase 4-C（BlockId）和 Phase 5-E（工具执行）完成后才能进入全链路实现。

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-24 | v1.1 | 调整开发顺序：UI 层从 Phase 7 前移至 Phase 2；原 Phase 2–6 顺延为 Phase 3–7；拆分 Phase 2 为 2-A（CSS token）、2-B（MainLayout）、2-C/D/E（各面板骨架）；更新依赖图和内部 Phase 交叉引用（Phase 5-G → 6-G、Phase 2-B → 3-B）|
| 2026-05-24 | v1.0 | 初始版本。基于 2026-05-24 冻结基线全量重新生成，取代 CORE-X-P-02 至 CORE-X-P-26 全部旧计划文档；采用 Phase 1–8 架构（以状态机、模块、跨模块集成为主线），不参考旧代码实现 |
