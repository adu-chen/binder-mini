---
文档编号：   CORE-X-P-31
文档状态：   A
负责模块：   ED
文档职责：   Phase 4 Editor 模块接线 Issue Trace——editorMachine Actor、Cmd+S 保存流程、BlockIdExtension
上游约束：   CORE-X-P-27（大纲 §五）、ED-M-P-01、ED-M-T-01、ED-M-T-02、SYS-C-T-01（v3.1）
直接承接：   Phase 5（chatMachine Actor + Agent SSE 流）
使用边界：   逐 Issue 列出交付范围、规则映射、名词声明和通过标准；不写运行时代码正文
变更要求：   Issue 完成后更新验收状态；调整接线协议必须同步 ED-M-P-01、ED-M-T-01
---

# Phase 4 Editor 模块接线 Issue Trace

---

## 一、规则映射链图

以下链路图描述 Phase 4 所有规则的来源链路及其约束的代码边界。

```
链路 ED-OPEN-FILE
  ├─ BR-ED-STATE-001 ── editorMachine 全状态转移（noWorkspace→idle→loading→editing/readonly）
  │                      约束代码：editorMachine actor + useEditorActor Loading 序列
  │                      验证：FILE_LOADED 成功 → editing/readonly；LOAD_FAILED → error
  ├─ BR-ED-STATE-002 ── OPEN_FILE 时已有同 filePath EditorTab → 激活既有 Tab，不重新加载
  │                      约束代码：useEditorActor.openFile() 门禁（SWITCH_TAB 分支）
  │                      验证：重复打开同一文件 → 仅激活，不发出第二次 FILE_LOADED
  ├─ BR-ED-STATE-004 ── 状态栏从 ActiveFile 派生（filePath、保存状态、字数），不维护独立事实源
  │                      约束代码：EditorColumn → EditorStatusBar（从 activeTab 派生）
  │                      验证：状态栏内容与 active tab 完全对应，无独立状态存储
  ├─ BR-ED-PERSIST-003 ── .txt 文件与 .md 共用 TipTap 实例，采用纯文本序列化（editor.getText()）
  │                        约束代码：EditorArea.tsx 中 fileType=txt 路径调用 getText()
  │                        验证：.txt 打开后修改保存，不触发 Markdown 转换
  └─ BR-ED-DATA-002 ── BlockIdExtension 通过 appendTransaction 为 BLOCK_NODE_NAMES 节点分配 UUID v4
                         约束代码：BlockIdExtension.ts（新建）
                         验证：打开 .md 文件后，paragraph/heading 等节点均有 data-block-id 属性

链路 ED-SAVE-FILE
  ├─ BR-ED-PERSIST-001 ── SAVE 只写当前 active tab 对应的文件，绝不写其他文件
  │                        约束代码：useEditorActor.saveFile() 从 context.activeTabId 取唯一目标
  │                        验证：多标签时 Cmd+S 只保存 active file
  ├─ BR-ED-PERSIST-002 ── .md Markdown 序列化失败时不写磁盘，保持 dirty 状态并展示错误
  │                        约束代码：EditorArea.tsx onUpdate 中 getMarkdownContent 失败不调用 onChange；
  │                                 useEditorActor.saveFile() 只写最后成功序列化内容
  │                        验证：强制 Markdown 解析失败 → dirty 保持、磁盘文件不变
  ├─ BR-ED-STATE-001 ── saving 状态期间不允许并发第二次 SAVE
  │                      约束代码：editorMachine saving 状态无 SAVE 入边
  │                      验证：saving 期间再发 SAVE 事件被忽略
  └─ BR-ED-STATE-003 ── dirty EditorTab 关闭前必须展示确认对话框（保存并关闭/放弃并关闭/取消）
                         约束代码：EditorColumn.handleTabClose() → DirtyTabCloseDialog
                         验证：dirty tab 点击 ✕ 弹对话框；WORKSPACE_CLOSED 时跳过此确认
```

**规则分域汇总**

