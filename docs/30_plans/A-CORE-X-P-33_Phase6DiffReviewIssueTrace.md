---
文档编号：   CORE-X-P-33
文档状态：   A
负责模块：   DE
文档职责：   Phase 6 Diff Review 模块 Issue Trace——PendingDiff 扩展、DiffStore、diffMachine 升级、open-file 链路、GreenAdditionDecoration、Accept/Reject/Expire、持久化、复合场景、DiffCard UI
上游约束：   CORE-X-P-27（大纲 §七）、DE-M-T-01（v1.7）、DE-M-P-01（v1.4）、DE-M-P-02（v1.6）、SYS-C-T-01（v2.8）、SYS-C-UI-01
直接承接：   Phase 7（跨模块事件完整接线）、Phase 8（规则覆盖验收）
使用边界：   逐 Issue 列出交付范围、规则映射、名词声明和通过标准；不写运行时代码正文
变更要求：   Issue 完成后更新验收状态；调整链路协议必须同步 DE-M-T-01 和 DE-M-P-02
---

# Phase 6 Diff Review 模块 Issue Trace

---

## 一、规则映射链图

```
链路 DE-CREATE-DIFF
  ├─ BR-DE-DATA-001 ── PendingDiff 必须携带 sourceToolId、baseRevision、createdAt、effectivePath；
  │                    缺少可溯源字段的 diff 不得进入 pending 状态
  │                    约束代码：src/types/diff.ts PendingDiff 类型声明；
  │                              src/services/diffService.ts createDiff() 参数校验
  │                    验证：diffMachine 收到 DIFF_CREATED 必须检查字段完整性
  │
  ├─ BR-DE-STATE-001 ── 内容编辑工具输出必须进入 PendingDiff，不得直接写文件
  │                    约束代码：src/stores/diffStore.ts createDiff() 为唯一创建入口；
  │                              edit_current_editor_document 工具 → DE 层 createDiff
  │                    验证：无任何工具调用路径可绕过 DiffStore 直接修改 DiskState
  │
  ├─ BR-DE-STATE-005 ── preapplied 只适用于已打开文件链路；
  │                    Accept open-file 不写 DiskState
  │                    约束代码：diffStore.createDiff() 路由 effectivePath；
  │                              已打开文件：立即触发 LOGICAL_STATE_APPLIED → preapplied；
  │                              未打开文件：保持 pending，不进入 preapplied
  │
  ├─ BR-AG-DATA-003 ── 内容编辑工具必须使用 originalText + newText 精确替换接口；
  │                    originalText 找不到 → LOGICAL_STATE_APPLIED_FAILED → error，不 fallback
  │                    约束代码：src/services/editorActor.ts applyDiffReplaceInEditor()；
  │                              PM 文本搜索 originalText；精确替换为 newText；记录 appliedRange
  │
  └─ BR-ED-DATA-002 ── BlockId 由 BlockIdExtension 在 appendTransaction 中维护（Phase 4 已实现）
                       约束代码：src/components/extensions/BlockIdExtension.ts（已有）

链路 DE-ACCEPT-DIFF
  ├─ BR-DE-STATE-010 ── DiskState 唯一写入路径：
  │                    open-file → 仅 Cmd+S 时写；closed-file accept → 精确替换后写
  │                    约束代码：editorActor saveFile action；diffStore.acceptDiff() 分支路由
  │                    验证：Accept open-file 路径无 write_workspace_file IPC 调用
  │
  ├─ BR-DE-STATE-011 ── Accept open-file 不写 DiskState；
  │                    仅移除 appliedRange 的 GreenAdditionDecoration；LogicalState 不变
  │                    约束代码：diffStore.acceptDiff(diffId, "open-file")；
  │                              通知 editorMachine 移除 GreenAdditionDecoration
  │
  ├─ BR-DE-STATE-004 ── Accept closed-file：hash 比对（当前 DiskState SHA-256 vs baseRevision）；
  │                    不一致时转 expired，不执行写入
  │                    约束代码：diffStore.acceptDiff(diffId, "closed-file")；
  │                              readWorkspaceFile → SHA-256(content) === baseRevision；
  │                              不一致 → EXPIRE_REQUESTED
  │
  └─ BR-DE-PERSIST-001 ── 只有接受后才能写文件；
                          Cmd+S 含 preapplied diff 时必须先批量 accept 再写 DiskState
                          约束代码：editorActor saveFile() preapplied 检测；确认对话框；
                                    批量 accept → GreenAdditionDecoration 移除 → write_workspace_file

链路 DE-REJECT-DIFF
  └─ BR-DE-STATE-002 ── 拒绝后候选修改进入不可执行终态，文件不变
                        约束代码：diffStore.rejectDiff(diffId, "open-file") →
                                   revision token 校验 → ROLLBACK_LOGICAL_STATE →
                                   editorMachine appliedRange 精确回滚（newText → originalText）；
                                   closed-file → 直接 terminal(rejected)，DiskState 不变

链路 DE-EXPIRE-DIFF
  ├─ BR-DE-STATE-003 ── 内容变化或定位失效后 PendingDiff 进入 expired，不可继续操作
  │                    约束代码：diffStore.expireDiff()；diffMachine EXPIRE_REQUESTED 门禁
  │
  ├─ BR-DE-STATE-012 ── 统一失效规则：diff 区域 LogicalState 任何变化或 DiskState 外部写入
  │                    → EXPIRE_REQUESTED → expired；diff-on-diff 属子场景自然覆盖
  │                    约束代码：editorActor syncPendingDiffsWithDocument()；
  │                              每次 docChanged 事务检查
  │                              doc.textBetween(appliedRange.from, appliedRange.to) === newText；
  │                              不匹配 → EXPIRE_REQUESTED
  │
  └─ BR-DE-STATE-013 ── WORKSPACE_CLOSED 时所有非终态 PendingDiff 转 expired 并写入 WorkspaceDatabase
                        约束代码：diffStore.expireAllOnClose() on WORKSPACE_CLOSED 事件；
                                   批量写入 terminal_diff_cards 表

链路 ED-DIFF-RENDER
  ├─ BR-ED-STATE-005 ── DisplayState 只读派生：DisplayState = LogicalState + GreenAddition overlay；
  │                    不得绕过此规则向渲染层直接注入内容
  │                    约束代码：GreenAdditionDecoration.ts 通过 TipTap Decoration.inline 注册 overlay；
  │                              不修改 LogicalState 内容
  │
  └─ BR-ED-STATE-006 ── GreenAdditionDecoration 只消费已验证 appliedRange；
                        未经 applyDiffReplaceInEditor 记录的 appliedRange 不得渲染
                        约束代码：GreenAdditionDecoration Extension；
                                   appliedRange 由 LOGICAL_STATE_APPLIED 事件携带写入 diffMachine context

链路 DE-ACCEPT-DIFF / DE-REJECT-DIFF / DE-EXPIRE-DIFF（持久化）
  └─ BR-DE-PERSIST-002 ── PendingDiff 状态必须持久化到 WorkspaceDatabase；
                           重启后：pending 可恢复或自动转 expired（baseRevision hash 校验）；
                           preapplied 恢复后降级为 pending（LogicalState 跨会话不可恢复）
                           约束代码：Rust save_pending_diff / save_terminal_card 命令；
                                     TypeScript loadDiffsFromWorkspace() + baseRevision 校验；
                                     expireAllOnClose() 批量写 terminal_diff_cards

链路 AG-TOOL-CALL（依赖 Phase 5 SSE 框架，Phase 6-B 实现执行循环）
  ├─ BR-AG-DATA-002 ── ToolResult 必须在同轮以 role="tool" 消息回流；不得注入为 user message；
  │                    ToolResult 必须携带 callId 与对应 ToolExecution 关联
  │                    约束代码：chatActor.ts 工具执行循环；messages 追加 role="tool" AgentMessage；
  │                              ToolResult.callId === ToolExecution.id
  │
  └─ BR-AG-DATA-003 ── 共享 DE-CREATE-DIFF 约束（同一 applyDiffReplaceInEditor 实现）

链路 DE-ACCEPT-DIFF / DE-REJECT-DIFF（复合场景）
  └─ BR-DE-STATE-014 ── 关闭含 preapplied diff 的 EditorTab 前，必须提示批量接受或拒绝；
                         未经选择不得直接关闭 Tab 丢弃 preapplied 状态
                         约束代码：editorMachine CLOSE_TAB guard；
                                    preapplied diff 存在时 → 三选一对话框（接受并关闭 / 拒绝并关闭 / 取消）

链路 DE-CREATE-DIFF / DE-ACCEPT-DIFF / DE-REJECT-DIFF / DE-EXPIRE-DIFF（UI）
  ├─ BR-DE-UI-001 ── diffMachine 状态驱动 DiffCard 视觉状态；
  │                  pending/preapplied → 展示接受/拒绝按钮；
  │                  终态 → 降权 opacity 0.6，无操作入口
  │                  约束代码：DiffCard.tsx diffMachine 状态 selector；
  │                            终态判断：status in ("accepted","rejected","expired","error")
  │
  └─ BR-DE-UI-002 ── Editor 内只渲染绿增（GreenAddition）；
                     红删视图仅限 DiffCard 内容区（calculateHybridDiff(originalText, newText)）
                     约束代码：GreenAdditionDecoration.ts 渲染 newText 范围；
                               DiffCard.tsx diff view 区域

```

