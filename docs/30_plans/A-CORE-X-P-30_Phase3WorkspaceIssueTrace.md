---
文档编号：   CORE-X-P-30
文档状态：   A
负责模块：   WS
文档职责：   Phase 3 Workspace 模块接线 Issue Trace——workspaceMachine Actor、DB 持久化命令、搜索接线、文件管理 UI
上游约束：   CORE-X-P-27（大纲 §四）、WS-M-P-02、WS-M-P-01、WS-M-T-01、SYS-C-T-01（v3.1）、SYS-C-UI-01
直接承接：   Phase 4（editorMachine Actor + TipTap 多标签）
使用边界：   逐 Issue 列出交付范围、规则映射、名词声明和通过标准；不写运行时代码正文
变更要求：   Issue 完成后更新验收状态；调整接线协议必须同步 WS-M-P-02、WS-M-P-01
---

# Phase 3 Workspace 模块接线 Issue Trace

---

## 一、规则映射链图

以下链路图描述 Phase 3 所有规则的来源链路及其约束的代码边界。

```
链路 WS-OPEN
  ├─ BR-WS-STATE-001 ── workspaceMachine 全状态转移（NoWorkspace→Loading→Active）
  │                      约束代码：workspaceMachine actor + open_workspace IPC
  │                      验证：workspaceMachine loading 序列在 Loading 状态内完成
  ├─ BR-WS-STATE-002 ── Loading 序列三步（DB 初始化 → FTS5 重建 → PendingDiff 恢复）
  │                      约束代码：open_workspace Rust 命令 + loadDiffsFromWorkspace IPC
  │                      验证：任一步骤失败 → LOAD_FAILED；全部完成 → LOAD_SUCCEEDED
  └─ BR-WS-PERSIST-001 ─ RecentWorkspace 存储在 app_config_dir，按最近打开时间去重，上限 10 条
                          约束代码：record_recent_workspace_at_store（已实现）
                          验证：重复 rootPath 去重，lastOpenedAt 最新优先

链路 WS-CLOSE
  ├─ BR-WS-STATE-003 ── Closing 门禁：存在 dirty EditorTab 或 preapplied PendingDiff → 必须展示确认对话框
  │                      约束代码：workspaceMachine Closing + WorkspaceCloseGuardDialog
  │                      验证：CONFIRM_CLOSE 才进入清理序列；CANCEL_CLOSE 回到 Active
  ├─ BR-DE-STATE-013 ── WORKSPACE_CLOSED 广播后所有非终态 PendingDiff → expired，写入 workspace.db
  │                      约束代码：expireAllOnClose（Phase 6 完整实现；本阶段 WORKSPACE_CLOSED 广播时机正确）
  └─ BR-AG-PERSIST-001 ─ WORKSPACE_CLOSED 前先持久化 AgentMessage 列表到 workspace.db，再清空内存
                          约束代码：save_chat_messages IPC（Rust 端实现）+ chatMachine cleanup
                          验证：关闭后重开同路径 Workspace，chat_messages 可读回

链路 WS-FILE-MANAGE
  ├─ BR-WS-DATA-001 ── 所有文件操作路径必须在 Workspace 根目录边界内（含 canonicalize 验证）
  │                      约束代码：resolve_workspace_file / resolve_workspace_path（已实现）
  ├─ BR-WS-DATA-002 ── create / rename / move 操作：目标路径已存在 → 返回 PathConflict，不覆盖
  │                      约束代码：create_workspace_file/folder, rename/move IPC（已实现）
  ├─ BR-WS-DATA-003 ── delete 操作：前端 FileTree 必须展示确认对话框后才调用 delete_workspace_item
  │                      约束代码：FileTree 删除确认 UI（Issue 3-D）
  ├─ BR-WS-DATA-004 ── 文件树以 FileNode 递归结构展示（目录优先排序，过滤 .binder）
  │                      约束代码：read_workspace_entries + FileTree 递归渲染（已实现）
  └─ BR-AG-TOOL-001 ── Agent 结构操作工具（create/rename/move/delete）必须经 WS 工具链 + PathConflict 守卫
                         约束代码：workspaceService.isPathConflict + FileTree 操作错误展示

链路 WS-SEARCH
  └─ BR-WS-DATA-005 ── FTS5 SearchIndex 可重建、结果限 Workspace、stale 后重建、不可用时降级
                         约束代码：rebuild_search_index + search_files Rust 命令（已实现）+
                                  SearchPanel debounce 接线（Issue 3-C）
                         验证：.binder 不进入结果；索引删除后可重建；降级路径可观测
```

**规则分域汇总**

