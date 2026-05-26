---
文档编号：   SYS-C-UI-01
文档状态：   A
负责模块：   SYS
文档职责：   全局 UI 设计规范——布局、组件层级、视觉 token、状态映射与对话框规范
上游约束：   CORE-C-P-01、SYS-C-T-01、WS-M-P-02、ED-M-P-01、AG-M-P-04、DE-M-T-01
直接承接：   所有 React 组件实现、Phase 7 UI 层 Issue Trace
使用边界：   定义视觉外观、组件边界和状态-UI 映射；不写运行时代码；不替代状态机逻辑文档
变更要求：   布局约束、组件层级、token 值或状态映射变更时必须同步本文及对应实现
---

# UI 设计规范

## 0. 设计原则

1. **功能优先，无装饰负担**：无欢迎页、无品牌色、无 splash screen；应用启动直接进入 Workspace 选择或已激活的主布局。
2. **状态驱动渲染**：UI 中每个区域的可见性和可操作性由对应状态机状态决定，不存在游离于状态机之外的 UI 状态。
3. **参考基准**：组件拆解和交互模式对齐 `binder-core` 成熟实现（`src/components/` 目录），视觉上去掉品牌专属元素后直接复用结构。

---

## 1. 布局系统

### 1.1 三栏 Shell

```
┌──────────────────────────────────────────────────────────────┐
│  [左栏：文件树 + 搜索]  │  [中栏：编辑器]  │  [右栏：聊天]  │
│  FileTreePanel           │  EditorColumn    │  ChatPanel     │
└──────────────────────────────────────────────────────────────┘
```

- 三栏均全高，不含顶部 Titlebar（Tauri 无边框窗口）
- 左栏和右栏支持拖拽调整宽度（ResizeHandle）
- 中栏填充剩余空间（flex: 1）

### 1.2 Panel 宽度约束

| Panel | 默认宽度 | 最小宽度 | 最大宽度 |
|-------|---------|---------|---------|
| 左栏（FileTree）| 240px | 180px | 480px |
| 右栏（Chat）| 320px | 260px | 600px |

- Panel 宽度通过 `localStorage` 持久化（key: `binder-panel-left-width`、`binder-panel-right-width`）
- 窗口宽度不足时优先压缩右栏，保证编辑器最小可用宽度 360px

### 1.3 无 Workspace 状态布局

workspaceMachine 处于 `NoWorkspace` 时，三栏仍渲染但左栏展示 Workspace 选择区（打开按钮 + 最近列表），中栏和右栏显示占位空状态，不显示任何 functional UI。

### 1.4 Loading / Error 状态

workspaceMachine 处于 `Loading` 时：全局遮罩 + 加载指示（不可操作）。  
处于 `Error` 时：全局错误展示区 + 重试和清除按钮。

---

## 2. 视觉 Token

### 2.1 颜色系统（中性暗色主题）

| Token | 值 | 用途 |
|-------|----|------|
| `--bg-base` | `#1a1a1a` | 应用背景 |
| `--bg-panel` | `#1e1e1e` | Panel 背景 |
| `--bg-elevated` | `#252525` | 卡片、输入框背景 |
| `--bg-hover` | `#2a2a2a` | hover 态背景 |
| `--border` | `#333333` | 分割线、边框 |
| `--text-primary` | `#e0e0e0` | 主要文字 |
| `--text-secondary` | `#888888` | 辅助文字、标签 |
| `--text-muted` | `#555555` | 占位文字 |
| `--accent` | `#4a90d9` | 焦点态、选中态（中性蓝）|
| `--danger` | `#e05252` | 错误、删除、拒绝 |
| `--success` | `#52a85e` | 成功、接受 |
| `--warning` | `#d4a34a` | 警告、超时、error diff |

### 2.2 Diff 专用颜色