---

## 二、名词声明

| TERM ID | 正式英文名 | 正式中文名 | 在本 Issue Trace 中的角色 |
|---------|-----------|-----------|--------------------------|
| TERM-DE-001 | PendingDiff | 待审差异 | Phase 6-A 扩展类型；DiffStore 主键实体 |
| TERM-DE-002 | TerminalDiffCard | 终态差异卡 | 终态记录；持久化到 terminal_diff_cards 表 |
| TERM-DE-003 | DiffAnchorRef | 差异定位引用 | 辅助定位（可选）；originalText 为主定位器 |
| TERM-DE-004 | GreenAddition | 绿增 | Editor DisplayState overlay；只渲染 newText 范围 |
| TERM-DE-005 | baseRevision | 基准版本 | DiskState 内容 SHA-256 hash；Inherit Flow 和 accept 前校验基准 |
| TERM-DE-006 | originalText | 精确原文 | PM 文本搜索主定位器；缺失时 diff 进入 error 终态 |
| TERM-DE-007 | newText | 替换内容 | 精确替换片段（非全文）；LOGICAL_STATE_APPLIED 写入 LogicalState |
| TERM-DE-008 | appliedRange | 已应用范围 | PM 绝对位置 {from, to}；由 applyDiffReplaceInEditor 记录 |
| TERM-DE-009 | diffMachine | 差异状态机 | 每个 PendingDiff 一个实例；8 状态：pending/preapplied/accepting/rejecting/accepted/rejected/expired/error |
| TERM-DE-010 | effectivePath | 生效路径 | "open-file"（accept 只移除绿增）/ "closed-file"（accept 写 DiskState）；INHERIT_APPLIED 后升级为 "open-file" |
| TERM-DE-011 | DiffCard | 差异卡 | 聊天流中展示 PendingDiff 状态和操作入口的 UI 组件 |
| TERM-DOC-001 | DiskState | 磁盘状态 | 磁盘文件实际内容；写入路径：open-file → Cmd+S；closed-file → accept |
| TERM-DOC-002 | LogicalState | 逻辑状态 | TipTap 内存缓冲区；preapply 精确替换此层；reject 回滚此层 |
| TERM-DOC-003 | DisplayState | 显示状态 | LogicalState + GreenAddition overlay 派生；无独立存储 |
| TERM-ED-002 | ActiveFile | 激活文件 | editorMachine activeTabId 对应的当前打开文件 |
| TERM-ED-003 | editorMachine | 编辑器状态机 | 接收 ROLLBACK_LOGICAL_STATE 事件；负责精确回滚 LogicalState |
| TERM-ED-004 | BlockId | 块标识 | ProseMirror 节点 data-block-id 属性（UUID v4，session 级）；DiffAnchorRef.startBlockId 来源 |
| TERM-WS-002 | WorkspaceDatabase | 工作区数据库 | .binder/workspace.db；存储 pending_diffs 和 terminal_diff_cards 表 |
| TERM-AG-001 | ToolExecution | 工具执行 | AG-TOOL-CALL 链路中的执行记录；id 作为 sourceToolId 传入 createDiff |
| TERM-AG-005 | callId | 工具调用标识 | ToolExecution.id；ToolResult.callId 必须与之匹配 |
| TERM-AG-008 | ToolCall | 工具调用 | 模型输出的工具调用请求；chatMachine TOOL_REQUESTED 事件承载 |
| TERM-AG-009 | ToolResult | 工具结果 | role="tool" 的 AgentMessage；在同一轮以 chat-stream-event 回流 |