| 规则 | 域 | 主链路 | 约束代码 | 层级 |
|------|----|--------|---------|------|
| BR-WS-STATE-001 | STATE | WS-OPEN | workspaceMachine actor | 状态机 |
| BR-WS-STATE-002 | STATE | WS-OPEN | Loading 序列（Rust 端已实现） | 状态机 |
| BR-WS-STATE-003 | STATE | WS-CLOSE | Closing + WorkspaceCloseGuardDialog | 状态机/对话框 |
| BR-WS-PERSIST-001 | PERSIST | WS-OPEN | RecentWorkspace store（Rust 端已实现） | 持久化 |
| BR-WS-DATA-001 | DATA | WS-FILE-MANAGE | resolve_workspace_file 边界守卫 | 后端 |
| BR-WS-DATA-002 | DATA | WS-FILE-MANAGE | PathConflict 检测（已实现）| 后端 |
| BR-WS-DATA-003 | DATA | WS-FILE-MANAGE | FileTree 删除确认 UI | 前端 |
| BR-WS-DATA-004 | DATA | WS-FILE-MANAGE | FileNode 递归树（已实现）| 前端/后端 |
| BR-WS-DATA-005 | DATA | WS-SEARCH | SearchIndex FTS5 + SearchPanel 接线 | 前端/后端 |
| BR-AG-PERSIST-001 | PERSIST | WS-CLOSE | save_chat_messages IPC | 后端/状态机 |
| BR-DE-STATE-013 | STATE | DE-EXPIRE-DIFF | WORKSPACE_CLOSED 广播时机（Phase 6 实现全体 expire）| 状态机 |
| BR-AG-TOOL-001 | DATA | AG-TOOL-CALL, WS-FILE-MANAGE | workspaceService + FileTree 错误展示 | 前端/后端 |

---

## 二、名词声明

本 Issue Trace 全程使用以下已注册术语（来源：SYS-C-T-01 §0）。代码标识符以 `code_identifier` 字段为准。

| 术语 ID | 正式英文名 | 正式中文名 | 禁用别名 |
|---------|----------|----------|--------|
| TERM-CORE-001 | Workspace | 工作区 | 项目目录, 当前目录, 工作目录 |
| TERM-WS-001 | FileNode | 文件节点 | 文件项, 文件记录, tree item |
| TERM-WS-002 | WorkspaceDatabase | 工作区数据库 | 项目数据库, 本地库, db文件 |
| TERM-WS-003 | RecentWorkspace | 最近工作区 | 最近项目, 最近目录, 历史工作区 |
| TERM-WS-004 | PathConflict | 路径冲突 | 覆盖提示, 文件冲突, 已存在错误 |
| TERM-WS-005 | workspaceMachine | 工作区状态机 | workspace状态机, 工作空间状态机 |
| TERM-WS-006 | SearchIndex | 搜索索引 | 搜索库, 索引库, search db |
| TERM-DE-001 | PendingDiff | 待审差异 | 修改候选, diff候选, 待处理修改 |
| TERM-DE-009 | diffMachine | 差异状态机 | diff状态机, 差异机器 |
| TERM-AG-004 | chatMachine | 对话状态机 | agentMachine, agent状态机 |
| TERM-AG-010 | AgentMessage | 对话消息 | chat message, 聊天记录项 |
| TERM-AG-013 | chat_messages | 对话消息表 | 聊天表, message表, 历史消息表 |
| TERM-ED-001 | EditorTab | 编辑器标签页 | 编辑标签, tab页, 编辑器tab |
| TERM-ED-003 | editorMachine | 编辑器状态机 | editor状态机, 编辑状态机 |
| TERM-DE-005 | baseRevision | 基准版本 | 原始版本, 内容快照hash |

> **约束**：生成 @GOV boundary 时，`in=` / `out=` 必须使用以上正式英文名或 code_identifier，不得使用禁用别名。

---

## 三、Issue 3-A：workspaceMachine Actor 完整接线

### 背景

Phase 2 的 App.tsx 使用 `useState` + 直接 `async/await` 方式管理 Workspace 状态，workspaceMachine 骨架虽已存在但未以 XState actor 方式运行。Phase 3-A 将 workspaceMachine 激活为真实运行中的 actor，由其状态机状态驱动 FileTreePanel、WorkspaceCloseGuardDialog 等组件，并向 editorMachine actor 和 chatMachine actor 广播跨模块事件。

### 修改范围

**新建文件**

| 文件 | 用途 | @GOV 规则 |
|------|------|---------|
| `src/services/workspaceActor.ts` | workspaceMachine actor 创建、Loading 序列编排、IPC 调用、跨模块事件广播 | BR-WS-STATE-001, BR-WS-STATE-002, BR-WS-STATE-003, BR-WS-PERSIST-001 |

