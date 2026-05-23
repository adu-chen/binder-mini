---
文档编号：   CORE-X-P-20
文档状态：   A
负责模块：   CORE,WS,SYS
文档职责：   Workspace 搜索索引实现 Issue Trace
上游约束：   CORE-C-P-01、CORE-X-P-12、WS-M-D-01、WS-M-T-01、SYS-C-T-01
直接承接：   Phase 8-F 实现
使用边界：   限定 FTS5 搜索索引实现，不处理搜索 UI 重设计
变更要求：   范围变化必须先更新本 Issue Trace
---

# Workspace 搜索索引实现 Issue Trace

## 1. Issue

执行 `Phase 8：Workspace 硬范围` 的搜索索引实现：将 `search_files` 主路径从递归扫描替换为 `workspace.db` FTS5 索引，并保留递归降级。

## Allowed Files

- docs/30_plans/A-CORE-X-P-20_WorkspaceSearchIndexImplementationIssueTrace.md
- docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md
- docs/20_design/R-SYS-C-T-02_需求规则映射矩阵.md
- docs/20_design/A-WS-M-T-01_Workspace搜索索引FTS5方案.md
- docs/00_core/A-CORE-C-R-01_ADUS.md
- src-tauri/Cargo.toml
- src-tauri/Cargo.lock
- src-tauri/src/lib.rs
- src/types/workspace.ts
- tests/governance.phase2.test.ts
- "docs/20_design/A-SYS-C-T-01_\347\263\273\347\273\237\346\212\200\346\234\257\350\256\276\350\256\241\344\270\216\350\247\204\345\210\231\346\272\220.md"
- "docs/20_design/R-SYS-C-T-02_\351\234\200\346\261\202\350\247\204\345\210\231\346\230\240\345\260\204\347\237\251\351\230\265.md"
- "docs/20_design/A-WS-M-T-01_Workspace\346\220\234\347\264\242\347\264\242\345\274\225FTS5\346\226\271\346\241\210.md"

## Forbidden Files

- package.json
- package-lock.json
- src/App.tsx
- src/services/agentService.ts
- src/services/diffService.ts
- src/services/editorService.ts

## Expected Behavior

1. `workspace.db` 初始化为 SQLite 数据库并创建 FTS5 表。
2. 打开 Workspace 时重建搜索索引。
3. 文件写入和结构变更后重建搜索索引。
4. `search_files` 优先使用 FTS5 查询。
5. FTS5 不可用或索引损坏时降级到递归搜索。
6. `.binder/**` 不进入索引或搜索结果。
7. 治理生成、治理审计、TypeScript 检查、前端单测、Rust 检查和 Rust 单测通过。

## Validation Commands

- npm run governance:generate
- npm run governance:audit -- --issue docs/30_plans/A-CORE-X-P-20_WorkspaceSearchIndexImplementationIssueTrace.md
- npm run check:ts
- npm run test
- npm run check:rust
- cd src-tauri && cargo test

## 2. 不做范围

1. 不重设计搜索 UI。
2. 不实现文件 watcher。
3. 不实现真正增量索引；本轮使用粗粒度重建保证一致性。
4. 不修改 Agent 工具协议。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，锁定 Workspace FTS5 搜索索引实现范围 |
| 2026-05-22 | v1.1 | 文档状态由 R 更正为 A（符合 ADU.md §6.3 Issue Trace 状态规则） |