---

## 三、Issue 6-A — PendingDiff 扩展 + DiffStore + diffMachine 升级

### 交付范围

1. **`src/types/diff.ts`** — 完整重写：
   - `PendingDiff`：新增 `sourceToolId`、`baseRevision`（必填）、`effectivePath`、`createdAt`、`contentRevisionBeforeApply?`、`contentRevisionAfterApply?`、`anchor?: DiffAnchorRef`、`appliedRange?: {from, to}`
   - `PendingDiffStatus`：新增 `"preapplied"` 状态；`"accepting"` / `"rejecting"` 为内存临时态（不写 DB）
   - `TerminalDiffCard`：新增 `sourceToolId`、`resolvedAt`
   - `DiffAnchorRef`：新增完整字段（startBlockId、startOffset、endBlockId、endOffset、occurrenceIndex、paraIndex）

2. **`src/machines/diffMachine.ts`** — 完整重写为 8 状态机：
   - 状态：`pending / preapplied / accepting / rejecting / accepted / rejected / expired / error`
   - 事件：`DIFF_CREATED / LOGICAL_STATE_APPLIED / LOGICAL_STATE_APPLIED_FAILED / INHERIT_APPLIED / ACCEPT_REQUESTED / REJECT_REQUESTED / ACCEPT_CONFIRMED / TERMINAL_RECORDED / EXPIRE_REQUESTED / FAILED`
   - Context：`{ diff: PendingDiff }`
   - 状态守卫：terminal 和 error 不可逆；pending/preapplied 均可接受 EXPIRE_REQUESTED

3. **`src/stores/diffStore.ts`**（新建）— DiffStore 单例：
   - `pendingDiffs: Map<string, PendingDiff>`、`terminalCards: TerminalDiffCard[]`
   - 接口：`createDiff / getDiff / getAllDiffs / updateDiff / moveToterminal`
   - 提供 React context + hook（`useDiffStore()`）

4. **`src/services/diffService.ts`** — 扩展现有服务：
   - `createDiff(params: CreateDiffParams): PendingDiff`（含 sourceToolId、baseRevision、effectivePath 必填校验）
   - 保留现有 `canExecutePendingDiff`、`buildProposedEditorText`（待后续替换）

### 规则映射

| 规则 | 约束点 |
|------|-------|
| BR-DE-DATA-001 | PendingDiff 创建时必须携带 sourceToolId、baseRevision、createdAt、effectivePath |
| BR-DE-STATE-001 | diffStore.createDiff() 是唯一入口；工具调用不得绕过 |
| BR-SYS-GOV-001 | diffMachine 必须先于 diffService 实现；状态图以 DE-M-T-01 §4.2 为权威 |

### 关键实现约束

```typescript
// diff.ts — PendingDiff 类型（权威源：DE-M-T-01 §3.1）
interface PendingDiff {
  id: string;
  filePath: string;         // Workspace 相对路径 (TERM-CORE-001)
  originalText: string;     // 精确原文主定位器 (TERM-DE-006)
  newText: string;          // 替换内容片段，非全文 (TERM-DE-007)
  status: PendingDiffStatus;
  summary: string;
  sourceToolId: string;     // ToolExecution.id (TERM-AG-001, TERM-AG-005)
  baseRevision: string;     // SHA-256(DiskState bytes)，hex 64 chars (TERM-DE-005)
  createdAt: number;
  effectivePath: "open-file" | "closed-file"; // (TERM-DE-010)
  anchor?: DiffAnchorRef;   // 辅助定位 (TERM-DE-003)
  appliedRange?: { from: number; to: number }; // PM 绝对位置 (TERM-DE-008)
  contentRevisionBeforeApply?: string;
  contentRevisionAfterApply?: string;
}
```

### @GOV 边界声明

```
// diff.ts
boundary: in=PendingDiff lifecycle request from edit_current_editor_document or update_file tool |
          out=PendingDiff and TerminalDiffCard structures with sourceToolId and baseRevision fields

// diffMachine.ts
boundary: in=PendingDiff state transition events (DIFF_CREATED, LOGICAL_STATE_APPLIED, ACCEPT_REQUESTED, etc.) |
          out=diffMachine state (pending/preapplied/accepting/rejecting/accepted/rejected/expired/error)

// diffStore.ts
boundary: in=CreateDiffParams with sourceToolId and baseRevision | out=DiffStore Map<diffId, PendingDiff>
          and TerminalDiffCard list | delegate=diffMachine per-instance state transitions
```

### 验收条件

- `tsc --noEmit` 通过
- diffMachine 实例从 `pending` 到 `preapplied`、`expired`、`error` 各路径均可流转
- 缺少 `sourceToolId` 或 `baseRevision` 的 createDiff 调用抛出错误
- 现有 diffService.test.ts 中 5 个用例不退化

---