| 语义 | Token | 值 | 用途 |
|------|-------|----|------|
| 绿增（GreenAddition）| `--diff-add-bg` | `rgba(82, 168, 94, 0.18)` | 编辑器内 newText 高亮 |
| 红删（仅 chat 展示）| `--diff-del-bg` | `rgba(224, 82, 82, 0.18)` | chat stream diff 视图中 originalText |
| pending 卡边框 | `--diff-pending-border` | `#4a90d9` | pending/preapplied diff 卡 |
| accepted 卡色调 | `--diff-accepted-bg` | `rgba(82, 168, 94, 0.08)` | 终态 accepted 卡背景 |
| rejected 卡色调 | `--diff-rejected-bg` | `rgba(224, 82, 82, 0.08)` | 终态 rejected 卡背景 |
| expired 卡色调 | `--diff-expired-bg` | `rgba(136, 136, 136, 0.08)` | 终态 expired 卡背景 |
| error 卡色调 | `--diff-error-bg` | `rgba(212, 163, 74, 0.08)` | 终态 error 卡背景 |

### 2.3 字体与间距

- 字体：系统默认 sans-serif（`system-ui, -apple-system, sans-serif`）
- 编辑器字体：`'Fira Code', 'Consolas', monospace`（代码块）
- 基础字号：`13px`（UI 文字）/ `14px`（编辑器正文）
- 行高：`1.5`（文本）/ `1.6`（编辑器）
- 基础间距单位：`4px`；常用：`8px`（紧凑）/ `12px`（标准）/ `16px`（宽松）

---

## 3. 组件层级

### 3.1 顶层树

```
App
└── MainLayout
    ├── FileTreePanel          (左栏)
    │   ├── WorkspaceHeader    (路径 + 关闭按钮)
    │   ├── SearchPanel        (搜索框 + 结果列表)
    │   └── FileTree           (FileTreeNode 递归)
    ├── ResizeHandle           (左栏/中栏分割线)
    ├── EditorColumn           (中栏)
    │   ├── EditorTabs         (标签栏)
    │   ├── EditorArea         (TipTap 实例区)
    │   └── EditorStatusBar    (状态栏)
    ├── ResizeHandle           (中栏/右栏分割线)
    └── ChatPanel              (右栏)
        ├── MessageList        (消息历史)
        │   └── MessageBubble  (单条消息；assistant 消息含 toolCallId 时在气泡下方渲染关联 DiffCard，通过 toolCallId ↔ sourceToolId 关联)
        ├── DiffActionBar      (批量操作栏；pending/preapplied diff 数 ≥ 1 时可见)
        ├── InputReferenceBar  (InputReference 标签列表)
        ├── ChatInput          (输入框 + 发送/取消按钮)
        └── ProviderConfigPanel (Provider 设置抽屉)
```

### 3.2 对话框层（独立于三栏）

```
DialogLayer
├── DirtyTabCloseDialog        (dirty Tab 关闭确认)
├── PreappliedSaveDialog       (Cmd+S 含 preapplied diff)
├── PreappliedTabCloseDialog   (Tab 关闭含 preapplied diff，三选一)
└── WorkspaceCloseGuardDialog  (Workspace 关闭门禁)
```

---

## 4. 各区域组件规范

### 4.1 FileTreePanel

**WorkspaceHeader**
- 左侧：当前 Workspace 目录名（截断显示，hover 展示完整路径 tooltip）
- 右侧：关闭 Workspace 图标按钮

**SearchPanel**
- 搜索框（placeholder："搜索文件内容…"）
- 结果列表：`filePath`（相对路径，主文字）+ `preview`（FTS5 snippet，辅助文字）
- 无结果时："`--text-muted`" 占位文字
- 索引降级时：顶部轻量 banner 提示（不阻断操作）

**FileTreeNode**
- 文件图标（按扩展名区分 md/txt/other）
- 文件名
- 右键菜单：重命名 / 移动 / 删除（需二次确认）
- 拖拽到 Chat 输入框 → 创建 file 类 InputReference

