---
文档编号：   WS-M-P-01
文档状态：   A
负责模块：   WS
文档职责：   workspace.db 数据库结构规范、初始化流程和迁移策略
上游约束：   CORE-C-P-01、WS-M-D-01、DE-M-T-01、SYS-C-T-01
直接承接：   WorkspaceDatabase 实现、Phase 13-D Issue Trace、workspace.db 相关 Tauri command
使用边界：   定义表结构和约束，不写 Rust SQL 实现代码
变更要求：   表结构、字段、索引或迁移策略变更时必须同步本文和相关 Issue Trace
---

## 1. 本文职责

本文定义 `.binder/workspace.db` 的完整表结构、初始化流程、迁移策略、hash 计算方式和并发访问约束。workspace.db 是当前 Workspace 的本地事实存储，存储文件全文搜索索引和 Diff Review 状态。

## 2. 文件位置与创建时机

- 存储路径：`{workspaceRoot}/.binder/workspace.db`
- 创建时机：Workspace 首次打开时（workspaceMachine → Loading 阶段）
- 如果 `.binder` 目录不存在，先创建目录再创建数据库文件
- 已有 workspace.db 时，打开并执行迁移检查（不重建）

## 3. 表结构定义

### 3.1 文件全文搜索索引（FTS5）

```sql
-- 已实现（Phase 7/WS FTS5）
CREATE VIRTUAL TABLE IF NOT EXISTS files USING fts5(
  path,           -- Workspace 相对路径（主键语义）
  content,        -- 文件文本内容
  tokenize = 'unicode61'
);

-- 用于非 FTS5 降级查询的元数据表（可选）
CREATE TABLE IF NOT EXISTS file_metadata (
  path TEXT PRIMARY KEY,
  modified_at INTEGER,
  size INTEGER
);
```

### 3.2 Diff Review 状态表（Phase 13-D）

```sql
-- PendingDiff 和终态记录（统一存储）
CREATE TABLE IF NOT EXISTS pending_diffs (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  original_text TEXT NOT NULL,
  proposed_text TEXT NOT NULL,
  status TEXT NOT NULL,     -- pending/mounted_pending/preapplied/accepted/rejected/expired/error
  summary TEXT NOT NULL,
  source_tool_id TEXT,      -- Phase 13-A：关联 ToolExecution.id
  base_revision TEXT,       -- Phase 13-A：文件内容 hash
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS terminal_diff_cards (
  diff_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,     -- accepted/rejected/expired/error
  message TEXT NOT NULL,
  source_tool_id TEXT,
  resolved_at INTEGER NOT NULL
);
```

### 3.3 Workspace 配置表（可选）

```sql
-- Workspace 级别的键值配置（非用户级配置）
CREATE TABLE IF NOT EXISTS workspace_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER
);
```

注：用户级配置（最近 Workspace 列表等）存储在系统 app config 路径（Tauri `app_config_dir()`），不在 workspace.db 中。

## 4. 初始化流程

```
1. workspaceMachine → Loading
2. SYS: 确认 {workspaceRoot}/.binder/ 目录存在（不存在则创建）
3. SYS: 打开或创建 {workspaceRoot}/.binder/workspace.db
4. DB: 检查 schema 版本（从 workspace_settings 读取 schema_version）
5. 若版本低于当前版本：执行迁移 DDL（见 §5）
6. DB: 执行建表 DDL（CREATE TABLE IF NOT EXISTS，幂等）
7. WS: 重建 FTS5 索引（扫描 Workspace 文件，写入 files 表）
8. DE: 调用 loadDiffsFromWorkspace（加载 pending_diffs 中的非终态记录）
9. workspaceMachine → Active
```

## 5. 迁移策略

### 5.1 版本追踪

在 workspace_settings 表中存储 schema_version：
```sql
INSERT OR REPLACE INTO workspace_settings (key, value, updated_at)
VALUES ('schema_version', '2', unixepoch());
```

### 5.2 迁移规则

| 目标版本 | 迁移内容 |
|----------|----------|
| v1 | 初始版本：files FTS5 表 |
| v2 | Phase 13-D：pending_diffs + terminal_diff_cards 表 |

迁移原则：
- 只允许向前迁移（升版本），不支持降版本
- 迁移必须幂等（使用 CREATE TABLE IF NOT EXISTS，ALTER TABLE ADD COLUMN IF NOT EXISTS）
- 迁移失败时 Workspace 进入 error 状态，提示用户手动处理
- 不自动删除旧数据（只新增表/列，不 DROP 已有结构）

### 5.3 未解决问题（NEEDS_HUMAN_DECISION）

workspace.db 迁移在 schema 有破坏性变更时（如删除字段、重命名表）的处理策略尚未决策。当前只支持向前兼容迁移（新增表/列），破坏性变更需要人类明确确认策略：
- 选项 A：备份原 workspace.db，以新 schema 重建（需重建 FTS5 索引）
- 选项 B：拒绝打开，提示用户手动迁移
- 选项 C：忽略新字段，降级运行（可能丢失部分功能）

## 6. baseRevision Hash 计算

baseRevision 用于 PendingDiff 中快速检测文件内容是否在 diff 生成后被外部修改。

计算方式（建议）：
- 算法：SHA-256 of 文件内容字节
- 编码：hex string（64 字符）
- 计算时机：createPendingDiffFromCurrentEditor 调用时，从磁盘读取文件内容后计算
- 用途：shouldExpirePendingDiff 检测时，重新计算当前文件 hash，与 baseRevision 比对；不一致时自动 expire

注：baseRevision 是内部检测字段，不暴露给前端 UI。

## 7. WAL 模式与并发访问

workspace.db 启用 WAL (Write-Ahead Logging) 模式：
```sql
PRAGMA journal_mode=WAL;
```

并发约束：
1. 写操作（INSERT/UPDATE）需要串行化（通过 Rust Mutex 或 tokio Semaphore 保证）
2. 读操作（SELECT）可并发（WAL 模式下读写不阻塞）
3. FTS5 重建（批量写入）必须在 Workspace 初始化时完成，不在运行时并发执行
4. Workspace 关闭时（expireAllOnClose）必须等待所有进行中的写操作完成再关闭连接

## 8. 边界约束

1. workspace.db 只存当前 Workspace 的事实，不跨 Workspace 共享
2. `.binder` 目录建议加入 `.gitignore`（workspace.db 包含本地状态，不应提交）
   - 注：这是建议，是否强制加入 .gitignore 为 NEEDS_HUMAN_DECISION（见 WS-M-D-01 §8 问题暴露清单）
3. FTS5 内容表存储文件内容副本，与磁盘文件可能短暂不一致（下次重建后对齐）
4. pending_diffs 表积累终态记录不自动清理（见 DE-M-P-01 §7 已知风险）

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-23 | v1.0 | 初始版本，定义 workspace.db 完整表结构、初始化流程和迁移策略 |