## 四、Issue 6-B — AG-TOOL-CALL 执行循环 + edit_current_editor_document → DE-CREATE-DIFF

### 交付范围

1. **`src/services/chatActor.ts`** — 工具执行循环（依赖 Phase 5 SSE 框架）：
   - chatMachine `TOOL_REQUESTED` → `toolCalling` 状态
   - 顺序执行（不并行），单工具超时 10s → `FAILED`
   - ToolResult 以 `role="tool"` AgentMessage 追加，携带 `callId === ToolExecution.id`
   - ToolResult 通过 chat-stream-event 回流，不注入为 user message（BR-AG-DATA-002）

2. **`src/services/editorActor.ts`** — applyDiffReplaceInEditor：
   - PM 文本搜索 `originalText`（TipTap editor.view.state.doc.textBetween 全文扫描）
   - 找到 → `deleteRange({from, to}).insertContentAt(from, newText)` 精确替换
   - 记录 `appliedRange: {from, to}`（newText 插入起点/终点）
   - 记录 `contentRevisionBeforeApply / contentRevisionAfterApply`
   - 找不到 → 返回 `{ success: false }`，触发 `LOGICAL_STATE_APPLIED_FAILED`

3. **`src/services/chatActor.ts` 或 `src/services/toolExecutor.ts`** — edit_current_editor_document 工具实现：
   - 读取工具参数：`{ filePath, originalText, newText, anchor? }`
   - 校验 ActiveFile.filePath === filePath（否则返回结构化 error）
   - 计算当前 DiskState baseRevision：`SHA-256(currentDiskContent)`
   - 调用 `diffStore.createDiff()`：effectivePath = "open-file"，sourceToolId = ToolExecution.id
   - 调用 `editorActor.applyDiffReplaceInEditor(originalText, newText)`
   - 成功 → diffMachine `LOGICAL_STATE_APPLIED(appliedRange)` → preapplied
   - 失败 → diffMachine `LOGICAL_STATE_APPLIED_FAILED` → error terminal，返回结构化 error

4. **`src/machines/chatMachine.ts`** — 补充 TOOL_REQUESTED / TOOL_FINISHED 事件及 toolCalling → streaming 转移

### 规则映射

| 规则 | 约束点 |
|------|-------|
| BR-AG-DATA-002 | ToolResult 携带 callId，以 role="tool" 在同轮回流；不注入为 user message |
| BR-AG-DATA-003 | originalText 精确匹配后替换为 newText；找不到 → error terminal，不 fallback |
| BR-DE-DATA-001 | createDiff 传入 sourceToolId（ToolExecution.id）和 baseRevision（当前 DiskState hash）|
| BR-DE-STATE-005 | effectivePath="open-file"；立即触发 LOGICAL_STATE_APPLIED → preapplied |
| BR-AG-OBS-001 | 单工具超时 10s → chatMachine FAILED；工具执行顺序：不并行 |

### @GOV 边界声明

```
// chatActor.ts（补充 toolCall 部分）
boundary: in=ToolCall from SSE chat-stream-event and ToolExecution list |
          out=ToolResult AgentMessage (role="tool") with callId appended to chatMachine context.messages |
          delegate=edit_current_editor_document → diffStore.createDiff + editorActor.applyDiffReplaceInEditor

// editorActor.ts（applyDiffReplaceInEditor 部分）
boundary: in=originalText string and newText string and ProseMirror document state |
          out=appliedRange {from, to} and contentRevision tokens on successful replace,
              or ApplyFailedResult on originalText not found
```

### 验收条件

- chatMachine 进入 `toolCalling` 后，执行工具调用，工具完成后返回 `streaming` 或 `ready`
- edit_current_editor_document 工具调用 → Editor LogicalState 精确替换（originalText → newText）
- originalText 不在文档中 → diff 进入 error 终态，不执行任何写文件操作
- ToolResult 的 `callId` 与发起 ToolCall 的 `callId` 匹配
- `tsc --noEmit` 通过

---

## 五、Issue 6-C — GreenAdditionDecoration + syncPendingDiffsWithDocument

### 交付范围

1. **`src/components/extensions/GreenAdditionDecoration.ts`**（新建）：
   - TipTap `Extension.create()`，注册 ProseMirror Plugin
   - 状态：维护 `Map<diffId, {from, to}>` preapplied diff 的 appliedRange
   - 渲染：`Decoration.inline(from, to, { class: "diff-green-addition" })` 渲染绿色高亮
   - 接口：`addGreenAddition(diffId, appliedRange)` / `removeGreenAddition(diffId)` / `clearAll()`
   - CSS：`.diff-green-addition { background: var(--diff-add-bg); }` (SYS-C-UI-01)
   - 只渲染 newText 范围；不渲染红删（红删仅在 DiffCard 中）

2. **`src/services/editorActor.ts`** — syncPendingDiffsWithDocument：
   - TipTap `onTransaction({ transaction })` 监听
   - 仅在 `transaction.docChanged` 时执行
   - 对所有 preapplied diff：`doc.textBetween(appliedRange.from, appliedRange.to) === newText`
   - 不匹配 → 通知 diffStore 发出 `EXPIRE_REQUESTED` → diff 自动进入 expired
   - 仅检查 diff 所在区域（appliedRange 范围），不扫描全文，避免误触发

3. **`src/services/editorActor.ts`** — ROLLBACK_LOGICAL_STATE 处理：
   - 接收 diffMachine ROLLBACK_LOGICAL_STATE 事件：`{ diffId, appliedRange, originalText }`
   - `withSuppressedPendingContentSync` 包裹：暂时停止 syncPendingDiffsWithDocument 误触发
   - 在 appliedRange 位置将 newText 回滚为 originalText（deleteRange + insertContentAt）
   - 回滚完成后恢复 syncPendingDiffsWithDocument

### 规则映射