**状态映射**

| workspaceMachine 状态 | FileTreePanel 表现 |
|----------------------|-------------------|
| `NoWorkspace` | 展示"打开 Workspace"按钮 + 最近列表（无文件树）|
| `Loading` | 文件树区 skeleton + 不可操作 |
| `Active` | 正常文件树 |
| `Closing` | 不可操作（dialog 在前景）|
| `Error` | 展示错误 + 重试按钮 |

### 4.2 EditorColumn

**EditorTabs**
- 每个 EditorTab：`filePath`（仅文件名部分）+ dirty 指示（`•`）+ 关闭按钮（`✕`）
- 活跃 tab：`--accent` 底边 underline，背景略亮
- 超出宽度时水平滚动（不折行）

**EditorArea**
- `.md` 文件：TipTap + tiptap-markdown，GreenAdditionDecoration 渲染绿增
- `.txt` 文件：TipTap 纯文本模式
- 其他文件：readonly 展示（灰色光标禁止，不可编辑）
- 无打开文件：中央占位文字（"从左侧文件树打开文件"）

**EditorStatusBar**（固定底部）

```
[相对文件路径]                [保存状态]  [行数 / 字数]
```

- 保存状态：`已保存`（`--text-muted`）/ `未保存`（`--text-secondary` + `•`）/ `保存中…` / `保存失败`（`--danger`）

**状态映射**

| editorMachine 状态 | EditorArea 表现 |
|-------------------|----------------|
| `noWorkspace` / `idle` | 空白占位 |
| `loading` | 内容 skeleton |
| `editing` | 可编辑，无 dirty 指示 |
| `dirty` | 可编辑，Tab 显示 `•` |
| `saving` | 不可编辑（锁定态）+ 状态栏"保存中…" |
| `readonly` | 不可编辑，光标禁止 |
| `error` | 错误信息内联展示（红色 banner）|

### 4.3 ChatPanel

**MessageList**

- 用户消息（`role: user`）：右对齐气泡，`--bg-elevated` 背景
- 助手消息（`role: assistant`）：左对齐，无气泡背景，紧凑排版
- 系统合成消息（`role: system`，如文件切换通知）：`--text-muted` 居中细小文字，不突出展示
- 流式消息：尾部闪烁光标
- 工具调用过程（chatMachine `toolCalling` 状态）：内联展示当前 activeToolExecution 工具名 + 状态（执行中 / 完成 / 超时）

**MessageBubble 中的 DiffCard**

见 §5 Diff 卡规范。

**ChatInput**

- 多行文本输入框（Enter 发送，Shift+Enter 换行）
- 左下：InputReference 标签（可删除）
- 右下：发送按钮（chatMachine `ready` + 内容非空时可用）/ 取消按钮（`sending` / `streaming` / `toolCalling` 时可用，替换发送按钮）

**DiffActionBar**（InputReferenceBar 上方）

```
┌────────────────────────────────────────────────┐
│  AI 修改待处理（N）       [拒绝全部]  [接受全部]  │
└────────────────────────────────────────────────┘
```

- 仅在 `pending` 或 `preapplied` 状态的 diff 数量 ≥ 1 时渲染；全部进入终态后自动隐藏
- N 为当前 pending + preapplied diff 数量
- "接受全部" / "拒绝全部"：对所有 pending/preapplied diff 逐条调用 acceptDiff / rejectDiff（按 REQ-DE-013，失败项独立标 error，不阻止其他条）
- 规则：`BR-DE-UI-003`

**InputReferenceBar**（chatInput 上方）

- 每个 InputReference 以标签形式展示：`[📄 文件名]` / `[🔗 URL]` / `[" 文本片段…"]`
- 右侧 `✕` 删除单个引用
- 整体在 `inputReferences.length === 0` 时隐藏

**ProviderConfigPanel**（右上角图标触发，抽屉式展开）

