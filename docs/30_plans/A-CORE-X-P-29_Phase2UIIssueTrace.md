---
文档编号：   CORE-X-P-29
文档状态：   A
负责模块：   SYS,WS,ED,AG,DE
文档职责：   Phase 2 UI 层 Issue Trace——三栏 Shell 骨架、CSS Token、各区组件骨架与 DiffCard
上游约束：   CORE-X-P-27（Phase 2）、SYS-C-UI-01、WS-M-P-02、ED-M-P-01、AG-M-P-04、DE-M-T-01
直接承接：   Phase 3（Workspace 模块接线）、Phase 4（Editor 模块接线）
使用边界：   逐 Issue 列出组件交付范围、规则映射、名词声明和通过标准；不写运行时代码正文
变更要求：   Issue 完成后更新验收状态；调整布局约束必须同步 SYS-C-UI-01
---

# Phase 2 UI 层 Issue Trace

---

## 一、规则映射链图

以下链路图描述 Phase 2 所有规则的来源链路及其约束的组件边界。

```
链路 WS-OPEN / WS-CLOSE
  ├─ BR-SYS-UI-001 ──── workspaceMachine 状态 → 三栏面板可用性
  │                      约束组件：MainLayout、FileTreePanel、EditorColumn、ChatPanel
  ├─ BR-SYS-UI-002 ──── 三栏布局 + ResizeHandle + localStorage 持久化
  │                      约束组件：MainLayout、ResizeHandle
  └─ BR-WS-STATE-003 ── Workspace 关闭前 dirty / PendingDiff 门禁
                         约束组件：WorkspaceCloseGuardDialog

链路 ED-OPEN-FILE / ED-SAVE-FILE
  ├─ BR-ED-STATE-003 ── dirty EditorTab 关闭时弹出保护对话框
  │                      约束组件：DirtyTabCloseDialog
  ├─ BR-ED-STATE-005 ── DisplayState 只读派生（preapplied 时编辑器锁定）
  │                      约束组件：EditorArea（preapplied 锁定态 UI）
  └─ BR-DE-PERSIST-001 ─ preapplied PendingDiff 存在时 Cmd+S 需先处理
                          约束组件：PreappliedSaveDialog

链路 ED-DIFF-RENDER
  ├─ BR-ED-STATE-006 ── GreenAdditionDecoration 消费 appliedRange 绿增高亮
  │                      约束组件：EditorArea（GreenAdditionDecoration 接口占位）
  └─ BR-DE-UI-002 ───── EditorArea 只渲染绿增；红删仅允许在 DiffCard 内容区
                         约束组件：EditorArea、DiffCard

链路 AG-SEND-MESSAGE
  ├─ BR-AG-UI-001 ───── chatMachine 状态驱动 ChatInput 发送 / 取消按钮可用性
  │                      约束组件：ChatInput
  └─ BR-AG-SEC-001 ──── API key 不出 Rust 后端；前端只获取 apiKeyConfigured 布尔值
                         约束组件：ProviderConfigPanel

链路 DE-CREATE-DIFF / DE-ACCEPT-DIFF / DE-REJECT-DIFF / DE-EXPIRE-DIFF
  ├─ BR-DE-UI-001 ───── diffMachine 状态驱动 DiffCard 视觉（非终态展示操作，终态降权）
  │                      约束组件：DiffCard
  └─ BR-DE-STATE-014 ── 含 preapplied PendingDiff 的 EditorTab 关闭前必须批量处理
                         约束组件：PreappliedTabCloseDialog
```

**规则分域汇总**

| 规则 | 域 | 主链路 | 约束组件 | 层级 |
|------|----|--------|---------|------|
| BR-SYS-UI-001 | UI | WS-OPEN, WS-CLOSE | MainLayout, FileTreePanel, EditorColumn, ChatPanel | 布局 |
| BR-SYS-UI-002 | UI | WS-OPEN | MainLayout, ResizeHandle | 布局 |
| BR-WS-STATE-003 | STATE | WS-CLOSE | WorkspaceCloseGuardDialog | 对话框 |
| BR-ED-STATE-003 | STATE | ED-OPEN-FILE | DirtyTabCloseDialog | 对话框 |
| BR-ED-STATE-005 | STATE | ED-OPEN-FILE, ED-DIFF-RENDER | EditorArea | 编辑器 |
| BR-ED-STATE-006 | STATE | ED-DIFF-RENDER | EditorArea（GreenAdditionDecoration） | 编辑器 |
| BR-AG-SEC-001 | DATA | AG-SEND-MESSAGE | ProviderConfigPanel | 聊天 |
| BR-AG-UI-001 | UI | AG-SEND-MESSAGE | ChatInput | 聊天 |
| BR-DE-PERSIST-001 | PERSIST | ED-SAVE-FILE | PreappliedSaveDialog | 对话框 |
| BR-DE-STATE-014 | STATE | DE-ACCEPT-DIFF, DE-REJECT-DIFF | PreappliedTabCloseDialog | 对话框 |
| BR-DE-UI-001 | UI | DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF | DiffCard | 聊天 |
| BR-DE-UI-002 | UI | ED-DIFF-RENDER, DE-CREATE-DIFF | EditorArea, DiffCard | 编辑器/聊天 |

