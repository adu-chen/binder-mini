---
文档编号：   SYS-C-T-02
文档状态：   R
负责模块：   SYS,WS,CORE
文档职责：   需求到技术规则映射矩阵
上游约束：   CORE-C-P-01、CORE-C-D-01、WS-M-D-01、SYS-C-T-01
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
| REQ-WS-006 | 创建文件与目录 | BR-WS-DATA-001、X-CONST-001 | WS-FILE-MANAGE | 边界已覆盖，冲突协议待补 |
| REQ-WS-007 | 重命名、移动和删除 | BR-WS-DATA-001、X-CONST-001 | WS-FILE-MANAGE | 边界已覆盖，结构操作待补 |
| REQ-WS-008 | 路径冲突协议 | BR-WS-DATA-001、X-CONST-001 | WS-FILE-MANAGE | 待补 PathConflict 规则 |
| REQ-WS-009 | 关闭和切换 Workspace | BR-WS-STATE-001、X-CONST-003 | WS-OPEN | 待补关闭/切换状态机 |
| REQ-WS-010 | 搜索索引 | BR-WS-DATA-001、X-CONST-001 | WS-FILE-MANAGE | 待补搜索索引规则 |

## 3. Workspace 候选规则映射

以下候选规则尚未登记为 RULE 注释块。进入实现前，必须先在 `SYS-C-T-01` 注册为正式规则，并补测试覆盖。

| 候选规则 ID | 承接需求 | 建议主链路 | 规则意图 |
|-------------|----------|------------|----------|
| BR-WS-DATA-003 | REQ-WS-006、REQ-WS-007 | WS-FILE-MANAGE | 创建、重命名、移动、删除必须通过 Workspace 边界守卫。 |
| BR-WS-DATA-004 | REQ-WS-008 | WS-FILE-MANAGE | 目标冲突必须返回 PathConflict，未经确认不得覆盖。 |
| BR-WS-STATE-003 | REQ-WS-009 | WS-CLOSE | 关闭或切换前必须处理 dirty editor 和 pending diff。 |
| BR-WS-DATA-005 | REQ-WS-010 | WS-SEARCH | 搜索索引必须可重建，搜索结果必须限制在当前 Workspace。 |

## 4. 实现追踪方式

运行时代码进入实现时，追踪链路为：

`REQ-* -> SYS-C-T-02 -> SYS-C-T-01 已注册 RULE/CHAIN/CONSTRAINT -> @GOV 注释 -> 测试覆盖`

任何代码块如果无法落到已注册技术规则，视为游离代码块，不允许合入。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.2 | 将最近 Workspace 候选规则升级为已注册规则映射 |
| 2026-05-22 | v1.1 | 将 Workspace 初始化与递归 FileNode 候选规则升级为已注册规则映射 |
| 2026-05-22 | v1.0 | 初始版本，建立 Workspace 需求到技术规则映射 |