- Provider 类型选择（Anthropic / OpenAI 等）
- 模型选择
- API Key 输入框（`type="password"`，保存后只感知 `apiKeyConfigured` 布尔值）
- 已保存 key 的 Provider 在应用重启后仍显示已配置状态；UI 不展示明文 key，不从 workspace.db 读取 key

**状态映射**

| chatMachine 状态 | ChatPanel 表现 |
|-----------------|---------------|
| `noWorkspace` | 输入区 disabled，提示"请先打开 Workspace" |
| `ready` | 正常可输入 |
| `validatingProvider` | 输入区 disabled + loading 指示 |
| `sending` | 输入区 disabled + 取消按钮可用 |
| `streaming` | 流式消息渲染 + 取消按钮可用 |
| `toolCalling` | 工具执行中指示 + 取消按钮可用 |
| `cancelling` | loading 指示，等待中止确认 |
| `error` | 错误 banner（`errorMessage`）+ RETRY 按钮 |

---

## 5. Diff 卡视觉规范

### 5.1 聊天区 Diff 卡结构

```
┌────────────────────────────────────────────────┐
│ 📄 src/components/Foo.tsx          [状态标签]  │  ← 卡片头
├────────────────────────────────────────────────┤
│ - 被替换的原文（--diff-del-bg 背景）            │  ← 内容区
│ + 新增的内容（--diff-add-bg 背景）              │  （仅在 chat diff 视图中同时显示红删和绿增）
├────────────────────────────────────────────────┤
│ AI 对本次修改的说明摘要（summary 字段）          │  ← 说明区
├────────────────────────────────────────────────┤
│                      [拒绝]  [接受]            │  ← 操作区（仅非终态展示）
└────────────────────────────────────────────────┘
```

### 5.2 状态-视觉映射

| diffMachine 状态 | effectivePath | 状态标签 | 卡边框 | 卡背景 | 操作入口 |
|-----------------|---------------|---------|--------|--------|---------|
| `pending` | closed-file | 待审阅 | `--diff-pending-border` | `--bg-elevated` | 接受 / 拒绝 |
| `preapplied` | open-file | 编辑器中 | `--diff-pending-border` | `--bg-elevated` | 接受 / 拒绝 |
| `accepting` | — | 接受中… | `--diff-pending-border` | `--bg-elevated` | 禁用（loading）|
| `rejecting` | — | 拒绝中… | `--border` | `--bg-elevated` | 禁用（loading）|
| `accepted` | — | 已接受 | 无 | `--diff-accepted-bg` | 无 |
| `rejected` | — | 已拒绝 | 无 | `--diff-rejected-bg` | 无 |
| `expired` | — | 已失效 | 无 | `--diff-expired-bg` | 无 |
| `error` | — | 执行异常 | 无 | `--diff-error-bg` | 无（展示 errorMessage）|

终态卡片（accepted / rejected / expired / error）整体降权：`opacity: 0.6`，文字使用 `--text-secondary`。

### 5.3 编辑器内 GreenAdditionDecoration

- `Decoration.inline` 渲染，覆盖 `appliedRange` 范围
- 样式：`background: var(--diff-add-bg)`，无边框，无额外字符
- 不渲染红删（编辑器只展示绿增，保持 LogicalState 可读性）
- preapplied diff 移除（accept / reject）时，GreenAdditionDecoration 同步移除，无动画

### 5.4 批量操作展示

批量操作有两类入口，语义不同：

**类型 A — DiffActionBar（聊天面板常驻栏，见 §4.3）**

当 ChatPanel 中存在 pending / preapplied diff 时，输入框上方展示：

```
AI 修改待处理（N）       [拒绝全部]  [接受全部]
```

- 适用场景：用户希望一次性处理当前所有待审阅的 AI 修改建议
- 逐条独立走状态机；失败项标记 error 终态，不阻止其他条
- 规则：`BR-DE-UI-003`

