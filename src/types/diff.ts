/**
 * @GOV
 * codes: BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-001,
 *        BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-001,
 *        BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-001,
 *        BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-001
 * type: DATA
 * chain: DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF
 * rules: BR-DE-STATE-001, BR-DE-PERSIST-001, BR-DE-STATE-002, BR-DE-STATE-003
 * boundary: in=AI proposed document edit | out=PendingDiff and TerminalDiffCard structures
 * term_ref: TERM-DE-001
 */
export interface PendingDiff {
  id: string;
  filePath: string;
  originalText: string;
  proposedText: string;
  status: "pending";
  summary: string;
}

export interface TerminalDiffCard {
  diffId: string;
  status: "accepted" | "rejected" | "expired" | "error";
  message: string;
}

export interface EditCurrentEditorDocumentRequest {
  filePath: string;
  originalText: string;
  instruction: string;
}