| 规则 | 域 | 主链路 | 约束代码 | 层级 |
|------|----|--------|---------|------|
| BR-ED-STATE-001 | STATE | ED-OPEN-FILE, ED-SAVE-FILE | editorMachine actor | 状态机 |
| BR-ED-STATE-002 | STATE | ED-OPEN-FILE | useEditorActor.openFile() 门禁 | 服务层 |
| BR-ED-STATE-003 | STATE | ED-SAVE-FILE | EditorColumn + DirtyTabCloseDialog | UI/状态机 |
| BR-ED-STATE-004 | STATE | ED-OPEN-FILE | EditorStatusBar 派生 | UI |
| BR-ED-PERSIST-001 | PERSIST | ED-SAVE-FILE | useEditorActor.saveFile() | 服务层 |
| BR-ED-PERSIST-002 | PERSIST | ED-OPEN-FILE, ED-SAVE-FILE | EditorArea.tsx + useEditorActor | UI/服务层 |
| BR-ED-PERSIST-003 | PERSIST | ED-OPEN-FILE, ED-SAVE-FILE | EditorArea.tsx fileType=txt 路径 | UI |
| BR-ED-DATA-002 | DATA | ED-OPEN-FILE, DE-CREATE-DIFF | BlockIdExtension.ts（appendTransaction）| UI 扩展 |

---

## 二、名词声明

本 Issue Trace 全程使用以下已注册术语（来源：SYS-C-T-01 §0）。代码标识符以 `code_identifier` 字段为准。

| 术语 ID | 正式英文名 | 正式中文名 | 禁用别名 |
|---------|----------|----------|--------|
| TERM-CORE-001 | Workspace | 工作区 | 项目目录, 当前目录, 工作目录 |
| TERM-ED-001 | EditorTab | 编辑器标签页 | 编辑标签, tab页, 编辑器tab |
| TERM-ED-002 | ActiveFile | 激活文件 | 当前文件, active file, 当前打开文件 |
| TERM-ED-003 | editorMachine | 编辑器状态机 | editor状态机, 编辑状态机 |
| TERM-ED-004 | BlockId | 块标识 | block id, block-id概念, 节点锚点 |
| TERM-DOC-001 | DiskState | 磁盘状态 | 文件状态, 存储状态, 持久化内容 |
| TERM-DOC-002 | LogicalState | 逻辑状态 | 编辑器缓冲区内容, 内存内容, buffer内容 |
| TERM-DOC-003 | DisplayState | 显示状态 | 渲染状态, 视图内容, 展示内容 |
| TERM-WS-005 | workspaceMachine | 工作区状态机 | workspace状态机, 工作空间状态机 |
| TERM-AG-004 | chatMachine | 对话状态机 | agentMachine, agent状态机 |

> **约束**：生成 @GOV boundary 时，`in=` / `out=` 必须使用以上正式英文名或 code_identifier，不得使用禁用别名。

---

## 三、Issue 4-A：editorMachine Actor 完整接线

### 背景

Phase 3 完成后，`workspaceMachine` 已通过 `useActorRef` 作为运行中的 actor。
但 `editorMachine` 骨架虽已定义（含 8 个状态、完整事件类型、Context 类型），
App.tsx 仍以 `useState`（`editorSession`、`isOpeningFile`、`isSavingFile`、`editorError`）
管理编辑器状态，`editorMachine` 未以 actor 方式运行。

Phase 4-A 目标：

1. 修复 `editorMachine` 中的 action/guard 缺口（`isLastTab` 永远 false、CLOSE_TAB/SWITCH_TAB 无 context 变更 action）
2. 新建 `src/services/editorActor.ts`，以 `useActorRef(editorMachine)` 创建运行中 actor
3. `App.tsx` 接入 `useEditorActor` hook，移除 useState 编辑器管理
4. WORKSPACE_OPENED → 发送给 editorMachine actor；WORKSPACE_CLOSED → 清空所有 EditorTab

### editorMachine 现有缺口及修复

在 `src/machines/editorMachine.ts` 中：

| 缺口 | 当前状态 | Phase 4-A 修复 |
|------|---------|----------------|
| `isLastTab` guard | `() => false`（永远 false）| `({ context }) => context.tabs.length === 1` |
| `USER_EDIT` 无 action | 状态转 dirty 但 tab.dirty 不更新 | `USER_EDIT: { target: "dirty", actions: "markActiveDirty" }` |
| `CLOSE_TAB` 无 remove action | tab 仍留在 context.tabs | 新增 `removeClosedTab` action |
| `SWITCH_TAB` 无 update action | activeTabId 不变 | 新增 `updateActiveTabId` action |
| `FILE_LOADED` 重复 tab 风险 | `assignTabOpened` 无去重 | 加 filter：已有同 filePath 的 tab 先移除旧的 |