---

## 二、名词声明

本 Issue Trace 全程使用以下已注册术语（来源：SYS-C-T-01 §0）。代码标识符以 `code_identifier` 字段为准。

| 术语 ID | 正式英文名 | 正式中文名 | 禁用别名（已注册） |
|---------|----------|----------|----------------|
| TERM-CORE-001 | Workspace | 工作区 | 项目目录, 当前目录, 工作目录 |
| TERM-WS-001 | FileNode | 文件节点 | 文件项, 文件记录, tree item |
| TERM-WS-005 | workspaceMachine | 工作区状态机 | workspace状态机, 工作空间状态机 |
| TERM-ED-001 | EditorTab | 编辑器标签页 | 编辑标签, tab页, 编辑器tab |
| TERM-ED-003 | editorMachine | 编辑器状态机 | editor状态机, 编辑状态机 |
| TERM-DOC-003 | DisplayState | 显示状态 | 渲染状态, 视图内容, 展示内容 |
| TERM-DE-001 | PendingDiff | 待审差异 | 修改候选, diff候选, 待处理修改 |
| TERM-DE-002 | TerminalDiffCard | 终态差异卡 | 结果卡, 结束卡, 历史卡 |
| TERM-DE-004 | GreenAddition | 绿增 | 绿审, 绿审态, DiffDecoration高亮 |
| TERM-DE-008 | appliedRange | 已应用范围 | 位置范围, diff位置, 高亮范围 |
| TERM-DE-009 | diffMachine | 差异状态机 | diff状态机, 差异机器, pendingDiff状态机 |
| TERM-DE-010 | effectivePath | 生效路径 | accept路径, 执行路径, 打开链路标记 |
| TERM-DE-011 | DiffCard | 差异卡 | diff卡片, diff消息, diff气泡 |
| TERM-AG-002 | InputReference | 输入引用 | 附件, 知识库引用, @引用 |
| TERM-AG-004 | chatMachine | 对话状态机 | agentMachine, agent状态机, 聊天机器 |
| TERM-AG-011 | ProviderConfig | Provider配置 | 模型配置, API配置, key配置 |

> **注意**：代码中生成 @GOV boundary 时，`in=` / `out=` 必须使用以上正式英文名或 code_identifier，不得使用禁用别名。

---

## 三、Issue 2-A：CSS Token 与全局样式

### 背景

当前 `src/index.css` 为浅色主题，无 CSS 自定义属性体系。Phase 2 要求建立中性暗色主题的完整 token 层，是所有后续组件的视觉基础。

### 修改范围

**文件**：`src/index.css`（全量重写）

**必须声明的 token（SYS-C-UI-01 §2.1/§2.2）**

```css
/* 基础色彩 token */
--bg-base: #1a1a1a;
--bg-panel: #1e1e1e;
--bg-elevated: #252525;
--bg-hover: #2a2a2a;
--border: #333333;
--text-primary: #e0e0e0;
--text-secondary: #888888;
--text-muted: #555555;
--accent: #4a90d9;
--danger: #e05252;
--success: #52a85e;
--warning: #d4a34a;

/* Diff 专用 token（SYS-C-UI-01 §2.2）*/
--diff-add-bg: rgba(82, 168, 94, 0.18);
--diff-del-bg: rgba(224, 82, 82, 0.18);
--diff-pending-border: #4a90d9;
--diff-accepted-bg: rgba(82, 168, 94, 0.08);
--diff-rejected-bg: rgba(224, 82, 82, 0.08);
--diff-expired-bg: rgba(136, 136, 136, 0.08);
--diff-error-bg: rgba(212, 163, 74, 0.08);
```

**字体与基础样式（SYS-C-UI-01 §2.3）**

- 字体：`system-ui, -apple-system, sans-serif`（UI）；`'Fira Code', 'Consolas', monospace`（编辑器代码块）
- 基础字号：`13px`；行高：`1.5`
- `body { margin: 0; background: var(--bg-base); color: var(--text-primary); }`
- `* { box-sizing: border-box; }`

