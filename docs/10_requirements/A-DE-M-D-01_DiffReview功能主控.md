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

## 3. 需求清单

| 需求 ID | 名称 | 需求描述 | 验收口径 |
|---------|------|----------|----------|
| REQ-DE-001 | PendingDiff 创建 | AI 内容编辑请求必须生成 PendingDiff，不得直接写入目标文件。 | 内容编辑工具调用后出现 PendingDiff 卡片；目标文件无内容变化。 |
| REQ-DE-002 | 接受 diff | 用户接受 PendingDiff 后，修改内容写入目标文件，diff 进入 accepted 终态。 | 接受后目标文件内容与 proposedText 一致；PendingDiff 不再可执行。 |
| REQ-DE-003 | 拒绝 diff | 用户拒绝 PendingDiff 后，目标文件内容不变，diff 进入 rejected 终态。 | 拒绝后目标文件内容不变；PendingDiff 不再可执行。 |
| REQ-DE-004 | Diff 失效 | 目标文件内容已变化或定位信息失效时，PendingDiff 自动进入 expired 终态。 | 目标文件被独立编辑后，对应 PendingDiff 变为 expired；expired diff 不可接受或拒绝。 |
| REQ-DE-005 | 终态不可逆 | PendingDiff 进入 accepted / rejected / expired / error 终态后，不得继续执行接受或拒绝动作。 | 任何对终态 diff 执行接受或拒绝的调用均被阻断并返回明确错误。 |
| REQ-DE-006 | Diff 可溯源 | 每个 PendingDiff 必须携带生成它的工具调用 ID 和目标文件路径，供审计和 UI 展示使用。 | PendingDiff 数据结构包含 sourceToolId 和 filePath；UI 可展示来源信息。 |
| REQ-DE-007 | Diff 持久化与恢复 | Workspace 会话内的 PendingDiff 状态应持久化，应用重启或 Workspace 重新打开后可恢复。 | 应用重启后未终态的 PendingDiff 可重新展示；Workspace 关闭时 pending diff 转为 expired。 |

## 4. 非功能要求

1. Diff Review 状态机必须覆盖 none、pending、accepting、rejecting、expired、terminal 和 error 状态。
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

binder-core 已具备 mounted_pending / preapplied_pending 状态模型、绿审态、批量操作、持久化和 error 卡等完整实现。本项目不直接搬运代码，而是按 Binder Mini 规则体系重新拆分：

1. 先稳定单条 PendingDiff 的 create/accept/reject/expire 主流程（已有 MVP）。
2. 扩展 PendingDiff 数据结构（sourceToolId、baseRevision 等可溯源字段）。
3. 设计 mounted_pending / preapplied_pending 中间状态。
4. 补充持久化和跨应用恢复能力。
5. 最后接入绿审态展示（依赖 Editor BlockId）。

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

### REQ-DE-002 Flow Table (DE-ACCEPT-DIFF-FLOW)

| step_id | actor | input | action | output | next_step | exception |
|---------|-------|-------|--------|--------|-----------|-----------|
| S01 | User | diffId | 点击"接受"按钮 | 接受请求 | S02 | — |
| S02 | DE | diffId | canExecutePendingDiff 检查（status === "pending"）| 可执行判断 | S03（可执行）| ERR-01（非 pending 状态，终态或中间态）|
| S03 | SYS | filePath | 读取磁盘当前文件内容 | 当前内容 | S04 | ERR-02（文件读取失败）|
| S04 | DE | 当前内容 vs originalText | 校验内容一致（hash 比对）| 校验结果 | S05（一致）| ERR-03（不一致 → 自动转 expired，不执行写入）|
| S05 | DE | diffId | diffMachine → accepting | 中间状态 | S06 | — |
| S06 | SYS | proposedText + filePath | 写入磁盘 | 写入结果 | S07（成功）| ERR-04（写入失败 → diffMachine → error）|
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