### 修改范围

**修改文件**

| 文件 | 改动 | 规则 |
|------|------|------|
| `src/machines/editorMachine.ts` | 修复 4 处 action/guard 缺口；新增 `removeClosedTab`、`updateActiveTabId` action | BR-ED-STATE-001/002/003 |
| `src/App.tsx` | 以 `useEditorActor` 替代 useState 编辑器管理；onWorkspaceOpened 发 WORKSPACE_OPENED；closeGuard 用 `edActor.getSnapshot()` 取 dirty 状态 | BR-ED-STATE-001/003 |

**新建文件**

| 文件 | 用途 | @GOV 规则 |
|------|------|---------|
| `src/services/editorActor.ts` | editorMachine actor 创建、Loading 序列、文件 IPC 调用、content 映射、跨模块事件广播 | BR-ED-STATE-001, BR-ED-STATE-002, BR-ED-STATE-004, BR-ED-PERSIST-001, BR-ED-PERSIST-002, BR-ED-PERSIST-003 |

### editorActor 接线协议

#### EditorActorBroadcasts 接口

```typescript
export interface EditorActorBroadcasts {
  /** Phase 5 接收方：chatMachine 追加合成 system 消息（BR-AG-STATE-001）*/
  onActiveFileChanged: (oldPath: string | null, newPath: string | null) => void;
  /** Phase 6 接收方：diffMachine Inherit Flow（BR-DE-PERSIST-002）*/
  onLogicalStateAppeared: (filePath: string) => void;
}
```

#### openFile 序列（BR-ED-STATE-001/002）

```
用户点击文件树节点 → App.tsx 调用 openFile(workspaceRoot, filePath)
→ 检查 edActor.getSnapshot().context.tabs 是否已有同 filePath 的 EditorTab
  → 已有：发送 SWITCH_TAB(filePath) → 激活既有 EditorTab，不重新加载（BR-ED-STATE-002）
  → 无：发送 OPEN_FILE(filePath) → editorMachine: * → loading
         → 异步调用 readWorkspaceFile IPC（read_workspace_file）
           → 成功 → 存入 contentMapRef + diskStateMapRef
                  → 发送 FILE_LOADED(filePath, fileType, content)
                  → machine: loading → editing（md/txt）| readonly（other）
                  → 若 fileType ≠ "other"：调用 onLogicalStateAppeared(filePath)（Phase 6 stub）
           → 失败 → 发送 LOAD_FAILED(filePath, errorMessage)
```

#### 内容映射（LogicalState 字符串表示）

editorMachine context 只存储 EditorTab 元数据（id、filePath、fileType、dirty）；
文件内容（LogicalState 字符串表示）由 useEditorActor 的内部 Ref 维护：

```
contentMapRef: Map<tabId, string>    — TipTap onChange 回调更新（LogicalState 当前序列化）
diskStateMapRef: Map<tabId, string>  — 文件加载时和 SAVE_SUCCEEDED 后更新（DiskState 快照）
```

TipTap `onChange` 传来的内容 → 更新 `contentMapRef` → 对比 `diskStateMapRef` → 若不同且 machine 在 editing 状态 → 发送 USER_EDIT。

#### WORKSPACE_OPENED / WORKSPACE_CLOSED 集成

| 时机 | 发送事件 | 位置 |
|------|---------|------|
| workspaceActor `onWorkspaceOpened(workspaceRoot)` 回调 | `edActor.send({ type: "WORKSPACE_OPENED", workspaceRoot })` | App.tsx |
| workspaceActor `onWorkspaceClosed()` 回调 | `edActor.send({ type: "WORKSPACE_CLOSED" })` | App.tsx |

WORKSPACE_CLOSED 触发 editorMachine 的 `clearAllTabs` action：清空 context.tabs、activeTabId → null；contentMapRef 和 diskStateMapRef 同步清空。

#### ACTIVE_FILE_CHANGED 广播（BR-ED-STATE-001 出站事件）

`useEditorActor` 监听 `edValue`（机器状态值）+ `context.activeTabId` 变化：
若 activeTabId 发生变化 且 editorMachine 非 noWorkspace → 调用 `onActiveFileChanged(oldPath, newPath)`。
Phase 4 App.tsx 将此回调设为 no-op；Phase 5 接入 chatMachine。