**@GOV 块（写在文件头注释）**

```css
/*
 * @GOV
 * codes: BR-SYS-UI-001, BR-SYS-UI-002
 * type: DATA
 * chain: WS-OPEN, WS-CLOSE
 * rules: BR-SYS-UI-001, BR-SYS-UI-002
 * boundary: in=workspaceMachine state for panel availability | out=CSS token definitions consumed by MainLayout and all panel components
 */
```

### 验收标准（Issue 2-A）

- [ ] 全部 12 个基础 token + 7 个 Diff token 存在于 `:root`
- [ ] `body` 背景色为 `var(--bg-base)`，文字色为 `var(--text-primary)`
- [ ] `tsc --noEmit` 通过（CSS 不影响 TypeScript，但后续组件使用 token 不应出现拼写错误的 var()）
- [ ] 浏览器 DevTools 中 `:root` 可见全部 token（人工核查）

---

## 四、Issue 2-B：MainLayout + ResizeHandle

### 背景

`App.tsx` 当前使用 850 行的平铺 `useState` 结构，无三栏布局抽象。Phase 2 建立三栏 Shell 骨架，各栏为空占位组件，状态连线在 Phase 3-4 完成。

### 修改范围

**新建文件**

| 文件 | 用途 |
|------|------|
| `src/components/MainLayout.tsx` | 三栏 Shell，管理面板宽度 state 和 localStorage 持久化 |
| `src/components/ResizeHandle.tsx` | 可拖拽分割线，约束宽度范围 |

**`src/App.tsx` 修改**

- 将三栏渲染区域替换为 `<MainLayout />`，原有 850 行逻辑暂时保留在 App 内（Phase 2 仅做结构提取，不移动业务逻辑）

### MainLayout.tsx 规范

**Props**

```typescript
interface MainLayoutProps {
  leftPanel: React.ReactNode;
  centerPanel: React.ReactNode;
  rightPanel: React.ReactNode;
}
```

**宽度状态（BR-SYS-UI-002）**

```typescript
const [leftWidth, setLeftWidth] = useState<number>(
  () => Number(localStorage.getItem("binder-panel-left-width")) || 240
);
const [rightWidth, setRightWidth] = useState<number>(
  () => Number(localStorage.getItem("binder-panel-right-width")) || 320
);
```

宽度约束（SYS-C-UI-01 §1.2）：

| 面板 | 最小值 | 最大值 | 持久化 key |
|------|--------|--------|-----------|
| 左栏（FileTreePanel）| 180px | 480px | `binder-panel-left-width` |
| 右栏（ChatPanel）| 260px | 600px | `binder-panel-right-width` |
| 中栏（EditorColumn）| ≥ 360px（剩余空间）| — | — |

**CSS 布局结构**

```css
.main-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-base);
}
.main-layout__left { flex-shrink: 0; background: var(--bg-panel); }
.main-layout__center { flex: 1; min-width: 360px; overflow: hidden; }
.main-layout__right { flex-shrink: 0; background: var(--bg-panel); }
```

**@GOV 块**

```typescript
/**
 * @GOV
 * codes: BR-SYS-UI-001, BR-SYS-UI-002
 * type: RB
 * chain: WS-OPEN, WS-CLOSE
 * rules: BR-SYS-UI-001, BR-SYS-UI-002
 * boundary: in=workspaceMachine state driving panel availability | out=three-column shell layout with ResizeHandle and localStorage-persisted widths for FileTreePanel and ChatPanel
 * term_ref: TERM-WS-005
 */
```

### ResizeHandle.tsx 规范

**Props**

```typescript
interface ResizeHandleProps {
  onDrag: (delta: number) => void;
  orientation: "left" | "right";
}
```

- 鼠标按下 → `mousemove` 监听窗口 → 计算 `delta` 回调
- 拖拽时更新宽度，clamp 在 [min, max] 范围内（约束由 MainLayout 控制）
- 拖拽结束时写入 `localStorage`

**CSS**

```css
.resize-handle {
  width: 4px;
  cursor: col-resize;
  background: var(--border);
  flex-shrink: 0;
}
.resize-handle:hover, .resize-handle--dragging { background: var(--accent); }
```

**@GOV 块**

```typescript
/**
 * @GOV
 * codes: BR-SYS-UI-002
 * type: RB
 * chain: WS-OPEN
 * rules: BR-SYS-UI-002
 * boundary: in=drag delta from user pointer events | out=panel width update and localStorage persistence for binder-panel-left-width and binder-panel-right-width
 */
```

### 验收标准（Issue 2-B）

