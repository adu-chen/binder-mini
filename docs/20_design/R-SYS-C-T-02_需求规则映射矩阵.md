---
文档编号：   SYS-C-T-02
文档状态：   R
负责模块：   SYS,WS,ED,CORE
文档职责：   需求到技术规则映射矩阵
上游约束：   CORE-C-P-01、CORE-C-D-01、WS-M-D-01、ED-M-D-01、SYS-C-T-01
直接承接：   CORE-X-P-02、CORE-X-P-12
使用边界：   记录需求与已注册技术规则的追踪关系，不替代技术规则正文
变更要求：   新增或修改需求、规则、链路、状态机后必须同步本矩阵
---

# 需求规则映射矩阵

## 1. 映射原则

1. 需求描述层使用 `REQ-*` 表达产品与功能需求。
2. 技术设计层使用 `RULE`、`CHAIN`、`CONSTRAINT`、`TERM` 表达代码规则来源。
3. 一个 `REQ-*` 可以映射多个技术规则；一个技术规则也可以承接多个需求。
4. 代码实现必须映射到技术规则，不直接映射到需求 ID。
5. 技术规则未注册前，只能作为候选规则进入计划或设计说明，不得驱动运行时代码。

## 2. 当前 Workspace 映射

| 需求 ID | 需求名称 | 已注册规则 / 约束 | 主链路 | 当前状态 |
|---------|----------|-------------------|--------|----------|
| REQ-WS-001 | 打开 Workspace | BR-WS-STATE-001、X-CONST-003 | WS-OPEN | 已覆盖 MVP 打开流程 |
| REQ-WS-002 | Workspace 边界 | BR-WS-DATA-001、X-CONST-001、BR-CORE-GOV-001 | WS-FILE-MANAGE | 已覆盖边界约束 |
| REQ-WS-003 | 递归文件树 | BR-WS-STATE-001、BR-WS-DATA-001、BR-WS-DATA-002 | WS-OPEN、WS-FILE-MANAGE | 已覆盖递归 FileNode |
| REQ-WS-004 | 最近 Workspace | BR-WS-STATE-001、BR-WS-PERSIST-001 | WS-OPEN | 已覆盖用户级持久化规则 |
| REQ-WS-005 | workspace.db 初始化 | BR-WS-STATE-001、BR-WS-STATE-002、X-CONST-003 | WS-OPEN | 已覆盖初始化规则 |
| REQ-WS-006 | 创建文件与目录 | BR-WS-DATA-001、BR-WS-DATA-003、BR-WS-DATA-004、X-CONST-001 | WS-FILE-MANAGE | 已覆盖创建与冲突协议 |
| REQ-WS-007 | 重命名、移动和删除 | BR-WS-DATA-001、BR-WS-DATA-003、BR-WS-DATA-004、X-CONST-001 | WS-FILE-MANAGE | 已覆盖结构操作与冲突协议 |
| REQ-WS-008 | 路径冲突协议 | BR-WS-DATA-001、BR-WS-DATA-004、X-CONST-001 | WS-FILE-MANAGE | 已覆盖 PathConflict 规则 |
| REQ-WS-009 | 关闭和切换 Workspace | BR-WS-STATE-001、BR-WS-STATE-003、X-CONST-003 | WS-OPEN、WS-CLOSE | 已覆盖 dirty/pending 门禁 |
| REQ-WS-010 | 搜索索引 | BR-WS-DATA-001、BR-WS-DATA-005、X-CONST-001 | WS-FILE-MANAGE、WS-SEARCH | 已覆盖 FTS5 索引主路径和递归降级 |

## 3. Workspace 候选规则映射

当前 Workspace Phase 8 候选规则已全部升级或完成方案化，后续新增候选规则必须先写入本节。

## 4. 当前 Editor 映射