| 规则 | 约束点 |
|------|-------|
| BR-ED-STATE-005 | DisplayState = LogicalState + GreenAddition overlay；GreenAdditionDecoration 不修改 LogicalState |
| BR-ED-STATE-006 | appliedRange 必须经 LOGICAL_STATE_APPLIED 事件携带写入 diffMachine context；未验证的 appliedRange 不渲染 |
| BR-DE-STATE-012 | syncPendingDiffsWithDocument：appliedRange 位置 newText 不匹配 → EXPIRE_REQUESTED；diff-on-diff 自然覆盖 |
| BR-DE-UI-002 | Editor 只渲染绿增；红删视图仅限 DiffCard.tsx 内容区 |

### @GOV 边界声明

```
// GreenAdditionDecoration.ts
boundary: in=appliedRange {from, to} and diffId from preapplied diffMachine instances |
          out=TipTap Decoration.inline overlay on newText range (class: diff-green-addition) |
          delegate=syncPendingDiffsWithDocument Transaction listener for EXPIRE_REQUESTED dispatch
```

### 验收条件

- preapplied diff 的 appliedRange 范围在 Editor 内显示绿色高亮
- 用户编辑命中 diff 区域后，GreenAdditionDecoration 消失，diff 进入 expired
- 编辑非 diff 区域不触发 expire
- diff-on-diff：新 diff 修改同区域后旧 diff 自动 expired
- `tsc --noEmit` 通过

---

## 六、Issue 6-D — Accept / Reject / Expire 完整链路

### 交付范围

1. **`src/services/diffService.ts` + `src/stores/diffStore.ts`** — 完整实现：

   **acceptDiff（open-file 路径）**：
   - 验证 diffMachine.state === "preapplied"
   - 通知 GreenAdditionDecoration 移除 appliedRange overlay
   - diffMachine → accepting → ACCEPT_CONFIRMED → terminal(accepted)
   - 不读磁盘、不写磁盘；DiskState 不触碰；file 保持 dirty
   - 写 WorkspaceDatabase terminal_diff_cards；从 pending_diffs 删除

   **acceptDiff（closed-file 路径）**：
   - 验证 diffMachine.state === "pending"（未打开文件不进入 preapplied）
   - `read_file(workspaceRoot, filePath)` → SHA-256(content) 与 baseRevision 比对
   - 不一致 → EXPIRE_REQUESTED → expired → terminal；不执行写入
   - 一致 → PM 文本搜索 originalText → 精确替换为 newText → `write_workspace_file` 写 DiskState
   - diffMachine → accepting → ACCEPT_CONFIRMED → terminal(accepted)

   **rejectDiff（open-file 路径）**：
   - 读取 editor.view.state 当前 revision token
   - revision === contentRevisionAfterApply → 安全回滚：发出 ROLLBACK_LOGICAL_STATE 事件到 editorMachine
   - revision ≠ contentRevisionAfterApply → 用户已编辑 diff 区域 → diffMachine FAILED → error terminal
   - （后者不发送 ROLLBACK_LOGICAL_STATE，不强制覆盖 LogicalState）
   - 成功回滚后：移除 GreenAdditionDecoration；diffMachine → rejecting → TERMINAL_RECORDED → terminal(rejected)

   **rejectDiff（closed-file 路径）**：
   - 直接 diffMachine → rejecting → TERMINAL_RECORDED → terminal(rejected)；DiskState 不变

   **expireDiff**：
   - diffMachine → EXPIRE_REQUESTED → expired → TERMINAL_RECORDED → terminal(expired)
   - 写 terminal_diff_cards；从 pending_diffs 删除

   **expireAllOnClose**：
   - 遍历所有非终态 PendingDiff → expireDiff（批量，不抛异常中断其余）
   - 写 WorkspaceDatabase batch terminal_diff_cards；清空 pending_diffs 非终态记录
   - 在 WORKSPACE_CLOSED 事件处理中调用（先于 chatMachine.onWorkspaceClosed）

2. **`src/services/useDiffActor.ts`**（新建）— React hook，连接 diffStore 与 UI：
   - 暴露 `acceptDiff / rejectDiff / expireDiff` 给 DiffCard
   - 暴露 `allDiffs / terminalCards` 给 ChatPanel
   - 订阅 WORKSPACE_CLOSED → 调用 expireAllOnClose

### 规则映射

| 规则 | 约束点 |
|------|-------|
| BR-DE-STATE-010 | DiskState 写入路径：acceptDiff open-file 不写；acceptDiff closed-file 写；Cmd+S 写 |
| BR-DE-STATE-011 | acceptDiff open-file 只移除 GreenAdditionDecoration，无 write_workspace_file IPC 调用 |
| BR-DE-STATE-004 | acceptDiff closed-file：SHA-256(currentContent) === baseRevision 校验；失败 → EXPIRE_REQUESTED |
| BR-DE-STATE-002 | rejectDiff：已打开文件 → 精确回滚 LogicalState；未打开文件 → DiskState 不变 |
| BR-DE-STATE-003 | expireDiff：diff 进入 expired 终态，不可再 accept/reject |
| BR-DE-STATE-013 | expireAllOnClose on WORKSPACE_CLOSED，所有非终态 diff 转 expired |

### @GOV 边界声明

```
// diffStore.ts（acceptDiff / rejectDiff / expireDiff 部分）
boundary: in=diffId string and effectivePath routing context |
          out=diffMachine terminal state (accepted/rejected/expired/error) and
              WorkspaceDatabase terminal_diff_cards upsert via save_terminal_card Tauri command |
          delegate=editorMachine ROLLBACK_LOGICAL_STATE for open-file reject path
```

### 验收条件

- acceptDiff（open-file）：GreenAdditionDecoration 消失；LogicalState 不变（含 newText）；无 IPC write_workspace_file 调用
- acceptDiff（closed-file）：baseRevision 不一致时 diff 转 expired，文件不变；一致时 DiskState 精确替换
- rejectDiff（open-file）：revision 匹配时 LogicalState 回滚（newText → originalText）；revision 不匹配时 error 终态，LogicalState 保持用户编辑
- rejectDiff（closed-file）：直接 terminal(rejected)，DiskState 不变
- expireAllOnClose：所有非终态 diff 转 expired，DB 写入完成
- `tsc --noEmit` 通过

