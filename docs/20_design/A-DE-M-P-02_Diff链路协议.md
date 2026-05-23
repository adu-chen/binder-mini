---
文档编号：   DE-M-P-02
文档状态：   A
负责模块：   DE
文档职责：   PendingDiff 生命周期链路协议，包括已打开文件和未打开文件两条链路
上游约束：   CORE-C-P-01、DE-M-D-01、DE-M-T-01、DE-M-P-01、SYS-C-T-01
直接承接：   diffService.ts、diffMachine、Phase 13-B/C/E Issue Trace
使用边界：   定义 diff 生命周期各状态的进入条件、操作语义和边界约束，不写运行时代码
变更要求：   状态迁移路径、失效条件或批量操作语义变更时必须同步本文和 DE-M-T-01
---

## 1. 本文职责

本文定义 PendingDiff 从创建到终态的两条完整链路（已打开文件链路 vs 未打开文件链路），以及失效触发条件、accept 前校验、批量操作协议和持久化时机。

## 2. 两条链路

PendingDiff 有两条链路，根据工具类型和目标文件是否已在 Editor 打开决定走哪条：

| 链路 | 触发工具 | 目标文件 | 经过状态 |
|------|----------|----------|----------|
| 已打开文件链路 | edit_current_editor_document | 当前 Editor active 文件 | pending → preapplied（立即）→ accepting → terminal |
| 未打开文件链路 | update_file（Phase 11）| Workspace 内未打开文件 | pending → accepting → terminal |

注：已打开文件链路中，diff 创建后**立即**修改 LogicalState 并转为 preapplied，无 mounted_pending 中间状态。

## 3. 已打开文件链路（Phase 13-B/C）

### 3.1 完整链路图

```
工具调用（edit_current_editor_document）
→ DE.createDiff（status=pending）
→ LOGICAL_STATE_APPLIED（LogicalState → proposedText；status=preapplied）
→ [Editor 展示绿增效果；聊天流展示红删绿增完整 diff]
→ 用户决策：
    → [接受] ACCEPT_REQUESTED → accepting → ACCEPT_CONFIRMED → terminal(accepted)
       [绿增效果消除；LogicalState 不变（已是 proposedText）；DiskState 不写；文件保持 dirty]
    → [拒绝] REJECT_REQUESTED → rejecting → LogicalState 回滚到 originalText → TERMINAL_RECORDED → terminal(rejected)
    → [LogicalState 变化：用户编辑命中区域 / 新 diff 覆盖] EXPIRE_REQUESTED → expired → TERMINAL_RECORDED → terminal(expired)
```

### 3.2 各状态进入条件

**preapplied 进入条件**：
- 对应文件已在 Editor 中打开（有 active tab）
- PendingDiff.status === "pending"
- DE 推送 proposedText 给 ED → ED 修改 LogicalState → LogicalState === proposedText
- diffMachine 收到 LOGICAL_STATE_APPLIED 事件

**preapplied → reject 特殊约束**：
- 拒绝时必须触发 LogicalState 回滚（恢复到 originalText）
- 不得只记录终态而留下游离的预应用内容
- 回滚必须在 diffMachine → terminal(rejected) 之前完成
- revision token 不一致时不强制回滚（见 §3.3）

### 3.3 accept 操作语义（已打开文件）

已打开文件路径的 accept 操作：

1. canExecutePendingDiff(diffId) 返回 true（status === "preapplied"）
2. diffMachine → accepting（内存临时态，不写 DB）
3. 通知 ED 移除对应绿增 Decoration
4. diffMachine → terminal(accepted)；写入 DB 终态记录
5. **不读磁盘、不写磁盘**；DiskState 不触碰；文件保持 dirty 直到 Cmd+S 保存

注：LogicalState 在 diff 创建时已修改为 proposedText，accept 时无需再推送内容。

## 4. 未打开文件链路（Phase 13-E）

### 4.1 完整链路图

