/**
 * @GOV
 * codes: BR-DE-DATA-001-DATA-DE-DE-CREATE-DIFF-001,
 *        BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-002,
 *        BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-001,
 *        BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-001,
 *        BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-001,
 *        BR-AG-DATA-002-DATA-AG-AG-TOOL-CALL-001,
 *        BR-AG-DATA-003-DATA-AG-AG-TOOL-CALL-002
 * type: DATA
 * chain: DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF, AG-TOOL-CALL
 * rules: BR-DE-DATA-001, BR-DE-STATE-001, BR-DE-PERSIST-001, BR-DE-STATE-002, BR-DE-STATE-003, BR-AG-DATA-002, BR-AG-DATA-003
 * boundary: in=PendingDiff lifecycle request from edit_current_editor_document or update_file tool |
 *           out=PendingDiff and TerminalDiffCard structures with sourceToolId and baseRevision fields
 * term_ref: TERM-DE-001, TERM-DE-002, TERM-DE-003, TERM-DE-004, TERM-DE-005, TERM-DE-006, TERM-DE-007, TERM-DE-008, TERM-DE-009, TERM-DE-010, TERM-AG-001, TERM-AG-005
 */

// ── PendingDiffStatus ────────────────────────────────────────────────────────
// TERM-DE-009: diffMachine 8-state — pending/preapplied are non-terminal;
// accepting/rejecting are in-progress intermediates; accepted/rejected/expired/error are final.
export type PendingDiffStatus =
  | "pending"
  | "preapplied"
  | "accepting"
  | "rejecting"
  | "accepted"
  | "rejected"
  | "expired"
  | "error";

// ── DiffAnchorRef ────────────────────────────────────────────────────────────
// TERM-DE-003: auxiliary positional anchor; originalText is the primary locator.
export interface DiffAnchorRef {
  startBlockId: string;
  startOffset: number;
  endBlockId: string;
  endOffset: number;
  occurrenceIndex: number;
  paraIndex: number;
}

// ── PendingDiff ──────────────────────────────────────────────────────────────
// TERM-DE-001: primary entity managed by DiffStore (TERM-DE-009).
// BR-DE-DATA-001: sourceToolId, baseRevision, createdAt, effectivePath are required;
// a diff without traceable fields must not enter pending state.
export interface PendingDiff {
  id: string;
  /** Workspace-relative file path (TERM-CORE-001). */
  filePath: string;
  /** Exact original text — primary PM search locator (TERM-DE-006). */
  originalText: string;
  /** Replacement content fragment, not full file (TERM-DE-007). */
  newText: string;
  status: PendingDiffStatus;
  summary: string;
  /** ToolExecution.id (TERM-AG-001, TERM-AG-005). BR-DE-DATA-001 required. */
  sourceToolId: string;
  /** SHA-256(DiskState bytes), hex 64 chars (TERM-DE-005). BR-DE-DATA-001 required. */
  baseRevision: string;
  /** Unix ms timestamp of creation. BR-DE-DATA-001 required. */
  createdAt: number;
  /**
   * "open-file" — accept removes GreenAdditionDecoration only, no DiskState write (TERM-DE-010).
   * "closed-file" — accept writes DiskState after hash check.
   * INHERIT_APPLIED upgrades "closed-file" → "open-file".
   */
  effectivePath: "open-file" | "closed-file";
  /** Auxiliary positional anchor (TERM-DE-003, optional). */
  anchor?: DiffAnchorRef;
  /** PM absolute position {from, to} recorded by applyDiffReplaceInEditor (TERM-DE-008). */
  appliedRange?: { from: number; to: number };
  /** Content revision token captured before applyDiffReplaceInEditor executes. */
  contentRevisionBeforeApply?: string;
  /** Content revision token captured after applyDiffReplaceInEditor executes. */
  contentRevisionAfterApply?: string;
}

// ── TerminalDiffCard ─────────────────────────────────────────────────────────
// TERM-DE-002: terminal-state record persisted to terminal_diff_cards table.
export interface TerminalDiffCard {
  diffId: string;
  status: "accepted" | "rejected" | "expired" | "error";
  message: string;
  /** Carried from PendingDiff.sourceToolId for audit trail. */
  sourceToolId: string;
  /** Unix ms timestamp of resolution. */
  resolvedAt: number;
}

// ── CreateDiffParams ─────────────────────────────────────────────────────────
// Required input to diffStore.createDiff(); BR-DE-DATA-001 fields are mandatory.
export interface CreateDiffParams {
  filePath: string;
  originalText: string;
  newText: string;
  summary: string;
  /** BR-DE-DATA-001: must equal ToolExecution.id (TERM-AG-001). */
  sourceToolId: string;
  /** BR-DE-DATA-001: SHA-256 hex of current DiskState bytes (TERM-DE-005). */
  baseRevision: string;
  /** BR-DE-DATA-001: "open-file" or "closed-file" routing (TERM-DE-010). */
  effectivePath: "open-file" | "closed-file";
  anchor?: DiffAnchorRef;
}

// ── Legacy request shape (Phase 2; kept for createPendingDiffFromCurrentEditor) ──
export interface EditCurrentEditorDocumentRequest {
  filePath: string;
  originalText: string;
  instruction: string;
}
