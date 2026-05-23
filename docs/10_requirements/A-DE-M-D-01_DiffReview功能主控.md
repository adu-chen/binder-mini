---
文档编号：   DE-M-D-01
文档状态：   A
负责模块：   DE
文档职责：   Diff Review 功能主控需求
上游约束：   CORE-C-P-01、CORE-C-D-01、CORE-X-P-12
直接承接：   DE-M-T-01、SYS-C-T-02
使用边界：   定义 Diff Review 功能需求颗粒度，不直接定义代码规则
变更要求：   需求 ID 或需求边界变化必须同步技术设计和映射矩阵
---

# Diff Review 功能主控

## 1. 需求层 ID 规则

需求描述层使用 `REQ-DE-*` 标识 Diff Review 产品需求。`REQ-DE-*` 不是技术规则 ID，不直接作为代码实现的 `@GOV` 映射目标。

代码实现必须映射到技术设计文档已注册规则；技术规则再通过 `SYS-C-T-02` 映射回本需求文档。

## 2. 功能定义

Diff Review 是 Binder Mini 的内容变更门控机制。AI Agent 的所有内容编辑必须经由 Diff Review 生成可审阅的变更提案（PendingDiff），用户明确接受后方可写入文件，拒绝或失效后不得改变文件内容。

Diff Review 需求必须满足以下原则：

1. 内容编辑工具的所有写操作必须先经过 PendingDiff，不存在绕过路径。
2. 接受（Accept）是触发文件写入的唯一入口。
3. 终态（accepted / rejected / expired / error）不可逆，不得回到 pending。
4. 每个 PendingDiff 必须可追溯到生成它的工具调用和目标文件路径。
5. 已打开文件和未打开文件的 Diff 链路可以不同，但终态语义必须一致。
6. 已打开文件的 diff 创建时，LogicalState 立即修改为 proposedText，diff 进入 preapplied；Editor 展示绿增效果（只显示新增内容绿色覆盖，不显示红删）；用户接受时仅移除绿增效果（LogicalState 不变，DiskState 不写入，文件保持 dirty 直到 Cmd+S 保存）；用户拒绝时 LogicalState 回滚到 originalText；DiskState 修改的唯一入口是用户保存（Cmd+S）。
7. Diff 卡片内嵌于对话消息流中，作为 Assistant 消息内工具调用的附加操作区；接受/拒绝按钮内联展示，diff 进入终态后按钮移除，卡片保留终态标记。

## 2.1 核心状态与概念定义

| 名词 | 定义 |
|------|------|
| **PendingDiff** | AI 内容编辑请求生成的变更提案对象，包含 originalText、proposedText、sourceToolId、filePath、baseRevision 等字段；在被接受或拒绝前处于可审阅状态 |
| **DiskState（磁盘状态）** | 文件在磁盘上的永久内容；Workspace 打开时读取；修改唯一入口是用户显式保存（Cmd+S） |
| **LogicalState（逻辑状态）** | Editor 内存缓冲区内容；应用直接操作的编辑状态；文件未打开时不存在 |
| **DisplayState（显示状态）** | Editor 实际渲染内容；读取 LogicalState 并叠加绿增等渲染效果；无独立存储 |
| **pending** | PendingDiff 初始状态：① 已打开文件路径：创建后立即触发 LogicalState 修改，转为 preapplied；② 未打开文件路径：保持 pending 直到用户决策或文件被打开 |
| **preapplied** | LogicalState 已修改为 proposedText；Editor 展示绿增效果；等待用户接受或拒绝 |
| **accepting / rejecting** | 用户触发接受或拒绝操作后的短暂内存态（不写入 DB）；crash 发生时重启后按 preapplied 或 pending 重新处理 |
| **accepted（已打开文件）** | 绿增效果消除；LogicalState 不变（已是 proposedText）；DiskState 未修改；文件保持 dirty 直到用户 Cmd+S 保存 |
| **accepted（未打开文件）** | DiskState 直接写入 proposedText；文件内容更新 |
| **rejected** | 已打开文件：LogicalState 回滚到 originalText，绿增移除；未打开文件：文件内容不变 |
| **expired** | diff 因 LogicalState 变化（用户编辑命中 diff 区域、新 diff 覆盖同区域）或 Workspace 关闭而被动失效；不可操作 |
| **error** | 执行链路出错（写入失败、读取失败等）；不可操作 |
| **TerminalDiffCard** | PendingDiff 进入终态后的 UI 卡片展示形态；只显示终态标记（accepted/rejected/expired/error）和来源信息（sourceToolId、filePath），不渲染接受/拒绝操作按钮 |
| **baseRevision** | 目标文件 DiskState 内容的 hash 指纹，PendingDiff 创建时记录；用于 Workspace 重新打开时校验文件是否被修改，不一致则 diff 自动转 expired |
| **sourceToolId** | 生成 PendingDiff 的工具调用 ID，来自 AG 工具调用的 ToolExecution.id；用于审计和 UI 来源展示 |
| **effectivePath** | PendingDiff 当前生效的 accept 路径语义：`"open-file"`（accept 只移除绿增，不写 DiskState）或 `"closed-file"`（accept 写 DiskState）；Inherit 流程（REQ-DE-012）触发后从 `"closed-file"` 升级为 `"open-file"` |
| **绿增** | Editor 在 preapplied 状态 diff 区域展示的绿色新增效果；只显示新增内容绿色覆盖，不显示红色删除；完整红删绿增 diff 视图只在聊天流中展示 |