**修改文件**

| 文件 | 改动 | 规则 |
|------|------|------|
| `src/App.tsx` | 以 `useActorRef(workspaceMachine)` 替代 `useState` workspace 状态；FileTreePanel 接收 machine snapshot；WorkspaceCloseGuardDialog 由 Closing 状态驱动 | BR-WS-STATE-001/003 |

### workspaceMachine Actor 接线协议

#### Loading 序列（BR-WS-STATE-002）

```
用户点击"打开 Workspace"
→ 打开文件夹选择器（open_workspace IPC）
  → 取消 → 不触发 OPEN_WORKSPACE
  → 选择 → 触发 OPEN_WORKSPACE(workspaceRoot)
    → workspaceMachine: NoWorkspace → Loading
    → 顺序执行 Loading 序列：
      1. open_workspace IPC（内含：.binder 目录、workspace.db 初始化、schema 迁移、FTS5 重建）
      2. loadDiffsFromWorkspace IPC（加载非终态 PendingDiff，重建 diffMachine 实例）
      3. 全部成功 → 触发 LOAD_SUCCEEDED
         任一失败 → 触发 LOAD_FAILED(errorMessage)
    → LOAD_SUCCEEDED → Loading → Active
      → 广播 WORKSPACE_OPENED(workspaceRoot) → editorMachine actor + chatMachine actor
    → LOAD_FAILED → Loading → Error（展示 errorMessage + 重试入口）
```

> **约束**：open_workspace IPC 已在 Rust 端完成 .binder 初始化和 FTS5 重建；Phase 3-A 只负责调用时机和事件路由，不重写 Rust 逻辑。

#### Closing 序列（BR-WS-STATE-003）

```
用户点击关闭按钮
→ 触发 CLOSE_WORKSPACE
→ workspaceMachine: Active → Closing
→ 检查 editorMachine snapshot：是否有 dirty EditorTab？
→ 检查 diffStore：是否有 preapplied（非终态）PendingDiff？
  → 两者均无：跳过确认，直接触发 CONFIRM_CLOSE
  → 任一存在：展示 WorkspaceCloseGuardDialog
    → 用户点击"取消" → 触发 CANCEL_CLOSE → Closing → Active
    → 用户点击"确认关闭" → 触发 CONFIRM_CLOSE

CONFIRM_CLOSE 后清理序列：
  1. 广播 WORKSPACE_CLOSED → editorMachine actor（清空 tabs）
                           → chatMachine actor（持久化 AgentMessage → 清空内存）
                           → 所有 diffMachine 实例（非终态 → expired；Phase 6 实现全体 expire）
  2. 等待 chatMachine 持久化完成（save_chat_messages IPC）
  3. 触发内部 CLOSE_DONE → Closing → NoWorkspace（清空 workspaceRoot）
```

#### 跨模块广播约束（出站事件唯一来源）

| 事件 | 唯一发送方 | 接收方 | 触发时机 |
|------|-----------|--------|---------|
| `WORKSPACE_OPENED(workspaceRoot)` | workspaceMachine actor | editorMachine actor, chatMachine actor | LOAD_SUCCEEDED 后 |
| `WORKSPACE_CLOSED` | workspaceMachine actor | editorMachine actor, chatMachine actor | CONFIRM_CLOSE 后，CLOSE_DONE 前 |

> **禁止**：editorMachine、chatMachine 或任何组件不得自行发出 WORKSPACE_OPENED / WORKSPACE_CLOSED。

#### FileTreePanel 状态映射

| workspaceMachine 状态 | FileTreePanel workspaceState |
|----------------------|------------------------------|
| `NoWorkspace` | `"NoWorkspace"` |
| `Loading` | `"Loading"` |
| `Active` | `"Active"` |
| `Closing` | `"Closing"` |
| `Error` | `"Error"` |

### @GOV 块（workspaceActor.ts）

```typescript
/**
 * @GOV
 * codes: BR-WS-STATE-001, BR-WS-STATE-002, BR-WS-STATE-003, BR-WS-PERSIST-001
 * type: RB
 * chain: WS-OPEN, WS-CLOSE
 * rules: BR-WS-STATE-001, BR-WS-STATE-002, BR-WS-STATE-003, BR-WS-PERSIST-001
 * boundary: in=user workspace selection and CONFIRM_CLOSE event | out=workspaceMachine actor broadcasting WORKSPACE_OPENED and WORKSPACE_CLOSED to editorMachine actor and chatMachine actor
 * term_ref: TERM-CORE-001, TERM-WS-001, TERM-WS-003, TERM-WS-005, TERM-ED-003, TERM-AG-004
 */
```

