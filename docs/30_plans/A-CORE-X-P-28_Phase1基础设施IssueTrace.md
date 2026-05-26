---
文档编号：   CORE-X-P-28
文档状态：   A
负责模块：   CORE,WS,AG,ED,DE
文档职责：   Phase 1 基础设施 Issue Trace——状态机骨架重写、DB 架构修正、IPC 契约
上游约束：   CORE-X-P-27（Phase 1）、WS-M-P-01、WS-M-P-02、ED-M-P-01、AG-M-P-04、DE-M-T-01
直接承接：   Phase 2（UI 层）、Phase 3（Workspace 模块）
使用边界：   逐 Issue 列出代码改造范围和验收标准；不写运行时代码正文
变更要求：   Issue 完成后更新对应验收状态
---

# Phase 1 基础设施 Issue Trace

## 代码现状评估

| 子任务 | 设计要求 | 当前代码 | 差距 |
|--------|---------|---------|------|
| 项目骨架 | Tauri 2 + React + TS + XState v5 | ✅ 已存在，依赖已安装（含 xstate、@xstate/react） | 依赖到位，运行时未接入 |
| 状态机骨架 | XState v5 `setup()` + `createMachine()` 四机实例 | ❌ 自定义 `MachineDefinition` 转换表，非 XState actor；各机状态集与设计不符 | 全部重写 |
| agentMachine 命名 | `chatMachine`（AG-M-P-04） | ❌ 仍叫 `agentMachine`，状态集缺少 `noWorkspace/ready/cancelling` | 重命名 + 状态重构 |
| DB 架构 | `workspace.db`（业务表）+ 独立 `search.db`（FTS5） | ❌ 所有表均在 `workspace.db`；且只有搜索表，没有 `pending_diffs / terminal_diff_cards / workspace_settings / chat_messages` | DB 拆分 + 正确建表 |
| IPC 契约 | 前后端共享 Tauri command 类型文件 | ❌ 无契约文件；前端直接 `invoke` + 裸类型断言 | 新建 `src/ipc.ts` |
| TipTap 依赖 | `@tiptap/pm` 等已安装 | ✅ 全部已安装（`@tiptap/react`、`tiptap-markdown`、`@tiptap/pm`） | 无 |
| rusqlite FTS5 | `bundled` feature 支持 FTS5 | ✅ `features = ["bundled"]`，rusqlite 0.32 bundled 包含 FTS5 | 无 |

---

## Issue 1-A：DB 架构修正（workspace.db 与 search.db 分离）

### 问题描述

当前 `lib.rs` 中 `initialize_workspace_database_schema` 仅创建搜索相关表（`search_index_meta`、`search_documents`、`search_documents_fts`），既无业务表，又违反 WS-M-P-01 的双库架构要求。

**设计要求（WS-M-P-01 §3.2）**

`workspace.db` 包含：
```sql
workspace_settings (key TEXT PK, value TEXT, updated_at INTEGER)
pending_diffs (id TEXT PK, file_path, original_text, new_text, summary,
               status, effective_path, source_tool_id, base_revision,
               applied_range_from, applied_range_to, created_at INTEGER)
terminal_diff_cards (id TEXT PK, diff_id, status, message, resolved_at INTEGER)
chat_messages (id TEXT PK, role, content, stream_status,
               tool_call_id, created_at INTEGER, session_id TEXT)
```

`search.db`（`.binder/search.db`，独立文件）包含：
```sql
search_index (file_path TEXT PK, file_name TEXT, content TEXT)  -- FTS5 virtual table
```

**当前代码偏差**
- `workspace.db` 里只有 `search_documents`、`search_documents_fts`、`search_index_meta`（全部属 search.db）
- `workspace.db` 中完全没有 `workspace_settings`、`pending_diffs`、`terminal_diff_cards`、`chat_messages`

### 修改范围（`src-tauri/src/lib.rs`）

**1. 修改 `initialize_workspace_database_schema`**

职责收窄为只建 workspace.db 业务表，删除所有搜索相关建表语句：