## 3. 需求清单

| 需求 ID | 名称 | 需求描述 | 验收口径 |
|---------|------|----------|----------|
| REQ-DE-001 | PendingDiff 创建 | AI 内容编辑请求必须生成 PendingDiff，不得直接写入目标文件。 | 内容编辑工具调用后出现 PendingDiff 卡片；目标文件无内容变化。 |
| REQ-DE-002 | 接受 diff | 用户接受 PendingDiff 后，diff 进入 accepted 终态。已打开文件：绿增效果消除，LogicalState 不变（已是 proposedText），DiskState 不写入，文件保持 dirty。未打开文件：proposedText 直接写入 DiskState。 | 已打开文件：接受后绿增消除，编辑器内容已是 proposedText（因 diff 创建时 LogicalState 已修改），文件保持 dirty 直到 Cmd+S 保存；DiskState 在接受时不触碰。未打开文件：接受后磁盘内容与 proposedText 一致。两种路径 PendingDiff 均不再可执行。 |
| REQ-DE-003 | 拒绝 diff | 用户拒绝 PendingDiff 后，目标文件内容不变，diff 进入 rejected 终态。 | 拒绝后目标文件内容不变；PendingDiff 不再可执行。 |
| REQ-DE-004 | Diff 失效 | diff 区域的 LogicalState 变化时（用户编辑命中区域、新 diff 覆盖同区域），PendingDiff 自动进入 expired 终态；DiskState 变化（磁盘被外部修改）或 Workspace 关闭亦触发失效。 | 用户编辑 diff 区域后，对应 PendingDiff 变为 expired；新 diff 覆盖同区域后，旧 PendingDiff 自然 expired；expired diff 不可接受或拒绝。 |
| REQ-DE-005 | 终态不可逆 | PendingDiff 进入 accepted / rejected / expired / error 终态后，不得继续执行接受或拒绝动作。 | 任何对终态 diff 执行接受或拒绝的调用均被阻断并返回明确错误。 |
| REQ-DE-006 | Diff 可溯源 | 每个 PendingDiff 必须携带生成它的工具调用 ID 和目标文件路径，供审计和 UI 展示使用。 | PendingDiff 数据结构包含 sourceToolId 和 filePath；UI 可展示来源信息。 |
| REQ-DE-007 | Diff 持久化与恢复 | Workspace 会话内的 PendingDiff 状态变化实时写入 workspace.db；正常关闭 Workspace 时所有非终态 diff 强制转 expired（见 REQ-DE-009）；crash 后重新打开时，DB 中可能残留 pending 记录，须经 baseRevision 校验后恢复或转 expired（见 REQ-DE-010）。 | 正常关闭后重新打开：pending_diffs 表中应无 pending 记录（已全部转 expired）；crash 后重新打开：baseRevision 一致的记录恢复为 pending 可继续操作，baseRevision 不一致的自动转 expired；两种路径终态语义一致。 |
| REQ-DE-008 | 标签关闭时的 diff 处理 | 用户关闭编辑器标签时，若该文件有非终态 PendingDiff，必须弹窗提示用户选择处理方式。 | 弹窗提供"接受并关闭"/"拒绝并关闭"/"取消关闭"三选项；选择"接受"则对该文件所有 pending diff 执行 ACCEPT 后关闭标签；选择"拒绝"则保持文件内容不变关闭标签，diff 进入 rejected 终态（用户明确不采用该变更，语义有别于 Workspace 关闭时的被动 expired）；选择"取消"则保留标签和 diff；标签关闭不自动 expire diff。 |
| REQ-DE-009 | Workspace 关闭时 pending 状态不继承 | Workspace 关闭时所有非终态 PendingDiff 强制转 expired；重新打开 Workspace 时，DB 中原 pending 状态的记录须经 baseRevision 校验才能恢复为 pending。 | Workspace 关闭后再次打开，baseRevision 一致的 diff 恢复为 pending 可继续审阅；baseRevision 不一致的转 expired；聊天历史中历史轮次的 diff 卡片只显示终态，不显示可执行 pending 按钮。 |
| REQ-DE-010 | 应用意外关闭后的 diff 恢复 | 应用意外关闭（crash/强退）时 workspace.db 保留 diff 最后状态；下次打开 Workspace 时，以 baseRevision 校验恢复可用的 pending diff，其余转 expired。 | 下次打开 Workspace 后，内容未变化（baseRevision 一致）的 diff 恢复为 pending 可继续操作；内容已变化（baseRevision 不一致）的转 expired；不出现游离中间态（accepting/rejecting 中间态未持久化时视为 pending 重新处理）。 |
| REQ-DE-011 | diff 叠加 diff 的自然失效 | 当 AI 对已有 preapplied diff 的区域再次生成新 diff 时，新 diff 修改 LogicalState，旧 diff 区域 LogicalState 已变化，旧 diff 由统一失效规则自然转为 expired；新 diff 正常创建。 | 新 diff 创建后，同区域旧 PendingDiff 自动转为 expired（LogicalState 变化触发）；新 diff 正常展示 preapplied 状态；不返回冲突错误；不阻断新 diff 创建流程。 |
| REQ-DE-012 | 未打开文件 diff 继承流 | 当 update_file 工具对未打开文件生成 pending diff 后，用户在 Editor 中打开该文件时，系统须自动检验 DiskState 与 baseRevision 是否一致：一致则 diff 升级为 preapplied 状态（LogicalState = proposedText，effectivePath 升级为 open-file），Editor 展示绿增；不一致则 diff 自动转 expired，不继承。 | 文件被打开后：DiskState hash 一致时绿增效果自动出现，diff 变为 preapplied；不一致时 diff 卡片显示 expired；继承后 accept 不写入 DiskState（走 open-file 路径）；继承失败（hash 不一致）不显示绿增，不抛错，diff 自然进入 expired。 |