### 验收标准（Issue 3-A）

- [ ] workspaceMachine actor 以 `useActorRef` 运行，FileTreePanel 接收 `actor.getSnapshot().value`
- [ ] `open_workspace` 成功 → Loading → Active；失败 → Loading → Error（errorMessage 展示）
- [ ] 无 dirty tab 且无 preapplied PendingDiff → 关闭无确认对话框
- [ ] 存在 dirty tab 或 preapplied PendingDiff → WorkspaceCloseGuardDialog 弹出
- [ ] CANCEL_CLOSE → 回到 Active，不清空 tabs
- [ ] CONFIRM_CLOSE → chatMachine 持久化完成后 CLOSE_DONE → NoWorkspace
- [ ] WORKSPACE_OPENED 仅在 LOAD_SUCCEEDED 后由 workspaceMachine 发出
- [ ] WORKSPACE_CLOSED 仅在 CONFIRM_CLOSE 后、CLOSE_DONE 前由 workspaceMachine 发出
- [ ] `tsc --noEmit` 零错误

---

## 四、Issue 3-B：workspace.db 持久化命令（Rust 端实现）

### 背景

`ipc.ts` 中已声明 `savePendingDiff`、`updateDiffStatus`、`loadDiffsFromWorkspace`、`saveChatMessages`、`loadChatMessages` 五个 IPC stub，但 `src-tauri/src/lib.rs` 中尚未实现对应的 Tauri command。本 Issue 在 Rust 端实现这五个命令，同时将 `loadDiffsFromWorkspace` 接入 Loading 序列，将 `saveChatMessages` 接入 WORKSPACE_CLOSED 清理序列。

### 修改范围

**修改文件**

| 文件 | 改动 |
|------|------|
| `src-tauri/src/lib.rs` | 新增 5 个 Tauri command（见下规范）；register 到 `Builder::invoke_handler` |

### 五个 Rust Command 规范

#### `save_pending_diff(workspace_root, diff: PendingDiffRecord)`

```rust
/*
 * @GOV
 * codes: BR-DE-PERSIST-002
 * type: IMPL
 * chain: DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF
 * rules: BR-DE-PERSIST-002
 * boundary: in=PendingDiffRecord and workspace_root path | out=pending_diffs row upserted to WorkspaceDatabase
 * term_ref: TERM-WS-002, TERM-DE-001, TERM-DE-005
 */
```

- SQL：`INSERT OR REPLACE INTO pending_diffs (...) VALUES (...)`
- 字段映射：`PendingDiffRecord` → `pending_diffs` 表（WS-M-P-01 §3.2）
- `applied_range_from` / `applied_range_to`：`Option<i64>`（`null` 映射为 `NULL`）

#### `update_diff_status(workspace_root, diff_id, status)`

```rust
/*
 * @GOV
 * codes: BR-DE-PERSIST-002
 * type: IMPL
 * chain: DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF
 * rules: BR-DE-PERSIST-002
 * boundary: in=diff_id string and status string | out=pending_diffs.status updated in WorkspaceDatabase
 * term_ref: TERM-WS-002, TERM-DE-001
 */
```

- SQL：`UPDATE pending_diffs SET status = ?2 WHERE id = ?1`
- status 值集合：`pending | preapplied | accepting | rejecting | expired | accepted | rejected | error`

#### `load_diffs_from_workspace(workspace_root)`

```rust
/*
 * @GOV
 * codes: BR-DE-PERSIST-002, BR-WS-STATE-002
 * type: IMPL
 * chain: WS-OPEN, DE-CREATE-DIFF
 * rules: BR-DE-PERSIST-002, BR-WS-STATE-002
 * boundary: in=workspace_root path | out=PendingDiffRecord list of non-terminal PendingDiff rows from WorkspaceDatabase
 * term_ref: TERM-WS-002, TERM-DE-001, TERM-DE-005
 */
```

- SQL：`SELECT * FROM pending_diffs WHERE status NOT IN ('accepted','rejected','expired','error')`
- 返回：`Vec<PendingDiffRecord>`（字段映射同上）

#### `save_chat_messages(workspace_root, messages: Vec<ChatMessageRecord>)`

```rust
/*
 * @GOV
 * codes: BR-AG-PERSIST-001
 * type: IMPL
 * chain: WS-CLOSE, AG-SEND-MESSAGE
 * rules: BR-AG-PERSIST-001
 * boundary: in=AgentMessage list and workspace_root path | out=chat_messages table upserted to WorkspaceDatabase
 * term_ref: TERM-WS-002, TERM-AG-010, TERM-AG-013
 */
```