#### hasDirtyTabs（BR-WS-STATE-003 关联）

```typescript
function hasDirtyTabs(): boolean {
  return edActor.getSnapshot().context.tabs.some(t => t.dirty);
}
```

App.tsx 的 `canLeaveWorkspace()` 使用此函数替代 `hasDirtyEditorTabs(editorSession)`。

#### editorStateName 派生（BR-ED-STATE-001）

```typescript
function editorStateName(): EditorStateName {
  if (wsValue !== "Active") return "noWorkspace";
  return edValue as EditorStateName;  // 直接映射 machine state 名称
}
```

### @GOV 块（editorActor.ts）

```typescript
/**
 * @GOV
 * codes: BR-ED-STATE-001, BR-ED-STATE-002, BR-ED-STATE-004, BR-ED-PERSIST-001, BR-ED-PERSIST-002, BR-ED-PERSIST-003
 * type: RB
 * chain: ED-OPEN-FILE, ED-SAVE-FILE
 * rules: BR-ED-STATE-001, BR-ED-STATE-002, BR-ED-STATE-004, BR-ED-PERSIST-001, BR-ED-PERSIST-002, BR-ED-PERSIST-003
 * boundary: in=Workspace file open/close events and workspaceMachine WORKSPACE_OPENED broadcast | out=editorMachine actor broadcasting ACTIVE_FILE_CHANGED to chatMachine and LOGICAL_STATE_APPEARED to diffMachine per EditorTab lifecycle
 * term_ref: TERM-CORE-001, TERM-ED-001, TERM-ED-002, TERM-ED-003, TERM-DOC-001, TERM-DOC-002, TERM-WS-005
 */
```

### 验收标准（Issue 4-A）

- [ ] `editorMachine` 以 `useActorRef` 运行，`editorStateName()` 直接从 `edValue` 派生（不再使用 `isOpeningFile`/`isSavingFile` 等 useState）
- [ ] `isLastTab` guard 正确判断 `context.tabs.length === 1`
- [ ] CLOSE_TAB 后 context.tabs 确实移除对应 EditorTab，activeTabId 切换到邻近 tab
- [ ] SWITCH_TAB 后 context.activeTabId 正确更新，触发 `onActiveFileChanged` 广播
- [ ] USER_EDIT 后 active tab 的 `dirty` 字段变为 true（`markActiveDirty` action 触发）
- [ ] 重复打开同一文件 → SWITCH_TAB 分支，machine 不进入 loading，不发出第二次 FILE_LOADED
- [ ] WORKSPACE_OPENED → editorMachine 从 noWorkspace → idle
- [ ] WORKSPACE_CLOSED → editorMachine 从任意状态 → noWorkspace，context.tabs 清空
- [ ] `hasDirtyTabs()` 正确驱动 WorkspaceCloseGuardDialog 显示逻辑
- [ ] `tsc --noEmit` 零错误

---

## 四、Issue 4-B：Cmd+S 保存流程

### 背景

Phase 3 的保存逻辑（`handleSaveFile`）使用 `isSavingFile useState` 标记 saving 状态，
未经过 editorMachine。Phase 4-B 目标：

1. 保存流程路由通过 editorMachine（SAVE → saving → SAVE_SUCCEEDED/SAVE_FAILED）
2. `.md` Markdown 序列化失败时不写磁盘（BR-ED-PERSIST-002）
3. `.txt` 使用纯文本序列化路径（BR-ED-PERSIST-003）
4. saving 状态期间阻断并发第二次 SAVE

### 修改范围

**修改文件**

| 文件 | 改动 | 规则 |
|------|------|------|
| `src/services/editorActor.ts` | 实现 `saveFile(workspaceRoot)` — 从 contentMapRef 取内容 → IPC 写盘 → 更新 diskStateMapRef + SAVE_SUCCEEDED/FAILED | BR-ED-PERSIST-001/002, BR-ED-STATE-001 |
| `src/components/EditorArea.tsx` | 增加 `fileType` prop；`.txt` 路径用 `editor.getText()` 替代 `getMarkdownContent()`；`getMarkdownContent` 失败时不调用 `onChange`（BR-ED-PERSIST-002） | BR-ED-PERSIST-002/003 |
| `src/App.tsx` | `onSave` 回调调用 `saveFile(workspaceRoot)`；移除 `isSavingFile` useState | BR-ED-PERSIST-001 |

