# Binder Mini

本地优先的桌面文档编辑器，内置 AI 聊天面板和逐条 Diff 审核流程。

打开本地文件夹作为工作区，编辑 Markdown 和文本文件，通过右侧 AI 聊天面板提出修改请求。AI 的每条编辑建议以 Diff 卡片的形式呈现，你可以逐条接受、拒绝，或直接让其过期，文件不会被自动改动。

---

A local-first desktop document editor with an AI chat panel and inline diff review.

Open a local folder as a workspace, edit Markdown and text files, and chat with an AI that can propose edits to your open document. Each proposed edit arrives as a diff card — you accept, reject, or let it expire without touching the file.

---

## 功能 / Features

- **逐条 Diff 审核** — AI 编辑以待审 Diff 卡片呈现，支持单条和批量接受 / 拒绝
- **多 AI 提供商** — 在聊天面板切换 Anthropic（Claude）、OpenAI（GPT-4）、DeepSeek
- **本地工作区** — 文件存储在本地磁盘，无云同步，除 API Key 外无需账号
- **流式响应** — 逐 token 输出，支持中途取消
- **文件管理** — 工作区内新建、重命名、删除、全文搜索
- **多标签编辑器** — 同时打开多个文件，脏状态追踪，有待处理 Diff 时阻断保存

---

- **Inline diff review** — AI edits show as pending diffs with per-diff and batch accept / reject controls
- **Multi-provider** — switch between Anthropic (Claude), OpenAI (GPT-4), and DeepSeek from the chat panel
- **Local workspace** — files stay on disk; no cloud sync, no account required beyond an API key
- **Streaming responses** — token-by-token output with cancel support mid-stream
- **File management** — create, rename, delete, and full-text search files inside the workspace
- **Tab editor** — open multiple files with dirty-state tracking and save-guard on pending diffs

---

## 技术栈 / Stack

| 层级 | 技术 |
|------|------|
| 桌面壳 / Desktop shell | [Tauri 2](https://tauri.app) |
| 后端 / Backend | Rust |
| 前端 / Frontend | React 19 + TypeScript |
| 编辑器 / Editor | [TipTap 3](https://tiptap.dev) |
| 状态机 / State machines | [XState 5](https://stately.ai/docs/xstate) |
| AI 提供商 / AI providers | Anthropic SDK · OpenAI SDK |

---

## 快速开始 / Getting Started

```bash
npm ci
npm run tauri dev
```

首次启动后在提供商设置面板填入 API Key。Key 由 Rust 后端存储，不会保存在 JavaScript 状态中。

*On first launch, open the provider panel to enter your API key. Keys are stored by the Rust backend and never held in JavaScript state.*

---

## Diff 工作流 / How the Diff Workflow Works

AI 调用 `edit_current_editor_document` 工具时，编辑器内会高亮显示改动范围，AI 消息旁同步出现 Diff 卡片：

- **接受（Accept）** — 确认改动，文件标记为未保存，由你手动保存
- **拒绝（Reject）** — 编辑器内容回滚到修改前
- **批量（Batch）** — 一键接受或拒绝当前文件的全部待审 Diff

关闭文件或工作区时，若存在未处理的 Diff，会弹出确认对话框。

---

*When the AI calls `edit_current_editor_document`, the proposed change is highlighted in the editor and a diff card appears inline with the AI message. Accept confirms the change, Reject reverts the editor, and Batch applies to all pending diffs at once. Closing a file or workspace with unresolved diffs triggers a guard dialog.*

---

## 开发 / Development

```bash
npm run tauri dev        # 启动桌面应用 / run the desktop app
npm run check:all        # 完整检查 / full gate: audit + tsc + tests + cargo check
```

单项检查 / Individual checks:

```bash
npm run governance:audit   # 规则审计（只读）/ read-only rule audit
npm run check:ts           # TypeScript
npm run test               # Vitest
npm run check:rust         # cargo check
```

---

## 治理模型 / Governance

本项目采用 ADU/ADP 治理模型：设计文档是规则权威源，每个代码块都映射到注册规则或经审批的 Issue Trace。核心文档位于 `docs/00_core/` 和 `docs/20_design/`。

代码变更前，请在 `docs/30_plans/` 下创建或更新 Issue Trace。

*This project uses the ADU/ADP governance model: design documents are the authoritative source for rules, and every code block maps back to a registered rule or an approved Issue Trace. Core documents live in `docs/00_core/` and `docs/20_design/`.*

---

## 许可证 / License

MIT
