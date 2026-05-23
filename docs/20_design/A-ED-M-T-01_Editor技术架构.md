---
文档编号：   ED-M-T-01
文档状态：   A
负责模块：   ED
文档职责：   Editor 技术架构与 Phase 9 方案
上游约束：   CORE-C-P-01、ED-M-D-01、SYS-C-T-01、SYS-C-T-02、binder-core/A-ED-M-T-01
直接承接：   后续 Editor BlockId、绿增渲染 实现 Issue Trace
使用边界：   定义 Editor Phase 9 技术方案和验收口径，不写运行时代码
变更要求：   修改状态机、Markdown 转换、BlockId 或 DiffDecoration 策略必须同步 SYS-C-T-01 和测试
---

# Editor 技术架构

## 1. 目标

将当前单 textarea / 单文件 Editor MVP 演进为可承载多文件编辑、Diff 定位和绿增展示的 Editor Runtime。

Phase 9 技术目标：

1. 多标签数据结构可表达每个打开文件的独立状态。
2. dirty 标记、关闭保护和状态栏成为显式规则来源。
3. TipTap/Markdown 方案先确认边界，再进入依赖和代码实现。
4. BlockId / DocumentAnchor 由 Editor Runtime 生成或校验。
5. DiffDecoration 只消费已验证 range/anchor，渲染绿增效果，不自行全文搜索定位，编辑器内不显示红删。

## 2. 状态模型

### 2.1 单标签状态机

单个标签页使用 `editorMachine` 或等价状态机表达：

```mermaid
stateDiagram-v2
    [*] --> closed
    closed --> loading : OPEN_FILE
    loading --> editing : LOAD_EDITABLE
    loading --> readonly : LOAD_READONLY
    loading --> error : LOAD_FAILED
    editing --> dirty : CONTENT_CHANGED
    dirty --> saving : SAVE
    saving --> editing : SAVE_SUCCESS
    saving --> dirty : SAVE_FAILED
    editing --> closed : CLOSE
    readonly --> closed : CLOSE
    dirty --> closed : CLOSE_CONFIRMED
```

约束：

1. `dirty` 不得被 tab 切换清除。
2. `saving` 中不得并发启动第二次保存。
3. `readonly` 文件不能进入保存路径。
4. `dirty` 标签关闭必须先确认或被上游 Workspace guard 阻断。

### 2.2 多标签数据结构

建议结构：

```ts
interface EditorTab {
  id: string;
  workspaceRoot: string;
  filePath: string;
  content: string;
  mode: "editable" | "readonly";
  dirty: boolean;
  status: "loading" | "editing" | "dirty" | "saving" | "readonly" | "error";
  error?: string;
}

interface EditorSession {
  tabs: EditorTab[];
  activeTabId: string | null;
}
```

约束：

1. `id` 是 UI 会话标识，不替代 Workspace 相对路径。
2. `filePath` 必须是 Workspace 相对路径。
3. 同一 Workspace 内同一文件默认复用已有 tab，不重复打开。
4. 切换 Workspace 前必须检查全部 tab 的 dirty 状态。

## 3. TipTap/Markdown 方案

TipTap/Markdown 选型以 `A-ED-M-T-02` 为准（已确认，状态 A）。

已确认依赖：

1. `@tiptap/react`
2. `@tiptap/starter-kit`
3. `@tiptap/extension-placeholder`
4. `@tiptap/pm`
5. `tiptap-markdown`

技术边界：

1. `.md` 使用 TipTap/ProseMirror 承载编辑体验，保存时输出 Markdown 文本。
2. `.txt` 与 `.md` 共用同一 TipTap 实例，采用纯文本序列化（无 Markdown 转换）。对齐 binder-core EditorArea.tsx。
3. Markdown 读写转换必须保留标题、列表、引用、代码块等基础语义。
4. 转换失败不得覆盖原文件；必须保留 dirty 状态并暴露错误。

**Phase 9 步骤 1-4 已完成**（多标签、dirty 保护、TipTap 选型、Markdown 运行时）。步骤 5-6（BlockId、DiffDecoration）依赖 Diff Review v2 数据结构，进入实现前需先完成 `DE-M-T-01`。

## 4. BlockId / Anchor 策略

