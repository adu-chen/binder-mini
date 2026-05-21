---
文档编号：   WS-M-D-01
文档状态：   A
负责模块：   WS
文档职责：   Workspace 功能主控需求
上游约束：   CORE-C-P-01、CORE-C-D-01、CORE-X-P-12
直接承接：   SYS-C-T-01、SYS-C-T-02
使用边界：   定义 Workspace 功能需求颗粒度，不直接定义代码规则
变更要求：   需求 ID 或需求边界变化必须同步技术设计和映射矩阵
---

# Workspace 功能主控

## 1. 需求层 ID 规则

需求描述层使用 `REQ-*` 标识产品需求。`REQ-*` 不是技术规则 ID，不直接作为代码实现的 `@GOV` 映射目标。

代码实现必须映射到技术设计文档已注册规则；技术规则再通过 `SYS-C-T-02` 映射回本需求文档。

## 2. 功能定义

Workspace 是用户选择的本地项目目录，是 Binder Mini 的文件、搜索、编辑、diff 和 Agent 工具调用边界。

Workspace 需求必须满足以下原则：

1. 所有本地文件事实都来自当前 Workspace。
2. 所有文件副作用都必须受 Workspace 边界约束。
3. Workspace 状态变化会影响 Editor、Agent 和 Diff Review 的可用性。
4. 最近 Workspace、搜索索引和 workspace.db 是 Workspace 能力的一部分，但不得扩大文件访问边界。

## 3. 需求清单

| 需求 ID | 名称 | 需求描述 | 验收口径 |
|---------|------|----------|----------|
| REQ-WS-001 | 打开 Workspace | 用户可以选择本地目录作为当前 Workspace。 | 目录合法时进入 active；目录无效时返回错误状态。 |
| REQ-WS-002 | Workspace 边界 | 文件读取、写入、移动、删除、搜索、diff 和 Agent 上下文读取必须限制在当前 Workspace 内。 | 任意越界路径均被拒绝，不产生文件副作用。 |
| REQ-WS-003 | 递归文件树 | 应用展示当前 Workspace 内的递归文件树。 | 文件树包含目录和文件节点，并能反映刷新后的结构变化。 |
| REQ-WS-004 | 最近 Workspace | 应用记录用户最近打开的 Workspace。 | 重新启动应用后可读取最近 Workspace 列表。 |
| REQ-WS-005 | workspace.db 初始化 | 打开 Workspace 后必须初始化 `.binder/workspace.db` 或等价的 Workspace 本地数据事实存储。 | Workspace 进入 active 前，基础数据存储可用或返回可恢复错误。 |
| REQ-WS-006 | 创建文件与目录 | 用户或 Agent 工具可以在 Workspace 内创建文件或目录。 | 创建成功后文件树刷新；目标已存在时返回冲突。 |
| REQ-WS-007 | 重命名、移动和删除 | 用户或 Agent 工具可以在 Workspace 内重命名、移动和删除文件或目录。 | 操作成功后文件树刷新；越界、缺失或冲突时不产生副作用。 |
| REQ-WS-008 | 路径冲突协议 | 创建、移动、重命名、导入等结构操作遇到目标冲突时必须返回明确冲突结果。 | 未经用户确认不得覆盖既有文件或目录。 |
| REQ-WS-009 | 关闭和切换 Workspace | 用户可以关闭或切换 Workspace。 | 关闭或切换前必须处理未保存编辑和 pending diff 等阻断状态。 |
| REQ-WS-010 | 搜索索引 | 应用支持基于当前 Workspace 的文件搜索能力。 | 搜索结果只来自当前 Workspace，并能在索引不可用时降级或重建。 |

## 4. 非功能要求

1. Workspace 操作必须可审计，失败原因必须可被 UI、测试和日志区分。
2. Workspace 文件结构事实必须可重建，不能依赖不可恢复的内存状态。
3. Workspace 相关状态机应覆盖打开、初始化、刷新、错误恢复、关闭和切换。
4. Agent 工具调用不得绕过 Workspace 边界和冲突协议。

## 5. 与 binder-core 的颗粒度差异

本项目以 binder-core 作为需求颗粒度参考，但不直接继承 binder-core 代码规则。binder-core 中更细的文件树、最近项目、workspace.db、索引和文件操作协议，在 Binder Mini 中必须先转化为本项目需求 ID 与技术规则，再进入实现。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，定义 Workspace 需求颗粒度和需求 ID |