- [ ] 三栏 Shell 渲染，左栏 240px、右栏 320px（初始默认值）
- [ ] 拖拽 ResizeHandle 后宽度更新，刷新后宽度从 localStorage 恢复
- [ ] 左栏最小 180px、最大 480px；右栏最小 260px、最大 600px（边界拖不过去）
- [ ] `tsc --noEmit` 零错误

---

## 五、Issue 2-C：FileTreePanel 骨架

### 修改范围

**新建文件**

| 文件 | 用途 |
|------|------|
| `src/components/FileTreePanel.tsx` | 左栏容器，含 WorkspaceHeader、SearchPanel、FileTree |
| `src/components/WorkspaceHeader.tsx` | Workspace 目录名 + 关闭按钮 |
| `src/components/SearchPanel.tsx` | 搜索框 + 结果列表（占位）|
| `src/components/FileTree.tsx` | FileNode 递归列表（占位）|

### FileTreePanel 状态映射（BR-SYS-UI-001）

FileTreePanel 接受 `workspaceState` prop（`"NoWorkspace" | "Loading" | "Active" | "Closing" | "Error"`）以映射 workspaceMachine 状态：

| workspaceMachine 状态 | FileTreePanel 渲染 |
|----------------------|-------------------|
| `NoWorkspace` | "打开 Workspace" 按钮 + 最近 Workspace 列表（无文件树）|
| `Loading` | 文件树 skeleton（灰色占位块）+ 不可操作 |
| `Active` | 正常文件树（FileTree 组件）|
| `Closing` | pointer-events: none，提示"关闭中…" |
| `Error` | 错误信息 + "重试"按钮 |

**WorkspaceHeader**

```typescript
interface WorkspaceHeaderProps {
  displayName: string;         // Workspace 目录名（TERM-CORE-001）
  rootPath: string;            // 完整路径（hover tooltip）
  onCloseRequest: () => void;  // 触发 CLOSE_WORKSPACE 事件
}
```

**FileTree + FileTreeNode**

Phase 2 骨架：接受 `entries: WorkspaceEntry[]` prop，递归渲染文件名；点击回调占位（Phase 3 接线 editorMachine OPEN_FILE）。右键菜单、拖拽到 Chat 均为视觉占位（Phase 3 实现）。

**@GOV 块（FileTreePanel）**

```typescript
/**
 * @GOV
 * codes: BR-SYS-UI-001, BR-WS-STATE-003
 * type: RB
 * chain: WS-OPEN, WS-CLOSE
 * rules: BR-SYS-UI-001, BR-WS-STATE-003
 * boundary: in=workspaceMachine state and FileNode tree entries | out=FileTreePanel visibility and availability driven by workspaceMachine; WorkspaceCloseGuardDialog trigger on CLOSE_WORKSPACE
 * term_ref: TERM-CORE-001, TERM-WS-001, TERM-WS-005
 */
```

### 验收标准（Issue 2-C）

- [ ] `NoWorkspace` 状态下展示"打开 Workspace"按钮，不展示文件树
- [ ] `Loading` 状态下展示 skeleton，所有交互不可用
- [ ] `Active` 状态下展示 FileTree（可以传入空 entries 占位）
- [ ] `Error` 状态下展示错误文字和重试入口
- [ ] `tsc --noEmit` 零错误

---

## 六、Issue 2-D：EditorColumn 骨架

### 修改范围

**新建文件**

| 文件 | 用途 |
|------|------|
| `src/components/EditorColumn.tsx` | 中栏容器，含 EditorTabs、EditorArea、EditorStatusBar |
| `src/components/EditorTabs.tsx` | EditorTab 标签栏，dirty 指示，水平滚动 |
| `src/components/EditorArea.tsx` | TipTap 实例区，含 GreenAdditionDecoration 接口占位 |
| `src/components/EditorStatusBar.tsx` | 文件路径、保存状态、字数统计 |

### EditorColumn 状态映射（BR-ED-STATE-005）

接受 `editorState` prop（`"noWorkspace" | "idle" | "loading" | "editing" | "dirty" | "saving" | "readonly" | "error"`）：

| editorMachine 状态 | EditorArea 表现 |
|-------------------|----------------|
| `noWorkspace` / `idle` | 中央占位文字："从左侧文件树打开文件" |
| `loading` | 内容 skeleton（灰色区域）|
| `editing` | TipTap 可编辑实例 |
| `dirty` | TipTap 可编辑实例，EditorTab 显示 `•` |
| `saving` | TipTap 锁定（`editable: false`）+ 状态栏"保存中…" |
| `readonly` | TipTap 只读（光标禁止，`--text-muted` 提示）|
| `error` | 错误 banner（红色内联文字）|

