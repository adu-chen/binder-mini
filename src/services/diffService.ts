import type {
  EditCurrentEditorDocumentRequest,
  PendingDiff,
  TerminalDiffCard,
  CreateDiffParams,
} from "../types/diff";

/**
 * @GOV
 * codes: BR-DE-DATA-001-RB-DE-DE-CREATE-DIFF-009,
 *        BR-DE-STATE-001-RB-DE-DE-CREATE-DIFF-010,
 *        BR-DE-PERSIST-001-EFFECT-DE-DE-ACCEPT-DIFF-008,
 *        BR-DE-STATE-002-EFFECT-DE-DE-REJECT-DIFF-003,
 *        BR-DE-STATE-003-GUARD-DE-DE-EXPIRE-DIFF-005,
 *        BR-CORE-GOV-001-RB-DE-DE-CREATE-DIFF-011
 * type: RB
 * chain: DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF
 * rules: BR-DE-DATA-001, BR-DE-STATE-001, BR-DE-PERSIST-001, BR-DE-STATE-002, BR-DE-STATE-003, BR-CORE-GOV-001
 * boundary: in=PendingDiff lifecycle request |
 *           out=TerminalDiffCard or executable PendingDiff decision |
 *           delegate=accept write, reject terminal record, expire guard
 * term_ref: TERM-DE-001, TERM-DE-002, TERM-DE-006, TERM-DE-007
 */

// ── Phase 6 createDiff ───────────────────────────────────────────────────────
// BR-DE-DATA-001: sourceToolId and baseRevision are mandatory; throws if absent.
// This is the authorised programmatic entry point; callers should prefer
// diffStore.createDiff() (which delegates here) so the DiffStore Map is kept in sync.
export function createDiff(params: CreateDiffParams): PendingDiff {
  if (!params.sourceToolId) {
    throw new Error(
      "[diffService] BR-DE-DATA-001: sourceToolId is required to create a PendingDiff.",
    );
  }
  if (!params.baseRevision) {
    throw new Error(
      "[diffService] BR-DE-DATA-001: baseRevision is required to create a PendingDiff.",
    );
  }
  return {
    id: `diff-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    filePath: params.filePath,
    originalText: params.originalText,
    newText: params.newText,
    status: "pending",
    summary: params.summary,
    sourceToolId: params.sourceToolId,
    baseRevision: params.baseRevision,
    createdAt: Date.now(),
    effectivePath: params.effectivePath,
    anchor: params.anchor,
  };
}

// ── Legacy helpers (Phase 2; retained per "待后续替换" in Issue Trace §三) ──────

export function canExecutePendingDiff(diff: PendingDiff): boolean {
  return diff.status === "pending";
}

export function createPendingDiffFromCurrentEditor(
  request: EditCurrentEditorDocumentRequest,
): PendingDiff {
  const instruction = request.instruction.replace(/\s+/g, " ").trim();
  if (!instruction) {
    throw new Error("Edit instruction is required.");
  }
  if (!request.filePath) {
    throw new Error("Current editor document is required.");
  }
  const newText = buildProposedEditorText(request.originalText, instruction);
  return {
    id: `diff-${Date.now()}`,
    filePath: request.filePath,
    originalText: request.originalText,
    newText,
    status: "pending",
    summary: instruction,
    // Legacy defaults — Phase 6 production paths use createDiff() with real values.
    sourceToolId: "legacy",
    baseRevision: "",
    createdAt: Date.now(),
    effectivePath: "open-file",
  };
}

export function buildProposedEditorText(
  originalText: string,
  instruction: string,
): string {
  const trimmedInstruction = instruction.replace(/\s+/g, " ").trim();
  const suffix = `\n\n<!-- Binder Mini proposal: ${trimmedInstruction} -->`;
  return originalText.endsWith("\n")
    ? `${originalText}${suffix.trimStart()}`
    : `${originalText}${suffix}`;
}

export function shouldExpirePendingDiff(
  diff: PendingDiff,
  currentFilePath: string,
  currentText: string,
): boolean {
  return diff.filePath !== currentFilePath || diff.originalText !== currentText;
}

export function acceptPendingDiff(
  diff: PendingDiff,
  currentFilePath: string,
  currentText: string,
): { content: string; terminalCard: TerminalDiffCard } {
  if (!canExecutePendingDiff(diff)) {
    throw new Error("PendingDiff is not executable.");
  }
  if (shouldExpirePendingDiff(diff, currentFilePath, currentText)) {
    return {
      content: currentText,
      terminalCard: createTerminalDiffCard(diff.id, "expired", diff.sourceToolId),
    };
  }
  return {
    content: diff.newText,
    terminalCard: createTerminalDiffCard(diff.id, "accepted", diff.sourceToolId),
  };
}

export function rejectPendingDiff(diff: PendingDiff): TerminalDiffCard {
  return createTerminalDiffCard(diff.id, "rejected", diff.sourceToolId);
}

export function createTerminalDiffCard(
  diffId: string,
  status: TerminalDiffCard["status"],
  sourceToolId = "",
): TerminalDiffCard {
  return {
    diffId,
    status,
    message: `Diff ${status}`,
    sourceToolId,
    resolvedAt: Date.now(),
  };
}
