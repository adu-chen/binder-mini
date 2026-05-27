/**
 * @GOV
 * codes: BR-DE-UI-001, BR-DE-UI-002
 * type: RB
 * chain: DE-CREATE-DIFF, DE-ACCEPT-DIFF, DE-REJECT-DIFF, DE-EXPIRE-DIFF
 * rules: BR-DE-UI-001, BR-DE-UI-002
 * boundary: in=PendingDiff record and diffMachine state name | out=DiffCard visual block with state-distinct border/background/opacity/operations; red deletion text confined to DiffCard only, never rendered in EditorArea
 * term_ref: TERM-DE-001, TERM-DE-002, TERM-DE-004
 */

import type { PendingDiffStatus } from "../machines/diffMachine";

interface DiffCardProps {
  diffId: string;
  filePath: string;
  originalText: string;
  newText: string;
  status: PendingDiffStatus;
  onAccept: (diffId: string) => void;
  onReject: (diffId: string) => void;
}

interface VisualSpec {
  border: string;
  background: string;
  opacity: number;
  label: string;
  labelColor: string;
  showActions: boolean;
  showBusy: boolean;
}

const VISUAL_MAP: Record<PendingDiffStatus, VisualSpec> = {
  pending: {
    border: "1px solid var(--diff-pending-border)",
    background: "transparent",
    opacity: 1,
    label: "待处理",
    labelColor: "var(--accent)",
    showActions: false,
    showBusy: false,
  },
  preapplied: {
    border: "1px solid var(--diff-pending-border)",
    background: "var(--diff-add-bg)",
    opacity: 1,
    label: "预览中",
    labelColor: "var(--accent)",
    showActions: true,
    showBusy: false,
  },
  accepting: {
    border: "1px solid var(--border)",
    background: "var(--diff-accepted-bg)",
    opacity: 0.7,
    label: "接受中…",
    labelColor: "var(--success)",
    showActions: false,
    showBusy: true,
  },
  rejecting: {
    border: "1px solid var(--border)",
    background: "var(--diff-rejected-bg)",
    opacity: 0.7,
    label: "拒绝中…",
    labelColor: "var(--danger)",
    showActions: false,
    showBusy: true,
  },
  expired: {
    border: "1px solid var(--border)",
    background: "var(--diff-expired-bg)",
    opacity: 0.5,
    label: "已过期",
    labelColor: "var(--text-muted)",
    showActions: false,
    showBusy: false,
  },
  accepted: {
    border: "1px solid var(--border)",
    background: "var(--diff-accepted-bg)",
    opacity: 0.45,
    label: "已接受",
    labelColor: "var(--success)",
    showActions: false,
    showBusy: false,
  },
  rejected: {
    border: "1px solid var(--border)",
    background: "var(--diff-rejected-bg)",
    opacity: 0.45,
    label: "已拒绝",
    labelColor: "var(--danger)",
    showActions: false,
    showBusy: false,
  },
  error: {
    border: "1px solid var(--danger)",
    background: "var(--diff-error-bg)",
    opacity: 0.8,
    label: "错误",
    labelColor: "var(--danger)",
    showActions: false,
    showBusy: false,
  },
};

export function DiffCard({
  diffId,
  filePath,
  originalText,
  newText,
  status,
  onAccept,
  onReject,
}: DiffCardProps) {
  const spec = VISUAL_MAP[status];
  const fileName = filePath.split("/").pop() ?? filePath;

  return (
    <div
      style={{
        border: spec.border,
        background: spec.background,
        opacity: spec.opacity,
        borderRadius: 6,
        overflow: "hidden",
        fontSize: 12,
        transition: "opacity 0.15s",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "5px 8px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-elevated)",
        }}
      >
        <span
          style={{
            color: "var(--text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "70%",
          }}
          title={filePath}
        >
          {fileName}
        </span>
        <span style={{ color: spec.labelColor, flexShrink: 0 }}>
          {spec.label}
          {spec.showBusy && (
            <span style={{ marginLeft: 4, opacity: 0.7 }}>…</span>
          )}
        </span>
      </div>

      {/* Diff body — BR-DE-UI-002: red deletions confined to DiffCard only */}
      <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
        {originalText && (
          <div
            style={{
              background: "var(--diff-del-bg)",
              color: "var(--danger)",
              padding: "3px 6px",
              borderRadius: 3,
              fontFamily: "monospace",
              fontSize: 11,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {`- ${originalText}`}
          </div>
        )}
        {newText && (
          <div
            style={{
              background: "var(--diff-add-bg)",
              color: "var(--success)",
              padding: "3px 6px",
              borderRadius: 3,
              fontFamily: "monospace",
              fontSize: 11,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {`+ ${newText}`}
          </div>
        )}
      </div>

      {/* Actions */}
      {spec.showActions && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 6,
            padding: "4px 8px 6px",
          }}
        >
          <button
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: "3px 10px" }}
            onClick={() => onReject(diffId)}
          >
            拒绝
          </button>
          <button
            className="btn btn-primary"
            style={{ fontSize: 11, padding: "3px 10px" }}
            onClick={() => onAccept(diffId)}
          >
            接受
          </button>
        </div>
      )}
    </div>
  );
}