**EditorTabs 规范**

```typescript
interface EditorTabsProps {
  tabs: Array<{ id: string; filePath: string; dirty: boolean }>;  // TERM-ED-001
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
}
```

- 活跃 tab：`--accent` 底边 underline，背景 `--bg-elevated`
- dirty tab：文件名后显示 `•`（`--text-secondary`）
- 超出宽度：`overflow-x: auto; white-space: nowrap`

**EditorArea + GreenAdditionDecoration 接口占位（BR-ED-STATE-006）**

Phase 2 EditorArea 使用现有 `MarkdownEditor.tsx`（TipTap + tiptap-markdown）包装，`GreenAdditionDecoration` 扩展仅声明接口但不实现装饰逻辑（Phase 4 实现）：

```typescript
// 占位接口，Phase 4 实现
interface GreenAdditionDecorationProps {
  appliedRange: { from: number; to: number } | null;  // TERM-DE-008
}
```

**EditorArea 约束（BR-DE-UI-002）**

- `.md` / `.txt`：TipTap 可编辑/只读实例；**不得**在 EditorArea 内渲染 originalText 红色删除线
- `other`：只读 textarea 或 pre 展示
- GreenAdditionDecoration 覆盖 appliedRange 范围，`background: var(--diff-add-bg)`

**EditorStatusBar 规范**

```typescript
interface EditorStatusBarProps {
  filePath: string | null;
  saveStatus: "saved" | "unsaved" | "saving" | "error";
  wordCount: number;
}
```

保存状态文字映射：

| saveStatus | 文字 | 颜色 |
|-----------|------|------|
| `saved` | 已保存 | `--text-muted` |
| `unsaved` | 未保存 • | `--text-secondary` |
| `saving` | 保存中… | `--text-secondary` |
| `error` | 保存失败 | `--danger` |

**对话框占位（Phase 2 仅渲染，无业务逻辑）**

| 对话框 | 触发条件 | 规则 | 规范来源 |
|--------|---------|------|---------|
| `DirtyTabCloseDialog` | dirty EditorTab 关闭请求 | BR-ED-STATE-003 | SYS-C-UI-01 §6.1 |
| `PreappliedSaveDialog` | Cmd+S 时活跃 EditorTab 有 preapplied PendingDiff | BR-DE-PERSIST-001 | SYS-C-UI-01 §6.2 |
| `PreappliedTabCloseDialog` | 关闭含 preapplied PendingDiff 的 EditorTab | BR-DE-STATE-014 | SYS-C-UI-01 §6.3 |

三个对话框 Phase 2 均：渲染正确的对话框标题和按钮文案（对照 SYS-C-UI-01 §6），按钮 onClick 回调为 prop，不绑定任何业务逻辑。

**DirtyTabCloseDialog 文案（必须与 SYS-C-UI-01 §6.1 一致）**

```
标题：关闭未保存文件
正文：{filePath} 有未保存的修改。
按钮：[取消]  [放弃修改并关闭]  [保存并关闭]
```

**@GOV 块（EditorColumn）**

```typescript
/**
 * @GOV
 * codes: BR-ED-STATE-003, BR-ED-STATE-005, BR-ED-STATE-006, BR-DE-UI-002, BR-DE-PERSIST-001, BR-DE-STATE-014
 * type: RB
 * chain: ED-OPEN-FILE, ED-SAVE-FILE, ED-DIFF-RENDER
 * rules: BR-ED-STATE-003, BR-ED-STATE-005, BR-ED-STATE-006, BR-DE-UI-002, BR-DE-PERSIST-001, BR-DE-STATE-014
 * boundary: in=editorMachine state and EditorTab list | out=EditorArea availability and GreenAdditionDecoration interface, DirtyTabCloseDialog, PreappliedSaveDialog, PreappliedTabCloseDialog
 * term_ref: TERM-ED-001, TERM-ED-003, TERM-DOC-003, TERM-DE-004, TERM-DE-008
 */
```

### 验收标准（Issue 2-D）

- [ ] `noWorkspace` / `idle` 状态下中栏显示占位文字
- [ ] `editing` 状态下 TipTap 实例可编辑，输入内容不报错
- [ ] `dirty` 状态下对应 EditorTab 显示 `•`
- [ ] `saving` 状态下 TipTap `editable: false`，状态栏显示"保存中…"
- [ ] `readonly` 状态下 TipTap 不可编辑，光标改变
- [ ] EditorArea 内无任何红色删除线渲染（BR-DE-UI-002）
- [ ] DirtyTabCloseDialog / PreappliedSaveDialog / PreappliedTabCloseDialog 三个对话框正确渲染文案
- [ ] `tsc --noEmit` 零错误

