/**
 * @GOV
 * codes: BR-DE-UI-003
 * type: RB
 * chain: DE-ACCEPT-DIFF, DE-REJECT-DIFF
 * rules: BR-DE-UI-003
 * boundary: in=pending/preapplied PendingDiff count from diffStore | out=DiffActionBar with 接受全部/拒绝全部 buttons visible when nonTerminalCount ≥ 1; hidden when count = 0
 * term_ref: TERM-DE-001, TERM-DE-012
 */

interface DiffActionBarProps {
  nonTerminalCount: number;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

export function DiffActionBar({ nonTerminalCount, onAcceptAll, onRejectAll }: DiffActionBarProps) {
  // BR-DE-UI-003: DiffActionBar is hidden when no pending/preapplied diffs exist.
  if (nonTerminalCount === 0) return null;

  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: "1px solid var(--border)",
        padding: "6px 8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        fontSize: 12,
        color: "var(--text-secondary)",
        background: "var(--bg-panel)",
      }}
    >
      <span style={{ whiteSpace: "nowrap" }}>
        AI 修改待处理（{nonTerminalCount}）
      </span>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 11, padding: "3px 10px" }}
          onClick={onRejectAll}
        >
          拒绝全部
        </button>
        <button
          className="btn btn-primary"
          style={{ fontSize: 11, padding: "3px 10px" }}
          onClick={onAcceptAll}
        >
          接受全部
        </button>
      </div>
    </div>
  );
}