```
工具调用（update_file，Phase 11）
→ DE.createDiff（status=pending）
   [不修改 LogicalState（文件无 LogicalState）；不进入 preapplied]
→ 用户决策：
    → [接受] ACCEPT_REQUESTED → accepting → 校验 DiskState hash → 写入 DiskState → WRITE_SUCCEEDED → terminal(accepted)
    → [拒绝] REJECT_REQUESTED → rejecting → TERMINAL_RECORDED → terminal(rejected)
    → [DiskState 被外部修改 / Workspace 关闭] EXPIRE_REQUESTED → expired → TERMINAL_RECORDED → terminal(expired)
```

### 4.2 约束

- 未打开文件不进入 preapplied
- 未打开文件的 accept 直接写 DiskState（磁盘）
- accept 前必须校验当前 DiskState hash 与 baseRevision 一致；不一致转 expired

### 4.3 继承流（Inherit Flow，Phase 13-E）

当 pending 状态的未打开文件 diff 的目标文件被用户打开时，触发继承流：

```
LOGICAL_STATE_APPEARED（目标文件被打开，LogicalState 出现）
→ 检查当前 DiskState hash 与 diff.baseRevision 是否一致
    → 一致：推送 proposedText 给 ED → ED 修改 LogicalState → diff 转 preapplied → 走已打开文件链路
    → 不一致：DiskState 已变化 → diff 自动转 expired（不继承）
```

继承流约束：
- 继承时同步将 `effectivePath` 从 `"closed-file"` 更新为 `"open-file"`；后续 accept 走 open-file 路径（只移除绿增，不写入 DiskState）
- 继承后绿增效果展示（Editor 已打开，LogicalState 已修改为 proposedText）
- 继承后 accept 不写入 DiskState（effectivePath 已是 open-file 语义）；DiskState 需 Cmd+S 保存
- 继承后 reject 通过 `ROLLBACK_LOGICAL_STATE` 事件回滚 LogicalState 到 originalText

## 5. 失效触发条件

### 5.1 统一失效规则

**核心规则**：diff 区域的 LogicalState 变化 → diff 自动失效（expired）。

这是最基础的失效规则，自然覆盖以下场景：
- 用户编辑命中 diff 区域 → LogicalState 变化 → 旧 diff 失效
- 新 diff 覆盖同区域 → LogicalState 变化 → 旧 diff 失效（diff-on-diff 自然处理）

### 5.2 完整失效触发表

| 触发条件 | 检测时机 | 处理 |
|----------|----------|------|
| 用户编辑命中 diff 区域（LogicalState 变化）| 编辑器输入事件（按 blockId/行号范围检测）| 自动转 expired |
| 新 diff 覆盖同区域（LogicalState 被新 proposedText 覆盖）| createDiff 执行时 | 旧 diff 自动转 expired，新 diff 正常创建 |
| DiskState 变化（磁盘被外部修改，baseRevision hash 不一致）| accept 前校验（未打开文件）、Workspace 重新打开 | 自动转 expired |
| 目标文件被删除 | 工具调用结果或文件树刷新 | 自动转 expired |
| Workspace 关闭（expireAllOnClose）| workspaceMachine → Closing | 所有非终态 diff 转 expired |
| accept 前磁盘读取失败（未打开文件路径）| acceptDiff 执行时 | 转 error |

注：编辑器缓冲区粒度检测：只有命中 diff 所在区域的编辑才触发失效；非 diff 区域的用户编辑不误触发失效（允许用户在文档其他部分自由编辑）。

## 6. 批量操作协议（Phase 13-F）

### 6.1 批量接受

```
acceptAllPending(filePath?)
  → 获取所有 status === "pending" 的 diff（可按 filePath 过滤，如当前文件）
  → 按 createdAt 顺序逐条执行 acceptDiff
  → 每条 diff 独立走 accept 校验和状态机
  → 一条失败（转 expired 或 error）不阻止其余条继续执行
  → 返回 {succeeded: string[], failed: string[], expired: string[]}
```

原子性语义：跳过继续（按卡片独立结算），不全局回滚。对齐 DE-M-D-01 §9。

