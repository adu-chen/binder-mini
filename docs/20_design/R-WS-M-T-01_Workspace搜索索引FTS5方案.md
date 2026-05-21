---
文档编号：   WS-M-T-01
文档状态：   R
负责模块：   WS
文档职责：   Workspace 搜索索引 FTS5 技术方案
上游约束：   CORE-C-P-01、WS-M-D-01、SYS-C-T-01、SYS-C-T-02
直接承接：   后续 Workspace 搜索索引实现 Issue Trace
使用边界：   定义搜索索引方案，不替代已注册技术规则，不直接驱动代码实现
变更要求：   进入实现前必须在 SYS-C-T-01 注册正式 RULE 并补测试覆盖
---

# Workspace 搜索索引 FTS5 方案

## 1. 目标

将当前递归文本搜索替换为基于 `workspace.db` 的可重建 FTS5 索引。

搜索索引必须满足：

1. 结果只来自当前 Workspace。
2. `.binder` 内部数据不得进入索引。
3. 索引可重建，不能成为唯一事实来源。
4. 索引不可用时允许降级到当前递归搜索。
5. 结构操作和文件写入后必须能触发索引更新或标记索引失效。

## 2. 数据存储

索引存储位置：

`<workspace>/.binder/workspace.db`

建议 SQLite 表结构：

```sql
CREATE TABLE IF NOT EXISTS search_index_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS search_documents (
  path TEXT PRIMARY KEY,
  mtime_ms INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  indexed_at_ms INTEGER NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS search_documents_fts USING fts5(
  path UNINDEXED,
  content,
  tokenize = 'unicode61'
);
```

约束：

1. `search_documents.path` 使用 Workspace 相对路径。
2. `search_documents_fts.path` 必须与 `search_documents.path` 保持一致。
3. 索引内容只读取文本类文件；二进制或无法 UTF-8 读取的文件跳过。
4. `.binder/**` 永远跳过。

## 3. 重建流程

`rebuild_search_index(workspace_root)`：

1. 解析并 canonicalize Workspace root。
2. 初始化 `.binder/workspace.db`。
3. 开启事务。
4. 清空 `search_documents` 和 `search_documents_fts`。
5. 递归扫描 Workspace。
6. 跳过 `.binder/**`、目录、不可读文件和二进制文件。
7. 写入 `search_documents`。
8. 写入 `search_documents_fts`。
9. 更新 `search_index_meta.index_version`、`search_index_meta.last_rebuild_at_ms`。
10. 提交事务。

失败策略：

1. 事务失败时回滚。
2. 失败不得破坏 Workspace 文件内容。
3. 查询时若索引不可用，降级到递归搜索并返回可审计状态。

## 4. 增量更新

后续实现可以先采用粗粒度重建，再升级到增量更新。

最小实现：

1. 打开 Workspace 后重建索引。
2. `create_file` / `create_folder` / `rename_item` / `move_item` / `delete_item` 后标记索引 stale。
3. `write_workspace_file` 后更新单文件索引。
4. `search_files` 发现 stale 时先重建再查询。

升级实现：

1. 文件写入：upsert 单文件。
2. 文件删除：delete 单文件。
3. 移动或重命名：delete old path，再 upsert new path。
4. 目录移动：批量更新路径前缀或重建。

## 5. 查询流程

`search_files(workspace_root, query)`：

1. 校验 Workspace root。
2. trim query；空 query 返回空结果。
3. 确认 `workspace.db` 和 FTS 表可用。
4. 索引 stale 时执行重建。
5. 使用 FTS5 查询。
6. 将结果 path 再次按 Workspace 边界校验。
7. 返回最多 20 条结果。

结果结构沿用当前 `SearchResult`：

```ts
interface SearchResult {
  filePath: string;
  preview: string;
}
```

## 6. 依赖决策

候选实现依赖：

1. Rust 使用 `rusqlite`。
2. SQLite 使用 bundled 构建，避免依赖用户系统 SQLite 是否启用 FTS5。
3. 实现前必须验证 FTS5 可用性；若不可用，启动时返回可诊断错误并降级递归搜索。

本方案不在当前 Issue 引入依赖；依赖变更必须由后续实现 Issue Trace 单独锁定。

## 7. 正式规则升级条件

进入实现前，将候选规则升级为正式规则：

`BR-WS-DATA-005`

规则意图：

搜索索引必须可重建，搜索结果必须限制在当前 Workspace，索引不可用时必须降级或返回可审计错误。

同步要求：

1. `SYS-C-T-01` 注册 `WS-SEARCH` 链路。
2. `SYS-C-T-01` 注册 `BR-WS-DATA-005`。
3. Runtime `@GOV` 映射到 `BR-WS-DATA-005`。
4. 测试覆盖索引重建、边界限制、`.binder` 跳过、降级路径。

## 8. 验收标准

实现完成后必须满足：

1. `search_files` 不再以递归扫描作为主路径。
2. `.binder/workspace.db` 内存在 FTS5 索引表。
3. 搜索结果只返回 Workspace 相对路径。
4. `.binder/**` 不出现在搜索结果。
5. 索引删除后可重建。
6. 索引不可用时可降级，并能在测试中观测。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，定义 Workspace FTS5 搜索索引方案 |