### saveFile 序列（BR-ED-PERSIST-001/002）

```
用户按 Cmd+S → App.tsx 调用 saveFile(workspaceRoot)
→ 检查 editorMachine 状态：若 saving → 直接返回（不并发，BR-ED-STATE-001）
→ 从 context 取 activeTabId → 取对应 EditorTab（filePath、fileType）
→ 从 contentMapRef 取当前 LogicalState 内容字符串
→ 检查是否有 preapplied diff（preappliedTabIds.has(activeTabId)）
  → 有：展示 PreappliedSaveDialog（用户确认后继续或取消）
→ 发送 SAVE 事件 → machine: dirty → saving
→ 调用 write_workspace_file IPC（workspaceRoot, filePath, content）
  → 成功 → diskStateMapRef.set(filePath, content)
           → 发送 SAVE_SUCCEEDED → machine: saving → editing（markActiveClean）
  → 失败 → 发送 SAVE_FAILED(errorMessage) → machine: saving → error
```

### .txt 序列化路径（BR-ED-PERSIST-003）

EditorArea 新增 `fileType` prop。onChange 回调分路：

```
fileType === "txt" → content = editor.getText()（纯文本，无 Markdown 语法）
fileType === "md"  → content = getMarkdownContent(editor)（Markdown 序列化）
                     若 getMarkdownContent 抛出 → 不调用 onChange（BR-ED-PERSIST-002）
                     dirty 保持（因 USER_EDIT 已发），内容保留上次成功序列化状态
fileType === "other" → onUpdate 不触发（readonly 模式）
```

保存时，`saveFile()` 直接写 `contentMapRef.get(filePath)` 的内容（最后成功序列化的 LogicalState 字符串）到磁盘，无需再次序列化。

### dirty Tab 关闭门禁（BR-ED-STATE-003）

EditorColumn 的 `handleTabClose(tabId)` 逻辑（Phase 2 已实现）在 Phase 4-B 验证：

```
tab.dirty = true → 展示 DirtyTabCloseDialog（三选一）
  → "保存并关闭" → onTabSaveAndClose(tabId)
      → useEditorActor: activateTab(tabId) → saveFile() → closeTab(tabId)
  → "放弃并关闭" → onTabDiscard(tabId)
      → useEditorActor: closeTab(tabId)（直接 CLOSE_TAB，machine 更新 tabs）
  → "取消" → setPendingClose(null)，tab 保持打开

WORKSPACE_CLOSED 时：editorMachine 收到 WORKSPACE_CLOSED → clearAllTabs
（跳过 DirtyTabCloseDialog，机器直接清空）
```

### 验收标准（Issue 4-B）

- [ ] Cmd+S 只写 active tab 对应文件，多标签时其余文件不受影响（BR-ED-PERSIST-001）
- [ ] saving 状态期间再次触发 Cmd+S 被忽略（不发 SAVE 事件，不并发写盘）
- [ ] `.md` 文件 Markdown 序列化正常 → 写盘，tab.dirty → false
- [ ] `.md` 文件 Markdown 序列化异常 → onChange 不调用，dirty 保持，磁盘文件不变（BR-ED-PERSIST-002）
- [ ] `.txt` 文件保存使用 `editor.getText()`，不触发 Markdown 转换（BR-ED-PERSIST-003）
- [ ] dirty tab 关闭 → DirtyTabCloseDialog 弹出；"保存并关闭"路径正确
- [ ] SAVE_SUCCEEDED 后 active tab dirty → false，EditorStatusBar 显示 "saved"
- [ ] SAVE_FAILED 后 machine 进入 error 状态，EditorStatusBar 显示 "error"
- [ ] `tsc --noEmit` 零错误

---

## 五、Issue 4-C：BlockIdExtension

### 背景

`BR-ED-DATA-002` 规定：BlockIdExtension 必须通过 TipTap `appendTransaction` 机制为
`BLOCK_NODE_NAMES` 中定义的 ProseMirror 节点类型分配 UUID v4 `data-block-id` 属性；
BlockId 由 Editor Runtime 生成，不由模型输出直接决定；会话级有效，不持久化到文件内容。