终态不可逆由 canExecutePendingDiff 守卫实现：只有 status === "pending" / "mounted_pending" / "preapplied" 时返回 true；任何终态（accepted/rejected/expired/error）均返回 false，操作调用直接被阻断并返回明确错误。

### REQ-DE-006

可溯源：PendingDiff 创建时必须携带 sourceToolId（来自 AG 工具调用的 ToolExecution.id）和 filePath；这两个字段在 diffStore 中持久化；UI Diff 卡片可展示来源工具和目标文件信息。

### REQ-DE-007

持久化与恢复：PendingDiff 写入 workspace.db 的 pending_diffs 表；Workspace 重新打开时加载 status 为 pending 的记录，检查 originalText 一致性，不一致时自动转 expired；Workspace 关闭时所有非终态 diff 转 expired 并写入 DB。

## 9. 问题暴露清单

| 类型 | 描述 |
|------|------|
| NEEDS_HUMAN_DECISION | 保存即接受当前文件全部 pending 的确认流程 — 当用户在 Editor 保存（Cmd+S）当前文件时，若该文件有 pending diff，是否应弹出确认框问"是否同时接受该文件的所有 pending diff？"需要人类决策交互设计。|
| NEEDS_HUMAN_DECISION | 批量接受失败的原子性语义 — 批量接受多条 diff 时，若某条 accept 失败（原始内容不一致），其余条是否继续执行？全部回滚还是跳过失败继续？|
| DESIGN_RISK | preapplied → reject 时的编辑器缓冲区回滚 — 当 diff 进入 preapplied 状态（内容已应用到编辑器缓冲区）后用户拒绝，ED 必须将缓冲区回滚到 originalText。这要求 DE 能直接调用 ED 的回滚接口，但当前模块间交互协议未定义。|
| REQ_GAP | 已打开文件在用户继续编辑后的 diff 状态 — 用户在有 pending diff 的文件中继续手动编辑，diff 的 originalText 可能已不匹配当前编辑器内容（但磁盘内容未变）。当前失效检测只比较磁盘内容，不比较编辑器缓冲区内容。|
| BOUNDARY_OPEN | preapplied_pending 状态与多条 diff 的顺序语义 — 若同一文件有多条 pending diff，preapplied 应按何种顺序应用？顺序不确定可能导致 diff 间的行号冲突。|

## 10. 跨模块交互声明

| 方向 | 触发场景 | 数据边界 | 约束 |
|------|----------|----------|------|
| DE ← AG | 内容编辑工具调用 | AG工具参数（filePath、proposedText、sourceToolId）→ DE 创建 PendingDiff | AG 不得直接写文件；所有内容修改必须经 DE 路由 |
| DE ← ED | 获取当前编辑器内容（已打开文件链路）| ED active 文件的 originalText 快照 + baseRevision → DE | 只读读取；DE 不直接操作 ED 内容（除 preapplied 回滚时）|
| DE → ED | preapplied 状态下用户拒绝 diff | diffId → ED 触发缓冲区回滚到 originalText | DE 必须通过 ED 提供的回滚接口操作，不直接操作 DOM |
| DE → WS | Diff accept 时写入目标文件 | proposedText + filePath → SYS 文件写入 | 写入前必须通过 WS 边界校验（文件在 workspaceRoot 内）|
| DE → DB | PendingDiff 状态变化时持久化 | PendingDiff 状态 → workspace.db pending_diffs 表 | 所有非终态→终态的转换必须写入 DB；恢复时从 DB 读取 |
| WS → DE | Workspace 关闭时通知 DE | workspaceMachine → idle | DE 必须将所有非终态 PendingDiff 转 expired 并持久化 |

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-23 | v1.0 | 初始版本，定义 Diff Review 功能需求颗粒度和 REQ-DE-* ID |
| 2026-05-23 | v1.1 | 新增 §7 需求标注块、§8 功能流程表、§9 问题暴露清单、§10 跨模块交互声明（G1 合规修复）|
