import type { PendingDiff, TerminalDiffCard } from "../types/diff";

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