## 4. 非功能要求

1. Diff Review 状态机必须覆盖 none、pending、preapplied、accepting、rejecting、expired、terminal 和 error 状态。
2. 接受前必须校验目标文件当前内容与 PendingDiff 的 originalText 一致。
3. 工具执行完成但未生成 PendingDiff 时，不得在 UI 显示成功态。
4. 批量接受或拒绝操作必须保证每条 diff 独立走状态机；一条失败不得阻止其他条执行。
5. Diff 卡片终态记录必须持久化，供对话历史审计使用。

## 5. 明确不做（当前阶段）

1. 非文本文件的 diff 展示。
2. 多人协同的 diff 合并冲突。
3. 跨 Workspace 的 diff 迁移。
4. AI 自动批量接受策略。

## 6. 与 binder-core 的颗粒度差异

binder-core 已具备 preapplied 状态模型、绿增展示、批量操作、持久化和 error 卡等完整实现。本项目不直接搬运代码，而是按 Binder Mini 规则体系重新拆分：

1. 先稳定单条 PendingDiff 的 create/accept/reject/expire 主流程（已有 MVP）。
2. 扩展 PendingDiff 数据结构（sourceToolId、baseRevision 等可溯源字段）。
3. 设计 preapplied 中间状态（diff 创建即修改 LogicalState，无 mounted_pending 中间阶段）。
4. 补充持久化和跨应用恢复能力。
5. 最后接入绿增展示（依赖 Editor BlockId）。

