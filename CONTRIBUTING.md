# Contributing

Binder Mini is developed with document-first governance. Contributions are welcome when they preserve the rule trace from planning documents to implementation.

## Workflow

1. Read `ADU.md`, `ADP.md`, `CLAUDE.md`, and the APC before making changes.
2. Identify the active plan in `docs/30_plans/`.
3. For code changes, create an Issue Trace under `docs/30_plans/`.
4. Keep edits inside the Issue Trace `allowed_files` list.
5. Do not modify forbidden files unless the Issue Trace is updated and confirmed.
6. Refresh ADUS when governance annotations or source documents change.
7. Run validation before opening a pull request.

## Required Checks

```bash
npm run governance:generate
npm run governance:audit
npm run check:ts
npm run test
npm run check:rust
npm run build
```

## Pull Requests

Pull requests should include:

- The Issue Trace path.
- The rule IDs or constraints being implemented.
- A short behavior summary.
- Validation commands and results.
- Any remaining limitations or follow-up work.

## Code Rules

- Technical design documents are the final source of implementation rules.
- Code must not exist outside the registered rule system.
- State-machine-suitable feature logic must be represented in a state machine before implementation.
- Agent file writes must go through Diff Review and must not bypass `PendingDiff`.