---

## 七、Issue 2-E：ChatPanel 骨架 + DiffCard

### 修改范围

**新建文件**

| 文件 | 用途 |
|------|------|
| `src/components/ChatPanel.tsx` | 右栏容器，含 MessageList、ChatInput、InputReferenceBar、ProviderConfigPanel |
| `src/components/MessageList.tsx` | 消息历史列表（含 MessageBubble 和 DiffCard）|
| `src/components/MessageBubble.tsx` | 单条消息气泡（user / assistant / system 三种样式）|
| `src/components/DiffCard.tsx` | 差异卡（TERM-DE-011），视觉状态由 diffMachine 状态决定 |
| `src/components/ChatInput.tsx` | 多行输入框 + 发送 / 取消按钮（BR-AG-UI-001）|
| `src/components/InputReferenceBar.tsx` | InputReference 标签列表（TERM-AG-002）|
| `src/components/ProviderConfigPanel.tsx` | Provider 配置抽屉（BR-AG-SEC-001）|

### ChatPanel 状态映射（BR-AG-UI-001）

接受 `chatState` prop（chatMachine 8 个状态）：

| chatMachine 状态 | ChatInput 表现 |
|-----------------|---------------|
| `noWorkspace` | 全区 disabled + "请先打开 Workspace" |
| `ready` | 可输入，发送按钮（内容非空且 Provider 配置完整时启用）|
| `validatingProvider` | disabled + 轻量加载指示 |
| `sending` | disabled + 取消按钮可用 |
| `streaming` | 流式渲染 + 取消按钮可用 |
| `toolCalling` | 工具执行指示 + 取消按钮可用 |
| `cancelling` | disabled，等待中止 |
| `error` | 错误 banner（`errorMessage`）+ RETRY 按钮 |

**ChatInput 按钮规则（BR-AG-UI-001 精确约束）**

```
发送按钮可用条件：chatState === 'ready' && userContent.trim() !== '' && providerConfigured
取消按钮渲染条件：chatState ∈ {'sending', 'streaming', 'toolCalling'}
两者互斥，不同时展示
```

**ProviderConfigPanel（BR-AG-SEC-001）**

- API Key 输入框：`type="password"`，提交后前端不缓存原文，只感知 `apiKeyConfigured: boolean`
- 右上角齿轮图标；`apiKeyConfigured === false` 时齿轮图标添加 `--warning` 小圆点
- 抽屉式展开，`position: absolute; right: 0; top: 0` 覆盖在 ChatPanel 上方

**@GOV 块（ChatPanel）**

```typescript
/**
 * @GOV
 * codes: BR-AG-UI-001, BR-AG-SEC-001, BR-DE-UI-001
 * type: RB
 * chain: AG-SEND-MESSAGE, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF
 * rules: BR-AG-UI-001, BR-AG-SEC-001, BR-DE-UI-001
 * boundary: in=chatMachine state and AgentMessage list | out=ChatInput button availability driven by chatMachine, ProviderConfig apiKeyConfigured indicator, DiffCard visual states driven by diffMachine
 * term_ref: TERM-AG-002, TERM-AG-004, TERM-AG-011, TERM-DE-001, TERM-DE-002, TERM-DE-011
 */
```

### DiffCard 规范（TERM-DE-011）

**Props**

```typescript
interface DiffCardProps {
  filePath: string;
  summary: string;
  originalText: string;          // 红删区（仅 DiffCard 内展示，BR-DE-UI-002）
  newText: string;               // 绿增区（DiffCard 内展示）
  diffState: PendingDiffStatus;  // 来自 diffMachine（TERM-DE-009）
  effectivePath: "open-file" | "closed-file";  // TERM-DE-010
  onAccept: () => void;
  onReject: () => void;
}
```

**视觉状态映射（BR-DE-UI-001 + SYS-C-UI-01 §5.2）**

| diffMachine 状态 | 卡边框 | 卡背景 | 操作入口 | opacity | 状态标签 |
|-----------------|--------|--------|---------|---------|---------|
| `pending` | `--diff-pending-border` | `--bg-elevated` | [拒绝] [接受] | 1 | 待审阅 |
| `preapplied` | `--diff-pending-border` | `--bg-elevated` | [拒绝] [接受] | 1 | 编辑器中 |
| `accepting` | `--diff-pending-border` | `--bg-elevated` | 禁用 loading | 1 | 接受中… |
| `rejecting` | `--border` | `--bg-elevated` | 禁用 loading | 1 | 拒绝中… |
| `accepted` | 无 | `--diff-accepted-bg` | 无 | 0.6 | 已接受 |
| `rejected` | 无 | `--diff-rejected-bg` | 无 | 0.6 | 已拒绝 |
| `expired` | 无 | `--diff-expired-bg` | 无 | 0.6 | 已失效 |
| `error` | 无 | `--diff-error-bg` | 无 | 0.6 | 执行异常 |