## 7. 需求标注块

<!-- REQ
req_id: REQ-DE-001
name: PendingDiff 创建
module: DE
chains: DE-CREATE-DIFF
priority: P0
status: active
-->

<!-- REQ
req_id: REQ-DE-002
name: 接受 diff
module: DE
chains: DE-ACCEPT-DIFF
priority: P0
status: active
-->

<!-- REQ
req_id: REQ-DE-003
name: 拒绝 diff
module: DE
chains: DE-REJECT-DIFF
priority: P0
status: active
-->

<!-- REQ
req_id: REQ-DE-004
name: Diff 失效
module: DE
chains: DE-EXPIRE-DIFF
priority: P0
status: active
-->

<!-- REQ
req_id: REQ-DE-005
name: 终态不可逆
module: DE
chains: DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF
priority: P0
status: active
-->

<!-- REQ
req_id: REQ-DE-006
name: Diff 可溯源
module: DE
chains: DE-CREATE-DIFF
priority: P1
status: active
-->

<!-- REQ
req_id: REQ-DE-007
name: Diff 持久化与恢复
module: DE
chains: DE-ACCEPT-DIFF, DE-EXPIRE-DIFF
priority: P1
status: active
-->

<!-- REQ
req_id: REQ-DE-008
name: 标签关闭时的 diff 处理
module: DE
chains: DE-EXPIRE-DIFF, ED-SAVE-FILE
priority: P1
status: active
-->

<!-- REQ
req_id: REQ-DE-009
name: Workspace 关闭时 pending 状态不继承
module: DE
chains: DE-EXPIRE-DIFF, WS-CLOSE
priority: P0
status: active
-->

<!-- REQ
req_id: REQ-DE-010
name: 应用意外关闭后的 diff 恢复
module: DE
chains: DE-EXPIRE-DIFF
priority: P1
status: active
-->

<!-- REQ
req_id: REQ-DE-011
name: diff 叠加 diff 的冲突处理
module: DE
chains: DE-CREATE-DIFF
priority: P1
status: active
-->

<!-- REQ
req_id: REQ-DE-012
name: 未打开文件 diff 继承流
module: DE
chains: DE-CREATE-DIFF, DE-EXPIRE-DIFF, ED-OPEN-FILE
priority: P1
status: active
-->

## 8. 功能流程表

### REQ-DE-001 Flow Table — 已打开文件链路 (DE-CREATE-DIFF-OPEN-FLOW)

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | AG | edit_current_editor_document 工具调用（proposedText、summary、sourceToolId）| 路由到 DE 创建 diff | 工具参数 | S02 | — |
| S02 | DE | filePath（来自 AG 工具参数）| 校验目标文件在 workspaceRoot 内 | 路径校验 | S03（合法）| ERR-01（越界 → 工具拒绝）|
| S03 | ED | filePath | 获取当前编辑器 originalText 快照和 baseRevision hash | originalText + baseRevision | S04 | ERR-02（无 active 文件）|
| S04 | DE | originalText + proposedText + sourceToolId + filePath | 创建 PendingDiff（status=pending，含 sourceToolId、baseRevision、createdAt）| PendingDiff | S05 | ERR-03（创建失败）|
| S05 | DE | PendingDiff | 存入 diffStore（pending_diffs 表）| diffStore 更新 | S06 | — |
| S06 | UI | PendingDiff | 展示 Diff 卡片（待审阅状态）| Diff 卡片可见 | DONE | — |