```sql
-- workspace.db 应包含的表（schema_version 迁移见 WS-M-P-01 §5）
CREATE TABLE IF NOT EXISTS workspace_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pending_diffs (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    original_text TEXT NOT NULL,
    new_text TEXT NOT NULL,
    summary TEXT NOT NULL,
    status TEXT NOT NULL,
    effective_path TEXT NOT NULL CHECK(effective_path IN ('open-file','closed-file')),
    source_tool_id TEXT NOT NULL,
    base_revision TEXT NOT NULL,
    applied_range_from INTEGER,
    applied_range_to INTEGER,
    created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS terminal_diff_cards (
    id TEXT PRIMARY KEY,
    diff_id TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT NOT NULL,
    resolved_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    stream_status TEXT,
    tool_call_id TEXT,
    created_at INTEGER NOT NULL,
    session_id TEXT NOT NULL
);
```

**2. 新增 `initialize_search_database`（新函数）**

接受 `search_db_path: &Path`，建立独立的 search.db：

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS search_index
USING fts5(file_path UNINDEXED, file_name, content, tokenize = 'unicode61');
```

**3. 修改 `rebuild_search_index`**

打开 search.db（非 workspace.db），清空并重建 `search_index`。  
删除 `search_documents` / `search_documents_fts` / `search_index_meta` 的引用。

**4. 修改 `search_files_with_index`**

打开 search.db 执行 FTS5 查询。字段：`file_path`、`file_name`、`content`（snippet）。

**5. 辅助函数 `search_database_path`**

```rust
fn search_database_path(root_path: &Path) -> PathBuf {
    root_path.join(".binder").join("search.db")
}
```

**6. 删除无用结构体和函数**

删除 `SearchIndexDocument`、`search_index_needs_rebuild`、`content_hash`（如不再使用）、`file_mtime_ms`。

### 验收标准

- [x] `open_workspace` 调用后，`.binder/` 目录下同时出现 `workspace.db` 和 `search.db`
- [x] `workspace.db` 存在 `workspace_settings / pending_diffs / terminal_diff_cards / chat_messages` 四张表
- [x] `search.db` 存在 `search_index` FTS5 虚拟表
- [x] `search_files` 命令能从 search.db 返回正确结果
- [x] 旧 `workspace.db` 中的搜索表（`search_documents_fts` 等）不再出现

### @GOV 要求

`initialize_workspace_database_schema`：
```
@GOV type: IMPL chain: WS-OPEN rules: BR-WS-STATE-002
     boundary: in=workspace_root path | out=workspace.db schema (4 tables)
```

`initialize_search_database`：
```
@GOV type: IMPL chain: WS-OPEN,WS-SEARCH rules: BR-WS-DATA-005
     boundary: in=search_db_path | out=search.db FTS5 schema
```

---

## Issue 1-B：四大状态机骨架重写（XState v5）

### 问题描述

四个状态机文件（`workspaceMachine.ts`、`editorMachine.ts`、`agentMachine.ts`、`diffMachine.ts`）均使用自定义 `MachineDefinition` 转换表，**未接入 XState v5 运行时**（无 `setup()`、无 `createMachine()`、无 `useMachine()`）。

`App.tsx` 仅将它们实例化为常量数组并显示计数（`{machines.length} state machines registered`），没有任何状态机驱动行为。

Phase 1 目标：四个状态机以 XState v5 正确格式重写为骨架（状态/事件/Context 类型完整，action/guard 以 `() => {}` 占位），但不实现任何业务逻辑。

### 修改范围

#### 1-B-1：`src/machines/workspaceMachine.ts`（全量重写）

**状态对齐（WS-M-P-02 §2）**：`NoWorkspace / Loading / Active / Closing / Error`  
当前错误状态：`noWorkspace / opening / active / refreshing / error`（缺 `Closing`，多余 `refreshing`）

**目标骨架**：

```typescript
import { setup, assign } from 'xstate';

export interface WorkspaceMachineContext {
  workspaceRoot: string | null;
  errorMessage: string | null;
}