BlockId 目标是为后续 Diff Review v2 提供比全文搜索更稳定的定位辅助。

最小策略：

1. 顶层块可生成 `blockId` 或等价 `DocumentAnchor`。
2. BlockId 由 Editor Runtime 生成、修复和校验。
3. 模型可以引用 BlockId，但不能凭模型输出直接越过校验。
4. 缺失、重复或无法解析时，PatchValidation 必须降级为弱定位或拒绝执行。

持久化策略（已决策）：

| 策略 | 说明 | 决策 |
|------|------|------|
| Markdown 内嵌标记 | 在 Markdown 中保留 block metadata | 不采用（会污染用户源文）|
| workspace.db 映射表 | 在 `.binder/workspace.db` 维护 path + block hash + id | 不采用（需维护重建逻辑）|
| 会话内生成（已选）| BlockId 在每次打开文件时由 Editor Runtime 生成，不持久化，跨会话重置 | **采用** |

决策说明：BlockId 采用**会话内生成**方案（对齐 binder-core data-block-id HTML 属性实现）。每次打开文件时 Editor Runtime 生成新 BlockId，应用重启或文件关闭后 BlockId 失效。跨会话 BlockId 失效为已接受的已知限制。

**前置门禁**：BlockId 实现必须先完成 `DE-M-T-01` Diff Review v2 数据结构设计，确认 anchor 消费协议后再开始。

## 5. DiffDecoration 绿增

DiffDecoration 只负责 DisplayState 展示，不拥有 Diff 生命周期。

核心约束：

1. 数据来源必须是 DE / Diff Review 产生的 PendingDiff（preapplied 状态）。
2. 绿增位置必须来自已验证 range/anchor。
3. 无法解析 range/anchor 时，不得用全文搜索伪造高亮。
4. 编辑器内只显示绿色新增（绿增），不显示红色删除；完整红删绿增 diff 视图只在聊天消息流中展示。
5. Accepted / Rejected / Expired / Error 等终态后高亮自动移除，不在编辑器长期保留可执行高亮。

**代码命名规范（对齐 TERM-DE-004 code_identifier）**：

- 渲染层 React 组件命名为 `GreenAdditionOverlay`，负责将绿增 overlay 渲染到 DisplayState。
- TipTap 自定义扩展命名为 `GreenAdditionDecoration`，负责在 ProseMirror 视图层注册 overlay decoration。
- 绑定和移除绿增时以 `diffId` 为 key 区分不同 diff 的 overlay 注册；不使用文件路径或行号作为 overlay key。

**前置门禁**：DiffDecoration 骨架实现必须在 BlockId 策略确认和 DE-M-T-01 数据结构完成后进入。

## 5-A. 文档三态模型与 Dirty 状态

Editor Runtime 维护文档的三种状态：

| 状态 | 定义 | 修改者 |
|------|------|--------|
| **DiskState（磁盘状态）** | 文件在磁盘上的永久内容；Workspace 打开时读取；每次 Cmd+S 保存后更新 | 仅用户显式保存（Cmd+S）；禁止任何其他路径修改 |
| **LogicalState（逻辑状态）** | Editor 内存缓冲区（应用直接操作的编辑状态；文件未打开时不存在）| 用户编辑、AI diff 应用（preapplied）、reject 回滚 |
| **DisplayState（显示状态）** | 编辑器实际渲染出的可见内容；读取 LogicalState 并叠加渲染效果（绿增 overlay 等）；无独立存储 | 派生自 LogicalState；不可独立写入 |

Dirty 状态规则（唯一来源）：

```
isDirty = (LogicalState ≠ DiskState)
```

| 操作 | LogicalState | DiskState | isDirty |
|------|-------------|-----------|---------|
| 文件打开（read DiskState）| = DiskState | 不变 | false |
| 用户编辑 | 变化 | 不变 | true |
| AI diff 应用（preapplied）| = proposedText | 不变 | true |
| Accept（open-file 路径）| 不变（已是 proposedText）| **不变** | true（保持）|
| Reject（open-file 路径）| 回滚 = originalText | 不变 | false（若无其他编辑）|
| 保存（Cmd+S）| 不变 | = LogicalState | false |