### REQ-DE-001 补充 — 未打开文件链路 (DE-CREATE-DIFF-CLOSED-FLOW)

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | AG | update_file 工具调用（filePath、proposedText、summary、sourceToolId）| 路由到 DE 创建 diff | 工具参数 | S02 | — |
| S02 | DE | filePath | 校验路径在 workspaceRoot 内且文件存在 | 路径校验 | S03 | ERR-01（越界/不存在）|
| S03 | SYS | filePath | 读取磁盘文件内容作为 originalText，计算 baseRevision hash | originalText + baseRevision | S04 | ERR-02（读取失败）|
| S04 | DE | 所有字段 | 创建 PendingDiff（status=pending，不进入 mounted_pending）| PendingDiff | S05 | ERR-03 |
| S05 | DE | PendingDiff | 存入 diffStore | diffStore 更新 | S06 | — |
| S06 | UI | PendingDiff | 展示 Diff 卡片 | Diff 卡片可见 | DONE | — |

### REQ-DE-002 Flow Table — 已打开文件路径 (DE-ACCEPT-DIFF-OPEN-FLOW)

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | User | diffId | 点击"接受"按钮 | 接受请求 | S02 | — |
| S02 | DE | diffId | canExecutePendingDiff 检查（status === "preapplied"）| 可执行判断 | S03（可执行）| ERR-01（非 preapplied，终态或其他中间态）|
| S03 | DE | diffId | diffMachine → accepting（内存态）| 中间状态 | S04 | — |
| S04 | ED | diffId | 移除对应绿增 Decoration（LogicalState 不变，已是 proposedText）| 绿增效果消除 | S05 | ERR-02（Decoration 移除失败 → 继续）|
| S05 | DE | diffId | diffMachine → terminal（accepted）；文件保持 dirty | TerminalDiffCard | DONE | — |

注：已打开文件路径的 accept 不写磁盘；DiskState 仅在用户 Cmd+S 保存时修改。

### REQ-DE-002 Flow Table — 未打开文件路径 (DE-ACCEPT-DIFF-CLOSED-FLOW)

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | User | diffId | 点击"接受"按钮 | 接受请求 | S02 | — |
| S02 | DE | diffId | canExecutePendingDiff 检查（status === "pending"）| 可执行判断 | S03（可执行）| ERR-01（非 pending，终态）|
| S03 | SYS | filePath | 读取磁盘当前文件内容，计算 hash | 当前 hash | S04 | ERR-02（文件读取失败）|
| S04 | DE | 当前 hash vs baseRevision | 校验 DiskState 一致 | 校验结果 | S05（一致）| ERR-03（不一致 → 自动转 expired，不执行写入）|
| S05 | DE | diffId | diffMachine → accepting（内存态）| 中间状态 | S06 | — |
| S06 | SYS | proposedText + filePath | 写入 DiskState（磁盘）| 写入结果 | S07（成功）| ERR-04（写入失败 → diffMachine → error）|
| S07 | DE | diffId | diffMachine → terminal（accepted）| TerminalDiffCard | DONE | — |

### REQ-DE-003 Flow Table (DE-REJECT-DIFF-FLOW)

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | User | diffId | 点击"拒绝"按钮 | 拒绝请求 | S02 | — |
| S02 | DE | diffId | canExecutePendingDiff 检查 | 可执行判断 | S03（可执行）| ERR-01（非 pending）|
| S03 | DE | diffId | diffMachine → rejecting | 中间状态 | S04 | — |
| S04 | DE | diffId | 记录终态（status=rejected，文件不变）| TerminalDiffCard | S05 | ERR-02（记录失败）|
| S05 | DE | diffId | diffMachine → terminal（rejected）| 终态 | DONE | — |

### REQ-DE-004 Flow Table (DE-EXPIRE-DIFF-FLOW)

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | DE | 变化检测触发（文件外部编辑、Workspace 关闭、baseRevision 不一致）| 检查目标文件内容变化 | 变化结果 | S02（内容变化）| END（内容未变）|
| S02 | DE | diffId | shouldExpirePendingDiff → true | 失效判断 | S03 | — |
| S03 | DE | diffId | diffMachine → expired | 失效状态 | S04 | — |
| S04 | DE | diffId | 记录终态（TerminalDiffCard，status=expired）| 终态记录 | DONE | — |

### REQ-DE-005

终态不可逆由 canExecutePendingDiff 守卫实现：只有 status === "pending"（未打开文件路径）或 "preapplied"（已打开文件路径）时返回 true；任何终态（accepted/rejected/expired/error）以及 accepting/rejecting 内存态均返回 false，操作调用直接被阻断并返回明确错误。

### REQ-DE-006