- SQL（事务）：`DELETE FROM chat_messages WHERE session_id = ?1`，再批量 `INSERT INTO chat_messages ...`
- `session_id` = `workspace_root`（同一 Workspace 内唯一）

#### `load_chat_messages(workspace_root)`

```rust
/*
 * @GOV
 * codes: BR-AG-PERSIST-001
 * type: IMPL
 * chain: WS-OPEN, AG-SEND-MESSAGE
 * rules: BR-AG-PERSIST-001
 * boundary: in=workspace_root path | out=ChatMessageRecord list ordered by created_at from WorkspaceDatabase chat_messages
 * term_ref: TERM-WS-002, TERM-AG-010, TERM-AG-013
 */
```

- SQL：`SELECT * FROM chat_messages WHERE session_id = ?1 ORDER BY created_at ASC`
- 返回：`Vec<ChatMessageRecord>`

### Loading / Closing 序列接入

| 时机 | 调用 | 规则 |
|------|------|------|
| Loading 序列第 3 步（DB 初始化后）| `load_diffs_from_workspace` → 重建 diffMachine 实例列表 | BR-WS-STATE-002 |
| WORKSPACE_CLOSED 清理序列（chatMachine action）| `save_chat_messages` → 持久化 AgentMessage | BR-AG-PERSIST-001 |
| LOAD_SUCCEEDED 时（chatMachine）| `load_chat_messages` → 恢复历史对话 | BR-AG-PERSIST-001 |

### cargo 测试要求

新增 `lib.rs` 内联测试模块，覆盖：

| 测试 | 场景 | 断言 |
|------|------|------|
| `test_save_and_load_pending_diff` | 写入一条 PendingDiff，读回 | 字段完整，status = pending |
| `test_update_diff_status` | 写入后更新 status → expired | 读回 status = expired |
| `test_load_excludes_terminal` | 写入 accepted/rejected 各一条 | load_diffs_from_workspace 返回空 |
| `test_save_and_load_chat_messages` | 写入 3 条 AgentMessage，读回 | 顺序、字段完整 |
| `test_save_chat_messages_replaces` | 写入两批（同 session_id）| 读回只有第二批 |

### 验收标准（Issue 3-B）

- [ ] `cargo test` 全部通过（含 5 个新 DB 测试）
- [ ] `load_diffs_from_workspace` 只返回非终态记录（accepted/rejected/expired/error 不返回）
- [ ] `save_chat_messages` 对同一 workspace 覆盖写（先 DELETE 再 INSERT）
- [ ] `load_chat_messages` 结果按 created_at 升序
- [ ] 五个 command 已注册在 `invoke_handler` 中（`tsc --noEmit` 不报 IPC stub 类型错误）
- [ ] Loading 序列第 3 步调用 `load_diffs_from_workspace`（workspaceActor 接入）

---

## 五、Issue 3-C：SearchPanel 搜索接线

### 背景

SearchPanel 骨架已在 Phase 2 交付，但 `onSearchQueryChange` 仅更新本地 state，`searchResults` 始终为空数组。`search_files` Rust command 已实现（FTS5 查询，最多 20 条结果）。本 Issue 将 SearchPanel 与 FTS5 SearchIndex 对接。

### 修改范围

**修改文件**

| 文件 | 改动 | 规则 |
|------|------|------|
| `src/App.tsx` | 添加 debounced search 逻辑；将 SearchResult[] 传入 FileTreePanel | BR-WS-DATA-005 |

**新建文件（可选）**

| 文件 | 用途 |
|------|------|
| `src/hooks/useWorkspaceSearch.ts` | 封装 debounce + `search_files` IPC 调用；隔离搜索副作用 |

### 接线协议

```
SearchPanel onSearchQueryChange(query)
→ 更新 searchQuery state
→ debounce 300ms
→ query.trim() === "" → 清空 searchResults，不调用 IPC
→ query.trim() !== "" → 调用 search_files(workspaceRoot, query)
  → 成功 → 设置 searchResults（SearchResult[]）→ FileTreePanel → SearchPanel 展示
  → 失败（索引不可用）→ 设置 searchResults = []，可选展示错误提示
→ workspaceMachine 非 Active 状态 → 不调用 search_files
```

**文件变动触发 stale（BR-WS-DATA-005 stale 策略）**

文件管理操作（create/rename/move/delete）完成后：
- 重置 searchResults = []（清空旧结果）
- 下一次搜索时 Rust 端 `search_files` 发现 stale 自动重建（已在 Rust 端实现）

### @GOV 块（useWorkspaceSearch.ts）

