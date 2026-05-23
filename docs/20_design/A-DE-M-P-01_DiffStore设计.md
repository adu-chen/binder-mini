---
文档编号：   DE-M-P-01
文档状态：   A
负责模块：   DE
文档职责：   DiffStore 数据模型、操作接口、持久化策略与跨模块协作边界
上游约束：   CORE-C-P-01、DE-M-D-01、DE-M-T-01、SYS-C-T-01
直接承接：   diffService.ts、diffMachine、Phase 13 Issue Trace
使用边界：   定义 DiffStore 设计约束和接口协议，不写运行时代码
变更要求：   状态字段、操作语义或持久化映射变更时必须同步 DE-M-T-01 和 SYS-C-T-01
---

# DE-M-P-01 DiffStore 设计

## 1. 本文职责

本文定义 diffStore（或等价网关）里存什么、每个操作的语义和状态迁移、何时落盘 workspace.db，以及与 Editor 和 Agent 模块的协作边界。

## 2. 数据模型

### 2.1 PendingDiff（Phase 13-A 最终结构）

（基于 DE-M-T-01 §3.1，不重复技术设计内容，只做接口层声明）

```typescript
interface PendingDiff {
  id: string;
  filePath: string;          // Workspace 相对路径
  originalText: string;      // 生成 diff 时的文件内容快照
  proposedText: string;      // AI 建议的完整内容
  status: PendingDiffStatus;
  summary: string;
  sourceToolId: string;      // Phase 13-A：生成此 diff 的 ToolExecution.id
  baseRevision?: string;     // Phase 13-A：文件内容 hash（快速变化检测）
  createdAt: number;         // Phase 13-A：Unix timestamp
  anchorRef?: DiffAnchorRef; // Phase 13-B：Editor 定位引用
}
```

### 2.2 DiffStore 接口

```typescript
interface DiffStore {
  pendingDiffs: Map<string, PendingDiff>;  // id → PendingDiff
  terminalCards: TerminalDiffCard[];        // 按时间倒序
}
```

DiffStore 是所有 PendingDiff 生命周期操作的唯一收口网关。各工具调用结果不得直接操作 PendingDiff 状态，必须通过 DiffStore 方法或等价服务层。

## 3. 核心操作语义

| 方法 | 语义 | 输入 | 持久化 |
|------|------|------|--------|
| createDiff | 新建 PendingDiff（status=pending）| AG 工具参数 + sourceToolId | 应写入 workspace.db |
| acceptDiff | pending → accepting → terminal(accepted) | diffId | 必须写入磁盘后再更新 DB |
| rejectDiff | pending → rejecting → terminal(rejected) | diffId | 应写入 DB |
| expireDiff | pending → expired → terminal | diffId | 应写入 DB |
| loadDiffsFromWorkspace | Workspace 打开时从 DB 恢复 pending diff | workspaceRoot | 只读 |
| expireAllOnClose | Workspace 关闭时将所有非终态 diff 转 expired | — | 批量写入 DB |

## 4. 状态机与 DiffStore 的关系

每个 PendingDiff 对应一个独立的 diffMachine 实例（状态机实例不持久化，仅在内存中管理）。diffStore 保存状态事实，diffMachine 管理状态迁移逻辑。

关键约束：

1. DiffStore.pendingDiffs 只存 pending/mounted_pending/preapplied 状态的记录（非终态）
2. 终态记录转移到 terminalCards（TerminalDiffCard）
3. 任何状态变化必须先更新 diffStore，再写入 workspace.db，不能只更新内存

## 5. 持久化协议

### 5.1 workspace.db 表映射

写入位置：`.binder/workspace.db`

```sql
-- pending_diffs 表承载 pending 和终态卡片事实
CREATE TABLE pending_diffs (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  original_text TEXT NOT NULL,
  proposed_text TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_tool_id TEXT,
  base_revision TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE terminal_diff_cards (
  diff_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,    -- accepted/rejected/expired/error
  message TEXT NOT NULL,
  source_tool_id TEXT,
  resolved_at INTEGER NOT NULL
);
```

### 5.2 恢复策略

Workspace 重新打开时（loadDiffsFromWorkspace）：

1. 从 pending_diffs 加载 status 为 pending/mounted_pending/preapplied 的记录
2. 对每条记录：读取磁盘当前内容，与 originalText 比对（或与 baseRevision hash 比对）
3. 内容一致 → 恢复为 pending 状态（mounted_pending/preapplied 降级为 pending，因为编辑器状态不可恢复）
4. 内容不一致 → 自动转 expired，写入 terminal_diff_cards
5. accepting/rejecting 状态（中断执行）→ 转 error，写入 terminal_diff_cards

### 5.3 Workspace 关闭时

expireAllOnClose 在 Workspace 关闭时执行：

1. 将所有非终态 PendingDiff 转 expired
2. 批量写入 terminal_diff_cards
3. 清空 pending_diffs 中的非终态记录

## 6. 一致性不变量

1. UI 不维护独立 diff 副本，统一读取 diffStore
2. accepted/rejected/expired/error 终态不可回退到 pending
3. 内容写操作不得绕过 diffStore 直接写磁盘
4. accept 前必须校验当前磁盘内容与 originalText 一致；不一致时转 expired，不执行写入（承接 DE-CAND-STATE-004）
5. mounted_pending/preapplied 状态只适用于已打开文件；未打开文件的 diff 直接从 pending 接受或拒绝（承接 DE-CAND-STATE-005）
6. preapplied → reject 必须触发编辑器缓冲区回滚，不得只记录终态留下游离内容

## 7. 跨模块协作

### 7.1 与 AG

- agentService 调用 DE 工具路由（edit_current_editor_document / update_file）后，由 DE 层创建 PendingDiff
- AG 提供 sourceToolId（ToolExecution.id），DE 在 createDiff 时记录

### 7.2 与 ED

- accept 时：DE 写磁盘前读取 ED 当前编辑器内容做一致性校验
- preapplied → reject 时：DE 调用 ED 的缓冲区回滚接口（协议待 Phase 13-B 确认）
- Workspace 打开时：ED 可查询 diffStore 当前文件的 pending diff 展示绿审态骨架（Phase 9-F）

### 7.3 与 WS

- Workspace 进入 active 时调用 loadDiffsFromWorkspace
- Workspace 关闭时调用 expireAllOnClose
- accept 落盘时路径必须在 workspaceRoot 内（WS 边界约束）

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-23 | v1.0 | 初始版本，定义 binder-mini DiffStore 接口协议和持久化策略（参考 binder-core DE-M-P-01 适配简化架构）|
