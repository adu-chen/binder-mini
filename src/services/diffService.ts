import type {
  EditCurrentEditorDocumentRequest,
  PendingDiff,
  TerminalDiffCard,
} from "../types/diff";

/**
 * @GOV
 * codes: BR-DE-STATE-001-RB-DE-DE-CREATE-DIFF-005,
 *        BR-DE-PERSIST-001-EFFECT-DE-DE-ACCEPT-DIFF-006,
 *        BR-DE-STATE-002-EFFECT-DE-DE-REJECT-DIFF-007,
 *        BR-DE-STATE-003-GUARD-DE-DE-EXPIRE-DIFF-008,
 *        BR-CORE-GOV-001-RB-DE-DE-CREATE-DIFF-009
 * type: RB
 * chain: DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF
 * rules: BR-DE-STATE-001, BR-DE-PERSIST-001, BR-DE-STATE-002, BR-DE-STATE-003, BR-CORE-GOV-001
 * boundary: in=PendingDiff lifecycle request | out=TerminalDiffCard or executable PendingDiff decision | delegate=accept write, reject terminal record, expire guard
 * term_ref: TERM-DE-002
 */
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
  const proposedText = buildProposedEditorText(request.originalText, instruction);
  return {
    id: `diff-${Date.now()}`,
    filePath: request.filePath,
    originalText: request.originalText,
    proposedText,
    status: "pending",
    summary: instruction,
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
      terminalCard: createTerminalDiffCard(diff.id, "expired"),
    };
  }
  return {
    content: diff.proposedText,
    terminalCard: createTerminalDiffCard(diff.id, "accepted"),
  };
}

export function rejectPendingDiff(diff: PendingDiff): TerminalDiffCard {
  return createTerminalDiffCard(diff.id, "rejected");
}

export function createTerminalDiffCard(
  diffId: string,
  status: TerminalDiffCard["status"],
): TerminalDiffCard {
  return {
    diffId,
    status,
    message: `Diff ${status}`,
  };
}
