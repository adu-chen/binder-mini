# Binder Mini

Binder Mini is a local-first desktop document editor for governed AI-assisted writing. It is built with Tauri 2, React, TypeScript, and Rust.

The project is developed under the ADU/APC governance model in this repository. Technical design documents are the final source of implementation rules, and code must map back to registered rules or an approved Issue Trace.

## Current MVP

- Open a local Workspace.
- Browse top-level Workspace files.
- Open `.md` and `.txt` files as editable documents.
- Open other files as readonly documents.
- Save the current editable document.
- Configure an Agent provider placeholder.
- Send observable local streaming Agent responses.
- Run readonly Agent tools inside the Workspace boundary:
  - `read_file`
  - `list_files`
  - `search_files`
- Create `PendingDiff` proposals with `edit_current_editor_document`.
- Accept, reject, and expire Diff Review cards.

## Governance

Core project rules live in:

- `ADU.md`
- `ADP.md`
- `CLAUDE.md`
- `docs/00_core/A-CORE-C-P-01_APC.md`
- `docs/20_design/A-SYS-C-T-01_系统技术设计与规则源.md`
- `docs/30_plans/A-CORE-X-P-02_开发实施计划.md`

For code changes, create or update an Issue Trace under `docs/30_plans/` before editing files. The Issue Trace must define allowed files, forbidden files, rule sources, expected behavior, and validation commands.

## Development

Install dependencies:

```bash
npm ci
```

Run the web dev server:

```bash
npm run dev
```

Run the Tauri app:

```bash
npm run tauri dev
```

Run checks:

```bash
npm run governance:generate
npm run governance:audit
npm run check:ts
npm run test
npm run check:rust
npm run build
```

Run the standard gate:

```bash
npm run check:all
```

## Release Status

Current version: `0.1.0`

This is an MVP. It does not yet provide real provider API calls, persistent provider credentials, recursive file tree navigation, packaged installers, or multi-file editing tools.

## License

MIT