可溯源：PendingDiff 创建时必须携带 sourceToolId（来自 AG 工具调用的 ToolExecution.id）和 filePath；这两个字段在 diffStore 中持久化；UI Diff 卡片可展示来源工具和目标文件信息。

### REQ-DE-007

持久化与恢复：PendingDiff 写入 workspace.db 的 pending_diffs 表；Workspace 重新打开时加载 status 为 pending 的记录，计算当前文件 baseRevision 与记录 baseRevision 比对，不一致时自动转 expired；Workspace 关闭时所有非终态 diff 转 expired 并写入 DB。

### REQ-DE-008 标签关闭时的 diff 处理（DE-TAB-CLOSE-DIFF-FLOW）

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | User | — | 触发关闭编辑器标签（filePath）| 关闭请求 | S02 | — |
| S02 | DE | filePath | 检查该文件是否有非终态 PendingDiff | pending diff 列表 | S03（有）| S07（无 → 直接关闭标签）|
| S03 | User | 弹窗："该文件有 N 条待处理修改提案" | 选择："接受并关闭" / "拒绝并关闭" / "取消关闭" | 用户选择 | S04a（接受）/ S04b（拒绝）| END（取消，保留标签和 diff）|
| S04a | DE | 该文件全部 pending diff | 批量执行 ACCEPT（写入 proposedText，diff → accepted）| 文件内容更新 | S05 | 失败项 → error 终态，其余继续 |
| S04b | DE | 该文件全部 pending diff | 批量执行 REJECT（文件内容不变，diff → rejected）| rejected 记录 | S05 | ERR-01（记录失败 → 回报但仍关闭）|
| S05 | DE | — | 将该文件所有 diff 写入 DB（终态持久化）| DB 更新 | S06 | — |
| S06 | ED | — | 关闭对应 Editor 标签 | 标签移除 | DONE | — |
| S07 | ED | — | 直接关闭 Editor 标签（无 diff）| 标签移除 | DONE | — |

注：标签关闭不触发 diff 自动 expire；用户必须显式选择接受或拒绝。

### REQ-DE-009 Workspace 关闭时 pending 状态不继承（DE-WS-CLOSE-INHERIT-FLOW）

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | WS | workspaceMachine → Closing | 通知 DE 工作区即将关闭 | 关闭通知 | S02 | — |
| S02 | DE | 非终态 PendingDiff 列表 | 将所有 status ≠ terminal 的 diff 转 expired，写入 DB | expired 批量记录 | S03 | ERR-01（写入失败 → 记录错误但继续关闭）|
| S03 | WS | — | workspaceMachine → NoWorkspace | NoWorkspace 状态 | DONE | — |
| S04 | WS | 重新打开同一 Workspace | 从 pending_diffs 表加载记录 | pending 记录列表 | S05 | — |
| S05 | DE | 每条 pending 记录 | 计算磁盘当前文件 baseRevision；与记录 baseRevision 比对 | 校验结果 | S06（一致 → 恢复为 pending）/ S07（不一致 → 转 expired）| — |
| S06 | DE | 一致记录 | 恢复为 pending 状态，可继续接受/拒绝操作 | 可用 PendingDiff | DONE | — |
| S07 | DE | 不一致记录 | 更新 status 为 expired，写入 DB | expired 记录 | DONE | — |

约束：pending 状态跨 Workspace 关闭后不自动继承；必须经 baseRevision 校验才能恢复。历史对话中 diff 卡片只展示终态。

### REQ-DE-010 应用意外关闭后的 diff 恢复（DE-CRASH-RECOVERY-FLOW）

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | WS | 应用重新启动，打开 Workspace | 读取 workspace.db pending_diffs 表 | 所有记录（含 pending + 中间态 accepting/rejecting）| S02 | ERR-01（DB 无法读取 → Workspace 进入 error 状态）|
| S02 | DE | 中间态记录（accepting/rejecting，未写入 DB 终态）| 视为 crash 中断，按 pending 状态重新处理（中间态不持久化为执行中）| 重置为 pending | S03 | — |
| S03 | DE | 所有 pending 状态记录 | 对每条记录计算磁盘文件当前 baseRevision，与记录比对 | 校验结果 | S04（一致）/ S05（不一致）| ERR-02（文件不存在 → 自动转 expired）|
| S04 | DE | 一致记录 | 恢复为 pending，展示 diff 卡片，可继续接受/拒绝 | 可用 PendingDiff | DONE | — |
| S05 | DE | 不一致记录 | 转 expired，写入 DB | expired 记录 | DONE | — |

