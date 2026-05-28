# Binder Mini

A local-first desktop document editor with an AI chat panel and inline diff review.

You open a local folder as a workspace, edit Markdown and text files, and chat with an AI that can propose edits to your open document. Each proposed edit arrives as a diff card — you accept, reject, or let it expire without touching the file.

## Features

- **Inline diff review** — AI edits show as pending diffs with per-diff and batch accept / reject controls
- **Multi-provider** — switch between Anthropic (Claude), OpenAI (GPT-4), and DeepSeek from the chat panel
- **Local workspace** — files stay on disk; no cloud sync, no account required beyond an API key
- **Streaming responses** — token-by-token output with cancel support mid-stream
- **File management** — create, rename, delete, and full-text search files inside the workspace
- **Tab editor** — open multiple files with dirty-state tracking and save-guard on pending diffs

## Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | [Tauri 2](https://tauri.app) |
| Backend | Rust |
| Frontend | React 19 + TypeScript |
| Editor | [TipTap 3](https://tiptap.dev) |
| State machines | [XState 5](https://stately.ai/docs/xstate) |
| AI providers | Anthropic SDK · OpenAI SDK |

## Getting started

```bash
npm ci
npm run tauri dev
```

On first launch, open the provider panel to enter your API key. Keys are stored by the Rust backend and never held in JavaScript state.

## How the diff workflow works

When the AI calls `edit_current_editor_document`, the proposed change is highlighted in the editor and a diff card appears inline with the AI message. From there:

- **Accept** — confirms the change; the file stays dirty until you save explicitly
- **Reject** — reverts the editor to the text before the edit
- **Batch** — accept or reject all pending diffs across the active file at once

Closing a file or workspace with unresolved diffs triggers a guard dialog.

## Development

```bash
npm run tauri dev        # run the desktop app
npm run check:all        # full gate: audit + tsc + tests + cargo check
```

Individual checks:

```bash
npm run governance:audit   # read-only rule audit
npm run check:ts           # TypeScript
npm run test               # Vitest
npm run check:rust         # cargo check
```

## Governance

This project uses the ADU/ADP governance model: design documents are the authoritative source for rules, and every code block maps back to a registered rule or an approved Issue Trace. Core documents live in `docs/00_core/` and `docs/20_design/`.

For code changes, create or update an Issue Trace under `docs/30_plans/` before editing files.

## License

MIT