**类型 B — 对话框触发（模态，按场景弹出）**

Cmd+S 含 preapplied diff 时，保存对话框中：

```
[取消]   [先接受 AI 修改，再保存]
```

Tab 关闭含 preapplied diff 时（三选一对话框）：

```
[取消关闭]   [拒绝修改并关闭]   [接受修改并关闭]
```

---

## 6. 对话框规范

所有对话框：
- 居中模态，背景半透明遮罩 `rgba(0,0,0,0.5)`
- 最大宽度 `480px`
- 圆角 `8px`，背景 `--bg-elevated`，边框 `--border`

### 6.1 Dirty Tab 关闭对话框（`BR-ED-STATE-003`）

```
标题：关闭未保存文件

{filePath} 有未保存的修改。

[取消]   [放弃修改并关闭]   [保存并关闭]
```

### 6.2 Cmd+S 含 preapplied diff 对话框（`BR-DE-PERSIST-001`）

```
标题：当前文件有待审阅的 AI 修改

保存前建议先处理 AI 生成的修改建议。

[取消]   [接受所有修改后保存]
```

### 6.3 Tab 关闭含 preapplied diff 对话框（`BR-DE-STATE-014`）

```
标题：{filePath} 有 AI 修改待处理

关闭前请选择如何处理编辑器中的 AI 修改建议。

[取消关闭]   [拒绝修改并关闭]   [接受修改并关闭]
```

### 6.4 Workspace 关闭门禁对话框（`BR-WS-STATE-003`）

```
标题：确认关闭 Workspace

当前有未保存的编辑或待处理的 AI 修改建议，
关闭后这些内容将丢失。

[取消]   [确认关闭]
```

---

## 7. 交互细节

### 7.1 FileTree 拖拽到 Chat

用户将文件树节点拖入 ChatInput 区域：
- 拖拽进入时：ChatInput 边框高亮（`--accent`）
- 放下：创建 `kind: "file"` InputReference，追加到 InputReferenceBar

### 7.2 ChatInput URL / 文本粘贴

- 粘贴内容以 `http://` 或 `https://` 开头 → 创建 `kind: "url"` InputReference
- 其他粘贴内容且长度 > 200 chars → 创建 `kind: "text"` InputReference（短文本直接插入输入框）

### 7.3 Provider 配置入口

- 右栏 ChatPanel 右上角齿轮图标 → 展开 ProviderConfigPanel 抽屉
- apiKeyConfigured 为 false 时，齿轮图标加 `--warning` 小圆点提示

### 7.4 工具执行进度展示

chatMachine `toolCalling` 时，MessageList 末尾追加一条临时展示：

```
⚙ 正在执行：{toolName}（{elapsed}s）
```

超时（10s）后自动变为 error 状态，临时展示转为错误提示。

---

## 8. 响应式边界

binder-mini 为桌面端 Tauri 应用，不需要移动端适配。最小支持窗口宽度：`900px`（左栏 180px + 中栏 360px + 右栏 260px + ResizeHandle）。

---

## 9. 规则引用表

本文档引用以下已注册技术规则（来源：SYS-C-T-01）：