### REQ-DE-011 diff 叠加 diff 的自然失效（DE-DIFF-OVERLAP-FLOW）

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | AG | 新内容编辑工具调用（filePath + 新 proposedText）| 路由到 DE 创建 diff | 工具参数 | S02 | — |
| S02 | DE | 新 PendingDiff 参数 | 正常执行 DE-CREATE-DIFF 流程（已打开文件）| 新 PendingDiff | S03 | — |
| S03 | DE/ED | 新 proposedText | 修改 LogicalState 为新 proposedText（覆盖旧 preapplied 内容）| LogicalState 更新 | S04 | — |
| S04 | DE | 旧 PendingDiff（diff 区域 LogicalState 已变化）| 统一失效规则触发：旧 diff 区域 LogicalState 变化 → 旧 diff 自动转 expired | 旧 diff → expired | DONE | — |

约束：新 diff 正常创建；旧 diff 由统一失效规则（LogicalState 变化）自然 expired，不需要返回冲突错误。AI 可以对同一区域连续生成 diff；每次新 diff 覆盖旧 diff 的 LogicalState，旧 diff 自然失效。

## 9. 已决策约束

以下问题已决策，作为设计约束固化到实现中。

| 类别 | 决策 |
|------|------|
| **Cmd+S 时有 preapplied diff 的确认流程** | 必须弹窗确认。用户在编辑器执行 Cmd+S 时，若当前文件有 preapplied diff，必须弹出确认框"保存将固化当前文件全部 AI 修改"；用户确认后对该文件所有 preapplied diff 执行 ACCEPT（移除绿增效果），再将 LogicalState 写入 DiskState（Cmd+S 保存）；用户取消则终止保存；不影响其他文件的 diff。DiskState 只在 Cmd+S 写盘时修改，accept 动作本身不写盘。对齐 binder-core BR-DE-DIFF-005。 |
| **批量接受失败的原子性** | 跳过继续（按卡片独立结算）。批量接受多条 diff 时，失败的卡片（originalText 不一致等）仅标记为 `error` 终态，不影响其他卡片的 accept 继续执行。不做全局事务回滚。对齐 binder-core。 |
| **preapplied → reject 的 LogicalState 回滚** | 逆补丁 + revision token 方案。PendingDiff 记录 `contentRevisionAfterApply`；reject 时只有当前 editor revision 等于 `contentRevisionAfterApply` 时才回滚 LogicalState 到 `originalText`；revision 已变化时说明用户在 preapplied 之后继续编辑，不覆盖用户内容，DE 标记 `conflict` 并转 expired。对齐 binder-core DE-M-T-01 §7.5.2。 |
| **用户继续编辑有 preapplied diff 的文件** | 统一失效规则：只有用户编辑命中 diff 所在区域（blockId/行号范围重叠）导致 LogicalState 变化时才触发 `EXPIRE_REQUESTED`；非 diff 区域的编辑不误触发失效。当 diff 区域可被唯一重定位时，更新 anchor offset 后继续审阅，不触发 expire。对齐 binder-core BR-DE-DIFF-004。 |
| **多条 pending diff 的 preapplied 顺序** | 先按文件分组，再按 `createdAt` 升序执行。同一文件内多条 diff 按创建时间由早到晚顺序应用，避免行号冲突。对齐 binder-core DE-M-T-01 §7.5.4。 |

## 10. 跨模块交互声明