### 6.2 Cmd+S 保存触发绿增固化

用户保存（Cmd+S）当前文件时，若该文件有 preapplied diff，必须弹出确认框（对齐 DE-M-D-01 §9）：

- 确认框文案："保存所有更改（包含您的编辑和 [N] 处 AI 建议的修改）。" / [确认保存] [取消]
- 用户点击"确认保存"：对当前文件所有 preapplied diff 批量执行 ACCEPT（移除绿增效果），全部 accept 确认后执行 Cmd+S 写盘（LogicalState → DiskState）。
- 用户点击"取消"：终止本次保存，不修改任何 diff 状态，dirty 标记保持。
- 不影响其他文件的 diff。

Cmd+S 批量 accept 的原子性遵循跳过继续原则：有 diff accept 失败时不写磁盘，等待用户处理失败卡片后重试。

注：Cmd+S 是写 DiskState 的唯一入口；accept 动作本身不写磁盘。

## 7. 终态语义

| 终态 | 路径 | 语义 | LogicalState | DiskState | 可逆 |
|------|------|------|-------------|-----------|------|
| accepted | 已打开文件 | 绿增效果消除；文件保持 dirty | = proposedText（不变）| 不变（Cmd+S 保存才写）| 否 |
| accepted | 未打开文件 | proposedText 写入磁盘 | 不存在（文件未打开）| = proposedText | 否 |
| rejected | 已打开文件 | LogicalState 回滚到 originalText；dirty 清除（若无其他编辑）| = originalText | 不变 | 否 |
| rejected | 未打开文件 | 文件内容不变 | 不存在 | = originalText（不变）| 否 |
| expired | 任意 | LogicalState 或 DiskState 变化致失效，不可操作 | 不确定 | 不确定 | 否 |
| error | 任意 | 执行链路出错（写入失败、读取失败等）| 不确定 | 不确定 | 否 |

所有终态由 canExecutePendingDiff 守卫：status 为终态时返回 false，任何 accept/reject 操作被阻断。

## 8. 持久化时机

| 操作 | 持久化时机 |
|------|----------|
| createDiff | 创建后立即写入 pending_diffs 表 |
| acceptDiff | 写磁盘成功后写入 terminal_diff_cards，从 pending_diffs 删除 |
| rejectDiff | 终态记录后写入 terminal_diff_cards，从 pending_diffs 删除 |
| expireDiff | 转 expired 后写入 terminal_diff_cards，从 pending_diffs 删除 |
| expireAllOnClose | 批量写入 terminal_diff_cards（见 DE-M-P-01 §5.3）|

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-23 | v1.0 | 初始版本，定义 PendingDiff 两条链路协议、失效条件、批量操作语义和持久化时机 |
| 2026-05-23 | v1.1 | §6.1 批量接受原子性从 NEEDS_HUMAN_DECISION 改为已决策（跳过继续）；§6.2 Cmd+S 从 NEEDS_HUMAN_DECISION 改为已决策（必须弹确认框）；§3.3 补充 canExecutePendingDiff Phase 阶段说明 |
| 2026-05-24 | v1.2 | 三态模型重构：§2 表格已打开链路移除 mounted_pending（pending→preapplied 立即）；§3 完整重写（LOGICAL_STATE_APPLIED 事件；accept 不写磁盘；绿增效果）；§4 未打开链路补充继承流（LOGICAL_STATE_APPEARED→preapplied）；§5 失效规则从单条触发改为统一 LogicalState 变化规则（§5.1 核心规则；§5.2 完整表）；§6.2 Cmd+S 语义修正（固化绿增，写盘仍为 Cmd+S 本身）；§7 终态表按路径拆分两行 accepted |
| 2026-05-24 | v1.3 | §4.3 继承流补充 effectivePath 升级（closed-file → open-file）和 ROLLBACK_LOGICAL_STATE 事件引用；§6.2 Cmd+S 确认框文案对齐 DE-M-T-01 §5-A 最新版本 |
