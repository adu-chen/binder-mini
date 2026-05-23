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
| 已打开文件链路 | edit_current_editor_document | 当前 Editor active 文件 | pending → mounted_pending → preapplied → accepting → terminal |
| 未打开文件链路 | update_file（Phase 11）| Workspace 内未打开文件 | pending → accepting → terminal |

## 3. 已打开文件链路（Phase 13-B/C）

### 3.1 完整链路图

```
工具调用（edit_current_editor_document）
→ DE.createDiff（status=pending）
→ MOUNT_TO_EDITOR（status=mounted_pending）
→ [用户可在编辑器查看绿审骨架（Phase 9-F）]
→ PREAPPLY_CONTENT（status=preapplied）
→ 用户决策：
    → [接受] ACCEPT_REQUESTED → accepting → WRITE_SUCCEEDED → terminal(accepted)
    → [拒绝] REJECT_REQUESTED → rejecting → TERMINAL_RECORDED → terminal(rejected)
    → [内容变化] EXPIRE_REQUESTED → expired → TERMINAL_RECORDED → terminal(expired)
```

### 3.2 各状态进入条件

**mounted_pending 进入条件**：
- 对应文件已在 Editor 中打开（有 active tab 或已打开 tab）
- PendingDiff.status === "pending"
- diffMachine 收到 MOUNT_TO_EDITOR 事件

**preapplied 进入条件**（Phase 13-B）：
- diff 处于 mounted_pending 状态
- 编辑器 active 文件与 diff.filePath 匹配
- diff 内容已预应用到编辑器缓冲区（逻辑状态修改，未写磁盘）
- diffMachine 收到 PREAPPLY_CONTENT 事件

**preapplied → reject 特殊约束**：
- 拒绝时必须触发编辑器缓冲区回滚（恢复到 originalText）
- 不得只记录终态而留下游离的预应用内容
- 回滚必须在 diffMachine → terminal(rejected) 之前完成

### 3.3 accept 前校验

accept 操作（无论从 pending 还是 preapplied 发起）必须执行以下校验：

1. canExecutePendingDiff(diffId) 返回 true（status 为可执行状态）
2. 读取磁盘当前文件内容
3. 计算当前内容 hash，与 PendingDiff.baseRevision 比对
4. hash 不一致 → 不执行写入，自动触发 EXPIRE_REQUESTED，diff 转 expired
5. hash 一致 → 继续写入 proposedText 到磁盘

注：preapplied 状态下，编辑器缓冲区已有 proposedText，但磁盘文件可能仍是 originalText（未保存），校验应比较磁盘内容而非编辑器缓冲区内容。

## 4. 未打开文件链路（Phase 13-E）

### 4.1 完整链路图

```
工具调用（update_file，Phase 11）
→ DE.createDiff（status=pending）
   [不进入 mounted_pending，不进入 preapplied]
→ 用户决策：
    → [接受] ACCEPT_REQUESTED → accepting → WRITE_SUCCEEDED → terminal(accepted)
    → [拒绝] REJECT_REQUESTED → rejecting → TERMINAL_RECORDED → terminal(rejected)
    → [文件被外部修改] EXPIRE_REQUESTED → expired → TERMINAL_RECORDED → terminal(expired)
```

### 4.2 约束

- 未打开文件不进入 mounted_pending / preapplied
- 未打开文件的 accept 直接写磁盘（无需编辑器缓冲区操作）
- accept 前的 originalText 校验规则与已打开文件链路相同（§3.3）

## 5. 失效触发条件

PendingDiff 在以下情况自动触发 EXPIRE_REQUESTED：

| 触发条件 | 检测时机 | 处理 |
|----------|----------|------|
| 磁盘文件内容变化（baseRevision hash 不一致）| accept 前校验、Workspace 重新打开 | 自动转 expired |
| 目标文件被删除 | 工具调用结果或文件树刷新 | 自动转 expired |
| Workspace 关闭（expireAllOnClose）| workspaceMachine → Closing | 所有非终态 diff 转 expired |
| accept 前磁盘读取失败 | acceptDiff 执行时 | 转 error |

注：当前实现（shouldExpirePendingDiff）通过比较 originalText 与磁盘内容检测变化。Phase 13-A 后改用 baseRevision hash 比对（更高效）。

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

原子性语义（NEEDS_HUMAN_DECISION）：批量接受是否应该全部成功或全部回滚？当前倾向于"跳过失败继续"（因为每条 diff 独立校验），但需要人类确认。

### 6.2 Cmd+S 保存触发接受（NEEDS_HUMAN_DECISION）

用户保存（Cmd+S）当前文件时，若该文件有 pending diff，是否自动弹出确认框"接受该文件的所有 pending diff"？这是用户体验决策，尚未确定交互流程。

候选方案：
- 方案 A：保存前弹出确认框，用户选择"接受所有"、"跳过 diff 直接保存"或"取消"
- 方案 B：保存不触发 diff 接受，两者独立操作
- 方案 C："保存"按钮旁显示"保存并接受"快捷操作

## 7. 终态语义

| 终态 | 语义 | 文件内容 | 可逆 |
|------|------|----------|------|
| accepted | 用户接受，proposedText 已写入磁盘 | = proposedText | 否 |
| rejected | 用户拒绝，文件内容不变 | = originalText（磁盘未变）| 否 |
| expired | 内容或定位已失效，不可操作 | 不确定（外部可能已修改）| 否 |
| error | 执行链路出错（写入失败、读取失败等）| 不确定 | 否 |

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