| 需求 ID | 需求名称 | 已注册规则 / 约束 | 主链路 | 当前状态 |
|---------|----------|-------------------|--------|----------|
| REQ-ED-001 | 打开文件 | BR-ED-STATE-001、BR-ED-STATE-002、X-CONST-001 | ED-OPEN-FILE | 已覆盖 md/txt MVP 打开、readonly 判定和多标签激活 |
| REQ-ED-002 | 保存文件 | BR-ED-PERSIST-001、X-CONST-001 | ED-SAVE-FILE | 已覆盖当前文件保存 MVP |
| REQ-ED-003 | 多标签编辑 | BR-ED-STATE-002 | ED-OPEN-FILE | 已覆盖多标签数据结构和 active tab 编辑保存 |
| REQ-ED-004 | dirty 标记与关闭保护 | BR-ED-STATE-003、BR-WS-STATE-003 | ED-SAVE-FILE、WS-CLOSE | 已覆盖 dirty tab 关闭保护和 Workspace 切换阻断 |
| REQ-ED-005 | 状态栏 | BR-ED-STATE-004 | ED-OPEN-FILE | 已覆盖 active tab 状态栏派生 |
| REQ-ED-006 | TipTap/Markdown 编辑 | BR-ED-PERSIST-002 | ED-OPEN-FILE、ED-SAVE-FILE | 已覆盖 `.md` TipTap/Markdown 运行时与转换失败保存阻断 |
| REQ-ED-007 | BlockId 定位 | 待升级：ED-CAND-DATA-002 | ED-OPEN-FILE、DE-CREATE-DIFF | 技术草案已补，专项实现前需升级规则 |
| REQ-ED-008 | DiffDecoration 绿审态 | 待升级：ED-CAND-STATE-004 | ED-DIFF-RENDER、DE-CREATE-DIFF | 技术草案已补，依赖 Diff Review v2 |

## 5. Editor 候选规则映射

Editor Phase 9 候选规则来源见 `docs/20_design/R-ED-M-T-01_Editor技术架构.md` §6。进入运行时代码前，必须将候选规则升级为 `SYS-C-T-01` 正式 RULE，并补测试覆盖。

## 6. 实现追踪方式

运行时代码进入实现时，追踪链路为：

`REQ-* -> SYS-C-T-02 -> SYS-C-T-01 已注册 RULE/CHAIN/CONSTRAINT -> @GOV 注释 -> 测试覆盖`

任何代码块如果无法落到已注册技术规则，视为游离代码块，不允许合入。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v2.2 | 将 REQ-ED-006 映射到 Editor Markdown 正式规则 |
| 2026-05-22 | v2.1 | 标记 Editor TipTap/Markdown 技术选型已确认 |
| 2026-05-22 | v2.0 | 将 Editor dirty 关闭保护和状态栏候选规则升级为正式规则映射 |
| 2026-05-22 | v1.9 | 将 Editor 多标签候选规则升级为正式规则映射 |
| 2026-05-22 | v1.7 | 将 Workspace 搜索索引候选规则升级为已注册规则映射 |
| 2026-05-22 | v1.8 | 新增 Editor Phase 9 需求与候选规则映射 |
| 2026-05-22 | v1.6 | 补充 Workspace 搜索索引 FTS5 方案状态 |
| 2026-05-22 | v1.5 | 将 Workspace 关闭切换门禁候选规则升级为已注册规则映射 |
| 2026-05-22 | v1.4 | 标记 Workspace rename/move/delete 结构操作实现完成 |
| 2026-05-22 | v1.3 | 将 Workspace 创建结构操作与 PathConflict 候选规则升级为已注册规则映射 |
| 2026-05-22 | v1.2 | 将最近 Workspace 候选规则升级为已注册规则映射 |
| 2026-05-22 | v1.1 | 将 Workspace 初始化与递归 FileNode 候选规则升级为已注册规则映射 |
| 2026-05-22 | v1.0 | 初始版本，建立 Workspace 需求到技术规则映射 |