---

## 七、Issue 6-E — workspace.db 持久化 + 重启恢复 + Inherit Flow

### 交付范围

1. **`src-tauri/src/lib.rs`** — 新增 Rust 命令：
   - `save_terminal_card(workspace_root, card: TerminalDiffCardRecord) → Result<(), String>`
     - 写入 terminal_diff_cards 表（字段：diff_id, status, message, source_tool_id, resolved_at）
     - 同时从 pending_diffs 删除对应 id
   - `load_terminal_cards_from_workspace(workspace_root) → Result<Vec<TerminalDiffCardRecord>, String>`
     - 读取 terminal_diff_cards 表，按 resolved_at 倒序
   - 在 `generate_handler![]` 中注册

2. **`src/stores/diffStore.ts`** — 持久化接口：
   - `persistDiffCreated(diff: PendingDiff)` → IPC `save_pending_diff`
   - `persistDiffTerminated(card: TerminalDiffCard)` → IPC `save_terminal_card`
   - `loadDiffsFromWorkspace(workspaceRoot)` → IPC `load_diffs_from_workspace`：
     - 对每条记录计算当前 DiskState SHA-256
     - 与 baseRevision 比对：一致 → 恢复为 pending（preapplied 降级为 pending）；不一致 → 自动 expired
   - `loadTerminalCardsFromWorkspace(workspaceRoot)` → IPC `load_terminal_cards_from_workspace`

3. **Inherit Flow（File Open 触发）**：
   - editorMachine `FILE_LOADED` 后，diffStore 查询 `status=pending AND effectivePath="closed-file" AND filePath=loadedFilePath`
   - 按 `createdAt` 升序，依次向对应 diffMachine 发送 `LOGICAL_STATE_APPEARED`：
     - diffMachine 检查 baseRevision === SHA-256(当前 DiskState)
     - 一致 → effectivePath 升级为 "open-file" → applyDiffReplaceInEditor → INHERIT_APPLIED → preapplied
     - 不一致 → EXPIRE_REQUESTED → expired
   - 继承后绿增效果展示；accept 走 open-file 路径（不写 DiskState）

### 规则映射

| 规则 | 约束点 |
|------|-------|
| BR-DE-PERSIST-002 | createDiff 后立即写 pending_diffs；终态后写 terminal_diff_cards 删 pending；重启恢复 + baseRevision 校验 |
| BR-DE-STATE-013 | expireAllOnClose 批量写 terminal_diff_cards |
| BR-DE-DATA-001 | load 恢复时 baseRevision 用于 hash 校验（Inherit Flow 前提） |
| BR-DE-STATE-005 | Inherit Flow：effectivePath 从 closed-file 升级为 open-file 后，accept 不写 DiskState |

### @GOV 边界声明

```
// lib.rs — save_terminal_card / load_terminal_cards_from_workspace
boundary: in=TerminalDiffCardRecord with diff_id, status, source_tool_id, resolved_at |
          out=terminal_diff_cards row inserted and pending_diffs row deleted in WorkspaceDatabase

// diffStore.ts — loadDiffsFromWorkspace + Inherit Flow
boundary: in=workspace_root path and DiskState SHA-256 hash comparison |
          out=PendingDiff list restored as pending (preapplied downgraded) or auto-expired,
              with LOGICAL_STATE_APPEARED dispatch for closed-file pending diffs on file open
```

### 验收条件

- WORKSPACE_CLOSED → 所有非终态 diff 写入 terminal_diff_cards（pending/preapplied → expired）
- WORKSPACE_OPENED + 重新打开文件 → baseRevision 一致的 pending diff 恢复；不一致的自动 expired
- Inherit Flow：closed-file pending diff 目标文件被打开时，hash 一致 → preapplied + 绿增展示；hash 不一致 → expired
- cargo test ≥ 16 pass（含 save_terminal_card 的 Rust 单测）
- `tsc --noEmit` 通过

---

## 八、Issue 6-F — 复合场景 + DiffCard UI

### 交付范围

1. **Cmd+S 含 preapplied diff（`BR-DE-PERSIST-001`）**：
   - editorActor `saveFile()` 检测：activeFile 是否有 preapplied 状态 diff
   - 有 → 展示确认对话框："保存所有更改（包含您的编辑和 [N] 处 AI 建议的修改）。" / [确认保存] [取消]
   - 确认 → 批量 acceptDiff（open-file 路径，按 createdAt 升序，跳过继续原则）→ 全部成功后执行 `write_workspace_file`
   - 批量 accept 有失败 → 不执行 write_workspace_file；保持 dirty，等待用户处理失败卡片后重试
   - 取消 → 中止保存，dirty 保持

2. **Tab 关闭含 preapplied diff（`BR-DE-STATE-014`）**：
   - editorMachine `CLOSE_TAB` guard：检测 tab.filePath 是否有 preapplied diff
   - 有 → 三选一对话框：
     - [接受并关闭]：批量 acceptDiff → GreenAdditionDecoration 清除 → 关闭 Tab
     - [拒绝并关闭]：批量 rejectDiff → LogicalState 回滚 → 关闭 Tab
     - [取消关闭]：中止关闭操作，Tab 保持 preapplied 状态
   - 无 preapplied diff → 走原有 dirty 检测逻辑

3. **`src/components/DiffCard.tsx`** — 完整 UI 实现（`BR-DE-UI-001`、`BR-DE-UI-002`）：
   - Props：`diff: PendingDiff | null, card: TerminalDiffCard | null, onAccept, onReject`
   - pending/preapplied 状态：展示 originalText vs newText 差异视图（calculateHybridDiff）+ [接受] [拒绝] 按钮
   - 差异视图：Editor 内只展示绿增（GreenAddition）；红删仅在 DiffCard 内容区（CSS `--diff-del-bg`）
   - terminal 状态：opacity: 0.6，无操作按钮，展示终态状态（accepted / rejected / expired / error）+ resolvedAt