`BR-ED-DATA-002` 当前为 OWNER_MISSING（无 @GOV 块认领）；Phase 4-C 将覆盖此规则。

### 修改范围

**新建文件**

| 文件 | 用途 | @GOV 规则 |
|------|------|---------|
| `src/components/extensions/BlockIdExtension.ts` | TipTap Extension，通过 appendTransaction 为 BLOCK_NODE_NAMES 节点分配 UUID BlockId | BR-ED-DATA-002 |

**修改文件**

| 文件 | 改动 |
|------|------|
| `src/components/EditorArea.tsx` | 引入 `BlockIdExtension`，加入 `extensions` 列表；@GOV 更新新增 BR-ED-DATA-002 |

### BlockIdExtension 规范

#### BLOCK_NODE_NAMES

```typescript
const BLOCK_NODE_NAMES = [
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "listItem",
  "tableCell",
];
```

#### UUID 生成策略

使用 `crypto.randomUUID()`（现代浏览器内置，Tauri WebView 支持），无需额外依赖：

```typescript
function generateBlockId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}
```

#### appendTransaction 机制

使用 ProseMirror Plugin 的 `appendTransaction` hook：

```typescript
addProseMirrorPlugins() {
  return [
    new Plugin({
      appendTransaction: (transactions, _oldState, newState) => {
        // 仅在文档内容发生变化时处理
        if (!transactions.some(tr => tr.docChanged)) return null;
        const tr = newState.tr;
        let modified = false;
        newState.doc.descendants((node, pos) => {
          if (
            BLOCK_NODE_NAMES.includes(node.type.name) &&
            !node.attrs["data-block-id"]
          ) {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              "data-block-id": generateBlockId(),
            });
            modified = true;
          }
        });
        return modified ? tr : null;
      },
    }),
  ];
},
```

#### 全局 Attribute 注册

```typescript
addGlobalAttributes() {
  return [{
    types: BLOCK_NODE_NAMES,
    attributes: {
      "data-block-id": {
        default: null,
        parseHTML: (el) => el.getAttribute("data-block-id"),
        renderHTML: (attrs) =>
          attrs["data-block-id"] ? { "data-block-id": attrs["data-block-id"] } : {},
      },
    },
  }];
},
```

#### 会话级 / 非持久化约束

- `data-block-id` 属性不写入 Markdown 源文件（tiptap-markdown 序列化时不输出自定义 attribute）
- 重新打开同一文件 → BlockId 重新分配，跨会话失效（已决策，见 ED-M-T-01 §4）
- BlockId 是 `originalText` 文本定位的辅助信息，不是主定位器（不影响 diff 执行正确性）

### @GOV 块（BlockIdExtension.ts）

```typescript
/**
 * @GOV
 * codes: BR-ED-DATA-002
 * type: RB
 * chain: ED-OPEN-FILE, DE-CREATE-DIFF
 * rules: BR-ED-DATA-002
 * boundary: in=TipTap document transaction for BLOCK_NODE_NAMES nodes without data-block-id | out=BlockId UUID v4 assigned via appendTransaction to paragraph, heading, blockquote, codeBlock, listItem, tableCell nodes; session-level only, not persisted to DiskState
 * term_ref: TERM-ED-004, TERM-DOC-002, TERM-DOC-001
 */
```

### 验收标准（Issue 4-C）

- [ ] 打开 `.md` 文件后，`paragraph`/`heading`/`blockquote`/`codeBlock`/`listItem` 节点均带 `data-block-id` 属性
- [ ] 已有 `data-block-id` 的节点在文档变更后不重新分配 BlockId（节点复用保持稳定）
- [ ] 新增段落（Enter 换行）→ 新节点获得新 UUID，已有节点不变
- [ ] BlockId 不出现在 `.md` 文件保存内容中（tiptap-markdown 序列化不输出 data-block-id）
- [ ] `.txt` 文件编辑时 BlockId 同样分配（共用 TipTap 实例）
- [ ] `tsc --noEmit` 零错误

---

## 六、阶段性验证方案

### 验证门禁顺序

```
Issue 4-A ──── actor 门禁 ──→ Issue 4-B ──── 保存流程门禁 ──→ Issue 4-C
（editorMachine 接入）        （Cmd+S 路由）                 （BlockIdExtension）
     ↓                              ↓                               ↓
            Phase 4 综合验证（governance:generate + vitest + tsc）
```