```typescript
/**
 * @GOV
 * codes: BR-WS-DATA-005
 * type: RB
 * chain: WS-SEARCH
 * rules: BR-WS-DATA-005
 * boundary: in=workspace search query string from SearchPanel and workspaceMachine Active state | out=SearchResult list from SearchIndex FTS5 via search_files IPC, with debounce and stale-on-mutation reset
 * term_ref: TERM-CORE-001, TERM-WS-005, TERM-WS-006
 */
```

### 验收标准（Issue 3-C）

- [ ] 在 Active Workspace 中输入关键词，SearchPanel 300ms 后展示 FTS5 结果（≤20 条）
- [ ] 结果 `filePath` 为 Workspace 相对路径（无绝对路径）
- [ ] `.binder` 目录下文件不出现在结果中（BR-WS-DATA-005）
- [ ] 清空搜索框 → 结果列表消失，FileTree 正常展示（SearchPanel "无匹配结果"仅在非空 query 时显示）
- [ ] 搜索结果点击 → 触发 onSearchResultClick → 在 EditorColumn 中打开对应文件
- [ ] 文件操作（create/rename/delete）后旧搜索结果清空，新查询触发重建
- [ ] workspaceMachine 非 Active 状态下（Loading/Closing/Error/NoWorkspace）不触发 search_files
- [ ] `tsc --noEmit` 零错误

---

## 六、Issue 3-D：FileTree 文件管理 UI

### 背景

FileTree 目前只有点击文件打开的功能。FileTreePanel 的 `onFileClick` 已接通 EditorColumn，但创建/重命名/删除等操作无 UI 入口。对应的 Rust IPC 命令（`create_workspace_file`、`create_workspace_folder`、`rename_workspace_item`、`move_workspace_item`、`delete_workspace_item`）均已实现。本 Issue 在 FileTree 组件内提供最小可用的文件管理操作 UI。

### 修改范围

**修改文件**

| 文件 | 改动 | 规则 |
|------|------|------|
| `src/components/FileTree.tsx` | FileTreeNode hover 显示操作按钮；内联创建/重命名输入框；删除确认对话框 | BR-WS-DATA-001/002/003/004, BR-AG-TOOL-001 |
| `src/App.tsx` | 将 FileTree 操作回调接入已有 handleCreate/Rename/Delete handlers | BR-WS-DATA-001/002/003 |

**新建文件**

| 文件 | 用途 |
|------|------|
| `src/components/DeleteConfirmDialog.tsx` | 删除前二次确认对话框（BR-WS-DATA-003）|

### 文件管理 UI 规范

#### FileTreeNode 操作入口（hover 态）

```
FileTreeNode（文件或目录）hover 时展示：
├─ 文件节点：[重命名] [删除]
└─ 目录节点：[新建文件] [新建文件夹] [重命名] [删除]
```

图标/按钮样式：紧凑小按钮，`font-size: 11px`，`color: var(--text-muted)`，hover → `var(--text-primary)`

#### 内联创建（目录节点）

1. 用户点击 [新建文件] 或 [新建文件夹]
2. 在目录节点下方展示内联文本输入框（`autoFocus`）
3. Enter：调用 `create_workspace_file` / `create_workspace_folder`
   - 成功 → 关闭输入框，刷新 entries
   - PathConflict → 输入框边框变红，展示冲突提示（BR-WS-DATA-002）
4. Escape → 取消，输入框消失

#### 内联重命名

1. 用户点击 [重命名]
2. 文件名变为可编辑输入框（预填当前文件名，全选）
3. Enter：调用 `rename_workspace_item`
   - 成功 → 退出编辑，刷新 entries
   - PathConflict → 展示冲突提示
4. Escape → 取消

#### 删除确认（BR-WS-DATA-003）

1. 用户点击 [删除]
2. 展示 `DeleteConfirmDialog`：
   ```
   标题：确认删除
   正文：{filePath} 将被永久删除，无法恢复。
   按钮：[取消]  [确认删除]
   ```
3. 用户点击"确认删除" → 调用 `delete_workspace_item` → 刷新 entries
4. 用户点击"取消" → 对话框关闭，不执行操作

**PathConflict 错误展示（BR-WS-DATA-002, BR-AG-TOOL-001）**

所有 WorkspaceMutationResult 返回 `conflict !== undefined` 时：
- 操作入口关闭（不再发起新请求）
- 在 FileTreePanel 上方展示短暂错误条（`color: var(--danger)`）：`{conflict.message}`
- 3s 后自动消失或用户点击关闭

### @GOV 块（FileTree.tsx 头部注释更新）

