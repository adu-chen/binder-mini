---
文档编号：   WS-M-T-01
文档状态：   A
负责模块：   WS
文档职责：   Workspace 搜索索引 FTS5 技术方案
上游约束：   CORE-C-P-01、WS-M-D-01、SYS-C-T-01、SYS-C-T-02
直接承接：   后续 Workspace 搜索索引实现 Issue Trace
使用边界：   定义搜索索引实现方案和验收口径
变更要求：   修改索引结构、重建策略或降级策略必须同步 SYS-C-T-01 和测试
---

# Workspace 搜索索引 FTS5 方案

## 1. 目标

将当前递归文本搜索替换为基于 `search.db` 的可重建 FTS5 索引。

搜索索引必须满足：

1. 结果只来自当前 Workspace。
2. `.binder` 内部数据不得进入索引。
3. 索引可重建，不能成为唯一事实来源。
4. 索引不可用时允许降级到当前递归搜索。
5. 结构操作和文件写入后必须能触发索引更新或标记索引失效。

## 2. 数据存储

索引存储位置：

`<workspace>/.binder/search.db`（独立于 workspace.db，专用于搜索索引）

SQLite 表结构（对齐 binder-core）：

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
  file_path,      -- Workspace 相对路径（主键语义）
  file_name,      -- 文件名（不含路径，用于按名称搜索）
  content,        -- 文件文本内容
  tokenize = 'unicode61'
);
```

约束：

1. `search_index.file_path` 使用 Workspace 相对路径。
2. 索引内容只读取文本类文件；二进制或无法 UTF-8 读取的文件跳过。
3. `.binder/**` 永远跳过。

## 3. 重建流程

`rebuild_search_index(workspace_root)`：

1. 解析并 canonicalize Workspace root。
2. 初始化 `.binder/search.db`。
3. 开启事务。
4. 清空 `search_index` 表。
5. 递归扫描 Workspace。
6. 跳过 `.binder/**`、目录、不可读文件和二进制文件。
7. 写入 `search_index`（file_path、file_name、content）。
8. 提交事务。

失败策略：

1. 事务失败时回滚。
2. 失败不得破坏 Workspace 文件内容。
3. 查询时若索引不可用，降级到递归搜索并返回可审计状态。

## 4. 增量更新

后续实现可以先采用粗粒度重建，再升级到增量更新。

最小实现：

1. 打开 Workspace 后重建索引。
2. `create_file` / `create_folder` / `rename_item` / `move_item` / `delete_item` 后标记索引 stale。
3. `write_workspace_file` 后 upsert 单文件到 `search_index`。
4. `search_files` 发现 stale 时先重建再查询。

升级实现：

1. 文件写入：DELETE + INSERT 单条 search_index 记录（FTS5 不支持 UPDATE）。
2. 文件删除：DELETE FROM search_index WHERE file_path = ?。
3. 移动或重命名：DELETE old file_path，INSERT new file_path。
4. 目录移动：批量更新路径前缀或重建。

## 5. 查询流程

`search_files(workspace_root, query)`：

1. 校验 Workspace root。
2. trim query；空 query 返回空结果。
3. 确认 `search.db` 和 `search_index` 表可用。
4. 索引 stale 时执行重建。
5. 使用 FTS5 查询（`SELECT file_path, snippet(...) FROM search_index WHERE search_index MATCH ?`）。
6. 将结果 file_path 再次按 Workspace 边界校验。
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

实现 Issue 使用该依赖决策，并由 Issue Trace 单独锁定依赖变更。

## 7. 正式规则

本方案承接正式规则：

`BR-WS-DATA-005`

规则意图：

搜索索引必须可重建，搜索结果必须限制在当前 Workspace，索引不可用时必须降级或返回可审计错误。

实现同步要求：

1. `SYS-C-T-01` 注册 `WS-SEARCH` 链路。
2. `SYS-C-T-01` 注册 `BR-WS-DATA-005`。
3. Runtime `@GOV` 映射到 `BR-WS-DATA-005`。
4. 测试覆盖索引重建、边界限制、`.binder` 跳过、降级路径。

## 8. 验收标准

实现完成后必须满足：

1. `search_files` 不再以递归扫描作为主路径。
2. `.binder/search.db` 内存在 FTS5 `search_index` 表。
3. 搜索结果只返回 Workspace 相对路径。
4. `.binder/**` 不出现在搜索结果。
5. 索引删除后可重建。
6. 索引不可用时可降级，并能在测试中观测。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.1 | 标记方案进入实现，承接 BR-WS-DATA-005 |
| 2026-05-22 | v1.0 | 初始版本，定义 Workspace FTS5 搜索索引方案 |
| 2026-05-22 | v1.2 | 文件名前缀由 R 更正为 A（文档头状态 A，约束实现，命名前缀有误） |
| 2026-05-23 | v1.3 | 对齐 binder-core：存储路径从 workspace.db 改为 search.db；表结构从 3 表（search_index_meta、search_documents、search_documents_fts）改为单表 search_index（file_path、file_name、content）；§3/§4/§5 SQL 引用全部更新 |
