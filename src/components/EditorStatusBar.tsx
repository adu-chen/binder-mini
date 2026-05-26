/**
 * @GOV
 * codes: BR-ED-STATE-003, BR-ED-STATE-005
 * type: RB
 * chain: ED-SAVE-FILE
 * rules: BR-ED-STATE-003, BR-ED-STATE-005
 * boundary: in=EditorTab filePath and editorMachine save status string | out=EditorStatusBar row with filePath, saveStatus label, and wordCount
 * term_ref: TERM-ED-001, TERM-ED-003
 */

type SaveStatus = "saved" | "unsaved" | "saving" | "error";

interface EditorStatusBarProps {
  filePath: string;
  saveStatus: SaveStatus;
  wordCount: number;
}

const STATUS_LABELS: Record<SaveStatus, { label: string; color: string }> = {
  saved: { label: "已保存", color: "var(--text-muted)" },
  unsaved: { label: "未保存", color: "var(--warning)" },
  saving: { label: "保存中…", color: "var(--text-secondary)" },
  error: { label: "保存失败", color: "var(--danger)" },
};

export function EditorStatusBar({ filePath, saveStatus, wordCount }: EditorStatusBarProps) {
  const { label, color } = STATUS_LABELS[saveStatus];
  const fileName = filePath.split("/").pop() ?? filePath;

  return (
    <div
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "3px 12px",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-panel)",
        fontSize: 11,
        color: "var(--text-muted)",
        userSelect: "none",
      }}
    >
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: "60%",
        }}
        title={filePath}
      >
        {fileName}
      </span>
      <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
        <span style={{ color }}>{label}</span>
        <span>{wordCount} 字</span>
      </div>
    </div>
  );
}