```typescript
/**
 * @GOV
 * codes: BR-WS-DATA-001, BR-WS-DATA-002, BR-WS-DATA-003, BR-WS-DATA-004, BR-AG-TOOL-001
 * type: RB
 * chain: WS-FILE-MANAGE, ED-OPEN-FILE
 * rules: BR-WS-DATA-001, BR-WS-DATA-002, BR-WS-DATA-003, BR-WS-DATA-004, BR-AG-TOOL-001
 * boundary: in=WorkspaceEntry list and workspace root path | out=FileNode recursive tree with inline create/rename and DeleteConfirmDialog guarding delete operations; PathConflict surfaced as error banner
 * term_ref: TERM-CORE-001, TERM-WS-001, TERM-WS-004, TERM-WS-005
 */
```

### @GOV 块（DeleteConfirmDialog.tsx）

```typescript
/**
 * @GOV
 * codes: BR-WS-DATA-003
 * type: RB
 * chain: WS-FILE-MANAGE
 * rules: BR-WS-DATA-003
 * boundary: in=FileNode filePath to be deleted | out=DeleteConfirmDialog modal requiring explicit user confirmation before delete_workspace_item IPC is called
 * term_ref: TERM-WS-001
 */
```

### 验收标准（Issue 3-D）

- [ ] 目录节点 hover 显示 [新建文件] [新建文件夹] [重命名] [删除]
- [ ] 文件节点 hover 显示 [重命名] [删除]
- [ ] 内联创建：Enter 调用 IPC，PathConflict 时展示错误，Escape 取消（BR-WS-DATA-002）
- [ ] 内联重命名：Enter 调用 IPC，Escape 取消
- [ ] 删除：必须经 DeleteConfirmDialog 确认后才调用 delete_workspace_item（BR-WS-DATA-003）
- [ ] 所有操作路径在 Workspace 根目录内（BR-WS-DATA-001，Rust 端已守卫）
- [ ] PathConflict 返回后前端展示 conflict.message 错误条（BR-WS-DATA-002, BR-AG-TOOL-001）
- [ ] 操作成功后 entries 刷新，FileTree 更新
- [ ] `tsc --noEmit` 零错误

---

## 七、阶段性验证方案

### 验证门禁顺序

```
Issue 3-A ──── actor 门禁 ──→ Issue 3-B ──── 持久化门禁
     ↓                              ↓
（并行可能）             Issue 3-C + Issue 3-D（可与 3-B 并行推进）
     ↓                              ↓
            Phase 3 综合验证（governance:generate + vitest + cargo test）
```

| Issue | 门禁条件 |
|-------|---------|
| 3-A 完成后 | `tsc --noEmit` 通过；workspaceMachine actor 驱动 FileTreePanel 状态切换；WORKSPACE_OPENED/CLOSED 仅由 workspaceMachine 发出 |
| 3-B 完成后 | `cargo test` 全部通过（含 5 个 DB 测试）；`load_diffs_from_workspace` 接入 Loading 序列 |
| 3-C 完成后 | `tsc --noEmit` 通过；搜索有结果返回且 `.binder` 不出现 |
| 3-D 完成后 | `tsc --noEmit` 通过；文件管理三项操作（create/rename/delete）在 FileTree UI 可操作 |

### 映射验证（Phase 3 结束）

```bash
npm run governance:generate
npm run governance:audit
cargo test
npx vitest run
npx tsc --noEmit
```

**预期结果**

| 指标 | Phase 2 基线 | Phase 3 目标 |
|------|------------|------------|
| `@GOV` 块数 | 48 | ≥ 56（新增 workspaceActor, useWorkspaceSearch, FileTree 更新, DeleteConfirmDialog, 5 个 Rust command @GOV）|
| `OWNER_MISSING` | 8 | ≤ 8（不回归；Phase 3 规则已在 workspaceMachine/@GOV 中覆盖）|
| `cargo test` | 11 pass | ≥ 16 pass（+5 DB 测试）|
| `vitest run` | 39 pass | ≥ 42 pass（+governance.phase3-ws.test.ts 至少 3 个用例）|

### 治理测试新增

新增 `tests/governance.phase3-ws.test.ts`，覆盖：

```typescript
// covers: BR-WS-STATE-001, BR-WS-STATE-003
it("workspaceMachine Closing 状态接受 CONFIRM_CLOSE 和 CANCEL_CLOSE")
// covers: BR-WS-STATE-002
it("workspaceMachine Loading 状态接受 LOAD_SUCCEEDED 和 LOAD_FAILED")
// covers: BR-WS-DATA-005
it("search_files 降级：搜索查询非空且 query trim 为空时不触发 IPC")
```

---

## 八、Phase 3 整体验收核查清单

