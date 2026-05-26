import { setup } from "xstate";
import type { PendingDiffStatus } from "../types/diff";

// Re-export for backward compatibility (App.tsx, ChatPanel.tsx, DiffCard.tsx import from here).
export type { PendingDiffStatus };

/**
 * @GOV
 * codes: BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-003,
 *        BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-002,
 *        BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-002,
 *        BR-DE-STATE-004-GUARD-DE-DE-ACCEPT-DIFF-003,
 *        BR-DE-STATE-005-GUARD-DE-DE-CREATE-DIFF-004,
 *        BR-DE-STATE-010-EFFECT-DE-DE-ACCEPT-DIFF-004,
 *        BR-DE-STATE-011-EFFECT-DE-DE-ACCEPT-DIFF-005,
 *        BR-DE-STATE-012-GUARD-DE-DE-EXPIRE-DIFF-003,
 *        BR-DE-STATE-013-EFFECT-DE-DE-EXPIRE-DIFF-004,
 *        BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-002,
 *        BR-DE-PERSIST-002-DATA-DE-DE-CREATE-DIFF-005,
 *        BR-SYS-GOV-001, BR-CORE-GOV-001
 * type: DATA
 * chain: DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF
 * rules: BR-DE-STATE-001, BR-DE-STATE-002, BR-DE-STATE-003, BR-DE-STATE-004,
 *        BR-DE-STATE-005, BR-DE-STATE-010, BR-DE-STATE-011, BR-DE-STATE-012,
 *        BR-DE-STATE-013, BR-DE-PERSIST-001, BR-DE-PERSIST-002,
 *        BR-SYS-GOV-001, BR-CORE-GOV-001
 * boundary: in=PendingDiff state transition events (LOGICAL_STATE_APPLIED, ACCEPT_REQUESTED, etc.) |
 *           out=diffMachine state (pending/preapplied/accepting/rejecting/accepted/rejected/expired/error)
 * term_ref: TERM-DE-001, TERM-DE-002, TERM-DE-004, TERM-DE-009
 */

export type DiffMachineEvent =
  | { type: "LOGICAL_STATE_APPLIED" }
  | { type: "LOGICAL_STATE_APPLIED_FAILED" }
  | { type: "INHERIT_APPLIED" }
  | { type: "ACCEPT_REQUESTED" }
  | { type: "REJECT_REQUESTED" }
  | { type: "EXPIRE_REQUESTED" }
  | { type: "ACCEPT_CONFIRMED" }
  | { type: "TERMINAL_RECORDED" }
  | { type: "FAILED" };

/**
 * 8-state PendingDiff lifecycle machine (TERM-DE-009).
 *
 * States:
 *   pending     — diff created, not yet applied to LogicalState (closed-file path stays here)
 *   preapplied  — originalText replaced in LogicalState; GreenAdditionDecoration rendered
 *   accepting   — accept in-flight (open-file: remove overlay; closed-file: hash check + write)
 *   rejecting   — reject in-flight (open-file: ROLLBACK_LOGICAL_STATE; closed-file: no-op)
 *   accepted    — terminal: accepted (TERM-DE-002)
 *   rejected    — terminal: rejected (TERM-DE-002)
 *   expired     — terminal: expired (content mismatch or WORKSPACE_CLOSED) (TERM-DE-002)
 *   error       — terminal: applyDiffReplaceInEditor failed or accept hash mismatch (TERM-DE-002)
 *
 * State invariants enforced here:
 *   BR-DE-STATE-001: only DiffStore.createDiff() produces a pending instance
 *   BR-DE-STATE-002: rejected → no further state change (final)
 *   BR-DE-STATE-003: expired → no further state change (final)
 *   BR-DE-STATE-005: INHERIT_APPLIED upgrades pending → preapplied
 *   BR-DE-STATE-012: EXPIRE_REQUESTED allowed from pending and preapplied
 *   BR-DE-STATE-013: WORKSPACE_CLOSED triggers EXPIRE_REQUESTED on all non-terminal instances
 */
export const diffMachine = setup({
  types: {
    events: {} as DiffMachineEvent,
  },
}).createMachine({
  id: "diffMachine",
  // Machine instance creation IS the DIFF_CREATED action; initial state is pending.
  initial: "pending",
  states: {
    pending: {
      on: {
        // open-file path: applyDiffReplaceInEditor succeeded
        LOGICAL_STATE_APPLIED: "preapplied",
        // open-file path: originalText not found in PM doc → error terminal
        LOGICAL_STATE_APPLIED_FAILED: "error",
        // Inherit Flow: file opened for a closed-file pending diff with matching baseRevision
        INHERIT_APPLIED: "preapplied",
        // closed-file path: user triggers accept before file is opened
        ACCEPT_REQUESTED: "accepting",
        // closed-file path: user triggers reject before file is opened
        REJECT_REQUESTED: "rejecting",
        // content changed or WORKSPACE_CLOSED
        EXPIRE_REQUESTED: "expired",
      },
    },
    preapplied: {
      on: {
        // user accepts: open-file → remove GreenAdditionDecoration (BR-DE-STATE-011)
        ACCEPT_REQUESTED: "accepting",
        // user rejects: open-file → ROLLBACK_LOGICAL_STATE (BR-DE-STATE-002)
        REJECT_REQUESTED: "rejecting",
        // LogicalState changed in appliedRange → BR-DE-STATE-012
        EXPIRE_REQUESTED: "expired",
      },
    },
    accepting: {
      on: {
        // DiskState write confirmed (closed-file) or overlay removed (open-file)
        ACCEPT_CONFIRMED: "accepted",
        // hash mismatch (closed-file) or write error
        FAILED: "error",
      },
    },
    rejecting: {
      on: {
        // terminal card written to WorkspaceDatabase
        TERMINAL_RECORDED: "rejected",
        // rollback failed
        FAILED: "error",
      },
    },
    // ── Terminal states ───────────────────────────────────────────────────────
    accepted: { type: "final" },
    rejected: { type: "final" },
    expired: { type: "final" },
    error: { type: "final" },
  },
});