| 规则 ID | 规则简述 | 文档章节 |
|---------|---------|---------|
| BR-SYS-UI-001 | workspaceMachine 状态驱动所有面板可用性 | §1.3、§1.4、§4.1 |
| BR-SYS-UI-002 | 三栏宽度约束及 localStorage 持久化（left/right key） | §1.2 |
| BR-WS-STATE-003 | Workspace 关闭前 dirty / pending 门禁 | §6.4 |
| BR-ED-STATE-003 | dirty Tab 关闭时弹出保护对话框 | §6.1 |
| BR-ED-STATE-005 | DisplayState 只读派生（preapplied 状态下编辑器锁定） | §4.2 |
| BR-ED-STATE-006 | GreenAdditionDecoration 渲染 appliedRange 绿增高亮 | §4.2、§5.3 |
| BR-AG-SEC-001 | API key 不出 Rust 后端；前端只获取 apiKeyConfigured 布尔值 | §4.3 |
| BR-AG-PERSIST-002 | ProviderCredential 应用级持久化；跨重启和 Workspace 切换保持有效 | §4.3 |
| BR-AG-UI-001 | chatMachine 状态驱动 ChatInput 发送 / 取消按钮可用性 | §4.3 |
| BR-DE-PERSIST-001 | preapplied diff 存在时 Cmd+S 需先处理 | §6.2 |
| BR-DE-STATE-014 | 含 preapplied diff 的 Tab 关闭前需批量处理 | §6.3 |
| BR-DE-UI-001 | diffMachine 状态驱动 DiffCard 视觉状态（非终态展示操作，终态降权） | §5.2 |
| BR-DE-UI-002 | 编辑器只渲染绿增；红删视图仅限 DiffCard 内容区 | §4.2、§5.1 |
| BR-DE-UI-003 | DiffCard 内嵌 MessageBubble（toolCallId↔sourceToolId 关联）；DiffActionBar 常驻栏 | §3.1、§4.3、§5.4 |

---

## 10. 术语声明

本文档使用以下已注册正式术语（来源：SYS-C-T-01 §0 Terminology Registry）：

| TERM ID | 正式名称（en） | 中文名称 | 文档章节 |
|---------|--------------|---------|---------|
| TERM-CORE-001 | Workspace | 工作区 | §1.3、§4.1 |
| TERM-WS-001 | FileNode | 文件节点 | §4.1 |
| TERM-WS-005 | workspaceMachine | 工作区状态机 | §1.3、§1.4、§4.1 |
| TERM-ED-001 | EditorTab | 编辑器标签页 | §4.2 |
| TERM-ED-003 | editorMachine | 编辑器状态机 | §4.2 |
| TERM-DOC-003 | DisplayState | 显示状态 | §4.2 |
| TERM-AG-002 | InputReference | 输入引用 | §4.3、§7.1、§7.2 |
| TERM-AG-004 | chatMachine | 对话状态机 | §4.3 |
| TERM-AG-011 | ProviderConfig | Provider 配置 | §4.3 |
| TERM-DE-001 | PendingDiff | 待审差异 | §5.1、§5.2 |
| TERM-DE-002 | TerminalDiffCard | 终态差异卡 | §4.3 |
| TERM-DE-004 | GreenAddition | 绿增 | §4.2、§5.3 |
| TERM-DE-008 | appliedRange | 已应用范围 | §5.3 |
| TERM-DE-009 | diffMachine | 差异状态机 | §5.2 |
| TERM-DE-010 | effectivePath | 生效路径 | §5.2 |
| TERM-DE-011 | DiffCard | 差异卡 | §4.3、§5 |
| TERM-DE-012 | DiffActionBar | 批量操作栏 | §3.1、§4.3、§5.4 |

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-05-26 | v1.2 | §3.1 组件树 ChatPanel 子树：DiffCard 归入 MessageBubble（toolCallId 关联），新增 DiffActionBar 节点；§4.3 新增 DiffActionBar 子节描述；§5.4 批量操作从"仅对话框"扩展为 A 类常驻栏 + B 类对话框触发两种形态；§9 新增 BR-DE-UI-003 规则引用；§10 新增 TERM-DE-012（DiffActionBar）|
| 2026-05-24 | v1.1 | 治理同步：§9 新增规则引用表（12 条 BR-* 规则）；§10 新增术语声明（16 条 TERM-* 术语）；文档头 上游约束 补充 SYS-C-T-01 |
| 2026-05-24 | v1.0 | 初始版本。定义三栏布局系统、中性暗色 token、组件层级（对齐 binder-core 结构去掉品牌元素）、状态-UI 映射、Diff 卡视觉规范、六类对话框规范和交互细节 |