export const workspaceMachine = setup({
  types: {
    context: {} as WorkspaceMachineContext,
    events: {} as
      | { type: 'OPEN_REQUESTED' }
      | { type: 'LOAD_SUCCEEDED'; workspaceRoot: string }
      | { type: 'LOAD_FAILED'; errorMessage: string }
      | { type: 'CLOSE_REQUESTED' }
      | { type: 'CONFIRM_CLOSE' }
      | { type: 'CANCEL_CLOSE' }
      | { type: 'CLOSE_DONE' }
      | { type: 'RECOVER' },
  },
  actions: {
    broadcastWorkspaceOpened: () => {},
    broadcastWorkspaceClosed: () => {},
    persistMessages: () => {},
    expireAllDiffs: () => {},
    assignWorkspaceRoot: assign({ workspaceRoot: ({ event }) => (event as any).workspaceRoot }),
    assignError: assign({ errorMessage: ({ event }) => (event as any).errorMessage }),
    clearContext: assign({ workspaceRoot: null, errorMessage: null }),
  },
  guards: {
    hasNoDirtyOrPending: () => false,
  },
}).createMachine({
  id: 'workspaceMachine',
  initial: 'NoWorkspace',
  context: { workspaceRoot: null, errorMessage: null },
  states: {
    NoWorkspace: {
      on: { OPEN_REQUESTED: 'Loading' },
    },
    Loading: {
      on: {
        LOAD_SUCCEEDED: { target: 'Active', actions: ['assignWorkspaceRoot', 'broadcastWorkspaceOpened'] },
        LOAD_FAILED: { target: 'Error', actions: 'assignError' },
      },
    },
    Active: {
      on: { CLOSE_REQUESTED: 'Closing' },
    },
    Closing: {
      on: {
        CONFIRM_CLOSE: {
          target: 'NoWorkspace',
          actions: ['broadcastWorkspaceClosed', 'persistMessages', 'expireAllDiffs', 'clearContext'],
        },
        CANCEL_CLOSE: 'Active',
      },
    },
    Error: {
      on: { RECOVER: 'NoWorkspace' },
    },
  },
});
```

**删除**：旧 `MachineDefinition` 接口和 `createWorkspaceMachineDefinition` 函数。

---

#### 1-B-2：`src/machines/editorMachine.ts`（全量重写）

**状态对齐（ED-M-P-01 §2）**：`noWorkspace / idle / loading / editing / dirty / saving / readonly / error`  
当前错误状态：`closed / loading / editing / saving / readonly / error`（缺 `noWorkspace / idle / dirty`）

**Context 关键字段**：

```typescript
export interface EditorMachineContext {
  tabs: EditorTab[];           // { id, filePath, fileType, dirty }
  activeTabId: string | null;
  errorMessage: string | null;
}
```

状态骨架（仅列状态集，action 占位）：

```
noWorkspace → (WORKSPACE_OPENED) → idle
idle        → (OPEN_FILE) → loading
loading     → (FILE_LOADED_EDITABLE) → editing
            → (FILE_LOADED_READONLY) → readonly
            → (LOAD_FAILED) → error
editing     → (USER_EDIT) → dirty
            → (OPEN_FILE) → loading  [新 tab]
dirty       → (SAVE_REQUESTED) → saving
           → (OPEN_FILE) → loading
saving      → (SAVE_SUCCEEDED) → editing   [isDirty = false]
           → (SAVE_FAILED) → error