| 检查项 | 规则 | 状态 |
|--------|------|------|
| workspaceMachine actor 以 `useActorRef` 运行，FileTreePanel 由其状态驱动 | BR-WS-STATE-001 | [x] |
| Loading 序列完整（DB 初始化 → FTS5 → loadDiffsFromWorkspace）在 Loading 状态内 | BR-WS-STATE-002 | [x] |
| 无阻断项直接关闭；有 dirty tab 或 preapplied PendingDiff 必须弹确认对话框 | BR-WS-STATE-003 | [x] |
| WORKSPACE_OPENED / WORKSPACE_CLOSED 唯一来源是 workspaceMachine | BR-WS-STATE-001/003 | [x] |
| RecentWorkspace 重复 rootPath 去重，lastOpenedAt 最新优先 | BR-WS-PERSIST-001 | [x] |
| save_pending_diff / update_diff_status / load_diffs_from_workspace Rust 命令实现 | BR-DE-PERSIST-002 | [x] |
| save_chat_messages / load_chat_messages Rust 命令实现 | BR-AG-PERSIST-001 | [x] |
| WORKSPACE_CLOSED → save_chat_messages → 再清空 chatMachine 内存 | BR-AG-PERSIST-001 | [x] |
| load_diffs_from_workspace 接入 Loading 序列（Active 状态可见历史非终态 PendingDiff）| BR-WS-STATE-002 | [x] |
| SearchPanel 输入关键词 300ms 后返回 FTS5 结果；.binder 不进入结果 | BR-WS-DATA-005 | [x] |
| 搜索结果 filePath 为 Workspace 相对路径 | BR-WS-DATA-005 | [x] |
| 搜索结果点击 → EditorColumn 打开对应文件 | BR-WS-DATA-001 | [x] |
| 目录节点 hover 显示创建/重命名/删除操作入口 | BR-WS-DATA-004 | [x] |
| 删除必须经 DeleteConfirmDialog 确认 | BR-WS-DATA-003 | [x] |
| PathConflict 返回后展示 conflict.message 错误条 | BR-WS-DATA-002, BR-AG-TOOL-001 | [x] |
| 文件操作成功后 entries 刷新且搜索结果清空 | BR-WS-DATA-004, BR-WS-DATA-005 | [x] |
| `tsc --noEmit` 零错误 | — | [x] |
| `cargo test` ≥ 16 pass（含 5 个新 DB 测试）| — | [x] 实测 16 pass |
| `npm run governance:generate` @GOV 块数 ≥ 56 | — | [x] 实测 56 块 |
| `npm run governance:audit` OWNER_MISSING ≤ 8 | — | [x] 实测 7 条 |
| `npx vitest run` ≥ 42 pass（含 governance.phase3-ws.test.ts）| — | [x] 实测 44 pass |

---

## 九、代码现状与 Phase 3 改动摘要

| 现状 | Phase 3 后 |
|------|-----------|
| App.tsx：workspaceMachine 骨架存在但未 as actor 运行 | workspaceMachine 以 `useActorRef` 运行；FileTreePanel 由 actor snapshot 驱动 |
| Rust：`save_pending_diff` 等 5 个 IPC 仅为前端 stub | Rust 端 5 个 command 实现；cargo test 覆盖 |
| SearchPanel：searchResults 始终为空数组 | debounced `search_files` IPC 接入；FTS5 结果展示 |
| FileTree：仅有 onFileClick | hover 操作按钮 + 内联 create/rename + DeleteConfirmDialog |
| @GOV 块：48 个 | 新增 ≥ 8 个，覆盖 Phase 3 新增代码 |

---

## 十、与 Phase 4 的边界

Phase 3 交付物不包含：

| 排除项 | 所属 Phase |
|--------|---------|
| editorMachine actor 接线（多标签文件加载）| Phase 4-A |
| TipTap 实例与 editorMachine 联动 | Phase 4-A |
| Cmd+S 保存流程（BR-ED-PERSIST-001）| Phase 4-B |
| BlockIdExtension（BR-ED-DATA-002）| Phase 4-C |

Phase 3 完成后 Phase 4 可立即启动：editorMachine 已接收 WORKSPACE_OPENED/CLOSED，多标签文件加载在 Active 状态下可接线。

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-24 | v1.0 | 初始版本。基于 P-27 大纲 §四 和 WS-M-P-02/P-01/T-01，生成 Phase 3 全量 Issue Trace，含规则映射链图、名词声明、4 个 Issue、阶段验证方案和整体通过标准。OWNER_MISSING 基线 8 条（全为 Phase 5/6 规则，Phase 3 不处理）。 |
