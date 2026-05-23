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
| REQ-WS-003 | 递归文件树 | 应用展示当前 Workspace 内的递归文件树；用户可在文件树中点击展开目录和打开文件。 | 文件树包含目录和文件节点，并能反映刷新后的结构变化；点击文件节点在 Editor 中打开文件。 |
| REQ-WS-004 | 最近 Workspace | 应用记录用户最近打开的 Workspace。 | 重新启动应用后可读取最近 Workspace 列表。 |
| REQ-WS-005 | workspace.db 初始化 | 打开 Workspace 后必须初始化 `.binder/workspace.db` 或等价的 Workspace 本地数据事实存储。 | Workspace 进入 active 前，基础数据存储可用或返回可恢复错误。 |
| REQ-WS-006 | 创建文件与目录 | 用户（右键菜单或工具栏）或 Agent 工具可以在 Workspace 内创建文件或目录。 | 创建成功后文件树刷新；目标路径已存在时返回 PathConflict，不产生副作用。 |
| REQ-WS-007 | 重命名、移动和删除 | 用户（右键菜单、行内重命名、拖拽移动）或 Agent 工具可以在 Workspace 内重命名、移动和删除文件或目录。 | 操作成功后文件树刷新；越界、缺失或冲突时不产生副作用；删除操作需用户二次确认。 |
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

## 6. 需求标注块

<!-- REQ
req_id: REQ-WS-001
name: 打开 Workspace
module: WS
chains: WS-OPEN
priority: P0
status: active
-->

<!-- REQ
req_id: REQ-WS-002
name: Workspace 边界
module: WS
chains: WS-FILE-MANAGE
priority: P0
status: active
-->

<!-- REQ
req_id: REQ-WS-003
name: 递归文件树
module: WS
chains: WS-OPEN
priority: P1
status: active
-->

<!-- REQ
req_id: REQ-WS-004
name: 最近 Workspace
module: WS
chains: WS-OPEN
priority: P1
status: active
-->

<!-- REQ
req_id: REQ-WS-005
name: workspace.db 初始化
module: WS
chains: WS-OPEN
priority: P0
status: active
-->

<!-- REQ
req_id: REQ-WS-006
name: 创建文件与目录
module: WS
chains: WS-FILE-MANAGE
priority: P1
status: active
-->

<!-- REQ
req_id: REQ-WS-007
name: 重命名、移动和删除
module: WS
chains: WS-FILE-MANAGE
priority: P1
status: active
-->

<!-- REQ
req_id: REQ-WS-008
name: 路径冲突协议
module: WS
chains: WS-FILE-MANAGE
priority: P1
status: active
-->

<!-- REQ
req_id: REQ-WS-009
name: 关闭和切换 Workspace
module: WS
chains: WS-OPEN, WS-CLOSE
priority: P0
status: active
-->

<!-- REQ
req_id: REQ-WS-010
name: 搜索索引
module: WS
chains: WS-FILE-MANAGE, WS-SEARCH
priority: P1
status: active
-->

## 7. 功能流程表

### REQ-WS-001 WS-OPEN-FLOW

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | User | — | 点击"打开 Workspace" | 本地目录选择对话框 | S02 | 用户取消 → END |
| S02 | SYS | 目录路径 | 校验目录是否合法存在 | 校验结果 | S03 | 路径无效 → ERR-01（返回 error 状态） |
| S03 | WS | 合法目录路径 | 初始化 `.binder` 目录 | `.binder` 目录 | S04 | 权限不足 → ERR-02 |
| S04 | DB | `.binder` 目录 | 初始化 workspace.db（创建表或打开已有） | workspace.db 连接 | S05 | DB 初始化失败 → ERR-03（返回可恢复错误） |
| S05 | WS | workspace.db | 构建递归 FileNode 树 | FileNode[] | S06 | 权限不足 → ERR-04（部分树） |
| S06 | WS | FileNode[] | 激活 Workspace（workspaceMachine → Active） | Active 状态 | DONE | — |

### REQ-WS-002 WS-BOUNDARY-FLOW

任意文件路径在被 WS/AG/DE 读写前，必须经过边界校验（路径是否在 workspaceRoot 内）；越界路径直接返回 PathConflict 或拒绝执行，不产生磁盘副作用。

### REQ-WS-003

文件树在 WS 进入 active 后通过递归扫描构建，返回目录和文件的 FileNode 层级结构；用户触发刷新时重新扫描并更新树结构。点击文件节点在 Editor 中打开文件；点击目录节点展开/折叠子树。文件树手动管理操作（创建、重命名、移动、删除）由 REQ-WS-011 描述，UI 交互路径（右键菜单、拖拽、行内重命名）与 Agent 工具调用路径在 WS 层共用同一校验和执行链路。