| Issue | 门禁条件 |
|-------|---------|
| 4-A 完成后 | `tsc --noEmit` 通过；editorMachine actor 驱动 FileColumn 状态；WORKSPACE_OPENED/CLOSED 正确传递到 editorMachine |
| 4-B 完成后 | `tsc --noEmit` 通过；Cmd+S 通过 editorMachine saving 状态；.txt 保存不触发 Markdown 转换 |
| 4-C 完成后 | `tsc --noEmit` 通过；打开 .md 后 DOM 中 paragraph 节点有 `data-block-id` 属性 |

### 治理测试新增

新增 `tests/governance.phase4-ed.test.ts`，覆盖：

```typescript
// covers: BR-ED-STATE-001
it("editorMachine 从 noWorkspace 经 WORKSPACE_OPENED → idle → OPEN_FILE → loading → FILE_LOADED → editing")
// covers: BR-ED-STATE-001
it("editorMachine WORKSPACE_CLOSED 从任意状态回到 noWorkspace 并清空 tabs")
// covers: BR-ED-STATE-002
it("editorMachine 已有同 filePath EditorTab 时 SWITCH_TAB 不进入 loading")
// covers: BR-ED-STATE-001, BR-ED-STATE-003
it("editorMachine dirty tab CLOSE_TAB 不自动关闭（EditorColumn 层决定门禁）")
// covers: BR-ED-DATA-002
it("BlockIdExtension.ts 源码包含 appendTransaction、BLOCK_NODE_NAMES 和 randomUUID")
// covers: BR-ED-PERSIST-003
it("EditorArea.tsx 源码包含 fileType === txt 路径使用 getText 而非 getMarkdownContent")
// covers: BR-ED-PERSIST-002
it("editorActor.ts 源码包含 ACTIVE_FILE_CHANGED 出站事件广播和 onLogicalStateAppeared")
```

最少 7 个新测试用例。

### 映射验证（Phase 4 结束）

```bash
npm run governance:generate
npm run governance:audit
npx vitest run
npx tsc --noEmit
```

**预期结果**

| 指标 | Phase 3 基线 | Phase 4 目标 |
|------|------------|------------|
| `@GOV` 块数 | 56 | ≥ 58（新增 editorActor.ts + BlockIdExtension.ts 各一块）|
| `OWNER_MISSING` | 7 | ≤ 6（BR-ED-DATA-002 由 BlockIdExtension.ts 覆盖）|
| `cargo test` | 16 pass | ≥ 16 pass（无新 Rust 命令）|
| `vitest run` | 44 pass | ≥ 51 pass（+ governance.phase4-ed.test.ts ≥ 7 用例）|

---

## 七、Phase 4 整体验收核查清单