| 方向 | 触发场景 | 数据边界 | 约束 |
|------|----------|----------|------|
| DE ← AG | 内容编辑工具调用 | AG工具参数（filePath、proposedText、sourceToolId）→ DE 创建 PendingDiff | AG 不得直接写文件；所有内容修改必须经 DE 路由 |
| DE ← ED | 获取当前编辑器内容（已打开文件链路）| ED active 文件的 originalText 快照 + baseRevision → DE | 只读读取；DE 不直接操作 ED 内容（除 preapplied 回滚时）|
| DE → ED | preapplied 状态下用户拒绝 diff | diffId → ED 触发 LogicalState 回滚到 originalText | DE 必须通过 ED 提供的回滚接口操作，不直接操作 DOM |
| DE → ED | preapplied 状态下用户接受 diff | diffId → ED 移除绿增 Decoration | Accept 不推送内容（LogicalState 已是 proposedText）；不写磁盘；仅移除视觉效果 |
| DE → WS | Diff accept 时写入目标文件 | proposedText + filePath → SYS 文件写入 | 写入前必须通过 WS 边界校验（文件在 workspaceRoot 内）|
| DE → DB | PendingDiff 状态变化时持久化 | PendingDiff 状态 → workspace.db pending_diffs 表 | 所有非终态→终态的转换必须写入 DB；恢复时从 DB 读取 |
| WS → DE | Workspace 关闭时通知 DE | workspaceMachine → Closing | DE 必须将所有非终态 PendingDiff 转 expired 并持久化 |

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-23 | v1.0 | 初始版本，定义 Diff Review 功能需求颗粒度和 REQ-DE-* ID |
| 2026-05-23 | v1.1 | 新增 §7 需求标注块、§8 功能流程表、§9 问题暴露清单、§10 跨模块交互声明（G1 合规修复）|
| 2026-05-23 | v1.2 | §9 将全部 NEEDS_HUMAN_DECISION 替换为已决策约束；对齐 binder-core（弹窗确认、跳过继续、逆补丁回滚、缓冲区粒度检测、createdAt 升序）|
| 2026-05-23 | v1.3 | 新增 REQ-DE-008（标签关闭时 diff 弹窗三选项）、REQ-DE-009（Workspace 关闭后 pending 不继承，重开须 baseRevision 校验）、REQ-DE-010（应用 crash 后 diff 恢复，中间态重置为 pending）、REQ-DE-011（diff 叠加区域冲突拒绝创建）；补充各 REQ 完整流程表；明确 pending 状态不跨 Workspace 关闭继承 |
| 2026-05-23 | v1.4 | DE-WS-CLOSE-INHERIT-FLOW 状态名改为 PascalCase（closing→Closing，idle→NoWorkspace）；§10 跨模块交互表对齐 |
| 2026-05-23 | v1.4 | §2 补充原则 6（mounted_pending→preapplied_pending 行为：Editor 预渲染、accept 只写盘、reject 回滚）和原则 7（Diff 卡片内嵌对话消息流）；REQ-DE-007 验收口径修正（正常关闭路径与 crash 路径分离说明）；REQ-DE-008 验收口径补充 rejected vs expired 语义区分；新增 §2.1 核心状态与概念定义表（mounted_pending / preapplied_pending / TerminalDiffCard / baseRevision / sourceToolId 等 9 个名词）|
| 2026-05-24 | v1.5 | 引入文档三态模型（DiskState/LogicalState/DisplayState）；消除 mounted_pending（diff 创建即修改 LogicalState，无中间 mounted 状态）；§2 原则 6 重写（diff 创建即 preapplied；accept 只移除绿增，不写磁盘；DiskState 唯一修改入口为 Cmd+S 保存）；§2.1 概念表重写（新增三态定义；accepted 语义按路径拆分；新增"绿增"定义）；REQ-DE-002 验收口径按两路径拆分；REQ-DE-004 失效规则改为统一 LogicalState 变化规则；REQ-DE-011 从"返回冲突错误"改为"统一失效规则自然 expired"；§4 状态机补充 preapplied；§8 accept 流程按两路径拆分；REQ-DE-005 canExecute 守卫更新（pending+preapplied）；§9 约束更新（Cmd+S 语义修正；用户继续编辑约束更新）；§10 DE→ED 交互拆分（accept 移除绿增；reject 回滚 LogicalState）|
| 2026-05-24 | v1.6 | §2.1 概念表新增 effectivePath 定义；§3 新增 REQ-DE-012（未打开文件 diff 继承流，含 baseRevision 校验、effectivePath 升级、绿增出现条件）；§7 新增 REQ-DE-012 标注块 |