### 规则映射

| 规则 | 约束点 |
|------|-------|
| BR-DE-PERSIST-001 | Cmd+S：preapplied diff 存在时必须先批量 accept 再写 DiskState |
| BR-DE-STATE-010 | Cmd+S 批量 accept 成功后，write_workspace_file 才是 DiskState 写入时机 |
| BR-DE-STATE-014 | CLOSE_TAB guard：preapplied diff 存在时强制三选一确认 |
| BR-DE-UI-001 | DiffCard 状态由 diffMachine 状态驱动；终态降权 opacity 0.6 |
| BR-DE-UI-002 | Editor 只渲染绿增；DiffCard 内容区展示完整红删绿增 diff |

### @GOV 边界声明

```
// DiffCard.tsx
boundary: in=PendingDiff status and TerminalDiffCard from diffStore |
          out=DiffCard UI with accept/reject actions (non-terminal) or degraded display (terminal)

// editorActor.ts — saveFile preapplied guard
boundary: in=ActiveFile preapplied PendingDiff list from diffStore |
          out=confirmation dialog result routing to batch acceptDiff then write_workspace_file,
              or abort save on cancel
```

### 验收条件

- Cmd+S 时 ActiveFile 有 N 个 preapplied diff → 弹出确认对话框，显示 N
- 确认保存 → N 个 diff 全部 accept → DiskState 写入 → EditorTab 转 editing（非 dirty）
- 取消 → dirty 保持，diff 状态不变
- CLOSE_TAB 时 Tab 有 preapplied diff → 三选一对话框出现
- 三选一：接受并关闭 → GreenAdditionDecoration 消失，Tab 关闭
- 三选一：拒绝并关闭 → LogicalState 回滚，Tab 关闭
- 三选一：取消 → Tab 保持，preapplied 状态不变
- DiffCard pending/preapplied 状态展示操作按钮；terminal 状态 opacity 0.6 无操作按钮
- `tsc --noEmit` 通过

---

## 九、阶段性验证方案

### 验证门禁顺序

```
Issue 6-A ────── 数据结构 + diffMachine + DiffStore
（PendingDiff 扩展）       ↓
Issue 6-B ────── AG-TOOL-CALL 执行循环 + edit_current_editor_document
（工具执行框架）            ↓
Issue 6-C ────── GreenAdditionDecoration + syncPendingDiffsWithDocument
（绿增渲染 + 失效检测）      ↓
Issue 6-D ────── Accept / Reject / Expire 完整链路（依赖 6-C 的 Decoration 接口）
                           ↓
Issue 6-E ────── workspace.db 持久化 + Inherit Flow
                           ↓
Issue 6-F ────── 复合场景（Cmd+S / Tab 关闭 / DiffCard UI）
                           ↓
Phase 6 综合验证（governance:generate + governance:audit + vitest + cargo test + tsc）
```

| Issue | 门禁条件（前序完成标准）|
|-------|----------------------|
| 6-B 开始前 | diff.ts 类型编译通过；diffMachine.test.ts 覆盖 8 状态；DiffStore hook 可 import |
| 6-C 开始前 | edit_current_editor_document 工具调用 → LogicalState 精确替换通过；appliedRange 有效 |
| 6-D 开始前 | GreenAdditionDecoration 渲染 + syncPendingDiffsWithDocument 失效检测 vitest 通过 |
| 6-E 开始前 | acceptDiff / rejectDiff / expireDiff 全路径 vitest 通过（含 revision 不匹配的 error 终态）|
| 6-F 开始前 | cargo test ≥ 16 pass（含 save_terminal_card Rust 单测）；Inherit Flow 集成通过 |

### 新增治理测试（governance.phase6-de.test.ts）

最少 15 个用例：

```typescript
// covers: BR-DE-DATA-001
it("diffMachine: DIFF_CREATED without sourceToolId → guard throws validation error")

// covers: BR-DE-STATE-001（含 BR-SYS-GOV-001）
it("diffMachine: pending → preapplied → accepted (open-file path)")

// covers: BR-DE-STATE-005
it("diffMachine: effectivePath=closed-file → stays pending, no LOGICAL_STATE_APPLIED")

// covers: BR-AG-DATA-003
it("applyDiffReplaceInEditor: originalText not found → LOGICAL_STATE_APPLIED_FAILED → error")

// covers: BR-DE-STATE-010, BR-DE-STATE-011
it("acceptDiff open-file: GreenAddition removed; no DiskState write; file stays dirty")

// covers: BR-DE-STATE-004
it("acceptDiff closed-file: baseRevision mismatch → expired, no DiskState write")

// covers: BR-DE-STATE-002 (open-file reject, revision match)
it("rejectDiff open-file: revision matches → ROLLBACK_LOGICAL_STATE sent → LogicalState reverts")

// covers: BR-DE-STATE-002 (open-file reject, revision mismatch)
it("rejectDiff open-file: revision mismatch → error terminal, no ROLLBACK_LOGICAL_STATE")

// covers: BR-DE-STATE-012
it("syncPendingDiffsWithDocument: edit hits appliedRange → EXPIRE_REQUESTED → expired")

// covers: BR-DE-STATE-012 (diff-on-diff)
it("syncPendingDiffsWithDocument: new diff overlaps same range → old diff auto-expired")

// covers: BR-DE-STATE-013
it("expireAllOnClose: all non-terminal diffs → expired on WORKSPACE_CLOSED")

// covers: BR-ED-STATE-006
it("GreenAdditionDecoration: only renders after valid LOGICAL_STATE_APPLIED appliedRange")

// covers: BR-DE-PERSIST-002
it("loadDiffsFromWorkspace: baseRevision consistent → restored as pending")
it("loadDiffsFromWorkspace: baseRevision mismatch → auto-expired on load")

// covers: BR-DE-STATE-014
it("CLOSE_TAB guard: preapplied diff present → dialog required, tab not closed without decision")

// covers: BR-AG-DATA-002
it("chatActor.ts and lib.rs contain @GOV with BR-AG-DATA-002 and BR-AG-DATA-003")
it("DiffCard.tsx contains @GOV with BR-DE-UI-001 and BR-DE-UI-002")
```