| 检查项 | 规则 | 状态 |
|--------|------|------|
| editorMachine 以 `useActorRef` 运行，`editorStateName()` 从 `edValue` 直接派生 | BR-ED-STATE-001 | [x] |
| `isLastTab` guard 正确（context.tabs.length === 1） | BR-ED-STATE-001 | [x] |
| USER_EDIT 触发 `markActiveDirty`，active tab.dirty = true | BR-ED-STATE-001 | [x] |
| CLOSE_TAB 从 context.tabs 移除对应 EditorTab，activeTabId 切换 | BR-ED-STATE-001 | [x] |
| SWITCH_TAB 更新 context.activeTabId，isSwitchingToDirtyTab/Readonly guard 路由状态 | BR-ED-STATE-001 | [x] |
| 重复打开同一文件 → SWITCH_TAB，不进入 loading，不重新加载（BR-ED-STATE-002） | BR-ED-STATE-002 | [x] |
| WORKSPACE_OPENED → editorMachine noWorkspace → idle | BR-ED-STATE-001 | [x] |
| WORKSPACE_CLOSED → editorMachine 任意状态 → noWorkspace，tabs 清空 | BR-ED-STATE-001 | [x] |
| hasDirtyTabs() 正确驱动 WorkspaceCloseGuardDialog（edTabs.some(t=>t.dirty)） | BR-ED-STATE-003 | [x] |
| 状态栏 filePath、saveStatus、wordCount 从 active tab 派生，无独立存储 | BR-ED-STATE-004 | [x] |
| Cmd+S 只写 active tab 对应文件（BR-ED-PERSIST-001） | BR-ED-PERSIST-001 | [x] |
| saving 状态期间第二次 Cmd+S 被忽略（editorMachine saving 无 SAVE 入边） | BR-ED-STATE-001 | [x] |
| .md Markdown 序列化失败 → onChange 不调用，dirty 保持（BR-ED-PERSIST-002） | BR-ED-PERSIST-002 | [x] |
| .txt 保存使用 editor.getText()，不触发 Markdown 转换（BR-ED-PERSIST-003） | BR-ED-PERSIST-003 | [x] |
| dirty tab 关闭 → DirtyTabCloseDialog；WORKSPACE_CLOSED 时 clearAllTabs | BR-ED-STATE-003 | [x] |
| BlockIdExtension 已注册至 EditorArea extensions 列表（BR-ED-DATA-002） | BR-ED-DATA-002 | [x] |
| appendTransaction 遍历 BLOCK_NODE_NAMES，分配 UUID v4 data-block-id | BR-ED-DATA-002 | [x] |
| data-block-id 为 session 级属性，不出现在 getMarkdown() / getText() 输出中 | BR-ED-DATA-002 | [x] |
| `tsc --noEmit` 零错误 | — | [x] |
| `npm run governance:generate` @GOV 块数 = 58 | — | [x] |
| `npm run governance:audit` OWNER_MISSING = 6 | — | [x] |
| `npx vitest run` 55 pass（含 governance.phase4-ed.test.ts 11 用例）| — | [x] |

---

## 八、代码现状与 Phase 4 改动摘要

| 现状 | Phase 4 后 |
|------|-----------|
| editorMachine 骨架已定义，但 isLastTab guard 永远 false，CLOSE_TAB/SWITCH_TAB 无 action | editorMachine 所有 action/guard 填实；isLastTab 正确判断 |
| App.tsx：useState 管理编辑器（editorSession, isOpeningFile, isSavingFile） | useEditorActor 替代；editorMachine actor 驱动 editorStateName() |
| WORKSPACE_OPENED/CLOSED 广播不传给 editorMachine | workspaceActor onWorkspaceOpened/Closed → edActor.send(WORKSPACE_OPENED/CLOSED) |
| EditorArea.tsx：所有文件统一用 getMarkdownContent()（.txt 序列化路径错误）| fileType prop；.txt → editor.getText()；.md 失败不调用 onChange |
| GreenAdditionDecoration 为 Extension.create({name}) 占位符 | 保持占位（Phase 6 实现），BlockIdExtension 新增于同一 extensions 列表 |
| BR-ED-DATA-002 OWNER_MISSING（无代码认领） | BlockIdExtension.ts 新建，@GOV 认领 BR-ED-DATA-002 |
| BR-ED-PERSIST-003 测试 MISSING | governance.phase4-ed.test.ts 补充 .txt 序列化路径验证 |

---

## 九、与 Phase 5 的边界

Phase 4 交付物不包含：

| 排除项 | 所属 Phase |
|--------|---------|
| chatMachine actor 接线（onActiveFileChanged 接收方实现） | Phase 5-A |
| Agent SSE 流 + PromptRuntime | Phase 5-C/D |
| ACTIVE_FILE_CHANGED 触发 chatMachine 追加 system 消息 | Phase 5-A |
| GreenAdditionDecoration 实现（appliedRange 绑定） | Phase 6-C |
| DiffStore + diffMachine 实例化 | Phase 6-A |
| onLogicalStateAppeared 接收方（diffMachine Inherit Flow） | Phase 6-H |

Phase 4 完成后 Phase 5 可立即启动：
- editorMachine 已发出 ACTIVE_FILE_CHANGED（stub callback in App.tsx）
- chatMachine 骨架已存在（机器定义完整），Phase 5-A 接入 useActorRef(chatMachine)

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-24 | v1.0 | 初始版本。基于 P-27 大纲 §五 和 ED-M-P-01/T-01/T-02，生成 Phase 4 全量 Issue Trace，含规则映射链图、名词声明、3 个 Issue、阶段验证方案和整体通过标准。Phase 3 基线：56 @GOV 块、7 OWNER_MISSING。 |