**关键边界**：Accept（已打开文件路径）不修改 DiskState，不写入 DiskState；DiskState 仅在用户 Cmd+S 保存时更新。这是绝对约束，无例外。

## 6. 候选规则

以下规则是 Phase 9 后续实现候选，尚未登记为 `SYS-C-T-01` 的正式 RULE。进入代码实现前必须升级为正式规则、补 `@GOV` owner 和测试覆盖。

| 候选规则 | 候选链路 | 来源需求 | 规则意图 |
|----------|----------|----------|----------|
| ED-CAND-DATA-002 | ED-OPEN-FILE | REQ-ED-007 | BlockId / Anchor 必须由 Editor Runtime 生成或校验。 |
| ED-CAND-STATE-004 | ED-DIFF-RENDER | REQ-ED-008 | DiffDecoration 只能消费已验证 range/anchor；编辑器内只渲染绿增，不渲染红删。 |

已升级为正式规则：

| 正式规则 | 主链路 | 来源需求 | 规则意图 |
|----------|--------|----------|----------|
| BR-ED-STATE-002 | ED-OPEN-FILE | REQ-ED-003 | 多标签必须保留每个打开文件的独立内容、dirty 和状态；重复打开同一文件时复用既有标签。 |
| BR-ED-STATE-003 | ED-SAVE-FILE | REQ-ED-004 | dirty 标签关闭或 Workspace 切换前必须确认、保存或阻断。 |
| BR-ED-STATE-004 | ED-OPEN-FILE | REQ-ED-005 | 状态栏必须从 active tab 派生当前文件、保存状态和基础统计信息。 |
| BR-ED-PERSIST-002 | ED-OPEN-FILE、ED-SAVE-FILE | REQ-ED-006 | `.md` 必须通过 TipTap/Markdown 运行时维护 Markdown 文本；转换失败不得覆盖磁盘内容。 |

## 7. 验收标准

实现完成后必须满足：

1. md/txt 打开保存主流程不回退。
2. 多标签切换不丢失 dirty 内容。
3. 关闭 dirty 标签或切换 Workspace 有保护路径。
4. Markdown 保存转换失败不会写坏原文件。
5. BlockId 不由模型输出直接决定执行位置。
6. DiffDecoration 无验证 range/anchor 时不渲染伪高亮。
7. Accept（已打开文件路径）不写入 DiskState；DiskState 仅 Cmd+S 保存时更新。
8. 编辑器内只显示绿增（新增内容绿色覆盖），不显示红色删除；红删绿增完整 diff 视图只在聊天消息流中展示。

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-22 | v1.0 | 初始版本，定义 Editor Phase 9 技术架构草稿 |
| 2026-05-22 | v1.1 | 将多标签候选规则升级为 BR-ED-STATE-002 |
| 2026-05-22 | v1.2 | 将 dirty 关闭保护和状态栏候选规则升级为正式规则 |
| 2026-05-22 | v1.3 | 引用 ED-M-T-02，确认 TipTap/Markdown 选型候选 |
| 2026-05-22 | v1.4 | 将 Markdown 转换候选规则升级为 BR-ED-PERSIST-002 |
| 2026-05-23 | v1.5 | 文档状态升级为 A；补充 BlockId/DiffDecoration 前置门禁说明；标注 Phase 9 步骤 1-4 已完成 |
| 2026-05-23 | v1.6 | §3 .txt 文件路径从"继续 textarea"改为"与 .md 共用 TipTap 实例，纯文本序列化"（对齐 binder-core EditorArea.tsx）；§4 BlockId 持久化策略从"建议 workspace.db 映射表"改为已决策"会话内生成，不持久化" |
| 2026-05-24 | v1.7 | §5 标题"绿审态"改为"绿增"；补充编辑器只显示绿增不显示红删约束；新增 §5-A 文档三态模型（DiskState/LogicalState/DisplayState）与 Dirty 状态规则；Accept 不写磁盘绝对边界明确；§6 候选规则 ED-CAND-STATE-004 补充绿增约束；§7 验收标准新增条目 7、8 |
| 2026-05-24 | v1.8 | §5 补充代码命名规范（D-05）：GreenAdditionOverlay（React 组件）、GreenAdditionDecoration（TipTap 扩展）；绿增 overlay 以 diffId 为 key |