### 综合验证命令

```bash
npm run governance:generate
npm run governance:audit
npx vitest run
npx tsc --noEmit
cargo test
```

---

## 十、Phase 6 整体通过标准

| 检查项 | 规则 | 通过标准 |
|--------|------|---------|
| PendingDiff 携带 sourceToolId、baseRevision、effectivePath、createdAt | BR-DE-DATA-001 | [待验收] |
| diffMachine 8 状态完整流转（pending/preapplied/accepting/rejecting/accepted/rejected/expired/error）| BR-SYS-GOV-001 | [待验收] |
| effectivePath=closed-file 时不进入 preapplied | BR-DE-STATE-005 | [待验收] |
| originalText 找不到 → error terminal，不 fallback 全量替换 | BR-AG-DATA-003 | [待验收] |
| acceptDiff open-file：无 DiskState 写操作，file 保持 dirty | BR-DE-STATE-011 | [待验收] |
| acceptDiff closed-file：baseRevision 不一致时 → expired，不写磁盘 | BR-DE-STATE-004 | [待验收] |
| DiskState 唯一写入路径：open-file → Cmd+S；closed-file accept → 一致校验后写 | BR-DE-STATE-010 | [待验收] |
| rejectDiff open-file：revision 匹配时 LogicalState 回滚；不匹配时 error 终态 | BR-DE-STATE-002 | [待验收] |
| syncPendingDiffsWithDocument：编中 diff 区域 → EXPIRE_REQUESTED；非 diff 区域不误触发 | BR-DE-STATE-012 | [待验收] |
| ToolResult 以 role="tool" 回流，携带 callId；不注入为 user message | BR-AG-DATA-002 | [待验收] |
| expireAllOnClose on WORKSPACE_CLOSED → 所有非终态 diff 写 terminal_diff_cards | BR-DE-STATE-013 | [待验收] |
| Cmd+S 含 preapplied diff → 确认对话框 → 批量 accept → 写 DiskState | BR-DE-PERSIST-001 | [待验收] |
| CLOSE_TAB 含 preapplied → 三选一对话框，不可跳过 | BR-DE-STATE-014 | [待验收] |
| GreenAdditionDecoration 只渲染 newText 范围；红删仅在 DiffCard 内 | BR-DE-UI-002 | [待验收] |
| DiffCard terminal 状态 opacity 0.6，无操作按钮 | BR-DE-UI-001 | [待验收] |
| DisplayState = LogicalState + overlay；不绕过此规则注入内容 | BR-ED-STATE-005 | [待验收] |
| GreenAdditionDecoration 只消费已验证 appliedRange | BR-ED-STATE-006 | [待验收] |
| PendingDiff 持久化；重启 baseRevision 一致恢复；不一致自动 expired | BR-DE-PERSIST-002 | [待验收] |
| Inherit Flow：closed-file pending + 文件打开 + hash 一致 → preapplied + 绿增 | BR-DE-PERSIST-002 | [待验收] |
| `tsc --noEmit` 零错误 | — | [待验收] |
| `cargo build` 通过（新增 Rust 命令）| — | [待验收] |
| `cargo test` ≥ 16 pass（含 save_terminal_card 单测）| — | [待验收] |
| `npm run governance:generate` @GOV 块数 ≥ 65 | — | [待验收] |
| `npm run governance:audit` OWNER_MISSING = 0 | — | [待验收] |
| `npx vitest run` ≥ 80 pass（+ governance.phase6-de.test.ts ≥ 15 用例）| — | [待验收] |

---

## 十一、Phase 5 基线与 Phase 6 预期目标

| 指标 | Phase 5 实测基线 | Phase 6 目标 |
|------|----------------|------------|
| `@GOV` 块数 | 61 | ≥ 65（新增 diffStore.ts + GreenAdditionDecoration.ts + Rust save_terminal_card + 各文件更新）|
| `OWNER_MISSING` | 6（BR-DE-STATE-010/011/012、BR-AG-DATA-002/003、BR-DE-DATA-001）| **0**（Phase 6 全覆盖）|
| `cargo test` | 16 pass | ≥ 16 pass（+save_terminal_card 单测）|
| `vitest run` | 65 pass | ≥ 80 pass（+ governance.phase6-de.test.ts ≥ 15 用例）|
| `tsc --noEmit` | clean | clean |

---

## 十二、与 Phase 7 的边界

Phase 6 交付物不包含：

| 排除项 | 所属 Phase |
|--------|-----------|
| update_file 工具（closed-file 链路的工具入口）| Phase 11 |
| workspaceMachine 完整关闭门禁（dirty tab + preapplied 联合检测对话框）| Phase 7 跨模块接线 |
| read_file、search_files、list_files 等只读工具接线 | Phase 7（AG-TOOL-CALL 其余工具）|
| InputReference 拖拽文件树入口 | Phase 5-F（延后）|
| PromptRuntime L0 document_structure XML 组装（需 BlockId 端到端）| Phase 7 |
| workspaceMachine × chatMachine × editorMachine 完整联调 | Phase 7 |

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-25 | v1.0 | 初始版本。基于 P-27 大纲 §七、DE-M-T-01 v1.7、DE-M-P-01 v1.4、DE-M-P-02 v1.6 生成 Phase 6 全量 Issue Trace，含规则映射链图、名词声明、6 个 Issue、阶段验证方案和整体通过标准。Phase 5 基线：61 @GOV 块、6 OWNER_MISSING。|