### REQ-WS-004

打开 Workspace 时将当前目录路径写入最近记录（存储于 workspace.db 或 app 本地配置）；应用重启后读取并展示最近列表，支持直接重新打开。

### REQ-WS-005 WS-DB-INIT-FLOW

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | WS | 合法目录路径 | 检查 `.binder` 目录是否存在 | 是/否 | S02 | — |
| S02 | SYS | `.binder` 是否存在 | 创建目录（如不存在） | `.binder` 目录 | S03 | 创建失败 → ERR-01（权限） |
| S03 | DB | `.binder/workspace.db` 路径 | 打开或创建 SQLite 数据库 | DB 连接 | S04 | 无法创建 → ERR-02（磁盘空间/权限） |
| S04 | DB | DB 连接 | 执行建表 DDL（files、pending_diffs、settings 等） | 表已就绪 | DONE | DDL 失败 → ERR-03（迁移冲突） |

### REQ-WS-006

用户（通过右键菜单或工具栏）或 AG 工具发起创建文件/目录请求；SYS 先做 WS 边界校验和目标路径存在性检查，通过后写入磁盘并触发文件树刷新；目标路径已存在时返回 PathConflict，不产生副作用。用户交互路径与 Agent 工具调用路径使用同一 WS 层校验逻辑。

### REQ-WS-007

用户（通过右键菜单、拖拽移动或行内重命名）或 AG 工具发起重命名/移动/删除请求；SYS 先校验路径合法性和操作可行性（WS 边界、源路径存在性、目标路径冲突），通过后执行磁盘操作并刷新文件树；删除操作需用户二次确认（Agent 工具路径通过明确参数意图代替弹窗确认）；任何校验失败均提前返回错误，不执行磁盘写入。

### REQ-WS-008

结构操作（创建、移动、重命名、导入）检测到目标路径已存在时，返回明确的 PathConflict 结果；调用方（User 或 AG）必须显式确认覆盖意图后才能重新发起操作，原路径内容不得被静默覆盖。

### REQ-WS-009 WS-CLOSE-FLOW

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | User | — | 触发关闭/切换 Workspace | 关闭请求 | S02 | — |
| S02 | WS | 当前 ED 状态 | 检查是否有 dirty 标签 | dirty 列表 | S03（有 dirty） | S04（无 dirty）|
| S03 | User | dirty 提示弹窗（每 dirty 标签逐个弹出）| 逐标签确认"保存并继续"/"丢弃并继续"/"取消"；多个 dirty 标签时每标签独立弹窗，全部标签处理完后继续 S04 | 用户选择 | S04（全部标签处理完毕）| END（任一选择取消，终止关闭，保留所有当前状态）|
| S04 | WS | 当前 DE 状态 | 检查是否有非终态 PendingDiff | pending diff 数量 N | S05（N > 0）| S07（N = 0）|
| S05 | User | Diff 处理弹窗："当前有 N 条待处理 diff，关闭后如何处理？" | 选择："全部接受后关闭" / "全部作废并关闭" / "取消" | 用户选择 | S06a（接受）/ S06b（作废）| END（取消）|
| S06a | DE | 非终态 diff 列表 | 按文件分组批量执行 ACCEPT（写入文件内容，diff → accepted）| 各文件内容更新 | S07 | 部分失败 → 失败项转 error 终态，其余继续；不阻断关闭流程 |
| S06b | DE | 非终态 diff 列表 | 将所有非终态 PendingDiff 转 expired，写入 DB | expired 记录 | S07 | — |
| S07 | WS | — | 清空当前 Workspace 状态（workspaceMachine → NoWorkspace） | NoWorkspace 状态 | DONE | — |

### REQ-WS-007 补充 — 文件树手动管理（WS-FILE-TREE-MANAGE-FLOW）

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01a | User | — | 右键文件/目录节点 → 选择"新建文件"/"新建目录"/"删除"/"重命名" | 操作意图 | S02（创建/删除/重命名）| — |
| S01b | User | 节点 | 在文件名上双击 → 行内编辑框激活 | 新名称输入 | S02（重命名）| — |
| S01c | User | 节点 | 拖拽节点到目标目录 | 移动意图（源路径 + 目标目录路径）| S02（移动）| 拖拽取消 → END |
| S02 | WS | 操作类型 + 路径参数 | 边界校验（目标路径在 workspaceRoot 内）+ PathConflict 检查 | 校验结果 | S03（通过）| ERR-01（越界 → 操作拒绝）/ ERR-02（PathConflict → 提示冲突）|
| S03 | SYS | 路径 + 操作类型 | 执行文件系统结构操作（磁盘写入）| 操作结果 | S04 | ERR-03（磁盘操作失败）|
| S04 | WS | — | 文件树刷新（重新扫描受影响目录）| 文件树更新 | DONE | — |