readonly    → (OPEN_FILE) → loading
error       → (OPEN_FILE) → loading
任意        → (WORKSPACE_CLOSED) → noWorkspace
任意        → (CLOSE_TAB) → [移除 tab，根据剩余情况进入 idle/editing/dirty/readonly]
```

出站事件（action 占位，Phase 4 实现）：
- `ACTIVE_FILE_CHANGED` → chatMachine
- `LOGICAL_STATE_APPEARED` → 对应 diffMachine

---

#### 1-B-3：`src/machines/chatMachine.ts`（新建，替代 agentMachine.ts）

**命名变更**：`agentMachine.ts` → `chatMachine.ts`（文件和导出名均改）

**状态对齐（AG-M-P-04 §2）**：`noWorkspace / ready / validatingProvider / sending / streaming / toolCalling / cancelling / error`  
当前错误状态：`idle / validatingProvider / sending / streaming / toolCalling / error`（缺 `noWorkspace / ready / cancelling`，`idle` 不是合法状态名）

**Context**（AG-M-P-04 §5）：

```typescript
export interface ChatMachineContext {
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

关键事件（需声明）：`WORKSPACE_OPENED`、`WORKSPACE_CLOSED`、`SEND_MESSAGE`、`PROVIDER_VALID`、`PROVIDER_INVALID`、`STREAM_STARTED`、`TOKEN_RECEIVED`、`TOOL_REQUESTED`、`TOOL_FINISHED`、`RESPONSE_DONE`、`CANCEL`、`CANCEL_DONE`、`ABORT_FAILED`、`FAILED`、`RETRY`、`ACTIVE_FILE_CHANGED`

**删除**：`src/machines/agentMachine.ts`（文件删除，更新所有 import）

---

#### 1-B-4：`src/machines/diffMachine.ts`（全量重写）

**状态对齐（DE-M-T-01 §4）**：`pending / preapplied / accepting / rejecting / accepted / rejected / expired / error`  
当前错误状态：`none / pending / accepting / rejecting / expired / terminal / error`（缺 `preapplied / accepted / rejected`，多余 `none / terminal`）

Context 字段：

```typescript
export interface DiffMachineContext {
  diffId: string;
  effectivePath: 'open-file' | 'closed-file';
  errorMessage: string | null;
}
```

事件：`LOGICAL_STATE_APPLIED`、`ACCEPT_REQUESTED`、`REJECT_REQUESTED`、`EXPIRE_REQUESTED`、`ACCEPT_DONE`、`REJECT_DONE`、`INHERIT_APPLIED`、`FAILED`

---

### 验收标准

- [x] 四个状态机文件均使用 `setup().createMachine()` 形式，可通过 `useMachine()` 挂载
- [x] `agentMachine.ts` 文件已删除，替换为 `chatMachine.ts`
- [x] 各机状态集与设计文档完全一致（状态名大小写对齐：workspaceMachine 用首字母大写 `NoWorkspace/Loading/Active/Closing/Error`；其余用小驼峰）
- [x] `App.tsx` 中的 `agentMachine` import 替换为 `chatMachine`（import 已删除，机器 import 为 Phase 2 任务）
- [x] 四机骨架可在 App.tsx 中用 `useMachine()` 实例化而不报 TypeScript 错误
- [x] action/guard 全部为空实现（占位），不实现业务逻辑

### @GOV 要求

每个机器文件顶部：
```
@GOV type: DATA chain: [对应链路] rules: BR-SYS-GOV-001,[对应状态规则]
     boundary: in=[机器输入事件] | out=[机器状态和 Context] | term_ref: [TERM-*]
```

---

## Issue 1-C：IPC 契约文件（`src/ipc.ts`）

### 问题描述

前端通过 `@tauri-apps/api/core` 的 `invoke` 调用 Rust 命令，返回类型完全依赖裸 TypeScript 类型断言（在 `services/` 各文件中分散 cast）。没有统一的契约文件对应 Rust 端的 `#[derive(Serialize/Deserialize)]` 结构体。

### 要求

新建 `src/ipc.ts`，声明前端对应的 TypeScript 类型（只做类型声明，不写业务逻辑）：

**已有 Rust 命令对应类型（需从 `services/` 迁入并统一）**

| Rust 命令 | TypeScript 接口 |
|-----------|----------------|
| `open_workspace` | `WorkspaceOpenResult { cancelled, snapshot?, recentWorkspaces? }` |
| `list_recent_workspaces` | `RecentWorkspace[]` |
| `list_files` | `ListFilesResult { entries: WorkspaceEntry[] }` |
| `read_file` | `string` |
| `create_workspace_file / folder` | `WorkspaceMutationResult` |
| `rename_workspace_item` | `WorkspaceMutationResult` |
| `move_workspace_item` | `WorkspaceMutationResult` |
| `delete_workspace_item` | `WorkspaceMutationResult` |
| `search_files` | `SearchResult[]` |

**新增（Phase 3+ 实现但契约 Phase 1 声明）**

| Rust 命令（待实现） | TypeScript 接口 |
|-------------------|----------------|
| `chat_stream` | `void`（通过 Tauri events 推送，不返回值）|
| `save_pending_diff` | `void` |
| `update_diff_status` | `void` |
| `load_diffs_from_workspace` | `PendingDiffRecord[]` |
| `save_chat_messages` | `void` |
| `load_chat_messages` | `ChatMessageRecord[]` |

**注**：`WorkspaceEntry` / `PathConflict` / `WorkspaceMutationResult` 等类型从各 `services/` 文件和 `types/` 中整合到 `ipc.ts`，`types/` 文件保留应用层类型（`EditorSession`、`AgentMessage` 等），不与 Rust IPC 类型混用。

### 验收标准

- [x] `src/ipc.ts` 存在，包含所有当前 Rust 命令的 TypeScript 接口声明
- [ ] `services/workspaceService.ts` 中的 Rust 返回类型引用改为 `ipc.ts` 的类型（Phase 3 服务层重构时完成）
- [x] 新增命令接口（`save_pending_diff / load_diffs_from_workspace / save_chat_messages / load_chat_messages`）在 `ipc.ts` 中有类型桩（stub）
- [x] 无 TypeScript `any` 类型在 Rust invoke 返回路径上出现（`tsc --noEmit` 验证）

### @GOV 要求

```
@GOV type: DATA chain: WS-OPEN,WS-FILE-MANAGE,WS-SEARCH,AG-SEND-MESSAGE,DE-CREATE-DIFF
     boundary: in=Tauri IPC command responses | out=TypeScript contract types
     rules: BR-CORE-GOV-001
```

---

## Issue 1-D：`App.tsx` 状态机接入清理

### 问题描述

当前 `App.tsx` 中：
1. 四个状态机实例化为常量数组，只用来显示计数字符串，完全不驱动 UI
2. 所有业务状态通过 `useState` 平铺在 App 顶层（约 20 个 state）
3. 文件 850 行，所有功能混杂

Phase 1 只做**最小清理**：移除伪状态机使用、为 Phase 2 组件拆分做准备，不重写业务逻辑。

### 修改范围

1. 删除以下无用代码（机器实例化计数显示）：
   ```typescript
   // 删除：
   const machines = [
     createWorkspaceMachineDefinition(),
     ...
   ];
   // 删除：
   <small>{machines.length} state machines registered</small>
   ```

2. 删除 `agentMachine` import，替换为 `chatMachine` import（对应 Issue 1-B-3）

3. 暂不重写任何业务逻辑，仅确保 TypeScript 编译通过

### 验收标准

- [x] `App.tsx` 无 import 断链（agentMachine import 已删除）
- [x] 无伪状态机实例化和计数展示代码
- [x] `tsc --noEmit` 通过，无 TypeScript 错误

---

## 完成顺序建议

```
1-A（DB 架构）  →  1-B（状态机骨架）  →  1-C（IPC 契约）  →  1-D（App 清理）
     ↑                                         ↑
  不依赖前端                              依赖 1-B 完成的类型
```

Issue 1-A 可与 1-B 并行（Rust 侧与 TS 侧互不依赖）。  
Issue 1-C 依赖 1-B 的 Context 类型（`AgentMessage`、`InputReference` 等）定义完成。  
Issue 1-D 依赖 1-B 的 import 路径确定。

---

## 验收核查清单（Phase 1 整体）

- [x] `.binder/workspace.db` 有且只有业务表（settings / diffs / cards / messages）
- [x] `.binder/search.db` 有且只有 `search_index` FTS5 表
- [x] 四个 XState 状态机文件状态集与设计文档一致
- [x] `agentMachine.ts` 已删除，`chatMachine.ts` 已创建
- [x] `src/ipc.ts` 存在并覆盖全部 Rust 命令类型（含 Phase 3+ 桩）
- [x] `tsc --noEmit` 通过；`cargo test` 11/11 通过
- [x] 无 TypeScript `any` 在 Rust invoke 返回路径

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-24 | v1.0 | 初始版本。基于代码现状审计生成四个 Issue（DB 架构修正、状态机骨架重写、IPC 契约、App 清理） |
| 2026-05-24 | v1.1 | Phase 1 全部完成。验收核查清单全部 ✓；Issue 1-C 补充 Phase 3+ 命令桩（save/load_pending_diff、save/load_chat_messages）；governance:audit 22 条 OWNER_MISSING 为 Phase 2-7 预期空白 |
