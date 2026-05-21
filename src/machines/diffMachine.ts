import type { MachineDefinition } from "./workspaceMachine";

/**
 * @GOV
 * codes: BR-DE-STATE-001-DATA-DE-DE-CREATE-DIFF-002,
 *        BR-DE-PERSIST-001-DATA-DE-DE-ACCEPT-DIFF-002,
 *        BR-DE-STATE-002-DATA-DE-DE-REJECT-DIFF-002,
 *        BR-DE-STATE-003-DATA-DE-DE-EXPIRE-DIFF-002,
 *        BR-SYS-GOV-001-DATA-DE-DE-CREATE-DIFF-003,
 *        BR-CORE-GOV-001-DATA-DE-DE-CREATE-DIFF-004
 * type: DATA
 * chain: DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF
 * rules: BR-DE-STATE-001, BR-DE-PERSIST-001, BR-DE-STATE-002, BR-DE-STATE-003, BR-SYS-GOV-001, BR-CORE-GOV-001
 * boundary: in=PendingDiff lifecycle events | out=diffMachine state definition
 * term_ref: TERM-DE-001
 */
export type DiffState =
  | "none"
  | "pending"
  | "accepting"
  | "rejecting"
  | "expired"
  | "terminal"
  | "error";

export type DiffEvent =
  | "DIFF_CREATED"
  | "ACCEPT_REQUESTED"
  | "REJECT_REQUESTED"
  | "EXPIRE_REQUESTED"
  | "WRITE_SUCCEEDED"
  | "TERMINAL_RECORDED"
  | "FAILED";

export function createDiffMachineDefinition(): MachineDefinition<
  DiffState,
  DiffEvent
> {
  return {
    id: "diffMachine",
    initial: "none",
    states: {
      none: { DIFF_CREATED: "pending" },
      pending: {
        ACCEPT_REQUESTED: "accepting",
        REJECT_REQUESTED: "rejecting",
        EXPIRE_REQUESTED: "expired",
      },
      accepting: { WRITE_SUCCEEDED: "terminal", FAILED: "error" },
      rejecting: { TERMINAL_RECORDED: "terminal", FAILED: "error" },
      expired: { TERMINAL_RECORDED: "terminal" },
      terminal: {},
      error: {},
    },
  };
}