**内容区约束（BR-DE-UI-002）**

DiffCard 内容区可以同时展示：
- originalText（`--diff-del-bg` 背景，红色）
- newText（`--diff-add-bg` 背景，绿色）

这是唯一允许出现红删视图的区域；EditorArea 内禁止。

**@GOV 块（DiffCard）**

```typescript
/**
 * @GOV
 * codes: BR-DE-UI-001, BR-DE-UI-002
 * type: RB
 * chain: DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF, ED-DIFF-RENDER
 * rules: BR-DE-UI-001, BR-DE-UI-002
 * boundary: in=diffMachine state and PendingDiff originalText/newText/summary fields | out=DiffCard visual state and accept/reject operation availability driven by diffMachine; red-deletion view confined to DiffCard content area only
 * term_ref: TERM-DE-001, TERM-DE-002, TERM-DE-009, TERM-DE-010, TERM-DE-011
 */
```

**WorkspaceCloseGuardDialog（BR-WS-STATE-003，SYS-C-UI-01 §6.4）**

文案：
```
标题：确认关闭 Workspace
正文：当前有未保存的编辑或待处理的 AI 修改建议，关闭后这些内容将丢失。
按钮：[取消]  [确认关闭]
```

Phase 2 渲染正确文案，onConfirm / onCancel 为 prop 占位。

### 验收标准（Issue 2-E）

- [ ] ChatPanel 在 `noWorkspace` 状态下显示 disabled 提示
- [ ] ChatPanel 在 `ready` 状态下输入框可用，发送按钮逻辑正确（内容空时 disabled）
- [ ] 取消按钮仅在 `sending` / `streaming` / `toolCalling` 时渲染为可用
- [ ] ProviderConfigPanel：API Key 字段 `type="password"`；`apiKeyConfigured: false` 时齿轮图标有 `--warning` 圆点（BR-AG-SEC-001）
- [ ] DiffCard 8 个状态下视觉符合 §5.2 规范（人工核查）：
  - `pending` / `preapplied`：显示接受/拒绝按钮，`--diff-pending-border` 边框
  - 终态（accepted/rejected/expired/error）：opacity 0.6，无操作入口
- [ ] DiffCard 内容区可见红删（originalText）；EditorArea 内无红删渲染（BR-DE-UI-002）
- [ ] WorkspaceCloseGuardDialog 文案正确渲染
- [ ] `tsc --noEmit` 零错误

---

## 八、阶段性验证方案

### 验证门禁顺序

```
Issue 2-A ──── token 门禁 ──→ Issue 2-B ──── 布局门禁 ──→ Issue 2-C
                                                              ↓
                              Issue 2-E ←────────────── Issue 2-D
```

每完成一个 Issue 必须通过对应门禁才能继续：

| Issue | 门禁条件 |
|-------|---------|
| 2-A 完成后 | `tsc --noEmit` 通过；浏览器 `:root` 可见全部 token |
| 2-B 完成后 | `tsc --noEmit` 通过；三栏渲染；ResizeHandle 可拖拽；localStorage 写入正确 |
| 2-C 完成后 | `tsc --noEmit` 通过；四种 workspaceMachine 状态在 FileTreePanel 映射正确 |
| 2-D 完成后 | `tsc --noEmit` 通过；editorMachine 各状态对 EditorArea 的影响符合规范 |
| 2-E 完成后 | `tsc --noEmit` 通过；DiffCard 8 状态视觉符合规范；ChatInput 按钮逻辑正确 |

### 映射验证（阶段性）

Phase 2 结束后执行：

```bash
npm run governance:audit
npm run governance:generate
```

**预期 governance:audit 结果**：
- `OWNER_MISSING` 数量从 22 条减少（BR-SYS-UI-001/002、BR-DE-UI-001/002、BR-AG-UI-001、BR-ED-STATE-005/006、BR-DE-PERSIST-001、BR-DE-STATE-014、BR-WS-STATE-003、BR-ED-STATE-003 等 Phase 2 规则被新增 @GOV 块覆盖）
- `TERM integrity` 中 referenced_terms 数量增加（新增 @GOV 块引用 term_ref）
- `BOUNDARY_ABSTRACT` 零违规