### REQ-WS-010

用户在当前 WS 内发起文件搜索；WS 优先使用 FTS5 搜索索引返回结果；索引不可用时降级到递归全文扫描；搜索结果路径必须全部在 workspaceRoot 边界内。

## 8. 已决策约束

以下问题已决策，作为设计约束固化到实现中。

| 类别 | 决策 |
|------|------|
| **DB 迁移策略** | 采用隐式 DDL（`CREATE TABLE IF NOT EXISTS`），不做主动 ALTER 或备份重建。新版本新增的表以 IF NOT EXISTS 追加方式加入 DB 初始化流程，旧表结构保持不变。破坏性 schema 变更（删列/改类型）必须升版本号并在文档中明确标注。对齐 binder-core。 |
| **`.binder` git 处理** | `.binder` 目录应加入 `.gitignore`。workspace.db（搜索索引、pending_diffs）是本地运行时产物，不适合多人共享。在 README 中说明此约定。对齐 binder-core。 |
| **搜索降级用户感知** | 静默降级：FTS5 索引不可用时自动降级到递归全文扫描，不通知用户。UI 不展示当前搜索路径类型。对齐 binder-core。 |
| **文件系统实时监听** | 明确排除在最小核心之外。文件树只在 Workspace 打开时和用户主动刷新时更新，不实时监听外部文件系统变化。DE 的失效检测依赖 Workspace 关闭事件和用户操作触发，不依赖 fs-watch。对齐 binder-core。 |
| **workspace.db 并发访问** | 延后处理。单 Workspace 设计使并发场景受限；Phase 13-D 持久化实现时再评估是否需要 WAL mode 或 Mutex 序列化。 |

## 9. 跨模块交互声明

| 方向 | 触发场景 | 数据边界 | 约束 |
|------|----------|----------|------|
| WS → ED | WS 进入 Active 后，ED 可访问 FileNode 树和文件内容路径 | workspaceRoot 内的文件路径 | ED 不得在 WS NoWorkspace 时访问文件 |
| WS → ED | WS 关闭时，ED 必须收到通知关闭所有标签 | workspaceMachine 状态 | 通过 workspaceMachine 状态传播，ED 监听 NoWorkspace 事件 |
| WS → AG | WS Active 时，AG 的只读工具可在 WS 边界内执行 | workspaceRoot 作为隔离边界 | AG 工具调用必须经过 WS 边界校验，不得直接访问文件系统 |
| WS → AG | WS 关闭时，AG 必须终止当前流式响应 | — | AG 监听 WS NoWorkspace 事件，主动中断流 |
| WS → DE | WS 关闭时，DE 必须将所有非终态 PendingDiff 转 expired 并写入 workspace.db | pending_diffs 表 | 转换必须在 WS 状态切换为 NoWorkspace 之前完成 |
| WS → DE | WS Active 时，DE 可读写 workspace.db 中的 pending_diffs 表 | workspace.db/pending_diffs | DE 不得在 WS NoWorkspace 时写入 pending_diffs |

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，定义 Workspace 需求颗粒度和需求 ID |
| 2026-05-23 | v1.1 | 新增 §6 需求标注块、§7 功能流程表、§8 问题暴露清单、§9 跨模块交互声明（G1 合规修复）|
| 2026-05-23 | v1.2 | §8 将全部 NEEDS_HUMAN_DECISION 项替换为已决策约束；对齐 binder-core（隐式 DDL 迁移、.binder gitignore、静默降级、排除 fs-watch）|
| 2026-05-23 | v1.3 | 新增 REQ-WS-011（文件树手动管理，含拖拽整理、行内重命名、右键菜单）；扩展 WS-CLOSE-FLOW（补充 pending diff N 条提示和"全部接受/全部作废/取消"三路分支）；REQ-WS-003/006/007 补充 UI 交互路径与 Agent 工具路径说明 |
| 2026-05-23 | v1.4 | 删除 REQ-WS-011 独立需求项（UI 交互路径已合并入 REQ-WS-006/007）；WS-FILE-TREE-MANAGE-FLOW 归属改为 REQ-WS-007 补充；WS-CLOSE-FLOW S03 明确多 dirty 标签逐个弹窗处理，任一取消则终止关闭 |
| 2026-05-23 | v1.5 | WS-OPEN-FLOW S06 workspaceMachine 状态改为 PascalCase（Active）；WS-CLOSE-FLOW S07 idle→NoWorkspace；§9 跨模块交互表 idle→NoWorkspace 全部更新 |
