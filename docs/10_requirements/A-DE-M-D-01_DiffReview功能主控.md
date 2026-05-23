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

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-23 | v1.0 | 初始版本，定义 Diff Review 功能需求颗粒度和 REQ-DE-* ID |