### 治理测试更新

Phase 2 完成后需新增 `tests/governance.phase3.test.ts`，覆盖：

```typescript
// covers: BR-SYS-UI-001
it("驱动面板可用性的唯一来源是 workspaceMachine 状态")

// covers: BR-SYS-UI-002
it("ResizeHandle 宽度在 [min, max] 范围内，localStorage 持久化")

// covers: BR-AG-UI-001
it("chatMachine ready 状态 + 内容非空时发送按钮可用")
it("chatMachine sending/streaming/toolCalling 时取消按钮可用")

// covers: BR-DE-UI-001
it("非终态 DiffCard 展示接受/拒绝入口")
it("终态 DiffCard opacity 0.6，无操作入口")

// covers: BR-DE-UI-002
it("DiffCard 内容区渲染 originalText 红删和 newText 绿增")
it("EditorArea 内无红删渲染")
```

---

## 九、Phase 2 整体验收核查清单

| 检查项 | 规则 | 状态 |
|--------|------|------|
| 全部 CSS token（12 基础 + 7 Diff）在 `:root` 声明 | BR-SYS-UI-001/002 | [x] |
| 三栏布局全高，无顶部 Titlebar，ResizeHandle 可拖拽 | BR-SYS-UI-002 | [x] |
| 左栏 180–480px，右栏 260–600px，宽度刷新后恢复 | BR-SYS-UI-002 | [x] |
| workspaceMachine 5 个状态均在 FileTreePanel 正确映射 | BR-SYS-UI-001 | [x] |
| editorMachine 8 个状态均在 EditorColumn 正确映射 | BR-ED-STATE-005 | [x] |
| chatMachine 8 个状态均在 ChatPanel 正确映射 | BR-AG-UI-001 | [x] |
| DiffCard 8 个 diffMachine 状态的视觉规范全部符合 | BR-DE-UI-001 | [x] |
| EditorArea 内零红删渲染 | BR-DE-UI-002 | [x] |
| DiffCard 内容区同时展示 originalText 红删和 newText 绿增 | BR-DE-UI-002 | [x] |
| ProviderConfigPanel API Key `type="password"` | BR-AG-SEC-001 | [x] |
| 四个对话框文案与 SYS-C-UI-01 §6 完全一致 | BR-ED-STATE-003, BR-WS-STATE-003, BR-DE-PERSIST-001, BR-DE-STATE-014 | [x] |
| 所有新增 @GOV 块 boundary 无抽象占位词 | SYS-C-T-01 BOUNDARY_ABSTRACT | [x] |
| `tsc --noEmit` 零错误 | — | [x] |
| `npm run governance:audit` OWNER_MISSING 减少至 ≤10 条 | — | [x] 8 条 |
| `npm run governance:generate` 成功，@GOV 块数 ≥ 38 | — | [x] 48 块 |
| `vitest run` 39 pass（无回归），新增 governance.phase2-ui.test.ts 全通过 | — | [x] |

---

## 十、代码现状与 Phase 2 改动摘要

| 现状 | Phase 2 后 |
|------|-----------|
| `src/index.css`：浅色主题，无 token 体系 | 暗色主题，19 个 CSS token |
| `src/App.tsx`：850 行平铺 | 引入 `<MainLayout>` 三栏壳；原有业务逻辑保留待 Phase 3 迁移 |
| `src/components/`：仅 `MarkdownEditor.tsx` | 新增 11 个组件骨架文件 |
| @GOV blocks：27 个 | 新增 ≥11 个，覆盖 12 条 Phase 2 规则 |
| OWNER_MISSING：22 条 | 预期减少至 ≤10 条 |

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-24 | v1.0 | 初始版本。基于 SYS-C-UI-01、WS-M-P-02、ED-M-P-01、AG-M-P-04、DE-M-T-01 生成 Phase 2 全量 Issue Trace，含规则映射链图、名词声明、5 个 Issue、阶段验证方案和整体通过标准 |
| 2026-05-24 | v1.1 | Phase 2 全量完成。所有 5 个 Issue 交付并通过门禁：39 vitest pass、tsc 零错误、@GOV 块 48 个（≥38）、OWNER_MISSING 8 条（≤10）。新增 governance.phase2-ui.test.ts 覆盖 BR-SYS-UI-001/002、BR-AG-UI-001、BR-DE-UI-001/002、BR-ED-STATE-006；整体验收清单全部 [x]。chatMachine 补充 BR-AG-STATE-002/003；diffMachine 补充 BR-DE-STATE-004/005/013、BR-DE-PERSIST-002。 |
